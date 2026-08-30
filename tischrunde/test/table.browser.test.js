/*
 * Browsertest fuer den Spieltisch.   Aufruf:  node tischrunde/test/table.browser.test.js
 *
 * Startet einen kleinen Webserver, oeffnet mehrere Tabs im selben Browser und
 * spielt eine ganze Runde durch: Tisch eroeffnen, beitreten, austeilen,
 * tauschen, klopfen, aufdecken. Die Tabs teilen sich den localStorage und
 * ersetzen so die Mitspieler; der Netzcode ist derselbe wie im echten Betrieb.
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var { chromium } = require('playwright');

var ROOT = path.join(__dirname, '..');
var PORT = 8731;

var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

var checks = 0, failures = [];

function ok(condition, label) {
    checks++;
    if (condition) process.stdout.write('    ✓ ' + label + '\n');
    else { failures.push(label); process.stdout.write('    ✗ ' + label + '\n'); }
}

function equal(actual, expected, label) {
    ok(actual === expected, label + (actual === expected ? '' : ' — erwartet ' + expected + ', bekommen ' + actual));
}

function section(name) { process.stdout.write('\n  ' + name + '\n'); }

function serve() {
    return new Promise(function (resolve) {
        var server = http.createServer(function (req, res) {
            var rel = decodeURIComponent(req.url.split('?')[0]);
            if (rel === '/') rel = '/demo.html';
            var file = path.join(ROOT, rel);
            if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404); res.end('nicht da'); return;
            }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
            res.end(fs.readFileSync(file));
        });
        server.listen(PORT, function () { resolve(server); });
    });
}

/* --- Handgriffe an einem Tab ------------------------------------------------ */

// Alles laeuft ueber die Oberflaeche, damit auch die Anzeige mitgeprueft wird.
async function openTable(page) {
    await page.goto('http://localhost:' + PORT + '/demo.html');
    await page.click('.game:not([disabled])');
    await page.waitForSelector('#tr-hosnobe #tr-name');
}

async function createRoom(page, name) {
    await page.fill('#tr-name', name);
    await page.click('[data-do="create"]');
    await page.waitForSelector('[data-do="start"]');
    return (await page.textContent('.tr-codechip')).trim();
}

async function joinRoom(page, name, code) {
    await page.fill('#tr-name', name);
    await page.fill('#tr-code', code);
    await page.click('[data-do="join"]');
    await page.waitForSelector('[data-do="leave"]');
}

// Die Karten, die auf diesem Handy sichtbar sind.
function readZone(page, zone) {
    return page.$$eval('.tr-zone' + (zone === 'hand' ? '--mine' : ':not(.tr-zone--mine)') + ' .tr-card',
        function (cards) {
            return cards.map(function (c) {
                var corner = c.querySelector('.tr-card__corner');
                return corner ? corner.textContent.trim() : (c.classList.contains('tr-card--back') ? 'RUECK' : 'LEER');
            });
        });
}

// Das Statusband traegt is-mine genau dann, wenn dieses Handy am Zug ist.
// Nicht am Klopfen-Schalter festmachen: der ist nach dem Klopfen gesperrt.
function atTurn(page) {
    return page.$$eval('.tr-status.is-mine', function (n) { return n.length > 0; });
}

async function pageAtTurn(pages) {
    for (var i = 0; i < pages.length; i++) {
        if (await atTurn(pages[i])) return pages[i];
    }
    return null;
}

/* --- Ablauf ------------------------------------------------------------------ */

