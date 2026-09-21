# Renderkosten und ODROID-Test

## Befund

Die ursprüngliche Szene erzeugte bei 1280 × 720 **384 Draw Calls und 222.196 Dreiecke pro Bild einschließlich Schattenpass**. Gemessen mit `renderer.info`, dessen automatisches Zurücksetzen für die Messung abgeschaltet wurde. 37 separate Zahlentexturen und viele einzelne Stege, Schrauben und Ringe verursachten unnötig viele Einreichungen an den Treiber.

Nach dem Zusammenfassen sind es im Qualitätsmodus **42 Draw Calls und 114.420 Dreiecke inklusive aktualisiertem Schattenpass**. Die Grundformen bleiben echte 3D-Geometrie. Die feinen Rundungen verwenden 128 statt 192 Umfangssegmente; kleine Ringquerschnitte 8 statt 12. Auf dem Testbild sind keine störenden Facetten erkennbar.

Die gemessenen Desktop-Werte sind **kein ODROID-Benchmark**: Original etwa 2,4 ms CPU-Einreichung / 3,3 ms GPU, optimierte Qualität etwa 0,6 / 2,6 ms. CPU-Einreichung ist nicht die gesamte Framezeit. GPU-Zeit stammt aus asynchronen Timer Queries, sofern der Browser die Erweiterung anbietet. Die Desktop-GPU erreicht bereits die Bildwiederholrate und bildet die Mali-G52 nicht nach.

## Was geändert wurde

- Materialgleiche Geometrien pro festem Kessel bzw. Rotor zusammengeführt, Schattenflags getrennt erhalten. Die Kugel bleibt eigenständig. Drehrichtung und Ergebniszuordnung bleiben unverändert.
- Gemeinsame 2048²-Zahlenatlas-Textur: ein Zeichenaufruf für alle Zahlen. UV-Koordinaten halten die bisherige Schriftauflösung je Zahl.
- Weiterhin drei gerichtete Lichter, ein Hemisphärenlicht, dieselben PBR-/Clearcoat-Materialien, ACES-Tonemapping und vorberechnete Raumreflexionen. Die Umgebungsmap wird schon bisher nur beim Start erzeugt; sie wurde nicht jeden Frame neu gerendert. Diese sichtbaren Eigenschaften wurden bewusst erhalten.
- Sparmodus: maximal 1280 × 720 3D-Pixel unabhängig von Display-Pixeldichte, optional 50–100 % davon. Keine automatische Qualitätsschwankung während eines Wurfs.
- Sparmodus: 1024²-Schattenkarte, höchstens 15 Aktualisierungen/s; beim endgültigen Einpendeln sofortige Aktualisierung. Qualitätsmodus: 2048² und bei Bewegung jedes Bild. Bei ruhender Szene wird die Schattenkarte wiederverwendet. Ein komplett dauerhaft eingefrorener Schatten wäre für drehende Stege, Aufbau und Kugel falsch.
- Bei 30 Bildern/s sinkt das nominelle Schattenkartenbudget von 125,8 auf höchstens 15,7 Millionen Pixel/s. Das ist eine Budgetrechnung, keine gemessene GPU-Beschleunigung; viele Schattenpixel werden nicht von Geometrie getroffen.
- Die eigentliche Kugelbewegung bleibt in beiden Modi zeitbasiert und wird weiterhin bei jedem Renderframe berechnet. Der Schatten-Takt drosselt nicht die Kugel.
- Dashboard-Rahmen jetzt echte 1280 × 720 CSS-Pixel, statt 800 × 450 mit Vergrößerung um Faktor 1,6. Nur der 3D-Puffer wird reduziert. Countdown, Historie und Schriften bleiben in voller Layoutauflösung.
- Das Dashboard setzt `?kiosk=1`: Sparmodus beim ersten Start standardmäßig an. Danach gilt die auf diesem TV gespeicherte Wahl aus der Fernbedienung. `?eco=1` bzw. `?eco=0` erzwingt die Wahl für einen gezielten Vergleich beim Laden.
- Große Handy-Schriften bleiben im HTML-Block. Spezifischere Selektoren verhindern, dass das gebaute Standard-CSS sie wieder verkleinert; kein horizontales Scrollen bei 390 px.

## Am ODROID messen

TV-Seite: `roulette/index.html?profile&eco=1&raum=SCREENNAME`

Für den direkten Vergleich: gleiche Adresse mit `eco=0`. Die Anzeige zeigt echte Puffergröße, FPS, CPU-Einreichung, GPU-Zeit (falls verfügbar), mittlere Draw Calls/Dreiecke und Schatten-Updates/s. Nach kurzer Aufwärmphase laufen 25-Sekunden-Messfenster. Nicht mehrere TV-Seiten gleichzeitig messen. mpv/Twitch/andere GPU-Last wie beim bisherigen Test pausieren; danach zusätzlich im normalen Dashboard-Betrieb prüfen.

1. Bei 1280 × 720 und 100 % messen, mehrere vollständige Würfe abwarten.
2. In der bestehenden Fernbedienung → Roulette → „Sparsame Darstellung“ umschalten. Eine laufende Runde darf dabei nicht neu starten.
3. Falls 30 FPS nicht stabil erreicht werden: „3D-Auflösung im Sparmodus“ auf 85 % (1088 × 612), dann 75 % (960 × 540) setzen. Die Bedienoberfläche bleibt 1280 × 720.
4. Schatten an Kugel und Stegen, Zahlenlesbarkeit und CPU/GPU-Zeiten vergleichen; nach dem Test `profile` aus der Adresse entfernen.

**Offen:** Tatsächliche 30 FPS bei nativem 1280 × 720 auf dem ODROID N2+ sind noch nicht nachgemessen. Kein Zugriff auf dieses Gerät in dieser Arbeitssitzung. Die beigefügte TV-Aufnahme wurde als Darstellungsreferenz angesehen; daraus lässt sich keine belastbare neue Renderzeit ermitteln.

Die alten Messungen des Betreibers (vor Optimierung): 640×360 ≈28, 800×450 ≈24, 960×540 ≈21, 1280×720 ≈15, 1920×1080 ≈9 FPS. Einzelmaßnahmen wie kleinere Schattenkarte oder ausgeschaltete Kantenglättung lagen zuvor im Messrauschen. Deshalb umfasst diese Änderung vor allem die deutliche Reduktion der Zeichenaufrufe und Geometrie, statt daraus allein einen Geschwindigkeitsgewinn zu behaupten.

Zusätzliche Desktop-Messung über 25 Sekunden im Sparmodus bei 1280 × 720: 60,0 FPS, CPU-Einreichung 0,5 ms, GPU 1,8 ms, durchschnittlich 30,4 Draw Calls und 71.620 Dreiecke; 13,5 Schatten-Updates/s. Auch diese Werte sind kein Nachweis für die ODROID-Bildrate.

