# Umstellung auf den ACEMAGIC W1 (Claude Code in PowerShell auf dem Beelink)

Arbeitsanleitung für die Sitzung, in der Claude Code vom Beelink aus den W1 per
SSH einrichtet. Sie ersetzt nicht `STAND.md` und `KIOSK-SUPERVISOR.md`, sondern
sagt, in welcher Reihenfolge und womit der ODROID abgelöst wird.

## Ausgangslage

- **W1** (Ryzen 7 H255, EndeavourOS) ist online und soll im Café den ODROID
  ablösen. Er rechnet auf x86, also ohne Sparmodus und mit Hardware-Decoding über
  VA-API statt der Amlogic-Wege.
- **Beelink SER5 5800H** (zuhause) bekommt danach ebenfalls EndeavourOS.
- Das Kiosk-Gerüst liegt in `kiosk/`: `sway-citycafe.conf`, `citycafe-chromium`
  (Starter), `nl-mpv-supervisor.py` (Aufpasser), `citycafe-zram` (beim W1 nicht
  nötig, genug RAM).
- Der Supervisor und der Chromium-Starter lassen sich jetzt **per
  Umgebungsvariablen** je Gerät einstellen. Ohne Variablen verhalten sie sich
  wie auf dem ODROID, dort muss nichts geändert werden.

| Variable | Wirkt auf | ODROID (Standard) | Vorschlag W1 |
| --- | --- | --- | --- |
| `CITYCAFE_HWDEC` | mpv `--hwdec` | `no` | `vaapi` (bei Problemen `auto-safe`) |
| `CITYCAFE_DEMUXER_MIB` | mpv Vorlauf-Puffer | `48` | `150` |
| `CITYCAFE_DEMUXER_BACK_MIB` | mpv Rückblick | `8` | `50` |
| `CITYCAFE_MPV_PROFILE` | mpv `--profile` | `fast` | `gpu-hq` oder `fast`, nach Test |
| `CITYCAFE_OUTPUT` | Bildschirmausgang für `wlr-randr` | `HDMI-A-1` | Name aus `swaymsg -t get_outputs` |
| `CITYCAFE_CHROMIUM_EXTRA` | zusätzliche Chromium-Schalter | leer | `--enable-features=VaapiVideoDecoder,VaapiVideoDecodeLinuxGL` |

Gesetzt werden sie dort, wo sway und der Supervisor starten (z. B. in
`~/.config/environment.d/citycafe.conf` oder oben in `~/.bash_profile` vor dem
Start von sway). Die Werte in der Spalte „W1“ sind Startpunkte, nicht geprüft.

## Reihenfolge

1. **SSH-Zugang** wie `odroid` einrichten: Schlüsselanmeldung, Benutzer
   `citycafe`, Eintrag `w1` in `~/.ssh/config` auf dem Beelink.
2. **Pakete**: `sway`, `chromium`, `mpv`, `python`, `yt-dlp`, `streamlink`,
   `wlr-randr`, Mesa mit VA-API (`libva-mesa-driver`, `libva-utils`).
   `vainfo` muss H.264 (und möglichst VP9/AV1) als Decode-Profil zeigen.
3. **Dateien** aus dem Repo nach `/usr/local/bin/` und `/opt/citycafe/`
   (`citycafe-chromium`, `nl-mpv-supervisor.py`, `sway-citycafe.conf`). In
   `sway-citycafe.conf` steht der Ausgang `HDMI-A-1` fest: Namen prüfen und dort
   sowie in `CITYCAFE_OUTPUT` anpassen.
4. **Chromium-Erweiterungen** (`twitch-autostart`, `h264-force`,
   `youtube-kiosk-ui` unter `/opt/citycafe/`) vom ODROID übernehmen. Sie liegen
   nicht im Repo.
5. **Autostart**: wie auf dem ODROID die Schleife in `~/.bash_profile`, die sway
   nach einem Ende von Chromium neu startet.
