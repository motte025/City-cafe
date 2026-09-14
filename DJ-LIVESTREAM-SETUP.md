# DJ-Livestream-Widget — Einrichtung

> ## Sicherheitsstopp nach veröffentlichtem Screenshot
>
> Ein Screenshot vom 12.09.2026 zeigt einen vollständigen GitHub-PAT, ein
> Twitch-Client-Secret und einen Twitch-App-Token. Diese Werte gelten als
> kompromittiert. **Nicht weiterverwenden:** GitHub-PAT auf GitHub widerrufen,
> Twitch-Client-Secret in der Developer Console neu erzeugen und die sichtbaren
> Token-Werte aus den Script Properties löschen. Erst danach mit neuen Werten
> fortfahren. Neue Secrets niemals per Screenshot oder Chat übertragen.
>
> Das Repository kann diese Schritte nicht selbst ausführen: Widerruf und
> OAuth-Zustimmung benötigen eine Anmeldung in den Konten des Betreibers.

> ## Neuer Betrieb: gefolgte Twitch-DJs, nur Bild
>
> Das Widget läuft bewusst **stumm**. Der Checker fragt serverseitig die gerade
> live sendenden Twitch-Kanäle ab, denen `motte025` folgt, und behält davon nur
> die Twitch-Kategorie **Music** (`game_id=26936`). Pro Dashboard-Zyklus wird
> genau ein DJ zufällig gewählt und drei Minuten gezeigt. Wenn keiner live ist,
> sucht das Widget 30 Sekunden lang und setzt danach die normale Rotation fort.
>
> Die Handy-Fernbedienung bleibt aktiv. Der QR-Code zur Fernbedienung erscheint zu Beginn des
> Twitch-Slots; eine Auswahl am Handy hat Vorrang vor der Zufallsauswahl.

### Testadresse

Der frühere `raw.githack.com/.../work/...`-Link funktioniert hier nicht: Der
Codex-Arbeitsbranch wird nicht als öffentlicher GitHub-Branch veröffentlicht und
der Dienst antwortet deshalb korrekt mit 404. Diesen Link nicht mehr verwenden.

Der Player lässt sich unabhängig vom neuen Follow-Checker auf der bestehenden
GitHub-Pages-Seite mit einem erzwungenen Kanal prüfen:

<https://motte025.github.io/City-cafe/?djnow=1&djtest=djmissshelton>

Der vollständige automatische Follow-Modus kann erst geprüft werden, nachdem
`djTestLauf()` erfolgreich war, `live_status.json` aktualisiert wurde und die
Dashboard-Änderung auf GitHub Pages veröffentlicht ist.


### Wenn „TWITCH_USER_REFRESH_TOKEN / TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET fehlen“ erscheint

Das ist kein Programmfehler und `djTestLauf` ist die richtige Funktion. Die
Skripteigenschaften des **aktuellen Apps-Script-Projekts** fehlen. Sie gelten
pro Projekt und werden nicht durch das Einfügen der `.gs`-Datei übernommen.

1. Links unten auf das Zahnrad **Projekteinstellungen** tippen.
2. Bis **Skripteigenschaften** scrollen.
3. **Skripteigenschaft hinzufügen** wählen und exakt diese Namen anlegen:
   `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_USER_ACCESS_TOKEN` und
   `TWITCH_USER_REFRESH_TOKEN`. Für den späteren Schreibvorgang muss außerdem
   `GITHUB_TOKEN` vorhanden sein.
4. Werte aus der registrierten Twitch-Anwendung beziehungsweise dem
   Authorization-Code-Flow für `motte025` einsetzen. Der User-Token muss den
   Scope `user:read:follows` besitzen. Client-Secret oder Token niemals hier im
   Repository, Chat oder Screenshot veröffentlichen.
5. Speichern, zum Code zurückkehren und erneut **nur `djTestLauf`** ausführen.
   `djTwitchUserIdErmitteln_` ist eine Hilfsfunktion und darf nicht direkt über
   das Funktionsmenü gestartet werden; direkt gestartet bekäme sie keine
   Argumente und meldet deshalb `Cannot read properties of undefined`.
