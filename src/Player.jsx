import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  NOTES, SCALE, DEGS, QS, QKEYS, STRING_SETS,
  getVoicings, closestVoicing, hasOpenString, firstPositionGrip,
} from './music.js';
import FretDiag, { GripDiag } from './FretDiag.jsx';
import { ensureCtx, ctxTime, preload, scheduleStrum, stopAll, voicingMidis, STRING_MIDI } from './audio.js';

const PRESETS = [
  { name:'12-Bar Blues', bars:[[0,'7'],[0,'7'],[0,'7'],[0,'7'],[3,'7'],[3,'7'],[0,'7'],[0,'7'],[4,'7'],[3,'7'],[0,'7'],[4,'7']] },
  { name:'Pop (I–V–vi–IV)', bars:[[0,'maj'],[4,'maj'],[5,'min'],[3,'maj'],[0,'maj'],[4,'maj'],[5,'min'],[3,'maj']] },
  { name:'50s (I–vi–IV–V)', bars:[[0,'maj'],[5,'min'],[3,'maj'],[4,'maj'],[0,'maj'],[5,'min'],[3,'maj'],[4,'maj']] },
  { name:'Folk (I–IV–I–V)', bars:[[0,'maj'],[3,'maj'],[0,'maj'],[4,'maj'],[0,'maj'],[3,'maj'],[4,'maj'],[0,'maj']] },
];
const toBars = preset => preset.bars.map(([deg,q])=>({deg,q}));

// Classic campfire pattern: D · D U · U D U (b = beat offset within a 4/4 bar).
const PATTERN = [
  { b:0,   dir:'down', g:1.0 },
  { b:1,   dir:'down', g:0.75 },
  { b:1.5, dir:'up',   g:0.4 },
  { b:2.5, dir:'up',   g:0.4 },
  { b:3,   dir:'down', g:0.75 },
  { b:3.5, dir:'up',   g:0.4 },
];

const STORE_KEY = 'mrtriad.savedProgressions';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY))||[]; } catch { return []; } };

function chordOf(bar,key) {
  const root=(key+SCALE[bar.deg])%12;
  return { root, quality:bar.q, name:NOTES[root]+QS[bar.q].s, numeral:DEGS[bar.deg].n+(bar.q==='7'?'7':'') };
}

export default function Player() {
  const [key,setKey]=useState(9); // A
  const [bars,setBars]=useState(()=>toBars(PRESETS[0]));
  const [tempo,setTempo]=useState(90);
  const [view,setView]=useState('cowboy');
  const [setKeySel,setSetKeySel]=useState('321');
  const [loop,setLoop]=useState(true);
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

  // What each bar sounds like in the current view.
  const barMidis=useMemo(()=>chords.map((ch,i)=>{
    if (view==='cowboy'&&grips[i]) {
      return [6,5,4,3,2,1].filter(s=>grips[i].frets[s]).map(s=>STRING_MIDI[s]+grips[i].frets[s].fret);
    }
    return triadPath[i]?voicingMidis(strs,triadPath[i].frets):[];
  }),[chords,view,grips,triadPath,strs]);

  const stop=useCallback(()=>{
    if (playRef.current) { clearInterval(playRef.current.timer); playRef.current=null; }
    stopAll();
    setPlaying(false);
    setCurrentBar(null);
  },[]);

  useEffect(()=>stop,[stop]); // unmount
  useEffect(()=>{ stop(); },[bars,key,view,setKeySel,tempo,stop]); // structural changes invalidate the schedule

  const start=()=>{
    if (playing) { stop(); return; }
    ensureCtx();
    const spb=60/tempo, barDur=4*spb, loopDur=bars.length*barDur;
    const events=bars.flatMap((_,i)=>PATTERN.map(p=>({t:i*barDur+p.b*spb,i,dir:p.dir,g:p.g})));
    preload(barMidis.flat()).then(()=>{
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
          if (barMidis[ev.i].length) scheduleStrum(barMidis[ev.i],t,{dir:ev.dir,gain:ev.g});
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

  const applyPreset=p=>{ setBars(toBars(p)); setEditIdx(null); };
  const setBar=(i,patch)=>setBars(bs=>bs.map((b,j)=>j===i?{...b,...patch}:b));
  const removeBar=i=>{ setBars(bs=>bs.filter((_,j)=>j!==i)); setEditIdx(null); };
  const insertBar=i=>{ setBars(bs=>[...bs.slice(0,i+1),{...bs[i]},...bs.slice(i+1)]); setEditIdx(i+1); };
  const addBar=()=>setBars(bs=>[...bs,bs.length?{...bs[bs.length-1]}:{deg:0,q:'maj'}]);

  const save=()=>{
    const name=saveName.trim();
    if (!name) return;
    const entry={name,key,tempo,bars};
    const next=[...saved.filter(s=>s.name!==name),entry];
    setSaved(next);
    localStorage.setItem(STORE_KEY,JSON.stringify(next));
  };
  const loadEntry=s=>{ setKey(s.key); setTempo(s.tempo); setBars(s.bars); setSaveName(s.name); setEditIdx(null); };
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
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Progression</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p=>(<button key={p.name} onClick={()=>applyPreset(p)} className="px-3 py-1.5 rounded text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all">{p.name}</button>))}
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
        <span className="text-xs text-gray-600">Strum: D · D U · U D U</span>
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
        <p><strong className="text-gray-500">How to use:</strong> Pick a key and a preset (or click any bar to edit its chord, and + to add bars). Cowboy chords shows the simplest first-position grip for each bar; Triads shows a voice-led triad path on your chosen string set — the same voicing logic as the Progressions page. Playback strums whichever view you're looking at. Saved progressions live in your browser.</p>
      </div>
    </div>
    </div>
  );
}
