/*
 * Tischrunde — Hos'n Obe: Anbindung an die Firebase Realtime Database.
 *
 * Aufteilung der Daten (die Sicherheitsregeln stehen in der README):
 *
 *   rooms/{code}/public   — fuer alle am Tisch lesbar: Mitte, wer am Zug ist,
 *                           Klopfstand, Restzuege, Spielerliste
 *   rooms/{code}/private/{uid}/hand
 *                         — nur das eigene Handy darf lesen. Schreiben darf
 *                           zusaetzlich der Geber, sonst koennte niemand
 *                           austeilen.
 *
 * Es gibt keinen Server, der Recht spricht: die Zuege schreiben die Handys
 * selbst. Weil immer nur der Spieler am Zug schreibt und die Regeln vor jedem
 * Schreiben geprueft werden, reicht das fuer eine Tischrunde unter Bekannten.
 *
 * Der Geber wechselt jede Runde weiter. Sein Geraet kennt beim Austeilen
 * zwangslaeufig alle Haende — deshalb rotiert die Rolle, statt beim
 * Tischgruender zu bleiben. Nirgends im Code wird eine fremde Hand behalten
 * oder angezeigt.
 */
(function (root) {
    'use strict';

    var Engine = root.HosnObeEngine;

    var CODE_ALPHABET = '0123456789';
    var MAX_CODE_ATTEMPTS = 12;

    var net = {};

    var s = {
        app: null,
        db: null,
        uid: null,
        code: null,
        roomRef: null,
        pub: null,          // letzter oeffentlicher Stand
        hand: null,         // eigene drei Karten
        handRound: -1,      // zu welcher Runde die Hand gehoert
        listeners: [],      // angemeldete Firebase-Callbacks zum Abraeumen
        subscribers: [],    // Anmeldungen der Oberflaeche
        connecting: null,
        dealing: false,     // laeuft gerade ein Austeilen dieses Geraets
        error: null
    };

    function cfg() { return root.HosnObeConfig || {}; }

    /* --- Grundlagen --------------------------------------------------------- */

    // Ohne databaseURL ist nichts eingerichtet — dann laeuft nur der Uebungsmodus.
    net.configured = function () {
        var f = cfg().firebase || {};
        return !!(f.apiKey && f.databaseURL && f.projectId);
    };

    net.uid = function () { return s.uid; };
    net.code = function () { return s.code; };

    // Der eigene Sitzplatz, oder null wenn wir an keinem Tisch sitzen.
    net.seat = function () {
        if (!s.pub || !s.pub.players || !s.uid) return null;
        var me = s.pub.players[s.uid];
        return me ? me.seat : null;
    };

    function fail(message) { return Promise.reject(new Error(message)); }

    /*
     * Firebase starten und anonym anmelden. Mehrfachaufrufe teilen sich
     * dieselbe Anmeldung.
     */
    net.connect = function () {
        if (s.connecting) return s.connecting;

        if (!net.configured()) {
            return fail('Es sind noch keine Firebase-Zugangsdaten hinterlegt.');
        }
        if (typeof root.firebase === 'undefined') {
            return fail('Das Firebase-SDK wurde nicht geladen.');
        }

        s.connecting = new Promise(function (resolve, reject) {
            try {
                s.app = root.firebase.apps && root.firebase.apps.length
                    ? root.firebase.app()
                    : root.firebase.initializeApp(cfg().firebase);
                s.db = root.firebase.database(s.app);
            } catch (e) {
                s.connecting = null;
                reject(new Error('Firebase liess sich nicht starten: ' + e.message));
                return;
            }

            root.firebase.auth(s.app).signInAnonymously().then(function (result) {
                s.uid = result.user.uid;
                resolve(s.uid);
            }).catch(function (e) {
                s.connecting = null;
                var hint = e && e.code === 'auth/operation-not-allowed'
                    ? 'Die anonyme Anmeldung ist im Firebase-Projekt noch nicht freigeschaltet.'
                    : 'Anmeldung fehlgeschlagen: ' + (e && e.message ? e.message : e);
                reject(new Error(hint));
            });
        });

        return s.connecting;
    };

    /* --- Tisch eroeffnen und beitreten -------------------------------------- */

    function randomCode() {
        var length = cfg().codeLength || 4;
        var out = '';
        var buf = null;
        if (root.crypto && root.crypto.getRandomValues) {
            buf = new Uint32Array(length);
            root.crypto.getRandomValues(buf);
        }
        for (var i = 0; i < length; i++) {
            var r = buf ? buf[i] / 4294967296 : Math.random();
            out += CODE_ALPHABET.charAt(Math.floor(r * CODE_ALPHABET.length));
        }
        return out;
    }

    function trimName(name) {
        var clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
        return clean || 'Gast';
    }

    function playerEntry(name, seat) {
        return { name: trimName(name), seat: seat, online: true, joinedAt: Date.now() };
    }

    /*
     * Neuen Tisch anlegen. Der Code wird per Transaktion belegt, damit zwei
     * gleichzeitige Gruendungen nicht denselben Code erwischen.
     */
    net.createRoom = function (name) {
        return net.connect().then(function () {
            return claim(0);
        });

        function claim(attempt) {
            if (attempt >= MAX_CODE_ATTEMPTS) {
                return fail('Es war gerade kein freier Einladungscode zu bekommen. Bitte noch einmal versuchen.');
            }
            var code = randomCode();
            var ref = s.db.ref('rooms/' + code + '/public');

            return ref.transaction(function (current) {
                if (current !== null) return;           // schon vergeben, abbrechen
                var players = {};
                players[s.uid] = playerEntry(name, 0);
                return {
                    status: 'lobby',
                    hostUid: s.uid,
                    dealerUid: s.uid,
                    dealerSeat: 0,
                    round: 0,
                    turnSeat: null,
                    middle: null,
                    knockedBy: null,
                    turnsLeft: null,
                    endReason: null,
                    createdAt: Date.now(),
                    players: players
                };
            }).then(function (res) {
                if (!res.committed) return claim(attempt + 1);
                return attachRoom(code);
            });
        }
    };

    /*
     * Bestehendem Tisch beitreten. Der freie Sitzplatz wird ebenfalls per
     * Transaktion vergeben, sonst landen zwei Handys auf demselben Platz.
     */
    net.joinRoom = function (code, name) {
        code = String(code || '').trim();
        if (!/^[0-9]+$/.test(code)) return fail('Der Einladungscode besteht nur aus Ziffern.');

        return net.connect().then(function () {
            var ref = s.db.ref('rooms/' + code + '/public');
            return ref.once('value').then(function (snap) {
                if (!snap.exists()) throw new Error('Zu diesem Code gibt es keinen Tisch.');
                var pub = snap.val();

                var mine = pub.players && pub.players[s.uid];
                if (!mine && pub.status !== 'lobby') {
                    throw new Error('An diesem Tisch laeuft schon eine Runde.');
                }

                return ref.child('players').transaction(function (players) {
                    players = players || {};
                    if (players[s.uid]) {              // Rueckkehr auf den eigenen Platz
                        players[s.uid].name = trimName(name);
                        players[s.uid].online = true;
                        return players;
                    }
                    var taken = [];
                    for (var uid in players) if (players.hasOwnProperty(uid)) taken.push(players[uid].seat);
                    if (taken.length >= (cfg().maxPlayers || 6)) return;   // voll, abbrechen
                    var seat = 0;
                    while (taken.indexOf(seat) !== -1) seat++;
                    players[s.uid] = playerEntry(name, seat);
                    return players;
                }).then(function (res) {
                    if (!res.committed) throw new Error('Der Tisch ist schon voll.');
                    return attachRoom(code);
                });
            });
        });
    };

    /* --- Zuhoeren ------------------------------------------------------------ */

    function attachRoom(code) {
        detach();
        s.code = code;
        s.roomRef = s.db.ref('rooms/' + code);

        var meRef = s.roomRef.child('public/players/' + s.uid);
        meRef.onDisconnect().update({ online: false });

        // Nach einem Verbindungsabriss den eigenen Platz wieder als besetzt melden.
        var connRef = s.db.ref('.info/connected');
        var onConn = connRef.on('value', function (snap) {
            if (!snap.val()) return;
            meRef.onDisconnect().update({ online: false });
            meRef.update({ online: true });
        });
        s.listeners.push({ ref: connRef, event: 'value', fn: onConn });

        var pubRef = s.roomRef.child('public');
        var onPub = pubRef.on('value', function (snap) {
            s.pub = snap.val();
            if (!s.pub) {                       // Tisch wurde aufgeloest
                notify();
                return;
            }
            react();
            notify();
        }, function (e) {
            s.error = 'Der Tisch ist nicht mehr erreichbar: ' + e.message;
            notify();
        });
        s.listeners.push({ ref: pubRef, event: 'value', fn: onPub });

        var handRef = s.roomRef.child('private/' + s.uid);
        var onHand = handRef.on('value', function (snap) {
            var val = snap.val() || {};
            s.hand = val.hand || null;
            s.handRound = typeof val.round === 'number' ? val.round : -1;
            react();
            notify();
        }, function () {
            // Kein Leserecht auf fremde Haende — auf dem eigenen Pfad darf das
            // nicht passieren, aber ein Fehler hier darf das Spiel nicht kippen.
            s.hand = null;
            notify();
        });
        s.listeners.push({ ref: handRef, event: 'value', fn: onHand });

        return { code: code, uid: s.uid };
    }

    function detach() {
        s.listeners.forEach(function (l) { l.ref.off(l.event, l.fn); });
        s.listeners = [];
        s.pub = null;
        s.hand = null;
        s.handRound = -1;
        s.error = null;
    }

    net.subscribe = function (fn) {
        s.subscribers.push(fn);
        if (s.pub) fn(net.snapshot());
        return function () {
            var i = s.subscribers.indexOf(fn);
            if (i !== -1) s.subscribers.splice(i, 1);
        };
    };

    function notify() {
        var snap = net.snapshot();
        s.subscribers.slice().forEach(function (fn) { fn(snap); });
    }

    /*
     * Der Stand, mit dem die Oberflaeche arbeitet. Die eigene Hand wird nur
     * mitgegeben, wenn sie zur laufenden Runde gehoert — sonst blitzt nach dem
     * Austeilen kurz die Hand der Vorrunde auf.
     */
    net.snapshot = function () {
        var pub = s.pub;
        var handFits = pub && s.hand && s.handRound === pub.round;
        return {
            code: s.code,
            uid: s.uid,
            seat: net.seat(),
            pub: pub,
            hand: handFits ? s.hand.slice() : null,
            players: playerList(pub),
            error: s.error
        };
    };

    // Spielerliste, nach Sitzplatz sortiert.
    function playerList(pub) {
        if (!pub || !pub.players) return [];
        var out = [];
        for (var uid in pub.players) {
            if (!pub.players.hasOwnProperty(uid)) continue;
            var p = pub.players[uid];
            out.push({
                uid: uid,
                name: p.name || 'Gast',
                seat: p.seat,
                online: p.online !== false,
                isMe: uid === s.uid,
                isHost: uid === pub.hostUid,
                isDealer: uid === pub.dealerUid
            });
        }
        return out.sort(function (a, b) { return a.seat - b.seat; });
    }

    net.players = function () { return playerList(s.pub); };

    function activeSeats(pub) {
        return playerList(pub).filter(function (p) { return p.online; }).map(function (p) { return p.seat; });
    }

    function uidAtSeat(pub, seat) {
        if (!pub || !pub.players) return null;
        for (var uid in pub.players) {
            if (pub.players.hasOwnProperty(uid) && pub.players[uid].seat === seat) return uid;
        }
        return null;
    }

    /* --- Selbsttaetige Schritte ---------------------------------------------- */

    /*
     * Wird nach jeder Aenderung aufgerufen und uebernimmt, was ohne Zutun des
     * Spielers passieren muss: austeilen, wenn wir der Geber sind; Feuer sofort
     * melden; am Rundenende die eigene Hand aufdecken.
     */
    function react() {
        var pub = s.pub;
        if (!pub) return;

        if (pub.status === 'dealing' && pub.dealerUid === s.uid && !s.dealing) dealNow();
        if (pub.status === 'playing') declareFireIfAny();
        if (pub.status === 'reveal') revealOwnHand();
    }

    /*
     * Austeilen. Nur der Geber kommt hier vorbei. Die Haende gehen direkt in
     * die privaten Pfade der Mitspieler und werden hier bewusst nicht behalten.
     */
    function dealNow() {
        var pub = s.pub;
        var seated = playerList(pub).filter(function (p) { return p.online; });
        var min = cfg().minPlayers || 2;
        if (seated.length < min) return;

        s.dealing = true;
        var table = Engine.deal(seated.length);
        var round = (pub.round || 0);

        var updates = {};
        seated.forEach(function (p, i) {
            updates['private/' + p.uid + '/hand'] = table.hands[i];
            updates['private/' + p.uid + '/round'] = round;
        });

        // Es beginnt, wer links vom Geber sitzt.
        var seats = seated.map(function (p) { return p.seat; });
        updates['public/middle'] = table.middle;
        updates['public/status'] = 'playing';
        updates['public/turnSeat'] = Engine.nextSeat(seats, pub.dealerSeat);
        updates['public/turnStartedAt'] = Date.now();
        updates['public/knockedBy'] = null;
        updates['public/turnsLeft'] = null;
        updates['public/endReason'] = null;
        updates['public/lastAction'] = null;
        updates['public/reveal'] = null;

        s.roomRef.update(updates).catch(function (e) {
            s.error = 'Austeilen fehlgeschlagen: ' + e.message;
            notify();
        }).then(function () { s.dealing = false; });
    }

    // Feuer beendet die Runde sofort — auch direkt nach dem Austeilen.
    function declareFireIfAny() {
        var pub = s.pub;
        if (!pub || pub.status !== 'playing') return;
        if (!s.hand || s.handRound !== pub.round) return;
        if (!Engine.isFire(s.hand)) return;

        s.roomRef.child('public').update({
            status: 'reveal',
            endReason: 'fire',
            turnSeat: null
        });
    }

    /*
     * Am Rundenende deckt jedes Handy seine eigene Hand selbst auf. So braucht
     * niemand Leserecht auf fremde private Pfade.
     */
    function revealOwnHand() {
        var pub = s.pub;
        if (!pub || pub.status !== 'reveal' || !s.uid) return;
        if (!s.hand || s.handRound !== pub.round) return;
        if (pub.reveal && pub.reveal[s.uid]) return;
        s.roomRef.child('public/reveal/' + s.uid).set({ hand: s.hand, at: Date.now() });
    }

    /* --- Zuege ---------------------------------------------------------------- */

    net.isMyTurn = function () {
        var pub = s.pub;
        if (!pub || pub.status !== 'playing') return false;
        var seat = net.seat();
        return seat !== null && pub.turnSeat === seat;
    };

    /*
     * Wohin der Zug nach diesem Schritt geht. Nach dem Klopfen zaehlen wir die
     * Restzuege herunter; bei null wird aufgedeckt.
     */
    function turnAdvance(pub, mySeat, seatsOverride) {
        var seats = seatsOverride || activeSeats(pub);
        var out = {};

        if (pub.knockedBy !== null && pub.knockedBy !== undefined) {
            var left = (typeof pub.turnsLeft === 'number' ? pub.turnsLeft : seats.length) - 1;
            out['public/turnsLeft'] = Math.max(0, left);
            if (left <= 0) {
                out['public/status'] = 'reveal';
                out['public/endReason'] = 'knock';
                out['public/turnSeat'] = null;
                return out;
            }
        }
        out['public/turnSeat'] = Engine.nextSeat(seats, mySeat);
        out['public/turnStartedAt'] = Date.now();
        return out;
    }

    function requireTurn() {
        if (!net.isMyTurn()) return fail('Du bist gerade nicht am Zug.');
        if (!s.hand) return fail('Deine Karten sind noch nicht da.');
        return null;
    }

    /*
     * Einen Zug schreiben und die eigene Hand sofort mitfuehren, ohne auf die
     * Rueckmeldung der Datenbank zu warten.
     *
     * Das ist nicht nur schneller, es muss auch so sein: beim letzten Zug nach
     * dem Klopfen stehen der Kartentausch und "aufdecken" im selben
     * Schreibvorgang. Traefe zuerst die Meldung ueber den oeffentlichen Stand
     * ein und erst danach die eigene Hand, deckte dieses Handy noch die Hand
     * von VOR dem Tausch auf. Ueber die eigene Hand bestimmt ohnehin nur
     * dieses Geraet — sie hier gleich zu setzen ist also gefahrlos.
     */
    function writeMove(updates, nextHand, round) {
        var prevHand = s.hand, prevRound = s.handRound;
        s.hand = nextHand;
        s.handRound = round;
        return s.roomRef.update(updates).catch(function (e) {
            s.hand = prevHand;                 // Schreiben misslungen, zurueckdrehen
            s.handRound = prevRound;
            notify();
            throw e;
        });
    }

    // Eine Handkarte gegen eine Mittenkarte. Hand und Mitte werden in einem
    // einzigen Schreibvorgang geaendert, damit nie eine Karte doppelt existiert.
    net.swapOne = function (handIndex, middleIndex) {
        var blocked = requireTurn();
        if (blocked) return blocked;

        var pub = s.pub;
        var mySeat = net.seat();
        var next = Engine.swapOne(s.hand, pub.middle, handIndex, middleIndex);

        var updates = turnAdvance(pub, mySeat);
        updates['private/' + s.uid + '/hand'] = next.hand;
        updates['private/' + s.uid + '/round'] = pub.round;
        updates['public/middle'] = next.middle;
        updates['public/lastAction'] = { seat: mySeat, type: 'swapOne', at: Date.now() };

        return writeMove(updates, next.hand, pub.round);
    };

    // Alle drei auf einmal.
    net.swapAll = function () {
        var blocked = requireTurn();
        if (blocked) return blocked;

        var pub = s.pub;
        var mySeat = net.seat();
        var next = Engine.swapAll(s.hand, pub.middle);

        var updates = turnAdvance(pub, mySeat);
        updates['private/' + s.uid + '/hand'] = next.hand;
        updates['private/' + s.uid + '/round'] = pub.round;
        updates['public/middle'] = next.middle;
        updates['public/lastAction'] = { seat: mySeat, type: 'swapAll', at: Date.now() };

        return writeMove(updates, next.hand, pub.round);
    };

    /*
     * Klopfen. Danach hat jeder Mitspieler noch genau einen Zug — deshalb sind
     * die Restzuege die Zahl der uebrigen Spieler.
     */
    net.knock = function () {
        var blocked = requireTurn();
        if (blocked) return blocked;

        var pub = s.pub;
        var mySeat = net.seat();
        if (pub.knockedBy !== null && pub.knockedBy !== undefined) {
            return fail('Es wurde an diesem Tisch schon geklopft.');
        }

        var seats = activeSeats(pub);
        var others = seats.length - 1;

        var updates = {};
        updates['public/knockedBy'] = mySeat;
        updates['public/lastAction'] = { seat: mySeat, type: 'knock', at: Date.now() };

        if (others <= 0) {
            updates['public/turnsLeft'] = 0;
            updates['public/status'] = 'reveal';
            updates['public/endReason'] = 'knock';
            updates['public/turnSeat'] = null;
        } else {
            updates['public/turnsLeft'] = others;
            updates['public/turnSeat'] = Engine.nextSeat(seats, mySeat);
            updates['public/turnStartedAt'] = Date.now();
        }
        return s.roomRef.child('public').update(stripPrefix(updates));
    };

    // Hilfsmittel: die obigen Pfade tragen "public/" fuer Schreibvorgaenge am
    // Raumknoten. Wer direkt auf public schreibt, braucht das Praefix nicht.
    function stripPrefix(updates) {
        var out = {};
        for (var key in updates) {
            if (updates.hasOwnProperty(key)) out[key.replace(/^public\//, '')] = updates[key];
        }
        return out;
    }

    /*
     * Einen haengenden Zug weitergeben. Gedacht fuer den Fall, dass jemand das
     * Handy weglegt — jeder am Tisch darf ihn nach Ablauf der Wartezeit ausloesen.
     */
    net.skipTurn = function () {
        var pub = s.pub;
        if (!pub || pub.status !== 'playing' || pub.turnSeat === null) return fail('Gerade ist niemand am Zug.');
        var updates = turnAdvance(pub, pub.turnSeat);
        updates['public/lastAction'] = { seat: pub.turnSeat, type: 'skip', at: Date.now() };
        return s.roomRef.child('public').update(stripPrefix(updates));
    };

    /* --- Rundenwechsel --------------------------------------------------------- */

    // Aus der Lobby heraus starten. Der erste Geber wird ausgelost.
    net.startGame = function () {
        var pub = s.pub;
        if (!pub) return fail('Kein Tisch verbunden.');
        var seated = playerList(pub).filter(function (p) { return p.online; });
        var min = cfg().minPlayers || 2;
        if (seated.length < min) return fail('Zu Hos\'n Obe braucht es mindestens ' + min + ' Spieler.');

        var first = seated[Math.floor(Math.random() * seated.length)];
        return s.roomRef.child('public').update({
            status: 'dealing',
            round: (pub.round || 0) + 1,
            dealerSeat: first.seat,
            dealerUid: first.uid,
            reveal: null,
            endReason: null,
            knockedBy: null,
            turnsLeft: null
        });
    };

    // Naechste Runde. Der Geber rueckt einen besetzten Platz weiter.
    net.nextRound = function () {
        var pub = s.pub;
        if (!pub) return fail('Kein Tisch verbunden.');
        var seated = playerList(pub).filter(function (p) { return p.online; });
        var min = cfg().minPlayers || 2;
        if (seated.length < min) return fail('Es sind zu wenige Spieler am Tisch.');

        var seats = seated.map(function (p) { return p.seat; });
        var nextDealerSeat = Engine.nextSeat(seats, typeof pub.dealerSeat === 'number' ? pub.dealerSeat : -1);
        var nextDealerUid = uidAtSeat(pub, nextDealerSeat);

        return s.roomRef.child('public').update({
            status: 'dealing',
            round: (pub.round || 0) + 1,
            dealerSeat: nextDealerSeat,
            dealerUid: nextDealerUid,
            middle: null,
            turnSeat: null,
            knockedBy: null,
            turnsLeft: null,
            endReason: null,
            lastAction: null,
            reveal: null
        });
    };

    // Zurueck in die Lobby, damit noch jemand dazukommen kann.
    net.backToLobby = function () {
        if (!s.roomRef) return fail('Kein Tisch verbunden.');
        return s.roomRef.child('public').update({
            status: 'lobby', middle: null, turnSeat: null,
            knockedBy: null, turnsLeft: null, endReason: null, reveal: null, lastAction: null
        });
    };

    /* --- Verlassen -------------------------------------------------------------- */

    /*
     * Tisch verlassen. Der eigene Platz wird geraeumt; bleibt niemand mehr
     * uebrig, verschwindet der Tisch samt privater Pfade.
     */
    net.leave = function () {
        if (!s.roomRef || !s.uid) { detach(); s.code = null; return Promise.resolve(); }

        var roomRef = s.roomRef;
        var uid = s.uid;
        var pub = s.pub;
        var mySeat = net.seat();
        var wasHost = pub && pub.hostUid === uid;

        var cleanup = {};
        cleanup['public/players/' + uid] = null;
        cleanup['private/' + uid] = null;
        cleanup['public/reveal/' + uid] = null;

        /*
         * Wer mitten in der Runde geht, darf den Tisch nicht blockieren. Steht
         * der Zug gerade bei uns, wird er weitergereicht; bleiben zu wenige
         * uebrig, geht der Tisch zurueck in die Lobby.
         */
        if (pub && pub.status === 'playing') {
            var others = activeSeats(pub).filter(function (seat) { return seat !== mySeat; });
            if (others.length < (cfg().minPlayers || 2)) {
                cleanup['public/status'] = 'lobby';
                cleanup['public/middle'] = null;
                cleanup['public/turnSeat'] = null;
                cleanup['public/knockedBy'] = null;
                cleanup['public/turnsLeft'] = null;
                cleanup['public/endReason'] = null;
                cleanup['public/reveal'] = null;
            } else if (pub.turnSeat === mySeat) {
                var passed = turnAdvance(pub, mySeat, others);
                for (var key in passed) if (passed.hasOwnProperty(key)) cleanup[key] = passed[key];
            }
        }

        detach();
        s.code = null;
        s.roomRef = null;

        return roomRef.update(cleanup).then(function () {
            return roomRef.child('public/players').once('value');
        }).then(function (snap) {
            var left = snap.val();
            var count = left ? Object.keys(left).length : 0;
            if (count === 0) return roomRef.remove();
            if (wasHost) {
                // Die Gastgeberrolle geht an den vordersten verbliebenen Platz.
                var best = null;
                for (var other in left) {
                    if (!left.hasOwnProperty(other)) continue;
                    if (!best || left[other].seat < left[best].seat) best = other;
                }
                if (best) return roomRef.child('public/hostUid').set(best);
            }
        }).catch(function () { /* Beim Verlassen ist ein Fehler nicht der Rede wert. */ })
            .then(function () { notify(); });
    };

    root.HosnObeNet = net;

})(window);
