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

const BILD = 'img/bild2-2x.webp';
const BILD_W = 1672;
export const F = 1920 / BILD_W;

// ---- Kanal 1 ----------------------------------------------------------------
const DECK_A = {
  rahmen: [18, 82, 524, 666],
  teile: [
    // Kopfzeile (INT = Tempo-Referenz fuer SYNC, wie die MASTER-Taste)
    ['.deck-kanal', [36, 91, 120, 24]],
    ['.deck-kopf-rest > .taste:nth-of-type(1)', [320, 90, 49, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(2)', [380, 90, 48, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(3)', [437, 90, 52, 28], { bild: true, an: true }],
    ['.deck-kopf-rest > .taste.icon', [505, 91, 28, 26]],
    ['.deck-video .led', [297, 99, 10, 10]],
    // Titel
    ['.deck-cover', [29, 130, 97, 78]],
    // Titel groesser (Wunsch 18.10.2026): 27 px statt 21 px, Kuenstler 20 px
    ['.deck-titel', [140, 129, 330, 31], { tv: [140, 126, 392, 37] }],
    ['.deck-kuenstler', [140, 160, 330, 22], { tv: [140, 164, 300, 23] }],
    ['.deck-meta', [140, 182, 270, 18], { tv: [140, 187, 262, 18] }],
    ['.herz', [479, 138, 22, 21]],
    ['.deck-info-icons > .taste:not(.herz)', [512, 138, 20, 23]],
    ['.deck-zeit', [404, 179, 124, 22], { tv: [404, 185, 124, 22] }],
    ['.deck-meldung', [140, 236, 290, 34]],
    // Wellenformen
    ['.deck-welle', [28, 212, 508, 84]],
    ['.deck-ueber', [30, 297, 506, 20]],
    ['.welle-ueber', [30, 297, 506, 20]],
    ['.ueber-marke', [498, 299, 20, 16]],
    // Tempo-Zeile
    ['.tempo-feld.bpm', [28, 330, 100, 55]],
    ['.bpm-zahl', [36, 346, 92, 36]],
    ['.tempo-feld:not(.bpm):not(.key)', [130, 330, 85, 55]],
    ['.tempo-zahl', [143, 350, 72, 28]],
    ['.tv-mix', [226, 336, 148, 44]],
    ['.bereich[data-b="6"]', [229, 345, 39, 27]],
    ['.bereich[data-b="10"]', [281, 345, 39, 27]],
    ['.bereich[data-b="16"]', [333, 345, 39, 27]],
    ['.tempo-feld.key', [383, 330, 52, 55]],
    ['.key-zahl', [395, 353, 40, 28]],
    ['.taste.sync', [442, 332, 59, 48], { bild: true, an: true, gross: 4 }],
    ['.link-status', [510, 348, 20, 20], { bild: true }],
    // Meter, Kanalfader
    ['.bereich-meter', [60, 405, 40, 262]],
    ['.deck-meter', [66, 428, 28, 234]],
    ['.clip-led', [71, 433, 18, 5]],
    ['.bereich-fader', [110, 405, 50, 252]],
    ['.kanalfader', [116, 412, 42, 242], { kappe: [115, 477, 41, 35] }],
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
  { ziel: [224, 343, 152, 34], quelle: [275, 343, 2, 34], tv: true },
  // DJ-Modus: Herz und Menue-Punkte aus dem Bild weg (Platz fuer lange Titel)
  { ziel: [466, 130, 72, 36], quelle: [446, 130, 6, 36], tv: true },
  // Schriftzug "KANAL 1" weg: das Feld zeigt echten Text (Demo: KANAL 1, TV: ON AIR / NEXT)
  { ziel: [34, 88, 116, 28], quelle: [150, 88, 8, 28] },
  { ziel: [112, 432, 46, 140], quelle: [112, 572, 46, 60] },      // Faderkappe + blaue Linie
  { ziel: [136, 134, 300, 46], quelle: [440, 134, 4, 46] },       // Titel, Interpret
  { ziel: [136, 179, 396, 22], quelle: [395, 179, 6, 22] },       // Genre/BPM/Key, Zeit
  { ziel: [28, 213, 508, 82], farbe: '#05070a' },             // Wellenform
  { ziel: [28, 296, 510, 22], farbe: '#05070a' },                   // Uebersicht + "16"
  { ziel: [34, 347, 84, 36], quelle: [119, 347, 4, 36] },         // BPM-Zahl
  { ziel: [140, 350, 68, 30], quelle: [208, 350, 3, 30] },        // Tempo-Zahl
  { ziel: [392, 354, 34, 26], quelle: [427, 354, 3, 26] },        // Key
  { ziel: [66, 427, 28, 236], farbe: '#06080b' },                 // Pegel-LEDs
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
    ['.deck-kanal', [1145, 91, 120, 24]],
    ['.deck-kopf-rest > .taste:nth-of-type(1)', [1428, 90, 49, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(2)', [1488, 90, 50, 28], { bild: true }],
    ['.deck-kopf-rest > .taste:nth-of-type(3)', [1549, 90, 54, 28], { bild: true, an: true }],
    ['.deck-kopf-rest > .taste.icon', [1613, 91, 28, 26]],
    ['.deck-video .led', [1399, 99, 10, 10]],
    ['.deck-cover', [1136, 130, 102, 78]],
    ['.deck-titel', [1253, 129, 320, 31], { tv: [1253, 126, 390, 37] }],
    ['.deck-kuenstler', [1253, 160, 320, 22], { tv: [1253, 164, 300, 23] }],
    ['.deck-meta', [1253, 182, 255, 18], { tv: [1253, 187, 252, 18] }],
    ['.herz', [1590, 138, 22, 21]],
    ['.deck-info-icons > .taste:not(.herz)', [1622, 138, 20, 23]],
    ['.deck-zeit', [1508, 179, 124, 22], { tv: [1508, 185, 124, 22] }],
    ['.deck-meldung', [1250, 236, 290, 34]],
    ['.deck-welle', [1136, 212, 508, 84]],
    ['.deck-ueber', [1139, 297, 504, 20]],
    ['.welle-ueber', [1139, 297, 504, 20]],
    ['.ueber-marke', [1585, 299, 22, 16]],
    ['.link-status', [1139, 348, 20, 20], { bild: true }],
    ['.taste.sync', [1169, 332, 60, 48], { bild: true, an: true, gross: 4 }],
    ['.tempo-feld.key', [1237, 330, 52, 55]],
    ['.key-zahl', [1250, 353, 40, 28]],
    ['.tv-mix', [1296, 336, 148, 44]],
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
    ['.kanalfader', [1514, 412, 44, 242], { kappe: [1514, 477, 43, 35] }],
    ['.bereich-meter', [1574, 405, 40, 262]],
    ['.deck-meter', [1580, 428, 27, 234]],
    ['.clip-led', [1584, 433, 18, 5]],
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
  { ziel: [1294, 343, 152, 34], quelle: [1344, 343, 2, 34], tv: true },
  // DJ-Modus: Herz und Menue-Punkte weg (siehe FLICKEN_A)
  { ziel: [1578, 130, 70, 36], quelle: [1560, 130, 6, 36], tv: true },
  // Schriftzug "KANAL 2" weg (siehe FLICKEN_A)
  { ziel: [1142, 88, 116, 28], quelle: [1312, 88, 6, 28] },   // Quelle in der Farbe des Hintergrunds (gemessen)
  // Play/Pause: in Bild 2 fehlt bei Kanal 2 der zweite Pause-Strich (nur "▶|") - beide Striche
  // aus dem vorhandenen nachmalen, Abstand wie bei Kanal 1 (18.10.2026)
  { ziel: [1347, 701, 4, 19], quelle: [1348, 701, 2, 19], taste: true },
  { ziel: [1354, 701, 4, 19], quelle: [1348, 701, 2, 19], taste: true },
  { ziel: [1510, 432, 52, 140], quelle: [1510, 572, 52, 60] },
  { ziel: [1250, 134, 300, 46], quelle: [1560, 134, 4, 46] },
  { ziel: [1250, 179, 390, 22], quelle: [1495, 179, 6, 22] },
  { ziel: [1136, 213, 508, 82], farbe: '#05070a' },
  { ziel: [1134, 296, 512, 22], farbe: '#05070a' },
  { ziel: [1550, 348, 90, 35], quelle: [1545, 348, 3, 35] },
  { ziel: [1462, 350, 68, 30], quelle: [1458, 350, 3, 30] },
  { ziel: [1247, 354, 34, 26], quelle: [1282, 354, 3, 26] },
  { ziel: [1579, 427, 29, 236], farbe: '#06080b' },
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
    ['.master-knopf .knopf', [880, 563, 60, 60], { knopf: true }],
    ['.gr-meter', [963, 541, 22, 103]],
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
  { ziel: [962, 538, 24, 108], farbe: '#07090c' },                  // GR-LEDs
  { ziel: [1015, 540, 89, 41], quelle: [1015, 579, 89, 41] },       // VIDEO/AUDIO-Schein
  { ziel: [800, 680, 70, 56], quelle: [700, 680, 70, 56] },         // Crossfader-Kappe
];

// ---- Kopfzeile ---------------------------------------------------------------
const KOPF = {
  rahmen: [0, 0, 1672, 78],
  teile: [
    ['.uhr-zeit', [1488, 9, 104, 32]],
    ['.uhr-datum', [1488, 43, 124, 17]],
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
  { ziel: [255, 770, 44, 24], quelle: [303, 770, 3, 24] },          // Anzahl
  ...KARTEN.flatMap(k => [
    { ziel: [k.nr[0] + 4, k.nr[1] + 5, k.nr[2] - 8, k.nr[3] - 10], quelle: [k.nr[0] + 3, k.nr[1] + 5, 1, k.nr[3] - 10] },
    { ziel: k.cover, farbe: '#07090c' },
    { ziel: [k.text - 2, 814, k.punkte - k.text - 8, 82], quelle: [k.punkte - 13, 814, 3, 82] },
  ]),
];

const TABELLE = { 'deck-a': DECK_A, 'deck-b': DECK_B, mitte: MITTE, kopf: KOPF, leiste: LEISTE };
const FLICKEN = [...FLICKEN_A, ...FLICKEN_B, ...FLICKEN_MITTE, ...FLICKEN_KOPF, ...FLICKEN_LEISTE];

const px = v => (v * F).toFixed(2) + 'px';
const groesser = (r, g) => [r[0] - g, r[1] - g, r[2] + 2 * g, r[3] + 2 * g];

function bildAusschnitt(el, r) {
  el.style.setProperty('--bx', px(-r[0]));
  el.style.setProperty('--by', px(-r[1]));
}

export function skinAnwenden() {
  const buehne = document.getElementById('buehne');
  buehne.classList.add('skin');
  for (const sek of buehne.children) {
    if (sek.tagName !== 'SECTION' && sek.tagName !== 'HEADER') continue;
    sek.classList.add('sektion');
    const t = TABELLE[sek.id];
    if (!t) { sek.classList.add('sektion-leer'); continue; }
    sektionAnwenden(sek, t);
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
    if (f.quelle) g.drawImage(img, ...f.quelle.map(v => v * s), x, y, w, h);
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
