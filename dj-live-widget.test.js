/* Contract checks for the silent, followed-Twitch-DJ widget. */
'use strict';
const fs = require('fs');
const assert = require('assert');

const dashboard = fs.readFileSync('index.html', 'utf8');
const checker = fs.readFileSync('google-apps-script/dj-live-checker.gs', 'utf8');
const remote = fs.readFileSync('dj-fernbedienung.html', 'utf8');

assert.match(dashboard, /sekundenProKanal:\s*180/);
assert.match(dashboard, /leerWarteSekunden:\s*30/);
assert.match(dashboard, /tonLautstaerke:\s*0/);
assert.match(dashboard, /const DJ_SLOT_AN = slotSchalter\(true, 'djan'\)/);
assert.match(dashboard, /Math\.floor\(Math\.random\(\) \* pool\.length\)/);
assert.match(dashboard, /return \[djZufallsEintrag\]/);
assert.match(dashboard, /djFernQrZeigen\(\)/);
assert.match(dashboard, /api\.qrserver\.com\/v1\/create-qr-code/);
assert.match(dashboard, /raum=' \+ encodeURIComponent\(raum\)/);
assert.match(dashboard, /Gefolgte Twitch-DJs werden geprüft/);

assert.match(checker, /helix\/streams\/followed\?user_id=/);
assert.match(checker, /const DJ_TWITCH_MUSIC_GAME_ID = '26936'/);
assert.match(checker, /TWITCH_USER_REFRESH_TOKEN/);
assert.match(checker, /djTwitchUserIdErmitteln_/);
assert.match(checker, /props\.setProperty\('TWITCH_USER_ID'/);
assert.match(checker, /user:read:follows/);

assert.doesNotMatch(remote, /🔊 Ton an|🔇 stumm/);
console.log('DJ-Live-Vertrag: 17 Prüfungen bestanden.');