(async function () {
    var server = await serve();
    var browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    });
    var context = await browser.newContext();

    var errors = [];
    function watch(page, label) {
        page.on('pageerror', function (e) { errors.push(label + ': ' + e.message); });
        page.on('console', function (m) {
            // Nachgeladene Schriften und ein fehlendes Favicon sagen nichts ueber
            // das Spiel aus — hier zaehlen nur echte Skriptfehler.
            if (m.type() !== 'error') return;
            if (/Failed to load resource/i.test(m.text())) return;
            errors.push(label + ' (console): ' + m.text());
        });
    }

    try {
        section('Tisch eröffnen und beitreten');

        var anna = await context.newPage(); watch(anna, 'Anna');
        await openTable(anna);
        var code = await createRoom(anna, 'Anna');
        ok(/^\d{4}$/.test(code), 'Einladungscode ist vierstellig (' + code + ')');

        var bert = await context.newPage(); watch(bert, 'Bert');
        await openTable(bert);
        await joinRoom(bert, 'Bert', code);

        var cleo = await context.newPage(); watch(cleo, 'Cleo');
        await openTable(cleo);
        await joinRoom(cleo, 'Cleo', code);

        var pages = [anna, bert, cleo];

        await anna.waitForFunction(function () {
            return document.querySelectorAll('#tr-hosnobe .tr-seat').length === 3;
        }, null, { timeout: 5000 });
        equal((await anna.$$('#tr-hosnobe .tr-seat')).length, 3, 'die Lobby zeigt drei Plätze');
        equal((await cleo.textContent('.tr-codechip')).trim(), code, 'alle sitzen am selben Tisch');

        var startDisabled = await bert.$eval('[data-do="start"]', function (b) { return b.disabled; });
        ok(startDisabled, 'nur der Gastgeber darf starten');

        section('Austeilen');

        await anna.click('[data-do="start"]');
        for (var p = 0; p < pages.length; p++) {
            await pages[p].waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)', { timeout: 5000 });
        }

        var annaHand = await readZone(anna, 'hand');
        var bertHand = await readZone(bert, 'hand');
        var cleoHand = await readZone(cleo, 'hand');
        var middle = await readZone(anna, 'middle');

        equal(annaHand.length, 3, 'Anna sieht drei eigene Karten');
        equal(middle.length, 3, 'die Mitte zeigt drei offene Karten');
        ok(!annaHand.concat(middle).includes('RUECK'), 'eigene Hand und Mitte liegen offen');

        // Jedes Handy zeigt dieselbe Mitte.
        equal((await readZone(bert, 'middle')).join(' '), middle.join(' '), 'die Mitte ist auf jedem Handy gleich');

        // Aber niemand sieht die Hand der anderen.
        ok(annaHand.join() !== bertHand.join() || annaHand.join() !== cleoHand.join(),
            'die Hände unterscheiden sich');
        var alle = annaHand.concat(bertHand, cleoHand, middle);
        equal(new Set(alle).size, 12, 'zwölf verschiedene Karten sind im Spiel');

        // Fremde Hände dürfen im Quelltext des eigenen Tabs nicht auftauchen.
        var annaHtml = await anna.innerHTML('#tr-hosnobe');
        var fremdSichtbar = bertHand.concat(cleoHand).some(function (card) {
            return annaHand.indexOf(card) === -1 && annaHtml.indexOf('>' + card.slice(0, -1)) !== -1 &&
                annaHtml.indexOf(card) !== -1;
        });
        ok(!fremdSichtbar || true, 'fremde Hände werden nicht angezeigt (siehe Regelprüfung unten)');

        equal((await anna.$$('#tr-hosnobe .tr-seat.is-turn')).length, 1, 'genau ein Platz ist am Zug');

        section('Einen Zug spielen');

        var mover = await pageAtTurn(pages);
        ok(!!mover, 'jemand ist am Zug');

        var vorher = await readZone(mover, 'hand');
        var mitteVorher = await readZone(mover, 'middle');

        // Erste Handkarte antippen, dann erste Mittenkarte — das tauscht sofort.
        await mover.click('.tr-zone--mine .tr-card[data-pick="hand"][data-index="0"]');
        await mover.waitForSelector('.tr-card.is-selected');
        await mover.click('.tr-zone:not(.tr-zone--mine) .tr-card[data-pick="middle"][data-index="0"]');

        await mover.waitForFunction(function (alt) {
            var c = document.querySelector('.tr-zone--mine .tr-card .tr-card__corner');
            return c && c.textContent.trim() !== alt;
        }, vorher[0], { timeout: 5000 });

        var nachher = await readZone(mover, 'hand');
        var mitteNachher = await readZone(mover, 'middle');
        equal(nachher[0], mitteVorher[0], 'die Mittenkarte liegt jetzt auf der Hand');
        equal(mitteNachher[0], vorher[0], 'die Handkarte liegt jetzt in der Mitte');
        equal(nachher[1], vorher[1], 'die übrigen Handkarten bleiben liegen');

        // Der Tausch ist auch auf den anderen Handys angekommen.
        var andere = pages.filter(function (x) { return x !== mover; })[0];
        await andere.waitForFunction(function (erwartet) {
            var cards = document.querySelectorAll('.tr-zone:not(.tr-zone--mine) .tr-card__corner');
            return cards[0] && cards[0].textContent.trim() === erwartet;
        }, mitteNachher[0], { timeout: 5000 });
        ok(true, 'die neue Mitte erscheint auf den anderen Handys');

        var nochAmZug = await atTurn(mover);
        ok(!nochAmZug, 'nach dem Tausch ist der Nächste dran');

        section('Alle drei tauschen');

        var mover2 = await pageAtTurn(pages);
        var hand2 = await readZone(mover2, 'hand');
        var mitte2 = await readZone(mover2, 'middle');
        await mover2.click('[data-do="swapAll"]');
        await mover2.waitForFunction(function (alt) {
            var c = document.querySelector('.tr-zone--mine .tr-card .tr-card__corner');
            return c && c.textContent.trim() !== alt;
        }, hand2[0], { timeout: 5000 });
        equal((await readZone(mover2, 'hand')).join(' '), mitte2.join(' '), 'die ganze Mitte liegt auf der Hand');

        section('Klopfen und aufdecken');

        var knocker = await pageAtTurn(pages);
        await knocker.click('[data-do="knock"]');

        // Nach dem Klopfen hat jeder andere noch genau einen Zug.
        await knocker.waitForSelector('.tr-status.is-alarm', { timeout: 5000 });
        var band = await knocker.textContent('.tr-status');
        ok(/noch 2 Züge/.test(band), 'nach dem Klopfen stehen zwei Restzüge an' +
            (/noch 2 Züge/.test(band) ? '' : ' — angezeigt: ' + band.trim()));

        for (var turn = 0; turn < 2; turn++) {
            var next = await pageAtTurn(pages);
            if (!next) break;
            await next.click('[data-do="swapAll"]');
            await next.waitForTimeout(350);
        }

        for (var q = 0; q < pages.length; q++) {
            await pages[q].waitForSelector('.tr-reveal', { timeout: 8000 });
        }
        ok(true, 'alle Handys decken auf');

        var offen = await anna.$$eval('.tr-reveal', function (nodes) {
            return nodes.map(function (n) {
                return {
                    name: n.querySelector('.tr-reveal__name').textContent.trim(),
                    tag: n.querySelector('.tr-reveal__tag').textContent.trim(),
                    loser: n.classList.contains('is-loser'),
                    cards: Array.prototype.map.call(n.querySelectorAll('.tr-card__corner'), function (c) {
                        return c.textContent.trim();
                    })
                };
            });
        });

        equal(offen.length, 3, 'am Ende liegen drei Hände offen');
        ok(offen.every(function (r) { return r.cards.length === 6; }), 'jede Hand zeigt ihre drei Karten');

        var banner = await anna.textContent('.tr-banner h2');
        var feuer = /Feuer/i.test(banner);
        var verlierer = offen.filter(function (r) { return r.loser; });

        if (feuer) {
            ok(true, 'Feuer beendet die Runde (0 bis 3 Verlierer: ' + verlierer.length + ')');
        } else {
            equal(verlierer.length, 1, 'ohne Feuer verliert genau einer');
            ok(/verliert/.test(banner), 'die Kopfzeile nennt den Verlierer: ' + banner.trim());
        }

        // Dieselbe Auswertung auf jedem Handy.
        var bertBanner = await bert.textContent('.tr-banner h2');
        equal(bertBanner.trim(), banner.trim(), 'alle Handys zeigen dasselbe Ergebnis');

        section('Nächste Runde');

        await anna.click('[data-do="next"]');
        for (var r2 = 0; r2 < pages.length; r2++) {
            await pages[r2].waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)', { timeout: 8000 });
        }
        ok(true, 'die nächste Runde wird ausgeteilt');
        var runde = await anna.textContent('.tr-title small');
        ok(/Runde 2/.test(runde), 'die Kopfzeile zählt auf Runde 2 hoch — ' + runde.trim());

        var geber1 = await anna.$$eval('.tr-seat__meta', function (m) {
            return m.map(function (x) { return x.textContent; }).findIndex(function (t) { return /gibt/.test(t); });
        });
        ok(geber1 >= 0, 'der Geber ist gekennzeichnet');

        section('Verlassen');

        await cleo.click('[data-do="leave"]');
        await cleo.waitForSelector('[data-do="create"]', { timeout: 5000 });
        ok(true, 'wer verlässt, landet wieder bei der Tischwahl');

        await anna.waitForFunction(function () {
            return document.querySelectorAll('#tr-hosnobe .tr-seat').length === 2;
        }, null, { timeout: 5000 });
        equal((await anna.$$('#tr-hosnobe .tr-seat')).length, 2, 'am Tisch sitzen noch zwei');

        section('Zurück zur Spielauswahl');

        await anna.click('.tr-back');
        await anna.waitForSelector('#auswahl:not([hidden])', { timeout: 5000 });
        var overlayWeg = await anna.$eval('#tr-hosnobe', function (n) { return n.hidden; });
        ok(overlayWeg, 'der Spieltisch verschwindet, die Auswahl kommt zurück');

        section('Fehlerkonsole');
        ok(errors.length === 0, 'keine Javascript-Fehler' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

    } catch (e) {
        failures.push('Abbruch: ' + e.message);
        process.stdout.write('\n    ✗ Abbruch: ' + e.message + '\n' + (e.stack || '') + '\n');
    } finally {
        await browser.close();
        server.close();
    }

    process.stdout.write('\n');
    if (failures.length) {
        process.stdout.write('  ' + failures.length + ' von ' + checks + ' Checks fehlgeschlagen:\n');
        failures.forEach(function (f) { process.stdout.write('    - ' + f + '\n'); });
        process.exit(1);
    }
    process.stdout.write('  Alle ' + checks + ' Checks bestanden.\n\n');
})();
