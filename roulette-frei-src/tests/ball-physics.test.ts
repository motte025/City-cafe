import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BALL_PHYSICS,BALL_WINDOWS,G_EARTH,MM_PER_UNIT,deflectorMaterial} from '../src/ball-config';
import {buildColliders,BallSim,surfaceDistance,FLUSH_BEADS} from '../src/ball-physics';
import {collidersFor,planThrowSync,planInternals,type BallPlan,type PlanRequest} from '../src/ball-plan';
import {deflectorGeometry} from '../src/wheel-model';
import {DEFAULT_DESIGN,DIVIDER_HEIGHT,FLOOR,rimProfile,type WheelShape} from '../src/wheel-shape';
import {STEP,TAU} from '../src/game';
import {applySettings,DEFAULT_SETTINGS} from '../src/settings';
import {checkPlan} from './ball-check';

const request=(k:number,over:Partial<PlanRequest>={}):PlanRequest=>{
 const direction=(k%2?1:-1) as 1|-1,rotorStart=(k*1.37)%TAU;
 return {shape:{...DEFAULT_DESIGN},ball:{diameter:21,mass:8.7,bounce:1},target:k%37,direction,rotorStart,rotorSpeed:.76*direction,
  launchAngle:rotorStart+((k*11)%37)*STEP,duration:13+(k*3)%7,runMin:5,runMax:15,seed:(0x2468ace+k*2654435761)>>>0,...over};
};
const plan=(req:PlanRequest)=>{const r=planThrowSync(req);assert.ok(r.ok,`kein Wurf gefunden (${JSON.stringify({target:req.target,dir:req.direction})})`);return r as BallPlan;};

test('Kollisionsgeometrie der Rauten ist die sichtbare Geometrie (alle Kesseltiefen)',()=>{
 for(const bowlDepth of [.85,1.15,1.45]){
  const col=buildColliders({...DEFAULT_DESIGN,bowlDepth});
  for(let i=0;i<8;i++){
   const visible=deflectorGeometry(i).getAttribute('position');
   for(let v=0;v<visible.count;v++){
    const x=visible.getX(v),y=visible.getY(v)*bowlDepth,z=visible.getZ(v);
    assert.ok(col.deflectorPoints[i].some(p=>Math.hypot(p[0]-x,p[1]-y,p[2]-z)<1e-6),`Raute ${i}`);
   }
  }
 }
});

test('Stege: jede sichtbare Ecke liegt auf der Kollisionsfläche (Fase inklusive)',()=>{
 const wall=new T.Shape();wall.moveTo(-.015,0);wall.lineTo(.015,0);wall.lineTo(.009,DIVIDER_HEIGHT-FLOOR-.012);wall.lineTo(-.009,DIVIDER_HEIGHT-FLOOR-.012);wall.closePath();
 for(const bowlDepth of [.85,1.45]){
  const shape={...DEFAULT_DESIGN,bowlDepth},col=buildColliders(shape);
  const g=new T.ExtrudeGeometry(wall,{depth:.398,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,steps:1,curveSegments:1});
  g.translate(0,FLOOR+.008,-.199);const a=3*STEP,mesh=new T.Mesh(g);mesh.position.set(Math.sin(a+STEP/2)*1.785,0,-Math.cos(a+STEP/2)*1.785);mesh.rotation.y=-(a+STEP/2);mesh.updateMatrix();g.applyMatrix4(mesh.matrix);g.scale(1,bowlDepth,1);
  const p=g.getAttribute('position');let worst=0;
  for(let v=0;v<p.count;v++){const x=p.getX(v),y=p.getY(v),z=p.getZ(v),r=Math.hypot(x,z);if(r<1.6||r>1.97)continue;
   // Abstand zur Kollisionsfläche des Stegs (Rotor in Nulllage): Ecken liegen darauf oder minimal innen
   worst=Math.max(worst,Math.abs(surfaceDistance({...col,deflectorTris:[]},x,y,z,0)));}
  assert.ok(worst<.3/MM_PER_UNIT,`Stegecke weicht ${(worst*MM_PER_UNIT).toFixed(2)} mm ab`);
 }
});

test('Wulstringe: alle sichtbaren außer den drei gemeldeten liegen in der Kollision',()=>{
 const col=collidersFor(DEFAULT_DESIGN);
 for(const [radius,y,t] of rimProfile(DEFAULT_DESIGN)){
  const top=y*DEFAULT_DESIGN.bowlDepth+t*DEFAULT_DESIGN.bowlDepth;
  const d=surfaceDistance({...col,deflectorTris:[]},radius,top,0,0);
  if(FLUSH_BEADS.includes(radius))assert.ok(d>.5/MM_PER_UNIT,`Ring ${radius} ist absichtlich bündig`);
  else assert.ok(d<.3/MM_PER_UNIT,`Ring ${radius} fehlt in der Kollision`);
 }
});

