/* Wetter-Objekte (Vorschau, 16.11.2026): Vögel, Fledermäuse, Hubschrauber, Flugzeuge, Boote,
   Schwimmer … auf den Wetter-Hintergründen. Alles in echten Maßen: Bildgröße = Länge × Brennweite /
   Entfernung, Kamera 4 m über dem See. Sprites: ChatGPT-Bögen in Desktop\Wetter-Grafik.

   wetterObjekte(ziel, { quellen, bilder, bild, wetter, nacht, dichte, pos }) -> Promise<api>
     ziel   : Element mit dem Hintergrundbild (background-size: cover); die Leinwand liegt genau darauf
     quellen: Pfad zu den Sprite-Bögen, bilder: Pfad zu bg-*.webp, bild: 'bg-sonnig.webp'
     pos    : background-position als Anteil [x, y] (Widget: [.5, .35])
   api: erzeugen(id), leeren(), stop(), arten, erlaubt(art), dichte(n), wasserZeigen(b), info() */
(function () {
  'use strict';
  const W = 1672, H = 941, F = 1450, KAMERA = 4;

  const VOLL = hz => [[0, hz], [W, hz], [W, H], [0, H]];
  const SZENEN = {
    'bg-sonnig.webp':          { hz: 760, wasser: VOLL(760), dunst: 9000 },
    'bg-abendrot.webp':        { hz: 545, wasser: VOLL(545), dunst: 6000, licht: [1, .72, .62] },
    'bg-bewoelkt-tag.webp':    { hz: 612, wasser: VOLL(612), dunst: 5000, licht: [.86, .88, .92] },
    'bg-regen-tag.webp':       { hz: 497, wasser: VOLL(497), dunst: 1800, licht: [.72, .76, .82] },
    'bg-nebel.webp':           { hz: null, wasser: null, dunst: 260, licht: [.9, .92, .95] },
    'bg-schnee.webp':          { hz: 375, wasser: [[0, 375], [1165, 375], [1150, 560], [1010, 600], [960, 690], [520, 722], [0, 735]], dunst: 1400, licht: [.8, .84, .92] },
    'bg-nacht-klar.webp':      { hz: 610, wasser: VOLL(610), dunst: 8000 },
    'bg-bewoelkt-nacht.webp':  { hz: 612, wasser: VOLL(612), dunst: 5000 },
    'bg-regen-nacht.webp':     { hz: 612, wasser: VOLL(612), dunst: 2000 },
    'bg-nebel-nacht.webp':     { hz: null, wasser: null, dunst: 260 },
    'bg-schnee-nacht.webp':    { hz: 615, wasser: [[0, 615], [1545, 615], [1460, 700], [1340, 745], [1100, 810], [720, 860], [300, 890], [0, 900]], dunst: 2500 }
  };

  // n: Phasen je Zeile; anker: 'vorne' = Kopf/Nase steht still, 'rumpf' = Rumpf (Rotor ist unscharf),
  // 'schwimmer' = Kopf bzw. Matratze und Wasserlinie, 'zelle' = Rastermitte, sonst Umriss-Mitte
  const BOEGEN = {
    schwalbe: { datei: 'Neun Flugphasen einer Rauchschwalbe-3.png', n: 9, anker: 'vorne' },
    moewe:    { datei: 'Lachmöwe in neun Flugphasen-2.png', n: 9, anker: 'vorne' },
    segler:   { datei: 'Mauersegler in neun Flugphasen-5.png', n: 9, anker: 'vorne' },
    kraehe:   { datei: 'Rabenkrähe im Flug_ neun Flügelphasen-6.png', n: 9, anker: 'vorne' },
    ente:     { datei: 'Stockente im Flug_ neun Flügelschlagphasen-4.png', n: 9, anker: 'vorne' },
    reiher:   { datei: 'Graureiher im Flug – neun Bewegungsphasen-1.png', n: 9, anker: 'vorne' },
    fledermaus: { datei: 'Zwergfledermaus im Flug – acht Flügelphasen.png', n: 8, anker: 'vorne' },
    heli:     { datei: 'Rettungshubschrauber im Tag- und Nachtflug.png', n: 8, anker: 'rumpf', lampen: true },
    flieger:  { datei: 'Vier Flugzeuge im Seitenprofil.png', n: 4, anker: 'einzeln', lampen: true },
    schwimmer:{ datei: 'Wörthersee-Schwimmer in drei Sprite-Reihen.png', n: 6, anker: 'schwimmer', koepfe: ['orange', 'oben', 'matte'], zeilen: [[40, 190], [250, 455], [520, 690]] },
    bogen:    { datei: 'Fotorealistischer Wetter-Sprite-Bogen am Wörthersee.png', n: 4, anker: 'zelle', spaltenGleich: true,
                zeilen: [[10, 212], [218, 396], [398, 534], [544, 677], [690, 846], [848, 988], [988, 1119], [1119, 1290], [1292, 1418], [1418, 1534]] },
    dampfer:  { datei: 'Weißer Wörthersee-Ausflugsdampfer in Fahrt-1.png', n: 1 },
    dampferN: { datei: 'Historischer Ausflugsdampfer bei Nacht-14.png', n: 1, lampen: true },
    schiff:   { datei: 'Weißes Ausflugsschiff am Wörthersee-3.png', n: 1 },
    schiffN:  { datei: 'Weißes Ausflugsschiff bei Nacht-15.png', n: 1, lampen: true },
    segel:    { datei: 'Weißes Segelboot am Wörthersee-2.png', n: 1 },
    segelN:   { datei: 'Nachtsegler mit Positionslichtern-13.png', n: 1, lampen: true, mast: true },
    elektro:  { datei: 'Holz-Elektroboot mit zwei Personen-4.png', n: 1 },
    elektroN: { datei: 'Nächtliches Holz-Elektroboot am Wörthersee-12.png', n: 1, lampen: true },
    ski:      { datei: 'Motorboot mit Wasserskifahrer und Bugwelle-10.png', n: 1 },
    ski2:     { datei: 'Motorboot mit Wasserskifahrer am Wörthersee-5.png', n: 1 },
    skiN:     { datei: 'Nächtliches Motorboot mit Wasserskifahrer am Wörthersee-16.png', n: 1, lampen: true },
    tret:     { datei: 'Tretboot mit kleiner Bugwelle-11.png', n: 1 },
    tret2:    { datei: 'Freigestelltes Tretboot am Wörthersee-7.png', n: 1 },
    tretN:    { datei: 'Nacht-Tretboot mit bunten Positionslichtern-19.png', n: 1, lampen: true },
    // zweite Lieferung (16.11.): mehr Abwechslung am See
    tretP:    { datei: 'Blau-weißes Tretboot mit zwei Erwachsenen-2.png', n: 1 },
    tretF:    { datei: 'Familie im gelben Tretboot mit Rutsche-1.png', n: 1 },
    schwanTret: { datei: 'Weißes Schwanen-Tretboot mit zwei Kindern-15.png', n: 1 },
    solar:    { datei: 'Elektrisches Ausflugsboot mit Solardach-18.png', n: 1 },
    opti:     { datei: 'Drei Segelschüler in Optimist-Jollen-17.png', n: 1 },
    spi:      { datei: 'Weiße Segelyacht mit buntem Spinnaker-2.png', n: 1 },
    spiN:     { datei: 'Mondhelle Yacht mit buntem Spinnaker-7.png', n: 1, lampen: true },
    spiN2:    { datei: 'Nachtsegeln mit buntem Spinnaker-6.png', n: 1, lampen: true },
    jolle:    { datei: 'Klassische Mahagoni-Jolle mit zwei Seglern-3.png', n: 1 },
    jolleN:   { datei: 'Nächtliche Mahagoni-Jolle mit Laternenlicht-5.png', n: 1, lampen: true },
    party:    { datei: 'Party-Pontonboot mit Lichterkette und Freunden-13.png', n: 1 },
    partyN:   { datei: 'Leuchtender Party-Ponton bei Nacht-1.png', n: 1, lampen: true },
    kat:      { datei: 'Bunter Sportkatamaran mit Segler und Gischt-1.png', n: 1 },
    katN:     { datei: 'Nächtlicher Sportkatamaran mit Trapezsegler-4.png', n: 1, lampen: true },
    plaette:  { datei: 'Kärntner Plätte mit Stakenmann-11.png', n: 1, mast: true },
    banane:   { datei: 'Motorboot mit Bananenboot und Kindern-10.png', n: 1 },
    wake:     { datei: 'Wakeboard-Boot mit springendem Wakeboarder-9.png', n: 1 },
    rettung:  { datei: 'Oranges Wasserrettungsboot mit Blaulicht-8.png', n: 1, blaulicht: true, mast: true },
    katamaran:{ datei: 'Weißer Ausflugskatamaran mit Sonnendeck-7.png', n: 1 },
    katamaranN: { datei: 'Moderner weißer Ausflugs-Katamaran bei Nacht-1.png', n: 1, lampen: true },
    polizei:  { datei: 'Polizeiboot in Seitenansicht mit Blaulicht-6.png', n: 1, blaulicht: true },
    fischer:  { datei: 'Kleines grünes Fischerboot mit Angler-5.png', n: 1 },
    mahagoni: { datei: 'Klassisches Mahagoni-Motorboot mit Paar an Bord-4.png', n: 1 },
    mahagoniN:{ datei: 'Klassisches Mahagoni-Motorboot bei Nacht-3.png', n: 1, lampen: true },
    linie:    { datei: 'Weiß-blaues Linienschiff mit Heckflagge-3.png', n: 1, flagge: true },
    linieN:   { datei: 'Beleuchtetes Linienboot bei Nacht-2.png', n: 1, lampen: true, flagge: true },
    sport:    { datei: 'Modernes Sportboot mit drei Passagieren-2.png', n: 1 },
    sportN:   { datei: 'Weißes Sportboot bei Nacht mit Bugwelle-4.png', n: 1, lampen: true },
    jetski:   { datei: 'Jetski-Fahrer mit hoher Gischt-1.png', n: 1 }
  };

  // m: Bildbreite in Metern, d: Entfernung [m], hoch: Flughöhe [m], v: m/s, schlag: Flügelschläge/s,
  // gleit: Anteil Gleitflug, wl: Wasserlinie (Anteil der Bildhöhe), tauch: Unterwasser-Tönung,
  // spiegel: Spiegelung im See, kiel: [Kielwellen-Dauer s, Kammbreite m, Deckkraft], ringe: Wellenringe
  const ARTEN = [
    { id: 'schwalbe', name: 'Schwalben', bogen: 'schwalbe', ort: 'luft', m: .32, d: [6, 40], hoch: [3, 45], v: [9, 14], schlag: 7, gleit: .35, schwarm: [3, 7], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 3 },
    { id: 'segler', name: 'Mauersegler', bogen: 'segler', ort: 'luft', m: .38, d: [10, 80], hoch: [20, 160], v: [12, 20], schlag: 8, gleit: .5, schwarm: [3, 9], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'abendrot'], gewicht: 2 },
    { id: 'moewe', name: 'Möwen', bogen: 'moewe', ort: 'luft', m: .75, d: [10, 80], hoch: [4, 70], v: [7, 11], schlag: 2.8, gleit: .55, schwarm: [1, 4], tag: 1, gewicht: 3 },
    { id: 'kraehe', name: 'Krähen', bogen: 'kraehe', ort: 'luft', m: .62, d: [10, 70], hoch: [8, 80], v: [8, 12], schlag: 3.6, gleit: .2, schwarm: [1, 3], tag: 1, gewicht: 2 },
    { id: 'ente', name: 'Stockenten', bogen: 'ente', ort: 'luft', m: .62, d: [15, 100], hoch: [5, 60], v: [14, 20], schlag: 6, gleit: 0, schwarm: [2, 5], tag: 1, nichtBei: ['schnee'], gewicht: 2, formation: true },
    { id: 'reiher', name: 'Graureiher', bogen: 'reiher', ort: 'luft', m: 1.5, d: [20, 120], hoch: [8, 90], v: [8, 11], schlag: 2.2, gleit: .1, schwarm: [1, 1], tag: 1, nichtBei: ['schnee'], gewicht: 1 },
    { id: 'storch', name: 'Storch', bogen: 'bogen', zeile: 4, ort: 'luft', m: 1.6, d: [30, 200], hoch: [40, 300], v: [10, 13], schlag: 2, gleit: .6, schwarm: [1, 2], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .8 },
    { id: 'fledermaus', name: 'Fledermäuse', bogen: 'fledermaus', ort: 'luft', m: .16, d: [4, 18], hoch: [2, 14], v: [5, 8], schlag: 11, gleit: 0, schwarm: [1, 3], nacht: 1, zickzack: true, nichtBei: ['regen', 'schnee'], gewicht: 4 },
    { id: 'eule', name: 'Eule', bogen: 'bogen', zeile: 7, ort: 'luft', m: .75, d: [10, 40], hoch: [3, 20], v: [5, 7], schlag: 2.6, gleit: .4, schwarm: [1, 1], nacht: 1, gewicht: 1 },
    { id: 'heli', name: 'Hubschrauber', bogen: 'heli', phasen: [0, 4], phasenN: [4, 8], ort: 'luft', m: 13.5, d: [150, 900], hoch: [80, 600], v: [45, 65], rotor: 24, schwarm: [1, 1], tag: 1, nacht: 1, gewicht: 1, lichter: 'heli' },
    { id: 'jet', name: 'Passagierjet (Anflug)', bogen: 'flieger', phasen: [0, 1], phasenN: [1, 2], ort: 'luft', m: 40, mN: 38, d: [1200, 3500], hoch: [500, 2500], v: [70, 85], schwarm: [1, 1], tag: 1, nacht: 1, gewicht: 1, lichter: 'jet' },
    { id: 'reisejet', name: 'Jet mit Kondensstreifen', bogen: 'flieger', phasen: [0, 1], phasenN: [1, 2], ort: 'luft', m: 40, mN: 38, d: [4500, 8000], himmel: [.06, .55], v: [220, 250], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'nebel', 'schnee'], gewicht: 1.2, lichter: 'jet', kondens: true },
    { id: 'banner', name: 'Flieger mit Werbebanner', bogen: 'flieger', phasen: [2, 3], ort: 'luft', m: 9.5, d: [150, 300], himmel: [.3, .62], v: [33, 40], schwarm: [1, 1], tag: 1, nacht: 1, lichter: 'klein', nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 0, banner: ['CITY CAFÉ', 'CAFÉ PLAUSCHERL'] },
    { id: 'cessna', name: 'Kleinflugzeug', bogen: 'flieger', phasen: [2, 3], ort: 'luft', m: 9.5, d: [200, 1000], hoch: [250, 1200], v: [45, 55], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 1 },
    { id: 'segelflieger', name: 'Segelflieger', bogen: 'flieger', phasen: [3, 4], ort: 'luft', m: 7.5, d: [200, 1000], hoch: [300, 1500], v: [25, 35], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt'], gewicht: 1 },
    { id: 'ballon', name: 'Heißluftballon', bogen: 'bogen', zeile: 0, ort: 'luft', m: 17, d: [250, 1200], hoch: [80, 900], v: [1.5, 4], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .6, schweben: true },
    { id: 'paragleiter', name: 'Paragleiter', bogen: 'bogen', zeile: 1, ort: 'luft', m: 11, d: [100, 500], hoch: [100, 900], v: [8, 11], schwarm: [1, 2], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .8, schweben: true },
    { id: 'libelle', name: 'Libelle', bogen: 'bogen', zeile: 5, ort: 'nah', m: .1, d: [1.5, 4], v: [.25, .45], bild: 22, schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: .6, zickzack: true },
    { id: 'schmetterling', name: 'Schmetterling', bogen: 'bogen', zeile: 6, ort: 'nah', m: .1, d: [1.5, 4], v: [.35, .6], bild: 9, schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .6, zickzack: true },
    { id: 'blatt', name: 'Herbstlaub', bogen: 'bogen', zeile: 8, ort: 'nah', m: .13, d: [2, 9], v: [.6, 1.4], bild: 3, schwarm: [2, 6], tag: 1, nacht: 1, nichtBei: ['schnee'], gewicht: .8, fallen: true },
    { id: 'pusteblume', name: 'Pusteblume', bogen: 'bogen', zeile: 9, ort: 'nah', m: .05, d: [1.5, 6], v: [.12, .25], bild: 1.5, schwarm: [2, 5], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .6, schweben: true },
    { id: 'schwan', breite: 1.2, name: 'Schwäne', bogen: 'bogen', zeile: 2, ort: 'wasser', m: 1.5, wl: .9, d: [25, 200], v: [.4, .7], bild: 1.6, schwarm: [1, 3], tag: 1, gewicht: 1.5, tauch: .35, spiegel: true, kiel: [3, .04, .45], ringe: 2.2 },
    { id: 'taucher', breite: 0.6, name: 'Haubentaucher', bogen: 'bogen', zeile: 3, ort: 'wasser', m: .55, wl: .88, d: [25, 120], v: [.4, .7], bild: 2, schwarm: [1, 2], tag: 1, gewicht: 1, tauch: .35, spiegel: true, kiel: [2.5, .03, .4], ringe: 1.8 },
    { id: 'dampfer', breite: 8, name: 'Dampfer', bogen: 'dampfer', bogenN: 'dampferN', ort: 'wasser', m: 46, wl: .9, d: [180, 900], v: [3.5, 4.5], schwarm: [1, 1], tag: 1, nacht: 1, gewicht: .7, gross: true, spiegel: true, kiel: [14, .35, .5] },
    { id: 'schiff', breite: 7, name: 'Ausflugsschiff', bogen: 'schiff', bogenN: 'schiffN', ort: 'wasser', m: 37, wl: .91, d: [180, 900], v: [4, 5.5], schwarm: [1, 1], tag: 1, nacht: 1, gewicht: .7, gross: true, spiegel: true, kiel: [14, .3, .5] },
    { id: 'segel', breite: 3.5, name: 'Segelboot', bogen: 'segel', bogenN: 'segelN', mN: 18, ort: 'wasser', m: 16, wl: .97, d: [90, 700], v: [2, 4], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['schnee', 'regen'], gewicht: 1, spiegel: true, kiel: [8, .15, .4] },
    { id: 'elektro', breite: 2.5, name: 'Elektroboot', bogen: 'elektro', bogenN: 'elektroN', ort: 'wasser', m: 9.3, wl: .88, d: [60, 500], v: [2.5, 4], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee'], gewicht: 1, spiegel: true, kiel: [8, .12, .5] },
    { id: 'ski', breite: 4, name: 'Wasserskifahrer', bogen: ['ski', 'ski2'], bogenN: 'skiN', ort: 'wasser', m: 14, wl: .86, d: [80, 500], v: [11, 14], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: .8, spiegel: true, kiel: [6, .3, .7] },
    // zweite Lieferung (16.11.): m = Bildbreite in Metern (inkl. Leine/Gischt), breite = Rumpfbreite für die Fahrspuren
    { id: 'tret', name: 'Tretboot', bogen: ['tretP', 'tretF'], ort: 'wasser', breite: 1.8, m: 4.2, wl: .96, d: [40, 250], v: [.8, 1.2], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 1.4, spiegel: true, kiel: [5, .06, .35] },
    { id: 'schwantret', name: 'Schwanen-Tretboot', bogen: 'schwanTret', ort: 'wasser', breite: 1.6, m: 3.5, wl: .96, d: [40, 220], v: [.7, 1], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt'], gewicht: .8, spiegel: true, kiel: [5, .06, .35] },
    { id: 'solar', name: 'Solarboot', bogen: 'solar', ort: 'wasser', breite: 3, m: 11.5, wl: .96, d: [80, 600], v: [2.5, 3.5], schwarm: [1, 1], tag: 1, nichtBei: ['schnee'], gewicht: 1, spiegel: true, kiel: [8, .12, .45] },
    { id: 'opti', name: 'Opti-Segelschule', bogen: 'opti', ort: 'wasser', breite: 1.5, m: 13, wl: .97, d: [60, 350], v: [1.5, 2.3], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .9, spiegel: true, kiel: [5, .05, .35] },
    { id: 'spi', name: 'Yacht mit Spinnaker', bogen: 'spi', bogenN: ['spiN', 'spiN2'], ort: 'wasser', breite: 3.3, m: 12.5, wl: .97, d: [100, 800], v: [3, 4.5], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 1.1, spiegel: true, kiel: [8, .12, .45] },
    { id: 'jolle', name: 'Holz-Segeljolle', bogen: 'jolle', bogenN: 'jolleN', ort: 'wasser', breite: 2, m: 6.8, wl: .97, d: [70, 500], v: [2, 3], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .9, spiegel: true, kiel: [6, .08, .4] },
    { id: 'party', name: 'Party-Ponton', bogen: 'party', bogenN: 'partyN', ort: 'wasser', breite: 2.6, m: 9.5, wl: .94, d: [80, 500], v: [1.5, 2.5], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .9, spiegel: true, kiel: [7, .1, .4] },
    { id: 'kat', name: 'Sportkatamaran', bogen: 'kat', bogenN: 'katN', ort: 'wasser', breite: 2.4, m: 6.3, wl: .97, d: [80, 500], v: [5, 7], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: .8, spiegel: true, kiel: [6, .1, .55] },
    { id: 'plaette', name: 'Kärntner Plätte', bogen: 'plaette', ort: 'wasser', breite: 1.8, m: 8.5, wl: .97, d: [50, 350], v: [.7, 1.1], schwarm: [1, 1], tag: 1, nichtBei: ['schnee', 'nebel'], gewicht: .7, spiegel: true, kiel: [5, .06, .35] },
    { id: 'banane', name: 'Bananenboot', bogen: 'banane', ort: 'wasser', breite: 3, m: 22, wl: .96, d: [100, 600], v: [8, 10], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: .7, spiegel: true, kiel: [6, .25, .6] },
    { id: 'wake', name: 'Wakeboarder', bogen: 'wake', ort: 'wasser', breite: 2.8, m: 24, wl: .96, d: [100, 600], v: [8, 9.5], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt'], gewicht: .7, spiegel: true, kiel: [6, .3, .65] },
    { id: 'rettung', name: 'Wasserrettung', bogen: 'rettung', ort: 'wasser', breite: 2.6, m: 7.5, wl: .97, d: [80, 600], v: [5, 7], schwarm: [1, 1], tag: 1, nacht: 1, gewicht: .5, spiegel: true, kiel: [7, .2, .55], einsatz: .5 },
    { id: 'katamaran', name: 'Ausflugskatamaran', bogen: 'katamaran', bogenN: 'katamaranN', ort: 'wasser', breite: 10, m: 37, wl: .97, d: [180, 900], v: [4.5, 5.5], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['schnee'], gewicht: .6, gross: true, spiegel: true, kiel: [14, .3, .5] },
    { id: 'polizei', name: 'Polizeiboot', bogen: 'polizei', ort: 'wasser', breite: 3, m: 9.8, wl: .96, d: [100, 700], v: [4, 7], schwarm: [1, 1], tag: 1, nacht: 1, gewicht: .5, spiegel: true, kiel: [8, .2, .5], einsatz: .4 },
    { id: 'fischer', name: 'Fischerboot', bogen: 'fischer', ort: 'wasser', breite: 1.6, m: 5, wl: .95, d: [40, 300], v: [.1, .25], schwarm: [1, 1], tag: 1, nichtBei: ['nebel'], gewicht: .8, spiegel: true, kiel: [3, .04, .25] },
    { id: 'mahagoni', name: 'Mahagoni-Motorboot', bogen: 'mahagoni', bogenN: 'mahagoniN', ort: 'wasser', breite: 2.2, m: 7.5, wl: .97, d: [80, 600], v: [7, 10], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 1, spiegel: true, kiel: [7, .2, .6] },
    { id: 'linie', name: 'Linienschiff', bogen: 'linie', bogenN: 'linieN', ort: 'wasser', breite: 6, m: 21, wl: .97, d: [150, 900], v: [4, 5], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['schnee'], gewicht: .8, spiegel: true, kiel: [12, .25, .5] },
    { id: 'sport', name: 'Sportboot', bogen: 'sport', bogenN: 'sportN', ort: 'wasser', breite: 2.6, m: 8.5, wl: .97, d: [100, 700], v: [9, 13], schwarm: [1, 1], tag: 1, nacht: 1, nichtBei: ['regen', 'schnee', 'nebel'], gewicht: 1, spiegel: true, kiel: [7, .25, .65] },
    { id: 'jetski', name: 'Jetski', bogen: 'jetski', ort: 'wasser', breite: 1.2, m: 4.8, wl: .96, d: [60, 400], v: [12, 16], schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: .7, spiegel: true, kiel: [5, .15, .6] },
    { id: 'kraul', breite: 1.2, name: 'Schwimmer (Kraul)', bogen: 'schwimmer', zeile: 0, ort: 'wasser', m: 1.5, d: [20, 90], v: [.9, 1.3], bild: 4.4, schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: 1, tauch: .75, kiel: [3, .05, .55], ringe: 2.4, ringBei: [0, 3], wippen: .015 },
    { id: 'brust', breite: 1.2, name: 'Schwimmerin (Brust)', bogen: 'schwimmer', zeile: 1, ort: 'wasser', m: 1.2, d: [20, 90], v: [.6, .9], bild: 3.6, schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: 1, tauch: .75, kiel: [3, .05, .5], ringe: 2.4, ringBei: [2], wippen: .02 },
    { id: 'matratze', breite: 1.2, name: 'Kind auf Luftmatratze', bogen: 'schwimmer', zeile: 2, ort: 'wasser', m: 1.9, d: [20, 80], v: [.3, .5], bild: 3.2, schwarm: [1, 1], tag: 1, nichtBei: ['regen', 'schnee', 'nebel', 'bewoelkt', 'abendrot'], gewicht: .7, tauch: .3, spiegel: true, kiel: [3, .04, .35], ringe: 2.4, ringBei: [2, 3], wippen: .008, hinten: true }
  ];

  for (const a of ARTEN) if (a.ort === 'wasser') a.gewicht *= 2;
  const zufall = (a, b) => a + Math.random() * (b - a);
  const logZufall = (a, b) => Math.exp(zufall(Math.log(a), Math.log(b)));
  const wahl = a => a[Math.floor(Math.random() * a.length)];
  const mischen = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const leinwand = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

  // ---------------------------------------------------------------------------
  // Bögen zerlegen (einmal je Quelle): Phasen genau am Objekt ausschneiden und
  // an einem festen Punkt ausrichten, damit nichts zappelt.
  // ---------------------------------------------------------------------------
  const geladen = {};
  function boegenLaden(quellen) {
    if (!geladen[quellen] && /\.json(\?|$)/.test(quellen)) geladen[quellen] = (async () => {
      // fertig ausgeschnittene, verkleinerte Phasen (wetter/objekte/objekte.json + WebP mit Alpha)
      const basis = quellen.replace(/[^/]*$/, ''), m = await (await fetch(quellen)).json(), P = {};
      const bild = async f => { if (!f) return null; const i = new Image(); i.src = /^(blob:|data:|https?:)/.test(f) ? f : basis + f; await i.decode(); const c = leinwand(i.naturalWidth, i.naturalHeight); c.getContext('2d').drawImage(i, 0, 0); return c; };
      await Promise.all(Object.entries(m).map(async ([key, zeilen]) => {
        P[key] = await Promise.all(zeilen.map(z => Promise.all(z.map(async p => ({ c: await bild(p.f), lampen: await bild(p.l), blau: await bild(p.b), ax: p.ax, ay: p.ay, ow: p.ow, schwimmer: !!p.s, zelle: !!p.z })))));
      }));
      return P;
    })();
    if (!geladen[quellen]) geladen[quellen] = (async () => {
      const P = {};
      await Promise.all(Object.keys(BOEGEN).map(k => bogenLaden(quellen, k, P)));
      return P;
    })();
    return geladen[quellen];
  }
  async function bogenLaden(quellen, key, P) {
    const def = BOEGEN[key];
    const img = new Image(); img.src = quellen + encodeURIComponent(def.datei); await img.decode();
    let w = img.naturalWidth, h = img.naturalHeight, oben = 0;
    if (def.mast) { oben = Math.round(h * .05); h += oben; }               // Platz für die abgeschnittene Mastspitze
    const c = leinwand(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, oben);
    if (oben) {
      // schmale Teile, die oben an den Rand stoßen (Mast, Antenne), nach oben fortsetzen und spitz auslaufen lassen
      const z = g.getImageData(0, oben, w, 1).data, m = g.createImageData(w, oben), q = m.data;
      let x = 0;
      while (x < w) { if (z[x * 4 + 3] < 60) { x++; continue; } let e = x; while (e < w && z[e * 4 + 3] >= 60) e++;
        if (e - x <= 10) for (let r = 0; r < oben * .85; r++) { const an = 1 - r / (oben * .85); for (let xx = x; xx < e; xx++) { const i = ((oben - 1 - r) * w + xx) * 4; q[i] = z[xx * 4]; q[i + 1] = z[xx * 4 + 1]; q[i + 2] = z[xx * 4 + 2]; q[i + 3] = z[xx * 4 + 3] * Math.min(1, an * 3); } }
        x = e; }
      g.putImageData(m, 0, 0);
    }
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 14) d[i] = 0;
    g.putImageData(id, 0, 0);
    const A = (x, y) => d[(y * w + x) * 4 + 3];
    const box = (x0, y0, x1, y1, s = 40) => { let a = 1e9, b = 1e9, e = -1, f = -1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (A(x, y) > s) { if (x < a) a = x; if (x > e) e = x; if (y < b) b = y; if (y > f) f = y; }
      return e < 0 ? null : [a, b, e + 1, f + 1]; };
    P[key] = (def.zeilen || [[0, h]]).map(([y0, y1], zi) => {
      const sp = new Float32Array(w);
      for (let x = 0; x < w; x++) for (let y = y0; y < y1; y++) sp[x] += A(x, y) > 40 ? 1 : 0;
      let zellen;
      if (def.spaltenGleich) zellen = Array.from({ length: def.n }, (_, i) => [Math.round(i * w / def.n), Math.round((i + 1) * w / def.n)]);
      else {
        let teile = [], s = -1;
        for (let x = 0; x <= w; x++) { const v = x < w && sp[x] > 0; if (v && s < 0) s = x; if (!v && s >= 0) { teile.push([s, x]); s = -1; } }
        while (teile.length > def.n) { let k = 0, best = 1e9; for (let i = 0; i < teile.length - 1; i++) { const l = teile[i + 1][0] - teile[i][1]; if (l < best) { best = l; k = i; } } teile.splice(k, 2, [teile[k][0], teile[k + 1][1]]); }
        if (teile.length < def.n) {
          const x0 = teile[0][0], x1 = teile[teile.length - 1][1], p = (x1 - x0) / def.n, schnitte = [];
          for (let i = 1; i < def.n; i++) { let bx = 0, bv = 1e9; for (let x = Math.round(x0 + p * (i - .4)); x < x0 + p * (i + .4); x++) if (sp[x] < bv) { bv = sp[x]; bx = x; } schnitte.push(bx); }
          const g2 = [x0, ...schnitte, x1]; teile = g2.slice(0, -1).map((a, i) => [a, g2[i + 1]]);
        }
        zellen = teile;
      }
      const teile = zellen.map(([xa, xb]) => ({ xa, xb, r: box(xa, y0, xb, y1) })).filter(t => t.r);
      // Schwimmer: gemeinsame Wasserlinie der Zeile (alle Phasen gleich hoch)
      let yWL = 0, oben = 0;
      if (def.anker === 'schwimmer') {
        oben = Math.min(...teile.map(t => t.r[1]));
        const b = teile.map(t => t.r[3]).sort((p, q) => p - q), med = b[b.length >> 1];
        yWL = Math.round(med - .12 * (med - oben));
      }
      return teile.map(({ xa, xb, r }) => {
        let ax, ay;
        if (def.anker === 'vorne' || def.anker === 'rumpf') {
          const s = def.anker === 'rumpf' ? 235 : 200;
          let fx = r[0]; for (let x = r[2] - 1; x >= r[0]; x--) { let n = 0; for (let y = r[1]; y < r[3]; y++) if (A(x, y) > s) n++; if (n >= 3) { fx = x; break; } }
          const bis = fx - (r[2] - r[0]) * .06; let sy = 0, sn = 0;
          for (let x = Math.floor(bis); x <= fx; x++) for (let y = r[1]; y < r[3]; y++) if (A(x, y) > s) { sy += y; sn++; }
          ax = fx - r[0]; ay = (sn ? sy / sn : (r[1] + r[3]) / 2) - r[1];
        } else if (def.anker === 'schwimmer') {
          // Kopf (Badehaube orange / Hut oben) bzw. Mitte der Matratze bleibt stehen
          const k = def.koepfe[zi]; let sx = 0, sn = 0;
          if (k === 'orange') {
            for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200 && d[i] > 170 && d[i + 1] < 150 && d[i + 2] < 100) { sx += x; sn++; } }
          } else if (k === 'oben') {
            const yb = Math.min(r[3], Math.round(oben + .3 * (yWL - oben)));
            for (let y = r[1]; y < yb; y++) for (let x = r[0]; x < r[2]; x++) if (A(x, y) > 200) { sx += x; sn++; }
          } else {
            const ya = Math.round(yWL - .22 * (yWL - oben)), hoehe = yWL - ya; let lo = -1, hi = -1;
            for (let x = r[0]; x < r[2]; x++) { let n = 0; for (let y = ya; y < yWL; y++) if (A(x, y) > 200) n++; if (n >= hoehe * .5) { if (lo < 0) lo = x; hi = x; } }
            if (lo >= 0) { sx = (lo + hi) / 2; sn = 1; }
          }
          ax = (sn ? sx / sn : (r[0] + r[2]) / 2) - r[0]; ay = yWL - r[1];
        } else if (def.anker === 'zelle') { ax = (xa + xb) / 2 - r[0]; ay = (y0 + y1) / 2 - r[1]; }
        else { ax = (r[2] - r[0]) / 2; ay = (r[3] - r[1]) / 2; }
        const zc = leinwand(r[2] - r[0], r[3] - r[1]);
        zc.getContext('2d').drawImage(c, r[0], r[1], zc.width, zc.height, 0, 0, zc.width, zc.height);
        if (def.flagge) flaggeOesterreich(zc);
        // Lampen in voller Auflösung erkennen (beim Verkleinern würden sie mit der dunklen Umgebung verschmelzen)
        let lampen = null;
        if (def.lampen) {
          const zd = zc.getContext('2d').getImageData(0, 0, zc.width, zc.height), q = zd.data; let n = 0;
          for (let i = 0; i < q.length; i += 4) {
            const hell = .3 * q[i] + .59 * q[i + 1] + .11 * q[i + 2], mx = Math.max(q[i], q[i + 1], q[i + 2]), mn = Math.min(q[i], q[i + 1], q[i + 2]);
            const farbig = mx > 200 && mx - mn > 70;
            if (q[i + 3] > 120 && (hell > 215 || farbig)) { q[i + 3] = farbig ? 255 : Math.min(255, (hell - 215) * 8 + 90); n++; } else q[i + 3] = 0;
          }
          if (n) { lampen = leinwand(zc.width, zc.height); lampen.getContext('2d').putImageData(zd, 0, 0); }
        }
        let blau = null;
        if (def.blaulicht) {
          const bd = zc.getContext('2d').getImageData(0, 0, zc.width, zc.height), q = bd.data; let n = 0;
          for (let i = 0; i < q.length; i += 4) {
            const y = (i / 4 / zc.width) | 0;
            if (y < zc.height * .6 && q[i + 3] > 180 && q[i + 2] > 170 && q[i + 2] - q[i] > 90 && q[i + 2] - q[i + 1] > 30) { q[i] = 90; q[i + 1] = 150; q[i + 2] = 255; q[i + 3] = 255; n++; } else q[i + 3] = 0;
          }
          if (n) { blau = leinwand(zc.width, zc.height); blau.getContext('2d').putImageData(bd, 0, 0); }
        }
        return { c: zc, lampen, blau, ax, ay, schwimmer: def.anker === 'schwimmer', zelle: def.anker === 'zelle' };
      });
    });
  }

  // Deutsche Flagge (Schwarz-Rot-Gold) im hinteren Fünftel suchen und in Rot-Weiß-Rot umfärben
  function flaggeOesterreich(c) {
    const g = c.getContext('2d'), w = c.width, h = c.height, id = g.getImageData(0, 0, w, h), d = id.data;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h * .7; y++) for (let x = 0; x < w * .2; x++) { const i = (y * w + x) * 4;
      if (d[i + 3] > 150 && d[i] > 180 && d[i + 1] > 130 && d[i + 2] < 90 && d[i] - d[i + 2] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return;
    const sh = y1 - y0 + 1, top = Math.max(0, y0 - 2 * sh - 2), unten = y1, links = Math.max(0, x0 - 4), rechts = Math.min(w - 1, x1 + 4);
    for (let y = top; y <= unten; y++) for (let x = links; x <= rechts; x++) { const i = (y * w + x) * 4; if (d[i + 3] < 100) continue;
      const hell = (d[i] + d[i + 1] + d[i + 2]) / 3, fahne = d[i + 2] < 120 || hell < 70; if (!fahne) continue;   // nur Fahnenstoff, nicht Mast/Himmel
      const drittel = (y - top) / (unten - top + 1), schatten = .75 + .25 * Math.min(1, Math.max(d[i], d[i + 1], d[i + 2]) / 255);
      const f = drittel < 1 / 3 || drittel >= 2 / 3 ? [200, 16, 46] : [245, 245, 245];
      d[i] = f[0] * schatten; d[i + 1] = f[1] * schatten; d[i + 2] = f[2] * schatten; }
    g.putImageData(id, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Vorberechnen je Objekt: verkleinern, Licht, Luftdunst, Unterwasser-Tönung,
  // Spiegelbild. Danach nur noch drawImage.
  // ---------------------------------------------------------------------------
  function vorberechnen(phase, massstab, licht, dunst, nachtDunkel, dunstFarbe, wasser, leuchten) {
    let src = phase.c, w = src.width, h = src.height;
    const zw = Math.max(1, Math.round(w * massstab)), zh = Math.max(1, Math.round(h * massstab));
    while (w / 2 >= zw * 1.01) {
      const t = leinwand(Math.ceil(w / 2), Math.ceil(h / 2)), tg = t.getContext('2d');
      tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height);
      src = t; w = t.width; h = t.height;
    }
    const c = leinwand(zw + 2, zh + 2), g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (wasser && wasser.tauch) { g.filter = 'saturate(.8) contrast(.92) blur(' + (zw < 90 ? .35 : .5) + 'px)'; g.drawImage(src, 1, 1, zw, zh); g.filter = 'none'; }
    else g.drawImage(src, 1, 1, zw, zh);
    // Nachts: echte Lampen (sehr hell) merken, Rest abdunkeln, Lampen danach wieder voll drüber
    let lampen = null;
    if (leuchten && phase.lampen) {
      let ls = phase.lampen, lw = ls.width, lh = ls.height;
      while (lw / 2 >= zw * 1.01) { const t = leinwand(Math.ceil(lw / 2), Math.ceil(lh / 2)), tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(ls, 0, 0, t.width, t.height); ls = t; lw = t.width; lh = t.height; }
      lampen = leinwand(c.width, c.height); const lg = lampen.getContext('2d');
      lg.imageSmoothingQuality = 'high'; lg.globalCompositeOperation = 'lighter';
      const verst = phase.verst || Math.min(6, Math.max(2, Math.round((phase.ow || phase.c.width) / zw / 2) + 1));     // kleine Lampen wieder kräftig machen
      for (let i = 0; i < verst; i++) lg.drawImage(ls, 1, 1, zw, zh);
      // warmes Licht wie die Uferlichter im Foto (farbige Positionslichter bleiben farbig)
      lg.globalCompositeOperation = 'multiply'; lg.fillStyle = 'rgb(255,226,172)'; lg.fillRect(0, 0, c.width, c.height);
      lg.globalCompositeOperation = 'destination-in'; for (let i = 0; i < verst; i++) lg.drawImage(ls, 1, 1, zw, zh);
    }
    const kNacht = leuchten ? .6 : nachtDunkel;
    if (licht || kNacht !== 1) {
      const l = licht || [1, 1, 1], k = kNacht;
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${255 * l[0] * k},${255 * l[1] * k},${255 * l[2] * k})`; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 1, 1, zw, zh);
    }
    if (dunst > .005) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = rgba(dunstFarbe, Math.min(.92, dunst)); g.fillRect(0, 0, c.width, c.height);
    }
    if (lampen) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1 - Math.min(.7, dunst); g.drawImage(lampen, 0, 0); g.globalAlpha = 1; }
    if (wasser && !wasser.tauch) {
      // nichts Durchsichtiges am Boot: was über der Wasserlinie halb deckt, wird (bis auf die Kante) voll deckend
      const yw = Math.round((phase.c.height * wasser.wl) * (zh / phase.c.height)) + 1, id = g.getImageData(0, 0, c.width, Math.min(c.height, yw)), q = id.data;
      for (let i = 3; i < q.length; i += 4) if (q[i] > 40) q[i] = Math.min(255, q[i] * 1.8);
      g.globalCompositeOperation = 'source-over'; g.putImageData(id, 0, 0);
    }
    const sx = zw / phase.c.width, sy = zh / phase.c.height;
    const out = { c, ax: phase.ax * sx + 1, ay: phase.ay * sy + 1 };
    if (phase.blau) {
      const pad = Math.ceil(Math.max(4, zw * .05)), b = leinwand(c.width + 2 * pad, c.height + 2 * pad), bg = b.getContext('2d');
      bg.imageSmoothingQuality = 'high'; bg.globalCompositeOperation = 'lighter';
      bg.filter = 'blur(' + (pad * .5).toFixed(1) + 'px)'; for (let i = 0; i < 4; i++) bg.drawImage(phase.blau, pad + 1, pad + 1, zw, zh);
      bg.filter = 'none'; for (let i = 0; i < 3; i++) bg.drawImage(phase.blau, pad + 1, pad + 1, zw, zh);
      out.blau = b; out.bpad = pad;
    }
    out.wx = out.ax; out.wy = out.ay;
    if (wasser) {
      out.wx = (phase.schwimmer || phase.zelle ? phase.ax : phase.c.width / 2) * sx + 1;
      out.wy = (phase.schwimmer ? phase.ay : phase.c.height * wasser.wl) * sy + 1;
      const wy = out.wy, f = wasser.farbe;
      if (wasser.tauch) {
        // was unter der Wasserlinie liegt, verschwimmt im Seewasser
        g.globalCompositeOperation = 'source-atop';
        const gr = g.createLinearGradient(0, wy - zh * .04, 0, c.height);
        gr.addColorStop(0, rgba(f, 0)); gr.addColorStop(.3, rgba(f, wasser.tauch * .75)); gr.addColorStop(1, rgba(f, wasser.tauch));
        g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-in';
        const m = g.createLinearGradient(0, wy - 1, 0, c.height);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,.1)');
        g.fillStyle = m; g.fillRect(0, 0, c.width, c.height);
      }
      if (wasser.spiegel && wy > 3) {
        const sh = Math.min(Math.round(wy), c.height), s = leinwand(c.width, sh), sg = s.getContext('2d');
        sg.translate(0, sh); sg.scale(1, -1); sg.drawImage(c, 0, 0, c.width, sh, 0, 0, c.width, sh);
        sg.setTransform(1, 0, 0, 1, 0, 0);
        sg.globalCompositeOperation = 'source-atop'; sg.fillStyle = rgba(f, .62); sg.fillRect(0, 0, c.width, sh);
        sg.globalCompositeOperation = 'destination-in';
        const m = sg.createLinearGradient(0, 0, 0, sh);
        m.addColorStop(0, 'rgba(0,0,0,.26)'); m.addColorStop(.6, 'rgba(0,0,0,0)');
        sg.fillStyle = m; sg.fillRect(0, 0, c.width, sh);
        out.sp = s;
      }
    }
    if (lampen) {
      // aus den Lampen einen weichen Lichthof und – auf dem Wasser – Lichtbahnen
      const m = lampen;
      {
        const pad = Math.ceil(Math.max(5, Math.min(46, zw * .1))), gl = leinwand(c.width + 2 * pad, c.height + 2 * pad), gg = gl.getContext('2d');
        gg.globalCompositeOperation = 'lighter';
        gg.filter = 'blur(' + (pad * .55).toFixed(1) + 'px)'; for (let i = 0; i < 4; i++) gg.drawImage(m, pad, pad);
        gg.filter = 'blur(' + (pad * .28).toFixed(1) + 'px)'; gg.drawImage(m, pad, pad); gg.drawImage(m, pad, pad);
        gg.filter = 'blur(' + Math.max(.8, pad * .15).toFixed(1) + 'px)'; gg.drawImage(m, pad, pad); gg.filter = 'none';
        out.glow = gl; out.gpad = pad;
        if (wasser) {
          const sh = Math.min(Math.round(out.wy), c.height), streck = 5, lang = Math.round(sh * streck) + pad;
          const s2 = leinwand(c.width + 2 * pad, lang), sg = s2.getContext('2d');
          sg.filter = 'blur(' + Math.max(1, pad * .3).toFixed(1) + 'px)';
          sg.globalCompositeOperation = 'lighter'; sg.translate(0, sh * streck); sg.scale(1, -streck); for (let i = 0; i < 4; i++) sg.drawImage(m, 0, 0, c.width, sh, pad, 0, c.width, sh);
          sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'none';
          sg.globalCompositeOperation = 'destination-in';
          const fm = sg.createLinearGradient(0, 0, 0, lang); fm.addColorStop(0, 'rgba(0,0,0,.95)'); fm.addColorStop(.35, 'rgba(0,0,0,.55)'); fm.addColorStop(1, 'rgba(0,0,0,0)');
          sg.fillStyle = fm; sg.fillRect(0, 0, s2.width, lang);
          out.lsp = s2;
        }
      }
    }
    return out;
  }

  function bannerStoff(text, nacht) {
    const h = 200, font = '900 148px "Arial Black", Impact, "Segoe UI", sans-serif';
    const m = leinwand(10, 10).getContext('2d'); m.font = font;
    const w = Math.ceil(m.measureText(text).width + 150);
    const c = leinwand(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4f4f0'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(1, '#dcdcd6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x < w; x += 46) g.fillRect(x, 0, 3, h);        // Netzbahnen
    g.fillStyle = '#b8b8b0'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);                       // Saum
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#5a0a12'; g.strokeText(text, w / 2, h / 2 + 6);
    g.fillStyle = '#c8102e'; g.fillText(text, w / 2, h / 2 + 6);
    if (!nacht) return { c };
    // nachts: angestrahlter Stoff, Schrift leuchtet (wird zu Lampen = Lichthof)
    const l = leinwand(w, h), lg = l.getContext('2d');
    lg.font = font; lg.textAlign = 'center'; lg.textBaseline = 'middle';
    lg.fillStyle = '#ff4a3a'; lg.fillText(text, w / 2, h / 2 + 6);
    return { c, lampen: l };
  }

  // ---------------------------------------------------------------------------
  // Eine Szene
  // ---------------------------------------------------------------------------
  async function wetterObjekte(ziel, opt) {
    opt = Object.assign({ quellen: '../', bilder: '', bild: 'bg-sonnig.webp', wetter: 'sonnig', nacht: false, dichte: 5, pos: [.5, .5], start: ['moewe', 'moewe', 'schwalbe', 'kraehe', 'schwan', 'kraul', 'brust', 'matratze', 'taucher', 'segel', 'tret', 'dampfer', 'mahagoni', 'fischer'], banner: false }, Object.fromEntries(Object.entries(opt || {}).filter(([, v]) => v !== undefined)));
    const szene = SZENEN[opt.bild] || { hz: null, wasser: null, dunst: 3000 };
    const nacht = !!opt.nacht, wetter = opt.wetter;
    let aus = false, raf = 0, dichte = opt.dichte, wasserZeigen = false;

    const cv = leinwand(W, H); cv.className = 'wetter-objekte';
    Object.assign(cv.style, { position: 'absolute', pointerEvents: 'none' });
    ziel.appendChild(cv);
    const g = cv.getContext('2d');
    const einpassen = () => {
      const ew = ziel.clientWidth, eh = ziel.clientHeight; if (!ew) return;
      const s = Math.max(ew / W, eh / H);
      Object.assign(cv.style, { width: W * s + 'px', height: H * s + 'px', left: (ew - W * s) * opt.pos[0] + 'px', top: (eh - H * s) * opt.pos[1] + 'px' });
    };
    const ro = new ResizeObserver(einpassen); ro.observe(ziel); einpassen();

    // Hintergrund lesen: Dunstfarbe über dem Horizont, Wasserfarbe je Zeile
    const img = new Image(); img.src = opt.bildUrl || opt.bilder + opt.bild; await img.decode();
    const t0 = leinwand(W, H), tg = t0.getContext('2d', { willReadFrequently: true }); tg.drawImage(img, 0, 0, W, H);
    const bg = tg.getImageData(0, 0, W, H).data, foto = t0;
    const mittel = (y0, y1, nurWasser) => { let r = 0, gg = 0, b = 0, n = 0;
      for (let y = Math.max(0, y0 | 0); y < Math.min(H, y1); y++) for (let x = 0; x < W; x += 6) { if (nurWasser && !imWasser(x, y)) continue; const i = (y * W + x) * 4; r += bg[i]; gg += bg[i + 1]; b += bg[i + 2]; n++; }
      return n ? [r / n, gg / n, b / n] : [60, 90, 110]; };
    const hz = szene.hz ?? 470;
    const dunstFarbe = mittel(hz - 60, hz - 10).map(Math.round);
    const PHASEN = await boegenLaden(opt.quellen);
    if (aus) return null;

    function imWasser(x, y) {
      const p = szene.wasser; if (!p) return false;
      let drin = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) drin = !drin;
      }
      return drin;
    }
    function erlaubt(art) {
      if (nacht ? !art.nacht : !art.tag) return false;
      if (art.nichtBei && art.nichtBei.includes(wetter)) return false;
      if (art.ort === 'wasser' && !szene.wasser) return false;
      return true;
    }

    const objekte = [];
    function phasenFuer(art) {
      const nachtBild = nacht && art.bogenN;
      const wahlAus = b => Array.isArray(b) ? wahl(b) : b, key = nachtBild ? wahlAus(art.bogenN) : wahlAus(art.bogen);
      let ph = PHASEN[key][art.zeile || 0];
      const bereich = nacht && art.phasenN ? art.phasenN : art.phasen;
      if (bereich) ph = ph.slice(bereich[0], bereich[1]);
      return { ph, eigeneNacht: !!(nachtBild || (nacht && art.phasenN)) };
    }

    function erzeugen(art, sofort, fest) {
      if (typeof art === 'string') art = ARTEN.find(a => a.id === art);
      if (!art || (art.ort === 'wasser' && !szene.wasser)) return false;
      const { ph, eigeneNacht } = phasenFuer(art);
      if (!ph || !ph.length) return false;
      const nachRechts = fest && fest.richtung ? fest.richtung > 0 : Math.random() < .5;
      const anzahl = Math.round(zufall(art.schwarm[0], art.schwarm[1]));
      const meter = (nacht && art.mN) || art.m;
      const refBreite = ph.reduce((s, p) => s + p.c.width, 0) / ph.length;
      let dist, y, versuch = 0;
      for (; versuch < 40; versuch++) {
        dist = fest && fest.d ? fest.d : logZufall(art.d[0], art.d[1]);
        if (art.ort === 'wasser') {
          y = szene.hz + F * KAMERA / dist; if (y > H - 8) continue;
          // Kollisionsschutz: jede Entfernung ist eine Fahrspur. Andere Boote/Schwimmer müssen echt (Rumpfbreite + 3 m)
          // UND sichtbar (mind. 4 Bildpunkte Höhenunterschied) daneben liegen, sonst fahren sie scheinbar ineinander.
          if (objekte.some(o => o.art.ort === 'wasser' && (Math.abs(o.dist - dist) < ((o.art.breite || 2) + (art.breite || 2)) / 2 + 3 || Math.abs(o.basisY - y) < 4))) continue;
        }
        else if (art.ort === 'luft') {
          const hoehe = art.hoch ? zufall(art.hoch[0], art.hoch[1]) : 0, h0 = szene.hz ?? 600;
          // Flughöhe über dem See, auf die Bildhöhe begrenzt (Jets: steiler Blick nach oben)
          y = art.himmel ? zufall(art.himmel[0], art.himmel[1]) * h0 : h0 - F * (hoehe - KAMERA) / dist;
          if (y < 30 || y > h0 - 4) continue;
        } else y = zufall(H * .35, H * .9);
        break;
      }
      if (versuch === 40) return false;
      const px = meter * F / dist, massstab = px / refBreite;
      const tempo = zufall(art.v[0], art.v[1]) * F / dist;
      const dunst = (1 - Math.exp(-dist / szene.dunst)) * (art.ort === 'nah' ? 0 : 1);
      const licht = nacht ? (eigeneNacht ? null : [.45, .5, .7]) : szene.licht;
      const dunkel = nacht && !eigeneNacht ? .45 : 1;
      const wf = art.ort === 'wasser' ? mittel(y + 1, y + 1 + Math.max(3, px * .15), true) : null;
      const wasser = wf && { wl: art.wl || .85, farbe: wf, tauch: art.tauch, spiegel: art.spiegel };
      const bilder = ph.map(p => vorberechnen(p, massstab, licht, dunst, dunkel, dunstFarbe, wasser, nacht && eigeneNacht));
      let banner = null;
      if (art.banner) {
        const stoff = bannerStoff(wahl(art.banner), nacht), hm = 4.5;                // Banner 4,5 m hoch
        banner = vorberechnen({ c: stoff.c, lampen: stoff.lampen, verst: 1, ax: 0, ay: 0 }, hm * F / stoff.c.height / dist, licht, dunst, dunkel, dunstFarbe, null, nacht);
      }
      let neu = 0, schwarmDx = 0; const schwarmZeit = Math.random() * 100, schwarmWackel = zufall(0, 6.28);
      for (let i = 0; i < anzahl; i++) {
        const v = tempo;                                       // Schwarm: alle gleich schnell, sonst fliegen sie ineinander
        // Wasser: Schwarm in einer Reihe auf derselben Spur (gleiches Tempo, fester Abstand); Luft: gestaffelt
        // jeder weitere Vogel/Schwan mit festem Abstand hinter dem vorigen (nie übereinander)
        schwarmDx += i ? (art.formation ? px * 1.1 : zufall(px * 1.4, px * 2.6)) : 0;
        const dx = schwarmDx, dy = art.ort === 'wasser' ? 0 : art.formation ? i * px * .35 * (i % 2 ? 1 : -1) : (i ? zufall(-px * .8, px * .8) : 0);
        const x = fest && fest.x != null ? fest.x - dx : sofort ? zufall(.15, .85) * W - dx : (nachRechts ? -px - dx - 10 : W + px + dx + 10);
        const o = { art, bilder, px, x, y: y + dy, basisY: y + dy, v: nachRechts ? v : -v, richtung: nachRechts ? 1 : -1, dist, dunst,
          zeit: schwarmZeit, phase: Math.random() * 8, gleitet: false, wechsel: zufall(.3, 1.5), wackel: schwarmWackel + i * .35,
          wf, spur: [], ringe: [], letzteNr: -1, spurUhr: 0 };
        if (art.einsatz && Math.random() < art.einsatz) { o.einsatz = true; o.v *= 1.5; }
        if (banner) { o.banner = banner; o.seil = 32 * F / dist; o.extra = o.seil + banner.c.width; if (!sofort && !(fest && fest.x != null)) o.x -= o.richtung * 0; }
        if (art.ort === 'wasser' && !imWasser(o.x < 0 ? 10 : o.x > W ? W - 10 : o.x, o.y)) {
          let gx = -1; for (let t = 0; t < 60; t++) { const xx = zufall(10, W - 10); if (imWasser(xx, o.y)) { gx = xx; break; } }
          if (gx < 0) continue; o.x = gx; o.einblenden = 0;
        }
        if (art.kondens && !nacht && (wetter === 'sonnig' || wetter === 'abendrot' || (wetter === 'bewoelkt' && Math.random() < .4))) {
          // Kondensstreifen: mal kurz (trockene Luft), mal lang und breit werdend
          const r = Math.random();
          o.kT = r < .3 ? zufall(2.5, 5) : r < .75 ? zufall(10, 20) : zufall(28, 40);
          o.kA = (wetter === 'bewoelkt' ? .45 : .85) * (1 - dunst * .5);
          o.kFarbe = mischen(wetter === 'abendrot' ? [255, 212, 188] : [252, 253, 255], dunstFarbe, dunst * .6);
          o.kWind = zufall(-3, 3); o.puff = zufall(0, 6);
        }
        objekte.push(o); neu++;
      }
      return neu > 0;
    }

    let naechstes = 2;
    function zufallsEreignis(dt) {
      if (!dichte) return;
      naechstes -= dt; if (naechstes > 0) return;
      naechstes = zufall(.5, 1.5) * (11 - dichte) * .8;
      if (objekte.length > 45) return;
      const anzahl = a => objekte.reduce((n, o) => n + (o.art === a ? 1 : 0), 0);
      // Boote/Schiffe: höchstens 6 gleichzeitig und nie zwei gleiche (Schwimmer, Schwäne, Taucher zählen nicht)
      const boot = a => a.ort === 'wasser' && !a.tauch, boote = objekte.filter(o => boot(o.art)).length;
      const moeglich = ARTEN.filter(a => erlaubt(a) && a.gewicht > 0 && !(boot(a) && (anzahl(a) >= 1 || boote >= 6))); if (!moeglich.length) return;
      // je mehr von einer Art schon unterwegs ist, desto seltener kommt sie nach (mehr Abwechslung)
      const gew = a => a.gewicht / Math.pow(1 + (a.ort === 'wasser' ? anzahl(a) : 0), 2);
      const summe = moeglich.reduce((s, a) => s + gew(a), 0);
      let r = Math.random() * summe, art = moeglich[0];
      for (const a of moeglich) { r -= gew(a); if (r <= 0) { art = a; break; } }
      if (art.gross && objekte.filter(o => o.art.gross).length >= 2) return;
      erzeugen(art, false);
    }

    // --- Wasser: Kielwellen (Kelvin-Winkel 19,5°), Wellenringe, Spiegelbild ---
    const flach = o => KAMERA / o.dist;                     // Wasserfläche perspektivisch gestaucht
    const mPx = (o, m) => m * F / o.dist;
    function wasserLinien(o, y) {
      const a = o.art, hell = mischen(o.wf, [255, 255, 255], nacht ? .28 : .55), dunkel = mischen(o.wf, [0, 0, 0], .35);
      if (a.kiel && o.spur.length > 1) {
        // Heckwelle sichtbar höchstens ~5 Bootslängen lang; einzelne Wellenkämme statt durchgehender Linie
        const [T0, breite, deck] = a.kiel, vm = Math.abs(o.v) * o.dist / F, T = Math.min(T0, 5 * ((nacht && a.mN) || a.m) / Math.max(.3, vm));
        const lw = Math.max(.6, mPx(o, breite) * .7), vpx = Math.abs(o.v), fl = flach(o);
        g.lineCap = 'butt'; g.lineJoin = 'round';
        for (const seite of [-1, 1]) for (let i = 1; i < o.spur.length; i++) {
          const p = o.spur[i - 1], q = o.spur[i];
          if (p.t > T) continue;
          const kamm = .3 + .7 * Math.max(0, Math.sin(i * 1.15 + seite * 1.7 + o.wackel));
          const al = deck * .75 * Math.pow(1 - p.t / T, 2) * Math.min(1, q.t / .25) * kamm;
          if (al < .02) continue;
          const yp = y + seite * .354 * vpx * p.t * fl, yq = y + seite * .354 * vpx * q.t * fl;
          g.lineWidth = lw; g.strokeStyle = rgba(dunkel, al * .45);
          g.beginPath(); g.moveTo(p.x, yp + lw * .8); g.lineTo(q.x, yq + lw * .8); g.stroke();
          g.strokeStyle = rgba(hell, al);
          g.beginPath(); g.moveTo(p.x, yp); g.lineTo(q.x, yq); g.stroke();
        }
      }
      if (o.ringe.length) {
        const fl = flach(o), lw = Math.max(.6, mPx(o, .025));
        g.lineWidth = lw;
        for (const r of o.ringe) {
          const T = a.ringe; if (!(r.t >= 0 && r.t < T)) continue;
          const rx = mPx(o, .12 + .32 * r.t), ry = Math.max(.7, rx * fl), al = .5 * Math.pow(1 - r.t / T, 1.5);
          if (al < .02 || rx < 1) continue;
          const ring = dy => { g.beginPath(); for (let k = 0; k <= 32; k++) { const w = k / 32 * Math.PI * 2, px = r.x + Math.cos(w) * rx, py = y + dy + Math.sin(w) * ry; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); };
          g.strokeStyle = rgba(dunkel, al * .5); ring(lw);
          g.strokeStyle = rgba(hell, al); ring(0);
        }
      }
    }
    // Seewasser aus dem Foto wieder über den Körper legen: bewegte Wellenkante statt gerader Schnittkante
    function eintauchen(o, x, y) {
      const a = o.art, amp = Math.max(.7, o.px * .022), tief = o.px * (a.tauch > .6 ? .3 : .12);
      const x0 = Math.floor(x - o.px * .95), x1 = Math.ceil(x + o.px * .95), z = o.zeit;
      const welle = xx => y + Math.sin(xx * 9 / o.px + z * 3.1 + o.wackel) * amp + Math.sin(xx * 23 / o.px - z * 4.7) * amp * .45;
      const pfad = heben => { g.beginPath(); g.moveTo(x0, y + tief);
        for (let xx = x0; xx <= x1; xx += 1.5) { const rand = Math.min(1, Math.min(xx - x0, x1 - xx) / (o.px * .25)); g.lineTo(xx, welle(xx) - heben * rand + (1 - rand) * amp * 2); }
        g.lineTo(x1, y + tief); g.closePath(); };
      const bx = Math.max(0, x0), by = Math.max(0, Math.floor(y - amp * 3)), bw = Math.min(W, x1) - bx, bh = Math.min(H, Math.ceil(y + tief)) - by;
      if (bw <= 0 || bh <= 0) return;
      for (const [heben, deck] of [[amp * 1.2, .35], [0, .95]]) {           // weiche Kante: zweimal, leicht versetzt
        g.save(); pfad(heben); g.clip(); g.globalAlpha = deck; g.drawImage(foto, bx, by, bw, bh, bx, by, bw, bh); g.restore();
      }
      // heller Saum, wo das Wasser am Körper steht
      g.save(); g.beginPath(); for (let xx = x - o.px * .4; xx <= x + o.px * .3; xx += 1.5) { const yy = welle(xx); xx === x - o.px * .4 ? g.moveTo(xx, yy) : g.lineTo(xx, yy); }
      g.lineWidth = Math.max(.6, o.px * .012); g.strokeStyle = rgba(mischen(o.wf, [255, 255, 255], nacht ? .3 : .6), .55); g.stroke(); g.restore();
    }
    function lichtbahnen(o, bild, x, y) {
      const s = bild.lsp, p = bild.gpad, lang = s.height, amp = Math.max(.6, s.width * .015);
      g.save(); g.translate(x, y); g.scale(o.richtung, 1); g.globalCompositeOperation = 'lighter';
      for (let sy = 0; sy < lang; sy += 2) {
        const tief = sy / lang, an = .55 + .45 * Math.sin(sy * 1.3 + o.zeit * 5.2 + o.wackel) * Math.sin(sy * .37 - o.zeit * 2.1);
        if (an < .08) continue;
        g.globalAlpha = Math.min(1, an * 2);
        g.drawImage(s, 0, sy, s.width, 2, -bild.wx - p + Math.sin(sy * .5 + o.zeit * 3.4) * amp * (1 + tief * 3), sy, s.width, 2);
      }
      g.restore();
    }
    function spiegelbild(o, bild, x, y) {
      const s = bild.sp; if (!s) return;
      g.save(); g.translate(x, y); g.scale(o.richtung, 1);
      const amp = Math.max(.6, s.width * .02), sh = s.height;
      if (sh < 8) g.drawImage(s, -bild.wx, 0);
      else for (let sy = 0; sy < sh; sy += 2) {
        const off = Math.sin(sy * .55 + o.zeit * 2.6 + o.wackel) * amp * (.4 + sy / sh);
        g.drawImage(s, 0, sy, s.width, 2, -bild.wx + off, sy, s.width, 2);
      }
      g.restore();
    }

    // --- Weicher Phasenwechsel (keine Ruckler bei langsamen Bewegungen) ---
    const misch = leinwand(64, 64), mg = misch.getContext('2d');
    function zeichnen(b1, b2, f) {
      if (!b2 || f < .03 || b1 === b2) { g.drawImage(b1.c, -b1.wx, -b1.wy); return; }
      const l = Math.ceil(Math.max(b1.wx, b2.wx)), r = Math.ceil(Math.max(b1.c.width - b1.wx, b2.c.width - b2.wx));
      const o = Math.ceil(Math.max(b1.wy, b2.wy)), u = Math.ceil(Math.max(b1.c.height - b1.wy, b2.c.height - b2.wy));
      if (misch.width < l + r || misch.height < o + u) { misch.width = Math.max(misch.width, l + r); misch.height = Math.max(misch.height, o + u); }
      mg.globalCompositeOperation = 'source-over'; mg.globalAlpha = 1; mg.clearRect(0, 0, l + r, o + u);
      mg.globalCompositeOperation = 'lighter';           // Deckkraft addiert sich genau zu 1
      mg.globalAlpha = 1 - f; mg.drawImage(b1.c, l - b1.wx, o - b1.wy);
      mg.globalAlpha = f; mg.drawImage(b2.c, l - b2.wx, o - b2.wy);
      g.drawImage(misch, 0, 0, l + r, o + u, -l, -o, l + r, o + u);
    }

    function kondensstreifen(o) {
      const sp = o.spur; if (sp.length < 2) return;
      const vpx = Math.abs(o.v) || 1, luecke = o.px * .7 / vpx;
      const w0 = Math.max(.9, o.px * .035), breiter = o.px * (o.kT > 20 ? .02 : .01);
      g.lineCap = 'butt';
      for (const pass of [0, 1]) for (let i = 1; i < sp.length; i++) {
        const p = sp[i - 1], q = sp[i], t = (p.t + q.t) / 2;
        if (t > o.kT) continue;
        const rampe = Math.min(1, Math.max(0, (t - luecke * .3) / (luecke * 1.2)));
        if (!rampe) continue;
        let al = o.kA * rampe * Math.pow(1 - t / o.kT, .9);
        if (t > 6) al *= 1 - .3 * Math.min(1, (t - 6) / 10) * (.5 + .5 * Math.sin(i * .8 + o.puff));   // Wölkchen im alten Streifen
        const w = w0 + breiter * t;
        g.lineWidth = pass ? w : w * 2.6; g.strokeStyle = rgba(o.kFarbe, pass ? al * .8 : al * .22);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      }
    }
    function bannerZeichnen(o, x, y) {
      const b = o.banner.c, bw = b.width, bh = b.height, dir = o.richtung, gl = o.banner.glow, gp = o.banner.gpad || 0;
      const heck = x - dir * o.px * .42, front = heck - dir * o.seil, oben = y + o.px * .12;
      const links = dir > 0 ? front - bw : front;
      // Schleppseil zum vorderen Stab (oben und unten)
      g.strokeStyle = rgba(mischen([60, 60, 60], dunstFarbe, o.dunst), .7); g.lineWidth = Math.max(.5, o.px * .012);
      g.beginPath(); g.moveTo(heck, y + o.px * .04); g.lineTo(front, oben + 1); g.moveTo(heck, y + o.px * .04); g.lineTo(front, oben + bh * .9); g.stroke();
      // Stoff flattert: Welle läuft nach hinten, hinten stärker
      const amp = bh * .1, k = 2 * Math.PI / Math.max(30, bw * .45);
      for (let cx = 0; cx < bw; cx += 2) {
        const abst = (dir > 0 ? bw - cx : cx) / bw, ph = abst * bw * k - o.zeit * 9;
        const dy = Math.sin(ph) * amp * Math.pow(abst, 1.1), neig = Math.cos(ph) * Math.pow(abst, 1.1);
        g.drawImage(b, cx, 0, 2, bh, links + cx, oben + dy, 2.4, bh);
        if (gl) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = .45; g.drawImage(gl, cx + gp, 0, 2, gl.height, links + cx, oben + dy - gp, 2.4, gl.height); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
        if (Math.abs(neig) > .15) { g.fillStyle = neig > 0 ? 'rgba(0,0,0,' + (neig * .18).toFixed(3) + ')' : 'rgba(255,255,255,' + (-neig * .08).toFixed(3) + ')'; g.fillRect(links + cx, oben + dy, 2.4, bh); }
      }
      g.fillStyle = rgba(mischen([50, 50, 50], dunstFarbe, o.dunst), .9); g.fillRect(front - Math.max(1, bh * .03), oben, Math.max(1, bh * .06), bh);   // Stab
    }
    function lichter(o, x, y) {
      const z = o.zeit, dir = o.richtung, gr = Math.max(2.6, o.px * .06), daempf = 1 - o.dunst * .5;
      const punkt = (px, py, farbe, r, st) => { const rg = g.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, rgba([255, 255, 255], st)); rg.addColorStop(.12, rgba(farbe, st)); rg.addColorStop(.4, rgba(farbe, st * .35)); rg.addColorStop(1, rgba(farbe, 0));
        g.fillStyle = rg; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); };
      g.save(); g.globalCompositeOperation = 'lighter';
      const jet = o.art.lichter === 'jet';
      // Positionslicht der zugewandten Seite (Flug nach rechts: rechte Seite = grün), Hecklicht weiß
      punkt(x + dir * o.px * (jet ? .02 : .05), y + o.px * .03, dir > 0 ? [60, 255, 120] : [255, 50, 40], gr * 2.2, .9 * daempf);
      punkt(x - dir * o.px * .47, y - o.px * (jet ? .05 : .02), [255, 250, 235], gr * 1.6, .7 * daempf);
      // rotes Drehlicht (Hubschrauber oben, Jet unten), weiße Doppelblitze
      const dreh = (z * (jet ? .9 : 1.1)) % 1; if (dreh < .14) punkt(x, y + o.px * (jet ? .08 : -.08), [255, 30, 20], gr * 4, (1 - dreh / .14) * daempf);
      const s = (z + o.wackel) % 1.4; if (s < .05 || (s > .13 && s < .18)) punkt(x - dir * o.px * .08, y, [235, 245, 255], gr * 6, daempf);
      // Landescheinwerfer beim Anflug: heller Punkt an der Nase und ein Lichtkegel nach vorne
      if (o.art.id === 'jet') {
        const nx = x + dir * o.px * .4, ny = y + o.px * .05;
        punkt(nx, ny, [255, 248, 225], gr * 5, .95 * daempf);
        const kg = g.createLinearGradient(nx, ny, nx + dir * o.px * 1.6, ny);
        kg.addColorStop(0, rgba([255, 245, 220], .22 * daempf)); kg.addColorStop(1, rgba([255, 245, 220], 0));
        g.fillStyle = kg; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + dir * o.px * 1.6, ny - o.px * .22); g.lineTo(nx + dir * o.px * 1.6, ny + o.px * .3); g.closePath(); g.fill();
      }
      g.restore();
    }

    let letzte = performance.now(), fpsZeit = 0, fpsN = 0, fps = 0;
    function takt(t) {
      if (aus) return;
      const dt = Math.max(0, Math.min(.05, (t - letzte) / 1000)); letzte = Math.max(letzte, t);
      fpsZeit += dt; fpsN++; if (fpsZeit > 1) { fps = fpsN / fpsZeit; fpsZeit = 0; fpsN = 0; }
      zufallsEreignis(dt);
      if (bannerUhr > 0 && (bannerUhr -= dt) <= 0 && erlaubt(bannerArt)) erzeugen(bannerArt, false);
      g.clearRect(0, 0, W, H);
      if (wasserZeigen && szene.wasser) { g.fillStyle = 'rgba(0,160,255,.25)'; g.beginPath(); szene.wasser.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill(); }
      // nah vorne in der Liste: die Schleife läuft rückwärts (wegen Entfernen), zeichnet also fern zuerst, nah zuletzt (oben)
      objekte.sort((a, b) => a.dist - b.dist);
      for (const o of objekte) if (o.art.ort === 'wasser' && !o.weg && o.einblenden !== 0) wasserLinien(o, o.basisY);
      for (let i = objekte.length - 1; i >= 0; i--) {
        const o = objekte[i], a = o.art;
        o.zeit += dt; o.x += o.v * dt;
        const n = o.bilder.length;
        let bild, bild2 = null, f = 0;
        if (a.schlag) {
          o.wechsel -= dt;
          if (o.wechsel <= 0) { o.gleitet = n > 8 && Math.random() < a.gleit && !o.gleitet; o.wechsel = o.gleitet ? zufall(.6, 2) : zufall(.6, 2.2); }
          const schlagN = n > 8 ? 8 : n;
          if (o.gleitet) bild = o.bilder[8];
          else { o.phase = (o.phase + a.schlag * schlagN * dt) % schlagN; bild = o.bilder[Math.floor(o.phase)]; }
        } else if (a.rotor) { o.phase = (o.phase + a.rotor * dt) % n; bild = o.bilder[Math.floor(o.phase)]; }
        else if (a.bild) {
          o.phase = (o.phase + a.bild * dt) % n; const k = Math.floor(o.phase);
          bild = o.bilder[k]; bild2 = o.bilder[(k + 1) % n]; f = o.phase - k;
          if (a.ringBei && k !== o.letzteNr) { if (a.ringBei.includes(k)) o.ringe.push({ x: o.x + o.richtung * o.px * zufall(.05, .3), t: 0 }); o.letzteNr = k; }
        } else bild = o.bilder[0];

        let y = o.basisY, kipp = 0;
        if (a.ort === 'luft') {
          if (a.zickzack) y += Math.sin(o.zeit * 2.3 + o.wackel) * o.px * 1.2 + Math.sin(o.zeit * 5.1) * o.px * .4;
          else if (a.schlag) y += Math.sin(o.zeit * .7 + o.wackel) * o.px * .6;
          else if (a.schweben) y += Math.sin(o.zeit * .25 + o.wackel) * o.px * .05;
          else y += Math.sin(o.zeit * .4 + o.wackel) * o.px * .03;
        } else if (a.ort === 'nah') {
          if (a.fallen) { o.basisY += 38 * dt; y = o.basisY + Math.sin(o.zeit * 1.8 + o.wackel) * 24; kipp = Math.sin(o.zeit * 2.1 + o.wackel) * .7; }
          else if (a.schweben) { o.basisY -= 5 * dt; y = o.basisY + Math.sin(o.zeit * .9 + o.wackel) * 16; }
          else y += Math.sin(o.zeit * 1.3 + o.wackel) * 30 + Math.sin(o.zeit * 3.1 + o.wackel * 2) * 9;
        } else {
          // Wasser: Dünung; Schwimmer wippen im Takt der Züge
          y += Math.sin(o.zeit * 1.1 + o.wackel) * Math.max(.25, o.px * .004);
          if (a.wippen) y += Math.sin((o.phase / n) * Math.PI * 2 * (a.ringBei ? a.ringBei.length : 1)) * o.px * a.wippen;
          kipp = Math.sin(o.zeit * .9 + o.wackel) * (o.px > 60 ? .004 : .008);
        }

        // Spuren mitschreiben (Kielwelle bzw. Kondensstreifen bleiben am Ort, das Objekt fährt weiter)
        o.spurUhr -= dt;
        for (const p of o.spur) { p.t += dt; if (o.kT) { p.x += o.kWind * dt; p.y += .25 * dt; } }
        for (const r of o.ringe) r.t += dt;
        if (o.ringe.length && o.ringe[0].t > (a.ringe || 2)) o.ringe.shift();
        if (a.ringe && !a.ringBei && Math.random() < dt / 1.6) o.ringe.push({ x: o.x + o.richtung * o.px * zufall(-.1, .3), t: 0 });
        const maxT = o.kT || (a.kiel ? a.kiel[0] : 0);
        if (maxT && !o.weg && o.spurUhr <= 0) {
          o.spurUhr = o.kT ? .08 : .1;
          if (o.kT) o.spur.push({ x: o.x - o.richtung * o.px * .18, y: y + o.px * .015, t: 0 });
          else o.spur.push({ x: o.x + o.richtung * (a.hinten ? -o.px * .3 : 0), t: 0 });
        }
        while (o.spur.length && o.spur[0].t > maxT) o.spur.shift();

        const lang = o.px + (o.extra || 0), raus = o.richtung > 0 ? o.x - lang > W + 20 : o.x + lang < -20;
        if (raus || o.basisY > H + 60 || o.basisY < -120) {
          if (o.kT && o.spur.length) { o.weg = true; } else { objekte.splice(i, 1); continue; }
        }
        let alpha = 1;
        if (a.ort === 'wasser') {
          // Ufer prüfen nur im Bild (ausserhalb ist kein Polygon – dort kommen die Boote ja erst herein)
          if (!imWasser(Math.min(W - 1, Math.max(1, o.x + o.richtung * o.px * .45)), o.y)) { alpha = 0; if (o.einblenden === undefined || o.einblenden > .9) { objekte.splice(i, 1); continue; } }
          if (o.einblenden !== undefined) { o.einblenden = Math.min(1, o.einblenden + dt * .5); alpha = Math.min(alpha, o.einblenden); }
        }
        const x = Math.round(o.x * 2) / 2, yy = Math.round(y * 2) / 2;
        if (o.kT) kondensstreifen(o);
        if (o.weg || !alpha) continue;
        if (o.banner) bannerZeichnen(o, x, yy);
        g.save(); g.globalAlpha = alpha;
        const vorn = f > .5 && bild2 ? bild2 : bild;
        if (a.ort === 'wasser') { spiegelbild(o, vorn, x, yy); if (vorn.lsp) lichtbahnen(o, vorn, x, yy); }
        g.translate(x, yy);
        if (kipp) g.rotate(kipp);
        g.scale(o.richtung, 1);
        zeichnen(bild, bild2, f);
        if (vorn.blau && o.einsatz) {
          const t = (o.zeit * 1.6) % 1, an = t < .08 || (t > .16 && t < .24);
          if (an) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha; g.drawImage(vorn.blau, -vorn.wx - vorn.bpad, -vorn.wy - vorn.bpad); g.globalCompositeOperation = 'source-over'; }
        }
        if (vorn.glow) { g.globalCompositeOperation = 'lighter'; const fl = .85 + .1 * Math.sin(o.zeit * 6.3 + o.wackel) + .05 * Math.sin(o.zeit * 17);
          g.globalAlpha = alpha * fl; g.drawImage(vorn.glow, -vorn.wx - vorn.gpad, -vorn.wy - vorn.gpad);
          g.globalAlpha = alpha * fl * .9; g.drawImage(vorn.glow, -vorn.wx - vorn.gpad, -vorn.wy - vorn.gpad); }
        g.restore();
        if (a.ort === 'wasser') { g.save(); g.globalAlpha = alpha; if (a.tauch) eintauchen(o, x, yy); g.restore(); }
        if (nacht && a.lichter) lichter(o, x, yy);
      }
      raf = requestAnimationFrame(takt);
    }

    for (const id of opt.start || []) { const art = ARTEN.find(a => a.id === id); if (art && erlaubt(art)) erzeugen(art, true); }
    let bannerUhr = opt.banner ? zufall(6, 22) : -1;                 // einmal pro Anzeige, früh genug zum Lesen
    const bannerArt = ARTEN.find(a => a.banner);
    raf = requestAnimationFrame(takt);

    return {
      arten: ARTEN, objekte, szene,
      erzeugen: (id, fest) => erzeugen(id, true, fest),
      erlaubt: id => erlaubt(typeof id === 'string' ? ARTEN.find(a => a.id === id) : id),
      leeren() { objekte.length = 0; },
      dichte(n) { dichte = n; },
      wasserZeigen(b) { wasserZeigen = b; },
      info: () => ({ objekte: objekte.length, fps: Math.round(fps) }),
      stop() { aus = true; cancelAnimationFrame(raf); ro.disconnect(); cv.remove(); }
    };
  }

  window.wetterObjekte = async (ziel, opt) => {
    const api = await wetterObjekte(ziel, opt);
    return api;
  };
  window.wetterObjekte.ARTEN = ARTEN;
  window.wetterObjekte.boegenLaden = boegenLaden;
  window.wetterObjekte.BOEGEN = BOEGEN; window.wetterObjekte.F = F;
})();
