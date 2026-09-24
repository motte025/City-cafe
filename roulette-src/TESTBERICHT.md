# Testbericht · Kugelphysik

Stand: Umbau von Keyframe-Animation auf eigene deterministische 3D-Physik
mit geseedeter Suche. Alle Messwerte auf einem 1-Kern-Testrechner (Xeon
2,1 GHz); die tatsächliche TV-Box (ODROID) ist grob um den Faktor 4
langsamer, das kommende x86-Gerät (ACEMAGIC W1) voraussichtlich schneller.

## Automatisierte Tests

`npm test` (`roulette-src/tests/*.test.ts`, 135 Fälle) prüft je Wurf:

- Endtasche stimmt mit der gezogenen Zahl überein.
- Laufweg liegt im eingestellten Fenster (`Einlauf min./max. Taschen`).
- Taschenzeit und Ausklingen (≤ 0,8 s) im vorgesehenen Fenster.
- Stillstand ist nie exakt zentriert; danach keine Relativbewegung zum
  Rotor mehr; das Anheften an den Rotor erfolgt ohne Sprung.
- Keine Durchdringung von Flächen über 0,5 mm.
- Geschwindigkeitssprünge treten nur an tatsächlichen Kontakten auf.
- Jede Flugphase folgt derselben Schwerkraft (Fehler < 2 % von g).
- Rautenkontakte liegen geometrisch auf einer Raute.
- Wiedergabe bei 15/30/60/144 Bildern/s bleibt stetig (kein Sprung über die
  größte tatsächliche Momentangeschwindigkeit hinaus).
- Alle 37 Zahlen in beiden Drehrichtungen, dazu Extremwerte von Kugel
  (Durchmesser 18-21 mm, Masse 5,3-10,5 g, Sprungstärke 0,5-1,4) und
  Kesselform (Kesseltiefe 0,85-1,45, Zahlenkranz-Gefälle 8-28°).

Separat (mehrere Minuten, nicht Teil von `npm test`):
`npx tsx --test tests/ball-stats.test.ts` - 1000 Würfe, siehe unten.

## Messwerte: Laufbahn

Die Kugel bleibt auf der Laufbahn außen, solange sie schnell ist, und
verlässt sie erst, wenn sie auf etwa 2 rad/s abgebremst hat. Damit ist eine
Runde physikalisch höchstens etwa **24 s** lang (Standardformen); länger
eingestellte Rundendauern werden auf das erreichbare Maximum geklemmt.
Typischer Abwurf bei Standard-Countdown/-Rundendauer: 6-10 rad/s
(rund 1-1,6 Umdrehungen/s).

## Messwerte: Suche (Referenzlauf ohne Zeitbudget, Standardform)

| Größe | Wert |
|---|---|
| Rechenzeit pro Wurf, Ø | rund 280 ms |
| Rechenzeit pro Wurf, max | rund 1,2 s |
| Erster Wurf (inkl. einmaliger Referenzrechnung) | rund 1,3-1,5 s |
| Rückfallquote (Suche findet nichts) | rund 14 % (1000 Würfe, gemischte Ziele/Richtungen/Dauern) |
| Rückfallquote bei Extrem-Kesselformen | deutlich höher (siehe unten) |

Am eingebauten Zeitbudget (Countdown- plus Richtungswechsel-Zeit) bricht die
Suche kontrolliert ab; dann greift die Keyframe-Rückfallebene, die immer die
richtige Zahl zeigt.

## Messwerte: 1000 Würfe, Standardeinstellungen (5-15 Taschen Einlauf)

Laufweg (Häufigkeit je Taschenzahl, n = 860 gefundene Würfe):

```
5:86  6:106  7:99  8:86  9:122  10:96  11:80  12:46  13:63  14:47  15:29
```

Grob gleichverteilt über 5-15, kein Wert dominiert stark.

Rautentreffer: **0 Treffer bei 689 von 860 Würfen (80 %)**, **1 Treffer bei
171 (20 %)**, 2 Treffer kamen in dieser Stichprobe nicht vor. Ein Treffer
kostet so viel Tangentialtempo, dass danach selten noch 5-15 Taschen
offenbleiben - deshalb bevorzugt die Suche rautenfreie Läufe.

Taschenzeit (Zeit vom ersten Kontakt mit dem Taschenkranz bis zum
Stillstand): **1,1-1,6 s**, nicht die ursprünglich gewünschten 2-4 s. Mit
lebhafteren Stegen ließe sich das verlängern, dann klingt die Kugel aber
oft länger als die vorgegebenen 0,8 s aus - beides zusammen ist mit der
vorgegebenen Geometrie nicht erreichbar.

