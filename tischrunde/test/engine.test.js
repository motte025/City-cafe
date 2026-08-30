/*
 * Regel-Checks fuer Hos'n Obe.   Aufruf:  node tischrunde/test/engine.test.js
 *
 * Geprueft wird unter anderem jede der 4960 moeglichen Haende und eine grosse
 * Zahl zufaelliger Runden.
 */
'use strict';

var E = require('../hosn-obe/hosnobe-engine.js');

var checks = 0, failures = [];

function ok(condition, label) {
    checks++;
    if (!condition) failures.push(label);
}

function equal(actual, expected, label) {
    checks++;
    if (actual !== expected) failures.push(label + ' — erwartet ' + expected + ', bekommen ' + actual);
}

function section(name) { process.stdout.write('\n  ' + name + '\n'); }

/* --- Blatt ------------------------------------------------------------- */

section('Blatt');

var deck = E.buildDeck();
equal(deck.length, 32, '32er-Blatt');
equal(new Set(deck).size, 32, 'keine Karte doppelt');
ok(deck.every(E.isCard), 'alle Kennungen gueltig');
equal(deck.filter(function (c) { return E.cardSuit(c) === 'H'; }).length, 8, 'acht Herz');

var valueSum = deck.reduce(function (a, c) { return a + E.cardValue(c); }, 0);
equal(valueSum, 4 * (7 + 8 + 9 + 10 + 10 + 10 + 10 + 11), 'Kartenwerte je Farbe 75');
equal(E.cardValue('HA'), 11, 'Ass zaehlt 11');
equal(E.cardValue('HK'), 10, 'Koenig zaehlt 10');
equal(E.cardValue('HJ'), 10, 'Bube zaehlt 10');
equal(E.cardValue('H7'), 7, 'Sieben zaehlt 7');

/* --- Alle 4960 Haende --------------------------------------------------- */

section('Alle 4960 Haende');

var allHands = [];
for (var a = 0; a < 32; a++) {
    for (var b = a + 1; b < 32; b++) {
        for (var c = b + 1; c < 32; c++) allHands.push([deck[a], deck[b], deck[c]]);
    }
}
equal(allHands.length, 4960, 'Anzahl moeglicher Haende');

var fireHands = [], tripsHands = [], minPoints = 99, maxPoints = -1;
var badFire = null, badRange = null, badTrips = null;

allHands.forEach(function (hand) {
    var s = E.score(hand);
    if (s.points < minPoints) minPoints = s.points;
    if (s.points > maxPoints) maxPoints = s.points;
    if (s.points < 8 || s.points > 31) badRange = badRange || hand.join(' ');

    var suits = hand.map(E.cardSuit);
    var ranks = hand.map(E.cardRank);
    var sameSuit = suits[0] === suits[1] && suits[1] === suits[2];
    var sameRank = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    var suitSum = hand.reduce(function (t, x) { return t + E.cardValue(x); }, 0);

    // Feuer ist genau: drei gleiche Farbe, zusammen 31.
    var shouldBeFire = sameSuit && suitSum === 31;
    if (s.fire !== shouldBeFire) badFire = badFire || hand.join(' ');
    if (s.fire) fireHands.push(hand);

    if (sameRank) {
        tripsHands.push(hand);
        // Drilling: pauschal 31 und ausdruecklich kein Feuer.
        if (s.points !== 31 || s.fire || s.kind !== 'trips') badTrips = badTrips || hand.join(' ');
    }
});

ok(!badRange, 'Punkte immer zwischen 8 und 31' + (badRange ? ' — ' + badRange : ''));
ok(!badFire, 'Feuer genau bei drei gleichen Farben mit 31' + (badFire ? ' — ' + badFire : ''));
ok(!badTrips, 'Drilling zaehlt 31 und ist kein Feuer' + (badTrips ? ' — ' + badTrips : ''));
// Sieben Punkte gaebe es nur mit drei Siebenern — und die zaehlen als Drilling 31.
equal(minPoints, 8, 'schwaechste Hand hat 8 Punkte');
equal(E.score(['H7', 'S7', 'D8']).points, 8, 'zwei Siebener in verschiedenen Farben plus Acht ergibt 8');
equal(maxPoints, 31, 'staerkste Hand hat 31 Punkte');

// Ass plus zwei Zehnerkarten je Farbe: 4 aus 2 = 6 Kombinationen, mal 4 Farben.
equal(fireHands.length, 24, 'es gibt 24 Feuer-Haende');
ok(fireHands.every(function (h) { return h.some(function (x) { return E.cardRank(x) === 'A'; }); }),
    'jedes Feuer enthaelt ein Ass');
