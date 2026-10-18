// Cover fuer Demo-Titel: aus Titel und Farbe gezeichnet (keine fremden Bilder).

const cache = new Map();

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function cover(track, groesse = 256) {
  if (!track) return '';
  const key = track.id + '@' + groesse;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = groesse;
  const g = c.getContext('2d');
  const r = rng(hash(track.id + track.titel));
  const h = track.farbe ?? Math.floor(r() * 360);
  const s = groesse;
  // Himmel
  const himmel = g.createLinearGradient(0, 0, 0, s);
  himmel.addColorStop(0, `hsl(${h + 230} 70% 8%)`);
  himmel.addColorStop(0.55, `hsl(${h + 290} 75% 30%)`);
  himmel.addColorStop(1, `hsl(${h} 90% 55%)`);
  g.fillStyle = himmel; g.fillRect(0, 0, s, s);
  // Sterne
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    g.fillRect(r() * s, r() * s * 0.5, 1 + r() * 1.2, 1 + r() * 1.2);
  }
  const art = Math.floor(r() * 3);
  if (art === 0) {
    // Sonne mit Streifen
    const cx = s * (0.35 + r() * 0.3), cy = s * 0.58, rad = s * 0.24;
    const sg = g.createLinearGradient(0, cy - rad, 0, cy + rad);
    sg.addColorStop(0, `hsl(${h + 40} 100% 70%)`); sg.addColorStop(1, `hsl(${h + 330} 100% 55%)`);
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    g.fillStyle = `hsl(${h + 280} 70% 18%)`;
    for (let i = 0; i < 6; i++) g.fillRect(cx - rad, cy + i * rad * 0.16, rad * 2, 2 + i * 1.3);
  } else if (art === 1) {
    // Neon-Ring
    g.shadowColor = `hsl(${h} 100% 60%)`; g.shadowBlur = s * 0.08;
    g.strokeStyle = `hsl(${h} 100% 68%)`; g.lineWidth = s * 0.035;
    g.beginPath(); g.arc(s / 2, s * 0.46, s * 0.26, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = `hsl(${h + 60} 100% 70%)`; g.lineWidth = s * 0.012;
    g.beginPath(); g.arc(s / 2, s * 0.46, s * 0.18, 0, Math.PI * 2); g.stroke();
    g.shadowBlur = 0;
  } else {
    // Lichtkegel
    for (let i = 0; i < 4; i++) {
      const x = s * (0.15 + i * 0.23);
      const lg = g.createLinearGradient(x, s, x, 0);
      lg.addColorStop(0, `hsla(${h + i * 25} 100% 65% / .55)`); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(x - s * 0.02, s); g.lineTo(x + (r() - 0.5) * s * 0.6 - s * 0.12, 0); g.lineTo(x + (r() - 0.5) * s * 0.6 + s * 0.12, 0); g.closePath(); g.fill();
    }
  }
  // Berge (Karawanken) im Vordergrund
  g.fillStyle = `hsl(${h + 250} 60% 6%)`;
  g.beginPath(); g.moveTo(0, s);
  let y = s * 0.78;
  for (let x = 0; x <= s; x += s / 10) { y = s * (0.7 + r() * 0.14); g.lineTo(x, y); }
  g.lineTo(s, s); g.closePath(); g.fill();
  // feiner Glanz
  const glanz = g.createLinearGradient(0, 0, s, s);
  glanz.addColorStop(0, 'rgba(255,255,255,.10)'); glanz.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = glanz; g.fillRect(0, 0, s, s);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
