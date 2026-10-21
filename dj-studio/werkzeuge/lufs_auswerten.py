# Auswertung von lufs_messen.sh: wie viele Songs liegen nach dem Ausgleich innerhalb +-1,5 dB,
# fuer verschiedene Ziele (LAUT_ZIEL_LUFS) und Limiter-Grenzen - gleiche Regel wie anhebung().
#   python3 werkzeuge/lufs_auswerten.py <ordner>/ergebnis.txt
# 21.10.2026 (79 Songs): -11 LUFS 94,9 % (Limiter 28x), -14 LUFS 100 % (Limiter 4x, 74 +-0,3 dB).
import sys
d = []
for l in open(sys.argv[1]):
    t = l.split()
    if len(t) == 3:
        try: d.append((t[0], float(t[1]), float(t[2])))
        except ValueError: pass
print("Songs:", len(d))
def sim(Z, L, gain_max=15, reserve=1, absenk=15):
    ok = lim_n = 0; abw = []
    for v, I, P in d:
        w = Z - I; lim = 0
        if w > 0:
            g = max(0, min(w, gain_max, -reserve - P)); r = min(w, gain_max) - g
            if r >= 0.5: lim = min(r, L)
        else: g = max(w, -absenk)
        if abs(g) < 0.5: g = 0
        lim_n += lim > 0
        a = I + g + lim - Z; abw.append((a, v)); ok += abs(a) <= 1.5
    return 100 * ok / len(d), lim_n, min(abw)
for Z in (-11, -12, -13, -14, -15, -16):
    print(f"{Z} LUFS |", " | ".join(f"Lim {L} dB: {p:5.1f} % ({n:2d}x, leisester {m[0]:+.1f} {m[1]})"
                                     for L in (2, 3, 4) for p, n, m in [sim(Z, L)]))
