/*
 * Checks fuer yt-warteschlange.js - laeuft ohne Browser:
 *   node yt-warteschlange.test.js
 */
'use strict';

var W = require('./yt-warteschlange.js');

var passed = 0;
var failed = [];

function check(name, condition, detail) {
    if (condition) passed++;
    else failed.push(name + (detail ? '  →  ' + detail : ''));
}

function eq(name, actual, expected) {
    var a = JSON.stringify(actual);
    var b = JSON.stringify(expected);
    check(name, a === b, 'erwartet ' + b + ', war ' + a);
}

var T0 = Date.UTC(2026, 9, 2, 18, 0, 0);   // 02.10.2026, 20:00 Wiener Zeit
var nr = 0;
function vid(n) { return ('v' + String(n) + '__________').slice(0, 11); }
function eintrag(n, quelle, von, extra) {
    return Object.assign({ id: 'e' + (++nr), videoId: vid(n), titel: 'Titel ' + n, kanal: 'Kanal ' + n,
                           dauerSek: 200, quelle: quelle || 'wunsch', von: von || 'gast1', ts: T0 + nr }, extra || {});
}
function ids(state) { return W.sortiert(state.eintraege).map(function (e) { return e.videoId; }); }
function leer() { return { eintraege: [], gespielt: [], modus: 'aus', radio: { seed: null, titel: [] } }; }

// --- Wunsch-Grenzen -----------------------------------------------------------
(function () {
    var s = leer();
    s = W.einreihen(s, eintrag(1, 'wunsch', 'handyA'), 'wunsch');
    s = W.einreihen(s, eintrag(2, 'wunsch', 'handyA'), 'wunsch');
    var dritter = W.wunschPruefen(s, eintrag(3, 'wunsch', 'handyA'));
    eq('dritter Wunsch desselben Handys abgelehnt', dritter.ok, false);
    check('Ablehnung nennt den Grund', /2 Wünsche/.test(dritter.grund), dritter.grund);
    eq('anderes Handy darf noch', W.wunschPruefen(s, eintrag(4, 'wunsch', 'handyB')).ok, true);
    eq('Chef darf ueber die Grenze', W.wunschPruefen(s, eintrag(5, 'chef', 'handyA'), { istChef: true }).ok, true);
    eq('offene Wuensche zaehlen', W.offeneWuensche(s, 'handyA'), 2);
})();

(function () {
    var s = W.einreihen(leer(), eintrag(7, 'wunsch', 'handyA'), 'wunsch');
    var doppelt = W.wunschPruefen(s, eintrag(7, 'wunsch', 'handyB'));
    eq('dasselbe Video nicht doppelt', doppelt.ok, false);
    eq('doppelt auch fuer den Chef nicht', W.wunschPruefen(s, eintrag(7, 'chef', 'x'), { istChef: true }).ok, false);
    var lang = eintrag(8, 'wunsch', 'handyC', { dauerSek: 11 * 60 });
    eq('Gast: laenger als 10 Minuten abgelehnt', W.wunschPruefen(s, lang).ok, false);
    eq('Chef: lang erlaubt', W.wunschPruefen(s, lang, { istChef: true }).ok, true);
    eq('genau 10 Minuten erlaubt', W.wunschPruefen(s, eintrag(9, 'wunsch', 'h', { dauerSek: 600 })).ok, true);
    eq('Laenge aus "12:05" erkannt', W.wunschPruefen(s, eintrag(10, 'wunsch', 'h', { dauerSek: undefined, dauer: '12:05' })).ok, false);
    eq('ungueltige videoId', W.wunschPruefen(s, { videoId: 'abc', von: 'h' }).ok, false);
})();

