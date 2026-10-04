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
import threading
import time
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


COOKIES_FROM = "chromium:/home/citycafe/.config/chromium-kiosk"
# Bestes H.264 bis 1080p (der Hardware-Decoder kann kein VP9/AV1 in brauchbarer
# Form), dazu die m4a-Tonspur. Nicht jedes Video hat 1080p60 (299) - manche
# nur 1080p30 (137).
# 1080p. Mit height<=720 braucht mpv rund 40 % weniger CPU (gemessen 95 %
# statt 161 % eines Kerns) - Ausweichweg, falls es eng wird.
# Seit dem W1 (Radeon 780M, VA-API fuer VP9/AV1) kein H.264-Zwang mehr:
# yt-dlp nimmt bei gleicher Aufloesung den besseren Codec (AV1/VP9).
FORMAT = "bestvideo[height<=1080]+bestaudio/best[height<=1080]"


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
        stufen.append(f"bestvideo{grund}{takt}+bestaudio[ext=m4a]")
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
    stufen = [f"bv*{codec}{takt}+ba[ext=m4a]", f"bv*{codec}{takt}+ba"] if takt else []
    stufen += [f"bv*{codec}+ba[ext=m4a]", f"bv*{codec}+ba", f"b{codec}", "b"]
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
XF_SEK = 9
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


