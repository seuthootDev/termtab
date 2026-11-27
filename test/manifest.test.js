import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));

test('manifest is MV3, version 0.2.0, with no new tab override', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '0.2.0');
  assert.equal('chrome_url_overrides' in manifest, false);
  assert.equal(manifest.default_locale, 'en');
});

test('a keyboard shortcut opens the dashboard (the toolbar action)', () => {
  assert.equal(manifest.commands._execute_action.suggested_key.default, 'Alt+Shift+T');
});

test('permissions are exactly the allowed set, no host permissions', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['alarms', 'search', 'storage', 'system.cpu', 'system.memory']);
  assert.equal('host_permissions' in manifest, false);
  assert.equal('optional_host_permissions' in manifest, false);
});

test('every referenced file exists', () => {
  const files = [
    manifest.background.service_worker,
    'newtab.html',
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ];
  assert.ok(files.length >= 6);
  for (const f of files) {
    assert.ok(existsSync(fileURLToPath(new URL(f, root))), `missing ${f}`);
  }
});