// --- Reihenfolge Chef / Gast / Playlist --------------------------------------
(function () {
    var s = leer();
    s = W.einreihen(s, eintrag(1, 'playlist', 'chef1'), 'ende');
    s = W.einreihen(s, eintrag(2, 'playlist', 'chef1'), 'ende');
    s = W.einreihen(s, eintrag(3, 'wunsch', 'gast'), 'wunsch');
    eq('Gaeste-Wunsch vor Playlist-Titeln', ids(s), [vid(3), vid(1), vid(2)]);
    s = W.einreihen(s, eintrag(4, 'wunsch', 'gast2'), 'wunsch');
    eq('zweiter Wunsch hinter dem ersten', ids(s), [vid(3), vid(4), vid(1), vid(2)]);
    s = W.einreihen(s, eintrag(5, 'chef', 'chef1'), 'naechstes');
    eq('Chef "Als Naechstes" ganz vorn', ids(s)[0], vid(5));
    s = W.einreihen(s, eintrag(6, 'chef', 'chef1'), 'naechstes');
    eq('zweites "Als Naechstes" hinter dem ersten', ids(s).slice(0, 2), [vid(5), vid(6)]);
    s = W.einreihen(s, eintrag(7, 'wunsch', 'gast3'), 'wunsch');
    eq('Wunsch hinter Chef-Naechstes und Wuenschen', ids(s), [vid(5), vid(6), vid(3), vid(4), vid(7), vid(1), vid(2)]);
    s = W.einreihen(s, eintrag(8, 'chef', 'chef1'), 'ende');
    eq('Chef "Ans Ende" ganz hinten', ids(s)[ids(s).length - 1], vid(8));
})();

// --- Songende, Radio, Rotation ------------------------------------------------
(function () {
    var s = leer();
    s.modus = 'warteschlange';
    s = W.einreihen(s, eintrag(1, 'wunsch', 'a'), 'wunsch');
    s = W.einreihen(s, eintrag(2, 'wunsch', 'b'), 'wunsch');
    s.radio = { seed: vid(1), titel: [eintrag(50, 'radio'), eintrag(51, 'radio')] };
    s.letzterWunschTs = T0;
    var r = W.weiter(s, T0 + 1000);
    eq('Songende: erster Eintrag spielt', r.eintrag.videoId, vid(1));
    eq('Songende: aus der Schlange genommen', ids(r.state), [vid(2)]);
    r = W.weiter(r.state, T0 + 2000);
    eq('dann der zweite', r.eintrag.videoId, vid(2));
    r = W.weiter(r.state, T0 + 3000);
    eq('Schlange leer -> Radio', [r.aktion, r.eintrag.quelle, r.eintrag.videoId], ['spielen', 'radio', vid(50)]);
    eq('Modus radio', r.state.modus, 'radio');
    r = W.weiter(r.state, T0 + 4000);
    eq('naechster Radio-Titel', r.eintrag.videoId, vid(51));
    r = W.weiter(r.state, T0 + 5000);
    eq('Radio leer -> Rotation', [r.aktion, r.state.modus], ['rotation', 'aus']);
})();

(function () {
    var s = leer();
    s.modus = 'radio';
    s.jetzt = eintrag(60, 'radio');
    s.radio = { seed: vid(60), titel: [eintrag(61, 'radio')] };
    s.letzterWunschTs = T0;
    eq('59 Min ohne Wunsch: Radio weiter', W.weiter(s, T0 + 59 * 60000).aktion, 'spielen');
    eq('60 Min ohne Wunsch: zurueck zur Rotation', W.weiter(s, T0 + 60 * 60000).aktion, 'rotation');
    eq('Zeitgrenze einstellbar', W.weiter(s, T0 + 20 * 60000, { radioMaxMin: 15 }).aktion, 'rotation');
    eq('Radio aus -> Rotation', W.weiter(s, T0 + 1000, { radio: false }).aktion, 'rotation');
    var mitWunsch = W.einreihen(s, eintrag(62, 'wunsch', 'g', { ts: T0 + 70 * 60000 }), 'wunsch');
    eq('Schlange spielt auch nach Ablauf', W.weiter(mitWunsch, T0 + 71 * 60000).eintrag.videoId, vid(62));
})();

(function () {
    var s = leer();
    s.modus = 'playlist';
    s = W.einreihen(s, eintrag(70, 'playlist', 'chef'), 'ende');
    s.letzterWunschTs = T0 - 5 * 3600 * 1000;   // laengst abgelaufen
    eq('Playlist laeuft ohne Zeitgrenze', W.weiter(s, T0).eintrag.videoId, vid(70));
})();

