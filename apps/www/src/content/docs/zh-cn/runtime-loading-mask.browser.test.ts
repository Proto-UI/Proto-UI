// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import { BRUTALIST_THEME } from '../../../../../../packages/prototypes/brutalist/src/theme';

let browser: Browser;
let baseUrl: string;
const output = process.env.PUI_RUNTIME_MASK_EVIDENCE_DIR;
const observations: unknown[] = [];
beforeAll(async () => {
  baseUrl = await startServer('/en/');
  browser = await launchBrowser();
  if (output) await mkdir(output, { recursive: true });
}, 150_000);
afterAll(async () => {
  if (output)
    await writeFile(
      path.join(output, 'observations.json'),
      JSON.stringify(
        {
          sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          provenance:
            'Real public controls and native input; target-module network delay/failure is an explicit test injection, not load-time performance evidence.',
          observations,
        },
        null,
        2
      )
    );
  await browser?.close();
  await stopServer();
}, 60_000);
// Production evidence binds the injection to the emitted chunk containing the
// same reviewed source module. Development keeps the original failing route.
async function runtimeModuleRoute(page: Page): Promise<string | ((url: URL) => boolean)> {
  if (process.env.PUI_RUNTIME_MODULE_MODE !== 'production') return '**/runtimes/react-runtime.ts*';
  const response = await page.request.get(`${baseUrl}/proto-ui-bundle-graph.json`);
  expect(response.ok()).toBe(true);
  const graph = await response.json();
  const source = 'apps/www/src/components/PrototypePreviewer/runtimes/react-runtime.ts';
  const matches = graph.chunks.filter((chunk: { moduleIds: string[] }) =>
    chunk.moduleIds.includes(source)
  );
  expect(matches).toHaveLength(1);
  const target = new URL(matches[0].fileName, `${baseUrl}/`);
  expect(target.origin).toBe(new URL(baseUrl).origin);
  return (url) => url.origin === target.origin && url.pathname === target.pathname;
}