6. Erst bei `"fehler":null` einmal `djTriggerEinrichten` ausführen.

`TWITCH_USER_ID` wird automatisch ermittelt. Ein Ergebnis mit `"live":[]` und
`"fehler":null` ist erfolgreich und bedeutet nur, dass gerade kein gefolgter
Music-Kanal live ist.

### Klare Aufgabenteilung

**Im Repository erledigt:** Follow-Endpunkt, Music-Filter, Token-Erneuerung,
automatische User-ID, Zufallsauswahl, 3-Minuten-Laufzeit, 30-Sekunden-Leerfall,
stummer Player und Fernbedienungs-QR.

**Einmalig vom Kontoinhaber zu erledigen:** kompromittierte Zugangsdaten
widerrufen, neue Client-/GitHub-Zugangsdaten erzeugen und einen Twitch-User-Token
für `motte025` per Authorization-Code-Flow mit `user:read:follows` genehmigen.
Ohne diese persönliche Zustimmung darf und kann kein Repository-Code die private
Follow-Liste abrufen.

### Twitch-Zugriff für `motte025`

Twitchs Endpunkt **Get Followed Streams** benötigt einen User-Token mit dem
Scope `user:read:follows`; ein App-Token kann die persönliche Folge-Liste nicht
lesen. Diese Werte müssen als Google-Apps-Script-Properties gesetzt werden:

| Property | Inhalt |
|---|---|
| `GITHUB_TOKEN` | PAT mit Schreibrecht auf dieses Repository |
| `TWITCH_CLIENT_ID` | Client-ID der Twitch-Anwendung |
| `TWITCH_CLIENT_SECRET` | Client-Secret der Twitch-Anwendung |
| `TWITCH_USER_ID` | optional; wird beim ersten Test automatisch ermittelt und gespeichert |
| `TWITCH_USER_ACCESS_TOKEN` | User-Access-Token mit `user:read:follows` |
| `TWITCH_USER_REFRESH_TOKEN` | zugehöriger Refresh-Token |

Access- und Refresh-Token dürfen **niemals** in GitHub-Dateien oder in die
Browser-Konfiguration eingetragen werden. Der Checker erneuert einen
abgelaufenen Access-Token serverseitig und speichert einen von Twitch rotierten
Refresh-Token wieder in den Script Properties.

Danach in Apps Script einmal `djTestLauf()` ausführen. Im Protokoll müssen nur
live gefolgte Music-Kanäle erscheinen. Erst dann `djTriggerEinrichten()` starten.

---

## Wie es zusammenhängt

| Teil | Wo | Aufgabe |
|---|---|---|
| Follow-Checker | `google-apps-script/dj-live-checker.gs` | liest mit dem User-Token die live gefolgten Music-Kanäle |
| Statusdatei | `live_status.json` | enthält ausschließlich die aktuell live gefolgten DJs |
| DJ-Live-Slot | `index.html` | zieht pro Zyklus einen Eintrag und zeigt ihn stumm für 180 Sekunden |
| Fernbedienung | `dj-fernbedienung.html` + Firebase | überschreibt die automatische Auswahl auf Wunsch vom Handy |

Das Dashboard fragt Twitch absichtlich **nicht direkt** ab. Ein User-Token im
Browser wäre für jeden Besucher lesbar. Nur das Apps Script kennt Token und
Secret; das Dashboard lädt ausschließlich `live_status.json`.

### Was als DJ gilt

Twitch liefert kein Feld „ist DJ“. Die automatische Auswahl verwendet deshalb
die Twitch-Kategorie **Music** (`game_id=26936`). Ein gefolgter Kanal in einer
anderen Kategorie wird nicht automatisch gezeigt, kann aber weiterhin über die
Handy-Fernbedienung ausgewählt werden.

### Einmalige Einrichtung

