/*
 * Weihnachts-Dashboard (23.11.2026, Betreiber): vom 20.11. bis 06.01. automatisch an.
 *   - Hintergrund: 4 Advent-Bilder (KI-hochgerechnet), stuendlich im Wechsel mit Ueberblendung
 *   - Krampus-Widget: Rahmen fuer normale Ansicht und Vollbild
 *   - Deko: Weihnachtsmuetze, Schneehaube, Kugeln, schmale Girlanden (nur wenn ihre Karte zu sehen ist)
 *   - Lindi (Lindwurm mit Muetze) schaut vom rechten Rand herein und hat Angst vor den Krampussen,
 *     mit Sprechblase; alle 20 min und beim Start jedes Krampus-Auftritts
 *   - 3D-Emojis/Smileys statt der normalen Emojis (Text des Dashboards, Laufband, Sprechblase),
 *     3D-Wettersymbole, Wetter-Smiley neben "Klagenfurt"
 *   - Laufband mit Advent-Spruechen
 * ?weihnacht=1 erzwingt, ?weihnacht=0 schaltet ab. Bilder: weihnacht/ (webp).
 * window.weihnacht.lindi() startet Lindi sofort (Test).
 */
(function () {
  const q = new URLSearchParams(location.search).get('weihnacht');
  const jetzt = new Date(), m = jetzt.getMonth() + 1, t = jetzt.getDate();
  const saison = (m === 11 && t >= 20) || m === 12 || (m === 1 && t <= 6);
  if (q === '0' || (!saison && q !== '1')) return;

  const B = (window.WEIHNACHT_BASIS || 'weihnacht/');
  const bild = n => B + n + '.webp';
  const W = 1920, H = 1080;

  // ---------- CSS ----------
  const css = `
  .wn-hg { position: fixed; inset: 0; z-index: -998; pointer-events: none; background-size: cover; background-position: center;
           opacity: 0; transition: opacity 3s ease; }
  .wn-hg.an { opacity: 1; }
  .nl-stage.krampus { background: url(${bild('krampus-karte')}) center / cover no-repeat, linear-gradient(175deg, #1a0606 0%, #050303 100%) !important; }
  body.krampus-voll .nl-kr-voll { background: url(${bild('krampus-vollbild')}) center / cover no-repeat, #050303 !important; }
  #wn-deko { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; pointer-events: none; z-index: 45; }
  #wn-deko .wn-d { position: absolute; display: block; filter: drop-shadow(0 6px 12px rgba(0,0,0,.45)); transition: opacity .6s; }
  #wn-deko .wn-d.weg { opacity: 0; }
  .wn-e { height: 1.18em; width: auto; vertical-align: -0.22em; margin: 0 .04em; display: inline-block; }
  /* Laufband etwas groesser (Betreiber 23.11.): Schrift 34 -> 40 px, Emojis 1,3-fach; das Band bleibt gleich hoch */
  #card-ticker .ticker-move { font-size: 40px !important; }
  #card-ticker .ticker-move .wn-e { height: 1.3em; vertical-align: -0.3em; }
  /* Lindi: Grundstellung rechts unten (Dashboard und Krampus normal). Weitere Seiten per Klasse:
     links (gespiegelt), voll-rechts/voll-links (Krampus-Vollbild: schaut hinter dem Video hervor -
     das mpv-Fenster liegt ueber der Seite und verdeckt den Rest), unten (eigene Bilder lindi-unten-*). */
  #wn-lindi { position: absolute; right: -6px; bottom: -4px; height: 560px; z-index: 62; pointer-events: none;
              transform: translateX(110%); transition: transform .9s cubic-bezier(.3,1.3,.5,1); filter: drop-shadow(0 10px 18px rgba(0,0,0,.5)); }
  #wn-lindi.da { transform: translateX(0); }
  #wn-lindi.links { right: auto; left: -6px; transform: translateX(-110%) scaleX(-1); }
  #wn-lindi.links.da { transform: scaleX(-1); }
  #wn-lindi.voll-rechts { right: auto; bottom: auto; left: 1752px; top: 104px; height: 600px; }
  #wn-lindi.voll-links { right: 1752px; bottom: auto; left: auto; top: 104px; height: 600px; transform: translateX(-110%) scaleX(-1); }
  #wn-lindi.voll-links.da { transform: scaleX(-1); }
  #wn-lindi.unten { right: 120px; height: 430px; transform: translateY(110%); }
  #wn-lindi.unten.da { transform: translateY(0); }
  #wn-lindi.zittert { animation: wn-zittern .12s linear infinite; }
  @keyframes wn-zittern { 0%,100% { translate: 0 0; } 25% { translate: -3px 1px; } 75% { translate: 3px -1px; } }
  #wn-blase { position: absolute; right: 360px; bottom: 420px; max-width: 460px; padding: 22px 30px; z-index: 62; pointer-events: none;
              background: #fff; color: #14321a; border-radius: 28px; font: 800 32px/1.25 'Plus Jakarta Sans', sans-serif;
              box-shadow: 0 14px 34px rgba(0,0,0,.45); transform: scale(0); transform-origin: 100% 80%;
              transition: transform .35s cubic-bezier(.2,1.5,.4,1); }
  #wn-blase.da { transform: scale(1); }
  #wn-blase::after { content: ''; position: absolute; right: -26px; bottom: 30px; border: 18px solid transparent; border-left: 34px solid #fff; border-right: 0; }
  /* Vollbild: Blase oben in der Leiste ueber dem Video, neben Lindis Kopf */
  #wn-blase.voll-rechts, #wn-blase.voll-links { bottom: auto; top: 12px; max-width: 820px; padding: 14px 26px; font-size: 30px; }
  #wn-blase.voll-rechts { right: 176px; transform-origin: 100% 50%; }
  #wn-blase.voll-links { right: auto; left: 176px; transform-origin: 0 50%; }
  #wn-blase.voll-rechts::after { bottom: auto; top: 24px; }
  #wn-blase.voll-links::after { right: auto; left: -26px; bottom: auto; top: 24px; border-left: 0; border-right: 34px solid #fff; }
  #wn-blase.unten { right: 560px; bottom: 250px; }
  #wn-wetter-smiley { height: 34px; width: 34px; vertical-align: -8px; margin-left: 8px; }
  `;
  const stil = document.createElement('style');
  stil.id = 'wn-stil'; stil.textContent = css;
  document.head.appendChild(stil);

  // ---------- Emojis -> 3D-Bilder ----------
  const EMOJI = {
    '☕': 'e-kaffee', '🏆': 'e-pokal', '⚽': 'e-fussball', '🎯': 'e-dart', '🍺': 'e-bier', '🍻': 'e-bier', '🎤': 'e-mikrofon',
    '🎶': 'e-noten', '🎵': 'e-noten', '📅': 'e-kalender', '⏱': 'e-uhr', '🕐': 'e-uhr', '🎄': 'e-christbaum', '🎅': 'e-nikolo',
    '👹': 'e-krampus', '🍷': 'e-gluehwein', '⛄': 'e-schneemann', '☃': 'e-schneemann', '🎁': 'e-geschenk', '🔔': 'e-glocke',
    '🕯': 'e-adventkranz', '⭐': 'e-stern', '✨': 'e-stern', '☀': 'e-sonne', '🌤': 'e-sonne-wolke', '⛅': 'e-sonne-wolke',
    '☁': 'e-wolke', '🌧': 'e-regen', '❄': 'e-schnee', '🌨': 'e-schnee', '🌫': 'e-nebel', '⛈': 'e-gewitter', '🌙': 'e-mond',
    '🌡': 'e-thermometer',
    '😀': 's-grinsen', '😄': 's-grinsen', '😂': 's-traenen-lachen', '😜': 's-zunge', '😍': 's-herzaugen', '😎': 's-cool',
    '😮': 's-geschockt', '😱': 's-angst', '😢': 's-weinen', '😡': 's-wuetend', '🥳': 's-party', '🎉': 's-party',
    '💃': 's-tanzen', '🥂': 's-prost', '🥴': 's-beschwipst', '😘': 's-kuss', '😅': 's-verschwitzt', '🥱': 's-gaehnen',
    '🙌': 's-tor', '😬': 's-naegelkauen', '🤦': 's-facepalm', '🏅': 's-medaille', '🤩': 's-sternenaugen', '🤔': 's-nachdenklich',
    '🤞': 's-daumen-druecken', '🥶': 's-frierend', '😇': 's-engel', '😈': 's-krampus', '😋': 's-lebkuchen', '🦌': 's-rentier',
    '🙄': 's-augenrollen', '🤨': 's-skeptisch', '💡': 's-idee', '👍': 's-daumen-hoch', '👏': 's-klatschen',
    '🤯': 's-kopf-explodiert', '🤐': 's-zipp', '🙈': 's-durch-finger', '😉': 's-fingerpistolen'
  };
  const MUSTER = new RegExp('(' + Object.keys(EMOJI).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'gu');
  const TEST = new RegExp(MUSTER.source, 'u');
  function emojiTauschen(wurzel) {
    if (!wurzel) return;
    const knoten = [];
    if (wurzel.nodeType === 3) knoten.push(wurzel);
    else {
      const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement && !n.parentElement.closest('script,style,textarea,input,[data-wn-roh]') && TEST.test(n.nodeValue))
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      });
      while (gang.nextNode()) knoten.push(gang.currentNode);
    }
    knoten.forEach(n => {
      if (!n.parentNode || !TEST.test(n.nodeValue)) return;
      const teile = n.nodeValue.split(MUSTER);
      const frag = document.createDocumentFragment();
      teile.forEach((teil, i) => {
        if (i % 2 === 1 && EMOJI[teil]) {
          const img = document.createElement('img');
          img.className = 'wn-e'; img.src = bild(EMOJI[teil]); img.alt = teil; img.draggable = false;
          frag.appendChild(img);
        } else if (teil) frag.appendChild(document.createTextNode(teil));
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  window.weihnachtEmoji = emojiTauschen;

  // ---------- Wettersymbole in 3D ----------
  function symbol3d(code, istTag) {
    const tag = !(istTag === 0 || istTag === false);
    if (code >= 95) return 'e-gewitter';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86 || code === 66 || code === 67) return 'e-schnee';
    if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return 'e-regen';
    if (code === 45 || code === 48) return 'e-nebel';
    if (code === 3) return 'e-wolke';
    if (code === 1 || code === 2) return tag ? 'e-sonne-wolke' : 'e-mond';
    return tag ? 'e-sonne' : 'e-mond';
  }
  function wetterEinhaengen() {
    if (!window.wetterSymbol || window.wetterSymbol.wn) return !!window.wetterSymbol;
    const neu = (code, istTag, px) => {
      const n = px || 64;
      return `<img class="wsz-symbol" src="${bild(symbol3d(code, istTag))}" alt="" width="${n}" height="${n}" style="object-fit:contain">`;
    };
    neu.wn = true;
    window.wetterSymbol = neu;
    return true;
  }

  // ---------- Hintergrund ----------
  const HINTERGRUENDE = ['hg-advent-markt', 'hg-advent-bokeh', 'hg-advent-frost-1', 'hg-advent-frost-2'];
  const hgEbenen = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'wn-hg'; document.body.appendChild(d); return d; });
  let hgAktiv = -1, hgEbene = 0;
  function hintergrund() {
    const nr = Math.floor(Date.now() / 3600000) % HINTERGRUENDE.length;   // jede Stunde ein anderer
    if (nr === hgAktiv) return;
    const neu = hgEbenen[hgEbene], alt = hgEbenen[1 - hgEbene];
    const vor = new Image();
    vor.onload = () => {
      neu.style.backgroundImage = `url(${vor.src})`;
      neu.classList.add('an'); alt.classList.remove('an');
      hgEbene = 1 - hgEbene; hgAktiv = nr;
    };
    vor.src = bild(HINTERGRUENDE[nr]);
  }

  // ---------- Deko an den Karten ----------
  const skalierer = () => document.getElementById('dashboard-scaler') || document.body;
  const deko = document.createElement('div');
  deko.id = 'wn-deko';
  const DEKO = [
    // karte, bild, x/y relativ zur linken oberen Ecke der Karte, breite, drehung
    { karte: 'card-media', b: 'deko-girlande-schmal', x: -10, y: -24, w: 1300 },
    { karte: 'card-media', b: 'deko-muetze', x: -36, y: -52, w: 190, r: -24 },
    { karte: 'card-weather', b: 'deko-schneerand', x: -14, y: -24, w: 548 },
    { karte: 'card-ticker', b: 'deko-girlande-schmal', x: -10, y: -50, w: 1860 },
    { karte: 'card-top-custom', b: 'deko-kugeln', x: 'rechts', dx: 0, y: -16, w: 70 }
  ];
  DEKO.forEach(d => {
    const img = document.createElement('img');
    img.className = 'wn-d weg'; img.src = bild(d.b); img.alt = '';
    img.style.width = d.w + 'px';
    if (d.r) img.style.transform = `rotate(${d.r}deg)`;
    d.el = img; deko.appendChild(img);
  });
  function sichtbar(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 30 || getComputedStyle(el).visibility === 'hidden') return false;
    const o = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40));
    return !!(o && (el.contains(o) || deko.contains(o)));
  }
  function dekoSetzen() {
    const sk = skalierer();
    if (deko.parentNode !== sk) sk.appendChild(deko);
    const sr = sk.getBoundingClientRect(), f = sr.width / W || 1;
    DEKO.forEach(d => {
      const k = document.getElementById(d.karte);
      if (!sichtbar(k) || document.body.classList.contains('krampus-voll')) { d.el.classList.add('weg'); return; }
      const r = k.getBoundingClientRect();
      const x = d.x === 'rechts' ? (r.right - sr.left) / f + (d.dx || 0) : (r.left - sr.left) / f + d.x;
      d.el.style.left = Math.round(x) + 'px';
      d.el.style.top = Math.round((r.top - sr.top) / f + d.y) + 'px';
      d.el.classList.remove('weg');
    });
  }

  // ---------- Lindi ----------
  const SPRUECHE = {
    guckt: ['Pssst … is do wer? 🙈', 'Hearst, wer hot de Glockn bestellt?! 🔔', 'I hob a Mützn auf – i bin quasi da Nikolo! 🎅'],
    dreht: ['Mama! Do hinten rasselt wos! 😮', 'Wer stinkt do so noch Fell und Rauch? 🤨'],
    angst: ['Oje, de Krampusse san wieder unterwegs! 😱', 'I bin brav gwesn! Ehrlich! 😇', 'De Rute is fia wen anders, gell? 😬',
            'Herr Krampus, i zahl de nächste Runde! 🍻', 'Owa i hob eh nur a bissl gschlimmt … 😅'],
    versteckt: ['Wenn i mi ned rühr, sehn’s mi ned … 🤐', 'Schnell, versteck mi hinter da Theke! 🙈',
                'Wenn da Krampus kummt, bin i im Kammerl! 😬', 'I schau lieber im Fernseher zua – do is sicherer! 📺'],
    erleichtert: ['Puh … san weg. Glühwein, bitte! 🍷', 'I glaub, i brauch an Schnaps für de Nerven … 🥴']
  };
  const zufall = l => l[Math.floor(Math.random() * l.length)];
  const lindi = document.createElement('img');
  lindi.id = 'wn-lindi'; lindi.alt = ''; lindi.src = bild('lindi-guckt');
  const blase = document.createElement('div');
  blase.id = 'wn-blase';
  ['lindi-dreht-sich', 'lindi-angst', 'lindi-versteckt', 'lindi-erleichtert'].forEach(n => { const i = new Image(); i.src = bild(n); });
  let lindiLaeuft = false, lindiTimer = [];
  // Bilder fuer "von unten" (lindi-unten-*.webp) gibt es erst, wenn sie im Ordner liegen - beim Start pruefen.
  let untenDa = false;
  { const p = new Image(); p.onload = () => { untenDa = true; }; p.src = bild('lindi-unten-guckt'); }
  const krampusVoll = () => document.body.classList.contains('krampus-voll')
    && !!document.querySelector('#media-view-nightlife.active');
  const krampusNormal = () => !document.body.classList.contains('krampus-voll')
    && !!document.querySelector('#media-view-nightlife.active .nl-stage.krampus');
  // Wo darf Lindi gerade hin? Vollbild: links/rechts hinter dem Video; sonst rechts (und unten, wenn es die Bilder gibt).
  function lindiSeiten() {
    if (krampusVoll()) return ['voll-rechts', 'voll-links'];
    const rechtsFrei = sichtbar(document.getElementById('card-rotator')) && sichtbar(document.getElementById('card-ticker'));
    if (!rechtsFrei) return [];
    return untenDa ? ['rechts', 'unten'] : ['rechts'];
  }
  function lindiFrei(seite) {
    if (seite === 'voll-rechts' || seite === 'voll-links') return krampusVoll();
    return lindiSeiten().includes(seite);
  }
  function sagen(text) {
    blase.classList.remove('da');
    setTimeout(() => { blase.textContent = text; emojiTauschen(blase); blase.classList.add('da'); }, 250);
  }
  const SEITEN_KLASSEN = ['links', 'voll-rechts', 'voll-links', 'unten'];
  function lindiAblauf(erzwingen, wunschSeite) {
    if (lindiLaeuft) return false;
    const seiten = lindiSeiten();
    const seite = wunschSeite || zufall(seiten.length ? seiten : ['rechts']);
    if (!erzwingen && !seiten.includes(seite)) return false;
    const sk = skalierer();
    if (lindi.parentNode !== sk) { sk.appendChild(blase); sk.appendChild(lindi); }
    lindiLaeuft = true;
    lindiTimer.forEach(clearTimeout); lindiTimer = [];
    // Seite setzen, ohne sichtbare Bewegung (erst hinter dem Rand aufstellen)
    lindi.style.transition = 'none';
    SEITEN_KLASSEN.forEach(k => { lindi.classList.remove(k); blase.classList.remove(k); });
    if (seite !== 'rechts') { lindi.classList.add(seite); blase.classList.add(seite); }
    void lindi.offsetWidth; lindi.style.transition = '';
    const unten = seite === 'unten';
    const pose = n => bild(unten ? ({ 'lindi-guckt': 'lindi-unten-guckt', 'lindi-dreht-sich': 'lindi-unten-guckt',
      'lindi-angst': 'lindi-unten-angst', 'lindi-versteckt': 'lindi-unten-versteckt',
      'lindi-erleichtert': 'lindi-unten-guckt' })[n] : n);
    const t = (ms, f) => lindiTimer.push(setTimeout(f, ms));
    const pruefen = f => () => { if (!erzwingen && !lindiFrei(seite)) { lindiWeg(); return; } f(); };
    lindi.src = pose('lindi-guckt'); lindi.classList.remove('zittert');
    t(100, () => lindi.classList.add('da'));
    t(1300, pruefen(() => sagen(zufall(SPRUECHE.guckt))));
    t(4800, pruefen(() => { lindi.src = pose('lindi-dreht-sich'); sagen(zufall(SPRUECHE.dreht)); }));
    t(8300, pruefen(() => { lindi.src = pose('lindi-angst'); lindi.classList.add('zittert'); sagen(zufall(SPRUECHE.angst)); }));
    t(11800, pruefen(() => { lindi.classList.remove('zittert'); lindi.src = pose('lindi-versteckt'); sagen(zufall(SPRUECHE.versteckt)); }));
    t(15300, pruefen(() => { lindi.src = pose('lindi-erleichtert'); sagen(zufall(SPRUECHE.erleichtert)); }));
    t(19000, lindiWeg);
    return true;
  }
  function lindiWeg() {
    lindiTimer.forEach(clearTimeout); lindiTimer = [];
    blase.classList.remove('da'); lindi.classList.remove('da', 'zittert');
    setTimeout(() => { lindiLaeuft = false; }, 1000);
  }
  let lindiZuletzt = Date.now() - 18 * 60000;   // erster Auftritt ~2 min nach dem Laden
  let krampusWar = '';

  // ---------- Wetter-Smiley ----------
  function wetterSmiley() {
    const tempEl = document.getElementById('weather-temp-text'), stadt = document.querySelector('#card-weather .weather-city');
    if (!tempEl || !stadt) return;
    const temp = parseFloat((tempEl.textContent || '').replace(',', '.'));
    const status = (document.getElementById('weather-status-text') || {}).textContent || '';
    let s = '';
    if (/schnee/i.test(status)) s = 's-haube';
    else if (!isNaN(temp) && temp <= 0) s = 's-frierend';
    else if (!isNaN(temp) && temp >= 22) s = 's-cool';
    else if (/sonn|klar|heiter/i.test(status)) s = 's-grinsen';
    let img = document.getElementById('wn-wetter-smiley');
    if (!s) { if (img) img.remove(); return; }
    if (!img) { img = document.createElement('img'); img.id = 'wn-wetter-smiley'; img.alt = ''; stadt.appendChild(img); }
    if (!img.src.endsWith(s + '.webp')) img.src = bild(s);
  }

  // ---------- Laufband ----------
  const TICKER = [
    '☕ City Cafe Klagenfurt Fischl – dein gemütlicher Treffpunkt im Advent 🎄',
    '🎄 Eine schöne Vorweihnachtszeit wünscht euch das City-Cafe-Team 😇',
    '🔥 Hafenknistern im Lendhafen: 26.11. bis 20.12., Donnerstag bis Sonntag ✨',
    '🎅 Der Christkindlmarkt am Neuen Platz hat offen – und danach auf an Sprung zu uns! 😋',
    '👹 Krampuslauf Klagenfurt & Fischl 2026 – jeden Tag ab 14 Uhr bei uns am Bildschirm 😱',
    '🥶 Zapfig draußen? Rein mit dir, bei uns is warm und gemütlich!',
    '⛄ Kalte Nasen, warme Herzen – willkommen im Fischl',
    '🔔 Wer brav war, kriagt a Busserl vom Nikolo 😇',
    '😈 Da Krampus schaut zua – also benehmt’s eich! 😂',
    '🎶 Weihnachtshits, Schlager & Party – für jeden Geschmack was dabei 💃',
    '🍻 Prost auf die schönste Zeit im Jahr! 🥂',
    '🕯 Advent, Advent – im City Cafe brennt immer a Licht',
    '🎄 Gemütlich zammsitzen, plaudern, anstoßen – des is Advent 🥂',
    '⭐ Danke, dass ihr da seid – mit euch is es am schönsten 😍',
    '🎯 City Flyers & Dart-Liga – mitfiebern bei uns 🤞',
    '🎤 Singen, lachen, feiern – so geht Advent im City Cafe 🥳',
    '📍 Mitten in Klagenfurt-Fischl – immer einen Besuch wert 👍',
    '🎁 Die schönsten Geschenke sind gemeinsame Abende 😘',
    '❄️ Draußen Schnee, drinnen gute Stimmung 😎',
    '🦌 Rudolph hat heut frei – der sitzt bei uns an der Bar 😂'
  ];
  // Eigene Termine (wie auf der Kreidetafel, raetsel-test/werbung.js, vom Betreiber 11.11.2026).
  // Bis einschliesslich "bis" im Laufband, mit Countdown; danach fallen sie von selbst heraus.
  const TERMINE = [
    { bis: '2026-12-04', text: '👹 Freitag, 4. Dezember ab 18 Uhr: Krampuskränzchen mit Live-Musik im City Cafe 🎶' },
    { bis: '2026-12-05', text: '👹 Samstag, 5. Dezember ab 17 Uhr: Krampuskränzchen mit Live-Musik im Cafe Plauscherl, Feschnig 🎶' }
  ];
  function termineHeute() {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    return TERMINE.map(tm => {
      const tage = Math.round((new Date(tm.bis + 'T00:00:00') - h) / 864e5);
      if (tage < 0) return null;
      const wann = tage === 0 ? ' – heute! 🥳' : tage === 1 ? ' – schon morgen! 🤩' : ` – noch ${tage} Tage!`;
      return tm.text + wann;
    }).filter(Boolean);
  }
  let laufbandStand = '';
  function laufband() {
    try {
      if (typeof dynamicPartyMessages === 'undefined') return;
      const termine = termineHeute();
      // Termine doppelt, damit sie in jeder Runde sicher und oefter vorkommen
      const neu = [...TICKER, ...termine, ...termine];
      const stand = neu.join('|');
      if (stand === laufbandStand) return;
      laufbandStand = stand;
      dynamicPartyMessages.splice(0, dynamicPartyMessages.length, ...neu);
      if (typeof generateDynamicPartyTicker === 'function') generateDynamicPartyTicker();
    } catch (e) {}
  }

  // ---------- Takt ----------
  const beobachter = new MutationObserver(liste => {
    for (const m of liste) {
      if (m.type === 'characterData') { if (TEST.test(m.target.nodeValue || '')) emojiTauschen(m.target); continue; }
      m.addedNodes.forEach(n => { if (n.nodeType === 3 ? TEST.test(n.nodeValue) : n.nodeType === 1) emojiTauschen(n); });
    }
  });
  function start() {
    laufband();
    wetterEinhaengen();
    hintergrund();
    emojiTauschen(document.body);
    beobachter.observe(document.body, { childList: true, subtree: true, characterData: true });
    dekoSetzen(); wetterSmiley();
    setInterval(() => { dekoSetzen(); wetterEinhaengen(); }, 2000);
    setInterval(() => { hintergrund(); wetterSmiley(); laufband(); }, 60000);
    setInterval(() => {
      // Krampus-Auftritt: Lindi kommt 9 s nach Beginn der normalen Ansicht und 9 s nach dem Wechsel ins
      // Vollbild (2. Gruppe) - im Vollbild links oder rechts hinter dem Video hervor.
      const kr = krampusVoll() ? 'voll' : krampusNormal() ? 'normal' : '';
      if (kr && kr !== krampusWar) setTimeout(() => {
        if ((kr === 'voll' ? krampusVoll() : krampusNormal()) && lindiAblauf()) lindiZuletzt = Date.now();
      }, 9000);
      krampusWar = kr;
      if (Date.now() - lindiZuletzt > 20 * 60000 && lindiAblauf()) lindiZuletzt = Date.now();
    }, 3000);
  }
  window.weihnacht = { lindi: (seite) => lindiAblauf(true, seite), deko: dekoSetzen, hintergrund, emoji: emojiTauschen };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
