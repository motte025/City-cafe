import * as T from 'three';
import {ballRadiusFor} from './game';
import {BallPlanner,type PlanTicket} from './ball-planner';
import type {BallPlan,PlanRequest} from './ball-plan';
import {randomSpinDuration} from './spin-duration';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {bufferSize,shadowDue} from './render-budget';
import {RenderProfile} from './render-profile';
import {WheelModel} from './wheel-model';
import {DEFAULT_DESIGN,sameShape,surfaceClearance,type DesignSettings,type WheelShape} from './wheel-shape';
import {ORDER,STEP,TAU,sample,PlaybackClock,coast,BALL_RADIUS,reversalPlan,sampleReversal,launchPosition,pocketForAngle,type Motion} from './game';
import {DEFAULT_TV,tvProjection,type TVSettings} from './tv-projection';

export class Wheel {
 renderer:T.WebGLRenderer;scene=new T.Scene();rotor=new T.Group();ball:T.Mesh;
 camera=new T.PerspectiveCamera(37,1,.1,60);
 angle=0;speed=0;timeScale=1;durationSetting=16;durationSpread=3;zoom=1;motion:Motion|null=null;elapsed=0;
 ballDiameter=21;ballMass=8.7;ballBounce=1;ballRunMin=5;ballRunMax=15;
 readonly planner=new BallPlanner();
 /** Zähler für die Messung: wie oft die Keyframe-Rückfallebene statt der Physik lief. */
 stats={throws:0,fallbacks:0};
 onLand:((index:number)=>void)|null=null;onPhase:((phase:number)=>void)|null=null;onImpact:((strength:number)=>void)|null=null;
 onLaunch:((previousNumber:number,direction:1|-1)=>void)|null=null;onPose:((angle:number,progress:number)=>void)|null=null;
 private profile?:RenderProfile;private economy=false;private renderScale=1;private lastShadow=-Infinity;private shadowDirty=true;
 private clock=new PlaybackClock();private phase=-1;private impact=-1;private tvEnabled=true;private tvSettings={...DEFAULT_TV};
 private lastIndex=0;private nextDirection:1|-1=1;private design={...DEFAULT_DESIGN};private shape:WheelShape={...DEFAULT_DESIGN};private pendingShape:WheelShape|null=null;
 private model:WheelModel;private key:T.DirectionalLight;private fill:T.DirectionalLight;private ambient:T.HemisphereLight;
 private preparation:{plan:ReturnType<typeof reversalPlan>;elapsed:number;total:number;index:number;variant:number;direction:1|-1;radius:number;y:number;offset:number;ticket:PlanTicket}|null=null;
 /** während des Countdowns vorbereiteter Wurf (Zielindex, vorhergesagter Rotorzustand, Planungsauftrag) */
 private prepared:{index:number;direction:1|-1;angle0:number;speed0:number;ticket:PlanTicket}|null=null;
 private impactCursor=0;
 constructor(private host:HTMLElement){
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(1);
  this.renderer.domElement.style.cssText='width:100%;height:100%;display:block';this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;this.renderer.info.autoReset=false;
  if(new URLSearchParams(location.search).has('profile'))this.profile=new RenderProfile(this.renderer);
  host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','3D-Roulettekessel mit geneigtem Zahlenkranz, vertieften Taschen und acht Metallrauten');
  const pmrem=new T.PMREMGenerator(this.renderer),env=new RoomEnvironment();this.scene.environment=pmrem.fromScene(env,.025).texture;this.scene.environmentIntensity=.65;env.dispose();pmrem.dispose();
  this.ambient=new T.HemisphereLight(0xd9e7ff,0x28120b,.7);this.scene.add(this.ambient);
  this.key=new T.DirectionalLight(0xffe9cc,3.2);this.key.position.set(-4,7,2);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);
  Object.assign(this.key.shadow.camera,{left:-4,right:4,top:4,bottom:-4});this.key.shadow.bias=-.00015;this.key.shadow.normalBias=.007;this.key.shadow.radius=2;this.scene.add(this.key);
  this.fill=new T.DirectionalLight(0xa8ccff,1.05);this.fill.position.set(3,4,-5);this.scene.add(this.fill);
  const rim=new T.DirectionalLight(0xffd29a,1.2);rim.position.set(1,2,-4);this.scene.add(rim);
  this.model=new WheelModel(this.renderer);this.scene.add(this.model.fixed,this.rotor);this.rotor.add(this.model.turning);
  this.ball=new T.Mesh(new T.SphereGeometry(BALL_RADIUS,40,28),new T.MeshPhysicalMaterial({color:0xfff5db,roughness:.19,metalness:.04,clearcoat:1}));this.ball.scale.setScalar(ballRadiusFor(this.ballDiameter)/BALL_RADIUS);this.ball.castShadow=true;this.ball.position.set(0,this.ballSupport(2.9),-2.9);this.scene.add(this.ball);
  const ground=new T.Mesh(new T.PlaneGeometry(12,12),new T.ShadowMaterial({opacity:.4}));ground.rotation.x=-Math.PI/2;ground.position.y=-.36;ground.receiveShadow=true;this.scene.add(ground);
  for(const event of ['visibilitychange','freeze','resume'])document.addEventListener(event,()=>{this.clock.reset();this.profile?.reset();this.shadowDirty=true;});
  new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.renderer.setAnimationLoop(t=>this.frame(t));
 }
 private ballSupport(radius:number){return surfaceClearance(radius,BALL_RADIUS*this.ball.scale.x,this.shape);}
 get designPending(){return this.pendingShape!==null;}
 setDesign(settings:DesignSettings){
  const next={...settings};this.design=next;this.model.appearance(next);
  this.key.intensity=2.6+next.lightContrast*1.5;this.fill.intensity=1.35-next.lightContrast*.7;this.ambient.intensity=.9-next.lightContrast*.35;
  if(!sameShape(this.shape,next)){if(this.motion||this.preparation)this.pendingShape=next;else this.applyShape(next);}else this.pendingShape=null;
  this.shadowDirty=true;
 }
 private applyShape(shape:WheelShape){
  this.shape={...shape};this.pendingShape=null;this.model.rebuild(this.shape);this.model.appearance(this.design);
  this.ball.position.y=this.ballSupport(Math.hypot(this.ball.position.x,this.ball.position.z));this.shadowDirty=true;
 }
 setPerformance(economy:boolean,scale:number){
  if(economy===this.economy&&scale===this.renderScale)return;this.economy=economy;this.renderScale=scale;
  const size=economy?1024:2048;if(this.key.shadow.mapSize.x!==size){this.key.shadow.map?.dispose();this.key.shadow.map=null;this.key.shadow.mapSize.set(size,size);}this.shadowDirty=true;this.resize();
 }
 setTV(enabled:boolean,settings:TVSettings){this.tvEnabled=enabled;this.tvSettings=settings;this.resize();}
 private resize(){
  const {width,height}=this.host.getBoundingClientRect();if(width<=0||height<=0)return;
  const buffer=bufferSize(width,height,devicePixelRatio,this.economy,this.renderScale);this.renderer.setSize(buffer.width,buffer.height,false);this.camera.aspect=width/height;this.shadowDirty=true;this.profile?.reset();
  const tilt=this.design.cameraTilt*Math.PI/180,distance=15.5/this.zoom/Math.min(1,this.camera.aspect);
  this.camera.position.set(0,.3+Math.cos(tilt)*distance,Math.sin(tilt)*distance);this.camera.up.set(0,0,-1);this.camera.lookAt(0,.3,0);this.camera.updateProjectionMatrix();
  if(this.tvEnabled&&this.tvSettings.correction){const p=tvProjection(this.tvSettings);const warp=new T.Matrix4().set(p.scale,0,0,0,0,p.scale*p.stretch,0,0,0,0,.2,0,0,-p.keystone*p.scale,0,1);this.camera.projectionMatrix.premultiply(warp);this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();}
 }
 /**
  * Wurf vorbereiten, sobald der Countdown läuft: Rotorzustand beim Abwurf vorhersagen
  * (Auslauf bis Countdown-Ende, dann Richtungswechsel) und die Bewegung im Hintergrund suchen.
  */
 prepare(index:number,countdown:number){
  if(this.motion||this.preparation)return;
  const direction=this.nextDirection,c=coast(this.speed,Math.max(0,countdown)),angle0=this.angle+c.angle,speed0=c.speed;
  const launch=this.launchState(angle0,speed0,direction);
  // Zeit bis zum Abwurf (Countdown + Richtungswechsel) begrenzt die Suche; danach greift die Rückfallebene.
  const budget=Math.max(1200,(Math.max(0,countdown)+reversalPlan(angle0,speed0,direction).duration)*1000-250);
  this.prepared={index,direction,angle0,speed0,ticket:this.planner.request({...this.planRequest(index,direction,launch.angle,launch.speed),timeBudgetMs:budget})};
 }
 private launchState(angle:number,speed:number,direction:1|-1){const rev=reversalPlan(angle,speed,direction),end=sampleReversal(rev,rev.duration);return {angle:end.angle,speed:rev.duration===0?speed:rev.endSpeed};}
 private planRequest(index:number,direction:1|-1,rotorStart:number,rotorSpeed:number):PlanRequest{
  return {shape:{...this.shape},ball:{diameter:this.ballDiameter,mass:this.ballMass,bounce:this.ballBounce},target:index,direction,rotorStart,rotorSpeed,
   launchAngle:launchPosition(rotorStart,this.lastIndex),duration:randomSpinDuration(this.durationSetting,this.durationSpread),runMin:this.ballRunMin,runMax:this.ballRunMax,seed:crypto.getRandomValues(new Uint32Array(1))[0]};
 }
 /** Passt ein Planungsauftrag noch zu den aktuellen Einstellungen? */
 private current(request:PlanRequest){const b=request.ball;return sameShape(request.shape,this.shape)&&b.diameter===this.ballDiameter&&b.mass===this.ballMass&&b.bounce===this.ballBounce&&request.runMin===this.ballRunMin&&request.runMax===this.ballRunMax;}
 /** overshoot: wie weit der Countdown im auslösenden Bild schon abgelaufen war (s); fehlt bei „Jetzt drehen“. */
 spin(index:number,variant:number,overshoot?:number){
  this.scene.attach(this.ball);const direction=this.nextDirection;this.nextDirection=direction===1?-1:1;
  const prep=this.prepared;this.prepared=null;
  const planned=!!prep&&overshoot!==undefined&&prep.index===index&&prep.direction===direction&&this.current(prep.ticket.request);
  let angle=this.angle,speed=this.speed,elapsed=0,ticket:PlanTicket;
  if(planned){angle=prep!.angle0;speed=prep!.speed0;elapsed=Math.max(0,overshoot!);ticket=prep!.ticket;}
  else{const launch=this.launchState(angle,speed,direction);ticket=this.planner.request({...this.planRequest(index,direction,launch.angle,launch.speed),timeBudgetMs:Math.max(1200,reversalPlan(angle,speed,direction).duration*1000-150)});}
  const plan=reversalPlan(angle,speed,direction);
  const a=Math.atan2(this.ball.position.x,-this.ball.position.z)-this.angle-this.lastIndex*STEP;
  // Ruht der Rotor (erster Wurf), gibt es keinen Richtungswechsel; die Kugel wird trotzdem sichtbar eingesetzt.
  this.preparation={plan,index,variant,direction,elapsed,total:plan.duration||.6,radius:Math.hypot(this.ball.position.x,this.ball.position.z),y:this.ball.position.y,offset:Math.atan2(Math.sin(a),Math.cos(a)),ticket};
  this.onPhase?.(-1);
 }
 /** Plan für das Einsetzen: passt er zum Rotorwinkel am Ende des Richtungswechsels? */
 private readyPlanAt(p:NonNullable<Wheel['preparation']>){const r=p.ticket.result;if(!r||!r.ok||!this.current(p.ticket.request))return null;return Math.abs(p.ticket.request.rotorStart-sampleReversal(p.plan,p.plan.duration).angle)<1e-9?r:null;}
 /** Der vorab berechnete Wurf, falls er genau zu diesem Abwurf passt. */
 private readyPlan(ticket:PlanTicket):BallPlan|null{
  const r=ticket.result;if(!r||!r.ok||!this.current(ticket.request))return null;
  return Math.abs(ticket.request.rotorStart-this.angle)<1e-9?r:null;
 }
 private beginSpin(p:NonNullable<Wheel['preparation']>){
  const {index,variant,direction}=p,plan=this.readyPlan(p.ticket),initialBall=launchPosition(this.angle,this.lastIndex);
  this.stats.throws++;
  if(plan){
   this.ball.scale.setScalar(plan.radius/BALL_RADIUS);
   this.motion={index,variant,direction,plan,duration:plan.restTime,start:this.angle,startSpeed:p.ticket.request.rotorSpeed,initialBall,shape:{...this.shape}};
  }else{
   // Rückfallebene: Keyframe-Animation, landet garantiert in der gezogenen Tasche.
   this.stats.fallbacks++;
   const radius=ballRadiusFor(this.ballDiameter);this.ball.scale.setScalar(radius/BALL_RADIUS);
   const y=surfaceClearance(2.9,radius,this.shape);this.ball.position.set(Math.sin(initialBall)*2.9,y,-Math.cos(initialBall)*2.9);
   this.motion={index,variant,direction,duration:randomSpinDuration(this.durationSetting,this.durationSpread),start:this.angle,startSpeed:this.speed,initialBall,initialRadius:2.9,initialY:y,launchDuration:0,shape:{...this.shape}};
  }
  this.elapsed=0;this.phase=-1;this.impact=-1;this.impactCursor=0;this.onLaunch?.(ORDER[this.lastIndex],direction);
 }
 /** Fortschritt für den Rollton: echte Phasen auf die bisherigen Schwellen (0,46 / 0,86) abgebildet. */
 get rollProgress(){
  const m=this.motion;if(!m)return 0;const t=this.elapsed,pl=m.plan;if(!pl)return t/m.duration;
  if(t<pl.dropTime)return .46*t/Math.max(1e-6,pl.dropTime);
  if(t<pl.entryTime)return .46+.4*(t-pl.dropTime)/Math.max(1e-6,pl.entryTime-pl.dropTime);
  return Math.min(1,.86+.14*(t-pl.entryTime)/Math.max(1e-6,pl.restTime-pl.entryTime));
 }
 /** Kurzinfo für die Debug-Anzeige im Dev-Server. */
 debugInfo(){
  const m=this.motion,pl=m?.plan,t=this.prepared?.ticket??this.preparation?.ticket,r=t?.result;
  const plan=r?(r.ok?`Plan ${r.computeMs.toFixed(0)} ms · ${r.candidates} Kandidaten${r.relaxed?' · gelockert':''}`:`Plan fehlgeschlagen (${r.candidates})`):t?'Plan wird gerechnet …':'';
  if(!m)return `${plan}\nWürfe ${this.stats.throws} · Rückfall ${this.stats.fallbacks}`;
  if(!pl)return `Keyframe-Rückfall · ${this.elapsed.toFixed(2)} s`;
  const phase=this.elapsed<pl.dropTime?'Laufbahn':this.elapsed<pl.entryTime?'Abstieg':this.elapsed<pl.restTime?'Taschen':'Ruhe';
  let contacts=0;for(let k=0;k<pl.events.length;k+=7)if(pl.events[k]<=this.elapsed)contacts++;
  return `${phase} · ${this.elapsed.toFixed(2)} / ${pl.restTime.toFixed(2)} s\nLaufweg ${pl.run} Taschen ab Tasche ${ORDER[pl.entryPocket]} · Rauten ${pl.deflectorHits}\nKontakte bisher ${contacts} · Abwurf ${(pl.launchSpeed/TAU).toFixed(2)} U/s\n${plan}\nWürfe ${this.stats.throws} · Rückfall ${this.stats.fallbacks}`;
 }
 private frame(time:number){
  const dt=this.clock.tick(time,!document.hidden)*this.timeScale;if(document.hidden)return;
  if(this.preparation){
   const p=this.preparation;p.elapsed+=dt;const aligned=sampleReversal(p.plan,p.elapsed);this.angle=aligned.angle;this.speed=aligned.speed;this.rotor.rotation.y=-this.angle;
   // Einsetzen: endet exakt am Abwurfpunkt des vorab gerechneten Wurfs (sonst am Punkt der Rückfallebene)
   const plan=this.readyPlanAt(p),targetR=plan?Math.hypot(plan.pos[0],plan.pos[2]):2.9,targetY=plan?plan.pos[1]:this.ballSupport(2.9);
   const u=Math.min(1,p.elapsed/p.total),s=u*u*(3-2*u),a=this.angle+this.lastIndex*STEP+p.offset*(1-s),r=p.radius+(targetR-p.radius)*s;
   const y=u===1?targetY:Math.max(this.ballSupport(r),p.y+(targetY-p.y)*s)+.55*Math.sin(Math.PI*u);this.ball.position.set(Math.sin(a)*r,y,-Math.cos(a)*r);
   if(u===1&&aligned.u===1){this.preparation=null;this.beginSpin(p);}
  }else if(this.motion){
   this.elapsed+=dt;const p=sample(this.motion,this.elapsed);this.angle=p.rotor;this.speed=p.speed;this.rotor.rotation.y=-this.angle;this.ball.position.set(Math.sin(p.angle)*p.radius,p.y,-Math.cos(p.angle)*p.radius);
   this.onPose?.(p.angle,this.rollProgress);const u=this.elapsed/this.motion.duration,phase=this.motion.plan?(p as {phase:number}).phase:u<.46?0:u<.86?1:2;
   if(phase!==this.phase){this.phase=phase;this.onPhase?.(phase);}
   const hits=this.motion.plan?.impacts;
   if(hits){while(this.impactCursor<hits.length&&hits[this.impactCursor]<=this.elapsed){this.onImpact?.(hits[this.impactCursor+1]);this.impactCursor+=2;}}
   else if(p.impact!==this.impact){this.impact=p.impact;if(p.impact>=0)this.onImpact?.(Math.max(.12,1-p.impact/14));}
   if(p.done){this.shadowDirty=true;this.rotor.attach(this.ball);const actual=pocketForAngle(Math.atan2(this.ball.position.x,-this.ball.position.z));this.lastIndex=actual;this.motion=null;if(this.pendingShape)this.applyShape(this.pendingShape);this.onLand?.(actual);}
  }else{const next=coast(this.speed,dt);this.angle+=next.angle;this.speed=next.speed;this.rotor.rotation.y=-this.angle;}
  const updateShadow=shadowDue(time,this.lastShadow,this.economy,!!this.preparation||!!this.motion||Math.abs(this.speed)>.0001,this.shadowDirty);this.renderer.shadowMap.needsUpdate=updateShadow;if(updateShadow){this.lastShadow=time;this.shadowDirty=false;}
  this.renderer.info.reset();const begin=this.profile?.begin()??0;this.renderer.render(this.scene,this.camera);this.profile?.end(begin,updateShadow,this.economy?'Sparsam':'Qualität');
 }
}
