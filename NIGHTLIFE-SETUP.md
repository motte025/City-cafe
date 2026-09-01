# Nightlife-Widget

Zeigt Nachtleben-Videos einer Stadt. Steht an **erster Stelle** im Zyklus,
laeuft **5 Minuten** pro Auftritt, Tag und Nacht.

## Stadt wechseln (alle 2 Wochen)

Nur `nightlife.json` bearbeiten - sonst nichts:

https://github.com/motte025/City-cafe/blob/main/nightlife.json

```json
{
  "stadt": "Miami · Brickell",
  "untertitel": "Nightlife-Tour durch den Luxusbezirk",
  "videos": [
    { "videoId": "5E9wyQI5Z0k", "titel": "Brickell bei Nacht" },
    { "videoId": "iHcREEIHOGk", "titel": "Unterwegs in Brickell" },
    { "videoId": "0cxMDe9jYi0", "titel": "Miamis Luxusviertel" }
  ]
}
```

- `videoId` = der Teil hinter `youtu.be/` bzw. hinter `watch?v=`.
  Aus `https://youtu.be/5E9wyQI5Z0k?is=ANfuKTDf` wird also `5E9wyQI5Z0k`.
- `titel` steht im Kopf ueber dem Video. Weglassen geht, dann steht dort der
  `untertitel`.
- Beliebig viele Videos, mindestens eines. Leere Liste = Widget faellt aus.
- **Keine Laufzeiten eintragen** - die holt sich das Dashboard selbst vom Player.

## Eigene Videodateien statt YouTube (die ruhigere Variante)

Statt `videoId` kann ein Eintrag auch auf eine **Datei im Repo** zeigen:

```json
{ "datei": "videos/miami-1.mp4", "titel": "Brickell bei Nacht" }
```

Beides laesst sich mischen. Was damit wegfaellt:

| | YouTube | eigene Datei |
| --- | --- | --- |
| Werbung | ja | **keine** |
| Qualitaet | YouTube regelt selbst herunter | genau die des Files |
| Puffern | abhaengig vom Netz | Datei liegt im Browser-Cache |
| Dekodierung | meist VP9 - auf ARM-Boxen in Software | **H.264 in Hardware** |

Genau diese vier Punkte sind die Ursache der Ruckler. Eigene Dateien sind
deshalb die stabilste Loesung fuer einen Screen, der den ganzen Tag laeuft.

### Woher die Videos

Aufnahmen von YouTube herunterzuladen verstoesst gegen deren
Nutzungsbedingungen, und die Clips gehoeren den jeweiligen Kanaelen - fuer einen
Bildschirm im Lokal ist das der falsche Weg. Fertige Nightlife-/Stadt-Aufnahmen
gibt es kostenlos und ausdruecklich zur kommerziellen Nutzung freigegeben bei:

- https://www.pexels.com/videos/ (Suche z. B. „miami night", „city night walk")
- https://pixabay.com/videos/
- https://mixkit.co/free-stock-video/
- https://coverr.co/

Dort laedt man die MP4 direkt herunter - kein Umweg, keine offenen Fragen.

### Wohin mit der Datei

Ins **Repo** passen nur Dateien bis **100 MB** - das reicht bei brauchbarer
Bitrate fuer rund 5 Minuten. Fuer ein langes Video ist der bessere Platz ein
**Release-Anhang**: dort sind **2 GB pro Datei** erlaubt, das Repo bleibt
schlank, und die Adresse laesst sich direkt als `datei` eintragen.

1. **https://github.com/motte025/City-cafe/releases/new** oeffnen
2. Tag vergeben (z. B. `videos-nightlife`), Datei unter „Attach binaries"
   hineinziehen, **Publish release**
3. Auf die Datei rechtsklicken → Linkadresse kopieren. Sie sieht so aus:
   `https://github.com/motte025/City-cafe/releases/download/<tag>/<datei>.mp4`
