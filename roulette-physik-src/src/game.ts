import {DEFAULT_DESIGN,FLOOR,DIVIDER_HEIGHT,surfaceClearance,type WheelShape} from './wheel-shape';
export const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
export const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const color = (n:number) => n===0?'green':RED.has(n)?'red':'black';
export const TAU = Math.PI*2, STEP = TAU/37;
export const BALL_RADIUS=.083, POCKET_RADIUS=1.79, POCKET_Y=FLOOR*DEFAULT_DESIGN.bowlDepth+BALL_RADIUS;
export const DIVIDER_TOP=DIVIDER_HEIGHT*DEFAULT_DESIGN.bowlDepth;
export function restingOffset(variant:number){return [{angle:.025,radius:-.032},{angle:-.021,radius:.040},{angle:.012,radius:.009}][variant%3];}
export function pocketForAngle(angle:number){return ((Math.round(angle/STEP)%37)+37)%37;}
export class PlaybackClock {
 private previous:number|null=null;
 reset(){this.previous=null;}
 tick(time:number,visible=true){if(!visible){this.reset();return 0;}const delta=this.previous===null?0:Math.max(0,(time-this.previous)/1000);this.previous=time;return delta>.5?0:delta;}
}
export function randomIndex(read:()=>number=()=>crypto.getRandomValues(new Uint32Array(1))[0]) { const limit=Math.floor(2**32/37)*37; let v; do {v=read();} while(v>=limit); return v%37; }
export interface Bet {id:string; label:string; numbers:number[]; multiplier:number}
export const BETS:Bet[] = [
 ...Array.from({length:37},(_,n)=>({id:`n${n}`,label:String(n),numbers:[n],multiplier:36})),
 ...[0,1,2].map(i=>({id:`d${i}`,label:`${i*12+1}–${i*12+12}`,numbers:Array.from({length:12},(_,j)=>i*12+j+1),multiplier:3})),
 ...[0,1,2].map(i=>({id:`c${i}`,label:`${i+1}. Kolonne`,numbers:Array.from({length:12},(_,j)=>j*3+i+1),multiplier:3})),
 ...['low','even','red','black','odd','high'].map((id,i)=>({id,label:['1–18','Gerade','Rot','Schwarz','Ungerade','19–36'][i],numbers:ORDER.filter(n=>n!==0 && (id==='low'?n<=18:id==='high'?n>=19:id==='even'?n%2===0:id==='odd'?n%2===1:id==='red'?RED.has(n):!RED.has(n))),multiplier:2}))
];
export class Game {
 balance=1000; bets=new Map<string,number>(); active:number|null=null; private serial=0;
 get total(){return [...this.bets.values()].reduce((a,b)=>a+b,0)}
 place(id:string,amount:number){if(this.active!==null||!BETS.some(b=>b.id===id)||!Number.isInteger(amount)||amount<=0||this.total+amount>this.balance)return false; this.bets.set(id,(this.bets.get(id)||0)+amount);return true;}
 clear(){if(this.active===null)this.bets.clear()}
 start(){if(this.active!==null||this.total===0)return null;this.balance-=this.total;this.active=++this.serial;return this.active;}
 settle(token:number,index:number){if(token!==this.active||!Number.isInteger(index)||index<0||index>=37)return null;const number=ORDER[index];let payout=0;for(const [id,stake] of this.bets){const b=BETS.find(b=>b.id===id)!;if(b.numbers.includes(number))payout+=stake*b.multiplier;}this.balance+=payout;this.active=null;this.bets.clear();return {number,payout};}
}
const smooth=(x:number)=>x*x*x*(x*(x*6-15)+10);
export interface Motion {index:number; duration:number; start:number; initialBall:number; variant:number;initialRadius?:number;initialY?:number;startSpeed?:number;launchDuration?:number;direction?:1|-1;shape?:WheelShape;profile?:ReturnType<typeof createBallProfile>}
/** Reference scale: the 6.5-unit outer rim represents a 900 mm wheel. */
export function ballRadiusFor(diameter:number){return diameter*3.25/900;}
export function createBallProfile(seed:number,diameter=21,mass=8.7,bounce=1){
 let state=seed>>>0;
 const rand=()=>{state=(state+0x6D2B79F5)|0;let x=Math.imul(state^(state>>>15),1|state);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296;};
 const radius=ballRadiusFor(diameter),drop=.40+rand()*.15,capture=.75+rand()*.07;
 const count=4+Math.floor(rand()*4),energy=bounce*Math.sqrt(8.7/mass);
 const restAngle=(rand()-.5)*.018,restRadius=1.985-radius-.006;
 const times=[drop],radii=[2.9],lifts:number[]=[],kicks:number[]=[];
 const weights=Array.from({length:count},()=>.65+rand());const sum=weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<count;i++){
  times.push(i===count-1?capture:times[i]+(capture-drop)*weights[i]/sum);
  const q=(i+1)/count;
  radii.push(i===count-1?1.74+rand()*.15:Math.max(1.72,2.9-1.12*q+(i%2?.08:-.09)*( .5+rand())));
  lifts.push((.11+rand()*.20)*(1-q*.65)*energy);kicks.push((rand()-.5)*.34*energy*(1-q*.7));
 }
 const rattles=4+Math.floor(rand()*4),contacts=[capture],offsets=[0],pocketRadii=[radii.at(-1)!],pocketLifts:number[]=[];
 const durations=Array.from({length:rattles},(_,i)=>(.8+rand()*.5)*Math.pow(.86,i));const total=durations.reduce((a,b)=>a+b,0);
 const side=rand()<.5?-1:1;
 for(let i=0;i<rattles;i++){
  const last=i===rattles-1,q=(i+1)/rattles;
  contacts.push(last?1:contacts[i]+(1-capture)*durations[i]/total);
  // Early hops can cross a divider; later rebounds fit inside the actual free width.
  const freeAngle=Math.max(.006,STEP/2-Math.asin((radius+.022)/1.8));
  offsets.push(last?0:side*(i%2?-1:1)*(i===0?.08+rand()*.08:freeAngle*(.8+rand()*.2)*Math.pow(1-q,.65)));
  pocketRadii.push(last?restRadius:i%2?restRadius:1.70+rand()*.08+q*.03);
  pocketLifts.push(last?0:(.07+rand()*.07)*Math.pow(1-q,1.4)*energy);
 }
 return {radius,drop,capture,turns:4+rand()*3,restAngle,restRadius,times,radii,lifts,kicks,contacts,offsets,pocketRadii,pocketLifts};
}
export function reversalPlan(angle:number,speed:number,direction:1|-1){return {angle,speed,duration:speed===0?0:1.6,endSpeed:direction*.76};}
export function sampleReversal(p:ReturnType<typeof reversalPlan>,time:number){
 if(p.duration===0)return {angle:p.angle,speed:p.speed,u:1};
 const u=Math.max(0,Math.min(1,time/p.duration)),delta=p.endSpeed-p.speed;
 return {u,angle:p.angle+p.duration*(p.speed*u+delta*(u*u*u-.5*u*u*u*u)),speed:p.speed+delta*u*u*(3-2*u)};
}
export function launchPosition(rotorAngle:number,lastIndex:number){return rotorAngle+lastIndex*STEP;}
export const ROTOR_DRAG=.012, ROTOR_MIN_SPEED=.32;
export function coast(speed:number,t:number){const dir=Math.sign(speed)||1,absolute=Math.abs(speed),floor=Math.min(absolute,ROTOR_MIN_SPEED);return {angle:dir*(floor*t+(absolute-floor)*(1-Math.exp(-ROTOR_DRAG*t))/ROTOR_DRAG),speed:dir*(floor+(absolute-floor)*Math.exp(-ROTOR_DRAG*t))};}
export function rotorState(m:Motion,t:number){
 const dir=m.direction??1,initial=(m.startSpeed??(.76*dir))*dir,boost=Math.max(0,.82-initial),slow=Math.exp(-ROTOR_DRAG*t),fast=Math.exp(-2*t);
 return {angle:dir*(ROTOR_MIN_SPEED*t+(initial-ROTOR_MIN_SPEED)*(1-slow)/ROTOR_DRAG+boost*((1-slow)/ROTOR_DRAG-(1-fast)/2)),speed:dir*(ROTOR_MIN_SPEED+(initial-ROTOR_MIN_SPEED)*slow+boost*(slow-fast))};
}
export function rotorAt(m:Motion,t:number){return m.start+rotorState(m,t).angle;}
export function supportHeight(r:number,shape:WheelShape=DEFAULT_DESIGN){return surfaceClearance(r,BALL_RADIUS,shape);}
export function sample(m:Motion,elapsed:number){
 if(m.profile)return sampleNatural(m,elapsed);
 const launchDuration=m.launchDuration??.8;
 const t=Math.max(0,Math.min(elapsed,m.duration)), u=Math.max(0,t-launchDuration)/(m.duration-launchDuration);
 const rest=restingOffset(m.variant);
 const rotor=rotorAt(m,t), end=rotorAt(m,m.duration)+m.index*STEP+rest.angle;
 // Positive angles run clockwise in the scene; ball travels counterclockwise.
 const direction=m.direction??1;
 const travel=-direction*(TAU*(4+m.variant)+((direction*(m.initialBall-end))%TAU+TAU)%TAU);
 const s=1-Math.pow(1-u,3), angular=m.initialBall+travel*s;
 const lock=smooth(Math.max(0,Math.min(1,(u-.82)/.18)));
 const target=m.initialBall+travel;
 let angle=angular*(1-lock)+(target+rotor-rotorAt(m,m.duration))*lock;
 const shape=m.shape??DEFAULT_DESIGN;
 let radius=2.9,y=supportHeight(radius,shape),impact=-1;
 // Unequal flight arcs: deflector hit, outward ricochet, pocket crossings, final rattles.
 const times=[.46,.54,.615,.68,.745,.805,.86,.91,.965,1];
 const radii=[2.9,2.57,2.20,2.36,1.88,2.025,1.73,1.91,1.76,POCKET_RADIUS+rest.radius];
 const heights=[.31,.39,.29,.25,.20,.16,.12,.075,.035];
 if(u>=times[0]){
  let j=0;while(j<times.length-2&&u>=times[j+1])j++;
  const v=Math.max(0,Math.min(1,(u-times[j])/(times[j+1]-times[j])));impact=j;
  radius=radii[j]+(radii[j+1]-radii[j])*(j===8?smooth(v):v);
  const kick=(j%2===0?1:-1)*(.13+m.variant*.022)*Math.pow(1-j/9,1.4);
  angle+=kick*(j===8?Math.sin(Math.PI*v)**2:Math.sin(Math.PI*v));
  y=supportHeight(radius,shape)+4*heights[j]*(1+m.variant*.12)*v*(1-v);
 }
 if(u>=.86){
  // The last contacts reverse direction inside/over the pocket instead of homing
  // into its centre. Preserve the incoming position at the first contact.
  const entryTime=launchDuration+.86*(m.duration-launchDuration);
  const entryAngular=m.initialBall+travel*(1-Math.pow(1-.86,3));
  const entryTarget=target+rotorAt(m,entryTime)-rotorAt(m,m.duration);
  const entryOffset=(entryAngular-entryTarget)*(1-smooth((.86-.82)/.18));
  const contacts=[.86,.90,.93,.957,.981,1];
  const offsets=[entryOffset,direction*.125,-direction*.066,direction*.034,-direction*.022,0];
  const pocketRadii=[1.73,1.92,1.71,1.88,1.735,POCKET_RADIUS+rest.radius];
  const lifts=[.15,.115,.075,.043,.018];
  let j=0;while(j<contacts.length-2&&u>=contacts[j+1])j++;
  const v=Math.max(0,Math.min(1,(u-contacts[j])/(contacts[j+1]-contacts[j])));
  const travelFraction=j===4?1-(1-v)**3:v;
  angle=target+rotor-rotorAt(m,m.duration)+offsets[j]+(offsets[j+1]-offsets[j])*travelFraction;
  radius=pocketRadii[j]+(pocketRadii[j+1]-pocketRadii[j])*travelFraction;
  y=supportHeight(radius,shape)+4*lifts[j]*(1+m.variant*.1)*v*(1-v);
  impact=6+j;
 }
 // Keep the sphere above the raised metal dividers during each crossing.
 if(radius<2.025&&radius>1.55){const relative=((angle-rotor)%STEP+STEP)%STEP;const distance=Math.max(0,radius*Math.abs(Math.sin(relative-STEP/2))-.018);if(distance<BALL_RADIUS)y=Math.max(y,DIVIDER_HEIGHT*shape.bowlDepth+Math.sqrt(BALL_RADIUS**2-distance**2));}
 if(t<launchDuration){const launch=smooth(t/launchDuration);radius=(m.initialRadius??2.9)+(2.9-(m.initialRadius??2.9))*launch;y=(m.initialY??supportHeight(2.9,shape))+(supportHeight(2.9,shape)-(m.initialY??supportHeight(2.9,shape)))*launch+.64*Math.sin(Math.PI*t/launchDuration);}
 return {angle,rotor,radius,y,speed:rotorState(m,t).speed,impact,done:elapsed>=m.duration,index:m.index};
}

