// Rubric 13: all three platforms are distinguishable from the trunk and from the background in the
// opening view.
const { test, expect, ready, park, frameBuffer } = require('./_fixtures');

test('all three terraces read apart from the trunk and from what is behind them', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const spots = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const gl = a.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const bark = new Set();
    a.trunk.traverse(o => { if (o.isMesh && !/leaf/i.test(o.name || '')) bark.add(o); });
    const firstHit = (nx, ny) => {
      ray.setFromCamera(new THREE.Vector2(nx, ny), cam);
      return ray.intersectObjects(a.scene.children, true)
        .find(k => [].concat(k.object.material).every(mm => !mm || mm.visible !== false));
    };

    const barkPixels = [];
    for (const y of [3.5, 6.5, 9.5]) {
      const stem = a.trunkAt(y);
      for (let k = 0; k < 32; k++) {
        const th = k / 32 * Math.PI * 2;
        const p = new THREE.Vector3(stem.x + Math.cos(th) * (stem.r + 0.02), y, stem.z + Math.sin(th) * (stem.r + 0.02));
        const s = p.clone().project(cam);
        if (Math.abs(s.x) > 0.95 || Math.abs(s.y) > 0.95) continue;
        const hit = firstHit(s.x, s.y);
        if (!hit || !bark.has(hit.object)) continue;
        barkPixels.push([Math.round((s.x * 0.5 + 0.5) * W), Math.round((s.y * 0.5 + 0.5) * H)]);
      }
    }

    return {
      bark: barkPixels,
      decks: a.platforms.map((p, i) => {
        const set = new Set();
        p.group.traverse(o => { if (o.isMesh && (!o.material || o.material.visible !== false)) set.add(o); });
        const c = a.deckCentre(i);
        const cs = c.clone().project(cam);
        const cx = (cs.x * 0.5 + 0.5) * W, cy = (cs.y * 0.5 + 0.5) * H;

        /* the terrace floor itself */
        const face = [];
        for (const f of [0.3, 0.55, 0.8]) {
          for (let k = 0; k < 24; k++) {
            const th = k / 24 * Math.PI * 2;
            const q = new THREE.Vector3(c.x + Math.cos(th) * f * p.def.radius, c.y + 0.12, c.z + Math.sin(th) * f * p.def.radius);
            const s = q.clone().project(cam);
            if (Math.abs(s.x) > 0.95 || Math.abs(s.y) > 0.95) continue;
            const hit = firstHit(s.x, s.y);
            if (!hit || !set.has(hit.object)) continue;
            face.push([Math.round((s.x * 0.5 + 0.5) * W), Math.round((s.y * 0.5 + 0.5) * H)]);
          }
        }

        /* and pairs across its outline: the pixel just inside the rim against the one just outside,
           which is what tells you where the terrace ends and the scene behind it begins */
        const edges = [];
        for (let k = 0; k < 160; k++) {
          const th = k / 160 * Math.PI * 2;
          const q = new THREE.Vector3(c.x + Math.cos(th) * p.def.radius, c.y + 0.1, c.z + Math.sin(th) * p.def.radius);
          const s = q.clone().project(cam);
          if (Math.abs(s.x) > 0.93 || Math.abs(s.y) > 0.93) continue;
          const px = (s.x * 0.5 + 0.5) * W, py = (s.y * 0.5 + 0.5) * H;
          const dx = px - cx, dy = py - cy, len = Math.hypot(dx, dy) || 1;
          /* step out until the ray stops meeting this terrace: on a rim seen edge-on the step has
             to be a few pixels further than on one seen square */
          let pair = null;
          for (const [din, dout] of [[4, 5]]) {
            const inside = [Math.round(px - dx / len * din), Math.round(py - dy / len * din)];
            const outside = [Math.round(px + dx / len * dout), Math.round(py + dy / len * dout)];
            if (Math.min(inside[0], inside[1], outside[0], outside[1]) < 2) continue;
            if (inside[0] >= W - 2 || outside[0] >= W - 2 || inside[1] >= H - 2 || outside[1] >= H - 2) continue;
            const hi = firstHit((inside[0] / W) * 2 - 1, (inside[1] / H) * 2 - 1);
            if (!hi || !set.has(hi.object)) continue;
            const ho = firstHit((outside[0] / W) * 2 - 1, (outside[1] / H) * 2 - 1);
            if (ho && set.has(ho.object)) continue;
            pair = [inside, outside];
            break;
          }
          if (pair) edges.push(pair);
        }
        return { name: p.def.name, face, edges };
      }),
    };
  });

  const { w, h, data } = await frameBuffer(page);
  const px = (x, y) => {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return null;
    const o = ((h - 1 - y) * w + x) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  };
  const median = list => {
    const got = list.map(([x, y]) => px(x, y)).filter(Boolean);
    if (got.length < 3) return null;
    const ch = k => got.map(c => c[k]).sort((p, q) => p - q)[Math.floor(got.length / 2)];
    return [ch(0), ch(1), ch(2)];
  };
  const apart = (u, v) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) + Math.abs(u[2] - v[2]);

  const bark = median(spots.bark);
  expect(bark).not.toBeNull();

  for (const d of spots.decks) {
    // the terrace is on screen at all
    expect(d.face.length).toBeGreaterThanOrEqual(10);
    const face = median(d.face);
    expect(face).not.toBeNull();
    // its timber is a different colour from the bark of the trunk it stands against
    expect(apart(face, bark)).toBeGreaterThan(15);
    // and its outline reads: across the rim, inside and outside are plainly different
    expect(d.edges.length).toBeGreaterThanOrEqual(3);
    const steps = d.edges.map(([i2, o2]) => {
      const a2 = px(i2[0], i2[1]), b2 = px(o2[0], o2[1]);
      return a2 && b2 ? apart(a2, b2) : null;
    }).filter(v => v !== null).sort((p, q) => p - q);
    expect(steps[Math.floor(steps.length / 2)]).toBeGreaterThan(25);
  }
});
