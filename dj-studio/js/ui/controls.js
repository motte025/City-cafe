// Wiederverwendbare Bedienelemente: Drehknopf, Schieberegler, Taster.
// Sie zeigen immer den BESTAETIGTEN Wert (update) und schicken nur Wuensche (onWunsch).

export function el(tag, cls, attrs = {}, kinder = []) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of [].concat(kinder)) if (k) e.append(k);
  return e;
}

const SVG = 'http://www.w3.org/2000/svg';
const klemm = (v, a, b) => Math.min(b, Math.max(a, v));

function bogen(cx, cy, r, a0, a1) {
  const p = a => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const gross = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${gross} ${a1 > a0 ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// Drehknopf. opts: { label, min, max, null: Ruhewert, schritt, format, onWunsch, groesse }
export function knopf(opts) {
  const { min, max, schritt = (max - min) / 100, format = v => v.toFixed(1) } = opts;
  const ruhe = opts.null ?? min;
  const gr = opts.groesse || 52;
  const W = 135 * Math.PI / 180;
  const root = el('div', 'knopf' + (opts.klein ? ' knopf--klein' : ''), {
    role: 'slider', tabindex: 0, 'aria-label': opts.aria || opts.label, 'aria-valuemin': min, 'aria-valuemax': max,
    'data-ruhe': ruhe,
  });
  root.style.setProperty('--gr', gr + 'px');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('knopf-ring');
  const spur = document.createElementNS(SVG, 'path');
  spur.setAttribute('d', bogen(50, 50, 45, -W, W)); spur.setAttribute('class', 'knopf-spur');
  const wert = document.createElementNS(SVG, 'path'); wert.setAttribute('class', 'knopf-wert');
  const ticks = document.createElementNS(SVG, 'g'); ticks.setAttribute('class', 'knopf-ticks');
  for (let i = 0; i <= 10; i++) {
    const a = -W + i * (2 * W / 10);
    const l = document.createElementNS(SVG, 'line');
    l.setAttribute('x1', 50 + 49 * Math.sin(a)); l.setAttribute('y1', 50 - 49 * Math.cos(a));
    l.setAttribute('x2', 50 + 46.5 * Math.sin(a)); l.setAttribute('y2', 50 - 46.5 * Math.cos(a));
    ticks.append(l);
  }
  svg.append(ticks, spur, wert);
  const zeiger = el('div', 'knopf-zeiger', {}, [el('div', 'knopf-strich')]);
  const kappe = el('div', 'knopf-kappe', {}, [zeiger]);
  root.append(svg, kappe);
  let aktuell = ruhe;
  const winkel = v => -W + (v - min) / (max - min) * 2 * W;
  function update(v) {
    aktuell = v;
    const a = winkel(v), a0 = winkel(ruhe);
    wert.setAttribute('d', Math.abs(a - a0) < 0.01 ? '' : bogen(50, 50, 45, Math.min(a0, a), Math.max(a0, a)));
    zeiger.style.transform = `rotate(${a}rad)`;
    root.setAttribute('aria-valuenow', v);
    root.setAttribute('aria-valuetext', format(v));
    root.title = (opts.label || '') + ' ' + format(v);
    root.classList.toggle('ist-aus', Math.abs(v - ruhe) < 1e-6);
  }
  const wunsch = v => opts.onWunsch(klemm(v, min, max));
  let zieh = null;
  root.addEventListener('pointerdown', e => {
    root.setPointerCapture(e.pointerId); root.focus();
    zieh = { y: e.clientY, x: e.clientX, v: aktuell };
    e.preventDefault();
  });
  root.addEventListener('pointermove', e => {
    if (!zieh) return;
    const d = (zieh.y - e.clientY) + (e.clientX - zieh.x) * 0.5;
    const fein = e.shiftKey ? 0.25 : 1;
    wunsch(zieh.v + d / 180 * (max - min) * fein);
  });
  const ende = () => { zieh = null; };
  root.addEventListener('pointerup', ende); root.addEventListener('pointercancel', ende);
  root.addEventListener('dblclick', () => wunsch(ruhe));
  root.addEventListener('wheel', e => { e.preventDefault(); wunsch(aktuell - Math.sign(e.deltaY) * schritt * 3); }, { passive: false });
  root.addEventListener('keydown', e => {
    const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (k) { e.preventDefault(); e.stopPropagation(); wunsch(aktuell + k * schritt * (e.shiftKey ? 0.2 : 1)); }
    if (e.key === 'Home' || e.key === 'Delete') { e.preventDefault(); wunsch(ruhe); }
  });
  update(ruhe);
  const box = el('div', 'knopf-box', {}, [root, opts.label ? el('span', 'knopf-label', { text: opts.label }) : null]);
  return { el: box, knopf: root, update };
}

// Schieberegler. opts: { richtung: 'v'|'h', min, max, null, schritt, onWunsch, klasse, aria, umgekehrt }
export function regler(opts) {
  const { min = 0, max = 1, schritt = 0.01 } = opts;
  const ruhe = opts.null ?? min;
  const v = opts.richtung !== 'h';
  const root = el('div', `regler regler--${v ? 'v' : 'h'} ${opts.klasse || ''}`, {
    role: 'slider', tabindex: 0, 'aria-label': opts.aria, 'aria-orientation': v ? 'vertical' : 'horizontal',
    'aria-valuemin': min, 'aria-valuemax': max,
  });
  const spur = el('div', 'regler-spur', {}, [el('div', 'regler-fuell')]);
  const kappe = el('div', 'regler-kappe', {}, [el('div', 'regler-linie')]);
  root.append(spur, kappe);
  let aktuell = ruhe;
  const anteil = x => (x - min) / (max - min);
  function update(x) {
    aktuell = x;
    let a = anteil(x);
    if (opts.umgekehrt) a = 1 - a;
    root.style.setProperty('--anteil', a);
    root.setAttribute('aria-valuenow', x);
    if (opts.format) root.setAttribute('aria-valuetext', opts.format(x));
  }
  const wunsch = x => opts.onWunsch(klemm(x, min, max));
  const ausZeiger = e => {
    const r = spur.getBoundingClientRect();
    let a = v ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    a = klemm(a, 0, 1);
    if (opts.umgekehrt) a = 1 - a;
    return min + a * (max - min);
  };
  let zieh = null;
  root.addEventListener('pointerdown', e => {
    root.setPointerCapture(e.pointerId); root.focus();
    const k = kappe.getBoundingClientRect();
    const aufKappe = e.clientX >= k.left - 4 && e.clientX <= k.right + 4 && e.clientY >= k.top - 4 && e.clientY <= k.bottom + 4;
    zieh = { versatz: aufKappe ? ausZeiger(e) - aktuell : 0 };
    if (!aufKappe) wunsch(ausZeiger(e));
    e.preventDefault();
  });
  root.addEventListener('pointermove', e => { if (zieh) wunsch(ausZeiger(e) - zieh.versatz); });
  const ende = () => { zieh = null; };
  root.addEventListener('pointerup', ende); root.addEventListener('pointercancel', ende);
  root.addEventListener('dblclick', () => wunsch(ruhe));
  root.addEventListener('keydown', e => {
    let k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (k) {
      if (opts.umgekehrt) k = -k;
      e.preventDefault(); e.stopPropagation(); wunsch(aktuell + k * schritt * (e.shiftKey ? 0.2 : 1));
    }
    if (e.key === 'Home' || e.key === 'Delete') { e.preventDefault(); wunsch(ruhe); }
  });
  update(ruhe);
  return { el: root, update };
}

// Taster: { text, klasse, aria, onDruck, onLos, umschalt }
export function taste(opts) {
  const b = el('button', 'taste ' + (opts.klasse || ''), { type: 'button', 'aria-label': opts.aria || null, title: opts.titel || null });
  if (opts.html) b.innerHTML = opts.html; else b.textContent = opts.text || '';
  if (opts.onDruck) b.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); opts.onDruck(e); } });
  if (opts.onLos) {
    b.addEventListener('pointerup', e => opts.onLos(e));
    b.addEventListener('pointercancel', e => opts.onLos(e));
    b.addEventListener('pointerleave', e => { if (e.buttons) opts.onLos(e); });
  }
  if (opts.onKlick) b.addEventListener('click', e => opts.onKlick(e));
  // Tastatur: Enter/Leertaste wie Druck
  if (opts.onDruck) b.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); opts.onDruck(e); }
  });
  if (opts.onLos) b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onLos(e); } });
  return b;
}

export function an(b, aktiv) { b.classList.toggle('an', !!aktiv); b.setAttribute('aria-pressed', aktiv ? 'true' : 'false'); }

export const zeit = s => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0');
};
