# Hos’n Obe (Trinkspiel V3) — Einrichtung

Das Spiel ist fertig gebaut, aber noch **abgeschaltet**: solange in
`hosn-obe-config.js` keine Firebase-Daten stehen, blendet das Dashboard
weder den QR-Code ein noch startet es eine Runde. Die restliche Rotation läuft
davon völlig unberührt weiter — du kannst das Repo also jederzeit
veröffentlichen, ohne dass etwas kaputtgeht.

Zum Aktivieren sind vier Schritte nötig. Dauer: ca. 10 Minuten.

---

## 1. Firebase-Projekt anlegen

1. Auf <https://console.firebase.google.com> mit einem Google-Konto anmelden.
2. **Projekt hinzufügen** → Name z. B. `city-cafe-hosnobe`.
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
   **`hosn-obe-config.js`** eintragen:

```js
firebase: {
    apiKey: 'AIza…',
    authDomain: 'city-cafe-hosnobe.firebaseapp.com',
    databaseURL: 'https://city-cafe-hosnobe-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'city-cafe-hosnobe',
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
   ("Hos’n Obe spielen").
2. Mit dem ersten Handy scannen → die laufende Rotation **hält sofort an**
   (sie springt nicht weiter, sondern friert an genau der Stelle ein). Das
   Handy fragt zuerst nach dem **Spielmodus**.
3. Modus antippen, dann die **Spieleranzahl** → am TV läuft der
   Lobby-Countdown, weitere Gäste scannen denselben QR-Code.
4. Nach dem Countdown wird ausgeteilt. Zuerst zieht jeder Platz eine offene
   Karte — die höchste beginnt. Danach sieht jedes Handy nur die eigenen drei
   Karten, der TV zeigt verdeckte Fächer und die offene Mitte.

Wählt niemand innerhalb von 20 Sekunden Modus bzw. Spieleranzahl, läuft die
Rotation exakt dort weiter, wo sie angehalten wurde.

### Was du beim Testen im Blick behalten solltest

- alle Spieleranzahlen 2–6 einmal durchspielen (die Sitzpositionen wechseln)
- Handy während des eigenen Zugs sperren → nach zwei Minuten wird übersprungen
- Handy-Seite neu laden → der Sitzplatz bleibt erhalten
- zwei Handys gleichzeitig scannen → beide bekommen verschiedene Plätze
- Pause/Fortsetzen mitten in einem Getränke-**Video** prüfen: es muss an
  derselben Sekunde weiterlaufen, nicht von vorn beginnen

---

## Einstellungen

Alles Weitere steht in `hosn-obe-config.js`:

| Einstellung | Bedeutung | Standard |
|---|---|---|
| `hostSelectSeconds` | Wartezeit auf die Spieleranzahl, danach zurück in die Rotation | 20 |
| `lobbySeconds` | Countdown, in dem die übrigen Gäste scannen können | 60 |
| `turnTimeoutSeconds` | Nach dieser Zeit wird ein Zug übersprungen | 120 |
| `revealSeconds` | Wie lange das Ergebnis am TV stehen bleibt | 30 |
| `starterSeconds` | Anzeige „wer beginnt“ (jeder zieht eine Karte, die höchste fängt an) | 7 |
| `swapWindowSeconds` | Zeit zum **Aufgehen** nach dem eigenen Tausch | 6 |
| `roundTargetSeconds` | Ziel-Spieldauer einer Runde; danach wird aufgedeckt | 95 |
| `botIdleStartSeconds` | Countdown, sobald das Widget im Zyklus erscheint; danach spielt der Computer allein | 60 |
| `botPlayerCount` | So viele Plätze besetzt der Computer beim Start aus dem Zyklus | 6 |
| `botMoveSeconds` | Denkpause zwischen zwei Computer-Zügen | 6 |
| `botLobbySeconds` | „Computer spielt, Gäste bekommen Karten“: so lange kann gescannt werden | 45 |
| `testFirstInCycle` | Hos’n Obe läuft als **erstes** Widget im Zyklus | `true` |
| `mobileUrl` | Adresse der Handy-Seite (steckt im QR-Code) | GitHub Pages |

**`testFirstInCycle` ist bewusst auf `true`** — so musst du beim Ausprobieren
nicht die ganze Rotation abwarten. Sobald du zufrieden bist, auf `false`
stellen: dann startet das Spiel nur noch über den permanenten QR-Code, egal
welches Widget gerade läuft.

---

## Spielregeln, wie sie umgesetzt sind

- 32er-Skat-Blatt, 2–6 Spieler, je 3 Handkarten, 3 offene Karten in der Mitte.
- **Wer beginnt, wird ausgespielt:** vor jeder Runde zieht jeder Platz eine
  offene Karte, die **höchste** tauscht als Erste. So fängt nicht immer
  derselbe an — unabhängig von der Spieleranzahl.
- Ein Zug: **eine** Karte tauschen, **alle drei** tauschen, oder **weitergeben**.
- **Aufgehen** (früher „Klopfen") beendet die Runde: jeder andere Spieler hat
  danach noch genau einen Zug, dann wird aufgedeckt. **Ab der zweiten Runde**
  geht Aufgehen jederzeit am eigenen Zug — mit oder ohne Tausch. Nach einem
  Tausch bleiben zusätzlich **6 Sekunden** Zeit, in denen der Zug beim
  Spieler bleibt, um doch noch aufzugehen.
- Eine Runde dauert rund **1:30 bis 2:00**. Läuft die Zeit ab
  (`roundTargetSeconds`), wird aufgedeckt, egal wie weit gespielt wurde.
- Wertung: gleiche Farbe wird addiert (Bube/Dame/König = 10, Ass = 11).
- **Drei gleiche Ränge** (z. B. drei Asse) = **30,5 Punkte** — knapp unter
  einem echten Feuer-Flush, aber ausdrücklich *kein* Feuer: es wird ganz
  normal weitergespielt.
- **Feuer** = drei Karten **derselben Farbe** mit genau 31 Punkten
  (Ass + zwei Zehner-Karten, in jeder Farbe möglich). Feuer **beendet die
  Runde sofort**: es wird nicht mehr getauscht, alle decken auf.
  *Wie oft Feuer vorkommt, lässt sich einstellen* — siehe `aceDrawChance`
  und `highCardDrawChance` in `hosn-obe-config.js`. Die Punkte und Regeln
  bleiben dabei unangetastet; hohe Karten bleiben nur öfter im ungenutzten
  Rest des Stapels liegen (im Spiel sind je nach Spieleranzahl ohnehin nur
  9 bis 21 der 32 Karten). Mit der Voreinstellung `0.5` endet rund jede
  vierte Computer-Runde mit Feuer statt jeder dritten — bei zwei Spielern
  nur jede vierzehnte, bei sechs Spielern noch jede zweite. Das Deck hat
  nur zwölf niedrige Karten (7/8/9), bei sechs Spielern sind aber 21 Karten
  im Spiel; mindestens neun hohe müssen also dabei sein.
- **Tischfeuer**: stehen die **drei Karten in der Mitte** selbst bei 31
  (derselbe Flush-Fall), gilt dasselbe — egal wessen Zug es gerade ist, alle
  decken sofort auf. Das gilt auch dann, wenn die Mitte erst durch einen
  Tausch auf 31 kommt, nicht nur beim Austeilen.
- **Normalfall:** die niedrigste Hand zahlt. Bei Gleichstand entscheidet die
  höchste Einzelkarte, danach die Farbrangfolge **Herz > Pik > Karo > Kreuz**.
  Da jede Karte im Deck einmalig ist, gibt es immer genau einen Verlierer.
- **Bei Feuer oder Tischfeuer** zahlen **alle unter 11 Punkten** — und
  zusätzlich der **Schwächste in jedem Fall**, auch wenn er darüber liegt.
- Liegt in der Mitte ein **Drilling oder drei gleiche Farben**, ist der
  Einzeltausch gesperrt: es gilt **alles oder nichts**. Man nimmt alle drei,
  geht auf oder gibt weiter.
- **„Weiter"** (abgeben ohne Tausch) darf jeder **einmal pro Runde** nutzen.
- Sind nach dem Lobby-Countdown weniger Gäste verbunden als gewählt, wird ab
  **zwei** Spielern trotzdem gespielt; darunter bricht die Runde ab.
- **Ablauf am Handy:** erst der **Spielmodus**, dann die **Spieleranzahl**.
  Drei Modi:
  1. *Gäste spielen selbst* — Lobby, wer bis zum Ablauf gescannt hat, spielt mit
     (ab zwei Spielern).
  2. *Computer spielt, Gäste bekommen Karten* — es müssen **alle** Decks vergeben
     werden: 45 Sekunden Zeit zum Scannen; fehlt jemand, geht es zurück zur
     Spieleranzahl. Gezogen wird vom Computer, gezahlt wird am Ende ganz normal.
  3. *Computer spielt allein* — startet sofort, ohne Lobby. Das ist auch die
     Spielart, die im Rotationszyklus von selbst anläuft.
- Nach dem Aufdecken steht am Handy **„Neues Spiel starten"** — damit geht es
  direkt zurück zur Modus-Auswahl.

Die Regeln stecken vollständig in `hosn-obe-engine.js` und sind mit
Regel-Checks abgesichert:

```bash
node hosn-obe-engine.test.js
```

Der Lauf prüft unter anderem alle 4960 möglichen Hände und 20 000 zufällige
Runden darauf, dass immer genau ein Verlierer feststeht.

---

## Dateien

| Datei | Zweck |
|---|---|
| `hosn-obe-config.js` | **Die einzige Datei, die du bearbeiten musst.** |
| `hosn-obe-engine.js` | Kartendeck, Wertung, Tie-Break, Feuer-Regel |
| `hosn-obe-engine.test.js` | Regel-Checks (`node hosn-obe-engine.test.js`) |
| `hosn-obe-net.js` | Firebase-Anbindung, anonyme Anmeldung, Sitzplatzvergabe |
| `hosn-obe.html` | Handy-Seite (Ziel des QR-Codes) |
| `cards/back_red.webp` | Kartenrückseite für alle verdeckten Karten |
| `hosn-obe-browser.test.js` | Browsertests (Handy + TV, `node hosn-obe-browser.test.js`) |
| `index.html` | TV-Widget, Pause/Fortsetzen der Rotation, QR-Overlay |
