import {BallPhysics,initBallPhysics} from '../src/ball-physics';
await initBallPhysics();
for(let i=0;i<6;i++){
 const sim=new BallPhysics({angle:i*.72,rotorAngle:i*.33,rotorSpeed:(i%2?-1:1)*.76,direction:i%2?-1:1,speed:17+i*2,diameter:21,mass:8.7,restitution:.48,spinRatio:.8});
 let firstDrop=0,contacts=0,p=sim.step();const start=performance.now();
 for(let j=0;j<240*75;j++){
  p=sim.step();if(p.radius<2.48&&!firstDrop)firstDrop=p.elapsed;if(p.impact)contacts++;
  if(p.index!==null||p.y<-.5||p.radius>3.5)break;
 }
 console.log({i,elapsed:p.elapsed,index:p.index,r:p.radius,y:p.y,relative:p.relativeSpeed,firstDrop,contacts,deflectors:sim.deflectorHits,pocketSteps:sim.pocketSteps,firstDeflector:sim.firstDeflectorTime,firstPocket:sim.firstPocketTime,velocity:sim.ball.linvel(),rotorSpeed:sim.speed,cpuMs:performance.now()-start});sim.dispose();
}
