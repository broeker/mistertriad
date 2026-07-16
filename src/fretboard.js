/* Shared geometry + labels for the chord-grid diagrams (FretDiag, GripDiag, and
   the print voicings). Kept framework-free so any diagram can import it. */

import { NOTES, IV_LABEL } from './music.js';

// The vertical fret window for a set of played fret numbers (open = 0, muted
// strings omitted): where the grid starts/ends and whether the nut is drawn.
// Low grips (nothing above the 4th) sit at the nut; higher ones show a fret
// marker and a 4-fret window around the lowest fretted note.
export function fretWindow(played) {
  const maxF = Math.max(...played);
  const minNZ = Math.min(...played.filter(f=>f>0), maxF);
  const startF = maxF<=4 ? 0 : Math.max(0, minNZ-1);
  const endF = Math.max(startF+4, maxF+1);
  return { maxF, minNZ, startF, endF, nFrets: endF-startF, hasNut: startF===0 };
}

// Dot label: the interval degree (R, ♭3, 5, ♭7…) when the root is known,
// otherwise the raw note name.
export const dotLabel = (interval, note) =>
  interval!=null ? (IV_LABEL[interval]||interval) : NOTES[note];
