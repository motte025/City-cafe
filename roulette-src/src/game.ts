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
export interface Motion {index:number; duration:number; start:number; initialBall:number; variant:number;initialRadius?:number;initialY?:number;startSpeed?:number;launchDuration?:number;direction?:1|-1;shape?:WheelShape}
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
 if(u>.91){const q=(u-.91)/.09,fade=smooth(Math.min(1,q/.22));angle+=.028*Math.sin(q*Math.PI*5)*(1-q)**2*fade;y+=.028*Math.abs(Math.sin(q*Math.PI*4))*(1-q)**1.5;}
 // Keep the sphere above the raised metal dividers during each crossing.
 if(radius<2.025&&radius>1.55){const relative=((angle-rotor)%STEP+STEP)%STEP;const distance=Math.max(0,radius*Math.abs(Math.sin(relative-STEP/2))-.018);if(distance<BALL_RADIUS)y=Math.max(y,DIVIDER_HEIGHT*shape.bowlDepth+Math.sqrt(BALL_RADIUS**2-distance**2));}
 if(t<launchDuration){const launch=smooth(t/launchDuration);radius=(m.initialRadius??2.9)+(2.9-(m.initialRadius??2.9))*launch;y=(m.initialY??supportHeight(2.9,shape))+(supportHeight(2.9,shape)-(m.initialY??supportHeight(2.9,shape)))*launch+.64*Math.sin(Math.PI*t/launchDuration);}
 return {angle,rotor,radius,y,speed:rotorState(m,t).speed,impact,done:elapsed>=m.duration,index:m.index};
}
