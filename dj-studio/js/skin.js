// Bild 2 als Buehne. Das Bild ist die Oberflaeche (img/bild2-2x.webp: Bild 2, mit
// ESRGAN auf 3344 x 1882 hochgerechnet; Original 1672 x 941 liegt als bild2.png daneben);
// die echten Bedienelemente liegen pixelgenau an den Stellen, an denen das Bild
// sie zeigt. Alle Masse unten sind PIXEL IM BILD [x, y, breite, hoehe] und werden
// hier auf die 1920er-Buehne umgerechnet.
//
// - Was im Bild statisch bleiben darf (Gehaeuse, Beschriftungen), ist einfach Bild.
// - Was sich aendert, wird im Bild "geputzt" (FLICKEN: Bereich mit einem leeren
//   Streifen aus der Nachbarschaft ueberdecken) und live darueber gezeichnet.
// - Tasten mit `bild` zeigen ihren eigenen Ausschnitt aus dem Bild; `an` heisst:
//   im Bild leuchtet die Taste schon (aus = entsaettigt), sonst leuchtet sie per Glow.
// - Teile ohne Eintrag werden ausgeblendet; dort sieht man nur das Bild.

// Weitere Skins (21.10.2026): gleiche Oberflaeche in anderen Farben, mit Real-ESRGAN auf 4K
// gerechnet und pixelgenau auf Bild 2 ausgerichtet (alle Masse und Flicken hier gelten fuer alle).
// Auswahl per ?skin=<kuerzel>; ohne Angabe Bild 2.
export const SKINS = {
  'bild2': 'Bild 2 (Original)',
  'amber-blau': 'Amber-Blau Kristall', 'blau-amber': 'Blau-Amber Kristall', 'tiefglas': 'Blau-Amber Tiefglas',
  'gold': 'Gold', 'weiss': 'Schneeweiß', 'chrom': 'Chrom', 'ladys-tuerkis': 'Ladys Night Türkis',
  'elfenbein': 'Elfenbein', 'carbon': 'Carbon', 'ladys-pink': 'Ladys Night Pink', 'onyx': 'Onyx',
  'champagner': 'Champagner',
};
const SKIN_WAHL = (() => {
  const s = new URLSearchParams(location.search).get('skin');
  return s && s !== 'bild2' && Object.prototype.hasOwnProperty.call(SKINS, s) ? s : null;
})();
const BILD = SKIN_WAHL ? `img/skins/${SKIN_WAHL}.webp` : 'img/bild2-2x.webp';
const BILD_W = 1672;
export const F = 1920 / BILD_W;

