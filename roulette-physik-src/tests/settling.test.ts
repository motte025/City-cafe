import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,Vector3} from 'three';
import {sample,pocketForAngle,STEP,type Motion} from '../src/game';
test('Anheften bewahrt reale Ruheposition und richtiges Fach in beiden Richtungen',()=>{
 for(let index=0;index<37;index++)for(const variant of [0,1,2])for(const direction of [1,-1] as const){
 const motion:Motion={index,variant,direction,startSpeed:direction*.76,duration:16,start:1.93,initialBall:-2.31};
 const p=sample(motion,16);const scene=new Group(),rotor=new Group(),ball=new Mesh();scene.add(rotor,ball);rotor.rotation.y=-p.rotor;
 ball.position.set(Math.sin(p.angle)*p.radius,p.y,-Math.cos(p.angle)*p.radius);scene.updateMatrixWorld(true);const before=ball.getWorldPosition(new Vector3());rotor.attach(ball);
 assert.ok(before.distanceTo(ball.getWorldPosition(new Vector3()))<1e-10);const angle=Math.atan2(ball.position.x,-ball.position.z);assert.equal(pocketForAngle(angle),index);
 assert.ok(Math.abs(Math.atan2(Math.sin(angle-index*STEP),Math.cos(angle-index*STEP)))>.005);
 }
});
