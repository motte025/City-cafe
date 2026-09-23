import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RECORDINGS,rollLevel} from '../src/audio';
import {sample} from '../src/game';
test('Recorded audio files are shipped, rolling fades before the final pocket contacts',()=>{
 for(const file of RECORDINGS){const data=readFileSync(new URL(`../public/audio/${file}`,import.meta.url));assert.equal(data.toString('ascii',0,4),'OggS');assert.ok(data.length>4000);}
 assert.ok(rollLevel(.2)>rollLevel(.6));assert.ok(rollLevel(.6)>rollLevel(.8));assert.equal(rollLevel(.86),0);assert.equal(rollLevel(1),0);
});
test('Ball reverses radial travel repeatedly before coming to rest',()=>{
 for(const direction of [-1,1] as const)for(let variant=0;variant<3;variant++){
 const motion={index:12,variant,direction,duration:16,start:1,initialBall:0,launchDuration:0};
 const poses=[.86,.90,.93,.957,.981,1].map(u=>sample(motion,u*16));
 const steps=poses.slice(1).map((p,i)=>Math.sign(p.radius-poses[i].radius));
 for(let i=1;i<steps.length;i++)assert.notEqual(steps[i],steps[i-1]);
 assert.ok(Math.abs(sample(motion,15.85).radius-poses.at(-1)!.radius)>.0005);
 }
});
