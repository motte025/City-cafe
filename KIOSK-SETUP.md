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

> Achtung: Das Dashboard laeuft hier als Seite *innerhalb* der Lumify-Seite. Fuer
> die Nightlife-Videos ist das egal. Falls der DJ-Live-Slot wieder aktiviert
> wird, muss `sign.lumifysignage.co.uk` zusaetzlich in den Twitch-`parent`
> eingetragen werden - dann Bescheid sagen.

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
