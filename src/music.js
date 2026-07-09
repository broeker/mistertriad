/* Shared music theory: notes, tunings, chord qualities, voicing generation, CAGED matching. */

export const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const OPEN = { 1:4, 2:11, 3:7, 4:2, 5:9, 6:4 };
export const SNAME = { 1:'E', 2:'B', 3:'G', 4:'D', 5:'A', 6:'E' };

// String sets used by the progression page.
export const SETS = {
  s1: { strs:[3,2,1], label:'Strings 3-2-1 (G, B, E)' },
  s2: { strs:[4,3,2], label:'Strings 4-3-2 (D, G, B)' },
};

// All adjacent 3-string sets, used by the triad finder.
export const STRING_SETS = [
  { key:'321', strs:[3,2,1], label:'3-2-1', names:'G B E' },
  { key:'432', strs:[4,3,2], label:'4-3-2', names:'D G B' },
  { key:'543', strs:[5,4,3], label:'5-4-3', names:'A D G' },
  { key:'654', strs:[6,5,4], label:'6-5-4', names:'E A D' },
];

export const SCALE = [0,2,4,5,7,9,11];
export const DEGS = [
  {n:'I',i:0,q:'maj'},{n:'ii',i:1,q:'min'},{n:'iii',i:2,q:'min'},
  {n:'IV',i:3,q:'maj'},{n:'V',i:4,q:'maj'},{n:'vi',i:5,q:'min'},
  {n:'vii°',i:6,q:'dim'},
];
export const QS = {
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
export const QKEYS = Object.keys(QS);
export const IV_LABEL = {0:'R',2:'2',3:'♭3',4:'3',5:'4',6:'♭5',7:'5',8:'♯5',9:'6',10:'♭7',11:'7'};

// Movable chord grips. t maps string -> [fretOffsetFromAnchor, interval] pairs;
// a is the anchor (root) string. Order matters: earlier shapes win ties in matchCAGED.
export const CAGED = {
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
    {n:'Gm',a:6,t:{6:[[0,0]],5:[[-2,3]],4:[[-3,7]],3:[[-3,0]],2:[[-4,3]],1:[[0,0]]}},
    {n:'Cm',a:5,t:{5:[[0,0]],4:[[-2,3]],3:[[-3,7]],2:[[-2,0]],1:[[-4,3]]}},
  ]
};

// Reference grips: standard movable full-chord forms per quality, same template
// format as CAGED. Used to show the "1st position" chord — the form whose grip
// sits lowest on the neck for a given root. dim/aug have no standard full grip.
export const REF_GRIPS = {
  maj: CAGED.maj,
  min: CAGED.min,
  '7': [
    {n:'E7',a:6,t:{6:[[0,0]],5:[[2,7]],4:[[0,10]],3:[[1,4]],2:[[0,7]],1:[[0,0]]}},
    {n:'G7',a:6,t:{6:[[0,0]],5:[[-1,4]],4:[[-3,7]],3:[[-3,0]],2:[[-3,4]],1:[[-2,10]]}},
    {n:'A7',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[0,10]],2:[[2,4]],1:[[0,7]]}},
    {n:'C7',a:5,t:{5:[[0,0]],4:[[-1,4]],3:[[0,10]],2:[[-2,0]],1:[[-3,4]]}},
    {n:'D7',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[1,10]],1:[[2,4]]}},
  ],
  maj7: [
    {n:'Emaj7',a:6,t:{6:[[0,0]],4:[[1,11]],3:[[1,4]],2:[[0,7]]}},
    {n:'Amaj7',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[1,11]],2:[[2,4]],1:[[0,7]]}},
    {n:'Cmaj7',a:5,t:{5:[[0,0]],4:[[-1,4]],3:[[-3,7]],2:[[-3,11]],1:[[-3,4]]}},
    {n:'Dmaj7',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[2,11]],1:[[2,4]]}},
  ],
  min7: [
    {n:'Em7',a:6,t:{6:[[0,0]],5:[[2,7]],4:[[0,10]],3:[[0,3]],2:[[0,7]],1:[[0,0]]}},
    {n:'Am7',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[0,10]],2:[[1,3]],1:[[0,7]]}},
    {n:'Dm7',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[1,10]],1:[[1,3]]}},
  ],
  sus4: [
    {n:'Esus4',a:6,t:{6:[[0,0]],5:[[2,7]],4:[[2,0]],3:[[2,5]],2:[[0,7]],1:[[0,0]]}},
    {n:'Asus4',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[2,0]],2:[[3,5]],1:[[0,7]]}},
    {n:'Dsus4',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[3,0]],1:[[3,5]]}},
  ],
  sus2: [
    {n:'Asus2',a:5,t:{5:[[0,0]],4:[[2,7]],3:[[2,0]],2:[[0,2]],1:[[0,7]]}},
    {n:'Dsus2',a:4,t:{4:[[0,0]],3:[[2,7]],2:[[3,0]],1:[[0,2]]}},
  ],
};

