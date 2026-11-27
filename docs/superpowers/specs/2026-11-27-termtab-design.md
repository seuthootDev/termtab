# termtab — design

Date: 2026-11-27
Status: approved by the owner on 2026-11-27. Working name `termtab`; the final name is open.

## Intent

A free Chrome extension that replaces the new tab page with a dashboard of widgets (clock, focus timer, to-do, weather, news, and more), drawn as a macOS desktop: a menu bar on top and each widget in its own macOS Terminal window with traffic-light buttons, a centered title like `you — weather — zsh — 80×24`, and a zsh prompt line (`you@MacBook ~ % weather seoul`). The user picks which widgets to show, drags windows to reorder them, and the layout is remembered.

Why: the owner's earlier projects (GitHub README tools) only reach GitHub users and were hard to grow. This tests the Chrome Web Store as a channel with something anyone can use. The terminal look is the hook ("makes your browser look like a developer's"), the widgets are the reason to keep it. A mockup was approved on 2026-11-27; a copy is in `docs/mockup/terminal-newtab.html`. **The mockup is the reference for how each widget looks** (layouts of the timer, weather, neofetch and so on); this document wins on behavior, data and anything the mockup fakes.

## Goals

- Open instantly on every new tab with the user's chosen widgets.
- Let the user add and remove widgets from a list, reorder them by dragging, and keep that layout.
- Feel like macOS Terminal: menu bar, traffic lights that work (red closes the widget, yellow minimizes it to its title bar, green toggles wide), rounded windows with shadows, SF Mono/Menlo, zsh prompt lines.
- Install with no permission warnings.
- English and Korean, following the browser language.
- **Everything free.** No paid tier, no locked features. Features competitors charge for (Momentum's pomodoro, countdowns, multiple to-do lists, ambient sounds) are free here and said so in the store listing.

## Non-goals (v1)

- Typing commands as the way to use it (it looks like a terminal; it is used with clicks).
- Accounts, sync across devices, cloud backup.
- Free-form window positions or resizing (a tidy grid with drag-to-reorder instead).
- Light theme or other terminal looks (PowerShell, Ubuntu). The CSS keeps colors as variables so they can come later.
- Widgets that need sign-in (Gmail, Google Calendar) or a paid API key (stocks).
- Firefox, Safari.

## Anti-goals (failure even if it works)

- A new tab that waits on the network. The page must render from saved data first; fetching happens after and updates in place.
- Any install permission warning.
- Sending anything about the user anywhere except the minimum a widget needs to fetch its data (a city's coordinates for weather, a GitHub username for the graph), and only while that widget is on.
- Text that glows, flickers or is hard to read.

## Constraints

- Manifest V3, `chrome_url_overrides.newtab`.
- Permissions: `storage`, `alarms`, `system.cpu`, `system.memory`. None shows an install warning; the implementation must confirm this for `system.*` by loading the packed extension, and drop the System monitor widget (and those two permissions) if Chrome shows any warning. (`notifications` is not requested; see the focus timer.)
- No host permissions: every data source must allow cross-origin requests from an extension page. Checked on 2026-11-27 (all return `Access-Control-Allow-Origin`):
  - Open-Meteo forecast and geocoding (`api.open-meteo.com`, `geocoding-api.open-meteo.com`), no key
  - Hacker News (`hacker-news.firebaseio.com`)
  - Frankfurter (`api.frankfurter.dev/v1`; the old `api.frankfurter.app` redirects)
  - CoinGecko (`api.coingecko.com/api/v3`), free tier with rate limits
  - Wikimedia "on this day" (`api.wikimedia.org/feed/v1/wikipedia/<lang>/onthisday`)
  - DEV (`dev.to/api/articles`)
  - GitHub search (`api.github.com/search/repositories`), 10 requests/min unauthenticated
- No remote code. Images may load from other origins (the GitHub graph widget shows an image from the owner's card service).
- Chrome shows its own "Is this the new tab page you expected?" bubble after install; that is unavoidable for new-tab extensions.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Plain MV3, ES modules, no build; each widget a module with a fixed interface; pure logic tested with `node --test` | Same approach as the owner's previous extension (terminal-skin, since deleted, so no code to copy; its lessons are written into Testing and Release below); small, fast new tab; drag and drop written by hand | **Chosen** (builder's call) |
| B | WXT + a UI framework | Comfortable for many widgets; bigger bundle on every new tab, more tooling | Not now |
| C | Bundle a drag-and-drop/grid library | Faster drag-and-drop; extra weight for one feature | Rejected; drag is ~150 lines |

## How it works

### Files

```
manifest.json
newtab.html, newtab.css, newtab.js     page entry: wires the shell modules together
shell/*.js                             menu bar, search window, grid, widget drawer, drag, overlays, shortcuts
background.js                          alarms for the focus timer, badge, focus mode (logic in lib/bg.js)
lib/store.js                           typed wrapper over chrome.storage.local (layout, widget settings, cache)
lib/cache.js                           stale-while-revalidate: get(key, ttl, fetcher)
lib/layout.js                          pure: add, remove, move(from, to), toggle wide/minimized
lib/timer.js                           pure focus-timer state machine
lib/dates.js                           pure: ISO week, month grid, habit week, countdown days
widgets/<id>.js                        one module per widget (widgets/index.js lists them)
data/fortunes.js                       bundled quotes
demo/data.js                           sample data for ?demo=1 (shipped: shell/windows.js imports it)
_locales/en, _locales/ko
icons/, test/, scripts/ (screenshot, zip + package, icons), store/ (store images)
```

### Widget interface

Each `widgets/<id>.js` exports:
- `meta`: `{ id, category, size: "small" | "wide", source, command }` (`command` is the text after the prompt, e.g. `weather seoul`; names and descriptions come from `_locales`).
- `defaults`: its settings, e.g. weather `{ city: "Seoul", lat, lon, unit: "c" }`.
- `render(el, ctx)`: draws into `el` from `ctx.settings` and `ctx.cache`; may return a cleanup function. `ctx.refresh()` asks the shell to fetch again; `ctx.save(settings)` stores changed settings.
- `fetch(settings)` (online widgets only): returns plain data for the cache.
- `parse(raw)`: pure, unit-tested against saved API responses in `test/fixtures/`.
- `settingsForm(settings)`: fields shown when the user opens the widget's settings from its title bar (`⋯`).

### Widgets in v1

| Category | Widget | Data | Refresh |
|---|---|---|---|
| basics | Clock (big digits, date, ISO week) | computer | 1 s while open |
| basics | Quick links (user's own list) | storage | — |
| basics | Search bar window (Google, DuckDuckGo, Naver, GitHub) | — | — |
| focus | Focus timer (25/5 pomodoro, today's count) | storage + `alarms` | — |
| focus | To-do | storage | — |
| focus | Notes (saves as you type) | storage | — |
| focus | Habits (this week, user's habit names) | storage | — |
| focus | Countdown (named date, D-n) | storage | — |
| info | Weather (now, hi/lo, next 12 h sparkline, tomorrow) | Open-Meteo | 30 min |
| info | Calendar (month, today) | computer | — |
| info | World clocks (user's cities) | computer | 30 s |
| info | Exchange rates (base and targets the user picks) | Frankfurter | 6 h |
| info | Crypto prices (coins the user picks, 24 h change) | CoinGecko | 5 min |
| news | Hacker News top (count 5–10) | HN API | 15 min |
| news | DEV top posts this week | DEV API | 1 h |
| news | GitHub trending (most-starred repos created in the last 7 days) | GitHub search | 6 h |
| news | On this day (falls back to the English edition when Wikimedia has no feed for the UI language, e.g. ko) | Wikimedia | 24 h |
| fun | System info, neofetch style (browser, OS, screen, cores, online, open tab count via `chrome.tabs.query` count only) | browser | — |
| fun | Fortune (bundled quotes, cowsay frame) | bundled | per tab |

| focus | Ambient sound (rain, café, white/brown noise), synthesized with Web Audio, no audio files; optional auto-play with the focus timer | Web Audio | — |
| focus | Workday (progress bar to the end of the user's workday, time left, weekend aware) | computer | 1 min |
| basics | Calculator (`bc`-style: type an expression, Enter, history of the last 5) | computer | — |
| fun | System monitor (`htop`-style CPU and memory bars, refreshed while the tab is open) | `chrome.system.cpu`, `chrome.system.memory` | 2 s |

Above the grid, a **greeting and today's focus** line: `you@MacBook ~ % echo "Good morning, you"` and `focus: <one line the user types>` (cleared each day).

The search bar is always first and cannot be removed.

**Deferred to v1.1 (builder's call, flagged):** a GitHub contributions widget. The owner's card service draws its own macOS window frame, so embedding it would put a terminal window inside a terminal window; it needs a frameless option added to the card service first (work in the other repo). Default set for a new install: clock, focus timer, weather, to-do, Hacker News, calendar, notes.

### Data and caching

- `cache.get(key, ttl, fetcher)` returns the saved value at once (even if stale) and, when older than `ttl`, fetches in the background and re-renders that one widget. Fetches only happen while a new tab is open; there is no background polling.
- Concurrent new tabs share one in-flight fetch per key (a Web Locks API lock, `navigator.locks`, atomic across every page of the extension origin).
- On failure the widget keeps the old data and shows `fetch failed · retry` in its status line; nothing else on the page is affected.
- Weather location: a city search box using Open-Meteo geocoding, no location permission.

### Layout, windows and drag

- Stored as `layout: [{ id, wide, minimized }]` in order; each widget's settings are stored under `settings:<id>`. The grid flows left to right (CSS grid, `auto-fill`, min 320 px), wide windows span two columns.
- Traffic lights: red removes the widget (its settings are kept, so adding it back restores them), yellow toggles minimized (title bar only), green toggles wide.
- Drag: press on a title bar (not on a button) and move; a placeholder shows where the window will land; drop saves the new order. Pointer events, so mouse, pen and touch work. Keyboard: focus a title bar and press `Alt+←/→` to move it one place.
- Widget drawer (menu bar "＋ Widgets"): every widget grouped by category with a checkbox, description, data source and its command; checking adds it at the end.

### Ideas taken from competitors (all free)

| Idea | From | Here |
|---|---|---|
| Greeting and "today's main focus" | Momentum | greeting/focus line above the grid |
| Pomodoro, countdowns, several to-do lists | Momentum (paid there) | focus timer, countdown widget, to-do with lists |
| Ambient sounds | Momentum (paid there) | Ambient sound widget |
| Hide distracting widgets while focusing | Momentum "Balance" | **Focus mode**: while the timer runs in focus mode, widgets in the `news` category are minimized; restored when the break starts |
| Time left in the workday | Tabliss "Workday" | Workday widget |
| Calculator, CPU/RAM | Anori | Calculator, System monitor |
| Favicons on quick links | Bonjourr, Momentum | site icon before each link (from `https://www.google.com/s2/favicons?domain=…&sz=32` as an image; images need no permission) |
| Settings export/import | Bonjourr | Preferences → Export / Import JSON |
| Keyboard shortcuts | Bonjourr | `/` focuses search, `n` opens notes, `t` starts/pauses the timer, `?` opens a `man termtab` help window, `Esc` closes overlays |

The to-do widget keeps several named lists (`todo work`, `todo home`), switched with tabs in the window.

### Menu bar

`Terminal` (Widgets…, Preferences…, About), and on the right the date and time. Preferences: your name and machine name for the prompt, 24-hour clock, temperature unit, wallpaper (three dark gradients), font size (small/medium/large), focus mode on/off, workday hours, export/import settings, "reset layout". The temperature unit and workday hours write the Weather and Workday widgets' own settings (`settings:weather`, `settings:workday`), so there is one source of truth. Import validates the file field by field, rejects files over 1 MB, and changes nothing unless the whole file is valid.

### Focus timer across tabs

- State `{ mode: focus|break, endsAt | remaining, running, doneToday, day }` lives in storage, so every new tab shows the same countdown.
- `background.js` sets a `chrome.alarms` alarm for `endsAt`. When it fires: switch mode, increase the count, and set the toolbar badge (`✓`, cleared on the next new tab; the manifest has an `action` key so the badge has a toolbar button). If a new tab is open it also plays a short chime (only after the user has interacted with the page, per autoplay rules).
- No system notifications in v1, to keep the install free of warnings.

### Visual design

- Desktop: dark gradient wallpaper; menu bar 28 px, translucent with blur.
- Window: background `#1e1e1e`, title bar gradient `#383838 → #2e2e2e`, radius 10 px, macOS-like shadow; traffic lights `#ff5f57`, `#febc2e`, `#28c840`.
- Text `#d4d4d4`, dim `#8a8a8a`; accents One Dark (yellow `#e5c07b`, blue `#61afef`, green `#98c379`, red `#e06c75`, purple `#c678dd`, cyan `#56b6c2`).
- Fonts: `"SF Mono", Menlo, Monaco, "JetBrains Mono", "Cascadia Code", Consolas, "D2Coding", monospace` for content; system UI font for the menu bar and title bars. No web fonts downloaded at runtime (fonts may be bundled).
- Prompt line on every widget: `you@MacBook ~ % <command>`; "you" and "MacBook" can be changed in Preferences.

### Privacy

- Stored only in `chrome.storage.local` on the device.
- Network requests go only to the data sources of widgets that are switched on, carrying only what that request needs. Listed in the store privacy section and `PRIVACY.md`.

### Testing

- `node --test`: layout operations, cache TTL decisions, timer state machine, date helpers, every widget's `parse` against fixture JSON, locale key coverage, manifest test (permissions exactly `storage`, `alarms`, `system.cpu`, `system.memory`; `newtab` override; every file exists), zip writer (crc32, deflate round trip) and a package test (every file reachable from newtab.html, newtab.js and background.js is in the zip).
- `?demo=1` loads bundled sample data for every widget; a screenshot script renders the page from it for review and store images. It drives headless Edge over the DevTools protocol (seed `chrome.storage.local`, reload, wait, `Page.captureScreenshot`), because headless `--screenshot` does not wait for storage or async rendering. Lessons from the previous extension: use Edge or Chrome for Testing (branded Chrome ignores `--load-extension`), a fresh browser profile per run (Edge disables command-line extensions in a reused profile), and a timeout per page.
- GitHub Actions runs the Node tests.

### Release

- `npm run package` writes the store zip with a small built-in zip writer (manifest at the root, forward-slash paths). Windows PowerShell's `Compress-Archive` nests files and uses backslashes, which the store rejects.
- The owner registers the store account ($5 once) and submits; public GitHub repo with README, privacy policy and screenshots.

## Changes during implementation (2026-11-27)

- Cross-tab fetch lock: the Web Locks API (`navigator.locks`) instead of a flag in `chrome.storage.session`; it is atomic and released if a tab closes mid-fetch.
- Widget settings are stored under `settings:<id>` keys (kept when a window is closed, so adding it back restores them).
- The manifest has an `action` key (title only) so the focus-timer badge has a toolbar button.
- On this day falls back to English when Wikimedia has no feed for the UI language (ko has none).
- Preferences' temperature unit and workday hours write the Weather and Workday widgets' own settings instead of separate prefs.
- Settings import validates field by field (unknown keys or wrong types reject the whole file) and is capped at 1 MB.
- `demo/data.js` ships in the store zip because the shell imports it statically; it is only used with `?demo=1`.
- Screenshots are taken over the DevTools protocol; the store package is written by `scripts/zip.mjs`.
- A tab left open stays current: the grid reloads every online widget when the page becomes visible and every 60 s while it is visible (only stale cache entries hit the network).
- Optional widget hook `cacheKey(settings, now) → string`, appended to the cache key. On this day uses the local `YYYY-MM-DD`, so it turns over at midnight despite its 24 h TTL; the calendar redraws when the local day changes.
- `meta.usesPrefs: true` (clock, world clocks, system info, focus timer): only these re-render on a prefs change; every other window just gets its title and prompt line redrawn, so ambient sound and typed input survive. A search-engine change redraws no window.
- Error backoff: a failed fetch is stored with `failedAt` and counts as fresh for 60 s, so new tabs do not hammer a source that is down or rate limiting; the retry button passes `force` to bypass it.
- One failing currency, unknown coin or failing Hacker News story no longer fails its widget (`Promise.allSettled`; "n/a" / "unknown coin" rows). Exchange-rate settings accept only the currencies Frankfurter serves (bundled list).
- Focus mode switched off restores the news windows (at once, and again when the session ends).
- Clicking the toolbar button opens a new tab (`chrome.action.onClicked`, no extra permission).
- `?demo=1` shows fixed System info values for the store screenshots.
- Import also rejects duplicate layout ids and malformed calculator history; import merges into the current settings (the Preferences window says so).

## Decided by the owner

- A Chrome extension, as an experiment with the Chrome Web Store.
- New tab page dashboard with as many widgets as possible, chosen by the user.
- macOS Terminal look, used with clicks, not commands.
- Drag to reorder.
- Take the good ideas from similar extensions and give everything away free.
- No install warnings (the earlier "tabtime" idea was dropped for that reason).

## Left to the builder

- Exact visuals within the values above, wallpaper gradients, cowsay/neofetch art.
- Quotes for Fortune (public-domain or self-written).
- Rate-limit backoff details per API.

## Open

- Final name and store title (working name `termtab`).
