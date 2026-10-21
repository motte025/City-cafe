# Studio-Position (DJ Studio im Kiosk) gegen mpv time-pos, 10 s alle 100 ms. Braucht CDP auf
# Port 9222 und den mpv-Socket /tmp/mpv-nl.sock (PC zuhause; auf dem W1 als citycafe).
#   python3 werkzeuge/position_pruefen.py
# 21.10.: Mittel -0,02 s; mit studioVorlauf -0,05 entsprechend -0,08 s.
# Vergleicht die Studio-Position (iframe, store.js) mit mpv time-pos, 10 s lang alle 100 ms
import json, socket, time, urllib.request, websocket
tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json/list'))
tab = next(t for t in tabs if t['type'] == 'page' and 'kiosk=1' in t['url'])
ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)
n = [0]
def ev(expr):
    n[0] += 1
    ws.send(json.dumps({'id': n[0], 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True, 'awaitPromise': True}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('id') == n[0]: return r['result'].get('result', {}).get('value')
ev("(async()=>{const w=document.querySelector('#ytm-dj iframe').contentWindow; const m=await w.eval(\"import('./js/store.js')\"); window.__st=m.state; return 1})()")
def mpvpos():
    s = socket.socket(socket.AF_UNIX); s.connect('/tmp/mpv-nl.sock')
    s.sendall(b'{"command":["get_property","time-pos"],"request_id":1}\n')
    buf = b''
    while b'"request_id":1' not in buf: buf += s.recv(4096)
    s.close()
    for l in buf.split(b'\n'):
        if b'"request_id":1' in l: return json.loads(l)['data']
rows = []
for i in range(100):
    t0 = time.time(); m1 = mpvpos()
    d = ev("(()=>{const s=window.__st; const a=s.decks.A, b=s.decks.B; const x=a.spielt?a:b; return [x.pos, x.track&&x.track.videoId]})()")
    m2 = mpvpos(); t1 = time.time()
    rows.append((t0, (m1 + m2) / 2, d[0]))
    time.sleep(max(0, 0.1 - (time.time() - t0)))
diffs = [r[2] - r[1] for r in rows]
print("Studio minus mpv: Mittel %.3f s, min %.3f, max %.3f" % (sum(diffs)/len(diffs), min(diffs), max(diffs)))
# Spruenge: Studio-Fortschritt je Schritt vs Uhr
spr = []
for a, b in zip(rows, rows[1:]):
    spr.append((b[2] - a[2]) - (b[0] - a[0]))
print("Abweichung des Fortschritts je 100 ms: max %.3f s, Anzahl > 20 ms: %d" % (max(abs(x) for x in spr), sum(abs(x) > 0.02 for x in spr)))
print("Verlauf Studio-mpv (je 0,5 s):", " ".join("%.2f" % diffs[i] for i in range(0, 100, 5)))
