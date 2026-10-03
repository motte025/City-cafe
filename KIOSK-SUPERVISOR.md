# Der mpv-Aufpasser auf der Kiosk-Box

Auf der Kiosk-Box läuft neben Chromium ein kleines Python-Programm, das die
bewegten Bilder übernimmt: **`nl-mpv-supervisor.py`**. Ohne ihn spielt das
Dashboard alles im Browser – mit ihm laufen Nightlife-Videos, Twitch-Streams
und die Dartcam in einem eigenen mpv-Fenster, das exakt über dem jeweiligen
Widget liegt.

Die Box ist seit 30.09.2026 der **ACEMAGIC W1** (`ssh w1`, siehe `STAND.md`);
den ODROID gibt es nicht mehr. Wo unten vom ODROID die Rede ist, ist das die
Vorgeschichte – sie erklärt, warum es die Standardwerte gibt.

Die Datei im Ordner `kiosk/` ist die **maßgebliche Fassung**: Der W1 holt sie
jeden Morgen um 8:30 aus GitHub `main` (`citycafe-update.timer`, nur nach
Syntaxprüfung). Geändert wird also im Repo, nicht auf der Box – sonst
überschreibt das nächste Update die Änderung.

## Einstellungen je Gerät

Starter und Supervisor lesen Umgebungsvariablen; auf dem W1 stehen sie in
`/home/citycafe/.config/citycafe.env` (geladen von `~/.bash_profile` vor
sway). Ohne Variablen gelten die alten ODROID-Werte.

| Variable | Wirkt auf | Standard | W1 |
| --- | --- | --- | --- |
| `CITYCAFE_RAUM` / `CITYCAFE_BOXNAME` | Raum und Name in der Kiosk-Adresse | `zuhause` / `Zuhause` | `city-cafe` / leer |
| `CITYCAFE_HWDEC` | mpv `--hwdec` | `no` | `vaapi` |
| `CITYCAFE_DEMUXER_MIB` / `_BACK_MIB` | mpv-Puffer | 48 / 8 | 512 / 64 |
| `CITYCAFE_MPV_PROFILE` | mpv `--profile` | `fast` | `fast` |
| `CITYCAFE_CAM_CACHE_SECS` | Dartcam-Puffer | 3 | 8 |
| `CITYCAFE_BT_NAME` | Teil des Namens des Bluetooth-Empfängers | `B03` | `B03` |
| `CITYCAFE_OUTPUT` | Ausgang für `wlr-randr` | `HDMI-A-1` | `HDMI-A-1` |
| `CITYCAFE_CHROMIUM_EXTRA` | zusätzliche Chromium-Schalter | leer | VA-API-Features |
| `CITYCAFE_VOLUME` | Lautstärke für `citycafe-bt` | 0.9 | 0.9 |
| `CITYCAFE_NUR_H264` | Musik nur in H.264 (schwache Geräte) | aus | aus (W1 dekodiert VP9/AV1) |
| `CITYCAFE_MIX_COOKIES` | YouTube-Mix mit Konto-Cookies lesen (0 = ohne) | 1 | 1 |
| `CITYCAFE_URL` / `CITYCAFE_URL_EXTRA` | andere Dashboard-Adresse (Test) / Zusatz wie `&chefpin=…` (in Anführungszeichen!) | GitHub Pages / leer | – |

## Warum überhaupt mpv

Chromium dekodierte auf dem ODROID in Software und schaffte 1080p60 nicht
ruckelfrei; mpv schaffte es. Auf dem W1 dekodiert mpv in Hardware (VA-API).
Deshalb:

* **YouTube (Nightlife)**: `yt-dlp` löst die Adresse auf, mpv spielt Bild und
  Ton, das YouTube-Embed darunter wird stummgeschaltet und angehalten.
* **Twitch (DJ-Slot)**: `streamlink` holt den Stream und filtert die
  Werbeblöcke heraus, mpv spielt ihn.
* Fällt eines davon aus, spielt automatisch wieder der Browser-Player.

