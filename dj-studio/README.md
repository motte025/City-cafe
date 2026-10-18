# City Cafe DJ Studio – Prototyp (Phase A)

Eigenständiger DJ-/VJ-Modus mit zwei Kanälen nach der Vorlage „Bild 2“ (Desktop, ChatGPT-Bild vom 18.10.2026).
**Getrennt vom Café-Betrieb:** kein Teil von `index.html`, Supervisor, Firebase oder W1. Die Arbeit liegt auf dem lokalen Branch `dj-studio`, nichts ist nach `main` gepusht.

```
node dj-studio/tools/server.js          # dann http://localhost:8790/dj-studio/
node dj-studio/tests/studio.browser.test.js   # Funktionstest (Playwright; PW_CHANNEL=msedge oder CHROMIUM_PATH=…)
```

Der Browser verlangt einen Klick („Audio starten“), bevor Ton laufen darf. `?ohneStart` lässt die Startkarte weg (für Tests).

## 1. Bestandsaufnahme (Stand Commit `2807ed33`, 18.10.2026)

| Thema | Fundstelle | Befund |
|---|---|---|
| Zwei mpv-Prozesse | `kiosk/nl-mpv-supervisor.py:106` `MPV_SOCK`, `:112` `MPV_SOCK_XF` | Ein Haupt-mpv und ein zweiter nur für die Überblendung. Er ist kein zweites Deck. |
| Crossfade | `nl-mpv-supervisor.py:1366` `ueberblenden()`, `XF_SEK`/`XF_ERLAUBT` (4/6/9 s) | Lautstärke über JSON-IPC beider mpv, Ton-Fenster 2 s mit cos/sin-Kurve. Das Bild blendet über die sway-Fensterdeckkraft. |
| Lautheit | `nl-mpv-supervisor.py:1819` `LAUT_ZIEL_LUFS = -11`, `:1820` `LIMITER_MAX_DB = 2`, `:1827` `anhebung()`, `:1869` `ton_args()` | Je Titel EBU-R128-Messung mit ffmpeg, dann `volume-gain` und höchstens 2 dB `alimiter` im mpv. |
| Pegelwerte aus mpv | `nl-mpv-supervisor.py:1574` (astats nur in der Vorab-Messung) | mpv liefert **keine** laufenden Pegel ab Werk. Für echte Live-Meter bräuchte es `af-metadata` mit astats/ebur128 oder PipeWire-Monitore (siehe Phase B). |
| Single Source of Truth Musik | `index.html:7791–7796`, `yt-warteschlange.js` Kopf | Der **TV** (`index.html`) entscheidet Reihenfolge und Titel. Firebase `djremote/<raum>/yt/warteschlange`, Rückmeldung in `yt/jetzt` und `yt/radio`. |
| Ton-Einstellungen TV | `index.html:7453` `nlTon` | Werte `{ vol, lautheit, limiter, blende }`, gesetzt von der Chef-Fernbedienung. |
| Alter DJ-Bereich | `dj-fernbedienung.html`, `index.html:10380` `djFernBefehlAusfuehren` | Twitch-DJ-Streams, **nicht** angefasst. Veraltete Befehle älter als 120 s werden ignoriert. |
| Video über HTML | `nl-mpv-supervisor.py:1227` `place_mpv()` | mpv-Fenster liegen per sway **über** Chromium. HTML kann nicht über ein laufendes mpv-Bild zeichnen. |

Bei Widersprüchen gilt der Code: `YOUTUBE-MUSIK-SETUP.md` Abschnitt 5 beschreibt dieselbe TV-Hoheit wie `yt-warteschlange.js`.

