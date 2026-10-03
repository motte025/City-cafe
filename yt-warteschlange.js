/*
 * YouTube-Musik: Warteschlange, Radio-Mix, Stimmungs-Playlists - reine Logik.
 *
 * Wird von index.html (TV) und yt-fernbedienung.html (Handy) geteilt. Der TV
 * ist die einzige Quelle der Wahrheit fuer die Reihenfolge (siehe
 * YOUTUBE-MUSIK-SETUP.md, Abschnitt 5). Hier stehen bewusst keine DOM- und
 * Firebase-Zugriffe, nur Zustand rein, Zustand raus - geprueft mit
 *   node yt-warteschlange.test.js
 *
 * Zustand (alles, was der TV fuer die Entscheidung braucht):
 *   {
 *     eintraege: [ Eintrag ],      die Warteschlange (Firebase yt/warteschlange)
 *     radio:     { seed, titel: [Titel] },
 *     jetzt:     Eintrag | null,   der laufende Song
 *     modus:     'aus' | 'warteschlange' | 'radio' | 'playlist',
 *     gespielt:  [ { videoId, kuenstler, ts } ],   fuer den Radio-Filter
 *     letzterWunschTs: ms,         letzter Gaeste-/Chef-Wunsch (Radio-Zeitgrenze)
 *     seedVonWunsch: bool          letzter Song war ein Wunsch -> neuer Mix
 *   }
 * Eintrag: { id, videoId, titel, kanal, dauer, dauerSek, kuenstler, songtitel,
 *            quelle: 'wunsch'|'playlist'|'radio'|'chef', von, pos, ts }
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.YtWarteschlange = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Vorgaben aus der Spec (Abschnitt 11) - der Betreiber kann sie aendern.
    var MAX_OFFENE_WUENSCHE = 2;        // je Geraet (von)
    var MAX_WUNSCH_SEKUNDEN = 10 * 60;   // laengere Videos nur fuer den Chef
    var RADIO_MAX_MIN = 60;             // Radio ohne neuen Wunsch, dann Rotation
    var RADIO_SPERRE_MS = 2 * 3600 * 1000;   // schon gespielt: 2 h nicht wieder
    var RADIO_NACHLADEN_UNTER = 5;      // weniger Titel uebrig -> neuen Mix holen
    var MAX_JE_KUENSTLER_IN_FOLGE = 2;
    var POS_SCHRITT = 1000;
    // "Passt dazu" folgt jedem neuen Titel (Wunsch des Betreibers): zu jedem Song
    // ein frischer Mix. false = Seed bleibt beim Wunsch, nachgeladen erst unter 5.
    var MIX_JE_TITEL = true;
    // Gaeste-Wuensche kommen fruehestens auf diesen Platz der Schlange (Wunsch
    // des Betreibers: "ab fuenf"), hinter schon wartende Wuensche und Chef-
    // "Als Naechstes". Ist die Schlange kuerzer, hinten an. 1 = ganz vorn.
    var WUNSCH_AB_PLATZ = 5;

    function liste(state) { return (state && state.eintraege) || []; }

    function sortiert(eintraege) {
        return eintraege.slice().sort(function (a, b) {
            return (a.pos - b.pos) || ((a.ts || 0) - (b.ts || 0));
        });
    }

    function sekunden(eintrag) {
        if (!eintrag) return 0;
        if (typeof eintrag.dauerSek === 'number') return eintrag.dauerSek;
        // "3:40" oder "1:02:03"
        var teile = String(eintrag.dauer || '').split(':').map(Number);
        if (!teile.length || teile.some(isNaN)) return 0;
        return teile.reduce(function (s, t) { return s * 60 + t; }, 0);
    }

    // Offen = noch in der Schlange ODER gerade laufend: sonst koennte ein Handy,
    // dessen erster Wunsch sofort anlaeuft, gleich drei Songs hintereinander
    // stellen (Abnahme: "dritter Wunsch eines Handys wird abgelehnt").
    function offeneWuensche(state, von) {
        var laufend = state && state.jetzt && state.jetzt.quelle === 'wunsch' && state.jetzt.von === von ? 1 : 0;
        return laufend + liste(state).filter(function (e) {
            return e.quelle === 'wunsch' && e.von === von;
        }).length;
    }

    function istDoppelt(state, videoId) {
        return liste(state).some(function (e) { return e.videoId === videoId; });
    }

    /**
     * Kommt ein Wunsch in die Warteschlange? -> { ok: true } | { ok: false, grund }
     * opt.istChef: Chef darf auch lange Videos und unbegrenzt viele.
     */
    function wunschPruefen(state, wunsch, opt) {
        opt = opt || {};
        // Ohne videoId geht es nur mit Suchtext (Titel aus einer Platzhalter-Playlist).
        var hatId = wunsch && /^[A-Za-z0-9_-]{11}$/.test(String(wunsch.videoId || ''));
        if (!wunsch || (!hatId && !String(wunsch.suche || '').trim())) {
            return { ok: false, grund: 'Ungültiges Video' };
        }
        if (hatId ? istDoppelt(state, wunsch.videoId)
                  : liste(state).some(function (e) { return e.suche && e.suche === wunsch.suche; })) {
            return { ok: false, grund: 'Steht schon in der Warteschlange' };
        }
        if (!opt.istChef) {
            if (offeneWuensche(state, wunsch.von) >= MAX_OFFENE_WUENSCHE) {
                return { ok: false, grund: 'Du hast schon ' + MAX_OFFENE_WUENSCHE + ' Wünsche offen – warte, bis einer gelaufen ist' };
            }
            if (sekunden(wunsch) > MAX_WUNSCH_SEKUNDEN) {
                return { ok: false, grund: 'Zu lang (höchstens 10 Minuten)' };
            }
        }
        return { ok: true };
    }

    /** Position zwischen zwei Nachbarn (Mittelwert), fuer Einfuegen und Ziehen. */
    function posZwischen(vorher, nachher) {
        if (vorher == null && nachher == null) return POS_SCHRITT;
        if (vorher == null) return nachher - POS_SCHRITT;
        if (nachher == null) return vorher + POS_SCHRITT;
        return (vorher + nachher) / 2;
    }

    /**
     * Wo kommt ein neuer Eintrag hin? art:
     *   'naechstes' - Chef "Als Naechstes": ganz vorn (hinter frueheren "Als Naechstes")
     *   'wunsch'    - Gast: fruehestens Platz 5, hinter Wuensche und "Als Naechstes"
     *   'ende'      - Chef "Ans Ende", Playlist anhaengen: ganz hinten
     */
    function posFuer(state, art) {
        var s = sortiert(liste(state));
        if (!s.length) return POS_SCHRITT;
        if (art === 'naechstes') {
            var vorn = s.filter(function (e) { return e.naechstes; });
            if (!vorn.length) return posZwischen(null, s[0].pos);
            var letzter = vorn[vorn.length - 1];
            var idx = s.indexOf(letzter);
            return posZwischen(letzter.pos, s[idx + 1] ? s[idx + 1].pos : null);
        }
        if (art === 'wunsch') {
            var nach = WUNSCH_AB_PLATZ - 1;   // so viele Eintraege bleiben davor
            s.forEach(function (e, j) {
                if (e.quelle === 'wunsch' || e.naechstes) nach = Math.max(nach, j + 1);
            });
            if (nach < s.length) return posZwischen(nach ? s[nach - 1].pos : null, s[nach].pos);
        }
        return s[s.length - 1].pos + POS_SCHRITT;
    }

    /** Eintrag in die Schlange (gibt neuen Zustand zurueck, alter bleibt unberuehrt). */
    function einreihen(state, eintrag, art) {
        var e = Object.assign({}, eintrag);
        e.pos = posFuer(state, art);
        if (art === 'naechstes') e.naechstes = true;
        var neu = Object.assign({}, state, { eintraege: liste(state).concat([e]) });
        if (e.quelle === 'wunsch' || e.quelle === 'chef') neu.letzterWunschTs = e.ts || neu.letzterWunschTs;
        return neu;
    }

    function entfernen(state, id) {
        return Object.assign({}, state, {
            eintraege: liste(state).filter(function (e) { return e.id !== id; })
        });
    }

    /** Chef zieht einen Eintrag: nur dessen pos aendert sich (Mittelwert der Nachbarn). */
    function verschieben(state, id, nachIndex) {
        var s = sortiert(liste(state)).filter(function (e) { return e.id !== id; });
        var eintrag = liste(state).filter(function (e) { return e.id === id; })[0];
        if (!eintrag) return state;
        nachIndex = Math.max(0, Math.min(s.length, nachIndex));
        var pos = posZwischen(nachIndex > 0 ? s[nachIndex - 1].pos : null,
                              nachIndex < s.length ? s[nachIndex].pos : null);
        return Object.assign({}, state, {
            eintraege: liste(state).map(function (e) {
                return e.id === id ? Object.assign({}, e, { pos: pos, naechstes: nachIndex === 0 || e.naechstes }) : e;
            })
        });
    }

    function kuenstlerVon(t) {
        return String((t && (t.kuenstler || t.kanal)) || '').toLowerCase().trim();
    }

    /**
     * Radio-Titel ohne kuerzlich Gespieltes, ohne das laufende Video, und
     * hoechstens MAX_JE_KUENSTLER_IN_FOLGE gleiche Kuenstler hintereinander
     * (gezaehlt ab den zuletzt gespielten Songs).
     */
    function titelNorm(t) {
        return String((t && (t.songtitel || t.titel)) || '').toLowerCase()
            .replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9äöüß]+/g, '');
    }

    function radioFiltern(titel, gespielt, laufendId, jetztMs, laufendTitel) {
        var gesperrt = {};
        var titelGesperrt = {};
        (gespielt || []).forEach(function (g) {
            if (jetztMs - (g.ts || 0) < RADIO_SPERRE_MS) {
                gesperrt[g.videoId] = true;
                if (g.songtitel) titelGesperrt[titelNorm(g)] = true;
            }
        });
        if (laufendId) gesperrt[laufendId] = true;
        if (laufendTitel) titelGesperrt[titelNorm({ songtitel: laufendTitel })] = true;
        // Anderer Upload desselben Songs (gleicher Titel) zaehlt als schon gespielt.
        titel = (titel || []).filter(function (t) {
            var n = titelNorm(t);
            return !(n && titelGesperrt[n]);
        });
        var folge = (gespielt || []).slice(-MAX_JE_KUENSTLER_IN_FOLGE).map(kuenstlerVon);
        var ergebnis = [];
        var zurueck = [];
        (titel || []).forEach(function (t) {
            if (!t || gesperrt[t.videoId]) return;
            gesperrt[t.videoId] = true;
            var k = kuenstlerVon(t);
            var letzte = folge.concat(ergebnis.map(kuenstlerVon)).slice(-MAX_JE_KUENSTLER_IN_FOLGE);
            if (k && letzte.length >= MAX_JE_KUENSTLER_IN_FOLGE && letzte.every(function (x) { return x === k; })) {
                zurueck.push(t);       // spaeter, nicht gar nicht
                return;
            }
            ergebnis.push(t);
        });
        // Zurueckgestellte hinten anhaengen, sofern sie dort nicht wieder in Folge stehen.
        zurueck.forEach(function (t) {
            var letzte = ergebnis.slice(-MAX_JE_KUENSTLER_IN_FOLGE).map(kuenstlerVon);
            var k = kuenstlerVon(t);
            if (!(letzte.length >= MAX_JE_KUENSTLER_IN_FOLGE && letzte.every(function (x) { return x === k; }))) {
                ergebnis.push(t);
            }
        });
        return ergebnis;
    }

    /** Die naechsten n Titel in Spielreihenfolge: erst die Schlange, dann Radio. */
    // Die Vorschau spielt weiter() n-mal im Kopf durch: so zeigt der TV genau die
    // Reihenfolge, in der die Songs wirklich kommen (vorher eigene Regeln -> die
    // Anzeige wich ab, z. B. bei "hoechstens 2 vom selben Kuenstler").
    function vorschau(state, n, jetztMs, opt) {
        if (!state || state.modus === 'aus' || !state.modus) return sortiert(liste(state)).slice(0, n);
        var aus = [], st = state;
        for (var i = 0; i < n; i++) {
            var r = weiter(st, jetztMs || 0, opt);
            if (r.aktion !== 'spielen') break;
            aus.push(r.eintrag);
            st = r.state;
        }
        return aus;
    }

    function radioAbgelaufen(state, jetztMs, maxMin) {
        var grenze = (maxMin == null ? RADIO_MAX_MIN : maxMin) * 60000;
        return !!state && jetztMs - (state.letzterWunschTs || 0) >= grenze;
    }

    /**
     * Was kommt als Naechstes? Bei Songende, Ueberspringen oder Musikstart.
     * -> { state, aktion: 'spielen' | 'rotation', eintrag }
     * Der gespielte Song wandert nach "gespielt" (Radio-Filter); kam er aus der
     * Schlange, ist er dort schon raus.
     */
    function weiter(state, jetztMs, opt) {
        opt = opt || {};
        var st = Object.assign({ eintraege: [], gespielt: [], modus: 'aus' }, state);
        var gespielt = st.gespielt.slice();
        if (st.jetzt) {
            gespielt.push({ videoId: st.jetzt.videoId, kuenstler: st.jetzt.kuenstler || st.jetzt.kanal || '',
                            songtitel: st.jetzt.songtitel || '', ts: jetztMs });
            gespielt = gespielt.filter(function (g) { return jetztMs - g.ts < RADIO_SPERRE_MS; }).slice(-100);
        }
        var seedVonWunsch = !!(st.jetzt && (st.jetzt.quelle === 'wunsch' || st.jetzt.quelle === 'chef'));
        var s = sortiert(st.eintraege);
        if (s.length) {
            var naechster = s[0];
            var modus = naechster.quelle === 'playlist' ? 'playlist' : 'warteschlange';
            return {
                aktion: 'spielen',
                eintrag: naechster,
                state: Object.assign({}, st, {
                    eintraege: st.eintraege.filter(function (e) { return e.id !== naechster.id; }),
                    jetzt: naechster, modus: modus, gespielt: gespielt, seedVonWunsch: seedVonWunsch
                })
            };
        }
        // Schlange leer: Radio, sofern nicht aus und die Zeit nicht abgelaufen.
        // Eine zu Ende gelaufene Playlist geht ins Radio ueber (Spec 5.4 sagt nur,
        // dass sie selbst keine Zeitgrenze hat).
        var radioErlaubt = opt.radio !== false && st.modus !== 'aus'
            && !radioAbgelaufen(st, jetztMs, opt.radioMaxMin);
        if (radioErlaubt) {
            var titel = radioFiltern(st.radio && st.radio.titel, gespielt,
                                     st.jetzt && st.jetzt.videoId, jetztMs, st.jetzt && st.jetzt.songtitel);
            if (titel.length) {
                var t = Object.assign({ quelle: 'radio', id: 'radio-' + titel[0].videoId }, titel[0]);
                return {
                    aktion: 'spielen',
                    eintrag: t,
                    state: Object.assign({}, st, {
                        radio: Object.assign({}, st.radio, {
                            titel: (st.radio.titel || []).filter(function (x) { return x.videoId !== t.videoId; })
                        }),
                        jetzt: t, modus: 'radio', gespielt: gespielt, seedVonWunsch: seedVonWunsch
                    })
                };
            }
        }
        return {
            aktion: 'rotation',
            eintrag: null,
            state: Object.assign({}, st, { jetzt: null, modus: 'aus', gespielt: gespielt, seedVonWunsch: false })
        };
    }

    /** Muss ein neuer Radio-Mix geholt werden? -> videoId des seed oder null. */
    function radioSeedNoetig(state) {
        if (!state || !state.jetzt) return null;
        var seed = state.radio && state.radio.seed;
        var rest = (state.radio && state.radio.titel ? state.radio.titel.length : 0);
        // Seed ist der laufende Wunsch - NICHT der Radio-Titel danach (sonst
        // wechselte der Mix nach jedem Wunsch gleich zweimal).
        if (MIX_JE_TITEL && seed !== state.jetzt.videoId) return state.jetzt.videoId;
        var istWunsch = state.jetzt.quelle === 'wunsch' || state.jetzt.quelle === 'chef';
        if (istWunsch && seed !== state.jetzt.videoId) return state.jetzt.videoId;
        if (rest < RADIO_NACHLADEN_UNTER && seed !== state.jetzt.videoId) return state.jetzt.videoId;
        return null;
    }

    /** Chef "Stopp": Musik aus, zurueck zur Rotation - die Schlange bleibt. */
    function stopp(state) {
        return Object.assign({}, state, { jetzt: null, modus: 'aus' });
    }

    // --- Stimmungs-Playlists nach Uhrzeit (Wiener Zeit) ----------------------

    function minuten(hhmm) {
        var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }

    /** "21:00-08:00" -> passt die Minute des Tages hinein? (auch ueber Mitternacht) */
    function zeitPasst(bereich, minuteDesTages) {
        var teile = String(bereich || '').split('-');
        if (teile.length !== 2) return false;
        var von = minuten(teile[0]), bis = minuten(teile[1]);
        if (von == null || bis == null) return false;
        if (von === bis) return true;                       // ganzer Tag
        if (von < bis) return minuteDesTages >= von && minuteDesTages < bis;
        return minuteDesTages >= von || minuteDesTages < bis;   // ueber Mitternacht
    }

    /** Playlist fuer "Musik starten" ohne konkreten Song. -> Playlist oder null */
    function stimmungsPlaylist(playlists, minuteDesTages) {
        var mitZeit = (playlists || []).filter(function (p) { return p && p.zeit; });
        for (var i = 0; i < mitZeit.length; i++) {
            if (zeitPasst(mitZeit[i].zeit, minuteDesTages)) return mitZeit[i];
        }
        return (playlists && playlists[0]) || null;
    }

    function wienerMinute(datum) {
        var teile = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(datum || new Date());
        var h = 0, m = 0;
        teile.forEach(function (t) { if (t.type === 'hour') h = Number(t.value); if (t.type === 'minute') m = Number(t.value); });
        return h * 60 + m;
    }

    // --- Titel aufbereiten (Spec 6.4) ----------------------------------------
    // "Helene Fischer - Atemlos durch die Nacht (Official Video) [4K]"
    //   -> { kuenstler: 'Helene Fischer', songtitel: 'Atemlos durch die Nacht' }

    // Woerter, die nur Verpackung sind. Eine Klammer, die nur daraus (und aus
    // Jahreszahlen) besteht, faellt weg; "Live" gehoert NICHT dazu.
    var ZUSATZ = ['official', 'officiel', 'oficial', 'offizielles', 'offizieller', 'offizielle',
        'music', 'musik', 'video', 'musikvideo', 'videoclip', 'clip', 'audio', 'lyrics', 'lyric',
        'hd', 'hq', 'uhd', '4k', '8k', '1080p', '720p', 'remaster', 'remastered', 'visualizer',
        'visualiser', 'explicit', 'mv', 'the', 'full', 'new', 'with', 'version'];
    var ZUSATZ_SET = {};
    ZUSATZ.forEach(function (w) { ZUSATZ_SET[w] = true; });

    function nurZusatz(text) {
        var woerter = String(text).toLowerCase().split(/[\s\/|,&+\-–]+/).filter(Boolean);
        if (!woerter.length) return true;
        if (woerter.indexOf('live') >= 0) return false;
        var echteZusatzwoerter = woerter.filter(function (w) { return ZUSATZ_SET[w]; }).length;
        return echteZusatzwoerter > 0 && woerter.every(function (w) { return ZUSATZ_SET[w] || /^(19|20)\d\d$/.test(w); })
            && !woerter.every(function (w) { return w === 'the' || w === 'new' || w === 'with' || w === 'full' || w === 'version'; });
    }

    // Klammerinhalt aufraeumen: reine Verpackung weg, gemischte Teile kuerzen
    // ("Club Mix / Visualizer" -> "Club Mix").
    function klammerAufraeumen(inhalt, kanalNorm) {
        var t = String(inhalt).trim();
        if (/^(19|20)\d\d$/.test(t)) return { weg: true, jahr: Number(t) };
        if (nurZusatz(t)) return { weg: true };
        if (kanalNorm && normal(t) === kanalNorm) return { weg: true };
        var teile = t.split(/\s*[\/|]\s*/);
        if (teile.length > 1) {
            var rest = teile.filter(function (x) { return !nurZusatz(x); });
            if (!rest.length) return { weg: true };
            return { text: rest.join(' / ') };
        }
        return { text: t };
    }

    function normal(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '');
    }

    function kanalName(kanal) {
        var k = String(kanal || '').trim();
        k = k.replace(/\s+and\s+.*$/i, '');               // "ICH FIND SCHLAGER TOLL and Maite Kelly"
        k = k.replace(/\s*-\s*Topic$/i, '');
        k = k.replace(/\s*\((Official|Offiziell)\)$/i, '');
        if (/VEVO$/.test(k)) {
            k = k.replace(/VEVO$/, '');
            if (k.indexOf(' ') < 0) k = k.replace(/([a-zäöü])([A-ZÄÖÜ])/g, '$1 $2');   // "RolandKaiser"
        }
        return k.trim();
    }

    function klammernAufraeumen(text, kanalNorm, info) {
        var ergebnis = String(text).replace(/\s*[(\[]\s*([^()\[\]]*?)\s*[)\]]/g, function (ganz, inhalt) {
            var k = klammerAufraeumen(inhalt, kanalNorm);
            if (k.jahr && !info.jahr) info.jahr = k.jahr;
            if (k.weg) return '';
            var auf = ganz.trim().charAt(0), zu = auf === '[' ? ']' : ')';
            return ' ' + auf + k.text + zu;
        });
        // "... 'REIM' Album" (Albumhinweis am Ende)
        ergebnis = ergebnis.replace(/\s+['"‘’„“][^'"‘’„“]+['"‘’„“]\s+Album$/i, '');
        return ergebnis.replace(/\s{2,}/g, ' ').trim();
    }

    /**
     * YouTube-Titel -> { kuenstler, songtitel, jahr }.
     * Trennt am ersten " - " / " – " (ersatzweise " | "); ohne Trenner ist der
     * Kanal (ohne " - Topic" / "VEVO") der Kuenstler. Steht der Kanal hinter dem
     * Trenner ("Oceans - Hillsong UNITED - Live"), wird getauscht.
     */
    function titelZerlegen(titel, kanal) {
        var info = { jahr: null };
        var kanalKlar = kanalName(kanal);
        var kanalNorm = normal(kanalKlar);
        var roh = String(titel || '').replace(/\s+/g, ' ').trim();
        // "Song – Album | Kuenstler": steht der Kanal hinter dem letzten " | ",
        // ist er der Kuenstler, und vorn steht der Song (Rest = Album).
        var strich = roh.split(/\s+\|\s+/);
        if (strich.length >= 2 && kanalNorm && normal(strich[strich.length - 1]) === kanalNorm) {
            var vorn = strich.slice(0, -1).join(' | ').split(/\s+[-–—]\s+/)[0];
            var songVorn = klammernAufraeumen(vorn, kanalNorm, info);
            return { kuenstler: kanalKlar, songtitel: songVorn || vorn, jahr: info.jahr };
        }
        var teile = roh.split(/\s+[-–—]\s+/);
        if (teile.length < 2) {
            var rohr = roh.split(/\s+\|\s+/);
            if (rohr.length >= 2) teile = rohr;
        }
        var kuenstler, song;
        if (teile.length >= 2) {
            kuenstler = teile[0];
            song = teile.slice(1).join(' - ');
            var zweiter = normal(klammernAufraeumen(teile[1], '', {}));
            if (kanalNorm && zweiter === kanalNorm && normal(teile[0]).indexOf(kanalNorm) < 0) {
                kuenstler = teile[1];
                song = [teile[0]].concat(teile.slice(2)).join(' - ');
            }
        } else {
            kuenstler = kanalKlar;
            song = roh;
        }
        kuenstler = klammernAufraeumen(kuenstler, '', info);
        song = klammernAufraeumen(song, kanalNorm, info);
        // Song-Ende wie " - Official Video" (Trenner ohne Klammer)
        song = song.split(' - ').filter(function (t, i) { return i === 0 || !nurZusatz(t); }).join(' - ');
        return { kuenstler: kuenstler || kanalKlar, songtitel: song || roh, jahr: info.jahr };
    }

    return {
        titelZerlegen: titelZerlegen,
        kanalName: kanalName,
        MAX_OFFENE_WUENSCHE: MAX_OFFENE_WUENSCHE,
        MAX_WUNSCH_SEKUNDEN: MAX_WUNSCH_SEKUNDEN,
        RADIO_MAX_MIN: RADIO_MAX_MIN,
        RADIO_NACHLADEN_UNTER: RADIO_NACHLADEN_UNTER,
        WUNSCH_AB_PLATZ: WUNSCH_AB_PLATZ,
        MIX_JE_TITEL: MIX_JE_TITEL,
        sekunden: sekunden,
        sortiert: sortiert,
        offeneWuensche: offeneWuensche,
        wunschPruefen: wunschPruefen,
        posZwischen: posZwischen,
        posFuer: posFuer,
        einreihen: einreihen,
        entfernen: entfernen,
        verschieben: verschieben,
        radioFiltern: radioFiltern,
        vorschau: vorschau,
        radioAbgelaufen: radioAbgelaufen,
        weiter: weiter,
        radioSeedNoetig: radioSeedNoetig,
        stopp: stopp,
        zeitPasst: zeitPasst,
        stimmungsPlaylist: stimmungsPlaylist,
        wienerMinute: wienerMinute
    };
});