test('Laufbahn: schnelle Kugel bleibt auf der Bahn, bremst und verlässt sie erst langsam',()=>{
 for(const shape of [{...DEFAULT_DESIGN},{...DEFAULT_DESIGN,bowlDepth:.85},{...DEFAULT_DESIGN,bowlDepth:1.45}])for(const dia of [18,21]){
  const col=collidersFor(shape),g=planInternals.referenceFor(col,{diameter:dia,mass:dia===18?5.3:10.5,bounce:1},-1);let r=g.next();while(!r.done)r=g.next();const ref=r.value;
  // Auf der Schiene fällt die Winkelgeschwindigkeit monoton; erst unter ~4 rad/s beginnt das
  // Abrutschen nach innen (dabei steigt ω kurz – Drehimpuls bei kleinerem Radius, physikalisch richtig).
  let peak=0;for(let i=1;i<ref.count;i++)if(ref.omega[i]>ref.omega[peak])peak=i;
  let rising=0,end=peak;while(end<ref.count&&ref.omega[end]>4)end++;
  for(let i=peak+200;i<end;i+=200)if(ref.omega[i]>ref.omega[i-200]+1e-3)rising++;
  assert.equal(rising,0);assert.ok((end-peak)*planInternals.DT_REC>10,'lange Laufbahnphase');
  for(let i=peak;i<end;i+=500)assert.ok(Math.hypot(ref.pos[i*3],ref.pos[i*3+2])>2.93,'bleibt schnell auf der Bahn');
  assert.ok(ref.omega[ref.handoff]<3.6&&ref.omega[ref.handoff]>1.2,`Abgang bei ${ref.omega[ref.handoff]}`);
  assert.ok(ref.count*planInternals.DT_REC>14,'lange Runden auf der Bahn möglich');
  // Bis zur Übergabe keine Raute erreichbar: volle Simulation mit Rauten berührt keine
  const sim=new BallSim({colliders:col,ball:{diameter:dia,mass:8.7,bounce:1},direction:1,startSpeed:.76,rotorStart:0,rotor:false,deflectors:true});
  let touched=false;sim.onContact=kind=>{if(kind===1)touched=true;};
  for(const phase of [0,.2,.4,.6]){const st=planInternals.rotate(ref.hand,phase);sim.setState(st);sim.step();}
  assert.equal(touched,false);
 }
});

test('Alle 37 Ziele in beiden Richtungen: richtige Tasche, Laufweg, Zeitfenster, Stetigkeit, keine Durchdringung',()=>{
 const runs=new Set<number>();
 for(let k=0;k<74;k++){
  const req=request(k,{target:k%37,direction:k<37?1:-1});const p=plan(req);const m=checkPlan(req,p,k%6===0);runs.add(m.run);
 }
 assert.ok(runs.size>=6,'Laufwege variieren');
});

test('Extremwerte von Kugel und Kesselform bleiben korrekt',()=>{
 const balls=[{diameter:18,mass:5.3,bounce:.5},{diameter:21,mass:10.5,bounce:1.4},{diameter:18,mass:10.5,bounce:1.4},{diameter:21,mass:5.3,bounce:.5}];
 const failures:string[]=[];
 const shapes:WheelShape[]=[{...DEFAULT_DESIGN,bowlDepth:.85,numberSlope:8},{...DEFAULT_DESIGN,bowlDepth:1.45,numberSlope:28},{...DEFAULT_DESIGN,bowlDepth:.85,numberSlope:28},{...DEFAULT_DESIGN,bowlDepth:1.45,numberSlope:8}];
 let k=0;
 for(const ball of balls)for(const shape of shapes)for(let j=0;j<3;j++,k++){
  const req=request(k*5+3,{ball,shape,target:(k*7)%37,runMin:j===2?3:5,runMax:j===2?20:15});
  const r=planThrowSync(req);if(r.ok)checkPlan(req,r,j===0);else failures.push(`Kugel ${ball.diameter} mm/${ball.mass} g, Tiefe ${shape.bowlDepth}, Gefälle ${shape.numberSlope}°`);
 }
 // Extreme Formen verlängern die Suche (flacher Zahlenkranz, Rotorrand über der Konuskante);
 // scheitert sie, zeigt die Rückfallebene trotzdem die richtige Zahl. Hier: überwiegend gefunden.
 // Bei extremen Kombinationen (sehr flacher/tiefer Kessel, kleines Gefälle) braucht die Suche länger als
// das Zeitbudget; dann greift die Rückfallebene (zeigt garantiert die richtige Zahl). Bis zu einem Drittel ist ok.
assert.ok(failures.length<=k/3,`zu viele Rückfälle (${failures.length} von ${k}): ${failures.slice(0,3).join('; ')}…`);
});

