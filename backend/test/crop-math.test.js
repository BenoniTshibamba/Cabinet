import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// La fonction cropRect vit dans frontend/js/app.js (pas de build step) :
// on l'extrait par équilibrage d'accolades et on l'évalue.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', '..', 'frontend', 'js', 'app.js'), 'utf8');

function extractCropRect() {
  const marker = 'function cropRect(o) {';
  const start = src.indexOf(marker);
  assert.ok(start !== -1, 'cropRect introuvable dans frontend/js/app.js');
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.ok(end !== -1, 'accolades de cropRect non équilibrées');
  return new Function(`${src.slice(start, end)}; return cropRect;`)();
}

const cropRect = extractCropRect();
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('image exactement au format du cadre : crop = image entière', () => {
  // source 1600x900, cadre 800x450 → cover 0.5, affichée 800x450, ix=0, iy=0
  const r = cropRect({ fw: 800, fh: 450, dw: 800, dh: 450, ix: 0, iy: 0, srcW: 1600, srcH: 900 });
  assert.ok(approx(r.sx, 0) && approx(r.sy, 0), `sx/sy: ${r.sx},${r.sy}`);
  assert.ok(approx(r.cw, 1600) && approx(r.ch, 900), `cw/ch: ${r.cw},${r.ch}`);
});

test('source portrait : crop vertical centré', () => {
  // source 900x1600, cadre 800x450 → cover = 800/900, dh = 1422.22, iy = 225 - dh/2
  const cover = 800 / 900;
  const dh = 1600 * cover;
  const iy = 225 - dh / 2;
  const r = cropRect({ fw: 800, fh: 450, dw: 800, dh, ix: 0, iy, srcW: 900, srcH: 1600 });
  const k = 900 / 800;
  assert.ok(approx(r.sx, 0), `sx: ${r.sx}`);
  assert.ok(approx(r.sy, -iy * k), `sy: ${r.sy}`);
  assert.ok(approx(r.cw, 900), `cw: ${r.cw}`);
  assert.ok(approx(r.ch, 450 * k), `ch: ${r.ch}`);
  assert.ok(r.sy >= 0 && r.sy + r.ch <= 1600, 'rectangle dans les bornes');
});

test('zoom 2x + décalage : rectangle correct et borné', () => {
  // source 1600x900, cadre 800x450, scale=2 → dw=1600, dh=900, x=100 → ix=-300, iy=-225
  const r = cropRect({ fw: 800, fh: 450, dw: 1600, dh: 900, ix: -300, iy: -225, srcW: 1600, srcH: 900 });
  assert.ok(approx(r.sx, 300), `sx: ${r.sx}`);
  assert.ok(approx(r.sy, 225), `sy: ${r.sy}`);
  assert.ok(approx(r.cw, 800), `cw: ${r.cw}`);
  assert.ok(approx(r.ch, 450), `ch: ${r.ch}`);
});

test('sécurité flottants : jamais hors image', () => {
  const r = cropRect({ fw: 800, fh: 450, dw: 800.0000001, dh: 450.0000001, ix: -1e-9, iy: -1e-9, srcW: 1600, srcH: 900 });
  assert.ok(r.sx >= 0 && r.sy >= 0, 'pas de coordonnée négative');
  assert.ok(r.sx + r.cw <= 1600 + 1e-6 && r.sy + r.ch <= 900 + 1e-6, 'pas de dépassement');
});
