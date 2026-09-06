# DJ-Livestream-Widget — Einrichtung

Das Dashboard kann Live-Streams von DJs (Twitch und YouTube Live) einblenden.
Der Slot erscheint **nur, wenn wirklich jemand live ist** — sonst überspringt
die Rotation ihn ersatzlos und läuft direkt zum nächsten Widget weiter. Sind
mehrere Kanäle gleichzeitig live, wird jeder 3 Minuten gezeigt und danach
automatisch zum nächsten geschaltet.

Bis die Einrichtung fertig ist, passiert **gar nichts**: `live_status.json`
meldet niemanden, der Slot fällt aus. Das Repo kann also jederzeit so bleiben,
ohne dass am Dashboard etwas kaputtgeht.

> **Sofort ausprobieren, ohne Einrichtung:** `?djtest=kanalname` an die
> Dashboard-URL hängen, zum Beispiel
> <https://motte025.github.io/City-cafe/?djtest=linaaarr>.
> Damit läuft genau dieser Twitch-Kanal im Slot, ganz ohne Checker und ohne
> `live_status.json`. Der Schalter wirkt nur über die URL — im Normalbetrieb
> ist er also nicht aktiv und kann nichts dauerhaft verstellen. Gut geeignet,
> um Player, Bildqualität und Einbettung zu prüfen, bevor die Apps-Script-Seite
> überhaupt steht.

---

## Wie es zusammenhängt

| Teil | Wo | Aufgabe |
|---|---|---|
| `dj_channels.json` | dieses Repo | Liste der DJ-Kanäle. Von Hand gepflegt. |
| `dj-live-checker.gs` | Google Apps Script | prüft alle 5 Minuten, wer live ist |
| `live_status.json` | dieses Repo | Ergebnis des Checkers. Wird vom Skript committet. |
| DJ-Live-Slot | `index.html` | liest nur `live_status.json` und zeigt den Player |

Das Dashboard fragt **keine** API selbst ab. Es liest ausschließlich
`live_status.json` — deshalb liegen die Zugangsdaten auch nirgends im
öffentlich einsehbaren Repo, sondern nur in den Script Properties bei Google.

Was der Checker je Plattform braucht:

| Plattform | Zugangsdaten | Wie geprüft wird |
|---|---|---|
| Twitch | Client-ID + Secret (Abschnitt 2) | Helix-API `streams`, alle Kanäle in einem Aufruf |
| YouTube | API-Key (Abschnitt 2b) | Vanity-URL `/live` liefert die videoId, `videos.list` bestätigt den Live-Status |

---

## 1. Kanäle eintragen

`dj_channels.json` im Repo bearbeiten. Format:

```json
[
  { "platform": "youtube", "videoId": "abcdefghijk", "name": "Palma Hafen", "zeigen": "tag" },
  { "platform": "twitch",  "channel": "kanalname",   "name": "DJ Nitewave", "zeigen": "nacht" },
  { "platform": "youtube", "channelId": "UCxxxxxxxxxxxxxxxxxxxxxx", "name": "DJ Tube" }
]
```

* `platform` — `"twitch"` oder `"youtube"`
* `channel` — bei Twitch der Kanalname aus der URL
  (`twitch.tv/**kanalname**`), Groß-/Kleinschreibung egal
* `videoId` — bei YouTube die ID **eines bestimmten Streams**, aus der URL
  `youtube.com/watch?v=**abcdefghijk**` oder `youtube.com/live/**abcdefghijk**`.
  **Für feste Cams der richtige Weg** (siehe Kasten unten).
* `channelId` — bei YouTube die Kanal-ID, beginnt mit `UC…`.
  Zu finden über die Kanalseite → *Teilen* → *Kanal-ID kopieren*, oder in der
  URL `youtube.com/channel/**UC…**`. Zeigt, was der Kanal *gerade* sendet.
* `handle` — Alternative zu `channelId`: das `@handle` aus der URL
  (`youtube.com/**@djtube**`). Eins der drei Felder reicht.
* `name` — **optional**, aber empfohlen: der Anzeigename im Widget. Ohne ihn
  steht dort bei Twitch der Kanalname und bei YouTube die kryptische `UC…`-ID.
