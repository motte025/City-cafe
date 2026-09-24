import {DEFAULT_TV,tvProjection,type TVSettings} from './tv-projection';
import type {Wheel} from './wheel';

export function mountTV(wheel:Wheel){
 let settings={...DEFAULT_TV},enabled=false;
 try{const saved=JSON.parse(localStorage.getItem('atelier-tv-settings')||'null');if(saved)for(const key of Object.keys(settings) as (keyof TVSettings)[]){if(typeof saved[key]===typeof settings[key])(settings as unknown as Record<string,unknown>)[key]=saved[key];}}catch{}
 const toggle=document.createElement('button');toggle.id='tv-toggle';toggle.className='icon-button';toggle.textContent='TV-Ansicht';toggle.setAttribute('aria-pressed','false');document.querySelector('.header-right')!.prepend(toggle);
 const controls=document.createElement('div');controls.className='tv-controls';controls.innerHTML='<button id="tv-bets" class="icon-button" aria-expanded="false">Setzfeld</button><button id="tv-calibrate" class="icon-button">Bild einstellen</button><button id="tv-fullscreen" class="icon-button">Vollbild</button>';document.body.append(controls);
 const bar=document.createElement('div');bar.className='tv-bottom';bar.innerHTML='<span id="tv-status" role="status"></span><button id="tv-spin" class="spin">Drehen ↗</button>';document.body.append(bar);
 const dialog=document.createElement('dialog');dialog.className='tv-dialog';dialog.id='tv-settings';
 dialog.innerHTML=`<div class="tv-dialog-heading"><h2>Ihr Platz vor dem TV</h2><button id="tv-close" class="icon-button" aria-label="TV-Einstellungen schließen">✕</button></div><p>Die Kamera blickt senkrecht auf das Rad. Die Korrektur gleicht den Blick von unten auf einen senkrecht montierten 16:9-Fernseher aus.</p>
 <div class="tv-fields"><label>Bildschirmdiagonale <span>Zoll</span><input id="tv-diagonal" type="number" min="24" max="120" step="1"></label><label>Unterkante über dem Boden <span>Meter</span><input id="tv-bottom-height" type="number" min="0" max="4" step="0.05"></label><label>Abstand zum Bildschirm <span>Meter</span><input id="tv-distance" type="number" min="1" max="10" step="0.1"></label><label>Augenhöhe über dem Boden <span>Meter</span><input id="tv-eye-height" type="number" min="0.5" max="2.2" step="0.05"></label></div>
 <label class="tv-check"><input id="tv-correction" type="checkbox"> Blickwinkelkorrektur einschalten</label><output id="tv-info"></output><p class="tv-note">Voreinstellung: 55 Zoll, Unterkante 2 m, Abstand 3,5 m, sitzende Augenhöhe 1,2 m. Im Vollbild und mittig vor dem TV beurteilen. Für andere Sitzplätze kann die Wirkung abweichen.</p><button id="tv-defaults" class="text-button">Ihre Ausgangswerte wiederherstellen</button>`;
 document.body.append(dialog);
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
 const fields:[keyof Omit<TVSettings,'correction'>,string][]=[['diagonal','tv-diagonal'],['bottomHeight','tv-bottom-height'],['distance','tv-distance'],['eyeHeight','tv-eye-height']];
 function writeFields(){for(const[key,id]of fields)$<HTMLInputElement>(id).value=String(settings[key]);$<HTMLInputElement>('tv-correction').checked=settings.correction;}
 function update(){
  for(const[key,id]of fields){const input=$<HTMLInputElement>(id);const value=Number(input.value);if(input.value!==''&&Number.isFinite(value)&&input.validity.valid)settings[key]=value;}
  settings.correction=$<HTMLInputElement>('tv-correction').checked;
  const p=tvProjection(settings);$('tv-info').textContent=`Bildschirmmitte ${(settings.bottomHeight+p.height/2).toFixed(2).replace('.',',')} m · Blickwinkel ${p.angle.toFixed(1).replace('.',',')}°`;
  try{localStorage.setItem('atelier-tv-settings',JSON.stringify(settings));}catch{}
  wheel.setTV(enabled,settings);
 }
 function activate(value:boolean){enabled=value;document.body.classList.toggle('tv-mode',value);toggle.setAttribute('aria-pressed',String(value));toggle.textContent=value?'Normale Ansicht':'TV-Ansicht';if(!value){document.body.classList.remove('tv-bets-open');$('tv-bets').setAttribute('aria-expanded','false');}try{localStorage.setItem('atelier-tv-enabled',String(value));}catch{}update();}
 toggle.onclick=()=>activate(!enabled);
 $('tv-calibrate').onclick=()=>dialog.showModal();$('tv-close').onclick=()=>dialog.close();
 $('tv-bets').onclick=()=>{$('tv-bets').setAttribute('aria-expanded',String(document.body.classList.toggle('tv-bets-open')));};
 $('tv-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('tv-status').textContent='Vollbild bitte über den Browser aktivieren.';}};
 document.addEventListener('fullscreenchange',()=>{$('tv-fullscreen').textContent=document.fullscreenElement?'Vollbild verlassen':'Vollbild';wheel.setTV(enabled,settings);});
 $('tv-spin').onclick=()=>{$<HTMLButtonElement>('spin').click();document.body.classList.remove('tv-bets-open');$('tv-bets').setAttribute('aria-expanded','false');};
 $('tv-defaults').onclick=()=>{settings={...DEFAULT_TV};writeFields();update();};
 dialog.addEventListener('input',update);
 const sync=()=>{$<HTMLButtonElement>('tv-spin').disabled=$<HTMLButtonElement>('spin').disabled;$('tv-status').textContent=$('status').textContent;$('tv-spin').textContent=document.body.classList.contains('spinning')?'Kugel läuft …':'Drehen ↗';};
 new MutationObserver(sync).observe($('spin'),{attributes:true,childList:true,subtree:true});new MutationObserver(sync).observe($('status'),{childList:true,subtree:true,characterData:true});
 writeFields();update();sync();let savedMode=false;try{savedMode=localStorage.getItem('atelier-tv-enabled')==='true';}catch{}
 if(new URLSearchParams(location.search).has('tv')||savedMode)activate(true);
}
