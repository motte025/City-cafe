/**
 * Statistischer Lauf über viele Würfe: Laufweg-Verteilung, Rautenhäufigkeit,
 * Rechenzeit und Rückfallquote. Separat von ball-physics.test.ts, weil er
 * mehrere Minuten braucht (siehe roulette-src/TESTBERICHT.md für die Werte).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {planThrowSync} from '../src/ball-plan';
import {DEFAULT_DESIGN} from '../src/wheel-shape';
import {STEP,TAU} from '../src/game';
import {checkPlan} from './ball-check';

test('Statistik über 1000+ Würfe: Laufweg gleichverteilt, Rauten meist 0, Rechenzeit, Rückfallquote',()=>{
 const N=1000,runs=new Map<number,number>(),deflectors=new Map<number,number>();
 let fallbacks=0,totalMs=0,maxMs=0;
 for(let k=0;k<N;k++){
  const direction=(k%2?1:-1) as 1|-1,rotorStart=(k*2.17)%TAU;
  const req={shape:{...DEFAULT_DESIGN},ball:{diameter:21,mass:8.7,bounce:1},target:k%37,direction,rotorStart,rotorSpeed:.76*direction,
   launchAngle:rotorStart+((k*13)%37)*STEP,duration:13+(k*5)%12,runMin:5,runMax:15,seed:(0x9e3779b1+k*2654435761)>>>0};
  const t0=performance.now();const r=planThrowSync(req);const ms=performance.now()-t0;
  totalMs+=ms;maxMs=Math.max(maxMs,ms);
  if(!r.ok){fallbacks++;continue;}
  if(k%37===0)checkPlan(req,r,false);
  runs.set(r.run,(runs.get(r.run)??0)+1);deflectors.set(r.deflectorHits,(deflectors.get(r.deflectorHits)??0)+1);
 }
 const entered=N-fallbacks;
 console.log(`Laufweg (n=${entered}):`,[...runs.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '));
 console.log(`Rauten:`,[...deflectors.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '));
 console.log(`Rechenzeit Ø ${(totalMs/N).toFixed(0)} ms, max ${maxMs.toFixed(0)} ms. Rückfälle: ${fallbacks}/${N} (${(100*fallbacks/N).toFixed(1)} %)`);
 // Jeder Laufweg 5..15 kommt vor, keiner dominiert (grobe Gleichverteilung)
 for(let run=5;run<=15;run++)assert.ok((runs.get(run)??0)>0,`Laufweg ${run} kommt nie vor`);
 const max=Math.max(...runs.values());assert.ok(max<entered*.25,'ein Laufweg dominiert');
 // Rauten meist 0, zwei Treffer selten
 const zero=deflectors.get(0)??0,two=[...deflectors.entries()].filter(([k])=>k>=2).reduce((a,[,v])=>a+v,0);
 assert.ok(zero>entered*.3,'zu wenige Würfe ohne Rautentreffer');assert.ok(two<entered*.1,'zu viele Doppeltreffer');
 assert.ok(fallbacks<N*.2,'zu viele Rückfälle');
});
