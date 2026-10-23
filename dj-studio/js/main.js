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

// Skin "Thunderstorm" (skin=gewitter, 23.10.2026): Wolken und Blitze nach der Musik (js/gewitter.js
// gewitterBuehne; wie es funktioniert: STAND.md "Thunderstorm"). Variante 2 (mittel); gewitter-1/3 waren
// Vorschauen (dezent/kraeftig) und sind nicht im Repo.
const gewitter = { buehne: null };
window.djStudio.gewitter = gewitter;       // Tests: djStudio.gewitter.buehne.blitz()
const GEWITTER = (new URLSearchParams(location.search).get('skin') || '').match(/^gewitter-?(\d)?/);
if (SKIN && GEWITTER) {
  const s = document.createElement('script');
  s.src = '../js/gewitter.js';
  s.onload = () => {
    const e = document.createElement('div');
    e.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:49;';   // Ebenen mischen selbst
    document.getElementById('buehne').appendChild(e);
    // Master-Pegel (linear) -> 0..1: -36 dBFS still, -6 dBFS voll
    const pegel = () => {
      const m = engine.masterPegel ? engine.masterPegel() : null;
      const r = m ? Math.max(m.L.rms || 0, m.R.rms || 0) : 0;
      return r > 0 ? Math.min(1, Math.max(0, (20 * Math.log10(r) + 36) / 30)) : 0;
    };
    // Bass 0..1: am TV aus der Messung des Songs (tv.js bassPegel), in der Vorschau aus dem Spektrum
    const spektrum = new Uint8Array(1024);
    const bass = () => {
      if (engine.bassPegel) return engine.bassPegel();
      if (!engine.masterMeter || !engine.masterMeter.spektrum) return 0;
      engine.masterMeter.spektrum(spektrum);
      let s = 0;
      for (let i = 1; i <= 6; i++) s += spektrum[i];          // ~25-150 Hz
      return s / (6 * 255);
    };
    // Melodie 0..1: am TV aus der Messung (tv.js melodiePegel), in der Vorschau aus dem Spektrum ~500 Hz-4 kHz
    const melodie = () => {
      if (engine.melodiePegel) return engine.melodiePegel();
      if (!engine.masterMeter || !engine.masterMeter.spektrum) return 0;
      engine.masterMeter.spektrum(spektrum);
      let s = 0;
      for (let i = 20; i <= 170; i++) s += spektrum[i];
      return s / (151 * 255);
    };
    // Takt des hoerbaren Decks: Schlag (fortlaufend, ganze Zahl = Schlag) und Tempo
    const takt = () => {
      const id = engine.videoMix() < 0.5 ? 'A' : 'B', d = state.decks[id], g = d.track && d.track.grid;
      if (!d.spielt || !g || !g.bpm) return null;
      // gemessene Schlaege (Taktmessung): genau zwischen den echten Schlaegen statt hochgerechnet aus dem
      // Durchschnittstempo - das lief bei leichten Tempo-Schwankungen bis zu einem halben Schlag weg (Testlauf 23.10.)
      const z = g.zeiten;
      if (z && z.length > 1 && d.pos >= z[0] && d.pos < z[z.length - 1]) {
        let lo = 0, hi = z.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (z[m] <= d.pos) lo = m; else hi = m; }
        return { schlag: lo + (d.pos - z[lo]) / (z[lo + 1] - z[lo]), bpm: g.bpm };
      }
      return { schlag: (d.pos - (g.offset || 0)) / (60 / g.bpm), bpm: g.bpm };
    };
    // Videofenster bleibt frei (Bild-2-Pixel, mit Bedienleiste); Wolken und Blitze gehen ueber die
    // Pegel und ueber das Kopffeld, dort aber keine eigenen Wolken mehr (Betreiber 23.10.)
    const frei = [[550, 80, 574, 385]];
    const wolkenFrei = [[388, 4, 896, 66]];      // Kopffeld "CITY CAFE": keine Wolken
    // echte Wolkenbilder (vom Betreiber mit ChatGPT erstellt, auf Schwarz, freigestellt - img/wolken/)
    const wolkenBilder = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `img/wolken/w${n}.webp`);
    gewitter.buehne = gewitterBuehne(e, { variante: Number(GEWITTER[1]) || 2, pegel, bass, melodie, takt, frei,
        spannung: () => (engine.spannung ? engine.spannung(4) : null),
        drops: () => (engine.drops ? engine.drops() : null), wolkenFrei, wolkenBilder,
        blitzBilder: [1, 2, 3, 4, 5, 6, 7].map(n => `img/blitze/n${n}.webp`) });
  };
  document.head.appendChild(s);
}
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