## 2. Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Gerüst der 1920×1080-Bühne, Startkarte |
| `img/bild2.png` | Bild 2 im Original (1672×941), Kopie der Desktop-Vorlage |
| `img/bild2-2x.webp` | Bild 2 mit KI (ESRGAN thick, UpscalerJS) auf 3344×1882 hochgerechnet; das ist die Bühne |
| `js/skin.js` | Bild als Bühne: Lage jedes Bedienelements in Bild-Pixeln, „Flicken“ für veränderliche Stellen |
| `css/haupt.css` | Lädt alle Styles in zwei Ebenen: `alt` (gezeichnete Optik) und `skin` (Bild 2, gewinnt) |
| `css/skin.css` | Aussehen der Teile über dem Bild (Tasten, LEDs, Knöpfe, Fader, Texte) |
| `css/tokens.css` | **Alle Design-Werte** (Farben, Maße, Schriften, Raster) |
| `css/studio.css` | Aussehen der Bauteile (liest nur Tokens) |
| `js/store.js` | Zustand; nur **bestätigte** Werte, Abonnenten |
| `js/engine.js` | Web-Audio-Engine: Decks, EQ, Filter, Fader, Crossfader, Limiter, Meter-Abgriffe, SYNC, Loops, Cue |
| `js/sources.js` | `MusicSourceAdapter`: `DEMO`, `LOCAL_LICENSED`, `EXISTING_YOUTUBE` sowie die Feature-Matrix |
| `js/demo-synth.js` | Eigener Musik-Generator (8 Testtitel, 122–128 BPM, bekannte Tonart/Raster) |
| `js/analysis.js` | Wellenform-Daten aus PCM (Spitze, RMS tief/mitte/hoch) |
| `js/automix.js` | Automix (16 Takte, taktgenau, Bass-Tausch) |
| `js/artwork.js` | Gezeichnete Cover für Demo-Titel |
| `js/ui/deck.js` | **Ein** Deck-Bauteil für beide Kanäle |
| `js/ui/controls.js` | Drehknopf, Schieberegler, Taster |
| `js/ui/waveform.js`, `js/ui/meter.js` | Wellenformen (Canvas) und LED-Meter mit Ballistik |
| `js/ui/mitte.js`, `js/ui/kopf.js`, `js/ui/leiste.js`, `js/ui/overlays.js` | Programmbild + Master, Kopfzeile, „Nächste Titel“, Menüs und Dialoge |
| `tools/server.js` | Lokaler Testserver (nur 127.0.0.1) |
| `tests/studio.browser.test.js` | Funktionstest im echten Browser |

Es gibt kein Framework und keinen Build-Schritt: ES-Module laufen direkt im Chromium des W1. Für ein Bauteil-Raster dieser Größe bringt React/Vue keinen Nutzen, kostet aber einen Build. Canvas 2D reicht für Wellenformen und Meter (60 fps gemessen). WebGL bleibt eine Option, falls echte Videos dazukommen.

## 3. Spiegelprinzip

- Kanal 2 benutzt dieselbe Funktion `deckBauen()` wie Kanal 1. Gespiegelt wird nur die **Anordnung**: die Klasse `deck--rev` tauscht die CSS-Grid-Bereiche, die Tempo-Zeile läuft als `row-reverse`.
- Texte, Zahlen, Cover und die Zeitrichtung der Wellenform bleiben normal. Der Test prüft, dass kein Element eine spiegelnde Transformation hat (Determinante < 0).
- Bild 2 und der Auftragstext widersprechen sich bei der Lage des Jogwheels. Im Bild liegt es **innen**, Meter und Fader außen; im Text liegt es außen. Standard ist wie im Bild. Unter Einstellungen → „Jogwheel-Lage“ lässt sich das umschalten, Kanal 2 bleibt dabei immer das Spiegelbild.

## 4. Was ist echt? (Feature-Matrix)

| Funktion | Stand | Hinweis |
|---|---|---|
| Zwei Decks gleichzeitig, Play/Pause/Cue/Seek | **funktioniert echt** | Web Audio, je Deck eigene Kette, Ent-Knack-Rampe 4 ms |
| Trim, EQ Hoch/Mitte/Tief (−26…+6 dB), Filter (TP/HP) | **funktioniert echt** | Test: LOW-Kill senkt <120 Hz um ~19 dB |
| Kanalfader, Crossfader (weich/scharf), Master, Limiter | **funktioniert echt** | Fader 0 = Master stumm; Crossfader ganz B = A unhörbar; Limiter −5,6 dB bei +12 dB Trim |
| Pegel A/B (PRE/POST umschaltbar) und Master | **funktioniert echt** | Analyser-Abgriffe, Spitze + RMS, Abfall 26 dB/s, Halten 1,5 s, CLIP ab −0,1 dBFS, GR-Anzeige vom Limiter |
| Wellenform Detail (zoombar) + Übersicht | **funktioniert echt** | aus dem dekodierten PCM; folgt der tatsächlichen Position, auch bei Tempo und Loop |
| BPM, Tonart, Taktraster | **nur Demo** | beim Generator bekannt (Kennzeichen „GEN“); für lokale Dateien Analyse **technisch offen**, Tap-Tempo vorhanden |
| SYNC (Tempo **und** Phase) | **funktioniert echt (Demo)** | Test: 0,0 ms Phasenabstand; ohne Taktraster gesperrt und erklärt |
| Beat-Loop 4–32, IN/OUT, Slip, Quantisierung | **funktioniert echt (Demo)** | Sample-genau (`loopStart/loopEnd`); Beat-Loops nur mit Raster |
| Key-Lock (Tempo ohne Tonhöhe) | **technisch offen** | Web Audio verschiebt die Tonhöhe mit; auf dem W1 mit mpv `scaletempo2`/`rubberband` zu messen |
| Automix | **funktioniert echt (Demo)** | 16 Takte vor Ende, Takt 1 auf Takt 1, Bass-Tausch, danach nächster Titel |
| Programmbild (MAIN VIDEO OUTPUT) | **nur Demo** | Demo-Visual aus Taktphase und gemessenem Pegel; kein Musikvideo |
| Vorhören (CUE-Kopfhörer) | **technisch offen** | braucht einen eigenen Kopfhörer-Ausgang; Ton wird **nie** heimlich auf die Anlage gelegt |
| Video-Effekte (FX) | **technisch offen** | Taste ausgegraut |
| YouTube als DJ-Quelle | **nicht zulässig / nicht freigegeben** | nur Titelanzeige aus `yt_playlists.json`; kein Laden, keine Analyse, kein Mitschnitt |
| Verbindung zu TV, W1, Firebase | **nicht freigegeben** | absichtlich getrennt |

