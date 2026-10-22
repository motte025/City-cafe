// City Cafe DJ Studio - Einstieg. Baut die Oberflaeche, verbindet Engine,
// Quellen und Automix, skaliert die 1920x1080-Buehne ins Fenster.

import { state, bestaetigen } from './store.js';
import { Engine } from './engine.js';
import { quellen, DEMO } from './sources.js';
import { automixBauen } from './automix.js';
import { deckBauen } from './ui/deck.js';
import { mitteBauen } from './ui/mitte.js';
import { kopfBauen } from './ui/kopf.js';
import { leisteBauen } from './ui/leiste.js';
import { einstellungen, schliessen } from './ui/overlays.js';
import { texturenLaden } from './texturen.js';
import { skinAnwenden } from './skin.js';
import { tvBauen } from './tv.js';
import { angeboteStarten } from './ui/angebote.js';

// ?tv: DJ-Modus der YouTube-Musik am Fernseher (eingebettet in index.html).
// Nur Anzeige - kein eigener Ton, keine Demo-Titel, keine Bedienung.
const TV = new URLSearchParams(location.search).has('tv');

texturenLaden();

const engine = new Engine();
window.djStudio = { engine, state };        // fuer Tests und Fehlersuche

let naechsteId = 1;
const aktionen = {
  inLeiste(track) { bestaetigen('queue', [...state.queue, { id: 'q' + naechsteId++, track }]); },
  entfernen(qid) { bestaetigen('queue', state.queue.filter(q => q.id !== qid)); },
  verschieben(qid, ziel) {
    const q = state.queue.slice();
    const i = q.findIndex(x => x.id === qid);
    if (i < 0) return;
    const [e] = q.splice(i, 1);
    q.splice(Math.max(0, Math.min(q.length, ziel)), 0, e);
    bestaetigen('queue', q);
  },
  async ausLeisteLaden(qid, deck) {
    const e = state.queue.find(q => q.id === qid);
    if (!e) return false;
    const ok = await engine.decks[deck].laden(e.track);
    if (ok) aktionen.entfernen(qid);
    return ok;
  },
  naechstenLaden(deck) { return state.queue.length ? aktionen.ausLeisteLaden(state.queue[0].id, deck) : false; },
  auswerfen(deck) {
    if (state.decks[deck].spielt) return;
    engine.decks[deck].buffer = null;
    bestaetigen(`decks.${deck}.sync`, false);
    bestaetigen(`decks.${deck}.track`, null);
  },
  tapBpm(deck, bpm) {
    const t = state.decks[deck].track;
    if (t && !t.grid && bpm > 50 && bpm < 220) bestaetigen(`decks.${deck}.track`, { ...t, bpmTap: bpm });
  },
  einstellungen: () => einstellungen(engine),
  uebergangJetzt: () => automix.jetzt(),
};

// ---- Buehne skalieren ------------------------------------------------------
const buehne = document.getElementById('buehne');
function skalieren() {
  const f = Math.min(innerWidth / 1920, innerHeight / 1080);
  buehne.style.transform = `translate(${(innerWidth - 1920 * f) / 2}px, ${(innerHeight - 1080 * f) / 2}px) scale(${f})`;
}
addEventListener('resize', skalieren);
skalieren();

// ---- Aufbau ----------------------------------------------------------------
// Bild 2 als Buehne (Standard); ?klassisch zeigt die gezeichnete Oberflaeche.
// Die Klasse muss vor dem Aufbau stehen, damit Meter und Wellen die Bild-Optik waehlen.
const SKIN = !new URLSearchParams(location.search).has('klassisch');
buehne.classList.toggle('skin', SKIN);
document.body.classList.toggle('tv', TV);
engine.starten(quellen(engine));
const kopf = kopfBauen(document.getElementById('kopf'), engine);
const deckA = deckBauen(document.getElementById('deck-a'), 'A', engine, aktionen);
const deckB = deckBauen(document.getElementById('deck-b'), 'B', engine, aktionen);
const mitte = mitteBauen(document.getElementById('mitte'), engine, aktionen);
leisteBauen(document.getElementById('leiste'), engine, aktionen);
const automix = automixBauen(engine, aktionen);
if (SKIN) skinAnwenden();
const tv = TV ? tvBauen(engine) : null;
if (TV && SKIN) angeboteStarten(document.getElementById('buehne'));
if (TV) engine.ctx.suspend();

// Demo-Titel in die Leiste, die ersten zwei auf die Decks
if (!TV) (async () => {
  for (const t of await DEMO.liste()) aktionen.inLeiste(t);
  await aktionen.naechstenLaden('A');
  await aktionen.naechstenLaden('B');
  bestaetigen('decks.A.master', true);
})();

