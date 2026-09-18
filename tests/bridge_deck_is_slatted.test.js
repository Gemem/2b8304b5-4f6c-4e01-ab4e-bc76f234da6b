// Rubric 11: the rope bridge's deck is made of multiple separate slats or segments along its span
// rather than one unbroken board.
const { test, expect, ready, park } = require('./_fixtures');

test('the bridge walk is laid in separate slats along its span', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    let found = null;
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (o.name !== 'rope bridge' || found) return;
      const slats = [];
      o.traverse(c => {
        if (c.name !== 'bridge slat') return;
        const b = new THREE.Box3().setFromObject(c);
        /* the slat's own dimensions rather than the box around it: each one is turned to follow
           the span, so a world-space box reports the turn and not the board */
        const g = c.geometry.parameters;
        slats.push({ centre: b.getCenter(new THREE.Vector3()).toArray(),
          long: Math.max(g.width, g.depth), short: Math.min(g.width, g.depth), thick: g.height });
      });
      if (!slats.length) return;
      const A = slats[0].centre, B = slats[slats.length - 1].centre;
      const axis = new THREE.Vector3(B[0] - A[0], 0, B[2] - A[2]);
      const span = axis.length();
      axis.normalize();
      const ts = slats.map(s => new THREE.Vector3(s.centre[0] - A[0], 0, s.centre[2] - A[2]).dot(axis))
        .sort((x, y) => x - y);
      const gaps = [];
      for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
      found = { count: slats.length, span, gaps, slats };
    });
    return found;
  });

  expect(m).not.toBeNull();
  expect(m.count).toBeGreaterThanOrEqual(6);        // slats, not one board
  // they are spread along the span rather than bunched at one end
  const spacing = m.span / (m.count - 1);
  for (const g of m.gaps) {
    expect(g).toBeGreaterThan(spacing * 0.4);
    expect(g).toBeLessThan(spacing * 1.8);
  }
  // and each is a short board across the walk, not a plank running its length
  for (const s of m.slats) {
    expect(s.long).toBeLessThan(m.span * 0.5);
    expect(s.thick).toBeLessThan(0.15);
  }
});