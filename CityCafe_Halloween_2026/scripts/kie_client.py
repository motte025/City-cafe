#!/usr/bin/env python3
"""
kie_client.py - Anbindung an die kie.ai-API fuer das Halloween-Projekt.
Nur fuer das Modell kling/v2-5-turbo-image-to-video-pro gedacht.
Der API-Key kommt ausschliesslich aus der Umgebungsvariable KIE_API_KEY.
"""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

API_BASIS = "https://api.kie.ai/api/v1"
UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload"
MODELL = "kling/v2-5-turbo-image-to-video-pro"
POLL_SEKUNDEN = 8
MAX_VERSUCHE = 5
WIEDERHOLBARE_CODES = {429, 500, 502, 503}


def api_key():
    schluessel = os.environ.get("KIE_API_KEY", "").strip()
    if not schluessel:
        sys.exit("Fehler: KIE_API_KEY ist nicht gesetzt.")
    return schluessel


def _anfrage(url, daten):
    rumpf = json.dumps(daten).encode("utf-8")
    pause = 2
    for versuch in range(1, MAX_VERSUCHE + 1):
        req = urllib.request.Request(url, data=rumpf, method="POST")
        req.add_header("Authorization", f"Bearer {api_key()}")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=120) as antwort:
                return json.loads(antwort.read().decode("utf-8"))
        except urllib.error.HTTPError as fehler:
            text = fehler.read().decode("utf-8", errors="replace")
            if fehler.code == 402:
                sys.exit("Fehler 402: Guthaben auf kie.ai ist leer.")
            if fehler.code in WIEDERHOLBARE_CODES and versuch < MAX_VERSUCHE:
                print(f"  HTTP {fehler.code}, Versuch {versuch}/{MAX_VERSUCHE} ...", file=sys.stderr)
                time.sleep(pause)
                pause *= 2
                continue
            sys.exit(f"Fehler: HTTP {fehler.code} - {text}")
        except urllib.error.URLError as fehler:
            if versuch < MAX_VERSUCHE:
                time.sleep(pause)
                pause *= 2
                continue
            sys.exit(f"Fehler: Netzwerkproblem - {fehler}")


def bild_hochladen(lokaler_pfad, upload_pfad="halloween-2026", dateiname=None):
    """Laedt ein lokales Bild per Base64 hoch, gibt die oeffentliche downloadUrl zurueck."""
    with open(lokaler_pfad, "rb") as f:
        roh = f.read()
    b64 = base64.b64encode(roh).decode("ascii")
    endung = lokaler_pfad.rsplit(".", 1)[-1].lower()
    mime = "image/png" if endung == "png" else "image/jpeg"

    antwort = _anfrage(UPLOAD_URL, {
        "base64Data": f"data:{mime};base64,{b64}",
        "uploadPath": upload_pfad,
        "fileName": dateiname or os.path.basename(lokaler_pfad),
    })
    if antwort.get("code") != 200:
        sys.exit(f"Upload fehlgeschlagen: {antwort}")
    url = antwort["data"]["downloadUrl"]
    print(f"  Hochgeladen: {lokaler_pfad} -> {url}")
    return url


def clip_erzeugen(prompt, image_url, dauer="10", tail_image_url=None,
                   negative_prompt=None, cfg_scale=0.5):
    """Erstellt einen Kling-Video-Task und wartet auf das Ergebnis. Gibt (resultUrls, creditsConsumed) zurueck."""
    eingabe = {
        "prompt": prompt,
        "image_url": image_url,
        "duration": str(dauer),
        "cfg_scale": cfg_scale,
    }
    if tail_image_url:
        eingabe["tail_image_url"] = tail_image_url
    if negative_prompt:
        eingabe["negative_prompt"] = negative_prompt

    print(f"Erstelle Kling-Task ({dauer}s) ...")
    antwort = _anfrage(f"{API_BASIS}/jobs/createTask", {"model": MODELL, "input": eingabe})
    if antwort.get("code") != 200:
        sys.exit(f"Fehler beim Erstellen: {antwort}")
    task_id = antwort["data"]["taskId"]
    print(f"  Task-ID: {task_id}")

    while True:
        time.sleep(POLL_SEKUNDEN)
        req = urllib.request.Request(f"{API_BASIS}/jobs/recordInfo?taskId={task_id}", method="GET")
        req.add_header("Authorization", f"Bearer {api_key()}")
        with urllib.request.urlopen(req, timeout=60) as r:
            status = json.loads(r.read().decode("utf-8"))
        daten = status.get("data", {})
        zustand = daten.get("state")
        print(f"  Status: {zustand}")
        if zustand == "success":
            break
        if zustand == "fail":
            sys.exit(f"Fehlgeschlagen: {daten.get('failMsg')}")

    ergebnis = json.loads(daten["resultJson"])
    urls = ergebnis.get("resultUrls", [])
    credits = daten.get("creditsConsumed", 0)
    return urls, credits


if __name__ == "__main__":
    print("Dieses Modul wird von generate_clips.py importiert, nicht direkt ausgefuehrt.")