async function choose(page: Page, control: 'runtime' | 'family', value: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(
    `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${control}"] [role="combobox"]`
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  await page
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', { name: value, exact: true })
    .click();
}
async function ready(page: Page, runtime: string, family?: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const demo = document.querySelector<HTMLElement>('[data-home-showcase]');
      return (
        root?.dataset.runtimeState === 'ready' &&
        root.dataset.runtime === runtime &&
        demo?.dataset.runnerState === 'ready' &&
        demo.dataset.runnerRuntime === runtime &&
        (!family ||
          (demo.dataset.projectionFamily === family &&
            demo.dataset.runtimeMaskFamily === family &&
            demo.dataset.runtimeMaskReady === 'true'))
      );
    },
    { runtime, family },
    { timeout: 45_000 }
  );
}
async function setup(page: Page, family: string, colorScheme: 'light' | 'dark' = 'light') {
  await page.addInitScript((colorScheme) => {
    localStorage.setItem('preferred-prototypes-adapter', 'wc');
    localStorage.setItem('starlight-theme', colorScheme);
  }, colorScheme);
  await page.goto(`${baseUrl}/en/`);
  await ready(page, 'wc');
  if (family === 'brutalist') {
    await choose(page, 'family', 'Brutalist');
    await ready(page, 'wc', family);
  }
  await ready(page, 'wc', family);
}
async function capture(page: Page, name: string) {
  const facts = await page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[data-home-showcase]')!;
    const mask = region.querySelector<HTMLElement>('[data-runtime-loading-mask]')!;
    return {
      state: region.dataset.runnerState,
      family: region.dataset.projectionFamily,
      maskFamily: region.dataset.runtimeMaskFamily,
      runtime: region.dataset.runnerRuntime,
      maskHidden: mask.hidden,
      maskState: mask.dataset.state,
      maskRect: mask.getBoundingClientRect().toJSON(),
      regionRect: region.getBoundingClientRect().toJSON(),
      busy: region.querySelector('[data-home-demo-host]')?.getAttribute('aria-busy'),
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyInert: document.body.inert,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      ownBackground: mask.style.getPropertyValue('--pui-background').trim(),
      sourceBackground: getComputedStyle(region).getPropertyValue('--pui-background').trim(),
      panelRect: mask.querySelector('[data-demo-ref="panel"]')!.getBoundingClientRect().toJSON(),
      panelBackground: getComputedStyle(mask.querySelector('[data-demo-ref="panel"]')!)
        .backgroundColor,
      activeRole: document.activeElement?.getAttribute('role'),
      atoms: Array.from(mask.querySelectorAll('[data-pui-root]')).map((element) => ({
        tag: element.tagName,
        ref: element.getAttribute('data-demo-ref'),
        tokens: element.getAttribute('data-pui-style'),
      })),
    };
  });
  if (output) await page.screenshot({ path: path.join(output, `${name}.png`) });
  observations.push({ name, viewport: page.viewportSize(), facts });
  return facts;
}
for (const family of ['shadcn', 'brutalist']) {
  describe(`${family} native regional runtime mask`, () => {
    for (const scenario of [
      {
        name: 'desktop-light',
        width: 1280,
        height: 1000,
        reducedMotion: 'no-preference',
        colorScheme: 'light',
        enlarged: false,
      },
      {
        name: 'narrow-dark-text200',
        width: 320,
        height: 900,
        reducedMotion: 'reduce',
        colorScheme: 'dark',
        enlarged: true,
      },
    ] as const) {
      it(`retains the current demo after keyboard cancellation at ${scenario.name}`, async () => {
        const page = await browser.newPage({
          viewport: { width: scenario.width, height: scenario.height },
          reducedMotion: scenario.reducedMotion,
          colorScheme: scenario.colorScheme,
        });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        try {
          await setup(page, family, scenario.colorScheme);
          if (scenario.enlarged)
            await page.evaluate(() => {
              document.documentElement.style.fontSize = '200%';
            });
          const content = page.locator('[data-home-demo-host]');
          const retained = await content.locator('[data-home-settings]').elementHandle();
          const note = content.getByRole('textbox', { name: 'Additional note', exact: true });
          await note.fill('Keep this authored value');
          const oldOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
          let requested = false;
          await page.route(await runtimeModuleRoute(page), async (route) => {
            requested = true;
            await gate;
            await route.continue();
          });
          await choose(page, 'runtime', 'React');
          await expect.poll(() => requested).toBe(true);
          const mask = page.locator('[data-runtime-loading-mask]');
          await mask.waitFor({ state: 'visible' });
          const loading = await capture(page, `${family}-${scenario.name}-loading`);
          expect(loading.busy).toBe('true');
          expect(loading.bodyInert).toBe(false);
          expect(loading.bodyOverflow).toBe(oldOverflow);
          expect(loading.atoms).toHaveLength(6);
          expect(
            loading.atoms.every((atom) => atom.tag.startsWith(`WC-${family.toUpperCase()}-`))
          ).toBe(true);
          expect(loading.ownBackground).toBe(
            family === 'brutalist'
              ? BRUTALIST_THEME[scenario.colorScheme].background
              : loading.sourceBackground
          );
          expect(loading.panelBackground).not.toBe('rgba(0, 0, 0, 0)');
          expect(loading.panelRect.left).toBeGreaterThanOrEqual(0);
          expect(loading.panelRect.right).toBeLessThanOrEqual(scenario.width);
          expect(loading.panelRect.height).toBeLessThanOrEqual(scenario.height);
          expect(loading.reducedMotion).toBe(scenario.reducedMotion === 'reduce');
          const cancel = mask.getByRole('button', { name: 'Cancel switch', exact: true });
          await cancel.focus();
          await page.keyboard.press('Enter');
          await ready(page, 'wc');
          await mask.waitFor({ state: 'hidden' });
          const restoredFocus = page.locator(
            '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="runtime"] [role="combobox"]'
          );
          await expect
            .poll(() => restoredFocus.evaluate((element) => document.activeElement === element))
            .toBe(true);
          expect(await retained!.evaluate((element) => element.isConnected)).toBe(true);
          expect(await note.inputValue()).toBe('Keep this authored value');
          release();
          await page.waitForLoadState('networkidle');
          await ready(page, 'wc');
          await capture(page, `${family}-${scenario.name}-cancelled-retained`);
        } finally {
          release?.();
          await page.close();
        }
      }, 90_000);
    }
    it('retains a visible error and retries the failed target through its public Button', async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
      const requests: string[] = [];
      const errors: string[] = [];
      let navigations = 0;
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        await setup(page, family);
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) navigations += 1;
        });
        const note = page
          .locator('[data-home-demo-host]')
          .getByRole('textbox', { name: 'Additional note', exact: true });
        await note.fill('Retain this value until the target is ready');
        let failed = false;
        await page.route(await runtimeModuleRoute(page), async (route) => {
          requests.push(route.request().url());
          if (!failed) {
            failed = true;
            await route.abort('failed');
          } else await route.continue();
        });
        await choose(page, 'runtime', 'React');
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('[data-home-showcase]')?.dataset.runnerState ===
            'error'
        );
        const mask = page.locator('[data-runtime-loading-mask]');
        await capture(page, `${family}-failed-target`);
        expect(await note.inputValue()).toBe('Retain this value until the target is ready');
        expect(requests).toHaveLength(1);
        const retry = mask.getByRole('button', { name: 'Retry', exact: true });
        await retry.focus();
        await page.keyboard.press('Enter');
        await ready(page, 'react');
        await mask.waitFor({ state: 'hidden' });
        const restoredFocus = page.locator(
          '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="runtime"] [role="combobox"]'
        );
        await expect
          .poll(() => restoredFocus.evaluate((element) => document.activeElement === element))
          .toBe(true);
        await capture(page, `${family}-retried-target-ready`);
        expect(requests).toHaveLength(2);
        expect(new URL(requests[1]).pathname).toBe(new URL(requests[0]).pathname);
        expect(new URL(requests[1]).searchParams.get('pui-runtime-retry')).toBe('1');
        expect(navigations).toBe(0);
      } catch (error) {
        if (output)
          await page.screenshot({ path: path.join(output, `${family}-retry-failure.png`) });
        throw error;
      } finally {
        observations.push({
          name: `${family}-retry-module-network`,
          mode: process.env.PUI_RUNTIME_MODULE_MODE ?? 'development',
          requests,
          errors,
          navigations,
        });
        await page.close();
      }
    }, 90_000);
  });
}
