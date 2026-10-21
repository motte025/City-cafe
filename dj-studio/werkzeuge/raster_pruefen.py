# Passt das Taktraster ueber den ganzen Song? Je 10 s: wie weit die Bass-Schlaege neben dem
# Raster liegen. Laeuft der Wert stetig weg, stimmt die BPM nicht.
#   python3 werkzeuge/raster_pruefen.py <videoId> [bpm versatz]
# Beispiel 21.10.: Dancing Queen mit 100,1 BPM lief bis 280 ms weg, mit 100,55 meist +-30 ms.
# Passt das Taktraster (bpm, versatz der Spur) ueber den ganzen Song zu den Bass-Schlaegen?
# Je 10-s-Abschnitt: Phase der Bass-Einsaetze relativ zum Raster (0 = genau auf dem Schlag).
import json, gzip, os, sys, math, base64
vid = sys.argv[1]
sp = json.load(gzip.open(os.path.expanduser(f'~/.cache/citycafe/spuren/{vid}.json.gz')))
ps, bpm, vers = sp['proSek'], float(sys.argv[2]) if len(sys.argv) > 2 else sp['bpm'], float(sys.argv[3]) if len(sys.argv) > 3 else (sp.get('versatz') or 0.0)
tief = [v / 255 for v in base64.b64decode(sp['tief'])]
T = 60 / bpm
# Einsatz-Staerke: Anstieg des Basses
ons = [max(0.0, tief[i] - tief[i - 1]) for i in range(1, len(tief))]
print(f"{vid}: BPM {bpm}, versatz {vers:.3f}s, Laenge {len(tief)/ps:.0f}s")
for a in range(0, int(len(ons) / ps) - 10, 15):
    c = s = 0.0
    for i in range(a * ps, (a + 10) * ps):
        ph = ((i / ps - vers) % T) / T * 2 * math.pi
        c += ons[i] * math.cos(ph); s += ons[i] * math.sin(ph)
    m = math.atan2(s, c) / (2 * math.pi) * T
    if m > T / 2: m -= T
    staerke = math.hypot(c, s) / max(1e-9, sum(ons[a * ps:(a + 10) * ps]))
    print(f"  {a:4d}-{a+10:4d}s: Bass-Schlag {m*1000:+5.0f} ms neben dem Raster (Deutlichkeit {staerke:.2f})")
