# Stand des Projekts

Diese Datei beschreibt, wo City-Cafe gerade steht. Sie ist die Übergabe an die
nächste Arbeitssitzung und lässt sich auch als Ganzes in ein neues Gespräch
kopieren. Wer hier etwas Größeres ändert, hält sie nach — sie soll den heutigen
Stand beschreiben, nicht den von vorgestern.

Letzte Durchsicht: 16. Oktober 2026 (Musik: Lautstärke nach LUFS für alle Songs
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
- **Vormessen** läuft auf dem W1 (703 Songs ohne Doppelte, ~40 s je Song, nur ohne Musik). Erster Lauf
  erst ~10 min nach dem Supervisor-Start (Liste beim Start noch leer, wird alle 10 min neu geholt).
- **Systemupdate W1 repariert (19.10.):** `pacman -Syu` brach seit mindestens 17.10. ab
  (`plasma-workspace 6.8` gegen `plasma-x11-session`). `plasma-x11-session` entfernt (Kiosk läuft unter
  sway), 108 Pakete eingespielt, Kernel 7.2.11, Plasma 6.8. Die Café-Dateien kamen trotzdem jeden Tag.
- Offen: seltenes Überspringen eines Songs (doppeltes „Weiter“, Ursache unbekannt).
- Push nach `main` durch Claude: über `/permissions` für den konkreten Befehl freigegeben, sonst
  von der Berechtigungsprüfung gesperrt („Production Deploy“).

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
| `yt-fernbedienung.html` | Musik-Fernbedienung: Jetzt, Suche (Songs/Playlists), Ähnliche, Listen, Mehr; Gast/Chef. In „Jetzt" oben nur Steuerung (⏮ ⏸ ⏭ ⇄ Blende) und Lautstärke; Vollbild, Fotos/Shorts rechts, Ambilight, QR, Handy/Screen an die Anlage zugeklappt unter „⚙️ Anzeige & Anlage" (16.10.2026); Limiter und Überblendung unter Mehr → „🔊 Ton" |
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
  - **DJ-Funktionen (Supervisor):** echte Überblendung (4/6/9 s am Handy, zweiter mpv,
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
  - **Lautstärke (seit 16.10.2026):** jeder Song wird auf dieselbe
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
  - **Überblendung am Handy einstellbar (16.10.2026):** kurz 4 s (Standard),
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
