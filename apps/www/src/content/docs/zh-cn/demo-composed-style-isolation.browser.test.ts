// @vitest-environment node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  openRoute,
  runtimeSelectTrigger,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';
import {
  SHADCN_SWITCH_DEMO_CASES,
  SHADCN_SWITCH_REM_GEOMETRY,
  SHADCN_SWITCH_SOURCE_PIN,
} from './switch-demo-fixture';

/** Source-aligned Brutalist has a flat Thumb; Root alone owns the focus ring. */
const BRUTALIST_SWITCH_ROUTE = '/en/ui-libraries/brutalist/components/switch/';
/** Fixed 02cad611 New York has no hover/press scale on either size variant. */
const SHADCN_SWITCH_ROUTE = '/en/ui-libraries/shadcn/switch/';

let browser: Browser;
let baseUrl = '';

type ShadowLayer = {
  value: string;
  alpha: number;
};

type SwitchShadows = {
  focusVisible: boolean;
  root: ShadowLayer[];
  thumb: ShadowLayer[];
};

/**
 * Splits a computed `box-shadow` into its layers and resolves each layer's
 * colour through a canvas, because the themes emit oklch and no string
 * comparison can tell a painted layer from a transparent one.
 */
const READ_SWITCH_SHADOWS = () => {
  const root = document.querySelector<HTMLElement>('[data-previewer-id] [role="switch"]');
  if (!root) throw new Error('The Switch demo must render a Root.');
  const thumb = root.querySelector<HTMLElement>('[data-pui-style]');
  if (!thumb) throw new Error('The Switch demo must render a styled Thumb.');

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context is required to resolve painted colours.');

  const layers = (element: HTMLElement) => {
    const shadow = getComputedStyle(element).boxShadow;
    if (shadow === 'none') return [];

    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of shadow) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    parts.push(current.trim());

    return parts.filter(Boolean).map((value) => {
      const color = value.match(
        /^(?:(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|#[0-9a-f]+|[a-z]+)/i
      );
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0,0,0,0)';
      context.fillStyle = color ? color[0] : 'rgba(0,0,0,0)';
      context.fillRect(0, 0, 1, 1);
      return { value, alpha: context.getImageData(0, 0, 1, 1).data[3] / 255 };
    });
  };

  return {
    focusVisible: root.hasAttribute('data-focus-visible'),
    root: layers(root),
    thumb: layers(thumb),
  };
};

async function switchShadows(page: Page): Promise<SwitchShadows> {
  return page.evaluate(READ_SWITCH_SHADOWS);
}

/** Real keyboard focus, so the ring comes from the host's own focus-visible determination. */
async function focusFirstSwitch(page: Page, previewer: Locator): Promise<void> {
  await runtimeSelectTrigger(previewer).focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-previewer-id] [role="switch"]')
        ?.hasAttribute('data-focus-visible') === true,
    undefined,
    { timeout: 10_000 }
  );
}

/** Horizontal scale factor of each element's own resolved transform. */
async function switchScales(target: Locator): Promise<{ root: number; thumb: number }> {
  return target.evaluate((element) => {
    const root = element as HTMLElement;
    const thumb = root.querySelector<HTMLElement>('[data-pui-style]');
    if (!thumb) throw new Error('The Switch demo must render a styled Thumb.');

    const scale = (element: HTMLElement) =>
      new DOMMatrixReadOnly(getComputedStyle(element).transform).a;

    return { root: scale(root), thumb: scale(thumb) };
  });
}

function paintedLayers(layers: ShadowLayer[]): ShadowLayer[] {
  return layers.filter((layer) => layer.alpha > 0);
}

