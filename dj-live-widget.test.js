/* Contract checks for the silent, followed-Twitch-DJ widget. */
'use strict';
const fs = require('fs');
const assert = require('assert');

const dashboard = fs.readFileSync('index.html', 'utf8');
const checker = fs.readFileSync('google-apps-script/dj-live-checker.gs', 'utf8');
const remote = fs.readFileSync('dj-fernbedienung.html', 'utf8');

assert.match(dashboard, /sekundenProKanal:\s*180/);
assert.match(dashboard, /leerWarteSekunden:\s*180/);
// Seit September 2026 mit Ton (wie im Kiosk ueber mpv) - Wunsch des Betriebs.
assert.match(dashboard, /tonLautstaerke:\s*1/);
assert.match(dashboard, /const DJ_SLOT_AN = slotSchalter\(true, 'djan'\)/);
assert.match(dashboard, /Math\.floor\(Math\.random\(\) \* pool\.length\)/);
assert.match(dashboard, /return \[djZufallsEintrag\]/);
assert.match(dashboard, /djFernQrZeigen\(\)/);
assert.match(dashboard, /api\.qrserver\.com\/v1\/create-qr-code/);
assert.match(dashboard, /raum=' \+ encodeURIComponent\(raum\)/);
assert.match(dashboard, /Gefolgte Twitch-DJs werden geprüft/);
assert.match(dashboard, /let sequenceGeneration = 0/);
assert.match(dashboard, /generation !== sequenceGeneration \|\| mediaStateIndex !== DJ_SLOT_INDEX/);

assert.match(checker, /helix\/streams\/followed\?user_id=/);
// Seit #98 eine Liste: Music und DJs.
assert.match(checker, /const DJ_TWITCH_KATEGORIEN = \[\s*'26936',[^\]]*'1669431183'/);
assert.match(checker, /TWITCH_USER_REFRESH_TOKEN/);
assert.match(checker, /djTwitchUserIdErmitteln_/);
assert.match(checker, /props\.setProperty\('TWITCH_USER_ID'/);
assert.match(checker, /user:read:follows/);

// Seit b1248194 schaltet die Fernbedienung den Twitch-Ton am Screen.
assert.match(remote, /id="ton-an"[^>]*>🔊 Ton an</);
assert.match(remote, /id="ton-aus"[^>]*>🔇 Ton aus</);
assert.match(remote, /new URLSearchParams\(location\.search\)\.get\('raum'\)/);
assert.match(remote, /\^\[A-Za-z0-9_-\]\{1,64\}\$/);
console.log('DJ-Live-Vertrag: 22 Prüfungen bestanden.');
