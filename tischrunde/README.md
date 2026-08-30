# Tischrunde — Hos'n Obe

Der fertige Spieltisch für Hos'n Obe (Schwimmen / 31) als Einbau-Paket für die
Tischrunde-App. Zwei bis sechs Spieler treten über einen vierstelligen
Einladungscode an denselben Tisch — von überall, ohne gemeinsamen Fernseher.

Weil es keinen Fernseher mehr gibt, zeigt **jedes Handy beides**: die eigenen
drei Karten und den offenen Tischzustand (Mitte, Zugrecht, Klopfstand,
Restzüge, Sitzplätze).

---

## Was du kopierst

Den Ordner **`hosn-obe/`** nach `www/hosn-obe/` in dein Tischrunde-Projekt.
Vier Dateien, keine Abhängigkeiten außer dem Firebase-SDK:

| Datei | Zweck |
|---|---|
| `hosn-obe/hosnobe-config.js` | **Die einzige Datei, die du bearbeiten musst.** |
| `hosn-obe/hosnobe-engine.js` | Blatt, Wertung, Gleichstand, Feuer-Regel |
| `hosn-obe/hosnobe-net.js` | Realtime Database, anonyme Anmeldung, Sitzplätze |
| `hosn-obe/hosnobe-view.js` | Lobby und Spieltisch |
| `hosn-obe/hosnobe.css` | Optik, alles unter `#tr-hosnobe` |

Alles andere in diesem Ordner bleibt liegen — es ist zum Ausprobieren und
Prüfen da, nicht zum Ausliefern:

| Datei | Zweck |
|---|---|
| `demo.html` | Probetisch: ersetzt beim Testen die Spielauswahl |
| `test/engine.test.js` | Regel-Checks ohne Browser |
| `test/table.browser.test.js` | ganze Runde durch mehrere Tabs gespielt |
| `test/scenarios.browser.test.js` | Feuer, Drilling, volle Tische, Fehlerfälle |
| `test/firebase-localstorage-stub.js` | Testhilfe statt Firebase, siehe unten |

---

## 1. Einbauen

### Dateien einhängen

In den `<head>` deiner `www/index.html`:

```html
<link rel="stylesheet" href="hosn-obe/hosnobe.css">
```

Ans Ende des `<body>`, **vor** dein eigenes Skript mit `openGame()`:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>

<script src="hosn-obe/hosnobe-config.js"></script>
<script src="hosn-obe/hosnobe-engine.js"></script>
<script src="hosn-obe/hosnobe-net.js"></script>
<script src="hosn-obe/hosnobe-view.js"></script>
```

Die Reihenfolge zählt: erst Firebase, dann Konfiguration, dann Regelwerk, Netz
und Ansicht.

Die Schriften Big Shoulders Display, Inter und IBM Plex Mono lädt deine Hülle
bereits — der Spieltisch benutzt dieselben und bringt keine eigenen mit.

### Den Platzhalter ersetzen

In `openGame()` steht bisher der Kommentar
`// TODO: hook in real game screen / lobby-join flow here`. An diese Stelle
kommt:

```js
function openGame(id) {
    if (id === 'hosn-obe') {
        document.getElementById('spielauswahl').hidden = true;
        Tischrunde.HosnObe.open({
            onExit: function () {
                document.getElementById('spielauswahl').hidden = false;
            }
        });
        return;
    }
    // hier später die weiteren Spiele
}
```

`spielauswahl` durch die ID deiner Auswahl-Ansicht ersetzen. Mehr ist nicht
nötig: der Spieltisch legt seine eigene Ansicht über die Seite, es wird nichts
neu geladen und keine Seite gewechselt.

Der Pfeil oben links ruft `onExit` auf und blendet den Tisch aus — **der Platz
am Tisch bleibt dabei bestehen.** Wer kurz in die Spielauswahl schaut und
zurückkommt, sitzt weiter in derselben Runde. Wirklich weg ist man erst über
„Tisch verlassen" unten auf dem Spieltisch.

Es gibt außerdem `Tischrunde.HosnObe.destroy()` — das verlässt den Tisch und
räumt die Ansicht ab. Brauchst du nur, wenn du die App-Ansicht selbst komplett
zurücksetzen willst.

---

## 2. Firebase-Projekt anlegen

**Ein eigenes, neues Projekt** — nicht das des Café-Dashboards. Die beiden
Apps teilen sich weder Code noch Daten. Dauer: ungefähr zehn Minuten.

1. Auf <https://console.firebase.google.com> anmelden.
2. **Projekt hinzufügen** → Name z. B. `tischrunde`. Google Analytics kannst du
   abwählen, es wird nicht gebraucht.
3. Der kostenlose **Spark-Tarif** reicht dafür bei weitem. Keine Kreditkarte
   nötig.

### Realtime Database und anonyme Anmeldung

**Realtime Database** — nicht Firestore, das ist ein anderes Produkt:

