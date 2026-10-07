// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  choosePreviewRuntime,
  launchBrowser,
  openRoute,
  startServer,
  stopServer,
} from './browser-harness';

const families = ['bootstrap-2-3-2', 'liquid-glass'] as const;
const route = (family: string, component = 'select') => `/en/ui-libraries/${family}/${component}/`;
let browser: Browser;
let baseUrl = '';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const captureDir = process.env.PROTO_UI_SELECT_SCREENSHOT_DIR;
async function captureFailure(page: Page, id: string, details: Record<string, unknown>) {
  if (!captureDir) return;
  try {
    await page.screenshot({ path: path.join(captureDir, `${id}-failure.png`) });
    await writeFile(
      path.join(captureDir, `${id}-failure.json`),
      JSON.stringify(
        {
          source,
          ...details,
          opticalPaintClaim: false,
          gpuiClaim: false,
        },
        null,
        2
      )
    );
  } catch {
    /* Capture failure must not replace the original assertion failure. */
  }
}

async function popup(page: Page, trigger: Locator) {
  const id = await trigger.getAttribute('aria-controls');
  if (!id) throw new Error('Select has no stable Content relationship.');
  const content = page.locator(`[id=${JSON.stringify(id)}]`);
  await content.waitFor({ state: 'visible' });
  expect(await content.getAttribute('role')).toBe('listbox');
  return content;
}
async function waitReady(page: Page, family: string, runtime: string) {
  await page.waitForFunction(
    ({ family, runtime }) => {
      const scope = document.querySelector<HTMLElement>(
        '[data-previewer-id] [data-projection-scope]'
      );
      const trigger = scope?.querySelector<HTMLElement>(
        '[data-projection-content] [data-demo-ref="uncontrolledTrigger"]'
      );
      return (
        scope?.dataset.projectionState === 'ready' &&
        scope.dataset.projectionRuntime === runtime &&
        trigger?.dataset.projectionPrototype === `${family}-select-trigger` &&
        trigger.textContent?.trim() === 'Alpha'
      );
    },
    { family, runtime }
  );
}
beforeAll(async () => {
  baseUrl = await startServer(route(families[0]));
  browser = await launchBrowser();
  if (captureDir) await mkdir(captureDir, { recursive: true });
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe.sequential('actual Bootstrap/Liquid Select input, layout and source-bound paint', () => {
  for (const family of families)
    for (const runtime of RUNTIMES)
      for (const theme of ['light', 'dark'] as const) {
        it(`${family}/${runtime}/${theme}: full selection flow, own toolbar, RTL portal and narrow long labels`, async () => {
          const { context, page, previewer } = await openRoute(browser, baseUrl, route(family), {
            width: 1440,
            height: 1000,
          });
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          const prefix = `${family}-${runtime}-${theme}`;
          try {
            await page.evaluate((theme) => {
              document.documentElement.classList.remove('light', 'dark');
              document.documentElement.classList.add(theme);
              document.documentElement.dataset.theme = theme;
            }, theme);
            await choosePreviewRuntime(page, previewer, runtime);
            await waitReady(page, family, runtime);
            const demo = previewer.locator('[data-projection-content]');
            const trigger = demo.locator('[data-demo-ref="uncontrolledTrigger"]');
            expect(await trigger.getAttribute('aria-expanded')).toBe('false');
            expect((await trigger.textContent())?.trim()).toBe('Alpha');
            const toolbar = previewer.locator('[data-projection-control="runtime"]');
            expect(
              await toolbar
                .locator(`[data-projection-prototype="${family}-select-trigger"]`)
                .count()
            ).toBe(1);
            expect(
              await toolbar.locator(`[data-projection-prototype="${family}-text-root"]`).count()
            ).toBe(1);
            await trigger.focus();
            await page.keyboard.press('ArrowDown');
            await popup(page, trigger);
            await page.waitForFunction(
              () =>
                document.activeElement?.getAttribute('role') === 'option' &&
                document.activeElement.textContent?.trim() === 'Alpha'
            );
            await page.keyboard.press('ArrowDown');
            await page.waitForFunction(
              () => document.activeElement?.textContent?.trim() === 'Beta'
            );
            expect((await trigger.textContent())?.trim()).toBe('Alpha');
            await page.keyboard.press('Enter');
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-demo-ref="uncontrolledTrigger"]')
                  ?.textContent?.trim() === 'Beta'
            );
            expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
            await trigger.click();
            await popup(page, trigger);
            await page.keyboard.press('End');
            await page.keyboard.press('Home');
            await page.keyboard.press('b');
            await page.waitForFunction(
              () => document.activeElement?.textContent?.trim() === 'Beta'
            );
            await page.keyboard.press('Escape');
            expect((await trigger.textContent())?.trim()).toBe('Beta');
            expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
            const disabled = demo.locator('[data-demo-ref="disabledTrigger"]');
            expect(await disabled.getAttribute('aria-disabled')).toBe('true');
            expect(await disabled.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(-1);
            const controlled = demo.locator('[data-demo-ref="controlledTrigger"]');
            await controlled.click();
            const controlledContent = await popup(page, controlled);
            await controlledContent.getByRole('option', { name: 'Beta', exact: true }).click();
            expect((await controlled.textContent())?.trim()).toBe('Alpha');
            await demo.getByRole('button', { name: 'Accept selection', exact: true }).click();
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-demo-ref="controlledTrigger"]')
                  ?.textContent?.trim() === 'Beta'
            );
            await trigger.click();
            await popup(page, trigger);
            await page.keyboard.press('Tab');
            expect(await trigger.getAttribute('aria-expanded')).toBe('false');
            await trigger.click();
            await popup(page, trigger);
            await page.locator('h1').first().click();
            expect(await trigger.getAttribute('aria-expanded')).toBe('false');
            if (captureDir)
              await previewer.screenshot({ path: path.join(captureDir, `${prefix}-desktop.png`) });

            await page.setViewportSize({ width: 320, height: 900 });
            await page.evaluate(() => {
              document.documentElement.style.fontSize = '32px';
            });
            const rtl = demo.locator('[data-demo-ref="rtlTrigger"]');
            await rtl.scrollIntoViewIfNeeded();
            await rtl.click();
            const rtlContent = await popup(page, rtl);
            const geometry = await rtlContent.evaluate((node) => {
              const style = getComputedStyle(node);
              const rect = node.getBoundingClientRect();
              const selected = node.querySelector<HTMLElement>(
                '[role="option"][aria-selected="true"]'
              )!;
              const label = selected.firstElementChild!.getBoundingClientRect();
              const indicator = selected.lastElementChild!.getBoundingClientRect();
              return {
                direction: style.direction,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
                labelLeft: label.left,
                indicatorRight: indicator.right,
                selectedText: selected.textContent,
                color: style.color,
                background: style.backgroundColor,
                radius: style.borderRadius,
              };
            });
            expect(geometry.direction).toBe('rtl');
            expect(geometry.left).toBeGreaterThanOrEqual(0);
            expect(geometry.right).toBeLessThanOrEqual(321);
            expect(geometry.width).toBeGreaterThan(40);
            expect(geometry.height).toBeGreaterThan(30);
            expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
            expect(geometry.indicatorRight).toBeLessThanOrEqual(geometry.labelLeft + 1);
            expect(geometry.selectedText).toContain('VeryLongUnbrokenOptionLabels');
            expect(geometry.background).not.toBe('rgba(0, 0, 0, 0)');
            expect(Number.parseFloat(geometry.radius)).toBeGreaterThan(0);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
            ).toBe(true);
            if (captureDir) {
              await page.screenshot({
                path: path.join(captureDir, `${prefix}-320-text200-rtl-open.png`),
              });
              await writeFile(
                path.join(captureDir, `${prefix}.json`),
                JSON.stringify(
                  {
                    source,
                    family,
                    runtime,
                    theme,
                    viewport: { width: 320, height: 900 },
                    rootFontPx: 32,
                    geometry,
                    errors,
                    opticalPaintClaim: false,
                    gpuiClaim: false,
                  },
                  null,
                  2
                )
              );
            }
            expect(errors).toEqual([]);
          } catch (error) {
            await captureFailure(page, prefix, {
              family,
              runtime,
              theme,
              error: String(error),
              pageErrors: errors,
            });
            throw error;
          } finally {
            await context.close();
          }
        }, 120_000);
      }
});

