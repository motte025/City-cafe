# Prüfbericht · Roulette-TV

Stand: 23.09.2026

- 110 automatisierte Tests bestanden.
- Alle 37 Endfächer, drei Bewegungsvarianten und beide Drehrichtungen geprüft.
- Bewegung bei 15, 30, 60 und 144 FPS sowie Pause bei inaktivem Tab geprüft.
- Tatsächliches Anheften der Kugel mit Three.js geprüft: keine Änderung der Weltposition, richtiges Endfach, seitliche Ruheposition.
- 8-Sekunden-Countdown, exakt 12 Standardrunden, alle auswählbaren Zykluslängen, Endlosbetrieb, Pause, vorgemerkter Zyklus und Verhindern doppelter Ergebnisse geprüft.
- Bestehende Farben-, Zufalls- und Auszahlungstests bestehen weiterhin; die TV-Oberfläche enthält kein Setzfeld.
- Produktionsbuild mit TypeScript und Vite erfolgreich.
- Im Browser: TV bei 1920 × 1080 und Fernbedienung bei 390 × 844 geprüft. Reale Firebase-Verbindung zwischen zwei Seiten getestet: 30 Runden, Endlosbetrieb, Stopp und Statusrückmeldung.
- Tonfreigabe per Nutzerinteraktion funktioniert; keine Browserfehler auf der TV-Testseite.

Nicht auf dem physischen 55-Zoll-TV oder dessen Lautsprechern geprüft. Die subjektive Klangwirkung und die Perspektive am tatsächlichen Sitzplatz müssen dort abgestimmt werden. Geräusche sind synthetisch erzeugt. Das browsergesteuerte Auspendeln ist kontrollierte Animation, keine freie Starrkörper-Simulation.

## Leistungsüberarbeitung

### Kessel-Design

120 Tests bestanden. Zusätzliche Prüfungen umfassen die geneigte Geometrie aller Zahlen, Ausrichtung und Flächennormalen aller acht Rauten sowie Kugelabstand zu den veränderten Oberflächen. Alle 37 Endfächer wurden mit beiden Richtungen, drei Varianten und vier extremen Formkombinationen bei 15 und 60 FPS geprüft. Einstellungen werden begrenzt; Design-Rücksetzung erhält Spielablauf und Tonwerte.

TV-Optik bei 1920 × 1080 einschließlich zehn Historienzahlen und maximaler Schriftgröße visuell geprüft. „Live am Tisch“ liegt auf der horizontalen Kesselmitte. Die Fernbedienung zeigt während eines Wurfs vorgemerkte Formänderungen; Regler und Rücksetzung über Firebase geprüft. Handy-Ansicht bei 390 × 844 ohne horizontale Überbreite geprüft. Die großen Handy-Schriften und der bestehende Aufnahme-Modus bleiben erhalten.

115 Tests bestehen inklusive Renderpuffer, Schatten-Takt, Geometriezusammenfassung und Leistungsoptionen. Handy-Schriften im Browser bei 390 px geprüft: Überschrift 54 px, Feldbeschriftungen 23 px, keine horizontale Überbreite. Runtime-Umschaltung über Firebase und 960×540-Puffer bei weiterhin 1280×720-Oberfläche geprüft. ODROID-Messung steht aus; siehe PERFORMANCE.md.


## TV-Bereinigung, Laufzeit und Ton

## Aufnahmen und Taschenlandung (23.09.)

123 Tests bestanden: elf Kontaktphasen mit stetigen Positionen, wiederholte radiale Richtungswechsel bis zur Ruhe, alle 37 Endfächer bei verschiedenen Bildraten und Formextremen. Vier lokale Ogg-Aufnahmen sind im Build enthalten; Laden und Dekodieren im Browser erfolgreich. Rollton blendet vor den letzten Kontakten aus. Kein synthetischer Ersatzton bei Ladefehlern. Quelle, CC0-Lizenz und Schnittzeiten stehen in public/audio/SOURCES.md. Die Auswahl erfolgte anhand Wellenform und automatischer Spracherkennung; kein subjektiver Hörtest und keine Prüfung an den TV-Lautsprechern.

## Hintergrund-Loop

124 Tests bestanden. Die bereitgestellte 394,8-Sekunden-MP3 wurde als 392-Sekunden-Ogg mit zyklischer Zwei-Sekunden-Überblendung und −25 LUFS integriert. Ogg-Container, Mindestgröße und Produktionsbuild geprüft. Im Browser geladen und gestartet; der Regler „Hintergrundgeräusch“ wurde über die Handy-Fernbedienung von 35 auf 55 Prozent geändert und am TV bestätigt. Subjektive Hörprüfung und Prüfung des Übergangs über die physischen TV-Lautsprecher stehen aus.

121 Tests bestanden. Variable Dauer 13/16/19 Sekunden für alle 37 Fächer und beide Richtungen geprüft. TV mit zehn Historienzahlen visuell geprüft; entfernte Bedienelemente fehlen in der Hauptansicht, Tonfreigabe ist im Einstellungsdialog erreichbar. Getrennte Innen-/Außenmaterialien über Firebase geprüft. Die permanenten Rauschgeneratoren sind entfernt, die bisher gespeicherte Atmosphäre wird beim Update einmalig auf null gesetzt. Tonfreigabe im Browser technisch geprüft; Klang auf den physischen TV-Lautsprechern nicht abgehört.
