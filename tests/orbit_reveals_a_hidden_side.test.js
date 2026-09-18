// Rubric 23: after rotating the camera, a side of a platform or of the trunk becomes visible that
// the opening view does not show.
const { test, expect, ready, park, drag, settle } = require('./_fixtures');

test('turning the view brings round a side the opening view never shows', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  /* Which patches of the trunk and of the terraces the camera can actually see from a given pose:
     a ring of points round the bark at three heights, and a ring round each terrace's rim, each
     counted only when the ray from the camera reaches it first. */
  const visible = () => page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const bark = new Set();
    a.trunk.traverse(o => { if (o.isMesh && !/leaf|foliage/i.test(o.name || '')) bark.add(o); });
    const seen = [];
    const test1 = (p, want) => {
      const s = p.clone().project(cam);
      if (Math.abs(s.x) > 0.97 || Math.abs(s.y) > 0.97) return false;
      ray.setFromCamera(new THREE.Vector2(s.x, s.y), cam);
      const hit = ray.intersectObjects(a.scene.children, true)
        .find(k => [].concat(k.object.material).every(mm => !mm || mm.visible !== false));
      return !!hit && want(hit.object) && Math.abs(hit.distance - cam.position.distanceTo(p)) < 0.6;
    };
    for (const y of [3, 6, 9]) {
      const stem = a.trunkAt(y);
      for (let k = 0; k < 24; k++) {
        const th = k / 24 * Math.PI * 2;
        const p = new THREE.Vector3(stem.x + Math.cos(th) * (stem.r + 0.02), y, stem.z + Math.sin(th) * (stem.r + 0.02));
        if (test1(p, o => bark.has(o))) seen.push('trunk:' + y + ':' + k);
      }
    }
    a.platforms.forEach((pl, i) => {
      const set = new Set();
      pl.group.traverse(o => { if (o.isMesh && (!o.material || o.material.visible !== false)) set.add(o); });
      const c = a.deckCentre(i);
      for (let k = 0; k < 24; k++) {
        const th = k / 24 * Math.PI * 2;
        const p = new THREE.Vector3(c.x + Math.cos(th) * (pl.def.radius - 0.2), c.y + 0.12, c.z + Math.sin(th) * (pl.def.radius - 0.2));
        if (test1(p, o => set.has(o))) seen.push('deck' + i + ':' + k);
      }
    });
    return seen;
  });

  const opening = await visible();
  expect(opening.length).toBeGreaterThan(10);

  await drag(page, [0.25, 0.7], [0.8, 0.62], 28);
  await settle(page, 6);

  const turned = await visible();
  expect(turned.length).toBeGreaterThan(10);

  const before = new Set(opening);
  const fresh = turned.filter(k => !before.has(k));
  // patches of the tree that the opening view does not show are now in sight
  expect(fresh.length).toBeGreaterThanOrEqual(5);
  // and they are on the structure itself, not only on the leaves
  expect(fresh.some(k => k.startsWith('trunk') || k.startsWith('deck'))).toBe(true);

  await park(page);
});