# Auftrag für Claude Code auf dem Windows-PC (Beelink) – W1 nach dem DJ-Modus-Update

Geschrieben am 19.10.2026 um 00:15 von der Sitzung am PC zuhause (EndeavourOS), die **keinen
Zugriff auf den W1** hat. Diese Sitzung hat `ssh w1`. Gesprächssprache: Deutsch.

**Zuerst lesen:** `STAND.md` (Abschnitt „18./19.10.2026: DJ-Modus“ und „Feste Regeln“), dann
`dj-studio/UEBERGABE.md`. Arbeitskopie: `C:\Users\motte\City-cafe` → vorher `git pull --rebase
origin main` (Stand mindestens Commit `9cde067d`).

## Was passiert ist

Am 19.10. um 00:05 wurde der Branch `dj-studio` nach `main` gebracht (Merge `62a29550`). Darin:

- **DJ-Modus** der YouTube-Musik (TV zeigt das DJ Studio, mpv im Studio-Videofenster). In
  `index.html` **nur für `raum=zuhause` freigeschaltet** (`YTM_DJ_ERLAUBT`). Im Café wird das
  Studio nicht geladen.
- **Supervisor** (`kiosk/nl-mpv-supervisor.py`): im DJ-Modus zusätzliche Messung je Song
  („Studio-Spur“: Wellenform, BPM, Tonart, Pegel; ffmpeg mit `-readrate 8`), gespeichert unter
  `~/.cache/citycafe/spuren/` (≤ 600 MB). **Im Normalbetrieb misst er nichts zusätzlich.** Neu
  einstellbar: `CITYCAFE_COOKIES`, `CITYCAFE_JS_RUNTIME` – Standard wie bisher (Kiosk-Profil,
  `node`). Neue Importe nur aus der Standardbibliothek (`gzip`, `tempfile`).
- **Playlists für alle Räume gemeinsam** (`djremote/city-cafe/yt/listen`) und Playlist-Suche in der
  Musik-Fernbedienung.
- **Werbungs-Wächter** in `index.html` prüft nicht, solange mpv die Musik spielt.

Der W1 holt den neuen Supervisor mit dem Update um **8:30** (`citycafe-update.timer`) und startet
ihn neu. Der Café-TV lädt die neue Seite selbst, sobald keine Musik läuft.

## Aufgabe 1 – Nach 8:30 prüfen, dass im Café alles normal läuft (Pflicht)

Nur lesen, nichts neu starten. Ergebnis dem Betreiber kurz melden.

1. **Update angekommen?**
   `ssh w1 "tail -40 /var/log/citycafe-update.log"` – Supervisor aus `main` geholt, Syntaxprüfung
   bestanden, Neustart erfolgt? Vergleich mit dem Repo:
   `ssh w1 "grep -c SPUR_VERSION /opt/citycafe/nl-mpv-supervisor.py"` (muss ≥ 1 sein).
2. **Supervisor läuft fehlerfrei?**
   `ssh w1 "pgrep -af nl-mpv-supervisor; tail -30 /home/citycafe/nl-mpv-supervisor.err"` –
   keine Python-Tracebacks (vor allem keine `NameError`/`ImportError`).
3. **Musik normal?** (sobald im Café Musik läuft)
   `ssh w1 "grep -E 'Intro/Ausklang|Ueberblendung|Lautheit gesetzt|Slot vorbei|abgebrochen|Studio-Spur' /home/citycafe/nl-mpv-supervisor.log | tail -40"`
   - Erwartet: „Intro/Ausklang … Lautheit …“ je Song, „Ueberblendung … (8,5–9 s)“ bzw. die
     eingestellte Blende, „Ueberblendung fertig“.
   - **Nicht** erwartet: „Studio-Spur“ (das gibt es nur im DJ-Modus), gehäuft „Slot vorbei“ oder
     „Ueberblendung abgebrochen“.
4. **TV-Seite neu?** `ssh w1 "sudo -u citycafe kiosk-cdp \"typeof YTM_DJ_ERLAUBT + ' ' + YTM_DJ_ERLAUBT\""`
   → nach dem Selbst-Update `boolean false`. Steht dort `undefined`, ist noch die alte Seite
   geladen – **nicht von Hand neu laden** (unterbricht die Musik), außer der Betreiber will es.
5. **yt-dlp findet Videos?** Im Log keine Häufung von „yt-dlp ohne URL … Sign in to confirm“.

