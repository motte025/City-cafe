#!/usr/bin/env python3
"""
export_und_pruefen.py - erzeugt aus den gerenderten Masterdateien (output/*_roh.mp4)
die finalen, unter 30 MB grossen Dateien (Zwei-Pass-H.264) samt _MUTE-Kopie und
fuehrt die technische Qualitaetspruefung mit FFprobe/FFmpeg durch.

    venv/bin/python3 scripts/export_und_pruefen.py
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

PROJEKT = Path(__file__).resolve().parent.parent
CFG = json.loads((PROJEKT / "config" / "config.json").read_text(encoding="utf-8"))
OUT = PROJEKT / "output"
ZIEL_MB = CFG["video_technik"]["ziel_dateigroesse_mb"]

PAARE = [
    ("video1_roh.mp4", CFG["ausgabedateien"]["video1"], CFG["ausgabedateien"]["video1_mute"]),
    ("video2_roh.mp4", CFG["ausgabedateien"]["video2"], CFG["ausgabedateien"]["video2_mute"]),
]


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def encode(roh, ziel):
    # Bitrate so waehlen, dass 60 s sicher unter dem Ziel bleiben (5 % Container-Reserve)
    kbit = int((ZIEL_MB * 8 * 1024 * 0.95) / 60)
    log = str(OUT / "_2pass")
    gemeinsam = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
                 "-b:v", f"{kbit}k", "-maxrate", f"{int(kbit * 1.6)}k", "-bufsize", f"{kbit * 3}k",
                 "-r", "30", "-an", "-movflags", "+faststart"]
    sh(["ffmpeg", "-y", "-v", "error", "-i", str(roh), *gemeinsam, "-pass", "1", "-passlogfile", log,
        "-f", "mp4", "/dev/null"])
    r = sh(["ffmpeg", "-y", "-v", "error", "-i", str(roh), *gemeinsam, "-pass", "2", "-passlogfile", log,
            str(ziel)])
    for f in OUT.glob("_2pass*"):
        f.unlink()
    if r.returncode != 0:
        sys.exit(f"Encoding fehlgeschlagen: {r.stderr}")
    return kbit


def pruefen(datei):
    erg = {}
    p = sh(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt",
            "-show_entries", "format=duration,size", "-of", "json", str(datei)])
    j = json.loads(p.stdout)
    s, f = j["streams"][0], j["format"]
    erg["codec"] = s["codec_name"]
    erg["aufloesung"] = f'{s["width"]}x{s["height"]}'
    erg["fps"] = s["r_frame_rate"]
    erg["frames"] = int(s["nb_read_frames"])
    erg["dauer_s"] = float(f["duration"])
    erg["groesse_mb"] = round(int(f["size"]) / 1024 / 1024, 1)
    erg["audio_streams"] = len(json.loads(sh(["ffprobe", "-v", "error", "-select_streams", "a",
                                               "-show_entries", "stream=index", "-of", "json",
                                               str(datei)]).stdout)["streams"])

    bl = sh(["ffmpeg", "-v", "info", "-i", str(datei), "-vf", "blackdetect=d=0.04:pix_th=0.10",
             "-an", "-f", "null", "-"]).stderr
    erg["schwarzphasen"] = [l.split("black_start:")[1].strip() for l in bl.splitlines() if "black_start" in l]
    fz = sh(["ffmpeg", "-v", "info", "-i", str(datei), "-vf", "freezedetect=n=0.0005:d=0.5",
             "-an", "-f", "null", "-"]).stderr
    erg["standbilder"] = [l.split("freeze_start:")[1].strip() for l in fz.splitlines() if "freeze_start" in l]

    cap = cv2.VideoCapture(str(datei))
    ok, erster = cap.read()
    cap.set(cv2.CAP_PROP_POS_FRAMES, erg["frames"] - 1)
    ok2, letzter = cap.read()
    erg["loop_abweichung_0_255"] = round(float(np.abs(erster.astype(np.float32) - letzter.astype(np.float32)).mean()), 2)
    return erg


def kontaktbogen(datei, name):
    ziel = PROJEKT / "previews" / f"kontaktbogen_{name}.jpg"
    sh(["ffmpeg", "-y", "-v", "error", "-i", str(datei), "-vf",
        "select='not(mod(n\\,150))',scale=480:-1,tile=4x3", "-frames:v", "1", str(ziel)])
    return ziel


def main():
    bericht = {}
    for roh_name, ziel_name, mute_name in PAARE:
        roh = OUT / roh_name
        if not roh.exists():
            print(f"uebersprungen (nicht vorhanden): {roh_name}")
            continue
        ziel, mute = OUT / ziel_name, OUT / mute_name
        print(f"Encodiere {ziel_name} ...")
        kbit = encode(roh, ziel)
        shutil.copyfile(ziel, mute)  # keine Tonspur -> Mute-Variante ist inhaltlich identisch
        e = pruefen(ziel)
        e["ziel_bitrate_kbit"] = kbit
        e["kontaktbogen"] = str(kontaktbogen(ziel, ziel_name.split("_")[4].lower()))
        bericht[ziel_name] = e
        print(json.dumps(e, indent=2, ensure_ascii=False))
    (OUT / "qualitaetsbericht.json").write_text(json.dumps(bericht, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
