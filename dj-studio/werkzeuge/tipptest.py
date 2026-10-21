# Tipp-Test (PC zuhause, KDE): im Takt der Musik aus der Box klicken -> wie weit der gehoerte
# Schlag hinter der mpv-Position liegt (Bluetooth-Verzoegerung). Aufruf (laeuft im Test-Kiosk):
#   WAYLAND_DISPLAY=wayland-1 GDK_BACKEND=wayland python3 werkzeuge/tipptest.py <ordner> <videoId>
# Ergebnis <ordner>/tipptest.json: versatz_ms (+ = Klick nach dem Schlag laut mpv), streuung,
# Klick-Positionen. Nur die gleichmaessigen Klicks werten (siehe STAND.md 21.10.): mpv meldet die
# Position in Videobild-Schritten (24 fps = 42 ms). Song mit festem Tempo nehmen (Uptown Funk).
# Tipp-Test: im Takt klicken -> Verzoegerung zwischen mpv-Position und gehoertem Schlag.
import gi, json, socket, time, gzip, os, sys, math, urllib.request
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib
S = sys.argv[1]   # Ordner fuer tipptest.json
def mpv(p):
    s = socket.socket(socket.AF_UNIX); s.connect('/tmp/mpv-nl.sock')
    s.sendall(json.dumps({"command": ["get_property", p], "request_id": 3}).encode() + b'\n')
    b = b''
    while b'"request_id":3' not in b: b += s.recv(4096)
    s.close()
    for l in b.split(b'\n'):
        if b'"request_id":3' in l: return json.loads(l).get('data')
vid = sys.argv[2]
sp = json.load(gzip.open(os.path.expanduser(f'~/.cache/citycafe/spuren/{vid}.json.gz')))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tempo_verfeinern as vf
_t = [v / 255 for v in __import__('base64').b64decode(sp['tief'])]
bpm, vers, _k = vf.verfeinern(vf.ons_von(_t), sp['proSek'], sp['bpm'])   # genaues Raster wie im Studio
T = 60.0 / bpm
klicks = []
ZIEL = 30
fenster = Gtk.Window(title='Tipp-Test: im Takt klicken')
fenster.set_default_size(520, 300)
box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
info = Gtk.Label(label=f'Auf jeden Schlag klicken oder Leertaste ({bpm:.0f} BPM)\n0 von {ZIEL}')
knopf = Gtk.Button(label='KLICK  im Takt')
knopf.set_size_request(480, 200)
box.pack_start(info, False, False, 10); box.pack_start(knopf, True, True, 10)
fenster.add(box)
def tipp(*a):
    t0 = time.time(); p = mpv('time-pos'); t1 = time.time()
    if not isinstance(p, (int, float)): return True
    p -= (t1 - t0) / 2                      # Position im Moment des Klicks
    klicks.append(p)
    info.set_text(f'Auf jeden Schlag klicken oder Leertaste ({bpm:.0f} BPM)\n{len(klicks)} von {ZIEL}')
    if len(klicks) >= ZIEL: auswerten()
    return True
def auswerten():
    ph = [((p - vers) % T) for p in klicks[4:]]          # die ersten 4 zum Einfinden weglassen
    # Kreismittel der Phase
    c = sum(math.cos(2 * math.pi * x / T) for x in ph); s_ = sum(math.sin(2 * math.pi * x / T) for x in ph)
    m = math.atan2(s_, c) / (2 * math.pi) * T
    if m > T / 2: m -= T
    r = math.hypot(c, s_) / len(ph)                     # 1 = sehr gleichmaessig
    abw = [((x - m + T / 2) % T) - T / 2 for x in ph]
    sd = math.sqrt(sum(a * a for a in abw) / len(abw))
    erg = {'vid': vid, 'bpm': bpm, 'versatz_ms': round(m * 1000), 'streuung_ms': round(sd * 1000), 'gleichmass': round(r, 2), 'klicks': len(ph), 'pos': [round(p, 3) for p in klicks]}
    json.dump(erg, open(S + '/tipptest.json', 'w'))
    info.set_text(f"Fertig: Klick liegt {m*1000:+.0f} ms nach dem Schlag laut mpv\nStreuung {sd*1000:.0f} ms - Fenster schliesst gleich")
    GLib.timeout_add(2500, Gtk.main_quit)
knopf.connect('clicked', tipp)
fenster.connect('key-press-event', lambda w, e: tipp() if e.keyval == 32 else None)
fenster.connect('destroy', Gtk.main_quit)
fenster.show_all()
Gtk.main()