1. In Apps Script den bisherigen Inhalt von `Dj live checker.gs` vollständig
   markieren und löschen. Danach **nur den reinen Dateiinhalt** aus
   `google-apps-script/dj-live-checker.gs` einfügen – nicht die Git-Diff-Ansicht
   und keine Zeilen mit `+`, `-`, `diff --git` oder andere Diff-Markierungen übernehmen.

   Reine Datei im Branch:
   <https://raw.githubusercontent.com/motte025/City-cafe/work/google-apps-script/dj-live-checker.gs>
2. Die fünf Zugangsdaten setzen. `TWITCH_USER_ID` leer lassen; sie wird beim ersten Lauf automatisch ermittelt.
3. `djTestLauf()` ausführen und prüfen, ob die erwarteten live gefolgten
   Music-Kanäle im Protokoll stehen.
4. `djTriggerEinrichten()` ausführen. Der Trigger aktualisiert den Status alle
   fünf Minuten.
5. Erst nach einem erfolgreichen Checker-Lauf die Branch-Vorschau ohne
   `djtest` öffnen; dann wird wirklich die Follow-Liste statt eines erzwungenen
   Testkanals verwendet.

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
| `sekundenProKanal` | `180` | Standzeit des zufällig gewählten Live-DJs |
| `leerWarteSekunden` | `30` | Wartezeit ohne Live-DJ vor dem Überspringen |
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

Der Player wird schon im Slot davor gebaut (siehe unten) — 35 Sekunden vor dem
DJ-Slot. Genau daran lag der Autostart, und zwar an einer einzigen CSS-Zeile:

Ausgeblendete Ansichten stehen auf `visibility: hidden`, damit die Box sie nicht
umsonst zeichnet. Chrome nimmt einen **fremden Rahmen** darin aber komplett aus
dem Rendering — der Twitch-Player lief dort nie an, zeigte sein Play-Symbol und
blieb auch dabei, als die Ansicht später aufblendete. Auf dem Screen sah das so
aus, als würde das Dashboard es zwar versuchen, aber nichts anspringen.

`#media-view-djlive` ist deshalb von der Regel ausgenommen und wird dauerhaft
gezeichnet — dieselbe Ausnahme, die der Nightlife-Player aus demselben Grund
schon hatte. **Zu sehen ist trotzdem nichts:** `opacity: 0` bleibt, die Ansicht
ist nur nicht mehr aus dem Rendering genommen.

> Wer hier etwas ändert, muss `djSlotSichtbar()` mitdenken: die Funktion darf
> sich nicht mehr auf die `visibility` verlassen (die steht jetzt immer auf
> `visible`) und misst stattdessen die Deckkraft.

Ein Wächter stupst den Player zusätzlich beim Einblenden an und hält ihn danach
am Laufen — als Netz für Netzaussetzer und Werbeblöcke.

> **Am Gerät bestätigt (09.09.2026):** In Chrome auf der Box läuft das Bild
> seitdem von allein an, ohne jedes Zutun. Was dort noch fehlte, war
> ausschließlich der **Ton** — dafür musste einmal von Hand die Stummschaltung
> im Player aufgehoben werden. Siehe den nächsten Abschnitt: genau dafür ist
> die installierte App da.

### Warum YouTube von allein läuft und Twitch nicht

Auf demselben Screen, im selben Chrome, in derselben Seite: das
Nightlife-Widget startet sein YouTube-Video stumm von allein, und der
Twitch-Player daneben bleibt mit seiner Play-Taste stehen. Das ist kein Fehler
im Dashboard und keine Browser-Einstellung, die noch fehlt. Es ist **Twitchs
eigene Regel.** Wörtlich aus der offiziellen Embed-Doku, zum Parameter
`autoplay`:

> „If true, the video starts playing automatically, without the viewer clicking
> play. Minimum size requirements and visibility are necessary for autoplay to
> begin. **The exception is mobile devices, on which video cannot be played
> without user interaction.** Default: true."
>
> — <https://dev.twitch.tv/docs/embed/video-and-clips/>

Die Odroid-Box läuft unter Android und meldet sich dem Netz als Android-Gerät.
Für Twitch ist sie damit ein **Mobilgerät**, und die Ausnahme greift. YouTube
kennt keine solche Ausnahme: stumm startet dort jedes Video, auf jedem Gerät.

