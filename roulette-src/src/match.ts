/**
 * Spielmodus: mehrere Spieler, der Computer dreht reihum für jeden.
 *
 * Die Kugel entscheidet allein: jede Landung wird dem Spieler gutgeschrieben,
 * der gerade dran ist. Dieses Modul zieht keine Zahlen und kennt die nächste
 * Zahl nicht – es zählt nur mit (Ergebnis kommt weiterhin aus randomIndex()).
 *
 * - „Runden“: jeder Spieler bekommt so viele Würfe wie gewählt (Standard 10), die Zahlen werden addiert,
 *   am Ende gewinnt die höchste Summe (Gleichstand: mehrere Sieger).
 * - „301“/„501“: wer als Erster genau auf 301 bzw. 501 kommt, gewinnt sofort.
 *   Eine Zahl, die über das Ziel hinausführt, zählt nicht („überworfen“).
 *   Ab 36 fehlenden Punkten gibt es genau eine Zahl, die ausmacht.
 */
export type MatchMode='rounds'|'x301'|'x501';
export const MATCH_MODES:MatchMode[]=['rounds','x301','x501'];
export const MIN_PLAYERS=2,MAX_PLAYERS=10,MATCH_ROUNDS=10,MIN_ROUNDS=1,MAX_ROUNDS=50;
export const ROUND_PRESETS=[3,5,10,15,20,30];
export const modeLabel=(m:MatchMode)=>m==='rounds'?'Runden':m==='x301'?'301':'501';
export const modeTarget=(m:MatchMode)=>m==='x301'?301:m==='x501'?501:null;
export const isMatchMode=(v:unknown):v is MatchMode=>MATCH_MODES.includes(v as MatchMode);

export interface MatchPlayer {name:string;score:number;throws:number}
export interface MatchThrow {player:number;number:number;counted:boolean;bust:boolean;win:boolean}
export interface MatchState {mode:MatchMode;target:number|null;rounds:number|null;round:number;turn:number;finished:boolean;winners:number[];players:MatchPlayer[];last:MatchThrow|null}

export class Match {
 readonly target:number|null;readonly players:MatchPlayer[];readonly rounds:number|null;
 turn=0;round=1;finished=false;winners:number[]=[];last:MatchThrow|null=null;
 constructor(readonly mode:MatchMode,count:number,rounds=MATCH_ROUNDS){
  if(!isMatchMode(mode)||!Number.isInteger(count)||count<MIN_PLAYERS||count>MAX_PLAYERS)throw new Error('Ungültiger Spielmodus');
  this.target=modeTarget(mode);
  if(this.target===null&&(!Number.isInteger(rounds)||rounds<MIN_ROUNDS||rounds>MAX_ROUNDS))throw new Error('Ungültige Rundenzahl');
  this.rounds=this.target===null?rounds:null;
  this.players=Array.from({length:count},(_,i)=>({name:`Spieler ${i+1}`,score:0,throws:0}));
 }
 /** Punkte, die dem Spieler noch fehlen (nur 301/501). */
 needed(i:number){return this.target===null?null:this.target-this.players[i].score;}
 /** Die eine Zahl, die das Spiel beendet – nur wenn höchstens 36 fehlen. */
 checkout(i:number){const n=this.needed(i);return n!==null&&n>=1&&n<=36?n:null;}
 /** Landung für den Spieler, der gerade dran ist. */
 record(number:number){
  if(this.finished||!Number.isInteger(number)||number<0||number>36)return null;
  const i=this.turn,p=this.players[i];p.throws++;
  let counted=true,bust=false,win=false;
  if(this.target!==null){
   const rest=this.target-p.score;
   if(number>rest){counted=false;bust=true;}
   else{p.score+=number;if(number===rest){win=true;this.finished=true;this.winners=[i];}}
  }else p.score+=number;
  this.last={player:i,number,counted,bust,win};
  if(!this.finished)this.advance();
  return this.last;
 }
 private advance(){
  this.turn=(this.turn+1)%this.players.length;
  if(this.turn!==0)return;
  if(this.rounds!==null&&this.round>=this.rounds){
   this.finished=true;const best=Math.max(...this.players.map(p=>p.score));
   this.winners=this.players.flatMap((p,i)=>p.score===best?[i]:[]);return;
  }
  this.round++;
 }
 state():MatchState{return {mode:this.mode,target:this.target,rounds:this.rounds,round:this.round,turn:this.turn,finished:this.finished,winners:[...this.winners],players:this.players.map(p=>({...p})),last:this.last&&{...this.last}};}
}

/** Prüft einen empfangenen Spielstand (Fernbedienung) grob auf Plausibilität. */
export function readMatchState(v:unknown):MatchState|null{
 if(!v||typeof v!=='object')return null;const s=v as MatchState;
 if(!isMatchMode(s.mode)||!Array.isArray(s.players)||s.players.length<MIN_PLAYERS||s.players.length>MAX_PLAYERS)return null;
 if(!s.players.every(p=>p&&typeof p.name==='string'&&Number.isFinite(p.score)&&Number.isFinite(p.throws)))return null;
 if(!Number.isInteger(s.turn)||s.turn<0||s.turn>=s.players.length||!Array.isArray(s.winners))return null;
 return s;
}
