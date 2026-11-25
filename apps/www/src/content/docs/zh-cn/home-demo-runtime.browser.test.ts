// @vitest-environment node

import { revealHeaderPreferences } from './site-header-browser';
import {
  measureLabelTextDrag,
  observeLabelDescriptionSelection,
  recordLabelPointerTrace,
} from './label-selection-observer';
import type { Browser, Locator, Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeError, safeUrl } from '../../../../../../scripts/test/search-startup-profile.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, selectRuntime, startServer, stopServer } from './browser-harness';

const HOME_ROUTE = '/zh-cn/';
const HOME_SELECTOR = '[data-home-showcase]';
const CONTROL_OPTION_LABELS = {
  runtime: {
    wc: 'Web Components',
    react: 'React',
    vue: 'Vue',
    vue2: 'Vue 2',
  },
  family: {
    shadcn: 'Shadcn',
    brutalist: 'Brutalist',
    'bootstrap-2-3-2': 'Bootstrap 2.3.2 · WIP',
  },
} as const;

async function waitForHomeRuntime(page: Page, runtime: string): Promise<void> {
  await page.waitForFunction(
    ({ homeSelector, selectedRuntime }) => {
      const root = document.querySelector<HTMLElement>(homeSelector);
      const host = root?.querySelector<HTMLElement>('[data-home-demo-host]');
      const scope = host?.querySelector<HTMLElement>('[data-projection-scope]');
      return (
        root?.dataset.runnerState === 'ready' &&
        root?.dataset.runnerRuntime === selectedRuntime &&
        host?.getAttribute('aria-busy') === 'false' &&
        scope?.dataset.projectionRuntime === selectedRuntime &&
        scope?.dataset.projectionState === 'ready' &&
        (scope?.querySelector('[data-projection-content] [data-pui-root]') != null ||
          host?.textContent?.includes('[Home Demo Error]') === true)
      );
    },
    { homeSelector: HOME_SELECTOR, selectedRuntime: runtime },
    { timeout: 30_000 }
  );

  const error = await page.locator(`${HOME_SELECTOR} [data-home-demo-host]`).textContent();
  expect(error, `${runtime} home demo`).not.toContain('[Home Demo Error]');
}

async function portalControlledBy(page: Page, trigger: Locator): Promise<Locator> {
  const controlledId = await trigger.getAttribute('aria-controls');
  expect(controlledId, 'projection Select aria-controls').toBeTruthy();
  const portal = page.locator(`[id=${JSON.stringify(controlledId)}]`);
  const deadline = performance.now() + 10_000;
  await portal.waitFor({ state: 'visible', timeout: 10_000 });
  // Content can be measurable while its positioned Surface is still hidden.
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw new Error('Projection Select options did not become visible in time.');
  await portal.getByRole('option').first().waitFor({ state: 'visible', timeout: remaining });
  return portal;
}

async function chooseProjectionControl(
  page: Page,
  _root: Locator,
  control: 'runtime' | 'family',
  value: string
): Promise<void> {
  await revealHeaderPreferences(page);
  const owner = page.locator('[data-homepage-runtime] [data-projection-generation-state="active"]');
  const trigger = owner.locator(`[data-projection-control="${control}"] [role="combobox"]`);
  await trigger.click();
  const portal = await portalControlledBy(page, trigger);
  const optionLabel = (CONTROL_OPTION_LABELS[control] as Readonly<Record<string, string>>)[value];
  if (!optionLabel) throw new Error(`Unknown ${control} projection option ${value}.`);
  await portal.getByRole('option', { name: optionLabel, exact: true }).click();
  // Selecting an option requests a new generation. Read the committed family
  // and runtime before locating controls that still belong to the old view.
  await page.waitForFunction(
    ({ control, value }) => {
      const owner = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const home = document.querySelector<HTMLElement>('[data-home-showcase]');
      return (
        owner?.dataset.runtimeState === 'ready' &&
        owner.dataset[control] === value &&
        home?.dataset.runnerState === 'ready' &&
        home.dataset[control === 'runtime' ? 'runnerRuntime' : 'projectionFamily'] === value
      );
    },
    { control, value }
  );
}

async function chooseRuntime(page: Page, root: Locator, runtime: string) {
  await chooseProjectionControl(page, root, 'runtime', runtime);
  await waitForHomeRuntime(page, runtime);
}

