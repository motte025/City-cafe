#!/bin/sh
# Lautheit (EBU R128) und Spitze je Song wie anhebung() im Supervisor. Ordner mit ids.txt (eine
# videoId je Zeile) anlegen, dann: werkzeuge/lufs_messen.sh <ordner>/ [ids.txt]  -> <ordner>/ergebnis.txt
# Ein Song nach dem anderen (sonst stoert es den Bluetooth-Ton). -nostdin ist noetig, sonst liest
# ffmpeg die ID-Liste mit (21.10.: 12 von 80 Songs verloren).
# Lautheit (EBU R128, ganzer Song) und Spitze je Video, wie anhebung() im Supervisor
D=${1%/}; shift 2>/dev/null; YT=$(command -v /opt/citycafe/bin/yt-dlp || command -v yt-dlp)
while read vid; do
  grep -q "^$vid " $D/ergebnis.txt 2>/dev/null && continue
  url=$($YT --js-runtimes node --cookies-from-browser chromium -f bestaudio -g "https://www.youtube.com/watch?v=$vid" 2>/dev/null | head -1)
  [ -z "$url" ] && { echo "$vid FEHLER" >> $D/ergebnis.txt; continue; }
  aus=$(timeout 120 ffmpeg -nostdin -hide_banner -nostats -i "$url" -vn -af ebur128=peak=sample -f null - 2>&1 | sed -n '/Summary:/,$p')
  I=$(echo "$aus" | grep -o "I: *-\?[0-9.]* LUFS" | grep -o "\-\?[0-9.]*" | head -1)
  P=$(echo "$aus" | grep -o "Peak: *-\?[0-9.]* dBFS" | grep -o "\-\?[0-9.]*" | head -1)
  echo "$vid $I $P" >> $D/ergebnis.txt
done < $D/${1:-ids.txt}
echo FERTIG >> $D/ergebnis.txt