4. Diese Adresse als `datei` in `nightlife.json` eintragen - fertig.

Dateinamen ohne Leerzeichen und Umlaute waehlen, sonst wird die Adresse unnoetig
kryptisch.

**Vier Dinge muss die Datei erfuellen** (pruefen mit
`ffprobe -show_entries stream=codec_name,width,height,r_frame_rate datei.mp4`):

| | warum |
| --- | --- |
| Codec **h264** | wird auf der Box in Hardware dekodiert; `vp9` oder `av01` nicht |
| **1920x1080** | mehr bringt auf dem Screen nichts und kostet Rechenzeit |
| Index vorne (**faststart**) | sonst laedt der Browser erst die ganze Datei, bevor etwas laeuft |
| moeglichst **30 fps** | 60 fps verdoppeln die Dekodierarbeit ohne sichtbaren Gewinn |

Faststart nachtraeglich setzen und den Ton wegwerfen geht **ohne
Qualitaetsverlust** (reines Umkopieren, dauert Sekunden):

```
ffmpeg -i original.mp4 -c:v copy -an -movflags +faststart fertig.mp4
```

### Bandbreite

Bei 4,8 Mbit/s zieht jeder 5-Minuten-Auftritt rund 180 MB. Bei zehn Auftritten
am Tag sind das ~1,8 GB taeglich. GitHubs Richtwert fuer Pages liegt bei
100 GB/Monat - es passt, ist aber kein Kleinkram. Wird es eng, hilft eine
Neukodierung auf 3,5 Mbit/s und 30 fps.

### Neu kodieren, wenn noetig

Nur wenn Codec, Bildrate oder Bitrate nicht passen. Fuer eine Datei im Repo
(unter 100 MB) heisst das rund 2,5 Mbit/s bei 5 Minuten:

```
ffmpeg -i original.mp4 -t 300 \
  -vf "scale=1920:1080" -c:v libx264 -preset slow -b:v 2400k -maxrate 3000k \
  -bufsize 6000k -profile:v high -level 4.0 -pix_fmt yuv420p \
  -movflags +faststart -an videos/miami-1.mp4
```

- `-an` wirft die Tonspur weg (der Screen laeuft stumm) und spart Platz.
- `-movflags +faststart` ist wichtig: sonst faengt der Browser erst an, wenn die
  ganze Datei da ist.
- Datei nach `videos/` im Repo legen und in `nightlife.json` eintragen.

Nach dem Speichern auf GitHub ist die neue Stadt beim naechsten Auftritt drauf.
Der Screen muss nicht neu gestartet werden.

## Wie der Startpunkt wandert

Damit nicht jedes Mal derselbe Anfang laeuft, verschiebt sich der Einstieg bei
jedem Auftritt um 5 Minuten: erst ab 0:00, dann ab 5:00, dann ab 10:00 und so
weiter. Ist das Video durch, geht es wieder bei 0:00 los.

Angeschnitten wird nie: passen die vollen 5 Minuten nicht mehr ins Video, wird
sofort wieder vorne begonnen. Ein Video unter 5 Minuten startet also immer bei
0:00 und laeuft im Slot einmal durch (danach beginnt es von vorne).

Der Stand ueberlebt einen Neustart des Screens (localStorage).

## Warum es fluessig laeuft

Der YouTube-Player wird **einmal beim Seitenstart** gebaut und danach nie wieder
neu. Direkt nachdem der Slot vorbei ist, holt er sich das naechste Video schon
in den Puffer und haelt an. Bis zum naechsten Auftritt ist die Rotation einmal
herum - das Video liegt dann lokal und startet ohne Ladepause.

Die Bildqualitaet haengt bei YouTube an der Groesse des Players. Deshalb rechnet
er intern in **1920x1080** und wird nur per CSS auf die Buehne heruntergerechnet
(`transform: scale(0.625)`). Bei den frueheren 1200x675 lieferte YouTube 720p,
das auf dem Fernseher sichtbar unscharf ankam.