## 5. Audio-Architektur

```
 Deck A / Deck B (identisch)
 ┌────────────────────────────────────────────────────────────────────────────┐
 │ Puffer-Quelle ─► Ent-Knack ─► Trim ─► EQ tief ─► EQ mitte ─► EQ hoch ─►      │
 │   (Tempo = playbackRate)    ±12 dB   180 Hz      1 kHz       3,5 kHz         │
 │ ─► Tiefpass ─► Hochpass ─┬─► Kanalfader ─┬─► Crossfader-Gain ──────────────┐ │
 │   (Filter-Knopf)         │               │                                 │ │
 │                    [Meter PRE]     [Meter POST]                            │ │
 └──────────────────────────────────────────────────────────────────────────┼─┘
                                                                            ▼
                Summe ─► Headroom −3 dB ─► Master-Gain ─┬─► Limiter (−1 dBFS) ─┐
                                                       └─► (Limiter aus) ─────┤
                                                                              ▼
                                                     [Meter MASTER + GR] ─► Ausgang
 CUE/Kopfhörer: nicht gebaut (eigener Ausgang nötig, nie über den Master)
```

Die Bedienung schickt **Wünsche** (`engine.request`). Die Engine begrenzt sie, setzt sie gleitend um (12 ms, ohne Knacken) und bestätigt erst dann im Store. Die Anzeige liest nur bestätigte Werte.

Doppelte Bearbeitung: Im Café regelt mpv Lautheit auf −11 LUFS und begrenzt mit höchstens 2 dB. Würde das Studio später mpv als Quelle nutzen, darf der Master-Limiter dort **nicht zusätzlich** greifen, oder die mpv-Begrenzung muss im DJ-Modus aus sein. Das gehört zu Phase C.

## 6. Design ändern

**Bild als Bühne (Standard seit 18.10.2026).** Bild 2 liegt als Hintergrund der Bühne. `js/skin.js` legt jedes echte Bedienelement pixelgenau auf seine Stelle im Bild (Maße `[x, y, Breite, Höhe]` in Bild-Pixeln). Alles, was sich ändert (Texte, Wellen, Pegel, LEDs, Faderkappen), wird im Bild beim Start „geputzt“ (Liste `FLICKEN_*`) und live darübergezeichnet. Tasten zeigen ihren eigenen Ausschnitt aus dem Bild und leuchten oder werden grau. Knopf- und Faderkappen sind ebenfalls Bildausschnitte, die sich drehen bzw. verschieben. `?klassisch` in der Adresse zeigt die alte, gezeichnete Oberfläche.
- Ein Element verschieben: Eintrag in der passenden Tabelle in `js/skin.js` ändern (`DECK_A`, `DECK_B`, `MITTE`, `KOPF`, `LEISTE`).
- Abweichungen vom Bild: Die Tempo-Bereichstasten heißen ±6/±10/±16 (im Bild −10/+10/+16). INT ist die Tempo-Referenz für SYNC. Das Programmbild ist das Clubfoto aus Bild 2 mit Licht, das live aus Takt und Pegel gezeichnet wird.
- Die Pegel-Schwellen folgen der gedruckten Skala im Bild: Kanal +6…−24 mit oberster LED = 0 dBFS, Master −24…+9 mit +9 = 0 dBFS (`SCHWELLEN_BILD_*` in `js/ui/meter.js`).

**Gezeichnete Oberfläche (`?klassisch`):**

- **Farben, Schriften, Maße:** nur `css/tokens.css`, zum Beispiel `--a` (Kanal 1), `--b` (Kanal 2), `--deck-w`, `--fs-bpm`.
- **Anordnung eines Decks:** in `css/studio.css` die Grid-Bereiche bei `.deck-unten`. Die gespiegelte Fassung steht direkt darunter bei `.deck--rev .deck-unten`.
- **Wellenform-Farben:** `FARBEN` in `js/ui/waveform.js`.
- **LED-Schwellen und Skala:** `SCHWELLEN` und `SKALA` in `js/ui/meter.js`.
- **Ein neues Bedienelement** kommt in `deckBauen()` (`js/ui/deck.js`) und wirkt damit automatisch auf beiden Kanälen.

