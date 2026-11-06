// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type JSHandle, type Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  installSizingMotionTrace,
  sizingMotionIssues,
  type SizingMotionHandle,
  type SizingMotionResult,
} from './demo-select-item-sizing-motion';
import {
  RUNTIMES,
  chromeExecutable,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

let source: string;
let sourceTree: string;
const output = process.env.PROTO_UI_SELECT_ITEM_SIZING_EVIDENCE;
const route = (locale: string) => `/${locale}/ui-libraries/shadcn/select/`;
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  // This carrier binds its source to its own checkout/server, not a caller's
  // unsupported claim that an arbitrary external deployment has the same SHA.
  if (process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error(
      'External deployment SHA needs independent verification; this carrier requires its own source-bound server.'
    );
  source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  baseUrl = await startServer([route('en'), route('zh-cn')]);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    chromiumSandbox: true,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  if (output) {
    await mkdir(output, { recursive: true });
    const files = [
      'apps/www/src/content/docs/zh-cn/demo-shadcn-select.demo.ts',
      'apps/www/src/content/docs/zh-cn/demo-select-item-sizing.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-select-item-sizing-motion.ts',
    ];
    await writeFile(
      path.join(output, 'source.json'),
      JSON.stringify(
        {
          source,
          sourceTree,
          files: await Promise.all(
            files.map(async (file) => ({
              file,
              sha256: createHash('sha256')
                .update(await readFile(file))
                .digest('hex'),
            }))
          ),
          claim:
            'Styled public demo, actual chosen runtime, own checkout server; not compiled/AT acceptance',
        },
        null,
        2
      )
    );
  }
}, 150_000);
afterAll(async () => {
  const errors: unknown[] = [];
  try {
    await browser?.close();
  } catch (error) {
    errors.push(error);
  }
  try {
    await stopServer();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, 'Browser/server cleanup failed');
}, 60_000);

