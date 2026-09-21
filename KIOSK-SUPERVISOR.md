# Der mpv-Aufpasser auf der Kiosk-Box

Auf den ODROID-Boxen läuft neben Chromium ein kleines Python-Programm, das die
bewegten Bilder übernimmt: **`nl-mpv-supervisor.py`**. Ohne ihn spielt das
Dashboard alles im Browser – mit ihm laufen Nightlife-Videos und Twitch-Streams
in einem eigenen mpv-Fenster, das exakt über dem jeweiligen Widget liegt.

Die Datei im Ordner `kiosk/` ist die Arbeitskopie aus dem Repo. Auf der Box
liegt sie unter `/opt/citycafe/nl-mpv-supervisor.py`; dort wird sie auch
bearbeitet. Wer etwas ändert, kopiert die Datei anschließend zurück ins Repo,
damit der Stand nicht nur auf der Box existiert.

## Warum überhaupt mpv

Chromium dekodiert auf der Box in Software und schafft 1080p60 nicht ruckelfrei;
mpv schafft es. Deshalb:

* **YouTube (Nightlife)**: `yt-dlp` löst die Adresse auf, mpv spielt Bild und
  Ton, das YouTube-Embed darunter wird stummgeschaltet und angehalten.
* **Twitch (DJ-Slot)**: `streamlink` holt den Stream und filtert die
  Werbeblöcke heraus, mpv spielt ihn.
* Fällt eines davon aus, spielt automatisch wieder der Browser-Player.

mpv wird bewusst mit `--hwdec=no --vo=gpu --profile=fast --sid=no` gestartet:
Der Hardware-Dekoder der Box blieb im Test bei 3 von 12 Starts hängen, die
Software-Dekodierung bei 0. `--sid=no` hält Untertitel in jedem Fall draußen.

## Was der Aufpasser sonst noch macht

* **Fensterplatzierung**: Er misst jede halbe Sekunde über die
  DevTools-Schnittstelle, wo das Widget gerade liegt, und schiebt das
  mpv-Fenster genau dorthin (unter sway: erst `resize`, dann `move`).
* **Wächter**: Kommt kein erstes Bild oder steht die Wiedergabe, beendet er mpv
  und gibt das Bild an den Browser zurück.
* **Sauberes Dateiende**: Ist ein Video wirklich zu Ende, meldet er das dem
  Dashboard (`nlVideoFertig()` bzw. `djStreamFertig()`), damit die Rotation
  **sofort** weiterläuft und nicht die gewählte Zeit abwartet.
* **Suche für die Fernbedienung**: Die YouTube-Suche läuft mit `yt-dlp` auf der
  Box – so braucht das Handy keinen Google-Zugang. Auch die automatischen
  Vorschläge entstehen hier (mehrere Suchbegriffe, Treffer gemischt).
* **Hos'n Obe hat Vorrang**: Läuft eine Runde, zeigt mpv nichts an – sein
  Fenster läge sonst über dem Kartentisch.
* **Neustart-Wächter**: Antwortet Chromium 120 Sekunden lang nicht mehr,
  startet er den Kiosk-Browser neu (danach 5 Minuten Ruhe, damit kein
  Neustart-Karussell entsteht).
* **Aufräumen**: `/tmp` liegt im Arbeitsspeicher. Alle 30 Minuten entfernt er
  liegengebliebene Auspackordner von `yt-dlp`; ein volles `/tmp` hat schon
  einmal dazu geführt, dass der Kernel Chromium abgeschossen hat.

## Start und Neustart

Gestartet wird er von sway (siehe `kiosk/sway-citycafe.conf`). Von Hand:

```sh
pkill -f citycafe/nl-mpv-supervisor
setsid sudo -u citycafe python3 /opt/citycafe/nl-mpv-supervisor.py \
    >/dev/null 2>>/home/citycafe/nl-mpv-supervisor.err </dev/null &
```

Protokoll: `/home/citycafe/nl-mpv-supervisor.log`, Fehler:
`/home/citycafe/nl-mpv-supervisor.err`.

## Stolpersteine, die schon Zeit gekostet haben

* **`pkill -f <muster>` trifft die eigene SSH-Sitzung**, wenn das Muster auch in
  der eigenen Befehlszeile steht. Lieber die PID verwenden oder
  `pkill --older 120`.
* **Messungen sind wertlos, solange mpv läuft** – Video und WebGL teilen sich
  dieselbe GPU. Vor jeder Leistungsmessung prüfen: `pgrep -x mpv`.
* **`--disable-gpu-rasterization`** im Chromium-Start lässt mpv Bilder
  verlieren. Der Schalter darf nicht zurück in `citycafe-chromium`.
