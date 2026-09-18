// Rubric 2: dragging on the canvas rotates the view of the treehouse.
const { test, expect, ready, park, drag, settle } = require('./_fixtures');

test('a pointer drag turns the view around the tree', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  const before = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const seen = a.platforms.map((p, i) => a.deckCentre(i).clone().project(a.camera).x);
    return {
      azimuth: a.controls.getAzimuthalAngle(),
      camera: a.camera.position.toArray(),
      target: a.controls.target.toArray(),
      deckX: seen,
    };
  });

  await drag(page, [0.2, 0.75], [0.72, 0.6], 24);
  await settle(page, 6);

  const after = await page.evaluate(() => {
    const a = window.app;
    const inFrame = a.platforms.map((p, i) => {
      const v = a.deckCentre(i).clone().project(a.camera);
      return Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    });
    return {
      azimuth: a.controls.getAzimuthalAngle(),
      camera: a.camera.position.toArray(),
      target: a.controls.target.toArray(),
      inFrame,
    };
  });

  // the view turned about the tree rather than sliding or standing still
  let turned = Math.abs(after.azimuth - before.azimuth);
  if (turned > Math.PI) turned = Math.PI * 2 - turned;
  expect(turned).toBeGreaterThan(0.35);

  const dist = v => Math.hypot(v[0] - after.target[0], v[1] - after.target[1], v[2] - after.target[2]);
  // the drag orbits: the camera moved, the point it looks at did not, and the distance held
  expect(Math.hypot(...after.camera.map((v, i) => v - before.camera[i]))).toBeGreaterThan(2);
  expect(Math.hypot(...after.target.map((v, i) => v - before.target[i]))).toBeLessThan(0.05);
  expect(Math.abs(dist(after.camera) - dist(before.camera))).toBeLessThan(1.5);

  // and the tree is still the subject afterwards
  expect(after.inFrame.filter(Boolean).length).toBeGreaterThanOrEqual(2);

  await park(page);
});