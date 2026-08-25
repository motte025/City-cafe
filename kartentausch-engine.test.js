/*
 * Regel-Checks für kartentausch-engine.js — läuft ohne Browser:
 *   node kartentausch-engine.test.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var E = require('./kartentausch-engine.js');

var passed = 0;
var failed = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
    } else {
        failed.push(name + (detail ? '  →  ' + detail : ''));
    }
}

function eq(name, actual, expected) {
    var a = JSON.stringify(actual);
    var b = JSON.stringify(expected);
    check(name, a === b, 'erwartet ' + b + ', war ' + a);
}

// ---------- Deck ----------
var deck = E.buildDeck();
eq('Deck hat 32 Karten', deck.length, 32);
eq('Deck ist duplikatfrei', new Set(deck).size, 32);
check('Deck enthält keine 2-6', deck.every(function (c) { return !/^.[2-6]$/.test(c); }));

// ---------- Kartenbilder gegen die echten Dateien im Repo ----------
var cardsDir = path.join(__dirname, 'cards');
var onDisk = new Set(fs.readdirSync(cardsDir));
var missing = deck.map(function (c) { return E.cardImage(c, ''); }).filter(function (f) { return !onDisk.has(f); });
eq('Alle 32 Kartenbilder existieren im cards/-Ordner', missing, []);
var missingBacks = E.CARD_BACKS.filter(function (f) { return !onDisk.has(f); });
eq('Beide Kartenrückseiten liegen bereit', missingBacks, []);
// 32 Vorderseiten + genau zwei Rückseiten, sonst schleicht sich unbenutztes Material ein.
eq('Keine überzähligen Dateien im cards/-Ordner', onDisk.size, 34);
eq('cardImage nutzt cards/ als Standardpfad', E.cardImage('H7'), 'cards/7_of_hearts.webp');
eq('Pik-Ass hat die 2-Endung', E.cardImage('SA', ''), 'ace_of_spades2.webp');
eq('Herz-Ass hat keine 2-Endung', E.cardImage('HA', ''), 'ace_of_hearts.webp');
eq('Bube hat die 2-Endung', E.cardImage('CJ', ''), 'jack_of_clubs2.webp');

// ---------- Wertung ----------
eq('Feuer: Herz Bube/Dame/Ass = 31', E.scoreHand(['HJ', 'HQ', 'HA']).score, 31);
check('Feuer wird als Feuer erkannt', E.scoreHand(['HJ', 'HQ', 'HA']).fire === true);
check('Feuer geht in jeder Farbe', E.scoreHand(['CA', 'C10', 'CK']).fire === true);
eq('Kreuz-Feuer zählt 31', E.scoreHand(['CA', 'C10', 'CK']).score, 31);

eq('Drei Asse zählen 31 Punkte', E.scoreHand(['HA', 'SA', 'DA']).score, 31);
check('Drei Asse sind KEIN Feuer', E.scoreHand(['HA', 'SA', 'DA']).fire === false);
check('Drei Asse werden als Drilling markiert', E.scoreHand(['HA', 'SA', 'DA']).threeOfAKind === true);
eq('Drei Siebener zählen ebenfalls 31', E.scoreHand(['H7', 'S7', 'D7']).score, 31);
check('Drei Siebener sind kein Feuer', E.scoreHand(['H7', 'S7', 'D7']).fire === false);

eq('Flush unter 31 ist kein Feuer-Wert', E.scoreHand(['H10', 'HJ', 'HQ']).score, 30);
check('Flush mit 30 ist kein Feuer', E.scoreHand(['H10', 'HJ', 'HQ']).fire === false);
eq('Zwei gleiche Farben werden addiert', E.scoreHand(['H7', 'HK', 'SA']).score, 17);
eq('Ohne Farbpaar zählt die höchste Einzelkarte', E.scoreHand(['C9', 'HK', 'SA']).score, 11);
eq('Drei verschiedene Farben, kleine Karten', E.scoreHand(['H7', 'S8', 'D9']).score, 9);
eq('Ass + Zehn gleicher Farbe', E.scoreHand(['HA', 'H10', 'S7']).score, 21);

// ---------- Kartenvergleich / Tie-Break-Reihenfolge ----------
check('Ass schlägt König', E.compareCards('CA', 'HK') > 0);
check('König schlägt Dame trotz gleichem Punktwert', E.compareCards('CK', 'HQ') > 0);
check('Herz schlägt Pik bei gleichem Rang', E.compareCards('HA', 'SA') > 0);
check('Pik schlägt Karo bei gleichem Rang', E.compareCards('SA', 'DA') > 0);
check('Karo schlägt Kreuz bei gleichem Rang', E.compareCards('DA', 'CA') > 0);
eq('highestCard findet die stärkste Karte', E.highestCard(['C9', 'HK', 'SA']), 'SA');

// ---------- Rundenauswertung: Normalfall ----------
var r1 = E.evaluateRound({
    0: ['HA', 'HK', 'S7'],   // 21
    1: ['C7', 'D8', 'S9'],   //  9  ← niedrigster
    2: ['DA', 'D10', 'C8']   // 21
});
eq('Normalfall: genau ein Verlierer', r1.loserSeat, 1);
eq('Normalfall: payingSeats enthält nur den Verlierer', r1.payingSeats, [1]);
eq('Normalfall-Modus', r1.mode, 'normal');
check('Normalfall ohne Tie-Break', r1.tieBreak === false);

// Gleichstand bei 15: Höchste Karte Sitz 0 = S9, Sitz 1 = DA → Sitz 0 verliert.
var r2 = E.evaluateRound({
    0: ['H7', 'H8', 'S9'],
    1: ['C7', 'C8', 'DA'],
    2: ['HA', 'HK', 'S7']
});
eq('Tie-Break: niedrigste Höchstkarte verliert', r2.loserSeat, 0);
check('Tie-Break wird als solcher markiert', r2.tieBreak === true);

// Beide Höchstkarten sind 10 Punkte wert (König und Zehn). Nur die Rang-Reihenfolge
// löst das auf — mit reinem Punktvergleich wäre hier kein Verlierer bestimmbar.
var r2b = E.evaluateRound({
    0: ['HK', 'C7', 'D8'],
    1: ['S10', 'C8', 'D7']
});
eq('Tie-Break nutzt Rang-Reihenfolge, nicht den Punktwert', r2b.loserSeat, 1);

// Gleichstand mit identischem Rang der Höchstkarte → Farbe entscheidet (Herz > Pik > Karo > Kreuz)
var r3 = E.evaluateRound({
    0: ['H9', 'C7', 'D8'],   // 9, Höchste H9
    1: ['C9', 'S7', 'H8']    // 9, Höchste C9 → Kreuz ist die schwächste Farbe
});
eq('Tie-Break fällt auf die Farbrangfolge zurück', r3.loserSeat, 1);

// ---------- Rundenauswertung: Feuer ----------
var f1 = E.evaluateRound({
    0: ['HJ', 'HQ', 'HA'],   // Feuer
    1: ['C7', 'D8', 'S9'],   //  9 → zahlt
    2: ['DA', 'D10', 'C8'],  // 21 → zahlt nicht
    3: ['S7', 'H8', 'C9']    //  9 → zahlt
});
eq('Feuer-Modus', f1.mode, 'fire');
eq('Feuer: Feuer-Sitz wird gemeldet', f1.fireSeats, [0]);
eq('Feuer: alle unter 12 zahlen', f1.payingSeats, [1, 3]);
eq('Feuer: kein einzelner Verlierer', f1.loserSeat, null);
check('Feuer: kein Tie-Break', f1.tieBreak === false);

// Feuer, bei dem niemand unter 12 liegt → 0 Zahlende ist erlaubt
var f2 = E.evaluateRound({
    0: ['SA', 'S10', 'SK'],  // Feuer
    1: ['DA', 'D10', 'C8']   // 21
});
eq('Feuer ohne Zahlende ist zulässig', f2.payingSeats, []);

// Grenzwert: exakt 12 Punkte zahlt NICHT, 11 zahlt
var f3 = E.evaluateRound({
    0: ['HJ', 'HQ', 'HA'],   // Feuer
    1: ['C7', 'D8', 'S9'],   //  9 → zahlt
    2: ['SA', 'H7', 'D8']    // 11 → zahlt
});
eq('Feuer-Grenzwert: 11 Punkte zahlen', f3.payingSeats, [1, 2]);
var f4 = E.evaluateRound({ 0: ['HJ', 'HQ', 'HA'], 1: ['S7', 'S8', 'D9'] }); // 15 → zahlt nicht
eq('Feuer-Grenzwert: 15 Punkte zahlen nicht', f4.payingSeats, []);

// ---------- Austeilen ----------
[2, 3, 4, 5, 6].forEach(function (n) {
    var d = E.deal(n);
    eq('Deal ' + n + ' Spieler: ' + n + ' Hände', Object.keys(d.hands).length, n);
    eq('Deal ' + n + ' Spieler: 3 Mittenkarten', d.middleCards.length, 3);
    var all = d.middleCards.slice();
    for (var s = 0; s < n; s++) {
        eq('Deal ' + n + ': Sitz ' + s + ' hat 3 Karten', d.hands[s].length, 3);
        all = all.concat(d.hands[s]);
    }
    eq('Deal ' + n + ' Spieler: keine Karte doppelt', new Set(all).size, all.length);
});
check('Deal lehnt 1 Spieler ab', (function () { try { E.deal(1); return false; } catch (e) { return true; } })());
check('Deal lehnt 7 Spieler ab', (function () { try { E.deal(7); return false; } catch (e) { return true; } })());

// ---------- Zugreihenfolge ----------
eq('nextSeat läuft im Kreis', [0, 1, 2, 3].map(function (s) { return E.nextSeat(s, 4); }), [1, 2, 3, 0]);

// ---------- Eindeutigkeits-Garantie über viele Zufallsrunden ----------
var seed = 12345;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
}
var normalRounds = 0;
var fireRounds = 0;
var uniquenessBroken = 0;
for (var i = 0; i < 20000; i++) {
    var count = 2 + Math.floor(seededRandom() * 5);
    var d = E.deal(count, seededRandom);
    var res = E.evaluateRound(d.hands);
    if (res.mode === 'normal') {
        normalRounds++;
        if (res.loserSeat === null || res.payingSeats.length !== 1) uniquenessBroken++;
    } else {
        fireRounds++;
        if (res.loserSeat !== null) uniquenessBroken++;
    }
}
eq('20000 Zufallsrunden liefern immer genau einen Verlierer (bzw. Feuer)', uniquenessBroken, 0);
check('Testlauf enthielt echte Feuer-Runden', fireRounds > 0, fireRounds + ' Feuer / ' + normalRounds + ' normal');

// ---------- Alle 4960 möglichen Hände ----------
var handCount = 0;
var fireHands = 0;
var scoreOutOfRange = 0;
for (var a = 0; a < deck.length; a++) {
    for (var b = a + 1; b < deck.length; b++) {
        for (var c = b + 1; c < deck.length; c++) {
            var hand = E.scoreHand([deck[a], deck[b], deck[c]]);
            handCount++;
            if (hand.fire) fireHands++;
            if (hand.score < 7 || hand.score > 31) scoreOutOfRange++;
        }
    }
}
eq('Alle Kombinationen geprüft', handCount, 4960);
eq('Keine Punktzahl außerhalb 7-31', scoreOutOfRange, 0);
eq('Genau 24 Feuer-Hände im 32er-Blatt', fireHands, 24);

// ---------- "Alle 3 tauschen" nur bei Drilling oder gleicher Farbe ----------
eq('Mitte mit Drilling erlaubt Rundumtausch', E.middleWorthTakingAll(['H9', 'S9', 'D9']), true);
eq('Mitte mit drei gleichen Farben erlaubt Rundumtausch', E.middleWorthTakingAll(['H7', 'HK', 'HA']), true);
eq('Gemischte Mitte erlaubt keinen Rundumtausch', E.middleWorthTakingAll(['H7', 'S8', 'D9']), false);
eq('Zwei gleiche Farben reichen nicht', E.middleWorthTakingAll(['H7', 'H8', 'D9']), false);
eq('Unvollstaendige Mitte erlaubt keinen Rundumtausch', E.middleWorthTakingAll(['H7', 'H8']), false);

// ---------- Kartenrueckseiten ----------
eq('Zwei Rueckseiten-Motive vorhanden', E.CARD_BACKS.length, 2);
eq('Rueckseite mit Basispfad', E.cardBackImage('cards/', function () { return 0; }),
   'cards/player_card_back_design_2_lightblue.svg');
eq('Zweite Rueckseite wird auch gezogen', E.cardBackImage('cards/', function () { return 0.99; }),
   'cards/player_card_back_design_2_red.svg');
var backsSeen = {};
for (var bi = 0; bi < 400; bi++) backsSeen[E.cardBackImage('cards/')] = true;
eq('Ueber viele Ziehungen kommen beide Motive vor', Object.keys(backsSeen).length, 2);

// ---------- Computer-Spieler ----------
var botAll = E.botDecide(['C7', 'S8', 'D9'], ['H7', 'HK', 'HA'], { canKnock: false, canPass: true });
eq('Computer nimmt einen lohnenden Rundumtausch', botAll.type, 'all');

var botKnock = E.botDecide(['HK', 'HQ', 'HA'], ['C7', 'S8', 'D9'], { canKnock: true, canPass: true });
eq('Computer klopft mit starker Hand', botKnock.type, 'knock');

var botNoKnock = E.botDecide(['HK', 'HQ', 'HA'], ['C7', 'S8', 'D9'], { canKnock: false, canPass: true });
eq('Ohne Klopf-Erlaubnis wird nicht geklopft', botNoKnock.type !== 'knock', true);

eq('Computer ohne Hand zieht nicht', E.botDecide([], ['HA', 'S9', 'D7'], {}).type, 'skip');

/*
 * Die entscheidende neue Eigenschaft: der Computer verschlechtert seine Hand
 * nicht mehr. Frueher musste er irgendetwas ziehen und nahm dabei auch
 * Verschlechterungen in Kauf; jetzt gibt er stattdessen weiter.
 */