6. **Raum** prüfen: Die Datei im Repo nennt `raum=zuhause` (Fernseher zuhause).
   Für das Café den Raum und den `boxname` aus dem laufenden Starter des ODROID
   übernehmen (`ssh odroid cat /usr/local/bin/citycafe-chromium`).
7. **Test** ohne den ODROID auszuschalten: W1 und ODROID gleichzeitig am selben
   Raum würden sich gegenseitig stören, deshalb den W1 zuerst an einem eigenen
   Testraum (`raum=w1test`) laufen lassen.
8. **Umschalten**: Raum auf den Café-Raum stellen, ODROID aus.

## Was nach dem Umzug zu prüfen ist

- Dashboard läuft im Kiosk, Rotation wechselt die Slots.
- Nightlife (YouTube über mpv) zeigt Bild und Ton; `nl-mpv-supervisor.log` ohne
  Fehler, mpv-Log zeigt `Using hardware decoding (vaapi)`.
- DJ-Stream (Twitch über streamlink und mpv) startet von allein.
- Dartcam (RTSP) läuft.
- Fernbedienungen (YouTube, DJ, Hos'n Obe) erreichen den W1 über Firebase.
- **Roulette** nicht im Café anzeigen (Vorgabe). Nur die Werbung
  `roulette-werbung/` läuft dort.
- Nach einem Neustart kommt alles ohne Handgriff wieder hoch.

## Bluetooth zur Anlage (1Mii B03 Pro)

Der W1 schickt seinen Ton per Bluetooth an den 1Mii B03 Pro (Schalter **RX**),
der hängt per Kabel an der Anlage. In der YouTube-Fernbedienung gibt es dafür
„🔵 Bluetooth zur Anlage“ mit Verbinden, Trennen und Prüfen. Der Supervisor
führt das mit `bluetoothctl` aus und stellt die Tonausgabe mit `pactl` auf den
Empfänger um.

Einmalig auf dem W1:

```sh
sudo pacman -S --needed bluez bluez-utils
sudo systemctl enable --now bluetooth
bluetoothctl            # dann: power on, scan on, warten bis „B03“ erscheint,
                        # pair ADRESSE, trust ADRESSE, connect ADRESSE, quit
```

Zum Koppeln am B03 Pro die Bluetooth-Taste gedrückt halten, bis die Anzeige
blinkt. Gefunden wird das Gerät über einen Teil des Namens (Standard „B03“,
änderbar mit `CITYCAFE_BT_NAME`), eine Adresse steht nicht im Repo.

## Regeln (aus `STAND.md`)

- Keine Zugangsdaten, Schlüssel oder Tokens ins Repo.
- Verweigerte Berechtigungen nicht umgehen; fragen.
- Die Datei `boot.ini.1786897722` des ODROID nie einspielen.
- Keine YouTube- oder Google-Cookies auf der Box löschen.
- Der Supervisor liest Cookies aus `chromium-kiosk`: nach einer Neuinstallation
  muss Chromium einmal im Google-Konto angemeldet werden (Premium ohne Werbung).

## Vorlage für Claude Code auf dem Beelink

> Wir richten den ACEMAGIC W1 (EndeavourOS, Ryzen 7 H255) als City-Cafe-Kiosk
> ein und lösen damit den ODROID im Café ab. Lies zuerst `STAND.md`,
> `KIOSK-SETUP.md`, `KIOSK-SUPERVISOR.md` und `W1-UMSTELLUNG.md` im Repo
> `motte025/City-cafe`. Arbeite die Reihenfolge in `W1-UMSTELLUNG.md` ab, per
> SSH auf den W1. Zeig mir vor jedem Schritt, was du ändern willst, und lade
> nichts ins Repo hoch, bevor ich es freigebe. Prüfe `vainfo`, bevor du
> `CITYCAFE_HWDEC=vaapi` setzt, und teste zuerst mit einem eigenen Testraum.
