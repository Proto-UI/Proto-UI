// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Locator, type Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromeExecutable, RUNTIMES, startServer, stopServer } from './browser-harness';

// Controlled layout conditions around actual public Select/Dialog consumers.
// No injected rectangles, positioning coordinates, fake controls or offset repair.
// Authority: C-ANCHORED-POSITIONING-0001-C/D/E/F and HC-OVERLAY-MODAL-0001-A
// are draft; this is bounded native evidence, not lifecycle promotion.
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
  ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'overlay-scrollbar-geometry')
  : undefined;
const observations: unknown[] = [];
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/');
  // Playwright headless defaults include --hide-scrollbars, which defeats the
  // classic-scrollbar precondition. Keep real browser layout; suppress no UI.
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  if (output) await mkdir(output, { recursive: true });
}, 150_000);
afterAll(async () => {
  if (output)
    await writeFile(
      path.join(output, 'observations.json'),
      JSON.stringify(
        {
          sourceSha,
          browser: browser?.version(),
          conditions:
            'Test-controlled overflow, gutter and ancestor scrolling on actual public components',
          observations,
        },
        null,
        2
      )
    );
  await browser?.close();
  await stopServer();
}, 60_000);
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function capture(page: Page, id: string, facts: unknown) {
  let image;
  if (output) {
    const bytes = await page.screenshot({ path: path.join(output, `${id}.png`) });
    image = { file: `${id}.png`, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  observations.push({ id, sourceSha, viewport: page.viewportSize(), facts, image });
}
async function ready(page: Page, runtime: string, direction: string) {
  await page.addInitScript(
    ({ runtime, direction }) => {
      localStorage.setItem('preferred-prototypes-adapter', runtime);
      document.documentElement?.setAttribute('dir', direction);
    },
    { runtime, direction }
  );
  const response = await page.goto(`${baseUrl}/zh-cn/`);
  expect(response?.status()).toBe(200);
  await page.waitForFunction(
    (runtime) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      return root?.dataset.runtimeState === 'ready' && root.dataset.runtime === runtime;
    },
    runtime,
    { timeout: 45_000 }
  );
  await page.evaluate((direction) => {
    document.documentElement.dir = direction;
  }, direction);
}
async function layout(
  page: Page,
  overflow: 'hidden' | 'scroll',
  gutter: 'auto' | 'stable' = 'auto'
) {
  await page.evaluate(
    ({ overflow, gutter }) => {
      document.documentElement.style.overflowY = overflow;
      document.documentElement.style.scrollbarGutter = gutter;
      document.body.style.minHeight = '1800px';
    },
    { overflow, gutter }
  );
  await frames(page);
}
async function settled(element: Locator) {
  await expect
    .poll(() =>
      element.evaluate((e) =>
        e.getAnimations({ subtree: true }).every((a) => !a.pending && a.playState !== 'running')
      )
    )
    .toBe(true);
}
async function pair(page: Page, anchor: Locator, floating: Locator) {
  const a = await anchor.elementHandle();
  const f = await floating.elementHandle();
  if (!a || !f) throw new Error('Real anchor and floating targets are required');
  return page.evaluate(
    ({ a, f }) => {
      const anchor = a.getBoundingClientRect();
      const popup = f.getBoundingClientRect();
      const root = document.documentElement;
      const style = getComputedStyle(f);
      return {
        anchor: anchor.toJSON(),
        floating: popup.toJSON(),
        centerDelta: popup.x + popup.width / 2 - anchor.x - anchor.width / 2,
        collisionAdjustedDelta:
          popup.x -
          Math.min(
            Math.max(
              anchor.x + (anchor.width - popup.width) / 2,
              (visualViewport?.offsetLeft ?? 0) + 10
            ),
            (visualViewport?.offsetLeft ?? 0) +
              (visualViewport?.width ?? root.clientWidth) -
              10 -
              popup.width
          ),
        side: f.getAttribute('data-side'),
        align: f.getAttribute('data-align'),
        bottomGap: popup.top - anchor.bottom,
        topGap: anchor.top - popup.bottom,
        position: style.position,
        transform: style.transform,
        portalledOutsideShowcase: !f.closest('[data-home-showcase]'),
        viewport: {
          innerWidth,
          clientWidth: root.clientWidth,
          clientLeft: root.clientLeft,
          scrollbar: innerWidth - root.clientWidth,
          x: visualViewport?.offsetLeft,
          width: visualViewport?.width,
          scrollX,
          scrollY,
        },
        body: {
          overflow: getComputedStyle(document.body).overflow,
          paddingLeft: getComputedStyle(document.body).paddingLeft,
          paddingRight: getComputedStyle(document.body).paddingRight,
        },
        direction: getComputedStyle(root).direction,
        rootStyle: {
          gutter: getComputedStyle(root).scrollbarGutter,
          overflow: getComputedStyle(root).overflow,
        },
        nestedScroll: (() => {
          const e = document.querySelector<HTMLElement>('[data-home-showcase]')!;
          return {
            top: e.scrollTop,
            left: e.scrollLeft,
            clientWidth: e.clientWidth,
            clientHeight: e.clientHeight,
            scrollHeight: e.scrollHeight,
            rect: e.getBoundingClientRect().toJSON(),
          };
        })(),
      };
    },
    { a, f }
  );
}
for (const runtime of RUNTIMES)
  for (const direction of ['ltr', 'rtl']) {
    it(`${runtime}/${direction}: Select tracks real scrollbar and nested-scroll changes`, async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const samples: Awaited<ReturnType<typeof pair>>[] = [];
      try {
        await ready(page, runtime, direction);
        const anchor = page.getByRole('combobox', { name: '通知方式', exact: true });
        await layout(page, 'hidden');
        await anchor.click();
        const id = await anchor.getAttribute('aria-controls');
        expect(id).toBeTruthy();
        const popup = page.locator(`[id=${JSON.stringify(id)}]`);
        await popup.waitFor({ state: 'visible' });
        await settled(popup);
        for (const state of [
          'none',
          'classic',
          'restored',
          'nested-before',
          'nested-after',
        ] as const) {
          if (state === 'classic') await layout(page, 'scroll');
          if (state === 'restored') await layout(page, 'hidden');
          if (state === 'nested-before') {
            await page.locator('[data-home-showcase]').evaluate((root) => {
              (root as HTMLElement).style.height = '420px';
              (root as HTMLElement).style.overflow = 'auto';
            });
            await frames(page);
          }
          if (state === 'nested-after') {
            // Programmatic offset injection; resulting scroll/geometry are browser-observed.
            await page.locator('[data-home-showcase]').evaluate((root) => {
              root.scrollTop = 48;
            });
            await frames(page);
          }
          const facts = await pair(page, anchor, popup);
          samples.push(facts);
          await capture(page, `${runtime}-${direction}-select-${state}`, facts);
        }
        for (const facts of samples) {
          expect(facts.position).toBe('fixed');
          expect(facts.portalledOutsideShowcase).toBe(true);
          expect(Math.abs(facts.collisionAdjustedDelta)).toBeLessThanOrEqual(1);
          expect(
            Math.abs((facts.side === 'top' ? facts.topGap : facts.bottomGap) - 4)
          ).toBeLessThanOrEqual(1);
        }
        expect(
          samples[1]!.viewport.scrollbar,
          'Classic scrollbar precondition, not a product verdict'
        ).toBeGreaterThan(0);
        expect(samples[4]!.nestedScroll.top).toBeGreaterThan(samples[3]!.nestedScroll.top);
        await page.keyboard.press('Escape');
      } finally {
        await page.close();
      }
    }, 90_000);

    it(`${runtime}/${direction}: Dialog locking preserves the measured page geometry and restores styles`, async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      try {
        await ready(page, runtime, direction);
        const trigger = page.getByRole('button', { name: '打开对话框', exact: true });
        for (const scenario of ['body-propagated', 'stable-gutter', 'root-owned'] as const) {
          const gutter = scenario === 'stable-gutter' ? 'stable' : 'auto';
          await layout(page, 'scroll', gutter);
          // CSS propagates body overflow only through a visible root. Keep an
          // explicit root-owned scrollbar as a separate non-disappearing case.
          await page.evaluate((scenario) => {
            document.documentElement.style.overflow =
              scenario === 'root-owned' ? 'auto' : 'visible';
          }, scenario);
          await trigger.scrollIntoViewIfNeeded();
          const read = () =>
            trigger.evaluate((button) => ({
              button: button.getBoundingClientRect().toJSON(),
              viewport: {
                innerWidth,
                clientWidth: document.documentElement.clientWidth,
                clientLeft: document.documentElement.clientLeft,
                scrollbar: innerWidth - document.documentElement.clientWidth,
                visualX: visualViewport?.offsetLeft,
                visualY: visualViewport?.offsetTop,
                visualWidth: visualViewport?.width,
                gutter: getComputedStyle(document.documentElement).scrollbarGutter,
                rootOverflow: getComputedStyle(document.documentElement).overflow,
              },
              inline: {
                overflow: document.body.style.overflow,
                paddingLeft: document.body.style.paddingLeft,
                paddingRight: document.body.style.paddingRight,
              },
              computed: {
                overflow: getComputedStyle(document.body).overflow,
                paddingLeft: getComputedStyle(document.body).paddingLeft,
                paddingRight: getComputedStyle(document.body).paddingRight,
              },
            }));
          await frames(page);
          const before = await read();
          await trigger.click();
          const dialog = page.getByRole('dialog', { name: '确认这次选择？', exact: true });
          await dialog.waitFor({ state: 'visible' });
          await settled(dialog);
          await frames(page);
          const locked = await read();
          await capture(page, `${runtime}-${direction}-dialog-${scenario}-locked`, {
            before,
            locked,
          });
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          await expect.poll(async () => (await read()).inline).toEqual(before.inline);
          const restored = await read();
          await capture(page, `${runtime}-${direction}-dialog-${scenario}-restored`, {
            before,
            restored,
          });
          expect(before.viewport.scrollbar, 'Real classic scrollbar prerequisite').toBeGreaterThan(
            0
          );
          const gained = locked.viewport.clientWidth - before.viewport.clientWidth;
          if (scenario === 'body-propagated')
            expect(gained, 'Body lock actually removes the viewport gutter').toBeGreaterThan(0);
          else expect(gained, 'A retained gutter must not acquire duplicate compensation').toBe(0);
          expect(Math.abs(locked.button.x - before.button.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(locked.button.width - before.button.width)).toBeLessThanOrEqual(1);
          expect(restored.inline).toEqual(before.inline);
        }
      } finally {
        await page.close();
      }
    }, 90_000);
  }