// ---- Start (Browser verlangt Klick fuer Ton) -------------------------------
const start = document.getElementById('start');
document.getElementById('start-knopf').addEventListener('click', async () => {
  await engine.ctx.resume();
  start.remove();
  document.querySelector('#deck-a .play')?.focus();
});
if (TV || new URLSearchParams(location.search).has('ohneStart')) start.remove();

// ---- Tastatur --------------------------------------------------------------
const LOOPS = { 1: ['A', 4], 2: ['A', 8], 3: ['A', 16], 4: ['A', 32], 7: ['B', 4], 8: ['B', 8], 9: ['B', 16], 0: ['B', 32] };
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, .dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.repeat && !['arrowleft', 'arrowright'].includes(k)) return;
  const tun = {
    x: () => engine.decks.A.umschalten(), '.': () => engine.decks.B.umschalten(),
    z: () => engine.decks.A.cueDruck(), y: () => engine.decks.A.cueDruck(), ',': () => engine.decks.B.cueDruck(),
    s: () => engine.request('decks.A.sync', !state.decks.A.sync), l: () => engine.request('decks.B.sync', !state.decks.B.sync),
    arrowleft: () => engine.request('master.crossfader', state.master.crossfader - 0.1),
    arrowright: () => engine.request('master.crossfader', state.master.crossfader + 0.1),
    m: () => engine.request('automix', !state.automix),
    escape: () => schliessen(),
  }[k];
  if (tun) { e.preventDefault(); tun(); return; }
  if (LOOPS[k]) { e.preventDefault(); engine.decks[LOOPS[k][0]].loopBeats(LOOPS[k][1]); }
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'y') engine.decks.A.cueLos();
  if (k === ',') engine.decks.B.cueLos();
});

// ---- Bildtakt --------------------------------------------------------------
let letzte = performance.now() / 1000;
const gemeldet = new Set();
// Ueberwachung (22.10.2026): Fehler und Ruckeln an die TV-Seite melden (nlFehlerMelden in index.html,
// der Supervisor holt sie ab). Ausserhalb der TV-Seite (Studio allein) gibt es den Melder nicht.
function melden(quelle, text) {
  try { if (parent !== window && parent.nlFehlerMelden) parent.nlFehlerMelden(quelle, text); } catch (e) {}
}
addEventListener('error', e => melden('DJ-Studio', (e.message || 'Fehler') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')));
addEventListener('unhandledrejection', e => melden('DJ-Studio', 'Promise: ' + ((e.reason && e.reason.message) || e.reason)));
function sicher(name, f) {
  try { f(); } catch (e) {
    if (!gemeldet.has(name)) { gemeldet.add(name); console.error('[DJ Studio] ' + name + ':', e); }
    melden('DJ-Studio', name + ': ' + (e && e.message || e));
  }
}
// Bilder pro Sekunde je 10 s; sichtbar und unter 40 -> "Ruckeln" (normal 50-60).
let fpsBilder = 0, fpsSeit = performance.now();
function fpsZaehlen(raf) {
  fpsBilder++;
  if (raf - fpsSeit < 10000) return;
  const fps = fpsBilder * 1000 / (raf - fpsSeit);
  fpsBilder = 0; fpsSeit = raf;
  if (tv && document.visibilityState === 'visible' && fps < 40) melden('Ruckeln', 'DJ-Studio unter 40 Bilder/s');
}
// TV: schnelle Bildschirme (ueber 75 Hz, z. B. 100 Hz) nur jedes zweite Bild zeichnen - der Browser
// schaffte dort nicht jedes Bild, die Abstaende wechselten 10/20 ms und die Welle ruckelte
// (21.10.2026). Gleichmaessige 50 Bilder/s wirken ruhiger als unregelmaessige 90.
let bildAbstand = 1 / 60, ungerade = false, letzterRaf = 0;
function frame(raf) {
  requestAnimationFrame(frame);       // zuerst: ein Fehler unten stoppt die Anzeige nicht
  fpsZaehlen(raf);
  if (letzterRaf && raf - letzterRaf < 50) bildAbstand += ((raf - letzterRaf) / 1000 - bildAbstand) * 0.05;
  letzterRaf = raf;
  if (tv && bildAbstand < 1 / 75 && (ungerade = !ungerade)) return;
  const t = performance.now() / 1000, dt = Math.min(0.1, t - letzte);
  letzte = t;
  if (tv) sicher('tv', () => tv.takt(raf / 1000));
  else {
    sicher('engine', () => engine.takt());
    sicher('automix', () => automix.takt());
  }
  const mix = engine.videoMix();
  sicher('kopf', () => kopf.frame(t));
  sicher('deckA', () => deckA.frame(t, dt, mix < 0.5));
  sicher('deckB', () => deckB.frame(t, dt, mix >= 0.5));
  sicher('mitte', () => mitte.frame(t, dt));
}
requestAnimationFrame(frame);
