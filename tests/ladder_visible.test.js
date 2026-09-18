// Rubric 7: a ladder joining two platforms is visible.
const { test, expect, ready, park } = require('./_fixtures');

test('a ladder joins two terraces in the opening view', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const ladders = [];
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (o.name !== 'ladder') return;
      const b = new THREE.Box3().setFromObject(o);
      const foot = new THREE.Vector3(), head = new THREE.Vector3();
      b.getCenter(foot); foot.y = b.min.y;
      b.getCenter(head); head.y = b.max.y;
      const deckYs = a.platforms.map((p, i) => a.state.ys[i]);
      ladders.push({
        rise: b.max.y - b.min.y,
        footY: b.min.y, headY: b.max.y,
        nearFoot: Math.min(...deckYs.map(y => Math.abs(y - b.min.y))),
        nearHead: Math.min(...deckYs.map(y => Math.abs(y - b.max.y))),
      });
    });
    return { ladders, deckYs: a.state.ys.slice() };
  });

  expect(m.ladders.length).toBeGreaterThanOrEqual(1);
  const l = m.ladders[0];
  expect(l.rise).toBeGreaterThan(1.5);              // it climbs a real height
  expect(l.nearFoot).toBeLessThan(0.8);             // from one terrace's level
  expect(l.nearHead).toBeLessThan(0.8);             // to another's
  expect(l.headY - l.footY).toBeGreaterThan(1.5);
});