## Welche Aufloesung kommt wirklich an?

Nicht raten - messen. An die Dashboard-Adresse `?nldiag=1` haengen:

```
https://motte025.github.io/City-cafe/?nldiag=1
```

Unten rechts im Player steht dann, was tatsaechlich laeuft:

- **`YouTube liefert: hd1080`** - alles gut.
  Steht dort `hd720`, `large` (480p) oder `medium` (360p), regelt YouTube selbst
  herunter, weil die Box nicht hinterherkommt.
- Bei eigenen Dateien: **`ausgelassen 340 (4.1%)`**. Alles ueber etwa 1 % heisst,
  die Box schafft die Dekodierung nicht - dann eine Stufe kleiner encodieren.

Wieder abschalten: `?nldiag=1` einfach weglassen.

### Wenn die Box nicht hinterherkommt

1080p sieht besser aus, kostet aber deutlich mehr Rechenzeit. Zum Vergleichen
ohne Codeaenderung:

```
https://motte025.github.io/City-cafe/?nlq=hd720&nldiag=1
```

Laeuft es damit ruhig und mit 1080p nicht, in `index.html` in `NL_CONFIG`
dauerhaft `maxAufloesung: 'hd720'` setzen.

## Werbung

**Ueberspringen laesst sich ein Werbeblock nicht.** Der YouTube-Player liegt auf
einer fremden Herkunft; an dessen "Werbung ueberspringen"-Knopf kommt kein
Skript von aussen heran. Das ist keine Einstellungssache, sondern eine Grenze
des Browsers.

Was das Dashboard stattdessen tut:

1. **Erkennen.** Waehrend eines Werbeblocks meldet der Player die Kennung des
   Spots statt die des gewuenschten Videos. Zweite Spur: die gemeldete Laenge
   passt nicht zur gespeicherten (ein Werbespot ist kurz, die Stadtvideos sind
   lang).
2. **Zudecken.** Der Player wird von einer Tafel mit dem Stadtnamen verdeckt -
   sie sieht aus wie Teil der Gestaltung, nicht wie ein Fehler. Niemand im Lokal
   bekommt die Werbung zu sehen.
3. **Weiterschalten.** Zieht sich die Werbung laenger als
   `NL_CONFIG.werbungGeduldSekunden` (45 s), wird der Slot vorzeitig beendet und
   die Rotation laeuft weiter.

Nebenbei wird verhindert, dass die **Werbelaenge** als Videolaenge
haengenbleibt - sonst waere die Abschnittswanderung danach voellig verstellt.

**Ganz weg ist die Werbung nur mit eigenen Videodateien** (siehe oben). Der
zweite Weg waere, Chrome im Google-Konto mit YouTube Premium anzumelden - auf
sideloadetem Chrome unter Android TV geht das oft nicht.

## Warum es ruckeln kann - und was hilft

Wichtig zum Verstaendnis: Die Box spielt 4K-Videos in nativen Playern
problemlos. **Der Dekoder ist also nicht das Problem.** Das sind zwei
verschiedene Wege durch die Hardware:

- **Nativer Player:** Der Dekoder schreibt die Bilder direkt in eine
  Overlay-Ebene, der Displaycontroller mischt sie mit der Oberflaeche. Die GPU
  macht praktisch nichts.
- **Video in einer Webseite:** Jedes dekodierte Bild muss in eine GPU-Textur
  kopiert und mit allen Seitenebenen neu zusammengesetzt werden - jedes Frame.
  Das kostet Fuellrate, nicht Dekoderleistung.

Deshalb entscheidet, **wie viel der Browser pro Bild zusammensetzen muss**.

### Im Dashboard bereits erledigt

