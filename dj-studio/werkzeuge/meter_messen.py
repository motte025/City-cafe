# Kanal-Meter-Gehaeuse und Master-Raster je Skin messen (21.10.2026). Im Ordner dj-studio:
#   python3 werkzeuge/meter_messen.py [ausgabe.json]
# Je Skin: A/B = Innenkante des schwarzen Kanal-Gehaeuses [links, oben, rechts, unten] (halbe
# Hoehe zwischen Gehaeuse und Rand), M = gemaltes Master-Raster (4 Zeilen, Spalten). Danach
# werkzeuge/meter_tabelle.py: daraus die Zeilen fuer METER_LAGE in js/skin.js.
# Neuer Skin: Namen unten in 'skins' eintragen. GR-Saeule: werkzeuge/gr_messen.py.
# Misst je Skin: Kanal-Gehaeuse A/B (Innenkante L,O,R,U), Gehaeusefarbe, Master-Raster
import sys, json
from PIL import Image
skins='bild2 amber-blau blau-amber tiefglas gold weiss chrom ladys-tuerkis elfenbein carbon ladys-pink onyx champagner'.split()
def lade(s):
    pfad='img/bild2-2x.webp' if s=='bild2' else f'img/skins/{s}.webp'
    im=Image.open(pfad).convert('RGB'); return im, im.size[0]/1672
def profil(p,K,achse,f0s,f1s,von,bis,fn):
    f0,f1=int(f0s*K),int(f1s*K)
    if achse=='x': return [(i,sum(fn(p[i,y]) for y in range(f0,f1))/(f1-f0)) for i in range(int(von*K),int(bis*K))]
    return [(i,sum(fn(p[x,i]) for x in range(f0,f1))/(f1-f0)) for i in range(int(von*K),int(bis*K))]
lum=lambda c:(c[0]*299+c[1]*587+c[2]*114)/1000
def kante(p,K,achse,f0,f1,start,richtung,weite=7):
    a,b=(start,start+weite) if richtung>0 else (start-weite,start)
    pr=profil(p,K,achse,f0,f1,a,b,lum)
    if richtung<0: pr=pr[::-1]
    innen=sorted(v for _,v in pr[:5])[2]; spitze=max(v for _,v in pr); thr=innen+0.5*(spitze-innen)
    for j in range(1,len(pr)):
        if pr[j][1]>=thr:
            (i0,v0),(i1,v1)=pr[j-1],pr[j]; t=(thr-v0)/(v1-v0) if v1!=v0 else 0
            return round((i0+t*(i1-i0)+0.5)/K,2)
def laeufe(pr,a,K,thr):
    out=[];an=None
    for i,(_,v) in enumerate(pr):
        if v>=thr and an is None: an=i
        if v<thr and an is not None: out.append((an,i)); an=None
    res=[]
    for s,e in out:
        ip=lambda j0,j1:j0+((thr-pr[j0][1])/(pr[j1][1]-pr[j0][1]) if pr[j1][1]!=pr[j0][1] else 0)
        l=ip(s-1,s)+0.5; r=ip(e-1,e)+0.5
        res.append((round((a+l)/K,2),round((a+r)/K,2)))
    return res
def farbe(p,K,x0,y0,x1,y1):
    px=sorted((p[x,y] for x in range(int(x0*K),int(x1*K)) for y in range(int(y0*K),int(y1*K))),key=lum)
    c=px[len(px)//2]; return '#%02x%02x%02x'%c
erg={}
for s in skins:
    im,K=lade(s); p=im.load(); r={}
    for lab,x0 in (('A',62.0),('B',1574.0)):
        L=kante(p,K,'x',450,640,x0+8.0,-1); R=kante(p,K,'x',450,640,x0+28.0,1)
        O=round((kante(p,K,'y',x0+6.5,x0+8.0,430,-1)+kante(p,K,'y',x0+28.0,x0+29.5,430,-1))/2,2)
        U=kante(p,K,'y',x0+16.0,x0+18.5,661.5,1)
        r[lab]=[L,O,R,U]
        r[lab+'farbe']=farbe(p,K,L+0.8,450,L+2.2,640)
    max_=max
    pr=profil(p,K,'y',595,830,550,616,max_)
    z=[q for q in laeufe(pr,int(550*K),K,0.5*max(v for _,v in pr)) if q[1]-q[0]>3]
    ya,yb=z[0]; prx=profil(p,K,'x',ya+2,yb-2,584,845,max_)
    sp=[q for q in laeufe(prx,int(584*K),K,0.35*max(v for _,v in prx)) if q[1]-q[0]>3]
    r['M']={'zeilen':z,'n':len(sp),'x0':sp[0][0],'x1':sp[-1][1],'breite':round(sum(b-a for a,b in sp)/len(sp),2)}
    r['Mfarbe']=farbe(p,K,600,579,820,587)
    erg[s]=r; print(s,json.dumps(r))
json.dump(erg,open(sys.argv[1] if len(sys.argv)>1 else 'meter-mass.json','w'),indent=1)