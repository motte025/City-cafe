# Takt-Dateien fuer alles nachrechnen, was am Kiosk laeuft oder bald kommt (Radio-Mix, Wuensche,
# Warteschlange, zuletzt gespielt) - am PC zuhause, neben dem Test-Kiosk (CDP Port 9222):
#   python3 dj-studio/werkzeuge/takt_nachlesen.py      (laeuft endlos, alle 5 min)
# Rechnet mit takt_messen.py (beat_this, 1 Kern, nice 19). Neue Dateien landen in dj-studio/takt/
# und kommen mit dem naechsten Commit/Push auf den Cafe-TV.
import json, os, subprocess, sys, tempfile, time, urllib.request
import websocket
HIER = os.path.dirname(os.path.abspath(__file__))
TAKT = os.path.join(HIER, '..', 'takt')
VENV = os.path.expanduser('~/.local/share/citycafe-test/beat-venv/bin/python')
AUSDRUCK = """JSON.stringify([].concat([ytm.jetzt||{}], ytm.eintraege||[], (ytm.radio&&ytm.radio.titel)||[],
  (ytm.gespielt||[]).slice(-30)).map(t=>t&&t.videoId).filter(v=>/^[A-Za-z0-9_-]{11}$/.test(v||'')))"""
def ids_vom_kiosk():
    tabs = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json/list', timeout=5))
    tab = next(t for t in tabs if t['type'] == 'page' and 'kiosk=1' in t['url'])
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True, timeout=10)
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': AUSDRUCK, 'returnByValue': True}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('id') == 1: break
    ws.close()
    return list(dict.fromkeys(json.loads(r['result']['result']['value'])))
while True:
    try:
        neu = [v for v in ids_vom_kiosk() if not os.path.exists(os.path.join(TAKT, v + '.json'))]
    except Exception as e:
        print('Kiosk nicht erreichbar:', type(e).__name__, flush=True); neu = []
    if neu:
        fd, liste = tempfile.mkstemp(suffix='.txt'); os.close(fd)
        open(liste, 'w').write('\n'.join(neu) + '\n')
        print(time.strftime('%H:%M'), len(neu), 'neue Songs', flush=True)
        subprocess.run(['nice', '-n', '19', VENV, os.path.join(HIER, 'takt_messen.py'), liste],
                       env={**os.environ, 'TAKT_KERNE': '1'})
        os.remove(liste)
    time.sleep(300)
