# DJ-Fernbedienung — Einrichtung

Steuert den DJ-Slot am Screen vom Handy oder Tablet: **Kanal**, **Auflösung**,
**Laufzeit** — und startet ihn sofort, ohne die Rotation abzuwarten.

Auf dem Screen steht dafür ein kleiner QR-Code in der Kopfzeile des
DJ-Widgets. Scannen, Kanal antippen, *Auf den Screen*.

---

## Wie es zusammenhängt

| Teil | Wo | Aufgabe |
|---|---|---|
| `dj-fernbedienung.html` | Handy/Tablet | Bedienung |
| `dj-fernbedienung-config.js` | dieses Repo | Firebase, Twitch-Client-ID, Auswahlmöglichkeiten |
| `dj-fernbedienung-net.js` | dieses Repo | die paar Zeilen Firebase, die beide Seiten teilen |
| Firebase Realtime Database | Google | Briefkasten zwischen Handy und Screen |
| DJ-Live-Slot | `index.html` | führt aus, was ankommt |

Das Handy schreibt **nur** `djremote/<raum>/befehl`, der Screen **nur**
`djremote/<raum>/status`. Je Pfad genau eine Schreibrichtung — dadurch können
sich beide nicht gegenseitig überschreiben, auch wenn mehrere Handys
gleichzeitig scannen.

> Es läuft im **selben** Firebase-Projekt wie Hos'n Obe. Ein zweites
> anzulegen bräuchte niemand; die Pfade liegen getrennt nebeneinander
> (`games/…` dort, `djremote/…` hier).

---

## 1. Twitch-Anwendung: Redirect-URL eintragen

Die Client-ID steht schon in `dj-fernbedienung-config.js`. Damit der Login
funktioniert, muss die **Adresse der Handy-Seite** bei Twitch hinterlegt sein:

1. <https://dev.twitch.tv/console/apps> → eigene Anwendung → **Verwalten**
2. Unter **OAuth Redirect URLs** hinzufügen:
   `https://motte025.github.io/City-cafe/dj-fernbedienung.html`
3. **Speichern**

Ohne diesen Eintrag bricht Twitch den Login mit *redirect_uri mismatch* ab.
Die Seite funktioniert dann trotzdem — nur eben mit den fest eingetragenen
Kanälen aus `dj_channels.json` statt mit deiner Folge-Liste.

> **Warum kein Client-Secret?** Die Fernbedienung meldet **dich** an, nicht die
> App. Dafür genügt die öffentliche Client-ID; das Token entsteht direkt im
> Browser und bleibt dort. Das Secret gehört ausschließlich ins Apps Script
> (siehe DJ-LIVESTREAM-SETUP.md) und **niemals** in dieses Repo.

**Was mit deinem Twitch-Zugang passiert:** die Anmeldung fragt nur das Recht
`user:read:follows` ab — lesen, wem du folgst. Kein Schreibrecht, kein Chat,
kein Zugriff auf dein Konto. Das Token liegt in der `sessionStorage` des
Handys und ist weg, sobald du den Tab schließt.

---

## 2. Firebase-Regeln ergänzen

**Das ist der Schritt, ohne den nichts geht.** Die vorhandenen Regeln decken
nur `games/` ab, alles andere ist standardmäßig gesperrt.