Das erklärt rückwirkend alles, woran wir uns festgebissen haben:

| Versucht | Warum es nichts geändert hat |
|---|---|
| `autoplay: true`, `muted: true` am Player | Twitch liest die Parameter und ignoriert sie auf Mobilgeräten. |
| `allow="autoplay"` am Rahmen | Regelt, was der **Browser** erlaubt. Twitch entscheidet innerhalb seines Rahmens selbst. |
| `player.play()` über das SDK | Wird als Nachricht an Twitchs Rahmen geschickt — und dort verworfen. |
| Player neu bauen | Der neue fängt bei null an und zeigt dieselbe Play-Taste. **Genau das war die Schleife.** |
| Kiosk-App mit `setMediaPlaybackRequiresUserGesture(false)` | Hebt die Sperre des **Browsers** auf, nicht die von Twitch. |
| `--autoplay-policy=no-user-gesture-required` | Dasselbe. |

**Was tatsächlich hilft: dem Gerät die Desktop-Kennung geben.**

In Chrome auf der Box: Menü **⋮ → „Desktop-Website"** ankreuzen, Seite neu
laden. Chrome schickt dann eine Desktop-Browserkennung, und zwar auch für alle
eingebetteten Rahmen — Twitchs Mobil-Erkennung greift nicht mehr, und der Player
startet wie auf einem PC. Die Einstellung merkt sich Chrome pro Seite.

> **Am Fernseher hängt kein Zeiger.** Das ist wichtig, weil es die zweite Hälfte
> der Antwort entwertet: „einmal in die Bildmitte klicken" setzt Maus oder
> Touch voraus, und ein Signage-Screen hat beides nicht. **„Desktop-Website"
> dagegen ist ein Menüpunkt** — mit dem Steuerkreuz erreichbar, ohne jeden
> Zeiger. Das ist der einzige Weg, der mit einer Fernbedienung allein
> funktioniert.
>
> Wer doch klicken will: eine **USB-Maus oder Air-Mouse** an die Box. Einmal
> genügt, danach hält der Start die ganze Sitzung.
>
> Das Dashboard fragt das selbst ab (`djZeigerDa()`, `pointer: none`) und
> schreibt auf den Knopf, was am jeweiligen Gerät überhaupt geht — statt zum
> Klicken zu raten, wo niemand klicken kann.

### Und in Lumify?

Dort ist Twitch eine Sackgasse. Lumify bietet **kein Browsermenü**, also keine
Desktop-Kennung, und **keinen Zeiger**, also keinen Klick in den Player. Beide
Wege sind zu, und das Dashboard kommt an Twitchs Entscheidung nicht heran.

Wer Twitch am Screen will, muss das Dashboard **in Chrome** betreiben —
Variante B in `KIOSK-SETUP.md`, die aus anderen Gründen ohnehin die bessere
ist (keine Werbung, keine Ruckler). Alternativ eine Kiosk-App mit eigener
User-Agent-Zeile.

Ob es gewirkt hat, sagt die Prüfseite: `autoplay-check.html` hat dafür die Karte
**„Twitch ohne Bedienung"**. Steht dort *nein — Twitch verweigert es hier*, gilt
das Gerät noch als mobil. In der Handy-Fernbedienung erscheint derselbe Befund
als Chip **📱 Twitch: kein Autostart**.

> Läuft das Dashboard über **Lumify** statt in Chrome, lässt sich die
> Browserkennung von außen nicht setzen — dann bleibt nur eine Kiosk-App, die
> eine eigene *User-Agent-Zeile* anbietet (Fully Kiosk kann das), oder der
> Betrieb über Chrome. Siehe `KIOSK-SETUP.md`.

**Solange das Gerät als mobil gilt, baut das Widget den Player nicht mehr neu**
(`djNeuaufbauErlaubt()`). Ein Neuaufbau kann dort nichts starten, wirft aber
jede bereits erfolgte Bedienung weg — er kann also nur verlieren. Am Screen sah
genau das so aus: kurz „Stream wird geladen", danach wieder die Play-Taste, und
das immer wieder.

