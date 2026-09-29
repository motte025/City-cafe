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
export type MatchMode='rounds'|'x201'|'x301'|'x501';
export const MATCH_MODES:MatchMode[]=['rounds','x201','x301','x501'];
export const MIN_PLAYERS=2,MAX_PLAYERS=12,MATCH_ROUNDS=10,MIN_ROUNDS=1,MAX_ROUNDS=50;
export const ROUND_PRESETS=[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25,30];
export const modeLabel=(m:MatchMode)=>m==='rounds'?'Runden':m.slice(1);
export const modeTarget=(m:MatchMode)=>m==='rounds'?null:Number(m.slice(1));
/** Spielername von der Fernbedienung: höchstens 16 Zeichen, keine Steuerzeichen; leer → „Spieler n“. */
export function cleanName(v:unknown,i:number){const s=typeof v==='string'?v.replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,16):'';return s||`Spieler ${i+1}`;}
export const isMatchMode=(v:unknown):v is MatchMode=>MATCH_MODES.includes(v as MatchMode);
/** Gleichverteilte Zufallszahl 0 … n−1 (Web Crypto, Rejection Sampling wie randomIndex). */
export function randomBelow(n:number,read:()=>number=()=>crypto.getRandomValues(new Uint32Array(1))[0]){const limit=Math.floor(2**32/n)*n;let v;do{v=read();}while(v>=limit);return v%n;}

/** out: hat genau ausgemacht (wirft nicht mehr); finish: die Zahl, mit der ausgemacht wurde. */
/** hist: alle Würfe der Reihe nach, kommagetrennt; x = überworfen (zählt nicht), * = ausgemacht. */
export interface MatchPlayer {name:string;score:number;throws:number;out?:boolean;finish?:number;hist?:string}
export interface MatchThrow {player:number;number:number;counted:boolean;bust:boolean;win:boolean}
/** exact = genau getroffen, rounds = Rundenlimit erreicht */
export type MatchEnd='exact'|'rounds';
export interface MatchState {mode:MatchMode;target:number|null;rounds:number|null;round:number;turn:number;first:number;finished:boolean;end:MatchEnd|null;winners:number[];players:MatchPlayer[];last:MatchThrow|null}

export class Match {
 readonly target:number|null;readonly players:MatchPlayer[];readonly rounds:number|null;readonly first:number;
 turn:number;round=1;finished=false;end:MatchEnd|null=null;winners:number[]=[];last:MatchThrow|null=null;
 /** rounds: Rundenlimit (bei 301/501 null = unbegrenzt); first: wer beginnt. */
 constructor(readonly mode:MatchMode,count:number,rounds:number|null=mode==='rounds'?MATCH_ROUNDS:null,first=0){
  if(!isMatchMode(mode)||!Number.isInteger(count)||count<MIN_PLAYERS||count>MAX_PLAYERS)throw new Error('Ungültiger Spielmodus');
  this.target=modeTarget(mode);
  if(rounds===null?this.target===null:(!Number.isInteger(rounds)||rounds<MIN_ROUNDS||rounds>MAX_ROUNDS))throw new Error('Ungültige Rundenzahl');
  if(!Number.isInteger(first)||first<0||first>=count)throw new Error('Ungültiger Beginner');
  this.rounds=rounds;this.first=first;this.turn=first;
  this.players=Array.from({length:count},(_,i)=>({name:`Spieler ${i+1}`,score:0,throws:0,out:false}));
 }
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
  p.hist=(p.hist?p.hist+',':'')+number+(bust?'x':win?'*':'');
  this.last={player:i,number,counted,bust,win};
  this.advance();
  return this.last;
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
 state():MatchState{return {mode:this.mode,target:this.target,rounds:this.rounds,round:this.round,turn:this.turn,first:this.first,finished:this.finished,end:this.end,winners:[...this.winners],players:this.players.map(p=>({...p})),last:this.last&&{...this.last}};}
}

/** Reihenfolge ab dem Beginner (für Rangliste bei Gleichstand). */
export function rankPlayers(s:MatchState){const n=s.players.length,order=(i:number)=>(i-s.first+n)%n;return s.players.map((_,i)=>i).sort((a,b)=>s.players[b].score-s.players[a].score||order(a)-order(b));}

/** Prüft einen empfangenen Spielstand (Fernbedienung) grob auf Plausibilität. */
export function readMatchState(v:unknown):MatchState|null{
 if(!v||typeof v!=='object')return null;const s=v as MatchState;
 if(!isMatchMode(s.mode)||!Array.isArray(s.players)||s.players.length<MIN_PLAYERS||s.players.length>MAX_PLAYERS)return null;
 if(!s.players.every(p=>p&&typeof p.name==='string'&&Number.isFinite(p.score)&&Number.isFinite(p.throws)))return null;
 if(!Number.isInteger(s.turn)||s.turn<0||s.turn>=s.players.length||!Array.isArray(s.winners))return null;
 if(!Number.isInteger(s.first)||s.first<0||s.first>=s.players.length)return null;
 return s;
}
