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

Unter „Kessel-Design & Lesbarkeit“ lassen sich Blickwinkel, 3D-Tiefe, Gefälle des Zahlenkranzes, Zahlengröße, Holzfarbe, Silber/Gold-Ton, Glanz, Lichtkontrast und TV-Schriftgröße einstellen. Blickwinkel 0° entspricht der senkrechten Draufsicht. Die acht Rauten sind abwechselnd radial und tangential angeordnet; der Zahlenkranz fällt zu den vertieften Taschen ab.

Formänderungen während eines Wurfs werden bis zur Landung vorgemerkt, damit Kugel und Oberflächen zusammenpassen. Licht, Materialien, Blickwinkel und Texte reagieren sofort. „Design zurücksetzen“ stellt nur die Designwerte zurück; Ton, Zyklus und TV-Kalibrierung bleiben erhalten.

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

Leise Rollkontakte, kurze Aufpraller und optionale Tischgeräusche werden im Browser synthetisch erzeugt. Es sind keine echten Casino-Aufnahmen. Dauernde Rauschschleifen sind entfernt. Tischgeräusche stehen standardmäßig auf null, auch einmalig beim Update bestehender Einstellungen. Tonfreigabe am TV unter ⚙ → Ton aktivieren. Moderne WebGL-Unterstützung ist nötig.

Bei inaktivem Tab pausiert die Animationszeit; bei Rückkehr werden keine Würfe übersprungen. Nach Neuladen beginnt ein neuer Standardzyklus. Einstellungen bleiben auf diesem TV gespeichert; Ergebnisverlauf und Zyklus sind nicht dauerhaft gespeichert.

## Sparsame Darstellung

Für die ODROID-Box gibt es in der Fernbedienung einen Sparmodus und einen separaten Regler für die 3D-Auflösung. Das Dashboard startet beim ersten Aufruf mit Sparmodus; gespeicherte Einstellungen bleiben erhalten. Messwerte, Vergleichsadresse und Einschränkungen: [PERFORMANCE.md](PERFORMANCE.md).


## TV-Ansicht und zusätzliche Regler

Pausieren, Neustart und Lauftext unter dem Kessel sind auf dem TV ausgeblendet. Tonfreigabe und Handy-Verbindung sind im Zahnrad-Menü erreichbar. Die Fernbedienung steuert den Ablauf weiterhin vollständig. CITY CAFE ist die sichtbare Beschriftung, der technische Screenname bleibt im Verbindungsdialog.

Neu: Innenkessel, Außenrand und Kugellaufbahn separat heller/dunkler stellen, Innen- und Außenglanz getrennt regeln und Taschenfarben abstimmen.

Die Rundendauer schwankt unabhängig vom Ergebnis um den eingestellten Mittelwert: standardmäßig 16 ± 3 Sekunden, also 13–19 Sekunden ab Abwurf. Der vorherige Richtungswechsel kommt hinzu. Abweichung 0–5 Sekunden in der Fernbedienung einstellbar. Eine konstante Animationsdauer hat die Gewinnwahrscheinlichkeiten ebenfalls nicht verändert: Das Endfach wird unabhängig mit Web Crypto gleichverteilt gezogen.
