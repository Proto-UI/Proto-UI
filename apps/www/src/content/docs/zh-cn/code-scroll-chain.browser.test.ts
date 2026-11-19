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
const out =
  process.env.PROTO_UI_CODE_SCROLL_EVIDENCE_DIR ??
  (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'code-scroll-chain')
    : '/tmp/pui-code-scroll-chain');
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
  receipt.browserVersion = browser.version();
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
      pointerHit: hit
        ? {
            tag: hit.tagName,
            className: hit.getAttribute('class'),
            belongsToSelectedPre: hit === p || p.contains(hit),
          }
        : null,
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
    const describe = (node: EventTarget | null) =>
      node instanceof Element
        ? {
            tag: node.tagName,
            className: node.getAttribute('class'),
            isSelectedPre: node === (window as any).__selectedScrollPre,
          }
        : { kind: node === window ? 'window' : node === document ? 'document' : 'other' };
    const trace = (event: WheelEvent, phase: string) => {
      if (!eventIds.has(event)) eventIds.set(event, ++eventOrdinal);
      const selected = (window as any).__selectedScrollPre as HTMLElement | undefined;
      const eventPath = event.composedPath();
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      (window as any).__codeScrollEventTrace.push({
        phase,
        eventId: eventIds.get(event),
        sequence: (window as any).__scrollInputSequence ?? null,
        eventTimeStamp: event.timeStamp,
        observedAt: performance.now(),
        trusted: event.isTrusted,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        target: describe(event.target),
        composedPath: eventPath.map(describe),
        hit: describe(hit),
        selectedInPath: !!selected && eventPath.includes(selected),
        selectedContainsTarget:
          !!selected && event.target instanceof Node && selected.contains(event.target),
        scrollY,
        selectedConnected: selected?.isConnected ?? false,
        selectedScrollTop: selected?.scrollTop ?? null,
        selectedRect: selected?.getBoundingClientRect().toJSON() ?? null,
        defaultPreventedAtObservation: event.defaultPrevented,
        cancelable: event.cancelable,
      });
    };
    addEventListener('wheel', (event) => trace(event, 'capture'), { passive: true, capture: true });
    addEventListener('wheel', (event) => trace(event, 'bubble'), { passive: true });
    addEventListener(
      'pointermove',
      (event) => {
        (window as any).__codeScrollEventTrace.push({
          phase: 'pointermove',
          eventTimeStamp: event.timeStamp,
          observedAt: performance.now(),
          clientX: event.clientX,
          clientY: event.clientY,
          target: describe(event.target),
          composedPath: event.composedPath().map(describe),
          scrollY,
        });
      },
      { passive: true, capture: true }
    );
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
    try {
      await save();
    } catch (error) {
      evidenceErrors.push(`save: ${String(error)}`);
    }
    try {
      const image = await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
      entry.screenshot = {
        file: `${name}.png`,
        sha256: createHash('sha256').update(image).digest('hex'),
      };
    } catch (error) {
      evidenceErrors.push(`screenshot: ${String(error)}`);
    }
    try {
      await context.close();
    } catch (error) {
      evidenceErrors.push(`close: ${String(error)}`);
    }
    entry.evidenceErrors = evidenceErrors;
    try {
      await save();
    } catch (error) {
      evidenceErrors.push(`final-save: ${String(error)}`);
    }
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
      entry.reason =
        'Current layout does not place the historical short PRE at (700,550); no wheel acceptance is claimed.';
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
function captureStageWheelEvents(trace: any[], start: number, end: number): any[] {
  return trace.filter(
    (row) => row.phase === 'capture' && row.eventTimeStamp >= start && row.eventTimeStamp <= end
  );
}
// Fixed Chromium source 129cef87f0307ff0fd3ac8a772f70de0e7a0c5d3:
// content/browser/renderer_host/input/mouse_wheel_phase_handler.h:500ms.
// 750ms is an explicit isolation margin, not proof of internal PhaseEnded.
function wheelQuietElapsed(sample: any, startedAt: number): number {
  return (
    sample.observedAt -
    Math.max(
      startedAt,
      sample.lastCaptureObservedAt ?? startedAt,
      sample.lastNativeTimeStamp ?? startedAt
    )
  );
}
async function waitForWheelQuiet(page: Page, entry: any, boundary: string) {
  const startedAt = await page.evaluate(() => performance.now());
  const record: any = { boundary, startedAt, requiredQuietMs: 750, samples: [], completed: false };
  (entry.causality.quietBoundaries ??= []).push(record);
  await expect
    .poll(
      async () => {
        const sample = await page.evaluate(() => {
          const captures = ((window as any).__codeScrollEventTrace ?? []).filter(
            (event: any) => event.phase === 'capture'
          );
          const last = captures.at(-1);
          return {
            observedAt: performance.now(),
            timeOrigin: performance.timeOrigin,
            captureCount: captures.length,
            lastCaptureObservedAt: last?.observedAt ?? null,
            lastNativeTimeStamp: last?.eventTimeStamp ?? null,
          };
        });
        record.samples.push(sample);
        await save();
        return wheelQuietElapsed(sample, startedAt);
      },
      { timeout: 2500, interval: 50 }
    )
    .toBeGreaterThanOrEqual(750);
  record.completed = true;
  await save();
}
/** Default: same physical PRE crossover, with all original acceptance gates.
 * The opt-in freshPolicy runs only one stage in its own fresh context.
 * scrollIntoView is setup only; all measured movement comes from mouse.wheel. */
