# Kartentausch (Trinkspiel V3) — Einrichtung

Das Spiel ist fertig gebaut, aber noch **abgeschaltet**: solange in
`kartentausch-config.js` keine Firebase-Daten stehen, blendet das Dashboard
weder den QR-Code ein noch startet es eine Runde. Die restliche Rotation läuft
davon völlig unberührt weiter — du kannst das Repo also jederzeit
veröffentlichen, ohne dass etwas kaputtgeht.

Zum Aktivieren sind vier Schritte nötig. Dauer: ca. 10 Minuten.

---

## 1. Firebase-Projekt anlegen

1. Auf <https://console.firebase.google.com> mit einem Google-Konto anmelden.
2. **Projekt hinzufügen** → Name z. B. `city-cafe-kartentausch`.
   Google Analytics kannst du abwählen, es wird nicht gebraucht.
3. Der kostenlose **Spark-Tarif** reicht für diesen Anwendungsfall bei weitem.
   Es wird keine Kreditkarte verlangt.

## 2. Realtime Database + anonyme Anmeldung aktivieren

**Realtime Database** (nicht Firestore — das ist ein anderes Produkt):

1. Links im Menü **Build → Realtime Database** → **Datenbank erstellen**.
2. Standort: **europe-west1** (Belgien) — kürzeste Wege von Klagenfurt aus.
3. Sicherheitsregeln: erst mal **"Im gesperrten Modus starten"** wählen;
   die richtigen Regeln kommen in Schritt 4.

**Anonyme Anmeldung** (damit jedes Handy ohne Login eine eigene Kennung bekommt):

1. Links im Menü **Build → Authentication** → **Erste Schritte**.
2. Reiter **Sign-in method** → **Anonym** → aktivieren → speichern.

## 3. Zugangsdaten eintragen

1. Zahnrad oben links → **Projekteinstellungen** → Reiter **Allgemein**.
2. Ganz unten bei "Meine Apps" auf das **Web-Symbol `</>`** klicken.
3. Namen vergeben (z. B. `dashboard`), **kein** Firebase Hosting auswählen,
   auf **App registrieren**.
4. Es erscheint ein `firebaseConfig`-Block. Die fünf Werte daraus in
   **`kartentausch-config.js`** eintragen:

```js
firebase: {
    apiKey: 'AIza…',
    authDomain: 'city-cafe-kartentausch.firebaseapp.com',
    databaseURL: 'https://city-cafe-kartentausch-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'city-cafe-kartentausch',
    appId: '1:1234567890:web:abcdef…'
}
```

> Fehlt `databaseURL` im angezeigten Block, hast du die Realtime Database noch
> nicht angelegt (Schritt 2). Die URL steht auch oben auf der
> Realtime-Database-Seite.

Diese Werte sind **keine Geheimnisse** — sie stehen bei jeder Firebase-Web-App
im Quelltext. Den Schutz übernehmen allein die Regeln aus Schritt 4.

## 4. Sicherheitsregeln setzen

**Realtime Database → Reiter "Regeln"** → alles ersetzen durch:

```json
{
  "rules": {
    "games": {
      "$sessionId": {
        "public": {
          ".read": true,
          ".write": "auth != null"
        },
        "private": {
          "$seatIndex": {
            ".read": "auth != null && root.child('games/' + $sessionId + '/public/seats/' + $seatIndex + '/uid').val() === auth.uid",
            ".write": "auth != null && (root.child('games/' + $sessionId + '/public/seats/' + $seatIndex + '/uid').val() === auth.uid || root.child('games/' + $sessionId + '/public/dealerUid').val() === auth.uid)"
          }
        }
      }
    }
  }
}
```

Auf **Veröffentlichen** klicken.

Was die Regeln bewirken:

- `public/…` — Spielstand, Mittenkarten, wer am Zug ist. Für alle lesbar, das
  ist der öffentliche Teil, den auch der TV anzeigt.
- `private/{sitzplatz}/hand` — **lesen darf ausschließlich das Handy, dem
  dieser Sitzplatz gehört.** Kein anderes Handy, und auch der Fernseher nicht:
  der TV hat auf diesem Pfad bewusst nur Schreib-, aber kein Leserecht. Er
  braucht es zum Austeilen, sieht die Karten danach aber nie wieder.
- Aufgedeckt wird erst am Rundenende, und dann veröffentlicht **jedes Handy
  seine eigene Hand selbst** nach `public/revealedHands`.

---

## 5. Testen

Nach dem Eintragen der Daten und einem Push:

1. Dashboard am TV neu laden. Unten links erscheint ein kleiner QR-Code
   ("Kartentausch spielen").
2. Mit dem ersten Handy scannen → die laufende Rotation **hält sofort an**
   (sie springt nicht weiter, sondern friert an genau der Stelle ein). Das
   Handy fragt nach der Spieleranzahl.
