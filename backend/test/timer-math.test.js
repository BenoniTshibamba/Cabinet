import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// timerHours et fmtElapsed vivent dans frontend/js/app.js (pas de build step) :
// on les extrait par équilibrage d'accolades et on les évalue.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, '..', '..', 'frontend', 'js', 'app.js'), 'utf8');

function extractFn(marker) {
  const start = src.indexOf(marker);
  assert.ok(start !== -1, `${marker} introuvable dans frontend/js/app.js`);
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.ok(end !== -1, `accolades de ${marker} non équilibrées`);
  const name = marker.replace('function ', '').split('(')[0];
  return new Function(`${src.slice(start, end)}; return ${name};`)();
}

const timerHours = extractFn('function timerHours(startedAt, nowMs) {');
const fmtElapsed = extractFn('function fmtElapsed(totalSecs) {');
const timerStore = extractFn('function timerStore(storage) {');

// Faux localStorage pour tester l'indépendance des minuteurs.
function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test('timerHours : 2 h → 2.00', () => {
  assert.strictEqual(timerHours(0, 2 * 3600 * 1000), 2);
});

test('timerHours : 90 s → 0.03', () => {
  assert.strictEqual(timerHours(0, 90 * 1000), 0.03);
});

test('timerHours : 1 h 30 → 1.50', () => {
  assert.strictEqual(timerHours(0, 5400 * 1000), 1.5);
});

test('timerHours : 29 s → 0.01 (arrondi)', () => {
  assert.strictEqual(timerHours(0, 29 * 1000), 0.01);
});

test('timerHours : durée nulle ou négative → 0', () => {
  assert.strictEqual(timerHours(1000, 1000), 0);
  assert.strictEqual(timerHours(2000, 1000), 0);
});

test('fmtElapsed : 0 → 00:00:00', () => {
  assert.strictEqual(fmtElapsed(0), '00:00:00');
});

test('fmtElapsed : 3661 → 01:01:01', () => {
  assert.strictEqual(fmtElapsed(3661), '01:01:01');
});

test('fmtElapsed : 90 s → 00:01:30', () => {
  assert.strictEqual(fmtElapsed(90), '00:01:30');
});

test('timerStore : démarrer un 2e dossier ne coupe pas le 1er', () => {
  const store = timerStore(fakeStorage());
  store.add(1, 1000); // minuteur dossier 1 démarré à t=1000
  store.add(2, 5000); // minuteur dossier 2 démarré à t=5000
  const list = store.read();
  assert.strictEqual(list.length, 2);
  const t1 = list.find((s) => s.caseId === 1);
  const t2 = list.find((s) => s.caseId === 2);
  assert.ok(t1 && t2, 'les deux minuteurs coexistent');
  assert.strictEqual(t1.startedAt, 1000, 'le startedAt du dossier 1 est intact');
  assert.strictEqual(t2.startedAt, 5000, 'le startedAt du dossier 2 est intact');
});

test('timerStore : arrêter le dossier 1 ne touche pas le dossier 2', () => {
  const store = timerStore(fakeStorage());
  store.add(1, 1000);
  store.add(2, 5000);
  store.remove(1); // stop du minuteur dossier 1
  const list = store.read();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].caseId, 2);
  assert.strictEqual(list[0].startedAt, 5000, 'le chrono du dossier 2 continue, inchangé');
});

test('timerStore : redémarrer le même dossier remplace son entrée (pas de doublon)', () => {
  const store = timerStore(fakeStorage());
  store.add(1, 1000);
  store.add(2, 5000);
  store.add(1, 9000); // le dossier 1 redémarre : son ancienne entrée est remplacée
  const list = store.read();
  assert.strictEqual(list.length, 2, 'toujours 2 entrées, jamais de doublon');
  assert.strictEqual(list.find((s) => s.caseId === 1).startedAt, 9000);
  assert.strictEqual(list.find((s) => s.caseId === 2).startedAt, 5000, 'le dossier 2 est inchangé');
});

test('timerStore : lecture corrompue → liste vide, jamais d’exception', () => {
  const bad = fakeStorage();
  bad.setItem('cej:timers', 'ceci n’est pas du JSON {{{');
  const store = timerStore(bad);
  assert.deepStrictEqual(store.read(), []);
  assert.doesNotThrow(() => store.add(3, 42));
});
