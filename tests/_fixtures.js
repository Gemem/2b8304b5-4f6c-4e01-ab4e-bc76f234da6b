/* One page, shared by every check. The scene is a 20 MB design package rendered on software GL in
   the reviewer's container, so it is loaded once per worker and every wait in this suite is on a
   condition — a frame counter, a flag — and never on the clock. */
const { test: base, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULES = path.join(ROOT, 'node_modules');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.bin': 'application/octet-stream',
};
const ctype = p => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

let server = null, origin = null;
function startServer() {
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      try {
        const rel = decodeURIComponent(req.url.split('?')[0]);
        const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.writeHead(404); res.end(); return;
        }
        res.writeHead(200, { 'Content-Type': ctype(file), 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(file).pipe(res);
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    server.listen(0, '127.0.0.1', () => { origin = 'http://127.0.0.1:' + server.address().port; resolve(); });
  });
}

const pkgFile = rel => fs.readFileSync(path.join(MODULES, rel));

/* The container has no network, so everything the page fetches from a CDN is served from the
   vendored copies instead. */
async function wireRoutes(page) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', r =>
    r.fulfill({ contentType: 'text/javascript', body: pkgFile('three/build/three.module.js') }));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/**', r => {
    const rel = new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/examples/jsm/', 'three/examples/jsm/');
    try { r.fulfill({ contentType: 'text/javascript', body: pkgFile(rel) }); } catch (e) { r.abort(); }
  });
  await page.route('https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4', r =>
    r.fulfill({ contentType: 'text/javascript', body: pkgFile('@tailwindcss/browser/dist/index.global.js') }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
}

const test = base.extend({
  appUrl: [async ({}, use) => { if (!server) await startServer(); await use(origin + '/index.html'); }, { scope: 'worker' }],
  appPage: [async ({ browser }, use) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await wireRoutes(page);
    await use(page);
    await page.close();
  }, { scope: 'worker' }],
  page: async ({ appPage }, use) => { await use(appPage); },
});

/* the tree is in, the loader has lifted, and a few fresh frames have been drawn on top of it */
async function ready(page, appUrl) {
  const live = await page.evaluate(() => !!(window.app && window.app.assetsReady)).catch(() => false);
  if (!live || page.url() !== appUrl) await page.goto(appUrl, { waitUntil: 'load', timeout: 480000 });
  await page.waitForFunction(() => window.app && window.app.assetsReady, null, { timeout: 480000 });
  await page.waitForFunction(() => {
    const l = document.getElementById('loader');
    return !l || l.classList.contains('hide') || getComputedStyle(l).opacity < 0.05;
  }, null, { timeout: 480000 });
  await settle(page, 3);
}

async function settle(page, n = 3) {
  const f0 = await page.evaluate(() => window.app.frame);
  await page.waitForFunction(({ f, n }) => window.app.frame >= f + n, { f: f0, n }, { timeout: 480000 });
}

/* Back to the opening view. A drag leaves momentum in the controls that keeps being applied for
   frames afterwards, so damping is switched off until the camera holds, then switched back on. */
async function park(page) {
  let off = Infinity;
  for (let i = 0; i < 6 && off > 0.01; i++) {
    await page.evaluate(() => {
      const a = window.app;
      a.controls.enableDamping = false;
      a.camera.position.fromArray(a.CAM_DEFAULT.p);
      a.controls.target.fromArray(a.CAM_DEFAULT.t);
      a.camera.lookAt(a.controls.target);
      a.controls.update();
    });
    await settle(page, 2);
    off = await page.evaluate(() => {
      const a = window.app;
      return a.camera.position.distanceTo(new a.THREE.Vector3().fromArray(a.CAM_DEFAULT.p));
    });
  }
  await page.evaluate(() => { window.app.controls.enableDamping = true; });
  await settle(page, 1);
  if (off > 0.05) throw new Error('park() did not hold the camera, off by ' + off.toFixed(4));
}

/* A pointer drag across the canvas, dispatched in the page as real PointerEvents: page.mouse
   waits on requestAnimationFrame for its actionability checks, which nearly stalls under software
   GL on a scene this heavy. */
async function drag(page, from, to, steps = 24) {
  await page.evaluate(({ from, to, steps }) => {
    const el = document.querySelector('#scene canvas');
    const r = el.getBoundingClientRect();
    const at = (p) => ({ clientX: r.left + r.width * p[0], clientY: r.top + r.height * p[1] });
    const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, ...at(from) }));
    for (let i = 1; i <= steps; i++) {
      const p = [from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps];
      el.dispatchEvent(new PointerEvent('pointermove', { ...opts, ...at(p) }));
    }
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, ...at(to), buttons: 0 }));
  }, { from, to, steps });
  await settle(page, 4);
}

/* The rendered frame, as a flat RGBA buffer read straight off the drawing buffer. */
async function frameBuffer(page) {
  return page.evaluate(() => {
    const gl = window.app.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const d = new Uint8Array(w * h * 4);
    window.app.renderer.render(window.app.scene, window.app.camera);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, d);
    return { w, h, data: Array.from(d) };
  });
}

module.exports = { test, expect, ready, settle, park, drag, frameBuffer };