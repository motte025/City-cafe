# Stand des Projekts

Diese Datei beschreibt, wo City-Cafe gerade steht. Sie ist die Übergabe an die
nächste Arbeitssitzung und lässt sich auch als Ganzes in ein neues Gespräch
kopieren. Wer hier etwas Größeres ändert, hält sie nach — sie soll den heutigen
Stand beschreiben, nicht den von vorgestern.

**Windows-Sitzung (mit `ssh w1`): zuerst `UEBERGABE-WINDOWS.md` lesen** – was am 21.10. passiert ist
und was am W1 zu tun ist.

Letzte Durchsicht: 28. Oktober 2026 (DJ-Modus: Videos als HLS und vorab auf der Platte, seit 27.10. 08:31
live; am 27.10. fielen ab 08:40 alle Überblendungen aus – Ursache war ein Prüfbefehl der Windows-Sitzung,
seit dem Neustart 28.10. 08:30 behoben – alles im Abschnitt „27./28.10.2026“ und „26.10.2026“).
Davor, 23. Oktober 2026 mittags (DJ-Skin **Thunderstorm** mit Wolken und Blitzen nach der
Musik; W1: Takt mit madmom, solange beat_this fehlt, Bluetooth aptX Low Latency, Ton aller
Playlist-Songs bleibt auf der Platte, Messen trotz YouTube-403 – alles im Abschnitt „23.10.2026“).
Davor, 21. Oktober 2026 abends (alles auf **`main`**, letzter Stand `f065dfcd`; DJ-Werbung
unter „Pioneer DJ“ am Chef-Handy einstellbar, Master-Knopf wie im Bild, Chrom-LEDs, 804 Takt-Dateien;
13 Skins fürs DJ Studio mit Auswahl am Handy, Meter/Fader/MIX-Felder pixelgenau, Überblendung fest
9 s genau am Musikende mit Einsatz nach leisem Intro, Lautheit −14 LUFS, Messwerte je Song auf der
Platte, Welle ruhig, Tempo genau, **Schläge und Takt-Eins mit beat_this** (446 Takt-Dateien im Repo,
Supervisor kann selbst rechnen), Lyrics-Suche, Handy-Songs werden nie getauscht – alles im
Abschnitt „21.10.2026“, nächste Schritte dort unter „Als Nächstes“). Davor, 19. Oktober (DJ-Modus im Café freigeschaltet, W1 gemessen und
Systemupdate repariert, alle Playlist-Songs vorgemessen; Musik-Fernbedienung: Zurück-Taste
Schritt für Schritt, ⏮ zum Song davor, Radio-Mix löschen/übernehmen, Suche nach Aufrufen,
DJ-Modus sichtbar – Details in den Abschnitten vom 18./19.10.). Davor, 16. Oktober (Musik: Lautstärke nach LUFS für alle Songs
gleich, Limiter höchstens 2 dB, Test mit 458 Playlist-Songs; Überblendung 4/6/9 s
mit DJ-Kurve; Limiter/Blende am Chef-Handy; Neuladen startete alten DJ-Befehl
und gestoppte Musik neu – behoben und am TV getestet; Dauersuche begrenzt;
Fernbedienung mit Startseite aus Kacheln, Musik-Steuerung aufgeräumt; alter
Screen „spieltest-x" gelöscht; große Folie mit Rahmen und Ambilight, Plakate
Jägermeister/Spirituosen, Werbe-Einstellungen erweitert, A−/A+ in der
Übersicht; Roulette-Helligkeit untersucht). Davor, 15. Oktober: GitHub-Token getauscht; Chef-Übersicht
als fünfter Reiter der Fernbedienung; Werbung: große Folie „Demnächst bei uns",
Termine/Aktionen rund um den Musik-Player in Vollbild und normaler Ansicht,
Werbe-Schalter am Chef-Handy, `werbung.json`; QR „Song wünschen" öffnet nur
noch die Musik-Fernbedienung; Firebase-Regel `werbung` eingetragen – alles am
TV mit Bildschirmfotos geprüft). Davor, 9. Oktober: YouTube-Musik Playlists 1–4
mit Titeln, QR „Song wünschen" schaltbar, YouTube Shorts in der rechten Karte.
Davor, 5.–7. Oktober: DJ-Übergänge per Studio-Abgleich, offizielle Videos
überall, Playlists bearbeiten/erstellen am Handy, Playlists 5–8, Aufrufe,
Bluetooth-Wächter, Tailscale, zweiter B03 Pro gekoppelt, Roulette-Werbung
und Musik-Empfehlung entfernt, ODROID weg, Roulette-Spielmodus im Dashboard
und wieder in der Rotation.

## 31.10.2026: Halloween-Modus (heute 18:00 – 01.11. 02:00)

- Am Chef-Handy (Übersicht, ganz oben „🎃 Halloween-Modus“): Automatisch (ab 18:00) / Jetzt an / Aus, Video 2–5 min
  (Vorgabe 3), Angebot 30/45/60 s (Vorgabe 45), bis zu 3 YouTube-Links. Gespeichert unter
  `djremote/<raum>/werbung/einstellung/halloween` (bestehende Werbe-Regel, keine neue Firebase-Regel).
- Am Screen (`hwAktiv`, `hwPruefen`, `runHwAngebotState` in `index.html`): nur Halloween-Video (Nightlife-Slot mit mpv, Start 0)
  → Berliner Luft → 5× Jägermeister (`jaegermeister_aktion_tv.jpg`) → nächstes Video. Oben Halloween-Band statt Bundesliga,
  rechts nur Drive-Fotos, unten Halloween-Meldungen, Hintergrund lila. Endet fest am 01.11.2026 02:00.
  `?halloweenmodus=1` zeigt ihn zum Ansehen.
- Videos: W1dFFpXpxKM (Haunted Pirate Harbor), q0Gn6s-7nFk (Witches’ Halloween Night), beide 24/7-Livestreams; auf W1
  getestet: HLS 1080p, Bild nach 2 s. Der dritte Link fehlte noch.
- **Nach dem Event entfernen** (zusammen mit dem alten Halloween-Slot vom 19.10.).

## 27./28.10.2026: Überblendungen am 27.10. ausgefallen – Ursache ein Prüfbefehl (Windows-Sitzung)

**Fehlerbild** (Tagesbericht 27.10.): 102 Überblendungen begonnen, nur 1 fertig (08:35). Ab 08:40 jedes Mal
„Ueberblendung abgebrochen …: kein Bild nach 15 s“ bis Betriebsschluss. Die Musik lief weiter, aber ohne
Überblendung: Der alte Song spielte bis zum Ende, dann startete der nächste neu.

**Ursache:** Nach der Überblendung um 08:35 hat die Windows-Sitzung zum Prüfen
`sudo socat - /tmp/mpv-nl-xf.sock` aufgerufen. Der Socket war nach dem Wechsel schon auf `/tmp/mpv-nl.sock`
umbenannt. socat legt einen fehlenden Pfad als **normale Datei** an, hier mit sudo also **root**. In `/tmp`
(Sticky-Bit) können weder der Supervisor (`os.remove`) noch mpv diese Datei als `citycafe` löschen. Jeder
neue Überblendungs-mpv meldete deshalb „Could not bind IPC socket“ (`~/mpv-xf-mpv.log`), der Supervisor
bekam keine Antwort, und nach 15 s brach er ab. Das Bild von der Platte war nicht schuld: mpv zeigte das
erste Bild nach 0,2 s.

**Behoben** durch den Neustart beim Update 28.10. 08:30, weil `/tmp` dabei geleert wird. Am Code ist nichts
falsch. Neue feste Regel unten: mpv-Sockets nur mit `UNIX-CONNECT:` ansprechen.

**Sonst am 27.10.:** 3 Hänger (19:58, 20:39, 21:59, jeweils zurück zum Browser-Player), Takt 2× nicht
gerechnet (09:04/09:07, Code 2/3), keine Notbremse, höchstens CPU 69 °C. Das Bild-Vorladen lief: 30 Videos
(6–91 MB) lagen in `~/.cache/citycafe/bild`.

**28.10. bis 14:50:** Kein Musikbetrieb, nur die Rotation (Twitch und YouTube-Auftritte), keine Fehler.

**Test 28.10. nachmittags:** `ueberblenden()` aus dem installierten Supervisor mit zwei echten mpv ohne Fenster
und Ton (eigene Sockets) – neuer Song sofort geladen, Ton übergeben, „fertig“, kein Fehler.

**Musikabend 28.10. ab 18:40 (überwacht bis 29.10. 02:04):** 131 Überblendungen, **alle fertig**, 0 abgebrochen,
0 Hänger, 0 Notbremse. 189 Videos vorab auf die Platte geladen, 1× nicht (YouTube-Bremse „rate limit“ 20:53,
lief dann aus dem Strom, Überblendung trotzdem fertig). Damit sind HLS und Bild-Vorladen bestätigt.

**Noch offen:**
- Die 2 Takt-Fehler vom 27.10. (ExgfgiW-BJI, DN-b7JDfDBE) prüfen, falls sie wiederkommen.

## 26.10.2026: DJ-Modus ohne Bild seit 23.10. ~22 Uhr – Videos jetzt als HLS (Windows-Sitzung)

**Fehlerbild** (Tagesberichte 23./24.10.): 83 bzw. 103× „mpv ohne erstes Bild nach 20s“,
47/45 Überblendungen abgebrochen („kein Bild nach 15 s“), Musik fiel auf den Browser-Player
zurück. Erster Fehler 23.10. 21:58:54.

**Ursache** (mpv-Log `~/mpv-haenger/1024-202315-nl.log`):
- Die einzelnen https-Ströme (DASH, `c=TVHTML5`) lehnt YouTube außerhalb von yt-dlp mit **403** ab
  – für curl, mpv und den Zwischenhändler, auch mit yt-dlp-Kopfzeilen.
- Bei anderen Songs wählte yt-dlp schon HLS (m3u8 von `manifest.googlevideo.com`), aber der
  Zwischenhändler (`ueber_zwischenhaendler`) reicht die Liste ohne Endung `.m3u8` weiter → ffmpeg:
  „Not detecting m3u8/hls with non standard extension“, die Stücke scheitern.

**Lösung** (`kiosk/nl-mpv-supervisor.py`):
- `HLS = "[protocol^=m3u8]"`: `FORMAT`, `format_waehlen()` und `musik_format()` nehmen zuerst Bild **und**
  Ton als HLS, danach die alten Stufen.
- `ueber_zwischenhaendler()` gibt HLS-Adressen unverändert an mpv.
- Getestet auf W1 an 7 betroffenen Songs: alle spielen direkt, 960–1080p, Ton aac.
- Der Ton kommt bei Musik weiter von der Platte (`--audio-file`), wenn er schon geladen ist.

- Takt (`takt_rechnen`) holt den Ton jetzt über `mess_ton()` als Datei. Vorher kam er bei Songs ohne
  geladenen Ton über den Zwischenhändler, mit 403 („Takt …: nicht gerechnet (Code 2/3)“, 23.–25.10.).
- Die Notbremse am 24.10. (LQ7R9zHeDy8, 2×) und die Hänger („stockt 0.0 s in 8 s“) kamen in derselben
  Zeit – vermutlich dieselbe Ursache, im Betrieb beobachten.
- Songs aus der Suche (nicht vorgemessen, kein Ton auf der Platte) laufen genauso: Bild und Ton als HLS direkt.

- **Bild von der Platte** (`bild_laden`, `bild_datei`, `bild_quelle`, `bild_aufraeumen`, Ordner
  `~/.cache/citycafe/bild`, die letzten 100 bleiben – seit 31.10., vorher 30): Auch HLS liefert YouTube zeitweise zu langsam. Am 26.10.
  abends gab es 2 Hänger („stockt“, einmal zurück zum Browser-Player), und eine Überblendung wartete 8,9 s.
  Schon Minuten vorher (Liste `analyse` der Seite, die nächsten 2 Songs, `bild_vorab`) und spätestens beim
  „Naechster Song vorgeladen“ (kommt erst 40 s vor Schluss) lädt yt-dlp jetzt das Bild (dasselbe itag, `-N 4`) ganz herunter, mpv
  spielt es von dort. Ist es nicht fertig, läuft es wie vorher über den Strom.
  Gemessen: 28 MB 1080p in 88 s (26.10. abends), 99–164 MB in 7–10 s (27.10. morgens).
  **Live seit Update 27.10. 08:31**: Überblendung 08:35 spielte `~/.cache/citycafe/bild/Iy-9YFqNS_w.mp4`.
- Hänger-Erkennung: Rücksprung (neuer Song, Zurück am Handy) gilt nicht mehr als „stockt“
  (Fehlalarm 26.10. 21:01, „stockt: -188.3 s“).
- Abend 26.10. (vor dem Bild-Vorladen): 19:00–21:01 waren es 10 Hänger, 1 Notbremse und mehrere „Laden langsam“,
  von 21:01 bis 08:30 dann nur 1 Notbremse (07:08). Dartcam: 6 kurze Hänger (WLAN-Aussetzer, Ping bis 1 s).

Supervisor auf W1 am 26.10. um 16:03 und 16:05 ohne Rechner-Neustart ersetzt (Dart-Modus lief, keine Musik).
Tagesbericht 27.10.: siehe Abschnitt „27./28.10.2026“ (Überblendungen fielen aus, nicht wegen dieser Änderung).

## 26.10.2026: Dart-Abend (verschoben) und Dartcam ohne Ruckeln (Windows-Sitzung)

- **Dart-Modus von Hand:** Das Spiel wurde auf heute verschoben. Die Liga-Seite (KEDSV) trägt
  Verschiebungen nicht ein, also kennen weder `dart_liga.json` noch das Apps-Script den Termin.
  - Angenommen: Runde 4 Chaoten – DC Fighting Penguins „Waddling Arrows“ (eigentlich 31.10.).
  - Eingeschaltet mit `?dartabend=1` an der TV-Adresse (per CDP). Das bleibt bis zum nächsten Neuladen
    ohne den Parameter, und es endet **nicht** von selbst.
  - Das Apps-Script läuft einwandfrei (Testlauf vom Betreiber, „Keine Aenderung“). Live-Ergebnisse gibt es
    erst, wenn das Spiel auf der Liga-Seite eingetragen ist.
  - **Schalter am Chef-Handy** (Commit `859619c8`): In der Chef-Zentrale „🎯 Dart-Abend“ gibt es An / Aus /
    Automatisch, gespeichert in `djremote/<raum>/dartabend` als `{ modus, tag }`.
    - Der Screen hört darauf (`dartSchalterHoeren`, `dartErzwungen`) und schaltet ohne Neuladen um.
    - Gilt nur für den Dart-Tag bis 04:00. `?dartabend=1/0` hat Vorrang.
    - Am 26.10. auf „An“ gesetzt und die TV-Seite ohne `?dartabend` neu geladen: Der Dart-Modus blieb an.
    - **Firebase-Regel** `dartabend` (nur Chef-Geräte) steht in `docs/musik/firebase-regeln.json`, muss aber
      noch in der Firebase-Konsole eingetragen werden. Bis dahin greift `$sonst`, dann dürften alle
      Angemeldeten schreiben.
    - Das Apps-Script kennt den Schalter noch nicht, Live-Takt dort also nur an Spieltagen laut Liga-Seite.
- **Dartcam stand alle paar Minuten** (heute 3× in 25 min, am 10.10. 15×) **und ruckelte:**
  - Ursache sind die Zeitstempel der TP-Link: In 20 s springen sie ~20× um bis 0,45 s, 18× rückwärts.
    mpv hielt bei jedem Sprung an. Das Netz ist es nicht (Ping 5 ms, 0 Verlust).
  - Jetzt `--correct-pts=no --container-fps-override=25`: feste Bildrate aus dem Puffer.
  - Das Tempo läuft nach dem Puffer mit (`cam_tempo`: 0,98/1,02 bei unter 60 % bzw. über 140 %), denn
    die Kamera liefert ~24,8 Bilder/s.
  - Standbild-Erkennung 20 → 8 s.
- **Puffer 3 → 1,5 s** (`CITYCAFE_CAM_CACHE_SECS` in `citycafe.env` auf 1.5 gesetzt). Die Verzögerung
  des Bildes ist damit halbiert.
- **Hauptstrom** `stream1` (2688×1520, 25 Bilder/s, über die GPU mit vaapi, mpv ~10 % CPU) statt `stream2`
  (1280×720). Betreiber: scharf am 1080p-TV.
- **Gemessen:**
  - Unsichtbare Vergleiche auf dem W1: fest 25 Bilder/s 0 Stocker gegen 2 mit Kamera-Zeit, 1 s Puffer
    2 min ohne Stocker.
  - Im Betrieb seit 14:59 über 25 min: 0 Stocker, 0 verlorene Bilder, kein Aussetzer.
- Eingespielt ohne W1-Neustart: Supervisor per PID beendet und mit der Umgebung von sway neu gestartet.
  Ein Neustart des W1 hätte `?dartabend=1` verloren. Commits `fdecb477`, `27d7d537`, `8370c720`, `aae9de28`.

## 23.10.2026: Skin „Thunderstorm“, Takt mit madmom, Bluetooth aptX LL, Ton behalten (Windows-Sitzung)

Alles auf `main`. Neuer DJ-Skin **Thunderstorm** (`skin=gewitter`): Wolken und Blitze laufen nach der
Musik. Am W1 misst madmom den Takt, solange das beat_this-Modell fehlt. Zum Messen lädt yt-dlp den Ton
in eine Datei, denn direkte Ton-Adressen lehnt YouTube seit heute mit 403 ab. Der Ton aller
Playlist-Songs bleibt auf der Platte, und der Bluetooth-Empfänger läuft mit aptX Low Latency.

### Thunderstorm: was wo liegt

- **Skin:** `dj-studio/img/skins/gewitter.webp` (Bild „Gewitter 2“ vom Betreiber, mit Real-ESRGAN auf
  4K gerechnet und mit `ausrichten.py` auf Bild 2 ausgerichtet). In `skin.js` heißt er `'gewitter': 'Thunderstorm'`,
  `METER_LAGE` wie Onyx. Am Chef-Handy steht er als „⛈️ Thunderstorm“, auf der TV-Seite in `YTM_DJ_SKINS`.
  Die Vorschauen Gewitter 1 (dezent) und 3 (kräftig) sind nicht im Repo.
- **Effekt:** `js/gewitter.js` → `gewitterBuehne(container, optionen)`. Dieselbe Datei hat auch
  `gewitterStarten` für die Wetter-Widgets, und das läuft unverändert. `dj-studio/js/main.js` lädt
  sie nur bei `skin=gewitter…` und gibt ihr die Messwerte (siehe unten).
- **Bilder:** Wolken `dj-studio/img/wolken/w1–8.webp` (vom Betreiber mit ChatGPT, auf Schwarz,
  freigestellt, 1280 px breit). Foto-Blitze `dj-studio/img/blitze/n1–7.webp` (ChatGPT, Vorgabe „ohne
  Leuchten“, 941×1672, **exakt freigestellt**: Deckkraft = hellster Kanal, Farbe = Bild/Deckkraft,
  **nicht** hochskaliert).
- **Messwerte aus der Spur** (`dj-studio/js/tv.js`, nur am TV): `engine.bassPegel()` (Tiefen),
  `engine.melodiePegel()` (Mitten/Höhen), `engine.spannung(4)` (Lautheit jetzt und in den nächsten
  4 s, im Verhältnis zu den lauten Teilen des Songs), `engine.drops()` (Drops und Refrains, vorab aus
  der ganzen Spur berechnet). In der Vorschau ohne Spur kommen Bass und Melodie aus dem Spektrum.