Standard ist `--hwdec=no --vo=gpu --profile=fast --sid=no`: Der
Hardware-Dekoder des ODROID blieb im Test bei 3 von 12 Starts hängen, die
Software-Dekodierung bei 0. Auf dem W1 steht `CITYCAFE_HWDEC=vaapi`; im
mpv-Log muss dann `Using hardware decoding (vaapi)` stehen. `--sid=no` hält
Untertitel in jedem Fall draußen. Die Puffergrenzen (`--demuxer-max-bytes`)
waren für die 2 GB des ODROID nötig; der W1 nimmt 512 MiB.

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
* **Zufälliger Einstieg**: Das Dashboard kennt die Länge eines Videos erst nach
  dem ersten Abspielen und gibt bis dahin Start 0 vor. yt-dlp liefert die
  Länge beim Auflösen mit (`--print duration`); der Supervisor wählt dann
  selbst einen Startpunkt, der den 4-Minuten-Slot nicht ins Videoende laufen
  lässt. Wünsche vom Handy beginnen von vorn.
* **Dartcam** (Dart-Abend-Modus): RTSP über TCP ohne Ton, Puffer
  `CITYCAFE_CAM_CACHE_SECS`; fällt die Kamera aus, verbindet er nach 5 s neu.
* **Bluetooth zur Anlage**: Die Fernbedienung legt `window.nlBtAuftrag`
  (`verbinden`/`trennen`/`status`) ab, der Supervisor führt es mit
  `bluetoothctl` aus und meldet in `window.nlBtStatus` zurück. „Verbunden"
  heißt nur dann verbunden, wenn es den PipeWire-Ausgang `bluez_output…` gibt
  – die Verbindung allein reicht nicht (hält ein anderes Gerät den Tonkanal
  des B03 Pro, lehnt er A2DP ab). „Trennen" blockiert den Empfänger zusätzlich
  (er verbände sich sonst nach ~30 s von selbst), „Verbinden" hebt das auf.
  Nach einem Neustart des Supervisors wird ein alter Auftrag nicht wiederholt.
  Mehrere gekoppelte Empfänger sind möglich: „Verbinden" wartet nach dem
  Entsperren 4 s (der Empfänger meldet sich oft selbst, ein gleichzeitiger
  connect scheitert dann mit „busy"), probiert dann der Reihe nach und wartet
  bis 20 s auf den Tonkanal; „Trennen" trennt und sperrt alle.
  Verbunden wird nur per Knopf; `/usr/local/bin/citycafe-bt` (nur auf dem W1)
  setzt lediglich einen neuen Bluetooth-Ausgang als Standard mit 90 %.
* **Aufräumen**: `/tmp` liegt im Arbeitsspeicher. Alle 30 Minuten entfernt er
  liegengebliebene Auspackordner von `yt-dlp`; ein volles `/tmp` hat schon
  einmal dazu geführt, dass der Kernel Chromium abgeschossen hat.

## YouTube-Musik (YOUTUBE-MUSIK-SETUP.md)

Meldet das Dashboard `window.nlMusik`, wählt der Aufpasser die Qualität mit
`musik_format()`: 1080p60, sonst die nächstbeste Stufe (Auflösung vor
Bildrate), kein hartes H.264 – die gewählte Qualität steht als
`Qualitaet <id>: …` im Protokoll. Weitere Schnittstellen zum Dashboard:

| window.… | Richtung | Zweck |
|---|---|---|
| `nlMusikVorladen` {videoId, hoehe, fps} | Dashboard → Aufpasser | nächsten Song 60 s vorher auflösen (Lücke < 3 s) |
| `nlMixAuftrag` → `nlMixErgebnis` | hin und zurück | YouTube-Mix (list=RD…), Rückfall Titelsuche |
| `nlPlaylistAuftrag` → `nlPlaylistErgebnis` | hin und zurück | Playlist lesen (24 h Cache in ~/.cache/citycafe) |
| `nlFindeAuftrag` → `nlFindeErgebnis` | hin und zurück | Titel ohne videoId finden (Platzhalter, Last.fm) |
| `nlPauseWunsch` | Dashboard → Aufpasser | Pause/Weiter (der Wächter hält Pause nicht für Hänger) |
| `nlMpvFlaeche` | Dashboard → Aufpasser | `nl-player-frame` oder `yt-vollbild-video`: mpv wird nur umgelegt, kein Neustart |
| `nlQrKarte` | Dashboard → Aufpasser | QR-Kärtchen als PNG; per mpv `overlay-add` in die Ecke (braucht `python-pillow`) |
| `nlMpvStand` {videoId, pos, dauer, pause} | Aufpasser → Dashboard | Zeitanzeige, Fortschritt, Vorladen |

Suche, Vorladen, Mix, Playlist und Finden teilen sich **einen** Neben-Thread:
höchstens ein yt-dlp-Prozess zusätzlich (OOM vom 21.09.2026).
`place_mpv()` setzt erst die Größe, dann die Lage – sway skaliert schwebende
Fenster um die Mitte.

## Arbeitsspeicher (ODROID, Vorgeschichte)

Der W1 hat 15 GB; dort ist nichts davon nötig (kein zram, große Puffer,
`--disable-site-isolation-trials` ist aus dem Starter entfernt, weil Chromium
153 dafür eine Warnleiste einblendet). Für ein kleines Gerät bleibt es
gültig:

Chromium, mpv und yt-dlp teilten sich auf dem ODROID 2 GB. Wird es eng, beendet der Kernel
einen Prozess – meist Chromium, und der Bildschirm ist kurz schwarz. Deshalb:

* **Dashboard** (`index.html`): Mit laufendem Aufpasser lädt das YouTube-Embed
  das nächste Video nur noch vor (`cueVideoById`), statt es stumm anzuspielen.
  Vorher hat Chromium jedes Video ein zweites Mal dekodiert und gepuffert,
  obwohl mpv es zeigt. Der City-Flyers-Film (10 MB) wird erst zum
  Mannschaftsfoto geladen und danach wieder ganz freigegeben.
* **Chromium** (`kiosk/citycafe-chromium`): keine Hintergrunddienste. (Der
  frühere Schalter `--disable-site-isolation-trials` ist entfernt.)
* **mpv**: Puffergrenzen, siehe oben.
* **yt-dlp**: Die übliche Einzeldatei entpackt sich bei jedem Aufruf nach
  `/tmp`, also in den Arbeitsspeicher (rund 80 MB, dazu Sekunden an CPU). Liegt
  die Zipapp-Fassung unter `/opt/citycafe/bin/yt-dlp.pyz`, nimmt der Aufpasser
  diese und fällt nur bei einem Fehlschlag auf die Einzeldatei zurück.
* **zram**: komprimierter Swap im RAM (`kiosk/citycafe-zram` plus
  `citycafe-zram.service`). Nie Swap auf der Speicherkarte.

Am einfachsten erledigt das alles `kiosk/ram-einrichten.sh` (holt die Dateien
aus `main`, sichert die alten als `*.vor-ram`, prüft vor dem Einspielen):

```sh
curl -fsSL https://raw.githubusercontent.com/motte025/City-cafe/main/kiosk/ram-einrichten.sh -o ~/ram-einrichten.sh
sh ~/ram-einrichten.sh --neustart
```

Von Hand, Schritt für Schritt (Dateien vorher mit `scp` nach `~` kopieren):

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

Gestartet wird er von sway (siehe `kiosk/sway-citycafe.conf`). Am
einfachsten startet man den ganzen Kiosk neu: Chromium per PID beenden, dann
endet sway, und die Schleife in `~/.bash_profile` startet alles frisch (gut
5 s schwarz).

Nur den Supervisor neu starten (Dashboard läuft weiter) – **mit** den
Geräte-Einstellungen, sonst fehlen VA-API, Raum und Puffer:

```sh
P=$(pgrep -o -f "^python3 /opt/citycafe/nl-mpv-supervisor.py"); sudo kill $P
sudo -u citycafe sh -c 'set -a; . /home/citycafe/.config/citycafe.env; set +a
  export XDG_RUNTIME_DIR=/run/user/1001; cd /home/citycafe
  setsid python3 /opt/citycafe/nl-mpv-supervisor.py >/dev/null \
    2>>/home/citycafe/nl-mpv-supervisor.err </dev/null &'
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
* **Von sway per `exec` gestartete Dienste überleben einen sway-Neustart.**
  Jeder muss beim Start seine alte Instanz beenden; sonst liefen drei
  `citycafe-bt` gegeneinander, und der B03 Pro meldete „Device or resource
  busy".
* **Windows-Zeilenenden**: Die Arbeitskopie auf dem Beelink hat CRLF. Vor dem
  Übertragen mit `tr -d '\r'` bereinigen, sonst bricht `sh` ab.
