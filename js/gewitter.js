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

    const wolkenBilder = {};

    // Kachelbares Wertrauschen (in x nahtlos), 6 Oktaven -> blaugraue Wolkenflaeche.
    // einzeln: einzelne, kraeftige Wolken mit freien Luecken dazwischen (Luecken durchsichtig) -
    // fuer die Ebene ueber dem DJ-Pult; sonst eine geschlossene Wolkendecke (Wetter-Widget).
    function wolkenErzeugen(einzeln) {
        const art = einzeln === 'dunkel' ? 'dunkel' : einzeln ? 'einzeln' : 'decke';
        if (wolkenBilder[art]) return wolkenBilder[art];
        const B = 1024, H = 512;          // fein genug fuer grosse Flaechen (hochwertig)
        const c = document.createElement('canvas');
        c.width = B; c.height = H;
        const g = c.getContext('2d');
        const bild = g.createImageData(B, H);
        let saat = 20261022;
        const zufall = () => (saat = (saat * 16807) % 2147483647) / 2147483647;
        const oktaven = [];
        for (let o = 0; o < 6; o++) {
            const nx = 4 << o, ny = 2 << o;
            const w = new Float32Array(nx * (ny + 1));
            for (let i = 0; i < w.length; i++) w[i] = zufall();
            oktaven.push({ nx, ny, w });
        }
        const glatt = t => t * t * (3 - 2 * t);
        // einzeln: Werte erst sammeln und auf 0..1 strecken (das Rauschen liegt sonst eng um 0,5 -
        // kaum eine Stelle kam ueber die Wolken-Schwelle)
        const werte = einzeln ? new Float32Array(B * H) : null;
        let vmin = 1, vmax = 0;
        for (let durchlauf = einzeln ? 0 : 1; durchlauf < 2; durchlauf++)
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < B; x++) {
                if (durchlauf === 1 && einzeln) {
                    const v = (werte[y * B + x] - vmin) / Math.max(1e-6, vmax - vmin);
                    const i = (y * B + x) * 4;
                    // gut die Haelfte frei, dann weicher Rand, innen heller (beleuchtet)
                    // klar erkennbar (22.10.): schmaler Rand, deutlicher Helligkeitsverlauf vom Rand zum Kern
                    const k = Math.max(0, Math.min(1, (v - 0.49) * 7));
                    const kern = Math.max(0, Math.min(1, (v - 0.56) * 2.6));
                    if (art === 'dunkel') {       // Gewitterwolken ueber dem Pult: dunkel, Kern etwas heller
                        bild.data[i] = 22 + kern * 62;
                        bild.data[i + 1] = 28 + kern * 70;
                        bild.data[i + 2] = 40 + kern * 84;
                    } else {
                        bild.data[i] = 70 + kern * 175;
                        bild.data[i + 1] = 88 + kern * 162;
                        bild.data[i + 2] = 118 + kern * 137;
                    }
                    bild.data[i + 3] = Math.round(255 * k * k * (3 - 2 * k));
                    continue;
                }
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
                const i = (y * B + x) * 4;
                if (einzeln) {
                    werte[y * B + x] = v;
                    if (v < vmin) vmin = v;
                    if (v > vmax) vmax = v;
                } else {
                    const k = Math.max(0, Math.min(1, (v - 0.32) * 2.1));      // Kontrast: Wolkenballen
                    bild.data[i] = 14 + k * 70;
                    bild.data[i + 1] = 22 + k * 88;
                    bild.data[i + 2] = 32 + k * 104;
                    bild.data[i + 3] = 255;
                }
            }
        }
        g.putImageData(bild, 0, 0);
        return (wolkenBilder[art] = c);
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

    // Buehne: kurz flackern, dann langsam ausgluehen (~1,6 s, Betreiber: langsamer aufloesen)
    const BLITZ_LANG_MS = 1700;
    function blitzStaerkeLang(ms) {
        if (ms < 0 || ms > BLITZ_LANG_MS) return 0;
        const puls = (m, s, b) => Math.max(0, 1 - Math.abs(ms - m) / b) * s;
        const nachgluehen = Math.pow(1 - ms / BLITZ_LANG_MS, 1.8) * 0.75;
        return Math.min(1, puls(30, 1, 70) + puls(150, 0.6, 80) + puls(290, 0.75, 100) + nachgluehen);
    }

    // punkte: ein Pfad [[x, y], ...] oder mehrere Stuecke [[[x, y], ...], ...]
    function linie(g, punkte) {
        const stuecke = Array.isArray(punkte[0][0]) ? punkte : [punkte];
        g.beginPath();
        for (const st of stuecke) {
            g.moveTo(st[0][0], st[0][1]);
            for (let i = 1; i < st.length; i++) g.lineTo(st[i][0], st[i][1]);
        }
        g.stroke();
    }

    function gewitterStarten(container, optionen) {
        // wolken: false -> nur Blitzlicht auf durchsichtigem Grund (ueber einem Skin); strahl: false -> ohne Blitzlinien
        const opt = Object.assign({ blitzAlle: [2.5, 7], dunkel: 0.35, zug: 6, wolken: true, strahl: true }, optionen || {});
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
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
            if (!opt.wolken) g.clearRect(0, 0, b, h);
            else {
                // zwei Wolkenschichten, die verschieden schnell ziehen
                const hoehe = h * 1.25, breite = hoehe * (wolken.width / wolken.height);
                g.imageSmoothingQuality = 'high';
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
            }
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
                if (!opt.strahl) continue;
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

    // ---- Gewitter ueber dem ganzen DJ-Studio (Gewitter-Skins, 22./23.10.2026) ---------------------
    // Einzelne, verschiedene Wolken ziehen von links nach rechts, lange verzweigte Blitze von ueberall
    // (auch quer), Lichtstoesse hinter den Wolken. Die Blitze kommen an den passenden Stellen der Musik:
    // Drop (nach ruhigerem Teil setzt der Bass kraeftig ein) = grosser Blitzschlag, dann 8 Takte Blitze
    // auf starken Bassschlaegen; andere Klangwechsel = vereinzelt schwaechere Blitze; ruhige Teile =
    // hoechstens leises Wetterleuchten. Drei Staerken (variante 1-3).
    const VARIANTEN = {
        1: { wolken: 10, deck: 0.78, haupt: 0.45, klein: 1, licht: 0.6, akzent: 0.22 },
        2: { wolken: 13, deck: 0.86, haupt: 0.65, klein: 2, licht: 0.8, akzent: 0.18 },
        3: { wolken: 16, deck: 0.93, haupt: 0.85, klein: 3, licht: 1.0, akzent: 0.15 },
    };

    // Verzweigter Blitz: Hauptstrahl, an dem Aeste haengen, an denen wieder Aestchen haengen.
    function blitzBaum(x0, y0, x1, y1, tiefe, liste, dicke) {
        const lang = Math.hypot(x1 - x0, y1 - y0);
        const pfad = blitzPfad(x0, y0, x1, y1, lang * 0.42, tiefe >= 2 ? 8 : 6);
        liste.push({ pfad, dicke });
        if (dicke < 0.35) return;
        const aeste = Math.round((dicke > 0.8 ? 4 : 2) + Math.random() * 3);
        for (let i = 0; i < aeste; i++) {
            const p = pfad[Math.floor(pfad.length * (0.1 + Math.random() * 0.75))];
            const w = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.75);
            const l = lang * (0.18 + Math.random() * 0.32);
            blitzBaum(p[0], p[1], p[0] + Math.cos(w) * l, p[1] + Math.sin(w) * l, tiefe - 1, liste, dicke * 0.5);
        }
    }

    // Eine einzelne Wolke (Sprite): Rauschen mal weiche Ellipse - der Rand laeuft immer ins Durchsichtige
    // aus (nichts abgeschnitten); jede Saat ergibt eine andere Form. Dunkel, Kern etwas heller.
    function wolkeSprite(saat) {
        const B = 512, H = 256;
        const c = document.createElement('canvas');
        c.width = B; c.height = H;
        const g = c.getContext('2d');
        const bild = g.createImageData(B, H);
        const zufall = () => (saat = (saat * 16807) % 2147483647) / 2147483647;
        const oktaven = [];
        for (let o = 0; o < 5; o++) {
            const nx = 3 << o, ny = 2 << o;
            const w = new Float32Array((nx + 1) * (ny + 1));
            for (let i = 0; i < w.length; i++) w[i] = zufall();
            oktaven.push({ nx, ny, w });
        }
        const glatt = t => t * t * (3 - 2 * t);
        // Form: zwei bis vier Ballen nebeneinander, oben kuppelig, unten flacher
        const ballen = [];
        const n = 2 + Math.floor(zufall() * 3);
        for (let i = 0; i < n; i++) ballen.push([0.22 + zufall() * 0.56, 0.45 + zufall() * 0.15, 0.16 + zufall() * 0.14]);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < B; x++) {
                let v = 0, amp = 0.5, summe = 0;
                for (const { nx, ny, w } of oktaven) {
                    const fx = x / B * nx, fy = y / H * ny;
                    const x0 = Math.floor(fx), y0 = Math.floor(fy);
                    const tx = glatt(fx - x0), ty = glatt(fy - y0);
                    const a = w[y0 * (nx + 1) + x0], b = w[y0 * (nx + 1) + x0 + 1];
                    const cc = w[(y0 + 1) * (nx + 1) + x0], d = w[(y0 + 1) * (nx + 1) + x0 + 1];
                    v += amp * ((a + (b - a) * tx) * (1 - ty) + (cc + (d - cc) * tx) * ty);
                    summe += amp;
                    amp *= 0.55;
                }
                v /= summe;
                let form = 0;
                const u = x / B, q = y / H;
                for (const [bx, by, br] of ballen) {
                    const dx = (u - bx) / (br * 1.6), dy = (q - by) / (q < by ? br * 1.5 : br * 0.9);
                    form = Math.max(form, 1 - Math.sqrt(dx * dx + dy * dy));
                }
                const dichte = form * 1.6 + (v - 0.5) * 1.8;          // Form plus Rauschen = ausgefranst
                const k = Math.max(0, Math.min(1, dichte * 1.8));
                const kern = Math.max(0, Math.min(1, (dichte - 0.35) * 1.6 + (0.55 - q) * 0.6));
                const i = (y * B + x) * 4;
                bild.data[i] = 24 + kern * 74;
                bild.data[i + 1] = 30 + kern * 82;
                bild.data[i + 2] = 42 + kern * 96;
                bild.data[i + 3] = Math.round(255 * k * k * (3 - 2 * k));
            }
        }
        g.putImageData(bild, 0, 0);
        return c;
    }
    const WOLKEN_SPRITES = [];
    function wolkenSprites() {
        if (!WOLKEN_SPRITES.length) for (let i = 0; i < 7; i++) WOLKEN_SPRITES.push(wolkeSprite(1234567 + i * 7919));
        return WOLKEN_SPRITES;
    }

    function gewitterBuehne(container, optionen) {
        const v = VARIANTEN[(optionen && optionen.variante) || 2] || VARIANTEN[2];
        const pegelLesen = (optionen && optionen.pegel) || (() => 0);
        const bassLesen = (optionen && optionen.bass) || (() => 0);       // 0..1
        const taktLesen = (optionen && optionen.takt) || (() => null);    // { schlag, bpm } oder null
        const melodieLesen = (optionen && optionen.melodie) || (() => 0); // 0..1 Mitten/Hoehen
        const spannungLesen = (optionen && optionen.spannung) || (() => null); // {jetzt, voraus} 0..1 aus der Spur
        const dropsLesen = (optionen && optionen.drops) || (() => null);         // {pos, drops: [s]} aus der Spur
        // Bereiche ohne Effekt, in Bild-2-Pixeln (1672 x 941): [x, y, Breite, Hoehe] (z. B. Videofenster)
        const frei = (optionen && optionen.frei) || [];
        const wolkenFrei = (optionen && optionen.wolkenFrei) || [];   // nur ohne Wolken (Blitze ja)
        // Zwei Ebenen: dunkle Wolken normal darueber, Licht und Blitze mit "screen" (nur Helles wirkt)
        const ebene = (blend) => {
            const c = document.createElement('canvas');
            c.className = 'gewitter-canvas';
            c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
                + (blend ? 'mix-blend-mode:' + blend + ';' : '');
            container.appendChild(c);
            return c;
        };
        const cw = ebene(''), cv = ebene('screen');
        const gw = cw.getContext('2d'), g = cv.getContext('2d');
        // Wolken: echte Wolkenbilder (wolkenBilder: Adressen, freigestellt mit Alpha), sonst gerechnete
        let sprites = [];
        if (optionen && optionen.wolkenBilder && optionen.wolkenBilder.length) {
            let geladen = 0;
            const liste = optionen.wolkenBilder.map(src => { const im = new Image(); im.src = src; return im; });
            liste.forEach(im => im.decode().then(() => { if (++geladen === liste.length) { sprites = liste; wolken.length = 0; } }).catch(() => {}));
        } else sprites = wolkenSprites();
        // Foto-Blitze (freigestellt) nur fuer Drops; sonst gerechnete Blitze
        let fotos = [];
        if (optionen && optionen.blitzBilder && optionen.blitzBilder.length) {
            const liste = optionen.blitzBilder.map(src => { const im = new Image(); im.src = src; return im; });
            Promise.all(liste.map(im => im.decode())).then(() => {
                fotos = liste;
                liste.forEach((im, i) => setTimeout(() => fotoVorbereiten(im), 250 * (i + 1)));
            }).catch(() => {});
        }
        // Foto-Blitz vorbereiten: schwachen Dunst weg und zum Bildrand weich auslaufen lassen (keine
        // sichtbare Fotokante); dazu der Kern = nur die hellsten Teile fuer das Ausgluehen ohne feine Aeste
        function fotoVorbereiten(im) {
            const bw = im.naturalWidth, bh = im.naturalHeight;
            const leinwand = () => { const c = document.createElement('canvas'); c.width = bw; c.height = bh; return c; };
            const cv1 = leinwand(), k1 = cv1.getContext('2d', { willReadFrequently: true });
            k1.drawImage(im, 0, 0);
            const d = k1.getImageData(0, 0, bw, bh), p = d.data;
            const randX = bw * 0.06, randY = bh * 0.05;
            let obenSumme = 0, obenZahl = 0;                     // wo der Blitz oben anfaengt (x)
            const weich = x => (x >= 1 ? 1 : x <= 0 ? 0 : x * x * (3 - 2 * x));
            for (let y = 0; y < bh; y++) {
                const ry = weich(Math.min(y, bh - 1 - y) / randY);
                for (let x = 0; x < bw; x++) {
                    const i = (y * bw + x) * 4;
                    const rand = ry * weich(Math.min(x, bw - 1 - x) / randX);
                    const a0 = p[i + 3];
                    // Fotos ohne Schein (Betreiber 23.10.): genau so zeigen, nur Rauschen ganz unten weg
                    const a = Math.round(weich((a0 - 6) / 20) * a0 * rand);
                    p[i + 3] = a;
                    if (y < bh * 0.04 && a0 > 128) { obenSumme += x; obenZahl++; }
                }
            }
            im.obenX = obenZahl ? obenSumme / obenZahl / bw : 0.5;
            k1.putImageData(d, 0, 0);
            // schon hier sauber auf Anzeigegroesse verkleinern (in Halbschritten, hohe Qualitaet);
            // sonst verkleinert der Browser beim Zeichnen grob und der Blitz wird unscharf
            const sb = cv.width > 1 ? cv.width : 1920, sh = cv.height > 1 ? cv.height : 1080;
            const f = fotoMass(bw, bh, sb, sh);
            im.voll = verkleinern(cv1, Math.round(bw * f), Math.round(bh * f));
            im.schatten = schattenBild(im.voll);
        }
        // Anzeigegroesse eines Foto-Blitzes: Pixel fuer Pixel wie das Foto, nur verkleinert, wenn es
        // hoeher als der Bildschirm oder breiter als 60 % ist (nie hochziehen - das macht unscharf)
        function fotoMass(bw, bh, sb, sh) {
            return Math.min(1, sh / bh, 0.6 * sb / bw);
        }
        // dunkler Himmel hinter dem Foto-Blitz: die Blitzform weich verwischt, schwarz - wie im Foto,
        // wo der Blitz auf Schwarz steht (auf dem hellen Pult wirkt er sonst blass und verschwommen)
        function schattenBild(quelle) {
            const c = document.createElement('canvas');
            c.width = quelle.width; c.height = quelle.height;
            const k = c.getContext('2d');
            const r = Math.max(4, Math.round(quelle.height / 90));
            k.filter = 'blur(' + r + 'px)';
            for (let i = 0; i < 4; i++) k.drawImage(quelle, 0, 0);       // mehrfach: schmaler dunkler Saum
            k.filter = 'none';
            k.globalCompositeOperation = 'source-in';
            k.fillStyle = "rgb(0,2,10)";
            k.fillRect(0, 0, c.width, c.height);
            return c;
        }
        function verkleinern(quelle, zw, zh) {
            let c = quelle;
            while (c.width / 2 >= zw && c.height / 2 >= zh) c = schritt(c, Math.round(c.width / 2), Math.round(c.height / 2));
            return c.width === zw && c.height === zh ? c : schritt(c, zw, zh);
        }
        function schritt(quelle, zw, zh) {
            const c = document.createElement('canvas');
            c.width = zw; c.height = zh;
            const k = c.getContext('2d');
            k.imageSmoothingEnabled = true;
            k.imageSmoothingQuality = 'high';
            k.drawImage(quelle, 0, 0, zw, zh);
            return c;
        }
        const arbeit = document.createElement('canvas');     // Foto-Blitz zusammensetzen (Kern, Rand, Farbe)
        const ag = arbeit.getContext('2d');
        const maske = document.createElement('canvas');      // Wolken-Form fuer das Licht in den Wolken
        const mg = maske.getContext('2d');
        const licht = document.createElement('canvas');
        const lg2 = licht.getContext('2d');
        const blitze = [];
        const wolken = [];
        let letzter = 0, schnell = 0, langsam = 0, energie = 0, ruhe = 0, aus = false, halten = false;
        let dichte = 0.5, dichteZeit = 0, dichteZiel = 0.5, wolkeWeg = 0;
        let schlagJetzt = null, letzterSchlag = null, letzterTaktMs = 2000, letzterTakt = -1, grossZahl = 0, mittelZahl = 0;
        let wolkeDazu = 0, melSchnell = 0, melLangsam = 0, melVerlauf = [], letzteMelodie = 0, melMax = 0.05, kleineZahl = 0, fotoZahl = 0, bassPause = 0, bassMax = 0.1, letzterDrop = -1e9, letzterGross = 0, letzterMittel = 0, dropPos = null;
        let modus = 'ruhig', modusBis = 0, bassSchnell = 0, bassVerlauf = [], letzteZeit = performance.now();

        // Eine Wolke: zufaellige Form, Groesse, Hoehe, Tempo (grosse sind naeher = schneller)
        function neueWolke(b, h, irgendwo) {
            const gross = 0.25 + Math.random() * 0.45;
            const bild = sprites[Math.floor(Math.random() * sprites.length)];
            const w = b * gross, hh = bild.naturalWidth ? w * bild.naturalHeight / bild.naturalWidth : w * (0.42 + Math.random() * 0.2);
            return {
                bild,
                x: irgendwo ? Math.random() * (b + w) - w : -w * (1 + Math.random() * 0.6),
                y: h * (-0.15 + Math.random() * 1.0) - hh * 0.3, w, h: hh,
                tempo: b * (0.05 + gross * 0.12) * (0.8 + Math.random() * 0.5),     // px/s
                alpha: (0.65 + Math.random() * 0.35) * v.deck,
                spiegeln: Math.random() < 0.5,
                ein: performance.now(),        // sanft einblenden
            };
        }

        // Wolke, aus der ein Blitz kommt: eine sichtbare, sonst entsteht dort eine neue
        function blitzWolke(b, h) {
            const sichtbar = wolken.filter(wo => wo.x + wo.w * 0.5 > b * 0.04 && wo.x + wo.w * 0.5 < b * 0.96
                                              && wo.y + wo.h * 0.5 > 0 && wo.y + wo.h * 0.5 < h * 0.7);
            if (sichtbar.length) return sichtbar[Math.floor(Math.random() * sichtbar.length)];
            if (!sprites.length) return null;
            const wo = neueWolke(b, h, true);
            wo.x = b * (0.1 + Math.random() * 0.8) - wo.w / 2;
            wo.y = h * (Math.random() * 0.35) - wo.h * 0.5;
            wolken.push(wo);
            return wo;
        }

        // Ausgangspunkt im unteren Teil einer Wolke
        function wolkenPunkt(wo) {
            return [wo.x + wo.w * (0.3 + Math.random() * 0.4), wo.y + wo.h * (0.45 + Math.random() * 0.2)];
        }

        function strahl(b, h, lang, tiefe, dicke, liste) {
            const wo = blitzWolke(b, h);
            const [x0, y0] = wo ? wolkenPunkt(wo) : [b * Math.random(), h * Math.random() * 0.4];
            // meist nach unten, manchmal quer zur naechsten Wolke
            const w = Math.random() < 0.75 ? Math.PI / 2 + (Math.random() - 0.5) * 2.0 : Math.random() * Math.PI * 2;
            blitzBaum(x0, y0, x0 + Math.cos(w) * lang, y0 + Math.sin(w) * lang * 0.85, tiefe, liste, dicke);
        }

        // Verschiedene Aufleucht-Stufen: schwach, mittel, kraeftig, sehr hell
        function stufe(min) {
            const stufen = [0.35, 0.6, 0.85, 1.15];
            const i = Math.max(min || 0, Math.min(3, Math.floor(Math.random() * 2.2 + energie * 2.2)));
            return stufen[i] * (0.9 + Math.random() * 0.2);
        }

        function ausloesen(stark, jetzt, b, h, hell, extra) {
            // grosse hoechstens einmal pro Takt, sonst ein mittlerer (Testlauf: bis 78 grosse pro Minute)
            // (Testlauf 2: Herabstufen machte bis 114 mittlere pro Minute -> jetzt einfach weglassen)
            if (stark && !extra && jetzt - letzterGross < letzterTaktMs) return;
            if (!stark && jetzt - letzterMittel < letzterTaktMs / 2) return;      // mittlere hoechstens alle 2 Schlaege
            if (stark) { grossZahl++; letzterGross = jetzt; } else { mittelZahl++; letzterMittel = jetzt; }
            const liste = [];
            if (stark) {
                strahl(b, h, b * (0.55 + Math.random() * 0.5), 3, 1, liste);
                for (let i = 0; i < v.klein + (extra || 0); i++) strahl(b, h, b * (0.15 + Math.random() * 0.2), 2, 0.55, liste);
            } else {
                strahl(b, h, b * (0.2 + Math.random() * 0.25), 2, 0.6, liste);
            }
            for (const ast of liste) ast.zerfall = 0.15 + Math.random() * 0.35;
            const zentrum = liste[0].pfad[Math.floor(liste[0].pfad.length * 0.4)];
            blitze.push({ liste, x: zentrum[0], y: zentrum[1], t0: jetzt, stark, hell: hell || stufe(), radius: 0.75 + Math.random() * 0.6 });
        }

        // Foto-Blitz: nur das Foto (die Linien), sonst nichts. Blitzt auf, flackert zweimal (dasselbe Bild),
        // dann wischt es weich von oben nach unten weg - Abdunklung dahinter genau gleich
        function fotoSicht(ms) {
            const delle = (m, tief, br) => Math.max(0, 1 - Math.abs(ms - m) / br) * tief;
            return Math.max(0, 1 - delle(105, 0.75, 40) - delle(235, 0.6, 45));
        }
        const FOTO_WEG_AB = 800, FOTO_WEG_MS = 1150;          // 0,8 s stehen (Betreiber 23.10.), dann wegwischen
        const arbeit2 = document.createElement('canvas'), ag2 = arbeit2.getContext('2d');
        function fotoWisch(k, w, hh, sichtbar, auf) {
            if (auf <= 0) return;
            const rand = sichtbar * 0.18, kante = (sichtbar + 2 * rand) * auf - rand;
            const verlauf = k.createLinearGradient(0, kante - rand, 0, kante + rand);
            verlauf.addColorStop(0, 'rgba(0,0,0,0)');
            verlauf.addColorStop(1, 'rgba(0,0,0,1)');
            k.globalCompositeOperation = 'destination-in';
            k.fillStyle = verlauf;
            k.fillRect(0, 0, w, hh);
            k.globalCompositeOperation = 'source-over';
        }
        function fotoEbene(c, k, bild, w, hh, spiegeln) {
            if (c.width < w || c.height < hh) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, hh); }
            k.globalCompositeOperation = 'source-over';
            k.globalAlpha = 1;
            k.clearRect(0, 0, c.width, c.height);
            k.save();
            if (spiegeln) { k.translate(w, 0); k.scale(-1, 1); }
            k.drawImage(bild, 0, 0, w, hh);
            k.restore();
        }
        function fotoZeichnen(bl, ms) {
            if (!bl.foto.voll) return;
            const weich01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
            const auf = weich01((ms - FOTO_WEG_AB) / FOTO_WEG_MS);
            if (auf >= 1) return;
            const sicht = fotoSicht(ms) * Math.min(1, bl.hell);
            const w = bl.fw, hh = bl.fh, dreh = bl.winkel || 0;
            const sichtbar = Math.min(hh, Math.max(1, (cv.height - bl.fy) / Math.cos(dreh)));
            // ins Bild setzen: um den Startpunkt (bl.x, bl.y) gedreht
            const setzen = (k, quelle) => {
                k.translate(bl.x, bl.y);
                k.rotate(dreh);
                k.drawImage(quelle, 0, 0, w, hh, bl.fx - bl.x, bl.fy - bl.y, w, hh);
            };
            // Abdunklung (Wolken-Ebene, normal)
            fotoEbene(arbeit2, ag2, bl.foto.schatten, w, hh, bl.spiegeln);
            fotoWisch(ag2, w, hh, sichtbar, auf);
            gw.save();
            gw.globalAlpha = 0.95 * Math.max(sicht, 0.6);              // beim Flackern bleibt es dunkel
            setzen(gw, arbeit2);
            gw.restore();
            // Wolken leuchten auf: die Wolke am Blitz sehr hell, alle anderen am Himmel etwas
            // Foto-Blitze lassen die Wolken am staerksten aufleuchten (Betreiber 23.10.); bei mehreren
            // zugleich anteilig, damit es sich nicht zu Weiss aufaddiert
            const fotoZahlJetzt = blitze.filter(x => x.foto).length || 1;
            const hell = sicht * (1 - auf) / Math.sqrt(fotoZahlJetzt);
            if (hell > 0.02 && maske.width > 1) {
                const lb = licht.width, lh = licht.height, lx = (bl.wolke ? bl.wolke.x + bl.wolke.w / 2 : bl.x) / 2, ly = bl.y / 2;
                lg2.globalCompositeOperation = 'source-over';
                lg2.clearRect(0, 0, lb, lh);
                lg2.fillStyle = 'rgba(190,215,255,' + (0.3 * hell) + ')';
                lg2.fillRect(0, 0, lb, lh);
                const kg = lg2.createRadialGradient(lx, ly, 0, lx, ly, Math.max(lb, lh) * 0.42);
                kg.addColorStop(0, 'rgba(240,248,255,' + Math.min(1, 1.6 * hell) + ')');
                kg.addColorStop(0.5, 'rgba(205,228,255,' + Math.min(1, 0.85 * hell) + ')');
                kg.addColorStop(1, 'rgba(0,0,0,0)');
                lg2.fillStyle = kg;
                lg2.fillRect(0, 0, lb, lh);
                lg2.globalCompositeOperation = 'destination-in';
                lg2.drawImage(maske, 0, 0);
                g.save();
                g.globalCompositeOperation = 'lighter';
                g.drawImage(licht, 0, 0, cv.width, cv.height);
                g.restore();
            }
            // das Pult leuchtet mit (Betreiber 23.10.): ganzes Bild kurz heller, rund um den Blitz deutlich -
            // im Takt mit dem Flackern des Blitzes; die Licht-Ebene liegt mit "screen" ueber dem Pult
            if (hell > 0.02) {
                const px = bl.x - Math.sin(dreh) * hh * 0.45, py = bl.y + Math.cos(dreh) * hh * 0.45, pr = Math.max(cv.width, cv.height) * 0.55;   // Mitte des (gedrehten) Blitzes
                g.save();
                g.globalCompositeOperation = 'lighter';
                g.fillStyle = 'rgba(170,195,235,' + (0.16 * hell) + ')';     // ganzes Pult (Betreiber: deutlich sichtbar)
                g.fillRect(0, 0, cv.width, cv.height);
                const pg = g.createRadialGradient(px, py, 0, px, py, pr);
                pg.addColorStop(0, 'rgba(215,232,255,' + Math.min(0.85, 0.75 * hell) + ')');
                pg.addColorStop(0.5, 'rgba(160,190,240,' + (0.3 * hell) + ')');
                pg.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = pg;
                g.fillRect(0, 0, cv.width, cv.height);
                g.restore();
            }
            // der Blitz selbst (Licht-Ebene)
            fotoEbene(arbeit, ag, bl.foto.voll, w, hh, bl.spiegeln);
            fotoWisch(ag, w, hh, sichtbar, auf);
            g.save();
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = sicht;
            setzen(g, arbeit);
            g.restore();
        }

        // kleiner, kurzer Blitz (Melodie): ein Ast mit wenig Verzweigung, eher schwach
        function kleinerBlitz(jetzt, b, h) {
            const liste = [];
            strahl(b, h, b * (0.06 + Math.random() * 0.09), 1, 0.4, liste);
            for (const ast of liste) ast.zerfall = 0.3 + Math.random() * 0.4;
            const z = liste[0].pfad[0];
            blitze.push({ liste, x: z[0], y: z[1], t0: jetzt, stark: false, hell: 0.3 + Math.random() * 0.25, radius: 0.45 });
        }

        // grosser Foto-Blitz: von oben nach unten ueber den Bildschirm, zufaellig gespiegelt
        function fotoBlitz(jetzt, b, h, hell, nr, seite) {
            fotoZahl++;
            const fertig = fotos.filter(im => im.voll);
            if (!fertig.length) return;
            const bild = fertig[nr % fertig.length];
            const mass = fotoMass(bild.naturalWidth, bild.naturalHeight, b, h);
            let w = bild.voll ? bild.voll.width : bild.naturalWidth * mass, hh = bild.voll ? bild.voll.height : bild.naturalHeight * mass;
            // kommt oben aus einer Wolke, links oder rechts neben dem Videofenster (Betreiber 23.10.)
            w = Math.round(w); hh = Math.round(hh);
            const spiegeln = Math.random() < 0.5, ox = spiegeln ? 1 - bild.obenX : bild.obenX;
            const links = seite ? seite === 'links' : Math.random() < 0.5;   // zwei zugleich: je eine Seite
            // Drehung um den Startpunkt: von senkrecht bis liegend, immer zur Bildmitte hin geneigt
            const winkel = Math.random() * 1.5 * (links ? -1 : 1), liegend = Math.abs(winkel) > 0.8;
            // stark geneigt: am Bildrand unterhalb des Videofensters ansetzen, damit er frei quer ueber
            // das Pult geht (ueber dem Videofenster wird er ausgeblendet)
            const ziel = b * (liegend ? (links ? 0.02 + Math.random() * 0.12 : 0.86 + Math.random() * 0.12)
                                      : (links ? 0.06 + Math.random() * 0.24 : 0.7 + Math.random() * 0.24));
            const y0 = h * (liegend ? 0.52 + Math.random() * 0.18 : 0.05 + Math.random() * 0.06);
            const x = Math.round(Math.max(0, Math.min(b - w, ziel - ox * w))), mx = x + ox * w;
            const y = Math.round(y0 - hh * 0.01);
            let wolke = null;
            if (sprites.length) {
                // eine Wolke genau dort, der Blitz tritt unten aus ihr heraus
                wolke = neueWolke(b, h, true);
                const k = b * (0.26 + Math.random() * 0.1) / wolke.w;
                wolke.w *= k; wolke.h *= k;
                wolke.x = mx - wolke.w * (0.45 + Math.random() * 0.1);
                wolke.y = y0 - wolke.h * 0.62;
                wolke.alpha = Math.max(wolke.alpha, 0.95);
                wolke.tempo *= 0.3;                                      // bleibt ueber dem Blitz
                wolke.ein = performance.now() - 1500;
                wolke.fest = performance.now() + FOTO_WEG_AB + FOTO_WEG_MS + 300;                       // bleibt, bis der Blitz weg ist
                wolken.push(wolke);
            }
            blitze.push({ liste: [], foto: bild, fx: x, fy: y, fw: w, fh: hh, spiegeln, wolke, winkel,
                          oben: y, unten: y + hh, x: mx, y: y0, t0: jetzt, stark: true, hell, radius: 1.1 });
        }

        function leuchten(jetzt, b, h, hell) {
            const wo = blitzWolke(b, h);
            const [lx, ly] = wo ? wolkenPunkt(wo) : [b * Math.random(), h * Math.random() * 0.8];
            blitze.push({ liste: [], x: lx, y: ly, t0: jetzt, stark: Math.random() < 0.4,
                          hell: hell || stufe() * 0.8, radius: 0.6 + Math.random() * 0.9 });
        }

        function zeichnen(jetzt) {
            if (aus || !cv.isConnected) return;
            requestAnimationFrame(zeichnen);
            const dt = Math.min(0.1, (jetzt - letzteZeit) / 1000);
            letzteZeit = jetzt;
            const pr = Math.min(1, global.devicePixelRatio || 1);
            const b = Math.max(1, Math.round(cv.clientWidth * pr)), h = Math.max(1, Math.round(cv.clientHeight * pr));
            if (cv.width !== b || cv.height !== h) {
                cv.width = cw.width = b; cv.height = cw.height = h;
                maske.width = licht.width = b >> 1;
                maske.height = licht.height = h >> 1;
                wolken.length = 0;
            }
            if (!wolken.length && sprites.length) for (let i = 0; i < v.wolken; i++) wolken.push(neueWolke(b, h, true));
            // ---- Musik lesen ----
            const p = Math.max(0, Math.min(1, pegelLesen() || 0));
            const bs = Math.max(0, Math.min(1, bassLesen() || 0));
            schnell += (p - schnell) * 0.35;
            langsam += (p - langsam) * 0.02;
            energie += (p - energie) * 0.05;
            bassSchnell += (bs - bassSchnell) * 0.45;
            ruhe += ((p < 0.45 && bs < 0.35 ? 1 : 0) - ruhe) * 0.004;     // wie lange es schon ruhig war (~4 s)
            const ml = Math.max(0, Math.min(1, melodieLesen() || 0));
            melSchnell += (ml - melSchnell) * 0.5;
            melLangsam += (ml - melLangsam) * 0.03;
            melMax = Math.max(melSchnell, melMax * 0.9995, 0.05);           // lautester Melodieteil des Songs (~30 s Gedaechtnis)
            melVerlauf.push(melSchnell);
            if (melVerlauf.length > 9) melVerlauf.shift();                  // ~150 ms
            // Bass im Verhaeltnis zum Song (Testlauf 23.10. mit 24 Songs: mit festen Grenzen kamen leise
            // Bass-Songs nie in "voll", andere loesten bei fast jedem Schlag einen Drop aus)
            bassMax = Math.max(bassSchnell, bassMax * 0.9997, 0.1);         // lautester Bass des Songs (~50 s Gedaechtnis)
            const bassRel = bassSchnell / bassMax;
            bassPause += ((bs / bassMax < 0.3 ? 1 : 0) - bassPause) * 0.004;  // wie lange schon kaum Bass (Aufbau vor dem Drop)
            bassVerlauf.push(bassSchnell);
            if (bassVerlauf.length > 12) bassVerlauf.shift();               // ~200 ms
            const tk = taktLesen();
            const taktMs = tk && tk.bpm ? 4 * 60000 / tk.bpm : 2000;
            const schlagMs = taktMs / 4;
            // Schlag aus dem Taktraster (gemessener Takt oder Tempo der Spur): neuer Schlag erreicht?
            const schlagNr = tk && tk.bpm ? Math.floor(tk.schlag) : null;
            schlagJetzt = tk && tk.bpm ? tk.schlag : null;                     // fuer die Testauswertung
            const neuerSchlag = schlagNr !== null && letzterSchlag !== null && schlagNr === letzterSchlag + 1;
            letzterSchlag = schlagNr;
            letzterTaktMs = taktMs;
            // Bassschlag: der Bass springt binnen ~200 ms deutlich hoch (Kick/Drop)
            const bassSprung = (bassSchnell - Math.min(...bassVerlauf)) / bassMax;
            const bassSchlag = bassRel > 0.55 && bassSprung > v.akzent * 1.5 && jetzt - letzter > schlagMs * 0.8;
            // Akzent ohne Bass (anderer Klangwechsel): Pegel springt deutlich ueber den Schnitt
            const akzent = schnell > langsam * 1.45 + 0.05 && bassRel < 0.45 && jetzt - letzter > taktMs;
            // Drop: aus der gemessenen Spur vorab berechnet (genau auf den Einsatz); ohne Spur aus dem Bass geraten
            const dr = dropsLesen();
            let dropJetzt = false, dropIn = Infinity, refrainJetzt = false;
            if (dr) {
                const vorbei = liste => dropPos !== null && dr.pos > dropPos && dr.pos - dropPos < 1.5
                    && liste.some(t => t > dropPos && t <= dr.pos);
                dropJetzt = vorbei(dr.drops);
                refrainJetzt = vorbei(dr.refrains || []);
                for (const t of [...dr.drops, ...(dr.refrains || [])]) if (t > dr.pos) dropIn = Math.min(dropIn, t - dr.pos);
                dropPos = dr.pos;
            } else {
                dropJetzt = bassSchlag && bassRel > 0.7 && (ruhe > 0.5 || bassPause > 0.6) && jetzt - letzterDrop > 30000;
            }
            if (!halten && p > 0.05) {
                if (dropJetzt) {
                    letzterDrop = jetzt;
                    // Drop: nach ruhigerem Teil setzt der Bass ein -> grosser Blitzschlag, 8 Takte voll
                    modus = 'voll'; modusBis = jetzt + 8 * taktMs; ruhe = 0; bassPause = 0;
                    if (fotos.some(im => im.voll)) {
                        // Drop mit Foto-Blitzen: meist zwei zugleich (links und rechts), dazu ein kleiner gerechneter
                        const nr = Math.floor(Math.random() * fotos.length), seite = Math.random() < 0.5 ? 'links' : 'rechts';
                        fotoBlitz(jetzt, b, h, stufe(3), nr, seite);
                        if (Math.random() < 0.7) fotoBlitz(jetzt, b, h, stufe(2), nr + 1, seite === 'links' ? 'rechts' : 'links');
                        ausloesen(false, jetzt, b, h, stufe(1));
                    } else {
                        ausloesen(true, jetzt, b, h, stufe(3), 2);
                        ausloesen(true, jetzt, b, h, stufe(2), 0);
                    }
                    letzter = jetzt;
                } else if (refrainJetzt && fotos.some(im => im.voll)) {
                    // Refrain setzt ein (hoechstens einmal pro Minute, aus der Spur): Foto-Blitz, manchmal zwei
                    modus = 'voll'; modusBis = jetzt + 8 * taktMs;
                    const nr = Math.floor(Math.random() * fotos.length), seite = Math.random() < 0.5 ? 'links' : 'rechts';
                    fotoBlitz(jetzt, b, h, stufe(2), nr, seite);
                    if (Math.random() < 0.4) fotoBlitz(jetzt, b, h, stufe(2), nr + 1, seite === 'links' ? 'rechts' : 'links');
                    letzter = jetzt;
                } else if (modus === 'voll' && (schlagNr !== null ? neuerSchlag && bassRel > 0.3 : bassSchlag)) {
                    // im vollen Teil (Betreiber 23.10.): mit Taktraster genau auf den Schlaegen - grosse bevorzugt
                    // auf den betonten Schlaegen 1 und 3, mittlere auf den anderen; ohne Raster auf den Bassschlaegen
                    const betont = schlagNr !== null ? schlagNr % 2 === 0 : bassSprung > v.akzent * 1.6;
                    if (betont && bassRel > 0.7 && Math.random() < 0.45) ausloesen(true, jetzt, b, h, stufe(1));
                    else if (Math.random() < 0.5) ausloesen(false, jetzt, b, h, stufe(1));
                    else if (Math.random() < 0.3) leuchten(jetzt, b, h);
                    letzter = jetzt;
                } else if (bassSchlag && bassSprung > v.akzent * 2.2 && bassRel > 0.8 && dichteZiel > 0.6) {
                    // sehr kraeftiger Bassschlag in lautem Teil: auch ohne Drop voll mitgehen
                    modus = 'voll'; modusBis = jetzt + 8 * taktMs;
                    ausloesen(true, jetzt, b, h, stufe(2));
                    letzter = jetzt;
                } else if (akzent && modus !== 'voll') {
                    // anderer Klangwechsel: 8 Takte vereinzelt schwaechere Blitze
                    if (modus !== 'mittel') { modus = 'mittel'; modusBis = jetzt + 8 * taktMs; }
                    if (Math.random() < 0.7) ausloesen(false, jetzt, b, h, stufe() * 0.85);
                    else leuchten(jetzt, b, h, 0.4);
                    letzter = jetzt;
                }
            }
            // im Takt: alle 2 Takte auf der Eins ein grosser (voll) bzw. mittlerer (Aufbau) Blitz
            if (!halten && p > 0.05 && modus !== 'ruhig' && dichteZiel > 0.4) {
                const taktNr = tk && tk.bpm ? Math.floor(tk.schlag / 4) : Math.floor(jetzt / taktMs);
                if (taktNr !== letzterTakt && (schlagNr === null || neuerSchlag)) {
                    letzterTakt = taktNr;
                    if (taktNr % 2 === 0 && jetzt - letzter > schlagMs) {
                        if (modus === 'voll') ausloesen(true, jetzt, b, h, stufe(2));
                        else ausloesen(false, jetzt, b, h, stufe(1));
                        letzter = jetzt;
                    }
                }
            }
            // Melodie: neue Note/Phrase in Mitten und Hoehen -> kleiner Blitz aus einer Wolke
            const melSprung = melSchnell - Math.min(...melVerlauf);
            if (!halten && p > 0.05 && melSchnell > melMax * 0.45 && melSprung > melMax * 0.22 && melSchnell > melLangsam * 1.1
                && jetzt - letzteMelodie > schlagMs * 2.5 && jetzt - letzter > 150) {
                kleinerBlitz(jetzt, b, h); kleineZahl++;
                letzteMelodie = jetzt;
            }
            if (jetzt > modusBis) modus = 'ruhig';
            if (!halten && modus === 'ruhig' && jetzt - letzter > 12000 + Math.random() * 8000) {
                leuchten(jetzt, b, h, 0.3);                // ruhiger Teil: selten ein leises Wetterleuchten
                letzter = jetzt;
            }
            // ---- Wolken: einzelne, verschiedene, ziehen nach rechts ----
            gw.clearRect(0, 0, b, h);
            mg.clearRect(0, 0, maske.width, maske.height);
            const dichter = modus === 'voll' ? 1.1 : 1;
            // wenn die Nummer in Fahrt kommt: mehr Wolken (neue blenden irgendwo sanft ein)
            // Wolkenmenge nach der Spannung des Songs (Betreiber 23.10.): ruhig = fast keine Wolken,
            // spitzt sich das Lied zu, sind sie rechtzeitig wieder da - dafuer schaut die Spur ~6 s voraus
            if (jetzt - dichteZeit > 200) {
                dichteZeit = jetzt;
                const sp = spannungLesen();
                const roh = sp ? Math.max(sp.jetzt, sp.voraus) : Math.max(energie, schnell);
                dichteZiel = Math.max(0, Math.min(1, (roh - 0.5) / 0.4));
                if (dropIn < 4.5) dichteZiel = 1;                                // Drop/Refrain kommt: Wolken 4 s vorher da
            }
            // schnell aufbauen (~2 s), langsamer abbauen (~4 s)
            dichte += (dichteZiel - dichte) * (dichteZiel > dichte ? 0.03 : 0.012);
            // ruhig: Wolken bleiben (fuer die kleinen Blitze), nur weniger und blass (Betreiber 23.10.)
            const ziel = Math.max(1, Math.round(v.wolken * (0.7 + 0.3 * dichte) * (modus === 'voll' ? 1.3 : modus === 'mittel' ? 1.15 : 1)));
            const sichtbar = wo => !wo.weg && (!wo.fest || jetzt > wo.fest);
            const aktiv = wolken.filter(wo => !wo.weg).length;
            if (sprites.length && aktiv < ziel && jetzt - wolkeDazu > 150) {
                wolken.push(neueWolke(b, h, true));                       // blendet irgendwo sanft ein
                wolkeDazu = jetzt;
            } else if (aktiv > ziel && jetzt - wolkeWeg > 250) {
                const kandidat = wolken.find(sichtbar);                   // eine zu viel: sanft ausblenden
                if (kandidat) kandidat.weg = jetzt;
                wolkeWeg = jetzt;
            }
            const deckung = 0.3 + 0.7 * dichte;                            // ruhig: auch blasser
            for (let i = wolken.length - 1; i >= 0; i--) {
                const wo = wolken[i];
                wo.x += wo.tempo * dt * (modus === 'voll' ? 1.25 : 1);
                const aus = wo.weg ? 1 - (jetzt - wo.weg) / 1500 : 1;
                if (aus <= 0) { wolken.splice(i, 1); continue; }
                if (wo.x > b) {
                    if (wolken.filter(x => !x.weg).length > ziel) wolken.splice(i, 1);
                    else wolken[i] = neueWolke(b, h, false);
                    continue;
                }
                const sicht = Math.min(1, wo.alpha * dichter) * Math.min(1, (jetzt - wo.ein) / 1500) * aus
                    * (wo.fest && jetzt < wo.fest ? 1 : deckung);              // Wolke am Foto-Blitz bleibt voll
                gw.save();
                gw.globalAlpha = sicht;
                if (wo.spiegeln) { gw.translate(wo.x + wo.w, wo.y); gw.scale(-1, 1); gw.drawImage(wo.bild, 0, 0, wo.w, wo.h); }
                else gw.drawImage(wo.bild, wo.x, wo.y, wo.w, wo.h);
                gw.restore();
                mg.globalAlpha = sicht;
                mg.drawImage(wo.bild, wo.x / 2, wo.y / 2, wo.w / 2, wo.h / 2);
            }
            mg.globalAlpha = 1;
            gw.globalAlpha = 1;
            // ---- Licht und Blitze ----
            g.globalCompositeOperation = 'source-over';
            g.clearRect(0, 0, b, h);
            for (let i = blitze.length - 1; i >= 0; i--) {
                const bl = blitze[i], ms = jetzt - bl.t0, s = halten ? 0.9 : blitzStaerkeLang(ms);
                if (!halten && ms > (bl.foto ? FOTO_WEG_AB + FOTO_WEG_MS : BLITZ_LANG_MS)) { blitze.splice(i, 1); continue; }
                if (s <= 0 && !bl.foto) continue;
                if (bl.foto) { fotoZeichnen(bl, halten ? (typeof halten === "number" ? halten : 100) : ms); continue; }   // Foto: kein Zusatzlicht
                const st = s * bl.hell * v.licht;
                const r = Math.max(b, h) * (bl.stark ? 0.28 : 0.17) * (bl.radius || 1);
                g.globalCompositeOperation = 'lighter';
                const lg = g.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, r);
                lg.addColorStop(0, `rgba(170,205,255,${0.55 * st})`);
                lg.addColorStop(0.5, `rgba(90,130,210,${0.16 * st})`);
                lg.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = lg;
                g.fillRect(0, 0, b, h);
                // die Wolken rund um den Blitz leuchten von hinten auf: Glanz nur, wo Wolken sind
                lg2.clearRect(0, 0, licht.width, licht.height);
                lg2.globalCompositeOperation = 'source-over';
                const kg = lg2.createRadialGradient(bl.x / 2, bl.y / 2, 0, bl.x / 2, bl.y / 2, r * 0.75);
                kg.addColorStop(0, `rgba(215,232,255,${Math.min(1, st * 1.4)})`);
                kg.addColorStop(1, 'rgba(0,0,0,0)');
                lg2.fillStyle = kg;
                lg2.fillRect(0, 0, licht.width, licht.height);
                lg2.globalCompositeOperation = 'destination-in';
                lg2.drawImage(maske, 0, 0);
                g.drawImage(licht, 0, 0, b, h);
                // Strahlen; Aufloesen von oben nach unten, schmaler werdend, von Weiss ins Blaue
                const zer = halten ? 0 : Math.max(0, Math.min(1, (ms - 320) / (BLITZ_LANG_MS - 320)));
                if (bl.oben === undefined) {
                    bl.oben = Infinity; bl.unten = -Infinity;
                    for (const ast of bl.liste) for (const pt of ast.pfad) { bl.oben = Math.min(bl.oben, pt[1]); bl.unten = Math.max(bl.unten, pt[1]); }
                }
                const kante = bl.oben + (bl.unten - bl.oben + 2) * Math.pow(zer, 0.8);
                if (bl.foto) {
                    fotoZeichnen(bl, halten ? (typeof halten === "number" ? halten : 100) : ms);
                    continue;
                }
                g.lineCap = 'round';
                g.lineJoin = 'round';
                for (const ast of bl.liste) {
                    const weg = Math.min(1, zer * (1 + ast.zerfall * 0.5));
                    let pfad = [ast.pfad];
                    if (zer > 0) {
                        pfad = [];
                        let lauf = [];
                        for (const pt of ast.pfad) {
                            if (pt[1] >= kante) lauf.push(pt);
                            else { if (lauf.length > 1) pfad.push(lauf); lauf = []; }
                        }
                        if (lauf.length > 1) pfad.push(lauf);
                        if (!pfad.length) continue;
                    }
                    const schmal = 1 - weg * 0.6;
                    const rot = Math.round(250 - weg * 120), gruen = Math.round(252 - weg * 70);
                    g.strokeStyle = `rgba(140,185,255,${0.28 * s * ast.dicke})`;
                    g.lineWidth = (bl.stark ? 18 : 12) * ast.dicke * schmal * pr;
                    linie(g, pfad);
                    g.strokeStyle = `rgba(190,220,255,${0.5 * s * ast.dicke})`;
                    g.lineWidth = (bl.stark ? 7 : 5) * ast.dicke * schmal * pr;
                    linie(g, pfad);
                    g.strokeStyle = `rgba(${rot},${gruen},255,${Math.min(1, s * (0.6 + ast.dicke))})`;
                    g.lineWidth = Math.max(0.8, (bl.stark ? 4.2 : 2.8) * ast.dicke * schmal) * pr;
                    linie(g, pfad);
                }
            }
            g.globalCompositeOperation = 'source-over';
            // freie Bereiche (Videofenster): weder Wolken noch Blitze
            const fx = b / 1672, fy = h / 941;
            for (const [x, y, w, hh] of frei) {
                g.clearRect(x * fx, y * fy, w * fx, hh * fy);
                gw.clearRect(x * fx, y * fy, w * fx, hh * fy);
            }
            for (const [x, y, w, hh] of wolkenFrei) gw.clearRect(x * fx, y * fy, w * fx, hh * fy);
        }
        requestAnimationFrame(zeichnen);
        const steuerung = () => { aus = true; cv.remove(); cw.remove(); };
        steuerung.blitz = (stark) => {
            const b = cv.width, h = cv.height;
            if (b > 1) ausloesen(stark !== false, performance.now(), b, h);
        };
        steuerung.zeitlupe = (faktor) => {
            steuerung.fotoBlitz();
            const start = performance.now(), f = faktor || 5;
            const lauf = () => {
                const ms = (performance.now() - start) / f;
                if (ms > FOTO_WEG_AB + FOTO_WEG_MS) { halten = false; blitze.length = 0; return; }
                halten = Math.max(1, ms);
                requestAnimationFrame(lauf);
            };
            lauf();
        };
        steuerung.fotoBlitz = (nr) => { if (fotos.length && cv.width > 1) { fotoBlitz(performance.now(), cv.width, cv.height, 1, nr === undefined ? Math.floor(Math.random() * fotos.length) : nr); return blitze[blitze.length - 1]; } };
        steuerung.halten = an => { halten = typeof an === "number" ? an : !!an; if (!an) blitze.length = 0; };   // Zahl: Foto-Blitz bei dieser ms zeigen
        steuerung.zustand = () => ({ modus, schlag: schlagJetzt, bass: +bassSchnell.toFixed(2), bassRel: +(bassSchnell / bassMax).toFixed(2), energie: +energie.toFixed(2), ruhe: +ruhe.toFixed(2), dichte: +dichte.toFixed(2), dichteZiel: +dichteZiel.toFixed(2), bassPause: +bassPause.toFixed(2), melodie: +melSchnell.toFixed(2), melMax: +melMax.toFixed(2), kleine: kleineZahl, gross: grossZahl, mittel: mittelZahl, fotos: fotos.length, fotosBereit: fotos.filter(im => im.voll).length, fotoBlitze: fotoZahl, wolken: wolken.length, blitze: blitze.length });
        return steuerung;
    }

    global.gewitterStarten = gewitterStarten;
    global.gewitterBuehne = gewitterBuehne;
})(window);
