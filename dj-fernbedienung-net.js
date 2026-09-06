/*
 * ============================================================================
 *  DJ-FERNBEDIENUNG — NETZ-SCHICHT
 *
 *  Die paar Zeilen Firebase, die Dashboard und Handy gemeinsam brauchen.
 *  Bewusst klein gehalten: alles Fachliche steht im Dashboard bzw. auf der
 *  Handy-Seite, hier geht es nur um Verbindung, Anmeldung und die zwei Pfade.
 *
 *  Datenmodell unter djremote/<raum>/:
 *
 *    befehl : was das Handy will        { id, aktion, kanal, quali, dauerSek, ts }
 *    status : was der Screen gerade tut { kanal, laeuft, quali, bisWann, ts }
 *
 *  Genau eine Richtung je Pfad: das Handy schreibt nur "befehl" und liest nur
 *  "status", das Dashboard umgekehrt. Dadurch koennen sich die beiden nicht
 *  gegenseitig ueberschreiben, auch wenn mehrere Handys gleichzeitig scannen.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var cfg = global.DJ_REMOTE_CONFIG || {};
    var fbCfg = cfg.firebase || {};

    // Ohne Datenbank-URL bleibt die Fernbedienung still liegen, statt beim
    // Start Fehler zu werfen und die uebrige Rotation mitzureissen.
    var einsatzbereit = !!(fbCfg.databaseURL && fbCfg.apiKey && fbCfg.projectId);
    var bereitPromise = null;

    function raumPfad(raum) {
        return 'djremote/' + (raum || cfg.raum || 'city-cafe');
    }

    // Meldet sich anonym an und liefert { uid, db }. Schlaegt etwas fehl,
    // kommt null zurueck - der Aufrufer schaltet die Fernbedienung dann
    // einfach nicht ein.
    function bereit() {
        if (!einsatzbereit) return Promise.resolve(null);
        if (bereitPromise) return bereitPromise;

        bereitPromise = new Promise(function (resolve) {
            var erledigt = false;
            var fertig = function (wert) {
                if (erledigt) return;
                erledigt = true;
                resolve(wert);
            };

            if (!global.firebase || !global.firebase.apps) return fertig(null);

            try {
                // Hos'n Obe nutzt dasselbe Projekt und meldet sich ebenfalls an -
                // wer zuerst kommt, richtet ein, der andere haengt sich dran.
                if (!global.firebase.apps.length) global.firebase.initializeApp(fbCfg);
            } catch (err) {
                console.warn('[DJ-Fernbedienung] Firebase-Init fehlgeschlagen:', err);
                return fertig(null);
            }

            var auth = global.firebase.auth();
            auth.onAuthStateChanged(function (user) {
                if (user) fertig({ uid: user.uid, db: global.firebase.database() });
            });
            auth.signInAnonymously().catch(function (err) {
                console.warn('[DJ-Fernbedienung] Anmeldung fehlgeschlagen:', err);
                fertig(null);
            });

            // Notbremse: haengt die Anmeldung, laeuft das Dashboard ohne
            // Fernbedienung weiter, statt auf sie zu warten.
            setTimeout(function () { fertig(null); }, 8000);
        });
        return bereitPromise;
    }

    global.DJ_REMOTE_NET = {
        istEingerichtet: function () { return einsatzbereit; },
        bereit: bereit,

        // --- Dashboard-Seite ----------------------------------------------
        aufBefehlHoeren: function (verb, rueckruf) {
            var ref = verb.db.ref(raumPfad() + '/befehl');
            ref.on('value', function (schnappschuss) {
                rueckruf(schnappschuss.val());
            });
            return function () { ref.off(); };
        },
        statusMelden: function (verb, status) {
            var daten = Object.assign({}, status);
            daten.ts = global.firebase.database.ServerValue.TIMESTAMP;
            return verb.db.ref(raumPfad() + '/status').set(daten);
        },

        // --- Handy-Seite ---------------------------------------------------
        befehlSenden: function (verb, befehl) {
            var daten = Object.assign({}, befehl);
            // Eigene id je Befehl: das Dashboard erkennt daran einen NEUEN
            // Auftrag. Ohne sie wuerde ein erneut zugestellter Datensatz den
            // laufenden Stream noch einmal von vorn starten.
            daten.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            daten.ts = global.firebase.database.ServerValue.TIMESTAMP;
            return verb.db.ref(raumPfad() + '/befehl').set(daten);
        },
        aufStatusHoeren: function (verb, rueckruf) {
            var ref = verb.db.ref(raumPfad() + '/status');
            ref.on('value', function (schnappschuss) {
                rueckruf(schnappschuss.val());
            });
            return function () { ref.off(); };
        }
    };
})(window);
