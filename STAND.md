# Stand des Projekts

Diese Datei beschreibt, wo City-Cafe gerade steht. Sie ist die Übergabe an die
nächste Arbeitssitzung und lässt sich auch als Ganzes in ein neues Gespräch
kopieren. Wer hier etwas Größeres ändert, hält sie nach — sie soll den heutigen
Stand beschreiben, nicht den von vorgestern.

Letzte Durchsicht: 1. Oktober 2026 (ODROID durch ACEMAGIC W1 ersetzt).

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
| `fernbedienung.html` | Sammel-Fernbedienung mit vier Reitern (YouTube, DJ, Hos'n Obe, Roulette) |
| `yt-fernbedienung.html` | YouTube-Wünsche, Suche und sechs automatische Vorschläge |
| `dj-fernbedienung.html` | Twitch-Kanäle, Anmeldung über ein eigenes Fenster |
| `hosn-obe-engine.js` | Spiellogik des Kartenspiels, dazu `hosn-obe-engine.test.js` |
| `roulette/` | Gebaute Roulette-Seite (stammt von Codex) |
| `roulette-src/` | Deren Quelle (Vite + TypeScript) |
| `kiosk/` | Supervisor, sway-Konfiguration, Chromium-Starter der Box |
| `W1-UMSTELLUNG.md` | Einstellwerte (`CITYCAFE_*`) und Reihenfolge der W1-Einrichtung |
| `README.md` | Wegweiser über alle Bauteile |
| `FERNBEDIENUNGEN.md` | Wie die Fernbedienungen zusammenspielen |
| `KIOSK-SUPERVISOR.md` | Wie der Aufpasser auf der Box arbeitet |

Veröffentlicht wird über GitHub Pages (`motte025/City-cafe`). **Nach einem Push
dauert es oft 5 bis 15 Minuten**, bis die neue Fassung wirklich ausgeliefert
wird — vorher mit `curl` auf eine Zeichenfolge aus dem neuen Stand prüfen, statt
sich auf den Push zu verlassen.

## Geräte

**Den ODROID gibt es nicht mehr.** Seit 30.09.2026 läuft der Kiosk auf dem
**ACEMAGIC W1** (Ryzen 7 H255, Radeon 780M, 15 GB RAM).

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
  `CITYCAFE_RAUM=city-cafe` (Café, kein Roulette-Spiel, nur die Werbung),
  `CITYCAFE_HWDEC=vaapi`, mpv-Puffer 512/64 MiB, `CITYCAFE_CAM_CACHE_SECS=8`
  (Dartcam), `CITYCAFE_VOLUME=0.9`, Chromium mit VA-API-Schaltern. Ohne
  Variablen verhalten sich Starter und Supervisor wie früher (Raum
  `zuhause`).
- **Supervisor** `/opt/citycafe/nl-mpv-supervisor.py`: liest über die
  Debug-Schnittstelle (Port 9222) den Zustand des Dashboards und legt Videos,
  Twitch und Dartcam mit mpv passgenau über das Browserfenster
  (Hardware-Dekodierung VA-API). Er löst YouTube mit yt-dlp auf (Cookies aus
  dem Kiosk-Profil, YouTube Premium angemeldet), sucht für die Fernbedienung,
  räumt `/tmp` auf und startet den Browser neu, wenn er hängt. Beim ersten
  Auftritt eines Zyklus-Videos wählt er selbst einen zufälligen Startpunkt
  (Länge von yt-dlp); Wünsche vom Handy beginnen von vorn.
- **Bluetooth zur Anlage**: 1Mii B03 Pro (Empfänger, RX) gekoppelt; der
  Betreiber nimmt genau diesen ins Café mit, dort ist also kein Koppeln
  nötig. Ein weiterer Empfänger müsste einmal gekoppelt werden
  (`bluetoothctl`: scan, pair, trust – mit Agent, sonst wird der Schlüssel
  nicht gespeichert); der Supervisor kommt mit mehreren gekoppelten zurecht
  („Verbinden" nimmt den ersten erreichbaren, wartet bis 20 s auf den Ton).
  **Verbunden und getrennt wird nur per Knopf** in der Handy-Fernbedienung
  (Wunsch des Betreibers): „Trennen" trennt und blockiert den Empfänger
  (sonst meldet er sich nach ~30 s von selbst wieder), „Verbinden" hebt die
  Sperre auf; die Kopplung bleibt, der Zustand übersteht Neustarts.
  „Verbunden" heißt: der PipeWire-Ausgang `bluez_output…` existiert, der Ton
  geht zur Anlage. `/usr/local/bin/citycafe-bt` (nur auf dem W1) verbindet
  nie selbst, es setzt nur einen neu aufgetauchten Bluetooth-Ausgang als
  Standard mit 90 %.
- **Nächtliche Aktualisierung** (`citycafe-update.timer`, täglich 8:30):
  `pacman -Syu`, dann Supervisor und Chromium-Starter aus GitHub `main`
  (nur nach Syntaxprüfung; abschaltbar in `/etc/citycafe-update.conf`),
  Neustart nur bei Änderungen. Protokoll `/var/log/citycafe-update.log`.
  **Was auf `main` liegt, landet also am nächsten Morgen auf dem W1.**
- Logs: `/home/citycafe/nl-mpv-supervisor.log`, `mpv-nl.log`,
  `citycafe-bt.log`. Bildschirmfoto: `grim` als `citycafe` mit
  `XDG_RUNTIME_DIR=/run/user/1001` und `WAYLAND_DISPLAY` aus diesem Ordner.

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
- **Fernbedienungen**: sechs automatische Vorschläge; nach jedem gestarteten
  Video sechs neue, die zum eben gesehenen passen. Schriftgrößen für Handy,
  Tablet und PC getrennt. Neu: „Bluetooth zur Anlage" (Verbinden/Trennen/
  Prüfen) in der YouTube-Fernbedienung.
- **Nightlife/YouTube**: Zyklus-Videos steigen zufällig ein (4-Minuten-Slot).
  Wünsche vom Handy beginnen von vorn und laufen die gewählte Zeit; „Bis
  Stopp" läuft bis Stopp, neuem Wunsch oder Videoende (vorher brach es nach
  4 Minuten ab, behoben 01.10.). Ein Wunsch ohne Ort zeigt seinen Titel groß
  in der Überschrift, darunter „Per Fernbedienung gestartet".
