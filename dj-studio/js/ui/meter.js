// LED-Pegelmesser (Canvas). Bekommt gemessene Spitze/RMS (linear) und zeigt
// sie mit Ballistik: sofortiger Anstieg, Abfall 26 dB/s, Spitzen-Halten 1,5 s,
// CLIP-Anzeige ab -0,1 dBFS. Stille = keine LED.

import { zuDb } from '../analysis.js';

// Schwellen der Segmente in dBFS (unten -> oben)
export const SCHWELLEN = [-48, -42, -36, -33, -30, -27, -24, -21, -18, -16, -14, -12, -10, -8, -6, -5, -4, -3, -2, -1, -0.5];
export const SKALA = [0, -3, -6, -12, -18, -24, -36, -48];
const ABFALL = 26, HALTEN = 1.5, CLIP = -0.1;

export function leinwand(c) {
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return { w, h, f: w / (c.clientWidth || 1) };
}

function farbe(db, an) {
  if (db >= -3) return an ? '#ff3030' : '#3a1414';
  if (db >= -12) return an ? '#f6d21c' : '#3a3410';
  return an ? '#2fe36a' : '#11301b';
}

export class LedMeter {
  // richtung 'v' (unten->oben) oder 'h' (links->rechts); kanaele 1 oder 2
  constructor(canvas, { richtung = 'v', kanaele = 2, abstand = 2 } = {}) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.richtung = richtung; this.kanaele = kanaele; this.abstand = abstand;
    this.k = Array.from({ length: kanaele }, () => ({ spitze: -Infinity, rms: -Infinity, halten: -Infinity, haltenZeit: 0, clip: 0 }));
  }

  // werte: [{ spitze, rms }] linear je Kanal; t: Sekunden (performance)
  update(werte, t, dt) {
    for (let i = 0; i < this.kanaele; i++) {
      const k = this.k[i], w = werte[i] || { spitze: 0, rms: 0 };
      const sp = zuDb(w.spitze), rm = zuDb(w.rms);
      k.spitze = sp >= k.spitze || !isFinite(k.spitze) ? sp : Math.max(sp, k.spitze - ABFALL * dt);
      k.rms = rm >= k.rms || !isFinite(k.rms) ? rm : Math.max(rm, k.rms - ABFALL * dt);
      if (k.spitze < -60) k.spitze = -Infinity;
      if (k.rms < -60) k.rms = -Infinity;
      if (sp >= k.halten || t - k.haltenZeit > HALTEN) { k.halten = sp; k.haltenZeit = t; }
      if (sp >= CLIP) k.clip = t;
    }
    this.zeichnen(t);
  }

  clip(t) { return this.k.some(k => t - k.clip < 1.5); }

  zeichnen(t) {
    const { w, h } = leinwand(this.c);
    const g = this.g;
    g.clearRect(0, 0, w, h);
    const n = SCHWELLEN.length;
    const dpr = window.devicePixelRatio || 1;
    const ab = this.abstand * dpr;
    for (let i = 0; i < this.kanaele; i++) {
      const k = this.k[i];
      const haltIdx = isFinite(k.halten) ? SCHWELLEN.findLastIndex(s => k.halten >= s) : -1;
      for (let s = 0; s < n; s++) {
        const db = SCHWELLEN[s];
        const anSp = k.spitze >= db, anRms = k.rms >= db;
        let x, y, sw, sh;
        if (this.richtung === 'v') {
          const breite = (w - ab * (this.kanaele - 1)) / this.kanaele;
          const hoehe = (h - ab * (n - 1)) / n;
          x = i * (breite + ab); y = h - (s + 1) * hoehe - s * ab; sw = breite; sh = hoehe;
        } else {
          const hoehe = (h - ab * (this.kanaele - 1)) / this.kanaele;
          const breite = (w - ab * (n - 1)) / n;
          x = s * (breite + ab); y = i * (hoehe + ab); sw = breite; sh = hoehe;
        }
        g.fillStyle = farbe(db, anSp || s === haltIdx);
        g.globalAlpha = anRms || s === haltIdx ? 1 : anSp ? 0.72 : 1;
        g.fillRect(x, y, sw, sh);
        if (anSp || s === haltIdx) {
          g.globalAlpha = 0.35; g.fillStyle = '#fff';
          if (this.richtung === 'v') g.fillRect(x, y, sw, Math.max(1, sh * 0.28));
          else g.fillRect(x, y, sw, Math.max(1, sh * 0.25));
        }
        g.globalAlpha = 1;
      }
    }
  }
}
