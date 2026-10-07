import {Wheel} from './wheel';import {DEFAULT_DESIGN} from './wheel-shape';import {Sound} from './audio';import {Cycle} from './cycle';import {PlaybackClock,ORDER,color,randomIndex} from './game';import {Relay} from './relay';import {DEFAULT_SETTINGS,applySettings,type Settings,type State,type Command} from './settings';import {settingsForm,fillSettings,settingsPatch,presetPatch,roundButtons} from './controls';import {Match,randomBelow,MATCH_ROUNDS,readMatchState,cleanName,isKo,type MatchState} from './match';import {say,croupierCall,PHRASES} from './voice';import {Celebration} from './celebration';import {ChipScene} from './chips';import QRCode from 'qrcode';
export function startDisplay(){
 const params=new URLSearchParams(location.search),room=/^[a-zA-Z0-9_-]{1,64}$/.test(params.get('raum')||'')?params.get('raum')!:'city-cafe';
 document.body.classList.add('display-page');const app=document.querySelector<HTMLElement>('#app')!;
 app.innerHTML=`<div class="felt-layer"></div><div id="wheel" class="scene"></div><div class="display-vignette"></div><header class="show-header"><div class="show-brand chips-box"><canvas id="chips-bank" class="chips" aria-label="Jetons der Bank"></canvas></div><div class="live-mark"><i></i> LIVE AM TISCH</div><nav><button id="audio-unlock">♫ Ton aktivieren</button><button id="pair">Handy verbinden</button><button id="settings-open" aria-label="Einstellungen">⚙</button><button id="fullscreen" aria-label="Vollbild">⛶</button></nav></header>
 <aside class="cycle-panel"><div class="eyebrow" id="timer-label">NÄCHSTER ABWURF</div><div class="count-ring" id="count-ring"><strong id="seconds">8</strong><span id="timer-unit">SEKUNDEN</span></div><div class="cycle-divider"></div><div class="eyebrow">DIESER ZYKLUS</div><div class="remaining"><strong id="remaining">30</strong><span>RUNDEN<br>ÜBRIG</span></div><p id="round-progress">0 von 30 gespielt</p><div class="cycle-actions"><button id="pause">Ⅱ Pausieren</button><button id="start-default">↻ 30 Runden</button></div></aside>
 <aside class="match-panel" id="match-panel" hidden><div class="match-head"><div><div class="eyebrow" id="match-eyebrow">SPIELMODUS</div><strong id="match-mode"></strong></div><div class="match-right"><div id="match-timer" class="match-timer">0:00</div><div id="match-round"></div></div></div><div class="match-turn" id="match-turn"></div><table class="match-table"><thead><tr id="match-columns"></tr></thead><tbody id="match-rows"></tbody></table><p class="match-last" id="match-last"></p></aside>
 <aside class="result-panel"><div class="eyebrow">LETZTE GEWINNZAHL</div><div id="latest" class="latest empty-result">—</div><div id="latest-color">Das Spiel beginnt.</div><div class="result-rule"></div><div class="eyebrow">AM KESSEL</div><p id="throw-info">Erster Abwurf bei Null</p><p class="connection" id="connection"></p></aside>
 <div class="table-message" id="message" role="status">Die nächste Kugel startet automatisch.</div><footer class="result-strip"><span>LETZTE 10<br>ZAHLEN</span><div id="history"></div><span id="room-label" hidden></span><div class="chips-box chips-table-box"><canvas id="chips-table" class="chips" aria-label="City-Cafe-Jetons am Tisch"></canvas></div></footer>
 <dialog id="settings-dialog"><div class="dialog-title"><h2>Croupier-Einstellungen</h2><button data-close="settings-dialog" aria-label="Schließen">✕</button></div><div class="preset-grid">${roundButtons()}</div><p class="helper">Eine laufende Kugelrunde wird immer zu Ende gespielt.</p>${settingsForm()}</dialog>
 <dialog id="pair-dialog"><div class="dialog-title"><h2>Ihre Fernbedienung</h2><button data-close="pair-dialog" aria-label="Schließen">✕</button></div><canvas id="qr"></canvas><p>Mit dem Handy scannen. In der City-cafe-Fernbedienung den Reiter <b>Roulette</b> wählen.</p><a id="remote-link" target="_blank" rel="noopener">Fernbedienung öffnen ↗</a><p class="helper" id="pair-room"></p></dialog>`;
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
 const service=document.createElement('div');service.className='service-actions';service.append($('audio-unlock'),$('pair'));$('settings-dialog').append(service);
 let settings={...DEFAULT_SETTINGS};if(params.has('kiosk'))settings.economy=true;try{settings=applySettings(settings,JSON.parse(localStorage.getItem('atelier-show-settings')||'null'));}catch{}
 // Retire the previous continuous noise bed once, including saved TV settings.
 try{if(!localStorage.getItem('atelier-audio-v2')){settings.ambience=0;localStorage.setItem('atelier-audio-v2','1');}}catch{settings.ambience=0;}
 try{if(!localStorage.getItem('atelier-audio-v3')){settings.ambience=.35;localStorage.setItem('atelier-audio-v3','1');}}catch{settings.ambience=.35;}
 // Kessel füllt seit 27.09.2026 den Raum zwischen den Linien; alte Radgröße einmalig auf 100 %.
 try{if(!localStorage.getItem('atelier-fit-v1')){settings.zoom=1;localStorage.setItem('atelier-fit-v1','1');}}catch{}
 // Schnelleres Tempo (27.09.2026): einmalig 4 s Pause und 12 s Kugelrunde, auch bei gespeicherten Einstellungen.
 try{if(!localStorage.getItem('atelier-tempo-v1')){settings.delay=4;settings.duration=12;localStorage.setItem('atelier-tempo-v1','1');}}catch{settings.delay=4;settings.duration=12;}
 if(params.has('eco'))settings.economy=params.get('eco')!=='0';
 const cycle=new Cycle(),sound=new Sound(),relay=new Relay('tv'),session=crypto.randomUUID();let wheel:Wheel;
 let chipScene:ChipScene|null=null;
 let pendingMatch:{mode:Match['mode'];players:number;rounds?:number|null;names?:string[]}|null=null;let fitKey='',matchStart=0,matchEnd=0;let match:Match|null=null,matchSpin:number|null=null,matchKey='',drawElapsed=0,drawTick=0;const DRAW_MS=2800;
 /** Das zuletzt beendete Spiel bleibt gespeichert (auch nach Neuladen) – die Fernbedienung zeigt es samt Wurf-Historie. */
 let lastMatch:{match:MatchState;start:number;end:number}|null=null;
 try{const v=JSON.parse(localStorage.getItem('atelier-last-match')||'null');const m=readMatchState(v?.match);if(m&&Number.isFinite(v.start)&&Number.isFinite(v.end))lastMatch={match:m,start:v.start,end:v.end};}catch{}
 function saveLastMatch(m:Match){lastMatch={match:m.state(),start:matchStart,end:matchEnd};try{localStorage.setItem('atelier-last-match',JSON.stringify(lastMatch));}catch{}}
 /** Elegante Trennlinie in der Tafel nach der 4. und 9. Zeile (Gruppen zum schnelleren Lesen). */const SEP_AFTER=[4,9],SEP_ROW='<tr class="sep" aria-hidden="true"><td colspan="6"></td></tr>';/** Nach der letzten Kugel so lange warten, bis die Siegerfeier erscheint. */const CELEBRATE_DELAY=4000;const DEFAULT_ROUNDS=30,celebration=new Celebration(app,180,()=>{if(!match?.finished)return;match=null;matchSpin=null;applyTempo();cycle.start(DEFAULT_ROUNDS);render();});
 let nextIndex:number|null=null,planKey='',tickInfo:{dt:number;before:number}|null=null,lastCountdown=NaN,lastCounting=false;let message='',throwInfo='Erster Abwurf bei 0 · Kessel ↻ · Kugel ↺',lastCommand='',lastHistory='',lastBroadcast=0,lastPaint=0;
 try{wheel=new Wheel($('wheel'));}catch{$('message').textContent='Dieser Browser benötigt WebGL 2. Bitte Hardwarebeschleunigung aktivieren.';return;}
 // Pause, Rundendauer und Abweichung getrennt für normalen Zyklus und Spielmodus.
 function tempo(){return match?{delay:settings.matchDelay,duration:settings.matchDuration,spread:settings.matchSpread}:{delay:settings.delay,duration:settings.duration,spread:settings.durationSpread};}
 function applyTempo(){const t=tempo();if(cycle.delay!==t.delay)cycle.setDelay(t.delay);if(wheel&&(wheel.durationSetting!==t.duration||wheel.durationSpread!==t.spread)){wheel.durationSetting=t.duration;wheel.durationSpread=t.spread;planKey='';replan();}}
 function configure(patch:unknown){settings=applySettings(settings,patch);applyTempo();wheel.setPerformance(settings.economy,settings.renderScale,settings.supersample);wheel.setDesign(settings);wheel.ballDiameter=settings.ballDiameter;wheel.ballMass=settings.ballMass;wheel.ballBounce=settings.ballBounce;wheel.ballRunMin=settings.pocketRunMin;wheel.ballRunMax=settings.pocketRunMax;wheel.deflectorResistanceRadial=settings.deflectorResistanceRadial;wheel.deflectorResistanceTangential=settings.deflectorResistanceTangential;replan();wheel.zoom=settings.zoom;wheel.cinematic=false;/* Kamerafahrt/Zeitlupe aus (gefiel nicht) */wheel.setTV(true,settings);wheel.renderer.toneMappingExposure=1.02*settings.brightness;document.body.style.setProperty('--tv-text-scale',String(settings.textScale));document.body.style.setProperty('--felt',String(settings.feltBackground));chipScene?.setTilt(settings.cameraTilt);document.body.style.setProperty('--panel-w',String(settings.panelWidth));document.body.style.setProperty('--panel-h',String(settings.panelHeight));sound.configure(settings.effects,settings.ambience,settings.muted);if(typeof layoutWheel==='function')requestAnimationFrame(()=>layoutWheel());fillSettings($('settings-dialog'),settings);try{localStorage.setItem('atelier-show-settings',JSON.stringify(settings));}catch{}}
 configure(settings);
 chipScene=new ChipScene($<HTMLCanvasElement>('chips-bank'),$<HTMLCanvasElement>('chips-table'));chipScene.setTilt(settings.cameraTilt);
 function command(cmd:Command){if(!cmd||typeof cmd!=='object')return;switch(cmd.action){case 'start':pendingMatch=null;cycle.start(cmd.rounds);break;case 'pause':cycle.pause();break;case 'resume':cycle.resume();break;case 'stop':cycle.stop();break;case 'now':cycle.spinNow();break;case 'settings':configure(cmd.patch);break;
  // Spielmodus: Zyklus ohne Ende, der Computer dreht reihum. Eine gerade laufende Kugel zählt noch nicht mit.
  // Rollt gerade eine Kugel, keine neue mehr einsetzen; das Spiel beginnt erst, wenn sie liegt.
  case 'match':if(cycle.active!==null){pendingMatch={mode:cmd.mode,players:cmd.players,rounds:cmd.rounds,names:cmd.names};cycle.pause();}else startMatch(cmd.mode,cmd.players,cmd.rounds,cmd.names);break;
  // Namen während des Spiels ändern (Tippfehler, Nachzügler) – Punkte und Reihenfolge bleiben.
  case 'names':if(match&&Array.isArray(cmd.names)){match.players.forEach((p,i)=>{if(i<cmd.names.length)p.name=cleanName(cmd.names[i],i);});matchKey='';fitKey='';}break;
  case 'matchEnd':if(pendingMatch){pendingMatch=null;cycle.resume();}if(!match)break;match=null;matchSpin=null;celebration.hide();applyTempo();cycle.start(DEFAULT_ROUNDS);break;}render();}
 function snapshot():State{return {session,phase:cycle.phase,seconds:Math.ceil(cycle.countdown),remaining:cycle.remaining,total:cycle.total,completed:cycle.completed,history:[...cycle.history],message:statusText(),throwInfo,settings,audioReady:sound.ready,lastCommand,running:cycle.running||celebration.active,designPending:wheel.designPending,match:match?.state()??null,lastMatch,tv:tvInfo()};}
 function tvInfo(){const pn=$('match-panel'),cs=getComputedStyle(pn);return {w:innerWidth,h:innerHeight,dpr:Math.round((devicePixelRatio||1)*100)/100,font:pn.hidden?0:Math.round(parseFloat(cs.fontSize)*10)/10,fit:Number(cs.getPropertyValue('--fit'))||0,ua:navigator.userAgent.slice(0,160),gl:wheel.bufferInfo(),eco:settings.economy};}
 function statusText(){if(pendingMatch)return 'Spielmodus startet, sobald die Kugel liegt.';if(match){const p=match.players[match.turn].name;if(match.finished)return `Spiel beendet · ${winnerText(match)}`;if(cycle.phase==='countdown')return `${p} ist dran · Abwurf in ${Math.ceil(cycle.countdown)} Sekunden`;if(cycle.phase==='spinning'&&matchSpin!==null)return `Die Kugel rollt für ${p}.`;}
  return cycle.phase==='countdown'?`Nächster Abwurf in ${Math.ceil(cycle.countdown)} Sekunden`:cycle.phase==='complete'?'Zyklus beendet. Bereit für die nächste Runde.':cycle.phase==='paused'?'Der Croupier pausiert.':message;}
 // Die Gewinnzahl wird zu Beginn des Countdowns gezogen (randomIndex, Web Crypto), damit die
 // Kugelbewegung währenddessen im Hintergrund physikalisch gesucht werden kann.
 function drawIndex(){const forced=import.meta.env.DEV&&params.has('dev')&&params.has('target')?Number(params.get('target')):NaN;return Number.isInteger(forced)&&forced>=0&&forced<=36?ORDER.indexOf(forced):randomIndex();}
 function replan(){if(nextIndex===null||!wheel||cycle.phase!=='countdown'||!cycle.running)return;const key=[settings.ballDiameter,settings.ballMass,settings.ballBounce,settings.pocketRunMin,settings.pocketRunMax,settings.deflectorResistanceRadial,settings.deflectorResistanceTangential,tempo().duration,tempo().spread,settings.bowlDepth,settings.numberSlope,settings.numberSize].join('/');if(key!==planKey){planKey=key;wheel.prepare(nextIndex,cycle.countdown);}}
 cycle.onSpin=id=>{matchSpin=match&&!match.finished?id:null;
  // „Rien ne va plus“, sobald die Kugel läuft.
  if(settings.announce&&!settings.muted)window.setTimeout(()=>{if(cycle.phase==='spinning')say([{text:PHRASES.spin,lang:'fr'}],Math.max(.5,settings.effects+.35));},2600);
  message='Rien ne va plus. Die Kugel rollt.';const index=nextIndex??drawIndex();nextIndex=null;const overshoot=tickInfo?Math.max(0,tickInfo.dt-tickInfo.before):undefined;wheel.spin(index,crypto.getRandomValues(new Uint8Array(1))[0]%3,overshoot);};
 wheel.onPhase=p=>{message=p<0?'Richtungswechsel. Die nächste Kugel wird eingesetzt.':p===0?'Rien ne va plus. Die Kugel rollt.':p===1?'Die Kugel springt in den Zahlenkranz.':'Die Kugel pendelt aus …';};
 wheel.onImpact=strength=>sound.impact(strength);wheel.onPose=(angle,progress)=>sound.update(angle,progress);wheel.onLaunch=(n,dir)=>{sound.roll();throwInfo=`Abwurf bei ${n} · Kessel ${dir===1?'↻':'↺'} · Kugel ${dir===1?'↺':'↻'}`;};
 wheel.onLand=index=>{const id=cycle.active;if(id===null)return;cycle.land(id,ORDER[index]);sound.stop();if(pendingMatch){const p=pendingMatch;pendingMatch=null;startMatch(p.mode,p.players,p.rounds,p.names);}let info='';if(match&&id===matchSpin){matchSpin=null;const r=match.record(ORDER[index]);const who=r?match.players[r.player].name:'';info=r?.win?`${who} macht aus!`:r?.bust?`Zu viel für ${who}.`:'';
   const ev=match.event,nm=(j:number)=>match!.players[j].name;
   if(ev)info=match.finished?(match.loser!==null?`${nm(ev.players[0])} ist in Sicherheit. ${nm(match.loser)} verliert!`:`${nm(ev.players[0])} scheidet aus. ${nm(match.winners[0])} gewinnt!`)
    :ev.kind==='tie'?`Gleichstand. Stechen zwischen ${ev.players.map(nm).join(' und ')}.`:ev.kind==='out'?`${nm(ev.players[0])} scheidet aus.`:`${nm(ev.players[0])} ist in Sicherheit.`;if(match.finished){matchEnd=Date.now();cycle.stop();saveLastMatch(match);const done=match;setTimeout(()=>{if(match===done)celebrate(done);},CELEBRATE_DELAY);}}message=`${ORDER[index]} · ${color(ORDER[index])==='red'?'Rot':color(ORDER[index])==='black'?'Schwarz':'Grün'}`;
  // Croupier-Ansage kurz nach dem Liegenbleiben (nicht bei stummgeschaltetem Ton).
  if(settings.announce&&!settings.muted){const n=ORDER[index],lines:{text:string;lang:'fr'|'de';delay?:number}[]=[{text:croupierCall(n),lang:'fr',delay:500}];
   if(info)lines.push({text:info,lang:'de',delay:250});
   // Im normalen Zyklus mit genug Pause: „Faites vos jeux“ vor dem nächsten Wurf.
   if(!match&&tempo().delay>=7)lines.push({text:PHRASES.bets,lang:'fr',delay:2200});
   say(lines,Math.max(.5,settings.effects+.35));}
  render();void relay.send(snapshot());};
 function render(){const counting=cycle.phase==='countdown',spinning=cycle.phase==='spinning';$('seconds').textContent=counting?String(Math.ceil(cycle.countdown)):spinning?'•':cycle.phase==='complete'?'✓':'Ⅱ';$('timer-label').textContent=counting?'NÄCHSTER ABWURF':spinning?'KUGEL IST IM SPIEL':cycle.phase==='complete'?'ZYKLUS BEENDET':'PAUSIERT';$('timer-unit').textContent=counting?'SEKUNDEN':spinning?'RIEN NE VA PLUS':'';$('count-ring').style.setProperty('--progress',`${counting?cycle.countdown/tempo().delay*360:0}deg`);$('count-ring').classList.toggle('is-spinning',spinning);$('remaining').textContent=cycle.remaining===null?'∞':String(cycle.remaining);$('round-progress').textContent=cycle.total===null?`${cycle.completed} Runden gespielt`:`${cycle.completed} von ${cycle.total} gespielt`;$('pause').textContent=cycle.running?'Ⅱ Pausieren':'▶ Fortsetzen';$('message').textContent=statusText();$('throw-info').textContent=throwInfo;
  const h=cycle.history.join(',');if(h!==lastHistory){lastHistory=h;const n=cycle.history[0];if(n===undefined){$('latest').textContent='—';$('latest').className='latest empty-result';$('latest-color').textContent='Das Spiel beginnt.';$('history').innerHTML='';}else{$('latest').textContent=String(n);$('latest').className=`latest ${color(n)}`;$('latest-color').textContent=color(n)==='red'?'ROT':color(n)==='black'?'SCHWARZ':'ZERO';$('history').innerHTML=cycle.history.map((v,i)=>`<span class="history-number ${color(v)} ${i===0?'newest':''}">${v}</span>`).join('');}}
  renderMatch();
  $('audio-unlock').textContent=sound.error?sound.error:sound.ready?(settings.muted?'♫ Ton einschalten':'♫ Ton ausschalten'):'♫ Ton aktivieren';
 }
 // Wer beginnt, lost der Computer aus (Web Crypto); die Tafel zeigt dazu kurz eine Auslosung.
 function startMatch(mode:Match['mode'],players:number,rounds?:number|null,names?:string[]){
  const first=Number.isInteger(players)&&players>0?randomBelow(players):0;
  try{match=new Match(mode,players,rounds===undefined?(mode==='rounds'?MATCH_ROUNDS:null):rounds,first);}catch{return false;}
  if(Array.isArray(names))match.players.forEach((p,i)=>{p.name=cleanName(names[i],i);});fitKey='';
  matchSpin=null;matchKey='';drawElapsed=0;drawTick=0;cycle.history=[];celebration.hide();matchStart=Date.now();matchEnd=0;applyTempo();cycle.start(null);return true;
 }
 function celebrate(m:Match){
  if(m.end==='ko'){celebrateKo(m);return;}
  const rank=m.ranking(),names=m.winners.map(i=>m.players[i].name),best=m.players[m.winners[0]],tie=names.length>1,l=m.last;
  const w=m.players[m.winners[0]];
  const detail=m.end==='exact'?(tie?`Genau ${m.target} – ausgemacht in Runde ${m.round}.`:`Genau ${m.target}! Ausgemacht mit der ${w.finish??l?.number} in Runde ${m.round}.`)
   :m.target!==null?`Nach ${m.rounds} ${m.rounds===1?'Runde':'Runden'} am nächsten an ${m.target}: ${best.score} Punkte.`
   :`${best.score} Punkte nach ${m.rounds} ${m.rounds===1?'Runde':'Runden'}.`;
  celebration.show({title:tie?'GLEICHSTAND · GETEILTER SIEG':m.end==='exact'?`${m.target} · GENAU GETROFFEN`:'SIEGER',name:tie?names.join(' & '):`${names[0]} gewinnt!`,detail,
   podium:rank.slice(0,3).map(i=>({place:1+m.players.filter(p=>p.score>m.players[i].score).length,name:m.players[i].name,score:`${m.players[i].score} Punkte`})),
   table:rank.map(i=>({place:1+m.players.filter(p=>p.score>m.players[i].score).length,name:m.players[i].name,score:m.players[i].score,extra:m.target!==null?(m.players[i].out?'✓ aus':`noch ${m.target-m.players[i].score}`):`${m.players[i].throws} Runden`,winner:m.winners.includes(i)})),
   last:l?{number:l.number,color:color(l.number),by:m.players[l.player].name}:null,time:clockText(matchEnd-matchStart)},settings.economy);
 }
 function celebrateKo(m:Match){
  const rank=m.ranking(),l=m.last,lose=m.loser!==null,who=lose?m.players[m.loser!]:m.players[m.winners[0]];
  const row=(i:number)=>{const p=m.players[i];return {place:p.place??0,name:p.name,score:p.throws,extra:p.place===1&&!lose?'Sieger':lose&&i===m.loser?'Verlierer':m.mode==='ko'?`raus in R${p.ko}`:`sicher in R${p.ko}`,winner:lose?i===m.loser:m.winners.includes(i)};};
  celebration.show({title:lose?'K.O. · DER LETZTE VERLIERT':'K.O. · LETZTER IM SPIEL',name:lose?`${who.name} verliert`:`${who.name} gewinnt!`,detail:lose?`Als Letzter übrig nach ${m.round} Runden.`:`Nach ${m.round} Runden als Einziger übrig.`,
   podium:rank.slice(0,3).map(i=>({place:m.players[i].place??0,name:m.players[i].name,score:`Platz ${m.players[i].place}`})),
   table:rank.map(row),last:l?{number:l.number,color:color(l.number),by:m.players[l.player].name}:null,time:clockText(matchEnd-matchStart)},settings.economy);
 }
 // Tafel: Schrift nur so weit verkleinern, bis alle Spieler und Spalten sichtbar sind (jeder TV hat andere Maße).
 // Kessel: in voller Größe mittig zwischen rechtem Tafelrand und der Info-Spalte rechts.
 function layoutMatch(){
  const panel=$('match-panel');if(!match||panel.hidden){layoutWheel();return;}
  // Schriftgröße einmal je Spiel/Bildschirm festlegen – mit dem breitesten möglichen Inhalt, damit sie
  // während des Spiels nicht springt (vorher: bei jedem neuen Wert neu berechnet).
  const m=match,key=[m.players.length,m.mode,m.rounds,innerWidth,innerHeight,settings.textScale,settings.panelWidth,settings.panelHeight].join('/');
  if(key!==fitKey){fitKey=key;const rows=$('match-rows'),round=$('match-round'),keep=[rows.innerHTML,round.textContent];
   // Zusätzliche Zeilenhöhe der letzten Messung zuerst zurücknehmen – sonst schrumpft die Schrift bei jeder Neuberechnung weiter.
   panel.style.setProperty('--row-extra','0px');panel.style.removeProperty('--hfit');
   const longest=m.players.reduce((a,p)=>p.name.length>a.length?p.name:a,''),r=String(m.rounds??99),big=m.target??36*(m.rounds??10);
   rows.innerHTML=m.players.map((_,k)=>(isKo(m.mode)?`<tr class="turn lead"><td class="pl">${m.players.length}.</td><th>${longest} <span class="match-lead-star">★</span></th><td class="rnd"><span class="match-first">⚑</span>99</td><td><span class="match-chip red">36</span></td><td class="gap">Stechen</td></tr>`
    :`<tr class="turn lead"><td class="pl">${m.players.length}.</td><th>${longest} <span class="match-lead-star">★</span></th><td class="rnd"><span class="match-first">⚑</span>${r}</td><td>${big}</td><td class="gap noch">${m.target===null?'−':''}${big}</td>${m.target===null?'':'<td><span class="match-chip red">36</span></td>'}</tr>`)+(SEP_AFTER.includes(k+1)&&k+1<m.players.length?SEP_ROW:'')).join('');
   round.textContent=isKo(m.mode)?'Runde 99 · Stechen':m.rounds===null?'Runde 99':`Runde ${m.rounds} von ${m.rounds}`;
   // Größte Schrift suchen, bei der der breiteste mögliche Inhalt noch ganz hineinpasst (auch größer als 100 %,
   // z. B. bei wenigen Spielern oder schmaler, hoher Tafel). Obergrenze 160 %, damit 2 Spieler nicht riesig werden.
   const fits=(f:number)=>{panel.style.setProperty('--fit',f.toFixed(3));return panel.scrollHeight<=panel.clientHeight+1&&panel.scrollWidth<=panel.clientWidth+1;};
   const search=()=>{let lo=.3,hi=1.6;if(fits(hi))return hi;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid;}return lo;};
   // Spaltenköpfe groß (86 %) – sind sie aber bei schmaler Tafel der Engpass, werden nur die Köpfe kleiner, nicht die Werte.
   panel.style.setProperty('--hf','.86');let lo=search();
   panel.style.setProperty('--fit',(lo+.03).toFixed(3));const byWidth=panel.scrollWidth>panel.clientWidth+1;
   if(byWidth){panel.style.setProperty('--hf','.7');const lo2=search();if(lo2>lo+.01)lo=lo2;else panel.style.setProperty('--hf','.86');}
   panel.style.setProperty('--fit',lo.toFixed(3));
   const bar=$('match-turn'),barKeep=[bar.className,bar.innerHTML];bar.className='match-turn split';bar.innerHTML=`<span class="t-name">${longest}</span><span class="t-mid">Kugel rollt …</span><span class="t-time">Pause</span>`;
   // Kopf (Spielart, Runde, Uhr), goldener Balken und „Letzter Wurf“ eigenständig vergrößern: bei wenigen Spielern
   // begrenzt die Breite die Tabelle, darunter bleibt Platz – den nutzt der Kopf (höchstens 1,6-fach).
   panel.style.setProperty('--hfit',lo.toFixed(3));{let a=lo,b=lo*1.4;const ok=(h:number)=>{panel.style.setProperty('--hfit',h.toFixed(3));return panel.scrollHeight<=panel.clientHeight+1&&panel.scrollWidth<=panel.clientWidth+1;};
    if(ok(b))a=b;else for(let i=0;i<10;i++){const m=(a+b)/2;if(ok(m))a=m;else b=m;}panel.style.setProperty('--hfit',a.toFixed(3));}
   bar.className=barKeep[0];bar.innerHTML=barKeep[1];
   // Ist die Breite der Engpass, bleibt unten Platz: den gleichmäßig als Zeilenhöhe verteilen (höchstens +0,4 Schrifthöhen je Zeile).
   panel.style.setProperty('--row-extra','0px');
   const fpx=parseFloat(getComputedStyle(panel).fontSize)||16,tb=panel.querySelector('.match-table')!.getBoundingClientRect(),lt=$('match-last').getBoundingClientRect();
   const free=lt.top-tb.bottom-fpx*.9,extra=Math.max(0,Math.min(free/(m.players.length*2),fpx*.4));
   panel.style.setProperty('--row-extra',`${extra.toFixed(1)}px`);if(panel.scrollHeight>panel.clientHeight+1)panel.style.setProperty('--row-extra','0px');
   rows.innerHTML=keep[0];round.textContent=keep[1];}
  layoutWheel();
 }
 // Kessel: oben bis knapp unter die Linie der Kopfzeile; im Spielmodus zusätzlich mittig zwischen Tafel und rechter Info-Spalte.
 function layoutWheel(){
  // Kessel füllt den Raum zwischen oberer und unterer Linie (Radgröße 100 % = genau dazwischen) und
  // steht mittig zwischen linker Spalte (Tafel bzw. Countdown) und rechter Info-Spalte.
  const top=document.querySelector<HTMLElement>('.show-header')!.getBoundingClientRect().bottom,strip=document.querySelector<HTMLElement>('.result-strip')!.getBoundingClientRect(),bottom=strip.height>0?strip.top:innerHeight,gap=6;
  const panel=$('match-panel'),leftEl=match&&!panel.hidden?panel:document.querySelector<HTMLElement>('.cycle-panel')!,lr=leftEl.getBoundingClientRect(),left=lr.width>0?lr.right:0;
  const info=document.querySelector<HTMLElement>('.result-panel')!.getBoundingClientRect(),right=info.width>0?info.left:innerWidth;
  for(let i=0;i<3;i++){const b=wheel.rimBounds(),scale=Math.min((bottom-top-2*gap)/(b.bottom-b.top),(right-left-2*gap)/(b.right-b.left))*settings.zoom;if(Math.abs(scale-1)<.004)break;wheel.setFit(wheel.fit*scale);}
  const b=wheel.rimBounds(),y=Math.round((top+bottom)/2-(b.top+b.bottom)/2),x=match&&!panel.hidden?Math.round((left+right)/2-(b.left+b.right)/2):0;
  const dx=x+Math.round(settings.wheelX*innerWidth);
  document.body.style.setProperty('--wheel-x',`${dx}px`);document.body.style.setProperty('--wheel-y',`${y+Math.round(settings.wheelY*innerHeight)}px`);
  // „Live am Tisch“ folgt der Kesselmitte, egal wie Spiel-Tafel, Verschiebung oder Radgröße sie verlegen.
  const header=document.querySelector<HTMLElement>('.show-header')!,mark=header.querySelector<HTMLElement>('.live-mark');
  if(mark)mark.style.left=`${Math.round((b.left+b.right)/2+dx-header.getBoundingClientRect().left)}px`;
 }
 addEventListener('resize',()=>{matchKey='';render();});void document.fonts?.ready.then(()=>{matchKey='';fitKey='';render();});
 function clockText(ms:number){const t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),mi=Math.floor(t/60)%60,se=t%60;return h?`${h}:${String(mi).padStart(2,'0')}:${String(se).padStart(2,'0')}`:`${mi}:${String(se).padStart(2,'0')}`;}
 function winnerText(m:Match){if(m.end==='ko'&&m.loser!==null)return `${m.players[m.loser].name} verliert`;const names=m.winners.map(i=>m.players[i].name);return names.length>1?`Gleichstand: ${names.join(', ')}`:`${names[0]} gewinnt!`;}
 // Anzeige links: nur sichtbar, solange über die Fernbedienung ein Spiel läuft.
 function renderMatch(){
  document.body.classList.toggle('match-on',!!match);$('match-panel').hidden=!match;if(!match){layoutMatch();return;}
  const m=match,x01=m.target!==null,counting=cycle.phase==='countdown'&&cycle.running,current=m.players[m.turn].name;
  // Auslosung: das Licht läuft reihum, wird langsamer und bleibt beim Beginner stehen.
  // Nur gezeichnete Bilder zählen (je höchstens 120 ms), damit die Auslosung auch auf einer langsamen Box ganz zu sehen ist.
  const now=performance.now();if(drawTick)drawElapsed+=Math.min(120,now-drawTick);drawTick=now;
  const drawT=Math.min(1,drawElapsed/DRAW_MS),drawing=drawT<1&&m.last===null,n=m.players.length,steps=2*n+m.first,lit=drawing?Math.floor(steps*(1-(1-drawT)**3))%n:m.turn;
  // Nach einer Landung bleibt der Werfer markiert (mit seinem Ergebnis); erst mit dem nächsten Abwurf wechselt die Anzeige.
  const rolling=cycle.phase==='spinning'&&matchSpin!==null,l=m.last,hold=!drawing&&!m.finished&&!rolling&&l!==null,shown=drawing?lit:hold?l!.player:m.turn,secs=`${Math.ceil(cycle.countdown)} s`;
  // Goldener Balken: Name links, Zahl bzw. Zustand in der Mitte, Countdown rechts – mit viel Abstand, gut lesbar.
  const bar=$('match-turn'),parts=drawing?null:m.finished?null:rolling?[current,'Kugel rollt …','']
   :hold?[m.players[l!.player].name,`<span class="match-chip ${color(l!.number)}">${l!.number}</span>${l!.win?' ausgemacht!':l!.bust?' zu viel':''}`,counting?secs:'Pause']
   :[current,'beginnt',counting?secs:'Pause'];
  bar.classList.toggle('split',!!parts);
  if(parts)bar.innerHTML=`<span class="t-name"></span><span class="t-mid">${parts[1]}</span><span class="t-time"></span>`,bar.querySelector('.t-name')!.textContent=parts[0],bar.querySelector('.t-time')!.textContent=parts[2];
  else bar.textContent=drawing?'Auslosung: Wer beginnt?':`★ ${winnerText(m)} ★`;
  $('match-turn').classList.toggle('winner',m.finished);$('match-timer').textContent=`⏱ ${clockText((matchEnd||Date.now())-matchStart)}`;
  $('match-turn').classList.toggle('drawing',drawing);
  const key=JSON.stringify(m.state())+shown+drawing;if(key===matchKey)return;matchKey=key;
  $('match-panel').style.setProperty('--rows',String(m.players.length));
  const ko=isKo(m.mode),alive=m.players.filter(p=>!p.out).length;
  $('match-eyebrow').textContent=ko?(m.mode==='ko'?'K.O. · LETZTER GEWINNT':'K.O. · LETZTER VERLIERT'):x01?'GENAU TREFFEN':'MEISTE PUNKTE';$('match-mode').textContent=ko?`${alive} im Spiel`:x01?String(m.target):`${m.rounds} Runden`;
  $('match-round').textContent=ko?`Runde ${m.round}${m.tie&&!m.finished?' · Stechen':''}`:m.rounds===null?`Runde ${m.round}`:`Runde ${m.round} von ${m.rounds}`;
  $('match-columns').innerHTML=ko?'<th class="pl">Pl.</th><th>Spieler</th><th>Runde</th><th>Wurf</th><th class="gap">Status</th>':x01?'<th class="pl">Pl.</th><th>Spieler</th><th>Runde</th><th>Punkte</th><th class="gap">Noch</th><th>Aus mit</th>':'<th class="pl">Pl.</th><th>Spieler</th><th>Runde</th><th>Punkte</th><th class="gap">Abstand</th>';
  const best=Math.max(...m.players.map(p=>p.score));
  // Live-Tabelle: nach aktuellem Stand sortiert (Gleichstand = gleicher Platz, dann Spielernummer);
  // wer den Platz wechselt, gleitet sichtbar an die neue Stelle.
  const rowsEl=$('match-rows'),before=new Map(Array.from(rowsEl.querySelectorAll<HTMLElement>('tr[data-p]')).map(r=>[r.dataset.p!,r.getBoundingClientRect().top]));
  const order=ko?m.ranking():m.players.map((_,i)=>i).sort((a,b)=>m.players[b].score-m.players[a].score||a-b);
  const aliveFirst=m.mode==='ko'?1:m.players.filter(q=>q.out).length+1;
  // Mit echten Namen fehlt die Reihenfolge, die "Spieler 1, 2, 3" verrieten: Wurf-Nummer ab dem Beginner und ▸ für den nächsten Werfer.
  // Steht nach einer Landung noch der Werfer im Balken, ist m.turn schon der Nächste.
  const next=drawing||m.finished?null:hold?m.turn:m.upNext();
  rowsEl.innerHTML=order.map(i=>{const p=m.players[i],place=ko?(p.place??aliveFirst):1+m.players.filter(q=>q.score>p.score).length;
   const turn=!m.finished&&i===shown,won=m.winners.includes(i),out=x01?m.checkout(i):null,lead=!ko&&!m.finished&&best>0&&p.score===best,pts=String(p.score);
   const rnd=`<td class="rnd">${i===m.first&&!drawing?'<span class="match-first" title="Hat das Spiel begonnen">⚑</span>':''}${p.throws}</td>`;
   const inPool=(m.pool??[]).includes(i),status=p.out?(m.mode==='ko'?`raus · R${p.ko}`:`sicher · R${p.ko}`):m.finished?(m.mode==='ko'?'Sieger':'Verlierer'):m.tie?(inPool?'Stechen':'wartet'):'im Spiel';
   const cells=ko?`${rnd}<td>${p.cur!=null?`<span class="match-chip ${color(p.cur)}">${p.cur}</span>`:p.prev!=null?`<span class="match-chip prev ${color(p.prev)}">${p.prev}</span>`:'<span class="match-none">—</span>'}</td><td class="gap ko-status ${p.out?(m.mode==='ko'?'is-out':'is-safe'):m.tie&&inPool?'is-tie':''}">${status}</td>`
    :x01?`${rnd}<td>${pts}</td><td class="gap noch">${m.needed(i)}</td><td>${p.out?'<span class="match-out">✓ aus</span>':out===null?'<span class="match-none">—</span>':`<span class="match-chip ${color(out)}">${out}</span>`}</td>`
    :`${rnd}<td>${pts}</td><td class="gap">${best-p.score===0?(best>0?'<span class="match-lead">Führt</span>':'<span class="match-none">—</span>'):`−${best-p.score}`}</td>`;
   return `<tr data-p="${i}" class="${turn?'turn':''} ${won?'won':''} ${lead&&!ko?'lead':''} ${drawing&&turn?'draw':''} ${ko&&p.out&&m.mode==='ko'?'gone':''} ${ko&&m.finished&&m.loser===i?'loser':''} ${i===next?'next':''}"><td class="pl">${place}.</td><th><span class="match-next" title="Kommt als Nächstes">${i===next?'▸':''}</span><span class="match-seat" title="Wurf-Reihenfolge">${(i-m.first+n)%n+1}</span>${won?'★ ':''}${p.name}${lead?' <span class="match-lead-star">★</span>':''}</th>${cells}</tr>`;}).map((row,k)=>row+(SEP_AFTER.includes(k+1)&&k+1<m.players.length?SEP_ROW:'')).join('');
  for(const r of Array.from(rowsEl.querySelectorAll<HTMLElement>('tr[data-p]'))){const old=before.get(r.dataset.p!);if(old===undefined)continue;const dy=old-r.getBoundingClientRect().top;if(Math.abs(dy)>2)r.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:700,easing:'cubic-bezier(.2,.8,.2,1)'});}
  const ev=m.event,evText=ev?(ev.kind==='tie'?`Stechen: ${ev.players.map(j=>m.players[j].name).join(', ')}`:ev.kind==='out'?`${m.players[ev.players[0]].name} scheidet aus`:`${m.players[ev.players[0]].name} ist in Sicherheit`):'';
  $('match-last').innerHTML=ko&&l?`Letzter Wurf: ${m.players[l.player].name} · <span class="match-chip ${color(l.number)}">${l.number}</span>${evText?` · <b>${evText}</b>`:''}`:l?`Letzter Wurf: ${m.players[l.player].name} · <span class="match-chip ${color(l.number)}">${l.number}</span> ${l.win?(m.finished?'· ausgemacht!':'· ausgemacht! Runde wird fertig gespielt'):l.bust?'· zählt nicht':''}`:'Der Computer dreht reihum. <span class="match-first-legend">⚑ hat begonnen · ▸ kommt als Nächstes</span>';
  layoutMatch();
 }
 $('pause').onclick=()=>command({action:cycle.running?'pause':'resume'});$('start-default').onclick=()=>command({action:'start',rounds:DEFAULT_ROUNDS});
 $('settings-open').onclick=()=>{fillSettings($('settings-dialog'),settings);$<HTMLDialogElement>('settings-dialog').showModal();};document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>$<HTMLDialogElement>(b.dataset.close!).close());
 document.querySelectorAll<HTMLButtonElement>('[data-rounds]').forEach(b=>b.onclick=()=>{command({action:'start',rounds:b.dataset.rounds==='infinite'?null:Number(b.dataset.rounds)});$<HTMLDialogElement>('settings-dialog').close();});
 $('settings-dialog').oninput=event=>{const patch=presetPatch(event)??settingsPatch(event);if(patch){configure(patch);fillSettings($('settings-dialog'),settings);}};
 document.querySelector<HTMLButtonElement>('[data-design-reset]')!.onclick=()=>configure(DEFAULT_DESIGN);
 // Ton ist Standard: sofort freigeben, wenn der Browser es erlaubt (Kiosk/App), sonst bei der ersten Bedienung irgendwo am TV.
 async function audioOn(){if(sound.ready)return;try{await sound.unlock();}catch{return;}if(!sound.ready)return;configure(settings);if(wheel.motion)sound.roll(wheel.rollProgress);render();}
 void audioOn();for(const type of ['pointerdown','keydown','touchstart'])addEventListener(type,event=>{if(!(event.target as Element|null)?.closest?.('#audio-unlock'))void audioOn();},{capture:true});
 $('audio-unlock').onclick=async()=>{if(!sound.ready){try{await sound.unlock();}catch{sound.error='Tonfreigabe fehlgeschlagen. Bitte erneut versuchen.';}configure(settings);if(wheel.motion)sound.roll(wheel.rollProgress);}else configure({muted:!settings.muted});render();};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message='Vollbild bitte über den Browser aktivieren.';}};
 const remoteUrl=`https://motte025.github.io/City-cafe/fernbedienung.html?teil=roulette&raum=${encodeURIComponent(room)}`;$<HTMLAnchorElement>('remote-link').href=remoteUrl;$('room-label').textContent='CITY CAFE';$('pair-room').textContent=`Screen: ${room}`;
 $('pair').onclick=()=>{$<HTMLDialogElement>('pair-dialog').showModal();void QRCode.toCanvas($<HTMLCanvasElement>('qr'),remoteUrl,{width:240,margin:2,color:{dark:'#10221b',light:'#f1e8ce'}});};
 // Nur melden, wenn etwas nicht stimmt - „Fernbedienung bereit“ stand sonst dauernd am TV.
 relay.onConnection=online=>{$('connection').textContent=online?'':'○ Fernbedienung offline';if(online)void relay.send(snapshot());};
 relay.onMessage=(body,id)=>{if(!body||typeof body!=='object')return;const b=body as {session?:string;command?:Command};if(b.session!==session||!b.command)return;lastCommand=id;command(b.command);void relay.send(snapshot());};
 void relay.connect(room);
 // Countdown-Überschuss im auslösenden Bild wird an den Kessel weitergereicht (exakte Abwurflage).
 const dev=import.meta.env.DEV&&params.has('dev'),debug=dev?document.createElement('pre'):null;
 // Nur Entwicklungsserver: Befehle wie von der Fernbedienung (für Browser-Tests).
 if(dev)Object.assign(window,{rouletteCommand:command});
 // Zum Testen ohne Handy: ?testspiel=x301&spieler=4&runden=10&punkte=280
 // (runden=0 → unbegrenzt; punkte = Startpunkte je Spieler, damit das Ende schnell kommt).
 if(params.has('testspiel')){const r=params.get('runden'),mode=params.get('testspiel') as Match['mode'];
  if(startMatch(mode,Number(params.get('spieler'))||2,r===null?undefined:Number(r)===0?null:Number(r))){const m=match as Match|null,start=Math.max(0,Math.floor(Number(params.get('punkte'))||0));if(m)for(const p of m.players)p.score=m.target===null?start:Math.min(start,m.target-1);}}
 if(dev&&params.has('slow'))wheel.timeScale=Math.max(.05,Math.min(1,Number(params.get('slow'))||.25));
 if(debug){debug.className='ball-debug';debug.style.cssText='position:fixed;left:12px;bottom:72px;z-index:50;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#f3e7c4;font:13px/1.35 ui-monospace,monospace;border-radius:6px;pointer-events:none;white-space:pre';document.body.append(debug);}
 const clock=new PlaybackClock();function frame(time:number){
  const dt=clock.tick(time,!document.hidden),before=cycle.countdown,changed=before!==lastCountdown||(cycle.phase==='countdown'&&cycle.running)!==lastCounting;
  const hold=!!match&&match.last===null&&drawElapsed<DRAW_MS;tickInfo={dt:hold?0:dt,before};cycle.tick(hold?0:dt);tickInfo=null;
  const counting=cycle.phase==='countdown'&&cycle.running;
  if(counting&&(nextIndex===null||changed)){if(nextIndex===null)nextIndex=drawIndex();planKey='';replan();}
  lastCountdown=cycle.countdown;lastCounting=counting;
  if(debug)debug.textContent=wheel.debugInfo()+(nextIndex!==null&&counting?`\nnächste Zahl (nur Dev): ${ORDER[nextIndex]}`:'');
  if(time-lastPaint>90){render();lastPaint=time;}if(time-lastBroadcast>1000){lastBroadcast=time;void relay.send(snapshot());}requestAnimationFrame(frame);}requestAnimationFrame(frame);
 document.addEventListener('visibilitychange',()=>{clock.reset();if(document.hidden)sound.stop(true);else if(wheel.motion)sound.roll(wheel.rollProgress);});render();
}

