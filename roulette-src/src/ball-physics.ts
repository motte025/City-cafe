/**
 * Schlanke, deterministische Kugelsimulation.
 *
 * Kollisionsgeometrie = sichtbare Geometrie: Kesselprofil und Wulstringe als
 * Rotationsflächen (Querschnitte aus wheel-model.ts), die acht Rauten exakt wie
 * deflectorGeometry, die 37 Stege als Prismen mit den Maßen der ExtrudeGeometry
 * (inklusive Fase). Alles wird wie im Modell mit bowlDepth in der Höhe skaliert.
 * Rotorteile drehen mit rotorState(). Die Kugel ist eine Vollkugel mit Drall;
 * Stöße mit Restitution und Coulomb-Reibung, dazu Roll- und Luftwiderstand.
 */
import {BALL_PHYSICS,G_EARTH,MM_PER_UNIT,deflectorMaterial,type MaterialName} from './ball-config';
import {FLOOR,numberHeight,trackHeight,type WheelShape} from './wheel-shape';
import {STEP,TAU,rotorState,type Motion} from './game';

export const K_TRACK=0,K_DEFLECTOR=1,K_RING=2,K_DIVIDER=3,K_POCKET=4;
const MATERIALS:MaterialName[]=['track','rail','cone','deflectorRadial','deflectorTangential','ring','divider','wall','pocket'];
const M_TRACK=0,M_RAIL=1,M_CONE=2,M_DEFLECTOR=3,M_DEFLECTOR_TAN=4,M_RING=5,M_DIVIDER=6,M_WALL=7,M_POCKET=8;

export interface BallParams {diameter:number;mass:number;bounce:number}
/** Rauten-Widerstand je Ausrichtung (0–100 %, per Fernbedienung); k gerade = radial, k ungerade = tangential. */
export interface DeflectorResistance {radial:number;tangential:number}
/**
 * VORLÄUFIG, zur Entscheidung beim Betreiber: Drei sichtbare Zierringe stehen
 * 1,7–2,7 mm über den Flächen, über die die Kugel rollen muss, und bilden Mulden,
 * in denen eine langsame Kugel physikalisch für immer liegen bleibt:
 *  - r = 2,93 Innenkante der Laufbahn (die Kugel verließe die Bahn nie),
 *  - r = 2,47 Unterkante des Konus (Kugel kreist auf der Konuskante),
 *  - r = 2,025 Rand des Taschenkranzes am Rotor (Kugel kreist auf dem Zahlenkranz).
 * Schon 0,8 mm Überstand halten eine 21-mm-Kugel auf 21° Gefälle fest.
 * In der Kollisionsrechnung liegen sie deshalb bündig (entfallen); das sichtbare
 * Modell ist unverändert. Empfehlung: die drei Ringe im Modell bündig absenken.
 */
export const FLUSH_BEADS=[2.93,2.47,2.025];
export const ballRadiusOf=(diameter:number)=>diameter/MM_PER_UNIT/2;

/** Querschnitt einer Rotationsfläche: Strecken [r0,y0,r1,y1,rMin,rMax,yMin,yMax,mat,kind] und Wülste [r,y,a,b,mat,kind]. */
interface Profile {seg:Float64Array;tor:Float64Array}
export interface Colliders {
 shape:WheelShape;
 stator:Profile;rotor:Profile;
 /** je Raute 12 Dreiecke à 9 Zahlen */
 deflectorTris:Float64Array[];
 /** je Raute Mittelpunkt und Hüllradius */
 deflectorBounds:Float64Array;
 /** Rohdaten der Rauten (4 Ecken + Spitze, Welt) für Tests */
 deflectorPoints:number[][][];
 /** Steg: Trapez nach der Fase (Halbbreite unten/oben, Höhe unten/oben), Mitte und halbe Länge radial */
 divider:{hwB:number;yB:number;hwT:number;yT:number;rc:number;half:number};
}

/** Parallel versetzte Trapezkante wie ExtrudeGeometry (bevelSize, Gehrung). */
function offsetTrapezoid(hwB:number,yB:number,hwT:number,yT:number,d:number){
 const sx=hwT-hwB,sy=yT-yB,len=Math.hypot(sx,sy),nx=sy/len,ny=-sx/len;
 const ox=hwB+nx*d,oy=yB+ny*d;
 const at=(y:number)=>ox+sx*(y-oy)/sy;
 return {hwB:at(yB-d),yB:yB-d,hwT:at(yT+d),yT:yT+d};
}