// ---- Kanal 1 ----------------------------------------------------------------
const DECK_A = {
  rahmen: [18, 82, 524, 666],
  teile: [
    // Kopfzeile (INT = Tempo-Referenz fuer SYNC, wie die MASTER-Taste)
    ['.deck-kanal', [36, 91, 120, 24], { tv: [34, 88, 118, 28] }],
    ['.deck-kopf-rest > .taste:nth-of-type(1)', [320, 90, 49, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(2)', [380, 90, 48, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(3)', [437, 90, 52, 28], { bild: true, an: true }],
    ['.deck-kopf-rest > .taste.icon', [505, 91, 28, 26]],
    ['.deck-video .led', [297, 99, 10, 10]],
    // Titel
    ['.deck-cover', [29, 130, 97, 78], { tv: [29, 131, 104, 84] }],
    // Titel groesser (Wunsch 18.10.2026): 27 px statt 21 px, Kuenstler 20 px
    ['.deck-titel', [140, 129, 330, 31], { tv: [146, 127, 390, 46] }],
    ['.deck-kuenstler', [140, 160, 330, 22], { tv: [146, 168, 300, 33] }],
    ['.deck-meta', [140, 182, 270, 18], { tv: [146, 201, 255, 18] }],
    ['.herz', [479, 138, 22, 21]],
    ['.deck-info-icons > .taste:not(.herz)', [512, 138, 20, 23]],
    ['.deck-zeit', [404, 179, 124, 22], { tv: [404, 198, 128, 22] }],
    ['.deck-meldung', [140, 236, 290, 34]],
    // Wellenformen
    ['.deck-welle', [28, 212, 508, 84], { tv: [28, 228, 508, 68] }],
    ['.deck-ueber', [30, 297, 506, 20]],
    ['.welle-ueber', [30, 297, 506, 20]],
    ['.ueber-marke', [498, 299, 20, 16]],
    // Tempo-Zeile
    ['.tempo-feld.bpm', [28, 330, 100, 55]],
    ['.bpm-zahl', [36, 346, 92, 36]],
    ['.tempo-feld:not(.bpm):not(.key)', [130, 330, 85, 55]],
    ['.tempo-zahl', [143, 350, 72, 28]],
    ['.tv-mix', [226, 337, 148, 44]],   // mittig in der Mulde der Tasten (gemessen 21.10.)
    ['.bereich[data-b="6"]', [229, 345, 39, 27]],
    ['.bereich[data-b="10"]', [281, 345, 39, 27]],
    ['.bereich[data-b="16"]', [333, 345, 39, 27]],
    ['.tempo-feld.key', [383, 330, 52, 55]],
    ['.key-zahl', [395, 353, 40, 28]],
    ['.taste.sync', [442, 332, 59, 48], { bild: true, an: true, gross: 4 }],
    ['.link-status', [510, 348, 20, 20], { bild: true }],
    // Meter, Kanalfader
    ['.bereich-meter', [60, 405, 40, 262]],
    ['.deck-meter', [70.5, 428, 18.3, 234]],   // genau die zwei gemalten LED-Spalten (gemessen 21.10.)
    ['.clip-led', [70.5, 433, 18.3, 5]],
    ['.bereich-fader', [110, 405, 50, 252]],
    ['.kanalfader', [116, 412, 42, 242], { kappe: [115.5, 477.5, 43, 35.5] }],   // Kappe wie gemalt (gemessen 21.10.)
    // Knoepfe (Kappe dreht sich, Ruhestellung = Stellung im Bild)
    ['.bereich-knoepfe', [196, 398, 48, 256]],
    ['.knopf[aria-label="TRIM"]', [201, 403, 38, 38], { knopf: true }],
    ['.knopf[aria-label="HIGH"]', [201, 453, 38, 38], { knopf: true }],
    ['.knopf[aria-label="MID"]', [201, 506, 38, 38], { knopf: true }],
    ['.knopf[aria-label="LOW"]', [201, 558, 38, 38], { knopf: true }],
    ['.knopf[aria-label="FILTER"]', [201, 611, 38, 38], { knopf: true }],
    // Loop
    ['.bereich-loop', [302, 400, 214, 100]],
    ['.loop-n[data-n="32"]', [315, 426, 39, 28], { bild: true }],
    ['.loop-n[data-n="16"]', [367, 426, 45, 28], { bild: true, an: true }],
    ['.loop-n[data-n="8"]', [424, 426, 35, 28], { bild: true }],
    ['.loop-n[data-n="4"]', [470, 426, 35, 28], { bild: true }],
    ['.loop-io:nth-of-type(1)', [316, 465, 57, 27], { bild: true }],
    ['.loop-io:nth-of-type(2)', [382, 465, 55, 27], { bild: true }],
    ['.loop-aktiv', [447, 465, 58, 27], { bild: true, an: true }],
    // Jogwheel, Tempo
    ['.bereich-jog', [272, 492, 232, 228]],
    ['.jog', [276, 493, 224, 224], { jog: { teller: 92, cover: 31 } }],
    ['.jog-vinyl .led', [489, 530, 10, 10]],
    ['.bereich-tempo', [508, 555, 24, 110]],
    ['.temporegler', [511, 558, 18, 104]],
    // Unten
    ['.anz:nth-of-type(1)', [40, 703, 64, 14], { led: [44, 710] }],
    ['.anz:nth-of-type(2)', [56, 719, 56, 14], { led: [64, 726] }],
    ['.taste.cue', [146, 671, 114, 65], { bild: true }],
    ['.taste.play', [272, 684, 110, 52], { bild: true, an: true, gross: 5 }],
  ],
};

// Geputzte Stellen fuer Kanal 1: ziel <- quelle (gestreckt) oder ziel <- Farbe
const FLICKEN_A = [
  // DJ-Modus: Tasten +-6/10/16 weg (dort der Countdown MIX OUT / MIX IN)
  { ziel: [223, 340.5, 155, 38.5], fuellen: true, tv: true },   // glatt aus der Mulde (21.10.; vorher 2-px-Streifen gestreckt)
  // DJ-Modus: Herz und Menue-Punkte aus dem Bild weg (Platz fuer lange Titel)
  { ziel: [466, 130, 72, 36], quelle: [446, 130, 6, 36], tv: true },
  // Schriftzug "KANAL 1" weg: das Feld zeigt echten Text (Demo: KANAL 1, TV: ON AIR / NEXT)
  { ziel: [34, 88, 116, 28], quelle: [150, 88, 8, 28] },
  // Gemalte Faderkappe + Leuchtlinie (21.10.): nur dort, wo sie im Bild war. Der Schlitz wird
  // senkrecht ergaenzt (Linien laufen durch), links/rechts davon glatt aus allen Raendern gefuellt.
  { ziel: [122, 474, 27, 98], senk: true },
  { ziel: [112.5, 475, 9.5, 85], fuellen: 'r' },   // Raender ausserhalb von Kappe und Schatten
  { ziel: [149, 475, 13.5, 85], fuellen: 'l' },
  { ziel: [136, 134, 300, 46], quelle: [440, 134, 4, 46] },       // Titel, Interpret
  { ziel: [136, 179, 396, 22], quelle: [395, 179, 6, 22] },       // Genre/BPM/Key, Zeit
  { ziel: [25, 210, 514, 86], farbe: '#05070a' },             // Wellenform
  { ziel: [25, 296, 514, 25], farbe: '#05070a' },                   // Uebersicht + "16"
  { ziel: [34, 347, 84, 36], farbe: '#05080b' },              // BPM-Zahl
  { ziel: [140, 350, 68, 30], quelle: [208, 350, 3, 30] },        // Tempo-Zahl
  { ziel: [392, 354, 34, 26], quelle: [427, 354, 3, 26] },        // Key
  { ziel: [293, 95, 20, 18], quelle: [313, 95, 3, 18] },          // VIDEO-LED
  { ziel: [484, 529, 18, 14], quelle: [480, 529, 3, 14] },        // VINYL-LED am Jog
  { ziel: [57, 719, 14, 14], quelle: [52, 719, 3, 14] },          // VINYL-LED unten
  { ziel: [511, 558, 18, 104], farbe: '#07080a' },                // Tempo-LEDs
  { ziel: [433, 86, 60, 36], quelle: [376, 86, 56, 36] },         // QUANT-Schein
  { ziel: [363, 422, 53, 36], quelle: [311, 422, 47, 36] },       // Loop 16-Schein
  { ziel: [443, 461, 66, 35], quelle: [378, 461, 63, 35] },       // ACTIVE-Schein
];

// ---- Kanal 2 (Spiegelbild; Masse aus dem Bild, nicht gerechnet) -------------
const DECK_B = {
  rahmen: [1130, 82, 525, 666],
  teile: [
    ['.deck-kanal', [1145, 91, 120, 24], { tv: [1141, 86, 118, 30] }],   // Feld bis zum alten Rand, Schrift mittig etwas hoeher (Betreiber 21.10.)
    ['.deck-kopf-rest > .taste:nth-of-type(1)', [1428, 90, 49, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(2)', [1488, 90, 50, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(3)', [1549, 90, 54, 28], { bild: true, an: true }],
    ['.deck-kopf-rest > .taste.icon', [1613, 91, 28, 26]],
    ['.deck-video .led', [1399, 99, 10, 10]],
    ['.deck-cover', [1136, 130, 102, 78], { tv: [1136, 131, 108, 84] }],
    ['.deck-titel', [1253, 129, 320, 31], { tv: [1258, 127, 386, 46] }],
    ['.deck-kuenstler', [1253, 160, 320, 22], { tv: [1258, 168, 300, 33] }],
    ['.deck-meta', [1253, 182, 255, 18], { tv: [1258, 201, 248, 18] }],
    ['.herz', [1590, 138, 22, 21]],
    ['.deck-info-icons > .taste:not(.herz)', [1622, 138, 20, 23]],
    ['.deck-zeit', [1508, 179, 124, 22], { tv: [1508, 198, 128, 22] }],
    ['.deck-meldung', [1250, 236, 290, 34]],
    ['.deck-welle', [1136, 212, 508, 84], { tv: [1136, 228, 508, 68] }],
    ['.deck-ueber', [1139, 297, 504, 20]],
    ['.welle-ueber', [1139, 297, 504, 20]],
    ['.ueber-marke', [1585, 299, 22, 16]],
    ['.link-status', [1139, 348, 20, 20], { bild: true }],
    ['.taste.sync', [1169, 332, 60, 48], { bild: true, an: true, gross: 4 }],
    ['.tempo-feld.key', [1237, 330, 52, 55]],
    ['.key-zahl', [1250, 353, 40, 28]],
    ['.tv-mix', [1298, 337, 148, 44]],
    ['.bereich[data-b="16"]', [1298, 345, 40, 27]],
    ['.bereich[data-b="10"]', [1350, 345, 40, 27]],
    ['.bereich[data-b="6"]', [1402, 345, 40, 27]],
    ['.tempo-feld:not(.bpm):not(.key)', [1452, 330, 85, 55]],
    ['.tempo-zahl', [1465, 350, 72, 28]],
    ['.tempo-feld.bpm', [1542, 330, 102, 55]],
    ['.bpm-zahl', [1552, 346, 92, 36]],
    ['.bereich-loop', [1158, 400, 206, 100]],
    ['.loop-n[data-n="32"]', [1166, 426, 37, 28], { bild: true }],
    ['.loop-n[data-n="16"]', [1214, 426, 42, 28], { bild: true, an: true }],
    ['.loop-n[data-n="8"]', [1268, 426, 36, 28], { bild: true }],
    ['.loop-n[data-n="4"]', [1317, 426, 39, 28], { bild: true }],
    ['.loop-io:nth-of-type(1)', [1166, 465, 57, 27], { bild: true }],
    ['.loop-io:nth-of-type(2)', [1233, 465, 56, 27], { bild: true }],
    ['.loop-aktiv', [1299, 465, 57, 27], { bild: true, an: true }],
    ['.bereich-knoepfe', [1427, 398, 48, 256]],
    ['.knopf[aria-label="TRIM"]', [1432, 402, 38, 38], { knopf: true }],
    ['.knopf[aria-label="HIGH"]', [1432, 453, 38, 38], { knopf: true }],
    ['.knopf[aria-label="MID"]', [1432, 506, 38, 38], { knopf: true }],
    ['.knopf[aria-label="LOW"]', [1432, 558, 38, 38], { knopf: true }],
    ['.knopf[aria-label="FILTER"]', [1432, 611, 38, 38], { knopf: true }],
    ['.bereich-fader', [1510, 405, 52, 252]],
    ['.kanalfader', [1513, 412, 44, 242], { kappe: [1513, 477.5, 44, 35.5] }],
    ['.bereich-meter', [1574, 405, 40, 262]],
    ['.deck-meter', [1582.5, 428, 18.2, 234]],
    ['.clip-led', [1582.5, 433, 18.2, 5]],
    ['.bereich-jog', [1160, 492, 232, 228]],
    ['.jog', [1171, 493, 224, 224], { jog: { teller: 92, cover: 34 } }],   // Cover sitzt im Bild 7 px rechts der Ringmitte
    ['.jog-vinyl .led', [1172, 530, 10, 10]],
    ['.bereich-tempo', [1140, 555, 24, 110]],
    ['.temporegler', [1144, 558, 17, 104]],
    ['.anz:nth-of-type(1)', [1566, 704, 48, 28], { led: [1579.5, 726] }],
    ['.anz:nth-of-type(2)', [1597, 719, 13, 14], { led: [1603.5, 726] }],
    ['.taste.play', [1288, 684, 108, 52], { bild: true, an: true, gross: 5 }],
    ['.taste.cue', [1411, 671, 116, 65], { bild: true }],
  ],
};
const FLICKEN_B = [
  // DJ-Modus: Bereichstasten weg (siehe FLICKEN_A)
  { ziel: [1293.5, 340.5, 156, 38.5], fuellen: true, tv: true },
  // DJ-Modus: Herz und Menue-Punkte weg (siehe FLICKEN_A)
  { ziel: [1578, 130, 70, 36], quelle: [1560, 130, 6, 36], tv: true },
  // Schriftzug "KANAL 2" weg (siehe FLICKEN_A)
  { ziel: [1142, 88, 116, 28], quelle: [1312, 88, 6, 28] },   // Quelle in der Farbe des Hintergrunds (gemessen)
  // Play/Pause: in Bild 2 fehlt bei Kanal 2 der zweite Pause-Strich (nur "▶|") - beide Striche
  // aus dem vorhandenen nachmalen, Abstand wie bei Kanal 1 (18.10.2026)
  { ziel: [1347, 701, 4, 19], quelle: [1348, 701, 2, 19], taste: true },
  { ziel: [1354, 701, 4, 19], quelle: [1348, 701, 2, 19], taste: true },
  { ziel: [1521, 474, 26, 98], senk: true },                   // Faderkappe + Linie (siehe FLICKEN_A)
  { ziel: [1508.5, 475, 12.5, 85], fuellen: 'r' },
  { ziel: [1547, 475, 12.5, 85], fuellen: 'l' },
  { ziel: [1250, 134, 300, 46], quelle: [1560, 134, 4, 46] },
  { ziel: [1250, 179, 390, 22], quelle: [1495, 179, 6, 22] },
  { ziel: [1133, 210, 514, 86], farbe: '#05070a' },
  { ziel: [1131, 296, 517, 25], farbe: '#05070a' },
  { ziel: [1550, 348, 90, 35], farbe: '#05080b' },   // BPM-Zahl (Display ist in allen Skins dunkel)
  { ziel: [1462, 350, 68, 30], quelle: [1458, 350, 3, 30] },
  { ziel: [1247, 354, 34, 26], quelle: [1282, 354, 3, 26] },
  { ziel: [1394, 95, 22, 18], quelle: [1418, 95, 3, 18] },
  { ziel: [1166, 529, 18, 14], quelle: [1188, 529, 3, 14] },
  { ziel: [1572, 719, 40, 14], quelle: [1566, 719, 3, 14] },
  { ziel: [1143, 557, 19, 106], farbe: '#07080a' },
  { ziel: [1545, 86, 62, 36], quelle: [1484, 86, 58, 36] },
  { ziel: [1210, 422, 50, 36], quelle: [1162, 422, 45, 36] },
  { ziel: [1295, 461, 65, 35], quelle: [1229, 461, 64, 35] },
];

// ---- Mitte: Programmbild, Transport, Master, Crossfader ---------------------
const MITTE = {
  rahmen: [548, 82, 578, 668],
  teile: [
    ['.bildschirm', [557, 85, 557, 320]],
    ['.programm', [557, 85, 557, 298]],
    ['.link-ansicht', [566, 94, 539, 270]],
    ['.video-label', [566, 92, 330, 16]],
    ['.video-demo', [930, 92, 176, 16]],
    ['.video-zeit:nth-of-type(1)', [568, 366, 90, 20]],
    ['.video-zeit:nth-of-type(2)', [1012, 381, 90, 20]],
    ['.fortschritt', [566, 389, 486, 14]],
    ['.transport > .transport-gruppe:nth-child(1) > .taste:nth-child(1)', [561, 414, 42, 40]],
    ['.transport > .transport-gruppe:nth-child(1) > .taste:nth-child(2)', [612, 414, 46, 40]],
    ['.transport > .transport-gruppe:nth-child(1) > .taste:nth-child(3)', [658, 414, 38, 40]],
    ['.reiter[data-w="video"]', [720, 416, 58, 34], { bild: true, an: true }],
    ['.reiter[data-w="audio"]', [784, 416, 62, 34], { bild: true }],
    ['.reiter[data-w="fx"]', [850, 416, 62, 34], { bild: true }],
    ['.reiter[data-w="link"]', [916, 416, 62, 34], { bild: true }],
    ['.transport > .transport-gruppe:nth-child(3) > .taste:nth-child(1)', [1010, 414, 45, 41], { bild: true }],
    ['.transport > .transport-gruppe:nth-child(3) > .taste:nth-child(2)', [1065, 414, 44, 41], { bild: true }],
    ['.status-led.gelb', [770, 521, 36, 13]],
    ['.status-led.rot', [810, 521, 32, 13]],
    ['.master-meter', [590, 557, 245, 51]],
    // Master-Knopf (21.10.2026, Betreiber): bleibt wie im Bild gemalt, dreht sich nicht (css
    // .master-knopf). Vorher drehte ein Bildausschnitt [880, 563, 60, 60] - 3 Punkte zu tief, mit
    // schwarzem Ring und Glanzlichtern: helle Sicheln, versetzter Rand, Naht.
    ['.master-knopf .knopf', [883.5, 564, 52, 52], { knopf: true }],
    ['.gr-meter', [964, 541, 17.3, 103]],
    ['.breit[data-w="video"]', [1021, 546, 77, 29], { bild: true, an: true }],
    ['.breit[data-w="audio"]', [1021, 585, 77, 29], { bild: true }],
    ['.breit[data-w="auto"]', [1021, 623, 77, 28], { bild: true }],
    ['.xf-seite.kanal-a', [576, 687, 38, 38], { bild: true }],
    ['.xf-seite.kanal-b', [1059, 687, 37, 38], { bild: true }],
    ['.crossfader', [640, 682, 390, 50], { kappe: [813, 682, 41, 50] }],
  ],
};
const FLICKEN_MITTE = [
  { ziel: [621, 418, 30, 32], quelle: [654, 418, 3, 32] },          // Pause-Symbol
  { ziel: [557, 330, 557, 38], verlauf: ['rgba(3,4,10,0)', 'rgba(3,4,10,1)'] }, // Zeiten + Balken
  { ziel: [557, 368, 557, 36], farbe: 'rgb(3,4,10)' },
  { ziel: [715, 410, 68, 46], quelle: [781, 410, 68, 46] },         // VIDEO-Reiter-Schein
  { ziel: [588, 554, 250, 58], farbeVon: [586, 562] },              // Master-LEDs
  { ziel: [1015, 540, 89, 41], quelle: [1015, 579, 89, 41] },       // VIDEO/AUDIO-Schein
  { ziel: [800, 680, 70, 44], quelle: [700, 680, 70, 44] },         // Crossfader-Kappe: Schiene
  { ziel: [800, 724, 70, 15], quer: true },                          // ... Kappenfuss unter der Schiene (ueber dem Logo)
];

// ---- Kopfzeile ---------------------------------------------------------------
const KOPF = {
  rahmen: [0, 0, 1672, 78],
  teile: [
    ['.uhr-zeit', [1481, 9, 126, 32]],
    ['.uhr-datum', [1481, 43, 126, 17]],
    ['.kopf-feld.uhr .taste', [1611, 36, 26, 24]],
    ['.demo-badge', [1364, 52, 40, 14]],
  ],
};
const FLICKEN_KOPF = [
  { ziel: [1490, 8, 116, 54], quelle: [1484, 8, 3, 54] },           // Uhr + Datum
];

// ---- Naechste Titel ------------------------------------------------------------
// Die Karten sind im Bild nicht gleich breit; jede steht einzeln hier.
const KARTEN = [
  { nr: [23, 807, 32, 33], cover: [60, 809, 96, 87], text: 171, punkte: 286, x0: 23, x1: 296 },
  { nr: [302, 807, 31, 33], cover: [336, 809, 82, 87], text: 432, punkte: 553, x0: 302, x1: 564 },
  { nr: [570, 807, 31, 33], cover: [603, 809, 82, 87], text: 698, punkte: 822, x0: 570, x1: 833 },
  { nr: [840, 807, 31, 33], cover: [873, 809, 82, 87], text: 969, punkte: 1092, x0: 840, x1: 1103 },
  { nr: [1107, 807, 31, 33], cover: [1140, 809, 82, 87], text: 1235, punkte: 1358, x0: 1107, x1: 1370 },
  { nr: [1375, 807, 31, 33], cover: [1409, 809, 82, 87], text: 1506, punkte: 1637, x0: 1375, x1: 1648 },
];
const LEISTE = {
  rahmen: [10, 758, 1652, 150],
  teile: [
    ['.leiste-links > .taste', [23, 766, 44, 30], { bild: true }],
    ['.leiste-anzahl', [258, 770, 44, 24]],
    ['.leiste-rechts > .taste:nth-child(1)', [1338, 766, 43, 30], { bild: true }],
    ['.leiste-rechts > .taste:nth-child(2)', [1397, 766, 43, 30], { bild: true }],
    ['.leiste-rechts > .taste:nth-child(3)', [1455, 766, 129, 30], { bild: true }],
    ['.leiste-rechts > .taste:nth-child(4)', [1594, 766, 42, 30], { bild: true }],
    ...KARTEN.flatMap((k, i) => {
      const s = `.karte:nth-child(${i + 1})`, tw = k.punkte - k.text - 10;
      return [
        [s, [k.x0, 805, k.x1 - k.x0, 96]],
        [`${s} .karte-nr`, k.nr],
        [`${s} .karte-cover`, k.cover],
        [`${s} .karte-text`, [k.text, 815, tw, 80]],
        [`${s} .karte-titel`, [k.text, 815, tw, 20]],
        [`${s} .karte-kuenstler`, [k.text, 837, tw, 20]],
        [`${s} .karte-meta`, [k.text, 859, tw, 18]],
        [`${s} .karte-dauer`, [k.text, 878, tw, 18]],
        [`${s} .karte-menue`, [k.punkte - 8, 846, 17, 30]],
      ];
    }),
  ],
};
const FLICKEN_LEISTE = [
  { ziel: [255, 770, 44, 24], quer: true },                          // Anzahl: zeilenweise Verlauf links -> rechts
  ...KARTEN.flatMap(k => [
    { ziel: [k.nr[0] + 4, k.nr[1] + 5, k.nr[2] - 8, k.nr[3] - 10], quelle: [k.nr[0] + 3, k.nr[1] + 5, 1, k.nr[3] - 10] },
    { ziel: k.cover, farbe: '#07090c' },
    { ziel: [k.text - 2, 814, k.punkte - k.text - 8, 82], quelle: [k.punkte - 13, 814, 3, 82] },
  ]),
];

const TABELLE = { 'deck-a': DECK_A, 'deck-b': DECK_B, mitte: MITTE, kopf: KOPF, leiste: LEISTE };
// DJ-Modus (Betreiber 21.10.2026): Titelfeld groesser, Wellenfeld ~15 % schmaler. Titelfeld dunkel
// verlaengern bis an die Welle; feine Trennlinie per CSS (skin.css).
const FLICKEN_TV_TITEL = [
  // durchgehend dunkel bis zur Welle (die versetzte Trennlinie wirkte wie eine Luecke, 21.10.)
  { ziel: [25, 128, 514, 100], farbe: '#05070a', tv: true },
  { ziel: [1131, 128, 517, 100], farbe: '#05070a', tv: true },
  // VIDEO-LED: eckigen Flicken wieder aufheben - die runde Fassung (skin.css) deckt die gemalte LED ab
  { ziel: [293, 95, 20, 18], quelle: [293, 95, 20, 18], tv: true },
  { ziel: [1394, 95, 22, 18], quelle: [1394, 95, 22, 18], tv: true },
];
const FLICKEN = [...FLICKEN_A, ...FLICKEN_B, ...FLICKEN_MITTE, ...FLICKEN_KOPF, ...FLICKEN_LEISTE, ...FLICKEN_TV_TITEL];

const px = v => (v * F).toFixed(2) + 'px';
const groesser = (r, g) => [r[0] - g, r[1] - g, r[2] + 2 * g, r[3] + 2 * g];

function bildAusschnitt(el, r) {
  el.style.setProperty('--bx', px(-r[0]));
  el.style.setProperty('--by', px(-r[1]));
}

// VIDEO-LED: Lage der gemalten LED je Skin (Mitte in Bild-Pixeln, gemessen 21.10.2026) -
// die echte LED sitzt genau darauf. Ohne Eintrag wie Bild 2: A (302, 104), B (1404, 104).
const LED_LAGE = {
  'amber-blau': { A: [299.3, 102.8], B: [1398, 103] },
  'blau-amber': { A: [299.3, 103.7], B: [1399.2, 104] },
  'chrom': { A: [301, 106.2], B: [1402.5, 106.2] },
  'tiefglas': { B: [1403, 104] },
};
// BEAT GRID / VINYL: in Chrom sind die LEDs anders gemalt (gemessen 21.10.2026: A 70/723,5,
// B 1571 und 1595,5/723,5 statt 64/726 bzw. 1579,5 und 1603,5/726) - LEDs und Abdeck-Flicken
// dorthin. Alle anderen Skins liegen wie Bild 2 (Abweichung unter 1,5 Punkte).
const ANZ_LAGE = {
  'chrom': { A: [6, -2.5], B: [-8.25, -2.5], fA: [62, 715.5, 16, 16], fB: [1561, 715, 45, 17] },
};
function anzLagen() {
  const l = ANZ_LAGE[SKIN_WAHL];
  if (!l) return;
  for (const [deck, t, nur] of [['A', DECK_A, '.anz:nth-of-type(2)'], ['B', DECK_B, null]]) {
    const [dx, dy] = l[deck];
    for (const e of t.teile) {
      if (!e[0].startsWith('.anz') || (nur && e[0] !== nur)) continue;
      e[1] = [e[1][0] + dx, e[1][1] + dy, e[1][2], e[1][3]];
      if (e[2] && e[2].led) e[2] = { ...e[2], led: [e[2].led[0] + dx, e[2].led[1] + dy] };
    }
  }
  for (const [f, alt] of [[l.fA, FLICKEN_A.find(x => x.ziel[0] === 57 && x.ziel[1] === 719)],
                          [l.fB, FLICKEN_B.find(x => x.ziel[0] === 1572 && x.ziel[1] === 719)]]) {
    if (!alt) continue;
    alt.ziel = f.slice(0, 4);
    delete alt.quelle;                 // glatt auffuellen statt Streifen strecken (sonst Kasten)
    alt.fuellen = true;
  }
}
function ledLagen() {
  anzLagen();
  const l = LED_LAGE[SKIN_WAHL];
  if (!l) return;
  for (const [deck, t] of [['A', DECK_A], ['B', DECK_B]]) {
    const e = t.teile.find(x => x[0] === '.deck-video .led');
    if (e && l[deck]) e[1] = [l[deck][0] - 5, l[deck][1] - 5, 10, 10];
  }
}

// Pegelmeter je Skin (gemessen 21.10. in den Bildern): A/B = Innenkante des schwarzen Kanal-Gehaeuses
// [links, oben, rechts, unten]; M = gemaltes Master-Raster [x, y, b, h, Zeilenluecke, Kanalluecke,
// Lueckenanteil] mit 25 Spalten; G = Gehaeuse der GR-/Pegelsaeule (wie A/B). Das Kanal-Meter deckt das ganze Gehaeuse ab (die gemalten LEDs
// sind unregelmaessig) und zeichnet seine 30 LEDs genau mittig; der Master liegt auf dem Raster.
const METER_LAGE = {
  'bild2': { A: [66.96, 423.61, 92.51, 667.04], B: [1579.24, 423.61, 1604.65, 667.1], M: [591.1, 557.9, 243.11, 51.26, 2.93, 12.89, 0.188], G: [961.38, 540.0, 984.88, 645.5] },
  'amber-blau': { A: [68.28, 424.37, 93.53, 666.76], B: [1577.55, 424.68, 1604.06, 667.73], M: [590.06, 556.71, 246.99, 52.64, 3.98, 12.24, 0.231], G: [961.0, 539.18, 983.05, 647.57] },
  'blau-amber': { A: [66.19, 423.81, 94.2, 666.6], B: [1576.46, 423.17, 1604.95, 667.34], M: [590.45, 556.95, 245.38, 52.96, 2.82, 11.7, 0.192], G: [960.92, 540.6, 984.77, 648.64] },
  'tiefglas': { A: [65.99, 424.22, 93.48, 664.7], B: [1577.32, 423.65, 1604.56, 664.82], M: [590.65, 556.5, 244.28, 53.07, 2.98, 11.0, 0.169], G: [960.78, 540.49, 985.01, 647.78] },
  'gold': { A: [66.7, 424.7, 92.81, 665.42], B: [1578.47, 424.61, 1604.49, 665.78], M: [590.75, 557.47, 244.89, 52.08, 2.62, 11.65, 0.188], G: [960.7, 541.19, 983.94, 648.21] },
  'weiss': { A: [67.3, 424.91, 92.91, 665.34], B: [1578.98, 425.15, 1604.47, 665.57], M: [590.98, 557.43, 244.24, 52.01, 2.84, 11.76, 0.192], G: [960.96, 540.77, 984.35, 647.5] },
  'chrom': { A: [67.14, 424.84, 92.69, 663.65], B: [1576.71, 424.88, 1603.52, 664.05], M: [589.98, 554.64, 245.3, 55.15, 3.01, 11.02, 0.206], G: [962.22, 541.1, 985.61, 648.59] },
  'ladys-tuerkis': { A: [67.04, 424.84, 93.11, 665.56], B: [1578.83, 425.0, 1604.77, 666.01], M: [590.8, 557.25, 244.81, 52.08, 2.65, 11.65, 0.19], G: [960.68, 540.79, 984.24, 647.79] },
  'elfenbein': { A: [67.12, 425.24, 93.04, 665.88], B: [1578.57, 424.75, 1604.4, 665.59], M: [591.02, 557.56, 244.56, 52.04, 2.75, 11.47, 0.202], G: [960.48, 541.1, 984.23, 647.92] },
  'carbon': { A: [65.76, 424.31, 93.18, 667.2], B: [1578.31, 423.83, 1605.15, 666.89], M: [590.58, 557.34, 244.31, 52.28, 2.63, 11.52, 0.169], G: [960.85, 540.09, 984.33, 648.22] },
  'ladys-pink': { A: [66.56, 424.72, 92.78, 666.23], B: [1578.36, 424.64, 1604.28, 666.11], M: [590.74, 557.44, 244.47, 52.15, 2.6, 11.73, 0.18], G: [960.86, 541.22, 983.85, 647.99] },
  'onyx': { A: [68.24, 425.01, 93.09, 667.75], B: [1579.48, 424.97, 1604.31, 667.74], M: [590.38, 557.1, 245.7, 52.08, 2.78, 11.39, 0.199], G: [961.26, 541.22, 983.66, 649.59] },
  'champagner': { A: [66.79, 424.69, 93.04, 665.43], B: [1578.61, 424.64, 1604.47, 665.57], M: [590.64, 557.39, 244.29, 52.16, 2.61, 11.45, 0.155], G: [960.79, 541.1, 983.95, 647.79] },
};
const METER_GRUND = '#060606', LED_BREITE = 18.3, GR_BREITE = 16.2, CLIP_H = 3, CLIP_ABSTAND = 1.8;
const meterDaten = new Map();   // Teil-Tabelle -> data-lage fuer den Canvas
function meterLagen() {
  const m = METER_LAGE[SKIN_WAHL || 'bild2'];
  for (const [deck, t] of [['A', DECK_A], ['B', DECK_B]]) {
    const [l, o, r, u] = m[deck];
    // Canvas 0,6 px innerhalb der Gehaeusekante (Rundung bleibt gemalt), LEDs mit gleichem Rand ringsum
    const x = l + 0.6, y = o + 0.6, b = r - l - 1.2, h = u - o - 1.2, rand = (b - LED_BREITE) / 2;
    t.teile.find(e => e[0] === '.deck-meter')[1] = [x, y, b, h];
    t.teile.find(e => e[0] === '.clip-led')[1] = [x + rand, y + rand, LED_BREITE, CLIP_H];
    meterDaten.set(t, { rand: [rand, rand + CLIP_H + CLIP_ABSTAND, rand, rand], grund: METER_GRUND, radius: 3, luecke: 0.2 });
  }
  const [x, y, b, h, zl, kl, lu] = m.M;
  MITTE.teile.find(e => e[0] === '.master-meter')[1] = [x, y, b, h];
  meterDaten.set(MITTE, { grund: METER_GRUND, zeilenLuecke: zl, kanalLuecke: kl, luecke: lu });
  const [gl, go, gr, gu] = m.G, gb = gr - gl - 1.2;
  MITTE.teile.find(e => e[0] === '.gr-meter')[1] = [gl + 0.6, go + 0.6, gb, gu - go - 1.2];
  grDaten = { rand: (gb - GR_BREITE) / 2, spalte: 2.4, grund: METER_GRUND, radius: 2.5 };
}
let grDaten = null;

export function skinAnwenden() {
  ledLagen();
  meterLagen();
  const buehne = document.getElementById('buehne');
  buehne.classList.add('skin');
  // anderer Skin: dasselbe Bild auch fuer Knopf- und Faderkappen (CSS-Variable --bild)
  // absolute Adresse: url() in einer CSS-Variablen gilt relativ zur CSS-Datei (css/), nicht zur Seite
  if (SKIN_WAHL) { buehne.style.setProperty('--bild', `url(${new URL(BILD, location.href).href})`); buehne.dataset.skin = SKIN_WAHL; }
  for (const sek of buehne.children) {
    if (sek.tagName !== 'SECTION' && sek.tagName !== 'HEADER') continue;
    sek.classList.add('sektion');
    const t = TABELLE[sek.id];
    if (!t) { sek.classList.add('sektion-leer'); continue; }
    sektionAnwenden(sek, t);
    const md = meterDaten.get(t), mc = md && sek.querySelector('.deck-meter, .master-meter');
    if (mc) mc.dataset.lage = JSON.stringify(md);
    const gc = t === MITTE && grDaten && sek.querySelector('.gr-meter');
    if (gc) gc.dataset.lage = JSON.stringify(grDaten);
  }
  // Die Karten der Leiste werden bei jeder Aenderung neu gebaut -> neu einpassen
  const karten = document.querySelector('#leiste .leiste-karten');
  if (karten) new MutationObserver(() => sektionAnwenden(document.getElementById('leiste'), LEISTE)).observe(karten, { childList: true });
  putzen(buehne);
}

function sektionAnwenden(root, t) {
  const rects = new Map([[root, { r: t.rahmen, o: {} }]]);
  for (const [sel, r, o = {}] of t.teile) {
    const el = root.querySelector(sel);
    if (!el) { if (!sel.includes('.karte')) console.warn('[Skin] nicht gefunden:', sel); continue; }
    const rr = o.tv && document.body.classList.contains('tv') ? o.tv : r;   // DJ-Modus: eigene Lage
    rects.set(el, { r: o.gross ? groesser(rr, o.gross) : rr, o });
  }
  const gemappt = [...rects.keys()];
  const enthaeltGemapptes = el => gemappt.some(m => m !== el && el.contains(m));
  // Einteilen: gemappt / Huelle um Gemapptes / Inhalt eines gemappten Endteils / weg.
  // Inhalt bleibt nur in Endteilen sichtbar (z. B. Spans der Meta-Zeile); in
  // Behaeltern mit eigenen gemappten Teilen (z. B. BPM-Feld) zeigt das Bild die Beschriftung.
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    el.classList.remove('sk', 'sk-flach', 'sk-weg');
    if (rects.has(el)) { el.classList.add('sk'); continue; }
    if (enthaeltGemapptes(el)) { el.classList.add('sk-flach'); continue; }
    let p = el.parentElement;
    while (p && !rects.has(p)) p = p.parentElement;
    if (!p || p === root || enthaeltGemapptes(p)) el.classList.add('sk-weg');
  }
  // Positionieren relativ zum naechsten gemappten Vorfahren
  for (const [el, { r, o }] of rects) {
    let p = el === root ? null : el.parentElement;
    while (p && !rects.has(p)) p = p.parentElement;
    const u = p ? rects.get(p).r : [0, 0];
    Object.assign(el.style, { left: px(r[0] - u[0]), top: px(r[1] - u[1]), width: px(r[2]), height: px(r[3]) });
    if (o.bild) { el.classList.add('sk-bild'); bildAusschnitt(el, r); if (o.an) el.classList.add('sk-an'); }
    if (o.knopf) {
      bildAusschnitt(el, r);
      // Ruhestellung = Zeigerstellung im Bild (12 Uhr)
      const W = 135, min = +el.getAttribute('aria-valuemin'), max = +el.getAttribute('aria-valuemax'), ruhe = +el.dataset.ruhe;
      el.querySelector('.knopf-kappe').style.transform = `rotate(${-(-W + (ruhe - min) / (max - min) * 2 * W)}deg)`;
    }
    if (o.kappe) {
      const k = el.querySelector('.regler-kappe');
      bildAusschnitt(k, o.kappe);
      el.style.setProperty('--kw', px(o.kappe[2]));
      el.style.setProperty('--kh', px(o.kappe[3]));
    }
    if (o.jog) {
      el.style.setProperty('--teller', px(o.jog.teller * 2));
      el.style.setProperty('--cover', px(o.jog.cover * 2));
    }
    if (o.led) {   // LED im Taster: Mitte in Bild-Pixeln
      const led = el.querySelector('.led'), d = 10;
      Object.assign(led.style, { left: px(o.led[0] - d / 2 - r[0]), top: px(o.led[1] - d / 2 - r[1]), width: px(d), height: px(d) });
    }
  }
}

// Bereich glatt aus den Raendern fuellen (Laplace): erst senkrechter Verlauf, dann so lange glaetten,
// bis jeder Punkt dem Mittel seiner Nachbarn entspricht - gleicht oben/unten und links/rechts aus.
// ohne = 'l' | 'r': diese Seite (Schlitzkante) zaehlt nicht als Rand, sonst wischt ihr Dunkel herein.
function fuellen(g, x, y, w, h, ohne) {
  const d = g.getImageData(x - 1, y - 1, w + 2, h + 2), p = d.data, W = w + 2;
  for (let k = 0; k < 3; k++) {
    const f = new Float32Array(W * (h + 2));
    for (let j = 0; j < h + 2; j++) for (let i = 0; i < W; i++) f[j * W + i] = p[(j * W + i) * 4 + k];
    for (let j = 1; j <= h; j++) for (let i = 1; i <= w; i++) {
      const b = j / (h + 1);
      f[j * W + i] = (1 - b) * f[i] + b * f[(h + 1) * W + i];
    }
    for (let n = 0; n < 600; n++) {
      for (let j = 1; j <= h; j++) for (let i = 1; i <= w; i++) {
        const q = j * W + i;
        const l = i === 1 && ohne === 'l' ? f[q] : f[q - 1], r = i === w && ohne === 'r' ? f[q] : f[q + 1];
        f[q] = (l + r + f[q - W] + f[q + W]) / 4;
      }
    }
    for (let j = 1; j <= h; j++) for (let i = 1; i <= w; i++) p[(j * W + i) * 4 + k] = f[j * W + i];
  }
  g.putImageData(d, x - 1, y - 1);
}

// Skins mit senkrechten Streifen im Hintergrund: dort Flaechen senkrecht verlaufen statt glatt fuellen
const STREIFEN_SKINS = ['bild2', 'chrom', 'carbon'];

// Geputztes Buehnenbild erzeugen (einmal beim Start, im Browser)
async function putzen(buehne) {
  const img = new Image();
  img.src = BILD;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const roh = g.getImageData(0, 0, c.width, c.height).data;
  const s = c.width / BILD_W;      // Masse sind in Original-Pixeln
  const farbe = ([x, y]) => { const i = (Math.round(y * s) * c.width + Math.round(x * s)) * 4; return `rgb(${roh[i]},${roh[i + 1]},${roh[i + 2]})`; };
  const tv = document.body.classList.contains('tv');
  for (const f of FLICKEN) {
    if (f.tv && !tv) continue;               // nur im DJ-Modus
    const [x, y, w, h] = f.ziel.map(v => v * s);
    if (f.quer) {
      // zeilenweise von der Farbe links des Bereichs zur Farbe rechts davon (fuer Verlaeufe im Hintergrund)
      for (let yy = Math.floor(y); yy < y + h; yy++) {
        const pix = xx => { const i = (yy * c.width + Math.round(xx)) * 4; return `rgb(${roh[i]},${roh[i + 1]},${roh[i + 2]})`; };
        const v = g.createLinearGradient(x, 0, x + w, 0);
        v.addColorStop(0, pix(x - 2)); v.addColorStop(1, pix(x + w + 1));
        g.fillStyle = v; g.fillRect(x, yy, w, 1);
      }
    } else if (f.fuellen && !STREIFEN_SKINS.includes(SKIN_WAHL || 'bild2')) {
      fuellen(g, Math.floor(x), Math.floor(y), Math.ceil(x + w) - Math.floor(x), Math.ceil(y + h) - Math.floor(y), f.fuellen);
    } else if (f.senk || f.fuellen) {   // fuellen bei Streifen-Skins: senkrecht, die Streifen laufen durch
      // spaltenweise von der Farbe ueber dem Bereich zur Farbe darunter (Glanz/Verlauf bleibt stimmig)
      for (let xx = Math.floor(x); xx < x + w; xx++) {
        const pix = yy => { const i = (Math.round(yy) * c.width + xx) * 4; return `rgb(${roh[i]},${roh[i + 1]},${roh[i + 2]})`; };
        const v = g.createLinearGradient(0, y, 0, y + h);
        v.addColorStop(0, pix(y - 2)); v.addColorStop(1, pix(y + h + 1));
        g.fillStyle = v; g.fillRect(xx, y, 1, h);
      }
    } else if (f.quelle) g.drawImage(img, ...f.quelle.map(v => v * s), x, y, w, h);
    else if (f.verlauf) {
      const v = g.createLinearGradient(0, y, 0, y + h);
      v.addColorStop(0, f.verlauf[0]); v.addColorStop(1, f.verlauf[1]);
      g.fillStyle = v; g.fillRect(x, y, w, h);
    } else { g.fillStyle = f.farbe || farbe(f.farbeVon); g.fillRect(x, y, w, h); }
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  buehne.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  buehne.classList.add('geputzt');
  // Tasten schneiden ihr Bild aus dem Original; nur die Taste-Flicken dort einsetzen
  // (das ganz geputzte Bild taugt nicht: darin fehlen z. B. die Faderkappen).
  g.drawImage(img, 0, 0);
  for (const f of FLICKEN.filter(f => f.taste)) g.drawImage(img, ...f.quelle.map(v => v * s), ...f.ziel.map(v => v * s));
  const tasten = await new Promise(r => c.toBlob(r, 'image/png'));
  buehne.style.setProperty('--bild-tasten', `url(${URL.createObjectURL(tasten)})`);
}
