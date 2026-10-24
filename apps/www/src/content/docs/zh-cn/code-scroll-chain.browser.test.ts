// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { Browser, Page, Locator } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const quick = '/zh-cn/start-here/quick-start/';
const long = '/zh-cn/ui-libraries/base/transition/';
const out = process.env.PROTO_UI_CODE_SCROLL_EVIDENCE_DIR ?? '/tmp/pui-code-scroll-chain';
let browser: Browser;
let baseUrl: string;
const receipt: any = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  expectedRevision: process.env.EVIDENCE_HEAD_SHA ?? null,
  sources: [
    'apps/www/src/styles/code-surfaces.css',
    'apps/www/src/content/docs/zh-cn/code-scroll-chain.browser.test.ts',
  ].map((path) => ({
    path,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  })),
  cases: [],
};
beforeAll(async () => {
  if (receipt.expectedRevision) expect(receipt.revision).toBe(receipt.expectedRevision);
  baseUrl = await startServer(quick);
  browser = await launchBrowser();
}, 300_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});
async function save() {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'observations.json'), JSON.stringify(receipt, null, 2));
}
async function facts(page: Page, pre: Locator) {
  return pre.evaluate((e) => {
    const p = e as HTMLElement,
      s = getComputedStyle(p),
      r = p.getBoundingClientRect();
    const point = (window as any).__scrollPointerPoint;
    const hit = point ? document.elementFromPoint(point.x, point.y) : null;
    return {
      observedAt: performance.now(),
      pointerHit: hit ? { tag: hit.tagName, className: hit.getAttribute('class'), belongsToSelectedPre: hit === p || p.contains(hit) } : null,
      scrollY,
      scrollX,
      scrollTop: p.scrollTop,
      scrollLeft: p.scrollLeft,
      clientHeight: p.clientHeight,
      scrollHeight: p.scrollHeight,
      clientWidth: p.clientWidth,
      scrollWidth: p.scrollWidth,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      overscrollX: s.overscrollBehaviorX,
      overscrollY: s.overscrollBehaviorY,
      overflowX: s.overflowX,
      overflowY: s.overflowY,
    };
  });
}
async function ready(page: Page): Promise<void> {
  await page.waitForSelector('[data-code-panel-init="1"]:visible');
  await page.waitForFunction(() => customElements.get('wc-shadcn-button'));
  // CodePanel initializes before the async Previewer mount replaces its SSR pre.
  // Wait for that replacement before Playwright can retain an element to measure.
  await page.waitForFunction(() => {
    const shell = [...document.querySelectorAll<HTMLElement>('[data-code-shell]')].find((element) =>
      element.checkVisibility()
    );
    if (!shell) return false;
    const previewer = shell.closest('[data-previewer-id]') as
      | (HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } })
      | null;
    // CodeExample owns a CodePanel without an async Previewer runtime.
    const sources = document.querySelectorAll<HTMLElement>('[data-site-code-surface="frame"]');
    const visibleReady = [...sources]
      .filter((root) => root.checkVisibility())
      .every((root) => root.dataset.codeSurfaceView === 'ready');
    return visibleReady && (!previewer || Boolean(previewer.__previewer__?.getCurrentRuntime()));
  });
}

