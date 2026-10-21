# Werkzeuge DJ Studio (21.10.2026)

Hilfsskripte, mit denen Skins, Meter, Tempo, Lautheit und Überblendung gemessen und eingestellt
wurden. Laufen am PC zuhause (EndeavourOS, Python 3 mit Pillow; GTK für den Tipp-Test). Werte und
Ergebnisse stehen in `STAND.md`, Abschnitt „21.10.2026“. Keine Zugangsdaten in diesen Dateien.

## Neuer Skin – Schritt für Schritt

1. **Vorlage prüfen:** dieselbe Oberfläche wie Bild 2 (alle Teile an derselben Stelle, 16:9).
2. **Hochrechnen auf 4K** – Real-ESRGAN ncnn-vulkan (offizielles Release v0.2.5.0,
   `realesrgan-ncnn-vulkan-20220424-ubuntu.zip`, Modell `realesrgan-x4plus`, läuft auf der Radeon):

   ```sh
   realesrgan-ncnn-vulkan -i vorlage.png -o x4.png -n realesrgan-x4plus -m models
   python -I -c "from PIL import Image; e=Image.open('x4.png').convert('RGB'); k=e.resize((3840,2160),Image.LANCZOS); k.save('NN_Name_4K.png',optimize=True); k.resize((1920,1080),Image.LANCZOS).save('NN_Name_FHD.png',optimize=True)"
   ```
   Ablage beim Betreiber: `~/Schreibtisch/skin dj/4K/` und `FHD/`, Originale nie überschreiben.
3. **Ausrichten auf Bild 2:**
   `python -I werkzeuge/ausrichten.py dj-studio/img/bild2.png NN_Name_4K.png ausgerichtet.png`
   – Ausgabe soll fast alle Stellen ≤ 1 px zeigen. Örtliche Entzerrung nur wenn nötig:
   `entzerren.py … ziel.png SIGMA`. **Kleine SIGMA (25–60) verbeulen Glanzflächen** (Chrom).
   Chrom wurde so gemacht: affin, dann `SIGMA 180`, dann noch einmal `SIGMA 100`.
4. **Einzelheiten prüfen** (Bildschirmfoto/Zoom): Play-Symbol Kanal 2 (Bild 2: zweiter Strich
   fehlt – Flicken mit `taste: true`), „+9“ der Master-Skala (bei Chrom aus Blau-Amber eingesetzt),
   Lage der VIDEO-LED (sonst `LED_LAGE` in `js/skin.js`).
5. **Ins Studio:** `im.save('dj-studio/img/skins/<kürzel>.webp','WEBP',quality=92,method=6)`
   (3840×2160). Eintragen: `SKINS` (js/skin.js), `YTM_DJ_SKINS` (index.html), Auswahlliste
   (yt-fernbedienung.html).
6. **Meter einmessen:**
   ```sh
   cd dj-studio
   python3 werkzeuge/meter_messen.py /tmp/mm.json      # Kanal-Gehäuse A/B, Master-Raster
   python3 werkzeuge/meter_tabelle.py /tmp/mm.json     # -> Zeilen für METER_LAGE
   python3 werkzeuge/gr_messen.py                      # -> G (GR-Säule) je Skin
   ```
   Neue Skins vorher in die Liste `skins` der drei Skripte eintragen. GR: bei heller Leiste oben
   die Oberkante von Hand prüfen (≈ 541).
7. **Ansehen:** Test-Kiosk, `ytmBefehl({was:'djSkin', skin:'<kürzel>', id:'x'+Date.now()})`,
   Bildschirmfoto der Bühne per CDP (`Page.captureScreenshot`, `clip` + `scale`): Meter, Fader,
   MIX-Felder, Play-Tasten, Crossfader, Jogs. Danach Cache aus und Studio neu laden, sonst sieht man
   alte Dateien.

## Mess-Skripte

| Skript | Wozu | Ergebnis 21.10. |
|---|---|---|
| `ausrichten.py`, `entzerren.py` | Skin auf Bild 2 legen | alle Skins ≤ 1 px |
| `meter_messen.py`, `meter_tabelle.py`, `gr_messen.py` | Meter-Gehäuse/Raster je Skin | `METER_LAGE` in skin.js |
| `tempo_verfeinern.py <id>` | genaues Tempo aus der Studio-Spur (wie tv.js) | z. B. 100,1 → 100,55 |
| `raster_pruefen.py <id> [bpm versatz]` | läuft das Raster über den Song weg? | vorher bis 280 ms, nachher ±30 ms |
| `position_pruefen.py` | Studio-Position gegen mpv (10 s) | −0,02 s im Mittel |
| `ausgang_mitschnitt.py` + `ausgang_vergleich.py` | Ton vor Bluetooth gegen die Spur | +53 ms, Korrelation 0,969 |
| `tipptest.py <ordner> <id>` | im Takt klicken → Verzögerung bis zum Ohr | ~90–110 ms (B03 Pro, aptX HD) |
| `lufs_messen.sh <ordner>/` + `lufs_auswerten.py` | Lautheit/Spitze vieler Songs, Ziel durchrechnen | −14 LUFS: 79/79 in ±1,5 dB |

Hinweise:
- `ffmpeg` in Schleifen immer mit `-nostdin`, sonst liest es die Eingabeliste mit.
- Aufnahme vom Ausgang mit `parec … --latency-msec=10` (pw-record lieferte falsches Format).
- mpv meldet die Position in Videobild-Schritten (24 fps = 42 ms) – Tipp-Test deshalb nur ±40 ms.
- Ein Song nach dem anderen messen: volle Geschwindigkeit über WLAN stört den Bluetooth-Ton.
