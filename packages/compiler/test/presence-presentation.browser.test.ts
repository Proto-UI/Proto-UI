// @vitest-environment node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '../../../apps/www/node_modules/playwright-core';
import { chromeExecutable } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { buildPhysicalPresentationBrowserFixture } from './shader-browser-fixture';
import type { createPresenceBrowserFixture } from './presence-browser-consumer';

declare global {
  interface Window {
    presenceNative: { fixture: ReturnType<typeof createPresenceBrowserFixture> };
  }
}
let browser: Browser, fixture: Awaited<ReturnType<typeof buildPhysicalPresentationBrowserFixture>>;
beforeAll(async () => {
  fixture = await buildPhysicalPresentationBrowserFixture({
    name: 'presence-presentation',
    entry: 'packages/compiler/test/fixtures/presence-presentation-owner.proto.ts',
    consumer: 'packages/compiler/test/presence-browser-consumer.ts',
    factory: 'createPresenceBrowserFixture',
    global: 'presenceNative',
    harness: ['packages/compiler/test/presence-presentation.browser.test.ts'],
    scope:
      'Same authored asTransition plus nominal typed side selection, actual Runtime and four native Web imports. Chromium RAF/computed CSS/geometry evidence; not full Drawer, physical assistive technology, or non-Web presentation acceptance.',
  });
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
  });
  await writeFile(path.join(fixture.evidenceDir, 'browser-version.txt'), browser.version());
}, 120_000);
afterAll(async () => {
  await browser?.close();
});

async function run(
  name: string,
  reducedMotion: 'reduce' | 'no-preference',
  body: (page: Page, observations: unknown[]) => Promise<void>
) {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 }, reducedMotion });
  page.setDefaultTimeout(5_000);
  const errors: string[] = [],
    blocked: string[] = [],
    observations: unknown[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let failure: unknown;
  try {
    await page.route('**/*', (route) => {
      blocked.push(route.request().url());
      return route.abort();
    });
    await page.setContent(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Presence native consumer</title><style>body{font:16px system-ui;padding:32px}#consumer{margin-left:300px}#consumer>*{display:block;box-sizing:border-box;width:240px;height:96px;padding:12px;border:2px solid #1264a3;background:#e5f3ff}</style></head><body><h1>Authored Transition presentation</h1></body></html>'
    );
    await page.addScriptTag({ content: fixture.bundle });
    await body(page, observations);
    expect(errors).toEqual([]);
    expect(blocked).toEqual([]);
  } catch (error) {
    failure = error;
  } finally {
    try {
      observations.push({
        stage: 'terminal',
        value: await page.evaluate(() => window.presenceNative?.fixture.read()),
      });
      await page.screenshot({ path: path.join(fixture.evidenceDir, name + '.png') });
      await page.evaluate(() => window.presenceNative?.fixture.close());
    } catch (error) {
      failure ??= error;
    }
    await writeFile(
      path.join(fixture.evidenceDir, name + '.json'),
      JSON.stringify(
        {
          head: fixture.head,
          buildSha256: fixture.buildSha256,
          name,
          outcome: failure ? 'FAIL' : 'PASS',
          observations,
          errors,
          blocked,
          failure: failure instanceof Error ? failure.stack : failure,
        },
        null,
        2
      ) + '\n'
    );
    await page.close();
  }
  if (failure) throw failure;
}
const state = (page: Page, phase: string) =>
  page.waitForFunction(
    (expected) => window.presenceNative.fixture.read().phase === expected,
    phase
  );
