// DJ-Modus (TV): Getraenke-Angebote unter dem Pioneer-DJ-Schriftzug, abwechselnd (21.10.2026).
// Nur Schrift, kein Feld - unter dem Schriftzug zwischen den Tasten A und B (Bild-2-Pixel 560-1110).
// Schrift: Saira, breit (125 %), 900 kursiv - am naechsten am Pioneer-Schriftzug (verglichen mit
// Exo 2, Kanit, Russo One, Orbitron). Angebote aus werbung.json (Repo, "djAngebote" mit aktiv),
// alle 10 min neu gelesen; Takt/Dauer/Groesse/Auswahl vom Chef-Handy; ohne Angebote bleibt es leer.
import { F } from '../skin.js';

// Ganze Breite zwischen den Tasten A und B (Betreiber: groesser, in die Laenge gezogen) -
// im Crossfader-Feld allein (390) wurde die gestreckte Schrift verkleinert.
const LAGE = [544, 763, 576, 40];          // x, y, Breite, Hoehe in Bild-2-Pixeln (4 nach links: Kursive wirkt sonst rechtslastig)
const STRECKUNG = 1.25;                    // waagrecht gezogen wie der Pioneer-Schriftzug (Betreiber)
// Skins mit hellem Grund: dort ist der Pioneer-Schriftzug schwarz - die Werbung auch
// (gemessen am Bild: Median der Schriftzug-Flaeche > 150)
const DUNKLER_SCHRIFTZUG = ['gold', 'weiss', 'chrom', 'elfenbein', 'ladys-pink', 'champagner'];
// Vorgabe: jede Minute alle Angebote nacheinander je 7 s, dazwischen leer, 38 px (Betreiber 21.10.).
// Einstellbar am Chef-Handy (Uebersicht -> Werbung -> "DJ-Modus: Angebote"): an, alleS (0 = immer),
// dauerS, groesse, a_<id> je Angebot - kommt ueber die TV-Seite mit (djWerbung).
const VORGABE = { an: true, alleS: 60, dauerS: 7, groesse: 38 };
const NEU_LESEN_MS = 10 * 60 * 1000;

const SCHRIFT_URL = 'https://fonts.googleapis.com/css2?family=Saira:ital,wdth,wght@1,125,900&display=swap';

export function angeboteStarten(buehne) {
  // Schrift selbst laden, falls die Seite (z. B. eine zwischengespeicherte aeltere Fassung) sie
  // nicht mitbringt - sonst blieb die Ersatzschrift stehen
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => /family=Saira/.test(l.href))) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = SCHRIFT_URL;
    document.head.appendChild(l);
  }
  const el = document.createElement('div');
  el.className = 'tv-angebot' + (DUNKLER_SCHRIFTZUG.includes(buehne.dataset.skin) ? ' dunkel' : '');
  const [x, y, w, h] = LAGE.map(v => v * F);
  Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  buehne.appendChild(el);
  let alle = [], einst = { ...VORGABE }, einstText = '', laeuft = null;
  const wert = k => (einst[k] === undefined || einst[k] === null ? VORGABE[k] : einst[k]);
  // Angebote nach Einstellung: a_<id> am Handy geht vor "aktiv" aus werbung.json
  const liste = () => alle.filter(a => (einst['a_' + a.id] ?? a.aktiv) !== false).map(a => [a.titel, a.preis]);
  addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.typ !== 'ytm-dj') return;
    const t = JSON.stringify(e.data.djWerbung || {});
    if (t === einstText) return;
    einstText = t; einst = { ...VORGABE, ...(e.data.djWerbung || {}) };
    neuStarten();
  });

  async function lesen() {
    try {
      const r = await fetch('../werbung.json', { cache: 'no-cache' });
      const d = await r.json();
      // eigene Liste fuers DJ Studio (Betreiber 21.10.: Jaegermeister + "Ane aufs Aug", ohne
      // Puntigamer), sonst die allgemeinen Aktionen
      alle = (Array.isArray(d.djAngebote) ? d.djAngebote : Array.isArray(d.aktionen) ? d.aktionen : [])
        .filter(a => a && a.titel)
        .map(a => ({ id: String(a.id || a.titel), titel: String(a.titel), preis: String(a.preis || ''), aktiv: a.aktiv !== false }));
    } catch (e) { /* Netz weg: alte Liste behalten */ }
  }
  // zu lang (mit Streckung): Schrift verkleinern, bis es in die Breite passt
  function einpassen() {
    const innen = el.firstChild;
    if (!innen) return;
    el.style.fontSize = Math.max(20, Math.min(60, Number(wert('groesse')) || 38)) + 'px';
    let g = parseFloat(el.style.fontSize);
    while (innen.scrollWidth * STRECKUNG > el.clientWidth && g > 10) { g -= 1; el.style.fontSize = g + 'px'; }
  }
  function zeigen(titel, preis) {
    el.classList.remove('an');
    setTimeout(() => {
      el.textContent = '';
      const innen = document.createElement('div'); innen.className = 'innen';
      innen.style.transform = `scaleX(${STRECKUNG})`;
      const t = document.createElement('span'); t.textContent = titel;
      innen.appendChild(t);
      if (preis) { const p = document.createElement('span'); p.className = 'preis'; p.textContent = preis; innen.appendChild(p); }
      el.appendChild(innen);
      einpassen();
      el.classList.add('an');
    }, 600);
  }
  // erst zeigen, wenn die Schrift da ist (sonst kurz eine Ersatzschrift, falsch eingepasst):
  // bis 10 s warten, bis Saira angemeldet und geladen ist; kommt sie spaeter, neu einpassen
  async function schrift() {
    for (let i = 0; i < 50; i++) {                // bis 10 s
      try { await document.fonts.load("italic 900 30px 'Saira'"); } catch (e) {}
      if ([...document.fonts].some(f => f.family.replace(/['"]/g, '') === 'Saira' && f.status === 'loaded')) return;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  document.fonts.addEventListener('loadingdone', einpassen);
  // ein Durchgang: Angebot fuer Angebot je dauerS, dann ausblenden bis zum naechsten (alleS);
  // alleS 0 = immer (gleich weiter mit dem naechsten Durchgang)
  let uhren = [];
  function durchgang() {
    uhren.forEach(clearTimeout); uhren = [];
    const l = wert('an') === false ? [] : liste(), d = Math.max(3, Number(wert('dauerS')) || 7) * 1000;
    l.forEach(([titel, preis], k) => uhren.push(setTimeout(() => zeigen(titel, preis), k * d)));
    const alleMs = Number(wert('alleS')) * 1000;
    if (!l.length) { el.classList.remove('an'); return; }
    if (alleMs > 0) uhren.push(setTimeout(() => el.classList.remove('an'), l.length * d));
  }
  function neuStarten() {
    if (laeuft === null) return;               // erst nach Schrift und Liste
    clearInterval(laeuft);
    const alleMs = Number(wert('alleS')) * 1000;
    const runde = alleMs > 0 ? Math.max(alleMs, liste().length * Math.max(3, Number(wert('dauerS')) || 7) * 1000)
      : Math.max(1, liste().length) * Math.max(3, Number(wert('dauerS')) || 7) * 1000;
    durchgang();
    laeuft = setInterval(durchgang, runde);
  }
  Promise.all([lesen(), schrift()]).then(() => { laeuft = 0; neuStarten(); });
  setInterval(() => lesen().then(neuStarten), NEU_LESEN_MS);
}
