/*
 * Tischrunde — Hos'n Obe: Spieltisch.
 *
 * Legt eine eigene Ansicht ueber die Spielauswahl — kein Seitenwechsel, kein
 * Neuladen. Weil es keinen Fernseher mehr gibt, zeigt jedes Handy beides: die
 * eigene Hand und den offenen Tisch.
 *
 * Einbinden:
 *     Tischrunde.HosnObe.open({ onExit: zurueckZurAuswahl });
 */
(function (root) {
    'use strict';

    var Engine = root.HosnObeEngine;
    var Net = root.HosnObeNet;

    var NAME_KEY = 'tischrunde.name';
    var CODE_KEY = 'tischrunde.lastCode';

    // Nach so vielen Sekunden darf der Tisch einen haengenden Zug weitergeben.
    var SKIP_AFTER = 45;
    // So lange wird am Rundenende auf fehlende Handys gewartet.
    var REVEAL_GRACE = 8;

    var el = null;
    var body = null;
    var actions = null;
    var head = null;

    var opts = {};
    var unsubscribe = null;
    var ticker = null;

    var ui = {
        screen: 'home',      // home | lobby | table | reveal
        name: '',
        codeInput: '',
        pickHand: null,
        pickMiddle: null,
        error: '',
        busy: false,
        forceReveal: false,
        revealSince: 0,
        rulesOpen: false
    };

    var snap = { pub: null, hand: null, players: [], seat: null, code: null, uid: null };

    /* --- Kleinkram ---------------------------------------------------------- */

    function escapeHtml(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function store(key, value) {
        try { root.localStorage.setItem(key, value); } catch (e) { /* Privater Modus */ }
    }

    function recall(key) {
        try { return root.localStorage.getItem(key) || ''; } catch (e) { return ''; }
    }

    function seconds(since) {
        if (!since) return 0;
        return Math.max(0, Math.round((Date.now() - since) / 1000));
    }

    /* --- Kartenbilder -------------------------------------------------------- */

    function cardHtml(id, extra) {
        extra = extra || {};
        if (!id) return '<div class="tr-card tr-card--empty"></div>';

        var suit = Engine.cardSuit(id);
        var label = Engine.RANK_LABEL[Engine.cardRank(id)];
        var symbol = Engine.SUIT_SYMBOL[suit];
        var corner = escapeHtml(label) + '<i>' + symbol + '</i>';

        var classes = ['tr-card'];
        if (extra.pick) classes.push('tr-card--pick');
        if (extra.selected) classes.push('is-selected');
        if (extra.target) classes.push('is-target');
        if (extra.fire) classes.push('is-fire');

        var attrs = ' data-suit="' + suit + '"';
        if (extra.pick) attrs += ' data-pick="' + extra.pick + '" data-index="' + extra.index + '"';

        return '<div class="' + classes.join(' ') + '"' + attrs +
            ' role="img" aria-label="' + escapeHtml(Engine.cardName(id)) + '">' +
            '<span class="tr-card__corner tr-card__corner--tl">' + corner + '</span>' +
            '<span class="tr-card__pip">' + symbol + '</span>' +
            '<span class="tr-card__corner tr-card__corner--br">' + corner + '</span>' +
            '</div>';
    }

    function backHtml() { return '<div class="tr-card tr-card--back"></div>'; }

    function cardsHtml(list, extraFor) {
        var out = '';
        for (var i = 0; i < 3; i++) {
            out += list && list[i] ? cardHtml(list[i], extraFor ? extraFor(i, list[i]) : null) : backHtml();
        }
        return '<div class="tr-cards">' + out + '</div>';
    }

    /* --- Ansichten ------------------------------------------------------------ */

    function alertHtml() {
        if (!ui.error) return '';
        return '<div class="tr-alert">' + escapeHtml(ui.error) + '</div>';
    }

    function rulesHtml() {
        // Der Aufklapper behaelt seinen Zustand, sonst klappt er bei jedem
        // fremden Zug wieder zu.
        return '<details class="tr-rules"' + (ui.rulesOpen ? ' open' : '') + '><summary>Regeln</summary><ul>' +
            '<li>32 Karten von der Sieben bis zum Ass. Jeder hat <b>drei Karten</b>, drei liegen offen in der Mitte.</li>' +
            '<li>Am Zug: <b>eine Karte tauschen</b>, <b>alle drei tauschen</b> oder <b>klopfen</b>.</li>' +
            '<li>Nach dem Klopfen hat jeder andere noch <b>genau einen Zug</b>, dann wird aufgedeckt.</li>' +
            '<li>Gewertet wird die <b>höchste Kartensumme in einer Farbe</b>. Bube, Dame und König zählen 10, das Ass 11.</li>' +
            '<li><b>Drei gleiche Ränge</b> zählen pauschal 31 — das ist ausdrücklich kein Feuer.</li>' +
            '<li><b>Feuer</b> sind drei Karten derselben Farbe mit genau 31. Feuer beendet die Runde sofort; ' +
            'dann verliert jeder unter zwölf Punkten — das können auch null oder mehrere sein.</li>' +
            '<li>Sonst verliert genau einer: die niedrigste Hand. Bei Gleichstand entscheidet die höchste ' +
            'Einzelkarte, danach Herz vor Pik vor Karo vor Kreuz.</li>' +
            '</ul></details>';
    }

    function renderHome() {
        var lastCode = recall(CODE_KEY);
        var ready = Net.configured();

        var html = '<div class="tr-panel">' + alertHtml();

        if (!ready) {
            html += '<div class="tr-alert">Es sind noch keine Firebase-Zugangsdaten hinterlegt. ' +
                'Trag sie in <b>hosnobe-config.js</b> ein — wie das geht, steht in der README.</div>';
        }

        html += '<p class="tr-lead">Ein Tisch, sechs Handys, kein gemeinsamer Fernseher. ' +
            'Wer eröffnet, bekommt einen Code; alle anderen tippen ihn ein.</p>';

        html += '<div class="tr-field">' +
            '<label class="tr-label" for="tr-name">Dein Name</label>' +
            '<input class="tr-input" id="tr-name" type="text" maxlength="16" autocomplete="nickname" ' +
            'placeholder="z. B. Moritz" value="' + escapeHtml(ui.name) + '">' +
            '</div>';

        html += '<button class="tr-btn" data-do="create"' + (ready ? '' : ' disabled') + '>Tisch eröffnen</button>';
        html += '<div class="tr-or">oder beitreten</div>';

        // Eingabefeld und Platzhalter richten sich nach der eingestellten Laenge.
        var codeLength = (root.HosnObeConfig && root.HosnObeConfig.codeLength) || 4;
        var placeholder = new Array(codeLength + 1).join('–');

        html += '<div class="tr-field">' +
            '<label class="tr-label" for="tr-code">Einladungscode</label>' +
            '<input class="tr-input tr-input--code" id="tr-code" type="text" inputmode="numeric" ' +
            'pattern="[0-9]*" maxlength="' + codeLength + '" placeholder="' + placeholder + '" ' +
            'value="' + escapeHtml(ui.codeInput) + '">' +
            '</div>';

        html += '<button class="tr-btn tr-btn--ghost" data-do="join"' + (ready ? '' : ' disabled') + '>Mitspielen</button>';

        if (lastCode && ready) {
            html += '<p class="tr-note">Zuletzt gespielt an Tisch <b>' + escapeHtml(lastCode) + '</b>. ' +
                'Denselben Code eintippen setzt dich wieder auf deinen Platz.</p>';
        }

        html += rulesHtml() + '</div>';
        body.innerHTML = html;
        actions.innerHTML = '';
        actions.hidden = true;
    }

    function renderLobby() {
        var players = snap.players;
        var min = (root.HosnObeConfig && root.HosnObeConfig.minPlayers) || 2;
        var max = (root.HosnObeConfig && root.HosnObeConfig.maxPlayers) || 6;
        var online = players.filter(function (p) { return p.online; });
        var isHost = players.some(function (p) { return p.isMe && p.isHost; });

        var html = '<div class="tr-panel">' + alertHtml();

        html += '<div class="tr-banner"><h2>Tisch ' + escapeHtml(snap.code) + '</h2>' +
            '<p>Diesen Code sagen die anderen ihrer App. Es passen ' + min + ' bis ' + max + ' Spieler an den Tisch.</p></div>';

        html += '<div class="tr-section">Am Tisch <span>' + online.length + ' von ' + max + '</span></div>';
        html += '<div class="tr-seats">' + players.map(seatHtml).join('') + '</div>';

        if (online.length < min) {
            html += '<p class="tr-note">Es fehlt noch mindestens ein Mitspieler.</p>';
        } else if (!isHost) {
            html += '<p class="tr-note">Sobald der Gastgeber startet, wird ausgeteilt.</p>';
        }

        html += rulesHtml() + '</div>';
        body.innerHTML = html;

        var canStart = isHost && online.length >= min;
        actions.hidden = false;
        actions.innerHTML =
            '<button class="tr-btn tr-btn--wide" data-do="start"' + (canStart ? '' : ' disabled') + '>' +
            (isHost ? 'Spiel starten' : 'Warten auf den Gastgeber') + '</button>' +
            '<button class="tr-btn tr-btn--quiet tr-btn--wide" data-do="leave">Tisch verlassen</button>';
    }

    function seatHtml(p, extra) {
        var pub = snap.pub;
        var classes = ['tr-seat'];
        if (pub && pub.status === 'playing' && pub.turnSeat === p.seat) classes.push('is-turn');
        if (!p.online) classes.push('is-out');
        if (extra && extra.loser) classes.push('is-loser');

        // In der Lobby zaehlt der Sitzplatz, am laufenden Tisch nur noch, wer
        // gibt, geklopft hat oder weg ist — sonst wird die Kachel zu voll.
        var lobby = !pub || pub.status === 'lobby';
        var meta = [];
        if (lobby) meta.push('Platz ' + (p.seat + 1));
        if (p.isMe) meta.push('du');
        if (p.isHost && lobby) meta.push('Gastgeber');
        if (pub && pub.dealerSeat === p.seat && !lobby) meta.push('gibt');
        if (pub && pub.knockedBy === p.seat) meta.push('geklopft');
        if (!p.online) meta.push('weg');
        if (!meta.length) meta.push('Platz ' + (p.seat + 1));

        return '<div class="' + classes.join(' ') + '">' +
            '<span class="tr-seat__name">' + escapeHtml(p.name) + '</span>' +
            '<span class="tr-seat__meta">' + meta.join(' · ') + '</span>' +
            '</div>';
    }

    function renderTable() {
        var pub = snap.pub;
        var hand = snap.hand;
        var mine = Net.isMyTurn();

        var html = '<div class="tr-panel">' + alertHtml();

        html += '<div class="tr-seats">' + snap.players.map(function (p) { return seatHtml(p); }).join('') + '</div>';
        html += statusHtml(mine);

        // Die offene Mitte — auf jedem Handy zu sehen.
        html += '<div class="tr-zone"><div class="tr-zonehead"><div class="tr-section">Mitte</div></div>' +
            cardsHtml(pub.middle, function (i) {
                return {
                    pick: mine && hand ? 'middle' : null,
                    index: i,
                    selected: ui.pickMiddle === i,
                    target: ui.pickHand !== null
                };
            }) + '</div>';

        // Die eigene Hand.
        html += '<div class="tr-zone tr-zone--mine"><div class="tr-zonehead">' +
            '<div class="tr-section">Deine Hand</div>' + handScoreHtml(hand) + '</div>' +
            cardsHtml(hand, function (i) {
                return {
                    pick: mine ? 'hand' : null,
                    index: i,
                    selected: ui.pickHand === i,
                    target: ui.pickMiddle !== null
                };
            }) + '</div>';

        html += rulesHtml();

        // Der Pfeil oben laesst den Platz stehen — hier geht man wirklich weg.
        html += '<div class="tr-leaverow">' +
            '<button class="tr-btn tr-btn--quiet" data-do="leave">Tisch verlassen</button></div>';

        html += '</div>';
        body.innerHTML = html;

        renderTableActions(mine, hand);
    }

    function handScoreHtml(hand) {
        if (!hand || hand.length !== 3) return '';
        var s = Engine.score(hand);
        var suffix = s.fire ? ' Feuer' : (s.kind === 'trips' ? ' Drilling' : ' ' + Engine.SUIT_NAME[s.suit]);
        return '<div class="tr-score"><b>' + s.points + '</b>' + escapeHtml(suffix) + '</div>';
    }

    function statusHtml(mine) {
        var pub = snap.pub;
        var classes = ['tr-status'];
        var text;

        if (pub.status === 'dealing') {
            text = 'Es wird ausgeteilt …';
        } else if (mine) {
            classes.push('is-mine');
            text = ui.pickHand !== null
                ? 'Jetzt eine Karte aus der Mitte antippen — oder noch einmal auf deine Karte, um die Wahl aufzuheben.'
                : (ui.pickMiddle !== null
                    ? 'Jetzt eine deiner Karten antippen.'
                    : 'Du bist am Zug.');
        } else {
            var atTurn = snap.players.filter(function (p) { return p.seat === pub.turnSeat; })[0];
            text = atTurn ? escapeHtml(atTurn.name) + ' ist am Zug.' : 'Warten auf den nächsten Zug.';
        }

        if (pub.knockedBy !== null && pub.knockedBy !== undefined) {
            var knocker = snap.players.filter(function (p) { return p.seat === pub.knockedBy; })[0];
            var left = typeof pub.turnsLeft === 'number' ? pub.turnsLeft : 0;
            classes.push('is-alarm');
            text += ' ' + (knocker ? escapeHtml(knocker.name) : 'Jemand') + ' hat geklopft — noch ' +
                left + (left === 1 ? ' Zug' : ' Züge') + ', dann wird aufgedeckt.';
        }

        return '<div class="' + classes.join(' ') + '"><span class="tr-status__dot"></span><span>' + text + '</span></div>';
    }

    function renderTableActions(mine, hand) {
        var pub = snap.pub;
        actions.hidden = false;

        if (pub.status === 'dealing') {
            actions.innerHTML = '<div class="tr-hint">Karten werden gegeben</div>';
            return;
        }

        if (!mine) {
            var idle = seconds(pub.turnStartedAt);
            var html = '<div class="tr-hint">Warten — ' + idle + ' s</div>';
            if (idle >= SKIP_AFTER) {
                html += '<button class="tr-btn tr-btn--quiet tr-btn--wide" data-do="skip">Zug weitergeben</button>';
            }
            actions.innerHTML = html;
            return;
        }

        var canSwapOne = !!(hand && ui.pickHand !== null && ui.pickMiddle !== null);
        var knocked = pub.knockedBy !== null && pub.knockedBy !== undefined;

        actions.innerHTML =
            '<button class="tr-btn" data-do="swapOne"' + (canSwapOne ? '' : ' disabled') + '>Tauschen</button>' +
            '<button class="tr-btn tr-btn--ghost" data-do="swapAll"' + (hand ? '' : ' disabled') + '>Alle drei</button>' +
            '<button class="tr-btn tr-btn--quiet tr-btn--wide" data-do="knock"' + (knocked ? ' disabled' : '') + '>' +
            (knocked ? 'Es wurde schon geklopft' : 'Klopfen') + '</button>';
    }

    /* --- Aufdecken ------------------------------------------------------------ */

    function renderReveal() {
        var pub = snap.pub;
        var revealed = pub.reveal || {};

        var expected = snap.players.filter(function (p) { return p.online; });
        var missing = expected.filter(function (p) { return !revealed[p.uid]; });
        var waited = seconds(ui.revealSince);

        if (missing.length && !ui.forceReveal && waited < REVEAL_GRACE) {
            body.innerHTML = '<div class="tr-panel">' + alertHtml() +
                '<div class="tr-banner"><h2>Aufdecken</h2><p>Es wird noch auf ' +
                missing.map(function (p) { return escapeHtml(p.name); }).join(', ') + ' gewartet.</p></div>' +
                '<div class="tr-waiting">' + (REVEAL_GRACE - waited) + ' s …</div></div>';
            actions.hidden = false;
            actions.innerHTML = '<div class="tr-hint">Karten werden aufgedeckt</div>';
            return;
        }

        var entries = [];
        snap.players.forEach(function (p) {
            var r = revealed[p.uid];
            if (r && r.hand && r.hand.length === 3) entries.push({ seat: p.seat, uid: p.uid, hand: r.hand });
        });

        var result = Engine.evaluateRound(entries);
        var bySeat = {};
        result.results.forEach(function (r) { bySeat[r.seat] = r; });
        var isFire = result.ending === 'fire';

        var html = '<div class="tr-panel">' + alertHtml();
        html += bannerHtml(result, isFire);

        // Absteigend nach Punkten, damit der Verlierer unten steht.
        var order = snap.players.slice().sort(function (a, b) {
            var ra = bySeat[a.seat], rb = bySeat[b.seat];
            if (!ra && !rb) return a.seat - b.seat;
            if (!ra) return 1;
            if (!rb) return -1;
            return Engine.compareWeakness(rb, ra);
        });

        order.forEach(function (p) {
            var r = bySeat[p.seat];
            var loser = result.losers.indexOf(p.seat) !== -1;
            var classes = ['tr-reveal'];
            if (loser) classes.push('is-loser');
            if (r && r.fire) classes.push('is-fire');

            var tag;
            if (!r) tag = 'nicht aufgedeckt';
            else if (r.fire) tag = 'Feuer · 31';
            else if (r.kind === 'trips') tag = 'Drilling · 31';
            else tag = Engine.SUIT_NAME[r.suit] + ' · ' + r.points;
            if (loser) tag += ' · verloren';

            html += '<div class="' + classes.join(' ') + '">' +
                '<div class="tr-reveal__head">' +
                '<span class="tr-reveal__name">' + escapeHtml(p.name) + (p.isMe ? ' (du)' : '') + '</span>' +
                '<span class="tr-reveal__tag">' + escapeHtml(tag) + '</span>' +
                '</div>' +
                (r ? cardsHtml(r.hand, function (i, id) {
                    return { fire: r.fire && Engine.cardSuit(id) === r.suit };
                }) : '<div class="tr-cards">' + backHtml() + backHtml() + backHtml() + '</div>') +
                '</div>';
        });

        if (missing.length) {
            html += '<p class="tr-note">Ohne Karten von ' +
                missing.map(function (p) { return escapeHtml(p.name); }).join(', ') +
                ' — diese Hände zählen für die Wertung nicht mit.</p>';
        }

        html += '</div>';
        body.innerHTML = html;

        actions.hidden = false;
        actions.innerHTML =
            '<button class="tr-btn tr-btn--wide" data-do="next">Nächste Runde</button>' +
            '<button class="tr-btn tr-btn--quiet" data-do="lobby">Zur Lobby</button>' +
            '<button class="tr-btn tr-btn--quiet" data-do="leave">Verlassen</button>';
    }

    function bannerHtml(result, isFire) {
        var names = function (seats) {
            return seats.map(function (seat) {
                var p = snap.players.filter(function (x) { return x.seat === seat; })[0];
                return p ? escapeHtml(p.name) : 'Platz ' + (seat + 1);
            });
        };

        if (isFire) {
            var fireNames = names(result.fireSeats);
            var loserNames = names(result.losers);
            var text = loserNames.length
                ? (loserNames.length === 1 ? loserNames[0] + ' verliert' : loserNames.join(', ') + ' verlieren') +
                  ' die Runde — unter zwölf Punkten.'
                : 'Diesmal kommen alle davon: niemand liegt unter zwölf Punkten.';
            return '<div class="tr-banner tr-banner--fire"><h2>Feuer</h2><p>' +
                fireNames.join(' und ') + ' hatte drei Karten einer Farbe mit genau 31. ' + text + '</p></div>';
        }

        if (!result.losers.length) {
            return '<div class="tr-banner"><h2>Aufgedeckt</h2><p>Es hat niemand aufgedeckt.</p></div>';
        }

        var loser = names(result.losers)[0];
        var r = result.results.filter(function (x) { return x.seat === result.losers[0]; })[0];
        return '<div class="tr-banner"><h2>' + loser + ' verliert</h2>' +
            '<p>Niedrigste Hand mit ' + r.points + ' Punkten.</p></div>';
    }

    /* --- Ablaufsteuerung ------------------------------------------------------- */

    function screenFor(pub) {
        if (!pub) return 'home';
        if (pub.status === 'lobby') return 'lobby';
        if (pub.status === 'reveal') return 'reveal';
        return 'table';
    }

    function render() {
        if (!el) return;

        var next = screenFor(snap.pub);
        if (next !== ui.screen) {
            // Beim Wechsel die halbfertige Kartenwahl vergessen.
            ui.pickHand = null;
            ui.pickMiddle = null;
            if (next === 'reveal') { ui.revealSince = Date.now(); ui.forceReveal = false; }
            ui.screen = next;
        }

        head.querySelector('.tr-codechip').textContent = snap.code || '';
        head.querySelector('.tr-codechip').hidden = !snap.code;

        var sub = head.querySelector('.tr-title small');
        var pub = snap.pub;
        sub.textContent = pub && pub.round
            ? 'Runde ' + pub.round + ' · Tischrunde'
            : 'Schwimmen · 31';

        // Beim Neuzeichnen springt die Ansicht sonst an den Anfang zurueck.
        var scrolled = body.scrollTop;

        if (ui.screen === 'home') renderHome();
        else if (ui.screen === 'lobby') renderLobby();
        else if (ui.screen === 'reveal') renderReveal();
        else renderTable();

        if (scrolled) body.scrollTop = scrolled;
        setTicker(ui.screen === 'table' || ui.screen === 'reveal');
    }

    function setTicker(on) {
        if (on && !ticker) ticker = root.setInterval(tick, 1000);
        if (!on && ticker) { root.clearInterval(ticker); ticker = null; }
    }

    /*
     * Sekundentakt fuer die mitlaufenden Zahlen. Hier wird bewusst nur der
     * Text ausgetauscht und nicht neu gezeichnet: sonst verschwaende ein
     * Schalter genau in dem Moment unter dem Finger, in dem jemand ihn
     * antippt. Neu gezeichnet wird nur, wenn eine Schwelle faellt.
     */
    function tick() {
        if (!el) return;

        if (ui.screen === 'table') {
            var pub = snap.pub;
            if (!pub || pub.status !== 'playing' || Net.isMyTurn()) return;

            var idle = seconds(pub.turnStartedAt);
            var hint = actions.querySelector('.tr-hint');
            if (hint) hint.textContent = 'Warten — ' + idle + ' s';

            // Erst wenn der Weitergeben-Schalter dazukommt, lohnt das Neuzeichnen.
            var wanted = idle >= SKIP_AFTER;
            if (wanted !== !!actions.querySelector('[data-do="skip"]')) render();
            return;
        }

        if (ui.screen === 'reveal') {
            var left = REVEAL_GRACE - seconds(ui.revealSince);
            var waiting = body.querySelector('.tr-waiting');
            if (!waiting) return;                    // schon ausgewertet
            if (left > 0) waiting.textContent = left + ' s …';
            else render();
        }
    }

    function fail(e) {
        ui.error = e && e.message ? e.message : String(e);
        ui.busy = false;
        render();
    }

    function run(promise) {
        ui.busy = true;
        ui.error = '';
        render();
        return Promise.resolve(promise).then(function (r) {
            ui.busy = false;
            return r;
        }).catch(fail);
    }

    /* --- Bedienung -------------------------------------------------------------- */

    function readInputs() {
        var name = el.querySelector('#tr-name');
        var code = el.querySelector('#tr-code');
        if (name) ui.name = name.value;
        if (code) ui.codeInput = code.value.replace(/\D/g, '');
    }

    function onClick(event) {
        var card = event.target.closest('[data-pick]');
        if (card) { pickCard(card.getAttribute('data-pick'), Number(card.getAttribute('data-index'))); return; }

        var button = event.target.closest('[data-do]');
        if (!button || button.disabled) return;
        var todo = button.getAttribute('data-do');
        readInputs();

        if (todo === 'create') {
            store(NAME_KEY, ui.name);
            run(Net.createRoom(ui.name).then(function (r) { store(CODE_KEY, r.code); }));
        } else if (todo === 'join') {
            var wanted = (root.HosnObeConfig && root.HosnObeConfig.codeLength) || 4;
            if (ui.codeInput.length !== wanted) {
                return fail(new Error('Der Einladungscode hat ' + wanted + ' Ziffern.'));
            }
            store(NAME_KEY, ui.name);
            run(Net.joinRoom(ui.codeInput, ui.name).then(function (r) { store(CODE_KEY, r.code); }));
        } else if (todo === 'start') {
            run(Net.startGame());
        } else if (todo === 'swapOne') {
            var h = ui.pickHand, m = ui.pickMiddle;
            ui.pickHand = null; ui.pickMiddle = null;
            run(Net.swapOne(h, m));
        } else if (todo === 'swapAll') {
            ui.pickHand = null; ui.pickMiddle = null;
            run(Net.swapAll());
        } else if (todo === 'knock') {
            ui.pickHand = null; ui.pickMiddle = null;
            run(Net.knock());
        } else if (todo === 'skip') {
            run(Net.skipTurn());
        } else if (todo === 'next') {
            run(Net.nextRound());
        } else if (todo === 'lobby') {
            run(Net.backToLobby());
        } else if (todo === 'leave') {
            run(Net.leave().then(function () { ui.screen = 'home'; render(); }));
        }
    }

    /*
     * Karte antippen. Sobald eine Handkarte und eine Mittenkarte gewaehlt sind,
     * wird sofort getauscht — das erspart den zusaetzlichen Griff zum Schalter.
     */
    function pickCard(where, index) {
        if (!Net.isMyTurn()) return;

        if (where === 'hand') {
            ui.pickHand = ui.pickHand === index ? null : index;
        } else {
            ui.pickMiddle = ui.pickMiddle === index ? null : index;
        }

        if (ui.pickHand !== null && ui.pickMiddle !== null) {
            var h = ui.pickHand, m = ui.pickMiddle;
            ui.pickHand = null; ui.pickMiddle = null;
            run(Net.swapOne(h, m));
            return;
        }
        render();
    }

    function onInput(event) {
        if (event.target.id === 'tr-name') ui.name = event.target.value;
        if (event.target.id === 'tr-code') {
            var cleaned = event.target.value.replace(/\D/g, '');
            if (cleaned !== event.target.value) event.target.value = cleaned;
            ui.codeInput = cleaned;
        }
    }

    /* --- Auf- und zumachen ------------------------------------------------------- */

    function build() {
        el = root.document.createElement('div');
        el.id = 'tr-hosnobe';
        el.innerHTML =
            '<div class="tr-head">' +
            '<button class="tr-back" data-do="exit" aria-label="Zurück zur Spielauswahl">‹</button>' +
            '<div class="tr-title">Hos\'n Obe<small>Schwimmen · 31</small></div>' +
            '<div class="tr-codechip" hidden></div>' +
            '</div>' +
            '<div class="tr-body"></div>' +
            '<div class="tr-actions" hidden></div>';

        head = el.querySelector('.tr-head');
        body = el.querySelector('.tr-body');
        actions = el.querySelector('.tr-actions');

        el.addEventListener('click', function (event) {
            if (event.target.closest('[data-do="exit"]')) { api.close(); return; }
            onClick(event);
        });
        el.addEventListener('input', onInput);
        el.addEventListener('toggle', function (event) {
            if (event.target.classList.contains('tr-rules')) ui.rulesOpen = event.target.open;
        }, true);

        root.document.body.appendChild(el);
    }

    var api = {};

    api.open = function (options) {
        opts = options || {};
        if (!el) build();
        el.hidden = false;

        ui.name = ui.name || recall(NAME_KEY);
        ui.error = '';
        ui.screen = 'home';

        if (!unsubscribe) {
            unsubscribe = Net.subscribe(function (next) {
                snap = next;
                if (next.error) ui.error = next.error;
                render();
            });
        }

        snap = Net.snapshot ? Net.snapshot() : snap;
        render();
    };

    api.close = function () {
        setTicker(false);
        if (el) el.hidden = true;
        // Der Platz am Tisch bleibt bestehen: wer die Auswahl aufruft und
        // zurueckkommt, sitzt wieder dort, wo er aufgehoert hat.
        if (typeof opts.onExit === 'function') opts.onExit();
    };

    // Tisch endgueltig verlassen und die Ansicht abbauen.
    api.destroy = function () {
        setTicker(false);
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        Net.leave();
        if (el && el.parentNode) el.parentNode.removeChild(el);
        el = body = actions = head = null;
    };

    root.Tischrunde = root.Tischrunde || {};
    root.Tischrunde.HosnObe = api;

})(window);