- **Takt:** `main.js` `takt()` gibt den Schlag des hörbaren Decks. Mit Taktmessung kommt er **aus den
  gemessenen Schlägen** (`grid.zeiten`, Binärsuche). Ohne Taktmessung kommt er aus Tempo und Startpunkt
  der Spur, der kann bei manchen Songs einen halben Schlag daneben liegen.

### Thunderstorm: wie Wolken und Blitze funktionieren

Alles läuft in `gewitterBuehne` in jedem Bild (`requestAnimationFrame`) auf zwei Canvas-Ebenen über
dem Pult: **Wolken** normal deckend, **Licht und Blitze** mit `mix-blend-mode: screen`, also wird nur
heller gemacht. Das Videofenster (`frei`) bleibt immer frei, das Kopffeld „CITY CAFE“ ist frei von
Wolken (`wolkenFrei`).

**Phasen** (`modus`):
- `ruhig`: nur kleine Melodie-Blitze und selten Wetterleuchten (alle 12–20 s).
- `mittel` (8 Takte nach einem Klangwechsel ohne Bass, also Aufbau): mittlere Blitze, alle 2 Takte ein
  mittlerer auf der Eins.
- `voll` (8 Takte nach Drop, Refrain oder sehr kräftigem Bassschlag): Blitze auf den Schlägen (große
  bevorzugt auf 1 und 3), alle 2 Takte ein großer auf der Eins.

Der Bass zählt **im Verhältnis zum Song** (`bassMax`, ~50 s Gedächtnis). Mit festen Grenzen kamen leise
Bass-Songs nie in `voll`, andere lösten bei jedem Schlag einen Drop aus.

**Blitzarten:**
- **klein** (Melodie): eine neue Note in Mitten oder Höhen (relativ zum Song) → ein kurzer, schwacher Ast
  aus einer Wolke. Höchstens alle 2,5 Schläge.
- **mittel/groß** (gezeichnet, `blitzBaum`): Sie kommen aus einer sichtbaren Wolke, meist nach unten,
  manchmal quer.
  - Große höchstens 1 pro Takt (zu viele fallen weg).
  - Mittlere höchstens alle 2 Schläge.
  - 0,3 s voll, dann lösen sie sich in 1,4 s von oben nach unten auf (dünner, blauer).
- **Foto-Blitz** (nur bei Drop und Refrain):
  - **Drop:** Er kommt genau zum vorab berechneten Zeitpunkt. Drop = Bass setzt nach mindestens 4 s
    fast ohne Bass kräftig ein. In 7 von 10 Fällen kommen 2 Blitze, einer links und einer rechts vom
    Videofenster.
  - **Refrain:** Der Song wird deutlich lauter (4 s davor unter 80 %, 4 s danach über 95 % seiner
    lauten Teile). Höchstens 1 pro Minute, nicht näher als 20 s an einem Drop, in 4 von 10 Fällen zwei.
  - **Ablauf:** 0,8 s stehen (zweimal flackern, nur dasselbe Bild), dann in 1,15 s weich von oben nach
    unten wegwischen.
  - **Lage:**
    - Er kommt aus einer **eigens gesetzten Wolke**. Der Startpunkt im Bild wird beim Laden gesucht
      (`obenX`), und die Wolke bleibt voll sichtbar, bis der Blitz weg ist.
    - **Gedreht** um den Startpunkt, von senkrecht bis liegend, immer zur Bildmitte hin; zufällig gespiegelt.
    - Liegende setzen am Bildrand unter dem Videofenster an.
    - Größe: Pixel für Pixel wie das Foto, nur verkleinert (Bildhöhe 1080, höchstens 60 % Breite),
      vorab beim Laden in Halbschritten mit hoher Qualität.
  - **Licht:**
    - Hinter dem Blitz ein schmaler dunkler Saum (die Blitzform verwischt).
    - Die Wolke am Blitz leuchtet am stärksten auf, alle anderen Wolken etwas, bei 2 Blitzen anteilig.
    - Das Pult wird kurz heller (ganzes Bild etwas, rund um den Blitz deutlich), im Takt mit dem Flackern.

**Wolken:**
- 13 Stück (Variante 2), echte Wolkenbilder, ziehen von links nach rechts, verschieden groß, schnell
  und zufällig gespiegelt.
- **Menge und Deckkraft nach der Spannung:** Maßgeblich ist der höhere von zwei Werten: Lautheit jetzt
  oder in den nächsten 4 s.
  - Ruhig: ~70 % der Wolken bei 30 % Deckkraft (blass, aber immer da für die kleinen Blitze).
  - Spitzt sich der Song zu: kräftig, im vollen Teil +30 %.
  - Kommt in < 4,5 s ein Drop oder Refrain: sicher voll.
  - Neue Wolken blenden in 1,5 s ein, überzählige blenden aus.

**Testen:**
- Lokale Testseite `gewitter-test/` (nicht im Repo, mit 24 Songs, Ton und Messdaten).
- `djStudio.gewitter.buehne` hat `zustand()` (Phase, Zähler, Dichte, Schlag), `fotoBlitz(nr)`,
  `zeitlupe(5)` und `halten(ms)` (Standbild).
- Testläufe im unsichtbaren Chrome (24 Songs × 2 min): Drops alle mit Foto-Blitz, Wolken 3,5–4 s vorher
  voll, 1 Foto-Blitz ohne Anlass in 48 min, große Blitze 13–25 je Minute im vollen Teil.
- **Schläge** (gegen die gemessenen Schläge): mit Taktmessung 76 % unter 50 ms neben dem Schlag
  (Median 30 ms); ohne Taktmessung je nach Song gut oder ~½ Schlag daneben.
- Auf dem W1 (unsichtbarer Chromium, GPU): **60 Bilder/s, 0 Ruckler** im vollen Teil mit Foto-Blitz.
  Der Kiosk-Chromium nutzt die GPU (Radeon 780M). Testdateien liegen in `~/gewittertest` (41 MB, löschbar).
- Der Café-TV ist **1080p** (Samsung meldet nur 1920×1080), Hochskalieren bringt nichts.

### W1 am 23.10.

- **Bluetooth:** Der Ton geht per Bluetooth an den Empfänger **B03 Pro** am Verstärker (nicht über HDMI).
  - Mit LDAC kam er ~150–250 ms nach dem Bild; jetzt **aptX Low Latency** (~40 ms).
  - `bt_codec_pruefen` prüft alle 5 min ohne Musik und stellt bei Bedarf um. WirePlumber merkt sich
    den Codec auch über einen Neustart.
  - Von Hand: `pactl send-message /card/bluez_card.70_B3_D5_91_30_7A/bluez list-codecs` /
    `switch-codec <nr>`.
- **Takt:**
  - Das Modell `final0` (Uni-Server JKU) fehlt weiter (503). Probiert wird nur noch einmal pro Stunde,
    vorher bei jedem Song.
  - Bis dahin misst **madmom** (CPJKU, Modelle im Paket) in eigener Umgebung
    `~/.local/share/citycafe/madmom-venv` (aus dem offiziellen GitHub). Dateien haben `"m": "madmom"`.
  - An „Animals“ verglichen: Schläge im Mittel 20 ms neben beat_this, Eins in 96 von 114 Takten gleich.
    ~30 s je Song.
- **403 bei Ton-Adressen:**
  - Seit 23.10. lehnt YouTube die googlevideo-Adressen für Ton allein (Client TVHTML5) außerhalb von
    yt-dlp mit 403 ab, auch über den Zwischenhändler. Damit scheiterten Wellenform, Lautheit und Takt
    neuer Songs (Takt „Code 2“).
  - Jetzt `mess_ton()`: der geladene Ton, sonst lädt yt-dlp ihn. Abspielen war nicht betroffen.
- **Ton behalten** (Betreiber):
  - Beim Messen bleibt der Ton im Ton-Ordner, ~6 MB je Song, ~4 GB für alle 701 Playlist-Songs.
  - Weg kommt, was in keiner Playlist mehr steht und älter als 7 Tage ist (die letzten 40 bleiben).
  - Unter 10 GB frei: nur ein Zwischenordner.
  - Ton für schon gemessene Songs lädt er **noch nicht** nach. Auf Ansage des Betreibers einbauen:
    Vormessen auch bei fehlendem Ton, Mix 2 und Schlager 2024–2026 zuerst.
- **Vormessen-Reihenfolge:** Warteschlange, dann **Mix 04.10.2026 (2)**, dann **Schlager 2024–2026**
  (`VORMESS_ZUERST`), dann laufende Playlist, Schlager, Rest.
- **Playlists:**
  - 8 Listen, 1437 Einträge, **701 verschiedene Songs**; 654 haben Takt aus beat_this, der Rest
    kommt mit madmom.
  - Mix 04.10.2026 (2) bekam 16 Testsongs dazu (jetzt 211). Sie wurden über die Datenbank angehängt
    wie vom Chef-Handy, und gleich eingelesen.
  - Sicherung der Liste davor: Desktop `dj gewitter/mix2-sicherung-vor-testsongs.json`.
- **Erster Tagesbericht** `berichte/W1-2026-10-22.md`: 55/55 Blenden, CPU höchstens 76 °C,
  4 Hänger vor dem Zwischenhändler, 2 git-Sperren in der Notfall-Kopie. Die Sperren entstanden bei
  Neustarts mitten im Abruf und lösen sich nach 10 min selbst.
- Commits: `bf1e2bf1`, `be17776c`, `67cd3c33`, `debfaf62`, `775562d2`, `e5fcceae`, `7279d922`.
  Jedes Update startet den W1 neu (nur ohne Musik). raw.githubusercontent liefert einige Minuten lang
  noch die alte Datei, dann das Update wiederholen.

## 22.10.2026: Fehler vom Café-Abend 21.10. behoben (Windows-Sitzung)

**W1-Update 21.10. 15:58 lief durch:** `XF_SEK = 9`, `LAUT_ZIEL_LUFS = -14.0`, TV-Seite `object 9`.
Die Überblendungen am Abend waren sauber (Tonwechsel ≤ 0,15 s neben dem Musikende). Offen bleiben
die Endstufe +3 dB und der Abgleich der Welle (Aufgabe 2).

Im Log vom Abend standen drei Fehler:
- **Songs „im Kreis“:** Der Betreiber hat die Playlist 4× gestartet (16:03, 16:13, 18:13, 21:25),
  und sie kam jedes Mal ab Nr. 1 in derselben Reihenfolge. **So gewollt, nicht automatisch
  mischen.** Der Betreiber ordnet die Playlists selbst, gemischt wird nur mit der Taste in der
  Fernbedienung. (Das Mischen beim Start aus 8104b818 ist wieder raus.)
- **mpv hing zweimal** (20:57 bei 61 s, 21:21 bei 27 s). Danach kam der Browser-Player, ~30 s
  Stille und ein Sprung zum nächsten Song; um 21:21 folgte am Handy ein Durcheinander bis zum
  Neustart der Playlist. Die Ursache steht nicht im Log, im Systemlog gibt es nichts
  (vermutlich ein YouTube-Strom). **Jetzt startet der Supervisor mpv bei Musik einmal an
  derselben Stelle neu** (`fortsetzen`, höchstens 1× je Song in 5 min). Erst ein zweiter Hänger
  fällt auf den Browser-Player zurück. Den Grund der Hänger sagt nur das mpv-Log, und das wird bei jedem
  Start überschrieben. **Bei jedem Hänger werden jetzt `mpv-nl.log`/`mpv-xf.log` nach
  `/home/citycafe/mpv-haenger/` gesichert** (die letzten 20; Supervisor-Log: „mpv-Logs gesichert“).
- **DJ-Modus lud die Studio-Spuren im Dauerlauf** (2× je Sekunde von der Platte, 7000 Logzeilen
  pro Stunde): Gebraucht werden bis zu 15 Spuren, behalten wurden nur 6. **Jetzt werden 24
  behalten.**

Kommt mit dem Update am 23.10. um 8:30 auf den W1.

### Ton-Fenster der Überblendung 0,5 statt 2 s (22.10. spät, Betreiber)

Der Betreiber hörte den neuen Song 1,5–2 s zu früh. Das lag am Design: `XF_TON_FENSTER_SEK = 2.0`, der neue
Song hatte also 2 s vor dem Musikende des alten schon seine volle Musik (equal power, nach 0,5 s schon
~40 % laut), und die letzten Töne des alten gingen unter. Im Log zu sehen als `alt bei 241.16s
(Musikende 243.0s)`. Jetzt **0,5 s** in `kiosk/nl-mpv-supervisor.py` und `dj-studio/js/tv.js`
(Crossfader-Anzeige). Das Bild blendet weiter über 9 s.

### Zwischenhändler für YouTube-Ströme (22.10. spät)

Gemessen am W1: Die Internetleitung schafft ~30 MB/s, YouTube liefert eine einzelne Verbindung aber
zeitweise nur mit ~0,1 MB/s (1080p braucht 0,5–0,75 MB/s). Das wechselt je Verbindung und Zeitpunkt:
dasselbe Video kam mal mit 8 MB/s, mal mit 0,11 MB/s. yt-dlp meldet dazu "Detected experiment to bind
GVS PO Token to video ID for web_creator client". Laut yt-dlp-Wiki gibt es das Experiment seit ca.
Oktober 2025. Dass es die Hänger ab 21.10. verursacht, ist **nicht belegt**, nur wahrscheinlich.
- **`strom_server`** (127.0.0.1:8092): mpv bekommt statt der googlevideo-Adresse
  `http://127.0.0.1:8092/s/<n>` (`ueber_zwischenhaendler`). Der Supervisor holt in 512-KB-Stücken, 8
  gleichzeitig, mit Range-Header und reicht Sprünge von mpv durch. Gemessen im gedrosselten Fall:
  direkt 0,11–0,13 MB/s, so 1,5–3,8 MB/s. mpv spielt damit auch ab einer Stelle mitten im Video.
- Gilt für Musik und Rotation, Bild und Ton (der Ton kommt bei Musik meist ohnehin von der Platte).
- Langfristig sauberer wäre ein PO-Token-Anbieter (bgutil-ytdlp-pot-provider), der ist aber ein
  fremdes Programm.

### Hänger: Ursache gefunden, Ton jetzt von der Platte (22.10. abends)

Um 20:52 gab es wieder einen Hänger (`uvIuAHsfNdc` bei 12,8 s). Im gesicherten mpv-Log stand diesmal
die Ursache: **YouTube liefert manche Ströme zeitweise zu langsam** ("Enter buffering 100% -> 0%",
auch schon beim Song davor 7 s Stillstand). mpv hält dann Bild und Ton an. Die Absicherung
(Neustart an derselben Stelle) griff, aber erst nach ~30 s, weil die Position in Häppchen weiterkroch.
Am Handy passiert das nie, weil die YouTube-App anders lädt.
- **Ton von der Platte** (`ton_laden`/`ton_quelle`): Der Ton jedes Musik-Songs (3–6 MB) wird mit yt-dlp
  vorab ganz geladen, nach `~/.cache/citycafe/ton/` (die letzten 40 Songs). Das passiert für die
  nächsten zwei der Schlange, schon beim Vormessen und spätestens beim Vorladen. mpv spielt ihn als
  `--audio-file`. Dauer je Song 4–80 s, je nachdem, wie YouTube liefert.
- **`--cache-pause=no`** für Musik: Kommt das Bild nicht nach, steht kurz das Bild, die Musik läuft weiter.
- **Stocken erkennen**: Wer in 8 s weniger als 3 s spielt, gilt als hängend (vorher erst nach 10 s
  ohne jeden Fortschritt).
- Die mpv-Logs heißen jetzt je Player anders (`mpv-xf-mpv.log`/`mpv-xf-mpvxf.log`), vorher schrieben
  beide in dieselbe Datei.
- Getestet auf dem W1: Download (5,9 MB in 4–78 s) und Wiedergabe von lokalem Ton plus Bild aus dem Netz.

### Wetter-Widgets bei Gewitter (22.10. abends)

Großes Wetter-Widget (Rotation) und kleines (rechts oben) zeigen bei Gewitter (Open-Meteo-Code 95/96/99)
ziehende, blaugraue Gewitterwolken mit verästelten Blitzen, die die Wolken aufleuchten lassen.
Vorbild war ein Gewitter-Visual im Anyma-Stil, das Bild entsteht aber komplett im Code
(`js/gewitter.js`, Canvas, `gewitterStarten(container)`). Der Regen fällt davor wie bisher.
Test ohne Gewitter: `?wetter=gewitter` an die TV-Adresse hängen (oder einen Code, z. B. `?wetter=61`).
Vorschau mit Skin-Ideen fürs DJ-Studio: `gewitter-vorschau.html` (nicht im Repo, nur lokal).

### Überwachung (22.10. abends, Betreiber: „Fehler sofort fixen können“)

- **Problem-Protokoll** `/home/citycafe/citycafe-probleme.log` (mit Datum, nur Probleme):
  - Der Supervisor erkennt sie in seinem eigenen Log (`PROBLEM_MUSTER`). Das sind Hänger,
    Startfehler, abgebrochene oder zu späte Blenden, Notbremse, eine hängende Seite, Neustarts,
    Fehler beim Upload, bei Takt und beim Vormessen sowie die Notfall-Kopie.
  - Dazu kommen jede Minute Temperatur (k10temp/amdgpu, ab 90 °C), freier Speicher (unter
    1500 MB) und neue Zeilen in `nl-mpv-supervisor.err`.
  - Alle 30 s holt er **Fehler der TV-Seite und des DJ-Studios** ab: `window.nlFehler` in
    `index.html` (error/unhandledrejection, Duplikate werden gezählt). Das DJ-Studio meldet über
    `parent.nlFehlerMelden` auch **Ruckeln** (unter 40 Bilder/s).
- **Statistik je Betriebstag** (8:30 bis 8:30) in `~/.cache/citycafe/tage/<tag>.json`: Songs,
  Blenden, Probleme, höchste Temperatur, wenigster Speicher.
- **Tagesbericht** `berichte/W1-<tag>.md` geht mit dem Upload um 8:30 ins Repo. **Bei Problemen
  im Café zuerst dort nachsehen.**
- **Warnung am Chef-Handy**: Ernste Probleme gehen über `window.nlWarnung` in den Status
  (`warnung`). Die Fernbedienung zeigt sie oben rot mit Uhrzeit (nur dem Chef, höchstens 6 h alt),
  bis „OK“ gedrückt wird.

### Notfall-Kopie der TV-Seite auf dem W1 (22.10. abends)

Bisher kam die ganze TV-Seite aus dem Internet (GitHub Pages). Ein Neustart ohne Internet hätte einen
leeren Bildschirm gebracht. Jetzt gibt es eine Notfall-Kopie:
- Der Supervisor hält **das ganze Repo als Kopie** in `~/.cache/citycafe/seite` (~210 MB, depth 1,
  öffentlich ohne Key). Er frischt sie beim Start und einmal am Tag ab 8:30 auf, zusammen mit dem
  Messdaten-Upload, und liefert sie auf **127.0.0.1:8090** aus (`seite_server`, nur lokal).
- `kiosk/citycafe-chromium` prüft beim Start bis zu ~30 s, ob GitHub Pages erreichbar ist. Wenn nicht
  und die Kopie da ist, startet er `http://127.0.0.1:8090/?kiosk=1…`. Mit eigener `CITYCAFE_URL` passiert
  das nie.
- Läuft die Kopie und ist GitHub Pages wieder erreichbar, wechselt der Supervisor ohne Musik von selbst
  zurück (`seite_zurueck`, Prüfung alle 2 min). Im Log steht dann „Notfall-Kopie: GitHub Pages wieder
  erreichbar“.