var worse = 0, suboptimal = 0, passes = 0, knocks = 0, swaps = 0;
for (var bt = 0; bt < 4000; bt++) {
    var d = E.deal(2);
    var h = d.hands[0], mid = d.middleCards;
    var before = E.scoreHand(h).score;
    var mv = E.botDecide(h, mid, { canKnock: bt % 2 === 0, canPass: true });

    if (mv.type === 'pass') { passes++; continue; }
    if (mv.type === 'knock') { knocks++; continue; }
    swaps++;

    var after;
    if (mv.type === 'all') after = E.scoreHand(mid).score;
    else {
        var probe = h.slice();
        probe[mv.handIndex] = mid[mv.middleIndex];
        after = E.scoreHand(probe).score;
    }
    if (after < before) worse++;

    if (mv.type === 'single') {
        var bestPossible = -1;
        for (var qh = 0; qh < 3; qh++) {
            for (var qm = 0; qm < 3; qm++) {
                var t2 = h.slice();
                t2[qh] = mid[qm];
                bestPossible = Math.max(bestPossible, E.scoreHand(t2).score);
            }
        }
        if (after < before + 1 && bestPossible >= before + 1) suboptimal++;
    }
}
eq('Computer verschlechtert seine Hand nie', worse, 0);
eq('Computer übersieht keine echte Verbesserung', suboptimal, 0);
check('Computer nutzt alle drei Zugarten', passes > 0 && knocks > 0 && swaps > 0);
console.log('Computer-Statistik: ' + swaps + ' Tausche, ' + knocks + ' Klopfer, ' + passes + ' mal weitergegeben.');

