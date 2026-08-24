# Vereinswappen (Bundesliga)

Lokale Kopien der offiziellen Vereinswappen für die beiden Bundesliga-Widgets
in `index.html`. Sie liegen hier im Repo, damit das Dashboard nicht bei jedem
Seitenaufruf gegen Wikimedia/imgur hotlinkt.

## Benennung

`<teamId>.png` — die `teamId` ist die ID aus OpenLigaDB
(`team1.teamId` / `team2.teamId` bzw. `teamInfoId` in der Tabelle).

Alle Dateien sind PNG mit Transparenz, 240 px hoch, auf den Bildinhalt
zugeschnitten. Die Breite variiert, weil einige Wappen Schriftzüge sind
(Union Berlin, HSV, RB Leipzig) — die Widgets skalieren per `object-fit: contain`.

## Herkunft

Die Bilder stammen 1:1 aus der `teamIconUrl` der OpenLigaDB-API (meist Wikimedia
Commons). Es sind geschützte Marken der Vereine — sie dürfen **nicht** durch
selbstgezeichnete oder KI-generierte Logos ersetzt werden.

## Saison 2026/27 — enthaltene Teams

| ID | Verein | ID | Verein |
|---|---|---|---|
| 6 | Bayer 04 Leverkusen | 91 | Eintracht Frankfurt |
| 7 | Borussia Dortmund | 95 | FC Augsburg |
| 9 | FC Schalke 04 | 100 | Hamburger SV |
| 16 | VfB Stuttgart | 112 | SC Freiburg |
| 31 | SC Paderborn 07 | 134 | SV Werder Bremen |
| 40 | FC Bayern München | 175 | TSG Hoffenheim |
| 65 | 1. FC Köln | 198 | SV 07 Elversberg |
| 80 | 1. FC Union Berlin | 1635 | RB Leipzig |
| 81 | 1. FSV Mainz 05 | 87 | Borussia Mönchengladbach |

## Nach Auf-/Abstieg aktualisieren

Fehlt ein Wappen, fällt das Widget automatisch auf die Original-URL aus der API
zurück — es bleibt also nichts leer. Sauberer ist es, die neuen Vereine hier
abzulegen:

1. Team-IDs und Icon-URLs der neuen Saison holen:
   `https://api.openligadb.de/getbltable/bl1/<saison>`
2. Bild herunterladen, auf 240 px Höhe bringen, Rand wegschneiden,
   als `<teamId>.png` speichern (SVG-Quellen vorher rastern).
3. In `index.html` die Liste `BL_LOCAL_CRESTS` um die neuen IDs ergänzen und
   abgestiegene entfernen.
