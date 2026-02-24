import { useState, useMemo, useCallback } from "react";

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const OPEN = { 1:4, 2:11, 3:7, 4:2, 5:9, 6:4 };
const SNAME = { 1:'E', 2:'B', 3:'G', 4:'D', 5:'A', 6:'E' };
const SETS = {
  s1: { strs:[3,2,1], label:'Strings 3-2-1 (G, B, E)' },
  s2: { strs:[4,3,2], label:'Strings 4-3-2 (D, G, B)' },
};
const SCALE = [0,2,4,5,7,9,11];
const DEGS = [
  {n:'I',i:0,q:'maj'},{n:'ii',i:1,q:'min'},{n:'iii',i:2,q:'min'},
  {n:'IV',i:3,q:'maj'},{n:'V',i:4,q:'maj'},{n:'vi',i:5,q:'min'},
  {n:'vii°',i:6,q:'dim'},
];
const QS = {
  maj:{iv:[0,4,7],s:'',l:'Major'},
  min:{iv:[0,3,7],s:'m',l:'Minor'},
  dim:{iv:[0,3,6],s:'°',l:'Dim'},
  aug:{iv:[0,4,8],s:'+',l:'Aug'},
  sus2:{iv:[0,2,7],s:'sus2',l:'Sus2'},
  sus4:{iv:[0,5,7],s:'sus4',l:'Sus4'},
  '7':{iv:[0,4,10],s:'7',l:'Dom7'},
  maj7:{iv:[0,4,11],s:'maj7',l:'Maj7'},
  min7:{iv:[0,3,10],s:'m7',l:'Min7'},
};
const QKEYS = Object.keys(QS);
const IV_LABEL = {0:'R',2:'2',3:'♭3',4:'3',5:'4',6:'♭5',7:'5',8:'♯5',9:'6',10:'♭7',11:'7'};

const CAGED = {
  maj: [
    {n:'E',a:6,t:{6:[[0,0]],5:[[2,7]],4:[[2,0]],3:[[1,4]],2:[[0,7]],1:[[0,0]]}},
    {n:'G',a:6,t:{6:[[0,0]],5:[[-1,4]],4:[[-3,7]],3:[[-3,0]],2:[[-3,4]],1:[[0,0]]}},
    {n:'A',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[2,0]],2:[[2,4]],1:[[0,7]]}},
    {n:'C',a:5,t:{5:[[0,0]],4:[[-1,4]],3:[[-3,7]],2:[[-2,0]],1:[[-3,4]]}},
    {n:'D',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[3,0]],1:[[2,4]]}},
  ],
  min: [
    {n:'Em',a:6,t:{6:[[0,0]],5:[[2,7]],4:[[2,0]],3:[[0,3]],2:[[0,7]],1:[[0,0]]}},
    {n:'Am',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[2,0]],2:[[1,3]],1:[[0,7]]}},
    {n:'Dm',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[3,0]],1:[[1,3]]}},
  ]
};

function perm3(arr) {
  const r=[];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) for (let k=0;k<3;k++)
    if (i!==j&&j!==k&&i!==k) r.push([arr[i],arr[j],arr[k]]);
  return r;
}
function fretSpan(frets) {
  const nz=frets.filter(f=>f>0);
  if (nz.length<=1) return 0;
  return Math.max(...nz)-Math.min(...nz);
}
function hasOpenString(frets) { return frets.some(f=>f===0); }

