import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const evidence = process.env.OPTICAL_EVIDENCE_DIR;
assert(evidence);
await mkdir(evidence, { recursive: true });
const files = new Map(
  await Promise.all(
    ['liquid-demo.html', 'heightfield.mjs'].map(async (name) => [
      name,
      await readFile(new URL(name, import.meta.url), 'utf8'),
    ])
  )
);
const server = createServer((request, response) => {
  const name = request.url === '/' ? 'liquid-demo.html' : request.url.slice(1);
  if (!files.has(name)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': name.endsWith('.mjs') ? 'text/javascript' : 'text/html',
  });
  response.end(files.get(name));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser, context, page;
const report = {
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  scope:
    'Independent experimental shape-normal/DOM-backdrop model; not Apple native, Prototype admission, or native/Compiler parity',
  browser: null,
  status: 'not-run',
  frames: [],
  errors: [],
};
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 780, height: 800 },
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
  const frame = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
  async function capture(name) {
    await frame();
    const pixels = await page.locator('#lens').screenshot();
    await page.screenshot({ path: path.join(evidence, `${name}.png`) });
    report.frames.push({
      name,
      state: await page.evaluate(() => ({
        ...window.liquidExperiment.state,
        frame: window.liquidExperiment.frame,
      })),
    });
    return pixels.toString('base64');
  }
  async function changedPixels(a, b) {
    return page.evaluate(
      async ({ a, b }) => {
        async function read(base64) {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        const aa = await read(a),
          bb = await read(b);
        let count = 0;
        for (let i = 0; i < aa.data.length; i += 4)
          if (
            Math.abs(aa.data[i] - bb.data[i]) +
              Math.abs(aa.data[i + 1] - bb.data[i + 1]) +
              Math.abs(aa.data[i + 2] - bb.data[i + 2]) >
            8
          )
            count++;
        return count;
      },
      { a, b }
    );
  }
  report.fieldGeometry = await page.evaluate(() => {
    const field = document.querySelector('#field');
    return {
      width: field.width.baseVal.value,
      height: field.height.baseVal.value,
      hrefBytes: field.getAttribute('href')?.length,
      filter: getComputedStyle(document.querySelector('#lens')).backdropFilter,
    };
  });
  assert.equal(report.fieldGeometry.width, 600);
  assert.equal(report.fieldGeometry.height, 264);
  const rest = await capture('liquid-rest');
  // Aesthetic gradients can be nearly constant under a narrow, monotonic rim.
  // Calibrate displacement on real high-contrast DOM content without changing
  // the field, alpha, scatter, geometry or threshold; restore it before visual review.
  await page.evaluate(() =>
    document.querySelector('#backdrop').setAttribute('data-calibration', '')
  );
  const calibration = await capture('calibration-refraction');
  await page.evaluate(() =>
    document.querySelector('#lens-displacement').setAttribute('scale', '0')
  );
  const noRefraction = await capture('negative-no-refraction');
  report.refractionChangedPixels = await changedPixels(calibration, noRefraction);
  assert(
    report.refractionChangedPixels > 300,
    'shape-normal refraction must visibly differ from the same geometry with zero displacement'
  );
  await page.evaluate(() =>
    document.querySelector('#lens-displacement').setAttribute('scale', '40')
  );
  await page.evaluate(() =>
    document.querySelector('#backdrop').removeAttribute('data-calibration')
  );
  // Isolated, non-periodic markers measure signed x/y movement, not a global diff score.
  await page.evaluate(() => {
    const backdrop = document.querySelector('#backdrop');
    backdrop.setAttribute('data-calibration', 'axes');
    backdrop.style.background = '#f4f8ff';
    const marker = document.createElement('div');
    marker.id = 'axis-markers';
    marker.innerHTML =
      '<i style="position:absolute;left:271px;top:185px;width:2px;height:24px;background:#f00020"></i><i style="position:absolute;left:332px;top:171px;width:16px;height:2px;background:#0038ff"></i>';
    backdrop.append(marker);
  });
  async function markerCentroids(png) {
    return page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      function center(channel, x0, y0, x1, y1, axis) {
        let sum = 0,
          weighted = 0;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const i = (y * canvas.width + x) * 4;
            const weight = Math.max(
              0,
              data[i + channel] -
                Math.max(data[i + ((channel + 1) % 3)], data[i + ((channel + 2) % 3)])
            );
            sum += weight;
            weighted += weight * ((axis === 'x' ? x : y) + 0.5);
          }
        return { center: sum > 0 ? weighted / sum : null, mass: sum };
      }
      return { x: center(0, 224, 126, 244, 138, 'x'), y: center(2, 296, 99, 304, 114, 'y') };
    }, png);
  }
  report.axisMarkers = {};
  for (const scale of [0, 40, -40]) {
    await page.evaluate(
      (value) => document.querySelector('#lens-displacement').setAttribute('scale', String(value)),
      scale
    );
    report.axisMarkers[scale] = await markerCentroids(await capture(`axis-scale-${scale}`));
  }
  for (const axis of ['x', 'y']) {
    const zero = report.axisMarkers[0][axis],
      plus = report.axisMarkers[40][axis],
      minus = report.axisMarkers[-40][axis];
    for (const value of [zero, plus, minus])
      assert(value.center !== null && Number.isFinite(value.center) && value.mass > 1000);
    assert(
      plus.center - zero.center > 0.4 && plus.center - zero.center < 4,
      `${axis}: positive scale must move the observed near-rim marker inward`
    );
    assert(
      minus.center - zero.center < -0.4 && minus.center - zero.center > -4,
      `${axis}: negative scale must reverse observed movement`
    );
  }
  await page.evaluate(() => {
    document.querySelector('#axis-markers').remove();
    document.querySelector('#backdrop').removeAttribute('data-calibration');
    document.querySelector('#backdrop').style.background = '';
    document.querySelector('#lens-displacement').setAttribute('scale', '40');
  });
  // Same real backdrop and geometry: disable each branch independently.
  report.branchControls = {};
  await page.evaluate(() => window.liquidExperiment.set({ morph: 1 }));
  const regularMenu = await capture('regular-layered-menu');
  // Constant actual DOM background isolates the reported nested tint contour.
  await page.evaluate(() => (document.querySelector('#backdrop').style.background = '#7acfb8'));
  await capture('uniform-body-integration');
  await page.evaluate(() => window.liquidExperiment.set({ bodyIntegration: false }));
  await capture('negative-body-integration');
  await page.evaluate(() => {
    document.querySelector('#backdrop').style.background = '';
    window.liquidExperiment.set({ bodyIntegration: true });
  });
  for (const key of ['sharpRim', 'bodyScatter']) {
    await page.evaluate((key) => window.liquidExperiment.set({ [key]: false }), key);
    const negative = await capture(`negative-${key}`);
    report.branchControls[key] = await changedPixels(regularMenu, negative);
    assert(report.branchControls[key] > 100, `${key} must contribute at the same geometry`);
    await page.evaluate((key) => window.liquidExperiment.set({ [key]: true }), key);
  }
  await page.evaluate(() =>
    window.liquidExperiment.set({ morph: 0, press: 1, anchorX: 250, anchorY: 132 })
  );
  const thickness = await capture('optical-press-enabled');
  await page.evaluate(() => window.liquidExperiment.set({ opticalPress: false }));
  report.branchControls.opticalPress = await changedPixels(
    thickness,
    await capture('negative-optical-press')
  );
  assert(
    report.branchControls.opticalPress > 100,
    'press must affect optical response without changing its silhouette'
  );
  await page.evaluate(() => window.liquidExperiment.set({ press: 0, opticalPress: true }));
  await page.getByRole('button', { name: 'Move light', exact: true }).click();
  const otherLight = await capture('light-direction-changed');
  report.lightChangedPixels = await changedPixels(rest, otherLight);
  assert(report.lightChangedPixels > 100, 'highlight must react to the light direction');
  await page.getByRole('button', { name: 'Move light', exact: true }).click();
  const trigger = await page
    .getByRole('button', { name: 'Press the refractive surface', exact: true })
    .boundingBox();
  await page.mouse.move(trigger.x + trigger.width * 0.35, trigger.y + trigger.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.liquidExperiment.state.press === 1);
  await capture('pressed-shape');
  await page.mouse.up();
  await page.waitForFunction(() => window.liquidExperiment.state.press === 0);
  await capture('released-shape');
  await page.getByRole('button', { name: 'Fusion example', exact: true }).click();
  await page.getByRole('button', { name: 'Join / separate', exact: true }).click();
  for (const progress of [0.15, 0.35, 0.55, 0.75, 0.95]) {
    await page.waitForFunction((p) => window.liquidExperiment.state.merge >= p, progress);
    await capture(`fusion-${progress}`);
  }
  await page.waitForFunction(() => document.body.dataset.animating === 'false');
  await capture('joined-shape');
  await page.getByRole('button', { name: 'Join / separate', exact: true }).click();
  await page.waitForFunction(() => window.liquidExperiment.state.merge === 0);
  await capture('separated-shape');
  await page.getByRole('button', { name: 'Button/menu example', exact: true }).click();
  const menuIdentity = await page.locator('#lens').getAttribute('data-effect-id');
  await page.getByRole('button', { name: 'Button / menu', exact: true }).click();
  for (const progress of [0.15, 0.35, 0.55, 0.75, 0.95]) {
    await page.waitForFunction((p) => window.liquidExperiment.state.morph >= p, progress);
    await capture(`menu-${progress}`);
  }
  await page.waitForFunction(() => document.body.dataset.animating === 'false');
  await capture('expanded-menu');
  assert.equal(await page.locator('#lens').getAttribute('data-effect-id'), menuIdentity);
  await page.getByRole('button', { name: 'Button / menu', exact: true }).click();
  await page.waitForFunction(() => window.liquidExperiment.state.morph === 0);
  await capture('collapsed-menu');
  await page.getByRole('button', { name: 'Move real background', exact: true }).click();
  await capture('live-background-update');
  // Real early reverse and cancellation, from the current surface rather than recipe rest.
  await page.getByRole('button', { name: 'Button/menu example', exact: true }).click();
  await page.getByRole('button', { name: 'Button / menu', exact: true }).click();
  await page.waitForFunction(() => window.liquidExperiment.state.morph > 0.15);
  await page.getByRole('button', { name: 'Button / menu', exact: true }).click();
  await page.waitForFunction(() => window.liquidExperiment.state.morph === 0);
  await capture('early-reverse-settled');
  await page.getByRole('button', { name: 'Button / menu', exact: true }).click();
  await page.waitForFunction(() => window.liquidExperiment.state.morph > 0.2);
  await page.getByRole('button', { name: 'Cancel motion', exact: true }).click();
  const frozen = await page.evaluate(() => ({
    morph: window.liquidExperiment.state.morph,
    frame: window.liquidExperiment.frame,
  }));
  await frame();
  assert.deepEqual(
    await page.evaluate(() => ({
      morph: window.liquidExperiment.state.morph,
      frame: window.liquidExperiment.frame,
    })),
    frozen
  );
  report.cancelledState = frozen;
  await capture('cancelled-current-surface');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await page.waitForFunction(() => document.body.dataset.reducedMotion === 'true');
  await page.getByRole('button', { name: 'Button/menu example', exact: true }).click();
  const beforeReduced = await page.evaluate(() => window.liquidExperiment.renderStates.length);
  await page.mouse.move(trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
  await page.mouse.down();
  await capture('reduced-motion-static-feedback');
  await page.mouse.up();
  await frame();
  const reduced = await page.evaluate(
    (start) => window.liquidExperiment.renderStates.slice(start),
    beforeReduced
  );
  assert(reduced.some((x) => x.state.energy === 1));
  assert(reduced.every((x) => x.state.press === 0));
  report.reducedMotion = reduced;
  assert.deepEqual(report.errors, []);
  report.samples = await page.evaluate(() => window.liquidExperiment.samples);
  assert(report.samples.length >= 30);
  report.status = 'experimental-scene-observed';
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await writeFile(path.join(evidence, 'liquid-observations.json'), JSON.stringify(report, null, 2));
  await context?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
