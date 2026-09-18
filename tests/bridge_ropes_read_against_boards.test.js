// Rubric 17: the bridge ropes are a distinctly different colour from the platform decking so the
// ropes stay readable against the boards.
const { test, expect, ready, park, settle, frameBuffer } = require('./_fixtures');

test('the ropes read as a different colour from the boards they cross', async ({ page, appUrl }) => {
  await ready(page, appUrl);
  await park(page);

  /* Which pixels of the rendered frame belong to the ropes, and which to decking. Each candidate
     point is projected to the screen and then fired back at from the camera: it counts only if the
     ray meets that same surface first, so nothing behind the tree is sampled by mistake. */
  /* look at the bridge from a few metres off, the way someone inspecting it would: from the
     opening view it is small and half behind the railings */
  await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    let mid = null;
    a.scene.traverse(o => {
      if (o.name !== 'rope bridge' || mid) return;
      mid = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    });
    const out = new THREE.Vector3(mid.x, 0, mid.z).normalize().multiplyScalar(6);
    a.controls.enableDamping = false;
    a.camera.position.set(mid.x + out.x, mid.y + 1.6, mid.z + out.z);
    a.controls.target.copy(mid);
    a.camera.lookAt(mid);
    a.controls.update();
  });
  await settle(page, 3);

  const spots = await page.evaluate(() => {
    const a = window.app, THREE = a.THREE;
    const cam = a.camera, ray = new THREE.Raycaster();
    const gl = a.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const pick = (targets, limit) => {
      const set = new Set(targets);
      const out = [];
      const v = new THREE.Vector3();
      a.scene.updateMatrixWorld(true);
      for (const o of targets) {
        const pos = o.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 24));
        for (let i = 0; i < pos.count && out.length < limit; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          const p = v.clone().project(cam);
          if (Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.95 || p.z > 1) continue;
          ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
          /* the first surface the eye would meet: the grab proxies around each terrace are meshes
             with an invisible material, and they are not what is on screen */
          const hit = ray.intersectObjects(a.scene.children, true)
            .find(h => [].concat(h.object.material).every(mm => !mm || mm.visible !== false));
          if (!hit || !set.has(hit.object)) continue;      // something else is in front here
          out.push([Math.round((p.x * 0.5 + 0.5) * W), Math.round((p.y * 0.5 + 0.5) * H)]);
        }
      }
      return out;
    };
    const gather = match => {
      const list = [];
      a.scene.traverse(o => { if (o.isMesh && match(o)) list.push(o); });
      return list;
    };
    const ropes = gather(o => o.name === 'bridge rope');
    const boards = gather(o => o.name === 'bridge slat')
      .concat(a.platforms.flatMap(p => p.boards));
    return {
      W, H,
      rope: pick(ropes, 60),
      board: pick(boards, 60),
      ropeColour: ropes.length ? ropes[0].material.color.getHex() : null,
      boardColour: boards.length ? boards[0].material.color.getHex() : null,
    };
  });

  expect(spots.rope.length).toBeGreaterThan(5);
  expect(spots.board.length).toBeGreaterThan(5);

  const { w, h, data } = await frameBuffer(page);
  const read = list => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of list) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const o = ((h - 1 - y) * w + x) * 4;            // readPixels starts at the bottom row
      r += data[o]; g += data[o + 1]; b += data[o + 2]; n++;
    }
    return n ? { r: r / n, g: g / n, b: b / n, n } : null;
  };
  const rope = read(spots.rope.map(([x, y]) => [x, y]));
  const board = read(spots.board.map(([x, y]) => [x, y]));
  expect(rope).not.toBeNull();
  expect(board).not.toBeNull();

  // on screen the ropes are a clearly different tone from the boards they cross
  const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  expect(Math.abs(lum(rope) - lum(board))).toBeGreaterThan(18);
  const dist = Math.abs(rope.r - board.r) + Math.abs(rope.g - board.g) + Math.abs(rope.b - board.b);
  expect(dist).toBeGreaterThan(45);
  // and the two are given different colours in the first place
  expect(spots.ropeColour).not.toBe(spots.boardColour);

  await page.evaluate(() => { window.app.controls.enableDamping = true; });
  await park(page);                                   // hand the page back on the opening view
});