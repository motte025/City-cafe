# DJ-Livestream-Widget — Einrichtung

Das Dashboard kann Live-Streams von DJs (Twitch und YouTube Live) einblenden.
Der Slot erscheint **nur, wenn wirklich jemand live ist** — sonst überspringt
die Rotation ihn ersatzlos und läuft direkt zum nächsten Widget weiter. Sind
mehrere Kanäle gleichzeitig live, wird jeder 30 Sekunden gezeigt und danach
automatisch zum nächsten geschaltet.

Bis die Einrichtung fertig ist, passiert **gar nichts**: `dj_channels.json` ist
leer, `live_status.json` meldet niemanden, der Slot fällt aus. Das Repo kann
also jederzeit so bleiben, ohne dass am Dashboard etwas kaputtgeht.

---

## Wie es zusammenhängt

| Teil | Wo | Aufgabe |
|---|---|---|
| `dj_channels.json` | dieses Repo | Liste der DJ-Kanäle. Von Hand gepflegt. |
| `dj-live-checker.gs` | Google Apps Script | prüft alle 5 Minuten, wer live ist |
| `live_status.json` | dieses Repo | Ergebnis des Checkers. Wird vom Skript committet. |
| DJ-Live-Slot | `index.html` | liest nur `live_status.json` und zeigt den Player |

Das Dashboard fragt **keine** API selbst ab. Es liest ausschließlich
`live_status.json` — deshalb liegen die Twitch-Zugangsdaten auch nirgends im
öffentlich einsehbaren Repo, sondern nur in den Script Properties bei Google.

---

## 1. Kanäle eintragen

`dj_channels.json` im Repo bearbeiten. Format:

```json
[
  { "platform": "twitch",  "channel": "kanalname",  "name": "DJ Nitewave" },
  { "platform": "youtube", "channelId": "UCxxxxxxxxxxxxxxxxxxxxxx", "name": "DJ Tube" }
]
```

* `platform` — `"twitch"` oder `"youtube"`
* `channel` — bei Twitch der Kanalname aus der URL
  (`twitch.tv/**kanalname**`), Groß-/Kleinschreibung egal
* `channelId` — bei YouTube die Kanal-ID, beginnt mit `UC…`.
  Zu finden über die Kanalseite → *Teilen* → *Kanal-ID kopieren*, oder in der
  URL `youtube.com/channel/**UC…**`
* `handle` — Alternative zu `channelId`, falls die ID nicht auffindbar ist:
  das `@handle` aus der URL (`youtube.com/**@djtube**`). Eins von beiden reicht.
* `name` — **optional**, aber empfohlen: der Anzeigename im Widget. Ohne ihn
  steht dort bei Twitch der Kanalname und bei YouTube die kryptische `UC…`-ID.

Änderungen wirken ab dem nächsten Checker-Lauf, also nach spätestens 5 Minuten.

---

## 2. Twitch-Zugangsdaten anlegen

Nur nötig, wenn Twitch-Kanäle in der Liste stehen. YouTube braucht nichts davon.

1. Auf <https://dev.twitch.tv/console/apps> anmelden → **Anwendung registrieren**
2. Name frei wählen, OAuth-Redirect-URL `http://localhost`, Kategorie
   *Application Integration*
3. **Client-ID** notieren und einmalig ein **Client-Secret** erzeugen
   (das Secret wird nur einmal angezeigt)

Die beiden Werte kommen in Schritt 3 in die Script Properties — **nicht** in
dieses Repo, es ist öffentlich einsehbar.

---

## 3. Apps Script einrichten

Der Checker läuft in **einem eigenen Apps-Script-Projekt** oder im bestehenden
des Song-Collectors — beides funktioniert. Der Unterschied ist nur der
GitHub-Token: Script Properties gelten pro Projekt, im Song-Collector liegt
`GITHUB_TOKEN` schon, in einem eigenen Projekt muss er neu hinein.

1. <https://script.google.com> → **Neues Projekt** (oder das Song-Collector-Projekt öffnen)
2. Bei *Dateien* auf **+** → **Skript** → Datei z. B. `dj-live-checker`
3. Den kompletten Inhalt von `google-apps-script/dj-live-checker.gs` einfügen
   und speichern
4. Zahnrad → **Projekteinstellungen** → ganz unten **Skripteigenschaften**
   → **Skripteigenschaft hinzufügen**:

   | Eigenschaft | Wert |
   |---|---|
   | `GITHUB_TOKEN` | PAT mit Schreibrecht auf `motte025/City-cafe` |
   | `TWITCH_CLIENT_ID` | Client-ID aus Schritt 2 |
   | `TWITCH_CLIENT_SECRET` | Client-Secret aus Schritt 2 |

   Im Song-Collector-Projekt ist `GITHUB_TOKEN` schon da — dann nur die beiden
   Twitch-Werte ergänzen. Für ein eigenes Projekt: entweder den vorhandenen Wert
   aus den Script Properties des Song-Collectors kopieren oder einen neuen PAT
   erzeugen (fine-grained: Repository-Berechtigung *Contents: Read and write*;
   klassisch: Scope `repo`).

