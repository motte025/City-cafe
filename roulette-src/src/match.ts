/**
 * Spielmodus: mehrere Spieler, der Computer dreht reihum für jeden.
 *
 * Die Kugel entscheidet allein: jede Landung wird dem Spieler gutgeschrieben,
 * der gerade dran ist. Dieses Modul kennt die nächste Zahl nicht – es zählt
 * nur mit (die Gewinnzahl kommt weiterhin aus randomIndex()). Zufällig
 * gezogen wird hier nur, wer beginnt (randomBelow, ebenfalls Web Crypto).
 *
 * - „Runden“: jeder Spieler bekommt so viele Würfe wie gewählt (Standard 10),
 *   die Zahlen werden addiert, am Ende gewinnt die höchste Summe
 *   (Gleichstand: mehrere Sieger).
 * - „201“/„301“/„501“: wer genau auf das Ziel kommt, hat ausgemacht. Die angefangene Runde wird
 *   immer fertig gespielt; machen darin mehrere aus, teilen sie sich den Sieg.
 *   Eine Zahl, die über das Ziel hinausführt, zählt nicht („überworfen“).
 *   Ab 36 fehlenden Punkten gibt es genau eine Zahl, die ausmacht.
 *   Optional mit Rundenlimit: trifft bis dahin niemand genau, gewinnt, wer
 *   am nächsten dran ist.
 */
export type MatchMode='rounds'|'x201'|'x301'|'x501'|'ko'|'kol';
export const MATCH_MODES:MatchMode[]=['rounds','x201','x301','x501','ko','kol'];
/** K.-o.-Modus: jede Runde wirft jeder Verbliebene einmal. ko = die niedrigste Zahl scheidet aus, der Letzte gewinnt;
 *  kol = die höchste Zahl ist in Sicherheit, der Letzte ist der Verlierer. Gleichstand am Ende → Stechen nur unter den Gleichen. */
export const isKo=(m:MatchMode)=>m==='ko'||m==='kol';
export const MIN_PLAYERS=2,MAX_PLAYERS=12,MATCH_ROUNDS=10,MIN_ROUNDS=1,MAX_ROUNDS=50;
export const ROUND_PRESETS=[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25,30];
export const modeLabel=(m:MatchMode)=>m==='rounds'?'Runden':isKo(m)?'K.o.':m.slice(1);
export const modeTarget=(m:MatchMode)=>m==='x201'||m==='x301'||m==='x501'?Number(m.slice(1)):null;
/** Spielername von der Fernbedienung: höchstens 16 Zeichen, keine Steuerzeichen; leer → „Spieler n“. */
export function cleanName(v:unknown,i:number){const s=typeof v==='string'?v.replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,16):'';return s||`Spieler ${i+1}`;}
export const isMatchMode=(v:unknown):v is MatchMode=>MATCH_MODES.includes(v as MatchMode);
/** Gleichverteilte Zufallszahl 0 … n−1 (Web Crypto, Rejection Sampling wie randomIndex). */
export function randomBelow(n:number,read:()=>number=()=>crypto.getRandomValues(new Uint32Array(1))[0]){const limit=Math.floor(2**32/n)*n;let v;do{v=read();}while(v>=limit);return v%n;}

/** out: hat genau ausgemacht (wirft nicht mehr); finish: die Zahl, mit der ausgemacht wurde. */
/** hist: alle Würfe der Reihe nach, kommagetrennt; x = überworfen (zählt nicht), * = ausgemacht. */
/** K.-o.: cur = Wurf in der laufenden Runde, ko = Runde, in der er ausgeschieden bzw. in Sicherheit ist, place = Endplatz. */
export interface MatchPlayer {name:string;score:number;throws:number;out?:boolean;finish?:number;hist?:string;cur?:number|null;prev?:number|null;ko?:number;place?:number}
/** Was am Ende einer K.-o.-Runde passiert ist. */
export interface KoEvent {kind:'out'|'safe'|'tie';players:number[];round:number}
export interface MatchThrow {player:number;number:number;counted:boolean;bust:boolean;win:boolean}
/** exact = genau getroffen, rounds = Rundenlimit erreicht */
export type MatchEnd='exact'|'rounds'|'ko';
export interface MatchState {mode:MatchMode;target:number|null;rounds:number|null;round:number;turn:number;first:number;finished:boolean;end:MatchEnd|null;winners:number[];players:MatchPlayer[];last:MatchThrow|null;pool?:number[];tie?:boolean;loser?:number|null;event?:KoEvent|null}

