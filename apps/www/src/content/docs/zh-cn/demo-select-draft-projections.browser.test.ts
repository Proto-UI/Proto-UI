// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, CDPSession, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withLiquidCardFailureObservation } from './library-liquid-card-observation';
import {
  collectSelectOverflowObservation,
  readSelectSourceBinding,
} from './select-overflow-observation';
import {
  RUNTIMES,
  runtimeSelectTrigger,
  choosePreviewRuntime,
  launchBrowser,
  openRoute,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const allFamilies = ['bootstrap-2-3-2', 'liquid-glass'] as const;
// Liquid Glass selection paint is 0.4/WIP. Bootstrap cases in this file stay on the 0.3 path.
// Unset does not register those cases: browser CI rejects status 'skipped'.
const includeLiquidWip = process.env.PUI_LIQUID_GLASS_INCLUDE_WIP === '1';
const families = includeLiquidWip
  ? allFamilies
  : allFamilies.filter((family) => family !== 'liquid-glass');
const route = (family: string, component = 'select') => `/en/ui-libraries/${family}/${component}/`;
let browser: Browser;
let baseUrl = '';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const captureDir = process.env.PROTO_UI_SELECT_SCREENSHOT_DIR;
async function captureFailure(page: Page, id: string, details: Record<string, unknown>) {
  if (!captureDir) return;
  const receipt: Record<string, unknown> = {
    source,
    ...details,
    opticalPaintClaim: false,
    gpuiClaim: false,
  };
  const save = () =>
    writeFile(path.join(captureDir, `${id}-failure.json`), JSON.stringify(receipt, null, 2));
  try {
    await save();
  } catch (error) {
    console.error('Select failure JSON could not be saved', String(error));
  }
  try {
    await page.screenshot({ path: path.join(captureDir, `${id}-failure.png`), timeout: 5000 });
  } catch (error) {
    receipt.screenshotError = String(error);
    try {
      await save();
    } catch (writeError) {
      console.error('Select screenshot failure could not be recorded', String(writeError));
    }
  }
  // Capture failures never replace the original assertion failure.
}

// Diagnostic snapshots are read-only, separate observations, not a claim that
// the snapshot and later screenshot represent the same renderer frame.
async function selectMaterialSnapshot(previewer: Locator, phase: string) {
  try {
    return await previewer.evaluate((root, phase) => {
      const rect = (node: Element) => {
        const value = node.getBoundingClientRect();
        return {
          left: value.left,
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          width: value.width,
          height: value.height,
        };
      };
      const describe = (node: HTMLElement) => {
        const css = getComputedStyle(node);
        return {
          tag: node.tagName,
          ref: node.dataset.demoRef ?? null,
          role: node.getAttribute('role'),
          connected: node.isConnected,
          bounds: rect(node),
          quality: node.dataset.materialQuality ?? null,
          reason: node.dataset.materialReason ?? null,
          source: node.dataset.materialSource ?? null,
          frame: node.dataset.materialFrame ?? null,
          sourceRevision: node.dataset.materialSourceRevision ?? null,
          carrier: node.getAttribute('data-pui-material-carrier'),
          display: css.display,
          visibility: css.visibility,
          opacity: css.opacity,
          overflowX: css.overflowX,
          overflowY: css.overflowY,
          contain: css.contain,
          transform: css.transform,
        };
      };
      const stages = Array.from(
        root.querySelectorAll<HTMLElement>('[data-projection-content] [data-material-scene]')
      );
      return {
        phase,
        observedAtMs: performance.now(),
        privateLeaseState: 'unavailable; public attributes only',
        // Record geometry rather than reimplement the private carrier validity
        // or paint-outset admission algorithm in this diagnostic test.
        stageCount: stages.length,
        omittedStageCount: Math.max(0, stages.length - 8),
        stages: stages.slice(0, 8).map((stage) => {
          const descendants = Array.from(stage.querySelectorAll<HTMLElement>('*'));
          const projection = stage.closest<HTMLElement>('[data-projection-scope]');
          return {
            stage: describe(stage),
            previewerId:
              stage.closest<HTMLElement>('[data-previewer-id]')?.dataset.previewerId ?? null,
            projectionState: projection?.dataset.projectionState ?? null,
            projectionRuntime: projection?.dataset.projectionRuntime ?? null,
            inertAncestor: !!stage.closest('[inert]'),
            descendantCount: descendants.length,
            omittedDescendantCount: Math.max(0, descendants.length - 200),
            descendants: descendants.slice(0, 200).map(describe),
          };
        }),
      };
    }, phase);
  } catch (error) {
    return { phase, observationError: String(error) };
  }
}

async function selectObservationWithin<T>(
  read: Promise<T>,
  label: string,
  onDeadline?: () => void
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read,
      new Promise<{ observationError: string }>((resolve) => {
        timer = setTimeout(() => {
          try {
            onDeadline?.();
          } catch {
            // Diagnostic cleanup cannot change the original case outcome.
          }
          resolve({ observationError: `${label} exceeded 1000ms.` });
        }, 1000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// Trigger text geometry is an observation, not an overflow assertion. A Range
// describes pre-clip text-fragment bounds; overflow/scroll/ellipsis may legally hide
// part of it. These reads do not scroll, focus, style or otherwise mutate DOM.
async function selectTriggerGeometrySnapshot(page: Page, phase: string) {
  try {
    return await selectObservationWithin(
      page.evaluate((phase) => {
        const rect = (value: DOMRect) => ({
          left: value.left,
          right: value.right,
          top: value.top,
          bottom: value.bottom,
          width: value.width,
          height: value.height,
        });
        const describe = (node: Element) => {
          const css = getComputedStyle(node);
          return {
            tag: node.localName,
            ref: node.getAttribute('data-demo-ref'),
            prototype: node.getAttribute('data-projection-prototype'),
            className: node.getAttribute('class'),
            rootStyleTokens: node.getAttribute('data-pui-style'),
            bounds: rect(node.getBoundingClientRect()),
            clientWidth: node.clientWidth,
            clientHeight: node.clientHeight,
            clientLeft: node.clientLeft,
            clientTop: node.clientTop,
            scrollWidth: node.scrollWidth,
            scrollHeight: node.scrollHeight,
            scrollLeft: node.scrollLeft,
            scrollTop: node.scrollTop,
            css: {
              display: css.display,
              position: css.position,
              direction: css.direction,
              fontSize: css.fontSize,
              fontFamily: css.fontFamily,
              lineHeight: css.lineHeight,
              whiteSpace: css.whiteSpace,
              overflowWrap: css.overflowWrap,
              wordBreak: css.wordBreak,
              width: css.width,
              minWidth: css.minWidth,
              maxWidth: css.maxWidth,
              flex: css.flex,
              flexWrap: css.flexWrap,
              boxSizing: css.boxSizing,
              paddingLeft: css.paddingLeft,
              paddingRight: css.paddingRight,
              borderLeftWidth: css.borderLeftWidth,
              borderRightWidth: css.borderRightWidth,
              overflowX: css.overflowX,
              overflowY: css.overflowY,
              textOverflow: css.textOverflow,
              overflowClipMargin: css.getPropertyValue('overflow-clip-margin'),
              lineClamp: css.getPropertyValue('-webkit-line-clamp'),
              clip: css.clip,
              clipPath: css.clipPath,
              maskImage: css.maskImage,
              contain: css.contain,
              contentVisibility: css.contentVisibility,
              transform: css.transform,
              visibility: css.visibility,
              opacity: css.opacity,
            },
          };
        };
        const parent = (node: Element): Element | null =>
          node.parentElement ??
          (node.getRootNode() instanceof ShadowRoot
            ? (node.getRootNode() as ShadowRoot).host
            : null);
        const ancestors = (node: Element) => {
          const items = [];
          let current: Element | null = node;
          for (; current && items.length < 24; current = parent(current))
            items.push(describe(current));
          return { items, truncated: !!current };
        };
        const authoredRtl = document.querySelector(
          '[data-demo-id="demo-bootstrap-2-3-2-select-rtl"]'
        );
        const previewer = authoredRtl ?? document.querySelector('[data-previewer-id]');
        const trigger = previewer?.querySelector<HTMLElement>(
          authoredRtl
            ? '.host [role="combobox"]'
            : '[data-projection-content] [data-demo-ref="rtlTrigger"]'
        );
        const valueNodes = trigger
          ? [...trigger.querySelectorAll<HTMLElement>('[data-display-value]')]
          : [];
        const values = valueNodes.slice(0, 4).map((value) => {
          const chain = ancestors(value);
          const walker = document.createTreeWalker(value, NodeFilter.SHOW_TEXT);
          const textRanges = [];
          let node: Node | null = null;
          let visited = 0;
          while ((node = walker.nextNode()) && visited++ < 128) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const allRects = [...range.getClientRects()];
            textRanges.push({
              textLength: node.textContent.length,
              parent: node.parentElement ? describe(node.parentElement) : null,
              rects: allRects.slice(0, 128).map(rect),
              rectsTruncated: allRects.length > 128,
            });
            range.detach();
          }
          return {
            value: describe(value),
            ancestors: chain,
            textRanges,
            textNodesTruncated: !!node,
            clippingCandidates: chain.items.filter(
              ({ css }) =>
                css.overflowX !== 'visible' ||
                css.overflowY !== 'visible' ||
                css.clip !== 'auto' ||
                css.clipPath !== 'none' ||
                css.maskImage !== 'none' ||
                /(?:paint|strict|content)/.test(css.contain)
            ),
          };
        });
        return {
          phase,
          observedAtMs: performance.now(),
          meaning:
            'Pre-clip text bounds and computed clip/scroll owners only; no visible-paint or product pass/fail inference.',
          viewport: {
            width: innerWidth,
            height: innerHeight,
            scrollX,
            scrollY,
            visual: visualViewport
              ? {
                  width: visualViewport.width,
                  height: visualViewport.height,
                  offsetLeft: visualViewport.offsetLeft,
                  offsetTop: visualViewport.offsetTop,
                  scale: visualViewport.scale,
                }
              : null,
          },
          document: describe(document.documentElement),
          htmlFontSize: getComputedStyle(document.documentElement).fontSize,
          fontStatus: document.fonts.status,
          trigger: trigger ? describe(trigger) : null,
          triggerAncestors: trigger ? ancestors(trigger) : null,
          values,
          valuesTruncated: valueNodes.length > values.length,
        };
      }, phase),
      phase
    );
  } catch (error) {
    return { phase, observationError: String(error) };
  }
}

// Optional Chromium metadata runs after the existing assertions and captures.
// Unsupported CDP, a missing Value, or the one-second read limit is recorded,
// never made a new precondition for the existing browser case.
async function selectTriggerPlatformFonts(page: Page) {
  let session: CDPSession | undefined;
  let expired = false;
  const expiredResult = { unavailable: 'Optional font observation expired.' };
  const observation = (async () => {
    try {
      session = await page.context().newCDPSession(page);
      if (expired) return expiredResult;
      await session.send('DOM.enable');
      if (expired) return expiredResult;
      await session.send('CSS.enable');
      if (expired) return expiredResult;
      const { root } = await session.send('DOM.getDocument', { depth: 1 });
      if (expired) return expiredResult;
      const authoredRtl = await session.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '[data-demo-id="demo-bootstrap-2-3-2-select-rtl"]',
      });
      const previewer = authoredRtl.nodeId
        ? authoredRtl
        : await session.send('DOM.querySelector', {
            nodeId: root.nodeId,
            selector: '[data-previewer-id]',
          });
      if (expired) return expiredResult;
      if (!previewer.nodeId) return { unavailable: 'The original Previewer is absent.' };
      const value = await session.send('DOM.querySelector', {
        nodeId: previewer.nodeId,
        selector: authoredRtl.nodeId
          ? '.host [role="combobox"] [data-display-value]'
          : '[data-projection-content] [data-demo-ref="rtlTrigger"] [data-projection-prototype$="-select-value"]',
      });
      if (expired) return expiredResult;
      if (!value.nodeId) return { unavailable: 'The original Select Value is absent.' };
      const fonts = await session.send('CSS.getPlatformFontsForNode', { nodeId: value.nodeId });
      return expired ? expiredResult : { method: 'CSS.getPlatformFontsForNode', ...fonts };
    } catch (error) {
      return { unavailable: String(error) };
    } finally {
      try {
        await session?.detach();
      } catch {
        // Cleanup failure cannot replace the original browser outcome.
      }
    }
  })();
  return selectObservationWithin(observation, 'Optional font observation', () => {
    expired = true;
    // The session belongs only to this page/case. Late replies cannot change
    // the returned timeout record or append evidence to another case.
    void session?.detach().catch(() => {});
  });
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
        family === 'bootstrap-2-3-2'
          ? '[data-projection-content] [aria-label="Produce selector"]'
          : '[data-projection-content] [data-demo-ref="uncontrolledTrigger"]'
      );
      return (
        scope?.dataset.projectionState === 'ready' &&
        scope.dataset.projectionRuntime === runtime &&
        trigger?.dataset.projectionPrototype === `${family}-select-trigger` &&
        trigger.textContent?.trim() === (family === 'bootstrap-2-3-2' ? 'Apple' : 'Alpha')
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
          const stageEvidence: Record<string, unknown>[] = [];
          const materialEvidence: unknown[] = [];
          const triggerGeometryEvidence: unknown[] = [];
          try {
            await page.evaluate((theme) => {
              document.documentElement.classList.remove('light', 'dark');
              document.documentElement.classList.add(theme);
              document.documentElement.dataset.theme = theme;
            }, theme);
            const runtimeMountStarted = performance.now();
            await choosePreviewRuntime(page, previewer, runtime);
            await waitReady(page, family, runtime);
            const demo = previewer.locator('[data-projection-content]');
            const bootstrap = family === 'bootstrap-2-3-2';
            const disabledPreview = bootstrap
              ? page.locator('[data-demo-id="demo-bootstrap-2-3-2-select-disabled"]')
              : previewer;
            if (bootstrap)
              await selectRuntime(page, disabledPreview, runtime, '[role="combobox"]', 2);
            const trigger = bootstrap
              ? disabledPreview.getByRole('combobox', {
                  name: 'Fruit selector with disabled item',
                  exact: true,
                })
              : demo.locator('[data-demo-ref="uncontrolledTrigger"]');
            const initialValue = bootstrap ? 'Disabled item inside' : 'Alpha';
            const firstChoice = bootstrap ? 'Apple' : 'Alpha';
            const nextChoice = bootstrap ? 'Pineapple' : 'Beta';
            async function stageSnapshot(phase: string) {
              if (family !== 'liquid-glass') return;
              const snapshot = await demo.evaluate((root) => ({
                scenes: [...root.querySelectorAll<HTMLElement>('[data-material-scene]')].map(
                  (scope) => {
                    const canvas = scope.querySelector<HTMLCanvasElement>(
                      ':scope > canvas[data-material-backdrop]'
                    );
                    const rect = scope.getBoundingClientRect();
                    return {
                      ref: scope.dataset.demoRef,
                      width: rect.width,
                      height: rect.height,
                      canvasCount: scope.querySelectorAll(':scope > canvas[data-material-backdrop]')
                        .length,
                      nominalCanvasRgbaBytes: canvas ? canvas.width * canvas.height * 4 : 0,
                      parentScene: !!scope.parentElement?.closest('[data-material-scene]'),
                    };
                  }
                ),
              }));
              stageEvidence.push({
                phase,
                elapsedSinceRuntimeSelectionMs: performance.now() - runtimeMountStarted,
                ...snapshot,
              });
              expect(snapshot.scenes).toHaveLength(4);
              expect(snapshot.scenes.map((item) => item.ref).sort()).toEqual(
                ['uncontrolledStage', 'disabledStage', 'controlledStage', 'selectRtlLayout'].sort()
              );
              for (const item of snapshot.scenes) {
                expect(item.canvasCount).toBe(1);
                expect(item.parentScene).toBe(false);
                expect(item.nominalCanvasRgbaBytes).toBeGreaterThan(0);
              }
            }
            await stageSnapshot('mounted');
            expect(await trigger.getAttribute('aria-expanded')).toBe('false');
            expect((await trigger.textContent())?.trim()).toBe(initialValue);
            // Runtime chrome is the active family's real Tabs recipe, separate
            // from the demonstrated Select and its popup below.
            const runtimeRoot = previewer.locator(
              `[data-projection-scope][data-projection-state="ready"] [data-projection-prototype="${family}-tabs-root"]`
            );
            expect(await runtimeRoot.count()).toBe(1);
            const toolbar = previewer.locator('[data-projection-control="runtime"]');
            expect(await toolbar.count()).toBe(1);
            expect(
              await runtimeRoot
                .locator('[data-projection-control="runtime"][data-runtime-tabs]')
                .count()
            ).toBe(1);
            expect(
              await toolbar.getByRole('tablist', { name: 'Runtime', exact: true }).count()
            ).toBe(1);
            expect(
              await toolbar.locator(`[data-projection-prototype="${family}-tabs-list"]`).count()
            ).toBe(1);
            expect(await toolbar.getByRole('tab').count()).toBe(RUNTIMES.length);
            expect(await toolbar.locator('[role="tab"][aria-selected="true"]').count()).toBe(1);
            const selected = runtimeSelectTrigger(previewer);
            expect(await selected.getAttribute('data-projection-prototype')).toBe(
              `${family}-tabs-trigger`
            );
            expect(await selected.getAttribute('data-projection-runtime')).toBe(runtime);
            expect((await selected.textContent())?.trim()).toBe(
              { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' }[runtime]
            );
            const panelId = await selected.getAttribute('aria-controls');
            if (!panelId) throw new Error('Runtime Tab has no stable Content relationship.');
            const panel = runtimeRoot.locator(`[id=${JSON.stringify(panelId)}]`);
            expect(await panel.count()).toBe(1);
            expect(await panel.getAttribute('role')).toBe('tabpanel');
            expect(await panel.getAttribute('data-projection-prototype')).toBe(
              `${family}-tabs-content`
            );
            expect(await panel.getAttribute('aria-labelledby')).toBe(
              await selected.getAttribute('id')
            );
            // Linked keepMounted panels can still be inactive or locked.
            expect(await panel.isVisible()).toBe(true);
            expect(
              await panel.evaluate((element) => {
                if (!element.isConnected) return false;
                for (
                  let node: HTMLElement | null = element as HTMLElement;
                  node;
                  node = node.parentElement
                ) {
                  if (
                    node.inert ||
                    node.matches('[hidden], [inert], [aria-hidden="true"], [aria-busy="true"]')
                  )
                    return false;
                  const style = getComputedStyle(node);
                  if (
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    style.visibility === 'collapse'
                  )
                    return false;
                }
                return true;
              })
            ).toBe(true);
            expect(await previewer.locator('.pui-runtime-preview-surface').count()).toBe(1);
            expect(await panel.locator('.pui-runtime-preview-surface').count()).toBe(1);
            expect(await panel.locator('[data-projection-content]').count()).toBe(1);
            expect(
              await previewer.evaluate((root) =>
                (
                  root as HTMLElement & {
                    __previewer__?: { getCurrentRuntime?: () => string | null };
                  }
                ).__previewer__?.getCurrentRuntime?.()
              )
            ).toBe(runtime);
            if (family === 'liquid-glass')
              materialEvidence.push(await selectMaterialSnapshot(previewer, 'before-open'));
            await trigger.focus();
            await page.keyboard.press('ArrowDown');
            const firstContent = await popup(page, trigger);
            if (family === 'liquid-glass') {
              materialEvidence.push(await selectMaterialSnapshot(previewer, 'popup-visible'));
              // Content is the transparent portal frame. Surface is the only
              // material owner; missing box metadata or an unconsumed plan must
              // fail, not silently pass via opaque fallback.
              const popupSurface = firstContent.locator('[data-demo-ref$="Surface"]');
              await expect
                .poll(() => popupSurface.getAttribute('data-material-quality'), { timeout: 20000 })
                .toBe('self-optical');
              await expect
                .poll(() => trigger.getAttribute('data-material-quality'), { timeout: 20000 })
                .toBe('self-optical');
              expect(
                await firstContent.evaluate(
                  (node) => node.closest<HTMLElement>('[data-material-scene]')?.dataset.demoRef
                )
              ).toBe('uncontrolledStage');
              await stageSnapshot('uncontrolled-open');
              if (captureDir)
                await previewer.screenshot({
                  path: path.join(captureDir, `${prefix}-owned-stage-open.png`),
                });
            }
            await page.waitForFunction(
              (firstChoice) =>
                document.activeElement?.getAttribute('role') === 'option' &&
                document.activeElement.textContent?.trim() === firstChoice,
              firstChoice
            );
            if (bootstrap)
              expect(
                await firstContent
                  .getByRole('option', { name: 'Grapes (Sold out)', exact: true })
                  .getAttribute('aria-disabled')
              ).toBe('true');
            await page.keyboard.press('ArrowDown');
            await page.waitForFunction(
              (nextChoice) => document.activeElement?.textContent?.trim() === nextChoice,
              nextChoice
            );
            expect((await trigger.textContent())?.trim()).toBe(initialValue);
            await page.keyboard.press('Enter');
            await trigger.getByText(nextChoice, { exact: true }).waitFor({ state: 'visible' });
            expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
            await trigger.click();
            await popup(page, trigger);
            await page.keyboard.press('End');
            await page.keyboard.press('Home');
            await page.keyboard.press(nextChoice[0]!.toLowerCase());
            await page.waitForFunction(
              (nextChoice) => document.activeElement?.textContent?.trim() === nextChoice,
              nextChoice
            );
            await page.keyboard.press('Escape');
            expect((await trigger.textContent())?.trim()).toBe(nextChoice);
            expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
            const disabled = bootstrap
              ? disabledPreview.getByRole('combobox', {
                  name: 'Disabled fruit selector',
                  exact: true,
                })
              : demo.locator('[data-demo-ref="disabledTrigger"]');
            expect(await disabled.getAttribute('aria-disabled')).toBe('true');
            expect(await disabled.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(-1);
            const controlled = bootstrap
              ? demo.getByRole('combobox', { name: 'Produce selector', exact: true })
              : demo.locator('[data-demo-ref="controlledTrigger"]');
            await controlled.click();
            const controlledContent = await popup(page, controlled);
            if (family === 'liquid-glass') {
              expect(
                await controlledContent.evaluate(
                  (node) => node.closest<HTMLElement>('[data-material-scene]')?.dataset.demoRef
                )
              ).toBe('controlledStage');
              await stageSnapshot('controlled-open');
            }
            if (bootstrap) {
              // The current authored consumer accepts requests and exposes Reset.
              // Controlled refusal stays in the Base contract and API-input tests.
              await controlledContent.getByRole('option', { name: 'Banana', exact: true }).click();
              await controlled.getByText('Banana', { exact: true }).waitFor({ state: 'visible' });
              await demo.getByRole('button', { name: 'Reset', exact: true }).click();
              await controlled.getByText('Apple', { exact: true }).waitFor({ state: 'visible' });
              expect(await controlled.getAttribute('aria-expanded')).toBe('false');
              await controlled.click();
              const reopened = await popup(page, controlled);
              expect(await reopened.getByRole('option').allTextContents()).toEqual([
                'Apple',
                'Banana',
                'Blueberry',
                'Carrot',
                'Broccoli',
                'Spinach',
              ]);
              await page.waitForFunction(
                () =>
                  document.activeElement?.getAttribute('role') === 'option' &&
                  document.activeElement.textContent?.trim() === 'Apple'
              );
              await page.keyboard.press('Escape');
            } else {
              await controlledContent.getByRole('option', { name: 'Beta', exact: true }).click();
              expect((await controlled.textContent())?.trim()).toBe('Alpha');
              await demo.getByRole('button', { name: 'Accept selection', exact: true }).click();
              await controlled.getByText('Beta', { exact: true }).waitFor({ state: 'visible' });
            }
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

            const rtlPreview = bootstrap
              ? page.locator('[data-demo-id="demo-bootstrap-2-3-2-select-rtl"]')
              : previewer;
            const scrollablePreview = bootstrap
              ? page.locator('[data-demo-id="demo-bootstrap-2-3-2-select-scrollable"]')
              : previewer;
            if (bootstrap) {
              for (const example of [rtlPreview, scrollablePreview])
                await selectRuntime(page, example, runtime, '[role="combobox"]', 1);
            }
            await page.setViewportSize({ width: 320, height: 900 });
            await page.evaluate(() => {
              document.documentElement.style.fontSize = '32px';
            });
            const rtl = bootstrap
              ? rtlPreview.getByRole('combobox', { name: 'اختر فاكهة', exact: true })
              : demo.locator('[data-demo-ref="rtlTrigger"]');
            await rtl.scrollIntoViewIfNeeded();
            if (captureDir)
              triggerGeometryEvidence.push(
                await selectTriggerGeometrySnapshot(page, 'rtl-320-text200-before-open')
              );
            await rtl.click();
            const rtlContent = await popup(page, rtl);
            const geometry = await rtlContent.evaluate((node, bootstrap) => {
              const surface = node.querySelector<HTMLElement>(
                '[data-projection-prototype$="-select-surface"]'
              );
              // Bootstrap's historical dropdown-menu chrome belongs to Content;
              // Liquid's optical paint belongs to its explicit Surface.
              const painted = bootstrap ? node : (surface ?? node);
              const style = getComputedStyle(node);
              const paint = getComputedStyle(painted);
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
                color: paint.color,
                background: paint.backgroundColor,
                backgroundImage: paint.backgroundImage,
                radius: paint.borderRadius,
              };
            }, bootstrap);
            if (captureDir)
              triggerGeometryEvidence.push(
                await selectTriggerGeometrySnapshot(page, 'rtl-320-text200-open')
              );
            await withLiquidCardFailureObservation(
              async () => {
                expect(geometry.direction).toBe('rtl');
                expect(geometry.left).toBeGreaterThanOrEqual(0);
                expect(geometry.right).toBeLessThanOrEqual(321);
                expect(geometry.width).toBeGreaterThan(40);
                expect(geometry.height).toBeGreaterThan(30);
                expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
                expect(geometry.indicatorRight).toBeLessThanOrEqual(geometry.labelLeft + 1);
                expect(geometry.selectedText).toContain(
                  bootstrap ? 'تفاح' : 'VeryLongUnbrokenOptionLabels'
                );
                // Read the family's paint owner. Optical success is a backdrop
                // image with a transparent color; opaque fallback is a solid fill.
                expect(
                  geometry.background !== 'rgba(0, 0, 0, 0)' || geometry.backgroundImage !== 'none'
                ).toBe(true);
                expect(Number.parseFloat(geometry.radius)).toBeGreaterThan(0);
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
                ).toBe(true);
              },
              () => page.evaluate(collectSelectOverflowObservation),
              async (observation) => {
                if (!captureDir) return;
                const binding = readSelectSourceBinding((args) =>
                  execFileSync('git', args, { encoding: 'utf8' })
                );
                await writeFile(
                  path.join(captureDir, `${prefix}-overflow.json`),
                  JSON.stringify({ ...binding, family, runtime, theme, observation }, null, 2),
                  { flag: 'wx' }
                );
              },
              (error) => console.warn('Select overflow observation unavailable', error),
              1000
            );
            await stageSnapshot('rtl-320-text200-open');
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
                    stageEvidence,
                    errors,
                    opticalPaintClaim: false,
                    gpuiClaim: false,
                  },
                  null,
                  2
                )
              );
            }
            if (bootstrap) {
              await page.keyboard.press('Escape');
              const timezone = scrollablePreview.getByRole('combobox', {
                name: 'Timezone selector',
                exact: true,
              });
              await timezone.scrollIntoViewIfNeeded();
              await timezone.click();
              const timezones = await popup(page, timezone);
              const longLabel = 'Australian Eastern Standard Time (AEST)';
              await timezones.getByRole('option', { name: longLabel, exact: true }).click();
              await timezone.getByText(longLabel, { exact: true }).waitFor({ state: 'visible' });
              await timezone.click();
              const longContent = await popup(page, timezone);
              const longGeometry = await longContent.evaluate((node) => {
                const rect = node.getBoundingClientRect();
                const selected = node.querySelector<HTMLElement>(
                  '[role="option"][aria-selected="true"]'
                )!;
                return {
                  left: rect.left,
                  right: rect.right,
                  width: rect.width,
                  height: rect.height,
                  scrollWidth: node.scrollWidth,
                  clientWidth: node.clientWidth,
                  labelScrollWidth: selected.scrollWidth,
                  labelClientWidth: selected.clientWidth,
                  selectedText: selected.textContent,
                  pageOverflow: document.documentElement.scrollWidth - innerWidth,
                };
              });
              expect(longGeometry.selectedText).toBe(longLabel);
              expect(longGeometry.left).toBeGreaterThanOrEqual(0);
              expect(longGeometry.right).toBeLessThanOrEqual(321);
              expect(longGeometry.width).toBeGreaterThan(40);
              expect(longGeometry.height).toBeGreaterThan(30);
              expect(longGeometry.scrollWidth).toBeLessThanOrEqual(longGeometry.clientWidth + 1);
              expect(longGeometry.labelScrollWidth).toBeLessThanOrEqual(
                longGeometry.labelClientWidth + 1
              );
              expect(longGeometry.pageOverflow).toBeLessThanOrEqual(1);
              if (captureDir) {
                await page.screenshot({
                  path: path.join(captureDir, `${prefix}-320-text200-long-open.png`),
                });
                await writeFile(
                  path.join(captureDir, `${prefix}-long-label.json`),
                  JSON.stringify({ source, family, runtime, theme, longGeometry }, null, 2)
                );
              }
            }
            expect(errors).toEqual([]);
          } catch (error) {
            if (family === 'liquid-glass')
              materialEvidence.push(await selectMaterialSnapshot(previewer, 'assertion-failure'));
            if (captureDir)
              triggerGeometryEvidence.push(
                await selectTriggerGeometrySnapshot(page, 'assertion-failure')
              );
            await captureFailure(page, prefix, {
              family,
              runtime,
              theme,
              error: String(error),
              pageErrors: errors,
              stageEvidence,
              materialEvidence,
            });
            throw error;
          } finally {
            if (captureDir) {
              try {
                const binding = readSelectSourceBinding((args) =>
                  execFileSync('git', args, { encoding: 'utf8' })
                );
                const platformFonts = await selectTriggerPlatformFonts(page);
                await writeFile(
                  path.join(captureDir, `${prefix}-trigger-geometry.json`),
                  JSON.stringify(
                    {
                      schemaVersion: 1,
                      ...binding,
                      family,
                      runtime,
                      theme,
                      observations: triggerGeometryEvidence,
                      platformFonts,
                      qualification:
                        'Read-only diagnostics; snapshots and screenshots are separate observations. Range bounds precede CSS clipping and are not a product verdict.',
                      opticalPaintClaim: false,
                      gpuiClaim: false,
                    },
                    null,
                    2
                  )
                );
              } catch (observationError) {
                console.warn(
                  'Select trigger observation could not be retained',
                  String(observationError)
                );
              }
            }
            await context.close();
          }
        }, 120_000);
      }
});

