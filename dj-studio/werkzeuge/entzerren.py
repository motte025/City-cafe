# Oertliche Entzerrung (Mesh) eines Skins auf Bild 2. Aufruf:
#   python -I entzerren.py dj-studio/img/bild2.png <quelle.png> <ziel.png> [SIGMA]
# VORSICHT: kleine SIGMA (25-60) verbeulen glaenzende Flaechen (Chrom hatte danach Beulen,
# 21.10.2026). Fuer Chrom: erst ausrichten.py, dann SIGMA 180 und noch einmal SIGMA 100.
# Oertliche Entzerrung: Versatzfeld im Raster messen, Ausreisser raus, glaetten, Mesh-Transform.
import sys, math
from PIL import Image, ImageFilter, ImageChops, ImageStat
ref_p, quelle, ziel = sys.argv[1:4]
ref = Image.open(ref_p).convert('L').filter(ImageFilter.FIND_EDGES)
W, H = ref.size
skin = Image.open(quelle).convert('RGB')
klein = skin.convert('L').resize((W, H), Image.LANCZOS).filter(ImageFilter.FIND_EDGES)
SCHRITT, HALB, R = 40, 22, 14
SIGMA = float(sys.argv[4]) if len(sys.argv) > 4 else 60
punkte = []
for y in range(30, H - 30, SCHRITT):
    for x in range(30, W - 30, SCHRITT):
        r = ref.crop((x - HALB, y - HALB, x + HALB, y + HALB))
        if ImageStat.Stat(r).stddev[0] < 18: continue
        best, zweit = None, None
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                d = ImageStat.Stat(ImageChops.difference(r, klein.crop((x - HALB + dx, y - HALB + dy, x + HALB + dx, y + HALB + dy)))).mean[0]
                if best is None or d < best[0]: best = (d, dx, dy)
        punkte.append([x, y, best[1], best[2], best[0]])
# Ausreisser: Abweichung vom Median der Nachbarn (Radius 120) > 3 px
def nachbarn(p, rad=120):
    return [q for q in punkte if q is not p and (q[0]-p[0])**2 + (q[1]-p[1])**2 <= rad*rad]
gut = []
for p in punkte:
    nb = nachbarn(p)
    if len(nb) < 3: continue
    mx = sorted(q[2] for q in nb)[len(nb)//2]; my = sorted(q[3] for q in nb)[len(nb)//2]
    if abs(p[2]-mx) + abs(p[3]-my) <= 3: gut.append(p)
print('Messpunkte', len(punkte), 'verlaesslich', len(gut))
def feld(x, y):          # geglaettetes Versatzfeld (gaussgewichtet, Radius ~80 px)
    sw = sx = sy = 0.0
    for px, py, dx, dy, _ in gut:
        w = math.exp(-((px-x)**2 + (py-y)**2) / (2*SIGMA**2))
        sw += w; sx += w*dx; sy += w*dy
    return (sx/sw, sy/sw) if sw > 1e-9 else (0.0, 0.0)
# Mesh in 4K-Ausgabe: Kacheln 128 px
fx, fy = 3840 / W, 2160 / H
kx, ky = skin.size[0] / W, skin.size[1] / H
K = 128
mesh = []
ecke = {}
def quelle_von(X, Y):
    if (X, Y) not in ecke:
        x, y = X / fx, Y / fy
        dx, dy = feld(x, y)
        ecke[(X, Y)] = ((x + dx) * kx, (y + dy) * ky)
    return ecke[(X, Y)]
for Y in range(0, 2160, K):
    for X in range(0, 3840, K):
        X2, Y2 = min(X + K, 3840), min(Y + K, 2160)
        q = (*quelle_von(X, Y), *quelle_von(X, Y2), *quelle_von(X2, Y2), *quelle_von(X2, Y))
        mesh.append(((X, Y, X2, Y2), q))
aus = skin.transform((3840, 2160), Image.MESH, mesh, resample=Image.BICUBIC)
aus.save(ziel)
# Kontrolle
k2 = aus.convert('L').resize((W, H), Image.LANCZOS).filter(ImageFilter.FIND_EDGES)
abw = []
for x, y, *_ in gut:
    r = ref.crop((x - HALB, y - HALB, x + HALB, y + HALB)); best = None
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d = ImageStat.Stat(ImageChops.difference(r, k2.crop((x - HALB + dx, y - HALB + dy, x + HALB + dx, y + HALB + dy)))).mean[0]
            if best is None or d < best[0]: best = (d, dx, dy)
    abw.append(abs(best[1]) + abs(best[2]))
print('nachher: <=1px', sum(1 for a in abw if a <= 1), 'von', len(abw), ' max', max(abw))