# termtab follow-ups (2026-11-27)

Minor findings from the per-task and final reviews that were left for later. None blocks a store submission; the final review triaged them as can-wait unless noted. Recorded here because the working ledger is deleted after the build.

## Before submitting

- ~~Check the Chrome Web Store policy on search boxes~~ — done: search now uses the default engine via chrome.search, plus GitHub.
- Decide how "macOS", "MacBook" and "Terminal" appear in the store name and description (trademark wording).
- Prepare the permission justification for system.cpu / system.memory (System monitor widget).

## Deferred minors

- [Task 3] a second same-page get for an in-flight key drops its onUpdate; test asserts updates.length >= 1 (too weak).
- [Task 3] error entries are always refetched, no backoff while an API is down.
- [Task 3] lock-losing tab gets no onUpdate — callers subscribe to store.onChange (carried to T4); JSDoc should say so.
- [Task 3] locks undefined → silently no cross-tab dedupe (JSDoc silent); timed-out fetch keeps running.
- [Task 4] drag can stick if the window unmounts mid-drag (no lostpointercapture; Esc doesn't cancel) shell/drag.js:57-76
- [Task 4] own storage echoes can briefly revert layout/prefs (newtab.js:43-48,106-120)
- [Task 4] focus text from yesterday saved under today if input focused at midnight (shell/top.js:37,47)
- [Task 4] i18n fallback named-placeholder regex "\$" broken (lib/i18n.js:21)
- [Task 4] search engine change rerenders all widgets (shell/top.js:62)
- [Task 4] a11y — drawer focus return, modal focus trap, shortcuts behind modal, .ph role
- [Task 4] prefs fallbacks duplicated in shell/panels.js:48-49; store.set without catch
- [Task 5] sysinfo labels padEnd collapsed in <li> → values not aligned (visible on neofetch)
- [Task 5] favicons send link hostnames to Google — disclose in PRIVACY (T9)
- [Task 5] calculator module-level refocus flag; history entries not validated
- [Task 5] countdown invalid date silent; Date.parse rollover (Feb 31); default date computed at import
- [Task 5] world 12h hard-coded en-US; redraw every second with new Intl formatters
- [Task 5] workday ignores clock24; tests only cover pure helpers; fortunes English only/loose attributions
- [Task 6] ambient stops on any re-render; break end silent (chime only on doneToday++); no prefs UI yet for focusMode/ambientWithTimer (T8).
- [Task 6] focus write can clobber a concurrent tab layout change (ms window)
- [Task 6] badge only if background processes the end first; every open tab chimes; no audio.resume()
- [Task 6] notes pending flush on re-render can overwrite another tab's newer text
- [Task 6] __proto__ list name lost in todo renameLists; activeName uses `in`
- [Task 6] habits day initials use navigator.language not UI language; marks never pruned; rename orphans marks; timer "25" hard-coded
- [Task 6] todo tabs lose keyboard focus on redraw; no shell-level suppression test, no widget-vs-alarm ordering test
- [Task 6] settings read race — a save equal to defaults before store.get resolves is skipped; pagehide async write completion unverified
- [Task 7] HN/rates Promise.all all-or-nothing (use allSettled); rates targets not de-duplicated
- [Task 7] geocode search no sequence guard; weather save silent when lat null; lat/lon unvalidated in URL
- [Task 7] crypto missing 24h change shows +0.0%; wiki form drops stored langs outside the 4 offered; trending/devto fixtures untrimmed (39 KB)
- [Task 8] Preferences weather save spreads stale snapshot; save not atomic (two settings saves then prefs)
- [Task 8] import merges rather than replaces (copy doesn't say); reset-layout arm has no timeout; sysmon tests live in prefs.test.js
- [Task 8] strict unknown-key policy → older builds reject newer backups; .htop-l clips labels > 5ch
- [Task 9] store hero shot sysinfo shows os Windows / browser Edge (demo should return macOS/Chrome or UA override)
- [Task 9] screenshot timeout path skips finally (profile leak, helper processes); no null check on page target
- [Task 9] reachability scanner can't follow new URL()/fetch()/CSS url(); README "22 widgets" vs 23 rows
Final: controller live check after fix wave — rates TWD n/a row, crypto unknown coin row, others live (tt/final.png). Final: minor (deferred): rates de-dup only in settings form, not at render (seeded duplicate USD shows twice).
Final fix wave: re-review clean (10/10 closed). Final: minor (deferred): rates partial failure cached as success for 6 h; ko label padEnd width; old wiki cache entries never pruned.
