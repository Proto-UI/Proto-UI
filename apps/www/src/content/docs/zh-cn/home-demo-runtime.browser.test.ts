// @vitest-environment node

import { revealHeaderPreferences } from './site-header-browser';
import type { Browser, Locator, Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeError, safeUrl } from '../../../../../../scripts/test/search-startup-profile.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, startServer, stopServer } from './browser-harness';

const HOME_ROUTE = '/zh-cn/';
const HOME_SELECTOR = '[data-home-showcase]';
const CONTROL_OPTION_LABELS = {
  runtime: {
    wc: 'Web Components',
    react: 'React',
    vue: 'Vue',
    vue2: 'Vue 2',
  },
  family: { shadcn: 'Shadcn', brutalist: 'Brutalist' },
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
  await portal.waitFor({ state: 'visible', timeout: 10_000 });
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
}

async function chooseRuntime(page: Page, root: Locator, runtime: string) {
  await chooseProjectionControl(page, root, 'runtime', runtime);
  await waitForHomeRuntime(page, runtime);
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
          expect(tokens.some((token) => ['h-8', 'size-8'].includes(token))).toBe(true);
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
          await revealHeaderPreferences(page);
          const geometry = await home.evaluate((root) => {
            const task = root.querySelector<HTMLElement>('[data-home-settings]')!;
            const fields = root.querySelector<HTMLElement>('.home-gallery')!;
            const trigger = document.querySelector<HTMLElement>(
              '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"] [role="combobox"]'
            )!;
            const style = getComputedStyle(task);
            const rect = root.getBoundingClientRect();
            return {
              border: style.borderWidth,
              shadow: style.boxShadow,
              columns: getComputedStyle(fields).gridTemplateColumns.split(' ').length,
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
          const expectedTriggerHeight = width >= 768 ? 36 : 44;
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
          expect(geometry.triggerHeight).toBeCloseTo(width >= 768 ? 36 : 44, 0);
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
          expect(await trigger.getAttribute('data-pui-style')).toContain('border-transparent');
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
