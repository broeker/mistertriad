import { NOTES, SNAME } from './music.js';
import { fretWindow, dotLabel } from './fretboard.js';

// Interval-free note spelling with the root(s) bolded: "C-E-G". Shared by the
// chord diagram and the print voicings.
export function NoteList({notes, rootIdx, strongClass='text-white'}) {
  return notes
    .map((n,j)=>rootIdx.includes(j)?<strong key={j} className={strongClass}>{NOTES[n]}</strong>:NOTES[n])
    .reduce((acc,el,j)=>j===0?[el]:[...acc,'-',el],[]);
}

/* ---- Full-chord Reference Diagram (6 strings, muted strings marked x) ---- */
export function GripDiag({grip,size="normal"}) {
  if (!grip) return null;
  const cols=[6,5,4,3,2,1].map(s=>({s,d:grip.frets[s]||null}));
  const played=cols.filter(c=>c.d).map(c=>c.d.fret);
  const {minNZ,startF,endF,nFrets,hasNut}=fretWindow(played);
  const w=168,h=158,m={t:40,b:14,l:30,r:14};
  const pw=w-m.l-m.r,ph=h-m.t-m.b,ss=pw/5,fs=ph/nFrets;
  const k=size==="large"?1.45:1; // scale the whole drawing, fonts included
  return (
    <svg width={w*k} height={h*k} viewBox={`0 0 ${w} ${h}`}>
      {hasNut
        ? <line x1={m.l-2} y1={m.t} x2={m.l+pw+2} y2={m.t} stroke="#e5e7eb" strokeWidth={3}/>
        : (<g>
            <rect x={m.l-28} y={m.t+fs/2-10} width={24} height={20} rx={5} fill="#f3f4f6"/>
            <text x={m.l-16} y={m.t+fs/2+0.5} fontSize="12" fill="#111827" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{minNZ}</text>
          </g>)}
      {Array.from({length:nFrets+1},(_,i)=>(<line key={i} x1={m.l} y1={m.t+i*fs} x2={m.l+pw} y2={m.t+i*fs} stroke={i===0&&hasNut?"#e5e7eb":"#4b5563"} strokeWidth={i===0&&hasNut?3:1}/>))}
      {cols.map((c,i)=>(<line key={c.s} x1={m.l+i*ss} y1={m.t} x2={m.l+i*ss} y2={m.t+nFrets*fs} stroke="#6b7280" strokeWidth={c.s>=4?1.2:0.9}/>))}
      {cols.map((c,i)=>(<text key={c.s} x={m.l+i*ss} y={m.t-24} fontSize="8" fill="#9ca3af" textAnchor="middle" fontFamily="monospace">{SNAME[c.s]}</text>))}
      {cols.map((c,i)=>{
        const x=m.l+i*ss;
        if (!c.d) return <text key={c.s} x={x} y={m.t-8} fontSize="9" fill="#6b7280" textAnchor="middle" fontWeight="bold">×</text>;
        const {fret,interval}=c.d;
        const isRoot=interval===0;
        const col=isRoot?"#f59e0b":"#3b82f6",strk=isRoot?"#fbbf24":"#60a5fa",tc=isRoot?"#000":"#fff";
        const label=dotLabel(interval,null);
        if (fret===0){const cy=hasNut?m.t-9:m.t-10;return <g key={c.s}><circle cx={x} cy={cy} r={6.5} fill={col} stroke={strk} strokeWidth={1.2}/><text x={x} y={cy+0.5} fontSize="6.5" fill={tc} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;}
        const y=m.t+(fret-startF-0.5)*fs;
        return <g key={c.s}><circle cx={x} cy={y} r={8} fill={col} stroke={strk} strokeWidth={1.2}/><text x={x} y={y+0.5} fontSize="7" fill={tc} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;
      })}
    </svg>
  );
}

