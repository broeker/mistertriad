import { useState, useMemo } from 'react';
import { NOTES, QS, QKEYS, IV_LABEL, STRING_SETS, getVoicings, matchCAGED, matchCAGEDZone } from './music.js';
import FretDiag from './FretDiag.jsx';

const TRUE_TRIADS = ['maj','min','dim','aug'];

function bassLabel(v,root,quality) {
  const iv=((v.notes[0]-root)%12+12)%12;
  if (iv===0) return 'Root position';
  if (TRUE_TRIADS.includes(quality)) {
    if (iv===QS[quality].iv[1]) return '1st inversion';
    if (iv===QS[quality].iv[2]) return '2nd inversion';
  }
  return (IV_LABEL[iv]||iv)+' in bass';
}

// Group shapes under their CAGED letter (Em -> E).
function shapeLetter(name) { return name?name.replace(/m$/,''):null; }

function Card({item,root}) {
  const {v,set,shape,approx}=item;
  return (
    <div className="flex flex-col items-center bg-gray-900 rounded-lg px-3 pt-2 pb-3 border border-gray-800">
      <div className="flex items-center gap-1.5 mb-0.5">
        {shape&&(
          <span title={approx?'Nearest CAGED region — not an exact grip match':'Exact CAGED grip match'}
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${approx?'text-amber-300/70 bg-amber-500/5':'text-amber-300 bg-amber-500/10'}`}>
            {approx?'≈ ':''}{shape} shape
          </span>
        )}
        <span className="text-xs text-emerald-400">{set.label}</span>
      </div>
      <div className="text-[11px] text-gray-400 mb-0.5">{bassLabel(v,root,item.quality)}</div>
      <FretDiag voicing={v} strs={set.strs} name={null} root={root} size="small"/>
    </div>
  );
}

export default function TriadFinder() {
  const [root,setRoot]=useState(0);
  const [quality,setQuality]=useState('maj');
  const [activeSets,setActiveSets]=useState(()=>new Set(STRING_SETS.map(s=>s.key)));
  const [groupBy,setGroupBy]=useState('set');

  const toggleSet=key=>setActiveSets(prev=>{
    const n=new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const results=useMemo(()=>{
    const notes=QS[quality].iv.map(iv=>(root+iv)%12);
    const out=[];
    for (const set of STRING_SETS) {
      if (!activeSets.has(set.key)) continue;
      for (const v of getVoicings(notes,root,set.strs)) {
        const exact=matchCAGED(root,quality,v.notes,v.frets,set.strs);
        const cm=exact||matchCAGEDZone(root,quality,v.frets);
        out.push({v,set,quality,shape:cm?cm.name:null,approx:!exact&&!!cm});
      }
    }
    return out;
  },[root,quality,activeSets]);

  // Grouping: by string set (neck-position order within each set, as returned
  // by getVoicings) or by CAGED shape letter (groups ordered low to high on the neck).
  const groups=useMemo(()=>{
    if (groupBy==='set') {
      return STRING_SETS.filter(s=>activeSets.has(s.key)).map(s=>({
        title:`Strings ${s.label} (${s.names})`,
        items:results.filter(r=>r.set.key===s.key),
      })).filter(g=>g.items.length);
    }
    const setOrder=Object.fromEntries(STRING_SETS.map((s,i)=>[s.key,i]));
    if (groupBy==='inv') {
      const byInv=new Map();
      for (const r of results) {
        const label=bassLabel(r.v,root,r.quality);
        if (!byInv.has(label)) byInv.set(label,{iv:((r.v.notes[0]-root)%12+12)%12,items:[]});
        byInv.get(label).items.push(r);
      }
      return [...byInv.entries()].map(([label,{iv,items}])=>({
        title:label,
        iv,
        items:items.sort((a,b)=>setOrder[a.set.key]-setOrder[b.set.key]||a.v.pos-b.v.pos),
      })).sort((a,b)=>a.iv-b.iv);
    }
    const byShape=new Map();
    for (const r of results) {
      const letter=shapeLetter(r.shape)||'?';
      if (!byShape.has(letter)) byShape.set(letter,[]);
      byShape.get(letter).push(r);
    }
    return [...byShape.entries()].map(([letter,items])=>({
      title:letter==='?'?'No shape match':`${letter} shape`,
      minFret:Math.min(...items.map(r=>Math.min(...r.v.frets))),
      items:items.sort((a,b)=>setOrder[a.set.key]-setOrder[b.set.key]||a.v.pos-b.v.pos),
    })).sort((a,b)=>a.minFret-b.minFret);
  },[results,groupBy,activeSets,root]);

  const chordName=NOTES[root]+QS[quality].s;
  const isShell=['7','maj7','min7'].includes(quality);

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between gap-3 mb-1 py-3">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Triad Finder</h1>
          <p className="text-sm text-gray-400">Every {chordName} position on the top four 3-string sets, mapped to CAGED shapes.</p>
        </div>
        <a href="#/" className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all whitespace-nowrap">← Progressions</a>
      </div>

      <div className="mb-4 mt-4">
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Root</label>
        <div className="flex flex-wrap gap-1.5">
          {NOTES.map((n,i)=>(<button key={i} onClick={()=>setRoot(i)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${root===i?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{n}</button>))}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Chord Quality</label>
        <div className="flex flex-wrap gap-1.5">
          {QKEYS.map(q=>(<button key={q} onClick={()=>setQuality(q)} className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${quality===q?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{QS[q].l}</button>))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">String Sets</label>
          <div className="flex flex-wrap gap-1.5">
            {STRING_SETS.map(s=>(
              <button key={s.key} onClick={()=>toggleSet(s.key)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${activeSets.has(s.key)?'bg-emerald-600 text-white':'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                {s.label}<span className="ml-1.5 text-xs opacity-70">{s.names}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Group By</label>
          <div className="flex gap-1.5">
            {[['set','String set'],['shape','CAGED shape'],['inv','Inversion']].map(([k,l])=>(
              <button key={k} onClick={()=>setGroupBy(k)} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${groupBy===k?'bg-amber-500 text-gray-900':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {activeSets.size===0&&(
        <div className="text-sm text-gray-500 italic py-8 text-center">Select at least one string set.</div>
      )}

      {groups.map(g=>(
        <div key={g.title} className="mb-5">
          <div className="text-sm font-bold text-emerald-400 mb-2">{g.title} <span className="text-gray-500 font-normal">— {chordName}</span></div>
          <div className="flex flex-wrap gap-3">
            {g.items.map((item,i)=>(<Card key={item.set.key+'-'+item.v.frets.join(',')+'-'+i} item={item} root={root}/>))}
          </div>
        </div>
      ))}

      <div className="mt-6 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p>
          <strong className="text-gray-500">Notes:</strong> Positions are shown up to the 14th fret, low to high. Voicings needing more than a 3-fret span are omitted, and open strings only appear in first-position shapes (frets 1–3).
          A solid shape badge means the voicing sits exactly inside that CAGED grip; a <span className="text-gray-500">≈</span> badge means it falls in that shape's region of the neck but isn't a literal subset of the grip.
          {isShell&&' 7th chord voicings are shells (root, 3rd, 7th) — the 5th is omitted to fit 3 strings.'}
        </p>
      </div>
    </div>
    </div>
  );
}
