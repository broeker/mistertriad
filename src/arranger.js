/* The arranger: turns the current song + band settings into a flat, sorted list
   of scheduled events (a pure function of its inputs), plus the pentatonic
   lead-pool / articulation helpers and the cross-set voice-leading cost.
   No React — Player wraps buildSchedule in a memo and feeds the events to the
   audio scheduler. */

import { QS, isMinorFamily, hasOpenString, voicingKey } from './music.js';
import { STRING_MIDI, voicingMidis } from './audio.js';
import {
  METERS, STRUMS, GFILL_STRUMS, DRUM_PATTERNS, BASS_METERS,
  BACKUP_PATTERNS, BACKUP_TOP, DRUM_FILLS,
} from './styles.js';

// Pentatonic notes on this string set within the triad voicing's fret window —
// i.e., the lick vocabulary of that CAGED position (what the Overlay shows).
export function leadPool(ch, voicing, strs) {
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

/* ---- String-set path engine ---- */
// centerOf = the voicing's neck position (mean of lowest-fretted and highest
// fret); used to order anchor positions and as the pass's fret window.
export const centerOf=v=>{const nz=v.frets.filter(f=>f>0);return nz.length?(Math.min(...nz)+Math.max(...v.frets))/2:0;};
export const pinKeyOf=v=>v?`${v.set.key}:${voicingKey(v)}`:'';
const pitchesOf=v=>v.set.strs.map((s,i)=>STRING_MIDI[s]+v.frets[i]);
// Position-playing cost: distance from the pass's fret window (the neck
// position) dominates, so each chord takes whichever set keeps the hand in the
// box — crossing 3-2-1 ↔ 4-3-2 wherever the other set sits closer. A light
// pitch-continuity term only breaks ties; there is NO set-change penalty, since
// crossing sets to stay in position is exactly the point.
export const posCost=(v,prev,win)=>{
  const c=(win!=null?Math.abs(centerOf(v)-win)*3:0)+(hasOpenString(v.frets)?3:0);
  const pa=[...pitchesOf(v)].sort((x,y)=>x-y),pb=[...pitchesOf(prev)].sort((x,y)=>x-y);
  let d=0; for (let i=0;i<pa.length;i++) d+=Math.abs(pa[i]-pb[i]);
  return c+d*0.1;
};

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

// The full loop as a flat event list — a pure function of the current settings.
// Player memoizes this and swaps the result into playRef; rebuilding and
// swapping it mid-play is how settings change without stopping.
export function buildSchedule({
  flat, chords, meter, tempo, feel, strum, drums, drumFills, bassMode,
  bassFills, guitarFills, backup, lead, leadEvery, keys, passOrder, passPath,
  grips, sound,
}) {
    const M=METERS[meter]||METERS['4/4'];
    const spb=60/tempo, barDur=M.beats*spb;
    const passBars=flat.playLen; // one pass = the whole arrangement, flattened
    const loopDur=passOrder.length*passBars*barDur;
    // Shuffle: offbeat eighths land on the triplet 2/3 instead of halfway.
    // Compound meters (6/8) are already triplet-based, so shuffle is a no-op.
    const sw=(feel==='shuffle'&&M.swing)?(b=>Math.floor(b)+(b%1?2/3:0)):(b=>b);
    // Guards: a stale knob/meter combo mid-rebuild falls back instead of crashing.
    const strumPat=STRUMS[strum].p[meter]||STRUMS.folk.p[meter];
    const drumPat=drums==='off'?null:(DRUM_PATTERNS[drums]?.[meter]||DRUM_PATTERNS.kit[meter]);
    const bassEff=bassMode==='off'?'off':(BASS_METERS[bassMode]?.includes(meter)?bassMode:'root5');
    const fill3=M.grid.slice(-3), fill4=M.grid.slice(-4), lastSlot=M.grid[M.grid.length-1];
    const events=[];
    const bassMidis=[],leadMidis=[],pianoMidis=[],backupMidis=[],gfillMidis=[];
    const guitarMidis=[]; // flattened: pass*passBars + bar
    let leadLast=null; // walker carries across bars so lines connect through chord changes
    // One pass through the bars per entry in passOrder; climbing plays the
    // progression at each position in turn (vary: at each same-position shape),
    // transitions on the loop boundary.
    passOrder.forEach((anchor,pass)=>{
    const path=passPath(anchor);
    for (let i=0;i<passBars;i++) {
      const gi=pass*passBars+i;
      const base=gi*barDur;
      let midis=[];
      if (sound!=='off') {
        if (sound==='cowboy'&&grips[i]) midis=[6,5,4,3,2,1].filter(s=>grips[i].frets[s]).map(s=>STRING_MIDI[s]+grips[i].frets[s].fret);
        else if (path[i]) midis=voicingMidis(path[i].set.strs,path[i].frets);
      }
      guitarMidis.push(midis);
      // Guitar fills: drop the last three strums and pick a chromatic bass run
      // walking into the next bar's chord — the country rhythm-guitar move.
      const nextCh=chords[(i+1)%passBars];
      const gFillHere=guitarFills&&sound!=='off'&&GFILL_STRUMS.includes(strum)&&!(nextCh.root===chords[i].root&&nextCh.quality===chords[i].quality)&&midis.length;
      strumPat.forEach(p=>{ if (gFillHere&&p.b>=fill3[0]) return; events.push({t:base+sw(p.b)*spb,type:'strum',i:gi,dir:p.dir,g:p.g,span:p.span}); });
      if (gFillHere) {
        const gTarget=40+((nextCh.root-4+12)%12);
        const gCur=40+((chords[i].root-4+12)%12);
        const gSide=(gTarget>=gCur&&gTarget-3>=40)?-1:1;
        const gRun=[3,2,1].map(k=>gTarget+gSide*k);
        fill3.forEach((b,k)=>{ events.push({t:base+sw(b)*spb,type:'gfill',m:gRun[k],g:0.85}); gfillMidis.push(gRun[k]); });
      }
      if (drumPat) drumPat.forEach(d=>events.push({t:base+(d.sw?sw(d.b):d.b)*spb,type:'drum',kind:d.kind,g:d.g}));
      if (drumFills&&!['off','stomp'].includes(drums)&&passBars>=4&&(i+1)%4===0) {
        const fill=DRUM_FILLS[Math.floor(Math.random()*DRUM_FILLS.length)];
        const soft=drums==='train'?0.8:1; // brushes-era kit plays fills gentler
        fill3.forEach((b,k)=>events.push({t:base+sw(b)*spb,type:'drum',kind:fill[k][0],g:fill[k][1]*soft}));
      }
      if (bassEff!=='off') {
        const ch=chords[i];
        const rootM=28+((ch.root-4+12)%12);          // E1..D#2
        const minish=isMinorFamily(ch.quality);
        const third=minish?3:4, fifth=ch.quality==='dim'?6:7, sixth=minish?10:9;
        const fifthM=rootM-(12-fifth)>=28?rootM-(12-fifth):rootM+fifth;
        const next=chords[(i+1)%passBars];
        const nextRootM=28+((next.root-4+12)%12);
        const sameNext=next.root===ch.root&&next.quality===ch.quality;
        const approach=sameNext?rootM+sixth:(nextRootM-1>=28?nextRootM-1:nextRootM+1);
        const pushBass=(b,m,g,swung=false)=>{ events.push({t:base+(swung?sw(b):b)*spb,type:'bass',m,g}); bassMidis.push(m); };
        // Bass fills: a three-note chromatic walkup (or -down) into the next
        // bar's root whenever the chord changes — the country/bluegrass move
        // that makes Root/Root–5th feel alive without full-time Walking.
        const bassFillHere=bassFills&&!sameNext&&(bassEff==='root'||bassEff==='root5');
        if (bassEff==='root') {
          pushBass(0,rootM,1);
          if (meter==='6/8'&&!bassFillHere) pushBass(1,rootM,0.75); // both pulses
        } else if (bassEff==='root5') {
          pushBass(0,rootM,1);
          // Skip the fifth when the fill run would land on top of it (3/4 & 6/8).
          const fifthB=meter==='6/8'?1:2;
          if (!(bassFillHere&&fifthB>=fill3[0])) pushBass(fifthB,fifthM,0.85);
        } else if (bassEff==='walk') {
          if (meter==='3/4') { pushBass(0,rootM,1); pushBass(1,rootM+third,0.85); pushBass(2,approach,0.85); }
          else if (meter==='6/8') { pushBass(0,rootM,1); pushBass(1,fifthM,0.85); if (!sameNext) pushBass(5/3,approach,0.6); }
          else { pushBass(0,rootM,1); pushBass(1,rootM+third,0.85); pushBass(2,rootM+fifth,0.9); pushBass(3,approach,0.85); }
        } else if (bassEff==='boogie') {
          const line=[0,0,third,third,fifth,fifth,sixth,sixth];
          [0,0.5,1,1.5,2,2.5,3,3.5].forEach((b,k)=>pushBass(b,rootM+line[k],b%1?0.7:0.95,true));
        } else if (bassEff==='bossa') {
          pushBass(0,rootM,1); pushBass(1.5,fifthM,0.7); pushBass(2,rootM,0.9); pushBass(3.5,fifthM,0.7);
        } else if (bassEff==='funk') {
          pushBass(0,rootM,1); pushBass(1.75,rootM+12,0.7); pushBass(2.5,rootM,0.9); pushBass(3.25,rootM+fifth,0.65);
        }
        if (bassFillHere) {
          // Approach from below when the target sits above (and there's room),
          // else from above — either way three even steps landing on the root.
          const side=(nextRootM>=rootM&&nextRootM-3>=28)?-1:1;
          const run=[3,2,1].map(k=>nextRootM+side*k);
          fill3.forEach((b,k)=>pushBass(b,run[k],0.8,true));
        }
      }
      if (keys!=='off') {
        const pc=chords[i].root;
        const rootM=pc<6?60+pc:48+pc; // root position around middle C
        const pv=QS[chords[i].quality].iv.map(iv=>rootM+iv);
        const hits=meter==='3/4'?[[0,0.6],[1,0.45],[2,0.45]]           // oom-pah-pah
          :meter==='6/8'?[[0,0.6],[1,0.5]]                              // both pulses
          :feel==='shuffle'?[[0,0.6],[2.5,0.45]]:[[0,0.6],[2,0.5]];
        hits.forEach(([b,g])=>events.push({t:base+sw(b)*spb,type:'piano',m:pv,g}));
        pianoMidis.push(...pv);
        if (keys==='fills'&&passBars>=4&&(i+1)%4===0) {
          // chord-tone run an octave up, ringing over the comp into the next bar
          const pool=pv.map(m=>m<66?m+12:m).sort((a,b)=>a-b);
          const dir=Math.random()<0.5?1:-1;
          let idx=dir===1?0:pool.length-1;
          fill3.forEach(b=>{
            const m=pool[Math.max(0,Math.min(pool.length-1,idx))];
            events.push({t:base+sw(b)*spb,type:'pianoNote',m,g:0.5});
            pianoMidis.push(m);
            idx+=dir;
          });
        }
      }
      if (backup!=='off') {
        const ch=chords[i];
        const minish=isMinorFamily(ch.quality);
        const third=minish?3:4, fifth=ch.quality==='dim'?6:7;
        const rootM=50+((ch.root-2+12)%12); // banjo register D3..C#4
        const pool=[rootM,rootM+third,rootM+fifth,rootM+12<=BACKUP_TOP?rootM+12:rootM+fifth];
        for (const p of (BACKUP_PATTERNS[backup][meter]||[])) {
          const t=base+sw(p.b)*spb;
          if (p.chord) {
            [0,1,2].forEach(n=>{ events.push({t,type:'backup',m:pool[n],g:p.g*(n===0?1:0.8),chop:true}); backupMidis.push(pool[n]); });
          } else {
            events.push({t,type:'backup',m:pool[p.n],g:p.g}); backupMidis.push(pool[p.n]);
          }
        }
      }
      if (lead!=='off'&&path[i]) {
        const pool=leadPool(chords[i],path[i],path[i].set.strs);
        if (pool.length>2) {
          const nearest=m=>pool.reduce((b,x,j)=>Math.abs(x-m)<Math.abs(pool[b]-m)?j:b,0);
          if (lead==='solo') {
            for (const b of M.grid) {
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
          } else if ((i+1)%leadEvery===0) { // fills: a directed run every leadEvery bars
            const dir=Math.random()<0.5?1:-1;
            let idx=leadLast!==null?nearest(leadLast):Math.floor(pool.length*(dir===1?0.3:0.7));
            for (const b of fill4) {
              idx=Math.max(0,Math.min(pool.length-1,idx+dir));
              const prevM=leadLast;
              leadLast=pool[idx];
              leadMidis.push(leadLast);
              const art=leadArt(pool,idx,prevM,b,b===lastSlot);
              if (art?.double!=null) leadMidis.push(art.double);
              events.push({t:base+sw(b)*spb+(Math.random()-0.5)*0.014,type:'lead',m:leadLast,g:b%1?0.52:0.62,art});
            }
          }
        }
      }
    }
    });
    events.sort((a,b)=>a.t-b.t);
    return {events,loopDur,barDur,spb,guitarMidis,gfillMidis,bassMidis,leadMidis,pianoMidis,backupMidis,passBars};
}
