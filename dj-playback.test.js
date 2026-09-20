'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function fn(name) {
    const start = html.indexOf('        function ' + name + '(');
    const end = html.indexOf('\n        }', start) + 10;
    assert(start >= 0 && end > start);
    return html.slice(start, end);
}
async function run() {
    let player, button, starts = 0, offlineBadge = false, sequenceRuns = 0, rueckfall = null;
    class Player {
        constructor(id, options) { this.handlers = {}; this.paused = true; this.channel = options.channel; player = this; assert.equal(options.muted, true); assert.equal(options.autoplay, true); }
        addEventListener(event, handler) { (this.handlers[event] ||= []).push(handler); }
        emit(event) { for (const cb of this.handlers[event] || []) cb(); }
        play() { starts++; this.emit(Player.PLAYBACK_BLOCKED); }
        setMuted(value) { assert.equal(value, true); }
        isPaused() { return this.paused; }
        getChannel() { return this.channel; }
        getCurrentTime() { throw Error('Live playback must not use the VOD clock'); }
    }
    for (const event of ['READY', 'PLAYING', 'PAUSE', 'OFFLINE', 'ENDED', 'PLAYBACK_BLOCKED']) Player[event] = event;
    const context = vm.createContext({
        Twitch: { Player }, djRahmenZaehler: 0, djTwitchSpieler: null,
        djQualiLage: { sichtbarSekunden: 10, haengtSekunden: 0, totSekunden: 0 },
        DJ_LIVE_CONFIG: { waechterTaktSekunden: 1, knopfNachSekunden: 1, tonLautstaerke: 0, neustartNachSekunden: 20 },
        djTwitchSdkLaden: async () => true, djFreigabeNachruesten() {}, djEmbedHosts: () => ['localhost'],
        djSofortStarten: () => player.play(), djKnopfBeschriften() {}, djTonKnopf: value => { button = value; },
        djAnstupsen() {}, djSlotSichtbar: () => true, djMobilgeraet: () => false, djNeuaufbauErlaubt: () => false,
        djTonNachziehen() {}, djKnopfStur: false, djFern: null,
        djLiveBadgeSetzen: value => { offlineBadge = value; },
        djFernQualitaetAnwenden() {}, djFernStatusMelden() {},
        mediaStateIndex: 1, DJ_SLOT_INDEX: 1, cancelSequenceTimers() {},
        runMasterSequence: () => { sequenceRuns++; },
        djExternEintrag: null, djExtern: () => false, djAktiverIndex: 0,
        djSpielerAufbauen: entry => { rueckfall = entry; }, videoRuheModus() {}
    });
    // djFernAktiv und djStreamFertig bewusst im Original: das Ende eines
    // ferngesteuerten Streams soll genau so getestet werden, wie es am Screen
    // laeuft (sofort zurueck in die Rotation).
    vm.runInContext(fn('djFernAktiv') + '\n' + fn('djStreamFertig') + '\n'
        + fn('djBaueTwitch') + '\n' + fn('djWaechterTakt'), context);
    context.djBaueTwitch({ isConnected: true }, { channel: 'example' });
    await Promise.resolve();
    player.emit(Player.READY);
    assert.equal(starts, 2, 'Blocked playback retries once without an event loop');
    player.paused = false;
    player.emit(Player.PLAYING);
    for (let i = 0; i < 100; i++) context.djWaechterTakt();
    assert.equal(button, false, 'Live video with no VOD clock hides the prompt');
    assert.equal(context.djQualiLage.haengtSekunden, 0);
    player.paused = true;
    player.emit(Player.PAUSE);
    context.djWaechterTakt();
    assert.equal(button, true, 'A paused stream offers a restart');
    player.paused = false;
    player.emit(Player.PLAYING);
    player.emit(Player.OFFLINE);
    assert.equal(context.djQualiLage.bildGestartet, false);
    assert.equal(offlineBadge, true, 'Offline channel is no longer labelled LIVE');
    context.djFern = { kanal: 'example', bisWann: Date.now() + 15 * 60 * 1000 };
    player.emit(Player.OFFLINE);
    assert.equal(context.djFern, null, 'Offline ends a timed remote selection');
    assert.equal(sequenceRuns, 1, 'Offline remote channel returns to the normal sequence');
    player.channel = 'another-dj';
    context.djFern = { kanal: 'another-dj', bisWann: Date.now() + 15 * 60 * 1000 };
    context.mediaStateIndex = 1;    // wieder im DJ-Slot, wie nach einem neuen Wunsch
    player.emit(Player.OFFLINE);
    assert.equal(context.djFern, null, 'Offline follows a channel switch within the existing player');
    assert.equal(sequenceRuns, 2, 'Every ended remote stream hands back to the rotation at once');
    context.djTwitchSpieler = {};
    player.emit(Player.PLAYING);
    assert.equal(context.djQualiLage.bildGestartet, false, 'Old player events cannot mark a new player as running');

    // mpv (Kiosk-Supervisor) sollte spielen, meldet sich aber nicht mehr:
    // der Waechter baut den Twitch-Player fuer genau diesen Kanal.
    context.djExternEintrag = { platform: 'twitch', channel: 'mpv-dj' };
    context.djAktiverIndex = 2;
    context.djWaechterTakt();
    assert.equal(rueckfall && rueckfall.channel, 'mpv-dj', 'Without the supervisor the Twitch player comes back');
    assert.equal(context.djExternEintrag, null);
    assert.equal(context.djAktiverIndex, 2, 'The fallback keeps the selected entry');

    let sichtbar = false, gebaut = 0, extern = false;
    const buehne = { firstChild: null, innerHTML: '' };
    const visibilityContext = vm.createContext({
        DJ_SLOT_AN: true,
        DJ_LIVE_CONFIG: {},
        djGepuffert: [],
        djAktiverIndex: -1,
        djUsableEntries: () => [{ platform: 'twitch', channel: 'live-dj' }],
        djSchluessel: entry => entry.platform + ':' + entry.channel,
        djSlotSichtbar: () => sichtbar,
        djSpielerAufbauen: () => { gebaut++; },
        djSpielerAbbauen() {},
        djKanalWechseln: () => false,
        djAnstupsen() {},
        djLiveBadgeSetzen() {},
        djAnzeigeName: entry => entry.channel,
        djExternEintrag: null, djExtern: () => extern, djTonKnopf() {}, videoRuheModus() {},
        document: {
            getElementById: id => id === 'dj-live-player' ? buehne : {
                textContent: '', style: {}, classList: { toggle() {} }
            },
            querySelector: () => null
        }
    });
    vm.runInContext(fn('djVorpuffern') + '\n' + fn('djZeigeEintrag'), visibilityContext);
    visibilityContext.djVorpuffern();
    assert.equal(visibilityContext.djGepuffert.length, 1, 'Live list is prepared before the slot');
    assert.equal(gebaut, 0, 'Twitch player is not created while the slot is hidden');
    sichtbar = true;
    visibilityContext.djVorpuffern();
    assert.equal(gebaut, 1, 'Twitch player is created once the slot is visible');

    visibilityContext.djAktiverIndex = 0;
    visibilityContext.djZeigeEintrag(0);
    assert.equal(gebaut, 2, 'A missing player frame is rebuilt even when the index is unchanged');

    // Kiosk-Supervisor meldet sich: mpv zeigt den Kanal, kein Twitch-Player.
    extern = true;
    visibilityContext.djZeigeEintrag(0);
    assert.equal(gebaut, 2, 'With mpv taking over no Twitch player is built');
    assert.equal(visibilityContext.djExternEintrag.channel, 'live-dj');
    console.log('DJ playback regression tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
