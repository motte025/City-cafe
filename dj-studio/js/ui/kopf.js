// Kopfzeile: Marke, Master-Schwingung (gemessen), Modus, Uhr.

import { el, taste } from './controls.js';
import { leinwand } from './meter.js';
import { matrixDialog } from './overlays.js';

export function kopfBauen(root, engine) {
  const cL = el('canvas', 'kopf-welle'), cR = el('canvas', 'kopf-welle');
  const uhr = el('div', 'uhr-zeit'), datum = el('div', 'uhr-datum');
  root.append(
    el('div', 'kopf-feld marke', {}, [el('div', 'marke-name', { text: 'CITY CAFE' }), el('div', 'marke-sub', { text: 'KLAGENFURT' })]),
    el('div', 'kopf-feld kopf-mitte', {}, [
      cL,
      el('div', 'kopf-titel', {}, [el('div', 'kopf-name', { text: 'CITY CAFE' }), el('div', 'kopf-claim', { text: 'MUSIC · PEOPLE · GOOD VIBES' })]),
      cR,
    ]),
    el('div', 'kopf-feld modus', {}, [
      el('span', 'modus-text', { text: 'DJ / VJ CONTROL' }),
      el('span', 'demo-badge', { text: 'DEMO', title: 'Prototyp mit Testsignalen, nicht mit dem TV verbunden' }),
    ]),
    el('div', 'kopf-feld uhr', {}, [
      el('div', '', {}, [uhr, datum]),
      taste({ html: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="2.4" rx="1"/><rect x="3" y="11" width="18" height="2.4" rx="1"/><rect x="3" y="17" width="18" height="2.4" rx="1"/></svg>',
        klasse: 'icon', aria: 'Was ist echt, was ist Demo?', onKlick: matrixDialog }),
    ]),
  );
  const fmtZeit = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' });
  const fmtDatum = new Intl.DateTimeFormat('de-AT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Vienna' });
  const puf = new Float32Array(1024);
  let letzteUhr = 0;
  return {
    frame(t) {
      if (t - letzteUhr > 1) {
        letzteUhr = t;
        const d = new Date();
        uhr.textContent = fmtZeit.format(d);
        datum.textContent = fmtDatum.format(d).toUpperCase().replace(/\./g, '').replace(/,/g, '');
      }
      if (!engine.ctx) return;
      engine.masterMeter.l.getFloatTimeDomainData(puf);
      for (const [c, spiegel] of [[cL, false], [cR, true]]) {
        const { w, h } = leinwand(c);
        const g = c.getContext('2d');
        g.clearRect(0, 0, w, h);
        const grad = g.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(spiegel ? 1 : 0, 'rgba(35,168,255,0)');
        grad.addColorStop(spiegel ? 0 : 1, 'rgba(35,168,255,1)');
        g.strokeStyle = grad; g.lineWidth = 1.5 * (window.devicePixelRatio || 1);
        g.shadowColor = '#23a8ff'; g.shadowBlur = 6;
        g.beginPath();
        const n = 512;
        for (let i = 0; i < n; i++) {
          const x = (spiegel ? n - i : i) / n * w;
          const huell = Math.sin(i / n * Math.PI) ** 0.6;
          const y = h / 2 - puf[i * 2] * h * 0.9 * huell;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    },
  };
}
