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

## Kugelphysik

Die Kugel läuft nicht mehr nach vorgefertigten Keyframes, sondern nach einer
eigenen deterministischen 3D-Physik: Rollen mit Roll- und Luftwiderstand,
Stöße mit Reibung an Laufbahn, Rauten, Zahlenkranz und Stegen, echte
Schwerkraft im Flug.

Ablauf eines Wurfs:

1. Bei Countdown-Start wird die Gewinnzahl gezogen (`randomIndex()`, Web
   Crypto) — unabhängig von der Bewegung.
2. Im Hintergrund (Web Worker, ohne Worker gestückelt im Hauptthread) sucht
   ein Generator einen geseedeten Wurf, der in dieser Zahl endet, im
   eingestellten Einlauf-Fenster (`Einlauf min./max. Taschen`, Standard 5–15,
   Bereich 3–20) und im Zeitfenster der Rundendauer liegt.
3. Findet die Suche rechtzeitig nichts (siehe Rückfallquote unten), springt
   die alte Keyframe-Animation ein. Sie zeigt garantiert die gezogene Zahl,
   nur der Kugelweg ist dann nicht physikalisch.

Bekannte Abweichungen von der ursprünglichen Vorgabe (Messwerte und Gründe in
`TESTBERICHT.md`): die Taschenphase dauert meist 1,1–1,6 s statt der
gewünschten 2–4 s; Rautentreffer sind meist 0 statt „meist 1“, weil ein
Treffer so viel Tempo kostet, dass danach selten noch 5–15 Taschen offen
bleiben; die Kugel bleibt oft radial in der Taschenmitte liegen statt außen.

Drei sichtbare Zierringe (Laufbahn-Innenkante, Konus-Unterkante,
Taschenkranz-Rand) stehen 1,7–2,7 mm über den Flächen, über die die Kugel
rollen muss — in der Kollision sind sie deshalb bündig gerechnet, das
sichtbare Modell ist unverändert. Empfehlung: die drei Ringe im 3D-Modell
bündig absenken, siehe `TESTBERICHT.md`.

Dev-Schalter (nur `npm run dev`, nicht am TV): `?dev&target=N` erzwingt eine
Zahl, `?dev&slow=0.25` verlangsamt die Wiedergabe, das Debug-Overlay zeigt
Phase, Laufweg, Rautentreffer und Rechenzeit der Suche.

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