## 7. Tests und Messwerte (PC, Edge headless, 18.10.2026)

`tests/studio.browser.test.js` hat alle 14 Prüfungen bestanden:
- Stille zeigt keinen Pegel.
- Layout 1920×1080 ohne Überschneidung und ohne Scrollen.
- Kanal 2 gespiegelt, kein gespiegelter Text.
- Play per Klick.
- Fader zu: Master stumm, PRE misst weiter.
- Crossfader an beiden Enden.
- EQ-Kill.
- Limiter mit LIMIT-Anzeige.
- SYNC mit Phase.
- Beat-Loop.
- Maus und Tastatur.
- Ziehen auf ein laufendes Deck gesperrt, auf ein stehendes geladen.
- CUE.
- Lokale WAV-Datei (echte Wellenform, SYNC gesperrt).
- YouTube nicht ladbar.
- Automix über einen ganzen Übergang.

Messwerte:
- 60 fps mit zwei laufenden Decks, längster Frame 19 ms.
- JS-Speicher etwa 75 MB.
- Ein Demo-Titel wird in etwa 1,3 s erzeugt.
- Ausgabelatenz `baseLatency` 10 ms, `outputLatency` 40 ms (PC).

**Auf dem W1 ist noch nichts gemessen.**

## 8. Risiken und offene Punkte

1. **Quelle und Rechte.** Für echtes Auflegen im Café braucht es Musik mit geklärten Rechten: eigene Dateien oder einen DJ-Dienst mit Lizenz. Öffentliche Aufführung (AKM) und vor allem **Videorechte** sind mit dem Betreiber zu klären. YouTube Music Premium ist dafür nicht gedacht.
2. **BPM-Analyse** für fremde Dateien fehlt. Kandidat ist Essentia.js (WASM) im Browser oder Essentia/aubio in Python auf dem W1. Ergebnisse würden nur als Zahlen zwischengespeichert, nie die Musik selbst.
3. **Key-Lock** fehlt in Web Audio. Optionen: mpv mit `rubberband`, AudioWorklet-Timestretch oder ein eigener Python-/PipeWire-Mixer.
4. **Video:** Zwei mpv-Fenster lassen sich unter sway nicht per CSS mischen. Für einen echten Videomix braucht es entweder ein Fenster mit eigenem Mischer (z. B. mpv `--lavfi-complex` mit zwei Eingängen) oder Video im Browser (nur bei freien Quellen).
5. **Vorhören** über Bluetooth: Die A2DP-Latenz (≥150 ms) macht Beatmatching nach Gehör unbrauchbar. Ein kabelgebundener USB-Kopfhörerausgang wäre nötig. Der B03 hat nur einen Stereo-Ausgang.
6. **Speicher:** Ein dekodierter Titel mit 4 Minuten belegt etwa 60 MB (Float32, 48 kHz Stereo). Mehr als 4–6 geladene Titel sollte man nicht vorhalten.

## 9. Nächste Schritte

**Phase B, isoliert auf dem W1, nur nach Freigabe:**
- Dieselbe Seite in einem zweiten Chromium-Profil öffnen, ohne Kiosk und ohne Anlage, mit Kopfhörer am Klinkenausgang.
- Dabei CPU, GPU, Speicher und Bildrate messen, ebenso die Drift zweier Decks über 30 Minuten.
- PipeWire-Knoten dokumentieren (`pw-dump`).
- Prüfen, ob `rubberband` in mpv auf dem Ryzen brauchbar ist.

**Phase C, Integrationsvorschlag, nicht live:**
- Ein **Modus-Schloss** in Firebase (`djremote/<raum>/modus = 'tv' | 'studio'`). Nur der Besitzer startet oder überspringt Titel; der TV gibt die Musik ab und zeigt nur das Programmbild.
- Zeitkritisches bleibt lokal auf der Box, Firebase bekommt nur langsame Wünsche aus der Warteschlange.
- Rückweg: Schloss zurück auf `tv`, der TV nimmt `yt/warteschlange` wieder auf.
- Die Chef-PIN-Prüfung bleibt wie heute. Gäste bekommen nie Zugriff auf Master, EQ oder Ton.

## 10. Bestätigung

Kein Live-Deploy. Keine Änderung am W1, am TV, an Firebase, am Supervisor oder an `index.html`. Kein Push, keine Änderung an `main`: alles liegt nur auf dem lokalen Branch `dj-studio`. Die Desktop-Vorlage ist unverändert. Eine Kopie liegt als `img/bild2.png` im Ordner, weil sie seit 18.10.2026 die Bühne ist.
