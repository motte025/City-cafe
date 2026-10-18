# Übergabe DJ Studio (Stand 18.10.2026, abends)

Für die nächste Claude-Code-Sitzung, zum Beispiel unter EndeavourOS zuhause.
Zuerst diese Datei lesen, dann `dj-studio/README.md`. Gesprächssprache: Deutsch.

## 1. Was fertig ist (Branch `dj-studio`)

- **Bild 2 ist die Bühne.** `img/bild2-2x.webp` ist Bild 2, mit ESRGAN auf 3344×1882 hochgerechnet. `js/skin.js` legt jedes echte Bedienelement pixelgenau auf seine Stelle im Bild. Veränderliche Stellen werden beim Start „geputzt“ (`FLICKEN_*`). `css/skin.css` liegt in der CSS-Ebene `skin` (siehe `css/haupt.css`). `?klassisch` zeigt die alte, gezeichnete Oberfläche.
- **Live:** beide Kanäle, Mitte (Programmbild = Clubfoto + Licht, Transport, Master, Crossfader), Kopf (Uhr), „Nächste Titel“. LEDs und Pegelmeter sind neu gestaltet, die Meter folgen der gedruckten Skala im Bild.
- **Tests:** `tests/studio.browser.test.js` hat alle 14 Prüfungen bestanden.
- **Gemessen (PC, 18.10.):**
  - Ausgangssteuerung VIDEO/AUDIO/AUTO arbeitet wie vorgesehen.
  - Master 0 ergibt Stille.
  - Beide Kanäle mit +12 dB und Master voll: Spitze −3,7 dBFS, kein Übersteuern.
  - BPM-Anzeige = Raster × Tempo. Das gilt nur für Demo-Titel; ihre Werte stammen aus dem Generator.

## 2. Nächste Aufgabe: DJ-Modus für die YouTube-Musik (Wunsch des Betreibers)

Vorgaben des Betreibers:
- Gesteuert wird mit der **bestehenden YouTube-Musik-Fernbedienung** (`yt-fernbedienung.html`). Dort kommt nur ein **DJ-Modus** dazu.
- **Der Ton geht immer auf die Anlage.** Er kommt weiter von mpv, wie heute. Das Studio gibt selbst keinen Ton aus.
- Im DJ-Modus zeigt der TV das DJ Studio, und das **YouTube-Video (mpv) sitzt im kleinen Videofenster** in der Mitte des Studios.
- **Erst zuhause testen**, dann im City Cafe.

### 2.1 Was im Code schon passt

Grundlage ist die Vollbild-Umschaltung aus YOUTUBE-MUSIK-SETUP.md 6.8:
- `index.html` meldet die aktive Videofläche in `window.nlMpvFlaeche` (`'nl-player-frame'` oder `'yt-vollbild-video'`), siehe `ytmAnzeigen()` bei ca. Zeile 9041.
- Der Supervisor misst diese Fläche per CDP und setzt mpv darauf: `FLAECHE` und `RECT_EXPR` in `kiosk/nl-mpv-supervisor.py` (ca. Zeile 304–318), Umschalt-Wächter `umschalt_waechter()` (ca. Zeile 1430). Dabei wird mpv nicht neu gestartet und yt-dlp nicht neu aufgerufen.
- Befehl vom Handy: `musik('vollbild'|'normal')` in `yt-fernbedienung.html` (Knopf `k-ansicht`, ca. Zeile 958), umgesetzt in `index.html` bei ca. Zeile 8835 (zuerst `nlMpvAusblenden`, 250 ms später umbauen).
- Status an das Handy: `yt/jetzt` mit `vollbild` (ca. Zeile 8151), beim Neustart wieder gelesen (ca. Zeile 9332).

### 2.2 Geplanter Einbau

1. **`index.html`:**
   - neue Ebene `#ytm-dj`, aufgebaut wie `#ytm-vollbild` (`position:absolute; inset:0; z-index:520` im `#dashboard-scaler`).
   - Darin `<iframe src="dj-studio/?tv">` mit 1920×1080 und darüber ein leeres `<div id="yt-dj-video">` genau auf dem Studio-Videofenster.
   - Lage des Videofensters: im Bild `[557, 85, 557, 298]` × 1920/1672 = **left 639.6px, top 97.6px, width 639.6px, height 342.2px**. Das Fenster ist nicht 16:9; mpv setzt schmale schwarze Ränder links und rechts.
   - Zustand `ytmDj`. Befehl `'dj'` schaltet ein (Vollbild aus), `'normal'` und `'vollbild'` schalten aus. Gleiches Muster wie Vollbild (`nlMpvAusblenden`, dann umbauen).
   - `window.nlMpvFlaeche = 'yt-dj-video'`, wenn `ytmDj`.
   - `dj: ytmDj` nach `yt/jetzt` schreiben und beim Neustart lesen.
   - Daten ans Studio per `postMessage`, gleicher Ursprung, bei jeder Änderung und jede Sekunde: jetzt (Titel, Künstler, Genre/Jahr, Dauer, Position, pausiert, Cover `i.ytimg.com/vi/<id>/mqdefault.jpg`), nächster Titel (vorgeladen, kommt auf Kanal 2), die nächsten Titel der Warteschlange.
   - Die Ebene in `runMasterSequence()` abbauen (STAND.md) und bei Hos'n Obe schließen, wie beim Vollbild.