function getVoicings(notes,root,strs,mxF=14,mxS=5) {
  const vs=[],seen=new Set(),ps=perm3([0,1,2]);
  for (const p of ps) {
    const asgn=p.map(i=>notes[i]);
    const opts=strs.map((s,idx)=>{
      const o=OPEN[s],fs=[];
      let f=((asgn[idx]-o)%12+12)%12;
      while(f<=mxF){fs.push(f);f+=12;}
      return fs;
    });
    for (const a of opts[0]) for (const b of opts[1]) for (const c of opts[2]) {
      const fr=[a,b,c],span=fretSpan(fr);
      if (span<=mxS&&Math.max(...fr)<=mxF) {
        const k=fr.join(',');
        if (!seen.has(k)) {
          seen.add(k);
          const noteIvs=notes.map(n=>((n-root+12)%12));
          const loIv=((asgn[0]-root+12)%12);
          let inv='Root in bass';
          if (loIv===noteIvs[1]) inv='3rd in bass';
          else if (loIv===noteIvs[2]) inv='5th in bass';
          vs.push({frets:fr,notes:asgn,rootIdx:asgn.reduce((a,n,i)=>n===root?[...a,i]:a,[]),pos:fr.reduce((a,b)=>a+b,0)/3,inv,span});
        }
      }
    }
  }
  return vs.sort((a,b)=>a.pos-b.pos);
}

function scoreVoicing(v,pf) {
  return v.frets.reduce((s,f,j)=>s+Math.abs(f-pf[j]),0)+(v.span>3?(v.span-3)*8:0);
}
function closestVoicing(vs,pf) {
  if (!vs.length) return null;
  let best=null,bs=Infinity;
  for (const v of vs){const s=scoreVoicing(v,pf);if(s<bs){bs=s;best=v;}}
  return best;
}
function avgFretPos(f) {
  const nz=f.filter(x=>x>0);
  return nz.length?nz.reduce((a,b)=>a+b,0)/nz.length:0;
}
function rootStrLabel(v,strs) {
  if (!v.rootIdx.length) return '';
  return ', Root on '+strs[v.rootIdx[0]];
}
function voicingKey(v) { return v?v.frets.join(','):''; }

