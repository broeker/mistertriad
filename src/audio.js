/* Chord playback: sampled acoustic guitar strums via Web Audio.
   Samples are per-note MP3s in public/samples/guitar (see README there). */

// Standard tuning, MIDI note of each open string.
export const STRING_MIDI = { 6:40, 5:45, 4:50, 3:55, 2:59, 1:64 };

const FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const noteName = m => FLAT[m%12] + (Math.floor(m/12) - 1);

let ctx = null;
const buffers = new Map();
let active = [];

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function load(midi) {
  if (!buffers.has(midi)) {
    buffers.set(midi, fetch(`${import.meta.env.BASE_URL}samples/guitar/${noteName(midi)}.mp3`)
      .then(r => { if (!r.ok) throw new Error(`sample ${noteName(midi)}`); return r.arrayBuffer(); })
      .then(ab => getCtx().decodeAudioData(ab)));
  }
  return buffers.get(midi);
}

// MIDI notes for a voicing; strs and frets are index-aligned, low string first.
export function voicingMidis(strs, frets) {
  return strs.map((s,i) => STRING_MIDI[s] + frets[i]);
}

// Strum the given MIDI notes low-to-high in array order. Re-strumming damps
// the previous chord first, like fretting a new grip.
export async function strum(midis, { stagger=0.045 } = {}) {
  const c = getCtx();
  const now = c.currentTime;
  for (const { g } of active) {
    try { g.gain.setTargetAtTime(0, now, 0.04); } catch { /* already gone */ }
  }
  active = [];
  const bufs = await Promise.all(midis.map(m => load(m).catch(() => null)));
  const t0 = c.currentTime + 0.02;
  bufs.forEach((buf, i) => {
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = 0.7 + Math.random()*0.15;
    src.connect(g);
    g.connect(c.destination);
    src.start(t0 + i*stagger);
    active.push({ src, g });
  });
}