- Getestet am 22.10.: die Kopie auf dem W1 angelegt (5 s) und ausgeliefert (Seite, Skin, Playlists).
  Die Seite aus einer lokalen Kopie startet fehlerfrei. Musik von YouTube braucht natürlich trotzdem
  Internet.
- Einstellungen im Browser-Speicher (localStorage, z. B. `studioVorlauf`) gelten je Adresse. In der
  Kopie gelten also die Standardwerte.

### Der W1 kümmert sich selbst um seine Daten (22.10. nachmittags, Betreiber)

**Der PC zuhause rechnet nichts mehr für das Café.** Der W1 misst alles selbst und lädt es nebenbei
ins Repo hoch:
- **beat_this auf dem W1 eingerichtet**: `~/.local/share/citycafe/beat-venv`, torch 2.14.1+cpu,
  ~1 GB. Die 816 Takt-Dateien aus dem Repo liegen als Startbestand in `~/.cache/citycafe/takt/`.
  Das Modell `final0` war um 16 Uhr nicht ladbar, weil der JKU-Server 503 meldete.
  `~/modell-holen.sh` versucht es alle 5 min, höchstens 12 h lang; das Ergebnis steht in
  `~/beat-modell.log`.
- **Vormessen misst jetzt auch Lautheit, Intro und Ende** (`stille_messen`), nicht nur
  Welle/BPM/Takt, und zwar für alle Playlist-Songs. Reihenfolge: Warteschlange, dann die ganze laufende Playlist, dann Schlager, dann der Rest.
  Seit 22.10. abends auch während Musik (Betreiber):
  dann 45 s Pause zwischen zwei Songs, nie während einer Blende und erst, wenn die nächsten Songs
  der Schlange gemessen sind. Vorher waren nur 65 von 701
  gemessen, der Rest erst kurz vor dem Abspielen. Am 21.10. kam die Messung zweimal zu spät, und
  der Song startete mit falscher Lautstärke.
- **Upload ins Repo** (`daten_ins_repo`, **einmal am Tag ab 8:30**, also nach dem Update):
  - Takt-Dateien gehen nach `dj-studio/takt/`, Messwerte nach `dj-studio/messwerte/<id>.json`.
    Commit „Auto: W1-Messdaten (…)“ direkt nach `main`, so vom Betreiber gewollt.
  - Fehlende Takt-Dateien holt der W1 umgekehrt aus dem Repo.
  - Zugang über den Deploy-Key „City-Cafe W1 Messdaten“ (Schreibrecht, nur dieses Repo), der
    Schlüssel liegt in `/home/citycafe/.ssh/citycafe-repo`. Die Arbeitskopie liegt in
    `~/.cache/citycafe/repo` (sparse, depth 1).
  - Erster Lauf von Hand: Commit `1127f47` mit 75 Messwerten. Die Wellen-Spuren (~200 MB)
    bleiben nur auf dem W1.
  - Abschalten: den Key umbenennen.

## 21.10.2026: DJ-Skins, Überblendung 9 s, Lautheit −14 LUFS, Welle (auf `main`)

**Stand:** entwickelt auf dem Branch `dj-skins`, getestet am Test-Kiosk zuhause (`martin-ser`),
am 21.10. auf Wunsch des Betreibers nach **`main`** gebracht (Merge `4fb5f61b`), danach direkt auf
`main` weiter (Takt/beat_this, Messwerte auf der Platte; letzter Stand `dedb4d52`). Die TV-Seite im
Café lädt sich neu, sobald keine Musik läuft. **Der Supervisor kommt nur mit dem Update** (8:30
oder von Hand) – ein bloßer Neustart des W1 holt ihn **nicht**. Der Betreiber will den W1 am
21.10. noch umstellen: Windows-Sitzung → `AUFTRAG-W1.md` (erst Aufgabe 3 beat_this, dann
`ssh w1 "sudo systemctl start citycafe-update.service"` – startet danach selbst neu – dann
Aufgabe 1 prüfen). **Danach im Café: Endstufe um ~3 dB lauter** (−14 statt −11 LUFS) und den
Anzeige-Vorlauf der Welle einmal abgleichen (Aufgabe 2).
Mess- und Bildwerkzeuge: **`dj-studio/werkzeuge/`** (README dort).

### Als Nächstes (Stand 21.10. nachmittags)

**Weiter einlesen (am PC zuhause, Betreiber: „morgen weiter“):** fertige Songs werden übersprungen.
```sh
cd ~/City-cafe
# Playlist-Songs (Liste frisch vom Test-Kiosk holen oder ids.txt mit allen videoIds der Playlists)
nice -n 19 ~/.local/share/citycafe-test/beat-venv/bin/python dj-studio/werkzeuge/takt_messen.py ids.txt
# laufend: Radio, Schlange, gespielt - zuhause und Café (braucht den Test-Kiosk mit CDP 9222)
python3 dj-studio/werkzeuge/takt_nachlesen.py
# danach: git add dj-studio/takt && git commit && git push (der Café-TV holt sie selbst)
```

**Entscheidung Betreiber (21.10. nachmittags): die Takt-Dateien werden am PC zuhause fertig
eingelesen** (Playlist-Durchlauf + Nachlesen auch der Café-Songs) und kommen über das Repo
(`dj-studio/takt/`) auf den Café-TV. beat_this auf dem W1 (`AUFTRAG-W1.md` Aufgabe 3) ist damit
vorerst nicht nötig; der Supervisor-Code dafür bleibt und tut ohne Umgebung nichts.

1. **W1 umstellen** (Betreiber, heute): siehe oben; Takt-Dateien aus dem Repo nach
   `/home/citycafe/.cache/citycafe/takt/` kopieren; Prüfungen aus `AUFTRAG-W1.md` Aufgabe 1
   (`grep -E "Tonwechsel|Takt |Lautheit gesetzt" …/nl-mpv-supervisor.log`).
2. **Endstufe +3 dB** im Café, **Welle abgleichen** (`studioVorlauf`, zuhause −0,05 s).
3. **PC zuhause:** Playlist-Durchlauf (`takt_messen.py`, 703 Songs) und Nachlese-Dienst
   (`takt_nachlesen.py`, auch Café-Songs über Firebase) laufen im Hintergrund (Logs im Temp-Ordner
   der Sitzung, gehen bei Neustart verloren – Neustart einfach mit denselben Befehlen, fertige
   Songs werden übersprungen). Neue Takt-Dateien kommen nur mit einem Commit/Push ins Repo.
   Sobald der W1 selbst rechnet, sind beide nur noch Startbestand/Rückfall.
4. Ideen (nicht begonnen): farbige DJ-Welle wie Rekordbox/Serato aus den vorhandenen Bändern;
   **allin1** für Songteile (Intro/Strophe/Refrain/Outro → MIX-Punkte); **Essentia** für die
   Tonart; Harmonie-Anzeige KEY; Gäste-Wunsch sichtbar; QR im DJ-Modus.
5. Offen von früher: seltenes Überspringen eines Songs (Diagnose im Log bei „abgebrochen“).

### Skins (DJ Studio)

- 12 Vorlagen vom Betreiber (`~/Schreibtisch/skin dj/`, Originale `file_….png`, `01_…_FHD.png`)
  + Bild 2 = 13 Skins. Im Player `dj-studio/img/skins/<kürzel>.webp` (3840×2160, WebP q92, je
  1–3 MB). Kürzel → Name (Reihenfolge = Nummer im Ordner `4K/` bzw. `FHD/`):
  01 `amber-blau` Amber-Blau Kristall, 02 `blau-amber`, 03 `tiefglas` Blau-Amber Tiefglas,
  04 `gold`, 05 `weiss` Schneeweiß, 06 `chrom`, 07 `ladys-tuerkis`, 08 `elfenbein`, 09 `carbon`,
  10 `ladys-pink`, 11 `onyx`, 12 `champagner`; `bild2` = Original (`img/bild2-2x.webp`).
- **Herstellung eines neuen Skins** (genau so gemacht, Werkzeuge in `dj-studio/werkzeuge/`):
  1. Vorlage muss dieselbe Oberfläche wie Bild 2 zeigen (gleiche Lage aller Teile, 16:9).
  2. Hochrechnen: Real-ESRGAN ncnn-vulkan (GitHub-Release v0.2.5.0,
     `realesrgan-ncnn-vulkan-20220424-ubuntu.zip`), Modell `realesrgan-x4plus`:
     `realesrgan-ncnn-vulkan -i vorlage.png -o x4.png -n realesrgan-x4plus -m models`, dann mit
     PIL LANCZOS auf 3840×2160 (`…_4K.png`) und 1920×1080 (`…_FHD.png`). Originale nie überschreiben.
  3. Ausrichten auf Bild 2: `python -I werkzeuge/ausrichten.py dj-studio/img/bild2.png <4K.png>
     <ziel.png>` (affin, Ausreißer raus; Ziel: fast alle Stellen ≤ 1 px). Nur wenn nötig örtlich:
     `entzerren.py … SIGMA` – **kleine SIGMA verbeulen Glanzflächen** (Chrom hatte Beulen); bei
     Chrom: affin, dann SIGMA 180 und noch einmal 100. Im Ordner des Betreibers bleibt das Bild
     unverzerrt.
  4. Prüfen: Play-Symbol Kanal 2 (in Bild 2 fehlt der zweite Strich – Flicken `taste: true`),
     „+9“ der Master-Skala (bei Chrom aus Blau-Amber eingesetzt), VIDEO-LED-Lage (`LED_LAGE`).
  5. WebP: `im.save('dj-studio/img/skins/<kürzel>.webp', 'WEBP', quality=92, method=6)`.
  6. In `js/skin.js`: `SKINS` (Name), `LED_LAGE` falls die VIDEO-LED anders sitzt, `METER_LAGE`
     (Messung unten), in `index.html` `YTM_DJ_SKINS`, in `yt-fernbedienung.html` die Auswahlliste.
  7. Meter-Lage messen: `python3 werkzeuge/meter_messen.py mm.json && python3
     werkzeuge/meter_tabelle.py mm.json` (Kanal-Gehäuse A/B, Master-Raster) und
     `python3 werkzeuge/gr_messen.py` (GR-Säule) → Zeilen in `METER_LAGE`. Helle Leiste über der
     GR-Säule: Oberkante von Hand prüfen (Elfenbein/Blau-Amber/Champagner ≈ 541).
  8. Am Test-Kiosk jeden Skin mit Bildschirmfoto (CDP `Page.captureScreenshot` mit `scale`)
     an Metern, Fadern, MIX-Feldern, Play-Tasten, Crossfader prüfen.
- **Auswahl:** Chef-Handy, Musik-Fernbedienung → „⚙️ Anzeige & Anlage“ → Liste unter dem
  DJ-Knopf (Befehl `djSkin`), TV merkt ihn (`ytmDjSkin`, `localStorage ytm-dj-skin`, `yt/jetzt.djSkin`).
  Test direkt: `dj-studio/?tv&skin=gold`.
- **Meter (skin.js `METER_LAGE`, meter.js):** Kanal-Meter decken das ganze schwarze Gehäuse ab
  (Canvas 0,6 px innerhalb der Kante, Grund `#060606`, Radius 3) und zeichnen **30 LEDs** mit
  gleichem Rand ringsum (LED-Block 18,3 px breit, Lücke 20 %), Clip-LED 3 px darüber
  (`CLIP_ABSTAND` 1,8). Die gemalten LEDs sind unregelmäßig (im Gelb 6,1 statt 7,4 px Teilung),
  deshalb abdecken statt treffen. **Master: 25 Spalten** (Bild 2 und alle Skins; vorher 26) genau
  auf dem gemalten Raster, je Skin gemessen. **GR-Säule:** Gehäuse je Skin (`G`), 14 LEDs, Rand
  `(Breite − 16,2)/2`, Spaltenlücke 2,4. Schwellen (`SCHWELLEN_BILD_DECK`/`_MASTER`) auf 30/25
  umgerechnet. Alte Abdeck-Flicken aus Bild 2 unter Kanal-Metern und GR entfernt (B ragte 3,5 px
  rechts übers Gehäuse = „Meter zu weit links“).
- **Kanalfader:** Kappe = genauer Ausschnitt der gemalten Kappe (A `[115.5, 477.5, 43, 35.5]`,
  B `[1513, 477.5, 44, 35.5]`, Radius 3 px). Die gemalte Kappe wird nur dort entfernt, wo sie
  war: Schlitz `senk` (spaltenweise Verlauf oben→unten, A `[122,474,27,98]`, B `[1521,474,26,98]`),
  daneben `fuellen` (Laplace aus oben/unten/außen, Schlitzseite zählt nicht: A `[112.5,475,9.5,85]`
  'r', `[149,475,13.5,85]` 'l'; B `[1508.5,475,12.5,85]` 'r', `[1547,475,12.5,85]` 'l').
  `STREIFEN_SKINS = bild2, chrom, carbon`: dort statt `fuellen` senkrecht (Streifen laufen durch).
- **MIX IN/OUT:** die gemalten Tasten ±10/16 werden aus der Mulde `fuellen` (A `[223,340.5,155,38.5]`,
  B `[1293.5,340.5,156,38.5]`, nur DJ-Modus); Feld A `[226,337,148,44]`, B `[1298,337,148,44]`
  (Mulde gemessen: A 214,5–385, B 1287–1457).
- **Play-Taste (DJ-Modus):** spielt = Neon in der Farbe der eigenen Welle (A `#1487ff` blau,
  B `#ff9614` orange); Pause = beide grün `#2fe36a`, blinken alle 3 s 0,5 s (deck.js `t % 3 < 0.5`).
- Flicken-Typen in `putzen()` (skin.js): `quelle` (Bildstück), `farbe`, `farbeVon`, `verlauf`,
  `quer` (zeilenweise links→rechts), **`senk`** (spaltenweise oben→unten), **`fuellen`** (Laplace,
  `'l'`/`'r'` = diese Seite kein Rand), `taste` (nur ins Tastenbild), `tv` (nur DJ-Modus).

### Welle, Taktraster, Pegel (DJ Studio, `js/tv.js`, `js/main.js`)

- **Tempo genau** (`tempoVerfeinern`): die BPM-Messung des Supervisors lag bis 0,8 BPM daneben →
  Raster lief über den Song weg (Dancing Queen 100,1 statt 100,55: nach 100 s einen halben Schlag).
  Jetzt ±1,5 % um den Messwert in 0,01-%-Schritten das Tempo, bei dem die Bass-Einsätze des ganzen
  Songs am deutlichsten auf dem Raster liegen; daraus auch die Lage der Schläge. 13 Songs geprüft
  (z. B. 127,7 → 128,01; Uptown Funk 115,00), Raster meist ±30 ms. ~70 ms je Song im Browser.
  Prüfen: `werkzeuge/tempo_verfeinern.py <id>`, `werkzeuge/raster_pruefen.py <id> [bpm versatz]`.
- **Ruhiger Lauf:** Position nach der Bildzeit (`requestAnimationFrame`), Abweichungen zu mpv
  < 20 ms ignoriert (`NACHZIEHEN_AB_SEK`), größere mit höchstens 3 % Tempo (`NACHZIEHEN_TEMPO`);
  vorher schwankte das Tempo 72–124 %. Ab 75 Hz zeichnet das Studio jedes zweite Bild
  (am 100-Hz-Monitor gleichmäßig 50 fps statt 10/20-ms-Wechsel), bei 60 Hz wie bisher.
- **Anzeige-Vorlauf** (`localStorage 'studioVorlauf'`, Sekunden, ±1, Standard
  `STUDIO_VORLAUF_SEK = 0`): gleicht die Verzögerung bis zum Ohr/Auge aus (Bluetooth meldet sie
  nicht). Positiv = Welle früher. Gesetzt wird er im Kiosk-Profil (Ursprung der TV-Seite), wirkt
  nach ≤ 1 s, ohne Neuladen. **Zuhause gemessen: −0,05 s** (Tipp-Test: Klick ~90–110 ms nach mpv =
  Bluetooth/B03; Bild ~50–60 ms verzögert durch sway im KDE). Am Ausgang vor Bluetooth liegt der
  Ton nur 53 ms neben mpv (Korrelation 0,969) – der PC ist also genau. **Café: eigener Wert**, siehe
  `AUFTRAG-W1.md`. Position prüfen: `werkzeuge/position_pruefen.py` (Studio − mpv).
- **Wartender Kanal (NEXT)** steht auf dem gemessenen Start (START-Marke) statt 0:00.
- **Ruckeln während Hintergrund-Rechnen:** solange beat_this am PC lief (alle Kerne), fiel fast
  jedes dritte Bild aus – deshalb `nice -n 19` und höchstens 2 Kerne (1–2 % Ausfall). Im Café
  rechnet der W1 nur mit 1 Kern und niedrigster Priorität; dort im DJ-Modus die Bildrate prüfen.
- **Pegelanzeige:** `RESERVE_DB = 4.0` (1,0 + 3 dB für −14 LUFS, Anzeige wie vorher; Betreiber:
  bei 100 % darf es ab und zu CLIP zeigen) und `anheben()`: +3 dB bis −12 dBFS, bis −3 dBFS
  auslaufend (rot bleibt selten). Wellenhöhe: unverändert (Änderung war nicht gewünscht).

### Takt und Eins mit beat_this (21.10. nachmittags)

