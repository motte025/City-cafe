/**
 * Croupier-Stimme wie im französischen Casino: „Dix-sept, noir, impair et manque.“
 * Zahl, Farbe, gerade/ungerade und niedrig/hoch auf Französisch (fr-FR-Stimme), Spielinfos danach auf Deutsch.
 * Dazu „Rien ne va plus“ kurz nach dem Abwurf und „Faites vos jeux“ vor dem nächsten Wurf.
 * Läuft über die Sprachausgabe des Browsers; fehlt eine passende Stimme, bleibt es still.
 */
const FR=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf','vingt'];
export function numberFr(n:number){if(n<=20)return FR[n];const t=n>=30?'trente':'vingt',u=n%10;return u===0?t:u===1?`${t} et un`:`${t}-${FR[u]}`;}
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
/** Klassische Ansage: „Dix-sept, noir, impair et manque.“ – Zéro ohne Zusätze. */
export function croupierCall(n:number){if(n===0)return 'Zéro.';const w=numberFr(n);return `${w[0].toUpperCase()}${w.slice(1)}, ${RED.has(n)?'rouge':'noir'}, ${n%2?'impair':'pair'} et ${n<=18?'manque':'passe'}.`;}
export const PHRASES={spin:'Rien ne va plus.',bets:'Faites vos jeux, Mesdames et Messieurs.'};
type Line={text:string;lang:'fr'|'de';delay?:number};
const voices:{fr:SpeechSynthesisVoice|null;de:SpeechSynthesisVoice|null}={fr:null,de:null};
function pick(){try{const all=speechSynthesis.getVoices();
 // Bevorzugt männliche, natürliche Stimmen (Croupier), sonst die erste passende.
 const best=(lang:string,male:RegExp)=>{const l=all.filter(v=>v.lang.toLowerCase().startsWith(lang));return l.find(v=>male.test(v.name)&&/Natural|Online|Google/i.test(v.name))??l.find(v=>male.test(v.name))??l.find(v=>/Natural|Online|Google/i.test(v.name))??l[0]??null;};
 voices.fr=best('fr',/Paul|Henri|Claude|Thomas|Remy|Rémy|Denis|Mathieu|Male|Homme/i);voices.de=best('de',/Stefan|Conrad|Killian|Florian|Male|Mann/i);}catch{}}
if(typeof speechSynthesis!=='undefined'){pick();speechSynthesis.addEventListener?.('voiceschanged',pick);}
let timers:number[]=[];
/** Spricht die Zeilen nacheinander; eine neue Ansage bricht die alte ab. */
export function say(lines:Line[],volume=1){
 if(typeof speechSynthesis==='undefined')return;
 for(const t of timers)clearTimeout(t);timers=[];try{speechSynthesis.cancel();}catch{}
 let wait=0;for(const line of lines){wait+=line.delay??0;const run=()=>{try{const u=new SpeechSynthesisUtterance(line.text);u.lang=line.lang==='fr'?'fr-FR':'de-DE';const v=voices[line.lang];if(v)u.voice=v;
  // Ruhig und tief wie am Tisch; die französische Zahl etwas getragener.
  u.rate=line.lang==='fr'?.82:.95;u.pitch=.82;u.volume=Math.max(0,Math.min(1,volume));speechSynthesis.speak(u);}catch{}};
  if(wait>0)timers.push(window.setTimeout(run,wait));else run();}
}
