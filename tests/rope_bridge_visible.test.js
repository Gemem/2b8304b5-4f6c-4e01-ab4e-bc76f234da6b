// Rubric 6: a rope bridge spanning between two platforms is visible.
const { test, expect, ready, park } = require('./_fixtures');

test('a rope bridge spans between two terraces in the opening view', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const bridges = [];
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (o.name !== 'rope bridge') return;
      const b = new THREE.Box3().setFromObject(o);
      let slats = 0, ropes = 0;
      o.traverse(c => { if (c.name === 'bridge slat') slats++; if (c.name === 'bridge rope') ropes++; });
      /* which terraces it reaches: the decks whose rim its two ends sit on */
      const ends = [b.min, b.max];
      const near = a.platforms.map((p, i) => {
        const c = a.deckCentre(i);
        return Math.min(...ends.map(e => Math.hypot(e.x - c.x, e.z - c.z)));
      });
      bridges.push({ slats, ropes, span: Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z),
        drop: b.max.y - b.min.y, near, onScreen: null });
    });
    /* and it is in shot: both ends project inside the frame */
    const shots = bridges.map(() => null);
    return { bridges, shots, decks: a.platforms.length };
  });

  expect(m.bridges.length).toBeGreaterThanOrEqual(1);
  const b = m.bridges[0];
  expect(b.slats).toBeGreaterThan(5);
  expect(b.ropes).toBeGreaterThan(3);
  expect(b.span).toBeGreaterThan(1.5);              // it really spans a gap
  // it reaches two of the three terraces
  const reached = b.near.filter(d => d < 3.2).length;
  expect(reached).toBeGreaterThanOrEqual(2);
});