/**
 * Zahlenansage wie am Tisch („Siebzehn, schwarz“) über die Sprachausgabe des Browsers.
 * Kostet nichts und braucht keinen Dienst; fehlt auf einem Gerät eine deutsche Stimme, bleibt es still.
 */
import {color} from './game';
const WORDS=['Zéro','Eins','Zwei','Drei','Vier','Fünf','Sechs','Sieben','Acht','Neun','Zehn','Elf','Zwölf','Dreizehn','Vierzehn','Fünfzehn','Sechzehn','Siebzehn','Achtzehn','Neunzehn','Zwanzig'];
export function numberWord(n:number){if(n<=20)return WORDS[n];const u=n%10,t=n>=30?'dreißig':'zwanzig';return u===0?t[0].toUpperCase()+t.slice(1):`${u===1?'Ein':WORDS[u]}und${t}`;}
export function announcement(n:number,extra=''){const c=color(n);return `${numberWord(n)}${n===0?'':c==='red'?', rot':', schwarz'}${extra?`. ${extra}`:''}.`;}
let voice:SpeechSynthesisVoice|null=null;
function pick(){try{const all=speechSynthesis.getVoices().filter(v=>/^de/i.test(v.lang));voice=all.find(v=>/Google|Natural|Online/i.test(v.name))??all[0]??null;}catch{voice=null;}}
if(typeof speechSynthesis!=='undefined'){pick();speechSynthesis.addEventListener?.('voiceschanged',pick);}
export function speak(text:string,volume=1){
 if(typeof speechSynthesis==='undefined')return;
 try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='de-DE';if(voice)u.voice=voice;u.rate=.92;u.pitch=.95;u.volume=Math.max(0,Math.min(1,volume));speechSynthesis.speak(u);}catch{}
}
