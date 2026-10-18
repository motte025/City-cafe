// DEMO-Quelle: erzeugt Tanzmusik-Testsignale im Browser (direkt Sample fuer Sample).
// Alles ist selbst synthetisiert - keine fremden Aufnahmen, keine Rechtefrage.
// Weil wir die Noten selbst setzen, sind Tempo, Taktraster und Tonart exakt
// bekannt ("Generator-Werte", nicht gemessen) - die Oberflaeche kennzeichnet das.

const RATE = 32000;   // reicht fuer die Testsignale, spart Speicher
const TAKTE = 72;

// Camelot-Tonarten (Moll) mit MIDI-Grundton in der Bassoktave
const KEYS = {
  '4A': { name: 'f-Moll', root: 41 }, '5A': { name: 'c-Moll', root: 36 }, '6A': { name: 'g-Moll', root: 43 },
  '7A': { name: 'd-Moll', root: 38 }, '8A': { name: 'a-Moll', root: 45 }, '9A': { name: 'e-Moll', root: 40 },
  '10A': { name: 'h-Moll', root: 47 }, '11A': { name: 'fis-Moll', root: 42 },
};

export const DEMO_TITEL = [
  { id: 'd1', titel: 'Nachtfahrt', genre: 'Deep House', bpm: 124, key: '7A', seed: 11, farbe: 205 },
  { id: 'd2', titel: 'Wörthersee', genre: 'Melodic House', bpm: 126, key: '9A', seed: 23, farbe: 28 },
  { id: 'd3', titel: 'Lindwurm', genre: 'Tech House', bpm: 122, key: '4A', seed: 37, farbe: 300 },
  { id: 'd4', titel: 'Lendkanal', genre: 'Deep House', bpm: 124, key: '6A', seed: 41, farbe: 190 },
  { id: 'd5', titel: 'Kreuzbergl', genre: 'Melodic Techno', bpm: 125, key: '8A', seed: 53, farbe: 265 },
  { id: 'd6', titel: 'Alter Platz', genre: 'House', bpm: 123, key: '5A', seed: 67, farbe: 330 },
  { id: 'd7', titel: 'Minimundus', genre: 'Techno', bpm: 128, key: '10A', seed: 79, farbe: 170 },
  { id: 'd8', titel: 'Benediktiner', genre: 'Melodic House', bpm: 126, key: '11A', seed: 97, farbe: 40 },
].map(t => ({
  ...t,
  kuenstler: 'CC Demo-Generator',
  dauer: TAKTE * 4 * 60 / t.bpm,
  quelle: 'DEMO',
  keyName: KEYS[t.key].name,
}));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// Moll-Akkordfolgen in Stufen (Halbtoene ueber Grundton) - Grundtoene der Akkorde
const FOLGEN = [
  [0, 8, 3, 10],   // i - VI - III - VII
  [0, 5, 8, 7],    // i - iv - VI - v
  [0, 10, 8, 10],  // i - VII - VI - VII
  [0, 3, 10, 5],   // i - III - VII - iv
];
// Akkord-Typ je Stufe (Moll-Tonleiter): Halbtoene des Dreiklangs
const DREIKLANG = { 0: [0, 3, 7], 3: [0, 4, 7], 5: [0, 3, 7], 7: [0, 3, 7], 8: [0, 4, 7], 10: [0, 4, 7] };


// ---- Bausteine (schreiben direkt in Float32-Spuren) ------------------------
const TAU = Math.PI * 2;
const panL = p => Math.cos((p + 1) * Math.PI / 4) * Math.SQRT2;
const panR = p => Math.sin((p + 1) * Math.PI / 4) * Math.SQRT2;

function bandpass(fc, q) {   // RBJ-Biquad
  const w = TAU * fc / RATE, a = Math.sin(w) / (2 * q), a0 = 1 + a;
  return { b0: a / a0, b2: -a / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - a) / a0 };
}
const CLAP_BP = bandpass(1400, 0.9);

// Stabiler Zustandsvariablen-Tiefpass (Zavalishin/TPT), auch bei hoher Grenzfrequenz
function tiefpass(fc, q) {
  const f = { ic1: 0, ic2: 0, a1: 0, a2: 0, a3: 0 };
  f.setzen = (fc2) => {
    const g = Math.tan(Math.PI * Math.min(fc2, RATE * 0.45) / RATE), k = 1 / q;
    f.a1 = 1 / (1 + g * (g + k)); f.a2 = g * f.a1; f.a3 = g * f.a2;
  };
  f.lauf = x => {
    const v3 = x - f.ic2, v1 = f.a1 * f.ic1 + f.a2 * v3, v2 = f.ic2 + f.a2 * f.ic1 + f.a3 * v3;
    f.ic1 = 2 * v1 - f.ic1; f.ic2 = 2 * v2 - f.ic2;
    return v2;
  };
  f.setzen(fc);
  return f;
}
const HAT_A = Math.exp(-TAU * 7200 / RATE);

