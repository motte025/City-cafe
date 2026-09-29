import type {Settings} from './settings';
/**
 * Einstellungen in aufklappbaren Gruppen (Fernbedienung und TV-Dialog). Alle Gruppen starten
 * eingeklappt – am Handy sieht man zuerst nur die Überschriften und öffnet, was man braucht.
 */
export function settingsForm(){const group=(title:string,body:string,note='')=>`<details class="picture-settings"><summary>${title}</summary><div class="settings-grid">${body}</div>${note}</details>`;return [
 group('🔊 Ton',`${field('effects','Kugel & Aufpraller','%',0,1,.05)}${field('ambience','Hintergrundgeräusch','%',0,1,.05)}
 <label class="switch"><input type="checkbox" data-setting="muted" data-invert> Ton an</label>
 <label class="switch"><input type="checkbox" data-setting="announce"> Zahlenansage (Croupier-Stimme)</label>`),
 group('⏱ Tempo',`${field('delay','Normal · Pause vor dem Abwurf','s',3,60,1)}${field('duration','Normal · Dauer der Kugelrunde','s',12,25,1)}${field('durationSpread','Normal · Abweichung ±','s',0,5,.5)}
 ${field('matchDelay','Spielmodus · Pause vor dem Abwurf','s',3,60,1)}${field('matchDuration','Spielmodus · Dauer der Kugelrunde','s',12,25,1)}${field('matchSpread','Spielmodus · Abweichung ±','s',0,5,.5)}`,
 '<p>Normaler Zyklus und Spielmodus haben ein eigenes Tempo.</p>'),
 group('⚪ Kugel & Einlauf',`${field('ballDiameter','Kugeldurchmesser','mm',18,21,1)}${field('ballMass','Trägheit · Gewichtsreferenz','g',5.3,10.5,.1)}${field('ballBounce','Sprungstärke','%',.5,1.4,.05)}
 ${field('pocketRunMin','Einlauf min. Taschen','',3,20,1)}${field('pocketRunMax','Einlauf max. Taschen','',3,20,1)}
 ${field('deflectorResistanceRadial','Rauten radial · Widerstand','%',0,100,5)}${field('deflectorResistanceTangential','Rauten tangential · Widerstand','%',0,100,5)}${field('ballGloss','Kugel · Glanz','%',0,1,.05)}`,
 '<p>Ab dem nächsten Wurf. Einlauf = Taschen, die die Kugel ab dem Taschenkranz noch wandert. Rauten-Widerstand 0 % = verlustfreier Abprall, 100 % = kein Rückprall.</p>'),
 group('🎡 Kessel · Form & Licht',`${field('cameraTilt','Blickwinkel · 0° = von oben','°',0,32,1)}${field('bowlDepth','3D-Tiefe','%',.85,1.45,.05)}
 ${field('numberSlope','Gefälle des Zahlenkranzes','°',8,28,1)}${field('fretHeight','Steghöhe der Taschen · früher 27 mm','mm',11,25,.5)}${field('numberSize','Zahlen auf dem Kessel','%',.85,1.08,.01)}
 ${field('gloss','Glanz & Reflexionen','%',0,1,.05)}${field('lightContrast','Lichtkontrast','%',0,1,.05)}${field('lightPlay','Lichtspiel · wandernde Spiegelung','%',0,1,.05)}
 ${field('metalWarmth','Metall · Silber bis Gold','%',0,1,.05)}${field('fretBrass','Stege der Taschen · Chrom bis Messing','%',0,1,.05)}${field('fretGloss','Stege der Taschen · matt bis Glanz','%',0,1,.05)}${field('diamondBrass','Rauten · Chrom bis Messing','%',0,1,.05)}${field('diamondGloss','Rauten · matt bis Glanz','%',0,1,.05)}${field('pocketRichness','Taschen · Farbstärke','%',0,1,.05)}
 <label class="switch"><input type="checkbox" data-setting="pocketGlow"> Gewinnfach leuchtet auf</label>
 <label class="switch"><input type="checkbox" data-setting="goldNumbers"> Zahlen in Gold</label>`,
 '<p data-design-note>Form und Zahlen ändern sich nach einem laufenden Wurf. Blickwinkel, Licht und Texte reagieren sofort.</p>'),
 group('🪵 Holz',`${choice('woodOuter','Holzart · Außenrand',WOODS)}${choice('woodTrack','Holzart · Kugellaufbahn',WOODS)}${choice('woodInner','Holzart · Innenkessel',WOODS)}
 ${field('woodWarmth','Holz · dunkel bis warm','%',0,1,.05)}${field('grainTrack','Kugellaufbahn · Maserung','%',0,1,.05)}${field('grainInner','Innenkessel · Maserung','%',0,1,.05)}
 ${field('outerTone','Außenrand · dunkel bis hell','%',.15,1.4,.05)}${field('trackTone','Kugellaufbahn · dunkel bis hell','%',.15,1.4,.05)}${field('innerTone','Innenkessel · dunkel bis hell','%',.15,1.4,.05)}
 ${field('outerGloss','Außenrand · matt bis glänzend','%',0,1,.05)}${field('innerGloss','Innenkessel · matt bis glänzend','%',0,1,.05)}`),
 group('✨ Schrift & Mittelkreuz',`<label class="setting-field"><span>Text vorne im Kessel</span><input type="text" maxlength="48" data-setting="frontText" aria-label="Text vorne im Kessel" placeholder="leer = kein Text"></label>
 <label class="switch"><input type="checkbox" data-setting="centerLogo"> Emblem „City Cafe · Fischl“</label>
 ${choice('crossStyle','Mittelkreuz · Design',['Klassisch','Stern (8 Arme)','Krone','Schlicht (Kappe)','City Cafe (Medaillon)'])}${field('brass','Mittelkreuz · Chrom bis Messing','%',0,1,.05)}`),
 group('📺 TV-Bild & Darstellung',`${field('brightness','Helligkeit','',.65,1.4,.05)}${field('zoom','Kesselgröße · 100 % = volle Höhe','%',.75,1.15,.01)}${field('wheelX','Kessel verschieben · links ↔ rechts','%',-.2,.2,.01)}${field('wheelY','Kessel verschieben · hoch ↕ runter','%',-.15,.15,.01)}${field('panelWidth','Tafel · Breite (Spielmodus)','%',.7,1.3,.05)}${field('panelHeight','Tafel · Höhe (Spielmodus)','%',.6,1.1,.05)}${field('textScale','TV-Texte vergrößern','%',.85,1.3,.05)}${field('feltBackground','Filz-Hintergrund','%',0,1,.05)}
 <label class="switch"><input type="checkbox" data-setting="cinematic"> Kamerafahrt beim Einlaufen · Zeitlupe beim entscheidenden Wurf</label>
 <label class="switch"><input type="checkbox" data-setting="economy"> Sparsame Darstellung (TV-Box)</label>${field('renderScale','3D-Auflösung im Sparmodus','%',.5,1,.05)}
 <label class="switch"><input type="checkbox" data-setting="correction"> TV-Blickwinkel korrigieren</label>
 ${field('diagonal','Bildschirm','Zoll',24,120,1,'number')}${field('bottomHeight','Unterkante','m',0,4,.05,'number')}${field('distance','Abstand','m',1,10,.1,'number')}${field('eyeHeight','Augenhöhe','m',.5,2.2,.05,'number')}`,
 '<p>Voreinstellung: 55 Zoll · Unterkante 2 m · Abstand 3,5 m · Augenhöhe 1,2 m.</p>'),
 '<button type="button" data-design-reset>Design zurücksetzen</button>'].join('\n');}
