# YouTube-Musik mit Warteschlange, Radio-Mix und neuer Fernbedienung

Handoff-Spec für Claude Code. Stand: 2. Oktober 2026.
Antwortsprache im Gespräch: Deutsch.

Vorher lesen: `STAND.md`, `FERNBEDIENUNGEN.md`, `KIOSK-SUPERVISOR.md`.

Vorschaubilder (vom Betreiber abgesegnet) liegen unter `docs/musik/`:

| Datei | Zeigt |
|---|---|
| `youtube-variante-1e.png` | **Zielbild TV, normale Ansicht**: 2 große Titel in der oberen Leiste, QR-Code unten rechts im Video, „Passt dazu“ in der Seitenleiste |
| `youtube-vollbild.png` | **Zielbild TV, Vollbild-Ansicht** (umschaltbar, siehe 6.8) |
| `youtube-variante-1b.png` | Kopfzeile mit großem „CITY CAFE“, Fortschrittsbalken unter dem Video |
| `fernbedienung-vorschau.png` | **Zielbild Handy**: Reiter „Jetzt“ und „Suche“ |

---

## 1. Ziel in einem Absatz

Aus dem heutigen „ein Wunschvideo, dann zurück zur Rotation“ wird ein
Musikbetrieb wie bei YouTube Music. Es gibt eine **Warteschlange**, die
Gäste per Handy füllen und der Chef sortiert. Ist sie leer, läuft ein
**Radio-Mix**, der zum zuletzt gespielten Song passt. Auf dem TV bleibt das
Videofenster **exakt wie heute**. Drumherum zeigt das Dashboard, was als
Nächstes kommt. Die Handy-Fernbedienung bekommt eine Reiterleiste, längere
Listen und einen Gäste- und Chef-Modus.

---

## 2. Feste Rahmenbedingungen (nicht verhandelbar)

1. **Das Videofenster bleibt unverändert.** `.nl-player` bleibt 1200×675 an
   der heutigen Position, `nl-player-frame` ebenso. Der Supervisor legt mpv
   über `getBoundingClientRect()` von `nl-player-frame` (`FLAECHE["yt"]`).
2. **Über dem Video darf kein HTML liegen.** mpv ist ein eigenes Fenster über
   dem Browser, deshalb wäre jedes HTML-Element in der Videofläche unsichtbar.
   Alle Infos stehen daneben oder darunter. **Einzige Ausnahme ist der
   QR-Code (6.5): den zeichnet mpv selbst.**
3. **Hos'n Obe hat Vorrang** (wie heute). Während einer Runde werden keine
   Songs gestartet. Wünsche dürfen in die Warteschlange, sie warten dann.
4. **Neue Vollbild- oder Ebenen-Elemente in `runMasterSequence()` abbauen**
   (siehe `STAND.md`, Abschnitt Vollbild-Ansichten). Das gilt hier für die
   übernommene obere Leiste, die Seitenleisten-Ebene und den Ticker.
5. **Große Schriften am Handy** bleiben (Bedienung im Dunkeln, in Eile). Ab
   700 px Breite gelten die kleineren Größen wie gehabt.
6. Der **Supervisor** kommt per nächtlicher Aktualisierung aus `main` auf den
   W1. Erst pushen, wenn er auf dem W1 von Hand getestet wurde.
7. **GitHub Pages speichert bis zu 15 Minuten zwischen.** Die Fassungsnummern
   in allen geänderten Seiten hochzählen.

---

## 3. Wichtige Korrektur: YouTube-Mixe funktionieren mit yt-dlp

Der Kommentar in `aehnliche()` im Supervisor („YouTubes eigene Mix-Liste
(list=RD...) gibt yt-dlp nicht her“) stimmt **nicht mehr**. Getestet am
02.10.2026 mit aktuellem yt-dlp:

```
yt-dlp --flat-playlist --print "%(id)s %(title)s" --playlist-end 8 \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ"
```

Das liefert acht passende Musikvideos anderer Künstler, also den echten
YouTube-Radio-Mix. Für ein nicht verfügbares Video meldet yt-dlp „Unable to
recognize playlist“. Dann greift der Rückfall (siehe 5.3).

**Erst auf dem W1 mit den Premium-Cookies und `--js-runtimes node` prüfen**,
dann darauf bauen. Den falschen Kommentar korrigieren, ebenso die
entsprechende Stelle in `FERNBEDIENUNGEN.md`.

---

## 4. Datenmodell (Firebase, unter `djremote/<raum>/yt/`)

Bestehende Pfade (`befehl`, `treffer`, `status`, `liste`) bleiben und
funktionieren weiter. Neu:

```
djremote/<raum>/
  yt/
    warteschlange/<eintragId>     von TV und Chef geschrieben
      videoId, titel, kanal, dauer       wie bei treffer
      kuenstler, songtitel               aus dem Titel geparst (siehe 6.4)
      quelle: "wunsch" | "playlist" | "radio" | "chef"
      von: <auth.uid>                    Gerät, das gewünscht hat
      pos: Zahl                          Sortierung, Lücken erlaubt (1000, 2000 ...)
      ts
    wuensche/<wunschId>           Gäste schreiben NUR hierhin
      videoId, titel, kanal, dauer, von: <auth.uid>, ts
    radio/                        vom TV geschrieben
      seed: videoId                      worauf der Mix aufbaut
      titel: [ {videoId, titel, kanal, dauer}, ... ]   bis 25 Einträge
    jetzt/                        vom TV geschrieben (erweitert yt/status)
      videoId, titel, kuenstler, songtitel, dauerSek, posSek, pausiert,
      modus: "warteschlange" | "radio" | "playlist" | "aus"
  chef/
    pin             NICHT lesbar (siehe Regeln), Klartext-PIN vom Betreiber
    geraete/<uid>   { pin, name, ts } -> Gerät ist Chef
```

`yt/playlists` steht **nicht** in Firebase, sondern im Repo
(`yt_playlists.json`, siehe 7.3). Es ändert sich selten und gehört
versioniert.

### 4.1 Sicherheitsregeln (Ergänzung)

Die PIN-Prüfung läuft in den Regeln selbst: `chef/pin` ist für niemanden
lesbar. Ein Gerät darf sich nur dann unter `chef/geraete/$uid` eintragen,
wenn es die richtige PIN mitschreibt.

```json
"djremote": {
  "$raum": {
    "chef": {
      "pin": { ".read": false, ".write": false },
      "geraete": {
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid && newData.child('pin').val() === root.child('djremote/' + $raum + '/chef/pin').val()"
        }
      }
    },
    "yt": {
      "wuensche": {
        "$id": {
          ".write": "auth != null && !data.exists() && newData.child('von').val() === auth.uid"
        }
      },
      "warteschlange": {
        ".write": "auth != null && root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists()"
      }
    }
  }
}
```

- Die PIN legt der Betreiber einmal von Hand in der Firebase-Konsole unter
  `djremote/<raum>/chef/pin` an. Sie gehört **nicht** ins Repo.
- **Der TV ist selbst ein Chef-Gerät.** Er meldet sich beim Start mit der PIN
  aus der Kiosk-Adresse an (`?chefpin=…`, nur in
  `/home/citycafe/.config/citycafe.env` bzw. im Chromium-Starter, nie im
  Repo).
- Die bestehenden Regeln für `yt/befehl` usw. bleiben vorerst offen
  (`auth != null`), damit die alte Fernbedienung bis zum Umstieg weiter
  funktioniert. In Schritt 9.6 werden „skip“, „stopp“, „spulen“ und „ton“ auf
  Chef-Geräte beschränkt.
- Die Regeln mit dem Firebase-Simulator prüfen: Gast schreibt Wunsch (ja),
  Gast schreibt in die Warteschlange (nein), Gerät mit falscher PIN (nein).

---

## 5. Wiedergabe-Logik (gehört dem TV, `index.html`)

**Einzige Quelle der Wahrheit für die Reihenfolge ist der TV.** Handys
schreiben Wünsche oder (als Chef) Änderungen. Der TV entscheidet, was als
Nächstes läuft, und meldet es zurück.

Die Logik kommt als reines JS-Modul in eine eigene Datei
`yt-warteschlange.js`, mit `yt-warteschlange.test.js` nach dem Vorbild von
`hosn-obe-engine.js`. Darin stehen keine DOM- und Firebase-Zugriffe, nur
Zustand rein, Zustand raus. So lässt sich das testen.

### 5.1 Ablauf

1. Wunsch kommt in `yt/wuensche` an. Der TV prüft:
   - höchstens **2 offene Wünsche pro Gerät** (`von`), sonst ablehnen;
   - dasselbe Video nicht doppelt in der Warteschlange;
   - Länge höchstens 10 Minuten (sonst ablehnen, Chef darf trotzdem).

   Danach hängt er den Wunsch hinten an `warteschlange` an, löscht ihn aus
   `wuensche` und zeigt die Wunsch-Einblendung (6.3). Abgelehnte Wünsche
   bekommen eine Rückmeldung unter `wuensche/<id>/abgelehnt: "grund"`, das
   Handy zeigt sie an.
2. Läuft gerade keine Musik, startet der erste Eintrag sofort (wie heute
   ein Wunsch: Rotation unterbrechen, `nlFernWidgetAbraeumen()` usw.).
3. **Ende eines Songs** (`nlVideoFertig()` heute): statt zur Rotation zurück:
   - Warteschlange nicht leer → nächsten Eintrag starten, aus der Schlange
     nehmen;
   - leer, Radio an → nächsten Titel aus `yt/radio/titel`;
   - Radio aus oder Radio-Zeit abgelaufen (5.4) → zurück zur Rotation, wie
     heute.