const cases = (['react', 'vue', 'vue2', 'wc'] as const).flatMap((target) =>
  (['runtime', 'compiled'] as const).map((execution) => ({ target, execution }))
);
it.each(cases)(
  '$target $execution displays real slide/fade frames, reverses from its displayed sample, and retires',
  async (scenario) => {
    await run(
      `${scenario.target}-${scenario.execution}`,
      'no-preference',
      async (page, observations) => {
        await page.evaluate(
          (value) => window.presenceNative.fixture.mount(value.target, value.execution),
          scenario
        );
        expect(await page.evaluate(() => window.presenceNative.fixture.read())).toMatchObject({
          phase: 'closed',
          present: false,
        });
        await page.evaluate(() => {
          window.presenceNative.fixture.startTrace();
        });
        await page.evaluate(() => window.presenceNative.fixture.setProps({ open: true }));
        await state(page, 'entered');
        const enter = await page.evaluate(() => window.presenceNative.fixture.stopTrace());
        observations.push({ stage: 'enter', frames: enter });
        const samples = enter.filter(
          (sample) =>
            sample.phase === 'entering' &&
            sample.opacity !== null &&
            sample.opacity > 0 &&
            sample.opacity < 1
        );
        expect(samples.length).toBeGreaterThan(1);
        expect(enter.some((sample) => sample.phase === 'entering' && sample.opacity === 0)).toBe(
          true
        );
        for (const sample of samples) {
          // Transformed DOMRect edges retain subpixel floating-point rounding.
          expect(sample.width).toBeCloseTo(240, 3);
          expect(sample.translate).toBeLessThan(0);
          expect(Math.abs(sample.translate! - (sample.opacity! - 1) * sample.width!)).toBeLessThan(
            1
          );
        }
        expect(await page.evaluate(() => window.presenceNative.fixture.read())).toMatchObject({
          phase: 'entered',
          present: true,
          opacity: 1,
          translate: 0,
          inlineOpacity: '',
          inlineTranslate: '',
        });
        await page.evaluate(() => {
          window.presenceNative.fixture.startTrace();
        });
        await page.evaluate(() => window.presenceNative.fixture.setProps({ open: false }));
        await page.waitForFunction(() => {
          const value = window.presenceNative.fixture.read();
          return (
            value.phase === 'leaving' &&
            value.opacity !== null &&
            value.opacity > 0.2 &&
            value.opacity < 0.8
          );
        });
        const reversal = await page.evaluate(async () => {
          const before = window.presenceNative.fixture.read();
          await window.presenceNative.fixture.setProps({ open: true });
          return { before, after: window.presenceNative.fixture.read() };
        });
        observations.push({ stage: 'reverse', ...reversal });
        expect(reversal.before.present).toBe(true);
        expect(reversal.after.present).toBe(true);
        expect(Math.abs(reversal.after.opacity! - reversal.before.opacity!)).toBeLessThan(0.05);
        await state(page, 'entered');
        const reverseFrames = await page.evaluate(() => window.presenceNative.fixture.stopTrace());
        observations.push({ stage: 'reverse-frames', frames: reverseFrames });
        expect(reverseFrames.every((sample) => sample.present)).toBe(true);
        await page.evaluate(() => window.presenceNative.fixture.setProps({ side: 'right' }));
        await page.evaluate(() => {
          window.presenceNative.fixture.startTrace();
        });
        await page.evaluate(() => window.presenceNative.fixture.setProps({ open: false }));
        await state(page, 'closed');
        const leave = await page.evaluate(() => window.presenceNative.fixture.stopTrace());
        observations.push({ stage: 'selected-right-leave', frames: leave });
        const right = leave.filter(
          (sample) =>
            sample.phase === 'leaving' &&
            sample.opacity !== null &&
            sample.opacity > 0 &&
            sample.opacity < 1
        );
        expect(right.length).toBeGreaterThan(1);
        for (const sample of right) {
          expect(sample.translate).toBeGreaterThan(0);
          expect(Math.abs(sample.translate! - (1 - sample.opacity!) * sample.width!)).toBeLessThan(
            1
          );
        }
        expect(await page.evaluate(() => window.presenceNative.fixture.read())).toMatchObject({
          phase: 'closed',
          present: false,
        });
      }
    );
  },
  30_000
);

it.each(cases)(
  '$target $execution settles reduced motion without a sampled transition',
  async (scenario) => {
    await run(
      `${scenario.target}-${scenario.execution}-reduced`,
      'reduce',
      async (page, observations) => {
        await page.evaluate(
          (value) => window.presenceNative.fixture.mount(value.target, value.execution),
          scenario
        );
        await page.evaluate(() => {
          window.presenceNative.fixture.startTrace();
        });
        await page.evaluate(() => window.presenceNative.fixture.setProps({ open: true }));
        await state(page, 'entered');
        const frames = await page.evaluate(() => window.presenceNative.fixture.stopTrace());
        observations.push({ stage: 'reduced-enter', frames });
        expect(frames.every((frame) => frame.opacity === null || frame.opacity === 1)).toBe(true);
        await page.evaluate(() => window.presenceNative.fixture.setProps({ open: false }));
        await state(page, 'closed');
      }
    );
  },
  30_000
);
