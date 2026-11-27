# termtab privacy policy

Last updated: 2026-11-27

termtab does not collect, sell or share any data about you.

- **No accounts, no analytics, no tracking.** termtab has no server of its own and sends nothing to its developer.
- **Your data stays on your device.** Your layout, preferences, to-do lists, notes, habits, countdowns and cached widget data are stored in `chrome.storage.local` in your browser. They are not synced and not uploaded anywhere.
- **Requests only for widgets you turn on.** A widget that shows online data (weather, news, prices) fetches it straight from that data source, only while the widget is on your dashboard and only while the dashboard is open. There is no background polling. Widgets you have not added make no requests.
- **Export files stay local.** Preferences → Export settings saves a JSON file to your computer. termtab never uploads it; importing reads a file you pick and changes nothing if it is not a valid termtab backup.

## What each widget sends

Each request goes directly from your browser to the service below. Like any web request, the service sees your IP address and your browser's user agent; termtab adds no identifiers, cookies or account data.

| Widget | Service | What the request contains |
|---|---|---|
| Weather | Open-Meteo forecast (`api.open-meteo.com`) | The latitude and longitude of the city you chose, and the temperature unit |
| Weather (city search in settings) | Open-Meteo geocoding (`geocoding-api.open-meteo.com`) | The city name you type into the search box, and the UI language |
| Exchange rates | Frankfurter (`api.frankfurter.dev`) | The currency codes you picked (for example KRW, USD) |
| Crypto prices | CoinGecko (`api.coingecko.com`) | The coin ids you picked (for example bitcoin) and the price currency |
| Hacker News | Hacker News API (`hacker-news.firebaseio.com`) | Nothing about you: the top-stories list and those story ids |
| DEV top posts | DEV API (`dev.to`) | Nothing about you: "top posts of the week" |
| GitHub trending | GitHub search API (`api.github.com`) | Nothing about you: the date one week ago |
| On this day | Wikimedia feed API (`api.wikimedia.org`) | Nothing about you: today's month and day, and the edition language (falls back to English when your language has no feed) |
| Links (favicons) | Google's favicon service (`www.google.com/s2/favicons`) | **The hostname of each link in your list** (for example `github.com`), to show the site's icon. Google receives these hostnames when the icons load. |
| Search window | Your default search engine as set in Chrome (through Chrome's search API), or GitHub if you pick it | What you type, only when you press Enter. This is a normal search on that site; termtab never changes your default search engine. |

Every other widget (clock, focus timer, to-do, notes, habits, countdown, ambient sound, workday, calendar, world clocks, calculator, fortune, system info, system monitor) works entirely on your device and makes no network requests.

## Permissions

- `storage`: saves your settings and cached data on your device.
- `alarms`: ends a focus session on time.
- `search`: hands your search text to the default search engine you chose in Chrome.
- `system.cpu`, `system.memory`: CPU and memory usage for the System monitor widget, read on your device and never sent anywhere.

termtab requests no host permissions and runs no remote code.

## Removing your data

Uninstalling termtab deletes everything it stored. You can also clear or edit any widget's content (to-do items, notes, links) in the widget itself.

## Contact

Questions about this policy: open an issue in the project's repository.