export function buildColliders(shape:WheelShape):Colliders{
 const bd=shape.bowlDepth,nh=(r:number)=>numberHeight(r,shape),n25=nh(2.425);
 const profile=(segs:number[][],tori:number[][]):Profile=>{
  const seg=new Float64Array(segs.length*10),tor=new Float64Array(tori.length*6);
  segs.forEach(([r0,y0,r1,y1,mat,kind],i)=>{const a=[r0,y0*bd,r1,y1*bd];seg.set([...a,Math.min(r0,r1),Math.max(r0,r1),Math.min(a[1],a[3]),Math.max(a[1],a[3]),mat,kind],i*10);});
  // TorusGeometry(…, 8, 128) mit Höhenskalierung: Ellipse mit Halbachsen t und t·bowlDepth (umschrieben).
  tori.forEach(([r,y,t,mat,kind],i)=>tor.set([r,y*bd,t,t*bd,mat,kind],i*6));
  return {seg,tor};
 };
 // Fester Kessel (wheel-model: Laufbahn-Drehteil, Holzrand, Ringe aus rimProfile)
 const stator=profile([
  [2.455,.425,2.49,.44,M_CONE,K_TRACK],[2.49,.44,2.7,.60,M_CONE,K_TRACK],[2.7,.60,2.9,.75,M_CONE,K_TRACK],
  [2.9,.75,3.05,.80,M_TRACK,K_TRACK],[3.03,.80,3.035,.91,M_RAIL,K_TRACK],[3.035,.91,3.13,1.025,M_RAIL,K_TRACK],
 ],[[3.02,.795,.018,M_RAIL,K_TRACK],[3.115,.998,.027,M_RAIL,K_TRACK]]);
 // Rotor (Zahlenkranz-Sektoren, Ebenholz-Drehteil, Taschenboden, hintere Lippe, Innenkessel, Ringe)
 const rotor=profile([
  [2.425,n25,2.44,n25,M_RING,K_RING],[2.04,nh(2.04),2.425,n25,M_RING,K_RING],
  [2.04,.229,1.985,FLOOR-.006,M_WALL,K_POCKET],[1.976,FLOOR+.013,1.993,FLOOR+.013,M_POCKET,K_POCKET],
  [1.585,FLOOR,1.985,FLOOR,M_POCKET,K_POCKET],[1.585,FLOOR-.006,1.53,.34,M_WALL,K_POCKET],
  [1.525,.345,1.36,.447,M_RING,K_RING],[1.36,.447,1.02,.653,M_RING,K_RING],
 ],[[2.442,n25+.004,.015,M_RING,K_RING],[1.555,.315,.018,M_RING,K_RING],[1.53,.348,.016,M_RING,K_RING]]);
 // Rauten exakt wie deflectorGeometry(), danach wie die Gruppe in der Höhe skaliert
 const deflectorTris:Float64Array[]=[],bounds=new Float64Array(32),points:number[][][]=[];
 for(let index=0;index<8;index++){
  const a=(index+.5)*TAU/8,rotation=index%2?Math.PI/2:0;
  const corners=[[0,-.13],[.078,0],[0,.13],[-.078,0]].map(([x,z])=>{
   const tangent=x*Math.cos(rotation)-z*Math.sin(rotation),radial=x*Math.sin(rotation)+z*Math.cos(rotation);
   const r=2.74+radial,wx=Math.sin(a)*r+Math.cos(a)*tangent,wz=-Math.cos(a)*r+Math.sin(a)*tangent;
   return [wx,(trackHeight(Math.hypot(wx,wz))+.006)*bd,wz];
  });
  const apex=[Math.sin(a)*2.74,(trackHeight(2.74)+.092)*bd,-Math.cos(a)*2.74];
  points.push([...corners,apex]);
  const low=corners.map(([x,y,z])=>[x,y-.3,z]),tris:number[]=[];
  for(let i=0;i<4;i++){const j=(i+1)%4;tris.push(...corners[i],...corners[j],...apex,...corners[i],...low[j],...corners[j],...corners[i],...low[i],...low[j]);}
  deflectorTris.push(new Float64Array(tris));
  // Hülle nur über die sichtbaren Punkte: die abgesenkten Hilfsecken liegen unter dem Konus.
  const top=[...corners,apex],cx=top.reduce((s,p)=>s+p[0],0)/5,cy=top.reduce((s,p)=>s+p[1],0)/5,cz=top.reduce((s,p)=>s+p[2],0)/5;
  const rad=Math.max(...top.map(p=>Math.hypot(p[0]-cx,p[1]-cy,p[2]-cz)));
  bounds.set([cx,cy,cz,rad],index*4);
 }
 // Steg: Querschnitt (±.015 unten, ±.009 oben, 0,158 hoch ab FLOOR+.008), Fase .004, radial 1,785 ± .199
 const t=offsetTrapezoid(.015,FLOOR+.008,.009,FLOOR+.008+.158,.004);
 return {shape:{...shape},stator,rotor,deflectorTris,deflectorBounds:bounds,deflectorPoints:points,
  divider:{hwB:t.hwB,yB:t.yB*bd,hwT:t.hwT,yT:t.yT*bd,rc:1.785,half:.199+.004}};
}

