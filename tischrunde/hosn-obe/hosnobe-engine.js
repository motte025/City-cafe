/*
 * Tischrunde — Hos'n Obe (Schwimmen / 31)
 * Regelwerk. Kennt weder DOM noch Firebase, laeuft daher auch unter node.
 *
 * Kartenkennung: zwei Zeichen, erst Farbe, dann Rang. "HA" = Herz Ass,
 * "SX" = Pik Zehn. Kurze Kennungen, weil sie so durch die Realtime Database
 * wandern.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.HosnObeEngine = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    var SUITS = ['H', 'S', 'D', 'C'];              // Herz, Pik, Karo, Kreuz
    var RANKS = ['7', '8', '9', 'X', 'J', 'Q', 'K', 'A'];

    var RANK_VALUE = { '7': 7, '8': 8, '9': 9, 'X': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };

    // Farbrangfolge nur fuer den Gleichstand am Rundenende: Herz > Pik > Karo > Kreuz.
    var SUIT_PRIORITY = { H: 3, S: 2, D: 1, C: 0 };

    var SUIT_NAME = { H: 'Herz', S: 'Pik', D: 'Karo', C: 'Kreuz' };
    var SUIT_SYMBOL = { H: '♥', S: '♠', D: '♦', C: '♣' };
    var SUIT_COLOR = { H: 'red', S: 'black', D: 'red', C: 'black' };
    var RANK_LABEL = { '7': '7', '8': '8', '9': '9', 'X': '10', 'J': 'B', 'Q': 'D', 'K': 'K', 'A': 'A' };
    var RANK_NAME = {
        '7': 'Sieben', '8': 'Acht', '9': 'Neun', 'X': 'Zehn',
        'J': 'Bube', 'Q': 'Dame', 'K': 'Koenig', 'A': 'Ass'
    };

    // Ab dieser Punktzahl ist man bei Feuer aus dem Schneider.
    var FIRE_SAFE_POINTS = 12;
    // Drei gleiche Raenge und ein Feuer zaehlen beide genau so viel.
    var MAX_POINTS = 31;

    function cardSuit(id) { return id.charAt(0); }
    function cardRank(id) { return id.charAt(1); }
    function cardValue(id) { return RANK_VALUE[id.charAt(1)]; }
    function rankIndex(id) { return RANKS.indexOf(id.charAt(1)); }

    function isCard(id) {
        return typeof id === 'string' && id.length === 2 &&
            SUITS.indexOf(id.charAt(0)) !== -1 && RANKS.indexOf(id.charAt(1)) !== -1;
    }

    /*
     * Einzelkartenstaerke fuer den Gleichstand: erst der Rang, bei gleichem Rang
     * die Farbe. Weil jede Karte im Blatt nur einmal vorkommt, ist dieser Wert
     * fuer zwei verschiedene Karten nie gleich — der Gleichstand loest sich also
     * immer auf.
     */
    function cardStrength(id) { return rankIndex(id) * 4 + SUIT_PRIORITY[cardSuit(id)]; }

    function cardLabel(id) { return RANK_LABEL[cardRank(id)] + SUIT_SYMBOL[cardSuit(id)]; }
    function cardName(id) { return SUIT_NAME[cardSuit(id)] + ' ' + RANK_NAME[cardRank(id)]; }

    function buildDeck() {
        var deck = [];
        for (var s = 0; s < SUITS.length; s++) {
            for (var r = 0; r < RANKS.length; r++) deck.push(SUITS[s] + RANKS[r]);
        }
        return deck;
    }

    // Standard-Zufall: kryptografisch, wo vorhanden, sonst Math.random.
    function defaultRandom() {
        var c = (typeof crypto !== 'undefined' && crypto) ||
            (typeof globalThis !== 'undefined' && globalThis.crypto);
        if (c && typeof c.getRandomValues === 'function') {
            var buf = new Uint32Array(1);
            c.getRandomValues(buf);
            return buf[0] / 4294967296;
        }
        return Math.random();
    }

    function shuffle(cards, random) {
        var rng = random || defaultRandom;
        var out = cards.slice();
        for (var i = out.length - 1; i > 0; i--) {
            var j = Math.floor(rng() * (i + 1));
            if (j > i) j = i;
            var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
        }
        return out;
    }

    /*
     * Austeilen: jeder Spieler drei Karten, drei offen in die Mitte. Der Rest
     * des Blatts bleibt in dieser Spielart unbenutzt liegen.
     */
    function deal(playerCount, random) {
        if (!(playerCount >= 2 && playerCount <= 6)) {
            throw new Error('Hos\'n Obe wird zu zweit bis zu sechst gespielt, nicht zu ' + playerCount + '.');
        }
        var deck = shuffle(buildDeck(), random);
        var hands = [];
        for (var i = 0; i < playerCount; i++) hands.push(deck.slice(i * 3, i * 3 + 3));
        return { hands: hands, middle: deck.slice(playerCount * 3, playerCount * 3 + 3) };
    }

    /*
     * Bewertung einer Hand.
     *
     *   - drei gleiche Raenge  -> pauschal 31, ausdruecklich kein Feuer
     *   - sonst                -> hoechste Kartensumme innerhalb einer Farbe
     *   - Feuer                -> drei Karten derselben Farbe mit genau 31
     *
     * 31 in einer Farbe geht nur als Ass plus zwei Zehnerkarten, denn ohne Ass
     * sind hoechstens 30 drin und mit Ass muessen die zwei restlichen Karten
     * zusammen 20 ergeben.
     */
    function score(hand) {
        if (!hand || hand.length !== 3) throw new Error('Eine Hand besteht aus genau drei Karten.');

        var r0 = cardRank(hand[0]), r1 = cardRank(hand[1]), r2 = cardRank(hand[2]);
        if (r0 === r1 && r1 === r2) {
            return { points: MAX_POINTS, fire: false, kind: 'trips', suit: null, rank: r0 };
        }

        var sums = { H: 0, S: 0, D: 0, C: 0 };
        var counts = { H: 0, S: 0, D: 0, C: 0 };
        for (var i = 0; i < 3; i++) {
            var s = cardSuit(hand[i]);
            sums[s] += cardValue(hand[i]);
            counts[s] += 1;
        }

        var best = SUITS[0];
        for (var k = 1; k < SUITS.length; k++) {
            var suit = SUITS[k];
            // Bei gleicher Summe die hoeherwertige Farbe nehmen, damit die
            // Anzeige bei gleicher Hand immer dasselbe sagt.
            if (sums[suit] > sums[best] ||
                (sums[suit] === sums[best] && SUIT_PRIORITY[suit] > SUIT_PRIORITY[best])) best = suit;
        }

        var fire = counts[best] === 3 && sums[best] === MAX_POINTS;
        return { points: sums[best], fire: fire, kind: fire ? 'fire' : 'suit', suit: best, rank: null };
    }

    function isFire(hand) { return score(hand).fire; }

    // Die staerkste Einzelkarte der Hand — zweites Kriterium beim Gleichstand.
    function handStrength(hand) {
        var best = -1;
        for (var i = 0; i < hand.length; i++) best = Math.max(best, cardStrength(hand[i]));
        return best;
    }

    function rate(entry) {
        var s = score(entry.hand);
        return {
            seat: entry.seat,
            uid: entry.uid || null,
            hand: entry.hand.slice(),
            points: s.points,
            fire: s.fire,
            kind: s.kind,
            suit: s.suit,
            strength: handStrength(entry.hand)
        };
    }

    // Negativ, wenn a schwaecher ist als b.
    function compareWeakness(a, b) {
        if (a.points !== b.points) return a.points - b.points;
        return a.strength - b.strength;
    }

    /*
     * Rundenabrechnung.
     *
     * entries: [{ seat, uid, hand }] — nur aufgedeckte Haende uebergeben.
     *
     * Mit Feuer verliert jeder unter 12 Punkten; das koennen null, ein oder
     * mehrere Spieler sein. Ohne Feuer verliert genau einer: die niedrigste
     * Hand, bei Gleichstand die schwaechere Einzelkarte.
     */
    function evaluateRound(entries) {
        var rated = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i] && entries[i].hand && entries[i].hand.length === 3) rated.push(rate(entries[i]));
        }
        if (!rated.length) return { ending: 'none', results: [], losers: [], fireSeats: [] };

        var fireSeats = [];
        for (var f = 0; f < rated.length; f++) if (rated[f].fire) fireSeats.push(rated[f].seat);

        var losers = [];
        if (fireSeats.length) {
            for (var g = 0; g < rated.length; g++) {
                if (rated[g].points < FIRE_SAFE_POINTS) losers.push(rated[g].seat);
            }
            return { ending: 'fire', results: rated, losers: losers, fireSeats: fireSeats };
        }

        var weakest = rated[0];
        for (var h = 1; h < rated.length; h++) {
            if (compareWeakness(rated[h], weakest) < 0) weakest = rated[h];
        }
        return { ending: 'normal', results: rated, losers: [weakest.seat], fireSeats: [] };
    }

    /* --- Zuege ------------------------------------------------------------ */

    // Eine Handkarte gegen eine Mittenkarte.
    function swapOne(hand, middle, handIndex, middleIndex) {
        if (!(handIndex >= 0 && handIndex < 3) || !(middleIndex >= 0 && middleIndex < 3)) {
            throw new Error('Getauscht wird zwischen Platz 0 und 2.');
        }
        var nextHand = hand.slice(), nextMiddle = middle.slice();
        nextHand[handIndex] = middle[middleIndex];
        nextMiddle[middleIndex] = hand[handIndex];
        return { hand: nextHand, middle: nextMiddle };
    }

    // Alle drei auf einmal.
    function swapAll(hand, middle) {
        return { hand: middle.slice(), middle: hand.slice() };
    }

    /*
     * Naechster Sitzplatz im Uhrzeigersinn. seats ist die aufsteigend sortierte
     * Liste der Plaetze, die noch mitspielen — wer weg ist, wird uebersprungen.
     */
    function nextSeat(seats, current) {
        if (!seats.length) return null;
        var sorted = seats.slice().sort(function (a, b) { return a - b; });
        for (var i = 0; i < sorted.length; i++) if (sorted[i] > current) return sorted[i];
        return sorted[0];
    }

    return {
        SUITS: SUITS,
        RANKS: RANKS,
        RANK_VALUE: RANK_VALUE,
        SUIT_PRIORITY: SUIT_PRIORITY,
        SUIT_NAME: SUIT_NAME,
        SUIT_SYMBOL: SUIT_SYMBOL,
        SUIT_COLOR: SUIT_COLOR,
        RANK_LABEL: RANK_LABEL,
        RANK_NAME: RANK_NAME,
        FIRE_SAFE_POINTS: FIRE_SAFE_POINTS,
        MAX_POINTS: MAX_POINTS,

        cardSuit: cardSuit,
        cardRank: cardRank,
        cardValue: cardValue,
        cardStrength: cardStrength,
        cardLabel: cardLabel,
        cardName: cardName,
        isCard: isCard,
        rankIndex: rankIndex,

        buildDeck: buildDeck,
        shuffle: shuffle,
        deal: deal,

        score: score,
        isFire: isFire,
        handStrength: handStrength,
        compareWeakness: compareWeakness,
        evaluateRound: evaluateRound,

        swapOne: swapOne,
        swapAll: swapAll,
        nextSeat: nextSeat
    };
});