// --- Stopp, Ueberspringen ------------------------------------------------------
(function () {
    var s = leer();
    s.modus = 'warteschlange';
    s.jetzt = eintrag(80, 'wunsch', 'a');
    s = W.einreihen(s, eintrag(81, 'wunsch', 'b'), 'wunsch');
    var g = W.stopp(s);
    eq('Stopp: Musik aus', [g.modus, g.jetzt], ['aus', null]);
    eq('Stopp: Schlange bleibt', ids(g), [vid(81)]);
    var u = W.weiter(s, T0);
    eq('Ueberspringen = Songende', u.eintrag.videoId, vid(81));
    eq('uebersprungener Song zaehlt als gespielt', u.state.gespielt.map(function (x) { return x.videoId; }), [vid(80)]);
})();

// --- Radio-Filter --------------------------------------------------------------
(function () {
    var gespielt = [{ videoId: vid(1), kuenstler: 'X', ts: T0 - 3600 * 1000 },
                    { videoId: vid(2), kuenstler: 'Y', ts: T0 - 3 * 3600 * 1000 }];
    var titel = [eintrag(1, 'radio'), eintrag(2, 'radio'), eintrag(3, 'radio'), eintrag(4, 'radio')];
    eq('vor 1 h gespielt raus, vor 3 h wieder erlaubt, laufendes raus',
       W.radioFiltern(titel, gespielt, vid(3), T0).map(function (t) { return t.videoId; }), [vid(2), vid(4)]);
    var gleich = [1, 2, 3, 4].map(function (n) { return eintrag(90 + n, 'radio', null, { kuenstler: 'Helene' }); });
    gleich.splice(3, 0, eintrag(99, 'radio', null, { kuenstler: 'Andrea' }));
    var f = W.radioFiltern(gleich, [], null, T0).map(function (t) { return t.kuenstler; });
    var maxFolge = 0, akt = 0, vorher = '';
    f.forEach(function (k) { akt = (k === vorher) ? akt + 1 : 1; vorher = k; maxFolge = Math.max(maxFolge, akt); });
    check('hoechstens 2 vom selben Kuenstler in Folge', maxFolge <= 2, JSON.stringify(f));
    var folge = [{ videoId: 'g1_________', kuenstler: 'Helene', ts: T0 - 1000 }, { videoId: 'g2_________', kuenstler: 'Helene', ts: T0 - 500 }];
    eq('Folge zaehlt ab den zuletzt gespielten', W.radioFiltern(gleich, folge, null, T0)[0].kuenstler, 'Andrea');
})();

(function () {
    var s = leer();
    s.jetzt = eintrag(100, 'wunsch', 'g');
    s.radio = { seed: vid(5), titel: [1, 2, 3, 4, 5, 6].map(function (n) { return eintrag(110 + n, 'radio'); }) };
    eq('Wunsch gespielt -> neuer Mix mit Wunsch als seed', W.radioSeedNoetig(s), vid(100));
    s.radio.seed = vid(100);
    eq('seed schon aktuell -> kein neuer Mix', W.radioSeedNoetig(s), null);
    var r = leer();
    r.jetzt = eintrag(120, 'radio');
    r.radio = { seed: vid(1), titel: [eintrag(121, 'radio'), eintrag(122, 'radio')] };
    eq('weniger als 5 Radio-Titel -> nachladen', W.radioSeedNoetig(r), vid(120));
    r.radio.titel = [1, 2, 3, 4, 5].map(function (n) { return eintrag(130 + n, 'radio'); });
    eq('5 und mehr -> nicht nachladen', W.radioSeedNoetig(r), null);
})();

