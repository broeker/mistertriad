/* Static arrangement data: iconic progressions, meters, strum/drum/bass/backup
   patterns, genre style bundles, and section ideas. Pure data plus the small
   helpers that turn bar data into chords and numerals. No React, no audio. */

import { NOTES, SCALE, DEGS, QS } from './music.js';

// Iconic progressions per genre ([degree, quality]; quality defaults to maj).
// Some appear under several genres — that's how music works.
// A progression may carry a `set` object pinning any of the band knobs
// (tempo, feel, strum, drums, bass, lead); knobs it omits are left alone.
export const PROGRESSIONS = {
  blues: [
    { name:'12-Bar Blues', bars:[[0],[0],[0],[0],[3],[3],[0],[0],[4,'7'],[3],[0],[4,'7']] },
    { name:'12-Bar Shuffle (7ths)', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'8-Bar Blues (Highway)', bars:[[0,'7'],[4,'7'],[3,'7'],[3,'7'],[0,'7'],[4,'7'],[0,'7'],[4,'7']] },
    { name:'Minor Blues', bars:[[0,'min7'],[0,'min7'],[0,'min7'],[0,'min7'],[3,'min7'],[3,'min7'],[0,'min7'],[0,'min7'],[4,'7'],[3,'min7'],[0,'min7'],[4,'7']] },
  ],
  oldtime: [
    { name:'Classic (I–IV–V–I)', bars:[[0],[3],[4],[0],[0],[3],[4],[0]] },
    { name:'Classic + Turnaround (I–VI7–II7–V7)', bars:[[0],[3],[4],[0],[0],[5,'7'],[1,'7'],[4,'7']] },
    { name:'Hank (I–IV–V–vi)', bars:[[0],[3],[4],[5,'min'],[0],[3],[4],[5,'min']] },
    { name:'Hank + Turnaround (I–VI7–II7–V7)', bars:[[0],[3],[4],[5,'min'],[0],[5,'7'],[1,'7'],[4,'7']] },
    { name:'Bob Wills (I–VI7–ii–V7)', bars:[[0],[5,'7'],[1,'min'],[4,'7'],[0],[5,'7'],[1,'min'],[4,'7']] },
    { name:'Cabbage (I–IV–I–V)', bars:[[0],[3],[0],[4],[0],[3],[4],[0]],
      set:{ tempo:112, strum:'boomchick', drums:'train', bass:'root5' } },
    { name:'I–iii–IV–V–I–iii–I–V', bars:[[0],[2,'min'],[3],[4],[0],[2,'min'],[0],[4]] },
    { name:'Circle (I–IV / I–V)', bars:[[0],[0],[3],[0],[0],[0],[4],[0]] },
    { name:'Two-Chord (I–V)', bars:[[0],[0],[4],[4],[0],[0],[4],[0]] },
  ],
  bluegrass: [
    { name:'I–IV–I–V', bars:[[0],[3],[0],[4],[0],[3],[4],[0]] },
    { name:'Salty Dog (I–VI7–II7–V7)', bars:[[0],[5,'7'],[1,'7'],[4,'7'],[0],[5,'7'],[1,'7'],[4,'7']] },
    { name:'Two-Chord Breakdown (I–V)', bars:[[0],[0],[4],[4],[0],[0],[4],[0]] },
  ],
  altcountry: [
    { name:'I–V–vi–IV', bars:[[0],[4],[5,'min'],[3],[0],[4],[5,'min'],[3]] },
    { name:'vi–IV–I–V', bars:[[5,'min'],[3],[0],[4],[5,'min'],[3],[0],[4]] },
    { name:'50s (I–vi–IV–V)', bars:[[0],[5,'min'],[3],[4],[0],[5,'min'],[3],[4]] },
    { name:'Jangle (I–IV)', bars:[[0],[0],[3],[3],[0],[0],[3],[3]] },
  ],
  lofi: [
    { name:'ii7–V7–Imaj7', bars:[[1,'min7'],[4,'7'],[0,'maj7'],[0,'maj7'],[1,'min7'],[4,'7'],[0,'maj7'],[0,'maj7']] },
    { name:'Imaj7–vi7–ii7–V7', bars:[[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7']] },
    { name:'iii7–vi7–ii7–V7', bars:[[2,'min7'],[5,'min7'],[1,'min7'],[4,'7'],[2,'min7'],[5,'min7'],[1,'min7'],[4,'7']] },
  ],
  folk: [
    { name:'Paradise (I–IV–I–V)', bars:[[0],[0],[3],[0],[0],[0],[4],[0]] },
    { name:'I–IV–V', bars:[[0],[3],[4],[0],[0],[3],[4],[0]] },
    { name:'Two-Chord (I–V)', bars:[[0],[0],[4],[4],[0],[0],[4],[0]] },
  ],
  pop: [
    { name:'Axis (I–V–vi–IV)', bars:[[0],[4],[5,'min'],[3],[0],[4],[5,'min'],[3]] },
    { name:'vi–IV–I–V', bars:[[5,'min'],[3],[0],[4],[5,'min'],[3],[0],[4]] },
    { name:'50s (I–vi–IV–V)', bars:[[0],[5,'min'],[3],[4],[0],[5,'min'],[3],[4]] },
    { name:'I–IV–vi–V', bars:[[0],[3],[5,'min'],[4],[0],[3],[5,'min'],[4]] },
  ],
  indiepop: [
    { name:'Jangle (I–IV)', bars:[[0],[0],[3],[3],[0],[0],[3],[3]] },
    { name:'I–iii–vi–IV', bars:[[0],[2,'min'],[5,'min'],[3],[0],[2,'min'],[5,'min'],[3]] },
    { name:'IV–I–V–vi', bars:[[3],[0],[4],[5,'min'],[3],[0],[4],[5,'min']] },
    { name:'Borrowed iv (I–IV–iv–I)', bars:[[0],[0],[3],[3,'min'],[0],[0],[3,'min'],[0]] },
  ],
  bossa: [
    { name:'ii7–V7–Imaj7', bars:[[1,'min7'],[4,'7'],[0,'maj7'],[0,'maj7'],[1,'min7'],[4,'7'],[0,'maj7'],[0,'maj7']] },
    { name:'So Danço (Imaj7–II7–ii7–V7)', bars:[[0,'maj7'],[0,'maj7'],[1,'7'],[1,'7'],[1,'min7'],[1,'min7'],[4,'7'],[4,'7']] },
    { name:'Minor Bossa (vi7–ii7–V7–Imaj7)', bars:[[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7']] },
  ],
  jazz: [
    { name:'ii–V–I', bars:[[1,'min7'],[4,'7'],[0,'maj7'],[0,'maj7']] },
    { name:'Rhythm (I–vi–ii–V)', bars:[[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7']] },
    { name:'iii–vi–ii–V', bars:[[2,'min7'],[5,'min7'],[1,'min7'],[4,'7'],[2,'min7'],[5,'min7'],[1,'min7'],[4,'7']] },
    { name:'Jazz Blues', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[1,'min7'],[4,'7'],[0,'7'],[4,'7']] },
  ],
  funk: [
    { name:'One-Chord Vamp (I7)', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7']] },
    { name:'I7–IV7 Vamp', bars:[[0,'7'],[0,'7'],[3,'7'],[3,'7']] },
    { name:'vi7–ii7 Vamp', bars:[[5,'min7'],[5,'min7'],[1,'min7'],[1,'min7']] },
  ],
  honkytonk: [
    { name:'12-Bar Country', bars:[[0],[0],[0],[0],[3],[3],[0],[0],[4],[4],[0],[0]] },
    { name:'I–IV–I–V', bars:[[0],[3],[0],[4],[0],[3],[4],[0]] },
    { name:'I–I7–IV–V7', bars:[[0],[0,'7'],[3],[4,'7'],[0],[0,'7'],[3],[4,'7']] },
  ],
  piedmont: [
    { name:'8-Bar Blues (Highway)', bars:[[0,'7'],[4,'7'],[3,'7'],[3,'7'],[0,'7'],[4,'7'],[0,'7'],[4,'7']] },
    { name:'Freight Train (I–V7–III7–IV)', bars:[[0],[0],[4,'7'],[4,'7'],[0],[0],[2,'7'],[2,'7'],[3],[3],[0],[4,'7']] },
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
  ],
  slowblues: [
    { name:'12-Bar Slow Blues (7ths)', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Minor Blues', bars:[[0,'min7'],[0,'min7'],[0,'min7'],[0,'min7'],[3,'min7'],[3,'min7'],[0,'min7'],[0,'min7'],[4,'7'],[3,'min7'],[0,'min7'],[4,'7']] },
  ],
  folkwaltz: [
    { name:'Waltz (I–IV–I–V)', bars:[[0],[3],[0],[4],[0],[3],[4],[0]] },
    { name:'Waltz (I–vi–IV–V)', bars:[[0],[5,'min'],[3],[4],[0],[5,'min'],[3],[4]] },
    { name:'Two-Chord Waltz (I–V)', bars:[[0],[0],[4],[4],[0],[0],[4],[0]] },
  ],
  countrywaltz: [
    { name:'Waltz (I–IV–I–V)', bars:[[0],[3],[0],[4],[0],[3],[4],[0]] },
    { name:'Waltz (I–V–V–I)', bars:[[0],[0],[4],[4],[4],[4],[0],[0]] },
    { name:'Waltz (I–I7–IV–I)', bars:[[0],[0,'7'],[3],[0],[0],[0,'7'],[4],[0]] },
  ],
  rocknroll: [
    { name:'50s (I–vi–IV–V)', bars:[[0],[5,'min'],[3],[4],[0],[5,'min'],[3],[4]] },
    { name:'12-Bar Rock & Roll', bars:[[0],[0],[0],[0],[3],[3],[0],[0],[4],[3],[0],[0]] },
    { name:'I–IV–V', bars:[[0],[3],[4],[0],[0],[3],[4],[0]] },
  ],
  rockabilly: [
    { name:'12-Bar Shuffle (7ths)', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'8-Bar Bop (I–V)', bars:[[0],[0],[4],[4],[0],[0],[4],[0]] },
  ],
  jazzwaltz: [
    { name:'ii–V–I', bars:[[1,'min7'],[4,'7'],[0,'maj7'],[0,'maj7']] },
    { name:'Rhythm (I–vi–ii–V)', bars:[[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7']] },
    { name:'Minor Waltz (vi7–ii7–V7–Imaj7)', bars:[[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7'],[5,'min7'],[1,'min7'],[4,'7'],[0,'maj7']] },
  ],
};
export const toBars = barDefs => barDefs.map(([deg,q='maj'])=>({deg,q}));
export const barsKey = bs => bs.map(b=>`${b.deg}:${b.q}`).join(',');

// How many progression buttons show inline per genre; the rest go behind "More".
export const FEATURED = 4;

export const numeralOf = b => {
  const d = DEGS.find(x=>x.i===b.deg); if (!d) return '?';
  const base = d.n.replace('°','');
  switch (b.q) {
    case 'maj':  return base.toUpperCase();
    case 'min':  return base.toLowerCase();
    case 'dim':  return base.toLowerCase()+'°';
    case '7':    return base.toUpperCase()+'7';
    case 'maj7': return base.toUpperCase()+'maj7';
    case 'min7': return base.toLowerCase()+'7';
    default:     return base.toUpperCase()+QS[b.q].s;
  }
};
// Compact numeral summary with adjacent repeats collapsed: "I–IV–I–V7–IV–I–V7".
export const progSummary = barDefs => {
  const ns = toBars(barDefs).map(numeralOf);
  return ns.filter((n,i)=>i===0||n!==ns[i-1]).join('–');
};

// Meters. Pattern `b` values are quarter-note beats in simple meters; in 6/8
// they're dotted-quarter pulse units (tempo = pulse bpm) with eighths on
// thirds. `grid` is the bar's subdivision — lead lines and fill placement
// derive from it. swing:false meters are already compound, so the Shuffle
// feel is forced straight there.
export const METERS = {
  '4/4': { label:'4/4', beats:4, grid:[0,0.5,1,1.5,2,2.5,3,3.5], swing:true  },
  '3/4': { label:'3/4', beats:3, grid:[0,0.5,1,1.5,2,2.5],       swing:true  },
  '6/8': { label:'6/8', beats:2, grid:[0,1/3,2/3,1,4/3,5/3],     swing:false },
};
export const METER_KEYS = Object.keys(METERS);

// Strum patterns, keyed by meter (span: full/top/bass). A strum supports only
// the meters it defines; the UI hides it elsewhere and falls back to Folk.
export const STRUMS = {
  folk: { label:'Folk', p:{
    '4/4':[ // D-DU-UDU
      { b:0, dir:'down', g:1.0 }, { b:1, dir:'down', g:0.75 }, { b:1.5, dir:'up', g:0.4 },
      { b:2.5, dir:'up', g:0.4 }, { b:3, dir:'down', g:0.75 }, { b:3.5, dir:'up', g:0.4 },
    ],
    '3/4':[ // waltz D-DU-DU
      { b:0, dir:'down', g:1.0 }, { b:1, dir:'down', g:0.7 }, { b:1.5, dir:'up', g:0.4 },
      { b:2, dir:'down', g:0.7 }, { b:2.5, dir:'up', g:0.4 },
    ],
    '6/8':[ // flowing Dud-Dud
      { b:0, dir:'down', g:1.0 }, { b:1/3, dir:'up', g:0.35 }, { b:2/3, dir:'down', g:0.5 },
      { b:1, dir:'down', g:0.8 }, { b:4/3, dir:'up', g:0.35 }, { b:5/3, dir:'down', g:0.5 },
    ],
  }},
  boomchick: { label:'Boom-chick', p:{
    '4/4':[
      { b:0, dir:'down', g:1.0, span:'bass' }, { b:1, dir:'down', g:0.8, span:'top' },
      { b:2, dir:'down', g:0.95, span:'bass' }, { b:3, dir:'down', g:0.8, span:'top' },
    ],
    '3/4':[ // bass-chick-chick
      { b:0, dir:'down', g:1.0, span:'bass' }, { b:1, dir:'down', g:0.8, span:'top' },
      { b:2, dir:'down', g:0.75, span:'top' },
    ],
  }},
  bluegrass: { label:'Bluegrass', p:{
    '4/4':[
      { b:0, dir:'down', g:1.0, span:'bass' }, { b:1, dir:'down', g:0.8, span:'top' }, { b:1.5, dir:'up', g:0.35 },
      { b:2, dir:'down', g:0.95, span:'bass' }, { b:3, dir:'down', g:0.8, span:'top' }, { b:3.5, dir:'up', g:0.35 },
    ],
  }},
  lofi: { label:'Lo-fi', p:{
    '4/4':[
      { b:0, dir:'down', g:0.85 }, { b:1.5, dir:'up', g:0.35 },
      { b:2, dir:'down', g:0.7 }, { b:3.5, dir:'up', g:0.3 },
    ],
    '3/4':[ // sparse waltz comp (doubles as jazz-waltz guitar)
      { b:0, dir:'down', g:0.85 }, { b:1.5, dir:'up', g:0.4 }, { b:2, dir:'down', g:0.55 },
    ],
    '6/8':[
      { b:0, dir:'down', g:0.85 }, { b:2/3, dir:'up', g:0.35 },
      { b:1, dir:'down', g:0.6 }, { b:5/3, dir:'up', g:0.3 },
    ],
  }},
  pop: { label:'Pop', p:{
    '4/4':[
      { b:0, dir:'down', g:1.0 }, { b:0.5, dir:'up', g:0.35 }, { b:1, dir:'down', g:0.6 }, { b:1.5, dir:'up', g:0.4 },
      { b:2, dir:'down', g:0.9 }, { b:2.5, dir:'up', g:0.35 }, { b:3, dir:'down', g:0.6 }, { b:3.5, dir:'up', g:0.45 },
    ],
  }},
  travis: { label:'Travis', p:{
    '4/4':[ // thumb on every beat, soft finger picks on the ands
      { b:0, dir:'down', g:1.0, span:'bass' }, { b:0.5, dir:'up', g:0.4 }, { b:1, dir:'down', g:0.8, span:'bass' }, { b:1.5, dir:'up', g:0.45 },
      { b:2, dir:'down', g:0.95, span:'bass' }, { b:2.5, dir:'up', g:0.4 }, { b:3, dir:'down', g:0.8, span:'bass' }, { b:3.5, dir:'up', g:0.45 },
    ],
    '3/4':[
      { b:0, dir:'down', g:1.0, span:'bass' }, { b:0.5, dir:'up', g:0.4 }, { b:1, dir:'down', g:0.8, span:'bass' },
      { b:1.5, dir:'up', g:0.45 }, { b:2, dir:'down', g:0.85, span:'bass' }, { b:2.5, dir:'up', g:0.4 },
    ],
    '6/8':[ // thumb on both pulses, picks between
      { b:0, dir:'down', g:1.0, span:'bass' }, { b:1/3, dir:'up', g:0.4 }, { b:2/3, dir:'up', g:0.45 },
      { b:1, dir:'down', g:0.85, span:'bass' }, { b:4/3, dir:'up', g:0.4 }, { b:5/3, dir:'up', g:0.45 },
    ],
  }},
  bossa: { label:'Bossa', p:{
    '4/4':[
      { b:0, dir:'down', g:0.85 }, { b:1, dir:'down', g:0.5 }, { b:1.5, dir:'up', g:0.55 },
      { b:2.5, dir:'up', g:0.55 }, { b:3, dir:'down', g:0.6 },
    ],
  }},
  funk: { label:'Funk', p:{
    '4/4':[ // straight-16th scratch accents; falls apart charmingly under shuffle
      { b:0, dir:'down', g:1.0 }, { b:0.75, dir:'up', g:0.45 }, { b:1, dir:'down', g:0.4 }, { b:1.5, dir:'up', g:0.5 },
      { b:2, dir:'down', g:0.9 }, { b:2.75, dir:'up', g:0.45 }, { b:3, dir:'down', g:0.4 }, { b:3.5, dir:'up', g:0.55 },
    ],
  }},
};

// Strums where a country bass-run walkup into the next chord makes musical sense.
export const GFILL_STRUMS=['boomchick','bluegrass','folk','travis'];

// Drum patterns per mode and meter ({b,kind,g}; sw: swings with the feel).
// 4/4 entries are the original inline patterns, transcribed exactly.
export const DRUM_PATTERNS = {
  stomp: {
    '4/4':[ {b:0,kind:'stomp',g:1}, {b:2,kind:'stomp',g:0.8} ],
    '3/4':[ {b:0,kind:'stomp',g:1} ],
    '6/8':[ {b:0,kind:'stomp',g:1}, {b:1,kind:'stomp',g:0.8} ],
  },
  kit: {
    '4/4':[
      {b:0,kind:'kick',g:1}, {b:2,kind:'kick',g:1}, {b:1,kind:'snare',g:1}, {b:3,kind:'snare',g:1},
      {b:0,kind:'hat',g:1,sw:true},{b:0.5,kind:'hat',g:0.7,sw:true},{b:1,kind:'hat',g:1,sw:true},{b:1.5,kind:'hat',g:0.7,sw:true},
      {b:2,kind:'hat',g:1,sw:true},{b:2.5,kind:'hat',g:0.7,sw:true},{b:3,kind:'hat',g:1,sw:true},{b:3.5,kind:'hat',g:0.7,sw:true},
    ],
    '3/4':[ // waltz: kick on 1, soft snares on 2 and 3
      {b:0,kind:'kick',g:1}, {b:1,kind:'snare',g:0.7}, {b:2,kind:'snare',g:0.6},
      {b:0,kind:'hat',g:1,sw:true},{b:0.5,kind:'hat',g:0.7,sw:true},{b:1,kind:'hat',g:1,sw:true},
      {b:1.5,kind:'hat',g:0.7,sw:true},{b:2,kind:'hat',g:1,sw:true},{b:2.5,kind:'hat',g:0.7,sw:true},
    ],
    '6/8':[ // slow-blues 6/8: kick on 1, snare on the second pulse, hats on all six
      {b:0,kind:'kick',g:1}, {b:1,kind:'snare',g:1},
      {b:0,kind:'hat',g:0.85},{b:1/3,kind:'hat',g:0.55},{b:2/3,kind:'hat',g:0.55},
      {b:1,kind:'hat',g:0.85},{b:4/3,kind:'hat',g:0.55},{b:5/3,kind:'hat',g:0.55},
    ],
  },
  train: {
    '4/4':[
      {b:0,kind:'kick',g:0.6}, {b:2,kind:'kick',g:0.6},
      {b:0,kind:'brush',g:0.55,sw:true},{b:0.5,kind:'brush',g:0.55,sw:true},{b:1,kind:'brush',g:1,sw:true},{b:1.5,kind:'brush',g:0.55,sw:true},
      {b:2,kind:'brush',g:0.55,sw:true},{b:2.5,kind:'brush',g:0.55,sw:true},{b:3,kind:'brush',g:1,sw:true},{b:3.5,kind:'brush',g:0.55,sw:true},
    ],
    '3/4':[
      {b:0,kind:'kick',g:0.6},
      {b:0,kind:'brush',g:0.55,sw:true},{b:0.5,kind:'brush',g:0.55,sw:true},{b:1,kind:'brush',g:1,sw:true},
      {b:1.5,kind:'brush',g:0.55,sw:true},{b:2,kind:'brush',g:1,sw:true},{b:2.5,kind:'brush',g:0.55,sw:true},
    ],
    '6/8':[
      {b:0,kind:'kick',g:0.6},
      {b:0,kind:'brush',g:0.85},{b:1/3,kind:'brush',g:0.5},{b:2/3,kind:'brush',g:0.5},
      {b:1,kind:'brush',g:1},{b:4/3,kind:'brush',g:0.5},{b:5/3,kind:'brush',g:0.5},
    ],
  },
  bossa: {
    '4/4':[
      {b:0,kind:'kick',g:0.75}, {b:2,kind:'kick',g:0.75},
      {b:0,kind:'hat',g:0.55},{b:0.5,kind:'hat',g:0.4},{b:1,kind:'hat',g:0.55},{b:1.5,kind:'hat',g:0.4},
      {b:2,kind:'hat',g:0.55},{b:2.5,kind:'hat',g:0.4},{b:3,kind:'hat',g:0.55},{b:3.5,kind:'hat',g:0.4},
      {b:1,kind:'rim',g:0.9},{b:2.5,kind:'rim',g:0.9},
    ],
  },
  swing: {
    '4/4':[
      {b:0,kind:'ride',g:0.8,sw:true},{b:1,kind:'ride',g:1,sw:true},{b:1.5,kind:'ride',g:0.6,sw:true},
      {b:2,kind:'ride',g:0.8,sw:true},{b:3,kind:'ride',g:1,sw:true},{b:3.5,kind:'ride',g:0.6,sw:true},
      {b:1,kind:'hat',g:0.5},{b:3,kind:'hat',g:0.5},
      {b:0,kind:'kick',g:0.3},{b:2,kind:'kick',g:0.3},
    ],
    '3/4':[ // jazz waltz ride
      {b:0,kind:'ride',g:0.9,sw:true},{b:1,kind:'ride',g:1,sw:true},{b:1.5,kind:'ride',g:0.6,sw:true},
      {b:2,kind:'ride',g:0.8,sw:true},
      {b:1,kind:'hat',g:0.5},
      {b:0,kind:'kick',g:0.3},
    ],
  },
  funk: {
    '4/4':[
      {b:0,kind:'kick',g:1},{b:1.75,kind:'kick',g:0.8},{b:2.5,kind:'kick',g:0.9},
      {b:1,kind:'snare',g:1},{b:3,kind:'snare',g:1},
      {b:0.75,kind:'snare',g:0.4},{b:2.25,kind:'snare',g:0.4},
      {b:0,kind:'hat',g:0.85},{b:0.5,kind:'hat',g:0.55},{b:1,kind:'hat',g:0.85},{b:1.5,kind:'hat',g:0.55},
      {b:2,kind:'hat',g:0.85},{b:2.5,kind:'hat',g:0.55},{b:3,kind:'hat',g:0.85},{b:3.5,kind:'hat',g:0.55},
    ],
  },
};

// Which meters each bass mode supports (boogie/bossa/funk lines are 4/4 idioms).
export const BASS_METERS = {
  root:['4/4','3/4','6/8'], root5:['4/4','3/4','6/8'], walk:['4/4','3/4','6/8'],
  boogie:['4/4'], bossa:['4/4'], funk:['4/4'],
};

// Backup channel (second rhythm instrument — banjo for now) patterns.
// {b, n, g}: n indexes the bar's roll pool [root, third, fifth, octave];
// chord:true plays pool notes 0-2 together as a short muted stab.
export const BACKUP_PATTERNS = {
  roll: { // three-finger forward/forward-reverse rolls
    '4/4':[ {b:0,n:0,g:0.9},{b:0.5,n:1,g:0.55},{b:1,n:2,g:0.65},{b:1.5,n:3,g:0.6},
            {b:2,n:0,g:0.8},{b:2.5,n:2,g:0.55},{b:3,n:1,g:0.65},{b:3.5,n:3,g:0.6} ],
    '3/4':[ {b:0,n:0,g:0.9},{b:0.5,n:1,g:0.55},{b:1,n:2,g:0.65},
            {b:1.5,n:3,g:0.6},{b:2,n:1,g:0.6},{b:2.5,n:2,g:0.55} ],
    '6/8':[ {b:0,n:0,g:0.9},{b:1/3,n:1,g:0.55},{b:2/3,n:2,g:0.6},
            {b:1,n:3,g:0.75},{b:4/3,n:2,g:0.55},{b:5/3,n:1,g:0.6} ],
  },
  chop: { // muted backbeat stabs (the mandolin-chop feel)
    '4/4':[ {b:1,chord:true,g:0.8},{b:3,chord:true,g:0.75} ],
    '3/4':[ {b:1,chord:true,g:0.8},{b:2,chord:true,g:0.7} ],
    '6/8':[ {b:1,chord:true,g:0.8} ],
  },
};
export const BACKUP_TOP = 71; // ganjo's highest sampled root — keep the octave inside it

// A style is a bundle of the knobs: meter, tempo, feel, strum pattern, rhythm
// section, sample sets. Styles group under genre tabs (Genre → Style picker).
export const GENRE_GROUPS = ['Country','Blues','Folk','Rock & Pop','Jazz & Latin','Groove'];
export const GENRES = [
  // Country
  { key:'oldtime',    group:'Country', label:'Old-Time',      tempo:100, feel:'straight', strum:'boomchick', drums:'train', bass:'root5',  lead:'off',   drumFills:false, keys:'off', mix:{guitar:1.1,drums:0.85} },
  { key:'bluegrass',  group:'Country', label:'Bluegrass',     tempo:145, feel:'straight', strum:'bluegrass', drums:'off',   bass:'walk',   lead:'fills', drumFills:false, keys:'off', backup:'roll', mix:{guitar:1.1,bass:1.15} },
  { key:'honkytonk',  group:'Country', label:'Honky-Tonk',    tempo:105, feel:'shuffle',  strum:'boomchick', drums:'kit',   bass:'root5',  bassFills:true, lead:'fills', drumFills:false, keys:'on',  guitarInst:'jazz', mix:{piano:1.15} },
  { key:'altcountry', group:'Country', label:'Alt Country',   tempo:95,  feel:'straight', strum:'folk',      drums:'kit',   bass:'root5',  lead:'off',   drumFills:true,  keys:'on' },
  { key:'countrywaltz',group:'Country',label:'Country Waltz', meter:'3/4', tempo:90, feel:'straight', strum:'boomchick', drums:'train', bass:'root5', bassFills:true, lead:'fills', drumFills:false, keys:'off', mix:{guitar:1.1,drums:0.8} },
  // Blues
  { key:'blues',      group:'Blues', label:'Blues',           tempo:84,  feel:'shuffle',  strum:'folk',      drums:'kit',   bass:'boogie', lead:'fills', drumFills:true,  keys:'off' },
  { key:'piedmont',   group:'Blues', label:'Piedmont',        tempo:110, feel:'shuffle',  strum:'travis',    drums:'off',   bass:'root',   lead:'off',   drumFills:false, keys:'off', mix:{guitar:1.2,bass:0.8} },
  { key:'slowblues',  group:'Blues', label:'Slow Blues',      meter:'6/8', tempo:60, feel:'straight', strum:'folk', drums:'kit', bass:'walk', lead:'fills', drumFills:true, keys:'on', mix:{drums:0.9,piano:0.95} },
  // Folk
  { key:'folk',       group:'Folk', label:'Folk',             tempo:96,  feel:'straight', strum:'travis',    drums:'off',   bass:'root5',  lead:'fills', drumFills:false, keys:'off', mix:{guitar:1.15} },
  { key:'folkwaltz',  group:'Folk', label:'Folk Waltz',       meter:'3/4', tempo:100, feel:'straight', strum:'travis', drums:'off', bass:'root5', lead:'off', drumFills:false, keys:'off', mix:{guitar:1.15} },
  // Rock & Pop
  { key:'pop',        group:'Rock & Pop', label:'Pop',        tempo:116, feel:'straight', strum:'pop',       drums:'kit',   bass:'root5',  lead:'off',   drumFills:true,  keys:'on',  bassInst:'electric', mix:{drums:1.1,bass:1.15,guitar:0.9} },
  { key:'indiepop',   group:'Rock & Pop', label:'Indie Pop',  tempo:128, feel:'straight', strum:'pop',       drums:'kit',   bass:'root',   lead:'off',   drumFills:false, keys:'off', bassInst:'electric' },
  { key:'rocknroll',  group:'Rock & Pop', label:'Rock & Roll',tempo:150, feel:'straight', strum:'pop',       drums:'kit',   bass:'boogie', lead:'fills', drumFills:true,  keys:'on',  bassInst:'electric', guitarInst:'jazz', mix:{piano:1.2,drums:1.15,bass:1.15} },
  { key:'rockabilly', group:'Rock & Pop', label:'Rockabilly', tempo:170, feel:'shuffle',  strum:'folk',      drums:'kit',   bass:'boogie', lead:'fills', drumFills:true,  keys:'off', guitarInst:'jazz', mix:{bass:1.25,drums:0.95} },
  // Jazz & Latin
  { key:'jazz',       group:'Jazz & Latin', label:'Jazz',     tempo:132, feel:'shuffle',  strum:'lofi',      drums:'swing', bass:'walk',   lead:'fills', drumFills:false, keys:'on',  guitarInst:'jazz', mix:{bass:1.2,drums:0.85} },
  { key:'bossa',      group:'Jazz & Latin', label:'Bossa Nova',tempo:120, feel:'straight', strum:'bossa',    drums:'bossa', bass:'bossa',  lead:'off',   drumFills:false, keys:'on',  guitarInst:'nylon', mix:{guitar:1.1,drums:0.8} },
  { key:'jazzwaltz',  group:'Jazz & Latin', label:'Jazz Waltz', meter:'3/4', tempo:140, feel:'shuffle', strum:'lofi', drums:'swing', bass:'walk', lead:'fills', drumFills:false, keys:'on', guitarInst:'jazz', mix:{bass:1.2,drums:0.85} },
  // Groove
  { key:'funk',       group:'Groove', label:'Funk',           tempo:102, feel:'straight', strum:'funk',      drums:'funk',  bass:'funk',   lead:'off',   drumFills:true,  keys:'off', bassInst:'electric', guitarInst:'muted', mix:{bass:1.25,drums:1.15} },
  { key:'lofi',       group:'Groove', label:'Lo-Fi',          tempo:72,  feel:'shuffle',  strum:'lofi',      drums:'kit',   bass:'root',   lead:'solo',  drumFills:false, keys:'fills', mix:{lead:0.85,drums:0.9} },
];

// Drum fills: three swung-eighth hits into every 4th bar, moving around the
// kit. [kind, gain] triples land on beats 2.5 / 3 / 3.5.
export const DRUM_FILLS = [
  [['snare',0.5],['snare',0.7],['snare',0.95]],
  [['snare',0.6],['hitom',0.75],['lotom',0.9]],
  [['hitom',0.6],['snare',0.75],['snare',0.9]],
  [['snare',0.7],['hitom',0.8],['lotom',0.95]],
  [['snare',0.65],['lotom',0.8],['snare',0.95]],
];

// "Auto" searches voicings across these sets and voice-leads between them the
// way a player crosses sets moving up the neck. 6-5-4 is left out of the
// default — triads that low read as mud under a band (but it stays selectable).
export const DEFAULT_SETS=['321','432','543'];

// Song sections: three fixed slots; the arrangement is a playable sequence of
// the non-empty ones. Playback flattens the arrangement into one bar list.
export const SECTION_IDS=['A','B','C'];
export const SECTION_LABELS={A:'Verse',B:'Chorus',C:'Bridge'};

/* ---- Suggested choruses/bridges (the Suggest button on empty sections) ----
   Degree-based like PROGRESSIONS. The forms are the tradition's common section
   moves; names cite public-domain classics that made them famous (chord
   progressions themselves aren't copyrightable — the names are the lesson). */
const COUNTRY_IDEAS={
  chorus:[
    { name:'Circle (Will the Circle Be Unbroken)', bars:[[0],[0],[3],[0],[0],[0],[4],[0]] },
    { name:'Lifted (starts on IV)', bars:[[3],[3],[0],[0],[3],[0],[4],[0]] },
    { name:'Willow (Bury Me Beneath the Willow)', bars:[[0],[3],[0],[4],[0],[3],[4],[0]] },
  ],
  bridge:[
    { name:'Middle Eight (IV opener)', bars:[[3],[3],[0],[0],[3],[3],[4],[4,'7']] },
    { name:'Rhythm Bridge (I Got Rhythm, 1930)', bars:[[2,'7'],[2,'7'],[5,'7'],[5,'7'],[1,'7'],[1,'7'],[4,'7'],[4,'7']] },
    { name:'Relative Minor (vi opener)', bars:[[5,'min'],[3],[0],[4],[5,'min'],[3],[4],[4,'7']] },
    { name:'V-of-V (II7 bridge)', bars:[[0],[0],[1,'7'],[1,'7'],[4],[4],[4,'7'],[4,'7']] },
  ],
};
const BLUES_IDEAS={
  chorus:[
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Eight-Bar (Highway form)', bars:[[0,'7'],[4,'7'],[3,'7'],[3,'7'],[0,'7'],[4,'7'],[0,'7'],[4,'7']] },
  ],
  bridge:[
    { name:'IV Vamp', bars:[[3,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[4,'7'],[4,'7']] },
    { name:'Minor Plagal (iv drop)', bars:[[3],[3,'min'],[0],[0],[3],[3,'min'],[4,'7'],[4,'7']] },
    { name:'Rhythm Bridge (I Got Rhythm, 1930)', bars:[[2,'7'],[2,'7'],[5,'7'],[5,'7'],[1,'7'],[1,'7'],[4,'7'],[4,'7']] },
  ],
};
export const SECTION_IDEAS={
  oldtime:COUNTRY_IDEAS, bluegrass:COUNTRY_IDEAS, honkytonk:COUNTRY_IDEAS, altcountry:COUNTRY_IDEAS, countrywaltz:COUNTRY_IDEAS,
  blues:BLUES_IDEAS, piedmont:BLUES_IDEAS, slowblues:BLUES_IDEAS,
};

export function chordOf(bar,key) {
  const root=(key+SCALE[bar.deg])%12;
  return { root, quality:bar.q, name:NOTES[root]+QS[bar.q].s, numeral:DEGS[bar.deg].n+(bar.q==='7'?'7':'') };
}

export const DEFAULT_GENRE=GENRES.find(g=>g.key==='oldtime');
// Initial song: the default genre's first progression, with its set overrides
// folded in — matches what clicking the style would produce.
export const DEFAULT_PROG=PROGRESSIONS[DEFAULT_GENRE.key][0];
export const DEFAULT_SET={...DEFAULT_GENRE,...DEFAULT_PROG.set};
