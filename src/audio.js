/* Playback engine: sampled instruments via Web Audio.
   Guitar/lead: flat per-note MP3s (public/samples/guitar, one file per pitch).
   Bass & drums: manifest-driven sample sets (public/samples/<inst>/manifest.json)
   with velocity layers and round-robins; pitched sets are sparse and notes
   between sampled roots are retuned via playbackRate.
   Every voice runs through a per-instrument channel strip (EQ/pan/gain) into a
   shared synthetic-IR room reverb and a master compressor. */

// Standard tuning, MIDI note of each open string.
export const STRING_MIDI = { 6:40, 5:45, 4:50, 3:55, 2:59, 1:64 };

const FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteName = m => FLAT[m%12] + (Math.floor(m/12) - 1);

let ctx = null;
const loading = new Map();       // cache key -> Promise<AudioBuffer>
const decoded = new Map();       // cache key -> AudioBuffer (resolved)
const manifestLoading = new Map(); // inst -> Promise<manifest|null>
const manifestData = new Map();  // inst -> manifest|null (resolved)
let active = new Set();
let slotLast = new Map();        // voice slot -> last scheduled note, for re-strike damping

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function ensureCtx() { getCtx(); }
export function ctxTime() { return getCtx().currentTime; }

/* ---------- Master bus & channel strips ---------- */

let bus = null;

function getBus() {
  if (bus) return bus;
  const c = getCtx();

  const master = c.createGain();
  master.gain.value = 0.9;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 3;
  comp.attack.value = 0.004; comp.release.value = 0.22;
  // Brickwall safety limiter: the leveler above only has ratio 3, so dense
  // tuttis (kit + keys + lead + strums) could still clip the destination —
  // which sounds like crackling on loud bars, worse at high channel volumes.
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20;
  lim.attack.value = 0.001; lim.release.value = 0.1;
  master.connect(comp); comp.connect(lim); lim.connect(c.destination);

  // Small-room reverb: synthetic exponentially-decaying noise IR, darkening
  // toward the tail. No license baggage and cheap to generate.
  const verb = c.createConvolver();
  const len = Math.floor(c.sampleRate * 1.1);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const a = 0.25 + 0.6 * t; // one-pole lowpass that closes as the tail decays
      lp += a * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, 2.2) * Math.exp(-3.2 * t);
    }
  }
  verb.buffer = ir;
  const verbOut = c.createGain();
  verbOut.gain.value = 1;
  verb.connect(verbOut); verbOut.connect(master);

  const strip = ({ pan = 0, hp, lp }) => {
    const inG = c.createGain();
    let node = inG;
    if (hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    const low = c.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 250;
    const high = c.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 2800;
    node.connect(low); low.connect(high);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    high.connect(p);
    const out = c.createGain();
    p.connect(out);
    out.connect(master);
    const sendG = c.createGain();
    out.connect(sendG); sendG.connect(verb);
    return { in: inG, out, low, high, send: sendG };
  };

  bus = {
    master,
    guitar: strip({ pan:-0.18, hp:75 }),
    lead:   strip({ pan: 0.22, hp:110 }),
    bass:   strip({ pan: 0,    hp:34, lp:3200 }),
    drums:  strip({ pan: 0.08 }),
    piano:  strip({ pan: 0.12, hp:60 }),
  };
  applySettings();
  return bus;
}

/* ---------- Tunable mix settings ---------- */

// The tunable half of the bus (the Mixer UI edits these): master volume and,
// per channel, volume, reverb send, and low/high shelf gains in dB
// (shelves at 250Hz / 2.8kHz). Fixed plumbing (pan, hp/lp) lives in getBus.
export const AUDIO_DEFAULTS = {
  master: 0.9,
  guitar: { vol:0.8,  send:0.60, low:0, high:4 },
  bass:   { vol:0.8,  send:0.04, low:0, high:0 },
  drums:  { vol:0.55, send:0.10, low:4, high:0 },
  lead:   { vol:1.5,  send:0.28, low:0, high:10 },
  piano:  { vol:0.9,  send:0.25, low:0, high:0 },
};