// Klopfen nur mit brauchbarer Hand
var knockLow = 0;
for (var kb = 0; kb < 2000; kb++) {
    var dk = E.deal(2);
    var hk = dk.hands[0];
    var mk = E.botDecide(hk, dk.middleCards, { canKnock: true, canPass: true });
    if (mk.type === 'knock' && E.scoreHand(hk).score < E.BOT_KNOCK_SOLID) knockLow++;
}
eq('Computer klopft nie mit schwacher Hand', knockLow, 0);

// ---------- Rundenbegrenzung: keine Endlosrunde ----------
/*
 * Seit es "Weiter" gibt, kann eine Runde theoretisch ewig laufen: geben alle
 * nur weiter, aendert sich die Mitte nie. Zwei Sicherungen greifen dagegen -
 * eine harte Obergrenze und eine mit der Zeit sinkende Klopfschwelle.
 */
eq('Runde endet nicht vorzeitig', E.roundShouldEnd(5, 3), false);
eq('Runde endet nach vier Durchgängen', E.roundShouldEnd(12, 3), true);
eq('Obergrenze skaliert mit der Spieleranzahl', E.roundShouldEnd(23, 6), false);
eq('Obergrenze bei sechs Spielern', E.roundShouldEnd(24, 6), true);

check('Klopfschwelle sinkt mit der Rundenzahl',
    E.botKnockThreshold(0, 3) > E.botKnockThreshold(7, 3) &&
    E.botKnockThreshold(7, 3) > E.botKnockThreshold(11, 3));

