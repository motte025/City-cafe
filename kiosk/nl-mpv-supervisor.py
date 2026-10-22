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
import gzip
import io
import json
import math
import os
import random
import re
import signal
import socket
import struct
import subprocess
import tempfile
import threading
import time
import unicodedata
import urllib.parse
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


# CITYCAFE_COOKIES: anderes Browser-Profil (Test im Fenster auf dem PC)
COOKIES_FROM = os.environ.get("CITYCAFE_COOKIES", "chromium:/home/citycafe/.config/chromium-kiosk")
# CITYCAFE_JS_RUNTIME: JavaScript fuer yt-dlp (W1: node; geht auch deno)
JS_RUNTIME = os.environ.get("CITYCAFE_JS_RUNTIME", "node")
# Bestes H.264 bis 1080p (der Hardware-Decoder kann kein VP9/AV1 in brauchbarer
# Form), dazu die m4a-Tonspur. Nicht jedes Video hat 1080p60 (299) - manche
# nur 1080p30 (137).
# 1080p. Mit height<=720 braucht mpv rund 40 % weniger CPU (gemessen 95 %
# statt 161 % eines Kerns) - Ausweichweg, falls es eng wird.
# Seit dem W1 (Radeon 780M, VA-API fuer VP9/AV1) kein H.264-Zwang mehr:
# yt-dlp nimmt bei gleicher Aufloesung den besseren Codec (AV1/VP9).
# Nie HDR (22.10.2026): der TV laeuft ohne HDR (wirkt blass), und die HDR-Fassung ist 3-4x so gross
# (475 MB fuer 10 min) - sie kam nicht in Gang. [dynamic_range=?SDR]: SDR oder ohne Angabe.
SDR = "[dynamic_range=?SDR]"
FORMAT = f"bestvideo[height<=1080]{SDR}+bestaudio/bestvideo[height<=1080]+bestaudio/best[height<=1080]"


def format_waehlen(hoehe=0, fps=0):
    """Formatauswahl fuer yt-dlp nach Wunsch der Handy-Fernbedienung.
    hoehe: 0/480/720/1080, fps: 0 (egal) / 30 / 60. Jeder Codec (der W1
    dekodiert VP9/AV1 per VA-API), CITYCAFE_NUR_H264=1 erzwingt wieder H.264.
    Der Wunsch ist eine Vorgabe, keine Bedingung: gibt es ihn nicht, greift
    der naechste Eintrag."""
    h = hoehe if hoehe in (480, 720, 1080) else 1080
    grund = ("[vcodec^=avc1]" if MUSIK_NUR_H264 else "") + f"[height<={h}]"
    takt = "[fps>50]" if fps == 60 else ("[fps<=31]" if fps == 30 else "")
    stufen = []
    if takt:
        stufen.append(f"bestvideo{grund}{SDR}{takt}+bestaudio[ext=m4a]")
    stufen.append(f"bestvideo{grund}{SDR}+bestaudio[ext=m4a]")
    stufen.append(f"bestvideo{grund}+bestaudio[ext=m4a]")
    stufen.append(f"bestvideo{grund}+bestaudio")
    stufen.append(f"best{grund}")
    return "/".join(stufen)


# Musik (Warteschlange, Radio-Mix, Playlists - YOUTUBE-MUSIK-SETUP.md 5.6):
# 1080p60, sonst die naechstbeste Stufe - Aufloesung vor Bildrate (1080p30 ist
# auf dem TV schaerfer als 720p60), dann der beste Codec (AV1/VP9). Kein hartes
# H.264-Filter: der W1 (Radeon 780M) dekodiert VP9 und AV1 per VA-API, am
# 02.10.2026 gemessen 17-19 % eines Kerns fuer 1080p60 in allen drei Codecs.
# "res" zaehlt die kleinere Kantenlaenge, Breitbild 1920x804 gilt als 1080p.
# CITYCAFE_NUR_H264=1 erzwingt wieder H.264 (fuer schwaechere Geraete).
# Nightlife nutzt format_waehlen(), DJ bleibt bei TWITCH_QUALITAET.
MUSIK_NUR_H264 = os.environ.get("CITYCAFE_NUR_H264", "") == "1"


def musik_format(hoehe=0, fps=0):
    """-> (format, sortierung) fuer yt-dlp. hoehe/fps vom Handy sind Obergrenzen."""
    h = hoehe if hoehe in (480, 720, 1080) else 1080
    f = 30 if fps == 30 else 60
    # -S "fps:30" bevorzugt nur, begrenzt aber nicht - 30 fps vom Handy ist
    # eine Obergrenze (schwaches WLAN), darum dann vorne ein hartes Filter.
    takt = "[fps<=31]" if f == 30 else ""
    codec = "[vcodec^=avc1]" if MUSIK_NUR_H264 else ""
    stufen = [f"bv*{codec}{SDR}{takt}+ba[ext=m4a]", f"bv*{codec}{SDR}{takt}+ba"] if takt else []
    stufen += [f"bv*{codec}{SDR}+ba[ext=m4a]", f"bv*{codec}{SDR}+ba", f"bv*{codec}+ba[ext=m4a]", f"bv*{codec}+ba", f"b{codec}", "b"]
    sortierung = f"res:{h},fps:{f}" + (",vcodec:avc1" if MUSIK_NUR_H264 else "") + ",acodec:m4a"
    return "/".join(stufen), sortierung
RETRY_FAILED_AFTER = 600   # Sekunden, bis ein fehlgeschlagenes Video neu versucht wird
POLL_SECONDS = 0.5
LOG = "/home/citycafe/nl-mpv-supervisor.log"
MPV_SOCK = "/tmp/mpv-nl.sock"
# Ueberblendung zwischen Musiktiteln (DJ-Art): der naechste Song startet in
# einem zweiten mpv (eigener Socket, eigene app_id, unsichtbar), dann wird
# XF_SEK lang der alte leiser und der neue lauter und sichtbar. Danach ist der
# zweite der Haupt-Player: sein Socket wird auf MPV_SOCK umbenannt, und die
# app_id wechselt zwischen "mpv" und "mpvxf" (MPV_APP["id"] = aktueller).
MPV_SOCK_XF = "/tmp/mpv-nl-xf.sock"
# Ueberblendung fest 9 s (Betreiber 21.10.2026, vorher am Handy 4/6/9 s), genau berechnet:
# der Ton wechselt in den letzten XF_TON_FENSTER_SEK vor dem Musikende des alten Songs
# (STILLE "ende"), und genau zu Beginn dieses Fensters ist der neue an seinem Musikanfang
# (STILLE "anfang"). Davor laeuft der neue ab "anfang - 7 s" stumm im Bild ein. So gibt es
# weder ein Loch (alter schon leise, neuer noch im Intro) noch zwei Songs uebereinander.
# Der neue mpv startet XF_VORLAUF_SEK frueher angehalten und wird sekundengenau losgelassen -
# seine Ladezeit (1-3 s, selten mehr) verschiebt den Punkt nicht mehr.
XF_SEK = 9
XF_TON_FENSTER_SEK = 2.0   # so lange wechselt der Ton (equal power, siehe ueberblenden)
XF_VORLAUF_SEK = 6         # so viel frueher wird der neue Song angehalten geladen
XF_START_FRIST = 15        # so lange darf der neue mpv bis zum ersten Bild brauchen (vorher 6)
MPV_APP = {"id": "mpv"}
# Watchdog: so lange darf mpv bis zum ersten Bild bzw. ohne Fortschritt
# brauchen, bevor es abgeschossen wird und das YouTube-Embed weiterlaeuft.
FIRST_FRAME_TIMEOUT = 20
STALL_TIMEOUT = 10
# mpv-Darstellung je Geraet. Die Vorgaben sind die des ODROID N2+ (Software-
# Decoding, kleine Puffer, 2 GB RAM) - ohne Umgebungsvariablen aendert sich dort
# nichts. Auf dem x86-Rechner (ACEMAGIC W1, AMD) gesetzt, z. B. in
# ~/.config/environment.d/citycafe.conf oder im sway-Start:
#   CITYCAFE_HWDEC=vaapi        (oder "auto-safe"; Standard "no")
#   CITYCAFE_DEMUXER_MIB=150    (Vorlauf-Puffer, Standard 48)
#   CITYCAFE_DEMUXER_BACK_MIB=50
#   CITYCAFE_MPV_PROFILE=gpu-hq (Standard "fast"; mit dem Standard-VO "gpu")
MPV_HWDEC = os.environ.get("CITYCAFE_HWDEC", "no")
MPV_DEMUXER_MIB = os.environ.get("CITYCAFE_DEMUXER_MIB", "48")
MPV_DEMUXER_BACK_MIB = os.environ.get("CITYCAFE_DEMUXER_BACK_MIB", "8")
MPV_PROFILE = os.environ.get("CITYCAFE_MPV_PROFILE", "fast")
#   CITYCAFE_CAM_CACHE_SECS=8   (Dartcam-Puffer in Sekunden, Standard 3)
CAM_CACHE_SECS = os.environ.get("CITYCAFE_CAM_CACHE_SECS", "3")


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass
    ueberwachung_pruefen(msg)


# ---------- Ueberwachung (22.10.2026, Betreiber: "Fehler sofort fixen koennen") ----------
# Probleme aus dem eigenen Log, der TV-Seite (window.nlFehler) und dem System kommen
# 1. mit Datum ins Problem-Protokoll (PROBLEM_LOG; das Hauptlog hat nur Uhrzeiten),
# 2. in die Statistik des Betriebstags (8:30 bis 8:30, TAGE_ORDNER/<tag>.json) - daraus wird
#    morgens der Tagesbericht im Repo (berichte/W1-<tag>.md, mit dem Messdaten-Upload),
# 3. ernste sofort als Warnung ans Chef-Handy (window.nlWarnung -> Status -> Fernbedienung).
PROBLEM_LOG = "/home/citycafe/citycafe-probleme.log"
TAGE_ORDNER = os.path.expanduser("~/.cache/citycafe/tage")
# (Muster, Art, ernst)
PROBLEM_MUSTER = [
    (r"mpv steht bei", "Haenger", True),
    (r"mpv ohne erstes Bild", "Startfehler", True),
    (r"Ueberblendung abgebrochen", "Blende abgebrochen", True),
    (r"Notbremse", "Notbremse", True),
    (r"zu spaet|spielt erst", "Blende zu spaet", False),
    (r"neuer Song erst nach", "Laden langsam", False),
    (r"Seite haengt beim Laden", "Seite hing", True),
    (r"nicht zustellbar", "TV nicht erreichbar", False),
    (r"Supervisor gestartet", "Neustart", False),
    (r"Repo-Daten: nicht hochgeladen|Notfall-Kopie nicht aufgefrischt", "Upload", False),
    (r"Takt \S+: nicht gerechnet", "Takt", False),
    (r"Vormessen: 3 Fehler", "Vormessen", False),
    (r"Notfall-Kopie laeuft", "Notfall-Kopie", True),
]
ZAEHL_MUSTER = [(r"^Ueberblendung: ", "blenden"), (r"^Ueberblendung fertig", "blenden_fertig"),
                (r"^Auftritt: .*\(Musik\)", "songs_gestartet")]
WARNUNG = {}               # {"text", "ts"} - zuletzt ernstes Problem, fuer das Chef-Handy
UEBERW = {"tag": None, "daten": None, "gespeichert": 0.0, "lock": threading.Lock()}


def betriebstag(t=None):
    return time.strftime("%Y-%m-%d", time.localtime((t or time.time()) - 8.5 * 3600))


def tag_daten():
    """Statistik des laufenden Betriebstags (beim Tageswechsel die alte speichern)."""
    tag = betriebstag()
    if UEBERW["tag"] != tag:
        if UEBERW["daten"] is not None:
            tag_speichern()
        try:
            with open(os.path.join(TAGE_ORDNER, tag + ".json")) as f:
                daten = json.load(f)
        except (OSError, ValueError):
            daten = {"tag": tag, "zaehler": {}, "probleme": [], "max": {}, "min": {}}
        UEBERW["tag"], UEBERW["daten"] = tag, daten
    return UEBERW["daten"]


def tag_speichern():
    d = UEBERW["daten"]
    if d is None:
        return
    try:
        os.makedirs(TAGE_ORDNER, exist_ok=True)
        ziel = os.path.join(TAGE_ORDNER, d["tag"] + ".json")
        with open(ziel + ".tmp", "w") as f:
            json.dump(d, f)
        os.replace(ziel + ".tmp", ziel)
        for alt in sorted(glob.glob(os.path.join(TAGE_ORDNER, "*.json")))[:-30]:
            os.remove(alt)
    except OSError:
        pass
    UEBERW["gespeichert"] = time.time()


def problem(art, text, ernst=False):
    """Ein Problem festhalten (nie log() aufrufen - log() ruft hierher)."""
    jetzt = time.time()
    with UEBERW["lock"]:
        d = tag_daten()
        d["zaehler"][art] = d["zaehler"].get(art, 0) + 1
        if len(d["probleme"]) < 300:
            d["probleme"].append([time.strftime("%H:%M:%S", time.localtime(jetzt)), art, str(text)[:200]])
        if ernst:
            WARNUNG.update(text=f"{art}: {str(text)[:120]}", ts=int(jetzt))
        if jetzt - UEBERW["gespeichert"] > 60:
            tag_speichern()
    try:
        with open(PROBLEM_LOG, "a") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(jetzt))} [{art}] {text}\n")
    except OSError:
        pass


def ueberwachung_pruefen(msg):
    try:
        for muster, art, ernst in PROBLEM_MUSTER:
            if re.search(muster, msg):
                problem(art, msg, ernst)
                return
        for muster, name in ZAEHL_MUSTER:
            if re.search(muster, msg):
                with UEBERW["lock"]:
                    z = tag_daten()["zaehler"]
                    z[name] = z.get(name, 0) + 1
                    if time.time() - UEBERW["gespeichert"] > 60:
                        tag_speichern()
                return
    except Exception:
        pass                   # die Ueberwachung darf den Supervisor nie stoeren


def hwmon_temp(name):
    for p in glob.glob("/sys/class/hwmon/hwmon*/name"):
        try:
            with open(p) as f:
                if f.read().strip() != name:
                    continue
            with open(os.path.join(os.path.dirname(p), "temp1_input")) as f:
                return int(f.read()) / 1000
        except (OSError, ValueError):
            continue
    return None


def system_pruefen():
    """Temperatur und Speicher: Hoechst-/Tiefstwerte des Tages, Warnung bei Hitze/Speichermangel."""
    cpu, gpu = hwmon_temp("k10temp"), hwmon_temp("amdgpu")
    frei = None
    try:
        with open("/proc/meminfo") as f:
            frei = next(int(z.split()[1]) // 1024 for z in f if z.startswith("MemAvailable"))
    except (OSError, StopIteration, ValueError):
        pass
    with UEBERW["lock"]:
        d = tag_daten()
        for k, v in (("cpu_c", cpu), ("gpu_c", gpu)):
            if v is not None and v > d["max"].get(k, -1):
                d["max"][k] = round(v)
        if frei is not None and frei < d["min"].get("frei_mb", 10 ** 9):
            d["min"]["frei_mb"] = frei
    jetzt = time.time()
    if cpu is not None and cpu >= 90 and jetzt - UEBERW.get("hitze", 0) > 1800:
        UEBERW["hitze"] = jetzt
        problem("Hitze", f"CPU {cpu:.0f} Grad" + (f", GPU {gpu:.0f} Grad" if gpu else ""), True)
    if frei is not None and frei < 1500 and jetzt - UEBERW.get("speicher", 0) > 1800:
        UEBERW["speicher"] = jetzt
        problem("Speicher", f"nur noch {frei} MB frei", True)
    # Python-Fehler des Supervisors (stderr-Datei waechst)
    try:
        groesse = os.path.getsize("/home/citycafe/nl-mpv-supervisor.err")
        alt = UEBERW.setdefault("err_groesse", groesse)
        if groesse > alt:
            with open("/home/citycafe/nl-mpv-supervisor.err", errors="replace") as f:
                f.seek(alt)
                zeilen = [z.strip() for z in f.read().splitlines() if z.strip()]
            problem("Python-Fehler", zeilen[-1] if zeilen else "?", True)
        UEBERW["err_groesse"] = groesse
    except OSError:
        pass


def tv_fehler_holen(page_id):
    """Fehler der TV-Seite und des DJ-Studios abholen (window.nlFehler, index.html)."""
    try:
        fehler = json.loads(cdp_eval(page_id, "JSON.stringify((window.nlFehler || []).splice(0))") or "[]")
    except (OSError, ValueError, ConnectionError):
        return
    for f in fehler:
        quelle = str(f.get("quelle") or "TV-Seite")
        n = int(f.get("n") or 1)
        problem(quelle, f"{f.get('text', '')}" + (f" ({n}x)" if n > 1 else ""), False)


def bericht_text(d):
    """Tagesbericht (Markdown) aus der Statistik eines Betriebstags."""
    z, mx, mn = d.get("zaehler", {}), d.get("max", {}), d.get("min", {})
    tag = time.strftime("%d.%m.%Y", time.strptime(d["tag"], "%Y-%m-%d"))
    probleme = d.get("probleme", [])
    arten = {k: v for k, v in z.items() if k not in ("blenden", "blenden_fertig", "songs_gestartet")}
    zeilen = [f"# W1 Café – Betriebstag {tag} (8:30 bis 8:30)", "",
              f"- Musik-Songs gestartet: {z.get('songs_gestartet', 0)}",
              f"- Überblendungen: {z.get('blenden', 0)} begonnen, {z.get('blenden_fertig', 0)} fertig",
              f"- Höchste Temperatur: CPU {mx.get('cpu_c', '?')} °C, GPU {mx.get('gpu_c', '?')} °C; "
              f"wenigster freier Speicher: {mn.get('frei_mb', '?')} MB",
              "- Probleme: " + (", ".join(f"{k} {v}×" for k, v in sorted(arten.items(), key=lambda kv: -kv[1]))
                                 if arten else "keine"), ""]
    if probleme:
        zeilen += ["| Zeit | Art | Meldung |", "|---|---|---|"]
        zeilen += [f"| {t} | {a} | {m.replace('|', '/')} |" for t, a, m in probleme]
    else:
        zeilen.append("Keine Probleme.")
    return "\n".join(zeilen) + "\n"


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
            # GitHub Pages oder eine Test-Adresse (CITYCAFE_URL) - die Kiosk-Adresse
            # traegt immer kiosk=1.
            url = t.get("url", "")
            if t["type"] == "page" and ("motte025.github.io" in url or "kiosk=1" in url):
                return t["id"]
    return None


# nlGeladen.schluessel ist bei YouTube-Eintraegen die videoId selbst
# (nlSchluessel(): video.datei || video.videoId).
STATE_EXPR = """JSON.stringify({
  // DJ-Modus: videoIds der Leiste "Naechste Titel" (BPM/Tonart fuer die Karten)
  djSchlange: Array.isArray(window.nlDjSchlange) ? window.nlDjSchlange.slice(0, 12) : null,
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
  // Musikbetrieb (Warteschlange/Radio/Playlist, YOUTUBE-MUSIK-SETUP.md): andere
  // Qualitaetswahl, Start immer von vorn.
  musik: !!window.nlMusik,
  // Naechster Song zum Vorladen: { videoId, hoehe, fps } (5.2)
  vorladen: window.nlMusikVorladen || null,
  // Chef: jetzt sofort zum naechsten Song ueberblenden (mitten im Song): { id }
  blenden: window.nlJetztBlenden || null,
  // Die naechsten Songs der Warteschlange (videoIds) zum Vorab-Messen
  analyse: window.nlMusikAnalyse || null,
  // Radio-Mix zum Song: { id, videoId } -> window.nlMixErgebnis
  mix: window.nlMixAuftrag || null,
  // Playlist lesen: { id, quelle } -> window.nlPlaylistErgebnis
  playlist: window.nlPlaylistAuftrag || null,
  // Titel ohne videoId finden ("Kuenstler Titel"): { id, text } -> window.nlFindeErgebnis
  finde: window.nlFindeAuftrag || null,
  // Pause im Musikbetrieb: { id, pause: true/false }
  pause: window.nlPauseWunsch || null,
  // Welche Flaeche traegt das Video (Musik: Normal oder Vollbild, 6.8)
  flaeche: window.nlMpvFlaeche || null,
  // Ambilight im Musik-Widget an? Dann misst der Supervisor die Randfarben (ambi_farben)
  ambi: !!window.nlAmbiAn,
  // QR-Kaertchen "Song wuenschen" (ohne die Bilddaten - die holt qr_karte_holen einmal)
  qr: window.nlQrKarte ? { id: window.nlQrKarte.id, breite: window.nlQrKarte.breite, hoehe: window.nlQrKarte.hoehe,
       rand: window.nlQrKarte.rand, randVoll: window.nlQrKarte.randVoll, faktorVoll: window.nlQrKarte.faktorVoll } : null,
  // Vor-/Zuruecksprung vom Handy: { id, sek }
  spulen: (typeof window.nlSpulAuftrag !== 'undefined' && window.nlSpulAuftrag) ? window.nlSpulAuftrag : null,
  // Ton des Videos: { id, vol (0-100), lautheit (Ausgleich an/aus) }
  ton: (typeof window.nlTonWunsch !== 'undefined' && window.nlTonWunsch) ? window.nlTonWunsch : null,
  // Laeuft gerade eine Runde Hos'n Obe? Dann muss mpv aus bleiben - sein
  // Fenster liegt sonst ueber dem Kartentisch.
  spiel: (typeof window.ktSpielLaeuft === 'function') ? !!window.ktSpielLaeuft() : false,
  // Bluetooth-Empfaenger an der Anlage: { id, was } (verbinden/trennen/status)
  bt: (typeof window.nlBtAuftrag !== 'undefined' && window.nlBtAuftrag) ? window.nlBtAuftrag : null,
  // Dart-Abend-Modus: RTSP-Dartcam. Die Adresse kommt vom Dashboard
  // (DART_CAM_URL in index.html), damit ein Kamerawechsel keinen Eingriff
  // auf der Box braucht.
  cam: (window.dartCamAktiv && window.dartCamUrl) ? String(window.dartCamUrl) : null
})"""

# Lautheitsausgleich: dynaudnorm gleicht leise und laute Stellen an und ist
# guenstig genug fuer diese Box (loudnorm waere deutlich teurer). p=0.95: Spitzen
# bis knapp Vollaussteuerung - mit p=0.5 war Musik rund 6 dB zu leise (03.10.2026).
LAUTHEIT_FILTER = "dynaudnorm=g=5:f=250:r=0.9:p=0.95"

SUCH_TREFFER = 25         # so viele Treffer bekommt das Handy zu sehen
SUCH_TREFFER_MAX = 75     # "Mehr laden" am Handy: in Schritten von 25 bis hierhin

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

# Welche FLAECHE gehoert zu window.nlMpvFlaeche (Musik: normal, Vollbild, DJ-Modus)?
MUSIK_FLAECHE = {"yt-vollbild-video": "yt_voll", "yt-dj-video": "yt_dj"}

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
           # YouTube-Musik im Vollbild (window.nlMpvFlaeche = 'yt-vollbild-video')
           "yt_voll": ("ytm-vollbild", "yt-vollbild-video"),
           # DJ-Modus (nur Raum zuhause): Videofenster im DJ Studio ('yt-dj-video')
           "yt_dj": ("ytm-dj", "yt-dj-video"),
           "twitch": ("media-view-djlive", "dj-live-player"),
           "cam": ("media-view-dart-cam", "dart-cam-frame")}
# Die Dartcam ist ein Live-Strom im Lokal-Netz: faellt sie aus, nach kurzer
# Pause neu verbinden statt zehn Minuten zu sperren wie ein kaputtes Video.
CAM_RETRY_AFTER = 5
# Standzeit eines Nightlife-Slots im Zyklus (NL_CONFIG.sekundenProVideo im
# Dashboard) - fuer den Zufalls-Einstieg beim ersten Auftritt eines Videos.
NL_SLOT_SEKUNDEN = 240
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


# Bluetooth-Empfaenger an der Anlage (1Mii B03 Pro auf RX): der Screen schickt
# seinen Ton dorthin. Gekoppelt wird einmal von Hand am Geraet (bluetoothctl:
# scan on, pair, trust); die Fernbedienung verbindet und trennt nur. Gefunden
# wird das Geraet ueber einen Teil seines Namens, so steht keine Adresse im Repo.
BT_NAME = os.environ.get("CITYCAFE_BT_NAME", "B03")
# Nach "Trennen" am Handy liegt diese Datei da; ein Waechter, der die
# Verbindung sonst von selbst haelt (citycafe-bt auf dem W1), laesst den
# Empfaenger dann in Ruhe, bis "Verbinden" sie wieder entfernt.
BT_AUS_DATEI = os.environ.get("CITYCAFE_BT_AUS", "/home/citycafe/.citycafe-bt-aus")


def bt_cmd(*args, timeout=20):
    try:
        r = subprocess.run(["bluetoothctl", *args], capture_output=True, text=True, timeout=timeout)
        return r.stdout
    except (OSError, subprocess.TimeoutExpired) as e:
        return f"FEHLER {type(e).__name__}"


def bt_geraete():
    """Alle gekoppelten Empfaenger -> [(adresse, name), ...]. Es koennen
    mehrere sein (zuhause und im Cafe je ein B03 Pro) - welcher in Reichweite
    ist, zeigt erst der Verbindungsversuch."""
    geraete = []
    for zeile in bt_cmd("devices", "Paired").splitlines():
        teile = zeile.split(" ", 2)   # "Device AA:BB:.. Name"
        if len(teile) == 3 and teile[0] == "Device" and BT_NAME.lower() in teile[2].lower():
            geraete.append((teile[1], teile[2]))
    return geraete


