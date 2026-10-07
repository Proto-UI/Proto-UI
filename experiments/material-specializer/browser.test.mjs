import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const root = resolve(process.argv[2] || '/tmp/pui-material-browser');
const evidence = resolve(process.argv[3] || '/tmp/pui-material-evidence');
await mkdir(evidence, { recursive: true });
const server = createServer(async (req, res) => {
  const name =
    new URL(req.url, 'http://localhost').pathname === '/'
      ? 'index.html'
      : basename(new URL(req.url, 'http://localhost').pathname);
  if (!['index.html', 'tokens.css', 'app.js'].includes(name)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(resolve(root, name));
    res.setHeader(
      'Content-Type',
      { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[extname(name)]
    );
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, page;
const observations = [];
const errors = [];
let externalRequests = 0;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 900, height: 720 },
    deviceScaleFactor: 1,
  });
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      externalRequests++;
      return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(origin);
  await page.waitForFunction(() => window.ready === true);
  const state = () => page.evaluate(() => window.probe.state());
  const capture = async (name) => {
    observations.push({ name, ...(await state()) });
    await page.screenshot({ path: resolve(evidence, `${name}.png`) });
  };
  await page.waitForFunction(
    () => window.probe.state().quality === 'experimental-owned-texture',
    null,
    { timeout: 10000 }
  );
  assert.equal((await state()).phase, 'rest');
  const selectionStyle = await page.evaluate(() => {
    const host = document.querySelector('#glass');
    document.documentElement.style.setProperty('--pui-primary', 'rgb(12, 100, 180)');
    document.documentElement.style.setProperty('--pui-primary-foreground', 'rgb(255, 255, 255)');
    const selection = getComputedStyle(host, '::selection');
    return {
      tokens: host.getAttribute('data-pui-style'),
      background: selection.backgroundColor,
      color: selection.color,
    };
  });
  assert.ok(selectionStyle.tokens.includes('selection:bg-primary'));
  assert.ok(selectionStyle.tokens.includes('selection:text-primary-foreground'));
  assert.equal(selectionStyle.background, 'rgb(12, 100, 180)');
  assert.equal(selectionStyle.color, 'rgb(255, 255, 255)');
  await page.evaluate(() => {
    const host = document.querySelector('#glass');
    host.style.userSelect = 'text';
    const range = document.createRange();
    range.selectNodeContents(host);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  assert.ok(await page.evaluate(() => window.getSelection().toString().includes('Continue')));
  await capture('00-selection-pseudo-surface');
  await page.evaluate(() => {
    window.getSelection().removeAllRanges();
    document.querySelector('#glass').style.userSelect = '';
  });

  const beforeCloning = (await state()).preparationCount;
  await page.evaluate(() => window.probe.clonedSnapshots(true));
  assert.equal((await state()).quality, 'experimental-owned-texture');
  assert.equal(
    (await state()).preparationCount,
    beforeCloning,
    'fresh object snapshots reuse an immutable generation'
  );
  const initialPixels = await page.evaluate(() => window.probe.pixels());
  assert(initialPixels?.startsWith('data:image/png'));
  await capture('01-rest');
  const preparedAtRest = (await state()).preparationCount;
  const bounds = await page.locator('#glass').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  assert.equal((await state()).pressed, true);
  assert.equal((await state()).phase, 'pressed');
  const pressedPixels = await page.evaluate(() => window.probe.pixels());
  assert.notEqual(
    pressedPixels,
    initialPixels,
    'actual shader output must change with Base pressed state'
  );
  await capture('02-pointer-pressed');
  assert.equal(
    (await state()).preparationCount,
    preparedAtRest,
    'press reuses owned-source preparation'
  );
  await page.mouse.up();
  assert.equal((await state()).pressed, false);
  assert.equal((await state()).clicks, 1);
  await page.mouse.move(10, 10);
  await page.locator('#glass').focus();
  await page.keyboard.press('Space');
  assert.equal((await state()).clicks, 2);
  assert.equal((await state()).focused, true);
  await capture('03-keyboard-activation');
  await page.evaluate(() => window.probe.disabled(true));
  await page.locator('#glass').click({ force: true });
  assert.equal((await state()).disabled, true);
  assert.equal((await state()).clicks, 2);
  await capture('04-disabled');
  await page.evaluate(() => window.probe.disabled(false));
  await page.evaluate(() => window.probe.safe(false));
  assert.equal((await state()).quality, 'opaque-fallback');
  assert.equal((await state()).reason, 'unsafe-or-unknown-preference');
  await capture('05-preference-fallback');
  await page.evaluate(() => window.probe.safe(true));
  assert.equal((await state()).quality, 'experimental-owned-texture');
  await page.evaluate(() => window.probe.source(false));
  assert.equal((await state()).quality, 'opaque-fallback');
  assert.equal(
    await page.evaluate(() => window.probe.pixels()),
    'data:,',
    'source lease loss clears the retained drawing buffer'
  );
  await capture('06-source-loss');
  await page.evaluate(() => window.probe.source(true));
  assert.equal((await state()).quality, 'experimental-owned-texture');
  await page.evaluate(() => window.probe.invalidSource());
  assert.equal((await state()).reason, 'invalid-owned-source');
  assert.equal(
    await page.evaluate(() => window.probe.pixels()),
    'data:,',
    'invalid replacement clears the superseded source'
  );
  await capture('10-invalid-source-cleared');
  await page.evaluate(() => window.probe.source(true));
  const beforeMove = await state();
  const beforeMovePixels = await page.evaluate(() => window.probe.pixels());
  await page.evaluate(() => window.probe.move(41, 17));
  await page.waitForFunction(
    (frame) => window.probe.state().materialFrame > frame,
    beforeMove.materialFrame
  );
  assert.equal(
    (await state()).sourceGeneration,
    beforeMove.sourceGeneration,
    'movement does not forge a new source revision'
  );
  assert.notEqual(
    await page.evaluate(() => window.probe.pixels()),
    beforeMovePixels,
    'moving bounds resample the unchanged scene'
  );
  await capture('09-position-only-resampling');
  const movedFrame = (await state()).materialFrame;
  await page.evaluate(() => window.probe.move(0, 0));
  await page.waitForFunction((frame) => window.probe.state().materialFrame > frame, movedFrame);
  await page.evaluate(() => {
    document.querySelector('#glass').style.transform = 'translateX(8px)';
  });
  await page.waitForFunction(() => window.probe.state().reason === 'geometry-unavailable');
  await page.evaluate(() => {
    document.querySelector('#glass').style.transform = 'none';
  });
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  await page.evaluate(() => {
    document.querySelector('#glass').style.borderRadius = '50%';
  });
  await page.waitForFunction(() => window.probe.state().reason === 'geometry-unavailable');
  await page.evaluate(() => {
    document.querySelector('#glass').style.borderRadius = '8px';
  });
  await page.waitForFunction(
    () =>
      window.probe.state().quality === 'experimental-owned-texture' &&
      window.probe.state().radius === '8'
  );
  await page.evaluate(() => {
    document.querySelector('#glass').style.borderRadius = '';
  });
  await page.waitForFunction(
    () =>
      window.probe.state().quality === 'experimental-owned-texture' &&
      window.probe.state().radius === '24'
  );
  await capture('11-geometry-restored');
  await page.evaluate(() => {
    document.querySelector('#glass').style.background = '#101010';
    document.documentElement.style.setProperty('--pui-foreground', 'rgb(255,255,255)');
  });
  await page.waitForFunction(() => window.probe.state().quality === 'unavailable');
  assert.equal(
    await page.evaluate(() => window.probe.pixels()),
    'data:,',
    'theme contrast change withdraws stale enhanced pixels'
  );
  await page.evaluate(() => {
    document.querySelector('#glass').style.background = '';
    document.documentElement.style.setProperty('--pui-foreground', 'rgb(0,0,0)');
  });
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  await page.evaluate(() => {
    document.querySelector('#glass').style.opacity = 'var(--test-opacity, 1)';
    document.documentElement.style.setProperty('--test-opacity', '0.5');
  });
  await page.waitForFunction(() => window.probe.state().quality === 'unavailable');
  await page.evaluate(() => document.documentElement.style.setProperty('--test-opacity', '1'));
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  await capture('12-theme-contrast-restored');
  await page.evaluate(() => {
    document.querySelector('#scene').style.opacity = '0.2';
  });
  await page.waitForFunction(() => window.probe.state().quality === 'unavailable');
  assert.equal(
    await page.evaluate(() => window.probe.pixels()),
    'data:,',
    'ancestor opacity withdraws retained enhanced pixels'
  );
  await capture('12a-ancestor-opacity-unavailable');
  await page.evaluate(() => {
    document.querySelector('#scene').style.opacity = '1';
  });
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  for (const transform of ['rotate(8deg)', 'skewX(12deg)']) {
    await page.evaluate((value) => {
      document.querySelector('#scene').style.transform = value;
    }, transform);
    await page.waitForFunction(() => window.probe.state().reason === 'geometry-unavailable');
    assert.equal(
      await page.evaluate(() => document.querySelector('#glass canvas')?.style.display),
      'none'
    );
    await capture(
      transform.startsWith('rotate')
        ? '12b-ancestor-rotation-fallback'
        : '12c-ancestor-skew-fallback'
    );
    await page.evaluate(() => {
      document.querySelector('#scene').style.transform = 'none';
    });
    await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  }
  await capture('12d-ancestor-context-restored');
  for (const filter of ['opacity(0.2)', 'brightness(0.2)']) {
    await page.evaluate((value) => {
      document.querySelector('#scene').style.filter = value;
    }, filter);
    await page.waitForFunction(() => window.probe.state().quality === 'unavailable');
    assert.equal(
      await page.evaluate(() => window.probe.pixels()),
      'data:,',
      'ancestor filtering withdraws retained enhanced pixels'
    );
    await capture(
      filter.startsWith('opacity')
        ? '12e-ancestor-filter-opacity'
        : '12f-ancestor-filter-brightness'
    );
    await page.evaluate(() => {
      document.querySelector('#scene').style.filter = 'none';
    });
    await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  }
  await capture('12g-ancestor-filter-restored');
  await page.evaluate(() => {
    window.savedBlendBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'rgb(128, 128, 128)';
    document.querySelector('#scene').style.mixBlendMode = 'difference';
  });
  await page.waitForFunction(() => window.probe.state().quality === 'unavailable');
  assert.equal(
    await page.evaluate(() => window.probe.pixels()),
    'data:,',
    'ancestor blending withdraws retained enhanced pixels'
  );
  await capture('12h-ancestor-blend-unavailable');
  await page.evaluate(() => {
    document.querySelector('#scene').style.mixBlendMode = 'normal';
    document.body.style.backgroundColor = window.savedBlendBackground;
  });
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  await capture('12i-ancestor-blend-restored');
  const borderGeometry = () =>
    page.evaluate(() => {
      const host = document.querySelector('#glass');
      const canvas = host.querySelector('canvas');
      const box = canvas.getBoundingClientRect();
      const scene = document.querySelector('#scene').getBoundingClientRect();
      const gl = canvas.getContext('webgl');
      const pipeline = gl.getParameter(gl.CURRENT_PROGRAM);
      const bounds = Array.from(
        gl.getUniform(pipeline, gl.getUniformLocation(pipeline, 'u_bounds'))
      );
      return {
        width: box.width,
        height: box.height,
        backing: [canvas.width, canvas.height],
        dpr: devicePixelRatio,
        radius: Number(host.dataset.materialRadius),
        bounds,
        expectedBounds: [
          (box.left - scene.left) / 800,
          (box.top - scene.top) / 480,
          box.width / 800,
          box.height / 480,
        ],
        borderColor: getComputedStyle(host).borderTopColor,
      };
    });
  const assertBorderGeometry = async (width, height, radius) => {
    const geometry = await borderGeometry();
    assert.equal(geometry.width, width);
    assert.equal(geometry.height, height);
    assert.deepEqual(geometry.backing, [
      Math.ceil(width * geometry.dpr),
      Math.ceil(height * geometry.dpr),
    ]);
    assert.equal(geometry.radius, radius);
    geometry.bounds.forEach((value, index) =>
      assert.ok(Math.abs(value - geometry.expectedBounds[index]) < 1e-5)
    );
    assert.equal(geometry.borderColor, 'rgb(40, 80, 120)');
  };
  await page.evaluate(() => {
    const host = document.querySelector('#glass');
    window.savedBorderStyle = host.getAttribute('style');
    Object.assign(host.style, {
      boxSizing: 'border-box',
      width: '200px',
      height: '80px',
      padding: '17px',
      border: '2px solid rgb(40, 80, 120)',
      borderRadius: '20px',
    });
  });
  await page.waitForFunction(
    () =>
      window.probe.state().quality === 'experimental-owned-texture' &&
      window.probe.state().radius === '18'
  );
  await assertBorderGeometry(196, 76, 18);
  await capture('12j-uniform-border-padding-frame');
  const borderGeneration = (await state()).sourceGeneration;
  await page.evaluate(() => {
    document.querySelector('#glass').style.borderWidth = '4px';
  });
  await page.waitForFunction(
    () =>
      window.probe.state().quality === 'experimental-owned-texture' &&
      window.probe.state().radius === '16'
  );
  assert.equal((await state()).sourceGeneration, borderGeneration);
  await assertBorderGeometry(192, 72, 16);
  await capture('12k-border-only-invalidation');
  await page.evaluate(() => {
    Object.assign(document.querySelector('#glass').style, {
      borderWidth: '1px 3px 5px 7px',
      borderRadius: '0px',
    });
  });
  await page.waitForFunction(
    () =>
      window.probe.state().quality === 'experimental-owned-texture' &&
      window.probe.state().radius === '0'
  );
  await assertBorderGeometry(190, 74, 0);
  await capture('12l-asymmetric-square-border');
  await page.evaluate(() => {
    document.querySelector('#glass').style.borderRadius = '20px';
  });
  await page.waitForFunction(() => window.probe.state().reason === 'geometry-unavailable');
  await capture('12m-incompatible-inner-corners');
  await page.evaluate(() => {
    const host = document.querySelector('#glass');
    if (window.savedBorderStyle === null) host.removeAttribute('style');
    else host.setAttribute('style', window.savedBorderStyle);
  });
  await page.waitForFunction(
    () =>
      window.probe.state().quality === 'experimental-owned-texture' &&
      window.probe.state().radius === '24'
  );
  await capture('12n-border-context-restored');

  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.style.width = '900px';
    iframe.style.height = '720px';
    document.body.append(iframe);
    const target = iframe.contentWindow;
    Object.defineProperty(target, 'devicePixelRatio', { value: 2 });
    const copiedStyle = target.document.createElement('style');
    copiedStyle.textContent = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
      .join('\n');
    target.document.head.append(copiedStyle);
    window.adoptedScene = document.querySelector('#scene');
    window.adoptionFrame = iframe;
    target.document.body.append(target.document.adoptNode(window.adoptedScene));
  });
  await page.waitForFunction(() => {
    const host = window.adoptedScene.querySelector('#glass');
    const canvas = host.querySelector('canvas');
    return (
      host.dataset.materialQuality === 'experimental-owned-texture' &&
      canvas.width === Math.ceil(host.getBoundingClientRect().width * 2)
    );
  });
  await page.evaluate(() => {
    document.body.insertBefore(
      document.adoptNode(window.adoptedScene),
      document.querySelector('footer')
    );
    window.adoptionFrame.remove();
  });
  await page.waitForFunction(() => {
    const host = document.querySelector('#glass');
    return (
      host.dataset.materialQuality === 'experimental-owned-texture' &&
      host.querySelector('canvas').width ===
        Math.ceil(host.getBoundingClientRect().width * devicePixelRatio)
    );
  });
  await page.evaluate(() => {
    const canvas = document.querySelector('#glass canvas');
    const gl = canvas.getContext('webgl');
    window.loss = gl.getExtension('WEBGL_lose_context');
    window.loss.loseContext();
  });
  await page.waitForFunction(() => window.probe.state().reason === 'context-lost');
  await capture('07-context-loss');
  await page.evaluate(() => window.loss.restoreContext());
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  await page.evaluate(() => {
    window.retiredCanvas = document.querySelector('#glass canvas');
    window.probe.remove();
  });
  await page.waitForTimeout(30);
  assert.equal(
    await page.evaluate(() => window.retiredCanvas.toDataURL()),
    'data:,',
    'terminal release clears pixels even through a retained canvas reference'
  );
  // Destroyed owner must unsubscribe from all source and preference callbacks.
  await page.evaluate(() => window.probe.remount());
  await page.waitForFunction(() => window.probe.state().quality === 'experimental-owned-texture');
  assert.equal((await state()).sourceListeners, 1);
  assert.equal((await state()).preferenceListeners, 1);
  await capture('08-remounted');
  // Compare the unchanged source-157 control and current internally compiled
  // regular profile on exactly the same owned scenes and Prototype geometry.
  const control = await context.newPage();
  control.on('pageerror', (error) => errors.push(String(error)));
  await control.goto(`${origin}/?profile=source-157-control`);
  await control.waitForFunction(() => window.ready === true);
  const framePixels = (target) =>
    target.evaluate(() => {
      const c = document.querySelector('#glass canvas');
      const gl = c.getContext('webgl');
      const data = new Uint8Array(c.width * c.height * 4);
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return { width: c.width, height: c.height, data: Array.from(data) };
    });
  const variation = ({ width, height, data }) => {
    let sum = 0,
      count = 0;
    for (let y = Math.ceil(height * 0.25); y < height * 0.75; y++)
      for (let x = Math.ceil(width * 0.25); x < width * 0.75 - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) sum += Math.abs(data[i + c] - data[i + 4 + c]);
        count += 3;
      }
    return sum / count;
  };
  const delta = (a, b) => {
    assert.equal(a.width, b.width);
    assert.equal(a.height, b.height);
    let changed = 0,
      count = 0,
      total = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if (a.data[i + 3] < 250 || b.data[i + 3] < 250) continue;
      const d = Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - b.data[i + c])));
      if (d > 4) changed++;
      total += d;
      count++;
    }
    return { changedRatio: changed / count, meanMaxChannelDelta: total / count };
  };
  const visualComparisons = [];
  for (const scene of ['checker', 'text', 'solid', 'light', 'dark']) {
    await page.evaluate((kind) => window.probe.scene(kind), scene);
    await control.evaluate((kind) => window.probe.scene(kind), scene);
    const candidate = await state();
    const baseline = await control.evaluate(() => window.probe.state());
    await page.screenshot({ path: resolve(evidence, `visual-${scene}-rest.png`) });
    await control.screenshot({ path: resolve(evidence, `control-157-${scene}.png`) });
    if (scene === 'dark') {
      assert.equal(candidate.quality, 'opaque-fallback');
      assert.equal(candidate.reason, 'rendered-contrast-unsafe');
      visualComparisons.push({
        scene,
        candidate,
        baseline,
        scope: 'explicit readable degradation',
      });
      continue;
    }
    assert.equal(candidate.quality, 'experimental-owned-texture', scene);
    assert.equal(baseline.quality, 'experimental-owned-texture', scene);
    const before = await framePixels(control),
      after = await framePixels(page);
    const comparison = {
      scene,
      candidate,
      baseline,
      delta: delta(before, after),
      baselineVariation: variation(before),
      candidateVariation: variation(after),
    };
    await writeFile(
      resolve(evidence, `comparison-${scene}.json`),
      JSON.stringify(comparison, null, 2)
    );
    if (scene === 'text') {
      assert(
        comparison.candidateVariation < comparison.baselineVariation * 0.85,
        'regular material must reduce owned background text high-frequency competition'
      );
    }
    if (scene === 'solid')
      assert(
        comparison.delta.meanMaxChannelDelta > 3,
        'regular material must visibly differ from a plain uniform source'
      );
    if (scene === 'checker' || scene === 'text') {
      const r = await page.locator('#glass').boundingBox();
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await page.mouse.down();
      assert.equal((await state()).pressed, true);
      const pressed = await framePixels(page);
      comparison.pressDelta = delta(after, pressed);
      await writeFile(
        resolve(evidence, `comparison-${scene}.json`),
        JSON.stringify(comparison, null, 2)
      );
      assert(
        comparison.pressDelta.changedRatio > 0.15,
        'Base press must change more than a thin fringe of actual material pixels'
      );
      await page.screenshot({ path: resolve(evidence, `visual-${scene}-pressed.png`) });
      await page.mouse.up();
      assert.equal((await state()).pressed, false);
    }
    visualComparisons.push(comparison);
  }
  await page.evaluate(() => window.probe.scene('checker'));
  const preparationsBeforeFailure = (await state()).preparationCount;
  for (const mode of ['throw', 'short', 'transparent']) {
    await page.evaluate((mode) => window.probe.preparation(mode), mode);
    assert.equal((await state()).quality, 'opaque-fallback');
    await capture(`preparation-${mode}-fallback`);
    await page.evaluate(() => window.probe.preparation('normal'));
    assert.equal((await state()).quality, 'experimental-owned-texture');
  }
  assert((await state()).preparationCount >= preparationsBeforeFailure + 6);
  await control.close();
  await writeFile(
    resolve(evidence, 'visual-comparisons.json'),
    JSON.stringify(
      {
        source: JSON.parse(await readFile(resolve(root, 'source.json'), 'utf8')),
        control: 'source-157-control, same current fixture and original kernel',
        acceptance: 'measured optical/readability controls, visual acceptance still required',
        comparisons: visualComparisons,
      },
      null,
      2
    )
  );
  for (const view of ['shadow', 'nested']) {
    const surfacePage = await context.newPage();
    surfacePage.on('pageerror', (error) => errors.push(String(error)));
    await surfacePage.goto(`${origin}/?view=${view}`);
    await surfacePage.waitForFunction(
      () => window.probe?.state().quality === 'experimental-owned-texture'
    );
    const before = await surfacePage.evaluate(() => window.probe.state());
    assert.equal(before.canvasDirect, true, `${view}: canvas belongs to the adapter root`);
    assert.equal(before.surfaceRoot, view === 'shadow' ? 'shadow' : 'light');
    const rest = await surfacePage.evaluate(() => window.probe.pixels());
    await surfacePage.screenshot({ path: resolve(evidence, `surface-${view}-rest.png`) });
    await surfacePage.evaluate(() => window.probe.update());
    await surfacePage.waitForTimeout(30);
    assert.equal((await surfacePage.evaluate(() => window.probe.state())).canvasDirect, true);
    const target = surfacePage.locator('#glass');
    const rect = await target.boundingBox();
    await surfacePage.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await surfacePage.mouse.down();
    const pressed = await surfacePage.evaluate(() => window.probe.state());
    assert.equal(pressed.pressed, true);
    assert.equal(pressed.phase, 'pressed');
    assert.notEqual(await surfacePage.evaluate(() => window.probe.pixels()), rest);
    await surfacePage.screenshot({ path: resolve(evidence, `surface-${view}-pressed.png`) });
    await surfacePage.mouse.up();
    await target.focus();
    await surfacePage.keyboard.press('Space');
    assert.equal((await surfacePage.evaluate(() => window.probe.state())).clicks, 2);
    observations.push({
      name: `surface-${view}-input-and-recommit`,
      ...(await surfacePage.evaluate(() => window.probe.state())),
    });
    await surfacePage.evaluate(() => window.probe.remove());
    await surfacePage.waitForTimeout(30);
    const released = await surfacePage.evaluate(() => window.probe.listeners());
    assert.equal(released.sourceListeners, 0);
    assert.equal(released.preferenceListeners, 0);
    await surfacePage.close();
  }
  assert.deepEqual(errors, []);
  assert.equal(externalRequests, 0);
  await writeFile(
    resolve(evidence, 'result.json'),
    JSON.stringify(
      {
        status: 'passed',
        source: JSON.parse(await readFile(resolve(root, 'source.json'), 'utf8')),
        externalRequests,
        errors,
        observations,
      },
      null,
      2
    )
  );
} catch (error) {
  if (page) {
    try {
      await page.screenshot({ path: resolve(evidence, 'failure.png') });
      observations.push({ name: 'failure', ...(await page.evaluate(() => window.probe?.state())) });
    } catch {}
  }
  await writeFile(
    resolve(evidence, 'result.json'),
    JSON.stringify(
      { status: 'failed', error: String(error), externalRequests, errors, observations },
      null,
      2
    )
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
