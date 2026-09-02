# Dart-Widgets: City Flyers (Chaoten & Fraggles)

Vier Slots im grossen Media-Bereich, **ganz am Anfang des Zyklus** - noch vor
Nightlife und dem Tag/Nacht-Plakat:

| # | Slot | Dauer | Inhalt |
| --- | --- | --- | --- |
| 1 | Naechstes Spiel | 22 s | je Mannschaft eine Karte: Datum, Runde, Gegner, Heim/Auswaerts, Spielort |
| 2 | Mannschaftsfoto | 15 s | Foto als Zwischenfolie - **nur wenn die Bilddatei vorhanden ist** |
| 3 | Spielplan | ~48 s | alle 28 Spiele, 7 Zeilen x 4 Seiten, wanderndes Aufleuchten |
| 4 | Tabelle | 26 s | Rang, Team, Sp, S, N, Pkt - **nur mit Daten aus `dart_liga.json`** |

Danach laeuft die Rotation unveraendert weiter: Nightlife, Tag/Nacht-Plakat,
Calamari, DJ-Live und der Rest bis zum Trinkspiel - von dort geht es wieder
zurueck an den Anfang zur Dart-Strecke.

Die Reihenfolge steckt in `runMasterSequence` (`index.html`) und haengt an
vier Positionsmarken: `DART_SLOT_INDEX` (-2), `DART_FOTO_INDEX` (-1.9),
`DART_PLAN_INDEX` (-1.8) und `DART_TABELLE_INDEX` (-1.7). Sie liegen bewusst
vor Nightlife (-0.5) und dem Hos'n Obe-Testslot (-1), damit die Zahlen in
derselben Reihenfolge stehen wie die Slots laufen. Soll die Dart-Strecke
woanders hin, sind nur drei Stellen zu aendern: der Startwert von
`mediaStateIndex` am Ende des Skripts, der Nachfolger des Tabellen-Slots und
der Ruecksprung aus dem Trinkspiel V1.

## Bilder (optional)

Zwei Dateien, beide freiwillig - fehlt eine, laeuft das Dashboard ohne sie
weiter. Format wie die uebrigen Bilder im Repo: **WebP**, ins Repo-Hauptverzeichnis.

| Datei | Wirkung wenn vorhanden | Wirkung wenn nicht |
| --- | --- | --- |
| `city_flyers_logo.webp` | Vereinslogo im Kopf aller Dart-Ansichten und auf der Foto-Folie | Dart-Emoji 🎯 bleibt stehen |
| `city_flyers_chaoten.webp` | Foto-Zwischenfolie "City Flyers \"Chaoten\"" | Slot 2 faellt aus der Rotation |
| `city_flyers_fraggles.webp` | dieselbe Folie fuer die Fraggles | - |

Das Logo ist von der Wand abfotografiert und hat deshalb einen weissen Grund.
Es sitzt im Kopf auf einem weissen Badge - **freistellen geht nicht**: die
weissen Felder der Dartscheibe SIND dieser weisse Grund und wuerden mit ihm
verschwinden. Im Bild steckt nur das Emblem (Pfeile + Scheibe), nicht der
Schriftzug: bei 46 Pixel Kopfhoehe waere er ohnehin unlesbar, und daneben
steht "City Flyers" bereits als Text.

Sind **beide** Mannschaftsfotos da, wechselt die Folie von Durchlauf zu
Durchlauf zwischen den Mannschaften - der Slot bleibt dabei immer 15 Sekunden
lang. Mehr ist nicht einzustellen: die Dateien werden beim Seitenstart
geprueft, Titel und Liga stehen automatisch darunter.

Zuschnitt: die Folie fuellt 1280x815 im Format `cover` und zeigt vom Bild den
Ausschnitt um **32 % Hoehe** - passend fuer ein Mannschaftsfoto, bei dem die
Leute im oberen Drittel stehen. Steht die Mannschaft auf einem neuen Foto
deutlich anders im Bild, laesst sich das ueber `object-position` in der
Regel `.df-foto` nachziehen.

## Was ohne jede Einrichtung laeuft

Slot 1 und 2 brauchen **nichts** - Spielplan, Gegner und Spielorte stehen fest
in `index.html` (`DART_CLUB`, `DART_SPIELORTE`). Die Erg-Spalte zeigt dann `–`
und Slot 3 ueberspringt sich selbst.

Automatisches Verhalten:

- **Spielbeginn ist immer 19:00 Uhr.** Die Uhrzeit steht deshalb nicht an
  jedem der 28 Spiele, sondern einmal auf der Karte "Naechstes Spiel" und
  einmal im Kopf des Spielplans. Aendert sich das, reicht die Konstante
  `DART_SPIELBEGINN` in `index.html` - beide Stellen ziehen mit.
