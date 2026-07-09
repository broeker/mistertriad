import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  NOTES, SCALE, DEGS, QS, QKEYS, STRING_SETS, isMinorFamily,
  getVoicings, closestVoicing, hasOpenString, firstPositionGrip,
} from './music.js';
import FretDiag, { GripDiag } from './FretDiag.jsx';
import { ensureCtx, ctxTime, preload, scheduleStrum, scheduleBass, scheduleDrum, scheduleLead, stopAll, voicingMidis, STRING_MIDI } from './audio.js';

// Iconic progressions per genre ([degree, quality]; quality defaults to maj).
// Some appear under several genres — that's how music works.
const PROGRESSIONS = {
  blues: [
    { name:'12-Bar Blues', bars:[[0],[0],[0],[0],[3],[3],[0],[0],[4,'7'],[3],[0],[4,'7']] },
    { name:'12-Bar Shuffle (7ths)', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'Quick-Change 12-Bar', bars:[[0,'7'],[3,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
    { name:'8-Bar Blues (Highway)', bars:[[0,'7'],[4,'7'],[3,'7'],[3,'7'],[0,'7'],[4,'7'],[0,'7'],[4,'7']] },
    { name:'Minor Blues', bars:[[0,'min7'],[0,'min7'],[0,'min7'],[0,'min7'],[3,'min7'],[3,'min7'],[0,'min7'],[0,'min7'],[4,'7'],[3,'min7'],[0,'min7'],[4,'7']] },
  ],
  oldtime: [
    { name:'Cabbage (I–IV–I–V)', bars:[[0],[3],[0],[4],[0],[3],[4],[0]] },
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
  { key:'oldtime',   label:'Old-Time Country', tempo:100, feel:'straight', strum:'boomchick', drums:'train', bass:'root5',  lead:'off' },
  { key:'bluegrass', label:'Bluegrass',        tempo:145, feel:'straight', strum:'bluegrass', drums:'off',   bass:'walk',   lead:'fills' },
  { key:'blues',     label:'Blues',            tempo:84,  feel:'shuffle',  strum:'folk',      drums:'kit',   bass:'boogie', lead:'fills' },
  { key:'altcountry',label:'Alt Country',      tempo:95,  feel:'straight', strum:'folk',      drums:'kit',   bass:'root5',  lead:'off' },
  { key:'lofi',      label:'Lo-Fi',            tempo:72,  feel:'shuffle',  strum:'lofi',      drums:'kit',   bass:'root',   lead:'solo' },
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

const STORE_KEY = 'mrtriad.savedProgressions';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY))||[]; } catch { return []; } };

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
  const [bassMode,setBassMode]=useState(DEFAULT_GENRE.bass); // off | root | root5 | walk | boogie
  const [lead,setLead]=useState(DEFAULT_GENRE.lead);     // off | fills | solo
  const [genre,setGenre]=useState(DEFAULT_GENRE.key);
  const [playing,setPlaying]=useState(false);
  const [currentBar,setCurrentBar]=useState(null);
  const [editIdx,setEditIdx]=useState(null);
  const [saved,setSaved]=useState(loadSaved);
  const [saveName,setSaveName]=useState('');
  const playRef=useRef(null);
  const loopRef=useRef(loop);
  loopRef.current=loop;

  const chords=useMemo(()=>bars.map(b=>chordOf(b,key)),[bars,key]);

  // Cowboy view: first-position grip per bar (null for dim/aug).
  const grips=useMemo(()=>chords.map(ch=>firstPositionGrip(ch.root,ch.quality)),[chords]);

  // Triads view: voice-led path on the selected string set; repeated chords keep their voicing.
  const strs=STRING_SETS.find(s=>s.key===setKeySel).strs;
  const triadPath=useMemo(()=>{
    const path=[];
    for (let i=0;i<chords.length;i++) {
      const ch=chords[i];
      if (i>0&&chords[i-1].root===ch.root&&chords[i-1].quality===ch.quality) { path.push(path[i-1]); continue; }
      const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
      const vs=getVoicings(nts,ch.root,strs);
      if (!vs.length) { path.push(null); continue; }
      const prev=i>0?path[i-1]:null;
      path.push(prev?closestVoicing(vs,prev.frets):(vs.find(v=>!hasOpenString(v.frets))||vs[0]));
    }
    return path;
  },[chords,strs]);

  // What the guitar channel plays per bar — independent of the displayed view.
  const barMidis=useMemo(()=>chords.map((ch,i)=>{
    if (sound==='off') return [];
    if (sound==='cowboy'&&grips[i]) {
      return [6,5,4,3,2,1].filter(s=>grips[i].frets[s]).map(s=>STRING_MIDI[s]+grips[i].frets[s].fret);
    }
    return triadPath[i]?voicingMidis(strs,triadPath[i].frets):[];
  }),[chords,sound,grips,triadPath,strs]);

  const stop=useCallback(()=>{
    if (playRef.current) { clearInterval(playRef.current.timer); playRef.current=null; }
    stopAll();
    setPlaying(false);
    setCurrentBar(null);
  },[]);

  useEffect(()=>stop,[stop]); // unmount
  useEffect(()=>{ stop(); },[bars,key,setKeySel,tempo,sound,strum,drums,bassMode,lead,feel,stop]); // structural changes invalidate the schedule

  const applyGenre=g=>{
    setGenre(g.key); setTempo(g.tempo); setFeel(g.feel); setStrum(g.strum);
    setDrums(g.drums); setBassMode(g.bass); setLead(g.lead);
    setBars(toBars(PROGRESSIONS[g.key][0].bars)); setEditIdx(null);
  };

  const start=()=>{
    if (playing) { stop(); return; }
    ensureCtx();
    const spb=60/tempo, barDur=4*spb, loopDur=bars.length*barDur;
    // Shuffle: offbeat eighths land on the triplet 2/3 instead of halfway.
    const sw=feel==='shuffle'?(b=>Math.floor(b)+(b%1?2/3:0)):(b=>b);
    const events=[];
    const bassMidis=[],leadMidis=[];
    let leadLast=null; // walker carries across bars so lines connect through chord changes
    bars.forEach((_,i)=>{
      const base=i*barDur;
      STRUMS[strum].p.forEach(p=>events.push({t:base+sw(p.b)*spb,type:'strum',i,dir:p.dir,g:p.g,span:p.span}));
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
      if (lead!=='off'&&triadPath[i]) {
        const pool=leadPool(chords[i],triadPath[i],strs);
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
              leadLast=pool[idx];
              leadMidis.push(leadLast);
              events.push({t:base+sw(b)*spb+(Math.random()-0.5)*0.014,type:'lead',m:leadLast,g:b%1?0.5:0.62});
            }
          } else if ((i+1)%4===0) { // fills: a directed run into every 4th bar
            const dir=Math.random()<0.5?1:-1;
            let idx=leadLast!==null?nearest(leadLast):Math.floor(pool.length*(dir===1?0.3:0.7));
            for (const b of [2,2.5,3,3.5]) {
              idx=Math.max(0,Math.min(pool.length-1,idx+dir));
              leadLast=pool[idx];
              leadMidis.push(leadLast);
              events.push({t:base+sw(b)*spb+(Math.random()-0.5)*0.014,type:'lead',m:leadLast,g:b%1?0.52:0.62});
            }
          }
        }
      }
    });
    events.sort((a,b)=>a.t-b.t);
    Promise.all([preload([...barMidis.flat(),...leadMidis]),preload(bassMidis,'bass')]).then(()=>{
      const t0=ctxTime()+0.12;
      const st={t0,nextIdx:0,events,loopDur,barDur};
      st.timer=setInterval(()=>{
        const now=ctxTime();
        while (true) {
          const loopN=Math.floor(st.nextIdx/st.events.length);
          if (!loopRef.current&&loopN>=1) break;
          const ev=st.events[st.nextIdx%st.events.length];
          const t=st.t0+loopN*st.loopDur+ev.t;
          if (t>now+0.25) break;
          if (ev.type==='strum') { if (barMidis[ev.i].length) scheduleStrum(barMidis[ev.i],t,{dir:ev.dir,gain:ev.g,span:ev.span}); }
          else if (ev.type==='drum') scheduleDrum(ev.kind,t,ev.g);
          else if (ev.type==='bass') scheduleBass(ev.m,t,ev.g);
          else if (ev.type==='lead') scheduleLead(ev.m,t,ev.g);
          st.nextIdx++;
        }
        const pos=now-st.t0;
        if (pos>=0) {
          if (!loopRef.current&&pos>=st.loopDur) { stop(); return; }
          setCurrentBar(Math.floor((pos%st.loopDur)/st.barDur));
        }
      },50);
      playRef.current=st;
      setPlaying(true);
    });
  };

  const applyProgression=p=>{ setBars(toBars(p.bars)); setEditIdx(null); };
  const setBar=(i,patch)=>setBars(bs=>bs.map((b,j)=>j===i?{...b,...patch}:b));
  const removeBar=i=>{ setBars(bs=>bs.filter((_,j)=>j!==i)); setEditIdx(null); };
  const insertBar=i=>{ setBars(bs=>[...bs.slice(0,i+1),{...bs[i]},...bs.slice(i+1)]); setEditIdx(i+1); };
  const addBar=()=>setBars(bs=>[...bs,bs.length?{...bs[bs.length-1]}:{deg:0,q:'maj'}]);

  const save=()=>{
    const name=saveName.trim();
    if (!name) return;
    const entry={name,key,tempo,bars,feel,strum,drums,bassMode,lead,genre};
    const next=[...saved.filter(s=>s.name!==name),entry];
    setSaved(next);
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
  };
  const loadEntry=s=>{
    setKey(s.key); setTempo(s.tempo); setBars(s.bars); setFeel(s.feel||'straight');
    setStrum(s.strum&&STRUMS[s.strum]?s.strum:'folk'); setDrums(s.drums||'off'); setBassMode(s.bassMode||'off'); setLead(s.lead||'off');
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

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Genre <span className="normal-case text-gray-600">(sets tempo, feel, strum &amp; band)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map(g=>(<button key={g.key} onClick={()=>applyGenre(g)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${genre===g.key?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{g.label}</button>))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Iconic Progressions <span className="normal-case text-gray-600">({GENRES.find(g=>g.key===genre)?.label})</span></label>
          <div className="flex flex-wrap gap-1.5">
            {(PROGRESSIONS[genre]||[]).map(p=>(<button key={p.name} onClick={()=>applyProgression(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${barsKey(bars)===barsKey(toBars(p.bars))?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{p.name}</button>))}
          </div>
        </div>
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
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Bass</span>
          {[['off','Off'],['root','Root'],['root5','Root–5th'],['walk','Walking'],['boogie','Boogie']].map(([k,l])=>(
            <button key={k} onClick={()=>setBassMode(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${bassMode===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Lead</span>
          {[['off','Off'],['fills','Fills'],['solo','Solo']].map(([k,l])=>(
            <button key={k} onClick={()=>setLead(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${lead===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
        <div className="flex flex-wrap gap-2">
          {bars.map((bar,i)=>{
            const ch=chords[i];
            const isCur=currentBar===i,isEdit=editIdx===i;
            return (
              <div key={i} onClick={()=>setEditIdx(isEdit?null:i)}
                   className={`cursor-pointer rounded-lg border px-2 pt-1.5 pb-2 flex flex-col items-center transition-all min-w-[110px] ${isCur?'border-amber-500 bg-amber-500/10':isEdit?'border-emerald-500 bg-emerald-500/10':'border-gray-800 bg-gray-950 hover:border-gray-600'}`}>
                <div className="text-[10px] text-gray-600 self-start">bar {i+1}</div>
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
        <p><strong className="text-gray-500">How to use:</strong> Pick a genre, then one of its iconic progressions — or click any bar to edit its chord, and + to add bars. Switching genre loads that genre's first progression along with its sound — pick another from the list or edit the bars from there. Cowboy chords shows the simplest first-position grip for each bar; Triads shows a voice-led triad path on your chosen string set — the same voicing logic as the Progressions page. The <strong>View</strong> and the <strong>Guitar</strong> sound are independent, and you can switch views while it plays: watch the triads while the guitar strums cowboy chords to follow along, set Guitar to Triads to hear what the triads should sound like, or mute it and play the triads yourself over the rhythm section. A <strong>Genre</strong> button sets tempo, feel, strum pattern, and the band in one tap — every knob stays individually adjustable after. Strums: Folk is D-DU-UDU; Boom-chick picks the bass note on 1 and 3 and strums the top strings on 2 and 4 (old-time rhythm guitar); Bluegrass adds upstroke fills to the boom-chick; Lo-fi is sparse and lazy. Drums: Stomp (foot-tap), Kit (kick/snare/hats), Train (brushes with a backbeat). Bass is an upright: Root, Root–5th, Walking (with chromatic approaches), or Boogie (the swung R-3-5-6 shuffle line). Shuffle swings the offbeat strums and hats onto the triplet grid (the blues preset selects it automatically). Lead improvises pentatonic notes drawn from each bar's triad position on the selected string set — Fills plays a run into every 4th bar, Solo noodles throughout; each press of Play writes a new solo, and it loops as played. Saved progressions live in your browser.</p>
      </div>
    </div>
    </div>
  );
}
