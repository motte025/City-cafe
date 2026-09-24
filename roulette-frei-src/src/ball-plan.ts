/**
 * Planung eines Wurfs als vorab berechnete Zeitreihe.
 *
 * Fairness: Die Zielzahl kommt von außen (randomIndex, Web Crypto). Hier wird nur
 * eine physikalisch simulierte Bewegung gesucht, die in genau dieser Tasche endet.
 *
 * Ablauf:
 *  1. Referenzlauf der Laufbahnphase (einmal je Kesselform, Kugel und Laufrichtung):
 *     Die Laufbahn ist rotationssymmetrisch, daher ist jede Runde auf ihr ein
 *     Ausschnitt dieses einen Laufs, nur gedreht. Ein Abwurf-Kandidat ist ein
 *     Startpunkt in diesem Lauf (schneller = länger auf der Bahn).
 *  2. Je Kandidat: Abstieg ab dem Verlassen der Rinne mit Rauten, Konus, Zahlenkranz
 *     und drehendem Rotor bis zum ersten Kontakt mit dem Taschenkranz.
 *  3. Passt die Eintrittstasche zum gezogenen Wunsch-Laufweg, wird die kurze
 *     Taschenphase mit einigen Rauheits-Varianten gerechnet (Abbruch, sobald die
 *     Kugel in einer falschen Tasche gefangen ist).
 *  4. Angenommen wird nur, was alle Fenster einhält. Sonst gelockerte Suche,
 *     danach meldet das Ergebnis "fallback" (Keyframe-Animation, landet sicher).
 */
import {BALL_PHYSICS,BALL_SEARCH,BALL_WINDOWS} from './ball-config';
import {BallSim,buildColliders,clearHeight,deflectorSilhouette,silhouetteDistance,K_DEFLECTOR,K_DIVIDER,K_POCKET,type BallParams,type Colliders,type DeflectorResistance} from './ball-physics';
import {STEP,TAU} from './game';
import {FLOOR,type WheelShape} from './wheel-shape';

export interface PlanRequest {
 /** optionales Rechenzeit-Budget (ms, Wanduhr); danach Abbruch → Rückfallebene. Tests lassen es weg. */
 timeBudgetMs?:number;
 /** Rauten-Widerstand je Ausrichtung (0–100 %); ohne Angabe gelten die Werkswerte aus ball-config.ts. */
 deflectorResistance?:DeflectorResistance;
 shape:WheelShape;ball:BallParams;
 /** Zielindex (Position in ORDER). */
 target:number;
 /** Drehrichtung des Rotors in diesem Wurf; die Kugel läuft entgegen. */
 direction:1|-1;
 /** Rotorwinkel und -geschwindigkeit im Abwurfmoment. */
 rotorStart:number;rotorSpeed:number;
 /** Weltwinkel des Abwurfpunkts (bei der letzten Gewinnzahl). */
 launchAngle:number;
 /** gezogene Rundendauer ab Abwurf (s) */
 duration:number;
 runMin:number;runMax:number;
 /** Bewegungs-Seed (32 bit) */
 seed:number;
}
export interface BallPlan {
 ok:true;
 /** Abstand der Stützstellen (s) und Anzahl; letzte Stützstelle = Stillstand. */
 dt:number;count:number;
 /** Weltposition je Stützstelle (x,y,z) */
 pos:Float32Array;
 /** Ruhelage im Rotor-System (x,y,z), gilt ab restTime */
 rest:[number,number,number];
 dropTime:number;entryTime:number;restTime:number;
 /** hörbare Stöße: Paare (Zeit, Stärke 0..1) */
 impacts:Float32Array;
 /** alle Stöße für Tests/Debug: (Zeit, Art, Index, Aufprallgeschw., x, y, z) */
 events:Float32Array;
 run:number;deflectorHits:number;entryPocket:number;finalIndex:number;
 radius:number;launchSpeed:number;
 candidates:number;variants:number;relaxed:boolean;durationClamped:boolean;computeMs:number;
}
export interface PlanFailure {ok:false;candidates:number;variants:number;computeMs:number;reason:string}
export type PlanResult=BallPlan|PlanFailure;

