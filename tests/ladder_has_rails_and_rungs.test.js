// Rubric 8: a ladder is built as two side rails with at least three separate rungs between them
// rather than a single flat slab.
const { test, expect, ready, park } = require('./_fixtures');

test('the ladder is two rails with separate rungs between them', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    let found = null;
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (o.name !== 'ladder' || found) return;
      const rails = [], rungs = [];
      o.traverse(c => {
        if (!c.isMesh) return;
        const b = new THREE.Box3().setFromObject(c), s = b.getSize(new THREE.Vector3());
        const rec = { len: Math.max(s.x, s.y, s.z), thick: Math.min(s.x, s.y, s.z),
          centre: b.getCenter(new THREE.Vector3()).toArray() };
        if (c.name === 'ladder rail') rails.push(rec);
        if (c.name === 'ladder rung') rungs.push(rec);
      });
      found = { rails, rungs };
    });
    return found;
  });

  expect(m).not.toBeNull();
  expect(m.rails.length).toBe(2);                   // two side rails
  expect(m.rungs.length).toBeGreaterThanOrEqual(3); // and at least three rungs between them
  // the rails run the length of the ladder and the rungs are short bars across it
  for (const r of m.rails) expect(r.len).toBeGreaterThan(1.5);
  for (const r of m.rungs) {
    expect(r.len).toBeLessThan(1);
    expect(r.thick).toBeLessThan(0.2);              // bars, not a slab
  }
  // the rungs are separate: no two share a height
  const ys = m.rungs.map(r => r.centre[1]).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(0.05);
  // the two rails stand apart, with the rungs between them
  const gap = Math.hypot(m.rails[0].centre[0] - m.rails[1].centre[0], m.rails[0].centre[2] - m.rails[1].centre[2]);
  expect(gap).toBeGreaterThan(0.2);
});