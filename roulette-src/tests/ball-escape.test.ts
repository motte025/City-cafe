/**
 * Kann die Kugel aus dem Kessel fallen? Belastungstest mit allen Extremwerten der Fernbedienung:
 * Kugel 18–21 mm, 5,3–10,5 g, Sprungstärke 50–140 %, Rauten-Widerstand 0 und 100 %, flacher und
 * tiefer Kessel, 8° und 28° Gefälle, kurze und lange Runden. Für jeden gefundenen Wurf gilt:
 * nie über den Holzrand (r 3,13 / Oberkante 1,025), nie unter den Taschenboden, Ruhe in einem Fach.
 */
import {test} from 'node:test';import assert from 'node:assert/strict';
import {planThrowSync,type PlanRequest,type BallPlan} from '../src/ball-plan';
import {DEFAULT_DESIGN,FLOOR} from '../src/wheel-shape';
import {STEP,TAU} from '../src/game';
const RIM_R=3.13,RIM_TOP=1.025,POCKET_IN=1.53,POCKET_OUT=2.04;
test('Kugel verlässt den Kessel auch bei Extremeinstellungen nie',()=>{
 const balls=[{diameter:18,mass:5.3,bounce:1.4},{diameter:21,mass:10.5,bounce:.5},{diameter:21,mass:8.7,bounce:1.4},{diameter:18,mass:10.5,bounce:1}];
 const shapes=[{...DEFAULT_DESIGN},{...DEFAULT_DESIGN,bowlDepth:.85,numberSlope:8},{...DEFAULT_DESIGN,bowlDepth:1.45,numberSlope:28}];
 const resist=[{radial:0,tangential:0},{radial:100,tangential:100},{radial:0,tangential:100}];
 let found=0,maxR=0,maxY=0,minY=Infinity;
 for(let k=0;k<72;k++){
  const ball=balls[k%4],shape=shapes[k%3],deflectorResistance=resist[Math.floor(k/4)%3],direction=(k%2?1:-1) as 1|-1,rotorStart=(k*1.37)%TAU;
  const req:PlanRequest={shape,ball,deflectorResistance,target:(k*7)%37,direction,rotorStart,rotorSpeed:.76*direction,launchAngle:rotorStart+((k*11)%37)*STEP,duration:10+(k*5)%10,runMin:3,runMax:20,seed:(0x51ed+k*2654435761)>>>0};
  const r=planThrowSync(req);if(!r.ok)continue;found++;const p=r as BallPlan;
  for(let i=0;i<p.count;i++){const x=p.pos[i*3],y=p.pos[i*3+1],z=p.pos[i*3+2],rad=Math.hypot(x,z);maxR=Math.max(maxR,rad);maxY=Math.max(maxY,y);minY=Math.min(minY,y);
   assert.ok(!(rad>RIM_R-.05&&y>RIM_TOP*shape.bowlDepth*.9),`Wurf ${k}: Kugel über dem Rand (r ${rad.toFixed(3)}, y ${y.toFixed(3)})`);
   assert.ok(rad<RIM_R,`Wurf ${k}: Kugel außerhalb des Kessels (r ${rad.toFixed(3)})`);
   assert.ok(y>FLOOR*shape.bowlDepth,`Wurf ${k}: Kugel unter dem Taschenboden (y ${y.toFixed(3)})`);}
  const rr=Math.hypot(p.rest[0],p.rest[2]);assert.ok(rr>POCKET_IN&&rr<POCKET_OUT,`Wurf ${k}: Ruhelage außerhalb der Fächer (r ${rr.toFixed(3)})`);
 }
 console.log(`# Ausbruch-Test: ${found}/72 Würfe geprüft, max. Radius ${maxR.toFixed(3)} (Rand ${RIM_R}), Höhe ${minY.toFixed(3)}–${maxY.toFixed(3)}`);
 assert.ok(found>=60,`zu wenige Würfe gefunden: ${found}`);
});
