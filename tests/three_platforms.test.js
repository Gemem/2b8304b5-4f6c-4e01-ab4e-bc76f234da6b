// Rubric 4: exactly three platforms are attached to the trunk.
const { test, expect, ready, park } = require('./_fixtures');

test('three platforms, and every one of them is attached to the trunk', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    /* every standing floor in the scene: a wide, roughly flat body up in the tree that is not part
       of the tree itself */
    const inTree = new Set();
    a.trunk.traverse(o => inTree.add(o));
    const floors = [];
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (!o.isMesh || inTree.has(o) || !o.visible) return;
      if ([].concat(o.material).every(mm => mm && mm.visible === false)) return;   // grab proxies
      const b = new THREE.Box3().setFromObject(o);
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y;
      const c = b.getCenter(new THREE.Vector3());
      const inTheTree = Math.hypot(c.x, c.z) < 9 && b.min.y > 2 && b.max.y < 20;   // not sky, not ground
      const floorLike = Math.min(w, d) > 2.5 && Math.max(w, d) > 3 && h > 0.15 && h < 3;
      if (inTheTree && floorLike) floors.push(+b.max.y.toFixed(2));
    });
    /* group them by height: one terrace is many meshes, but only one floor */
    const levels = [];
    for (const top of floors.sort((x, y) => x - y)) {
      if (!levels.length || top - levels[levels.length - 1] > 0.5) levels.push(top);
    }
    /* and what the app itself calls a terrace, with the walkway that ties it to the wood */
    const decks = a.platforms.map((p, i) => {
      const deck = new THREE.Box3().setFromObject(p.base);
      const walk = new THREE.Box3().setFromObject(p.walk);
      const sec = a.trunkSection(a.state.ys[i]);
      const axis = new THREE.Vector2(sec ? sec.x : 0, sec ? sec.z : 0);
      const near = Math.min(...[[walk.min.x, walk.min.z], [walk.min.x, walk.max.z], [walk.max.x, walk.min.z], [walk.max.x, walk.max.z]]
        .map(([x, z]) => Math.hypot(x - axis.x, z - axis.y)));
      const far = Math.max(...[[walk.min.x, walk.min.z], [walk.min.x, walk.max.z], [walk.max.x, walk.min.z], [walk.max.x, walk.max.z]]
        .map(([x, z]) => Math.hypot(x - axis.x, z - axis.y)));
      const deckNear = Math.hypot(deck.getCenter(new THREE.Vector3()).x - axis.x, deck.getCenter(new THREE.Vector3()).z - axis.y);
      return { name: p.def.name, trunkR: sec ? (sec.rx + sec.rz) / 2 : 0, walkNear: near, walkFar: far, deckCentre: deckNear };
    });
    return { floorCount: levels.length, levels, decks };
  });

  expect(m.decks.length).toBe(3);
  expect(m.floorCount).toBe(3);                    // three floors up the tree, no more
  for (const d of m.decks) {
    // the walkway starts at the bark and ends out on the terrace: that is the attachment
    expect(d.walkNear).toBeLessThan(d.trunkR + 0.45);
    expect(d.walkFar).toBeGreaterThan(d.trunkR + 0.8);
    expect(d.deckCentre).toBeGreaterThan(d.trunkR);
  }
});