const MIX_KEYS = ['guitar','bass','drums','lead','piano'];
let settings = JSON.parse(JSON.stringify(AUDIO_DEFAULTS));
let mix = {}; // per-progression multipliers on top of the tuned volumes

function applySettings() {
  if (!bus) return;
  const now = getCtx().currentTime, T = 0.03;
  bus.master.gain.setTargetAtTime(settings.master, now, T);
  for (const k of MIX_KEYS) {
    const st = bus[k], s = settings[k];
    st.out.gain.setTargetAtTime(s.vol * (mix[k] ?? 1), now, T);
    st.send.gain.setTargetAtTime(s.send, now, T);
    st.low.gain.setTargetAtTime(s.low, now, T);
    st.high.gain.setTargetAtTime(s.high, now, T);
  }
}

export function getAudioSettings() { return settings; }
export function setAudioSettings(s) { settings = s; applySettings(); }
export function setMix(m) { mix = m || {}; applySettings(); }

/* ---------- Sample loading ---------- */

const BASE = `${import.meta.env.BASE_URL}samples/`;

// Alternate sample sets: guitar folders are flat per-note; bass folders are
// manifest-driven. Switching just remaps the instrument to another folder.
export const GUITAR_SETS = { musyng:'guitar', fluid:'guitar-fluid', fatboy:'guitar-fatboy', nylon:'guitar-nylon', jazz:'guitar-jazz', muted:'guitar-muted', black:'guitar-black', green:'guitar-green' };
export const BASS_SETS = { upright:'bass', electric:'bass-electric' };
export const PIANO_SETS = { vcsl:'piano', osiris:'piano-osiris' };
let guitarFolder = GUITAR_SETS.fatboy;
let bassFolder = BASS_SETS.upright;
let pianoFolder = PIANO_SETS.vcsl;
export function setGuitarSet(key) { guitarFolder = GUITAR_SETS[key] || GUITAR_SETS.fatboy; }
export function setBassSet(key) { bassFolder = BASS_SETS[key] || BASS_SETS.upright; }
export function setPianoSet(key) { pianoFolder = PIANO_SETS[key] || PIANO_SETS.vcsl; }
const folderOf = inst => inst === 'guitar' ? guitarFolder : inst === 'bass' ? bassFolder : inst === 'piano' ? pianoFolder : inst;

function decode(key, url) {
  if (!loading.has(key)) {
    loading.set(key, fetch(url)
      .then(r => { if (!r.ok) throw new Error(`sample ${key}`); return r.arrayBuffer(); })
      .then(ab => getCtx().decodeAudioData(ab))
      .then(buf => { decoded.set(key, buf); return buf; }));
  }
  return loading.get(key);
}

const loadFlat = (inst, midi) => { const d = folderOf(inst); return decode(`${d}:${midi}`, `${BASE}${d}/${noteName(midi)}.mp3`); };
const loadFile = (inst, file) => { const d = folderOf(inst); return decode(`${d}/${file}`, `${BASE}${d}/${file}`); };

