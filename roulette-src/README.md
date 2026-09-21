# City Cafe · Roulette am TV

Eine automatische europäische Roulette-Anzeige ohne Setzfeld oder Geldfunktionen.

## Am TV starten

https://motte025.github.io/City-cafe/roulette/

Das Rad startet nach 8 Sekunden. Standard: 12 Runden; nach jeder Landung folgen erneut 8 Sekunden Countdown. Die letzten zehn Gewinnzahlen stehen unten. Einmal „Ton aktivieren“ anklicken, danach bei Bedarf Vollbild einschalten.

## Handy-Fernbedienung

https://motte025.github.io/City-cafe/fernbedienung.html?teil=roulette

Den gleichen Screen auswählen wie am TV. Standardraum ist `city-cafe`. Für andere Screens die TV-Adresse mit `?raum=SCREENNAME` öffnen. „Handy verbinden“ am TV zeigt den passenden QR-Code. Pro Screen nur eine Roulette-TV-Seite öffnen.

Zyklen: 10, 12, 30, 50, 100, 200 oder unendlich. Pause/Stop lassen eine laufende Kugelrunde fertig werden. Neue Zyklen während eines Wurfs beginnen nach dessen Landung. Einstellbar: Countdown, Rundendauer, Kugelton, Casino-Atmosphäre, Stumm, Helligkeit, Radgröße und Perspektive.

Die Fernbedienung verwendet die bereits vorhandene City-cafe-Firebase-Verbindung unter `djremote/<raum>/roulette`. Bestehende DJ-, Video- und Spielpfade bleiben unabhängig. Internet wird für die Fernbedienung benötigt. Ein Verbindungsabbruch hält die lokale TV-Animation nicht an.

## TV-Perspektive

Voreinstellung: 55 Zoll, Unterkante 2 m, Abstand 3,5 m, Augenhöhe 1,2 m. Die geometrische Entzerrung ist für diesen Blickpunkt gedacht. Im Menü „TV-Bild & Perspektive“ an den tatsächlichen Sitz- oder Stehplatz anpassen. Das Layout ist für 1920 × 1080 im Querformat gestaltet.

## Lokal entwickeln

Node.js installieren, dann im Quellordner:

```
npm ci
npm run dev -- --host 0.0.0.0
npm test
npm run build
```

TV: `/`, Fernbedienung: `/remote.html`, jeweils optional `?raum=...`.
Nur im Entwicklungsserver: `/?dev&target=14` erzwingt Zielzahl 14. Alle 37 Zahlen sind prüfbar; die veröffentlichte Version ignoriert diesen Schalter.

## Animation und Ton

Kontrollierte zeitbasierte Kugelbewegung mit wechselnden Richtungen, Abwurf bei der letzten Gewinnzahl, Abprallphasen und seitlichem Auspendeln. Das Endfach wird aus der tatsächlichen lokalen Kugelposition abgeleitet. Die Kugel bleibt an ihrer Ruheposition, statt in die Fachmitte zu springen. Ergebnisse stammen gleichverteilt aus Web Crypto mit Rejection Sampling.

Rollgeräusche, Aufpraller und dezente Casino-Raumatmosphäre werden im Browser synthetisch erzeugt. Es sind keine echten Casino-Aufnahmen. Browser verlangen eine erste Tonfreigabe direkt am TV. Moderne WebGL-Unterstützung ist nötig; auf älteren TV-Browsern kann ein angeschlossener Computer erforderlich sein.

Bei inaktivem Tab pausiert die Animationszeit; bei Rückkehr werden keine Würfe übersprungen. Nach Neuladen beginnt ein neuer Standardzyklus. Einstellungen bleiben auf diesem TV gespeichert; Ergebnisverlauf und Zyklus sind nicht dauerhaft gespeichert.
