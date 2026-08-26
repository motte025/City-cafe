/*
 * Hos’n Obe — Browser-Test fuer den kompletten Spielablauf.
 *
 * OPTIONAL. Die Regel-Logik prueft `node hosn-obe-engine.test.js` ohne
 * jede Abhaengigkeit; dieser Test hier faehrt zusaetzlich die echten Seiten
 * (index.html als TV, hosn-obe.html als Handy) in einem Browser und
 * spielt eine ganze Runde durch. Firebase wird dabei durch einen
 * gemeinsamen Speicher in Node ersetzt, es geht also nichts ins Netz.
 *
 * Voraussetzung:  npm install playwright
 * Aufruf:         node hosn-obe-browser.test.js
 *
 * Faellt der Test mit "Executable doesn't exist" aus, fehlt der Browser:
 *   npx playwright install chromium
 * Alternativ den Pfad zu einem vorhandenen Chromium setzen:
 *   CHROMIUM_PATH=/pfad/zu/chrome node hosn-obe-browser.test.js
 *
 * Geprueft werden vor allem die Regeln, die man beim Umbauen leicht
 * kaputtmacht: Geber-Ermittlung vor der Runde, Aufgehen erst ab der zweiten
 * Runde und nur nach einem Tausch (Sechs-Sekunden-Fenster) oder mit bereits
 * genutztem "Weiter", schrittweises Aufdecken danach, "Alle 3 tauschen" nur bei
 * Drilling oder gleicher Farbe.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.KT_TEST_PORT || 8099);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.mp4': 'video/mp4'
};

function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
            const file = path.join(ROOT, rel);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404); res.end('nope'); return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(PORT, () => resolve(server));
    });
}

// ---------- gemeinsamer Datenbaum ----------

const tree = {};
const pages = [];

function getAt(obj, parts) {
    let cur = obj;
    for (const p of parts) {
        if (cur === null || typeof cur !== 'object') return null;
        cur = cur[p];
        if (cur === undefined) return null;
    }
    return cur === undefined ? null : cur;
}

function setAt(obj, parts, value) {
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (value === null) delete cur[last];
    else cur[last] = value;
}

/*
 * Jede Aktualisierung bekommt eine laufende Nummer.
 *
 * Ohne die kann der Testaufbau Zustaende in FALSCHER Reihenfolge zustellen:
 * broadcast() haelt seinen Schnappschuss fest und schickt ihn dann an alle
 * Seiten; ist eine Seite gerade beschaeftigt, kann ein aelterer Schnappschuss
 * nach einem neueren ankommen und die Seite auf einen alten Spielstand
 * zuruecksetzen. Echtes Firebase garantiert die Reihenfolge - der Ersatz hier
 * muss das ebenfalls tun, sonst meldet der Test Fehler, die es gar nicht gibt.
 */
let broadcastSeq = 0;

async function broadcast() {
    const seq = ++broadcastSeq;
    const snapshot = JSON.stringify(tree);
    await Promise.all(pages.map(p =>
        p.evaluate(([s, n]) => window.__ktPush && window.__ktPush(s, n), [snapshot, seq]).catch(() => {})
    ));
}

async function dbOp(op) {
    const parts = op.path.split('/').filter(Boolean);
    if (process.env.KT_TRACE && JSON.stringify(op).indexOf('hostSelect') !== -1) {
        console.log('  [db] ' + op.kind + ' ' + op.path + ' -> ' +
                    JSON.stringify(op.value).slice(0, 200));
    }
    if (op.kind === 'set') {
        setAt(tree, parts, op.value);
    } else if (op.kind === 'remove') {
        setAt(tree, parts, null);
    } else if (op.kind === 'update') {
        for (const key of Object.keys(op.value)) {
            setAt(tree, parts.concat(key.split('/').filter(Boolean)), op.value[key]);
        }
    } else if (op.kind === 'read') {
        return getAt(tree, parts);
    } else if (op.kind === 'snapshot') {
        return { seq: broadcastSeq, tree: tree };
    } else if (op.kind === 'transaction') {
        // Der Aufrufer hat den neuen Wert bereits berechnet; hier nur schreiben,
        // wenn sich der Ausgangswert nicht veraendert hat (Serialisierung durch
        // den Node-Single-Thread reicht fuer den Test).
        if (op.value !== undefined) setAt(tree, parts, op.value);
        const after = getAt(tree, parts);
        await broadcast();
        return after;
    }
    await broadcast();
    return getAt(tree, parts);
}

