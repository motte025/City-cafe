/* Kleine, gemeinsame Tonspur fuer TV und Handy. Browser ohne freigegebenes
 * Autoplay bleiben still, bis ein Gast die Seite beruehrt. */
(function (global) {
    'use strict';

    var files = {
        card: 'audio/hosn-card-swap.mpeg',
        swap: 'audio/hosn-card-click.mpeg',
        deal: 'roulette/audio/evian-hit-1.ogg',
        knock: 'roulette/audio/evian-hit-2.ogg',
        finish: 'roulette/audio/evian-hit-3.ogg',
        dealer: 'roulette/audio/evian-roll.ogg'
    };
    var enabled = true;
    var unlocked = false;
    var ambience = null;
    var active = false;

    function tryPlay(audio) {
        try {
            var result = audio.play();
            if (result && result.catch) result.catch(function () { /* Autoplay-Sperre */ });
        } catch (e) { /* aeltere Kiosk-Browser ohne freigegebenes Audio */ }
    }

    function setEnabled(value) {
        enabled = value !== false;
        if (!enabled && ambience) ambience.pause();
        else if (active) startAmbience();
    }

    function play(kind) {
        if (!enabled || !files[kind]) return;
        var audio = new Audio(files[kind]);
        audio.volume = kind === 'dealer' ? 0.12 : kind === 'swap' ? 0.32 : 0.23;
        tryPlay(audio);
    }

    function startAmbience() {
        if (!enabled || !active) return;
        if (!ambience) {
            ambience = new Audio('audio/hosn-table-ambience.mpeg');
            ambience.loop = true;
            ambience.volume = 0.12;
            // Die bestehende Casino-Atmosphaere bleibt als Ersatz verfuegbar.
            ambience.addEventListener('error', function () {
                ambience.src = 'roulette/audio/casino-background.ogg';
                if (active && enabled) tryPlay(ambience);
            }, { once: true });
        }
        tryPlay(ambience);
    }

    function setActive(value) {
        active = !!value;
        if (active) startAmbience();
        else if (ambience) ambience.pause();
    }

    function cue(move, phase) {
        if (move) {
            // Eine Karte legt sich nach 1,5 s auf die Mitte; 0,2 s danach
            // hebt die Zielkarte ab. Beim Dreiertausch starten sie versetzt.
            if (move.type === 'single' || move.type === 'all') {
                var count = move.type === 'all' ? 3 : 1;
                for (var i = 0; i < count; i++) {
                    (function (offset) {
                        setTimeout(function () { play('swap'); }, offset);
                        setTimeout(function () { play('swap'); }, offset + 1700);
                        setTimeout(function () { play('swap'); }, offset + 3200);
                    })(i * 260);
                }
            } else if (move.type === 'dealerReplace') {
                play('dealer');
                for (var j = 0; j < 3; j++) {
                    (function (offset) {
                        setTimeout(function () { play('swap'); }, offset);
                        setTimeout(function () { play('swap'); }, offset + 1700);
                        setTimeout(function () { play('swap'); }, offset + 3200);
                    })(j * 260);
                }
            } else if (move.type === 'dealerKeep') {
                for (var k = 0; k < 3; k++)
                    setTimeout(function () { play('card'); }, k * 260);
            } else if (move.type === 'pass') play('card');
            if (move.knock) setTimeout(function () { play('knock'); }, 500);
            if (move.fire || move.type === 'fire' || move.type === 'tablefire') play('finish');
        }
        if (phase === 'starter') play('deal');
        if (phase === 'reveal' || phase === 'result') play('finish');
    }

    function unlock() {
        if (unlocked) return;
        unlocked = true;
        if (active) startAmbience();
    }
    global.document.addEventListener('pointerdown', unlock, { once: true });
    global.document.addEventListener('keydown', unlock, { once: true });

    global.HosnObeSound = {
        setEnabled: setEnabled,
        setActive: setActive,
        cue: cue,
        play: play
    };
})(window);