Bei einem Fehler: Ursache suchen und dem Betreiber melden. Wenn der neue Supervisor nicht läuft
und die Musik im Café ausfällt: mit Freigabe des Betreibers die vorige Fassung zurück
(`git show e3ffc2e2:kiosk/nl-mpv-supervisor.py` – das war `main` vor dem Merge), per `scp` nach
`/opt/citycafe/`, CRLF entfernen (`tr -d '\r'`), Supervisor wie in `KIOSK-SUPERVISOR.md` neu starten.

## Aufgabe 2 – DJ-Modus auf dem W1 messen (nur mit Freigabe, am besten wenn das Café zu ist)

Ziel: Bevor der DJ-Modus im Café freigeschaltet wird, Last und Bildrate auf dem W1 kennen.

- Freischalten geht nur per Code: `YTM_DJ_ERLAUBT` in `index.html` auch für `city-cafe`. **Nicht
  ohne ausdrücklichen Auftrag des Betreibers** und nicht während Gäste da sind.
- Zum Messen besser vorübergehend auf dem W1 selbst testen (z. B. zweites Chromium-Profil mit
  `?raum=zuhause`, siehe UEBERGABE.md Abschnitt 4 – dort steht der Test-Aufbau vom PC zuhause).
- Messen: CPU/GPU (`top`, `radeontop` falls vorhanden), Bildrate des Studios
  (`kiosk-cdp`, z. B. `requestAnimationFrame`-Zähler über 5 s), Temperatur. Zum Vergleich in
  `STAND.md`: Musik im Vollbild ~7 % CPU, GPU ~22 %.
- Ruckelt das Studio, in `dj-studio/js/main.js` den Bildtakt im TV-Modus auf 30 fps begrenzen.

## Aufgabe 3 – Playlists vormessen (eingebaut am 19.10., läuft von selbst)

Der Supervisor kann alle Playlist-Songs vormessen, solange **keine Musik läuft** (Liste von der
TV-Seite, ~700 Songs, ~25 s + 15 s Pause je Song, ~190 MB unter
`/home/citycafe/.cache/citycafe/spuren/`). Danach sind Wellenform, BPM und Tonart im DJ-Modus sofort
da. Schon gemessene Songs werden übersprungen; nach 3 yt-dlp-Fehlern in Folge 1 h Pause.

- **Standard an** (Betreiber 19.10.): läuft auf dem W1 nach dem Update um 8:30 von selbst, sobald
  keine Musik spielt. Abschalten: `CITYCAFE_VORMESSEN=0` in `/home/citycafe/.config/citycafe.env`,
  wirkt nach dem nächsten Supervisor-Start.
- Fortschritt im Log: `grep Vormessen /home/citycafe/nl-mpv-supervisor.log`.
- Beobachten: keine Häufung von „Sign in to confirm you're not a bot“ (dann ausschalten).

## Aufgabe 4 – Offene Kleinigkeiten (nur auf Wunsch)

- „Theo, wir fahr'n nach Lodz“ und „Marmor, Stein und Eisen bricht“ (Stereoact) sollen aus
  „Schlager“, „Après-Ski“ und „Schlager 2024–2026“ raus. Am einfachsten macht das der Betreiber am
  Handy (Musik → Listen → 🔎 → ✕).
- **Seltenes Überspringen** eines Songs (zweimal am 18.10. zuhause): Die Seite schaltet zweimal
  „Weiter“, „Ueberblendung abgebrochen“ im Log, der vorgeladene Song gilt als gespielt. Ursache
  unbekannt. Auf dem W1 im Log nach „Ueberblendung abgebrochen“ suchen; falls es dort auch
  vorkommt, Mitschreiber auf `ytmWeiter` setzen (siehe UEBERGABE.md Abschnitt 6) und den Auslöser
  bestimmen.

## Regeln (aus STAND.md, hier besonders wichtig)

- TV-Seite neu laden oder Supervisor neu starten **nur nach Rückfrage** – es unterbricht die Musik.
- Kein Push nach `main` ohne Freigabe des Betreibers; `main` landet am nächsten Morgen auf dem W1.
- Keine Zugangsdaten ins Repo (Chef-PIN, Kamera).
- Nie `pkill -f` über ssh; über die Prozessnummer gehen. Skripte per `scp`, nicht als Heredoc.
- Arbeitskopie auf dem Beelink hat CRLF – vor dem Übertragen auf den W1 `tr -d '\r'`.
- Kein Python am Beelink: Prüfungen per `ssh w1 python3 -` (Datei über stdin).
