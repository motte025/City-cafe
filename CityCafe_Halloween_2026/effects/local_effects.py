#!/usr/bin/env python3
"""
local_effects.py - kostenlose lokale Effekte auf Basis des Halloween-Plakats:
atmosphaerischer Nebel (mehrschichtig), Kerzen-/Kuerbis-Glimmern (automatisch
erkannt ueber warme Farbtoene, kein manuelles Koordinaten-Picking noetig) und
ein sanfter Ken-Burns-Zoom. Kein KI-Aufruf, keine Kosten.

Nutzung:
    venv/bin/python3 effects/local_effects.py --sekunden 8 --out previews/test_effekte.mp4
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

PROJEKT = Path(__file__).resolve().parent.parent


def glimmer_maske_erzeugen(bild_bgr):
    """Findet warme (orange/rote), helle Bereiche im Bild - Kerzen, Kuerbisse,
    gluehende Schrift - ganz ohne manuell gesetzte Koordinaten."""
    hsv = cv2.cvtColor(bild_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # Orange/Rot liegt im HSV-Farbkreis bei 0-30 und 160-180 (OpenCV: 0-180 Grad)
    warmton = np.clip(1.0 - np.minimum(np.abs(h - 10), np.abs(h - 170)) / 25.0, 0, 1)
    maske = warmton * (s / 255.0) * (v / 255.0)
    maske = cv2.GaussianBlur(maske, (9, 9), 0)
    return np.clip(maske, 0, 1).astype(np.float32)


def blobs_mit_phasen(maske, max_bloebe=24):
    """Zerlegt die Glimmer-Maske in einzelne Flecken, jeder bekommt eine eigene
    Flacker-Phase und -Frequenz, damit nicht alles synchron pulsiert."""
    bin_maske = (maske > 0.15).astype(np.uint8)
    anzahl, labels = cv2.connectedComponents(bin_maske)
    bloebe = []
    rng = np.random.default_rng(42)
    for i in range(1, min(anzahl, max_bloebe + 1)):
        einzel = (labels == i).astype(np.float32) * maske
        if einzel.sum() < 15:  # zu kleine Flecken (Rauschen) ignorieren
            continue
        bloebe.append({
            "maske": einzel,
            "phase": rng.uniform(0, 2 * np.pi),
            "frequenz": rng.uniform(0.6, 2.2),   # Hz-aehnlich, Kerzen hektischer als Kuerbisse
            "amplitude": rng.uniform(0.15, 0.4),
        })
    return bloebe


def nebelschicht_erzeugen(breite, hoehe, seed):
    """Einmalige, kachelbare Nebel-Textur aus geglaettetem Rauschen."""
    rng = np.random.default_rng(seed)
    klein = rng.random((hoehe // 8, breite // 8)).astype(np.float32)
    nebel = cv2.resize(klein, (breite * 2, hoehe), interpolation=cv2.INTER_CUBIC)
    nebel = cv2.GaussianBlur(nebel, (0, 0), sigmaX=25, sigmaY=15)
    nebel = (nebel - nebel.min()) / (nebel.max() - nebel.min() + 1e-6)
    return nebel.astype(np.float32)


def frame_rendern(basis, glimmer_bloebe, nebel1, nebel2, t_sek, breite, hoehe,
                   nebeldichte, zoom_gesamt_sek):
    frame = basis.copy().astype(np.float32)

    # Kerzen-/Kuerbis-Glimmern: pro Blob eigener Sinus-Flacker-Multiplikator
    verstaerkung = np.zeros((hoehe, breite), dtype=np.float32)
    for b in glimmer_bloebe:
        takt = 1.0 + b["amplitude"] * np.sin(2 * np.pi * b["frequenz"] * t_sek + b["phase"])
        verstaerkung += b["maske"] * (takt - 1.0)
    glimmer_rgb = frame * np.clip(verstaerkung, -1, 1.5)[..., None]
    frame = np.clip(frame + glimmer_rgb * 0.9, 0, 255)

    # Nebel: zwei Schichten, unterschiedliche Drift-Geschwindigkeit (Vorder-/Hintergrund)
    versatz1 = int((t_sek * 18) % breite)
    versatz2 = int((t_sek * 42) % breite)
    schicht1 = nebel1[:, versatz1:versatz1 + breite]
    schicht2 = nebel2[:, versatz2:versatz2 + breite]
    nebel_kombiniert = np.clip(schicht1 * 0.65 + schicht2 * 0.45, 0, 1) * nebeldichte
    nebel_farbe = np.array([170, 160, 150], dtype=np.float32)  # kuehles Blaugrau, BGR
    frame = frame * (1 - nebel_kombiniert[..., None] * 0.55) + nebel_farbe * nebel_kombiniert[..., None] * 0.55

    # Sanfter Ken-Burns-Zoom (langsam reinzoomen ueber die volle Clipdauer)
    zoom_fortschritt = min(t_sek / zoom_gesamt_sek, 1.0)
    zoom = 1.0 + 0.06 * zoom_fortschritt
    mitte_x, mitte_y = breite / 2, hoehe / 2
    matrix = cv2.getRotationMatrix2D((mitte_x, mitte_y), 0, zoom)
    frame = cv2.warpAffine(frame, matrix, (breite, hoehe), borderMode=cv2.BORDER_REFLECT)

    return np.clip(frame, 0, 255).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser(description="Kostenloser lokaler Effekt-Test auf dem Halloween-Plakat")
    parser.add_argument("--sekunden", type=float, default=8.0)
    parser.add_argument("--out", type=str, default="previews/test_effekte.mp4")
    args = parser.parse_args()

    config = json.loads((PROJEKT / "config" / "config.json").read_text(encoding="utf-8"))
    breite = config["video_technik"]["breite"]
    hoehe = config["video_technik"]["hoehe"]
    fps = config["video_technik"]["fps"]
    nebeldichte = config["horror_einstellungen"]["nebeldichte"]

    plakat_pfad = PROJEKT / config["referenz"]["plakat_datei"]
    basis = cv2.imread(str(plakat_pfad))
    if basis is None:
        sys.exit(f"Konnte Plakat nicht laden: {plakat_pfad}")
    if basis.shape[1] != breite or basis.shape[0] != hoehe:
        basis = cv2.resize(basis, (breite, hoehe), interpolation=cv2.INTER_LANCZOS4)

    print("Erkenne warme Glimmer-Bereiche (Kerzen/Kuerbisse) ...")
    glimmer_maske = glimmer_maske_erzeugen(basis)
    bloebe = blobs_mit_phasen(glimmer_maske)
    print(f"  {len(bloebe)} unabhaengig flackernde Bereiche gefunden")

    print("Baue Nebelschichten ...")
    nebel1 = nebelschicht_erzeugen(breite, hoehe, seed=1)
    nebel2 = nebelschicht_erzeugen(breite, hoehe, seed=2)

    anzahl_frames = int(args.sekunden * fps)
    ziel = PROJEKT / args.out
    ziel.parent.mkdir(parents=True, exist_ok=True)

    print(f"Rendere {anzahl_frames} Frames ({args.sekunden}s @ {fps}fps) ...")
    ffmpeg = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{breite}x{hoehe}", "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        str(ziel),
    ], stdin=subprocess.PIPE)

    for i in range(anzahl_frames):
        t = i / fps
        frame = frame_rendern(basis, bloebe, nebel1, nebel2, t, breite, hoehe,
                               nebeldichte, zoom_gesamt_sek=args.sekunden)
        ffmpeg.stdin.write(frame.tobytes())
        if i % max(1, anzahl_frames // 10) == 0:
            print(f"  {i}/{anzahl_frames}")

    ffmpeg.stdin.close()
    ffmpeg.wait()
    print(f"Fertig: {ziel}")


if __name__ == "__main__":
    main()