4. **Stopp** (Chef) beendet den Musikbetrieb und geht zurück zur Rotation.
   Die Warteschlange bleibt erhalten und lässt sich später fortsetzen.
5. **Überspringen** (Chef) beendet den aktuellen Song wie ein Songende.
6. Wünsche von Gästen werden **vor** Radio-Titeln gespielt, aber hinter
   Chef-Einträgen mit „Als Nächstes“. In einer längeren Schlange kommen sie
   frühestens auf **Platz 5** (hinter schon wartende Wünsche); ist sie
   kürzer, hinten an (`WUNSCH_AB_PLATZ` in `yt-warteschlange.js`).

### 5.2 Lücken zwischen den Songs vermeiden

yt-dlp braucht zum Auflösen 10 bis 25 Sekunden. Ohne Gegenmaßnahme entsteht
nach jedem Song eine Pause. Deshalb:

- Der TV meldet dem Supervisor den **nächsten** Titel, sobald der aktuelle
  weniger als 60 s Restlaufzeit hat (`window.nlMusikVorladen = {videoId, hoehe, fps}` – umgesetzt so benannt, weil `nlVorladen` schon eine Dashboard-Funktion ist).
- Der Supervisor löst ihn im Hintergrund auf (vorhandener Cache
  `cache_key`) und startet ihn beim Wechsel ohne neuen yt-dlp-Lauf.
- Ändert sich die Reihenfolge, wird neu vorgeladen. Höchstens **ein**
  Vorlade-Prozess gleichzeitig (OOM vom 21.09.2026 beachten).
- Ziel: weniger als 3 Sekunden Stille zwischen zwei Songs.

### 5.3 Radio-Mix

- **Erste Wahl:** YouTube-Mix des zuletzt gespielten Songs,
  `https://www.youtube.com/watch?v=<id>&list=RD<id>`, mit `--flat-playlist
  --playlist-end 25`. Neue Supervisor-Funktion `mix(video_id)`.
- **Rückfall 1:** Last.fm `track.getSimilar` (im Dashboard schon für das
  Musik-Widget vorhanden), dann je Song `ytsearch1:"Künstler Titel official
  video"`. Höchstens 5 Suchen, nacheinander.
- **Rückfall 2:** das heutige `aehnliche()` (Titelsuche).
- Bereits gespielte Titel der letzten 2 Stunden und das laufende Video
  werden herausgefiltert, höchstens 2 Titel pro Künstler in Folge.
- Der Mix wird neu geholt, wenn ein **Wunsch** gespielt wurde (dann ist der
  Wunsch der neue `seed`), sonst erst, wenn weniger als 5 Titel übrig sind.

### 5.4 Wie lange läuft Musik ohne Wünsche?

- Radio läuft höchstens **60 Minuten ohne neuen Wunsch** (`YT_RADIO_MAX_MIN`
  oben in `index.html`), dann zurück zur Rotation. Das ist ein Vorgabewert,
  der Betreiber soll ihn leicht ändern können.
- Startet der Chef eine Playlist, läuft sie bis zum Ende (ohne Zeitgrenze).

### 5.5 Stimmungs-Playlists nach Uhrzeit

Wird Musik **ohne konkreten Song** gestartet („Musik starten“ in der
Fernbedienung oder Taste an der Bluetooth-Fernbedienung, siehe 8), nimmt der
TV die Playlist, die laut `yt_playlists.json` zur Uhrzeit passt (Wiener Zeit).
Vorschlag für die Standardwerte, vom Betreiber anzupassen:

| Zeit | Playlist |
|---|---|
| 08:00 bis 17:00 | Chill |
| 17:00 bis 21:00 | Schlager |
| ab 21:00 | Party Hits |

### 5.6 Bildqualität: 1080p mit 60 fps

Alle Songs der Warteschlange, des Radio-Mixes und der Playlists laufen
**standardmäßig in 1080p mit 60 fps**. Gibt es das nicht, nimmt yt-dlp die
**nächstbeste** Qualität, in dieser Reihenfolge:

1. 1080p, 60 fps
2. 1080p, 30 fps
3. 720p, 60 fps
4. 720p, 30 fps
5. alles darunter, jeweils höchste Auflösung zuerst

Die Auflösung geht also vor der Bildrate: 1080p mit 30 fps ist auf dem
Fernseher schärfer als 720p mit 60 fps.

Umsetzung im Supervisor (neue Funktion statt `format_waehlen()` für Musik,
Nightlife und DJ bleiben unverändert):

```
-f "bv*+ba[ext=m4a]/bv*+ba/b"
-S "res:1080,fps:60,vcodec:avc1,acodec:m4a"
```

- `-S` sortiert erst nach Auflösung (höchste bis 1080, `res` zählt die
  kleinere Kantenlänge, damit gelten auch Breitbild-Videos mit 1920×804 als
  1080p), dann nach Bildrate (bis 60), dann bevorzugt H.264.
