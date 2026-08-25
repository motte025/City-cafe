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
 * kaputtmacht: Klopfen erst ab der zweiten Runde, schrittweises Aufdecken
 * nach dem Klopfen, "Alle 3 tauschen" nur bei Drilling oder gleicher Farbe.
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

async function broadcast() {
    const snapshot = JSON.stringify(tree);
    await Promise.all(pages.map(p =>
        p.evaluate(s => window.__ktPush && window.__ktPush(s), snapshot).catch(() => {})
    ));
}

async function dbOp(op) {
    const parts = op.path.split('/').filter(Boolean);
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
        return tree;
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
window.__ktPush = function (json) {
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
        on: function (ev, cb) {
            var entry = { path: path, cb: cb, last: null };
            window.__ktListeners.push(entry);
            window.__ktOp(JSON.stringify({ kind: 'snapshot', path: '' })).then(function (full) {
                window.__ktPush(JSON.stringify(full || {}));
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

    async function open(url, uid) {
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
        await page.addInitScript(`
            window.addEventListener('DOMContentLoaded', function () {
                if (window.HOSN_OBE_CONFIG) {
                    window.HOSN_OBE_CONFIG.botMoveSeconds = 0.5;
                    window.HOSN_OBE_CONFIG.revealSeconds = 3;
                }
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
    await sleep(2500);

    const pubAfterDeal = pubNow();
    check('Ausgeteilt, Phase playing', pubAfterDeal.phase === 'playing', pubAfterDeal.phase);
    check('Drei Karten in der Mitte', (pubAfterDeal.middleCards || []).length === 3);
    check('turnsPlayed startet bei 0', pubAfterDeal.turnsPlayed === 0, String(pubAfterDeal.turnsPlayed));

    check('Countdown-Zahl ist geleert',
        (await tv.evaluate(() => document.getElementById('kt-banner-timer').textContent)) === '',
        JSON.stringify(await tv.evaluate(() => document.getElementById('kt-banner-timer').textContent)));

    // ---------- Regeln am Handy ----------
    console.log('\n--- Regeln am Zug-Handy ---');
    const turnSeat = pubAfterDeal.currentTurnSeat;
    const active = await (async () => {
        const s1 = await phone1.evaluate(() => document.getElementById('kt-status-main').textContent);
        return s1.includes('dran!') ? phone1 : phone2;
    })();

    const labels = await active.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent));
    check('Kein "1 Karte tauschen"-Knopf mehr', !labels.some(l => /1 Karte tauschen/.test(l)),
        JSON.stringify(labels));
    check('Kein Klopfen in der ersten Runde', !labels.some(l => l === 'KLOPFEN'), JSON.stringify(labels));
    check('"Weiter" steht immer zur Verfügung', labels.includes('WEITER'), JSON.stringify(labels));

    const middleWorth = await active.evaluate(
        m => window.HosnObeEngine.middleWorthTakingAll(m || []), pubNow().middleCards);
    const hasAll = labels.some(l => /ALLE 3 NEHMEN/.test(l));
    check('"Alle 3 tauschen" genau dann, wenn die Mitte es hergibt', hasAll === middleWorth,
        'Knopf=' + hasAll + ' Mitte=' + middleWorth);

    // Regressionsschutz: frueher verschwanden "Alle 3 tauschen" und "Klopfen",
    // sobald man eine Karte antippte.
    await active.evaluate(() => { document.querySelector('#kt-hand-cards .kt-card').click(); });
    await sleep(200);
    const whileSelected = await active.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent));
    const stillThere = JSON.stringify(whileSelected) === JSON.stringify(labels);
    check('Knöpfe bleiben nach dem Antippen einer Karte stehen', stillThere,
        JSON.stringify(labels) + ' -> ' + JSON.stringify(whileSelected));
    await active.evaluate(() => { document.querySelector('#kt-hand-cards .kt-card').click(); });
    await sleep(200);

    const handCardH = await active.evaluate(() => {
        const c = document.querySelector('#kt-hand-cards .kt-card');
        return c ? Math.round(c.getBoundingClientRect().height) : 0;
    });
    check('Handkarten sind groß (>=220px auf 1500px-Viewport)', handCardH >= 220, handCardH + 'px');

    // ---------- Einen Tausch durchspielen ----------
    console.log('\n--- Tausch per Antippen ---');
    await active.evaluate(() => {
        document.querySelector('#kt-hand-cards .kt-card').click();
    });
    await sleep(200);
    await active.evaluate(() => {
        document.querySelector('#kt-middle-cards .kt-card').click();
    });
    await sleep(200);
    check('Kein Bestätigen-Schritt mehr',
        !(await active.evaluate(() =>
            Array.from(document.querySelectorAll('.kt-btn')).some(b => /bestätigen/i.test(b.textContent)))));
    await sleep(900);
    const afterSwap = pubNow();
    check('turnsPlayed hochgezählt', afterSwap.turnsPlayed === 1, String(afterSwap.turnsPlayed));
    check('Zug ist beim anderen Spieler', afterSwap.currentTurnSeat !== turnSeat);

    console.log('\n--- Klopfen ab der zweiten Runde ---');
    const active2 = await (async () => {
        const s1 = await phone1.evaluate(() => document.getElementById('kt-status-main').textContent);
        return s1.includes('dran!') ? phone1 : phone2;
    })();
    // Zweiter Spieler zieht ebenfalls -> danach war jeder einmal dran
    await active2.evaluate(() => {
        document.querySelector('#kt-hand-cards .kt-card').click();
    });
    await sleep(150);
    await active2.evaluate(() => {
        document.querySelector('#kt-middle-cards .kt-card').click();
    });
    await sleep(150);
    await sleep(900);

    const active3 = await (async () => {
        const s1 = await phone1.evaluate(() => document.getElementById('kt-status-main').textContent);
        return s1.includes('dran!') ? phone1 : phone2;
    })();
    const labels3 = await active3.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-btn')).map(b => b.textContent));
    check('Ab der zweiten Runde erscheint "Klopfen"', labels3.some(l => l === 'KLOPFEN'),
        JSON.stringify(labels3));

    console.log('\n--- Klopfen deckt sofort auf ---');
    await active3.evaluate(() => {
        Array.from(document.querySelectorAll('.kt-btn')).find(b => b.textContent === 'KLOPFEN').click();
    });
    await sleep(1000);
    const afterKnock = pubNow();
    const knocker = afterKnock.knockedBySeat;
    check('Phase ist knocked', afterKnock.phase === 'knocked', afterKnock.phase);
    check('Klopfer liegt sofort offen',
        !!(afterKnock.revealedHands && afterKnock.revealedHands[knocker]),
        JSON.stringify(afterKnock.revealedHands || null));

    const facesUp = await tv.evaluate(() =>
        Array.from(document.querySelectorAll('.kt-fan-card img'))
            .filter(i => !/back_(lightblue|red)\.webp/.test(i.getAttribute('src'))).length);
    check('TV zeigt die offenen Karten des Klopfers', facesUp === 3, String(facesUp));

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
    const last = await (async () => {
        const s1 = await phone1.evaluate(() => document.getElementById('kt-status-main').textContent);
        return s1.includes('dran!') ? phone1 : phone2;
    })();
    await last.evaluate(() => {
        document.querySelector('#kt-hand-cards .kt-card').click();
    });
    await sleep(150);
    await last.evaluate(() => {
        document.querySelector('#kt-middle-cards .kt-card').click();
    });
    await sleep(150);
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
    const tv2 = await open(`http://localhost:${PORT}/index.html`, 'tv-uid');
    await sleep(2500);
    const sessionId2 = Object.keys(tree.games || {}).filter(k => k !== sessionId)[0] || sessionId;
    const pubNow2 = () => (tree.games[sessionId2] || {}).public || {};
    check('Zweite Session vorhanden', !!sessionId2, String(sessionId2));

    const phone3 = await open(`http://localhost:${PORT}/hosn-obe.html?session=${sessionId2}`, 'phone-1');
    await sleep(1200);

    await phone3.evaluate(() => {
        Array.from(document.querySelectorAll('.kt-btn')).find(b => /Computer/.test(b.textContent)).click();
    });
    await sleep(2000);

    const started = pubNow2();
    check('Computer-Runde markiert', started.botGame === true, JSON.stringify(started.botGame));
    check('Sechs Plätze vom Computer besetzt',
        Object.keys(started.seats || {}).length === 6, JSON.stringify(Object.keys(started.seats || {})));
    check('Alle Plätze sind Computer',
        Object.values(started.seats || {}).every(s => s && s.bot === true),
        JSON.stringify(started.seats));

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
    check('Es wurde geklopft', sawKnock);
    check('Aufdecken erfolgt schrittweise, nicht auf einen Schlag',
        sawProgressiveReveal, 'max. gleichzeitig offen während knocked: ' + maxRevealDuringPlay);

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
    for (const [name, p] of [['TV', tv], ['Handy 1', phone1], ['Handy 2', phone2], ['TV (Computer)', tv2], ['Handy (Computer)', phone3]]) {
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
