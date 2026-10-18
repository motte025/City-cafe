// Lokaler Testserver fuer das DJ Studio (nur auf diesem Rechner, Port 8790).
//   node dj-studio/tools/server.js   ->   http://localhost:8790/dj-studio/
// Liefert den Repo-Ordner aus (fuer ../yt_playlists.json). Keine Schreibzugriffe.
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT) || 8790;
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') { res.writeHead(302, { Location: '/dj-studio/' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const datei = path.join(ROOT, p);
  if (!datei.startsWith(ROOT + path.sep) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(datei).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`DJ Studio: http://localhost:${PORT}/dj-studio/`));
