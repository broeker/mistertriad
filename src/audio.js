/* Chord playback: sampled acoustic guitar strums via Web Audio.
   Samples are per-note MP3s in public/samples/guitar (see README there). */

// Standard tuning, MIDI note of each open string.
export const STRING_MIDI = { 6:40, 5:45, 4:50, 3:55, 2:59, 1:64 };

const FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteName = m => FLAT[m%12] + (Math.floor(m/12) - 1);

let ctx = null;
const loading = new Map();   // midi -> Promise<AudioBuffer>
const decoded = new Map();   // midi -> AudioBuffer (resolved)
let active = new Set();
let slotLast = new Map();    // string slot -> last scheduled note, for re-strike damping

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function ensureCtx() { getCtx(); }
export function ctxTime() { return getCtx().currentTime; }

function load(midi, inst='guitar') {
  const key = inst+':'+midi;
  if (!loading.has(key)) {
    loading.set(key, fetch(`${import.meta.env.BASE_URL}samples/${inst}/${noteName(midi)}.mp3`)
      .then(r => { if (!r.ok) throw new Error(`sample ${inst} ${noteName(midi)}`); return r.arrayBuffer(); })
      .then(ab => getCtx().decodeAudioData(ab))
      .then(buf => { decoded.set(key, buf); return buf; }));
  }
  return loading.get(key);
}

// Resolve when every needed sample is decoded (failed loads resolve to null).
export function preload(midis, inst='guitar') {
  return Promise.all([...new Set(midis)].map(m => load(m, inst).catch(() => null)));
}

// MIDI notes for a voicing; strs and frets are index-aligned, low string first.
export function voicingMidis(strs, frets) {
  return strs.map((s,i) => STRING_MIDI[s] + frets[i]);
}

function startNote(midi, when, gain, inst='guitar') {
  const buf = decoded.get(inst+':'+midi);
  if (!buf) return null;
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(c.destination);
  src.start(when);
  const entry = { src, g };
  active.add(entry);
  src.onended = () => active.delete(entry);
  return entry;
}

// Schedule one strum at an absolute AudioContext time. Notes must be preloaded.
// span: 'full' (all strings), 'top' (upper strings — the "chick"), or 'bass'
// (single lowest note — the "boom"). Up strums play high-to-low.
// Re-striking a string damps what it was playing — that (plus a tight, slightly
// uneven stagger and a velocity taper across strings) is what separates a
// strummed guitar from an autoharp wash.
export function scheduleStrum(midis, when, { dir='down', gain=1, span } = {}) {
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
    const entry = startNote(midis[slot], t, gain*taper*(0.9+Math.random()*0.2));
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
  const entry = startNote(midi, when, gain, 'bass');
  if (entry) slotLast.set('bass', { ...entry, t: when });
}

// Lead guitar: monophonic single-note lines on the same guitar samples.
export function scheduleLead(midi, when, gain=0.6) {
  const prev = slotLast.get('lead');
  if (prev) {
    try { prev.g.gain.setTargetAtTime(0, Math.max(prev.t, when-0.01), 0.025); } catch { /* ended */ }
  }
  const entry = startNote(midi, when, gain, 'guitar');
  if (entry) slotLast.set('lead', { ...entry, t: when });
}

/* Synthesized drums: kick, snare, hat, and a duller foot-stomp thud. */
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
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(when); src.stop(when+dur+0.02);
  const entry = { src, g };
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
  o.connect(g); g.connect(c.destination);
  o.start(when); o.stop(when+dur+0.05);
  const entry = { src: o, g };
  active.add(entry);
  o.onended = () => active.delete(entry);
}

export function scheduleDrum(kind, when, gain=1) {
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

// Fade out everything sounding or scheduled.
export function stopAll(fade=0.08) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { src, g } of active) {
    try {
      g.gain.setTargetAtTime(0, now, fade/3);
      src.stop(now + fade + 0.05);
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
  midis.forEach((m,i) => startNote(m, t0 + i*stagger, 0.7 + Math.random()*0.15));
}
