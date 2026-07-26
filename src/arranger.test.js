import { describe, it, expect } from 'vitest';
import { getVoicings, QS, voicingKey, hasOpenString } from './music.js';
import { STRING_SETS, SCALE } from './music.js';
import { PROGRESSIONS } from './styles.js';
import { centerOf, pinKeyOf, invPinOf, pinMatches, resolvePin } from './arranger.js';

const ML111 = PROGRESSIONS.altcountry.find(p => p.name === 'ML111');
const SET = STRING_SETS.find(s => s.key === '321');

// Mirror of Player's candidatesFor, restricted to the 3-2-1 set.
const candsFor = (key, [deg, q = 'maj']) => {
  const root = (key + SCALE[deg]) % 12;
  return getVoicings(QS[q].iv.map(iv => (root + iv) % 12), root, SET.strs)
    .map(v => ({ ...v, set: SET }))
    .sort((a, b) => centerOf(a) - centerOf(b));
};

// Mirror of pathForAnchor's pinned branch: each bar resolves against the one before.
const pathFor = key => {
  const path = [];
  ML111.bars.forEach((bar, i) => {
    path.push(resolvePin(ML111.pins[i], candsFor(key, bar), i > 0 ? path[i - 1] : null));
  });
  return path;
};

// The voicings transcribed from the ActiveMelody ML111 tab, written in G.
const TAB_IN_G = [
  '4,3,3', '4,5,3', '7,7,5', '5,5,5', '4,3,3', '4,5,3', '7,7,5', '5,5,5',
  '9,8,8', '11,10,10', '7,8,7', '9,8,7', '9,8,8', '11,10,10', '7,8,7', '9,8,7',
  '9,8,8', '11,10,10',
];

describe('pin forms', () => {
  const g = candsFor(7, [0]).find(v => voicingKey(v) === '4,3,3');
  it('reads a fret pin and a shape pin off the same voicing', () => {
    expect(pinKeyOf(g)).toBe('321:4,3,3');
    expect(invPinOf(g)).toBe('321#3rd');
  });
  it('matches either form, and neither for a different shape', () => {
    expect(pinMatches('321:4,3,3', g)).toBe(true);
    expect(pinMatches('321#3rd', g)).toBe(true);
    expect(pinMatches('321#5th', g)).toBe(false);
    expect(pinMatches(null, g)).toBe(false);
  });
  it('resolves a shape pin to the occurrence nearest the reference', () => {
    // F major states 3rd-in-bass twice inside the 14-fret search: 2,1,1 and 14,13,13.
    const cands = candsFor(5, [0]);
    expect(cands.filter(v => pinMatches('321#3rd', v)).map(voicingKey)).toEqual(['2,1,1', '14,13,13']);
    expect(voicingKey(resolvePin('321#3rd', cands, null))).toBe('2,1,1');
    expect(voicingKey(resolvePin('321#3rd', cands, { frets: [12, 12, 12] }))).toBe('14,13,13');
    expect(voicingKey(resolvePin('321#3rd', cands, { frets: [4, 3, 3] }))).toBe('2,1,1');
  });
  it('returns null when nothing matches', () => {
    expect(resolvePin('654#3rd', candsFor(7, [0]), null)).toBe(null);
  });
});

describe('ML111', () => {
  it('has one pin per bar', () => {
    expect(Object.keys(ML111.pins)).toHaveLength(ML111.bars.length);
  });

  it('reproduces the tab exactly in G', () => {
    expect(pathFor(7).map(voicingKey)).toEqual(TAB_IN_G);
  });

  it('spells the right chord in every bar, in every key', () => {
    for (let key = 0; key < 12; key++) {
      pathFor(key).forEach((v, i) => {
        const [deg, q = 'maj'] = ML111.bars[i];
        const root = (key + SCALE[deg]) % 12;
        const want = new Set(QS[q].iv.map(iv => (root + iv) % 12));
        const got = new Set(v.set.strs.map((s, j) => (OPEN_PC[s] + v.frets[j]) % 12));
        expect([...got].sort()).toEqual([...want].sort());
      });
    }
  });

  it('keeps the lesson playable in every key — closed shapes, hand in position', () => {
    for (let key = 0; key < 12; key++) {
      const path = pathFor(key);
      expect(path.every(Boolean)).toBe(true);
      expect(path.some(v => hasOpenString(v.frets))).toBe(false);
      expect(Math.max(...path.flatMap(v => v.frets))).toBeLessThanOrEqual(14);
    }
  });
});

const OPEN_PC = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };
