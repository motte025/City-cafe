import RAPIER from '@dimforge/rapier3d-compat';
import * as T from 'three';
import {coast,pocketForAngle,STEP} from './game';
import {DEFAULT_DESIGN,FLOOR,DIVIDER_HEIGHT,numberHeight,rimProfile,surfaceClearance,type WheelShape} from './wheel-shape';
import {deflectorGeometry} from './wheel-model';

export const METRES_PER_UNIT=.9/6.8;
export const PHYSICS_DT=1/240;
let ready:Promise<void>|undefined;
export const initBallPhysics=()=>ready??=RAPIER.init();
export interface Launch {angle:number;rotorAngle:number;rotorSpeed:number;direction:1|-1;speed:number;diameter:number;mass:number;restitution:number;spinRatio:number}
export interface PhysicalPose {x:number;y:number;z:number;rotation:{x:number;y:number;z:number;w:number};rotor:number;speed:number;radius:number;relativeSpeed:number;phase:number;index:number|null;impact:number;elapsed:number}

/** Only forces and collision impulses move the ball. No target number or landing curve. */
export class BallPhysics {
 readonly world:RAPIER.World;readonly rotor:RAPIER.RigidBody;readonly ball:RAPIER.RigidBody;
 readonly radius:number;angle:number;speed:number;elapsed=0;result:number|null=null;
 private stable=0;private candidate=-1;private accumulator=0;private previous:PhysicalPose;private current:PhysicalPose;
 private events=new RAPIER.EventQueue(true);private lastHit=-1;private ballCollider:RAPIER.Collider;
 constructor(readonly launch:Launch,readonly shape:WheelShape=DEFAULT_DESIGN){
  this.radius=launch.diameter/2000/METRES_PER_UNIT;this.angle=launch.rotorAngle;this.speed=launch.rotorSpeed;
  this.world=new RAPIER.World({x:0,y:-9.81/METRES_PER_UNIT,z:0});this.world.timestep=PHYSICS_DT;
  this.world.integrationParameters.numSolverIterations=8;this.world.integrationParameters.maxCcdSubsteps=4;this.world.integrationParameters.allowedLinearError=.0002;
  this.rotor=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setAdditionalMass(1).setRotation({x:0,y:Math.sin(-this.angle/2),z:0,w:Math.cos(this.angle/2)}));
  this.build();
  const a=launch.angle,r=2.96,y=surfaceClearance(r,this.radius,shape)+.003;
  const v=-launch.direction*launch.speed;
  this.ball=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(Math.sin(a)*r,y,-Math.cos(a)*r).setLinvel(Math.cos(a)*v,0,Math.sin(a)*v).setAngvel({x:Math.sin(a)*v/this.radius*launch.spinRatio,y:0,z:-Math.cos(a)*v/this.radius*launch.spinRatio}).setLinearDamping(.012).setAngularDamping(.035).setCcdEnabled(true).setCanSleep(false));
  this.ballCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(this.radius).setMass(launch.mass/1000).setFriction(.22).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(launch.restitution).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.05),this.ball);
  this.current=this.read(0);this.previous=this.current;
 }
 private geometry(geometry:T.BufferGeometry,rotating:boolean,friction=.2,restitution=.3){
  const g=geometry.index?geometry.toNonIndexed():geometry;
  const vertices=new Float32Array(g.getAttribute('position').array);for(let i=1;i<vertices.length;i+=3)vertices[i]*=this.shape.bowlDepth;
  const indices=Uint32Array.from({length:vertices.length/3},(_,i)=>i);
  this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setDensity(0).setFriction(friction).setRestitution(restitution),rotating?this.rotor:undefined);
  if(g!==geometry)g.dispose();geometry.dispose();
 }
 private lathe(points:number[][],rotating:boolean){this.geometry(new T.LatheGeometry((rotating?[...points].reverse():points).map(([r,y])=>new T.Vector2(r,y)),128),rotating,rotating?.2:.02);}
 private build(){
  // Same cross-sections, diamonds and ring dimensions as the rendered wheel.
  this.lathe([[3.13,1.025],[3.035,.91],[3.03,.80],[3.09,.69]],false);
  this.lathe([[3.05,.80],[2.9,.75],[2.7,.60],[2.49,.44],[2.455,.425]],false);
  this.lathe([[0,.83],[.53,.82],[1.53,.34],[1.585,FLOOR],[1.985,FLOOR],[2.04,.235],[2.425,numberHeight(2.425,this.shape)],[2.44,numberHeight(2.425,this.shape)]],true);
  for(const [radius,y,tube] of rimProfile(this.shape)){
   const g=new T.TorusGeometry(radius,tube,8,128);g.rotateX(Math.PI/2);g.translate(0,y,0);this.geometry(g,radius<2.45,.18,.4);
  }
  for(let i=0;i<8;i++)this.geometry(deflectorGeometry(i),false,.18,.55);
  for(let i=0;i<37;i++){
   const a=(i+.5)*STEP;
   const wall=new T.Shape();wall.moveTo(-.015,0);wall.lineTo(.015,0);wall.lineTo(.009,DIVIDER_HEIGHT-FLOOR-.012);wall.lineTo(-.009,DIVIDER_HEIGHT-FLOOR-.012);wall.closePath();
   const g=new T.ExtrudeGeometry(wall,{depth:.398,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,steps:1,curveSegments:1});
   g.translate(0,FLOOR+.008,-.199);g.rotateY(-a);g.translate(Math.sin(a)*1.785,0,-Math.cos(a)*1.785);
   const points=new Float32Array(g.getAttribute('position').array);for(let j=1;j<points.length;j+=3)points[j]*=this.shape.bowlDepth;
   const hull=RAPIER.ColliderDesc.convexHull(points);if(!hull)throw new Error('Invalid pocket divider');
   this.world.createCollider(hull.setDensity(0).setFriction(.25).setRestitution(.35),this.rotor);g.dispose();
  }
 }
 private read(impact:number):PhysicalPose {
  const p=this.ball.translation(),v=this.ball.linvel(),r=Math.hypot(p.x,p.z);
  const relativeSpeed=Math.hypot(v.x+this.speed*p.z,v.y,v.z-this.speed*p.x);
  return {...p,rotation:{...this.ball.rotation()},rotor:this.angle,speed:this.speed,radius:r,relativeSpeed,phase:r>2.48?0:r>2.02||p.y>(FLOOR+.16)*this.shape.bowlDepth?1:2,index:this.result,impact,elapsed:this.elapsed};
 }
 step(){
  this.previous=this.current;
  const next=coast(this.speed,PHYSICS_DT);this.angle+=next.angle;this.speed=next.speed;this.elapsed+=PHYSICS_DT;
  this.rotor.setNextKinematicRotation({x:0,y:Math.sin(-this.angle/2),z:0,w:Math.cos(this.angle/2)});
  this.world.step(this.events);
  let impact=0;
  this.events.drainContactForceEvents(event=>{
   if((event.collider1()===this.ballCollider.handle||event.collider2()===this.ballCollider.handle)&&this.elapsed-this.lastHit>.045){
    // Discrete collision impulse above the continuous support force drives the sound.
    const impulse=event.totalForceMagnitude()*PHYSICS_DT;
    if(impulse>.004){impact=Math.max(impact,Math.min(1,impulse/.06));this.lastHit=this.elapsed;}
   }
  });
  this.current=this.read(impact);
  const p=this.current,local=Math.atan2(p.x,-p.z)-this.angle,index=pocketForAngle(local);
  const error=Math.atan2(Math.sin(local-index*STEP),Math.cos(local-index*STEP));
  const inside=p.radius>1.62&&p.radius<1.985&&p.y<FLOOR*this.shape.bowlDepth+this.radius+.035&&Math.abs(error)<STEP/2-.012;
  if(inside&&p.relativeSpeed<.035){this.stable=this.candidate===index?this.stable+PHYSICS_DT:0;this.candidate=index;}else{this.stable=0;this.candidate=-1;}
  if(this.result===null&&this.stable>.8){this.result=index;this.current.index=index;}
  return this.current;
 }
 advance(dt:number){
  this.accumulator+=Math.max(0,dt);let impact=0;
  while(this.accumulator>=PHYSICS_DT){impact=Math.max(impact,this.step().impact);this.accumulator-=PHYSICS_DT;}
  const a=this.accumulator/PHYSICS_DT,p=this.previous,c=this.current;
  const rotation=new T.Quaternion(p.rotation.x,p.rotation.y,p.rotation.z,p.rotation.w).slerp(new T.Quaternion(c.rotation.x,c.rotation.y,c.rotation.z,c.rotation.w),a);
  return {...c,x:p.x+(c.x-p.x)*a,y:p.y+(c.y-p.y)*a,z:p.z+(c.z-p.z)*a,rotor:p.rotor+(c.rotor-p.rotor)*a,rotation,index:this.result,impact};
 }
 dispose(){this.events.free();this.world.free();}
}
