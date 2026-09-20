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

        // --- Eigene Dauerliste (vom Handy gepflegt) --------------------------
        // Liegt in Firebase statt im Repo: so kann das Handy Videos hinzufuegen,
        // ohne dass jemand am Rechner etwas einchecken muss. nightlife.json
        // bleibt die gepflegte Grundliste, beide zusammen ergeben den Pool.
        // --- Diagnose --------------------------------------------------------
        // Kurze Spur der letzten Schritte eines Handys, damit sich Probleme aus
        // der Ferne einkreisen lassen (kommt die Suche ueberhaupt an?). Nur
        // Geraeteart und Ereignis, keine persoenlichen Daten.
        diagnose: function (verb, raum, ereignis, zusatz) {
            try {
                return schreiben(verb, raum, 'diagnose', {
                    ereignis: ereignis,
                    zusatz: String(zusatz || '').slice(0, 120),
                    geraet: (navigator.userAgent || '').slice(0, 90)
                });
            } catch (e) {
                return Promise.resolve();
            }
        },

        aufListeHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'liste', rueckruf);
        },
        listeLesen: function (verb, raum) {
            return verb.db.ref(pfad(raum) + '/liste').once('value').then(function (s) {
                var w = s.val();
                return (w && Array.isArray(w.eintraege)) ? w.eintraege : [];
            }).catch(function () { return []; });
        },
        listeSchreiben: function (verb, raum, eintraege) {
            return schreiben(verb, raum, 'liste', { eintraege: (eintraege || []).slice(0, 100) });
        },
        aufStatusHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'status', rueckruf);
        }
    };
})(window);
