import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spinDuration} from '../src/spin-duration';
import {sample,pocketForAngle} from '../src/game';
test('Duration varies independently while every end pocket remains correct',()=>{
 assert.equal(spinDuration(16,3,0),13);assert.equal(spinDuration(16,3,1),19);assert.equal(spinDuration(16,0,.9),16);
 for(let index=0;index<37;index++)for(const direction of [-1,1] as const)for(const unit of [0,.5,1]){
  const duration=spinDuration(16,3,unit),p=sample({index,direction,variant:1,duration,start:1.7,initialBall:0,launchDuration:0},duration);
  assert.equal(pocketForAngle(p.angle-p.rotor),index);
 }
});
