#!/bin/sh
# Richtet auf der Kiosk-Box die Sparmassnahmen fuer 2 GB RAM ein
# (siehe KIOSK-SUPERVISOR.md, "Arbeitsspeicher"):
#   - yt-dlp als Zipapp            -> /opt/citycafe/bin/yt-dlp.pyz
#   - zram-Swap                    -> /usr/local/bin/citycafe-zram + Dienst
#   - neuer Chromium-Starter       -> /usr/local/bin/citycafe-chromium
#   - neuer Supervisor             -> /opt/citycafe/nl-mpv-supervisor.py
# Alte Dateien werden vorher als *.vor-ram gesichert.
#
# Aufruf auf der Box (als citycafe, mit sudo-Recht):
#   curl -fsSL https://raw.githubusercontent.com/motte025/City-cafe/main/kiosk/ram-einrichten.sh -o ~/ram-einrichten.sh
#   sh ~/ram-einrichten.sh              # nur einrichten
#   sh ~/ram-einrichten.sh --neustart   # danach Kiosk neu starten
set -eu

QUELLE="https://raw.githubusercontent.com/motte025/City-cafe/main/kiosk"
ARBEIT="$(mktemp -d "$HOME/ram-einrichten.XXXXXX")"   # bewusst nicht /tmp (RAM-Disk)
trap 'rm -rf "$ARBEIT"' EXIT

schritt() { printf '\n== %s\n' "$*"; }
holen() { curl -fsSL "$1" -o "$2"; }
sichern() { [ -e "$1" ] && sudo cp -a "$1" "$1.vor-ram" || true; }

schritt "Dateien aus dem Repo holen"
for f in citycafe-chromium nl-mpv-supervisor.py citycafe-zram citycafe-zram.service; do
    holen "$QUELLE/$f" "$ARBEIT/$f"
done
sh -n "$ARBEIT/citycafe-chromium"
sh -n "$ARBEIT/citycafe-zram"
python3 -m py_compile "$ARBEIT/nl-mpv-supervisor.py"
echo "ok"

schritt "yt-dlp als Zipapp"
holen https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp "$ARBEIT/yt-dlp.pyz"
chmod +x "$ARBEIT/yt-dlp.pyz"
if "$ARBEIT/yt-dlp.pyz" --version >/dev/null 2>&1; then
    sudo install -m 755 "$ARBEIT/yt-dlp.pyz" /opt/citycafe/bin/yt-dlp.pyz
    echo "installiert: $(/opt/citycafe/bin/yt-dlp.pyz --version)"
else
    echo "WARNUNG: Zipapp laeuft hier nicht (Python zu alt?) - bleibt bei der Einzeldatei."
    python3 --version || true
fi

schritt "zram"
sudo install -m 755 "$ARBEIT/citycafe-zram" /usr/local/bin/citycafe-zram
sudo install -m 644 "$ARBEIT/citycafe-zram.service" /etc/systemd/system/citycafe-zram.service
sudo systemctl daemon-reload
sudo systemctl enable --now citycafe-zram.service
cat /proc/swaps

schritt "Chromium-Starter und Supervisor"
sichern /usr/local/bin/citycafe-chromium
sichern /opt/citycafe/nl-mpv-supervisor.py
sudo install -m 755 "$ARBEIT/citycafe-chromium" /usr/local/bin/citycafe-chromium
sudo install -m 644 "$ARBEIT/nl-mpv-supervisor.py" /opt/citycafe/nl-mpv-supervisor.py
echo "ok (Sicherungen: *.vor-ram)"

schritt "Speicher jetzt"
free -m

if [ "${1:-}" = "--neustart" ]; then
    schritt "Kiosk neu starten"
    # Chromium beenden -> sway endet -> die Schleife in ~/.bash_profile startet
    # alles frisch, samt neuem Supervisor. Ueber die PID, nicht pkill -f.
    PID="$(pgrep -o -u citycafe -f 'chromium-kiosk' || true)"
    if [ -n "$PID" ]; then
        kill "$PID"
        echo "Chromium ($PID) beendet - Kiosk startet in ein paar Sekunden neu."
    else
        echo "Kein Kiosk-Chromium gefunden."
    fi
else
    echo
    echo "Fertig. Wirksam wird alles nach einem Neustart des Kiosks:"
    echo "  sh ~/ram-einrichten.sh --neustart   oder   sudo reboot"
fi
