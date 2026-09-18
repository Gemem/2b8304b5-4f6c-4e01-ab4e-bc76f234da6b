// Rubric 12: the trunk carries at least one branch or foliage mass rather than reading as a bare
// cylindrical pole.
const { test, expect, ready, park } = require('./_fixtures');

test('the trunk carries a crown of foliage rather than reading as a bare pole', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const trunkTop = Math.max(...[4, 6, 8, 10].map(y => y));      // the deck band ends about here
    let foliage = null, bark = null;
    a.trunk.traverse(o => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      const t = { name: o.name, min: b.min.toArray(), max: b.max.toArray(),
        width: Math.max(b.max.x - b.min.x, b.max.z - b.min.z), top: b.max.y,
        transparent: !!(o.material && (o.material.transparent || o.material.alphaTest > 0)) };
      if (t.transparent || /leaf|foliage/i.test(o.name || '')) {
        if (!foliage || t.width > foliage.width) foliage = t;
      } else if (!bark || t.width > bark.width) bark = t;
    });
    const sec = a.trunkSection(6);
    return { foliage, bark, trunkTop, stemR: sec ? (sec.rx + sec.rz) / 2 : 0 };
  });

  expect(m.foliage).not.toBeNull();
  // the crown sits above the deck band and spreads far wider than the stem it grows from
  expect(m.foliage.min[1]).toBeGreaterThan(m.trunkTop * 0.5);
  expect(m.foliage.top).toBeGreaterThan(14);
  expect(m.foliage.width).toBeGreaterThan(m.stemR * 6);
  // and it is a mass in its own right, not a sliver
  expect(m.foliage.max[1] - m.foliage.min[1]).toBeGreaterThan(4);
});