def bt_verbunden(adresse):
    return "Connected: yes" in bt_cmd("info", adresse)


def bt_senke(adresse):
    """Name des PipeWire-Ausgangs zum Empfaenger oder None. Nur wenn es ihn
    gibt, geht wirklich Ton hin - "Connected: yes" allein heisst das nicht:
    haelt ein anderes Geraet den Tonkanal des Empfaengers, steht die
    Verbindung, aber der Empfaenger lehnt den A2DP-Kanal ab."""
    kennung = "bluez_output." + adresse.replace(":", "_")
    try:
        env = {**os.environ, **session_env()}
        senken = subprocess.run(["pactl", "list", "short", "sinks"], capture_output=True,
                                text=True, timeout=10, env=env).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    for zeile in senken.splitlines():
        felder = zeile.split("\t")
        if len(felder) > 1 and felder[1].startswith(kennung):
            return felder[1]
    return None


def bluetooth(was):
    """verbinden / trennen / status -> {verbunden, text}"""
    geraete = bt_geraete()
    if not geraete:
        return {"verbunden": False,
                "text": f"kein gekoppeltes Geraet mit „{BT_NAME}“ im Namen - einmal am Screen koppeln"}
    if was in ("verbinden", "trennen"):
        try:
            if was == "trennen":
                open(BT_AUS_DATEI, "w").close()
            elif os.path.exists(BT_AUS_DATEI):
                os.remove(BT_AUS_DATEI)
        except OSError as e:
            log(f"Bluetooth: {BT_AUS_DATEI} nicht gesetzt ({type(e).__name__})")
    # Gemeint ist der gerade verbundene Empfaenger, sonst der erste.
    adresse, name = next(((a, n) for a, n in geraete if bt_verbunden(a)), geraete[0])
    if was == "verbinden":
        bt_cmd("power", "on")
        for a, _ in geraete:
            bt_cmd("unblock", a)
        if bt_verbunden(adresse) and not bt_senke(adresse):
            # Verbunden, aber ohne Tonkanal: einmal sauber neu aufbauen.
            bt_cmd("disconnect", adresse)
            time.sleep(2)
        # Nach dem Entsperren meldet sich der Empfaenger oft selbst (letztes
        # Geraet) - ein gleichzeitiger connect scheitert dann mit "busy" /
        # "refused", obwohl es Sekunden spaeter steht. Darum kurz warten und
        # danach der Reihe nach probieren; der erste erreichbare gewinnt.
        time.sleep(4)
        for a, n in sorted(geraete, key=lambda g: g[0] != adresse):
            if not bt_verbunden(a):
                bt_cmd("connect", a, timeout=30)
            if bt_verbunden(a):
                adresse, name = a, n
                break
        else:
            # Kein connect hat geklappt - vielleicht steht die Verbindung, die
            # der Empfaenger selbst aufgebaut hat, inzwischen doch.
            for _ in range(10):
                treffer = next(((a, n) for a, n in geraete if bt_verbunden(a)), None)
                if treffer:
                    adresse, name = treffer
                    break
                time.sleep(2)
    elif was == "trennen":
        # Nur trennen reicht nicht: der Empfaenger meldet sich nach ~30 s von
        # selbst wieder (letztes Geraet, "trusted"). Blockiert lehnt der W1
        # das ab; die Kopplung bleibt, "Verbinden" hebt die Sperre auf.
        # Alle sperren - sonst verbaende sich der andere Empfaenger.
        for a, _ in geraete:
            bt_cmd("disconnect", a)
            bt_cmd("block", a)
    verbunden = bt_verbunden(adresse)
    senke = None
    if verbunden:
        # Der Tonkanal kommt ein paar Sekunden nach der Verbindung.
        for _ in range(20 if was == "verbinden" else 1):
            senke = bt_senke(adresse)
            if senke:
                break
            time.sleep(1)
    if senke and was == "verbinden":
        try:
            env = {**os.environ, **session_env()}
            subprocess.run(["pactl", "set-default-sink", senke], timeout=10, env=env)
        except (OSError, subprocess.TimeoutExpired) as e:
            log(f"Bluetooth: Ton nicht umgeleitet ({type(e).__name__})")
    if senke:
        text = f"{name}: verbunden, Ton geht zur Anlage"
    elif verbunden:
        text = (f"{name}: verbunden, aber kein Tonkanal - Empfaenger ist vermutlich "
                "mit einem anderen Geraet (Handy?) belegt")
    else:
        text = f"{name}: nicht verbunden"
    log(f"Bluetooth {was}: {text}")
    return {"verbunden": bool(senke), "text": text}


# Bluetooth-Waechter (05.10.2026: Empfaenger um 00:50 von selbst weg, danach
# lehnte er jede Verbindung ab - Ton lief still zum Fernseher). Alle 10 s:
# Verbindung, Tonkanal, Signal und WLAN-Verkehr nach BT_LOG (zum Auswerten).
# Reisst die Verbindung von selbst ab (nicht per "Trennen" am Handy), heilt er:
# erst neu verbinden, dann Adapter aus/an, danach jede Minute erneut. Der
# Zustand geht als window.nlBtZustand ans Dashboard (Warnung am Handy).
BT_LOG = "/home/citycafe/bt-waechter.csv"
BT_TAKT = 10
bt_zustand = {"ok": None, "text": "", "seit": time.time()}
bt_seite = {"id": None}        # aktuelle Dashboard-Seite (setzt die Hauptschleife)


def bt_signal(adresse):
    """RSSI/TX-Leistung der Verbindung (btmgmt), sonst ''."""
    try:
        aus = subprocess.run(["btmgmt", "conn-info", "-t", "0", adresse], capture_output=True,
                             text=True, timeout=5).stdout
        m = re.search(r"RSSI (-?\d+)", aus)
        return m.group(1) if m else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def wlan_bytes():
    summe = 0
    for d in glob.glob("/sys/class/net/wl*/statistics"):
        for f in ("rx_bytes", "tx_bytes"):
            try:
                summe += int(open(os.path.join(d, f)).read())
            except (OSError, ValueError):
                pass
    return summe


def bt_melden(seite_holen, ok, text):
    if bt_zustand["ok"] != ok or bt_zustand["text"] != text:
        bt_zustand.update(ok=ok, text=text, seit=time.time())
    seite = seite_holen()
    if seite:
        try:
            cdp_eval(seite, "window.nlBtZustand = " + json.dumps(
                {"ok": ok, "text": text, "seit": int(bt_zustand["seit"] * 1000)}) + "; 1")
        except (OSError, ValueError, ConnectionError):
            pass


def usb_senke():
    """B03 Pro per USB-Kabel am W1 (USB-Soundkarte) -> PipeWire-Ausgang oder None.
    Seit 05.10.2026 haengt der Empfaenger am USB des W1 statt am TV-USB: Ton geht
    per Kabel, ganz ohne Bluetooth (der TV schaltete per 4-h-Automatik seinen USB ab)."""
    try:
        env = {**os.environ, **session_env()}
        senken = subprocess.run(["pactl", "list", "short", "sinks"], capture_output=True,
                                text=True, timeout=10, env=env).stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    for zeile in senken.splitlines():
        felder = zeile.split("\t")
        if len(felder) > 1 and felder[1].startswith("alsa_output.usb-") and BT_NAME.lower() in felder[1].lower():
            return felder[1]
    return None


def usb_standard(senke):
    """USB-Ausgang zum Standard machen (100 %), falls er es nicht ist."""
    try:
        env = {**os.environ, **session_env()}
        standard = subprocess.run(["pactl", "get-default-sink"], capture_output=True, text=True,
                                  timeout=10, env=env).stdout.strip()
        if standard != senke:
            subprocess.run(["pactl", "set-default-sink", senke], timeout=10, env=env)
            subprocess.run(["pactl", "set-sink-volume", senke, "100%"], timeout=10, env=env)
            subprocess.run(["pactl", "set-sink-mute", senke, "0"], timeout=10, env=env)
            for z in subprocess.run(["pactl", "list", "short", "sink-inputs"], capture_output=True,
                                    text=True, timeout=10, env=env).stdout.splitlines():
                subprocess.run(["pactl", "move-sink-input", z.split("\t")[0], senke], timeout=10, env=env)
            log(f"Ton per USB-Kabel: {senke} ist Standard (100 %)")
    except (OSError, subprocess.TimeoutExpired):
        pass


def bt_waechter(seite_holen):
    war_ok = False
    heilen = False            # nur nach einem Abbruch selbst verbinden (sonst nur per Knopf)
    letzter_versuch = 0.0
    versuche = 0
    wlan_alt = wlan_bytes()
    while True:
        time.sleep(BT_TAKT)
        try:
            # Ton per USB-Soundkarte nur auf ausdruecklichen Wunsch (CITYCAFE_TON_USB=1):
            # am W1-USB-Verteiler knackte der B03 Pro (05.10.2026, USB-Fehler -71,
            # Masseschleife zur Anlage). Betreiber will Bluetooth.
            usb = usb_senke() if os.environ.get("CITYCAFE_TON_USB") == "1" else None
            if usb:
                usb_standard(usb)
                if not war_ok:
                    log("Bluetooth-Waechter: Ton geht per USB-Kabel zur Anlage")
                war_ok, versuche = True, 0
                try:
                    with open(BT_LOG, "a") as f:
                        f.write(f"{time.strftime('%F %T')};usb;1;;;0\n")
                except OSError:
                    pass
                bt_melden(seite_holen, True, "Ton geht per USB-Kabel zur Anlage")
                continue
            geraete = bt_geraete()
            adresse = next((a for a, _ in geraete if bt_verbunden(a)), geraete[0][0] if geraete else "")
            verbunden = bool(adresse) and bt_verbunden(adresse)
            senke = bt_senke(adresse) if verbunden else None
            gewollt_aus = os.path.exists(BT_AUS_DATEI)
            wlan_neu = wlan_bytes()
            wlan_kbs = max(0, wlan_neu - wlan_alt) / 1024 / BT_TAKT
            wlan_alt = wlan_neu
            try:
                with open(BT_LOG, "a") as f:
                    f.write(f"{time.strftime('%F %T')};{int(verbunden)};{int(bool(senke))};"
                            f"{bt_signal(adresse) if verbunden else ''};{wlan_kbs:.0f};{int(gewollt_aus)}\n")
            except OSError:
                pass
            if senke:
                if not war_ok and versuche:
                    log(f"Bluetooth-Waechter: wieder verbunden nach {versuche} Versuch(en)")
                war_ok, versuche, heilen = True, 0, False
                bt_melden(seite_holen, True, "Ton geht zur Anlage")
                continue
            if gewollt_aus or not geraete:
                war_ok, versuche, heilen = False, 0, False
                bt_melden(seite_holen, True, "Anlage fuers Handy freigegeben" if gewollt_aus else "")
                continue
            # Ton sollte zur Anlage gehen, tut es aber nicht.
            if war_ok:
                log(f"Bluetooth-Waechter: Verbindung weg (verbunden={verbunden}, Tonkanal fehlt)")
                war_ok, heilen = False, True
            if not heilen:
                bt_melden(seite_holen, True, "Bluetooth nicht verbunden")
                continue
            # Im Cafe spielt auch das Handy auf den B03 (Wunsch 05.10.2026): hoechstens
            # 3 Versuche in ~2 Minuten, ohne Adapter-Neustart - dann Ruhe und Hinweis.
            # Hat das Handy den Empfaenger, holt ihn "Screen an die Anlage" zurueck.
            if versuche >= 3:
                bt_melden(seite_holen, False, "Bluetooth zur Anlage getrennt - Handy an der Anlage? "
                          "Zurueck: 'Screen an die Anlage'")
                continue
            bt_melden(seite_holen, False, "Bluetooth zur Anlage getrennt - verbinde neu")
            if time.time() - letzter_versuch < 40:
                continue
            letzter_versuch = time.time()
            versuche += 1
            ergebnis = bluetooth("verbinden")
            log(f"Bluetooth-Waechter: Versuch {versuche}: {ergebnis.get('text')}")
            if ergebnis.get("verbunden"):
                bt_melden(seite_holen, True, "Ton geht zur Anlage")
        except Exception as e:      # der Waechter darf nie sterben
            log(f"Bluetooth-Waechter: {type(e).__name__}: {e}")


def sway(*args):
    env = {**os.environ, **session_env()}
    if "SWAYSOCK" not in env:
        socks = [s for s in glob.glob("/run/user/1001/sway-ipc.*.sock")
                 if os.path.exists(f"/proc/{s.rsplit('.', 2)[-2]}")]
        if socks:
            env["SWAYSOCK"] = socks[0]
    return subprocess.run(["swaymsg", *args], env=env, capture_output=True, text=True)


_ausgabe_skala = None


def ausgabe_skala():
    """Skalierung der sway-Ausgabe (W1: 1; PC zuhause, 21:9-Monitor: 4/3). Fensterlagen
    rechnen in logischen Pixeln, mpvs overlay-add in echten Bildpunkten des Fensters."""
    global _ausgabe_skala
    if _ausgabe_skala is None:
        try:
            aktiv = [o for o in json.loads(sway("-t", "get_outputs").stdout or "[]") if o.get("active")]
            if aktiv:
                _ausgabe_skala = float(aktiv[0].get("scale") or 1)
        except (ValueError, TypeError):
            pass
    return _ausgabe_skala or 1.0


def mpv_window_rect(app_id=None):
    """Aktuelle Lage des mpv-Fensters laut sway, None solange es nicht da ist."""
    try:
        tree = json.loads(sway("-t", "get_tree").stdout or "{}")
    except ValueError:
        return None
    todo = [tree]
    while todo:
        node = todo.pop()
        if node.get("app_id") == (app_id or MPV_APP["id"]):
            r = node["rect"]
            return {"x": r["x"], "y": r["y"], "w": r["width"], "h": r["height"]}
        todo += node.get("nodes", []) + node.get("floating_nodes", [])
    return None


def resolve(video_id, fmt=FORMAT, sortierung=None):
    """-> (video_url, audio_url|None, laenge_sek|None) oder None.
    Mit sortierung (Musik) wird die tatsaechlich gewaehlte Qualitaet geloggt."""
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", JS_RUNTIME, "--cookies-from-browser", COOKIES_FROM,
                 "-f", fmt, *(["-S", sortierung] if sortierung else []),
                 "--print", "duration",
                 "--print", "QUALI %(format_id)s|%(resolution)s|%(fps)s|%(vcodec)s",
                 "--print", "META %(artist)s\t%(track)s\t%(title)s\t%(channel)s",
                 "--print", "urls",
                 f"https://www.youtube.com/watch?v={video_id}"],
                capture_output=True, text=True, timeout=30)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"{os.path.basename(programm)} fuer {video_id}: {type(fehler).__name__}")
            continue
        zeilen = out.stdout.splitlines()
        urls = [l for l in zeilen if l.startswith("http")]
        laenge = None
        for l in zeilen:
            try:
                laenge = int(float(l))
                break
            except ValueError:
                pass
        if urls:
            if sortierung:
                quali = next((l[6:] for l in zeilen if l.startswith("QUALI ")), "?")
                log(f"Qualitaet {video_id}: {quali}")
                m = re.search(r"\|(\d+)x(\d+)\|", quali)
                if m:
                    FORMATE[video_id] = (int(m.group(1)), int(m.group(2)))
                meta = next((l[5:] for l in zeilen if l.startswith("META ")), "")
                if meta:
                    META[video_id] = meta.split("\t")
            return urls[0], (urls[1] if len(urls) > 1 else None), laenge
        log(f"{os.path.basename(programm)} ohne URL fuer {video_id}: {out.stderr.strip()[-200:]}")
    return None


# Ton von der Platte (22.10.2026): YouTube liefert manche Stroeme zeitweise zu langsam (Log 20:48/20:52:
# "Enter buffering 100% -> 0%", Song blieb bei 12,8 s stehen). mpv haelt dann Bild UND Ton an. Deshalb
# den Ton jedes Musik-Songs (3-5 MB) vorab ganz laden - yt-dlp laedt in Stuecken und umgeht so die
# Drosselung - und mpv spielt ihn von hier; dazu --cache-pause=no: kommt das Bild nicht nach, steht
# kurz das Bild, die Musik laeuft weiter.
TON_ORDNER = os.path.expanduser("~/.cache/citycafe/ton")
TON_LAEDT = set()


def ton_datei(vid):
    """Fertig geladener Ton eines Songs oder None."""
    for p in glob.glob(os.path.join(TON_ORDNER, vid + ".*")):
        # nur die fertige Datei: nicht .part (Download) und nicht .temp.* (yt-dlp korrigiert den
        # Container danach noch in eine Zwischendatei)
        name = os.path.basename(p)
        if (not name.endswith((".part", ".ytdl", ".tmp")) and ".temp." not in name and ".part-" not in name
                and os.path.getsize(p) > 100_000):
            return p
    return None


def ton_laden(vid, audio_url):
    """Ton (dasselbe Format wie die Wiedergabe) im Hintergrund auf die Platte holen."""
    if not audio_url or vid in TON_LAEDT or ton_datei(vid):
        return
    m = re.search(r"[?&]itag=(\d+)", audio_url)
    TON_LAEDT.add(vid)

    def lauf():
        t0 = time.time()
        try:
            os.makedirs(TON_ORDNER, exist_ok=True)
            for programm in ytdlp_programme():
                try:
                    r = subprocess.run(
                        ["nice", "-n", "10", programm, "--js-runtimes", JS_RUNTIME, "--cookies-from-browser",
                         COOKIES_FROM, "-f", m.group(1) if m else "bestaudio", "--no-progress", "-q",
                         "--no-playlist", "-o", os.path.join(TON_ORDNER, vid + ".%(ext)s"),
                         f"https://www.youtube.com/watch?v={vid}"],
                        capture_output=True, text=True, timeout=240)
                except (subprocess.TimeoutExpired, OSError) as e:
                    log(f"Ton {vid}: nicht geladen ({type(e).__name__})")
                    continue
                if ton_datei(vid):
                    log(f"Ton {vid}: auf der Platte ({time.time() - t0:.0f} s)")
                    break
                log(f"Ton {vid}: nicht geladen (Code {r.returncode}: {(r.stderr or r.stdout).strip()[-160:]})")
            dateien = sorted(glob.glob(os.path.join(TON_ORDNER, "*")), key=os.path.getmtime)
            for alt in dateien[:-40]:                 # die letzten 40 Songs behalten
                os.remove(alt)
        except OSError:
            pass
        finally:
            TON_LAEDT.discard(vid)

    threading.Thread(target=lauf, daemon=True).start()


def ton_quelle(vid, audio_url):
    """Fuer mpv --audio-file: der geladene Ton, sonst wie bisher der Strom."""
    return ton_datei(vid) or audio_url


def suchen(text, anzahl=None):
    """YouTube-Suche fuer die Handy-Fernbedienung. -> Liste von Treffern."""
    anzahl = anzahl or SUCH_TREFFER
    out = None
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", JS_RUNTIME, "--flat-playlist", "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s\t%(duration)s\t%(view_count)s",
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
    treffer = treffer_lesen(out.stdout)
    if not treffer:
        log(f"Suche ohne Treffer: {text!r} {out.stderr.strip()[-120:]}")
    return treffer


def playlists_suchen(text, anzahl=20):
    """Nur Playlists suchen (YouTube-Filter "Playlist") -> Liste von Treffern
    { playlistId, titel, kanal, bildVon } fuer die Handy-Fernbedienung."""
    url = ("https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus(text)
           + "&sp=EgIQAw%253D%253D")
    out = None
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", JS_RUNTIME, "--flat-playlist", "--playlist-end", str(anzahl),
                 "--print", "%(id)s\t%(title)s\t%(channel)s\t%(thumbnails.0.url)s", url],
                capture_output=True, text=True, timeout=60)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"Playlist-Suche mit {os.path.basename(programm)}: {type(fehler).__name__} ({text!r})")
            out = None
            continue
        if out.stdout.strip():
            break
    treffer = []
    for zeile in (out.stdout if out else "").splitlines():
        teile = zeile.split("\t")
        if len(teile) < 2 or not re.fullmatch(r"[A-Za-z0-9_-]{13,64}", teile[0]):
            continue
        bild = re.search(r"/vi/([A-Za-z0-9_-]{11})/", teile[3] if len(teile) > 3 else "")
        treffer.append({"playlistId": teile[0], "titel": teile[1],
                        "kanal": teile[2] if len(teile) > 2 and teile[2] != "NA" else "",
                        "bildVon": bild.group(1) if bild else ""})
    return treffer


# --- Shorts fuer die rechte Karte des TV (Auftrag art "shorts") ---------------------
# Die normale Suche "<Kuenstler> #shorts" liefert fast nur Querformat und viel
# Boulevard (BILD, RTL ...). Echte Shorts stehen im Shorts-Reiter eines Kanals: zuerst
# der Kanal des laufenden Musikvideos, dann der offizielle Kanal des Kuenstlers. Erst
# wenn beide nichts haben, allgemeine Themen - dort nur nachweislich hochkant.
SHORTS_SPERRE = re.compile(
    r"\b(news|nachrichten|bild|rtl|promiflash|bunte|exclusiv|explosiv|gala|boulevard|"
    r"skandal|unfall|klatsch|tratsch|polizei|gericht|prozess|krank|tot|tod|gestorben)\b", re.I)
SHORTS_KANAL_VON = {}    # videoId -> (zeit, kanal-URL oder "")
SHORTS_KUENSTLER = {}    # kuenstler -> (zeit, kanal-URL oder "")
SHORTS_LISTEN = {}       # kanal-URL -> (zeit, treffer)


def ytdlp_ausgabe(argumente, timeout=60):
    for programm in ytdlp_programme():
        try:
            out = subprocess.run([programm, "--js-runtimes", JS_RUNTIME, "--no-warnings"] + argumente,
                                 capture_output=True, text=True, timeout=timeout)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"Shorts: {os.path.basename(programm)} {type(fehler).__name__}")
            continue
        if out.stdout.strip():
            return out.stdout
    return ""


def shorts_kanal_von(video_id):
    alt = SHORTS_KANAL_VON.get(video_id)
    if alt and time.time() - alt[0] < 86400:
        return alt[1]
    url = ytdlp_ausgabe(["--skip-download", "--print", "%(channel_url)s", "https://www.youtube.com/watch?v=" + video_id], 40).strip()
    url = url if url.startswith("https://www.youtube.com/") else ""
    SHORTS_KANAL_VON[video_id] = (time.time(), url)
    return url


def shorts_kanal_des_kuenstlers(kuenstler):
    """Kanal, dessen Name den Kuenstler enthaelt (bevorzugt "Official"), aus den ersten Suchtreffern."""
    schluessel = kuenstler.lower()
    alt = SHORTS_KUENSTLER.get(schluessel)
    if alt and time.time() - alt[0] < 86400:
        return alt[1]
    norm = lambda s: re.sub(r"[^a-z0-9äöüß]", "", s.lower())
    gesucht, gefunden = norm(kuenstler), []
    for zeile in ytdlp_ausgabe(["--flat-playlist", "--print", "%(channel)s\t%(channel_url)s",
                                f"ytsearch8:{kuenstler}"]).splitlines():
        teile = zeile.split("\t")
        if len(teile) == 2 and gesucht and gesucht in norm(teile[0]) and teile[1].startswith("https://"):
            gefunden.append(teile)
    gefunden.sort(key=lambda t: "official" not in t[0].lower() and "offiziell" not in t[0].lower())
    url = gefunden[0][1] if gefunden else ""
    SHORTS_KUENSTLER[schluessel] = (time.time(), url)
    return url


def shorts_vom_kanal(kanal_url):
    alt = SHORTS_LISTEN.get(kanal_url)
    if alt and time.time() - alt[0] < 6 * 3600:
        return alt[1]
    treffer = []
    for zeile in ytdlp_ausgabe(["--flat-playlist", "--playlist-end", "40", "--print",
                                "%(id)s\t%(title)s\t%(channel)s", kanal_url.rstrip("/") + "/shorts"]).splitlines():
        teile = zeile.split("\t")
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", teile[0]):
            continue
        titel = teile[1] if len(teile) > 1 else ""
        if SHORTS_SPERRE.search(titel):
            continue
        treffer.append({"videoId": teile[0], "titel": titel,
                        "kanal": teile[2] if len(teile) > 2 and teile[2] != "NA" else "", "hochkant": True})
    SHORTS_LISTEN[kanal_url] = (time.time(), treffer)
    return treffer


def shorts_suchen(kanal_von, kuenstler, text):
    """-> (treffer, quelle). Treffer tragen hochkant=True; quelle = kanal | thema."""
    kanaele = []
    if kanal_von:
        kanaele.append(shorts_kanal_von(kanal_von))
    if kuenstler:
        kanaele.append(shorts_kanal_des_kuenstlers(kuenstler))
    for url in dict.fromkeys(k for k in kanaele if k):
        liste = shorts_vom_kanal(url)
        if len(liste) >= 4:
            log(f"Shorts vom Kanal {url}: {len(liste)}")
            return liste, "kanal"
    if not text:
        return [], "thema"
    # Allgemeine Themen: kurze Clips ohne Boulevard, dann Breite/Hoehe nachsehen.
    kandidaten = [t for t in suchen(text, 40)
                  if 4 <= (t.get("dauerSek") or 0) <= 75
                  and not SHORTS_SPERRE.search(t.get("titel", "") + " " + t.get("kanal", ""))][:15]
    masse = {}
    if kandidaten:
        for zeile in ytdlp_ausgabe(["--skip-download", "--ignore-errors", "--print",
                                    "%(id)s\t%(width)s\t%(height)s"] + ["https://www.youtube.com/watch?v=" + t["videoId"] for t in kandidaten], 120).splitlines():
            teile = zeile.split("\t")
            if len(teile) == 3 and teile[1].isdigit() and teile[2].isdigit():
                masse[teile[0]] = (int(teile[1]), int(teile[2]))
    treffer = [dict(t, hochkant=True) for t in kandidaten
               if masse.get(t["videoId"], (1, 0))[1] > masse.get(t["videoId"], (1, 0))[0]]
    log(f"Shorts zum Thema {text!r}: {len(treffer)} hochkant von {len(kandidaten)}")
    return treffer, "thema"


