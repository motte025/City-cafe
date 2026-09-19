'use strict';
// Kartenstapel-Auswahl der Nightlife-Videos (nlNaechsterEintrag): jedes Video
// einmal pro Runde, keine direkte Wiederholung, Pool-Wechsel mitten in der Runde.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function fn(name) {
    const start = html.indexOf('        function ' + name + '(');
    const end = html.indexOf('\n        }', start) + 10;
    assert(start >= 0 && end > start, name + ' nicht gefunden');
    return html.slice(start, end);
}

const tag = Array.from({ length: 18 }, (_, i) => ({ videoId: 'tag' + i }));
const nacht = Array.from({ length: 15 }, (_, i) => ({ videoId: 'nacht' + i }));
let pool = tag.concat(nacht);
let gespeichert = 0;
const ctx = vm.createContext({
    nlStapel: [], nlZuletzt: '', nlDauern: {}, NL_CONFIG: { sekundenProVideo: 240 },
    nlBrauchbareVideos: () => pool,
    nlSchluessel: v => v.videoId,
    nlIstDatei: () => false,
    nlStandSpeichern: () => { gespeichert++; },
    Math, Map
});
vm.runInContext(fn('shuffleArray') + '\n' + fn('nlStartSekunde') + '\n' + fn('nlNaechsterEintrag'), ctx);

// Zwei volle Runden: jedes Video genau zweimal, nie zweimal hintereinander.
for (let versuch = 0; versuch < 200; versuch++) {
    ctx.nlStapel = []; ctx.nlZuletzt = '';
    const gezogen = [];
    for (let i = 0; i < 66; i++) gezogen.push(ctx.nlNaechsterEintrag().schluessel);
    const zaehler = {};
    gezogen.forEach(s => { zaehler[s] = (zaehler[s] || 0) + 1; });
    assert.equal(Object.keys(zaehler).length, 33, 'alle Videos kommen dran');
    assert(Object.values(zaehler).every(n => n === 2), 'jedes Video genau einmal pro Runde');
    for (let i = 1; i < gezogen.length; i++) {
        assert.notEqual(gezogen[i], gezogen[i - 1], 'keine direkte Wiederholung, auch nicht ueber die Rundengrenze');
    }
}
assert(gespeichert > 0, 'der Stapel wird gespeichert');

// 18 Uhr mitten in der Runde: Tag-Videos fallen aus dem laufenden Stapel.
ctx.nlStapel = []; ctx.nlZuletzt = '';
for (let i = 0; i < 10; i++) ctx.nlNaechsterEintrag();
pool = nacht;
const danach = [];
for (let i = 0; i < 15; i++) danach.push(ctx.nlNaechsterEintrag().schluessel);
assert(danach.every(s => s.startsWith('nacht')), 'nach dem Wechsel nur noch Nacht-Videos');

console.log('Nightlife-Kartenstapel: Tests bestanden.');
