import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join, extname, sep } from 'node:path';
import { launchBrowser } from '../../apps/www/src/content/docs/zh-cn/browser-harness.ts';
import { installCarrierStyleDiagnostics } from './carrier-diagnostics.mjs';
import {
  explicitCaptureEvidenceIssues,
  captureActivationEvidenceIssues,
} from './capture-evidence.ts';
const root = resolve(process.argv[2]),
  out = resolve(process.argv[3]);
await mkdir(out, { recursive: true });
await mkdir(join(out, 'recording'), { recursive: true });
const source = JSON.parse(await readFile(join(root, 'source.json'), 'utf8'));
const server = createServer(async (req, res) => {
  const file = resolve(
    root,
    '.' +
      (new URL(req.url, 'http://localhost').pathname === '/'
        ? '/index.html'
        : new URL(req.url, 'http://localhost').pathname)
  );
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      'content-type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ??
        'application/octet-stream'
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, context, page, failure;
const results = [];
const errors = [];
const recordingFrames = [];
const frameWrites = [];
let recording = false;
try {
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(installCarrierStyleDiagnostics);
  await context.route('**/*', (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort()
  );
  await context.addInitScript(() => {
    const originalDecode = HTMLImageElement.prototype.decode;
    window.__decode = { calls: 0, timings: [], delay: 0, fail: 0, hold: false, held: [] };
    HTMLImageElement.prototype.decode = function () {
      let t = performance.now();
      const delay = window.__decode.delay,
        hold = window.__decode.hold,
        source = this.src;
      window.__decode.calls++;
      return originalDecode.call(this).then(async (v) => {
        window.__decode.timings.push(performance.now() - t);
        if (hold)
          await new Promise((resolve) =>
            window.__decode.held.push({ source, resolve, nativeDecodedAt: performance.now() })
          );
        if (delay) await new Promise((r) => setTimeout(r, delay));
        return v;
      });
    };
    const originalContext = HTMLCanvasElement.prototype.getContext;
    window.__gpu = [];
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const result = originalContext.apply(this, args);
      if (args[0] === 'webgl' && result && !window.__gpu.includes(result))
        window.__gpu.push(result);
      return result;
    };
    window.__native = [];
    window.__captureCalls = [];
    const cap = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (id) {
      window.__captureCalls.push({ id, time: performance.now() });
      return cap.call(this, id);
    };
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'gotpointercapture',
      'lostpointercapture',
      'blur',
      'click',
    ])
      addEventListener(
        type,
        (e) =>
          window.__native.push({
            type,
            trust: e.isTrusted,
            custom: e instanceof CustomEvent,
            detail: typeof e.detail === 'number' ? e.detail : undefined,
            windowTarget: e.target === window,
            pointerId: e.pointerId,
            pointerType: e.pointerType,
            runtime:
              e.target instanceof Element
                ? e.target.closest('[data-runtime]')?.dataset.runtime
                : undefined,
            control:
              e.target instanceof Element
                ? e.target.closest('[data-demo-ref]')?.dataset.demoRef
                : undefined,
            x: e.clientX,
            y: e.clientY,
            time: performance.now(),
          }),
        true
      );
  });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await context.newCDPSession(page);
  await mkdir(join(out, 'recording'), { recursive: true });
  cdp.on('Page.screencastFrame', (event) => {
    const index = recordingFrames.length;
    if (recording) {
      recordingFrames.push({ index, timestamp: event.metadata.timestamp });
      frameWrites.push(
        writeFile(
          join(out, 'recording', `${String(index).padStart(5, '0')}.jpg`),
          Buffer.from(event.data, 'base64')
        )
      );
    }
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });

  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'no-preference' },
      { name: 'prefers-reduced-transparency', value: 'no-preference' },
      { name: 'prefers-contrast', value: 'no-preference' },
      { name: 'forced-colors', value: 'none' },
    ],
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.documentElement.dataset.ready || document.documentElement.dataset.error
  );
  assert.equal(await page.locator('html').getAttribute('data-error'), null);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-demo-ref="regular"]')].every(
      (e) => e.dataset.materialQuality === 'self-optical'
    )
  );
  await page.evaluate(() => {
    window.__frames = [];
    window.__contacts = [];
    window.__record = true;
    window.__paints = [];
    window.__paintIds = new Map();
    for (const e of document.querySelectorAll('[data-demo-ref="regular"]'))
      window.v2Material.observeContact(e, (c) =>
        window.__contacts.push({
          runtime: e.closest('[data-runtime]').dataset.runtime,
          ...c,
          t: performance.now(),
        })
      );
    function paintId(value) {
      if (!window.__paintIds.has(value)) {
        window.__paintIds.set(value, window.__paints.length);
        window.__paints.push(value);
      }
      return window.__paintIds.get(value);
    }
    function tick(t) {
      if (window.__record) {
        window.__frames.push({
          t,
          metrics: window.v2Material.metrics(),
          controls: [...document.querySelectorAll('[data-demo-ref="regular"]')].map((e) => {
            const hostCss = getComputedStyle(e),
              carrierCss = getComputedStyle(e, '::before');
            return {
              runtime: e.closest('[data-runtime]').dataset.runtime,
              data: { ...e.dataset },
              rect: e.getBoundingClientRect().toJSON(),
              background: paintId(hostCss.backgroundImage),
              hostBackground: hostCss.backgroundImage,
              hostBackgroundColor: hostCss.backgroundColor,
              hostVisibility: hostCss.visibility,
              carrier: paintId(carrierCss.backgroundImage),
              carrierHasImage: /^url\(["']?data:image\/png;base64,/.test(
                carrierCss.backgroundImage
              ),
              carrierContent: carrierCss.content,
              carrierDisplay: carrierCss.display,
              carrierVisibility: carrierCss.visibility,
              carrierOpacity: Number(carrierCss.opacity),
              carrierWidth: parseFloat(carrierCss.width),
              carrierHeight: parseFloat(carrierCss.height),
              outset: carrierCss.inset,
            };
          }),
        });
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
  const state = () =>
    page.evaluate(() => ({
      frames: window.__frames.length,
      metrics: window.v2Material.metrics(),
      decode: window.__decode.calls,
      counts: [...document.querySelectorAll('[data-count]')].map((e) => Number(e.textContent)),
    }));
  for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
    const el = page.locator(`[data-runtime="${runtime}"] [data-demo-ref="regular"]`),
      box = await el.boundingBox(),
      x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const count = () => page.locator(`[data-count="${runtime}"]`).textContent().then(Number);
    const initial = await count(),
      before = await state();
    assert.match(await el.getAttribute('data-material-profile'), /contact/);
    if (runtime === 'wc') {
      recording = true;
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 85,
        maxWidth: 1300,
        maxHeight: 900,
        everyNthFrame: 1,
      });
    }

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(130);
    assert.equal(await count(), initial, 'down never activates');
    await page.waitForFunction(
      (r) =>
        document.querySelector(`[data-runtime="${r}"] [data-demo-ref="regular"]`).dataset
          .materialContact === 'held',
      runtime
    );
    await page.screenshot({ path: join(out, `${runtime}-down.png`) });
    for (let i = 0; i < 15; i++) {
      await page.mouse.move(x + ((i - 7) * box.width) / 13, y + Math.sin(i / 3) * 9);
      await page.waitForTimeout(20);
    }
    await page.mouse.move(box.x + box.width + 24, y);
    await page.waitForTimeout(100);
    assert.equal(await count(), initial, 'held out never activates');
    assert.equal(
      await el.getAttribute('data-material-contact'),
      'held',
      'contact survives leaving hit area'
    );
    const latestContact = await page.evaluate(
      (r) => window.__contacts.filter((c) => c.runtime === r).at(-1),
      runtime
    );
    assert.equal(latestContact.active, true);
    assert.ok(latestContact.deltaX > 0, 'outside displacement follows router');

    await page.screenshot({ path: join(out, `${runtime}-outside.png`) });
    await page.mouse.move(x + box.width * 0.25, y);
    await page.waitForTimeout(90);
    await page.screenshot({ path: join(out, `${runtime}-return.png`) });
    assert.equal(await count(), initial, 'move in never activates');
    await page.mouse.up();
    await page.waitForTimeout(600);
    assert.equal(await count(), initial + 1, 'up inside activates exactly once');
    await page.screenshot({ path: join(out, `${runtime}-released.png`) });
    if (runtime === 'wc') {
      await cdp.send('Page.stopScreencast');
      recording = false;
    }
    assert.equal(await el.getAttribute('data-material-contact'), 'rest', 'release settles');
    const sample = await page.evaluate(
      ({ runtime, start }) =>
        window.__frames
          .slice(start)
          .map((f) => ({ ...f, controls: f.controls.filter((c) => c.runtime === runtime) })),
      { runtime, start: before.frames }
    );
    const paints = new Set(sample.flatMap((f) => f.controls.map((c) => c.carrier)));
    const liveRevisions = new Set(
      sample.map((f) => f.controls[0]?.data.materialSourceRevision).filter(Boolean)
    );
    assert.ok(
      liveRevisions.size >= 3,
      'the actual 120ms live backdrop must advance during mounted drag/release'
    );
    assert.ok(
      sample.every((f) => f.controls[0]?.data.materialQuality === 'self-optical'),
      'valid live source updates must not flash opaque fallback'
    );
    const missingActualPaint = sample.filter((f) => {
      const c = f.controls[0];
      return (
        !c?.carrierHasImage ||
        c.carrierContent !== '""' ||
        c.carrierDisplay !== 'block' ||
        c.carrierVisibility !== 'visible' ||
        c.carrierOpacity !== 1 ||
        !(c.carrierWidth > 0 && c.carrierHeight > 0) ||
        c.hostVisibility !== 'visible' ||
        c.hostBackground !== 'none' ||
        c.hostBackgroundColor !== 'rgba(0, 0, 0, 0)'
      );
    });
    assert.deepEqual(
      missingActualPaint,
      [],
      'every sampled frame, including new down, must retain actual visible carrier paint and a transparent host; a stale self-optical receipt is insufficient'
    );

    assert.ok(paints.size >= 5, 'continuous movement/release commits more than two paint states');
    assert.ok(
      sample.some((f) => f.controls[0]?.data.materialContact === 'release'),
      'release envelope is observed'
    );
    assert.ok(
      sample.every(
        (f) => f.controls[0]?.rect.width === box.width && f.controls[0]?.rect.height === box.height
      ),
      'paint must not change host hitbox'
    );
    const after = await state();
    results.push({
      runtime,
      flow: 'trusted native down/move/out/in/up with live source',
      liveSourceRevisions: [...liveRevisions],
      before,
      after,
    });
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(30);
    const oldSession = await el.getAttribute('data-material-contact-session');
    await page.mouse.down();
    await page.mouse.move(x + 5, y);
    await page.waitForTimeout(70);
    assert.notEqual(
      await el.getAttribute('data-material-contact-session'),
      oldSession,
      'repress interrupts old release with a new session'
    );
    assert.equal(await el.getAttribute('data-material-contact'), 'held');
    await page.mouse.up();
    await page.waitForTimeout(400);
    assert.equal(await count(), initial + 3, 'repress during release activates only on each up');
  }
  assert.equal(
    await page.evaluate(() => window.__captureCalls.length),
    0,
    'visual tracking never requests capture'
  );
  for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
    // Native pointer cancellation uses the browser touch protocol, not dispatchEvent.
    const wc = page.locator(`[data-runtime="${runtime}"] [data-demo-ref="regular"]`),
      b = await wc.boundingBox(),
      p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const cancelCount = Number(await page.locator(`[data-count="${runtime}"]`).textContent());
    const nativeStart = await page.evaluate(() => window.__native.length);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...p, radiusX: 1, radiusY: 1, force: 1, id: 0 }],
    });
    await page.waitForFunction(
      (r) =>
        document.querySelector(`[data-runtime="${r}"] [data-demo-ref="regular"]`).dataset
          .materialContact === 'held',
      runtime
    );
    const heldContact = await page.evaluate(
      (r) => window.__contacts.filter((c) => c.runtime === r).at(-1),
      runtime
    );
    assert.equal(
      heldContact.active,
      true,
      'touch must establish a live router session before cancellation'
    );
    const touchDown = await page.evaluate(
      (start) => window.__native.slice(start).find((e) => e.type === 'pointerdown' && e.trust),
      nativeStart
    );
    assert.ok(touchDown, 'a trusted native pointerdown must exist');
    assert.equal(touchDown.pointerType, 'touch');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForFunction(
      ({ start, id }) =>
        window.__native
          .slice(start)
          .some((e) => e.type === 'pointercancel' && e.trust && e.pointerId === id),
      { start: nativeStart, id: touchDown.pointerId }
    );
    await page.waitForFunction(
      (r) =>
        document.querySelector(`[data-runtime="${r}"] [data-demo-ref="regular"]`).dataset
          .materialContact === 'rest',
      runtime
    );
    const endedContact = await page.evaluate(
      (r) => window.__contacts.filter((c) => c.runtime === r).at(-1),
      runtime
    );
    assert.equal(endedContact.active, false);
    assert.equal(endedContact.session, heldContact.session);
    assert.ok(
      ['cancel', 'lostcapture'].includes(endedContact.reason),
      'the same contact is terminally cancelled'
    );
    assert.equal(await wc.getAttribute('data-material-quality'), 'self-optical');

    assert.equal(
      Number(await page.locator(`[data-count="${runtime}"]`).textContent()),
      cancelCount
    );
    results.push({
      runtime,
      flow: 'native CDP touchCancel',
      activation: false,
      trustedPointerId: touchDown.pointerId,
      heldContact,
      endedContact,
    });
    // Capture is explicitly requested by this fixture only to exercise genuine lostcapture.
    // Losing visual tracking does not veto a later valid native click.
    for (const release of ['inside', 'outside']) {
      const captureCount = Number(await page.locator(`[data-count="${runtime}"]`).textContent());
      const activationStart = await page.evaluate(() => window.v2Material.activations().length);
      const captureStart = await page.evaluate(() => window.__native.length);
      const captureContactStart = await page.evaluate(() => window.__contacts.length);
      await wc.evaluate((e) =>
        e.addEventListener(
          'pointerdown',
          function capture(ev) {
            e.setPointerCapture(ev.pointerId);
          },
          { once: true }
        )
      );
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      const captureDown = await page.evaluate(
        ({ start, runtime }) =>
          window.__native
            .slice(start)
            .find(
              (e) =>
                e.type === 'pointerdown' &&
                e.trust &&
                e.pointerType === 'mouse' &&
                e.runtime === runtime &&
                e.control === 'regular'
            ),
        { start: captureStart, runtime }
      );
      assert.ok(
        captureDown,
        'the capture fixture must begin with a trusted mouse down on its control'
      );
      // setPointerCapture only sets the pending override. A real pointer event
      // processes it; a timeout or hasPointerCapture cannot prove gotcapture.
      await page.mouse.move(p.x + 1, p.y);
      await page.waitForFunction(
        ({ start, runtime, id }) =>
          window.__native
            .slice(start)
            .some(
              (e) =>
                e.type === 'gotpointercapture' &&
                e.trust &&
                e.pointerId === id &&
                e.pointerType === 'mouse' &&
                e.runtime === runtime &&
                e.control === 'regular'
            ),
        { start: captureStart, runtime, id: captureDown.pointerId }
      );
      await page.waitForFunction(
        (r) =>
          document.querySelector(`[data-runtime="${r}"] [data-demo-ref="regular"]`).dataset
            .materialContact === 'held',
        runtime
      );
      const captureHeld = await page.evaluate(
        ({ start, runtime }) =>
          window.__contacts
            .slice(start)
            .filter((c) => c.runtime === runtime)
            .at(-1),
        { start: captureContactStart, runtime }
      );
      assert.equal(
        captureHeld?.active,
        true,
        'actual capture must retain the current held contact'
      );
      await page.screenshot({ path: join(out, `${runtime}-capture-${release}-held.png`) });
      const releaseStart = await page.evaluate(() => window.__native.length);
      await wc.evaluate((e, id) => e.releasePointerCapture(id), captureDown.pointerId);
      // Process the pending release before up, so up cannot supply an implicit
      // loss after activation and be mislabeled as the cancellation under test.
      await page.mouse.move(p.x + 2, p.y);
      await page.waitForFunction(
        ({ start, runtime, id }) =>
          window.__native
            .slice(start)
            .some(
              (e) =>
                e.type === 'lostpointercapture' &&
                e.trust &&
                e.pointerId === id &&
                e.pointerType === 'mouse' &&
                e.runtime === runtime &&
                e.control === 'regular'
            ),
        { start: releaseStart, runtime, id: captureDown.pointerId }
      );
      const captureEnded = await page.evaluate(
        ({ start, runtime }) =>
          window.__contacts
            .slice(start)
            .filter((c) => c.runtime === runtime)
            .at(-1),
        { start: captureContactStart, runtime }
      );
      assert.equal(captureEnded?.active, false);
      assert.equal(captureEnded?.session, captureHeld.session);
      assert.equal(captureEnded?.reason, 'lostcapture');
      if (release === 'outside') {
        assert.equal(
          await page.evaluate(() => !!document.elementFromPoint(5, 5)?.closest('[data-demo-ref]')),
          false,
          'outside negative control must release away from every demo control'
        );
        await page.mouse.move(5, 5);
      }
      await page.mouse.up();
      await page.waitForFunction(
        ({ runtime, session }) => {
          const e = document.querySelector(`[data-runtime="${runtime}"] [data-demo-ref="regular"]`);
          return (
            e.dataset.materialContact === 'rest' &&
            e.dataset.materialContactSession === String(session) &&
            e.dataset.materialQuality === 'self-optical'
          );
        },
        { runtime, session: captureHeld.session }
      );
      const captureNative = await page.evaluate(
        (start) => window.__native.slice(start),
        captureStart
      );
      assert.deepEqual(
        explicitCaptureEvidenceIssues(
          captureNative,
          runtime,
          captureDown.pointerId,
          captureHeld,
          captureEnded,
          release
        ),
        [],
        'explicit release must exercise a matching trusted down/got/lost/up and cancelled router session'
      );
      const captureActivations = await page.evaluate(
        (start) => window.v2Material.activations().slice(start),
        activationStart
      );
      assert.deepEqual(
        captureActivationEvidenceIssues(
          captureNative,
          captureActivations,
          runtime,
          captureDown.pointerId,
          release
        ),
        []
      );
      assert.equal(
        Number(await page.locator(`[data-count="${runtime}"]`).textContent()),
        release === 'inside' ? captureCount + 1 : captureCount,
        'inside release commits one native activation; outside release commits none'
      );
      const finalContact = await page.evaluate(
        (r) => window.__contacts.filter((c) => c.runtime === r).at(-1),
        runtime
      );
      assert.equal(finalContact.session, captureHeld.session);
      assert.equal(finalContact.active, false);
      assert.equal(
        finalContact.reason,
        'lostcapture',
        'native activation must not revive cancelled visual tracking'
      );
      assert.equal(await wc.getAttribute('data-material-contact'), 'rest');
      await page.screenshot({ path: join(out, `${runtime}-capture-${release}-cancelled.png`) });
      results.push({
        runtime,
        flow: 'native explicit fixture releasePointerCapture',
        release,
        activations: captureActivations,
        note: 'fixture, not product, requested capture',
        trustedPointerId: captureDown.pointerId,
        heldContact: captureHeld,
        endedContact: captureEnded,
        native: captureNative,
      });
    }
    // Blur observation is a real page focus change, asserted by native trace.
    const nativeBeforeBlur = await page.evaluate(() => window.__native.length);
    const beforeBlur = Number(await page.locator(`[data-count="${runtime}"]`).textContent());
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(40);
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await page.waitForTimeout(100);
    await page.mouse.up();
    await other.close();
    await page.bringToFront();
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(
        (start) =>
          window.__native.slice(start).some((e) => e.type === 'blur' && e.trust && e.windowTarget),
        nativeBeforeBlur
      ),
      true,
      'native window blur was observed'
    );
    assert.equal(await wc.getAttribute('data-material-contact'), 'rest');
    assert.equal(
      Number(await page.locator(`[data-count="${runtime}"]`).textContent()),
      beforeBlur,
      'blur must not activate'
    );
    results.push({ runtime, flow: 'focus second page', nativeBlur: true });
    // Preferences should immediately settle dynamic output.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    const reducedStart = await wc.evaluate((e) => getComputedStyle(e, '::before').backgroundImage);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 15, p.y + 4);
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(300);
    assert.equal(
      await wc.evaluate((e) => getComputedStyle(e, '::before').backgroundImage),
      reducedStart,
      'reduced motion keeps static paint'
    );
    assert.equal(await wc.getAttribute('data-material-motion'), 'static');
    assert.equal(await wc.getAttribute('data-material-contact'), 'rest');
    results.push({
      runtime,
      flow: 'reducedMotion',
      state: await state(),
      data: await wc.evaluate((e) => ({ ...e.dataset })),
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  // The principal four-runtime drag/release above intentionally keeps the real
  // 120ms source running. Pause only for isolated invalidation/idle controls.
  await page.evaluate(() => window.v2Material.pause());
  await page.waitForFunction(() => window.v2Material.metrics().pendingImages === 0);
  assert.ok(
    recordingFrames.length >= 5,
    'continuous evidence requires at least five actual screencast frames'
  );
  assert.ok(
    new Set(recordingFrames.map((f) => f.timestamp)).size >= 5,
    'captured frames need distinct native timestamps'
  );
  // Slow real decode settlement, then revoke; old completion must never republish.
  await page.evaluate(() => {
    window.__decode.delay = 500;
    window.v2Material.scenes()[0].redraw();
  });
  await page.waitForFunction(() => window.v2Material.metrics().pendingImages > 0);
  await page.evaluate(() => window.v2Material.source(false));
  assert.ok(
    await page
      .locator('[data-demo-ref="regular"]')
      .evaluateAll((es) =>
        es.every(
          (e) =>
            e.dataset.materialQuality === 'opaque-fallback' &&
            !getComputedStyle(e, '::before').backgroundImage.includes('data:image') &&
            !getComputedStyle(e).backgroundImage.includes('data:image')
        )
      )
  );
  await page.waitForTimeout(650);
  assert.ok(
    await page
      .locator('[data-demo-ref="regular"]')
      .evaluateAll((es) =>
        es.every(
          (e) =>
            e.dataset.materialQuality === 'opaque-fallback' &&
            !getComputedStyle(e, '::before').backgroundImage.includes('data:image') &&
            !getComputedStyle(e).backgroundImage.includes('data:image')
        )
      )
  );
  results.push({ flow: 'delayed real decode then source revoke', stalePublish: false });
  await page.evaluate(() => {
    window.__decode.delay = 0;
    window.v2Material.source(true);
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-demo-ref="regular"]')].every(
      (e) => e.dataset.materialQuality === 'self-optical'
    )
  );
  // Hold already decoded old-size images at the Promise delivery boundary,
  // then change real viewport/source geometry. GPU and image decode stay real.
  const beforeResize = await page.evaluate(() => ({
    counts: [...document.querySelectorAll('[data-count]')].map((e) => Number(e.textContent)),
    sources: window.v2Material.scenes().map((s) => ({
      revision: s.lease.current().revision,
      width: s.lease.current().width,
      height: s.lease.current().height,
    })),
  }));
  await page.evaluate(() => {
    window.__decode.hold = true;
    for (const s of window.v2Material.scenes()) s.redraw();
  });
  await page.waitForFunction(() => window.__decode.held.length === 4);
  await page.evaluate(() => {
    window.__resizeOldImages = window.__decode.held.map((h) => h.source);
    window.__decode.hold = false;
    window.__decode.delay = 250;
  });
  await page.setViewportSize({ width: 1000, height: 840 });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-demo-ref="regular"]')].every(
      (e) =>
        e.dataset.materialQuality === 'opaque-fallback' &&
        !getComputedStyle(e, '::before').backgroundImage.includes('data:image') &&
        !getComputedStyle(e).backgroundImage.includes('data:image')
    )
  );
  const resizeBoundary = await page.evaluate(() => ({
    index: window.__frames.length,
    sources: window.v2Material.scenes().map((s) => ({
      revision: s.lease.current().revision,
      width: s.lease.current().width,
      height: s.lease.current().height,
    })),
  }));
  assert.ok(
    resizeBoundary.sources.every((s, i) => s.width !== beforeResize.sources[i].width),
    'the viewport change must actually resize every source canvas'
  );
  await page.evaluate(() => {
    window.__decode.delay = 0;
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-demo-ref="regular"]')].every(
      (e, i) =>
        e.dataset.materialQuality === 'self-optical' &&
        Number(e.dataset.materialSourceRevision) ===
          window.v2Material.scenes()[i].lease.current().revision
    )
  );
  const releasedOldImages = await page.evaluate(() => {
    const held = window.__decode.held.splice(0);
    held.forEach((h) => h.resolve());
    return held.length;
  });
  assert.equal(releasedOldImages, 4, 'four real old-size decodes must actually complete late');
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        function tick() {
          if (++n === 4) resolve();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      })
  );
  const resizeResult = await page.evaluate(
    (start) => ({
      counts: [...document.querySelectorAll('[data-count]')].map((e) => Number(e.textContent)),
      frames: window.__frames.slice(start),
      staleOldImage: window.__frames
        .slice(start)
        .some((f) =>
          f.controls.some(
            (c) =>
              c.data.materialQuality === 'self-optical' &&
              window.__resizeOldImages.some((source) =>
                window.__paints[c.carrier]?.includes(source)
              )
          )
        ),
      surfaces: [...document.querySelectorAll('[data-demo-ref="regular"]')].map((e) => {
        const r = e.getBoundingClientRect(),
          p = getComputedStyle(e, '::before');
        return {
          runtime: e.closest('[data-runtime]').dataset.runtime,
          width: r.width,
          height: r.height,
          paintWidth: parseFloat(p.width),
          paintHeight: parseFloat(p.height),
          quality: e.dataset.materialQuality,
          sourceRevision: Number(e.dataset.materialSourceRevision),
        };
      }),
    }),
    resizeBoundary.index
  );
  assert.deepEqual(resizeResult.counts, beforeResize.counts, 'resize never activates controls');
  assert.equal(
    resizeResult.staleOldImage,
    false,
    'old decoded PNG bytes must not replace the resized optical paint'
  );
  for (const [i, surface] of resizeResult.surfaces.entries()) {
    assert.equal(surface.quality, 'self-optical');
    assert.equal(surface.sourceRevision, resizeBoundary.sources[i].revision);
    const outset = Math.ceil(Math.max(surface.width, surface.height) * 0.08 + 1);
    assert.equal(surface.paintWidth, surface.width + 2 * outset);
    assert.equal(surface.paintHeight, surface.height + 2 * outset);
    assert.ok(
      resizeResult.frames.every(
        (f) =>
          f.controls[i].data.materialQuality !== 'self-optical' ||
          Number(f.controls[i].data.materialSourceRevision) === resizeBoundary.sources[i].revision
      ),
      'late old-size decode cannot publish the old source revision'
    );
  }
  await page.screenshot({ path: join(out, 'resized-recovered.png') });
  results.push({
    flow: 'resize invalidates pending old decode and recovers new geometry',
    before: beforeResize,
    after: resizeResult.surfaces,
    observedFrames: resizeResult.frames.length,
  });
  await page.evaluate(() => {
    window.__lostExtension = window.__gpu[0].getExtension('WEBGL_lose_context');
    if (!window.__lostExtension) throw Error('WEBGL_lose_context unavailable');
    window.__lostExtension.loseContext();
  });
  await page.waitForTimeout(100);
  assert.ok(
    await page
      .locator('[data-demo-ref="regular"]')
      .evaluateAll((es) =>
        es.every(
          (e) =>
            e.dataset.materialQuality === 'opaque-fallback' &&
            !getComputedStyle(e, '::before').backgroundImage.includes('data:image') &&
            !getComputedStyle(e).backgroundImage.includes('data:image')
        )
      )
  );
  await page.evaluate(() => window.__lostExtension.restoreContext());
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-demo-ref="regular"]')].every(
      (e) => e.dataset.materialQuality === 'self-optical'
    )
  );
  results.push({ flow: 'WebGL actual context loss/recovery', state: await state() });
  // Real competing author CSS must fail closed and then become idle, rather
  // than continually retrying its own carrier marker/stylesheet mutations.
  const cssTarget = page.locator('[data-runtime="wc"] [data-demo-ref="regular"]');
  const cssCases = [
    'background-size:1px 1px !important',
    'background-position:3px 4px !important',
    'background-repeat:repeat !important',
    'margin-left:3px !important',
    'visibility:hidden !important',
    'background-image:linear-gradient(red,red),var(--pui-material-image) !important',
  ];
  for (const [index, rule] of cssCases.entries()) {
    await page.evaluate((rule) => {
      const s = document.createElement('style');
      s.id = 'material-competing-css';
      s.textContent = `[data-runtime="wc"] [data-demo-ref="regular"]::before{${rule}}`;
      document.head.append(s);
    }, rule);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-runtime="wc"] [data-demo-ref="regular"]').dataset
          .materialQuality === 'opaque-fallback'
    );
    await page.waitForFunction(() => window.v2Material.metrics().pendingImages === 0);
    const idleBefore = await page.evaluate(() => window.v2Material.metrics());
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          function tick() {
            if (++n === 12) resolve();
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        })
    );
    const idleAfter = await page.evaluate(() => window.v2Material.metrics());
    assert.equal(
      idleAfter.renders,
      idleBefore.renders,
      `unchanged failed carrier must not render again: ${rule}`
    );
    assert.equal(
      idleAfter.imagePreparations,
      idleBefore.imagePreparations,
      `unchanged failed carrier must not decode again: ${rule}`
    );
    assert.equal(await cssTarget.getAttribute('data-material-quality'), 'opaque-fallback');
    if (index === 0) await page.screenshot({ path: join(out, 'competing-css-fallback.png') });
    await page.evaluate(() => document.querySelector('#material-competing-css').remove());
    await page.waitForFunction(
      () =>
        document.querySelector('[data-runtime="wc"] [data-demo-ref="regular"]').dataset
          .materialQuality === 'self-optical'
    );
    assert.equal(
      await cssTarget.evaluate((e) => getComputedStyle(e, '::before').backgroundSize),
      '100% 100%'
    );
    results.push({
      flow: 'actual CSS rejection, idle and external-change recovery',
      rule,
      idleBefore,
      idleAfter,
    });
  }
  await page.screenshot({ path: join(out, 'competing-css-recovered.png') });

  await page.evaluate(() => (window.__record = false));
  const performance = await page.evaluate(() => {
    const frames = window.__frames,
      intervals = frames
        .slice(1)
        .map((f, i) => f.t - frames[i].t)
        .sort((a, b) => a - b),
      decodes = [...window.__decode.timings].sort((a, b) => a - b),
      metrics = window.v2Material.metrics();
    return {
      sampledRafs: frames.length,
      rafIntervalMedian: intervals[Math.floor(intervals.length * 0.5)],
      rafIntervalP95: intervals[Math.floor(intervals.length * 0.95)],
      decodeCount: window.__decode.calls,
      decodeMedian: decodes[Math.floor(decodes.length * 0.5)],
      decodeP95: decodes[Math.floor(decodes.length * 0.95)],
      metrics,
      note: 'Diagnostic real browser run includes screenshots, recording, induced delay and interruptions; no 60fps claim.',
    };
  });
  assert.ok(performance.metrics.peakPendingImages <= 4, 'at most one decode per optical surface');
  assert.ok(
    performance.metrics.decodedImages <= 4,
    'at most one owned committed image per surface'
  );
  results.push({ flow: 'resource and timing observations', ...performance });
  const controls = await page.evaluate(() => window.v2Material.controls());
  for (const control of controls)
    await writeFile(
      join(out, `control-${control.control}.png`),
      Buffer.from(control.image.split(',')[1], 'base64')
    );
  const comparisons = await page.evaluate(async (controls) => {
    const pixels = async (value) => {
      const img = new Image();
      img.src = value;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return {
        data: ctx.getImageData(0, 0, c.width, c.height).data,
        width: c.width,
        height: c.height,
      };
    };
    const outsideAlpha = (p) => {
      const g = controls[0].geometry,
        o = g.paintOutset * g.dpr,
        w = g.width * g.dpr,
        h = g.height * g.dpr;
      let n = 0;
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++)
          if (
            (x < o || x >= o + w || y < o || y >= o + h) &&
            p.data[(y * p.width + x) * 4 + 3] > 127
          )
            n++;
      return n;
    };
    const reference = await pixels(controls[0].image),
      result = [];
    for (const control of controls.slice(1)) {
      const p = await pixels(control.image);
      let changed = 0,
        sum = 0;
      for (let i = 0; i < p.data.length; i += 4) {
        let delta = 0;
        for (let c = 0; c < 4; c++) {
          const d = p.data[i + c] - reference.data[i + c];
          delta += Math.abs(d);
          sum += d * d;
        }
        if (delta > 0) changed++;
      }
      result.push({
        control: control.control,
        changedPixels: changed,
        outsideAlphaPixels: outsideAlpha(p),
        fullOutsideAlphaPixels: outsideAlpha(reference),
        rmse: Math.sqrt(sum / p.data.length),
        width: p.width,
        height: p.height,
      });
    }
    return result;
  }, controls);
  for (const comparison of comparisons)
    assert.ok(
      comparison.changedPixels > 5,
      `${comparison.control} must visibly affect rendered pixels`
    );
  const noDeformation = comparisons.find((c) => c.control === 'zero-deformation');
  assert.ok(
    noDeformation.fullOutsideAlphaPixels > noDeformation.outsideAlphaPixels,
    'contact silhouette expands beyond undeformed host bounds'
  );
  results.push({
    flow: 'matched real WebGL controls',
    comparisons,
    geometry: controls[0].geometry,
  });

  const changedSource = await page.evaluate(() => {
    const scene = window.v2Material.scenes()[0];
    scene.lease.draw((ctx, w, h) => {
      ctx.fillStyle = '#0735ce';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fcda32';
      for (let x = 0; x < w; x += 20) ctx.fillRect(x, 0, 8, h);
    });
    return window.v2Material.controls()[0];
  });
  assert.notEqual(
    changedSource.image,
    controls[0].image,
    'real source pixel replacement changes sampled lens output'
  );
  await writeFile(
    join(out, 'control-changed-owned-source.png'),
    Buffer.from(changedSource.image.split(',')[1], 'base64')
  );
  results.push({ flow: 'actual owned source pixel replacement', opticalOutputChanged: true });
  await page.evaluate(() => window.v2Material.scenes()[0].redraw());

  await writeFile(
    join(out, 'timeline.json'),
    JSON.stringify(
      await page.evaluate(() => ({
        frames: window.__frames,
        contacts: window.__contacts,
        native: window.__native,
        paints: window.__paints,
        captures: window.__captureCalls,
        decode: window.__decode,
      })),
      null,
      2
    )
  );
  await page.evaluate(() => window.v2Material.dispose());
  const disposed = await state();
  assert.equal(disposed.metrics.contexts, 0);
  assert.equal(disposed.metrics.pendingImages, 0);
  assert.equal(disposed.metrics.decodedImages, 0);
  results.push({ flow: 'dispose', state: disposed });
  assert.deepEqual(errors, [], 'no uncaught browser errors');
} catch (e) {
  failure = String(e.stack ?? e);
  if (page) {
    await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
    await writeFile(
      join(out, 'failure-state.json'),
      JSON.stringify(
        await page
          .evaluate(() => ({
            html: document.documentElement.dataset,
            controls: [...document.querySelectorAll('[data-demo-ref="regular"]')].map((e) => ({
              data: { ...e.dataset },
              style: e.getAttribute('style'),
            })),
            frames: window.__frames,
            contacts: window.__contacts,
            native: window.__native,
            metrics: window.v2Material?.metrics(),
            carrierStyleReads: window.__carrierStyleDiagnostics,
          }))
          .catch(() => null),
        null,
        2
      )
    );
  }
} finally {
  recording = false;
  await Promise.all(frameWrites);
  await writeFile(join(out, 'recording', 'frames.json'), JSON.stringify(recordingFrames, null, 2));
  const fps =
    recordingFrames.length > 1
      ? (recordingFrames.length - 1) /
        (recordingFrames.at(-1).timestamp - recordingFrames[0].timestamp)
      : 0;
  let video = {
    capturedFrames: recordingFrames.length,
    observedCaptureFps: fps,
    note: 'Capture cadence is not UI frame-rate proof',
  };
  if (fps > 0) {
    const r = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(fps),
        '-i',
        join(out, 'recording', '%05d.jpg'),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        join(out, 'continuous-drag.mp4'),
      ],
      { encoding: 'utf8' }
    );
    video = { ...video, encoded: r.status === 0, error: r.error?.message ?? r.stderr };
  }
  results.push({ flow: 'actual browser screencast', video });
  await writeFile(
    join(out, 'result.json'),
    JSON.stringify(
      {
        source,
        browser: browser?.version(),
        results,
        errors,
        failure,
        execution: failure ? 'failed' : 'passed',
      },
      null,
      2
    )
  );
  await context?.close();
  await browser?.close();
  await new Promise((r) => server.close(r));
}
if (failure) throw Error(failure);
console.log(out);
