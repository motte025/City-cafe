#!/usr/bin/env python3
"""
Nightlife-mpv-Supervisor.

Beobachtet per CDP den Nightlife-Zustand des Dashboards (nlAktiv/nlGeladen) und
spielt YouTube-Eintraege mit mpv (Software-Decoder) in einem
schwebenden sway-Fenster genau ueber der Videoflaeche des Widgets ab. Das
YouTube-Embed in Chromium wird dabei angehalten und dient nur noch als
Zeitgeber der Rotation. Datei-Eintraege (nlGeladen.datei) bleiben beim
<video>-Element des Dashboards.

Ebenso den DJ-Slot: Twitch-Kanaele (djExternEintrag) per streamlink -> mpv ueber
der DJ-Buehne; das Dashboard baut dann keinen Twitch-Player.
"""
import base64
import glob
import json
import os
import random
import signal
import socket
import struct
import subprocess
import threading
import time
import urllib.request

CDP_HOST, CDP_PORT = "127.0.0.1", 9222
YTDLP = "/opt/citycafe/bin/yt-dlp"
# Dieselbe Version als Python-Zipapp (Release-Datei "yt-dlp" ohne Endung, hier
# als yt-dlp.pyz abgelegt). Die Einzeldatei oben ist mit PyInstaller gebaut und
# packt sich bei JEDEM Aufruf erst nach /tmp aus - und /tmp liegt im
# Arbeitsspeicher: pro Aufruf rund 80 MB RAM und Sekunden an CPU fuers
# Entpacken, genau dann, wenn Chromium den naechsten Slot aufbaut. Die Zipapp
# laeuft mit dem System-Python direkt aus der Datei. Liegt sie nicht da oder
# liefert sie nichts, wird die Einzeldatei genommen.
YTDLP_ZIPAPP = "/opt/citycafe/bin/yt-dlp.pyz"


def ytdlp_programme():
    if os.access(YTDLP_ZIPAPP, os.X_OK):
        return [YTDLP_ZIPAPP, YTDLP]
    return [YTDLP]


COOKIES_FROM = "chromium:/home/citycafe/.config/chromium-kiosk"
# Bestes H.264 bis 1080p (der Hardware-Decoder kann kein VP9/AV1 in brauchbarer
# Form), dazu die m4a-Tonspur. Nicht jedes Video hat 1080p60 (299) - manche
# nur 1080p30 (137).
# 1080p. Mit height<=720 braucht mpv rund 40 % weniger CPU (gemessen 95 %
# statt 161 % eines Kerns) - Ausweichweg, falls es eng wird.
FORMAT = ("bestvideo[vcodec^=avc1][height<=1080]+bestaudio[ext=m4a]"
          "/best[vcodec^=avc1][height<=1080]")


def format_waehlen(hoehe=0, fps=0):
    """Formatauswahl fuer yt-dlp nach Wunsch der Handy-Fernbedienung.
    hoehe: 0/480/720/1080, fps: 0 (egal) / 30 / 60. Immer H.264 (avc1), weil
    VP9 und AV1 auf dieser Box zu viel CPU brauchen. Der Wunsch ist eine
    Vorgabe, keine Bedingung: gibt es ihn nicht, greift der naechste Eintrag."""
    h = hoehe if hoehe in (480, 720, 1080) else 1080
    grund = f"[vcodec^=avc1][height<={h}]"
    takt = "[fps>50]" if fps == 60 else ("[fps<=31]" if fps == 30 else "")
    stufen = []
    if takt:
        stufen.append(f"bestvideo{grund}{takt}+bestaudio[ext=m4a]")
    stufen.append(f"bestvideo{grund}+bestaudio[ext=m4a]")
    stufen.append(f"best{grund}")
    return "/".join(stufen)
RETRY_FAILED_AFTER = 600   # Sekunden, bis ein fehlgeschlagenes Video neu versucht wird
POLL_SECONDS = 0.5
LOG = "/home/citycafe/nl-mpv-supervisor.log"
MPV_SOCK = "/tmp/mpv-nl.sock"
# Watchdog: so lange darf mpv bis zum ersten Bild bzw. ohne Fortschritt
# brauchen, bevor es abgeschossen wird und das YouTube-Embed weiterlaeuft.
FIRST_FRAME_TIMEOUT = 20
STALL_TIMEOUT = 10


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


