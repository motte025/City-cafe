// Wellenformen aus den vorab berechneten Faechern (analysis.js).
// Detail: mitlaufend, Abspielkopf in der Mitte, Taktraster/Cue/Loop.
// Uebersicht: ganzer Titel, einmal vorgezeichnet, je Frame nur Kopf und Marken.

import { leinwand } from './meter.js';

const FARBEN = {
  A: { tief: [0, 55, 235], mitte: [20, 135, 255], hoch: [200, 235, 255] },
  B: { tief: [235, 70, 0], mitte: [255, 150, 20], hoch: [255, 238, 200] },
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function spalte(wf, b0, b1) {
  b0 = Math.max(0, Math.floor(b0)); b1 = Math.min(wf.faecher, Math.ceil(b1));
  if (b1 <= b0) return null;
  let sp = 0, t = 0, m = 0, h = 0;
  for (let b = b0; b < b1; b++) {
    if (wf.spitze[b] > sp) sp = wf.spitze[b];
    if (wf.tief[b] > t) t = wf.tief[b];
    if (wf.mitte[b] > m) m = wf.mitte[b];
    if (wf.hoch[b] > h) h = wf.hoch[b];
  }
  return { sp, t, m, h };
}

// Wie spalte(), aber auch fuer Bereiche kleiner als ein Fach (gezoomt): dann das naechste Fach
function spalteFein(wf, b0, b1) {
  if (b1 - b0 >= 1) return spalte(wf, b0, b1);
  const b = Math.min(wf.faecher - 1, Math.max(0, Math.floor(b0)));
  return { sp: wf.spitze[b], t: wf.tief[b], m: wf.mitte[b], h: wf.hoch[b] };
}

function zeichneSpalte(g, x, mitteY, H, s, farben, breite) {
  const hs = Math.min(1, s.sp) * H;
  const ht = Math.min(1, s.t * 2.3) * H;
  const hm = Math.min(1, (s.m * 2.6 + s.h * 1.5)) * H;
  const hh = Math.min(1, s.h * 4.2) * H;
  g.fillStyle = rgba(farben.tief, 0.75); g.fillRect(x, mitteY - hs, breite, hs * 2);
  const hmt = Math.max(ht, hm) * 0.8;
  g.fillStyle = rgba(farben.mitte, 0.55); g.fillRect(x, mitteY - hmt, breite, hmt * 2);
  g.fillStyle = rgba(farben.hoch, 0.6); g.fillRect(x, mitteY - hh * 0.55, breite, hh * 1.1);
}

// TV-Ansicht (echte, laut gemasterte Titel), wie Rekordbox/Serato: je Bildschirmpixel ein
// Strich in Spitzenhoehe, gefaerbt nach dem Verhaeltnis Bass/Mitte/Hoehen, darin ein hellerer
// Kern fuer die Lautheit. Keine Glaettung - die Feinheit kommt aus den Spitzen (5 ms).
const TV = () => document.body.classList.contains('tv');
function zeichneTv(g, spalten, mitteY, H, farben) {
  for (let x = 0; x < spalten.length; x++) {
    const s = spalten[x];
    if (!s) continue;
    const t = s.t * 1.7, m = s.m * 1.9, h = s.h * 3.2, summe = t + m + h || 1;
    const f = [0, 1, 2].map(i => Math.round((farben.tief[i] * t + farben.mitte[i] * m + farben.hoch[i] * h) / summe));
    const hs = Math.min(1, s.sp) * H;
    g.fillStyle = `rgba(${f[0]},${f[1]},${f[2]},0.85)`;
    g.fillRect(x, mitteY - hs, 1, hs * 2);
    const kern = Math.min(hs, Math.min(1, Math.sqrt(s.t * s.t + s.m * s.m + s.h * s.h) * 1.6) * H);
    g.fillStyle = `rgba(${f.map(v => Math.round(v + (255 - v) * 0.45)).join(',')},0.9)`;
    g.fillRect(x, mitteY - kern, 1, kern * 2);
  }
}

function hinweis(g, w, h, text) {
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.font = `${Math.round(h * 0.16)}px "Barlow Condensed", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
}

export class DetailWelle {
  constructor(canvas, deck) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.farben = FARBEN[deck];
    this.zoom = TV() ? 6 : 8;   // sichtbare Sekunden (TV: enger, mehr Detail)
  }
  zoomen(f) { this.zoom = Math.min(32, Math.max(2, this.zoom * f)); }

  zeichnen(d) {
    const { w, h } = leinwand(this.c);
    const g = this.g;
    g.clearRect(0, 0, w, h);
    const tr = d.track;
    if (!tr) return hinweis(g, w, h, 'KEIN TITEL GELADEN');
    if (!tr.wf) return hinweis(g, w, h, tr.wfHinweis || 'WAVEFORM NICHT VERFÜGBAR');
    const wf = tr.wf, mitteY = h / 2, H = h * 0.46;
    const sekProPx = this.zoom / w;
    const t0 = d.pos - this.zoom / 2;
    const schritt = Math.max(1, Math.round((window.devicePixelRatio || 1)));
    // Loop-Bereich
    if (d.loop.ende > d.loop.start) {
      const x0 = (d.loop.start - t0) / sekProPx, x1 = (d.loop.ende - t0) / sekProPx;
      g.fillStyle = d.loop.an ? 'rgba(52,227,106,.20)' : 'rgba(52,227,106,.08)';
      g.fillRect(x0, 0, x1 - x0, h);
    } else if (d.loop.start > 0 && !d.loop.an) {
      const x0 = (d.loop.start - t0) / sekProPx;
      g.fillStyle = 'rgba(52,227,106,.7)'; g.fillRect(x0, 0, 2, h);
    }
    const tv = TV();
    g.globalCompositeOperation = tv ? 'source-over' : 'lighter';
    if (tv) {
      const spalten = new Array(Math.ceil(w));
      for (let x = 0; x < w; x++) {
        const t = t0 + x * sekProPx;
        spalten[x] = t < 0 || t > wf.dauer ? null : spalteFein(wf, t * wf.proSek, (t + sekProPx) * wf.proSek);
      }
      zeichneTv(g, spalten, mitteY, H, this.farben);
    } else for (let x = 0; x < w; x += schritt) {
      const t = t0 + x * sekProPx;
      if (t < 0 || t > wf.dauer) continue;
      const s = spalte(wf, t * wf.proSek, (t + sekProPx * schritt) * wf.proSek);
      if (s) zeichneSpalte(g, x, mitteY, H, s, this.farben, schritt);
    }
    if (!tv && (this.glanz ??= !!this.c.closest('.skin'))) {
      // Bild-2-Optik: weicher Schein um die Welle (Kopie unscharf darueberlegen)
      g.save();
      g.filter = `blur(${Math.round(h * 0.035)}px)`;
      g.globalAlpha = 0.8;
      g.drawImage(this.c, 0, 0);
      g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    // Taktraster
    if (tr.grid && d.beatgrid) {
      const b = 60 / tr.grid.bpm;
      const k0 = Math.ceil((t0 - tr.grid.offset) / b), k1 = Math.floor((t0 + this.zoom - tr.grid.offset) / b);
      for (let k = k0; k <= k1; k++) {
        const x = (tr.grid.offset + k * b - t0) / sekProPx;
        const takt = k % 4 === 0;
        g.fillStyle = takt ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.16)';
        g.fillRect(Math.round(x), 0, takt ? 2 : 1, h);
        if (takt) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(Math.round(x) - 3, 0, 8, 4); }
      }
    }
    // Cue
    const cx = (d.cue - t0) / sekProPx;
    if (cx >= -10 && cx <= w + 10) {
      g.fillStyle = '#ff8a00';
      g.beginPath(); g.moveTo(cx - 7, 0); g.lineTo(cx + 7, 0); g.lineTo(cx, 10); g.closePath(); g.fill();
      g.fillRect(cx - 1, 0, 2, h);
    }
    // Abspielkopf
    const px = Math.round(w / 2);
    g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 8;
    g.fillStyle = '#ffffff'; g.fillRect(px - 1, 0, 3, h);
    g.shadowBlur = 0;
  }
}

export class UebersichtWelle {
  constructor(canvas, deck) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.farben = FARBEN[deck];
    this.vorlage = null; this.fuer = null;
  }
  vorzeichnen(tr, w, h) {
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const g = off.getContext('2d');
    const wf = tr.wf, mitteY = h / 2, H = h * 0.48;
    const tv = TV();
    g.globalCompositeOperation = tv ? 'source-over' : 'lighter';
    if (tv) zeichneTv(g, Array.from({ length: w }, (_, x) => spalte(wf, x / w * wf.faecher, (x + 1) / w * wf.faecher)), mitteY, H, this.farben);
    else for (let x = 0; x < w; x++) {
      const s = spalte(wf, x / w * wf.faecher, (x + 1) / w * wf.faecher);
      if (s) zeichneSpalte(g, x, mitteY, H, s, this.farben, 1);
    }
    this.vorlage = off; this.fuer = tr.id + '@' + w + 'x' + h;
  }
  zeichnen(d) {
    const { w, h } = leinwand(this.c);
    const g = this.g;
    g.clearRect(0, 0, w, h);
    const tr = d.track;
    if (!tr || !tr.wf) return;
    if (this.fuer !== tr.id + '@' + w + 'x' + h) this.vorzeichnen(tr, w, h);
    g.drawImage(this.vorlage, 0, 0);
    const dauer = tr.dauer || 1;
    const xp = d.pos / dauer * w;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, xp, h);
    // Abschnitte (Generator) als feine Marken
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (const a of tr.abschnitte || []) if (a.start > 0) g.fillRect(Math.round(a.start / dauer * w), 0, 1, h);
    if (d.loop.ende > d.loop.start) {
      g.fillStyle = 'rgba(52,227,106,.85)';
      g.fillRect(d.loop.start / dauer * w, h - 4, Math.max(2, (d.loop.ende - d.loop.start) / dauer * w), 4);
    }
    g.fillStyle = '#ff8a00'; g.fillRect(Math.round(d.cue / dauer * w) - 1, 0, 3, h);
    g.fillStyle = '#fff'; g.fillRect(Math.round(xp) - 1, 0, 2, h);
  }
  // Klick in die Uebersicht -> Sekunden
  zeitBei(e, dauer) {
    const r = this.c.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dauer;
  }
}
