// @vitest-environment node
// Independent consumer oracle: browser natural content, viewport facts, and the
// accepted public cap definition. Never import Drawer normalization/math helpers.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Page, type Locator } from 'playwright-core';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { RUNTIMES, chromeExecutable, startServer, stopServer } from './browser-harness';

type Family = 'base' | 'shadcn' | 'brutalist';
const families: Family[] = ['base', 'shadcn', 'brutalist'];
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-drawer-intrinsic');
const routeFor = (family: Family) =>
  `/en/ui-libraries/${family === 'brutalist' ? 'brutalist/components' : family}/drawer/`;
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const json = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
let browser: Browser, baseUrl: string;
const scenarios = [
  { name: 'short-bottom16-omitted', side: 'bottom', root: 16, long: false, empty: false },
  { name: 'long-bottom32-empty', side: 'bottom', root: 32, long: true, empty: true },
  { name: 'short-top32-empty', side: 'top', root: 32, long: false, empty: true },
  { name: 'long-top16-omitted', side: 'top', root: 16, long: true, empty: false },
] as const;
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  const files = [
    'apps/www/src/content/docs/zh-cn/finf-drawer-intrinsic.browser.test.ts',
    ...['base', 'shadcn', 'brutalist'].map(
      (f) => `packages/prototypes/${f}/src/drawer/content.proto.ts`
    ),
    ...['snap.ts', 'handle.proto.ts', 'types.ts'].map(
      (f) => `packages/prototypes/base/src/drawer/${f}`
    ),
  ];
  const hashes = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
      ])
    )
  );
  await json('drawer-intrinsic-source.json', {
    revision,
    tree,
    hashes,
    expectedCases: 64,
    oracle:
      'same live composed DOM measured with vertical constraints temporarily released, exact restoration verified, then clamped by independently computed viewport cap; Base A; Shadcn/Neo max(0,A-6*rootText)',
    phase: 'planned; individual terminal receipts prove execution',
  });
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
    throw new Error('Official Actions only. No local native browser launch.');
  expect(revision).toBe(process.env.CANDIDATE_SHA);
  expect(execFileSync('git', ['status', '--porcelain']).toString().trim()).toBe('');
  // Never accept a possibly stale external app server as current-tree evidence.
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error('This fixture requires its own current-tree server.');
  baseUrl = await startServer('/');
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
}, 180_000);
afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

