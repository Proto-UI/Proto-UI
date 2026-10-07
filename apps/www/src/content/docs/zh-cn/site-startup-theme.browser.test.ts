// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const baseline = process.env.PROTO_UI_STARTUP_SUBJECT === 'baseline';
const output = process.env.PROTO_UI_STARTUP_EVIDENCE_DIR;
const records: unknown[] = [];
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  if (!process.env.PROTO_UI_BROWSER_BASE_URL)
    throw new Error('Startup evidence requires the dedicated built production-site owner.');
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
  if (output) await mkdir(output, { recursive: true });
}, 150_000);
afterAll(async () => {
  if (output)
    await writeFile(
      path.join(output, 'observations.json'),
      JSON.stringify({ revision, baseline, browser: browser?.version(), records }, null, 2)
    );
  await browser?.close();
  await stopServer();
}, 60_000);
async function capture(page: Page, id: string, facts: unknown) {
  let image;
  if (output) {
    const file = `${id}.png`;
    // A deliberately held module keeps document.fonts.ready pending. Capture
    // the actual compositor pixels without changing fonts, CSS or DOM and
    // without turning this cold-load observation into a full-load wait.
    const cdp = await page.context().newCDPSession(page);
    const pixels = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await cdp.detach();
    await writeFile(path.join(output, file), Buffer.from(pixels.data, 'base64'));
    image = {
      file,
      sha256: createHash('sha256')
        .update(await readFile(path.join(output, file)))
        .digest('hex'),
    };
  }
  records.push({
    id,
    revision,
    viewport: page.viewportSize(),
    url: page.url(),
    rendering: await page.evaluate(() => ({
      dpr: devicePixelRatio,
      readyState: document.readyState,
      fonts: document.fonts.status,
    })),
    facts,
    image,
  });
}
async function firstScreen(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.site-page-frame')!;
    const heading = document.querySelector('h1')!;
    const preview = document.querySelector<HTMLElement>('.proto-previewer .host');
    const status = preview?.querySelector<HTMLElement>('.proto-previewer__skeleton');
    return {
      background: getComputedStyle(frame).backgroundColor,
      color: getComputedStyle(frame).color,
      headingFontSize: getComputedStyle(heading).fontSize,
      headingFontFamily: getComputedStyle(heading).fontFamily,
      headingTop: heading.getBoundingClientRect().top,
      previewHeight: preview?.getBoundingClientRect().height ?? null,
      previewText: preview?.innerText.trim() ?? null,
      statusBorder: status ? getComputedStyle(status).borderTopWidth : null,
      statusBackground: status ? getComputedStyle(status).backgroundColor : null,
      bodyWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    };
  });
}
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function homeReady(page: Page) {
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtimeState ===
      'ready',
    undefined,
    { timeout: 45_000 }
  );
}
const menu = (page: Page) =>
  page.locator(
    '.site-header-menu [data-projection-generation-state="active"] [data-demo-ref="home-menu"]'
  );

