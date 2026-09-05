# Vereinswappen (Bundesliga + Champions League)

Lokale Kopien der offiziellen Vereinswappen für die Bundesliga- und
Champions-League-Widgets in `index.html`. Sie liegen hier im Repo, damit das
Dashboard nicht bei jedem Seitenaufruf gegen Wikimedia/imgur/UEFA hotlinkt.

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

## Champions League 2026/27 — zusätzliche Teams

Alle Teilnehmer ohne eigenes Bundesliga-Wappen weiter oben. Grund fürs lokale
Ablegen war hier akut, nicht nur vorsorglich: mehrere `teamIconUrl` liefen nur
über `http://` (von der per HTTPS ausgelieferten Seite aus als Mixed Content
geblockt) oder trafen Wikimedias Rate-Limit (HTTP 429) bei wiederholten
Seitenaufrufen — beides zeigte sich live als fehlende Wappen im Widget.

| ID | Verein | ID | Verein |
|---|---|---|---|
| 356 | FC Barcelona | 1804 | Real Betis |
| 366 | Fenerbahçe SK | 2281 | Paris Saint-Germain |
| 370 | FC Liverpool | 2331 | SSC Napoli |
| 376 | PSV Eindhoven | 2554 | Galatasaray Istanbul |
| 378 | AS Rom | 2556 | Manchester United FC |
| 382 | Villarreal CF | 4241 | Atletico Madrid |
| 733 | Inter Mailand | 4244 | Manchester City |
| 1133 | Real Madrid | 4578 | Slavia Prag |
| 1204 | Lille OSC | 5139 | LASK |
| 1205 | Sporting CP | 5699 | Slovan Bratislava |
| 1210 | FC Brügge | 5707 | FK Bodö/Glimt |
| 1217 | AEK Athen | 5962 | RC Lens |
| 1484 | Viking | 8787 | Como 1907 |
| 1770 | Feyenoord Rotterdam | 8798 | Sabah |

Nicht hier abgelegt (bewusst): Teams, deren `teamIconUrl` bereits ein
eingebettetes `data:`-Bild ist (z. B. Aston Villa, FC Arsenal, FC Porto,
Shakhtar Donetsk zur Saison 2026/27) — die brauchen keinen Netzabruf und damit
auch keine lokale Kopie.

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