5. Oben die Funktion **`djTriggerEinrichten`** auswählen und **Ausführen**.
   Beim ersten Mal fragt Google nach Berechtigungen → *Erweitert* →
   *Zu [Projektname] (unsicher)* → zulassen.
   Danach läuft `djPruefeLiveStatus` automatisch alle 5 Minuten.

> **Warum alle Namen mit `dj`/`DJ_` beginnen:** Apps Script teilt sich **einen**
> globalen Namensraum über alle `.gs`-Dateien eines Projekts. Eine schlichte
> Konstante `GITHUB_REPO` würde mit derselben Konstante im Song-Collector
> kollidieren — das Projekt ließe sich dann gar nicht mehr ausführen
> (`SyntaxError: Identifier 'GITHUB_REPO' has already been declared`). Die
> Präfixe halten den Checker in jedem Projekt verträglich. Die Script-Property-
> *Schlüssel* (`GITHUB_TOKEN` & Co.) sind davon nicht betroffen — das sind
> Strings, keine Bezeichner.

### Prüfen, ob es läuft

Funktion **`djTestLauf`** ausführen und ins **Ausführungsprotokoll** schauen. Dort
steht pro Plattform, was gefunden wurde — ganz ohne etwas zu committen.

---

## 4. Commit-Verhalten

Der Checker committet **nicht** bei jedem Lauf, sondern nur:

* wenn sich die Live-Liste tatsächlich ändert (jemand geht on- oder offline)
* zusätzlich alle 15 Minuten als „Herzschlag“, solange jemand live ist, damit
  `checked_at` im Dashboard nicht veraltet

Ist niemand live — der Normalfall — entstehen **null Commits**. Ohne diese
Bremse hätte das Repo bei einem 5-Minuten-Trigger rund 8.600 Commits pro Monat.

Das Dashboard verwirft einen Stand, der älter als **45 Minuten** ist. Bleibt der
Checker also hängen oder wird der Trigger gelöscht, fällt der DJ-Slot von selbst
wieder aus, statt stundenlang einen längst beendeten Stream zu zeigen.

---

## 5. Wichtig: von welcher Adresse läuft das Dashboard?

**Das ist der einzige Punkt, an dem die Einbettung wirklich scheitern kann.**

Twitch prüft den `parent`-Parameter gegen den Hostnamen der Seite, in die der
Player eingebettet ist. YouTube verweigert die Einbettung, wenn die Seite keine
echte Domain hat (Origin `null`). Wird das Dashboard über `file://` geöffnet,
funktioniert **kein** Embed — genau daran sind frühere YouTube-Versuche
gescheitert.

Das Dashboard leitet den `parent`-Wert dynamisch aus `location.hostname` ab, ist
also nicht auf eine bestimmte Adresse festgenagelt:

| Aufruf über | funktioniert |
|---|---|
| `https://motte025.github.io/City-cafe/` (GitHub Pages) | ja |
| `http://127.0.0.1:…` / `http://localhost:…` (lokaler Test) | ja |
| `file:///…/index.html` | **nein** — der Slot bleibt dann aus |

Gibt es keinen brauchbaren Hostnamen, wird der DJ-Slot komplett übersprungen —
es steht also nie ein schwarzer, kaputter Player auf dem Screen.

### Geklärt: Lumify lädt die GitHub-Pages-Adresse

Am 31.08.2026 direkt auf der Odroid-Box abgelesen:

```
href:          https://motte025.github.io/City-cafe/
hostname:      motte025.github.io
protocol:      https:
origin:        https://motte025.github.io
Twitch-parent: motte025.github.io
```

Lumify rendert die Seite also **nicht** in einem eigenen Container mit
abweichender Origin, sondern lädt schlicht die GitHub-Pages-URL. Damit ist die
Embed-Frage erledigt: Twitch bekommt einen gültigen `parent`, YouTube eine echte
https-Origin statt `null`. **Beide Player funktionieren auf der Box.**

### Später nochmal nachsehen

Falls die Playlist in Lumify einmal umgestellt wird oder die Embeds plötzlich
schwarz bleiben, lässt sich der Wert jederzeit erneut ablesen:

1. In `index.html` in `DJ_LIVE_CONFIG` `showOriginDebug` auf `true` setzen,
   committen und nach `main` bringen (GitHub Pages liefert `main` — im Branch
   erscheint die Box am Screen nicht)
