// LED-Pegelmesser (Canvas). Bekommt gemessene Spitze/RMS (linear) und zeigt
// sie mit Ballistik: sofortiger Anstieg, Abfall 26 dB/s, Spitzen-Halten 1,5 s,
// CLIP-Anzeige ab -0,1 dBFS. Stille = keine LED.

import { zuDb } from '../analysis.js';

// Schwellen der Segmente in dBFS (unten -> oben)
export const SCHWELLEN = [-48, -42, -36, -33, -30, -27, -24, -21, -18, -16, -14, -12, -10, -8, -6, -5, -4, -3, -2, -1, -0.5];
export const SKALA = [0, -3, -6, -12, -18, -24, -36, -48];
// feinere Teilung fuer den Master (mehr, kleinere Segmente wie in Bild 2)
export const SCHWELLEN_MASTER = [-48, -45, -42, -39, -36, -33, -30, -27, -24, -22, -20, -18, -16, -14, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2.5, -2, -1.5, -1, -0.5, -0.1];
const ABFALL = 26, HALTEN = 1.5, CLIP = -0.1;

// Schwellen passend zu einer gedruckten Skala (Bild 2): punkte = [[Segment, Skalenwert]],
// versatz = Skalenwert, der 0 dBFS entspricht. Liefert n steigende dBFS-Schwellen.
function ausSkala(punkte, n, versatz) {
  const wert = s => {
    let i = 1; while (i < punkte.length - 1 && punkte[i][0] < s) i++;
    const [s0, w0] = punkte[i - 1], [s1, w1] = punkte[i];
    return w0 + (w1 - w0) * (s - s0) / (s1 - s0);
  };
  return Array.from({ length: n }, (_, s) => Math.min(wert(s) - versatz, CLIP - (n - 1 - s) * 0.05));
}
// Kanal-Meter in Bild 2: Skala +6 ... -24, oberste LED = 0 dBFS
export const SCHWELLEN_BILD_DECK = ausSkala([[-0.7, -24], [3.3, -18], [6.2, -12], [10.7, -6], [13.8, -3], [16.9, 0], [19.6, 3], [22.6, 6]], 24, 6);
// Master in Bild 2: Skala -24 ... +9, +9 = 0 dBFS
export const SCHWELLEN_BILD_MASTER = ausSkala([[0, -24], [3.4, -18], [7, -12], [10.2, -6], [13.4, -3], [16.5, 0], [19.4, 3], [22.4, 6], [25.3, 9]], 26, 9);

export function leinwand(c) {
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return { w, h, f: w / (c.clientWidth || 1) };
}

// Farbverlauf ueber die Segmente (wie am Geraet): unten blau/gruen, oben gelb/rot
const PALETTEN = {
  deck: [[0, [30, 90, 255]], [0.18, [25, 195, 255]], [0.4, [47, 227, 106]], [0.62, [190, 240, 30]], [0.76, [255, 214, 28]], [0.86, [255, 140, 28]], [0.93, [255, 43, 43]], [1, [255, 43, 43]]],
  master: [[0, [47, 227, 106]], [0.5, [120, 236, 60]], [0.66, [230, 236, 30]], [0.78, [255, 200, 28]], [0.88, [255, 120, 28]], [0.95, [255, 43, 43]], [1, [255, 43, 43]]],
};
function farbeRgb(anteil, palette) {
  const p = PALETTEN[palette];
  let i = 1; while (i < p.length - 1 && p[i][0] < anteil) i++;
  const [a0, c0] = p[i - 1], [a1, c1] = p[i], t = Math.min(1, Math.max(0, (anteil - a0) / (a1 - a0 || 1)));
  return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
}
function farbe(anteil, an, palette) {
  const p = PALETTEN[palette];
  let i = 1; while (i < p.length - 1 && p[i][0] < anteil) i++;
  const [a0, c0] = p[i - 1], [a1, c1] = p[i], t = Math.min(1, Math.max(0, (anteil - a0) / (a1 - a0 || 1)));
  const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
  const f = an ? 1 : 0.17;
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;
}

