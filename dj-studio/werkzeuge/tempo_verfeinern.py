# Tempo genau aus dem ganzen Song (wie tempoVerfeinern in js/tv.js) - zum Pruefen:
#   python3 werkzeuge/tempo_verfeinern.py <videoId> [...]
# Liest ~/.cache/citycafe/spuren/<id>.json.gz (Studio-Spur des Supervisors). Sucht +-1,5 % um die
# gemessene BPM das Tempo, bei dem die Bass-Einsaetze am deutlichsten auf dem Raster liegen.
import json, gzip, os, sys, math, base64, cmath
def lade(vid):
    sp = json.load(gzip.open(os.path.expanduser(f'~/.cache/citycafe/spuren/{vid}.json.gz')))
    tief = [v / 255 for v in base64.b64decode(sp['tief'])]
    return sp, tief
def ons_von(tief): return [0.0] + [max(0.0, tief[i] - tief[i - 1]) for i in range(1, len(tief))]
def koh(ons, ps, bpm):
    w = 2 * math.pi * bpm / 60 / ps
    z = 0j; r = cmath.exp(-1j * w); e = 1 + 0j
    for v in ons:
        if v: z += v * e
        e *= r
    return z
def verfeinern(ons, ps, bpm):
    best = None
    for k in range(-150, 151):                     # +-1,5 % in 0,01-%-Schritten
        b = bpm * (1 + k / 10000)
        z = koh(ons, ps, b)
        if best is None or abs(z) > abs(best[1]): best = (b, z)
    b, z = best
    T = 60 / b
    vers = (-cmath.phase(z) / (2 * math.pi) * T) % T  # Zeit des ersten Schlags
    return b, vers, abs(z) / sum(ons)
if __name__ == '__main__':
  for vid in sys.argv[1:]:
    sp, tief = lade(vid); ps = sp['proSek']; ons = ons_von(tief)
    alt = abs(koh(ons, ps, sp['bpm'])) / sum(ons)
    b, v, k = verfeinern(ons, ps, sp['bpm'])
    print(f"{vid}: BPM {sp['bpm']} -> {b:.2f}, versatz {sp.get('versatz')} -> {v:.3f}, Deutlichkeit {alt:.3f} -> {k:.3f}")
