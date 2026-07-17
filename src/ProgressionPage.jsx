import { useState, useMemo, useCallback } from "react";
import {
  NOTES, OPEN, SNAME, STRING_SETS, SCALE, DEGS, QS, QKEYS, IV_LABEL,
  getVoicings, closestVoicing, hasOpenString, rootStrLabel, matchCAGED, matchCAGEDZone,
} from './music.js';
import FretDiag, { NoteList } from './FretDiag.jsx';
import { fretWindow } from './fretboard.js';
import { centerOf, posCost, pinKeyOf } from './arranger.js';
import { numeralOf } from './styles.js';
import { strum, voicingMidis } from './audio.js';

// Default active string sets (5-4-3 and 6-5-4 off by default, but selectable).
const DEFAULT_SETS = ['321','432'];
// Fret-range label for the Position readout, e.g. "frets 3–5".
const fretRangeLabel = v => {
  if (!v) return '';
  const nz=v.frets.filter(f=>f>0);
  const lo=nz.length?Math.min(...nz):0, hi=Math.max(...v.frets);
  return lo===hi?`fret ${lo}`:`frets ${lo}–${hi}`;
};

function getShapeChordNotes(cr) {
  if (!cr) return [];
  const {anchorFret:af,shape}=cr,notes=[];
  for (const [sStr,tones] of Object.entries(shape.t)) {
    const s=parseInt(sStr);
    for (const [off,iv] of tones) {const f=af+off;if(f>=0&&f<=16) notes.push({string:s,fret:f,interval:iv});}
  }
  return notes;
}

function getAllChordNotes(root,quality,fMin,fMax) {
  const ivs=QS[quality]?.iv||[0,4,7],notes=[];
  for (let s=1;s<=6;s++) for (const iv of ivs) {
    const note=(root+iv)%12;
    let f=((note-OPEN[s])%12+12)%12;
    while(f<=fMax){if(f>=fMin) notes.push({string:s,fret:f,interval:iv,note});f+=12;}
  }
  return notes;
}

function getPentNotes(root,quality,fMin,fMax) {
  const ivs=['min','min7','dim'].includes(quality)?[0,3,5,7,10]:[0,2,4,7,9],notes=[];
  for (let s=1;s<=6;s++) for (const iv of ivs) {
    const note=(root+iv)%12;
    let f=((note-OPEN[s])%12+12)%12;
    while(f<=fMax){if(f>=fMin) notes.push({string:s,fret:f,interval:iv,note});f+=12;}
  }
  return notes;
}

function computeOverlay(root,quality,voicing,strs) {
  if (!voicing) return null;
  const {frets,notes}=voicing;
  const nzf=frets.filter(f=>f>0),minF=nzf.length?Math.min(...nzf):0,maxF=Math.max(...frets);
  const cm=matchCAGED(root,quality,notes,frets,strs);
  let rS,rE;
  if (cm) {const sn=getShapeChordNotes(cm),af=sn.map(n=>n.fret);rS=Math.max(0,Math.min(...af)-1);rE=Math.max(...af)+1;}
  else {rS=Math.max(0,minF-3);rE=maxF+3;}
  if (rE-rS<5) rE=rS+5;
  if (rE-rS>9) rE=rS+9;
  const cn=cm?getShapeChordNotes(cm):getAllChordNotes(root,quality,rS,rE);
  const pn=getPentNotes(root,quality,rS,rE);
  const ts=new Set(strs.map((s,i)=>s+','+frets[i]));
  const cs=new Set(cn.map(n=>n.string+','+n.fret));
  return {chordNotes:cn.filter(n=>!ts.has(n.string+','+n.fret)),pentNotes:pn.filter(n=>!ts.has(n.string+','+n.fret)&&!cs.has(n.string+','+n.fret)),shapeName:cm?.name||null,rStart:rS,rEnd:rE,triadStrs:strs,triadFrets:frets,triadNotes:notes,triadRootIdx:voicing.rootIdx,root};
}