function loadManifest(inst) {
  const d = folderOf(inst);
  if (!manifestLoading.has(d)) {
    manifestLoading.set(d, fetch(`${BASE}${d}/manifest.json`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(man => { manifestData.set(d, man); return man; }));
  }
  return manifestLoading.get(d);
}

const layerFiles = piece => (piece.layers || piece).flat();

function nearestRoot(man, midi) {
  let best = null;
  for (const r of Object.keys(man.notes)) {
    if (best === null || Math.abs(r - midi) < Math.abs(best - midi)) best = +r;
  }
  return best;
}

// Resolve when every sample needed for these pitches is decoded.
// Failed loads resolve to null so one missing file doesn't kill playback.
export function preload(midis, inst = 'guitar') {
  return loadManifest(inst).then(man => {
    const uniq = [...new Set(midis)];
    if (!man) return Promise.all(uniq.map(m => loadFlat(inst, m).catch(() => null)));
    const files = new Set();
    for (const m of uniq) {
      const root = nearestRoot(man, m);
      if (root !== null) for (const f of layerFiles(man.notes[root])) files.add(f);
    }
    return Promise.all([...files].map(f => loadFile(inst, f).catch(() => null)));
  });
}

// Load the whole drum kit manifest (a handful of small one-shots).
export function preloadDrums() {
  return loadManifest('drums').then(man => {
    if (!man) return null;
    const files = Object.values(man.pieces).flatMap(layerFiles);
    return Promise.all(files.map(f => loadFile('drums', f).catch(() => null)));
  });
}

/* ---------- Voice start ---------- */

// MIDI notes for a voicing; strs and frets are index-aligned, low string first.
export function voicingMidis(strs, frets) {
  return strs.map((s,i) => STRING_MIDI[s] + frets[i]);
}

// Map a musical gain (~0.5–1) onto a velocity-layer index.
function layerIndex(gain, nLayers) {
  const pos = Math.min(1, Math.max(0, (gain - 0.6) / 0.4));
  return Math.min(nLayers - 1, Math.floor(pos * nLayers));
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// art (articulations): bendFrom (semitones below target, ramped up to pitch
// over bendDur seconds) and offset (start into the buffer, skipping the pick
// attack, with a fast fade-in — reads as a hammer-on/pull-off).
function startBuf(buf, when, gain, dest, rate = 1, art) {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = buf;
  if (art?.bendFrom) {
    src.playbackRate.setValueAtTime(rate * Math.pow(2, art.bendFrom / 12), when);
    src.playbackRate.linearRampToValueAtTime(rate, when + (art.bendDur || 0.12));
  } else {
    src.playbackRate.value = rate;
  }
  const g = c.createGain();
  src.connect(g);
  g.connect(dest.in);
  if (art?.offset) {
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    src.start(when, art.offset);
  } else {
    g.gain.value = gain;
    src.start(when);
  }
  const entry = { src, g, when };
  active.add(entry);
  src.onended = () => active.delete(entry);
  return entry;
}

// Per-set loudness trims, measured 2026-07-10 as attack RMS (first 250ms,
// eight notes E2–D5) relative to FatBoy, the default set the mixer was tuned
// against. Fluid ran ~4dB hot; E.Jazz ~1dB quiet; E.Muted sat -6.7dB RMS but
// its peaks already match FatBoy (it's pure attack), so full RMS matching
// would make the transients jump — 1.6 is the compromise. The two bass sets
// measured within 0.7dB of each other, so no trim. Applied after
// velocity-layer selection so leveling never changes which sample plays.
const SET_TRIM = {
  'guitar':1, 'guitar-fluid':0.63, 'guitar-fatboy':1, 'guitar-nylon':1,
  'guitar-jazz':1.15, 'guitar-muted':1.6,
  'guitar-black':0.45, 'guitar-green':0.9, // B&G import, measured vs FatBoy 2026-07-10
  'bass':1, 'bass-electric':1,
  'piano':1, 'piano-osiris':1.2,            // measured vs VCSL 2026-07-10
};

function startNote(midi, when, gain, inst, dest, art) {
  const d = folderOf(inst);
  const trim = SET_TRIM[d] ?? 1;
  const man = manifestData.get(d);
  if (man) {
    const root = nearestRoot(man, midi);
    if (root === null) return null;
    const layers = man.notes[root].layers || man.notes[root];
    const file = pick(layers[layerIndex(gain, layers.length)]);
    const buf = decoded.get(`${d}/${file}`);
    if (!buf) return null;
    return startBuf(buf, when, gain * trim, dest, Math.pow(2, (midi - root) / 12), art);
  }
  const buf = decoded.get(`${d}:${midi}`);
  if (!buf) return null;
  return startBuf(buf, when, gain * trim, dest, 1, art);
}

/* ---------- Musical scheduling ---------- */

// Schedule one strum at an absolute AudioContext time. Notes must be preloaded.
// span: 'full' (all strings), 'top' (upper strings — the "chick"), or 'bass'
// (single lowest note — the "boom"). Up strums play high-to-low.
// Re-striking a string damps what it was playing — that (plus a tight, slightly
// uneven stagger and a velocity taper across strings) is what separates a
// strummed guitar from an autoharp wash.
export function scheduleStrum(midis, when, { dir='down', gain=1, span } = {}) {
  const dest = getBus().guitar;
  const n = midis.length;
  const sp = span || (dir==='up' ? 'top' : 'full');
  let slots = midis.map((_,i)=>i);
  if (sp==='bass') slots=[0];
  else if (sp==='top') slots=slots.slice(-(dir==='down'?4:3));
  if (dir==='up') slots=[...slots].reverse();
  const stagger = dir==='down' ? 0.014 : 0.011;
  let t = when;
  for (const slot of slots) {
    const prev = slotLast.get(slot);
    if (prev) {
      try { prev.g.gain.setTargetAtTime(0, Math.max(prev.t, t-0.012), 0.02); } catch { /* ended */ }
    }
    const pos = n>1 ? slot/(n-1) : 0; // 0 = bass, 1 = treble
    const taper = dir==='down' ? 1-0.25*pos : 0.5+0.2*pos;
    const entry = startNote(midis[slot], t, gain*taper*(0.9+Math.random()*0.2), 'guitar', dest);
    if (entry) slotLast.set(slot, { ...entry, t });
    t += stagger*(0.8+Math.random()*0.4);
  }
}

// Upright bass: monophonic — each note damps the previous one.
export function scheduleBass(midi, when, gain=0.9) {
  const prev = slotLast.get('bass');
  if (prev) {
    try { prev.g.gain.setTargetAtTime(0, Math.max(prev.t, when-0.015), 0.03); } catch { /* ended */ }
  }
  const entry = startNote(midi, when, gain, 'bass', getBus().bass);
  if (entry) slotLast.set('bass', { ...entry, t: when });
}

// Piano comping: block chords, softly rolled; each new chord damps the
// previous one (pedal-up phrasing). damp:false lets a note ring over what's
// already sounding (fill runs) — the next damped chord clears everything.
export function schedulePiano(midis, when, gain=0.6, { damp=true } = {}) {
  const prev = slotLast.get('piano') || [];
  if (damp) for (const p of prev) {
    try { p.g.gain.setTargetAtTime(0, Math.max(p.t, when-0.02), 0.06); } catch { /* ended */ }
  }
  const dest = getBus().piano;
  const entries = [];
  let t = when;
  for (const m of midis) {
    const e = startNote(m, t, gain*(0.92+Math.random()*0.16), 'piano', dest);
    if (e) entries.push({ ...e, t });
    t += 0.008*(0.6+Math.random()*0.8);
  }
  slotLast.set('piano', damp ? entries : [...prev, ...entries]);
}

// Lead guitar: single-note lines (with optional articulations) on the same
// guitar samples. art.double adds a second simultaneous note (double stop).
export function scheduleLead(midi, when, gain=0.6, art) {
  const prev = slotLast.get('lead') || [];
  for (const p of Array.isArray(prev)?prev:[prev]) {
    try { p.g.gain.setTargetAtTime(0, Math.max(p.t, when-0.01), 0.025); } catch { /* ended */ }
  }
  const dest = getBus().lead;
  const ms = art?.double!=null ? [midi, art.double] : [midi];
  const entries = [];
  for (const m of ms) {
    const e = startNote(m, when, gain, 'guitar', dest, art);
    if (e) entries.push({ ...e, t: when });
  }
  slotLast.set('lead', entries);
}

/* ---------- Drums: sampled kit with synth fallback ---------- */

let noiseBuf = null;
function getNoise() {
  if (!noiseBuf) {
    const c = getCtx();
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  }
  return noiseBuf;
}

function noiseBurst(when, dur, freq, type, gain) {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = getNoise();
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.001, when+dur);
  src.connect(f); f.connect(g); g.connect(getBus().drums.in);
  src.start(when); src.stop(when+dur+0.02);
  const entry = { src, g, when };
  active.add(entry);
  src.onended = () => active.delete(entry);
}

function thump(when, f0, f1, dur, gain) {
  const c = getCtx();
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f1, when+0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.001, when+dur);
  o.connect(g); g.connect(getBus().drums.in);
  o.start(when); o.stop(when+dur+0.05);
  const entry = { src: o, g, when };
  active.add(entry);
  o.onended = () => active.delete(entry);
}

