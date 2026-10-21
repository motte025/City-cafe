// DJ-Modus (TV): Getraenke-Angebote unter dem Pioneer-DJ-Schriftzug, abwechselnd (21.10.2026).
// Nur Schrift, kein Feld - unter dem Schriftzug zwischen den Tasten A und B (Bild-2-Pixel 560-1110).
// Schrift: Saira, breit (125 %), 900 kursiv - am naechsten am Pioneer-Schriftzug (verglichen mit
// Exo 2, Kanit, Russo One, Orbitron). Angebote aus werbung.json (Repo, "djAngebote" mit aktiv),
// alle 10 min neu gelesen; ohne Angebote bleibt die Stelle leer.
import { F } from '../skin.js';

// Ganze Breite zwischen den Tasten A und B (Betreiber: groesser, in die Laenge gezogen) -
// im Crossfader-Feld allein (390) wurde die gestreckte Schrift verkleinert.
const LAGE = [544, 763, 576, 40];          // x, y, Breite, Hoehe in Bild-2-Pixeln (4 nach links: Kursive wirkt sonst rechtslastig)
const STRECKUNG = 1.25;                    // waagrecht gezogen wie der Pioneer-Schriftzug (Betreiber)
// Skins mit hellem Grund: dort ist der Pioneer-Schriftzug schwarz - die Werbung auch
// (gemessen am Bild: Median der Schriftzug-Flaeche > 150)
const DUNKLER_SCHRIFTZUG = ['gold', 'weiss', 'chrom', 'elfenbein', 'ladys-pink', 'champagner'];
const WECHSEL_MS = 7000, NEU_LESEN_MS = 10 * 60 * 1000;

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
  let liste = [], i = 0;

  async function lesen() {
    try {
      const r = await fetch('../werbung.json', { cache: 'no-cache' });
      const d = await r.json();
      // eigene Liste fuers DJ Studio (Betreiber 21.10.: Jaegermeister + "Ane aufs Aug", ohne
      // Puntigamer), sonst die allgemeinen Aktionen
      liste = (Array.isArray(d.djAngebote) ? d.djAngebote : Array.isArray(d.aktionen) ? d.aktionen : [])
        .filter(a => a && a.aktiv !== false && a.titel)
        .map(a => [String(a.titel), String(a.preis || '')]);
    } catch (e) { /* Netz weg: alte Liste behalten */ }
  }
  // zu lang (mit Streckung): Schrift verkleinern, bis es in die Breite passt
  function einpassen() {
    const innen = el.firstChild;
    if (!innen) return;
    el.style.fontSize = '';
    let g = parseFloat(getComputedStyle(el).fontSize);
    while (innen.scrollWidth * STRECKUNG > el.clientWidth && g > 10) { g -= 1; el.style.fontSize = g + 'px'; }
  }
  function zeigen() {
    if (!liste.length) { el.classList.remove('an'); return; }
    const [titel, preis] = liste[i++ % liste.length];
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
  Promise.all([lesen(), schrift()]).then(zeigen);
  setInterval(zeigen, WECHSEL_MS);
  setInterval(lesen, NEU_LESEN_MS);
}
