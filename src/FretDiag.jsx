import { NOTES, SNAME, IV_LABEL } from './music.js';

/* ---- Chord Diagram ---- */
export default function FretDiag({voicing,strs,name,highlight,onClick,size="normal",setLabel,root}) {
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
