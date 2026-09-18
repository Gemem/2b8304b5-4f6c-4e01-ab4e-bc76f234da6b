// Rubric 16: the trunk surface and the platform decking differ in shade or roughness, not only in
// shape.
const { test, expect, ready, park, frameBuffer } = require('./_fixtures');

test('bark and decking differ in tone and in finish, not only in shape', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const gl = a.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;

    /* what the two surfaces are made of */
    let bark = null;
    a.trunk.traverse(o => { if (o.isMesh && !bark && !/leaf/i.test(o.name || '')) bark = o.material; });
    const deckMats = [];
    a.platforms.forEach(p => {
      p.base.traverse(o => { if (o.isMesh) deckMats.push(o.material); });
      p.boards.forEach(b => deckMats.push(b.material));
    });

    const pick = (set, points) => {
      const out = [];
      for (const q of points) {
        const s = q.clone().project(cam);
        if (Math.abs(s.x) > 0.95 || Math.abs(s.y) > 0.95) continue;
        ray.setFromCamera(new THREE.Vector2(s.x, s.y), cam);
        const hit = ray.intersectObjects(a.scene.children, true)
          .find(h => [].concat(h.object.material).every(mm => !mm || mm.visible !== false));
        if (!hit || !set.has(hit.object)) continue;
        out.push([Math.round((s.x * 0.5 + 0.5) * W), Math.round((s.y * 0.5 + 0.5) * H)]);
      }
      return out;
    };
    const barkMeshes = new Set();
    a.trunk.traverse(o => { if (o.isMesh && !/leaf/i.test(o.name || '')) barkMeshes.add(o); });
    const deckMeshes = new Set();
    a.platforms.forEach(p => { p.base.traverse(o => { if (o.isMesh) deckMeshes.add(o); }); p.boards.forEach(b => deckMeshes.add(b)); });

    const barkPts = [], deckPts = [];
    for (const y of [3.5, 6.5, 9.5]) {
      const stem = a.trunkAt(y);
      for (let k = 0; k < 24; k++) {
        const th = k / 24 * Math.PI * 2;
        barkPts.push(new THREE.Vector3(stem.x + Math.cos(th) * (stem.r + 0.02), y, stem.z + Math.sin(th) * (stem.r + 0.02)));
      }
    }
    a.platforms.forEach((p, i) => {
      const c = a.deckCentre(i);
      for (const f of [0.3, 0.55, 0.8]) {
        for (let k = 0; k < 24; k++) {
          const th = k / 24 * Math.PI * 2, r = f * p.def.radius;
          deckPts.push(new THREE.Vector3(c.x + Math.cos(th) * r, c.y + 0.12, c.z + Math.sin(th) * r));
        }
      }
    });

    return {
      barkSpots: pick(barkMeshes, barkPts),
      deckSpots: pick(deckMeshes, deckPts),
      barkRough: bark ? bark.roughness : null,
      deckRough: deckMats.length ? deckMats.reduce((s, mm) => s + (mm.roughness ?? 1), 0) / deckMats.length : null,
    };
  });

  expect(m.barkSpots.length).toBeGreaterThan(5);
  expect(m.deckSpots.length).toBeGreaterThan(5);

  const { w, h, data } = await frameBuffer(page);
  const median = list => {
    const got = [];
    for (const [x, y] of list) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const o = ((h - 1 - y) * w + x) * 4;
      got.push([data[o], data[o + 1], data[o + 2]]);
    }
    if (got.length < 3) return null;
    const ch = k => got.map(c => c[k]).sort((p, q) => p - q)[Math.floor(got.length / 2)];
    return [ch(0), ch(1), ch(2)];
  };
  const bark = median(m.barkSpots), deck = median(m.deckSpots);
  expect(bark).not.toBeNull();
  expect(deck).not.toBeNull();

  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // on screen the decking is the lighter of the two, by a wide margin
  expect(lum(deck) - lum(bark)).toBeGreaterThan(15);
  // and the two are given different finishes, not one material in two shapes
  expect(m.barkRough).not.toBeNull();
  expect(m.deckRough).not.toBeNull();
  expect(m.barkRough).toBeGreaterThan(m.deckRough + 0.04);
});