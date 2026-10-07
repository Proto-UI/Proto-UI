// @vitest-environment node
import { revealHeaderPreferences } from './site-header-browser';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  captureHeaderPreferenceLease,
  inspectHeaderPreferenceLease,
  headerPreferenceLeaseIssues,
  measureHeaderPreferenceFocusRing,
} from './site-header-breakpoint-evidence';
import type { Browser, ElementHandle, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';
const LABELS = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
async function ready(page: Page, runtime: string) {
  await page.waitForFunction(
    (target) => {
      const page = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      const demo = document.querySelector<HTMLElement>('[data-home-showcase]');
      return (
        page?.dataset.runtimeState === 'ready' &&
        page.dataset.runtime === target &&
        demo?.dataset.runnerState === 'ready' &&
        demo.dataset.runnerRuntime === target
      );
    },
    runtime,
    { timeout: 30_000 }
  );
}
async function switchRuntime(page: Page, runtime: keyof typeof LABELS) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(
    '[data-homepage-runtime] [data-projection-control="runtime"] [role="combobox"]'
  );
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  await page
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', { name: LABELS[runtime], exact: true })
    .click();
  await ready(page, runtime);
}

describe.sequential('Homepage end-to-end dogfood boundary', () => {
  it('switches every registered homepage group through real adapters, preserving native anchors and theme', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc');
      const fallbackLinks = await page.locator('[data-homepage-fallback] a').evaluateAll((links) =>
        links.map((link) => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim(),
          target: link.getAttribute('target'),
        }))
      );
      expect(fallbackLinks.length).toBeGreaterThan(5);
      expect(
        await page.locator('[data-home-showcase] [data-projection-control="runtime"]').count()
      ).toBe(0);
      for (const runtime of [...RUNTIMES, 'react', 'wc'] as const) {
        await switchRuntime(page, runtime);
        const groups = await page.locator('[data-homepage-actions]').evaluateAll((roots) =>
          roots.map((root) => {
            const active = root.querySelectorAll<HTMLElement>(
              '[data-projection-generation-state="active"]'
            );
            const surfaces = [
              ...(active[0]?.querySelectorAll<HTMLElement>('[data-projection-prototype]') ?? []),
            ];
            return {
              activeCount: active.length,
              runtime:
                active[0]?.querySelector<HTMLElement>('[data-projection-scope]')?.dataset
                  .projectionRuntime,
              surfaces: surfaces.length,
              fallbackHidden: root.querySelector<HTMLElement>('[data-homepage-fallback]')?.hidden,
            };
          })
        );
        expect(groups.length).toBeGreaterThanOrEqual(3);
        for (const group of groups) {
          expect(group.activeCount).toBe(1);
          expect(group.runtime).toBe(runtime);

          expect(group.fallbackHidden).toBe(true);
        }
        const anchors = await page
          .locator('[data-homepage-mount] [data-projection-generation-state="active"] a')
          .evaluateAll((links) =>
            links.map((link) => ({
              href: link.getAttribute('href'),
              text: link.textContent?.trim(),
              target: link.getAttribute('target'),
            }))
          );
        expect(anchors).toEqual(fallbackLinks);
        expect(
          await page
            .locator(
              '[data-homepage-runtime] [data-projection-control="runtime"] [role="combobox"]'
            )
            .evaluate((element) => document.activeElement === element)
        ).toBe(true);
        const accessibleTheme = page
          .locator('[data-homepage-runtime]')
          .getByRole('button', { name: '切换主题', exact: true });
        expect(await accessibleTheme.count()).toBe(1);
        expect(await accessibleTheme.getAttribute('title')).toBe('切换主题');
        await accessibleTheme.hover();
        expect(await accessibleTheme.count(), 'name survives hover feedback').toBe(1);
        const themeBefore = await page.locator('html').getAttribute('data-theme');
        await page
          .locator(
            '[data-homepage-runtime] [data-projection-generation-state="active"] [data-demo-ref="home-theme"]'
          )
          .click();
        await expect
          .poll(() => page.locator('html').getAttribute('data-theme'))
          .toBe(themeBefore === 'dark' ? 'light' : 'dark');
        expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe(
          themeBefore === 'dark' ? 'light' : 'dark'
        );
        const trigger = page.locator(
          '[data-homepage-runtime] [data-projection-control="runtime"] [role="combobox"]'
        );
        await revealHeaderPreferences(page);
        await trigger.focus();
        await page.keyboard.press('Enter');
        const keyboardPortalId = await trigger.getAttribute('aria-controls');
        const keyboardPortal = page.locator(`[id=${JSON.stringify(keyboardPortalId)}]`);
        await keyboardPortal.waitFor({ state: 'visible' });
        // Select enters the selected item after its deferred overlay-ready step.
        // Escape must test an entered popup, not race that entry callback.
        await expect
          .poll(
            () =>
              keyboardPortal
                .getByRole('option')
                .evaluateAll((items) => items.some((item) => item === document.activeElement)),
            { timeout: 10_000 }
          )
          .toBe(true);
        await page.keyboard.press('Escape');
        await keyboardPortal.waitFor({ state: 'hidden' });
        await expect
          .poll(() => trigger.evaluate((element) => document.activeElement === element), {
            timeout: 10_000,
          })
          .toBe(true);
      }
      const chooseDemo = async (control: 'family', label: string) => {
        const trigger = page.locator(
          `[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="${control}"] [role="combobox"]`
        );
        await trigger.click();
        const id = await trigger.getAttribute('aria-controls');
        await page
          .locator(`[id=${JSON.stringify(id)}]`)
          .getByRole('option', { name: label, exact: true })
          .click();
      };
      for (const family of ['brutalist', 'shadcn'] as const) {
        await chooseDemo('family', family === 'brutalist' ? 'Brutalist' : 'Shadcn');
        await page.waitForFunction(
          (target) =>
            document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.family ===
            target,
          family
        );
        for (const runtime of RUNTIMES) {
          await switchRuntime(page, runtime);
          const coordinates = await page.evaluate(() => {
            const root = document.querySelector<HTMLElement>('[data-homepage-runtime]')!;
            const demo = document.querySelector<HTMLElement>('[data-home-showcase]')!;
            const scopes = [
              ...document.querySelectorAll<HTMLElement>(
                '[data-homepage-mount] [data-projection-generation-state="active"] [data-projection-scope], [data-home-demo-host] [data-projection-generation-state="active"] [data-projection-scope]'
              ),
            ];
            return {
              family: root.dataset.family,
              component: demo.dataset.projectionComponent,
              pageGeneration: root.dataset.runtimeGeneration,
              demoGeneration: demo.dataset.projectionGeneration,
              scopes: scopes.map((scope) => ({
                runtime: scope.dataset.projectionRuntime,
                family: scope.dataset.projectionFamily,
                generation: scope.dataset.projectionGeneration,
              })),
            };
          });
          const accessibleTheme = page
            .locator('[data-homepage-runtime]')
            .getByRole('button', { name: '切换主题', exact: true });
          expect(await accessibleTheme.count(), `${family}/${runtime} icon accessible name`).toBe(
            1
          );
          expect(await accessibleTheme.getAttribute('title')).toBe('切换主题');
          expect(coordinates.family).toBe(family);
          expect(coordinates.component).toBe('website-component-gallery');
          expect(coordinates.demoGeneration).toBe(coordinates.pageGeneration);
          expect(
            await page.locator('[data-home-showcase] [data-projection-control="component"]').count()
          ).toBe(0);
          expect(await page.locator('[data-home-settings]').count()).toBe(1);
          for (const scope of coordinates.scopes) {
            expect(scope.runtime).toBe(runtime);
            expect(scope.family).toBe(family);
            expect(scope.generation).toBe(coordinates.pageGeneration);
          }
        }
      }
      expect(errors).toEqual([]);
      const link = page
        .locator(
          '#home-navigation-desktop [data-homepage-mount] [data-projection-generation-state="active"] a'
        )
        .filter({ hasText: '文档' });
      expect(await link.count()).toBe(1);
      expect(await link.isVisible()).toBe(true);
      const destination = await link.getAttribute('href');
      const opened = context.waitForEvent('page');
      await link.click({ modifiers: ['Control'] });
      const newPage = await opened;
      await newPage.waitForURL(`**${destination}`);
      await newPage.close();
      expect(new URL(page.url()).pathname).toBe('/zh-cn/');
    } finally {
      await context.close();
    }
  }, 240_000);

  it('keeps native navigation available without JavaScript and does not overflow mobile', async () => {
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await noJs.newPage();
      await page.goto(`${baseUrl}/zh-cn/`);
      const links = page.locator('[data-homepage-fallback] a');
      expect(await links.count()).toBeGreaterThan(5);
      expect(await links.first().isVisible()).toBe(true);
      const nativeMobileDocs = page
        .locator('#home-navigation-mobile [data-homepage-fallback] a')
        .filter({ hasText: '文档' });
      expect(await nativeMobileDocs.count()).toBe(1);
      expect(await nativeMobileDocs.isVisible()).toBe(false);
      const summary = page.locator('[data-site-header-fallback-summary]');
      expect(await summary.isVisible()).toBe(true);
      await summary.click();
      expect(await nativeMobileDocs.isVisible()).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ).toBe(true);
      expect(await nativeMobileDocs.getAttribute('href')).toBe('/zh-cn/start-here/what-you-saw/');
      await nativeMobileDocs.click();
      await page.waitForURL('**/zh-cn/start-here/what-you-saw/');
    } finally {
      await noJs.close();
    }
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(`${baseUrl}/zh-cn/`);
      await ready(page, 'wc');
      for (const width of [390, 430, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const navigation = page.locator('[data-site-header-navigation]');
        const originalNavigation = await navigation.elementHandle();
        expect(
          await originalNavigation!.evaluate((node) => (node as HTMLElement).hidden),
          `${width}px navigation starts collapsed`
        ).toBe(true);
        await revealHeaderPreferences(page);
        expect(
          await originalNavigation!.evaluate(
            (node) => node === document.querySelector('[data-site-header-navigation]')
          )
        ).toBe(true);
        const geometry = await page.evaluate(() => {
          const header = document
            .querySelector<HTMLElement>('[data-homepage-runtime]')!
            .getBoundingClientRect();
          const navigation = document.querySelector<HTMLElement>('[data-site-header-navigation]')!;
          const controls = [
            ...document.querySelectorAll<HTMLElement>(
              '.site-header-search [data-open-modal], .site-header-theme [data-demo-ref="home-theme"], .site-header-menu [data-demo-ref="home-menu"]'
            ),
          ].filter(
            (element) =>
              element.closest('[data-projection-generation-state="active"]') ||
              element.hasAttribute('data-open-modal')
          );
          const controlBounds = controls.map((element) => element.getBoundingClientRect());
          const status = document
            .querySelector<HTMLElement>('[data-homepage-runtime-status]')!
            .getBoundingClientRect();
          const brand = document.querySelector<HTMLElement>(
            '[data-homepage-mount] [data-home-brand]'
          )!;
          return {
            width: header.width,
            navHidden: navigation.hidden,
            controls: controlBounds.map(({ x, y, width, height }) => ({ x, y, width, height })),
            height: header.height,
            headerBottom: header.bottom,
            panel: document
              .querySelector('[data-site-header-panel]')!
              .getBoundingClientRect()
              .toJSON(),
            menu: document
              .querySelector(
                '[data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
              )!
              .getBoundingClientRect()
              .toJSON(),
            preferences: [
              ...document.querySelectorAll<HTMLElement>(
                '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control] [role="combobox"]'
              ),
            ].map((control) => {
              const bounds = control.getBoundingClientRect();
              const value = control.querySelector<HTMLElement>(
                '[data-projection-prototype$="-select-value"]'
              )!;
              return {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                bottom: bounds.bottom,
                fullValueVisible: value.scrollWidth <= value.clientWidth + 1,
              };
            }),
            statusArea: status.width * status.height,
            brandSize: getComputedStyle(brand).fontSize,
          };
        });
        expect(geometry.navHidden, `${width}px navigation is deliberately disclosed`).toBe(false);
        await originalNavigation!.dispose();
        expect(geometry.preferences).toHaveLength(2);
        for (const preference of geometry.preferences) {
          expect(preference.height).toBeGreaterThanOrEqual(44);
          expect(preference.width).toBeGreaterThanOrEqual(120);
          expect(preference.fullValueVisible).toBe(true);
          expect(preference.bottom).toBeLessThanOrEqual(geometry.panel.bottom + 1);
          expect(preference.y).toBeGreaterThanOrEqual(geometry.panel.top);
          expect(preference.y).toBeGreaterThan(
            geometry.controls[0]!.y + geometry.controls[0]!.height
          );
        }
        expect(geometry.preferences[1]!.y).toBeGreaterThan(geometry.preferences[0]!.bottom);
        expect(Math.abs(geometry.panel.top - geometry.headerBottom - 5)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.panel.right - (width - 8))).toBeLessThanOrEqual(1);
        expect(geometry.height).toBeLessThanOrEqual(64);
        expect(geometry.controls).toHaveLength(3);
        for (const control of geometry.controls) {
          expect(control.width).toBeGreaterThanOrEqual(44);
          expect(control.height).toBeGreaterThanOrEqual(44);
          expect(control.y).toBe(geometry.controls[0]!.y);
        }
        expect(geometry.statusArea).toBeLessThanOrEqual(1);
        expect(geometry.brandSize).toBe('16px');
        await page.keyboard.press('Escape');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      const menu = page.locator(
        '[data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
      );
      await menu.click();
      expect(await menu.getAttribute('aria-expanded')).toBe('true');
      const disclosedDocs = page
        .locator('#home-navigation-mobile [data-homepage-mount] a')
        .filter({ hasText: '文档' });
      expect(await disclosedDocs.isVisible()).toBe(true);
      await switchRuntime(page, 'vue2');
      expect(
        await menu.getAttribute('aria-expanded'),
        'open application state survives runtime commit'
      ).toBe('true');
      expect(await disclosedDocs.isVisible()).toBe(true);
      await page.keyboard.press('Escape');
      expect(await menu.getAttribute('aria-expanded')).toBe('false');
      expect(await menu.evaluate((element) => document.activeElement === element)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
    } finally {
      await context.close();
    }
  }, 90_000);
  it('retains saved React across cold library routes and exercises actual family chrome', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc');
      await switchRuntime(page, 'react');
      expect(await page.evaluate(() => localStorage.getItem('preferred-prototypes-adapter'))).toBe(
        'react'
      );
      for (const route of [
        {
          path: '/zh-cn/ui-libraries/brutalist/components/tooltip/',
          family: 'brutalist',
          component: 'tooltip',
        },
        {
          path: '/zh-cn/ui-libraries/shadcn/radio-group/',
          family: 'shadcn',
          component: 'radio-group',
        },
      ]) {
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
        const preview = page
          .locator('[data-previewer-id][data-projection-mode="fixed-family"]')
          .first();
        await preview.scrollIntoViewIfNeeded();
        const scope = preview.locator(
          '[data-projection-generation-state="active"] [data-projection-scope]'
        );
        await expect.poll(() => scope.getAttribute('data-projection-runtime')).toBe('react');
        expect(await page.locator('html').getAttribute('data-site-library-family')).toBe(
          route.family
        );
        expect(await preview.getAttribute('data-projection-family')).toBe(route.family);
        expect(await preview.getAttribute('data-projection-component')).toBe(route.component);
        const adapter = page.locator('header [data-adapter-select-root]').first();
        const language = page.locator('header [data-language-select-root]').first();
        const theme = page.locator('header [data-theme-toggle]').first();
        for (const control of [adapter, language]) {
          expect(await control.evaluate((element) => element.localName)).toBe(
            `wc-${route.family}-select-root`
          );
          expect(await control.getAttribute('data-pui-root')).not.toBeNull();
        }
        expect(await theme.evaluate((element) => element.localName)).toBe(
          `wc-${route.family}-button`
        );
        const chooseAdapter = async (value: 'vue' | 'react') => {
          await revealHeaderPreferences(page);
          const trigger = adapter.locator('[role="combobox"]');
          await trigger.click();
          const id = await trigger.getAttribute('aria-controls');
          expect(id).toBeTruthy();
          const portal = page.locator(`[id=${JSON.stringify(id)}]`);
          await portal.waitFor({ state: 'visible' });
          expect(await portal.getAttribute('data-site-control-family')).toBe(route.family);
          expect(await portal.getAttribute('data-pui-root')).not.toBeNull();
          await portal
            .getByRole('option', { name: value === 'vue' ? 'Vue' : 'React', exact: true })
            .click();
          await expect.poll(() => scope.getAttribute('data-projection-runtime')).toBe(value);
        };
        await chooseAdapter('vue');
        await chooseAdapter('react');
        const menu = page.locator('header [data-site-menu-button]');
        await menu.click();
        expect(await menu.getAttribute('aria-expanded')).toBe('true');
        const languageTrigger = language.locator('[role="combobox"]');
        await languageTrigger.click();
        const languagePortalId = await languageTrigger.getAttribute('aria-controls');
        const languagePortal = page.locator(`[id=${JSON.stringify(languagePortalId)}]`);
        await languagePortal.waitFor({ state: 'visible' });
        expect(await languagePortal.getAttribute('data-site-control-family')).toBe(route.family);
        expect(await languagePortal.getByRole('option').count()).toBeGreaterThan(1);
        await page.keyboard.press('Escape');
        await languagePortal.waitFor({ state: 'hidden' });
        const beforeTheme = await page.locator('html').getAttribute('data-theme');
        await page.evaluate(() => {
          const state = window as typeof window & { __siteThemeChanges?: number };
          state.__siteThemeChanges = 0;
          document.addEventListener('starlight-theme:change', () => {
            state.__siteThemeChanges = (state.__siteThemeChanges ?? 0) + 1;
          });
        });
        await theme.click();
        await expect
          .poll(() => page.locator('html').getAttribute('data-theme'))
          .toBe(beforeTheme === 'dark' ? 'light' : 'dark');
        expect(
          await page.evaluate(
            () => (window as typeof window & { __siteThemeChanges?: number }).__siteThemeChanges
          )
        ).toBe(1);
        expect(
          await page.evaluate(() => localStorage.getItem('preferred-prototypes-adapter'))
        ).toBe('react');
        expect(await preview.getAttribute('data-projection-family')).toBe(route.family);
        expect(await preview.getAttribute('data-projection-component')).toBe(route.component);
      }
    } finally {
      await context.close();
    }
  }, 180_000);
  it('uses real family Contents Buttons through all four Docs runtimes with keyboard and exact-source visual evidence', async () => {
    const directory = path.join(
      process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ??
        path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'homepage-evidence'),
      'contents-command'
    );
    await mkdir(directory, { recursive: true });
    const source = {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
      expectedSha: process.env.CANDIDATE_SHA ?? null,
    };
    for (const family of ['shadcn', 'brutalist'] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
      });
      await page.addInitScript(() => {
        const evidence = {
          longTasks: [] as Array<{ start: number; duration: number }>,
          changes: [] as Array<{ at: number; adapter: unknown }>,
        };
        Object.assign(window, { __contentsRuntimeEvidence: evidence });
        document.addEventListener('proto-adapter:change', (event) => {
          evidence.changes.push({
            at: performance.timeOrigin + performance.now(),
            adapter: (event as CustomEvent<{ adapter: unknown }>).detail?.adapter,
          });
        });
        if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
          new PerformanceObserver((entries) => {
            evidence.longTasks.push(
              ...entries.getEntries().map((entry) => ({
                start: performance.timeOrigin + entry.startTime,
                duration: entry.duration,
              }))
            );
            evidence.longTasks.splice(0, Math.max(0, evidence.longTasks.length - 100));
          }).observe({ type: 'longtask', buffered: true });
      });
      try {
        const route =
          family === 'shadcn'
            ? '/zh-cn/ui-libraries/shadcn/button/'
            : '/zh-cn/ui-libraries/brutalist/components/button/';
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const root = page.locator('[data-site-contents-command]');
        const command = root.locator(
          '[data-projection-generation-state="active"] [data-site-contents-button]'
        );
        const menu = page.locator('[data-docs-site-header] [data-site-menu-button]');
        for (const runtime of RUNTIMES) {
          await revealHeaderPreferences(page);
          const select = page.locator('[data-adapter-select] [role="combobox"]');
          await select.click();
          const popup = await select.getAttribute('aria-controls');
          const transitionStartedAt = Date.now();
          await page
            .locator(`[id=${JSON.stringify(popup)}]`)
            .getByRole('option', { name: LABELS[runtime], exact: true })
            .click();
          const clickedAt = Date.now();
          let originalError: unknown;
          try {
            await expect.poll(() => root.getAttribute('data-contents-runtime')).toBe(runtime);
          } catch (error) {
            originalError = error;
          }
          const originalCheckAt = Date.now();
          const readTransition = () =>
            page.evaluate((since) => {
              const contents = document.querySelector<HTMLElement>('[data-site-contents-command]');
              const panel = document.querySelector<HTMLElement>('[data-site-header-panel]');
              const evidence = (
                window as typeof window & {
                  __contentsRuntimeEvidence?: {
                    longTasks: Array<{ start: number; duration: number }>;
                    changes: Array<{ at: number; adapter: unknown }>;
                  };
                }
              ).__contentsRuntimeEvidence;
              return {
                observedAt: performance.timeOrigin + performance.now(),
                preference: localStorage.getItem('preferred-prototypes-adapter'),
                contents: contents ? { ...contents.dataset } : null,
                panel: panel ? { ...panel.dataset } : null,
                generations: [
                  ...document.querySelectorAll<HTMLElement>(
                    'header [data-projection-generation-host]'
                  ),
                ].map((element) => ({ ...element.dataset, inert: element.inert })),
                longTasks: evidence?.longTasks.filter((entry) => entry.start >= since),
                changes: evidence?.changes.filter((entry) => entry.at >= since),
                resources: performance
                  .getEntriesByType('resource')
                  .filter(
                    (entry) =>
                      performance.timeOrigin + entry.startTime >= since &&
                      new URL(entry.name).origin === location.origin
                  )
                  .slice(-40)
                  .map((entry) => ({
                    path: new URL(entry.name).pathname,
                    start: performance.timeOrigin + entry.startTime,
                    duration: entry.duration,
                  })),
              };
            }, transitionStartedAt);
          try {
            const first = await readTransition();
            let late: Awaited<ReturnType<typeof readTransition>> | null = null;
            if (originalError) {
              // Diagnosis only: retain the original1000ms failure even if this
              // bounded observation later sees the requested generation commit.
              await page
                .waitForFunction(
                  (target) =>
                    document.querySelector<HTMLElement>('[data-site-contents-command]')?.dataset
                      .contentsRuntime === target,
                  runtime,
                  { timeout: 3000 }
                )
                .catch(() => {});
              late = await readTransition();
              await page.screenshot({
                path: path.join(directory, `${family}-${runtime}-failure.png`),
              });
            }
            await writeFile(
              path.join(directory, `${family}-${runtime}-transition.json`),
              JSON.stringify(
                {
                  source,
                  family,
                  runtime,
                  transitionStartedAt,
                  clickedAt,
                  originalCheckAt,
                  originalDeadlineMs: 1000,
                  originalError: originalError ? String(originalError) : null,
                  first,
                  late,
                  pageErrors,
                },
                null,
                2
              )
            );
          } catch (diagnosticError) {
            console.error('[Contents runtime evidence]', diagnosticError);
          }
          if (originalError) throw originalError;
          expect(await root.getAttribute('data-contents-family')).toBe(family);
          expect(await root.getAttribute('data-contents-generation')).toBe(
            await page
              .locator('[data-site-header-panel]')
              .getAttribute('data-header-surface-generation')
          );
          if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
          expect(await root.getByRole('button', { name: '页面目录', exact: true }).count()).toBe(1);
          expect(await command.getAttribute('aria-controls')).toBe('starlight__sidebar');
          for (const action of ['click', 'Enter', 'Space']) {
            expect(await command.getAttribute('aria-expanded')).toBe('false');
            if (action === 'click') await command.click();
            else {
              await command.focus();
              await page.keyboard.press(action);
            }
            await expect.poll(() => command.getAttribute('aria-expanded')).toBe('true');
            expect(await page.locator('#starlight__sidebar').isVisible()).toBe(true);
            await page.keyboard.press('Escape');
            await expect.poll(() => command.getAttribute('aria-expanded')).toBe('false');
            expect(await command.evaluate((element) => document.activeElement === element)).toBe(
              true
            );
          }
          // Real keyboard navigation selects the focus-visible state for the capture.
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          const facts = await command.evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            const center = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return {
              tokens: element.getAttribute('data-pui-style'),
              width: box.width,
              height: box.height,
              border: [style.borderWidth, style.borderColor],
              radius: style.borderRadius,
              shadow: style.boxShadow,
              font: style.fontFamily,
              focusVisible: element.hasAttribute('data-focus-visible'),
              ownsCenter: !!center && element.contains(center),
            };
          });
          expect(facts.width).toBeGreaterThanOrEqual(44);
          expect(facts.height).toBeGreaterThanOrEqual(44);
          expect(facts.ownsCenter).toBe(true);
          expect(facts.focusVisible).toBe(true);
          expect(facts.tokens).toContain(
            family === 'shadcn' ? 'border-transparent' : 'rounded-base'
          );
          const id = `${family}-${runtime}-keyboard-focus`;
          const record = {
            source,
            family,
            runtime,
            viewport: page.viewportSize(),
            facts,
            screenshot: `${id}.png`,
          };
          await writeFile(
            path.join(directory, `${id}.json`),
            JSON.stringify({ ...record, screenshotComplete: false }, null, 2)
          );
          await page.screenshot({ path: path.join(directory, `${id}.png`) });
          await writeFile(
            path.join(directory, `${id}.json`),
            JSON.stringify({ ...record, screenshotComplete: true }, null, 2)
          );
        }
      } finally {
        await context.close();
      }
    }
  }, 180_000);
  it('uses the same mobile shell on documentation with independent global navigation and contents', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      for (const width of [390, 430, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${baseUrl}/zh-cn/ui-libraries/brutalist/components/tooltip/`, {
          waitUntil: 'networkidle',
        });
        const header = page.locator('[data-docs-site-header]');
        const menu = header.locator('[data-site-menu-button]');
        await expect.poll(() => header.getAttribute('data-site-menu-ready')).toBe('');
        // This loop reuses its native pointer across navigations. Measure the
        // resting row, not a legitimate +4px Brutalist hover under the old point.
        await page.mouse.move(0, 800);
        const geometry = await header.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const controls = [
            ...element.querySelectorAll<HTMLElement>(
              '.site-header-search [data-open-modal], [data-theme-toggle], [data-site-menu-button]'
            ),
          ].map((control) => {
            const { x, y, width, height } = control.getBoundingClientRect();
            return { x, y, width, height };
          });
          return {
            height: bounds.height,
            measuredOffset: parseFloat(
              getComputedStyle(element.closest('.site-page-frame')!).getPropertyValue(
                '--header-height'
              )
            ),
            controls,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(Math.abs(geometry.height - geometry.measuredOffset)).toBeLessThanOrEqual(1);
        expect(geometry.overflow).toBe(false);
        expect(geometry.controls).toHaveLength(3);
        for (const control of geometry.controls) {
          expect(control.width).toBeGreaterThanOrEqual(44);
          expect(control.height).toBeGreaterThanOrEqual(44);
          expect(control.y).toBe(geometry.controls[0]!.y);
        }
        await menu.click();
        expect(await menu.getAttribute('aria-controls')).toBe('site-header-panel');
        expect(await header.locator('[data-site-header-navigation]').isVisible()).toBe(true);
        expect(await page.locator('body').getAttribute('data-mobile-menu-expanded')).toBeNull();
        await page.keyboard.press('Escape');
        expect(await menu.getAttribute('aria-expanded')).toBe('false');
        const contents = header.locator(
          '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
        );
        expect(await contents.getAttribute('aria-controls')).toBe('starlight__sidebar');
        expect(await header.getByRole('button', { name: '页面目录', exact: true }).count()).toBe(1);
        expect(await contents.getAttribute('title')).toBe('页面目录');
        await revealHeaderPreferences(page);
        const hitTargets = await header.evaluate((element) => {
          const trigger = element.querySelector<HTMLElement>(
            '[data-adapter-select] [role="combobox"]'
          )!;
          const contents = element.querySelector<HTMLElement>(
            '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
          )!;
          const triggerRect = trigger.getBoundingClientRect();
          const contentsRect = contents.getBoundingClientRect();
          const center = document.elementFromPoint(
            contentsRect.x + contentsRect.width / 2,
            contentsRect.y + contentsRect.height / 2
          );
          return {
            trigger: { left: triggerRect.left, right: triggerRect.right, top: triggerRect.top },
            contents: {
              left: contentsRect.left,
              right: contentsRect.right,
              bottom: contentsRect.bottom,
            },
            contentsOwnsCenter: center !== null && contents.contains(center),
            centerTag: center?.tagName,
            chevrons: [...trigger.querySelectorAll('svg')].map((svg) => {
              const rect = svg.getBoundingClientRect();
              return { left: rect.left, right: rect.right, width: rect.width };
            }),
          };
        });
        console.info('Mobile documentation header hit targets', { width, ...hitTargets });
        expect(hitTargets.chevrons).toHaveLength(1);
        for (const chevron of hitTargets.chevrons) {
          expect(chevron.width, `${width}px real runtime chevron`).toBeGreaterThan(0);
          expect(chevron.left, `${width}px chevron inside trigger left`).toBeGreaterThanOrEqual(
            hitTargets.trigger.left
          );
          expect(chevron.right, `${width}px chevron inside trigger right`).toBeLessThanOrEqual(
            hitTargets.trigger.right
          );
        }
        expect(
          hitTargets.trigger.top,
          `${width}px runtime panel is separate from the first-row contents opener`
        ).toBeGreaterThanOrEqual(hitTargets.contents.bottom);
        expect(
          hitTargets.contentsOwnsCenter,
          `${width}px native contents target owns its center`
        ).toBe(true);
        await contents.click();
        expect(await page.locator('body').getAttribute('data-mobile-menu-expanded')).not.toBeNull();
        expect(await menu.getAttribute('aria-expanded')).toBe('false');
        // Opening global navigation closes contents without transferring focus.
        await menu.click();
        expect(await menu.getAttribute('aria-expanded')).toBe('true');
        expect(await contents.getAttribute('aria-expanded')).toBe('false');
        expect(await page.locator('body').getAttribute('data-mobile-menu-expanded')).toBeNull();
        await page.keyboard.press('Escape');
        expect(await menu.evaluate((element) => document.activeElement === element)).toBe(true);
        // Reverse the order and exercise the complete keydown + keyup Escape.
        await menu.click();
        await contents.click();
        await expect.poll(() => menu.getAttribute('aria-expanded')).toBe('false');
        expect(await contents.getAttribute('aria-expanded')).toBe('true');
        await page.keyboard.press('Escape');
        expect(await contents.evaluate((element) => document.activeElement === element)).toBe(true);
      }
    } finally {
      await context.close();
    }
  }, 90_000);
});

for (const family of ['shadcn', 'brutalist'] as const) {
  it(`compact ${family} preferences stay usable at 200% text, RTL and breakpoint moves`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc');
      await revealHeaderPreferences(page);
      if (family === 'brutalist') {
        const control = page.locator(
          '#home-preferences [data-projection-control="family"] [role="combobox"]'
        );
        await control.click();
        const id = await control.getAttribute('aria-controls');
        await page
          .locator(`[id=${JSON.stringify(id)}]`)
          .getByRole('option', { name: 'Brutalist', exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.family ===
            'brutalist'
        );
      }
      for (const width of [320, 390])
        for (const rtl of [false, true]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate((rtl) => {
            document.documentElement.dir = rtl ? 'rtl' : 'ltr';
            document.documentElement.style.fontSize = '200%';
          }, rtl);
          const menu = page.locator(
            '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
          );
          // Reopen through the actual Button after changing host text/direction.
          if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
          await revealHeaderPreferences(page);
          const controls = page.locator('#home-preferences [role="combobox"]');
          expect(await controls.count()).toBe(2);
          for (const control of await controls.all()) {
            await control.scrollIntoViewIfNeeded();
            const facts = await control.evaluate((node) => {
              const value = node.querySelector<HTMLElement>(
                '[data-projection-prototype$="-select-value"]'
              )!;
              return {
                rect: node.getBoundingClientRect().toJSON(),
                overflow: value.scrollWidth - value.clientWidth,
                whiteSpace: getComputedStyle(value).whiteSpace,
                hidden: !!node.closest('[hidden], [inert]'),
              };
            });
            expect(facts.hidden).toBe(false);
            expect(facts.rect.height).toBeGreaterThanOrEqual(44);
            expect(facts.whiteSpace).toBe('normal');
            expect(facts.overflow).toBeLessThanOrEqual(1);
          }
          const placement = await page.locator('[data-site-header-panel]').evaluate((panel) => {
            const surface = panel.querySelector('.site-header-popup-surface')!;
            const trigger = document.querySelector(
              '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
            )!;
            return {
              panel: panel.getBoundingClientRect().toJSON(),
              surface: surface.getBoundingClientRect().toJSON(),
              trigger: trigger.getBoundingClientRect().toJSON(),
              header: trigger.closest('[data-site-header]')!.getBoundingClientRect().toJSON(),
              overflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
          expect(placement.overflow).toBeLessThanOrEqual(1);
          expect(Math.abs(placement.panel.top - placement.header.bottom - 5)).toBeLessThanOrEqual(
            1
          );
          expect(
            Math.abs((rtl ? placement.panel.left : placement.panel.right) - (rtl ? 8 : width - 8))
          ).toBeLessThanOrEqual(1);
          expect(Math.abs(placement.surface.width - placement.panel.width)).toBeLessThanOrEqual(1);
          const runtime = page.locator(
            '#home-preferences [data-projection-control="runtime"] [role="combobox"]'
          );
          await runtime.focus();
          await page.setViewportSize({ width: 1440, height: 1000 });
          await expect
            .poll(() =>
              runtime.evaluate(
                (node) =>
                  node === document.activeElement && !node.closest('[data-site-header-panel]')
              )
            )
            .toBe(true);
          await page.setViewportSize({ width, height: 1000 });
          await expect
            .poll(() =>
              runtime.evaluate(
                (node) =>
                  node === document.activeElement &&
                  !!node.closest('[data-site-header-panel]') &&
                  !node.closest('[hidden], [inert]')
              )
            )
            .toBe(true);
          await page.keyboard.press('Escape');
          expect(await menu.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await page.locator('[data-site-header-panel]').isVisible()).toBe(false);
        }
    } finally {
      await context.close();
    }
  }, 120_000);
}

// Two bounded family journeys, each exercising all four actual renderers. A
// locator re-query is insufficient here: every comparison retains the original
// physical ElementHandle, plus WC's public exposed-state handle identities.
for (const family of ['shadcn', 'brutalist'] as const) {
  it(`retains ${family} preference owners and portals through real breakpoint reconnects`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const evidenceDirectory = path.join(
      process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR ??
        path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'homepage-evidence'),
      'header-breakpoint'
    );
    await mkdir(evidenceDirectory, { recursive: true });
    const source = {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '',
      expectedSha: process.env.CANDIDATE_SHA ?? null,
      eventSha: process.env.GITHUB_SHA ?? null,
    };
    const records: unknown[] = [];
    const ringFailures: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let stage = 'navigate';
    const save = async (name: string, facts: unknown) => {
      const id = `${family}-${name}`;
      const screenshot = `${id}.png`;
      const jsonPath = path.join(evidenceDirectory, `${id}.json`);
      const record = {
        source,
        screenshot,
        family,
        stage,
        viewport: page.viewportSize(),
        capturedAt: new Date().toISOString(),
        facts,
      };
      // Retain the primary geometry/ownership facts even if capture itself fails.
      await writeFile(jsonPath, JSON.stringify({ ...record, screenshotComplete: false }, null, 2));
      await page.screenshot({ path: path.join(evidenceDirectory, screenshot) });
      await writeFile(jsonPath, JSON.stringify({ ...record, screenshotComplete: true }, null, 2));
    };
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc');
      if (family === 'brutalist') {
        await revealHeaderPreferences(page);
        const control = page.locator(
          '#home-preferences [data-projection-control="family"] [role="combobox"]'
        );
        await control.click();
        const id = await control.getAttribute('aria-controls');
        await page
          .locator(`[id=${JSON.stringify(id)}]`)
          .getByRole('option', { name: 'Brutalist', exact: true })
          .click();
        await expect
          .poll(() => page.locator('[data-homepage-runtime]').getAttribute('data-family'))
          .toBe(family);
        await ready(page, 'wc');
      }
      for (const runtime of RUNTIMES) {
        await page.setViewportSize({ width: 390, height: 844 });
        await switchRuntime(page, runtime);
        const header = page.locator('[data-homepage-runtime]');
        const generation = await header.getAttribute('data-runtime-generation');
        const handles = new Map<string, ElementHandle<HTMLElement>>();
        for (const control of ['runtime', 'family'] as const) {
          stage = `${runtime}-${control}-lease`;
          const triggerLocator = page.locator(
            `#home-preferences [data-projection-control="${control}"] [role="combobox"]`
          );
          const rootLocator = page.locator(
            `#home-preferences [data-demo-ref="__pui_projection__${control}_root"]`
          );
          await expect.poll(() => triggerLocator.count()).toBe(1);
          await expect.poll(() => rootLocator.count()).toBe(1);
          const trigger = (await triggerLocator.elementHandle()) as ElementHandle<HTMLElement>;
          const root = (await rootLocator.elementHandle()) as ElementHandle<HTMLElement>;
          expect(trigger).not.toBeNull();
          expect(root).not.toBeNull();
          handles.set(control, trigger);
          const lease = await trigger.evaluateHandle(captureHeaderPreferenceLease, {
            root,
            control,
          });
          let portal: ElementHandle<HTMLElement> | null = null;
          let selected: ElementHandle<HTMLElement> | null = null;
          try {
            await trigger.focus();
            await page.keyboard.press('Enter');
            const id = await trigger.getAttribute('aria-controls');
            expect(id).toBeTruthy();
            const portalLocator = page.locator(`[id=${JSON.stringify(id)}]`);
            await portalLocator.waitFor({ state: 'visible' });
            const expectedLabel =
              control === 'runtime'
                ? LABELS[runtime]
                : family === 'shadcn'
                  ? 'Shadcn'
                  : 'Brutalist';
            const selectedLocator = portalLocator.getByRole('option', {
              name: expectedLabel,
              exact: true,
            });
            await expect
              .poll(() =>
                selectedLocator.evaluate(
                  (node) =>
                    node === document.activeElement && node.getAttribute('aria-selected') === 'true'
                )
              )
              .toBe(true);
            portal = (await portalLocator.elementHandle()) as ElementHandle<HTMLElement>;
            selected = (await selectedLocator.elementHandle()) as ElementHandle<HTMLElement>;
            for (const [name, width, insidePanel] of [
              ['mobile-before', 390, true],
              ['desktop', 1440, false],
              ['mobile-return', 320, true],
            ] as const) {
              stage = `${runtime}-${control}-${name}`;
              await page.setViewportSize({ width, height: 844 });
              await expect
                .poll(() =>
                  lease
                    .evaluate(inspectHeaderPreferenceLease, {
                      insidePanel,
                      portal: portal!,
                      selected: selected!,
                      focused: 'portal' as const,
                    })
                    .then(headerPreferenceLeaseIssues)
                )
                .toEqual([]);
              const facts = await lease.evaluate(inspectHeaderPreferenceLease, {
                insidePanel,
                portal,
                selected,
                focused: 'portal' as const,
              });
              records.push({ stage, facts });
              if (control === 'runtime') await save(stage, facts);
              expect(await header.getAttribute('data-runtime-generation')).toBe(generation);
              expect(await trigger.getAttribute('aria-controls')).toBe(id);
            }
            // Re-select the current value using native keys, so a legitimate
            // runtime/family change cannot hide a breakpoint-induced remount.
            stage = `${runtime}-${control}-keyboard-commit-current`;
            await page.keyboard.press('Home');
            const options = control === 'runtime' ? Object.values(LABELS) : ['Shadcn', 'Brutalist'];
            for (let index = 0; index < options.indexOf(expectedLabel); index++)
              await page.keyboard.press('ArrowDown');
            await expect
              .poll(() => selected!.evaluate((node) => node === document.activeElement))
              .toBe(true);
            await page.keyboard.press('Enter');
            await expect.poll(() => portal!.isVisible()).toBe(false);
            await expect
              .poll(() =>
                lease
                  .evaluate(inspectHeaderPreferenceLease, {
                    insidePanel: true,
                    focused: 'trigger' as const,
                  })
                  .then(headerPreferenceLeaseIssues)
              )
              .toEqual([]);
            records.push({
              stage,
              facts: await lease.evaluate(inspectHeaderPreferenceLease, {
                insidePanel: true,
                focused: 'trigger' as const,
              }),
            });
            expect(await header.getAttribute('data-runtime-generation')).toBe(generation);
          } finally {
            await lease.dispose();
            await root.dispose();
            await portal?.dispose();
            await selected?.dispose();
          }
        }
        // The compact closed state must remove the settings row. Do not change
        // app DOM or force a hidden Select to obtain its focus-ring capture.
        stage = `${runtime}-closed`;
        await page.keyboard.press('Escape');
        const menu = page.locator(
          '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
        );
        await expect.poll(() => menu.getAttribute('aria-expanded')).toBe('false');
        expect(await header.locator('[data-site-header-preferences]').isVisible()).toBe(false);
        expect((await header.boundingBox())!.height).toBeLessThanOrEqual(64);
        await page.setViewportSize({ width: 320, height: 300 });
        await menu.focus();
        await page.keyboard.press('Enter');
        const firstLink = page
          .locator('#home-navigation-mobile [data-homepage-mount] a[href]')
          .first();
        await expect
          .poll(() => firstLink.evaluate((node) => node === document.activeElement))
          .toBe(true);
        const unfocused = await handles.get('runtime')!.evaluate(measureHeaderPreferenceFocusRing);
        for (let index = 0; index < 3; index++) await page.keyboard.press('Tab');
        for (const control of ['runtime', 'family'] as const) {
          stage = `${runtime}-${control}-narrow-focus-ring`;
          const trigger = handles.get(control)!;
          await expect
            .poll(() =>
              trigger.evaluate(
                (node) => node === document.activeElement && node.matches(':focus-visible')
              )
            )
            .toBe(true);
          const expectedToken = family === 'shadcn' ? 'ring-3' : 'ring-2';
          await expect.poll(() => trigger.getAttribute('data-pui-style')).toContain(expectedToken);
          const facts = await trigger.evaluate(measureHeaderPreferenceFocusRing);
          records.push({ stage, facts });
          await save(stage, { unfocused, focused: facts });
          if (!facts.unclipped || !facts.inViewport)
            ringFailures.push(
              `${stage}: ${JSON.stringify({ ring: facts.ring, viewport: facts.viewport, clipping: facts.clipping })}`
            );
          expect(facts.prototype).toBe(`${family}-select-trigger`);
          expect(facts.ringWidth).toBe(family === 'shadcn' ? 3 : 2);
          expect(facts.ringOffset).toBe(family === 'shadcn' ? 0 : 2);
          expect(facts.shadow).not.toBe('none');
          if (control === 'runtime') expect(facts.shadow).not.toBe(unfocused.shadow);
          if (control === 'runtime') await page.keyboard.press('Tab');
        }
        await page.keyboard.press('Escape');
        await expect
          .poll(() => menu.evaluate((node) => node === document.activeElement))
          .toBe(true);
        for (const handle of handles.values()) await handle.dispose();
      }
      expect(errors).toEqual([]);
      // Collect every family/runtime sample before reporting clipping debt.
      expect(ringFailures, 'Prototype focus rings must fit all real clipping boundaries').toEqual(
        []
      );
    } catch (error) {
      await save('failure', { stage, message: String(error), records, ringFailures, errors });
      throw error;
    } finally {
      await writeFile(
        path.join(evidenceDirectory, `${family}-lifecycle.json`),
        JSON.stringify({ source, family, records, ringFailures, errors }, null, 2)
      );
      await context.close();
    }
  }, 180_000);
}