2. **Supervisor:**
   - `FLAECHE["yt_dj"] = ("ytm-dj", "yt-dj-video")`.
   - Im Umschalt-Wächter und in der Hauptschleife `art = "yt_dj"`, wenn die Fläche `yt-dj-video` ist. Achtung: Die Ebene `#ytm-dj` braucht die Klasse `active` (`RECT_EXPR` prüft das).
   - **Erst auf dem Test-W1 von Hand prüfen, dann pushen** (YOUTUBE-MUSIK-SETUP.md 2.6).
3. **Studio, TV-Ansicht `?tv`:**
   - keine Startkarte, keine Demo-Titel, AudioContext angehalten (`ctx.suspend()`), also kein eigener Ton.
   - Neues Modul `js/tv.js` liest die Nachrichten und schreibt sie in den Store. Kanal 1 = laufender Song (`spielt` = nicht pausiert, Position hochgerechnet), Kanal 2 = nächster Song, Leiste = Warteschlange.
   - Im Bildtakt `tv.takt()` statt `engine.takt()` aufrufen.
   - `artwork.js`: `cover()` gibt `track.coverUrl` zurück, falls vorhanden.
   - Ehrlich bleiben: BPM, Key, Wellenform und Pegel gibt es bei YouTube nicht. Die Anzeige zeigt dann `---.-`, „YOUTUBE · KEINE WELLENFORM“ und dunkle Meter. DEMO-Schilder in der TV-Ansicht ausblenden, weil dort echte Titel laufen.
   - Keine Bedienung am TV, nur Anzeige.
4. **`yt-fernbedienung.html`:**
   - Knopf „🎛 DJ-Modus / ▭ Normal“ neben Vollbild, nur für Chef-Geräte, sendet `musik('dj')`.
   - Fassungsnummern hochzählen (GitHub Pages speichert bis 15 min zwischen).

### 2.3 Später möglich (nicht Teil des ersten Schritts)

- **Echte Pegel aus mpv:** Der Supervisor misst je Song schon Pegel mit ffmpeg (alle 0,5 s, für Intro/Ausklang). Diese Messkurve könnte die Übersichts-Wellenform und die Meter speisen. Das wären echte Messwerte, nur nicht live.
- **Die 9-s-Überblendung zweier mpv** als Crossfader-Bewegung im Studio anzeigen.

## 3. Grenzen (aus dem Auftrag, nicht aufweichen)

- YouTube wird nicht als ladbare oder analysierbare DJ-Quelle gebaut (kein Download, keine Analyse im Studio). Im DJ-Modus spielt weiter der bestehende TV-Weg (mpv + yt-dlp) und das Studio **zeigt nur an**.
- Über dem mpv-Video darf kein HTML liegen, es wäre unsichtbar.
- Kein Push nach `main` und keine Änderung am Live-W1 ohne Test und Freigabe des Betreibers.

## 4. Test-Box zuhause (Kopie des W1) auf Stand bringen

Die Box zuhause ist eine Kopie des W1 und muss zuerst auf den aktuellen Stand. Dabei vier Fallen beachten:

1. **Raum:** In `~/.config/citycafe.env` (Benutzer `citycafe`) muss `CITYCAFE_RAUM=zuhause` stehen, **nicht** `city-cafe`. Sonst hören Café-TV und Test-Box auf dieselbe Fernbedienung und spielen beide los. Ohne Eintrag gilt `zuhause` (`kiosk/citycafe-chromium`).
2. **Nächtliches Update:** `citycafe-update.timer` holt jeden Morgen um 8:30 den Supervisor aus `main` und würde Test-Änderungen überschreiben. Während des Tests in `/etc/citycafe-update.conf` abschalten.
3. **Dashboard vom Branch statt von GitHub Pages:** Standard ist `https://motte025.github.io/City-cafe/`, also `main`. Für den Test den Repo-Klon auf `dj-studio` lokal ausliefern und `CITYCAFE_URL=http://127.0.0.1:8090/index.html` setzen (im Starter so vorgesehen). Den Supervisor ebenfalls aus dem Klon nehmen.
4. **Tailscale:** Läuft die Kopie mit derselben Tailscale-Kennung wie „city-cafe-w1“, gibt es zwei Geräte unter einem Namen. Prüfen und die Kopie gegebenenfalls umbenennen oder neu anmelden.

Danach: `pacman -Syu`, yt-dlp aktuell halten, Premium-Cookies und Chef-PIN aus `citycafe.env` übernehmen (Geheimnisse nie ins Repo). Normale Musik einmal ohne DJ-Modus testen, dann den DJ-Modus.

## 5. Zuhause unter EndeavourOS starten

```
git clone <repo-url> City-cafe   # oder vorhandenen Klon nehmen
cd City-cafe && git fetch && git checkout dj-studio
node dj-studio/tools/server.js            # http://localhost:8790/dj-studio/
npx playwright install chromium           # einmal, für den Test
node dj-studio/tests/studio.browser.test.js   # ohne PW_CHANNEL = Playwright-Chromium
```