function sampleNatural(m:Motion,elapsed:number){
 const p=m.profile!,shape=m.shape??DEFAULT_DESIGN,t=Math.max(0,Math.min(elapsed,m.duration)),u=t/m.duration,dir=m.direction??1;
 const rotor=rotorAt(m,t),endRotor=rotorAt(m,m.duration),end=endRotor+m.index*STEP+p.restAngle;
 // Whole turns preserve the selected physical end pocket. The seed is independent of the result.
 const travel=-dir*(TAU*Math.floor(p.turns)+((dir*(m.initialBall-end))%TAU+TAU)%TAU),target=m.initialBall+travel;
 const angular=(v:number)=>m.initialBall+travel*(1-(1-v)**3);
 let angle=angular(u),radius=2.9,lift=0,impact=-1;
 const interval=(times:number[])=>{let j=0;while(j<times.length-2&&u>=times[j+1])j++;return {j,v:Math.max(0,Math.min(1,(u-times[j])/(times[j+1]-times[j])))};};
 if(u>=p.drop&&u<p.capture){const {j,v}=interval(p.times);radius=p.radii[j]+(p.radii[j+1]-p.radii[j])*v;lift=4*p.lifts[j]*v*(1-v);angle+=p.kicks[j]*Math.sin(Math.PI*v);impact=j;}
 if(u>=p.capture){
  const {j,v}=interval(p.contacts),base=target+rotor-endRotor;
  const incoming=angular(p.capture)-(target+rotorAt(m,p.capture*m.duration)-endRotor);
  const from=j===0?incoming:p.offsets[j],to=p.offsets[j+1];
  // Match incoming angular velocity at capture, then collide, rebound and roll out.
  const segmentSeconds=(p.contacts[j+1]-p.contacts[j])*m.duration;
  const incomingSpeed=travel*3*(1-p.capture)**2/m.duration-rotorState(m,p.capture*m.duration).speed;
  const fraction=j===p.contacts.length-2?1-(1-v)**2:v;
  const offset=j===0?(2*v**3-3*v*v+1)*from+(v**3-2*v*v+v)*incomingSpeed*segmentSeconds+(-2*v**3+3*v*v)*to+(v**3-v*v)*(to-from):from+(to-from)*fraction;
  angle=base+offset;radius=p.pocketRadii[j]+(p.pocketRadii[j+1]-p.pocketRadii[j])*fraction;
  lift=4*p.pocketLifts[j]*v*(1-v);impact=p.times.length-1+j;
 }
 let y=surfaceClearance(radius,p.radius,shape)+lift;
 if(radius<2.025&&radius>1.55){const relative=((angle-rotor)%STEP+STEP)%STEP,distance=Math.max(0,radius*Math.abs(Math.sin(relative-STEP/2))-.018);if(distance<p.radius)y=Math.max(y,DIVIDER_HEIGHT*shape.bowlDepth+Math.sqrt(p.radius**2-distance**2));}
 return {angle,rotor,radius,y,speed:rotorState(m,t).speed,impact,done:elapsed>=m.duration,index:m.index,phase:u<p.drop?0:u<p.capture?1:2};
}
