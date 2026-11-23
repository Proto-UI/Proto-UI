import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { setImmediate as idle } from 'node:timers/promises';
import {
  observeDiagramReadingViewport,
  verifyDiagramReadingCapture,
} from '../../../apps/www/scripts/diagram-reading-observation.mjs';

function fixture({ loading = false } = {}) {
  const frames = new Map();
  const timers = new Map();
  let sequence = 0;
  let reads = 0;
  let y = 66;
  let active = false;
  let connected = true;
  let currentImage;
  let resolveFonts;
  const fonts = {
    status: loading ? 'loading' : 'loaded',
    ready: loading
      ? new Promise((resolve) => {
          resolveFonts = resolve;
        })
      : Promise.resolve(),
  };
  const style = {
    transform: 'none',
    translate: 'none',
    fontFamily: 'Test Sans',
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '20px',
    overflowX: 'auto',
    overflowY: 'auto',
    colorScheme: 'light',
  };
  const win = {
    performance,
    getComputedStyle: () => style,
    requestAnimationFrame(callback) {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    setTimeout(callback, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        callback();
      }, ms);
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      timers.delete(id);
    },
  };
  const doc = { defaultView: win, fonts, getElementById: () => null };
  const element = (name, getBox) => ({
    localName: name,
    ownerDocument: doc,
    get isConnected() {
      return connected;
    },
    getBoundingClientRect() {
      reads++;
      return getBox();
    },
  });
  const image = {
    ...element('img', () => ({ x: 22, y, width: 960, height: 920 })),
    currentSrc: 'http://127.0.0.1/diagrams/example.svg',
    naturalWidth: 960,
    naturalHeight: 920,
    alt: 'Example diagram',
    complete: true,
    getAttribute: () => null,
  };
  const toolbar = {
    ...element('div', () => ({ x: 22, y: 22, width: 1396, height: 40 })),
    children: [element('button', () => ({ x: 22, y: 22, width: 80, height: 32 }))],
  };
  const canvas = element('surface', () => ({ x: 16, y: 16, width: 1408, height: 968 }));
  const root = element('reading-root', () => ({ x: 22, y, width: 1396, height: 910 }));
  const content = {
    ...element('dialog-content', () => ({ x: 16, y: 16, width: 1408, height: 968 })),
    getAttribute: () => 'entered',
    querySelector: () => toolbar,
    getAnimations(options) {
      assert.equal(options.subtree, true);
      return active
        ? [
            {
              effect: { target: canvas },
              pending: true,
              playState: 'running',
              currentTime: 10,
              animationName: 'enter',
            },
          ]
        : [];
    },
  };
  currentImage = image;
  const viewport = {
    ...element('reading-viewport', () => ({ x: 22, y, width: 1396, height: 910 })),
    dataset: { docsImageScale: 'reading' },
    clientWidth: 1396,
    clientHeight: 910,
    scrollWidth: 1396,
    scrollHeight: 920,
    scrollLeft: 0,
    scrollTop: 0,
    tabIndex: 0,
    getAttribute: (name) => (name === 'role' ? 'region' : 'Diagram reading viewport'),
    closest: (selector) =>
      selector === '[data-docs-image-content]'
        ? content
        : selector === '[data-docs-image-canvas]'
          ? canvas
          : root,
    querySelector: () => currentImage,
  };
  return {
    image,
    get reads() {
      return reads;
    },
    get pendingFrames() {
      return frames.size;
    },
    get pendingTimers() {
      return timers.size;
    },
    setY(value) {
      y = value;
    },
    setAnimation(value) {
      active = value;
    },
    replaceImage() {
      currentImage = { ...image };
    },
    finishFonts() {
      fonts.status = 'loaded';
      y = 68;
      resolveFonts?.();
    },
    start(options = {}) {
      // Exercise exactly the function body sent by Playwright, with no module
      // scope or transpiler helpers. JSON models Playwright's value transfer.
      const result = vm.runInNewContext(
        '(' + observeDiagramReadingViewport.toString() + ')(viewport, options)',
        { viewport, options }
      );
      return result.then((value) => JSON.parse(JSON.stringify(value)));
    },
    async frame() {
      await idle();
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(performance.now());
      await idle();
    },
    expire() {
      for (const [id, callback] of [...timers]) {
        clearTimeout(id);
        timers.delete(id);
        callback();
      }
    },
  };
}

async function settled(current) {
  const result = current.start();
  await current.frame();
  await current.frame();
  return result;
}

