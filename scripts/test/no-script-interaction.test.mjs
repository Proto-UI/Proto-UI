import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const file = 'apps/www/src/content/docs/zh-cn/library-no-script-interaction.ts';
const source = readFileSync(file, 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const {
  revealNoScriptLink: reveal,
  activateNoScriptLink: activate,
  readNoScriptLink: read,
  traceNoScriptInput: traceInput,
} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const expected = 'https://fixture.test/en/ui-libraries/liquid-glass/';
function harness(overrides = {}) {
  let time = 0,
    scrollY = 0,
    top = 11000;
  const calls = [];
  const input = {
    async sample() {
      return {
        wheelPoint: { x: 160, y: 675 },
        visibleBounds: { left: 0, top: 0, right: 320, bottom: 900 },
        connected: true,
        visible: true,
        href: expected,
        target: '',
        download: false,
        rect: { x: 72, y: top - scrollY, width: 176, height: 80 },
        viewport: { width: 320, height: 900, scrollX: 0, scrollY },
        point: { x: 160, y: top - scrollY + 40 },
        receivesEvents: top - scrollY >= 0 && top - scrollY + 80 <= 900,
      };
    },
    async move(x, y) {
      calls.push(['move', x, y]);
    },
    async wheel(delta) {
      calls.push(['wheel', delta]);
      scrollY += delta;
    },
    async down() {
      calls.push(['down']);
    },
    async up() {
      calls.push(['up']);
    },
    ...overrides,
  };
  return {
    input,
    calls,
    options: {
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      timeoutMs: 30_000,
    },
    setTop: (value) => {
      top = value;
    },
  };
}
test('real-input orchestration reaches an initially distant link and records observed host stability', async () => {
  const h = harness();
  const result = await reveal(h.input, expected, h.options);
  assert.ok(result.wheels > 1 && result.wheels <= 40);
  assert.equal(result.sample.receivesEvents, true);
  assert.ok(result.elapsedMs >= 100);
  assert.match(result.stability, /not rAF/);
  assert.equal(h.calls.filter((x) => x[0] === 'down').length, 0);
});
test('already visible native link requires no wheel and passes three samples', async () => {
  const h = harness();
  h.setTop(350);
  const r = await reveal(h.input, expected, h.options);
  assert.equal(r.wheels, 0);
  assert.equal(r.samples.length, 3);
});
test('native activation rechecks after pointer movement and sends down then up', async () => {
  const h = harness();
  h.setTop(350);
  await activate(h.input, expected, h.options);
  assert.deepEqual(
    h.calls.map((x) => x[0]),
    ['move', 'down', 'up']
  );
});
test('stable sticky-header occlusion is a blocking failure, not a forced click', async () => {
  const h = harness();
  h.setTop(30);
  const base = h.input.sample;
  h.input.sample = async () => ({ ...(await base()), receivesEvents: false });
  await assert.rejects(reveal(h.input, expected, h.options), /obstructed/);
  assert.equal(h.calls.length, 0);
});
test('continued geometry jitter exhausts the original bounded time without clicking', async () => {
  const h = harness();
  h.setTop(350);
  const base = h.input.sample;
  let n = 0;
  h.input.sample = async () => {
    const s = await base();
    s.rect.x += n++ % 2;
    return s;
  };
  await assert.rejects(reveal(h.input, expected, { ...h.options, timeoutMs: 250 }), /deadline/);
  assert.equal(h.calls.length, 0);
});
test('unreachable geometry is bounded by the wheel count', async () => {
  const h = harness({ wheel: async () => {} });
  await assert.rejects(reveal(h.input, expected, { ...h.options, maxWheels: 2 }), /unreachable/);
});
test('an action link taller than the viewport fails rather than clipping acceptance', async () => {
  const h = harness();
  const base = h.input.sample;
  h.input.sample = async () => {
    const s = await base();
    s.rect.height = 1000;
    return s;
  };
  await assert.rejects(reveal(h.input, expected, h.options), /cannot fit/);
});
for (const [label, change] of [
  ['detached', (s) => (s.connected = false)],
  ['hidden', (s) => (s.visible = false)],
  ['zero-width', (s) => (s.rect.width = 0)],
  ['NaN', (s) => (s.rect.x = NaN)],
  ['other-origin', (s) => (s.href = 'https://other.test/')],
  ['wrong-path', (s) => (s.href = 'https://fixture.test/other/')],
  ['new-tab', (s) => (s.target = '_blank')],
  ['download', (s) => (s.download = true)],
])
  test(`rejects ${label} before any input`, async () => {
    const h = harness();
    const base = h.input.sample;
    h.input.sample = async () => {
      const s = await base();
      change(s);
      return s;
    };
    await assert.rejects(reveal(h.input, expected, h.options));
    assert.equal(h.calls.length, 0);
  });
for (const primary of [new Error('wheel'), undefined, null, false, 0, ''])
  test(`propagates original wheel failure ${String(primary)}`, async () => {
    const h = harness({
      wheel: async () => {
        throw primary;
      },
    });
    let caught = false;
    try {
      await reveal(h.input, expected, h.options);
    } catch (error) {
      caught = true;
      assert.equal(error, primary);
    }
    assert.equal(caught, true);
  });
test('a stalled read times out and its late resolution never produces input', async () => {
  let finish;
  const h = harness({ sample: () => new Promise((r) => (finish = r)) });
  await assert.rejects(reveal(h.input, expected, { timeoutMs: 10 }), /deadline/);
  finish({});
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(h.calls.length, 0);
});
test('pointer hover movement invalidates the pending native press', async () => {
  const h = harness();
  h.setTop(350);
  h.input.move = async () => h.setTop(360);
  await assert.rejects(activate(h.input, expected, h.options), /moved or changed/);
  assert.equal(h.calls.length, 0);
});
test('press-time occlusion releases the pointer without swallowing the failure', async () => {
  const h = harness();
  h.setTop(350);
  const base = h.input.sample;
  let pressed = false;
  h.input.down = async () => {
    pressed = true;
    h.calls.push(['down']);
  };
  h.input.sample = async () => ({ ...(await base()), receivesEvents: !pressed });
  await assert.rejects(activate(h.input, expected, h.options), /during native press/);
  assert.deepEqual(
    h.calls.map((x) => x[0]),
    ['move', 'down', 'up']
  );
});
test('native read uses actual elementFromPoint descendants and retains header obstruction', () => {
  const saved = {};
  for (const k of [
    'document',
    'getComputedStyle',
    'HTMLAnchorElement',
    'innerWidth',
    'innerHeight',
    'scrollX',
    'scrollY',
  ])
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  class Anchor {
    isConnected = true;
    href = expected;
    getBoundingClientRect() {
      return { x: 10, y: 20, width: 100, height: 50 };
    }
    getAttribute() {
      return null;
    }
    hasAttribute() {
      return false;
    }
    contains(e) {
      return e === child;
    }
  }
  const anchor = new Anchor(),
    child = {},
    header = {};
  let hit = child;
  let point;
  Object.assign(globalThis, {
    HTMLAnchorElement: Anchor,
    innerWidth: 320,
    innerHeight: 900,
    scrollX: 0,
    scrollY: 0,
    getComputedStyle: () => ({ display: 'inline-block', visibility: 'visible', opacity: '1' }),
    document: {
      elementFromPoint: (x, y) => {
        point = [x, y];
        return hit;
      },
    },
  });
  try {
    assert.equal(read(anchor).receivesEvents, true);
    assert.deepEqual(point, [60, 45]);
    hit = header;
    assert.equal(read(anchor).receivesEvents, false);
  } finally {
    for (const [k, v] of Object.entries(saved))
      if (v) Object.defineProperty(globalThis, k, v);
      else delete globalThis[k];
  }
});
test('producer retains disabled JavaScript, readability, uncropped capture and original navigation', () => {
  const browser = readFileSync(
    'apps/www/src/content/docs/zh-cn/library-liquid-card-producer.browser.test.ts',
    'utf8'
  );
  const nojs = browser.slice(browser.indexOf("describe('candidate Card keeps"));
  assert.match(nojs, /javaScriptEnabled: false/);
  assert.match(nojs, /libraryCardReadabilityFailures\(cards\)/);
  assert.match(nojs, /expect\(await page\.locator\('a a'\)\.count\(\)\)\.toBe\(0\)/);
  assert.match(
    nojs,
    /page\.waitForURL\(`\$\{baseUrl\}\/\$\{locale\}\/ui-libraries\/liquid-glass\/`\)/
  );
  assert.doesNotMatch(nojs, /scrollIntoViewIfNeeded|\.click\(|force:|captureBeyondViewport|clip\b/);
  assert.match(nojs, /captureCurrentViewport/);
});

for (const primary of [undefined, null, false, 0, '', new Error('pressed read')])
  test(`preserves pressed observation failure ${String(primary)} when release also fails`, async () => {
    const h = harness();
    h.setTop(350);
    const original = h.input.sample;
    let pressed = false,
      releases = 0;
    h.input.down = async () => {
      pressed = true;
    };
    h.input.sample = async () => {
      if (pressed) throw primary;
      return original();
    };
    h.input.up = async () => {
      releases++;
      throw new Error('release');
    };
    let caught = false;
    try {
      await activate(h.input, expected, h.options);
    } catch (error) {
      caught = true;
      assert.equal(error, primary);
    }
    assert.equal(caught, true);
    assert.equal(releases, 1);
  });

for (const primary of [undefined, null, false, 0, '', new Error('down rejection')])
  test(`releases a possibly sent press on down rejection ${String(primary)}`, async () => {
    const h = harness();
    h.setTop(350);
    let pressed = false,
      releases = 0;
    h.input.down = async () => {
      pressed = true;
      throw primary;
    };
    h.input.up = async () => {
      pressed = false;
      releases++;
    };
    let caught = false;
    try {
      await activate(h.input, expected, h.options);
    } catch (error) {
      caught = true;
      assert.equal(error, primary);
    }
    assert.equal(caught, true);
    assert.equal(pressed, false);
    assert.equal(releases, 1);
  });
for (const lateFailure of [false, true])
  test(`timed-out press releases immediately and after late ${lateFailure ? 'rejection' : 'completion'}`, async () => {
    const h = harness();
    h.setTop(350);
    let finish,
      pressed = false,
      releases = 0;
    h.input.down = () =>
      new Promise((resolve, reject) => {
        finish = () => {
          pressed = true;
          if (lateFailure) reject(new Error('late'));
          else resolve();
        };
      });
    h.input.up = async () => {
      pressed = false;
      releases++;
    };
    await assert.rejects(activate(h.input, expected, { ...h.options, timeoutMs: 220 }), /deadline/);
    assert.equal(releases, 1);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(pressed, false);
    assert.equal(releases, 2);
  });

test('input trace separates acknowledged wheel delivery from observed scrolling', async () => {
  const h = harness({ wheel: async () => {} });
  const trace = { entries: [], dropped: 0 };
  const input = traceInput(h.input, trace);
  await assert.rejects(reveal(input, expected, { ...h.options, maxWheels: 2 }), /bounded wheel/);
  const wheels = trace.entries.filter((entry) => entry.operation === 'wheel');
  const samples = trace.entries.filter((entry) => entry.operation === 'sample');
  assert.equal(wheels.length, 2);
  assert.ok(wheels.every((entry) => entry.status === 'fulfilled' && entry.args[0] === 720));
  assert.ok(samples.every((entry) => entry.sample.viewport.scrollY === 0));
  assert.ok(trace.entries.every((entry) => entry.settledAt >= entry.startedAt));
  assert.equal(trace.dropped, 0);
});

for (const primary of [undefined, null, false, 0, '', new Error('transport rejected')])
  test(`input trace preserves exact transport rejection ${String(primary)}`, async () => {
    const h = harness({
      wheel: async () => {
        throw primary;
      },
    });
    const trace = { entries: [], dropped: 0 };
    let caught = false;
    try {
      await reveal(traceInput(h.input, trace), expected, h.options);
    } catch (error) {
      caught = true;
      assert.equal(error, primary);
    }
    assert.equal(caught, true);
    assert.equal(trace.entries.at(-1).operation, 'wheel');
    assert.equal(trace.entries.at(-1).status, 'rejected');
  });

test('input trace retains pending response at deadline and separates later settlement', async () => {
  let finish;
  const h = harness({
    wheel: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const trace = { entries: [], dropped: 0 };
  await assert.rejects(
    reveal(traceInput(h.input, trace), expected, { ...h.options, timeoutMs: 120 }),
    /deadline/
  );
  const snapshot = JSON.parse(JSON.stringify(trace));
  assert.equal(snapshot.entries.at(-1).status, 'pending');
  assert.equal(snapshot.entries.at(-1).settledAt, undefined);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(trace.entries.at(-1).status, 'fulfilled');
  assert.equal(snapshot.entries.at(-1).status, 'pending');
});

test('input trace caps retained operations without suppressing actual input', async () => {
  const h = harness();
  const trace = { entries: [], dropped: 0 };
  const input = traceInput(h.input, trace);
  for (let i = 0; i < 2050; i++) await input.move(160, 675);
  assert.equal(trace.entries.length, 2048);
  assert.equal(trace.dropped, 2);
  assert.equal(h.calls.length, 2050);
});

test('failure journal persists separately before screenshot and keeps original verdict', () => {
  const producer = readFileSync(
    'apps/www/src/content/docs/zh-cn/library-liquid-card-producer.browser.test.ts',
    'utf8'
  );
  const nojs = producer.slice(producer.indexOf("describe('candidate Card keeps"));
  assert.match(nojs, /noScriptInput\(page, link, inputTrace\)/);
  const failure = nojs.slice(nojs.indexOf('} catch (error)'));
  assert.ok(failure.indexOf("'input-trace.json'") < failure.indexOf('captureCurrentViewport'));
  assert.match(failure, /throw error/);
});

test('read-only diagnostic identifies wheel hit chain, scroll owner and actual viewport scale', () => {
  const names = [
    'HTMLAnchorElement',
    'ShadowRoot',
    'innerWidth',
    'innerHeight',
    'scrollX',
    'scrollY',
    'visualViewport',
    'devicePixelRatio',
    'getComputedStyle',
    'document',
  ];
  const saved = Object.fromEntries(
    names.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  );
  const css = {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    overflowX: 'visible',
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    fontSize: '32px',
  };
  class Node {
    constructor(tag, parent = null) {
      this.tagName = tag;
      this.parentElement = parent;
      this.id = tag;
    }
    isConnected = true;
    scrollTop = 25;
    scrollLeft = 0;
    scrollHeight = 22000;
    scrollWidth = 320;
    clientHeight = 900;
    clientWidth = 320;
    getBoundingClientRect() {
      return { x: 72, y: 11000, width: 176, height: 80 };
    }
    getAttribute(name) {
      return name === 'class' ? 'fixture-owner' : null;
    }
    hasAttribute() {
      return false;
    }
    getRootNode() {
      return document;
    }
    contains(node) {
      return node === this;
    }
  }
  class Anchor extends Node {
    href = expected;
  }
  const root = new Node('HTML'),
    body = new Node('BODY', root),
    nested = new Node('DIV', body),
    anchor = new Anchor('A', body);
  const points = [];
  Object.assign(globalThis, {
    HTMLAnchorElement: Anchor,
    ShadowRoot: class {},
    innerWidth: 320,
    innerHeight: 900,
    scrollX: 0,
    scrollY: 25,
    devicePixelRatio: 1,
    visualViewport: {
      width: 320,
      height: 900,
      scale: 1,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 25,
    },
    getComputedStyle: () => css,
    document: {
      documentElement: root,
      body,
      scrollingElement: root,
      elementFromPoint(x, y) {
        points.push([x, y]);
        return y === 675 ? nested : null;
      },
    },
  });
  try {
    const sample = read(anchor, true);
    assert.deepEqual(points[0], [160, 11040]);
    assert.deepEqual(points.at(-1), [160, 675]);
    assert.deepEqual(
      sample.wheelContext.hitChain.map((node) => node.tag),
      ['DIV', 'BODY', 'HTML']
    );
    assert.equal(sample.wheelContext.scrollingElement.scrollHeight, 22000);
    assert.equal(sample.wheelContext.scrollingElement.clientHeight, 900);
    assert.equal(sample.wheelContext.hitChain[0].overscrollBehaviorY, 'contain');
    assert.equal(sample.wheelContext.rootFontSize, '32px');
    assert.equal(sample.wheelContext.visualViewport.scale, 1);
    assert.equal(sample.wheelContext.chainTruncated, false);
    assert.equal(sample.viewport.scrollY, 25);
    assert.equal(root.scrollTop, 25);
    document.elementFromPoint = (x, y) => {
      if (y === 675) throw new Error('diagnostic unavailable');
      return null;
    };
    assert.match(read(anchor, true).wheelContext.unavailable, /diagnostic unavailable/);
    assert.equal(read(anchor, true).rect.y, 11000);
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

async function withWheelRouteFixture(options, work) {
  const names = [
    'HTMLAnchorElement',
    'ShadowRoot',
    'innerWidth',
    'innerHeight',
    'scrollX',
    'scrollY',
    'getComputedStyle',
    'document',
  ];
  const saved = Object.fromEntries(
    names.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  );
  const width = options.width ?? 320,
    height = 900;
  let rootOffset = options.backwards ? 5000 : 0,
    nestedOffset = 0,
    sidebarOffset = 0,
    pointer,
    time = 0;
  const calls = [];
  const box = (x, y, width, height) => ({
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
  });
  class Node {
    constructor(tag, parent, rect, style = {}) {
      this.tagName = tag;
      this.parentElement = parent;
      this.rect = rect;
      this.style = style;
      this.id = tag;
    }
    isConnected = true;
    clientLeft = 0;
    clientTop = 0;
    scrollLeft = 0;
    get scrollTop() {
      return this === root
        ? rootOffset
        : this === nested
          ? nestedOffset
          : this === sidebar
            ? sidebarOffset
            : 0;
    }
    get scrollHeight() {
      return [root, nested, sidebar].includes(this) ? 23000 : this.getBoundingClientRect().height;
    }
    get clientHeight() {
      return this === root ? height : this.getBoundingClientRect().height;
    }
    get clientWidth() {
      return this.getBoundingClientRect().width;
    }
    getBoundingClientRect() {
      return this.rect();
    }
    getAttribute() {
      return null;
    }
    hasAttribute() {
      return false;
    }
    getRootNode() {
      return document;
    }
    contains(node) {
      return node === this;
    }
  }
  class Anchor extends Node {
    href = expected;
  }
  const root = new Node('HTML', null, () => box(0, 0, width, 23000));
  const body = new Node('BODY', root, () => box(0, -rootOffset, width, 23000));
  const outer = new Node(
    'OUTER',
    body,
    () => box(options.outerNarrow ? width / 2 - 20 : 0, 100, options.outerNarrow ? 40 : width, 550),
    { overflowX: 'hidden', overflowY: 'hidden', transform: options.outerTransform ?? 'none' }
  );
  const nested = new Node(
    'NESTED',
    options.outerClip ? outer : body,
    () => box(4, 150, width - 8, 600),
    { overflowY: 'auto' }
  );
  const sidebar = new Node(
    'SIDEBAR',
    body,
    () =>
      options.fullSidebar ? box(0, 0, width, height) : box(width * 0.1, 264, width * 0.8, 540),
    { overflowY: 'auto', overscrollBehaviorY: 'contain' }
  );
  const overlay = new Node('OVERLAY', body, () => box(0, 0, width, height), {
    position: options.overlay ?? 'fixed',
  });
  const targetY = options.targetY ?? (options.backwards ? 1000 : 14000);
  const anchor = new Anchor('A', options.nested ? nested : body, () =>
    box(width * 0.2, targetY - (options.nested ? nestedOffset : rootOffset), width * 0.6, 80)
  );
  const inside = (node, x, y) => {
    const r = node.getBoundingClientRect();
    return x >= r.x && x < r.right && y >= r.y && y < r.bottom;
  };
  const hit = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height || options.noHit) return null;
    if (options.overlay) return overlay;
    if (options.nested) {
      if (!inside(nested, x, y) || (options.outerClip && !inside(outer, x, y))) return body;
      return inside(anchor, x, y) ? anchor : nested;
    }
    if (inside(anchor, x, y)) return anchor;
    return inside(sidebar, x, y) ? sidebar : body;
  };
  Object.assign(globalThis, {
    HTMLAnchorElement: Anchor,
    ShadowRoot: class {},
    innerWidth: width,
    innerHeight: height,
    scrollX: 0,
    scrollY: rootOffset,
    getComputedStyle: (node) => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      overflowY: 'visible',
      position: 'static',
      overscrollBehaviorY: 'auto',
      ...node.style,
    }),
    document: { documentElement: root, body, scrollingElement: root, elementFromPoint: hit },
  });
  const input = {
    async sample() {
      globalThis.scrollY = rootOffset;
      return read(anchor);
    },
    async move(x, y) {
      pointer = { x, y };
      calls.push(['move', x, y]);
    },
    async wheel(delta) {
      calls.push(['wheel', delta]);
      const node = hit(pointer.x, pointer.y);
      if (node === sidebar)
        sidebarOffset = Math.max(0, Math.min(23000 - sidebar.clientHeight, sidebarOffset + delta));
      else if (options.nested && (node === nested || node === anchor))
        nestedOffset = Math.max(0, nestedOffset + delta);
      else rootOffset = Math.max(0, rootOffset + delta);
    },
    async down() {
      calls.push(['down']);
    },
    async up() {
      calls.push(['up']);
    },
  };
  try {
    return await work({
      input,
      calls,
      options: {
        now: () => time,
        sleep: async (ms) => {
          time += ms;
        },
      },
      state: () => ({ rootOffset, nestedOffset, sidebarOffset }),
    });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
    }
  }
}

test('official sidebar trap reproduces old fixed-point source failure and routes the candidate to its actual document owner', async () => {
  await withWheelRouteFixture({}, async (h) => {
    // Original 5dab fixed point consumes every wheel in the independent sidebar.
    await h.input.move(160, 675);
    for (let i = 0; i < 40; i++) await h.input.wheel(720);
    assert.equal(h.state().rootOffset, 0);
    assert.equal(h.state().sidebarOffset, 22460);
    const r = await reveal(h.input, expected, h.options);
    assert.ok(r.sample.viewport.scrollY > 0);
    assert.equal(h.state().sidebarOffset, 22460);
    assert.ok(h.calls.some((call) => call[0] === 'move' && call[1] === 16));
    assert.equal(r.sample.receivesEvents, true);
  });
});
for (const options of [{ nested: true }, { backwards: true }, { width: 80 }])
  test(`strict target-owner route supports ${JSON.stringify(options)}`, async () => {
    await withWheelRouteFixture(options, async (h) => {
      const r = await reveal(h.input, expected, h.options);
      assert.equal(r.sample.receivesEvents, true);
      assert.ok(r.wheels > 0 && r.wheels <= 40);
      if (options.nested) {
        assert.equal(h.state().rootOffset, 0);
        assert.ok(h.state().nestedOffset > 0);
      }
      if (options.backwards)
        assert.ok(h.calls.filter((c) => c[0] === 'wheel').every((c) => c[1] < 0));
      assert.equal(h.state().sidebarOffset, 0);
    });
  });
for (const options of [
  { fullSidebar: true },
  { overlay: 'fixed' },
  { overlay: 'sticky' },
  { noHit: true },
])
  test(`no matching unobstructed owner fails before input ${JSON.stringify(options)}`, async () => {
    await withWheelRouteFixture(options, async (h) => {
      await assert.rejects(reveal(h.input, expected, h.options), /no unobstructed wheel surface/);
      assert.equal(h.calls.length, 0);
    });
  });
test('wheel hover rechecks current native routing and fails before sending a misrouted wheel', async () => {
  const h = harness();
  const base = h.input.sample;
  let moved = false;
  h.input.move = async () => {
    moved = true;
  };
  h.input.sample = async () => ({
    ...(await base()),
    wheelPoint: moved ? null : { x: 16, y: 675 },
  });
  await assert.rejects(reveal(h.input, expected, h.options), /wheel route changed/);
  assert.equal(h.calls.length, 0);
});

for (const targetY of [690, 760])
  test(`nested action at y=${targetY} must scroll until its entire rectangle fits the clipped scrollport`, async () => {
    await withWheelRouteFixture({ nested: true, targetY }, async (h) => {
      const before = await h.input.sample();
      assert.equal(before.rect.y + before.rect.height < before.viewport.height, true);
      assert.equal(before.receivesEvents, targetY === 690);
      const result = await reveal(h.input, expected, h.options);
      assert.ok(result.wheels > 0);
      assert.equal(before.visibleBounds.bottom, 750);
      assert.ok(result.sample.rect.y >= 150);
      assert.ok(result.sample.rect.y + result.sample.rect.height <= 750);
      assert.equal(h.state().rootOffset, 0);
      assert.ok(h.state().nestedOffset > 0);
    });
  });

test('partial clipped rectangle cannot be accepted from center hit alone', async () => {
  const h = harness();
  h.setTop(690);
  const base = h.input.sample;
  h.input.sample = async () => ({
    ...(await base()),
    visibleBounds: { left: 0, top: 150, right: 320, bottom: 750 },
    wheelPoint: null,
  });
  await assert.rejects(reveal(h.input, expected, h.options), /no unobstructed wheel surface/);
  assert.equal(h.calls.length, 0);
});

test('every clipping ancestor contributes to the supported rectangular visibility intersection', async () => {
  await withWheelRouteFixture({ nested: true, outerClip: true, targetY: 600 }, async (h) => {
    const before = await h.input.sample();
    assert.equal(before.receivesEvents, true);
    const result = await reveal(h.input, expected, h.options);
    assert.ok(result.wheels > 0);
    assert.equal(result.sample.visibleBounds.bottom, 650);
    assert.ok(result.sample.rect.y + result.sample.rect.height <= 650);
    assert.ok(result.sample.rect.y >= 150);
  });
});
test('an action too wide for an outer clip fails without input', async () => {
  await withWheelRouteFixture({ nested: true, outerClip: true, outerNarrow: true }, async (h) => {
    await assert.rejects(reveal(h.input, expected, h.options), /cannot fit/);
    assert.equal(h.calls.length, 0);
  });
});
test('unsupported transformed clipping ancestry is fail-closed', async () => {
  await withWheelRouteFixture(
    { nested: true, outerClip: true, outerTransform: 'matrix(1,0,0,1,0,10)' },
    async (h) => {
      await assert.rejects(reveal(h.input, expected, h.options), /clipping bounds are unavailable/);
      assert.equal(h.calls.length, 0);
    }
  );
});
