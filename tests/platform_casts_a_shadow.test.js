// Rubric 15: at least one platform casts a shadow onto the trunk, the ground, or a platform below
// it.
const { test, expect, ready, park, settle, frameBuffer } = require('./_fixtures');

test('a terrace lays its shadow on the trunk and the ground below it', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const withDecks = await frameBuffer(page);
  /* take the three terraces out of the scene and light everything again: wherever the picture gets
     brighter, a terrace was standing between that surface and the sun */
  await page.evaluate(() => { window.app.platforms.forEach(p => { p.group.visible = false; }); });
  await settle(page, 2);
  const without = await frameBuffer(page);
  await page.evaluate(() => { window.app.platforms.forEach(p => { p.group.visible = true; }); });
  await settle(page, 2);

  const { w, h } = withDecks;
  const sum = (buf, i) => buf.data[i] + buf.data[i + 1] + buf.data[i + 2];
  const candidates = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = ((h - 1 - y) * w + x) * 4;
      if (sum(without, i) - sum(withDecks, i) > 60) candidates.push([x, y]);
    }
  }
  expect(candidates.length).toBeGreaterThan(50);

  /* Some of those pixels are simply where a terrace used to be drawn. The shadow is the rest: ask
     what the camera meets at each pixel with the terraces back in place, and keep the ones that
     land on the tree or the ground. */
  const step = Math.max(1, Math.floor(candidates.length / 150));
  const sampled = candidates.filter((_, i) => i % step === 0).slice(0, 150);
  const landed = await page.evaluate(({ pts, w, h }) => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const terrace = new Set();
    a.platforms.forEach(p => p.group.traverse(o => { if (o.isMesh) terrace.add(o); }));
    const bark = new Set();
    a.trunk.traverse(o => { if (o.isMesh && !/leaf/i.test(o.name || '')) bark.add(o); });
    let onBark = 0, onGround = 0, onTerrace = 0, elsewhere = 0;
    for (const [x, y] of pts) {
      ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, (y / h) * 2 - 1), cam);
      const hit = ray.intersectObjects(a.scene.children, true)
        .find(k => [].concat(k.object.material).every(mm => !mm || mm.visible !== false));
      if (!hit) { elsewhere++; continue; }
      if (terrace.has(hit.object)) onTerrace++;
      else if (bark.has(hit.object)) onBark++;
      else if (hit.point.y < 0.6) onGround++;
      else elsewhere++;
    }
    return { onBark, onGround, onTerrace, elsewhere, n: pts.length };
  }, { pts: sampled, w, h });

  // the terraces throw a real shadow, and it falls on the tree and the ground rather than on air
  expect(landed.onBark + landed.onGround).toBeGreaterThanOrEqual(10);
});