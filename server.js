import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname);
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(path);
    res.writeHead(200, {'Content-Type': ({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.mp3':'audio/mpeg'})[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store'}); res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173,'127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
