# City Cafe Halloween 2026 – zwei 60s-Horror-Videos

Projekt zur Erstellung von zwei zusammengehörigen, 60 Sekunden langen
Halloween-Werbevideos (1920×1080, 30fps, H.264/AAC) für das City Cafe
Klagenfurt, auf Basis des mitgelieferten Halloween-Plakats.

## Status (Endstand)

- [x] 6 KI-Clips (kling/v2-5-turbo-image-to-video-pro, je 10 s, nativ 1920x1080/24 fps): 504 Credits = 2,52 $, kein Neuversuch
- [x] Video 1 "The Halloween Nightmare" und Video 2 "The Haunted City Cafe": je exakt 60,000 s, 1920x1080, 30 fps konstant, H.264 High, ca. 28 MB, kein Schwarz, keine Standbilder
- [x] Kein Ton (laut Auftrag): Videos enthalten keine Audiospur; die _MUTE-Dateien sind inhaltlich identische Kopien
- [x] Loop: letzte 12 Frames werden auf den ersten Frame zugeblendet (Rest-Abweichung im Export ist Encoder-Rauschen)
- [x] Freigegeben und im Medien-Widget eingebaut (Widget-Version 1280x720 liegt auf `main`)
- Hinweis: Die grossen Final-MP4s (je ca. 28 MB, 1080p) und die KI-Rohclips liegen bewusst NICHT im Git. Die Rohclips (`generated/`) sind nur lokal vorhanden; ohne sie muessten die 6 Clips neu bestellt werden (2,52 $).

## Bekannte Grenzen (ehrlich)

- Kling liefert 24 fps; fuer 30 fps wird per Frame-Wiederholung angepasst.
- Bühnen-Sequenz (1,35x) und Jumpscare-Lunge (bis 3,4x) sind aus 1080p-Material herangezoomt, daher weicher als der Rest.
- Wiedergabe unter Chromium/Fernseher wurde hier nicht getestet (Standard-H.264/yuv420p/faststart).

## Ablauf neu rendern (ohne API-Kosten)

```bash
venv/bin/python3 scripts/assemble.py video1 --out output/video1_roh.mp4
venv/bin/python3 scripts/assemble.py video2 --out output/video2_roh.mp4
venv/bin/python3 scripts/export_und_pruefen.py
```

## Nutzung

```bash
# Preisrechner (kein API-Aufruf)
venv/bin/python3 scripts/preisrechner.py

# Kostenlosen lokalen Effekt-Test rendern
venv/bin/python3 effects/local_effects.py --sekunden 8 --out previews/test.mp4
```

Der kie.ai-Key wird ausschließlich aus der Umgebungsvariable `KIE_API_KEY`
gelesen, nie aus einer Datei im Repo.

## Struktur

- `assets/` – wiederverwendbare Rohmaterialien
- `reference/` – Mastervorlage (Plakat)
- `generated/` – von kie.ai erzeugte Rohclips (lokal zwischengespeichert, wiederverwendbar)
- `effects/` – lokale Effekt-Skripte (Nebel, Flackern, Jumpscare-Compositing)
- `audio/` – Sound-Assets und Mix
- `scripts/` – kie.ai-Anbindung, Preisrechner, Schnitt/Assembly
- `config/` – zentrale Konfiguration (`config.json`, `clips.json`)
- `previews/` – Testrenders, Kontaktbögen
- `output/` – fertige Endvideos
