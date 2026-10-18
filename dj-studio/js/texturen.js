// Material-Texturen, einmal beim Start per Canvas gerendert (scharf in jeder
// Groesse, keine fremden Bilder): gebuersteter Stahl, Chrom-Jogwheel,
// geraendelte Chromknoepfe, Fader-Kappen. Ergebnis als CSS-Variablen (url()).

function rng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
const leinwand = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// Gebuersteter Stahl: viele feine horizontale Striche mit Zufallshelligkeit
function stahl(w, h, basis, streu, seed) {
  const [c, g] = leinwand(w, h);
  const r = rng(seed);
  g.fillStyle = basis; g.fillRect(0, 0, w, h);
  for (let i = 0; i < h * 14; i++) {
    const y = r() * h, x = r() * w, len = 40 + r() * w * 0.6;
    const hell = r() < 0.5;
    g.strokeStyle = hell ? `rgba(255,255,255,${r() * streu})` : `rgba(0,0,0,${r() * streu * 1.4})`;
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 0.6); g.stroke();
    if (x + len > w) { g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + len - w, y); g.stroke(); }
  }
  // feines Korn
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * 10; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  g.putImageData(d, 0, 0);
  return c.toDataURL('image/jpeg', 0.9);
}

// Chrom-Verlauf um einen Kreis (Lichtquelle oben links)
function chromKonisch(g, cx, cy, start = -0.6) {
  const k = g.createConicGradient(start, cx, cy);
  const st = [[0, '#f4f7fa'], [0.06, '#8b929b'], [0.13, '#2a2e33'], [0.2, '#c9ced5'], [0.27, '#fdfdfd'], [0.33, '#7c838c'],
    [0.42, '#1d2024'], [0.5, '#a7adb5'], [0.56, '#eef1f4'], [0.63, '#6b727a'], [0.72, '#202327'], [0.8, '#b8bec5'],
    [0.88, '#ffffff'], [0.94, '#868d96'], [1, '#f4f7fa']];
  for (const [o, f] of st) k.addColorStop(o, f);
  return k;
}

function ring(g, cx, cy, r1, r2, stil) {
  g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.arc(cx, cy, r1, 0, Math.PI * 2, true);
  g.fillStyle = stil; g.fill('evenodd');
}

function schraube(g, x, y, r, w) {
  const rg = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.4, '#b9bfc6'); rg.addColorStop(1, '#3a3e44');
  g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = r * 0.28;
  g.beginPath(); g.moveTo(x - Math.cos(w) * r * 0.65, y - Math.sin(w) * r * 0.65); g.lineTo(x + Math.cos(w) * r * 0.65, y + Math.sin(w) * r * 0.65); g.stroke();
}