// --- Umsortieren -----------------------------------------------------------------
(function () {
    var s = leer();
    [1, 2, 3, 4, 5].forEach(function (n) { s = W.einreihen(s, eintrag(200 + n, 'chef', 'c'), 'ende'); });
    var vierter = W.sortiert(s.eintraege)[3];
    var neu = W.verschieben(s, vierter.id, 0);
    eq('Titel 4 auf Platz 1', ids(neu), [vid(204), vid(201), vid(202), vid(203), vid(205)]);
    var nurEiner = neu.eintraege.filter(function (e, i) { return e.pos !== s.eintraege[i].pos; });
    eq('nur eine pos geaendert', nurEiner.length, 1);
    var hinten = W.verschieben(s, W.sortiert(s.eintraege)[0].id, 4);
    eq('Titel 1 ans Ende', ids(hinten)[4], vid(201));
    eq('Mittelwert der Nachbarn', W.posZwischen(1000, 2000), 1500);
    eq('vor den ersten', W.posZwischen(null, 1000), 0);
    var weg = W.entfernen(s, vierter.id);
    eq('Eintrag entfernen', ids(weg).length, 4);
})();

// --- Vorschau fuer TV und Handy ---------------------------------------------------
(function () {
    var s = leer();
    s.modus = 'warteschlange';
    s = W.einreihen(s, eintrag(300, 'wunsch', 'g'), 'wunsch');
    s.radio = { seed: vid(300), titel: [eintrag(301, 'radio'), eintrag(300, 'radio'), eintrag(302, 'radio')] };
    var v = W.vorschau(s, 5, T0).map(function (t) { return t.videoId; });
    eq('Vorschau: Schlange, dann Radio ohne Doppelte', v, [vid(300), vid(301), vid(302)]);
    eq('Vorschau begrenzt', W.vorschau(s, 2, T0).length, 2);
})();

// --- Stimmungs-Playlists nach Uhrzeit ------------------------------------------------
(function () {
    var pl = [
        { nr: 1, name: 'Party Hits', zeit: '21:00-08:00' },
        { nr: 2, name: 'Schlager', zeit: '17:00-21:00' },
        { nr: 3, name: 'Après-Ski' },
        { nr: 4, name: 'Chill', zeit: '08:00-17:00' }
    ];
    function um(h, m) { return W.stimmungsPlaylist(pl, h * 60 + (m || 0)).name; }
    eq('10:00 Chill', um(10), 'Chill');
    eq('16:59 Chill', um(16, 59), 'Chill');
    eq('17:00 Schlager', um(17), 'Schlager');
    eq('21:00 Party', um(21), 'Party Hits');
    eq('23:59 Party', um(23, 59), 'Party Hits');
    eq('00:00 Party (ueber Mitternacht)', um(0), 'Party Hits');
    eq('07:59 Party', um(7, 59), 'Party Hits');
    eq('08:00 Chill', um(8), 'Chill');
    eq('ohne Zeitangaben: erste Playlist', W.stimmungsPlaylist([{ name: 'A' }, { name: 'B' }], 600).name, 'A');
    eq('leere Liste', W.stimmungsPlaylist([], 600), null);
    eq('gleiche Zeit = ganzer Tag', W.zeitPasst('00:00-00:00', 777), true);
    eq('kaputte Zeitangabe passt nicht', W.zeitPasst('abends', 1200), false);
    eq('Wiener Minute (20:00 MESZ)', W.wienerMinute(new Date(T0)), 20 * 60);
    eq('Wiener Minute im Winter (UTC+1)', W.wienerMinute(new Date(Date.UTC(2026, 11, 24, 23, 30))), 30);
})();

// --- Dauer lesen ---------------------------------------------------------------------
eq('3:40 -> 220', W.sekunden({ dauer: '3:40' }), 220);
eq('1:02:03 -> 3723', W.sekunden({ dauer: '1:02:03' }), 3723);
eq('dauerSek hat Vorrang', W.sekunden({ dauer: '3:40', dauerSek: 99 }), 99);
eq('ohne Angabe 0', W.sekunden({}), 0);

if (failed.length) {
    console.log(failed.length + ' von ' + (passed + failed.length) + ' Checks fehlgeschlagen:');
    failed.forEach(function (f) { console.log('  ✗ ' + f); });
    process.exit(1);
} else {
    console.log('Alle ' + passed + ' Checks bestanden.');
}
