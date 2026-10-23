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
// Wellenform, BPM, Tonart und Pegel sind gemessen (vorab, ueber den ganzen Song), nicht
// live abgegriffen. Die Tonart ist ungefaehr (oft Paralleltonart oder Quinte daneben).

import { state, bestaetigen } from './store.js';

// Ueberblendung wie im Supervisor (seit 21.10.2026 fest 9 s, genau berechnet): der Ton wechselt
// in XF_TON_FENSTER_SEK ab dem Musikanfang des neuen Songs (dann endet die Musik des alten) -
// genau dann faehrt der Crossfader. Der Songwechsel kommt, wenn der neue Song losgeht.
const XF_TON_FENSTER_SEK = 0.5;     // wie im Supervisor (22.10.2026: 0,5 statt 2 s)
const xfSek = 9;             // Notbremse: so lange laeuft der alte Song hoechstens aus
const SPRUNG_SEK = 0.8;      // ab dieser Abweichung die Position sofort neu setzen,
                             // kleinere holt takt() weich auf (Jogwheel ruckelt nicht)
const NACHZIEHEN_AB_SEK = 0.02;   // kleinere Abweichungen zu mpv: nicht korrigieren
const NACHZIEHEN_TEMPO = 0.03;    // groessere: mit hoechstens 3 % Tempo-Aenderung aufholen
// Pegelanzeige: Kanaele und Master zeigen, was aus der Anlage kommt - Song x Lautheitsanpassung
// (je Song, wie mpv) x Lautstaerke der Fernbedienung. Rot nur bei 100 % und dann "ein bisschen":
// simuliert ueber 11 Songs (18.10.): +1 dB = 4,7 % der Zeit rot (21.10.: zu viel), 0 dB = 1,3 %
// (zu wenig) - daher +0,5 dB. Bei 80 % nie rot. Rot = oberste 3-4 LEDs.
// 21.10.: Betreiber will mehr (1,5), dann 0,5 dB zurueck (1,0) - bei 100 % ab und zu CLIP.
// +3 dB, seit der Supervisor auf -14 statt -11 LUFS normiert: die Anzeige bleibt wie vorher
// (im Cafe holt die Endstufe die 3 dB wieder).
const RESERVE_DB = 4.0;
// Anzeige hoeher (Betreiber 21.10.): +3 dB im unteren/mittleren Bereich, laeuft bis -3 dBFS
// auf 0 aus - der rote Bereich (oberste LEDs) bleibt so selten wie oben abgestimmt.
const ANHEBEN_DB = 3, ANHEBEN_BIS_DB = -3, ANHEBEN_VOLL_DB = -12;
function anheben(x) {
  if (!(x > 0)) return x;
  const db = 20 * Math.log10(x);
  const a = ANHEBEN_DB * Math.min(1, Math.max(0, (ANHEBEN_BIS_DB - db) / (ANHEBEN_BIS_DB - ANHEBEN_VOLL_DB)));
  return x * Math.pow(10, a / 20);
}
const SICHER_MIN = 0.93;     // Tempo beider Songhaelften gleich (Supervisor)
const DEUTLICH_MIN = 0.06;   // Bass-Einsaetze auf dem verfeinerten Tempo (0-1); Sugar falsch: 0,011

const anderer = id => (id === 'A' ? 'B' : 'A');
// Anzeige-Vorlauf (s): gleicht Verzoegerungen zwischen mpv und dem, was man hoert/sieht, aus
// (Bluetooth meldet seine Verzoegerung nicht). Positiv = Welle/Meter frueher. Einstellbar per
// localStorage 'studioVorlauf' (Test: per CDP), Standard STUDIO_VORLAUF_SEK.
const STUDIO_VORLAUF_SEK = 0;
let vorlaufWert = STUDIO_VORLAUF_SEK, vorlaufGelesen = 0;
function vorlauf() {
  const t = performance.now();
  if (t - vorlaufGelesen > 1000) {
    vorlaufGelesen = t;
    try { const v = parseFloat(localStorage.getItem('studioVorlauf')); vorlaufWert = isFinite(v) ? Math.max(-1, Math.min(1, v)) : STUDIO_VORLAUF_SEK; } catch (e) {}
  }
  return vorlaufWert;
}
const bytes = b64 => Uint8Array.from(atob(b64 || ''), c => c.charCodeAt(0));

