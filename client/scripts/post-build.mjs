// scripts/post-build.mjs — inject PWA meta tags into Expo dist
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const CLIENT = join(__dirname, '..');

const metaTags = `
    <meta name="theme-color" content="#059669" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="SAM" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/assets/images/icon-192.png" />
    <link rel="mask-icon" href="/assets/images/icon.png" color="#059669" />
`;

const indexPath = join(DIST, 'index.html');
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, 'utf8');
  html = html.replace(
    '<meta charset="utf-8" />',
    `<meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />${metaTags}`
  );
  html = html.replace('<title>应用</title>', '<title>SAM 銷售助理</title>');
  writeFileSync(indexPath, html);
  console.log('✓ index.html updated with PWA meta tags');
}

const manifestSrc = join(CLIENT, 'web', 'manifest.webmanifest');
const manifestDst = join(DIST, 'manifest.webmanifest');
if (existsSync(manifestSrc)) {
  copyFileSync(manifestSrc, manifestDst);
  console.log('✓ manifest.webmanifest copied');
}

const icon192 = join(CLIENT, 'assets', 'images', 'icon-192.png');
const icon512 = join(CLIENT, 'assets', 'images', 'icon-512.png');
if (existsSync(icon192) && existsSync(icon512)) {
  const targetDir = join(DIST, 'assets', 'images');
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(icon192, join(targetDir, 'icon-192.png'));
  copyFileSync(icon512, join(targetDir, 'icon-512.png'));
  console.log('✓ PWA icons copied');
}
