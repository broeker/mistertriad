import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  NOTES, DEGS, QS, QKEYS, STRING_SETS,
  getVoicings, closestVoicing, hasOpenString, firstPositionGrip,
  matchCAGEDZone,
} from './music.js';
import FretDiag, { GripDiag } from './FretDiag.jsx';
import { ensureCtx, ctxTime, preload, preloadDrums, setMix, scheduleStrum, scheduleBass, scheduleDrum, scheduleLead, schedulePiano, scheduleBackup, stopAll, cancelPending, AUDIO_DEFAULTS, setAudioSettings, setGuitarSet as applyGuitarSet, setBassSet as applyBassSet, setPianoSet as applyPianoSet, setBackupSet as applyBackupSet } from './audio.js';
import {
  PROGRESSIONS, toBars, barsKey, FEATURED, progSummary,
  METERS, METER_KEYS, STRUMS, GFILL_STRUMS, DRUM_PATTERNS, BASS_METERS,
  GENRE_GROUPS, GENRES, DEFAULT_SETS, SECTION_IDS, SECTION_LABELS, SECTION_IDEAS,
  chordOf, DEFAULT_GENRE, DEFAULT_PROG, DEFAULT_SET,
} from './styles.js';
import { buildSchedule as buildScheduleFn, centerOf, posCost, pinKeyOf } from './arranger.js';
import { usePersistentState } from './hooks.js';

// Preload every sample a schedule needs, routed to its instrument channel.
const preloadSchedule = sc => Promise.all([
  preload([...sc.guitarMidis.flat(),...sc.gfillMidis,...sc.leadMidis]),
  preload(sc.bassMidis,'bass'),
  preload(sc.pianoMidis,'piano'),
  preload(sc.backupMidis,'backup'),
  preloadDrums(),
]);

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