// Acht Raenge, je 4 aus 3 = 4 Kombinationen.
equal(tripsHands.length, 32, 'es gibt 32 Drillinge');

/* --- Einzelne Regelbeispiele -------------------------------------------- */

section('Regelbeispiele');

var beispielFeuer = E.score(['HJ', 'HQ', 'HA']);
equal(beispielFeuer.points, 31, 'Herz Bube/Dame/Ass ergibt 31');
ok(beispielFeuer.fire, 'Herz Bube/Dame/Ass ist Feuer');

var dreiAsse = E.score(['HA', 'SA', 'DA']);
equal(dreiAsse.points, 31, 'drei Asse zaehlen 31');
ok(!dreiAsse.fire, 'drei Asse sind kein Feuer');

var dreiSieben = E.score(['H7', 'S7', 'D7']);
equal(dreiSieben.points, 31, 'drei Siebener zaehlen ebenfalls 31');
ok(!dreiSieben.fire, 'drei Siebener sind kein Feuer');

equal(E.score(['H7', 'H8', 'SA']).points, 15, 'Herz 7 + Herz 8 schlaegt einzelnes Ass');
equal(E.score(['H7', 'H8', 'SA']).suit, 'H', 'gewertete Farbe ist Herz');
equal(E.score(['HA', 'S9', 'D7']).points, 11, 'ohne Farbpaar zaehlt die hoechste Einzelkarte');
equal(E.score(['HK', 'HQ', 'HJ']).points, 30, 'Herz K/D/B ergibt 30, kein Feuer');
ok(!E.score(['HK', 'HQ', 'HJ']).fire, 'K/D/B derselben Farbe ist kein Feuer');
equal(E.score(['HX', 'HA', 'SK']).points, 21, 'Herz Zehn plus Herz Ass ergibt 21');

/* --- Rundenabrechnung ---------------------------------------------------- */

section('Rundenabrechnung');

var normal = E.evaluateRound([
    { seat: 0, hand: ['H7', 'S8', 'D9'] },   //  9
    { seat: 1, hand: ['HK', 'HQ', 'S7'] },   // 20
    { seat: 2, hand: ['CA', 'C9', 'S8'] }    // 20
]);
equal(normal.ending, 'normal', 'ohne Feuer endet die Runde normal');
equal(normal.losers.length, 1, 'ohne Feuer verliert genau einer');
equal(normal.losers[0], 0, 'die niedrigste Hand verliert');

// Gleichstand bei 20 Punkten: der hoechste Einzelrang entscheidet.
var gleichstand = E.evaluateRound([
    { seat: 0, hand: ['HK', 'HX', 'S7'] },   // 20, hoechste Karte Koenig
    { seat: 1, hand: ['CA', 'C9', 'D7'] }    // 20, hoechste Karte Ass
]);
equal(gleichstand.losers[0], 0, 'bei Gleichstand verliert die schwaechere Einzelkarte');

// Gleicher Rang, gleiche Punkte: die Farbrangfolge entscheidet.
var farbEntscheid = E.evaluateRound([
    { seat: 0, hand: ['CA', 'C9', 'D7'] },   // 20, Ass in Kreuz
    { seat: 1, hand: ['HA', 'H9', 'S7'] }    // 20, Ass in Herz
]);
equal(farbEntscheid.losers[0], 0, 'Kreuz verliert gegen Herz');

var karoGegenPik = E.evaluateRound([
    { seat: 0, hand: ['DA', 'D9', 'C7'] },
    { seat: 1, hand: ['SA', 'S9', 'C8'] }
]);
equal(karoGegenPik.losers[0], 0, 'Karo verliert gegen Pik');

var feuer = E.evaluateRound([
    { seat: 0, hand: ['HJ', 'HQ', 'HA'] },   // Feuer, 31
    { seat: 1, hand: ['S7', 'D8', 'C9'] },   //  9 -> unter 12, verliert
    { seat: 2, hand: ['SK', 'SQ', 'H7'] },   // 20 -> sicher
    { seat: 3, hand: ['CJ', 'D9', 'H8'] }    // 10 -> unter 12, verliert
]);
equal(feuer.ending, 'fire', 'Feuer beendet die Runde');
equal(feuer.fireSeats.join(','), '0', 'das Feuer liegt auf Platz 0');
equal(feuer.losers.join(','), '1,3', 'bei Feuer verlieren alle unter 12 Punkten');