// ---------- Firebase-Ersatz im Browser ----------

const STUB = `
window.__ktListeners = [];
window.__ktTree = {};
window.__ktSeq = 0;
window.__ktPush = function (json, seq) {
    // Veraltete Zustellung verwerfen - siehe broadcast() im Testtreiber.
    if (seq !== undefined && seq !== null) {
        if (seq < window.__ktSeq) return;
        window.__ktSeq = seq;
    }
    window.__ktTree = JSON.parse(json);
    window.__ktListeners.forEach(function (l) {
        var parts = l.path.split('/').filter(Boolean);
        var cur = window.__ktTree;
        for (var i = 0; i < parts.length; i++) {
            if (cur === null || typeof cur !== 'object') { cur = null; break; }
            cur = cur[parts[i]];
            if (cur === undefined) { cur = null; break; }
        }
        var val = cur === undefined ? null : cur;
        var key = JSON.stringify(val);
        if (key === l.last) return;
        l.last = key;
        l.cb({ val: function () { return val; } });
    });
};

function ktRef(path) {
    return {
        path: path,
        set: function (v) { return window.__ktOp(JSON.stringify({ kind: 'set', path: path, value: v })); },
        remove: function () { return window.__ktOp(JSON.stringify({ kind: 'remove', path: path })); },
        update: function (v) { return window.__ktOp(JSON.stringify({ kind: 'update', path: path, value: v })); },
        transaction: function (fn) {
            return window.__ktOp(JSON.stringify({ kind: 'read', path: path })).then(function (current) {
                var next = fn(current);
                return window.__ktOp(JSON.stringify({
                    kind: 'transaction', path: path, value: next === undefined ? undefined : next
                })).then(function (after) {
                    return {
                        committed: next !== undefined,
                        snapshot: { val: function () { return after; } }
                    };
                });
            });
        },
        once: function () {
            return window.__ktOp(JSON.stringify({ kind: 'read', path: path })).then(function (v) {
                return { val: function () { return v === undefined ? null : v; } };
            });
        },
        on: function (ev, cb) {
            var entry = { path: path, cb: cb, last: null };
            window.__ktListeners.push(entry);
            window.__ktOp(JSON.stringify({ kind: 'snapshot', path: '' })).then(function (res) {
                window.__ktPush(JSON.stringify((res && res.tree) || {}), (res && res.seq) || 0);
            });
            return cb;
        },
        off: function () {
            window.__ktListeners = window.__ktListeners.filter(function (l) { return l.path !== path; });
        }
    };
}

window.firebase = {
    apps: [],
    initializeApp: function () { window.firebase.apps.push({}); },
    auth: function () {
        return {
            onAuthStateChanged: function (cb) { setTimeout(function () { cb({ uid: window.__ktUid }); }, 5); },
            signInAnonymously: function () { return Promise.resolve(); }
        };
    },
    database: function () { return { ref: ktRef }; }
};
window.firebase.database.ServerValue = { TIMESTAMP: 1 };
`;

