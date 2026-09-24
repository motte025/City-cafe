# Stand des Projekts

Diese Datei beschreibt, wo City-Cafe gerade steht. Sie ist die Übergabe an die
nächste Arbeitssitzung und lässt sich auch als Ganzes in ein neues Gespräch
kopieren. Wer hier etwas Größeres ändert, hält sie nach — sie soll den heutigen
Stand beschreiben, nicht den von vorgestern.

Letzte Durchsicht: 22. September 2026.

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
| `README.md` | Wegweiser über alle Bauteile |
| `FERNBEDIENUNGEN.md` | Wie die Fernbedienungen zusammenspielen |
| `KIOSK-SUPERVISOR.md` | Wie der Aufpasser auf der Box arbeitet |

Veröffentlicht wird über GitHub Pages (`motte025/City-cafe`). **Nach einem Push
dauert es oft 5 bis 15 Minuten**, bis die neue Fassung wirklich ausgeliefert
wird — vorher mit `curl` auf eine Zeichenfolge aus dem neuen Stand prüfen, statt
sich auf den Push zu verlassen.

## Geräte

**ODROID N2+ am Fernseher**, Zugang `ssh odroid`, Benutzer `citycafe`. Darauf
laufen sway und Chromium im Kiosk (`--app`), dazu
`/opt/citycafe/nl-mpv-supervisor.py`. Der Supervisor liest über die
Debug-Schnittstelle von Chromium den Zustand des Dashboards und legt Videos und
Streams mit mpv passgenau über das Browserfenster. Er löst YouTube-Adressen mit
yt-dlp auf, sucht für die Fernbedienung, räumt `/tmp` auf und startet den
Browser neu, wenn dieser hängt. Die Box hat nur **2 GB RAM**; was dagegen
getan ist (Vorladen ohne Puffer, Puffergrenzen für mpv, yt-dlp als Zipapp,
zram) und wie es eingerichtet wird, steht in `KIOSK-SUPERVISOR.md` unter
„Arbeitsspeicher".

**Selbst-Aktualisierung**: Das Dashboard prüft alle fünf Minuten, ob sich
`index.html` auf GitHub Pages geändert hat, und lädt sich dann beim nächsten
Slotwechsel neu (nicht während Hos'n Obe oder eines Handy-Wunsches). Ein
Dashboard-Update braucht also keinen Neustart der Box mehr. Dateien auf der
Box (Supervisor, Chromium-Starter) erreicht das nicht. Abschalten mit
`?autoupdate=0`.

**ACEMAGIC W1 (bestellt)**, soll mit CachyOS im Kiosk-Betrieb laufen und den
ODROID ablösen oder ergänzen. Zu tun, sobald er da ist: das Kiosk-Gerüst aus
`kiosk/` übertragen, Videobeschleunigung auf VA-API statt der Amlogic-Wege
umstellen, einen SSH-Zugang wie `odroid` einrichten. Auf x86 rechnet das
Roulette wieder live in voller Qualität — Sparmodus aus, 3D-Auflösung 100 %.

Verbunden sind Dashboard und Fernbedienungen über eine Firebase-Datenbank unter
`djremote/<raum>/`. Der Raum `zuhause` ist der Fernseher zuhause; dort läuft
auch das Roulette, im Café ist es nicht eingeblendet.

## Zustand der Bauteile

- **Rotation**: Endet ein selbst gestartetes Video oder ein DJ-Stream, übernimmt
  die Standardrotation sofort wieder, ohne dass an der Fernbedienung etwas
  gedrückt werden muss.
- **Fernbedienungen**: sechs automatische Vorschläge; nach jedem gestarteten
  Video sechs neue, die zum eben gesehenen passen. Schriftgrößen für Handy,
  Tablet und PC getrennt.
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
  Drei sichtbare Zierringe (r 2,93 / 2,47 / 2,025) stehen 1,7–2,7 mm über den
  Flächen, über die die Kugel rollen muss; in der Kollisionsrechnung sind sie
  bündig, das sichtbare Modell ist unverändert. Details, Messwerte und
  offene Abweichungen: `roulette-src/TESTBERICHT.md`.
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

- `/boot/boot.ini.1786897722` niemals einspielen.
- YouTube- und Google-Cookies auf der Box nie löschen.
- Keine Zugangsdaten ins Repo.
- Verweigerte Berechtigungen nicht umgehen, sondern nachfragen.
- Keine großen Mediendateien auf der Speicherkarte der Box ablegen.

## Arbeitsweisen, die sich bewährt haben

- Auf der Box keine Testprofile in `/tmp` liegen lassen. Das ist eine
  RAM-Disk; ein volles `/tmp` hat schon einmal yt-dlp scheitern lassen und den
  Kiosk-Chromium abgeschossen.
- Niemals `pkill -f <muster>` über ssh aufrufen: das Muster steht in der
  eigenen Befehlszeile, die Sitzung stirbt mit. Über die Prozessnummer gehen.
- Skripte in Dateien schreiben und mit `scp` übertragen, statt sie in
  ssh-Heredocs zusammenzusetzen.
- Bei Bildschirmaufnahmen immer ein echtes Einzelbild des Bildschirms ansehen.
  Der Zustand der Seite sagt nichts darüber, was tatsächlich im Bild landet.
- Änderungen erst auf der Box nachprüfen — am besten mit einem Bildschirmfoto —
  und erst dann sagen, dass etwas fertig ist.
