# Schlaege und Takt-Einsen je Song mit beat_this (CPJKU, 2024) -> dj-studio/takt/<videoId>.json
# Laeuft am PC zuhause in eigener Umgebung (nicht auf dem W1):
#   nice -n 19 ~/.local/share/citycafe-test/beat-venv/bin/python dj-studio/werkzeuge/takt_messen.py ids.txt
# Einrichtung (einmal): python3 -m venv <venv>; <venv>/bin/pip install torch torchaudio
#   --index-url https://download.pytorch.org/whl/cpu; <venv>/bin/pip install numpy soxr soundfile
#   https://github.com/CPJKU/beat_this/archive/main.zip   (Modell 'final0' laedt beim ersten Lauf)
# Je Song: Ton (bestaudio) mit ffmpeg gedrosselt (-readrate 16, schont den Bluetooth-Ton) als
# 22,05-kHz-Mono laden, beat_this auf der CPU (~7 s), Datei wieder loeschen.
# Ausgabe: {"v":1,"b":[Schlag-Zeiten in ms, als Abstaende],"e":[Index der Einsen in b]}
import sys, os, json, subprocess, tempfile, time
import torch
from beat_this.inference import File2Beats
# Hoechstens 2 Kerne und niedrigste Prioritaet (mit 'nice -n 19' starten): mit allen Kernen
# nahm beat_this dem DJ Studio die Rechenzeit, die Welle ruckelte (21.10.2026).
torch.set_num_threads(int(os.environ.get('TAKT_KERNE', '2')))
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'takt')
f2b = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)
ids = [z.strip() for z in open(sys.argv[1]) if z.strip()]
fertig = fehler = 0
for vid in ids:
    aus = os.path.join(ZIEL, vid + '.json')
    if os.path.exists(aus):
        continue
    t0 = time.time()
    url = subprocess.run(['yt-dlp', '--js-runtimes', 'node', '--cookies-from-browser', 'chromium', '-f', 'bestaudio',
                          '-g', 'https://www.youtube.com/watch?v=' + vid], capture_output=True, text=True).stdout.split('\n')[0]
    if not url.startswith('http'):
        print(vid, 'keine URL', flush=True); fehler += 1; continue
    fd, wav = tempfile.mkstemp(suffix='.wav'); os.close(fd)
    try:
        r = subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-readrate', '16',
                            '-i', url, '-vn', '-ac', '1', '-ar', '22050', wav], capture_output=True, timeout=300)
        if r.returncode or os.path.getsize(wav) < 100000:
            print(vid, 'Ton nicht geladen', flush=True); fehler += 1; continue
        beats, downs = f2b(wav)
    except Exception as e:
        print(vid, 'Fehler', type(e).__name__, flush=True); fehler += 1; continue
    finally:
        os.remove(wav)
    ms = [round(float(x) * 1000) for x in beats]
    if len(ms) < 16:
        print(vid, 'zu wenig Schlaege', flush=True); fehler += 1; continue
    eins = []
    for d in downs:                                   # Einsen auf den naechsten Schlag legen
        i = min(range(len(ms)), key=lambda k: abs(ms[k] - d * 1000))
        if abs(ms[i] - d * 1000) < 60 and (not eins or eins[-1] != i):
            eins.append(i)
    abst = [ms[0]] + [b - a for a, b in zip(ms, ms[1:])]
    json.dump({'v': 1, 'b': abst, 'e': eins}, open(aus, 'w'), separators=(',', ':'))
    fertig += 1
    print(vid, len(ms), 'Schlaege', len(eins), 'Einsen', f'{time.time() - t0:.0f}s', flush=True)
print('FERTIG', fertig, 'neu,', fehler, 'Fehler', flush=True)