- **Freilos-Runden** stehen im Spielplan als *spielfrei*, werden im
  "Naechstes Spiel" aber uebersprungen - dort interessiert nur, wann wirklich
  gespielt wird.
- **Nach dem letzten Spieltag** (08.05.2027) zeigt jede Karte "Saison beendet";
  sind beide Mannschaften durch, faellt Slot 1 ganz aus der Rotation.
- **Heim/Auswaerts** ergibt sich aus dem Spielplan: Team 1 ist Heimteam. Bei
  Heimspielen steht das City Cafe als Spielort, sonst die Adresse des Gegners.

## Saisonwechsel - was zu tun ist

1. In `index.html` die beiden `spielplan`-Listen in `DART_CLUB` austauschen
   (Runde, Datum, Heim, Auswaerts; bei Freilos zusaetzlich `freilos: true`).
2. Neue oder umgezogene Gegner in `DART_SPIELORTE` nachtragen.
3. In `google-apps-script/dart-liga-scraper.gs` die beiden `turnierid` neu
   setzen - siehe unten.

Fehlt zu einem Auswaertsgegner die Adresse, steht auf der Karte
"Spielort noch offen" statt einer falschen Adresse.

---

# Phase 2: Ergebnisse und Tabelle automatisch nachziehen

## Woher die Daten kommen

Der KEDSV betreibt das Ligasystem **My Darts Tournament**:

- Tabelle: `https://kedsv.my-darts-tournament.at/mdt/tabelle.php?turnierid=<ID>`
- Spielplan/Ergebnisse: `https://kedsv.my-darts-tournament.at/mdt/vorrunde.php?turnierid=<ID>`

| Mannschaft | Liga | Turnier | ID (Saison 26/27) |
| --- | --- | --- | --- |
| Fraggles | 2. Klasse B | E-Liga - 2.Klasse B 26/27 | **316** |
| Chaoten | 2. Klasse C | E-Liga - 2.Klasse C 26/27 | **317** |

**Der Parameter heisst `turnierid`** - nicht `id` und nicht `tid`. Das ist der
Grund, warum fruehere Versuche immer das Default-Turnier "Training" (306)
zurueckbekamen: bei einem unbekannten Parameternamen meldet der Server keinen
Fehler, sondern liefert stillschweigend das Standardturnier. Eine Session oder
ein Cookie wird **nicht** gebraucht - `tabelle.php?turnierid=317` liefert die
richtige Tabelle schon beim allerersten Aufruf.

Die IDs der laufenden Saison stehen in `liga_team_bewerbe.php` im Abschnitt
"offen", jeweils in der letzten Spalte der Zeile.

## Warum ein Skript dazwischen muss

Der MDT-Server schickt keinen `Access-Control-Allow-Origin`-Header. Ein
`fetch()` direkt aus dem Dashboard bricht der Browser deshalb ab - unabhaengig
von der URL. Serverseitig (Apps Script `UrlFetchApp`) gibt es diese Grenze
nicht. Also derselbe Weg wie beim DJ-Live-Status: Skript holt die Seiten,
schreibt `dart_liga.json` ins Repo, das Dashboard liest nur diese Datei.

## Einrichtung

1. `google-apps-script/dart-liga-scraper.gs` als neue Datei in ein
   Apps-Script-Projekt einfuegen. Eigenes Projekt oder das des
   DJ-Live-Checkers - alles mit `dart`/`DART_` praefixiert, kollidiert also
   nicht.
2. Script Property setzen (Projekteinstellungen -> Skripteigenschaften):

   ```
   GITHUB_TOKEN = PAT mit Schreibrecht auf motte025/City-cafe
   ```

   Im DJ-Checker-Projekt ist der Schluessel schon vorhanden und wird geteilt.
3. Einmal `dartTestLauf()` ausfuehren und ins Ausfuehrungsprotokoll schauen -
   das schreibt **nichts**, sondern zeigt nur, was ankommt.
4. Einmal `dartTriggerEinrichten()` ausfuehren -> Minutentrigger.

## Live am Spielabend

Gespielt wird immer **samstags ab 19:00**, ein Mannschaftsabend zieht sich bis
in die Nacht. Deshalb laeuft der Abruf zweistufig:

| Wann | Abruf im Skript | Abruf im Dashboard |
| --- | --- | --- |
| Spieltag 19:00 - 01:00 | jede Minute | jede Minute |
| sonst | alle 6 Stunden | alle 30 Minuten |

Waehrend des Fensters steht im Kopf der Dart-Ansichten ein rotes **LIVE** mit
Pulspunkt, bei der Tabelle zusaetzlich die Uhrzeit des Stands - daran sieht
man auf einen Blick, ob die Zahlen wirklich mitlaufen oder irgendwo
haengengeblieben sind.

