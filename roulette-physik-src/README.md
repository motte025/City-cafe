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

Rollgeräusch und Aufpraller stammen aus einer echten Aufnahme des Casino Évian von f_ilippo (CC0). Die Sprachansage ist nicht Bestandteil der verwendeten Ausschnitte. Quelle und Schnittzeiten: [public/audio/SOURCES.md](public/audio/SOURCES.md). Keine synthetischen Oszillatoren oder Rauschgeneratoren mehr. Die kurzen Dateien werden von derselben Website geladen; bei Ladefehlern erscheint eine Wiederholungsmöglichkeit im Ton-Button. Tonfreigabe am TV unter ⚙ → Ton aktivieren. Optionale leise Kontakte außerhalb des Wurfs bleiben standardmäßig ausgeschaltet.

Das Hintergrundgeräusch stammt aus der vom Betreiber bereitgestellten WhatsApp-Tonspur. Der 6:32 Minuten lange Stereo-Loop wurde an den Enden beschnitten, über zwei Sekunden überblendet und auf −25 LUFS normalisiert. In der Handy-Fernbedienung regelt „Hintergrundgeräusch“ ausschließlich diesen Loop; „Kugel & Aufpraller“ bleibt davon getrennt. Neue und bestehende Installationen starten einmalig mit 35 Prozent Hintergrundlautstärke.

Der Rollton beginnt erst beim tatsächlichen Abwurf und blendet vor den letzten Taschenkontakten aus. Einzelne Aufprallaufnahmen folgen den Kontaktphasen. Bei verborgenem Tab stoppen alle laufenden Geräusche; beim Zurückkehren wird die aktuelle Phase fortgesetzt. Die letzten fünf Bewegungsabschnitte lassen die Kugel radial und seitlich zurückprallen und erst danach zur außermittigen Ruheposition auspendeln.

Bei inaktivem Tab pausiert die Animationszeit; bei Rückkehr werden keine Würfe übersprungen. Nach Neuladen beginnt ein neuer Standardzyklus. Einstellungen bleiben auf diesem TV gespeichert; Ergebnisverlauf und Zyklus sind nicht dauerhaft gespeichert.

## Sparsame Darstellung

Für die ODROID-Box gibt es in der Fernbedienung einen Sparmodus und einen separaten Regler für die 3D-Auflösung. Das Dashboard startet beim ersten Aufruf mit Sparmodus; gespeicherte Einstellungen bleiben erhalten. Messwerte, Vergleichsadresse und Einschränkungen: [PERFORMANCE.md](PERFORMANCE.md).


## TV-Ansicht und zusätzliche Regler

Pausieren, Neustart und Lauftext unter dem Kessel sind auf dem TV ausgeblendet. Tonfreigabe und Handy-Verbindung sind im Zahnrad-Menü erreichbar. Die Fernbedienung steuert den Ablauf weiterhin vollständig. CITY CAFE ist die sichtbare Beschriftung, der technische Screenname bleibt im Verbindungsdialog.

Neu: Innenkessel, Außenrand und Kugellaufbahn separat heller/dunkler stellen, Innen- und Außenglanz getrennt regeln und Taschenfarben abstimmen.

Die Rundendauer schwankt unabhängig vom Ergebnis um den eingestellten Mittelwert: standardmäßig 16 ± 3 Sekunden, also 13–19 Sekunden ab Abwurf. Der vorherige Richtungswechsel kommt hinzu. Abweichung 0–5 Sekunden in der Fernbedienung einstellbar. Eine konstante Animationsdauer hat die Gewinnwahrscheinlichkeiten ebenfalls nicht verändert: Das Endfach wird unabhängig mit Web Crypto gleichverteilt gezogen.
# Kugelbewegung – 23.09.2026

Die TV-Anzeige erzeugt pro Wurf ein unabhängiges 32-Bit-Bewegungsprofil: variabler Abstieg, 4–7 Kontakte vor dem Taschenbereich und 4–7 abklingende Taschenkontakte. Letzte Bewegung: seitlicher Rückprall und Ausrollen zur äußeren Taschenwand; kein Zentrieren. Die Endposition bleibt relativ zum Rotor erhalten. Das Ergebnis wird weiterhin unabhängig und unverzerrt über Web Crypto gewählt.

Fernbedienung → **Kugel & Einlauf**: Durchmesser 18–21 mm, Gewichtsreferenz 5,3–10,5 g, Sprungstärke 50–140 %. Änderungen gelten ab dem nächsten Wurf. Referenzmaßstab: 900 mm äußerer Kesseldurchmesser; Standardkugel 21 mm, damit etwas kleiner als zuvor. Gewichtsreferenz steuert die angenäherte Rückprallenergie, keine freie Massensimulation. Größen/Gewichte nach [Apex Live Gaming](https://www.apex-livegaming.com/product/roulette-ball/); Standard 21 mm Ivorine mit 8,7 g.

## Experimentelle echte Physik

Die getrennte Vorschau unter `roulette-physik/` berechnet Kugel, Rotor, Rauten und Taschenstege mit Rapier bei festen 1/240-Sekunden-Schritten. Ein Wurf hat keine vorab gewählte Zielzahl. Erst wenn die Kugel physisch zur Ruhe kommt, wird aus ihrer Position relativ zum weiterlaufenden Rotor das Fach gelesen.

Die Kugel trifft mindestens eine der acht abwechselnd ausgerichteten Rauten und überquert danach pro Wurf zufällig fünf bis zehn Taschenstege. Dieser Kontaktbereich wird nur über Rückprall, Reibung und einen kleinen tangentialen Impuls gegen numerisches Festkleben stabilisiert; er lenkt die Kugel nicht zu einer Zahl. Nach dem letzten Kontakt bleibt die Kugel ein dynamischer Körper und wird weder an die Fachmitte gesetzt noch am Rotor angeheftet.

## Rautenwiderstand und Taschen-Nachlauf

In der Fernbedienung stehen unter „Kugel & Einlauf“ zwei getrennte Widerstandsregler für die längs und quer ausgerichteten Rauten zur Verfügung. 0 % verwendet sehr wenig Reibung und geringen Energieverlust, 100 % bremst stark. Standard sind 10 % für beide Typen.

„Nachlauf maximal“ reicht von 5 bis 20 Taschen. Für jeden Wurf wird die Kontaktzahl mit Web Crypto ohne Modulo-Verzerrung neu zwischen 5 und dem eingestellten Maximum gewählt. Die Einstellung verändert nur die Abbremsphase und kennt keine Zielzahl.
