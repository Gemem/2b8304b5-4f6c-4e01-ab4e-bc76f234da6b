// Rubric 22: any on-screen panel or label sits clear of the trunk and the three platforms rather
// than covering them.
const { test, expect, ready, park } = require('./_fixtures');

test('no panel or label covers the trunk or the terraces', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();

    /* what must stay uncovered: the trunk's own wood and the three terraces */
    const guarded = new Set();
    a.trunk.traverse(o => { if (o.isMesh && !/leaf|foliage/i.test(o.name || '')) guarded.add(o); });
    a.platforms.forEach(p => p.group.traverse(o => {
      if (o.isMesh && (!o.material || o.material.visible !== false)) guarded.add(o);
    }));

    /* every panel and label the page paints over the canvas. A panel is something that says
       something: the decorative vignette lying over the whole frame carries no text and is not
       what the rubric means by a panel. */
    const panels = [];
    for (const el of document.body.children) {
      if (el.id === 'scene' || el.tagName === 'SCRIPT') continue;
      if (!(el.textContent || '').trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) continue;
      panels.push({ tag: el.tagName + (el.id ? '#' + el.id : ''), rect: [r.left, r.top, r.right, r.bottom] });
    }

    /* a panel covers the tree if the scene behind any of its pixels is trunk or terrace */
    const covers = [];
    for (const p of panels) {
      const [l, t, rgt, b] = p.rect;
      let hits = 0, samples = 0;
      for (let x = Math.max(2, l + 2); x < Math.min(innerWidth - 2, rgt - 2); x += 8) {
        for (let y = Math.max(2, t + 2); y < Math.min(innerHeight - 2, b - 2); y += 8) {
          samples++;
          ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), cam);
          const hit = ray.intersectObjects(a.scene.children, true)
            .find(k => [].concat(k.object.material).every(mm => !mm || mm.visible !== false));
          if (hit && guarded.has(hit.object)) hits++;
        }
      }
      covers.push({ ...p, samples, hits });
    }
    return { covers, viewport: [innerWidth, innerHeight] };
  });

  expect(m.covers.length).toBeGreaterThanOrEqual(2);     // there are panels to check
  for (const p of m.covers) {
    expect(p.samples).toBeGreaterThan(0);
    // nothing behind this panel is trunk or terrace
    expect({ panel: p.tag, hits: p.hits }).toEqual({ panel: p.tag, hits: 0 });
  }
});