// Jogwheel-Rahmen (steht still): Chromring mit Fasen und Schrauben, Mitte frei
function jogRahmen(n) {
  const [c, g] = leinwand(n, n);
  const m = n / 2, R = n / 2;
  // aeusserer Schatten-Spalt
  ring(g, m, m, R * 0.86, R * 0.995, '#050607');
  // Chromring
  ring(g, m, m, R * 0.875, R * 0.985, chromKonisch(g, m, m));
  // Fasen: innen dunkel, aussen hell
  g.lineWidth = n * 0.006;
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(m, m, R * 0.982, Math.PI * 0.95, Math.PI * 1.75); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.arc(m, m, R * 0.877, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(m, m, R * 0.93, 0, Math.PI * 2); g.lineWidth = n * 0.003; g.stroke();
  // Schrauben
  for (let i = 0; i < 16; i++) {
    const w = i / 16 * Math.PI * 2;
    schraube(g, m + Math.cos(w) * R * 0.955, m + Math.sin(w) * R * 0.955, n * 0.0105, w + 0.7);
  }
  // innerer dunkler Kragen
  ring(g, m, m, R * 0.83, R * 0.875, '#0b0c0e');
  const kr = g.createRadialGradient(m, m, R * 0.83, m, m, R * 0.875);
  kr.addColorStop(0, 'rgba(255,255,255,.12)'); kr.addColorStop(1, 'rgba(0,0,0,0)');
  ring(g, m, m, R * 0.83, R * 0.875, kr);
  return c.toDataURL('image/png');
}

// Jogwheel-Teller (dreht sich): schwarze Rillen, Innenring, Marke
function jogTeller(n) {
  const [c, g] = leinwand(n, n);
  const m = n / 2, R = n / 2;
  g.fillStyle = '#08090b'; g.beginPath(); g.arc(m, m, R, 0, Math.PI * 2); g.fill();
  const r = rng(7);
  for (let rad = R * 0.36; rad < R * 0.99; rad += n * 0.0028) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.06})`;
    g.lineWidth = n * 0.0014;
    g.beginPath(); g.arc(m, m, rad, 0, Math.PI * 2); g.stroke();
  }
  // Rillen-Trennringe
  for (const f of [0.62, 0.8]) { g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = n * 0.006; g.beginPath(); g.arc(m, m, R * f, 0, Math.PI * 2); g.stroke(); }
  // Innenring Metall
  ring(g, m, m, R * 0.33, R * 0.38, chromKonisch(g, m, m, 0.4));
  // Marke
  g.fillStyle = '#ffffff'; g.shadowColor = '#fff'; g.shadowBlur = n * 0.02;
  g.beginPath(); g.roundRect(m - n * 0.012, n * 0.035, n * 0.024, n * 0.075, n * 0.01); g.fill();
  return c.toDataURL('image/png');
}

// Glanz ueber dem Teller (steht still): zwei weiche Lichtkeile
function jogGlanz(n) {
  const [c, g] = leinwand(n, n);
  const m = n / 2;
  const k = g.createConicGradient(-Math.PI * 0.75, m, m);
  k.addColorStop(0, 'rgba(255,255,255,0)'); k.addColorStop(0.07, 'rgba(255,255,255,.16)'); k.addColorStop(0.15, 'rgba(255,255,255,0)');
  k.addColorStop(0.5, 'rgba(255,255,255,0)'); k.addColorStop(0.57, 'rgba(255,255,255,.1)'); k.addColorStop(0.65, 'rgba(255,255,255,0)'); k.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = k; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.arc(m, m, m * 0.36, 0, Math.PI * 2, true); g.fill('evenodd');
  return c.toDataURL('image/png');
}

// Drehknopf: geraendelter Rand + gedrehte Chromkappe (Licht steht still)
function knopf(n, hell = false) {
  const [c, g] = leinwand(n, n);
  const m = n / 2, R = n / 2;
  g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = n * 0.06; g.shadowOffsetY = n * 0.03;
  g.fillStyle = '#16181b'; g.beginPath(); g.arc(m, m, R * 0.94, 0, Math.PI * 2); g.fill();
  g.shadowColor = 'transparent';
  // Raendel
  const zaehne = 64;
  for (let i = 0; i < zaehne; i++) {
    const w0 = i / zaehne * Math.PI * 2, w1 = (i + 0.5) / zaehne * Math.PI * 2;
    const licht = 0.5 + 0.5 * Math.cos(w0 + Math.PI * 0.75);
    g.fillStyle = `rgb(${18 + licht * 78},${20 + licht * 80},${24 + licht * 84})`;
    g.beginPath(); g.moveTo(m, m); g.arc(m, m, R * 0.94, w0, w1); g.closePath(); g.fill();
  }
  ring(g, m, m, 0, R * 0.8, '#0d0e10');
  // Kappe: gedrehtes Metall
  const k = g.createConicGradient(0, m, m);
  for (let i = 0; i <= 24; i++) { const v = hell ? (i % 2 ? 0.55 : 0.85) : (i % 2 ? 0.2 : 0.4); const f = Math.round(v * 255); k.addColorStop(i / 24, `rgb(${f},${f + 2},${f + 6})`); }
  g.fillStyle = k; g.beginPath(); g.arc(m, m, R * 0.66, 0, Math.PI * 2); g.fill();
  const rg = g.createRadialGradient(m - R * 0.25, m - R * 0.3, 0, m, m, R * 0.66);
  rg.addColorStop(0, 'rgba(255,255,255,.45)'); rg.addColorStop(0.5, 'rgba(255,255,255,0)'); rg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = rg; g.beginPath(); g.arc(m, m, R * 0.66, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = n * 0.012; g.beginPath(); g.arc(m, m, R * 0.655, Math.PI, Math.PI * 1.6); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(m, m, R * 0.655, 0, Math.PI * 0.7); g.stroke();
  return c.toDataURL('image/png');
}

// Fader-Kappe (senkrecht oder waagrecht)
function faderKappe(w, h) {
  const [c, g] = leinwand(w, h);
  const quer = w > h;
  const lg = quer ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h);
  for (const [o, f] of [[0, '#e9edf1'], [0.12, '#9aa1a9'], [0.3, '#4b5057'], [0.47, '#d7dce1'], [0.5, '#ffffff'], [0.53, '#c4c9cf'], [0.7, '#474c53'], [0.88, '#9ba2aa'], [1, '#dfe3e8']]) lg.addColorStop(o, f);
  g.fillStyle = lg; g.beginPath(); g.roundRect(1, 1, w - 2, h - 2, Math.min(w, h) * 0.12); g.fill();
  // Rippen
  g.globalAlpha = 0.35;
  for (let i = 1; i < 9; i++) {
    if (i === 4 || i === 5) continue;
    g.fillStyle = i % 2 ? '#000' : '#fff';
    if (quer) g.fillRect(i / 9 * w, h * 0.1, w * 0.02, h * 0.8); else g.fillRect(w * 0.1, i / 9 * h, w * 0.8, h * 0.02);
  }
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2; g.beginPath(); g.roundRect(1, 1, w - 2, h - 2, Math.min(w, h) * 0.12); g.stroke();
  g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  if (quer) g.fillRect(w / 2 - 1.5, h * 0.12, 3, h * 0.76); else g.fillRect(w * 0.12, h / 2 - 1.5, w * 0.76, 3);
  return c.toDataURL('image/png');
}

export function texturenLaden() {
  const s = document.documentElement.style;
  const url = d => `url(${d})`;
  s.setProperty('--tex-stahl', url(stahl(1024, 512, '#262a2f', 0.07, 3)));
  s.setProperty('--tex-stahl-hell', url(stahl(1024, 512, '#33373d', 0.07, 5)));
  s.setProperty('--tex-stahl-dunkel', url(stahl(1024, 256, '#1b1d21', 0.08, 9)));
  s.setProperty('--tex-jog-rahmen', url(jogRahmen(600)));
  s.setProperty('--tex-jog-teller', url(jogTeller(600)));
  s.setProperty('--tex-jog-glanz', url(jogGlanz(600)));
  s.setProperty('--tex-knopf', url(knopf(160)));
  s.setProperty('--tex-knopf-gross', url(knopf(240, true)));
  s.setProperty('--tex-fader', url(faderKappe(80, 112)));
  s.setProperty('--tex-xfader', url(faderKappe(80, 112)));
}
