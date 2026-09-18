// Rubric 1: a visible treehouse with a central trunk renders.
const { test, expect, ready, park, frameBuffer } = require('./_fixtures');

test('the treehouse renders, with the tree and its decks drawn in the opening view', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const tree = new THREE.Box3().setFromObject(a.trunk), s = new THREE.Vector3();
    tree.getSize(s);
    let treeMeshes = 0;
    a.trunk.traverse(o => { if (o.isMesh) treeMeshes++; });
    const decks = a.platforms.map(p => {
      const b = new THREE.Box3().setFromObject(p.group);
      return { y: +b.max.y.toFixed(2), wide: +(b.max.x - b.min.x).toFixed(2) };
    });
    return { loadError: a.loadError ? String(a.loadError) : null, treeMeshes,
      treeSize: [s.x, s.y, s.z], treeBase: tree.min.y, decks };
  });

  expect(m.loadError).toBeNull();
  expect(m.treeMeshes).toBeGreaterThan(0);          // the package's tree really is in the scene
  expect(m.treeSize[1]).toBeGreaterThan(10);        // a tree, not a shrub
  expect(m.treeBase).toBeLessThan(0.5);             // standing on the ground, not floating
  expect(m.decks.length).toBe(3);
  for (const d of m.decks) expect(d.wide).toBeGreaterThan(1);

  // and something is actually drawn: the frame is neither empty nor one flat colour
  const { w, h, data } = await frameBuffer(page);
  let lit = 0;
  const tones = new Set();
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o] + data[o + 1] + data[o + 2] > 24) lit++;
    if (i % 97 === 0) tones.add((data[o] >> 4) + ',' + (data[o + 1] >> 4) + ',' + (data[o + 2] >> 4));
  }
  expect(lit / (w * h)).toBeGreaterThan(0.9);
  expect(tones.size).toBeGreaterThan(8);
});