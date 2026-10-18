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
engine.starten(quellen(engine));
const kopf = kopfBauen(document.getElementById('kopf'), engine);
const deckA = deckBauen(document.getElementById('deck-a'), 'A', engine, aktionen);
const deckB = deckBauen(document.getElementById('deck-b'), 'B', engine, aktionen);
const mitte = mitteBauen(document.getElementById('mitte'), engine, aktionen);
leisteBauen(document.getElementById('leiste'), engine, aktionen);
const automix = automixBauen(engine, aktionen);
if (SKIN) skinAnwenden();

// Demo-Titel in die Leiste, die ersten zwei auf die Decks
(async () => {
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
if (new URLSearchParams(location.search).has('ohneStart')) start.remove();

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
function sicher(name, f) {
  try { f(); } catch (e) { if (!gemeldet.has(name)) { gemeldet.add(name); console.error('[DJ Studio] ' + name + ':', e); } }
}
function frame() {
  const t = performance.now() / 1000, dt = Math.min(0.1, t - letzte);
  letzte = t;
  requestAnimationFrame(frame);       // zuerst: ein Fehler unten stoppt die Anzeige nicht
  sicher('engine', () => engine.takt());
  sicher('automix', () => automix.takt());
  const mix = engine.videoMix();
  sicher('kopf', () => kopf.frame(t));
  sicher('deckA', () => deckA.frame(t, dt, mix < 0.5));
  sicher('deckB', () => deckB.frame(t, dt, mix >= 0.5));
  sicher('mitte', () => mitte.frame(t, dt));
}
requestAnimationFrame(frame);
