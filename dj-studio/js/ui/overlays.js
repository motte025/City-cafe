// Kontextmenue und Dialoge (Einstellungen, Quellen, ganze Liste).
// Liegen in #ebenen innerhalb der 1920x1080-Buehne und skalieren mit.

import { el, taste, an } from './controls.js';
import { state, abonnieren } from '../store.js';
import { ADAPTER, MATRIX } from '../sources.js';

const ebenen = () => document.getElementById('ebenen');
const buehne = () => document.getElementById('buehne');

function buehnenKoord(r) {
  const b = buehne().getBoundingClientRect();
  const f = b.width / 1920;
  return { x: (r.left - b.left) / f, y: (r.top - b.top) / f, w: r.width / f, h: r.height / f };
}

let offen = null;
export function schliessen() { if (offen) { offen.remove(); offen = null; } }

// eintraege: [{ text, tun, aus }]
export function menue(anker, eintraege) {
  schliessen();
  const k = buehnenKoord(anker.getBoundingClientRect());
  const m = el('div', 'menue', { role: 'menu' });
  for (const e of eintraege) {
    const b = el('button', 'menue-punkt', { type: 'button', role: 'menuitem', text: e.text, disabled: !!e.aus });
    b.addEventListener('click', () => { schliessen(); e.tun(); });
    m.append(b);
  }
  const huelle = el('div', 'ebene-klick', {}, [m]);
  huelle.addEventListener('pointerdown', e => { if (e.target === huelle) schliessen(); });
  ebenen().append(huelle);
  offen = huelle;
  const breite = 260;
  let x = k.x + k.w - breite, y = k.y + k.h + 6;
  if (x < 10) x = k.x;
  const hoehe = m.offsetHeight;
  if (y + hoehe > 1070) y = k.y - hoehe - 6;
  Object.assign(m.style, { left: x + 'px', top: y + 'px', width: breite + 'px' });
  m.querySelector('button:not([disabled])')?.focus();
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { schliessen(); anker.focus(); } });
}

function dialog(titel, inhalt, breite = 860) {
  schliessen();
  const zu = taste({ text: '✕', klasse: 'icon dialog-zu', aria: 'Schließen', onKlick: schliessen });
  const d = el('div', 'dialog panel', { role: 'dialog', 'aria-modal': 'true', 'aria-label': titel }, [
    el('div', 'dialog-kopf', {}, [el('h2', '', { text: titel }), zu]),
    el('div', 'dialog-inhalt', {}, inhalt),
  ]);
  d.style.width = breite + 'px';
  const huelle = el('div', 'ebene-klick abdunkeln', {}, [d]);
  huelle.addEventListener('pointerdown', e => { if (e.target === huelle) schliessen(); });
  d.addEventListener('keydown', e => { if (e.key === 'Escape') schliessen(); });
  ebenen().append(huelle);
  offen = huelle;
  zu.focus();
  return d;
}

function wahl(label, pfad, optionen, engine, erklaerung) {
  const knoepfe = optionen.map(([wert, text]) => {
    const b = taste({ text, klasse: 'klein akzent-weiss', onKlick: () => { engine.request(pfad, wert); zeigen(); } });
    b.dataset.wert = String(wert);
    return b;
  });
  const lesen = () => pfad.split('.').reduce((o, k) => o[k], state);
  const zeigen = () => knoepfe.forEach(b => an(b, b.dataset.wert === String(lesen())));
  zeigen();
  return el('div', 'einst-zeile', {}, [
    el('div', 'einst-text', {}, [el('strong', '', { text: label }), erklaerung ? el('small', '', { text: erklaerung }) : null]),
    el('div', 'einst-wahl', {}, knoepfe),
  ]);
}

export function einstellungen(engine) {
  dialog('Einstellungen', [
    wahl('Pegel der Kanäle', 'master.meterAbgriff', [['pre', 'PRE (vor Fader)'], ['post', 'POST (nach Fader)']], engine,
      'PRE zeigt das Signal nach EQ/Filter, POST nach dem Kanalfader.'),
    wahl('Crossfader-Kurve', 'master.xfKurve', [['weich', 'Weich'], ['scharf', 'Scharf (Cut)']], engine,
      'Weich: gleiche Leistung in der Mitte. Scharf: beide voll, Ausblenden erst am Rand.'),
    wahl('Crossfader steuert', 'master.xfSteuert', [['auto', 'Bild + Ton'], ['audio', 'Nur Ton'], ['video', 'Nur Bild']], engine,
      'Nur Ton: das Bild zeigt den lauteren Kanal. Nur Bild: beide Kanäle voll hörbar.'),
    wahl('Master-Limiter', 'master.limiter', [[true, 'An'], [false, 'Aus']], engine, 'Begrenzt bei −1 dBFS (Web-Audio-Kompressor).'),
    wahl('Jogwheel-Lage', 'layout.jog', [['innen', 'Innen (wie Bild 2)'], ['aussen', 'Außen']], engine,
      'Kanal 2 bleibt immer das Spiegelbild von Kanal 1.'),
    el('div', 'einst-zeile', {}, [
      el('div', 'einst-text', {}, [el('strong', '', { text: 'Tastatur' }),
        el('small', '', { html: 'Kanal 1: <kbd>X</kbd> Play, <kbd>Z</kbd>/<kbd>Y</kbd> Cue, <kbd>S</kbd> Sync, <kbd>1</kbd>–<kbd>4</kbd> Loop 4/8/16/32 · ' +
          'Kanal 2: <kbd>.</kbd> Play, <kbd>,</kbd> Cue, <kbd>L</kbd> Sync, <kbd>7</kbd>–<kbd>0</kbd> Loop · ' +
          '<kbd>←</kbd>/<kbd>→</kbd> Crossfader, <kbd>M</kbd> Automix. Fokussierte Regler: Pfeiltasten, <kbd>Entf</kbd> = Mitte.' })]),
    ]),
  ]);
}

