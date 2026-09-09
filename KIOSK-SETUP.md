# Dashboard im Chrome-Kiosk auf Android TV

Warum ueberhaupt: In der Lumify-App laufen Werbung und Ruckler, in Chrome nicht.
Zwei verschiedene Engines - die App benutzt die **Android System WebView** (auf
Custom-ROMs oft Jahre alt), Chrome bringt seine eigene mit. Und Chrome ist im
Google-Konto angemeldet, also greift YouTube Premium.

## Zuerst der billigste Test (5 Minuten, ohne Umzug)

Bevor du irgendetwas umstellst:

**Einstellungen → Ueber → 7x auf „Build-Nummer" → Entwickleroptionen →
WebView-Implementierung → Chrome auswaehlen.**

Damit rendert *jede* WebView-App - auch Lumify - mit Chromes Engine. Wenn die
Ruckler danach weg sind, bist du fertig. Die **Werbung bleibt** (die WebView hat
einen eigenen, leeren Cookie-Speicher, ist also nicht im Premium-Konto).

Steht Chrome dort nicht zur Auswahl: **Play Store → „Android System WebView" →
Aktualisieren**, dann neu versuchen.


---

## Kiosk-App suchen, die Ton ohne Bedienung erlaubt

Der Autostart des Bildes ist geloest. Was bleibt, ist der **Ton**: Chrome laesst
hoerbare Wiedergabe erst zu, wenn die Seite einmal bedient wurde - und am
Screen steht niemand. Das ist eine Browserregel, im Dashboard nicht zu umgehen.

### Womit man eine App in 30 Sekunden beurteilt

`autoplay-check.html` im Repo faellt das Urteil selbst:

```
https://motte025.github.io/City-cafe/autoplay-check.html
```

Kandidaten-App installieren, diese Adresse aufmachen, **nichts antippen**. Oben
stehen zwei Zeilen, gross genug fuer den Fernseher:

| Zeile | Bedeutung |
|---|---|
| **Bild ohne Bedienung: ja** | Grundlage in Ordnung - stumm laeuft alles |
| **Bild ohne Bedienung: nein** | Die App sperrt Medien grundsaetzlich. Unbrauchbar. |
| **Ton ohne Bedienung: ja** | **Gesucht.** Diese App taugt fuer den Screen. |
| **Ton ohne Bedienung: nein** | Dieselbe Sperre wie in Chrome. Bringt nichts. |

Gemessen wird der Zustand eines frisch angelegten `AudioContext`: `running`
heisst, die App verlangt keine Bedienung, `suspended` heisst, sie tut es. Kein
Video, kein Codec, keine Leitung im Spiel - das Ergebnis kann also nicht durch
einen zweiten Fehler verfaelscht werden. Mit `?kanal=name` haengt die Seite
zusaetzlich einen echten Twitch-Player an.

### Was die Suche bisher ergeben hat

**Fully Kiosk Browser** - der naheliegende Kandidat, aber nach eigener Doku
nicht geeignet: seine Einstellung *Autoplay Videos* wirkt ausdruecklich nur
bei Seiten *"having a static `<video>` tag, not with Youtube"*. Twitch ist
derselbe Fall - ein fremder Rahmen mit eigenem Player, den ein Skript von
aussen nicht anfassen kann. Dazu warnt die Seite selbst, auf Android TV koenne
es *"restricted feature set or serious issues"* geben.

**Was technisch wirklich hilft:** Android-WebView kennt den Schalter
`setMediaPlaybackRequiresUserGesture(false)`. Im AOSP-Quelltext steht dazu nur
ein Satz - *"Sets whether the WebView requires a user gesture to play media.
The default is true."* Er gilt fuer die **ganze** WebView, fremde Rahmen
eingeschlossen, und wuerde damit Bild und Ton in einem Zug loesen. Eine
Kiosk-App, die diesen Schalter nach aussen gibt, ist die gesuchte App. Genau
danach muss die Suche gehen - nicht nach dem Wort "Autoplay" in der
Beschreibung, das meint meist nur den `<video>`-Trick von oben.

**Ohne neue App: Chrome per Kommandozeile.** Chrome auf Android liest Schalter
aus `/data/local/tmp/chrome-command-line`, wenn man es ihm erlaubt:

1. `chrome://flags/#enable-command-line-on-non-rooted-devices` → **Enabled**
2. Per adb (einmalig, USB oder `adb connect <ip>:5555`):
   ```
   adb shell "echo '_ --autoplay-policy=no-user-gesture-required' > /data/local/tmp/chrome-command-line"
   ```
   Der Unterstrich am Anfang muss sein - das erste Wort gilt als Programmname
   und wird verworfen.