// Anzeige wie in Bild 2 (Fotos der Vorlage): stachelig - spitze Schlaege, jede Nadel anders hoch,
// Songteile erkennbar. Die Spitzen taugen dafuer nicht: laut gemasterte Titel stossen in jedem
// Schlag an dieselbe Decke (flache Bloecke). Die Lautheit je 5 ms schwankt auch darunter.
// Gewaehlt am echten Song neben den Fotos (18.10.2026): 50 % Lautheit, 20 % Bass, 30 % Hoehen
// (Bass allein gibt runde Boegen, die Hoehen die feinen Nadeln), je Song gespreizt
// (leiseste 5 % = Grundlinie, Exponent 1,8).
function bildWerte(rms, tief, hoch) {
  const roh = rms.map((r, i) => 0.5 * r + 0.2 * Math.min(1, tief[i] * 1.7) + 0.3 * Math.min(1, hoch[i] * 3));
  const sortiert = Float32Array.from(roh).sort();
  const lo = sortiert[Math.floor(roh.length * 0.05)] || 0, hi = sortiert[Math.floor(roh.length * 0.995)] || 1;
  return roh.map(x => Math.pow(Math.min(1, Math.max(0, (x - lo) / ((hi - lo) || 1))), 1.8));
}

// Die Messung kennt die Schlaege (versatz = ein Schlag), nicht die "Eins" des Takts. Die Eins ist
// der Schlag, auf dem ueber den ganzen Song am meisten Bass liegt (je 4. Schlag aufsummiert).
function taktEins(tief, proSek, bpm, versatz) {
  if (!bpm) return versatz;
  const schlag = 60 / bpm, summen = [0, 0, 0, 0];
  for (let k = 0, t = versatz; ; k++, t += schlag) {
    const i = Math.round(t * proSek);
    if (i >= tief.length) break;
    for (let j = Math.max(0, i - 2); j <= Math.min(tief.length - 1, i + 2); j++) summen[k % 4] += tief[j];
  }
  return versatz + summen.indexOf(Math.max(...summen)) * schlag;
}

