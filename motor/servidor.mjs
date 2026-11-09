// Servidor estático mínimo (a raiz do projeto), usado pelo render e pela prévia.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './timeline.mjs';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.svg': 'image/svg+xml',
};

export function servir(porta = 0) {
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const arq = path.normalize(path.join(RAIZ, url));
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
      res.writeHead(404); res.end('não encontrado'); return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(arq).pipe(res);
  });
  return new Promise((ok) => srv.listen(porta, '127.0.0.1', () => ok({ srv, porta: srv.address().port })));
}
