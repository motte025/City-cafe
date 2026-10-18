// MusicSourceAdapter: jede Quelle sagt selbst, was sie kann. Die Oberflaeche
// graut alles aus, was eine Quelle nicht kann, und erklaert warum.
//
//   adapter = {
//     id, name, hinweis,
//     faehig: { abspielen, wellenform, bpm, sync, eq, video },   je 'echt' | 'demo' | 'offen' | 'gesperrt'
//     liste():  Promise<[meta]>      meta = { id, titel, kuenstler, genre, dauer, bpm, key, quelle }
//     laden(meta): Promise<{ buffer, grid?, abschnitte? }>
//   }

import { DEMO_TITEL, erzeugen } from './demo-synth.js';

const cache = new Map();

export const DEMO = {
  id: 'DEMO',
  name: 'Demo-Generator',
  hinweis: 'Im Browser erzeugte Testmusik. Tempo, Taktraster und Tonart stammen aus dem Generator (bekannt, nicht gemessen).',
  faehig: { abspielen: 'echt', wellenform: 'echt', bpm: 'demo', sync: 'echt', eq: 'echt', video: 'demo' },
  async liste() { return DEMO_TITEL.map(t => ({ ...t })); },
  async laden(meta) {
    const t = DEMO_TITEL.find(x => x.id === meta.id);
    if (!t) throw new Error('Demo-Titel unbekannt');
    if (!cache.has(t.id)) cache.set(t.id, erzeugen(t));
    return cache.get(t.id);
  },
};

const lokaleDateien = new Map();
export const LOCAL_LICENSED = {
  id: 'LOCAL_LICENSED',
  name: 'Lokale Dateien (Rechte geklärt)',
  hinweis: 'Eigene Audiodateien vom Rechner. Werden nur im Browser dekodiert, nirgends hochgeladen. BPM-Analyse ist noch offen, darum kein SYNC und kein Beat-Loop.',
  faehig: { abspielen: 'echt', wellenform: 'echt', bpm: 'offen', sync: 'offen', eq: 'echt', video: 'offen' },
  dateiHinzu(datei) {
    const id = 'lokal-' + (lokaleDateien.size + 1) + '-' + datei.name;
    const name = datei.name.replace(/\.[^.]+$/, '');
    const [kuenstler, titel] = name.includes(' - ') ? name.split(' - ', 2) : ['Lokale Datei', name];
    const meta = { id, titel, kuenstler, genre: 'Lokal', dauer: 0, bpm: null, key: null, quelle: 'LOCAL_LICENSED', farbe: 210 };
    lokaleDateien.set(id, { datei, meta });
    return meta;
  },
  async liste() { return [...lokaleDateien.values()].map(x => x.meta); },
  async laden(meta, ctx) {
    const e = lokaleDateien.get(meta.id);
    if (!e) throw new Error('Datei nicht mehr verfügbar');
    if (!cache.has(meta.id)) {
      cache.set(meta.id, e.datei.arrayBuffer().then(ab => ctx.decodeAudioData(ab)).then(buffer => ({ buffer, grid: null })));
    }
    return cache.get(meta.id);
  },
};

export const EXISTING_YOUTUBE = {
  id: 'EXISTING_YOUTUBE',
  name: 'YouTube (bestehende TV-Musik)',
  hinweis: 'Nur Titelinformationen aus yt_playlists.json. Kein Laden, keine Analyse, kein Mitschnitt: YouTube Music Premium ist keine freigegebene DJ-Dateiquelle. Wiedergabe bleibt beim bestehenden TV-System.',
  faehig: { abspielen: 'gesperrt', wellenform: 'gesperrt', bpm: 'gesperrt', sync: 'gesperrt', eq: 'gesperrt', video: 'gesperrt' },
  async liste() {
    try {
      const r = await fetch('../yt_playlists.json', { cache: 'no-store' });
      const pl = await r.json();
      return pl.flatMap(p => (p.titel || []).slice(0, 40).map(t => ({
        id: 'yt-' + t.videoId, titel: t.songtitel || t.titel, kuenstler: t.kuenstler || t.kanal, genre: p.name,
        dauer: t.dauerSek || 0, bpm: null, key: null, quelle: 'EXISTING_YOUTUBE', gesperrt: true,
      })));
    } catch (e) { return []; }
  },
  async laden() { throw new Error('YouTube ist als DJ-Quelle nicht freigegeben'); },
};

export const ADAPTER = { DEMO, LOCAL_LICENSED, EXISTING_YOUTUBE };

export function quellen(engine) {
  return {
    laden: meta => {
      const a = ADAPTER[meta.quelle];
      if (!a) return Promise.reject(new Error('Unbekannte Quelle'));
      return a.laden(meta, engine.ctx);
    },
  };
}

// Feature-Matrix fuer README und LINK-Ansicht
export const MATRIX = [
  ['Zwei Decks gleichzeitig, Play/Pause/Cue/Seek', 'echt', 'Web Audio, je Deck eigene Kette'],
  ['Trim, EQ Hoch/Mitte/Tief, Filter', 'echt', 'Biquad-Filter, hörbar und an den Metern sichtbar'],
  ['Kanalfader, Crossfader, Master, Limiter', 'echt', 'Limiter = Web-Audio-Kompressor bei −1 dBFS'],
  ['Pegel A/B (PRE/POST) und Master', 'echt', 'aus dem Signal gemessen (Analyser), Spitze + RMS'],
  ['Wellenform Detail + Übersicht', 'echt', 'aus dem dekodierten PCM berechnet'],
  ['BPM / Tonart', 'nur Demo', 'Generator-Werte; Analyse für fremde Dateien offen'],
  ['SYNC (Tempo + Taktphase)', 'echt (Demo)', 'nur mit bekanntem Taktraster, sonst gesperrt'],
  ['Beat-Loops, Slip, Quantisierung', 'echt (Demo)', 'braucht Taktraster'],
  ['Key-Lock (Tempo ohne Tonhöhe)', 'technisch offen', 'Web-Audio-Quelle ändert Tonhöhe mit'],
  ['Automix', 'echt (Demo)', '16 Takte vor Ende, Bass-Tausch, Taktgenau'],
  ['Video A/B', 'nur Demo', 'Demo-Visual aus dem Master-Signal, kein Musikvideo'],
  ['Vorhören (CUE-Kopfhörer)', 'technisch offen', 'braucht eigenen Kopfhörer-Ausgang; nie über die Anlage'],
  ['YouTube als DJ-Quelle', 'nicht freigegeben', 'Rechte/Technik: keine Analyse, kein Download'],
  ['TV-Ausgabe / W1 / Firebase', 'nicht verbunden', 'Prototyp läuft getrennt vom Café-Betrieb'],
];