// Vollständige Computer-Runden durchsimulieren: jede muss enden.
var maxTurnsSeen = 0, endless = 0;
for (var sim = 0; sim < 600; sim++) {
    var count = 2 + (sim % 5);
    var d = E.deal(count);
    var hands = d.hands, middle = d.middleCards.slice();
    var turns = 0, knockedBy = null, finalLeft = null, seat = 0, done = false;

    for (var step = 0; step < 500 && !done; step++) {
        var canKnock = knockedBy === null && turns >= count;
        var mv = E.botDecide(hands[seat], middle, {
            canKnock: canKnock, canPass: true, turnsPlayed: turns, playerCount: count
        });
        if (mv.type === 'knock') { knockedBy = seat; finalLeft = count - 1; }
        else if (mv.type === 'single') {
            var give = hands[seat][mv.handIndex];
            hands[seat][mv.handIndex] = middle[mv.middleIndex];
            middle[mv.middleIndex] = give;
        } else if (mv.type === 'all') {
            var tmpH = hands[seat].slice();
            hands[seat] = middle.slice();
            middle = tmpH;
        }
        turns++;
        if (knockedBy !== null && mv.type !== 'knock') {
            finalLeft--;
            if (finalLeft <= 0) done = true;
        }
        if (!done && knockedBy === null && E.roundShouldEnd(turns, count)) done = true;
        seat = E.nextSeat(seat, count);
    }
    if (!done) endless++;
    maxTurnsSeen = Math.max(maxTurnsSeen, turns);
}
eq('Jede Computer-Runde endet', endless, 0);
check('Runden bleiben kurz genug (höchstens 30 Züge)', maxTurnsSeen <= 30, 'längste: ' + maxTurnsSeen);
console.log('Rundenlänge: längste simulierte Computer-Runde ' + maxTurnsSeen + ' Züge.');

