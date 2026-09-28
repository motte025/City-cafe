const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const timers = [];
const played = [];
const context = {
    window: { document: { addEventListener() {} } },
    Audio: function (src) {
        this.play = () => { played.push(src); return Promise.resolve(); };
    },
    setTimeout: (fn, delay) => timers.push({ fn, delay })
};
vm.runInNewContext(fs.readFileSync(require.resolve('./hosn-obe-sound.js'), 'utf8'), context);
const sound = context.window.HosnObeSound;
for (const type of ['single', 'all', 'dealerReplace']) {
    timers.length = 0;
    played.length = 0;
    sound.cue({ type });
    const count = type === 'single' ? 1 : 3;
    assert.equal(timers.length, count * 3);
    assert.deepEqual(timers.slice(0, 3).map(t => t.delay), [0, 1700, 3200]);
    timers.forEach(t => t.fn());
    assert.equal(played.filter(src => src === 'audio/hosn-card-click.mpeg').length, count * 3);
}
timers.length = 0;
played.length = 0;
sound.cue({ type: 'all' });
sound.setEnabled(false);
timers.forEach(t => t.fn());
assert.equal(played.length, 0, 'Ton aus unterdrueckt auch ausstehende Tauschtöne');
console.log('Tauschtöne fuer Hinlegen, Nehmen und Zuruecklegen sowie Ton aus geprüft.');