- Das heutige harte H.264-Filter (`[vcodec^=avc1]`) stammt vom ODROID. Der W1
  (Radeon 780M) dekodiert VP9 und AV1 in Hardware über VA-API. Ohne das harte
  Filter bekommt er 1080p60 auch bei Videos, die es nicht in H.264 gibt.
  **Auf dem W1 prüfen:** ein VP9- und ein AV1-Video in 1080p60 abspielen,
  `mpv`-Log auf `Using hardware decoding (vaapi)` prüfen und CPU-Last mit
  `top` beobachten. Ruckelt es oder läuft es in Software, eine Variable
  `CITYCAFE_NUR_H264=1` einführen, die wieder `[vcodec^=avc1]` erzwingt.
- Die Einstellungen „Auflösung“ und „Bildrate“ unter „Mehr“ in der
  Fernbedienung gelten weiter als Obergrenze (z. B. 720p, wenn das WLAN im
  Café schwach ist). Standard dort: 1080p / 60 fps.
- Im Log jedes gespielten Songs die tatsächlich gewählte Qualität notieren
  (`format_id`, Auflösung, fps, Codec), damit man später sieht, wie oft
  1080p60 klappt.

---

## 6. TV-Darstellung (Zielbild `youtube-variante-1e.png`)

Alles in diesem Abschnitt gilt **nur, solange Musik läuft** (Modus nicht
„aus“). Danach muss alles exakt so aussehen wie vorher.

### 6.1 Kopfzeile im Nightlife-Widget

- Links: Songtitel groß (`#nl-stadt`), darunter `Künstler · Genre · Jahr`.
  Genre und Jahr kommen aus der Songs-Datenbank, wenn der Song dort steht,
  sonst aus dem vorhandenen iTunes-Rückfall. Fehlt beides, nur den Künstler
  zeigen.
- Rechts: kleine Zeitanzeige `2:08 / 3:40` (vorhandenes `.nl-counter`), dann
  **„CITY CAFE“ groß** (Orbitron 900, ca. 44 px, „CAFE“ in `#f355da`). Das
  ersetzt das Abzeichen „Nightlife“ bzw. „YouTube Music“.
- **Fortschrittsbalken** 5 px hoch, 6 px unter dem Video, volle Breite des
  Videos, Verlauf `#00f2fe` → `#f355da`. Er passt in die heutigen 16 px Luft
  unter dem Player, das Video wird dafür **nicht** kleiner.

### 6.2 Obere Leiste (`#card-top-custom`) übernimmt „Als Nächstes“

- Solange Musik läuft, pausiert `blStartTopCycle()` bzw. der Bundesliga-Zyklus.
- Die Leiste zeigt **nur die nächsten 2 Titel, so groß wie möglich**:
  - links eine pinke Pille, zweizeilig „ALS / NÄCHSTES“, **gut lesbar**:
    Orbitron 900, **24 px**, Zeilenhöhe 1.1, weiße Schrift mit leichtem
    Schatten auf **vollflächigem** Pink `#c026d3` (kein Verlauf, damit der
    Kontrast überall gleich ist), Innenabstand links/rechts 22 px;
  - danach zwei gleich breite Felder nebeneinander, getrennt durch eine feine
    Linie. Je Feld: Nummer (Orbitron, ca. 40 px, `#00f2fe`), Songtitel
    (ca. 36 px, fett, weiß), darunter Künstler (ca. 19 px, grau);
  - beim ersten Titel hinter dem Künstler „· in 1:32“ in Cyan (Restlaufzeit
    des laufenden Songs, sekündlich), beim Handy-Wunsch „· 📱 Wunsch“ in Pink;
  - kein eigenes Countdown-Feld rechts, damit die Titel mehr Platz haben.
- Zu lange Titel werden mit „…“ gekürzt, Schriftgröße nicht automatisch
  verkleinern (sonst springen die Größen bei jedem Wechsel).
- Ist die Warteschlange leer, zeigt die Leiste die nächsten 2 Radio-Titel,
  die Pille wird zu „📻 / RADIO“.
- Nach dem Musikbetrieb geht die Leiste in genau den Zustand zurück, den sie
  vorher hatte (Liga, Phase, Zeitgeber). Das in `runMasterSequence()`
  absichern.

### 6.3 Einblendungen in der oberen Leiste

- **Neuer Wunsch:** 5 Sekunden „📱 Neuer Wunsch: Joana · Roland Kaiser“,
  dann zurück zu „Als Nächstes“. Mehrere Wünsche nacheinander werden
  hintereinander eingeblendet, nicht übereinander.
