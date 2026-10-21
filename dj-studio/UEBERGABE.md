# Übergabe DJ Studio / DJ-Modus (Stand 21.10.2026)

Für die nächste Claude-Code-Sitzung. Zuerst diese Datei lesen, dann `README.md` in diesem Ordner.
Gesprächssprache: Deutsch. Seit 19.10. 00:05 ist der DJ-Modus auf **`main`**, seit 19.10. auch im
Café freigeschaltet (`YTM_DJ_ERLAUBT` für `zuhause` und `city-cafe`).

## 0. Neu am 21.10.2026 (Branch `dj-skins`, seit 21.10. auf `main`, Merge `4fb5f61b`)

Vollständig mit allen Werten in **`STAND.md`, Abschnitt „21.10.2026“**. Kurz, was ein Nachfolger
wissen muss:

| Thema | Wo | Einstellung / Wert |
|---|---|---|
| 13 Skins | `img/skins/<kürzel>.webp`, `js/skin.js` (`SKINS`, `METER_LAGE`, `LED_LAGE`, Flicken), `index.html` `YTM_DJ_SKINS`, Fernbedienung | Auswahl am Chef-Handy, Test `?tv&skin=gold`; Herstellung neuer Skins: `werkzeuge/README.md` |
| Kanal-Meter | `skin.js` `meterLagen()`, `ui/meter.js` `lage()` (data-lage am Canvas) | Gehäuse je Skin abgedeckt, 30 LEDs mittig, Clip-LED darüber |
| Master-Meter | dito | 25 Spalten auf dem gemalten Raster (je Skin gemessen) |
| GR-Säule | `skin.js` (`G`), `ui/mitte.js` `grFlaeche()` | 14 LEDs, gleicher Rand |
| Fader, MIX-Felder | Flicken `senk`/`fuellen` in `putzen()`, `STREIFEN_SKINS` | gemalte Kappe/Tasten weg, Kappe genau ausgeschnitten |
| Play-Taste | `css/skin.css`, `ui/deck.js` | spielt: Wellenfarbe (A blau, B orange); Pause: grün, blinkt alle 3 s |
| Tempo/Raster | `tv.js` `tempoVerfeinern()` | Tempo aus allen Bass-Einsätzen, Raster ±30 ms über den Song |
| Welle ruhig | `main.js` (jedes 2. Bild ab 75 Hz), `tv.js` `takt(bildZeit)`, `NACHZIEHEN_AB_SEK` 0,02, `NACHZIEHEN_TEMPO` 0,03 | Tempo 0,97–1,03 statt 0,72–1,24 |
| Anzeige-Vorlauf | `tv.js` `vorlauf()`, `localStorage 'studioVorlauf'` (s) | zuhause −0,05; Café: abgleichen (`AUFTRAG-W1.md`) |
| Pegel | `tv.js` `RESERVE_DB` 4,0, `anheben()` +3 dB bis −12 dBFS → 0 bei −3 dBFS | Anzeige wie vor −14 LUFS |
| Überblendung | Supervisor `ueberblenden()`, `XF_SEK` 9, `XF_VORLAUF_SEK` 6, `XF_TON_FENSTER_SEK` 2, `STILLE.einsatz` | Tonwechsel genau am Musikende (Log „Tonwechsel“) |
| Studio-Daten Ton | Supervisor → `window.nlTonGain[vid]` = `[gain, limiter, anfang, ende, einsatz]` | `ton[4]` neu |
| NEXT-Kanal | `tv.js` `takt()` | steht auf der START-Marke |
| Werkzeuge | `dj-studio/werkzeuge/` | Messen, Ausrichten, Tipp-Test |

## 1. Was der DJ-Modus ist

Die YouTube-Musik läuft wie immer (Dashboard + Supervisor + mpv, Ton über Bluetooth an die Anlage).
Im DJ-Modus zeigt der TV statt der Musik-Ansicht das **DJ Studio** (`dj-studio/?tv`), das Video
(mpv) sitzt im Videofenster in der Mitte. Das Studio spielt **keinen eigenen Ton** und lädt nichts;
es zeigt an, was läuft:

- Kanal „ON AIR“ = laufender Song, „NEXT“ = nächster Song; bei jedem Songwechsel übernimmt der
  andere Kanal, der alte läuft in der Blende aus, der Crossfader fährt im Ton-Fenster der Blende.
- Wellenform (wie die Fotos von Bild 2: stachelige Nadeln), BPM, Taktraster, Tonart (Camelot),
  Kanal- und Master-Pegel – alles **gemessen** vom Supervisor, nicht live abgegriffen.
- „Nächste Titel“ = Warteschlange.

