// Zentraler Zustand. Bedienelemente schicken WUENSCHE an die Engine
// (engine.request); die Engine prueft, begrenzt, setzt um und meldet den
// BESTAETIGTEN Wert hier zurueck. Die Oberflaeche zeigt nur bestaetigte Werte.

const zuhoerer = new Set();

export const state = {
  demo: true,
  audioBereit: false,
  decks: {
    A: deckLeer('A'),
    B: deckLeer('B'),
  },
  master: {
    volume: 0.8,        // 0..1 (Masterregler)
    crossfader: 0,      // -1 = nur A, 0 = Mitte, +1 = nur B
    xfKurve: 'weich',   // 'weich' (gleiche Leistung) | 'scharf' (DJ-Cut)
    xfSteuert: 'auto',  // 'video' | 'audio' | 'auto' (beides)
    limiter: true,
    meterAbgriff: 'pre', // Kanal-Meter vor ('pre') oder nach ('post') dem Kanalfader
  },
  video: { ansicht: 'video' },   // 'video' | 'audio' | 'link'
  queue: [],                     // [{ id, track }]
  automix: false,
  layout: { jog: 'innen' },      // 'innen' wie Bild 2 | 'aussen' wie Text des Auftrags
};

function deckLeer(id) {
  return {
    id,
    track: null,          // { id, titel, kuenstler, genre, dauer, bpm, key, grid, quelle, faehig }
    laden: false,
    spielt: false,
    pos: 0,               // Sekunden (nur fuer Anzeige, wird je Frame gelesen)
    cue: 0,
    tempo: 0,             // Prozent
    tempoBereich: 10,     // +-6 / +-10 / +-16
    sync: false,
    master: false,        // Tempo-Referenz fuer SYNC
    quant: true,
    slip: false,
    vinyl: true,
    beatgrid: true,
    loop: { an: false, start: 0, ende: 0, beats: 0 },
    trim: 0,              // dB  -12..+12
    eq: { high: 0, mid: 0, low: 0 },  // dB -26..+6
    filter: 0,            // -1 Tiefpass .. 0 aus .. +1 Hochpass
    fader: 0.85,          // 0..1
    favorit: false,
    meldung: '',
  };
}

export function abonnieren(fn) { zuhoerer.add(fn); return () => zuhoerer.delete(fn); }

// Bestaetigten Wert setzen (nur Engine / main.js). pfad: 'decks.A.eq.high'
export function bestaetigen(pfad, wert) {
  const teile = pfad.split('.');
  let o = state;
  for (let i = 0; i < teile.length - 1; i++) o = o[teile[i]];
  const k = teile[teile.length - 1];
  if (o[k] === wert) return;
  o[k] = wert;
  for (const fn of zuhoerer) fn(pfad, wert);
}

export function lesen(pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
}

export function melden(pfad) { for (const fn of zuhoerer) fn(pfad, lesen(pfad)); }
