// Automix: 16 Takte vor Ende des laufenden Titels startet der naechste auf
// dem anderen Deck - Tempo angeglichen und taktgenau (Takt 1 auf Takt 1).
// Takt 0-8: Crossfader zur Mitte, Takt 8: Bass-Tausch, Takt 8-15: ganz hinueber.
// Nur mit Taktraster; ohne Raster einfache 10-Sekunden-Blende.

import { state, bestaetigen } from './store.js';

const TAKTE = 16;

export function automixBauen(engine, aktionen) {
  let lauf = null;       // { p, q, start }
  let laedt = false;

  const anderes = id => (id === 'A' ? 'B' : 'A');
  const seite = id => (id === 'A' ? -1 : 1);

  function laufend() {
    const a = state.decks.A.spielt, b = state.decks.B.spielt;
    if (lauf) return lauf.p;
    if (a && !b) return 'A';
    if (b && !a) return 'B';
    if (a && b) return engine.aufSendung();
    return null;
  }

  // bereit = geladen, noch nicht gespielt, nicht am Ende
  const bereit = id => { const d = state.decks[id]; return !!d.track && !d.track.gespielt && d.pos < d.track.dauer - 0.5; };

  async function bereitstellen(q) {
    const d = state.decks[q];
    if (laedt || d.spielt) return;
    if (bereit(q)) return;
    if (!state.queue.length) return;
    laedt = true;
    await aktionen.naechstenLaden(q);
    laedt = false;
  }

  function starten(p, q, sofort) {
    const P = state.decks[p], Q = state.decks[q];
    if (!bereit(q) || Q.spielt) return false;
    const dp = engine.decks[p], dq = engine.decks[q];
    engine.request(`decks.${q}.eq.low`, -26);
    let start = 0;
    if (P.track.grid && Q.track.grid) {
      engine.sync(q);
      const b = (P.pos - P.track.grid.offset) / (60 / P.track.grid.bpm);
      const imTakt = ((b % 4) + 4) % 4;
      start = Q.track.grid.offset + imTakt * (60 / Q.track.grid.bpm);
    }
    dq.springen(start);
    dq.spielen();
    if (P.track.grid && Q.track.grid) dq.phaseAngleichen(dp);
    lauf = { p, q, start: engine.jetzt, grid: !!(P.track.grid && Q.track.grid), dauer: sofort ? 8 : TAKTE };
    return true;
  }

  function fortschritt() {
    const { p, q } = lauf;
    const Q = state.decks[q];
    let anteil;
    if (lauf.grid) {
      const beats = (Q.pos - Q.track.grid.offset) / (60 / Q.track.grid.bpm);
      anteil = beats / (lauf.dauer * 4);
    } else anteil = (engine.jetzt - lauf.start) / 10;
    anteil = Math.max(0, Math.min(1, anteil));
    const x = anteil < 0.5 ? seite(p) * (1 - anteil * 2) : seite(q) * Math.min(1, (anteil - 0.5) * 2 / 0.94);
    engine.request('master.crossfader', x);
    if (anteil >= 0.5 && !lauf.bassGetauscht) {
      lauf.bassGetauscht = true;
      engine.request(`decks.${q}.eq.low`, 0);
      engine.request(`decks.${p}.eq.low`, -26);
    }
    if (anteil >= 1 || !state.decks[p].spielt) {
      if (state.decks[p].spielt) engine.decks[p].anhalten();
      bestaetigen(`decks.${p}.track`, { ...state.decks[p].track, gespielt: true });
      engine.request(`decks.${p}.eq.low`, 0);
      engine.request(`decks.${q}.eq.low`, 0);
      engine.request('master.crossfader', seite(q));
      lauf = null;
    }
  }

  return {
    takt() {
      if (!state.automix) { if (lauf) { engine.request(`decks.${lauf.q}.eq.low`, 0); lauf = null; } return; }
      if (lauf) return fortschritt();
      const p = laufend();
      if (!p) {
        // nichts laeuft: ersten bereiten Titel starten
        const id = ['A', 'B'].find(bereit);
        if (id) { engine.request('master.crossfader', seite(id)); engine.decks[id].spielen(); }
        else bereitstellen('A');
        return;
      }
      const q = anderes(p), P = state.decks[p];
      bereitstellen(q);
      const rest = P.track.dauer - P.pos;
      const grenze = P.track.grid ? TAKTE * 4 * 60 / (P.track.grid.bpm * (1 + P.tempo / 100)) : 10;
      if (rest <= grenze && !P.loop.an) starten(p, q, false);
    },
    // Taste "Weiter": Uebergang sofort (8 Takte)
    async jetzt() {
      if (lauf) return;
      const p = laufend();
      if (!p) return;
      const q = anderes(p);
      await bereitstellen(q);
      if (!state.automix) bestaetigen('automix', true);
      starten(p, q, true);
    },
  };
}