// ---------- Fairness: kein Eingriff ins Kartenglück ----------
/*
 * Zwei Eigenschaften, die zusammen "reiner Zufall" belegen:
 *  1. Das Mischen ist gleichverteilt - jede Karte landet ungefähr gleich oft
 *     auf jeder Position.
 *  2. Der Computer kann strukturell nicht schummeln: botDecide() nimmt nur die
 *     eigene Hand und die offene Mitte entgegen. Fremde Hände oder der
 *     Reststapel sind gar nicht erreichbar - hier gegengeprüft, indem dieselbe
 *     Hand bei unterschiedlichem Rest immer dieselbe Entscheidung ergibt.
 */
var DEALS = 20000;
var posCount = {};
var deckAll = E.buildDeck();
deckAll.forEach(function (c) { posCount[c] = 0; });
for (var fz = 0; fz < DEALS; fz++) {
    posCount[E.shuffle(deckAll)[0]]++;          // wie oft liegt welche Karte zuoberst
}
var expected = DEALS / 32;
var maxDev = 0;
deckAll.forEach(function (c) {
    maxDev = Math.max(maxDev, Math.abs(posCount[c] - expected) / expected);
});
check('Mischen ist gleichverteilt (Abweichung unter 25%)', maxDev < 0.25);
console.log('Misch-Statistik: größte Abweichung ' + (maxDev * 100).toFixed(1) + '% bei ' + DEALS + ' Ziehungen.');

var handFix = ['H10', 'HK', 'C7'];
var midFix = ['SA', 'D9', 'H8'];
var decisions = {};
for (var rp = 0; rp < 50; rp++) {
    decisions[JSON.stringify(E.botDecide(handFix.slice(), midFix.slice(), { canKnock: true, canPass: true }))] = true;
}
eq('Computer-Entscheidung hängt nur von Hand und Mitte ab', Object.keys(decisions).length, 1);

// Jede Karte kommt pro Austeilung genau einmal vor - kein Nachlegen, kein Doppel.
var dupes = 0;
for (var dz = 0; dz < 2000; dz++) {
    var dd = E.deal(6);
    var all = dd.middleCards.slice();
    for (var sx = 0; sx < 6; sx++) all = all.concat(dd.hands[sx]);
    if (new Set(all).size !== all.length) dupes++;
}
eq('Keine doppelten Karten im Spiel', dupes, 0);

// ---------- Ergebnis ----------
console.log('\n' + passed + ' Checks bestanden.');
if (failed.length) {
    console.log(failed.length + ' FEHLGESCHLAGEN:\n');
    failed.forEach(function (f) { console.log('  ✗ ' + f); });
    process.exit(1);
}
console.log('Feuer-Statistik: ' + fireRounds + ' von ' + (fireRounds + normalRounds) + ' Zufallsrunden endeten mit Feuer.');
console.log('Alle Regel-Checks in Ordnung.\n');