def treffer_lesen(ausgabe):
    """yt-dlp-Zeilen "id<TAB>titel<TAB>kanal<TAB>dauer_text<TAB>dauer_sek<TAB>aufrufe" -> Treffer.
    Aufrufe liefert YouTube bei der Suche, beim Radio-Mix meist nicht ("NA")."""
    treffer = []
    for zeile in ausgabe.splitlines():
        teile = zeile.split("\t")
        if len(teile) >= 2 and len(teile[0]) == 11:
            t = {"videoId": teile[0], "titel": teile[1],
                 "kanal": teile[2] if len(teile) > 2 and teile[2] != "NA" else "",
                 "dauer": teile[3] if len(teile) > 3 and teile[3] != "NA" else ""}
            try:
                t["dauerSek"] = int(float(teile[4]))
            except (IndexError, ValueError):
                pass
            try:
                t["aufrufe"] = int(teile[5])
            except (IndexError, ValueError):
                pass
            treffer.append(t)
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
# So viele automatische Vorschlaege bekommt das Handy (Spec 7.2: 12). Je
# Begriff werden 4 geholt - 3 Begriffe x 4 reicht, die Suchen bleiben
# nacheinander (siehe oben).
VORSCHLAG_ANZAHL = 12
# "Passt dazu" am Handy und Radio-Mix am TV: so viele Titel aus dem Mix.
MIX_ANZAHL = 25


