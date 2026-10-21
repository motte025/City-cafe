# Auftrag für Claude Code auf dem Windows-PC (Beelink) – W1 nach dem Update vom 21.10.2026

Geschrieben am 21.10.2026 von der Sitzung am PC zuhause (EndeavourOS, **kein Zugriff auf den W1**).
Diese Sitzung hat `ssh w1`. Gesprächssprache: Deutsch.

**Zuerst lesen:** `STAND.md` (Abschnitt „21.10.2026“ und „Feste Regeln“), dann
`dj-studio/UEBERGABE.md` Abschnitt 0. Arbeitskopie `C:\Users\motte\City-cafe` → vorher
`git pull --rebase origin main`.

## Was auf `main` neu ist (kommt mit dem Update um 8:30 auf den W1)

- **Supervisor:** Überblendung fest 9 s, Tonwechsel genau am Musikende (neuer Song wird 15 s vorher
  angehalten geladen und sekundengenau gestartet), neuer Messwert `einsatz` (volle Musik nach
  leisem Intro), **Lautheit −14 statt −11 LUFS** (alles 3 dB leiser, aber gleichmäßiger).
- **TV-Seite / DJ Studio:** 13 Skins (Auswahl am Chef-Handy), Meter/Fader/MIX-Felder pixelgenau,
  Play-Taste in Wellenfarbe, Taktraster mit genauem Tempo, ruhige Welle, Anzeige-Vorlauf
  (`studioVorlauf`), Pegelanzeige wie vorher.
- **Fernbedienung:** Lyrics-Suche, Überblendungs-Einstellung entfernt, Skin-Auswahl, Songs vom
  Handy werden nie gegen ein anderes Video getauscht. Fußzeile: „Fassung 2026-10-21-lyrics-skins-9s“.

## Aufgabe 1 – nach 8:30 prüfen (nur lesen, nichts neu starten)

1. Update angekommen:
   `ssh w1 "tail -30 /var/log/citycafe-update.log; grep -c XF_VORLAUF_SEK /opt/citycafe/nl-mpv-supervisor.py; grep -n 'LAUT_ZIEL_LUFS = ' /opt/citycafe/nl-mpv-supervisor.py"`
   → `XF_VORLAUF_SEK` ≥ 1, `LAUT_ZIEL_LUFS = -14.0`.
2. Supervisor läuft fehlerfrei:
   `ssh w1 "pgrep -af nl-mpv-supervisor; tail -30 /home/citycafe/nl-mpv-supervisor.err; grep 'Blende 9 s (fest)' /home/citycafe/nl-mpv-supervisor.log | tail -1"`
3. Überblendungen (sobald Musik läuft):
   `ssh w1 "grep -E 'Ueberblendung|Tonwechsel|neu vorbereiten|Notbremse|zu spaet' /home/citycafe/nl-mpv-supervisor.log | tail -30"`
   - Erwartet je Song: `Ueberblendung: alt -> neu (Musikende alt …s in ~15s, neu ab …, Musik ab …, voll ab …)`,
     ~12 s später `Tonwechsel …: neu bei X s (volle Musik ab X s), alt bei Y s (Musikende Y+2 s)`
     (X und Y±0,3 s), dann `Ueberblendung fertig`.
   - Nicht gehäuft: `abgebrochen`, `Notbremse`, `zu spaet`. Zuhause gemessen: ±0,2 s.
4. TV-Seite neu: `ssh w1 "sudo -u citycafe kiosk-cdp \"typeof YTM_DJ_SKINS + ' ' + nlTon.blende\""`
   → `object 9`. Steht `undefined`, ist die alte Seite geladen – **nicht von Hand neu laden**
   (unterbricht die Musik), außer der Betreiber will es.
5. **Dem Betreiber sagen:** Endstufe um ~3 dB lauter stellen (Lautheit −14 LUFS). Er weiß Bescheid
   und hat zugestimmt („Endstufe stark genug“).