export class LedMeter {
  // richtung 'v' (unten->oben) oder 'h' (links->rechts); kanaele 1 oder 2
  constructor(canvas, { richtung = 'v', kanaele = 2, abstand = 2, palette = 'deck', schwellen = SCHWELLEN, stil = 'flach', zeilen = 1, zeilenLuecke = 3, kanalLuecke = 3 } = {}) {
    this.stil = stil; this.zeilen = zeilen; this.zeilenLuecke = zeilenLuecke; this.kanalLuecke = kanalLuecke;
    this.schwellen = schwellen;
    this.palette = palette;
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
    if (this.stil === 'bild') return this.zeichnenBild();
    const { w, h } = leinwand(this.c);
    const g = this.g;
    g.clearRect(0, 0, w, h);
    const S = this.schwellen, n = S.length;
    const dpr = window.devicePixelRatio || 1;
    const ab = this.abstand * dpr;
    for (let i = 0; i < this.kanaele; i++) {
      const k = this.k[i];
      const haltIdx = isFinite(k.halten) ? S.findLastIndex(s => k.halten >= s) : -1;
      for (let s = 0; s < n; s++) {
        const db = S[s];
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
        g.fillStyle = farbe(s / (n - 1), anSp || s === haltIdx, this.palette);
        if (anSp || s === haltIdx) { g.shadowColor = g.fillStyle; g.shadowBlur = 6 * dpr; } else g.shadowBlur = 0;
        g.globalAlpha = anRms || s === haltIdx ? 1 : anSp ? 0.72 : 1;
        g.fillRect(x, y, sw, sh);
        if (anSp || s === haltIdx) {
          g.shadowBlur = 0; g.globalAlpha = 0.3; g.fillStyle = '#fff';
          if (this.richtung === 'v') g.fillRect(x, y, sw, Math.max(1, sh * 0.28));
          else g.fillRect(x, y, sw, Math.max(1, sh * 0.25));
        }
        g.globalAlpha = 1;
      }
    }
  }

  // Bild-2-Optik: einzelne abgerundete LEDs mit Glanz und Schein, dunkle LEDs leicht getoent
  zeichnenBild() {
    const { w, h, f: pxF } = leinwand(this.c);
    const g = this.g;
    g.clearRect(0, 0, w, h);
    const S = this.schwellen, n = S.length, dpr = window.devicePixelRatio || 1;
    const v = this.richtung === 'v';
    const lang = v ? h : w, quer = v ? w : h;
    const teilung = lang / n, luecke = Math.max(1, teilung * 0.26), seg = teilung - luecke;
    // Luecken in Buehnen-Pixeln (pxF = Leinwand-Pixel je Buehnen-Pixel)
    const zl = this.zeilenLuecke * pxF, kl = this.kanalLuecke * pxF;
    const breite = (quer - kl * (this.kanaele - 1) - zl * (this.zeilen - 1) * this.kanaele) / (this.kanaele * this.zeilen);
    const r = Math.min(seg, breite) * 0.22;
    for (let i = 0; i < this.kanaele; i++) {
      const k = this.k[i];
      const haltIdx = isFinite(k.halten) ? S.findLastIndex(s => k.halten >= s) : -1;
      for (let z = 0; z < this.zeilen; z++) {
        const q0 = i * (this.zeilen * breite + (this.zeilen - 1) * zl + kl) + z * (breite + zl);
        // TV (echte Titel): Balken = Lautheit (VU), darueber nur die gehaltene Spitze
        const tv = document.body.classList.contains('tv');
        for (let s = 0; s < n; s++) {
          const an = (tv ? k.rms : k.spitze) >= S[s] || s === haltIdx;
          const l0 = v ? h - (s + 1) * teilung + luecke / 2 : s * teilung + luecke / 2;
          const [x, y, sw, sh] = v ? [q0, l0, breite, seg] : [l0, q0, seg, breite];
          const f = farbeRgb(s / (n - 1), this.palette);
          g.beginPath(); g.roundRect(x, y, sw, sh, r);
          if (!an) {
            g.shadowBlur = 0;
            g.fillStyle = `rgb(${f.map(c => Math.round(12 + c * 0.1)).join(',')})`;
            g.fill();
            continue;
          }
          const a = k.rms >= S[s] || s === haltIdx ? 1 : 0.78;
          g.globalAlpha = a;
          g.shadowColor = `rgba(${f.join(',')},.9)`; g.shadowBlur = 7 * dpr;
          g.fillStyle = `rgb(${f.join(',')})`;
          g.fill();
          g.shadowBlur = 0;
          // Glanz: heller Kern
          const gl = v ? g.createLinearGradient(x, 0, x + sw, 0) : g.createLinearGradient(0, y, 0, y + sh);
          gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.45, 'rgba(255,255,255,.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gl; g.fill();
          g.globalAlpha = 1;
        }
      }
    }
  }
}
