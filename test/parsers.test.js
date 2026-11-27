import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import weather, { buildUrl as weatherUrl, wmo, geocodeUrl } from "../widgets/weather.js";
import rates, { buildUrl as ratesUrl, rateText } from "../widgets/rates.js";
import crypto, { buildUrl as cryptoUrl } from "../widgets/crypto.js";
import hn, { buildUrl as hnUrl, itemUrl } from "../widgets/hn.js";
import devto, { buildUrl as devtoUrl } from "../widgets/devto.js";
import trending, { buildUrl as trendingUrl } from "../widgets/trending.js";
import wiki, { buildUrl as wikiUrl, resolveLang } from "../widgets/wiki.js";
import { WIDGETS } from "../widgets/index.js";
import { DEMO } from "../demo/data.js";

const fx = (n) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${n}.json`, import.meta.url)), "utf8"));
const en = JSON.parse(readFileSync(fileURLToPath(new URL("../_locales/en/messages.json", import.meta.url)), "utf8"));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

test("weather parse returns numbers and 12 hourly values", () => {
  const d = weather.parse(fx("weather"));
  for (const k of ["temp", "code", "wind", "humidity", "hi", "lo"]) assert.ok(isNum(d[k]), k);
  assert.equal(d.next12.length, 12);
  assert.ok(d.next12.every(isNum));
  assert.ok(isNum(d.tomorrow.code) && isNum(d.tomorrow.hi) && isNum(d.tomorrow.lo));
});

test("weather next12 starts at the current hour", () => {
  const raw = fx("weather");
  const i = raw.hourly.time.findIndex((t) => t.startsWith(raw.current.time.slice(0, 13)));
  assert.equal(weather.parse(raw).next12[0], raw.hourly.temperature_2m[i]);
});

test("weather url: default, fahrenheit only when f", () => {
  assert.equal(weatherUrl(weather.defaults),
    "https://api.open-meteo.com/v1/forecast?latitude=37.57&longitude=126.98&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2");
  assert.ok(weatherUrl({ ...weather.defaults, unit: "f" }).endsWith("&temperature_unit=fahrenheit"));
  assert.equal(geocodeUrl("Busan", "ko"),
    "https://geocoding-api.open-meteo.com/v1/search?name=Busan&count=5&language=ko");
});

test("wmo table maps to existing i18n keys", () => {
  for (const c of [0, 1, 2, 3, 45, 51, 61, 71, 80, 86, 95, 99, 12345]) {
    const w = wmo(c);
    assert.ok(en[w.key], w.key);
    assert.ok(w.sym);
  }
  assert.equal(wmo(0).sym, "☀");
  assert.equal(wmo(95).sym, "⛈");
});

test("rates parse: numbers, JPY per 100", () => {
  const d = rates.parse(fx("rates"));
  assert.equal(d.base, "KRW");
  assert.deepEqual(d.rows.map((r) => r.code), ["USD", "JPY", "EUR", "CNY"]);
  assert.ok(d.rows.every((r) => isNum(r.value) && isNum(r.per)));
  const jpy = d.rows.find((r) => r.code === "JPY");
  assert.equal(jpy.per, 100);
  assert.ok(Math.abs(jpy.value - fx("rates")[1].rates.KRW * 100) < 1e-6);
  assert.equal(d.rows.find((r) => r.code === "USD").per, 1);
});

test("rates url and display text", () => {
  assert.deepEqual(ratesUrl(rates.defaults), ["USD", "JPY", "EUR", "CNY"]
    .map((c) => `https://api.frankfurter.dev/v1/latest?from=${c}&to=KRW`));
  assert.equal(rateText({ code: "USD", per: 1, value: 1380 }, "KRW", "en"), "1 USD = 1,380 KRW");
  assert.equal(rateText({ code: "JPY", per: 100, value: 903.15 }, "KRW", "en"), "100 JPY = 903 KRW");
});

