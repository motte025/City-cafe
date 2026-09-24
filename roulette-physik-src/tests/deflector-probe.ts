import {BallPhysics,initBallPhysics,METRES_PER_UNIT} from '../src/ball-physics';
import {TAU} from '../src/game';
await initBallPhysics();
for(let i=0;i<16;i++){
 const target=5+i%6,sim=new BallPhysics({angle:i*.619,rotorAngle:i*.271,rotorSpeed:(i%2?-1:1)*.76,direction:i%2?-1:1,speed:(2.8*(.94+.12*((i*73%101)/101)))/METRES_PER_UNIT,diameter:21,mass:8.7,restitution:.48,spinRatio:.8,pocketContacts:target});
 let p=sim.step(),closest=99,at:any=null;
 for(let j=0;j<240*30&&p.index===null;j++){
  p=sim.step();if(p.radius>2.63&&p.radius<2.85){const a=Math.atan2(p.x,-p.z),sector=TAU/8,d=Math.abs(Math.atan2(Math.sin(a-sector*(Math.round(a/sector)+.5)),Math.cos(a-sector*(Math.round(a/sector)+.5))))*2.74;if(d<closest){closest=d;at={r:p.radius,y:p.y,a,t:p.elapsed};}}
  if(p.radius>3.5)break;
 }
 console.log(i,{result:p.index,time:+p.elapsed.toFixed(2),target,steps:sim.pocketSteps,bounces:sim.pocketBounces,hits:sim.deflectorHits,closest:+closest.toFixed(3),at});sim.dispose();
}