export default function Player() {
  const [key,setKey]=useState(7); // G
  const [sections,setSections]=useState(()=>({A:toBars(DEFAULT_PROG.bars),B:[],C:[]}));
  const [arrangement,setArrangement]=useState(['A']);
  const [activeSec,setActiveSec]=useState('A');
  const bars=sections[activeSec]; // the section being edited/displayed
  const setSectionBars=(sec,upd)=>setSections(s=>({...s,[sec]:typeof upd==='function'?upd(s[sec]):upd}));
  const setBars=upd=>setSectionBars(activeSec,upd);
  const [tempo,setTempo]=useState(DEFAULT_SET.tempo);
  const [meter,setMeter]=useState(DEFAULT_SET.meter||'4/4');
  const [view,setView]=useState('cowboy');
  const [selectedSets,setSelectedSets]=useState(()=>{
    try { const s=JSON.parse(localStorage.getItem('mrtriad.selectedSets')); if (Array.isArray(s)&&s.some(k=>STRING_SETS.some(x=>x.key===k))) return STRING_SETS.filter(x=>s.includes(x.key)).map(x=>x.key); } catch { /* fall through */ }
    return DEFAULT_SETS;
  });
  const [loop,setLoop]=useState(true);
  const [feel,setFeel]=useState(DEFAULT_SET.feel);
  const [sound,setSound]=useState('cowboy'); // guitar channel: cowboy | triads | off
  const [strum,setStrum]=useState(DEFAULT_SET.strum);
  const [drums,setDrums]=useState(DEFAULT_SET.drums);   // off | stomp | kit | train
  const [drumFills,setDrumFills]=useState(DEFAULT_SET.drumFills);
  const [bassMode,setBassMode]=useState(DEFAULT_SET.bass); // off | root | root5 | walk | boogie
  const [bassFills,setBassFills]=useState(!!DEFAULT_SET.bassFills); // walkups into chord changes (root/root5 only)
  const [guitarFills,setGuitarFills]=useState(!!DEFAULT_SET.guitarFills); // bass-run walkups into chord changes (country rhythm guitar)
  const [backup,setBackup]=useState(DEFAULT_SET.backup||'off'); // off | roll | chop — second rhythm instrument
  const [lead,setLead]=useState(DEFAULT_SET.lead);     // off | fills | solo
  const [leadEvery,setLeadEvery]=useState(DEFAULT_SET.leadEvery||4); // fills cadence: a run every N bars
  const [keys,setKeys]=useState(DEFAULT_SET.keys);     // off | on — upright piano comping
  const [genre,setGenre]=useState(DEFAULT_GENRE.key);
  const [genreTab,setGenreTab]=useState(DEFAULT_GENRE.group); // browsed group tab
  const [playing,setPlaying]=useState(false);
  const [currentBar,setCurrentBar]=useState(null);
  const [editIdx,setEditIdx]=useState(null);
  const [saved,setSaved]=usePersistentState('mrtriad.savedProgressions',[]);
  const [saveName,setSaveName]=useState('');
  const [moreOpen,setMoreOpen]=useState(false);
  const [mixer,setMixer]=useState(loadMixer);
  const [showMixer,setShowMixer]=useState(false);
  const [practice,setPractice]=useState(false); // charts-only performance view
  const [pickIdx,setPickIdx]=useState(null); // bar whose voicing-picker popover is open (triads view)
  const [suggestOpen,setSuggestOpen]=useState(false); // chorus/bridge suggestions for the empty active section
  const [bandOpen,setBandOpen]=useState(false); // band chip rows are override detail; genre sets them all
  const [songOpen,setSongOpen]=useState(true); // open by default — it's the session's entry point
  const [guitarSet,setGuitarSet]=usePersistentState('mrtriad.guitarSet',DEFAULT_GENRE.guitarInst||'fatboy',{raw:true});
  const [bassSet,setBassSet]=usePersistentState('mrtriad.bassSet',DEFAULT_GENRE.bassInst||'upright',{raw:true});
  const [pianoSet,setPianoSet]=usePersistentState('mrtriad.pianoSet',DEFAULT_GENRE.pianoInst||'vcsl',{raw:true});
  const [backupSet,setBackupSet]=usePersistentState('mrtriad.backupSet','banjo',{raw:true});
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
  const [posMode,setPosMode]=useState('climb'); // climb: each pass moves position | manual | vary: each pass rotates bar 1's same-position shape
  const [posSel,setPosSel]=useState([]); // climb subset (position indices); empty = all
  const [livePass,setLivePass]=useState(0);
  const [pins,setPins]=useState({});
  // More than one set active → cross-set voice-leading (the window-based
  // posCost engine, formerly "Auto"); a single set stays put (closestVoicing).
  const multi=selectedSets.length>1;
  useEffect(()=>{ localStorage.setItem('mrtriad.selectedSets',JSON.stringify(selectedSets)); },[selectedSets]);
  const toggleSet=useCallback(k=>setSelectedSets(cur=>{
    const next=cur.includes(k)?cur.filter(x=>x!==k):[...cur,k];
    return next.length?STRING_SETS.filter(s=>next.includes(s.key)).map(s=>s.key):cur; // keep canonical order; never empty
  }),[]);

  // Every voicing for a chord in the current search space, tagged with its set.
  const candidatesFor=useCallback(ch=>{
    const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
    const sets=STRING_SETS.filter(s=>selectedSets.includes(s.key));
    const out=[];
    for (const set of sets) for (const v of getVoicings(nts,ch.root,set.strs)) out.push({...v,set});
    return out.sort((a,b)=>centerOf(a)-centerOf(b));
  },[selectedSets]);

  // Selectable anchor positions for bar 1, low to high. In Auto, voicings from
  // different sets that share a fret window collapse into one position.
  const anchorsFrom=useCallback(cands=>{
    const closed=cands.filter(v=>!hasOpenString(v.frets));
    const list=closed.length?closed:cands;
    if (!multi) return list;
    const out=[];
    for (const v of list) if (!out.length||centerOf(v)-centerOf(out[out.length-1])>=2) out.push(v);
    return out;
  },[multi]);

  const positions=useMemo(()=>chords.length?anchorsFrom(candidatesFor(chords[0])):[],[chords,candidatesFor,anchorsFrom]);
  const pi=Math.min(posIdx,Math.max(0,positions.length-1));

  const pathForAnchor=useCallback((anchor,startV)=>{
    const path=[];
    let win=null; // the pass's fret window (auto mode); a pin moves it — that's a transition point
    for (let i=0;i<chords.length;i++) {
      const ch=chords[i];
      const cands=candidatesFor(ch);
      if (!cands.length) { path.push(null); continue; }
      const m=flat.map[i];
      // Pins are keyed per (section:bar:position) in climb/manual, so each
      // position remembers its own picks; vary keeps a single per-bar pin. A
      // bare section:bar key (legacy saves, or a vary pin) applies as a fallback
      // across every position.
      const pos=posMode==='vary'?null:anchor;
      const pin=!m?null:(pos==null?(pins[`${m.sec}:${m.j}`]??null)
                                  :(pins[`${m.sec}:${m.j}:${pos}`]??pins[`${m.sec}:${m.j}`]??null));
      const pinned=pin!=null?cands.find(v=>pinKeyOf(v)===pin):null;
      if (pinned) { path.push(pinned); win=centerOf(pinned); continue; }
      if (i>0&&chords[i-1].root===ch.root&&chords[i-1].quality===ch.quality&&path[i-1]) { path.push(path[i-1]); continue; }
      if (i===0) {
        if (startV) { path.push(startV); win=centerOf(startV); continue; } // vary mode hands bar 1 a specific shape
        const list=anchorsFrom(cands);
        const v=list[Math.min(anchor,list.length-1)];
        path.push(v); win=centerOf(v);
        continue;
      }
      const prev=path[i-1];
      if (!prev) { path.push(cands.find(v=>!hasOpenString(v.frets))||cands[0]); continue; }
      if (multi) {
        let best=null,bs=Infinity;
        for (const v of cands){const c=posCost(v,prev,win);if(c<bs){bs=c;best=v;}}
        path.push(best);
      } else {
        path.push(closestVoicing(cands,prev.frets));
      }
    }
    return path;
  },[chords,flat,candidatesFor,anchorsFrom,pins,multi,posMode]);

  // Vary mode: bar 1's same-position shapes (the picker's ±3-fret rule); each
  // pass starts on the next one and re-leads the whole path from it. Rotation
  // begins at the position's default shape, so pass 1 matches the usual path.
  const variants=useMemo(()=>{
    if (posMode!=='vary'||!chords.length||!positions.length) return [];
    const home=positions[Math.min(pi,positions.length-1)];
    const near=candidatesFor(chords[0]).filter(v=>!hasOpenString(v.frets))
      .filter(v=>Math.abs(centerOf(v)-centerOf(home))<=3);
    const i0=near.findIndex(v=>pinKeyOf(v)===pinKeyOf(home));
    return i0>0?[...near.slice(i0),...near.slice(0,i0)]:near;
  },[posMode,chords,positions,pi,candidatesFor]);

  // A pass's path: climb/manual passes carry a position index, vary passes an
  // index into the same-position shapes above.
  const passPath=useCallback(p=>posMode==='vary'?pathForAnchor(pi,variants[p]):pathForAnchor(p),[posMode,pathForAnchor,pi,variants]);

  // Climb order: up through the selected positions, then back down (ping-pong).
  // Vary order: one pass per same-position shape, in rotation.
  const passOrder=useMemo(()=>{
    if (posMode==='vary') return variants.length?variants.map((_,k)=>k):[0];
    const P=positions.length;
    if (posMode!=='climb'||P<2) return [pi];
    const sel=posSel.filter(i=>i<P).sort((a,b)=>a-b);
    const L=sel.length?sel:[...Array(P).keys()];
    if (L.length===1) return L;
    return [...L,...L.slice(1,-1).reverse()];
  },[posMode,variants,positions.length,pi,posSel]);

  // What the grid shows: the playing pass's position while climbing (or its
  // shape while varying), else the manual pick.
  const displayAnchor=posMode==='climb'&&playing?passOrder[Math.min(livePass,passOrder.length-1)]:pi;
  const displayVariant=posMode==='vary'?(playing?Math.min(livePass,passOrder.length-1):0):null;
  const triadPath=useMemo(()=>posMode==='vary'?passPath(displayVariant):pathForAnchor(displayAnchor),[posMode,passPath,displayVariant,pathForAnchor,displayAnchor]);

  // Where the climb (or vary rotation) goes next — feeds the "next loop" card
  // at the end of the grid (visible throughout the pass, pulsing during its final bar).
  const upNext=useMemo(()=>{
    if (!playing||(posMode!=='climb'&&posMode!=='vary')||passOrder.length<2||!flat.playLen) return null;
    const lp=Math.min(livePass,passOrder.length-1);
    if (!loop&&lp===passOrder.length-1) return null; // journey ends here
    const na=passOrder[(lp+1)%passOrder.length];
    return {anchor:na,path:passPath(na)};
  },[playing,posMode,passOrder,flat.playLen,livePass,loop,passPath]);
  const climbPulse=!!upNext&&flat.playLen>1&&currentBar===flat.playLen-1;

  // Pin key/value for the bar as shown in the currently displayed position.
  // climb/manual scope pins to that position (displayAnchor); vary keeps one
  // per-bar pin. barPinVal falls back to a bare per-bar pin (legacy / vary).
  const barPinKey=i=>posMode==='vary'?`${activeSec}:${i}`:`${activeSec}:${i}:${displayAnchor}`;
  const barPinVal=i=>posMode==='vary'?pins[`${activeSec}:${i}`]:(pins[barPinKey(i)]??pins[`${activeSec}:${i}`]);

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
  const posSet=multi?triadPath[0]?.set:null; // colored set token for the Position readout

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
  useEffect(()=>{ applyGuitarSet(guitarSet); },[guitarSet]);
  useEffect(()=>{ applyBassSet(bassSet); },[bassSet]);
  useEffect(()=>{ applyPianoSet(pianoSet); },[pianoSet]);
  useEffect(()=>{ applyBackupSet(backupSet); },[backupSet]);
  // The initial style's baked mix — applyGenre/applySetOverrides cover every later change.
  useEffect(()=>{ setMix(DEFAULT_SET.mix); },[]);

  // Keep the screen awake while playing or in practice mode (tablet on a music
  // stand). The lock drops whenever the tab is hidden, so re-acquire on return.
  const wakeRef=useRef(null);
  useEffect(()=>{
    if (!(playing||practice)||!('wakeLock' in navigator)) return;
    let on=true;
    const acquire=()=>navigator.wakeLock.request('screen').then(l=>{ if (!on) l.release(); else wakeRef.current=l; }).catch(()=>{});
    acquire();
    const revis=()=>{ if (document.visibilityState==='visible') acquire(); };
    document.addEventListener('visibilitychange',revis);
    return ()=>{ on=false; document.removeEventListener('visibilitychange',revis); wakeRef.current?.release().catch(()=>{}); wakeRef.current=null; };
  },[playing,practice]);

  const toggleFullscreen=()=>{
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(()=>{});
  };

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
    setBassFills(!!g.bassFills); setGuitarFills(!!g.guitarFills); setLeadEvery(g.leadEvery||4); setBackup(g.backup||'off');
    setDrums(g.drums); setBassMode(g.bass); setLead(g.lead); setDrumFills(g.drumFills); setKeys(g.keys);
    setBassSet(g.bassInst||'upright');
    setGuitarSet(g.guitarInst||'fatboy');
    setPianoSet(g.pianoInst||'vcsl');
    setBackupSet(g.backupInst||'banjo');
    // A genre starts a fresh single-section song.
    const first=PROGRESSIONS[g.key][0];
    setSections({A:toBars(first.bars),B:[],C:[]});
    setArrangement(['A']); setActiveSec('A');
    setEditIdx(null); setPickIdx(null); setMoreOpen(false); setPins({}); setPosIdx(0); setPosSel([]);
    applySetOverrides(first,g);
  };

  // Switching genre tabs resets to that genre's first style (and its first
  // progression) rather than just browsing — re-clicking the current tab is a no-op.
  const applyGenreTab=gr=>{
    if (gr===genreTab) return;
    applyGenre(GENRES.find(g=>g.group===gr));
  };

  // Start a fresh one-bar song (on the I chord) to build from scratch — keeps
  // the current sound (band, tempo, meter, genre, sample sets all untouched).
  const createNew=()=>{
    setSections({A:[{deg:0,q:'maj'}],B:[],C:[]});
    setArrangement(['A']); setActiveSec('A');
    setEditIdx(0); setPickIdx(null); setMoreOpen(false); setPins({}); setPosIdx(0); setPosSel([]);
  };

  // The full loop as a flat event list — a pure function of the current settings.
  // Playback walks whatever schedule sits in playRef; rebuilding and swapping it
  // mid-play (effect below start) is how settings change without stopping.
  const buildSchedule=useCallback(()=>buildScheduleFn({
    flat,chords,meter,tempo,feel,strum,drums,drumFills,bassMode,bassFills,guitarFills,backup,lead,leadEvery,keys,passOrder,passPath,grips,sound,
  // guitarSet/bassSet/pianoSet/backupSet are deps so switching sample sets re-preloads and hot-swaps mid-play.
  }),[flat,chords,meter,tempo,feel,strum,drums,drumFills,bassMode,bassFills,guitarFills,backup,lead,leadEvery,keys,passOrder,passPath,grips,sound,guitarSet,bassSet,pianoSet,backupSet]);

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
      else if (ev.type==='gfill') scheduleStrum([ev.m],t,{gain:ev.g,span:'bass'});
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
    preloadSchedule(sc).then(()=>{
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
    preloadSchedule(sc).then(()=>{
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
    if (s.guitarFills!=null) setGuitarFills(s.guitarFills);
    if (s.backup) setBackup(s.backup);
    if (s.lead) setLead(s.lead);
    if (s.leadEvery) setLeadEvery(s.leadEvery);
    if (s.keys) setKeys(s.keys);
    // Channel balance: progression pin wins, else the style's baked mix,
    // else reset. Multipliers on top of the mixer's tuned volumes.
    setMix(s.mix??(g||GENRES.find(x=>x.key===genre))?.mix);
  };

  // Fills the active (empty) section with a suggested chorus/bridge.
  const applyIdea=p=>{
    setSectionBars(activeSec,toBars(p.bars));
    setPins(ps=>Object.fromEntries(Object.entries(ps).filter(([k])=>!k.startsWith(activeSec+':'))));
    setSuggestOpen(false); setPosIdx(0); setPosSel([]);
  };

  // Fills the active section (build a chorus by switching tabs and picking again).
  const applyProgression=p=>{
    setSectionBars(activeSec,toBars(p.bars));
    setEditIdx(null); setPickIdx(null); setMoreOpen(false); setPosIdx(0); setPosSel([]);
    setPins(ps=>Object.fromEntries(Object.entries(ps).filter(([k])=>!k.startsWith(activeSec+':'))));
    applySetOverrides(p);
  };
  // Pins are keyed "section:barIndex" or "section:barIndex:position"; structural
  // edits re-home the active section's pins (preserving any position suffix) and
  // leave other sections' alone.
  const remapPins=fn=>setPins(ps=>{
    const n={};
    for (const [k,v] of Object.entries(ps)) {
      const [sec,jStr,...rest]=k.split(':'), j=+jStr;
      if (sec!==activeSec) { n[k]=v; continue; }
      const nj=fn(j);
      if (nj!=null) n[[sec,nj,...rest].join(':')]=v;
    }
    return n;
  });
  const setBar=(i,patch)=>{
    setBars(bs=>bs.map((b,j)=>j===i?{...b,...patch}:b));
    remapPins(j=>j===i?null:j); // a different chord invalidates the pinned voicing
  };
  const removeBar=i=>{
    setBars(bs=>bs.filter((_,j)=>j!==i)); setEditIdx(null); setPickIdx(null);
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
    const entry={name,key,meter,tempo,sections,arrangement,pins,feel,strum,drums,drumFills,bassMode,bassFills,guitarFills,backup,lead,leadEvery,keys,genre};
    setSaved([...saved.filter(s=>s.name!==name),entry]);
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
    setGuitarFills(!!s.guitarFills);
    setBackup(['roll','chop'].includes(s.backup)?s.backup:'off');
    setLead(s.lead||'off'); setLeadEvery([2,4,8].includes(s.leadEvery)?s.leadEvery:4);
    setKeys(s.keys||'off');
    const gk=s.genre&&PROGRESSIONS[s.genre]?s.genre:DEFAULT_GENRE.key;
    setGenre(gk);
    const ge=GENRES.find(g=>g.key===gk);
    setGenreTab(ge?.group||DEFAULT_GENRE.group);
    setMix(ge?.mix); // saved entries don't store mix; use the style's baked one
    setSaveName(s.name); setEditIdx(null); setPickIdx(null);
  };
  const deleteEntry=name=>setSaved(saved.filter(s=>s.name!==name));

  const btn=(on)=>`px-3 py-1.5 rounded text-sm font-medium transition-all ${on?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
    <div className="max-w-4xl mx-auto p-4">
      {!practice&&(<>
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

      <div className="mt-4 mb-4 bg-gray-900/50 rounded-xl border border-gray-800">
      <button onClick={()=>setSongOpen(o=>!o)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
        <span className="text-xs text-gray-500 uppercase tracking-wide font-bold">Song</span>
        {!songOpen&&<span className="text-xs text-gray-600 truncate">{NOTES[key]} · {GENRES.find(g=>g.key===genre)?.label} · {(PROGRESSIONS[genre]||[]).find(p=>barsKey(bars)===barsKey(toBars(p.bars)))?.name||`${bars.length} bars`}</span>}
        <span className="ml-auto text-xs text-gray-500">{songOpen?'▲':'▼'}</span>
      </button>
      {songOpen&&(<div className="px-4 pb-1">
      <div className="mb-4">
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
            <button onClick={createNew} title="Start a fresh progression from scratch — keeps your current sound" className="px-3 py-1.5 rounded text-sm font-medium border border-dashed border-emerald-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500 transition-all">
              ＋ New
            </button>
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
      </div>)}
      </div>

      <div className="mb-4 bg-gray-900/50 rounded-xl border border-gray-800">
        <button onClick={()=>setBandOpen(o=>!o)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-bold">Band</span>
          {!bandOpen&&<span className="text-xs text-gray-600 truncate">{[METERS[meter].label,feel==='shuffle'?'shuffle':'straight',STRUMS[strum].label.toLowerCase(),drums==='off'?null:`drums: ${drums}`,bassMode==='off'?null:`bass: ${bassMode}`,backup==='off'?null:`banjo: ${backup}`,keys==='off'?null:'keys',lead==='off'?null:`lead: ${lead}`].filter(Boolean).join(' · ')}</span>}
          <span className="ml-auto text-xs text-gray-500">{bandOpen?'▲':'▼'}</span>
        </button>
        {bandOpen&&(
        <div className="px-4 pb-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
        <div className="rounded-lg border border-gray-800 p-2 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Guitar</span>
          {[['off','Off'],['cowboy','Cowboy'],['triads','Triads']].map(([k,l])=>(
            <button key={k} onClick={()=>setSound(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${sound===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          <button onClick={()=>setGuitarFills(f=>!f)} disabled={sound==='off'||!GFILL_STRUMS.includes(strum)} title="Walk a bass run into the next chord whenever it changes — the country rhythm-guitar move"
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${guitarFills?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'} disabled:opacity-40 disabled:cursor-not-allowed`}>Fills</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Strum</span>
          {Object.entries(STRUMS).filter(([,s])=>s.p[meter]).map(([k,s])=>(
            <button key={k} onClick={()=>setStrum(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${strum===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>
          ))}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-gray-800 p-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Drums</span>
          {[['off','Off'],['stomp','Stomp'],['kit','Kit'],['train','Train'],['bossa','Bossa'],['swing','Swing'],['funk','Funk']].filter(([k])=>k==='off'||DRUM_PATTERNS[k][meter]).map(([k,l])=>(
            <button key={k} onClick={()=>setDrums(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${drums===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          <button onClick={()=>setDrumFills(f=>!f)} disabled={['off','stomp'].includes(drums)} className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${drumFills?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'} disabled:opacity-40 disabled:cursor-not-allowed`}>Fills</button>
        </div>
        <div className="rounded-lg border border-gray-800 p-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Bass</span>
          {[['off','Off'],['root','Root'],['root5','Root–5th'],['walk','Walking'],['boogie','Boogie'],['bossa','Bossa'],['funk','Funk']].filter(([k])=>k==='off'||BASS_METERS[k].includes(meter)).map(([k,l])=>(
            <button key={k} onClick={()=>setBassMode(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${bassMode===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          <button onClick={()=>setBassFills(f=>!f)} disabled={!['root','root5'].includes(bassMode)} title="Walk up (or down) into the next chord whenever it changes"
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${bassFills?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'} disabled:opacity-40 disabled:cursor-not-allowed`}>Fills</button>
        </div>
        <div className="rounded-lg border border-gray-800 p-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Backup</span>
          {[['off','Off'],['roll','Roll'],['chop','Chop']].map(([k,l])=>(
            <button key={k} onClick={()=>setBackup(k)} title={k==='roll'?'Banjo rolls over each bar’s chord':k==='chop'?'Muted backbeat stabs':undefined}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${backup===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
        </div>
        <div className="rounded-lg border border-gray-800 p-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Keys</span>
          {[['off','Off'],['on','Comp']].map(([k,l])=>{
            const active=k==='off'?keys==='off':keys!=='off'; // Comp lights for both comp modes
            return <button key={k} onClick={()=>setKeys(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${active?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>;
          })}
          <button onClick={()=>setKeys(keys==='fills'?'on':'fills')} disabled={keys==='off'} title="Sprinkle a chord-tone run into every 4th bar — new each time Play builds the loop"
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${keys==='fills'?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'} disabled:opacity-40 disabled:cursor-not-allowed`}>Fills</button>
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-gray-800 p-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Lead</span>
          {[['off','Off'],['fills','Fills'],['solo','Solo']].map(([k,l])=>(
            <button key={k} onClick={()=>setLead(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${lead===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
          ))}
          {lead==='fills'&&[[8,'/8'],[4,'/4'],[2,'/2']].map(([n,l])=>(
            <button key={n} onClick={()=>setLeadEvery(n)} title={`A run every ${n} bars`}
              className={`px-2 py-1 rounded text-xs font-medium border transition-all ${leadEvery===n?'border-amber-500 text-amber-400':'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>{l}</button>
          ))}
        </div>
        </div>
        <button onClick={()=>setShowMixer(o=>!o)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${showMixer?'border-amber-500/60 bg-amber-500/5':'border-gray-700 hover:border-gray-500'}`}>
          <span className={`text-xs uppercase tracking-wide font-bold ${showMixer?'text-amber-400':'text-gray-400'}`}>Mixer</span>
          <span className="text-xs text-gray-600">volumes, reverb, EQ &amp; sample sets per instrument</span>
          <span className={`ml-auto text-xs ${showMixer?'text-amber-400':'text-gray-500'}`}>{showMixer?'▲':'▼'}</span>
        </button>
        </div>
        )}

        {bandOpen&&showMixer&&(
        <div className="mx-4 mb-3 bg-gray-950 rounded-lg border border-gray-800 p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
            <MixSlider label="Master" min={0} max={1.5} step={0.05} value={mixer.master} onChange={v=>updMixer('master',null,v)}/>
            <button onClick={()=>navigator.clipboard?.writeText(JSON.stringify(mixer,null,2))} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">Copy settings</button>
            <button title="Copy the full tuned state — style, band knobs, sample sets, and mixer — as one JSON blob, ready to paste to Claude to bake in as that style's defaults."
              onClick={()=>navigator.clipboard?.writeText(JSON.stringify({genre,meter,tempo,feel,strum,drums,drumFills,bass:bassMode,bassFills,guitarFills,backup,lead,leadEvery,keys,guitarInst:guitarSet,bassInst:bassSet,pianoInst:pianoSet,backupInst:backupSet,mixer},null,2))}
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
                  <span className="flex flex-col gap-1 w-full">
                    {[['Acoustic',[['musyng','Musyng'],['fluid','Fluid'],['fatboy','FatBoy'],['nylon','Nylon'],['shinyac','A.Shiny'],['emily','A.Emily'],['ovation','A.Ovation'],['spanish','A.Spanish'],['ganjo','Banjo']]],
                       ['Electric',[['jazz','E.Jazz'],['muted','E.Muted'],['black','E.Black'],['green','E.Green'],['shiny','E.Shiny'],['standard','E.Std'],['stdmute','E.SMute']]]].map(([label,sets])=>(
                      <span key={label} className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-gray-500 w-14">{label}</span>
                        {sets.map(([k,l])=>(
                          <button key={k} onClick={()=>setGuitarSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${guitarSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                        ))}
                      </span>
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
                    {[['vcsl','Upright'],['osiris','Osiris'],['rhodes','Rhodes']].map(([k,l])=>(
                      <button key={k} onClick={()=>setPianoSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${pianoSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                    ))}
                  </span>
                )}
                {ch==='backup'&&(
                  <span className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">Samples</span>
                    {[['banjo','Banjo'],['accordion','Accordion']].map(([k,l])=>(
                      <button key={k} onClick={()=>setBackupSet(k)} className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${backupSet===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{l}</button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      </>)}

      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 mb-4 bg-black/95 backdrop-blur border-b border-gray-800 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button onClick={start} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${playing?'bg-red-600 text-white hover:bg-red-500':'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
          {playing?'■ Stop':'▶ Play'}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)} className="accent-amber-500"/> Loop
        </label>
        <span className="flex items-center gap-2">
          <input type="range" min="50" max="200" value={tempo} onChange={e=>setTempo(+e.target.value)} className="w-36 accent-amber-500"/>
          <span className="text-xs text-gray-400 w-14">{tempo} bpm</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {practice?<>
            <button onClick={toggleFullscreen} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">⛶ Fullscreen</button>
            <button onClick={()=>setPractice(false)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">✕ Exit</button>
          </>:
            <button onClick={()=>setPractice(true)} title="Hide everything but the transport and charts — for practicing off a tablet"
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500 transition-all">Practice</button>}
        </span>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Section</span>
            {SECTION_IDS.map(id=>(
              <button key={id} onClick={()=>{setActiveSec(id);setEditIdx(null);setPickIdx(null);}} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${activeSec===id?'bg-emerald-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
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
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 uppercase tracking-wide">View</span>
            {[['cowboy','Cowboy'],['triads','Triads']].map(([k,l])=>(
              <button key={k} onClick={()=>setView(k)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${view===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
            ))}
          </div>
          {view==='triads'&&(
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Strings</span>
            {STRING_SETS.map(s=>{
              const on=selectedSets.includes(s.key);
              return (<button key={s.key} onClick={()=>toggleSet(s.key)} title={s.names}
                style={on?{backgroundColor:s.color,color:'#0b0b0b',borderColor:s.color}:undefined}
                className={`px-2.5 py-1 rounded text-xs font-semibold border border-transparent transition-all ${on?'':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>);
            })}
            <span className="text-[10px] text-gray-500 normal-case">{multi?'voice-leading across sets':'single set'}</span>
          </div>
          )}
          {view==='triads'&&(
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Position <span className="normal-case text-gray-600">{positions.length>1?`${displayAnchor+1}/${positions.length} · `:''}{posSet&&<span className="font-semibold" style={{color:posSet.color}}>{posSet.label} · </span>}{posLabel}</span>{posMode==='vary'&&variants.length>1&&<span className="normal-case text-gray-600"> · shape {(displayVariant??0)+1}/{variants.length}</span>}{upNext&&<span className={`normal-case text-amber-400 ${climbPulse?'animate-pulse':''}`}> → {upNext.anchor+1}</span>}</span>
            <button onClick={()=>setPosMode('climb')} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${posMode==='climb'?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>Loop the neck</button>
            <button onClick={()=>setPosMode('manual')} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${posMode==='manual'?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>Manual</button>
            <button onClick={()=>setPosMode('vary')} title="Hold this position, but start each pass on the next same-position shape — the progression re-voiced across neighboring string sets, loop after loop"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${posMode==='vary'?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>Vary</button>
            {posMode==='climb'&&positions.length>1&&(
              <span className="flex items-center gap-1">
                {positions.map((_,i)=>{
                  const sel=posSel.length?posSel.includes(i):true;
                  return (
                    <button key={i} title={`Position ${i+1} in the climb`}
                      onClick={()=>setPosSel(s=>{
                        const cur=s.length?s:[...Array(positions.length).keys()];
                        const next=cur.includes(i)?cur.filter(x=>x!==i):[...cur,i];
                        return next.length?next:cur;
                      })}
                      className={`w-6 h-6 rounded text-xs font-medium transition-all ${sel?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>{i+1}</button>
                  );
                })}
              </span>
            )}
            {posMode!=='climb'&&(<>
              <button onClick={()=>setPosIdx(Math.max(0,pi-1))} disabled={pi<=0} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">▼</button>
              <button onClick={()=>setPosIdx(Math.min(positions.length-1,pi+1))} disabled={pi>=positions.length-1} className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">▲</button>
            </>)}
          </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {bars.map((bar,i)=>{
            const fi=dispStart+i;
            const ch=chords[fi];
            const isCur=currentBar!=null&&flat.map[currentBar]?.sec===activeSec&&flat.map[currentBar]?.j===i;
            const isEdit=editIdx===i;
            const isPick=pickIdx===i;
            return (
              <div key={i} onClick={()=>{ if (view==='triads') { setPickIdx(isPick?null:i); setEditIdx(null); } else setEditIdx(isEdit?null:i); }}
                   className={`relative cursor-pointer rounded-lg border px-2 pt-1.5 pb-2 flex flex-col items-center transition-all ${isCur?'border-amber-500 bg-amber-500/10':isEdit||isPick?'border-emerald-500 bg-emerald-500/10':'border-gray-800 bg-gray-950 hover:border-gray-600'}`}>
                <div className="text-[10px] text-gray-600 self-start">bar {i+1}{view==='triads'&&multi&&triadPath[fi]&&<span className="font-semibold" style={{color:triadPath[fi].set.color}}> · {triadPath[fi].set.label}</span>}{barPinVal(i)!=null&&<span className="text-emerald-500"> · pinned</span>}</div>
                <div className="text-sm font-bold text-amber-400">{ch.name} <span className="text-gray-500 font-normal text-xs">({ch.numeral})</span></div>
                {view==='cowboy'
                  ? (grips[fi]
                      ? <GripDiag grip={grips[fi]}/>
                      : (triadPath[fi]?<FretDiag voicing={triadPath[fi]} strs={triadPath[fi].set.strs} name={null} root={ch.root} size="small" accent={triadPath[fi].set.color}/>:<div className="text-xs text-gray-600 italic p-4">no grip</div>))
                  : (triadPath[fi]
                      ? <FretDiag voicing={triadPath[fi]} strs={triadPath[fi].set.strs} name={null} root={ch.root} size="small" accent={triadPath[fi].set.color}/>
                      : <div className="text-xs text-gray-600 italic p-4">no voicing</div>)}
                {isPick&&(()=>{
                  const all=candidatesFor(ch);
                  if (!all.length) return null;
                  // Same-position shapes only — the Position control owns big
                  // moves. In a low position we also surface open grips (which
                  // sit at the nut, outside the ±3 window of a fretted shape):
                  // that's the "open shapes when down low" behavior. Fixed sets
                  // have one voicing per position, so fall back to the full neck
                  // when the window leaves <2 choices.
                  const cur=triadPath[fi];
                  const lowPos=cur?centerOf(cur)<=5:true;
                  const near=cur?all.filter(v=>Math.abs(centerOf(v)-centerOf(cur))<=3||(lowPos&&hasOpenString(v.frets))):all;
                  const vsp=near.length>=2?near:all;
                  const curKey=pinKeyOf(cur);
                  const pk=barPinKey(i);        // where a pick is written (this position)
                  const effPin=barPinVal(i);    // effective pin here (incl. legacy fallback)
                  return (
                    <div onClick={e=>e.stopPropagation()} className="absolute z-30 top-full left-0 mt-1.5 p-2 bg-gray-800 border border-emerald-700/60 rounded-lg shadow-2xl w-max max-w-[92vw] cursor-default">
                      <div className="flex items-center justify-between gap-6 mb-1.5">
                        <span className="text-[10px] text-gray-400">Pick a shape — pins this bar{posMode!=='vary'&&positions.length>1?` in position ${displayAnchor+1}`:''}; later bars voice-lead from it</span>
                        <span className="flex gap-3">
                          <button onClick={()=>{setEditIdx(i);setPickIdx(null);}} className="text-[10px] text-gray-400 hover:text-white transition-colors">Edit chord…</button>
                          <button onClick={()=>setPickIdx(null)} className="text-[10px] text-gray-400 hover:text-white transition-colors">✕</button>
                        </span>
                      </div>
                      <div className="flex gap-2 items-start">
                        <button onClick={()=>setPins(ps=>{const n={...ps};delete n[pk];delete n[`${activeSec}:${i}`];return n;})} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${effPin==null?'bg-emerald-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Auto</button>
                        {vsp.map(v=>{
                          const k=pinKeyOf(v);
                          const pinned=effPin===k,current=k===curKey;
                          return (
                            <div key={k} onClick={()=>setPins(ps=>({...ps,[pk]:k}))}
                              className={`cursor-pointer rounded-lg border p-1.5 pb-0.5 flex flex-col items-center transition-all ${pinned?'border-amber-500 bg-amber-500/10':current?'border-emerald-600 bg-emerald-500/10':'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                              <div className={`text-[10px] font-medium ${pinned?'text-amber-400':current?'text-emerald-400':'text-gray-400'}`}>{multi&&<span className="font-semibold" style={{color:v.set.color}}>{v.set.label} · </span>}{fretWindow(v)}{current&&!pinned?' · playing':''}</div>
                              <FretDiag voicing={v} strs={v.set.strs} name={null} root={ch.root} size="small" accent={v.set.color}/>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {view==='triads'&&upNext?.path[0]&&(
            <div className={`rounded-lg border border-dashed px-2 pt-1.5 pb-2 flex flex-col items-center transition-all ${climbPulse?'border-amber-400 ring-1 ring-amber-400/70 animate-pulse':'border-gray-600'}`}>
              <div className="text-[10px] text-amber-400/90 self-start">next loop · {posMode==='vary'?<span className="font-semibold" style={{color:upNext.path[0].set.color}}>{upNext.path[0].set.label}</span>:`pos ${upNext.anchor+1}`} · {fretWindow(upNext.path[0])}</div>
              <div className="text-sm font-bold text-amber-400">{chords[0].name} <span className="text-gray-500 font-normal text-xs">({chords[0].numeral})</span></div>
              <FretDiag voicing={upNext.path[0]} strs={upNext.path[0].set.strs} name={null} root={chords[0].root} size="small" accent={upNext.path[0].set.color}/>
            </div>
          )}
          {!bars.length&&(
            <div className="col-span-full text-sm text-gray-500 self-center px-2 flex items-center gap-3 flex-wrap">
              <span className="italic">Empty {SECTION_LABELS[activeSec].toLowerCase()} — add bars with +, or pick an iconic progression above to fill it.</span>
              {activeSec!=='A'&&SECTION_IDEAS[genre]&&(
                <button onClick={()=>setSuggestOpen(o=>!o)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border border-dashed transition-all ${suggestOpen?'border-amber-500 text-amber-400':'border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400'}`}>
                  ✨ Suggest a {SECTION_LABELS[activeSec].toLowerCase()}…
                </button>
              )}
            </div>
          )}
          <button onClick={addBar} className="rounded-lg border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 text-3xl flex items-center justify-center min-h-[72px] transition-all" title="Add bar">+</button>
        </div>

        {!bars.length&&suggestOpen&&activeSec!=='A'&&SECTION_IDEAS[genre]&&(()=>{
          const role=activeSec==='B'?'chorus':'bridge';
          const ideas=SECTION_IDEAS[genre][role]||[];
          const ref=sections.A;
          // Rank for a pull back into the verse (end on V), contrast on the
          // bridge's opening chord, and a bar count that stays pass-aligned.
          const score=p=>{
            let s=0;
            if (p.bars[p.bars.length-1][0]===4) s+=2;
            if (ref.length){
              if (role==='bridge'&&p.bars[0][0]!==ref[0].deg) s+=2;
              if ([ref.length,ref.length*2,Math.ceil(ref.length/2)].includes(p.bars.length)) s+=1;
            }
            return s;
          };
          const ranked=[...ideas].sort((a,b)=>score(b)-score(a));
          return (
            <div className="mt-3 bg-gray-950 rounded-lg border border-gray-800 p-3">
              <div className="text-xs text-gray-500 mb-2">Suggested {role} moves for {GENRES.find(g=>g.key===genre)?.label} — ranked for contrast with your verse and a pull back into it.</div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {ranked.map(p=>(
                  <button key={p.name} onClick={()=>applyIdea(p)} className="text-left px-3 py-2 rounded-md bg-gray-900 border border-gray-800 hover:border-gray-600 transition-all">
                    <div className="text-sm font-medium text-gray-200">{p.name}</div>
                    <div className="text-xs text-gray-500">{progSummary(p.bars)} <span className="text-gray-600">· {p.bars.length} bars</span></div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {editIdx!==null&&editIdx<bars.length&&(
          <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-emerald-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-emerald-400">Editing <span className="font-bold">bar {editIdx+1}</span></div>
              <div className="flex gap-2 items-center">
                <button onClick={()=>insertBar(editIdx)} className="text-xs text-gray-400 hover:text-white transition-colors">Duplicate after</button>
                <button onClick={()=>removeBar(editIdx)} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Remove bar</button>
                <button onClick={()=>setEditIdx(null)} title="Close editor" className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all">✕ Done</button>
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
            {view==='triads'&&(
              <div className="text-xs text-gray-600 mt-2.5">Voicings moved: click the bar's card to pick a shape.</div>
            )}
          </div>
        )}
      </div>

      {!practice&&(<>
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

      <details className="mt-6 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <summary className="cursor-pointer text-gray-500 font-bold hover:text-gray-300 select-none">How to use &amp; credits</summary>
        <p className="mt-2">Pick a genre tab (it starts you on that genre's first style and progression), then a style, then one of its iconic progressions — or click any bar to edit its chord, and + to add bars. Songs can have up to three <strong>sections</strong> (Verse/Chorus/Bridge tabs above the bars): switch to an empty tab and pick a progression (or add bars) to fill it, then build the <strong>Arrangement</strong> with the + chips — playback runs the whole arrangement as one loop, voice-leading flows across section boundaries, and the sounding section's chip lights up. Saved progressions keep their sections, arrangement, and pinned voicings. Switching style loads that style's first progression along with its sound — pick another from the list (<strong>More…</strong> opens the genre's full catalog with numerals and bar counts) or edit the bars from there. Cowboy chords shows the simplest first-position grip for each bar; Triads shows a voice-led triad path on your chosen string set — or, with String Set on <strong>Auto</strong> (the default), across sets: each bar picks the voicing that moves pitches and your hand the least, crossing between 3-2-1, 4-3-2, and 5-4-3 the way real position playing does (each bar's card names its set). <strong>Position</strong> controls where the path sits on the neck. <strong>Loop the neck</strong> (the default) plays the progression once per position, climbing up and back down, changing exactly on the loop boundary — the diagrams and the counter follow along, so you can ride the whole neck hands-free; the numbered chips choose which positions the climb visits (e.g. just 1–2 while you're learning the low half). While climbing, a dashed "next loop" card at the end of the grid shows where bar 1 lands on the next pass, pulsing through the final bar — that's your cue for where the hand goes. <strong>Manual</strong> parks it in one position with ▼/▲ steppers. <strong>Vary</strong> holds one position (pick it with the same steppers) but starts each pass on the next same-position shape, re-voicing the whole progression across neighboring string sets loop after loop — the "next loop" card announces the coming shape. In every mode the improvised Lead follows the position, since its notes come from each bar's voicing. To bend the path at one spot, click a bar and pick a <strong>Voicing</strong>: that bar is pinned (marked on its card) and later bars re-lead from it; Auto unpins. Everything is live while it plays — tempo, key, band, even switching progressions — playback carries on from the same beat. The <strong>View</strong> and the <strong>Guitar</strong> sound are independent, and you can switch views while it plays: watch the triads while the guitar strums cowboy chords to follow along, set Guitar to Triads to hear what the triads should sound like, or mute it and play the triads yourself over the rhythm section. A <strong>Style</strong> button sets time signature, tempo, feel, strum pattern, and the band in one tap — every knob stays individually adjustable after. <strong>Time</strong> switches the meter by hand: 4/4, 3/4 (waltz), or 6/8 (compound — two pulses of three, the slow-blues feel). Strums, drums, and bass lines are written per meter, so the rows only show patterns that exist in the current one; switching meter pulls any knob that doesn't fit back to one that does (strum to Folk, drums to Kit, bass to Root–5th). Shuffle is disabled in 6/8 since the meter is already triplet-based. Some progressions also pin part of the band to fit their character (Cabbage locks in the driving boom-chick and alternating bass); knobs a progression doesn't pin keep your current settings. Strums: Folk is D-DU-UDU; Boom-chick picks the bass note on 1 and 3 and strums the top strings on 2 and 4 (old-time rhythm guitar); Bluegrass adds upstroke fills to the boom-chick; Lo-fi is sparse and lazy (it doubles as jazz comping); Pop is driving eighths; Travis fakes fingerpicking — thumb bass on every beat, soft finger picks between; Bossa is the syncopated bossa comp; Funk is scratchy off-beat sixteenths. Drums: Stomp (foot-tap), Kit (kick/snare/hats), Train (brushes with a backbeat), Bossa (rim clicks over hats), Swing (ride pattern with feathered kick — pair with Shuffle), Funk (syncopated kick, ghost snares); the Fills toggle throws a snare/tom run into every 4th bar, different each time Play builds the loop. <strong>Backup</strong> adds a second rhythm instrument over the guitar — a banjo, for now: Roll arpeggiates each bar's chord in three-finger-style eighth-note rolls (bluegrass turns it on by default), Chop plays short muted backbeat stabs (the mandolin-chop feel); it has its own Mixer strip. Keys adds an upright piano comping block chords on each bar; its Fills toggle also sprinkles a chord-tone run into every 4th bar, new each time Play builds the loop. Bass patterns: Root, Root–5th, Walking (with chromatic approaches), Boogie (the swung R-3-5-6 shuffle line), Bossa (dotted root–fifth), or Funk (syncopated with octave pops); on Root and Root–5th a <strong>Fills</strong> toggle walks up (or down) into the next chord whenever it changes — the country move that livens the simple patterns without full-time Walking — played on an upright or an electric (the Mixer's bass Samples switch; Pop, Indie Pop, and Funk preset the electric). The Mixer's guitar Samples switch likewise offers three acoustics and two electrics (E.Jazz hollowbody-ish, E.Muted for funk scratch). Shuffle swings the offbeat strums and hats onto the triplet grid (the blues preset selects it automatically). Lead improvises pentatonic notes drawn from each bar's triad position on the selected string set — Fills plays a run into every Nth bar (the /8 /4 /2 chips set how often), Solo noodles throughout; each press of Play writes a new solo, and it loops as played. The lead also rolls guitar articulations as it goes: bends into strong beats and fill endings, hammer-on/pull-off legato on quick close steps, and the occasional double stop. Saved progressions live in your browser.</p>
        <p className="mt-2">Sounds: guitar from the <a href="https://github.com/gleitz/midi-js-soundfonts" className="underline hover:text-gray-400">FatBoy SoundFont</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" className="underline hover:text-gray-400">CC BY-SA 3.0</a>); upright bass from <a href="https://github.com/sfzinstruments/karoryfer.meatbass" className="underline hover:text-gray-400">Meatbass</a> and electric bass from <a href="https://github.com/sfzinstruments/karoryfer.black-and-blue-basses" className="underline hover:text-gray-400">Black And Blue Basses</a>, both by Karoryfer Samples (CC0); drums from the <a href="https://archive.org/details/SalamanderDrumkit" className="underline hover:text-gray-400">Salamander Drumkit</a> by Alexander Holm (public domain); brushes from <a href="https://shop.karoryfer.com/pages/free-samples" className="underline hover:text-gray-400">Swirly Drums</a> by Karoryfer Samples (CC0); upright piano from the <a href="https://github.com/sgossner/VCSL" className="underline hover:text-gray-400">Versilian Community Sample Library</a> (CC0); electric guitars (E.Black/E.Green) from <a href="https://github.com/sfzinstruments/karoryfer.black-and-green-guitars" className="underline hover:text-gray-400">Black And Green Guitars</a> by Karoryfer Samples (CC0); Osiris piano from <a href="https://github.com/sfzinstruments/Osiris_Piano" className="underline hover:text-gray-400">Osiris Piano</a> by Versilian Studios &amp; Karoryfer Samples (CC0); archtop electric (E.Shiny) from <a href="https://github.com/sfzinstruments/karoryfer.shinyguitar" className="underline hover:text-gray-400">Shinyguitar</a> by Karoryfer Samples (CC0); banjo from <a href="https://github.com/sfzinstruments/ganjo" className="underline hover:text-gray-400">ganjo</a> by itsclipping (CC0); button accordion from <a href="https://github.com/freepats/button-accordion-HN" className="underline hover:text-gray-400">FreePats</a> (CC0); Rhodes piano from <a href="https://github.com/sfzinstruments/jlearman.jRhodes3c" className="underline hover:text-gray-400">jRhodes3</a> by Jeff Learman (samples <a href="https://creativecommons.org/licenses/by-nc/4.0/" className="underline hover:text-gray-400">CC BY-NC</a> — non-commercial); electric guitar (E.Std/E.SMute) from <a href="https://sfzinstruments.github.io/guitars/standard_guitar/" className="underline hover:text-gray-400">Standard Guitar</a> by Unreal Instruments ("license-free" per bundled terms; credited anyway); acoustic guitars from Shinyguitar's acoustic variant (A.Shiny) and <a href="https://github.com/sfzinstruments/karoryfer.emilyguitar" className="underline hover:text-gray-400">Emilyguitar</a> (A.Emily), both Karoryfer Samples (CC0); <a href="https://github.com/sfzinstruments/OvationGuitar" className="underline hover:text-gray-400">Ovation Guitar</a> (A.Ovation) by S. Christian Collins; classical (A.Spanish) from <a href="https://github.com/freepats/spanish-classical-guitar" className="underline hover:text-gray-400">FreePats</a> (CC0); foot stomp from <a href="https://freesound.org/people/itinerantmonk108/sounds/740039/" className="underline hover:text-gray-400">"foot stompin"</a> by itinerantmonk108 on Freesound (CC0).</p>
      </details>
      </>)}
    </div>
    </div>
  );
}
