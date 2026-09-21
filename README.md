# City-cafe
City

## Wo steht was

| Datei | Inhalt |
| --- | --- |
| `index.html` | Das Dashboard am Fernseher: Rotation aller Widgets, Nightlife, DJ-Slot, Hos'n Obe, Roulette-Slot |
| `FERNBEDIENUNGEN.md` | Die Handy-Fernbedienungen (eine Adresse, vier Reiter) und wie sie den richtigen Screen finden |
| `KIOSK-SUPERVISOR.md` | Der mpv-Aufpasser auf der Box: Video und Twitch ausserhalb des Browsers, Waechter, Neustart |
| `kiosk/` | Die Dateien, die auf der Box liegen (Aufpasser, sway-Konfiguration, Chromium-Starter) |
| `HOSN-OBE-SETUP.md` | Das Kartenspiel: Regeln, Firebase-Pfade, Handy-Seite |
| `DJ-FERNBEDIENUNG-SETUP.md`, `DJ-LIVESTREAM-SETUP.md` | Twitch-DJ am Screen |
| `NIGHTLIFE-SETUP.md` | Videoliste und Abspielregeln |
| `DART-LIGA-SETUP.md` | Dart-Widgets des Hausvereins |
| `roulette-src/README.md` | Roulette (von Codex gebaut): TV-Seite, Fernbedienung, eigener Bau mit Vite |

Der Roulette-Slot im Dashboard laeuft **nur am Fernseher zuhause**
(`?raum=zuhause`); im Lokal ueberspringt er sich selbst.

## Performance: Frame-Verluste auf dem ODROID

Seit 16.09.2026 laeuft der Kiosk auf einem ODROID mit EndeavourOS (cage +
Chromium, `/usr/local/bin/citycafe-browser`), nicht mehr auf Android TV/Lumify
(die aelteren Dokumente `KIOSK-SETUP.md` und `DJ-LIVESTREAM-SETUP.md`
beschreiben noch den frueheren Betrieb und sind ueberholt).

Gemessene Frame-Verluste (`getVideoPlaybackQuality()` bzw. Twitch
`getPlaybackStats()`):

| Messung | Verlorene Frames |
| --- | --- |
| Vormessung (`scaling_governor` auf `ondemand`/Standard) | 9 von 600 |
| Mit CPU-Governor `performance` | 4 von 600 |
| Bei einem 60-fps-YouTube-Video | rund 9 % |

Der Governor steht inzwischen dauerhaft auf `performance`
(`/sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`), das ist der
Zustand, mit dem die 4-von-600-Messung erzielt wurde.
