# Aus meter_messen.py-Ergebnis die Zeilen fuer METER_LAGE (js/skin.js) erzeugen.
#   python3 werkzeuge/meter_tabelle.py meter-mass.json
# Master: 25 Spalten; Teilung = (x1 - x0 - LED-Breite) / 24, Luecke = Teilung - Breite,
# Rechteck x = x0 - Luecke/2, Breite = 25 * Teilung; Zeilen: y, h, Zeilenluecke, Kanalluecke.
# Bild 2: letzte Master-Spalte von Hand (833,3), die Erkennung findet die dunklen nicht.
# G (GR-Saeule) kommt aus gr_messen.py und wird von Hand angehaengt.
import json, sys
m = json.load(open(sys.argv[1]))
if 'bild2' in m: m['bild2']['M']['x1'] = 833.3
r = lambda v: round(v, 2)
for s, d in m.items():
    A = [r(v) for v in d['A']]; B = [r(v) for v in d['B']]
    M = d['M']; z = M['zeilen']; br = M['breite']
    pitch = (M['x1'] - M['x0'] - br) / 24; gap = pitch - br
    y = z[0][0]; h = z[3][1] - z[0][0]; zl = ((z[1][0] - z[0][1]) + (z[3][0] - z[2][1])) / 2; kl = z[2][0] - z[1][1]
    print(f"  '{s}': {{ A: {A}, B: {B}, M: [{r(M['x0'] - gap / 2)}, {r(y)}, {r(25 * pitch)}, {r(h)}, {r(zl)}, {r(kl)}, {round(gap / pitch, 3)}] }},")
