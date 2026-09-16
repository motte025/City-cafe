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
        const playerEnd = '<div class="dj-player" id="dj-live-player"></div>';
        const stage = html.slice(start, html.indexOf(playerEnd, start) + playerEnd.length) + '</div>';
        const toolsStart = html.indexOf('<!-- Twitch verlangt einen unbedeckten Player.');
        const tools = html.slice(toolsStart, html.indexOf('</button>', toolsStart) + 9);
        for (const width of [1280, 1920]) {
            await page.setViewportSize({ width, height: width === 1280 ? 800 : 1080 });
            await page.setContent('<style>' + css + '\nbody{display:block;margin:0;overflow:hidden;} #dashboard-scaler{transform:scale(' + (width / 1920) + ')} .widget-rotator{position:absolute;left:1360px;top:0;width:520px;height:670px}</style><div id="dashboard-scaler">' + stage + '<div class="widget-rotator">' + tools + '</div></div>');
            await page.evaluate(() => {
                document.querySelector('#dj-fern-qr').classList.add('is-da');
                document.querySelector('#dj-ton-knopf').classList.add('is-an');
                document.querySelector('#dj-ton-haupt').textContent = 'Bitte ▶ in der Bildmitte anklicken';
                document.querySelector('#dj-ton-sub').textContent = 'Auf Mobilgeräten verlangt Twitch einen Start direkt im Video. Für den automatischen Screen-Betrieb muss der Wiedergabebrowser passend eingerichtet sein.';
            });
            const qr = await page.locator('#dj-fern-qr').boundingBox();
            const button = await page.locator('#dj-ton-knopf').boundingBox();
            const sidebar = await page.locator('.widget-rotator').boundingBox();
            assert(qr.x >= sidebar.x && qr.x + qr.width <= sidebar.x + sidebar.width);
            assert(qr.y >= sidebar.y && qr.y + qr.height <= sidebar.y + sidebar.height);
            assert(button.x >= sidebar.x && button.x + button.width <= sidebar.x + sidebar.width);
            assert(button.y >= qr.y + qr.height, 'Restart prompt must leave a gap below the QR code');
            const player = await page.locator('#dj-live-player').boundingBox();
            assert(player.x + player.width < qr.x && player.x + player.width < button.x,
                'Twitch player stays completely unobstructed');
            if (process.env.DJ_LAYOUT_SCREENSHOT && width === 1280) await page.screenshot({ path: process.env.DJ_LAYOUT_SCREENSHOT });
            await page.locator('#dj-fern-qr').evaluate(el => { el.className = 'dj-fern-qr is-weg'; });
            assert.equal(await page.locator('#dj-fern-qr').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        }
        console.log('DJ layout passed at 1280x800 and 1920x1080.');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