def vorschlaege():
    """Gemischte Vorschlaege aus mehreren Suchbegriffen. -> Liste von Treffern."""
    begriffe = random.sample(VORSCHLAG_BEGRIFFE,
                             min(VORSCHLAG_BEGRIFFE_JE_LAUF, len(VORSCHLAG_BEGRIFFE)))
    je = max(4, -(-VORSCHLAG_ANZAHL // len(begriffe)))     # aufgerundet
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


# Mix mit oder ohne die Konto-Cookies lesen? Mit Cookies passt YouTube den Mix an
# den Verlauf des Premium-Kontos an (am 02.10.2026 gesehen: Lobpreis-Lieder in
# jedem Mix, auch zu Justin Bieber); ohne Cookies passt er zum Song. Zum
# Abspielen werden die Cookies immer genutzt. CITYCAFE_MIX_COOKIES=0 = ohne.
MIX_MIT_COOKIES = os.environ.get("CITYCAFE_MIX_COOKIES", "1") != "0"


# Musikvideos bevorzugen (Wunsch 03.10.2026): offizielle Videos nach vorn,
# Lyric-/Audio-/Topic-/Visualizer-Uploads (Standbild am TV) moeglichst raus.
MV_GUT = re.compile(r"official\s+(music\s+)?video|offizielles\s+(musik)?video|musikvideo|music\s+video|\(video\)|\[video\]", re.I)
MV_SCHLECHT = re.compile(r"lyric|lyrics|songtext|\baudio\b|visuali[sz]er|karaoke|sped\s*up|slowed|nightcore|"
                         r"\b1\s*hour\b|\bloop\b|instrumental|cover\b|reaction|making of|behind the scenes|"
                         r"hinter den kulissen|footnotes|teaser|trailer|reportage|im tonstudio", re.I)


MV_LIVE = re.compile(r"\blive\b|en vivo|ao vivo|concierto|\btour\b|festival|fernsehgarten|hitparade|"
                     r"giovanni zarrella|silvesterstadl|\bzdf\b|\bard\b|\bsrf\b|\borf\b", re.I)


FUELLWOERTER = {"ein", "eine", "einen", "der", "die", "das", "den", "dem", "und", "von", "mit", "auf",
                "fuer", "ich", "du", "wir", "the", "and", "you", "for", "with", "are", "not", "dont"}


def titel_passt(titel, songtitel):
    """Mindestens die Haelfte der Woerter des Songtitels (ab 3 Buchstaben, ohne Fuellwoerter)
    kommt im Videotitel vor. Nur die Haelfte, weil YouTube Titel uebersetzt ("A Kiss in Paris")."""
    def ohne_akzente(s):
        s = unicodedata.normalize("NFD", str(s or "").lower())
        return "".join(c for c in s if unicodedata.category(c) != "Mn").replace("ß", "ss")
    woerter = [w for w in re.split(r"[^a-z0-9]+", ohne_akzente(songtitel)) if len(w) >= 3 and w not in FUELLWOERTER]
    if not woerter:
        return True
    t = re.sub(r"[^a-z0-9]", "", ohne_akzente(titel))
    # Kurze Titel: die Haelfte reicht (uebersetzt), laengere brauchen drei Viertel - sonst
    # bestand "I Need Your Love" die Pruefung fuer "How Deep Is Your Love".
    return sum(1 for w in woerter if w in t) / len(woerter) >= (0.5 if len(woerter) <= 2 else 0.75)


def musikvideo_wertung(t, suchtext=""):
    """Grobe Note, wie sehr ein Treffer ein echtes Musikvideo ist (hoeher = besser).
    suchtext ("Kuenstler Titel"): Kanal des Kuenstlers zaehlt extra (offizielles Video
    statt Fan-Upload - Shakira "La Tortura" kam am 04.10.2026 von "TheShakiraFan97")."""
    titel, kanal = str(t.get("titel") or ""), str(t.get("kanal") or "")
    note = 0
    kn = re.sub(r"[^a-z0-9]", "", kanal.lower()).replace("official", "").replace("vevo", "")
    if re.search(r"fan|lyric|karaoke", kanal, re.I):
        note -= 3          # Fan-/Lyric-Kanal
    elif suchtext and len(kn) >= 3 and kn in re.sub(r"[^a-z0-9]", "", suchtext.lower()):
        note += 2          # Kanal des Kuenstlers
    if MV_GUT.search(titel):
        note += 3
    if "vevo" in kanal.lower():
        note += 1
    if MV_SCHLECHT.search(titel):
        note -= 3
    if kanal.endswith(" - Topic"):
        note -= 3          # automatisch erzeugter Audio-Upload (nur Standbild)
    if MV_LIVE.search(titel):
        note -= 4          # Live-Mitschnitt, TV-Auftritt
    return note


def musikvideos_bevorzugen(treffer, mindestens):
    """Schlechte (Lyric/Audio/Topic ...) rauswerfen, solange genug uebrig bleiben."""
    gut = [t for t in treffer if musikvideo_wertung(t) > -3]
    return gut if len(gut) >= mindestens else treffer


def mix(video_id, anzahl=MIX_ANZAHL):
    """YouTube-Radio-Mix zum Video (list=RD<id>) -> Liste von Treffern, ohne das
    Video selbst. Ein einziger yt-dlp-Lauf, 1-2 s. Am 02.10.2026 auf dem W1 mit
    den Premium-Cookies geprueft: 25 passende Titel. Leer, wenn YouTube keinen
    Mix liefert ("Unable to recognize playlist", z. B. nicht verfuegbares Video)."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", str(video_id or "")):
        return []
    out = None
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", JS_RUNTIME,
                 *(["--cookies-from-browser", COOKIES_FROM] if MIX_MIT_COOKIES else []),
                 "--flat-playlist", "--playlist-end", str(anzahl + 11), "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s\t%(duration)s\t%(view_count)s",
                 f"https://www.youtube.com/watch?v={video_id}&list=RD{video_id}"],
                capture_output=True, text=True, timeout=60)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"Mix mit {os.path.basename(programm)}: {type(fehler).__name__} ({video_id})")
            out = None
            continue
        if out.stdout.strip():
            break
    treffer = [t for t in treffer_lesen(out.stdout if out else "") if t["videoId"] != video_id]
    treffer = musikvideos_bevorzugen(treffer, min(12, anzahl))[:anzahl]
    if not treffer:
        log(f"Mix zu {video_id} leer: {(out.stderr if out else '').strip()[-120:]}")
    aufrufe_ergaenzen(treffer[:anzahl])
    return treffer[:anzahl]


# Aufrufe fuer Treffer ohne Zahl (der Radio-Mix liefert keine, 05.10.2026: "ueberall
# Aufrufe am Handy"). Vier yt-dlp-Laeufe parallel mit je bis zu 4 Videos (~5-8 s),
# Ergebnis gemerkt - derselbe Song kostet beim naechsten Mix nichts mehr.
AUFRUFE = {}


def aufrufe_ergaenzen(treffer, hoechstens=16):
    for t in treffer:
        if not t.get("aufrufe") and t["videoId"] in AUFRUFE:
            t["aufrufe"] = AUFRUFE[t["videoId"]]
    offen = [t["videoId"] for t in treffer if not t.get("aufrufe")][:hoechstens]
    if not offen:
        return

    def holen(ids):
        try:
            r = subprocess.run(["yt-dlp", "--js-runtimes", JS_RUNTIME, "--cookies-from-browser", COOKIES_FROM,
                                "--skip-download", "--ignore-errors", "--print", "%(id)s\t%(view_count)s",
                                *[f"https://www.youtube.com/watch?v={i}" for i in ids]],
                               capture_output=True, text=True, timeout=40)
        except (OSError, subprocess.TimeoutExpired):
            return
        for zeile in r.stdout.splitlines():
            teile = zeile.split("\t")
            if len(teile) == 2 and teile[1].isdigit():
                AUFRUFE[teile[0]] = int(teile[1])

    gruppen = [offen[i::4] for i in range(4) if offen[i::4]]
    faeden = [threading.Thread(target=holen, args=(g,), daemon=True) for g in gruppen]
    for f in faeden:
        f.start()
    for f in faeden:
        f.join(45)
    for t in treffer:
        if not t.get("aufrufe") and t["videoId"] in AUFRUFE:
            t["aufrufe"] = AUFRUFE[t["videoId"]]


# Playlists (yt_playlists.json): 24 h zwischengespeichert. /tmp liegt im
# Arbeitsspeicher, deshalb unter ~/.cache - ein paar kleine JSON-Dateien.
PLAYLIST_CACHE = "/home/citycafe/.cache/citycafe"
PLAYLIST_CACHE_SEKUNDEN = 24 * 3600
PLAYLIST_MAX = 200


def playlist_lesen(quelle):
    """YouTube-Playlist (Link) -> Liste von Treffern, aus dem Cache oder frisch."""
    m = re.search(r"[?&]list=([A-Za-z0-9_-]+)", str(quelle or ""))
    if not m:
        return []
    datei = os.path.join(PLAYLIST_CACHE, f"playlist-{m.group(1)}.json")
    try:
        if time.time() - os.path.getmtime(datei) < PLAYLIST_CACHE_SEKUNDEN:
            with open(datei) as f:
                return json.load(f)
    except (OSError, ValueError):
        pass
    out = None
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", JS_RUNTIME, "--cookies-from-browser", COOKIES_FROM,
                 "--flat-playlist", "--playlist-end", str(PLAYLIST_MAX), "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s\t%(duration)s\t%(view_count)s",
                 f"https://www.youtube.com/playlist?list={m.group(1)}"],
                capture_output=True, text=True, timeout=120)
        except (subprocess.TimeoutExpired, OSError) as fehler:
            log(f"Playlist mit {os.path.basename(programm)}: {type(fehler).__name__}")
            out = None
            continue
        if out.stdout.strip():
            break
    treffer = treffer_lesen(out.stdout if out else "")
    if treffer:
        try:
            os.makedirs(PLAYLIST_CACHE, exist_ok=True)
            with open(datei, "w") as f:
                json.dump(treffer, f)
        except OSError as e:
            log(f"Playlist-Cache nicht geschrieben: {e}")
    log(f"Playlist {m.group(1)}: {len(treffer)} Titel")
    return treffer


def aehnliche(video_id, titel):
    """Vorschlaege, die zum gerade gestarteten Video passen ("Passt dazu").

    Erste Wahl ist YouTubes eigener Mix (mix(), list=RD...) - das geht mit
    aktuellem yt-dlp (geprueft 02.10.2026). Liefert YouTube keinen, wird nach
    dem Titel gesucht: das gestartete Video faellt raus, und je Kanal kommen
    hoechstens zwei - sonst stuenden Folgen derselben Reihe untereinander.
    """
    gemixt = mix(video_id, 20)
    if gemixt:
        log(f"Aehnliche zu {video_id}: {len(gemixt)} aus dem YouTube-Mix")
        return gemixt
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


def mpv_befehl(*teile, sock=None):
    """Einen Befehl an mpv schicken (IPC), z. B. seek. True, wenn zugestellt."""
    try:
        with socket.socket(socket.AF_UNIX) as s:
            s.settimeout(1.0)
            s.connect(sock or MPV_SOCK)
            s.sendall((json.dumps({"command": list(teile), "request_id": 9}) + "\n").encode())
            return True
    except (OSError, ValueError):
        return False


def mpv_time_pos():
    """time-pos ueber IPC; None, wenn mpv (noch) keine Position hat oder nicht antwortet."""
    return mpv_eigenschaft("time-pos")


def mpv_eigenschaft(name, sock=None):
    """Eine mpv-Eigenschaft ueber IPC lesen (z. B. time-pos, duration); None, wenn nicht da."""
    try:
        with socket.socket(socket.AF_UNIX) as s:
            s.settimeout(1.0)
            s.connect(sock or MPV_SOCK)
            s.sendall((json.dumps({"command": ["get_property", name], "request_id": 1}) + "\n").encode())
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


def place_mpv(target, app_id=None, sichtbar=True):
    """mpv-Fenster auf die Zielflaeche setzen. -> True, wenn das Fenster da ist.
    Die sway-Regel allein setzt die Position nicht zuverlaessig (gesehen: mpv
    landete bei 443/450), deshalb wird bei jeder Abweichung nachgezogen."""
    app_id = app_id or MPV_APP["id"]
    cur = mpv_window_rect(app_id)
    if cur is None:
        return False
    if any(abs(cur[k] - target[k]) > 2 for k in ("x", "y", "w", "h")):
        # Erst resize, dann move: sway aendert die Groesse schwebender Fenster um
        # ihre Mitte. Umgekehrt landete das Fenster beim Wechsel ins Vollbild
        # (1200x675 -> 1280x720) 40/22 px daneben (gesehen am 02.10.2026).
        # Groessenwechsel (Normal <-> Vollbild): waehrend des Umbaus ausblenden -
        # sonst sah man kurz das alte Bild verzerrt mit schwarzen Balken unten,
        # bis mpv die neue Groesse uebernommen hatte (gemeldet 03.10.2026).
        groesse_neu = abs(cur["w"] - target["w"]) > 2 or abs(cur["h"] - target["h"]) > 2
        if groesse_neu and sichtbar:
            sway(f'[app_id="{app_id}"]', "opacity", "0")
        sway(f'[app_id="{app_id}"]', "resize", "set", "width", f"{target['w']} px",
             "height", f"{target['h']} px")
        sway(f'[app_id="{app_id}"]', "move", "absolute", "position", str(target["x"]), str(target["y"]))
        if groesse_neu and sichtbar:
            time.sleep(0.25)
            sway(f'[app_id="{app_id}"]', "opacity", "1")
        log(f"mpv platziert: {cur} -> {target}")
    return True


# --- QR-Kaertchen "Song wuenschen" im Video (YOUTUBE-MUSIK-SETUP.md 6.5) -----
# Das Dashboard zeichnet das Kaertchen in ein Canvas (window.nlQrKarte, PNG als
# Daten-URL, Groesse in CSS-Pixeln bei 1920er Breite). Hier wird es auf die
# echte Fenstergroesse skaliert, in rohes BGRA (vormultipliziert) gewandelt und
# mit mpvs overlay-add in die rechte untere Ecke gelegt. Braucht Pillow
# (python-pillow). Ohne Pillow gibt es einfach keinen QR im Video.
QR_DATEI = "/tmp/ytm-qr.bgra"
QR_OVERLAY_ID = 7
QR_CSS_BREITE = {"yt": 1200, "yt_voll": 1280, "yt_dj": 640}   # Videobreite in CSS-Pixeln je Flaeche


def qr_karte_holen(page_id):
    """-> PIL.Image (RGBA) oder None."""
    try:
        from PIL import Image
        import io
    except ImportError:
        return None
    try:
        daten = cdp_eval(page_id, "window.nlQrKarte ? window.nlQrKarte.png : ''") or ""
        if not daten.startswith("data:image/png;base64,"):
            return None
        return Image.open(io.BytesIO(base64.b64decode(daten.split(",", 1)[1]))).convert("RGBA")
    except Exception as e:
        log(f"QR-Kaertchen nicht lesbar: {type(e).__name__}")
        return None


def qr_overlay_setzen(karte, info, target, rect_art):
    """Kaertchen fuer die aktuelle Fenstergroesse setzen. -> Schluessel der Lage."""
    from PIL import Image
    css_breite = QR_CSS_BREITE.get(rect_art, 1200)
    skala = ausgabe_skala()
    tw, th = target["w"] * skala, target["h"] * skala      # echte Bildpunkte im mpv-Fenster
    massstab = tw / float(css_breite)
    faktor = float(info.get("faktorVoll") or 1) if rect_art == "yt_voll" else 1.0
    rand = float(info.get("randVoll") or 20) if rect_art == "yt_voll" else float(info.get("rand") or 18)
    w = max(1, round(float(info.get("breite") or 174) * faktor * massstab))
    h = max(1, round(float(info.get("hoehe") or 192) * faktor * massstab))
    x = round(tw - rand * massstab - w)
    y = round(th - rand * massstab - h)
    bild = karte.resize((w, h), Image.LANCZOS)
    # mpv erwartet vormultiplizierte Alphawerte: Farbe * Alpha.
    schwarz = Image.new("RGB", (w, h), (0, 0, 0))
    farbe = Image.composite(bild.convert("RGB"), schwarz, bild.getchannel("A"))
    farbe.putalpha(bild.getchannel("A"))
    with open(QR_DATEI, "wb") as f:
        f.write(farbe.tobytes("raw", "BGRA"))
    mpv_befehl("overlay-add", QR_OVERLAY_ID, x, y, QR_DATEI, 0, "bgra", w, h, w * 4)
    return (x, y, w, h)


def ambi_farben(target):
    """Ambilight: Randfarben des mpv-Bilds -> {"l","r","t","b","m"} als "r,g,b".
    grim nimmt nur das Videorechteck und verkleinert es gleich auf 5 % - das
    kostet ein paar Millisekunden, nicht die Wiedergabe."""
    from PIL import Image
    try:
        aus = subprocess.run(["grim", "-g", f"{target['x']},{target['y']} {target['w']}x{target['h']}",
                              "-s", "0.05", "-t", "ppm", "-"],
                             capture_output=True, timeout=2, env={**os.environ, **session_env()})
        if aus.returncode != 0 or not aus.stdout:
            return None
        bild = Image.open(io.BytesIO(aus.stdout)).convert("RGB").resize((16, 9), Image.BOX)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None

    def mittel(kasten):
        return bild.crop(kasten).resize((1, 1), Image.BOX).getpixel((0, 0))

    gesamt = mittel((0, 0, 16, 9))
    farben = {"m": gesamt}
    for seite, kasten in (("l", (0, 0, 4, 9)), ("r", (12, 0, 16, 9)), ("t", (0, 0, 16, 3)), ("b", (0, 6, 16, 9))):
        f = mittel(kasten)
        # Schwarze Balken (4:3-Video im 16:9-Rahmen) wuerden den Rand dunkel
        # lassen - dann lieber die Farbe des ganzen Bilds.
        farben[seite] = f if sum(f) > 45 else gesamt
    def kraeftig(rgb):
        # Wie ein echtes Ambilight: Farbe satter und heller als der Bildschnitt,
        # sonst verschwindet der Schein bei dunklen Videos im Hintergrund.
        import colorsys
        h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in rgb))
        # hoechstens 75 % Helligkeit: bei weissem Bild wuerde der Schein die Schrift ueberstrahlen
        r, g, b = colorsys.hsv_to_rgb(h, min(1.0, s * 1.6), min(0.75, max(v * 1.5, 0.35)))
        return (r * 255, g * 255, b * 255)

    return {k: ",".join(str(int(x)) for x in kraeftig(v)) for k, v in farben.items()}


# Ambilight laeuft in einem eigenen Faden: die Hauptschleife dreht nur alle
# 0,5 s und waere sonst durch grim (~0,16 s) jedes Mal aufgehalten. Die
# Hauptschleife traegt hier ein, ob und wo gemessen werden soll (ts = zuletzt
# bestaetigt; ohne Bestaetigung in 2 s hoert der Faden von selbst auf).
AMBI_TAKT = 0.25
ambi_lage = {"ts": 0.0, "target": None, "page": None}


def ambi_schleife():
    while True:
        if time.time() - ambi_lage["ts"] < 2 and ambi_lage["target"] and ambi_lage["page"]:
            farben = ambi_farben(ambi_lage["target"])
            if farben:
                js = "".join(f"document.body.style.setProperty('--ambi-{k}','{v}');"
                             for k, v in farben.items() if k in "lrtb")
                try:
                    cdp_eval(ambi_lage["page"], js + "1")
                except (OSError, ValueError, ConnectionError):
                    pass
            time.sleep(AMBI_TAKT)
        else:
            time.sleep(0.5)


def ueberblenden(xf, target, page_id, vol):
    """Faden fuer die Ueberblendung: wartet, bis der neue (angehaltene) mpv geladen ist, legt
    sein unsichtbares Fenster ueber das alte und laesst ihn genau so los, dass er am Beginn des
    Ton-Fensters an seinem Musikanfang ist; das Fenster endet am Musikende des alten Songs.
    Erst beim Loslassen erfaehrt das Dashboard "naechster Song". xf["fertig"] = True am Ende,
    xf["fehler"] = Grund (Text), wenn der neue nicht in Gang kommt.
    Zeitplan (Uhrzeit): t_ende = alter erreicht xf["ende"]; t_ton = t_ende - Fenster;
    t_los = t_ton - (anfang - start) - so lange braucht der neue vom Start bis zur Musik."""
    frist = time.time() + XF_START_FRIST
    while time.time() < frist:
        if xf["proc"].poll() is not None or xf.get("abbruch"):
            break
        if mpv_eigenschaft("time-pos", sock=MPV_SOCK_XF) is not None and place_mpv(target, xf["app"], sichtbar=False):
            break
        time.sleep(0.1)
    else:
        xf["fehler"] = f"kein Bild nach {XF_START_FRIST} s"
        return
    if xf.get("abbruch"):
        return
    if xf["proc"].poll() is not None:
        xf["fehler"] = "neuer mpv beendet"
        return
    gebraucht = time.time() - xf["t0"]
    if gebraucht > XF_VORLAUF_SEK:
        log(f"Ueberblendung: neuer Song erst nach {gebraucht:.1f}s geladen ({xf['vid']})")
    place_mpv(target, xf["app"], sichtbar=False)
    rahmen_setzen(target, sock=MPV_SOCK_XF)

    def t_ende():
        """Uhrzeit, zu der der alte Song sein Musikende erreicht (aus seiner Position)."""
        pos = mpv_eigenschaft("time-pos")
        if isinstance(pos, (int, float)) and (pos < xf["ende"] or not xf.get("t_ende")):
            xf["t_ende"] = time.time() + max(0.0, xf["ende"] - pos)   # danach steht der Zeitpunkt fest
        return xf.get("t_ende") or time.time()

    einsatz = xf.get("einsatz", xf["anfang"])     # volle Musik des neuen (leises Intro davor)
    vorlauf = einsatz - xf["start"]               # neuer: vom Losgehen bis zur vollen Musik
    # Warten bis zum Loslassen (alle 0,2 s neu aus der Position des alten gerechnet)
    while not xf.get("abbruch"):
        t_los = t_ende() - XF_TON_FENSTER_SEK - vorlauf
        warte = t_los - time.time()
        if warte <= 0.25:
            if warte > 0:
                time.sleep(warte)
            break
        time.sleep(min(0.2, warte - 0.2))
    if xf.get("abbruch"):
        return
    # Zu spaet geladen: so weit vorspulen, dass der Musikanfang trotzdem am Fenster liegt
    spaet = time.time() - (t_ende() - XF_TON_FENSTER_SEK - vorlauf)
    if spaet > 0.3:
        ziel = min(einsatz, xf["start"] + spaet)
        mpv_befehl("seek", round(ziel, 2), "absolute", sock=MPV_SOCK_XF)
        log(f"Ueberblendung: {spaet:.1f}s zu spaet - neuer Song ab {ziel:.1f}s")
    mpv_befehl("set_property", "pause", False, sock=MPV_SOCK_XF)
    xf["laeuft"] = True
    beginn = time.time()
    try:
        cdp_eval(page_id, "(() => { try { return !!nlVideoFertig(); } catch (e) { return false; } })()")
    except (OSError, ValueError, ConnectionError):
        pass
    neu_beginn = None
    while True:
        # Abgebrochen (Ueberspringen, Stopp, ...): sofort aufhoeren - sonst
        # drehte der Faden den inzwischen neu gestarteten Player leise.
        if xf.get("abbruch"):
            return
        jetzt = time.time()
        ende = t_ende()
        # Ton: equal power (Amplituden cos/sin) im Fenster vor dem Musikende des alten. Der
        # Fensterbeginn folgt dem neuen Song: er beginnt, sobald der neue am Musikanfang ist
        # (seine Position zaehlt - nicht die Uhr, falls er nach dem Loslassen kurz puffert).
        npos = mpv_eigenschaft("time-pos", sock=MPV_SOCK_XF)
        if neu_beginn is None and isinstance(npos, (int, float)) and npos >= einsatz - 0.05:
            neu_beginn = jetzt - (npos - einsatz)
            apos = mpv_eigenschaft("time-pos")
            log(f"Tonwechsel {xf['vid']}: neu bei {npos:.2f}s (volle Musik ab {einsatz:.1f}s), alt bei "
                + (f"{apos:.2f}s" if isinstance(apos, (int, float)) else "?") + f" (Musikende {xf['ende']:.1f}s)")
        ton_ab = max(ende - XF_TON_FENSTER_SEK, neu_beginn if neu_beginn is not None else ende)
        fenster = max(0.5, ende - ton_ab) if neu_beginn is not None else XF_TON_FENSTER_SEK
        q = 0.0 if neu_beginn is None else min(1.0, max(0.0, (jetzt - ton_ab) / fenster))
        alt_a, neu_a = math.cos(q * math.pi / 2), math.sin(q * math.pi / 2)
        # Leises Intro (>= 2 s zwischen Songanfang und voller Musik): ab dem Songanfang in 1,5 s
        # voll einblenden - es laeuft leise unter dem Ende des alten mit, keine Luecke.
        if einsatz - xf["anfang"] >= 2 and isinstance(npos, (int, float)) and npos >= xf["anfang"]:
            neu_a = max(neu_a, math.sin(min(1.0, (npos - xf["anfang"]) / 1.5) * math.pi / 2))
        # mpv rechnet die Lautstaerke kubisch (Amplitude = (v/100)^3), daher die dritte Wurzel.
        mpv_befehl("set_property", "volume", round(vol * max(0.0, alt_a) ** (1 / 3), 1))
        mpv_befehl("set_property", "volume", round(vol * max(0.0, neu_a) ** (1 / 3), 1), sock=MPV_SOCK_XF)
        # Bild: vom Loslassen bis zum Ende des Ton-Fensters
        p = min(1.0, max(0.0, (jetzt - beginn) / max(0.5, ton_ab + fenster - beginn)))
        sway(f'[app_id="{xf["app"]}"]', "opacity", f"{p:.2f}")
        if q >= 1.0 and p >= 1.0:
            break
        if jetzt - beginn > XF_SEK + 15:          # Notbremse (alter haengt): Ton sofort ganz rueber
            mpv_befehl("set_property", "volume", vol, sock=MPV_SOCK_XF)
            sway(f'[app_id="{xf["app"]}"]', "opacity", "1")
            log(f"Ueberblendung: Notbremse ({xf['vid']})")
            break
        time.sleep(0.1)
    xf["fertig"] = True


# Umschalten Normal <-> Vollbild ohne Ruckler: das Dashboard setzt
# window.nlMpvAusblenden (Zeitstempel) und schaltet die Ansicht erst 250 ms
# spaeter um. Dieser Faden fragt alle 80 ms nach: Video sofort ausblenden,
# warten bis die Seite umgebaut ist, neu platzieren, wieder zeigen. Die
# Hauptschleife (alle 0,5 s) war dafuer zu langsam - das Video lag kurz falsch.
umschalt_lage = {"ts": 0.0, "page": None, "sperre": 0.0}


def umschalt_waechter():
    zuletzt = None
    while True:
        time.sleep(0.08)
        if time.time() - umschalt_lage["ts"] > 2 or not umschalt_lage["page"]:
            continue
        page = umschalt_lage["page"]
        try:
            wert = json.loads(cdp_eval(page, "JSON.stringify([window.nlMpvAusblenden || 0, window.nlMpvFlaeche || ''])") or "null")
        except (OSError, ValueError, ConnectionError):
            continue
        if not wert:
            continue
        if zuletzt is None:
            zuletzt = wert[0]
            continue
        if wert[0] == zuletzt:
            continue
        zuletzt = wert[0]
        app = MPV_APP["id"]
        # Hauptschleife solange nicht platzieren lassen - sie mass sonst mitten im
        # Umbau Zwischengroessen (gesehen: 1200x837) und schob das Fenster herum.
        umschalt_lage["sperre"] = time.time() + 2.5
        sway(f'[app_id="{app}"]', "opacity", "0")
        alte_flaeche = wert[1]
        frist = time.time() + 1.0
        flaeche = alte_flaeche
        while time.time() < frist:         # warten, bis die Seite umgeschaltet hat
            time.sleep(0.05)
            try:
                flaeche = json.loads(cdp_eval(page, "JSON.stringify(window.nlMpvFlaeche || '')") or '""')
            except (OSError, ValueError, ConnectionError):
                pass
            if flaeche != alte_flaeche:
                break
        # Warten, bis die Flaeche zweimal hintereinander gleich gemessen wird
        art = MUSIK_FLAECHE.get(flaeche, "yt")
        ziel, vorher, frist = None, None, time.time() + 1.2
        while time.time() < frist:
            time.sleep(0.08)
            try:
                jetzt_r = measured_rect(page, None, art)
            except (OSError, ValueError, ConnectionError):
                jetzt_r = None
            if jetzt_r and jetzt_r == vorher:
                ziel = jetzt_r
                break
            vorher = jetzt_r
        ziel = ziel or vorher
        if ziel:
            place_mpv(ziel, app, sichtbar=False)
            if umschalt_lage.get("musik"):
                rahmen_setzen(ziel)
            time.sleep(0.15)                # mpv rechnet das Bild auf die neue Groesse
        sway(f'[app_id="{app}"]', "opacity", "1")
        umschalt_lage["sperre"] = 0.0


def aufloesung_text(breite, hoehe):
    """Breite/Hoehe -> "1080p" wie bei YouTube: die hoehere Stufe aus Breite und
    Hoehe - so zaehlen 1920x804 (Kino) und 1440x1080 (4:3) beide als 1080p."""
    stufen = (("4K", 3800, 2100), ("1440p", 2500, 1400), ("1080p", 1900, 1000), ("720p", 1260, 680),
              ("480p", 840, 460), ("360p", 630, 340))
    for name, mind_b, mind_h in stufen:
        if breite >= mind_b or hoehe >= mind_h:
            return name
    return f"{hoehe}p"


# Intro und Ausklang abschneiden (DJ-Art, Wunsch 04.10.2026): sobald ein Song
# aufgeloest ist, misst ffmpeg den Pegel (RMS je 0,5 s) am Anfang (90 s), in der
# Mitte (20 s, als Massstab) und am Ende (60 s). Der Song startet erst, wenn er
# 3 s lang fast seine normale Lautstaerke hat (gesprochene Intros, leise
# Einleitungen, Stille fallen weg), und gilt als vorbei, sobald er deutlich
# unter seine normale Lautstaerke faellt (Ausklang, gesprochene Outros, Stille).
# STILLE[videoId] = {anfang, ende} - die Ueberblendung endet bei "ende".
STILLE = {}
INTRO_ABSTAND_DB = 8       # so nah an der normalen Lautstaerke = "Musik laeuft"
# So weit darunter = "Song ist vorbei" (die Ueberblendung ist dort fertig). 6 statt 10 dB
# (Wunsch 04.10.2026): wird der alte Song hoerbar leiser (Ausklang ohne Gesang), soll er
# schon weg sein. Gemessen: Eye of the Tiger 232,5 -> 229,5 s, Wake Me Up 220 -> 217,5 s,
# Songs mit hartem Schluss (Chantaje, Basket Case) aendern sich um hoechstens 1 s.
AUSKLANG_ABSTAND_DB = 6
EINSATZ_MAX_SEK = 20       # so lange darf ein leises Intro nach dem Songanfang dauern
INTRO_MAX_SEK = 75         # lange Filmszenen vor dem Song (O-Zone: 52 s), hoechstens 30 % des Videos
INTRO_OHNE_LAENGE_SEK = 35 # wenn die echte Songlaenge unbekannt ist (alte Regel)
META = {}                  # videoId -> [artist, track, title, channel] laut yt-dlp
SONGLAENGE = {}            # videoId -> Laenge der Studiofassung (iTunes) oder None


def songlaenge(vid, laenge_video=0):
    """Laenge der Studiofassung laut iTunes (Sekunden) oder None.
    Ein Musikvideo ist oft laenger als der Song (Filmszene vorn, Abspann hinten);
    nur so viel darf als Intro wegfallen - leise gesungene Strophen bleiben.
    Gemessen 04.10.2026: O-Zone Video 286 s / Song 216 s, Song beginnt bei 51 s;
    Mika "Grace Kelly" Strophe 10 dB unter dem Refrain waere sonst weggefallen."""
    if vid in SONGLAENGE:
        return SONGLAENGE[vid]
    SONGLAENGE[vid] = None
    m = (META.get(vid) or []) + ["", "", "", ""]
    kuenstler, track, titel, kanal = [("" if x in ("NA", "None") else x) for x in m[:4]]
    if kuenstler and track:
        frage = f"{kuenstler.split(',')[0]} {track}"
    else:
        frage = re.sub(r"[\(\[].*?[\)\]]", " ", titel)
        frage = re.sub(r"(?i)official|music video|video|offizielles|musikvideo|videoclip|lyrics?|\bHD\b|\b4K\b|remaster(ed)?|ft\.|feat\.", " ", frage)
    frage = re.sub(r"[|\"“”]", " ", frage).strip()
    if len(frage) < 3:
        return None
    def norm(x):
        return re.sub(r"[^a-z0-9]", "", x.lower())
    vergleich = norm(" ".join([kuenstler, track, titel, kanal]))
    try:
        url = "https://itunes.apple.com/search?" + urllib.parse.urlencode(
            {"term": frage[:100], "entity": "song", "limit": 8, "country": "at"})
        with urllib.request.urlopen(url, timeout=10) as r:
            daten = json.load(r).get("results", [])
    except (OSError, ValueError) as e:
        log(f"Songlaenge {vid}: iTunes nicht erreichbar ({type(e).__name__})")
        SONGLAENGE.pop(vid, None)      # beim naechsten Mal noch einmal fragen
        return None
    # Remix-/Extended-/Live-Fassungen nur, wenn das Video selbst so heisst;
    # Laenge muss zum Video passen (sonst Snippet, Single-Edit oder Langfassung).
    sonder = re.compile(r"(?i)remix|rmx|extended|\bmix\b|\bedit\b|live|version|acoustic|instrumental|karaoke")
    for d in daten:
        k, s = norm(d.get("artistName", "")), norm(re.sub(r"\(.*?\)|\[.*?\]", "", d.get("trackName", "")))
        sek = (d.get("trackTimeMillis") or 0) / 1000.0
        kw = [norm(w) for w in re.split(r"[ ,&]+", d.get("artistName", "")) if len(norm(w)) >= 3]
        if not (s and s in vergleich and (k in vergleich or any(w in vergleich for w in kw)) and sek > 60):
            continue
        if any(not re.search(re.escape(x), titel, re.I) for x in sonder.findall(d.get("trackName", ""))):
            continue
        if laenge_video and not (0.6 * laenge_video <= sek <= laenge_video + 15):
            continue
        SONGLAENGE[vid] = sek
        log(f"Songlaenge {vid}: {sek:.0f}s ({d.get('artistName')} - {d.get('trackName')})")
        return sek
    log(f"Songlaenge {vid}: kein Treffer fuer '{frage}'")
    return None


def pegel_messen(argumente, fenster=0.5, filt=""):
    """ffmpeg -> Liste RMS-Pegel (dB) je fenster Sekunden (Stille = -90); filt z. B. Tiefpass."""
    try:
        aus = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostats", *argumente, "-af",
             f"{filt}aresample=8000,asetnsamples=n={int(8000 * fenster)},astats=metadata=1:reset=1,"
             "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"],
            capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return []
    werte = []
    for zeile in aus.stdout.splitlines():
        if zeile.startswith("lavfi.astats.Overall.RMS_level="):
            try:
                w = float(zeile.split("=", 1)[1])
            except ValueError:
                w = -90.0
            werte.append(max(-90.0, w) if w == w else -90.0)
    return werte


# Songbeginn wie ein DJ finden (Wunsch 04.10.2026, "Be Mine haette vorgespult gehoert"):
# die Studiofassung (Audio-Upload, Laenge wie bei iTunes) suchen und ihren Anfang im Ton
# der ersten 120 s des Videos wiederfinden (normierte Kreuzkorrelation der Lautstaerke-
# Huelle, 50 ms). Am sichersten: nur der Bass (Tiefpass 150 Hz, Szenengeraeusche stoeren
# kaum) mit 40 s Referenz. Videos mit gekuerzter Radio-Fassung passen nur ueber 20 s -
# dann muessen voller Ton und Bass uebereinstimmen. Getestet 04.10.2026: Be Mine 14,2 s,
# Grace Kelly 18,1 s, Blame 41,2 s, O-Zone 37,7 s (Bass 40 s), Maneater 87,3 s (20 s).
ABGLEICH_HOP = 0.05
ABGLEICH_GUETE = 0.85      # 40 s Referenz
ABGLEICH_GUETE_KURZ = 0.88  # 20 s Referenz, voller Ton und Bass muessen beide passen
ABGLEICH_BASS = "lowpass=f=150,"
ABGLEICH_SCHLECHT = re.compile(r"(?i)live|cover|8d|extended|making|remix|rmx|karaoke|instrumental|sped|slowed|"
                               r"reverb|nightcore|acoustic|official video|music video|videoclip")


def _ncc(v, r):
    """Beste Stelle von r in v (normierte Kreuzkorrelation) -> (guete, index)."""
    m = len(r)
    if not m or len(v) < m:
        return -1.0, 0
    rm = sum(r) / m
    rz = [x - rm for x in r]
    rn = math.sqrt(sum(x * x for x in rz)) or 1.0
    best, lag = -1.0, 0
    for k in range(0, len(v) - m + 1):
        w = v[k:k + m]
        wm = sum(w) / m
        num = den = 0.0
        for a, b in zip(w, rz):
            d = a - wm
            num += d * b
            den += d * d
        c = num / ((math.sqrt(den) or 1.0) * rn)
        if c > best:
            best, lag = c, k
    return best, lag


def studio_abgleich(vid, audio_url, laenge, song):
    """-> {"anfang", "ende", "guete"} oder None."""
    def norm(x):
        return re.sub(r"[^a-z0-9]", "", x.lower())
    m = (META.get(vid) or []) + ["", "", "", ""]
    kuenstler, track, titel = [("" if x in ("NA", "None") else x) for x in m[:3]]
    if not (kuenstler and track):
        teile = re.sub(r"[\(\[].*?[\)\]]", " ", titel).split(" - ", 1)
        if len(teile) < 2:
            return None
        kuenstler, track = teile[0].strip(), teile[1].strip()
    kuenstler = re.split(r",| feat\.| ft\.| & ", kuenstler)[0].strip()
    track = re.sub(r"(?i)\b(official|offizielles|music|musik)?\s*(video|audio)\b|\|.*$", " ", track).strip()
    if not kuenstler or len(norm(track)) < 2:
        return None
    kandidaten = []
    for frage in (f"{kuenstler} {track}", f"{kuenstler} {track} audio"):
        kandidaten = [t for t in suchen(frage, 10)
                      if t["videoId"] != vid and norm(track)[:12] in norm(t["titel"])
                      and not ABGLEICH_SCHLECHT.search(t["titel"])
                      and (not song or abs((t.get("dauerSek") or 0) - song) <= 10)]
        if kandidaten:
            break
    if not kandidaten:
        log(f"Studio-Abgleich {vid}: keine Studiofassung gefunden")
        return None
    kandidaten.sort(key=lambda t: (norm(t["titel"]) != norm(track), "audio" not in t["titel"].lower(),
                                   abs((t.get("dauerSek") or 0) - (song or 0))))
    vf = pegel_messen(["-t", "120", "-i", audio_url], ABGLEICH_HOP)
    vb = pegel_messen(["-t", "120", "-i", audio_url], ABGLEICH_HOP, ABGLEICH_BASS)
    lang, kurz = int(40 / ABGLEICH_HOP), int(20 / ABGLEICH_HOP)
    bestes = None
    for kand in kandidaten[:2]:
        ref = resolve(kand["videoId"], "bestaudio")
        if not ref:
            continue
        rf = pegel_messen(["-t", "50", "-i", ref[0]], ABGLEICH_HOP)
        rb = pegel_messen(["-t", "50", "-i", ref[0]], ABGLEICH_HOP, ABGLEICH_BASS)
        st = next((i for i, x in enumerate(rf) if x > -45), 0)      # Stille vorn ueberspringen
        if len(rf) - st < kurz + 20:
            continue
        b40, f40 = _ncc(vb, rb[st:st + lang]), _ncc(vf, rf[st:st + lang])
        f20, b20 = _ncc(vf, rf[st:st + kurz]), _ncc(vb, rb[st:st + kurz])
        if b40[0] >= ABGLEICH_GUETE:
            g, lag, voll = b40[0], b40[1], True
        elif f40[0] >= ABGLEICH_GUETE:
            g, lag, voll = f40[0], f40[1], True
        elif min(f20[0], b20[0]) >= ABGLEICH_GUETE_KURZ and abs(f20[1] - b20[1]) <= 10:
            g, lag, voll = min(f20[0], b20[0]), f20[1], False
        else:
            log(f"Studio-Abgleich {vid}: '{kand['titel'][:40]}' passt nicht (Bass40 {b40[0]:.2f}, "
                f"Voll40 {f40[0]:.2f}, Voll20 {f20[0]:.2f}, Bass20 {b20[0]:.2f})")
            continue
        anfang = (lag - st) * ABGLEICH_HOP
        log(f"Studio-Abgleich {vid}: '{kand['titel'][:40]}' -> Song ab {anfang:.1f}s, Guete {g:.2f}"
            + ("" if voll else " (gekuerzte Fassung, 20 s)"))
        if not (-1.0 <= anfang <= min(100.0, (laenge or 300) * 0.4)):
            continue
        if bestes is None or g > bestes["guete"]:
            bestes = {"anfang": max(0.0, anfang), "guete": g,
                      "ende": studio_ende(vid, audio_url, laenge, ref, kand["titel"])}
        if g >= 0.95:
            break
    return bestes


def studio_ende(vid, audio_url, laenge, ref, ref_titel):
    """Wo endet die Studiofassung im Video? Ihre letzten 25 hoerbaren Sekunden in den
    letzten 120 s des Videos suchen (voller Ton und Bass, beste Guete >= 0,85). Alles
    danach (Nachspann, Szene, Abspann, Stille) gehoert nicht mehr zum Song - so wie der
    Anfang ueber den Studio-Abgleich, allgemein fuer jedes Video (Wunsch 05.10.2026)."""
    if not (ref and ref[2] and laenge):
        return None
    rl = float(ref[2])
    ref_ab = max(0.0, rl - 45)
    vid_ab = max(0.0, float(laenge) - 120)
    bestes = None
    for filt in ("", ABGLEICH_BASS):
        r = pegel_messen(["-ss", f"{ref_ab:.1f}", "-i", ref[0]], ABGLEICH_HOP, filt)
        hoerbar = [i for i, x in enumerate(r) if x > -45]
        if not hoerbar:
            return None
        r_ende = hoerbar[-1] + 1                     # Stille am Schluss der Studiofassung weglassen
        seg = r[max(0, r_ende - int(25 / ABGLEICH_HOP)):r_ende]
        v = pegel_messen(["-ss", f"{vid_ab:.1f}", "-i", audio_url], ABGLEICH_HOP, filt)
        if len(seg) < 200 or len(v) <= len(seg):
            continue
        g, lag = _ncc(v, seg)
        if bestes is None or g > bestes[0]:
            bestes = (g, vid_ab + (lag + len(seg)) * ABGLEICH_HOP)
    if not bestes:
        return None
    g, ende = bestes
    log(f"Studio-Ende {vid}: '{ref_titel[:40]}' endet im Video bei {ende:.1f}s (Laenge {laenge}s), Guete {g:.2f}")
    if g < ABGLEICH_GUETE or not (laenge * 0.5 < ende <= laenge + 1):
        return None
    return ende


# Gemessenes (Anfang, Einsatz, Ende, Lautheit, Limiter) bleibt auf der Platte (21.10.2026):
# nach einem Neustart des Supervisors lief der laufende Song sonst ~10 s ohne Absenkung, bis er
# neu gemessen war (bis 5 dB zu laut). Gilt nur, solange Fassung und Lautheits-Ziel gleich sind.
STILLE_ORDNER = os.environ.get("CITYCAFE_STILLE", os.path.expanduser("~/.cache/citycafe/stille"))
STILLE_FASSUNG = 2         # hochzaehlen, wenn sich die Messung aendert (dann wird neu gemessen)
# Gute Messungen (Studiofassung gefunden) gelten fuer immer; ohne Studio-Abgleich (z. B. iTunes
# gerade nicht erreichbar) wird nach STILLE_OHNE_ABGLEICH_TAGE neu gemessen, falls es dann klappt.
STILLE_OHNE_ABGLEICH_TAGE = 30


def stille_von_platte(vid):
    """Schon gemessen? Dann STILLE[vid] von der Platte setzen. -> True"""
    if vid in STILLE and "gain" in STILLE[vid]:
        return True
    datei = os.path.join(STILLE_ORDNER, vid + ".json")
    try:
        with open(datei) as f:
            d = json.load(f)
        alter = time.time() - os.path.getmtime(datei)
    except (OSError, ValueError):
        return False
    if d.get("fassung") != STILLE_FASSUNG or d.get("ziel") != LAUT_ZIEL_LUFS:
        return False
    if not d.get("abgleich") and alter > STILLE_OHNE_ABGLEICH_TAGE * 86400:
        return False
    STILLE[vid] = {k: d.get(k) for k in ("anfang", "einsatz", "ende", "gain", "limiter", "abgleich")}
    return True


def stille_speichern(vid):
    try:
        os.makedirs(STILLE_ORDNER, exist_ok=True)
        ziel = os.path.join(STILLE_ORDNER, vid + ".json")
        with open(ziel + ".tmp", "w") as f:
            json.dump({**STILLE[vid], "fassung": STILLE_FASSUNG, "ziel": LAUT_ZIEL_LUFS,
                       "abgleich": bool(STILLE[vid].get("abgleich"))}, f)
        os.replace(ziel + ".tmp", ziel)
    except OSError as e:
        log(f"Intro/Ausklang {vid}: nicht gespeichert ({e})")


def stille_messen(vid, audio_url, laenge):
    if vid in STILLE or not audio_url or stille_von_platte(vid):
        return
    STILLE[vid] = {"anfang": 0.0, "ende": None}
    laenge = float(laenge or 0)
    kopf = pegel_messen(["-t", "90", "-i", audio_url])
    mitte = pegel_messen(["-ss", f"{max(0.0, laenge / 2 - 10):.1f}", "-t", "20", "-i", audio_url]) if laenge > 60 else []
    ab = max(0.0, laenge - 60)
    schluss = pegel_messen(["-ss", f"{ab:.1f}", "-i", audio_url]) if laenge > 60 else []
    alle = sorted(kopf + mitte + schluss, reverse=True)
    if len(alle) < 10:
        return
    normal = alle[len(alle) // 5]                       # "normale" Lautstaerke (80. Perzentil)
    anfang = 0.0
    grenze = normal - INTRO_ABSTAND_DB
    for i in range(len(kopf) - 5):
        if all(w >= grenze for w in kopf[i:i + 6]):     # 3 s am Stueck fast normal laut
            anfang = max(0.0, i * 0.5 - 0.25)
            break
    # Hoechstens so viel weg, wie das Video laenger ist als der Song (+4 s Stille);
    # ohne bekannte Songlaenge wie bisher hoechstens 35 s.
    song = songlaenge(vid, laenge)
    if song and laenge:
        erlaubt = min(INTRO_MAX_SEK, max(0.0, laenge - song) + 4)
    else:
        erlaubt = INTRO_OHNE_LAENGE_SEK
    if anfang < 0.4 or anfang > min(erlaubt, laenge * 0.3):
        anfang = 0.0
    # Genauer: Studiofassung im Video wiederfinden (geht vor der Pegel-Regel).
    abgl = studio_abgleich(vid, audio_url, laenge, song)
    if abgl:
        anfang = abgl["anfang"] if abgl["anfang"] >= 0.4 else 0.0
    # Einsatz: ab hier volle Musik (2 s fast normal laut). Leise Intros gehoeren zum Song
    # (Madcon "Don't Worry" Lyric-Video: 7 s bei -30 dB, normal -10 dB) - die Ueberblendung
    # wechselt erst am Einsatz, das leise Intro laeuft unter dem Ende des alten Songs mit
    # (21.10.2026: sonst 5-7 s fast Stille). Hoechstens EINSATZ_MAX_SEK nach dem Anfang.
    einsatz = anfang
    grenze_e = normal - INTRO_ABSTAND_DB
    i0 = int(anfang / 0.5)
    for i in range(i0, min(len(kopf) - 3, i0 + int(EINSATZ_MAX_SEK / 0.5))):
        if all(w >= grenze_e for w in kopf[i:i + 4]):
            einsatz = max(anfang, i * 0.5)
            break
    ende = None
    if schluss:
        grenze = normal - AUSKLANG_ABSTAND_DB
        for j in range(len(schluss) - 1, 3, -1):        # letzte Stelle, die noch "Song" ist
            if schluss[j] >= grenze and sum(w >= grenze for w in schluss[j - 4:j]) >= 3:
                ende = ab + (j + 1) * 0.5
                break
        if ende is not None and not (1.0 <= laenge - ende <= 55):
            ende = None
        # Pause (>= 2 s fast still) und danach nur noch ein kurzer Nachspann (<= 15 s):
        # Song endet vor der Pause. Michelle "So oder so" (05.10.2026): Song bis 210 s,
        # 5 s Stille, 10 s Nachspann - sonst kam die Ueberblendung erst nach der Stille.
        if ende is not None:
            still = normal - 30
            j_ende = int((ende - ab) / 0.5)
            j = j_ende - 1
            while j >= 4:
                if all(w < still for w in schluss[j - 3:j + 1]):
                    k = j - 3
                    while k > 0 and schluss[k - 1] < still:
                        k -= 1
                    if ende - (ab + (j + 1) * 0.5) <= 15 and k > 0:
                        ende = ab + k * 0.5
                    break
                j -= 1
    # Ende der Studiofassung im Video (Test mit 100 Songs, 05.10.2026):
    # - frueher als die Pegel-Regel: nur, wenn danach ein Bruch kommt (>= 1 s weit unter
    #   normal) - Nachspann/Szene wie bei Michelle. Ohne Bruch ist das Video eine laengere
    #   Fassung des Songs (Martin Solveig "Intoxicated": Studio 173 s, Song bis 188 s).
    # - deutlich spaeter als die Pegel-Regel: der leise Schlussteil gehoert zum Song
    #   (Pocahontas: Pegel 160 s, Studio 185 s) - hoechstens 10 s vor dem Studio-Ende,
    #   die blendet die Ueberblendung ohnehin aus.
    s_ende = abgl.get("ende") if abgl else None
    if s_ende and s_ende < laenge - 1 and schluss:
        bis = ende or laenge
        if s_ende < bis:
            j0, j1 = int((s_ende - ab) / 0.5), int((bis - ab) / 0.5)
            stueck = schluss[max(0, j0):max(0, j1) + 1]
            if any(all(w < normal - 20 for w in stueck[i:i + 2]) for i in range(len(stueck) - 1)):
                ende = s_ende
        elif s_ende - 10 > bis:
            ende = s_ende - 10
    gain, limiter = anhebung(audio_url)
    STILLE[vid] = {"anfang": round(anfang, 2), "einsatz": round(einsatz, 2),
                   "ende": round(ende, 2) if ende else None, "gain": gain,
                   "limiter": limiter, "abgleich": bool(abgl)}
    stille_speichern(vid)
    log(f"Intro/Ausklang {vid}: normal {normal:.0f} dB, Start {anfang:.1f}s "
        + (f"(volle Musik ab {einsatz:.1f}s) " if einsatz - anfang >= 1 else "")
        + (f"(Studio-Abgleich, Guete {abgl['guete']:.2f}), " if abgl else f"(erlaubt {erlaubt:.0f}s), ") +
        f"Ende {('%.1fs' % ende) if ende else '-'} (Laenge {laenge:.0f}s)"
        + (f", Lautheit {gain:+.1f} dB" if gain else "") + (f", Limiter +{limiter:.1f} dB" if limiter else ""))


# Alle Songs auf dieselbe Hoerlautstaerke (Wunsch 16.10.2026): feste Verstaerkung je
# Song ueber mpv volume-gain, gemessen als Lautheit nach EBU R128 (LUFS, ganzer Song) -
# so normieren auch YouTube und Spotify. Laute Songs werden abgesenkt, leise angehoben,
# nie ueber die Spitzen hinaus (keine Uebersteuerung, kein Limiter); kein Pumpen wie
# beim dynaudnorm-Ausgleich. Test mit 458 Playlist-Songs (16.10.2026): Original -29 bis
# -5 LUFS (Median -8,8); bisher (nur leise anheben, RMS) lagen 39 % innerhalb +-1,5 dB,
# mit Ziel -11 LUFS sind es 79 %. Rest: leise Songs mit Spitzen nahe 0 dBFS - fuer die
# darf ein sanfter Limiter hoechstens LIMITER_MAX_DB mehr herausholen (am Handy
# abschaltbar). Er greift nur an den lautesten Spitzen dieser Songs, sonst nie.
# 21.10.2026: Ziel -14 LUFS statt -11 (wie YouTube/Spotify; im Cafe gleicht die Endstufe die
# 3 dB aus). Nachgerechnet mit 79 Playlist-Songs (-26,1 bis -5,8 LUFS): mit -11 lagen 94,9 %
# innerhalb +-1,5 dB (leisester -4,1 dB, Limiter bei 28 Songs), mit -14 alle innerhalb +-1,5 dB,
# 74 innerhalb +-0,3 dB, Limiter bei 4 Songs; leisester: September (EWF) -1,1 dB.
LAUT_ZIEL_LUFS = -14.0
LIMITER_MAX_DB = 2.0
LIMITER_GRENZE = 0.891     # -1 dBFS
GAIN_MAX_DB = 15.0         # hoechstens so viel anheben ...
ABSENKUNG_MAX_DB = 15.0    # ... bzw. absenken
GAIN_RESERVE_DB = 1.0      # Abstand der lautesten Spitze zu 0 dBFS


def anhebung(audio_url):
    """-> (gain, limiter): dB, um die der Song ohne Limiter angehoben (+) oder abgesenkt (-)
    wird, und wie viel der Limiter zusaetzlich anheben darf (0 bis LIMITER_MAX_DB)."""
    try:
        aus = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", audio_url, "-vn",
                              "-af", "ebur128=peak=sample:framelog=verbose", "-f", "null", "-"],
                             capture_output=True, text=True, timeout=90)
        summe = aus.stderr[aus.stderr.rfind("Summary:"):]
        lufs = float(re.search(r"I:\s*(-?[\d.]+) LUFS", summe).group(1))
        spitze = float(re.search(r"Peak:\s*(-?[\d.]+) dBFS", summe).group(1))
    except (OSError, subprocess.TimeoutExpired, AttributeError, ValueError):
        return 0.0, 0.0
    if lufs < -60:             # (fast) stumm - nichts anheben
        return 0.0, 0.0
    wunsch = LAUT_ZIEL_LUFS - lufs
    limiter = 0.0
    if wunsch > 0:
        gain = max(0.0, min(wunsch, GAIN_MAX_DB, -GAIN_RESERVE_DB - spitze))   # leise Songs nie absenken
        rest = min(wunsch, GAIN_MAX_DB) - gain
        if rest >= 0.5:
            limiter = round(min(rest, LIMITER_MAX_DB), 1)
    else:
        gain = max(wunsch, -ABSENKUNG_MAX_DB)
    return (round(gain, 1) if abs(gain) >= 0.5 else 0.0), limiter


def gain_von(vid):
    return (STILLE.get(vid) or {}).get("gain") or 0.0


def ton_zustand(vid, limiter_an):
    """-> (volume-gain, Audiofilter oder None) fuer mpv. Mit Limiter steckt die ganze
    Verstaerkung im Filter: mpv rechnet volume-gain erst NACH den Audiofiltern, der
    Limiter muss aber das schon verstaerkte Signal sehen."""
    g = gain_von(vid)
    lim = (STILLE.get(vid) or {}).get("limiter") or 0.0
    if not (limiter_an and lim):
        return g, None
    return 0.0, (f"lavfi=[volume={g + lim:.1f}dB,"
                 f"alimiter=limit={LIMITER_GRENZE}:level=false:attack=5:release=100]")


def ton_args(vid, limiter_an):
    stille_von_platte(vid)                 # nach einem Neustart: Lautheit sofort von der Platte
    g, af = ton_zustand(vid, limiter_an)
    return [f"--volume-gain={g}"] + ([f"--af={af}"] if af else [])


def stille_ende(vid, dauer):
    """Wirksames Songende: Beginn der Schlussstille, sonst die Laenge."""
    e = (STILLE.get(vid) or {}).get("ende")
    return min(dauer, e) if (e and dauer) else dauer


# Seitliche Balken (4:3, Hochformat) mit dem eigenen Video fuellen - gross,
# unscharf, abgedunkelt, wie im Fernsehen (Wunsch 04.10.2026, nur seitlich).
# Gemessen auf dem W1: 4:3-Video 1080p 22 % -> 45 % eines Kerns (von 16),
# deshalb nur bei Videos schmaler als 16:9. Dafuer dekodiert die GPU mit
# Rueckkopie (vaapi-copy), der Filter laeuft auf 1280x720.
FORMATE = {}               # videoId -> (breite, hoehe) laut yt-dlp
KANTEN = {}                # videoId -> "crop=w:h:x:y" bei eingebrannten Seitenbalken
SEITEN_BLUR = ("lavfi=[{crop}split[a][b];[a]scale=256:144:force_original_aspect_ratio=increase,crop=256:144,"
               "boxblur=8:2,eq=brightness=-0.12:saturation=1.2,scale=1280:720[bg];"
               "[b]scale=-2:720:flags=bicubic[fg];[bg][fg]overlay=(W-w)/2:0]")


def balken_messen(vid, video_url, laenge):
    """Eingebrannte schwarze Seitenbalken finden (viele 4:3-Videos liefert YouTube
    als 1920x1080 mit Balken aus): ffmpeg cropdetect auf 3 s, ~0,5 s Rechenzeit."""
    if vid in KANTEN or not video_url:
        return
    KANTEN[vid] = None
    ab = min(60.0, max(5.0, float(laenge or 0) * 0.3))
    try:
        aus = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", f"{ab:.0f}", "-t", "3",
                              "-i", video_url, "-vf", "cropdetect=limit=24:round=2:reset=0",
                              "-an", "-f", "null", "-"], capture_output=True, text=True, timeout=40)
    except (OSError, subprocess.TimeoutExpired):
        return
    m = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", aus.stderr)
    b, h = FORMATE.get(vid, (0, 0))
    if not m or not b:
        return
    cw, ch, cx, cy = (int(x) for x in m[-1])
    if cw <= b * 0.88 and ch >= h * 0.9:       # nur seitliche Balken (oben/unten bleibt)
        KANTEN[vid] = f"crop={cw}:{h}:{cx}:0,"
        log(f"Seitenbalken {vid}: Bild {cw}x{h} in {b}x{h}")


# DJ-Modus (Wunsch 18.10.2026): das Studio zeigt Wellenform, BPM und Pegel des
# laufenden Songs. Der Ton laeuft weiter nur ueber mpv; hier wird er einmal ganz
# gemessen (~3 s Rechenzeit): je 5 ms Spitze/RMS links und rechts, RMS in drei Baendern.
# Gespeichert werden nur diese Zahlen (Bytes, base64), nie der Ton.
SPUREN = {}                # videoId -> JSON-Text fuer window.nlStudioSpuren
# Gemessenes bleibt auf der Platte (je Song ~250 KB gz): jeder Song wird nur einmal gemessen,
# auch nach einem Neustart sofort da. Hoechstens SPUR_PLATTE_MB, die aeltesten fliegen raus.
SPUR_ORDNER = os.environ.get("CITYCAFE_SPUREN", os.path.expanduser("~/.cache/citycafe/spuren"))
# Obergrenze fuer gespeicherte Spuren (je Song ~225 KB, 707 Songs = 158 MB). 600 MB bis 21.10.,
# seit 21.10. 3 GB (~13000 Songs) - die aeltesten (zuletzt benutzt) fliegen erst darueber raus.
# Kleine Platte: CITYCAFE_SPUR_MB in citycafe.env setzen.
SPUR_PLATTE_MB = int(os.environ.get("CITYCAFE_SPUR_MB", "3000"))
SPUR_VERSION = 3           # hochzaehlen, wenn sich Messung/Format aendern (alte werden neu gemessen)
# Vormessen (Wunsch 19.10.2026): solange keine Musik laeuft, alle Playlist-Songs messen, damit
# Wellenform & Co. im DJ-Modus sofort da sind.
# Ein Song nach dem anderen, gebremst (SPUR_LESETEMPO) und mit Pause - viele yt-dlp-Abfragen
# hintereinander koennen YouTubes Bot-Erkennung ausloesen; nach mehreren Fehlern 1 h Pause.
# Standard an (Betreiber 19.10.2026, wichtig fuer den W1); abschalten mit CITYCAFE_VORMESSEN=0.
VORMESSEN = os.environ.get("CITYCAFE_VORMESSEN", "1") != "0"
VORMESS_PAUSE = 15
VORMESS_PAUSE_MUSIK = 45   # bei Musik: Pause zwischen zwei Songs
VORMESS_FEHLER_PAUSE = 3600
# Reihenfolge (Betreiber 22.10.2026): zuerst die Warteschlange, dann die ganze laufende Playlist
# (die Schlange hat nur noch die kommenden Songs), dann die Schlager-Playlists, dann der Rest.
VORMESS_EXPR = """JSON.stringify((() => { try { const ids = new Set();
  const schlange = (typeof ytm !== 'undefined' && ytm && ytm.eintraege) || [];
  schlange.forEach(e => e && e.videoId && ids.add(e.videoId));
  const laufend = new Set([ytm && ytm.jetzt && ytm.jetzt.liste, ...schlange.map(e => e && e.liste)].filter(Boolean));
  (ytmPlaylists || []).filter(p => laufend.has(p.name)).forEach(p =>
    (ytmListenInhalt[p.nr] || []).forEach(t => t && t.videoId && ids.add(t.videoId)));
  (ytmPlaylists || []).filter(p => /schlager/i.test(p.name || '')).forEach(p =>
    (ytmListenInhalt[p.nr] || []).forEach(t => t && t.videoId && ids.add(t.videoId)));
  Object.values(ytmListenInhalt || {}).forEach(l => (l || []).forEach(t => t && t.videoId && ids.add(t.videoId)));
  return [...ids]; } catch (e) { return []; } })())"""
SPUR_HZ = 200              # Werte je Sekunde (12000 Hz / 60 Samples: genau, ohne Drift)
SPUR_LESETEMPO = 8         # ffmpeg liest hoechstens 8x so schnell wie abgespielt
# Kanaele nach amerge: 1 links, 2 rechts, 3 tief, 4 mitte, 5 hoch (Baender aus der Mono-Summe)
SPUR_FILTER = ("aresample=12000,aformat=channel_layouts=stereo,asplit=2[st][mo];"
               "[st]channelsplit=channel_layout=stereo[L][R];"
               "[mo]pan=mono|c0=0.5*c0+0.5*c1,asplit=3[a][b][c];"
               "[a]lowpass=f=200[l];[b]highpass=f=200,lowpass=f=2500[m];[c]highpass=f=2500[h];"
               "[L][R][l][m][h]amerge=inputs=5,asetnsamples=n=60:p=0,"
               "astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level:measure_overall=none,"
               "ametadata=print:file=-")


# Tonart (Wunsch 18.10.2026): im selben ffmpeg-Lauf 48 Halbton-Bandpaesse (C3..H6), Energie je
# Tonklasse, Vergleich mit den Krumhansl-Profilen der 24 Tonarten. Mit Akkorden geprueft (C-Dur,
# a-Moll richtig); bei echten Songs ungefaehr - oft Paralleltonart oder Quinte daneben.
TON_NOTEN = list(range(48, 96))
TON_DUR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
TON_MOLL = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
TON_NAMEN = ["C", "Des", "D", "Es", "E", "F", "Fis", "G", "As", "A", "B", "H"]
CAMELOT_DUR = {0: "8B", 7: "9B", 2: "10B", 9: "11B", 4: "12B", 11: "1B", 6: "2B", 1: "3B", 8: "4B", 3: "5B", 10: "6B", 5: "7B"}
CAMELOT_MOLL = {9: "8A", 4: "9A", 11: "10A", 6: "11A", 1: "12A", 8: "1A", 3: "2A", 10: "3A", 5: "4A", 0: "5A", 7: "6A", 2: "7A"}


def ton_filter(datei):
    teile = ["aresample=12000,pan=mono|c0=0.5*c0+0.5*c1,asplit=%d%s"
             % (len(TON_NOTEN), "".join("[k%d]" % i for i in range(len(TON_NOTEN))))]
    for i, m in enumerate(TON_NOTEN):
        teile.append("[k%d]bandpass=f=%.2f:width_type=q:w=25[b%d]" % (i, 440 * 2 ** ((m - 69) / 12), i))
    teile.append("".join("[b%d]" % i for i in range(len(TON_NOTEN)))
                 + "amerge=inputs=%d,asetnsamples=n=600000:p=0,astats=metadata=1:reset=1:"
                   "measure_perchannel=RMS_level:measure_overall=none,ametadata=print:file=%s"
                 % (len(TON_NOTEN), datei))
    return ";".join(teile)


def ton_bestimmen(text):
    """ametadata-Ausgabe der Bandpaesse -> (camelot, name, guete) oder None."""
    energie = [0.0] * len(TON_NOTEN)
    for z in text.splitlines():
        m = re.match(r"lavfi\.astats\.(\d+)\.RMS_level=(.*)", z)
        if m:
            try:
                v = float(m.group(2))
            except ValueError:
                continue
            if v == v and v > -200:
                energie[int(m.group(1)) - 1] += 10 ** (v / 10)
    chroma = [0.0] * 12
    for i, m in enumerate(TON_NOTEN):
        chroma[m % 12] += energie[i]
    if not any(chroma):
        return None

    def korr(a, b):
        ma, mb = sum(a) / 12, sum(b) / 12
        n = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b)) or 1
        return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / n
    beste = max(((korr(chroma[t:] + chroma[:t], p), t, art)
                 for t in range(12) for p, art in ((TON_DUR, "Dur"), (TON_MOLL, "Moll"))))
    g, t, art = beste
    cam = (CAMELOT_DUR if art == "Dur" else CAMELOT_MOLL)[t]
    name = TON_NAMEN[t] + ("-Dur" if art == "Dur" else "-Moll")
    return cam, name, round(g, 2)


def spur_bpm(tief, voll, hz=100):
    """BPM und Taktbeginn aus der Einsatz-Huellkurve (Bass doppelt) per Autokorrelation.
    Sicherheit: stimmen erste und zweite Songhaelfte im Tempo ueberein (fester Takt)?
    -> (bpm, versatz_s, sicherheit 0..1) oder (None, 0, 0)."""
    n = len(tief)
    if n < hz * 20:
        return None, 0.0, 0.0
    ons = [0.0] + [max(0.0, tief[i] - tief[i - 1]) * 2 + max(0.0, voll[i] - voll[i - 1]) for i in range(1, n)]
    mittel = sum(ons) / n
    ons = [x - mittel for x in ons]

    def schaetzen(reihe):
        def ak(lag):
            return sum(a * b for a, b in zip(reihe, reihe[lag:]))
        lags = range(int(hz * 60 / 190), int(hz * 60 / 70) + 1)
        werte = {lag: ak(lag) for lag in lags}
        best = max(lags, key=lambda lag: werte[lag] + 0.5 * ak(2 * lag))
        a, b, c = werte.get(best - 1, 0.0), werte[best], werte.get(best + 1, 0.0)
        teiler = a - 2 * b + c
        bpm = 60.0 * hz / (best + (0.5 * (a - c) / teiler if teiler else 0.0))
        while bpm < 85:
            bpm *= 2
        while bpm > 175:
            bpm /= 2
        return bpm
    bpm = schaetzen(ons)
    h1, h2 = schaetzen(ons[:n // 2]), schaetzen(ons[n // 2:])
    abweichung = max(abs(h1 - bpm), abs(h2 - bpm)) / bpm * 100       # Prozent
    sicher = max(0.0, 1.0 - abweichung / 3.0)                        # ab 3 % Abweichung: 0
    # Taktbeginn: Phase, auf der die Einsaetze im Schlagabstand am staerksten sind
    schlag = 60.0 * hz / bpm

    def gewicht(ph):
        s, k = 0.0, float(ph)
        while k < n:
            s += ons[int(k)]
            k += schlag
        return s
    versatz = max(range(max(1, int(schlag))), key=gewicht) / hz
    return round(bpm, 1), round(versatz, 3), sicher


# Kurzwerte je Song fuer die Karten "Naechste Titel": [bpm, sicher, camelot] (aus der Studio-Spur,
# auch von der Platte - die Playlists sind vorgemessen). None = nicht gemessen.
KURZ = {}


def spur_kurz(vid):
    if vid in KURZ:
        return KURZ[vid]
    text = SPUREN.get(vid)
    if not text:
        try:
            with gzip.open(spur_datei(vid), "rt", encoding="utf-8") as f:
                text = f.read()
        except OSError:
            return None                          # (noch) nicht gemessen - spaeter neu nachsehen
    try:
        d = json.loads(text)
        KURZ[vid] = [d.get("bpm"), d.get("sicher"), d.get("camelot")] if d.get("version") == SPUR_VERSION else None
    except ValueError:
        KURZ[vid] = None
    return KURZ[vid]


def haenger_sichern():
    """Bei einem Haenger die mpv-Logs aufheben (je Start ueberschrieben) - dort steht der Grund
    (Netz, YouTube kappt den Strom, Decoder). ~/mpv-haenger/<Zeit>-nl.log, die letzten 20."""
    ordner = os.path.expanduser("~/mpv-haenger")
    stempel = time.strftime("%m%d-%H%M%S")
    try:
        os.makedirs(ordner, exist_ok=True)
        for quelle in glob.glob("/home/citycafe/mpv-*.log"):    # mpv-nl, mpv-xf-mpv, mpv-xf-mpvxf
            name = os.path.basename(quelle)[4:-4]
            if time.time() - os.path.getmtime(quelle) < 600:
                with open(quelle, "rb") as f:
                    daten = f.read()[-2_000_000:]
                with open(os.path.join(ordner, f"{stempel}-{name}.log"), "wb") as f:
                    f.write(daten)
        for alt in sorted(glob.glob(os.path.join(ordner, "*.log")))[:-20]:
            os.remove(alt)
        log(f"mpv-Logs gesichert: {ordner}/{stempel}-*.log")
    except OSError as e:
        log(f"mpv-Logs nicht gesichert ({e})")


def spur_datei(vid):
    return os.path.join(SPUR_ORDNER, vid + ".json.gz")


def spur_von_platte(vid):
    """Schon einmal gemessen? Dann laden (und als zuletzt benutzt markieren). -> True"""
    try:
        with gzip.open(spur_datei(vid), "rt", encoding="utf-8") as f:
            text = f.read()
        if json.loads(text).get("version") != SPUR_VERSION:
            return False
        os.utime(spur_datei(vid))
        SPUREN[vid] = text
        log(f"Studio-Spur {vid}: von der Platte")
        return True
    except (OSError, ValueError):
        return False


def spur_speichern(vid, text):
    try:
        os.makedirs(SPUR_ORDNER, exist_ok=True)
        tmp = spur_datei(vid) + ".tmp"
        with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=6) as f:
            f.write(text)
        os.replace(tmp, spur_datei(vid))
        dateien = sorted(glob.glob(os.path.join(SPUR_ORDNER, "*.json.gz")), key=os.path.getmtime)
        groesse = sum(os.path.getsize(p) for p in dateien)
        while dateien and groesse > SPUR_PLATTE_MB * 1024 * 1024:
            alt = dateien.pop(0)
            groesse -= os.path.getsize(alt)
            os.remove(alt)
    except OSError as e:
        log(f"Studio-Spur {vid}: nicht gespeichert ({e})")


# Takt (21.10.2026): Schlaege und Takt-Einsen mit beat_this (CPJKU 2024) - genauer als das
# gerechnete Raster (Eins oft falsch, Bands ohne festes Tempo). Laeuft nur, wenn beat_this in
# einer eigenen Python-Umgebung eingerichtet ist (CITYCAFE_TAKT_PYTHON, Standard
# ~/.local/share/citycafe/beat-venv/bin/python; Einrichtung: STAND.md / AUFTRAG-W1.md), sonst
# bleibt alles wie bisher. Je Song ~7 s auf 1 Kern mit niedrigster Prioritaet, Ton gedrosselt
# (-readrate 16). Ergebnis ~/.cache/citycafe/takt/<id>.json, an die Seite als window.nlStudioTakte.
# Format wie dj-studio/takt/*.json: {"v":1,"b":[Abstaende ms],"e":[Index der Einsen]}.
TAKT_PYTHON = os.environ.get("CITYCAFE_TAKT_PYTHON", os.path.expanduser("~/.local/share/citycafe/beat-venv/bin/python"))
TAKT_ORDNER = os.environ.get("CITYCAFE_TAKT", os.path.expanduser("~/.cache/citycafe/takt"))
TAKT_FEHL = {}             # videoId -> Zeit des letzten Fehlschlags (6 h Pause)
TAKT_RECHNER = r"""
import sys, os, json, subprocess, tempfile
import torch
torch.set_num_threads(1)
from beat_this.inference import File2Beats
vid, url, ziel = sys.argv[1:4]
fd, wav = tempfile.mkstemp(suffix='.wav'); os.close(fd)
try:
    r = subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-readrate', '16',
                        '-i', url, '-vn', '-ac', '1', '-ar', '22050', wav], capture_output=True, timeout=300)
    if r.returncode or os.path.getsize(wav) < 100000:
        sys.exit(2)
    beats, downs = File2Beats(checkpoint_path='final0', device='cpu', dbn=False)(wav)
