// TV-Ansicht (?tv): das Studio im DJ-Modus der YouTube-Musik. Es spielt selbst
// keinen Ton und laedt nichts - der Ton kommt weiter von mpv. Das Dashboard
// (index.html) schickt per postMessage, was laeuft; hier wird es angezeigt:
//   Kanal "auf Sendung" = laufender Song, anderer Kanal = naechster Song,
//   Leiste = Warteschlange. Bei jedem Songwechsel uebernimmt der andere Kanal,
//   der alte laeuft waehrend der Blende aus, der Crossfader wandert hinueber.
//
// Nachrichten:
//   { typ: 'ytm-dj', jetzt, naechster, schlange, blende, vol }
//     blende = Ueberblendung in s, vol = Lautstaerke am TV 0-100 (Fernbedienung)
//     jetzt     = { videoId, titel, kuenstler, genre, jahr, dauer, pos, pausiert }
//     naechster = { videoId, titel, kuenstler, genre, jahr, dauer } | null
//   { typ: 'ytm-dj-spur', spur }  Messung des Supervisors je Song (Objekt oder JSON-Text):
//     { videoId, proSek, dauer, bpm, versatz, sicher, spitze, tief, mitte, hoch,
//       pegelSpitzeL, pegelRmsL, pegelSpitzeR, pegelRmsR }  - Reihen als base64-Bytes,
//       siehe spur_messen() im Supervisor.
//
// Wellenform, BPM und Pegel sind gemessen (vorab, ueber den ganzen Song), nicht
// live abgegriffen; eine Tonart gibt es nicht.

import { state, bestaetigen } from './store.js';

// Ton-Fenster der Ueberblendung wie im Supervisor (XF_TON_FENSTER_SEK, DJ-Kurve 16.10.2026):
// der Ton wechselt nur kurz in der Mitte der Blende - genau dann faehrt der Crossfader.
const XF_TON_FENSTER_SEK = 2.0;
let xfSek = 4;               // so lange laeuft der alte Song aus (Blende am TV: 4/6/9 s, kommt mit)
const SPRUNG_SEK = 0.8;      // ab dieser Abweichung die Position sofort neu setzen,
                             // kleinere holt takt() weich auf (Jogwheel ruckelt nicht)
// Pegelanzeige wie am Mischpult: YouTube ist bis 0 dBFS gemastert, darum an den Kanaelen
// 5 dB Reserve (Trim auf 0). Der Master zeigt den Ton nach der Lautstaerke der Fernbedienung.
const RESERVE_DB = -5;
const SICHER_MIN = 0.93;     // Tempo beider Songhaelften gleich: Taktraster; sonst BPM nur ungefaehr

const anderer = id => (id === 'A' ? 'B' : 'A');
const bytes = b64 => Uint8Array.from(atob(b64 || ''), c => c.charCodeAt(0));

// Anzeige wie in Bild 2 (Fotos der Vorlage): stachelig - spitze Schlaege, jede Nadel anders hoch,
// Songteile erkennbar. Die Spitzen taugen dafuer nicht: laut gemasterte Titel stossen in jedem
// Schlag an dieselbe Decke (flache Bloecke). Die Lautheit je 5 ms schwankt auch darunter.
// Gewaehlt am echten Song neben den Fotos (Variante F, 18.10.2026): 60 % Lautheit + 40 % Bass,
// je Song gespreizt (leiseste 5 % = Grundlinie, Exponent 1,8).
function bildWerte(rms, tief) {
  const roh = rms.map((r, i) => 0.6 * r + 0.4 * Math.min(1, tief[i] * 1.7));
  const sortiert = Float32Array.from(roh).sort();
  const lo = sortiert[Math.floor(roh.length * 0.05)] || 0, hi = sortiert[Math.floor(roh.length * 0.995)] || 1;
  return roh.map(x => Math.pow(Math.min(1, Math.max(0, (x - lo) / ((hi - lo) || 1))), 1.8));
}