1. **Build → Realtime Database** → **Datenbank erstellen**.
2. Standort: **europe-west1** (Belgien) ist von Österreich aus der kürzeste Weg.
3. Erst mal **„Im gesperrten Modus starten"** wählen; die richtigen Regeln
   kommen in Schritt 3.

**Anonyme Anmeldung**, damit jedes Handy ohne Login eine eigene Kennung bekommt:

1. **Build → Authentication** → **Erste Schritte**.
2. Reiter **Sign-in method** → **Anonym** → aktivieren → speichern.

### Zugangsdaten eintragen

1. Zahnrad oben links → **Projekteinstellungen** → Reiter **Allgemein**.
2. Ganz unten bei „Meine Apps" auf das **Web-Symbol `</>`** klicken.
3. Namen vergeben (z. B. `tischrunde`), **kein** Firebase Hosting auswählen,
   auf **App registrieren**.
4. Die Werte aus dem `firebaseConfig`-Block nach **`hosn-obe/hosnobe-config.js`**
   übertragen:

```js
firebase: {
    apiKey: 'AIza…',
    authDomain: 'tischrunde.firebaseapp.com',
    databaseURL: 'https://tischrunde-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'tischrunde',
    appId: '1:1234567890:web:abcdef…'
}
```

> Fehlt `databaseURL`, hast du die Realtime Database noch nicht angelegt. Die
> URL steht auch oben auf der Realtime-Database-Seite.

Diese Werte sind **keine Geheimnisse** — sie stehen bei jeder Firebase-Web-App
im Quelltext. Den Schutz übernehmen allein die Regeln aus dem nächsten Schritt.

---

## 3. Sicherheitsregeln

**Realtime Database → Reiter „Regeln"** → alles ersetzen durch:

```json
{
  "rules": {
    "rooms": {
      "$code": {
        "public": {
          ".read": "auth != null",
          ".write": "auth != null && (!data.exists() || data.child('players').child(auth.uid).exists() || newData.child('players').child(auth.uid).exists())"
        },
        "private": {
          "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            ".write": "auth != null && (auth.uid === $uid || root.child('rooms').child($code).child('public').child('dealerUid').val() === auth.uid)"
          }
        }
      }
    }
  }
}
```

Auf **Veröffentlichen** klicken.

Was die Regeln bewirken:

- `public/…` — Mitte, Zugrecht, Klopfstand, Restzüge, Spielerliste. Für
  angemeldete Geräte lesbar; das ist der Teil, den alle am Tisch sehen sollen.
  Schreiben darf nur, wer selbst am Tisch sitzt — oder gerade eintritt: der
  erste Teil der Bedingung erlaubt das Eröffnen eines noch leeren Tisches, der
  letzte das Beitreten, bei dem man sich in einem Zug selbst einträgt.
- `private/{uid}/hand` — **lesen darf ausschließlich das Handy, dem diese Hand
  gehört.** Schreiben darf zusätzlich der Geber, sonst könnte niemand
  austeilen — lesen darf er dort ausdrücklich **nicht**.
- Aufgedeckt wird erst am Rundenende, und dann veröffentlicht **jedes Handy
  seine eigene Hand selbst** nach `public/reveal`. Kein Gerät braucht je
  Leserecht auf einem fremden privaten Pfad.

> **Wichtig:** Setz kein `.read` auf die Ebene `$code`. In der Realtime
> Database vererbt sich ein Leserecht nach unten und lässt sich weiter innen
> nicht wieder entziehen — damit läge jede Hand offen.

Ein Tisch ist damit so privat wie sein Code: Vier Ziffern sind gegen Zuraten
kein Bollwerk, sondern eine Einladung unter Bekannten. Dass während einer
laufenden Runde niemand mehr dazukommt, prüft die App, nicht die Regel. Willst
du längere Codes, stell `codeLength` in `hosnobe-config.js` höher — der Rest
passt sich an.

---

## 4. Ausprobieren

### Ohne Firebase

`demo.html` über einen lokalen Webserver öffnen (nicht per Doppelklick — der
`file://`-Modus sperrt den localStorage):

```bash
npx http-server tischrunde -p 8080
# dann http://localhost:8080/demo.html
```

Solange in `hosnobe-config.js` keine `databaseURL` steht, schaltet der
Probetisch auf eine **Testhilfe im localStorage** um. Mehrere Tabs desselben
Browsers sind dann die Mitspieler: im ersten Tab einen Tisch eröffnen, den
Code im zweiten und dritten eintippen, losspielen.

Dabei läuft **derselbe Netzcode** wie später gegen die echte Datenbank — nur
der Speicher darunter ist ein anderer. Was die Testhilfe *nicht* nachbildet,
sind die Sicherheitsregeln: der Schutz der Handkarten hängt an Schritt 3, nicht
am Stub.

### Mit Firebase

