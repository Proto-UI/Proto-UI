// @vitest-environment node

import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RUNTIMES, launchBrowser, startServer, stopServer } from './browser-harness';

const HOME_ROUTE = '/zh-cn/';
const HOME_SELECTOR = '[data-home-demo-options]';
const CONTROL_OPTION_LABELS = {
  runtime: {
    wc: 'Web Components',
    react: 'React',
    vue: 'Vue',
    vue2: 'Vue 2',
  },
  family: { shadcn: 'Shadcn', brutalist: 'Brutalist' },
  component: {
    button: 'Button',
    toggle: 'Toggle',
    switch: 'Switch',
    tabs: 'Tabs',
    'hover-card': 'Hover Card',
    'dropdown-menu': 'Dropdown Menu',
    select: 'Select',
    dialog: 'Dialog',
    separator: 'Separator',
    textarea: 'Textarea',
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
  await portal.waitFor({ state: 'visible', timeout: 10_000 });
  return portal;
}

async function chooseProjectionControl(
  page: Page,
  root: Locator,
  control: 'runtime' | 'family' | 'component',
  value: string
): Promise<void> {
  const trigger = root.locator(`[data-projection-control="${control}"] [role="combobox"]`);
  await trigger.click();
  const portal = await portalControlledBy(page, trigger);
  const optionLabel = (CONTROL_OPTION_LABELS[control] as Readonly<Record<string, string>>)[value];
  if (!optionLabel) throw new Error(`Unknown ${control} projection option ${value}.`);
  await portal.getByRole('option', { name: optionLabel, exact: true }).click({ force: true });
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
  it('remounts locally and follows the global adapter preference across all runtimes', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
    const home = page.locator(HOME_SELECTOR);
    const globalRoot = page.locator('wc-shadcn-select-root[data-adapter-select-root]').first();

    try {
      await home.waitFor({ state: 'visible' });
      await waitForHomeRuntime(page, 'wc');
      for (const runtime of RUNTIMES) {
        await chooseRuntime(page, home, runtime);
        await expect
          .poll(
            () =>
              home
                .locator('[data-projection-control="runtime"] [role="combobox"]')
                .evaluate((element) => document.activeElement === element),
            { timeout: 10_000 }
          )
          .toBe(true);
        expect(
          await page
            .locator('wc-shadcn-select-root[data-adapter-select-root]')
            .first()
            .getAttribute('data-value'),
          `${runtime} global preference`
        ).toBe(runtime);
      }

      await globalRoot.locator('wc-shadcn-select-trigger').click();
      await page.getByRole('option', { name: 'Vue', exact: true }).last().click({ force: true });
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
          revealing: boolean;
          style: string;
          transitionDuration: string;
          visibilityTransitions: string[];
          visibility: string;
        }> = [];
        const guardReleaseSamples: Array<{
          visibility: string;
          visibilityTransitions: string[];
        }> = [];
        (window as typeof window & { __homeMountSamples?: typeof samples }).__homeMountSamples =
          samples;
        (
          window as typeof window & {
            __homeRevealGuardReleaseSamples?: typeof guardReleaseSamples;
          }
        ).__homeRevealGuardReleaseSamples = guardReleaseSamples;
        const removeAttribute = Element.prototype.removeAttribute;
        Element.prototype.removeAttribute = function (name) {
          const samplesReveal =
            name === 'data-pui-view-pending' &&
            this instanceof HTMLElement &&
            this.hasAttribute(name) &&
            this.hasAttribute('data-pui-root') &&
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
              revealing: this.hasAttribute('data-pui-view-revealing'),
              style: this.getAttribute('data-pui-style') ?? '',
              transitionDuration: style.transitionDuration,
              visibilityTransitions: this.getAnimations()
                .filter((animation) => 'transitionProperty' in animation)
                .map((animation) => (animation as CSSTransition).transitionProperty),
              visibility: style.visibility,
            });
          }
          if (samplesGuardRelease) {
            guardReleaseSamples.push({
              visibility: getComputedStyle(this).visibility,
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
                revealing: boolean;
                style: string;
                transitionDuration: string;
                visibilityTransitions: string[];
                visibility: string;
              }>;
            }
          ).__homeMountSamples ?? []
      );
      expect(samples).toHaveLength(6);
      for (const sample of samples) {
        expect(sample.revealing).toBe(true);
        expect(sample.visibility).toBe('visible');
        expect(sample.transitionDuration).toBe('0s');
        expect(sample.visibilityTransitions).not.toContain('visibility');
        const tokens = sample.style.split(/\s+/);
        expect(tokens).toContain('transition-all');
        expect(
          tokens.some((token) =>
            ['border-transparent', 'border-border', 'border-input'].includes(token)
          )
        ).toBe(true);
        expect(tokens.some((token) => ['h-8', 'size-8'].includes(token))).toBe(true);
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
              }>;
            }
          ).__homeRevealGuardReleaseSamples ?? []
      );
      expect(guardReleaseSamples).toHaveLength(6);
      for (const sample of guardReleaseSamples) {
        expect(sample.visibility).toBe('visible');
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
      expect(revealedRoots).toHaveLength(6);
      for (const root of revealedRoots) {
        expect(root.revealing).toBe(false);
        expect(root.visibility).toBe('visible');
        expect(root.visibilityTransitions).not.toContain('visibility');
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('uses compact Shadcn geometry, press feedback, and a separate WASM research lane', async () => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme,
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}${HOME_ROUTE}`, { waitUntil: 'networkidle' });
      const home = page.locator(HOME_SELECTOR);

      const readGeometry = () =>
        home.evaluate((root) => {
          const panel = root.querySelector<HTMLElement>('.home-demo-previewer__panel');
          const host = root.querySelector<HTMLElement>('[data-home-demo-host]');
          const trigger = root.querySelector<HTMLElement>(
            '[data-projection-control="runtime"] [role="combobox"]'
          );
          if (!panel || !host || !trigger) throw new Error('Runtime Box geometry is incomplete.');
          const panelStyle = getComputedStyle(panel);
          const hostStyle = getComputedStyle(host);
          const triggerStyle = getComputedStyle(trigger);
          const rect = root.getBoundingClientRect();
          return {
            panelRadius: panelStyle.borderRadius,
            hostRadius: hostStyle.borderRadius,
            hostBorder: hostStyle.borderWidth,
            hostShadow: hostStyle.boxShadow,
            triggerRadius: triggerStyle.borderRadius,
            triggerHeight: trigger.getBoundingClientRect().height,
            fitsViewport:
              rect.left >= 0 && rect.right <= innerWidth && root.scrollWidth <= root.clientWidth,
          };
        });

      try {
        await waitForHomeRuntime(page, 'wc');
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const geometry = await readGeometry();
          expect(geometry.panelRadius, `${colorScheme} ${width}px panel`).toBe('10px');
          expect(geometry.hostRadius, `${colorScheme} ${width}px host radius`).toBe('0px');
          expect(geometry.hostBorder, `${colorScheme} ${width}px host border`).toBe('0px');
          expect(geometry.hostShadow, `${colorScheme} ${width}px host shadow`).toBe('none');
          expect(geometry.triggerRadius, `${colorScheme} ${width}px trigger`).toBe('8px');
          expect(geometry.triggerHeight, `${colorScheme} ${width}px trigger height`).toBe(36);
          expect(geometry.fitsViewport, `${colorScheme} ${width}px overflow`).toBe(true);
        }

        const researchIds = await home
          .locator('[data-browser-runner-research-id]')
          .evaluateAll((items) =>
            items.map((item) => item.getAttribute('data-browser-runner-research-id'))
          );
        expect(researchIds).toEqual(['flutter-wasm', 'qt-wasm', 'gpui-wasm']);
        const runtimeTrigger = home.locator(
          '[data-projection-control="runtime"] [role="combobox"]'
        );
        await runtimeTrigger.click();
        const runtimePortal = await portalControlledBy(page, runtimeTrigger);
        const executableLabels = await runtimePortal.getByRole('option').allTextContents();
        expect(executableLabels).toEqual(['Web Components', 'React', 'Vue', 'Vue 2']);
        await page.keyboard.press('Escape');

        await page.setViewportSize({ width: 1440, height: 900 });
        for (const control of ['component', 'runtime', 'family'] as const) {
          const trigger = home.locator(`[data-projection-control="${control}"] [role="combobox"]`);
          const before = await trigger.boundingBox();
          if (!before) throw new Error(`${control} trigger must have geometry.`);
          await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
          await page.mouse.down();
          await expect
            .poll(() => trigger.evaluate((element) => element.hasAttribute('data-pressed')))
            .toBe(true);
          const pressed = await trigger.boundingBox();
          expect(pressed?.y).toBeCloseTo(before.y + 1, 1);
          await page.mouse.up();
          await expect
            .poll(() => trigger.evaluate((element) => element.hasAttribute('data-pressed')))
            .toBe(false);
          await page.keyboard.press('Escape');
        }

        expect(await home.getAttribute('data-runner-runtime')).toBe('wc');
      } finally {
        await context.close();
      }
    }
  }, 180_000);
});