// Messung -> Wellenform (wie analysis.js) und Pegelreihen
function spurLesen(roh) {
  const s = typeof roh === 'string' ? JSON.parse(roh) : roh;
  // Laute YouTube-Titel: wie sie gezeichnet werden, regelt waveform.js (zeichneSpalteTv)
  const lin = b => Float32Array.from(bytes(b), x => x / 255);
  const db = b => Float32Array.from(bytes(b), x => (x ? x * 60 / 255 - 60 : -Infinity));
  const spitze = lin(s.spitze), tief = lin(s.tief);
  const pegel = ['L', 'R'].map(k => ({
    spitze: db(s['pegelSpitze' + k] || s.pegelSpitze),
    leistung: Float32Array.from(db(s['pegelRms' + k] || s.pegelRms), x => (isFinite(x) ? Math.pow(10, x / 10) : 0)),
  }));
  const rms = Float32Array.from(pegel[0].leistung, (l, i) => Math.sqrt(Math.max(l, pegel[1].leistung[i])));
  return {
    videoId: s.videoId, bpm: s.bpm, versatz: s.versatz || 0, sicher: s.sicher || 0,
    wf: { faecher: spitze.length, proSek: s.proSek, dauer: s.dauer, spitze, tief, mitte: lin(s.mitte), hoch: lin(s.hoch),
          bild: bildWerte(rms, tief) },
    pegel,   // je Seite: Spitze (dBFS) und Leistung (linear^2) fuer die Meter
  };
}

