/* Wetter-Szene (12.11.2026): animierter Hintergrund fuer die grosse Wetter-Uebersicht und das
   kleine Wetter-Widget. Vom Betreiber in der Live-Vorschau (Desktop\Wetter-Grafik) abgenommen.
   Bilder: ChatGPT-Hintergruende/Wolken/Teilchen des Betreibers, Foto-Blitze n1-n7 aus dem DJ-Studio,
   Symbole: Meteocons (MIT, wetter/icons/LICENSE). Alles liegt unter wetter/.
   Freistellung auf Schwarz immer nur Deckkraft = Helligkeit; vordere Wolkenschichten beim Gewitter
   mit mix-blend-mode: lighten, sonst entstehen schwarze Raender.

   wetterSzene(container, lage, klein, { nachts }) -> { stop() }
   wetterLage(code, istTag, sonnenuntergangIso)   -> 'gewitter' | 'regen' | ... (Testen: ?wetter=<lage>, nachts: ?wetter=regen-nacht)
   wetterSymbol(code, istTag, px)                 -> <img> mit Meteocons-Symbol */
(function () {
  const BASIS = 'wetter/';
  const LAGEN = {
    gewitter: { baender: 'gewitter', decke: 'dunkel', lage: [[-0.06, 0.42], [-0.04, 0.48], [0.0, 0.52]], dach: [-0.2, 0.36], regen: 1, regenAb: [0.18, 0.4] },
    regen:    { bild: 'regen-tag', baender: 'graue', lage: [[-0.04, 0.32], [-0.02, 0.38], [0.0, 0.42]], regen: 0.8, regenAb: [0.2, 0.34] },
    bewoelkt: { baender: 'graue', decke: 'grau', lage: [[-0.06, 0.4], [-0.04, 0.46], [0.0, 0.5]], woelkchen: 2, toenung: 'grau' },
    sonnig:   { bild: 'sonnig', woelkchen: 4, toenung: 'weiss' },
    abendrot: { bild: 'abendrot', woelkchen: 3, toenung: 'abend' },
    nebel:    { bild: 'nebel', baender: 'graue', ebenen: [0, 1], lage: [[0.2, 0.36], [0.4, 0.4], [0.5, 0.4]], woelkchen: 2, toenung: 'nebel' },
    schnee:   { bild: 'schnee', schnee: 1, woelkchen: 3, toenung: 'schnee' },
    nacht:    { bild: 'nacht-klar', sterne: 1, woelkchen: 3, toenung: 'nacht' }
  };
  // Nachts: eigene ChatGPT-Bilder (12.11.2026), Wolken tiefer, schneller, oben eine zusaetzliche Reihe
  const NACHT = {
    regen:    { bild: 'regen-nacht', tempo: 0.65, dach: [-0.14, 0.34], lage: [[0.05, 0.34], [0.08, 0.38], [0.11, 0.42]], regenAb: [0.32, 0.46] },
    bewoelkt: { bild: 'bewoelkt-nacht', tempo: 0.65, dach: [-0.14, 0.36], lage: [[0.04, 0.4], [0.07, 0.44], [0.1, 0.48]], decke: null, toenung: 'nacht' },
    nebel:    { bild: 'nebel-nacht', woelkchen: 0 },
    schnee:   { bild: 'schnee-nacht', woelkchen: 0 }
  };
  // Seitenverhaeltnis der freigestellten Wolkenbaender (Breite / Hoehe)
  const BAND_FORM = { 'gewitter-wolken-hinten': 1672 / 627, 'gewitter-wolken-mitte': 1672 / 611, 'gewitter-wolken-vorne': 1672 / 611, 'graue-wolken-hinten': 1672 / 456, 'graue-wolken-mitte': 1672 / 541, 'graue-wolken-vorne': 1672 / 549 };

  const CSS = `
  @property --wsz-bl { syntax: '<number>'; inherits: true; initial-value: 1; }
  .wsz { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .wsz * { pointer-events: none; }
  .wsz-himmel { position: absolute; inset: 0; background: #0a1426; }
  .wsz-gewitter .wsz-himmel { background: radial-gradient(120% 90% at 65% 10%, #4a4280 0%, #262050 40%, #0c0a1c 100%); }
  .wsz-bewoelkt .wsz-himmel { background: linear-gradient(180deg, #6a8299 0%, #3d5168 55%, #1d2a3a 100%); }
  .wsz-bild { position: absolute; inset: -4%; background-size: cover; background-position: center; animation: wsz-fahrt 60s ease-in-out infinite alternate; }
  .wsz-nachts .wsz-bild { filter: brightness(.45) saturate(.7); }
  /* Nachtbilder: Wolkenbaender dunkel, Nebel nur ein Hauch, oben weich ausgeblendet (keine Kante) */
  .wsz-nachtbild.wsz-regen .wsz-band { filter: saturate(.4) brightness(.5); opacity: 1; } .wsz-nachtbild.wsz-regen .wsz-band.wsz-t0 { filter: saturate(.4) brightness(.55) blur(2px); }
  .wsz-nachtbild.wsz-bewoelkt .wsz-band { filter: saturate(.5) brightness(.45); opacity: .5; } .wsz-nachtbild.wsz-bewoelkt .wsz-band.wsz-t0 { filter: saturate(.5) brightness(.5) blur(2px); }
  .wsz-nachtbild.wsz-nebel .wsz-band { filter: brightness(1.1) saturate(0) blur(14px); opacity: .12; }
  .wsz-nachtbild.wsz-regen .wsz-band, .wsz-nachtbild.wsz-bewoelkt .wsz-band { -webkit-mask-image: linear-gradient(transparent 0%, #000 22%, #000 38%, rgba(0,0,0,.6) 62%, transparent 92%); mask-image: linear-gradient(transparent 0%, #000 22%, #000 38%, rgba(0,0,0,.6) 62%, transparent 92%); }
  .wsz-nachtbild .wsz-band.wsz-dach { -webkit-mask-image: linear-gradient(#000 35%, rgba(0,0,0,.6) 62%, transparent 92%); mask-image: linear-gradient(#000 35%, rgba(0,0,0,.6) 62%, transparent 92%); transform: scaleX(-1); }
  .wsz-nachts.wsz-bewoelkt .wsz-himmel { background: linear-gradient(180deg, #2a3646 0%, #18222f 55%, #0b1119 100%); }
  @keyframes wsz-fahrt { from { transform: scale(1) translate(0, 0); } to { transform: scale(1.08) translate(-1.5%, -1%); } }
  .wsz-klein .wsz-bild { background-position: center 35%; }
  .wsz-wolke { position: absolute; left: 0; will-change: transform; animation: wsz-ziehen linear infinite; }
  @keyframes wsz-ziehen { from { transform: translateX(var(--von)); } to { transform: translateX(var(--bis)); } }
  .wsz-decke { position: absolute; left: 0; right: 0; top: 0; z-index: 1; }
  .wsz-decke.wsz-dunkel { height: 40%; background: linear-gradient(180deg, rgba(12,10,28,.55) 0%, rgba(22,19,46,.25) 45%, rgba(22,19,46,0) 100%); }
  .wsz-decke.wsz-grau { height: 55%; background: linear-gradient(180deg, rgba(110,124,140,.85) 0%, rgba(110,124,140,.45) 50%, rgba(110,124,140,0) 100%); }
  .wsz-woelkchen { filter: blur(.3px); opacity: .92; }
  .wsz-band { position: absolute; left: 0; right: 0; background-repeat: repeat-x; background-position-x: 0; animation: wsz-bandziehen linear infinite; }
  @keyframes wsz-bandziehen { from { background-position-x: 0; } to { background-position-x: calc(-1 * var(--kachel)); } }
  .wsz-gewitter .wsz-band.wsz-t0 { filter: blur(2px) brightness(calc(1.3 * var(--wsz-bl))) saturate(1.2); opacity: .85; }
  .wsz-gewitter .wsz-band.wsz-t1 { filter: blur(.5px) brightness(calc(1.2 * var(--wsz-bl))) saturate(1.15); }
  .wsz-gewitter .wsz-band.wsz-t2 { filter: brightness(calc(1 * var(--wsz-bl))) saturate(1.1); }
  /* vordere Schichten duerfen hintere nur aufhellen, nie abdunkeln (sonst schwarze Raender) */
  .wsz-gewitter .wsz-band.wsz-t1, .wsz-gewitter .wsz-band.wsz-t2 { mix-blend-mode: lighten; }
  .wsz-gewitter .wsz-band.wsz-dach { filter: blur(1px) brightness(calc(1.05 * var(--wsz-bl))) saturate(1.1); opacity: .9; transform: scaleX(-1); }
  .wsz-blitzlicht { animation: wsz-wolkenlicht 1.1s ease-out; }
  @keyframes wsz-wolkenlicht { 0% { --wsz-bl: 1; } 4% { --wsz-bl: 2.6; } 11% { --wsz-bl: 1.2; } 18% { --wsz-bl: 2.2; } 40% { --wsz-bl: 1.4; } 100% { --wsz-bl: 1; } }
  .wsz-regen .wsz-band, .wsz-bewoelkt .wsz-band, .wsz-gewitter .wsz-band { -webkit-mask-image: linear-gradient(#000 35%, rgba(0,0,0,.6) 62%, transparent 92%); mask-image: linear-gradient(#000 35%, rgba(0,0,0,.6) 62%, transparent 92%); }
  .wsz-regen .wsz-band { filter: saturate(.35) brightness(1.08); } .wsz-regen .wsz-band.wsz-t0 { filter: saturate(.35) brightness(1.15) blur(2px); opacity: .85; } .wsz-regen .wsz-band.wsz-t2 { filter: saturate(.35) brightness(1.02); opacity: .9; }
  .wsz-bewoelkt .wsz-band { filter: brightness(1.3); } .wsz-bewoelkt .wsz-band.wsz-t0 { filter: brightness(1.35) blur(2px); opacity: .85; } .wsz-bewoelkt .wsz-band.wsz-t2 { filter: brightness(1.22); }
  .wsz-nebel .wsz-band { filter: brightness(1.8) saturate(0) blur(14px); opacity: .22; -webkit-mask-image: linear-gradient(transparent, #000 30%, #000 60%, transparent); mask-image: linear-gradient(transparent, #000 30%, #000 60%, transparent); }
  .wsz-woelkchen.wsz-abend { filter: brightness(.85) sepia(.7) saturate(2.4) hue-rotate(-25deg); opacity: .6; }
  .wsz-woelkchen.wsz-nacht { filter: brightness(.32) saturate(.6); opacity: .55; }
  .wsz-woelkchen.wsz-schnee { filter: brightness(.95) saturate(.2) blur(1px); opacity: .55; }
  .wsz-woelkchen.wsz-nebel { filter: brightness(1.2) saturate(0) blur(4px); opacity: .35; }
  .wsz-woelkchen.wsz-grau { filter: brightness(.95) saturate(.2) blur(1.5px); opacity: .55; }
  .wsz-hell, .wsz-quelle, .wsz-kglow { mix-blend-mode: screen; z-index: 7; }
  .wsz-kblitz { position: absolute; opacity: 0; transform-origin: 50% 0; filter: brightness(1.3) drop-shadow(0 0 7px #dbe7ff) drop-shadow(0 0 18px #8fb4ff); animation: wsz-zucken .55s ease-out forwards; }
  .wsz-kglow { position: absolute; border-radius: 50%; background: radial-gradient(closest-side, rgba(225,235,255,.85), rgba(150,170,255,.25) 55%, transparent); animation: wsz-hell .55s ease-out forwards; }
  .wsz-blitz { position: absolute; opacity: 0; filter: brightness(1.25) drop-shadow(0 0 10px #cfe0ff) drop-shadow(0 0 28px #8fb4ff); }
  .wsz-blitz.wsz-an { animation: wsz-zucken .85s ease-out; }
  @keyframes wsz-zucken { 0% { opacity: 0 } 5% { opacity: 1 } 12% { opacity: .15 } 20% { opacity: .95 } 55% { opacity: .5 } 100% { opacity: 0 } }
  .wsz-hell { position: absolute; inset: 0; background: radial-gradient(55% 60% at var(--x, 50%) var(--y, 20%), rgba(200,218,255,.7), rgba(130,150,255,.18) 55%, transparent 80%); opacity: 0; }
  .wsz-hell.wsz-an { animation: wsz-hell .85s ease-out; }
  .wsz-quelle { position: absolute; inset: 0; background: radial-gradient(22% 26% at var(--x, 50%) var(--y, 20%), rgba(250,252,255,1), rgba(210,225,255,.85) 30%, rgba(150,170,255,.3) 62%, transparent 100%); opacity: 0; }
  .wsz-quelle.wsz-an { animation: wsz-quellhell 1.1s ease-out; }
  @keyframes wsz-quellhell { 0% { opacity: 0 } 4% { opacity: 1 } 11% { opacity: .35 } 18% { opacity: 1 } 40% { opacity: .55 } 100% { opacity: 0 } }
  @keyframes wsz-hell { 0% { opacity: 0 } 5% { opacity: 1 } 12% { opacity: .1 } 20% { opacity: .7 } 100% { opacity: 0 } }
  .wsz-teil { position: absolute; top: 0; will-change: transform; }
  .wsz-tropfen { animation: wsz-fallen linear infinite; opacity: 0; }
  @keyframes wsz-fallen { 0% { transform: translate(0, var(--start)) rotate(6deg); opacity: 0; } 12% { opacity: var(--op, .5); } 100% { transform: translate(var(--drift), var(--ende)) rotate(6deg); opacity: var(--op, .5); } }
  .wsz-flocke { animation: wsz-schweben linear infinite; }
  .wsz-flocke.wsz-fern { animation-name: wsz-schweben, wsz-verschwinden; }
  @keyframes wsz-verschwinden { 0% { opacity: 0; } 8% { opacity: var(--deck); } 75% { opacity: var(--deck); } 100% { opacity: 0; } }
  @keyframes wsz-schweben {
    0% { transform: translate(0, var(--start)) rotate(0deg) rotateY(0deg); }
    25% { transform: translate(calc(var(--wind) * .25 + var(--pendel)), calc(var(--start) + (var(--ende) - var(--start)) * .25)) rotate(calc(var(--dreh) * .25)) rotateY(50deg); }
    50% { transform: translate(calc(var(--wind) * .5), calc(var(--start) + (var(--ende) - var(--start)) * .5)) rotate(calc(var(--dreh) * .5)) rotateY(0deg); }
    75% { transform: translate(calc(var(--wind) * .75 - var(--pendel)), calc(var(--start) + (var(--ende) - var(--start)) * .75)) rotate(calc(var(--dreh) * .75)) rotateY(-50deg); }
    100% { transform: translate(var(--wind), var(--ende)) rotate(var(--dreh)) rotateY(0deg); } }
  .wsz-spritzer { opacity: 0; transform-origin: 50% 100%; animation: wsz-spritzen .6s ease-out; }
  @keyframes wsz-spritzen { 0% { opacity: 0; transform: scale(calc(var(--sx, 1) * .3), calc(var(--sy, 1) * .2)); } 25% { opacity: var(--sp, .8); } 100% { opacity: 0; transform: scale(var(--sx, 1), var(--sy, 1)); } }
  .wsz-sterne { position: absolute; inset: 0; background-image: radial-gradient(1.5px 1.5px at 30px 40px, #fff, transparent), radial-gradient(1px 1px at 150px 90px, #fff, transparent), radial-gradient(1.5px 1.5px at 260px 30px, #dfe8ff, transparent);
    background-size: 380px 260px; -webkit-mask-image: linear-gradient(#000 0 50%, transparent 60%); mask-image: linear-gradient(#000 0 50%, transparent 60%); animation: wsz-funkeln 3s ease-in-out infinite alternate; }
  @keyframes wsz-funkeln { from { opacity: .2 } to { opacity: .6 } }
  .wsz-schleier { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,.15) 55%, rgba(0,0,0,0) 100%), linear-gradient(0deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 45%); }
  .wsz-sonnig .wsz-schleier, .wsz-schnee .wsz-schleier, .wsz-nebel .wsz-schleier { background: linear-gradient(90deg, rgba(0,10,25,.55) 0%, rgba(0,10,25,.2) 55%, rgba(0,0,0,0) 100%), linear-gradient(0deg, rgba(0,10,25,.55) 0%, rgba(0,0,0,0) 50%); }
  .wsz-nachtbild .wsz-schleier { background: linear-gradient(90deg, rgba(0,0,0,.4) 0%, rgba(0,0,0,.1) 55%, rgba(0,0,0,0) 100%), linear-gradient(0deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 45%); }
  .wsz-klein .wsz-schleier { background: linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,.2)); }
  .wsz-symbol { display: inline-block; vertical-align: middle; filter: drop-shadow(0 3px 8px rgba(0,0,0,.45)); }
  `;

  function cssEinbauen() {
    if (document.getElementById('wsz-css')) return;
    const s = document.createElement('style'); s.id = 'wsz-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  const zufall = (a, b) => a + Math.random() * (b - a);

  function wetterSzene(container, lage, klein, opt) {
    cssEinbauen();
    const L0 = LAGEN[lage] || LAGEN.sonnig;
    // Test (?wetter=<lage>): Szene so zeigen, wie sie tagsueber aussieht
    // Test (?wetter=<lage> oder <lage>-nacht): Tag- bzw. Nachtversion zeigen
    const test = new URLSearchParams(location.search).get('wetter');
    const nachts = test ? /-nacht$/.test(test) : !!(opt && opt.nachts);
    const nachtbild = nachts && NACHT[lage];
    const L = nachtbild ? Object.assign({}, L0, NACHT[lage]) : L0;
    const timer = [];
    let aus = false;
    const spaeter = (f, ms) => { timer.push(setTimeout(() => { if (!aus) f(); }, ms)); };
    const el = document.createElement('div');
    el.className = 'wsz wsz-' + lage + (klein ? ' wsz-klein' : '') + (nachtbild ? ' wsz-nachtbild' : nachts && lage !== 'nacht' ? ' wsz-nachts' : '');
    container.appendChild(el);
    const W = container.clientWidth || (klein ? 520 : 1280), H = container.clientHeight || (klein ? 110 : 815);

    let h = '<div class="wsz-himmel"></div>';
    if (L.bild) h += `<div class="wsz-bild" style="background-image:url('${BASIS}bg-${L.bild}.webp')"></div>`;
    if (L.sterne && !klein) h += '<div class="wsz-sterne"></div>';
    if (L.decke) h += `<div class="wsz-decke wsz-${L.decke}"></div>`;
    // Wolkenbaender: hinten (langsam, dunstig) - Mitte - vorne (schnell); endlos, Tempo je Aufbau leicht anders
    if (L.baender) ['hinten', 'mitte', 'vorne'].forEach((tiefe, t) => {
      if (L.ebenen && !L.ebenen.includes(t)) return;
      const name = L.baender + '-wolken-' + tiefe;
      const [oben, hoehe] = klein ? [[-0.55, 1.5], [-0.5, 1.6], [-0.4, 1.6]][t] : L.lage[t];
      const hp = hoehe * H, kachel = Math.round(hp * BAND_FORM[name]);
      const dauer = (klein ? [140, 90, 55] : [260, 160, 95])[t] * zufall(0.65, 1.45) * (lage === 'nebel' ? 1.6 : 1) * (L.tempo || 1);
      h += `<div class="wsz-band wsz-t${t}" style="top:${Math.round(oben * H)}px;height:${Math.round(hp)}px;background-image:url('${BASIS}${name}.webp');background-size:${kachel}px 100%;--kachel:${kachel}px;z-index:${2 + t * 2};animation-duration:${dauer.toFixed(0)}s;animation-delay:${-zufall(0, dauer).toFixed(1)}s"></div>`;
    });
    // Gewitter, Regen/Bewoelkt nachts: zusaetzliche Wolkenreihe ganz oben (gespiegelt, Gegenrichtung)
    if (L.dach) {
      const name = L.baender + '-wolken-mitte', [oben, hoehe] = klein ? [-0.9, 1.4] : L.dach;
      const hp = hoehe * H, kachel = Math.round(hp * BAND_FORM[name] * 1.15), dauer = (klein ? 110 : 200) * zufall(0.7, 1.3) * (L.tempo || 1);
      h += `<div class="wsz-band wsz-t1 wsz-dach" style="top:${Math.round(oben * H)}px;height:${Math.round(hp)}px;background-image:url('${BASIS}${name}.webp');background-size:${kachel}px 100%;--kachel:${kachel}px;z-index:3;animation-duration:${dauer.toFixed(0)}s;animation-delay:${-zufall(0, dauer).toFixed(1)}s;animation-direction:reverse"></div>`;
    }
    if (lage === 'gewitter') h += '<img class="wsz-blitz" alt=""><div class="wsz-hell"></div><div class="wsz-quelle"></div>';
    if (L.woelkchen) {
      const n = klein ? 1 : L.woelkchen;
      for (let i = 0; i < n; i++) {
        const breite = (klein ? 0.16 : zufall(0.09, 0.16)) * W, top = (klein ? zufall(-0.1, 0.25) : zufall(0.03, L.baender ? 0.18 : 0.3)) * H;
        const dauer = (Math.random() < 0.5 ? zufall(70, 140) : zufall(160, 380)) * (klein ? 0.6 : 1);
        h += `<img class="wsz-wolke wsz-woelkchen wsz-${L.toenung || 'weiss'}" src="${BASIS}woelkchen${1 + Math.floor(Math.random() * 8)}.webp" alt="" style="width:${Math.round(breite)}px;top:${Math.round(top)}px;z-index:3;--von:${W}px;--bis:${-Math.round(breite)}px;animation-duration:${dauer.toFixed(0)}s;animation-delay:${-zufall(0, dauer).toFixed(0)}s">`;
      }
    }
    // Regentropfen: aus den Wolken, Starthoehe gestreut, ganz wenige von ganz oben
    if (L.regen) {
      const n = Math.round((klein ? 22 : 90) * L.regen);
      for (let i = 0; i < n; i++) {
        const nah = Math.random() < 0.15, gr = (klein ? 0.16 : 0.3) * (nah ? zufall(1.1, 1.4) : zufall(0.35, 0.85));
        const nr = [2, 4, 5, 6, 7, 10, 12, 14, 16][Math.floor(Math.random() * 9)], dauer = (nah ? zufall(0.8, 1.05) : zufall(1.1, 1.7)) * (klein ? 0.55 : 1);
        const start = (Math.random() < 0.04 ? zufall(-0.1, 0) : zufall(L.regenAb[0] - 0.06, L.regenAb[1] + 0.12)) * (klein ? 0.5 : 1);
        h += `<img class="wsz-teil wsz-tropfen" src="${BASIS}teilchen/tropfen${nr}.png" alt="" style="z-index:8;left:${zufall(-5, 100).toFixed(1)}%;height:${Math.round(gr * 160)}px;--op:${nah ? 0.7 : zufall(0.35, 0.6).toFixed(2)};${nah ? 'filter:blur(.8px);' : ''}--start:${Math.round(start * H)}px;--ende:${H + 30}px;--drift:${Math.round(-H * 0.1)}px;animation-duration:${dauer.toFixed(2)}s;animation-delay:${-zufall(0, dauer).toFixed(2)}s">`;
      }
    }
    // Schnee: drei Tiefen; hinten viele kleine, die in unterschiedlicher Hoehe verschwinden
    if (L.schnee) {
      const EBENEN = klein ? [[80, 3, 6, 0.8, 7, 10], [18, 6, 10, 0.85, 4.5, 7]]
        : [[360, 4, 8, 0.8, 13, 19], [85, 10, 20, 0.88, 8, 12], [16, 30, 55, 0.85, 4.5, 7]];  // W1: volle Vorschau-Dichte nur 43 fps
      EBENEN.forEach(([n, gmin, gmax, deck, dmin, dmax], e) => {
        for (let i = 0; i < n; i++) {
          const groesse = zufall(gmin, gmax), nr = 1 + Math.floor(Math.random() * 20), dauer = zufall(dmin, dmax);
          const fern = e === 0, deckk = (deck * zufall(0.75, 1)).toFixed(2), ende = fern ? zufall(0.35, 0.95) * H : H + 30;
          h += `<img class="wsz-teil wsz-flocke${fern ? ' wsz-fern' : ''}" src="${BASIS}teilchen/flocke${nr}.png" alt="" style="z-index:${7 + e};--deck:${deckk};left:${zufall(-8, 100).toFixed(1)}%;width:${Math.round(groesse)}px;${fern ? '' : `opacity:${deckk};`}--start:-${Math.round(groesse + 20)}px;--ende:${Math.round(ende)}px;--pendel:${Math.round(zufall(10, 40) + e * 12)}px;--wind:${Math.round(H * zufall(0.08, 0.18) * (1 + e * 0.5))}px;--dreh:${Math.round(zufall(180, 540))}deg;animation-duration:${(fern ? dauer * (ende / H) : dauer).toFixed(1)}s;animation-delay:${-zufall(0, dauer).toFixed(1)}s">`;
        }
      });
    }
    h += '<div class="wsz-schleier" style="z-index:9"></div>';
    el.innerHTML = h;

    // Aufklatscher: unten viele, weiter oben auf zufaelligen Reihen kleiner; jeder anders
    if (L.regen && !klein) {
      const reihen = Array.from({ length: 5 + Math.floor(Math.random() * 3) }, () => zufall(0.42, 0.8));
      const spritz = () => {
        const y = Math.random() < 0.6 ? zufall(0.78, 1.0) : reihen[Math.floor(Math.random() * reihen.length)] + zufall(-0.025, 0.025);
        const tiefe = Math.max(0, (y - 0.42) / 0.58);
        const s = document.createElement('img'); s.className = 'wsz-teil wsz-spritzer'; s.alt = ''; s.style.zIndex = 8;
        s.src = BASIS + 'teilchen/spritzer' + (1 + Math.floor(Math.random() * 10)) + '.png';
        const breite = Math.round(zufall(10, 22) + tiefe * zufall(18, 46));
        s.style.left = zufall(0, 98) + '%'; s.style.width = breite + 'px';
        s.style.top = Math.round(y * H - breite * 0.6) + 'px';
        s.style.setProperty('--sp', (zufall(0.35, 0.55) + tiefe * 0.4).toFixed(2));
        s.style.setProperty('--sx', ((Math.random() < 0.5 ? -1 : 1) * zufall(0.8, 1.2)).toFixed(2));
        s.style.setProperty('--sy', zufall(0.7, 1.3).toFixed(2));
        const dauer = Math.round(zufall(380, 800)); s.style.animationDuration = dauer + 'ms';
        el.appendChild(s); setTimeout(() => s.remove(), dauer + 50);
        spaeter(spritz, zufall(15, 70));
      };
      spritz();
    }

    if (lage === 'gewitter') {
      const blitz = el.querySelector('.wsz-blitz'), hell = el.querySelector('.wsz-hell'), quelle = el.querySelector('.wsz-quelle');
      // grosser Blitz: kommt aus der mittleren Wolkenschicht, Wolken flackern mit
      const zucken = () => {
        const mitte = el.querySelector('.wsz-band.wsz-t1:not(.wsz-dach)');
        if (mitte) {
          const cx = zufall(0.1, 0.92) * W, unten = parseFloat(mitte.style.top) + parseFloat(mitte.style.height) * zufall(0.3, 0.48);
          const hoehe = Math.min(H * 0.75, Math.max(H * 0.3, H - unten + H * 0.05));
          blitz.src = BASIS + 'n' + (1 + Math.floor(Math.random() * 7)) + '.webp';
          blitz.style.height = Math.round(hoehe) + 'px'; blitz.style.top = Math.round(unten) + 'px'; blitz.style.zIndex = 5;
          blitz.onload = () => { blitz.style.left = Math.round(cx - blitz.clientWidth / 2) + 'px'; };
          blitz.style.left = Math.round(cx - hoehe * 0.25) + 'px';
          for (const g of [hell, quelle]) { g.style.setProperty('--x', Math.round(cx / W * 100) + '%'); g.style.setProperty('--y', Math.round(unten / H * 100) + '%'); }
          blitz.classList.remove('wsz-an'); hell.classList.remove('wsz-an'); quelle.classList.remove('wsz-an'); el.classList.remove('wsz-blitzlicht');
          void blitz.offsetWidth;
          el.classList.add('wsz-blitzlicht'); blitz.classList.add('wsz-an'); hell.classList.add('wsz-an'); quelle.classList.add('wsz-an');
        }
        spaeter(zucken, (klein ? 3500 : 1300) + Math.random() * (klein ? 5000 : 2600));
      };
      spaeter(zucken, klein ? 2500 : 900);
      // kleine Blitze: 1-4 auf einmal, in alle Richtungen, irgendwo in der Wolkendecke
      const kleine = () => {
        const buendel = 1 + Math.floor(Math.random() * (klein ? 2 : 4));
        const cx0 = zufall(0.06, 0.94) * W, cy0 = (klein ? zufall(0.1, 0.7) : zufall(0.04, 0.4)) * H;
        for (let k = 0; k < buendel; k++) {
          const b = document.createElement('img'); b.className = 'wsz-kblitz'; b.alt = '';
          b.src = BASIS + 'n' + (1 + Math.floor(Math.random() * 7)) + '.webp';
          const hh = klein ? zufall(28, 60) : zufall(80, 230);
          b.style.height = Math.round(hh) + 'px';
          b.style.left = Math.round(cx0 + zufall(-0.06, 0.06) * W) + 'px'; b.style.top = Math.round(cy0 + zufall(-0.04, 0.04) * H) + 'px';
          b.style.transform = `rotate(${Math.round(zufall(-120, 120))}deg)`;
          b.style.zIndex = [3, 5, 5, 7][Math.floor(Math.random() * 4)]; b.style.animationDelay = Math.round(k * zufall(40, 130)) + 'ms';
          el.appendChild(b); setTimeout(() => b.remove(), 900);
        }
        const g = document.createElement('div'); g.className = 'wsz-kglow';
        const gw = klein ? 140 : 380; g.style.width = gw + 'px'; g.style.height = Math.round(gw * 0.7) + 'px';
        g.style.left = Math.round(cx0 - gw / 2) + 'px'; g.style.top = Math.round(cy0 - gw * 0.3) + 'px';
        el.appendChild(g); setTimeout(() => g.remove(), 700);
        spaeter(kleine, klein ? zufall(1100, 3000) : zufall(200, 1000));
      };
      spaeter(kleine, 500);
      if (!klein) spaeter(kleine, 1100); // zwei unabhaengige Herde
    }

    return {
      lage,
      stop() { aus = true; timer.forEach(clearTimeout); el.remove(); }
    };
  }

  // Open-Meteo-Wettercode -> Szene. Klar/heiter: nachts Sternenhimmel, in der letzten
  // Stunde vor Sonnenuntergang Abendrot. Test: ?wetter=gewitter|regen|bewoelkt|sonnig|abendrot|nebel|schnee|nacht
  function wetterLage(code, istTag, sonnenuntergangIso) {
    const test = new URLSearchParams(location.search).get('wetter');
    if (test && LAGEN[test.replace(/-nacht$/, '')]) return test.replace(/-nacht$/, '');
    if (code >= 95) return 'gewitter';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'schnee';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'regen';
    if (code === 45 || code === 48) return 'nebel';
    if (code === 3) return 'bewoelkt';
    if (istTag === 0 || istTag === false) return 'nacht';
    if (sonnenuntergangIso) {
      const bis = new Date(sonnenuntergangIso) - new Date();
      if (bis > 0 && bis < 60 * 60 * 1000) return 'abendrot';
    }
    return 'sonnig';
  }

  // Meteocons-Symbol zum Wettercode
  function wetterSymbolName(code, istTag) {
    const tag = !(istTag === 0 || istTag === false);
    if (code >= 95) return 'thunderstorms-rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code === 66 || code === 67) return 'sleet';
    if (code >= 80 && code <= 82) return tag ? 'partly-cloudy-day-rain' : 'rain';
    if (code >= 61 && code <= 65) return 'rain';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code === 45 || code === 48) return 'fog';
    if (code === 3) return 'overcast';
    if (code === 1 || code === 2) return tag ? 'partly-cloudy-day' : 'partly-cloudy-night';
    return tag ? 'clear-day' : 'clear-night';
  }
  function wetterSymbol(code, istTag, px) {
    cssEinbauen();
    const n = px || 64;
    return `<img class="wsz-symbol" src="${BASIS}icons/${wetterSymbolName(code, istTag)}.svg" alt="" width="${n}" height="${n}">`;
  }

  window.wetterSzene = wetterSzene;
  window.wetterLage = wetterLage;
  window.wetterSymbol = wetterSymbol;
})();