for (const width of [2048, 390, 430, 320]) {
  describe(`${width}px public website`, () => {
    it('keeps language and social surfaces current through open-menu theme cycles', async () => {
      const context = await browser.newContext({
        viewport: { width, height: width === 2048 ? 1237 : 900 },
        colorScheme: 'light',
        hasTouch: width < 500,
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}/zh-cn/`);
        await homeReady(page);
        if (width < 500) await menu(page).tap();
        else await menu(page).click();
        for (const dark of [true, false, true]) {
          const themeButton = page.locator(
            '.site-header-theme [data-projection-generation-state="active"] [data-demo-ref="home-theme"]'
          );
          if (width < 500) await themeButton.tap();
          else await themeButton.click();
          await page.waitForFunction(
            (dark) => (document.documentElement.dataset.theme === 'dark') === dark,
            dark
          );
          await frames(page);
          const readFacts = () =>
            page.evaluate(() => {
              const header = document.querySelector<HTMLElement>('[data-homepage-runtime]')!;
              const canonical = getComputedStyle(header);
              const language = document.querySelector<HTMLElement>(
                '#home-language [data-projection-generation-state="active"] a'
              )!;
              const surfaces = [
                ...document.querySelectorAll<HTMLElement>(
                  '#home-language [data-projection-generation-state="active"] [data-projection-scope], #home-social [data-projection-generation-state="active"] [data-projection-scope]'
                ),
              ];
              return {
                open: header.dataset.siteMenuOpen,
                theme: document.documentElement.dataset.theme,
                canonical: {
                  background: canonical.getPropertyValue('--pui-background').trim(),
                  foreground: canonical.getPropertyValue('--pui-foreground').trim(),
                },
                language: {
                  text: language?.textContent,
                  width: language?.getBoundingClientRect().width,
                  height: language?.getBoundingClientRect().height,
                },
                surfaces: surfaces.map((element) => ({
                  background: getComputedStyle(element).getPropertyValue('--pui-background').trim(),
                  foreground: getComputedStyle(element).getPropertyValue('--pui-foreground').trim(),
                })),
                overflow: document.documentElement.scrollWidth > innerWidth,
              };
            });
          const immediateFacts = await readFacts();
          await capture(
            page,
            `home-${width}-${dark ? 'dark' : 'light'}-immediate-${records.length}`,
            { ...immediateFacts, phase: 'immediate' }
          );
          await page.waitForFunction(() =>
            [...document.querySelectorAll('[data-site-header], [data-home-showcase]')].every(
              (root) =>
                root
                  .getAnimations({ subtree: true })
                  .every((animation) => animation.playState !== 'running' && !animation.pending)
            )
          );
          const settledFacts = await readFacts();
          await capture(
            page,
            `home-${width}-${dark ? 'dark' : 'light'}-settled-${records.length}`,
            { ...settledFacts, phase: 'settled' }
          );
          if (!baseline)
            for (const facts of [immediateFacts, settledFacts]) {
              expect(facts.open).toBe('true');
              expect(facts.language.text).toContain('English');
              expect(facts.language.width).toBeGreaterThan(20);
              expect(facts.surfaces).toHaveLength(2);
              for (const surface of facts.surfaces) expect(surface).toEqual(facts.canonical);
              expect(facts.overflow).toBe(false);
            }
        }
        await page.keyboard.press('Escape');
        await menu(page).click();
        await page.locator('#home-language [data-projection-generation-state="active"] a').focus();
        expect(
          await page
            .locator('#home-language [data-projection-generation-state="active"] a')
            .evaluate((e) => e === document.activeElement)
        ).toBe(true);
        await capture(page, `home-${width}-reopened-keyboard`, {
          input: 'native Escape, click, keyboard focus',
        });
      } finally {
        await context.close();
      }
    }, 90_000);

    it('fits the complete local Runtime label at ordinary widths', async () => {
      const page = await browser.newPage({
        viewport: { width, height: width === 2048 ? 1237 : 900 },
      });
      try {
        await page.goto(`${baseUrl}/zh-cn/ui-libraries/base/button/`);
        const value = page
          .locator('.proto-previewer [data-adapter-select-root] wc-shadcn-select-value')
          .first();
        await value.waitFor();
        await expect.poll(() => value.textContent()).toContain('Web Components');
        const facts = await value.evaluate((e) => ({
          text: e.textContent,
          height: e.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(getComputedStyle(e).lineHeight),
          width: e.getBoundingClientRect().width,
          scrollWidth: e.scrollWidth,
          viewport: innerWidth,
        }));
        await capture(page, `button-${width}-runtime-label`, facts);
        if (!baseline && width !== 320) {
          expect(facts.height).toBeLessThanOrEqual(facts.lineHeight + 1);
          expect(facts.scrollWidth).toBeLessThanOrEqual(facts.width + 1);
        }
      } finally {
        await page.close();
      }
    }, 90_000);
  });
}

for (const width of [2048, 390, 430]) {
  for (const route of ['/zh-cn/', '/zh-cn/ui-libraries/brutalist/components/card/']) {
    it(`${route} ${width}px has a usable native cold-load disclosure before scripts complete`, async () => {
      const context = await browser.newContext({
        viewport: { width, height: width === 2048 ? 1237 : 900 },
      });
      const page = await context.newPage();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/*', async (request) => {
        if (request.request().resourceType() === 'script') await gate;
        await request.continue().catch(() => {});
      });
      try {
        const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'commit' });
        expect(response?.status()).toBe(200);
        await page.locator('h1').waitFor();
        if (route.includes('/card/'))
          expect(await page.locator('h1').innerText()).toContain('Card');
        await page.waitForFunction(() => {
          const styles = [
            ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
          ].filter((link) => link.media !== 'print');
          return (
            styles.length > 0 &&
            styles.every((link) => link.sheet !== null) &&
            getComputedStyle(document.querySelector('[data-site-header]')!).display === 'grid'
          );
        });
        const initial = await firstScreen(page);
        const settingsVisible = await page.locator('[data-site-header-settings]').isVisible();
        const fallback = page.locator('[data-site-header-fallback-summary]');
        const isNative = (await fallback.count()) === 1;
        await capture(page, `cold-${route.includes('card') ? 'card' : 'home'}-${width}`, {
          scriptsHeld: true,
          initial,
          settingsVisible,
          isNative,
        });
        let focusedHref: string | null = null;
        let nativeFocusRetained: (() => Promise<boolean>) | undefined;
        if (isNative) {
          await fallback.press('Enter');
          expect(await page.locator('[data-site-header-settings]').isVisible()).toBe(true);
          await capture(
            page,
            `cold-native-open-${route.includes('card') ? 'card' : 'home'}-${width}`,
            {
              scriptsHeld: true,
            }
          );
          const link = page.locator('[data-site-header-settings] a[href]').first();
          await link.focus();
          focusedHref = await link.getAttribute('href');
          const nativeNode = await link.elementHandle();
          if (nativeNode)
            nativeFocusRetained = () =>
              nativeNode.evaluate((node) => node.isConnected && node === document.activeElement);
        }
        release();
        await page.waitForLoadState('load');
        await page.waitForSelector('[data-site-menu-ready]', { timeout: 45_000 });
        if (route.includes('/card/'))
          await page
            .locator('.proto-previewer .pui-runtime-preview-surface')
            .first()
            .waitFor({ timeout: 45_000 });
        const loaded = await firstScreen(page);
        await capture(page, `loaded-${route.includes('card') ? 'card' : 'home'}-${width}`, {
          scriptsReleased: true,
          loaded,
        });
        if (!baseline) {
          expect(isNative).toBe(true);
          expect(settingsVisible).toBe(false);
          expect(initial.bodyWidth).toBeLessThanOrEqual(initial.viewportWidth + 1);
          expect(loaded.bodyWidth).toBeLessThanOrEqual(loaded.viewportWidth + 1);
          expect(loaded.background).toBe(initial.background);
          expect(loaded.headingFontSize).toBe(initial.headingFontSize);
          if (route.includes('/card/')) {
            expect(Number.parseFloat(initial.statusBorder ?? '0')).toBeGreaterThan(0);
            expect(initial.previewText).toContain('正文和源码已可阅读');
            expect(loaded.statusBorder).toBeNull();
          }
          expect(await page.locator('[data-site-header]').getAttribute('data-site-menu-open')).toBe(
            'true'
          );
          expect(await page.evaluate(() => document.activeElement?.getAttribute('href'))).toBe(
            focusedHref
          );
          if (route.includes('/card/')) {
            expect(await nativeFocusRetained?.()).toBe(true);
            const locale = page.locator('[data-site-header-settings] .language-select-wrapper');
            expect(await locale.count()).toBe(1);
            const nativeFallback = locale.locator('[data-site-select-fallback]');
            const realSelect = locale.locator('[data-site-select-root]');
            expect(await nativeFallback.isVisible()).toBe(true);
            expect(await realSelect.isVisible()).toBe(false);
            expect(await locale.getByRole('combobox').count()).toBe(0);
            if (width === 2048) {
              await page.keyboard.press('Enter');
              await page.waitForURL(`${baseUrl}${focusedHref}`);
              expect(new URL(page.url()).pathname).toBe(focusedHref);
            } else {
              await page.keyboard.press(width === 390 ? 'Tab' : 'Shift+Tab');
              await expect.poll(() => realSelect.isVisible()).toBe(true);
              expect(await nativeFallback.isVisible()).toBe(false);
              expect(await locale.getByRole('combobox').count()).toBe(1);
              expect(await page.evaluate(() => document.activeElement === document.body)).toBe(
                false
              );
            }
          }
        }
      } finally {
        release();
        await context.close();
      }
    }, 90_000);
  }
}

for (const width of [2048, 390]) {
  for (const route of ['/zh-cn/', '/en/ui-libraries/shadcn/dialog/']) {
    for (const runtime of route === '/zh-cn/' && width === 390 ? ['wc', 'react'] : ['wc']) {
      it(`${route} ${runtime} ${width}px records actual DialogMask paint and preference fallbacks`, async () => {
        const context = await browser.newContext({
          viewport: { width, height: width === 2048 ? 1237 : 900 },
          colorScheme: 'light',
        });
        await context.addInitScript(
          (runtime) => localStorage.setItem('preferred-prototypes-adapter', runtime),
          runtime
        );
        const page = await context.newPage();
        try {
          await page.goto(`${baseUrl}${route}`);
          if (route === '/zh-cn/') {
            await homeReady(page);
            expect(await page.locator('[data-homepage-runtime]').getAttribute('data-runtime')).toBe(
              runtime
            );
          }
          const trigger = page
            .locator(
              route === '/zh-cn/'
                ? '[data-home-showcase] [aria-haspopup="dialog"]'
                : '[data-previewer-id] [aria-haspopup="dialog"]'
            )
            .first();
          await trigger.waitFor();
          await trigger.click();
          if (runtime === 'react') {
            await page.getByRole('dialog').waitFor({ state: 'visible' });
            await page.evaluate(async () => {
              await Promise.all(
                document.getAnimations().map((animation) => animation.finished.catch(() => {}))
              );
            });
            await capture(
              page,
              `dialog-home-${width}-react-open-diagnostic`,
              await page.evaluate(() =>
                [...document.querySelectorAll<HTMLElement>('[data-pui-style~=fixed]')].map(
                  (element) => ({
                    tokens: element.getAttribute('data-pui-style'),
                    transition: element.getAttribute('data-transition-state'),
                    background: getComputedStyle(element).backgroundColor,
                    backdrop: getComputedStyle(element).backdropFilter,
                    opacity: getComputedStyle(element).opacity,
                    rect: element.getBoundingClientRect().toJSON(),
                  })
                )
              )
            );
          }
          const mask = page.locator('[data-pui-style~="backdrop-blur-xs"]').last();
          await mask.waitFor({ state: 'visible' });
          await page.waitForFunction(() => {
            const mask = document.querySelector('[data-pui-style~="backdrop-blur-xs"]');
            return mask?.getAttribute('data-transition-state') === 'entered';
          });
          const maskHandle = await mask.elementHandle();
          if (!maskHandle) throw new Error('Visible DialogMask handle is missing');
          const read = () =>
            maskHandle.evaluate((element) => ({
              backdropFilter: getComputedStyle(element).backdropFilter,
              background: getComputedStyle(element).backgroundColor,
              backgroundAlpha: (() => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = getComputedStyle(element).backgroundColor;
                ctx.fillRect(0, 0, 1, 1);
                return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
              })(),
              connected: element.isConnected,
              opacity: getComputedStyle(element).opacity,
              rect: element.getBoundingClientRect().toJSON(),
              reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
              forcedColors: matchMedia('(forced-colors: active)').matches,
            }));
          const settleMask = async () => {
            await maskHandle.evaluate(async (element) => {
              await Promise.all(
                element.getAnimations().map((animation) => animation.finished.catch(() => {}))
              );
            });
            await frames(page);
          };
          await settleMask();
          const normal = await read();
          await capture(
            page,
            `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}${runtime === 'wc' ? '' : '-react'}-normal`,
            normal
          );
          if (!baseline) {
            expect(normal.reducedTransparency).toBe(false);
            expect(normal.forcedColors).toBe(false);
            expect(normal.backdropFilter).toBe('blur(4px)');
            expect(normal.backgroundAlpha).toBeCloseTo(0.5, 2);
            expect(Number(normal.opacity)).toBe(1);
          }
          const cdp = await context.newCDPSession(page);
          const retainedFocus = await page.evaluateHandle(() => document.activeElement);
          const setMaterialMedia = async (
            reducedTransparency: 'reduce' | 'no-preference',
            forcedColors: 'active' | 'none'
          ) => {
            await cdp.send('Emulation.setEmulatedMedia', {
              features: [
                { name: 'prefers-color-scheme', value: 'light' },
                { name: 'prefers-reduced-transparency', value: reducedTransparency },
                { name: 'forced-colors', value: forcedColors },
              ],
            });
            await settleMask();
            if (!baseline)
              expect(await retainedFocus.evaluate((node) => node === document.activeElement)).toBe(
                true
              );
          };
          await setMaterialMedia('reduce', 'none');
          const reduced = await read();
          await capture(
            page,
            `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}${runtime === 'wc' ? '' : '-react'}-reduced-transparency`,
            reduced
          );
          if (!baseline) {
            expect(reduced.reducedTransparency).toBe(true);
            expect(reduced.forcedColors).toBe(false);
            expect(reduced.backdropFilter).toBe('none');
            expect(reduced.backgroundAlpha).toBe(1);
            expect(reduced.connected).toBe(true);
          }
          await setMaterialMedia('no-preference', 'active');
          const forced = await read();
          await capture(
            page,
            `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}${runtime === 'wc' ? '' : '-react'}-forced-colors`,
            forced
          );
          if (!baseline) {
            expect(forced.reducedTransparency).toBe(false);
            expect(forced.forcedColors).toBe(true);
            expect(forced.backdropFilter).toBe('none');
            expect(forced.backgroundAlpha).toBe(1);
            expect(forced.connected).toBe(true);
          }
          await setMaterialMedia('reduce', 'active');
          const combined = await read();
          await capture(
            page,
            `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}${runtime === 'wc' ? '' : '-react'}-combined-preferences`,
            combined
          );
          if (!baseline) {
            expect(combined.reducedTransparency).toBe(true);
            expect(combined.forcedColors).toBe(true);
            expect(combined.backdropFilter).toBe('none');
            expect(combined.backgroundAlpha).toBe(1);
            expect(combined.connected).toBe(true);
          }
          await setMaterialMedia('no-preference', 'none');
          const restored = await read();
          await capture(
            page,
            `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}${runtime === 'wc' ? '' : '-react'}-restored`,
            restored
          );
          if (!baseline) {
            expect(restored.reducedTransparency).toBe(false);
            expect(restored.forcedColors).toBe(false);
            expect(restored.backdropFilter).toBe('blur(4px)');
            expect(restored.backgroundAlpha).toBeCloseTo(0.5, 2);
            expect(Number(restored.opacity)).toBe(1);
            expect(restored.connected).toBe(true);
          }
          await page.keyboard.press('Escape');
        } finally {
          await context.close();
        }
      }, 90_000);
    }
  }
}

for (const route of ['/zh-cn/', '/zh-cn/ui-libraries/brutalist/components/card/']) {
  it(`${route} keeps native navigation and truthful preview text with JavaScript disabled`, async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${route}`);
      const fallback = page.locator('[data-site-header-fallback-summary]');
      const isNative = (await fallback.count()) === 1;
      const settingsVisibleInitially = await page
        .locator('[data-site-header-settings]')
        .isVisible();
      await capture(page, `noscript-${route.includes('card') ? 'card' : 'home'}-390-closed`, {
        javaScriptEnabled: false,
        settingsVisibleInitially,
      });
      if (isNative) await fallback.click();
      await capture(page, `noscript-${route.includes('card') ? 'card' : 'home'}-390`, {
        javaScriptEnabled: false,
        nativeDisclosure: isNative,
      });
      if (!baseline) {
        expect(isNative).toBe(true);
        expect(await page.locator('[data-site-header-settings] a[href]').first().isVisible()).toBe(
          true
        );
        if (route.includes('card')) {
          expect(await page.locator('.proto-previewer__skeleton').first().isVisible()).toBe(false);
          expect(await page.locator('.proto-previewer').first().innerText()).toContain(
            'JavaScript'
          );
        }
      }
    } finally {
      await context.close();
    }
  }, 60_000);
}

