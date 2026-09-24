/** Gemeinsame Prüfungen für simulierte Würfe (von mehreren Testdateien genutzt). */
import assert from 'node:assert/strict';
import {BALL_PHYSICS,BALL_WINDOWS,G_EARTH,MM_PER_UNIT} from '../src/ball-config';
import {collidersFor,type BallPlan,type PlanRequest} from '../src/ball-plan';
import {K_DEFLECTOR,deflectorDistance,surfaceDistance} from '../src/ball-physics';
import {pocketForAngle,rotorAt,sample,STEP,type Motion} from '../src/game';

export const motionFor=(req:PlanRequest,plan:BallPlan):Motion=>({index:req.target,variant:0,direction:req.direction,plan,duration:plan.restTime,start:req.rotorStart,startSpeed:req.rotorSpeed,initialBall:req.launchAngle,shape:req.shape});
const TOL=.5/MM_PER_UNIT;

export interface PlanMetrics {run:number;deflectors:number;pocketTime:number;settle:number;minClearanceMm:number;flights:number;maxGravityError:number}

/** Prüft einen Wurf vollständig; 'full' tastet jede Stützstelle ab (sonst nur Bildraten). */
export function checkPlan(req:PlanRequest,plan:BallPlan,full=true):PlanMetrics{
 const m=motionFor(req,plan),col=collidersFor(req.shape),R=plan.radius,dt=plan.dt,pos=plan.pos,n=plan.count;
 // Ergebnis und Fenster
 assert.equal(plan.finalIndex,req.target,'Endtasche');
 const end=sample(m,m.duration);assert.equal(pocketForAngle(end.angle-end.rotor),req.target,'sichtbare Tasche');
 const widen=plan.relaxed&&req.runMax-req.runMin<4?2:0;
 assert.ok(plan.run>=req.runMin-widen&&plan.run<=req.runMax+widen,`Laufweg ${plan.run}`);
 const pocketTime=plan.restTime-plan.entryTime,[lo,hi]=BALL_WINDOWS.pocketTime(plan.run);
 if(!plan.relaxed){
  assert.ok(pocketTime>=lo-1e-9&&pocketTime<=hi+1e-9,`Taschenzeit ${pocketTime}`);
  if(!plan.durationClamped)assert.ok(Math.abs(plan.restTime-req.duration)<=BALL_WINDOWS.durationTolerance+1e-9,`Dauer ${plan.restTime} statt ${req.duration}`);
 }
 assert.ok(plan.dropTime>0&&plan.dropTime<plan.entryTime&&plan.entryTime<plan.restTime,'Phasenfolge');
 // Stillstand: nie zentriert, danach exakt null Relativbewegung, Anheften ohne Sprung
 const restAngle=Math.atan2(plan.rest[0],-plan.rest[2]);
 assert.ok(Math.abs(((restAngle-req.target*STEP+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)>=BALL_WINDOWS.restOffsetMin-1e-9,'nicht zentriert');
 const last=(n-1)*3,A=rotorAt(m,plan.restTime),c=Math.cos(A),s=Math.sin(A);
 const lx=pos[last]*c+pos[last+2]*s,lz=-pos[last]*s+pos[last+2]*c;
 assert.ok(Math.hypot(lx-plan.rest[0],pos[last+1]-plan.rest[1],lz-plan.rest[2])<2e-5,'Ruhelage = letzte Stützstelle');
 for(const extra of [.3,1,5]){const p=sample(m,plan.restTime+extra),a=Math.atan2(Math.sin(p.angle-p.rotor),Math.cos(p.angle-p.rotor));assert.ok(Math.abs(a-restAngle)<1e-9&&Math.abs(p.y-plan.rest[1])<1e-12,'keine Relativbewegung nach dem Stillstand');}
 // Zeitreihe: keine Durchdringung, Geschwindigkeitssprünge nur bei Stößen, Flüge mit derselben Schwerkraft
 const impacts=new Set<number>();for(let k=0;k<plan.events.length;k+=7){const i=Math.round(plan.events[k]/dt);for(let d=-2;d<=2;d++)impacts.add(i+d);}
 let minClear=Infinity,flights=0,maxGravityError=0;const g=G_EARTH*BALL_PHYSICS.gravityFactor;
 const clearAt=(k:number)=>surfaceDistance(col,pos[k*3],pos[k*3+1],pos[k*3+2],rotorAt(m,k*dt))-R;
 for(let k=1;k<n-1;k++){
  const o=k*3;
  if(full||k%8===0){const cl=clearAt(k);minClear=Math.min(minClear,cl);}
  const vx0=(pos[o]-pos[o-3])/dt,vy0=(pos[o+1]-pos[o-2])/dt,vz0=(pos[o+2]-pos[o-1])/dt,vx1=(pos[o+3]-pos[o])/dt,vy1=(pos[o+4]-pos[o+1])/dt,vz1=(pos[o+5]-pos[o+2])/dt;
  const jump=Math.hypot(vx1-vx0,vy1-vy0,vz1-vz0);
  // Sprünge nur an Hindernissen: Stoß-Ereignis oder Anliegen an einer Fläche (z. B. Kante überrollt)
  if(jump>.6&&!impacts.has(k))assert.ok(Math.min(clearAt(k-1),clearAt(k),clearAt(k+1))<1e-3,`Geschwindigkeitssprung ohne Hindernis bei t=${(k*dt).toFixed(4)} (${jump.toFixed(2)} E/s)`);
  if(full&&k>2&&k<n-3&&!impacts.has(k)&&k*dt>plan.dropTime&&clearAt(k)>.004&&clearAt(k-2)>.004&&clearAt(k+2)>.004){
   // freier Flug: vertikale Beschleunigung = -g (plus kleiner Luftwiderstand)
   const ay=(vy1-vy0)/dt,speed=Math.hypot(vx1,vy1,vz1);flights++;
   maxGravityError=Math.max(maxGravityError,Math.abs(ay+g)-.003*speed*speed);
  }
 }
 assert.ok(minClear>=-TOL,`Kugel dringt ${(-minClear*MM_PER_UNIT).toFixed(2)} mm in eine Fläche ein`);
 if(full)assert.ok(maxGravityError<.02*g,`Flug weicht von der Schwerkraft ab (${maxGravityError.toFixed(3)})`);
 // Rautentreffer liegen geometrisch auf einer Raute
 for(let k=0;k<plan.events.length;k+=7)if(plan.events[k+1]===K_DEFLECTOR){
  const d=deflectorDistance(col,plan.events[k+4],plan.events[k+5],plan.events[k+6]);
  assert.ok(d<2e-4,`Rautenkontakt ${(d*MM_PER_UNIT).toFixed(2)} mm neben der Raute`);
 }
 // Wiedergabe bei 15/30/60/144 Bildern/s: endlich und stetig
 let vmax=0;for(let k=1;k<n;k++){const o=k*3;vmax=Math.max(vmax,Math.hypot(pos[o]-pos[o-3],pos[o+1]-pos[o-2],pos[o+2]-pos[o-1])/dt);}
 for(const fps of [15,30,60,144]){let prev=sample(m,0);for(let f=1;f<=Math.ceil((m.duration+.5)*fps);f++){const p=sample(m,f/fps);assert.ok(Number.isFinite(p.angle+p.radius+p.y));
  const d=Math.hypot(Math.sin(p.angle)*p.radius-Math.sin(prev.angle)*prev.radius,p.y-prev.y,Math.cos(p.angle)*p.radius-Math.cos(prev.angle)*prev.radius);
  assert.ok(d<=vmax/fps*1.02+1e-4,`Sprung in der Wiedergabe bei ${fps} fps`);prev=p;}}
 return {run:plan.run,deflectors:plan.deflectorHits,pocketTime,settle:0,minClearanceMm:minClear*MM_PER_UNIT,flights,maxGravityError};
}
