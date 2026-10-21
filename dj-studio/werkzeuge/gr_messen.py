# Gehaeuse der GR-/Pegelsaeule je Skin messen (Innenkante [links, oben, rechts, unten]).
#   python3 werkzeuge/gr_messen.py   (im Ordner dj-studio)
# Achtung: Bei hellen Skins mit Leiste oben (Elfenbein, Blau-Amber, Champagner) fand die Kante
# die Leiste (536 statt 541) - Oberkante dort von Hand geprueft: 541,1 / 540,6 / 541,1.
import sys, json
from PIL import Image
lum=lambda c:(c[0]*299+c[1]*587+c[2]*114)/1000
def profil(p,K,achse,f0s,f1s,von,bis):
    f0,f1=int(f0s*K),int(f1s*K)
    if achse=='x': return [(i,sum(lum(p[i,y]) for y in range(f0,f1))/(f1-f0)) for i in range(int(von*K),int(bis*K))]
    return [(i,sum(lum(p[x,i]) for x in range(f0,f1))/(f1-f0)) for i in range(int(von*K),int(bis*K))]
def kante(p,K,achse,f0,f1,start,richtung,weite=6):
    a,b=(start,start+weite) if richtung>0 else (start-weite,start)
    pr=profil(p,K,achse,f0,f1,a,b)
    if richtung<0: pr=pr[::-1]
    innen=sorted(v for _,v in pr[:3])[1]; spitze=max(v for _,v in pr); thr=innen+0.5*(spitze-innen)
    for j in range(1,len(pr)):
        if pr[j][1]>=thr:
            (i0,v0),(i1,v1)=pr[j-1],pr[j]; t=(thr-v0)/(v1-v0) if v1!=v0 else 0
            return round((i0+t*(i1-i0)+0.5)/K,2)
def gap(p,K,achse,f0,f1,von,bis):
    # dunkelste Stelle (Rand zwischen LEDs und Gehaeusekante)
    pr=profil(p,K,achse,f0,f1,von,bis); i=min(pr,key=lambda q:q[1])[0]; return (i+0.5)/K
for s in 'bild2 amber-blau blau-amber tiefglas gold weiss chrom ladys-tuerkis elfenbein carbon ladys-pink onyx champagner'.split():
    im=Image.open('img/bild2-2x.webp' if s=='bild2' else f'img/skins/{s}.webp').convert('RGB');K=im.size[0]/1672;p=im.load()
    gl=gap(p,K,'x',560,630,959,964); gr=gap(p,K,'x',560,630,979,985)
    L=kante(p,K,'x',560,630,gl,-1); R=kante(p,K,'x',560,630,gr,1)
    go=gap(p,K,'y',964,980,537,543.5); gu=gap(p,K,'y',964,980,640,647)
    O=kante(p,K,'y',964,980,go,-1); U=kante(p,K,'y',964,980,gu,1)
    print(f"  '{s}': [{L}, {O}, {R}, {U}],   # Rand-Mitten {gl:.1f} {gr:.1f} {go:.1f} {gu:.1f}")