type Options = {
  family: Family;
  runtime: (typeof RUNTIMES)[number];
  side: 'top' | 'bottom';
  root: number;
  long: boolean;
  empty?: boolean;
  snap?: boolean;
  minimum?: number;
  controlled?: boolean;
};
async function mount(page: Page, options: Options) {
  await page.goto(baseUrl + routeFor(options.family), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`[data-demo-id="demo-${options.family}-drawer"]`);
  await page.evaluate(async (options) => {
    document.documentElement.style.fontSize = `${options.root}px`;
    const load = new Function('url', 'return import(url)') as (url: string) => Promise<any>;
    const { renderDemo } = await load('/src/components/PrototypePreviewer/demo-renderer.ts');
    const { loadPrototypes } = await load(
      '/src/components/PrototypePreviewer/prototype-modules.ts'
    );
    const { collectPrototypeIds } = await load('/src/components/PrototypePreviewer/demo-types.ts');
    const proto = (part: string, children: any[] = [], props: Record<string, unknown> = {}) => ({
      kind: 'proto',
      prototypeId: `${options.family}-drawer-${part}`,
      ref: `intrinsic-${part}`,
      props,
      ...(part === 'content' && options.family !== 'base' ? { previewTheme: 'portal' } : {}),
      children,
    });
    const props: Record<string, unknown> = {
      side: options.side,
      enterDuration: 0,
      leaveDuration: 0,
    };
    if (options.empty) props.snapPoints = [];
    if (options.snap) {
      props.snapPoints = [0.5, 1];
      props.defaultSnapPoint = 1;
    }
    if (options.minimum !== undefined)
      props.minExtent = { unit: 'logical', value: options.minimum };
    const requests: unknown[] = [];
    const demo: any = {
      type: 'demo',
      root: proto(
        'root',
        [
          proto('trigger', ['Open intrinsic fixture']),
          proto('mask'),
          proto(
            'content',
            [
              proto('handle', [], { a11yLabel: 'Fixture resize' }),
              proto('title', ['Intrinsic acceptance']),
              {
                kind: 'box',
                ref: 'intrinsic-payload',
                attrs: { style: `height:${options.long ? 1600 : 72}px; flex-shrink:0` },
                children: ['Owned test content'],
              },
              proto('close', ['Close fixture']),
            ],
            props
          ),
        ],
        options.controlled
          ? { open: true, a11yLabel: 'Intrinsic fixture' }
          : { a11yLabel: 'Intrinsic fixture' }
      ),
      setup(context: any) {
        (window as any).__drawerFixtureApi = context.api;
        context.api.setProps('intrinsic-root', {
          onOpenChange: (detail: unknown) => requests.push(detail),
        });
      },
    };
    const host = document.createElement('div');
    host.dataset.intrinsicFixture = '';
    document.body.append(host);
    let surface: any;
    let expectedPortalTheme: Record<string, string> = {};
    if (options.family !== 'base') {
      const { createRuntimePreviewSurface } = await load(
        '/src/components/PrototypePreviewer/runtime-preview-surface.ts'
      );
      const { resolveProjectionThemeSurfaceStyle } = await load(
        '/src/components/PrototypePreviewer/projection-theme.ts'
      );
      const previewer = document.querySelector(`[data-demo-id="demo-${options.family}-drawer"]`);
      expectedPortalTheme = resolveProjectionThemeSurfaceStyle(options.family, previewer);
      surface = createRuntimePreviewSurface(
        demo,
        options.family,
        expectedPortalTheme,
        options.runtime
      );
    }
    const selected = surface?.demo ?? demo;
    const ids = new Set<string>();
    collectPrototypeIds(selected.root, ids);
    await loadPrototypes([...ids]);
    const view = await renderDemo({ host, demo: selected, runtime: options.runtime });
    await surface?.ready;
    (window as any).__drawerFixture = { view, requests, expectedPortalTheme };
    await document.fonts.ready;
  }, options);
  if (!options.controlled) await page.locator('[data-demo-ref="intrinsic-trigger"]').click();
  const panel = page.locator('[data-demo-ref="intrinsic-content"]');
  await expect.poll(() => panel.isVisible()).toBe(true);
  await page.waitForTimeout(100);
  return panel;
}
// Measure the same real composed DOM before any input. The independent browser
// CSS sizing experiment removes only vertical constraints, then restores the
// exact inline declaration. It creates no surrogate or second Drawer owner and
// therefore preserves real slots, shadow trees, inheritance, fonts, and children.
// Actual constrained geometry is sampled BEFORE this test-only intervention;
// subsequent scroll/drag observations never repeat it or write scrollTop.
async function measureNatural(panel: Locator) {
  return panel.evaluate(async (element) => {
    const node = element as HTMLElement;
    const rect = () => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const before = rect(),
      styleBefore = node.getAttribute('style');
    const scrollBefore = { top: node.scrollTop, left: node.scrollLeft };
    const readPublicState = () => {
      const api = (window as any).__drawerFixtureApi;
      return Object.fromEntries(
        Object.entries({
          root: ['open'],
          content: [
            'open',
            'snapPoint',
            'dragging',
            'dragProgress',
            'offsetPercentage',
            'extentValid',
          ],
          handle: ['disabled', 'focused'],
        }).flatMap(([part, keys]) => {
          const exposes = api.getExposes(`intrinsic-${part}`);
          return keys.map((key) => {
            if (typeof exposes?.[key]?.get !== 'function')
              throw new Error(`Missing public state: ${part}.${key}`);
            return [`${part}.${key}`, exposes[key].get()];
          });
        })
      );
    };
    const stateBefore = readPublicState();
    const requestsBefore = JSON.stringify((window as any).__drawerFixture.requests);
    const focusBefore = document.activeElement;
    const css = getComputedStyle(node);
    const fontBefore = { family: css.fontFamily, size: css.fontSize, lineHeight: css.lineHeight };
    let natural = NaN,
      widthDuring = NaN;
    try {
      // Keep precisely the current inline-size and all content presentation.
      // Only the public CSS block-size constraints and opposing edge can change.
      node.style.setProperty('width', css.width, 'important');
      for (const [key, value] of Object.entries({
        height: 'auto',
        'min-height': '0',
        'max-height': 'none',
        top: '0',
        bottom: 'auto',
      }))
        node.style.setProperty(key, value, 'important');
      const free = rect();
      natural = free.height;
      widthDuring = free.width;
    } finally {
      if (styleBefore === null) node.removeAttribute('style');
      else node.setAttribute('style', styleBefore);
    }
    const immediate = rect();
    // Give the genuine host observers two rendering turns to prove that the
    // temporary test declarations did not become a persistent owner mutation.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const settled = rect(),
      restoredCss = getComputedStyle(node);
    (window as any).__drawerNatural = natural;
    return {
      natural,
      before,
      widthDuring,
      immediate,
      settled,
      styleRestored: node.getAttribute('style') === styleBefore,
      scrollBefore,
      scrollAfter: { top: node.scrollTop, left: node.scrollLeft },
      focusRestored: document.activeElement === focusBefore,
      stateBefore,
      stateAfter: readPublicState(),
      requestsBefore,
      requestsAfter: JSON.stringify((window as any).__drawerFixture.requests),
      fontBefore,
      fontAfter: {
        family: restoredCss.fontFamily,
        size: restoredCss.fontSize,
        lineHeight: restoredCss.lineHeight,
      },
    };
  });
}
async function geometry(panel: Locator) {
  return panel.evaluate((element) => {
    const node = element as HTMLElement,
      css = getComputedStyle(node),
      box = node.getBoundingClientRect();
    const natural = (window as any).__drawerNatural as number;
    return {
      x: box.x,
      y: box.y,
      height: box.height,
      bottom: box.bottom,
      natural,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      scrollTop: node.scrollTop,
      overflowY: css.overflowY,
      rootText: parseFloat(getComputedStyle(document.documentElement).fontSize),
      available: window.visualViewport?.height ?? innerHeight,
      viewportOffset: window.visualViewport?.offsetTop ?? 0,
    };
  });
}
function assertGeometry(actual: Awaited<ReturnType<typeof geometry>>, options: Options) {
  const cap = Math.max(0, actual.available - (options.family === 'base' ? 0 : 6 * options.root));
  const expected = options.snap
    ? cap
    : Math.min(cap, Math.max(options.minimum ?? 0, actual.natural));
  expect(Math.abs(actual.height - expected)).toBeLessThanOrEqual(2);
  expect(actual.rootText).toBe(options.root);
  expect(actual.y).toBeGreaterThanOrEqual(actual.viewportOffset - 1);
  expect(actual.bottom).toBeLessThanOrEqual(actual.viewportOffset + actual.available + 1);
  if (options.side === 'top')
    expect(Math.abs(actual.y - actual.viewportOffset)).toBeLessThanOrEqual(1);
  else
    expect(Math.abs(actual.bottom - actual.viewportOffset - actual.available)).toBeLessThanOrEqual(
      1
    );
  return { cap, expected };
}
async function visibleClose(page: Page, panel: Locator, long: boolean) {
  if (long) {
    expect(await panel.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await panel.hover();
    await page.mouse.wheel(0, 2400);
    await expect.poll(() => panel.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  }
  const close = page.locator('[data-demo-ref="intrinsic-close"]');
  await close.scrollIntoViewIfNeeded();
  expect(
    await close.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })
  ).toBe(true);
  return close;
}
async function runCase(
  name: string,
  options: Options,
  body: (page: Page, panel: Locator, samples: unknown[]) => Promise<void>
) {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 } });
  const samples: unknown[] = [];
  const pageErrors: string[] = [];
  const diagnostics: { type: string; text: string }[] = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type()))
      diagnostics.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (failure) => pageErrors.push(failure.stack ?? String(failure)));
  let result = 'failed',
    error: string | undefined;
  try {
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        ['data:', 'blob:'].includes(url.protocol)
        ? route.continue()
        : route.abort();
    });
    const panel = await mount(page, options);
    const theme = await panel.evaluate((element) => {
      const expected = (window as any).__drawerFixture.expectedPortalTheme as Record<
        string,
        string
      >;
      const css = getComputedStyle(element);
      return Object.entries(expected).map(([property, value]) => ({
        property,
        expected: value.trim(),
        actual: css.getPropertyValue(property).trim(),
      }));
    });
    samples.push({ stage: 'actual-portal-theme', tokens: theme });
    if (options.family !== 'base') expect(theme.length).toBeGreaterThan(0);
    for (const token of theme) expect(token.actual, token.property).toBe(token.expected);
    const diagnosticsBeforeMeasurement = diagnostics.length;
    const naturalReceipt = await measureNatural(panel);
    samples.push({ stage: 'live-natural-sizing-experiment', ...naturalReceipt });
    expect(
      diagnostics.slice(diagnosticsBeforeMeasurement),
      'Sizing instrumentation must not create diagnostics'
    ).toEqual([]);
    expect(naturalReceipt.styleRestored).toBe(true);
    expect(naturalReceipt.focusRestored).toBe(true);
    expect(naturalReceipt.stateAfter).toEqual(naturalReceipt.stateBefore);
    expect(naturalReceipt.requestsAfter).toBe(naturalReceipt.requestsBefore);
    expect(naturalReceipt.scrollAfter).toEqual(naturalReceipt.scrollBefore);
    expect(naturalReceipt.fontAfter).toEqual(naturalReceipt.fontBefore);
    expect(Math.abs(naturalReceipt.widthDuring - naturalReceipt.before.width)).toBeLessThanOrEqual(
      0.5
    );
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs(naturalReceipt.immediate[key] - naturalReceipt.before[key])
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(naturalReceipt.settled[key] - naturalReceipt.before[key])
      ).toBeLessThanOrEqual(0.5);
    }
    expect(naturalReceipt.natural).toBeGreaterThan(0);
    if (options.long) expect(naturalReceipt.natural).toBeGreaterThanOrEqual(1600);
    const initial = await geometry(panel);
    const oracle = assertGeometry(initial, options);
    if (!options.long) expect(naturalReceipt.natural).toBeLessThan(oracle.cap);
    samples.push({ stage: 'initial', ...initial, oracle });
    // A real safety-fact change demonstrates that the host still owns its
    // layout writes after instrumentation; static equality alone is insufficient.
    for (const height of [720, 800]) {
      await page.setViewportSize({ width: 640, height });
      const cap = Math.max(0, height - (options.family === 'base' ? 0 : 6 * options.root));
      const expected = options.snap
        ? cap
        : Math.min(cap, Math.max(options.minimum ?? 0, naturalReceipt.natural));
      await expect
        .poll(async () => {
          const current = await geometry(panel);
          return Math.max(
            Math.abs(current.height - expected),
            Math.abs(
              (options.side === 'top' ? current.y : current.bottom) -
                (options.side === 'top' ? 0 : height)
            )
          );
        })
        .toBeLessThanOrEqual(2);
      expect(
        await panel.evaluate((node) => parseFloat(getComputedStyle(node).maxHeight))
      ).toBeCloseTo(cap, 4);
      samples.push({
        stage: 'post-measurement-ownership-resize',
        viewportHeight: height,
        ...(await geometry(panel)),
      });
    }
    expect(
      diagnostics.slice(diagnosticsBeforeMeasurement),
      'Ownership probe must not create diagnostics'
    ).toEqual([]);
    await page.screenshot({
      path: path.join(output, `${name}-${revision.slice(0, 12)}.png`),
      fullPage: false,
    });
    await body(page, panel, samples);
    // Observe asynchronous lifecycle errors from the final dismissal as well.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    expect(pageErrors, 'Unhandled page errors are blocking evidence').toEqual([]);
    expect(
      diagnostics.filter((item) => item.type === 'error'),
      'Console errors are blocking evidence'
    ).toEqual([]);
    result = 'passed';
  } catch (failure) {
    error = String(failure);
    await page
      .screenshot({ path: path.join(output, `${name}-${revision.slice(0, 12)}-failure.png`) })
      .catch(() => {});
    throw failure;
  } finally {
    await json(`${name}.json`, {
      revision,
      tree,
      options,
      result,
      error,
      pageErrors,
      diagnostics,
      samples,
    });
    await page.close();
  }
}
for (const runtime of RUNTIMES)
  for (const family of families) {
    for (const scenario of scenarios)
      it(`${family}/${runtime}/${scenario.name}`, async () => {
        const options = { family, runtime, ...scenario };
        await runCase(
          `${family}-${runtime}-${scenario.name}`,
          options,
          async (page, panel, samples) => {
            const handle = page.locator('[data-demo-ref="intrinsic-handle"]');
            expect(await handle.getAttribute('role')).toBe('presentation');
            expect(await handle.getAttribute('aria-hidden')).toBe('true');
            expect(await handle.getAttribute('aria-valuenow')).toBeNull();
            expect(await handle.evaluate((node) => (node as HTMLElement).tabIndex)).toBeLessThan(0);
            const close = await visibleClose(page, panel, scenario.long);
            samples.push({ stage: 'reachable-close', ...(await geometry(panel)) });
            if (scenario.long)
              await page.screenshot({
                path: path.join(
                  output,
                  `${family}-${runtime}-${scenario.name}-${revision.slice(0, 12)}-scrolled-close.png`
                ),
              });
            await close.click();
            await expect.poll(() => panel.isVisible()).toBe(false);
            await page.locator('[data-demo-ref="intrinsic-trigger"]').focus();
            await page.keyboard.press('Enter');
            await expect.poll(() => panel.isVisible()).toBe(true);
            await page.keyboard.press('Escape');
            await expect.poll(() => panel.isVisible()).toBe(false);
          }
        );
      }, 90_000);
    it(`${family}/${runtime}/explicit-snap-keyboard`, async () => {
      const options: Options = {
        family,
        runtime,
        root: 16,
        side: 'bottom',
        long: true,
        snap: true,
      };
      await runCase(`${family}-${runtime}-explicit-snap`, options, async (page, panel, samples) => {
        const handle = page.locator('[data-demo-ref="intrinsic-handle"]');
        expect(await handle.getAttribute('role')).toBe('separator');
        await handle.focus();
        await page.keyboard.press('Home');
        const cap = 800 - (family === 'base' ? 0 : 96);
        await expect
          .poll(async () => Math.abs((await geometry(panel)).height - cap / 2))
          .toBeLessThanOrEqual(2);
        expect(await handle.getAttribute('aria-valuenow')).toBe('50');
        samples.push({ stage: 'half', ...(await geometry(panel)) });
        await page.keyboard.press('End');
        await expect
          .poll(async () => Math.abs((await geometry(panel)).height - cap))
          .toBeLessThanOrEqual(2);
        await (await visibleClose(page, panel, true)).click();
        await expect.poll(() => panel.isVisible()).toBe(false);
      });
    }, 90_000);
  }
