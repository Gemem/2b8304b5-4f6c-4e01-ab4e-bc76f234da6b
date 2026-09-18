// Rubric 14: the trunk shows a brighter side and a darker side consistent with a directional light
// rather than uniform flat fill.
const { test, expect, ready, park, settle, frameBuffer } = require('./_fixtures');

test('the trunk carries a bright side and a dark one, and the sun is what draws them', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);
  /* Hold the camera still for the two readings: damping keeps nudging it for frames after a park,
     and a few pixels of drift between them is enough to muddy what the sun is doing. */
  await page.evaluate(() => {
    const a = window.app;
    a.controls.enableDamping = false;
    a.camera.position.fromArray(a.CAM_DEFAULT.p);
    a.controls.target.fromArray(a.CAM_DEFAULT.t);
    a.camera.lookAt(a.controls.target);
    a.controls.update();
  });
  await settle(page, 2);

  /* Points right around the trunk, kept only where the bark fills the pixel and its neighbours: on
     the silhouette a pixel is half sky and says nothing about how the wood is lit. */
  const spots = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const gl = a.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const bark = new Set();
    a.trunk.traverse(o => { if (o.isMesh && !/leaf/i.test(o.name || '')) bark.add(o); });
    const out = [];
    for (const y of [2.5, 3.5, 4.5, 6.5, 7.5, 9.5]) {
      const stem = a.trunkAt(y);
      for (let k = 0; k < 64; k++) {
        const th = k / 64 * Math.PI * 2;
        const p = new THREE.Vector3(stem.x + Math.cos(th) * (stem.r + 0.02), y, stem.z + Math.sin(th) * (stem.r + 0.02));
        const s = p.clone().project(cam);
        if (Math.abs(s.x) > 0.95 || Math.abs(s.y) > 0.95) continue;
        let inside = true;
        for (const [dx, dy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
          ray.setFromCamera(new THREE.Vector2(s.x + dx * 2 / W, s.y + dy * 2 / H), cam);
          const hit = ray.intersectObjects(a.scene.children, true)
            .find(h => [].concat(h.object.material).every(mm => !mm || mm.visible !== false));
          if (!hit || !bark.has(hit.object)) { inside = false; break; }
        }
        if (inside) out.push([Math.round((s.x * 0.5 + 0.5) * W), Math.round((s.y * 0.5 + 0.5) * H)]);
      }
    }
    return out;
  });

  expect(spots.length).toBeGreaterThan(20);

  const lit = await frameBuffer(page);
  // the same bark with the sun taken away, to see what the sun itself is drawing
  await page.evaluate(() => {
    window.app.scene.traverse(o => {
      if (o.isDirectionalLight && o.intensity > 1) { o.userData.was = o.intensity; o.intensity = 0; }
    });
  });
  await settle(page, 2);
  const flat = await frameBuffer(page);
  await page.evaluate(() => {
    const a = window.app;
    a.scene.traverse(o => { if (o.isDirectionalLight && o.userData.was !== undefined) o.intensity = o.userData.was; });
    a.controls.enableDamping = true;
  });
  await settle(page, 2);

  const lum = (buf, x, y) => {
    if (x < 1 || y < 1 || x >= buf.w - 1 || y >= buf.h - 1) return null;
    const o = ((buf.h - 1 - y) * buf.w + x) * 4;
    return 0.2126 * buf.data[o] + 0.7152 * buf.data[o + 1] + 0.0722 * buf.data[o + 2];
  };
  const mid = arr => arr.slice().sort((p, q) => p - q)[Math.floor(arr.length / 2)];

  /* How wide a range of brightness the bark shows on screen, and how much of that range the sun is
     responsible for. Which side is the bright one depends on where you stand; that there is a
     bright side and a dark one, and that the sun draws them, does not. */
  const spread = buf => {
    const vals = spots.map(([x, y]) => lum(buf, x, y)).filter(v => v !== null).sort((p, q) => p - q);
    return vals[Math.floor(vals.length * 0.9)] - vals[Math.floor(vals.length * 0.1)];
  };
  const withSun = spread(lit), without = spread(flat);
  const gains = spots.map(([x, y]) => (lum(lit, x, y) ?? 0) - (lum(flat, x, y) ?? 0));

  // the trunk is modelled rather than flat-filled: its lit and shaded parts are far apart
  expect(withSun).toBeGreaterThan(45);
  // and the sun is what opens that range: without it the bark flattens out
  expect(without).toBeLessThan(withSun * 0.85);
  // it reaches the wood rather than leaving it to the sky alone
  expect(mid(gains)).toBeGreaterThan(10);
});