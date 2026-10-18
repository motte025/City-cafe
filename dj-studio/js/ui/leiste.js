// "NAECHSTE TITEL": Karten mit Cover, Titel, Interpret, BPM/Key, Dauer.
// Ziehen = Reihenfolge aendern oder auf ein Deck laden. Menue je Karte.

import { state, abonnieren } from '../store.js';
import { el, taste, an, zeit } from './controls.js';
import { cover } from '../artwork.js';
import { menue, quellenDialog, listenDialog } from './overlays.js';

const PRO_SEITE = 6;

export function leisteBauen(root, engine, aktionen) {
  let seite = 0;
  const anzahl = el('span', 'leiste-anzahl');
  const tQuellen = taste({ html: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="4" height="2.4"/><rect x="9" y="5" width="12" height="2.4"/><rect x="3" y="11" width="4" height="2.4"/><rect x="9" y="11" width="12" height="2.4"/><rect x="3" y="17" width="4" height="2.4"/><rect x="9" y="17" width="12" height="2.4"/></svg>',
    klasse: 'icon', aria: 'Quellen: Titel hinzufügen', onKlick: () => quellenDialog(engine, aktionen) });
  const tZurueck = taste({ html: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>', klasse: 'icon pfeil', aria: 'vorige Seite', onKlick: () => { seite--; zeigen(); } });
  const tVor = taste({ html: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>', klasse: 'icon pfeil', aria: 'nächste Seite', onKlick: () => { seite++; zeigen(); } });
  const tAuto = taste({ html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h11l-3-3M20 16H9l3 3"/></svg><span>AUTOMIX</span>',
    klasse: 'automix akzent-weiss', titel: 'Automix: 16 Takte vor Ende den nächsten Titel taktgenau einblenden', onKlick: () => engine.request('automix', !state.automix) });
  const tListe = taste({ html: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="2.4" rx="1"/><rect x="3" y="11" width="18" height="2.4" rx="1"/><rect x="3" y="17" width="18" height="2.4" rx="1"/></svg>',
    klasse: 'icon', aria: 'Ganze Liste', onKlick: () => listenDialog(aktionen) });
  const karten = el('div', 'leiste-karten', { role: 'list' });
  root.append(
    el('div', 'leiste-kopf', {}, [
      el('div', 'leiste-links', {}, [tQuellen, el('span', 'leiste-titel', { text: 'NÄCHSTE TITEL' }), anzahl]),
      el('div', 'leiste-rechts', {}, [tZurueck, tVor, tAuto, tListe]),
    ]),
    karten,
  );

  function karte(q, i) {
    const t = q.track;
    const k = el('div', 'karte', { role: 'listitem', draggable: 'true', tabindex: 0, 'aria-label': `${i + 1}. ${t.titel} von ${t.kuenstler}` });
    k.dataset.id = q.id;
    const meta = [t.bpm ? `${t.bpm} BPM` : 'BPM offen', t.key].filter(Boolean).join('  |  ');
    k.append(
      el('span', 'karte-nr', { text: String(i + 1) }),
      el('div', 'karte-cover', { style: `background-image:url(${cover(t, 160)})` }),
      el('div', 'karte-text', {}, [
        el('div', 'karte-titel', { text: t.titel }),
        el('div', 'karte-kuenstler', { text: t.kuenstler }),
        el('div', 'karte-meta', { text: meta }),
        el('div', 'karte-dauer', { text: t.dauer ? zeit(t.dauer) : '--:--' }),
      ]),
      taste({ html: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>', klasse: 'icon karte-menue', aria: `Menü ${t.titel}`,
        onKlick: e => menue(e.currentTarget, [
          { text: 'In Kanal 1 laden', aus: state.decks.A.spielt, tun: () => aktionen.ausLeisteLaden(q.id, 'A') },
          { text: 'In Kanal 2 laden', aus: state.decks.B.spielt, tun: () => aktionen.ausLeisteLaden(q.id, 'B') },
          { text: 'An den Anfang', aus: i === 0, tun: () => aktionen.verschieben(q.id, 0) },
          { text: 'Aus der Liste entfernen', tun: () => aktionen.entfernen(q.id) },
        ]) }),
    );
    if (t.quelle === 'DEMO') k.append(el('span', 'karte-demo', { text: 'DEMO' }));
    k.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/dj-titel', q.id);
      e.dataTransfer.effectAllowed = 'move';
      k.classList.add('zieht');
    });
    k.addEventListener('dragend', () => k.classList.remove('zieht'));
    k.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/dj-titel')) { e.preventDefault(); k.classList.add('ueber'); } });
    k.addEventListener('dragleave', () => k.classList.remove('ueber'));
    k.addEventListener('drop', e => {
      k.classList.remove('ueber');
      const von = e.dataTransfer.getData('text/dj-titel');
      if (von && von !== q.id) { e.preventDefault(); e.stopPropagation(); aktionen.verschieben(von, state.queue.findIndex(x => x.id === q.id)); }
    });
    // Tastatur: Alt+Pfeil verschiebt, A/B laedt
    k.addEventListener('keydown', e => {
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); e.stopPropagation();
        aktionen.verschieben(q.id, i + (e.key === 'ArrowLeft' ? -1 : 1));
        requestAnimationFrame(() => karten.querySelector(`[data-id="${q.id}"]`)?.focus());
      }
    });
    return k;
  }

  function zeigen() {
    const n = state.queue.length;
    const seiten = Math.max(1, Math.ceil(n / PRO_SEITE));
    seite = Math.max(0, Math.min(seite, seiten - 1));
    anzahl.textContent = `(${n})`;
    karten.innerHTML = '';
    state.queue.slice(seite * PRO_SEITE, seite * PRO_SEITE + PRO_SEITE).forEach((q, j) => karten.append(karte(q, seite * PRO_SEITE + j)));
    for (let j = karten.children.length; j < PRO_SEITE; j++) karten.append(el('div', 'karte leer', { 'aria-hidden': 'true' }));
    tZurueck.disabled = seite === 0; tVor.disabled = seite >= seiten - 1;
  }
  abonnieren(p => {
    if (p === 'queue') zeigen();
    if (p === 'automix') an(tAuto, state.automix);
  });
  zeigen();
  an(tAuto, state.automix);
}
