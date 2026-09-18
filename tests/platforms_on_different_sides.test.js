// Rubric 19: the three platforms are offset to different sides of the trunk rather than stacked in
// one vertical column on the same side.
const { test, expect, ready, park } = require('./_fixtures');

test('the three terraces face three different sides of the trunk', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const sec = a.trunkSection(a.state.ys[1]);
    return a.platforms.map((p, i) => {
      const c = new THREE.Box3().setFromObject(p.base).getCenter(new THREE.Vector3());
      const dx = c.x - sec.x, dz = c.z - sec.z;
      return { name: p.def.name, bearing: Math.atan2(dz, dx), offset: Math.hypot(dx, dz),
        radius: Math.max(...[1].map(() => 0)) };
    });
  });

  // each terrace sits out to one side of the axis rather than around it
  for (const d of m) expect(d.offset).toBeGreaterThan(2);
  // and no two share a side
  for (let i = 0; i < m.length; i++) {
    for (let j = i + 1; j < m.length; j++) {
      let d = Math.abs(m[i].bearing - m[j].bearing);
      if (d > Math.PI) d = 2 * Math.PI - d;
      expect(d).toBeGreaterThan(0.7);              // about 40 degrees apart at the least
    }
  }
});