// Mitte: Programmbild (MAIN VIDEO OUTPUT) mit Transport und darunter MASTER.

import { state, abonnieren } from '../store.js';
import { el, knopf, regler, taste, an, zeit } from './controls.js';
import { LedMeter, leinwand, SKALA, SCHWELLEN_MASTER as SCHWELLEN, SCHWELLEN_BILD_MASTER } from './meter.js';
import { einstellungen, matrixTabelle } from './overlays.js';
import { cover } from '../artwork.js';

const ICON = {
  zurueck: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="3" height="14"/><path d="M20 5v14L8 12z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/></svg>',
  weiter: '<svg viewBox="0 0 24 24"><path d="M4 5v14l12-7z"/><rect x="17" y="5" width="3" height="14"/></svg>',
  voll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
  zahn: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.5 7.5 0 000-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.3 2.9a7.6 7.6 0 00-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 000 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.3-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5A3.5 3.5 0 1113 8.5a3.5 3.5 0 010 7z"/></svg>',
};

export function mitteBauen(root, engine, aktionen) {
  root.innerHTML = '';
  // ---- Video ---------------------------------------------------------------
  const cVideo = el('canvas', 'programm', { 'aria-label': 'Programmbild (Demo-Visual)' });
  const linkAnsicht = el('div', 'link-ansicht', {}, [matrixTabelle()]);
  const zeitL = el('span', 'video-zeit', { text: '00:00' }), zeitR = el('span', 'video-zeit', { text: '00:00' });
  const fortschritt = el('div', 'fortschritt', { role: 'slider', tabindex: 0, 'aria-label': 'Position des Kanals auf Sendung' }, [el('div', 'fortschritt-fuell'), el('div', 'fortschritt-punkt')]);
  const quelleLabel = el('span', 'video-quelle');
  const bildschirm = el('div', 'bildschirm', {}, [
    cVideo, linkAnsicht,
    el('div', 'video-label', {}, [el('span', 'live-punkt'), el('span', '', { text: 'MAIN VIDEO OUTPUT' }), quelleLabel]),
    el('div', 'video-demo', { text: 'DEMO-VISUAL · kein Musikvideo', title: 'Aus dem Master-Signal gezeichnet. Echte Videoquellen sind noch nicht freigegeben.' }),
    el('div', 'video-unten', {}, [el('div', 'video-zeiten', {}, [zeitL, zeitR]), fortschritt]),
  ]);
  fortschritt.addEventListener('pointerdown', e => {
    const id = engine.aufSendung(), d = state.decks[id];
    if (!d.track) return;
    const r = fortschritt.getBoundingClientRect();
    engine.decks[id].springen((e.clientX - r.left) / r.width * d.track.dauer);
  });

  const tZurueck = taste({ html: ICON.zurueck, klasse: 'icon transport', aria: 'Kanal auf Sendung: zurück zum Cue', onKlick: () => {
    const id = engine.aufSendung(), de = engine.decks[id];
    if (state.decks[id].spielt) de.springen(state.decks[id].cue); else de.springen(0);
  } });
  const tPlay = taste({ html: ICON.play, klasse: 'icon transport', aria: 'Kanal auf Sendung: Play/Pause', onKlick: () => engine.decks[engine.aufSendung()].umschalten() });
  const tWeiter = taste({ html: ICON.weiter, klasse: 'icon transport', aria: 'Übergang zum nächsten Titel', onKlick: () => aktionen.uebergangJetzt() });
  const ansichten = [['video', 'VIDEO'], ['audio', 'AUDIO'], ['fx', 'FX'], ['link', 'LINK']].map(([w, t]) => {
    const b = taste({ text: t, klasse: 'reiter akzent', onKlick: () => engine.request('video.ansicht', w) });
    b.dataset.w = w;
    if (w === 'fx') { b.disabled = true; b.title = 'Video-Effekte: noch nicht gebaut'; }
    if (w === 'link') b.title = 'Was ist echt, was ist Demo';
    if (w === 'audio') b.title = 'Spektrum und Schwingung des Master-Signals';
    return b;
  });
  const tVoll = taste({ html: ICON.voll, klasse: 'icon', aria: 'Programmbild Vollbild', onKlick: () => {
    if (document.fullscreenElement) document.exitFullscreen(); else bildschirm.requestFullscreen?.();
  } });
  const tZahn = taste({ html: ICON.zahn, klasse: 'icon', aria: 'Einstellungen', onKlick: () => einstellungen(engine) });
  const transport = el('div', 'transport', {}, [
    el('div', 'transport-gruppe', {}, [tZurueck, tPlay, tWeiter]),
    el('div', 'transport-gruppe reiter-gruppe', {}, ansichten),
    el('div', 'transport-gruppe', {}, [tVoll, tZahn]),
  ]);
  const video = el('div', 'video panel', {}, [bildschirm, transport]);

  // ---- Master --------------------------------------------------------------
  const cMaster = el('canvas', 'master-meter', { 'aria-label': 'Master-Pegel L/R' });
  const skin = !!root.closest('.skin');
  const mMeter = skin
    ? new LedMeter(cMaster, { richtung: 'h', kanaele: 2, zeilen: 2, zeilenLuecke: 2.3, kanalLuecke: 12.6, palette: 'master', stil: 'bild', schwellen: SCHWELLEN_BILD_MASTER })
    : new LedMeter(cMaster, { richtung: 'h', kanaele: 2, abstand: 4, palette: 'master', schwellen: SCHWELLEN });
  const skala = el('div', 'master-skala', { 'aria-hidden': 'true' },
    SKALA.slice().reverse().map(db => el('span', '', { text: String(db), style: `--pos:${pos(db)}` })));
  const clip = el('span', 'status-led rot', { text: 'CLIP' });
  const limit = el('span', 'status-led gelb', { text: 'LIMIT' });
  const masterKnopf = knopf({ label: '', aria: 'Master-Lautstärke', min: 0, max: 1, null: 0.8, schritt: 0.01, groesse: 86,
    format: v => { const g = v / 0.8; return g <= 0 ? '−∞ dB' : (20 * Math.log10(g)).toFixed(1) + ' dB'; },
    onWunsch: v => engine.request('master.volume', v) });
  masterKnopf.el.classList.add('master-knopf');
  const cGr = el('canvas', 'gr-meter', { 'aria-label': 'Limiter-Absenkung' });
  const grWert = el('span', 'gr-wert', { text: '0.0' });
  const steuert = [['video', 'VIDEO'], ['audio', 'AUDIO'], ['auto', 'AUTO']].map(([w, t]) => {
    const b = taste({ text: t, klasse: 'akzent breit', onKlick: () => engine.request('master.xfSteuert', w) });
    b.dataset.w = w;
    b.title = { video: 'Crossfader blendet nur das Bild, Ton beider Kanäle bleibt voll', audio: 'Crossfader blendet nur den Ton, Bild zeigt den lauteren Kanal', auto: 'Crossfader blendet Bild und Ton' }[w];
    return b;
  });
  const xf = regler({ richtung: 'h', min: -1, max: 1, null: 0, schritt: 0.02, aria: 'Crossfader', klasse: 'crossfader',
    format: v => v === 0 ? 'Mitte' : v < 0 ? 'A ' + Math.round(-v * 100) + ' %' : 'B ' + Math.round(v * 100) + ' %',
    onWunsch: v => engine.request('master.crossfader', v) });
  const tA = taste({ text: 'A', klasse: 'xf-seite kanal-a', aria: 'Crossfader ganz zu Kanal 1', onKlick: () => engine.request('master.crossfader', -1) });
  const tB = taste({ text: 'B', klasse: 'xf-seite kanal-b', aria: 'Crossfader ganz zu Kanal 2', onKlick: () => engine.request('master.crossfader', 1) });
  const master = el('div', 'master panel', {}, [
    el('div', 'master-titel', { text: 'MASTER' }),
    el('div', 'master-reihe', {}, [
      el('div', 'master-feld aussteuerung', {}, [
        el('div', 'feld-kopf', {}, [el('span', 'mini-label', { text: 'AUSSTEUERUNG · dBFS' }), el('span', 'leds', {}, [limit, clip])]),
        el('div', 'master-meter-box', {}, [el('div', 'lr', {}, [el('span', '', { text: 'L' }), el('span', '', { text: 'R' })]), cMaster]),
        skala,
      ]),
      el('div', 'master-feld pegel', {}, [
        el('span', 'mini-label', { text: 'MASTER LEVEL' }),
        el('div', 'pegel-reihe', {}, [masterKnopf.el, el('div', 'gr-box', { title: 'Absenkung durch den Limiter (gemessen)' }, [cGr, el('span', 'mini-label', { text: 'GR' }), grWert])]),
      ]),
      el('div', 'master-feld steuert', {}, [el('span', 'mini-label', { text: 'XF: VIDEO / AUDIO' }), ...steuert]),
    ]),
    el('div', 'master-xf', {}, [
      el('span', 'mini-label xf-label', { text: 'CROSSFADER' }),
      el('div', 'xf-reihe', {}, [tA, xf.el, tB]),
    ]),
  ]);

  root.append(video, master);

  const zeigen = {
    'master.volume': () => masterKnopf.update(state.master.volume),
    'master.crossfader': () => xf.update(state.master.crossfader),
    'master.xfSteuert': () => steuert.forEach(b => an(b, b.dataset.w === state.master.xfSteuert)),
    'video.ansicht': () => {
      ansichten.forEach(b => an(b, b.dataset.w === state.video.ansicht));
      linkAnsicht.hidden = state.video.ansicht !== 'link';
      bildschirm.classList.toggle('link-modus', state.video.ansicht === 'link');
      bildschirm.dataset.ansicht = state.video.ansicht;
    },
  };
  abonnieren(p => zeigen[p]?.());
  Object.values(zeigen).forEach(f => f());

  const programm = new Programm(cVideo, engine, skin);
  const grG = cGr.getContext('2d');
  return {
    frame(t, dt) {
      const id = engine.aufSendung(), d = state.decks[id];
      tPlay.innerHTML = d.spielt ? ICON.pause : ICON.play;
      tPlay.setAttribute('aria-label', `Kanal ${id === 'A' ? 1 : 2} Play/Pause`);
      quelleLabel.textContent = d.track ? `· KANAL ${id === 'A' ? 1 : 2}` : '';
      quelleLabel.classList.toggle('kanal-a', id === 'A'); quelleLabel.classList.toggle('kanal-b', id === 'B');
      const dauer = d.track?.dauer || 0;
      zeitL.textContent = zeit(d.pos); zeitR.textContent = '-' + zeit(dauer - d.pos);
      fortschritt.style.setProperty('--anteil', dauer ? d.pos / dauer : 0);
      fortschritt.classList.toggle('kanal-a', id === 'A'); fortschritt.classList.toggle('kanal-b', id === 'B');
      const mp = engine.masterPegel();
      mMeter.update([mp.L, mp.R], t, dt);
      clip.classList.toggle('an', mMeter.clip(t));
      limit.classList.toggle('an', mp.reduktion < -0.3);
      grWert.textContent = mp.reduktion.toFixed(1);
      if (document.body.classList.contains('tv')) {
        // TV: kein eigener Limiter - die Saeule zeigt den Master-Pegel (nach der Lautstaerke)
        const k = mMeter.k, lautst = Math.max(k[0].rms, k[1].rms);
        saeuleZeichnen(cGr, grG, lautst, Math.max(k[0].halten, k[1].halten), skin);
        grWert.textContent = isFinite(lautst) ? lautst.toFixed(1) : '−∞';
      } else grZeichnen(cGr, grG, mp.reduktion, skin);
      if (state.video.ansicht !== 'link') programm.zeichnen(t, state.video.ansicht);
    },
  };
}

