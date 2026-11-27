// Index of the slot nearest to (x, y): row first (vertical distance), then column.
// Past a box's horizontal centre the point lands after it (index + 1, clamped).
export function dropIndex(rects, x, y) {
  if (!rects.length) return 0;
  let best = 0;
  let bestKey = null;
  rects.forEach((r, i) => {
    const dy = Math.max(r.top - y, 0, y - (r.top + r.height));
    const dx = Math.max(r.left - x, 0, x - (r.left + r.width));
    const cx = Math.abs(x - (r.left + r.width / 2));
    if (!bestKey || dy < bestKey[0] || (dy === bestKey[0] && (dx < bestKey[1] || (dx === bestKey[1] && cx < bestKey[2])))) {
      bestKey = [dy, dx, cx];
      best = i;
    }
  });
  const r = rects[best];
  const after = x > r.left + r.width / 2;
  return Math.min(best + (after ? 1 : 0), rects.length - 1);
}
