/*
 * Browsertest fuer die Faelle, die beim zufaelligen Spielen selten vorkommen.
 * Aufruf:  node tischrunde/test/scenarios.browser.test.js
 *
 * Geprueft wird am fertigen Spieltisch, nicht nur am Regelwerk: Feuer, der
 * Drilling (der ausdruecklich kein Feuer ist), volle und zu kleine Tische.
 *
 * Die Haende werden dafuer nach dem Austeilen gezielt gesetzt — anders liesse
 * sich ein Feuer nicht verlaesslich herbeifuehren.
 */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var { chromium } = require('playwright');

var ROOT = path.join(__dirname, '..');
var PORT = 8732;
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

async function openTable(page) {
    await page.goto('http://localhost:' + PORT + '/demo.html');
    await page.click('.game:not([disabled])');
    await page.waitForSelector('#tr-hosnobe #tr-name');
}

async function seat(context, name, code) {
    var page = await context.newPage();
    await openTable(page);
    await page.fill('#tr-name', name);
    if (code) {
        await page.fill('#tr-code', code);
        await page.click('[data-do="join"]');
        await page.waitForSelector('[data-do="leave"]');
        return page;
    }
    await page.click('[data-do="create"]');
    await page.waitForSelector('[data-do="start"]');
    return page;
}

function codeOf(page) { return page.textContent('.tr-codechip').then(function (t) { return t.trim(); }); }

// Eine Hand gezielt setzen. Laeuft ueber dieselbe Schnittstelle, die auch der
// Geber benutzt — der Spieltisch merkt keinen Unterschied.
function setHand(page, code, uid, hand) {
    return page.evaluate(function (args) {
        var db = window.firebase.database();
        return db.ref('rooms/' + args.code + '/public/round').once('value').then(function (snap) {
            return db.ref('rooms/' + args.code + '/private/' + args.uid)
                .set({ hand: args.hand, round: snap.val() });
        });
    }, { code: code, uid: uid, hand: hand });
}

/*
 * Warten, bis ein Handy die gesetzte Hand wirklich anzeigt.
 *
 * Noetig, weil eine Hand hier von aussen gesetzt wird — im echten Spiel
 * beschreibt jedes Geraet nur die eigene. Ohne das Warten koennte ein Handy
 * beim Aufdecken noch seine urspruenglich ausgeteilte Hand melden, und der
 * Test pruefte dann etwas anderes als gemeint. Deshalb kommt die Hand mit dem
 * Feuer immer zuletzt: sie beendet die Runde sofort.
 */
function waitScore(page, points) {
    return page.waitForFunction(function (erwartet) {
        var s = document.querySelector('.tr-zone--mine .tr-score');
        return !!s && s.textContent.trim().indexOf(String(erwartet)) === 0;
    }, points, { timeout: 6000 });
}

function uidOf(page) { return page.evaluate(function () { return window.HosnObeNet.uid(); }); }

