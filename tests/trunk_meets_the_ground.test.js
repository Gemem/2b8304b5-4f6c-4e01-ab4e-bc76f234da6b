// Rubric 20: the base of the trunk meets a visible ground or terrain surface rather than ending in
// empty space.
const { test, expect, ready, park, frameBuffer } = require('./_fixtures');

test('the trunk stands on ground you can see, not in mid air', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const gl = a.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;

    const groundMeshes = new Set();
    a.scene.traverse(o => { if (o.isMesh && /floor|ground|terrain/i.test(o.name || '')) groundMeshes.add(o); });

    /* the tree's own lowest point, and what lies directly under the bark all round its base */
    const tree = new THREE.Box3().setFromObject(a.trunk);
    const down = new THREE.Raycaster();
    const drops = [];
    const stem = a.trunkAt(1.2);
    for (let k = 0; k < 24; k++) {
      const th = k / 24 * Math.PI * 2;
      const r = stem.r + 1.4;                      // out past the root flare
      const from = new THREE.Vector3(stem.x + Math.cos(th) * r, 6, stem.z + Math.sin(th) * r);
      down.set(from, new THREE.Vector3(0, -1, 0));
      const hit = down.intersectObjects([...groundMeshes], true)[0];
      if (hit) drops.push(hit.point.y);
    }

    /* and what the camera actually sees just beyond the roots: ground, or sky? */
    const seen = { ground: 0, other: 0, sky: 0, spots: [] };
    for (let k = 0; k < 40; k++) {
      const th = k / 40 * Math.PI * 2;
      const r = stem.r + 2.2;
      const p = new THREE.Vector3(stem.x + Math.cos(th) * r, a.terrainY(stem.x + Math.cos(th) * r, stem.z + Math.sin(th) * r) + 0.05, stem.z + Math.sin(th) * r);
      const s = p.clone().project(cam);
      if (Math.abs(s.x) > 0.95 || Math.abs(s.y) > 0.95) continue;
      ray.setFromCamera(new THREE.Vector2(s.x, s.y), cam);
      const hit = ray.intersectObjects(a.scene.children, true)
        .find(h => [].concat(h.object.material).every(mm => !mm || mm.visible !== false));
      if (!hit) { seen.sky++; continue; }
      if (groundMeshes.has(hit.object)) {
        seen.ground++;
        seen.spots.push([Math.round((s.x * 0.5 + 0.5) * W), Math.round((s.y * 0.5 + 0.5) * H)]);
      } else seen.other++;
    }

    return {
      hasGround: groundMeshes.size > 0,
      treeBottom: tree.min.y,
      drops,
      groundUnderRoots: drops.length,
      seen,
      terrainAtTrunk: a.terrainY(stem.x, stem.z),
    };
  });

  expect(m.hasGround).toBe(true);
  // there is ground under the tree all the way round it
  expect(m.groundUnderRoots).toBeGreaterThanOrEqual(20);
  // and the tree is standing on it rather than hovering over it or sunk through it
  const lowest = Math.min(...m.drops), highest = Math.max(...m.drops);
  expect(m.treeBottom).toBeLessThan(highest + 0.35);
  expect(m.treeBottom).toBeGreaterThan(lowest - 1.6);
  // the ground around the roots is what the camera sees there, not sky
  expect(m.seen.ground).toBeGreaterThanOrEqual(8);
  expect(m.seen.sky).toBe(0);

  // and it is drawn: those pixels carry the floor's own colour rather than a flat fill
  const { w, h, data } = await frameBuffer(page);
  const tones = new Set();
  let lit = 0;
  for (const [x, y] of m.seen.spots) {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    const o = ((h - 1 - y) * w + x) * 4;
    if (data[o] + data[o + 1] + data[o + 2] > 40) lit++;
    tones.add((data[o] >> 4) + ',' + (data[o + 1] >> 4) + ',' + (data[o + 2] >> 4));
  }
  expect(lit).toBeGreaterThanOrEqual(6);
  expect(tones.size).toBeGreaterThan(1);
});