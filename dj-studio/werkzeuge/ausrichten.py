# Skin auf Bild 2 ausrichten (affin). Aufruf:
#   python -I ausrichten.py dj-studio/img/bild2.png <skin_4K.png> <ziel.png>
# Misst an ~50 Stellen den Versatz der Kantenbilder (Skin vs Bild 2), rechnet daraus eine affine
# Korrektur (Ausreisser wie Glanzflaechen/Videobild werden schrittweise aussortiert) und schreibt
# das 3840x2160-Bild entsprechend umgerechnet. Ausgabe: Reststreuung und Anteil Stellen <= 1 px.
# Skin auf Bild 2 ausrichten: Versatz an vielen Stellen messen, affine Korrektur (kleinste Quadrate),
# 4K-Bild entsprechend umrechnen. Ausgabe 3840x2160 PNG.
import sys, os
from PIL import Image, ImageFilter, ImageChops, ImageStat
ref_p, quelle, ziel = sys.argv[1], sys.argv[2], sys.argv[3]
ref = Image.open(ref_p).convert('L').filter(ImageFilter.FIND_EDGES)
W, H = ref.size                       # 1672 x 941 (Bild-2-Pixel)
PUNKTE = [(x, y) for y in (100, 150, 210, 350, 450, 560, 640, 735) for x in (90, 300, 520, 830, 1150, 1380, 1590)]
def messen(bild, R=10, h=36):
    paare = []
    for (x, y) in PUNKTE:
        r = ref.crop((x - h, y - h, x + h, y + h))
        if ImageStat.Stat(r).stddev[0] < 12: continue     # zu wenig Struktur
        best = None
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                c = bild.crop((x - h + dx, y - h + dy, x + h + dx, y + h + dy))
                d = ImageStat.Stat(ImageChops.difference(r, c)).mean[0]
                if best is None or d < best[0]: best = (d, dx, dy)
        paare.append((x, y, x + best[1], y + best[2], best[0]))
    return paare
def loese(A, b):                      # 3x3 per Gauss
    M = [row[:] + [v] for row, v in zip(A, b)]
    for i in range(3):
        p = max(range(i, 3), key=lambda r: abs(M[r][i])); M[i], M[p] = M[p], M[i]
        for r in range(3):
            if r != i:
                f = M[r][i] / M[i][i]
                M[r] = [a - f * c for a, c in zip(M[r], M[i])]
    return [M[i][3] / M[i][i] for i in range(3)]
def affine(paare):
    # Ziel (Skin) = a*x + b*y + c  aus Referenz (x, y)
    AtA = [[0] * 3 for _ in range(3)]; Atx = [0] * 3; Aty = [0] * 3
    for x, y, sx, sy, _ in paare:
        v = (x, y, 1)
        for i in range(3):
            for j in range(3): AtA[i][j] += v[i] * v[j]
            Atx[i] += v[i] * sx; Aty[i] += v[i] * sy
    return loese(AtA, Atx), loese(AtA, Aty)
skin4k = Image.open(quelle).convert('RGB')
klein = skin4k.convert('L').resize((W, H), Image.LANCZOS).filter(ImageFilter.FIND_EDGES)
paare = messen(klein)
# robust: Ausreisser (Glanzflaechen, Videobild) schrittweise aussortieren
for grenze in (6, 3, 2):
    (a, b, c), (d, e, f) = affine(paare)
    paare = [p for p in paare if abs(a * p[0] + b * p[1] + c - p[2]) + abs(d * p[0] + e * p[1] + f - p[3]) <= grenze] or paare
(a, b, c), (d, e, f) = affine(paare)
rest = max(abs(a * x + b * y + c - sx) + abs(d * x + e * y + f - sy) for x, y, sx, sy, _ in paare)
# in 4K-Pixel umrechnen: Ausgabe (X,Y) in 4K -> Referenz x = X*W/3840 -> Skin-Bild-2-Px -> Skin-4K-Px
kx, ky = skin4k.size[0] / W, skin4k.size[1] / H
ox, oy = W / 3840, H / 2160
koeff = (a * ox * kx, b * oy * kx, c * kx, d * ox * ky, e * oy * ky, f * ky)
aus = skin4k.transform((3840, 2160), Image.AFFINE, koeff, resample=Image.BICUBIC)
aus.save(ziel)
nachher = messen(aus.convert('L').resize((W, H), Image.LANCZOS).filter(ImageFilter.FIND_EDGES), R=4)
abw = sorted(abs(sx - x) + abs(sy - y) for x, y, sx, sy, _ in nachher)
maxv = f'{sum(1 for v in abw if v <= 1)}/{len(abw)} Stellen <=1px'
print(f"{os.path.basename(quelle)[:30]:30s} Punkte {len(paare):2d}  Korrektur: Skala {a:.4f}/{e:.4f} Schiebung {c:+.1f}/{f:+.1f}  "
      f"Restfehler Modell {rest:.1f}px  nachher max {maxv}px", flush=True)