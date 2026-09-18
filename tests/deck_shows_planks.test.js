// Rubric 18: each platform deck shows separate plank or board divisions rather than reading as one
// unbroken flat surface.
const { test, expect, ready, park } = require('./_fixtures');

test('every terrace floor is laid in separate boards, not one slab', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const m = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    return a.platforms.map(p => {
      /* the walkway boards: each its own mesh, with a run of daylight between one and the next */
      /* measured in the terrace's own frame: its group is turned to face its side of the trunk, so
         a world-space box would report the turned envelope rather than the board */
      const boards = p.boards.map(b => ({
        z: b.position.z,
        depth: b.geometry.parameters.depth * b.scale.z,
      })).sort((x, y) => x.z - y.z);
      let gaps = 0, minGap = Infinity;
      for (let k = 1; k < boards.length; k++) {
        const g = (boards[k].z - boards[k - 1].z) - (boards[k].depth + boards[k - 1].depth) / 2;
        if (g > 0.01) { gaps++; minGap = Math.min(minGap, g); }
      }
      /* and the terrace floor the package ships, which is modelled as planking rather than a disc */
      let deckMeshes = 0, deckTris = 0;
      p.base.traverse(o => {
        if (!o.isMesh) return;
        deckMeshes++;
        const g = o.geometry;
        deckTris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      });
      return { name: p.def.name, boards: boards.length, gaps, minGap, deckMeshes, deckTris };
    });
  });

  for (const d of m) {
    expect(d.boards).toBeGreaterThanOrEqual(8);     // boards, not a plank
    expect(d.gaps).toBeGreaterThanOrEqual(d.boards - 2);
    expect(d.minGap).toBeGreaterThan(0.01);         // a real line of shadow between them
    expect(d.deckTris).toBeGreaterThan(500);        // the floor is modelled, not a flat quad
  }
});