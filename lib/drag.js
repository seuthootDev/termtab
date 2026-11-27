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

// Insertion slot for a dragged window: `rects` are the OTHER windows' boxes in layout order.
// Returns how many boxes the point is past (0..rects.length). A box is past when the point
// is below its row (rows = boxes sharing a top; a row ends at its tallest box), or in its
// row and right of its horizontal centre.
export function insertionIndex(rects, x, y) {
  const rowBottom = (r) =>
    Math.max(...rects.filter((o) => Math.abs(o.top - r.top) < 1).map((o) => o.top + o.height));
  let n = 0;
  for (const r of rects) {
    const below = y >= rowBottom(r);
    const inRowAfter = y >= r.top && x > r.left + r.width / 2;
    if (below || inRowAfter) n++;
    else break;
  }
  return n;
}
