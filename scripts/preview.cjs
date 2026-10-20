const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../renderer');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const content = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type': `${types[path.extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
});
const port = Number(process.env.PARAKEET_PREVIEW_PORT ?? 5173);
server.listen(port, '127.0.0.1', () => console.log(`Parakeet Studio UI preview: http://127.0.0.1:${server.address().port} (AI and audio require the desktop app).`));
module.exports = server;