Schalten: Musik-Fernbedienung → „⚙️ Anzeige & Anlage“ → **🎛 DJ-Modus** / ▭ Normal (nur Chef,
nur Raum `zuhause`). Am Test-Bildschirm per CDP: `ytmBefehl({was:'dj', id:'x'+Date.now()})`.

**Freigeschaltet nur für `raum=zuhause`** (`YTM_DJ_ERLAUBT` in `index.html`). Im Café wird das
Studio nie geladen.

## 2. Bausteine

| Teil | Wo | Was |
|---|---|---|
| Ebene `#ytm-dj` | `index.html` (`ytmDjRahmen`, `ytmDjSenden`) | iframe `dj-studio/?tv` erst beim Einschalten; Daten per `postMessage` jede Sekunde (jetzt, nächster, Schlange, Blende, Lautstärke, Lautheit je Song); Messungen je Song einmal (versionsbewusst). Erst senden, wenn das Studio `ytm-dj-bereit` meldet. |
| Videofläche | Supervisor `MUSIK_FLAECHE`, `FLAECHE["yt_dj"]` | mpv auf `#yt-dj-video` (Bild-2-Videofenster `[557,85,557,298]` × 1920/1672). |
| Messung „Studio-Spur“ | Supervisor `spur_messen`, `SPUR_*` | Im DJ-Modus: laufender Song zuerst, dann vorgeladene/nächste. Ein ffmpeg-Lauf (`-readrate 8`, ~25 s/Song): je 5 ms (200/s) Spitze/RMS L+R und Bänder tief/mitte/hoch; BPM (Autokorrelation, Sicherheit = beide Songhälften gleiches Tempo); Tonart (48 Halbton-Bandpässe → Krumhansl → Camelot). Ergebnis gz auf der Platte `~/.cache/citycafe/spuren/` (≤ 600 MB, `SPUR_VERSION` = 3). An die Seite: `window.nlStudioSpuren`. |
| Lautheit je Song | Supervisor → `window.nlTonGain` | `[gain, limiter]` wie `ton_zustand` für die relevanten Songs; Meter rechnen damit. |
| Position | Supervisor `window.nlMpvStandZeit` | Messzeitpunkt der mpv-Position; Studio liegt gemessen ±0,05 s bei mpv. |
| TV-Ansicht | `dj-studio/js/tv.js` | Kanäle, Blende, Position (weich nachziehen, Sprung > 0,8 s), Pegel (Reserve +1 dB, × Lautheit × Lautstärke³ wie mpv), Wellen-Anzeigewert `bildWerte` (50 % Lautheit, 20 % Bass, 30 % Höhen, je Song gespreizt), Taktraster auf der „Eins“ (`taktEins`). |
| Zeichnen | `js/ui/waveform.js` (`zeichneNadeln`, Kamm `KAMM_*`), `js/ui/meter.js` (`updateTv`), `js/ui/mitte.js` (`saeuleZeichnen`) | Nur bei `body.tv`; die Studio-Demo bleibt wie sie war. |
| Bild-2-Anpassungen | `js/skin.js` (Flicken, Option `tv`), `css/skin.css` | Kanal-Schriftzug geputzt → „ON AIR/NEXT“; Herz/Menü im TV geputzt; Titel 40 px, Künstler 30 px (21.10.); Play-Taste Kanal 2 (zweiter Strich fehlte in Bild 2); Fader-Licht nur ⅓ unter der Kappe; seit 21.10. Meter/Fader/MIX wie in Abschnitt 0. |

## 3. Gemessen / geprüft (PC zuhause, 18.10.)

- Wellenform passt zum Ton: Mitschnitt am Ausgang korreliert 0,92–0,95 mit der Messung.
- Position: Studio ±0,05 s bei mpv (vorher 0,3 s hinterher – behoben).
- BPM: Atemlos 127,7 (128), Macarena 103,2 (103); Songs ohne festen Takt → „~BPM“, kein Raster.
- Tonart: Akkorde C-Dur/a-Moll richtig; bei Songs **ungefähr** (nicht gegen sichere Werte geprüft).
- Rot an den Metern: über 11 Songs bei 100 % im Mittel ~5 % der Zeit, bei 80 % nie.
- Intro/Ausklang/Überblendung/Lautheit unverändert: 54/54 Songs vorher analysiert, 47 Blenden
  8,5–9,0 s, mpv `volume-gain` = Analysewert.

## 4. Test-Aufbau auf diesem PC (EndeavourOS, KDE)

Dieser PC ist die „Test-Box“ (Benutzer `citycafe` existiert, wird aber **nicht** benutzt).
Gestartet wird alles als `martin` in einer **sway-Sitzung im Fenster**:

- Server: `cd ~/City-cafe && python -m http.server 8090 --bind 127.0.0.1` (Branch `dj-studio`).
- sway: Konfiguration und Startskript im Scratchpad der Sitzung (`sway/config`, `sway/kiosk-test.sh`);
  Chromium mit eigenem Profil, `?kiosk=1&raum=zuhause&chefpin=…` (PIN aus privater Datei, nie im Repo),
  Supervisor aus dem Repo mit `CITYCAFE_RAUM=zuhause CITYCAFE_URL=http://127.0.0.1:8090/index.html
  CITYCAFE_BT_AUS=<scratch>/bt-aus CITYCAFE_MIX_COOKIES=0 CITYCAFE_COOKIES=chromium:<profil>
  CITYCAFE_JS_RUNTIME=deno` (kein Node auf dem PC; die beiden letzten Variablen sind neu, Standard
  wie bisher).
- YouTube: Im Test-Profil mit Google/YouTube angemeldet (sonst „Sign in to confirm you're not a bot“).
- Bluetooth: B03 Pro (70:B3:D5:91:38:62) am PC gekoppelt und vertraut; Wächter aktiv.
- Bildschirmfoto der sway-Sitzung: `WAYLAND_DISPLAY=wayland-2 grim -o WL-1 datei.png` (Nummer je
  nach Start; seit 21.10. liegt der ganze Test-Aufbau fest unter `~/.local/share/citycafe-test/`,
  siehe STAND.md). Genauer: CDP `Page.captureScreenshot` mit `clip` und `scale` (Bühnen-Koordinaten
  × Faktor aus `#buehne`-Rechteck).
- **Fallen:** ohne `raum=zuhause` hört ein lokales Dashboard auf die Café-Fernbedienung (Standard
  `city-cafe`)! Ohne Supervisor spielt der Browser-Player, und der darf die meisten Musikvideos
  nicht (YouTube-Fehler 150). Die volle Messgeschwindigkeit störte über WLAN den Bluetooth-Ton
  (gleicher Funkchip) – daher `-readrate 8`.

## 5. main

- 19.10. 00:05: Merge `dj-studio` → `main` (Commit `62a29550`), GitHub Pages liefert ihn aus.
  Vorher am Test-Bildschirm geprüft: Normal-, Vollbild- und DJ-Ansicht; Intro/Ausklang/Blende/
  Lautheit unverändert (54 Songs).
- Café-TV lädt die neue Seite, sobald keine Musik läuft; W1 bekommt den Supervisor um 8:30.
- Push durch Claude: nur nach Freigabe des konkreten Befehls über `/permissions`.
- Korrektur „Song startete ~47 s nach der Überblendung neu“ (Werbungs-Wächter, `nlWerbungPruefen`)
  ist mit drin; laut Betreiber trat der Fehler vorher auf `main` nicht auf.

## 6. Offen

1. **Überspringen** (selten, 2× am 18.10.): die Seite schaltet zweimal „Weiter“, der vorgeladene
   Song gilt als gespielt, der übernächste startet hart („Ueberblendung abgebrochen“). Ursache noch
   unbekannt; nicht der DJ-Code (der liest nur). Mitschreiber im Test-Bildschirm:
   `window.__wLog` (Hook auf `ytmWeiter`, nach jedem Neuladen neu setzen).
2. **W1:** erledigt am 19.10. – gemessen (DJ-Modus CPU 10–11 %, GPU 12 %, 60 fps, bis 58 °C),
   Vormessen fertig (703/703 um 14:02, inzwischen 707), `YTM_DJ_ERLAUBT` gilt auch für
   `city-cafe` (Werte in `STAND.md`). Die Fernbedienung zeigt beim Chef „🎛 DJ-Modus“ an.
3. Playlist-Pflege: „Theo, wir fahr'n nach Lodz“ und „Marmor, Stein und Eisen bricht“ (Stereoact)
   sollen aus Schlager, Après-Ski, Schlager 2024–2026 raus (am Handy, Chef im Café-Raum).
4. Ideen: Intro/Outro-Marker in der Welle, Countdown bis zum Mix + Taktzähler, Harmonie-Anzeige
   A/B, BPM/Tonart auf den Karten „Nächste Titel“, Gäste-Wunsch sichtbar, QR im DJ-Modus.

## 7. Grenzen

- YouTube ist keine Studio-Quelle: kein Download, kein Ton im Studio. Gemessen werden nur Zahlen
  (Wellenform, Pegel, BPM, Tonart) im Supervisor, wie schon Lautheit und Intro/Ausklang.
- Über dem mpv-Video liegt kein HTML.
- Kein Push nach `main` und keine Änderung am Live-W1 ohne Test und Freigabe des Betreibers.