3. Spieleranzahl antippen → am TV läuft der Lobby-Countdown, weitere Gäste
   scannen denselben QR-Code.
4. Nach dem Countdown wird ausgeteilt. Jedes Handy sieht nur die eigenen drei
   Karten, der TV zeigt verdeckte Fächer und die offene Mitte.

Wählt niemand innerhalb von 20 Sekunden eine Spieleranzahl, läuft die Rotation
exakt dort weiter, wo sie angehalten wurde.

### Was du beim Testen im Blick behalten solltest

- alle Spieleranzahlen 2–6 einmal durchspielen (die Sitzpositionen wechseln)
- Handy während des eigenen Zugs sperren → nach 20 s wird übersprungen
- Handy-Seite neu laden → der Sitzplatz bleibt erhalten
- zwei Handys gleichzeitig scannen → beide bekommen verschiedene Plätze
- Pause/Fortsetzen mitten in einem Getränke-**Video** prüfen: es muss an
  derselben Sekunde weiterlaufen, nicht von vorn beginnen

---

## Einstellungen

Alles Weitere steht in `kartentausch-config.js`:

| Einstellung | Bedeutung | Standard |
|---|---|---|
| `hostSelectSeconds` | Wartezeit auf die Spieleranzahl, danach zurück in die Rotation | 20 |
| `lobbySeconds` | Countdown, in dem die übrigen Gäste scannen können | 60 |
| `turnTimeoutSeconds` | Nach dieser Zeit wird ein Zug übersprungen | 20 |
| `revealSeconds` | Wie lange das Ergebnis am TV stehen bleibt | 12 |
| `testFirstInCycle` | Kartentausch läuft als **erstes** Widget im Zyklus | `true` |
| `mobileUrl` | Adresse der Handy-Seite (steckt im QR-Code) | GitHub Pages |

**`testFirstInCycle` ist bewusst auf `true`** — so musst du beim Ausprobieren
nicht die ganze Rotation abwarten. Sobald du zufrieden bist, auf `false`
stellen: dann startet das Spiel nur noch über den permanenten QR-Code, egal
welches Widget gerade läuft.

---

## Spielregeln, wie sie umgesetzt sind

- 32er-Skat-Blatt, 2–6 Spieler, je 3 Handkarten, 3 offene Karten in der Mitte.
- Ein Zug: **eine** Karte tauschen, **alle drei** tauschen, oder **schließen**.
  Nach dem Schließen hat jeder andere Spieler noch genau einen Zug.
- Wertung: gleiche Farbe wird addiert (Bube/Dame/König = 10, Ass = 11).
- **Drei gleiche Ränge** (z. B. drei Asse) = **31 Punkte**, aber ausdrücklich
  *kein* Feuer — es wird ganz normal weitergespielt.
- **Feuer** = drei Karten **derselben Farbe** mit genau 31 Punkten
  (Ass + zwei Zehner-Karten, in jeder Farbe möglich). Auch hier kein
  vorzeitiges Rundenende, nur ein Highlight am TV.
- **Normalfall:** die niedrigste Hand zahlt. Bei Gleichstand entscheidet die
  höchste Einzelkarte, danach die Farbrangfolge **Herz > Pik > Karo > Kreuz**.
  Da jede Karte im Deck einmalig ist, gibt es immer genau einen Verlierer.
- **Bei Feuer** gilt das nicht: dann zahlen **alle Spieler unter 12 Punkten** —
  das können auch null oder mehrere sein.
- Sind nach dem Lobby-Countdown weniger Gäste verbunden als gewählt, wird ab
  **zwei** Spielern trotzdem gespielt; darunter bricht die Runde ab.

Die Regeln stecken vollständig in `kartentausch-engine.js` und sind mit
Regel-Checks abgesichert:

```bash
node kartentausch-engine.test.js
```

Der Lauf prüft unter anderem alle 4960 möglichen Hände und 20 000 zufällige
Runden darauf, dass immer genau ein Verlierer feststeht.

---

## Dateien

| Datei | Zweck |
|---|---|
| `kartentausch-config.js` | **Die einzige Datei, die du bearbeiten musst.** |
| `kartentausch-engine.js` | Kartendeck, Wertung, Tie-Break, Feuer-Regel |
| `kartentausch-engine.test.js` | Regel-Checks (`node kartentausch-engine.test.js`) |
| `kartentausch-net.js` | Firebase-Anbindung, anonyme Anmeldung, Sitzplatzvergabe |
| `kartentausch.html` | Handy-Seite (Ziel des QR-Codes) |
| `cards/back.webp` | Kartenrückseite (City-Cafe-Logo, neu erzeugt) |
| `index.html` | TV-Widget, Pause/Fortsetzen der Rotation, QR-Overlay |
