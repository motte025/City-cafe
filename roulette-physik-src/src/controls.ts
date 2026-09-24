import type {Settings} from './settings';
export function settingsForm(){return `<div class="settings-grid">
 ${field('delay','Pause vor dem Abwurf','s',3,60,1)}
 <p>Die Kugel bestimmt Laufdauer und Ergebnis durch ihre Bewegung. Es gibt keine Zielzahl.</p>
 ${field('effects','Kugel & Aufpraller','%',0,1,.05)}${field('ambience','Hintergrundgeräusch','%',0,1,.05)}
 <label class="switch"><input type="checkbox" data-setting="muted"> Gesamten Ton stummschalten</label></div>
 <label class="switch"><input type="checkbox" data-setting="economy"> Sparsame Darstellung</label><p class="helper">Für die TV-Box: weniger Renderaufwand, weichere Schatten. Schrift bleibt scharf.</p>
 <div class="settings-grid">${field('renderScale','3D-Auflösung im Sparmodus','%',.5,1,.05)}</div>
 <details class="picture-settings" open><summary>Kugel &amp; Einlauf</summary><div class="settings-grid">
 ${field('launchSpeed','Abwurfgeschwindigkeit','m/s',1.8,3.2,.1)}${field('ballDiameter','Kugeldurchmesser','mm',18,21,1)}${field('ballMass','Kugelmasse','g',5.3,10.5,.1)}${field('ballBounce','Rückprall · Material','%',.5,1.4,.05)}
 ${field('diamondRadialResistance','Rauten längs · Widerstand','%',0,1,.05)}${field('diamondTangentialResistance','Rauten quer · Widerstand','%',0,1,.05)}${field('pocketRun','Nachlauf maximal','Taschen',5,20,1)}
 </div><p>Die beiden Rautenregler steuern den Energieverlust getrennt für längs und quer ausgerichtete Rauten. 0 % lässt die Kugel fast ungebremst abprallen, 100 % bremst stark. Der Nachlauf wird bei jedem Wurf neu zwischen 5 und dem eingestellten Maximum gewählt.</p></details>
 <details class="picture-settings" open><summary>Kessel-Design & Lesbarkeit</summary><div class="settings-grid">
 ${field('cameraTilt','Blickwinkel · 0° = genau von oben','°',0,32,1)}${field('bowlDepth','3D-Tiefe','%',.85,1.45,.05)}
 ${field('numberSlope','Gefälle des Zahlenkranzes','°',8,28,1)}${field('numberSize','Zahlen auf dem Kessel','%',.85,1.08,.01)}
 ${field('woodWarmth','Holz · dunkel bis warm','%',0,1,.05)}${field('metalWarmth','Metall · Silber bis Gold','%',0,1,.05)}
 ${field('gloss','Glanz & Reflexionen','%',0,1,.05)}${field('lightContrast','Lichtkontrast','%',0,1,.05)}
 ${field('textScale','TV-Texte vergrößern','%',.85,1.3,.05)}
 ${field('innerTone','Innenkessel · dunkel bis hell','%',.15,1.4,.05)}${field('outerTone','Außenrand · dunkel bis hell','%',.15,1.4,.05)}
 ${field('trackTone','Kugellaufbahn · dunkel bis hell','%',.15,1.4,.05)}${field('pocketRichness','Taschen · Farbstärke','%',0,1,.05)}
 ${field('innerGloss','Innenkessel · matt bis glänzend','%',0,1,.05)}${field('outerGloss','Außenrand · matt bis glänzend','%',0,1,.05)}
 </div><p data-design-note>Form und Zahlen ändern sich vor dem nächsten Abwurf. Blickwinkel, Licht und Texte reagieren sofort.</p><button type="button" data-design-reset>Design zurücksetzen</button></details>
 <details class="picture-settings"><summary>TV-Bild & Perspektive</summary><div class="settings-grid">
 ${field('brightness','Helligkeit','',.65,1.4,.05)}${field('zoom','Radgröße','',.75,1.15,.01)}
 <label class="switch"><input type="checkbox" data-setting="correction"> TV-Blickwinkel korrigieren</label>
 ${field('diagonal','Bildschirm','Zoll',24,120,1,'number')}${field('bottomHeight','Unterkante','m',0,4,.05,'number')}${field('distance','Abstand','m',1,10,.1,'number')}${field('eyeHeight','Augenhöhe','m',.5,2.2,.05,'number')}
 </div><p>Voreinstellung: 55 Zoll · Unterkante 2 m · Abstand 3,5 m · Augenhöhe 1,2 m. Korrektur im Vollbild vom Sitzplatz aus beurteilen.</p></details>`;}
function field(key:string,label:string,unit:string,min:number,max:number,step:number,type='range'){return `<label class="setting-field"><span>${label}<output data-value="${key}"></output></span><input type="${type}" min="${min}" max="${max}" step="${step}" data-setting="${key}" data-unit="${unit}" aria-label="${label}"></label>`;}
export function fillSettings(root:HTMLElement,settings:Settings){root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>{const key=input.dataset.setting as keyof Settings,value=settings[key];if(document.activeElement!==input){if(input.type==='checkbox')input.checked=Boolean(value);else input.value=String(value);}const output=root.querySelector<HTMLOutputElement>(`[data-value="${key}"]`);if(output){const numeric=Number(value);output.textContent=input.dataset.unit==='%'?`${Math.round(numeric*100)} %`:`${numeric.toLocaleString('de-DE',{maximumFractionDigits:2})} ${input.dataset.unit}`;}});}
export function settingsPatch(event:Event){const input=event.target as HTMLInputElement;if(!input.matches('[data-setting]'))return null;if(input.type!=='checkbox'&&(!input.validity.valid||input.value===''))return null;return {[input.dataset.setting!]:input.type==='checkbox'?input.checked:Number(input.value)} as Partial<Settings>;}
export const roundButtons=()=>[12,10,30,50,100,200,null].map(n=>`<button data-rounds="${n??'infinite'}" class="round-preset">${n??'∞'}<span>${n===null?'unendlich':n===12?'Standard':'Runden'}</span></button>`).join('');
