# Ton am Ausgang (vor Bluetooth) mitschneiden und gegen die Studio-Spur legen:
#   python3 werkzeuge/ausgang_mitschnitt.py <ordner/mitschnitt.wav> > <ordner/mitschnitt.json>
#   python3 werkzeuge/ausgang_vergleich.py <ordner> <videoId>
# Senke anpassen (pactl list sources short: ...monitor). 21.10.: +53 ms, Korrelation 0,969 -
# der PC liegt also genau; Verzoegerung entsteht erst im Funk/in der Box.
# Ton vor der Bluetooth-Box mitschneiden und mit der Studio-Spur (gemessene Huellkurve) vergleichen.
# Ergebnis: um wie viel der gehoerte Ton (vor BT) gegenueber mpv time-pos verschoben ist.
import subprocess, socket, json, time, gzip, base64, os, math, sys
def mpv(p):
    s = socket.socket(socket.AF_UNIX); s.connect('/tmp/mpv-nl.sock')
    s.sendall(json.dumps({"command": ["get_property", p], "request_id": 9}).encode() + b'\n')
    b = b''
    while b'"request_id":9' not in b: b += s.recv(4096)
    s.close()
    for l in b.split(b'\n'):
        if b'"request_id":9' in l: return json.loads(l).get('data')
vid = mpv('path') or ''
vid = (mpv('filename') or '')
dauer = 20.0
pfad = sys.argv[1]
proc = subprocess.Popen(['parec', '-d', 'bluez_output.70_B3_D5_91_38_62.1.monitor', '--format=s16le', '--rate=48000', '--channels=1', '--file-format=wav', '--latency-msec=10', pfad])
time.sleep(0.4)
t_a = time.time(); p_a = mpv('time-pos')
time.sleep(dauer)
t_b = time.time(); p_b = mpv('time-pos')
proc.terminate(); proc.wait()
print(json.dumps({'t_a': t_a, 'p_a': p_a, 't_b': t_b, 'p_b': p_b}))
