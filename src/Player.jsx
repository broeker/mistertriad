import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  NOTES, SCALE, DEGS, QS, QKEYS, STRING_SETS, isMinorFamily,
  getVoicings, closestVoicing, hasOpenString, firstPositionGrip,
  matchCAGEDZone, voicingKey,
} from './music.js';
import FretDiag, { GripDiag } from './FretDiag.jsx';
import { ensureCtx, ctxTime, preload, preloadDrums, setMix, scheduleStrum, scheduleBass, scheduleDrum, scheduleLead, schedulePiano, stopAll, voicingMidis, STRING_MIDI, AUDIO_DEFAULTS, setAudioSettings, setGuitarSet as applyGuitarSet } from './audio.js';

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

// Strum patterns (b = beat offset within a 4/4 bar; span: full/top/bass).
const STRUMS = {
  folk: { label:'Folk', p:[
    { b:0, dir:'down', g:1.0 }, { b:1, dir:'down', g:0.75 }, { b:1.5, dir:'up', g:0.4 },
    { b:2.5, dir:'up', g:0.4 }, { b:3, dir:'down', g:0.75 }, { b:3.5, dir:'up', g:0.4 },
  ]},
  boomchick: { label:'Boom-chick', p:[
    { b:0, dir:'down', g:1.0, span:'bass' }, { b:1, dir:'down', g:0.8, span:'top' },
    { b:2, dir:'down', g:0.95, span:'bass' }, { b:3, dir:'down', g:0.8, span:'top' },
  ]},
  bluegrass: { label:'Bluegrass', p:[
    { b:0, dir:'down', g:1.0, span:'bass' }, { b:1, dir:'down', g:0.8, span:'top' }, { b:1.5, dir:'up', g:0.35 },
    { b:2, dir:'down', g:0.95, span:'bass' }, { b:3, dir:'down', g:0.8, span:'top' }, { b:3.5, dir:'up', g:0.35 },
  ]},
  lofi: { label:'Lo-fi', p:[
    { b:0, dir:'down', g:0.85 }, { b:1.5, dir:'up', g:0.35 },
    { b:2, dir:'down', g:0.7 }, { b:3.5, dir:'up', g:0.3 },
  ]},
};