/** Nächster Punkt einer Ellipse (Halbachsen a in r, b in y) zu (dr,dy) relativ zur Mitte. */
function ellipsePoint(dr:number,dy:number,a:number,b:number,out:Float64Array){
 let phi=Math.atan2(a*dy,b*dr);
 if(Math.abs(a-b)>1e-12)for(let i=0;i<4;i++){
  const c=Math.cos(phi),s=Math.sin(phi),f=(b*b-a*a)*s*c+a*dr*s-b*dy*c,fp=(b*b-a*a)*(c*c-s*s)+a*dr*c+b*dy*s;
  if(Math.abs(fp)<1e-14)break;phi-=f/fp;
 }
 out[0]=a*Math.cos(phi);out[1]=b*Math.sin(phi);
}

/** Abstand Punkt → Dreieck (Ericson), schreibt den nächsten Punkt nach out. */
function closestOnTriangle(px:number,py:number,pz:number,t:Float64Array,o:number,out:Float64Array){
 const ax=t[o],ay=t[o+1],az=t[o+2],bx=t[o+3],by=t[o+4],bz=t[o+5],cx=t[o+6],cy=t[o+7],cz=t[o+8];
 const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=px-ax,apy=py-ay,apz=pz-az;
 const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
 if(d1<=0&&d2<=0){out[0]=ax;out[1]=ay;out[2]=az;return;}
 const bpx=px-bx,bpy=py-by,bpz=pz-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
 if(d3>=0&&d4<=d3){out[0]=bx;out[1]=by;out[2]=bz;return;}
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);out[0]=ax+v*abx;out[1]=ay+v*aby;out[2]=az+v*abz;return;}
 const cpx=px-cx,cpy=py-cy,cpz=pz-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
 if(d6>=0&&d5<=d6){out[0]=cx;out[1]=cy;out[2]=cz;return;}
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);out[0]=ax+w*acx;out[1]=ay+w*acy;out[2]=az+w*acz;return;}
 const va=d3*d6-d5*d4;
 if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));out[0]=bx+w*(cx-bx);out[1]=by+w*(cy-by);out[2]=bz+w*(cz-bz);return;}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;out[0]=ax+abx*v+acx*w;out[1]=ay+aby*v+acy*w;out[2]=az+abz*v+acz*w;
}

export interface SimSetup {colliders:Colliders;ball:BallParams;direction:1|-1;startSpeed:number;rotorStart:number;rotor:boolean;deflectors:boolean;gravityFactor?:number;deflectorResistance?:DeflectorResistance}
export type ContactListener=(kind:number,index:number,impact:number,x:number,y:number,z:number)=>void;

const MAX_CONTACTS=10;
export class BallSim {
 px=0;py=0;pz=0;vx=0;vy=0;vz=0;wx=0;wy=0;wz=0;t=0;seed=1;
 rotorAngle=0;rotorSpeed=0;
 onContact:ContactListener|null=null;
 readonly R:number;readonly g:number;readonly kAir:number;readonly dt=BALL_PHYSICS.dt;
 readonly col:Colliders;
 private readonly mat:Float64Array;
 private readonly motion:Motion;private readonly rotorStart:number;
 private readonly useRotor:boolean;private readonly useDeflectors:boolean;
 private cn=0;
 private readonly cX=new Float64Array(MAX_CONTACTS);private readonly cY=new Float64Array(MAX_CONTACTS);private readonly cZ=new Float64Array(MAX_CONTACTS);
 private readonly cD=new Float64Array(MAX_CONTACTS);private readonly cM=new Int32Array(MAX_CONTACTS);private readonly cK=new Int32Array(MAX_CONTACTS);
 private readonly cI=new Int32Array(MAX_CONTACTS);private readonly cRot=new Uint8Array(MAX_CONTACTS);
 private readonly tmp=new Float64Array(3);
 // Arbeitsfelder des Lösers
 private readonly jN=new Float64Array(MAX_CONTACTS);private readonly tgt=new Float64Array(MAX_CONTACTS);
 private readonly jX=new Float64Array(MAX_CONTACTS);private readonly jY=new Float64Array(MAX_CONTACTS);private readonly jZ=new Float64Array(MAX_CONTACTS);
 private readonly iX=new Float64Array(MAX_CONTACTS);private readonly iY=new Float64Array(MAX_CONTACTS);private readonly iZ=new Float64Array(MAX_CONTACTS);