beforeAll(async () => {
  baseUrl = await startServer(BRUTALIST_SWITCH_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('composed style isolation browser regressions', () => {
  it('paints the focus ring on the focused Switch and not on its thumb', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, BRUTALIST_SWITCH_ROUTE, {
      width: 1440,
      height: 900,
    });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="switch"]', 3);
        for (const scheme of COLOR_SCHEMES) {
          await applyColorScheme(page, scheme);
          await runtimeSelectTrigger(previewer).focus();
          const resting = await switchShadows(page);
          expect(paintedLayers(resting.root), `${runtime}/${scheme}/resting-root`).toHaveLength(0);
          expect(paintedLayers(resting.thumb), `${runtime}/${scheme}/resting-thumb`).toHaveLength(
            0
          );
          await focusFirstSwitch(page, previewer);

          const shadows = await switchShadows(page);
          const label = `${runtime}/${scheme}`;
          expect(shadows.focusVisible, `${label}/focus-visible`).toBe(true);

          // The focused Root paints exactly its offset layer and ring. The
          // source-aligned Switch has no decorative hard shadow.
          expect(paintedLayers(shadows.root), `${label}/root-layers`).toHaveLength(2);

          // The flat Thumb owns neither shadow nor ring. Any painted layer
          // would violate the current projection and focus ownership.
          expect(paintedLayers(shadows.thumb), `${label}/thumb-layers`).toHaveLength(0);
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);

  it('keeps source-aligned pressed Root and Thumb unscaled in both checked states', async () => {
    type Frame = {
      elapsed: number;
      root: number;
      thumb: number;
      pressed: boolean;
      checked: string | null;
    };
    type Record = {
      runtime: string;
      size: 'default' | 'sm';
      name: string;
      expectedChecked: boolean;
      observedChecked: string | null;
      phase: string;
      frames: Frame[];
      error?: string;
    };
    const records: Record[] = [];
    const geometryRecords: unknown[] = [];
    const pageErrors: string[] = [];
    const cleanupErrors: string[] = [];
    let failure: string | undefined;
    let phase = 'navigation';
    let current: Record | undefined;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
    // Stream each completed sample to Node so a later page failure cannot erase it.
    await page.exposeFunction('__recordSwitchPressFrame', (frame: Frame) => {
      current?.frames.push(frame);
    });
    try {
      await page.goto(`${baseUrl}${SHADCN_SWITCH_ROUTE}`, { waitUntil: 'networkidle' });
      const previewer = page.locator('[data-previewer-id]').first();
      await previewer.waitFor({ state: 'visible' });
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of RUNTIMES) {
        current = undefined;
        phase = `select-runtime:${runtime}`;
        await selectRuntime(
          page,
          previewer,
          runtime,
          '[role="switch"]',
          SHADCN_SWITCH_DEMO_CASES.length
        );
        await applyColorScheme(page, 'light');
        // Verify all five named examples, including both newly added small states.
        for (const variant of SHADCN_SWITCH_DEMO_CASES) {
          phase = `geometry:${runtime}/${variant.size}/${variant.name}`;
          const target = previewer.getByRole('switch', { name: variant.name, exact: true });
          expect(await target.count(), `${runtime}/${variant.name}/unique`).toBe(1);
          expect(await target.getAttribute('aria-checked')).toBe(String(variant.checked));
          expect(await target.getAttribute('aria-disabled')).toBe(String(variant.disabled));
          const geometry = await target.evaluate((element) => {
            const root = element as HTMLElement;
            const thumb = root.querySelector<HTMLElement>('[data-pui-style]');
            if (!thumb) throw new Error('The named Switch must have its own styled Thumb.');
            const r = root.getBoundingClientRect(),
              t = thumb.getBoundingClientRect();
            return {
              font: parseFloat(getComputedStyle(document.documentElement).fontSize),
              width: r.width,
              height: r.height,
              thumbWidth: t.width,
              thumbHeight: t.height,
            };
          });
          geometryRecords.push({ runtime, ...variant, ...geometry });
          const expected = SHADCN_SWITCH_REM_GEOMETRY[variant.size];
          const label = `${runtime}/${variant.size}/${variant.name}`;
          expect(geometry.width, `${label}/width`).toBeCloseTo(geometry.font * expected.width, 1);
          expect(geometry.height, `${label}/height`).toBeCloseTo(
            geometry.font * expected.height,
            1
          );
          expect(geometry.thumbWidth, `${label}/thumb-width`).toBeCloseTo(
            geometry.font * expected.thumb,
            1
          );
          expect(geometry.thumbHeight, `${label}/thumb-height`).toBeCloseTo(
            geometry.font * expected.thumb,
            1
          );
        }
        // Exercise both sizes in both checked states without changing disabled examples.
        for (const variant of SHADCN_SWITCH_DEMO_CASES.filter(
          (entry) => !entry.disabled && !entry.checked
        )) {
          phase = `pressed:${runtime}/${variant.size}/${variant.name}`;
          const root = previewer.getByRole('switch', { name: variant.name, exact: true });
          for (const checked of [false, true]) {
            current = {
              runtime,
              size: variant.size,
              name: variant.name,
              expectedChecked: checked,
              observedChecked: null,
              phase: 'checked-state',
              frames: [],
            };
            records.push(current);
            if ((await root.getAttribute('aria-checked')) !== String(checked)) await root.click();
            await expect
              .poll(async () => {
                current!.observedChecked = await root.getAttribute('aria-checked');
                return current!.observedChecked;
              })
              .toBe(String(checked));
            current.phase = 'resting';
            await page.waitForTimeout(180);
            const resting = await switchScales(root);
            expect(resting.root, `${runtime}/${variant.size}/${checked}/resting-root`).toBeCloseTo(
              1,
              3
            );
            expect(
              resting.thumb,
              `${runtime}/${variant.size}/${checked}/resting-thumb`
            ).toBeCloseTo(1, 3);
            const box = await root.boundingBox();
            if (!box) throw new Error('The Switch Root must be laid out.');
            current.phase = 'pointer-down';
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            try {
              current.phase = 'wait-pressed';
              await expect
                .poll(() => root.evaluate((element) => element.hasAttribute('data-pressed')), {
                  timeout: 10_000,
                })
                .toBe(true);
              current.phase = 'sample-pressed';
              // True RAF samples beyond the old 200ms transition. Sample exceptions
              // reject immediately; the bounded watchdog also preserves partial data.
              await root.evaluate(
                (element) =>
                  new Promise<void>((resolve, reject) => {
                    let ticket = 0;
                    let stopped = false;
                    let count = 0;
                    const deliveries: Promise<void>[] = [];
                    const start = performance.now();
                    const finish = (error?: unknown) => {
                      if (stopped) return;
                      stopped = true;
                      cancelAnimationFrame(ticket);
                      clearTimeout(timeout);
                      if (error) reject(error);
                      else resolve();
                    };
                    const timeout = setTimeout(
                      () => finish(new Error('Pressed RAF sampling timed out')),
                      5000
                    );
                    const collect = () => {
                      if (stopped) return;
                      try {
                        const root = element as HTMLElement;
                        const thumb = root?.querySelector<HTMLElement>('[data-pui-style]');
                        if (!root.isConnected || !thumb)
                          throw new Error('Switch Root/Thumb disappeared during pressed sampling');
                        const frame = {
                          elapsed: performance.now() - start,
                          root: new DOMMatrixReadOnly(getComputedStyle(root).transform).a,
                          thumb: new DOMMatrixReadOnly(getComputedStyle(thumb).transform).a,
                          pressed: root.hasAttribute('data-pressed'),
                          checked: root.getAttribute('aria-checked'),
                        };
                        const delivery = (
                          window as unknown as {
                            __recordSwitchPressFrame(sample: typeof frame): Promise<void>;
                          }
                        ).__recordSwitchPressFrame(frame);
                        deliveries.push(delivery);
                        void delivery.catch(finish);
                        count++;
                        if (count >= 3 && frame.elapsed >= 240) {
                          void Promise.all(deliveries).then(() => finish(), finish);
                        } else ticket = requestAnimationFrame(collect);
                      } catch (error) {
                        finish(error);
                      }
                    };
                    ticket = requestAnimationFrame(collect);
                  })
              );
              current.phase = 'assert-pressed';
              expect(current.frames.length).toBeGreaterThanOrEqual(3);
              expect(
                Math.max(...current.frames.map((frame) => frame.elapsed))
              ).toBeGreaterThanOrEqual(240);
              for (const frame of current.frames) {
                expect(frame.checked, `${runtime}/${variant.size}/${checked}/actual-checked`).toBe(
                  String(checked)
                );
                expect(frame.pressed, `${runtime}/${variant.size}/${checked}/pressed-state`).toBe(
                  true
                );
                expect(
                  frame.root,
                  `${runtime}/${variant.size}/${checked}/pressed-root`
                ).toBeCloseTo(1, 3);
                expect(
                  frame.thumb,
                  `${runtime}/${variant.size}/${checked}/pressed-thumb`
                ).toBeCloseTo(1, 3);
              }
              current.phase = 'passed';
            } finally {
              await page.mouse.up().catch((error) => cleanupErrors.push(String(error)));
            }
          }
        }
      }
    } catch (error) {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
      if (current) current.error = failure;
      throw error;
    } finally {
      await page.mouse.up().catch((error) => cleanupErrors.push(String(error)));
      const artifactRoot = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
      try {
        if (artifactRoot) {
          const dir = path.join(artifactRoot, 'switch-press-source-oracle');
          await mkdir(dir, { recursive: true });
          await writeFile(
            path.join(dir, 'run.json'),
            JSON.stringify(
              {
                sourcePin: SHADCN_SWITCH_SOURCE_PIN,
                sourcePath: 'apps/v4/registry/new-york-v4/ui/switch.tsx',
                sourceBlob: 'c45932afe4e484c900aa916e81d0e0d67137bedc',
                phase,
                failure,
                records,
                geometryRecords,
                pageErrors,
                cleanupErrors,
              },
              null,
              2
            ) + '\n'
          );
        }
      } catch (error) {
        if (!failure) throw error;
        console.error('Unable to persist pressed failure evidence', error);
      } finally {
        try {
          await context.close();
        } catch (error) {
          if (!failure) throw error;
          console.error('Unable to close failed pressed oracle context', error);
        }
      }
    }
  }, 240_000);
});