var feuerOhneVerlierer = E.evaluateRound([
    { seat: 0, hand: ['HJ', 'HQ', 'HA'] },   // Feuer
    { seat: 1, hand: ['SK', 'SQ', 'D7'] },   // 20
    { seat: 2, hand: ['CX', 'CJ', 'H7'] }    // 20
]);
equal(feuerOhneVerlierer.losers.length, 0, 'bei Feuer kann es auch null Verlierer geben');

// Genau 12 Punkte sind sicher, 11 nicht.
var feuerGrenze = E.evaluateRound([
    { seat: 0, hand: ['HJ', 'HQ', 'HA'] },
    { seat: 1, hand: ['S7', 'D8', 'C9'] },   //  9
    { seat: 2, hand: ['SA', 'H7', 'D8'] },   // 11 -> verliert
    { seat: 3, hand: ['D9', 'DK', 'H7'] }    // 19
]);
equal(feuerGrenze.losers.join(','), '1,2', '11 Punkte verlieren, ab 12 ist man sicher');

var elfGenau = E.evaluateRound([
    { seat: 0, hand: ['HJ', 'HQ', 'HA'] },
    { seat: 1, hand: ['SX', 'D8', 'C7'] }    // genau 10
]);
equal(elfGenau.losers.join(','), '1', 'zehn Punkte verlieren bei Feuer');

var zwoelfGenau = E.evaluateRound([
    { seat: 0, hand: ['HJ', 'HQ', 'HA'] },
    { seat: 1, hand: ['S9', 'D8', 'CA'] }    // 11 -> knapp drunter
]);
equal(zwoelfGenau.losers.join(','), '1', 'elf Punkte verlieren bei Feuer');

var sicherAbZwoelf = E.evaluateRound([
    { seat: 0, hand: ['HJ', 'HQ', 'HA'] },
    { seat: 1, hand: ['S9', 'D9', 'C8'] },   //  9
    { seat: 2, hand: ['SX', 'S8', 'C7'] }    // 18
]);
equal(sicherAbZwoelf.losers.join(','), '1', 'achtzehn Punkte sind bei Feuer sicher');

// Ein Drilling ist kein Feuer: die Runde endet normal, obwohl 31 auf dem Tisch liegt.
var drillingRunde = E.evaluateRound([
    { seat: 0, hand: ['HA', 'SA', 'DA'] },   // 31, aber kein Feuer
    { seat: 1, hand: ['S7', 'D8', 'C9'] },   //  9
    { seat: 2, hand: ['SK', 'SQ', 'H7'] }    // 20
]);
equal(drillingRunde.ending, 'normal', 'ein Drilling loest kein Feuer aus');
equal(drillingRunde.losers.join(','), '1', 'bei Drilling verliert nur die niedrigste Hand');

/* --- Zufallsrunden ------------------------------------------------------- */

section('Zufallsrunden');