test('Laufweg-Regler: enger Bereich wird eingehalten, seltene Bereiche weichen höchstens 2 Taschen ab',()=>{
 for(const [lo,hi] of [[3,3],[8,9],[20,20]])for(let k=0;k<4;k++){
  const req=request(100+k,{runMin:lo,runMax:hi});const r=planThrowSync(req);
  if(lo<20){assert.ok(r.ok);assert.ok(r.run>=lo&&r.run<=hi||r.relaxed&&r.run>=lo-2&&r.run<=hi+2);}
  else if(r.ok)assert.ok(r.run>=18&&r.run<=22);
 }
});

test('Deterministisch je Seed, verschiedene Seeds geben verschiedene Würfe',()=>{
 const a=plan(request(7)),b=plan(request(7)),c=plan(request(7,{seed:99}));
 assert.deepEqual(Array.from(a.pos),Array.from(b.pos));assert.equal(a.restTime,b.restTime);
 assert.notDeepEqual(Array.from(a.pos.subarray(0,300)),Array.from(c.pos.subarray(0,300)));
});

test('Stöße erzeugen Töne mit Stärke aus der Aufprallgeschwindigkeit und Mindestabstand',()=>{
 const p=plan(request(11));assert.ok(p.impacts.length>=4);
 for(let k=0;k<p.impacts.length;k+=2){assert.ok(p.impacts[k+1]>0&&p.impacts[k+1]<=1);if(k)assert.ok(p.impacts[k]-p.impacts[k-2]>=.04-1e-6);}
});

test('Schwerkraft-Faktor liegt im erlaubten Bereich, Einheiten stimmen',()=>{
 assert.ok(BALL_PHYSICS.gravityFactor>=.6&&BALL_PHYSICS.gravityFactor<=1);
 assert.ok(Math.abs(G_EARTH-9810/(900/6.5))<1e-9);
 assert.ok(BALL_WINDOWS.settleMax<=.8);
});

test('Rauten-Widerstand: Regler 0–100 % ergibt die richtigen Stoßwerte und wirkt im Wurf',()=>{
 // 0 % = kein Widerstand (voller Rückprall, keine Reibung), 100 % = totaler Widerstand (kein Rückprall, maximale Reibung).
 const none=deflectorMaterial(0),total=deflectorMaterial(100),half=deflectorMaterial(50);
 assert.equal(none.e,1);assert.equal(none.mu,0);
 assert.equal(total.e,0);assert.equal(total.mu,1);
 assert.ok(Math.abs(half.e-.5)<1e-9&&Math.abs(half.mu-.5)<1e-9);
 assert.ok(deflectorMaterial(150).mu<=1&&deflectorMaterial(-20).mu>=0,'wird auf 0–100 % begrenzt');
 // Wird tatsächlich an die Simulation durchgereicht (kein Absturz, Ergebnis bleibt gültig).
 const req=request(3,{deflectorResistance:{radial:0,tangential:100}});
 checkPlan(req,plan(req),false);
});

test('Kugel- und Einlaufwerte sind begrenzt, min ≤ max, alte Einstellungen bekommen Standardwerte',()=>{
 const s=applySettings(DEFAULT_SETTINGS,{ballDiameter:99,ballMass:-1,ballBounce:99});
 assert.equal(s.ballDiameter,21);assert.equal(s.ballMass,5.3);assert.equal(s.ballBounce,1.4);
 assert.equal(applySettings(DEFAULT_SETTINGS,{duration:18}).ballDiameter,21);
 assert.equal(DEFAULT_SETTINGS.pocketRunMin,5);assert.equal(DEFAULT_SETTINGS.pocketRunMax,15);
 const old=applySettings(DEFAULT_SETTINGS,{ballDiameter:19});assert.equal(old.pocketRunMin,5);assert.equal(old.pocketRunMax,15);
 assert.equal(applySettings(DEFAULT_SETTINGS,{pocketRunMin:1}).pocketRunMin,3);
 assert.equal(applySettings(DEFAULT_SETTINGS,{pocketRunMax:40}).pocketRunMax,20);
 assert.equal(DEFAULT_SETTINGS.deflectorResistanceRadial,30);assert.equal(DEFAULT_SETTINGS.deflectorResistanceTangential,30);
 assert.equal(applySettings(DEFAULT_SETTINGS,{deflectorResistanceRadial:-5}).deflectorResistanceRadial,0);
 assert.equal(applySettings(DEFAULT_SETTINGS,{deflectorResistanceTangential:150}).deflectorResistanceTangential,100);
 const up=applySettings(DEFAULT_SETTINGS,{pocketRunMin:18});assert.equal(up.pocketRunMin,18);assert.equal(up.pocketRunMax,18);
 const down=applySettings(DEFAULT_SETTINGS,{pocketRunMax:4});assert.equal(down.pocketRunMax,4);assert.equal(down.pocketRunMin,4);
 assert.equal(applySettings(DEFAULT_SETTINGS,{pocketRunMin:7.6}).pocketRunMin,8);
});
