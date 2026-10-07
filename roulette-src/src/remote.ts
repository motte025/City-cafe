import {Relay} from './relay';import {DEFAULT_DESIGN} from './wheel-shape';import {color} from './game';import {DEFAULT_SETTINGS,applySettings,type State,type Command} from './settings';import {settingsForm,fillSettings,settingsPatch,presetPatch,roundButtons} from './controls';import {MATCH_MODES,rankPlayers,isKo,MIN_PLAYERS,MAX_PLAYERS,MATCH_ROUNDS,ROUND_PRESETS,modeLabel,readMatchState,type MatchMode} from './match';
export function startRemote(){
 const params=new URLSearchParams(location.search),room=/^[a-zA-Z0-9_-]{1,64}$/.test(params.get('raum')||'')?params.get('raum')!:'city-cafe';document.body.className='remote-page';
 // Aufbau fürs Handy: oben Status, dann Spielmodus und normales Roulette mit den wichtigen Knöpfen,
 // alle Einstellungen eingeklappt darunter. In der gemeinsamen Fernbedienung (Rahmen) ohne großen Kopf.
 if(window.top!==window.self)document.body.classList.add('embedded');
 document.querySelector('#app')!.innerHTML=`<main class="remote-shell"><header class="remote-heading"><div><span class="eyebrow">CITY CAFE · CROUPIER</span><h1>Roulette</h1></div><span class="remote-link-state" id="link-state">Verbinden …</span></header><p class="remote-room" id="remote-room"></p>
 <section class="remote-live"><div><span>Nächster Abwurf</span><strong id="remote-count">—</strong></div><div><span>Runden übrig</span><strong id="remote-remaining">—</strong></div><div><span>Letzte Zahl</span><strong id="remote-last">—</strong></div><p id="remote-message">Warte auf den TV …</p></section>
 <p id="command-feedback" role="status"></p>
 <section class="remote-card remote-match"><h2 class="card-title">🎲 Spielmodus</h2>
 <div class="match-count-label">Modus</div><div class="match-modes">${MATCH_MODES.map(m=>`<button class="round-preset" data-match-mode="${m}">${modeLabel(m)}<span>${m==='rounds'?'meiste Punkte':m==='ko'?'Letzter gewinnt':m==='kol'?'Letzter verliert':'genau treffen'}</span></button>`).join('')}</div>
 <div class="match-rounds-box"><div class="match-count-label">Runden</div><div class="match-counts match-round-counts">${ROUND_PRESETS.map(n=>`<button data-match-rounds="${n}">${n}</button>`).join('')}<button data-match-rounds="0" class="match-unlimited">∞<span>ohne Limit</span></button></div></div>
 <div class="match-count-label">Spieler</div><div class="match-counts">${Array.from({length:MAX_PLAYERS-MIN_PLAYERS+1},(_,i)=>`<button data-players="${i+MIN_PLAYERS}">${i+MIN_PLAYERS}</button>`).join('')}</div>
 <details class="match-names" id="match-names-box"><summary>✎ Spielernamen</summary><div class="match-names-grid" id="match-names"></div><datalist id="name-archiv"></datalist><div class="names-known" id="names-known"></div><div class="match-names-actions"><button id="names-apply">Namen im laufenden Spiel übernehmen</button><button id="names-clear">Leeren</button></div></details>
 <div class="remote-actions"><button id="match-start" class="match-start">▶ Spiel starten</button><button id="match-end" class="stop-button">✕ Spiel beenden</button><button id="match-pause" class="match-pause">Ⅱ Kurze Pause</button></div>
 <div id="remote-match-board" class="remote-match-board"></div>
 <details class="rules"><summary>Spielregeln</summary><p>Der Computer dreht reihum für jeden Spieler, die Kugel entscheidet. Wer beginnt, wird ausgelost; sind Namen eingetragen, auch die übrige Reihenfolge (die Nummer vor dem Namen am TV).</p><p><b>Runden:</b> jeder dreht so oft wie gewählt, die höchste Summe gewinnt.</p><p><b>51 / 101 / 151 / 201 / 301 / 501:</b> wer genau ankommt, hat ausgemacht. Die Runde wird immer fertig gespielt; machen mehrere aus, teilen sie sich den Sieg. Zu viel zählt nicht. Mit Rundenlimit gewinnt sonst, wer am nächsten dran ist.</p><p><b>K.o.:</b> jede Runde wirft jeder Verbliebene einmal. <i>Letzter gewinnt:</i> die niedrigste Zahl scheidet aus. <i>Letzter verliert:</i> die höchste Zahl ist in Sicherheit, wer übrig bleibt, hat verloren. Bei Gleichstand gibt es ein Stechen unter den Gleichen.</p></details></section>
 <section class="remote-card"><h2 class="card-title">🎰 Normales Roulette</h2><div class="match-count-label">Zyklus starten</div><div class="preset-grid" id="presets">${roundButtons()}</div>
 <div class="remote-actions"><button data-action="pause" id="remote-pause">Ⅱ Pausieren</button><button data-action="now">↗ Jetzt drehen</button><button data-action="stop" class="stop-button">■ Stoppen</button><button id="remote-sound" class="sound-button">🔊 Ton aus</button></div>
 <p class="helper">Eine laufende Kugel wird immer zu Ende gespielt.</p></section>
 <section class="remote-card remote-settings"><h2 class="card-title">⚙ Einstellungen</h2>${settingsForm()}<p class="tv-info" id="tv-info"></p><p class="audio-hint" id="audio-hint">Ton einmal am TV unter ⚙ → Ton aktivieren freigeben.</p></section>
 <section class="remote-card"><h2 class="card-title">Letzte 10 Zahlen</h2><div id="remote-history" class="remote-history"></div></section>
 <footer class="remote-footer"><a id="open-tv" target="_blank" rel="noopener">TV-Anzeige öffnen ↗</a><span>Ein Screen · eine Steuerung</span></footer></main>`;
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id)! as T;const relay=new Relay('remote');const openHist=new Set<string>();let names:string[]=[];try{const v=JSON.parse(localStorage.getItem('atelier-names')||'[]');if(Array.isArray(v))names=v.map(x=>String(x??'').slice(0,16));}catch{}
 const saveNames=()=>{try{localStorage.setItem('atelier-names',JSON.stringify(names));}catch{}};
 // Namensarchiv: jeder je eingetragene Name (n) mit Anzahl (c) und letzter Nutzung (t), auf diesem Handy gespeichert.
 // Daraus kommen die Vorschläge beim Tippen (datalist) und die Knöpfe „Bekannte Spieler“ zum Antippen.
 type Bekannt={n:string;c:number;t:number};let archiv:Bekannt[]=[];
 try{const v=JSON.parse(localStorage.getItem('atelier-name-archiv')||'[]');if(Array.isArray(v))archiv=v.filter(x=>x&&typeof x.n==='string'&&x.n.trim()).map(x=>({n:String(x.n).trim().slice(0,16),c:Number(x.c)||1,t:Number(x.t)||0}));}catch{}
 const saveArchiv=()=>{try{localStorage.setItem('atelier-name-archiv',JSON.stringify(archiv));}catch{}};
 function merken(liste:string[]){let neu=false;for(const roh of liste){const n=(roh??'').trim().slice(0,16);if(!n)continue;const alt=archiv.find(b=>b.n.toLowerCase()===n.toLowerCase());if(alt){alt.c++;alt.t=Date.now();alt.n=n;}else{archiv.push({n,c:1,t:Date.now()});neu=true;}}
  archiv.sort((a,b)=>b.t-a.t);archiv=archiv.slice(0,80);saveArchiv();if(neu)renderBekannte(true);}
 // Häufigste zuerst, bei Gleichstand die zuletzt benutzten; schon eingetragene fallen weg.
 const bekannteSortiert=()=>[...archiv].sort((a,b)=>b.c-a.c||b.t-a.t);
 let letztesFeld=-1;
 // Gibt es schon gespeicherte Namen, die Namensliste gleich aufgeklappt zeigen.
 if(archiv.length)$<HTMLDetailsElement>('match-names-box').open=true;let matchMode:MatchMode='x301',matchPlayers=2,matchRounds:number|null=null;let state:State|null=null,lastReceived=0,pendingId:string|null=null,debounce:number|null=null,pendingPatch={};
 $('remote-room').textContent=`Screen: ${room}`;$<HTMLAnchorElement>('open-tv').href=`./index.html?raum=${encodeURIComponent(room)}`;
 fillSettings($('app'),DEFAULT_SETTINGS);
 function isLive(){return !!state&&Date.now()-lastReceived<6500&&relay.connected;}
 function render(){const live=isLive();$('link-state').textContent=live?'● TV verbunden':'○ Warte auf TV';$('link-state').classList.toggle('online',live);document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('[data-action],[data-rounds],[data-setting],[data-design-reset],#match-start,#remote-sound,#match-pause').forEach(el=>el.disabled=!live);renderMatch();if(!state)return;
  document.querySelector<HTMLElement>('[data-design-note]')!.textContent=state.designPending?'Neue Kesselform vorgemerkt · wird nach dem Wurf übernommen.':'Form und Zahlen ändern sich nach einem laufenden Wurf. Blickwinkel, Licht und Texte reagieren sofort.';
  {const t=state.tv;$('tv-info').textContent=t?`TV meldet: ${t.w} × ${t.h} Pixel · Skalierung ${t.dpr}${t.font?` · Tafelschrift ${t.font} px (${Math.round(t.fit*100)} %)`:''} ${t.gl?` · 3D-Bild ${t.gl}${t.eco?' (Sparmodus!)':''}`:''} · ${t.ua}`:'';}
  $('remote-count').textContent=state.phase==='countdown'?`${state.seconds}s`:state.phase==='spinning'?'Läuft':state.phase==='complete'?'Fertig':'Pause';$('remote-remaining').textContent=state.remaining===null?'∞':String(state.remaining);const last=state.history[0];$('remote-last').textContent=last===undefined?'—':String(last);$('remote-last').className=last===undefined?'':color(last);$('remote-message').textContent=state.message;const paused=!state.running;$('match-pause').textContent=paused?'▶ Weiterspielen':'Ⅱ Kurze Pause';$('match-pause').classList.toggle('paused',paused);$('remote-sound').textContent=state.settings.muted?'🔇 Ton ist aus · einschalten':'🔊 Ton ist an · ausschalten';$('remote-sound').classList.toggle('muted',state.settings.muted);$('remote-pause').textContent=state.running?'Ⅱ Pausieren':'▶ Fortsetzen';$('remote-pause').dataset.action=state.running?'pause':'resume';$('audio-hint').textContent=state.audioReady?'Tonfreigabe am TV aktiv. Lautstärke und Stumm lassen sich hier einstellen.':'Ton einmal am TV unter ⚙ → Ton aktivieren freigeben.';
  document.querySelectorAll<HTMLElement>('[data-rounds]').forEach(el=>el.classList.toggle('selected',(el.dataset.rounds==='infinite'?null:Number(el.dataset.rounds))===state!.total));fillSettings($('app'),state.settings);$('remote-history').innerHTML=state.history.map(n=>`<span class="history-number ${color(n)}">${n}</span>`).join('');
  if(pendingId&&state.lastCommand===pendingId){$('command-feedback').textContent='✓ Am TV übernommen';pendingId=null;}
 }
 const esc=(t:string)=>t.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
 function renderNames(){const box=$('match-names');const want=matchPlayers;if(box.children.length!==want){box.innerHTML=Array.from({length:want},(_,i)=>`<label><span>${i+1}</span><input type="text" maxlength="16" data-name="${i}" placeholder="Spieler ${i+1}" autocomplete="off" autocapitalize="words" list="name-archiv"></label>`).join('');}
  box.querySelectorAll<HTMLInputElement>('[data-name]').forEach(inp=>{const i=Number(inp.dataset.name);if(document.activeElement!==inp)inp.value=names[i]??'';});renderBekannte();}
 let bekannteSchluessel='';
 function renderBekannte(erzwingen=false){const belegt=new Set(names.slice(0,matchPlayers).map(n=>(n??'').trim().toLowerCase()).filter(Boolean));const liste=bekannteSortiert();
  const frei=liste.filter(b=>!belegt.has(b.n.toLowerCase())).slice(0,30);const schluessel=liste.map(b=>b.n).join('|')+'#'+frei.map(b=>b.n).join('|');if(!erzwingen&&schluessel===bekannteSchluessel)return;bekannteSchluessel=schluessel;
  $('name-archiv').innerHTML=liste.map(b=>`<option value="${esc(b.n)}"></option>`).join('');
  $('names-known').innerHTML=frei.length?`<div class="match-count-label">Bekannte Spieler · antippen</div><div class="names-known-list">${frei.map(b=>`<span class="name-chip"><button type="button" data-known="${esc(b.n)}">${esc(b.n)}</button><button type="button" class="name-forget" data-forget="${esc(b.n)}" aria-label="${esc(b.n)} vergessen">×</button></span>`).join('')}</div>`:(liste.length?'':'<p class="helper">Eingetragene Namen werden hier gespeichert und beim nächsten Mal vorgeschlagen.</p>');}
 function renderMatch(){renderNames();$<HTMLButtonElement>('names-apply').disabled=!isLive()||!state?.match||!!state.match.finished;
  document.querySelectorAll<HTMLElement>('[data-match-mode]').forEach(el=>el.classList.toggle('selected',el.dataset.matchMode===matchMode));
  document.querySelectorAll<HTMLElement>('[data-match-rounds]').forEach(el=>el.classList.toggle('selected',(Number(el.dataset.matchRounds)||null)===matchRounds));document.querySelector<HTMLElement>('.match-unlimited')!.hidden=matchMode==='rounds';document.querySelector<HTMLElement>('.match-rounds-box')!.hidden=isKo(matchMode);
  document.querySelectorAll<HTMLElement>('[data-players]').forEach(el=>el.classList.toggle('selected',Number(el.dataset.players)===matchPlayers));
  const m=state?.match??null;$<HTMLButtonElement>('match-end').disabled=!isLive()||!m;$('match-start').textContent=m&&!m.finished?'↻ Neues Spiel':'▶ Spiel starten';
  const last=state?.lastMatch??null,show=m??last?.match??null;
  if(!show){$('remote-match-board').innerHTML='';return;}
  const x01=show.target!==null,ko=isKo(show.mode),head=show.finished?(show.loser!=null?`${esc(show.players[show.loser]?.name??'')} verliert`:`🏆 ${show.winners.map(i=>esc(show.players[i]?.name??'')).join(', ')} ${show.winners.length>1?'– Gleichstand':'gewinnt!'}`):`${esc(show.players[show.turn].name)} ist dran · Runde ${show.round}${show.rounds===null?'':` von ${show.rounds}`}`;
  // Ohne laufendes Spiel: das zuletzt gespeicherte Spiel mit Datum und Dauer.
  const title=!m&&last?`<p class="last-title">Letztes Spiel · ${new Date(last.end).toLocaleString('de-AT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · Dauer ${Math.max(1,Math.round((last.end-last.start)/60000))} min</p>`:'';
  const order=ko?rankPlayers(show):show.players.map((_,i)=>i).sort((a,b)=>show.players[b].score-show.players[a].score||a-b);
  $('remote-match-board').innerHTML=`${title}<p class="${show.finished?'winner':''}">${show.rounds!==null?`${show.rounds} Runden`:modeLabel(show.mode)} · ${head}</p><ol>${order.map(i=>{const p=show.players[i],open=openHist.has(p.name);
   return `<li class="${m&&!show.finished&&i===show.turn?'turn':''} ${open?'open':''}" data-hist="${esc(p.name)}"><span>${open?'▾':'▸'} ${esc(p.name)}</span><b>${p.score}</b><small>${ko?(p.out?(show.mode==='ko'?`raus R${p.ko}`:`sicher R${p.ko}`):show.finished?(show.mode==='ko'?'Sieger':'Verlierer'):'im Spiel'):x01?(p.out?'✓ aus':`noch ${show.target!-p.score}`):`${p.throws} Würfe`}</small>${open?histList(p.hist):''}</li>`;}).join('')}</ol><p class="hist-hint">Spieler antippen: alle Würfe anzeigen</p>`;
 }
 /** Wurf-Historie eines Spielers: Runde, Zahl, Zwischenstand; überworfen durchgestrichen, ausgemacht mit ✓. */
 function histList(h:string|undefined){const items=(h??'').split(',').filter(Boolean);if(!items.length)return '<div class="hist">Noch kein Wurf.</div>';
  let sum=0;return `<div class="hist">${items.map((t,k)=>{const n=parseInt(t,10),bust=t.endsWith('x'),win=t.endsWith('*');if(!bust)sum+=n;
   return `<span class="${bust?'bust':win?'win':''}"><em>R${k+1}</em><b class="${color(n)}">${n}</b><i>${bust?'zählt nicht':win?'✓ aus':`= ${sum}`}</i></span>`;}).join('')}</div>`;}
 async function send(command:Command){if(!isLive()||!state){$('command-feedback').textContent='Der TV ist gerade nicht erreichbar.';return;}$('command-feedback').textContent='Wird gesendet …';pendingId=await relay.send({session:state.session,command});if(!pendingId)$('command-feedback').textContent='Nicht gesendet. Bitte Verbindung prüfen.';}
 document.querySelectorAll<HTMLButtonElement>('[data-match-mode]').forEach(b=>b.onclick=()=>{matchMode=b.dataset.matchMode as MatchMode;if(matchMode==='rounds'&&matchRounds===null)matchRounds=MATCH_ROUNDS;renderMatch();});
 document.querySelectorAll<HTMLButtonElement>('[data-match-rounds]').forEach(b=>b.onclick=()=>{matchRounds=Number(b.dataset.matchRounds)||null;renderMatch();});
 document.querySelectorAll<HTMLButtonElement>('[data-players]').forEach(b=>b.onclick=()=>{matchPlayers=Number(b.dataset.players);renderMatch();});
 $('match-names').oninput=e=>{const inp=e.target as HTMLInputElement;if(!inp.dataset.name)return;names[Number(inp.dataset.name)]=inp.value.slice(0,16);saveNames();renderBekannte();};
 // Fertig getippt (Feld verlassen oder Vorschlag gewählt): Name ins Archiv.
 $('match-names').onchange=e=>{const inp=e.target as HTMLInputElement;if(inp.dataset.name)merken([inp.value]);};
 $('match-names').addEventListener('focusin',e=>{const inp=e.target as HTMLInputElement;if(inp.dataset.name)letztesFeld=Number(inp.dataset.name);});
 // Bekannten Spieler antippen: ins zuletzt angetippte Feld, wenn es leer ist, sonst ins erste freie.
 $('names-known').onclick=e=>{const ziel=(e.target as HTMLElement).closest('button');if(!ziel)return;
  if(ziel.dataset.forget!==undefined){const n=ziel.dataset.forget;if(!confirm(`„${n}“ aus den gespeicherten Namen löschen?`))return;archiv=archiv.filter(b=>b.n!==n);saveArchiv();renderBekannte(true);return;}
  const n=ziel.dataset.known;if(!n)return;const leer=(i:number)=>!(names[i]??'').trim();
  let i=letztesFeld>=0&&letztesFeld<matchPlayers&&leer(letztesFeld)?letztesFeld:Array.from({length:matchPlayers},(_,k)=>k).find(leer)??-1;
  if(i<0){$('command-feedback').textContent='Alle Plätze haben schon einen Namen – erst einen löschen oder mehr Spieler wählen.';return;}
  names[i]=n;saveNames();merken([n]);letztesFeld=-1;renderNames();};
 $('names-apply').onclick=()=>{if(state?.match){merken(names.slice(0,state.match.players.length));void send({action:'names',names:names.slice(0,state.match.players.length)});}};
 $('names-clear').onclick=()=>{if(!confirm('Alle Namen leeren?'))return;names=[];saveNames();renderNames();};
 $('remote-match-board').onclick=e=>{const li=(e.target as Element).closest<HTMLElement>('[data-hist]');if(!li)return;const k=li.dataset.hist!;if(openHist.has(k))openHist.delete(k);else openHist.add(k);renderMatch();};
 $('match-pause').onclick=()=>{if(state)void send({action:state.running?'pause':'resume'});};
 $('remote-sound').onclick=()=>{if(state)void send({action:'settings',patch:{muted:!state.settings.muted}});};
 $('match-start').onclick=()=>{if(state?.match&&!state.match.finished&&!confirm('Laufendes Spiel abbrechen und neu starten?'))return;merken(names.slice(0,matchPlayers));void send({action:'match',mode:matchMode,players:matchPlayers,names:names.slice(0,matchPlayers),rounds:isKo(matchMode)?null:matchRounds});};
 $('match-end').onclick=()=>{if(state?.match&&!state.match.finished&&!confirm('Spiel wirklich beenden? Danach läuft der normale Zyklus weiter.'))return;void send({action:'matchEnd'});};
 document.querySelectorAll<HTMLButtonElement>('[data-rounds]').forEach(b=>b.onclick=()=>void send({action:'start',rounds:b.dataset.rounds==='infinite'?null:Number(b.dataset.rounds)}));
 document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onclick=()=>void send({action:b.dataset.action} as Command));
 document.querySelector<HTMLButtonElement>('[data-design-reset]')!.onclick=()=>{if(debounce!==null)clearTimeout(debounce);pendingPatch={};void send({action:'settings',patch:DEFAULT_DESIGN});};
 $('app').addEventListener('input',event=>{const patch=presetPatch(event)??settingsPatch(event);if(!patch)return;pendingPatch={...pendingPatch,...patch};if(state){state.settings=applySettings(state.settings,patch);fillSettings($('app'),state.settings);}if(debounce!==null)clearTimeout(debounce);debounce=window.setTimeout(()=>{void send({action:'settings',patch:pendingPatch});pendingPatch={};},250);});
 // Der TV schickt Einstellungen und letztes Spiel auf einem eigenen, seltenen Kanal; ein älterer TV schickt alles im Status.
 let slow:Partial<State>={},waiting:State|null=null;
 relay.onSlow=body=>{if(!body||typeof body!=='object')return;slow=body as Partial<State>;if(waiting){const w=waiting;waiting=null;relay.onMessage!(w,'');}else if(state)relay.onMessage!({...state,settings:undefined,lastMatch:undefined} as unknown as State,'');};
 relay.onMessage=body=>{if(!body||typeof body!=='object')return;const fast=body as State;if(typeof fast.session!=='string'||typeof fast.phase!=='string')return;
  const v={...fast,settings:fast.settings??slow.settings,lastMatch:'lastMatch' in fast&&fast.lastMatch!==undefined?fast.lastMatch:slow.lastMatch} as State;if(!v.settings){waiting=fast;return;}state={...v,history:Array.isArray(v.history)?v.history.filter(n=>Number.isInteger(n)&&n>=0&&n<=36).slice(0,10):[],settings:applySettings(DEFAULT_SETTINGS,v.settings),match:readMatchState(v.match),lastMatch:(()=>{const l=v.lastMatch;const mm=l&&readMatchState(l.match);return mm&&Number.isFinite(l!.start)&&Number.isFinite(l!.end)?{match:mm,start:l!.start,end:l!.end}:null;})()};lastReceived=Date.now();render();};relay.onConnection=()=>render();void relay.connect(room);window.setInterval(render,1000);render();
}
