// npm run screenshots [-- --size 1280x800 --out store --scale 1.25 --lang en-US]
// Store screenshots of newtab.html?demo=1 in headless Edge or Chrome over the DevTools protocol.
// Headless --screenshot does not wait for storage or async rendering, so this script drives the
// page itself: seed chrome.storage.local, reload, wait in real time, then capture.
// Branded Chrome ignores --load-extension; use Edge (default) or set CHROME_PATH to
// Chrome for Testing / Chromium.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const [W, H] = arg('size', '1280x800').split('x').map(Number);
const OUT = join(root, arg('out', 'store'));
// CSS pixels per screenshot pixel: 1.25 lays the page out at 1600×1000 and captures 1280×800.
const SCALE = Number(arg('scale', '1.25'));
// UI language. The store shots are English; --lang ko writes <name>-ko.png for review.
const LANG = arg('lang', 'en-US');
const BASE_LANG = LANG.split('-')[0];
const SUFFIX = BASE_LANG === 'en' ? '' : `-${BASE_LANG}`;
const TIMEOUT_MS = 90_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function browserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/microsoft-edge',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('No Edge or Chrome found. Set CHROME_PATH.');
  return found;
}

// ---- seeded state ---------------------------------------------------------------------

const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const win = (id, extra = {}) => ({ id, wide: false, minimized: false, ...extra });

const prefs = { user: 'you', machine: 'MacBook', clock24: true, searchEngine: 'google', wallpaper: 1, fontSize: 'medium', focusMode: true, ambientWithTimer: false };
const settings = {
  'settings:todo': { active: 'work', lists: { work: [
    { t: 'review the pull request', d: true },
    { t: 'write the release notes', d: false },
    { t: 'reply to design feedback', d: false },
  ], home: [{ t: 'buy coffee beans', d: false }] } },
  'settings:notes': { text: '# today\n- ship termtab 0.1\n- store screenshots at 1280x800\n- ideas: ubuntu theme, firefox\n' },
};

const mainLayout = [
  win('clock'), win('timer'), win('weather'), win('todo'),
  win('hn', { wide: true }), win('calendar'), win('notes'),
  win('crypto'), win('sysinfo'), win('rates'), win('wiki'),
];

function shots() {
  const now = Date.now();
  const base = { prefs, ...settings, focus: { day: day(), text: 'ship the store listing' } };
  const idleTimer = { mode: 'focus', running: false, endsAt: null, remaining: 1500, doneToday: 3, day: day() };
  return [
    { name: 'main', state: { ...base, layout: mainLayout, timer: idleTimer } },
    { name: 'drawer', state: { ...base, layout: mainLayout, timer: idleTimer }, act: `document.querySelector('#open').click()` },
    {
      name: 'focus',
      state: {
        ...base,
        timer: { mode: 'focus', running: true, endsAt: now + (17 * 60 + 42) * 1000, remaining: 1500, doneToday: 3, day: day() },
        layout: [
          win('timer'), win('todo'), win('ambient'), win('notes'), win('workday'), win('clock'),
          win('hn', { wide: true, minimized: true }), win('devto', { minimized: true }),
          win('trending', { minimized: true }), win('wiki', { minimized: true }),
        ],
      },
    },
    { name: 'preferences', state: { ...base, layout: mainLayout, timer: idleTimer }, act: `document.querySelector('[data-action="prefs"]').click()` },
  ];
}

// ---- DevTools protocol ----------------------------------------------------------------

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(`${m.error.message}`));
      else resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ready = new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  return { ready, send, logs, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  return r.result.value;
}

