# Stand des Projekts

Diese Datei beschreibt, wo City-Cafe gerade steht. Sie ist die Übergabe an die
nächste Arbeitssitzung und lässt sich auch als Ganzes in ein neues Gespräch
kopieren. Wer hier etwas Größeres ändert, hält sie nach — sie soll den heutigen
Stand beschreiben, nicht den von vorgestern.

Letzte Durchsicht: 5. Oktober 2026 (DJ-Übergänge per Studio-Abgleich, offizielle
Videos überall, Playlists bearbeiten/erstellen am Handy, Playlists 5–8, Aufrufe,
Bluetooth-Wächter, Tailscale, zweiter B03 Pro gekoppelt, Roulette-Werbung
und Musik-Empfehlung entfernt, ODROID weg, Roulette-Spielmodus im Dashboard).

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
| `fernbedienung.html` | Sammel-Fernbedienung mit vier Reitern (🎵 Musik, DJ, Hos'n Obe, Roulette) |
| `yt-fernbedienung.html` | Musik-Fernbedienung: Jetzt, Suche (Songs/Playlists), Ähnliche, Listen, Mehr; Gast/Chef |
| `yt-fernbedienung-net.js` | Firebase-Pfade der Musik (`yt/…`, `chef/…`) |
| `yt-warteschlange.js` | Reihenfolge-Logik der Musik (Warteschlange, Radio, Vorschau), Tests in `yt-warteschlange.test.js` |
| `yt_playlists.json` | Stimmungs-Playlists nach Uhrzeit (1–4 mit festen Titellisten, 5–8 eigene Mixe) |
| `YOUTUBE-MUSIK-SETUP.md`, `docs/musik/` | Spec der Musik, Firebase-Regeln, Bilder |
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

Seit 30.09.2026 läuft der Kiosk auf dem **ACEMAGIC W1** (Ryzen 7 H255, Radeon
780M, 15 GB RAM). **Der alte ODROID ist seit 05.10.2026
weg.** Die Sparregel „box-shadow/filter/animation: none" in `index.html` ist
seit 06.10.2026 aus, die Effekte sind wieder Standard; `?fx=0` holt sie als
Notschalter zurück. Der `chefTv`-Filter der Fernbedienungen (zwei Screens
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
- **YouTube-Musik** (Spec `YOUTUBE-MUSIK-SETUP.md`, seit 03.10.2026 auf `main`,
  Firebase-Regeln und Chef-PIN eingetragen). Gäste wünschen per Handy, der
  Chef (PIN) steuert; der TV ist die einzige Quelle der Reihenfolge
  (`yt-warteschlange.js`, 107 Checks).
  - **Ablauf:** Musik läuft bis Stopp (keine Zeitgrenze; ist nichts da, startet
    die Playlist zur Uhrzeit). Gästewünsche frühestens auf Platz 5. Ist die
    Schlange leer, läuft der Radio-Mix; „Ähnliche Songs" folgt jedem neuen
    Titel. Die Vorschau („Als Nächstes", „Danach") rechnet wie `weiter()`
    und zeigt damit die echte Reihenfolge. Hos'n Obe ist während der Musik
    gesperrt; der Dart-Abend beendet sie, außer der Chef startet sie dabei.
  - **DJ-Funktionen (Supervisor):** echte Überblendung 9 s (zweiter mpv,
    gleichbleibende Gesamtlautstärke, Bild per sway-Opacity; Pause/Skip/Stopp
    mittendrin sauber). Der Musikbeginn des neuen Songs fällt in die **Mitte**
    der Blende (kein Lautstärkeloch, höchstens −3 dB). Chef kann am Handy mit
    ⤨ mitten im Song überblenden. Vorladen 40 s vor Ende; die nächsten 3 Songs
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
  - **Lautstärke:** leise Songs werden automatisch angehoben (mpv
    `volume-gain`, ab 2 dB unter −11 dB, bis +8 dB, nie über die Spitzen,
    1 dB Reserve – Betreiber will **keine Übersteuerung**, keinen Limiter).
    Abgesenkt wird nichts. Der alte Ton-Ausgleich (dynaudnorm) ist abgeschafft.
    Bluetooth und W1 stehen auf 100 %, die Lautstärke stellt der Betreiber
    selbst am Handy ein (ab 70 % in 3er-Schritten).
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
    oder **YouTube Shorts** (Knopf „📱 Shorts rechts", stumm, noch nicht auf der Box
    geprüft: Chromium dekodiert den Short zusätzlich zu mpv). Vollbild: „NÄCHSTER TITEL" (früher „Gleich dran") und
    „WARTESCHLANGE" (früher „Danach"). Widget: Leiste „Als Nächstes" mit
    Interpret 24 px; Überschrift bis 880 px, das Auflösungsschild sitzt klein
    eine Zeile tiefer links neben dem Logo. Die Werbe-Abdeckung
    (`nl-player-hint` mit Titel) ist aus, solange mpv spielt
    (`body.video-extern`) – sie schien sonst mitten in der Überblendung durch.
    QR „Song wünschen" ist standardmäßig aus (`YT_QR_AN = false`), der Chef schaltet ihn
    am Handy mit dem Knopf **🔳 QR-Code / QR aus** (Reiter „Jetzt", neben Ambilight) im
    Video ein und aus: Befehl `musik`/`qr` (`an: true|false`), Rückmeldung `yt/jetzt.qr`.
    Die Wahl merkt sich der TV im Browser-Speicher (`ytm-qr-an`) und behält sie nach
    Neustart; das gebaute QR-Bild wird beim Aus/Ein wiederverwendet.
  - **Handy:** Suche nach Songs oder Playlists (Playlist öffnen, einzelne Titel
    nehmen), ⋯-Menü je Song (Ab hier abspielen, Sofort, Als Nächstes, An 5.
    Stelle, Radio-Mix starten, Ende, Zu Playlist hinzufügen), Radio-Mix zum
    laufenden Song, Warteschlange bereinigen (✕ links, ☰ rechts),
    Fortschrittsbalken antippen, Überblenden ⤨, Lauter/Leiser (bis 70 % 5er-,
    darüber 3er-Schritte, max. 100 %), Player zeigt die laufende Playlist,
    Fotos/Ambilight/Vollbild, „Musik beenden". „Passt dazu", Suche und
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
    1–4 feste Titellisten (seit 08.10.2026, aus den Titeln von 5–8 zusammengestellt, jede videoId
    einmal je Liste): 1 „Party Hits" (250, 21–8 Uhr), 2 „Schlager" (219, 17–21 Uhr),
    3 „Après-Ski" (155, ohne Uhrzeit), 4 „Chill" (126, 8–17 Uhr); 5 „Mix
    04.10.2026" (210, moderne Schlager / internationale / deutsche
    Party-Hits 2-2-2); 6 „Mix 04.10.2026 (2)" (200, Stil der Betreiber-Liste
    05.05.2024: Latin, Dance, 80er/90er, Pop, Deutsch/Austro; am Handy
    bearbeitet); 7 „Klausi" (144, Nachbau der Apple-Music-Playlist „City
    Café", gleiche Reihenfolge); 8 „Schlager 2024–2026" (142, nach den Schlager-Charts: DDP-Jahrescharts 2024/2025,
    Schlager-Jahres-Charts 2025, DDP Top 100 Okt. 2026 – 119 Chart-Hits plus meistgesehene,
    alle Stereoact-Remixe, höchstens 5 je Interpret, nie zweimal derselbe hintereinander;
    ohne Ballermann). Am 05.10. wurden 12 Fan-/TV-Einträge durch
    offizielle Videos ersetzt.
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
- **YouTube-Musik, offen:** Test der Dart-Ausnahme an einem Dart-Abend.
  Einige Songs haben nur TV-/Live-Fassungen (Rosanna Rocci „Solo con te",
  Draufgänger „Marie", CCR „Proud Mary" – bleiben vorerst).
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
  unterbricht die Musik. Sonst gilt eine neue Fassung ab dem nächsten Neustart
  (tägliches Update 8:30). Eine Selbst-Aktualisierung ist bewusst nicht gebaut.

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
- Nach einem Push lädt der Kiosk die Seite erst beim nächsten Slotwechsel neu;
  zum Testen per `kiosk-cdp` neu laden (Musik springt dabei einen Song
  weiter). GitHub-Pages-Dateien hängen bis zu 10 min im Browser-Cache –
  `fetch(…, {cache:"reload"})` vor dem Neuladen.
- Größere Dateiänderungen per kleinem Node-Skript (lesen, `replace`,
  schreiben, CRLF beibehalten) statt sed über mehrere Zeilen.