# ---------- minimaler CDP-Client (kein externes Paket noetig) ----------
def ws_connect(path):
    sock = socket.create_connection((CDP_HOST, CDP_PORT), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {CDP_HOST}:{CDP_PORT}\r\n"
                  f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
                  f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        resp += sock.recv(4096)
    return sock


def ws_send_text(sock, text):
    payload = text.encode()
    mask = os.urandom(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    n = len(payload)
    if n <= 125:
        header = struct.pack("!BB", 0x81, 0x80 | n)
    elif n <= 65535:
        header = struct.pack("!BBH", 0x81, 0x80 | 126, n)
    else:
        header = struct.pack("!BBQ", 0x81, 0x80 | 127, n)
    sock.sendall(header + mask + masked)


def ws_recv_text(sock):
    def recvn(n):
        buf = b""
        while len(buf) < n:
            chunk = sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("closed")
            buf += chunk
        return buf
    _, b1 = recvn(2)
    n = b1 & 0x7F
    if n == 126:
        n = struct.unpack("!H", recvn(2))[0]
    elif n == 127:
        n = struct.unpack("!Q", recvn(8))[0]
    mask_key = recvn(4) if (b1 & 0x80) else None
    data = recvn(n)
    if mask_key:
        data = bytes(b ^ mask_key[i % 4] for i, b in enumerate(data))
    return data.decode()


def cdp_eval(page_id, expression):
    sock = ws_connect(f"/devtools/page/{page_id}")
    try:
        ws_send_text(sock, json.dumps({"id": 1, "method": "Runtime.evaluate",
                                       "params": {"expression": expression, "returnByValue": True}}))
        deadline = time.time() + 5
        while time.time() < deadline:
            obj = json.loads(ws_recv_text(sock))
            if obj.get("id") == 1:
                return obj.get("result", {}).get("result", {}).get("value")
        return None
    finally:
        sock.close()


def dashboard_page_id():
    with urllib.request.urlopen(f"http://{CDP_HOST}:{CDP_PORT}/json", timeout=5) as r:
        for t in json.load(r):
            if t["type"] == "page" and "motte025.github.io" in t.get("url", ""):
                return t["id"]
    return None


# nlGeladen.schluessel ist bei YouTube-Eintraegen die videoId selbst
# (nlSchluessel(): video.datei || video.videoId).
STATE_EXPR = """JSON.stringify({
  aktiv: typeof nlAktiv !== 'undefined' ? nlAktiv : false,
  schluessel: (typeof nlGeladen !== 'undefined' && nlGeladen) ? nlGeladen.schluessel : null,
  datei: (typeof nlGeladen !== 'undefined' && nlGeladen) ? !!nlGeladen.datei : false,
  start: (typeof nlGeladen !== 'undefined' && nlGeladen) ? nlGeladen.start : 0,
  // DJ-Slot: djExternEintrag setzt das Dashboard nur, wenn es mpv den Kanal
  // ueberlaesst (siehe djExtern() in index.html).
  dj: typeof mediaStateIndex !== 'undefined' && typeof DJ_SLOT_INDEX !== 'undefined'
      && mediaStateIndex === DJ_SLOT_INDEX,
  djKanal: (typeof djExternEintrag !== 'undefined' && djExternEintrag) ? djExternEintrag.channel : null,
  // Suchauftrag der YouTube-Fernbedienung (yt-fernbedienung.html): das
  // Dashboard legt ihn hier ab, gesucht wird hier mit yt-dlp - so braucht die
  // Fernbedienung keinen YouTube-API-Schluessel.
  suche: (typeof window.nlSucheAuftrag !== 'undefined' && window.nlSucheAuftrag) ? window.nlSucheAuftrag : null,
  // Wunsch-Aufloesung/-Bildrate vom Handy (0 = egal).
  wunsch: (typeof window.nlWunschFormat !== 'undefined' && window.nlWunschFormat) ? window.nlWunschFormat : null,
  // Vor-/Zuruecksprung vom Handy: { id, sek }
  spulen: (typeof window.nlSpulAuftrag !== 'undefined' && window.nlSpulAuftrag) ? window.nlSpulAuftrag : null,
  // Ton des Videos: { id, vol (0-100), lautheit (Ausgleich an/aus) }
  ton: (typeof window.nlTonWunsch !== 'undefined' && window.nlTonWunsch) ? window.nlTonWunsch : null,
  // Laeuft gerade eine Runde Hos'n Obe? Dann muss mpv aus bleiben - sein
  // Fenster liegt sonst ueber dem Kartentisch.
  spiel: (typeof window.ktSpielLaeuft === 'function') ? !!window.ktSpielLaeuft() : false,
  // Dart-Abend-Modus: RTSP-Dartcam. Die Adresse kommt vom Dashboard
  // (DART_CAM_URL in index.html), damit ein Kamerawechsel keinen Eingriff
  // auf der Box braucht.
  cam: (window.dartCamAktiv && window.dartCamUrl) ? String(window.dartCamUrl) : null
})"""

# Lautheitsausgleich: dynaudnorm gleicht leise und laute Stellen an und ist
# guenstig genug fuer diese Box (loudnorm waere deutlich teurer).
LAUTHEIT_FILTER = "dynaudnorm=g=5:f=250:r=0.9:p=0.5"

SUCH_TREFFER = 15         # so viele Treffer bekommt das Handy zu sehen

# Waechter fuer den Kiosk-Browser: antwortet die Debug-Schnittstelle so lange
# nicht mehr, ist Chromium haengen geblieben (nicht nur kurz beschaeftigt).
# 120 s sind reichlich - ein normaler Seitenwechsel dauert Sekunden.
KIOSK_TOT_SEKUNDEN = 120
# Danach mindestens so lange Ruhe, damit kein Neustart-Karussell entsteht:
# der frische Browser braucht selbst gut 20 s, bis er antwortet.
KIOSK_NEUSTART_SPERRE = 300
KIOSK_STARTER = "/usr/local/bin/citycafe-chromium"
# /tmp liegt im Arbeitsspeicher. Liegengebliebene Auspackordner von yt-dlp
# (_MEI...) haben es schon einmal voll laufen lassen - dann scheitert die
# Suche und der Kernel schiesst Chromium ab.
TMP_PRUEFUNG_SEKUNDEN = 30 * 60
TMP_ALTER_SEKUNDEN = 2 * 60 * 60

# Videoflaeche erst messen, wenn die Einblend-Animation (scale 1.02 -> 1) durch ist.
RECT_EXPR = """JSON.stringify((() => {
  const v = document.getElementById('%s');
  const f = document.getElementById('%s');
  if (!v || !f || !v.classList.contains('active')) return null;
  const t = getComputedStyle(v).transform;
  if (t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') return null;
  const b = f.getBoundingClientRect();
  return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)};
})())"""
FLAECHE = {"yt": ("media-view-nightlife", "nl-player-frame"),
           "twitch": ("media-view-djlive", "dj-live-player"),
           "cam": ("media-view-dart-cam", "dart-cam-frame")}
# Die Dartcam ist ein Live-Strom im Lokal-Netz: faellt sie aus, nach kurzer
# Pause neu verbinden statt zehn Minuten zu sperren wie ein kaputtes Video.
CAM_RETRY_AFTER = 5
# Mit Puffer darf die Kamera kurz haengen, ohne gleich neu verbunden zu werden -
# ein Neuverbinden selbst kostet mehrere Sekunden Schwarzbild.
CAM_STALL_TIMEOUT = 20

STREAMLINK = "/usr/bin/streamlink"
# Twitch: streamlink filtert Werbesegmente selbst heraus (seit 6.x immer, siehe
# TwitchHLSStreamWriter.should_filter_segment). Bei Werbung zum Start wartet es,
# bis sie vorbei ist - daher die laengere Frist bis zum ersten Bild.
TWITCH_QUALITAET = "1080p60,1080p,720p60,720p,best"
TWITCH_FIRST_FRAME_TIMEOUT = 60


# ---------- Sitzungsumgebung (Wayland/sway) ----------
# sway setzt WAYLAND_DISPLAY/SWAYSOCK erst nach dem Start - in /proc/<sway>/environ
# stehen sie nicht, und Chromium ueberschreibt sein environ beim Start. Die von
# sway gestarteten Kindprozesse (sh -c ... citycafe-chromium) haben die Werte.
def session_env():
    keys = ("WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "SWAYSOCK")
    if all(k in os.environ for k in keys):
        return {k: os.environ[k] for k in keys}
    sway_pid = subprocess.run(["pgrep", "-o", "-x", "sway"], capture_output=True,
                              text=True).stdout.strip()
    if not sway_pid:
        return {}
    children = subprocess.run(["pgrep", "-P", sway_pid], capture_output=True,
                              text=True).stdout.split()
    for pid in children:
        try:
            with open(f"/proc/{pid}/environ", "rb") as f:
                env = dict(kv.split("=", 1) for kv in f.read().decode().split("\0") if "=" in kv)
        except OSError:
            continue
        if "WAYLAND_DISPLAY" in env:
            return {k: env[k] for k in keys if k in env}
    return {}


def sway(*args):
    env = {**os.environ, **session_env()}
    if "SWAYSOCK" not in env:
        socks = [s for s in glob.glob("/run/user/1001/sway-ipc.*.sock")
                 if os.path.exists(f"/proc/{s.rsplit('.', 2)[-2]}")]
        if socks:
            env["SWAYSOCK"] = socks[0]
    return subprocess.run(["swaymsg", *args], env=env, capture_output=True, text=True)


def mpv_window_rect():
    """Aktuelle Lage des mpv-Fensters laut sway, None solange es nicht da ist."""
    try:
        tree = json.loads(sway("-t", "get_tree").stdout or "{}")
    except ValueError:
        return None
    todo = [tree]
    while todo:
        node = todo.pop()
        if node.get("app_id") == "mpv":
            r = node["rect"]
            return {"x": r["x"], "y": r["y"], "w": r["width"], "h": r["height"]}
        todo += node.get("nodes", []) + node.get("floating_nodes", [])
    return None


def resolve(video_id, fmt=FORMAT):
    """-> (video_url, audio_url|None) oder None"""
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", "node", "--cookies-from-browser", COOKIES_FROM,
                 "-f", fmt, "-g", f"https://www.youtube.com/watch?v={video_id}"],
                capture_output=True, text=True, timeout=30)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"{os.path.basename(programm)} fuer {video_id}: {type(fehler).__name__}")
            continue
        urls = [l for l in out.stdout.splitlines() if l.startswith("http")]
        if urls:
            return urls[0], (urls[1] if len(urls) > 1 else None)
        log(f"{os.path.basename(programm)} ohne URL fuer {video_id}: {out.stderr.strip()[-200:]}")
    return None