function matchCAGED(root,quality,vN,vF,vS) {
  const qk=['min','min7'].includes(quality)?'min':'maj';
  const shapes=CAGED[qk];
  if (!shapes) return null;
  for (const shape of shapes) {
    const ab=((root-OPEN[shape.a])%12+12)%12;
    for (let o=0;o<=1;o++) {
      const af=ab+o*12;
      let ok=true;
      for (let i=0;i<vS.length;i++) {
        const s=vS[i],f=vF[i],iv=((vN[i]-root)%12+12)%12;
        const st=shape.t[s];
        if (!st){ok=false;break;}
        if (!st.some(([off,sIv])=>{const ef=af+off;return(f===ef||f===ef+12||f===ef-12)&&sIv===iv;})){ok=false;break;}
      }
      if (ok) return {name:shape.n,anchorFret:af,shape};
    }
  }
  return null;
}

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

  return (
    <div className={compact?'':'mt-3 bg-gray-900/80 rounded-xl p-4 border border-gray-700 overflow-x-auto'}>
      <div className={`flex items-center gap-3 flex-wrap ${compact?'mb-1':'mb-3'}`}>
        {shapeName&&<span className={`font-bold ${compact?'text-xs text-emerald-600':'text-sm text-emerald-400'}`}>CAGED: <span className={compact?'text-amber-700':'text-amber-300'}>{shapeName}</span></span>}
        {!compact&&(
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-emerald-400 bg-emerald-400/20"></span>Pentatonic</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-cyan-400 bg-cyan-400/20"></span>CAGED chord shape</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded-full bg-amber-500"></span>Triad (root)</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3.5 h-3.5 rounded-full bg-blue-500"></span>Triad (other)</span>
          </div>
        )}
      </div>
      <div className="flex justify-center">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {Array.from({length:nF+1},(_,i)=>{const y=fy(rStart+i),isN=rStart+i===0;return <line key={i} x1={ml-6} y1={y} x2={sx(5)+6} y2={y} stroke={isN?(compact?'#111':'#e5e7eb'):(compact?'#bbb':'#4b5563')} strokeWidth={isN?(compact?2:3):compact?0.5:1}/>;})}
          {Array.from({length:nF},(_,i)=>{const f=rStart+i+1;return f>=1?<text key={i} x={ml-14} y={fy(rStart+i+1)-fretSp/2+4} fontSize={compact?7:10} fill={compact?'#999':'#6b7280'} textAnchor="middle">{f}</text>:null;})}
          {so.map((s,i)=>(<g key={s}><line x1={sx(i)} y1={fy(rStart)} x2={sx(i)} y2={fy(rEnd)} stroke={compact?'#999':'#6b7280'} strokeWidth={s>=4?(compact?1:1.4):(compact?0.7:1)}/><text x={sx(i)} y={mt-14} fontSize={compact?7:10} fill={compact?'#888':'#9ca3af'} textAnchor="middle" fontFamily="monospace">{SNAME[s]}</text></g>))}
          {[3,5,7,9,12,15].filter(f=>f>rStart&&f<=rEnd).map(f=>{const y=fy(f)-fretSp/2;if(f===12) return <g key={f}><circle cx={sx(1)} cy={y} r={3} fill={compact?'#ddd':'#374151'}/><circle cx={sx(4)} cy={y} r={3} fill={compact?'#ddd':'#374151'}/></g>;return <circle key={f} cx={(sx(2)+sx(3))/2} cy={y} r={3} fill={compact?'#ddd':'#374151'}/>;})}
          {pentNotes.map((n,i)=>{const si=so.indexOf(n.string);if(si<0) return null;const x=sx(si),y=n.fret===0?(hasNut?fy(0)-12:nY(0)):nY(n.fret);const isR=n.interval===0;return <g key={'p'+i}><circle cx={x} cy={y} r={dr} fill={isR?'rgba(251,191,36,0.15)':'rgba(16,185,129,0.15)'} stroke={isR?(compact?'#b45309':'#fbbf24'):(compact?'#059669':'#10b981')} strokeWidth={compact?1:1.5}/><text x={x} y={y+0.5} fontSize={f1} fill={isR?(compact?'#b45309':'#fbbf24'):(compact?'#059669':'#6ee7b7')} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{IV_LABEL[n.interval]||n.interval}</text></g>;})}
          {chordNotes.map((n,i)=>{const si=so.indexOf(n.string);if(si<0) return null;const x=sx(si),y=n.fret===0?(hasNut?fy(0)-12:nY(0)):nY(n.fret);const isR=n.interval===0;return <g key={'c'+i}><circle cx={x} cy={y} r={cr2} fill={isR?'rgba(251,191,36,0.15)':'rgba(34,211,238,0.15)'} stroke={isR?(compact?'#b45309':'#fbbf24'):(compact?'#06b6d4':'#22d3ee')} strokeWidth={compact?1.5:2}/><text x={x} y={y+0.5} fontSize={f2} fill={isR?(compact?'#b45309':'#fbbf24'):(compact?'#06b6d4':'#22d3ee')} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{IV_LABEL[n.interval]||n.interval}</text></g>;})}
          {triadStrs.map((s,i)=>{const si=so.indexOf(s);if(si<0) return null;const f=triadFrets[i],x=sx(si),y=f===0?(hasNut?fy(0)-12:nY(0)):nY(f);const isR=triadRootIdx.includes(i);const iv=gIv(triadNotes[i]),label=iv===0?'R':(IV_LABEL[iv]||iv);return <g key={'t'+i}><circle cx={x} cy={y} r={tr} fill={isR?rc:bc} stroke={isR?rs:bs} strokeWidth={2}/><text x={x} y={y+0.5} fontSize={f3} fill={isR?'#000':'#fff'} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;})}
        </svg>
      </div>
    </div>
  );
}