export class Match {
 readonly target:number|null;readonly players:MatchPlayer[];readonly rounds:number|null;readonly first:number;
 turn:number;round=1;finished=false;end:MatchEnd|null=null;winners:number[]=[];last:MatchThrow|null=null;
 pool:number[]=[];tie=false;loser:number|null=null;event:KoEvent|null=null;
 /** rounds: Rundenlimit (bei 301/501 null = unbegrenzt); first: wer beginnt. */
 constructor(readonly mode:MatchMode,count:number,rounds:number|null=mode==='rounds'?MATCH_ROUNDS:null,first=0){
  if(!isMatchMode(mode)||!Number.isInteger(count)||count<MIN_PLAYERS||count>MAX_PLAYERS)throw new Error('Ungültiger Spielmodus');
  this.target=modeTarget(mode);
  if(isKo(mode)?rounds!==null:rounds===null?this.target===null:(!Number.isInteger(rounds)||rounds<MIN_ROUNDS||rounds>MAX_ROUNDS))throw new Error('Ungültige Rundenzahl');
  if(!Number.isInteger(first)||first<0||first>=count)throw new Error('Ungültiger Beginner');
  this.rounds=rounds;this.first=first;this.turn=first;
  this.players=Array.from({length:count},(_,i)=>({name:`Spieler ${i+1}`,score:0,throws:0,out:false}));
  if(isKo(mode)){this.pool=this.inOrder(this.players.map((_,i)=>i));this.players.forEach(p=>p.cur=null);}
 }
 /** Indizes in Spielreihenfolge ab dem Beginner. */
 private inOrder(list:number[]){const n=this.players.length;return [...list].sort((a,b)=>(a-this.first+n)%n-(b-this.first+n)%n);}
 /** Punkte, die dem Spieler noch fehlen (nur 301/501). */
 needed(i:number){return this.target===null?null:this.target-this.players[i].score;}
 /** Die eine Zahl, die das Spiel beendet – nur wenn höchstens 36 fehlen. */
 checkout(i:number){const n=this.needed(i);return n!==null&&n>=1&&n<=36?n:null;}
 /** Spieler nach Punkten, bei Gleichstand in Spielreihenfolge. */
 ranking(){return rankPlayers(this.state());}
 /** Landung für den Spieler, der gerade dran ist. */
 record(number:number){
  if(this.finished||!Number.isInteger(number)||number<0||number>36)return null;
  const i=this.turn,p=this.players[i];p.throws++;
  let counted=true,bust=false,win=false;
  if(this.target!==null){
   const rest=this.target-p.score;
   if(number>rest){counted=false;bust=true;}
   else{p.score+=number;if(number===rest){win=true;p.out=true;p.finish=number;}}
  }else p.score+=number;
  if(isKo(this.mode))p.cur=number;
  p.hist=(p.hist?p.hist+',':'')+number+(bust?'x':win?'*':'');
  this.last={player:i,number,counted,bust,win};
  if(isKo(this.mode)){this.advanceKo();return this.last;}
  this.advance();
  return this.last;
 }
 private advanceKo(){
  const k=this.pool.indexOf(this.turn);this.event=null;
  if(k>=0&&k<this.pool.length-1){this.turn=this.pool[k+1];return;}
  // Runde vorbei: niedrigste (ko) bzw. höchste (kol) Zahl entscheidet; Gleichstand → Stechen unter den Gleichen.
  const low=this.mode==='ko',vals=this.pool.map(i=>this.players[i].cur??0),target=low?Math.min(...vals):Math.max(...vals);
  const group=this.pool.filter(i=>(this.players[i].cur??0)===target),n=this.players.length;
  if(group.length===1){
   const g=group[0],p=this.players[g];p.out=true;p.ko=this.round;const left=this.players.filter(q=>q.out).length;
   p.place=low?n-left+1:left;this.event={kind:low?'out':'safe',players:[g],round:this.round};
   const alive=this.players.flatMap((q,i)=>q.out?[]:[i]);
   if(alive.length===1){const a=alive[0];this.players[a].place=low?1:n;this.finished=true;this.end='ko';this.winners=low?[a]:[];this.loser=low?null:a;this.pool=[];this.turn=a;return;}
   this.pool=this.inOrder(alive);this.tie=false;
  }else{this.pool=this.inOrder(group);this.tie=true;this.event={kind:'tie',players:group,round:this.round};}
  // Würfe der abgeschlossenen Runde bleiben sichtbar (prev), bis in der neuen Runde geworfen wird.
  this.round++;for(const q of this.players){if(q.cur!=null)q.prev=q.cur;q.cur=null;}this.turn=this.pool[0];
 }
 private advance(){
  // Wer schon ausgemacht hat, wird übersprungen; am Rundenende entscheidet sich das Spiel.
  const n=this.players.length;let wrapped=false;
  do{this.turn=(this.turn+1)%n;if(this.turn===this.first)wrapped=true;}while(this.players[this.turn].out&&!wrapped);
  if(!wrapped)return;this.turn=this.first;
  const exact=this.players.flatMap((p,i)=>p.out?[i]:[]);
  if(exact.length){this.finished=true;this.end='exact';this.winners=exact;return;}
  if(this.rounds!==null&&this.round>=this.rounds){
   // Rundenlimit: höchste Summe, bei 301/501 also am nächsten am Ziel.
   this.finished=true;this.end='rounds';const best=Math.max(...this.players.map(p=>p.score));
   this.winners=this.players.flatMap((p,i)=>p.score===best?[i]:[]);return;
  }
  this.round++;
 }
 state():MatchState{return {mode:this.mode,target:this.target,rounds:this.rounds,round:this.round,turn:this.turn,first:this.first,finished:this.finished,end:this.end,winners:[...this.winners],players:this.players.map(p=>({...p})),last:this.last&&{...this.last},pool:[...this.pool],tie:this.tie,loser:this.loser,event:this.event&&{...this.event,players:[...this.event.players]}};}
}

