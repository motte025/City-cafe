// EIN Deck-Bauteil fuer beide Kanaele. Kanal 2 wird nur ueber die Anordnung
// gespiegelt (Klasse deck--rev, CSS-Grid-Bereiche) - Texte, Zahlen, Cover und
// Wellenform-Zeitrichtung bleiben normal lesbar. Kein scaleX(-1).

import { state, abonnieren } from '../store.js';
import { el, knopf, regler, taste, an, zeit } from './controls.js';
import { LedMeter, SKALA, SCHWELLEN_BILD_DECK } from './meter.js';
import { DetailWelle, UebersichtWelle } from './waveform.js';
import { cover } from '../artwork.js';
import { menue } from './overlays.js';

const ICON = {
  play: '<svg viewBox="0 0 48 24" aria-hidden="true"><path d="M4 3l14 9-14 9z"/><rect x="25" y="3" width="5" height="18"/><rect x="34" y="3" width="5" height="18"/></svg>',
  zahn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.5 7.5 0 000-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.3 2.9a7.6 7.6 0 00-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 000 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.3-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5A3.5 3.5 0 1113 8.5a3.5 3.5 0 010 7z"/></svg>',
  herz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 3 5 6.4 5c2 0 3.3 1.2 3.9 2.2.3.5.9.5 1.2 0C12.1 6.2 13.4 5 15.4 5 18.8 5 20.5 8.5 19 11.4 16.9 15.6 12 20 12 20z"/></svg>',
  punkte: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

export function deckBauen(root, id, engine, aktionen) {
  const nr = id === 'A' ? 1 : 2;
  const s = () => state.decks[id];
  const de = () => engine.decks[id];
  const wunsch = (k, v) => engine.request(`decks.${id}.${k}`, v);
  root.innerHTML = '';
  root.classList.add('deck', 'panel');
  root.dataset.deck = id;

  // ---- Kopfzeile -----------------------------------------------------------
  const tMaster = taste({ text: 'MASTER', klasse: 'klein akzent', titel: 'Tempo-Referenz für SYNC', onKlick: () => wunsch('master', !s().master) });
  const tSlip = taste({ text: 'SLIP', klasse: 'klein akzent', titel: 'Slip: nach dem Loop an der mitgelaufenen Stelle weiter', onKlick: () => wunsch('slip', !s().slip) });
  const tQuant = taste({ text: 'QUANT', klasse: 'klein akzent', titel: 'Cue und Loops auf den Beat setzen', onKlick: () => wunsch('quant', !s().quant) });
  const tZahn = taste({ html: ICON.zahn, klasse: 'icon', aria: `Einstellungen Kanal ${nr}`, onKlick: () => aktionen.einstellungen() });
  const videoLed = el('span', 'led');
  const kanalText = el('span', 'deck-kanal', { text: `KANAL ${nr}` });
  const TV = document.body.classList.contains('tv');
  const kopf = el('div', 'deck-kopf', {}, [
    el('div', 'deck-name', {}, [kanalText, el('span', 'deck-badge', { text: id })]),
    el('div', 'deck-kopf-rest', {}, [
      el('span', 'deck-video', { title: 'Leuchtet, wenn dieses Deck im Programmbild ist' }, [el('span', 'mini-label', { text: 'VIDEO' }), videoLed]),
      tMaster, tSlip, tQuant, tZahn,
    ]),
  ]);

  // ---- Titel ---------------------------------------------------------------
  const bild = el('div', 'deck-cover');
  const titel = el('div', 'deck-titel', { text: '—' });
  const kuenstler = el('div', 'deck-kuenstler', { text: 'Titel aus „Nächste Titel" hierher ziehen' });
  const metaZeile = el('div', 'deck-meta');
  const tHerz = taste({ html: ICON.herz, klasse: 'icon herz', aria: 'Favorit', onKlick: () => wunsch('favorit', !s().favorit) });
  const tMenue = taste({ html: ICON.punkte, klasse: 'icon', aria: `Menü Kanal ${nr}`, onKlick: e => menue(e.currentTarget, [
    { text: 'Cue an den Anfang', aus: !s().track || s().spielt, tun: () => { de().springen(0); de().cueDruck(); } },
    { text: 'Titel auswerfen', aus: !s().track || s().spielt, tun: () => aktionen.auswerfen(id) },
    { text: 'Nächsten Titel laden', aus: s().spielt || !state.queue.length, tun: () => aktionen.naechstenLaden(id) },
  ]) });
  let restZeit = false;
  const zeitAkt = el('span', 'deck-zeit-akt', { text: '00:00' });
  const zeitGes = el('span', 'deck-zeit-ges', { text: '/ 00:00' });
  const zeitBox = el('button', 'deck-zeit', { type: 'button', title: 'Umschalten: gespielt / Rest' }, [zeitAkt, zeitGes]);
  zeitBox.addEventListener('click', () => { restZeit = !restZeit; });
  const meldung = el('div', 'deck-meldung', { role: 'status', 'aria-live': 'polite' });
  const info = el('div', 'deck-info', {}, [
    bild,
    el('div', 'deck-texte', {}, [titel, kuenstler, metaZeile]),
    el('div', 'deck-info-rechts', {}, [el('div', 'deck-info-icons', {}, [tHerz, tMenue]), zeitBox]),
    meldung,
  ]);

  // ---- Wellenformen --------------------------------------------------------
  const cDetail = el('canvas', 'welle-detail', { 'aria-label': `Wellenform Kanal ${nr}` });
  const cUeber = el('canvas', 'welle-ueber', { 'aria-label': `Übersicht Kanal ${nr}, klicken zum Springen` });
  const detail = new DetailWelle(cDetail, id), ueber = new UebersichtWelle(cUeber, id);
  const welle = el('div', 'deck-welle', {}, [cDetail, el('div', 'welle-zoom', { 'aria-hidden': 'true' })]);
  welle.addEventListener('wheel', e => { e.preventDefault(); detail.zoomen(e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  const beatSprung = el('span', 'ueber-marke', { text: '16' });
  const ueberBox = el('div', 'deck-ueber', {}, [cUeber, beatSprung]);
  cUeber.addEventListener('pointerdown', e => { if (s().track) de().springen(ueber.zeitBei(e, s().track.dauer)); });

  // ---- Tempo-Zeile ---------------------------------------------------------
  const bpmZahl = el('div', 'bpm-zahl', { text: '---.-' });
  const bpmQuelle = el('span', 'bpm-quelle');
  const bpmBox = el('button', 'tempo-feld bpm', { type: 'button', title: 'BPM. Ohne Taktraster: hier im Takt tippen (Tap-Tempo)' },
    [el('span', 'mini-label', { text: 'BPM' }, [bpmQuelle]), bpmZahl]);
  let taps = [];
  bpmBox.addEventListener('click', () => {
    const t = s().track;
    if (!t || t.grid) return;
    const jetzt = performance.now();
    taps = taps.filter(x => jetzt - x < 2500); taps.push(jetzt);
    if (taps.length >= 4) {
      const ab = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      aktionen.tapBpm(id, Math.round(60000 / ab * 10) / 10);
    }
  });
  const tempoZahl = el('div', 'tempo-zahl', { text: '0.0%' });
  const tempoBox = el('div', 'tempo-feld', {}, [el('span', 'mini-label', { text: 'TEMPO' }), tempoZahl]);
  const bereichTasten = [6, 10, 16].map(b => {
    const t = taste({ text: '±' + b, klasse: 'klein bereich', titel: `Tempo-Bereich ±${b} %`, onKlick: () => wunsch('tempoBereich', b) });
    t.dataset.b = b; return t;
  });
  const keyZahl = el('div', 'key-zahl', { text: '—' });
  const keyBox = el('div', 'tempo-feld key', {}, [el('span', 'mini-label', { text: 'KEY' }), keyZahl]);
  const tSync = taste({ text: 'SYNC', klasse: 'sync akzent', titel: 'Tempo und Taktphase an das andere Deck angleichen', onKlick: () => wunsch('sync', !s().sync) });
  const linkLed = el('span', 'link-status', { html: ICON.link, title: 'Leuchtet, solange SYNC gekoppelt ist' });
  const tempoZeile = el('div', 'deck-tempo', {}, [bpmBox, tempoBox, el('div', 'bereiche', {}, bereichTasten), keyBox, tSync, linkLed]);

  // ---- Unterteil -----------------------------------------------------------
  const cMeter = el('canvas', 'deck-meter', { 'aria-label': `Pegel Kanal ${nr}` });
  const meter = root.closest('.skin')
    ? new LedMeter(cMeter, { richtung: 'v', kanaele: 2, stil: 'bild', schwellen: SCHWELLEN_BILD_DECK })
    : new LedMeter(cMeter, { richtung: 'v', kanaele: 2, abstand: 2 });
  const skala = el('div', 'deck-skala', { 'aria-hidden': 'true' },
    SKALA.map(db => el('span', '', { text: db > 0 ? '+' + db : String(db), style: `--pos:${skalaPos(db)}` })));
  const clipLed = el('span', 'clip-led', { title: 'CLIP (≥ −0,1 dBFS)' });
  const abgriff = el('span', 'abgriff', { text: 'PRE' });
  const fader = regler({ richtung: 'v', min: 0, max: 1, null: 0, schritt: 0.02, aria: `Kanalfader ${nr}`, klasse: 'kanalfader',
    format: v => Math.round(v * 100) + ' %', onWunsch: v => wunsch('fader', v) });
  const kn = {
    trim: knopf({ label: 'TRIM', min: -12, max: 12, null: 0, schritt: 0.5, format: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB', onWunsch: v => wunsch('trim', v), groesse: 46 }),
    high: knopf({ label: 'HIGH', min: -26, max: 6, null: 0, schritt: 0.5, format: dbText, onWunsch: v => wunsch('eq.high', v), groesse: 46 }),
    mid: knopf({ label: 'MID', min: -26, max: 6, null: 0, schritt: 0.5, format: dbText, onWunsch: v => wunsch('eq.mid', v), groesse: 46 }),
    low: knopf({ label: 'LOW', min: -26, max: 6, null: 0, schritt: 0.5, format: dbText, onWunsch: v => wunsch('eq.low', v), groesse: 46 }),
    filter: knopf({ label: 'FILTER', min: -1, max: 1, null: 0, schritt: 0.02, format: filterText, onWunsch: v => wunsch('filter', v), groesse: 46 }),
  };
  const knoepfe = el('div', 'deck-knoepfe', {}, Object.values(kn).map(k => k.el));

  const loopTasten = [32, 16, 8, 4].map(n => {
    const t = taste({ text: String(n), klasse: 'loop-n', titel: `Beat-Loop ${n} Beats`, onDruck: () => de().loopBeats(n) });
    t.dataset.n = n; return t;
  });
  const tIn = taste({ text: 'IN', klasse: 'loop-io', onDruck: () => de().loopIn() });
  const tOut = taste({ text: 'OUT', klasse: 'loop-io', onDruck: () => de().loopOut() });
  const tAktiv = taste({ text: 'ACTIVE', klasse: 'loop-aktiv', titel: 'Loop an/aus', onDruck: () => de().loopUmschalten() });
  const loop = el('div', 'deck-loop', {}, [
    el('div', 'loop-titel', { text: 'LOOP' }),
    el('div', 'loop-reihe', {}, loopTasten),
    el('div', 'loop-reihe', {}, [tIn, tOut, tAktiv]),
  ]);

  // Jogwheel
  const jogCover = el('div', 'jog-cover');
  const jogTeller = el('div', 'jog-teller', {}, [jogCover, el('div', 'jog-rillen')]);
  const jog = el('div', 'jog', { role: 'application', tabindex: 0, 'aria-label': `Jogwheel Kanal ${nr}: ziehen = Tempo biegen (läuft) oder Position suchen (steht)` }, [
    el('div', 'jog-rahmen'), el('div', 'jog-ring'), jogTeller, el('div', 'jog-glanz'),
  ]);
  const vinylLed = el('span', 'led');
  const vinylAnz = el('span', 'jog-vinyl', {}, [el('span', 'mini-label', { text: 'VINYL' }), vinylLed]);
  const jogBox = el('div', 'deck-jog', {}, [jog, vinylAnz]);
  jogBedienen(jog, () => s(), de, () => s().vinyl);

  const tempoRegler = regler({ richtung: 'v', min: -16, max: 16, null: 0, schritt: 0.05, aria: `Tempo Kanal ${nr}`, klasse: 'temporegler',
    umgekehrt: true, format: v => v.toFixed(2) + ' %', onWunsch: v => wunsch('tempo', v) });

  const tBeatgrid = taste({ html: '<span class="led"></span><span>BEAT GRID</span>', klasse: 'anz', onKlick: () => wunsch('beatgrid', !s().beatgrid) });
  const tVinyl = taste({ html: '<span class="led"></span><span>VINYL</span>', klasse: 'anz', onKlick: () => wunsch('vinyl', !s().vinyl) });
  const tCue = taste({ text: 'CUE', klasse: 'gross cue', aria: `CUE Kanal ${nr}`, onDruck: () => de().cueDruck(), onLos: () => de().cueLos() });
  const tPlay = taste({ html: ICON.play, klasse: 'gross play', aria: `Play/Pause Kanal ${nr}`, onDruck: () => de().umschalten() });

  const unten = el('div', 'deck-unten', {}, [
    el('div', 'bereich-skala', {}, [skala]),
    el('div', 'bereich-meter', {}, [clipLed, cMeter, abgriff]),
    el('div', 'bereich-fader', {}, [fader.el]),
    el('div', 'bereich-knoepfe', {}, [knoepfe]),
    el('div', 'bereich-loop', {}, [loop]),
    el('div', 'bereich-jog', {}, [jogBox]),
    el('div', 'bereich-tempo', {}, [tempoRegler.el]),
    el('div', 'bereich-anz', {}, [tBeatgrid, tVinyl]),
    el('div', 'bereich-cue', {}, [tCue]),
    el('div', 'bereich-play', {}, [tPlay]),
  ]);

  root.append(kopf, info, welle, ueberBox, tempoZeile, unten);

  // Drop-Ziel: Titel aus der Leiste
  root.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/dj-titel')) { e.preventDefault(); root.classList.add('drop'); } });
  root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) root.classList.remove('drop'); });
  root.addEventListener('drop', e => {
    root.classList.remove('drop');
    const qid = e.dataTransfer.getData('text/dj-titel');
    if (qid) { e.preventDefault(); aktionen.ausLeisteLaden(qid, id); }
  });

  // ---- Anzeige aus bestaetigtem Zustand ------------------------------------
  function trackAnzeigen() {
    const t = s().track;
    bild.style.backgroundImage = t ? `url(${cover(t, 160)})` : '';
    jogCover.style.backgroundImage = t ? `url(${cover(t, 256)})` : '';
    titel.textContent = t ? t.titel : '—';
    kuenstler.textContent = t ? t.kuenstler : 'Titel aus „Nächste Titel" hierher ziehen';
    metaZeile.innerHTML = '';
    if (t) {
      const bpm = t.grid ? t.grid.bpm.toFixed(0) + ' BPM' : t.bpmMess ? '~' + Math.round(t.bpmMess) + ' BPM'
        : t.bpmTap ? t.bpmTap + ' BPM (Tap)' : 'BPM offen';
      metaZeile.append(el('span', '', { text: t.genre || '' }), el('span', 'trenn', { text: '|' }),
        el('span', '', { text: bpm }), el('span', 'trenn', { text: '|' }), el('span', '', { text: t.key || '—' }));
      if (t.quelle === 'DEMO') metaZeile.append(el('span', 'demo-marke', { text: 'DEMO', title: 'Generator-Werte, nicht gemessen' }));
    }
    zeitGes.textContent = '/ ' + zeit(t ? t.dauer : 0);
    keyZahl.textContent = t?.key || '—';
    bpmQuelle.textContent = t ? (t.grid ? (t.grid.herkunft === 'generator' ? ' GEN' : '') : t.bpmMess ? ' ~' : t.bpmTap ? ' TAP' : ' OFFEN') : '';
    root.classList.toggle('hat-track', !!t);
    root.classList.toggle('ohne-grid', !!t && !t.grid);
    tSync.disabled = !!t && !t.grid;
    tSync.title = t && !t.grid ? 'SYNC gesperrt: kein verifiziertes Taktraster' : 'Tempo und Taktphase an das andere Deck angleichen';
    loopTasten.forEach(b => { b.disabled = !!t && !t.grid; });
    tempoAnzeigen();
  }
  function tempoAnzeigen() {
    const d = s(), t = d.track;
    const basis = t?.grid?.bpm ?? t?.bpmMess ?? t?.bpmTap ?? null;   // bpmMess: gemessen, aber unsicher (TV)
    bpmZahl.textContent = basis ? (basis * (1 + d.tempo / 100)).toFixed(1) : '---.-';
    tempoZahl.textContent = (d.tempo > 0 ? '+' : d.tempo < 0 ? '' : '±') + d.tempo.toFixed(1) + '%';
    tempoRegler.update(d.tempo);
    bereichTasten.forEach(b => an(b, Number(b.dataset.b) === d.tempoBereich));
    tempoRegler.el.style.setProperty('--bereich', d.tempoBereich / 16);
  }
  function loopAnzeigen() {
    const l = s().loop;
    loopTasten.forEach(b => an(b, l.an && Number(b.dataset.n) === l.beats));
    an(tAktiv, l.an);
    an(tIn, l.start > 0 && !l.an && !(l.ende > l.start));
    beatSprung.textContent = l.an && l.beats ? String(l.beats) : '';
    beatSprung.hidden = !(l.an && l.beats);
  }
  const anzeige = {
    track: trackAnzeigen,
    tempo: tempoAnzeigen, tempoBereich: tempoAnzeigen,
    loop: loopAnzeigen,
    sync: () => { an(tSync, s().sync); linkLed.classList.toggle('an', s().sync); },
    master: () => an(tMaster, s().master),
    slip: () => an(tSlip, s().slip),
    quant: () => an(tQuant, s().quant),
    vinyl: () => { an(tVinyl, s().vinyl); vinylLed.classList.toggle('an', s().vinyl); },
    beatgrid: () => an(tBeatgrid, s().beatgrid),
    favorit: () => an(tHerz, s().favorit),
    spielt: () => { root.classList.toggle('spielt', s().spielt); an(tPlay, s().spielt); },
    laden: () => root.classList.toggle('laedt', s().laden),
    fader: () => fader.update(s().fader),
    trim: () => kn.trim.update(s().trim),
    'eq.high': () => kn.high.update(s().eq.high),
    'eq.mid': () => kn.mid.update(s().eq.mid),
    'eq.low': () => kn.low.update(s().eq.low),
    filter: () => kn.filter.update(s().filter),
    meldung: () => { meldung.textContent = s().meldung; meldung.classList.toggle('sichtbar', !!s().meldung); clearTimeout(meldung._t); if (s().meldung) meldung._t = setTimeout(() => { meldung.classList.remove('sichtbar'); }, 4000); },
  };
  const praefix = `decks.${id}.`;
  abonnieren(pfad => {
    if (pfad.startsWith(praefix)) { const f = anzeige[pfad.slice(praefix.length)]; if (f) f(); }
    if (pfad === 'master.meterAbgriff') abgriff.textContent = state.master.meterAbgriff.toUpperCase();
    if (pfad === 'layout.jog') spiegelSetzen();
  });
  function spiegelSetzen() {
    // Kanal 2 ist das Gegenstueck von Kanal 1; "jog aussen" dreht beide Unterteile um.
    const rev = (id === 'B') !== (state.layout.jog === 'aussen');
    root.classList.toggle('deck--rev', rev);
    root.classList.toggle('deck--spiegel', id === 'B');
  }
  spiegelSetzen();
  for (const f of new Set(Object.values(anzeige))) f();

  // ---- je Frame ------------------------------------------------------------
  let cueBlink = 0;
  return {
    frame(t, dt, imBild) {
      const d = s();
      detail.zeichnen(d); ueber.zeichnen(d);
      const p = de().pegel();
      meter.update([p.L, p.R], t, dt);
      clipLed.classList.toggle('an', meter.clip(t));
      if (d.track) {
        zeitAkt.textContent = restZeit ? '-' + zeit(d.track.dauer - d.pos) : zeit(d.pos);
        const rest = d.track.dauer - d.pos;
        root.classList.toggle('endet', d.spielt && rest < 30 && rest > 0 && Math.floor(t * 2) % 2 === 0);
      } else zeitAkt.textContent = '00:00';
      const winkel = d.pos * 200;        // 33 1/3 U/min
      jogTeller.style.transform = `rotate(${winkel % 360}deg)`;
      videoLed.classList.toggle('an', imBild);
      if (TV) {                            // DJ-Modus: welcher Kanal ist zu hoeren?
        const text = d.track ? (imBild ? 'ON AIR' : 'NEXT') : '';
        if (kanalText.textContent !== text) {
          kanalText.textContent = text;
          kanalText.classList.toggle('on-air', text === 'ON AIR');
          kanalText.classList.toggle('next', text === 'NEXT');
        }
      }
      cueBlink = Math.floor(t * 2) % 2;
      tCue.classList.toggle('blink', !!d.track && !d.spielt && Math.abs(d.pos - d.cue) > 0.02 && cueBlink === 1);
      tCue.classList.toggle('an', !!d.track && !d.spielt && Math.abs(d.pos - d.cue) <= 0.02);
      tPlay.classList.toggle('blink', !!d.track && !d.spielt && cueBlink === 1);
    },
  };
}

function dbText(v) { return v <= -25.9 ? 'KILL' : (v > 0 ? '+' : '') + v.toFixed(1) + ' dB'; }
function filterText(v) { return v === 0 ? 'aus' : v < 0 ? 'Tiefpass ' + Math.round(-v * 100) + ' %' : 'Hochpass ' + Math.round(v * 100) + ' %'; }

// Skalenposition 0..1 passend zu den LED-Schwellen
function skalaPos(db) {
  const S = [-48, -42, -36, -33, -30, -27, -24, -21, -18, -16, -14, -12, -10, -8, -6, -5, -4, -3, -2, -1, -0.5];
  let i = S.findIndex(x => x >= db);
  if (i < 0) i = S.length - 1;
  return ((i + 0.5) / S.length).toFixed(4);
}

// Jogwheel: Ziehen im Kreis. Laeuft -> Tempo biegen, steht -> Position suchen.
function jogBedienen(jog, s, de, vinyl) {
  let zieh = null;
  const winkelVon = e => {
    const r = jog.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  jog.addEventListener('pointerdown', e => {
    jog.setPointerCapture(e.pointerId); jog.focus();
    zieh = { w: winkelVon(e), t: performance.now() };
    jog.classList.add('beruehrt');
    e.preventDefault();
  });
  jog.addEventListener('pointermove', e => {
    if (!zieh) return;
    const w = winkelVon(e), jetzt = performance.now();
    let d = w - zieh.w; if (d > 180) d -= 360; if (d < -180) d += 360;
    const dt = Math.max(1, jetzt - zieh.t) / 1000;
    zieh.w = w; zieh.t = jetzt;
    if (s().spielt) de().biegen(Math.max(-0.3, Math.min(0.3, d / dt / 1500)));
    else de().schieben(d / 360 * (vinyl() ? 1.8 : 0.25));
  });
  const ende = () => { if (!zieh) return; zieh = null; jog.classList.remove('beruehrt'); de().biegen(0); };
  jog.addEventListener('pointerup', ende); jog.addEventListener('pointercancel', ende);
  jog.addEventListener('wheel', e => {
    e.preventDefault();
    if (s().spielt) { de().biegen(-Math.sign(e.deltaY) * 0.04); clearTimeout(jog._t); jog._t = setTimeout(() => de().biegen(0), 120); }
    else de().schieben(-Math.sign(e.deltaY) * 0.02);
  }, { passive: false });
  jog.addEventListener('keydown', e => {
    const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    if (s().spielt) { de().biegen(k * 0.04); clearTimeout(jog._t); jog._t = setTimeout(() => de().biegen(0), 150); }
    else de().schieben(k * (e.shiftKey ? 0.005 : 0.05));
  });
}