* `zeigen` — **optional**: `"tag"`, `"nacht"` oder weglassen (dann rund um die
  Uhr). Siehe Abschnitt *Tageszeit* unten.

> **`videoId` oder `channelId`/`handle`?**
> Über Kanal-ID oder Handle bekommst du das, was der Kanal **gerade** sendet.
> Bei Kanälen mit mehreren parallelen Livestreams — Hafen-Cams zum Beispiel —
> ist das mal die eine und mal die andere Kamera, nicht steuerbar. Willst du
> eine **bestimmte** Cam, trag deren `videoId` ein. Der Checker prüft dann nur
> noch, ob genau dieser Stream läuft, und spart sich sogar einen Abruf.

### Tageszeit

Mit `"zeigen"` lässt sich pro Eintrag festlegen, wann er überhaupt in Frage
kommt — gedacht für Urlaubs-Cams tagsüber und DJ-Streams am Abend:

| Wert | wann |
|---|---|
| `"tag"` | 8:00 – 19:59 |
| `"nacht"` | 20:00 – 7:59 |
| weggelassen | immer |

Die Grenzen stehen in `index.html` unter `DJ_LIVE_CONFIG` als `tagVonStunde`
und `tagBisStunde`. Maßgeblich ist die Uhrzeit des Geräts, auf dem das
Dashboard läuft.

Gefiltert wird im Dashboard, nicht im Checker: `live_status.json` enthält immer
alle Kanäle, die tatsächlich senden. So lässt sich die Zeitsteuerung ändern,
ohne auf den nächsten Checker-Lauf zu warten.

Änderungen an `dj_channels.json` wirken ab dem nächsten Checker-Lauf, also nach
spätestens 5 Minuten.

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

## 2b. YouTube-API-Key anlegen

Nur nötig, wenn YouTube-Kanäle in der Liste stehen. Twitch braucht nichts davon.

Der Key ist kostenlos und ohne Kreditkarte zu haben:

1. <https://console.cloud.google.com/> öffnen, oben ein **Projekt anlegen**
   (Name egal, z. B. `city-cafe-dj`)
2. Links **APIs & Dienste → Bibliothek** → nach *YouTube Data API v3* suchen
   → **Aktivieren**
3. Links **APIs & Dienste → Anmeldedaten** → **Anmeldedaten erstellen**
   → **API-Schlüssel**
4. Den angezeigten Schlüssel kopieren — kommt in Schritt 3 als
   `YOUTUBE_API_KEY` in die Script Properties
5. Empfohlen: beim Schlüssel auf **Schlüssel einschränken** → unter
   *API-Einschränkungen* nur *YouTube Data API v3* zulassen. Dann ist der
   Schlüssel selbst bei einem Leck nur für diese eine API brauchbar.