test("crypto parse and url", () => {
  const d = crypto.parse(fx("crypto"));
  assert.equal(d.vs, "usd");
  assert.equal(d.coins.length, 4);
  assert.ok(d.coins.every((c) => typeof c.id === "string" && isNum(c.price) && isNum(c.change)));
  assert.equal(cryptoUrl(crypto.defaults),
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd&include_24hr_change=true");
});

test("hn parse and urls", () => {
  const d = hn.parse(fx("hn"));
  assert.equal(d.length, 6);
  for (const s of d) {
    assert.ok(isNum(s.id) && isNum(s.score) && isNum(s.comments));
    assert.equal(typeof s.title, "string");
    assert.match(s.url, /^https?:\/\//);
    assert.equal(typeof s.host, "string");
  }
  assert.equal(hnUrl(hn.defaults), "https://hacker-news.firebaseio.com/v0/topstories.json");
  assert.equal(itemUrl(42), "https://hacker-news.firebaseio.com/v0/item/42.json");
});

test("hn: a story without url links to its item page; dead and null items are dropped", () => {
  const d = hn.parse({ ids: [1, 2, 3], items: [{ id: 1, title: "Ask HN: x", score: 3, descendants: 2 }, null, { id: 3, dead: true, title: "x" }] });
  assert.equal(d.length, 1);
  assert.equal(d[0].url, "https://news.ycombinator.com/item?id=1");
});

test("devto parse and url", () => {
  const d = devto.parse(fx("devto"));
  assert.equal(d.length, 5);
  assert.ok(d.every((a) => typeof a.title === "string" && /^https?:/.test(a.url) && isNum(a.reactions)));
  assert.equal(devtoUrl(devto.defaults), "https://dev.to/api/articles?top=7&per_page=5");
});

test("trending parse and url", () => {
  const d = trending.parse(fx("trending"));
  assert.equal(d.length, 5);
  for (const r of d) {
    assert.match(r.name, /^[^/]+\/[^/]+$/);
    assert.ok(isNum(r.stars));
    assert.equal(typeof r.desc, "string");
    assert.equal(typeof r.lang, "string");
    assert.match(r.url, /^https:\/\/github\.com\//);
  }
  assert.equal(trendingUrl(trending.defaults, new Date("2026-11-27T10:00:00Z")),
    "https://api.github.com/search/repositories?q=created:>2026-11-20&sort=stars&order=desc&per_page=5");
});

test("wiki parse and url", () => {
  const d = wiki.parse(fx("wiki"));
  assert.equal(d.length, 3);
  assert.ok(d.every((e) => isNum(e.year) && typeof e.text === "string"));
  assert.ok(d.some((e) => /^https?:/.test(e.url ?? "")));
  assert.equal(wikiUrl(wiki.defaults, new Date(2026, 10, 27)),
    "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/11/27");
  assert.equal(wikiUrl({ lang: "ko" }, new Date(2026, 0, 5)),
    "https://api.wikimedia.org/feed/v1/wikipedia/ko/onthisday/events/01/05");
  assert.equal(resolveLang("auto"), "en");
  assert.equal(resolveLang("ko"), "ko");
});

test("every parse rejects {} and null with an Error", () => {
  for (const w of [weather, rates, crypto, hn, devto, trending, wiki]) {
    for (const bad of [{}, null, "x", []]) {
      assert.throws(() => w.parse(bad), Error, `${w.meta.id} ${JSON.stringify(bad)}`);
    }
  }
});

test("online widgets: contract, ttl, registered, demo data present", () => {
  const ttl = { weather: 30, rates: 360, crypto: 5, hn: 15, devto: 60, trending: 360, wiki: 1440 };
  for (const [id, min] of Object.entries(ttl)) {
    const w = WIDGETS.find((x) => x.meta.id === id);
    assert.ok(w, id);
    assert.equal(w.ttlMs, min * 60 * 1000, id);
    assert.equal(typeof w.fetch, "function");
    assert.equal(typeof w.render, "function");
    assert.ok(DEMO[id] && Object.keys(DEMO[id]).length, `demo ${id}`);
  }
});
