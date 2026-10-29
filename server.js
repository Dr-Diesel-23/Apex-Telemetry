#!/usr/bin/env node
/**
 * Zero-dependency static server for the ApexTelemetry dashboard.
 *
 *   node server.js            # http://127.0.0.1:5173
 *   PORT=8080 node server.js  # custom port
 *
 * The page talks to the backend at http://localhost:4000 (CORS is open in
 * development). Change the base URL in the UI under "API config".
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', service: 'apex-telemetry-frontend' }));
    return;
  }

  const requested =
    url.pathname === '/' || url.pathname === '' ? '/index.html' : url.pathname;

  const full = path.resolve(ROOT, '.' + decodeURIComponent(requested));

  if (!full.startsWith(ROOT + path.sep) && full !== path.join(ROOT, 'index.html')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(full, (error, buffer) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${requested}`);
      return;
    }

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ApexTelemetry frontend -> http://${HOST}:${PORT}`);
  console.log('Backend expected at http://localhost:4000 (see API config)');
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
