import { describe, it, expect } from 'vitest';
import { getVoicings, QS, voicingKey, hasOpenString } from './music.js';
import { STRING_SETS, SCALE } from './music.js';
import { PROGRESSIONS } from './styles.js';
import { centerOf, pinKeyOf, invPinOf, pinMatches, resolvePin, transposeSchedule } from './arranger.js';

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

// A fake schedule exercising every event shape transposeSchedule touches: strum
// (pitch lives in guitarMidis, not on the event), drum (no pitch at all), bass
// and pianoNote/gfill (single m), piano (m is an array — see buildSchedule's
// pushBass/pv sites), and lead with a double-stop art (relative bend fields
// must NOT move).
const fakeSchedule = () => ({
  events: [
    { t: 0, type: 'strum', i: 0, dir: 1, g: 1, span: 'full' },
    { t: 0, type: 'drum', kind: 'kick', g: 1 },
    { t: 0, type: 'bass', m: 45, g: 1 },
    { t: 0, type: 'piano', m: [60, 64], g: 1 },
    { t: 0, type: 'lead', m: 72, g: 1, art: { double: 76, bendFrom: -2 } },
  ],
  loopDur: 4, barDur: 4, spb: 1,
  guitarMidis: [[60, 64, 67]],
  gfillMidis: [40],
  bassMidis: [45],
  leadMidis: [72, 76],
  pianoMidis: [60, 64],
  backupMidis: [50],
  passBars: 1,
});

describe('transposeSchedule', () => {
  it('is a no-op (identity) at semis 0', () => {
    const sc = fakeSchedule();
    expect(transposeSchedule(sc, 0)).toBe(sc);
  });

  it('shifts every pitched midi, leaves drums and relative art alone, and does not mutate the input', () => {
    const sc = fakeSchedule();
    const orig = JSON.parse(JSON.stringify(sc));
    const t = transposeSchedule(sc, 2);

    expect(t.guitarMidis).toEqual([[62, 66, 69]]);
    expect(t.gfillMidis).toEqual([42]);
    expect(t.bassMidis).toEqual([47]);
    expect(t.leadMidis).toEqual([74, 78]);
    expect(t.pianoMidis).toEqual([62, 66]);
    expect(t.backupMidis).toEqual([52]);

    const [strum, drum, bass, piano, lead] = t.events;
    expect(strum).toEqual(sc.events[0]); // no m — unchanged
    expect(drum).toEqual(sc.events[1]); // no pitch — unchanged
    expect(bass.m).toBe(47);
    expect(piano.m).toEqual([62, 66]); // array m
    expect(lead.m).toBe(74);
    expect(lead.art.double).toBe(78);
    expect(lead.art.bendFrom).toBe(-2); // relative — untouched

    expect(sc).toEqual(orig); // input schedule not mutated
  });
});
