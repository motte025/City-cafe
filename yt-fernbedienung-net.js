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
                id: id, liste: (liste || []).slice(0, 75)   // "Mehr laden" bis 75
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
        // --- Boxen-Verzeichnis ----------------------------------------------
        // Jeder Screen traegt sich mit Raumname und oeffentlicher IP ein. Das
        // Handy waehlt daraus die Box mit derselben oeffentlichen IP - das ist
        // die im selben Netz. So genuegt EIN gespeicherter Link fuer beide
        // Screens, und ein Befehl von zu Hause landet nicht im Gasthaus.
        boxMelden: function (verb, raum, name, ip) {
            return verb.db.ref('djremote/boxen/' + raum).set({
                name: name || raum,
                ip: ip || '',
                ts: global.firebase.database.ServerValue.TIMESTAMP
            });
        },
        boxenLesen: function (verb) {
            return verb.db.ref('djremote/boxen').once('value').then(function (s) {
                var w = s.val() || {};
                return Object.keys(w).map(function (raum) {
                    return { raum: raum, name: w[raum].name || raum, ip: w[raum].ip || '',
                             ts: w[raum].ts || 0 };
                });
            }).catch(function () { return []; });
        },

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
        },

        // --- YouTube-Musik (YOUTUBE-MUSIK-SETUP.md, Abschnitt 4) -----------
        //   yt/warteschlange/<id> : TV und Chef schreiben
        //   yt/wuensche/<id>      : Gaeste schreiben NUR hierhin (mit von = uid)
        //   yt/radio, yt/jetzt    : nur der TV schreibt
        //   chef/geraete/<uid>    : Geraet meldet sich mit der PIN als Chef an
        aufWarteschlangeHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'warteschlange', function (w) {
                rueckruf(Object.keys(w || {}).map(function (id) {
                    return Object.assign({}, w[id], { id: id });
                }));
            });
        },
        warteschlangeSetzen: function (verb, raum, id, eintrag) {
            var inhalt = Object.assign({}, eintrag);
            delete inhalt.id;
            inhalt.ts = inhalt.ts || global.firebase.database.ServerValue.TIMESTAMP;
            return verb.db.ref(pfad(raum) + '/warteschlange/' + id).set(inhalt);
        },
        warteschlangeEntfernen: function (verb, raum, id) {
            return verb.db.ref(pfad(raum) + '/warteschlange/' + id).remove();
        },
        posSetzen: function (verb, raum, id, pos) {
            return verb.db.ref(pfad(raum) + '/warteschlange/' + id + '/pos').set(pos);
        },
        neueId: function (verb, raum) {
            return verb.db.ref(pfad(raum) + '/warteschlange').push().key;
        },
        wunschSenden: function (verb, raum, wunsch) {
            var ref = verb.db.ref(pfad(raum) + '/wuensche').push();
            var inhalt = {
                videoId: String(wunsch.videoId || ''),
                titel: String(wunsch.titel || '').slice(0, 160),
                kanal: String(wunsch.kanal || '').slice(0, 80),
                dauer: String(wunsch.dauer || ''),
                dauerSek: Number(wunsch.dauerSek) || 0,
                von: verb.uid,
                ts: global.firebase.database.ServerValue.TIMESTAMP
            };
            return ref.set(inhalt).then(function () { return ref.key; });
        },
        aufWunschHoeren: function (verb, raum, wunschId, rueckruf) {
            var ref = verb.db.ref(pfad(raum) + '/wuensche/' + wunschId);
            ref.on('value', function (s) { rueckruf(s.val()); });
            return function () { ref.off(); };
        },
        aufNeueWuenscheHoeren: function (verb, raum, rueckruf) {
            var ref = verb.db.ref(pfad(raum) + '/wuensche');
            ref.on('child_added', function (s) { rueckruf(s.key, s.val()); });
            return function () { ref.off(); };
        },
        wunschErledigen: function (verb, raum, wunschId) {
            return verb.db.ref(pfad(raum) + '/wuensche/' + wunschId).remove();
        },
        wunschAblehnen: function (verb, raum, wunschId, grund) {
            return verb.db.ref(pfad(raum) + '/wuensche/' + wunschId + '/abgelehnt').set(String(grund || 'abgelehnt'));
        },
        radioMelden: function (verb, raum, radio) {
            return schreiben(verb, raum, 'radio', radio);
        },
        aufRadioHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'radio', rueckruf);
        },
        jetztMelden: function (verb, raum, jetzt) {
            return schreiben(verb, raum, 'jetzt', jetzt);
        },
        jetztLesen: function (verb, raum) {
            return verb.db.ref(pfad(raum) + '/jetzt').once('value').then(function (s) { return s.val(); })
                .catch(function () { return null; });
        },
        aufJetztHoeren: function (verb, raum, rueckruf) {
            return hoeren(verb, raum, 'jetzt', rueckruf);
        },
        chefAnmelden: function (verb, raum, pin, name) {
            return verb.db.ref('djremote/' + (raum || cfg.raum || 'city-cafe') + '/chef/geraete/' + verb.uid).set({
                pin: String(pin || ''),
                name: String(name || '').slice(0, 40),
                ts: global.firebase.database.ServerValue.TIMESTAMP
            });
        },
        chefAbmelden: function (verb, raum) {
            return verb.db.ref('djremote/' + (raum || cfg.raum || 'city-cafe') + '/chef/geraete/' + verb.uid).remove();
        },
        istChef: function (verb, raum) {
            return verb.db.ref('djremote/' + (raum || cfg.raum || 'city-cafe') + '/chef/geraete/' + verb.uid)
                .once('value').then(function (s) { return s.exists(); }).catch(function () { return false; });
        }
    };
})(window);
