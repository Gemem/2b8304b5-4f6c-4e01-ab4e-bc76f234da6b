// Rubric 5: the three platforms sit at three different heights along the trunk, with no two at the
// same level.
const { test, expect, ready, park } = require('./_fixtures');

test('the three terraces sit at three different heights, and cannot be brought level', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const tops = a.platforms.map(p => new THREE.Box3().setFromObject(p.base).max.y);
    const bands = a.PLATFORM_DEFS.map(d => [d.lo, d.hi]);
    /* push every terrace as far as the app will let it go, both ways, and read the heights again:
       the bands do not overlap, so no arrangement can stack two at one level */
    const extremes = [];
    for (const target of [-100, 100]) {
      const ys = a.PLATFORM_DEFS.map((d, i) => a.clampY(i, target));
      extremes.push(ys);
    }
    return { tops, bands, extremes, ys: a.state.ys.slice() };
  });

  const [t0, t1, t2] = m.tops.slice().sort((a, b) => a - b);
  expect(t1 - t0).toBeGreaterThan(1);
  expect(t2 - t1).toBeGreaterThan(1);
  // the travel bands themselves never overlap
  for (let i = 0; i < 2; i++) expect(m.bands[i][1]).toBeLessThan(m.bands[i + 1][0]);
  for (const ys of m.extremes) {
    const s = ys.slice().sort((a, b) => a - b);
    expect(s[1] - s[0]).toBeGreaterThan(1);
    expect(s[2] - s[1]).toBeGreaterThan(1);
  }
});