// Limiter-Absenkung: oben 1 dB, unten 12 dB. Bild-Optik: zwei Spalten runder LEDs mit Schein.
// Lage je Skin (skin.js, data-lage): Gehaeuse abdecken, LEDs mit gleichem Rand ringsum
function grFlaeche(c, g) {
  const { w, h, f } = leinwand(c);
  g.clearRect(0, 0, w, h);
  let L = null;
  try { L = c.dataset.lage ? JSON.parse(c.dataset.lage) : null; } catch (e) {}
  if (!L) return { ox: 0, oy: 0, w, h, ql: 3 * (window.devicePixelRatio || 1) };
  g.fillStyle = L.grund; g.beginPath(); g.roundRect(0, 0, w, h, L.radius * f); g.fill();
  const r = L.rand * f;
  return { ox: r, oy: r, w: w - 2 * r, h: h - 2 * r, ql: L.spalte * f };
}

function grZeichnen(c, g, reduktion, skin) {
  const { ox, oy, w, h, ql } = grFlaeche(c, g);
  const segs = skin ? 14 : 12;
  const dpr = window.devicePixelRatio || 1;
  const lu = skin ? Math.max(1, h / segs * 0.28) : 2, sh = (h - (segs - 1) * lu) / segs;
  const spalten = skin ? 2 : 1, sw = (w - ql * (spalten - 1)) / spalten;
  for (let i = 0; i < segs; i++) {
    const db = -(i + 1) * 12 / segs;
    const an = reduktion <= db + 0.4;
    for (let k = 0; k < spalten; k++) {
      g.beginPath();
      g.roundRect(ox + k * (sw + ql), oy + i * (sh + lu), sw, sh, skin ? Math.min(sw, sh) * 0.22 : 0);
      g.fillStyle = an ? '#ffc21c' : skin ? '#1d1a10' : '#2b2610';
      g.shadowColor = '#ffb000'; g.shadowBlur = an && skin ? 7 * dpr : 0;
      g.fill();
    }
  }
  g.shadowBlur = 0;
}

