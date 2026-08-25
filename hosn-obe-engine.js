/*
 * Hos’n Obe (Schwimmen / 31 / Hosn Obe) — reine Spiel-Logik.
 *
 * Wird von index.html (TV) und hosn-obe.html (Handy) geteilt, damit beide
 * Seiten dieselbe Wertung rechnen. Enthält bewusst keinerlei DOM- oder
 * Firebase-Zugriffe, damit die Regeln mit `node hosn-obe-engine.test.js`
 * ohne Browser geprüft werden können.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.HosnObeEngine = api;
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
    var FIRE_PAY_BELOW = 11;      // bei Feuer zahlt jeder unter 11 Punkten

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

        // Schwaechster Sitz, eindeutig - bei Gleichstand entscheidet die
        // hoechste Einzelkarte, dann die Farbrangfolge.
        var lowest = Math.min.apply(null, seats.map(function (seat) { return scores[seat]; }));
        var tied = seats.filter(function (seat) { return scores[seat] === lowest; });

        var loserSeat = tied[0];
        for (var i = 1; i < tied.length; i++) {
            if (compareCards(highestCard(hands[tied[i]]), highestCard(hands[loserSeat])) < 0) {
                loserSeat = tied[i];
            }
        }

        if (fireSeats.length) {
            /*
             * Feuer: es wird nicht mehr getauscht, alle decken auf.
             * Zahlen muss jeder unter 11 Punkten - UND der Schwaechste in
             * jedem Fall, auch wenn der ueber 11 liegt.
             */
            var firePaying = seats.filter(function (seat) { return scores[seat] < FIRE_PAY_BELOW; });
            if (firePaying.indexOf(loserSeat) === -1) firePaying.push(loserSeat);
            firePaying.sort(function (a, b) { return a - b; });
            return {
                mode: 'fire',
                scores: scores,
                results: results,
                fireSeats: fireSeats,
                payingSeats: firePaying,
                loserSeat: loserSeat,
                tieBreak: tied.length > 1
            };
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

    // Zwei Rueckseiten-Motive, pro Karte zufaellig gemischt - dadurch sieht ein
    // verdeckter Faecher aus wie ein echtes Blatt und nicht wie eine Kachel.
    // Raster statt SVG: die SVG-Rueckseiten enthalten ein Linienmuster, das der
    // Browser bei jeder Groessenaenderung neu zeichnen muss - 18-mal gleichzeitig
    // auf der Odroid-Box war das der teuerste Posten im Bild.
    var CARD_BACKS = ['back_lightblue.webp', 'back_red.webp'];

    function cardBackImage(basePath, rng) {
        var random = rng || Math.random;
        var prefix = basePath === undefined ? 'cards/' : basePath;
        return prefix + CARD_BACKS[Math.floor(random() * CARD_BACKS.length) % CARD_BACKS.length];
    }

    /*
     * Darf "Alle 3 tauschen" angeboten werden?
     *
     * Nutzer-Vorgabe: nur wenn die offene Mitte selbst etwas hergibt - drei
     * gleiche Raenge (Drilling) oder drei gleiche Farben. Sonst ist der
     * Rundumtausch reine Zeitverschwendung und der Knopf bleibt weg.
     */
    function middleWorthTakingAll(middleCards) {
        if (!middleCards || middleCards.length !== 3) return false;
        var r = scoreHand(middleCards);
        return !!(r.threeOfAKind || r.flush);
    }

    /*
     * ---------- Computer-Spieler ----------
     *
     * FAIRNESS: botDecide() bekommt ausschliesslich die EIGENE Hand und die
     * offene Mitte - dieselben Informationen, die auch ein Gast am Handy sieht.
     * Die Funktion hat gar keinen Zugang zu fremden Haenden oder zum Reststapel,
     * kann also strukturell nicht schummeln. Ausgeteilt wird mit einem
     * gleichverteilten Fisher-Yates-Shuffle ueber das volle 32er-Blatt.
     */
    var BOT_KNOCK_STRONG = 29;      // damit endet die Runde sofort
    var BOT_KNOCK_SOLID = 24;       // solide Hand und nichts mehr zu holen
    var BOT_MIN_GAIN = 1;           // darunter lohnt kein Tausch
    var BOT_GIVEAWAY_WEIGHT = 0.18; // wie stark eine verschenkte hohe Karte zaehlt

    // Was die abgegebene Karte dem naechsten Spieler wert sein koennte. Der
    // Computer weiss nicht, was der braucht - aber eine hohe Karte hilft
    // statistisch mehr als eine niedrige, und eine, die zur vorherrschenden
    // Farbe der Mitte passt, besonders.
    function giveawayCost(code, middleCards) {
        var card = parseCard(code);
        var cost = card.value;
        var sameSuit = 0;
        for (var i = 0; i < middleCards.length; i++) {
            if (parseCard(middleCards[i]).suit === card.suit) sameSuit++;
        }
        if (sameSuit >= 1) cost += 3;
        return cost;
    }

    /*
     * Zugentscheidung.
     *
     * options: { canKnock: bool, canPass: bool }
     * Rueckgabe: { type: 'single', handIndex, middleIndex } | { type: 'all' }
     *            | { type: 'knock' } | { type: 'pass' } | { type: 'skip' }
     *
     * Reihenfolge:
     *   1. Hand praktisch unschlagbar -> klopfen.
     *   2. Bester echt verbessernder Tausch, abzueglich dessen, was man dem
     *      naechsten Spieler hinlegt.
     *   3. Nichts zu verbessern, Hand solide -> klopfen.
     *   4. Sonst weitergeben, statt sich selbst zu verschlechtern.
     */
    /*
     * Harte Obergrenze fuer eine Runde.
     *
     * Seit es den Zug "Weiter" gibt, kann eine Runde theoretisch ewig laufen:
     * geben alle nur noch weiter, aendert sich die Mitte nie und niemand muss
     * klopfen. Nach so vielen Zuegen wird deshalb aufgedeckt, egal was ist.
     */
    var MAX_ROUNDS = 4;
    function roundShouldEnd(turnsPlayed, playerCount) {
        var count = Number(playerCount) || 2;
        return (Number(turnsPlayed) || 0) >= count * MAX_ROUNDS;
    }

    // Je laenger die Runde dauert, desto eher gibt sich der Computer zufrieden -
    // sonst warten die Gaeste ewig auf ein Klopfen, das nie kommt.
    function botKnockThreshold(turnsPlayed, playerCount) {
        var count = Number(playerCount) || 2;
        var rounds = (Number(turnsPlayed) || 0) / count;
        if (rounds < 2) return BOT_KNOCK_SOLID;              // 24
        if (rounds < 3) return BOT_KNOCK_SOLID - 3;          // 21
        return BOT_KNOCK_SOLID - 7;                          // 17
    }

    function botDecide(hand, middleCards, options) {
        var opts = options || {};
        if (!hand || hand.length !== 3 || !middleCards || middleCards.length !== 3) {
            return { type: 'skip' };
        }

        var current = scoreHand(hand).score;
        var knockAt = botKnockThreshold(opts.turnsPlayed, opts.playerCount);

        if (opts.canKnock && current >= BOT_KNOCK_STRONG) return { type: 'knock' };

        /*
         * Liegt in der Mitte ein Drilling oder drei gleiche Farben, gilt
         * "alle oder keine": ein Einzeltausch wuerde den Satz zerreissen und
         * ist deshalb gesperrt - fuer den Computer genauso wie fuer die Gaeste.
         */
        var allOrNothing = middleWorthTakingAll(middleCards);
        var best = null;

        if (allOrNothing) {
            var setValue = scoreHand(middleCards).score;
            if (setValue >= current + BOT_MIN_GAIN) return { type: 'all' };
            if (opts.canKnock && current >= knockAt) return { type: 'knock' };
            return { type: 'pass' };
        }

        for (var h = 0; h < 3; h++) {
            for (var m = 0; m < 3; m++) {
                var trial = hand.slice();
                trial[h] = middleCards[m];
                var value = scoreHand(trial).score;
                var utility = value - BOT_GIVEAWAY_WEIGHT * giveawayCost(hand[h], middleCards);
                if (!best || utility > best.utility) {
                    best = { type: 'single', handIndex: h, middleIndex: m, value: value, utility: utility };
                }
            }
        }

        if (best && best.value >= current + BOT_MIN_GAIN) {
            return best.type === 'all'
                ? { type: 'all' }
                : { type: 'single', handIndex: best.handIndex, middleIndex: best.middleIndex };
        }

        if (opts.canKnock && current >= knockAt) return { type: 'knock' };

        // Lieber weitergeben als die eigene Hand verschlechtern.
        if (opts.canPass) return { type: 'pass' };

        return best && best.type === 'single'
            ? { type: 'single', handIndex: best.handIndex, middleIndex: best.middleIndex }
            : { type: 'pass' };
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
        cardLabel: cardLabel,
        CARD_BACKS: CARD_BACKS,
        cardBackImage: cardBackImage,
        middleWorthTakingAll: middleWorthTakingAll,
        BOT_KNOCK_STRONG: BOT_KNOCK_STRONG,
        BOT_KNOCK_SOLID: BOT_KNOCK_SOLID,
        MAX_ROUNDS: MAX_ROUNDS,
        roundShouldEnd: roundShouldEnd,
        botKnockThreshold: botKnockThreshold,
        giveawayCost: giveawayCost,
        botDecide: botDecide
    };
});
