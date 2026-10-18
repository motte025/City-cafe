// TV-Ansicht (?tv): das Studio im DJ-Modus der YouTube-Musik. Es spielt selbst
// keinen Ton und laedt nichts - der Ton kommt weiter von mpv (bzw. im Browser
// ohne Supervisor vom YouTube-Player des Dashboards). Das Dashboard (index.html)
// schickt per postMessage, was laeuft; hier wird es nur angezeigt:
//   Kanal "auf Sendung" = laufender Song, anderer Kanal = naechster Song,
//   Leiste = Warteschlange. Beim Songwechsel wandert der Crossfader hinueber.
//
// Nachricht: { typ: 'ytm-dj', jetzt, naechster, schlange }
//   jetzt     = { videoId, titel, kuenstler, genre, jahr, dauer, pos, pausiert }
//   naechster = { videoId, titel, kuenstler, genre, jahr, dauer } | null
//   schlange  = [ gleiche Form wie naechster ]
//
// Ehrlich bleiben: BPM, Tonart, Wellenform und Pegel gibt es bei YouTube nicht.

import { state, bestaetigen } from './store.js';

const XF_SEK = 2.5;          // so lange wandert der Crossfader beim Songwechsel

function track(t) {
  if (!t || !t.videoId) return null;
  const genre = [t.genre, t.jahr].filter(Boolean).join(' · ');
  return {
    id: 'yt-' + t.videoId, videoId: t.videoId,
    titel: t.titel || '—', kuenstler: t.kuenstler || '',
    genre, dauer: Number(t.dauer) || 0, bpm: null, key: null, grid: null,
    quelle: 'YOUTUBE', wfHinweis: 'YOUTUBE · KEINE WELLENFORM',
    coverUrl: /^[A-Za-z0-9_-]{11}$/.test(t.videoId) ? `https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg` : '',
  };
}

const anderer = id => (id === 'A' ? 'B' : 'A');

export function tvBauen(engine) {
  let luft = 'A';                     // Kanal mit dem laufenden Song
  let stand = { pos: 0, zeit: 0, spielt: false };
  let blende = null;                  // { von, nach, ab }

  function setzen(id, t, spielt, pos) {
    const alt = state.decks[id].track;
    if (!t) { if (alt) bestaetigen(`decks.${id}.track`, null); }
    else if (!alt || alt.id !== t.id || alt.titel !== t.titel || alt.dauer !== t.dauer) bestaetigen(`decks.${id}.track`, t);
    bestaetigen(`decks.${id}.spielt`, spielt);
    state.decks[id].pos = pos;
  }

  function empfangen(d) {
    const j = track(d.jetzt), n = track(d.naechster);
    // Der naechste Song lag schon auf dem anderen Kanal: hinueberblenden.
    const neu = j && state.decks[luft].track?.id !== j.id;
    if (neu && state.decks[anderer(luft)].track?.id === j.id) {
      luft = anderer(luft);
      blende = { von: state.master.crossfader, nach: luft === 'A' ? -1 : 1, ab: performance.now() / 1000 };
    }
    const pausiert = !!d.jetzt?.pausiert;
    stand = { pos: Number(d.jetzt?.pos) || 0, zeit: performance.now() / 1000, spielt: !!j && !pausiert };
    setzen(luft, j, stand.spielt, stand.pos);
    setzen(anderer(luft), n, false, 0);
    if (!blende) engine.request('master.crossfader', luft === 'A' ? -1 : 1);
    const q = (Array.isArray(d.schlange) ? d.schlange : []).map(track).filter(Boolean);
    const alt = state.queue.map(x => x.id).join('|');
    if (q.map(t => t.id).join('|') !== alt) bestaetigen('queue', q.map(t => ({ id: t.id, track: t })));
  }

  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.typ !== 'ytm-dj') return;
    try { empfangen(e.data); } catch (err) { console.error('[DJ Studio TV]', err); }
  });

  return {
    // je Frame statt engine.takt(): Position hochrechnen, Crossfader bewegen
    takt() {
      const t = performance.now() / 1000;
      const d = state.decks[luft];
      if (d.track) {
        const p = stand.pos + (stand.spielt ? t - stand.zeit : 0);
        d.pos = Math.min(d.track.dauer || p, Math.max(0, p));
      }
      if (blende) {
        const a = Math.min(1, (t - blende.ab) / XF_SEK);
        const k = (1 - Math.cos(a * Math.PI)) / 2;
        engine.request('master.crossfader', blende.von + (blende.nach - blende.von) * k);
        if (a >= 1) blende = null;
      }
    },
  };
}