- **Tor in der Bundesliga (bzw. Liga, die gerade läuft):** Ändert sich
  während des Musikbetriebs ein Spielstand eines laufenden Spiels, schiebt
  sich die normale Bundesliga-Anzeige dieses Spiels für **15 Sekunden**
  zurück in die Leiste, danach wieder „Als Nächstes“. Tor hat Vorrang vor
  der Wunsch-Einblendung.

### 6.4 Titel aufbereiten

YouTube-Titel sind oft „Helene Fischer - Atemlos durch die Nacht (Official
Video) [4K]“. Eine Funktion `titelZerlegen(titel, kanal)`:

- trennt am ersten „ - “ bzw. „ – “ in Künstler und Songtitel;
- entfernt Zusätze in Klammern wie „Official Video“, „Official Music Video“,
  „Lyrics“, „HD“, „4K“, „Remaster“, „Live“ bleibt aber stehen;
- ohne Trenner: Künstler = Kanalname ohne „ - Topic“ / „VEVO“;
- mit Tests (mindestens 15 echte Beispiele aus der Dauerliste und aus Mixes).

### 6.5 QR-Code unten rechts im Video

> Vorerst ausgeschaltet (`YT_QR_AN = false` in `index.html`). Auf `true` setzen, um ihn wieder zu zeigen.

Der QR-Code zum Wünschen sitzt **unten rechts in der Videofläche**: weißes
Kärtchen mit abgerundeten Ecken, QR ca. 120×120 px (bei 1920er Auflösung),
darunter „SONG WÜNSCHEN“ in dunkler Orbitron-Schrift, 3 px Abstand zum
Rand. Ziel: `https://motte025.github.io/City-cafe/fernbedienung.html?raum=<raum>`.

Weil mpv über dem Browser liegt, **zeichnet mpv das Kärtchen selbst**:

- Das Dashboard rendert das Kärtchen einmal in ein Canvas (QR-Bild ist ja
  schon da, `#dj-fern-qr-img`) und legt es als PNG-Daten-URL in
  `window.nlQrKarte` ab, dazu die gewünschte Größe in CSS-Pixeln.
- Der Supervisor wandelt es in rohe BGRA-Daten (Pillow, auf dem W1 über
  `python-pillow` installieren und in `KIOSK-SETUP.md` vermerken) und legt es
  mit mpvs `overlay-add` (IPC, Format `bgra`) in die rechte untere Ecke. Die
  Position rechnet er aus der mpv-Fenstergröße und dem Maßstab von
  `measured_rect()`, damit es bei jeder Auflösung gleich aussieht.
- Bei jedem `place_mpv()` (Größe/Position geändert) die Überlagerung neu
  setzen, beim Ende von Musik mit `overlay-remove` entfernen.
- Nur während Musik, **nicht** bei Nightlife-Zyklusvideos, DJ-Streams oder
  der Dartcam.
- Läuft das Video ausnahmsweise im Browser (YouTube-iframe, kein mpv), zeigt
  das Dashboard das Kärtchen als normales HTML an derselben Stelle.
- Auf dem W1 mit Bildschirmfoto prüfen, dass der Code aus 3 m Entfernung mit
  einem Handy scannbar ist. Wenn nicht: Größe auf 180 px erhöhen.

### 6.6 Seitenleiste (`#card-rotator`)

Solange Musik läuft, liegt eine eigene Ebene über dem Rotator:

- Überschrift „📻 Passt dazu“, darunter **6** Radio-Titel mit farbiger Kachel
  und ♪ (keine Albumcover laden), Titel, Künstler.
- Darunter klein: „Läuft automatisch, wenn die Warteschlange leer ist“.
- **Kein QR-Code** mehr in der Seitenleiste (der sitzt jetzt im Video).
- **Keine Prozentwerte**: dafür gibt es keine echten Daten. Die Reihenfolge
  des Mixes reicht.
- Das Wetter-Widget darüber bleibt unverändert.

### 6.7 Ticker unten

Das Etikett „☕ CITY CAFE“ links wird während der Musik zu „▶ JETZT LÄUFT“,
der laufende Text zeigt `Atemlos durch die Nacht · Helene Fischer · 2013`
im Wechsel mit den normalen Ticker-Meldungen. Danach wieder wie vorher.

### 6.8 Zwei Ansichten: Normal und Vollbild, per Fernbedienung umschaltbar

Während Musik läuft, gibt es zwei Ansichten. Umgeschaltet wird jederzeit,
**ohne dass das Video oder der Ton unterbricht**.

**Normal** (`youtube-variante-1e.png`) ist alles aus 6.1 bis 6.7: Dashboard
mit Wetter, Ticker, oberer Leiste und Seitenleiste.

**Vollbild** (`youtube-vollbild.png`) ist eine eigene Ebene über dem ganzen
`#dashboard-scaler` (1920×1080), wie die CL-Tabelle `#ucl-fullscreen-table`:

- **Kopf:** links Songtitel groß (Orbitron 900, ca. 44 px), darunter
  `Künstler · Genre · Jahr`. Rechts **„CITY CAFE“** (ca. 52 px, „CAFE“ in
  `#f355da`), feine Trennlinie, Uhrzeit.
- **Video** 1280×720 links, darunter Fortschrittsbalken mit Zeiten.
- **QR-Code unten rechts im Video**, gleiches Kärtchen wie in 6.5, hier
  128 px, 3 px Abstand zum Videorand. Auch hier zeichnet mpv ihn (6.5).
- **Rechts:** Kärtchen „Gleich dran“ mit großem Countdown (Restlaufzeit) und
  dem nächsten Titel. Darunter „Danach · 📱 n Wünsche“ mit den folgenden
  Titeln der Warteschlange (so viele wie passen, bis 7), Wünsche markiert.
  Ist die Warteschlange leer, stehen dort die nächsten Radio-Titel.
- **Unten:** „📻 Radio-Mix · passt zu diesem Song“ mit 5 Kacheln (keine
  Prozentwerte, keine Albumcover).
- Wetter, Ticker und obere Leiste sind verdeckt. Ein **Tor** erscheint im
  Vollbild 15 s als Banner im Kopfbereich (rechts neben dem Titel, nie über
  dem Video), die Wunsch-Einblendung (6.3) ebenso 5 s.

**Umschalten:**

- Handy, Reiter „Jetzt“: Knopf „⛶ Vollbild“ bzw. „▭ Normal“, **nur für
  Chef-Geräte**.
- Bluetooth-Fernbedienung, nur während Musik: `ArrowUp` = Vollbild,
  `ArrowDown` = Normal (vorher prüfen, ob die Tasten ankommen, siehe 8).
- Der Zustand steht in `yt/jetzt/vollbild` (true/false), gilt über
  Songwechsel und einen Neustart des Dashboards hinweg.
- Beginn des Musikbetriebs: Vorgabe aus `YT_VOLLBILD_STANDARD` (oben in
  `index.html`, Standard `false`). Ende des Musikbetriebs oder Start einer
  Hos'n-Obe-Runde: Vollbild-Ebene weg, Dashboard wieder komplett wie vorher.
- Die Vollbild-Ebene in `runMasterSequence()` abbauen (siehe `STAND.md`).

**mpv beim Umschalten:**

- Der Supervisor misst heute fest `nl-player-frame` (`FLAECHE["yt"]`). Neu
  meldet das Dashboard die aktive Videofläche, z. B.
  `window.nlMpvFlaeche = 'nl-player-frame'` bzw. `'yt-vollbild-video'`. Der
  Supervisor misst die gemeldete Fläche.
- Ändert sich die Fläche, nur `place_mpv()` und die QR-Überlagerung neu
  setzen. **mpv nicht neu starten, keine neue yt-dlp-Auflösung.**
- Ziel: Umschalten in unter einer halben Sekunde, Ton läuft ohne Aussetzer
  durch, QR sitzt danach sofort in der richtigen Ecke.

---

## 7. Handy-Fernbedienung (Zielbild `fernbedienung-vorschau.png`)