// Master-Pegel als Saeule (TV): unten -30 dBFS, oben 0 dBFS, gehaltene Spitze als einzelne LED.
function saeuleZeichnen(c, g, db, spitze, skin) {
  const { ox, oy, w, h, ql } = grFlaeche(c, g);
  const segs = skin ? 14 : 12, dpr = window.devicePixelRatio || 1;
  const lu = skin ? Math.max(1, h / segs * 0.28) : 2, sh = (h - (segs - 1) * lu) / segs;
  const spalten = skin ? 2 : 1, sw = (w - ql * (spalten - 1)) / spalten;
  const schwelle = i => -30 + 30 * (i + 1) / segs;           // i = 0 unten
  const spitzeI = isFinite(spitze) ? Math.floor((spitze + 30) / 30 * segs) - 1 : -1;
  for (let i = 0; i < segs; i++) {
    const an = db >= schwelle(i) - 30 / segs || i === spitzeI;
    const farbe = i >= segs - 2 ? '#ff3b2f' : i >= segs - 5 ? '#ffc21c' : '#3be06a';
    const y = oy + h - (i + 1) * sh - i * lu;
    for (let k = 0; k < spalten; k++) {
      g.beginPath();
      g.roundRect(ox + k * (sw + ql), y, sw, sh, skin ? Math.min(sw, sh) * 0.22 : 0);
      g.fillStyle = an ? farbe : skin ? '#1d1a10' : '#2b2610';
      g.shadowColor = farbe; g.shadowBlur = an && skin ? 7 * dpr : 0;
      g.fill();
    }
  }
  g.shadowBlur = 0;
}