describe.sequential('actual family Text selection and typography', () => {
  for (const family of families)
    for (const runtime of RUNTIMES) {
      it(`${family}/${runtime}: document Text stays selectable beside nonselectable Select content`, async () => {
        const { context, page, previewer } = await openRoute(
          browser,
          baseUrl,
          route(family, 'text'),
          { width: 1280, height: 900 }
        );
        try {
          await choosePreviewRuntime(page, previewer, runtime);
          await page.waitForFunction(
            ({ family, runtime }) => {
              const scope = document.querySelector<HTMLElement>(
                '[data-previewer-id] [data-projection-scope]'
              );
              return (
                scope?.dataset.projectionRuntime === runtime &&
                scope.dataset.projectionState === 'ready' &&
                scope.querySelectorAll(
                  `[data-projection-content] [data-projection-prototype="${family}-text-root"]`
                ).length === 4
              );
            },
            { family, runtime }
          );
          const text = previewer
            .locator(`[data-projection-content] [data-projection-prototype="${family}-text-root"]`)
            .first();
          await text.scrollIntoViewIfNeeded();
          const box = await text.boundingBox();
          if (!box) throw new Error('Actual Text has no painted bounds.');
          await page.mouse.click(box.x + Math.min(20, box.width / 2), box.y + box.height / 2, {
            clickCount: 3,
          });
          expect(await page.evaluate(() => getSelection()?.toString())).toContain(
            'A reusable Text atom'
          );
          expect(
            await text.evaluate(
              (node) =>
                Number.parseFloat(getComputedStyle(node).fontSize) /
                Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
            )
          ).toBe(1.875);
          expect(await text.evaluate((node) => node.getAttribute('role'))).toBeNull();
          expect(await text.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(-1);
          const trigger = previewer.locator(
            '[data-projection-control="runtime"] [role="combobox"]'
          );
          expect(await trigger.evaluate((node) => getComputedStyle(node).userSelect)).toBe('none');
          await page.evaluate(() => getSelection()?.removeAllRanges());
          const triggerBox = await trigger.boundingBox();
          if (!triggerBox) throw new Error('Actual family Select has no painted bounds.');
          await page.mouse.move(triggerBox.x + 4, triggerBox.y + triggerBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(
            triggerBox.x + triggerBox.width - 4,
            triggerBox.y + triggerBox.height / 2,
            { steps: 8 }
          );
          await page.mouse.up();
          expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
          await page.keyboard.press('Escape');
          if (captureDir)
            await previewer.screenshot({
              path: path.join(captureDir, `${family}-${runtime}-text-native-selection.png`),
            });
        } catch (error) {
          await captureFailure(page, `${family}-${runtime}-text`, {
            family,
            runtime,
            error: String(error),
          });
          throw error;
        } finally {
          await context.close();
        }
      }, 90_000);
    }
});