 constructor(s:SimSetup){
  this.col=s.colliders;this.R=ballRadiusOf(s.ball.diameter);
  this.g=G_EARTH*(s.gravityFactor??BALL_PHYSICS.gravityFactor);
  const rm=this.R*MM_PER_UNIT/1000,kg=s.ball.mass/1000;
  this.kAir=.5*BALL_PHYSICS.airDensity*BALL_PHYSICS.dragCoefficient*Math.PI*rm*rm/kg*(MM_PER_UNIT/1000);
  const lively=Math.sqrt(Math.max(.05,s.ball.bounce))*Math.pow(8.7/s.ball.mass,BALL_PHYSICS.massLiveliness);
  this.mat=new Float64Array(MATERIALS.length*3);
  MATERIALS.forEach((name,i)=>{const m=BALL_PHYSICS.materials[name];this.mat.set([Math.min(BALL_PHYSICS.maxRestitution,m.e*lively),m.mu,m.roll],i*3);});
  // Rauten-Widerstand per Fernbedienung: ersetzt die Vorbelegung für Radial-/Tangential-Rauten.
  if(s.deflectorResistance){
   const dr=deflectorMaterial(s.deflectorResistance.radial),dt=deflectorMaterial(s.deflectorResistance.tangential);
   this.mat.set([Math.min(BALL_PHYSICS.maxRestitution,dr.e*lively),dr.mu,dr.roll],M_DEFLECTOR*3);
   this.mat.set([Math.min(BALL_PHYSICS.maxRestitution,dt.e*lively),dt.mu,dt.roll],M_DEFLECTOR_TAN*3);
  }
  this.motion={direction:s.direction,startSpeed:s.startSpeed} as Motion;this.rotorStart=s.rotorStart;
  this.useRotor=s.rotor;this.useDeflectors=s.deflectors;
  this.updateRotor();
 }
 rand(){let t=(this.seed=(this.seed+0x6D2B79F5)|0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
 state(){return new Float64Array([this.px,this.py,this.pz,this.vx,this.vy,this.vz,this.wx,this.wy,this.wz,this.t,this.seed]);}
 setState(a:ArrayLike<number>){[this.px,this.py,this.pz,this.vx,this.vy,this.vz,this.wx,this.wy,this.wz,this.t]=[a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8],a[9]];this.seed=a[10]|0;this.updateRotor();}
 private rotorFresh=false;
 private updateRotor(){if(this.useRotor){const s=rotorState(this.motion,this.t);this.rotorAngle=this.rotorStart+s.angle;this.rotorSpeed=s.speed;this.rotorFresh=true;}}
 /** Rotorlage zur aktuellen Zeit sicherstellen (wird in der Laufbahn nicht jeden Schritt gebraucht). */
 syncRotor(){if(!this.rotorFresh)this.updateRotor();}
 /** Winkel der Kugel relativ zum Rotor (rad). */
 localAngle(){this.syncRotor();return Math.atan2(this.px,-this.pz)-this.rotorAngle;}

 step(){
  const dt=this.dt,sp=Math.sqrt(this.vx*this.vx+this.vy*this.vy+this.vz*this.vz),damp=1/(1+this.kAir*sp*dt);
  this.vx*=damp;this.vy=this.vy*damp-this.g*dt;this.vz*=damp;
  this.px+=this.vx*dt;this.py+=this.vy*dt;this.pz+=this.vz*dt;this.t+=dt;
  this.cn=0;
  const r=Math.sqrt(this.px*this.px+this.pz*this.pz);
  if(this.useRotor&&r<2.62)this.updateRotor();else this.rotorFresh=false;
  if(r>2.3)this.profileContacts(this.col.stator,r,false);
  if(this.useDeflectors&&r>2.45&&r<3.02)this.deflectorContact();
  if(this.useRotor&&r<2.62){this.profileContacts(this.col.rotor,r,true);if(r>1.45&&r<2.12&&this.py<this.col.divider.yT+this.R+.01)this.dividerContacts();}
  if(this.cn)this.resolve();
 }

 private add(nx:number,ny:number,nz:number,depth:number,mat:number,kind:number,index:number,rot:boolean){
  for(let i=0;i<this.cn;i++)if(this.cX[i]*nx+this.cY[i]*ny+this.cZ[i]*nz>.9995){if(depth>this.cD[i]){this.cD[i]=depth;this.cM[i]=mat;this.cK[i]=kind;this.cI[i]=index;this.cRot[i]=rot?1:0;}return;}
  if(this.cn>=MAX_CONTACTS)return;const i=this.cn++;
  this.cX[i]=nx;this.cY[i]=ny;this.cZ[i]=nz;this.cD[i]=depth;this.cM[i]=mat;this.cK[i]=kind;this.cI[i]=index;this.cRot[i]=rot?1:0;
 }

 private profileContacts(p:Profile,r:number,rot:boolean){
  const R=this.R,y=this.py,ux=r>1e-9?this.px/r:1,uz=r>1e-9?this.pz/r:0,seg=p.seg,tor=p.tor,m=R+.002;
  for(let i=0;i<seg.length;i+=10){
   if(r<seg[i+4]-m||r>seg[i+5]+m||y<seg[i+6]-m||y>seg[i+7]+m)continue;
   const r0=seg[i],y0=seg[i+1],dr=seg[i+2]-r0,dy=seg[i+3]-y0;
   let u=((r-r0)*dr+(y-y0)*dy)/(dr*dr+dy*dy);u=u<0?0:u>1?1:u;
   const qr=r-(r0+u*dr),qy=y-(y0+u*dy),d=Math.sqrt(qr*qr+qy*qy);
   if(d<R&&d>1e-12)this.add(qr/d*ux,qy/d,qr/d*uz,R-d,seg[i+8],seg[i+9],-1,rot);
  }
  for(let i=0;i<tor.length;i+=6){
   const dr=r-tor[i],dy=y-tor[i+1];if(Math.abs(dr)>m+tor[i+2]||Math.abs(dy)>m+tor[i+3])continue;
   ellipsePoint(dr,dy,tor[i+2],tor[i+3],this.tmp);
   const qr=dr-this.tmp[0],qy=dy-this.tmp[1],d=Math.sqrt(qr*qr+qy*qy);
   if(d<R&&d>1e-12)this.add(qr/d*ux,qy/d,qr/d*uz,R-d,tor[i+4],tor[i+5],-1,rot);
  }
 }

 private deflectorContact(){
  const a=Math.atan2(this.px,-this.pz),k=((Math.floor(a/(TAU/8))%8)+8)%8,b=this.col.deflectorBounds,o=k*4,R=this.R;
  const dx=this.px-b[o],dy=this.py-b[o+1],dz=this.pz-b[o+2],lim=b[o+3]+R+.002;
  if(dx*dx+dy*dy+dz*dz>lim*lim)return;
  const tris=this.col.deflectorTris[k],q=this.tmp;let best=Infinity,bx=0,by=0,bz=0;
  for(let i=0;i<tris.length;i+=9){closestOnTriangle(this.px,this.py,this.pz,tris,i,q);const ex=this.px-q[0],ey=this.py-q[1],ez=this.pz-q[2],d2=ex*ex+ey*ey+ez*ez;if(d2<best){best=d2;bx=q[0];by=q[1];bz=q[2];}}
  const d=Math.sqrt(best);if(d>=R||d<1e-12)return;
  this.add((this.px-bx)/d,(this.py-by)/d,(this.pz-bz)/d,R-d,k%2?M_DEFLECTOR_TAN:M_DEFLECTOR,K_DEFLECTOR,k,false);
 }

 private dividerContacts(){
  const dv=this.col.divider,R=this.R,y=this.py,psi=Math.atan2(this.px,-this.pz)-this.rotorAngle,m0=Math.floor(psi/STEP-.5);
  for(let j=m0;j<=m0+1;j++){
   const phi=this.rotorAngle+(j+.5)*STEP,s=Math.sin(phi),c=Math.cos(phi);
   const rho=this.px*s-this.pz*c,tau=this.px*c+this.pz*s,at=Math.abs(tau);
   const rq=rho<dv.rc-dv.half?dv.rc-dv.half:rho>dv.rc+dv.half?dv.rc+dv.half:rho;
   // nächster Punkt im Querschnitt (rechte Hälfte, |tau|)
   let qx:number,qy:number;
   const inY=y>=dv.yB&&y<=dv.yT,hw=dv.hwB+(dv.hwT-dv.hwB)*((inY?y:y<dv.yB?dv.yB:dv.yT)-dv.yB)/(dv.yT-dv.yB);
   if(inY&&at<=hw){
    // Mittelpunkt im Querschnitt (nur möglich, wenn die Kugel radial vor/hinter dem Steg ist)
    if(rq===rho){const side=hw-at,top=dv.yT-y;if(side<top){this.add(tau<0?-c:c,0,tau<0?-s:s,R+side,M_DIVIDER,K_DIVIDER,j,true);}else this.add(0,1,0,R+top,M_DIVIDER,K_DIVIDER,j,true);continue;}
    qx=at;qy=y;
   }else{
    // Kanten: Seite (hwB,yB)-(hwT,yT), Deckfläche (hwT,yT)-(0,yT), Boden (0,yB)-(hwB,yB)
    const ex=dv.hwT-dv.hwB,ey=dv.yT-dv.yB;let u=((at-dv.hwB)*ex+(y-dv.yB)*ey)/(ex*ex+ey*ey);u=u<0?0:u>1?1:u;
    qx=dv.hwB+u*ex;qy=dv.yB+u*ey;let best=(at-qx)*(at-qx)+(y-qy)*(y-qy);
    const tx=at<0?0:at>dv.hwT?dv.hwT:at,dt2=(at-tx)*(at-tx)+(y-dv.yT)*(y-dv.yT);if(dt2<best){best=dt2;qx=tx;qy=dv.yT;}
    const bx=at<0?0:at>dv.hwB?dv.hwB:at,db2=(at-bx)*(at-bx)+(y-dv.yB)*(y-dv.yB);if(db2<best){qx=bx;qy=dv.yB;}
   }
   const ex=at-qx,ey=y-qy,er=rho-rq,d=Math.sqrt(ex*ex+ey*ey+er*er);
   if(d>=R||d<1e-12)continue;
   const nt=(tau<0?-ex:ex)/d,nr=er/d,ny=ey/d;
   this.add(nr*s+nt*c,ny,-nr*c+nt*s,R-d,M_DIVIDER,K_DIVIDER,j,true);
  }
 }

 private resolve(){
  const R=this.R,n=this.cn,mat=this.mat,rough=BALL_PHYSICS.roughness,rest=BALL_PHYSICS.restingSpeed,W=this.rotorSpeed;
  // 1) Herausschieben (nacheinander, bereits erfolgte Verschiebung wird angerechnet)
  let Dx=0,Dy=0,Dz=0;
  for(let k=0;k<n;k++){const pen=this.cD[k]-(Dx*this.cX[k]+Dy*this.cY[k]+Dz*this.cZ[k]);if(pen>0){this.px+=this.cX[k]*pen;this.py+=this.cY[k]*pen;this.pz+=this.cZ[k]*pen;Dx+=this.cX[k]*pen;Dy+=this.cY[k]*pen;Dz+=this.cZ[k]*pen;}}
  // 2) Soll-Normalgeschwindigkeit je Kontakt (Rückprall oder Aufliegen), Rauheit nur bei echten Stößen
  for(let k=0;k<n;k++){
   let nx=this.cX[k],ny=this.cY[k],nz=this.cZ[k];
   const cx=this.px-R*nx,cz=this.pz-R*nz,usx=this.cRot[k]?-W*cz:0,usz=this.cRot[k]?W*cx:0;
   const vcx=this.vx+(this.wy*(-R*nz)-this.wz*(-R*ny))-usx,vcy=this.vy+(this.wz*(-R*nx)-this.wx*(-R*nz)),vcz=this.vz+(this.wx*(-R*ny)-this.wy*(-R*nx))-usz;
   const vn=vcx*nx+vcy*ny+vcz*nz;
   let target=0;
   if(vn<-rest){
    const e=mat[this.cM[k]*3]*(1+rough.restitution*(2*this.rand()-1));target=-e*vn;
    // Mikro-Rauheit: Normale minimal kippen
    const tilt=rough.normalDeg*Math.PI/180*this.rand(),az=TAU*this.rand();
    let ax=Math.abs(ny)<.9?0:1,ay=Math.abs(ny)<.9?1:0,az2=0;
    let tx=ay*nz-az2*ny,ty=az2*nx-ax*nz,tz=ax*ny-ay*nx;const tl=Math.hypot(tx,ty,tz);tx/=tl;ty/=tl;tz/=tl;
    const bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx,ca=Math.cos(az),sa=Math.sin(az),st=Math.sin(tilt),ct=Math.cos(tilt);
    nx=nx*ct+(tx*ca+bx*sa)*st;ny=ny*ct+(ty*ca+by*sa)*st;nz=nz*ct+(tz*ca+bz*sa)*st;
    this.onContact?.(this.cK[k],this.cI[k],-vn,cx,this.py-R*this.cY[k],cz);
   }else if(this.onContact)this.onContact(this.cK[k],this.cI[k],0,cx,this.py-R*this.cY[k],cz);
   this.iX[k]=nx;this.iY[k]=ny;this.iZ[k]=nz;this.tgt[k]=target;this.jN[k]=0;this.jX[k]=0;this.jY[k]=0;this.jZ[k]=0;
  }
  // 3) Sequenzielle Impulse mit Coulomb-Reibung (Vollkugel: effektive Masse tangential 2/7)
  for(let it=0;it<4;it++)for(let k=0;k<n;k++){
   const nx=this.iX[k],ny=this.iY[k],nz=this.iZ[k],mu=mat[this.cM[k]*3+1];
   const cx=this.px-R*this.cX[k],cz=this.pz-R*this.cZ[k],usx=this.cRot[k]?-W*cz:0,usz=this.cRot[k]?W*cx:0;
   let vcx=this.vx+(this.wy*(-R*nz)-this.wz*(-R*ny))-usx,vcy=this.vy+(this.wz*(-R*nx)-this.wx*(-R*nz)),vcz=this.vz+(this.wx*(-R*ny)-this.wy*(-R*nx))-usz;
   const vn=vcx*nx+vcy*ny+vcz*nz,old=this.jN[k],nj=Math.max(0,old+this.tgt[k]-vn),dj=nj-old;this.jN[k]=nj;
   this.vx+=dj*nx;this.vy+=dj*ny;this.vz+=dj*nz;vcx+=dj*nx;vcy+=dj*ny;vcz+=dj*nz;
   const vn2=vcx*nx+vcy*ny+vcz*nz,tx=vcx-vn2*nx,ty=vcy-vn2*ny,tz=vcz-vn2*nz;
   let jx=this.jX[k]-tx/3.5,jy=this.jY[k]-ty/3.5,jz=this.jZ[k]-tz/3.5;
   const jl=Math.sqrt(jx*jx+jy*jy+jz*jz),lim=mu*nj;if(jl>lim){const f=lim/jl;jx*=f;jy*=f;jz*=f;}
   const ex=jx-this.jX[k],ey=jy-this.jY[k],ez=jz-this.jZ[k];this.jX[k]=jx;this.jY[k]=jy;this.jZ[k]=jz;
   this.vx+=ex;this.vy+=ey;this.vz+=ez;
   const f=-1/(.4*R);this.wx+=f*(ny*ez-nz*ey);this.wy+=f*(nz*ex-nx*ez);this.wz+=f*(nx*ey-ny*ex);
  }
  // 4) Rollwiderstand und Bohrreibung bei aufliegenden Kontakten, Laufbahnwiderstand einmal je Schritt
  let dragDone=false;
  for(let k=0;k<n;k++){
   const jn=this.jN[k];if(jn<=0||this.tgt[k]>0)continue;
   const nx=this.cX[k],ny=this.cY[k],nz=this.cZ[k],cx=this.px-R*nx,cz=this.pz-R*nz,usx=this.cRot[k]?-W*cz:0,usz=this.cRot[k]?W*cx:0;
   const rx=this.vx-usx,ry=this.vy,rz=this.vz-usz,rn=rx*nx+ry*ny+rz*nz,tx=rx-rn*nx,ty=ry-rn*ny,tz=rz-rn*nz,tm=Math.sqrt(tx*tx+ty*ty+tz*tz);
   const onTrack=!dragDone&&(this.cM[k]===M_TRACK||this.cM[k]===M_RAIL);if(onTrack)dragDone=true;
   if(tm>1e-12){const dv=Math.min(mat[this.cM[k]*3+2]*jn+(onTrack?BALL_PHYSICS.trackDrag*this.dt:0),tm),f=dv/tm;this.vx-=tx*f;this.vy-=ty*f;this.vz-=tz*f;this.wx-=(ny*tz-nz*ty)*f/R;this.wy-=(nz*tx-nx*tz)*f/R;this.wz-=(nx*ty-ny*tx)*f/R;}
   // Bohrreibung: kleines Coulomb-Moment um die Normale (Kontaktfläche ≈ 0,2 mm)
   const spin=(this.wx*nx+this.wy*ny+this.wz*nz)-(this.cRot[k]?W*ny:0),dw=Math.min(Math.abs(spin),.2*jn),sg=spin>0?dw:-dw;this.wx-=nx*sg;this.wy-=ny*sg;this.wz-=nz*sg;
  }
 }
}

/**
 * Querschnitt (r, y) aller Rautenflächen als Punktwolke. Liegt die Kugelmitte in diesem
 * Querschnitt weiter als der Kugelradius von allen Punkten entfernt, kann sie – egal bei
 * welchem Winkel – keine Raute berühren (der Abstand im Raum ist nie kleiner).
 */
export function deflectorSilhouette(col:Colliders){
 const pts:number[]=[];
 for(const k of [0,1]){const t=col.deflectorTris[k];for(let f=0;f<4;f++){const o=f*27;
  for(let i=0;i<=24;i++)for(let j=0;j<=24-i;j++){const a=i/24,b=j/24,c=1-a-b;
   const x=t[o]*a+t[o+3]*b+t[o+6]*c,y=t[o+1]*a+t[o+4]*b+t[o+7]*c,z=t[o+2]*a+t[o+5]*b+t[o+8]*c;pts.push(Math.hypot(x,z),y);}}}
 return new Float64Array(pts);
}
export function silhouetteDistance(sil:Float64Array,r:number,y:number){let best=Infinity;for(let i=0;i<sil.length;i+=2){const d=(sil[i]-r)**2+(sil[i+1]-y)**2;if(d<best)best=d;}return Math.sqrt(best);}
/** Ruhelage in der Laufbahnrinne (Mitte, Höhe) bei stehender Kugel – Ziel des Einsetzens. */
/** Höhe der Kugelmitte, wenn die Kugel bei Radius r von oben auf den festen Kessel abgesenkt wird. */
export function clearHeight(col:Colliders,R:number,r:number){
 let hi=1.6;while(hi>0&&minDistance(col.stator,r,hi-.002)>=R)hi-=.002;
 let lo=hi-.002;for(let i=0;i<40;i++){const y=(lo+hi)/2;if(minDistance(col.stator,r,y)<R)lo=y;else hi=y;}return hi;
}
export function grooveRest(col:Colliders,R:number){
 let best={r:2.94,y:9};
 // Von oben absenken, bis die Kugel die Fläche berührt (unterhalb der Fläche wäre der Abstand wieder groß).
 const clear=(r:number)=>{let hi=1.6;while(hi>0&&minDistance(col.stator,r,hi-.002)>=R)hi-=.002;let lo=hi-.002;for(let i=0;i<40;i++){const y=(lo+hi)/2;if(minDistance(col.stator,r,y)<R)lo=y;else hi=y;}return hi;};
 for(let r=2.88;r<=3.0;r+=.0005){const y=clear(r);if(y<best.y)best={r,y};}
 return best;
}
function minDistance(p:Profile,r:number,y:number){
 let best=Infinity;const q=new Float64Array(2);
 for(let i=0;i<p.seg.length;i+=10){const r0=p.seg[i],y0=p.seg[i+1],dr=p.seg[i+2]-r0,dy=p.seg[i+3]-y0;let u=((r-r0)*dr+(y-y0)*dy)/(dr*dr+dy*dy);u=u<0?0:u>1?1:u;best=Math.min(best,Math.hypot(r-r0-u*dr,y-y0-u*dy));}
 for(let i=0;i<p.tor.length;i+=6){ellipsePoint(r-p.tor[i],y-p.tor[i+1],p.tor[i+2],p.tor[i+3],q);best=Math.min(best,Math.hypot(r-p.tor[i]-q[0],y-p.tor[i+1]-q[1]));}
 return best;
}
/** Abstand eines Punkts zur nächsten Rautenfläche (für Tests: Kontakte liegen auf der Raute). */
export function deflectorDistance(col:Colliders,x:number,y:number,z:number){
 let best=Infinity;const q=new Float64Array(3);
 for(const tris of col.deflectorTris)for(let i=0;i<tris.length;i+=9){closestOnTriangle(x,y,z,tris,i,q);best=Math.min(best,Math.hypot(x-q[0],y-q[1],z-q[2]));}
 return best;
}
/** Abstand Kugelmitte → nächste sichtbare Fläche (für Tests: Eindringen ≤ 0,5 mm). */
export function surfaceDistance(col:Colliders,x:number,y:number,z:number,rotorAngle:number){
 const r=Math.hypot(x,z);let best=Math.min(minDistance(col.stator,r,y),minDistance(col.rotor,r,y));
 const q=new Float64Array(3);
 for(const tris of col.deflectorTris)for(let i=0;i<tris.length;i+=9){closestOnTriangle(x,y,z,tris,i,q);best=Math.min(best,Math.hypot(x-q[0],y-q[1],z-q[2]));}
 const dv=col.divider,psi=Math.atan2(x,-z)-rotorAngle,m0=Math.floor(psi/STEP-.5);
 for(let j=m0-1;j<=m0+2;j++){
  const phi=rotorAngle+(j+.5)*STEP,s=Math.sin(phi),c=Math.cos(phi),rho=x*s-z*c,at=Math.abs(x*c+z*s);
  const rq=Math.max(dv.rc-dv.half,Math.min(dv.rc+dv.half,rho));let b2=Infinity;
  const inY=y>=dv.yB&&y<=dv.yT,hw=dv.hwB+(dv.hwT-dv.hwB)*(Math.max(dv.yB,Math.min(dv.yT,y))-dv.yB)/(dv.yT-dv.yB);
  if(inY&&at<=hw){b2=0;}else for(const [x0,y0,x1,y1] of [[dv.hwB,dv.yB,dv.hwT,dv.yT],[dv.hwT,dv.yT,0,dv.yT],[0,dv.yB,dv.hwB,dv.yB]]){const ex=x1-x0,ey=y1-y0;let u=((at-x0)*ex+(y-y0)*ey)/(ex*ex+ey*ey);u=Math.max(0,Math.min(1,u));b2=Math.min(b2,(at-x0-u*ex)**2+(y-y0-u*ey)**2);}
  best=Math.min(best,Math.sqrt(b2+(rho-rq)**2));
 }
 return best;
}