// ---------- Testlauf ----------

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log((ok ? '  OK   ' : '  FEHL ') + name + (ok || detail === undefined ? '' : '  → ' + detail));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    const server = await serve();
    const browser = await chromium.launch(launchOptions());

    /*
     * cfg: zusaetzliche Einstellungen NUR fuer diese Seite. Der Computer-TV
     * bekommt damit eine laengere Geber-Anzeige und mehr Bedenkzeit - sonst ist
     * die Vorfuehrrunde vorbei, bevor der Gast ueberhaupt gescannt hat.
     */
    async function open(url, uid, cfg) {
        const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        // Firebase-CDN blockieren, Stub stattdessen einsetzen
        await page.route('**gstatic.com/**', r => r.abort());
        await page.exposeBinding('__ktOp', (_src, json) => dbOp(JSON.parse(json)));
        await page.addInitScript(`window.__ktUid = ${JSON.stringify(uid)};`);
        await page.addInitScript(STUB);
        // Im Test denkt der Computer schneller als im Cafe (dort 8s pro Zug),
        // sonst laeuft der Testlauf minutenlang.
        const cfgOverrides = Object.assign({
            botMoveSeconds: 0.9,
            revealSeconds: 3,
            starterSeconds: 1,
            swapWindowSeconds: 3,
            roundTargetSeconds: 90
        }, cfg || {});
        await page.addInitScript(`
            window.addEventListener('DOMContentLoaded', function () {
                if (!window.HOSN_OBE_CONFIG) return;
                var over = ${JSON.stringify(cfgOverrides)};
                for (var key in over) window.HOSN_OBE_CONFIG[key] = over[key];
            });
        `);
        page.__errors = errors;
        pages.push(page);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return page;
    }

    console.log('\n--- TV startet ---');
    const tv = await open(`http://localhost:${PORT}/index.html`, 'tv-uid');
    await sleep(2500);

    const sessionId = Object.keys(tree.games || {})[0] || null;
    check('TV legt eine Session an', !!sessionId, String(sessionId));
    check('Session-Kennung ist sechsstellig', sessionId && sessionId.length === 6, sessionId);
    const pubNow = () => (tree.games[sessionId] || {}).public || {};
    check('Startphase ist idle', pubNow().phase === 'idle', pubNow().phase);

    const names = await tv.evaluate(() => ({
        banner: document.getElementById('kt-banner-title').textContent,
        launcher: document.querySelector('.kt-launcher-label').textContent
    }));
    check('TV nennt das Spiel "Hos’n Obe"',
        /Hos’n Obe/.test(names.banner) && /Hos’n Obe/.test(names.launcher), JSON.stringify(names));

    const launcherVisible = await tv.evaluate(() => {
        const el = document.getElementById('kt-launcher');
        return el && getComputedStyle(el).display !== 'none';
    });
    check('Starter-QR ist sichtbar', launcherVisible);

    console.log('\n--- Handy 1 scannt (wird Host) ---');
    const phone1 = await open(`http://localhost:${PORT}/hosn-obe.html?session=${sessionId}`, 'phone-1');
    await sleep(1200);

    check('Phase wechselt auf hostSelect', pubNow().phase === 'hostSelect', pubNow().phase);

    const countButtons = await phone1.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-count-btn')).map(b => b.textContent));
    check('Host sieht Spieleranzahl 2-6', JSON.stringify(countButtons) === '["2","3","4","5","6"]',
        JSON.stringify(countButtons));

    const botBtn = await phone1.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-btn')).some(b => /Computer/.test(b.textContent)));
    check('Computer-Knopf ist da', botBtn);

    const countBtnSize = await phone1.evaluate(() => {
        const b = document.querySelector('.kt-count-btn');
        return b ? Math.round(b.getBoundingClientRect().height) : 0;
    });
    check('Spieleranzahl-Knöpfe sind groß (>=90px hoch)', countBtnSize >= 90, countBtnSize + 'px');

    console.log('\n--- Host wählt 2 Spieler, Handy 2 tritt bei ---');
    await phone1.evaluate(() => {
        Array.from(document.querySelectorAll('.kt-count-btn')).find(b => b.textContent === '2').click();
    });
    await sleep(800);
    const phone2 = await open(`http://localhost:${PORT}/hosn-obe.html?session=${sessionId}`, 'phone-2');
    await sleep(2200);

    // ---------- Geber ermitteln ----------
    console.log('\n--- Geber wird ausgespielt ---');
    const starterPub = pubNow();
    const starterCards = starterPub.starterCards || {};
    check('Jeder Platz hat eine Geberkarte gezogen',
        Object.keys(starterCards).length === 2, JSON.stringify(starterCards));
    const E = require('./hosn-obe-engine.js');
    const expectedStarter =
        E.compareCards(starterCards[0], starterCards[1]) > 0 ? 0 : 1;
    check('Höchste Geberkarte beginnt', starterPub.starterSeat === expectedStarter,
        JSON.stringify(starterCards) + ' -> ' + starterPub.starterSeat);
    check('Der Geber ist auch am Zug', starterPub.currentTurnSeat === starterPub.starterSeat,
        String(starterPub.currentTurnSeat));

    await sleep(1600);   // Geber-Anzeige laeuft ab (starterSeconds = 1)

    const pubAfterDeal = pubNow();
    check('Ausgeteilt, Phase playing', pubAfterDeal.phase === 'playing', pubAfterDeal.phase);
    check('Drei Karten in der Mitte', (pubAfterDeal.middleCards || []).length === 3);
    check('turnsPlayed startet bei 0', pubAfterDeal.turnsPlayed === 0, String(pubAfterDeal.turnsPlayed));

    check('Countdown-Zahl ist geleert',
        (await tv.evaluate(() => document.getElementById('kt-banner-timer').textContent)) === '',
        JSON.stringify(await tv.evaluate(() => document.getElementById('kt-banner-timer').textContent)));

    /*
     * Vollbild-Regression.
     *
     * #dashboard-scaler traegt ein transform:scale(); ein transformierter
     * Vorfahre wird zum Bezugsrahmen fuer position:fixed. Genau daran ist das
     * Vollbild am echten Fernseher frueher gescheitert - und ein Test bei
     * exakt 1920x1080 (Massstab 1:1) haette es NICHT gesehen. Dieser Testlauf
     * arbeitet bewusst mit 1500x900.
     */
    const fsState = await tv.evaluate(() => {
        const view = document.getElementById('media-view-hosnobe');
        const stage = view.querySelector('.kt-stage');
        const scaler = document.getElementById('dashboard-scaler');
        const vr = view.getBoundingClientRect();
        const sr = scaler.getBoundingClientRect();
        const st = stage.getBoundingClientRect();
        return {
            fullscreen: view.classList.contains('kt-fullscreen'),
            scale: view.style.getPropertyValue('--kt-scale'),
            coversScaler: vr.width >= sr.width - 2 && vr.height >= sr.height - 2,
            stageShare: sr.width ? st.width / sr.width : 0,
            centered: Math.abs((st.left + st.width / 2) - (sr.left + sr.width / 2)) < 3
        };
    });
    check('TV schaltet auf Vollbild', fsState.fullscreen && parseFloat(fsState.scale) > 1,
        JSON.stringify(fsState));
    check('Vollbild deckt den ganzen Dashboard-Rahmen ab', fsState.coversScaler, JSON.stringify(fsState));
    check('Bühne bleibt zentriert und im Seitenverhältnis',
        fsState.centered && fsState.stageShare > 0.85 && fsState.stageShare <= 1.001,
        JSON.stringify(fsState));

    // Wer am Zug ist, muss am TV deutlich markiert sein.
    const turnMark = await tv.evaluate(() => {
        const seat = document.querySelector('.kt-seat.is-active');
        if (!seat) return null;
        const ring = getComputedStyle(seat.querySelector('.kt-fan'), '::after');
        const tag = seat.querySelector('.kt-seat-tag');
        return {
            ringAnim: ring.animationName,
            ringWidth: ring.borderTopWidth,
            tag: tag ? tag.textContent : '',
            tagSize: tag ? getComputedStyle(tag).fontSize : ''
        };
    });
    check('TV markiert den aktiven Platz mit pulsierendem Rahmen',
        !!turnMark && turnMark.ringAnim === 'ktTurnPulse', JSON.stringify(turnMark));
    check('Aktiver Platz trägt ein großes "am Zug"-Band',
        !!turnMark && turnMark.tag === 'am Zug' && parseFloat(turnMark.tagSize) >= 20,
        JSON.stringify(turnMark));

    // ---------- Regeln am Handy ----------
    console.log('\n--- Regeln am Zug-Handy ---');
    const turnSeat = pubAfterDeal.currentTurnSeat;
    const atTurn = async () => {
        const s1 = await phone1.evaluate(() => document.getElementById('kt-status-main').textContent);
        return s1.includes('dran!') ? phone1 : phone2;
    };
    const buttonsOf = p => p.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent));
    const clickButton = async (p, label) => {
        const hit = await p.evaluate(text => {
            const b = Array.from(document.querySelectorAll('.kt-btn')).find(x => x.textContent === text);
            if (!b) return false;
            b.click();
            return true;
        }, label);
        if (!hit) throw new Error('Knopf "' + label + '" nicht gefunden');
        await sleep(600);
    };

    /*
     * Einen Zug tauschen - egal wie die Mitte gerade aussieht.
     *
     * Liegt dort ein Drilling oder liegen drei gleiche Farben, ist der
     * Einzeltausch regelkonform gesperrt; dann bleibt nur "alle 3 nehmen".
     * Ohne diese Fallunterscheidung war der Test von der Zufallsmitte abhaengig
     * und schlug gelegentlich fehl, obwohl alles stimmte.
     */
    const swapFirstCard = async p => {
        const canPick = await p.evaluate(() =>
            document.querySelectorAll('#kt-hand-cards .kt-card.is-pickable').length > 0);
        if (!canPick) { await clickButton(p, 'ALLE 3 NEHMEN'); return; }
        await p.evaluate(() => { document.querySelector('#kt-hand-cards .kt-card').click(); });
        await sleep(150);
        await p.evaluate(() => { document.querySelector('#kt-middle-cards .kt-card').click(); });
        await sleep(600);
    };

    const active = await atTurn();
    const labels = await buttonsOf(active);
    check('Kein "1 Karte tauschen"-Knopf mehr', !labels.some(l => /1 Karte tauschen/.test(l)),
        JSON.stringify(labels));
    check('Kein Aufgehen in der ersten Runde', !labels.some(l => l === 'AUFGEHEN'), JSON.stringify(labels));
    check('"Weiter" steht immer zur Verfügung', labels.includes('WEITER'), JSON.stringify(labels));

    const middleWorth = await active.evaluate(
        m => window.HosnObeEngine.middleWorthTakingAll(m || []), pubNow().middleCards);
    const hasAll = labels.some(l => /ALLE 3 NEHMEN/.test(l));
    check('"Alle 3 tauschen" genau dann, wenn die Mitte es hergibt', hasAll === middleWorth,
        'Knopf=' + hasAll + ' Mitte=' + middleWorth);

    // Regressionsschutz: frueher verschwanden "Alle 3 tauschen" und "Aufgehen",
    // sobald man eine Karte antippte.
    await active.evaluate(() => { document.querySelector('#kt-hand-cards .kt-card').click(); });
    await sleep(200);
    const whileSelected = await buttonsOf(active);
    check('Knöpfe bleiben nach dem Antippen einer Karte stehen',
        JSON.stringify(whileSelected) === JSON.stringify(labels),
        JSON.stringify(labels) + ' -> ' + JSON.stringify(whileSelected));
    await active.evaluate(() => { document.querySelector('#kt-hand-cards .kt-card').click(); });
    await sleep(200);

    const handCardH = await active.evaluate(() => {
        const c = document.querySelector('#kt-hand-cards .kt-card');
        return c ? Math.round(c.getBoundingClientRect().height) : 0;
    });
    check('Handkarten sind groß (>=220px auf 1500px-Viewport)', handCardH >= 220, handCardH + 'px');

    // ---------- Zug 1 und 2: je ein Tausch ----------
    console.log('\n--- Tausch per Antippen ---');
    await swapFirstCard(active);
    check('Kein Bestätigen-Schritt mehr',
        !(await active.evaluate(() =>
            Array.from(document.querySelectorAll('.kt-btn')).some(b => /bestätigen/i.test(b.textContent)))));
    const afterSwap = pubNow();
    check('turnsPlayed hochgezählt', afterSwap.turnsPlayed === 1, String(afterSwap.turnsPlayed));
    check('Zug ist beim anderen Spieler', afterSwap.currentTurnSeat !== turnSeat);
    check('Vor der zweiten Runde kein Aufgeh-Fenster',
        afterSwap.swapWindowSeat === undefined || afterSwap.swapWindowSeat === null,
        JSON.stringify(afterSwap.swapWindowSeat));

    const active2 = await atTurn();
    await swapFirstCard(active2);
    check('Nach zwei Zügen war jeder einmal dran', pubNow().turnsPlayed === 2,
        String(pubNow().turnsPlayed));

    // ---------- "Weiter" schaltet das Aufgehen ohne Tausch frei ----------
    console.log('\n--- Weiter und danach Aufgehen ohne Tausch ---');
    const active3 = await atTurn();
    const labels3 = await buttonsOf(active3);
    check('Aufgehen erscheint nicht ohne Tausch und ohne genutztes Weiter',
        !labels3.some(l => l === 'AUFGEHEN'), JSON.stringify(labels3));
    await clickButton(active3, 'WEITER');
    check('Weiter zählt als Zug', pubNow().turnsPlayed === 3, String(pubNow().turnsPlayed));

    // ---------- Sechs-Sekunden-Fenster nach dem Tausch ----------
    console.log('\n--- Aufgeh-Fenster nach dem Tausch ---');
    const active4 = await atTurn();
    await swapFirstCard(active4);
    const windowPub = pubNow();
    check('Nach dem Tausch bleibt der Zug beim Spieler',
        windowPub.swapWindowSeat !== undefined && windowPub.swapWindowSeat !== null,
        JSON.stringify(windowPub.swapWindowSeat));
    const windowUi = await active4.evaluate(() => ({
        buttons: Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent),
        count: (document.querySelector('.kt-window-count') || {}).textContent || '',
        pickable: document.querySelectorAll('.kt-card.is-pickable').length
    }));
    check('Im Fenster stehen Aufgehen und Weitergeben bereit',
        windowUi.buttons.includes('AUFGEHEN') && windowUi.buttons.includes('WEITERGEBEN'),
        JSON.stringify(windowUi.buttons));
    check('Der Countdown läuft', Number(windowUi.count) > 0, windowUi.count);
    check('Im Fenster ist der Tausch gesperrt', windowUi.pickable === 0, String(windowUi.pickable));
    const tvWindow = await tv.evaluate(() => {
        const seat = document.querySelector('.kt-seat.is-window');
        return seat ? seat.querySelector('.kt-seat-tag').textContent : null;
    });
    check('TV zeigt das Fenster am richtigen Platz', tvWindow === 'aufgehen?', String(tvWindow));

    await clickButton(active4, 'WEITERGEBEN');
    const afterWindow = pubNow();
    check('Weitergeben schließt das Fenster',
        afterWindow.swapWindowSeat === null || afterWindow.swapWindowSeat === undefined,
        JSON.stringify(afterWindow.swapWindowSeat));
    check('Der Tausch im Fenster zählt nur einen Zug', afterWindow.turnsPlayed === 4,
        String(afterWindow.turnsPlayed));

    // ---------- Aufgehen ohne Tausch (Weiter wurde genutzt) ----------
    console.log('\n--- Aufgehen deckt sofort auf ---');
    const active5 = await atTurn();
    const labels5 = await buttonsOf(active5);
    check('Nach genutztem Weiter darf man ohne Tausch aufgehen',
        labels5.some(l => l === 'AUFGEHEN'), JSON.stringify(labels5));
    await clickButton(active5, 'AUFGEHEN');
    await sleep(400);
    const afterKnock = pubNow();
    const knocker = afterKnock.knockedBySeat;
    check('Phase ist knocked', afterKnock.phase === 'knocked', afterKnock.phase);
    check('Wer aufgeht, liegt sofort offen',
        !!(afterKnock.revealedHands && afterKnock.revealedHands[knocker]),
        JSON.stringify(afterKnock.revealedHands || null));

    const facesUp = await tv.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-fan-card img'))
            .filter(i => !/back_(lightblue|red)\.webp/.test(i.getAttribute('src'))).length);
    check('TV zeigt die offenen Karten', facesUp === 3, String(facesUp));

    const tvTag = await tv.evaluate(() => {
        const el = document.querySelector('.kt-seat.is-knocker .kt-seat-tag');
        return el ? el.textContent : null;
    });
    check('TV nennt es "aufgegangen"', tvTag === 'aufgegangen', String(tvTag));

    const backsUsed = await tv.evaluate(() => {
        const s = new Set(Array.from(document.querySelectorAll('.kt-fan-card img'))
            .map(i => i.getAttribute('src')).filter(x => /back_(lightblue|red)\.webp/.test(x)));
        return Array.from(s);
    });
    check('Verdeckte Karten nutzen die neuen Rückseiten',
        backsUsed.length > 0 && backsUsed.every(s => /back_(lightblue|red)\.webp$/.test(s)),
        JSON.stringify(backsUsed));
    check('Genau EINE Rückseiten-Farbe pro Runde', backsUsed.length === 1, JSON.stringify(backsUsed));

    const backBg = await tv.evaluate(() => {
        const el = document.querySelector('.kt-fan-card.is-back');
        return el ? getComputedStyle(el).backgroundColor : null;
    });
    check('Rückseiten liegen auf Weiß', backBg === 'rgb(255, 255, 255)', String(backBg));

    const skews = await tv.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-middle-card')).map(c => c.style.transform));
    check('Mittenkarten liegen schief und unterschiedlich',
        skews.length === 3 && new Set(skews).size === 3 && skews.every(s => /rotate\(/.test(s)),
        JSON.stringify(skews));

    console.log('\n--- Letzter Zug, dann Auswertung ---');
    const last = await atTurn();
    await swapFirstCard(last);
    await sleep(6000);

    const finalPub = pubNow();
    check('Runde endet in reveal oder idle',
        ['reveal', 'idle'].includes(finalPub.phase), finalPub.phase);
    if (finalPub.scores) {
        const seats = Object.keys(finalPub.scores);
        check('Für jeden Sitz ein Ergebnis', seats.length === 2, JSON.stringify(finalPub.scores));
        const fire = (finalPub.fireSeats || []).length > 0;
        check('Genau ein Verlierer (oder Feuer-Sonderfall)',
            fire || (finalPub.payingSeats || []).length === 1,
            JSON.stringify(finalPub.payingSeats));
        check('Alle Hände aufgedeckt',
            Object.keys(finalPub.revealedHands || {}).length === 2,
            JSON.stringify(Object.keys(finalPub.revealedHands || {})));
    }


    // ---------- Computer-Runde im selben Browser ----------
    console.log('\n--- Computer-Runde ---');
    const tv2 = await open(`http://localhost:${PORT}/index.html`, 'tv-uid',
        { starterSeconds: 5, botMoveSeconds: 1.4 });
    await sleep(2500);
    const sessionId2 = Object.keys(tree.games || {}).filter(k => k !== sessionId)[0] || sessionId;
    const pubNow2 = () => (tree.games[sessionId2] || {}).public || {};
    check('Zweite Session vorhanden', !!sessionId2, String(sessionId2));

    const phone3 = await open(`http://localhost:${PORT}/hosn-obe.html?session=${sessionId2}`, 'phone-1');
    await sleep(1200);

    const botButtons = await phone3.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent).filter(t => /Computer/.test(t)));
    check('Beide Computer-Spielarten stehen zur Wahl',
        botButtons.length === 2 && botButtons.some(t => /Gäste bekommen Karten/.test(t)) &&
        botButtons.some(t => /allein/.test(t)), JSON.stringify(botButtons));

    await phone3.evaluate(() => {
        Array.from(document.querySelectorAll('.kt-btn'))
            .find(b => /Gäste bekommen Karten/.test(b.textContent)).click();
    });
    await sleep(900);

    const started = pubNow2();
    check('Computer-Runde markiert', started.botGame === true, JSON.stringify(started.botGame));
    check('Deckvergabe ist eingeschaltet', started.botSeats === true, JSON.stringify(started.botSeats));
    check('Sechs Plätze im Spiel', Number(started.playerCount) === 6, String(started.playerCount));
    check('Die Plätze bleiben für Gäste frei',
        Object.keys(started.seats || {}).length <= 1, JSON.stringify(Object.keys(started.seats || {})));

    // Im Vollbild ist der Starter-QR der Media-Zone verdeckt - waehrend einer
    // Computer-Runde mit Deckvergabe muss die Buehne einen eigenen QR zeigen,
    // sonst koennte niemand mehr dazukommen.
    const joinQr = await tv2.evaluate(() => {
        const el = document.getElementById('kt-joinqr');
        if (!el || getComputedStyle(el).display === 'none') return null;
        const img = document.getElementById('kt-joinqr-img');
        return { src: img ? img.getAttribute('src') : '', label: el.textContent.trim() };
    });
    check('TV zeigt einen Mitspiel-QR während der Computer-Runde',
        !!joinQr && /create-qr-code/.test(joinQr.src), JSON.stringify(joinQr));

    /*
     * Ein Gast scannt mitten in der laufenden Computer-Runde. Er darf die Runde
     * NICHT abwuergen (kein Host werden), bekommt aber einen freien Platz samt
     * eigenem Blatt zum Mitschauen.
     */
    const phaseBeforeGuest = pubNow2().phase;
    const phone4 = await open(`http://localhost:${PORT}/hosn-obe.html?session=${sessionId2}`, 'phone-4');
    await sleep(1500);
    const guest = await phone4.evaluate(() => ({
        seatBadge: document.getElementById('kt-seat-badge').textContent,
        cards: document.querySelectorAll('#kt-hand-cards .kt-card').length,
        buttons: Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent),
        status: document.getElementById('kt-status-main').textContent
    }));
    const phaseAfterGuest = pubNow2().phase;
    console.log('  (Phase vor dem Scan: ' + phaseBeforeGuest + ', danach: ' + phaseAfterGuest + ')');
    check('Die Runde läuft weiter (kein Neustart durch den Scan)',
        phaseAfterGuest !== 'hostSelect', phaseBeforeGuest + ' -> ' + phaseAfterGuest);
    check('Gast bekommt trotz Computer-Runde einen Platz', /Spieler \d/.test(guest.seatBadge), guest.seatBadge);
    check('Gast sieht seine drei Karten', guest.cards === 3, String(guest.cards));
    check('Gast darf nicht eingreifen', guest.buttons.length === 0, JSON.stringify(guest.buttons));
    check('Gast weiß, dass der Computer spielt', /Computer/.test(guest.status), guest.status);

    // Runde durchlaufen lassen
    let sawKnock = false, sawProgressiveReveal = false, maxRevealDuringPlay = 0;
    for (let i = 0; i < 900; i++) {
        const p = pubNow2();
        if (p.knockedBySeat !== undefined && p.knockedBySeat !== null) sawKnock = true;
        if (p.phase === 'knocked') {
            const n = Object.keys(p.revealedHands || {}).length;
            maxRevealDuringPlay = Math.max(maxRevealDuringPlay, n);
            if (n > 0 && n < 3) sawProgressiveReveal = true;
        }
        if (p.phase === 'reveal' && p.scores) break;
        if (p.phase === 'idle' && i > 150) break;
        await sleep(60);
    }

    const done = pubNow2();
    check('Runde läuft von allein bis zum Ende',
        done.phase === 'reveal' || done.phase === 'idle', done.phase);
    /*
     * Eine Runde endet auf zwei Wegen: jemand geht auf, oder es gibt Feuer -
     * dann ist sofort Schluss und alle decken auf, ohne Aufgehen. Mit sechs
     * Spielern ist Feuer haeufig genug, dass der Test beides zulassen muss.
     */
    const endedByFire = done.fireBySeat !== undefined && done.fireBySeat !== null;
    check('Runde endet durch Aufgehen oder Feuer', sawKnock || endedByFire,
        'aufgegangen=' + sawKnock + ' feuer=' + endedByFire);
    if (sawKnock && !endedByFire) {
        check('Nach dem Aufgehen wird schrittweise aufgedeckt',
            sawProgressiveReveal, 'max. gleichzeitig offen während knocked: ' + maxRevealDuringPlay);
    } else {
        console.log('  (übersprungen: Runde endete durch Feuer, nicht durch Aufgehen)');
    }

    if (done.scores) {
        check('Sechs Ergebnisse', Object.keys(done.scores).length === 6, JSON.stringify(done.scores));
        const fire = (done.fireSeats || []).length > 0;
        check('Genau ein Verlierer (oder Feuer)',
            fire || (done.payingSeats || []).length === 1, JSON.stringify(done.payingSeats));
        const scores = Object.values(done.scores);
        check('Alle Punktzahlen plausibel (7-31)',
            scores.every(s => s >= 7 && s <= 31), JSON.stringify(scores));
    }


    // ---------- Fehlerfreiheit ----------
    console.log('\n--- Konsolenfehler ---');
    for (const [name, p] of [['TV', tv], ['Handy 1', phone1], ['Handy 2', phone2],
                             ['TV (Computer)', tv2], ['Handy (Computer)', phone3], ['Gast (Computer)', phone4]]) {
        const real = p.__errors.filter(e => !/gstatic|net::ERR|Failed to load resource|favicon/i.test(e));
        check(name + ' ohne JS-Fehler', real.length === 0, real.slice(0, 3).join(' | '));
    }

    await browser.close();
    server.close();

    const failed = results.filter(r => !r.ok);
    console.log('\n' + (results.length - failed.length) + ' von ' + results.length + ' Checks bestanden.');
    if (failed.length) {
        console.log('\nFEHLGESCHLAGEN:');
        failed.forEach(f => console.log('  x ' + f.name + (f.detail ? '  -> ' + f.detail : '')));
        process.exit(1);
    }
    console.log('Browser-Durchlauf in Ordnung.\n');
}

function launchOptions() {
    const candidates = [
        process.env.CHROMIUM_PATH,
        '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    ].filter(Boolean);
    for (const p of candidates) {
        try { if (require('fs').existsSync(p)) return { executablePath: p }; } catch (e) { /* weiter */ }
    }
    return {};   // Playwright nimmt seinen eigenen Browser
}

run().catch(err => { console.error(err); process.exit(1); });