describe.sequential('actual family Text selection and typography', () => {
  for (const family of families)
    for (const runtime of RUNTIMES) {
      it(`${family}/${runtime}: document Text stays selectable beside nonselectable Select content`, async () => {
        const {
          context,
          page,
          previewer: hero,
        } = await openRoute(browser, baseUrl, route(family, 'text'), { width: 1280, height: 900 });
        // Keep the original 3xl rem-scaling criterion bound to the authored
        // scale example; the current hero now demonstrates the 2xl exception.
        const previewer =
          family === 'bootstrap-2-3-2'
            ? page.locator('[data-demo-id="demo-bootstrap-2-3-2-text-scale"]')
            : hero;
        try {
          await selectRuntime(
            page,
            previewer,
            runtime,
            family === 'bootstrap-2-3-2'
              ? '[data-pui-root]'
              : `[data-projection-prototype="${family}-text-root"]`,
            family === 'bootstrap-2-3-2' ? 7 : 4
          );
          const textNodes = previewer.locator(
            family === 'bootstrap-2-3-2'
              ? '.host .pui-runtime-preview-surface [data-pui-root]'
              : `.host [data-projection-prototype="${family}-text-root"]`
          );
          const text =
            family === 'bootstrap-2-3-2'
              ? textNodes.filter({ hasText: '3xl · Page Title' })
              : textNodes.first();
          await text.scrollIntoViewIfNeeded();
          const box = await text.boundingBox();
          if (!box) throw new Error('Actual Text has no painted bounds.');
          await page.mouse.click(box.x + Math.min(20, box.width / 2), box.y + box.height / 2, {
            clickCount: 3,
          });
          expect(await page.evaluate(() => getSelection()?.toString())).toContain(
            family === 'bootstrap-2-3-2' ? '3xl · Page Title' : 'A reusable Text atom'
          );
          const readTypography = () =>
            text.evaluate((node) => {
              const root = document.documentElement;
              const computed = getComputedStyle(node);
              return {
                rootFontSize: Number.parseFloat(getComputedStyle(root).fontSize),
                fontSize: Number.parseFloat(computed.fontSize),
                lineHeight: Number.parseFloat(computed.lineHeight),
                inlineRootFontSize: root.style.fontSize,
              };
            });
          const normalTypography = await readTypography();
          // P-BOOTSTRAP-2-3-2-TEXT-PROJECTION selects the standard rem size
          // except for the explicit 2xl recipe; both 3xl demos use text-3xl.
          expect(normalTypography.fontSize / normalTypography.rootFontSize).toBe(1.875);
          let enlargedTypography: Awaited<ReturnType<typeof readTypography>>;
          try {
            await page.evaluate((rootFontSize) => {
              document.documentElement.style.fontSize = String(rootFontSize * 2) + 'px';
            }, normalTypography.rootFontSize);
            enlargedTypography = await readTypography();
            expect(enlargedTypography.rootFontSize).toBe(normalTypography.rootFontSize * 2);
            expect(enlargedTypography.fontSize).toBeCloseTo(normalTypography.fontSize * 2, 3);
            expect(enlargedTypography.lineHeight).toBeCloseTo(normalTypography.lineHeight * 2, 3);
          } finally {
            await page.evaluate((inlineRootFontSize) => {
              document.documentElement.style.fontSize = inlineRootFontSize;
            }, normalTypography.inlineRootFontSize);
          }
          if (captureDir)
            await writeFile(
              path.join(
                captureDir,
                String(family) + '-' + runtime + '-text-native-typography.json'
              ),
              JSON.stringify(
                {
                  source,
                  family,
                  runtime,
                  normalTypography,
                  enlargedTypography: enlargedTypography!,
                  opticalPaintClaim: false,
                  gpuiClaim: false,
                },
                null,
                2
              )
            );
          expect(await text.evaluate((node) => node.getAttribute('role'))).toBeNull();
          expect(await text.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(-1);
          const trigger = runtimeSelectTrigger(previewer);
          expect(await trigger.evaluate((node) => getComputedStyle(node).userSelect)).toBe('none');
          await page.evaluate(() => getSelection()?.removeAllRanges());
          const triggerBox = await trigger.boundingBox();
          if (!triggerBox) throw new Error('Actual selected Runtime Tab has no painted bounds.');
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