// A genre is a bundle of the knobs: tempo, feel, strum pattern, rhythm section.
const GENRES = [
  { key:'oldtime',   label:'Old-Time Country', tempo:100, feel:'straight', strum:'boomchick', drums:'train', bass:'root5',  lead:'off',   drumFills:false, keys:'off' },
  { key:'bluegrass', label:'Bluegrass',        tempo:145, feel:'straight', strum:'bluegrass', drums:'off',   bass:'walk',   lead:'fills', drumFills:false, keys:'off' },
  { key:'blues',     label:'Blues',            tempo:84,  feel:'shuffle',  strum:'folk',      drums:'kit',   bass:'boogie', lead:'fills', drumFills:true,  keys:'off' },
  { key:'altcountry',label:'Alt Country',      tempo:95,  feel:'straight', strum:'folk',      drums:'kit',   bass:'root5',  lead:'off',   drumFills:true,  keys:'on' },
  { key:'lofi',      label:'Lo-Fi',            tempo:72,  feel:'shuffle',  strum:'lofi',      drums:'kit',   bass:'root',   lead:'solo',  drumFills:false, keys:'fills' },
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
  const [bars,setBars]=useState(()=>toBars(PROGRESSIONS.blues[0].bars));
  const [tempo,setTempo]=useState(DEFAULT_GENRE.tempo);
  const [view,setView]=useState('cowboy');
  const [setKeySel,setSetKeySel]=useState('321');
  const [loop,setLoop]=useState(true);
  const [feel,setFeel]=useState(DEFAULT_GENRE.feel);
  const [sound,setSound]=useState('cowboy'); // guitar channel: cowboy | triads | off
  const [strum,setStrum]=useState(DEFAULT_GENRE.strum);
  const [drums,setDrums]=useState(DEFAULT_GENRE.drums);   // off | stomp | kit | train
  const [drumFills,setDrumFills]=useState(DEFAULT_GENRE.drumFills);
  const [bassMode,setBassMode]=useState(DEFAULT_GENRE.bass); // off | root | root5 | walk | boogie
  const [lead,setLead]=useState(DEFAULT_GENRE.lead);     // off | fills | solo
  const [keys,setKeys]=useState(DEFAULT_GENRE.keys);     // off | on — upright piano comping
  const [genre,setGenre]=useState(DEFAULT_GENRE.key);
  const [playing,setPlaying]=useState(false);
  const [currentBar,setCurrentBar]=useState(null);
  const [editIdx,setEditIdx]=useState(null);
  const [saved,setSaved]=useState(loadSaved);
  const [saveName,setSaveName]=useState('');
  const [moreOpen,setMoreOpen]=useState(false);
  const [mixer,setMixer]=useState(loadMixer);
  const [showMixer,setShowMixer]=useState(false);
  const [guitarSet,setGuitarSet]=useState(()=>localStorage.getItem('mrtriad.guitarSet')||'fatboy');
  const playRef=useRef(null);
  const loopRef=useRef(loop);
  loopRef.current=loop;

  const chords=useMemo(()=>bars.map(b=>chordOf(b,key)),[bars,key]);

  // Cowboy view: first-position grip per bar (null for dim/aug).
  const grips=useMemo(()=>chords.map(ch=>firstPositionGrip(ch.root,ch.quality)),[chords]);

  // Triads view: voice-led path on the selected string set; repeated chords keep
  // their voicing. posIdx picks which of bar 1's voicings anchors the path (the
  // neck position); pins force a specific voicing on a bar, and later bars
  // re-lead from it.
  const strs=STRING_SETS.find(s=>s.key===setKeySel).strs;
  const [posIdx,setPosIdx]=useState(0);
  const [posMode,setPosMode]=useState('climb'); // climb: each loop pass moves to the next position
  const [livePass,setLivePass]=useState(0);
  const [pins,setPins]=useState({});

  // Selectable anchor positions: bar 1's closed voicings, low to high.
  const positions=useMemo(()=>{
    if (!chords.length) return [];
    const ch=chords[0];
    const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
    const vs=getVoicings(nts,ch.root,strs);
    const closed=vs.filter(v=>!hasOpenString(v.frets));
    return closed.length?closed:vs;
  },[chords,strs]);
  const pi=Math.min(posIdx,Math.max(0,positions.length-1));

  const pathForAnchor=useCallback(anchor=>{
    const path=[];
    for (let i=0;i<chords.length;i++) {
      const ch=chords[i];
      const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
      const vs=getVoicings(nts,ch.root,strs);
      if (!vs.length) { path.push(null); continue; }
      const pinned=pins[i]!=null?vs.find(v=>voicingKey(v)===pins[i]):null;
      if (pinned) { path.push(pinned); continue; }
      if (i>0&&chords[i-1].root===ch.root&&chords[i-1].quality===ch.quality&&path[i-1]) { path.push(path[i-1]); continue; }
      if (i===0) {
        const closed=vs.filter(v=>!hasOpenString(v.frets));
        const list=closed.length?closed:vs;
        path.push(list[Math.min(anchor,list.length-1)]);
        continue;
      }
      const prev=path[i-1];
      path.push(prev?closestVoicing(vs,prev.frets):(vs.find(v=>!hasOpenString(v.frets))||vs[0]));
    }
    return path;
  },[chords,strs,pins]);

  // Climb order: up through every position, then back down (ping-pong).
  const passOrder=useMemo(()=>{
    const P=positions.length;
    if (posMode!=='climb'||P<2) return [pi];
    return [...Array(P).keys(),...Array.from({length:P-2},(_,k)=>P-2-k)];
  },[posMode,positions.length,pi]);

  // What the grid shows: the playing pass's position while climbing, else the manual pick.
  const displayAnchor=posMode==='climb'&&playing?passOrder[Math.min(livePass,passOrder.length-1)]:pi;
  const triadPath=useMemo(()=>pathForAnchor(displayAnchor),[pathForAnchor,displayAnchor]);

  const fretWindow=v=>{
    if (!v) return '';
    const nz=v.frets.filter(f=>f>0);
    const lo=nz.length?Math.min(...nz):0, hi=Math.max(...v.frets);
    return lo===hi?`fret ${lo}`:`frets ${lo}–${hi}`;
  };
  const posLabel=useMemo(()=>{
    const v=triadPath[0]; if (!v||!chords.length) return '';
    const z=matchCAGEDZone(chords[0].root,chords[0].quality,v.frets);
    return `${fretWindow(v)}${z?` · ${z.name}-shape`:''}`;
  },[triadPath,chords]);

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

  const updMixer=(ch,param,val)=>setMixer(m=>{
    const next=ch==='master'?{...m,master:val}:{...m,[ch]:{...m[ch],[param]:val}};
    localStorage.setItem(MIXER_KEY,JSON.stringify(next));
    return next;
  });
  const resetMixer=()=>{ localStorage.removeItem(MIXER_KEY); setMixer(JSON.parse(JSON.stringify(AUDIO_DEFAULTS))); };

  const applyGenre=g=>{
    setGenre(g.key); setTempo(g.tempo); setFeel(g.feel); setStrum(g.strum);
    setDrums(g.drums); setBassMode(g.bass); setLead(g.lead); setDrumFills(g.drumFills); setKeys(g.keys);
    applyProgression(PROGRESSIONS[g.key][0]);
  };

  // The full loop as a flat event list — a pure function of the current settings.
  // Playback walks whatever schedule sits in playRef; rebuilding and swapping it
  // mid-play (effect below start) is how settings change without stopping.
  const buildSchedule=useCallback(()=>{
    const spb=60/tempo, barDur=4*spb;
    const passBars=bars.length;
    const loopDur=passOrder.length*passBars*barDur;
    // Shuffle: offbeat eighths land on the triplet 2/3 instead of halfway.
    const sw=feel==='shuffle'?(b=>Math.floor(b)+(b%1?2/3:0)):(b=>b);
    const events=[];
    const bassMidis=[],leadMidis=[],pianoMidis=[];
    const guitarMidis=[]; // flattened: pass*passBars + bar
    let leadLast=null; // walker carries across bars so lines connect through chord changes
    // One pass through the bars per position in passOrder; climbing plays the
    // progression at each position in turn, transitions on the loop boundary.
    passOrder.forEach((anchor,pass)=>{
    const path=pathForAnchor(anchor);
    bars.forEach((_,i)=>{
      const gi=pass*passBars+i;
      const base=gi*barDur;
      let midis=[];
      if (sound!=='off') {
        if (sound==='cowboy'&&grips[i]) midis=[6,5,4,3,2,1].filter(s=>grips[i].frets[s]).map(s=>STRING_MIDI[s]+grips[i].frets[s].fret);
        else if (path[i]) midis=voicingMidis(strs,path[i].frets);
      }
      guitarMidis.push(midis);
      STRUMS[strum].p.forEach(p=>events.push({t:base+sw(p.b)*spb,type:'strum',i:gi,dir:p.dir,g:p.g,span:p.span}));
      if (drums==='stomp') {
        [0,2].forEach(b=>events.push({t:base+b*spb,type:'drum',kind:'stomp',g:b===0?1:0.8}));
      } else if (drums==='kit') {
        [0,2].forEach(b=>events.push({t:base+b*spb,type:'drum',kind:'kick',g:1}));
        [1,3].forEach(b=>events.push({t:base+b*spb,type:'drum',kind:'snare',g:1}));
        [0,0.5,1,1.5,2,2.5,3,3.5].forEach(b=>events.push({t:base+sw(b)*spb,type:'drum',kind:'hat',g:b%1?0.7:1}));
      } else if (drums==='train') {
        [0,2].forEach(b=>events.push({t:base+b*spb,type:'drum',kind:'kick',g:0.6}));
        [0,0.5,1,1.5,2,2.5,3,3.5].forEach(b=>events.push({t:base+sw(b)*spb,type:'drum',kind:'brush',g:(b===1||b===3)?1:0.55}));
      }
      if (drumFills&&(drums==='kit'||drums==='train')&&bars.length>=4&&(i+1)%4===0) {
        const fill=DRUM_FILLS[Math.floor(Math.random()*DRUM_FILLS.length)];
        const soft=drums==='train'?0.8:1; // brushes-era kit plays fills gentler
        [2.5,3,3.5].forEach((b,k)=>events.push({t:base+sw(b)*spb,type:'drum',kind:fill[k][0],g:fill[k][1]*soft}));
      }
      if (bassMode!=='off') {
        const ch=chords[i];
        const rootM=28+((ch.root-4+12)%12);          // E1..D#2
        const minish=isMinorFamily(ch.quality);
        const third=minish?3:4, fifth=ch.quality==='dim'?6:7, sixth=minish?10:9;
        const pushBass=(b,m,g,swung=false)=>{ events.push({t:base+(swung?sw(b):b)*spb,type:'bass',m,g}); bassMidis.push(m); };
        if (bassMode==='root') {
          pushBass(0,rootM,1);
        } else if (bassMode==='root5') {
          const fifthM=rootM-(12-fifth)>=28?rootM-(12-fifth):rootM+fifth;
          pushBass(0,rootM,1); pushBass(2,fifthM,0.85);
        } else if (bassMode==='walk') {
          const next=chords[(i+1)%chords.length];
          const nextRootM=28+((next.root-4+12)%12);
          const sameNext=next.root===ch.root&&next.quality===ch.quality;
          const approach=sameNext?rootM+sixth:(nextRootM-1>=28?nextRootM-1:nextRootM+1);
          pushBass(0,rootM,1); pushBass(1,rootM+third,0.85); pushBass(2,rootM+fifth,0.9); pushBass(3,approach,0.85);
        } else if (bassMode==='boogie') {
          const line=[0,0,third,third,fifth,fifth,sixth,sixth];
          [0,0.5,1,1.5,2,2.5,3,3.5].forEach((b,k)=>pushBass(b,rootM+line[k],b%1?0.7:0.95,true));
        }
      }
      if (keys!=='off') {
        const pc=chords[i].root;
        const rootM=pc<6?60+pc:48+pc; // root position around middle C
        const pv=QS[chords[i].quality].iv.map(iv=>rootM+iv);
        const hits=feel==='shuffle'?[[0,0.6],[2.5,0.45]]:[[0,0.6],[2,0.5]];
        hits.forEach(([b,g])=>events.push({t:base+sw(b)*spb,type:'piano',m:pv,g}));
        pianoMidis.push(...pv);
        if (keys==='fills'&&bars.length>=4&&(i+1)%4===0) {
          // chord-tone run an octave up, ringing over the comp into the next bar
          const pool=pv.map(m=>m<66?m+12:m).sort((a,b)=>a-b);
          const dir=Math.random()<0.5?1:-1;
          let idx=dir===1?0:pool.length-1;
          [2.5,3,3.5].forEach(b=>{
            const m=pool[Math.max(0,Math.min(pool.length-1,idx))];
            events.push({t:base+sw(b)*spb,type:'pianoNote',m,g:0.5});
            pianoMidis.push(m);
            idx+=dir;
          });
        }
      }
      if (lead!=='off'&&path[i]) {
        const pool=leadPool(chords[i],path[i],strs);
        if (pool.length>2) {
          const nearest=m=>pool.reduce((b,x,j)=>Math.abs(x-m)<Math.abs(pool[b]-m)?j:b,0);
          if (lead==='solo') {
            for (const b of [0,0.5,1,1.5,2,2.5,3,3.5]) {
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
          } else if ((i+1)%4===0) { // fills: a directed run into every 4th bar
            const dir=Math.random()<0.5?1:-1;
            let idx=leadLast!==null?nearest(leadLast):Math.floor(pool.length*(dir===1?0.3:0.7));
            for (const b of [2,2.5,3,3.5]) {
              idx=Math.max(0,Math.min(pool.length-1,idx+dir));
              const prevM=leadLast;
              leadLast=pool[idx];
              leadMidis.push(leadLast);
              const art=leadArt(pool,idx,prevM,b,b===3.5);
              if (art?.double!=null) leadMidis.push(art.double);
              events.push({t:base+sw(b)*spb+(Math.random()-0.5)*0.014,type:'lead',m:leadLast,g:b%1?0.52:0.62,art});
            }
          }
        }
      }
    });
    });
    events.sort((a,b)=>a.t-b.t);
    return {events,loopDur,barDur,spb,guitarMidis,bassMidis,leadMidis,pianoMidis,passBars};
  // guitarSet is a dep so switching sample sets re-preloads and hot-swaps mid-play.
  },[bars,chords,tempo,feel,strum,drums,drumFills,bassMode,lead,keys,passOrder,pathForAnchor,grips,sound,strs,guitarSet]);

  const tick=useCallback(()=>{
    const st=playRef.current;
    if (!st||!st.events.length) return;
    const now=ctxTime();
    while (true) {
      const loopN=Math.floor(st.nextIdx/st.events.length);
      if (!loopRef.current&&loopN>=1) break;
      const ev=st.events[st.nextIdx%st.events.length];
      const t=st.t0+loopN*st.loopDur+ev.t;
      if (t>now+0.25) break;
      if (ev.type==='strum') { if (st.guitarMidis[ev.i].length) scheduleStrum(st.guitarMidis[ev.i],t,{dir:ev.dir,gain:ev.g,span:ev.span}); }
      else if (ev.type==='drum') scheduleDrum(ev.kind,t,ev.g);
      else if (ev.type==='bass') scheduleBass(ev.m,t,ev.g);
      else if (ev.type==='lead') scheduleLead(ev.m,t,ev.g,ev.art);
      else if (ev.type==='piano') schedulePiano(ev.m,t,ev.g);
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
    Promise.all([preload([...sc.guitarMidis.flat(),...sc.leadMidis]),preload(sc.bassMidis,'bass'),preload(sc.pianoMidis,'piano'),preloadDrums()]).then(()=>{
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
    Promise.all([preload([...sc.guitarMidis.flat(),...sc.leadMidis]),preload(sc.bassMidis,'bass'),preload(sc.pianoMidis,'piano'),preloadDrums()]).then(()=>{
      const st=playRef.current;
      if (!st||seq!==rebuildSeq.current) return; // stopped, or a newer rebuild superseded this one
      const now=ctxTime();
      let beats=Math.max(0,(now-st.t0)/st.spb);
      const loopBeats=sc.loopDur/sc.spb;
      if (loopRef.current) beats%=loopBeats;
      else if (beats>=loopBeats) { stop(); return; }
      stopAll(); // cut the ≤250ms tail already scheduled from the stale settings
      const tIn=beats*sc.spb;
      let idx=sc.events.findIndex(e=>e.t>=tIn-1e-6);
      if (idx<0) idx=sc.events.length;
      Object.assign(st,sc,{t0:now-tIn,nextIdx:idx});
    });
  },[buildSchedule,stop]);

  const applyProgression=p=>{
    setBars(toBars(p.bars)); setEditIdx(null); setMoreOpen(false); setPins({});
    const s=p.set||{};
    if (s.tempo!=null) setTempo(s.tempo);
    if (s.feel) setFeel(s.feel);
    if (s.strum) setStrum(s.strum);
    if (s.drums) setDrums(s.drums);
    if (s.drumFills!=null) setDrumFills(s.drumFills);
    if (s.bass) setBassMode(s.bass);
    if (s.lead) setLead(s.lead);
    if (s.keys) setKeys(s.keys);
    setMix(s.mix); // channel-level balance (e.g. {bass:1.2}); resets when absent
  };
  // Pins are keyed by bar index, so structural edits re-home them.
  const remapPins=fn=>setPins(ps=>{
    const n={};
    for (const [k,v] of Object.entries(ps)) { const j=fn(+k); if (j!=null) n[j]=v; }
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
    const entry={name,key,tempo,bars,feel,strum,drums,drumFills,bassMode,lead,keys,genre};
    const next=[...saved.filter(s=>s.name!==name),entry];
    setSaved(next);
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
  };
  const loadEntry=s=>{
    setKey(s.key); setTempo(s.tempo); setBars(s.bars); setFeel(s.feel||'straight');
    setStrum(s.strum&&STRUMS[s.strum]?s.strum:'folk'); setDrums(s.drums||'off'); setDrumFills(!!s.drumFills); setBassMode(s.bassMode||'off'); setLead(s.lead||'off'); setKeys(s.keys||'off');
    setGenre(s.genre&&PROGRESSIONS[s.genre]?s.genre:DEFAULT_GENRE.key);
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
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Genre <span className="normal-case text-gray-600">(sets tempo, feel, strum &amp; band)</span></label>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map(g=>(<button key={g.key} onClick={()=>applyGenre(g)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${genre===g.key?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{g.label}</button>))}
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
              {STRING_SETS.map(s=>(<button key={s.key} onClick={()=>setSetKeySel(s.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${setKeySel===s.key?'bg-emerald-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>))}
            </div>
          </div>
        )}
        {view==='triads'&&(
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Position <span className="normal-case text-gray-600">{positions.length>1?`${displayAnchor+1}/${positions.length} · `:''}{posLabel}</span></label>
            <div className="flex gap-1.5">
              <button onClick={()=>setPosMode('climb')} className={btn(posMode==='climb')}>Loop the neck</button>
              <button onClick={()=>setPosMode('manual')} className={btn(posMode==='manual')}>Manual</button>
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
          <span className="text-xs text-gray-500 uppercase tracking-wide">Feel</span>
          {[['straight','Straight'],['shuffle','Shuffle']].map(([k,l])=>(
            <button key={k} onClick={()=>setFeel(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${feel===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Guitar</span>
          {[['cowboy','Cowboy'],['triads','Triads'],['off','Muted']].map(([k,l])=>(
            <button key={k} onClick={()=>setSound(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${sound===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Strum</span>
          {Object.entries(STRUMS).map(([k,s])=>(
            <button key={k} onClick={()=>setStrum(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${strum===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Drums</span>
          {[['off','Off'],['stomp','Stomp'],['kit','Kit'],['train','Train']].map(([k,l])=>(
            <button key={k} onClick={()=>setDrums(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${drums===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          {(drums==='kit'||drums==='train')&&(
            <button onClick={()=>setDrumFills(f=>!f)} className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${drumFills?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Fills</button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Bass</span>
          {[['off','Off'],['root','Root'],['root5','Root–5th'],['walk','Walking'],['boogie','Boogie']].map(([k,l])=>(
            <button key={k} onClick={()=>setBassMode(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${bassMode===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
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
        </div>
        <button onClick={()=>setShowMixer(o=>!o)} className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${showMixer?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Mixer</button>
      </div>

      {showMixer&&(
        <div className="mb-4 bg-gray-900 rounded-lg border border-gray-800 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
            <MixSlider label="Master" min={0} max={1.5} step={0.05} value={mixer.master} onChange={v=>updMixer('master',null,v)}/>
            <button onClick={()=>navigator.clipboard?.writeText(JSON.stringify(mixer,null,2))} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">Copy settings</button>
            <button onClick={resetMixer} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:text-red-400 transition-all">Reset</button>
            <span className="text-xs text-gray-600">Lo/Hi are shelf EQs in dB (250Hz / 2.8kHz). Live while playing; saved in your browser.</span>
          </div>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {[['guitar','Guitar'],['bass','Bass'],['drums','Drums'],['lead','Lead'],['piano','Piano']].map(([ch,label])=>(
              <div key={ch} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="w-12 text-xs text-gray-300 font-medium">{label}</span>
                <MixSlider label="Vol" min={0} max={2} step={0.05} value={mixer[ch].vol} onChange={v=>updMixer(ch,'vol',v)}/>
                <MixSlider label="Reverb" min={0} max={0.6} step={0.02} value={mixer[ch].send} onChange={v=>updMixer(ch,'send',v)}/>
                <MixSlider label="Lo" min={-12} max={12} step={1} value={mixer[ch].low} onChange={v=>updMixer(ch,'low',v)}/>
                <MixSlider label="Hi" min={-12} max={12} step={1} value={mixer[ch].high} onChange={v=>updMixer(ch,'high',v)}/>
                {ch==='guitar'&&(
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Samples</span>
                    {[['musyng','Musyng'],['fluid','Fluid'],['fatboy','FatBoy']].map(([k,l])=>(
                      <button key={k} onClick={()=>setGuitarSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${guitarSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
        <div className="flex flex-wrap gap-2">
          {bars.map((bar,i)=>{
            const ch=chords[i];
            const isCur=currentBar===i,isEdit=editIdx===i;
            return (
              <div key={i} onClick={()=>setEditIdx(isEdit?null:i)}
                   className={`cursor-pointer rounded-lg border px-2 pt-1.5 pb-2 flex flex-col items-center transition-all min-w-[110px] ${isCur?'border-amber-500 bg-amber-500/10':isEdit?'border-emerald-500 bg-emerald-500/10':'border-gray-800 bg-gray-950 hover:border-gray-600'}`}>
                <div className="text-[10px] text-gray-600 self-start">bar {i+1}{pins[i]!=null&&<span className="text-emerald-500"> · pinned</span>}</div>
                <div className="text-sm font-bold text-amber-400">{ch.name} <span className="text-gray-500 font-normal text-xs">({ch.numeral})</span></div>
                {view==='cowboy'
                  ? (grips[i]
                      ? <GripDiag grip={grips[i]}/>
                      : (triadPath[i]?<FretDiag voicing={triadPath[i]} strs={strs} name={null} root={ch.root} size="small"/>:<div className="text-xs text-gray-600 italic p-4">no grip</div>))
                  : (triadPath[i]
                      ? <FretDiag voicing={triadPath[i]} strs={strs} name={null} root={ch.root} size="small"/>
                      : <div className="text-xs text-gray-600 italic p-4">no voicing</div>)}
              </div>
            );
          })}
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
              const ch=chords[editIdx];
              const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
              const vs=getVoicings(nts,ch.root,strs).filter(v=>!hasOpenString(v.frets));
              if (!vs.length) return null;
              const curKey=voicingKey(triadPath[editIdx]);
              return (
                <>
                  <div className="text-xs text-gray-500 mb-1.5 mt-2.5">Voicing <span className="text-gray-600">(pins this bar; later bars voice-lead from it)</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={()=>remapPins(j=>j===editIdx?null:j)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${pins[editIdx]==null?'bg-emerald-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Auto</button>
                    {vs.map(v=>{
                      const k=voicingKey(v);
                      const cls=pins[editIdx]===k?'bg-amber-500 text-gray-900'
                        :k===curKey?'bg-gray-700 text-emerald-400 ring-1 ring-emerald-600'
                        :'bg-gray-700 text-gray-300 hover:bg-gray-600';
                      return <button key={k} onClick={()=>setPins(ps=>({...ps,[editIdx]:k}))} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${cls}`}>{fretWindow(v)}</button>;
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
            <button onClick={()=>loadEntry(s)} className="text-emerald-400 hover:text-emerald-300 transition-colors" title={`Load (${NOTES[s.key]}, ${s.tempo} bpm, ${s.bars.length} bars)`}>{s.name}</button>
            <button onClick={()=>deleteEntry(s.name)} className="text-gray-600 hover:text-red-400 transition-colors px-1" title="Delete">×</button>
          </span>
        ))}
      </div>

      <div className="mt-6 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p><strong className="text-gray-500">How to use:</strong> Pick a genre, then one of its iconic progressions — or click any bar to edit its chord, and + to add bars. Switching genre loads that genre's first progression along with its sound — pick another from the list (<strong>More…</strong> opens the genre's full catalog with numerals and bar counts) or edit the bars from there. Cowboy chords shows the simplest first-position grip for each bar; Triads shows a voice-led triad path on your chosen string set — the same voicing logic as the Progressions page. <strong>Position</strong> controls where the path sits on the neck. <strong>Loop the neck</strong> (the default) plays the progression once per position, climbing up and back down, changing exactly on the loop boundary — the diagrams and the counter follow along, so you can ride the whole neck hands-free. <strong>Manual</strong> parks it in one position with ▼/▲ steppers. Either way the improvised Lead follows the position, since its notes come from each bar's voicing. To bend the path at one spot, click a bar and pick a <strong>Voicing</strong>: that bar is pinned (marked on its card) and later bars re-lead from it; Auto unpins. Everything is live while it plays — tempo, key, band, even switching progressions — playback carries on from the same beat. The <strong>View</strong> and the <strong>Guitar</strong> sound are independent, and you can switch views while it plays: watch the triads while the guitar strums cowboy chords to follow along, set Guitar to Triads to hear what the triads should sound like, or mute it and play the triads yourself over the rhythm section. A <strong>Genre</strong> button sets tempo, feel, strum pattern, and the band in one tap — every knob stays individually adjustable after. Some progressions also pin part of the band to fit their character (Cabbage locks in the driving boom-chick and alternating bass); knobs a progression doesn't pin keep your current settings. Strums: Folk is D-DU-UDU; Boom-chick picks the bass note on 1 and 3 and strums the top strings on 2 and 4 (old-time rhythm guitar); Bluegrass adds upstroke fills to the boom-chick; Lo-fi is sparse and lazy. Drums: Stomp (foot-tap), Kit (kick/snare/hats), Train (brushes with a backbeat); the Fills toggle throws a snare/tom run into every 4th bar, different each time Play builds the loop. Keys adds an upright piano comping block chords on each bar; Comp + Fills also sprinkles a chord-tone run into every 4th bar, new each time Play builds the loop (Lo-Fi presets this, Alt Country comps plain). Bass is an upright: Root, Root–5th, Walking (with chromatic approaches), or Boogie (the swung R-3-5-6 shuffle line). Shuffle swings the offbeat strums and hats onto the triplet grid (the blues preset selects it automatically). Lead improvises pentatonic notes drawn from each bar's triad position on the selected string set — Fills plays a run into every 4th bar, Solo noodles throughout; each press of Play writes a new solo, and it loops as played. The lead also rolls guitar articulations as it goes: bends into strong beats and fill endings, hammer-on/pull-off legato on quick close steps, and the occasional double stop. Saved progressions live in your browser.</p>
        <p className="mt-2">Sounds: guitar from the <a href="https://github.com/gleitz/midi-js-soundfonts" className="underline hover:text-gray-400">FatBoy SoundFont</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" className="underline hover:text-gray-400">CC BY-SA 3.0</a>); upright bass from <a href="https://github.com/sfzinstruments/karoryfer.meatbass" className="underline hover:text-gray-400">Meatbass</a> by Karoryfer Samples (CC0); drums from the <a href="https://archive.org/details/SalamanderDrumkit" className="underline hover:text-gray-400">Salamander Drumkit</a> by Alexander Holm (public domain); brushes from <a href="https://shop.karoryfer.com/pages/free-samples" className="underline hover:text-gray-400">Swirly Drums</a> by Karoryfer Samples (CC0); upright piano from the <a href="https://github.com/sgossner/VCSL" className="underline hover:text-gray-400">Versilian Community Sample Library</a> (CC0).</p>
      </div>
    </div>
    </div>
  );
}
