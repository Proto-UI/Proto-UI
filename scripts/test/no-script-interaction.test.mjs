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
