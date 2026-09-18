// Rubric 10: the rope bridge's walkway hangs lower at mid span than at the two platforms it
// connects rather than running flat and level.
const { test, expect, ready, park } = require('./_fixtures');

test('the bridge walk hangs lowest at mid span, not level between its anchors', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    let found = null;
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (o.name !== 'rope bridge' || found) return;
      /* every slat of the walk, ordered along the span, with its height */
      const slats = [];
      o.traverse(c => {
        if (c.name !== 'bridge slat') return;
        const b = new THREE.Box3().setFromObject(c);
        slats.push(b.getCenter(new THREE.Vector3()).toArray());
      });
      if (slats.length < 4) return;
      const A = slats[0], B = slats[slats.length - 1];
      const axis = new THREE.Vector3(B[0] - A[0], 0, B[2] - A[2]);
      const len = axis.length();
      axis.normalize();
      const along = slats.map(p => ({
        t: new THREE.Vector3(p[0] - A[0], 0, p[2] - A[2]).dot(axis) / len,
        y: p[1],
      })).sort((x, y) => x.t - y.t);
      found = { along, anchorY: [along[0].y, along[along.length - 1].y], len };
    });
    return found;
  });

  expect(m).not.toBeNull();
  const ends = Math.min(...m.anchorY);
  const mid = m.along.reduce((low, p) => (Math.abs(p.t - 0.5) < Math.abs(low.t - 0.5) ? p : low), m.along[0]);
  const lowest = m.along.reduce((low, p) => (p.y < low.y ? p : low), m.along[0]);

  // the middle hangs below the lower of the two anchors
  expect(ends - mid.y).toBeGreaterThan(0.2);
  // and the lowest point of the walk is at the middle of the span, not at one end
  expect(Math.abs(lowest.t - 0.5)).toBeLessThan(0.2);
  // the walk is a curve, not a straight line between the anchors: the middle sits well below the chord
  const chordMid = (m.along[0].y + m.along[m.along.length - 1].y) / 2;
  expect(chordMid - mid.y).toBeGreaterThan(0.2);
});