/* ---- Overlay Fretboard (Vertical) ---- */
function OverlayDiagram({data,compact=false}) {
  const [activeLayer,setActiveLayer]=useState(null);
  if (!data) return null;
  const {chordNotes,pentNotes,shapeName,rStart,rEnd,triadStrs,triadFrets,triadNotes,triadRootIdx,root}=data;
  const nF=rEnd-rStart;
  const strSp=compact?22:36,fretSp=compact?30:48;
  const ml=compact?14:20,mt=compact?24:36,mb=compact?10:20,mr=compact?14:20;
  const w=ml+5*strSp+mr,h=mt+nF*fretSp+mb;
  const hasNut=rStart===0;
  const so=[6,5,4,3,2,1];
  const sx=i=>ml+i*strSp,fy=f=>mt+(f-rStart)*fretSp,nY=f=>fy(f)-fretSp/2;
  const gIv=n=>((n-root)%12+12)%12;
  const dr=compact?8:11,cr2=compact?9:13,tr=compact?10:14;
  const f1=compact?6:8,f2=compact?7:9,f3=compact?7:9;
  const rc=compact?'#b45309':'#f59e0b',bc=compact?'#2563eb':'#3b82f6';
  const rs=compact?'#b45309':'#fbbf24',bs=compact?'#2563eb':'#60a5fa';

  const toggleLayer=layer=>{ if (!compact) setActiveLayer(prev=>prev===layer?null:layer); };
  const pentOp=(!compact&&activeLayer!==null&&activeLayer!=='pent')?0.1:1;
  const cagedOp=(!compact&&activeLayer!==null&&activeLayer!=='caged')?0.1:1;
  const triadOp=(!compact&&activeLayer!==null&&activeLayer!=='triad')?0.1:1;

  return (
    <div className={compact?'':'mt-3 bg-gray-900/80 rounded-xl p-4 border border-gray-700 overflow-x-auto'}>
      <div className={`flex items-center gap-3 flex-wrap ${compact?'mb-1':'mb-3'}`}>
        {shapeName&&(compact
          ? <span className="text-xs font-bold text-emerald-600">CAGED: <span className="text-amber-700">{shapeName}</span></span>
          : <button onClick={()=>toggleLayer('caged')} title="Click to isolate CAGED shape" className={`text-sm font-bold text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded transition-all ${activeLayer==='caged'?'bg-cyan-500/15 ring-1 ring-cyan-500/50':''}`}>CAGED: <span className="text-amber-300">{shapeName}</span></button>
        )}
        {!compact&&(
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <button onClick={()=>toggleLayer('pent')} title="Click to isolate pentatonic scale" className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${activeLayer==='pent'?'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50':'text-gray-400 hover:text-emerald-300 hover:bg-emerald-500/10'}`}>
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-emerald-400 bg-emerald-400/20 flex-shrink-0"></span>Pentatonic
            </button>
            <button onClick={()=>toggleLayer('caged')} title="Click to isolate CAGED chord shape" className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${activeLayer==='caged'?'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50':'text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10'}`}>
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-cyan-400 bg-cyan-400/20 flex-shrink-0"></span>CAGED chord
            </button>
            <button onClick={()=>toggleLayer('triad')} title="Click to isolate triad" className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${activeLayer==='triad'?'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50':'text-gray-400 hover:text-amber-300 hover:bg-amber-500/10'}`}>
              <span className="inline-flex gap-0.5 flex-shrink-0"><span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span><span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span></span>Triad
            </button>
            {activeLayer!==null&&<button onClick={()=>setActiveLayer(null)} className="text-gray-600 hover:text-gray-400 transition-colors text-[10px] ml-1">show all</button>}
          </div>
        )}
      </div>
      <div className="flex justify-center">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {Array.from({length:nF+1},(_,i)=>{const y=fy(rStart+i),isN=rStart+i===0;return <line key={i} x1={ml-6} y1={y} x2={sx(5)+6} y2={y} stroke={isN?(compact?'#111':'#e5e7eb'):(compact?'#bbb':'#4b5563')} strokeWidth={isN?(compact?2:3):compact?0.5:1}/>;})}
          {Array.from({length:nF},(_,i)=>{const f=rStart+i+1;return f>=1?<text key={i} x={ml-14} y={fy(rStart+i+1)-fretSp/2+4} fontSize={compact?7:10} fill={compact?'#999':'#6b7280'} textAnchor="middle">{f}</text>:null;})}
          {so.map((s,i)=>(<g key={s}><line x1={sx(i)} y1={fy(rStart)} x2={sx(i)} y2={fy(rEnd)} stroke={compact?'#999':'#6b7280'} strokeWidth={s>=4?(compact?1:1.4):(compact?0.7:1)}/><text x={sx(i)} y={mt-14} fontSize={compact?7:10} fill={compact?'#888':'#9ca3af'} textAnchor="middle" fontFamily="monospace">{SNAME[s]}</text></g>))}
          {[3,5,7,9,12,15].filter(f=>f>rStart&&f<=rEnd).map(f=>{const y=fy(f)-fretSp/2;if(f===12) return <g key={f}><circle cx={sx(1)} cy={y} r={3} fill={compact?'#ddd':'#374151'}/><circle cx={sx(4)} cy={y} r={3} fill={compact?'#ddd':'#374151'}/></g>;return <circle key={f} cx={(sx(2)+sx(3))/2} cy={y} r={3} fill={compact?'#ddd':'#374151'}/>;})}
          <g opacity={pentOp} style={{transition:'opacity 0.2s'}}>
            {pentNotes.map((n,i)=>{const si=so.indexOf(n.string);if(si<0) return null;const x=sx(si),y=n.fret===0?(hasNut?fy(0)-12:nY(0)):nY(n.fret);const isR=n.interval===0;return <g key={'p'+i}><circle cx={x} cy={y} r={dr} fill={isR?'rgba(251,191,36,0.15)':'rgba(16,185,129,0.15)'} stroke={isR?(compact?'#b45309':'#fbbf24'):(compact?'#059669':'#10b981')} strokeWidth={compact?1:1.5}/><text x={x} y={y+0.5} fontSize={f1} fill={isR?(compact?'#b45309':'#fbbf24'):(compact?'#059669':'#6ee7b7')} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{IV_LABEL[n.interval]||n.interval}</text></g>;})}
          </g>
          <g opacity={cagedOp} style={{transition:'opacity 0.2s'}}>
            {chordNotes.map((n,i)=>{const si=so.indexOf(n.string);if(si<0) return null;const x=sx(si),y=n.fret===0?(hasNut?fy(0)-12:nY(0)):nY(n.fret);const isR=n.interval===0;return <g key={'c'+i}><circle cx={x} cy={y} r={cr2} fill={isR?'rgba(251,191,36,0.15)':'rgba(34,211,238,0.15)'} stroke={isR?(compact?'#b45309':'#fbbf24'):(compact?'#06b6d4':'#22d3ee')} strokeWidth={compact?1.5:2}/><text x={x} y={y+0.5} fontSize={f2} fill={isR?(compact?'#b45309':'#fbbf24'):(compact?'#06b6d4':'#22d3ee')} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{IV_LABEL[n.interval]||n.interval}</text></g>;})}
          </g>
          <g opacity={triadOp} style={{transition:'opacity 0.2s'}}>
            {triadStrs.map((s,i)=>{const si=so.indexOf(s);if(si<0) return null;const f=triadFrets[i],x=sx(si),y=f===0?(hasNut?fy(0)-12:nY(0)):nY(f);const isR=triadRootIdx.includes(i);const iv=gIv(triadNotes[i]),label=iv===0?'R':(IV_LABEL[iv]||iv);return <g key={'t'+i}><circle cx={x} cy={y} r={tr} fill={isR?rc:bc} stroke={isR?rs:bs} strokeWidth={2}/><text x={x} y={y+0.5} fontSize={f3} fill={isR?'#000':'#fff'} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;})}
          </g>
        </svg>
      </div>
    </div>
  );
}

function Arrow({dist}) {
  const label=dist===0?'—':dist>0?`↑${dist}`:`↓${Math.abs(dist)}`;
  return (
    <div className="flex flex-col items-center justify-center mx-1 mt-8">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <svg width="30" height="16" viewBox="0 0 30 16"><line x1="2" y1="8" x2="24" y2="8" stroke="#6b7280" strokeWidth="1.5"/><polyline points="20,4 26,8 20,12" fill="none" stroke="#6b7280" strokeWidth="1.5"/></svg>
    </div>
  );
}

function shiftLabel(d) { return d===0?'—':d>0?`↑${d}`:`↓${Math.abs(d)}`; }

/* ---- Print Preview ---- */
function PrintPreview({chords,path,distances,keyName,onClose}) {
  const allOverlays=chords.map((ch,i)=>{
    if (!path[i]) return null;
    return computeOverlay(ch.root,ch.quality,path[i],path[i].set.strs);
  });

  return (
    <div className="font-sans bg-white text-gray-900 min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Close bar */}
        <div className="no-print flex justify-between items-center mb-5 pb-3 border-b-2 border-gray-200">
          <div>
            <div className="text-2xl font-bold text-amber-700">Mr. Triad</div>
            <div className="text-sm text-gray-500">Progression in {keyName}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>window.print()} className="px-5 py-2 text-sm font-semibold bg-amber-700 text-white border-none rounded-lg cursor-pointer flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="1" width="8" height="4"/><rect x="1" y="5" width="14" height="7" rx="1"/><rect x="4" y="10" width="8" height="5"/><circle cx="12" cy="8" r="0.8" fill="currentColor"/></svg>
              Print
            </button>
            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-gray-800 text-white border-none rounded-lg cursor-pointer">← Back to Editor</button>
          </div>
        </div>
        <div className="hidden print-only-header">
          <div className="text-2xl font-bold text-amber-700 mb-0.5">Mr. Triad</div>
          <div className="text-sm text-gray-500 mb-4">Progression in {keyName}</div>
        </div>

        {/* Chord diagrams */}
        <div className="print-content">
        <div className="text-xs font-semibold text-gray-700 mb-2">Chord Voicings</div>
        <div className="flex flex-wrap items-start gap-1.5 mb-6">
          {chords.map((ch,i)=>{
            const v=path[i];
            if (!v) return null;
            const strs=v.set.strs,{frets,notes,rootIdx}=v;
            const {minNZ,startF,nFrets:nFr,hasNut}=fretWindow(frets);
            const cw=100,ch2=130,mg={t:36,b:10,l:32,r:14};
            const pw=cw-mg.l-mg.r,ph=ch2-mg.t-mg.b,ss=pw/2,fs2=ph/nFr;
            return (
              <div key={i} className="flex items-start">
                <div className="flex flex-col items-center">
                  <div className="text-[11px] font-bold text-amber-700 mb-0.5">{ch.name} ({ch.numeral})</div>
                  <div className="text-[8px] text-emerald-700">{v.set.label}</div>
                  <svg width={cw} height={ch2} viewBox={`0 0 ${cw} ${ch2}`}>
                    {hasNut?<line x1={mg.l-2} y1={mg.t} x2={mg.l+pw+2} y2={mg.t} stroke="#111" strokeWidth={3}/>:<text x={mg.l-20} y={mg.t+fs2/2+3} fontSize="8" fill="#666" textAnchor="middle">{minNZ}fr</text>}
                    {Array.from({length:nFr+1},(_,j)=>(<line key={j} x1={mg.l} y1={mg.t+j*fs2} x2={mg.l+pw} y2={mg.t+j*fs2} stroke={j===0&&hasNut?'#111':'#bbb'} strokeWidth={j===0&&hasNut?3:0.5}/>))}
                    {[0,1,2].map(j=>(<line key={j} x1={mg.l+j*ss} y1={mg.t} x2={mg.l+j*ss} y2={mg.t+nFr*fs2} stroke="#999" strokeWidth={0.8}/>))}
                    {strs.map((s,j)=>(<text key={s} x={mg.l+j*ss} y={mg.t-18} fontSize="8" fill="#666" textAnchor="middle" fontFamily="monospace">{SNAME[s]}</text>))}
                    {frets.map((f,j)=>{
                      const isR=rootIdx.includes(j);
                      const iv=((notes[j]-ch.root+12)%12);
                      const label=IV_LABEL[iv]||iv;
                      const col=isR?'#b45309':'#2563eb';
                      if (f===0){const cx=mg.l+j*ss,cy=hasNut?mg.t-5:mg.t-8;return <g key={j}><circle cx={cx} cy={cy} r={7} fill={col}/><text x={cx} y={cy+0.5} fontSize="7" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;}
                      const x=mg.l+j*ss,y=mg.t+(f-startF-0.5)*fs2;
                      return <g key={j}><circle cx={x} cy={y} r={9} fill={col}/><text x={x} y={y+0.5} fontSize="7" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;
                    })}
                  </svg>
                  <div className="text-[7px] text-gray-500 mt-0.5">(<NoteList notes={notes} rootIdx={rootIdx} strongClass="text-gray-700"/>) Frets: {frets.join('-')}</div>
                </div>
                {i<chords.length-1&&distances[i]!==null&&(
                  <div className="flex flex-col items-center justify-center mx-0.5 pt-11">
                    <div className="text-[8px] text-gray-500">{shiftLabel(distances[i])}</div>
                    <svg width="20" height="12" viewBox="0 0 20 12"><line x1="1" y1="6" x2="16" y2="6" stroke="#888" strokeWidth="1"/><polyline points="13,3 17,6 13,9" fill="none" stroke="#888" strokeWidth="1"/></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info table */}
        <div className="text-xs font-semibold text-gray-700 mb-1.5">Details</div>
        <table className="w-full text-[10px] border-collapse mb-7">
          <thead>
            <tr className="border-b-2 border-gray-300">
              {['Chord','Strings','Notes','Frets','Inversion','Shift'].map(h=>(
                <th key={h} className="text-left py-1.5 pr-2 text-gray-500 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chords.map((ch,i)=>{
              const v=path[i];
              if (!v) return null;
              return (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-bold text-amber-700">{ch.name}</td>
                  <td className="py-1 pr-2 text-emerald-700">{v.set.label}</td>
                  <td className="py-1 pr-2">{v.notes.map(n=>NOTES[n]).join(', ')}</td>
                  <td className="py-1 pr-2 font-mono">{v.frets.join('-')}</td>
                  <td className="py-1 pr-2">{v.inv+rootStrLabel(v,v.set.strs)}</td>
                  <td className="py-1">{i===0?'—':distances[i-1]!==null?shiftLabel(distances[i-1]):'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Overlays */}
        <div className="text-xs font-semibold text-gray-700 mb-1.5">CAGED Shapes & Pentatonic Scales</div>
        <div className="flex flex-wrap gap-1 mb-3">
          {[['text-emerald-700','Pentatonic','border'],['text-cyan-700','CAGED','border'],['text-amber-700','Root','fill'],['text-blue-700','Other','fill']].map(([cls,l,t])=>(
            <span key={l} className={`text-[9px] inline-flex items-center gap-1 ${cls}`}>
              <span className={`inline-block w-[11px] h-[11px] rounded-full ${t==='fill'?'':'border-2 border-current bg-current/10'}`}
                    {...(t==='fill'?{style:{background:'currentColor'}}:{})}></span>{l}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-5 items-start">
          {allOverlays.map((od,i)=>{
            if (!od) return null;
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="text-[11px] font-bold text-amber-700 mb-0.5">{chords[i].name} ({chords[i].numeral})</div>
                <OverlayDiagram data={od} compact={true}/>
              </div>
            );
          })}
        </div>
        </div>{/* end print-content */}
      </div>
    </div>
  );
}

/* ---- Progression Page ---- */
export default function ProgressionPage() {
  const [key,setKey]=useState(0);
  const [prog,setProg]=useState([]);
  const [selectedQuality,setSelectedQuality]=useState('maj');
  const [selectedSets,setSelectedSets]=useState(DEFAULT_SETS);
  const [posIdx,setPosIdx]=useState(0);
  const [pins,setPins]=useState({}); // {barIndex: pinKey}
  const [pickIdx,setPickIdx]=useState(null); // bar whose voicing picker is open
  const [shownSecondHelper,setShownSecondHelper]=useState(false);
  const [overlayIdx,setOverlayIdx]=useState(null);
  const [printMode,setPrintMode]=useState(false);

  const chords=useMemo(()=>prog.map(p=>{
    const root=(key+SCALE[p.deg])%12,nts=QS[p.q].iv.map(iv=>(root+iv)%12);
    return {notes:nts,root,name:NOTES[root]+QS[p.q].s,numeral:numeralOf(p),quality:p.q};
  }),[key,prog]);

  // More than one set active → cross-set voice-leading: each chord takes the
  // voicing that keeps the hand in the position, crossing sets where it fits
  // (posCost). A single set is just nearest-fret closestVoicing.
  const multi=selectedSets.length>1;
  const toggleSet=useCallback(k=>setSelectedSets(cur=>{
    const next=cur.includes(k)?cur.filter(x=>x!==k):[...cur,k];
    return next.length?STRING_SETS.filter(s=>next.includes(s.key)).map(s=>s.key):cur; // keep canonical order; never empty
  }),[]);

  const resetAll=useCallback(()=>{
    setPosIdx(0);setPins({});setPickIdx(null);setOverlayIdx(null);
  },[]);

  // Every voicing for a chord across the active sets, tagged with its set.
  const candidatesFor=useCallback(ch=>{
    const nts=QS[ch.quality].iv.map(iv=>(ch.root+iv)%12);
    const out=[];
    for (const set of STRING_SETS.filter(s=>selectedSets.includes(s.key)))
      for (const v of getVoicings(nts,ch.root,set.strs)) out.push({...v,set});
    return out.sort((a,b)=>centerOf(a)-centerOf(b));
  },[selectedSets]);

  // Selectable neck positions for bar 1, low to high (voicings sharing a fret
  // window collapse into one position). These are neck locations, not sets —
  // the set mix within a pass is chosen per chord by the voice-leading.
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

  // The voice-led path from the chosen neck position. Pins force a bar's voicing
  // (later bars re-lead from it); repeated chords keep their voicing; otherwise
  // each chord takes the voicing nearest the position's fret window across the
  // active sets (posCost) — so a single pass mixes 3-2-1 / 4-3-2 where it fits.
  const path=useMemo(()=>{
    if (!chords.length) return [];
    const p=[];
    let win=null;
    for (let i=0;i<chords.length;i++){
      const ch=chords[i];
      const cands=candidatesFor(ch);
      if (!cands.length){p.push(null);continue;}
      const pin=pins[i]??null;
      const pinned=pin!=null?cands.find(v=>pinKeyOf(v)===pin):null;
      if (pinned){p.push(pinned);win=centerOf(pinned);continue;}
      if (i>0&&chords[i-1].root===ch.root&&chords[i-1].quality===ch.quality&&p[i-1]){p.push(p[i-1]);continue;}
      if (i===0){const list=anchorsFrom(cands);const v=list[Math.min(pi,list.length-1)];p.push(v);win=centerOf(v);continue;}
      const prev=p[i-1];
      if (!prev){p.push(cands.find(v=>!hasOpenString(v.frets))||cands[0]);continue;}
      if (multi){let best=null,bs=Infinity;for(const v of cands){const c=posCost(v,prev,win);if(c<bs){bs=c;best=v;}}p.push(best);}
      else p.push(closestVoicing(cands,prev.frets));
    }
    return p;
  },[chords,candidatesFor,anchorsFrom,pins,multi,pi]);

  const posLabel=useMemo(()=>{
    const v=path[0]; if (!v||!chords.length) return '';
    const z=matchCAGEDZone(chords[0].root,chords[0].quality,v.frets);
    return `${fretRangeLabel(v)}${z?` · ${z.name}-shape`:''}`;
  },[path,chords]);

  const distances=useMemo(()=>{
    const minFret=f=>{const nz=f.filter(x=>x>0);return nz.length?Math.min(...nz):0;};
    const d=[];
    for (let i=1;i<path.length;i++){
      if(path[i]&&path[i-1]){d.push(minFret(path[i].frets)-minFret(path[i-1].frets));}
      else d.push(null);
    }
    return d;
  },[path]);

  const overlayData=useMemo(()=>{
    if (overlayIdx===null||overlayIdx>=chords.length||!path[overlayIdx]) return null;
    const ch=chords[overlayIdx];
    return computeOverlay(ch.root,ch.quality,path[overlayIdx],path[overlayIdx].set.strs);
  },[overlayIdx,chords,path]);

  const addChord=deg=>{const d=DEGS[deg];setProg(p=>{if(p.length>=1)setShownSecondHelper(true);return[...p,{deg:d.i,q:selectedQuality}];});};
  // Re-home pins across a bar removal (indices shift); drop the removed bar's pin.
  const removeChord=idx=>{
    setProg(p=>p.filter((_,i)=>i!==idx));
    if(idx===0)resetAll();
    setPins(prev=>{const n={};Object.entries(prev).forEach(([k,v])=>{const ki=parseInt(k);if(ki<idx)n[ki]=v;else if(ki>idx)n[ki-1]=v;});return n;});
    setPickIdx(null);setOverlayIdx(null);
  };
  const pinBar=(ci,v)=>{setPins(prev=>({...prev,[ci]:pinKeyOf(v)}));setPickIdx(null);};
  const unpinBar=ci=>setPins(prev=>{const n={...prev};delete n[ci];return n;});

  if (printMode && chords.length>0 && path.length>0) {
    return <PrintPreview chords={chords} path={path} distances={distances} keyName={NOTES[key]} onClose={()=>setPrintMode(false)}/>;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-1 py-3">
        <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0">
          <ellipse cx="28" cy="14" rx="18" ry="5" fill="#78716c"/><rect x="17" y="4" width="22" height="11" rx="4" fill="#a8a29e"/><rect x="10" y="13" width="36" height="3" rx="1.5" fill="#78716c"/><circle cx="28" cy="24" r="9" fill="#fde68a"/><circle cx="25" cy="22" r="1.2" fill="#1c1917"/><circle cx="31" cy="22" r="1.2" fill="#1c1917"/><path d="M24 26 Q28 29 32 26" stroke="#1c1917" strokeWidth="0.8" fill="none"/><path d="M20 26 Q22 36 28 38 Q34 36 36 26" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.5"/><path d="M22 27 Q24 34 28 36 Q32 34 34 27" fill="#e5e7eb"/><rect x="20" y="33" width="16" height="18" rx="3" fill="#3b82f6"/><rect x="22" y="33" width="12" height="10" rx="2" fill="#60a5fa"/><line x1="23" y1="33" x2="25" y2="39" stroke="#2563eb" strokeWidth="1.5"/><line x1="33" y1="33" x2="31" y2="39" stroke="#2563eb" strokeWidth="1.5"/><circle cx="25" cy="39" r="0.8" fill="#fbbf24"/><circle cx="31" cy="39" r="0.8" fill="#fbbf24"/><ellipse cx="42" cy="42" rx="7" ry="9" fill="#92400e" stroke="#78350f" strokeWidth="0.8"/><ellipse cx="42" cy="42" rx="4" ry="6" fill="#b45309"/><circle cx="42" cy="42" r="1.5" fill="#1c1917"/><rect x="41" y="28" width="2" height="15" rx="1" fill="#78350f"/><rect x="39" y="27" width="6" height="3" rx="1" fill="#92400e"/><path d="M35 38 Q38 40 40 42" stroke="#fde68a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        </svg>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-amber-400">Mr. Triad</h1>
          <p className="text-sm text-gray-400">Choose a key and add your chords, then find the smoothest path through your progression.</p>
        </div>
        <div className="flex gap-2 flex-col sm:flex-row">
          <a href="#/triadfinder" className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-700 text-emerald-100 border border-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-400 transition-all whitespace-nowrap text-center">Triad Finder →</a>
          <a href="#/player" className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-700 text-emerald-100 border border-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-400 transition-all whitespace-nowrap text-center">Player →</a>
        </div>
      </div>

      <div className="mb-4 mt-4">
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Key</label>
        <div className="flex flex-wrap gap-1.5">
          {NOTES.map((n,i)=>(<button key={i} onClick={()=>{setKey(i);resetAll();}} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${key===i?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{n}</button>))}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2"><label className="text-xs text-gray-400 uppercase tracking-wide">Add Chords</label></div>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {DEGS.map((d,i)=>(<button key={i} onClick={()=>addChord(i)} className="px-3 py-1.5 rounded text-sm font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-all">{d.n}</button>))}
          {prog.length===0&&(
            <div className="flex items-center gap-1.5 ml-1 animate-fade-slide-in">
              <div className="animate-nudge"><svg width="20" height="16" viewBox="0 0 20 16"><path d="M16 8 L4 8" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/><path d="M9 3 L4 8 L9 13" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <span className="text-sm text-amber-300 font-medium">Pick a starting chord, partner 🤠</span>
            </div>
          )}
          {prog.length===1&&!shownSecondHelper&&(
            <div className="flex items-center gap-1.5 ml-1 animate-fade-slide-in">
              <div className="animate-nudge"><svg width="20" height="16" viewBox="0 0 20 16"><path d="M16 8 L4 8" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/><path d="M9 3 L4 8 L9 13" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <span className="text-sm text-amber-300 font-medium">Grab a few more to build your progression 🤠</span>
            </div>
          )}
        </div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Chord Quality <span className="normal-case text-gray-600">(applied to next chord added)</span></label>
        <div className="flex flex-wrap gap-1.5">
          {QKEYS.map(q=>(<button key={q} onClick={()=>setSelectedQuality(q)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${selectedQuality===q?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{QS[q].l}</button>))}
        </div>
      </div>

      {prog.length>0&&(
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400 uppercase tracking-wide">Progression in {NOTES[key]}</label>
            <div className="flex gap-2">
              {chords.length>0&&path.length>0&&(
                <button onClick={()=>setPrintMode(true)} className="px-3 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all duration-200 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="1" width="8" height="4"/><rect x="1" y="5" width="14" height="7" rx="1"/><rect x="4" y="10" width="8" height="5"/><circle cx="12" cy="8" r="0.8" fill="currentColor"/></svg>
                  Print View
                </button>
              )}
              <button onClick={()=>{setProg([]);resetAll();setShownSecondHelper(false);}} className="px-3 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:bg-red-600 hover:text-white hover:border-red-500 transition-all duration-200">Reset</button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 overflow-x-auto">
            <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span> Root</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span> Other notes</span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Strings</span>
                {STRING_SETS.map(s=>{
                  const on=selectedSets.includes(s.key);
                  return (<button key={s.key} onClick={()=>{toggleSet(s.key);setPickIdx(null);}} title={s.names}
                    style={on?{backgroundColor:s.color,color:'#0b0b0b',borderColor:s.color}:undefined}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border border-transparent transition-all ${on?'':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{s.label}</button>);
                })}
                <span className="text-[10px] text-gray-500 normal-case">{multi?'voice-leading across sets':'single set'}</span>
              </div>
              {positions.length>0&&(
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Position <span className="normal-case text-gray-600">{positions.length>1?`${pi+1}/${positions.length} · `:''}{posLabel}</span></span>
                  <button onClick={()=>setPosIdx(Math.max(0,pi-1))} disabled={pi<=0} title="Move the whole progression lower on the neck" className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">▼</button>
                  <button onClick={()=>setPosIdx(Math.min(positions.length-1,pi+1))} disabled={pi>=positions.length-1} title="Move the whole progression higher on the neck" className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">▲</button>
                </div>
              )}
            </div>
            <div className="flex items-start flex-wrap gap-y-4">
              {chords.map((ch,i)=>{
                // Pinned badge reflects the pin actually in effect: if its set was
                // toggled off, the pin is dormant (restored when the set returns).
                const v=path[i],isPinned=!!v&&pins[i]!=null&&pinKeyOf(v)===pins[i];
                return (
                  <div key={i} className="flex items-start">
                    <div className="flex flex-col items-center">
                      <FretDiag voicing={v} strs={v?v.set.strs:undefined} name={ch.name+' ('+ch.numeral+')'} highlight={isPinned} onClick={()=>setPickIdx(pickIdx===i?null:i)} setLabel={v?v.set.label:null} accent={v?v.set.color:undefined} root={ch.root}/>
                      <div className="flex flex-col items-center gap-1 mt-1.5">
                        {v&&(
                          <button onClick={()=>setPickIdx(pickIdx===i?null:i)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 w-full ${pickIdx===i?'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-500/30':isPinned?'bg-amber-500 text-gray-900 border border-amber-400 hover:bg-amber-400':'bg-emerald-700 text-emerald-100 hover:bg-emerald-500 hover:text-white border border-emerald-600 hover:border-emerald-400'}`}>{isPinned?'Pinned':'Voicings'}</button>
                        )}
                        {v&&(
                          <button onClick={()=>strum(voicingMidis(v.set.strs,v.frets))} className="px-3 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-amber-500 hover:text-gray-900 hover:border-amber-400 transition-all duration-200 w-full">▶ Play</button>
                        )}
                        {path[i]&&(
                          <button onClick={()=>setOverlayIdx(overlayIdx===i?null:i)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 w-full ${overlayIdx===i?'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-500/30':'bg-emerald-700 text-emerald-100 hover:bg-emerald-500 hover:text-white border border-emerald-600 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105'}`}>Overlay</button>
                        )}
                        <button onClick={()=>removeChord(i)} className="px-3 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:bg-red-600 hover:text-white hover:border-red-500 transition-all duration-200 w-full">Remove</button>
                      </div>
                    </div>
                    {i<chords.length-1&&distances[i]!==null&&<Arrow dist={distances[i]}/>}
                  </div>
                );
              })}
            </div>

            {pickIdx!==null&&pickIdx<chords.length&&(()=>{
              const ch=chords[pickIdx];
              const cands=candidatesFor(ch);
              if (!cands.length) return null;
              const cur=path[pickIdx],curKey=pinKeyOf(cur),effPin=pins[pickIdx];
              const active=STRING_SETS.filter(s=>selectedSets.includes(s.key));
              return (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-emerald-700/50">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="text-xs text-emerald-400">Voicings for <span className="font-bold">{ch.name}</span> — click one to pin this bar; later bars re-lead from it</div>
                    <button onClick={()=>unpinBar(pickIdx)} title="Let the voice-leading engine choose this bar" className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all whitespace-nowrap ${effPin==null?'bg-emerald-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>Auto</button>
                  </div>
                  {active.map(s=>{
                    const group=cands.filter(v=>v.set.key===s.key);
                    if (!group.length) return null;
                    return (
                      <div key={s.key} className="mb-3">
                        <div className="text-xs font-semibold mb-2" style={{color:s.color}}>{s.label} <span className="text-gray-500 font-normal">{s.names}</span></div>
                        <div className="flex flex-wrap gap-3">
                          {group.map(v=>{
                            const k=pinKeyOf(v),pinned=effPin===k,current=k===curKey;
                            return (
                              <div key={k} onClick={()=>pinBar(pickIdx,v)} className={`cursor-pointer rounded-lg border p-1.5 pb-0.5 flex flex-col items-center transition-all ${pinned?'border-amber-500 bg-amber-500/10':current?'border-emerald-600 bg-emerald-500/10':'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                                <div className={`text-[10px] font-medium ${pinned?'text-amber-400':current?'text-emerald-400':'text-gray-400'}`}>{fretRangeLabel(v)}{current&&!pinned?' · playing':''}</div>
                                <FretDiag voicing={v} strs={v.set.strs} name={null} size="small" accent={v.set.color} root={ch.root}/>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {overlayData&&<OverlayDiagram data={overlayData}/>}
          </div>

          {prog.length===1&&(
            <div className="text-xs text-gray-500 mt-3"><strong className="text-gray-400">Tip:</strong> Use <strong>Position</strong> to slide the whole progression up or down the neck, or click a chord's <strong>Voicings</strong> to pin a specific shape — later chords re-lead from it.</div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-gray-400">
              <thead><tr className="border-b border-gray-800">
                {['Chord','Strings','Notes','Frets','Inv.','Shift'].map(h=>(<th key={h} className="text-left py-1.5 pr-3 text-gray-500 font-medium">{h}</th>))}
              </tr></thead>
              <tbody>
                {chords.map((ch,i)=>{
                  const v=path[i];
                  if (!v) return <tr key={i} className="border-b border-gray-800/50"><td className="py-1.5 pr-3 text-amber-400 font-medium">{ch.name}</td><td colSpan={5} className="py-1.5 text-gray-600 italic">No voicing available</td></tr>;
                  return (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-3 text-amber-400 font-medium">{ch.name}</td>
                      <td className="py-1.5 pr-3" style={{color:v.set.color}}>{v.set.label}</td>
                      <td className="py-1.5 pr-3">{v.notes.map(n=>NOTES[n]).join(', ')}</td>
                      <td className="py-1.5 pr-3 font-mono">{v.frets.join('-')}</td>
                      <td className="py-1.5 pr-3">{v.inv+rootStrLabel(v,v.set.strs)}</td>
                      <td className="py-1.5">{i===0?'—':distances[i-1]!==null?shiftLabel(distances[i-1]):'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p><strong className="text-gray-500">How to use:</strong> Set chord quality, add chords, and the smoothest path is voice-led for you across the active <strong>string sets</strong> (toggle them, and use <strong>Position</strong> to move the whole path up or down the neck). With more than one set on, each chord takes the voicing that keeps your hand in the <strong>Position</strong> — so a single pass mixes 3-2-1 and 4-3-2 where the other set sits closer (each chord's card is colored by its set). Click any chord's <strong>Voicings</strong> to pin a specific shape (later chords re-lead from it; <strong>Auto</strong> unpins). Click <strong>Overlay</strong> to see the CAGED chord shape and pentatonic scale around any voicing. 7th chord voicings use shell voicings (root, 3rd/b3rd, 7th) — the 5th is omitted to fit 3 strings.</p>
      </div>
    </div>
    </div>
  );
}