// Lowest-on-the-neck full grip for a root+quality: the "1st position" chord.
// Returns {name, frets: {string: {fret, interval}}, maxFret} or null.
export function firstPositionGrip(root, quality) {
  const shapes=REF_GRIPS[quality];
  if (!shapes) return null;
  let best=null,bs=Infinity;
  for (const shape of shapes) {
    const af=((root-OPEN[shape.a])%12+12)%12;
    const offs=Object.values(shape.t).map(tones=>tones[0][0]);
    const openForm=Math.min(...offs)<0;
    const frets={};
    for (const [s,tones] of Object.entries(shape.t)) {
      const [off,iv]=tones[0];
      frets[s]={fret:af+off,interval:iv};
    }
    const vals=Object.values(frets).map(f=>f.fret);
    // Forms that reach below the anchor depend on open strings: only usable as the
    // actual nut-position chord, never barred up the neck.
    if (openForm&&(Math.min(...vals)!==0||Math.max(...vals)>3)) continue;
    if (Math.min(...vals)<0) continue;
    const mx=Math.max(...vals);
    const score=mx*100+af;
    if (score<bs){bs=score;best={name:shape.n,frets,maxFret:mx};}
  }
  return best;
}

function perm3(arr) {
  const r=[];
  for (let i=0;i<3;i++) for (let j=0;j<3;j++) for (let k=0;k<3;k++)
    if (i!==j&&j!==k&&i!==k) r.push([arr[i],arr[j],arr[k]]);
  return r;
}
export function fretSpan(frets) {
  const nz=frets.filter(f=>f>0);
  if (nz.length<=1) return 0;
  return Math.max(...nz)-Math.min(...nz);
}
export function hasOpenString(frets) { return frets.some(f=>f===0); }

// Playable = no wide stretches: fretted span <= 3 (drops spread voicings like 4-7-9).
// Open-string voicings only count as playable in first position (frets 1-3).
export function isPlayable(frets) {
  if (hasOpenString(frets)) return Math.max(...frets)<=3;
  return fretSpan(frets)<=3;
}

export function getVoicings(notes,root,strs,mxF=14,mxS=5) {
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
      if (span<=mxS&&Math.max(...fr)<=mxF&&isPlayable(fr)) {
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

export function scoreVoicing(v,pf) {
  return v.frets.reduce((s,f,j)=>s+Math.abs(f-pf[j]),0)+(v.span>3?(v.span-3)*8:0);
}
export function closestVoicing(vs,pf) {
  if (!vs.length) return null;
  let best=null,bs=Infinity;
  for (const v of vs){const s=scoreVoicing(v,pf);if(s<bs){bs=s;best=v;}}
  return best;
}
export function rootStrLabel(v,strs) {
  if (!v.rootIdx.length) return '';
  return ', Root on '+strs[v.rootIdx[0]];
}
export function voicingKey(v) { return v?v.frets.join(','):''; }

export function isMinorFamily(quality) { return ['min','min7','dim'].includes(quality); }

// Exact match: every fretted note sits inside a CAGED grip at some anchor position.
export function matchCAGED(root,quality,vN,vF,vS) {
  const qk=isMinorFamily(quality)&&quality!=='dim'?'min':'maj';
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

// Fallback: nearest CAGED region by fret-range overlap, for voicings that are not
// a literal subset of any grip (e.g. some inversions on 6-5-4, shell 7th voicings).
export function matchCAGEDZone(root,quality,frets) {
  const shapes=CAGED[isMinorFamily(quality)?'min':'maj'];
  const nz=frets.filter(f=>f>0);
  const vMin=nz.length?Math.min(...nz):0,vMax=Math.max(...frets);
  let best=null,bs=-Infinity;
  for (const shape of shapes) {
    const ab=((root-OPEN[shape.a])%12+12)%12;
    const offs=Object.values(shape.t).flat().map(([off])=>off);
    const mn=Math.min(...offs),mx=Math.max(...offs);
    for (let o=0;o<=2;o++) {
      const af=ab+o*12,zMin=af+mn,zMax=af+mx;
      if (zMin>vMax+4) break;
      const overlap=Math.min(vMax,zMax)-Math.max(vMin,zMin);
      const dist=Math.abs((vMin+vMax)/2-(zMin+zMax)/2);
      const score=overlap*10-dist;
      if (score>bs){bs=score;best={name:shape.n,anchorFret:af,shape,approx:true};}
    }
  }
  return best;
}