**Firebase-Konsole → Realtime Database → Reiter „Regeln"** → **alles markieren
und durch das Folgende ersetzen.** Es enthält die bestehenden `games`-Regeln
bereits mit — nicht darunter oder darüber einfügen, sondern den ganzen Inhalt
austauschen:

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
    },
    "djremote": {
      "$raum": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

Auf **Veröffentlichen** klicken.

> **`Line 19: Parse error`?** Dann steht der neue Block *unter* dem alten, und
> die Datei enthält zwei JSON-Objekte hintereinander. Erlaubt ist genau eines:
> alles markieren, löschen, den Block oben einmal komplett einfügen.

`auth != null` heißt: nur angemeldete Geräte. Beide Seiten melden sich anonym
an — das passiert von selbst, niemand muss ein Konto anlegen. Wer die
Dashboard-Adresse kennt, kann damit den Screen steuern; im Lokal ist das
gewollt, im offenen Netz solltest du es wissen.

---

## 3. Ausprobieren

1. Dashboard öffnen — in der Kopfzeile des DJ-Widgets steht der QR-Code
2. Mit dem Handy scannen
3. *Mit Twitch anmelden* → deine Folge-Liste erscheint, **wer gerade live ist,
   steht oben**
4. Kanal antippen, Laufzeit und Auflösung wählen, *Auf den Screen*

Der Screen springt sofort in den DJ-Slot. Oben auf dem Handy steht, was läuft
und wie lange noch.

Erscheint **kein QR-Code**, ist Firebase nicht erreichbar — meist fehlt der
`djremote`-Block aus Schritt 2.

---

## 4. Was eingestellt werden kann

| Einstellung | Auswahl |
|---|---|
| **Laufzeit** | 2 Min · 5 · 15 · 30 · 1 Std · 2 Std · 4 Std · **Bis offline** |
| **Auflösung** | Auto · 480p · 720p · 1080p |
| **Kanal** | Folge-Liste, fest eingetragene Kanäle, oder Name von Hand eintippen |

**„Bis offline"** endet, sobald der Streamer aufhört — das meldet der Player
selbst über sein `OFFLINE`-Ereignis, es braucht dafür keinen API-Abruf. Bleibt
das Ereignis aus (Netz weg, Player hängt), greift nach acht Stunden eine
Notbremse und die Rotation läuft weiter.

**Auflösung:** *Auto* ist meist die beste Wahl — Twitch passt laufend an die
Leitung an. Eine feste Stufe schaltet das ab: reicht die Bandbreite nicht,
bleibt das Bild stehen statt herunterzuschalten.

Während die Fernbedienung läuft, hat sie **Vorrang** vor dem Checker und vor
`?djtest`. Nach Ablauf oder nach *Stopp* übernimmt wieder der Automatismus.

Die Auswahlmöglichkeiten stehen in `dj-fernbedienung-config.js` unter
`laufzeiten` und `qualitaeten` und lassen sich dort ändern.

---

## 5. Mehrere Screens

`raum` in `dj-fernbedienung-config.js` benennt den Screen (Standard
`city-cafe`). Bei mehreren Screens bekommt jeder einen eigenen Namen; die
Handy-Seite spricht dann über `?raum=…` genau einen davon an. Aktuell ist nur
ein Screen eingerichtet.

---

## 6. Wenn etwas nicht funktioniert

**Kein QR-Code am Screen**
Firebase nicht erreichbar oder Regeln fehlen — Schritt 2 prüfen. Das Dashboard
läuft dann bewusst ohne Fernbedienung weiter, statt Fehler zu werfen.

**Handy zeigt „Konnte nicht senden — Datenbank-Regeln prüfen"**
Der `djremote`-Block fehlt oder ist falsch geschrieben. Schritt 2.

**Handy zeigt „Screen meldet sich noch nicht"**
Das Dashboard läuft nicht, oder es ist auf einem anderen `raum` eingestellt.

**Twitch-Login bricht ab (`redirect_uri mismatch`)**
Die Redirect-URL aus Schritt 1 fehlt — sie muss **exakt** stimmen, inklusive
`https://` und Groß-/Kleinschreibung.

**Folge-Liste bleibt leer**
Token abgelaufen (nach dem Schließen des Tabs normal) — einfach neu anmelden.
Die Seite fällt in dem Fall selbst auf die festen Kanäle zurück.

**Stream startet am Screen nicht von allein**
Die Fernbedienung sagt dir jetzt selbst, woran es hängt — der Befund steht in
der roten Zeile der Statuskarte, samt Bild-, Ton- und Qualitätsmerkmalen.

Steht dort *„Chrome am Screen verlangt eine Bedienung"*: Chrome lässt
Wiedergabe erst zu, wenn die Seite einmal bedient wurde. **Am Fernseher gibt es
nichts zu tippen** — dort zählt ein Tastendruck auf der TV-Fernbedienung,
während das Dashboard im Vordergrund ist. Einmal pro Chrome-Start.

**Dauerhaft aus der Welt** (und der einzige Weg im echten Signage-Betrieb, wo
niemand am Gerät steht): `chrome://flags` → **Autoplay policy** → *No user
gesture is required*, danach Chrome komplett schließen und neu starten.
