import * as T from 'three';
import {ORDER,STEP,TAU,color} from './game';
import {batchMeshes} from './render-budget';
import {DEFAULT_DESIGN,FLOOR,dividerTop,numberHeight,trackHeight,lipHeight,rimProfile,type DesignSettings,type WheelShape} from './wheel-shape';
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
 /** Mittelkreuz (Nabe und Arme): eigenes Metall, damit „Chrom bis Messing“ nur das Kreuz färbt. */
 private crossMetal=new T.MeshStandardMaterial({metalness:.93,roughness:.23});
 /** Gedämpfteres, mattes Metall nur für die 8 Rauten – heller Chrom stach zu sehr gegen das dunkle Holz hervor. */
 private deflectorMetal=new T.MeshStandardMaterial({color:0x8b939c,metalness:.6,roughness:.5});
 /** Stege zwischen den Taschen: eigenes Material (Chrom bis Messing, matt bis Glanz per Fernbedienung). */
 private fretMetal=new T.MeshStandardMaterial({metalness:.93,roughness:.23,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 private ebony=new T.MeshPhysicalMaterial({color:0x080c0e,metalness:.3,roughness:.3,clearcoat:.65});
 private wood=new T.MeshPhysicalMaterial({roughness:.27,metalness:.06,clearcoat:.7,clearcoatRoughness:.3});
 private track=new T.MeshPhysicalMaterial({roughness:.3,metalness:.2,clearcoat:.6});
 private inner=this.wood.clone();
 private colors={red:new T.MeshPhysicalMaterial({color:0x990b21,roughness:.31,metalness:.08,clearcoat:.65}),black:new T.MeshPhysicalMaterial({color:0x070b10,roughness:.31,metalness:.12,clearcoat:.65}),green:new T.MeshPhysicalMaterial({color:0x006b3f,roughness:.31,metalness:.08,clearcoat:.65})};
 private pockets={red:new T.MeshStandardMaterial({color:0x740c20,roughness:.42}),black:new T.MeshStandardMaterial({color:0x090f14,roughness:.44}),green:new T.MeshStandardMaterial({color:0x005736,roughness:.42})};
 private labels:T.MeshBasicMaterial;
 // Goldene Schrift auf der inneren Kesselfläche (feststehend, siehe lettering()). polygonOffset wie bei
 // den Zierringen, sonst droht an der fast planparallelen Fläche wieder Z-Fighting (siehe wheel-shape.ts).
 private gold=new T.MeshStandardMaterial({transparent:true,metalness:.75,roughness:.32,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 constructor(renderer:T.WebGLRenderer){
  this.setWood(0,0,0,.5,.5);
  this.drawLettering(DEFAULT_DESIGN.emblem,DEFAULT_DESIGN);{const tex=new T.CanvasTexture(this.letteringCanvas!);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;this.gold.map=tex;}
  
  const atlas=document.createElement('canvas');atlas.width=atlas.height=2048;this.numberCanvas=atlas;
  const map=new T.CanvasTexture(atlas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  this.labels=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});this.drawNumbers(false);
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
  this.setWood(s.woodOuter,s.woodTrack,s.woodInner,s.grainTrack,s.grainInner);
  if(s.crossStyle!==this.crossStyle){this.crossStyle=s.crossStyle;this.buildCross();}this.drawNumbers(s.goldNumbers);
  const brass=new T.Color(0xcf9f4a);this.chrome.color.copy(new T.Color(0xd5e0e8).lerp(brass,s.brass));this.crossMetal.color.copy(this.metal.color).lerp(brass,s.brass);this.crossMetal.roughness=this.metal.roughness;
  // Stege und Rauten: Chrom ↔ Messing, matt ↔ Hochglanz (Metalness hoch, Rauheit über den Glanzregler).
  this.fretMetal.color.copy(new T.Color(0xd2dce0).lerp(new T.Color(0xd4a553),s.fretBrass));this.fretMetal.roughness=.85-s.fretGloss*.72;this.fretMetal.metalness=.6-s.fretGloss*.25;
  this.deflectorMetal.color.copy(new T.Color(0x9aa3ab).lerp(new T.Color(0xd9aa52),s.diamondBrass));this.deflectorMetal.roughness=.85-s.diamondGloss*.72;this.deflectorMetal.metalness=.55-s.diamondGloss*.25;
  // Glanz: glatte Oberfläche mit hellen Lichtkanten. Die Umgebung ist bewusst schwach – reines Spiegelmetall wirkte dort dunkel statt blank,
  // deshalb sinkt der Metallanteil mit dem Glanz leicht, die Farbe bleibt hell und die Lichter setzen scharfe Glanzpunkte.
  this.drawLettering(s.emblem,s);
  for(const [key,mat] of Object.entries(this.pockets)){mat.color.set(key==='red'?0x740c20:key==='green'?0x005736:0x090f14).multiplyScalar(.6+s.pocketRichness*.8);}
 }
 rebuild(shape:WheelShape){
  this.depth=shape.bowlDepth;this.glow=null; // Geometrie wird unten mit entsorgt, bei Bedarf neu anlegen
  for(const group of [this.fixed,this.turning]){for(const child of [...group.children]){if(child instanceof T.Mesh)child.geometry.dispose();group.remove(child);}}
  const f=this.fixed,r=this.turning,m=this.metal,b=this.ebony;
  this.lathe(f,[[0,-.24],[3.14,-.24],[3.34,-.12],[3.40,.10],[3.40,.27],[3.33,.35]],b);
  this.lathe(f,[[3.28,.1],[3.40,.25],[3.40,.61],[3.35,.85],[3.24,1.02],[3.13,1.025],[3.035,.91],[3.03,.80],[3.09,.69]],this.wood);
  for(const [radius,y,t] of [[3.39,.31,.02],[3.37,.69,.016],[3.26,.99,.02],[3.115,.998,.027]])this.ring(f,radius,y,t,m);
  this.ring(f,3.195,1.04,.009,b);
  this.lathe(f,[[3.05,.80],[2.9,.75],[2.7,.60],[2.49,.44],[2.455,lipHeight(shape)]],this.track);
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
  // Seit 27.09.2026 feststehend (im nicht drehenden Teil): oben „CITY-CAFE“, unten „KLAGENFURT“ und
  // das Emblem stehen nie auf dem Kopf; das Holz dreht sich darunter weiter.
  this.lettering(f);
  for(const [radius,y,t] of rimProfile(shape).filter(([radius])=>radius<2.45))this.ring(r,radius,y,t,m);
  this.ring(r,1.53,.348,.016,b);
  const wall=new T.Shape();wall.moveTo(-.015,0);wall.lineTo(.015,0);wall.lineTo(.009,dividerTop(shape)-FLOOR-.012);wall.lineTo(-.009,dividerTop(shape)-FLOOR-.012);wall.closePath();
  ORDER.forEach((n,i)=>{
   const a=i*STEP;
   this.sector(r,2.04,2.425,a,x=>numberHeight(x,shape),this.colors[color(n)]);
   this.sector(r,1.585,1.985,a,()=>FLOOR,this.pockets[color(n)]);
   const divider=this.mesh(r,new T.ExtrudeGeometry(wall,{depth:.398,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,steps:1,curveSegments:1}),this.fretMetal);
   divider.geometry.translate(0,FLOOR+.008,-.199);divider.position.set(Math.sin(a+STEP/2)*1.785,0,-Math.cos(a+STEP/2)*1.785);divider.rotation.y=-(a+STEP/2);
   // Raised, gently chamfered rear lip makes each enamel bed a real recessed pocket.
   this.sector(r,1.976,1.993,a,()=>FLOOR+.013,this.satin);
   const label=this.mesh(r,numberGeometry(i,shape),this.labels,false,false);label.renderOrder=1;
  });
  // Tall turned spindle, fluted collar and slender polished arms.
  this.lathe(r,[[0,.825],[.34,.825],[.365,.855],[.365,.94],[.30,.97],[.26,1.04],[.19,1.20],[.16,1.37],[.22,1.49],[.225,1.53],[.13,1.555],[0,1.555]],this.crossMetal);
  this.ring(r,.354,.88,.01,b);this.ring(r,.31,.965,.01,this.chrome);this.ring(r,.213,1.51,.012,this.chrome);
  for(let i=0;i<20;i++){const a=i*TAU/20;const flute=this.mesh(r,new T.CylinderGeometry(.008,.011,.095,6),this.chrome);flute.position.set(Math.sin(a)*.35,.925,-Math.cos(a)*.35);}
  for(const group of [f,r]){
   batchMeshes(group);
   for(const mesh of group.children as T.Mesh[]){mesh.geometry.scale(1,shape.bowlDepth,1);mesh.geometry.computeBoundingSphere();}
  }
  // Mittelkreuz als eigene Gruppe (nicht zusammengefasst), damit die Variante ohne Neubau wechseln kann.
  this.crossGroup.scale.y=shape.bowlDepth;r.add(this.crossGroup);this.buildCross();
 }
 private crossGroup=new T.Group();private crossStyle=0;private medallion:T.MeshStandardMaterial|null=null;
 /**
  * Mittelkreuz-Varianten: 0 Klassisch (4 Arme, Kugelenden), 1 Stern (8 Arme), 2 Krone (4 Arme mit
  * Tulpenenden und Krönchen), 3 Schlicht (flache polierte Kappe ohne Arme), 4 City Cafe (Medaillon
  * mit „CC · CITY CAFE“ oben, kurze Arme mit Scheiben).
  */
 /** Medaillon gegen die Rotordrehung halten, damit „CC“ nie auf dem Kopf steht. */
 uprightCoin(rotorAngle:number){const coin=this.crossGroup.getObjectByName('coin');if(coin)coin.rotation.y=rotorAngle;}
 private buildCross(){
  const g=this.crossGroup;for(const child of [...g.children]){if(child instanceof T.Mesh)child.geometry.dispose();g.remove(child);}
  const arm=(a:number,len:number,y:number,thin=1)=>{const m=this.mesh(g,new T.CylinderGeometry(.021*thin,.033*thin,len,16),this.crossMetal);m.rotation.z=Math.PI/2;m.rotation.y=-a;m.position.set(Math.cos(a)*(.1+len/2),y,Math.sin(a)*(.1+len/2));
   const sleeve=this.mesh(g,new T.CylinderGeometry(.036*thin,.036*thin,.13,16),this.satin);sleeve.rotation.copy(m.rotation);sleeve.position.set(Math.cos(a)*.39,y,Math.sin(a)*.39);return .1+len;};
  const at=(a:number,r:number,y:number,o:T.Object3D)=>{o.position.set(Math.cos(a)*r,y,Math.sin(a)*r);return o;};
  const style=this.crossStyle;
  if(style===1)for(let i=0;i<8;i++){const a=i*TAU/8,len=i%2?.46:.67,end=arm(a,len,1.105,i%2?.75:1);at(a,end,1.105,this.mesh(g,new T.SphereGeometry(i%2?.042:.058,18,12),this.chrome));}
  else if(style===2){for(let i=0;i<4;i++){const a=i*TAU/4,end=arm(a,.62,1.105);const tulip=at(a,end+.04,1.105,this.mesh(g,new T.ConeGeometry(.08,.2,16),this.chrome));tulip.rotation.z=-Math.PI/2;tulip.rotation.y=-a;at(a,end+.12,1.105,this.mesh(g,new T.SphereGeometry(.035,14,10),this.chrome));}
   // Krone: breiter Reif mit acht nach außen geneigten Zacken und Perlen, von oben gut zu sehen
   const band=this.mesh(g,new T.CylinderGeometry(.3,.24,.14,48),this.crossMetal);band.position.y=1.5;
   const rim=this.mesh(g,new T.TorusGeometry(.3,.022,10,48),this.chrome);rim.rotation.x=Math.PI/2;rim.position.y=1.57;
   for(let i=0;i<8;i++){const a=i*TAU/8,tilt=.6;const spike=at(a,.34,1.66,this.mesh(g,new T.ConeGeometry(.055,.24,14),this.crossMetal));spike.rotation.set(Math.sin(a)*tilt,0,-Math.cos(a)*tilt);
    at(a,.41,1.76,this.mesh(g,new T.SphereGeometry(.04,14,10),this.chrome));at(a+TAU/16,.3,1.57,this.mesh(g,new T.SphereGeometry(.028,12,8),this.chrome));}
   const ball=this.mesh(g,new T.SphereGeometry(.09,20,14),this.chrome);ball.position.set(0,1.66,0);
   const post=this.mesh(g,new T.BoxGeometry(.04,.16,.04),this.crossMetal);post.position.y=1.8;const bar=this.mesh(g,new T.BoxGeometry(.12,.04,.04),this.crossMetal);bar.position.y=1.82;}
  else if(style===3){const cap=this.mesh(g,new T.CylinderGeometry(.33,.36,.06,48),this.crossMetal);cap.position.y=1.06;const dome=this.mesh(g,new T.SphereGeometry(.3,40,16,0,TAU,0,Math.PI/2),this.chrome);dome.position.y=1.09;dome.scale.y=.35;}
  else if(style===4){for(let i=0;i<4;i++){const a=i*TAU/4+TAU/8,end=arm(a,.5,1.105,.85);const disc=at(a,end,1.105,this.mesh(g,new T.CylinderGeometry(.075,.075,.025,28),this.chrome));disc.rotation.z=Math.PI/2;disc.rotation.y=-a;}
   if(!this.medallion){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!,gold=ctx.createLinearGradient(0,0,0,512);gold.addColorStop(0,'#fff0c0');gold.addColorStop(.5,'#d9ad52');gold.addColorStop(1,'#9c7127');
    ctx.fillStyle='#1a0f08';ctx.beginPath();ctx.arc(256,256,250,0,TAU);ctx.fill();ctx.strokeStyle=gold;ctx.lineWidth=14;ctx.beginPath();ctx.arc(256,256,236,0,TAU);ctx.stroke();ctx.lineWidth=5;ctx.beginPath();ctx.arc(256,256,212,0,TAU);ctx.stroke();
    ctx.fillStyle=gold;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 150px Georgia, serif';ctx.fillText('CC',256,236);ctx.font='700 46px Georgia, serif';ctx.fillText('CITY CAFE',256,350);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;this.medallion=new T.MeshStandardMaterial({map:tex,metalness:.6,roughness:.35});}
   const coin=new T.Mesh(new T.CylinderGeometry(.24,.24,.03,48),[this.chrome,this.medallion,this.chrome]);coin.castShadow=true;coin.position.y=1.63;coin.name='coin';g.add(coin);
  }
  else for(let i=0;i<4;i++){const a=i*TAU/4,end=arm(a,.67,1.105);at(a,end,1.105,this.mesh(g,new T.SphereGeometry(.060,20,14),this.chrome));}
 }
 private mesh(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,cast=true,receive=true){const mesh=new T.Mesh(geometry,material);mesh.castShadow=cast;mesh.receiveShadow=receive;parent.add(mesh);return mesh;}
 private lathe(parent:T.Group,profile:number[][],material:T.Material){return this.mesh(parent,new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),128),material);}
 private ring(parent:T.Group,r:number,y:number,t:number,material:T.Material){const mesh=this.mesh(parent,new T.TorusGeometry(r,t,8,128),material);mesh.rotation.x=Math.PI/2;mesh.position.y=y;return mesh;}
 private sector(parent:T.Group,inner:number,outer:number,a:number,height:(r:number)=>number,material:T.Material){
  const vertices:number[]=[];for(let j=0;j<8;j++){const x=a-STEP/2+.003+j*(STEP-.006)/8,z=x+(STEP-.006)/8;for(const [r,t] of [[inner,x],[outer,z],[outer,x],[inner,x],[inner,z],[outer,z]])vertices.push(Math.sin(t)*r,height(r),-Math.cos(t)*r);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return this.mesh(parent,geometry,material,false,true);
 }
 /**
  * Holztextur mit einstellbarer Maserung (0 = glatt, 0,5 = bisheriges Bild, 1 = kräftige Fasern,
  * Jahresringe und vereinzelte Äste). Feste Zufallsfolge, damit sich das Holz beim Verstellen nicht
  * „neu würfelt“, sondern nur deutlicher oder schwächer wird.
  */
 private woodTexture(strength=.5,species=0){
  // Holzarten: Grundton, helle und dunkle Faser (0 Mahagoni = bisheriges Holz)
  const [base,light,dark]=[['#71321b','239,154,67','29,8,4'],['#4a2f1f','196,140,88','18,10,5'],['#8a3f22','246,170,110','40,12,6'],['#1f1714','120,92,70','6,4,3'],['#b8875a','250,214,160','90,56,28']][species]??['#71321b','239,154,67','29,8,4'];
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;const ctx=canvas.getContext('2d')!;ctx.fillStyle=base;ctx.fillRect(0,0,2048,512);
  const k=Math.min(2,strength*2),extra=Math.max(0,strength*2-1);let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<1600;i++){ctx.strokeStyle=`rgba(${i%3===0?light:dark},${Math.min(1,(.07+(i%7)*.025)*k)})`;ctx.lineWidth=.3+i%4*.35;ctx.beginPath();for(let x=0;x<=2048;x+=8){const y=i/1600*512+8*Math.sin(x*.004+i*.045)+3*Math.sin(x*.016+i*.17);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
  if(extra>0){
   // Jahresringe: breite, dunkle, weich geschwungene Bänder
   for(let i=0;i<46;i++){const y0=rnd()*512,amp=6+rnd()*18,f=.0015+rnd()*.003,ph=rnd()*6;ctx.strokeStyle=`rgba(${dark},${(.12+rnd()*.18)*extra})`;ctx.lineWidth=1.5+rnd()*4;ctx.beginPath();for(let x=0;x<=2048;x+=8){const y=y0+amp*Math.sin(x*f+ph)+4*Math.sin(x*.011+i);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
   // Poren: feine, kurze helle und dunkle Striche
   for(let i=0;i<2600;i++){const x=rnd()*2048,y=rnd()*512,l=4+rnd()*14;ctx.strokeStyle=rnd()<.5?`rgba(${dark},${.25*extra})`:`rgba(${light},${.12*extra})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+l,y+(rnd()-.5)*1.5);ctx.stroke();}
   // Äste: wenige dunkle Augen mit Ringen
   for(let i=0;i<5;i++){const x=rnd()*2048,y=rnd()*512;for(let r=0;r<6;r++){ctx.strokeStyle=`rgba(${dark},${(.35-r*.05)*extra})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(x,y,10+r*9,3+r*3,0,0,Math.PI*2);ctx.stroke();}}
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,1);texture.anisotropy=8;return texture;
 }
 private woodCache=new Map<string,T.CanvasTexture>();
 /** Holz für Außenrand, Laufbahn und Innenkessel setzen; Texturen je Holzart/Maserung nur einmal zeichnen. */
 private setWood(outer:number,track:number,inner:number,grainTrack:number,grainInner:number){
  const want=new Map<T.MeshPhysicalMaterial,string>([[this.wood,`${outer}/0.5`],[this.track,`${track}/${Math.round(grainTrack*20)/20}`],[this.inner,`${inner}/${Math.round(grainInner*20)/20}`]]);
  for(const [mat,key] of want){let tex=this.woodCache.get(key);if(!tex){const [sp,g]=key.split('/').map(Number);tex=this.woodTexture(g,sp);this.woodCache.set(key,tex);}if(mat.map!==tex){mat.map=tex;mat.needsUpdate=true;}}
  const used=new Set(want.values());for(const [key,tex] of this.woodCache)if(!used.has(key)){tex.dispose();this.woodCache.delete(key);}
 }
 private numberCanvas:HTMLCanvasElement|null=null;private numbersGold:boolean|null=null;
 /** Zahlen auf dem Kranz: Elfenbein (Standard) oder Gold. */
 private drawNumbers(gold:boolean){
  if(this.numbersGold===gold||!this.numberCanvas)return;this.numbersGold=gold;const ctx=this.numberCanvas.getContext('2d')!;ctx.clearRect(0,0,2048,2048);
  ctx.font='700 230px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;
  ORDER.forEach((n,i)=>{const x=i%8*256,y=Math.floor(i/8)*320;let fill:string|CanvasGradient='#fff5db';if(gold){const g=ctx.createLinearGradient(0,y+60,0,y+280);g.addColorStop(0,'#fff0c0');g.addColorStop(.5,'#e2b454');g.addColorStop(1,'#b8862e');fill=g;}ctx.strokeStyle='#1b100c';ctx.strokeText(String(n),x+128,y+168,236);ctx.fillStyle=fill;ctx.fillText(String(n),x+128,y+168,236);});
  if(this.labels.map)this.labels.map.needsUpdate=true;
 }
 /** Feststehende Goldschrift auf der Innenfläche (r 0,43–1,525): Schriftring und optional Emblem um die Nabe. */
private letteringCanvas:HTMLCanvasElement|null=null;private letteringKey='';
 private static readonly FONTS=['Georgia, "Times New Roman", serif','"Playfair Display", Georgia, serif','Cinzel, Georgia, serif','"Cormorant Garamond", Georgia, serif','"Bodoni Moda", Georgia, serif','"Great Vibes", cursive','Limelight, Georgia, serif','Italiana, Georgia, serif','"Abril Fatface", Georgia, serif','"Cinzel Decorative", Georgia, serif'];
 /** Innenkessel als Werbetafel: vorne und hinten je zwei Textzeilen, jede Seite mit eigener Schriftart, Stärke, Größe, Abstand, Effekt und Kontur. */
 private drawLettering(logo:boolean,d:DesignSettings){
  const key=JSON.stringify([logo,d.frontText,d.frontText2,d.backText,d.backText2,d.textFont,d.textWeight,d.textSize,d.textSpacing,d.textEffect,d.textOutline,d.backFont,d.backWeight,d.backSize,d.backSpacing,d.backEffect,d.backOutline,d.text2Font,d.text2Weight,d.text2Size,d.text2Spacing,d.text2Effect,d.text2Outline,d.back2Font,d.back2Weight,d.back2Size,d.back2Spacing,d.back2Effect,d.back2Outline,d.textColor,d.text2Color,d.backColor,d.back2Color]);
  if(this.letteringKey===key&&this.letteringCanvas)return;this.letteringKey=key;
  const F=WheelModel.FONTS;
  // Webschriften nachladen; danach einmal neu zeichnen (sonst bleibt die Ersatzschrift stehen).
  for(const [f,w] of [[d.textFont,d.textWeight],[d.backFont,d.backWeight],[d.text2Font,d.text2Weight],[d.back2Font,d.back2Weight]]){const probe=`${w} 40px ${F[f]??F[0]}`;try{if(!document.fonts.check(probe)){void document.fonts.load(probe).then(()=>{if(this.letteringKey===key){this.letteringKey='';this.drawLettering(logo,d);}});}}catch{}}
  const c=this.letteringCanvas??=document.createElement('canvas');c.width=c.height=2048;const ctx=c.getContext('2d')!,m=1024,u=1024/1.525;ctx.clearRect(0,0,2048,2048);
  const TINTS=[['#ffffff','#d6d6d6'],['#ff8a8a','#a31424'],['#8ff0a4','#1f8a45'],['#8fc4ff','#2a5fb8'],['#ffbf7a','#d1621b'],['#d3a8ff','#6b3bb0']];
  const goldFor=(eff:number,col=0)=>{const g=ctx.createLinearGradient(0,0,0,2048);
   if(col>0){const [a,b]=TINTS[col-1];g.addColorStop(0,a);g.addColorStop(.5,b);g.addColorStop(1,a);return g;}
   if(eff===3){g.addColorStop(0,'#fff6d4');g.addColorStop(.18,'#e9c46a');g.addColorStop(.32,'#fff1bd');g.addColorStop(.5,'#9c6f22');g.addColorStop(.62,'#f1d484');g.addColorStop(.8,'#b98a36');g.addColorStop(1,'#fdeeb8');}
   else if(eff===2){g.addColorStop(0,'#5a3a17');g.addColorStop(1,'#2b1a0a');}
   else if(eff===6){g.addColorStop(0,'#ffffff');g.addColorStop(.4,'#cfd6dc');g.addColorStop(.55,'#8b959c');g.addColorStop(1,'#f4f7f9');}
   else if(eff===7){g.addColorStop(0,'#ffd9b8');g.addColorStop(.45,'#d9895a');g.addColorStop(.55,'#9c5530');g.addColorStop(1,'#f0b48c');}
   else if(eff===8){g.addColorStop(0,'#ff8a92');g.addColorStop(.5,'#c4232f');g.addColorStop(1,'#8f1421');}
   else if(eff===9){g.addColorStop(0,'#ffffff');g.addColorStop(1,'#e8f2ff');}
   else if(eff===5){g.addColorStop(0,'#fffaf0');g.addColorStop(.5,'#eadfc4');g.addColorStop(1,'#fffaf0');}
   else{g.addColorStop(0,'#fbecc0');g.addColorStop(.45,'#d9ad52');g.addColorStop(.55,'#a97c2e');g.addColorStop(1,'#f6e0a4');}
   return g;};
  // Stil der Seite, die gerade gezeichnet wird.
  let family=F[d.textFont]??F[0],weight=d.textWeight,size=d.textSize,spacing=d.textSpacing,eff=d.textEffect,outline=d.textOutline,gold=goldFor(eff);
  const use=(side:'front'|'back',line:1|2=1)=>{const p=(side==='back'?'back':'text')+(line===2?'2':''),v=d as unknown as Record<string,number>;family=F[v[p+'Font']]??F[0];weight=v[p+'Weight'];size=v[p+'Size'];spacing=v[p+'Spacing'];eff=v[p+'Effect'];outline=v[p+'Outline'];gold=goldFor(eff,v[p+'Color']);
   ctx.fillStyle=gold;ctx.strokeStyle=gold;ctx.shadowColor='rgba(20,10,0,.55)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;};
  ctx.textBaseline='middle';ctx.textAlign='center';use('front');
  // Ein Buchstabe mit dem gewählten Effekt; (0,0) liegt schon an der richtigen Stelle im gedrehten System.
  const glyph=(ch:string,px:number)=>{
   const k=px/100;ctx.lineJoin='round';
   const edge=(w:number,col:string)=>{if(outline<=0)return;ctx.shadowColor='transparent';ctx.lineWidth=Math.max(1.5,w*outline);ctx.strokeStyle=col;ctx.strokeText(ch,0,0);};
   if(eff===1){ // geprägt: Licht oben links, Schatten unten rechts
    ctx.shadowColor='transparent';ctx.fillStyle='rgba(20,8,0,.75)';ctx.fillText(ch,3.2*k,3.6*k);ctx.fillStyle='rgba(255,244,205,.85)';ctx.fillText(ch,-2.2*k,-2.4*k);
    edge(px*.05,'rgba(28,12,4,.55)');ctx.fillStyle=gold;ctx.shadowColor='rgba(20,10,0,.4)';ctx.shadowBlur=4;ctx.fillText(ch,0,0);
   }else if(eff===2){ // eingraviert: heller Rand unten, dunkle Kerbe
    ctx.shadowColor='transparent';ctx.fillStyle='rgba(255,226,160,.7)';ctx.fillText(ch,1.8*k,2.2*k);ctx.fillStyle=gold;ctx.fillText(ch,0,0);edge(px*.02,'rgba(0,0,0,.6)');
   }else if(eff===4||eff===9){ // leuchtend (gold / weiß)
    ctx.shadowColor=eff===9?'rgba(210,235,255,.95)':'rgba(255,205,110,.95)';ctx.shadowBlur=34*k;ctx.fillStyle=gold;ctx.fillText(ch,0,0);ctx.fillText(ch,0,0);ctx.shadowBlur=10*k;edge(px*.03,'rgba(30,14,4,.5)');ctx.fillStyle=gold;ctx.fillText(ch,0,0);
   }else if(eff===3){ // glanzgold: dunkle Kante, helle Innenlinie
    edge(px*.06,'rgba(30,14,4,.7)');ctx.shadowColor='rgba(20,10,0,.5)';ctx.shadowBlur=6;ctx.fillStyle=gold;ctx.fillText(ch,0,0);ctx.shadowColor='transparent';ctx.lineWidth=Math.max(1,px*.012);ctx.strokeStyle='rgba(255,250,225,.75)';ctx.strokeText(ch,0,0);
   }else{ // 0 klassisch, 5 elfenbein
    edge(px*.07,'rgba(28,12,4,.6)');ctx.shadowColor='rgba(20,10,0,.55)';ctx.shadowBlur=8;ctx.fillStyle=gold;ctx.fillText(ch,0,0);
   }
   ctx.shadowColor='rgba(20,10,0,.55)';ctx.shadowBlur=8;ctx.fillStyle=gold;ctx.strokeStyle=gold;
  };
  // Text auf einem Bogen: oben mit Buchstaben nach außen, unten nach innen – beide lesbar.
  // stretch: Buchstaben in Richtung Mitte höher ziehen (Breite ist durch den Umfang begrenzt, Höhe nicht).
  const arc=(text:string,radius:number,px:number,step:number,bottom:boolean,stretch=1)=>{ctx.font=`${weight} ${px}px ${family}`;const chars=[...text];let a=-step*(chars.length-1)/2;for(const ch of chars){ctx.save();ctx.translate(m+Math.sin(a)*radius,bottom?m+Math.cos(a)*radius:m-Math.cos(a)*radius);ctx.rotate(bottom?-a:a);ctx.scale(1,stretch);glyph(ch,px);ctx.restore();a+=step;}};
  // Lange Texte werden enger und kleiner gesetzt.
  // Jeder Buchstabe bekommt seine echte Breite plus gleichmäßigen Abstand (vorher fester Winkel je Buchstabe: breite Buchstaben stießen aneinander).
  // Wird der Text länger als der Halbkreis, schrumpft die ganze Zeile.
  const ring=1.275*u,fitArc=(text:string,bottom:boolean,radius=ring,scale=1)=>{
   const chars=[...text],n=chars.length;if(!n)return;
   let px=Math.round(Math.min(160,.13*radius*1.22)*size*scale);
   const measure=(p:number)=>{ctx.font=`${weight} ${p}px ${family}`;const w=chars.map(c=>ctx.measureText(c).width),gap=p*.16*spacing;return {w,gap,len:w.reduce((x,y)=>x+y,0)+gap*(n-1)};};
   let s=measure(px);const maxLen=(Math.PI-.34)*radius;if(s.len>maxLen){px=Math.floor(px*maxLen/s.len);s=measure(px);}
   const stretch=Math.min(bottom?1.55:1.3,190*scale/px);let a=-s.len/2/radius;
   chars.forEach((ch,i)=>{const mid=a+s.w[i]/2/radius;a+=(s.w[i]+s.gap)/radius;ctx.save();ctx.translate(m+Math.sin(mid)*radius,bottom?m+Math.cos(mid)*radius:m-Math.cos(mid)*radius);ctx.rotate(bottom?-mid:mid);ctx.scale(1,stretch);glyph(ch,px);ctx.restore();});};
  // Eine Zeile liegt auf dem Hauptring; mit zwei Zeilen teilen sich beide den freien Ring: die erste weiter außen und etwas kleiner,
  // die zweite näher zur Kesselmitte – ohne das Emblem zu berühren.
  // Ohne Emblem ist der Innenring frei: beide Zeilen größer und mit mehr Abstand.
  const lines=(side:'front'|'back',a:string,b:string,bottom:boolean)=>{
   const one=(t:string,l:1|2,radius:number,scale:number)=>{use(side,l);fitArc(t,bottom,radius,scale);};
   if(a&&b){
    // Rückseite liegt oben, also am weit entfernten Rand: perspektivisch gestaucht, stößt schnell an den Zahlenkranz und an die Speichen des Mittelkreuzes.
    // Deshalb dort kleiner, weiter zur Kesselmitte und mit begrenzter Streckung.
    if(!bottom){one(a,1,1.3*u,.8);one(b,2,1.09*u,.72);}
    else if(logo){one(a,1,1.375*u,.88);one(b,2,1.11*u,.8);}else{one(a,1,1.41*u,1);one(b,2,.97*u,.95);}
   }else if(a)one(a,1,bottom?ring:1.24*u,bottom?1:.9);else if(b)one(b,2,bottom?ring:1.24*u,bottom?1:.9);};
  lines('back',d.backText,d.backText2,false);
  lines('front',d.frontText,d.frontText2,true);use('front');
  const star=(rad:number,px:number)=>{for(const a of [Math.PI/2,-Math.PI/2]){ctx.save();ctx.translate(m+Math.sin(a)*rad,m);ctx.font=`700 ${px}px Georgia, serif`;glyph('✦',px);ctx.restore();}};
  star(ring,110);
  if(logo){
   ctx.lineWidth=12;for(const r of [.977,.95,.8,.775]){ctx.beginPath();ctx.arc(m,m,r*u,0,Math.PI*2);ctx.stroke();}
   arc('CITY CAFE',.875*u,Math.round(82*size),.1*spacing,false);arc('FISCHL',.875*u,Math.round(82*size),.1*spacing,true);
   star(.875*u,64);
  }
  if(this.gold.map)this.gold.map.needsUpdate=true;
 }
 private lettering(parent:T.Group){
  const g=new T.RingGeometry(.43,1.525,160,10),p=g.getAttribute('position'),lift=.2/MM_PER_UNIT;
  const pts=[[1.525,.345],[1.36,.447],[1.02,.653],[.62,.804],[.40,.839]];
  const h=(r:number)=>{for(let i=1;i<pts.length;i++){const [r0,y0]=pts[i-1],[r1,y1]=pts[i];if(r<=r0&&r>=r1)return y0+(r-r0)*(y1-y0)/(r1-r0);}return r>1.525?.345:.839;};
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setXYZ(i,x,h(Math.hypot(x,y))+lift,-y);}
  g.computeVertexNormals();const mesh=this.mesh(parent,g,this.gold);mesh.castShadow=false;
 }
 private glow:T.Mesh|null=null;private depth=1;
 /** Gewinnfach hervorheben (Index in ORDER) oder mit null ausblenden. */
 highlightPocket(index:number|null){
  if(!this.glow){const mat=new T.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});this.glow=new T.Mesh(new T.RingGeometry(0,.2,40),mat);this.glow.rotation.x=-Math.PI/2;this.glow.renderOrder=5;}
  if(index===null){this.glow.visible=false;return;}
  const a=index*STEP;this.glow.position.set(Math.sin(a)*1.785,FLOOR*this.depth+.006,-Math.cos(a)*1.785);this.glow.visible=true;if(this.glow.parent!==this.turning)this.turning.add(this.glow);
 }
 /** Leuchten pulsieren lassen (t in Sekunden seit der Landung). */
 glowPulse(t:number){if(!this.glow?.visible)return;const m=this.glow.material as T.MeshBasicMaterial;m.opacity=t<8?(.75+.25*Math.sin(t*5))*Math.min(1,t*3):Math.max(0,.75*(1-(t-8)/2));if(t>10)this.glow.visible=false;}
}
