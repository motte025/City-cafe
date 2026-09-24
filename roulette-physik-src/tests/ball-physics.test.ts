import test from 'node:test';
import assert from 'node:assert/strict';
import {BallPhysics,initBallPhysics,METRES_PER_UNIT,PHYSICS_DT,type Launch} from '../src/ball-physics';
import {DEFAULT_DESIGN,FLOOR} from '../src/wheel-shape';
import {pocketForAngle} from '../src/game';
import {readFileSync} from 'node:fs';

const launch=(i:number):Launch=>({angle:i*.713,rotorAngle:i*.377,rotorSpeed:i%2?-.76:.76,direction:i%2?-1:1,speed:(2.5+(i%4)*.15)/METRES_PER_UNIT,diameter:i%2?18:21,mass:i%2?5.3:8.7,restitution:.48,spinRatio:.78+(i%3)*.07});
test('Physical ball: sixteen launches cross diamonds and bounce across 5–10 dividers',async()=>{
 await initBallPhysics();const outcomes=new Set<number>();const times=new Set<number>();
 for(let i=0;i<16;i++){
  const requested=5+i%5,sim=new BallPhysics({...launch(i),pocketContacts:requested},DEFAULT_DESIGN);let p=sim.step();let maxRelative=0;
  assert.equal(p.index,null);assert.ok(Math.hypot(sim.rotor.localCom().x,sim.rotor.localCom().z)<1e-6,'rotor centre of mass must stay on its axle');
  for(let t=0;t<240*60&&p.index===null;t++){
   p=sim.step();assert.ok(Number.isFinite(p.x+p.y+p.z));
   assert.ok(p.radius<3.4,'ball stays inside the bowl');assert.ok(p.y>FLOOR*DEFAULT_DESIGN.bowlDepth,'ball does not pass through the pocket floor');
   if(p.radius<2.02)maxRelative=Math.max(maxRelative,p.relativeSpeed);
  }
  assert.notEqual(p.index,null,`launch ${i} did not settle`);
  assert.ok(sim.deflectorHits>0,`launch ${i} missed all diamonds`);
  assert.ok(sim.pocketBounces>=5&&sim.pocketBounces<=10,`launch ${i} had ${sim.pocketBounces} divider contacts`);
  assert.equal(p.index,pocketForAngle(Math.atan2(p.x,-p.z)-p.rotor));
  assert.ok(maxRelative>.15,'arrival is followed by relative motion');
  const result=p.index;outcomes.add(result!);times.add(Math.round(p.elapsed*100));
  // Remains a dynamic body after the result: no parent attachment or position snap.
  for(let j=0;j<240*3;j++){p=sim.step();assert.equal(pocketForAngle(Math.atan2(p.x,-p.z)-p.rotor),result);}
  assert.ok(sim.ball.isDynamic());sim.dispose();
 }
 assert.ok(outcomes.size>=5);assert.ok(times.size>=8);
});
test('Fixed steps give identical physics at 15/30/60/144 FPS',async()=>{
 await initBallPhysics();const samples=[];
 for(const fps of [15,30,60,144]){
  const sim=new BallPhysics(launch(1));for(let i=0;i<fps*5;i++)sim.advance(1/fps);
  samples.push({p:sim.ball.translation(),time:sim.elapsed});sim.dispose();
 }
 for(const s of samples.slice(1)){assert.ok(Math.abs(s.time-samples[0].time)<PHYSICS_DT/2);assert.ok(Math.hypot(s.p.x-samples[0].p.x,s.p.y-samples[0].p.y,s.p.z-samples[0].p.z)<1e-5);}
});
test('TV production path has no forced target, result generator or scripted landing',()=>{
 const display=readFileSync(new URL('../src/display.ts',import.meta.url),'utf8');
 const wheel=readFileSync(new URL('../src/wheel.ts',import.meta.url),'utf8');
 assert.ok(!display.includes("params.get('target')"));assert.ok(!display.includes('randomIndex'));
 assert.ok(!wheel.includes('createBallProfile'));assert.ok(!wheel.includes('rotor.attach(this.ball)'));assert.ok(!wheel.includes('sample(this.motion'));
 assert.ok(wheel.includes('crypto.getRandomValues'));assert.ok(wheel.includes('this.onLand?.(p.index)'));
});
