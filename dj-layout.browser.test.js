'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
async function run() {
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    try {
        const page = await browser.newPage();
        const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
        const start = html.indexOf('<div class="dj-stage">');
        const stage = html.slice(start, html.indexOf('</button>', start) + 9) + '</div>';
        for (const width of [1280, 1920]) {
            await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
            await page.setContent('<style>' + css + '\nbody{display:block;margin:0;overflow:hidden;} .dj-stage{transform-origin:top left;transform:scale(' + (width / 1920) + ')}</style>' + stage);
            await page.evaluate(() => {
                document.querySelector('#dj-fern-qr').classList.add('is-da');
                document.querySelector('#dj-ton-knopf').classList.add('is-an');
                document.querySelector('#dj-ton-haupt').textContent = 'Bitte ▶ in der Bildmitte anklicken';
                document.querySelector('#dj-ton-sub').textContent = 'Auf Mobilgeräten verlangt Twitch einen Start direkt im Video. Für den automatischen Screen-Betrieb muss der Wiedergabebrowser passend eingerichtet sein.';
            });
            const qr = await page.locator('#dj-fern-qr').boundingBox();
            const button = await page.locator('#dj-ton-knopf').boundingBox();
            assert(button.x + button.width < qr.x, 'Restart prompt must leave a gap before the QR code');
            const stageBox = await page.locator('.dj-stage').boundingBox();
            assert(qr.x + qr.width <= stageBox.x + stageBox.width);
            assert(qr.y + qr.height <= stageBox.y + stageBox.height);
            const player = await page.locator('#dj-live-player').boundingBox();
            const center = { x: player.x + player.width / 2, y: player.y + player.height / 2 };
            assert(center.y < button.y && center.x < qr.x, 'Native Twitch play button stays unobstructed');
            if (process.env.DJ_LAYOUT_SCREENSHOT && width === 1280) await page.screenshot({ path: process.env.DJ_LAYOUT_SCREENSHOT });
            await page.locator('#dj-fern-qr').evaluate(el => { el.className = 'dj-fern-qr is-weg'; });
            assert.equal(await page.locator('#dj-fern-qr').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        }
        console.log('DJ layout passed at 1280x800 and 1920x1080.');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