**Warum überhaupt ein Key?** Ursprünglich sollte der Live-Status ohne API direkt
aus dem Seiten-HTML gelesen werden. Das funktioniert von Apps Script aus
nachweislich nicht: YouTube liefert Anfragen aus der Google-Infrastruktur nur
eine abgespeckte Seite ohne Live-Merkmale (~570 KB, Seitentitel bloß „YouTube"),
während dieselbe URL von einer externen IP ~1,2 MB inklusive `"isLive":true`
zurückgibt. Getestet mit verschiedenen User-Agents, Sec-Fetch-/Accept-Headern
und ganz ohne Header — immer dasselbe. Das hängt am Absender, nicht an den
Headern, und ist vom Skript aus nicht zu umgehen.

**Quota:** Der Checker ruft `videos.list` auf — **1 Einheit** pro Abfrage, nicht
100 wie das ursprünglich angedachte `search.list`. Bei 10.000 Einheiten pro Tag
und 5-Minuten-Takt sind das 288 Abrufe pro Kanal und Tag; selbst ein Dutzend
Kanäle bleibt weit unter dem Limit. Abgefragt wird ohnehin nur, wenn die
kostenlose Vorstufe überhaupt einen Kandidaten gefunden hat.

**Ohne Key** meldet der Checker YouTube-Kanäle grundsätzlich als nicht live und
schreibt einen Hinweis ins Ausführungsprotokoll. Twitch läuft davon unberührt
weiter.

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
   | `YOUTUBE_API_KEY` | API-Schlüssel aus Schritt 2b |

   Nur eintragen, was gebraucht wird: reine Twitch-Nutzung kommt ohne
   `YOUTUBE_API_KEY` aus, reine YouTube-Nutzung ohne die beiden Twitch-Werte.
   **Wichtig:** Links steht der *Name* (`TWITCH_CLIENT_ID`), rechts der Wert —
   nicht verwechseln, sonst findet das Skript die Eigenschaft nicht.

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
| `sekundenProKanal` | `180` | Standzeit je Live-Kanal |
| `maxStatusAlterMinuten` | `45` | älterer Stand → Slot aus |
| `abrufTaktSekunden` | `180` | wie oft `live_status.json` neu geholt wird |
| `spielerBreite` / `spielerHoehe` | `1920` / `1080` | interne Playergröße, siehe unten |
| `qualitaetModus` | `'auto'` | `'auto'` = Twitch passt laufend an, `'fest'` = eine Stufe festnageln |
| `maxQualitaetHoehe` | `1080` | Obergrenze — **nur bei `'fest'` wirksam** |
| `showOriginDebug` | `false` | Origin-Diagnose einblenden (Abschnitt 5) |

### Bildqualität

Zwei Dinge bestimmen, was Twitch liefert:

**1. Die Layoutgröße des Players.** Twitch und YouTube wählen die Streamqualität
danach, wie groß der Player im Layout ist — nicht danach, wie groß der
Bildschirm ist. Die Bühne ist 1200 × 675 Pixel groß und lag damit *unter*
1280 × 720; es gab deshalb nie echtes 720p. Der Player läuft jetzt intern in
`spielerBreite × spielerHoehe` (**1920 × 1080**) und wird per CSS auf die Bühne
heruntergerechnet — derselbe Stand wie beim Nightlife-Widget, das ohnehin auf
`hd1080` läuft.

Die Bühne ist mit 1200 Pixeln schmaler als 1920, das Bild wird also
heruntergerechnet statt Pixel für Pixel zu treffen. Gegenüber 720p kostet das
etwa die doppelte Bandbreite und bei 60 fps mehr Rechenzeit auf der Box;
gewonnen wird ein sichtbar schärferes Bild, weil die Quelle höher aufgelöst ist
als die Anzeigefläche.

**Zurück auf 720p**, falls es ruckelt oder der Stream am Puffer hängt:
`spielerBreite`/`spielerHoehe` auf `1280`/`720` und `maxQualitaetHoehe` auf
`720`. Mehr ist nicht umzustellen — Maßstab und CSS-Größe rechnet
`djGroesseAnwenden()` aus diesen Werten aus, die Bühne bleibt in beiden Fällen
1200 × 675.

**2. Wer die Qualität wählt.** Standard ist `qualitaetModus: 'auto'` — Twitch
entscheidet und **passt laufend an**: Der Player misst die Leitung mit und geht
bei einem Engpass selbst eine Stufe zurück, statt zu puffern. Zusammen mit der
1920 × 1080 großen Layoutfläche liefert das 1080p, wenn die Leitung es hergibt,
und ein laufendes Bild, wenn nicht.

> **Warum nicht festnageln:** Genau daran hing das Ruckeln auf der Box. Eine
> fest gesetzte Stufe schaltet Twitchs eigene Anpassung ab — reicht die
> Bandbreite dann nicht, puffert der Player endlos, statt herunterzuschalten.
> Am Schirm sieht das aus wie „zappelt, läuft aber nicht", und Twitch blendet
> seinen eigenen Hinweis auf den Low-Latency-Modus ein. `'fest'` gehört nur an
> eine Leitung, die sicher trägt.

Der reine iframe kennt *keinen* `quality`-Parameter — Twitch dokumentiert für
`player.twitch.tv` nur `channel`, `parent`, `autoplay`, `muted` und `time`. Eine
Stufe lässt sich ausschließlich über das Embed-SDK
(`Twitch.Player.setQuality()`) setzen. Das Dashboard lädt dieses SDK deshalb
nach — aber **erst dann, wenn wirklich ein Twitch-Kanal dran ist**. Läuft
niemand live, wird es nie geholt. Schlägt das Laden fehl (kein Netz, blockiert),
fällt der Kanal automatisch auf den einfachen iframe zurück.

**Puffer und Latenz sind nicht einstellbar.** Twitch bestätigt das ausdrücklich:
weder über iframe-Parameter noch über das SDK lässt sich die Puffergröße ändern
oder der Low-Latency-Modus abschalten
([Dev-Forum](https://discuss.dev.twitch.com/t/is-there-any-way-to-increase-embedded-player-buffer-size/63032)).
Der Hinweis, den Twitch im Player einblendet, richtet sich an den *Zuschauer* in
dessen eigenen Kontoeinstellungen — von hier aus ist er nicht erreichbar. Der
einzige Hebel bleibt die Qualität, und die überlässt man am besten Twitch.

### Warum hakt der Stream? (`?djstats=1`)

`?djstats=1` an die Dashboard-URL blendet rechts oben die Messwerte des laufenden
Twitch-Players ein (`getPlaybackStats()`) — Auflösung, fps, Codec, Puffer,
Latenz und übersprungene Bilder, im Sekundentakt. Am Schirm sehen die zwei
möglichen Ursachen gleich aus, brauchen aber gegenteilige Antworten:

| Messwert | Bedeutung | Was hilft |
|---|---|---|
| **Puffer** fällt gegen 0, Bilder bleiben ruhig | die Leitung ist zu schmal | Netz prüfen; notfalls `'fest'` auf eine niedrige Stufe |
| **Bilder weg** steigt je Sekunde deutlich | die Box dekodiert zu langsam | niedrigere Stufe, 60 fps meiden |

Der Zähler „Bilder weg" zeigt zusätzlich den Zuwachs pro Sekunde in Klammern —
nur der sagt etwas aus, der Gesamtwert wächst auch durch einen einzigen Hänger
von vor zehn Minuten.

`qualitaetModus` steuert, wie eingegriffen wird:

| Modus | Verhalten |
|---|---|
| `mindestens` (Standard) | Twitch entscheidet selbst. Bleibt der Player unter `minQualitaetHoehe` hängen, wird **einmal** hochgesetzt. Steht das Bild danach still, geht die Steuerung an Twitch zurück und bleibt dort. |
| `auto` | Twitch entscheidet allein, es wird nie eingegriffen. |
| `fest` | Genau eine Stufe, festgenagelt auf `maxQualitaetHoehe`. Twitchs eigene Anpassung ist damit aus: reicht die Leitung nicht, puffert der Player endlos statt herunterzuschalten. Nur nehmen, wenn die Leitung sicher trägt. |

Warum es `mindestens` überhaupt braucht: der Player wird im Slot davor gebaut,
während die Ansicht noch unsichtbar ist. Twitch misst in dem Moment die
Playergröße — an einem unsichtbaren Rahmen fällt die Schätzung niedrig aus, und
der Stream blieb dann bei **360p** stehen, obwohl der Player intern 1920 × 1080
groß ist.

> **Kleine Kanäle:** Twitch stellt Transcodes (720p, 480p, …) nur Partnern und
> Affiliates zuverlässig bereit. Bei kleinen Kanälen gibt es oft **nur die
> Quelle** — dann ist jede Qualitätswahl wirkungslos, egal was hier eingestellt
> ist. Das ist kein Fehler im Dashboard.

### Autostart und Ton

Der Player wird schon im Slot davor gebaut (siehe unten) — dort ist die
DJ-Ansicht aber noch `visibility: hidden`, und der Browser **hält die Wiedergabe
in einem unsichtbaren Rahmen an**. Beim Einblenden stand deshalb das Play-Symbol
im Bild, obwohl der Stream längst geladen war. Ein Wächter stupst den Player
beim Einblenden wieder an und hält ihn danach am Laufen.

**Die Autoplay-Freigabe ist dabei der entscheidende Punkt.** Chrome lässt
Wiedergabe in einem *fremden* Rahmen nur zu, wenn dieser `allow="autoplay"`
trägt. Unseren eigenen iframe stellen wir so ein — den Rahmen für das SDK baut
aber Twitch selbst, und ohne die Freigabe blockiert Chrome den Start. Genau
daran lag es auf der Box: Play-Symbol im Bild, und auch ein Neuaufbau half
nicht, weil dem neuen Rahmen dieselbe Freigabe fehlte. Das Dashboard rüstet sie
jetzt nach, bevor der Rahmen lädt (danach wäre es zu spät — die Freigabe wird
beim Navigieren ausgewertet).

Reicht das Anstupsen nicht — Chrome lässt einen im unsichtbaren Rahmen
erzeugten Player teils gar nicht mehr anlaufen —, wird der Player nach
`neustartNachSekunden` **neu gebaut**, dann aber in der sichtbaren Ansicht. Dort
startet er ganz normal von allein, weil er stumm startet. Höchstens
`maxNeustarts` Versuche, danach bleibt es dabei.

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `neustartNachSekunden` | `6` | so lange darf der Stream nach dem Einblenden tot bleiben |
| `maxNeustarts` | `2` | danach der letzte Ausweg (siehe unten) |

Läuft er auch nach `maxNeustarts` SDK-Versuchen nicht, stellt das Dashboard auf
den **eigenen iframe** um — der trägt `allow="autoplay"` garantiert. Ton und
Qualitätssteuerung fallen dabei weg (die gehen nur über das SDK), aber ein
laufendes Bild ohne Ton ist besser als ein Play-Symbol.

Der **Ton** hängt an derselben Mechanik: Autoplay *mit* Ton lehnt jeder Browser
ohne Klick ab — der Stream liefe dann gar nicht erst an. Der Player startet
deshalb stumm und wird erst aufgedreht, wenn das Bild nachweislich läuft.
Verweigert der Browser auch das, geht es stumm weiter; ein stehendes Bild wäre
der schlechtere Tausch.

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `tonLautstaerke` | `0.7` | 0 = stumm, sonst 0…1 |

Auf der Box lohnt sich dafür der Chrome-Schalter: `chrome://flags` →
**Autoplay policy** → *No user gesture is required*.

Der Ton endet mit dem Slot, weil der Player dann abgeräumt wird — die übrigen
Widgets bleiben still.

### Nur ein Player gleichzeitig

Früher lag für *jeden* live gemeldeten Kanal ein eigener Player im DOM, und alle
liefen gleichzeitig — sichtbar war nur einer. Bei drei Live-Kanälen dekodierte
die Box also drei Streams parallel, was auf dem Odroid die mit Abstand größte
Einzellast war. Jetzt existiert immer nur der Player des gerade gezeigten
Kanals.

Der Vorlauf bleibt trotzdem erhalten: der **erste** Kanal wird schon im Slot
davor gebaut (`djVorpuffern`) — genau das war der ursprüngliche Zweck, weil
Twitch sonst häufig gar nicht startete. Beim Wechsel von Kanal zu Kanal gibt es
dafür jetzt eine kurze Ladepause, die der Hinweis „Stream wird geladen …“
überbrückt.

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

`djYoutubeDebug` ausführen — die Funktion zeigt beide Stufen einzeln:

* **Schritt 1 findet keine videoId** → die Vanity-URL (`/@handle/live` bzw.
  `/channel/UC…/live`) löst auf kein Video auf. Handle oder Kanal-ID in
  `dj_channels.json` prüfen.
* **Schritt 2 meldet „YOUTUBE_API_KEY fehlt"** → Key nachtragen, siehe
  Abschnitt 2b.
* **Schritt 2 meldet HTTP 400** → Key ungültig oder vertippt.
* **Schritt 2 meldet HTTP 403** → Key gesperrt, falsch eingeschränkt, oder das
  Tageskontingent ist aufgebraucht.
* **Schritt 2 meldet `live? false`** → alles korrekt verdrahtet, der Kanal
  sendet gerade schlicht nicht.

Die erste Stufe (videoId aus der Seite lesen) ist **inoffiziell** und kann sich
jederzeit ändern. Bricht sie weg, bliebe als Ersatz `search.list` mit
`eventType=live` — das kostet allerdings 100 Quota-Einheiten statt 1, damit
wären bei 5-Minuten-Takt und einem einzigen Kanal schon 28.800 Einheiten pro Tag
fällig (Limit: 10.000). Der Takt müsste dann deutlich gröber werden.

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