### Einmal tippen, dann läuft es

Chrome lässt Wiedergabe erst zu, wenn die Seite **einmal bedient** wurde
(„sticky activation"). Danach gilt die Freigabe für die **ganze Sitzung** und
wird über `allow="autoplay"` auch an die eingebetteten Player weitergereicht.

Deshalb genügt **ein Tipp irgendwo auf dem Dashboard pro Chrome-Start** — nicht
pro Slot. Danach starten alle weiteren Streams von allein, mit Ton. Ein
Tastendruck zählt genauso (Fernbedienung am Fernseher).

### Der Start-Knopf für die Fernbedienung

Läuft der Stream nicht von allein an — kein Bild oder kein Ton —, blendet das
Widget unten im Player den Knopf **„Stream starten"** ein. Ein Druck auf **OK**
der TV-Fernbedienung startet **beides**, und die Freigabe gilt danach für die
**ganze Sitzung**, auch für alle folgenden Kanäle.

Der Druck startet den Player **sofort — und zwar stumm.** Der Ton kommt einen
Wächtertakt später über `djTonNachziehen`.

> **Warum nicht beides auf einmal?** Genau daran ist es einmal gescheitert. Stumm
> läuft der Player los, und das Aufdrehen einen Wimpernschlag später lässt Chrome
> ihn wieder **anhalten**, wenn hörbare Wiedergabe nicht erlaubt ist. Von außen
> sah das aus, als täte der Knopf gar nichts — dabei hatte er gestartet, und wir
> haben es selbst wieder abgewürgt. `djTonNachziehen` dreht erst auf, wenn das
> Bild nachweislich läuft, und dreht **zurück**, wenn der Browser ablehnt.

### Woran man erkennt, ob Ton überhaupt erlaubt ist

`djFreigabeErteilt` heißt bloß *„es wurde irgendwo getippt"*. Ob der Browser
daraufhin Ton zulässt, ist eine andere Frage — am Gerät gemessen bleibt der
`AudioContext` auch nach einem Tipp `suspended`.

`djTonMoeglich()` fragt deshalb zuerst diesen Kontext:

| `djTonProbe.state` | Bedeutung |
|---|---|
| `running` | hörbare Wiedergabe ist erlaubt |
| `suspended` | ist sie nicht — **gar nicht erst aufdrehen** |
| (noch keine Probe) | Indizien: `navigator.userActivation`, `display-mode` |

Lehnt der Browser den Ton nachweislich ab (`tonBlockiert`), hört auch der Knopf
auf, danach zu fragen — er läge sonst dauerhaft über einem Bild, das einwandfrei
läuft.

**Und wenn Twitch nicht reagiert, sagt der Knopf die Wahrheit.** `play()` geht
als Nachricht an Twitchs Rahmen, und dort entscheidet Twitchs Player, ob er sie
befolgt — auf einem Mobilgerät tut er es nicht (siehe *Warum YouTube von allein
läuft und Twitch nicht*). Deshalb prüft der Knopf nach `knopfNachfassenMs` nach:

* **Es läuft** → der Knopf bleibt weg, fertig.
* **Es läuft nicht** → der Knopf kommt zurück, aber mit anderer Aufschrift:
  **„Bitte ▶ in der Bildmitte"**, dazu der Hinweis auf „Desktop-Website".
  Gleichzeitig wandert der Fokus in Twitchs Rahmen — ein Tastendruck, der
  **dort** ankommt, ist die einzige Bedienung, die Twitchs Player als seine
  eigene anerkennt.

Gilt das Gerät von vornherein als mobil und lief noch kein Bild, steht die
ehrliche Aufschrift **sofort** da — der Knopf verspricht dann gar nicht erst
etwas, das er nicht halten kann.

> **Hier stand einmal: „baut der Knopf den Player neu".** Das war der Fehler,
> der uns im Kreis hat drehen lassen. Ein frischer Player startet auf einem
> Mobilgerät genauso wenig — der Knopf zeigte also kurz „Stream wird geladen"
> und danach wieder die Play-Taste. Der Neuaufbau ist deshalb aus dem Knopf
> entfernt und auf Mobilgeräten auch aus dem Wächter.

### Kanalwechsel

**Ein Wechsel baut keinen neuen Player mehr.** Derselbe Rahmen bleibt stehen und
bekommt nur einen anderen Kanal gesagt — `djKanalWechseln()` über
`Twitch.Player.setChannel()`, offiziell dokumentiert. Das gilt für alle drei
Wege in den Wechsel: die Rotation (`djZeigeEintrag`), eine geänderte Live-Liste
(`djVorpuffern`) und „Auf den Screen" von der Handy-Fernbedienung
(`djFernBefehlAusfuehren`).

Der Grund ist derselbe wie überall auf dieser Seite: ein **frisch gebauter**
Player fängt bei null an und zeigt auf einem Mobilgerät wieder Twitchs eigene
Play-Taste. Dass eben noch jemand gedrückt hat, hilft ihm nichts — die Bedienung
galt dem alten Rahmen, der gerade weggeworfen wurde. Genau das war die Meldung
aus dem Betrieb: *„wenn ich den Live-Stream wechsle, muss ich wieder am
Play-Zeichen starten, das ist ärgerlich."*

Bleibt der Player stehen, gilt die Bedienung weiter: **einmal starten genügt für
den ganzen Abend**, über alle Kanalwechsel hinweg.

Neu gebaut wird nur noch, wenn es nicht anders geht — YouTube-Eintrag, einfacher
Rahmen ohne SDK, oder es läuft noch gar kein Player. `djKanalWechseln()` meldet
das mit `false` zurück, und der Aufrufer baut dann wie früher.

### Und über die Rotation hinweg: der Player schläft, statt zu verschwinden

Ohne das wäre der Rest umsonst. Die Rotation **verlässt** den DJ-Slot alle paar
Minuten, und bisher räumte `djStopPlayer()` den Player dabei ab — die nächste
Runde baute einen neuen, und der zeigte auf einem Mobilgerät wieder Twitchs
Play-Taste. Einmal *pro Runde* von Hand starten ist keine Lösung.

Auf einem Gerät, das für Twitch als mobil gilt, wird der Player deshalb nicht
mehr weggeworfen, sondern **schlafen gelegt** (`djSpielerSchlafen()`): erst
stumm, dann anhalten — in dieser Reihenfolge, damit aus einem unsichtbaren Slot
nie Ton kommt. Kommt der Slot wieder, weckt ihn der übliche Anstupser.

Der Preis ist ein ruhender Rahmen im DOM. Stumm und angehalten kostet der so gut
wie nichts, und die DJ-Ansicht wird ohnehin dauerhaft gezeichnet (`opacity: 0`,
siehe *Autostart und Ton*).

> **Eine Falle, die dabei entsteht:** Früher hat `djStopPlayer()` auch
> `djGepuffert` geleert. Bleibt der Player liegen, bleibt die Liste liegen — und
> ein Slot ohne Live-Kanäle hätte beim nächsten Durchlauf einen längst beendeten
> Stream gezeigt. `djVorpuffern()` räumt deshalb ausdrücklich ab, wenn niemand
> mehr live ist.

**Am Desktop bleibt alles wie bisher:** dort startet Twitch von selbst, der
Player wird beim Verlassen des Slots abgeräumt und beim nächsten Mal neu
gebaut — das spart die Ressourcen und kostet nichts.

Der frisch gebaute Player wirft sich weiterhin selbst an, sobald er Befehle
annimmt (`Twitch.Player.READY`), und bringt den Ton gleich mit, falls der schon
freigeschaltet ist.

Ohne Freigabe läuft derselbe Weg trotzdem — dann eben stumm. Aufgedreht wird nur,
wenn der Browser es zulässt; sonst hielte er die Wiedergabe an und der Wechsel
machte es schlimmer statt besser.

Drei Dinge daran sind wichtig und leicht zu übersehen:

* Es ist ein echter `<button>`. Nur den kann das **Steuerkreuz** einer
  Fernbedienung anspringen — ein Hinweiskästchen aus `<div>` ist für sie nicht
  vorhanden.
* Er **holt sich den Fokus selbst**, sobald er erscheint. Sonst müsste man erst
  hinnavigieren, und auf einem Dashboard voller Kacheln weiß niemand, wie oft
  man dafür drücken muss.
* Er liegt **neben** dem Player, nicht darin — `djStopPlayer` leert den
  Player-Container komplett aus.

> **Ein Klick *im* Twitch-Player zählt nicht.** Der landet in Twitchs eigenem
> Rahmen und erreicht das Dashboard nie: das Bild bekommt Ton, die Seite aber
> keine Freigabe, und beim nächsten Kanal ist wieder alles stumm. Deshalb der
> eigene Knopf.

Er verschwindet, sobald Ton läuft, und kommt in derselben Sitzung nicht wieder.
Bewusst **kein** Vollbild-Overlay: es läge sonst ständig über dem Dashboard.

**Ganz ohne Bedienung** geht es nur so: das Dashboard **direkt in Chrome**
öffnen und über *Menü → „Zum Startbildschirm hinzufügen" / „App installieren"*
installieren, danach über dieses Symbol starten. Für eine so installierte Seite
erlaubt Chrome die Wiedergabe von sich aus — das ist die dokumentierte Regel für
Mobilgeräte. Das Manifest dafür liegt bereits im Repo, die Schritte stehen in
KIOSK-SETUP.md unter *Weg 1*.

> **Veralteter Rat, hier zur Klarstellung:** Früher stand an dieser Stelle
> `chrome://flags` → **Autoplay policy** → *No user gesture is required*. Diesen
> Schalter gibt es in der Flags-Oberfläche nicht mehr. Er hilft nicht mehr
> weiter, auch wenn er in älteren Anleitungen im Netz noch auftaucht.

**Im Lumify-Betrieb greift das alles nicht.** Dort läuft das Dashboard als Seite
*innerhalb* der Lumify-Seite — für Chrome zählt dann deren Installation und
deren Freigabe, nicht unsere. Siehe „In einer fremden Seite" weiter unten.

**Zur Autoplay-Freigabe**, weil sie lange als Verdächtiger galt: Chrome lässt
Wiedergabe in einem *fremden* Rahmen nur zu, wenn dieser `allow="autoplay"`
trägt. Unseren eigenen iframe stellen wir so ein — den Rahmen für das SDK baut
Twitch selbst. Im ausgelieferten `embed/v1.js` nachgesehen: **das SDK setzt
`allow="autoplay; fullscreen"` selbst**, noch bevor der Rahmen im Dokument
hängt. Daran lag es also nicht. Das Dashboard ergänzt die Freigabe nur noch,
falls sie einmal fehlen sollte — der SDK-Wert wird nie überschrieben.

Reicht das Anstupsen nicht, wird der Player nach `neustartNachSekunden` **neu
gebaut**, dann im laufenden, sichtbaren Slot. Höchstens `maxNeustarts` Versuche,
danach bleibt es dabei.

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

**Aufgedreht wird nur, wenn es eine Chance hat.** Das Dashboard fragt vorher, ob
der Browser den Ton überhaupt durchlässt — Seite schon bedient
(`navigator.userActivation`) oder als App gestartet (`display-mode`). Ist beides
nicht der Fall, bleibt es gleich stumm.

Der Grund: jeder aussichtslose Versuch kostete einen sichtbaren Aussetzer. Das
Aufdrehen hielt die Wiedergabe an, einen Takt später schaltete der Wächter
zurück — Bild weg, Bild wieder da, und das in jedem Slot aufs Neue, ohne je Ton
zu bekommen. Kommt später doch eine Bedienung, dreht der nächste Takt sofort auf.

> **Ein Klick *im* Player zählt nicht.** Er landet in Twitchs eigenem Rahmen und
> erreicht das Dashboard nie. Das Bild bekommt dann Ton, die Seite aber keine
> Freigabe — beim nächsten Kanal ist wieder alles stumm. Wer von Hand nachhelfen
> will, tippt **neben** den Player: Uhr, Ticker, Rand.

Ohne Bedienung gibt es Ton nur, wenn Chrome die Seite als **installierte App**
kennt — siehe oben unter „Einmal tippen, dann läuft es".

### Wenn das Bild nach Stunden einfriert

Ein Screen läuft die ganze Nacht. Netz kurz weg, Streamer startet neu, Player
verhakt sich — dann stand das Bild, und nur ein Neuladen half. Der Grund: sobald
ein Stream einmal lief, war der Neuaufbau oben abgeschaltet, und der Anstupser
allein holt keinen Player zurück, der die Verbindung verloren hat.

Steht das Bild jetzt länger als `haengerSekunden` **still**, obwohl es schon
lief, baut der Wächter den Player neu auf.

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `haengerSekunden` | `45` | so lange darf ein gelaufenes Bild stillstehen |
| `maxHaengerNeustarts` | `2` | danach bleibt es dabei — ein toter Kanal wird nicht endlos neu gebaut |

Die 45 Sekunden sind bewusst großzügig: ein Werbeblock darf nicht als Hänger
gelten. Alle Zähler überleben den Neuaufbau (`djNeuAufbauen`) — solange jeder
Pfad nur seinen eigenen rettete, setzte er den anderen auf 0 zurück und schenkte
ihm damit neues Budget.

Der Ton endet mit dem Slot, weil der Player dann abgeräumt wird — die übrigen
Widgets bleiben still.

### In einer fremden Seite (Lumify-Betrieb)

In Variante A aus KIOSK-SETUP.md läuft das Dashboard als Seite **innerhalb** der
Lumify-Seite. Der Twitch-Player steckt dann in einem Rahmen in einem Rahmen, und
daran hängen zwei Dinge, die im Direktbetrieb nie auffallen.

**1. Twitch will jede Ebene kennen.** Der `parent`-Parameter muss **alle**
umgebenden Domains enthalten, nicht nur die eigene. Fehlt eine, verweigert Twitch
die Einbettung — und zwar wortlos: der Rahmen bleibt einfach leer. Twitchs eigenes
Beispiel zeigt genau diesen Fall (`parent=aussen.example.com&parent=innen.example.com`).

Das Dashboard baut die Kette jetzt selbst: `djEmbedHosts()` liest die umgebenden
Seiten über `location.ancestorOrigins`, fällt sonst auf `document.referrer`
zurück und hängt zuletzt noch `zusaetzlicheParents` aus `DJ_LIVE_CONFIG` an
(dort steht `sign.lumifysignage.co.uk` als Reserve). Zusätzliche Einträge
schaden nicht — Twitch prüft nur, ob die tatsächliche Seite in der Liste steht.

**2. Wiedergabe muss durchgereicht werden.** Ob wir überhaupt abspielen dürfen,
entscheidet der Rahmen, in dem wir stecken: ohne `allow="autoplay"` **dort** ist
selbst stummes Abspielen gesperrt. Daran kann kein Code im Dashboard etwas
ändern — niemand kann ein Recht weiterreichen, das er selbst nicht hat.

Feststellen lässt es sich aber, statt zu raten:

* am Screen: `?origincheck=1` an die Adresse → Zeile **`Autoplay:`**
* am Handy: der Befund in der Statuskarte nennt diesen Fall zuerst

Steht dort *GESPERRT*, hilft nur eins von beidem:

* Lumify dazu bringen, sein Einbettungs-`iframe` mit `allow="autoplay"` zu
  versehen (Frage an deren Support — von uns aus nicht machbar), oder
* auf **Variante B** wechseln: Dashboard direkt in Chrome, als App installiert.
  Dann ist unsere Seite die oberste, und Bild **und** Ton laufen ohne Zutun.

**Ton ist im Lumify-Betrieb praktisch nicht zu bekommen**, selbst wenn das Bild
läuft: die „installierte App"-Regel gilt für die oberste Seite, und das ist dort
Lumify, nicht das Dashboard.

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
