import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DESIGN,bowlProfile,numberHeight,trackHeight,FLOOR} from '../src/wheel-shape';
import {deflectorGeometry,numberGeometry} from '../src/wheel-model';
import {BALL_RADIUS,ORDER,STEP,sample,supportHeight,pocketForAngle,type Motion} from '../src/game';
import {DEFAULT_SETTINGS,applySettings} from '../src/settings';

test('Alle 37 Zahlentafeln folgen dem Gefälle und liegen über der Fläche',()=>{
 for(const numberSlope of [8,22,28])for(const numberSize of [.85,1.08])for(let i=0;i<37;i++){
  const shape={...DEFAULT_DESIGN,numberSlope,numberSize},g=numberGeometry(i,shape),p=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let j=0;j<p.count;j++){const r=Math.hypot(p.getX(j),p.getZ(j));assert.ok(Math.abs(p.getY(j)-numberHeight(r,shape)-.006)<1e-6);assert.ok(r>=2.04&&r<=2.425+.01);assert.ok(uv.getX(j)>=i%8/8-1e-6&&uv.getX(j)<=(i%8+1)/8+1e-6);}
  assert.ok(numberHeight(2.425,shape)>numberHeight(2.04,shape));g.dispose();
 }
});

test('Acht Rauten sitzen auf der Laufbahn und wechseln radial/tangential',()=>{
 for(let i=0;i<8;i++){
  const g=deflectorGeometry(i),p=g.getAttribute('position'),normals=g.getAttribute('normal'),a=(i+.5)*Math.PI/4;
  let minRadial=Infinity,maxRadial=-Infinity,minTangent=Infinity,maxTangent=-Infinity;
  for(let j=0;j<p.count;j++){
   const x=p.getX(j),z=p.getZ(j),r=Math.hypot(x,z),radial=x*Math.sin(a)-z*Math.cos(a),tangent=x*Math.cos(a)+z*Math.sin(a);
   assert.ok(p.getY(j)>=trackHeight(r)-1e-6);assert.ok(normals.getY(j)>0);
   minRadial=Math.min(minRadial,radial);maxRadial=Math.max(maxRadial,radial);minTangent=Math.min(minTangent,tangent);maxTangent=Math.max(maxTangent,tangent);
  }
  assert.equal(maxRadial-minRadial>maxTangent-minTangent,i%2===0);g.dispose();
 }
});

test('Kugel schneidet geneigte Flächen auch bei maximaler Tiefe nicht',()=>{
 for(const bowlDepth of [.85,1.15,1.45])for(const numberSlope of [8,22,28]){
  const shape={...DEFAULT_DESIGN,bowlDepth,numberSlope},profile=bowlProfile(shape);
  for(let r=1.70;r<=3.0;r+=.007){const y=supportHeight(r,shape);
   for(let i=1;i<profile.length;i++)for(let f=0;f<=1;f+=.1){const a=profile[i-1],b=profile[i],x=a[0]+(b[0]-a[0])*f;if(Math.abs(x-r)>BALL_RADIUS)continue;
    const surface=(a[1]+(b[1]-a[1])*f)*bowlDepth;assert.ok(y-Math.sqrt(BALL_RADIUS**2-(x-r)**2)>=surface-1e-7);
   }
  }
 }
});

test('Alle Endfächer bleiben bei Design-Extremwerten in beiden Richtungen korrekt',()=>{
 for(const bowlDepth of [.85,1.45])for(const numberSlope of [8,28])for(let index=0;index<ORDER.length;index++)for(const direction of [1,-1] as const)for(const variant of [0,1,2]){
  const shape={...DEFAULT_DESIGN,bowlDepth,numberSlope},m:Motion={index,variant,direction,duration:16,start:2.18,initialBall:1.2,launchDuration:0,shape};
  for(const fps of [15,60]){for(let t=0;t<=16;t+=1/fps){const p=sample(m,t);assert.ok(p.y>=supportHeight(p.radius,shape)-1e-8);} }
  const p=sample(m,16);assert.equal(pocketForAngle(p.angle-p.rotor),index);assert.ok(Math.abs(p.y-(FLOOR*bowlDepth+BALL_RADIUS))<1e-10);
  assert.ok(Math.abs(Math.atan2(Math.sin(p.angle-p.rotor-index*STEP),Math.cos(p.angle-p.rotor-index*STEP)))<STEP/2);
 }
});

test('Designwerte sind begrenzt und Reset verändert keine Laufzeit- oder Tonoptionen',()=>{
 const set=applySettings(DEFAULT_SETTINGS,{bowlDepth:9,numberSlope:-4,cameraTilt:200,textScale:2,numberSize:5,gloss:Infinity});
 assert.equal(set.bowlDepth,1.45);assert.equal(set.numberSlope,8);assert.equal(set.cameraTilt,32);assert.equal(set.textScale,1.3);assert.equal(set.numberSize,1.08);assert.equal(set.gloss,DEFAULT_DESIGN.gloss);
 const reset=applySettings({...set,delay:14,muted:true,renderScale:.75},DEFAULT_DESIGN);assert.equal(reset.delay,14);assert.equal(reset.muted,true);assert.equal(reset.renderScale,.75);assert.equal(reset.cameraTilt,DEFAULT_DESIGN.cameraTilt);
});
