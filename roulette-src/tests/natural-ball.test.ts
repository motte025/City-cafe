import test from 'node:test';
import assert from 'node:assert/strict';
import {createBallProfile,sample,pocketForAngle,type Motion} from '../src/game';
import {DEFAULT_DESIGN,surfaceClearance} from '../src/wheel-shape';
import {applySettings,DEFAULT_SETTINGS} from '../src/settings';

test('Natural motion: all pockets, directions and control extremes remain continuous and above surfaces',()=>{
 for(let seed=0;seed<148;seed++){
  const profile=createBallProfile(seed,seed%2?18:21,seed%3?5.3:10.5,seed%2?.5:1.4);
  const m:Motion={index:seed%37,variant:0,direction:seed%2?1:-1,start:1.1,initialBall:2.4,duration:12+seed%14,profile,shape:{...DEFAULT_DESIGN,bowlDepth:seed%2?.85:1.45}};
  const end=sample(m,m.duration);
  assert.equal(pocketForAngle(end.angle-end.rotor),m.index);
  assert.ok(Math.abs(end.radius-profile.restRadius)<1e-10);
  assert.ok(Math.abs(end.y-surfaceClearance(end.radius,profile.radius,m.shape))<1e-10);
  for(const u of [0,profile.drop,...profile.times,...profile.contacts,1]){
   const a=sample(m,u*m.duration-1e-7),b=sample(m,u*m.duration+1e-7);
   assert.ok(Math.abs(a.angle-b.angle)<1e-4,'angular seam');
   assert.ok(Math.abs(a.radius-b.radius)<1e-4,'radial seam');
   assert.ok(Math.abs(a.y-b.y)<1e-4,'height seam');
  }
  for(const fps of [15,30,60,144])for(let frame=0;frame<=m.duration*fps;frame++){
   const p=sample(m,frame/fps);assert.ok(Number.isFinite(p.angle+p.y));
   assert.ok(p.y>=surfaceClearance(p.radius,profile.radius,m.shape)-1e-10);
  }
  const before=sample(m,m.duration-1e-4);
  assert.ok(Math.abs((end.angle-end.rotor)-(before.angle-before.rotor))<1e-7,'settles with zero relative speed');
 }
});
test('Seeds vary contact timing, radii, bounce count and entry; replay stays deterministic',()=>{
 const profiles=Array.from({length:100},(_,seed)=>createBallProfile(seed));
 assert.equal(new Set(profiles.map(p=>JSON.stringify(p))).size,100);
 assert.ok(new Set(profiles.map(p=>p.contacts.length)).size>=3);
 assert.ok(new Set(profiles.map(p=>p.times.length)).size>=3);
 assert.deepEqual(createBallProfile(42),createBallProfile(42));
 assert.notDeepEqual(createBallProfile(42,21,5.3).lifts,createBallProfile(42,21,10.5).lifts);
});
test('Remote ball values are bounded and existing settings receive defaults',()=>{
 const s=applySettings(DEFAULT_SETTINGS,{ballDiameter:99,ballMass:-1,ballBounce:99});
 assert.equal(s.ballDiameter,21);assert.equal(s.ballMass,5.3);assert.equal(s.ballBounce,1.4);
 assert.equal(applySettings(DEFAULT_SETTINGS,{duration:18}).ballDiameter,21);
});
