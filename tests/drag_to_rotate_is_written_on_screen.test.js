// Rubric 21: any on-screen instruction briefly describes the drag-to-rotate camera control, such as
// the words "Drag to rotate".
const { test, expect, ready, park } = require('./_fixtures');

test('the page tells you, on screen, that dragging rotates the view', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const found = await page.evaluate(() => {
    /* every piece of text actually on screen: laid out, not hidden, not transparent, and inside
       the window */
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.children.length) continue;                  // leaves only, so text is not counted twice
      const text = (el.textContent || '').trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const shown = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'
        && +cs.opacity > 0.1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      if (!shown) continue;
      let el2 = el.parentElement, visible = true;
      while (el2 && el2 !== document.body) {
        const p = getComputedStyle(el2);
        if (p.display === 'none' || p.visibility === 'hidden' || +p.opacity < 0.1) { visible = false; break; }
        el2 = el2.parentElement;
      }
      if (!visible) continue;
      out.push({ text, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), size: cs.fontSize });
    }
    return out;
  });

  expect(found.length).toBeGreaterThan(3);

  /* the instruction itself: dragging, and what it does to the view */
  const drag = found.filter(t => /\bdrag\b/i.test(t.text) && /(rotate|orbit|turn|spin)/i.test(t.text));
  expect(drag.length).toBeGreaterThanOrEqual(1);

  for (const d of drag) {
    expect(d.text.length).toBeLessThan(120);           // brief, not a paragraph
    expect(parseFloat(d.size)).toBeGreaterThan(8);     // and large enough to read
    expect(d.w).toBeGreaterThan(20);
  }
  // one of them says it the plain way
  expect(drag.some(d => /drag to rotate/i.test(d.text))).toBe(true);
});