## Aufgabe 2 – Welle im Café auf den Ton abgleichen (mit dem Betreiber vor Ort, DJ-Modus an)

Die Welle zeigt die Position von mpv. Was man **hört**, kommt über Bluetooth zur Anlage später, was
man **sieht**, über den TV etwas später. Ausgleich: `studioVorlauf` in Sekunden (positiv = Welle
früher, negativ = später). Er liegt im `localStorage` der TV-Seite (gilt auch fürs Studio im
iframe, gleicher Ursprung), wirkt nach ≤ 1 s, **ohne Neuladen, ohne Musikunterbrechung**.

- Wert lesen: `ssh w1 "sudo -u citycafe kiosk-cdp \"localStorage.getItem('studioVorlauf')\""`
- Wert setzen (Beispiel −0,05 s, der Wert vom PC zuhause):
  `ssh w1 "sudo -u citycafe kiosk-cdp \"localStorage.setItem('studioVorlauf','-0.05')\""`
- Zurück auf Standard 0: `… kiosk-cdp \"localStorage.removeItem('studioVorlauf')\"`
- Vorgehen: Song mit festem Tempo spielen (z. B. Uptown Funk, 115 BPM). Betreiber schaut auf die
  Mittellinie der Welle: **Spitze kommt nach dem Schlag** → Wert um +0,05 erhöhen; **Spitze kommt
  vor dem Schlag** → um 0,05 senken. Schritte 0,05, am Ende 0,02. Bereich −1 … +1.
- Zuhause (B03 Pro mit aptX HD, Monitor im KDE-Fenster): −0,05 s. Im Café andere Kette (TV-Eingang,
  Bluetooth zur Anlage) → eigener Wert, vermutlich zwischen −0,25 und +0,1.
- Den gefundenen Wert in `STAND.md` (Abschnitt 21.10., „Anzeige-Vorlauf“) eintragen. Soll er
  dauerhaft auch nach einem neuen Kiosk-Profil gelten: `STUDIO_VORLAUF_SEK` in
  `dj-studio/js/tv.js` setzen (nur mit Freigabe nach `main`).
- Position prüfen (Studio gegen mpv): `werkzeuge/position_pruefen.py` braucht CDP + mpv-Socket;
  auf dem W1 als citycafe laufen lassen (Skript per `scp`, Pfad zum Socket `/tmp/mpv-nl.sock`).
  Zuhause: Studio − mpv im Mittel −0,02 s (ohne Vorlauf).

## Aufgabe 3 – beat_this auf dem W1 einrichten (Takt und Eins, mit Freigabe, Café zu)

**Vorerst nicht nötig (Betreiber 21.10.):** die Takt-Dateien werden am PC zuhause eingelesen und
kommen über das Repo (`dj-studio/takt/`) auf den Café-TV. Für das Update heute also direkt
`ssh w1 "sudo systemctl start citycafe-update.service"` und Aufgabe 1. Die folgende Anleitung
gilt nur, falls der W1 später doch selbst rechnen soll.

Seit 21.10. rechnet der Supervisor für jeden gemessenen Song Schläge und Takt-Einsen mit
**beat_this** (CPJKU, frei), wenn es in einer eigenen Python-Umgebung liegt – sonst wie bisher.
Ergebnis `~/.cache/citycafe/takt/<id>.json`, an die Seite als `window.nlStudioTakte`. Zuhause
getestet (Takt nach ~40 s, Studio übernimmt ihn). Einrichten als Benutzer `citycafe`:

```sh
ssh w1
sudo -u citycafe -H sh -c '
  python3 -m venv ~/.local/share/citycafe/beat-venv &&
  ~/.local/share/citycafe/beat-venv/bin/pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cpu &&
  ~/.local/share/citycafe/beat-venv/bin/pip install -q numpy soxr soundfile https://github.com/CPJKU/beat_this/archive/main.zip &&
  ~/.local/share/citycafe/beat-venv/bin/python -c "from beat_this.inference import File2Beats; File2Beats(checkpoint_path=\"final0\", device=\"cpu\"); print(\"beat_this ok\")"'
```
(~1 GB; das Modell `final0` lädt beim letzten Befehl nach `~/.cache/torch/hub`. Zuhause:
torch 2.14.1+cpu, torchaudio 2.11.0+cpu – torchaudio **muss** aus dem CPU-Index kommen, sonst
„Could not load … _torchaudio.abi3.so“.)

- **Startbestand übernehmen** (spart Stunden Rechnen): die fertigen Dateien aus dem Repo
  `dj-studio/takt/*.json` nach `/home/citycafe/.cache/citycafe/takt/` kopieren (scp, Besitzer
  citycafe). Fehlende rechnet das Vormessen nach (nur ohne Musik) bzw. der Supervisor beim Abspielen.
- Wirkt nach dem nächsten Supervisor-Start (8:30 oder von Hand nach Rückfrage).
- Prüfen: `grep "Takt " /home/citycafe/nl-mpv-supervisor.log | tail` → `Takt <id>: N Schlaege, M Einsen (…s)`;
  Fehler: `Takt <id>: nicht gerechnet (Code …)`. Last: `top` – der Rechner läuft mit `nice 19`
  und 1 Kern (~7 s je Song + Laden). DJ-Modus muss flüssig bleiben (60 fps, siehe Aufgabe 2).
- Abschalten: Umgebung umbenennen oder `CITYCAFE_TAKT_PYTHON=/nichts` in `citycafe.env`.

## Aufgabe 4 – Skin im Café (nur auf Wunsch)

Chef-Handy → Musik → „⚙️ Anzeige & Anlage“ → Liste unter dem DJ-Knopf. Per CDP:
`ssh w1 "sudo -u citycafe kiosk-cdp \"ytmBefehl({was:'djSkin', skin:'gold', id:'x'+Date.now()})\""`
(lädt nur das Studio neu, die Musik läuft weiter). Kürzel: bild2, amber-blau, blau-amber, tiefglas,
gold, weiss, chrom, ladys-tuerkis, elfenbein, carbon, ladys-pink, onyx, champagner.

## Bei Problemen

- Lücken/harte Wechsel: Log-Zeilen aus Aufgabe 1.3 an den Betreiber/die nächste Sitzung. Rückfall
  auf die alte Überblendung: `git show 4fb5f61b^1:kiosk/nl-mpv-supervisor.py` ist `main` direkt
  vor dem Merge vom 21.10. (mit Freigabe per `scp` nach `/opt/citycafe/`, CRLF entfernen, Supervisor neu wie in
  `KIOSK-SUPERVISOR.md`).
- Zu leise: Endstufe. Nicht `LAUT_ZIEL_LUFS` zurückdrehen ohne Rücksprache.

## Regeln (aus STAND.md, hier besonders wichtig)

- TV-Seite neu laden oder Supervisor neu starten **nur nach Rückfrage** – es unterbricht die Musik.
- Kein Push nach `main` ohne Freigabe des Betreibers; `main` landet am nächsten Morgen auf dem W1.
- Keine Zugangsdaten ins Repo (Chef-PIN, Kamera).
- Nie `pkill -f` über ssh; über die Prozessnummer gehen. Skripte per `scp`, nicht als Heredoc.
- Arbeitskopie auf dem Beelink hat CRLF – vor dem Übertragen auf den W1 `tr -d '\r'`.
- Kein Python am Beelink: Prüfungen per `ssh w1 python3 -` (Datei über stdin).

## Frühere Aufgaben (19.10.2026) – erledigt

Update geprüft, DJ-Modus auf dem W1 gemessen (CPU 10–11 %, GPU 12 %, 60 fps, bis 58 °C),
Vormessen 707 Songs, Muster B behoben. Offen bleibt das seltene Überspringen (siehe STAND.md).