const REC=BALL_PHYSICS.recordEvery,DT=BALL_PHYSICS.dt,DT_REC=DT*REC;
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const wrap=(a:number)=>{a%=TAU;return a<-Math.PI?a+TAU:a>Math.PI?a-TAU:a;};

// ---------------------------------------------------------------- Referenzlauf
interface Reference {
 key:string;sigma:number;count:number;
 pos:Float32Array;ang:Float64Array;omega:Float32Array;
 /** Übergabe an die volle Simulation (Stützstellenindex) und Zustand dort */
 handoff:number;hand:Float64Array;
 maxLaunch:number;
}
const colliderCache=new Map<string,Colliders>(),refCache=new Map<string,Reference>();
const shapeKey=(s:WheelShape)=>`${s.bowlDepth.toFixed(4)}/${s.numberSlope.toFixed(3)}/${s.numberSize.toFixed(3)}`;
const ballKey=(b:BallParams)=>`${b.diameter.toFixed(3)}/${b.mass.toFixed(3)}/${b.bounce.toFixed(3)}`;
export function collidersFor(shape:WheelShape){const k=shapeKey(shape);let c=colliderCache.get(k);if(!c){c=buildColliders(shape);colliderCache.set(k,c);if(colliderCache.size>6)colliderCache.delete(colliderCache.keys().next().value!);}return c;}

/**
 * Übergabe an die volle Simulation: sobald die Kugel die Rinne verlassen hat (r < 2,925)
 * und im Querschnitt näher als Kugelradius + 8 mm an eine Raute kommt. Bis dahin ist der
 * Lauf für jeden Wurf gleich (nur gedreht), weil nichts Unsymmetrisches erreichbar ist.
 */
export const HANDOFF_RADIUS=2.925,HANDOFF_MARGIN=.008;

function* buildReference(col:Colliders,ball:BallParams,sigma:number):Generator<void,Reference>{
 const bd=col.shape.bowlDepth;
 let target=BALL_PHYSICS.maxLaunchSpeed;
 for(let attempt=0;;attempt++){
  const sim=new BallSim({colliders:col,ball,direction:1,startSpeed:.76,rotorStart:0,rotor:false,deflectors:false});
  sim.seed=0x5eed;
  const R=sim.R,r0=2.94,wallTop=.91*bd-.003,sil=deflectorSilhouette(col);
  sim.px=0;sim.pz=-r0;sim.py=clearHeight(col,R,r0)+.002;sim.vx=sigma*4.5*r0;
  const omega=()=>{const r2=sim.px*sim.px+sim.pz*sim.pz;return sigma*(sim.px*sim.vz-sim.pz*sim.vx)/r2;};
  // Anschub (gehört nie zu einem Wurf): sanft bis zur Zielgeschwindigkeit, dann frei rollen lassen
  let failed=false,steps=0;
  while(omega()<target&&sim.t<30){
   const r=Math.hypot(sim.px,sim.pz),a=2*sim.dt*r*sigma;sim.vx+=-sim.pz/r*a;sim.vz+=sim.px/r*a;sim.step();
   if(sim.py>wallTop||r>3.05){failed=true;break;}
   if(++steps%4000===0)yield;
  }
  // kurz einschwingen lassen
  for(let i=0;i<2000&&!failed;i++){sim.step();if(sim.py>wallTop)failed=true;}
  const cap=Math.ceil(40/DT_REC),pos=new Float32Array(cap*3),ang=new Float64Array(cap),om=new Float32Array(cap);
  let n=0,last=Math.atan2(sim.px,-sim.pz),acc=last,handoff=-1,hand=new Float64Array(0);
  while(!failed&&n<cap){
   if(steps%REC===0){
    const a=Math.atan2(sim.px,-sim.pz);acc+=wrap(a-last);last=a;
    pos[n*3]=sim.px;pos[n*3+1]=sim.py;pos[n*3+2]=sim.pz;ang[n]=acc;om[n]=omega();
    const rNow=Math.hypot(sim.px,sim.pz);
    if(rNow<HANDOFF_RADIUS&&(rNow<2.62||silhouetteDistance(sil,rNow,sim.py)<R+HANDOFF_MARGIN)){handoff=n;hand=sim.state();n++;break;}
    n++;
   }
   sim.step();steps++;
   if(sim.py>wallTop){failed=true;break;}
   if(steps%4000===0)yield;
  }
  if(!failed&&handoff>0){
   return {key:'',sigma,count:n,pos:pos.slice(0,n*3),ang:ang.slice(0,n),omega:om.slice(0,n),handoff,hand,maxLaunch:target};
  }
  if(attempt>6)throw new Error('Laufbahn-Referenz instabil');
  target*=.88;
 }
}
function* referenceFor(col:Colliders,ball:BallParams,sigma:number):Generator<void,Reference>{
 const key=`${shapeKey(col.shape)}|${ballKey(ball)}|${sigma}|${BALL_PHYSICS.gravityFactor}|${BALL_PHYSICS.trackDrag}`;
 const hit=refCache.get(key);if(hit)return hit;
 const ref=yield* buildReference(col,ball,sigma);ref.key=key;
 refCache.set(key,ref);if(refCache.size>6)refCache.delete(refCache.keys().next().value!);
 return ref;
}