for (const route of ['/zh-cn/', '/zh-cn/ui-libraries/brutalist/components/card/']) {
  it(`${route} retains readable native navigation after all external scripts fail`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    await page.route('**/*', (request) =>
      request.request().resourceType() === 'script' ? request.abort('failed') : request.continue()
    );
    try {
      const response = await page.goto(`${baseUrl}${route}`);
      expect(response?.status()).toBe(200);
      await page.locator('h1').waitFor();
      const initial = await firstScreen(page);
      const settingsVisible = await page.locator('[data-site-header-settings]').isVisible();
      await capture(page, `failed-scripts-${route.includes('card') ? 'card' : 'home'}-390`, {
        externalScriptsAborted: true,
        initial,
        settingsVisible,
      });
      const summary = page.locator('[data-site-header-fallback-summary]');
      if (await summary.count()) {
        await summary.click();
        await capture(page, `failed-scripts-open-${route.includes('card') ? 'card' : 'home'}-390`, {
          externalScriptsAborted: true,
        });
      }
      if (!baseline) {
        expect(settingsVisible).toBe(false);
        expect(await summary.count()).toBe(1);
        expect(await page.locator('[data-site-header-settings] a[href]').first().isVisible()).toBe(
          true
        );
        expect(initial.bodyWidth).toBeLessThanOrEqual(390);
      }
    } finally {
      await context.close();
    }
  }, 60_000);
}