function pos(db) {
  let i = SCHWELLEN.findIndex(x => x >= db);
  if (i < 0) i = SCHWELLEN.length - 1;
  return ((i + 0.5) / SCHWELLEN.length).toFixed(4);
}

// Demo-Programmbild: aus Taktphase und gemessenem Pegel jedes Decks gezeichnet.
class Programm {
  constructor(c, engine, ueberBild = false) {
    this.c = c; this.g = c.getContext('2d'); this.engine = engine;
    this.ueberBild = ueberBild;   // Bild-2-Modus: nur Licht ueber das Clubfoto legen
    this.spek = new Uint8Array(1024);
    this.kopf = Array.from({ length: 46 }, (_, i) => ({ x: i / 45, r: 0.035 + ((i * 37) % 11) / 300, h: 0.06 + ((i * 53) % 13) / 260 }));
    this.cover = {};
  }
  pegel(id) {
    const p = this.engine.decks[id].meterPost.lesen();
    const v = Math.min(1, (p.L.rms + p.R.rms) * 2.2);
    return Number.isFinite(v) ? v : 0;
  }
  beat(id) {
    const d = state.decks[id];
    if (!d.track?.grid || !d.spielt) return { phase: 0, takt: 0 };
    const b = 60 / d.track.grid.bpm, x = (d.pos - d.track.grid.offset) / b;
    return { phase: x - Math.floor(x), takt: Math.floor(x) % 4, zaehler: Math.floor(x) };
  }
  zeichnen(t, ansicht) {
    const { w, h } = leinwand(this.c);
    const g = this.g;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    if (this.ueberBild && ansicht !== 'audio') return this.licht(g, w, h, t);
    g.fillStyle = '#020309'; g.fillRect(0, 0, w, h);
    if (ansicht === 'audio') return this.audio(g, w, h);
    const mix = this.engine.videoMix();
    for (const [id, alpha] of [['A', 1 - mix], ['B', mix]]) {
      if (alpha < 0.01 || !state.decks[id].track) continue;
      g.globalAlpha = alpha;
      this.ebene(g, w, h, id, t);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // Publikum (Silhouette) mit leichtem Gegenlicht
    for (const k of this.kopf) {
      const x = k.x * w, y = h * (1 - k.h), r = k.r * h;
      g.fillStyle = '#010205';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x, y + r * 2.6, r * 1.9, r * 2, 0, Math.PI, 0); g.fill();
      g.fillRect(x - r * 1.9, y + r * 2.6, r * 3.8, h);
    }
    const boden = g.createLinearGradient(0, h * 0.8, 0, h);
    boden.addColorStop(0, 'rgba(2,3,9,0)'); boden.addColorStop(1, 'rgba(2,3,9,.9)');
    g.fillStyle = boden; g.fillRect(0, h * 0.8, w, h * 0.2);
  }
  // Ueber dem Clubfoto: Scheinwerfer und Beat-Blitz je Deck, additiv (Leinwand: mix-blend screen)
  licht(g, w, h, t) {
    g.clearRect(0, 0, w, h);
    const mix = this.engine.videoMix();
    for (const [id, alpha] of [['A', 1 - mix], ['B', mix]]) {
      if (alpha < 0.01 || !state.decks[id].track) continue;
      const lvl = this.pegel(id), b = this.beat(id);
      const kick = Math.pow(1 - b.phase, 4) * lvl;
      const f = id === 'A' ? [40, 170, 255] : [255, 150, 30], f2 = id === 'A' ? [150, 70, 255] : [255, 50, 110];
      const c = (x, a) => `rgba(${x[0]},${x[1]},${x[2]},${Math.max(0, Math.min(1, a * alpha))})`;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x0 = w * (0.12 + i * 0.19);
        const wink = Math.sin(t * (0.45 + i * 0.07) + i * 1.9 + (id === 'A' ? 0 : 2.2)) * 0.5;
        const len = h * 1.25, br = 0.09;
        const grad = g.createLinearGradient(x0, 0, x0 + Math.sin(wink) * len, Math.cos(wink) * len);
        grad.addColorStop(0, c(i % 2 ? f : f2, 0.1 + lvl * 0.4)); grad.addColorStop(1, c(f, 0));
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(x0 - 2, 0); g.lineTo(x0 + 2, 0);
        g.lineTo(x0 + Math.sin(wink + br) * len, Math.cos(wink + br) * len);
        g.lineTo(x0 + Math.sin(wink - br) * len, Math.cos(wink - br) * len);
        g.closePath(); g.fill();
      }
      const dunst = g.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h * 0.1, h);
      dunst.addColorStop(0, c(f, kick * 0.35)); dunst.addColorStop(1, c(f, 0));
      g.fillStyle = dunst; g.fillRect(0, 0, w, h);
      if (b.takt === 0 && b.phase < 0.1 && lvl > 0.15) { g.fillStyle = c([255, 255, 255], 0.1 * lvl); g.fillRect(0, 0, w, h); }
      g.restore();
    }
  }
  ebene(g, w, h, id, t) {
    const lvl = this.pegel(id), b = this.beat(id);
    const kick = Math.pow(1 - b.phase, 4) * lvl;
    const A = id === 'A';
    const farbe = A ? [40, 170, 255] : [255, 150, 30];
    const farbe2 = A ? [150, 70, 255] : [255, 50, 110];
    const c = (f, a) => `rgba(${f[0]},${f[1]},${f[2]},${Math.max(0, Math.min(1, a))})`;
    // Hintergrund: Cover als LED-Wand, stark weichgezeichnet
    const tr = state.decks[id].track;
    const url = cover(tr, 128);
    let img = this.cover[url];
    if (!img) { img = new Image(); img.src = url; this.cover[url] = img; }
    if (img.complete && img.naturalWidth) {
      g.save();
      g.filter = `blur(${Math.round(h * 0.05)}px) saturate(1.4)`;
      g.globalAlpha *= 0.35 + lvl * 0.35;
      g.drawImage(img, -w * 0.1, -h * 0.4, w * 1.2, w * 1.2);
      g.restore();
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    // Dunst oben
    const dunst = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.9);
    dunst.addColorStop(0, c(farbe, 0.25 + kick * 0.4)); dunst.addColorStop(1, c(farbe, 0));
    g.fillStyle = dunst; g.fillRect(0, 0, w, h);
    // bewegte Scheinwerfer von oben
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x0 = w * (0.1 + i * 0.16);
      const wink = Math.sin(t * (0.5 + i * 0.07) + i * 1.9 + (A ? 0 : 2.2)) * 0.55;
      const len = h * 1.3, breite = 0.11;
      const x1 = x0 + Math.sin(wink) * len, y1 = Math.cos(wink) * len;
      const grad = g.createLinearGradient(x0, 0, x1, y1);
      grad.addColorStop(0, c(i % 2 ? farbe : farbe2, 0.12 + lvl * 0.55));
      grad.addColorStop(1, c(farbe, 0));
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x0 - 3, 0); g.lineTo(x0 + 3, 0);
      g.lineTo(x0 + Math.sin(wink + breite) * len, Math.cos(wink + breite) * len);
      g.lineTo(x0 + Math.sin(wink - breite) * len, Math.cos(wink - breite) * len);
      g.closePath(); g.fill();
      g.fillStyle = c([255, 255, 255], 0.5 + kick * 0.5);
      g.beginPath(); g.arc(x0, 2, 3 + kick * 4, 0, Math.PI * 2); g.fill();
    }
    // Puls auf jedem Beat, Takt 1 kraeftiger
    const r = h * (0.08 + b.phase * 0.6);
    g.strokeStyle = c(b.takt === 0 ? [255, 255, 255] : farbe, (1 - b.phase) * lvl * 0.8);
    g.lineWidth = h * 0.01 * (1 + kick * 3);
    g.beginPath(); g.ellipse(w / 2, h * 0.58, r * 1.8, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
    if (b.takt === 0 && b.phase < 0.1 && lvl > 0.15) { g.fillStyle = c([255, 255, 255], 0.14 * lvl); g.fillRect(0, 0, w, h); }
    g.restore();
  }
  audio(g, w, h) {
    const m = this.engine.masterMeter;
    m.spektrum(this.spek);
    const n = 96;
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      // logarithmische Frequenzachse
      const f0 = Math.floor(Math.pow(2, i / n * 9.5) - 1), f1 = Math.max(f0 + 1, Math.floor(Math.pow(2, (i + 1) / n * 9.5) - 1));
      let v = 0;
      for (let k = f0; k < f1 && k < this.spek.length; k++) v = Math.max(v, this.spek[k]);
      const hh = v / 255 * h * 0.8;
      const grad = g.createLinearGradient(0, h, 0, h - hh);
      grad.addColorStop(0, '#0a4cff'); grad.addColorStop(0.6, '#23a8ff'); grad.addColorStop(1, '#ff9a1a');
      g.fillStyle = grad;
      g.fillRect(i * bw + 1, h - hh, bw - 2, hh);
    }
    const zeit = new Float32Array(1024);
    m.l.getFloatTimeDomainData(zeit);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < zeit.length; i++) {
      const x = i / zeit.length * w, y = h * 0.3 - zeit[i] * h * 0.25;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = `${Math.round(h * 0.045)}px "Barlow Condensed", sans-serif`;
    g.textAlign = 'left'; g.fillText('MASTER · SPEKTRUM + SCHWINGUNG (gemessen)', 14, h * 0.15);
  }
}
