'use strict';
// Funktionstest DJ Studio (Phase A) im echten Browser:
//   node dj-studio/tests/studio.browser.test.js
// Braucht Playwright. Browser: CHROMIUM_PATH=... oder PW_CHANNEL=msedge|chrome.
// DJ_SCREENSHOT=pfad.png speichert die 1920x1080-Ansicht.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 8791;
const warte = ms => new Promise(r => setTimeout(r, ms));

function wav(sek, freq) {   // kleine Testdatei: Sinus, 44,1 kHz, 16 bit stereo
  const rate = 44100, n = Math.round(sek * rate), daten = Buffer.alloc(44 + n * 4);
  daten.write('RIFF', 0); daten.writeUInt32LE(36 + n * 4, 4); daten.write('WAVEfmt ', 8);
  daten.writeUInt32LE(16, 16); daten.writeUInt16LE(1, 20); daten.writeUInt16LE(2, 22); daten.writeUInt32LE(rate, 24);
  daten.writeUInt32LE(rate * 4, 28); daten.writeUInt16LE(4, 32); daten.writeUInt16LE(16, 34); daten.write('data', 36); daten.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 12000); daten.writeInt16LE(v, 44 + i * 4); daten.writeInt16LE(v, 46 + i * 4); }
  return daten;
}

