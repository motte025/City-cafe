# Physik-Vorschau – 24.09.2026

Experimenteller Teststand unter `roulette-physik/`, nicht die freigegebene Anzeige `roulette/`. Standardraum `physik-test`, eigene TV-Einstellungen. Rapier 0.12, feste Schritte 1/240 s, kontinuierliche Kollisionserkennung und interpolierte Darstellung. Kugel und Rotor bleiben nach der Landung in der Simulation. Keine Zielzahl, kein Zeitlimit für eine erzwungene Landung, keine Zielkurven. Die laufenden Körperkontakte bestimmen das Ergebnis.

Build: `npm ci`, Audio-Assets aus `../roulette-physik/audio/` nach `public/audio/` kopieren, `npm run build`. Ausgabe `dist/` nach `roulette-physik/`. Das npm-Testskript stammt aus dem Hauptprojekt; die Physik-Testserie liegt derzeit im lokalen Entwicklungsprojekt und ist noch nicht vollständig bestanden.

Bekannte Grenze: Kombinationen extremer Form-, Abwurf- und Materialwerte können Fehlwürfe verursachen. Die Anzeige pausiert dann ohne Ergebnis. Einzelne Probeläufe und Bildratenvergleich funktionieren, eine vollständige Freigabe und die Beurteilung am realen TV stehen aus. Es wird keine Gleichverteilung oder Unvorhersagbarkeit der Simulation behauptet.

Abwurfbedingungen werden mit Web Crypto gewählt, weder gespeichert noch an die Fernbedienung gesendet. Masse in kg, Längenmaßstab 0,9 m für den 6,8 Einheiten breiten Außenkessel. Die früheren Dauerregler steuern den Physiklauf nicht; stattdessen gibt es Abwurfgeschwindigkeit, Durchmesser, Masse und Rückprall.