3. Chrome komplett schliessen und neu starten, dann `autoplay-check.html`
   aufmachen: steht dort **Ton: ja**, ist es geschafft.

Das ist derselbe Schalter, den es frueher unter `chrome://flags` gab; aus der
Oberflaeche ist er verschwunden, als Kommandozeilenschalter existiert er
weiter. Es gibt Berichte, dass neuere Chrome-Fassungen ihn ignorieren - deshalb
misst man das Ergebnis, statt es anzunehmen.

> **Der Vollstaendigkeit halber:** Die Box ist ein Odroid. Laeuft darauf Linux
> statt Android, erledigt `chromium --kiosk --autoplay-policy=no-user-gesture-required`
> die Sache ohne jeden Umweg. Groesserer Umbau, aber der sicherste Weg.

---

## Variante A - Lumify Web Player in Chrome

Du behaeltst die ganze Lumify-Verwaltung (Zeitplaene, mehrere Screens,
Proof-of-Play) und bekommst trotzdem Chromes Engine.

1. **Web-Player-Link holen.** Im CMS: **Hilfe → Player herunterladen → „Web
   Player oeffnen"**. Oder dort **„Link kopieren"** und den Link auf der Box in
   Chrome einfuegen.
2. **In Chrome auf der Box oeffnen.** Der Player zeigt einen QR-Code und einen
   6-stelligen Kopplungscode.
3. **Koppeln.** Im CMS: **Bildschirme → Bildschirm hinzufuegen**, QR scannen
   oder den 6-stelligen Code eintippen. Der Tab meldet sich als neuer Bildschirm
   an.
4. **Playlist zuweisen** - dieselbe wie bisher, mit dem Dashboard als Webseite.
5. **Alten App-Bildschirm entfernen**, sonst zaehlt er weiter gegen dein
   Kontingent.

Dann unten weiter bei **Vollbild** und **Selbststart**.

> Achtung: Das Dashboard laeuft hier als Seite *innerhalb* der Lumify-Seite.
> Fuer die Nightlife-Videos ist das egal, fuer den DJ-Live-Slot nicht:
>
> * **Twitch-`parent`** - erledigt sich von selbst. Das Dashboard traegt jetzt
>   alle umgebenden Domains ein (`djEmbedHosts()`), `sign.lumifysignage.co.uk`
>   steht zusaetzlich als Reserve in `DJ_LIVE_CONFIG.zusaetzlicheParents`.
> * **Autoplay** - erledigt sich *nicht* von selbst. Ob wir abspielen duerfen,
>   entscheidet Lumifys Rahmen: ohne `allow="autoplay"` dort geht gar nichts,
>   auch nicht stumm. Pruefen mit `?origincheck=1` (Zeile `Autoplay:`).
>   **Ton** ist in dieser Variante praktisch nicht zu bekommen - dafuer muesste
>   die *oberste* Seite als App installiert sein, und das ist hier Lumify.
>
> Wer Ton am Screen will, nimmt Variante B.

---

## Variante B - Dashboard direkt in Chrome

Ohne Lumify. Der Screen zeigt nur das Dashboard - das tut er ohnehin schon.

1. In Chrome auf der Box oeffnen:
   ```
   https://motte025.github.io/City-cafe/?kiosk=1
   ```
2. Fertig. Kein Koppeln, kein CMS, keine zweite Seite dazwischen.

Was du dabei aufgibst: Zeitplaene, Fernwartung und Proof-of-Play aus Lumify.
Was du gewinnst: eine Ebene weniger, und das Dashboard kann sich selbst ins
Vollbild schalten (siehe unten).

---

## Vollbild

**`chrome --kiosk` gibt es unter Android nicht.** Das ist ein
Desktop-Kommandozeilen-Flag; die Android-Version kennt es nicht. Es gibt zwei
Wege, die wirklich funktionieren:

### Weg 1 (Variante B, der saubere) - als App installieren

Das Dashboard bringt jetzt ein Web-App-Manifest mit. Damit:

1. Dashboard in Chrome oeffnen.
2. **Menue (drei Punkte) → „Zum Startbildschirm hinzufuegen"** bzw.
   **„App installieren"**.
3. Ab jetzt ueber dieses Symbol starten: Chrome oeffnet es **ohne Adressleiste
   und ohne Tableiste**, im echten Vollbild - ohne dass jemand etwas druecken
   muss.

Der Startlink der installierten App enthaelt `?kiosk=1` bereits.