(async function () {
    var server = await serve();
    var browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    });

    try {
        /* --- Feuer --------------------------------------------------------- */

        section('Feuer beendet die Runde sofort');
        var ctxA = await browser.newContext();

        var anna = await seat(ctxA, 'Anna');
        var code = await codeOf(anna);
        var bert = await seat(ctxA, 'Bert', code);
        var cleo = await seat(ctxA, 'Cleo', code);

        await anna.click('[data-do="start"]');
        await anna.waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)');

        var uidA = await uidOf(anna), uidB = await uidOf(bert), uidC = await uidOf(cleo);

        // Erst die Mitspieler, dann das Feuer — es beendet die Runde sofort.
        await setHand(anna, code, uidB, ['S7', 'D8', 'C9']);      //  9 -> unter 12
        await waitScore(bert, 9);
        await setHand(anna, code, uidC, ['SK', 'SQ', 'H7']);      // 20 -> sicher
        await waitScore(cleo, 20);

        // Anna bekommt Herz Ass/Koenig/Dame — drei gleiche Farbe, genau 31.
        await setHand(anna, code, uidA, ['HA', 'HK', 'HQ']);

        await anna.waitForSelector('.tr-banner--fire', { timeout: 6000 });
        ok(true, 'die Runde endet ohne weiteren Zug');

        var kopf = (await anna.textContent('.tr-banner h2')).trim();
        equal(kopf, 'Feuer', 'die Kopfzeile meldet Feuer');

        await bert.waitForSelector('.tr-banner--fire', { timeout: 6000 });
        await cleo.waitForSelector('.tr-banner--fire', { timeout: 6000 });
        ok(true, 'alle Handys melden das Feuer');

        var ergebnis = await anna.$$eval('.tr-reveal', function (nodes) {
            return nodes.map(function (n) {
                return {
                    name: n.querySelector('.tr-reveal__name').textContent.trim(),
                    tag: n.querySelector('.tr-reveal__tag').textContent.trim(),
                    loser: n.classList.contains('is-loser')
                };
            });
        });

        var byName = {};
        ergebnis.forEach(function (r) { byName[r.name.replace(' (du)', '')] = r; });

        ok(/Feuer/.test(byName['Anna'].tag), 'Annas Hand ist als Feuer ausgewiesen — ' + byName['Anna'].tag);
        ok(!byName['Anna'].loser, 'wer Feuer hat, verliert nicht');
        ok(byName['Bert'].loser, 'Bert verliert mit neun Punkten');
        ok(!byName['Cleo'].loser, 'Cleo ist mit zwanzig Punkten sicher');
        equal(ergebnis.filter(function (r) { return r.loser; }).length, 1,
            'bei diesem Feuer gibt es genau einen Verlierer');

        var text = await anna.textContent('.tr-banner p');
        ok(/zwölf/.test(text), 'der Text nennt die Zwölf-Punkte-Grenze');

        await ctxA.close();

        /* --- Feuer ohne Verlierer -------------------------------------------- */

        section('Feuer, bei dem niemand verliert');
        var ctxB = await browser.newContext();

        var d1 = await seat(ctxB, 'Dora');
        var code2 = await codeOf(d1);
        var d2 = await seat(ctxB, 'Emil', code2);
        await d1.click('[data-do="start"]');
        await d1.waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)');

        await setHand(d1, code2, await uidOf(d2), ['SK', 'SQ', 'H7']);   // 20 -> sicher
        await waitScore(d2, 20);
        await setHand(d1, code2, await uidOf(d1), ['DA', 'DK', 'DJ']);   // Feuer

        await d1.waitForSelector('.tr-banner--fire', { timeout: 6000 });
        var keiner = await d1.$$eval('.tr-reveal.is-loser', function (n) { return n.length; });
        equal(keiner, 0, 'liegt niemand unter zwölf, verliert auch niemand');
        var textB = await d1.textContent('.tr-banner p');
        ok(/alle davon|niemand/.test(textB), 'der Text sagt, dass alle davonkommen');

        await ctxB.close();

        /* --- Drilling ---------------------------------------------------------- */

        section('Drilling zählt 31, ist aber kein Feuer');
        var ctxC = await browser.newContext();

        var fritz = await seat(ctxC, 'Fritz');
        var code3 = await codeOf(fritz);
        var gerda = await seat(ctxC, 'Gerda', code3);
        await fritz.click('[data-do="start"]');
        await fritz.waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)');

        // Drei Asse: 31 Punkte, aber drei verschiedene Farben.
        await setHand(fritz, code3, await uidOf(gerda), ['S7', 'D8', 'C9']);
        await waitScore(gerda, 9);
        await setHand(fritz, code3, await uidOf(fritz), ['HA', 'SA', 'DA']);

        await fritz.waitForFunction(function () {
            var s = document.querySelector('.tr-zone--mine .tr-score');
            return s && /31/.test(s.textContent);
        }, null, { timeout: 6000 });

        var punkte = (await fritz.textContent('.tr-zone--mine .tr-score')).trim();
        ok(/31/.test(punkte), 'drei Asse zählen 31 — angezeigt: ' + punkte);
        ok(/Drilling/.test(punkte), 'die Anzeige nennt es Drilling, nicht Feuer');

        await fritz.waitForTimeout(1200);
        var beendet = await fritz.$('.tr-banner--fire');
        ok(!beendet, 'der Drilling beendet die Runde nicht');
        var laeuft = await fritz.$('.tr-zone--mine');
        ok(!!laeuft, 'es wird ganz normal weitergespielt');

        await ctxC.close();

        /* --- Tischgroesse -------------------------------------------------------- */

        section('Zwei bis sechs Plätze');
        var ctxD = await browser.newContext();

        var host = await seat(ctxD, 'Spieler1');
        var code4 = await codeOf(host);

        var allein = await host.$eval('[data-do="start"]', function (b) { return b.disabled; });
        ok(allein, 'allein am Tisch lässt sich nicht starten');

        for (var i = 2; i <= 6; i++) await seat(ctxD, 'Spieler' + i, code4);
        await host.waitForFunction(function () {
            return document.querySelectorAll('#tr-hosnobe .tr-seat').length === 6;
        }, null, { timeout: 6000 });
        equal((await host.$$('#tr-hosnobe .tr-seat')).length, 6, 'sechs Plätze sind besetzt');

        var zuVielt = await ctxD.newPage();
        await openTable(zuVielt);
        await zuVielt.fill('#tr-name', 'Spieler7');
        await zuVielt.fill('#tr-code', code4);
        await zuVielt.click('[data-do="join"]');
        await zuVielt.waitForSelector('.tr-alert', { timeout: 6000 });
        var voll = (await zuVielt.textContent('.tr-alert')).trim();
        ok(/voll/.test(voll), 'der siebte wird abgewiesen — "' + voll + '"');

        await host.click('[data-do="start"]');
        await host.waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)', { timeout: 8000 });
        equal((await host.$$('#tr-hosnobe .tr-seat')).length, 6, 'zu sechst wird ausgeteilt');
        equal((await host.$$('.tr-zone:not(.tr-zone--mine) .tr-card')).length, 3,
            'auch zu sechst liegen drei Karten in der Mitte');

        await ctxD.close();

        /* --- Letzter Zug nach dem Klopfen ------------------------------------------ */

        section('Der letzte Zug wird richtig aufgedeckt');
        var ctxF = await browser.newContext();

        // Beim letzten Zug nach dem Klopfen stehen Tausch und Aufdecken im
        // selben Schreibvorgang. Aufgedeckt gehoert die Hand NACH dem Tausch.
        var ida = await seat(ctxF, 'Ida');
        var code5 = await codeOf(ida);
        var jonas = await seat(ctxF, 'Jonas', code5);

        await ida.click('[data-do="start"]');
        await ida.waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)');
        await jonas.waitForSelector('.tr-zone--mine .tr-card:not(.tr-card--back)');

        async function amZug(pages) {
            for (var k = 0; k < pages.length; k++) {
                if (await pages[k].$$eval('.tr-status.is-mine', function (n) { return n.length > 0; })) return pages[k];
            }
            return null;
        }

        function karten(page, zone) {
            return page.$$eval('.tr-zone' + (zone === 'hand' ? '--mine' : ':not(.tr-zone--mine)') + ' .tr-card__corner',
                function (nodes) {
                    return Array.prototype.map.call(nodes, function (n) { return n.textContent.trim(); })
                        .filter(function (_, i) { return i % 2 === 0; });   // nur die obere Ecke
                });
        }

        var klopfer = await amZug([ida, jonas]);
        await klopfer.click('[data-do="knock"]');
        await klopfer.waitForSelector('.tr-status.is-alarm');

        var letzter = await amZug([ida, jonas]);
        ok(letzter && letzter !== klopfer, 'nach dem Klopfen ist der andere am Zug');

        // Diese Mitte nimmt er gleich komplett auf die Hand.
        var mitteVorTausch = await karten(letzter, 'middle');
        await letzter.click('[data-do="swapAll"]');

        await letzter.waitForSelector('.tr-reveal', { timeout: 8000 });
        ok(true, 'der letzte Zug beendet die Runde');

        var eigene = await letzter.$$eval('.tr-reveal', function (nodes) {
            var meins = nodes.filter(function (n) {
                return /\(du\)/.test(n.querySelector('.tr-reveal__name').textContent);
            })[0];
            if (!meins) return null;
            return Array.prototype.map.call(meins.querySelectorAll('.tr-card__corner'), function (n) {
                return n.textContent.trim();
            }).filter(function (_, i) { return i % 2 === 0; });
        });

        ok(!!eigene, 'die eigene Hand steht beim Aufdecken dabei');
        equal((eigene || []).join(' '), mitteVorTausch.join(' '),
            'aufgedeckt wird die Hand NACH dem Tausch, nicht die davor');

        // Dasselbe muss auf dem anderen Handy stehen.
        var beimAnderen = await klopfer.$$eval('.tr-reveal', function (nodes) {
            var fremd = nodes.filter(function (n) {
                return !/\(du\)/.test(n.querySelector('.tr-reveal__name').textContent);
            })[0];
            return fremd ? Array.prototype.map.call(fremd.querySelectorAll('.tr-card__corner'), function (n) {
                return n.textContent.trim();
            }).filter(function (_, i) { return i % 2 === 0; }) : null;
        });
        equal((beimAnderen || []).join(' '), mitteVorTausch.join(' '),
            'auch der Mitspieler sieht die richtige Hand');

        await ctxF.close();

        /* --- Falscher Code ------------------------------------------------------- */

        section('Falscher Einladungscode');
        var ctxE = await browser.newContext();
        var irrt = await ctxE.newPage();
        await openTable(irrt);
        await irrt.fill('#tr-name', 'Hans');
        await irrt.fill('#tr-code', '0000');
        await irrt.click('[data-do="join"]');
        await irrt.waitForSelector('.tr-alert', { timeout: 6000 });
        var meldung = (await irrt.textContent('.tr-alert')).trim();
        ok(/keinen Tisch/.test(meldung), 'unbekannter Code wird erklärt — "' + meldung + '"');
        ok(!!(await irrt.$('[data-do="create"]')), 'die Tischwahl bleibt bedienbar');
        await ctxE.close();

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
