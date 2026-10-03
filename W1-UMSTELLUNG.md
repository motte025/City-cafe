# Umstellung auf den ACEMAGIC W1 – erledigt (30.09.2026)

Der W1 (Ryzen 7 H255, Radeon 780M, 15 GB RAM) läuft im Café als Kiosk und hat
den ODROID abgelöst; den ODROID gibt es nicht mehr. Aktueller Stand und
Zugang: `STAND.md` (Abschnitt „Geräte"), Einstellwerte und Betrieb des
Supervisors: `KIOSK-SUPERVISOR.md`. Diese Datei hält fest, wie eingerichtet
wurde – als Vorlage für den nächsten Rechner (geplant: Beelink SER5 zuhause).

## So wurde eingerichtet

1. **EndeavourOS neben Windows** vom USB-Stick („Neben Windows installieren",
   100 GB, GRUB als Bootloader – die Windows-EFI-Partition hat nur 100 MB,
   zu klein für systemd-boot). Vorher in Windows: Schnellstart aus, BitLocker
   geprüft (`manage-bde -status C:`). Secure Boot im BIOS aus.
2. **Startreihenfolge** im BIOS auf EndeavourOS gestellt – `efibootmgr -o`
   allein hielt nicht, das BIOS setzte Windows wieder nach vorn.
3. **SSH**: `sshd` aktiviert; auf dem Beelink Schlüssel
   `~/.ssh/citycafe_w1_ed25519` und Eintrag `w1` in `~/.ssh/config`
   (Benutzer `sabrina`). Der öffentliche Schlüssel kam per kurzem
   `curl … | sh` vom Beelink auf den W1, weil die Passworteingabe über das
   Eingabefeld von Claude Code nicht geht. `sudo` ohne Passwort für `sabrina`
   (`/etc/sudoers.d/10-sabrina`).
4. **Pakete**: `sway chromium mpv yt-dlp streamlink wlr-randr libva-utils
   libva-mesa-driver grim`, Bluetooth (`bluez bluez-utils`,
   `bluetooth.service` aktiviert). `vainfo` zeigt H.264, HEVC, VP9, AV1.
5. **Kiosk-Benutzer `citycafe`** (Gruppen video, render, audio, input),
   Autologin auf tty1 (`getty@tty1.service.d/autologin.conf`),
   `~/.bash_profile` lädt `~/.config/citycafe.env` und startet sway in einer
   Schleife. `plasmalogin` (KDE-Anmeldung) deaktiviert, Ruhezustand per
   `systemctl mask sleep.target suspend.target …` gesperrt.
6. **Dateien aus `kiosk/`**: `citycafe-chromium` nach `/usr/local/bin/`,
   `nl-mpv-supervisor.py` nach `/opt/citycafe/`, `sway-citycafe.conf` als
   `~citycafe/.config/sway/config` (dazu eine Zeile für `citycafe-bt`, die
   eine alte Instanz vorher beendet). `/opt/citycafe/bin/yt-dlp` ist ein
   Link auf das Paket.
7. **Einstellungen** (`citycafe.env`): siehe Tabelle in
   `KIOSK-SUPERVISOR.md`. Die drei Chromium-Erweiterungen des ODROID gingen
   mit ihm verloren; `h264-force` wird nicht mehr gebraucht, der Starter lädt
   Erweiterungen nur, wenn sie vorhanden sind.
8. **Google-Anmeldung** im Kiosk-Profil (YouTube Premium): über die
   Debug-Schnittstelle ein Fenster `accounts.google.com` geöffnet
   (`curl -X PUT "http://127.0.0.1:9222/json/new?…"`), am Gerät angemeldet.
   Der Supervisor liest die Cookies aus `chromium-kiosk`; nach einer
   Neuinstallation muss die Anmeldung wiederholt werden.
9. **Bluetooth**: siehe unten.
10. **Nächtliches Update** `citycafe-update.timer` (8:30), siehe `STAND.md`.

## Bluetooth zur Anlage (1Mii B03 Pro)

Der W1 schickt seinen Ton per Bluetooth an den 1Mii B03 Pro (Schalter **RX**),
der hängt per Kabel an der Anlage. In der YouTube-Fernbedienung gibt es dafür
„🔵 Bluetooth zur Anlage“ mit Verbinden, Trennen und Prüfen. Der Supervisor
führt das mit `bluetoothctl` aus und stellt die Tonausgabe mit `pactl` auf den
Empfänger um. „Verbunden" meldet er nur, wenn der Tonkanal steht
(PipeWire-Ausgang `bluez_output…`). Verbunden wird nur per Knopf: „Trennen"
blockiert den Empfänger zusätzlich, „Verbinden" hebt das auf. `citycafe-bt`
verbindet nie selbst, es setzt nur einen neuen Bluetooth-Ausgang mit CITYCAFE_VOLUME (jetzt 100 %).

Koppeln (einmal je Empfänger, also zuhause und im Café):

```sh
bluetoothctl            # dann: agent NoInputNoOutput, default-agent,
                        # power on, pairable on, scan on, warten bis „B03“
                        # erscheint, pair ADRESSE, trust ADRESSE,
                        # connect ADRESSE, quit
bluetoothctl info ADRESSE | grep Bonded    # muss "yes" sein
```

Ohne Agent klappt das Koppeln zwar, der Schlüssel wird aber nicht gespeichert
(`Bonded: no`) – nach dem ersten Trennen ist die Kopplung dann weg.

Zum Koppeln am B03 Pro die Bluetooth-Taste gedrückt halten, bis die Anzeige
blinkt; das Fenster ist nur kurz offen. Gefunden wird das Gerät über einen
Teil des Namens (Standard „B03“, änderbar mit `CITYCAFE_BT_NAME`), eine
Adresse steht nicht im Repo. Der Codec ist aptX HD.

Steht die Verbindung, aber ohne Ton („Device or resource busy" /
„Permission denied" im `journalctl -u bluetooth`): Liefen mehrere
`citycafe-bt` gleichzeitig? Hält ein anderes Gerät (Handy) den Tonkanal?
Sonst `bluetoothctl remove ADRESSE` und neu koppeln – das hat am 01.10.
geholfen.

## Noch offen

- Dartcam im Café-Netz prüfen.
- Im Café einmal „Verbinden" am Handy testen (derselbe B03 Pro wie zuhause,
  kein Koppeln nötig).

## Regeln (aus `STAND.md`)

- Keine Zugangsdaten, Schlüssel oder Tokens ins Repo.
- Verweigerte Berechtigungen nicht umgehen; fragen.
- Nichts an Partitionen, Bootloader oder Windows ohne Freigabe.
- Keine YouTube- oder Google-Cookies im Kiosk-Profil löschen.
- Im Café kein Roulette-Spiel, nur die Werbung.