async function createHomeGalleryObservation(
  page: Page,
  evidenceLabel: string,
  initialColorScheme: 'light' | 'dark'
) {
  const home = page.locator(HOME_SELECTOR);
  const stage = home.locator('[data-home-gallery-stage]');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const sample = () =>
    stage.evaluate((node) => {
      const stage = node as HTMLElement;
      const bounds = stage.getBoundingClientRect();
      const gallery = stage.closest<HTMLElement>('.home-gallery')!;
      const viewport = stage.closest<HTMLElement>('[data-home-gallery-viewport]')!;
      const fade = getComputedStyle(viewport, '::after');
      const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
      // Split only top-level commas: CSS color functions may contain their own
      // commas or spaces. Do not depend on rgb(), lab() or color() serialization.
      const gradientParts: string[] = [];
      if (
        fade.backgroundImage.startsWith('linear-gradient(') &&
        fade.backgroundImage.endsWith(')')
      ) {
        const argumentsText = fade.backgroundImage.slice('linear-gradient('.length, -1);
        let depth = 0;
        let start = 0;
        for (let index = 0; index < argumentsText.length; index += 1) {
          const character = argumentsText[index];
          if (character === '(') depth += 1;
          else if (character === ')') depth -= 1;
          else if (character === ',' && depth === 0) {
            gradientParts.push(argumentsText.slice(start, index).trim());
            start = index + 1;
          }
        }
        if (depth === 0) gradientParts.push(argumentsText.slice(start).trim());
        else gradientParts.length = 0;
      }
      let fadeFirstStopColor: string | null = null;
      // The optional first argument is a direction; never skip a parsed color
      // for a later, more convenient stop (its alpha must independently be 255).
      for (const stop of gradientParts.slice(0, 2)) {
        if (CSS.supports('color', stop)) {
          fadeFirstStopColor = stop;
          break;
        }
        let depth = 0;
        for (let index = 0; index < stop.length; index += 1) {
          const character = stop[index];
          if (character === '(') depth += 1;
          else if (character === ')') depth -= 1;
          else if (/\s/.test(character) && depth === 0) {
            const color = stop.slice(0, index).trim();
            if (CSS.supports('color', color)) {
              fadeFirstStopColor = color;
              break;
            }
          }
        }
        if (fadeFirstStopColor) break;
      }
      // This canvas is never attached to the document. Its sRGB pixel provides
      // one color space for both computed values without changing page styles.
      const colorContext =
        typeof OffscreenCanvas === 'function'
          ? new OffscreenCanvas(1, 1).getContext('2d', { colorSpace: 'srgb' })
          : null;
      const normalizedColors: Array<number[] | null> = [];
      for (const color of [fadeFirstStopColor, bodyBackgroundColor]) {
        if (!colorContext || !color || !CSS.supports('color', color)) {
          normalizedColors.push(null);
          continue;
        }
        colorContext.clearRect(0, 0, 1, 1);
        // Unsupported canvas colors stay transparent and fail the opaque check.
        colorContext.fillStyle = 'rgba(0, 0, 0, 0)';
        colorContext.fillStyle = color;
        colorContext.fillRect(0, 0, 1, 1);
        normalizedColors.push([...colorContext.getImageData(0, 0, 1, 1).data]);
      }
      const [fadeFirstStopRgba, bodyBackgroundRgba] = normalizedColors;
      const fadeColorMeasurementError = !fadeFirstStopColor
        ? 'Cannot parse the first computed linear-gradient color stop'
        : !colorContext
          ? 'OffscreenCanvas sRGB 2D context is unavailable'
          : !fadeFirstStopRgba || !bodyBackgroundRgba
            ? 'Cannot normalize the computed gradient stop and body colors'
            : null;
      const source = gallery.querySelector('.home-gallery__attribution-link')!;
      const card = stage.querySelector<HTMLElement>(
        '[data-gallery-demo="controls"] [data-projection-prototype="shadcn-card-root"]'
      )!;
      const home = stage.closest<HTMLElement>('[data-home-showcase]')!;
      return {
        viewportWidth: innerWidth,
        theme: document.documentElement.dataset.theme,
        runtime: home.dataset.runnerRuntime,
        generation: home.dataset.projectionGeneration,
        liveRoots: stage.querySelectorAll('[data-pui-root]').length,
        cardPaint: {
          background: getComputedStyle(card).backgroundColor,
          color: getComputedStyle(card).color,
        },
        inert: stage.inert,
        columnCount: new Set(
          [...stage.querySelectorAll('.home-gallery__column')].map(
            (column) => column.getBoundingClientRect().left
          )
        ).size,
        cardCount: stage.querySelectorAll('[data-gallery-demo]').length,
        noOverflow:
          bounds.left >= -1 &&
          bounds.right <= innerWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1,
        fitsGallery:
          Math.abs(bounds.width - gallery.getBoundingClientRect().width) <= 1 &&
          Math.abs(bounds.width - viewport.getBoundingClientRect().width) <= 1,
        stageWidth: bounds.width,
        galleryWidth: gallery.getBoundingClientRect().width,
        fadeViewportWidth: viewport.getBoundingClientRect().width,
        fade: fade.backgroundImage,
        fadeFirstStopColor,
        fadeFirstStopRgba,
        bodyBackgroundColor,
        bodyBackgroundRgba,
        fadeColorMeasurementError,
        fadeHeight: Number.parseFloat(fade.height),
        fadeViewportHeight: Number.parseFloat(getComputedStyle(viewport).height),
        rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        fadePointerEvents: fade.pointerEvents,
        fadeVisible: fade.visibility === 'visible',
        sourceOutsideStage: !stage.contains(source),
        sourceOutsideViewport: !viewport.contains(source),
      };
    });
  const evidenceDirectory = path.join(
    process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ||
      path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'homepage-evidence'),
    'mobile-live-preview'
  );
  await mkdir(evidenceDirectory, { recursive: true });
  const source = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
  };
  const capture = async (name: string) => {
    // Native layout and ResizeObserver delivery settle across real frames;
    // neither this observer nor the capture changes component state.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const facts = await sample();
    const id = `${evidenceLabel}-${name}`;
    await writeFile(
      path.join(evidenceDirectory, `${id}.json`),
      JSON.stringify(
        { source, initialColorScheme, facts, errors, url: safeUrl(page.url(), baseUrl) },
        null,
        2
      )
    );
    await page.screenshot({ path: path.join(evidenceDirectory, `${id}.png`), fullPage: true });
    return facts;
  };
  const expectCompactPreview = (facts: Awaited<ReturnType<typeof sample>>) => {
    expect(facts).toMatchObject({
      inert: true,
      columnCount: 5,
      cardCount: 10,
      noOverflow: true,
      fitsGallery: true,
      fadePointerEvents: 'none',
      fadeVisible: true,
      sourceOutsideStage: true,
      sourceOutsideViewport: true,
    });
    expect(facts.liveRoots).toBeGreaterThan(0);
    expect(facts.fade).toContain('linear-gradient');
    expect(facts.fadeHeight).toBeCloseTo(
      Math.min(8 * facts.rootFontSize, facts.fadeViewportHeight * 0.28),
      1
    );
    expect(facts.fadeColorMeasurementError).toBeNull();
    expect(facts.fadeFirstStopRgba).not.toBeNull();
    expect(facts.bodyBackgroundRgba).not.toBeNull();
    expect(facts.fadeFirstStopRgba?.[3]).toBe(255);
    expect(facts.bodyBackgroundRgba?.[3]).toBe(255);
    expect(facts.fadeFirstStopRgba).toEqual(facts.bodyBackgroundRgba);
  };
  return { home, stage, errors, sample, capture, expectCompactPreview };
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await startServer(HOME_ROUTE);
  browser = await launchBrowser();
}, 150_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Homepage Runtime demobox browser smoke', () => {
  it('keeps the compact Bootstrap homepage checkbox operable through its visible label', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      const home = page.locator(HOME_SELECTOR);
      await chooseRuntime(page, home, 'wc');
      await chooseProjectionControl(page, home, 'family', 'bootstrap-2-3-2');
      const choices = home.locator('[data-demo-ref="choice-product"]').locator('xpath=..');
      const control = choices.getByRole('checkbox', { name: '产品更新', exact: true });
      const label = choices.getByText('产品更新', { exact: true });
      const layout = await control.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        radius: getComputedStyle(node).borderRadius,
      }));
      expect(layout).toEqual({ width: 14, height: 14, radius: '2px' });
      expect(await control.getAttribute('aria-checked')).toBe('true');
      await label.click();
      await expect.poll(() => control.getAttribute('aria-checked')).toBe('false');
      await control.press('Space');
      await expect.poll(() => control.getAttribute('aria-checked')).toBe('true');
    } finally {
      await context.close();
    }
  }, 60_000);

  it('keeps Bootstrap editor tab labels from selecting without blocking the panel or editor', async () => {
    // C-CONTENT-SELECTION-AFFORDANCE-0001: suppress only the action subject.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const text = '可选择的预览内容';
    const dragText = async (locator: Locator) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const { left, right, top, height } = range.getBoundingClientRect();
        return { left, right, y: top + height / 2 };
      });
      expect(box.right - box.left).toBeGreaterThan(4);
      await page.mouse.click(box.left + 1, box.y);
      await page.mouse.move(box.left + 1, box.y);
      await page.mouse.down();
      await page.mouse.move(box.right - 1, box.y, { steps: 12 });
      await page.mouse.up();
      return page.evaluate(() => window.getSelection()?.toString() ?? '');
    };
    try {
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      const home = page.locator(HOME_SELECTOR);
      await chooseRuntime(page, home, 'wc');
      await chooseProjectionControl(page, home, 'family', 'bootstrap-2-3-2');
      const editorCard = home.locator('[data-gallery-demo="editor"]');
      const edit = editorCard.getByRole('tab', { name: '编辑', exact: true });
      const preview = editorCard.getByRole('tab', { name: '预览', exact: true });
      await expect
        .poll(() =>
          editorCard.locator('[data-projection-prototype="bootstrap-2-3-2-tabs-trigger"]').count()
        )
        .toBe(2);

      const editor = editorCard.getByRole('textbox', { name: '编辑示例文本', exact: true });
      await editor.fill(text);
      await editor.press('ControlOrMeta+A');
      expect(
        await editor.evaluate((node) => {
          const input = node as HTMLTextAreaElement;
          return input.value.slice(input.selectionStart, input.selectionEnd);
        })
      ).toBe(text);

      await preview.click();
      await expect.poll(() => preview.getAttribute('aria-selected')).toBe('true');
      expect(await preview.evaluate((node) => getComputedStyle(node).userSelect)).toBe('none');
      expect(await dragText(preview)).toBe('');
      expect(await dragText(editorCard.getByText(text, { exact: true }))).toContain(
        text.slice(1, -1)
      );

      await edit.click();
      await expect.poll(() => edit.getAttribute('aria-selected')).toBe('true');
      expect(await editor.inputValue()).toBe(text);
      await edit.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => preview.getAttribute('aria-selected')).toBe('true');
      expect(await preview.evaluate((node) => document.activeElement === node)).toBe(true);
      expect(await edit.evaluate((node) => getComputedStyle(node).userSelect)).toBe('none');
    } finally {
      await context.close();
    }
  }, 15_000);

  it('separates action-label selection from useful content and native editor selection across runtimes', async () => {
    // C-CONTENT-SELECTION-AFFORDANCE-0001: actual Chromium mouse/keyboard input;
    // source-token and happy-dom assertions alone cannot prove this behavior.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const evidenceDirectory =
      process.env.PUI_CONTENT_SELECTION_EVIDENCE_DIR ??
      (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
        ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'content-selection')
        : undefined);
    const selectByDragging = async (target: Locator) => {
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error('Selection target has no visible bounds');
      // Reset through the target itself. Clicking the document corner would
      // dismiss a modal before its description could be selected.
      await page.mouse.click(box.x + 2, box.y + box.height / 2);
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      return page.evaluate(() => window.getSelection()?.toString() ?? '');
    };
    try {
      if (evidenceDirectory) await mkdir(evidenceDirectory, { recursive: true });
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      const home = page.locator(HOME_SELECTOR);
      for (const runtime of RUNTIMES) {
        await chooseRuntime(page, home, runtime);
        const editorCard = home.locator('[data-gallery-demo="editor"]');
        const action = editorCard.getByRole('button', { name: '斜体', exact: true });
        await action.waitFor({ state: 'visible' });
        expect(await action.evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
        expect(await selectByDragging(action)).not.toContain('斜体');
        if (evidenceDirectory) {
          await editorCard.screenshot({
            path: path.join(evidenceDirectory, `selection-${runtime}-action.png`),
          });
        }
        const activeBefore = await action.getAttribute('aria-pressed');
        await action.focus();
        await page.keyboard.press('Space');
        await expect
          .poll(() => action.getAttribute('aria-pressed'))
          .toBe(activeBefore === 'true' ? 'false' : 'true');

        const title = editorCard.getByRole('heading', { name: '文本编辑', exact: true });
        expect(await selectByDragging(title)).toContain('文本编辑');
        if (evidenceDirectory) {
          await editorCard.screenshot({
            path: path.join(evidenceDirectory, `selection-${runtime}-content.png`),
          });
        }

        const editor = editorCard.getByRole('textbox', { name: '编辑示例文本', exact: true });
        await editor.fill('Selection survives native editing');
        // Select the editor's value, including wrapped visual lines.
        await editor.press('ControlOrMeta+A');
        expect(
          await editor.evaluate((el) => {
            const input = el as HTMLTextAreaElement;
            return input.value.slice(input.selectionStart, input.selectionEnd);
          })
        ).toBe('Selection survives native editing');

        const open = home.getByRole('button', { name: '打开对话框', exact: true });
        await open.click();
        const dialog = page.getByRole('dialog', { name: '确认这次选择？', exact: true });
        await dialog.waitFor({ state: 'visible' });
        // Playwright visibility permits opacity:0. Wait for the real enter
        // lifecycle and finite native animations before measuring a range or
        // capturing it; a passing DOM Selection is not visual-readiness proof.
        const dialogHandle = await dialog.elementHandle();
        const mask = page.locator('[data-demo-ref="gallery-dialog-mask"]');
        await expect.poll(() => mask.count()).toBe(1);
        await mask.waitFor({ state: 'visible' });
        const maskHandle = await mask.elementHandle();
        if (!dialogHandle || !maskHandle)
          throw new Error('Dialog content and mask must materialize');
        const waitForEnteredDialog = async () => {
          for (const handle of [dialogHandle, maskHandle]) {
            await expect.poll(() => handle.getAttribute('data-transition-state')).toBe('entered');
            await handle.evaluate(async (element) => {
              await Promise.all(
                element
                  .getAnimations({ subtree: true })
                  .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
                  .map((animation) => animation.finished.catch(() => {}))
              );
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
              );
            });
            await expect
              .poll(() =>
                handle.evaluate((element) => {
                  for (
                    let current: Element | null = element;
                    current;
                    current = current.parentElement
                  ) {
                    const style = getComputedStyle(current);
                    if (
                      style.display === 'none' ||
                      style.visibility !== 'visible' ||
                      Number(style.opacity) === 0
                    )
                      return false;
                  }
                  return element.isConnected && getComputedStyle(element).opacity === '1';
                })
              )
              .toBe(true);
          }
          await expect
            .poll(() =>
              dialogHandle.evaluate((element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const top = document.elementFromPoint(
                  rect.x + rect.width / 2,
                  rect.y + rect.height / 2
                );
                return (
                  element.isConnected &&
                  style.opacity === '1' &&
                  style.visibility === 'visible' &&
                  rect.width > 0 &&
                  rect.height > 0 &&
                  (top === element || (!!top && element.contains(top)))
                );
              })
            )
            .toBe(true);
        };
        await waitForEnteredDialog();
        const description = dialog.getByText('这是一个可操作的对话框示例。', { exact: true });
        expect(await selectByDragging(description)).toContain('可操作的对话框');
        await waitForEnteredDialog();
        expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toContain(
          '可操作的对话框'
        );
        if (evidenceDirectory) {
          await writeFile(
            path.join(evidenceDirectory, `selection-${runtime}-dialog-facts.json`),
            JSON.stringify(
              await dialog.evaluate((element) => ({
                transition: element.getAttribute('data-transition-state'),
                opacity: getComputedStyle(element).opacity,
                visibility: getComputedStyle(element).visibility,
                rect: element.getBoundingClientRect().toJSON(),
                selection: window.getSelection()?.toString() ?? '',
              })),
              null,
              2
            )
          );
          await page.screenshot({
            path: path.join(evidenceDirectory, `selection-${runtime}-dialog.png`),
          });
        }
        await page.keyboard.press('Escape');
        await expect.poll(() => dialog.isVisible()).toBe(false);
      }
    } catch (error) {
      if (evidenceDirectory) {
        await page
          .screenshot({ path: path.join(evidenceDirectory, 'selection-readiness-failure.png') })
          .catch(() => {});
      }
      throw error;
    } finally {
      await context.close();
    }
  }, 150_000);

  it('remounts the homepage transaction and follows adapter preference across all runtimes', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
    const home = page.locator(HOME_SELECTOR);
    const globalRoot = page.locator('[data-homepage-runtime]');

    try {
      await home.waitFor({ state: 'visible' });
      await waitForHomeRuntime(page, 'wc');
      for (const runtime of RUNTIMES) {
        await chooseRuntime(page, home, runtime);
        await expect
          .poll(
            () =>
              globalRoot
                .locator('[data-projection-control="runtime"] [role="combobox"]')
                .evaluate((element) => document.activeElement === element),
            { timeout: 10_000 }
          )
          .toBe(true);
        expect(
          await page.locator('[data-homepage-runtime]').getAttribute('data-runtime'),
          `${runtime} global preference`
        ).toBe(runtime);
      }

      await globalRoot.locator('[data-projection-control="runtime"] [role="combobox"]').click();
      await page.getByRole('option', { name: 'Vue', exact: true }).last().click();
      await waitForHomeRuntime(page, 'vue');
      expect(await home.getAttribute('data-runner-runtime')).toBe('vue');
    } finally {
      await context.close();
    }
  }, 180_000);

  it('reveals React only after complete dark-mode style projection', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
    const home = page.locator(HOME_SELECTOR);

    try {
      await waitForHomeRuntime(page, 'wc');
      await page.evaluate((homeSelector) => {
        const root = document.querySelector<HTMLElement>(homeSelector);
        const host = root?.querySelector<HTMLElement>('[data-home-demo-host]');
        if (!host) throw new Error('Homepage demo host is required.');
        const samples: Array<{
          ref: string;
          revealing: boolean;
          style: string;
          transitionDuration: string;
          visibilityTransitions: string[];
          visibility: string;
          ancestry: Array<{
            tag: string;
            pending: boolean;
            visibility: string;
            inlineVisibility: string;
            opacity: string;
            generationState: string | null;
            ariaHidden: string | null;
            inert: boolean;
          }>;
        }> = [];
        const guardReleaseSamples: Array<{
          visibility: string;
          visibilityTransitions: string[];
          stage: string | null;
          inert: boolean;
          opacity: string;
        }> = [];
        (window as typeof window & { __homeMountSamples?: typeof samples }).__homeMountSamples =
          samples;
        (
          window as typeof window & {
            __homeRevealGuardReleaseSamples?: typeof guardReleaseSamples;
          }
        ).__homeRevealGuardReleaseSamples = guardReleaseSamples;
        const publishedSamples: Array<{
          pending: boolean;
          visibility: string;
          visibilityTransitions: string[];
          ownerInert: boolean;
          ownerOpacity: string;
        }> = [];
        (
          window as typeof window & { __homePublishedSamples?: typeof publishedSamples }
        ).__homePublishedSamples = publishedSamples;
        const publicationObserver = new MutationObserver(() => {
          const generation = host.querySelector<HTMLElement>(
            '[data-projection-generation-state="active"]'
          );
          const activeScope = generation?.querySelector<HTMLElement>('[data-projection-scope]');
          if (!generation || activeScope?.dataset.projectionRuntime !== 'react') return;
          for (const surface of generation.querySelectorAll<HTMLElement>(
            '[data-projection-content] [data-home-react-reveal-sample]'
          )) {
            publishedSamples.push({
              pending: surface.hasAttribute('data-pui-view-pending'),
              visibility: getComputedStyle(surface).visibility,
              visibilityTransitions: surface
                .getAnimations()
                .filter((animation) => 'transitionProperty' in animation)
                .map((animation) => (animation as CSSTransition).transitionProperty),
              ownerInert: generation.inert,
              ownerOpacity: getComputedStyle(generation).opacity,
            });
          }
          publicationObserver.disconnect();
        });
        publicationObserver.observe(host, {
          attributes: true,
          attributeFilter: ['data-projection-generation-state'],
          subtree: true,
        });
        const removeAttribute = Element.prototype.removeAttribute;
        Element.prototype.removeAttribute = function (name) {
          const samplesReveal =
            name === 'data-pui-view-pending' &&
            this instanceof HTMLElement &&
            this.hasAttribute(name) &&
            this.hasAttribute('data-pui-root') &&
            [
              'settings-view-trigger',
              'settings-summary',
              'settings-note',
              'settings-save',
              'settings-reset',
            ].includes(this.getAttribute('data-demo-ref') ?? '') &&
            this.closest('[data-projection-content]') != null &&
            host.contains(this);
          const samplesGuardRelease =
            name === 'data-pui-view-revealing' &&
            this instanceof HTMLElement &&
            this.hasAttribute(name) &&
            this.hasAttribute('data-home-react-reveal-sample') &&
            !this.hasAttribute('data-pui-view-pending') &&
            this.closest('[data-projection-content]') != null &&
            host.contains(this);
          const result = removeAttribute.call(this, name);
          if (samplesReveal) {
            this.setAttribute('data-home-react-reveal-sample', '');
            const style = getComputedStyle(this);
            samples.push({
              ref: this.getAttribute('data-demo-ref') ?? '',
              revealing: this.hasAttribute('data-pui-view-revealing'),
              style: this.getAttribute('data-pui-style') ?? '',
              transitionDuration: style.transitionDuration,
              visibilityTransitions: this.getAnimations()
                .filter((animation) => 'transitionProperty' in animation)
                .map((animation) => (animation as CSSTransition).transitionProperty),
              visibility: style.visibility,
              ancestry: (() => {
                const ancestors = [];
                for (
                  let node: HTMLElement | null = this as HTMLElement;
                  node;
                  node = node.parentElement
                ) {
                  const computed = getComputedStyle(node);
                  ancestors.push({
                    tag: node.tagName,
                    pending: node.hasAttribute('data-pui-view-pending'),
                    visibility: computed.visibility,
                    inlineVisibility: node.style.visibility,
                    opacity: computed.opacity,
                    generationState: node.getAttribute('data-projection-generation-state'),
                    ariaHidden: node.getAttribute('aria-hidden'),
                    inert: node.inert,
                  });
                }
                return ancestors;
              })(),
            });
          }
          if (samplesGuardRelease) {
            guardReleaseSamples.push({
              visibility: getComputedStyle(this).visibility,
              stage:
                this.closest<HTMLElement>('[data-projection-generation-state]')?.dataset
                  .projectionGenerationState ?? null,
              inert:
                this.closest<HTMLElement>('[data-projection-generation-state]')?.inert ?? false,
              opacity: getComputedStyle(
                this.closest<HTMLElement>('[data-projection-generation-state]')!
              ).opacity,
              visibilityTransitions: this.getAnimations()
                .filter((animation) => 'transitionProperty' in animation)
                .map((animation) => (animation as CSSTransition).transitionProperty),
            });
          }
          return result;
        };
      }, HOME_SELECTOR);

      await chooseRuntime(page, home, 'react');
      const samples = await page.evaluate(
        () =>
          (
            window as typeof window & {
              __homeMountSamples?: Array<{
                ref: string;
                revealing: boolean;
                style: string;
                transitionDuration: string;
                visibilityTransitions: string[];
                visibility: string;
                ancestry: Array<{
                  tag: string;
                  pending: boolean;
                  visibility: string;
                  inlineVisibility: string;
                  opacity: string;
                  generationState: string | null;
                  ariaHidden: string | null;
                  inert: boolean;
                }>;
              }>;
            }
          ).__homeMountSamples ?? []
      );
      expect(samples).toHaveLength(5);
      for (const sample of samples) {
        expect(sample.revealing).toBe(true);
        // Adapter readiness precedes the whole-page publication barrier. It must
        // have complete style while its generation remains unpainted and inert.
        expect(
          sample.ancestry.find((ancestor) => ancestor.generationState === 'staging'),
          `React staged reveal: ${JSON.stringify(sample)}`
        ).toMatchObject({ inert: true, opacity: '0', ariaHidden: 'true' });
        expect(sample.transitionDuration).toBe('0s');
        expect(sample.visibilityTransitions).not.toContain('visibility');
        expect(sample.style.trim(), `${sample.ref} style is ready before publication`).not.toBe('');
        if (sample.ref === 'settings-save' || sample.ref === 'settings-reset') {
          const tokens = sample.style.split(/\s+/);
          expect(tokens).toContain('transition-all');
          expect(tokens).toContain('min-h-8');
          expect(tokens).toContain('h-auto');
        }
      }

      await page.waitForFunction(
        (homeSelector) =>
          !document
            .querySelector<HTMLElement>(homeSelector)
            ?.querySelector('[data-pui-view-revealing]'),
        HOME_SELECTOR,
        { timeout: 10_000 }
      );
      const guardReleaseSamples = await page.evaluate(
        () =>
          (
            window as typeof window & {
              __homeRevealGuardReleaseSamples?: Array<{
                visibility: string;
                visibilityTransitions: string[];
                stage: string | null;
                inert: boolean;
                opacity: string;
              }>;
            }
          ).__homeRevealGuardReleaseSamples ?? []
      );
      expect(guardReleaseSamples).toHaveLength(5);
      for (const sample of guardReleaseSamples) {
        if (sample.stage === 'staging') {
          expect(sample.inert).toBe(true);
          expect(sample.opacity).toBe('0');
        } else {
          expect(sample.stage).toBe('active');
          expect(sample.visibility).toBe('visible');
        }
        expect(sample.visibilityTransitions).not.toContain('visibility');
      }
      const publishedSamples = await page.evaluate(
        () =>
          (
            window as typeof window & {
              __homePublishedSamples?: Array<{
                pending: boolean;
                visibility: string;
                visibilityTransitions: string[];
                ownerInert: boolean;
                ownerOpacity: string;
              }>;
            }
          ).__homePublishedSamples ?? []
      );
      expect(
        publishedSamples,
        'first published generation must expose all five ready task input/action surfaces'
      ).toHaveLength(5);
      for (const sample of publishedSamples) {
        expect(sample).toMatchObject({
          pending: false,
          visibility: 'visible',
          ownerInert: false,
          ownerOpacity: '1',
        });
        expect(sample.visibilityTransitions).not.toContain('visibility');
      }
      const revealedRoots = await home
        .locator('[data-projection-content] [data-home-react-reveal-sample]')
        .evaluateAll((roots) =>
          roots.map((root) => ({
            revealing: root.hasAttribute('data-pui-view-revealing'),
            visibility: getComputedStyle(root).visibility,
            visibilityTransitions: root
              .getAnimations()
              .filter((animation) => 'transitionProperty' in animation)
              .map((animation) => (animation as CSSTransition).transitionProperty),
          }))
        );
      expect(revealedRoots).toHaveLength(5);
      for (const root of revealedRoots) {
        expect(root.revealing).toBe(false);
        expect(root.visibility).toBe('visible');
        expect(root.visibilityTransitions).not.toContain('visibility');
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('fills the mobile preview with live components and enters the same gallery through the Hero Demo link', async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 900 },
        colorScheme,
      });
      try {
        const page = await context.newPage();
        const { home, stage, errors, sample, capture, expectCompactPreview } =
          await createHomeGalleryObservation(page, `entry-${colorScheme}`, colorScheme);
        await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
        await waitForHomeRuntime(page, 'wc');
        const mainButton = home.getByRole('button', {
          name: '主要',
          exact: true,
          includeHidden: true,
        });
        const retainedButton = await mainButton.elementHandle();
        expect(retainedButton).not.toBeNull();
        const accessibility = await context.newCDPSession(page);
        await accessibility.send('Accessibility.enable');
        const nativeMainButtons = async () => {
          const { nodes } = await accessibility.send('Accessibility.getFullAXTree');
          return nodes.filter(
            (node) => !node.ignored && node.role?.value === 'button' && node.name?.value === '主要'
          );
        };
        const initial = await capture('initial');
        expect(await home.locator('[data-home-gallery-layout-toggle]').count()).toBe(0);
        expect(await home.textContent()).not.toMatch(
          /打开交互演示|关闭交互演示|查看桌面缩略图|Open interactive demos|Show desktop overview/
        );
        expect(initial).toMatchObject({
          inert: true,
          columnCount: 5,
          cardCount: 10,
          noOverflow: true,
          fitsGallery: true,
          fadePointerEvents: 'none',
          fadeVisible: true,
          sourceOutsideStage: true,
        });
        expect(initial.fade).toContain('linear-gradient');
        expectCompactPreview(initial);
        // Playwright 1.58's role selector does not implement inert ancestry.
        // The native AX tree and actual focus behavior establish this boundary.
        expect(await nativeMainButtons()).toHaveLength(0);
        await mainButton.evaluate((button) => {
          if (!(button instanceof HTMLElement)) throw new Error('Expected an HTML button');
          button.focus();
        });
        expect(await stage.evaluate((node) => node.matches(':focus-within'))).toBe(false);
        const demoLink = page.getByRole('link', { name: '试试 Demo', exact: true });
        expect(await demoLink.getAttribute('href')).toBe('#home-demo-previewer');
        await demoLink.press('Enter');
        await expect.poll(() => new URL(page.url()).hash).toBe('#home-demo-previewer');
        await expect.poll(async () => (await sample()).inert).toBe(false);
        expect(await nativeMainButtons()).toHaveLength(1);
        expect(
          await mainButton.evaluate((button, retained) => button === retained, retainedButton)
        ).toBe(true);
        await mainButton.focus();
        expect(await stage.evaluate((node) => node.matches(':focus-within'))).toBe(true);
        expect((await sample()).fadeVisible).toBe(false);
        await mainButton.press('Enter');
        await expect
          .poll(() => home.locator('[data-demo-ref="gallery-controls-feedback"]').textContent())
          .not.toBe('点击任意控件');
        await page.setViewportSize({ width: 1440, height: 900 });
        const desktop = await capture('desktop-after-entry');
        expect(desktop.inert).toBe(false);
        expect(desktop.fade).toBe(initial.fade);
        expect(desktop.fadeHeight).toBeCloseTo(
          Math.min(8 * desktop.rootFontSize, desktop.fadeViewportHeight * 0.28),
          1
        );
        await page.setViewportSize({ width: 390, height: 900 });
        const returned = await capture('mobile-after-entry');
        expect(returned.inert).toBe(false);
        expect(returned.noOverflow).toBe(true);
        expect(await mainButton.evaluate((button) => document.activeElement === button)).toBe(true);
        expect(await nativeMainButtons()).toHaveLength(1);
        await retainedButton?.dispose();
        // A desktop user need not have followed the hash link: resizing must
        // still preserve a control that already owns native focus.
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
        await waitForHomeRuntime(page, 'wc');
        await mainButton.focus();
        await page.setViewportSize({ width: 390, height: 900 });
        const focusedResize = await capture('focused-desktop-to-mobile');
        expect(focusedResize.inert).toBe(false);
        expect(focusedResize.noOverflow).toBe(true);
        expect(await mainButton.evaluate((button) => document.activeElement === button)).toBe(true);
        expect(await nativeMainButtons()).toHaveLength(1);
        expect(errors).toEqual([]);
        await accessibility.detach();
      } finally {
        await context.close();
      }
    }
  }, 90_000);

  it('keeps the compact preview full width through viewport, root-font, theme and Runtime changes', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      colorScheme: 'light',
    });
    try {
      const page = await context.newPage();
      const { home, errors, sample, capture, expectCompactPreview } =
        await createHomeGalleryObservation(page, 'responsive', 'light');
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      await waitForHomeRuntime(page, 'wc');
      for (const width of [320, 390, 430, 767]) {
        await page.setViewportSize({ width, height: 900 });
        expectCompactPreview(await capture(`compact-${width}`));
      }
      await page.setViewportSize({ width: 390, height: 900 });
      const beforeFont = await page.evaluate(() => ({
        value: document.documentElement.style.getPropertyValue('font-size'),
        priority: document.documentElement.style.getPropertyPriority('font-size'),
        computed: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      }));
      try {
        // Explicit root-font environment input, not browser zoom and not a
        // substitute for the existing full-size 200% content-reading journey.
        await page.evaluate((value) => {
          document.documentElement.style.setProperty('font-size', `${value}px`);
        }, beforeFont.computed * 2);
        const enlarged = await capture('root-font-200');
        expect(enlarged.rootFontSize).toBeCloseTo(beforeFont.computed * 2, 3);
        expectCompactPreview(enlarged);
      } finally {
        await page.evaluate(({ value, priority }) => {
          if (value) document.documentElement.style.setProperty('font-size', value, priority);
          else document.documentElement.style.removeProperty('font-size');
        }, beforeFont);
      }
      const restored = await capture('root-font-restored');
      expect(restored.rootFontSize).toBeCloseTo(beforeFont.computed, 3);
      expectCompactPreview(restored);
      await page
        .locator('[data-homepage-runtime]')
        .getByRole('button', { name: '切换主题', exact: true })
        .click();
      await expect
        .poll(() => page.locator('html').getAttribute('data-theme'))
        .toBe(restored.theme === 'dark' ? 'light' : 'dark');
      await expect.poll(async () => (await sample()).cardPaint).not.toEqual(restored.cardPaint);
      const afterTheme = await capture('after-theme');
      expectCompactPreview(afterTheme);
      expect(afterTheme.fade).not.toBe(restored.fade);
      const closeHeaderMenu = async () => {
        const menu = page.locator(
          '[data-site-header] .site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
        );
        if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
      };
      const beforeRuntime = afterTheme.generation;
      await chooseRuntime(page, home, 'react');
      await closeHeaderMenu();
      const afterRuntime = await capture('react');
      expectCompactPreview(afterRuntime);
      expect(afterRuntime.runtime).toBe('react');
      expect(afterRuntime.generation).not.toBe(beforeRuntime);
      await chooseRuntime(page, home, 'wc');
      await closeHeaderMenu();
      const returnedRuntime = await capture('wc-return');
      expectCompactPreview(returnedRuntime);
      expect(returnedRuntime.runtime).toBe('wc');
      expect(returnedRuntime.generation).not.toBe(afterRuntime.generation);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }, 90_000);

  it('honors direct and repeated Hero hash entry with native Back and Forward', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      colorScheme: 'light',
    });
    try {
      const page = await context.newPage();
      const { home, sample, capture, errors, expectCompactPreview } =
        await createHomeGalleryObservation(page, 'history', 'light');
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      await waitForHomeRuntime(page, 'wc');
      const initial = await capture('initial');
      expectCompactPreview(initial);
      const mainButton = home.getByRole('button', {
        name: '主要',
        exact: true,
        includeHidden: true,
      });
      const retainedButton = await mainButton.elementHandle();
      expect(retainedButton).not.toBeNull();
      const demoLink = page.getByRole('link', { name: '试试 Demo', exact: true });
      await demoLink.press('Enter');
      await expect.poll(() => new URL(page.url()).hash).toBe('#home-demo-previewer');
      await expect.poll(async () => (await sample()).inert).toBe(false);
      await mainButton.press('Enter');
      const feedback = home.locator('[data-demo-ref="gallery-controls-feedback"]');
      await expect.poll(() => feedback.textContent()).not.toBe('点击任意控件');
      const retainedFeedback = await feedback.textContent();
      await demoLink.press('Enter');
      const repeated = await capture('repeated-hash');
      expect(repeated.inert).toBe(false);
      expect(repeated.generation).toBe(initial.generation);
      expect(await feedback.textContent()).toBe(retainedFeedback);
      expect(
        await mainButton.evaluate((button, retained) => button === retained, retainedButton)
      ).toBe(true);
      // Hero entry leaves focus outside the stage here, so this history case
      // does not conflate returning to the overview with focused-control protection.
      await page.goBack();
      await expect.poll(() => new URL(page.url()).hash).toBe('');
      const back = await capture('back');
      expectCompactPreview(back);
      expect(back.generation).toBe(initial.generation);
      await page.goForward();
      await expect.poll(() => new URL(page.url()).hash).toBe('#home-demo-previewer');
      const forward = await capture('forward');
      expect(forward.inert).toBe(false);
      expect(forward.noOverflow).toBe(true);
      expect(forward.generation).toBe(initial.generation);
      expect(await feedback.textContent()).toBe(retainedFeedback);
      expect(
        await mainButton.evaluate((button, retained) => button === retained, retainedButton)
      ).toBe(true);
      await retainedButton?.dispose();
      expect(errors).toEqual([]);

      const directPage = await context.newPage();
      const direct = await createHomeGalleryObservation(directPage, 'direct-hash', 'light');
      await directPage.goto(`${baseUrl}${HOME_ROUTE}#home-demo-previewer`, {
        waitUntil: 'networkidle',
      });
      await waitForHomeRuntime(directPage, 'wc');
      const directFacts = await direct.capture('initial');
      expect(directFacts.inert).toBe(false);
      expect(directFacts.noOverflow).toBe(true);
      expect(await direct.home.locator('[data-home-gallery-layout-toggle]').count()).toBe(0);
      await direct.home.getByRole('button', { name: '主要', exact: true }).press('Enter');
      await expect
        .poll(() =>
          direct.home.locator('[data-demo-ref="gallery-controls-feedback"]').textContent()
        )
        .not.toBe('点击任意控件');
      expect(direct.errors).toEqual([]);
    } finally {
      await context.close();
    }
  }, 90_000);

  it('uses unframed responsive task layout, real control feedback and four executable runtimes', async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme,
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
        const home = page.locator(HOME_SELECTOR);
        await waitForHomeRuntime(page, 'wc');
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          if (width < 768) {
            const gallery = home.locator('[data-home-gallery-stage]');
            if (await gallery.evaluate((node) => (node as HTMLElement).inert))
              await page.getByRole('link', { name: '试试 Demo', exact: true }).press('Enter');
            await expect
              .poll(() => gallery.evaluate((node) => (node as HTMLElement).inert))
              .toBe(false);
          }
          await revealHeaderPreferences(page);
          const geometry = await home.evaluate((root) => {
            const task = root.querySelector<HTMLElement>('[data-home-settings]')!;
            const fields = root.querySelector<HTMLElement>('[data-home-gallery-stage]')!;
            const trigger = document.querySelector<HTMLElement>(
              '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"] [role="combobox"]'
            )!;
            const style = getComputedStyle(task);
            const rect = root.getBoundingClientRect();
            return {
              border: style.borderWidth,
              shadow: style.boxShadow,
              columns: new Set(
                [...fields.querySelectorAll<HTMLElement>('.home-gallery__item[data-gallery-demo]')]
                  .flatMap((card) => [...card.getClientRects()])
                  .filter((box) => box.width > 0 && box.height > 0)
                  .map((box) => box.left)
              ).size,
              triggerHeight: trigger.getBoundingClientRect().height,
              triggerConnected: trigger.isConnected,
              triggerGeneration: trigger.closest<HTMLElement>('[data-projection-generation-state]')
                ?.dataset.projectionGenerationState,
              compact: matchMedia('(max-width: 47.999rem)').matches,
              menuOpen:
                document.querySelector<HTMLElement>('[data-site-header]')?.dataset.siteMenuOpen,
              preferencesDock: document
                .querySelector('[data-site-header-preferences]')
                ?.parentElement?.hasAttribute('data-site-header-compact-context')
                ? 'compact'
                : 'desktop',
              triggerAncestors: (() => {
                const ancestors = [];
                for (
                  let node: HTMLElement | null = trigger;
                  node && ancestors.length < 12;
                  node = node.parentElement
                ) {
                  const computed = getComputedStyle(node);
                  ancestors.push({
                    tag: node.tagName,
                    hidden: node.hidden,
                    inert: node.inert,
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    height: node.getBoundingClientRect().height,
                  });
                }
                return ancestors;
              })(),
              fits:
                rect.left >= 0 && rect.right <= innerWidth && root.scrollWidth <= root.clientWidth,
            };
          });
          expect(geometry.border).toBe('0px');
          expect(geometry.shadow).toBe('none');
          expect(geometry.columns).toBe(width >= 1200 ? 4 : width >= 640 ? 2 : 1);
          const expectedTriggerHeight = 44;
          if (
            !Number.isFinite(geometry.triggerHeight) ||
            Math.abs(geometry.triggerHeight - expectedTriggerHeight) >= 0.5
          ) {
            // The geometry above is the original failed sample. The screenshot
            // below is separately timed and never replaces that assertion.
            try {
              const directory = path.join(
                process.env.RUNNER_TEMP ?? os.tmpdir(),
                'homepage-evidence',
                'responsive-layout'
              );
              await mkdir(directory, { recursive: true });
              const id = `family-trigger-${colorScheme}-${width}`;
              const diagnostic = {
                source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
                sourceDirty:
                  execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !==
                  '',
                colorScheme,
                width,
                geometry,
                expectedTriggerHeight,
                url: safeUrl(page.url(), baseUrl),
                recordedAt: new Date().toISOString(),
              };
              await writeFile(
                path.join(directory, `${id}.json`),
                JSON.stringify(diagnostic, null, 2)
              );
              await page.screenshot({ path: path.join(directory, `${id}.png`) });
            } catch (error) {
              console.error(
                'Responsive Header diagnostic capture failed',
                safeError(error, baseUrl)
              );
            }
          }
          expect(geometry.triggerHeight).toBeCloseTo(expectedTriggerHeight, 0);
          expect(geometry.fits, `${colorScheme} ${width}px overflow`).toBe(true);
        }
        expect(await home.locator('[data-projection-control="component"]').count()).toBe(0);
        expect(await home.locator('[data-browser-runner-research-id]').count()).toBe(0);
        const runtimeTrigger = page.locator(
          '[data-homepage-runtime] [data-projection-control="runtime"] [role="combobox"]'
        );
        await runtimeTrigger.click();
        const runtimePortal = await portalControlledBy(page, runtimeTrigger);
        expect(await runtimePortal.getByRole('option').allTextContents()).toEqual([
          'Web Components',
          'React',
          'Vue',
          'Vue 2',
        ]);
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 1440, height: 900 });
        // Viewport resize precedes matchMedia delivery. Wait for the real
        // compact-to-desktop owner move before sampling pointer coordinates.
        await page.waitForFunction(() => {
          const preferences = document.querySelector('[data-site-header-preferences]');
          return preferences?.parentElement?.matches('[data-site-header-context]');
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        for (const control of ['runtime', 'family'] as const) {
          const trigger = page
            .locator('[data-homepage-runtime]')
            .locator(`[data-projection-control="${control}"] [role="combobox"]`);
          const before = await trigger.boundingBox();
          if (!before) throw new Error(`${control} trigger must have geometry.`);
          await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
          await page.mouse.down();
          await expect
            .poll(() => trigger.evaluate((element) => element.hasAttribute('data-pressed')))
            .toBe(true);
          const paint = await trigger.evaluate((element) => ({
            focusVisible: element.hasAttribute('data-focus-visible'),
            nativeFocusVisible: element.matches(':focus-visible'),
          }));
          expect(paint.focusVisible).toBe(paint.nativeFocusVisible);
          const pressed = await trigger.boundingBox();
          // Desktop Shadcn ghost retains pressed semantics without field displacement.
          expect(pressed?.y).toBeCloseTo(before.y, 1);
          await page.mouse.up();
          await expect
            .poll(() => trigger.evaluate((element) => element.hasAttribute('data-pressed')))
            .toBe(false);
          await page.keyboard.press('Escape');
        }
      } finally {
        await context.close();
      }
    }
  }, 180_000);

  it('completes the settings task and resets local state through both libraries and all runtimes', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const errorDetails: Array<Record<string, unknown>> = [];
    let editingCase: { family: string; runtime: string; stage: string } | null = null;
    page.on('pageerror', (error) => {
      errors.push(error.message);
      errorDetails.push({ ...editingCase, message: error.message, stack: error.stack });
    });
    const reportEditingState = async (stage: string) => {
      if (editingCase) editingCase.stage = stage;
      const state = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('[data-demo-ref="settings-note"]');
        const note = root?.matches('textarea')
          ? (root as HTMLTextAreaElement)
          : root?.querySelector('textarea');
        const active = document.activeElement;
        return {
          value: note?.value,
          selectionStart: note?.selectionStart,
          selectionEnd: note?.selectionEnd,
          editingTrace: (note as (HTMLTextAreaElement & { __editingTrace?: unknown[] }) | null)
            ?.__editingTrace,
          active: active
            ? {
                tag: active.tagName,
                role: active.getAttribute('role'),
                ref: active.getAttribute('data-demo-ref'),
              }
            : null,
          pageRuntime:
            document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtime,
        };
      });
      console.info(
        '[homepage-settings-edit]',
        JSON.stringify({ ...editingCase, ...state, pageErrors: errorDetails })
      );
    };
    try {
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      const home = page.locator(HOME_SELECTOR);
      await waitForHomeRuntime(page, 'wc');
      for (const family of ['shadcn', 'brutalist'] as const) {
        if (family === 'brutalist') {
          await chooseProjectionControl(page, home, 'family', family);
          await page.waitForFunction(
            () =>
              document.querySelector<HTMLElement>('[data-home-showcase]')?.dataset
                .projectionFamily === 'brutalist'
          );
        }
        for (const runtime of RUNTIMES) {
          editingCase = { family, runtime, stage: 'runtime-selection' };
          await chooseRuntime(page, home, runtime);
          const task = home.locator('[data-home-settings]');
          const save = task.getByRole('button', { name: '保存到本页', exact: true });
          const reset = task.getByRole('button', { name: '恢复默认值', exact: true });
          const editor = task.locator(
            'textarea[data-demo-ref="settings-note"], [data-demo-ref="settings-note"] > textarea'
          );
          expect(await editor.count(), 'one physical editable textarea').toBe(1);
          expect(await editor.getAttribute('aria-label')).toBe('附加说明');
          expect(await editor.getAttribute('data-projection-prototype')).toBe(
            `${family}-textarea-root`
          );
          const summary = task.getByRole('switch', { name: '每周摘要', exact: true });
          const view = task.getByRole('combobox', { name: '通知方式', exact: true });
          expect(await editor.inputValue()).toBe('');
          expect(await save.getAttribute('aria-disabled')).toBe('true');
          expect(await task.getAttribute('data-dirty')).toBe('false');
          // Exercise actual Select keyboard navigation and its focus-return boundary.
          await view.focus();
          await page.keyboard.press('Enter');
          const portal = await portalControlledBy(page, view);
          await expect
            .poll(() =>
              portal
                .getByRole('option')
                .evaluateAll((items) => items.some((item) => item === document.activeElement))
            )
            .toBe(true);
          await page.keyboard.press('Home');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
          await portal.waitFor({ state: 'hidden' });
          await expect.poll(() => view.textContent()).toContain('推送');
          await expect
            .poll(() => view.evaluate((element) => document.activeElement === element))
            .toBe(true);
          await summary.focus();
          await page.keyboard.press('Space');
          await expect.poll(() => summary.getAttribute('aria-checked')).toBe('true');
          const noteText = `${family} / ${runtime}`;
          editingCase.stage = 'native-fill';
          // Bounded diagnostics on this authored fixture only. Delegate through
          // the existing descriptor (including any framework value tracker),
          // and retain all original native input/caret assertions unchanged.
          if (runtime === 'react')
            await editor.evaluate((target: HTMLTextAreaElement) => {
              const node = target as HTMLTextAreaElement & { __editingTrace?: unknown[] };
              const trace: unknown[] = [];
              node.__editingTrace = trace;
              const record = (operation: string, details?: unknown) => {
                if (trace.length >= 48) trace.shift();
                trace.push({
                  operation,
                  value: node.value,
                  start: node.selectionStart,
                  end: node.selectionEnd,
                  details,
                });
              };
              const descriptor =
                Object.getOwnPropertyDescriptor(node, 'value') ??
                Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
              if (descriptor?.get && descriptor?.set)
                Object.defineProperty(node, 'value', {
                  configurable: true,
                  enumerable: descriptor.enumerable,
                  get() {
                    return descriptor.get!.call(this);
                  },
                  set(value) {
                    record('value-before', {
                      next: value,
                      stack: new Error().stack?.split('\n').slice(1, 12),
                    });
                    descriptor.set!.call(this, value);
                    record('value-after');
                  },
                });
              const setSelectionRange = node.setSelectionRange;
              node.setSelectionRange = function (...args) {
                record('selection-before', {
                  args,
                  stack: new Error().stack?.split('\n').slice(1, 12),
                });
                setSelectionRange.apply(this, args);
                record('selection-after');
              };
              for (const type of [
                'focus',
                'blur',
                'beforeinput',
                'input',
                'change',
                'compositionstart',
                'compositionend',
              ]) {
                node.addEventListener(
                  type,
                  () => {
                    record(type);
                    queueMicrotask(() => record(`${type}-microtask`));
                  },
                  true
                );
              }
              record('installed');
            });
          await editor.fill(noteText);
          await reportEditingState('after-native-fill');
          await expect
            .poll(() => editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart), {
              message: `${family}/${runtime} native fill caret`,
            })
            .toBe(noteText.length);
          expect(
            await editor.evaluate((element: HTMLTextAreaElement) => element.selectionEnd)
          ).toBe(noteText.length);
          // Synthetic composition events exercise the real browser/Adapter boundary;
          // they do not claim to reproduce an operating-system IME session.
          editingCase.stage = 'composition-input';
          await editor.evaluate((element: HTMLTextAreaElement) => {
            element.dispatchEvent(
              new CompositionEvent('compositionstart', { bubbles: true, data: '' })
            );
            element.value += '备';
            element.setSelectionRange(element.value.length, element.value.length);
            element.dispatchEvent(
              new InputEvent('input', {
                bubbles: true,
                data: '备',
                isComposing: true,
                inputType: 'insertCompositionText',
              })
            );
          });
          await reportEditingState('after-composition-input');
          await expect.poll(() => save.getAttribute('aria-disabled')).toBe('true');
          editingCase.stage = 'composition-end';
          await editor.evaluate((element: HTMLTextAreaElement) => {
            element.value += '注';
            element.setSelectionRange(element.value.length, element.value.length);
            element.dispatchEvent(
              new CompositionEvent('compositionend', { bubbles: true, data: '备注' })
            );
          });
          await reportEditingState('after-composition-end');
          await expect.poll(() => editor.inputValue()).toBe(`${noteText}备注`);
          await expect
            .poll(() => editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart))
            .toBe(noteText.length + 2);
          expect(
            await editor.evaluate((element: HTMLTextAreaElement) => element.selectionEnd)
          ).toBe(noteText.length + 2);
          await expect.poll(() => save.getAttribute('aria-disabled')).toBe('false');
          await save.focus();
          await page.keyboard.press('Enter');
          await expect
            .poll(() => task.getByRole('status').textContent())
            .toContain('已保存到本页 · 推送 · 显示每周摘要');
          expect(await task.getAttribute('data-dirty')).toBe('false');
          await reset.click();
          await expect.poll(() => editor.inputValue()).toBe('');
          await expect.poll(() => summary.getAttribute('aria-checked')).toBe('false');
          await expect.poll(() => view.textContent()).toContain('邮件');
          expect(await task.getAttribute('data-dirty')).toBe('true');
          await save.click();
          await expect
            .poll(() => task.getByRole('status').textContent())
            .toContain('已保存到本页 · 邮件 · 隐藏每周摘要 · 备注 0 字');
          // Leave dirty state behind; next generation must not carry or persist it.
          await editor.fill('仅属于当前 generation');
          expect(await task.getAttribute('data-dirty')).toBe('true');
        }
      }
      await chooseRuntime(page, home, 'wc');
      expect(await home.getByRole('textbox', { name: '附加说明' }).inputValue()).toBe('');
      expect(errors).toEqual([]);
    } catch (error) {
      await reportEditingState('failed').catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }, 240_000);
});