- **Vollbild-Ansichten außerhalb von `.media-inner-view`** (CL-Tabelle
  `#ucl-fullscreen-table`, Mittagsteller, Roulette-Werbung, Dart-Anheizer)
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
- **Roulette**: Codex' Modul, im Dashboard nur für den Fernseher zuhause. Der
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
  „Runden“ (höchste Summe) sowie 201/301/501 (genau treffen, Runde wird
  fertig gespielt, überworfen zählt nicht, ab 36 Rest wird die Ausmach-Zahl
  angezeigt), Rundenzahl 3–30 wählbar
  (bei 301/501 auch ohne Limit). Beginner wird ausgelost, Sieger 3 Minuten mit Feuerwerk,
  Konfetti und Treppchen gefeiert, danach normaler Zyklus. Standardzyklus
  jetzt 30 Runden, Tempo 4 s Pause / 12 s Kugel (nur Quelle + Vorschau). Nur per Fernbedienung
  aktivierbar, Punktetafel links am TV. Der Computer dreht reihum, das
  Ergebnis bleibt reiner Zufall. Beschreibung: `roulette-src/README.md`.
  Steht in `roulette-src` und ist **nur** nach `roulette-vorschau-spiel/`
  gebaut — `roulette/` (das Dashboard) ist bewusst unberührt, weil ein Neubau
  dorthin auch Schriftring, Rauten-Widerstand und Modell A mitbringen würde.
  Vorschau (liegt auf main, damit GitHub Pages sie ausliefert; die Boxen
  laden sie nicht): TV `roulette-vorschau-spiel/?raum=spieltest`, Handy
  `roulette-vorschau-spiel/remote.html?raum=spieltest`. Eigener Raum, damit
  sich Vorschau und Boxen auch über Firebase nicht begegnen. Der
  Roulette-Reiter der Sammel-Fernbedienung zeigt noch die alte Seite.
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
- Hochgeladen wird nur nach Freigabe des Betreibers.
- Im Café läuft das Roulette-Spiel nicht, nur die Werbung.

## Arbeitsweisen, die sich bewährt haben

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
