import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  NOTES, SCALE, DEGS, QS, QKEYS, STRING_SETS, isMinorFamily,
  getVoicings, closestVoicing, hasOpenString, firstPositionGrip,
  matchCAGEDZone, voicingKey,
} from './music.js';
import FretDiag, { GripDiag } from './FretDiag.jsx';
import { ensureCtx, ctxTime, preload, preloadDrums, setMix, scheduleStrum, scheduleBass, scheduleDrum, scheduleLead, schedulePiano, scheduleBackup, stopAll, cancelPending, voicingMidis, STRING_MIDI, AUDIO_DEFAULTS, setAudioSettings, setGuitarSet as applyGuitarSet, setBassSet as applyBassSet, setPianoSet as applyPianoSet } from './audio.js';

// Iconic progressions per genre ([degree, quality]; quality defaults to maj).
// Some appear under several genres — that's how music works.
// A progression may carry a `set` object pinning any of the band knobs
// (tempo, feel, strum, drums, bass, lead); knobs it omits are left alone.
const PROGRESSIONS = {
  blues: [
    { name:'12-Bar Blues', bars:[[0],[0],[0],[0],[3],[3],[0],[0],[4,'7'],[3],[0],[4,'7']] },
    { name:'12-Bar Shuffle (7ths)', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'8-Bar Blues (Highway)', bars:[[0,'7'],[4,'7'],[3,'7'],[3,'7'],[0,'7'],[4,'7'],[0,'7'],[4,'7']] },
    { name:'Minor Blues', bars:[[0,'min7'],[0,'min7'],[0,'min7'],[0,'min7'],[3,'min7'],[3,'min7'],[0,'min7'],[0,'min7'],[4,'7'],[3,'min7'],[0,'min7'],[4,'7']] },
  ],
  oldtime: [
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
const toBars = barDefs => barDefs.map(([deg,q='maj'])=>({deg,q}));
const barsKey = bs => bs.map(b=>`${b.deg}:${b.q}`).join(',');

// How many progression buttons show inline per genre; the rest go behind "More".
const FEATURED = 4;

const numeralOf = b => {
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
const progSummary = barDefs => {
  const ns = toBars(barDefs).map(numeralOf);
  return ns.filter((n,i)=>i===0||n!==ns[i-1]).join('–');
};

// Meters. Pattern `b` values are quarter-note beats in simple meters; in 6/8
// they're dotted-quarter pulse units (tempo = pulse bpm) with eighths on
// thirds. `grid` is the bar's subdivision — lead lines and fill placement
// derive from it. swing:false meters are already compound, so the Shuffle
// feel is forced straight there.
const METERS = {
  '4/4': { label:'4/4', beats:4, grid:[0,0.5,1,1.5,2,2.5,3,3.5], swing:true  },
  '3/4': { label:'3/4', beats:3, grid:[0,0.5,1,1.5,2,2.5],       swing:true  },
  '6/8': { label:'6/8', beats:2, grid:[0,1/3,2/3,1,4/3,5/3],     swing:false },
};
const METER_KEYS = Object.keys(METERS);

// Strum patterns, keyed by meter (span: full/top/bass). A strum supports only
// the meters it defines; the UI hides it elsewhere and falls back to Folk.
const STRUMS = {
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

// Drum patterns per mode and meter ({b,kind,g}; sw: swings with the feel).
// 4/4 entries are the original inline patterns, transcribed exactly.
const DRUM_PATTERNS = {
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
const BASS_METERS = {
  root:['4/4','3/4','6/8'], root5:['4/4','3/4','6/8'], walk:['4/4','3/4','6/8'],
  boogie:['4/4'], bossa:['4/4'], funk:['4/4'],
};

// Backup channel (second rhythm instrument — banjo for now) patterns.
// {b, n, g}: n indexes the bar's roll pool [root, third, fifth, octave];
// chord:true plays pool notes 0-2 together as a short muted stab.
const BACKUP_PATTERNS = {
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
const BACKUP_TOP = 71; // ganjo's highest sampled root — keep the octave inside it

// A style is a bundle of the knobs: meter, tempo, feel, strum pattern, rhythm
// section, sample sets. Styles group under genre tabs (Genre → Style picker).
const GENRE_GROUPS = ['Country','Blues','Folk','Rock & Pop','Jazz & Latin','Groove'];
const GENRES = [
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
const DRUM_FILLS = [
  [['snare',0.5],['snare',0.7],['snare',0.95]],
  [['snare',0.6],['hitom',0.75],['lotom',0.9]],
  [['hitom',0.6],['snare',0.75],['snare',0.9]],
  [['snare',0.7],['hitom',0.8],['lotom',0.95]],
  [['snare',0.65],['lotom',0.8],['snare',0.95]],
];

// Pentatonic notes on this string set within the triad voicing's fret window —
// i.e., the lick vocabulary of that CAGED position (what the Overlay shows).
function leadPool(ch, voicing, strs) {
  const ivs = isMinorFamily(ch.quality) ? [0,3,5,7,10] : [0,2,4,7,9];
  const pcs = new Set(ivs.map(iv=>(ch.root+iv)%12));
  const nz = voicing.frets.filter(f=>f>0);
  const lo = Math.max(0,(nz.length?Math.min(...nz):0)-2);
  const hi = Math.max(...voicing.frets)+3;
  const pool = [];
  for (const s of strs) for (let f=lo;f<=hi;f++) {
    const m = STRING_MIDI[s]+f;
    if (m<=78 && pcs.has(m%12)) pool.push(m); // 78 = top of the sample range
  }
  return [...new Set(pool)].sort((a,b)=>a-b);
}

/* ---- Auto string-set path engine ---- */
// "Auto" searches voicings across these sets and voice-leads between them the
// way a player crosses sets moving up the neck. 6-5-4 is left out — triads
// that low read as mud under a band.
const AUTO_KEY='auto';
const AUTO_SETS=STRING_SETS.filter(s=>s.key!=='654');
const centerOf=v=>{const nz=v.frets.filter(f=>f>0);return nz.length?(Math.min(...nz)+Math.max(...v.frets))/2:0;};
const pitchesOf=v=>v.set.strs.map((s,i)=>STRING_MIDI[s]+v.frets[i]);
// Position-playing cost: staying in the pass's fret window dominates (the hand
// doesn't drift), with pitch continuity as a soft tiebreaker and only a nudge
// against changing sets — crossing sets inside the window is the point.
const posCost=(v,prev,win)=>{
  let c=(win!=null?Math.abs(centerOf(v)-win)*3:0)+(hasOpenString(v.frets)?3:0);
  const pa=[...pitchesOf(v)].sort((x,y)=>x-y),pb=[...pitchesOf(prev)].sort((x,y)=>x-y);
  let d=0; for (let i=0;i<pa.length;i++) d+=Math.abs(pa[i]-pb[i]);
  return c+d*0.4+(v.set.key!==prev.set.key?0.5:0);
};
const pinKeyOf=v=>v?`${v.set.key}:${voicingKey(v)}`:'';

// Roll an articulation for a lead note: legato (hammer-on/pull-off) on close
// offbeat steps, bends into strong beats, occasional double stop a third/fourth
// below. Returns null for a plain picked note.
function leadArt(pool, idx, prevMidi, b, fillEnd) {
  const m = pool[idx];
  const art = {};
  const interval = prevMidi != null ? Math.abs(m - prevMidi) : 0;
  if (interval > 0 && interval <= 3 && b % 1 !== 0 && Math.random() < 0.35) {
    art.offset = 0.05;
  } else if ((b % 1 === 0 || fillEnd) && Math.random() < (fillEnd ? 0.5 : 0.22)) {
    art.bendFrom = -(Math.random() < 0.5 ? 1 : 2);
    art.bendDur = 0.12 + Math.random() * 0.06;
  }
  if ((b % 1 === 0 || fillEnd) && idx >= 2 && Math.random() < (fillEnd ? 0.3 : 0.15)) {
    const d = pool[idx - 2];
    if (m - d >= 3 && m - d <= 7) art.double = d;
  }
  return Object.keys(art).length ? art : null;
}

// Song sections: three fixed slots; the arrangement is a playable sequence of
// the non-empty ones. Playback flattens the arrangement into one bar list.
const SECTION_IDS=['A','B','C'];
const SECTION_LABELS={A:'Verse',B:'Chorus',C:'Bridge'};

const STORE_KEY = 'mrtriad.savedProgressions';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY))||[]; } catch { return []; } };

const MIXER_KEY = 'mrtriad.mixer';
// Merge stored values over the defaults so new channels don't break old saves.
const loadMixer = () => {
  const def = JSON.parse(JSON.stringify(AUDIO_DEFAULTS));
  try {
    const s = JSON.parse(localStorage.getItem(MIXER_KEY));
    if (s) for (const k of Object.keys(def)) {
      if (k === 'master') { if (s.master != null) def.master = s.master; }
      else if (s[k]) def[k] = { ...def[k], ...s[k] };
    }
  } catch { /* keep defaults */ }
  return def;
};

const MixSlider = ({label,min,max,step,value,onChange}) => (
  <label className="flex items-center gap-1.5 text-xs text-gray-400">
    <span className="w-12 text-right">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} className="w-24 accent-amber-500"/>
    <span className="w-9 tabular-nums text-gray-500">{value}</span>
  </label>
);

function chordOf(bar,key) {
  const root=(key+SCALE[bar.deg])%12;
  return { root, quality:bar.q, name:NOTES[root]+QS[bar.q].s, numeral:DEGS[bar.deg].n+(bar.q==='7'?'7':'') };
}

const DEFAULT_GENRE=GENRES.find(g=>g.key==='blues');

export default function Player() {
  const [key,setKey]=useState(9); // A
  const [sections,setSections]=useState(()=>({A:toBars(PROGRESSIONS.blues[0].bars),B:[],C:[]}));
  const [arrangement,setArrangement]=useState(['A']);
  const [activeSec,setActiveSec]=useState('A');
  const bars=sections[activeSec]; // the section being edited/displayed
  const setSectionBars=(sec,upd)=>setSections(s=>({...s,[sec]:typeof upd==='function'?upd(s[sec]):upd}));
  const setBars=upd=>setSectionBars(activeSec,upd);
  const [tempo,setTempo]=useState(DEFAULT_GENRE.tempo);
  const [meter,setMeter]=useState(DEFAULT_GENRE.meter||'4/4');
  const [view,setView]=useState('cowboy');
  const [setKeySel,setSetKeySel]=useState(AUTO_KEY);
  const [loop,setLoop]=useState(true);
  const [feel,setFeel]=useState(DEFAULT_GENRE.feel);
  const [sound,setSound]=useState('cowboy'); // guitar channel: cowboy | triads | off
  const [strum,setStrum]=useState(DEFAULT_GENRE.strum);
  const [drums,setDrums]=useState(DEFAULT_GENRE.drums);   // off | stomp | kit | train
  const [drumFills,setDrumFills]=useState(DEFAULT_GENRE.drumFills);
  const [bassMode,setBassMode]=useState(DEFAULT_GENRE.bass); // off | root | root5 | walk | boogie
  const [bassFills,setBassFills]=useState(!!DEFAULT_GENRE.bassFills); // walkups into chord changes (root/root5 only)
  const [backup,setBackup]=useState(DEFAULT_GENRE.backup||'off'); // off | roll | chop — second rhythm instrument
  const [lead,setLead]=useState(DEFAULT_GENRE.lead);     // off | fills | solo
  const [leadEvery,setLeadEvery]=useState(DEFAULT_GENRE.leadEvery||4); // fills cadence: a run every N bars
  const [keys,setKeys]=useState(DEFAULT_GENRE.keys);     // off | on — upright piano comping
  const [genre,setGenre]=useState(DEFAULT_GENRE.key);
  const [genreTab,setGenreTab]=useState(DEFAULT_GENRE.group); // browsed group tab
  const [playing,setPlaying]=useState(false);
  const [currentBar,setCurrentBar]=useState(null);
  const [editIdx,setEditIdx]=useState(null);
  const [saved,setSaved]=useState(loadSaved);
  const [saveName,setSaveName]=useState('');
  const [moreOpen,setMoreOpen]=useState(false);
  const [mixer,setMixer]=useState(loadMixer);
  const [showMixer,setShowMixer]=useState(false);
  const [guitarSet,setGuitarSet]=useState(()=>localStorage.getItem('mrtriad.guitarSet')||'fatboy');
  const [bassSet,setBassSet]=useState(()=>localStorage.getItem('mrtriad.bassSet')||'upright');
  const [pianoSet,setPianoSet]=useState(()=>localStorage.getItem('mrtriad.pianoSet')||'vcsl');
  const playRef=useRef(null);
  const loopRef=useRef(loop);
  loopRef.current=loop;

  // The flattened song: arrangement instances first (the played prefix, length
  // playLen), then display-only instances of non-empty sections that aren't in
  // the arrangement, so every tab can still render its diagrams.
  const flat=useMemo(()=>{
    const fbars=[],map=[];
    const arr=arrangement.filter(id=>sections[id].length);
    arr.forEach((id,inst)=>sections[id].forEach((b,j)=>{fbars.push(b);map.push({sec:id,j,inst});}));
    const playLen=fbars.length;
    for (const id of SECTION_IDS) if (sections[id].length&&!arr.includes(id))
      sections[id].forEach((b,j)=>{fbars.push(b);map.push({sec:id,j,inst:-1});});
    return {bars:fbars,map,playLen};
  },[arrangement,sections]);

  // Chords/grips/paths all operate on the flattened song, so voice-leading
  // flows across section boundaries and repeats. The grid slices from the
  // active section's first instance.
  const chords=useMemo(()=>flat.bars.map(b=>chordOf(b,key)),[flat,key]);
  const dispStart=useMemo(()=>flat.map.findIndex(m=>m.sec===activeSec),[flat,activeSec]);

  // Cowboy view: first-position grip per bar (null for dim/aug).
  const grips=useMemo(()=>chords.map(ch=>firstPositionGrip(ch.root,ch.quality)),[chords]);

  // Triads view: voice-led path on the selected string set; repeated chords keep
  // their voicing. posIdx picks which of bar 1's voicings anchors the path (the
  // neck position); pins force a specific voicing on a bar, and later bars
  // re-lead from it.
  const [posIdx,setPosIdx]=useState(0);
  const [posMode,setPosMode]=useState('climb'); // climb: each loop pass moves to the next position
  const [posSel,setPosSel]=useState([]); // climb subset (position indices); empty = all
  const [livePass,setLivePass]=useState(0);
  const [pins,setPins]=useState({});
  const auto=setKeySel===AUTO_KEY;

  // Every voicing for a chord in the current search space, tagged with its set.
  const candidatesFor=useCallback(ch=>{
    const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
    const sets=auto?AUTO_SETS:[STRING_SETS.find(s=>s.key===setKeySel)];
    const out=[];
    for (const set of sets) for (const v of getVoicings(nts,ch.root,set.strs)) out.push({...v,set});
    return out.sort((a,b)=>centerOf(a)-centerOf(b));
  },[auto,setKeySel]);

  // Selectable anchor positions for bar 1, low to high. In Auto, voicings from
  // different sets that share a fret window collapse into one position.
  const anchorsFrom=useCallback(cands=>{
    const closed=cands.filter(v=>!hasOpenString(v.frets));
    const list=closed.length?closed:cands;
    if (!auto) return list;
    const out=[];
    for (const v of list) if (!out.length||centerOf(v)-centerOf(out[out.length-1])>=2) out.push(v);
    return out;
  },[auto]);

  const positions=useMemo(()=>chords.length?anchorsFrom(candidatesFor(chords[0])):[],[chords,candidatesFor,anchorsFrom]);
  const pi=Math.min(posIdx,Math.max(0,positions.length-1));

  const pathForAnchor=useCallback(anchor=>{
    const path=[];
    let win=null; // the pass's fret window (auto mode); a pin moves it — that's a transition point
    for (let i=0;i<chords.length;i++) {
      const ch=chords[i];
      const cands=candidatesFor(ch);
      if (!cands.length) { path.push(null); continue; }
      const m=flat.map[i];
      const pin=m?pins[`${m.sec}:${m.j}`]:null;
      const pinned=pin!=null?cands.find(v=>pinKeyOf(v)===pin):null;
      if (pinned) { path.push(pinned); win=centerOf(pinned); continue; }
      if (i>0&&chords[i-1].root===ch.root&&chords[i-1].quality===ch.quality&&path[i-1]) { path.push(path[i-1]); continue; }
      if (i===0) {
        const list=anchorsFrom(cands);
        const v=list[Math.min(anchor,list.length-1)];
        path.push(v); win=centerOf(v);
        continue;
      }
      const prev=path[i-1];
      if (!prev) { path.push(cands.find(v=>!hasOpenString(v.frets))||cands[0]); continue; }
      if (auto) {
        let best=null,bs=Infinity;
        for (const v of cands){const c=posCost(v,prev,win);if(c<bs){bs=c;best=v;}}
        path.push(best);
      } else {
        path.push(closestVoicing(cands,prev.frets));
      }
    }
    return path;
  },[chords,flat,candidatesFor,anchorsFrom,pins,auto]);

  // Climb order: up through the selected positions, then back down (ping-pong).
  const passOrder=useMemo(()=>{
    const P=positions.length;
    if (posMode!=='climb'||P<2) return [pi];
    const sel=posSel.filter(i=>i<P).sort((a,b)=>a-b);
    const L=sel.length?sel:[...Array(P).keys()];
    if (L.length===1) return L;
    return [...L,...L.slice(1,-1).reverse()];
  },[posMode,positions.length,pi,posSel]);

  // What the grid shows: the playing pass's position while climbing, else the manual pick.
  const displayAnchor=posMode==='climb'&&playing?passOrder[Math.min(livePass,passOrder.length-1)]:pi;
  const triadPath=useMemo(()=>pathForAnchor(displayAnchor),[pathForAnchor,displayAnchor]);

  // Where the climb goes next — feeds the "next loop" card at the end of the
  // grid (visible throughout the pass, pulsing during its final bar).
  const upNext=useMemo(()=>{
    if (!playing||posMode!=='climb'||passOrder.length<2||!flat.playLen) return null;
    const lp=Math.min(livePass,passOrder.length-1);
    if (!loop&&lp===passOrder.length-1) return null; // journey ends here
    const na=passOrder[(lp+1)%passOrder.length];
    return {anchor:na,path:pathForAnchor(na)};
  },[playing,posMode,passOrder,flat.playLen,livePass,loop,pathForAnchor]);
  const climbPulse=!!upNext&&flat.playLen>1&&currentBar===flat.playLen-1;

  const fretWindow=v=>{
    if (!v) return '';
    const nz=v.frets.filter(f=>f>0);
    const lo=nz.length?Math.min(...nz):0, hi=Math.max(...v.frets);
    return lo===hi?`fret ${lo}`:`frets ${lo}–${hi}`;
  };
  const posLabel=useMemo(()=>{
    const v=triadPath[0]; if (!v||!chords.length) return '';
    const z=matchCAGEDZone(chords[0].root,chords[0].quality,v.frets);
    return `${auto?v.set.label+' · ':''}${fretWindow(v)}${z?` · ${z.name}-shape`:''}`;
  },[triadPath,chords,auto]);

  const stop=useCallback(()=>{
    if (playRef.current) { clearInterval(playRef.current.timer); playRef.current=null; }
    stopAll();
    setPlaying(false);
    setCurrentBar(null);
    setLivePass(0);
  },[]);

  useEffect(()=>stop,[stop]); // unmount
  useEffect(()=>{ setAudioSettings(mixer); },[mixer]); // live — audio params only, no schedule rebuild
  // Must run before the schedule-rebuild effect below so its preload hits the new folder.
  useEffect(()=>{ applyGuitarSet(guitarSet); localStorage.setItem('mrtriad.guitarSet',guitarSet); },[guitarSet]);
  useEffect(()=>{ applyBassSet(bassSet); localStorage.setItem('mrtriad.bassSet',bassSet); },[bassSet]);
  useEffect(()=>{ applyPianoSet(pianoSet); localStorage.setItem('mrtriad.pianoSet',pianoSet); },[pianoSet]);

  const updMixer=(ch,param,val)=>setMixer(m=>{
    const next=ch==='master'?{...m,master:val}:{...m,[ch]:{...m[ch],[param]:val}};
    localStorage.setItem(MIXER_KEY,JSON.stringify(next));
    return next;
  });
  const resetMixer=()=>{ localStorage.removeItem(MIXER_KEY); setMixer(JSON.parse(JSON.stringify(AUDIO_DEFAULTS))); };

  // Manual meter switch: pull knobs that don't exist in the new meter back to
  // ones that do, in the same update, so buildSchedule never sees a bad combo.
  const applyMeter=m=>{
    setMeter(m);
    if (!METERS[m].swing&&feel==='shuffle') setFeel('straight');
    if (!STRUMS[strum].p[m]) setStrum('folk');
    if (drums!=='off'&&!DRUM_PATTERNS[drums]?.[m]) setDrums('kit');
    if (bassMode!=='off'&&!BASS_METERS[bassMode]?.includes(m)) setBassMode('root5');
  };

  const applyGenre=g=>{
    setGenre(g.key); setGenreTab(g.group); setMeter(g.meter||'4/4'); setTempo(g.tempo); setFeel(g.feel); setStrum(g.strum);
    setBassFills(!!g.bassFills); setLeadEvery(g.leadEvery||4); setBackup(g.backup||'off');
    setDrums(g.drums); setBassMode(g.bass); setLead(g.lead); setDrumFills(g.drumFills); setKeys(g.keys);
    setBassSet(g.bassInst||'upright');
    setGuitarSet(g.guitarInst||'fatboy');
    setPianoSet(g.pianoInst||'vcsl');
    // A genre starts a fresh single-section song.
    const first=PROGRESSIONS[g.key][0];
    setSections({A:toBars(first.bars),B:[],C:[]});
    setArrangement(['A']); setActiveSec('A');
    setEditIdx(null); setMoreOpen(false); setPins({}); setPosIdx(0); setPosSel([]);
    applySetOverrides(first,g);
  };

  // Switching genre tabs resets to that genre's first style (and its first
  // progression) rather than just browsing — re-clicking the current tab is a no-op.
  const applyGenreTab=gr=>{
    if (gr===genreTab) return;
    applyGenre(GENRES.find(g=>g.group===gr));
  };

  // The full loop as a flat event list — a pure function of the current settings.
  // Playback walks whatever schedule sits in playRef; rebuilding and swapping it
  // mid-play (effect below start) is how settings change without stopping.
  const buildSchedule=useCallback(()=>{
    const M=METERS[meter]||METERS['4/4'];
    const spb=60/tempo, barDur=M.beats*spb;
    const passBars=flat.playLen; // one pass = the whole arrangement, flattened
    const loopDur=passOrder.length*passBars*barDur;
    // Shuffle: offbeat eighths land on the triplet 2/3 instead of halfway.
    // Compound meters (6/8) are already triplet-based, so shuffle is a no-op.
    const sw=(feel==='shuffle'&&M.swing)?(b=>Math.floor(b)+(b%1?2/3:0)):(b=>b);
    // Guards: a stale knob/meter combo mid-rebuild falls back instead of crashing.
    const strumPat=STRUMS[strum].p[meter]||STRUMS.folk.p[meter];
    const drumPat=drums==='off'?null:(DRUM_PATTERNS[drums]?.[meter]||DRUM_PATTERNS.kit[meter]);
    const bassEff=bassMode==='off'?'off':(BASS_METERS[bassMode]?.includes(meter)?bassMode:'root5');
    const fill3=M.grid.slice(-3), fill4=M.grid.slice(-4), lastSlot=M.grid[M.grid.length-1];
    const events=[];
    const bassMidis=[],leadMidis=[],pianoMidis=[],backupMidis=[];
    const guitarMidis=[]; // flattened: pass*passBars + bar
    let leadLast=null; // walker carries across bars so lines connect through chord changes
    // One pass through the bars per position in passOrder; climbing plays the
    // progression at each position in turn, transitions on the loop boundary.
    passOrder.forEach((anchor,pass)=>{
    const path=pathForAnchor(anchor);
    for (let i=0;i<passBars;i++) {
      const gi=pass*passBars+i;
      const base=gi*barDur;
      let midis=[];
      if (sound!=='off') {
        if (sound==='cowboy'&&grips[i]) midis=[6,5,4,3,2,1].filter(s=>grips[i].frets[s]).map(s=>STRING_MIDI[s]+grips[i].frets[s].fret);
        else if (path[i]) midis=voicingMidis(path[i].set.strs,path[i].frets);
      }
      guitarMidis.push(midis);
      strumPat.forEach(p=>events.push({t:base+sw(p.b)*spb,type:'strum',i:gi,dir:p.dir,g:p.g,span:p.span}));
      if (drumPat) drumPat.forEach(d=>events.push({t:base+(d.sw?sw(d.b):d.b)*spb,type:'drum',kind:d.kind,g:d.g}));
      if (drumFills&&!['off','stomp'].includes(drums)&&passBars>=4&&(i+1)%4===0) {
        const fill=DRUM_FILLS[Math.floor(Math.random()*DRUM_FILLS.length)];
        const soft=drums==='train'?0.8:1; // brushes-era kit plays fills gentler
        fill3.forEach((b,k)=>events.push({t:base+sw(b)*spb,type:'drum',kind:fill[k][0],g:fill[k][1]*soft}));
      }
      if (bassEff!=='off') {
        const ch=chords[i];
        const rootM=28+((ch.root-4+12)%12);          // E1..D#2
        const minish=isMinorFamily(ch.quality);
        const third=minish?3:4, fifth=ch.quality==='dim'?6:7, sixth=minish?10:9;
        const fifthM=rootM-(12-fifth)>=28?rootM-(12-fifth):rootM+fifth;
        const next=chords[(i+1)%passBars];
        const nextRootM=28+((next.root-4+12)%12);
        const sameNext=next.root===ch.root&&next.quality===ch.quality;
        const approach=sameNext?rootM+sixth:(nextRootM-1>=28?nextRootM-1:nextRootM+1);
        const pushBass=(b,m,g,swung=false)=>{ events.push({t:base+(swung?sw(b):b)*spb,type:'bass',m,g}); bassMidis.push(m); };
        // Bass fills: a three-note chromatic walkup (or -down) into the next
        // bar's root whenever the chord changes — the country/bluegrass move
        // that makes Root/Root–5th feel alive without full-time Walking.
        const bassFillHere=bassFills&&!sameNext&&(bassEff==='root'||bassEff==='root5');
        if (bassEff==='root') {
          pushBass(0,rootM,1);
          if (meter==='6/8'&&!bassFillHere) pushBass(1,rootM,0.75); // both pulses
        } else if (bassEff==='root5') {
          pushBass(0,rootM,1);
          // Skip the fifth when the fill run would land on top of it (3/4 & 6/8).
          const fifthB=meter==='6/8'?1:2;
          if (!(bassFillHere&&fifthB>=fill3[0])) pushBass(fifthB,fifthM,0.85);
        } else if (bassEff==='walk') {
          if (meter==='3/4') { pushBass(0,rootM,1); pushBass(1,rootM+third,0.85); pushBass(2,approach,0.85); }
          else if (meter==='6/8') { pushBass(0,rootM,1); pushBass(1,fifthM,0.85); if (!sameNext) pushBass(5/3,approach,0.6); }
          else { pushBass(0,rootM,1); pushBass(1,rootM+third,0.85); pushBass(2,rootM+fifth,0.9); pushBass(3,approach,0.85); }
        } else if (bassEff==='boogie') {
          const line=[0,0,third,third,fifth,fifth,sixth,sixth];
          [0,0.5,1,1.5,2,2.5,3,3.5].forEach((b,k)=>pushBass(b,rootM+line[k],b%1?0.7:0.95,true));
        } else if (bassEff==='bossa') {
          pushBass(0,rootM,1); pushBass(1.5,fifthM,0.7); pushBass(2,rootM,0.9); pushBass(3.5,fifthM,0.7);
        } else if (bassEff==='funk') {
          pushBass(0,rootM,1); pushBass(1.75,rootM+12,0.7); pushBass(2.5,rootM,0.9); pushBass(3.25,rootM+fifth,0.65);
        }
        if (bassFillHere) {
          // Approach from below when the target sits above (and there's room),
          // else from above — either way three even steps landing on the root.
          const side=(nextRootM>=rootM&&nextRootM-3>=28)?-1:1;
          const run=[3,2,1].map(k=>nextRootM+side*k);
          fill3.forEach((b,k)=>pushBass(b,run[k],0.8,true));
        }
      }
      if (keys!=='off') {
        const pc=chords[i].root;
        const rootM=pc<6?60+pc:48+pc; // root position around middle C
        const pv=QS[chords[i].quality].iv.map(iv=>rootM+iv);
        const hits=meter==='3/4'?[[0,0.6],[1,0.45],[2,0.45]]           // oom-pah-pah
          :meter==='6/8'?[[0,0.6],[1,0.5]]                              // both pulses
          :feel==='shuffle'?[[0,0.6],[2.5,0.45]]:[[0,0.6],[2,0.5]];
        hits.forEach(([b,g])=>events.push({t:base+sw(b)*spb,type:'piano',m:pv,g}));
        pianoMidis.push(...pv);
        if (keys==='fills'&&passBars>=4&&(i+1)%4===0) {
          // chord-tone run an octave up, ringing over the comp into the next bar
          const pool=pv.map(m=>m<66?m+12:m).sort((a,b)=>a-b);
          const dir=Math.random()<0.5?1:-1;
          let idx=dir===1?0:pool.length-1;
          fill3.forEach(b=>{
            const m=pool[Math.max(0,Math.min(pool.length-1,idx))];
            events.push({t:base+sw(b)*spb,type:'pianoNote',m,g:0.5});
            pianoMidis.push(m);
            idx+=dir;
          });
        }
      }
      if (backup!=='off') {
        const ch=chords[i];
        const minish=isMinorFamily(ch.quality);
        const third=minish?3:4, fifth=ch.quality==='dim'?6:7;
        const rootM=50+((ch.root-2+12)%12); // banjo register D3..C#4
        const pool=[rootM,rootM+third,rootM+fifth,rootM+12<=BACKUP_TOP?rootM+12:rootM+fifth];
        for (const p of (BACKUP_PATTERNS[backup][meter]||[])) {
          const t=base+sw(p.b)*spb;
          if (p.chord) {
            [0,1,2].forEach(n=>{ events.push({t,type:'backup',m:pool[n],g:p.g*(n===0?1:0.8),chop:true}); backupMidis.push(pool[n]); });
          } else {
            events.push({t,type:'backup',m:pool[p.n],g:p.g}); backupMidis.push(pool[p.n]);
          }
        }
      }
      if (lead!=='off'&&path[i]) {
        const pool=leadPool(chords[i],path[i],path[i].set.strs);
        if (pool.length>2) {
          const nearest=m=>pool.reduce((b,x,j)=>Math.abs(x-m)<Math.abs(pool[b]-m)?j:b,0);
          if (lead==='solo') {
            for (const b of M.grid) {
              if (Math.random()<(b===0?0.55:0.3)) continue; // rests keep it from droning
              let idx;
              if (leadLast===null) idx=Math.floor(pool.length*0.6);
              else {
                idx=nearest(leadLast);
                const r=Math.random();
                idx+=r<0.38?-1:r<0.76?1:r<0.88?-2:2;
                idx=Math.max(0,Math.min(pool.length-1,idx));
              }
              const prevM=leadLast;
              leadLast=pool[idx];
              leadMidis.push(leadLast);
              const art=leadArt(pool,idx,prevM,b,false);
              if (art?.double!=null) leadMidis.push(art.double);
              events.push({t:base+sw(b)*spb+(Math.random()-0.5)*0.014,type:'lead',m:leadLast,g:b%1?0.5:0.62,art});
            }
          } else if ((i+1)%leadEvery===0) { // fills: a directed run every leadEvery bars
            const dir=Math.random()<0.5?1:-1;
            let idx=leadLast!==null?nearest(leadLast):Math.floor(pool.length*(dir===1?0.3:0.7));
            for (const b of fill4) {
              idx=Math.max(0,Math.min(pool.length-1,idx+dir));
              const prevM=leadLast;
              leadLast=pool[idx];
              leadMidis.push(leadLast);
              const art=leadArt(pool,idx,prevM,b,b===lastSlot);
              if (art?.double!=null) leadMidis.push(art.double);
              events.push({t:base+sw(b)*spb+(Math.random()-0.5)*0.014,type:'lead',m:leadLast,g:b%1?0.52:0.62,art});
            }
          }
        }
      }
    }
    });
    events.sort((a,b)=>a.t-b.t);
    return {events,loopDur,barDur,spb,guitarMidis,bassMidis,leadMidis,pianoMidis,backupMidis,passBars};
  // guitarSet is a dep so switching sample sets re-preloads and hot-swaps mid-play.
  },[flat,chords,meter,tempo,feel,strum,drums,drumFills,bassMode,bassFills,backup,lead,leadEvery,keys,passOrder,pathForAnchor,grips,sound,guitarSet,bassSet,pianoSet]);

  const tick=useCallback(()=>{
    const st=playRef.current;
    if (!st||!st.events.length) return;
    const now=ctxTime();
    while (true) {
      const loopN=Math.floor(st.nextIdx/st.events.length);
      if (!loopRef.current&&loopN>=1) break;
      const ev=st.events[st.nextIdx%st.events.length];
      const t=st.t0+loopN*st.loopDur+ev.t;
      // 450ms horizon: enough that a slow per-bar re-render of the diagram
      // grid can't stall past it (late events start immediately and smear).
      if (t>now+0.45) break;
      if (ev.type==='strum') { if (st.guitarMidis[ev.i].length) scheduleStrum(st.guitarMidis[ev.i],t,{dir:ev.dir,gain:ev.g,span:ev.span}); }
      else if (ev.type==='drum') scheduleDrum(ev.kind,t,ev.g);
      else if (ev.type==='bass') scheduleBass(ev.m,t,ev.g);
      else if (ev.type==='lead') scheduleLead(ev.m,t,ev.g,ev.art);
      else if (ev.type==='piano') schedulePiano(ev.m,t,ev.g);
      else if (ev.type==='backup') scheduleBackup(ev.m,t,ev.g,{chop:ev.chop});
      else if (ev.type==='pianoNote') schedulePiano([ev.m],t,ev.g,{damp:false});
      st.nextIdx++;
    }
    const pos=now-st.t0;
    if (pos>=0) {
      if (!loopRef.current&&pos>=st.loopDur) { stop(); return; }
      const gBar=Math.floor((pos%st.loopDur)/st.barDur);
      setCurrentBar(gBar%st.passBars);
      setLivePass(Math.floor(gBar/st.passBars));
    }
  },[stop]);

  const start=()=>{
    if (playing) { stop(); return; }
    ensureCtx();
    const sc=buildSchedule();
    if (!sc.passBars) return; // empty song (all sections empty or arrangement empty)
    Promise.all([preload([...sc.guitarMidis.flat(),...sc.leadMidis]),preload(sc.bassMidis,'bass'),preload(sc.pianoMidis,'piano'),preload(sc.backupMidis,'backup'),preloadDrums()]).then(()=>{
      const st={...sc,t0:ctxTime()+0.12,nextIdx:0};
      st.timer=setInterval(tick,50);
      playRef.current=st;
      setPlaying(true);
    });
  };

  // Live updates: a setting change mid-play rebuilds the schedule and re-anchors
  // it at the current musical position (same beat) instead of stopping. Position
  // maps by beats, not seconds, so tempo changes stay in place.
  const rebuildSeq=useRef(0);
  useEffect(()=>{
    if (!playRef.current) return;
    const sc=buildSchedule();
    const seq=++rebuildSeq.current;
    Promise.all([preload([...sc.guitarMidis.flat(),...sc.leadMidis]),preload(sc.bassMidis,'bass'),preload(sc.pianoMidis,'piano'),preload(sc.backupMidis,'backup'),preloadDrums()]).then(()=>{
      const st=playRef.current;
      if (!st||seq!==rebuildSeq.current) return; // stopped, or a newer rebuild superseded this one
      const now=ctxTime();
      let beats=Math.max(0,(now-st.t0)/st.spb);
      const loopBeats=sc.loopDur/sc.spb;
      if (loopRef.current) beats%=loopBeats;
      else if (beats>=loopBeats) { stop(); return; }
      // Kill only the not-yet-started tail from the stale settings (silent, so
      // click-free) and let sounding notes ring — the new schedule's next hit
      // on each slot damps them via the normal re-strike path. No gap, no cut.
      cancelPending();
      const tIn=beats*sc.spb;
      let idx=sc.events.findIndex(e=>e.t>=tIn-1e-6);
      if (idx<0) idx=sc.events.length;
      Object.assign(st,sc,{t0:now-tIn,nextIdx:idx});
    });
  },[buildSchedule,stop]);

  // g: the style bundle to fall back to for mix (freshly clicked styles pass it
  // since the `genre` state hasn't committed yet).
  const applySetOverrides=(p,g)=>{
    const s=p.set||{};
    if (s.meter&&METERS[s.meter]) setMeter(s.meter);
    if (s.tempo!=null) setTempo(s.tempo);
    if (s.feel) setFeel(s.feel);
    if (s.strum) setStrum(s.strum);
    if (s.drums) setDrums(s.drums);
    if (s.drumFills!=null) setDrumFills(s.drumFills);
    if (s.bass) setBassMode(s.bass);
    if (s.bassFills!=null) setBassFills(s.bassFills);
    if (s.backup) setBackup(s.backup);
    if (s.lead) setLead(s.lead);
    if (s.leadEvery) setLeadEvery(s.leadEvery);
    if (s.keys) setKeys(s.keys);
    // Channel balance: progression pin wins, else the style's baked mix,
    // else reset. Multipliers on top of the mixer's tuned volumes.
    setMix(s.mix??(g||GENRES.find(x=>x.key===genre))?.mix);
  };

  // Fills the active section (build a chorus by switching tabs and picking again).
  const applyProgression=p=>{
    setSectionBars(activeSec,toBars(p.bars));
    setEditIdx(null); setMoreOpen(false); setPosIdx(0); setPosSel([]);
    setPins(ps=>Object.fromEntries(Object.entries(ps).filter(([k])=>!k.startsWith(activeSec+':'))));
    applySetOverrides(p);
  };
  // Pins are keyed "section:barIndex"; structural edits re-home the active
  // section's pins and leave other sections' alone.
  const remapPins=fn=>setPins(ps=>{
    const n={};
    for (const [k,v] of Object.entries(ps)) {
      const ci=k.indexOf(':'), sec=k.slice(0,ci), j=+k.slice(ci+1);
      if (sec!==activeSec) { n[k]=v; continue; }
      const nj=fn(j);
      if (nj!=null) n[`${sec}:${nj}`]=v;
    }
    return n;
  });
  const setBar=(i,patch)=>{
    setBars(bs=>bs.map((b,j)=>j===i?{...b,...patch}:b));
    remapPins(j=>j===i?null:j); // a different chord invalidates the pinned voicing
  };
  const removeBar=i=>{
    setBars(bs=>bs.filter((_,j)=>j!==i)); setEditIdx(null);
    remapPins(j=>j===i?null:j>i?j-1:j);
  };
  const insertBar=i=>{
    setBars(bs=>[...bs.slice(0,i+1),{...bs[i]},...bs.slice(i+1)]); setEditIdx(i+1);
    remapPins(j=>j>i?j+1:j);
  };
  const addBar=()=>setBars(bs=>[...bs,bs.length?{...bs[bs.length-1]}:{deg:0,q:'maj'}]);

  const save=()=>{
    const name=saveName.trim();
    if (!name) return;
    const entry={name,key,meter,tempo,sections,arrangement,pins,feel,strum,drums,drumFills,bassMode,bassFills,backup,lead,leadEvery,keys,genre};
    const next=[...saved.filter(s=>s.name!==name),entry];
    setSaved(next);
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
  };
  const loadEntry=s=>{
    const m=s.meter&&METERS[s.meter]?s.meter:'4/4'; // legacy saves are 4/4
    setKey(s.key); setMeter(m); setTempo(s.tempo);
    setFeel(s.feel==='shuffle'&&METERS[m].swing?'shuffle':'straight');
    if (s.sections) {
      setSections({A:s.sections.A||[],B:s.sections.B||[],C:s.sections.C||[]});
      setArrangement(s.arrangement?.length?s.arrangement:['A']);
    } else { // legacy single-progression save
      setSections({A:s.bars,B:[],C:[]});
      setArrangement(['A']);
    }
    setActiveSec('A'); setPins(s.pins||{}); setPosIdx(0);
    setStrum(s.strum&&STRUMS[s.strum]?.p[m]?s.strum:'folk');
    setDrums(s.drums&&s.drums!=='off'?(DRUM_PATTERNS[s.drums]?.[m]?s.drums:'kit'):'off');
    setDrumFills(!!s.drumFills);
    setBassMode(s.bassMode&&s.bassMode!=='off'?(BASS_METERS[s.bassMode]?.includes(m)?s.bassMode:'root5'):'off');
    setBassFills(!!s.bassFills);
    setBackup(['roll','chop'].includes(s.backup)?s.backup:'off');
    setLead(s.lead||'off'); setLeadEvery([2,4,8].includes(s.leadEvery)?s.leadEvery:4);
    setKeys(s.keys||'off');
    const gk=s.genre&&PROGRESSIONS[s.genre]?s.genre:DEFAULT_GENRE.key;
    setGenre(gk);
    const ge=GENRES.find(g=>g.key===gk);
    setGenreTab(ge?.group||DEFAULT_GENRE.group);
    setMix(ge?.mix); // saved entries don't store mix; use the style's baked one
    setSaveName(s.name); setEditIdx(null);
  };
  const deleteEntry=name=>{
    const next=saved.filter(s=>s.name!==name);
    setSaved(next);
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
  };

  const btn=(on)=>`px-3 py-1.5 rounded text-sm font-medium transition-all ${on?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between gap-3 mb-1 py-3">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Progression Player</h1>
          <p className="text-sm text-gray-400">Pick a key and progression, set the tempo, and play it — as cowboy chords or voice-led triads.</p>
        </div>
        <div className="flex gap-2">
          <a href="#/" className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all whitespace-nowrap">← Progressions</a>
          <a href="#/triadfinder" className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all whitespace-nowrap">Triad Finder</a>
        </div>
      </div>

      <div className="mb-4 mt-4">
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Key</label>
        <div className="flex flex-wrap gap-1.5">
          {NOTES.map((n,i)=>(<button key={i} onClick={()=>setKey(i)} className={btn(key===i)}>{n}</button>))}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Genre <span className="normal-case text-gray-600">(pick a style to set meter, tempo, feel, strum &amp; band)</span></label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {GENRE_GROUPS.map(gr=>(
            <button key={gr} onClick={()=>applyGenreTab(gr)}
              className={`px-3 py-1.5 rounded text-sm font-medium border transition-all ${genreTab===gr?'border-amber-500 text-amber-400 bg-gray-900':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>
              {gr}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.filter(g=>g.group===genreTab).map(g=>(
            <button key={g.key} onClick={()=>applyGenre(g)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${genre===g.key?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {g.label}{g.meter&&g.meter!=='4/4'?<span className={genre===g.key?'text-gray-700':'text-gray-500'}> {g.meter}</span>:null}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Iconic Progressions <span className="normal-case text-gray-600">({GENRES.find(g=>g.key===genre)?.label})</span></label>
          <div className="flex flex-wrap gap-1.5">
            {(PROGRESSIONS[genre]||[]).slice(0,FEATURED).map(p=>(<button key={p.name} onClick={()=>applyProgression(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${barsKey(bars)===barsKey(toBars(p.bars))?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{p.name}</button>))}
            {(PROGRESSIONS[genre]||[]).length>FEATURED&&(
              <button onClick={()=>setMoreOpen(o=>!o)} className={`px-3 py-1.5 rounded text-sm font-medium border border-dashed transition-all ${moreOpen?'border-amber-500 text-amber-400':'border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400'}`}>
                More… ({(PROGRESSIONS[genre]||[]).length-FEATURED})
              </button>
            )}
          </div>
        </div>
        {moreOpen&&(
          <div className="w-full bg-gray-900 rounded-lg border border-gray-800 p-3">
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {(PROGRESSIONS[genre]||[]).map(p=>{
                const active=barsKey(bars)===barsKey(toBars(p.bars));
                return (
                  <button key={p.name} onClick={()=>applyProgression(p)} className={`text-left px-3 py-2 rounded-md transition-all ${active?'bg-amber-500/15 border border-amber-500/60':'bg-gray-950 border border-gray-800 hover:border-gray-600'}`}>
                    <div className={`text-sm font-medium ${active?'text-amber-400':'text-gray-200'}`}>{p.name}</div>
                    <div className="text-xs text-gray-500">{progSummary(p.bars)} <span className="text-gray-600">· {p.bars.length} bars</span></div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Tempo <span className="normal-case text-gray-600">{tempo} bpm</span></label>
          <input type="range" min="50" max="200" value={tempo} onChange={e=>setTempo(+e.target.value)} className="w-44 accent-amber-500"/>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">View</label>
          <div className="flex gap-1.5">
            <button onClick={()=>setView('cowboy')} className={btn(view==='cowboy')}>Cowboy chords</button>
            <button onClick={()=>setView('triads')} className={btn(view==='triads')}>Triads</button>
          </div>
        </div>
        {view==='triads'&&(
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">String Set</label>
            <div className="flex gap-1.5">
              <button onClick={()=>setSetKeySel(AUTO_KEY)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${auto?'bg-emerald-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>Auto</button>
              {STRING_SETS.map(s=>(<button key={s.key} onClick={()=>setSetKeySel(s.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${setKeySel===s.key?'bg-emerald-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>))}
            </div>
          </div>
        )}
        {view==='triads'&&(
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Position <span className="normal-case text-gray-600">{positions.length>1?`${displayAnchor+1}/${positions.length} · `:''}{posLabel}</span>{upNext&&<span className={`normal-case text-amber-400 ${climbPulse?'animate-pulse':''}`}> → {upNext.anchor+1}</span>}</label>
            <div className="flex gap-1.5">
              <button onClick={()=>setPosMode('climb')} className={btn(posMode==='climb')}>Loop the neck</button>
              <button onClick={()=>setPosMode('manual')} className={btn(posMode==='manual')}>Manual</button>
              {posMode==='climb'&&positions.length>1&&(
                <span className="flex items-center gap-1 ml-1">
                  {positions.map((_,i)=>{
                    const sel=posSel.length?posSel.includes(i):true;
                    return (
                      <button key={i} title={`Position ${i+1} in the climb`}
                        onClick={()=>setPosSel(s=>{
                          const cur=s.length?s:[...Array(positions.length).keys()];
                          const next=cur.includes(i)?cur.filter(x=>x!==i):[...cur,i];
                          return next.length?next:cur;
                        })}
                        className={`w-7 h-7 rounded text-xs font-medium transition-all ${sel?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>{i+1}</button>
                    );
                  })}
                </span>
              )}
              {posMode==='manual'&&(<>
                <button onClick={()=>setPosIdx(Math.max(0,pi-1))} disabled={pi<=0} className="px-3 py-1.5 rounded text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">▼</button>
                <button onClick={()=>setPosIdx(Math.min(positions.length-1,pi+1))} disabled={pi>=positions.length-1} className="px-3 py-1.5 rounded text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">▲</button>
              </>)}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={start} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${playing?'bg-red-600 text-white hover:bg-red-500':'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
          {playing?'■ Stop':'▶ Play'}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)} className="accent-amber-500"/> Loop
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Time</span>
          {METER_KEYS.map(k=>(
            <button key={k} onClick={()=>applyMeter(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${meter===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{METERS[k].label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Feel</span>
          {[['straight','Straight'],['shuffle','Shuffle']].map(([k,l])=>{
            const off=k==='shuffle'&&!METERS[meter].swing; // compound meters already swing
            return (
              <button key={k} onClick={()=>setFeel(k)} disabled={off} title={off?`${meter} is already triplet-based`:undefined}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${feel===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'} disabled:opacity-40 disabled:cursor-not-allowed`}>{l}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Guitar</span>
          {[['cowboy','Cowboy'],['triads','Triads'],['off','Muted']].map(([k,l])=>(
            <button key={k} onClick={()=>setSound(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${sound===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Strum</span>
          {Object.entries(STRUMS).filter(([,s])=>s.p[meter]).map(([k,s])=>(
            <button key={k} onClick={()=>setStrum(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${strum===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Drums</span>
          {[['off','Off'],['stomp','Stomp'],['kit','Kit'],['train','Train'],['bossa','Bossa'],['swing','Swing'],['funk','Funk']].filter(([k])=>k==='off'||DRUM_PATTERNS[k][meter]).map(([k,l])=>(
            <button key={k} onClick={()=>setDrums(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${drums===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          {!['off','stomp'].includes(drums)&&(
            <button onClick={()=>setDrumFills(f=>!f)} className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${drumFills?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Fills</button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Bass</span>
          {[['off','Off'],['root','Root'],['root5','Root–5th'],['walk','Walking'],['boogie','Boogie'],['bossa','Bossa'],['funk','Funk']].filter(([k])=>k==='off'||BASS_METERS[k].includes(meter)).map(([k,l])=>(
            <button key={k} onClick={()=>setBassMode(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${bassMode===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          {['root','root5'].includes(bassMode)&&(
            <button onClick={()=>setBassFills(f=>!f)} title="Walk up (or down) into the next chord whenever it changes"
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${bassFills?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Fills</button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Backup</span>
          {[['off','Off'],['roll','Roll'],['chop','Chop']].map(([k,l])=>(
            <button key={k} onClick={()=>setBackup(k)} title={k==='roll'?'Banjo rolls over each bar’s chord':k==='chop'?'Muted backbeat stabs':undefined}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${backup===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Keys</span>
          {[['off','Off'],['on','Comp'],['fills','Comp + Fills']].map(([k,l])=>(
            <button key={k} onClick={()=>setKeys(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${keys===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Lead</span>
          {[['off','Off'],['fills','Fills'],['solo','Solo']].map(([k,l])=>(
            <button key={k} onClick={()=>setLead(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${lead===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          {lead==='fills'&&[[8,'/8'],[4,'/4'],[2,'/2']].map(([n,l])=>(
            <button key={n} onClick={()=>setLeadEvery(n)} title={`A run every ${n} bars`}
              className={`px-2 py-1 rounded text-xs font-medium border transition-all ${leadEvery===n?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>{l}</button>
          ))}
        </div>
        <button onClick={()=>setShowMixer(o=>!o)} className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${showMixer?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Mixer</button>
      </div>

      {showMixer&&(
        <div className="mb-4 bg-gray-900 rounded-lg border border-gray-800 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
            <MixSlider label="Master" min={0} max={1.5} step={0.05} value={mixer.master} onChange={v=>updMixer('master',null,v)}/>
            <button onClick={()=>navigator.clipboard?.writeText(JSON.stringify(mixer,null,2))} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">Copy settings</button>
            <button title="Copy the full tuned state — style, band knobs, sample sets, and mixer — as one JSON blob, ready to paste to Claude to bake in as that style's defaults."
              onClick={()=>navigator.clipboard?.writeText(JSON.stringify({genre,meter,tempo,feel,strum,drums,drumFills,bass:bassMode,bassFills,backup,lead,leadEvery,keys,guitarInst:guitarSet,bassInst:bassSet,pianoInst:pianoSet,mixer},null,2))}
              className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">Copy style</button>
            <button onClick={resetMixer} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:text-red-400 transition-all">Reset</button>
            <span className="text-xs text-gray-600">Lo/Hi are shelf EQs in dB (250Hz / 2.8kHz). Live while playing; saved in your browser.</span>
          </div>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {[['guitar','Guitar'],['backup','Backup'],['bass','Bass'],['drums','Drums'],['lead','Lead'],['piano','Piano']].map(([ch,label])=>(
              // Guitar spans both grid columns: its Samples row is too wide to share.
              <div key={ch} className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${ch==='guitar'?'sm:col-span-2':''}`}>
                <span className="w-12 text-xs text-gray-300 font-medium">{label}</span>
                <MixSlider label="Vol" min={0} max={2} step={0.05} value={mixer[ch].vol} onChange={v=>updMixer(ch,'vol',v)}/>
                <MixSlider label="Reverb" min={0} max={0.6} step={0.02} value={mixer[ch].send} onChange={v=>updMixer(ch,'send',v)}/>
                <MixSlider label="Lo" min={-12} max={12} step={1} value={mixer[ch].low} onChange={v=>updMixer(ch,'low',v)}/>
                <MixSlider label="Hi" min={-12} max={12} step={1} value={mixer[ch].high} onChange={v=>updMixer(ch,'high',v)}/>
                {ch==='guitar'&&(
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">Samples</span>
                    {[['musyng','Musyng'],['fluid','Fluid'],['fatboy','FatBoy'],['nylon','Nylon'],['jazz','E.Jazz'],['muted','E.Muted'],['black','E.Black'],['green','E.Green'],['shiny','E.Shiny'],['ganjo','Banjo']].map(([k,l])=>(
                      <button key={k} onClick={()=>setGuitarSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${guitarSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                    ))}
                  </span>
                )}
                {ch==='bass'&&(
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">Samples</span>
                    {[['upright','Upright'],['electric','Electric']].map(([k,l])=>(
                      <button key={k} onClick={()=>setBassSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${bassSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                    ))}
                  </span>
                )}
                {ch==='piano'&&(
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">Samples</span>
                    {[['vcsl','Upright'],['osiris','Osiris']].map(([k,l])=>(
                      <button key={k} onClick={()=>setPianoSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${pianoSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Section</span>
            {SECTION_IDS.map(id=>(
              <button key={id} onClick={()=>{setActiveSec(id);setEditIdx(null);}} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${activeSec===id?'bg-emerald-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                {SECTION_LABELS[id]}{sections[id].length?'':<span className="text-gray-500"> — empty</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Arrangement</span>
            {arrangement.map((id,k)=>{
              const live=currentBar!=null&&flat.map[currentBar]?.inst===k;
              return (
                <span key={k} className={`inline-flex items-center gap-1 rounded-md pl-2 pr-1 py-0.5 text-xs border transition-all ${live?'border-amber-500 text-amber-400 bg-amber-500/10':'border-gray-700 bg-gray-950 text-gray-300'}`}>
                  {SECTION_LABELS[id]}
                  {arrangement.length>1&&<button onClick={()=>setArrangement(a=>a.filter((_,x)=>x!==k))} className="text-gray-600 hover:text-red-400 px-0.5" title="Remove from arrangement">×</button>}
                </span>
              );
            })}
            {SECTION_IDS.map(id=>(
              <button key={id} disabled={!sections[id].length} onClick={()=>setArrangement(a=>[...a,id])} className="px-2 py-0.5 rounded text-xs border border-dashed border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed" title={sections[id].length?`Append ${SECTION_LABELS[id]}`:`${SECTION_LABELS[id]} is empty`}>+ {SECTION_LABELS[id]}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {bars.map((bar,i)=>{
            const fi=dispStart+i;
            const ch=chords[fi];
            const isCur=currentBar!=null&&flat.map[currentBar]?.sec===activeSec&&flat.map[currentBar]?.j===i;
            const isEdit=editIdx===i;
            return (
              <div key={i} onClick={()=>setEditIdx(isEdit?null:i)}
                   className={`cursor-pointer rounded-lg border px-2 pt-1.5 pb-2 flex flex-col items-center transition-all min-w-[110px] ${isCur?'border-amber-500 bg-amber-500/10':isEdit?'border-emerald-500 bg-emerald-500/10':'border-gray-800 bg-gray-950 hover:border-gray-600'}`}>
                <div className="text-[10px] text-gray-600 self-start">bar {i+1}{view==='triads'&&auto&&triadPath[fi]&&<span className="text-gray-500"> · {triadPath[fi].set.label}</span>}{pins[`${activeSec}:${i}`]!=null&&<span className="text-emerald-500"> · pinned</span>}</div>
                <div className="text-sm font-bold text-amber-400">{ch.name} <span className="text-gray-500 font-normal text-xs">({ch.numeral})</span></div>
                {view==='cowboy'
                  ? (grips[fi]
                      ? <GripDiag grip={grips[fi]}/>
                      : (triadPath[fi]?<FretDiag voicing={triadPath[fi]} strs={triadPath[fi].set.strs} name={null} root={ch.root} size="small"/>:<div className="text-xs text-gray-600 italic p-4">no grip</div>))
                  : (triadPath[fi]
                      ? <FretDiag voicing={triadPath[fi]} strs={triadPath[fi].set.strs} name={null} root={ch.root} size="small"/>
                      : <div className="text-xs text-gray-600 italic p-4">no voicing</div>)}
              </div>
            );
          })}
          {view==='triads'&&upNext?.path[0]&&(
            <div className={`rounded-lg border border-dashed px-2 pt-1.5 pb-2 flex flex-col items-center min-w-[110px] transition-all ${climbPulse?'border-amber-400 ring-1 ring-amber-400/70 animate-pulse':'border-gray-600'}`}>
              <div className="text-[10px] text-amber-400/90 self-start">next loop · pos {upNext.anchor+1} · {fretWindow(upNext.path[0])}</div>
              <div className="text-sm font-bold text-amber-400">{chords[0].name} <span className="text-gray-500 font-normal text-xs">({chords[0].numeral})</span></div>
              <FretDiag voicing={upNext.path[0]} strs={upNext.path[0].set.strs} name={null} root={chords[0].root} size="small"/>
            </div>
          )}
          {!bars.length&&<div className="text-sm text-gray-500 italic self-center px-2">Empty {SECTION_LABELS[activeSec].toLowerCase()} — add bars with +, or pick an iconic progression above to fill it.</div>}
          <button onClick={addBar} className="rounded-lg border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 px-4 min-w-[60px] text-2xl transition-all" title="Add bar">+</button>
        </div>

        {editIdx!==null&&editIdx<bars.length&&(
          <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-emerald-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-emerald-400">Editing <span className="font-bold">bar {editIdx+1}</span></div>
              <div className="flex gap-2">
                <button onClick={()=>insertBar(editIdx)} className="text-xs text-gray-400 hover:text-white transition-colors">Duplicate after</button>
                <button onClick={()=>removeBar(editIdx)} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Remove bar</button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-1.5">Chord (degree in {NOTES[key]})</div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {DEGS.map((d,di)=>(<button key={di} onClick={()=>setBar(editIdx,{deg:d.i,q:bars[editIdx].q==='7'?'7':d.q})} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${bars[editIdx].deg===d.i?'bg-amber-500 text-gray-900':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{d.n}</button>))}
            </div>
            <div className="text-xs text-gray-500 mb-1.5">Quality</div>
            <div className="flex flex-wrap gap-1.5">
              {QKEYS.map(q=>(<button key={q} onClick={()=>setBar(editIdx,{q})} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${bars[editIdx].q===q?'bg-amber-500 text-gray-900':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{QS[q].l}</button>))}
            </div>
            {view==='triads'&&(()=>{
              const vs=candidatesFor(chords[dispStart+editIdx]).filter(v=>!hasOpenString(v.frets));
              if (!vs.length) return null;
              const curKey=pinKeyOf(triadPath[dispStart+editIdx]);
              const pk=`${activeSec}:${editIdx}`;
              return (
                <>
                  <div className="text-xs text-gray-500 mb-1.5 mt-2.5">Voicing <span className="text-gray-600">(pins this bar; later bars voice-lead from it)</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={()=>remapPins(j=>j===editIdx?null:j)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${pins[pk]==null?'bg-emerald-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Auto</button>
                    {vs.map(v=>{
                      const k=pinKeyOf(v);
                      const cls=pins[pk]===k?'bg-amber-500 text-gray-900'
                        :k===curKey?'bg-gray-700 text-emerald-400 ring-1 ring-emerald-600'
                        :'bg-gray-700 text-gray-300 hover:bg-gray-600';
                      return <button key={k} onClick={()=>setPins(ps=>({...ps,[pk]:k}))} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${cls}`}>{auto?`${v.set.label} · `:''}{fretWindow(v)}</button>;
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder="Progression name…"
               className="px-3 py-1.5 rounded-md text-sm bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-600 focus:border-amber-500 focus:outline-none w-52"/>
        <button onClick={save} disabled={!saveName.trim()} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
        {saved.map(s=>(
          <span key={s.name} className="inline-flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-md pl-2 pr-1 py-0.5 text-xs">
            <button onClick={()=>loadEntry(s)} className="text-emerald-400 hover:text-emerald-300 transition-colors" title={`Load (${NOTES[s.key]}, ${s.tempo} bpm, ${(s.sections?Object.values(s.sections).flat():s.bars).length} bars)`}>{s.name}</button>
            <button onClick={()=>deleteEntry(s.name)} className="text-gray-600 hover:text-red-400 transition-colors px-1" title="Delete">×</button>
          </span>
        ))}
      </div>

      <div className="mt-6 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p><strong className="text-gray-500">How to use:</strong> Pick a genre tab (it starts you on that genre's first style and progression), then a style, then one of its iconic progressions — or click any bar to edit its chord, and + to add bars. Songs can have up to three <strong>sections</strong> (Verse/Chorus/Bridge tabs above the bars): switch to an empty tab and pick a progression (or add bars) to fill it, then build the <strong>Arrangement</strong> with the + chips — playback runs the whole arrangement as one loop, voice-leading flows across section boundaries, and the sounding section's chip lights up. Saved progressions keep their sections, arrangement, and pinned voicings. Switching style loads that style's first progression along with its sound — pick another from the list (<strong>More…</strong> opens the genre's full catalog with numerals and bar counts) or edit the bars from there. Cowboy chords shows the simplest first-position grip for each bar; Triads shows a voice-led triad path on your chosen string set — or, with String Set on <strong>Auto</strong> (the default), across sets: each bar picks the voicing that moves pitches and your hand the least, crossing between 3-2-1, 4-3-2, and 5-4-3 the way real position playing does (each bar's card names its set). <strong>Position</strong> controls where the path sits on the neck. <strong>Loop the neck</strong> (the default) plays the progression once per position, climbing up and back down, changing exactly on the loop boundary — the diagrams and the counter follow along, so you can ride the whole neck hands-free; the numbered chips choose which positions the climb visits (e.g. just 1–2 while you're learning the low half). While climbing, a dashed "next loop" card at the end of the grid shows where bar 1 lands on the next pass, pulsing through the final bar — that's your cue for where the hand goes. <strong>Manual</strong> parks it in one position with ▼/▲ steppers. Either way the improvised Lead follows the position, since its notes come from each bar's voicing. To bend the path at one spot, click a bar and pick a <strong>Voicing</strong>: that bar is pinned (marked on its card) and later bars re-lead from it; Auto unpins. Everything is live while it plays — tempo, key, band, even switching progressions — playback carries on from the same beat. The <strong>View</strong> and the <strong>Guitar</strong> sound are independent, and you can switch views while it plays: watch the triads while the guitar strums cowboy chords to follow along, set Guitar to Triads to hear what the triads should sound like, or mute it and play the triads yourself over the rhythm section. A <strong>Style</strong> button sets time signature, tempo, feel, strum pattern, and the band in one tap — every knob stays individually adjustable after. <strong>Time</strong> switches the meter by hand: 4/4, 3/4 (waltz), or 6/8 (compound — two pulses of three, the slow-blues feel). Strums, drums, and bass lines are written per meter, so the rows only show patterns that exist in the current one; switching meter pulls any knob that doesn't fit back to one that does (strum to Folk, drums to Kit, bass to Root–5th). Shuffle is disabled in 6/8 since the meter is already triplet-based. Some progressions also pin part of the band to fit their character (Cabbage locks in the driving boom-chick and alternating bass); knobs a progression doesn't pin keep your current settings. Strums: Folk is D-DU-UDU; Boom-chick picks the bass note on 1 and 3 and strums the top strings on 2 and 4 (old-time rhythm guitar); Bluegrass adds upstroke fills to the boom-chick; Lo-fi is sparse and lazy (it doubles as jazz comping); Pop is driving eighths; Travis fakes fingerpicking — thumb bass on every beat, soft finger picks between; Bossa is the syncopated bossa comp; Funk is scratchy off-beat sixteenths. Drums: Stomp (foot-tap), Kit (kick/snare/hats), Train (brushes with a backbeat), Bossa (rim clicks over hats), Swing (ride pattern with feathered kick — pair with Shuffle), Funk (syncopated kick, ghost snares); the Fills toggle throws a snare/tom run into every 4th bar, different each time Play builds the loop. <strong>Backup</strong> adds a second rhythm instrument over the guitar — a banjo, for now: Roll arpeggiates each bar's chord in three-finger-style eighth-note rolls (bluegrass turns it on by default), Chop plays short muted backbeat stabs (the mandolin-chop feel); it has its own Mixer strip. Keys adds an upright piano comping block chords on each bar; Comp + Fills also sprinkles a chord-tone run into every 4th bar, new each time Play builds the loop. Bass patterns: Root, Root–5th, Walking (with chromatic approaches), Boogie (the swung R-3-5-6 shuffle line), Bossa (dotted root–fifth), or Funk (syncopated with octave pops); on Root and Root–5th a <strong>Fills</strong> toggle walks up (or down) into the next chord whenever it changes — the country move that livens the simple patterns without full-time Walking — played on an upright or an electric (the Mixer's bass Samples switch; Pop, Indie Pop, and Funk preset the electric). The Mixer's guitar Samples switch likewise offers three acoustics and two electrics (E.Jazz hollowbody-ish, E.Muted for funk scratch). Shuffle swings the offbeat strums and hats onto the triplet grid (the blues preset selects it automatically). Lead improvises pentatonic notes drawn from each bar's triad position on the selected string set — Fills plays a run into every Nth bar (the /8 /4 /2 chips set how often), Solo noodles throughout; each press of Play writes a new solo, and it loops as played. The lead also rolls guitar articulations as it goes: bends into strong beats and fill endings, hammer-on/pull-off legato on quick close steps, and the occasional double stop. Saved progressions live in your browser.</p>
        <p className="mt-2">Sounds: guitar from the <a href="https://github.com/gleitz/midi-js-soundfonts" className="underline hover:text-gray-400">FatBoy SoundFont</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" className="underline hover:text-gray-400">CC BY-SA 3.0</a>); upright bass from <a href="https://github.com/sfzinstruments/karoryfer.meatbass" className="underline hover:text-gray-400">Meatbass</a> and electric bass from <a href="https://github.com/sfzinstruments/karoryfer.black-and-blue-basses" className="underline hover:text-gray-400">Black And Blue Basses</a>, both by Karoryfer Samples (CC0); drums from the <a href="https://archive.org/details/SalamanderDrumkit" className="underline hover:text-gray-400">Salamander Drumkit</a> by Alexander Holm (public domain); brushes from <a href="https://shop.karoryfer.com/pages/free-samples" className="underline hover:text-gray-400">Swirly Drums</a> by Karoryfer Samples (CC0); upright piano from the <a href="https://github.com/sgossner/VCSL" className="underline hover:text-gray-400">Versilian Community Sample Library</a> (CC0); electric guitars (E.Black/E.Green) from <a href="https://github.com/sfzinstruments/karoryfer.black-and-green-guitars" className="underline hover:text-gray-400">Black And Green Guitars</a> by Karoryfer Samples (CC0); Osiris piano from <a href="https://github.com/sfzinstruments/Osiris_Piano" className="underline hover:text-gray-400">Osiris Piano</a> by Versilian Studios &amp; Karoryfer Samples (CC0); archtop electric (E.Shiny) from <a href="https://github.com/sfzinstruments/karoryfer.shinyguitar" className="underline hover:text-gray-400">Shinyguitar</a> by Karoryfer Samples (CC0); banjo from <a href="https://github.com/sfzinstruments/ganjo" className="underline hover:text-gray-400">ganjo</a> by itsclipping (CC0).</p>
      </div>
    </div>
    </div>
  );
}
