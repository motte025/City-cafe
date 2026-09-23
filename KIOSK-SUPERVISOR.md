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
Dazu `--demuxer-max-bytes=48MiB --demuxer-max-back-bytes=8MiB`: ohne diese
Grenzen puffert mpv Netzströme bis zu 200 MB – zu viel für die 2 GB der Box.

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

## Arbeitsspeicher: die Box hat nur 2 GB

Chromium, mpv und yt-dlp teilen sich 2 GB. Wird es eng, beendet der Kernel
einen Prozess – meist Chromium, und der Bildschirm ist kurz schwarz. Deshalb:

* **Dashboard** (`index.html`): Mit laufendem Aufpasser lädt das YouTube-Embed
  das nächste Video nur noch vor (`cueVideoById`), statt es stumm anzuspielen.
  Vorher hat Chromium jedes Video ein zweites Mal dekodiert und gepuffert,
  obwohl mpv es zeigt. Der City-Flyers-Film (10 MB) wird erst zum
  Mannschaftsfoto geladen und danach wieder ganz freigegeben.
* **Chromium** (`kiosk/citycafe-chromium`): kein eigener Prozess pro fremdem
  iframe (`--disable-site-isolation-trials`), keine Hintergrunddienste.
* **mpv**: Puffergrenzen, siehe oben.
* **yt-dlp**: Die übliche Einzeldatei entpackt sich bei jedem Aufruf nach
  `/tmp`, also in den Arbeitsspeicher (rund 80 MB, dazu Sekunden an CPU). Liegt
  die Zipapp-Fassung unter `/opt/citycafe/bin/yt-dlp.pyz`, nimmt der Aufpasser
  diese und fällt nur bei einem Fehlschlag auf die Einzeldatei zurück.
* **zram**: komprimierter Swap im RAM (`kiosk/citycafe-zram` plus
  `citycafe-zram.service`). Nie Swap auf der Speicherkarte.

Einrichten auf der Box (einmalig; Dateien vorher mit `scp` nach `~` kopieren):

```sh
# yt-dlp als Zipapp (braucht Python 3.10 oder neuer)
sudo curl -L -o /opt/citycafe/bin/yt-dlp.pyz \
    https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
sudo chmod +x /opt/citycafe/bin/yt-dlp.pyz
/opt/citycafe/bin/yt-dlp.pyz --version     # muss eine Versionsnummer zeigen

# zram
sudo install -m 755 ~/citycafe-zram /usr/local/bin/citycafe-zram
sudo install -m 644 ~/citycafe-zram.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now citycafe-zram.service
cat /proc/swaps                             # /dev/zram0 muss auftauchen

# Chromium-Starter und Aufpasser aktualisieren, dann sway neu starten
sudo install -m 755 ~/citycafe-chromium /usr/local/bin/citycafe-chromium
sudo install -m 644 ~/nl-mpv-supervisor.py /opt/citycafe/nl-mpv-supervisor.py
```

Nachsehen, ob es reicht: `free -m` (Spalte *available* sollte im Betrieb nicht
unter 300 MB fallen) und `journalctl -k | grep -i "out of memory"`.

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