def suchen(text, anzahl=None):
    """YouTube-Suche fuer die Handy-Fernbedienung. -> Liste von Treffern."""
    anzahl = anzahl or SUCH_TREFFER
    out = None
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", "node", "--flat-playlist", "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s",
                 f"ytsearch{anzahl}:{text}"],
                capture_output=True, text=True, timeout=60)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"Suche mit {os.path.basename(programm)}: {type(fehler).__name__} ({text!r})")
            out = None
            continue
        if out.stdout.strip():
            break
    if out is None:
        return []
    treffer = []
    for zeile in out.stdout.splitlines():
        teile = zeile.split("\t")
        if len(teile) >= 2 and len(teile[0]) == 11:
            treffer.append({"videoId": teile[0], "titel": teile[1],
                            "kanal": teile[2] if len(teile) > 2 else "",
                            "dauer": teile[3] if len(teile) > 3 else ""})
    if not treffer:
        log(f"Suche ohne Treffer: {text!r} {out.stderr.strip()[-120:]}")
    return treffer



# --- Automatische Vorschlaege ------------------------------------------------
# Ein einziger Suchbegriff liefert 15 Treffer zum selben Thema - dafuer
# braeuchte es keine Vorschlaege, das koennte man auch eintippen. Deshalb
# werden mehrere Begriffe gleichzeitig gesucht und die Treffer reihum gemischt.
VORSCHLAG_BEGRIFFE = [
    "nightlife 4k walk", "club dj set live", "ibiza beach club 4k",
    "tokyo night walk 4k", "miami south beach 4k", "dubai night drive 4k",
    "techno festival aftermovie", "new york night walk 4k",
    "mallorca strand 4k", "las vegas strip night 4k", "rio de janeiro 4k",
    "bangkok night market 4k", "amsterdam night walk 4k", "kreuzfahrt schiff 4k",
    "santorini 4k", "dj live set rooftop", "barcelona strand 4k",
    "malediven drohne 4k", "hongkong night drive 4k", "paris bei nacht 4k",
    "oktoberfest stimmung", "apres ski party", "karibik strand 4k",
    "london night walk 4k", "silvester feuerwerk 4k", "kapstadt 4k",
    "sydney harbour 4k", "seoul night walk 4k", "venedig 4k", "island natur 4k",
]
# Bewusst wenige und NACHEINANDER: fuenf yt-dlp-Prozesse mit je einem
# node-Laufzeitsystem gleichzeitig haben den Speicher der Box gesprengt, der
# Kernel hat daraufhin Chromium-Prozesse des Kiosks abgeschossen und das
# Dashboard war weg (OOM am 21.09.2026, 01:54 bis 01:57). Vier Suchen
# hintereinander dauern rund 12 s und bleiben im Rahmen.
VORSCHLAG_BEGRIFFE_JE_LAUF = 3
# So viele automatische Vorschlaege bekommt das Handy - bewusst wenige: sie
# werden nach jedem gestarteten Video ohnehin durch passende ersetzt.
VORSCHLAG_ANZAHL = 6