async function run() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await warte(600);
  const opts = { args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  if (process.env.PW_CHANNEL) opts.channel = process.env.PW_CHANNEL;
  const browser = await chromium.launch(opts);
  const ok = name => console.log('  ok  ' + name);
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/dj-studio/`);
    await page.waitForFunction(() => window.djStudio && djStudio.state.decks.A.track && djStudio.state.decks.B.track, null, { timeout: 60000 });
    const ev = (f, a) => page.evaluate(f, a);

    // --- Stille vor dem Start ---
    const still = await ev(() => { const e = djStudio.engine; return [e.decks.A.pegel().L.spitze, e.masterPegel().L.spitze]; });
    assert.deepEqual(still, [0, 0], 'Stille zeigt keinen Pegel');
    ok('Stille = kein Pegel');

    await page.click('#start-knopf');
    await page.waitForFunction(() => djStudio.engine.ctx.state === 'running');

    // --- Layout 1920x1080 ---
    const lay = await ev(() => {
      const r = id => document.getElementById(id).getBoundingClientRect();
      const boxen = ['kopf', 'deck-a', 'mitte', 'deck-b', 'leiste'].map(id => [id, r(id)]);
      const ueber = [];
      for (let i = 0; i < boxen.length; i++) for (let j = i + 1; j < boxen.length; j++) {
        const [a, A] = boxen[i], [b, B] = boxen[j];
        if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) ueber.push(a + '/' + b);
      }
      const raus = boxen.filter(([, x]) => x.left < 0 || x.top < 0 || x.right > 1920 || x.bottom > 1080).map(([id]) => id);
      // Spiegel-Pruefung: kein Element mit negativer Determinante (= gespiegelt)
      const gespiegelt = [...document.querySelectorAll('#buehne *')].filter(el => {
        const t = getComputedStyle(el).transform;
        if (!t || t === 'none') return false;
        const m = t.match(/matrix\(([^)]+)\)/); if (!m) return false;
        const [a, b, c, d] = m[1].split(',').map(Number);
        return a * d - b * c < 0;
      }).map(el => el.className);
      const x = sel => document.querySelector(sel).getBoundingClientRect().left;
      return { ueber, raus, gespiegelt,
        A: [x('#deck-a .bereich-meter'), x('#deck-a .bereich-fader'), x('#deck-a .bereich-knoepfe'), x('#deck-a .bereich-jog'), x('#deck-a .bereich-tempo')],
        B: [x('#deck-b .bereich-meter'), x('#deck-b .bereich-fader'), x('#deck-b .bereich-knoepfe'), x('#deck-b .bereich-jog'), x('#deck-b .bereich-tempo')],
        scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
    });
    assert.deepEqual(lay.ueber, [], 'keine Ueberschneidungen');
    assert.deepEqual(lay.raus, [], 'nichts ausserhalb 1920x1080');
    assert.deepEqual(lay.gespiegelt, [], 'kein gespiegeltes Element (kein scaleX(-1))');
    assert.ok(lay.scroll[0] <= 1920 && lay.scroll[1] <= 1080, 'kein Scrollen');
    assert.ok(lay.A.every((v, i) => i === 0 || v > lay.A[i - 1]), 'Kanal 1: Meter, Fader, Knoepfe, Jog, Tempo von aussen nach innen');
    assert.ok(lay.B.every((v, i) => i === 0 || v < lay.B[i - 1]), 'Kanal 2: dieselbe Reihenfolge gespiegelt');
    if (process.env.DJ_SCREENSHOT) await page.screenshot({ path: process.env.DJ_SCREENSHOT });
    ok('Layout 1920x1080, Kanal 2 gespiegelt, Texte nicht gespiegelt');

    // --- Play per Mausklick, Pegel steigt ---
    await page.click('#deck-a .taste.play');
    await warte(700);
    const lauf = await ev(() => ({ spielt: djStudio.state.decks.A.spielt, pre: djStudio.engine.decks.A.meterPre.lesen().L.spitze, master: djStudio.engine.masterPegel().L.spitze }));
    assert.ok(lauf.spielt && lauf.pre > 0.05 && lauf.master > 0.01, 'A spielt und ist messbar: ' + JSON.stringify(lauf));
    ok('Play-Taste, Pegel A und Master gemessen');

    // --- Kanalfader 0: POST und Master stumm, PRE weiter ---
    await ev(() => djStudio.engine.request('decks.A.fader', 0));
    await warte(400);
    const stumm = await ev(() => ({ pre: djStudio.engine.decks.A.meterPre.lesen().L.spitze, post: djStudio.engine.decks.A.meterPost.lesen().L.spitze, master: djStudio.engine.masterPegel().L.spitze }));
    assert.ok(stumm.pre > 0.05 && stumm.post < 1e-4 && stumm.master < 1e-4, 'Fader 0: ' + JSON.stringify(stumm));
    await ev(() => djStudio.engine.request('decks.A.fader', 0.85));
    ok('Kanalfader zu = stumm (PRE misst weiter)');

    // --- Crossfader: ganz B -> A unhoerbar ---
    await ev(() => djStudio.engine.request('master.crossfader', 1));
    await warte(400);
    const xfB = await ev(() => djStudio.engine.masterPegel().L.spitze);
    await ev(() => djStudio.engine.request('master.crossfader', -1));
    await warte(400);
    const xfA = await ev(() => djStudio.engine.masterPegel().L.spitze);
    assert.ok(xfB < 1e-4 && xfA > 0.01, `Crossfader: B-Seite ${xfB}, A-Seite ${xfA}`);
    ok('Crossfader links = nur A, rechts = A stumm');

    // --- EQ LOW Kill senkt die tiefen Frequenzen ---
    const tief = async () => ev(async () => {
      const a = djStudio.engine.decks.A.meterPre.l, f = new Float32Array(a.frequencyBinCount);
      let s = 0; const binHz = djStudio.engine.ctx.sampleRate / a.fftSize;
      for (let k = 0; k < 6; k++) { a.getFloatFrequencyData(f); for (let i = 1; i * binHz < 120; i++) s += Math.pow(10, f[i] / 10); await new Promise(r => setTimeout(r, 60)); }
      return 10 * Math.log10(s);
    });
    await ev(() => djStudio.engine.decks.A.springen(90));
    await warte(300);
    const vorher = await tief();
    await ev(() => djStudio.engine.request('decks.A.eq.low', -26));
    await warte(300);
    const nachher = await tief();
    await ev(() => djStudio.engine.request('decks.A.eq.low', 0));
    assert.ok(vorher - nachher > 12, `LOW Kill: ${vorher.toFixed(1)} -> ${nachher.toFixed(1)} dB`);
    ok(`EQ LOW Kill senkt <120 Hz um ${(vorher - nachher).toFixed(1)} dB`);

    // --- Limiter greift bei Uebersteuerung, CLIP/LIMIT-Anzeige ---
    await ev(() => { const e = djStudio.engine; e.request('decks.A.trim', 12); e.request('master.volume', 1); });
    await warte(900);
    const lim = await ev(() => ({ red: djStudio.engine.limiter.reduction, led: document.querySelector('.status-led.gelb').classList.contains('an'), sp: djStudio.engine.masterPegel().L.spitze }));
    assert.ok(lim.red < -1 && lim.led, 'Limiter: ' + JSON.stringify(lim));
    await ev(() => { const e = djStudio.engine; e.request('decks.A.trim', 0); e.request('master.volume', 0.8); });
    ok(`Limiter senkt ${lim.red.toFixed(1)} dB ab, LIMIT leuchtet`);

    // --- SYNC: Tempo + Phase ---
    await ev(() => { const e = djStudio.engine; e.request('master.crossfader', 0); e.decks.B.springen(20); e.decks.B.spielen(); e.request('decks.B.sync', true); });
    await warte(1200);
    const sync = await ev(() => {
      const e = djStudio.engine, a = e.decks.A, b = e.decks.B, s = djStudio.state.decks;
      const bpmA = s.A.track.grid.bpm * (1 + s.A.tempo / 100), bpmB = s.B.track.grid.bpm * (1 + s.B.tempo / 100);
      let d = a.phase(a.pos()) - b.phase(b.pos()); if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
      return { bpmA, bpmB, ms: Math.abs(d) * 60000 / bpmA };
    });
    assert.ok(Math.abs(sync.bpmA - sync.bpmB) < 0.01 && sync.ms < 15, 'SYNC: ' + JSON.stringify(sync));
    ok(`SYNC: ${sync.bpmB.toFixed(2)} BPM, Phasenabstand ${sync.ms.toFixed(1)} ms`);

    // --- Beat-Loop haelt die Position ---
    await page.click('#deck-a .loop-n[data-n="4"]');
    const lp = await ev(() => djStudio.state.decks.A.loop);
    const pos = [];
    for (let i = 0; i < 8; i++) { await warte(400); pos.push(await ev(() => djStudio.state.decks.A.pos)); }
    assert.ok(lp.an && pos.every(p => p >= lp.start - 0.05 && p <= lp.ende + 0.05), 'Loop: ' + JSON.stringify({ lp, pos }));
    await page.click('#deck-a .loop-aktiv');
    ok('Beat-Loop 4 bleibt im Bereich');

    // --- Knopf per Maus, Doppelklick = Mitte, Crossfader per Tastatur ---
    const k = await page.locator('#deck-a .knopf[aria-label="HIGH"]').boundingBox();
    await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
    await page.mouse.down(); await page.mouse.move(k.x + k.width / 2, k.y - 40, { steps: 5 }); await page.mouse.up();
    const hoch = await ev(() => djStudio.state.decks.A.eq.high);
    await page.dblclick('#deck-a .knopf[aria-label="HIGH"]');
    const mitte = await ev(() => djStudio.state.decks.A.eq.high);
    await page.focus('.crossfader');
    await page.keyboard.press('ArrowRight');
    const xfTaste = await ev(() => djStudio.state.master.crossfader);
    assert.ok(hoch > 3 && mitte === 0 && xfTaste > 0, JSON.stringify({ hoch, mitte, xfTaste }));
    ok('Knopf ziehen / Doppelklick, Crossfader mit Pfeiltaste');

    // --- Titel aus der Leiste auf Kanal 2 ziehen (Kanal 2 laeuft -> gesperrt, dann pausiert -> geladen) ---
    const erster = await ev(() => djStudio.state.queue[0].track.titel);
    await page.locator('.karte').first().dragTo(page.locator('#deck-b .deck-titel'));
    await warte(300);
    assert.equal(await ev(() => djStudio.state.decks.B.meldung), 'Läuft gerade – zuerst pausieren');
    await page.click('#deck-b .taste.play');
    await page.locator('.karte').first().dragTo(page.locator('#deck-b .deck-titel'));
    await page.waitForFunction(t => djStudio.state.decks.B.track?.titel === t, erster, { timeout: 20000 });
    ok('Ziehen auf laufendes Deck gesperrt, auf stehendes Deck geladen');

    // --- CUE wie am Player ---
    await ev(() => { const d = djStudio.engine.decks.B; d.springen(10); });
    await page.click('#deck-b .taste.cue');          // steht -> Cue setzen
    const cue = await ev(() => djStudio.state.decks.B.cue);
    await ev(() => djStudio.engine.decks.B.spielen()); await warte(500);
    await page.click('#deck-b .taste.cue');          // laeuft -> zurueck und stehen
    const nachCue = await ev(() => ({ spielt: djStudio.state.decks.B.spielt, pos: djStudio.state.decks.B.pos }));
    assert.ok(Math.abs(cue - 10) < 0.3 && !nachCue.spielt && Math.abs(nachCue.pos - cue) < 0.01, JSON.stringify({ cue, nachCue }));
    ok('CUE setzt (auf den Beat) und springt zurueck');

    // --- Lokale Datei: echte Wellenform, kein Raster -> SYNC gesperrt ---
    await page.click('.leiste-links .taste.icon');
    await page.locator('.dialog input[type=file]').setInputFiles({ name: 'Testton - Sinus 440.wav', mimeType: 'audio/wav', buffer: wav(3, 440) });
    await page.keyboard.press('Escape');
    const lokal = await ev(() => djStudio.state.queue.find(q => q.track.quelle === 'LOCAL_LICENSED')?.id);
    await ev(id => window.djStudio.engine.decks.B.laden(djStudio.state.queue.find(q => q.id === id).track), lokal);
    const lk = await ev(() => ({ grid: djStudio.state.decks.B.track.grid, wf: !!djStudio.state.decks.B.track.wf, sync: document.querySelector('#deck-b .taste.sync').disabled, dauer: djStudio.state.decks.B.track.dauer }));
    assert.ok(lk.grid === null && lk.wf && lk.sync && Math.abs(lk.dauer - 3) < 0.05, JSON.stringify(lk));
    const yt = await ev(async () => { try { await (await import('./js/sources.js')).EXISTING_YOUTUBE.laden(); return 'geladen'; } catch (e) { return e.message; } });
    assert.match(yt, /nicht freigegeben/);
    ok('Lokale Datei: echte Wellenform, SYNC gesperrt; YouTube nicht ladbar');

    // --- Automix: 16 Takte vor Ende taktgenau auf das andere Deck ---
    await ev(async () => {
      const e = djStudio.engine;
      e.decks.B.anhalten(); await window.djStudio.engine.decks.B.laden((await (await import('./js/sources.js')).DEMO.liste())[2]);
      e.request('master.crossfader', -1);
      e.decks.A.springen(djStudio.state.decks.A.track.dauer - 34);
      e.request('automix', true);
    });
    await page.waitForFunction(() => djStudio.state.decks.B.spielt, null, { timeout: 10000 });
    const start = await ev(() => {
      const a = djStudio.engine.decks.A, b = djStudio.engine.decks.B;
      const ba = (djStudio.state.decks.A.pos) / (60 / djStudio.state.decks.A.track.grid.bpm), bb = djStudio.state.decks.B.pos / (60 / djStudio.state.decks.B.track.grid.bpm);
      return { taktA: ((ba % 4) + 4) % 4, taktB: ((bb % 4) + 4) % 4, low: djStudio.state.decks.B.eq.low };
    });
    let d = Math.abs(start.taktA - start.taktB); d = Math.min(d, 4 - d);
    assert.ok(d < 0.05 && start.low === -26, 'Automix-Start: ' + JSON.stringify(start));
    await page.waitForFunction(() => !djStudio.state.decks.A.spielt && djStudio.state.master.crossfader === 1, null, { timeout: 45000 });
    const ende = await ev(() => ({ b: djStudio.state.decks.B.spielt, lowB: djStudio.state.decks.B.eq.low }));
    assert.ok(ende.b && ende.lowB === 0, JSON.stringify(ende));
    await page.waitForFunction(() => djStudio.state.decks.A.track && !djStudio.state.decks.A.track.gespielt, null, { timeout: 15000 });
    ok('Automix: taktgenau gestartet, Bass getauscht, ganz auf B, nächster Titel auf A');

    assert.deepEqual(fehler, [], 'keine Seitenfehler');
    console.log('DJ Studio: alle Tests bestanden.');
  } finally {
    await browser.close();
    server.kill();
  }
}
run().catch(e => { console.error(e); process.exit(1); });