export function scheduleDrum(kind, when, gain=1) {
  const man = manifestData.get('drums');
  const piece = man?.pieces?.[kind];
  if (piece) {
    const layers = piece.layers || piece;
    const file = pick(layers[layerIndex(gain, layers.length)]);
    const buf = decoded.get(`drums/${file}`);
    if (buf) { startBuf(buf, when, gain*(piece.trim ?? 1), getBus().drums); return; }
  }
  // Synth fallbacks: pieces with no samples (stomp, brush) or not yet loaded.
  if (kind==='stomp') {
    thump(when, 95, 40, 0.16, gain*0.9);
    noiseBurst(when, 0.05, 350, 'lowpass', gain*0.25);
  } else if (kind==='kick') {
    thump(when, 140, 45, 0.25, gain*0.8);
  } else if (kind==='snare') {
    noiseBurst(when, 0.13, 1600, 'highpass', gain*0.3);
    thump(when, 220, 170, 0.09, gain*0.2);
  } else if (kind==='hat') {
    noiseBurst(when, 0.045, 7000, 'highpass', gain*0.1);
  } else if (kind==='brush') {
    noiseBurst(when, 0.07, 3000, 'bandpass', gain*0.18);
  }
}

/* ---------- Global control ---------- */

// Cancel sources that haven't started sounding yet — click-free by
// definition, since they're still silent — and leave ringing notes to decay.
// Live rebuilds use this instead of stopAll: the per-slot re-strike damping
// in scheduleStrum/Bass/Piano/Lead fades the old notes when the new
// schedule's next hit lands on the same slot, so settings changes mid-play
// are seamless (no gap, no cut). slotLast is kept for exactly that reason.
export function cancelPending() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const entry of active) {
    if (entry.when > now + 0.005) {
      try { entry.src.stop(); } catch { /* already stopped */ }
      active.delete(entry);
    }
  }
}

// Fade out everything sounding or scheduled (the Stop button / one-off strum).
// Pending sources are killed silently; sounding ones fade with a time constant
// short enough to feel immediate but a stop point ~13τ out, so the residual at
// the hard cut is ~-110dB — the old 0.13s stop left ~-42dB, an audible click
// when a full band was cut at once.
export function stopAll(fade=0.08) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { src, g, when } of active) {
    try {
      if (when > now + 0.005) { src.stop(); continue; }
      g.gain.setTargetAtTime(0, now, fade/5);
      src.stop(now + fade*2 + 0.05);
    } catch { /* already stopped */ }
  }
  active = new Set();
  slotLast = new Map();
}

// One-off strum for click-to-play. Damps whatever is ringing first.
export async function strum(midis, { stagger=0.045 } = {}) {
  getCtx();
  stopAll();
  await preload(midis);
  const t0 = ctxTime() + 0.02;
  midis.forEach((m,i) => startNote(m, t0 + i*stagger, 0.7 + Math.random()*0.15, 'guitar', getBus().guitar));
}
