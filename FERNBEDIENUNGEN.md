# Die Fernbedienungen am Handy

Alles läuft über **eine Adresse**:

```
https://motte025.github.io/City-cafe/fernbedienung.html
```

Diese Seite (`fernbedienung.html`) ist nur eine Hülle mit vier Reitern; die
eigentlichen Seiten laufen darin in einem Rahmen, damit es keine doppelte Logik
gibt:

| Reiter | Seite | Wofür |
|---|---|---|
| 🎬 Videos | `yt-fernbedienung.html` | YouTube-Videos suchen und auf den Screen schicken |
| 🎧 DJ | `dj-fernbedienung.html` | Twitch-DJ auswählen, Qualität, Laufzeit |
| 🎰 Roulette | `roulette/remote.html` | Roulette am Fernseher steuern (von Codex) |
| 🃏 Hos'n Obe | `hosn-obe.html` | Das Kartenspiel mitspielen |

Zum Speichern am Handy: die Adresse auf den Startbildschirm legen. Der Rest
läuft über die Reiter.

## Welcher Screen wird gesteuert?

Es gibt zwei Boxen (zuhause und im City Cafe). Damit ein Befehl nicht auf dem
falschen Fernseher landet:

* Jeder Screen trägt sich mit **Raumname und öffentlicher IP** in
  `djremote/boxen/<raum>` ein (alle 15 Minuten neu).
* Die Fernbedienung holt ihre eigene öffentliche IP und wählt die Box mit
  derselben IP – das ist die im selben WLAN.
* Stehen mehrere zur Auswahl, erscheinen oben Knöpfe zum Umschalten; die Wahl
  bleibt gespeichert.
* Der Raumname kommt aus der Kiosk-Adresse (`?raum=zuhause`) und gilt für
  **alle** Teile: Videos, DJ, Roulette und Kartenspiel.

## Wie die Seiten mit dem Screen reden

Über dieselbe Firebase-Verbindung wie das Kartenspiel, unter `djremote/<raum>/`:

* `yt/befehl` – was das Handy will (Suche, Start, Stopp, Spulen, Ton)
* `yt/treffer` – Suchergebnisse vom Screen zurück ans Handy
* `yt/status` – was der Screen gerade tut (inkl. laufender Hos'n-Obe-Runde)
* `yt/liste` – selbst hinzugefügte Videos (Dauerliste)
* `roulette/…` – die Roulette-Steuerung (von Codex)

Gesucht wird **nicht** am Handy, sondern auf der Box mit `yt-dlp` – deshalb
braucht es keinen YouTube-Schlüssel und kein Google-Konto.

## Eigenheiten, die man kennen sollte

* **Schriftgrößen**: Alle Handy-Seiten sind bewusst sehr groß gesetzt – sie
  werden im Lokal bedient, oft in Eile und im Dunkeln. Lieber scrollen als
  kneifen. Ab 700 px Fensterbreite (Tablet, Rechner) schalten die Seiten auf
  kleinere Größen um.
* **Vorschläge**: Beim Öffnen holt die Video-Seite von selbst sechs Vorschläge,
  gemischt aus mehreren Suchbegriffen. Nach jedem gestarteten Video kommen
  sechs neue, die zum gerade gestarteten passen (Titelsuche – YouTubes eigene
  Mix-Listen gibt `yt-dlp` nicht her).
* **Hos'n Obe hat Vorrang**: Läuft eine Runde, nimmt der Screen weder Video
  noch Stream an; beide Seiten sperren dann den Startknopf.
* **Twitch-Anmeldung** öffnet ein eigenes Fenster – `id.twitch.tv` verbietet die
  Anzeige im Rahmen. Das Token kommt per `postMessage` zurück.
* **GitHub Pages speichert 10 Minuten zwischen.** Die Seiten tragen deshalb eine
  sichtbare Fassungsnummer und holen sich einmal selbst frisch, wenn sie aus dem
  Zwischenspeicher kamen.
