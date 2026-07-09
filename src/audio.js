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

function load(midi) {
  if (!loading.has(midi)) {
    loading.set(midi, fetch(`${import.meta.env.BASE_URL}samples/guitar/${noteName(midi)}.mp3`)
      .then(r => { if (!r.ok) throw new Error(`sample ${noteName(midi)}`); return r.arrayBuffer(); })
      .then(ab => getCtx().decodeAudioData(ab))
      .then(buf => { decoded.set(midi, buf); return buf; }));
  }
  return loading.get(midi);
}

// Resolve when every needed sample is decoded (failed loads resolve to null).
export function preload(midis) {
  return Promise.all([...new Set(midis)].map(m => load(m).catch(() => null)));
}

// MIDI notes for a voicing; strs and frets are index-aligned, low string first.
export function voicingMidis(strs, frets) {
  return strs.map((s,i) => STRING_MIDI[s] + frets[i]);
}

function startNote(midi, when, gain) {
  const buf = decoded.get(midi);
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
// Down = low-to-high, full voicing; up = top three notes, high-to-low, lighter.
// Re-striking a string damps what it was playing — that (plus a tight, slightly
// uneven stagger and a velocity taper across strings) is what separates a
// strummed guitar from an autoharp wash.
export function scheduleStrum(midis, when, { dir='down', gain=1 } = {}) {
  const n = midis.length;
  const slots = dir==='down' ? midis.map((_,i)=>i) : midis.map((_,i)=>i).slice(-3).reverse();
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
