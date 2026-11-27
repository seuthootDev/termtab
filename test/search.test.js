import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchAction, engineId } from '../shell/top.js';
import { importSettings, exportSettings, DEFAULT_PREFS } from '../lib/prefs.js';

test('web search goes to the default provider via chrome.search, not a hard-coded engine', () => {
  assert.deepEqual(searchAction('default', 'mac terminal', true), { defaultProvider: 'mac terminal' });
});

test('github search builds an encoded github.com URL', () => {
  assert.deepEqual(searchAction('github', 'a b&c', true), { url: 'https://github.com/search?q=a%20b%26c' });
});

test('old stored engines (google/duckduckgo/naver) are treated as the default provider', () => {
  for (const old of ['google', 'duckduckgo', 'naver', undefined, 'bing']) assert.equal(engineId(old), 'default');
  assert.deepEqual(searchAction('naver', 'x', true), { defaultProvider: 'x' });
});

test('the default search engine pref is the browser default', () => {
  assert.equal(DEFAULT_PREFS.searchEngine, 'default');
});

test('backups from older builds with searchEngine google still import', () => {
  const json = exportSettings({ prefs: { ...DEFAULT_PREFS, searchEngine: 'google' } }, 0);
  assert.equal(importSettings(json).prefs.searchEngine, 'google');
  const now = exportSettings({ prefs: { ...DEFAULT_PREFS } }, 0);
  assert.equal(importSettings(now).prefs.searchEngine, 'default');
});
