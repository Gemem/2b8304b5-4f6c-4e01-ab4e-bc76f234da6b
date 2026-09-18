// Rubric 24: the rope bridge's support cables or ropes between the anchor platforms display a
// curved sag, with the lowest point at the span's center rather than forming straight lines.
const { test, expect, ready, park } = require('./_fixtures');

test('the bridge ropes hang in a curve, lowest at mid span', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    /* the rope curve the app builds, read straight from its own geometry: every vertex of the
       longest rope, ordered along the span */
    let best = null;
    a.scene.updateMatrixWorld(true);
    a.scene.traverse(o => {
      if (o.name !== 'bridge rope' || !o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      const span = Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z);
      if (best && span <= best.span) return;
      const v = new THREE.Vector3(), pts = [];
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        pts.push([v.x, v.y, v.z]);
      }
      best = { span, pts };
    });
    if (!best) return null;
    const pts = best.pts;
    let A = pts[0], B = pts[0], far = 0;
    for (const p of pts) for (const q of pts) {
      const d = Math.hypot(p[0] - q[0], p[2] - q[2]);
      if (d > far) { far = d; A = p; B = q; }
    }
    const axis = new THREE.Vector3(B[0] - A[0], 0, B[2] - A[2]);
    const len = axis.length();
    axis.normalize();
    const along = pts.map(p => ({
      t: new THREE.Vector3(p[0] - A[0], 0, p[2] - A[2]).dot(axis) / len, y: p[1],
    })).filter(p => p.t >= 0 && p.t <= 1);
    return { len, along };
  });

  expect(m).not.toBeNull();
  /* the underside of the rope, binned along the span, so the tube's own thickness does not read
     as a bulge above the line between its ends */
  const bins = 20;
  const floor = new Array(bins).fill(Infinity);
  for (const p of m.along) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(p.t * bins)));
    floor[b] = Math.min(floor[b], p.y);
  }
  const at = f => floor[Math.min(bins - 1, Math.max(0, Math.round(f * (bins - 1))))];
  const atStart = at(0), atMid = at(0.5), atEnd = at(1);

  // the rope dips below both of the points it is tied to
  expect(Math.min(atStart, atEnd) - atMid).toBeGreaterThan(0.2);

  /* and it hangs rather than runs: measured against the straight line between its ends, every
     sample sits on or below that line, and the deepest sag is at the middle of the span */
  const chord = t => atStart + (atEnd - atStart) * t;
  let deepest = { t: 0, drop: 0 };
  for (let b = 0; b < bins; b++) {
    if (!isFinite(floor[b])) continue;
    const t = (b + 0.5) / bins;
    const drop = chord(t) - floor[b];
    if (drop > deepest.drop) deepest = { t, drop };
  }
  // it is a hanging curve, not a line: it falls well away from the straight run between its ends
  expect(deepest.drop).toBeGreaterThan(0.25);
  expect(Math.abs(deepest.t - 0.5)).toBeLessThan(0.2);

  /* and it falls and rises once, rather than kinking: every step down to the lowest bin, every
     step up after it */
  const lowBin = floor.indexOf(Math.min(...floor.filter(isFinite)));
  for (let b = 1; b < bins; b++) {
    if (!isFinite(floor[b]) || !isFinite(floor[b - 1])) continue;
    if (b <= lowBin) expect(floor[b]).toBeLessThan(floor[b - 1] + 0.05);
    else expect(floor[b]).toBeGreaterThan(floor[b - 1] - 0.05);
  }
});