async function observe(entry: any, label: string, page: Page, pre: Locator) {
  entry.controlDispatch = await page.evaluate(() => (window as any).__nonPassiveControl ?? []);
  entry.wheels = await page.evaluate(() => (window as any).__codeScrollWheels ?? []);
  entry.eventTrace = await page.evaluate(() => (window as any).__codeScrollEventTrace ?? []);
  const value = await facts(page, pre);
  entry.observations.push({ label, ...value });
  await save();
  return value;
}
async function run(name: string, width: number, body: (page: Page, entry: any) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as any).__codeScrollWheels = [];
    (window as any).__codeScrollEventTrace = [];
    const eventIds = new WeakMap<Event, number>();
    let eventOrdinal = 0;
    const describe = (node: EventTarget | null) => node instanceof Element
      ? { tag: node.tagName, className: node.getAttribute('class'), isSelectedPre: node === (window as any).__selectedScrollPre }
      : { kind: node === window ? 'window' : node === document ? 'document' : 'other' };
    const trace = (event: WheelEvent, phase: string) => {
      if (!eventIds.has(event)) eventIds.set(event, ++eventOrdinal);
      const selected = (window as any).__selectedScrollPre as HTMLElement | undefined;
      const eventPath = event.composedPath();
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      (window as any).__codeScrollEventTrace.push({
        phase, eventId: eventIds.get(event), sequence: (window as any).__scrollInputSequence ?? null,
        eventTimeStamp: event.timeStamp, observedAt: performance.now(), trusted: event.isTrusted,
        clientX: event.clientX, clientY: event.clientY, deltaX: event.deltaX, deltaY: event.deltaY,
        target: describe(event.target), composedPath: eventPath.map(describe), hit: describe(hit),
        selectedInPath: !!selected && eventPath.includes(selected),
        selectedContainsTarget: !!selected && event.target instanceof Node && selected.contains(event.target),
        scrollY, selectedConnected: selected?.isConnected ?? false,
        selectedScrollTop: selected?.scrollTop ?? null, selectedRect: selected?.getBoundingClientRect().toJSON() ?? null,
        defaultPreventedAtObservation: event.defaultPrevented, cancelable: event.cancelable,
      });
    };
    addEventListener('wheel', event => trace(event, 'capture'), { passive: true, capture: true });
    addEventListener('wheel', event => trace(event, 'bubble'), { passive: true });
    addEventListener('pointermove', event => {
      (window as any).__codeScrollEventTrace.push({ phase: 'pointermove', eventTimeStamp: event.timeStamp,
        observedAt: performance.now(), clientX: event.clientX, clientY: event.clientY,
        target: describe(event.target), composedPath: event.composedPath().map(describe), scrollY });
    }, { passive: true, capture: true });
    addEventListener(
      'wheel',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const pre = target?.closest('pre');
        (window as any).__codeScrollWheels.push({
          trusted: event.isTrusted,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          target: target?.tagName,
          className: target?.getAttribute('class'),
          scrollY,
          preScrollTop: pre?.scrollTop,
          preScrollLeft: pre?.scrollLeft,
          defaultPreventedAtWindow: event.defaultPrevented,
        });
      },
      { passive: true }
    );
  });

  const entry: any = { name, width, observations: [], errors: [], blocked: [] };
  receipt.cases.push(entry);
  page.on('pageerror', (error) => entry.errors.push(String(error)));
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin === new URL(baseUrl).origin || ['data:', 'blob:'].includes(u.protocol))
      return route.continue();
    entry.blocked.push(u.href);
    return route.abort();
  });
  let primaryFailure: unknown;
  try {
    await body(page, entry);
    expect(entry.errors).toEqual([]);
    expect(entry.blocked).toEqual([]);
    if (entry.outcome !== 'not-reproduced') entry.passed = true;
  } catch (error) {
    primaryFailure = error;
    entry.failure = String(error);
    throw error;
  } finally {
    const evidenceErrors: string[] = [];
    try { await save(); } catch (error) { evidenceErrors.push(`save: ${String(error)}`); }
    try {
      const image = await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
      entry.screenshot = { file: `${name}.png`, sha256: createHash('sha256').update(image).digest('hex') };
    } catch (error) { evidenceErrors.push(`screenshot: ${String(error)}`); }
    try { await context.close(); } catch (error) { evidenceErrors.push(`close: ${String(error)}`); }
    entry.evidenceErrors = evidenceErrors;
    try { await save(); } catch (error) { evidenceErrors.push(`final-save: ${String(error)}`); }
    if (evidenceErrors.length) {
      console.error('Code scroll evidence errors', evidenceErrors);
      if (primaryFailure === undefined) throw new Error(evidenceErrors.join('\n'));
    }
  }
}
it('records the historical fixed-point replay separately from product acceptance', async () => {
  await run('original-short-code-reverse', 1440, async (page, entry) => {
    await page.goto(baseUrl + quick, { waitUntil: 'networkidle' });
    await ready(page);
    await page.evaluate(() => scrollTo(0, 2860));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(2860);
    const hit = await page.evaluate(() => {
      const e = document.elementFromPoint(700, 550);
      return { tag: e?.tagName, className: e?.getAttribute('class') };
    });
    entry.hitBefore = hit;
    entry.kind = 'historical-fixed-coordinate-diagnostic';
    entry.acceptance = false;
    if (hit.tag !== 'PRE' || !hit.className?.includes('proto-previewer__code')) {
      entry.outcome = 'not-reproduced';
      entry.reason = 'Current layout does not place the historical short PRE at (700,550); no wheel acceptance is claimed.';
      await save();
      return;
    }
    await save();
    expect(hit.tag).toBe('PRE');
    expect(hit.className).toContain('proto-previewer__code');
    const index = await page.evaluate(() =>
      [...document.querySelectorAll('pre.proto-previewer__code')].indexOf(
        document.elementFromPoint(700, 550)!
      )
    );
    const target = page.locator('pre.proto-previewer__code').nth(index);
    const before = await observe(entry, 'before-original-wheel', page, target);
    expect(before.scrollHeight).toBe(before.clientHeight);
    expect(before.overscrollX).toBe('contain');
    expect(before.overscrollY).toBe('auto');
    await page.mouse.move(700, 550);
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, -220);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await observe(entry, `wheel-${i}`, page, target);
    }
    await expect
      .poll(() => page.evaluate(() => scrollY), { timeout: 2000 })
      .toBeLessThan(before.scrollY - 500);
    await observe(entry, 'after-original-wheel', page, target);
  });
}, 45_000);
it('chains reverse wheel from an independently located real short PRE to the document', async () => {
  await run('short-code-product-chain', 1440, async (page, entry) => {
    await page.goto(baseUrl + quick, { waitUntil: 'networkidle' });
    await ready(page);
    const candidates = await page.locator('pre.proto-previewer__code').evaluateAll((elements) =>
      elements.map((element, index) => {
        const r = element.getBoundingClientRect();
        return { index, visible: element.checkVisibility(), documentTop: r.top + scrollY,
          scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
      })
    );
    entry.shortCandidates = candidates;
    await save();
    const selected = candidates.find((item) => item.visible && item.clientHeight > 0 &&
      item.scrollHeight === item.clientHeight && item.documentTop > 1000);
    expect(selected, 'A real short code block below the first screen is required').toBeDefined();
    const pre = page.locator('pre.proto-previewer__code').nth(selected!.index);
    await pre.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const before = await observe(entry, 'short-before-wheel', page, pre);
    expect(before.scrollY).toBeGreaterThan(500);
    expect(before.scrollHeight).toBe(before.clientHeight);
    expect(before.overscrollX).toBe('contain');
    expect(before.overscrollY).toBe('auto');
    const point = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    const hit = await pre.evaluate((element, point) => {
      const actual = document.elementFromPoint(point.x, point.y);
      return { tag: actual?.tagName, className: actual?.getAttribute('class'),
        belongsToSelectedPre: actual === element || (actual !== null && element.contains(actual)) };
    }, point);
    await pre.evaluate((element, point) => {
      (window as any).__selectedScrollPre = element;
      (window as any).__scrollPointerPoint = point;
    }, point);
    entry.productHit = { point, ...hit };
    await save();
    expect(hit.belongsToSelectedPre).toBe(true);
    await page.mouse.move(point.x, point.y);
    entry.inputReadings = [];
    for (let i = 0; i < 14; i++) {
      entry.inputReadings.push(await pre.evaluate((element, args) => {
        (window as any).__scrollInputSequence = args.i;
        const target = document.elementFromPoint(args.point.x, args.point.y);
        return { sequence: args.i, observedAt: performance.now(), timeOrigin: performance.timeOrigin,
          requestedDeltaX: 0, requestedDeltaY: -220, requestedClientX: args.point.x, requestedClientY: args.point.y,
          selectedPreIndex: [...document.querySelectorAll('pre')].indexOf(element as HTMLPreElement),
          selectedIsObservedPre: element === (window as any).__selectedScrollPre,
          scrollY, selectedConnected: element.isConnected,
          selectedRect: element.getBoundingClientRect().toJSON(), selectedScrollTop: element.scrollTop,
          hitTag: target?.tagName, hitClassName: target?.getAttribute('class'),
          belongsToSelectedPre: target === element || (!!target && element.contains(target)) };
      }, { i, point }));
      await save();
      await page.mouse.wheel(0, -220);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await observe(entry, `short-product-wheel-${i}`, page, pre);
    }
    await expect.poll(() => page.evaluate(() => scrollY), { timeout: 2000 })
      .toBeLessThan(before.scrollY - 500);
    await observe(entry, 'short-after-wheel', page, pre);
    expect(entry.wheels.some((wheel: any) => wheel.trusted && wheel.deltaY === -220 &&
      wheel.preScrollTop === 0)).toBe(true);
  });
}, 45_000);
// Paired diagnostic only. Keep the original passive case above unchanged.
// Chrome: https://developer.chrome.com/blog/scrolling-intervention-2/
// Mouse/Wheel moved from UI Events to Pointer Events:
// https://w3c.github.io/pointerevents/#wheel-event-transaction
// Fourteen Playwright wheel commands do not establish one physical gesture transaction.
it('diagnoses wheel scheduling with a non-passive observer without cancelling native scrolling', async () => {
  await run('short-code-non-passive-control', 1440, async (page, entry) => {
    await page.goto(baseUrl + quick, { waitUntil: 'networkidle' });
    await ready(page);
    entry.kind = 'non-passive-scheduling-control';
    entry.acceptance = false;
    entry.scope = 'Diagnostic only: this listener changes dispatch scheduling, not a replacement for passive product acceptance';
    const candidates = await page.locator('pre.proto-previewer__code').evaluateAll((elements) =>
      elements.map((element, index) => {
        const r = element.getBoundingClientRect();
        return { index, visible: element.checkVisibility(), documentTop: r.top + scrollY,
          scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
      })
    );
    entry.shortCandidates = candidates;
    await save();
    const selected = candidates.find((item) => item.visible && item.clientHeight > 0 &&
      item.scrollHeight === item.clientHeight && item.documentTop > 1000);
    expect(selected, 'A real short code block below the first screen is required').toBeDefined();
    const pre = page.locator('pre.proto-previewer__code').nth(selected!.index);
    await pre.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const before = await observe(entry, 'short-before-wheel', page, pre);
    expect(before.scrollY).toBeGreaterThan(500);
    expect(before.scrollHeight).toBe(before.clientHeight);
    expect(before.overscrollX).toBe('contain');
    expect(before.overscrollY).toBe('auto');
    const point = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    const hit = await pre.evaluate((element, point) => {
      const actual = document.elementFromPoint(point.x, point.y);
      return { tag: actual?.tagName, className: actual?.getAttribute('class'),
        belongsToSelectedPre: actual === element || (actual !== null && element.contains(actual)) };
    }, point);
    await pre.evaluate((element, point) => {
      (window as any).__selectedScrollPre = element;
      (window as any).__scrollPointerPoint = point;
    }, point);
    // Test whether a non-passive listener changes default-scroll/dispatch ordering.
    // It never cancels input; this paired case is not the passive product path.
    await pre.evaluate(element => {
      (window as any).__nonPassiveControl = [];
      element.addEventListener('wheel', event => {
        const wheel = event as WheelEvent;
        (window as any).__nonPassiveControl.push({
          timeStamp: wheel.timeStamp, observedAt: performance.now(), trusted: wheel.isTrusted,
          deltaX: wheel.deltaX, deltaY: wheel.deltaY, clientX: wheel.clientX, clientY: wheel.clientY,
          targetInsideSelected: wheel.target === element || wheel.target instanceof Node && element.contains(wheel.target),
          selectedInPath: wheel.composedPath().includes(element), scrollY,
          preScrollTop: element.scrollTop, defaultPrevented: wheel.defaultPrevented, cancelable: wheel.cancelable,
        });
      }, { passive: false });
    });
    entry.productHit = { point, ...hit };
    await save();
    expect(hit.belongsToSelectedPre).toBe(true);
    await page.mouse.move(point.x, point.y);
    entry.inputReadings = [];
    for (let i = 0; i < 14; i++) {
      entry.inputReadings.push(await pre.evaluate((element, args) => {
        (window as any).__scrollInputSequence = args.i;
        const target = document.elementFromPoint(args.point.x, args.point.y);
        return { sequence: args.i, observedAt: performance.now(), timeOrigin: performance.timeOrigin,
          requestedDeltaX: 0, requestedDeltaY: -220, requestedClientX: args.point.x, requestedClientY: args.point.y,
          selectedPreIndex: [...document.querySelectorAll('pre')].indexOf(element as HTMLPreElement),
          selectedIsObservedPre: element === (window as any).__selectedScrollPre,
          scrollY, selectedConnected: element.isConnected,
          selectedRect: element.getBoundingClientRect().toJSON(), selectedScrollTop: element.scrollTop,
          hitTag: target?.tagName, hitClassName: target?.getAttribute('class'),
          belongsToSelectedPre: target === element || (!!target && element.contains(target)) };
      }, { i, point }));
      await save();
      await page.mouse.wheel(0, -220);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await observe(entry, `short-product-wheel-${i}`, page, pre);
    }
    await expect.poll(() => page.evaluate(() => scrollY), { timeout: 2000 })
      .toBeLessThan(before.scrollY - 500);
    await observe(entry, 'short-after-wheel', page, pre);
    entry.controlDispatch = await page.evaluate(() => (window as any).__nonPassiveControl);
    await save();
    expect(entry.controlDispatch.some((row: any) => row.trusted && row.deltaY === -220 &&
      row.selectedInPath && row.targetInsideSelected && row.scrollY === before.scrollY &&
      row.preScrollTop === 0 && row.defaultPrevented === false)).toBe(true);
    expect(entry.wheels.some((wheel: any) => wheel.trusted && wheel.deltaY === -220 &&
      wheel.preScrollTop === 0)).toBe(true);
  });
}, 45_000);
for (const width of [1440, 320])
  it(`preserves long-code internal scrolling then document chaining at ${width}px`, async () => {
    await run(`long-code-${width}`, width, async (page, entry) => {
      await page.goto(baseUrl + long, { waitUntil: 'networkidle' });
      await ready(page);
      const panel = page.locator('[data-code-shell]:visible').first();
      await panel.locator('[data-code-toggle]').click();
      await expect.poll(() => panel.getAttribute('data-code-expanded')).toBe('true');
      const pre = panel.locator('pre.proto-previewer__code');
      await pre.evaluate((e) => {
        e.scrollIntoView({ block: 'center' });
        e.scrollTop = 0;
        e.scrollLeft = 0;
      });
      const before = await observe(entry, 'long-before-wheel', page, pre);
      // The actual production block has 144px of range. An 80px input must remain
      // strictly inside that range; two complete wheel deltas are not required.
      const internalDelta = 80;
      entry.internalDelta = internalDelta;
      expect(before.scrollHeight - before.clientHeight).toBeGreaterThan(internalDelta);
      expect(before.overscrollX).toBe('contain');
      expect(before.overscrollY).toBe('auto');
      const point = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
      entry.longHit = await pre.evaluate((element, point) => {
        const actual = document.elementFromPoint(point.x, point.y);
        return { point, tag: actual?.tagName, className: actual?.getAttribute('class'),
          belongsToSelectedPre: actual === element || (actual !== null && element.contains(actual)) };
      }, point);
      await save();
      expect(entry.longHit.belongsToSelectedPre).toBe(true);
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, internalDelta);
      await expect
        .poll(() => pre.evaluate((e) => e.scrollTop), { timeout: 2000 })
        .toBeGreaterThan(0);
      const inside = await observe(entry, 'long-internal-wheel', page, pre);
      expect(inside.scrollY).toBe(before.scrollY);
      expect(inside.scrollTop).toBeLessThan(inside.scrollHeight - inside.clientHeight);
      await pre.evaluate((e) => {
        e.scrollTop = e.scrollHeight;
      });
      const boundary = await observe(entry, 'long-at-bottom', page, pre);
      expect(boundary.scrollTop).toBe(boundary.scrollHeight - boundary.clientHeight);
      await page.mouse.wheel(0, 220);
      await expect
        .poll(() => page.evaluate(() => scrollY), { timeout: 2000 })
        .toBeGreaterThan(boundary.scrollY);
      await observe(entry, 'long-document-chain', page, pre);
      await pre.evaluate((e) => {
        e.scrollIntoView({ block: 'center' });
        e.scrollLeft = 0;
      });
      const horizontal = await observe(entry, 'horizontal-before', page, pre);
      expect(horizontal.scrollWidth).toBeGreaterThan(horizontal.clientWidth);
      await page.mouse.move(
        horizontal.x + horizontal.width / 2,
        horizontal.y + horizontal.height / 2
      );
      await page.mouse.wheel(80, 0);
      await expect
        .poll(() => pre.evaluate((e) => e.scrollLeft), { timeout: 2000 })
        .toBeGreaterThan(0);
      const after = await observe(entry, 'horizontal-after', page, pre);
      expect(after.scrollX).toBe(horizontal.scrollX);
      expect(after.scrollY).toBe(horizontal.scrollY);
    });
  }, 45_000);
