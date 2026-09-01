# Nightlife-Widget

Zeigt Nachtleben-Videos einer Stadt. Steht an **erster Stelle** im Zyklus,
laeuft **5 Minuten** pro Auftritt, Tag und Nacht.

## Stadt wechseln (alle 2 Wochen)

Nur `nightlife.json` bearbeiten - sonst nichts:

https://github.com/motte025/City-cafe/blob/main/nightlife.json

```json
{
  "stadt": "Miami · Brickell",
  "untertitel": "Nightlife-Tour durch den Luxusbezirk",
  "videos": [
    { "videoId": "5E9wyQI5Z0k", "titel": "Brickell bei Nacht" },
    { "videoId": "iHcREEIHOGk", "titel": "Unterwegs in Brickell" },
    { "videoId": "0cxMDe9jYi0", "titel": "Miamis Luxusviertel" }
  ]
}
```

- `videoId` = der Teil hinter `youtu.be/` bzw. hinter `watch?v=`.
  Aus `https://youtu.be/5E9wyQI5Z0k?is=ANfuKTDf` wird also `5E9wyQI5Z0k`.
- `titel` steht im Kopf ueber dem Video. Weglassen geht, dann steht dort der
  `untertitel`.
- Beliebig viele Videos, mindestens eines. Leere Liste = Widget faellt aus.
- **Keine Laufzeiten eintragen** - die holt sich das Dashboard selbst vom Player.

Nach dem Speichern auf GitHub ist die neue Stadt beim naechsten Auftritt drauf.
Der Screen muss nicht neu gestartet werden.

## Wie der Startpunkt wandert

Damit nicht jedes Mal derselbe Anfang laeuft, verschiebt sich der Einstieg bei
jedem Auftritt um 5 Minuten: erst ab 0:00, dann ab 5:00, dann ab 10:00 und so
weiter. Ist das Video durch, geht es wieder bei 0:00 los.

Angeschnitten wird nie: passen die vollen 5 Minuten nicht mehr ins Video, wird
sofort wieder vorne begonnen. Ein Video unter 5 Minuten startet also immer bei
0:00 und laeuft im Slot einmal durch (danach beginnt es von vorne).

Der Stand ueberlebt einen Neustart des Screens (localStorage).

## Warum es fluessig laeuft

Der YouTube-Player wird **einmal beim Seitenstart** gebaut und danach nie wieder
neu. Direkt nachdem der Slot vorbei ist, holt er sich das naechste Video schon
in den Puffer und haelt an. Bis zum naechsten Auftritt ist die Rotation einmal
herum - das Video liegt dann lokal und startet ohne Ladepause.

Die Bildqualitaet haengt bei YouTube an der Groesse des Players. Deshalb rechnet
er intern in **1920x1080** und wird nur per CSS auf die Buehne heruntergerechnet
(`transform: scale(0.625)`). Bei den frueheren 1200x675 lieferte YouTube 720p,
das auf dem Fernseher sichtbar unscharf ankam.

## Wenn ein Video nicht laeuft

Manche Videos duerfen nicht eingebettet werden (Einstellung des Kanals). Das
Dashboard merkt das selbst, nimmt das Video fuer diesen Seitenaufruf aus der
Liste und schaltet sofort weiter, statt 5 Minuten schwarz zu bleiben.

Dauerhaft loswerden: `videoId` aus `nightlife.json` streichen.

Pruefen laesst sich das vorab, indem man
`https://www.youtube.com/embed/<videoId>` direkt im Browser aufruft. Kommt dort
"Video ist nicht verfuegbar", geht es auch im Dashboard nicht.

## Stellschrauben

In `index.html` in `NL_CONFIG`:

https://github.com/motte025/City-cafe/blob/main/index.html

| Wert | Bedeutung | Standard |
| --- | --- | --- |
| `sekundenProVideo` | Standzeit pro Auftritt, zugleich die Schrittweite des Startpunkts | `300` (5 Min) |
| `vorladeSekunden` | wie lange das naechste Video im Hintergrund puffert | `30` |
| `quelle` | Datei mit den Videos | `nightlife.json` |
