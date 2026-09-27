import {Wheel} from './wheel';import {DEFAULT_DESIGN} from './wheel-shape';import {Sound} from './audio';import {Cycle} from './cycle';import {PlaybackClock,ORDER,color,randomIndex} from './game';import {Relay} from './relay';import {DEFAULT_SETTINGS,applySettings,type Settings,type State,type Command} from './settings';import {settingsForm,fillSettings,settingsPatch,roundButtons} from './controls';import {Match,randomBelow,MATCH_ROUNDS} from './match';import {Celebration} from './celebration';import QRCode from 'qrcode';
export function startDisplay(){
 const params=new URLSearchParams(location.search),room=/^[a-zA-Z0-9_-]{1,64}$/.test(params.get('raum')||'')?params.get('raum')!:'city-cafe';
 document.body.classList.add('display-page');const app=document.querySelector<HTMLElement>('#app')!;
 app.innerHTML=`<div id="wheel" class="scene"></div><div class="display-vignette"></div><header class="show-header"><div class="show-brand"><span class="brand-seal">A</span><div>ATELIER<small>EUROPEAN ROULETTE</small></div></div><div class="live-mark"><i></i> LIVE AM TISCH</div><nav><button id="audio-unlock">♫ Ton aktivieren</button><button id="pair">Handy verbinden</button><button id="settings-open" aria-label="Einstellungen">⚙</button><button id="fullscreen" aria-label="Vollbild">⛶</button></nav></header>
 <aside class="cycle-panel"><div class="eyebrow" id="timer-label">NÄCHSTER ABWURF</div><div class="count-ring" id="count-ring"><strong id="seconds">8</strong><span id="timer-unit">SEKUNDEN</span></div><div class="cycle-divider"></div><div class="eyebrow">DIESER ZYKLUS</div><div class="remaining"><strong id="remaining">30</strong><span>RUNDEN<br>ÜBRIG</span></div><p id="round-progress">0 von 30 gespielt</p><div class="cycle-actions"><button id="pause">Ⅱ Pausieren</button><button id="start-default">↻ 30 Runden</button></div></aside>
 <aside class="match-panel" id="match-panel" hidden><div class="match-head"><div><div class="eyebrow" id="match-eyebrow">SPIELMODUS</div><strong id="match-mode"></strong></div><div id="match-round"></div></div><div class="match-turn" id="match-turn"></div><table class="match-table"><thead><tr id="match-columns"></tr></thead><tbody id="match-rows"></tbody></table><p class="match-last" id="match-last"></p></aside>
 <aside class="result-panel"><div class="eyebrow">LETZTE GEWINNZAHL</div><div id="latest" class="latest empty-result">—</div><div id="latest-color">Das Spiel beginnt.</div><div class="result-rule"></div><div class="eyebrow">AM KESSEL</div><p id="throw-info">Erster Abwurf bei Null</p><p class="connection" id="connection">Fernbedienung wird verbunden …</p></aside>
 <div class="table-message" id="message" role="status">Die nächste Kugel startet automatisch.</div><footer class="result-strip"><span>LETZTE 10<br>ZAHLEN</span><div id="history"></div><span id="room-label"></span></footer>
 <dialog id="settings-dialog"><div class="dialog-title"><h2>Croupier-Einstellungen</h2><button data-close="settings-dialog" aria-label="Schließen">✕</button></div><div class="preset-grid">${roundButtons()}</div><p class="helper">Eine laufende Kugelrunde wird immer zu Ende gespielt.</p>${settingsForm()}</dialog>
 <dialog id="pair-dialog"><div class="dialog-title"><h2>Ihre Fernbedienung</h2><button data-close="pair-dialog" aria-label="Schließen">✕</button></div><canvas id="qr"></canvas><p>Mit dem Handy scannen. In der City-cafe-Fernbedienung den Reiter <b>Roulette</b> wählen.</p><a id="remote-link" target="_blank" rel="noopener">Fernbedienung öffnen ↗</a><p class="helper" id="pair-room"></p></dialog>`;
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;
 const service=document.createElement('div');service.className='service-actions';service.append($('audio-unlock'),$('pair'));$('settings-dialog').append(service);
 let settings={...DEFAULT_SETTINGS};if(params.has('kiosk'))settings.economy=true;try{settings=applySettings(settings,JSON.parse(localStorage.getItem('atelier-show-settings')||'null'));}catch{}
 // Retire the previous continuous noise bed once, including saved TV settings.
 try{if(!localStorage.getItem('atelier-audio-v2')){settings.ambience=0;localStorage.setItem('atelier-audio-v2','1');}}catch{settings.ambience=0;}
 try{if(!localStorage.getItem('atelier-audio-v3')){settings.ambience=.35;localStorage.setItem('atelier-audio-v3','1');}}catch{settings.ambience=.35;}
 // Schnelleres Tempo (27.09.2026): einmalig 4 s Pause und 12 s Kugelrunde, auch bei gespeicherten Einstellungen.
 try{if(!localStorage.getItem('atelier-tempo-v1')){settings.delay=4;settings.duration=12;localStorage.setItem('atelier-tempo-v1','1');}}catch{settings.delay=4;settings.duration=12;}
 if(params.has('eco'))settings.economy=params.get('eco')!=='0';
 const cycle=new Cycle(),sound=new Sound(),relay=new Relay('tv'),session=crypto.randomUUID();let wheel:Wheel;
 let match:Match|null=null,matchSpin:number|null=null,matchKey='',drawElapsed=0,drawTick=0;const DRAW_MS=2800;const DEFAULT_ROUNDS=30,celebration=new Celebration(app,180,()=>{if(!match?.finished)return;match=null;matchSpin=null;cycle.start(DEFAULT_ROUNDS);render();});
 let nextIndex:number|null=null,planKey='',tickInfo:{dt:number;before:number}|null=null,lastCountdown=NaN,lastCounting=false;let message='',throwInfo='Erster Abwurf bei 0 · Kessel ↻ · Kugel ↺',lastCommand='',lastHistory='',lastBroadcast=0,lastPaint=0;
 try{wheel=new Wheel($('wheel'));}catch{$('message').textContent='Dieser Browser benötigt WebGL 2. Bitte Hardwarebeschleunigung aktivieren.';return;}
 function configure(patch:unknown){settings=applySettings(settings,patch);if(cycle.delay!==settings.delay)cycle.setDelay(settings.delay);wheel.setPerformance(settings.economy,settings.renderScale);wheel.setDesign(settings);wheel.ballDiameter=settings.ballDiameter;wheel.ballMass=settings.ballMass;wheel.ballBounce=settings.ballBounce;wheel.durationSetting=settings.duration;wheel.durationSpread=settings.durationSpread;wheel.ballRunMin=settings.pocketRunMin;wheel.ballRunMax=settings.pocketRunMax;wheel.deflectorResistanceRadial=settings.deflectorResistanceRadial;wheel.deflectorResistanceTangential=settings.deflectorResistanceTangential;replan();wheel.zoom=settings.zoom;wheel.setTV(true,settings);wheel.renderer.toneMappingExposure=1.02*settings.brightness;document.body.style.setProperty('--tv-text-scale',String(settings.textScale));sound.configure(settings.effects,settings.ambience,settings.muted);fillSettings($('settings-dialog'),settings);try{localStorage.setItem('atelier-show-settings',JSON.stringify(settings));}catch{}}
 configure(settings);
 function command(cmd:Command){if(!cmd||typeof cmd!=='object')return;switch(cmd.action){case 'start':cycle.start(cmd.rounds);break;case 'pause':cycle.pause();break;case 'resume':cycle.resume();break;case 'stop':cycle.stop();break;case 'now':cycle.spinNow();break;case 'settings':configure(cmd.patch);break;
  // Spielmodus: Zyklus ohne Ende, der Computer dreht reihum. Eine gerade laufende Kugel zählt noch nicht mit.
  case 'match':startMatch(cmd.mode,cmd.players,cmd.rounds);break;
  case 'matchEnd':if(!match)break;match=null;matchSpin=null;celebration.hide();cycle.start(DEFAULT_ROUNDS);break;}render();}
 function snapshot():State{return {session,phase:cycle.phase,seconds:Math.ceil(cycle.countdown),remaining:cycle.remaining,total:cycle.total,completed:cycle.completed,history:[...cycle.history],message:statusText(),throwInfo,settings,audioReady:sound.ready,lastCommand,running:cycle.running||celebration.active,designPending:wheel.designPending,match:match?.state()??null};}
 function statusText(){if(match){const p=match.players[match.turn].name;if(match.finished)return `Spiel beendet · ${winnerText(match)}`;if(cycle.phase==='countdown')return `${p} ist dran · Abwurf in ${Math.ceil(cycle.countdown)} Sekunden`;if(cycle.phase==='spinning'&&matchSpin!==null)return `Die Kugel rollt für ${p}.`;}
  return cycle.phase==='countdown'?`Nächster Abwurf in ${Math.ceil(cycle.countdown)} Sekunden`:cycle.phase==='complete'?'Zyklus beendet. Bereit für die nächste Runde.':cycle.phase==='paused'?'Der Croupier pausiert.':message;}
 // Die Gewinnzahl wird zu Beginn des Countdowns gezogen (randomIndex, Web Crypto), damit die
 // Kugelbewegung währenddessen im Hintergrund physikalisch gesucht werden kann.
 function drawIndex(){const forced=import.meta.env.DEV&&params.has('dev')&&params.has('target')?Number(params.get('target')):NaN;return Number.isInteger(forced)&&forced>=0&&forced<=36?ORDER.indexOf(forced):randomIndex();}
 function replan(){if(nextIndex===null||!wheel||cycle.phase!=='countdown'||!cycle.running)return;const key=[settings.ballDiameter,settings.ballMass,settings.ballBounce,settings.pocketRunMin,settings.pocketRunMax,settings.deflectorResistanceRadial,settings.deflectorResistanceTangential,settings.duration,settings.durationSpread,settings.bowlDepth,settings.numberSlope,settings.numberSize].join('/');if(key!==planKey){planKey=key;wheel.prepare(nextIndex,cycle.countdown);}}
 cycle.onSpin=id=>{matchSpin=match&&!match.finished?id:null;message='Rien ne va plus. Die Kugel rollt.';const index=nextIndex??drawIndex();nextIndex=null;const overshoot=tickInfo?Math.max(0,tickInfo.dt-tickInfo.before):undefined;wheel.spin(index,crypto.getRandomValues(new Uint8Array(1))[0]%3,overshoot);};
 wheel.onPhase=p=>{message=p<0?'Richtungswechsel. Die nächste Kugel wird eingesetzt.':p===0?'Rien ne va plus. Die Kugel rollt.':p===1?'Die Kugel springt in den Zahlenkranz.':'Die Kugel pendelt aus …';};
 wheel.onImpact=strength=>sound.impact(strength);wheel.onPose=(angle,progress)=>sound.update(angle,progress);wheel.onLaunch=(n,dir)=>{sound.roll();throwInfo=`Abwurf bei ${n} · Kessel ${dir===1?'↻':'↺'} · Kugel ${dir===1?'↺':'↻'}`;};
 wheel.onLand=index=>{const id=cycle.active;if(id===null)return;cycle.land(id,ORDER[index]);sound.stop();if(match&&id===matchSpin){matchSpin=null;match.record(ORDER[index]);if(match.finished){cycle.stop();celebrate(match);}}message=`${ORDER[index]} · ${color(ORDER[index])==='red'?'Rot':color(ORDER[index])==='black'?'Schwarz':'Grün'}`;render();void relay.send(snapshot());};
 function render(){const counting=cycle.phase==='countdown',spinning=cycle.phase==='spinning';$('seconds').textContent=counting?String(Math.ceil(cycle.countdown)):spinning?'•':cycle.phase==='complete'?'✓':'Ⅱ';$('timer-label').textContent=counting?'NÄCHSTER ABWURF':spinning?'KUGEL IST IM SPIEL':cycle.phase==='complete'?'ZYKLUS BEENDET':'PAUSIERT';$('timer-unit').textContent=counting?'SEKUNDEN':spinning?'RIEN NE VA PLUS':'';$('count-ring').style.setProperty('--progress',`${counting?cycle.countdown/settings.delay*360:0}deg`);$('count-ring').classList.toggle('is-spinning',spinning);$('remaining').textContent=cycle.remaining===null?'∞':String(cycle.remaining);$('round-progress').textContent=cycle.total===null?`${cycle.completed} Runden gespielt`:`${cycle.completed} von ${cycle.total} gespielt`;$('pause').textContent=cycle.running?'Ⅱ Pausieren':'▶ Fortsetzen';$('message').textContent=statusText();$('throw-info').textContent=throwInfo;
  const h=cycle.history.join(',');if(h!==lastHistory){lastHistory=h;const n=cycle.history[0];$('latest').textContent=String(n);$('latest').className=`latest ${color(n)}`;$('latest-color').textContent=color(n)==='red'?'ROT':color(n)==='black'?'SCHWARZ':'ZERO';$('history').innerHTML=cycle.history.map((v,i)=>`<span class="history-number ${color(v)} ${i===0?'newest':''}">${v}</span>`).join('');}
  renderMatch();
  $('audio-unlock').textContent=sound.error?sound.error:sound.ready?(settings.muted?'♫ Ton einschalten':'♫ Ton ausschalten'):'♫ Ton aktivieren';
 }
 // Wer beginnt, lost der Computer aus (Web Crypto); die Tafel zeigt dazu kurz eine Auslosung.
 function startMatch(mode:Match['mode'],players:number,rounds?:number|null){
  const first=Number.isInteger(players)&&players>0?randomBelow(players):0;
  try{match=new Match(mode,players,rounds===undefined?(mode==='rounds'?MATCH_ROUNDS:null):rounds,first);}catch{return false;}
  matchSpin=null;matchKey='';drawElapsed=0;drawTick=0;celebration.hide();cycle.start(null);return true;
 }
 function celebrate(m:Match){
  const rank=m.ranking(),names=m.winners.map(i=>m.players[i].name),best=m.players[m.winners[0]],tie=names.length>1,l=m.last;
  const detail=m.end==='exact'&&l?`Genau ${m.target}! Ausgemacht mit der ${l.number} in Runde ${m.round}.`
   :m.target!==null?`Nach ${m.rounds} ${m.rounds===1?'Runde':'Runden'} am nächsten an ${m.target}: ${best.score} Punkte.`
   :`${best.score} Punkte nach ${m.rounds} ${m.rounds===1?'Runde':'Runden'}.`;
  celebration.show({title:tie?'GLEICHSTAND · GETEILTER SIEG':m.end==='exact'?`${m.target} · GENAU GETROFFEN`:'SIEGER',name:tie?names.join(' & '):`${names[0]} gewinnt!`,detail,
   podium:rank.slice(0,3).map(i=>({place:1+m.players.filter(p=>p.score>m.players[i].score).length,name:m.players[i].name,score:`${m.players[i].score} Punkte`}))},settings.economy);
 }
 function winnerText(m:Match){const names=m.winners.map(i=>m.players[i].name);return names.length>1?`Gleichstand: ${names.join(', ')}`:`${names[0]} gewinnt!`;}
 // Anzeige links: nur sichtbar, solange über die Fernbedienung ein Spiel läuft.
 function renderMatch(){
  document.body.classList.toggle('match-on',!!match);$('match-panel').hidden=!match;if(!match)return;
  const m=match,x01=m.target!==null,counting=cycle.phase==='countdown'&&cycle.running,current=m.players[m.turn].name;
  // Auslosung: das Licht läuft reihum, wird langsamer und bleibt beim Beginner stehen.
  // Nur gezeichnete Bilder zählen (je höchstens 120 ms), damit die Auslosung auch auf einer langsamen Box ganz zu sehen ist.
  const now=performance.now();if(drawTick)drawElapsed+=Math.min(120,now-drawTick);drawTick=now;
  const drawT=Math.min(1,drawElapsed/DRAW_MS),drawing=drawT<1&&m.last===null,n=m.players.length,steps=2*n+m.first,lit=drawing?Math.floor(steps*(1-(1-drawT)**3))%n:m.turn;
  // Nach einer Landung bleibt der Werfer markiert (mit seinem Ergebnis); erst mit dem nächsten Abwurf wechselt die Anzeige.
  const rolling=cycle.phase==='spinning'&&matchSpin!==null,l=m.last,hold=!drawing&&!m.finished&&!rolling&&l!==null,shown=drawing?lit:hold?l!.player:m.turn,secs=`${Math.ceil(cycle.countdown)} s`;
  $('match-turn').textContent=drawing?'Auslosung: Wer beginnt?':m.finished?`★ ${winnerText(m)} ★`:rolling?`${current} · Kugel rollt …`
   :hold?`${m.players[l!.player].name}: ${l!.number}${l!.bust?' · zu viel':''}${counting?` · ${secs}`:' · Pause'}`
   :counting?`${current} beginnt · ${secs}`:`${current} beginnt · Pause`;
  $('match-turn').classList.toggle('winner',m.finished);
  $('match-turn').classList.toggle('drawing',drawing);
  const key=JSON.stringify(m.state())+shown+drawing;if(key===matchKey)return;matchKey=key;
  $('match-panel').style.setProperty('--rows',String(m.players.length));
  $('match-eyebrow').textContent=x01?'GENAU TREFFEN':'MEISTE PUNKTE';$('match-mode').textContent=x01?String(m.target):`${m.rounds} Runden`;
  $('match-round').textContent=m.rounds===null?`Runde ${m.round}`:`Runde ${m.round} von ${m.rounds}`;
  $('match-columns').innerHTML=x01?'<th>Spieler</th><th>Punkte</th><th>Noch</th><th>Aus mit</th>':'<th>Spieler</th><th>Punkte</th><th>Würfe</th><th>Abstand</th>';
  const best=Math.max(...m.players.map(p=>p.score));
  $('match-rows').innerHTML=m.players.map((p,i)=>{
   const turn=!m.finished&&i===shown,won=m.winners.includes(i),out=x01?m.checkout(i):null;
   const cells=x01?`<td>${p.score}</td><td>${m.needed(i)}</td><td>${out===null?'<span class="match-none">—</span>':`<span class="match-chip ${color(out)}">${out}</span>`}</td>`
    :`<td>${p.score}</td><td>${p.throws}/${m.rounds}</td><td>${best-p.score===0?(best>0?'<span class="match-lead">Führt</span>':'<span class="match-none">—</span>'):`−${best-p.score}`}</td>`;
   return `<tr class="${turn?'turn':''} ${won?'won':''} ${drawing&&turn?'draw':''}"><th>${won?'★ ':turn?'▶ ':''}${p.name}</th>${cells}</tr>`;}).join('');
  $('match-last').innerHTML=l?`Letzter Wurf: ${m.players[l.player].name} · <span class="match-chip ${color(l.number)}">${l.number}</span> ${l.win?'· ausgemacht!':l.bust?'· zählt nicht':''}`:'Der Computer dreht reihum für jeden Spieler.';
 }
 $('pause').onclick=()=>command({action:cycle.running?'pause':'resume'});$('start-default').onclick=()=>command({action:'start',rounds:DEFAULT_ROUNDS});
 $('settings-open').onclick=()=>{fillSettings($('settings-dialog'),settings);$<HTMLDialogElement>('settings-dialog').showModal();};document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>$<HTMLDialogElement>(b.dataset.close!).close());
 document.querySelectorAll<HTMLButtonElement>('[data-rounds]').forEach(b=>b.onclick=()=>{command({action:'start',rounds:b.dataset.rounds==='infinite'?null:Number(b.dataset.rounds)});$<HTMLDialogElement>('settings-dialog').close();});
 $('settings-dialog').oninput=event=>{const patch=settingsPatch(event);if(patch)configure(patch);};
 document.querySelector<HTMLButtonElement>('[data-design-reset]')!.onclick=()=>configure(DEFAULT_DESIGN);
 $('audio-unlock').onclick=async()=>{if(!sound.ready){try{await sound.unlock();}catch{sound.error='Tonfreigabe fehlgeschlagen. Bitte erneut versuchen.';}configure(settings);if(wheel.motion)sound.roll(wheel.rollProgress);}else configure({muted:!settings.muted});render();};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message='Vollbild bitte über den Browser aktivieren.';}};
 const remoteUrl=`https://motte025.github.io/City-cafe/fernbedienung.html?teil=roulette&raum=${encodeURIComponent(room)}`;$<HTMLAnchorElement>('remote-link').href=remoteUrl;$('room-label').textContent='CITY CAFE';$('pair-room').textContent=`Screen: ${room}`;
 $('pair').onclick=()=>{$<HTMLDialogElement>('pair-dialog').showModal();void QRCode.toCanvas($<HTMLCanvasElement>('qr'),remoteUrl,{width:240,margin:2,color:{dark:'#10221b',light:'#f1e8ce'}});};
 relay.onConnection=online=>{$('connection').textContent=online?'● Fernbedienung bereit':'○ Fernbedienung offline';if(online)void relay.send(snapshot());};
 relay.onMessage=(body,id)=>{if(!body||typeof body!=='object')return;const b=body as {session?:string;command?:Command};if(b.session!==session||!b.command)return;lastCommand=id;command(b.command);void relay.send(snapshot());};
 void relay.connect(room);
 // Countdown-Überschuss im auslösenden Bild wird an den Kessel weitergereicht (exakte Abwurflage).
 const dev=import.meta.env.DEV&&params.has('dev'),debug=dev?document.createElement('pre'):null;
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

