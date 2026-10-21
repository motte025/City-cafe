# Übergabe an Claude Code am Windows-PC (Beelink) – Stand 21.10.2026 nachmittags

Geschrieben von der Sitzung am PC zuhause (`martin-ser`, EndeavourOS, **kein Zugriff auf den W1**).
Du (Windows-Sitzung) hast `ssh w1`. Gesprächssprache: **Deutsch**, kurz und verständlich – der
Betreiber ist kein Programmierer.

**Zuerst:** `cd C:\Users\motte\City-cafe` → `git pull --rebase origin main` (Stand mindestens
`0218ec56`). Dann diese Datei ganz lesen. Einzelheiten: `STAND.md` Abschnitt „21.10.2026“,
`dj-studio/AUFTRAG-W1.md` (alle W1-Befehle), `dj-studio/UEBERGABE.md` Abschnitt 0.

## 1. Was heute passiert ist (alles auf `main`)

| Bereich | Was neu ist | Wirkung im Café |
|---|---|---|
| DJ Studio | 13 Skins (Auswahl am Chef-Handy), Meter/Fader/MIX-Felder pixelgenau, Play-Taste in Wellenfarbe, Pause blinkt grün alle 3 s | sofort mit der neuen TV-Seite |
| Welle/Takt | Tempo genau, Welle läuft ruhig, Takt-Striche und **Eins** aus beat_this-Dateien (`dj-studio/takt/*.json`, ~450+, werden am PC zuhause fertig gerechnet und nachgeladen) | TV-Seite |
| Überblendung | **fest 9 s**, Ton wechselt genau am Musikende des alten Songs; leise Intros laufen unter dem Ende mit („Einsatz“); am Handy keine Einstellung mehr | **erst mit neuem Supervisor** |
| Lautstärke | **−14 statt −11 LUFS**: alle Songs gleich laut (79/79 Songs in ±1,5 dB), insgesamt **3 dB leiser** | **neuer Supervisor → Endstufe +3 dB** |
| Messwerte | Lautheit/Anfang/Ende je Song auf der Platte (`~/.cache/citycafe/stille/`) – nach einem Neustart startet kein Song mehr zu laut; Spuren bis 3 GB | neuer Supervisor |
| Fernbedienung | Suche „📝 Lyrics“, Songs vom Handy werden nie gegen ein anderes Video getauscht, Fußzeile „Fassung 2026-10-21-lyrics-skins-9s“ | sofort |
| Supervisor | kann beat_this selbst rechnen (`CITYCAFE_TAKT_PYTHON`) – **vorerst nicht einrichten** (Betreiber: am PC zuhause wird fertig eingelesen) | nichts, solange keine Umgebung |

Der PC zuhause wurde heute um 8:30 vom nächtlichen Kiosk-Update neu gestartet (kein Absturz).

## 2. Was am W1 zu tun ist (der Betreiber will es **heute**)

Café muss zu sein (Neustart unterbricht die Musik 1–2 min). Erst fragen, dann:

1. **Stand prüfen (nur lesen):**
   `ssh w1 "df -h /home; du -sh /home/citycafe/.cache/citycafe/*; grep -c XF_VORLAUF_SEK /opt/citycafe/nl-mpv-supervisor.py"`
   → Freier Platz (Spuren dürfen jetzt bis 3 GB). Bei < 10 GB frei:
   `CITYCAFE_SPUR_MB=600` in `/home/citycafe/.config/citycafe.env` ergänzen (nicht die PIN-Zeilen
   anfassen oder ausgeben). `XF_VORLAUF_SEK` = 0 heißt: alter Supervisor, Update nötig.
2. **Update starten** (holt Supervisor + Chromium-Starter von `main`, startet den W1 danach neu –
   ein bloßer Neustart holt den Supervisor **nicht**):
   `ssh w1 "sudo systemctl start citycafe-update.service"`
   Danach 2–3 min warten, bis der W1 wieder da ist (`ssh w1 uptime`).