for (const width of [2048, 390]) {
  for (const outcome of ['publish', 'failure'] as const) {
    it(`retains legacy preview status during a delayed module (${width}, ${outcome})`, async () => {
      const page = await browser.newPage({
        viewport: { width, height: width === 2048 ? 1237 : 900 },
      });
      let release!: () => void;
      let intercepted = false;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/demo-base-button.demo.*.js', async (route) => {
        intercepted = true;
        await gate;
        if (outcome === 'failure') await route.abort('failed');
        else await route.continue();
      });
      try {
        const response = await page.goto(`${baseUrl}/zh-cn/ui-libraries/base/button/`, {
          waitUntil: 'domcontentloaded',
        });
        expect(response?.status()).toBe(200);
        await expect.poll(() => intercepted).toBe(true);
        const preview = page.locator('.proto-previewer[data-demo-id="demo-base-button"]');
        await expect.poll(() => preview.getAttribute('data-inited')).toBe('1');
        const pending = await preview.evaluate((root) => {
          const status = root.querySelector<HTMLElement>('[role="status"]');
          const host = root.querySelector<HTMLElement>('.host')!;
          return {
            statusConnected: Boolean(status?.isConnected),
            statusText: status?.textContent,
            statusRect: status?.getBoundingClientRect().toJSON(),
            hostInert: host.inert,
            hostVisibility: getComputedStyle(host).visibility,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        await capture(page, `legacy-${width}-${outcome}-module-held`, pending);
        if (!baseline) {
          expect(pending.statusConnected).toBe(true);
          expect(pending.statusText).toContain('正在加载交互示例');
          expect(pending.statusRect!.height).toBeGreaterThan(100);
          expect(pending.hostInert).toBe(true);
          expect(pending.hostVisibility).toBe('hidden');
          expect(pending.overflow).toBe(false);
        }
        release();
        if (outcome === 'failure')
          await expect.poll(() => preview.textContent()).toContain('[Preview Error]');
        else
          await page.waitForFunction(
            () =>
              (
                document.querySelector(
                  '.proto-previewer[data-demo-id="demo-base-button"]'
                ) as HTMLElement & { __previewer__?: { getCurrentRuntime(): string } }
              )?.__previewer__?.getCurrentRuntime() === 'wc'
          );
        const settled = await preview.evaluate((root) => {
          const host = root.querySelector<HTMLElement>('.host')!;
          return {
            statusCount: root.querySelectorAll('[role="status"]').length,
            hostInert: host.inert,
            hostVisibility: getComputedStyle(host).visibility,
            text: host.textContent,
          };
        });
        await capture(page, `legacy-${width}-${outcome}-settled`, settled);
        if (!baseline) {
          expect(settled.statusCount).toBe(0);
          expect(settled.hostInert).toBe(false);
          expect(settled.hostVisibility).toBe('visible');
        }
      } finally {
        release();
        await page.close();
      }
    }, 60_000);
  }
}
