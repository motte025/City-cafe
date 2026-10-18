// Wellenform-Daten aus echtem PCM: je Fach (1/150 s) Spitze und RMS der
// Baender Tief (<200 Hz), Mitte, Hoch (>2,5 kHz). Laeuft einmal beim Laden,
// nie im Zeichen-Takt.

export const FAECHER_PRO_SEK = 150;

export function wellenform(buffer) {
  const rate = buffer.sampleRate;
  const n = buffer.length;
  const proFach = Math.max(1, Math.round(rate / FAECHER_PRO_SEK));
  const faecher = Math.ceil(n / proFach);
  const spitze = new Float32Array(faecher);
  const tief = new Float32Array(faecher), mitte = new Float32Array(faecher), hoch = new Float32Array(faecher);
  const kan = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) kan.push(buffer.getChannelData(c));
  // Einpol-Filter-Koeffizienten
  const aT = 1 - Math.exp(-2 * Math.PI * 200 / rate);
  const aH = 1 - Math.exp(-2 * Math.PI * 2500 / rate);
  let lpT = 0, lpH = 0;
  for (let f = 0; f < faecher; f++) {
    const von = f * proFach, bis = Math.min(n, von + proFach);
    let sp = 0, sT = 0, sM = 0, sH = 0;
    for (let i = von; i < bis; i++) {
      let x = 0;
      for (const d of kan) { const v = d[i]; x += v; const av = v < 0 ? -v : v; if (av > sp) sp = av; }
      x /= kan.length;
      lpT += aT * (x - lpT);
      lpH += aH * (x - lpH);
      const t = lpT, h = x - lpH, m = lpH - lpT;
      sT += t * t; sM += m * m; sH += h * h;
    }
    const z = bis - von;
    spitze[f] = sp;
    tief[f] = Math.sqrt(sT / z); mitte[f] = Math.sqrt(sM / z); hoch[f] = Math.sqrt(sH / z);
  }
  return { faecher, proSek: FAECHER_PRO_SEK, spitze, tief, mitte, hoch, dauer: n / rate };
}

// Pegel eines Blocks (fuer Meter): Spitze und RMS als linearer Wert
export function blockPegel(d) {
  let sp = 0, q = 0;
  for (let i = 0; i < d.length; i++) { const v = d[i]; const a = v < 0 ? -v : v; if (a > sp) sp = a; q += v * v; }
  return { spitze: sp, rms: Math.sqrt(q / d.length) };
}

export const zuDb = lin => (lin > 1e-6 ? 20 * Math.log10(lin) : -Infinity);