async function verifyPassiveCausality(
  page: Page,
  pre: Locator,
  entry: any,
  freshPolicy?: { name: 'contain-negative' | 'product-auto'; expectedInitial?: any }
) {
  const original = await pre.evaluate((element) => ({
    value: (element as HTMLElement).style.getPropertyValue('overscroll-behavior-y'),
    priority: (element as HTMLElement).style.getPropertyPriority('overscroll-behavior-y'),
    hadStyle: element.hasAttribute('style'),
    samePre: element === (window as any).__selectedScrollPre,
  }));
  expect(original.samePre).toBe(true);
  const restore = () =>
    pre.evaluate((element, saved) => {
      const style = (element as HTMLElement).style;
      if (saved.value) style.setProperty('overscroll-behavior-y', saved.value, saved.priority);
      else style.removeProperty('overscroll-behavior-y');
      if (!saved.hadStyle && style.length === 0) element.removeAttribute('style');
    }, original);
  entry.causality = { original, stages: [], acceptance: false };
  let primary: unknown;
  try {
    for (const [stageIndex, stageName] of (freshPolicy
      ? [freshPolicy.name]
      : ['contain-negative', 'product-auto']
    ).entries()) {
      await waitForWheelQuiet(page, entry, 'before-' + stageName);
      if (stageName === 'contain-negative')
        await pre.evaluate((element) =>
          (element as HTMLElement).style.setProperty(
            'overscroll-behavior-y',
            'contain',
            'important'
          )
        );
      else await restore();
      // Re-establish the identical initial geometry before measuring either stage.
      await pre.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const initial = await facts(page, pre);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const stable = await facts(page, pre);
      for (const key of [
        'scrollY',
        'x',
        'y',
        'width',
        'height',
        'clientHeight',
        'scrollHeight',
        'overscrollY',
      ] as const)
        expect(stable[key]).toBe(initial[key]);
      expect(initial.scrollY).toBeGreaterThan(500);
      expect(initial.scrollHeight).toBe(initial.clientHeight);
      expect(initial.scrollTop).toBe(0);
      expect(initial.overscrollX).toBe('contain');
      expect(initial.overscrollY).toBe(stageName === 'contain-negative' ? 'contain' : 'auto');
      if (stageIndex === 1) {
        const negative = entry.causality.stages[0].initial;
        for (const key of [
          'scrollY',
          'x',
          'y',
          'width',
          'height',
          'clientHeight',
          'scrollHeight',
        ] as const)
          expect(initial[key]).toBe(negative[key]);
      }
      if (freshPolicy) {
        entry.pairInitial = {
          ...entry.pairIdentity,
          ...Object.fromEntries(
            (
              [
                'scrollY',
                'x',
                'y',
                'width',
                'height',
                'clientHeight',
                'scrollHeight',
                'scrollTop',
                'scrollLeft',
                'clientWidth',
                'scrollWidth',
                'overscrollX',
                'overflowX',
                'overflowY',
              ] as const
            ).map((key) => [key, initial[key]])
          ),
        };
        if (freshPolicy.expectedInitial)
          expect(entry.pairInitial).toEqual(freshPolicy.expectedInitial);
        await save();
      }
      const point = { x: initial.x + initial.width / 2, y: initial.y + initial.height / 2 };
      await page.mouse.move(point.x, point.y);
      const stage: any = { name: stageName, initial, inputs: [], readings: [] };
      entry.causality.stages.push(stage);
      for (let i = 0; i < 14; i++) {
        const input = await pre.evaluate(
          (element, args) => {
            const sequence = (args.stageIndex + 1) * 100 + args.i;
            (window as any).__scrollInputSequence = sequence;
            (window as any).__scrollPointerPoint = args.point;
            const hit = document.elementFromPoint(args.point.x, args.point.y);
            return {
              sequence,
              observedAt: performance.now(),
              timeOrigin: performance.timeOrigin,
              requestedDeltaX: 0,
              requestedDeltaY: -220,
              requestedClientX: args.point.x,
              requestedClientY: args.point.y,
              samePre: element === (window as any).__selectedScrollPre,
              connected: element.isConnected,
              rect: element.getBoundingClientRect().toJSON(),
              scrollY,
              preScrollTop: element.scrollTop,
              computedY: getComputedStyle(element).overscrollBehaviorY,
              hitInsidePre: hit === element || (!!hit && element.contains(hit)),
            };
          },
          { point, stageIndex, i }
        );
        stage.inputs.push(input);
        await save();
        expect(input.samePre && input.connected).toBe(true);
        expect(input.preScrollTop).toBe(0);
        expect(input.computedY).toBe(stageName === 'contain-negative' ? 'contain' : 'auto');
        if (i === 0 || stageName === 'contain-negative') expect(input.hitInsidePre).toBe(true);
        await page.mouse.wheel(0, -220);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const measured = await observe(entry, `${stageName}-wheel-${i}`, page, pre);
        stage.readings.push(measured);
        if (stageName === 'contain-negative') expect(measured.scrollY).toBe(initial.scrollY);
      }
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      stage.preDeliveryFinal = await observe(entry, `${stageName}-pre-delivery-final`, page, pre);
      stage.inputEndAt = await page.evaluate(() => performance.now());
      const firstInput = stage.inputs[0];
      // Wheel events may coalesce. Correlate the whole bounded input stage,
      // not a guessed one-event-per-command count or the mutable sequence tag.
      await expect
        .poll(
          async () => {
            const trace = await page.evaluate(() => (window as any).__codeScrollEventTrace);
            stage.events = captureStageWheelEvents(trace, firstInput.observedAt, stage.inputEndAt);
            await save();
            return stage.events.reduce((sum: number, event: any) => sum + event.deltaY, 0);
          },
          { timeout: 2000 }
        )
        .toBe(-220 * 14);
      stage.deliveryEndAt = await page.evaluate(() => performance.now());
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const final = await observe(entry, `${stageName}-post-delivery-final`, page, pre);
      stage.final = final;
      expect(stage.inputs).toHaveLength(14);
      expect(stage.events.length).toBeGreaterThan(0);
      for (const event of stage.events) {
        expect(event.trusted).toBe(true);
        expect(event.deltaMode).toBe(0);
        expect(event.deltaX).toBe(0);
        expect(event.deltaY).toBeLessThan(0);
        expect(event.clientX).toBe(Math.floor(firstInput.requestedClientX));
        expect(event.clientY).toBe(Math.floor(firstInput.requestedClientY));
        expect(event.eventTimeStamp).toBeGreaterThanOrEqual(firstInput.observedAt);
        expect(event.eventTimeStamp).toBeLessThanOrEqual(stage.inputEndAt);
        expect(event.observedAt).toBeGreaterThanOrEqual(event.eventTimeStamp);
        expect(event.observedAt).toBeLessThanOrEqual(stage.deliveryEndAt);
        expect(event.defaultPreventedAtObservation).toBe(false);
        if (stageName === 'contain-negative') {
          expect(event.selectedInPath && event.selectedContainsTarget).toBe(true);
          expect(event.scrollY).toBe(initial.scrollY);
        }
      }
      await save();
      if (stageName === 'contain-negative') expect(final.scrollY).toBe(initial.scrollY);
      else expect(final.scrollY).toBeLessThan(initial.scrollY - 500);
      stage.passed = true;
    }
  } catch (error) {
    primary = error;
    entry.causality.failure = String(error);
  } finally {
    try {
      await waitForWheelQuiet(page, entry, 'before-final-restore');
    } catch (error) {
      entry.causality.quietFailure = String(error);
      primary ??= error;
    }
    try {
      await restore();
      entry.causality.restored = await pre.evaluate((element) => ({
        value: (element as HTMLElement).style.getPropertyValue('overscroll-behavior-y'),
        priority: (element as HTMLElement).style.getPropertyPriority('overscroll-behavior-y'),
        hadStyle: element.hasAttribute('style'),
        samePre: element === (window as any).__selectedScrollPre,
      }));
      expect(entry.causality.restored).toEqual(original);
    } catch (error) {
      entry.causality.restoreFailure = String(error);
      primary ??= error;
    }
    try {
      await save();
    } catch (error) {
      primary ??= error;
    }
  }
  if (primary) throw primary;
  entry.causality.acceptance = freshPolicy === undefined;
  await save();
}
it('chains reverse wheel from an independently located real short PRE to the document', async () => {
  await run('short-code-product-chain', 1440, async (page, entry) => {
    await page.goto(baseUrl + quick, { waitUntil: 'networkidle' });
    await ready(page);
    const candidates = await page.locator('pre.proto-previewer__code').evaluateAll((elements) =>
      elements.map((element, index) => {
        const r = element.getBoundingClientRect();
        return {
          index,
          visible: element.checkVisibility(),
          documentTop: r.top + scrollY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      })
    );
    entry.shortCandidates = candidates;
    await save();
    const selected = candidates.find(
      (item) =>
        item.visible &&
        item.clientHeight > 0 &&
        item.scrollHeight === item.clientHeight &&
        item.documentTop > 1000
    );
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
      return {
        tag: actual?.tagName,
        className: actual?.getAttribute('class'),
        belongsToSelectedPre: actual === element || (actual !== null && element.contains(actual)),
      };
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
      entry.inputReadings.push(
        await pre.evaluate(
          (element, args) => {
            (window as any).__scrollInputSequence = args.i;
            const target = document.elementFromPoint(args.point.x, args.point.y);
            return {
              sequence: args.i,
              observedAt: performance.now(),
              timeOrigin: performance.timeOrigin,
              requestedDeltaX: 0,
              requestedDeltaY: -220,
              requestedClientX: args.point.x,
              requestedClientY: args.point.y,
              selectedPreIndex: [...document.querySelectorAll('pre')].indexOf(
                element as HTMLPreElement
              ),
              selectedIsObservedPre: element === (window as any).__selectedScrollPre,
              scrollY,
              selectedConnected: element.isConnected,
              selectedRect: element.getBoundingClientRect().toJSON(),
              selectedScrollTop: element.scrollTop,
              hitTag: target?.tagName,
              hitClassName: target?.getAttribute('class'),
              belongsToSelectedPre: target === element || (!!target && element.contains(target)),
            };
          },
          { i, point }
        )
      );
      await save();
      await page.mouse.wheel(0, -220);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await observe(entry, `short-product-wheel-${i}`, page, pre);
    }
    await expect
      .poll(() => page.evaluate(() => scrollY), { timeout: 2000 })
      .toBeLessThan(before.scrollY - 500);
    await observe(entry, 'short-after-wheel', page, pre);
    entry.lateTargetDiagnostic = {
      kind: 'observer-diagnostic',
      acceptance: false,
      expected: true,
      actual: entry.wheels.some(
        (wheel: any) => wheel.trusted && wheel.deltaY === -220 && wheel.preScrollTop === 0
      ),
      wheels: entry.wheels,
      trace: entry.eventTrace,
      inputs: entry.inputReadings,
    };
    try {
      // Preserve the original observation assertion and its actual mismatch.
      expect(
        entry.wheels.some(
          (wheel: any) => wheel.trusted && wheel.deltaY === -220 && wheel.preScrollTop === 0
        )
      ).toBe(true);
    } catch (error) {
      entry.lateTargetDiagnostic.failure = String(error);
    }
    await save();
    const diagnosticImage = await page.screenshot({ fullPage: true });
    await writeFile(join(out, 'short-passive-observer-diagnostic.png'), diagnosticImage);
    entry.lateTargetDiagnostic.screenshot = {
      file: 'short-passive-observer-diagnostic.png',
      sha256: createHash('sha256').update(diagnosticImage).digest('hex'),
    };
    await save();
    await verifyPassiveCausality(page, pre, entry);
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
    entry.scope =
      'Diagnostic only: this listener changes dispatch scheduling, not a replacement for passive product acceptance';
    const candidates = await page.locator('pre.proto-previewer__code').evaluateAll((elements) =>
      elements.map((element, index) => {
        const r = element.getBoundingClientRect();
        return {
          index,
          visible: element.checkVisibility(),
          documentTop: r.top + scrollY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      })
    );
    entry.shortCandidates = candidates;
    await save();
    const selected = candidates.find(
      (item) =>
        item.visible &&
        item.clientHeight > 0 &&
        item.scrollHeight === item.clientHeight &&
        item.documentTop > 1000
    );
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
      return {
        tag: actual?.tagName,
        className: actual?.getAttribute('class'),
        belongsToSelectedPre: actual === element || (actual !== null && element.contains(actual)),
      };
    }, point);
    await pre.evaluate((element, point) => {
      (window as any).__selectedScrollPre = element;
      (window as any).__scrollPointerPoint = point;
    }, point);
    // Test whether a non-passive listener changes default-scroll/dispatch ordering.
    // It never cancels input; this paired case is not the passive product path.
    await pre.evaluate((element) => {
      (window as any).__nonPassiveControl = [];
      element.addEventListener(
        'wheel',
        (event) => {
          const wheel = event as WheelEvent;
          (window as any).__nonPassiveControl.push({
            timeStamp: wheel.timeStamp,
            observedAt: performance.now(),
            trusted: wheel.isTrusted,
            deltaX: wheel.deltaX,
            deltaY: wheel.deltaY,
            clientX: wheel.clientX,
            clientY: wheel.clientY,
            targetInsideSelected:
              wheel.target === element ||
              (wheel.target instanceof Node && element.contains(wheel.target)),
            selectedInPath: wheel.composedPath().includes(element),
            scrollY,
            preScrollTop: element.scrollTop,
            defaultPrevented: wheel.defaultPrevented,
            cancelable: wheel.cancelable,
          });
        },
        { passive: false }
      );
    });
    entry.productHit = { point, ...hit };
    await save();
    expect(hit.belongsToSelectedPre).toBe(true);
    await page.mouse.move(point.x, point.y);
    entry.inputReadings = [];
    for (let i = 0; i < 14; i++) {
      entry.inputReadings.push(
        await pre.evaluate(
          (element, args) => {
            (window as any).__scrollInputSequence = args.i;
            const target = document.elementFromPoint(args.point.x, args.point.y);
            return {
              sequence: args.i,
              observedAt: performance.now(),
              timeOrigin: performance.timeOrigin,
              requestedDeltaX: 0,
              requestedDeltaY: -220,
              requestedClientX: args.point.x,
              requestedClientY: args.point.y,
              selectedPreIndex: [...document.querySelectorAll('pre')].indexOf(
                element as HTMLPreElement
              ),
              selectedIsObservedPre: element === (window as any).__selectedScrollPre,
              scrollY,
              selectedConnected: element.isConnected,
              selectedRect: element.getBoundingClientRect().toJSON(),
              selectedScrollTop: element.scrollTop,
              hitTag: target?.tagName,
              hitClassName: target?.getAttribute('class'),
              belongsToSelectedPre: target === element || (!!target && element.contains(target)),
            };
          },
          { i, point }
        )
      );
      await save();
      await page.mouse.wheel(0, -220);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await observe(entry, `short-product-wheel-${i}`, page, pre);
    }
    await expect
      .poll(() => page.evaluate(() => scrollY), { timeout: 2000 })
      .toBeLessThan(before.scrollY - 500);
    await observe(entry, 'short-after-wheel', page, pre);
    entry.controlDispatch = await page.evaluate(() => (window as any).__nonPassiveControl);
    await save();
    expect(
      entry.controlDispatch.some(
        (row: any) =>
          row.trusted &&
          row.deltaY === -220 &&
          row.selectedInPath &&
          row.targetInsideSelected &&
          row.scrollY === before.scrollY &&
          row.preScrollTop === 0 &&
          row.defaultPrevented === false
      )
    ).toBe(true);
    expect(
      entry.wheels.some(
        (wheel: any) => wheel.trusted && wheel.deltaY === -220 && wheel.preScrollTop === 0
      )
    ).toBe(true);
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
        return {
          point,
          tag: actual?.tagName,
          className: actual?.getAttribute('class'),
          belongsToSelectedPre: actual === element || (actual !== null && element.contains(actual)),
        };
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

// Opt-in diagnostic only; the original product case supplies no freshPolicy option.
// Static CSS counterfactual, not the historical parent build or full issue acceptance.
// The original crossover acceptance above remains unchanged and may still fail.
it('compares fresh static auto and original contain policy without prior wheel input', async () => {
  const pair: any = {
    kind: 'fresh-static-policy-pair',
    acceptance: false,
    productAcceptance: false,
    fullIssueAcceptance: false,
    coordinateDebt: 'Historical (700,550) replay remains independently required',
    negativeControl:
      'Candidate page with original vertical contain policy, not historical parent build',
    cases: [],
  };
  receipt.freshPolicyPair = pair;
  await save();
  for (const policy of ['contain-negative', 'product-auto'] as const) {
    await run('short-code-fresh-' + policy, 1440, async (page, entry) => {
      entry.kind = 'fresh-static-policy-diagnostic';
      entry.acceptance = false;
      entry.outcome = 'diagnostic-incomplete';
      pair.cases.push(entry.name);
      await page.goto(baseUrl + quick, { waitUntil: 'networkidle' });
      await ready(page);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const candidates = await page.locator('pre.proto-previewer__code').evaluateAll((elements) =>
        elements.map((element, index) => ({
          index,
          visible: element.checkVisibility(),
          documentTop: element.getBoundingClientRect().top + scrollY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }))
      );
      const selected = candidates.find(
        (item) =>
          item.visible &&
          item.clientHeight > 0 &&
          item.scrollHeight === item.clientHeight &&
          item.documentTop > 1000
      );
      expect(selected).toBeDefined();
      const pre = page.locator('pre.proto-previewer__code').nth(selected!.index);
      entry.pairIdentity = {
        index: selected!.index,
        documentTop: selected!.documentTop,
        textSha256: createHash('sha256')
          .update((await pre.textContent()) ?? '')
          .digest('hex'),
        environment: await pre.evaluate((element) => {
          const style = getComputedStyle(element);
          const owner = element.closest('[data-previewer-id]') as
            | (HTMLElement & { __previewer__?: { getCurrentRuntime(): string | null } })
            | null;
          return {
            route: location.pathname,
            width: innerWidth,
            height: innerHeight,
            runtime: owner?.__previewer__?.getCurrentRuntime() ?? null,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontsStatus: document.fonts.status,
          };
        }),
      };
      await pre.evaluate((element) => {
        (window as any).__selectedScrollPre = element;
      });
      const priorWheels = await page.evaluate(() =>
        ((window as any).__codeScrollEventTrace ?? []).filter(
          (event: any) => event.phase === 'capture'
        )
      );
      entry.priorWheelCount = priorWheels.length;
      expect(priorWheels).toHaveLength(0);
      await save();
      // Only this opt-in path runs one policy in the new context. No crossover.
      await verifyPassiveCausality(page, pre, entry, {
        name: policy,
        expectedInitial: pair.initial,
      });
      const stage = entry.causality.stages[0];
      expect(entry.causality.stages).toHaveLength(1);
      if (policy === 'contain-negative') pair.initial = entry.pairInitial;
      entry.meetsProductDisplacement = stage.final.scrollY < stage.initial.scrollY - 500;
      expect(entry.meetsProductDisplacement).toBe(policy === 'product-auto');
      entry.asyncTargetObservation = {
        acceptance: false,
        outsideSelected: stage.events.filter((event: any) => !event.selectedInPath).length,
        explanation: 'Post-scroll event targets are not proof of the initial PRE input target',
      };
      entry.outcome = 'diagnostic-observed';
      await save();
    });
  }
  pair.productAcceptance = true;
  await save();
}, 24_000);
