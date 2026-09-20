/*
 * ============================================================================
 *  YOUTUBE-FERNBEDIENUNG — NETZ-SCHICHT
 *
 *  Gleiche Bauweise wie dj-fernbedienung-net.js und bewusst dieselbe
 *  Firebase-Verbindung (anonyme Anmeldung, keine Konten, kein Login):
 *  DJ_REMOTE_NET.bereit() richtet sie ein, hier kommen nur eigene Pfade dazu.
 *
 *  Die Daten haengen als Unterzweig am DJ-Pfad:
 *
 *    djremote/<raum>/yt/befehl  : was das Handy will
 *        { id, aktion: 'suche' | 'start' | 'stop', text, videoId, titel,
 *          dauerSek, ts }
 *    djremote/<raum>/yt/treffer : Suchergebnisse vom Screen fuers Handy
 *        { id, liste: [ { videoId, titel, kanal, dauer } ], ts }
 *    djremote/<raum>/yt/status  : was der Screen gerade tut
 *        { laeuft, videoId, titel, bisWann, suche, ts }
 *
 *  Der Unterzweig erbt die Firebase-Regeln von djremote/<raum> - in der
 *  Firebase-Konsole muss dafuer nichts ergaenzt werden.
 *
 *  Je Pfad genau eine Schreibrichtung: das Handy schreibt nur "befehl", der
 *  Screen nur "treffer" und "status". So koennen sie sich nicht gegenseitig
 *  ueberschreiben.
 * ============================================================================
 */
(function (global) {
    'use strict';

    var cfg = global.DJ_REMOTE_CONFIG || {};

    function pfad(raum) {
        return 'djremote/' + (raum || cfg.raum || 'city-cafe') + '/yt';
    }

    function schreiben(verb, raum, zweig, daten) {
        var inhalt = Object.assign({}, daten);
        inhalt.ts = global.firebase.database.ServerValue.TIMESTAMP;
        return verb.db.ref(pfad(raum) + '/' + zweig).set(inhalt);
    }

    function hoeren(verb, raum, zweig, rueckruf) {
        var ref = verb.db.ref(pfad(raum) + '/' + zweig);
        ref.on('value', function (schnappschuss) { rueckruf(schnappschuss.val()); });
        return function () { ref.off(); };
    }

    global.YT_REMOTE_NET = {
        istEingerichtet: function () {
            return !!(global.DJ_REMOTE_NET && DJ_REMOTE_NET.istEingerichtet());
        },
        // Verbindung und Anmeldung teilen wir uns mit der DJ-Fernbedienung.
        bereit: function () {
            if (!global.DJ_REMOTE_NET) return Promise.resolve(null);
            return DJ_REMOTE_NET.bereit();
        },

        // --- Screen (Dashboard) --------------------------------------------
        aufBefehlHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'befehl', rueckruf);
        },
        trefferMelden: function (verb, raum, id, liste) {
            return schreiben(verb, raum, 'treffer', {
                id: id, liste: (liste || []).slice(0, 25)
            });
        },
        statusMelden: function (verb, raum, status) {
            return schreiben(verb, raum, 'status', status);
        },

        // --- Handy ----------------------------------------------------------
        befehlSenden: function (verb, raum, befehl) {
            var daten = Object.assign({}, befehl);
            // Eigene id je Befehl: daran erkennt der Screen einen NEUEN Auftrag.
            daten.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            return schreiben(verb, raum, 'befehl', daten).then(function () { return daten.id; });
        },
        aufTrefferHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'treffer', rueckruf);
        },
        aufStatusHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'status', rueckruf);
        }
    };
})(window);