export function quellenDialog(engine, aktionen) {
  const liste = el('div', 'quellen-liste');
  const datei = el('input', '', { type: 'file', accept: 'audio/*', multiple: true, hidden: true });
  datei.addEventListener('change', () => {
    for (const f of datei.files) aktionen.inLeiste(ADAPTER.LOCAL_LICENSED.dateiHinzu(f));
    datei.value = '';
    zeigen();
  });
  async function zeigen() {
    liste.innerHTML = '';
    for (const a of Object.values(ADAPTER)) {
      const titel = await a.liste();
      const kopf = el('div', 'quelle-kopf', {}, [
        el('div', '', {}, [el('strong', '', { text: a.name }), el('small', '', { text: a.hinweis })]),
        a.id === 'LOCAL_LICENSED' ? taste({ text: 'Datei wählen …', klasse: 'klein akzent-weiss', onKlick: () => datei.click() }) : null,
      ]);
      const faehig = el('div', 'faehig', {}, Object.entries(a.faehig).map(([k, v]) => el('span', 'f-' + v, { text: k + ': ' + v })));
      const zeilen = titel.slice(0, a.id === 'EXISTING_YOUTUBE' ? 8 : 50).map(t => el('div', 'quelle-titel' + (t.gesperrt ? ' gesperrt' : ''), {}, [
        el('span', '', { text: t.titel }), el('span', 'grau', { text: t.kuenstler }),
        t.gesperrt ? el('span', 'grau', { text: 'nicht freigegeben' })
          : taste({ text: '+ Nächste Titel', klasse: 'klein', onKlick: () => aktionen.inLeiste(t) }),
      ]));
      if (a.id === 'EXISTING_YOUTUBE' && titel.length > 8) zeilen.push(el('div', 'grau', { text: `… ${titel.length - 8} weitere (nur Anzeige)` }));
      liste.append(el('section', 'quelle', {}, [kopf, faehig, ...zeilen]));
    }
  }
  zeigen();
  dialog('Quellen', [datei, liste], 980);
}

export function matrixDialog() {
  dialog('Was ist echt, was ist Demo?', [matrixTabelle()], 980);
}

export function matrixTabelle() {
  return el('table', 'matrix', {}, [
    el('thead', '', {}, [el('tr', '', {}, ['Funktion', 'Stand', 'Hinweis'].map(t => el('th', '', { text: t })))]),
    el('tbody', '', {}, MATRIX.map(([f, s, h]) => el('tr', '', {}, [
      el('td', '', { text: f }), el('td', 'stand stand-' + s.split(' ')[0].replace(/[^a-z]/gi, ''), { text: s }), el('td', '', { text: h }),
    ]))),
  ]);
}

export function listenDialog(aktionen) {
  const box = el('div', 'liste-voll');
  const zeigen = () => {
    box.innerHTML = '';
    if (!state.queue.length) box.append(el('p', 'grau', { text: 'Keine Titel in der Leiste. Über „Quellen" hinzufügen.' }));
    state.queue.forEach((q, i) => {
      const t = q.track;
      box.append(el('div', 'liste-zeile', {}, [
        el('span', 'nr', { text: String(i + 1) }),
        el('span', '', { text: t.titel }), el('span', 'grau', { text: t.kuenstler }),
        el('span', 'grau', { text: t.bpm ? t.bpm + ' BPM · ' + (t.key || '') : '' }),
        taste({ text: '↑', klasse: 'klein', aria: 'nach oben', onKlick: () => { aktionen.verschieben(q.id, i - 1); } }),
        taste({ text: 'A', klasse: 'klein', aria: 'in Kanal 1 laden', onKlick: () => aktionen.ausLeisteLaden(q.id, 'A') }),
        taste({ text: 'B', klasse: 'klein', aria: 'in Kanal 2 laden', onKlick: () => aktionen.ausLeisteLaden(q.id, 'B') }),
        taste({ text: '✕', klasse: 'klein', aria: 'entfernen', onKlick: () => aktionen.entfernen(q.id) }),
      ]));
    });
  };
  zeigen();
  const ab = abonnieren(p => { if (p === 'queue') zeigen(); });
  const d = dialog('Nächste Titel – ganze Liste', [box], 900);
  new MutationObserver((_, o) => { if (!d.isConnected) { ab(); o.disconnect(); } }).observe(ebenen(), { childList: true });
}