2. Am Screen oben links stehen `href`, `hostname`, `protocol`, `origin` und der
   daraus abgeleitete Twitch-`parent`
3. Werte notieren, `showOriginDebug` wieder auf `false` setzen und erneut nach
   `main` bringen — die Box ist sonst für Gäste sichtbar

Ohne Code-Änderung geht es auch mit `?origincheck=1` an der Dashboard-URL.

**Ergebnis auswerten:**

* `hostname` = `motte025.github.io` → alles gut, nichts zu tun
* `protocol` = `file:` oder `hostname` leer → Lumify muss auf
  `https://motte025.github.io/City-cafe/` umgestellt werden, sonst bleibt der
  DJ-Slot dauerhaft aus
* ein anderer Hostname → funktioniert bei Twitch automatisch (`parent` wird
  dynamisch gesetzt); bei YouTube nur, wenn es eine echte http/https-Adresse ist

Die URL steht in der Lumify-Oberfläche unter
*Inhalte → Wiedergabelisten → „ODROID-N2Plus Player Playlist“ → Edit →
das Inhalts-Element* (ggf. auch unter *Bibliothek*).

---

## 6. Stellschrauben im Dashboard

Alle in `index.html`, Block `DJ_LIVE_CONFIG`:

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `sekundenProKanal` | `30` | Standzeit je Live-Kanal |
| `maxStatusAlterMinuten` | `45` | älterer Stand → Slot aus |
| `abrufTaktSekunden` | `180` | wie oft `live_status.json` neu geholt wird |
| `showOriginDebug` | `false` | Origin-Diagnose einblenden (Abschnitt 5) |

Position in der Rotation: direkt nach dem Calamari-Event-Plakat und vor dem
ersten Musik-Slot (`mediaStateIndex === 0.9` in `runMasterSequence`) — bewusst
weit vorne, damit ein gerade gestarteter Stream nicht erst nach der halben
Rotation auf dem Screen ankommt.

Im Apps Script (`dj-live-checker.gs`): `DJ_TRIGGER_MINUTEN` (Standard 5, erlaubt
sind 1/5/10/15/30) und `DJ_HEARTBEAT_MINUTEN` (Standard 15). `DJ_HEARTBEAT_MINUTEN`
muss deutlich unter `maxStatusAlterMinuten` bleiben.

---

## 7. Wenn etwas nicht funktioniert

**Der Slot erscheint nie, obwohl jemand live ist**

1. `live_status.json` im Repo ansehen — steht der Kanal in `live`?
   * nein → Problem liegt beim Checker: im Apps Script `djTestLauf` ausführen und
     ins Ausführungsprotokoll schauen
   * ja → Problem liegt am Dashboard: `checked_at` prüfen (älter als 45 Minuten
     → Trigger läuft nicht), sonst Abschnitt 5 (Origin)

**Player bleibt schwarz oder zeigt einen Einbettungsfehler**

Fast immer die Origin-Frage aus Abschnitt 5. Mit `showOriginDebug` prüfen, was
der Screen tatsächlich lädt.

**Twitch meldet dauerhaft „offline“**

Client-ID/Secret in den Script Properties prüfen. Bei HTTP 401 verwirft das
Skript sein zwischengespeichertes Token selbst und holt beim nächsten Lauf ein
neues — ein einzelner Fehlversuch ist also normal.

**YouTube meldet dauerhaft „offline“**

Der YouTube-Check kommt ohne API-Key aus und wertet dafür die Seite
`youtube.com/channel/…/live` aus. Das ist die gängige, aber **inoffizielle**
Methode — sie kann sich jederzeit ändern. Falls sie ausfällt, wäre die YouTube
Data API v3 (`search.list` mit `eventType=live`) der Ersatz. Die kostet
allerdings 100 Quota-Einheiten pro Aufruf bei 10.000 pro Tag; ein
5-Minuten-Trigger mit einem einzigen Kanal läge damit schon bei 28.800 pro Tag.
Der Takt müsste dann deutlich gröber werden.

---

## Nicht gebaut, aber möglich: feste Videos einbetten

Unabhängig vom Live-Feature lassen sich auch feste, nicht-live Videos einbetten
— dafür wird der Checker gar nicht gebraucht:

* YouTube-Video/VOD: `https://www.youtube.com/embed/VIDEO_ID`
* Twitch-VOD: `https://player.twitch.tv/?video=VIDEO_ID&parent=…`
* Twitch-Clip: `https://clips.twitch.tv/embed?clip=CLIP_SLUG&parent=…`

Einschränkung unabhängig von der Origin-Frage: Rechteinhaber können das
Einbetten pro Video deaktivieren — bei Musikvideos ziemlich häufig.

Das ist bislang nur als Option vorgemerkt und **nicht** gebaut.
