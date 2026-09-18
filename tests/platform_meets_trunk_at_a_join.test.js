// Rubric 9: each platform reads as a separate body meeting the trunk at a visible join rather than
// being one continuous shape with the trunk.
const { test, expect, ready, park } = require('./_fixtures');

test('each terrace is its own body, meeting the bark at a join', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const v = new THREE.Vector3();
    return a.platforms.map((p, i) => {
      const y = a.state.ys[i];
      const stem = a.trunkAt(y);                 // where the wood is, and how thick, at that height
      /* the closest the terrace floor itself comes to the stem: if the two were one shape there
         would be no daylight here at all */
      let deckNear = Infinity, deckFar = 0;
      p.base.updateMatrixWorld(true);
      p.base.traverse(o => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let k = 0; k < pos.count; k += 5) {
          v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld);
          const d = Math.hypot(v.x - stem.x, v.z - stem.z);
          if (d < deckNear) deckNear = d;
          if (d > deckFar) deckFar = d;
        }
      });
      /* what crosses that gap: the collar round the bark and the walkway on to the terrace */
      /* the collar, measured off its own ring rather than a box around it */
      let collarR = 0, collarN = 0;
      p.collar.updateMatrixWorld(true);
      {
        const pos = p.collar.geometry.attributes.position;
        for (let k = 0; k < pos.count; k += 3) {
          v.fromBufferAttribute(pos, k).applyMatrix4(p.collar.matrixWorld);
          collarR += Math.hypot(v.x - stem.x, v.z - stem.z);
          collarN++;
        }
        collarR /= Math.max(1, collarN);
      }
      const walk = new THREE.Box3().setFromObject(p.walk);
      let walkNear = Infinity, walkFar = 0;
      p.walk.updateMatrixWorld(true);
      p.walk.traverse(o => {
        if (!o.isMesh) return;
        const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
        const d = Math.hypot(c.x - stem.x, c.z - stem.z);
        if (d < walkNear) walkNear = d;
        if (d > walkFar) walkFar = d;
      });
      const deckTop = new THREE.Box3().setFromObject(p.base).max.y;
      return { name: p.def.name, stemR: stem.r, deckNear, deckFar, collarR, walkNear, walkFar,
        walkTop: walk.max.y, deckTop };
    });
  });

  for (const d of m) {
    // bark, then clear air, then the terrace floor
    expect(d.deckNear).toBeGreaterThan(d.stemR + 0.2);
    expect(d.deckFar).toBeGreaterThan(d.deckNear + 3);        // and it is a floor, not a sliver
    // the join is dressed rather than merged: a collar sized to the bark it rings
    expect(d.collarR).toBeGreaterThan(d.stemR);
    expect(d.collarR - d.stemR).toBeLessThan(0.45);
    // and a walkway that starts at the bark and ends on the terrace, at floor level
    expect(d.walkNear).toBeLessThan(d.stemR + 0.55);
    expect(d.walkFar).toBeGreaterThan(d.deckNear);
    expect(Math.abs(d.walkTop - d.deckTop)).toBeLessThan(0.35);
  }
});