# Prüfbericht · Roulette-TV

Stand: 21.09.2026

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