// ---------------------------------------------------------------- Simulation eines Kandidaten
const rotate=(s:ArrayLike<number>,d:number)=>{
 const c=Math.cos(d),n=Math.sin(d),o=Float64Array.from(s as ArrayLike<number>);
 for(const i of [0,3,6]){const x=s[i],z=s[i+2];o[i]=x*c-z*n;o[i+2]=x*n+z*c;}
 return o;
};
interface Scratch {pos:Float32Array;ev:number[];n:number}
const scratch=():Scratch=>({pos:new Float32Array(Math.ceil(12/DT_REC)*3),ev:[],n:0});

interface Descent {ok:boolean;entryState:Float64Array;entryTime:number;entryPocket:number;entryAngle:number;sRel:number;recN:number;ev:number[];deflectors:number;}

/**
 * Pocket-Index und kontinuierlicher Relativwinkel der Kugel (rad) im Rotor-System.
 */
const localAngle=(sim:BallSim)=>Math.atan2(sim.px,-sim.pz)-sim.rotorAngle;

function runDescent(sim:BallSim,rec:Scratch,globalStep:number,maxTime:number):Descent{
 let entered=false,entryState=new Float64Array(0),entryTime=0,defl=0,lastDefl=-1,lastDeflT=-9;
 rec.ev.length=0;
 sim.onContact=(kind,index,impact,x,y,z)=>{
  if(kind===K_DEFLECTOR&&(index!==lastDefl||sim.t-lastDeflT>.06)){defl++;lastDefl=index;}
  if(kind===K_DEFLECTOR)lastDeflT=sim.t;
  if(impact>0)rec.ev.push(sim.t,kind,index,impact,x,y,z);
  if(!entered&&(kind===K_DIVIDER||kind===K_POCKET))entered=true;
 };
 let g=globalStep;
 while(sim.t<maxTime){
  sim.step();g++;
  if(g%REC===0){const i=rec.n*3;rec.pos[i]=sim.px;rec.pos[i+1]=sim.py;rec.pos[i+2]=sim.pz;rec.n++;}
  if(entered){entryState=sim.state();entryTime=sim.t;break;}
  if(Math.hypot(sim.px,sim.pz)>3.08||sim.py<0)break;
 }
 sim.onContact=null;
 if(!entered)return {ok:false,entryState,entryTime,entryPocket:0,entryAngle:0,sRel:0,recN:rec.n,ev:rec.ev.slice(),deflectors:defl};
 // Laufrichtung relativ zum Rotor: Winkelgeschwindigkeit der Kugel (dθ/dt) minus Rotor
 const psi=localAngle(sim),r2=sim.px*sim.px+sim.pz*sim.pz;sim.syncRotor();const rel=(sim.px*sim.vz-sim.pz*sim.vx)/r2-sim.rotorSpeed;
 return {ok:true,entryState,entryTime,entryPocket:((Math.round(psi/STEP)%37)+37)%37,entryAngle:psi,sRel:rel>=0?1:-1,recN:rec.n,ev:rec.ev.slice(),deflectors:defl};
}

interface PocketRun {ok:boolean;reason:string;restTime:number;run:number;finalIndex:number;settle:number;rest:[number,number,number];offset:number;recN:number;ev:number[];}

