# Firebase-Regeln für YouTube-Musik (Chef und Gäste)

Gehört zu `YOUTUBE-MUSIK-SETUP.md`, Abschnitt 4.1. Eingetragen wird von Hand in
der Firebase-Konsole (Realtime Database → Regeln). Die PIN kommt **nie** ins Repo.

## Stand am 02.10.2026 (gemessen, nicht gelesen)

Ein Test vom W1 aus zeigte: Jedes angemeldete Gerät darf unter `djremote/`
**alles** lesen und schreiben, auch `chef/pin`. Solange das so ist:

- kann sich jedes Handy mit **jeder** PIN als Chef anmelden,
- wäre eine eingetragene PIN für alle lesbar.

## Reihenfolge – wichtig

1. **Erst die Regeln** unten eintragen und veröffentlichen.
2. **Dann die PIN** anlegen: in der Konsole unter
   `djremote/city-cafe/chef/pin` einen Text-Wert, z. B. `"4711"`
   (Anführungszeichen = Text; die Handys schicken die PIN als Text).
   Für den Fernseher zuhause dasselbe unter `djremote/zuhause/chef/pin`.
3. **Dann den TV als Chef eintragen**: in
   `/home/citycafe/.config/citycafe.env` auf dem W1 die Zeile
   ```
   CITYCAFE_URL_EXTRA='&chefpin=4711'
   ```
   (mit den einfachen Anführungszeichen – sonst versteht die Shell das `&`
   falsch). Danach den Kiosk neu starten.

## Regeln

Firebase-Regeln wirken **von oben nach unten**: Was weiter oben erlaubt ist,
kann ein Zweig darunter nicht mehr verbieten. Steht in den heutigen Regeln bei
`djremote` oder `djremote/$raum` ein `.write`, muss es dort weg und auf die
einzelnen Zweige verteilt werden – sonst greift unten nichts. Am einfachsten:
die aktuellen Regeln aus der Konsole kopieren und Claude geben, dann kommt
eine vollständige Fassung zurück.

Die Teile für Musik und Chef (unter `djremote/$raum`):

```json
"chef": {
  "pin": { ".read": false, ".write": false },
  "geraete": {
    "$uid": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid && (!newData.exists() || newData.child('pin').val() === root.child('djremote/' + $raum + '/chef/pin').val())"
    }
  }
},
"yt": {
  ".read": "auth != null",
  "befehl": {
    ".write": "auth != null && newData.child('von').val() === auth.uid && (newData.child('aktion').val() === 'suche' || (newData.child('aktion').val() === 'musik' && newData.child('was').val() === 'zurueckziehen') || root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists())"
  },
  "wuensche": {
    "$id": {
      ".write": "auth != null && ((!data.exists() && newData.child('von').val() === auth.uid) || root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists())"
    }
  },
  "warteschlange": {
    ".write": "auth != null && root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists()"
  },
  "radio":    { ".write": "auth != null && root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists()" },
  "jetzt":    { ".write": "auth != null && root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists()" },
  "listen":   { ".write": "auth != null && root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists()" },
  "liste":    { ".write": "auth != null && root.child('djremote/' + $raum + '/chef/geraete/' + auth.uid).exists()" },
  "treffer":  { ".write": "auth != null" },
  "status":   { ".write": "auth != null" },
  "diagnose": { ".write": "auth != null" }
}
```

Abweichungen von der Spec, kurz begründet:

- **Abmelden** (`chef/geraete/<uid>` löschen) braucht `!newData.exists()` in der
  Schreibregel, sonst könnte ein Gerät seinen Eintrag nie wieder entfernen.
- **`yt/befehl`**: Gäste dürfen nur suchen und eigene Wünsche zurückziehen;
  alles andere (Überspringen, Stopp, Spulen, Ton, Pause, Vollbild, Playlist,
  Bluetooth, Video starten) nur Chef-Geräte. Die Spec nennt in 9.6 nur skip,
  stopp, spulen und ton – Bluetooth und Pause gehören aber genauso dem Chef.
  Jeder Befehl trägt `von` (die eigene uid), das prüft die Regel.
- **`yt/wuensche`**: Gäste legen nur neue Wünsche an (mit eigener uid); der TV
  (Chef) darf sie danach löschen bzw. mit `abgelehnt` beantworten.
- **`yt/listen`** (Playlist-Inhalte fürs Handy) und **`yt/liste`** (Dauerliste)
  schreibt nur ein Chef-Gerät – der TV bzw. das Chef-Handy.
- **`yt/status` und `yt/treffer`** schreibt der TV; sie bleiben vorerst offen,
  wie die Spec es für die alten Pfade vorsieht.

## Prüfen (Firebase-Simulator in der Konsole)

| Fall | erwartet |
|---|---|
| Gast schreibt `yt/wuensche/neu` mit `von` = eigene uid | erlaubt |
| Gast schreibt `yt/warteschlange/x` | verweigert |
| Gast schreibt `yt/befehl` mit `aktion: "musik", was: "skip"` | verweigert |
| Gast schreibt `yt/befehl` mit `aktion: "suche"` | erlaubt |
| Gerät schreibt `chef/geraete/<eigene uid>` mit falscher PIN | verweigert |
| Gerät schreibt `chef/geraete/<eigene uid>` mit richtiger PIN | erlaubt |
| Irgendwer liest `chef/pin` | verweigert |

Danach am Handy: unter „Mehr" mit falscher PIN → „Falsche PIN", mit richtiger
→ „👑 Chef". Und als Gast: Überspringen-Knopf gibt es nicht, ein
handgeschriebener Befehl würde abgewiesen.
