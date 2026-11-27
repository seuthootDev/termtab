import { h } from "../shell/dom.js";

export const DEFAULT_LINKS = [
  { title: "github", url: "https://github.com" },
  { title: "gmail", url: "https://mail.google.com" },
  { title: "youtube", url: "https://youtube.com" },
  { title: "claude", url: "https://claude.ai" },
  { title: "vercel", url: "https://vercel.com" },
  { title: "notion", url: "https://notion.so" },
];

export function isSafeUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

export const faviconUrl = (url) =>
  `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;

const hostOf = (url) => new URL(url).hostname.replace(/^www\./, "");

export function sanitizeLinks(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((l) => l && isSafeUrl(l.url)).map((l) => {
    const url = l.url.trim();
    return { title: String(l.title ?? "").trim() || hostOf(url), url };
  });
}

/** "title url" per line (or just a url). Returns the safe links and a count of rejected lines. */
export function parseLinks(text) {
  const links = [];
  let rejected = 0;
  for (const line of String(text).split("\n").map((l) => l.trim()).filter(Boolean)) {
    const i = line.search(/\s\S+$/);
    const url = i < 0 ? line : line.slice(i).trim();
    const title = i < 0 ? "" : line.slice(0, i).trim();
    if (isSafeUrl(url)) links.push(...sanitizeLinks([{ title, url }]));
    else rejected++;
  }
  return { links, rejected };
}

export default {
  meta: { id: "links", category: "basics", size: "small", source: "src_extension", command: () => "ls ~/links" },
  defaults: { links: DEFAULT_LINKS },
  render(el, ctx) {
    const links = sanitizeLinks(ctx.settings.links);
    el.append(h("div", { style: "display:flex;flex-wrap:wrap;gap:6px 14px" },
      ...links.map((l) => h("a", { href: l.url, target: "_blank", rel: "noopener" },
        h("img", { src: faviconUrl(l.url), width: 14, height: 14, alt: "", style: "vertical-align:-2px;margin-right:4px" }),
        h("span", { class: "dim" }, "~/"), l.title))));
  },
  settingsForm(settings, t) {
    const area = h("textarea", { class: "inp", rows: 8, "aria-label": t("linksLabel") });
    area.value = sanitizeLinks(settings.links).map((l) => `${l.title} ${l.url}`).join("\n");
    const msg = h("div", { class: "r", role: "alert" });
    const form = h("form", { class: "form" },
      h("label", {}, t("linksLabel"), area), msg,
      h("div", { class: "acts" }, h("button", { type: "submit", class: "sbtn" }, t("save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const { links, rejected } = parseLinks(area.value);
      if (rejected) {
        msg.textContent = t("linksRejected", rejected);
        return;
      }
      form.dispatchEvent(new CustomEvent("save", { detail: { ...settings, links } }));
    });
    return form;
  },
};