// C-CONTROL-LABEL-0001: real published documentation and real input. These
// journeys supplement owner/host tests; they do not certify a screen reader.
describe.sequential('Independent Label public documentation', () => {
  for (const family of ['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
    it(`${family}: naming, activation and copyable content across four Web adapters`, async () => {
      const context = await browser.newContext({ viewport: { width: 1040, height: 900 } });
      const page = await context.newPage();
      const evidenceRoot =
        process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ??
        path.join(os.tmpdir(), 'proto-ui-control-label');
      const directory = path.join(evidenceRoot, 'control-label');
      try {
        await mkdir(directory, { recursive: true });
        const folder = family === 'brutalist' ? 'brutalist/components' : family;
        const response = await page.goto(`${baseUrl}/en/ui-libraries/${folder}/label/`, {
          waitUntil: 'domcontentloaded',
        });
        expect(response?.status()).toBe(200);
        const preview = page.locator('[data-previewer-id]').first();
        await preview.scrollIntoViewIfNeeded();
        for (const runtime of RUNTIMES) {
          await selectRuntime(page, preview, runtime, '[data-demo-ref="label-checkbox"]', 1);
          const content = preview.locator('.pui-runtime-preview-surface');
          const label = (name: string) => content.locator(`[data-demo-ref="label-${name}"]`);
          const checkbox = content.getByRole('checkbox', {
            name: 'Community updates',
            exact: true,
          });
          const checked = (control: Locator) => control.getAttribute('aria-checked');
          await expect.poll(() => checked(checkbox)).toBe('false');
          expect(await label('checkbox').getAttribute('tabindex')).toBeNull();
          await label('checkbox').click();
          await expect.poll(() => checked(checkbox)).toBe('true');
          await expect
            .poll(() => checkbox.evaluate((element) => document.activeElement === element))
            .toBe(true);
          await page.keyboard.press('Space');
          await expect.poll(() => checked(checkbox)).toBe('false');

          const toggle = content.getByRole('switch', { name: 'Enable notifications', exact: true });
          await label('switch').click();
          await expect.poll(() => checked(toggle)).toBe('true');
          const push = content.getByRole('radio', { name: 'Push delivery', exact: true });
          const email = content.getByRole('radio', { name: 'Email delivery', exact: true });
          await label('radio-push').click();
          await expect.poll(() => checked(push)).toBe('true');
          await expect.poll(() => checked(email)).toBe('false');

          // The demo also publishes a read-only input and textarea. Select the
          // editable controls by their accessible names.
          const input = content.getByRole('textbox', { name: 'Project name', exact: true });
          await label('input').click();
          await expect
            .poll(() => input.evaluate((element) => document.activeElement === element))
            .toBe(true);
          await page.keyboard.press('ControlOrMeta+A');
          await page.keyboard.insertText('Named native editor');
          expect(await input.inputValue()).toBe('Named native editor');
          const textarea = content.getByRole('textbox', { name: 'Project notes', exact: true });
          await label('textarea').click();
          await expect
            .poll(() => textarea.evaluate((element) => document.activeElement === element))
            .toBe(true);
          const notesBeforeSelection = await textarea.inputValue();
          expect(notesBeforeSelection.length).toBeGreaterThan(0);
          await page.keyboard.press('ControlOrMeta+A');
          expect(
            await textarea.evaluate((element) => ({
              start: (element as HTMLTextAreaElement).selectionStart,
              end: (element as HTMLTextAreaElement).selectionEnd,
              length: (element as HTMLTextAreaElement).value.length,
            }))
          ).toEqual({
            start: 0,
            end: notesBeforeSelection.length,
            length: notesBeforeSelection.length,
          });

          for (const name of ['disabled', 'controlled']) {
            const control = content.locator(`[data-demo-ref="${name}"]`);
            await label(name).click();
            expect(await checked(control)).toBe('false');
          }
          await label('passive').click();
          expect(await checked(content.locator('[data-demo-ref="passive"]'))).toBe('false');

          // Exercise both the real naming-only Label and its independent long
          // description. The driver reads glyph boxes; only native mouse input
          // creates selection. No page-local CSS or Selection writer is used.
          for (const ref of ['label-passive', 'description']) {
            const description = content.locator(`[data-demo-ref="${ref}"]`);
            await description.scrollIntoViewIfNeeded();
            const drag = await description.evaluate(measureLabelTextDrag);
            const geometry = { ...drag.bounds, start: drag.start, end: drag.end };
            const recorder = await description.evaluateHandle(recordLabelPointerTrace);
            const stages: unknown[] = [];
            const snapshot = async (stage: string) =>
              stages.push({
                stage,
                observation: await description.evaluate(observeLabelDescriptionSelection, geometry),
              });
            const controlState = () =>
              content.locator('[aria-checked]').evaluateAll((elements) =>
                elements.map((element) => ({
                  ref: element.getAttribute('data-demo-ref'),
                  checked: element.getAttribute('aria-checked'),
                }))
              );
            const before = await controlState();
            let complete = false;
            try {
              await page.mouse.click(drag.start.x, drag.start.y);
              await page.mouse.move(drag.start.x, drag.start.y);
              await page.mouse.down();
              await snapshot('pointer-down');
              await page.mouse.move(drag.end.x, drag.end.y, { steps: 20 });
              await snapshot('drag-before-release');
              const selectedDuringDrag = await page.evaluate(
                () => window.getSelection()?.toString() ?? ''
              );
              await page.mouse.up();
              await snapshot('after-release');
              expect(selectedDuringDrag.length).toBeGreaterThan(5);
              expect(
                (await page.evaluate(() => window.getSelection()?.toString() ?? '')).length
              ).toBeGreaterThan(5);
              const after = await description.evaluate(observeLabelDescriptionSelection, geometry);
              expect(after.selected).toBe(selectedDuringDrag);
              expect(after.anchorWithin && after.focusWithin).toBe(true);
              expect(await description.textContent()).toContain(after.selected);
              expect(await controlState()).toEqual(before);
              await description.screenshot({
                path: path.join(directory, `label-${family}-${runtime}-${ref}-selection.png`),
              });
              complete = true;
            } finally {
              const events = await recorder.evaluate((trace) => trace.finish());
              await recorder.dispose();
              const evidence = {
                family,
                runtime,
                ref,
                drag,
                stages,
                events,
                before,
                after: await controlState(),
              };
              await writeFile(
                path.join(directory, `label-${family}-${runtime}-${ref}-selection.json`),
                JSON.stringify(evidence, null, 2)
              );
              if (!complete) console.error('[label-selection]', JSON.stringify(evidence));
            }
          }
          // A genuine click still uses the existing target owner after a text
          // drag; duplicate forwarding would toggle twice and fail this check.
          await label('checkbox').click();
          await expect.poll(() => checked(checkbox)).toBe('true');
          await expect
            .poll(() => checkbox.evaluate((element) => document.activeElement === element))
            .toBe(true);
          await page.keyboard.press('Space');
          await expect.poll(() => checked(checkbox)).toBe('false');
          await preview.screenshot({
            path: path.join(directory, `label-${family}-${runtime}.png`),
          });
        }
      } catch (error) {
        await page
          .screenshot({ path: path.join(directory, `label-${family}-failure.png`), fullPage: true })
          .catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }, 180_000);
  }

  it('records native HTML label click versus pointerup cancellation with real input', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // A separate native comparison fixture, never substituted for Proto's
      // public-page journey above or presented as a project screenshot.
      await page.setContent(
        '<label for="native">Native comparison label</label><input id="native" type="checkbox">'
      );
      const label = page.locator('label');
      const control = page.locator('input');
      await label.evaluate((element) =>
        element.addEventListener('pointerup', (event) => event.preventDefault())
      );
      await label.click();
      expect(await control.isChecked()).toBe(true);
      await label.evaluate((element) =>
        element.addEventListener('click', (event) => event.preventDefault())
      );
      await label.click();
      expect(await control.isChecked()).toBe(true);
    } finally {
      await context.close();
    }
  });
});
