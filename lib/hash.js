// Small stable hash of a settings object (FNV-1a over a key-sorted JSON string), base36.
const sorted = (v) => {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]));
  }
  return v;
};

export function hash(settings) {
  const s = JSON.stringify(sorted(settings ?? null));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