// Tempo genau (21.10.2026): die Messung im Supervisor liegt bis 0,8 BPM daneben - das Taktraster
// lief dadurch ueber den Song weg (Dancing Queen: 100,1 statt 100,55 BPM, nach 100 s einen
// halben Schlag hinter der Musik). Gesucht wird +-1,5 % um den Messwert in 0,01-%-Schritten
// das Tempo, bei dem die Bass-Einsaetze des ganzen Songs am deutlichsten auf dem Raster liegen
// (Summe der Einsaetze als Zeiger auf dem Taktkreis); daraus auch die Lage der Schlaege.
// Geprueft an 13 Songs: Deutlichkeit im Mittel x6, Raster bleibt ueber den Song +-30 ms.
// Zeiger der Bass-Einsaetze auf dem Taktkreis eines Tempos (Betrag = wie deutlich es passt)
function zeiger(ons, proSek, b) {
  const w = 2 * Math.PI * b / 60 / proSek, cr = Math.cos(w), sr = -Math.sin(w);
  let er = 1, ei = 0, zr = 0, zi = 0;
  for (let i = 0; i < ons.length; i++) {
    const v = ons[i];
    if (v) { zr += v * er; zi += v * ei; }
    const nr = er * cr - ei * sr; ei = er * sr + ei * cr; er = nr;
  }
  return { zr, zi, betrag: Math.hypot(zr, zi) };
}
function feinSuchen(ons, proSek, bpm, schritte, teil) {
  let best = null;
  for (let k = -schritte; k <= schritte; k++) {
    const b = bpm * (1 + k / teil), z = zeiger(ons, proSek, b);
    if (!best || z.betrag > best.betrag) best = { b, ...z };
  }
  return best;
}
// Tempo-Familie (21.10.2026): der Supervisor vertut sich selten im Verhaeltnis 4:3 oder 3:2
// (Maroon 5 "Sugar": 159 statt 120 BPM - mit 120 passen die Schlaege zehnmal deutlicher).
// Je Familie grob suchen; gewechselt wird nur, wenn eine andere mindestens doppelt so deutlich
// passt (auch die doppelte/halbe Fassung zaehlt, Hi-Hats liegen oft auf Achteln). Danach ins
// Club-Tempo 75-170 BPM bringen.
const FAMILIEN = [1, 0.75, 4 / 3, 2 / 3, 1.5];
function tempoVerfeinern(tief, proSek, bpm) {
  const n = tief.length, ons = new Float32Array(n);
  let summe = 0;
  for (let i = 1; i < n; i++) { const d = tief[i] - tief[i - 1]; if (d > 0) { ons[i] = d; summe += d; } }
  if (!summe) return { bpm, versatz: 0, deutlich: 0 };
  const fam = FAMILIEN.map(f => {
    const g = feinSuchen(ons, proSek, bpm * f, 15, 1000);          // +-1,5 % in 0,1-%-Schritten
    const wert = Math.max(g.betrag, zeiger(ons, proSek, g.b * 2).betrag, zeiger(ons, proSek, g.b / 2).betrag);
    return { f, b: g.b, wert };
  });
  let wahl = fam[0];
  for (const x of fam.slice(1)) if (x.wert >= 2 * fam[0].wert && x.wert > wahl.wert) wahl = x;
  let b = wahl.b;
  while (b > 170) b /= 2;
  while (b < 75) b *= 2;
  const best = feinSuchen(ons, proSek, b, 15, 1000);             // dann fein: +-0,15 % in 0,01 %
  const fein = feinSuchen(ons, proSek, best.b, 15, 10000);
  const T = 60 / fein.b;
  const versatz = ((-Math.atan2(fein.zi, fein.zr) / (2 * Math.PI) * T) % T + T) % T;
  return { bpm: fein.b, versatz, deutlich: fein.betrag / summe };
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
  const t = s.bpm ? tempoVerfeinern(tief, s.proSek, s.bpm) : { bpm: s.bpm, versatz: s.versatz || 0, deutlich: 0 };
  return {
    videoId: s.videoId, bpm: t.bpm, sicher: s.sicher || 0, deutlich: t.deutlich,
    camelot: s.camelot || null, tonart: s.tonart || null,   // gemessen, ungefaehr (Supervisor ton_bestimmen)
    versatz: taktEins(tief, s.proSek, t.bpm, t.versatz),    // auf die Eins des Takts
    wf: { faecher: spitze.length, proSek: s.proSek, dauer: s.dauer, spitze, tief, mitte: lin(s.mitte), hoch: lin(s.hoch),
          bild: bildWerte(rms, tief, lin(s.hoch)) },
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

  // Schlaege und Takt-Einsen von beat_this (am PC vorab gerechnet, dj-studio/takt/<id>.json,
  // 21.10.2026): jeder einzelne Schlag (folgt auch Bands ohne festes Tempo) und die echte Eins.
  // Fehlt die Datei (z. B. neuer Wunsch-Song), gilt das gerechnete Raster aus der Messung.
  const takte = new Map();           // videoId -> Raster | null (keine Datei) | 'laedt'
  function taktAus(d) {
    const n = d.b.length, zeiten = new Float64Array(n), eins = new Uint8Array(n);
    let t = 0;
    const roh = new Float64Array(n);
    for (let i = 0; i < n; i++) { t += d.b[i]; roh[i] = t / 1000; }
    // Glaetten: beat_this setzt Schlaege auf ein 20-ms-Raster - die Striche pendelten 6-11 ms
    // gegen die gleichmaessig laufende Welle ("schwimmen"). Je Schlag aus den 8 Nachbarn:
    // Abstand = Median der Nachbar-Abstaende, Lage = Mittel der Nachbarn ohne die 2 aeussersten
    // je Seite. Tempo-Aenderungen bleiben, Rundungsspruenge und einzelne Ausreisser nicht.
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 4), e = Math.min(n - 1, i + 4);
      if (e - a < 4) { zeiten[i] = roh[i]; continue; }
      const ab = [];
      for (let j = a; j < e; j++) ab.push(roh[j + 1] - roh[j]);
      ab.sort((x, y) => x - y);
      const P = ab[ab.length >> 1];
      const anker = [];
      for (let j = a; j <= e; j++) anker.push(roh[j] - (j - i) * P);
      anker.sort((x, y) => x - y);
      const weg = anker.length >= 7 ? 2 : 1, mitte = anker.slice(weg, anker.length - weg);
      zeiten[i] = mitte.reduce((x, y) => x + y, 0) / mitte.length;
    }
    for (const i of d.e || []) if (i >= 0 && i < n) eins[i] = 1;
    // Tempo ueber je 8 Schlaege (beat_this setzt Schlaege auf 20-ms-Raster - ein Abstand allein
    // gab 111,11 statt 110,0), Median gegen Breaks und Tempowechsel
    const abst = [];
    for (let i = 0; i + 8 < n; i++) abst.push((zeiten[i + 8] - zeiten[i]) / 8);
    abst.sort((a, b) => a - b);
    const bpm = 60 / (abst[abst.length >> 1] || 0.5);
    const e0 = (d.e || []).find(i => i >= 0 && i < n);
    return { bpm, offset: e0 !== undefined ? zeiten[e0] : zeiten[0], zeiten, eins, herkunft: 'beat_this' };
  }
  // vom Supervisor (W1 rechnet selbst mit beat_this) - hat Vorrang vor der Datei im Repo
  function taktNeu(vid, d) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(vid || '') || !d || !Array.isArray(d.b) || d.b.length <= 8) return;
    takte.set(vid, taktAus(d));
    neuZeigen(vid);
  }
  function taktLaden(vid) {
    if (takte.has(vid) || !/^[A-Za-z0-9_-]{11}$/.test(vid)) return;
    takte.set(vid, 'laedt');
    fetch(`takt/${vid}.json`).then(r => (r.ok ? r.json() : null)).then(d => {
      takte.set(vid, d && Array.isArray(d.b) && d.b.length > 8 ? taktAus(d) : null);
      if (takte.get(vid)) neuZeigen(vid);
    }).catch(() => takte.set(vid, null));
    for (const k of [...takte.keys()].slice(0, -40)) takte.delete(k);
  }

  function track(t) {
    if (!t || !t.videoId) return null;
    const sp = spuren.get(t.videoId);
    // Raster zeigen, wenn die Schlaege deutlich auf dem verfeinerten Tempo liegen - die Sicherheit
    // des Supervisors (beide Songhaelften gleich schnell) war zu vorsichtig (Africa 0,62, aber
    // Deutlichkeit 0,22 - mehr als bei den meisten sicheren Songs; 21.10.2026)
    const sicher = sp && sp.bpm && (sp.deutlich >= DEUTLICH_MIN || (sp.sicher >= SICHER_MIN && sp.deutlich >= DEUTLICH_MIN / 2));
    const tk = takte.get(t.videoId);
    if (tk === undefined) taktLaden(t.videoId);
    const takt = tk && tk.zeiten ? tk : null;
    return {
      id: 'yt-' + t.videoId, videoId: t.videoId,
      titel: t.titel || '—', kuenstler: t.kuenstler || '',
      genre: [t.genre, t.jahr].filter(Boolean).join(' · '),
      dauer: Number(t.dauer) || (sp ? sp.wf.dauer : 0),
      // ohne volle Messung (Karten "Naechste Titel"): Kurzwerte [bpm, sicher, camelot] vom Supervisor
      bpm: takt ? Math.round(takt.bpm) : sp && sp.bpm ? Math.round(sp.bpm) : (Array.isArray(t.kurz) && t.kurz[0] ? Math.round(t.kurz[0]) : null),
      bpmMess: sp && sp.bpm && !sicher ? sp.bpm : null,          // ungefaehr: ohne Taktraster
      grid: takt || (sicher ? { bpm: sp.bpm, offset: sp.versatz, herkunft: 'messung' } : null),
      key: sp && sp.camelot ? sp.camelot : (Array.isArray(t.kurz) ? t.kurz[2] || null : null), tonart: sp ? sp.tonart : null,
      ton: Array.isArray(t.ton) ? t.ton : null,   // [Lautheit dB, Limiter dB, Anfang s, Ende s] (Supervisor)
      // Marken (Supervisor-Analyse): Musik beginnt, Ueberblendung beginnt (Ende - Blende), Ende
      anfang: Array.isArray(t.ton) && t.ton[2] > 0.3 ? t.ton[2] : null,
      // ohne gefundene Schlussstille blendet der Supervisor vor dem Dateiende (stille_ende)
      // MIX = Beginn des Tonwechsels (Musikende - Ton-Fenster), wie im Supervisor
      mixAb: Array.isArray(t.ton) && (t.ton[3] || t.dauer) ? Math.max(0, (t.ton[3] || Number(t.dauer)) - XF_TON_FENSTER_SEK) : null,
      ende: Array.isArray(t.ton) ? (t.ton[3] || Number(t.dauer) || null) : null,
      quelle: 'YOUTUBE', wf: sp ? sp.wf : null,
      wfHinweis: 'YOUTUBE · WELLENFORM WIRD GEMESSEN',
      coverUrl: /^[A-Za-z0-9_-]{11}$/.test(t.videoId) ? `https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg` : '',
    };
  }

  function setzen(id, roh, spielt) {
    const t = track(roh), alt = state.decks[id].track;
    if (!t) { if (alt) bestaetigen(`decks.${id}.track`, null); }
    else if (!alt || alt.id !== t.id || alt.titel !== t.titel || alt.dauer !== t.dauer || alt.wf !== t.wf
             || String(alt.ton) !== String(t.ton) || alt.mixAb !== t.mixAb
             || (alt.grid && alt.grid.herkunft) !== (t.grid && t.grid.herkunft)) {
      bestaetigen(`decks.${id}.track`, t);
    }
    bestaetigen(`decks.${id}.spielt`, spielt);
  }

  let jetztRoh = null;
  function empfangen(d) {
    const j = d.jetzt && d.jetzt.videoId ? d.jetzt : null;
    naechster = d.naechster || null;
    if (typeof d.vol === 'number' && d.vol !== vol) {
      vol = Math.max(0, Math.min(100, d.vol));
      engine.request('master.volume', 0.8 * lautFaktor());   // Knopf: 0,8 = 0 dB
      // Kanalfader zeigen die Lautstaerke der Fernbedienung (Wunsch 21.10.2026)
      for (const id of ['A', 'B']) engine.request(`decks.${id}.fader`, vol / 100);
    }
    const t = jetztS(), pos = Number(j?.pos) || 0, spielt = !!j && !j.pausiert;
    const aktuell = state.decks[luft].track;
    if (j && aktuell && aktuell.videoId !== j.videoId) {
      // Songwechsel: der andere Kanal uebernimmt, der alte laeuft in der Blende aus.
      const alt = luft;
      auslauf = { id: alt, pos: state.decks[alt].pos, zeit: t, bis: t + xfSek + 3 };
      luft = anderer(alt);
      blende = { von: state.master.crossfader, nach: luft === 'A' ? -1 : 1, ab: t };
      stand = { pos, zeit: t, spielt }; nachziehen = 0;
    } else {
      // Gleicher Song: bei echtem Sprung (Spulen, Pause) neu setzen, sonst weich nachziehen
      const erwartet = stand.pos + (stand.spielt ? t - stand.zeit : 0);
      if (!j || spielt !== stand.spielt || Math.abs(pos - erwartet) > SPRUNG_SEK) { stand = { pos, zeit: t, spielt }; nachziehen = 0; }
      else {
        // Die gemeldete Position ist auf Videobilder gerundet und leicht verzoegert (+-40 ms):
        // kleine Abweichungen ignorieren, groessere sanft aufholen (siehe takt).
        const abw = pos - erwartet;
        nachziehen = Math.abs(abw) < NACHZIEHEN_AB_SEK ? 0 : abw;
      }
    }
    jetztRoh = j;
    setzen(luft, j, spielt);
    if (!auslauf) setzen(anderer(luft), naechster, false);
    if (!blende) engine.request('master.crossfader', luft === 'A' ? -1 : 1);
    const q = (Array.isArray(d.schlange) ? d.schlange : []).map(track).filter(Boolean);
    if (q.map(x => x.id + x.bpm + x.key).join('|') !== state.queue.map(x => x.id + x.track.bpm + x.track.key).join('|')) {
      bestaetigen('queue', q.map(x => ({ id: x.id, track: x })));
    }
  }

  function spurNeu(roh) {
    const sp = spurLesen(roh);
    spuren.set(sp.videoId, sp);
    for (const k of [...spuren.keys()].slice(0, -6)) spuren.delete(k);
    neuZeigen(sp.videoId);
  }
  // liegt der Song schon auf einem Kanal oder in der Leiste: mit neuen Werten neu zeigen
  function neuZeigen(vid) {
    for (const id of ['A', 'B']) {
      const tr = state.decks[id].track;
      if (tr && tr.videoId === vid) setzen(id, { ...tr, genre: tr.genre }, state.decks[id].spielt);
    }
    if (state.queue.some(q => q.track.videoId === vid)) {
      bestaetigen('queue', state.queue.map(q => (q.track.videoId === vid ? { ...q, track: track(q.track) } : q)));
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
      else if (e.data.typ === 'ytm-dj-takt') taktNeu(e.data.videoId, e.data.takt);
    } catch (err) { console.error('[DJ Studio TV]', err); }
  });

  // ---- Pegel aus der Messung statt aus Web Audio ----------------------------
  // Wie am Mischpult: Balken = Lautheit ueber 50 ms (Ballistik in meter.js), Spitze 30 ms, links/rechts.
  const VU_FAECHER = 5, SPITZE_FAECHER = 3, RESERVE = Math.pow(10, RESERVE_DB / 20);
  const STILL = { L: { spitze: 0, rms: 0 }, R: { spitze: 0, rms: 0 } };
  const LIMIT = 0.891;                  // Limiter-Grenze im Supervisor (-1 dBFS)
  function pegelBei(id) {
    const d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
    if (!d.spielt || !sp) return STILL;
    // Lautheitsanpassung des Songs wie in mpv: Gain, mit Limiter zusaetzlich bis 2 dB, Spitzen
    // dann bei -1 dBFS gekappt (Supervisor ton_zustand).
    const ton = d.track.ton || [0, 0], f = Math.pow(10, ((ton[0] || 0) + (ton[1] || 0)) / 20), kappe = ton[1] ? LIMIT : Infinity;
    const i = Math.floor(d.pos * sp.wf.proSek);
    if (i < 0 || i >= sp.pegel[0].spitze.length) return STILL;
    const [L, R] = sp.pegel.map(p => {
      let s = -Infinity, q = 0;
      for (let k = Math.max(0, i - SPITZE_FAECHER + 1); k <= i; k++) s = Math.max(s, p.spitze[k]);
      const von = Math.max(0, i - VU_FAECHER + 1);
      for (let k = von; k <= i; k++) q += p.leistung[k];
      return { spitze: s > -60 ? Math.min(kappe, Math.pow(10, s / 20) * f) : 0, rms: Math.min(kappe, Math.sqrt(q / (i - von + 1)) * f) };
    });
    return { L, R };
  }
  // Kanal-Meter: gemessener Pegel x Reserve x Lautstaerke am TV
  function kanalPegel(id) {
    const p = pegelBei(id), f = RESERVE * lautFaktor();
    return { L: { spitze: anheben(p.L.spitze * f), rms: anheben(p.L.rms * f) }, R: { spitze: anheben(p.R.spitze * f), rms: anheben(p.R.rms * f) } };
  }
  for (const id of ['A', 'B']) {
    const de = engine.decks[id];
    de.pegel = () => kanalPegel(id);
    de.meterPost.lesen = de.pegel;
    de.meterPre.lesen = de.pegel;
  }
  // Bassanteil (0..1) dessen, was gerade aus der Anlage kommt - aus der gemessenen Tiefen-Reihe
  // (Gewitter-Skins: Bass setzt ein = Gewitter geht voll mit)
  engine.bassPegel = () => {
    let m = 0;
    for (const id of ['A', 'B']) {
      const d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
      if (!d.spielt || !sp) continue;
      const i = Math.floor(d.pos * sp.wf.proSek);
      m = Math.max(m, (sp.wf.tief[i] || 0) * engine.xfPegel(id));
    }
    return m;
  };
  // Melodie (0..1): Mitten und Hoehen der gemessenen Spur - Gewitter: kleine Blitze bei Melodien
  engine.melodiePegel = () => {
    let m = 0;
    for (const id of ['A', 'B']) {
      const d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
      if (!d.spielt || !sp) continue;
      const i = Math.floor(d.pos * sp.wf.proSek);
      m = Math.max(m, Math.max(sp.wf.mitte[i] || 0, sp.wf.hoch[i] || 0) * engine.xfPegel(id));
    }
    return m;
  };
  // Spannung (Gewitter): wie laut der Song gerade ist und in den naechsten Sekunden wird, relativ zu
  // seinen lauten Teilen (0 = ganz ruhig, 1 = voll) - aus der gemessenen Spur, damit die Wolken vor
  // dem Drop schon da sind (Betreiber 23.10.: "rechtzeitig zurueck")
  engine.spannung = (vorausSek) => {
    let jetzt = 0, voraus = 0, da = false;
    for (const id of ['A', 'B']) {
      const d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
      if (!d.spielt || !sp) continue;
      const w = sp.wf, n = w.spitze.length, ps = w.proSek;
      if (!w.laut) { const s = Array.from(w.spitze).sort((x, y) => x - y); w.laut = Math.max(0.05, s[Math.floor(s.length * 0.9)]); }
      const schnitt = (von, bis) => { let t = 0, k = 0; for (let i = Math.max(0, von); i < Math.min(n, bis); i++) { t += w.spitze[i]; k++; } return k ? t / k : 0; };
      const i = Math.floor(d.pos * ps), x = engine.xfPegel(id);
      jetzt = Math.max(jetzt, schnitt(i - ps, i) / w.laut * x);
      for (let a = i; a < i + (vorausSek || 6) * ps; a += ps / 2) voraus = Math.max(voraus, schnitt(a, a + ps / 2) / w.laut * x);
      da = true;
    }
    return da ? { jetzt: Math.min(1.2, jetzt), voraus: Math.min(1.2, voraus) } : null;
  };
  // Drops des hoerbaren Songs aus der gemessenen Bass-Reihe (Gewitter: Foto-Blitz genau auf den Drop,
  // Testlauf 23.10.: im laufenden Song geraten war zu unsicher). Drop = Bass setzt nach >= 4 s fast ohne
  // Bass kraeftig ein; hoechstens alle 8 s. Liefert die Position und die Drop-Zeiten (s).
  engine.drops = () => {
    const id = engine.videoMix() < 0.5 ? 'A' : 'B', d = state.decks[id], sp = d.track && spuren.get(d.track.videoId);
    if (!d.spielt || !sp) return null;
    const w = sp.wf;
    if (!w.drops) {
      const ps = w.proSek, sek = Math.floor(w.tief.length / ps), bass = [];
      for (let i = 0; i < sek; i++) { let t = 0; for (let k = i * ps; k < (i + 1) * ps; k++) t += w.tief[k]; bass.push(t / ps); }
      const ref = [...bass].sort((x, y) => x - y)[Math.floor(bass.length * 0.9)] || 1;
      w.drops = [];
      for (let i = 4; i < sek; i++) {
        if (Math.max(...bass.slice(i - 4, i)) / ref < 0.35 && bass[i] / ref > 0.6
            && (!w.drops.length || i - w.drops[w.drops.length - 1] > 8)) {
          // genauer Einsatz: erstes Fach in dieser Sekunde mit kraeftigem Bass
          let k = i * ps; while (k < (i + 1) * ps && w.tief[k] / ref < 0.6) k++;
          w.drops.push(k / ps);
        }
      }
    }
    if (!w.refrains) {
      // Refrain-Einsatz (Betreiber 23.10.: "einmal pro Minute beim Refrain auch Foto-Blitz"): der Song
      // wird deutlich lauter - 4 s davor unter 80 %, 4 s danach ueber 95 % seiner lauten Teile.
      // Hoechstens einer pro Minute und nicht naeher als 20 s an einem Drop.
      const ps = w.proSek, sek = Math.floor(w.spitze.length / ps), laut = [];
      for (let i = 0; i < sek; i++) { let t = 0; for (let k = i * ps; k < (i + 1) * ps; k++) t += w.spitze[k]; laut.push(t / ps); }
      const ref = [...laut].sort((x, y) => x - y)[Math.floor(laut.length * 0.9)] || 1;
      const schnitt = (a, b) => laut.slice(a, b).reduce((x, y) => x + y, 0) / Math.max(1, b - a) / ref;
      w.refrains = [];
      for (let i = 4; i < sek - 4; i++) {
        if (schnitt(i - 4, i) < 0.8 && schnitt(i, i + 4) > 0.95
            && (!w.refrains.length || i - w.refrains[w.refrains.length - 1] >= 60)
            && !w.drops.some(t => Math.abs(t - i) < 20)) w.refrains.push(i);
      }
    }
    return { pos: d.pos, drops: w.drops, refrains: w.refrains };
  };
  engine.masterPegel = () => {
    const m = { L: { spitze: 0, rms: 0 }, R: { spitze: 0, rms: 0 }, reduktion: 0 };
    const laut = lautFaktor();
    for (const id of ['A', 'B']) {
      const p = pegelBei(id), g = engine.xfPegel(id) * laut * RESERVE;
      for (const k of ['L', 'R']) {
        m[k].spitze = Math.max(m[k].spitze, p[k].spitze * g);
        m[k].rms = Math.sqrt(m[k].rms ** 2 + (p[k].rms * g) ** 2);
      }
    }
    for (const k of ['L', 'R']) { m[k].spitze = anheben(m[k].spitze); m[k].rms = anheben(m[k].rms); }
    return m;
  };

  // Erst jetzt hoert das Studio zu: dem Dashboard Bescheid geben, dann schickt es alles
  // (vorher gesendete Messungen gingen verloren und galten trotzdem als zugestellt).
  try { parent.postMessage({ typ: 'ytm-dj-bereit' }, location.origin); } catch (e) {}

  return {
    // je Frame statt engine.takt(): Positionen hochrechnen, Blende fahren
    // bildZeit: Zeitpunkt des Bildes (requestAnimationFrame) - so laeuft die Welle gleichmaessig;
    // mit der Uhr beim Rechnen schwankte das Tempo von Bild zu Bild um bis zu 25 %.
    takt(bildZeit) {
      const t = bildZeit || jetztS();
      const d = state.decks[luft];
      if (nachziehen) {                   // sanft aufholen: hoechstens 3 % schneller/langsamer
        const dt = Math.max(0, Math.min(0.1, t - (this.letzte || t)));
        const schritt = Math.sign(nachziehen) * Math.min(Math.abs(nachziehen), NACHZIEHEN_TEMPO * dt);
        stand.pos += schritt; nachziehen -= schritt;
        if (Math.abs(nachziehen) < 0.001) nachziehen = 0;
      }
      this.letzte = t;
      if (d.track) {
        const p = stand.pos + (stand.spielt ? t - stand.zeit + vorlauf() : 0);
        d.pos = Math.min(d.track.dauer || p, Math.max(0, p));
      }
      // Wartender Kanal steht beim Laden auf dem gemessenen Start (Betreiber 21.10.)
      const w = anderer(luft), dw = state.decks[w];
      if (dw.track && !dw.spielt && (!auslauf || auslauf.id !== w)) dw.pos = dw.track.anfang || 0;
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
        // Crossfader faehrt, wenn der neue Song (Position!) seinen Musikanfang erreicht
        // (am Einsatz der vollen Musik - ton[4] vom Supervisor; leises Intro laeuft davor schon mit)
        const neu = state.decks[luft], ton = (neu.track && neu.track.ton) || [];
        const anfang = Number(ton[4]) || (neu.track && neu.track.anfang) || 0;
        const q = Math.min(1, Math.max(0, (neu.pos - anfang) / XF_TON_FENSTER_SEK));
        // Crossfader-Kurve 'weich' = gleiche Leistung (cos/sin) wie die Ton-Blende von mpv
        engine.request('master.crossfader', blende.von + (blende.nach - blende.von) * q);
        if (q >= 1 || t - blende.ab >= xfSek + 3) {
          blende = null;
          if (auslauf) auslauf.bis = Math.min(auslauf.bis, t + 0.3);   // alter Kanal ist ab hier stumm
        }
      }
    },
  };
}