/* ---- Chord Diagram ---- */
function FretDiag({voicing,strs,name,highlight,onClick,size="normal",setLabel,root}) {
  if (!voicing) return (
    <div className="flex flex-col items-center">
      {name&&<div className="text-sm font-bold text-amber-400 mb-1">{name}</div>}
      <div className="text-xs text-gray-500 italic p-4">No voicing</div>
    </div>
  );
  const {frets,notes,rootIdx}=voicing;
  const maxF=Math.max(...frets),minNZ=Math.min(...frets.filter(f=>f>0),maxF);
  let startF=maxF<=4?0:Math.max(0,minNZ-1),endF=Math.max(startF+4,maxF+1);
  const nFrets=endF-startF,hasNut=startF===0;
  const sm=size==="small";
  const w=sm?102:128,h=sm?135:162;
  const m=sm?{t:38,b:14,l:36,r:16}:{t:44,b:18,l:42,r:20};
  const pw=w-m.l-m.r,ph=h-m.t-m.b,ss=pw/2,fs=ph/nFrets;
  const dotR=sm?10:12,fSize=sm?8:9;
  const border=highlight?'ring-2 ring-amber-500 ring-offset-2 ring-offset-gray-950':'';
  const cursor=onClick?'cursor-pointer hover:opacity-80':'';
  return (
    <div className={`flex flex-col items-center ${cursor}`} onClick={onClick}>
      {name&&<div className={`font-bold text-amber-400 mb-1 text-center leading-tight ${sm?'text-xs':'text-sm'}`}>{name}</div>}
      {setLabel&&<div className="text-xs text-emerald-400 mb-0.5">{setLabel}</div>}
      <div className={`rounded-lg mt-1.5 transition-all ${highlight?'bg-amber-500/10 p-3':'p-0'} ${border}`}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {hasNut?<line x1={m.l-2} y1={m.t} x2={m.l+pw+2} y2={m.t} stroke="#e5e7eb" strokeWidth={3}/>:<text x={m.l-24} y={m.t+fs/2+4} fontSize="9" fill="#9ca3af" textAnchor="middle">{minNZ}fr</text>}
          {Array.from({length:nFrets+1},(_,i)=>(<line key={i} x1={m.l} y1={m.t+i*fs} x2={m.l+pw} y2={m.t+i*fs} stroke={i===0&&hasNut?"#e5e7eb":"#4b5563"} strokeWidth={i===0&&hasNut?3:1}/>))}
          {[0,1,2].map(i=>(<line key={i} x1={m.l+i*ss} y1={m.t} x2={m.l+i*ss} y2={m.t+nFrets*fs} stroke="#6b7280" strokeWidth={1.2}/>))}
          {strs.map((s,i)=>(<text key={s} x={m.l+i*ss} y={m.t-22} fontSize={sm?"9":"11"} fill="#9ca3af" textAnchor="middle" fontFamily="monospace">{SNAME[s]}</text>))}
          {frets.map((f,i)=>{
            const isRoot=rootIdx.includes(i);
            const iv=root!==undefined?((notes[i]-root+12)%12):null;
            const label=iv!==null?(IV_LABEL[iv]||iv):NOTES[notes[i]];
            const col=isRoot?"#f59e0b":"#3b82f6",strk=isRoot?"#fbbf24":"#60a5fa",tc=isRoot?"#000":"#fff";
            if (f===0){const cx=m.l+i*ss,cy=hasNut?m.t-5:m.t-8;return <g key={i}><circle cx={cx} cy={cy} r={dotR*0.75} fill={col} stroke={strk} strokeWidth={1.5}/><text x={cx} y={cy+0.5} fontSize={fSize} fill={tc} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;}
            const x=m.l+i*ss,y=m.t+(f-startF-0.5)*fs;
            return <g key={i}><circle cx={x} cy={y} r={dotR} fill={col} stroke={strk} strokeWidth={1.5}/><text x={x} y={y+0.5} fontSize={fSize} fill={tc} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;
          })}
        </svg>
      </div>
      <div className="text-xs text-gray-500 mt-2.5">({notes.map((n,j)=>{const nn=NOTES[n];return rootIdx.includes(j)?<strong key={j} className="text-gray-300">{nn}</strong>:nn;}).reduce((acc,el,j)=>j===0?[el]:[...acc,'-',el],[])}) Frets: {frets.join('-')}</div>
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
function PrintPreview({chords,path,pathSets,distances,keyName,onClose}) {
  const allOverlays=chords.map((ch,i)=>{
    if (!path[i]) return null;
    const sk=pathSets[i];
    return computeOverlay(ch.root,ch.quality,path[i],SETS[sk].strs);
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
            const sk=pathSets[i],v=path[i];
            if (!v) return null;
            const strs=SETS[sk].strs,{frets,notes,rootIdx}=v;
            const maxF=Math.max(...frets),minNZ=Math.min(...frets.filter(f=>f>0),maxF);
            let startF=maxF<=4?0:Math.max(0,minNZ-1),endF=Math.max(startF+4,maxF+1);
            const nFr=endF-startF,hasNut=startF===0;
            const cw=100,ch2=130,mg={t:36,b:10,l:32,r:14};
            const pw=cw-mg.l-mg.r,ph=ch2-mg.t-mg.b,ss=pw/2,fs2=ph/nFr;
            return (
              <div key={i} className="flex items-start">
                <div className="flex flex-col items-center">
                  <div className="text-[11px] font-bold text-amber-700 mb-0.5">{ch.name} ({ch.numeral})</div>
                  <div className="text-[8px] text-emerald-700">{sk==='s1'?'3-2-1':'4-3-2'}</div>
                  <svg width={cw} height={ch2} viewBox={`0 0 ${cw} ${ch2}`}>
                    {hasNut?<line x1={mg.l-2} y1={mg.t} x2={mg.l+pw+2} y2={mg.t} stroke="#111" strokeWidth={3}/>:<text x={mg.l-20} y={mg.t+fs2/2+3} fontSize="8" fill="#666" textAnchor="middle">{minNZ}fr</text>}
                    {Array.from({length:nFr+1},(_,j)=>(<line key={j} x1={mg.l} y1={mg.t+j*fs2} x2={mg.l+pw} y2={mg.t+j*fs2} stroke={j===0&&hasNut?'#111':'#bbb'} strokeWidth={j===0&&hasNut?3:0.5}/>))}
                    {[0,1,2].map(j=>(<line key={j} x1={mg.l+j*ss} y1={mg.t} x2={mg.l+j*ss} y2={mg.t+nFr*fs2} stroke="#999" strokeWidth={0.8}/>))}
                    {strs.map((s,j)=>(<text key={s} x={mg.l+j*ss} y={mg.t-18} fontSize="8" fill="#666" textAnchor="middle" fontFamily="monospace">{SNAME[s]}</text>))}
                    {frets.map((f,j)=>{
                      const isR=rootIdx.includes(j),nn=NOTES[notes[j]];
                      const col=isR?'#b45309':'#2563eb';
                      if (f===0){const cx=mg.l+j*ss,cy=hasNut?mg.t-5:mg.t-8;return <g key={j}><circle cx={cx} cy={cy} r={7} fill={col}/><text x={cx} y={cy+0.5} fontSize="7" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{nn}</text></g>;}
                      const x=mg.l+j*ss,y=mg.t+(f-startF-0.5)*fs2;
                      return <g key={j}><circle cx={x} cy={y} r={9} fill={col}/><text x={x} y={y+0.5} fontSize="7" fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{nn}</text></g>;
                    })}
                  </svg>
                  <div className="text-[7px] text-gray-500 mt-0.5">{v.inv+rootStrLabel(v,strs)} · {frets.join('-')}</div>
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
              const v=path[i],sk=pathSets[i];
              if (!v) return null;
              return (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-bold text-amber-700">{ch.name}</td>
                  <td className="py-1 pr-2 text-emerald-700">{sk==='s1'?'3-2-1':'4-3-2'}</td>
                  <td className="py-1 pr-2">{v.notes.map(n=>NOTES[n]).join(', ')}</td>
                  <td className="py-1 pr-2 font-mono">{v.frets.join('-')}</td>
                  <td className="py-1 pr-2">{v.inv+rootStrLabel(v,SETS[sk].strs)}</td>
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

/* ---- Main App ---- */
export default function App() {
  const [key,setKey]=useState(0);
  const [prog,setProg]=useState([]);
  const [selectedQuality,setSelectedQuality]=useState('maj');
  const [startChoice,setStartChoice]=useState({setKey:'s1',voicingIdx:-1});
  const [overrides,setOverrides]=useState({});
  const [showAltIdx,setShowAltIdx]=useState(null);
  const [shownSecondHelper,setShownSecondHelper]=useState(false);
  const [overlayIdx,setOverlayIdx]=useState(null);
  const [printMode,setPrintMode]=useState(false);

  const chords=useMemo(()=>prog.map(p=>{
    const root=(key+SCALE[p.deg])%12,nts=QS[p.q].iv.map(iv=>(root+iv)%12);
    return {notes:nts,root,name:NOTES[root]+QS[p.q].s,numeral:p.numeral,quality:p.q};
  }),[key,prog]);

  const firstVoicings=useMemo(()=>{
    if (!chords.length) return {s1:[],s2:[]};
    return {s1:getVoicings(chords[0].notes,chords[0].root,SETS.s1.strs),s2:getVoicings(chords[0].notes,chords[0].root,SETS.s2.strs)};
  },[chords]);

  const resetAll=useCallback(()=>{
    setStartChoice({setKey:'s1',voicingIdx:-1});setOverrides({});setShowAltIdx(null);setOverlayIdx(null);
  },[]);

  const selectedStart=useMemo(()=>{
    const vs=firstVoicings[startChoice.setKey];
    if (!vs.length) return null;
    if (startChoice.voicingIdx>=0) return vs[startChoice.voicingIdx]||vs[0];
    const nonOpen=vs.find(v=>!hasOpenString(v.frets));
    return nonOpen||vs[0];
  },[firstVoicings,startChoice]);

  const startSet=startChoice.setKey;

  const {path,pathSets}=useMemo(()=>{
    if (!chords.length||!selectedStart) return {path:[],pathSets:[]};
    const firstV=overrides[0]?overrides[0].voicing:selectedStart;
    const firstS=overrides[0]?overrides[0].setKey:startSet;
    const p=[firstV],ps=[firstS];
    for (let i=1;i<chords.length;i++){
      const ch=chords[i],prev=p[i-1];
      if (!prev){p.push(null);ps.push(ps[i-1]);continue;}
      if (overrides[i]){p.push(overrides[i].voicing);ps.push(overrides[i].setKey);}
      else {const prevSet=ps[i-1];const vs=getVoicings(ch.notes,ch.root,SETS[prevSet].strs);p.push(closestVoicing(vs,prev.frets));ps.push(prevSet);}
    }
    return {path:p,pathSets:ps};
  },[chords,selectedStart,startSet,overrides]);

  const altVoicings=useMemo(()=>chords.map((ch,i)=>{
    if (i>0&&!path[i-1]) return [];
    const currSet=pathSets[i],currV=path[i],alts=[];
    const vsSame=getVoicings(ch.notes,ch.root,SETS[currSet].strs);
    for (const v of vsSame){if(currV&&voicingKey(v)===voicingKey(currV)) continue;alts.push({voicing:v,setKey:currSet});}
    const otherSet=currSet==='s1'?'s2':'s1';
    for (const v of getVoicings(ch.notes,ch.root,SETS[otherSet].strs)) alts.push({voicing:v,setKey:otherSet});
    const sortKey=v=>{const nz=v.frets.filter(f=>f>0);return nz.length?Math.min(...nz):0;};
    alts.sort((a,b)=>sortKey(a.voicing)-sortKey(b.voicing)||a.voicing.pos-b.voicing.pos);
    return alts;
  }),[chords,path,pathSets]);

  const distances=useMemo(()=>{
    const d=[];
    for (let i=1;i<path.length;i++){
      if(path[i]&&path[i-1]){d.push(Math.round(avgFretPos(path[i].frets)-avgFretPos(path[i-1].frets)));}
      else d.push(null);
    }
    return d;
  },[path]);

  const overlayData=useMemo(()=>{
    if (overlayIdx===null||overlayIdx>=chords.length||!path[overlayIdx]) return null;
    const ch=chords[overlayIdx],sk=pathSets[overlayIdx];
    return computeOverlay(ch.root,ch.quality,path[overlayIdx],SETS[sk].strs);
  },[overlayIdx,chords,path,pathSets]);

  const addChord=deg=>{const d=DEGS[deg];setProg(p=>{if(p.length>=1)setShownSecondHelper(true);return[...p,{deg:d.i,q:selectedQuality,numeral:d.n}];});};
  const removeChord=idx=>{setProg(p=>p.filter((_,i)=>i!==idx));if(idx===0)resetAll();setOverrides(prev=>{const n={};Object.entries(prev).forEach(([k,v])=>{const ki=parseInt(k);if(ki<idx)n[ki]=v;else if(ki>idx)n[ki-1]=v;});return n;});setShowAltIdx(null);setOverlayIdx(null);};
  const selectAlt=(ci,alt)=>{setOverrides(prev=>{const n={...prev};Object.keys(n).forEach(k=>{if(parseInt(k)>ci)delete n[k];});n[ci]=alt;return n;});setShowAltIdx(null);};
  const clearAltOverride=ci=>{setOverrides(prev=>{const n={...prev};delete n[ci];Object.keys(n).forEach(k=>{if(parseInt(k)>ci)delete n[k];});return n;});setShowAltIdx(null);};

  if (printMode && chords.length>0 && path.length>0) {
    return <PrintPreview chords={chords} path={path} pathSets={pathSets} distances={distances} keyName={NOTES[key]} onClose={()=>setPrintMode(false)}/>;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-1 py-3">
        <svg width="56" height="56" viewBox="0 0 56 56" className="flex-shrink-0">
          <ellipse cx="28" cy="14" rx="18" ry="5" fill="#78716c"/><rect x="17" y="4" width="22" height="11" rx="4" fill="#a8a29e"/><rect x="10" y="13" width="36" height="3" rx="1.5" fill="#78716c"/><circle cx="28" cy="24" r="9" fill="#fde68a"/><circle cx="25" cy="22" r="1.2" fill="#1c1917"/><circle cx="31" cy="22" r="1.2" fill="#1c1917"/><path d="M24 26 Q28 29 32 26" stroke="#1c1917" strokeWidth="0.8" fill="none"/><path d="M20 26 Q22 36 28 38 Q34 36 36 26" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.5"/><path d="M22 27 Q24 34 28 36 Q32 34 34 27" fill="#e5e7eb"/><rect x="20" y="33" width="16" height="18" rx="3" fill="#3b82f6"/><rect x="22" y="33" width="12" height="10" rx="2" fill="#60a5fa"/><line x1="23" y1="33" x2="25" y2="39" stroke="#2563eb" strokeWidth="1.5"/><line x1="33" y1="33" x2="31" y2="39" stroke="#2563eb" strokeWidth="1.5"/><circle cx="25" cy="39" r="0.8" fill="#fbbf24"/><circle cx="31" cy="39" r="0.8" fill="#fbbf24"/><ellipse cx="42" cy="42" rx="7" ry="9" fill="#92400e" stroke="#78350f" strokeWidth="0.8"/><ellipse cx="42" cy="42" rx="4" ry="6" fill="#b45309"/><circle cx="42" cy="42" r="1.5" fill="#1c1917"/><rect x="41" y="28" width="2" height="15" rx="1" fill="#78350f"/><rect x="39" y="27" width="6" height="3" rx="1" fill="#92400e"/><path d="M35 38 Q38 40 40 42" stroke="#fde68a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        </svg>
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Mr. Triad</h1>
          <p className="text-sm text-gray-400">Choose a key and add your chords, then find the smoothest path through your progression.</p>
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
              <span className="text-sm text-amber-300 font-medium">Pick a chord, partner' 🤠</span>
            </div>
          )}
          {prog.length===1&&!shownSecondHelper&&(
            <div className="flex items-center gap-1.5 ml-1 animate-fade-slide-in">
              <div className="animate-nudge"><svg width="20" height="16" viewBox="0 0 20 16"><path d="M16 8 L4 8" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/><path d="M9 3 L4 8 L9 13" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <span className="text-sm text-amber-300 font-medium">Grab a second chord, partner' 🤠</span>
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
            <div className="flex items-start flex-wrap gap-y-4">
              {chords.map((ch,i)=>{
                const currSet=pathSets[i],isOverridden=!!overrides[i];
                return (
                  <div key={i} className="flex items-start">
                    <div className="flex flex-col items-center">
                      <FretDiag voicing={path[i]} strs={currSet?SETS[currSet].strs:SETS.s1.strs} name={ch.name+' ('+ch.numeral+')'} highlight={isOverridden} onClick={altVoicings[i]?.length>0?()=>setShowAltIdx(showAltIdx===i?null:i):undefined} setLabel={currSet?(currSet==='s1'?'3-2-1':'4-3-2'):null} root={ch.root}/>
                      <div className="flex flex-col items-center gap-1 mt-1.5">
                        {altVoicings[i]?.length>0&&(
                          <button onClick={()=>setShowAltIdx(showAltIdx===i?null:i)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 w-full ${showAltIdx===i?'bg-emerald-600 text-white border border-emerald-500 shadow-lg shadow-emerald-500/30':isOverridden?'bg-amber-500 text-gray-900 border border-amber-400 hover:bg-amber-400':'bg-emerald-700 text-emerald-100 hover:bg-emerald-500 hover:text-white border border-emerald-600 hover:border-emerald-400'}`}>Alt voicing</button>
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

            {showAltIdx!==null&&showAltIdx<chords.length&&altVoicings[showAltIdx]?.length>0&&(
              <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-emerald-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-emerald-400">Alternative voicings for <span className="font-bold">{chords[showAltIdx].name}</span> (lowest to highest fret)</div>
                  {overrides[showAltIdx]&&<button onClick={()=>clearAltOverride(showAltIdx)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Reset to default</button>}
                </div>
                {['s1','s2'].map(sk=>{
                  const groupAlts=altVoicings[showAltIdx].filter(a=>a.setKey===sk);
                  if (!groupAlts.length) return null;
                  return (
                    <div key={sk} className="mb-3">
                      <div className="text-xs text-emerald-400 font-medium mb-2">{SETS[sk].label}</div>
                      <div className="flex flex-wrap gap-3">
                        {groupAlts.map((alt,i)=>(
                          <div key={i} className="flex flex-col items-center">
                            <FretDiag voicing={alt.voicing} strs={SETS[alt.setKey].strs} name={null} highlight={overrides[showAltIdx]?.voicing===alt.voicing} onClick={()=>selectAlt(showAltIdx,alt)} size="small" root={chords[showAltIdx].root}/>
                            <button onClick={()=>selectAlt(showAltIdx,alt)} className="mt-1 px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-emerald-700 hover:text-white transition-all">Use this</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {overlayData&&<OverlayDiagram data={overlayData}/>}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-gray-400">
              <thead><tr className="border-b border-gray-800">
                {['Chord','Strings','Notes','Frets','Inv.','Shift'].map(h=>(<th key={h} className="text-left py-1.5 pr-3 text-gray-500 font-medium">{h}</th>))}
              </tr></thead>
              <tbody>
                {chords.map((ch,i)=>{
                  const v=path[i],sk=pathSets[i];
                  if (!v) return <tr key={i} className="border-b border-gray-800/50"><td className="py-1.5 pr-3 text-amber-400 font-medium">{ch.name}</td><td colSpan={5} className="py-1.5 text-gray-600 italic">No voicing available</td></tr>;
                  return (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 pr-3 text-amber-400 font-medium">{ch.name}</td>
                      <td className="py-1.5 pr-3 text-emerald-400">{sk==='s1'?'3-2-1':'4-3-2'}</td>
                      <td className="py-1.5 pr-3">{v.notes.map(n=>NOTES[n]).join(', ')}</td>
                      <td className="py-1.5 pr-3 font-mono">{v.frets.join('-')}</td>
                      <td className="py-1.5 pr-3">{v.inv+rootStrLabel(v,SETS[sk].strs)}</td>
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
        <p className="mb-3"><strong className="text-gray-500">How to use:</strong> Set chord quality, add chords. Click <strong>Alt voicing</strong> on any chord for alternatives. Click <strong>Overlay</strong> to see the CAGED chord shape and pentatonic scale around any voicing.</p>
        <p>7th chord voicings use shell voicings (root, 3rd/b3rd, 7th) — the 5th is omitted to fit 3 strings.</p>
      </div>
    </div>
    </div>
  );
}