function runPocket(sim:BallSim,rec:Scratch,globalStep:number,d:Descent,needed:number,limitTime:number,runMax:number):PocketRun{
 const col=sim.col,bd=col.shape.bowlDepth,R=sim.R,g=sim.g,yT=col.divider.yT,yRest=FLOOR*bd+R;
 const escapeE=g*(yT+.9*R-yRest);
 let lastPsi=d.entryAngle,unwrapped=d.entryAngle,pocketNow=Math.round(unwrapped/STEP),lastChange=sim.t,calm=0,gs=globalStep;
 const entryUnwrapped=Math.round(d.entryAngle/STEP);
 rec.ev.length=0;
 sim.onContact=(kind,index,impact,x,y,z)=>{if(impact>0)rec.ev.push(sim.t,kind,index,impact,x,y,z);};
 // Abbruch meldet den Laufweg bis hierher (bei 'falsche Tasche' ist das der endgültige der Variante)
 const fail=(reason:string):PocketRun=>{sim.onContact=null;return {ok:false,reason,restTime:sim.t,run:(pocketNow-entryUnwrapped)*d.sRel,finalIndex:-1,settle:0,rest:[0,0,0],offset:0,recN:rec.n,ev:rec.ev.slice()};};
 while(sim.t<limitTime){
  sim.step();gs++;
  const recorded=gs%REC===0;
  if(recorded){const i=rec.n*3;rec.pos[i]=sim.px;rec.pos[i+1]=sim.py;rec.pos[i+2]=sim.pz;rec.n++;}
  const psi=localAngle(sim);unwrapped+=wrap(psi-lastPsi);lastPsi=psi;
  const p=Math.round(unwrapped/STEP);if(p!==pocketNow){pocketNow=p;lastChange=sim.t;}
  const run=(pocketNow-entryUnwrapped)*d.sRel;
  if(Math.abs(run)>runMax+2)return fail('zu weit');
  // Relativgeschwindigkeit zum Rotor
  sim.syncRotor();const W=sim.rotorSpeed,ux=-W*sim.pz,uz=W*sim.px,rvx=sim.vx-ux,rvy=sim.vy,rvz=sim.vz-uz,v2=rvx*rvx+rvy*rvy+rvz*rvz;
  const r=Math.hypot(sim.px,sim.pz),inPocket=r>1.6&&r<1.99&&sim.py<yT;
  const idx=((pocketNow%37)+37)%37;
  if(needed>=0&&inPocket&&.5*v2+g*(sim.py-yRest)<escapeE&&idx!==needed)return fail('falsche Tasche');
  if(inPocket&&v2<.02*.02&&recorded){
   calm+=DT_REC;
   if(calm>=.05){
    // Stillstand: Relativbewegung ab hier exakt null, Lage im Rotor-System festhalten
    sim.syncRotor();const c=Math.cos(sim.rotorAngle),s=Math.sin(sim.rotorAngle),lx=sim.px*c+sim.pz*s,lz=-sim.px*s+sim.pz*c;
    sim.onContact=null;
    return {ok:true,reason:'',restTime:sim.t,run,finalIndex:idx,settle:sim.t-lastChange,rest:[lx,sim.py,lz],offset:Math.abs(wrap(psi-idx*STEP)),recN:rec.n,ev:rec.ev.slice()};
   }
  }else if(recorded)calm=0;
 }
 return fail('Zeit');
}

