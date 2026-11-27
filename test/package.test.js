import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, posix } from 'node:path';
import { packageFiles } from '../scripts/package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Every relative file reachable from the entry points through import/export ... from, import(), src= and href=. */
function reachable(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = read(file);
    const specs = [];
    const res = file.endsWith('.html')
      ? [/\b(?:src|href)="([^"]+)"/g]
      : [/\b(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g];
    for (const re of res) for (const m of text.matchAll(re)) specs.push(m[1]);
    for (const s of specs) {
      if (/^[a-z]+:/i.test(s) || s.startsWith('#')) continue;
      queue.push(posix.normalize(posix.join(posix.dirname(file), s)));
    }
  }
  return seen;
}

test('every file reachable from newtab.html, newtab.js and background.js is packaged', () => {
  const files = new Set(packageFiles(root));
  const needed = reachable(['newtab.html', 'newtab.js', 'background.js']);
  assert.ok(needed.size > 20, `scanned ${needed.size} files`);
  assert.ok(needed.has('demo/data.js'), 'scan follows shell/windows.js into demo/');
  for (const f of needed) assert.ok(files.has(f), `missing from package: ${f}`);
});

test('the manifest, its icons, locales and LICENSE are packaged', () => {
  const files = new Set(packageFiles(root));
  const manifest = JSON.parse(read('manifest.json'));
  for (const f of ['manifest.json', 'newtab.html', 'LICENSE', '_locales/en/messages.json', '_locales/ko/messages.json', ...Object.values(manifest.icons)]) {
    assert.ok(files.has(f), `missing ${f}`);
  }
});

test('nothing outside the extension is packaged', () => {
  const files = packageFiles(root);
  const banned = /^(test|docs|scripts|store|\.github|\.superpowers|\.profiles|node_modules|dist)\//;
  for (const f of files) {
    assert.ok(!banned.test(f), `should not ship ${f}`);
    assert.ok(!f.includes('\\'), `forward slashes only: ${f}`);
  }
  assert.ok(!files.includes('package.json'));
  assert.ok(!files.includes('icons/icon.svg'));
  assert.equal(new Set(files).size, files.length, 'no duplicates');
});