test('serialized observer waits for the newly mounted font set before reading geometry', async () => {
  const current = fixture({ loading: true });
  const result = current.start();
  await idle();
  assert.equal(current.reads, 0);
  assert.equal(current.pendingFrames, 0);
  current.finishFonts();
  await current.frame();
  await current.frame();
  const observed = await result;
  assert.equal(observed.outcome, 'passed');
  assert.equal(observed.observation.viewport.y, 68);
  assert.equal(observed.observation.image.y, 68);
  assert.equal(observed.trace.initialFontStatus, 'loading');
  assert.equal(current.pendingFrames, 0);
  assert.equal(current.pendingTimers, 0);
});

test('two equal frames after a real geometry change are required, not two total reads', async () => {
  const current = fixture();
  const result = current.start();
  await current.frame();
  current.setY(68);
  await current.frame();
  assert.equal(current.pendingFrames, 1);
  await current.frame();
  const observed = await result;
  assert.equal(observed.outcome, 'passed');
  assert.deepEqual(
    observed.trace.samples.map((sample) => sample.image.y),
    [66, 68, 68]
  );
  assert.equal(observed.observation.viewport.y, observed.observation.image.y);
});

test('an active descendant animation prevents acceptance of unchanged geometry', async () => {
  const current = fixture();
  current.setAnimation(true);
  const result = current.start();
  await current.frame();
  await current.frame();
  assert.equal(current.pendingFrames, 1);
  current.setAnimation(false);
  await current.frame();
  assert.equal(current.pendingFrames, 1);
  await current.frame();
  const observed = await result;
  assert.equal(observed.outcome, 'passed');
  assert.equal(observed.trace.samples[0].activeAnimations[0].pending, true);
});

test('the actual deadline fails a never-ready font set and late completion schedules no work', async () => {
  const current = fixture({ loading: true });
  const observed = await current.start({ timeoutMs: 25 });
  assert.equal(observed.outcome, 'failed');
  assert.match(observed.error, /timeout/);
  assert.equal(current.reads, 0);
  current.finishFonts();
  await idle();
  assert.equal(current.pendingFrames, 0);
  assert.equal(current.pendingTimers, 0);
});

test('continued geometry drift fails closed and retains a bounded first/last trace', async () => {
  const current = fixture();
  const result = current.start();
  for (let index = 0; index < 24; index++) {
    current.setY(66 + index);
    await current.frame();
  }
  current.expire();
  const observed = await result;
  assert.equal(observed.outcome, 'failed');
  assert.equal(observed.trace.sampleCount, 24);
  assert.equal(observed.trace.samples.length, 16);
  assert.equal(observed.trace.omittedSamples, 8);
  assert.equal(observed.trace.samples[0].frame, 1);
  assert.equal(observed.trace.samples.at(-1).frame, 24);
  assert.equal(current.pendingFrames, 0);
  assert.equal(current.pendingTimers, 0);
});

test('a changed image owner fails instead of returning the previous stable image', async () => {
  const current = fixture();
  const result = current.start();
  await current.frame();
  current.replaceImage();
  await current.frame();
  const observed = await result;
  assert.equal(observed.outcome, 'failed');
  assert.match(observed.error, /owner changed/);
});

test('matching independently executed observations bind the PNG before and after', async () => {
  const current = fixture();
  const before = await settled(current);
  const after = await settled(current);
  assert.deepEqual(verifyDiagramReadingCapture(before, after), { outcome: 'passed', problems: [] });
});

test('post-PNG geometry or source changes remain failures and never replace the earlier observation', async () => {
  const current = fixture();
  const before = await settled(current);
  current.setY(68);
  const moved = await settled(current);
  const movement = verifyDiagramReadingCapture(before, moved);
  assert.equal(movement.outcome, 'failed');
  assert.ok(movement.problems.some((problem) => problem.includes('image changed')));
  assert.equal(before.observation.image.y, 66);
  current.image.currentSrc = 'http://127.0.0.1/diagrams/replacement.svg';
  const replaced = await settled(current);
  assert.equal(verifyDiagramReadingCapture(moved, replaced).outcome, 'failed');
  assert.match(moved.observation.image.src, /example\.svg$/);
});

test('failed or incomplete observation packets cannot certify matching captures', () => {
  assert.equal(verifyDiagramReadingCapture({}, {}).outcome, 'failed');
  assert.equal(
    verifyDiagramReadingCapture({ outcome: 'passed' }, { outcome: 'passed' }).outcome,
    'failed'
  );
  assert.equal(
    verifyDiagramReadingCapture({ outcome: 'failed' }, { outcome: 'failed' }).outcome,
    'failed'
  );
});