// ---------------------------------------------------------------- Suche
const mulberry=(seed:number)=>()=>{let t=(seed=(seed+0x6D2B79F5)|0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};

/** Startwerte für die Wahl des Abwurfzeitpunkts; werden während der Suche aus den Ergebnissen nachgeführt. */
const EXPECT={descent:.7,pocket:1.3};
/** Zähler für Messskripte (Trichter der Suche). */
export const planStats={descents:0,entered:0,compatible:0,first:0,near:0,variants:0,hits:0,windowFail:0};

export function* planThrow(req:PlanRequest):Generator<void,PlanResult>{
 const t0=now(),col=collidersFor(req.shape),sigma=-req.direction;
 const ref=yield* referenceFor(col,req.ball,sigma);
 const rnd=mulberry(req.seed>>>0),kmin=Math.round(Math.min(req.runMin,req.runMax)),kmax=Math.round(Math.max(req.runMin,req.runMax));
 const wish=kmin+Math.floor(rnd()*(kmax-kmin+1));
 const rec=scratch(),fixedCount=ref.handoff;
 let candidates=0,variants=0,descentSum=0,descentN=0,pocketSum=0,pocketN=0;
 // Rautentreffer werden bevorzugt (mehr sichtbare Aktion): ein passender rautenfreier Wurf wird
 // nur als Rückfall gemerkt, die Suche läuft weiter, bis ein Treffer passt oder das Zeitbudget
 // für diese Bevorzugung (PREFER_HIT_BUDGET Kandidaten ab dem ersten Rückfall) aufgebraucht ist.
 let fallback:BallPlan|null=null,fallbackAt=-1;
 const PREFER_HIT_BUDGET=180;
 for(const relaxed of [false,true]){
  const tol=relaxed?BALL_SEARCH.relaxedDuration:BALL_WINDOWS.durationTolerance;
  const maxCand=relaxed?BALL_SEARCH.relaxedCandidates:BALL_SEARCH.candidates;
  for(let c=0;c<maxCand;c++){
   candidates++;
   // Toleranz um den Wunsch-Laufweg: erst eng (gleichverteilte Laufwege), dann schrittweise weiter
   const runTol=relaxed?99:c<BALL_SEARCH.widenAfter[0]?BALL_SEARCH.runTolerance:c<BALL_SEARCH.widenAfter[1]?BALL_SEARCH.runTolerance+2:99;
   const expDescent=descentN?descentSum/descentN:EXPECT.descent,expPocket=pocketN?pocketSum/pocketN:EXPECT.pocket;
   const wantHand=req.duration-expDescent-expPocket+(rnd()*2-1)*(tol+.3);
   let steps=Math.round(wantHand/DT_REC);steps=Math.max(0,Math.min(fixedCount,steps));
   const i=fixedCount-steps,delta=req.launchAngle-ref.ang[i];
   const sim=new BallSim({colliders:col,ball:req.ball,direction:req.direction,startSpeed:req.rotorSpeed,rotorStart:req.rotorStart,rotor:true,deflectors:true,deflectorResistance:req.deflectorResistance});
   const st=rotate(ref.hand,delta);st[9]=steps*DT_REC;st[10]=(req.seed^Math.imul(c+1+(relaxed?7919:0),0x9E3779B1))|0;
   sim.setState(st);
   rec.n=0;
   const d=runDescent(sim,rec,steps*REC,st[9]+2.5);
   if(c%4===3){yield;if(req.timeBudgetMs!==undefined&&now()-t0>req.timeBudgetMs)return {ok:false,candidates,variants,computeMs:now()-t0,reason:'Zeitbudget erschöpft'};}
   planStats.descents++;
   if(!d.ok)continue;
   planStats.entered++;
   descentSum+=d.entryTime-st[9];descentN++;
   const need=(((req.target-d.entryPocket)*d.sRel)%37+37)%37;
   // gelockert und nur bei sehr engem Bereich (z. B. genau 20): Laufweg darf um bis zu 2 Taschen abweichen
   const widen=relaxed&&kmax-kmin<4,lo=widen?Math.max(0,kmin-2):kmin,hi=widen?kmax+2:kmax;
   if(need<lo||need>hi||Math.abs(need-wish)>runTol)continue;
   planStats.compatible++;
   const [wMin,wMax]=BALL_WINDOWS.pocketTime(need);
   const pocketLo=relaxed?wMin-.4:wMin,pocketHi=relaxed?wMax+.8:wMax;
   const settleMax=relaxed?BALL_SEARCH.relaxedSettle:BALL_WINDOWS.settleMax;
   const clamped=steps===fixedCount;
   const descentRecN=rec.n,descentEv=d.ev;
   // Erste Variante zeigt, wohin dieser Einlauf von Natur aus läuft; liegt das nahe am nötigen
   // Laufweg, lohnen weitere Rauheits-Varianten (lange Läufe streuen um ±2–3 Taschen).
   let tries=BALL_SEARCH.pocketVariants;
   for(let v=0;v<tries;v++){
    variants++;
    const st2=Float64Array.from(d.entryState);if(v>0)st2[10]=(req.seed^Math.imul(c*131+v+17,0x85EBCA77)^(relaxed?0x2545F491:0))|0;
    sim.setState(st2);rec.n=descentRecN;
    const entryGlobal=steps*REC+Math.round((d.entryTime-st[9])/DT);
    const limit=Math.min(d.entryTime+pocketHi+.05,req.duration+tol+.05+(clamped?30:0));
    const p=runPocket(sim,rec,entryGlobal,d,req.target,limit,hi);
    if(p.ok){pocketSum+=p.restTime-d.entryTime;pocketN++;}
    if(v===0)planStats.first++;else planStats.variants++;
    if(v===0&&Math.abs(p.run-need)<=3&&p.reason!=='zu weit'){tries=BALL_SEARCH.pocketVariantsNear;planStats.near++;}
    if(p.ok&&p.finalIndex===req.target)planStats.hits++;
    if(!p.ok)continue;
    const pocketT=p.restTime-d.entryTime,total=p.restTime;
    if(p.finalIndex!==req.target||p.run<lo||p.run>hi)continue;
    if(pocketT<pocketLo||pocketT>pocketHi||p.settle>settleMax){planStats.windowFail++;continue;}
    if(!clamped&&Math.abs(total-req.duration)>tol)continue;
    if(p.offset<BALL_WINDOWS.restOffsetMin)continue;
    const result=assemble(req,ref,i,steps,delta,sim.R,rec,d,p,descentEv,{candidates,variants,relaxed,clamped,t0});
    if(result.deflectorHits>=1)return result;
    if(!fallback){fallback=result;fallbackAt=candidates;}
   }
   if(fallback&&candidates-fallbackAt>PREFER_HIT_BUDGET)return fallback;
  }
 }
 if(fallback)return fallback;
 return {ok:false,candidates,variants,computeMs:now()-t0,reason:'keine passende Bewegung'};
}

function assemble(req:PlanRequest,ref:Reference,i:number,steps:number,delta:number,R:number,rec:Scratch,d:Descent,p:PocketRun,descentEv:number[],meta:{candidates:number;variants:number;relaxed:boolean;clamped:boolean;t0:number}):BallPlan{
 // Stützstellen 0..steps aus dem Referenzlauf (gedreht, 'steps' = Übergabe), danach die eigene Rechnung
 const count=steps+1+rec.n,pos=new Float32Array(count*3),c=Math.cos(delta),s=Math.sin(delta);
 for(let k=0;k<=steps;k++){const o=(i+k)*3,x=ref.pos[o],y=ref.pos[o+1],z=ref.pos[o+2];pos[k*3]=x*c-z*s;pos[k*3+1]=y;pos[k*3+2]=x*s+z*c;}
 pos.set(rec.pos.subarray(0,rec.n*3),(steps+1)*3);
 const ev=[...descentEv,...p.ev],events=new Float32Array(ev);
 const snd:number[]=[];let lastT=-1;
 for(let k=0;k<ev.length;k+=7){
  const v=ev[k+3];if(v<.6)continue;
  const strength=Math.min(1,(v-.6)/7.5+.08);
  if(ev[k]-lastT<.04&&snd.length){snd[snd.length-1]=Math.max(snd[snd.length-1],strength);continue;}
  snd.push(ev[k],strength);lastT=ev[k];
 }
 const restTime=(count-1)*DT_REC;
 return {ok:true,dt:DT_REC,count,pos,rest:p.rest,dropTime:steps*DT_REC,entryTime:d.entryTime,restTime,
  impacts:new Float32Array(snd),events,run:p.run,deflectorHits:d.deflectors,entryPocket:d.entryPocket,finalIndex:p.finalIndex,
  radius:R,launchSpeed:ref.omega[i],candidates:meta.candidates,variants:meta.variants,relaxed:meta.relaxed,durationClamped:meta.clamped,computeMs:now()-meta.t0};
}

/** Synchrone Variante (Tests, Hauptthread-Notlösung). */
export function planThrowSync(req:PlanRequest):PlanResult{const g=planThrow(req);let r=g.next();while(!r.done)r=g.next();return r.value;}

// ---------------------------------------------------------------- Freier Wurf (ungeplant)
/**
 * Abwurf ohne Zielzahl: kein Suchen, kein Vergleich mit einem Wunschergebnis.
 * Zufälliger Abwurfzeitpunkt (Web Crypto), einmal durchsimuliert, Ergebnis ist,
 * wo die Kugel tatsächlich liegen bleibt – niemand kennt die Zahl vorher, auch
 * dieser Code nicht. Rundendauer und Laufweg ergeben sich aus der Physik statt
 * aus Reglern; siehe roulette-src/TESTBERICHT.md für die gemessene Streuung.
 */
export interface FreeThrowRequest {
 shape:WheelShape;ball:BallParams;direction:1|-1;rotorStart:number;rotorSpeed:number;launchAngle:number;
 deflectorResistance?:DeflectorResistance;
 /** optionales Rechenzeit-Budget (ms, Wanduhr); danach Abbruch → Rückfallebene. */
 timeBudgetMs?:number;
 /** Seed nur für die Rauheits-Zufallszahlen innerhalb eines Stoßes (Tests: reproduzierbar). */
 seed:number;
}
export function* planFreeThrow(req:FreeThrowRequest):Generator<void,PlanResult>{
 const t0=now(),col=collidersFor(req.shape),sigma=-req.direction;
 const ref=yield* referenceFor(col,req.ball,sigma),rnd=mulberry(req.seed>>>0);
 const rec=scratch(),fixedCount=ref.handoff;
 for(let attempt=0;attempt<8;attempt++){
  // Zufälliger Abwurfzeitpunkt – kein Zielwert, keine Suche. Auf die obere Hälfte der Laufbahnzeit
  // begrenzt, damit die Show nicht durch einen zu kurzen, hastigen Wurf wirkt (Vorgabe war ~16±3 s;
  // hier nur noch ein grober Rahmen, das genaue Ergebnis bleibt Physik).
  const steps=Math.round((.5+.5*rnd())*fixedCount),i=fixedCount-steps;
  const delta=req.launchAngle-ref.ang[i];
  const sim=new BallSim({colliders:col,ball:req.ball,direction:req.direction,startSpeed:req.rotorSpeed,rotorStart:req.rotorStart,rotor:true,deflectors:true,deflectorResistance:req.deflectorResistance});
  const st=rotate(ref.hand,delta);st[9]=steps*DT_REC;st[10]=(req.seed^Math.imul(attempt+1,0x9E3779B1))|0;
  sim.setState(st);rec.n=0;
  const d=runDescent(sim,rec,steps*REC,st[9]+3);
  yield;
  if(req.timeBudgetMs!==undefined&&now()-t0>req.timeBudgetMs)return {ok:false,candidates:attempt+1,variants:0,computeMs:now()-t0,reason:'Zeitbudget erschöpft'};
  if(!d.ok)continue;
  const descentRecN=rec.n,descentEv=d.ev;
  const entryGlobal=steps*REC+Math.round((d.entryTime-st[9])/DT);
  // needed=-1: jede Tasche ist ein gültiges Ergebnis; runMax großzügig, damit ein langer,
  // durch Rautentreffer verlangsamter Lauf nicht künstlich abgebrochen wird.
  const p=runPocket(sim,rec,entryGlobal,d,-1,d.entryTime+8,80);
  yield;
  if(!p.ok)continue;
  return assemble(req as unknown as PlanRequest,ref,i,steps,delta,sim.R,rec,d,p,descentEv,{candidates:attempt+1,variants:1,relaxed:false,clamped:false,t0});
 }
 return {ok:false,candidates:8,variants:0,computeMs:now()-t0,reason:'Kugel kam nicht rechtzeitig zur Ruhe (sehr selten)'};
}
export function planFreeThrowSync(req:FreeThrowRequest):PlanResult{const g=planFreeThrow(req);let r=g.next();while(!r.done)r=g.next();return r.value;}


/** Nur für Tests und Messskripte. */
export const planInternals={referenceFor,runDescent,runPocket,rotate,scratch,DT_REC,REC};
