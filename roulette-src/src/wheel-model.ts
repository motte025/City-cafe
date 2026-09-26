import * as T from 'three';
import {ORDER,STEP,TAU,color} from './game';
import {batchMeshes} from './render-budget';
import {DEFAULT_DESIGN,FLOOR,DIVIDER_HEIGHT,numberHeight,trackHeight,rimProfile,type DesignSettings,type WheelShape} from './wheel-shape';
import {MM_PER_UNIT} from './ball-config';

export function deflectorGeometry(index:number){
 const a=(index+.5)*TAU/8,rotation=index%2?Math.PI/2:0;
 const corners=[[0,-.13],[.078,0],[0,.13],[-.078,0]];
 const points=corners.map(([x,z])=>{
  const tangent=x*Math.cos(rotation)-z*Math.sin(rotation),radial=x*Math.sin(rotation)+z*Math.cos(rotation);
  const r=2.74+radial,wx=Math.sin(a)*r+Math.cos(a)*tangent,wz=-Math.cos(a)*r+Math.sin(a)*tangent;
  return [wx,trackHeight(Math.hypot(wx,wz))+.006,wz];
 });
 points.push([Math.sin(a)*2.74,trackHeight(2.74)+.092,-Math.cos(a)*2.74]);
 const vertices:number[]=[];for(let i=0;i<4;i++)for(const j of [i,(i+1)%4,4])vertices.push(...points[j]);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}

export function numberGeometry(index:number,shape:WheelShape){
 const a=index*STEP,g=new T.PlaneGeometry(.325*shape.numberSize,.352*shape.numberSize,4,4),p=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let j=0;j<p.count;j++){
  const r=2.235+p.getY(j),x=Math.sin(a)*r+Math.cos(a)*p.getX(j),z=-Math.cos(a)*r+Math.sin(a)*p.getX(j);
  p.setXYZ(j,x,numberHeight(Math.hypot(x,z),shape)+.006,z);
  uv.setXY(j,((index%8)*256+uv.getX(j)*256)/2048,1-(Math.floor(index/8)*320+(1-uv.getY(j))*320)/2048);
 }
 g.computeVertexNormals();return g;
}