Zugangsdaten eintragen, App auf zwei Geräte bringen, auf einem einen Tisch
eröffnen, den Code auf dem anderen eintippen.

**Für Capacitor:** die drei `gstatic.com`-Skripte werden zur Laufzeit geladen,
die App braucht also beim Start Netz. Willst du das nicht, lade die drei
Dateien einmal herunter, leg sie neben die anderen und zeig mit relativen
Pfaden darauf. In der Liste der autorisierten Domains (Authentication →
Settings) muss `localhost` stehen — das ist die Voreinstellung.

### Prüfläufe

```bash
node tischrunde/test/engine.test.js              # Regeln, ohne Browser
node tischrunde/test/table.browser.test.js       # ganze Runde über drei Tabs
node tischrunde/test/scenarios.browser.test.js   # Feuer, Drilling, Grenzfälle
```

Die beiden Browsertests brauchen Playwright und einen Chromium. Der erste
Lauf prüft unter anderem alle 4960 möglichen Hände und 50 000 zufällige Runden
darauf, dass die Verliererermittlung immer aufgeht.

---

## Wie die Regeln umgesetzt sind

- 32er-Blatt von der Sieben bis zum Ass, französische Farben. Jeder hat drei
  Karten, drei liegen offen in der Mitte. Der Rest bleibt liegen.
- Ein Zug: **eine Karte tauschen**, **alle drei tauschen** oder **klopfen**.
  Tauschen geht durch Antippen — erst die eigene Karte, dann die aus der Mitte
  (oder umgekehrt); der Tausch löst dann sofort aus.
- **Klopfen** schließt die Runde: jeder andere hat danach noch **genau einen
  Zug**, dann wird aufgedeckt. Die Restzüge stehen im Statusband.
- Gewertet wird die **höchste Kartensumme innerhalb einer Farbe**.
  Bube, Dame und König zählen 10, das Ass 11, Zahlenkarten ihren Wert.
- **Drei gleiche Ränge** — auch drei Asse — zählen pauschal **31** und sind
  ausdrücklich **kein Feuer**. Es wird ganz normal weitergespielt.
- **Feuer** sind drei Karten **derselben Farbe** mit genau 31, also ein Ass
  plus zwei Zehnerkarten. Feuer **beendet die Runde sofort**, sobald es
  aufgedeckt wird — auch direkt nach dem Austeilen. Dann verlieren **alle
  unter zwölf Punkten**; das können null, ein oder mehrere Spieler sein.
- **Sonst verliert genau einer:** die niedrigste Hand. Bei Gleichstand
  entscheidet zuerst der höchste einzelne **Kartenrang**, danach die
  Farbrangfolge **Herz > Pik > Karo > Kreuz**. Weil jede Karte im Blatt nur
  einmal vorkommt, löst sich der Gleichstand immer auf.
- Die schwächste überhaupt mögliche Hand hat **8 Punkte** — sieben ginge nur
  mit drei Siebenern, und die sind ein Drilling und zählen 31.

Der Geber **wechselt jede Runde** einen Platz weiter; wer anfängt, sitzt links
vom Geber. In der ersten Runde wird der Geber ausgelost.

---

## Wie das Zusammenspiel funktioniert

Es gibt keinen Server, der Recht spricht — die Realtime Database speichert nur.
Die Züge schreiben die Handys selbst, und zwar immer nur das, das gerade am Zug
ist. Für eine Tischrunde unter Bekannten reicht das; ein Mitspieler, der die
App umbaut, ließe sich damit aber nicht aufhalten.

Ein Punkt, den du kennen solltest: **das Gerät des Gebers erzeugt beim
Austeilen alle Hände** und kennt sie in dem Moment zwangsläufig. Der Code
behält oder zeigt sie nirgends, und die Regeln verwehren dem Geber das
Nachlesen — aber ausschließen lässt sich das ohne Server nicht. Deshalb
**rotiert der Geber jede Runde**, statt beim Gastgeber zu bleiben.

Was sonst noch abgefangen ist:

- Wer die App schließt, wird als abgemeldet geführt und beim Reihum
  übersprungen.
- Bleibt ein Zug hängen, darf ihn nach 45 Sekunden jeder am Tisch weitergeben.
- Wer mitten in der Runde geht, gibt den Zug ab; bleiben weniger als zwei
  Spieler übrig, geht der Tisch zurück in die Lobby.
- Wer die Seite neu lädt, landet über denselben Code wieder auf seinem Platz.
- Deckt ein Handy nicht auf, wird acht Sekunden gewartet und danach ohne diese
  Hand gewertet.

Alte Tische bleiben in der Datenbank stehen, bis der letzte Spieler sie
verlässt — dann löschen sie sich selbst. Sollte doch etwas liegen bleiben,
kannst du `rooms/` in der Firebase-Konsole gefahrlos leeren, solange gerade
niemand spielt.
