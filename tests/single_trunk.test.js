// Rubric 3: a single vertical trunk runs through the scene as the central support, with no second
// trunk of comparable thickness.
const { test, expect, ready, park } = require('./_fixtures');

test('one trunk carries the scene, with nothing else of its thickness standing beside it', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;

    // how thick the central trunk is over the height the decks occupy
    const heights = [2, 4, 6, 8, 10];
    const sections = heights.map(y => {
      const s = a.trunkSection(y);
      return s ? { y, r: (s.rx + s.rz) / 2, x: s.x, z: s.z } : { y, r: 0, x: 0, z: 0 };
    });
    const trunkR = sections.reduce((acc, s) => acc + s.r, 0) / sections.length;

    /* Anything else in the scene that stands through that same band of heights, as thick as the
       trunk: a second tree, a mast, a duplicate. Leaves and foliage are not structure, and the
       tree's own meshes are the trunk itself. */
    const rivals = [];
    scene: {
      const inTree = new Set();
      a.trunk.traverse(o => inTree.add(o));
      a.scene.updateMatrixWorld(true);
      a.scene.traverse(o => {
        if (!o.isMesh || inTree.has(o)) return;
        const b = new THREE.Box3().setFromObject(o);
        const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
        const spans = b.min.y < 3 && b.max.y > 8;                 // stands through the deck band
        const thick = Math.min(w, d) > trunkR;                    // as thick as the trunk
        const column = h > 2 * Math.max(w, d) && Math.max(w, d) < 8;  // a column, not the sky or the ground
        if (spans && thick && column) rivals.push({ name: o.name || '(unnamed)', w: +w.toFixed(2), h: +h.toFixed(2) });
      });
    }

    // the trunk is one column, not two: its centre barely wanders with height
    const dx = Math.max(...sections.map(s => Math.abs(s.x))), dz = Math.max(...sections.map(s => Math.abs(s.z)));
    return { sections, trunkR, rivals, dx, dz };
  });

  expect(m.trunkR).toBeGreaterThan(0.3);            // there is a trunk at all
  for (const s of m.sections) expect(s.r).toBeGreaterThan(0.25);   // continuous over the deck band
  expect(m.dx).toBeLessThan(1.2);                   // vertical, not leaning away
  expect(m.dz).toBeLessThan(1.2);
  expect(m.rivals).toEqual([]);                     // and nothing else of that thickness
});