- **Die teuren Effekte sind dauerhaft aus**: keine `backdrop-filter`, keine
  `filter: blur()`, keine Schatten, keine Animationen ausser den beiden
  Laufschriften. Auf dem Odroid startete Android TV neu, sobald das Dashboard in
  Chrome geladen wurde - das ist ein haengender Grafiktreiber, und
  grossflaechige Weichzeichner sind auf Mali-GPUs der klassische Ausloeser. Die
  nackte Testseite lief auf derselben Box 5:29 mit 0,03 % ausgelassenen Bildern
  durch; sie hatte keinen einzigen Weichzeichner.
  Mit **`?fx=1`** kommt das alte Aussehen zum Vergleich zurueck.

- Ausgeblendete Medienansichten stehen auf `visibility: hidden` statt nur
  `opacity: 0`. Vorher wurden alle 15 Ansichten dauernd mitgezeichnet - samt
  `backdrop-filter`, Schatten und laufenden Animationen, fuer niemanden.
  Umgeschaltet wird per `transition-delay` erst nach der Ueberblendung, damit
  nichts springt.
- Animationen in ausgeblendeten Ansichten sind angehalten.
- Waehrend ein Video laeuft, bekommt `<body>` die Klasse `video-laeuft`. Die
  Regentropfen im Wetter-Widget (Dutzende einzeln animierter Elemente) sind
  dann ganz aus dem Rendering. Die beiden Laufschriften laufen bewusst weiter -
  eingefroren saehen sie kaputt aus.

### An der Box

1. **HDMI-Ausgabe auf 1920x1080 @ 60 Hz.** Bei 2160p setzt der Browser
   8,3 Mio. Pixel pro Bild zusammen statt 2,1 Mio. Das Dashboard ist intern nur
   1280 Pixel breit und gewinnt durch 4K-Ausgabe nichts. Groesster Hebel.
2. **Android System WebView aktualisieren** (oder Chrome installieren und in den
   Entwickleroptionen als WebView-Implementierung waehlen). Auf Custom-ROMs ist
   die mitgelieferte oft Jahre alt.
3. **Entwickleroptionen:** Fenster-, Uebergangs- und Animator-Skalierung auf 0,5
   oder aus.
4. **Alles Uebrige stilllegen:** Play-Store-Auto-Updates, Hintergrund-Sync,
   Bildschirmschoner. Ein Signage-Geraet sollte genau eine App laufen haben.
5. **Kuehlung pruefen.** Ein 4K-Test dauert Minuten, das Dashboard laeuft
   14 Stunden - unter Dauerlast wird gedrosselt.

## Wenn ein Video nicht laeuft

Manche Videos duerfen nicht eingebettet werden (Einstellung des Kanals). Das
Dashboard merkt das selbst, nimmt das Video fuer diesen Seitenaufruf aus der
Liste und schaltet sofort weiter, statt 5 Minuten schwarz zu bleiben.

Dauerhaft loswerden: `videoId` aus `nightlife.json` streichen.

Pruefen laesst sich das vorab, indem man
`https://www.youtube.com/embed/<videoId>` direkt im Browser aufruft. Kommt dort
"Video ist nicht verfuegbar", geht es auch im Dashboard nicht.

## Stellschrauben

In `index.html` in `NL_CONFIG`:

https://github.com/motte025/City-cafe/blob/main/index.html

| Wert | Bedeutung | Standard |
| --- | --- | --- |
| `sekundenProVideo` | Standzeit pro Auftritt, zugleich die Schrittweite des Startpunkts | `300` (5 Min) |
| `vorladeSekunden` | wie lange das naechste YouTube-Video im Hintergrund puffert | `30` |
| `maxAufloesung` | `'hd1080'` oder `'hd720'` - bestimmt die Player-Groesse und damit die YouTube-Qualitaet | `'hd1080'` |
| `zeigeDiagnose` | Diagnosefeld dauerhaft an (sonst `?nldiag=1`) | `false` |
| `quelle` | Datei mit den Videos | `nightlife.json` |