export class WheelModel {
 fixed=new T.Group();turning=new T.Group();
 // polygonOffset: schiebt die dünnen Zierringe im Tiefenpuffer minimal Richtung Kamera, damit sie
 // an Stellen, wo Ring und Fläche fast auf gleicher Höhe liegen (bündig abgesenkte Ringe), nicht
 // mit der Fläche um denselben Bildpunkt konkurrieren ("Z-Fighting", sichtbar als flackernde Linie
 // mit Bildfehlern) – unabhängig von Kameraabstand oder GPU-Genauigkeit.
 private metal=new T.MeshStandardMaterial({metalness:.93,roughness:.23,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 private satin=new T.MeshStandardMaterial({metalness:.85,roughness:.35});
 private chrome=new T.MeshStandardMaterial({color:0xd5e0e8,metalness:.97,roughness:.17});
 /** Gedämpfteres, mattes Metall nur für die 8 Rauten – heller Chrom stach zu sehr gegen das dunkle Holz hervor. */
 private deflectorMetal=new T.MeshStandardMaterial({color:0x8b939c,metalness:.6,roughness:.5});
 private ebony=new T.MeshPhysicalMaterial({color:0x080c0e,metalness:.3,roughness:.3,clearcoat:.65});
 private wood=new T.MeshPhysicalMaterial({roughness:.27,metalness:.06,clearcoat:.7,clearcoatRoughness:.18});
 private track=new T.MeshPhysicalMaterial({roughness:.3,metalness:.2,clearcoat:.6});
 private inner=this.wood.clone();
 private colors={red:new T.MeshPhysicalMaterial({color:0x990b21,roughness:.31,metalness:.08,clearcoat:.65}),black:new T.MeshPhysicalMaterial({color:0x070b10,roughness:.31,metalness:.12,clearcoat:.65}),green:new T.MeshPhysicalMaterial({color:0x006b3f,roughness:.31,metalness:.08,clearcoat:.65})};
 private pockets={red:new T.MeshStandardMaterial({color:0x740c20,roughness:.42}),black:new T.MeshStandardMaterial({color:0x090f14,roughness:.44}),green:new T.MeshStandardMaterial({color:0x005736,roughness:.42})};
 private labels:T.MeshBasicMaterial;
 // Goldener Schriftring auf der inneren Kesselfläche ("CITY-CAFE KLAGENFURT", umlaufend,
 // Ende geht nahtlos in den Anfang über). polygonOffset wie bei den Zierringen, sonst
 // droht an der fast planparallelen Fläche wieder Z-Fighting (siehe wheel-shape.ts).
 private gold=new T.MeshStandardMaterial({transparent:true,metalness:.75,roughness:.32,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 private logoTexture(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=440;
  const ctx=canvas.getContext('2d')!;
  const repeats=3,unit=2048/repeats,phrase='CITY-CAFE KLAGENFURT   \u2726   ',font='700 256px Georgia, "Times New Roman", serif';
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.font=font;
  const natural=ctx.measureText(phrase).width;
  for(let i=0;i<repeats;i++){
   ctx.save();ctx.translate(i*unit,canvas.height/2);ctx.scale(unit/natural,1);
   const grad=ctx.createLinearGradient(0,-140,0,140);
   grad.addColorStop(0,'#fbecc0');grad.addColorStop(.45,'#d9ad52');grad.addColorStop(.55,'#a97c2e');grad.addColorStop(1,'#f6e0a4');
   ctx.fillStyle=grad;ctx.shadowColor='rgba(20,10,0,.55)';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
   ctx.font=font;ctx.fillText(phrase,0,0);
   ctx.restore();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;return texture;
 }
 constructor(renderer:T.WebGLRenderer){
  this.wood.map=this.woodTexture();this.track.map=this.wood.map;
  this.inner.map=this.wood.map;
  this.gold.map=this.logoTexture();
  const atlas=document.createElement('canvas');atlas.width=atlas.height=2048;const ctx=atlas.getContext('2d')!;
  ctx.font='700 230px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;
  ORDER.forEach((n,i)=>{const x=i%8*256,y=Math.floor(i/8)*320;ctx.strokeStyle='#1b100c';ctx.strokeText(String(n),x+128,y+168,236);ctx.fillStyle='#fff5db';ctx.fillText(String(n),x+128,y+168,236);});
  const map=new T.CanvasTexture(atlas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  this.labels=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});
  this.rebuild(DEFAULT_DESIGN);this.appearance(DEFAULT_DESIGN);
 }
 appearance(s:DesignSettings){
  this.wood.color.copy(new T.Color(0x55413a).lerp(new T.Color(0xffffff),s.woodWarmth));
  this.track.color.copy(new T.Color(0x211b1a).lerp(new T.Color(0xb99973),s.woodWarmth));
  this.metal.color.copy(new T.Color(0xd2dce0).lerp(new T.Color(0xd4a553),s.metalWarmth));
  this.satin.color.copy(new T.Color(0x808b90).lerp(new T.Color(0x9b783f),s.metalWarmth));
 this.deflectorMetal.color.copy(new T.Color(0x878f97).lerp(new T.Color(0x8a6f45),s.metalWarmth));
  for(const mat of [this.wood,this.track,this.ebony]){mat.roughness=.45-s.gloss*.25;mat.clearcoat=.3+s.gloss*.5;}
  for(const mat of Object.values(this.colors)){mat.roughness=.5-s.gloss*.12;mat.clearcoat=.2+s.gloss*.25;}
  this.metal.roughness=.36-s.gloss*.19;this.chrome.roughness=.3-s.gloss*.18;this.deflectorMetal.roughness=.62-s.gloss*.18;
  this.inner.color.copy(this.wood.color).multiplyScalar(s.innerTone);
  this.wood.color.multiplyScalar(s.outerTone);this.track.color.multiplyScalar(s.trackTone);
  for(const [mat,gloss] of [[this.inner,s.innerGloss],[this.wood,s.outerGloss]] as const){mat.roughness=.65-gloss*.5;mat.clearcoat=gloss;}
  for(const [key,mat] of Object.entries(this.pockets)){mat.color.set(key==='red'?0x740c20:key==='green'?0x005736:0x090f14).multiplyScalar(.6+s.pocketRichness*.8);}
 }
 rebuild(shape:WheelShape){
  for(const group of [this.fixed,this.turning]){for(const child of [...group.children]){if(child instanceof T.Mesh)child.geometry.dispose();group.remove(child);}}
  const f=this.fixed,r=this.turning,m=this.metal,b=this.ebony;
  this.lathe(f,[[0,-.24],[3.14,-.24],[3.34,-.12],[3.40,.10],[3.40,.27],[3.33,.35]],b);
  this.lathe(f,[[3.28,.1],[3.40,.25],[3.40,.61],[3.35,.85],[3.24,1.02],[3.13,1.025],[3.035,.91],[3.03,.80],[3.09,.69]],this.wood);
  for(const [radius,y,t] of [[3.39,.31,.02],[3.37,.69,.016],[3.26,.99,.02],[3.115,.998,.027]])this.ring(f,radius,y,t,m);
  this.ring(f,3.195,1.04,.009,b);
  this.lathe(f,[[3.05,.80],[2.9,.75],[2.7,.60],[2.49,.44],[2.455,.425]],this.track);
  for(const [radius,y,t] of rimProfile(shape).filter(([radius])=>radius>2.45))this.ring(f,radius,y,t,m);
  for(let i=0;i<12;i++){
   const a=i*TAU/12,position=new T.Vector3(Math.sin(a)*3.20,1.032,-Math.cos(a)*3.20);
   const screw=this.mesh(f,new T.CylinderGeometry(.025,.025,.009,12),this.satin);screw.position.copy(position);
   const slit=this.mesh(f,new T.BoxGeometry(.031,.002,.004),b);slit.position.copy(position);slit.position.y+=.006;slit.rotation.y=-a;
  }
  for(let i=0;i<8;i++)this.mesh(f,deflectorGeometry(i),this.deflectorMetal);
  this.lathe(r,[[0,.012],[2.44,.012],[2.44,numberHeight(2.425,shape)],[2.425,numberHeight(2.425,shape)-.006],[2.04,.229],[1.985,FLOOR-.006],[1.585,FLOOR-.006],[1.53,.34],[.53,.82],[0,.83]],b);
  this.lathe(r,[[1.525,.345],[1.36,.447],[1.02,.653],[.62,.804],[.40,.839]],this.inner);
  // Schriftring ganz außen auf der Innenfläche, bis an die Kante des Zahlenkranzes (r 1,02–1,525
  // – dieselben Eckpunkte wie die Fläche darunter, also exakt deren Neigung über den Knick bei
  // r=1,36 hinweg). Das Zentrum (r < 1,02, Richtung Nabe) bleibt frei für künftige Veranstaltungen.
  // +LOGO_LIFT und polygonOffset auf this.gold: zusammen wie bei den Zierringen gegen Z-Fighting
  // (siehe wheel-shape.ts) – hier vorsorglich gleich mit eingebaut statt es erst zu entdecken.
  const LOGO_LIFT=.2/MM_PER_UNIT;
  const logo=this.lathe(r,[[1.525,.345+LOGO_LIFT],[1.36,.447+LOGO_LIFT],[1.02,.653+LOGO_LIFT]],this.gold);
  logo.castShadow=false;
  for(const [radius,y,t] of rimProfile(shape).filter(([radius])=>radius<2.45))this.ring(r,radius,y,t,m);
  this.ring(r,1.53,.348,.016,b);
  const wall=new T.Shape();wall.moveTo(-.015,0);wall.lineTo(.015,0);wall.lineTo(.009,DIVIDER_HEIGHT-FLOOR-.012);wall.lineTo(-.009,DIVIDER_HEIGHT-FLOOR-.012);wall.closePath();
  ORDER.forEach((n,i)=>{
   const a=i*STEP;
   this.sector(r,2.04,2.425,a,x=>numberHeight(x,shape),this.colors[color(n)]);
   this.sector(r,1.585,1.985,a,()=>FLOOR,this.pockets[color(n)]);
   const divider=this.mesh(r,new T.ExtrudeGeometry(wall,{depth:.398,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,steps:1,curveSegments:1}),m);
   divider.geometry.translate(0,FLOOR+.008,-.199);divider.position.set(Math.sin(a+STEP/2)*1.785,0,-Math.cos(a+STEP/2)*1.785);divider.rotation.y=-(a+STEP/2);
   // Raised, gently chamfered rear lip makes each enamel bed a real recessed pocket.
   this.sector(r,1.976,1.993,a,()=>FLOOR+.013,this.satin);
   const label=this.mesh(r,numberGeometry(i,shape),this.labels,false,false);label.renderOrder=1;
  });
  // Tall turned spindle, fluted collar and slender polished arms.
  this.lathe(r,[[0,.825],[.34,.825],[.365,.855],[.365,.94],[.30,.97],[.26,1.04],[.19,1.20],[.16,1.37],[.22,1.49],[.225,1.53],[.13,1.555],[0,1.555]],m);
  this.ring(r,.354,.88,.01,b);this.ring(r,.31,.965,.01,this.chrome);this.ring(r,.213,1.51,.012,this.chrome);
  for(let i=0;i<20;i++){const a=i*TAU/20;const flute=this.mesh(r,new T.CylinderGeometry(.008,.011,.095,6),this.chrome);flute.position.set(Math.sin(a)*.35,.925,-Math.cos(a)*.35);}
  for(let i=0;i<4;i++){
   const a=i*TAU/4,arm=this.mesh(r,new T.CylinderGeometry(.021,.033,.67,16),m);arm.rotation.z=Math.PI/2;arm.rotation.y=-a;arm.position.set(Math.cos(a)*.43,1.105,Math.sin(a)*.43);
   const sleeve=this.mesh(r,new T.CylinderGeometry(.036,.036,.13,16),this.satin);sleeve.rotation.copy(arm.rotation);sleeve.position.set(Math.cos(a)*.39,1.105,Math.sin(a)*.39);
   const end=this.mesh(r,new T.SphereGeometry(.060,20,14),this.chrome);end.position.set(Math.cos(a)*.775,1.105,Math.sin(a)*.775);
  }
  for(const group of [f,r]){
   batchMeshes(group);
   for(const mesh of group.children as T.Mesh[]){mesh.geometry.scale(1,shape.bowlDepth,1);mesh.geometry.computeBoundingSphere();}
  }
 }
 private mesh(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,cast=true,receive=true){const mesh=new T.Mesh(geometry,material);mesh.castShadow=cast;mesh.receiveShadow=receive;parent.add(mesh);return mesh;}
 private lathe(parent:T.Group,profile:number[][],material:T.Material){return this.mesh(parent,new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),128),material);}
 private ring(parent:T.Group,r:number,y:number,t:number,material:T.Material){const mesh=this.mesh(parent,new T.TorusGeometry(r,t,8,128),material);mesh.rotation.x=Math.PI/2;mesh.position.y=y;return mesh;}
 private sector(parent:T.Group,inner:number,outer:number,a:number,height:(r:number)=>number,material:T.Material){
  const vertices:number[]=[];for(let j=0;j<8;j++){const x=a-STEP/2+.003+j*(STEP-.006)/8,z=x+(STEP-.006)/8;for(const [r,t] of [[inner,x],[outer,z],[outer,x],[inner,x],[inner,z],[outer,z]])vertices.push(Math.sin(t)*r,height(r),-Math.cos(t)*r);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return this.mesh(parent,geometry,material,false,true);
 }
 private woodTexture(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#71321b';ctx.fillRect(0,0,2048,512);
  for(let i=0;i<1600;i++){ctx.strokeStyle=`rgba(${i%3===0?'239,154,67':'29,8,4'},${.07+(i%7)*.025})`;ctx.lineWidth=.3+i%4*.35;ctx.beginPath();for(let x=0;x<=2048;x+=8){const y=i/1600*512+8*Math.sin(x*.004+i*.045)+3*Math.sin(x*.016+i*.17);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,1);texture.anisotropy=8;return texture;
 }
}
