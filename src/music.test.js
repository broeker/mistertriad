import { describe, it, expect } from 'vitest';
import {
  NOTES, OPEN, QS, QKEYS, CAGED,
  fretSpan, hasOpenString, isPlayable,
  getVoicings, scoreVoicing, closestVoicing,
  matchCAGED, matchCAGEDZone, firstPositionGrip, voicingKey, isMinorFamily,
} from './music.js';

const chordTones = (root, quality) => QS[quality].iv.map(iv => (root + iv) % 12);
const ALL_ROOTS = [...Array(12).keys()];
const SET_321 = [3, 2, 1];

describe('fretSpan', () => {
  it('ignores open strings and returns the fretted spread', () => {
    expect(fretSpan([0, 0, 0])).toBe(0);
    expect(fretSpan([5, 5, 5])).toBe(0);
    expect(fretSpan([3, 5, 7])).toBe(4);
    expect(fretSpan([0, 2, 5])).toBe(3); // the lone 0 is excluded
  });
});

describe('hasOpenString', () => {
  it('is true iff any fret is 0', () => {
    expect(hasOpenString([0, 2, 3])).toBe(true);
    expect(hasOpenString([1, 2, 3])).toBe(false);
  });
});

describe('isPlayable', () => {
  it('allows open voicings only in first position (max fret <= 3)', () => {
    expect(isPlayable([0, 1, 2])).toBe(true);
    expect(isPlayable([0, 2, 3])).toBe(true);
    expect(isPlayable([0, 2, 5])).toBe(false); // open string but reaches fret 5
  });
  it('rejects fretted voicings spanning more than 3 frets', () => {
    expect(isPlayable([5, 6, 7])).toBe(true);
    expect(isPlayable([5, 7, 8])).toBe(true);
    expect(isPlayable([4, 7, 9])).toBe(false); // classic spread voicing, span 5
  });
});

describe('getVoicings', () => {
  it('returns only voicings that are internally consistent', () => {
    for (const root of ALL_ROOTS) {
      for (const quality of QKEYS) {
        const notes = chordTones(root, quality);
        const vs = getVoicings(notes, root, SET_321);
        for (const v of vs) {
          // three fretted positions, one per string in the set
          expect(v.frets).toHaveLength(3);
          expect(v.notes).toHaveLength(3);
          // every fret produces the pitch class the voicing claims
          v.frets.forEach((f, i) => {
            expect((OPEN[SET_321[i]] + f) % 12).toBe(((v.notes[i] % 12) + 12) % 12);
          });
          // the voicing's notes are exactly the chord tones (a permutation)
          expect([...v.notes].sort((a, b) => a - b)).toEqual([...notes].sort((a, b) => a - b));
          // rootIdx marks exactly the positions holding the root
          v.notes.forEach((n, i) => {
            expect(v.rootIdx.includes(i)).toBe(n === root);
          });
          // every returned voicing passes the playability filter it was screened by
          expect(isPlayable(v.frets)).toBe(true);
          expect(Math.max(...v.frets)).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it('returns voicings sorted by position (mean fret) ascending', () => {
    const vs = getVoicings(chordTones(0, 'maj'), 0, SET_321);
    for (let i = 1; i < vs.length; i++) expect(vs[i].pos).toBeGreaterThanOrEqual(vs[i - 1].pos);
  });

  it('finds at least one voicing for every triad and 7th on the top set', () => {
    for (const root of ALL_ROOTS) {
      for (const quality of QKEYS) {
        expect(getVoicings(chordTones(root, quality), root, SET_321).length).toBeGreaterThan(0);
      }
    }
  });

  it('labels inversions by the pitch class in the bass', () => {
    // C major: root C(0), 3rd E(4), 5th G(7)
    const vs = getVoicings(chordTones(0, 'maj'), 0, SET_321);
    for (const v of vs) {
      const loIv = ((v.notes[0] - 0 + 12) % 12);
      const expected = loIv === 0 ? 'Root in bass' : loIv === 4 ? '3rd in bass' : '5th in bass';
      expect(v.inv).toBe(expected);
    }
  });
});

describe('closestVoicing / scoreVoicing', () => {
  it('picks the candidate nearest the reference frets', () => {
    const vs = getVoicings(chordTones(7, 'maj'), 7, SET_321); // G major
    const ref = [0, 0, 3];
    const best = closestVoicing(vs, ref);
    for (const v of vs) {
      expect(scoreVoicing(best, ref)).toBeLessThanOrEqual(scoreVoicing(v, ref));
    }
  });
  it('returns null for an empty candidate list', () => {
    expect(closestVoicing([], [0, 0, 0])).toBeNull();
  });
});

describe('matchCAGED', () => {
  it('only ever returns a real CAGED shape name for the quality, else null', () => {
    for (const root of ALL_ROOTS) {
      for (const quality of ['maj', 'min']) {
        const notes = chordTones(root, quality);
        const shapeNames = CAGED[quality].map(s => s.n);
        for (const v of getVoicings(notes, root, SET_321)) {
          const m = matchCAGED(root, quality, v.notes, v.frets, SET_321);
          if (m) expect(shapeNames).toContain(m.name);
        }
      }
    }
  });
});

describe('matchCAGEDZone', () => {
  it('always resolves a nearest region for maj/min voicings', () => {
    for (const root of ALL_ROOTS) {
      for (const quality of ['maj', 'min']) {
        for (const v of getVoicings(chordTones(root, quality), root, SET_321)) {
          const z = matchCAGEDZone(root, quality, v.frets);
          expect(z).not.toBeNull();
          expect(z.approx).toBe(true);
        }
      }
    }
  });
});

describe('firstPositionGrip', () => {
  it('returns null for qualities without a standard full grip', () => {
    for (const root of ALL_ROOTS) {
      expect(firstPositionGrip(root, 'dim')).toBeNull();
      expect(firstPositionGrip(root, 'aug')).toBeNull();
    }
  });

  it('produces in-range frets whose pitch classes match the chord', () => {
    for (const root of ALL_ROOTS) {
      for (const quality of ['maj', 'min', '7', 'maj7', 'min7', 'sus4', 'sus2']) {
        const grip = firstPositionGrip(root, quality);
        expect(grip).not.toBeNull();
        expect(grip.name).toBeTruthy();
        for (const [s, { fret, interval }] of Object.entries(grip.frets)) {
          expect(fret).toBeGreaterThanOrEqual(0);
          expect(fret).toBeLessThanOrEqual(grip.maxFret);
          // each grip note sounds the interval it claims, relative to the root
          expect((OPEN[s] + fret) % 12).toBe((root + interval) % 12);
        }
      }
    }
  });
});

describe('helpers', () => {
  it('isMinorFamily covers min, min7, dim', () => {
    expect(isMinorFamily('min')).toBe(true);
    expect(isMinorFamily('min7')).toBe(true);
    expect(isMinorFamily('dim')).toBe(true);
    expect(isMinorFamily('maj')).toBe(false);
    expect(isMinorFamily('7')).toBe(false);
  });
  it('voicingKey is a stable comma-joined fret string', () => {
    expect(voicingKey({ frets: [1, 2, 3] })).toBe('1,2,3');
    expect(voicingKey(null)).toBe('');
  });
  it('NOTES has 12 pitch classes', () => {
    expect(NOTES).toHaveLength(12);
  });
});