async function waitFor(cdp, expression, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await evaluate(cdp, expression).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

// ---- run --------------------------------------------------------------------------------

async function run(browser, profile) {
  let port;
  for (let i = 0; i < 80 && !port; i++) {
    try { port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { await sleep(250); }
  }
  if (!port) throw new Error('browser did not open a DevTools port');
  const http = `http://127.0.0.1:${port}`;

  // The browser has its own component extensions too, some also with a background.js service
  // worker, so every candidate id is tried until one serves our newtab.html.
  const isOurs = `!!(globalThis.chrome && chrome.storage && document.querySelector('#grid'))`;
  let targets = [];
  let candidates = [];
  for (let i = 0; i < 40; i++) {
    targets = await (await fetch(`${http}/json`)).json();
    candidates = [...new Set(targets
      .filter((t) => t.type === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(t.url))
      .map((t) => new URL(t.url).host))];
    if (candidates.length && i >= 4) break; // give our worker a moment to register
    await sleep(250);
  }
  const page = targets.find((t) => t.type === 'page');
  const cdp = connect(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: Math.round(W * SCALE), height: Math.round(H * SCALE), deviceScaleFactor: 1 / SCALE, mobile: false, screenWidth: 2560, screenHeight: 1440 });
  // --lang sets chrome.i18n; Intl dates and navigator.language follow the OS locale unless pinned.
  await cdp.send('Emulation.setLocaleOverride', { locale: LANG });

  let url;
  for (const id of candidates) {
    await cdp.send('Page.navigate', { url: `chrome-extension://${id}/newtab.html?demo=1` });
    if (await waitFor(cdp, isOurs, 3000)) { url = `chrome-extension://${id}/newtab.html?demo=1`; break; }
  }
  if (!url) throw new Error('termtab not found among the loaded extensions (is --load-extension ignored by this browser?)');
  console.log(`extension page: ${url}`);

  mkdirSync(OUT, { recursive: true });
  const problems = [];
  for (const shot of shots()) {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp, isOurs, 10_000);
    await evaluate(cdp, `chrome.storage.local.clear().then(() => chrome.storage.local.set(${JSON.stringify(shot.state)}))`);
    cdp.logs.length = 0;
    await cdp.send('Page.reload', { ignoreCache: true });
    await sleep(1500);
    await waitFor(cdp, `document.querySelectorAll('#grid .win').length > 0`, 10_000);
    if (shot.act) { await evaluate(cdp, shot.act); }
    await sleep(2500); // clock tick, sysinfo, fonts, transitions
    const check = await evaluate(cdp, `(() => {
      const text = document.body.innerText;
      return { lang: document.documentElement.lang, nav: navigator.language, loading: /loading…|불러오는 중/.test(text),
               failed: /fetch failed|가져오기 실패|hit an error|오류가 발생/.test(document.querySelector('#grid').innerText) };
    })()`);
    if (check.lang.split('-')[0] !== BASE_LANG) problems.push(`${shot.name}: UI language is ${check.lang}, expected ${LANG}`);
    if (check.nav.split('-')[0] !== BASE_LANG) problems.push(`${shot.name}: browser locale is ${check.nav}, expected ${LANG}`);
    if (check.loading) problems.push(`${shot.name}: a widget still shows loading…`);
    if (check.failed) problems.push(`${shot.name}: a widget shows a fetch failure or error`);
    for (const l of cdp.logs) problems.push(`${shot.name}: ${l}`);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, `${shot.name}${SUFFIX}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`saved ${file}`);
  }
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`${http}/json/version`)).json();
    const b = connect(webSocketDebuggerUrl);
    await b.ready;
    await b.send('Browser.close').catch(() => {});
  } catch { /* killed below */ }
  cdp.close();
  return problems;
}

const profile = join(root, '.profiles', `shot-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const browser = spawn(browserPath(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--lang=${LANG}`, `--accept-lang=${LANG}`,
  `--user-data-dir=${profile}`, `--load-extension=${root}`, `--disable-extensions-except=${root}`,
  '--remote-debugging-port=0', `--window-size=${W},${H}`, '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore', env: { ...process.env, LANG: `${LANG.replace('-', '_')}.UTF-8`, LANGUAGE: LANG.replace('-', '_') } });
const exited = new Promise((r) => browser.once('exit', r));

let code = 0;
const timeout = setTimeout(() => { console.error(`timed out after ${TIMEOUT_MS / 1000} s`); browser.kill(); process.exit(2); }, TIMEOUT_MS);
try {
  const problems = await run(browser, profile);
  for (const p of problems) console.warn('warn: ' + p);
  if (problems.length) code = 1;
} catch (err) {
  console.error(err.message);
  code = 1;
} finally {
  clearTimeout(timeout);
  await Promise.race([exited, sleep(3000)]);
  if (browser.exitCode === null) browser.kill(); // only the browser this script started
  await Promise.race([exited, sleep(3000)]);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
process.exit(code);