export function tvBauen(engine) {
  const spuren = new Map();          // videoId -> spurLesen()
  let luft = 'A';                    // Kanal mit dem laufenden Song
  let stand = { pos: 0, zeit: 0, spielt: false };
  let auslauf = null;                // { id, pos, zeit, bis } alter Song in der Blende
  let blende = null;                 // { von, nach, ab }
  let nachziehen = 0;                // kleine Abweichung zu mpv, wird in takt() abgebaut
  let naechster = null;
  let vol = null;                    // Lautstaerke am TV (0-100)
  // mpv rechnet die Lautstaerke kubisch: 50 % = 0,125 = -18 dB
  const lautFaktor = () => (vol === null ? 1 : Math.pow(vol / 100, 3));
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
    if (typeof d.vol === 'number' && d.vol !== vol) {
      vol = Math.max(0, Math.min(100, d.vol));
      engine.request('master.volume', 0.8 * lautFaktor());   // Knopf: 0,8 = 0 dB
    }
    const t = jetztS(), pos = Number(j?.pos) || 0, spielt = !!j && !j.pausiert;
    const aktuell = state.decks[luft].track;
    if (j && aktuell && aktuell.videoId !== j.videoId) {
      // Songwechsel: der andere Kanal uebernimmt, der alte laeuft in der Blende aus.
      const alt = luft;
      auslauf = { id: alt, pos: state.decks[alt].pos, zeit: t, bis: t + xfSek };
      luft = anderer(alt);
      blende = { von: state.master.crossfader, nach: luft === 'A' ? -1 : 1, ab: t };
      stand = { pos, zeit: t, spielt }; nachziehen = 0;
    } else {
      // Gleicher Song: bei echtem Sprung (Spulen, Pause) neu setzen, sonst weich nachziehen
      const erwartet = stand.pos + (stand.spielt ? t - stand.zeit : 0);
      if (!j || spielt !== stand.spielt || Math.abs(pos - erwartet) > SPRUNG_SEK) { stand = { pos, zeit: t, spielt }; nachziehen = 0; }
      else nachziehen = pos - erwartet;
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

  // Das Dashboard skaliert seine 1920er-Buehne (und damit diesen Rahmen) aufs Fenster:
  // ohne diesen Faktor zeichneten Wellen und Meter grob und wuerden hochgezogen.
  function skalaLesen() {
    try {
      const s = parent.document.getElementById('dashboard-scaler');
      window.studioZusatzSkala = s ? Math.max(1, s.getBoundingClientRect().width / 1920) : 1;
    } catch (e) { window.studioZusatzSkala = 1; }
  }
  skalaLesen();
  setInterval(skalaLesen, 2000);

  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data) return;
    try {
      if (e.data.typ === 'ytm-dj') empfangen(e.data);
      else if (e.data.typ === 'ytm-dj-spur') spurNeu(e.data.spur);
    } catch (err) { console.error('[DJ Studio TV]', err); }
  });

  // ---- Pegel aus der Messung statt aus Web Audio ----------------------------
  // Wie am Mischpult: Balken = Lautheit ueber 50 ms (Ballistik in meter.js), Spitze 30 ms, links/rechts.
  const VU_FAECHER = 5, SPITZE_FAECHER = 3, RESERVE = Math.pow(10, RESERVE_DB / 20);
  const STILL = { L: { spitze: 0, rms: 0 }, R: { spitze: 0, rms: 0 } };
  function pegelBei(id) {
    const d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
    if (!d.spielt || !sp) return STILL;
    const i = Math.floor(d.pos * sp.wf.proSek);
    if (i < 0 || i >= sp.pegel[0].spitze.length) return STILL;
    const [L, R] = sp.pegel.map(p => {
      let s = -Infinity, q = 0;
      for (let k = Math.max(0, i - SPITZE_FAECHER + 1); k <= i; k++) s = Math.max(s, p.spitze[k]);
      const von = Math.max(0, i - VU_FAECHER + 1);
      for (let k = von; k <= i; k++) q += p.leistung[k];
      return { spitze: s > -60 ? Math.pow(10, s / 20) * RESERVE : 0, rms: Math.sqrt(q / (i - von + 1)) * RESERVE };
    });
    return { L, R };
  }
  for (const id of ['A', 'B']) {
    const de = engine.decks[id];
    de.pegel = () => pegelBei(id);
    de.meterPost.lesen = de.pegel;
    de.meterPre.lesen = de.pegel;
  }
  engine.masterPegel = () => {
    const m = { L: { spitze: 0, rms: 0 }, R: { spitze: 0, rms: 0 }, reduktion: 0 };
    const laut = lautFaktor();
    for (const id of ['A', 'B']) {
      // Master-Skala hat eigene Reserve (+9 = 0 dBFS): die Kanal-Reserve wieder heraus
      const p = pegelBei(id), g = engine.xfPegel(id) * laut / RESERVE;
      for (const k of ['L', 'R']) {
        m[k].spitze = Math.max(m[k].spitze, p[k].spitze * g);
        m[k].rms = Math.sqrt(m[k].rms ** 2 + (p[k].rms * g) ** 2);
      }
    }
    return m;
  };

  return {
    // je Frame statt engine.takt(): Positionen hochrechnen, Blende fahren
    takt() {
      const t = jetztS();
      const d = state.decks[luft];
      if (nachziehen) {                   // in ~0,5 s aufholen
        const schritt = nachziehen * Math.min(1, (t - (this.letzte || t)) * 3);
        stand.pos += schritt; nachziehen -= schritt;
        if (Math.abs(nachziehen) < 0.002) nachziehen = 0;
      }
      this.letzte = t;
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
        const lauf = t - blende.ab, fenster = Math.min(XF_TON_FENSTER_SEK, xfSek * 0.4);
        const q = Math.min(1, Math.max(0, (lauf - (xfSek - fenster) / 2) / fenster));
        // Crossfader-Kurve 'weich' = gleiche Leistung (cos/sin) wie die Ton-Blende von mpv
        engine.request('master.crossfader', blende.von + (blende.nach - blende.von) * q);
        if (lauf >= xfSek) blende = null;
      }
    },
  };
}