def sway(*args):
    env = {**os.environ, **session_env()}
    if "SWAYSOCK" not in env:
        socks = [s for s in glob.glob("/run/user/1001/sway-ipc.*.sock")
                 if os.path.exists(f"/proc/{s.rsplit('.', 2)[-2]}")]
        if socks:
            env["SWAYSOCK"] = socks[0]
    return subprocess.run(["swaymsg", *args], env=env, capture_output=True, text=True)


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
                [programm, "--js-runtimes", "node", "--cookies-from-browser", COOKIES_FROM,
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


def suchen(text, anzahl=None):
    """YouTube-Suche fuer die Handy-Fernbedienung. -> Liste von Treffern."""
    anzahl = anzahl or SUCH_TREFFER
    out = None
    for programm in ytdlp_programme():
        try:
            out = subprocess.run(
                [programm, "--js-runtimes", "node", "--flat-playlist", "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s\t%(duration)s",
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
                [programm, "--js-runtimes", "node", "--flat-playlist", "--playlist-end", str(anzahl),
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


def treffer_lesen(ausgabe):
    """yt-dlp-Zeilen "id<TAB>titel<TAB>kanal<TAB>dauer_text<TAB>dauer_sek" -> Treffer."""
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
                [programm, "--js-runtimes", "node",
                 *(["--cookies-from-browser", COOKIES_FROM] if MIX_MIT_COOKIES else []),
                 "--flat-playlist", "--playlist-end", str(anzahl + 11), "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s\t%(duration)s",
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
    return treffer[:anzahl]


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
                [programm, "--js-runtimes", "node", "--cookies-from-browser", COOKIES_FROM,
                 "--flat-playlist", "--playlist-end", str(PLAYLIST_MAX), "--print",
                 "%(id)s\t%(title)s\t%(channel)s\t%(duration_string)s\t%(duration)s",
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
QR_CSS_BREITE = {"yt": 1200, "yt_voll": 1280}   # Videobreite in CSS-Pixeln je Flaeche


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
    massstab = target["w"] / float(css_breite)
    faktor = float(info.get("faktorVoll") or 1) if rect_art == "yt_voll" else 1.0
    rand = float(info.get("randVoll") or 20) if rect_art == "yt_voll" else float(info.get("rand") or 18)
    w = max(1, round(float(info.get("breite") or 174) * faktor * massstab))
    h = max(1, round(float(info.get("hoehe") or 192) * faktor * massstab))
    x = round(target["w"] - rand * massstab - w)
    y = round(target["h"] - rand * massstab - h)
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
    """Faden fuer die Ueberblendung: wartet, bis der neue mpv spielt, legt sein
    (noch unsichtbares) Fenster ueber das alte, sagt dem Dashboard "naechster
    Song" und blendet dann Ton und Bild ueber. xf["fertig"] = True am Ende,
    xf["fehler"] = True, wenn der neue nicht in Gang kommt."""
    frist = time.time() + 6
    while time.time() < frist:
        if xf["proc"].poll() is not None:
            break
        if mpv_eigenschaft("time-pos", sock=MPV_SOCK_XF) is not None and place_mpv(target, xf["app"], sichtbar=False):
            break
        time.sleep(0.1)
    else:
        xf["fehler"] = True
        return
    if xf["proc"].poll() is not None:
        xf["fehler"] = True
        return
    place_mpv(target, xf["app"], sichtbar=False)
    rahmen_setzen(target, sock=MPV_SOCK_XF)
    if xf.get("abbruch"):
        return
    try:
        cdp_eval(page_id, "(() => { try { return !!nlVideoFertig(); } catch (e) { return false; } })()")
    except (OSError, ValueError, ConnectionError):
        pass
    dauer = max(2.0, xf["dauer"] - (time.time() - xf["t0"]))
    beginn = time.time()
    while True:
        # Abgebrochen (Ueberspringen, Stopp, ...): sofort aufhoeren - sonst
        # drehte der Faden den inzwischen neu gestarteten Player leise.
        if xf.get("abbruch"):
            return
        p = min(1.0, (time.time() - beginn) / dauer)
        # Gleiche Gesamtlautstaerke (equal power): Amplituden cos/sin. mpv rechnet
        # die Lautstaerke kubisch (Amplitude = (v/100)^3), daher die dritte Wurzel.
        # Linear (v*(1-p) / v*p) brach die Lautstaerke in der Mitte um ~12 dB ein.
        alt_a, neu_a = math.cos(p * math.pi / 2), math.sin(p * math.pi / 2)
        mpv_befehl("set_property", "volume", round(vol * max(0.0, alt_a) ** (1 / 3), 1))
        mpv_befehl("set_property", "volume", round(vol * max(0.0, neu_a) ** (1 / 3), 1), sock=MPV_SOCK_XF)
        sway(f'[app_id="{xf["app"]}"]', "opacity", f"{p:.2f}")
        if p >= 1.0:
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
        art = "yt_voll" if flaeche == "yt-vollbild-video" else "yt"
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


def stille_messen(vid, audio_url, laenge):
    if vid in STILLE or not audio_url:
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
    gain = anhebung(audio_url, normal)
    STILLE[vid] = {"anfang": round(anfang, 2), "ende": round(ende, 2) if ende else None, "gain": gain}
    log(f"Intro/Ausklang {vid}: normal {normal:.0f} dB, Start {anfang:.1f}s "
        + (f"(Studio-Abgleich, Guete {abgl['guete']:.2f}), " if abgl else f"(erlaubt {erlaubt:.0f}s), ") +
        f"Ende {('%.1fs' % ende) if ende else '-'} (Laenge {laenge:.0f}s)"
        + (f", angehoben um {gain:.1f} dB" if gain else ""))


# Deutlich leisere Songs anheben (Wunsch 04.10.2026): feste Anhebung je Song
# ueber mpv volume-gain - die Lautstaerke (Handy, 100 %) bleibt, kein Pumpen wie
# beim dynaudnorm-Ausgleich. Nie ueber die Spitzen hinaus (keine Uebersteuerung).
GAIN_ZIEL_DB = -11.0       # typische "normale" Lautstaerke (Messung 04.10.2026: -6 bis -22)
GAIN_AB_DB = 2.0           # erst ab so viel leiser (vorher 4 dB)
GAIN_MAX_DB = 8.0
GAIN_RESERVE_DB = 1.0      # Abstand der lautesten Spitze zu 0 dBFS


def anhebung(audio_url, normal):
    """dB, um die der Song angehoben wird (0 = gar nicht)."""
    if normal >= GAIN_ZIEL_DB - GAIN_AB_DB:
        return 0.0
    try:
        aus = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", audio_url, "-vn",
                              "-af", "volumedetect", "-f", "null", "-"],
                             capture_output=True, text=True, timeout=90)
        spitze = float(re.search(r"max_volume:\s*(-?[\d.]+) dB", aus.stderr).group(1))
    except (OSError, subprocess.TimeoutExpired, AttributeError, ValueError):
        return 0.0
    gain = min(GAIN_ZIEL_DB - normal, GAIN_MAX_DB, -GAIN_RESERVE_DB - spitze)
    return round(gain, 1) if gain >= 1.0 else 0.0


def gain_von(vid):
    return (STILLE.get(vid) or {}).get("gain") or 0.0


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
        w, h = int(ziel["w"]), int(ziel["h"])
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
    blend_erledigt = None     # id des zuletzt ausgefuehrten "Jetzt ueberblenden"
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
    qr_karte = None       # PIL-Bild des QR-Kaertchens
    qr_karte_id = ""
    qr_lage = None        # (x, y, w, h, flaeche), fuer die das Overlay gesetzt ist
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
            if xf is not None and pausiert:
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
                        stille_messen(vid, urls[0], urls[2])
                    else:
                        failed[vid] = time.time()
                analyse_arbeiter = threading.Thread(target=analyse_lauf, daemon=True)
                analyse_arbeiter.start()

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
                            anzahl=max(SUCH_TREFFER, min(SUCH_TREFFER_MAX, int(auftrag.get("anzahl") or 0)))):
                    # Automatische Vorschlaege beim Oeffnen der Fernbedienung:
                    # mehrere Begriffe gemischt statt vieler Treffer zu einem Thema.
                    if liste_id:
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
                        # Live-/Fan-/Lyric-/Audio-Uploads ans Ende, Reihenfolge sonst wie YouTube
                        treffer = sorted(treffer, key=lambda t: musikvideo_wertung(t, text) < 0)
                    if not gemischt:
                        log(f"Suche {text!r}: {len(treffer)} Treffer")
                    # art bestaetigt, welche Suche wirklich lief: ein alter Supervisor
                    # im selben Raum kennt Playlists nicht - das Handy verwirft dann
                    # seine Song-Treffer, statt die richtigen zu ueberschreiben.
                    art = "playlistInhalt" if liste_id else ("playlist" if nur_playlists else "")
                    zustellen(seite, "window.nlSucheTreffer = "
                              + json.dumps({"id": sid, "liste": treffer, "art": art}) + "; 1", "Treffer")
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

                def aufgabe(fid=finde_id, text=str(finde.get("text") or "")[:120], seite=page_id):
                    # "Kuenstler Titel official video" (Spec 5.3/7.3): unter den ersten
                    # fuenf das beste echte Musikvideo (nicht laenger als 10 Minuten)
                    gefunden = suchen(text + " official video", 8) if text else []
                    gefunden = sorted([t for t in gefunden if (t.get("dauerSek") or 0) <= 600] or gefunden,
                                      key=lambda t: -musikvideo_wertung(t, text))[:1]
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
        if xf is not None:
            neu_lebt = xf["proc"].poll() is None
            if xf.get("fehler") or not neu_lebt or (want != shown and want != "yt:" + xf["vid"]):
                log(f"Ueberblendung abgebrochen ({xf['vid']})")
                xf["abbruch"] = True
                stop(xf["proc"])
                if mpv is not None and mpv.poll() is None:
                    mpv_befehl("set_property", "volume", ton_vol)
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
                gain_gesetzt = (shown, gain_von(xf["vid"]))   # stand schon beim Start
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
                rect_art = "yt_voll" if (art == "yt" and musik
                                         and state.get("flaeche") == "yt-vollbild-video") else art
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
            g = gain_von(shown[3:])
            if gain_gesetzt != (shown, g) and mpv_befehl("set_property", "volume-gain", g):
                gain_gesetzt = (shown, g)
                if g:
                    log(f"Leiser Song angehoben ({shown}): +{g:.1f} dB")

        # Ohne Ueberblendung (nichts vorgeladen): an der Schlussstille sofort beenden -
        # das saubere Ende (Code 0) fuehrt wie gewohnt zum naechsten Song.
        if (xf is None and musik and shown and shown.startswith("yt:") and mpv is not None
                and mpv.poll() is None and last_pos is not None and not pausiert and mpv_dauer.get(shown)
                and stille_ende(shown[3:], mpv_dauer[shown]) < mpv_dauer[shown]
                and last_pos >= stille_ende(shown[3:], mpv_dauer[shown]) and stille_beendet != shown):
            stille_beendet = shown
            log(f"Schlussstille erreicht ({shown}) - naechster Song")
            mpv_befehl("quit")

        # Ueberblendung starten: XF_SEK vor Songende, wenn der naechste Song schon
        # vorgeladen ist (Dashboard: nlMusikVorladen, 60 s vor Schluss).
        vor_x = state.get("vorladen") or {}
        n_vid = str(vor_x.get("videoId") or "")
        if (xf is None and musik and n_vid and shown and shown.startswith("yt:") and shown[3:] != n_vid
                and mpv is not None and mpv.poll() is None and last_pos is not None and not pausiert
                and mpv_dauer.get(shown) and not state.get("spiel")):
            rest = stille_ende(shown[3:], mpv_dauer[shown]) - last_pos   # bis zur Schlussstille
            n_key = schluessel_fuer(n_vid, int(vor_x.get("hoehe") or 0), int(vor_x.get("fps") or 0), True)
            # Chef am Handy: "Ueberblenden" mitten im Song - sobald der naechste Song
            # aufgeloest ist, mit der normalen Blende (XF_SEK) hinueber.
            blend = state.get("blenden") or {}
            blend_jetzt = bool(blend.get("id")) and blend.get("id") != blend_erledigt and rest > XF_SEK
            if blend_jetzt and n_key in cache:
                blend_erledigt = blend.get("id")
                rest = XF_SEK
                log(f"Ueberblenden auf Wunsch ({shown[3:]} bei {last_pos:.0f}s)")
            if 2.0 < rest <= XF_SEK and n_key in cache:
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
                           "--log-file=/home/citycafe/mpv-xf.log", "--volume=0",
                           "--title=xf-ein", f"--wayland-app-id={neu_app}",
                           # So frueh starten, dass der Musikbeginn des neuen Songs in die Mitte
                           # der Ueberblendung faellt: kein Loch (vorher am Ende: bis -10 dB, wenn
                           # davor eine leise Filmszene lief), Saenger nicht schon mitten im Gesang.
                           f"--start={max(0.0, ((STILLE.get(n_vid) or {}).get('anfang') or 0) - rest / 2):.2f}"]
                xf_args.append(f"--volume-gain={gain_von(n_vid)}")   # leise Songs anheben
                if ton_lautheit:
                    xf_args.append(f"--af={LAUTHEIT_FILTER}")
                xf_args += seiten_blur_args(n_vid)
                xf_blur = bool(seiten_blur_args(n_vid))
                if audio_url:
                    xf_args.append(f"--audio-file={audio_url}")
                xf_args.append(video_url)
                try:
                    os.remove(MPV_SOCK_XF)
                except OSError:
                    pass
                proc = subprocess.Popen(xf_args, env={**os.environ, **session_env()},
                                        preexec_fn=mpv_dies_with_us)
                xf = {"proc": proc, "vid": n_vid, "app": neu_app, "t0": time.time(), "dauer": rest - 0.3,
                      "blur": xf_blur}
                threading.Thread(target=ueberblenden, args=(xf, dict(target), page_id, ton_vol),
                                 daemon=True).start()
                log(f"Ueberblendung: {shown[3:]} -> {n_vid} ({rest:.1f}s)")

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
        if xf is not None and musik:
            xp = mpv_eigenschaft("time-pos", sock=MPV_SOCK_XF)
            xd = mpv_eigenschaft("duration", sock=MPV_SOCK_XF)
            if isinstance(xp, (int, float)):
                mpv_stand = json.dumps({"videoId": xf["vid"], "pos": round(xp, 1), "aufl": None, "fps": None,
                                        "dauer": stille_ende(xf["vid"], xd) if isinstance(xd, (int, float)) else None,
                                        "pause": pausiert})
        if page_id:
            try:
                cdp_eval(page_id,
                         f"window.nlExternBis = {'Date.now() + 3000' if nl_ok else '0'}; "
                         f"window.djExternBis = {'Date.now() + 3000' if dj_ok else '0'}; "
                         f"window.djExternLaeuft = {'true' if dj_laeuft else 'false'}; "
                         f"window.nlMpvStand = {mpv_stand}; 1")
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
                    args.append(f"--volume-gain={gain_von(schluessel)}")   # leise Songs anheben
                if musik and seiten_blur_args(schluessel):
                    args += seiten_blur_args(schluessel)   # 4:3/Hochformat: Seiten fuellen
                    blur_an = "yt:" + schluessel
                if audio_url:
                    args.append(f"--audio-file={audio_url}")
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