- **Problem:** Die Eins (dicker Takt-Strich) lag oft falsch – das Studio nahm den Schlag mit dem
  meisten Bass, bei Disco/Funk/Pop Zufall (Payphone, Let's Groove); Girls Like You lag das Raster
  0,2 s neben den Schlägen; Sugar hatte 159 statt 120 BPM. Klick-Tests („auf die Eins klicken“)
  sind für Menschen zu ungenau; Akkordwechsel/Songteile aus unseren Messwerten waren nicht sicher.
- **Lösung:** **beat_this** (Universität Linz, CPJKU 2024, frei) erkennt alle Schläge und
  Takt-Einsen aus dem Ton (Test 7 Songs: Einsen zu 95–100 % eindeutig, Zeitbasis ±10 ms zu den
  Bass-Einsätzen der Spur). Format je Song `{"v":1,"b":[Abstände ms],"e":[Index der Einsen]}`.
- **Woher das Studio die Takt-Daten nimmt** (`tv.js`): 1. vom Supervisor (`window.nlStudioTakte`,
  index.html reicht sie als `ytm-dj-takt` weiter), 2. sonst `dj-studio/takt/<id>.json` aus dem
  Repo, 3. sonst das gerechnete Raster (`tempoVerfeinern`, jetzt mit Prüfung der Tempo-Familie
  ×¾/×4⁄3/×⅔/×1,5 – Sugar 120,04). Raster wird gezeigt, wenn die Bass-Einsätze deutlich auf dem
  Tempo liegen (`DEUTLICH_MIN` 0,06; vorher Supervisor-Sicherheit ≥ 0,93 – Africa hatte keins).
- beat_this setzt Schläge auf ein 20-ms-Raster → das Studio glättet je Schlag aus 8 Nachbarn
  (Median-Abstand, Mittel ohne Ausreißer): Pendeln 1–2 ms statt 6–11 ms. BPM über je 8 Schläge.
- **Supervisor** (`takt_rechnen`, `TAKT_RECHNER`): rechnet nach jeder Spur-Messung (laufender
  Song, Vorab, Vormessen) die Takt-Datei, wenn `CITYCAFE_TAKT_PYTHON` (Standard
  `~/.local/share/citycafe/beat-venv/bin/python`) da ist; `nice 19`, 1 Kern, Ton `-readrate 16`;
  `~/.cache/citycafe/takt/` (`CITYCAFE_TAKT`). Fehlt beat_this: alles wie bisher. Log `Takt <id>:`.
  **W1 einrichten:** `AUFTRAG-W1.md` Aufgabe 3 (Umgebung ~1 GB, Startbestand aus dem Repo kopieren).
- **PC zuhause:** Umgebung `~/.local/share/citycafe-test/beat-venv` (torch 2.14.1+cpu,
  torchaudio 2.11.0+cpu aus dem CPU-Index, numpy, soxr, soundfile, beat_this von GitHub).
  `werkzeuge/takt_messen.py ids.txt` (Playlist-Durchlauf, 703 Songs, ~30 s je Song) und
  `werkzeuge/takt_nachlesen.py` (alle 5 min laufender Song, Schlange, Radio, gespielt – zuhause
  und im Café über Firebase `djremote/city-cafe/yt/jetzt|radio|warteschlange`). Immer mit
  `nice -n 19` und höchstens 2 Kernen – mit allen Kernen ruckelte das Studio.
  Test-Supervisor: `CITYCAFE_TAKT_PYTHON=…/beat-venv/bin/python CITYCAFE_TAKT=…/takt-cache`.
- Nicht getan (Vorschlag): **allin1** (Songteile Intro/Strophe/Refrain/Outro) für MIX-Punkte,
  **Essentia** für genauere Tonart. Eine fremde Wellen-Bibliothek (wavesurfer.js, peaks.js) bringt
  nichts – die Probleme lagen am Abgleich, nicht am Zeichnen.

### Überblendung fest 9 s, genau berechnet (Supervisor `ueberblenden()`)

- Am Handy keine Einstellung mehr (Kurz/Mittel/Lang entfernt); `index.html` sendet `blende: 9`.
- Ablauf: `XF_SEK + XF_VORLAUF_SEK` = 15 s vor dem **Musikende des alten** (`STILLE.ende`) wird der
  neue Song **angehalten** geladen (`--pause --start=einsatz−7`). Der Faden rechnet aus der
  Position des alten fortlaufend den Zeitpunkt des Musikendes und lässt den neuen genau so los,
  dass er am Beginn des 2-s-Tonfensters (`XF_TON_FENSTER_SEK`) an seinem **Einsatz** ist. Der Ton
  wechselt equal power (cos/sin, mpv-Lautstärke ∛) und ist **genau am Musikende des alten** fertig.
  Bild blendet vom Loslassen bis dahin (bis 9 s). Zu spät geladen → neuer wird passend vorgespult.
- **Einsatz** (neu, `STILLE.einsatz`): ab hier volle Musik (2 s fast normal laut, ≤ 20 s nach dem
  Anfang, `EINSATZ_MAX_SEK`). Leises Intro (z. B. Madcon „Don't Worry“ Lyric-Video: 7 s bei −30 dB)
  wird ab dem Songanfang in 1,5 s eingeblendet und läuft unter dem Ende des alten mit – vorher
  5–7 s fast Stille. DJ Studio fährt den Crossfader am Einsatz (`ton[4]`).
- Seite ändert ihren nächsten Song vor dem Loslassen (neue Mix-Liste) → Vorbereitung verworfen,
  neu mit dem neuen Song. Pause vor dem Loslassen → verworfen. Dashboard erfährt den Songwechsel
  (`nlVideoFertig`) erst beim Loslassen.
- Log: `Ueberblendung: alt -> neu (Musikende alt …s in …s, neu ab …s, Musik ab …s, voll ab …s)`,
  **`Tonwechsel <id>: neu bei …s (volle Musik ab …s), alt bei …s (Musikende …s)`**, `Ueberblendung
  fertig`. Gemessen zuhause: neu 8,58 (Ziel 8,6) / alt 231,61 (231,5); neu 29,03 / alt 204,38;
  neu 0,53 / alt 227,15 – also ±0,2 s. Prüfen: `grep Tonwechsel …supervisor.out`.
- DJ Studio: MIX-Marke = Beginn des Tonwechsels (Ende − 2 s); ON AIR folgt dem Crossfader.

### Lautheit −14 LUFS (Supervisor `LAUT_ZIEL_LUFS`)

- **Vorfall 21.10. 13:41 zuhause:** Supervisor-Neustart mitten in einer Überblendung (für einen
  Test) → Blende abgebrochen, Song neu von 0 s und ~12 s ohne Lautheits-Absenkung (5 dB zu laut).
  Der Betreiber drehte von 79 auf 73 % (≈ −2 dB, mpv rechnet kubisch); der nächste Song (P!nk
  „So What“) wirkte danach „extrem leise“ – nachgemessen: Original −8,9 LUFS, Spitze 0 dBFS, um
  −5,1 dB auf −14 LUFS gebracht wie alle anderen, also richtig. Zuhause für −14 LUFS eher 85–90 %.
  **Regel:** Supervisor/Seite am Test-Kiosk nicht mitten in einer Überblendung neu starten.
- **Messwerte auf der Platte** (21.10. nachmittags, `stille_von_platte`/`stille_speichern`):
  Anfang, Einsatz, Ende, Lautheit, Limiter je Song in `~/.cache/citycafe/stille/<id>.json`
  (`CITYCAFE_STILLE`), gültig bei gleicher `STILLE_FASSUNG` (2) und gleichem `LAUT_ZIEL_LUFS`;
  mit gefundener Studiofassung für immer, ohne Abgleich 30 Tage (dann neuer Versuch). Anlass: nach einem Supervisor-Neustart lief der Song ~10 s ohne Absenkung
  (bis 5 dB zu laut), bis er neu gemessen war; jetzt setzt `ton_args` die Lautheit sofort.

- Ziel −14 statt −11 LUFS (wie YouTube/Spotify). Nachgerechnet mit 79 Playlist-Songs (−26,1 bis
  −5,8 LUFS, `werkzeuge/lufs_messen.sh` + `lufs_auswerten.py`): −11 → 94,9 % innerhalb ±1,5 dB
  (leisester −4,1 dB, Limiter 28×); **−14 → alle innerhalb ±1,5 dB, 74 innerhalb ±0,3 dB, Limiter
  4×**, leisester: September (EWF) −1,1 dB. Laute Songs werden im Mittel 5,2 dB, höchstens 8,2 dB
  abgesenkt (Irgendwann Irgendwo −8,2; Christin Stark „Barcelona“ −8,1) – nur leiser gestellt,
  nicht komprimiert. **Insgesamt 3 dB leiser → im Café Endstufe +3 dB** (Betreiber: stark genug).
- Limiter weiter höchstens 2 dB, Gain höchstens ±15 dB, 1 dB Reserve zu den Spitzen.

### Musik-Fernbedienung

- **Suche „📝 Lyrics“** (neben Songs/Playlists): fragt YouTube mit „… lyrics“ und zeigt nur Treffer
  mit lyric/songtext/letra/paroles/testo im Titel („Helene Fischer Atemlos“: 8 von 25).
- **Songs vom Handy werden nie getauscht:** neben `gewaehlt` und Chef-Einträgen jetzt auch Wünsche
  (`quelle: 'wunsch'`). Getauscht (gegen das offizielle Musikvideo) werden nur noch Playlist- und
  Radio-Titel. Vor dem 19.10. in Playlists gelegte Songs ohne Markierung: löschen und neu hinzufügen.
- Skin-Auswahl (s. o.); Überblendungs-Einstellung entfernt. Test-Link (Branch):
  `https://raw.githack.com/motte025/City-cafe/dj-skins/fernbedienung.html?raum=zuhause`.

### Test-Aufbau zuhause (neu seit 21.10., übersteht einen Neustart)

- Alles unter **`~/.local/share/citycafe-test/`** (700, nicht im Repo): `kiosk-test.sh` (Chromium,
  Profil `chromium-kiosk/`, `?kiosk=1&raum=zuhause&boxname=Zuhause-Test` + PIN aus `chefpin`, 600),
  `sway.conf` (verschachteltes sway 1920×1080), `supervisor-neu.sh` (beendet **alle** Python-
  Supervisoren und startet genau einen im sway – vorher liefen versehentlich zwei),
  `supervisor.out/.err`.
- Start: lokaler Server `cd ~/City-cafe && python -m http.server 8090 --bind 127.0.0.1`, dann
  `CITYCAFE_RAUM=zuhause … sway -c ~/.local/share/citycafe-test/sway.conf` (env wie in
  `supervisor-neu.sh`), Bluetooth: `bluetoothctl power on; bluetoothctl connect 70:B3:D5:91:38:62`.
  DJ-Modus per CDP: `ytmBefehl({was:'dj', id:'x'+Date.now()})`; Skin: `{was:'djSkin', skin:'gold'}`.
- PIN eingeben (nie lesen/ins Repo): Dialog `yad --entry --hide-text … > chefpin`.
- **Der PC zuhause hat das nächtliche Kiosk-Update** (`citycafe-update.timer`, 8:30): heute
  `pacman -Syu` (Chromium, Firefox …) und danach **automatischer Neustart** um 08:30:55 – das war
  der „Absturz“; `/tmp` war danach leer. Abschalten nur auf Wunsch:
  `sudo systemctl disable --now citycafe-update.timer`.
- Werkzeuge zum Messen: `dj-studio/werkzeuge/` (Tipp-Test, Ausgangs-Mitschnitt, Position, Tempo,
  Raster, LUFS, Meter-Lage, Ausrichten).

### Getränke-Angebote unter „Pioneer DJ“, Master-Knopf (21.10. abends)

- **Angebote** (`dj-studio/js/ui/angebote.js`, CSS `.tv-angebot` in `skin.css`): nur Schrift unter
  dem Pioneer-DJ-Schriftzug, Lage `[544, 763, 576, 40]` (Bild-2-Pixel, 4 links von der Mitte – die
  Kursive wirkt sonst rechtslastig). Schrift **Saira** 900 kursiv, `font-stretch 125 %`, zusätzlich
  `scaleX(1.25)`, **38 px** (lange Titel werden verkleinert). **Jede Minute je Angebot 7 s**, dann
  leer. Liste `djAngebote` in `werbung.json` (jetzt: 5 × Jägermeister 14,00 €, Ane aufs Aug 3,00 €;
  Puntigamer nur in `aktionen`), alle 10 min neu gelesen. Farbe: helle Skins (Gold, Weiß, Chrom,
  Elfenbein, Ladys Pink, Champagner) schwarz mit dunkelrotem Preis, sonst hell mit goldenem Preis;
  Amber-Skins (amber-blau, blau-amber, tiefglas) Preis eisblau `#8fe6ff`. Saira lädt das Skript
  notfalls selbst.
- **Am Chef-Handy einstellbar** (Fernbedienung → Übersicht → Werbung → „🎛 DJ-Modus: Angebote
  unter Pioneer DJ“, Firebase `djremote/<raum>/werbung/einstellung/dj`): An/Aus, **alle** 30 s /
  1 / 2 / 5 min / immer (`alleS`, 0 = immer), **je** 5 / 7 / 10 / 15 s (`dauerS`), **Größe**
  Klein 32 / Normal 38 / Groß 44 (`groesse`, lange Titel werden kleiner), je Angebot An/Aus
  (`a_<id>`: Jägermeister, Ane aufs Aug, Puntigamer – geht vor `aktiv` in `werbung.json`).
  index.html reicht die Einstellung als `djWerbung` mit `ytm-dj` ans Studio. Getestet zuhause.
- **Chrom, BEAT GRID/VINYL:** dort sind die LEDs anders gemalt (A 70/723,5, B 1571 und 1595,5/723,5);
  `ANZ_LAGE` in `skin.js` verschiebt LEDs und Abdeck-Flicken (glatt aufgefüllt). Alle anderen
  Skins liegen wie Bild 2 (an einer Übersicht aller 13 geprüft).
- **Master-Level-Knopf:** bleibt wie im Bild gemalt (dreht nicht mehr) – der gedrehte Ausschnitt
  zeigte Nähte und helle Sicheln (Betreiber: wie im Original).

### Gespeicherte Daten je Song (was bleibt, wenn Songs aus Playlists gelöscht werden)

| Daten | Ort | Größe | Aufräumen |
|---|---|---|---|
| Takt (beat_this) | Repo `dj-studio/takt/<id>.json` (W1 optional `~/.cache/citycafe/takt/`) | 2–3 KB | bleibt (bei erneutem Spielen sofort da) |
| Studio-Spur (Welle, Pegel, BPM, Tonart) | W1 `~/.cache/citycafe/spuren/<id>.json.gz` | ~225 KB | automatisch: zuletzt benutzte bleiben, älteste raus erst über **3 GB** (`SPUR_PLATTE_MB`, seit 21.10.; vorher 600 MB; `CITYCAFE_SPUR_MB` bei kleiner Platte) |
| Anfang/Einsatz/Ende/Lautheit/Limiter | W1 `~/.cache/citycafe/stille/<id>.json` | < 1 KB | bleibt; **mit Studio-Abgleich für immer**, ohne Abgleich nach 30 Tagen neu messen (`STILLE_OHNE_ABGLEICH_TAGE`) |

Löschen aus einer Playlist entfernt nur den Eintrag in Firebase (`djremote/city-cafe/yt/listen`).
Ein Aufräum-Skript (alles zu Songs, die in keiner Playlist mehr sind) gibt es noch nicht – bei
Bedarf bauen.

### Commits (ab 21.10.)

4dce4b07 … 57e600cf (Skins, Play-Taste, Chrom, VIDEO-LED, Meter erste Fassung), c0bf0253 / 296acc59
(Meter mittig, GR), 1b7ca997 / 280dcc13 (Wellenhöhe – zurückgenommen), a7ad0ade (Play-Farbe),
44c01341 / e4c864d4 (Fader), 036ec98b (MIX), 77655d9d / 5a7b0662 / 6b263daa / f945530a (Pegel,
Start-Marke, −14 LUFS), 92fce580 / 74de6a7e (Überblendung 9 s, Einsatz), 5a71bec4 (Lyrics, kein
Tausch), d6517dd8 / c65d1687 / 1328f482 (Welle ruhig, Tempo genau), dazu diese Doku.
Außerdem auf dem Branch (auch für `main` wichtig): d8531d21 (Firebase: eine gemeinsame anonyme
Anmeldung – auf frischem Profil gab es zwei UIDs → PERMISSION_DENIED), 2d3b6f51 (Musik-Tausch nur
gegen Video desselben Künstlers – Ambros „Schifoan“ kam als Metallica live).
Auf `main`: 4fb5f61b (Merge dj-skins), 27783599/07c68447 (Doku), 4c417936 (beat_this-Takt im Studio,
Tempo-Familie), 4bc5681c (Takt geglättet), c71cb964 (Raster nach Deutlichkeit, Nachlesen),
84c21637 (Nachlesen fürs Café, 263 Takt-Dateien), 887771bb (beat_this im Supervisor), cd5d968a
(Messwerte auf der Platte), cbfa0ab1/dedb4d52 (Takt-Dateien 412/446).

## 20.10.2026: Berliner-Luft-Angebot im großen Medien-Widget

- Originalmotiv `berliner_luft_3_euro.jpg` (1280×720, 16:9, „Ane aufs Aug“, 3 €).
- In jedem normalen Rotationszyklus direkt nach Jägermeister/Puntigamer für feste
  60 Sekunden (`runBerlinerLuftState`). Bei abgeschaltetem Jäger-Plakat läuft der
  Berliner-Luft-Slot trotzdem. Gemeinsame Rotations-Timer für Pause/Abbruch.
- Vollständig zentriert im 1280×815-Widget mit `object-fit: contain`, ohne Zoom,
  Animation oder Beschnitt; oben/unten rund 48 px dunkler Rand, keine Hochskalierung
  im 1920×1080-Dashboard. Vorlage unverändert übernommen.
- Lokal geprüft: Chromium-Bildschirmfoto der Widget-Fläche, Bildmaße/contain/keine
  Animation, JavaScript-Syntax, drei simulierte Zyklen mit je 60 s und Weiterlauf
  bei abgeschaltetem Jäger-Plakat. Kein Zugriff auf den Café-Bildschirm.

## 18./19.10.2026: DJ-Modus (seit 19.10. 00:05 auf `main`)

Ausführlich in **`dj-studio/UEBERGABE.md`**. **Für die Sitzung am Windows-PC (mit `ssh w1`):
`dj-studio/AUFTRAG-W1.md`** – was nach dem Update am 19.10. um 8:30 auf dem W1 zu prüfen ist. Kurz:

- **DJ-Modus der YouTube-Musik**, Raum `zuhause` und seit 19.10. 04:45 auch `city-cafe` (Betreiber): der TV zeigt das DJ Studio, mpv spielt im
  Studio-Videofenster, Ton weiter über mpv/Bluetooth. Wellenform, BPM, Tonart und Pegel misst der
  Supervisor je Song (gespeichert unter `~/.cache/citycafe/spuren/`).
- **Test-Aufbau zuhause = PC `martin-ser`** (EndeavourOS/KDE): sway im Fenster, lokaler Server auf
  Port 8090 vom Branch, Supervisor aus dem Repo, B03 Pro per Bluetooth gekoppelt. Fallen und Befehle
  in der Übergabe (u. a.: lokales Dashboard immer mit `?raum=zuhause`).
- **Playlists für alle Räume gemeinsam** (`djremote/city-cafe/yt/listen`) und **Playlist-Suche** in
  der Musik-Fernbedienung (Listen → 🔎, Chef löscht dort mit ✕).
- Supervisor: `CITYCAFE_COOKIES` und `CITYCAFE_JS_RUNTIME` einstellbar (Standard wie bisher); im
  Normalbetrieb misst er nichts zusätzlich. Seit 19.10. 04:22 auf dem W1 (Update von Hand gestartet,
  Café zu), läuft fehlerfrei.
- Werbungs-Wächter prüft nicht mehr, solange mpv die Musik spielt (verhinderte Song-Neustart ~47 s
  nach einer Überblendung im Test).
- **W1 gemessen (19.10. ~04:50, Musik 10 %, je 20–30 s):**

  | | CPU | GPU | Bildrate Seite / Studio | Tctl |
  |---|---|---|---|---|
  | ohne Musik | 4 % | 11 % | 60 / – | 37 °C |
  | Musik normal | 9 % | 24 % | 60 / – | 45 °C |
  | DJ-Modus | 10–11 % | 12 % | 60 / 60 | 52–58 °C |

  Keine 30-fps-Bremse nötig. Studio-Spur auf dem W1 geht (5 Songs, BPM-Sicherheit meist 0,96–0,99).
  Temperatur bei längerem DJ-Betrieb noch beobachten. Messskripte: `/tmp/messen.sh`, `/tmp/dj-messung.sh`
  auf dem W1 (gehen beim Neustart verloren).
- **Vormessen** auf dem W1 **fertig** (19.10. 05:22–14:02, 703 von 703; ~10 Songs in 8 min, nur ohne
  Musik). Danach 707 Songs (4 neu am Handy hinzugefügt) – alle gemessen, 158 MB. Neue Playlist-Songs
  misst er von selbst nach: die Liste kommt alle 10 min frisch von der TV-Seite (die übernimmt
  Änderungen vom Handy sofort). Erster Lauf erst ~10 min nach dem Supervisor-Start.
- **Systemupdate W1 repariert (19.10.):** `pacman -Syu` brach seit mindestens 17.10. ab
  (`plasma-workspace 6.8` gegen `plasma-x11-session`). `plasma-x11-session` entfernt (Kiosk läuft unter
  sway), 108 Pakete eingespielt, Kernel 7.2.11, Plasma 6.8. Die Café-Dateien kamen trotzdem jeden Tag.
- Offen: seltenes Überspringen eines Songs. Café-Log: 8 von 2794 Überblendungen abgebrochen (0,3 %).
  „Weiter“ im Log = neuer Pause-Wunsch, den `ytmSpielen()` bei jedem Songstart setzt; zweimal
  „Weiter“ in der Überblendung = die Seite hat zweimal einen Song gestartet. Erster Start:
  Überblendungs-Faden → `nlVideoFertig()`. Zweiter: unbekannt (Kandidaten ⏭ am Handy, Taste
  rechts/Medientaste, Playlist-Suche). Seit 9cbf281e schreibt der Supervisor bei jedem Abbruch
  Grund und die letzten `ytmWeiter`-Aufrufer ins Log (`grep -A1 "abgebrochen"`).
- **Muster B behoben (5513d554, 19.10.):** Neuer Song brauchte selten > 6 s bis zum ersten Bild →
  Blende abgebrochen, Song kam hart von 0 s. Jetzt `XF_START_FRIST` = 15 s, alter mpv mit
  `keep-open`. Auf dem W1 getestet (3 Blenden sauber, 05:24–05:27); der langsame Start selbst
  ließ sich nicht erzeugen – im Log auf „spielt erst nach“ achten.
- Push nach `main` durch Claude: über `/permissions` für den konkreten Befehl freigegeben, sonst
  von der Berechtigungsprüfung gesperrt („Production Deploy“).

## 19.10.2026 abends: Kiosk zuhause (`martin-ser`) auf W1-Stand

- **PC zuhause bootet als Kiosk** (GRUB „City-Cafe Kiosk“, Standard): blieb auf der Konsole
  stehen, weil `plasmalogin` `Conflicts=getty@tty1` hat – die Condition im Drop-in greift erst
  nach der Transaktion, getty@tty1 fiel trotzdem raus. Lösung: Kiosk-Eintrag in
  `/etc/grub.d/09_citycafe` mit `systemd.unit=multi-user.target`. „KDE Plasma“ unverändert.
- System wie W1: `plasma-x11-session` entfernt, `pacman -Syu` (Kernel 7.2.11, Plasma 6.8),
  `nodejs` (yt-dlp), Supervisor aus `main`. Update-Timer holt verpasste 8:30-Läufe nach
  (`citycafe-update.timer.d/nachholen.conf`, nur dort – der PC ist morgens aus).
- **34"-Monitor 3440×1440 (21:9)** streckte 1920×1080 in die Breite. sway nativ mit
  `scale 1.333333 position -330 0`, Chromium schwebend 1920×1080 bei 0,0 (mittig, 16:9);
  `CITYCAFE_OUTPUT=keiner` in der env, damit der Starter nicht 1920×1080 erzwingt. Fensterlagen
  bleiben logisch wie am W1. **mpv-Overlays (Kontrastrahmen, QR) rechnen in echten Bildpunkten:**
  Supervisor multipliziert jetzt mit der sway-Skalierung (`ausgabe_skala()`, W1: 1).
- **Zuhause Chef auch in `city-cafe`:** Playlists liegen unter `city-cafe/yt/listen`, schreiben darf
  dort nur ein Café-Chef. TV und Handy im Raum zuhause melden sich mit derselben PIN auch dort an.
- **Bewusst gewählte Fassung wird nicht getauscht** (Betreiber): Songs, die der Chef am Handy zu
  einer Playlist hinzufügt, tragen `gewaehlt: true`; diese und Chef-Einträge mit videoId
  (`quelle: 'chef'`) prüft `ytmPlaylistTitelPruefen` nicht mehr. Gäste-Wünsche, Radio-Mix und
  Repo-Listen werden weiter gegen das offizielle Video getauscht. Ältere, vor dem 19.10. von Hand
  hinzugefügte Songs haben die Markierung nicht (einmal löschen und neu hinzufügen). Anlass:
  Madcon „Don't Worry“ (eigene Fassung `HO7uge9UUrA`) wurde gegen `y74UPiaK7u0` getauscht, dessen
  Intro der Studio-Abgleich nicht fand → keine Intro-Ausblendung.

## 19.10.2026 nachmittags: Musik-Fernbedienung und Suche

- **DJ-Modus sichtbar** (acabf76e): läuft er, steht beim Chef oben beim laufenden Song
  „🎛 DJ-Modus · …“ (aus `jetzt.dj` vom TV). Gäste sehen es nicht.
- **⏮** (70289e64, `ytmZurueck` in `index.html`): in den ersten 10 s eines Songs zum Song davor
  (aus `ytm.gespielt`, der wird dort gestrichen – mehrmals drücken geht weiter zurück), der laufende
  Song kommt ganz vorn in die Schlange. Später im Song oder ohne Vorgänger: Song von vorn. Der
  zurückgeholte Song hat keine Playlist-Angabe (im Verlauf stehen nur Video, Künstler, Titel).
  Nur in einer Node-Simulation geprüft.
- **Zurück-Taste/-Geste am Handy** (a337c45a, `yt-fernbedienung.html`): Schritt für Schritt –
  offenes ⋯-Menü zu, offene Playlist in der Suche zu, voriger Reiter; erst ganz vorn verlässt sie
  die Seite (`history.pushState`/`popstate`, Menü als eigener Schritt per `MutationObserver`).
  Reiter und Menü in Chrome geprüft.
- **Radio-Mix bearbeiten** (a337c45a): unter „📻 Danach: Radio-Mix“ der Knopf „📥 Mix in die
  Warteschlange“ (Befehl `radioUebernehmen`: bis 25 Mix-Titel als Playlist-Titel „Radio-Mix“ in die
  Schlange, dort verschieben/löschen); im ⋯-Menü der Mix-Titel „🗑️ Aus dem Mix entfernen“
  (`radioEntfernen`). Nicht im Betrieb getestet.
- **Suche nach Aufrufen** (Supervisor): Treffer mit allen Suchwörtern in Titel/Kanal vorn, darin
  die meistgesehenen zuerst; Live-/Fan-/Lyric-/Audio-Uploads weiter ans Ende. Reine Sortierung nach
  Aufrufen brachte bei „Haus am See“ „Alles neu“ (84 Mio.) nach oben. Auf dem W1 getestet
  („Haus am See“, „Helene Fischer Atemlos“). Grenze: Fan-Uploads mit vielen Aufrufen können vor dem
  Original stehen; „TV Auftritt“ erkennt `MV_LIVE` nicht.
- **Supervisor von Hand eingespielt** (19.10. ~15:00, Betreiber-Freigabe, Musik lief nicht):
  Sicherung `/opt/citycafe/nl-mpv-supervisor.py.vor-suche-2026-10-19`; Neustart per PID mit der
  Umgebung des alten Prozesses (`/proc/<pid>/environ`), läuft fehlerfrei.

## 19.10.2026: Halloween-Slot im Medien-Widget (zeitlich begrenzt)

- Event **31.10.2026 ab 18:00**, Live-Musik, Kostüme willkommen. Ein 60-s-Video **ohne Ton**
  (1920×1080, 30 fps, H.264, ~29 MB): `halloween_horror.mp4`, in **jedem Zyklus**, Slot
  `HALLOWEEN_SLOT_INDEX` 0.7 direkt nach den Plakaten, vor Mittagsteller und DJ (`runHalloweenState`,
  `<video id="halloween-video">` in `#media-view-halloween` – innerhalb von `.media-inner-view`, braucht
  also keinen eigenen Abbau). Das zweite Video (Atmosphäre-Loop) hat der Betreiber am 19.10. herausnehmen
  lassen; es liegt nur noch im Projektordner.
- Quelle wird erst im Slot gesetzt und danach in `runMasterSequence()` freigegeben
  (`halloweenFreigeben`, wie beim Dartfilm). Nur **bis einschließlich 31.10.2026** (lokale Zeit,
  `halloweenAktiv`); danach springt der Slot sofort weiter. `?halloweenan=1` zeigt ihn zum Ansehen
  auch außerhalb. **Nach dem Event: Slot, Konstanten und das MP4 entfernen** (~29 MB im Repo).
- Geprüft nur mit Headless-Chromium (kann kein H.264 → mit kurzen VP9-Ersatzclips: Slot aktiv,
  Wiedergabe, Weiterschalten, Quelle frei). **Auf dem Café-Screen noch nicht angesehen.**
- Erzeugung (kie.ai Kling, 6 Clips, 2,52 $, Effekte/Schnitt lokal) und Quellen:
  `CityCafe_Halloween_2026/` (README dort). Rohclips und 1080p-Master liegen nicht im Git.
- Offen: „Eintritt frei" steht in `CityCafe_Halloween_2026/config/config.json` auf aus, bis der
  Betreiber es bestätigt. Ein Eintrag für das Event in `werbung.json` („Demnächst bei uns") ist
  noch nicht angelegt.

## Was das Projekt ist

Digitale Beschilderung für das City Cafe in Klagenfurt-Fischl: ein Dashboard im
Browser, das Widgets in einer Rotation zeigt (Nightlife-Videos, DJ-Streams,
Fußball, Wetter, Dart, das Kartenspiel Hos'n Obe, Roulette), dazu
Fernbedienungen fürs Handy und ein Aufpasser auf der Box, der Videos außerhalb
des Browsers abspielt.

Antwortsprache im Gespräch: Deutsch.

## Aufbau

| Datei / Ordner | Wofür |
| --- | --- |
| `index.html` | Das Dashboard selbst: Rotation, alle Widgets, Verbindung zu den Fernbedienungen |
| `fernbedienung.html` | Sammel-Fernbedienung: Startseite mit Kacheln (🎵 Musik, DJ, Roulette, Hos'n Obe, Chef: Übersicht), die Steuerung öffnet beim Antippen, „← Start" bzw. die Zurück-Taste führt zurück (seit 16.10.2026); zeigt nur Screens, die sich in den letzten 3 Tagen gemeldet haben |
| `yt-fernbedienung.html` | Musik-Fernbedienung: Jetzt, Suche (Songs/Playlists), Ähnliche, Listen, Mehr; Gast/Chef. In „Jetzt" oben nur Steuerung (⏮ ⏸ ⏭ ⇄ Blende; ⏮ in den ersten 10 s = Song davor) und Lautstärke; Zurück-Taste Schritt für Schritt, Radio-Mix in die Schlange übernehmbar (19.10.2026); Vollbild, Fotos/Shorts rechts, Ambilight, QR, Handy/Screen an die Anlage zugeklappt unter „⚙️ Anzeige & Anlage" (16.10.2026); Limiter unter Mehr → „🔊 Ton" (Überblendung seit 21.10.2026 fest 9 s, keine Einstellung mehr); Suche 🎵 Songs / 📃 Playlists / 📝 Lyrics (21.10.); DJ-Skin-Auswahl unter „⚙️ Anzeige & Anlage" (Chef, 21.10.); Fassung in der Fußzeile (`FASSUNG`) |
| `yt-fernbedienung-net.js` | Firebase-Pfade der Musik (`yt/…`, `chef/…`) |
| `yt-warteschlange.js` | Reihenfolge-Logik der Musik (Warteschlange, Radio, Vorschau), Tests in `yt-warteschlange.test.js` |
| `yt_playlists.json` | Stimmungs-Playlists nach Uhrzeit (1–4 mit festen Titellisten, 5–8 eigene Mixe) |
| `YOUTUBE-MUSIK-SETUP.md`, `docs/musik/` | Spec der Musik, Firebase-Regeln, Bilder |
| `dj-fernbedienung.html` | Twitch-Kanäle, Anmeldung über ein eigenes Fenster |
| `hosn-obe-engine.js` | Spiellogik des Kartenspiels, dazu `hosn-obe-engine.test.js` |
| `roulette/` | Gebaute Roulette-Seite (stammt von Codex) |
| `roulette-src/` | Deren Quelle (Vite + TypeScript) |
| `dj_channels.json`, `live_status.json`, `google-apps-script/dj-live-checker.gs` | DJ-Livestream-Widget (Twitch): Kanalliste, Live-Stand und der Checker, der ihn schreibt; siehe `DJ-LIVESTREAM-SETUP.md` und „Zustand der Bauteile" |
| `google-apps-script/dart-liga-scraper.gs`, `galerie.gs` | Dart-Liga-Tabelle (`dart_liga.json`) und Foto-Galerie aus Google Drive |
| `DART-LIGA-SETUP.md`, `HOSN-OBE-SETUP.md`, `NIGHTLIFE-SETUP.md`, `DJ-FERNBEDIENUNG-SETUP.md`, `KIOSK-SETUP.md`, `TWITCH-AUTOSTART-ANALYSE.md` | Einrichtung und Hintergründe der jeweiligen Widgets |
| `kiosk/` | Supervisor, sway-Konfiguration, Chromium-Starter der Box |
| `W1-UMSTELLUNG.md` | Einstellwerte (`CITYCAFE_*`) und Reihenfolge der W1-Einrichtung |
| `README.md` | Wegweiser über alle Bauteile |
| `FERNBEDIENUNGEN.md` | Wie die Fernbedienungen zusammenspielen |
| `KIOSK-SUPERVISOR.md` | Wie der Aufpasser auf der Box arbeitet |

Veröffentlicht wird über GitHub Pages (`motte025/City-cafe`). **Nach einem Push
dauert es oft 5 bis 15 Minuten** (am 09.10.2026 etwa 2), bis die neue Fassung
wirklich ausgeliefert wird — vorher mit `curl` auf eine Zeichenfolge aus dem
neuen Stand prüfen, statt sich auf den Push zu verlassen. Jeder Commit auf
`main` löst einen Pages-Build aus, auch die Auto-Commits des DJ-Live-Checkers.

## Geräte

Seit 30.09.2026 läuft der Kiosk auf dem **ACEMAGIC W1** (Ryzen 7 H255, Radeon
780M, 15 GB RAM). **Der alte ODROID ist seit 05.10.2026
weg.** Die Sparregel „box-shadow/filter/animation: none" in `index.html` ist
seit 06.10.2026 aus, die Effekte sind wieder Standard; `?fx=0` holt sie als
Notschalter zurück. Seit 07.10.2026 laufen auch Laufschrift und Regen im
Wetter-Widget während Videos weiter (vorher angehalten bzw. ausgeblendet, damit
der ODROID das Video schaffte). Der `chefTv`-Filter der Fernbedienungen (zwei Screens
im selben Raum) schadet nicht mehr, wird aber auch nicht mehr gebraucht.

**ACEMAGIC W1**, Zugang vom Beelink `ssh w1` (Benutzer `sabrina`, Schlüssel
`~/.ssh/citycafe_w1_ed25519`, `sudo` ohne Passwort über
`/etc/sudoers.d/10-sabrina`). Dual-Boot: EndeavourOS neben Windows, GRUB
startet nach 5 s EndeavourOS (im BIOS an erster Stelle), Windows ist im
GRUB-Menü wählbar. KDE ist installiert, sein Anmeldebildschirm aber
abgeschaltet; Ruhezustand/Standby sind gesperrt.

- **Kiosk-Benutzer `citycafe`**: Autologin auf tty1, `~/.bash_profile` lädt
  `~/.config/citycafe.env` und startet sway in einer Schleife. sway startet
  `citycafe-chromium`, den Supervisor und `citycafe-bt`.
- **Einstellungen je Gerät** in `/home/citycafe/.config/citycafe.env`:
  `CITYCAFE_RAUM=city-cafe` (Café),
  `CITYCAFE_HWDEC=vaapi`, mpv-Puffer 512/64 MiB, `CITYCAFE_CAM_CACHE_SECS=3`
  (Dartcam), `CITYCAFE_VOLUME=1.0`, `CITYCAFE_MIX_COOKIES=0` (Mixe ohne
  Konto, sonst Lobpreis-Lieder aus dem Verlauf), `CITYCAFE_URL=https://
  motte025.github.io/City-cafe/` (ausdrücklich, weil exportierte Variablen in
  der Login-Shell bleiben), `CITYCAFE_URL_EXTRA='&chefpin=…'` (Chef-PIN, **nur
  dort, nie im Repo**), Chromium mit VA-API-Schaltern. Ohne Variablen verhalten
  sich Starter und Supervisor wie früher (Raum `zuhause`).
- **Supervisor** `/opt/citycafe/nl-mpv-supervisor.py`: liest über die
  Debug-Schnittstelle (Port 9222) den Zustand des Dashboards und legt Videos,
  Twitch und Dartcam mit mpv passgenau über das Browserfenster
  (Hardware-Dekodierung VA-API). Er löst YouTube mit yt-dlp auf (Cookies aus
  dem Kiosk-Profil, YouTube Premium angemeldet), sucht für die Fernbedienung,
  räumt `/tmp` auf und startet den Browser neu, wenn er hängt. Beim ersten
  Auftritt eines Zyklus-Videos wählt er selbst einen zufälligen Startpunkt
  (Länge von yt-dlp); Wünsche vom Handy beginnen von vorn.
- **Strom für den B03 Pro (05.10.2026):** Er hing am TV-USB; der LG-TV schaltete
  sich per 4-Stunden-Automatik ab, der Strom fiel weg, der Empfänger hing danach
  und lehnte jede Bluetooth-Verbindung ab (Ton lief still zum TV). Jetzt: eigenes
  USB-Ladegerät, am LG die Abschaltautomatik aus. **Nicht** am USB des W1 als
  Soundkarte nutzen: am W1-USB-Verteiler knackte es laut (USB-Fehler -71,
  Masseschleife zur Anlage); der Betreiber will Bluetooth. (USB-Ton nur mit
  CITYCAFE_TON_USB=1.) Der Bluetooth-Wächter im Supervisor protokolliert alle
  10 s nach /home/citycafe/bt-waechter.csv; reißt eine Verbindung von selbst ab,
  versucht er höchstens 3-mal in ~2 Minuten neu (kein Adapter-Neustart) und warnt
  am Handy. **Wechsel Screen ↔ Handy** (im Café spielt auch das Handy auf den B03):
  Knöpfe im Jetzt-Reiter „📱 Handy an die Anlage" (W1 trennt und sperrt) und
  „🖥️ Screen an die Anlage" (W1 holt ihn zurück); danach kämpft der Wächter nicht.
  **Notfall-Handgriff, wenn der B03 hängt** (lehnt jede Verbindung ab, knackt,
  Kernel meldet „ACL packet for unknown connection handle"): Stromtrennen allein
  reichte am 05.10. nicht. Den Schalter am B03 einmal auf TX und zurück auf **RX**
  stellen, dann ging es. Danach war ein Neukoppeln nötig, weil die alte
  Kopplung gelöscht war (bluetoothctl mit Agent NoInputNoOutput: pair,
  trust, connect). Der LG-TV taucht selbst als Bluetooth-Gerät auf; der B03
  gehört nicht in seine Geräteliste.
- **Bluetooth zur Anlage**: Zwei 1Mii B03 Pro (Empfänger, RX) sind am W1
  gekoppelt (der zweite seit 05.10.2026, Bonded/Trusted); beide gehen mit
  dem W1 ins Café, dort ist also kein Koppeln nötig. Ein weiterer Empfänger
  müsste einmal gekoppelt werden
  (`bluetoothctl`: scan, pair, trust – mit Agent, sonst wird der Schlüssel
  nicht gespeichert); der Supervisor kommt mit mehreren gekoppelten zurecht
  („Verbinden" nimmt den ersten erreichbaren, wartet bis 20 s auf den Ton –
  soll ein bestimmter B03 spielen, nur diesen einschalten).
  **Verbunden und getrennt wird nur per Knopf** in der Handy-Fernbedienung
  (Wunsch des Betreibers): „Trennen" trennt und blockiert den Empfänger
  (sonst meldet er sich nach ~30 s von selbst wieder), „Verbinden" hebt die
  Sperre auf; die Kopplung bleibt, der Zustand übersteht Neustarts.
  „Verbunden" heißt: der PipeWire-Ausgang `bluez_output…` existiert, der Ton
  geht zur Anlage. `/usr/local/bin/citycafe-bt` (nur auf dem W1) verbindet
  nie selbst, es setzt nur einen neu aufgetauchten Bluetooth-Ausgang als
  Standard mit 100 % (CITYCAFE_VOLUME).
- **Fernzugriff (Tailscale, seit 05.10.2026):** Der W1 ist im Tailscale-Netz des
  Betreibers (Google-Konto) als „city-cafe-w1" (100.65.64.126), der PC als „motte".
  `ssh w1` geht darüber – zuhause und im Café (`w1-lokal` = altes Heimnetz
  192.168.0.42). `tailscaled` startet beim Hochfahren. „Disable key expiry" ist für
  city-cafe-w1 gesetzt, die Anmeldung läuft also nicht ab.
- **Nächtliche Aktualisierung** (`citycafe-update.timer`, täglich 8:30):
  `pacman -Syu`, dann Supervisor und Chromium-Starter aus GitHub `main`
  (nur nach Syntaxprüfung; abschaltbar in `/etc/citycafe-update.conf`),
  Neustart nur bei Änderungen. Protokoll `/var/log/citycafe-update.log`.
  **Was auf `main` liegt, landet also am nächsten Morgen auf dem W1.**
- Logs: `/home/citycafe/nl-mpv-supervisor.log`, `mpv-nl.log`, `mpv-xf.log`
  (Überblend-Player), `citycafe-bt.log`. Bildschirmfoto: `/usr/local/bin/kiosk-foto`
  (→ `/tmp/w1.png`). JavaScript in der Kiosk-Seite: `sudo -u citycafe kiosk-cdp
  "ausdruck"` (nur auf dem W1), z. B. `ytmBefehl({was:"stopp"})`.
- Auslastung (04.10., Musik im Vollbild): Prozessor ~7 %, RAM 2,3 von 15 GB,
  GPU ~22 %, CPU 54 °C. mpv ~4 % eines Kerns (AV1 per VA-API), mit
  Seitenhintergrund ~42 %.

**Selbst-Aktualisierung des Dashboards**: Es prüft alle fünf Minuten, ob sich
`index.html` auf GitHub Pages geändert hat, und lädt sich dann beim nächsten
Slotwechsel neu (nicht während Hos'n Obe oder eines Handy-Wunsches, auch
nicht während „Bis Stopp"). Abschalten mit `?autoupdate=0`.

**Beelink SER5** (zuhause, von hier aus wird gearbeitet) soll später ebenfalls
EndeavourOS bekommen und dann den Fernseher zuhause (`raum=zuhause`) zeigen.

Auf x86 rechnet das Roulette wieder live in voller Qualität — Sparmodus aus,
3D-Auflösung 100 %.

Verbunden sind Dashboard und Fernbedienungen über eine Firebase-Datenbank unter
`djremote/<raum>/`. Der Raum `zuhause` ist der Fernseher zuhause; dort läuft
auch das Roulette, im Café ist es nicht eingeblendet.

## Zustand der Bauteile

- **Rotation**: Endet ein selbst gestartetes Video oder ein DJ-Stream, übernimmt
  die Standardrotation sofort wieder, ohne dass an der Fernbedienung etwas
  gedrückt werden muss.
- **Fernbedienungen**: Schriftgrößen für Handy, Tablet und PC getrennt. Der
  Reiter „🎵 Musik" (früher „Videos") ist die neue Musik-Fernbedienung, siehe
  unten.
- **Chef-Übersicht** (`chef-zentrale.html`, 15.10.2026, erste Fassung): fünfter
  Reiter „📋 Übersicht" in `fernbedienung.html`, nur sichtbar auf Chef-Geräten
  (`chef/geraete/<uid>`, live mitgehört – nach der PIN-Anmeldung im Musik-Reiter
  erscheint er sofort). **Nur Anzeige, keine Befehle**, darum keine neuen
  Firebase-Regeln: was am Screen läuft (Hos'n Obe > Roulette > DJ > Musik >
  Handy-Video > Rotation), Screen-Herzschlag (still ab 150 s → rote Warnung),
  Bluetooth (`yt/jetzt/bt`), Verbindung des Handys, Warteschlange, DJ, Roulette,
  Hos'n Obe, mpv. Knöpfe unten schalten den Reiter der Fernbedienung um
  (postMessage `cc-teil`). **Firebase sparen:** abonniert nur Einzelfelder
  (nicht `laengen`, `gespielt`, Roulette-Zustand), geschätzt < 0,1 MB/h je
  offener Übersicht. Welcher Rotations-Slot gerade läuft, meldet der Screen noch
  nicht – dafür müsste `index.html` ein Feld mehr schreiben. Getestet mit
  Headless-Edge gegen die Live-Daten (Handy 390 px, Tablet 1024 px, kein
  Querscrollen; Gast sieht vier Reiter); am Handy des Betreibers bestätigt.
- **Hausprogramm „Demnächst bei uns"** (15.10.2026): Vollbild-Folie
  (`#hausprogramm-fullscreen`, z-index 600 wie Mittagsteller) mit bis zu drei
  eigenen Veranstaltungen aus **`werbung.json`** (`datum`, `ab`, `titel`, `zusatz`,
  `bis` in Wiener Zeit, `aktiv`). Slot `HAUSPROGRAMM_SLOT_INDEX` 0.5, 1 Minute je Zyklus, direkt
  nach dem Tag/Nacht-Plakat; ohne kommende Termine überspringt er sich. Marke
  „HEUTE"/„MORGEN", Eintrag fällt nach `bis` von selbst heraus. Die Datei wird je
  Slot frisch geholt – neue Termine brauchen nur einen Push von `werbung.json`, kein
  Neuladen. Abbau in `runMasterSequence()` eingetragen. Abschalten:
  `HAUSPROGRAMM_AN`. Läuft Musik „bis Stopp", steht die Rotation – die Folie
  erscheint dann nicht; dafür gibt es die Werbung rund um den Player (unten).
  **Seit 16.10.2026 auf einer „Bühne"** (`.cc-buehne-ebene`, `.cc-glow`,
  `.cc-buehne`): Inhalt in einer Fläche mit schwarzem, nach innen und außen weich
  auslaufendem Rand, dahinter Ambilight, vom Bildschirmrand her wieder Schwarz.
  Licht Aus/Cyan/Warm/Wechsel (`amb-*`, Wechsel = 30-s-Farbrunde), `rahmen-aus`
  macht die Fläche wieder randlos. Einstellbar am Chef-Handy: an/aus, Dauer
  20 s–3 min, jede/jede 2./jede 3. Runde (`jede`, `werbungDiesmal`), Rahmen, Licht.
- **Plakate** (16.10.2026): fertige 16:9-Bilder aus `werbung.json` `plakate`
  (`datei`, `titel`, `aktiv`), je Zyklus eines reihum, Slot `PLAKAT_SLOT_INDEX`
  0.6 direkt nach der großen Folie (`runPlakatState`). Bilder laufen **unverändert
  und randlos** (Wunsch Betreiber; Rahmen am Handy zuschaltbar). Heute:
  `jaegermeister_aktion_tv.jpg`, `spirituosen_tv.jpg` (von Codex). Fehlt eine
  Datei, geht es sofort weiter. Am Chef-Handy: an/aus, Dauer, wie oft, Rahmen, Licht.
  Die Übersicht hat seit 16.10. auch A−/A+ (gleicher Speicher `fbZoom` wie Musik).
- **Werbung rund um den Musik-Player** (Vollbild, 15.10.2026,
  `musikWerbungTakt`, sekündlich): in jedem 120-s-Takt Sekunde 0–29 statt
  „Ähnliche Songs" die Leiste **„📅 Demnächst im City Cafe"** (Termine aus
  `werbung.json`), Sekunde 60–89 statt der Warteschlange die Karte **„🍻 Unsere
  Aktionen"** (`aktionenBild` + `aktionen` mit `titel`/`preis` aus
  `werbung.json`). „Nächster Titel" und Video bleiben immer; auf die Videofläche
  kommt kein HTML (mpv). Nur Klassen `wb-unten`/`wb-rechts` am `#ytm-vollbild`, die
  Musik-Darstellung selbst ist unverändert. Daten während der Musik alle 10 min
  frisch. Abschalten: `MUSIK_WERBUNG_AN` (`?mwan=1` zum Ansehen, wenn aus). Nur im
  Musik-**Vollbild**, nicht in der Widget-Ansicht. Getestet mit Headless-Edge
  (gestellte Uhr, Firebase gesperrt).
- **Werbe-Schalter am Chef-Handy** (15.10.2026): In der Chef-Übersicht Bereich
  „📢 Werbung am Screen" → `djremote/<raum>/werbung/einstellung`
  (`musik.modus` aus|zeitweise|durchgehend + `musik.alleMin` 1/2/5/10;
  `folie`, `willkommen` (Tag/Nacht-Plakat), `getraenke` (Jäger/Puntigamer) je
  `an` + `dauerS`). Der Screen hört live darauf (`werbungEinstellungHoeren`),
  fehlende Werte = `WERBUNG_VORGABE` (Verhalten von vorher; Dauer auf 5 s–10 min
  begrenzt). **Arbeitsteilung (Wunsch Betreiber):** Der Betreiber schaltet nur
  an/aus und wie oft/lange; neue Termine und Aktionen trägt Claude in
  `werbung.json` ein. **Firebase-Regel** `werbung` (nur Chef-Geräte schreiben) steht
  in `docs/musik/firebase-regeln.json` und muss in der Konsole ergänzt werden –
  bis dahin fällt der Pfad unter `$sonst` (jede Anmeldung darf schreiben).
  16 Prüfungen mit Headless-Edge bestanden (Handy-Schalter, alle Modi am TV,
  Abschalten/Dauer je Plakat, Grenzwerte).
- **QR-Codes am TV öffnen nur ihr eigenes Ziel** (Wunsch Betreiber 15.10.2026):
  „Song wünschen" führt seitdem direkt zu `yt-fernbedienung.html?raum=…` statt zur
  Sammel-Fernbedienung (dort hätten Gäste auch DJ, Roulette-Wecken und Hos'n Obe
  gesehen). Als Gast: nur Suchen, Wünschen (2 je Gerät), eigene Wünsche
  zurückziehen; Screen-Wahl dort nur noch für den Chef. Hos'n Obe öffnet wie
  bisher nur `hosn-obe.html?session=…`, DJ (QR-Slot, aus) nur
  `dj-fernbedienung.html`. **Echter Schutz** gegen Gäste, die eine andere Adresse
  von Hand aufrufen, kommt erst mit dichteren Firebase-Regeln (Offene Punkte).
- **Musik-Werbung auch in der normalen Ansicht** (15.10.2026): eigene Karte
  `#ytm-werbung` über der rechten Seitenkarte (Fotos/Shorts/Ähnliche laufen
  darunter weiter), Body-Klasse `wb-karte`. Gleicher Takt wie im Vollbild: Termine
  in der ersten, Aktionen in der zweiten Takthälfte; bei „Immer" wechselt die eine
  Karte alle 30 s zwischen Terminen und Aktionen. 11 Prüfungen mit Headless-Edge
  bestanden (Termine, Aktionen, Pause, Aus, Immer-Wechsel).
  Getestet mit Headless-Edge und gestellter Uhr (15./16./17.10., 1.11.), Firebase
  dabei gesperrt.
- **YouTube-Musik** (Spec `YOUTUBE-MUSIK-SETUP.md`, seit 03.10.2026 auf `main`,
  Firebase-Regeln und Chef-PIN eingetragen). Gäste wünschen per Handy, der
  Chef (PIN) steuert; der TV ist die einzige Quelle der Reihenfolge
  (`yt-warteschlange.js`, 110 Checks).
  - **Ablauf:** Musik läuft bis Stopp (keine Zeitgrenze; ist nichts da, startet
    die Playlist zur Uhrzeit). Gästewünsche frühestens auf Platz 5. Ist die
    Schlange leer, läuft der Radio-Mix; „Ähnliche Songs" folgt jedem neuen
    Titel. Die Vorschau („Als Nächstes", „Danach") rechnet wie `weiter()`
    und zeigt damit die echte Reihenfolge. Hos'n Obe ist während der Musik
    gesperrt; der Dart-Abend beendet sie, außer der Chef startet sie dabei.
  - **DJ-Funktionen (Supervisor):** ⚠️ seit 21.10.2026 (Branch `dj-skins`): Überblendung **fest
    9 s**, Tonwechsel genau am Musikende des alten / am Einsatz des neuen – Details im Abschnitt
    „21.10.2026“ oben; der folgende Absatz beschreibt die Fassung bis dahin.
    Echte Überblendung (4/6/9 s am Handy, zweiter mpv,
    gleichbleibende Gesamtlautstärke, Bild per sway-Opacity; Pause/Skip/Stopp
    mittendrin sauber). Der Musikbeginn des neuen Songs fällt in die **Mitte**
    der Blende (kein Lautstärkeloch, höchstens −3 dB). Chef kann am Handy mit
    ⇄ Blende mitten im Song überblenden. Vorladen 40 s vor Ende; die nächsten 3 Songs
    der Schlange werden schon vorab gemessen (eigener Arbeiter), damit
    Umstellen kurz vor Schluss trotzdem stimmt.
  - **Songbeginn und -ende (Stand 05.10.2026, Test mit 100 Songs):**
    - *Studio-Abgleich:* Die Studiofassung (Audio-Upload, Länge wie bei
      iTunes) wird gesucht und ihr Anfang (40 s, Bass-Hüllkurve; gekürzte
      Radio-Fassungen über 20 s mit voller Ton- und Bass-Übereinstimmung)
      sowie ihr Schluss (letzte 25 s) per Kreuzkorrelation im Video
      gefunden. Trifft bei rund der Hälfte der Songs (Be Mine 14,2 s,
      Maneater 87,3 s, Grace Kelly 18,1 s, Blame 41,2 s).
    - *Rückfall:* Pegel-Regel (Start bei 3 s fast normaler Lautstärke,
      höchstens so viel wie das Video länger als der Song laut iTunes ist,
      sonst 35 s); Ende 6 dB unter normal; Pause ≥ 2 s mit ≤ 15 s Nachspann
      danach zählt nicht mehr zum Song (Michelle „So oder so").
    - Studio-Ende früher als die Pegel-Regel gilt nur mit Bruch danach
      (sonst ist das Video eine längere Fassung); deutlich später → leiser
      Schlussteil bleibt, höchstens 10 s vor dem Studio-Ende.
    - Grenze: Video mit anderer Abmischung als jede Studiofassung (Hallo
      kleine Maus) → nur Pegel-Regel.
  - **Lautstärke (seit 16.10.2026; Ziel seit 21.10. auf `dj-skins` −14 statt −11 LUFS, alle 79
    nachgemessenen Songs innerhalb ±1,5 dB – Abschnitt „21.10.2026“):** jeder Song wird auf dieselbe
    Hörlautstärke gebracht – gemessen als Lautheit nach EBU R128 (ffmpeg
    `ebur128`, ganzer Song), Ziel **−11 LUFS** (`LAUT_ZIEL_LUFS`), über mpv
    `volume-gain`: laute Songs werden abgesenkt, leise angehoben (je bis
    15 dB), nie über die Spitzen (1 dB Reserve – Betreiber will **keine
    Übersteuerung**). Test mit 458 Playlist-Songs: Original
    −29 bis −5 LUFS; mit der alten Regel (nur leise anheben, grober RMS-Pegel)
    lagen 39 % innerhalb ±1,5 dB, ohne Limiter 79 %. Für leise Songs mit
    Spitzen nahe 0 dBFS (z. B. Hey Mama, One Kiss) holt ein sanfter Limiter
    (`alimiter`, −1 dBFS) **höchstens 2 dB** mehr heraus (Wunsch Betreiber:
    nur 2 dB) – im Test bei 118 von 458 Songs, nur an deren lautesten
    Spitzen; damit 92 % innerhalb ±1,5 dB. Mit Limiter steckt die ganze
    Verstärkung im Filter (mpv rechnet `volume-gain` erst nach den Filtern).
    Am Handy (Chef, 🔊 Ton) abschaltbar.
  - **Neuladen (16.10.2026 behoben):** Das Selbst-Update lädt die TV-Seite neu.
    Dabei startete (1) der letzte DJ-Befehl aus der Datenbank neu (DJMissShelton
    vom 01.10.) – jetzt wie bei der Musik: Befehle älter als 2 min zählen nicht –
    und (2) die gestoppte Playlist, weil ihre Titel beim Stopp in der Schlange
    bleiben – jetzt starten beim Laden nur echte Wünsche nach dem Stopp. Getestet
    am TV: Playlist starten, stoppen, neu laden → bleibt aus.
  - **Überblendung am Handy einstellbar (16.10.2026; seit 21.10. auf `dj-skins` entfernt – fest 9 s,
    genau berechnet):** kurz 4 s (Standard),
    mittel 6 s, lang 9 s. Mit den bisherigen festen 9 s liefen beide Songs
    rund 4 s fast voll übereinander und die Beats schlugen sich.
    Dazu DJ-Kurve: der Ton wechselt nur in einem 2-s-Fenster um den
    Musikbeginn des neuen Songs (beide hörbar laut nur ~0,5 s), das Bild
    blendet über die ganze Länge.
  - **Ton allgemein:** Der alte Ton-Ausgleich (dynaudnorm) ist abgeschafft.
    Bluetooth und W1 stehen auf 100 %, die Lautstärke stellt der Betreiber
    selbst am Handy ein (ab 70 % in 3er-Schritten). Seit der LUFS-Angleichung
    sind laute Songs 2–4 dB leiser – die Handy-Lautstärke entsprechend höher.
    Messwerkzeug fürs nächste Mal: Audio mit `yt-dlp` am PC laden (nicht über
    die Box, schont YouTube-Kontingent und Café-IP), `ffmpeg -af ebur128=peak=true`.
  - **Titelsuche begrenzt (16.10.2026):** Fand der TV zu einem Radio-Titel
    (Last.fm, ohne Video) nichts, suchte er alle 2–3 s neu, solange der Titel
    vorn stand (The Strokes: 60 Suchen in 3 min). Jetzt höchstens 3 Versuche
    je Suchtext (`ytmFindeFehlschlaege`).
  - **Richtige Videos:** offizielle Videos (Künstler-Kanal, VEVO, Label)
    werden überall bevorzugt: Suche sortiert Live/Fan/Lyric/Audio ans Ende,
    der TV prüft jeden Song der Warteschlange vor dem Abspielen und tauscht
    Topic/Lyric/Live/TV-Auftritt/Fan-Upload gegen das offizielle Video
    (`musikvideo_wertung` mit Suchtext, `ytmKeinMusikvideo`). Making-of,
    Teaser, Reportagen fliegen raus. Kein H.264-Zwang mehr (AV1/VP9).
    Interpret/Titel aus rohen YouTube-Titeln (`titelZerlegen` in
    `yt-warteschlange.js`, 110 Checks): auch „--" als Trenner und Interpret
    hinten („Doch du willst mich - Mike Leon Grosch", Kanal „Grosch Music"),
    erkannt am gemeinsamen Wort mit dem Kanal (ohne Klammern). Die Datei wird
    mit `?v=…` geladen, damit Handy und TV neue Fassungen sofort holen.
  - **Bild:** Seitenbalken (4:3, Hochformat, auch eingebrannte) werden mit dem
    unscharfen Video gefüllt; schwarzer Kontrastrahmen (2 px + 30 px Verlauf)
    als mpv-Overlay; Ambilight (4×/s per `grim`) normal und Vollbild;
    Auflösungsschild aus dem laufenden Player. mpv startet unsichtbar und
    erscheint erst, wenn es sitzt; Normal/Vollbild über den Umschalt-Wächter
    (erst ausblenden, dann umbauen); `--keepaspect-window=no`.
  - **TV:** Überschrift „Interpret – Titel" (Widget fest 36 px, Vollbild
    48 px, gekürzt statt verkleinert), Cover in allen Listen (YouTube-Bild,
    sonst Datenbank/iTunes), rechte Karte per Handy „Ähnliche Songs", Drive-Fotos
    oder **YouTube Shorts** (Knopf „📱 Shorts rechts", `yt/jetzt.seite` =
    songs|fotos|shorts). Shorts (seit 09.10.2026): stumm, hochkant vor
    unscharfem Standbild; Auftrag über den Suchweg der Handy-Suche
    (`window.nlSucheAuftrag`, Kennung `tvs-`, `art: "shorts"`, die Treffer gehen
    nicht ans Handy). Der Supervisor (`shorts_suchen`) nimmt den Shorts-Reiter
    der Kanäle des laufenden und der nächsten 3 Songs, dann des offiziellen
    Künstlerkanals (Cache 6–24 h); erst wenn die nichts Neues haben „schlager
    party", „apres ski", „oktoberfest", dort nur per yt-dlp bestätigtes
    Hochformat. Sperre für News/Boulevard (BILD, RTL, Promiflash, Unfall …).
    Das Dashboard nimmt nur Treffer mit `hochkant: true`. Beim Songwechsel sofort
    eine Vorrang-Suche nur für den neuen Song (`vorrangFuer`): dessen Shorts kommen
    vorne in die Reihe, der Vorrat bleibt als Reserve (geprüft: Kesha → 39 Shorts
    in 10 s); sind sie da, wird sofort umgeschaltet. YouTube-Einblendungen weg:
    Player ringsum ~7 % beschnitten (Titelzeile oben, „Shorts"-Logo/Teilen unten),
    beim Start 2,5 s verdeckt (Pause-Symbol), `pointer-events: none` (sonst
    Pause-Symbol beim Kiosk-Mauszeiger), Untertitel-Modul wird entladen (das
    Premium-Konto blendete automatisch übersetzte Untertitel ein). Player doppelt so groß
    gerechnet und halbiert → hd720 statt 360p. Einbetten verboten → nächster
    Short; pausiert im Vollbild und bei Hos'n Obe/Roulette; Rückmeldung
    `yt/jetzt.shorts` = ok|suche|leer. **Auf der Box geprüft 09.10.2026:** 40
    Shorts vom Kanal in ~5 s, 60 fps ohne Ruckler, GPU ~25 %, CPU ~8 % neben mpv.
    (Die erste Fassung suchte „<Künstler> #shorts" und zeigte Querformat und
    BILD-Clips.) Vollbild: „NÄCHSTER TITEL"
    (früher „Gleich dran") und „WARTESCHLANGE" (früher „Danach"). Widget: Leiste „Als Nächstes" mit
    Interpret 24 px; Überschrift bis 880 px, das Auflösungsschild sitzt klein
    eine Zeile tiefer links neben dem Logo. Die Werbe-Abdeckung
    (`nl-player-hint` mit Titel) ist aus, solange mpv spielt
    (`body.video-extern`) – sie schien sonst mitten in der Überblendung durch.
    QR „Song wünschen" (seit 09.10.2026 schaltbar) ist standardmäßig aus (`YT_QR_AN = false`), der Chef schaltet ihn
    am Handy mit dem Knopf **🔳 QR-Code / QR aus** (Reiter „Jetzt", neben Ambilight) im
    Video ein und aus: Befehl `musik`/`qr` (`an: true|false`), Rückmeldung `yt/jetzt.qr`.
    Die Wahl merkt sich der TV im Browser-Speicher (`ytm-qr-an`) und behält sie nach
    Neustart; das gebaute QR-Bild wird beim Aus/Ein wiederverwendet.
  - **Handy:** „🔀 Mischen" (Chef, seit 09.10.2026, `YTW.mischen`): Playlist-Titel
    der Schlange zufällig, der nächste Song (schon vorgeladen/vermessen), Wünsche und
    „Als Nächstes" bleiben; gleicher Künstler nach Möglichkeit nicht hintereinander.
    Suche nach Songs oder Playlists (Playlist öffnen, einzelne Titel
    nehmen), ⋯-Menü je Song (Ab hier abspielen, Sofort, Als Nächstes, An 5.
    Stelle, Radio-Mix starten, Ende, Zu Playlist hinzufügen), Radio-Mix zum
    laufenden Song, Warteschlange bereinigen (✕ links, ☰ rechts),
    Fortschrittsbalken antippen, Überblenden ⤨, Lauter/Leiser (bis 70 % 5er-,
    darüber 3er-Schritte, max. 100 %), Player zeigt die laufende Playlist,
    Fotos/Shorts/Ambilight/QR-Code/Vollbild, „Musik beenden". „Passt dazu", Suche und
    Playlists mit Vorschaubild; darunter über die volle Breite Titel,
    Interpret · Dauer und „Art · Aufrufe · Kanal" (Art: Video/Audio/Lyric/
    Live/Remix). **Aufrufe** nur am Handy: Suche liefert sie, beim Radio-Mix
    holt sie der Supervisor nach (`aufrufe_ergaenzen`, 4 parallel, gemerkt),
    in `yt_playlists.json` stehen sie je Eintrag. Schriftgröße **A−/A+**
    oben rechts (ganze Seite, je Gerät gemerkt, Tablet startet 120 %).
    ⋯-Menü zweispaltig. Player oben rechts **📃＋**: laufenden Song zu einer
    Playlist. Knöpfe „📱 Handy an die Anlage" / „🖥️ Screen an die Anlage". Steuerung
    geht auch außerhalb des WLANs (`?raum=city-cafe`). Bildschirme in der
    Auswahl: City Cafe, Zuhause („musiktest" am 05.10. gelöscht).
  - **Playlists am Handy bearbeiten (Chef):** Songs löschen, verschieben,
    hinzufügen (Ende oder Platz 5), „↺ Original wiederherstellen". **Eigene
    Playlists** anlegen („➕ Neue Playlist", Nummern ab 101, `eigen: true`,
    der TV nimmt sie in `ytmPlaylists` auf). **Jede Playlist löschbar**:
    eigene ganz, feste werden nur ausgeblendet (`geloescht: true`, unten im
    Listen-Reiter mit ↺ zurückholbar; der TV überschreibt die Markierung nicht). Gespeichert
    in Firebase `yt/listen/<nr>` mit `bearbeitet: true`; diese Fassung geht
    der aus `yt_playlists.json` vor. **Achtung:** Wer eine bearbeitete
    Playlist im Repo ändert, muss die Änderung auch in `yt/listen/<nr>`
    nachziehen (so geschehen bei Playlist 6 am 05.10.).
  - **Playlists (`yt_playlists.json`, feste Titellisten mit videoId):**
    1–4 feste Titellisten (seit 09.10.2026, nach Stimmung aus den Titeln von 5–8
    zusammengestellt, jede videoId einmal je Liste; die Einordnung ist eine
    Einschätzung und am Handy änderbar): 1 „Party Hits" (250, 21–8 Uhr), 2 „Schlager" (219, 17–21 Uhr),
    3 „Après-Ski" (155, ohne Uhrzeit), 4 „Chill" (126, 8–17 Uhr); 5 „Mix
    04.10.2026" (210, moderne Schlager / internationale / deutsche
    Party-Hits 2-2-2); 6 „Mix 04.10.2026 (2)" (200, Stil der Betreiber-Liste
    05.05.2024: Latin, Dance, 80er/90er, Pop, Deutsch/Austro; am Handy
    bearbeitet); 7 „Klausi" (144, Nachbau der Apple-Music-Playlist „City
    Café", gleiche Reihenfolge); 8 „Schlager 2024–2026" (142, nach den Schlager-Charts: DDP-Jahrescharts 2024/2025,
    Schlager-Jahres-Charts 2025, DDP Top 100 Okt. 2026 – 119 Chart-Hits plus meistgesehene,
    alle Stereoact-Remixe, höchstens 5 je Interpret, nie zweimal derselbe hintereinander;
    ohne Ballermann). Am 05.10. wurden 12 Fan-/TV-Einträge durch
    offizielle Videos ersetzt. `ytmListeMelden` lädt je Liste höchstens 250
    Titel nach `yt/listen` (Liste 1 hat genau 250). Die neuen Listen 1–4
    erreichen das Handy erst nach dem nächsten Laden der TV-Seite; war eine
    davon am Handy bearbeitet oder gelöscht, gilt weiter die Firebase-Fassung.
- **Firebase (Gratis-Tarif, 10 GB/Monat):** Status und „Jetzt" werden nur bei
  Änderung geschrieben (Jetzt: Positionssprung > 3 s oder alle 30 s, Status-Herzschlag
  60 s), das Handy zählt die Position selbst. Vorher ~40 MB/h je offenem Handy, jetzt
  ~1,5 MB/h. Ein alter Bildschirm (vermutlich der ODROID im Café) schreibt noch in
  denselben Raum, bis er die neue Seite lädt; am besten abstecken.
  Roulette (seit 07.10.2026): Status nur bei Änderung, sonst Herzschlag alle 5 s
  (Fernbedienung gilt nach 6,5 s ohne Nachricht als getrennt, Dashboard nach 15 s);
  Einstellungen, letztes Spiel und TV-Daten auf eigenem Kanal `roulette/selten`, nur
  bei Änderung/neuer Verbindung. Gemessen je Fernbedienung: Spielmodus 14,7 → 2,3 MB/h,
  Zyklus ~14 → 0,8 MB/h. Leistung am W1 im Spiel: 60 fps ohne Ruckler, GPU 30–36 %,
  CPU ~5 %, unter 40 °C. Roulette-Einstellungen liegen im Kiosk-Browser
  (localStorage `atelier-show-settings`), Sicherung der alten in
  `/home/sabrina/roulette-settings-backup-2026-10-07.json`.
- **YouTube-Musik, offen:** Auf der Box prüfen (09.10.2026 nur mit
  Headless-Chromium und Firebase-Ersatz getestet): QR-Schalter am Handy, Playlists 1–4
  (Reihenfolge, Uhrzeit-Automatik: 21–8 Uhr Party Hits, 17–21 Schlager, 8–17
  Chill). Test der Dart-Ausnahme an einem Dart-Abend. Einige Songs haben nur
  TV-/Live-Fassungen (Rosanna Rocci „Solo con te", Draufgänger „Marie", CCR
  „Proud Mary" – bleiben vorerst).
- **DJ-Livestream-Widget (Twitch)**, Slot an (`DJ_SLOT_AN`, `NL_SLOT_AN`):
  Das Dashboard fragt Twitch nicht selbst ab, es liest alle 3 Minuten
  `live_status.json` von `raw.githubusercontent.com` (Stand älter als 45
  Minuten = Slot aus). Geschrieben wird die Datei vom Apps-Script
  `google-apps-script/dj-live-checker.gs` (Takt 5 Minuten, liest die Kanäle in
  Music/DJs, denen der Account motte025 folgt): Commit auf `main` nur bei
  Änderung der Live-Liste, dazu alle 15 Minuten ein „Herzschlag", solange
  jemand live ist (09.10.2026: JULIAONAIR, JenniferLeeDj). **Folgen:** in 7
  Tagen 351 von 400 Commits automatisch (49 sonstige), jeder löst einen
  Pages-Build aus (über 11 700 Läufe insgesamt), `main` bewegt sich bis zu
  4-mal pro Stunde (vor jedem Push `git pull --rebase`), ein neuer Stream
  erscheint nach wenigen bis etwa 13 Minuten (5-Minuten-Takt, 5 Minuten Zwischenspeicher bei
  GitHub, 3 Minuten Abfrage im Dashboard). `index.html` ändern die Auto-Commits
  nicht, die Selbst-Aktualisierung löst dadurch nicht aus. Der GitHub-Token
  im Apps-Script darf das ganze Repo schreiben und wird mit dem Song-Collector
  geteilt, siehe „Offene Punkte".
- **Nightlife/YouTube**: Zyklus-Videos steigen zufällig ein (4-Minuten-Slot).
  Wünsche vom Handy beginnen von vorn und laufen die gewählte Zeit; „Bis
  Stopp" läuft bis Stopp, neuem Wunsch oder Videoende (vorher brach es nach
  4 Minuten ab, behoben 01.10.). Ein Wunsch ohne Ort zeigt seinen Titel groß
  in der Überschrift, darunter „Per Fernbedienung gestartet".
- **Vollbild-Ansichten außerhalb von `.media-inner-view`** (CL-Tabelle
  `#ucl-fullscreen-table`, Mittagsteller, Dart-Anheizer)
  muss `runMasterSequence()` selbst abbauen – ihr eigener Zeitgeber geht bei
  einem Wunsch vom Handy (`cancelSequenceTimers`) verloren. Die CL-Tabelle
  fehlte dort und blieb über Nightlife und mpv stehen (behoben 01.10.).
  Wer eine neue Vollbild-Ebene einbaut, trägt sie dort mit ein.
- **Veranstaltungen in Kärnten** (großes Widget, `KAERNTEN_EVENTS` in
  `index.html`): Stand 01.10.2026, Termine bis Silvester. Jeder Eintrag hat
  ein Enddatum `bis`; danach fällt er nach Wiener Datum von selbst heraus, bei
  leerer Liste wird der Slot übersprungen. **Spätestens im Dezember neue
  Termine für 2027 eintragen** (nach dem 31.12. ist die Liste leer). Offen:
  Uhrzeit Krampuslauf (ca. 19:00 aus der alten Liste), genauer Saal
  „Dunkelgraue Lieder" in Villach.
- **Hos'n Obe**: Reihenfolge im Uhrzeigersinn, eigene Tischfotos als
  Hintergrund, Kartengeber mit Talon, Rundenanzeige rechts oben, Schluss nach
  acht Runden mit an die Spielerzahl angepasstem Zeitbudget. Der Computer
  spielt eine Partie immer zu Ende, auch wenn er nicht mehr gewinnen kann. Ein
  laufendes Spiel wird von YouTube und Twitch nicht unterbrochen.
- **Roulette im Dashboard (seit 05.10.2026 wieder)**: im Café (`city-cafe`) und
  zuhause (`zuhause`), andere Räume und `?roulette=0` ohne. **Seit 07.10.2026
  wieder in der Rotation** (`ROULETTE_IN_ROTATION` in `index.html`; am 05.10.2026
  mittags kurz nur per Handy). Schon das Antippen des Roulette-Reiters
  weckt (Serverzeit, nicht Handy-Uhr). Immer im Vollbild
  (`#roulette-fullscreen` über dem ganzen Dashboard). Fester Slot nach
  den Musik-Slides (`ROULETTE_SLOT_INDEX` 9.5): mindestens 4 Minuten, danach
  so lange die Seite „läuft noch" meldet (Zyklus, Spiel, Siegerfeier),
  höchstens 2 Stunden. Steht der Kessel auf Pause oder ist ein Spiel gerade
  zu Ende, bleibt das Roulette noch bis zu 15 Minuten stehen (vorher
  verschwand es nach dem Spiel sofort). Dazu holt „🎰 Roulette am Screen starten" im
  Roulette-Reiter der Sammel-Fernbedienung es sofort an den Screen
  (`djremote/<raum>/roulette/wecken`, gilt 1 Minute). Der Weckruf geht immer
  durch, nur eine laufende Runde Hos'n Obe hat Vorrang: Musik pausiert wie bei
  Hos'n Obe und läuft danach weiter, Video- und DJ-Wunsch enden, Dart-Abend
  und Anheizer machen danach weiter (`rouletteVorrang`). Gezeigt wird der
  Spielmodus `roulette-vorschau-spiel/` (dieselbe Seite wie die Handy-
  Fernbedienung), nicht `roulette/`. Lokal nur über `localhost` testen —
  unter `127.0.0.1` lässt Firebase die Seite nicht verbinden.
- **Roulette**: Codex' Modul. Der
  Kessel gehört schräg dargestellt: `topView` aus, `correction` an, Helligkeit
  `0.8`, Radgröße `zoom` `0.96` (im localStorage unter
  `atelier-show-settings`).
- **Roulette-Kugel**: eigene deterministische 3D-Physik (Rollen, Stöße,
  Reibung, Schwerkraft) statt Keyframe-Animation. Die Zielzahl wird bei
  Countdown-Start gezogen (`randomIndex()`, Web Crypto); die passende
  Bewegung wird geseedet im Hintergrund gesucht (Web Worker, sonst gestückelt
  im Hauptthread). Findet die Suche nichts rechtzeitig, läuft die alte
  Keyframe-Animation als Rückfallebene — sie zeigt immer die richtige Zahl.
  Regler „Einlauf min./max. Taschen“ (Standard 5/15, Bereich 3–20).
  Drei Zierringe (r 2,93 / 2,47 / 2,025) standen 1,7–2,7 mm über den
  Flächen, über die die Kugel rollen muss; auf Wunsch des Betreibers jetzt
  auch im sichtbaren 3D-Modell bündig abgesenkt (zuvor nur in der
  Kollisionsrechnung). Details, Messwerte und offene Abweichungen:
  `roulette-src/TESTBERICHT.md`.
  **Bug (behoben):** Das bündig Absenken hatte einen zu knappen
  Sicherheitsabstand (0,15 mm) hinterlassen — am echten Gerät zeigte sich am
  Ring r=2,93 (Außenkante der Laufbahn, genau dort wo die Kugel rollt) eine
  flackernde Linie mit Bildfehlern ("Z-Fighting"). Behoben: Abstand auf
  0,24 mm erhöht plus `polygonOffset` auf dem Ring-Material als zweite,
  GPU-unabhängige Absicherung.
  Neu in der Fernbedienung: zwei Regler „Rauten radial/tangential ·
  Widerstand“ (0–100 %, Standard je 15 %). 0 % = kein Widerstand (Kugel
  prallt verlustfrei ab), 100 % = totaler Widerstand (kein Rückprall,
  maximale Reibung). Die acht Rauten wechseln sich radial/tangential ab.
  **Nur in `roulette-src` (Quellcode), noch NICHT in `roulette/` gebaut und
  deployed** — zurückgehalten, solange vom ODROID auf den W1 gewechselt wurde.
  Der Wechsel ist seit 30.09. erledigt; ob und wann gebaut wird, entscheidet
  der Betreiber. Vor dem nächsten Deploy: `npm run build` in `roulette-src`,
  dist nach `roulette/` kopieren.
  **Zwei Modell-Vorschauen zur Auswahl** (beide isoliert, Dashboard
  unberührt): **Modell A** (`roulette-vorschau/`) — wie bisher: Zahl wird
  vorab gezogen, die Suche bevorzugt jetzt aber Rautentreffer statt sie zu
  meiden (deutlich mehr, aber nicht garantiert mehr Aktion; Rechenzeit
  dadurch etwas höher, ~450–550 ms/Wurf). **Modell B** (`roulette-frei-src`
  → `roulette-vorschau-frei/`) — echter freier Wurf: keine Zielzahl, keine
  Suche, ein einziger Simulationslauf, Ergebnis ist, wo die Kugel
  tatsächlich liegen bleibt; niemand (auch der Code nicht) kennt die Zahl
  vorher. Dadurch natürlich deutlich mehr Rautentreffer (~75 % der Würfe)
  und schneller (~30 ms/Wurf), aber Rundendauer (grob 11–20 s statt exakt
  16±3 s) und „Einlauf min./max. Taschen“ sind dort keine exakten Vorgaben
  mehr, sondern Ergebnis der Physik. Modell B ist nur oberflächlich
  getestet (kein voller Testlauf wie bei `roulette-src`), da reine
  Entscheidungsvorlage.
- **Roulette-Spielmodus** (27.09.2026, erster Versuch): 2–12 Spieler, Modi
  „Runden“ (höchste Summe) sowie 51/101/151/201/301/501 (101 und 151 seit 05.10.2026, 51 seit 07.10.2026) (genau treffen, Runde wird
  fertig gespielt, überworfen zählt nicht, ab 36 Rest wird die Ausmach-Zahl
  angezeigt), Rundenzahl 3–30 wählbar
  (bei 301/501 auch ohne Limit). Beginner wird ausgelost, Sieger 3 Minuten mit Feuerwerk,
  Konfetti und Treppchen gefeiert, danach normaler Zyklus. Standardzyklus
  jetzt 30 Runden, Tempo 4 s Pause / 12 s Kugel (nur Quelle + Vorschau); ist ein
  Zyklus durch, beginnt nach 1 Minute von selbst der nächste (seit 07.10.2026). Nur per Fernbedienung
  aktivierbar, Punktetafel links am TV (nach Punkten sortiert; Wurf-Nummer vor jedem
  Namen, ▸ = kommt als Nächstes, seit 07.10.2026). Reihenfolge: Beginner wird ausgelost
  (Nummer 1); mit eingetragenen Namen auch die übrigen Nummern zufällig, ohne Namen
  reihum nach Spielernummer (Spieler 3 → 4 → 1 → 2). „Live am Tisch“ steht immer über
  der Kesselmitte. Der Computer dreht reihum, das
  Ergebnis bleibt reiner Zufall. Beschreibung: `roulette-src/README.md`.
  Steht in `roulette-src` und ist **nur** nach `roulette-vorschau-spiel/`
  gebaut — `roulette/` (das Dashboard) ist bewusst unberührt, weil ein Neubau
  dorthin auch Schriftring, Rauten-Widerstand und Modell A mitbringen würde.
  Seit 05.10.2026 lädt das Dashboard genau diese Fassung (siehe oben).
  Zum Ausprobieren ohne Screen: TV `roulette-vorschau-spiel/?raum=spieltest`,
  Handy `roulette-vorschau-spiel/remote.html?raum=spieltest`.
- **Schriftring "CITY-CAFE KLAGENFURT"**: goldener, umlaufender Schriftzug auf der
  inneren Kesselfläche, ganz außen direkt an der Kante zum Zahlenkranz
  (r 1,02–1,525, dieselben Eckpunkte wie die Fläche darunter, folgt also exakt
  deren Neigung auch über den Knick bei r=1,36 hinweg), dreht mit dem Rotor
  mit. Doppelt so groß wie die erste Fassung. Dreimal wiederholt mit
  Sternchen als Trenner, nahtloser Umlauf (Ende geht in den Anfang über).
  Eigenes Gold-Material mit polygonOffset + kleinem geometrischen
  Sicherheitsabstand (Lehre aus dem Z-Fighting-Fehler an den Zierringen,
  direkt mit eingebaut). Das Zentrum um die Nabe (r < 1,02) bleibt bewusst
  frei — Platz für künftige Veranstaltungen/Logos.
- **Aufnahmemodus der Roulette-Seite** (`?aufnahme=1`): blendet Knöpfe aus, bis
  die Maus bewegt wird, zeigt keinen Rundenzähler, stellt den Zyklus auf
  unendlich und schreibt "CITY CAFE" statt des Raumnamens. Er steht in
  `roulette/index.html` **und** `roulette-src/index.html` und muss einen Neubau
  durch Codex überleben.

## Offene Punkte (Durchsicht 16.10.2026)

Noch nicht umgesetzt, nach Wichtigkeit:

- **DJ-Live-Status über GitHub:** Der Token im Apps-Script ist ein
  Schreibschlüssel fürs ganze Repo. `main` landet nachts auf dem W1
  (Supervisor, Chromium-Starter) und liefert das Dashboard aus; wer den Token
  hat, kann also Code ins Café bringen. **Erledigt am 15.10.2026:** Der alte PAT
  „Stadt-Café-Liedersammler" (12.08.2026, ohne Ablauf, vermutlich der vom
  Screenshot 12.09.) ist gelöscht; neuer feingranularer Token nur für
  `motte025/City-cafe`, Contents lesen/schreiben, Ablauf 1 Jahr, in den
  Skripteigenschaften (`GITHUB_TOKEN`) eingetragen – DJ-Live schrieb danach
  weiter (15:47). Ob das Dart-Liga-Skript ein eigenes Apps-Script-Projekt mit
  eigenem Token hat, beim nächsten Spieltag an den Auto-Commits prüfen.
  **19.10.2026 umgebaut:** Statusdatei im eigenen Repo `motte025/City-cafe-status`
  (öffentlich, nur `live_status.json`). Checker schreibt dorthin mit eigener
  Skripteigenschaft `DJ_STATUS_TOKEN` (PAT nur für dieses Repo); das Dashboard liest
  beide Orte und nimmt den frischeren `checked_at`. **Offen, vom Betreiber:** Token
  anlegen, im Apps-Script eintragen, neuen Checker-Code einfügen, `djTestLauf`.
  Danach: alte `live_status.json` auf `main` und `statusAltUrl` entfernen; prüfen, ob
  der alte `GITHUB_TOKEN` noch gebraucht wird (Dart-Liga, Song-Collector).
  Firebase statt GitHub wäre schneller, taugt aber erst, wenn die
  Regeln unten dicht sind (sonst ließe sich „DJ live" vortäuschen).
- **Firebase-Regeln zu offen** (`docs/musik/firebase-regeln.json`): `yt/status`,
  `yt/treffer`, `yt/diagnose` und der Sammelzweig `$sonst` (alles im Raum außer
  `chef` und `yt`, z. B. DJ-Fernbedienung und Roulette-Wecken) kann jede
  anonyme Anmeldung lesen und beschreiben. Die Zugangsdaten stehen im
  Seitenquelltext, jeder Gast kann also Müll oder falsche Meldungen schreiben
  und das Gratis-Kontingent verbrauchen. Die Musik-Befehle selbst sind
  geschützt (Gäste nur Suche und Zurückziehen, alles andere nur Chef-Geräte).
  Das Wunschlimit von 2 je Gerät hängt an der anonymen ID und lässt sich mit
  einem neuen Browserprofil umgehen. Vorschlag: `status`, `treffer`,
  `diagnose` nur für Chef-Geräte (der TV ist eins), `$sonst` einschränken;
  vorher prüfen, wer die Pfade legitim beschreibt (sonst bricht die
  Gäste-Suche). Die Regeln trägt der Betreiber in der Firebase-Konsole ein.
  **15.10.2026:** Zweig `werbung` (nur Chef-Geräte schreiben) ist eingetragen und
  geprüft (Gast: Lesen ja, Schreiben „Permission denied"). Die Konsole stimmte
  davor genau mit `docs/musik/firebase-regeln.json` überein. Seit die QR-Codes
  nur noch ihr eigenes Ziel öffnen, sehen Gäste die anderen Reiter nicht mehr –
  wer die Adresse von Hand eintippt, kommt aber weiter hinein, bis `$sonst`
  eingeschränkt ist.
- **Kamera-Passwort** steht in `DART_CAM_URL` in `index.html` und ist damit
  öffentlich. **Entscheidung Betreiber 15.10.2026: bleibt so** (Kamera nur im
  lokalen Netz 192.168.0.x). Eine fertige Umstellung liegt nur lokal am PC auf dem
  Branch `sicherheit-dartcam` (Adresse ohne Zugangsdaten, Supervisor setzt sie
  aus `CITYCAFE_CAM_ZUGANG` ein; Reihenfolge: Variable → Supervisor → index.html
  → Passwort ändern).
- **Chef-PIN:** Länge prüfen. Das Eingabefeld ist numerisch, die
  Firebase-Regeln begrenzen Fehlversuche nicht.
- **Werbung, nächste Ideen:** eigene Bilder je Aktion (heute ein gemeinsames
  `aktionenBild`), Laufschrift-Hinweis auf den nächsten Termin, Dauer der
  Musik-Einblendung (fest 30 s) einstellbar. In der Vollbild-Leiste unten wird
  ein langer Zusatz gekürzt („Reinisch & H. …").
- **Playlists (16.10.2026 aufgeräumt):** Rosanna Rocci „Balla con me" hat jetzt
  das richtige Video (ZDF), Helene Fischer „Herzbeben" und Wolfgang Petry
  „Verlieben, verloren…" das offizielle statt TV-Auftritt (in Schlager, Après-Ski,
  Klausi). Neu: DJ Ötzi (Sweet Caroline Party Remix, Hey Baby, Anton aus Tirol,
  Burger Dance, Der hellste Stern, Noch in 100.000 Jahren, Du), Josh. (Cordula
  Grün, Expresso & Tschianti, Vielleicht, Wo bist du, Martina, Ich gehör
  repariert), Pietro Basile (Ich liebe nur dich, Hey Macarena!, Buongiorno,
  Grande Amore) in „Schlager"; die Party-Titel davon auch in „Après-Ski".
  **Bleibt so:** Für rund 20 Schlager-Songs gibt es auf YouTube gar kein
  offizielles Musikvideo, nur Lyric/Visualizer/Live (Egli „Du, Du, Du", Mai
  „100 % verliebt", Michelle „Wahnsinnig", Stereoact-Remixe, Kerstin Ott
  „Rosalinde" …) – die bleiben. Die Topic-Einträge in Après-Ski/Klausi sind
  Party-Mixe ohne Video. Party Hits, Mix 1/2 und Schlager 2024–2026 sind am
  Handy bearbeitet (Firebase `yt/listen/<nr>` mit `bearbeitet`) – Änderungen am
  Repo wirken dort erst nach „Original wiederherstellen"; also am Handy pflegen.
- **Wer gewinnt, Musik oder DJ?** Startet man Musik, während ein DJ-Wunsch
  läuft (oder umgekehrt), bleiben beide eingetragen; der TV zeigt die Musik,
  die Übersicht beide. Vorschlag: die zuletzt getroffene Wahl gewinnt.
- **Bluetooth:** im Protokoll 44× „verbunden, aber kein Tonkanal" – der
  Wächter verbindet neu, Ursache am Empfänger (B03 Pro).
- **Roulette im Café zu dunkel (16.10.2026):** Das Bild aus der Box (`kiosk-foto`)
  ist hell und normal – die Ursache liegt am Café-Fernseher. Zu prüfen im TV-Menü:
  Energiesparen/Eco, Lichtsensor (Umgebungslicht), HDMI-Schwarzwert bzw.
  RGB-Bereich (die Box sendet „Broadcast RGB: Automatic", amdgpu, HDMI-A-1),
  Bildmodus (nicht Kino/Film). TV-Marke ist noch nicht bekannt. Die
  Roulette-Einstellungen liegen je Gerät im Browser (`localStorage`
  „atelier-show-settings"); auf der Café-Box: Helligkeit 1,35 (fast Maximum),
  `innerTone` 0,15 (dunkelster Innenkessel). Reicht die TV-Einstellung nicht,
  `innerTone` anheben.
- **Selbst-Update der TV-Seite** hat am 16.10.2026 eine neue Fassung nach über
  5 min noch nicht geholt; zum Testen von Hand neu geladen (`kiosk-cdp
  "location.reload()"`, startet laufende Musik mit dem Song von vorn).
- **Veraltete Kopfzeilen:** `NIGHTLIFE-SETUP.md` und `DJ-FERNBEDIENUNG-SETUP.md`
  sagen „zurzeit abgeschaltet", im Code sind `NL_SLOT_AN` und `DJ_SLOT_AN` an.

## Verworfen

Der Kessel lief auf der Mali-Grafik des ODROID nur mit 16 Bildern pro Sekunde.
Darum wurde am PC eine drei Stunden lange Bildschirmaufnahme erstellt (ffmpeg
mit ddagrab, 1920×1080, echte 60 Bilder/s, 30 Mbit/s, technisch tadellos) und
auf die Box geschoben. Der Benutzer wollte die 39 GB dort nicht liegen haben;
die Aufnahme wurde gelöscht. **Der Video-Weg ist vom Tisch** — mit dem W1 wird
wieder live gerechnet.

## Feste Regeln

- YouTube- und Google-Cookies auf der Box nie löschen (Kiosk-Profil
  `/home/citycafe/.config/chromium-kiosk`, dort ist YouTube Premium
  angemeldet).
- Keine Zugangsdaten ins Repo. (Achtung: `DART_CAM_URL` in `index.html` enthält
  das Kamera-Passwort im Klartext und ist damit öffentlich.)
- Verweigerte Berechtigungen nicht umgehen, sondern nachfragen.
- Nichts an Partitionen, Bootloader oder Windows auf dem W1 ändern ohne
  ausdrückliche Freigabe.
- Hochgeladen wird nur nach Freigabe des Betreibers (Änderungen, die er
  ausdrücklich bestellt, gelten als freigegeben).
- Die Chef-PIN kommt nicht ins Repo (steht nur in `citycafe.env` auf dem W1
  und in Firebase `djremote/<raum>/chef/pin`).
- Die Roulette-Werbung („Demnächst“) und die Musik-Empfehlung (großes Widget
  „Nächster Titel empfohlen“) sind seit 05.10.2026 ganz aus dem Dashboard
  entfernt; das Roulette-Spiel läuft seitdem im Café und zuhause.
- TV-Seite neu laden oder Supervisor neu starten nur nach Rückfrage – es
  unterbricht die Musik. Eine neue `index.html` holt sich der Screen selbst
  beim nächsten Slotwechsel (Selbst-Aktualisierung, siehe oben); Supervisor und
  Chromium-Starter kommen mit dem täglichen Update 8:30. **Ein Push von
  `index.html` geht also ohne weiteren Schritt am TV live** – vorher prüfen.
- mpv-Sockets auf W1 nur so abfragen: `sudo -u citycafe socat - UNIX-CONNECT:/tmp/mpv-nl.sock`. Nie
  `sudo socat - /tmp/…sock` mit nacktem Pfad: Fehlt der Socket gerade, legt socat eine root-Datei an, und
  alle Überblendungen fallen bis zum nächsten Neustart aus (passiert am 27.10.2026).

## Arbeitsweisen, die sich bewährt haben

- **Arbeitsplatz-PC (Beelink, Windows):** GitHub CLI seit 15.10.2026 unter
  `C:\Program Files\GitHub CLI\gh.exe`, angemeldet als `motte025` (auch als
  Git-Anmeldung eingerichtet). Arbeitskopie `C:\Users\motte\City-cafe`
  (Git-Name/E-Mail dort lokal gesetzt), zweite Kopie
  `C:\Users\motte\Documents\city-cafe`. Kein Python am PC – Python-Prüfungen
  per `ssh w1 python3 -` (Datei über stdin, nichts in /tmp liegen lassen).
- **Seiten ohne Box prüfen:** Playwright mit dem installierten Edge
  (`channel: 'msedge'`), Seite über `http://localhost` ausliefern, **alle
  fremden Adressen sperren** (sonst meldet sich der Test-TV in der echten
  Firebase an und schreibt Status/Boxen). Mit `page.clock.install` steht die Uhr
  fest und die Seiten-Timer laufen nur bei `clock.runFor` – so lassen sich
  Termine/Takte testen, ohne dass die Musik-Logik Klassen zurücksetzt.
- `kiosk-cdp` wartet nicht auf Promises (liefert `{}`): Ergebnis in
  `window.__x` ablegen und mit einem zweiten Aufruf lesen.

- Auf der Box keine Testprofile in `/tmp` liegen lassen. Das ist eine
  RAM-Disk; ein volles `/tmp` hat schon einmal yt-dlp scheitern lassen und den
  Kiosk-Chromium abgeschossen.
- Niemals `pkill -f <muster>` über ssh aufrufen: das Muster steht in der
  eigenen Befehlszeile, die Sitzung stirbt mit. Über die Prozessnummer gehen.
- Skripte in Dateien schreiben und mit `scp` übertragen, statt sie in
  ssh-Heredocs zusammenzusetzen.
- Die Arbeitskopie auf dem Beelink hat Windows-Zeilenenden (CRLF). Vor dem
  Übertragen auf den W1 mit `tr -d '\r'` bereinigen, sonst bricht `sh` ab.
- Was sway per `exec` startet, überlebt einen sway-Neustart. Jeder solche
  Dienst muss beim Start seine alte Instanz beenden (wie Supervisor und
  `citycafe-bt`), sonst laufen Kopien gegeneinander — so blockierten sich
  drei (damals noch selbst verbindende) `citycafe-bt` beim Bluetooth-Verbinden.
- Supervisor allein neu starten (Dashboard läuft weiter): Prozess per PID
  beenden, dann als `citycafe` mit geladener `citycafe.env` per `setsid`
  starten — ohne die Variablen fehlen VA-API, Raum und Puffer.
- Bei Bildschirmaufnahmen immer ein echtes Einzelbild des Bildschirms ansehen.
  Der Zustand der Seite sagt nichts darüber, was tatsächlich im Bild landet.
- Änderungen erst auf der Box nachprüfen — am besten mit einem Bildschirmfoto —
  und erst dann sagen, dass etwas fertig ist.
- Nach einem Push lädt der Kiosk die Seite erst beim nächsten Slotwechsel neu;
  zum Testen per `kiosk-cdp` neu laden (Musik springt dabei einen Song
  weiter). GitHub-Pages-Dateien hängen bis zu 10 min im Browser-Cache –
  `fetch(…, {cache:"reload"})` vor dem Neuladen.
- Größere Dateiänderungen per kleinem Node-Skript (lesen, `replace`,
  schreiben, CRLF beibehalten) statt sed über mehrere Zeilen.
- Vor jedem Push `git pull --rebase origin main`: der DJ-Live-Checker
  committet bis zu 4-mal pro Stunde auf `main`.
- **Fan-Uploads in Playlists (09.10.2026):** 113 von 1446 Einträgen kommen von fremden
  Kanälen mit < 100.000 Aufrufen (z. B. Maite Kelly „Ein Kuss in Paris" als Standbild
  von „aV1tamin"). Das Dashboard tauscht sie jetzt vor dem Abspielen (`ytmFanUpload`),
  aber nur gegen ein Video mit passendem Titel (`ytmTitelPasst`, im Supervisor
  `titel_passt`) – vorher kam „Alles neu" statt „Haus am See". Playlist 5 korrigiert
  (Repo und Firebase `yt/listen/5/titel/4`). Für Peter Fox „Haus am See" und Rihanna
  „Don't Stop the Music" findet die Suche nur Kopien; bei Bedarf von Hand eintragen.
- Ohne Box lässt sich die Logik von TV und Handy mit Headless-Chromium
  (Playwright) gegeneinander prüfen: Firebase im Speicher ersetzen,
  `index.html` und `yt-fernbedienung.html` über einen lokalen Server laden,
  den YouTube-Player nachbauen (YouTube ist von dort nicht erreichbar). So
  geschehen am 09.10.2026 für QR-Schalter, Playlists 1–4 und Shorts; die
  Skripte liegen nicht im Repo. Das ersetzt nicht die Prüfung auf der Box.
