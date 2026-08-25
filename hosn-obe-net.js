/*
 * Hos’n Obe — gemeinsame Firebase-Schicht für TV und Handy.
 *
 * Absichtlich gegen das "compat"-SDK gebaut (klassische <script>-Tags statt
 * ES-Modulen): der WebView auf der Odroid-Box ist alt genug, dass dort schon
 * CSS Grid nicht zuverlässig läuft — auf dynamische import()-Ketten wollen
 * wir uns da nicht verlassen.
 */
(function (global) {
    'use strict';

    var cfg = global.HOSN_OBE_CONFIG || {};
    var fbCfg = cfg.firebase || {};

    // Ohne Datenbank-URL bleibt das ganze Feature still liegen, statt beim
    // Start Fehler zu werfen und die übrige Rotation mitzureißen.
    var hasKeys = !!(fbCfg.databaseURL && fbCfg.apiKey && fbCfg.projectId);
    var readyPromise = null;

    function isConfigured() {
        return hasKeys && typeof global.firebase !== 'undefined' && !!global.firebase.database;
    }

    // Löst mit { uid, db } auf — oder mit null, wenn Firebase nicht nutzbar ist.
    function ready() {
        if (!isConfigured()) return Promise.resolve(null);
        if (readyPromise) return readyPromise;

        readyPromise = new Promise(function (resolve) {
            var settled = false;
            var finish = function (value) {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            try {
                if (!global.firebase.apps.length) global.firebase.initializeApp(fbCfg);
            } catch (err) {
                console.warn('[Hos’n Obe] Firebase-Init fehlgeschlagen:', err);
                return finish(null);
            }

            var auth = global.firebase.auth();
            auth.onAuthStateChanged(function (user) {
                if (user) finish({ uid: user.uid, db: global.firebase.database() });
            });
            auth.signInAnonymously().catch(function (err) {
                console.warn('[Hos’n Obe] Anonyme Anmeldung fehlgeschlagen:', err);
                finish(null);
            });

            setTimeout(function () {
                if (!settled) console.warn('[Hos’n Obe] Firebase antwortet nicht — Feature bleibt aus.');
                finish(null);
            }, 12000);
        });

        return readyPromise;
    }

    function publicRef(db, sessionId, child) {
        return db.ref('games/' + sessionId + '/public' + (child ? '/' + child : ''));
    }

    function privateRef(db, sessionId, seat) {
        return db.ref('games/' + sessionId + '/private/' + seat);
    }

    function newSessionId() {
        var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
        var out = '';
        for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
        return out;
    }

    /*
     * Sitzplatz atomar belegen. Zwei Handys, die gleichzeitig scannen, können
     * denselben freien Platz nicht doppelt bekommen — die Transaktion lässt nur
     * einen der beiden Schreibvorgänge durch, der andere versucht es erneut.
     * Liefert den Sitzplatz-Index oder -1, wenn alles besetzt ist.
     */
    function claimSeat(db, sessionId, uid, playerCount) {
        var ref = publicRef(db, sessionId, 'seats');
        return ref.transaction(function (seats) {
            seats = seats || {};
            for (var existing in seats) {
                if (seats[existing] && seats[existing].uid === uid) return seats; // Reload: Platz behalten
            }
            for (var i = 0; i < playerCount; i++) {
                if (!seats[i] || !seats[i].uid) {
                    seats[i] = { uid: uid, joined: true };
                    return seats;
                }
            }
            return undefined; // voll -> Transaktion abbrechen
        }).then(function (result) {
            if (!result.committed) return -1;
            var seats = result.snapshot.val() || {};
            for (var key in seats) {
                if (seats[key] && seats[key].uid === uid) return Number(key);
            }
            return -1;
        });
    }

    // Host wird, wer zuerst da ist. Ebenfalls als Transaktion, damit bei zwei
    // gleichzeitigen Scans nicht beide Handys die Spieleranzahl wählen dürfen.
    function claimHost(db, sessionId, uid) {
        return publicRef(db, sessionId, 'hostUid').transaction(function (current) {
            if (current === null) return uid;
            return undefined;
        }).then(function (result) {
            return result.snapshot.val() === uid;
        });
    }

    global.KtNet = {
        isConfigured: isConfigured,
        ready: ready,
        publicRef: publicRef,
        privateRef: privateRef,
        newSessionId: newSessionId,
        claimSeat: claimSeat,
        claimHost: claimHost
    };
})(window);