`yt-fernbedienung.html` wird neu aufgebaut. Die Hülle
`fernbedienung.html` mit ihren Reitern (Videos, DJ, Roulette, Hos'n Obe)
bleibt. Innerhalb von „Videos“ (umbenennen in „🎵 Musik“) kommt eine eigene
Reiterleiste **unten** mit fünf Reitern. Die bestehenden Funktionen
(Dauerliste, Spulen, Ton, Bluetooth, Laufzeit/Auflösung/Bildrate, Stopp)
bleiben alle erhalten und wandern in die neuen Reiter.

### 7.1 Reiter

| Reiter | Inhalt | Gast | Chef |
|---|---|---|---|
| ▶️ Jetzt | Laufender Song (Titel, Künstler, Fortschritt). Knöpfe ⏮ ⏸ ⏭ 🔊 und ⛶ Vollbild/Normal. Darunter die **ganze** Warteschlange, danach „📻 Danach: Radio-Mix“ mit den nächsten 5 Radio-Titeln | sieht alles, kann **eigene** Wünsche mit ✕ zurückziehen | Knöpfe, Ziehen zum Umsortieren, ✕ für jeden Eintrag |
| 🔍 Suche | Suchfeld, Treffer mit „⏭ Als Nächstes“ und „➕ Ans Ende“ | nur „🙋 Wünschen“ (entspricht Ans Ende) | beide Knöpfe |
| ✨ Passt dazu | Radio-Titel zum laufenden Song, je mit ＋ | ＋ = wünschen | ＋ = ans Ende, langes Drücken = als Nächstes |
| 📋 Listen | Playlists aus `yt_playlists.json` (Nummer, Name, Anzahl), aufklappbar mit allen Titeln; dazu die bestehende Dauerliste | einzelne Titel wünschen | „▶ Ganze Playlist starten“ und „➕ Ganze Playlist anhängen“ |
| ⚙️ Mehr | Bluetooth, Laufzeit/Auflösung/Bildrate, Ton/Lautheit, Raumwahl, Stopp zurück zur Rotation, **Chef-Anmeldung mit PIN** | nur Chef-Anmeldung und Raumwahl | alles |

- „Jetzt“ ist der Startreiter. Der Fortschritt läuft am Handy lokal weiter
  (aus `posSek` + Zeit seit `ts`) und wird bei jeder Meldung vom TV korrigiert.
- Chef-Anmeldung: PIN eingeben → Schreiben nach `chef/geraete/<uid>`. Klappt
  es, merkt sich das Handy den Chef-Status (localStorage) und zeigt oben
  „👑 Chef“. „Abmelden“ löscht den Eintrag.
- Ziehen zum Umsortieren: Griff `⋮⋮` links, nur am Griff ziehbar (sonst
  scrollt man aus Versehen um). Eigene Pointer-Events-Umsetzung oder
  SortableJS (UMD von cdnjs). Beim Loslassen nur die eine `pos` neu schreiben
  (Mittelwert der Nachbarn), nicht die ganze Liste.

### 7.2 Längere Listen (ausdrücklicher Wunsch des Betreibers)

| Liste | Heute | Neu |
|---|---|---|
| Suchtreffer | 15 (`SUCH_TREFFER`) | **25**, darunter „Mehr laden“ (+25, bis 75) |
| Vorschläge beim Öffnen | 6 (`VORSCHLAG_ANZAHL`) | **12** |
| Passt dazu | 6 (Titelsuche) | **20** (aus dem YouTube-Mix, ein einziger yt-dlp-Lauf) |
| Warteschlange am Handy | gibt es nicht | **vollständig**, ohne Begrenzung |
| Radio-Vorschau unter „Jetzt“ | gibt es nicht | **5** |
| Playlists | gibt es nicht | alle Titel jeder Playlist, aufklappbar |

Achtung beim Speicher: `VORSCHLAG_BEGRIFFE_JE_LAUF` bleibt bei 3 und die
Suchen bleiben nacheinander (OOM vom 21.09.2026). Für 12 Startvorschläge
reicht es, je Begriff 4 Treffer zu holen. Ein Mix ist ein einzelner Aufruf
und kostet nicht mehr als eine Suche.

Lange Listen am Handy: nicht alles auf einmal rendern, sondern in Blöcken von
25 nachladen, sobald man ans Ende scrollt. Die Seite muss auf einem
Mittelklasse-Handy flüssig bleiben.

### 7.3 Playlists: `yt_playlists.json`

```json
[
  { "nr": 1, "name": "Party Hits", "quelle": "https://www.youtube.com/playlist?list=…", "zeit": "21:00-08:00" },
  { "nr": 2, "name": "Schlager",   "quelle": "https://www.youtube.com/playlist?list=…", "zeit": "17:00-21:00" },
  { "nr": 3, "name": "Après-Ski",  "quelle": "https://www.youtube.com/playlist?list=…" },
  { "nr": 4, "name": "Chill",      "quelle": "https://www.youtube.com/playlist?list=…", "zeit": "08:00-17:00" }
]
```

- `quelle` ist ein YouTube-Playlist-Link. Der Betreiber hat YouTube Music
  Premium und legt die Listen selbst in seinem Konto an, **ziel 50 bis 100
  Titel pro Liste**. Die Links trägt er hier ein.
- Der Supervisor liest eine Playlist mit `--flat-playlist` und legt das
  Ergebnis 24 Stunden im Cache ab (`/tmp` ist RAM, also eine kleine
  JSON-Datei unter `/home/citycafe/.cache/citycafe/`).
- Bis echte Links da sind: Platzhalter-Playlists aus Titeln der
  Songs-Datenbank (`category`), aufgelöst per `ytsearch1:"Künstler Titel"`
  beim ersten Abspielen. So ist das Feature sofort testbar.

---

## 8. Bluetooth-Fernbedienung am TV

Nur wenn die Fernbedienung diese Tasten wirklich sendet (vorher mit
`autoplay-check.html` bzw. einem kleinen `keydown`-Logger am W1 prüfen,
Ergebnis in `FERNBEDIENUNGEN.md` eintragen):

| Taste | Wirkung |
|---|---|
| `1` bis `9` | Playlist mit dieser Nummer starten |
| `MediaPlayPause` | Pause/weiter |
| `MediaTrackNext` / `ArrowRight` (nur während Musik) | Überspringen |
| `0` | Musik starten mit Stimmungs-Playlist (5.5) |
| `ArrowUp` / `ArrowDown` (nur während Musik) | Vollbild / Normal (6.8) |

`OK` (Enter/Space) behält seine heutige Bedeutung („Stream starten“). Die
TV-Fernbedienung gilt als Chef.

---

## 9. Reihenfolge der Umsetzung

Jeder Schritt einzeln testbar, nach jedem Schritt funktioniert das Dashboard
wie vorher, wenn keine Musik läuft.

1. **Supervisor:** Qualitätsauswahl (5.6), `mix()`, Playlist lesen, `SUCH_TREFFER = 25`,
   `VORSCHLAG_ANZAHL = 12`, Vorladen (5.2). Auf dem W1 von Hand testen, Log
   prüfen, Speicher beobachten (`free -m` während eines Mixes).
2. **`yt-warteschlange.js`** mit Tests (Wunsch-Grenzen, Doppelte, Reihenfolge
   Chef/Gast/Radio, Songende, Stopp, Überspringen, Radio-Zeitgrenze,
   Stimmungs-Playlist nach Uhrzeit inkl. Mitternacht).
3. **`titelZerlegen()`** mit Tests.
4. **Dashboard:** Warteschlange an Firebase anbinden, Ablauf 5.1, Radio 5.3.
5. **TV-Darstellung** 6.1 bis 6.8, erst Normal, dann Vollbild und Umschalten (QR-Überlagerung in mpv als eigener Teilschritt). Vorher/Nachher-Bildschirmfotos mit `grim`
   vergleichen (siehe `STAND.md`). Besonders prüfen: Rückkehr zur Rotation
   stellt obere Leiste, Seitenleiste und Ticker vollständig wieder her.
6. **Sicherheitsregeln** (4.1) und Chef-Anmeldung.
7. **Neue Handy-Fernbedienung** (7), auf einem echten Android-Handy in
   Chrome testen, auch im Querformat und am Tablet (ab 700 px).
8. **Bluetooth-Tasten** (8), falls vorhanden.
9. Doku: `STAND.md`, `FERNBEDIENUNGEN.md`, `KIOSK-SUPERVISOR.md`, `README.md`
   nachziehen.

---

## 10. Abnahme

- [ ] Videofenster pixelgenau wie vorher (Bildschirmfoto-Vergleich).
- [ ] QR-Code unten rechts im laufenden mpv-Video sichtbar und aus 3 m
      scannbar, verschwindet nach Ende der Musik und erscheint nicht bei
      Nightlife, DJ oder Dartcam.
- [ ] Musik läuft in 1080p60, wo YouTube das anbietet (Log), sonst in der
      nächstbesten Stufe laut 5.6, ohne Ruckeln.
- [ ] Umschalten Normal ↔ Vollbild per Handy (Chef) und per
      Bluetooth-Taste, Ton ohne Aussetzer, QR wandert mit, Gast sieht den
      Knopf nicht.
- [ ] Nach Ende der Musik aus dem Vollbild heraus: Dashboard komplett wie
      vorher (obere Leiste, Seitenleiste, Ticker, Wetter).
- [ ] Obere Leiste zeigt genau 2 Titel, lange Titel sauber mit „…“ gekürzt.
- [ ] Drei Wünsche von zwei Handys: Reihenfolge stimmt, dritter Wunsch eines
      Handys wird mit Meldung abgelehnt.
- [ ] Chef zieht Titel 4 auf Platz 1, TV-Leiste ändert sich innerhalb von
      2 Sekunden.
- [ ] Zwischen zwei Songs höchstens 3 Sekunden Stille.
- [ ] Warteschlange leer → Radio-Mix startet, passt hörbar zum letzten Song.
- [ ] Nach 60 Minuten ohne Wunsch zurück zur Rotation, alles wie vorher.
- [ ] Tor während der Musik → 15 s Spielstand in der Leiste, dann zurück.
- [ ] Wunsch-Einblendung 5 s, mehrere nacheinander sauber.
- [ ] Hos'n Obe läuft → keine Songs, Wünsche warten und starten danach.
- [ ] Gast ohne PIN kann nicht überspringen, nicht stoppen, nicht umsortieren
      (auch nicht über die Datenbank direkt, Simulator).
- [ ] Neustart des Dashboards mitten in der Warteschlange: sie ist danach
      noch da, Musik läuft mit dem nächsten Titel weiter.
- [ ] Suche zeigt 25 Treffer und „Mehr laden“, Passt dazu zeigt 20.

---

## 11. Vom Betreiber noch festzulegen (Vorgaben gelten bis dahin)

| Frage | Vorgabe |
|---|---|
| Chef-PIN | legt der Betreiber in Firebase an |
| Wünsche pro Handy | 2 offene |
| Radio ohne Wunsch | 60 Minuten, dann Rotation |
| Uhrzeiten der Stimmungs-Playlists | siehe 5.5 |
| Playlist-Links | Platzhalter aus der Songs-Datenbank, bis echte Links da sind |
| Ansicht beim Start der Musik | Normal (`YT_VOLLBILD_STANDARD = false`) |
