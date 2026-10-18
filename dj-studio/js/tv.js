// TV-Ansicht (?tv): das Studio im DJ-Modus der YouTube-Musik. Es spielt selbst
// keinen Ton und laedt nichts - der Ton kommt weiter von mpv. Das Dashboard
// (index.html) schickt per postMessage, was laeuft; hier wird es angezeigt:
//   Kanal "auf Sendung" = laufender Song, anderer Kanal = naechster Song,
//   Leiste = Warteschlange. Bei jedem Songwechsel uebernimmt der andere Kanal,
//   der alte laeuft waehrend der Blende aus, der Crossfader wandert hinueber.
//
// Nachrichten:
//   { typ: 'ytm-dj', jetzt, naechster, schlange, blende }   blende = Ueberblendung in s
//     jetzt     = { videoId, titel, kuenstler, genre, jahr, dauer, pos, pausiert }
//     naechster = { videoId, titel, kuenstler, genre, jahr, dauer } | null
//   { typ: 'ytm-dj-spur', spur }  Messung des Supervisors je Song (Objekt oder JSON-Text):
//     { videoId, proSek, dauer, bpm, versatz, sicher, spitze, tief, mitte, hoch,
//       pegelSpitze, pegelRms }  - Reihen als base64-Bytes, siehe spur_messen().
//
// Wellenform, BPM und Pegel sind gemessen (vorab, ueber den ganzen Song), nicht
// live abgegriffen; eine Tonart gibt es nicht.

import { state, bestaetigen } from './store.js';

let xfSek = 4;               // so lange laeuft der alte Song aus (Blende am TV: 4/6/9 s, kommt mit)
const SPRUNG_SEK = 0.8;      // erst ab dieser Abweichung die Position neu setzen
const SICHER_MIN = 0.93;     // Tempo beider Songhaelften gleich: Taktraster; sonst BPM nur ungefaehr

const anderer = id => (id === 'A' ? 'B' : 'A');
const bytes = b64 => Uint8Array.from(atob(b64 || ''), c => c.charCodeAt(0));

// Messung -> Wellenform (wie analysis.js) und Pegelreihen
function spurLesen(roh) {
  const s = typeof roh === 'string' ? JSON.parse(roh) : roh;
  const lin = b => Float32Array.from(bytes(b), x => x / 255);
  const db = b => Float32Array.from(bytes(b), x => (x ? x * 60 / 255 - 60 : -Infinity));
  const spitze = lin(s.spitze);
  return {
    videoId: s.videoId, bpm: s.bpm, versatz: s.versatz || 0, sicher: s.sicher || 0,
    wf: { faecher: spitze.length, proSek: s.proSek, dauer: s.dauer, spitze, tief: lin(s.tief), mitte: lin(s.mitte), hoch: lin(s.hoch) },
    pegelSpitze: db(s.pegelSpitze), pegelRms: db(s.pegelRms),
  };
}