def vorschlaege():
    """Gemischte Vorschlaege aus mehreren Suchbegriffen. -> Liste von Treffern."""
    begriffe = random.sample(VORSCHLAG_BEGRIFFE,
                             min(VORSCHLAG_BEGRIFFE_JE_LAUF, len(VORSCHLAG_BEGRIFFE)))
    je = max(2, -(-VORSCHLAG_ANZAHL // len(begriffe)))     # aufgerundet
    listen = {b: suchen(b, je) for b in begriffe}

    # Reihum einsammeln: erst der beste Treffer jedes Begriffs, dann der
    # zweitbeste - so stehen die Themen abwechselnd untereinander statt in
    # vier Bloecken.
    gemischt, gesehen = [], set()
    for i in range(je):
        for b in begriffe:
            liste = listen.get(b) or []
            if i < len(liste) and liste[i]["videoId"] not in gesehen:
                gesehen.add(liste[i]["videoId"])
                gemischt.append(liste[i])
    log("Vorschlaege aus " + ", ".join(begriffe) + f": {len(gemischt)} Treffer")
    return gemischt[:VORSCHLAG_ANZAHL]


def aehnliche(video_id, titel):
    """Vorschlaege, die zum gerade gestarteten Video passen.

    YouTubes eigene Mix-Liste (list=RD...) gibt yt-dlp nicht her, deshalb wird
    nach dem Titel gesucht: das liefert dieselbe Art von verwandten Videos.
    Das gestartete Video selbst faellt raus, und je Kanal kommen hoechstens
    zwei - sonst stuenden sechs Folgen derselben Reihe untereinander.
    """
    stichwort = " ".join(str(titel or "").split()[:8])
    if not stichwort:
        return vorschlaege()
    gefunden = suchen(stichwort, VORSCHLAG_ANZAHL * 2 + 2)
    ergebnis, je_kanal = [], {}
    for t in gefunden:
        if t["videoId"] == video_id:
            continue
        kanal = t.get("kanal") or ""
        if je_kanal.get(kanal, 0) >= 2:
            continue
        je_kanal[kanal] = je_kanal.get(kanal, 0) + 1
        ergebnis.append(t)
        if len(ergebnis) >= VORSCHLAG_ANZAHL:
            break
    log(f"Aehnliche zu {video_id} ({stichwort!r}): {len(ergebnis)} Treffer")
    return ergebnis or vorschlaege()


def stop(proc):
    if proc is None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def mpv_befehl(*teile):
    """Einen Befehl an mpv schicken (IPC), z. B. seek. True, wenn zugestellt."""
    try:
        with socket.socket(socket.AF_UNIX) as s:
            s.settimeout(1.0)
            s.connect(MPV_SOCK)
            s.sendall((json.dumps({"command": list(teile), "request_id": 9}) + "\n").encode())
            return True
    except (OSError, ValueError):
        return False


def mpv_time_pos():
    """time-pos ueber IPC; None, wenn mpv (noch) keine Position hat oder nicht antwortet."""
    try:
        with socket.socket(socket.AF_UNIX) as s:
            s.settimeout(1.0)
            s.connect(MPV_SOCK)
            s.sendall(b'{"command":["get_property","time-pos"],"request_id":1}\n')
            buf = b""
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    return None
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    msg = json.loads(line)
                    if msg.get("request_id") == 1:
                        return msg.get("data")
    except (OSError, ValueError):
        return None


def measured_rect(page_id, fallback, art="yt"):
    """Videoflaeche des Widgets per CDP; solange die Ansicht noch einblendet
    (transform != identity) gibt es keine Messung - dann die letzte gute."""
    raw = cdp_eval(page_id, RECT_EXPR % FLAECHE[art]) if page_id else None
    try:
        rect = json.loads(raw) if raw and raw != "null" else None
    except ValueError:
        rect = None
    return rect or fallback


def place_mpv(target):
    """mpv-Fenster auf die Zielflaeche setzen. -> True, wenn das Fenster da ist.
    Die sway-Regel allein setzt die Position nicht zuverlaessig (gesehen: mpv
    landete bei 443/450), deshalb wird bei jeder Abweichung nachgezogen."""
    cur = mpv_window_rect()
    if cur is None:
        return False
    if any(abs(cur[k] - target[k]) > 2 for k in ("x", "y", "w", "h")):
        sway('[app_id="mpv"]', "move", "absolute", "position", str(target["x"]), str(target["y"]))
        sway('[app_id="mpv"]', "resize", "set", "width", f"{target['w']} px",
             "height", f"{target['h']} px")
        log(f"mpv platziert: {cur} -> {target}")
    return True


def kiosk_neu_starten():
    """Haengenden Kiosk-Browser beenden und neu starten. -> True, wenn versucht."""
    treffer = subprocess.run(["pgrep", "-f", "chromium --ozone-platform=wayland"],
                             capture_output=True, text=True).stdout.split()
    for pid in treffer:
        try:
            os.kill(int(pid), signal.SIGTERM)
        except (ValueError, ProcessLookupError, PermissionError):
            pass
    time.sleep(5)
    for pid in treffer:
        try:
            os.kill(int(pid), signal.SIGKILL)
        except (ValueError, ProcessLookupError, PermissionError):
            pass
    ergebnis = sway("exec", KIOSK_STARTER)
    log(f"Kiosk-Browser neu gestartet ({len(treffer)} Prozesse beendet, "
        f"swaymsg {ergebnis.returncode})")
    return True


def tmp_aufraeumen():
    """Alte Auspackordner von yt-dlp in /tmp entfernen und den Platz melden."""
    jetzt = time.time()
    weg = 0
    for ordner in glob.glob("/tmp/_MEI*"):
        try:
            if jetzt - os.path.getmtime(ordner) > TMP_ALTER_SEKUNDEN:
                subprocess.run(["rm", "-rf", ordner], check=False)
                weg += 1
        except OSError:
            pass
    try:
        st = os.statvfs("/tmp")
        frei = st.f_bavail * st.f_frsize / (1024 * 1024)
    except OSError:
        frei = -1
    if weg or frei < 200:
        log(f"/tmp: {weg} alte Ordner entfernt, {frei:.0f} MB frei")


def main():
    log("Supervisor gestartet")
    # Was gerade in mpv laeuft, als Schluessel "yt:<videoId>" oder "twitch:<kanal>".
    shown = None
    mpv = None
    feeder = None         # streamlink-Prozess, der mpv bei Twitch fuettert
    cache = {}            # videoId -> (video_url, audio_url)
    failed = {}           # videoId -> Zeitpunkt des letzten yt-dlp-Fehlschlags
    mpv_bad = {}          # Schluessel -> Zeitpunkt, an dem mpv damit scheiterte
    started = last_pos = last_progress = None
    embed_paused = False  # YouTube-Embed erst anhalten, wenn mpv wirklich laeuft
    # Videoflaeche bei aktiver Ansicht (einmal live gemessen); wird bei jeder
    # erfolgreichen Messung aktualisiert. Nightlife und DJ liegen gleich.
    target = {"x": 83, "y": 248, "w": 1200, "h": 675}
    next_place_check = 0
    window_seen = False
    resolver = None       # laufender yt-dlp-Thread
    sucher = None         # laufender Such-Thread der Handy-Fernbedienung
    such_id = ""          # zuletzt bearbeiteter Suchauftrag
    spul_id = ""          # zuletzt ausgefuehrter Vor-/Zuruecksprung
    ton_id = ""           # zuletzt uebernommene Ton-Einstellung
    ton_vol = 100         # Lautstaerke des Videos in Prozent
    ton_lautheit = False  # Lautheitsausgleich an?
    streamlink_da = os.path.exists(STREAMLINK)
    letzte_antwort = time.time()   # wann der Browser zuletzt geantwortet hat
    letzter_neustart = 0.0
    naechste_tmp_pruefung = 0.0

    def blocked(key):
        frist = CAM_RETRY_AFTER if key.startswith("cam:") else RETRY_FAILED_AFTER
        return time.time() - mpv_bad.get(key, 0) < frist

    def give_back(page_id, key):
        # Bild nie einfrieren lassen: ohne mpv spielt wieder der Browser.
        # YouTube: das Embed starten (mit nlExternBis liegt es nur bereit).
        # Twitch: djExternBis = 0 - der DJ-Waechter baut den Twitch-Player.
        if not page_id:
            return
        if key.startswith("cam:"):
            cdp_eval(page_id, "window.dartCamLaeuft = false; 1")
        elif key.startswith("yt:"):
            cdp_eval(page_id, "window.nlExternBis = 0; try { nlPlayer.playVideo(); } catch (e) {} 1")
        else:
            cdp_eval(page_id, "window.djExternBis = 0; window.djExternLaeuft = false; 1")

    def stop_all():
        nonlocal mpv, feeder
        stop(mpv)
        stop(feeder)
        mpv = feeder = None

    while True:
        time.sleep(POLL_SECONDS)
        try:
            page_id = dashboard_page_id()
            state = json.loads(cdp_eval(page_id, STATE_EXPR) or "{}") if page_id else {}
        except (OSError, ValueError, ConnectionError) as e:
            log(f"CDP nicht erreichbar: {e}")
            # Antwortet der Browser laenger gar nicht mehr, haengt er. Dann
            # hilft nur ein Neustart - sonst steht das Bild, bis jemand vor Ort
            # ist. Ohne mpv davor waere das neue Fenster gleich wieder verdeckt.
            jetzt = time.time()
            if (jetzt - letzte_antwort > KIOSK_TOT_SEKUNDEN
                    and jetzt - letzter_neustart > KIOSK_NEUSTART_SPERRE):
                letzter_neustart = jetzt
                stop_all()
                shown, embed_paused = None, False
                kiosk_neu_starten()
                letzte_antwort = jetzt      # dem frischen Browser Zeit geben
            continue
        letzte_antwort = time.time()

        if time.time() >= naechste_tmp_pruefung:
            naechste_tmp_pruefung = time.time() + TMP_PRUEFUNG_SEKUNDEN
            tmp_aufraeumen()

        schluessel = state.get("schluessel")
        youtube = bool(schluessel) and not state.get("datei")
        dj_kanal = (state.get("djKanal") or "").lower() if state.get("dj") else ""

        # Was soll mpv gerade zeigen?
        if state.get("spiel"):
            # Kartenspiel hat Vorrang: das mpv-Fenster wuerde den Tisch zudecken.
            want = None
        elif youtube and state.get("aktiv"):
            want = "yt:" + schluessel
        elif state.get("cam"):
            want = "cam:" + state["cam"]
        elif dj_kanal:
            want = "twitch:" + dj_kanal
        else:
            want = None

        # Ton-Einstellung vom Handy: Lautstaerke und Lautheitsausgleich. Gilt
        # sofort im laufenden Video und fuer jedes folgende.
        ton = state.get("ton") or {}
        if ton.get("id") and ton["id"] != ton_id:
            ton_id = ton["id"]
            ton_vol = max(0, min(100, int(ton.get("vol") or 0)))
            neu_lautheit = bool(ton.get("lautheit"))
            if mpv is not None:
                mpv_befehl("set_property", "volume", ton_vol)
                if neu_lautheit != ton_lautheit:
                    if neu_lautheit:
                        mpv_befehl("af", "set", LAUTHEIT_FILTER)
                    else:
                        mpv_befehl("af", "clr", "")
            ton_lautheit = neu_lautheit
            log(f"Ton: {ton_vol} %, Lautheitsausgleich {'an' if ton_lautheit else 'aus'}")

        # Vor-/Zuruecksprung vom Handy im laufenden Video.
        sprung = state.get("spulen") or {}
        if sprung.get("id") and sprung["id"] != spul_id:
            spul_id = sprung["id"]
            sek = int(sprung.get("sek") or 0)
            if sek and mpv is not None:
                if mpv_befehl("seek", sek, "relative"):
                    log(f"Gespult: {sek:+d}s")
                    last_pos, last_progress = None, time.time()   # Watchdog nicht ausloesen

        # Suchauftrag der Handy-Fernbedienung: yt-dlp braucht ein paar Sekunden,
        # deshalb im eigenen Thread - die Schleife muss weiterlaufen.
        auftrag = state.get("suche") or {}
        if (auftrag.get("id") and auftrag["id"] != such_id
                and not (sucher is not None and sucher.is_alive())):
            such_id = auftrag["id"]

            def suchlauf(sid=such_id, text=str(auftrag.get("text", ""))[:100], seite=page_id,
                         gemischt=bool(auftrag.get("vorschlaege")),
                         aehnlich=str(auftrag.get("aehnlichZu") or "")[:20]):
                # Automatische Vorschlaege beim Oeffnen der Fernbedienung:
                # mehrere Begriffe gemischt statt 15 Treffer zu einem Thema.
                if aehnlich:
                    treffer = aehnliche(aehnlich, text)
                elif gemischt:
                    treffer = vorschlaege()
                else:
                    treffer = suchen(text)
                if not gemischt:
                    log(f"Suche {text!r}: {len(treffer)} Treffer")
                try:
                    cdp_eval(seite, "window.nlSucheTreffer = "
                             + json.dumps({"id": sid, "liste": treffer}) + "; 1")
                except (OSError, ValueError, ConnectionError) as e:
                    log(f"Treffer nicht zustellbar: {e}")
            sucher = threading.Thread(target=suchlauf, daemon=True)
            sucher.start()

        # Vorladen: URL schon aufloesen, solange der Slot noch nicht dran ist.
        # Klappt es nicht, spielt einfach das YouTube-Embed wie bisher weiter.
        # yt-dlp braucht 10-25 s - deshalb im eigenen Thread, sonst stuende die
        # Schleife so lange still und mpv liefe bei Slot-Ende ins naechste
        # Widget hinein (so gesehen: ~25 s).
        # Wunsch-Aufloesung/-Bildrate vom Handy: eigener Cache-Schluessel, sonst
        # laege noch die Adresse der vorigen Qualitaet bereit.
        wunsch = state.get("wunsch") or {}
        w_hoehe = int(wunsch.get("hoehe") or 0)
        w_fps = int(wunsch.get("fps") or 0)
        fmt = format_waehlen(w_hoehe, w_fps)
        cache_key = f"{schluessel}|{w_hoehe}|{w_fps}"

        recently_failed = time.time() - failed.get(schluessel, 0) < RETRY_FAILED_AFTER
        busy = resolver is not None and resolver.is_alive()
        if youtube and cache_key not in cache and not recently_failed and not busy:
            def work(key=cache_key, vid=schluessel, auswahl=fmt):
                urls = resolve(vid, auswahl)
                if urls:
                    cache[key] = urls
                    for old in list(cache)[:-3]:   # nur die letzten paar behalten
                        cache.pop(old, None)
                    log(f"Vorgeladen: {key}")
                else:
                    failed[vid] = time.time()
            resolver = threading.Thread(target=work, daemon=True)
            resolver.start()

        if mpv is not None and want != shown:
            log(f"Slot vorbei ({shown})")
            stop_all()
            shown, embed_paused = None, False

        if mpv is not None:
            now = time.time()
            art = shown.split(":", 1)[0]
            if art == "cam" and mpv.poll() is not None:
                # Kamera-Strom abgerissen: gleich neu verbinden (CAM_RETRY_AFTER).
                log(f"Dartcam beendet (Code {mpv.returncode}) - verbinde neu")
                stop_all()
                give_back(page_id, shown)
                mpv_bad[shown] = now
                shown, embed_paused = None, False
                continue
            if mpv.poll() is not None and mpv.returncode == 0 and last_pos is not None:
                # Sauberes Ende, nachdem wirklich etwas gelaufen ist: das Video
                # ist aus bzw. der Streamer hat beendet. Bei einer Wahl vom
                # Handy soll die Rotation dann SOFORT weitergehen - sonst liefe
                # die gewaehlte Zeit stur weiter und der Browser spielte
                # dasselbe noch einmal von vorn. Ohne erstes Bild (last_pos
                # None) ist es kein Ende, sondern ein Fehlstart: dann wie
                # bisher zurueck zum Browser-Player.
                stop_all()
                fertig = "nlVideoFertig" if art == "yt" else "djStreamFertig"
                weiter = False
                try:
                    weiter = bool(cdp_eval(page_id, "(() => { try { return !!"
                                           + fertig + "(); } catch (e) { return false; } })()"))
                except (OSError, ValueError, ConnectionError):
                    pass
                log(f"Ende ({shown})" + (" - Rotation weiter" if weiter
                                         else " - zurueck zum Browser-Player"))
                if not weiter:
                    give_back(page_id, shown)
                shown, embed_paused = None, False
                continue
            if mpv.poll() is not None:
                problem = f"mpv beendet (Code {mpv.returncode})"
            else:
                # Lage pruefen: bis das Fenster sitzt jede Runde, danach alle 5 s.
                if now >= next_place_check:
                    target = measured_rect(page_id, target, art)
                    if place_mpv(target):
                        if not window_seen:
                            window_seen = True
                            log(f"mpv-Fenster da nach {now - started:.1f}s")
                        next_place_check = now + 5
                pos = mpv_time_pos()
                if pos is not None and (last_pos is None or pos > last_pos + 0.05):
                    if last_pos is not None and window_seen and art == "yt" and not embed_paused:
                        # Fenster sitzt und die Position waechst = mpv spielt
                        # sichtbar; ab da muss Chromium nicht mehr mitdekodieren.
                        cdp_eval(page_id, "try { nlPlayer.pauseVideo(); } catch (e) {} 1")
                        embed_paused = True
                        log(f"mpv laeuft nach {now - started:.1f}s, Embed angehalten")
                    elif last_pos is not None and window_seen and art == "cam" and not embed_paused:
                        embed_paused = True
                        cdp_eval(page_id, "window.dartCamLaeuft = true; 1")
                        log(f"Dartcam laeuft nach {now - started:.1f}s")
                    elif last_pos is not None and window_seen and art == "twitch" and not embed_paused:
                        embed_paused = True   # hier nur: "laeuft" schon gemeldet
                        log(f"mpv laeuft nach {now - started:.1f}s")
                    last_pos, last_progress = pos, now
                problem = None
                erste_frist = TWITCH_FIRST_FRAME_TIMEOUT if art == "twitch" else FIRST_FRAME_TIMEOUT
                if last_pos is None and now - started > erste_frist:
                    problem = f"mpv ohne erstes Bild nach {erste_frist}s"
                elif last_pos is not None and now - last_progress > (CAM_STALL_TIMEOUT if art == "cam" else STALL_TIMEOUT):
                    problem = f"mpv steht bei {last_pos:.1f}s"
            if problem:
                log(f"{problem} ({shown}) - zurueck zum Browser-Player")
                if mpv.poll() is None:
                    mpv.kill()
                    mpv.wait()
                stop_all()
                give_back(page_id, shown)
                mpv_bad[shown] = now
                shown, embed_paused = None, False

        # Lebenszeichen ans Dashboard (siehe nlExtern()/djExtern() in index.html):
        # nur wenn mpv spielen kann, startet der Slot seinen Browser-Player nicht.
        # Gilt 3 s - stirbt der Supervisor, spielt das Dashboard wieder allein.
        nl_ok = youtube and cache_key in cache and not blocked("yt:" + schluessel)
        dj_ok = streamlink_da and not (dj_kanal and blocked("twitch:" + dj_kanal))
        dj_laeuft = bool(shown and shown.startswith("twitch:") and embed_paused)
        if page_id:
            try:
                cdp_eval(page_id,
                         f"window.nlExternBis = {'Date.now() + 3000' if nl_ok else '0'}; "
                         f"window.djExternBis = {'Date.now() + 3000' if dj_ok else '0'}; "
                         f"window.djExternLaeuft = {'true' if dj_laeuft else 'false'}; 1")
            except (OSError, ValueError, ConnectionError):
                pass

        if want and mpv is None and not blocked(want):
            # Software-Decoding: der Amlogic-Hardware-Decoder (v4l2m2m) blieb im
            # Test bei 3 von 12 Starts vor dem ersten Bild haengen, Software bei 0.
            # --vo=gpu --profile=fast: die Standard-Skalierung von gpu-next ist
            # der Mali-GPU zu teuer (gemessen 40-48 verworfene Bilder/s),
            # mit einfacher Skalierung 0,1-0,2/s.
            # --sid=no: nie Untertitel, auch keine im Videostrom eingebetteten.
            # --demuxer-max-*: mpv puffert Netzstroeme sonst bis 150 MiB voraus
            # und haelt 50 MiB Rueckblick - auf der Box mit 2 GB RAM, neben
            # Chromium, zu viel. 48 MiB sind bei 1080p immer noch rund eine
            # Minute Vorlauf; zurueckgespult wird im Slot nur per Fernbedienung.
            args = ["mpv", "--hwdec=no", "--vo=gpu", "--profile=fast", "--sid=no",
                    "--demuxer-max-bytes=48MiB", "--demuxer-max-back-bytes=8MiB",
                    "--no-osc", "--osd-level=0", "--no-input-default-bindings",
                    "--really-quiet", "--input-ipc-server=/tmp/mpv-nl.sock",
                    "--log-file=/home/citycafe/mpv-nl.log", f"--volume={ton_vol}"]
            if ton_lautheit:
                args.append(f"--af={LAUTHEIT_FILTER}")
            env = {**os.environ, **session_env()}
            if want.startswith("yt:") and nl_ok:
                video_url, audio_url = cache[cache_key]
                start = state.get("start") or 0
                args.append(f"--start={start}")
                if audio_url:
                    args.append(f"--audio-file={audio_url}")
                args.append(video_url)
                mpv = subprocess.Popen(args, env=env, preexec_fn=mpv_dies_with_us)
                log(f"Auftritt: {schluessel} ab {start}s"
                    + (f" (Wunsch {w_hoehe or 1080}p{w_fps or ''})" if (w_hoehe or w_fps) else ""))
            elif want.startswith("twitch:") and dj_ok:
                feeder = subprocess.Popen(
                    [STREAMLINK, "--stdout", "--loglevel", "info",
                     f"twitch.tv/{dj_kanal}", TWITCH_QUALITAET],
                    stdout=subprocess.PIPE, stderr=open("/home/citycafe/streamlink.log", "w"),
                    preexec_fn=mpv_dies_with_us)
                mpv = subprocess.Popen(args + ["-"], stdin=feeder.stdout, env=env,
                                       preexec_fn=mpv_dies_with_us)
                feeder.stdout.close()   # gehoert jetzt mpv allein
                log(f"Auftritt: Twitch {dj_kanal}")
            elif want.startswith("cam:"):
                # RTSP ueber TCP (UDP geht im WLAN gern verloren), ohne Ton
                # (Kneipenlaerm). 3 s Puffer: ganz ohne (low-latency, cache=no)
                # ruckelte das Bild am 26.09. bei jeder Netzschwankung - ein
                # paar Sekunden Verzoegerung stoeren beim Dart nicht.
                # framedrop=vo: lieber ein Bild auslassen als hinterherhinken.
                mpv = subprocess.Popen(args + ["--rtsp-transport=tcp", "--no-audio",
                                               "--cache=yes", "--cache-secs=3",
                                               "--demuxer-readahead-secs=3",
                                               "--framedrop=vo", want[4:]],
                                       env=env, preexec_fn=mpv_dies_with_us)
                log("Auftritt: Dartcam")
            if mpv is not None:
                shown = want
                started, last_pos, last_progress, embed_paused = time.time(), None, None, False
                next_place_check, window_seen = 0, False


def mpv_dies_with_us():
    """Im mpv-Kindprozess: SIGKILL, sobald der Supervisor stirbt (PR_SET_PDEATHSIG).
    Sonst liefe mpv ohne Aufsicht ueber alle folgenden Widgets weiter."""
    import ctypes, signal
    ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, signal.SIGKILL)


if __name__ == "__main__":
    import traceback
    # Kein Fehler darf den Supervisor beenden (so passiert: CDP-Timeout waehrend
    # einer Messung - mpv lief danach ueber dem DJ-Slot weiter). Bei einem Fehler:
    # protokollieren, mpv weg, Embed freigeben, frisch anfangen.
    while True:
        try:
            main()
        except Exception:
            log("Fehler, Neustart der Schleife:\n" + traceback.format_exc())
            subprocess.run(["pkill", "-u", str(os.getuid()), "-x", "mpv"])
            try:
                pid = dashboard_page_id()
                if pid:
                    cdp_eval(pid, "window.nlExternBis = 0; window.djExternBis = 0; window.djExternLaeuft = false; "
                                  "if (nlAktiv) { try { nlPlayer.playVideo(); } catch (e) {} } 1")
            except Exception:
                pass
            time.sleep(2)