/* ---- Chord Diagram ---- */
export default function FretDiag({voicing,strs,name,highlight,onClick,size="normal",setLabel,root,accent="#fbbf24"}) {
  if (!voicing) return (
    <div className="flex flex-col items-center">
      {name&&<div className="text-sm font-bold text-amber-400 mb-1">{name}</div>}
      <div className="text-xs text-gray-500 italic p-4">No voicing</div>
    </div>
  );
  const {frets,notes,rootIdx}=voicing;
  const {minNZ,startF,endF,nFrets,hasNut}=fretWindow(frets);
  const sm=size==="small",lg=size==="large";
  const w=sm?102:128,h=sm?135:162;
  const m=sm?{t:38,b:14,l:36,r:16}:{t:44,b:18,l:42,r:20};
  const pw=w-m.l-m.r,ph=h-m.t-m.b,ss=pw/2,fs=ph/nFrets;
  const dotR=sm?10:12,fSize=sm?8:9;
  const k=lg?1.5:1; // scale the whole drawing, fonts included
  const border=highlight?'ring-2 ring-amber-500 ring-offset-2 ring-offset-gray-950':'';
  const cursor=onClick?'cursor-pointer hover:opacity-80':'';
  return (
    <div className={`flex flex-col items-center ${cursor}`} onClick={onClick}>
      {name&&<div className={`font-bold text-amber-400 mb-1 text-center leading-tight ${sm?'text-xs':lg?'text-lg':'text-sm'}`}>{name}</div>}
      {setLabel&&<div className={`${lg?'text-sm':'text-xs'} text-emerald-400 mb-0.5`}>{setLabel}</div>}
      <div className={`rounded-lg mt-1.5 transition-all ${highlight?'bg-amber-500/10 p-3':'p-0'} ${border}`}>
        <svg width={w*k} height={h*k} viewBox={`0 0 ${w} ${h}`}>
          {hasNut
            ? <line x1={m.l-2} y1={m.t} x2={m.l+pw+2} y2={m.t} stroke="#e5e7eb" strokeWidth={3}/>
            : (<g>
                <rect x={m.l-32} y={m.t+fs/2-11} width={26} height={22} rx={5} fill="#f3f4f6"/>
                <text x={m.l-19} y={m.t+fs/2+0.5} fontSize={sm?13:14} fill="#111827" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{minNZ}</text>
              </g>)}
          {Array.from({length:nFrets+1},(_,i)=>(<line key={i} x1={m.l} y1={m.t+i*fs} x2={m.l+pw} y2={m.t+i*fs} stroke={i===0&&hasNut?"#e5e7eb":"#4b5563"} strokeWidth={i===0&&hasNut?3:1}/>))}
          {[0,1,2].map(i=>(<line key={i} x1={m.l+i*ss} y1={m.t} x2={m.l+i*ss} y2={m.t+nFrets*fs} stroke="#6b7280" strokeWidth={1.2}/>))}
          {strs.map((s,i)=>(<text key={s} x={m.l+i*ss} y={m.t-22} fontSize={sm?"10":"11"} fill={accent} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{SNAME[s]}</text>))}
          {frets.map((f,i)=>{
            const isRoot=rootIdx.includes(i);
            const iv=root!==undefined?((notes[i]-root+12)%12):null;
            const label=dotLabel(iv,notes[i]);
            const col=isRoot?"#f59e0b":"#3b82f6",strk=isRoot?"#fbbf24":"#60a5fa",tc=isRoot?"#000":"#fff";
            if (f===0){const cx=m.l+i*ss,cy=hasNut?m.t-5:m.t-8;return <g key={i}><circle cx={cx} cy={cy} r={dotR*0.75} fill={col} stroke={strk} strokeWidth={1.5}/><text x={cx} y={cy+0.5} fontSize={fSize} fill={tc} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;}
            const x=m.l+i*ss,y=m.t+(f-startF-0.5)*fs;
            return <g key={i}><circle cx={x} cy={y} r={dotR} fill={col} stroke={strk} strokeWidth={1.5}/><text x={x} y={y+0.5} fontSize={fSize} fill={tc} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text></g>;
          })}
        </svg>
      </div>
      <div className={`${lg?'text-sm mt-3':'text-xs mt-2.5'} text-gray-300`}>(<NoteList notes={notes} rootIdx={rootIdx}/>) <span className="text-gray-400">Frets:</span> <span className="font-semibold tabular-nums">{frets.join('-')}</span></div>
    </div>
  );
}