export function tvBauen(engine) {
  const spuren = new Map();          // videoId -> spurLesen()
  let luft = 'A';                    // Kanal mit dem laufenden Song
  let stand = { pos: 0, zeit: 0, spielt: false };
  let auslauf = null;                // { id, pos, zeit, bis } alter Song in der Blende
  let blende = null;                 // { von, nach, ab }
  let naechster = null;
  const jetztS = () => performance.now() / 1000;

  function track(t) {
    if (!t || !t.videoId) return null;
    const sp = spuren.get(t.videoId);
    const sicher = sp && sp.bpm && sp.sicher >= SICHER_MIN;
    return {
      id: 'yt-' + t.videoId, videoId: t.videoId,
      titel: t.titel || '—', kuenstler: t.kuenstler || '',
      genre: [t.genre, t.jahr].filter(Boolean).join(' · '),
      dauer: Number(t.dauer) || (sp ? sp.wf.dauer : 0),
      bpm: sp && sp.bpm ? Math.round(sp.bpm) : null,
      bpmMess: sp && sp.bpm && !sicher ? sp.bpm : null,          // ungefaehr: ohne Taktraster
      grid: sicher ? { bpm: sp.bpm, offset: sp.versatz, herkunft: 'messung' } : null,
      key: null, quelle: 'YOUTUBE', wf: sp ? sp.wf : null,
      wfHinweis: 'YOUTUBE · WELLENFORM WIRD GEMESSEN',
      coverUrl: /^[A-Za-z0-9_-]{11}$/.test(t.videoId) ? `https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg` : '',
    };
  }

  function setzen(id, roh, spielt) {
    const t = track(roh), alt = state.decks[id].track;
    if (!t) { if (alt) bestaetigen(`decks.${id}.track`, null); }
    else if (!alt || alt.id !== t.id || alt.titel !== t.titel || alt.dauer !== t.dauer || alt.wf !== t.wf) {
      bestaetigen(`decks.${id}.track`, t);
    }
    bestaetigen(`decks.${id}.spielt`, spielt);
  }

  let jetztRoh = null;
  function empfangen(d) {
    const j = d.jetzt && d.jetzt.videoId ? d.jetzt : null;
    naechster = d.naechster || null;
    if ([4, 6, 9].includes(d.blende)) xfSek = d.blende;
    const t = jetztS(), pos = Number(j?.pos) || 0, spielt = !!j && !j.pausiert;
    const aktuell = state.decks[luft].track;
    if (j && aktuell && aktuell.videoId !== j.videoId) {
      // Songwechsel: der andere Kanal uebernimmt, der alte laeuft in der Blende aus.
      const alt = luft;
      auslauf = { id: alt, pos: state.decks[alt].pos, zeit: t, bis: t + xfSek };
      luft = anderer(alt);
      blende = { von: state.master.crossfader, nach: luft === 'A' ? -1 : 1, ab: t };
      stand = { pos, zeit: t, spielt };
    } else {
      // Gleicher Song: nur bei echtem Sprung (Spulen, Pause) neu setzen - sonst ruckelt der Teller.
      const erwartet = stand.pos + (stand.spielt ? t - stand.zeit : 0);
      if (!j || spielt !== stand.spielt || Math.abs(pos - erwartet) > SPRUNG_SEK) stand = { pos, zeit: t, spielt };
    }
    jetztRoh = j;
    setzen(luft, j, spielt);
    if (!auslauf) setzen(anderer(luft), naechster, false);
    if (!blende) engine.request('master.crossfader', luft === 'A' ? -1 : 1);
    const q = (Array.isArray(d.schlange) ? d.schlange : []).map(track).filter(Boolean);
    if (q.map(x => x.id).join('|') !== state.queue.map(x => x.id).join('|')) {
      bestaetigen('queue', q.map(x => ({ id: x.id, track: x })));
    }
  }

  function spurNeu(roh) {
    const sp = spurLesen(roh);
    spuren.set(sp.videoId, sp);
    for (const k of [...spuren.keys()].slice(0, -6)) spuren.delete(k);
    // liegt der Song schon auf einem Kanal oder in der Leiste: mit Messwerten neu zeigen
    for (const id of ['A', 'B']) {
      const tr = state.decks[id].track;
      if (tr && tr.videoId === sp.videoId) setzen(id, { ...tr, genre: tr.genre }, state.decks[id].spielt);
    }
    if (state.queue.some(q => q.track.videoId === sp.videoId)) {
      bestaetigen('queue', state.queue.map(q => (q.track.videoId === sp.videoId ? { ...q, track: track(q.track) } : q)));
    }
  }

  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data) return;
    try {
      if (e.data.typ === 'ytm-dj') empfangen(e.data);
      else if (e.data.typ === 'ytm-dj-spur') spurNeu(e.data.spur);
    } catch (err) { console.error('[DJ Studio TV]', err); }
  });

  // ---- Pegel aus der Messung statt aus Web Audio ----------------------------
  const STILL = { spitze: 0, rms: 0 };
  function pegelBei(id) {
    const d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
    if (!d.spielt || !sp) return STILL;
    const i = Math.floor(d.pos * sp.wf.proSek);
    if (i < 0 || i >= sp.pegelSpitze.length) return STILL;
    // Spitze ueber 50 ms (5 Faecher), damit kurze Spitzen nicht verloren gehen
    let s = -Infinity;
    for (let k = Math.max(0, i - 4); k <= i; k++) s = Math.max(s, sp.pegelSpitze[k]);
    const lin = db => (db > -60 ? Math.pow(10, db / 20) : 0);
    return { spitze: lin(s), rms: lin(sp.pegelRms[i]) };
  }
  for (const id of ['A', 'B']) {
    const de = engine.decks[id];
    de.pegel = () => { const p = pegelBei(id); return { L: p, R: p }; };
    de.meterPost.lesen = de.pegel;
    de.meterPre.lesen = de.pegel;
  }
  engine.masterPegel = () => {
    const m = { spitze: 0, rms: 0 };
    for (const id of ['A', 'B']) {
      const p = pegelBei(id), g = engine.xfPegel(id);
      m.spitze = Math.max(m.spitze, p.spitze * g);
      m.rms = Math.sqrt(m.rms * m.rms + (p.rms * g) ** 2);
    }
    return { L: m, R: m, reduktion: 0 };
  };

  return {
    // je Frame statt engine.takt(): Positionen hochrechnen, Blende fahren
    takt() {
      const t = jetztS();
      const d = state.decks[luft];
      if (d.track) {
        const p = stand.pos + (stand.spielt ? t - stand.zeit : 0);
        d.pos = Math.min(d.track.dauer || p, Math.max(0, p));
      }
      if (auslauf) {
        const a = state.decks[auslauf.id];
        if (a.track) a.pos = Math.min(a.track.dauer || Infinity, auslauf.pos + (t - auslauf.zeit));
        if (t >= auslauf.bis) {
          const frei = auslauf.id;
          auslauf = null;
          setzen(frei, naechster, false);
          state.decks[frei].pos = 0;
        }
      }
      if (blende) {
        const a = Math.min(1, (t - blende.ab) / xfSek);
        const k = (1 - Math.cos(a * Math.PI)) / 2;
        engine.request('master.crossfader', blende.von + (blende.nach - blende.von) * k);
        if (a >= 1) blende = null;
      }
    },
  };
}