for (const runtime of RUNTIMES)
  it(`base/${runtime}/minimum-controlled-drag-cancel`, async () => {
    const options: Options = {
      family: 'base',
      runtime,
      root: 16,
      side: 'bottom',
      long: false,
      minimum: 320,
      controlled: true,
    };
    await runCase(
      `base-${runtime}-minimum-controlled-drag-cancel`,
      options,
      async (page, panel, samples) => {
        await page.evaluate(() =>
          document.addEventListener(
            'pointerdown',
            (event) => {
              (window as any).__drawerPointerId = event.pointerId;
            },
            true
          )
        );
        const start = await geometry(panel),
          handle = page.locator('[data-demo-ref="intrinsic-handle"]');
        const rect = await handle.boundingBox();
        expect(rect).not.toBeNull();
        await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
        await page.mouse.down();
        await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + 100, { steps: 8 });
        const during = await geometry(panel);
        expect(during.y).toBeGreaterThan(start.y + 20);
        expect(Math.abs(during.height - start.height)).toBeLessThanOrEqual(2);
        // Native pointercancel is synthesized at the physical event boundary, never
        // through private Drawer methods; receipt explicitly identifies this input.
        await handle.dispatchEvent('pointercancel', {
          pointerId: await page.evaluate(() => (window as any).__drawerPointerId),
          pointerType: 'mouse',
          bubbles: true,
        });
        await page.mouse.up();
        await expect
          .poll(async () => Math.abs((await geometry(panel)).y - start.y))
          .toBeLessThanOrEqual(2);
        samples.push({ stage: 'pointercancel-restored', ...(await geometry(panel)) });
        await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
        await page.mouse.down();
        await page.mouse.move(rect!.x + rect!.width / 2, 799, { steps: 12 });
        await page.mouse.up();
        await expect
          .poll(() =>
            page.evaluate(() =>
              (window as any).__drawerFixture.requests.some((r: any) => r.open === false)
            )
          )
          .toBe(true);
        expect(await panel.isVisible()).toBe(true);
        await expect
          .poll(async () => Math.abs((await geometry(panel)).y - start.y))
          .toBeLessThanOrEqual(2);
        samples.push({ stage: 'controlled-rejection-restored', ...(await geometry(panel)) });
        await (await visibleClose(page, panel, false)).click();
        expect(await panel.isVisible()).toBe(true);
        await page.evaluate(() =>
          (window as any).__drawerFixtureApi.setProps('intrinsic-root', { open: false })
        );
        await expect.poll(() => panel.isVisible()).toBe(false);
      }
    );
  }, 90_000);
