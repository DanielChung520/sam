/**
 * Production server for LINE 代理
 *
 * Port 7010 (external/tunnel-facing):
 *  - Serves static files from dist/ (production build)
 *  - Proxies /api/* and /webhook to Express server (port 9091)
 *
 * Usage: node scripts/proxy.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(__dirname, '..');
const PROXY_PORT = 7010;
const EXPRESS_PORT = 9091;
const DIST = path.join(CLIENT, 'dist');

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveFile(res, filePath, cache = false) {
  try {
    const ext = path.extname(filePath);
    const mime = MIME_MAP[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    const headers = {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    };
    if (!cache) headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function proxyToExpress(req, res) {
  const options = {
    hostname: 'localhost',
    port: EXPRESS_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${EXPRESS_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    delete headers['content-encoding'];
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.writeHead(502);
    res.end('Backend unavailable');
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

function serveDist(req, res) {
  const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
  let filePath = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  serveFile(res, filePath);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);

  // 1) API / Webhook → Express
  if (url.pathname.startsWith('/api/') || url.pathname === '/webhook' || url.pathname.startsWith('/webhook/')) {
    return proxyToExpress(req, res);
  }

  // 2) Manifest override
  if (url.pathname === '/manifest.webmanifest') {
    return serveFile(res, path.join(CLIENT, 'web', 'manifest.webmanifest'));
  }

  // 3) Static files
  serveDist(req, res);
});

server.listen(PROXY_PORT, () => {
  console.log(`✓ Server running on port ${PROXY_PORT}`);
  console.log(`  Static: dist/`);
  console.log(`  API/Webhook → localhost:${EXPRESS_PORT}`);
});
