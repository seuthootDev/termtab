// npm run package → dist/termtab-<version>.zip with only the files the extension loads.
// test/package.test.js checks that every file reachable from newtab.html, newtab.js and
// background.js is in this list.
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip } from './zip.mjs';

const FILES = ['manifest.json', 'newtab.html', 'newtab.css', 'newtab.js', 'background.js', 'LICENSE', 'demo/data.js'];
const DIRS = ['lib', 'shell', 'widgets', 'data', '_locales'];
const ICON = /^icon-\d+\.png$/;

function walk(root, dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir)).sort()) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

/** Relative, forward-slash paths of every file that goes into the store zip. */
export function packageFiles(root) {
  const icons = readdirSync(join(root, 'icons')).filter((n) => ICON.test(n)).sort().map((n) => `icons/${n}`);
  return [...FILES, ...DIRS.flatMap((d) => walk(root, d)), ...icons];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const files = packageFiles(root);
  const zip = buildZip(files.map((name) => ({ name, data: readFileSync(join(root, name)) })));
  mkdirSync(join(root, 'dist'), { recursive: true });
  const out = join(root, 'dist', `termtab-${version}.zip`);
  writeFileSync(out, zip);
  for (const f of files) console.log('  ' + f);
  console.log(`${files.length} files, ${zip.length} bytes → dist/termtab-${version}.zip`);
}
