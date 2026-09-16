# City-cafe
City

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