const WOODS=['Mahagoni','Nussbaum','Kirsche','Ebenholz','Ahorn'];
function choice(key:string,label:string,options:string[]){return `<label class="setting-field"><span>${label}</span><select data-setting="${key}" aria-label="${label}">${options.map((o,i)=>`<option value="${i}">${o}</option>`).join('')}</select></label>`;}
function field(key:string,label:string,unit:string,min:number,max:number,step:number,type='range'){return `<label class="setting-field"><span>${label}<output data-value="${key}"></output></span><input type="${type}" min="${min}" max="${max}" step="${step}" data-setting="${key}" data-unit="${unit}" aria-label="${label}"></label>`;}
export function fillSettings(root:HTMLElement,settings:Settings){root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>{const key=input.dataset.setting as keyof Settings,value=settings[key];if(document.activeElement!==input){if(input.type==='checkbox')input.checked=Boolean(value)!==input.hasAttribute('data-invert');else input.value=String(value);}const output=root.querySelector<HTMLOutputElement>(`[data-value="${key}"]`);if(output){const numeric=Number(value);output.textContent=input.dataset.unit==='%'?`${Math.round(numeric*100)} %`:`${numeric.toLocaleString('de-DE',{maximumFractionDigits:2})} ${input.dataset.unit}`;}});}
export function settingsPatch(event:Event){const input=event.target as HTMLInputElement;if(!input.matches('[data-setting]'))return null;if(input.type!=='checkbox'&&input.type!=='text'&&(!input.validity.valid||input.value===''))return null;return {[input.dataset.setting!]:input.type==='checkbox'?input.checked!==input.hasAttribute('data-invert'):input.type==='text'?input.value:Number(input.value)} as Partial<Settings>;}
export const roundButtons=()=>[30,10,12,50,100,200,null].map(n=>`<button data-rounds="${n??'infinite'}" class="round-preset">${n??'∞'}<span>${n===null?'unendlich':n===30?'Standard':'Runden'}</span></button>`).join('');