Zeigt der Android-TV-Startbildschirm keine solchen Verknuepfungen, hilft ein
Launcher, der sideloadete Apps und Verknuepfungen anzeigt (z. B. Projectivy oder
Sideload Launcher). Beim Autostart unten ist das ohnehin egal, weil der die App
direkt startet.

### Weg 2 (beide Varianten) - ein Druck auf die Fernbedienung

Die Fullscreen-API verlangt eine Eingabe - der Browser laesst eine Seite nicht
von allein Vollbild werden. Mit `?kiosk=1` in der Adresse genuegt **ein
einziger** Druck auf **OK** (oder ein Klick), dann ist Vollbild an und bleibt es.

Bei Variante A gilt das fuer die Lumify-Seite - ob sie das selbst anbietet,
steht in ihrer Anleitung unter „Als Dauerbetrieb-Kiosk ausfuehren".

---

## Selbststart nach dem Einschalten

Android TV startet von sich aus keine App mit einer URL. Du brauchst einen
Ausloeser. Der zuverlaessigste Weg ohne Root:

### Mit MacroDroid (oder Tasker)

1. **MacroDroid** installieren (sideload, laeuft auf Android TV).
2. Neues Makro anlegen:
   - **Ausloeser:** Geraeteereignisse → **Geraetestart abgeschlossen**
   - **Aktion 1:** Ablaufsteuerung → **Warten** → **60 Sekunden**
     *(sonst startet Chrome, bevor das LAN steht)*
   - **Aktion 2:**
     - Variante B mit installierter App: Anwendungen → **App starten** →
       *City Cafe*
     - sonst: Anwendungen → **Website oeffnen** → die URL von oben
3. Makro aktivieren, Box neu starten, pruefen.

### Alternative: Lumify Kiosk Launcher (nur Variante A)

Lumify hat einen eigenen Android-TV-Startbildschirm, der den Player automatisch
startet (**Hilfe-Hub → „Lumify Kiosk Launcher (Android TV)"**). **Vorher
klaeren:** ob er den *Web Player in Chrome* startet oder die *Lumify-App* - im
zweiten Fall bist du wieder bei der alten WebView und hast nichts gewonnen. Das
ist genau die Frage an den Support.

### Zum Testen per ADB (kein Autostart, aber sofort sichtbar)

```
adb connect <IP-der-Box>:5555
adb shell am start -a android.intent.action.VIEW \
  -d "https://motte025.github.io/City-cafe/?kiosk=1" com.android.chrome
```

---

## Bildschirm bleibt an

Das Dashboard haelt sich seit dieser Version **selbst wach** (Screen Wake Lock),
solange es sichtbar ist. Nach Bildschirmsperre oder Appwechsel holt es sich den
Wachzustand automatisch zurueck. Zusaetzlich in Android:

- **Einstellungen → Geraetevoreinstellungen → Bildschirmschoner → Aus**
- **Ruhezustand / Display abschalten → Nie**

## Werbung weg

Zwei Wege, sonst keiner:

1. **Chrome im Google-Konto mit YouTube Premium anmelden.** Premium haengt am
   Konto, nicht am Geraet. Kommt trotzdem Werbung, ist Chrome nicht angemeldet -
   das ist der ganze Unterschied zur App.
2. **Eigene MP4-Dateien** statt YouTube-Einbettung. Dann gibt es ueberhaupt
   keine Werbung, unabhaengig von Konto und Browser. Siehe
   [NIGHTLIFE-SETUP.md](NIGHTLIFE-SETUP.md).

## Wenn etwas nicht stimmt

| Symptom | Ursache | Abhilfe |
| --- | --- | --- |
| Werbung laeuft | Chrome nicht im Premium-Konto | anmelden, oder eigene Dateien |
| Ruckelt weiter | alte WebView / 4K-Ausgabe | WebView-Implementierung auf Chrome, HDMI auf 1080p |
| Kein Vollbild | `?kiosk=1` fehlt, oder nie gedrueckt | URL pruefen, einmal OK druecken, besser als App installieren |
| Bildschirm geht aus | Bildschirmschoner aktiv | siehe oben |
| Nach Neustart schwarz | Autostart zu frueh | Wartezeit im Makro auf 90 s erhoehen |
| Ruckelt nach Stunden | mehrere Tabs offen | genau **einen** Tab, im Vordergrund - Hintergrund-Tabs werden gedrosselt |

Zum Nachmessen, was YouTube wirklich liefert: `?nldiag=1` an die Adresse
haengen, siehe [NIGHTLIFE-SETUP.md](NIGHTLIFE-SETUP.md).