Das Fenster haengt **nicht** an "jedem Samstag", sondern an den 14 konkreten
Spielterminen. Die stehen doppelt: in `DART_CLUB` (index.html) und in
`DART_SPIELTAGE` (dart-liga-scraper.gs) - beim Saisonwechsel **beide**
nachziehen, sonst pollt eine Seite am falschen Tag.

Der Trigger laeuft jede Minute, `dartLiveTakt()` entscheidet aber bei jedem
Aufruf selbst, ob wirklich abgerufen wird. Ein Leerlauf kostet dadurch fast
nichts - wichtig, weil Apps Script die Gesamtlaufzeit aller Trigger pro Tag
begrenzt und ein stumpfer Minutentrigger sonst 1440 volle Laeufe pro Tag
machen wuerde.

Zeitzone: das Skript rechnet ausdruecklich in `Europe/Vienna`
(`Utilities.formatDate`), nicht mit `getHours()`. Die Zeitzone des
Apps-Script-Projekts spielt damit keine Rolle - sonst laege das Fenster im
Zweifel um ein bis zwei Stunden daneben.

Ein Commit entsteht nur bei echten Aenderungen. An einem Spielabend sind das
so viele, wie Saetze eingetragen werden; ausserhalb der Spieltage gar keine.

**Was MDT live wirklich hergibt:** `livescore.php` waere die naheliegende
Quelle, ist aber unbrauchbar - die Seite ignoriert `turnierid`, ignoriert auch
eine ueber `spieler.php` gesetzte Session und zeigt immer das Test-Turnier;
ausserdem will sie einen Login. Geholt werden deshalb `vorrunde.php` und
`tabelle.php`, die beide sauber auf `turnierid` hoeren. Wie feinkoernig MDT
dort waehrend eines laufenden Matches nachtraegt (nach jedem Satz oder erst am
Ende), zeigt sich erst am ersten Spielabend - der Minutentakt holt in jedem
Fall ab, sobald etwas eingetragen ist.

## Format von `dart_liga.json`

```json
{
  "aktualisiert": "2026-09-05T21:30:00Z",
  "quelle": "https://kedsv.my-darts-tournament.at/mdt/",
  "teams": {
    "chaoten": {
      "turnierid": 317,
      "liga": "2. Klasse C",
      "tabelle": [
        { "rang": 1, "team": "City-Flyers \"Chaoten\"", "spiele": 1,
          "siege": 1, "unentschieden": 0, "niederlagen": 0, "punkte": 2 }
      ],
      "ergebnisse": {
        "1": { "heim": 7, "auswaerts": 3 }
      }
    }
  }
}
```

- `ergebnisse` ist nach **Rundennummer** verschluesselt und immer in
  Heim:Auswaerts-Richtung gespeichert. Das Dashboard dreht die Anzeige selbst
  auf die Sicht der eigenen Mannschaft und faerbt Sieg gruen, Niederlage rot.
- Ein `0:0` gilt als **noch nicht gespielt**, nicht als Unentschieden - MDT
  traegt kommende Spiele so vor. Ein wirklich ausgetragenes E-Dart-Match kann
  nicht 0:0 enden, es werden zehn Sets gespielt.
- `"teams": {}` (der Auslieferungszustand) heisst schlicht: keine Daten. Das
  Dashboard laeuft dann wie in Phase 1.

## Ergebnisse von Hand nachtragen

Geht auch ohne Apps Script - `dart_liga.json` direkt im Repo bearbeiten und
unter `ergebnisse` die gespielte Runde eintragen:

```json
"ergebnisse": { "1": { "heim": 7, "auswaerts": 3 } }
```

Fuer die Erg-Spalte reicht das; der Tabellen-Slot braucht zusaetzlich einen
`tabelle`-Eintrag, sonst bleibt er aus.

## Wenn etwas nicht stimmt

| Symptom | Ursache |
| --- | --- |
| Tabellen-Slot kommt nie | `teams` leer oder `tabelle` leer - Scraper laeuft nicht |
| Fremde Vereine in der Tabelle | falsche `turnierid` (Server liefert dann "Training") |
| Erg-Spalte bleibt `–` | Runde fehlt in `ergebnisse`, oder Eintrag ist `0:0` |
| Tabelle veraltet | Trigger geloescht - `dartTriggerEinrichten()` erneut ausfuehren |

`dartTestLauf()` meldet ausdruecklich, wenn die eigene Mannschaft **nicht** in
der abgerufenen Tabelle steht - das ist der zuverlaessigste Hinweis auf eine
veraltete Turnier-ID.
