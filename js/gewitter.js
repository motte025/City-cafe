/*
 * Gewitter-Effekt (22.10.2026, Betreiber): dunkle, ziehende Wolken, in denen verästelte Blitze
 * aufleuchten (Vorlage: Gewitter-Visuals im Anyma-Stil, ohne fremdes Material - alles hier gerechnet).
 * Fuer das Wetter-Widget (nur bei Gewitter) und den Gewitter-Skin des DJ-Studios.
 *
 *   const stopp = gewitterStarten(container, { blitzAlle: [2.5, 7] });
 *   gewitter.blitz();   // sofort ein Blitz (z. B. im Takt der Musik)
 *
 * Legt ein Canvas als erstes Kind in den Container (position:absolute, fuellt ihn aus) und
 * zeichnet, solange es im Dokument haengt. Wird der Container geleert, endet die Schleife.
 */
(function (global) {
    'use strict';

    let wolkenBild = null;

    // Kachelbares Wertrauschen (in x nahtlos), 5 Oktaven -> blaugraue Wolkenflaeche.
    function wolkenErzeugen() {
        if (wolkenBild) return wolkenBild;
        const B = 512, H = 256;
        const c = document.createElement('canvas');
        c.width = B; c.height = H;
        const g = c.getContext('2d');
        const bild = g.createImageData(B, H);
        let saat = 20261022;
        const zufall = () => (saat = (saat * 16807) % 2147483647) / 2147483647;
        const oktaven = [];
        for (let o = 0; o < 5; o++) {
            const nx = 4 << o, ny = 2 << o;
            const w = new Float32Array(nx * (ny + 1));
            for (let i = 0; i < w.length; i++) w[i] = zufall();
            oktaven.push({ nx, ny, w });
        }
        const glatt = t => t * t * (3 - 2 * t);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < B; x++) {
                let v = 0, amp = 0.5, summe = 0;
                for (const { nx, ny, w } of oktaven) {
                    const fx = x / B * nx, fy = y / H * ny;
                    const x0 = Math.floor(fx), y0 = Math.floor(fy);
                    const tx = glatt(fx - x0), ty = glatt(fy - y0);
                    const a = w[y0 * nx + x0 % nx], b = w[y0 * nx + (x0 + 1) % nx];
                    const cc = w[(y0 + 1) * nx + x0 % nx], d = w[(y0 + 1) * nx + (x0 + 1) % nx];
                    v += amp * ((a + (b - a) * tx) * (1 - ty) + (cc + (d - cc) * tx) * ty);
                    summe += amp;
                    amp *= 0.55;
                }
                v /= summe;
                const k = Math.max(0, Math.min(1, (v - 0.32) * 2.1));      // Kontrast: Wolkenballen
                const i = (y * B + x) * 4;
                bild.data[i] = 14 + k * 70;
                bild.data[i + 1] = 22 + k * 88;
                bild.data[i + 2] = 32 + k * 104;
                bild.data[i + 3] = 255;
            }
        }
        g.putImageData(bild, 0, 0);
        return (wolkenBild = c);
    }

    // Blitz: Mittelpunkt-Verschiebung, dazu kuerzere Zweige.
    function blitzPfad(x0, y0, x1, y1, unruhe, tiefe) {
        if (tiefe === 0) return [[x0, y0], [x1, y1]];
        const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * unruhe;
        const my = (y0 + y1) / 2 + (Math.random() - 0.5) * unruhe * 0.4;
        const a = blitzPfad(x0, y0, mx, my, unruhe / 2, tiefe - 1);
        return a.concat(blitzPfad(mx, my, x1, y1, unruhe / 2, tiefe - 1).slice(1));
    }

    function blitzBauen(b, h) {
        const x0 = b * (0.1 + Math.random() * 0.8), y0 = h * Math.random() * 0.15;
        const x1 = x0 + (Math.random() - 0.5) * b * 0.5, y1 = h * (0.6 + Math.random() * 0.45);
        const haupt = blitzPfad(x0, y0, x1, y1, Math.hypot(x1 - x0, y1 - y0) * 0.45, 7);
        const zweige = [];
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            const p = haupt[Math.floor(haupt.length * (0.15 + Math.random() * 0.6))];
            const lang = h * (0.12 + Math.random() * 0.25), wink = (Math.random() - 0.5) * 2.2 + Math.PI / 2;
            zweige.push(blitzPfad(p[0], p[1], p[0] + Math.cos(wink) * lang, p[1] + Math.sin(wink) * lang * 0.8, lang * 0.4, 5));
        }
        return { haupt, zweige, x: x0, y: y0 + (y1 - y0) * 0.3, t0: performance.now() };
    }

    // Helligkeit ueber die Zeit: zwei, drei Flackerer, dann aus (ca. 0,5 s)
    function blitzStaerke(ms) {
        if (ms < 0 || ms > 520) return 0;
        const puls = (m, s, b) => Math.max(0, 1 - Math.abs(ms - m) / b) * s;
        return Math.min(1, puls(30, 1, 60) + puls(140, 0.7, 70) + puls(260, 0.9, 90) + Math.max(0, 1 - ms / 520) * 0.25);
    }

    function linie(g, punkte) {
        g.beginPath();
        g.moveTo(punkte[0][0], punkte[0][1]);
        for (let i = 1; i < punkte.length; i++) g.lineTo(punkte[i][0], punkte[i][1]);
        g.stroke();
    }

    function gewitterStarten(container, optionen) {
        const opt = Object.assign({ blitzAlle: [2.5, 7], dunkel: 0.35, zug: 6 }, optionen || {});
        const cv = document.createElement('canvas');
        cv.className = 'gewitter-canvas';
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
        container.insertBefore(cv, container.firstChild);
        const g = cv.getContext('2d');
        const wolken = wolkenErzeugen();
        const blitze = [];
        let naechster = performance.now() + 800, start = performance.now(), aus = false, halten = false;

        function zeichnen(jetzt) {
            if (aus || !cv.isConnected) return;
            requestAnimationFrame(zeichnen);
            const pr = Math.min(1.5, global.devicePixelRatio || 1);
            const b = Math.max(1, Math.round(cv.clientWidth * pr)), h = Math.max(1, Math.round(cv.clientHeight * pr));
            if (cv.width !== b || cv.height !== h) { cv.width = b; cv.height = h; }
            if (jetzt >= naechster && opt.blitzAlle && !halten) {
                blitze.push(blitzBauen(b, h));
                if (Math.random() < 0.3) setTimeout(() => blitze.push(blitzBauen(b, h)), 180);
                naechster = jetzt + 1000 * (opt.blitzAlle[0] + Math.random() * (opt.blitzAlle[1] - opt.blitzAlle[0]));
            }
            const t = (jetzt - start) / 1000;
            // zwei Wolkenschichten, die verschieden schnell ziehen
            const hoehe = h * 1.25, breite = hoehe * (wolken.width / wolken.height);
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
            for (const [tempo, skal, alpha, dy] of [[opt.zug, 1, 1, -0.12], [opt.zug * 1.9, 0.7, 0.55, 0.15]]) {
                const bw = breite * skal, bh = hoehe * skal;
                let x = -((t * tempo * pr) % bw);
                g.globalAlpha = alpha;
                for (; x < b; x += bw) g.drawImage(wolken, x, h * dy, bw, bh);
            }
            g.globalAlpha = 1;
            // dunkler Rand oben/unten
            const v = g.createLinearGradient(0, 0, 0, h);
            v.addColorStop(0, `rgba(4,8,14,${opt.dunkel + 0.25})`);
            v.addColorStop(0.5, `rgba(4,8,14,${opt.dunkel * 0.4})`);
            v.addColorStop(1, `rgba(4,8,14,${opt.dunkel + 0.35})`);
            g.fillStyle = v;
            g.fillRect(0, 0, b, h);
            // Blitze: Wolken leuchten auf, dann der Strahl mit Schein
            for (let i = blitze.length - 1; i >= 0; i--) {
                const bl = blitze[i], s = halten ? 0.9 : blitzStaerke(jetzt - bl.t0);
                if (!halten && jetzt - bl.t0 > 520) { blitze.splice(i, 1); continue; }
                if (s <= 0) continue;
                g.globalCompositeOperation = 'lighter';
                const r = Math.max(b, h) * 0.55;
                const lg = g.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, r);
                lg.addColorStop(0, `rgba(150,190,255,${0.55 * s})`);
                lg.addColorStop(0.4, `rgba(90,130,200,${0.22 * s})`);
                lg.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = lg;
                g.fillRect(0, 0, b, h);
                g.lineCap = 'round';
                g.lineJoin = 'round';
                g.shadowColor = 'rgba(160,200,255,0.9)';
                g.shadowBlur = 14 * pr;
                g.strokeStyle = `rgba(150,190,255,${0.35 * s})`;
                g.lineWidth = 5 * pr;
                linie(g, bl.haupt);
                g.strokeStyle = `rgba(235,244,255,${s})`;
                g.lineWidth = 1.8 * pr;
                linie(g, bl.haupt);
                g.lineWidth = 1 * pr;
                for (const z of bl.zweige) linie(g, z);
                g.shadowBlur = 0;
            }
            g.globalCompositeOperation = 'source-over';
        }
        requestAnimationFrame(zeichnen);
        const steuerung = () => { aus = true; cv.remove(); };
        steuerung.blitz = () => blitze.push(blitzBauen(cv.width, cv.height));
        // Standbild (Vorschau/Bildschirmfotos): Blitze festhalten bzw. wieder laufen lassen
        steuerung.halten = an => { halten = !!an; if (!an) blitze.length = 0; };
        return steuerung;
    }

    global.gewitterStarten = gewitterStarten;
})(window);