3. **Prüfen** (`dj-studio/AUFTRAG-W1.md`, Aufgabe 1):
   - `ssh w1 "tail -20 /var/log/citycafe-update.log; grep -n 'LAUT_ZIEL_LUFS = \|XF_SEK = ' /opt/citycafe/nl-mpv-supervisor.py"`
     → `LAUT_ZIEL_LUFS = -14.0`, `XF_SEK = 9`.
   - `ssh w1 "pgrep -af nl-mpv-supervisor; tail -20 /home/citycafe/nl-mpv-supervisor.err; grep 'Blende 9 s (fest)' /home/citycafe/nl-mpv-supervisor.log | tail -1"`
   - Sobald Musik läuft: `ssh w1 "grep -E 'Ueberblendung|Tonwechsel|Lautheit gesetzt|abgebrochen|Notbremse' /home/citycafe/nl-mpv-supervisor.log | tail -30"`
     → je Song `Tonwechsel …: neu bei X s (volle Musik ab X s), alt bei Y s (Musikende Y+2 s)`.
   - TV-Seite neu: `ssh w1 "sudo -u citycafe kiosk-cdp \"typeof YTM_DJ_SKINS + ' ' + nlTon.blende\""` → `object 9`.
4. **Dem Betreiber sagen:** Endstufe **+3 dB**. Danach mit ihm vor Ort die **Welle abgleichen**
   (Aufgabe 2): `ssh w1 "sudo -u citycafe kiosk-cdp \"localStorage.setItem('studioVorlauf','-0.05')\""`,
   er sagt „Spitze kommt vor/nach dem Schlag“, du änderst in 0,05-s-Schritten (positiv = Welle
   früher). Gefundenen Wert in `STAND.md` eintragen (Abschnitt 21.10., „Anzeige-Vorlauf“).
5. **Ergebnis** kurz in `STAND.md` (Abschnitt 21.10., „Als Nächstes“) eintragen, committen, pushen
   (Push nach `main` nur mit Freigabe des Betreibers).

**Falls etwas schiefgeht** (Musik fällt aus, Supervisor startet nicht): Log lesen
(`nl-mpv-supervisor.err`), dem Betreiber melden. Rückfall auf den Supervisor von vor heute:
`git show 4fb5f61b^1:kiosk/nl-mpv-supervisor.py` → CRLF entfernen (`tr -d '\r'`), per `scp` nach
`/opt/citycafe/`, Supervisor neu starten wie in `KIOSK-SUPERVISOR.md` – nur mit Freigabe.

## 3. Was am PC zuhause noch läuft (nicht deine Aufgabe)

beat_this rechnet die restlichen Playlist-Songs und laufend Radio/Wünsche (auch die des Cafés über
Firebase). Die Sitzung zuhause lädt neue `dj-studio/takt/*.json` nach `main` hoch; der Café-TV holt
sie von selbst (GitHub Pages). Dafür muss am W1 nichts getan werden.

## 4. Regeln (aus `STAND.md` „Feste Regeln“)

- TV-Seite neu laden oder Supervisor neu starten **nur nach Rückfrage** – es unterbricht die Musik;
  nie mitten in einer Überblendung (dann läuft der Song kurz zu laut, heute zuhause passiert).
- Kein Push nach `main` ohne Freigabe; `main` landet am nächsten Morgen um 8:30 auf dem W1.
- **Keine Zugangsdaten** ins Repo oder in die Ausgabe (Chef-PIN steht in `citycafe.env` – nicht lesen).
- Nie `pkill -f` über ssh, über die Prozessnummer gehen. Skripte per `scp`, nicht als Heredoc.
- Arbeitskopie am Beelink hat CRLF – vor dem Übertragen auf den W1 `tr -d '\r'`.
- Kein Python am Beelink: Prüfungen per `ssh w1 python3 -` (Datei über stdin).