// Reproduzierbarer Zufall, damit ein Fehlschlag nachstellbar bleibt.
function seeded(seed) {
    var s = seed >>> 0;
    return function () {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

var rng = seeded(20260830);
var rounds = 50000;
var problems = { losers: null, dupes: null, fireLoser: null, safeLoser: null, missed: null };
var fireRounds = 0;

for (var i = 0; i < rounds; i++) {
    var count = 2 + Math.floor(rng() * 5);           // 2 bis 6 Spieler
    var table = E.deal(count, rng);

    var seen = {};
    table.hands.concat([table.middle]).forEach(function (group) {
        group.forEach(function (card) {
            if (seen[card]) problems.dupes = problems.dupes || card;
            seen[card] = true;
        });
    });

    var entries = table.hands.map(function (hand, seat) { return { seat: seat, hand: hand }; });
    var result = E.evaluateRound(entries);

    if (result.ending === 'fire') {
        fireRounds++;
        // Jeder Verlierer liegt unter 12, jeder Nichtverlierer nicht.
        result.results.forEach(function (r) {
            var isLoser = result.losers.indexOf(r.seat) !== -1;
            if (isLoser && r.points >= 12) problems.fireLoser = problems.fireLoser || r.points;
            if (!isLoser && r.points < 12) problems.safeLoser = problems.safeLoser || r.points;
        });
    } else {
        if (result.losers.length !== 1) problems.losers = problems.losers || result.losers.length;
        // Der Verlierer ist wirklich der schwaechste am Tisch.
        var loser = result.results.filter(function (r) { return r.seat === result.losers[0]; })[0];
        result.results.forEach(function (r) {
            if (r.seat === loser.seat) return;
            if (E.compareWeakness(r, loser) < 0) problems.missed = problems.missed || r.seat;
        });
    }
}

ok(!problems.dupes, 'keine Karte wird doppelt ausgeteilt' + (problems.dupes ? ' — ' + problems.dupes : ''));
ok(!problems.losers, 'ohne Feuer steht immer genau ein Verlierer fest');
ok(!problems.fireLoser, 'bei Feuer verliert niemand mit 12 oder mehr Punkten');
ok(!problems.safeLoser, 'bei Feuer verliert jeder unter 12 Punkten');
ok(!problems.missed, 'es wird niemand Schwaecheres uebersehen');
ok(fireRounds > 0, 'in ' + rounds + ' Runden kam Feuer vor (' + fireRounds + ' mal)');

/* --- Zuege --------------------------------------------------------------- */

section('Zuege');

var hand = ['H7', 'S8', 'D9'], middle = ['CA', 'HK', 'SQ'];

var one = E.swapOne(hand, middle, 1, 0);
equal(one.hand.join(' '), 'H7 CA D9', 'Einzeltausch legt die Mittenkarte auf den Handplatz');
equal(one.middle.join(' '), 'S8 HK SQ', 'die Handkarte wandert an denselben Mittenplatz');
equal(hand.join(' '), 'H7 S8 D9', 'die urspruengliche Hand bleibt unveraendert');

var all = E.swapAll(hand, middle);
equal(all.hand.join(' '), 'CA HK SQ', 'Dreiertausch nimmt die ganze Mitte');
equal(all.middle.join(' '), 'H7 S8 D9', 'die ganze Hand geht in die Mitte');

// Nach einem Tausch sind immer noch alle sechs Karten verschieden.
var mixed = E.swapOne(hand, middle, 2, 2);
equal(new Set(mixed.hand.concat(mixed.middle)).size, 6, 'Tausch erzeugt keine Doppelkarte');

equal(E.nextSeat([0, 1, 2, 3], 1), 2, 'der naechste Platz folgt im Uhrzeigersinn');
equal(E.nextSeat([0, 1, 2, 3], 3), 0, 'nach dem letzten Platz kommt wieder der erste');
equal(E.nextSeat([0, 2, 5], 2), 5, 'leere Plaetze werden uebersprungen');
equal(E.nextSeat([0, 2, 5], 5), 0, 'auch beim Umbruch');
equal(E.nextSeat([3], 3), 3, 'ein einzelner Platz bleibt bei sich');

// Ein Einzeltausch kann Feuer bringen — genau dafuer ist die Sofortpruefung da.
var vorFeuer = ['HJ', 'HQ', 'S7'];
var nachFeuer = E.swapOne(vorFeuer, ['HA', 'C8', 'D9'], 2, 0);
ok(!E.isFire(vorFeuer), 'vor dem Tausch noch kein Feuer');
ok(E.isFire(nachFeuer.hand), 'nach dem Tausch liegt Feuer auf der Hand');

/* --- Austeilen ----------------------------------------------------------- */

section('Austeilen');

for (var n = 2; n <= 6; n++) {
    var t = E.deal(n, seeded(n * 7919));
    equal(t.hands.length, n, 'zu ' + n + ' Spielern gibt es ' + n + ' Haende');
    ok(t.hands.every(function (h) { return h.length === 3; }), 'jede Hand hat drei Karten (' + n + ')');
    equal(t.middle.length, 3, 'drei Karten offen in der Mitte (' + n + ')');
}

var tooFew = false, tooMany = false;
try { E.deal(1); } catch (e) { tooFew = true; }
try { E.deal(7); } catch (e) { tooMany = true; }
ok(tooFew, 'ein einzelner Spieler wird abgelehnt');
ok(tooMany, 'sieben Spieler werden abgelehnt');

/* --- Ergebnis ------------------------------------------------------------ */

process.stdout.write('\n');
if (failures.length) {
    process.stdout.write('  ' + failures.length + ' von ' + checks + ' Checks fehlgeschlagen:\n');
    failures.forEach(function (f) { process.stdout.write('    - ' + f + '\n'); });
    process.exit(1);
}
process.stdout.write('  Alle ' + checks + ' Checks bestanden.\n\n');
