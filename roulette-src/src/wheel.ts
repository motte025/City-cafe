import {batchMeshes,bufferSize,shadowDue} from './render-budget';
import {RenderProfile} from './render-profile';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ORDER, STEP, TAU, color, sample, PlaybackClock, coast, BALL_RADIUS, POCKET_RADIUS, POCKET_Y, reversalPlan,sampleReversal,supportHeight,launchPosition,pocketForAngle,type Motion} from './game';
import {DEFAULT_TV,tvProjection,type TVSettings} from './tv-projection';

export class Wheel {
 renderer:T.WebGLRenderer; scene=new T.Scene(); rotor=new T.Group(); ball:T.Mesh;
 camera=new T.PerspectiveCamera(37,1,.1,60);
 angle=0; speed=0; timeScale=1; durationSetting=16;zoom=1;motion:Motion|null=null; elapsed=0;
 onLand:((index:number)=>void)|null=null; onPhase:((phase:number)=>void)|null=null; onImpact:((strength:number)=>void)|null=null;
 onLaunch:((previousNumber:number,direction:1|-1)=>void)|null=null;
 onPose:((angle:number,progress:number)=>void)|null=null;
 private profile?:RenderProfile;private economy=false;private renderScale=1;private lastShadow=-Infinity;private shadowDirty=true;private key!:T.DirectionalLight;
 private clock=new PlaybackClock(); private phase=-1; private impact=-1;
 private tvEnabled=false;private tvSettings:TVSettings={...DEFAULT_TV};
 private lastIndex=0;private nextDirection:1|-1=1;
 private preparation:{plan:ReturnType<typeof reversalPlan>;elapsed:number;index:number;variant:number;direction:1|-1;radius:number;y:number}|null=null;
 constructor(private host:HTMLElement){
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:true});
  this.renderer.setPixelRatio(1);this.renderer.domElement.style.cssText='width:100%;height:100%;display:block';
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;
  this.renderer.info.autoReset=false;if(new URLSearchParams(location.search).has('profile'))this.profile=new RenderProfile(this.renderer);
  host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Rouletterad mit tiefen Fächern, goldenen Stegen und emaillierten Zahlen');
  const pmrem=new T.PMREMGenerator(this.renderer),env=new RoomEnvironment();
  this.scene.environment=pmrem.fromScene(env,.025).texture;this.scene.environmentIntensity=.65;env.dispose();pmrem.dispose();
  this.camera.position.set(0,10.2,5.1);this.camera.lookAt(0,.22,0);
  this.scene.add(new T.HemisphereLight(0xd9e7ff,0x1b1110,.7));
  const key=this.key=new T.DirectionalLight(0xffe9cc,3.2);key.position.set(-4,7,2);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4});
  key.shadow.bias=-.00015;key.shadow.normalBias=.009;key.shadow.radius=2;this.scene.add(key);
  const fill=new T.DirectionalLight(0xa8ccff,1.05);fill.position.set(3,4,-5);this.scene.add(fill);
  const rim=new T.DirectionalLight(0xffd29a,1.2);rim.position.set(1,2,-4);this.scene.add(rim);
  const gold=new T.MeshStandardMaterial({color:0xd8aa50,metalness:.88,roughness:.24});
  const satin=new T.MeshStandardMaterial({color:0x9e7b3b,metalness:.82,roughness:.34});
  const chrome=new T.MeshStandardMaterial({color:0xc8d8df,metalness:.92,roughness:.2});
  const ebony=new T.MeshPhysicalMaterial({color:0x060e12,metalness:.28,roughness:.33,clearcoat:.45});
  const track=new T.MeshStandardMaterial({color:0x29333b,metalness:.73,roughness:.36});
  const wood=new T.MeshPhysicalMaterial({map:this.woodTexture(),color:0xffffff,roughness:.32,metalness:.05,clearcoat:.65,clearcoatRoughness:.22});
  const fixed=new T.Group();this.scene.add(fixed,this.rotor);
  this.lathe(fixed,[[0,-.22],[3.13,-.22],[3.30,-.14],[3.38,.04],[3.38,.18],[3.34,.27]],ebony);
  this.lathe(fixed,[[3.28,-.05],[3.38,.15],[3.38,.53],[3.32,.73],[3.24,.85],[3.10,.87],[3.03,.79],[3.04,.68],[3.09,.55]],wood);
  this.ring(fixed,3.365,.23,.024,gold);this.ring(fixed,3.355,.57,.018,gold);
  this.ring(fixed,3.245,.826,.022,gold);this.ring(fixed,3.09,.829,.025,gold);this.ring(fixed,3.15,.865,.01,ebony);
  this.lathe(fixed,[[3.05,.70],[2.9,.65],[2.7,.52],[2.49,.34],[2.455,.335]],track);
  this.ring(fixed,3.02,.70,.018,chrome);this.ring(fixed,2.93,.66,.012,satin);
  this.ring(fixed,2.47,.34,.022,gold);
  for(let i=0;i<12;i++){
   const a=i*TAU/12;
   const screw=new T.Mesh(new T.CylinderGeometry(.033,.033,.014,16),gold);screw.position.set(Math.sin(a)*3.20,.866,-Math.cos(a)*3.20);fixed.add(screw);
   const slit=new T.Mesh(new T.BoxGeometry(.04,.004,.006),ebony);slit.position.copy(screw.position);slit.position.y+=.009;slit.rotation.y=-a;fixed.add(slit);
  }
  for(let i=0;i<8;i++){
   const a=(i+.5)*TAU/8,deflector=new T.Mesh(new T.OctahedronGeometry(.108),chrome);
   deflector.scale.set(.65,.7,1.3);deflector.position.set(Math.sin(a)*2.73,.61,-Math.cos(a)*2.73);deflector.rotation.y=-a+(i%2===0?0:Math.PI/2);deflector.castShadow=true;fixed.add(deflector);
  }
  // Wider enamel number band and recessed pockets with physical walls.
  this.lathe(this.rotor,[[0,.015],[2.44,.015],[2.44,.305],[2.425,.33],[2.04,.33],[1.98,.10],[1.58,.10],[1.53,.32],[1.36,.50],[.62,.76],[.29,.78],[0,.78]],ebony);
  this.ring(this.rotor,2.438,.332,.014,gold);this.ring(this.rotor,2.013,.30,.018,gold);
  this.ring(this.rotor,1.57,.265,.031,gold);this.ring(this.rotor,1.535,.325,.018,satin);
  const colors={
   red:new T.MeshPhysicalMaterial({color:0xc00623,roughness:.4,metalness:.02,clearcoat:.35}),
   black:new T.MeshPhysicalMaterial({color:0x020508,roughness:.4,metalness:.04,clearcoat:.4}),
   green:new T.MeshPhysicalMaterial({color:0x00864c,roughness:.38,metalness:.02,clearcoat:.4})
  };
  const insetColors={red:new T.MeshStandardMaterial({color:0x690a19,roughness:.53}),black:new T.MeshStandardMaterial({color:0x080d12,roughness:.51}),green:new T.MeshStandardMaterial({color:0x006038,roughness:.5})};
  // One atlas and material for all labels: 37 draw calls become one.
  const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=2048;const ctx=atlas.getContext('2d')!;
  ctx.font='700 224px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=5;
  ORDER.forEach((n,i)=>{const x=(i%8)*256,y=Math.floor(i/8)*320;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(String(n),x+128,y+170,235);ctx.fillStyle='#ffffff';ctx.fillText(String(n),x+128,y+170,235);});
  const labelTexture=new T.CanvasTexture(atlas);labelTexture.colorSpace=T.SRGBColorSpace;labelTexture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
  const labelMaterial=new T.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false});
  ORDER.forEach((n,i)=>{
   const a=i*STEP;
   this.sector(this.rotor,2.045,2.425,.334,a,colors[color(n)]);
   this.sector(this.rotor,1.585,1.975,.101,a,insetColors[color(n)]);
   const divider=new T.Mesh(new T.BoxGeometry(.028,.125,.422),gold);
   divider.position.set(Math.sin(a+STEP/2)*1.7875,.1675,-Math.cos(a+STEP/2)*1.7875);divider.rotation.y=-(a+STEP/2);divider.castShadow=true;divider.receiveShadow=true;this.rotor.add(divider);
   const edge=new T.Mesh(new T.BoxGeometry(.012,.012,.418),chrome);edge.position.copy(divider.position);edge.position.y=.231;edge.rotation.copy(divider.rotation);this.rotor.add(edge);
   const labelGeometry=new T.PlaneGeometry(.31,.365),uv=labelGeometry.getAttribute('uv');
   for(let j=0;j<uv.count;j++)uv.setXY(j,((i%8)*256+uv.getX(j)*256)/2048,1-(Math.floor(i/8)*320+(1-uv.getY(j))*320)/2048);
   const label=new T.Mesh(labelGeometry,labelMaterial);
   label.rotation.set(-Math.PI/2,0,-a);label.position.set(Math.sin(a)*2.239,.341,-Math.cos(a)*2.239);this.rotor.add(label);
   const mark=new T.Mesh(new T.BoxGeometry(.008,.005,.066),satin);mark.position.set(Math.sin(a)*1.445,.423,-Math.cos(a)*1.445);mark.rotation.y=-a;this.rotor.add(mark);
  });
  // Turned centre with walnut inlay, concentric machining and a fluted brass spindle.
  this.lathe(this.rotor,[[.93,.673],[1.03,.635],[1.23,.558],[1.30,.522]],wood);
  this.ring(this.rotor,1.30,.523,.014,gold);this.ring(this.rotor,.93,.678,.012,gold);
  for(const [r,y] of [[.72,.73],[.66,.751],[.60,.768]])this.ring(this.rotor,r,y,.008,satin);
  this.lathe(this.rotor,[[0,.78],[.35,.78],[.37,.81],[.37,.855],[.32,.895],[.255,.925],[.205,1.12],[.22,1.16],[.19,1.24],[.105,1.40],[0,1.43]],gold);
  this.ring(this.rotor,.34,.873,.012,ebony);this.ring(this.rotor,.21,1.135,.012,ebony);
  for(let i=0;i<16;i++){const a=i*TAU/16,flute=new T.Mesh(new T.CylinderGeometry(.014,.02,.15,8),satin);flute.position.set(Math.sin(a)*.239,.995,-Math.cos(a)*.239);this.rotor.add(flute);}
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2,arm=new T.Mesh(new T.CylinderGeometry(.027,.045,.64,20),gold);arm.rotation.z=Math.PI/2;arm.rotation.y=-a;arm.position.set(Math.cos(a)*.4,.99,Math.sin(a)*.4);arm.castShadow=true;this.rotor.add(arm);
   const end=new T.Mesh(new T.SphereGeometry(.073,24,16),chrome);end.position.set(Math.cos(a)*.73,.99,Math.sin(a)*.73);end.castShadow=true;this.rotor.add(end);
  }
  this.ball=new T.Mesh(new T.SphereGeometry(BALL_RADIUS,40,28),new T.MeshPhysicalMaterial({color:0xfff9dd,roughness:.19,metalness:.04,clearcoat:1}));this.ball.castShadow=true;this.ball.position.set(0,supportHeight(2.9),-2.9);this.scene.add(this.ball);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.ShadowMaterial({opacity:.42}));ground.rotation.x=-Math.PI/2;ground.position.y=-.225;ground.receiveShadow=true;this.scene.add(ground);
  batchMeshes(fixed);batchMeshes(this.rotor);
  for(const event of ['visibilitychange','freeze','resume'])document.addEventListener(event,()=>{this.clock.reset();this.profile?.reset();this.shadowDirty=true;});
  new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.renderer.setAnimationLoop(t=>this.frame(t));
 }
 private woodTexture(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#3a1012';ctx.fillRect(0,0,2048,512);
  for(let i=0;i<1800;i++){ctx.strokeStyle=`rgba(${i%3===0?'174,78,39':'11,3,9'},${.10+(i%7)*.025})`;ctx.lineWidth=.3+i%4*.4;ctx.beginPath();for(let x=0;x<=2048;x+=8){const y=i/1800*512+5*Math.sin(x*.004+i*.045)+2*Math.sin(x*.019+i*.17);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,1);texture.anisotropy=8;return texture;
 }
 private lathe(parent:T.Group,profile:number[][],material:T.Material){const mesh=new T.Mesh(new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),128),material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}
 private ring(parent:T.Group,r:number,y:number,t:number,material:T.Material){const mesh=new T.Mesh(new T.TorusGeometry(r,t,8,128),material);mesh.rotation.x=Math.PI/2;mesh.position.y=y;mesh.castShadow=true;parent.add(mesh);}
 private sector(parent:T.Group,inner:number,outer:number,y:number,a:number,material:T.Material){
  const vertices:number[]=[],segments=10;
  for(let j=0;j<segments;j++){const x=a-STEP/2+.003+j*(STEP-.006)/segments,z=a-STEP/2+.003+(j+1)*(STEP-.006)/segments;for(const [r,t] of [[inner,x],[outer,z],[outer,x],[inner,x],[inner,z],[outer,z]])vertices.push(Math.sin(t)*r,y,-Math.cos(t)*r);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;parent.add(mesh);
 }
 setPerformance(economy:boolean,scale:number){if(economy===this.economy&&scale===this.renderScale)return;this.economy=economy;this.renderScale=scale;
  const size=economy?1024:2048;if(this.key.shadow.mapSize.x!==size){this.key.shadow.map?.dispose();this.key.shadow.map=null;this.key.shadow.mapSize.set(size,size);}
  this.shadowDirty=true;this.resize();
 }
 setTV(enabled:boolean,settings:TVSettings){this.tvEnabled=enabled;this.tvSettings=settings;this.resize();}
 private resize(){
  const {width,height}=this.host.getBoundingClientRect();if(width<=0||height<=0)return;
  const buffer=bufferSize(width,height,devicePixelRatio,this.economy,this.renderScale);this.renderer.setSize(buffer.width,buffer.height,false);this.camera.aspect=width/height;this.shadowDirty=true;this.profile?.reset();
  if(this.tvEnabled){this.camera.position.set(0,15.2/this.zoom/Math.min(1,this.camera.aspect),0);this.camera.up.set(0,0,-1);}else{this.camera.position.set(0,10.2/this.zoom,5.1/this.zoom);this.camera.up.set(0,1,0);}
  this.camera.lookAt(0,.22,0);this.camera.updateProjectionMatrix();
  if(this.tvEnabled&&this.tvSettings.correction){const p=tvProjection(this.tvSettings);const warp=new T.Matrix4().set(p.scale,0,0,0, 0,p.scale*p.stretch,0,0, 0,0,.2,0, 0,-p.keystone*p.scale,0,1);this.camera.projectionMatrix.premultiply(warp);this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();}
 }
 spin(index:number,variant:number){
  this.scene.attach(this.ball);const direction=this.nextDirection;this.nextDirection=direction===1?-1:1;
  const plan=reversalPlan(this.angle,this.speed,direction);
  this.preparation={plan,index,variant,direction,elapsed:0,radius:Math.hypot(this.ball.position.x,this.ball.position.z),y:this.ball.position.y};
  if(plan.duration===0){this.preparation=null;this.beginSpin(index,variant,direction);}else this.onPhase?.(-1);
 }
 private beginSpin(index:number,variant:number,direction:1|-1){
  const initialBall=launchPosition(this.angle,this.lastIndex);
  this.ball.position.set(Math.sin(initialBall)*2.9,supportHeight(2.9),-Math.cos(initialBall)*2.9);
  this.motion={index,variant,direction,duration:this.durationSetting+variant*.35,start:this.angle,startSpeed:this.speed,initialBall,initialRadius:2.9,initialY:supportHeight(2.9),launchDuration:0};
  this.elapsed=0;this.phase=-1;this.impact=-1;
  this.onLaunch?.(ORDER[this.lastIndex],direction);
 }
 private frame(time:number){
  const dt=this.clock.tick(time,!document.hidden)*this.timeScale;
  if(!document.hidden){
   if(this.preparation){
    const p=this.preparation;p.elapsed+=dt;const aligned=sampleReversal(p.plan,p.elapsed);this.angle=aligned.angle;this.speed=aligned.speed;this.rotor.rotation.y=-this.angle;
    const u=aligned.u,s=u*u*(3-2*u),a=this.angle+this.lastIndex*STEP,r=p.radius+(2.9-p.radius)*s;
    const y=Math.max(supportHeight(r),p.y+(supportHeight(2.9)-p.y)*s)+.55*Math.sin(Math.PI*u);
    this.ball.position.set(Math.sin(a)*r,y,-Math.cos(a)*r);
    if(u===1){this.preparation=null;this.beginSpin(p.index,p.variant,p.direction);}
   }else if(this.motion){
    this.elapsed+=dt;const p=sample(this.motion,this.elapsed);this.angle=p.rotor;this.speed=p.speed;this.rotor.rotation.y=-this.angle;
    this.ball.position.set(Math.sin(p.angle)*p.radius,p.y,-Math.cos(p.angle)*p.radius);
    this.onPose?.(p.angle,this.elapsed/this.motion.duration);
    const u=this.elapsed/this.motion.duration,phase=u<.46?0:u<.86?1:2;
    if(phase!==this.phase){this.phase=phase;this.onPhase?.(phase);}
    if(p.impact!==this.impact){this.impact=p.impact;if(p.impact>=0)this.onImpact?.(1-p.impact/11);}
    if(p.done){this.shadowDirty=true;this.rotor.attach(this.ball);const actual=pocketForAngle(Math.atan2(this.ball.position.x,-this.ball.position.z));this.lastIndex=actual;this.motion=null;this.onLand?.(actual);}
   }else{const next=coast(this.speed,dt);this.angle+=next.angle;this.speed=next.speed;this.rotor.rotation.y=-this.angle;}
  }
  if(document.hidden)return;
  const updateShadow=shadowDue(time,this.lastShadow,this.economy,!!this.preparation||!!this.motion||Math.abs(this.speed)>.0001,this.shadowDirty);
  this.renderer.shadowMap.needsUpdate=updateShadow;if(updateShadow){this.lastShadow=time;this.shadowDirty=false;}
  this.renderer.info.reset();const begin=this.profile?.begin()??0;this.renderer.render(this.scene,this.camera);this.profile?.end(begin,updateShadow,this.economy?'Sparsam':'Qualität');
 }
}

