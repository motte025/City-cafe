/*
 * Kartentausch (Schwimmen / 31 / Hosn Obe) — reine Spiel-Logik.
 *
 * Wird von index.html (TV) und kartentausch.html (Handy) geteilt, damit beide
 * Seiten dieselbe Wertung rechnen. Enthält bewusst keinerlei DOM- oder
 * Firebase-Zugriffe, damit die Regeln mit `node kartentausch-engine.test.js`
 * ohne Browser geprüft werden können.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KartentauschEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Kartencode = Farbbuchstabe + Rang, z. B. "H7", "D10", "SA", "HK".
    var SUITS = ['H', 'S', 'D', 'C'];                                  // Herz, Pik, Karo, Kreuz
    var RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];             // 32er-Skat-Blatt

    var CARD_VALUE = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };

    // Für den Tie-Break wird nach Rang-Reihenfolge verglichen, nicht nach
    // Punktwert: sonst wären Bube/Dame/König/Zehn alle gleich "10" und zwei
    // Spieler könnten unauflösbar gleichstehen. Rang + Farbe ist pro Deck
    // eindeutig, also gibt es immer genau einen Verlierer.
    var RANK_ORDER = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 };
    var SUIT_ORDER = { 'H': 3, 'S': 2, 'D': 1, 'C': 0 };               // Herz > Pik > Karo > Kreuz

    var SUIT_NAME = { H: 'Herz', S: 'Pik', D: 'Karo', C: 'Kreuz' };
    var SUIT_SYMBOL = { H: '♥', S: '♠', D: '♦', C: '♣' };
    var RANK_NAME = { '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'Bube', 'Q': 'Dame', 'K': 'König', 'A': 'Ass' };

    var SUIT_FILE = { H: 'hearts', S: 'spades', D: 'diamonds', C: 'clubs' };
    var RANK_FILE = { '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king', 'A': 'ace' };

    var FIRE_TOTAL = 31;          // gleichfarbiger Flush mit exakt 31 = "Feuer"
    var FIRE_PAY_BELOW = 12;      // bei Feuer zahlt jeder unter 12 Punkten

    function parseCard(code) {
        var suit = code.charAt(0);
        var rank = code.slice(1);
        if (!SUIT_ORDER.hasOwnProperty(suit) || !RANK_ORDER.hasOwnProperty(rank)) {
            throw new Error('Unbekannter Kartencode: ' + code);
        }
        return { suit: suit, rank: rank, value: CARD_VALUE[rank] };
    }

    function buildDeck() {
        var deck = [];
        for (var s = 0; s < SUITS.length; s++) {
            for (var r = 0; r < RANKS.length; r++) deck.push(SUITS[s] + RANKS[r]);
        }
        return deck;
    }

    function shuffle(deck, rng) {
        var random = rng || Math.random;
        var out = deck.slice();
        for (var i = out.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var tmp = out[i];
            out[i] = out[j];
            out[j] = tmp;
        }
        return out;
    }

    function deal(playerCount, rng) {
        if (playerCount < 2 || playerCount > 6) throw new Error('Spieleranzahl muss 2-6 sein, war: ' + playerCount);
        var deck = shuffle(buildDeck(), rng);
        var hands = {};
        var at = 0;
        for (var seat = 0; seat < playerCount; seat++) {
            hands[seat] = [deck[at++], deck[at++], deck[at++]];
        }
        return { hands: hands, middleCards: [deck[at++], deck[at++], deck[at++]] };
    }

    /*
     * Wertung einer 3-Karten-Hand:
     *   - gleiche Farbe: Punktwerte addieren (bester Farb-Teilstapel zählt)
     *   - drei gleiche Ränge: 31 Punkte, aber ausdrücklich KEIN Feuer
     *   - "Feuer": alle drei gleiche Farbe UND Summe exakt 31 (Ass + zwei Zehner-Karten)
     */
    function scoreHand(cards) {
        var parsed = cards.map(parseCard);

        var bySuit = {};
        for (var i = 0; i < parsed.length; i++) {
            bySuit[parsed[i].suit] = (bySuit[parsed[i].suit] || 0) + parsed[i].value;
        }
        var bestSuitTotal = 0;
        var bestSuit = null;
        for (var suit in bySuit) {
            if (bySuit[suit] > bestSuitTotal) {
                bestSuitTotal = bySuit[suit];
                bestSuit = suit;
            }
        }

        var isFlush = parsed[0].suit === parsed[1].suit && parsed[1].suit === parsed[2].suit;
        var isThreeOfAKind = parsed[0].rank === parsed[1].rank && parsed[1].rank === parsed[2].rank;
        var isFire = isFlush && bestSuitTotal === FIRE_TOTAL;

        var score = isThreeOfAKind ? FIRE_TOTAL : bestSuitTotal;

        return {
            score: score,
            suit: isThreeOfAKind ? null : bestSuit,
            fire: isFire,
            threeOfAKind: isThreeOfAKind,
            flush: isFlush
        };
    }

    // >0 wenn a stärker als b. Zwei verschiedene Karten sind nie gleich stark.
    function compareCards(a, b) {
        var pa = parseCard(a);
        var pb = parseCard(b);
        if (RANK_ORDER[pa.rank] !== RANK_ORDER[pb.rank]) return RANK_ORDER[pa.rank] - RANK_ORDER[pb.rank];
        return SUIT_ORDER[pa.suit] - SUIT_ORDER[pb.suit];
    }

    function highestCard(cards) {
        var best = cards[0];
        for (var i = 1; i < cards.length; i++) {
            if (compareCards(cards[i], best) > 0) best = cards[i];
        }
        return best;
    }

    /*
     * Rundenauswertung.
     *
     * Normalfall: niedrigste Punktzahl verliert. Bei Gleichstand entscheidet die
     * höchste Einzelkarte (Rang, dann Herz > Pik > Karo > Kreuz) — wer die
     * niedrigste davon hat, verliert. Ergebnis ist immer genau ein Verlierer.
     *
     * Feuer: die Ein-Verlierer-Regel fällt weg, stattdessen zahlt jeder Spieler
     * unter 12 Punkten. Das können 0, 1 oder mehrere sein.
     */
    function evaluateRound(hands) {
        var seats = Object.keys(hands).map(Number).sort(function (a, b) { return a - b; });
        if (!seats.length) throw new Error('Keine Hände zum Auswerten');

        var results = {};
        var scores = {};
        var fireSeats = [];
        seats.forEach(function (seat) {
            var r = scoreHand(hands[seat]);
            results[seat] = r;
            scores[seat] = r.score;
            if (r.fire) fireSeats.push(seat);
        });

        if (fireSeats.length) {
            return {
                mode: 'fire',
                scores: scores,
                results: results,
                fireSeats: fireSeats,
                payingSeats: seats.filter(function (seat) { return scores[seat] < FIRE_PAY_BELOW; }),
                loserSeat: null,
                tieBreak: false
            };
        }

        var lowest = Math.min.apply(null, seats.map(function (seat) { return scores[seat]; }));
        var tied = seats.filter(function (seat) { return scores[seat] === lowest; });

        var loserSeat = tied[0];
        for (var i = 1; i < tied.length; i++) {
            if (compareCards(highestCard(hands[tied[i]]), highestCard(hands[loserSeat])) < 0) {
                loserSeat = tied[i];
            }
        }

        return {
            mode: 'normal',
            scores: scores,
            results: results,
            fireSeats: [],
            payingSeats: [loserSeat],
            loserSeat: loserSeat,
            tieBreak: tied.length > 1
        };
    }

    function nextSeat(currentSeat, playerCount) {
        return (currentSeat + 1) % playerCount;
    }

    // Dateinamen im Repo sind uneinheitlich gewachsen: Bildkarten und Pik-Ass
    // tragen ein "2" am Ende, die übrigen Asse und alle Zahlenkarten nicht.
    function cardImage(code, basePath) {
        var p = parseCard(code);
        var needsSuffix = p.rank === 'J' || p.rank === 'Q' || p.rank === 'K' || (p.rank === 'A' && p.suit === 'S');
        var prefix = basePath === undefined ? 'cards/' : basePath;
        return prefix + RANK_FILE[p.rank] + '_of_' + SUIT_FILE[p.suit] + (needsSuffix ? '2' : '') + '.webp';
    }

    function cardLabel(code) {
        var p = parseCard(code);
        return SUIT_SYMBOL[p.suit] + ' ' + RANK_NAME[p.rank];
    }

    return {
        SUITS: SUITS,
        RANKS: RANKS,
        CARD_VALUE: CARD_VALUE,
        SUIT_NAME: SUIT_NAME,
        SUIT_SYMBOL: SUIT_SYMBOL,
        RANK_NAME: RANK_NAME,
        FIRE_TOTAL: FIRE_TOTAL,
        FIRE_PAY_BELOW: FIRE_PAY_BELOW,
        parseCard: parseCard,
        buildDeck: buildDeck,
        shuffle: shuffle,
        deal: deal,
        scoreHand: scoreHand,
        compareCards: compareCards,
        highestCard: highestCard,
        evaluateRound: evaluateRound,
        nextSeat: nextSeat,
        cardImage: cardImage,
        cardLabel: cardLabel
    };
});
