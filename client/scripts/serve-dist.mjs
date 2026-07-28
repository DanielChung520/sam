// scripts/serve-dist.mjs — serve the production dist/ folder on port 7010
import { createServer } from 'http';
import { readFileSync, statSync, existsSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');
const PORT = parseInt(process.env.PORT || '7010', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  let filePath = join(DIST, url);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, 'index.html');
  }

  const ext = extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  // Expo bundle hashes — never cache so updates propagate immediately
  if (url.includes('/_expo/static/')) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`✓ Serving dist/ on http://localhost:${PORT}`);
});