export async function erzeugen(t) {
  const N = Math.ceil((t.dauer + 0.5) * RATE);
  const L = new Float32Array(N), R = new Float32Array(N);
  const padL = new Float32Array(N), padR = new Float32Array(N), arpBus = new Float32Array(N);
  const r = rng(t.seed);
  const rausch = () => r() * 2 - 1;
  const beat = 60 / t.bpm, takt = beat * 4;
  const root = KEYS[t.key].root;
  const folge = FOLGEN[Math.floor(r() * FOLGEN.length)];
  const arpMuster = [[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]][Math.floor(r() * 4)];
  const bassMuster = r() < 0.5 ? 'offbeat' : 'rollend';
  const at = s => Math.round(s * RATE);

  const kick = (z, laut = 1) => {
    const n0 = at(z), len = at(0.45);
    let ph = 0;
    for (let i = 0; i < len && n0 + i < N; i++) {
      const s = i / RATE;
      ph += TAU * (46 + 114 * Math.exp(-s / 0.028)) / RATE;
      const env = (s < 0.004 ? s / 0.004 : Math.exp(-(s - 0.004) / 0.11)) * 0.9 * laut;
      let v = Math.sin(ph) * env;
      if (s < 0.002) v += rausch() * 0.25 * (1 - s / 0.002);
      L[n0 + i] += v; R[n0 + i] += v;
    }
  };
  const hat = (z, laut, lang = 0.045, pan = 0.18) => {
    const n0 = at(z), len = at(lang), gl = panL(pan), gr = panR(pan);
    let x1 = 0, y = 0;
    for (let i = 0; i < len && n0 + i < N; i++) {
      const x = rausch();
      y = HAT_A * (y + x - x1); x1 = x;
      const v = y * laut * Math.exp(-i / (len / 4.6));
      L[n0 + i] += v * gl; R[n0 + i] += v * gr;
    }
  };
  const clap = (z, laut = 1) => {
    const n0 = at(z), len = at(0.2), f = CLAP_BP;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len && n0 + i < N; i++) {
      const s = i / RATE;
      let env = 0;
      for (const [d, l, dauer] of [[0, 0.5, 0.02], [0.011, 0.42, 0.02], [0.023, 0.6, 0.16]]) if (s >= d) env += l * Math.exp(-(s - d) / (dauer / 4.6));
      const x = rausch() * env;
      const y = f.b0 * x + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      L[n0 + i] += y * 1.4 * laut; R[n0 + i] += y * 1.4 * laut;
    }
  };
  const bass = (z, m, lang) => {
    const n0 = at(z), len = at(lang + 0.02), fr = hz(m) / RATE;
    const tp = tiefpass(380, 5);
    let p = 0;
    for (let i = 0; i < len && n0 + i < N; i++) {
      const s = i / RATE;
      p += fr; const saw = 2 * (p - Math.floor(p)) - 1;
      const lo = tp.lauf(saw);
      const env = (s < 0.006 ? s / 0.006 : Math.exp(-(s - 0.006) / (lang / 6))) * 0.42;
      const v = lo * env;
      L[n0 + i] += v; R[n0 + i] += v;
    }
  };
  const pad = (z, noten, lang) => {
    const n0 = at(z), len = at(lang);
    for (const m of noten) for (const verst of [-7, 7]) {
      const fr = hz(m) * Math.pow(2, verst / 1200) / RATE, gl = panL(verst > 0 ? 0.35 : -0.35), gr = panR(verst > 0 ? 0.35 : -0.35);
      let p = r();
      for (let i = 0; i < len && n0 + i < N; i++) {
        const s = i / RATE;
        p += fr;
        const env = (s < 0.35 ? s / 0.35 : s > lang - 0.3 ? Math.max(0, (lang - s) / 0.3) : 1) * 0.055;
        const v = (2 * (p - Math.floor(p)) - 1) * env;
        padL[n0 + i] += v * gl; padR[n0 + i] += v * gr;
      }
    }
  };
  const arp = (z, m) => {
    const n0 = at(z), len = at(beat * 0.25), fr = hz(m) / RATE;
    let p = 0;
    for (let i = 0; i < len && n0 + i < N; i++) {
      const s = i / RATE;
      p += fr;
      const env = (s < 0.004 ? s / 0.004 : Math.exp(-(s - 0.004) / (beat * 0.22 / 6))) * 0.07;
      arpBus[n0 + i] += (p - Math.floor(p) < 0.5 ? 1 : -1) * env;
    }
  };

  const breakStart = 32 * takt, breakEnde = 40 * takt;
  for (let tk = 0; tk < TAKTE; tk++) {
    const t0 = tk * takt;
    const stufe = folge[Math.floor(tk / 2) % 4];
    const akkord = DREIKLANG[stufe].map(x => root + 24 + stufe + x);
    const intro = tk < 8, aufbau = tk < 16, brk = tk >= 32 && tk < 40, outro = tk >= 64;
    const drop = tk >= 40 && tk < 64;
    for (let b = 0; b < 4; b++) {
      const z = t0 + b * beat;
      if (!brk) kick(z, outro && tk >= 70 ? 0.8 : 1);
      if (!brk) hat(z + beat / 2, intro ? 0.22 : 0.3, 0.05);
      if (drop || (tk >= 16 && tk < 32)) { hat(z + beat / 4, 0.08); hat(z + beat * 3 / 4, 0.1); }
      if (!aufbau && !brk && !outro && (b === 1 || b === 3)) clap(z);
      if (!intro && !brk && !outro) {
        const m = root + stufe + (b === 3 && tk % 2 === 1 ? 12 : 0);
        if (bassMuster === 'offbeat') bass(z + beat / 2, m, beat * 0.42);
        else { bass(z + beat / 4, m, beat * 0.2); bass(z + beat / 2, m, beat * 0.2); bass(z + beat * 3 / 4, m + 12, beat * 0.18); }
      }
      if ((tk >= 16 && !outro) || brk) {
        for (let s = 0; s < 4; s++) {
          if (brk && tk < 36 && s % 2) continue;
          arp(z + s * beat / 4, akkord[arpMuster[s] % 3] + 12 + (arpMuster[s] === 3 ? 12 : 0));
        }
      }
    }
    if (tk >= 16 && tk < 64 && tk % 2 === 0) pad(t0, akkord, takt * 2);
    if (brk && tk === 39) for (let s = 0; s < 16; s++) clap(t0 + s * beat / 4, 0.4 + s / 24);   // Wirbel vor dem Drop
    if (tk % 12 === 11) await new Promise(res => setTimeout(res));    // Oberflaeche nicht blockieren
  }

  // Pad-Bus: Tiefpass, im Break langsam geoeffnet
  for (const [bus, ziel] of [[padL, L], [padR, R]]) {
    const tp = tiefpass(1500, 0.6);
    for (let i = 0; i < N; i++) {
      if (i % 64 === 0) {
        const s = i / RATE;
        tp.setzen(s < breakStart ? 1500 : s < breakEnde ? 700 * Math.pow(5200 / 700, (s - breakStart) / (breakEnde - breakStart)) : 1800);
      }
      ziel[i] += tp.lauf(bus[i]);
    }
  }
  await new Promise(res => setTimeout(res));
  // Arp: Tiefpass, trocken links, Echo (punktierte Achtel) rechts
  const aLp = 1 - Math.exp(-TAU * 3200 / RATE), D = at(beat * 0.75);
  const echo = new Float32Array(N), gl = panL(-0.45), gr = panR(0.45);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += aLp * (arpBus[i] - lp);
    arpBus[i] = lp;
    if (i >= D) echo[i] = arpBus[i - D] + 0.38 * echo[i - D];
    L[i] += lp * gl; R[i] += echo[i] * gr;
  }
  // sanfte Saettigung, dann Spitze auf -1 dBFS
  let spitze = 0;
  const k = Math.tanh(1.3);
  for (const d of [L, R]) for (let i = 0; i < N; i++) { const v = Number.isFinite(d[i]) ? Math.tanh(d[i] * 1.3) / k : 0; d[i] = v; const a = v < 0 ? -v : v; if (a > spitze) spitze = a; }
  const f = spitze > 0 ? 0.891 / spitze : 1;
  for (const d of [L, R]) for (let i = 0; i < N; i++) d[i] *= f;

  const buffer = new AudioBuffer({ numberOfChannels: 2, length: N, sampleRate: RATE });
  buffer.copyToChannel(L, 0); buffer.copyToChannel(R, 1);
  return {
    buffer,
    grid: { bpm: t.bpm, offset: 0, herkunft: 'generator' },
    abschnitte: [
      { name: 'Intro', start: 0 }, { name: 'Bass', start: 8 * takt }, { name: 'Aufbau', start: 16 * takt },
      { name: 'Break', start: breakStart }, { name: 'Drop', start: breakEnde }, { name: 'Outro', start: 64 * takt },
    ],
  };
}