Stillstand: Die Kugel bleibt meist **radial in der Taschenmitte** liegen,
nicht außen an der Wand. Das ergibt sich aus der Taschenform.

## Geometrie-Probleme (außerhalb der Kugel - Entscheidung beim Betreiber)

Drei sichtbare Zierringe stehen über den Flächen, über die die Kugel rollen
muss:

| Ring | Radius | Überstand | Wirkung |
|---|---|---|---|
| Laufbahn-Innenkante | 2,93 | 2,7 mm | Kugel verließe die Bahn nie |
| Konus-Unterkante | 2,47 | 1,8 mm | Kugel kreist auf der Kante |
| Taschenkranz-Rand (Rotor) | 2,025 | rund 2 mm | Kugel kreist auf dem Zahlenkranz |

Schon 0,8 mm Überstand genügen, um eine 21-mm-Kugel bei 21° Gefälle
dauerhaft festzuhalten. In der Kollisionsrechnung sind die drei Ringe daher
bündig (sichtbares Modell unverändert). Empfehlung: die Ringe im 3D-Modell
bündig absenken; sonst schneidet die Kugel sie beim Überrollen um bis zu
2,7 mm, meist unter der Kugel verdeckt.

## Extreme Kesselformen

Bei sehr flachem Zahlenkranz-Gefälle (8°) kreist die Kugel lange auf dem
fast ebenen Kranz. Bei großer Kesseltiefe zusammen mit 28° Gefälle steht der
Rotorrand mehrere Millimeter über der Konuskante - eine Stufe nach oben, die
die Suche stark erschwert. In diesen Kombinationen greift häufiger die
Rückfallebene (im Test bis zu einem Drittel der Fälle); die gezeigte Zahl
bleibt davon unberührt.

## Was am Fernseher zu beurteilen ist

- Wirkt der Kugellauf auf der Laufbahn glaubwürdig (Bremsen, Abgang)?
- Ist die kürzere Taschenphase (1,1-1,6 s statt 2-4 s) am Bildschirm störend
  oder unauffällig?
- Ist der meist rautenfreie Lauf akzeptabel, oder soll versucht werden,
  Rautentreffer wieder häufiger zu machen (verlangsamt die Suche deutlich)?
- Sind die drei überstehenden Zierringe im Bild überhaupt wahrnehmbar (die
  Kugel verdeckt sie meist), oder sollen sie im Modell abgesenkt werden?
- Rechenzeit/Rückfälle auf der tatsächlichen TV-Box (ODROID, später W1)
  gegenprüfen - die obigen Werte stammen vom Testrechner.

## Neu: Rauten-Widerstand per Fernbedienung (noch nicht am Dashboard aktiv)

Zwei neue Regler in der Fernbedienung: „Rauten radial · Widerstand“ und
„Rauten tangential · Widerstand“ (je 0-100 %, Standard 30 %). Die acht
Rauten wechseln sich radial/tangential ab (Index 0, 2, 4, 6 = radial;
1, 3, 5, 7 = tangential).

- **0 %** = kein Widerstand: die Kugel prallt verlustfrei ab (Restitution 1,
  keine Reibung).
- **100 %** = totaler Widerstand: kein Rückprall, maximale Reibung
  (Restitution 0) - die Kugel verliert an dieser Raute praktisch ihr
  gesamtes Tempo in Stoßrichtung.
- Dazwischen linear. Formel in `ball-config.ts` (`deflectorMaterial()`).

Getestet: die Umrechnungsfunktion selbst (0 %/50 %/100 % ergeben die
erwarteten Stoßwerte, Begrenzung auf 0-100 %) sowie ein vollständiger Wurf
mit den Extremwerten (0 % radial, 100 % tangential) gegen alle Prüfungen
aus `checkPlan` (Geometrie, Fenster, Stillstand, Durchdringung, Schwerkraft
im Flug).

**Wichtig:** Diese Änderung ist bislang nur in `roulette-src` (Quellcode).
Der gebaute Stand in `roulette/` (das, was das TV-Dashboard tatsächlich
lädt) ist unverändert, auf Wunsch des Betreibers - er wechselt gerade vom
ODROID auf ein ACEMAGIC W1 mit EndeavourOS, das erst am Folgetag eintrifft.
Vor dem Umzug auf die neue Box soll sich am laufenden Dashboard nichts
ändern. Sobald der neue Rechner steht: `npm run build`, dist-Inhalt nach
`roulette/` kopieren, dann deployen.