/** Reihenfolge ab dem Beginner (für Rangliste bei Gleichstand). */
export function rankPlayers(s:MatchState){const n=s.players.length,order=(i:number)=>(i-s.first+n)%n;
 if(isKo(s.mode)){
  // K.-o.: vergebene Plätze zählen; Verbliebene stehen bei ko oben, bei kol (Letzter verliert) unten.
  const key=(i:number)=>s.players[i].place??(s.mode==='ko'?0:n+1);return s.players.map((_,i)=>i).sort((a,b)=>key(a)-key(b)||order(a)-order(b));}
 return s.players.map((_,i)=>i).sort((a,b)=>s.players[b].score-s.players[a].score||order(a)-order(b));}

/** Prüft einen empfangenen Spielstand (Fernbedienung) grob auf Plausibilität. */
export function readMatchState(v:unknown):MatchState|null{
 if(!v||typeof v!=='object')return null;const s=v as MatchState;
 if(!isMatchMode(s.mode)||!Array.isArray(s.players)||s.players.length<MIN_PLAYERS||s.players.length>MAX_PLAYERS)return null;
 if(!s.players.every(p=>p&&typeof p.name==='string'&&Number.isFinite(p.score)&&Number.isFinite(p.throws)))return null;
 if(!Number.isInteger(s.turn)||s.turn<0||s.turn>=s.players.length||!Array.isArray(s.winners))return null;
 if(!Number.isInteger(s.first)||s.first<0||s.first>=s.players.length)return null;
 return s;
}