finally:
    os.remove(wav)
ms = [round(float(x) * 1000) for x in beats]
if len(ms) < 16:
    sys.exit(3)
eins = []
for d in downs:
    i = min(range(len(ms)), key=lambda k: abs(ms[k] - d * 1000))
    if abs(ms[i] - d * 1000) < 60 and (not eins or eins[-1] != i):
        eins.append(i)
tmp = ziel + '.tmp'
json.dump({'v': 1, 'b': [ms[0]] + [b - a for a, b in zip(ms, ms[1:])], 'e': eins}, open(tmp, 'w'), separators=(',', ':'))
os.replace(tmp, ziel)
"""


def takt_an():
    return os.access(TAKT_PYTHON, os.X_OK)


def takt_datei(vid):
    return os.path.join(TAKT_ORDNER, vid + ".json")


# Messdaten ins Repo (22.10.2026, Betreiber: "der W1 kuemmert sich selbst um seine Daten, der PC
# zuhause macht nichts"). Takt -> dj-studio/takt/, Lautheit/Intro/Ende -> dj-studio/messwerte/.
# Einmal am Tag ab REPO_AB (nach dem Update um 8:30). Schreiben mit eigenem Deploy-Key (~/.ssh/citycafe-repo,
# im Repo unter Settings -> Deploy keys mit Schreibrecht); ohne Key passiert nichts.
REPO_KEY = os.path.expanduser("~/.ssh/citycafe-repo")
REPO_ORDNER = os.path.expanduser("~/.cache/citycafe/repo")
REPO_URL = "git@github.com:motte025/City-cafe.git"
REPO_AB = "08:30"          # einmal am Tag, ab dieser Uhrzeit (nach dem naechtlichen Update)
REPO_STAND = {"tag": "", "zeit": time.time() + 120, "thread": None}   # nach dem Start erst Netz abwarten


def git(*args, pruefen=True, ordner=REPO_ORDNER):
    env = {**os.environ, "GIT_SSH_COMMAND": f"ssh -i {REPO_KEY} -o IdentitiesOnly=yes "
                                             "-o StrictHostKeyChecking=accept-new -o BatchMode=yes",
           "GIT_AUTHOR_NAME": "City-Cafe W1", "GIT_AUTHOR_EMAIL": "w1@city-cafe.invalid",
           "GIT_COMMITTER_NAME": "City-Cafe W1", "GIT_COMMITTER_EMAIL": "w1@city-cafe.invalid"}
    r = subprocess.run(["git", "-C", ordner, *args] if os.path.isdir(ordner) and args[0] != "clone"
                       else ["git", *args], env=env, capture_output=True, text=True, timeout=600)
    if pruefen and r.returncode != 0:
        raise RuntimeError(f"git {args[0]}: {(r.stderr or r.stdout).strip()[-300:]}")
    return r


def daten_ins_repo():
    """Neue Takt-Dateien und Messwerte des W1 ins Repo; fehlende Takt-Dateien aus dem Repo holen.
    Push abgelehnt (jemand war schneller): alles noch einmal auf dem neuen Stand von main."""
    if not os.path.exists(REPO_KEY):
        return
    try:
        if not os.path.isdir(os.path.join(REPO_ORDNER, ".git")):
            git("clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO_URL, REPO_ORDNER)
            git("sparse-checkout", "set", "dj-studio/takt", "dj-studio/messwerte")
        for versuch in range(3):
            if repo_runde(versuch):
                break
        else:
            raise RuntimeError("push dreimal abgelehnt")
    except (OSError, RuntimeError, subprocess.SubprocessError) as e:
        log(f"Repo-Daten: nicht hochgeladen ({e})")
        return
    REPO_STAND["tag"] = time.strftime("%Y-%m-%d")             # geschafft (oder nichts Neues): heute fertig


def repo_runde(versuch):
    """Eine Runde: main holen, abgleichen, committen, pushen. -> True, wenn nichts mehr zu tun ist."""
    if True:   # (Einrueckung wie vorher in daten_ins_repo)
        git("sparse-checkout", "set", "dj-studio/takt", "dj-studio/messwerte", "berichte")
        git("fetch", "--depth", "1", "origin", "main")
        git("reset", "-q", "--hard", "FETCH_HEAD")
        ziel_takt = os.path.join(REPO_ORDNER, "dj-studio", "takt")
        ziel_mess = os.path.join(REPO_ORDNER, "dj-studio", "messwerte")
        os.makedirs(ziel_takt, exist_ok=True)
        os.makedirs(ziel_mess, exist_ok=True)
        os.makedirs(TAKT_ORDNER, exist_ok=True)
        geholt = 0
        for pfad in glob.glob(os.path.join(ziel_takt, "*.json")):     # Repo -> W1 (nur fehlende)
            hier = os.path.join(TAKT_ORDNER, os.path.basename(pfad))
            if not os.path.exists(hier):
                with open(pfad, "rb") as a, open(hier, "wb") as b:
                    b.write(a.read())
                geholt += 1
        n_takt = n_mess = 0
        for quelle, ziel in ((TAKT_ORDNER, ziel_takt), (STILLE_ORDNER, ziel_mess)):
            for pfad in glob.glob(os.path.join(quelle, "*.json")):     # W1 -> Repo (neu oder geaendert)
                with open(pfad, "rb") as f:
                    daten = f.read()
                dort = os.path.join(ziel, os.path.basename(pfad))
                try:
                    with open(dort, "rb") as f:
                        if f.read() == daten:
                            continue
                except OSError:
                    pass
                with open(dort, "wb") as f:
                    f.write(daten)
                if ziel == ziel_takt:
                    n_takt += 1
                else:
                    n_mess += 1
        # Tagesberichte (Ueberwachung): jeder abgeschlossene Betriebstag als berichte/W1-<tag>.md
        n_bericht = 0
        ziel_bericht = os.path.join(REPO_ORDNER, "berichte")
        os.makedirs(ziel_bericht, exist_ok=True)
        for pfad in glob.glob(os.path.join(TAGE_ORDNER, "*.json")):
            tag = os.path.basename(pfad)[:-5]
            if tag >= betriebstag():
                continue                                   # laufender Tag: erst morgen
            try:
                with open(pfad) as f:
                    text = bericht_text(json.load(f))
            except (OSError, ValueError, KeyError):
                continue
            dort = os.path.join(ziel_bericht, f"W1-{tag}.md")
            try:
                with open(dort, encoding="utf-8") as f:
                    if f.read() == text:
                        continue
            except OSError:
                pass
            with open(dort, "w", encoding="utf-8") as f:
                f.write(text)
            n_bericht += 1
        if geholt and versuch == 0:
            log(f"Repo-Daten: {geholt} Takt-Dateien aus dem Repo geholt")
        if not (n_takt or n_mess or n_bericht):
            return True
        git("add", "-A", "dj-studio/takt", "dj-studio/messwerte", "berichte")
        git("commit", "-q", "-m", f"Auto: W1-Messdaten ({n_takt} Takt, {n_mess} Messwerte, {n_bericht} Bericht)")
        if git("push", "-q", "origin", "HEAD:main", pruefen=False).returncode != 0:
            return False
        log(f"Repo-Daten: {n_takt} Takt-Dateien, {n_mess} Messwerte, {n_bericht} Tagesbericht hochgeladen")
        return True


# Notfall-Kopie der TV-Seite (22.10.2026, Betreiber): ganzes Repo als Kopie auf dem W1, hier auf
# 127.0.0.1:8090 ausgeliefert. Der Chromium-Starter nimmt sie, wenn GitHub Pages beim Start nicht
# erreichbar ist; kommt das Netz wieder, schaltet seite_zurueck() ohne Musik auf GitHub Pages.
# Aufgefrischt beim Start und einmal am Tag mit den Messdaten (oeffentliches Repo, ohne Key).
SEITE_ORDNER = os.path.expanduser("~/.cache/citycafe/seite")
SEITE_URL = "https://github.com/motte025/City-cafe.git"
SEITE_PORT = 8090
SEITE_LOKAL = f"http://127.0.0.1:{SEITE_PORT}/"
SEITE_PAGES = "https://motte025.github.io/City-cafe/"


def seite_aktualisieren():
    try:
        if not os.path.isdir(os.path.join(SEITE_ORDNER, ".git")):
            git("clone", "-q", "--depth", "1", SEITE_URL, SEITE_ORDNER)
            log(f"Notfall-Kopie angelegt ({SEITE_ORDNER})")
            return True
        git("fetch", "-q", "--depth", "1", "origin", "main", ordner=SEITE_ORDNER)
        git("reset", "-q", "--hard", "FETCH_HEAD", ordner=SEITE_ORDNER)
        return True
    except (OSError, RuntimeError, subprocess.SubprocessError) as e:
        log(f"Notfall-Kopie nicht aufgefrischt ({e})")
        return False


def seite_server():
    """Notfall-Kopie auf 127.0.0.1 ausliefern (eigener Thread, laeuft immer)."""
    import functools
    import http.server

    class Leise(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

    os.makedirs(SEITE_ORDNER, exist_ok=True)
    try:
        server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", SEITE_PORT), functools.partial(Leise, directory=SEITE_ORDNER))
    except OSError as e:
        log(f"Notfall-Kopie: Port {SEITE_PORT} nicht frei ({e})")
        return
    server.daemon_threads = True
    server.serve_forever()


def pages_erreichbar():
    try:
        with urllib.request.urlopen(urllib.request.Request(SEITE_PAGES, method="HEAD"), timeout=5) as r:
            return r.status == 200
    except (OSError, ValueError):
        return False


def seite_zurueck(page_id):
    """Laeuft die Notfall-Kopie und ist GitHub Pages wieder da: auf die normale Seite wechseln."""
    try:
        with urllib.request.urlopen(f"http://{CDP_HOST}:{CDP_PORT}/json", timeout=5) as r:
            url = next((t.get("url", "") for t in json.load(r) if t.get("id") == page_id), "")
    except (OSError, ValueError):
        return
    if not url.startswith(SEITE_LOKAL):
        return
    if not pages_erreichbar():
        if time.time() - UEBERW.get("notfall", 0) > 3600:      # Ueberwachung: hoechstens 1x je Stunde
            UEBERW["notfall"] = time.time()
            log("Notfall-Kopie laeuft (GitHub Pages nicht erreichbar)")
        return
    abfrage = re.sub(r"([?&])_t=\d+", r"\1", url.split("?", 1)[1] if "?" in url else "").strip("&")
    neu = SEITE_PAGES + "?" + abfrage + ("&" if abfrage else "") + f"_t={int(time.time())}"
    log("Notfall-Kopie: GitHub Pages wieder erreichbar - zurueck auf die normale Seite")
    cdp_eval(page_id, f"location.href = {json.dumps(neu)}; 1")


def takt_rechnen(vid, audio_url):
    """Takt-Datei fuer den Song rechnen, falls beat_this da ist und sie fehlt (im Spur-Faden)."""
    if not (takt_an() and audio_url) or os.path.exists(takt_datei(vid)) \
            or time.time() - TAKT_FEHL.get(vid, 0) < 6 * 3600:
        return
    try:
        os.makedirs(TAKT_ORDNER, exist_ok=True)
        skript = os.path.join(TAKT_ORDNER, ".takt-rechner.py")
        if not os.path.exists(skript) or open(skript).read() != TAKT_RECHNER:
            with open(skript, "w") as f:
                f.write(TAKT_RECHNER)
        t0 = time.time()
        r = subprocess.run(["nice", "-n", "19", TAKT_PYTHON, skript, vid, audio_url, takt_datei(vid)],
                           capture_output=True, text=True, timeout=600)
        if r.returncode or not os.path.exists(takt_datei(vid)):
            TAKT_FEHL[vid] = time.time()
            log(f"Takt {vid}: nicht gerechnet (Code {r.returncode}) {r.stderr.strip().splitlines()[-1:] }")
            return
        d = json.load(open(takt_datei(vid)))
        log(f"Takt {vid}: {len(d['b'])} Schlaege, {len(d['e'])} Einsen ({time.time() - t0:.0f}s)")
    except (OSError, ValueError, subprocess.TimeoutExpired) as e:
        TAKT_FEHL[vid] = time.time()
        log(f"Takt {vid}: {type(e).__name__}")


def spur_messen(vid, audio_url, laenge):
    """Ganzen Song messen -> SPUREN[vid] (und auf die Platte). Laeuft im eigenen Faden.
    Danach (oder wenn schon gemessen) die Takt-Datei, falls beat_this eingerichtet ist."""
    if SPUREN.get(vid) or spur_von_platte(vid):
        takt_rechnen(vid, audio_url)
        return
    if vid in SPUREN or not audio_url:
        return
    SPUREN[vid] = None                      # in Arbeit
    try:
        # -readrate: hoechstens 8-fache Abspielgeschwindigkeit. Voll aufgedreht zog ffmpeg
        # einen Song in ~3 s - die WLAN-Spitzen stoerten den Bluetooth-Ton (gleicher Funkchip).
        # ein Lauf, zwei Zweige: Studio-Spur (Ausgabe auf stdout) und Tonart (in eine Datei)
        fd, ton_datei = tempfile.mkstemp(prefix="ton-", suffix=".txt")
        os.close(fd)
        aus = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-readrate", str(SPUR_LESETEMPO),
                              "-i", audio_url, "-vn", "-filter_complex",
                              "[0:a]asplit=2[sa][sb];[sa]" + SPUR_FILTER + "[o1];[sb]" + ton_filter(ton_datei) + "[o2]",
                              "-map", "[o1]", "-f", "null", "-", "-map", "[o2]", "-f", "null", "-"],
                             capture_output=True, text=True, timeout=180)
        try:
            with open(ton_datei) as f:
                ton = ton_bestimmen(f.read())
        except OSError:
            ton = None
        finally:
            try:
                os.remove(ton_datei)
            except OSError:
                pass
    except (OSError, subprocess.TimeoutExpired) as e:
        log(f"Studio-Spur {vid}: {type(e).__name__}")
        SPUREN.pop(vid, None)
        return
    rahmen, akt = [], None
    for zeile in aus.stdout.splitlines():
        if zeile.startswith("frame:"):
            akt = [-90.0] * 10
            rahmen.append(akt)
        elif akt is not None and zeile.startswith("lavfi.astats."):
            k, _, w = zeile.partition("=")
            teile = k.split(".")
            try:
                v = float(w)
            except ValueError:
                v = -90.0
            if v != v or v < -90:
                v = -90.0
            akt[(int(teile[2]) - 1) * 2 + (0 if teile[3] == "Peak_level" else 1)] = v
    if len(rahmen) < SPUR_HZ * 5:
        log(f"Studio-Spur {vid}: zu wenig Ton ({len(rahmen)} Rahmen)")
        SPUREN.pop(vid, None)
        return
    # Spalten: 0/1 links Spitze/RMS, 2/3 rechts, 5 tief RMS, 7 mitte RMS, 9 hoch RMS
    lin = [[10 ** (r[i] / 20) for r in rahmen] for i in range(10)]
    voll = [(a + b) / 2 for a, b in zip(lin[1], lin[3])]
    halb = lambda r: [(a + b) / 2 for a, b in zip(r[0::2], r[1::2])]      # 200 -> 100 Hz
    bpm, versatz, sicher = spur_bpm(halb(lin[5]), halb(voll), SPUR_HZ / 2)

    def b64(werte, f):
        return base64.b64encode(bytes(max(0, min(255, round(f(x)))) for x in werte)).decode()
    db_byte = lambda db: (db + 60) * 255 / 60            # -60..0 dBFS -> 0..255
    text = json.dumps({
        "version": SPUR_VERSION, "videoId": vid, "proSek": SPUR_HZ, "dauer": round(len(rahmen) / SPUR_HZ, 2),
        "bpm": bpm, "versatz": versatz, "sicher": round(sicher, 2),
        "camelot": ton[0] if ton else None, "tonart": ton[1] if ton else None, "tonGuete": ton[2] if ton else None,
        # Wellenform linear 0..1 (wie dj-studio/js/analysis.js), Pegel in dBFS
        "spitze": b64([max(a, b) for a, b in zip(lin[0], lin[2])], lambda x: x * 255),
        "tief": b64(lin[5], lambda x: x * 255), "mitte": b64(lin[7], lambda x: x * 255),
        "hoch": b64(lin[9], lambda x: x * 255),
        "pegelSpitzeL": b64([r[0] for r in rahmen], db_byte), "pegelRmsL": b64([r[1] for r in rahmen], db_byte),
        "pegelSpitzeR": b64([r[2] for r in rahmen], db_byte), "pegelRmsR": b64([r[3] for r in rahmen], db_byte)})
    SPUREN[vid] = text
    spur_speichern(vid, text)
    log(f"Studio-Spur {vid}: {len(rahmen) / SPUR_HZ:.0f}s, {bpm} BPM (Sicherheit {sicher:.2f}), "
        f"Tonart {ton[1] + ' ' + ton[0] + ' (' + str(ton[2]) + ')' if ton else '-'}")
    takt_rechnen(vid, audio_url)


def seiten_blur_graph(vid):
    """lavfi-Graph fuer den unscharfen Seitenhintergrund, None bei Breitbild."""
    b, h = FORMATE.get(vid, (0, 0))
    if KANTEN.get(vid):
        return SEITEN_BLUR.replace("{crop}", KANTEN[vid])
    if b and h and b / h < 1.7:
        return SEITEN_BLUR.replace("{crop}", "")
    return None


def seiten_blur_args(vid):
    """mpv-Argumente fuer den unscharfen Seitenhintergrund, [] bei Breitbild."""
    g = seiten_blur_graph(vid)
    return ["--hwdec=vaapi-copy", "--vf=" + g] if g else []


# Kontrastrahmen ums Musikvideo (Wunsch 04.10.2026): aussen ein schmaler
# schwarzer Streifen, der weich nach innen auslaeuft. mpv zeichnet ihn selbst
# (overlay-add, wie frueher den QR) - auf das Video darf kein HTML. Je Groesse
# einmal gebaut (Pillow), kostet beim Abspielen praktisch nichts.
RAHMEN_ID = 8
RAHMEN_STREIFEN = 2        # px voll schwarz
RAHMEN_VERLAUF = 30        # px weicher Uebergang nach innen
RAHMEN_ALPHA = 0.7


def rahmen_datei(w, h):
    datei = f"/tmp/ytm-rahmen-{w}x{h}-{RAHMEN_STREIFEN}-{RAHMEN_VERLAUF}-{RAHMEN_ALPHA}.bgra"
    if os.path.exists(datei):
        return datei
    from PIL import Image, ImageDraw
    maske = Image.new("L", (w, h), 0)
    zeichne = ImageDraw.Draw(maske)
    gesamt = RAHMEN_STREIFEN + RAHMEN_VERLAUF
    for i in range(gesamt - 1, -1, -1):          # von innen nach aussen, aussen deckt zuletzt
        if i < RAHMEN_STREIFEN:
            a = 1.0
        else:
            a = (1 - (i - RAHMEN_STREIFEN) / RAHMEN_VERLAUF) ** 2.2
        zeichne.rectangle([i, i, w - 1 - i, h - 1 - i], outline=int(255 * RAHMEN_ALPHA * a))
    bild = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bild.putalpha(maske)                          # schwarz: vormultipliziert = (0,0,0,a)
    with open(datei, "wb") as f:
        f.write(bild.tobytes("raw", "BGRA"))
    return datei


def rahmen_setzen(ziel, sock=None):
    """Rahmen fuer die Fenstergroesse ziel in den mpv (sock) legen."""
    try:
        skala = ausgabe_skala()                   # Overlay in echten Bildpunkten
        w, h = round(ziel["w"] * skala), round(ziel["h"] * skala)
        mpv_befehl("overlay-add", RAHMEN_ID, 0, 0, rahmen_datei(w, h), 0, "bgra", w, h, w * 4, sock=sock)
        return (w, h)
    except Exception as e:                        # ohne Pillow o. ae.: einfach kein Rahmen
        log(f"Rahmen: {type(e).__name__}: {e}")
        return None


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
    xf = None             # laufende Ueberblendung (siehe ueberblenden)
    stille_beendet = None # Song, der an seiner Schlussstille schon beendet wurde
    intro_gesprungen = None  # Song, bei dem das Intro schon uebersprungen ist
    gain_gesetzt = None      # (Song, dB): Anhebung leiser Songs ist eingestellt
    blur_an = None           # Song, bei dem der unscharfe Seitenhintergrund laeuft
    rahmen_lage = None       # (pid, w, h), fuer die der Kontrastrahmen gesetzt ist
    MPV_APP["id"] = "mpv"
    # Der hereinkommende Player startet unsichtbar (Titel "xf-ein"); die app_id
    # "mpvxf" schwebt wie "mpv" (die Regel fuer "mpv" steht in der sway-Config).
    sway('for_window [title="^xf-ein$"] opacity 0')
    sway('for_window [app_id="mpvxf"] floating enable, border none, sticky enable')
    # Videoflaeche bei aktiver Ansicht (einmal live gemessen); wird bei jeder
    # erfolgreichen Messung aktualisiert. Nightlife und DJ liegen gleich.
    target = {"x": 83, "y": 248, "w": 1200, "h": 675}
    next_place_check = 0
    window_seen = False
    resolver = None       # laufender yt-dlp-Thread fuer das aktuelle Video
    # Neben-Arbeiter: Suche, Vorladen, Mix und Playlist teilen sich EINEN Thread,
    # also hoechstens ein yt-dlp-Prozess zusaetzlich zum resolver (OOM vom
    # 21.09.2026). Reihenfolge, wenn mehreres ansteht: Suche (jemand wartet am
    # Handy), Vorladen (Song endet bald), Mix, Playlist.
    neben = None
    analyse_arbeiter = None   # misst Intro/Ausklang/Anhebung der naechsten Songs im Voraus
    spur_arbeiter = None      # DJ-Modus: misst Wellenform/BPM/Pegel fuer das Studio
    vormessen = {"liste": [], "zeit": 0.0, "naechste": 0.0, "fehler_folge": 0, "erledigt": 0,
                 "fehl": {}}      # eigene Fehlerliste - "failed" gehoert der Wiedergabe
    blend_erledigt = None     # id des zuletzt ausgefuehrten "Jetzt ueberblenden"
    laden_seit = None         # seit wann die Seite in readyState "loading" haengt
    laden_pruef = 0.0
    such_id = ""          # zuletzt bearbeiteter Suchauftrag
    mix_id = ""           # zuletzt bearbeiteter Mix-Auftrag
    playlist_id = ""      # zuletzt bearbeiteter Playlist-Auftrag
    bt_arbeiter = None    # laufender Bluetooth-Thread (connect dauert Sekunden)
    bt_id = None          # zuletzt bearbeiteter Bluetooth-Auftrag (None: noch keiner gesehen)
    spul_id = ""          # zuletzt ausgefuehrter Vor-/Zuruecksprung
    pause_id = ""         # zuletzt ausgefuehrter Pause-Wunsch
    finde_id = ""         # zuletzt bearbeiteter Finde-Auftrag
    pausiert = False
    mpv_dauer = {}        # "yt:<id>" -> Laenge laut mpv (einmal je Song abgefragt)
    mpv_bild = {}         # {key, aufl, fps} - laufende Aufloesung (einmal je Song)
    eilig_bis = 0.0       # bis wann nach einem Flaechenwechsel haeufig nachplatziert wird
    flaeche_jetzt = None  # "yt" / "yt_voll" / "twitch" / "cam" - wo mpv gerade liegt
    threading.Thread(target=ambi_schleife, daemon=True).start()
    threading.Thread(target=umschalt_waechter, daemon=True).start()
    threading.Thread(target=bt_waechter, args=(lambda: bt_seite["id"],), daemon=True).start()
    qr_karte = None       # PIL-Bild des QR-Kaertchens
    qr_karte_id = ""
    qr_lage = None        # (x, y, w, h, flaeche), fuer die das Overlay gesetzt ist
    ton_id = ""           # zuletzt uebernommene Ton-Einstellung
    ton_vol = 100         # Lautstaerke des Videos in Prozent
    ton_lautheit = False  # Lautheitsausgleich an?
    ton_limiter = True    # Limiter fuer sehr leise Songs (Handy)
    streamlink_da = os.path.exists(STREAMLINK)
    letzte_antwort = time.time()   # wann der Browser zuletzt geantwortet hat
    letzter_neustart = 0.0
    naechste_tmp_pruefung = 0.0
    fortsetzen = {}       # nach einem Haenger: {"key", "pos"} fuer den Neustart, "versucht": {key: Zeit}
    threading.Thread(target=seite_server, daemon=True).start()        # Notfall-Kopie ausliefern
    threading.Thread(target=lambda: (time.sleep(120), seite_aktualisieren()), daemon=True).start()   # Netz abwarten
    seite_pruefung = 0.0  # wann zuletzt nachgesehen wurde, ob die Notfall-Kopie laeuft
    ueberw_zeit = {"tv": 0.0, "system": 0.0}
    stocken = {}          # Musik: {"t", "pos"} - Messfenster, ob in 8 s genug gespielt wurde
    ton_vorab = {"naechste": 0.0}

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
            bt_seite["id"] = page_id
            # Seite halb geladen haengen geblieben (05.10.2026 nach dem Neustart des
            # Updates um 8:30: Netz noch nicht stabil, nur 217 von 842 KB, Chromium wartet
            # ewig auf den Rest). Laenger als 60 s "loading" -> neu laden.
            if page_id and time.time() - laden_pruef >= 10:
                laden_pruef = time.time()
                zustand = cdp_eval(page_id, "document.readyState")
                if zustand == "loading":
                    laden_seit = laden_seit or time.time()
                    if time.time() - laden_seit > 60:
                        log("Seite haengt beim Laden (> 60 s) - neu laden")
                        cdp_eval(page_id, "location.reload(), 1")
                        laden_seit = time.time()
                else:
                    laden_seit = None
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
            ton_limiter = ton.get("limiter") is not False
            log(f"Ton: {ton_vol} %, Lautheitsausgleich {'an' if ton_lautheit else 'aus'}, "
                f"Limiter {'an' if ton_limiter else 'aus'}, Blende {XF_SEK} s (fest)")

        # Vor-/Zuruecksprung vom Handy im laufenden Video.
        sprung = state.get("spulen") or {}
        if sprung.get("id") and sprung["id"] != spul_id:
            spul_id = sprung["id"]
            sek = int(sprung.get("sek") or 0)
            if sek and mpv is not None:
                if mpv_befehl("seek", sek, "relative"):
                    log(f"Gespult: {sek:+d}s")
                    # Nach dem Sprung puffert mpv neu und meldet kurz keine Position.
                    # Frist fuer "erstes Bild" neu beginnen - vorher hielt der Waechter
                    # das fuer einen Ausfall, beendete mpv und das Video begann im
                    # Browser wieder vorn.
                    last_pos, last_progress = None, time.time()
                    started = time.time()

        # Pause/Weiter im Musikbetrieb (Chef am Handy, Taste an der Fernbedienung).
        p_wunsch = state.get("pause") or {}
        if p_wunsch.get("id") and p_wunsch["id"] != pause_id:
            pause_id = p_wunsch["id"]
            pausiert = bool(p_wunsch.get("pause"))
            if mpv is not None:
                mpv_befehl("set_property", "pause", pausiert)
                # Pause ist kein Stillstand: der Waechter soll nicht eingreifen.
                last_progress = time.time()
            if xf is not None and pausiert and not xf.get("laeuft"):
                # Pause, waehrend der neue Song noch angehalten wartet: Blende verwerfen -
                # das Dashboard ist noch beim alten Song; nach "Weiter" wird neu vorbereitet.
                xf["abbruch"] = True
                stop(xf["proc"])
                mpv_befehl("set_property", "keep-open", "no")
                log(f"Ueberblendung verworfen (Pause vor dem Start): {xf['vid']}")
                xf = None
            elif xf is not None and pausiert:
                # Pause mitten in der Ueberblendung: Uebergabe sofort abschliessen,
                # der neue Song (laut Dashboard schon "jetzt") wird angehalten.
                mpv_befehl("set_property", "pause", True, sock=MPV_SOCK_XF)
                xf["abbruch"] = True        # Faden hoert auf, Lautstaerken zu aendern
                xf["fertig"] = True
            log("Pause" if pausiert else "Weiter")

        # Bluetooth-Auftrag der Handy-Fernbedienung, ebenfalls im eigenen Thread.
        bt_auftrag = state.get("bt") or {}
        if bt_id is None:
            # Erster Blick nach dem Start: ein Auftrag, der schon auf der Seite
            # liegt, ist alt - nicht wiederholen (sonst trennte ein Neustart des
            # Supervisors nach einem "Trennen" gleich noch einmal).
            bt_id = bt_auftrag.get("id") or ""
        elif (bt_auftrag.get("id") and bt_auftrag["id"] != bt_id
                and not (bt_arbeiter is not None and bt_arbeiter.is_alive())):
            bt_id = bt_auftrag["id"]

            def bt_lauf(bid=bt_id, was=str(bt_auftrag.get("was", "status")), seite=page_id):
                ergebnis = {"id": bid, **bluetooth(was)}
                try:
                    cdp_eval(seite, "window.nlBtStatus = " + json.dumps(ergebnis) + "; 1")
                except (OSError, ValueError, ConnectionError) as e:
                    log(f"Bluetooth-Ergebnis nicht zustellbar: {e}")
            bt_arbeiter = threading.Thread(target=bt_lauf, daemon=True)
            bt_arbeiter.start()

        # Wunsch-Aufloesung/-Bildrate vom Handy, im Musikbetrieb eigene
        # Qualitaetswahl (musik_format) und eigener Cache-Schluessel.
        musik = bool(state.get("musik"))
        wunsch = state.get("wunsch") or {}
        w_hoehe = int(wunsch.get("hoehe") or 0)
        w_fps = int(wunsch.get("fps") or 0)

        def schluessel_fuer(vid, hoehe, fps, ist_musik):
            return f"{vid}|{hoehe}|{fps}" + ("|m" if ist_musik else "")

        def in_cache(key, urls):
            cache[key] = urls
            if key.endswith("|m"):                  # Musik: Intro/Ausklang und Seitenbalken messen
                ton_laden(key.split("|", 1)[0], urls[1])     # und den Ton auf die Platte (Stocken)
                threading.Thread(target=stille_messen, daemon=True,
                                 args=(key.split("|", 1)[0], urls[1] or urls[0], urls[2])).start()
                threading.Thread(target=balken_messen, daemon=True,
                                 args=(key.split("|", 1)[0], urls[0], urls[2])).start()
            for old in list(cache)[:-4]:   # nur die letzten paar behalten
                cache.pop(old, None)

        def zustellen(seite, ausdruck, was):
            try:
                cdp_eval(seite, ausdruck)
            except (OSError, ValueError, ConnectionError) as e:
                log(f"{was} nicht zustellbar: {e}")

        # Vorab-Messung (Wunsch 04.10.2026): die naechsten Songs der Warteschlange
        # schon lange vor dem Vorladen messen (Songbeginn, Ende, Anhebung, ~15 s je
        # Song), eigener Arbeiter, damit die Suche nicht wartet. Wird der naechste
        # Titel kurz vor Schluss umgestellt, liegen die Werte so meist schon vor.
        if musik and not (analyse_arbeiter is not None and analyse_arbeiter.is_alive()):
            offen = [str(v) for v in (state.get("analyse") or [])[:3]
                     if re.fullmatch(r"[A-Za-z0-9_-]{11}", str(v)) and str(v) not in STILLE
                     and time.time() - failed.get(str(v), 0) >= RETRY_FAILED_AFTER]
            if offen:
                def analyse_lauf(vid=offen[0]):
                    urls = resolve(vid, "bestaudio", "abr")
                    if urls:
                        ton_laden(vid, urls[0])        # Ton schon Minuten vorher auf die Platte
                        stille_messen(vid, urls[0], urls[2])
                    else:
                        failed[vid] = time.time()
                analyse_arbeiter = threading.Thread(target=analyse_lauf, daemon=True)
                analyse_arbeiter.start()

        # Ton von der Platte: die naechsten zwei Songs der Schlange schon jetzt laden (auch wenn sie
        # schon gemessen sind - dann laeuft analyse_lauf nicht). Ein Song zur Zeit.
        if musik and not TON_LAEDT and time.time() >= ton_vorab["naechste"]:
            for t_vid in [str(v) for v in (state.get("analyse") or [])[:2]]:
                if re.fullmatch(r"[A-Za-z0-9_-]{11}", t_vid) and not ton_datei(t_vid) \
                        and time.time() - failed.get(t_vid, 0) >= RETRY_FAILED_AFTER:
                    ton_vorab["naechste"] = time.time() + 20
                    TON_LAEDT.add(t_vid)          # Platz halten, bis resolve fertig ist

                    def ton_vorab_lauf(vid=t_vid):
                        urls = resolve(vid, "bestaudio", "abr")
                        TON_LAEDT.discard(vid)
                        if urls:
                            ton_laden(vid, urls[0])
                    threading.Thread(target=ton_vorab_lauf, daemon=True).start()
                    break

        # DJ-Modus: laufenden und vorgeladenen Song fuer das Studio messen und zustellen.
        if musik and state.get("flaeche") == "yt-dj-video":
            if not (spur_arbeiter is not None and spur_arbeiter.is_alive()):
                # Reihenfolge: der laufende Song zuerst (sonst bleiben Welle und Meter still),
                # dann der vorgeladene, dann die naechsten der Warteschlange
                laufend = shown[3:].split("|", 1)[0] if shown and shown.startswith("yt:") else ""
                reihe = sorted(cache.items(), key=lambda kv: kv[0].split("|", 1)[0] != laufend)
                for key, urls in reihe:
                    s_vid = key.split("|", 1)[0]
                    if key.endswith("|m") and urls and s_vid not in SPUREN:
                        spur_arbeiter = threading.Thread(target=spur_messen, daemon=True,
                                                         args=(s_vid, urls[1] or urls[0], urls[2]))
                        spur_arbeiter.start()
                        break
                else:
                    # sonst schon die naechsten Songs der Warteschlange (Kanal 2 frueh fuellen)
                    for s_vid in ([laufend] + [str(v) for v in (state.get("analyse") or [])[:2]]
                                  + [str(v) for v in (state.get("djSchlange") or [])[:12]]):   # auch die Karten
                        if re.fullmatch(r"[A-Za-z0-9_-]{11}", s_vid) and s_vid not in SPUREN \
                                and time.time() - failed.get(s_vid, 0) >= RETRY_FAILED_AFTER:
                            def spur_vorab(vid=s_vid):
                                if spur_von_platte(vid):        # schon gemessen: kein yt-dlp noetig
                                    if not (takt_an() and not os.path.exists(takt_datei(vid))):
                                        return                  # ... ausser die Takt-Datei fehlt
                                urls = resolve(vid, "bestaudio", "abr")
                                if urls:
                                    spur_messen(vid, urls[0], urls[2])
                            spur_arbeiter = threading.Thread(target=spur_vorab, daemon=True)
                            spur_arbeiter.start()
                            break
            fertig = [v for v, s in list(SPUREN.items()) if s]
            if fertig and page_id:
                # Nachsehen, was die Seite schon hat - in der aktuellen Fassung (nach einem Neuladen
                # ist alles weg; nach einer neuen SPUR_VERSION liegen dort noch alte Messungen)
                try:
                    da = set(json.loads(cdp_eval(page_id, "JSON.stringify(Object.entries(window.nlStudioSpuren || {})"
                                                 f".filter(([k, v]) => v && v.version === {SPUR_VERSION}).map(([k]) => k))") or "[]"))
                except (OSError, ValueError, ConnectionError):
                    da = set(fertig)
                for s_vid in fertig:
                    if s_vid not in da and SPUREN.get(s_vid):
                        zustellen(page_id, "(window.nlStudioSpuren = window.nlStudioSpuren || {})"
                                  f"[{json.dumps(s_vid)}] = {SPUREN[s_vid]}; 1", "Studio-Spur")
                # Takt-Dateien (beat_this) dazu, sobald es sie gibt
                try:
                    t_da = set(json.loads(cdp_eval(page_id, "JSON.stringify(Object.keys(window.nlStudioTakte || {}))") or "[]"))
                except (OSError, ValueError, ConnectionError):
                    t_da = set(fertig)
                for s_vid in fertig:
                    if s_vid not in t_da and os.path.exists(takt_datei(s_vid)):
                        try:
                            with open(takt_datei(s_vid)) as f:
                                t_text = f.read()
                            json.loads(t_text)
                        except (OSError, ValueError):
                            continue
                        zustellen(page_id, "(window.nlStudioTakte = window.nlStudioTakte || {})"
                                  f"[{json.dumps(s_vid)}] = {t_text}; 1", "Takt")
            # Nur die letzten behalten - aber mehr, als oben vorab geholt werden (laufend + 2 +
            # 12 Karten): mit 6 lud er am 21.10.2026 jeden Abend 2x je Sekunde dieselben
            # ~15 Spuren von der Platte und schrieb 7000 Logzeilen pro Stunde.
            for alt in list(SPUREN)[:-24]:
                SPUREN.pop(alt, None)

        # Ueberwachung: Fehler der TV-Seite alle 30 s abholen, System jede Minute pruefen.
        if time.time() - ueberw_zeit["tv"] >= 30:
            ueberw_zeit["tv"] = time.time()
            if page_id:
                tv_fehler_holen(page_id)
        if time.time() - ueberw_zeit["system"] >= 60:
            ueberw_zeit["system"] = time.time()
            system_pruefen()

        # Notfall-Kopie aktiv? Alle 2 min, ohne Musik: ist GitHub Pages wieder da, dorthin wechseln.
        if page_id and not musik and time.time() - seite_pruefung >= 120:
            seite_pruefung = time.time()
            threading.Thread(target=seite_zurueck, args=(page_id,), daemon=True).start()

        # Messdaten ins Repo: einmal am Tag, morgens nach dem Update (ab 8:30, Betreiber 22.10.2026),
        # eigener Thread (git braucht Sekunden). Fehlschlag (Netz noch nicht da): in 15 min wieder.
        heute = time.strftime("%Y-%m-%d")
        if (os.path.exists(REPO_KEY) and REPO_STAND["tag"] != heute and time.strftime("%H:%M") >= REPO_AB
                and time.time() >= REPO_STAND["zeit"]
                and not (REPO_STAND["thread"] is not None and REPO_STAND["thread"].is_alive())):
            REPO_STAND["zeit"] = time.time() + 900
            REPO_STAND["thread"] = threading.Thread(target=lambda: (seite_aktualisieren(), daten_ins_repo()),
                                                    daemon=True)
            REPO_STAND["thread"].start()

        # Vormessen der Playlists: nur ohne Musik, ein Song nach dem anderen.
        # Seit 22.10.2026 auch bei Musik (Betreiber), dann langsamer, nie waehrend einer Blende und erst,
        # wenn die naechsten Songs der Schlange gemessen sind (Analyse-Arbeiter frei).
        pause = VORMESS_PAUSE_MUSIK if musik else VORMESS_PAUSE
        if (VORMESSEN and page_id and time.time() >= vormessen["naechste"]
                and not (musik and (xf is not None or (analyse_arbeiter is not None and analyse_arbeiter.is_alive())))
                and not (spur_arbeiter is not None and spur_arbeiter.is_alive())):
            vormessen["naechste"] = time.time() + pause
            # Liste alle 10 min frisch von der Seite - leer (Seite nach dem Start noch nicht so weit): gleich wieder
            if not vormessen["liste"] or time.time() - vormessen["zeit"] > 600:
                try:
                    ids = json.loads(cdp_eval(page_id, VORMESS_EXPR) or "[]")
                    vormessen["liste"] = [str(v) for v in ids if re.fullmatch(r"[A-Za-z0-9_-]{11}", str(v))]
                    vormessen["zeit"] = time.time()
                except (OSError, ValueError, ConnectionError):
                    pass
            # Offen: Spur (Welle/BPM), Takt (beat_this) oder - seit 22.10.2026 - Lautheit/Intro/Ende
            # fehlen. Der W1 kuemmert sich selbst um alle Daten, nichts kommt mehr vom PC zuhause.
            offen = [v for v in vormessen["liste"]
                     if (not os.path.exists(spur_datei(v)) or (takt_an() and not os.path.exists(takt_datei(v))
                                                                and time.time() - TAKT_FEHL.get(v, 0) >= 6 * 3600)
                         or not stille_von_platte(v))
                     and time.time() - vormessen["fehl"].get(v, 0) >= 6 * 3600]
            if offen:
                def vormess_lauf(vid=offen[0], rest=len(offen), gesamt=len(vormessen["liste"])):
                    urls = resolve(vid, "bestaudio", "abr")
                    if not urls:
                        vormessen["fehl"][vid] = time.time()
                        vormessen["fehler_folge"] += 1
                        if vormessen["fehler_folge"] >= 3:
                            vormessen["naechste"] = time.time() + VORMESS_FEHLER_PAUSE
                            vormessen["fehler_folge"] = 0
                            log("Vormessen: 3 Fehler in Folge - 1 h Pause")
                        return
                    vormessen["fehler_folge"] = 0
                    if not os.path.exists(spur_datei(vid)) or (takt_an() and not os.path.exists(takt_datei(vid))):
                        spur_messen(vid, urls[0], urls[2])
                        SPUREN.pop(vid, None)      # nur auf die Platte, nicht im Speicher sammeln
                    if not stille_von_platte(vid):
                        if "gain" not in (STILLE.get(vid) or {}):
                            STILLE.pop(vid, None)  # halbe Messung (Platzhalter) verwerfen
                        stille_messen(vid, urls[0], urls[2])
                        if not stille_von_platte(vid):
                            vormessen["fehl"][vid] = time.time()   # in 6 h noch einmal
                    vormessen["naechste"] = time.time() + pause   # Pause ab Ende der Messung
                    vormessen["erledigt"] += 1
                    if vormessen["erledigt"] % 10 == 1:
                        log(f"Vormessen: {gesamt - rest + 1} von {gesamt} Playlist-Songs gemessen")
                spur_arbeiter = threading.Thread(target=vormess_lauf, daemon=True)
                spur_arbeiter.start()

        # Neben-Arbeiter (siehe oben): immer nur eine Aufgabe zur Zeit.
        if not (neben is not None and neben.is_alive()):
            aufgabe = None
            auftrag = state.get("suche") or {}
            vor = state.get("vorladen") or {}
            vor_vid = str(vor.get("videoId") or "")
            vor_key = schluessel_fuer(vor_vid, int(vor.get("hoehe") or 0),
                                      int(vor.get("fps") or 0), True) if vor_vid else ""
            mix_auftrag = state.get("mix") or {}
            pl_auftrag = state.get("playlist") or {}
            if auftrag.get("id") and auftrag["id"] != such_id:
                such_id = auftrag["id"]

                def aufgabe(sid=such_id, text=str(auftrag.get("text", ""))[:100], seite=page_id,
                            gemischt=bool(auftrag.get("vorschlaege")),
                            aehnlich=str(auftrag.get("aehnlichZu") or "")[:20],
                            nur_playlists=auftrag.get("art") == "playlist",
                            liste_id=(str(auftrag.get("listId") or "")[:64]
                                      if auftrag.get("art") == "playlistInhalt" else ""),
                            shorts=auftrag.get("art") == "shorts",
                            kanal_von=re.sub(r"[^A-Za-z0-9_-]", "", str(auftrag.get("kanalVon") or ""))[:11],
                            kuenstler=str(auftrag.get("kuenstler") or "")[:80],
                            anzahl=max(SUCH_TREFFER, min(SUCH_TREFFER_MAX, int(auftrag.get("anzahl") or 0)))):
                    quelle = ""
                    # Automatische Vorschlaege beim Oeffnen der Fernbedienung:
                    # mehrere Begriffe gemischt statt vieler Treffer zu einem Thema.
                    if shorts:
                        treffer, quelle = shorts_suchen(kanal_von, kuenstler, text)
                    elif liste_id:
                        # Playlist in der Suche oeffnen: ihre Songs (24-h-Cache)
                        treffer = playlist_lesen(f"https://www.youtube.com/playlist?list={liste_id}")[:200]
                    elif nur_playlists:
                        treffer = playlists_suchen(text)
                    elif aehnlich:
                        treffer = aehnliche(aehnlich, text)
                    elif gemischt:
                        treffer = vorschlaege()
                    else:
                        treffer = suchen(text, anzahl)
                        # Live-/Fan-/Lyric-/Audio-Uploads ans Ende, sonst meistgesehene zuerst
                        # (Wunsch 19.10.2026: Suche nach den Aufrufen). Treffer mit allen
                        # Suchwoertern im Titel/Kanal vorn - sonst stand bei "Haus am See"
                        # das meistgesehene "Alles neu" ganz oben.
                        woerter = re.findall(r"\w+", text.lower())
                        treffer = sorted(treffer, key=lambda t: (
                            musikvideo_wertung(t, text) < 0,
                            not all(w in (str(t.get("titel") or "") + " " + str(t.get("kanal") or "")).lower()
                                    for w in woerter),
                            -(t.get("aufrufe") or 0)))
                    if not gemischt and not shorts:
                        log(f"Suche {text!r}: {len(treffer)} Treffer")
                    # art bestaetigt, welche Suche wirklich lief: ein alter Supervisor
                    # im selben Raum kennt Playlists nicht - das Handy verwirft dann
                    # seine Song-Treffer, statt die richtigen zu ueberschreiben.
                    art = ("shorts" if shorts else "playlistInhalt" if liste_id
                           else "playlist" if nur_playlists else "")
                    zustellen(seite, "window.nlSucheTreffer = "
                              + json.dumps({"id": sid, "liste": treffer, "art": art, "quelle": quelle}) + "; 1", "Treffer")
            elif (vor_key and vor_key not in cache
                    and time.time() - failed.get(vor_vid, 0) >= RETRY_FAILED_AFTER):
                def aufgabe(key=vor_key, vid=vor_vid, h=int(vor.get("hoehe") or 0),
                            f=int(vor.get("fps") or 0)):
                    fmt_m, sort_m = musik_format(h, f)
                    urls = resolve(vid, fmt_m, sort_m)
                    if urls:
                        in_cache(key, urls)
                        log(f"Naechster Song vorgeladen: {key}")
                    else:
                        failed[vid] = time.time()
            elif (state.get("finde") or {}).get("id") and state["finde"]["id"] != finde_id:
                finde = state["finde"]
                finde_id = finde["id"]

                def aufgabe(fid=finde_id, text=str(finde.get("text") or "")[:120], seite=page_id,
                            songtitel=str(finde.get("titel") or "")[:120]):
                    # "Kuenstler Titel official video" (Spec 5.3/7.3): unter den ersten
                    # fuenf das beste echte Musikvideo (nicht laenger als 10 Minuten)
                    def auswahl(liste):
                        # Nur Treffer zum selben Song: sonst kam "Alles neu" fuer "Haus am See" (09.10.2026)
                        if songtitel:
                            liste = [t for t in liste if titel_passt(t.get("titel", ""), songtitel)]
                        # Bei gleicher Note gewinnt das meistgesehene (offiziell statt 4K-Fan-Kopie)
                        return sorted([t for t in liste if (t.get("dauerSek") or 0) <= 600] or liste,
                                      key=lambda t: (-musikvideo_wertung(t, text), -(t.get("aufrufe") or 0)))

                    gefunden = auswahl(suchen(text + " official video", 8) if text else [])
                    # Bester Treffer wenig gesehen (Fan-Upload?): auch ohne "official video" suchen
                    if text and (not gefunden or (gefunden[0].get("aufrufe") or 0) < 100000):
                        bekannt = {t["videoId"] for t in gefunden}
                        gefunden = auswahl(gefunden + [t for t in suchen(text, 8) if t["videoId"] not in bekannt])
                    gefunden = gefunden[:1]
                    log(f"Gefunden {text!r}: {gefunden[0]['videoId'] if gefunden else '-'}")
                    zustellen(seite, "window.nlFindeErgebnis = "
                              + json.dumps({"id": fid, "text": text,
                                            "treffer": gefunden[0] if gefunden else None}) + "; 1", "Fund")
            elif mix_auftrag.get("id") and mix_auftrag["id"] != mix_id:
                mix_id = mix_auftrag["id"]

                def aufgabe(mid=mix_id, vid=str(mix_auftrag.get("videoId") or ""), seite=page_id,
                            anzahl=max(5, min(MIX_ANZAHL, int(mix_auftrag.get("anzahl") or MIX_ANZAHL))),
                            titelsuche=str(mix_auftrag.get("titelsuche") or "")[:120]):
                    # Rueckfall 2 der Spec (5.3): Titelsuche wie aehnliche()
                    if titelsuche:
                        liste = [t for t in suchen(titelsuche, anzahl + 2) if t["videoId"] != vid][:anzahl]
                    else:
                        liste = mix(vid, anzahl)
                    log(f"Mix zu {vid}{' (Titelsuche)' if titelsuche else ''}: {len(liste)} Titel")
                    zustellen(seite, "window.nlMixErgebnis = "
                              + json.dumps({"id": mid, "videoId": vid, "liste": liste}) + "; 1", "Mix")
            elif pl_auftrag.get("id") and pl_auftrag["id"] != playlist_id:
                playlist_id = pl_auftrag["id"]

                def aufgabe(pid=playlist_id, quelle=str(pl_auftrag.get("quelle") or ""), seite=page_id):
                    liste = playlist_lesen(quelle)
                    zustellen(seite, "window.nlPlaylistErgebnis = "
                              + json.dumps({"id": pid, "quelle": quelle, "liste": liste}) + "; 1", "Playlist")
            if aufgabe:
                neben = threading.Thread(target=aufgabe, daemon=True)
                neben.start()

        # Vorladen: URL schon aufloesen, solange der Slot noch nicht dran ist.
        # Klappt es nicht, spielt einfach das YouTube-Embed wie bisher weiter.
        # yt-dlp braucht 10-25 s - deshalb im eigenen Thread, sonst stuende die
        # Schleife so lange still und mpv liefe bei Slot-Ende ins naechste
        # Widget hinein (so gesehen: ~25 s).
        # Wunsch-Aufloesung/-Bildrate vom Handy: eigener Cache-Schluessel, sonst
        # laege noch die Adresse der vorigen Qualitaet bereit.
        if musik:
            fmt, sortierung = musik_format(w_hoehe, w_fps)
        else:
            fmt, sortierung = format_waehlen(w_hoehe, w_fps), None
        cache_key = schluessel_fuer(schluessel, w_hoehe, w_fps, musik)

        recently_failed = time.time() - failed.get(schluessel, 0) < RETRY_FAILED_AFTER
        busy = resolver is not None and resolver.is_alive()
        if youtube and cache_key not in cache and not recently_failed and not busy:
            def work(key=cache_key, vid=schluessel, auswahl=fmt, sort=sortierung):
                urls = resolve(vid, auswahl, sort)
                if urls:
                    in_cache(key, urls)
                    log(f"Vorgeladen: {key}")
                else:
                    failed[vid] = time.time()
            resolver = threading.Thread(target=work, daemon=True)
            resolver.start()

        # Ueberblendung abschliessen oder abbrechen
        if (xf is not None and not xf.get("laeuft")
                and str((state.get("vorladen") or {}).get("videoId") or "") not in ("", xf["vid"])):
            # Die Seite hat ihren naechsten Song geaendert (neue Mix-Liste, Wunsch ...), waehrend
            # der vorbereitete noch angehalten wartet: verwerfen, unten neu vorbereiten.
            xf["abbruch"] = True
            stop(xf["proc"])
            log(f"Ueberblendung neu vorbereiten: Seite will jetzt {(state.get('vorladen') or {}).get('videoId')} "
                f"statt {xf['vid']}")
            xf = None
        if xf is not None:
            neu_lebt = xf["proc"].poll() is None
            if xf.get("fehler") or not neu_lebt or (want != shown and want != "yt:" + xf["vid"]):
                grund = (str(xf["fehler"]) if xf.get("fehler")
                         else ("neuer mpv weg" if not neu_lebt else f"Seite will {want}"))
                log(f"Ueberblendung abgebrochen ({xf['vid']}): {grund}")
                # Diagnose Ueberspringen: wer hat auf der Seite zuletzt "weiter" geschaltet?
                try:
                    log("  ytmWeiter zuletzt (vor s, Aufrufer): " + str(cdp_eval(page_id,
                        "JSON.stringify((window.nlWeiterLog || []).slice(-3)"
                        ".map(w => [Math.round((Date.now() - w.t) / 1000), w.s]))")))
                except (OSError, ValueError, ConnectionError):
                    pass
                xf["abbruch"] = True
                stop(xf["proc"])
                if mpv is not None and mpv.poll() is None:
                    mpv_befehl("set_property", "volume", ton_vol)
                    # Alter Song schon am Dateiende (keep-open, siehe Blendenstart): jetzt beenden,
                    # dann fuehrt das saubere Ende wie gewohnt zum naechsten Song.
                    if mpv_eigenschaft("eof-reached") is True:
                        mpv_befehl("quit")
                xf = None
            elif (xf.get("fertig") or mpv is None or mpv.poll() is not None) and want == "yt:" + xf["vid"]:
                stop(mpv)
                try:
                    os.replace(MPV_SOCK_XF, MPV_SOCK)
                except OSError:
                    pass
                MPV_APP["id"] = xf["app"]
                sway(f'[app_id="{xf["app"]}"]', "opacity", "1")
                mpv_befehl("set_property", "volume", ton_vol)
                mpv, shown = xf["proc"], want
                intro_gesprungen = shown        # Start war schon passend gewaehlt
                gain_gesetzt = (shown, xf["ton"])   # stand schon beim Start
                if xf.get("blur"):
                    blur_an = shown
                started, last_pos, last_progress, embed_paused = time.time(), None, None, False
                next_place_check, window_seen = 0, True
                if pausiert:
                    mpv_befehl("set_property", "pause", True)
                mpv_dauer.clear()
                log(f"Ueberblendung fertig: {xf['vid']}")
                xf = None

        if mpv is not None and want != shown and not (xf is not None and want == "yt:" + xf["vid"]):
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
            if mpv.poll() is not None and mpv.returncode == 0 and last_pos is not None and xf is None:
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
                # Musik: Normal oder Vollbild? Wechselt die Flaeche, nur Fenster
                # und QR neu setzen - mpv laeuft weiter (Ton ohne Aussetzer, 6.8).
                rect_art = (MUSIK_FLAECHE.get(state.get("flaeche"), art)
                            if (art == "yt" and musik) else art)
                if rect_art != flaeche_jetzt:
                    if flaeche_jetzt is not None:
                        log(f"Flaeche: {flaeche_jetzt} -> {rect_art}")
                    flaeche_jetzt = rect_art
                    next_place_check = 0
                    eilig_bis = now + 3
                # Lage pruefen: bis das Fenster sitzt jede Runde, danach alle 5 s.
                if now >= next_place_check and now >= umschalt_lage["sperre"]:
                    target = measured_rect(page_id, target, rect_art)
                    if place_mpv(target):
                        if not window_seen:
                            window_seen = True
                            sway(f'[app_id="{MPV_APP["id"]}"]', "opacity", "1")   # sitzt: jetzt zeigen
                            log(f"mpv-Fenster da nach {now - started:.1f}s")
                        # nach einem Flaechenwechsel 3 s lang oft nachpruefen (die Seite
                        # kann noch umbauen), sonst alle 5 s
                        next_place_check = now + (0.3 if now < eilig_bis else 5)
                        # QR-Kaertchen: nur bei Musik, nicht bei Nightlife/DJ/Dartcam.
                        qr_info = state.get("qr") or {}
                        if musik and art == "yt" and qr_info.get("id"):
                            if qr_info["id"] != qr_karte_id:
                                qr_karte = qr_karte_holen(page_id)
                                qr_karte_id = qr_info["id"]
                                qr_lage = None
                            lage = (target["x"], target["y"], target["w"], target["h"], rect_art)
                            if qr_karte is not None and lage != qr_lage:
                                try:
                                    qr_overlay_setzen(qr_karte, qr_info, target, rect_art)
                                    qr_lage = lage
                                except Exception as e:
                                    log(f"QR-Overlay: {type(e).__name__}: {e}")
                                    qr_lage = lage
                        elif qr_lage is not None:
                            mpv_befehl("overlay-remove", QR_OVERLAY_ID)
                            qr_lage = None
                        # Kontrastrahmen nur bei Musik, je Player und Groesse einmal
                        r_key = (mpv.pid, target["w"], target["h"]) if (musik and art == "yt") else None
                        if r_key != rahmen_lage:
                            if r_key:
                                rahmen_setzen(target)
                            elif rahmen_lage:
                                mpv_befehl("overlay-remove", RAHMEN_ID)
                            rahmen_lage = r_key
                # Umschalt-Waechter (Musik): bestaetigen, dass er nachfragen soll
                if musik and art == "yt" and window_seen and xf is None:
                    umschalt_lage.update(ts=now, page=page_id, musik=True)
                # Ambilight (Musik, normal und Vollbild): der Faden ambi_schleife
                # misst viermal pro Sekunde - hier nur bestaetigen, wo.
                if (state.get("ambi") and musik and art == "yt" and rect_art in ("yt", "yt_voll")
                        and window_seen):
                    ambi_lage.update(ts=now, target=dict(target), page=page_id)
                pos = mpv_time_pos()
                if pos is not None and (last_pos is None or pos > last_pos + 0.05):
                    if last_pos is not None and window_seen and art == "yt" and not embed_paused:
                        # Fenster sitzt und die Position waechst = mpv spielt
                        # sichtbar; ab da muss Chromium nicht mehr mitdekodieren.
                        cdp_eval(page_id, "try { nlPlayer.pauseVideo(); } catch (e) {} 1")
                        embed_paused = True
                        # Laenge an das Dashboard melden: das angehaltene Embed kennt sie
                        # nicht, ohne Laenge startete jedes Video bei 0 (nlStartSekunde).
                        dauer = mpv_eigenschaft("duration")
                        if isinstance(dauer, (int, float)) and dauer > 0 and shown.startswith("yt:"):
                            cdp_eval(page_id, "window.nlDauerExtern = "
                                     + json.dumps({"schluessel": shown[3:], "dauer": int(dauer)}) + "; 1")
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
                elif pausiert and art == "yt":
                    last_progress = now          # gewollte Pause, kein Haenger
                elif xf is not None:
                    last_progress = now          # Blende laeuft: alter darf am Ende stehen (keep-open)
                elif last_pos is not None and now - last_progress > (CAM_STALL_TIMEOUT if art == "cam" else STALL_TIMEOUT):
                    problem = f"mpv steht bei {last_pos:.1f}s"
                # Musik stockt (22.10.2026, 20:52: die Position kroch in Haeppchen weiter, "steht" griff
                # erst nach 32 s): in 8 s weniger als 3 s gespielt -> wie ein Haenger behandeln.
                if not musik or art != "yt" or pausiert or xf is not None or last_pos is None:
                    stocken.clear()
                elif not stocken:
                    stocken.update(t=now, pos=last_pos)
                elif now - stocken["t"] >= 8:
                    if not problem and last_pos - stocken["pos"] < 3:
                        problem = f"mpv steht bei {last_pos:.1f}s (stockt: {last_pos - stocken['pos']:.1f} s in 8 s)"
                    stocken.update(t=now, pos=last_pos)
            if problem and art == "yt":
                haenger_sichern()           # mpv-Logs werden beim naechsten Start ueberschrieben
            if (problem and problem.startswith("mpv steht") and musik and art == "yt"
                    and time.time() - fortsetzen.get("versucht", {}).get(shown, 0) > 300):
                # Musik: einmal mpv an derselben Stelle neu starten (21.10.2026: zweimal hing
                # der Strom, der Browser-Player sprang danach ~30 s spaeter zum naechsten Song).
                log(f"{problem} ({shown}) - starte mpv an derselben Stelle neu")
                fortsetzen.setdefault("versucht", {})[shown] = now
                fortsetzen["key"], fortsetzen["pos"] = shown, max(0.0, last_pos - 1.0)
                if mpv.poll() is None:
                    mpv.kill()
                    mpv.wait()
                stop_all()
                shown, embed_paused = None, False
                problem = None
            if problem:
                log(f"{problem} ({shown}) - zurueck zum Browser-Player")
                if mpv.poll() is None:
                    mpv.kill()
                    mpv.wait()
                stop_all()
                give_back(page_id, shown)
                mpv_bad[shown] = now
                shown, embed_paused = None, False

        # Seitenhintergrund nachtraeglich zuschalten, wenn die Balken-Messung erst
        # nach dem Start fertig wurde (laeuft ohne Neustart von mpv).
        if (musik and shown and shown.startswith("yt:") and mpv is not None and last_pos is not None
                and blur_an != shown and seiten_blur_graph(shown[3:])):
            blur_an = shown
            mpv_befehl("set_property", "hwdec", "vaapi-copy")
            mpv_befehl("vf", "set", seiten_blur_graph(shown[3:]))
            log(f"Seitenhintergrund an ({shown})")

        # Song lief schon, bevor seine Messung fertig war (frischer Wunsch, Neustart):
        # in den ersten 30 s noch zum Musikbeginn springen (Studio-Abgleich braucht ~10 s).
        if (musik and shown and shown.startswith("yt:") and mpv is not None and last_pos is not None
                and intro_gesprungen != shown and started and time.time() - started < 30):
            anf = (STILLE.get(shown[3:]) or {}).get("anfang") or 0
            if anf > 1 and last_pos < anf - 1:
                intro_gesprungen = shown
                mpv_befehl("seek", anf, "absolute")
                log(f"Intro uebersprungen ({shown}): -> {anf:.1f}s")
            elif anf and last_pos >= anf - 1:
                intro_gesprungen = shown

        # Messung kam erst nach dem Start (frischer Wunsch): Anhebung nachtraeglich setzen.
        if musik and shown and shown.startswith("yt:") and mpv is not None and shown[3:] in STILLE:
            z = ton_zustand(shown[3:], ton_limiter)
            if gain_gesetzt != (shown, z) and mpv_befehl("set_property", "volume-gain", z[0]):
                # Limiter ein/aus (auch mitten im Song, wenn am Handy umgeschaltet) - den
                # Filter nur anfassen, wenn er sich aendert (sonst kurzer Tonaussetzer).
                vorher = gain_gesetzt[1][1] if gain_gesetzt and gain_gesetzt[0] == shown else None
                if z[1] != vorher:
                    mpv_befehl("af", "set", z[1]) if z[1] else mpv_befehl("af", "clr", "")
                gain_gesetzt = (shown, z)
                log(f"Lautheit gesetzt ({shown}): {z[0]:+.1f} dB" + (f", Filter {z[1]}" if z[1] else ""))

        # Ohne Ueberblendung (nichts vorgeladen): an der Schlussstille sofort beenden -
        # das saubere Ende (Code 0) fuehrt wie gewohnt zum naechsten Song.
        if (xf is None and musik and shown and shown.startswith("yt:") and mpv is not None
                and mpv.poll() is None and last_pos is not None and not pausiert and mpv_dauer.get(shown)
                and stille_ende(shown[3:], mpv_dauer[shown]) < mpv_dauer[shown]
                and last_pos >= stille_ende(shown[3:], mpv_dauer[shown]) and stille_beendet != shown):
            stille_beendet = shown
            log(f"Schlussstille erreicht ({shown}) - naechster Song")
            mpv_befehl("quit")

        # Ueberblendung vorbereiten: XF_SEK + XF_VORLAUF_SEK vor dem Musikende den naechsten
        # Song angehalten laden (vorgeladen vom Dashboard: nlMusikVorladen, 60 s vor Schluss);
        # den genauen Zeitpunkt rechnet ueberblenden().
        vor_x = state.get("vorladen") or {}
        n_vid = str(vor_x.get("videoId") or "")
        if (xf is None and musik and n_vid and shown and shown.startswith("yt:") and shown[3:] != n_vid
                and mpv is not None and mpv.poll() is None and last_pos is not None and not pausiert
                and mpv_dauer.get(shown) and not state.get("spiel")):
            ende_alt = stille_ende(shown[3:], mpv_dauer[shown])         # Musikende des alten
            rest = ende_alt - last_pos
            n_key = schluessel_fuer(n_vid, int(vor_x.get("hoehe") or 0), int(vor_x.get("fps") or 0), True)
            # Chef am Handy: "Ueberblenden" mitten im Song - sobald der naechste Song
            # aufgeloest ist, mit der normalen Blende (XF_SEK) hinueber: der Ton wechselt
            # dann XF_VORLAUF_SEK + XF_SEK - XF_TON_FENSTER_SEK spaeter.
            blend = state.get("blenden") or {}
            blend_jetzt = (bool(blend.get("id")) and blend.get("id") != blend_erledigt
                           and rest > XF_SEK + XF_VORLAUF_SEK)
            if blend_jetzt and n_key in cache:
                blend_erledigt = blend.get("id")
                rest = XF_SEK + XF_VORLAUF_SEK
                ende_alt = last_pos + rest
                log(f"Ueberblenden auf Wunsch ({shown[3:]} bei {last_pos:.0f}s)")
            if 2.0 < rest <= XF_SEK + XF_VORLAUF_SEK and n_key in cache:
                # Neuer Song: angehalten ab "Musikanfang - (XF_SEK - Ton-Fenster)", damit er
                # 7 s stumm im Bild einlaeuft und am Fensterbeginn genau seine Musik beginnt.
                n_anfang = float((STILLE.get(n_vid) or {}).get("anfang") or 0.0)
                n_einsatz = float((STILLE.get(n_vid) or {}).get("einsatz") or n_anfang)
                n_start = max(0.0, n_einsatz - (XF_SEK - XF_TON_FENSTER_SEK))
                video_url, audio_url, _laenge = cache[n_key]
                neu_app = "mpvxf" if MPV_APP["id"] == "mpv" else "mpv"
                xf_args = ["mpv", f"--hwdec={MPV_HWDEC}", "--vo=gpu", f"--profile={MPV_PROFILE}", "--sid=no",
                           f"--demuxer-max-bytes={MPV_DEMUXER_MIB}MiB",
                           f"--demuxer-max-back-bytes={MPV_DEMUXER_BACK_MIB}MiB",
                           "--no-osc", "--osd-level=0", "--no-input-default-bindings",
                           # Fenstergroesse bestimmt allein der Supervisor - sonst passte mpv sie ~1 s
                           # nach dem Platzieren selbst ans Video-Seitenverhaeltnis an (1200x837 statt 675).
                           "--keepaspect-window=no", "--auto-window-resize=no",
                           "--really-quiet", f"--input-ipc-server={MPV_SOCK_XF}",
                           f"--log-file=/home/citycafe/mpv-xf-{neu_app}.log", "--volume=0",
                           "--title=xf-ein", f"--wayland-app-id={neu_app}",
                           "--pause", f"--start={n_start:.2f}"]
                xf_args += ton_args(n_vid, ton_limiter)   # Lautheit angleichen
                if ton_lautheit:
                    xf_args.append(f"--af={LAUTHEIT_FILTER}")
                xf_args += seiten_blur_args(n_vid)
                xf_blur = bool(seiten_blur_args(n_vid))
                if audio_url:
                    xf_args.append(f"--audio-file={ton_quelle(n_vid, audio_url)}")
                xf_args.append("--cache-pause=no")     # Bild stockt -> Musik laeuft weiter
                xf_args.append(video_url)
                try:
                    os.remove(MPV_SOCK_XF)
                except OSError:
                    pass
                proc = subprocess.Popen(xf_args, env={**os.environ, **session_env()},
                                        preexec_fn=mpv_dies_with_us)
                # Der alte bleibt am Dateiende stehen statt sich zu beenden: braucht der neue
                # lange (bis XF_START_FRIST), fiele das Ende sonst in "mpv beendet" -> Browser-Player.
                mpv_befehl("set_property", "keep-open", "yes")
                xf = {"proc": proc, "vid": n_vid, "app": neu_app, "t0": time.time(),
                      "ende": ende_alt, "anfang": n_anfang, "einsatz": n_einsatz, "start": n_start,
                      "ton": ton_zustand(n_vid, ton_limiter),
                      "blur": xf_blur}
                threading.Thread(target=ueberblenden, args=(xf, dict(target), page_id, ton_vol),
                                 daemon=True).start()
                log(f"Ueberblendung: {shown[3:]} -> {n_vid} (Musikende alt {ende_alt:.1f}s in {rest:.1f}s, "
                    f"neu ab {n_start:.1f}s, Musik ab {n_anfang:.1f}s, voll ab {n_einsatz:.1f}s)")

        # Lebenszeichen ans Dashboard (siehe nlExtern()/djExtern() in index.html):
        # nur wenn mpv spielen kann, startet der Slot seinen Browser-Player nicht.
        # Gilt 3 s - stirbt der Supervisor, spielt das Dashboard wieder allein.
        nl_ok = youtube and cache_key in cache and not blocked("yt:" + schluessel)
        dj_ok = streamlink_da and not (dj_kanal and blocked("twitch:" + dj_kanal))
        dj_laeuft = bool(shown and shown.startswith("twitch:") and embed_paused)
        # Wiedergabestand fuers Dashboard (Musik: "2:08 / 3:40", "in 1:32",
        # Vorladen 60 s vor Schluss, Fortschritt am Handy).
        mpv_stand = "null"
        if shown and shown.startswith("yt:") and mpv is not None and last_pos is not None:
            if mpv_dauer.get(shown) is None:
                d = mpv_eigenschaft("duration")
                if isinstance(d, (int, float)) and d > 0:
                    mpv_dauer.clear()
                    mpv_dauer[shown] = float(d)
            # Laufende Aufloesung/Bildrate fuers Dashboard (einmal je Song, wenn bekannt)
            if mpv_bild.get("key") != shown:
                b, h = mpv_eigenschaft("video-params/w"), mpv_eigenschaft("video-params/h")
                fps = mpv_eigenschaft("container-fps") or mpv_eigenschaft("estimated-vf-fps")
                if isinstance(b, int) and isinstance(h, int) and b > 0:
                    mpv_bild.clear()
                    mpv_bild.update(key=shown, aufl=aufloesung_text(b, h),
                                    fps=round(fps) if isinstance(fps, (int, float)) else None)
            mpv_stand = json.dumps({"videoId": shown[3:], "pos": round(last_pos, 1),
                                    "aufl": mpv_bild.get("aufl") if mpv_bild.get("key") == shown else None,
                                    "fps": mpv_bild.get("fps") if mpv_bild.get("key") == shown else None,
                                    "dauer": stille_ende(shown[3:], mpv_dauer.get(shown)), "pause": pausiert})
        # Waehrend der Ueberblendung ist fuers Dashboard schon der neue Song "jetzt":
        # dessen Stand melden - sonst stand der Fortschrittsbalken 9 s auf 0 und sprang.
        if xf is not None and xf.get("laeuft") and musik:
            xp = mpv_eigenschaft("time-pos", sock=MPV_SOCK_XF)
            xd = mpv_eigenschaft("duration", sock=MPV_SOCK_XF)
            if isinstance(xp, (int, float)):
                mpv_stand = json.dumps({"videoId": xf["vid"], "pos": round(xp, 1), "aufl": None, "fps": None,
                                        "dauer": stille_ende(xf["vid"], xd) if isinstance(xd, (int, float)) else None,
                                        "pause": pausiert})
        # DJ-Modus: je Song fuers Studio [gain dB, Limiter-Anhebung dB, Anfang s, Ende s] - die
        # Meter zeigen damit, was aus der Anlage kommt (wie ton_zustand), die Wellenform zeigt
        # Anfang/Ende als Marken und den Countdown bis zur Ueberblendung (Ende - Blende).
        ton_gain = "null"
        dj_kurz = "null"
        if musik and state.get("flaeche") == "yt-dj-video":
            dj_kurz = json.dumps({v: spur_kurz(v) for v in (state.get("djSchlange") or [])
                                  if re.fullmatch(r"[A-Za-z0-9_-]{11}", str(v)) and spur_kurz(v)})
            vids = {k.split("|", 1)[0] for k in list(cache)} | {str(v) for v in (state.get("analyse") or [])[:3]}
            if shown and shown.startswith("yt:"):
                vids.add(shown[3:].split("|", 1)[0])
            if xf is not None:
                vids.add(xf["vid"])
            ton_gain = json.dumps({v: [gain_von(v), ((STILLE.get(v) or {}).get("limiter") or 0.0) if ton_limiter else 0.0,
                                       STILLE[v].get("anfang") or 0.0, STILLE[v].get("ende"),
                                       STILLE[v].get("einsatz") or STILLE[v].get("anfang") or 0.0]
                                   for v in vids if v in STILLE})
        if page_id:
            try:
                cdp_eval(page_id,
                         f"window.nlExternBis = {'Date.now() + 3000' if nl_ok else '0'}; "
                         f"window.djExternBis = {'Date.now() + 3000' if dj_ok else '0'}; "
                         f"window.djExternLaeuft = {'true' if dj_laeuft else 'false'}; "
                         f"window.nlTonGain = {ton_gain}; window.nlStudioKurz = {dj_kurz}; "
                         f"window.nlMpvStand = {mpv_stand}; window.nlMpvStandZeit = Date.now(); "
                         f"window.nlWarnung = {json.dumps(WARNUNG) if WARNUNG else 'null'}; 1")
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
            # Frisch gestartet: wieder app_id "mpv" (Regel in der sway-Config) - nach
            # einer Ueberblendung hiess der Haupt-Player evtl. "mpvxf".
            MPV_APP["id"] = "mpv"
            args = ["mpv", f"--hwdec={MPV_HWDEC}", "--vo=gpu", f"--profile={MPV_PROFILE}", "--sid=no",
                    f"--demuxer-max-bytes={MPV_DEMUXER_MIB}MiB",
                    f"--demuxer-max-back-bytes={MPV_DEMUXER_BACK_MIB}MiB",
                    "--no-osc", "--osd-level=0", "--no-input-default-bindings",
                    # Fenstergroesse bestimmt allein der Supervisor - sonst passte mpv sie ~1 s
                    # nach dem Platzieren selbst ans Video-Seitenverhaeltnis an (1200x837 statt 675).
                    "--keepaspect-window=no", "--auto-window-resize=no",
                    "--really-quiet", "--input-ipc-server=/tmp/mpv-nl.sock",
                    "--log-file=/home/citycafe/mpv-nl.log", f"--volume={ton_vol}"]
            if ton_lautheit:
                args.append(f"--af={LAUTHEIT_FILTER}")
            env = {**os.environ, **session_env()}
            if want.startswith("yt:") and nl_ok:
                video_url, audio_url, laenge = cache[cache_key]
                start = state.get("start") or 0
                if fortsetzen.get("key") == want:   # nach einem Haenger: an der alten Stelle weiter
                    start = round(fortsetzen["pos"], 1)
                fortsetzen.pop("key", None)
                if musik and not start:             # Stille am Songanfang ueberspringen
                    start = (STILLE.get(schluessel) or {}).get("anfang") or 0
                # Beim ersten Auftritt kennt das Dashboard die Laenge noch nicht
                # und gibt 0 vor; yt-dlp kennt sie schon. Dann hier zufaellig
                # einsteigen - nie so spaet, dass der Slot ins Videoende laeuft.
                # Wuensche vom Handy (state["wunsch"] gesetzt) kommen von vorn.
                if (not start and not state.get("wunsch") and not musik and laenge
                        and laenge > NL_SLOT_SEKUNDEN + 30):
                    start = random.randint(0, laenge - NL_SLOT_SEKUNDEN - 30)
                args.append(f"--start={start}")
                # Unsichtbar starten (sway-Regel fuer Titel "xf-ein"), sichtbar erst,
                # wenn das Fenster sitzt - im Vollbild tauchte es sonst ~1 s an der
                # Widget-Stelle (83/248) auf, bevor place_mpv es verschob.
                args.append("--title=xf-ein")
                if musik:
                    args += ton_args(schluessel, ton_limiter)   # Lautheit angleichen
                    if schluessel in STILLE:
                        gain_gesetzt = ("yt:" + schluessel, ton_zustand(schluessel, ton_limiter))
                if musik and seiten_blur_args(schluessel):
                    args += seiten_blur_args(schluessel)   # 4:3/Hochformat: Seiten fuellen
                    blur_an = "yt:" + schluessel
                if audio_url:
                    args.append(f"--audio-file={ton_quelle(schluessel, audio_url) if musik else audio_url}")
                if musik:
                    args.append("--cache-pause=no")     # Bild stockt -> Musik laeuft weiter
                args.append(video_url)
                mpv = subprocess.Popen(args, env=env, preexec_fn=mpv_dies_with_us)
                log(f"Auftritt: {schluessel} ab {start}s"
                    + (" (Musik)" if musik else "")
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
                                               "--cache=yes", f"--cache-secs={CAM_CACHE_SECS}",
                                               f"--demuxer-readahead-secs={CAM_CACHE_SECS}",
                                               "--framedrop=vo", want[4:]],
                                       env=env, preexec_fn=mpv_dies_with_us)
                log("Auftritt: Dartcam")
            if mpv is not None:
                shown = want
                started, last_pos, last_progress, embed_paused = time.time(), None, None, False
                next_place_check, window_seen = 0, False
                pausiert = False
                flaeche_jetzt, qr_lage = None, None   # neues mpv: Lage und QR neu setzen


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
