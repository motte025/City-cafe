# Ton am Ausgang (vor Bluetooth) mitschneiden und gegen die Studio-Spur legen:
#   python3 werkzeuge/ausgang_mitschnitt.py <ordner/mitschnitt.wav> > <ordner/mitschnitt.json>
#   python3 werkzeuge/ausgang_vergleich.py <ordner> <videoId>
# Senke anpassen (pactl list sources short: ...monitor). 21.10.: +53 ms, Korrelation 0,969 -
# der PC liegt also genau; Verzoegerung entsteht erst im Funk/in der Box.
import wave, struct, json, gzip, base64, os, math, sys
S = sys.argv[1]; vid = sys.argv[2]
info = json.load(open(S + '/mitschnitt.json'))
w = wave.open(S + '/mitschnitt.wav'); n = w.getnframes(); rate = w.getframerate()
x = struct.unpack('<%dh' % n, w.readframes(n))
hop = rate // 200                                   # 5 ms wie die Spur
rec = []
for i in range(0, n - hop, hop):
    seg = x[i:i + hop]; p = sum(v * v for v in seg) / hop
    rec.append(10 * math.log10(p / 32768**2) if p > 0 else -90)
t_end = info['t_b']; p_end = info['p_b']
dauer_rec = n / rate
sp = json.load(gzip.open(os.path.expanduser(f'~/.cache/citycafe/spuren/{vid}.json.gz')))
ps = sp['proSek']
db = lambda k: [(v * 60 / 255 - 60 if v else -90) for v in base64.b64decode(sp.get(k) or '')]
L = db('pegelRmsL') or db('pegelRms'); R = db('pegelRmsR') or L
spur = [10 * math.log10((10**(a/10) + 10**(b/10)) / 2) for a, b in zip(L, R)]
def korr(lag):
    a, b = [], []
    for k, v in enumerate(rec):
        t_k = t_end - dauer_rec + k / 200          # Zeit des Mitschnitt-Stuecks
        pos = p_end - (t_end - t_k) + lag
        j = int(round(pos * ps))
        if 0 <= j < len(spur): a.append(v); b.append(spur[j])
    if len(a) < 100: return -1
    ma, mb = sum(a)/len(a), sum(b)/len(b)
    c = sum((u-ma)*(v-mb) for u, v in zip(a, b)); d = math.sqrt(sum((u-ma)**2 for u in a) * sum((v-mb)**2 for v in b))
    return c / d if d else -1
best = max(((korr(l / 1000), l) for l in range(-3000, 3001, 10)), key=lambda q: q[0])
fein = max(((korr(l / 1000), l) for l in range(best[1] - 5, best[1] + 6)), key=lambda q: q[0])
print(f"beste Uebereinstimmung bei {fein[1]:+d} ms (Korrelation {fein[0]:.3f}); bei 0 ms: {korr(0):.3f}")
print("(+ = der Ton am Ausgang ist schon weiter als mpv meldet, - = er liegt dahinter)")