async function facts(trigger: Locator) {
  return trigger.evaluate((node) => {
    const trigger = node as HTMLElement;
    const doc = trigger.ownerDocument;
    const id = trigger.getAttribute('aria-controls');
    const content = id ? doc.getElementById(id) : null;
    const owner = trigger.dataset.projectionOwner;
    if (!content || !owner || content.dataset.projectionOwner !== owner)
      throw new Error('Controlled Content/Trigger owner mismatch');
    const one = (id: string) => {
      const matches = content.querySelectorAll<HTMLElement>(`[data-projection-prototype="${id}"]`);
      if (matches.length !== 1 || matches[0].dataset.projectionOwner !== owner)
        throw new Error(`Expected one same-owner ${id}`);
      return matches[0];
    };
    const box = (element: HTMLElement) => {
      const css = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        prototype: element.dataset.projectionPrototype,
        rect: {
          x: rect.x,
          y: rect.y,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        border: [
          css.borderTopWidth,
          css.borderRightWidth,
          css.borderBottomWidth,
          css.borderLeftWidth,
        ].map(parseFloat),
        padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft].map(
          parseFloat
        ),
        boxSizing: css.boxSizing,
        outlineWidth: css.outlineWidth,
        outlineOffset: css.outlineOffset,
        boxShadow: css.boxShadow,
        position: css.position,
        transform: css.transform,
        overflowX: css.overflowX,
        overflowY: css.overflowY,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        focused: doc.activeElement === element,
        selected: element.getAttribute('aria-selected'),
        disabled: element.getAttribute('aria-disabled'),
        text: element.textContent?.trim(),
      };
    };
    const surface = one('shadcn-select-surface');
    const viewport = one('shadcn-select-viewport');
    const items = [...content.querySelectorAll<HTMLElement>('[role="option"]')];
    if (
      items.length !== 4 ||
      items.some((item) => item.dataset.projectionOwner !== owner || !viewport.contains(item))
    )
      throw new Error('Expected all four current owned options inside Viewport');
    return {
      at: performance.now(),
      runtime: trigger.dataset.projectionRuntime,
      expanded: trigger.getAttribute('aria-expanded'),
      trigger: box(trigger),
      content: box(content),
      surface: box(surface),
      viewport: box(viewport),
      items: items.map(box),
      browser: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      rootFontSize: getComputedStyle(doc.documentElement).fontSize,
    };
  });
}
type Facts = Awaited<ReturnType<typeof facts>>;
function assertGeometry(value: Facts, runtime: string) {
  expect(value.runtime).toBe(runtime);
  expect(value.expanded).toBe('true');
  expect(value.trigger.rect.height).toBeGreaterThan(0);
  for (const item of value.items) {
    expect(
      Math.abs(item.rect.height - value.trigger.rect.height),
      `${item.text} border-box height`
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(item.rect.width - value.trigger.rect.width),
      `${item.text} border-box width`
    ).toBeLessThanOrEqual(0.5);
    expect(
      item.scrollWidth - item.clientWidth,
      `${item.text} horizontal text overflow`
    ).toBeLessThanOrEqual(1);
  }
  for (const [label, box] of [
    ['Surface', value.surface],
    ['Viewport', value.viewport],
  ] as const)
    expect(box.scrollWidth - box.clientWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(
      1
    );
  // A popup may legitimately be wider than its Trigger to include chrome.
  // Match the actual Item boxes, never substitute the decorative Surface box.
  expect(value.surface.rect.left).toBeGreaterThanOrEqual(-0.5);
  expect(value.surface.rect.right).toBeLessThanOrEqual(value.browser.width + 0.5);
  const focused = value.items.filter((item) => item.focused);
  expect(focused).toHaveLength(1);
  const item = focused[0].rect;
  const clip = value.viewport.rect;
  expect(item.left).toBeGreaterThanOrEqual(clip.left + value.viewport.border[3] - 0.5);
  expect(item.right).toBeLessThanOrEqual(clip.right - value.viewport.border[1] + 0.5);
  expect(item.top).toBeGreaterThanOrEqual(clip.top + value.viewport.border[0] - 0.5);
  expect(item.bottom).toBeLessThanOrEqual(clip.bottom - value.viewport.border[2] + 0.5);
  expect(value.items[3].disabled).toBe('true');
}
async function ready(previewer: Locator, runtime: (typeof RUNTIMES)[number]) {
  // A toolbar scope can publish the new selection while the previous demo is
  // still mounted. Observe the controller's commit and the actual demo root.
  await selectRuntime(
    previewer.page(),
    previewer,
    runtime,
    '[role="combobox"][aria-label="Adapter selector"]',
    1
  );
}

for (const locale of ['en', 'zh-cn'])
  describe.sequential(`${locale} actual styled Select consumer`, () => {
    for (const runtime of RUNTIMES)
      it(`${runtime}: first entry, selection, reopen and narrow geometry`, async () => {
        const { context, page, previewer } = await openRoute(browser, baseUrl, route(locale), {
          width: 1180,
          height: 900,
        });
        const observations: Array<{ phase: string; value: Facts }> = [];
        const motion: Array<{ phase: string; value: SizingMotionResult }> = [];
        const activeMotion: { handle: JSHandle<SizingMotionHandle> | null } = { handle: null };
        const startMotion = async (trigger: Locator) => {
          if (activeMotion.handle) throw new Error('Previous motion trace was not released');
          // Begin the open-cycle trace from an established keyboard focus state.
          // Otherwise the opening key also changes input modality, starts the
          // focus ring and immediately reverses it as focus moves to an option.
          await expect
            .poll(
              () =>
                trigger.evaluate(
                  (node) =>
                    node.ownerDocument.activeElement === node &&
                    node
                      .getAnimations()
                      .every(
                        (animation) => !animation.pending && animation.playState === 'finished'
                      )
                ),
              { timeout: 1200 }
            )
            .toBe(true);
          activeMotion.handle = await trigger.evaluateHandle(installSizingMotionTrace);
        };
        const finishMotion = async (phase: string) => {
          if (!activeMotion.handle) throw new Error('Motion trace was not installed before action');
          // Do not resolve the Locator again: its DOM owner may have changed.
          // Keep the original trace and its invalid-owner/interrupted result.
          const value = await activeMotion.handle.evaluate((handle) => handle.done);
          motion.push({ phase, value });
          await activeMotion.handle.dispose();
          activeMotion.handle = null;
          expect(sizingMotionIssues(value, runtime), `${phase} full motion trajectory`).toEqual([]);
        };
        const name = `${locale}-${runtime}`;
        let testFailed = false;
        let testError: unknown;
        const secondaryErrors: Array<{ phase: string; error: unknown }> = [];
        try {
          await ready(previewer, runtime);
          const trigger = previewer.getByRole('combobox', {
            name: 'Adapter selector',
            exact: true,
          });
          expect(await trigger.getAttribute('aria-expanded')).toBe('false');
          await page.keyboard.press('Tab');
          await startMotion(trigger);
          await trigger.press('ArrowDown');
          await expect
            .poll(async () =>
              (await facts(trigger)).items.filter((item) => item.focused).map((item) => item.text)
            )
            .toEqual(['React']);
          await finishMotion('first-entry');
          const first = await facts(trigger);
          observations.push({ phase: 'first-entry', value: first });
          assertGeometry(first, runtime);
          if (output) await page.screenshot({ path: path.join(output, `${name}-first.png`) });
          await page.keyboard.press('End');
          await expect
            .poll(async () =>
              (await facts(trigger)).items.filter((item) => item.focused).map((item) => item.text)
            )
            .toEqual(['Web Components']);
          await page.keyboard.press('Enter');
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
          await expect.poll(() => trigger.innerText()).toContain('Web Components');
          await startMotion(trigger);
          await trigger.press('Enter');
          await expect
            .poll(async () =>
              (await facts(trigger)).items.filter((item) => item.focused).map((item) => item.text)
            )
            .toEqual(['Web Components']);
          await finishMotion('selected-reopen');
          const reopen = await facts(trigger);
          observations.push({ phase: 'selected-reopen', value: reopen });
          assertGeometry(reopen, runtime);
          expect(reopen.items.map((item) => item.selected)).toEqual([
            'false',
            'false',
            'true',
            'false',
          ]);
          await page.keyboard.press('Escape');
          await expect
            .poll(() =>
              trigger.evaluate((element) => element.ownerDocument.activeElement === element)
            )
            .toBe(true);
          await page.setViewportSize({ width: 390, height: 900 });
          await trigger.scrollIntoViewIfNeeded();
          await startMotion(trigger);
          await trigger.press('ArrowDown');
          await expect
            .poll(async () =>
              (await facts(trigger)).items.filter((item) => item.focused).map((item) => item.text)
            )
            .toEqual(['Web Components']);
          await finishMotion('narrow-reopen');
          const narrow = await facts(trigger);
          observations.push({ phase: 'narrow-reopen', value: narrow });
          assertGeometry(narrow, runtime);
          if (output) await page.screenshot({ path: path.join(output, `${name}-narrow.png`) });
          await page.keyboard.press('Escape');
          await expect.poll(() => trigger.getAttribute('aria-expanded')).toBe('false');
        } catch (error) {
          testFailed = true;
          testError = error;
          if (output) {
            try {
              await page.screenshot({ path: path.join(output, `${name}-failure.png`) });
            } catch (error) {
              secondaryErrors.push({ phase: 'failure-screenshot', error });
            }
            try {
              const trigger = previewer.getByRole('combobox', {
                name: 'Adapter selector',
                exact: true,
              });
              observations.push({ phase: 'failure', value: await facts(trigger) });
            } catch (error) {
              secondaryErrors.push({ phase: 'failure-facts', error });
            }
          }
        } finally {
          try {
            const unfinished = await activeMotion.handle?.evaluate((handle) => {
              handle.stop();
              return handle.done;
            });
            if (
              unfinished &&
              !motion.some((entry) => entry.value.startedAt === unfinished.startedAt)
            )
              motion.push({ phase: 'interrupted', value: unfinished });
          } catch (error) {
            secondaryErrors.push({ phase: 'motion-cleanup', error });
          } finally {
            try {
              await activeMotion.handle?.dispose();
            } catch (error) {
              secondaryErrors.push({ phase: 'motion-handle-dispose', error });
            }
            activeMotion.handle = null;
          }
          try {
            if (output)
              await writeFile(
                path.join(output, `${name}.json`),
                JSON.stringify(
                  {
                    source,
                    sourceTree,
                    runtime,
                    locale,
                    observations,
                    motion,
                    failure: testFailed ? String(testError) : null,
                    secondaryErrors: secondaryErrors.map(({ phase, error }) => ({
                      phase,
                      error: String(error),
                    })),
                    firstVisibleFrames:
                      'pre-action bounded rAF trace; early frames retained separately from settled assertions',
                    remaining: [
                      'first-visible frame capture',
                      '200% text/RTL',
                      'compiled/AT',
                      'other website controls',
                    ],
                  },
                  null,
                  2
                )
              );
          } catch (error) {
            secondaryErrors.push({ phase: 'evidence-write', error });
          }
          try {
            await context.close();
          } catch (error) {
            secondaryErrors.push({ phase: 'context-close', error });
          }
        }
        if (testFailed || secondaryErrors.length)
          throw new AggregateError(
            [
              ...(testFailed ? [testError] : []),
              ...secondaryErrors.map(({ phase, error }) => new Error(phase, { cause: error })),
            ],
            `${name}: assertion/evidence/cleanup failure`
          );
      }, 120_000);
  });
