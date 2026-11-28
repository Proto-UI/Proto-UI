// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, runtimeSelectTrigger, startServer, stopServer } from './browser-harness';

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const baseline = process.env.PROTO_UI_STARTUP_SUBJECT === 'baseline';
const historicalBaselineRevision = '48b80f8b8b0b94dbac04919e3516bc6a1ed2c37c';
const historicalNewYork = baseline && revision === historicalBaselineRevision;
const historicalLocaleSelector =
  '#home-language [data-projection-generation-state="active"] a[data-home-locale][href][hreflang]';
const localeApiKind = baseline
  ? historicalNewYork
    ? 'historical-native-locale-link'
    : 'unreviewed-historical-api'
  : 'current-locale-select';
// The historical 48b80 production subject enhances a native locale link.
// Current candidates must still expose the public Select combobox.
const languageControlSelector = baseline
  ? '#home-language [data-projection-generation-state="active"] a[data-home-locale][href]'
  : '#home-language [data-projection-generation-state="active"] [role="combobox"]';
const output = process.env.PROTO_UI_STARTUP_EVIDENCE_DIR;
const records: unknown[] = [];
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  if (baseline && !historicalNewYork)
    throw new Error(
      `Unreviewed historical startup API: ${revision}. Only ${historicalBaselineRevision} has an exact source-reviewed baseline mapping.`
    );
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
      JSON.stringify(
        { revision, baseline, localeApiKind, browser: browser?.version(), records },
        null,
        2
      )
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
    const textRuns: Array<{
      text: string;
      fontSize: string;
      fontFamily: string;
      fontWeight: string;
      lineHeight: string;
      rects: Array<{ x: number; y: number; width: number; height: number }>;
    }> = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || !node.parentElement) continue;
      const style = getComputedStyle(node.parentElement);
      const range = document.createRange();
      range.selectNodeContents(node);
      textRuns.push({
        text: node.textContent,
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        rects: [...range.getClientRects()].map(({ x, y, width, height }) => ({
          x,
          y,
          width,
          height,
        })),
      });
    }
    const preview = document.querySelector<HTMLElement>('.proto-previewer .host');
    const status = preview?.querySelector<HTMLElement>('.proto-previewer__skeleton');
    const geometry = (element: Element | null) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        tag: element.localName,
        ref: element.getAttribute('data-demo-ref'),
        prototype: element.getAttribute('data-projection-prototype'),
        tokens: element.getAttribute('data-pui-style'),
        bounds: element.getBoundingClientRect().toJSON(),
        display: style.display,
        visibility: style.visibility,
        hiddenAncestor: !!element.closest('[hidden]'),
        boxSizing: style.boxSizing,
        minHeight: style.minHeight,
        padding: style.padding,
        margin: style.margin,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        alignItems: style.alignItems,
        verticalAlign: style.verticalAlign,
      };
    };
    const eyebrow = document.querySelector('.homepage-hero__eyebrow');
    const announcementAnchors = [...(eyebrow?.querySelectorAll('a') ?? [])];
    const visibleAnnouncementAnchors = announcementAnchors.filter((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility === 'visible'
      );
    });
    const announcement =
      visibleAnnouncementAnchors.find(
        (element) =>
          element.matches('.home-runtime-link') &&
          element.closest('[data-projection-generation-state="active"]')
      ) ??
      visibleAnnouncementAnchors.find((element) =>
        element.closest('[data-homepage-fallback]:not([hidden])')
      ) ??
      null;
    return {
      background: getComputedStyle(frame).backgroundColor,
      color: getComputedStyle(frame).color,
      // Preserve owner metrics separately: the enhanced public Text paints
      // its own leaf typography, while the semantic h1 inherits its context.
      headingFontSize: getComputedStyle(heading).fontSize,
      headingTextRuns: textRuns,
      headerHeight: document.querySelector('[data-site-header]')!.getBoundingClientRect().height,
      headingFontFamily: getComputedStyle(heading).fontFamily,
      headingTop: heading.getBoundingClientRect().top,
      // Observe the real cold/enhanced boxes without replacing the original
      // text-range assertion. These explain an upstream announcement-height
      // change separately from the heading's own typography.
      startupGeometry: {
        eyebrow: geometry(eyebrow),
        announcement: geometry(announcement),
        announcementAnchors: announcementAnchors.map(geometry),
        announcementSurfaces: [
          ...(announcement?.querySelectorAll('[data-demo-ref^="home-link-surface-"]') ?? []),
        ].map(geometry),
        announcementText: [
          ...(announcement?.querySelectorAll('[data-demo-ref^="home-link-text-"]') ?? []),
        ].map(geometry),
        heading: geometry(heading),
        headingText: [
          ...heading.querySelectorAll('[data-site-typography-carrier] [data-demo-ref^="surface-"]'),
        ].map(geometry),
        scroll: { x: scrollX, y: scrollY },
      },
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
            page.evaluate(
              ({ selector, apiKind }) => {
                const header = document.querySelector<HTMLElement>('[data-homepage-runtime]')!;
                const canonical = getComputedStyle(header);
                const languages = [...document.querySelectorAll<HTMLElement>(selector)];
                const language = languages[0] ?? null;
                const languageStyle = language ? getComputedStyle(language) : null;
                const generation = language?.closest('[data-projection-generation-state="active"]');
                const identity = (element: Element | null | undefined) =>
                  element
                    ? {
                        tag: element.localName,
                        ref: element.getAttribute('data-demo-ref'),
                        prototype: element.getAttribute('data-projection-prototype'),
                        coordinates: Object.fromEntries(
                          ['owner', 'family', 'runtime', 'generation'].map((name) => [
                            name,
                            element.getAttribute(`data-projection-${name}`),
                          ])
                        ),
                      }
                    : null;
                const surfaces = [
                  ...document.querySelectorAll<HTMLElement>(
                    '#home-language [data-projection-generation-state="active"] [data-projection-scope], #home-social [data-projection-generation-state="active"] [data-projection-scope]'
                  ),
                ];
                return {
                  apiKind,
                  open: header.dataset.siteMenuOpen,
                  theme: document.documentElement.dataset.theme,
                  canonical: {
                    background: canonical.getPropertyValue('--pui-background').trim(),
                    foreground: canonical.getPropertyValue('--pui-foreground').trim(),
                  },
                  language: {
                    count: languages.length,
                    text: language?.textContent,
                    width: language?.getBoundingClientRect().width,
                    height: language?.getBoundingClientRect().height,
                    href: language?.getAttribute('href'),
                    hreflang: language?.getAttribute('hreflang'),
                    locale: language?.getAttribute('data-home-locale'),
                    owner: identity(language),
                    generation: identity(generation),
                    group: language?.closest('[data-homepage-actions]')?.id,
                    paint: languageStyle
                      ? {
                          background: languageStyle.backgroundColor,
                          color: languageStyle.color,
                          display: languageStyle.display,
                          visibility: languageStyle.visibility,
                        }
                      : null,
                  },
                  surfaces: surfaces.map((element) => ({
                    background: getComputedStyle(element)
                      .getPropertyValue('--pui-background')
                      .trim(),
                    foreground: getComputedStyle(element)
                      .getPropertyValue('--pui-foreground')
                      .trim(),
                  })),
                  overflow: document.documentElement.scrollWidth > innerWidth,
                };
              },
              {
                selector: historicalNewYork ? historicalLocaleSelector : languageControlSelector,
                apiKind: localeApiKind,
              }
            );
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
              expect(facts.language.text?.trim()).toBe('简体中文');
              expect(facts.language.width).toBeGreaterThan(20);
              expect(facts.surfaces).toHaveLength(2);
              for (const surface of facts.surfaces) expect(surface).toEqual(facts.canonical);
              expect(facts.overflow).toBe(false);
            }
          if (historicalNewYork)
            for (const facts of [immediateFacts, settledFacts]) {
              // Observe this subject's real owner and paint, including any old
              // theme defects. It exposes the other locale as a native link.
              expect(facts.apiKind).toBe('historical-native-locale-link');
              expect(facts.language.count).toBe(1);
              expect(facts.language.owner?.tag).toBe('a');
              expect(facts.language.text?.trim()).toBe('English');
              expect(facts.language.href).toBe('/en/');
              expect(facts.language.hreflang).toBe('en');
              expect(facts.language.locale).toBe('en');
              expect(facts.language.width).toBeGreaterThan(0);
              expect(facts.language.height).toBeGreaterThan(0);
              expect(facts.language.paint?.visibility).toBe('visible');
            }
        }
        await page.keyboard.press('Escape');
        await menu(page).click();
        if (historicalNewYork) {
          // Probe 3148794 recorded four failed current-Select focus lookups on
          // this exact subject. Those API-mismatch failures remain historical
          // evidence; this branch measures its actual native-link API instead.
          const locale = page.locator(historicalLocaleSelector);
          expect(await locale.count()).toBe(1);
          await locale.waitFor({ state: 'visible' });
          expect(await locale.isVisible()).toBe(true);
          expect(
            await page
              .locator('#home-language [data-projection-generation-state="active"]')
              .getByRole('link', { name: 'English', exact: true })
              .count()
          ).toBe(1);
          expect((await locale.textContent())?.trim()).toBe('English');
          expect(await locale.getAttribute('href')).toBe('/en/');
          expect(await locale.getAttribute('hreflang')).toBe('en');
          expect(await locale.getAttribute('data-home-locale')).toBe('en');
          await locale.focus();
          expect(await locale.evaluate((element) => element === document.activeElement)).toBe(true);
          await capture(page, `home-${width}-reopened-keyboard`, {
            input: 'native Escape, click, keyboard focus',
            apiKind: localeApiKind,
            measurementDisposition: 'captured-historical-owner',
            accessibility: await locale.ariaSnapshot(),
          });
          await locale.press('Enter');
          await page.waitForURL((url) => url.pathname === '/en/');
          await homeReady(page);
          await capture(page, `home-${width}-locale-native-navigation`, {
            input: 'native link Enter',
            apiKind: localeApiKind,
            measurementDisposition: 'captured-historical-navigation',
            route: new URL(page.url()).pathname,
          });
        } else {
          const languageControl = page.locator(languageControlSelector);
          await languageControl.focus();
          expect(await languageControl.evaluate((e) => e === document.activeElement)).toBe(true);
          await capture(page, `home-${width}-reopened-keyboard`, {
            input: 'native Escape, click, keyboard focus',
          });
        }
        if (!baseline) {
          // The menu above remains on zh-cn; English is an option, not its
          // current value. Exercise the real Select before expecting English.
          const locale = page.locator(
            '#home-language [data-projection-generation-state="active"] [role="combobox"]'
          );
          await locale.press('Enter');
          await expect.poll(() => locale.getAttribute('aria-expanded')).toBe('true');
          const popupId = await locale.getAttribute('aria-controls');
          expect(popupId).toBeTruthy();
          const popup = page.locator(`[id=${JSON.stringify(popupId)}]`);
          expect(await popup.count()).toBe(1);
          await popup.waitFor({ state: 'visible' });
          // A painted option can precede the Select's native entry focus.
          // Require the selected option in this controlled popup before Home
          // so the next key belongs to the option list, not the Trigger.
          await expect
            .poll(
              () =>
                popup.evaluate(
                  (element) =>
                    element.contains(document.activeElement) &&
                    document.activeElement?.getAttribute('role') === 'option' &&
                    document.activeElement.getAttribute('aria-selected') === 'true'
                ),
              { timeout: 1000 }
            )
            .toBe(true);
          const english = popup.getByRole('option', { name: 'English', exact: true });
          expect(await english.count()).toBe(1);
          await page.keyboard.press('Home');
          await expect
            .poll(() => english.evaluate((element) => element === document.activeElement), {
              timeout: 1000,
            })
            .toBe(true);
          await page.keyboard.press('Enter');
          await page.waitForURL((url) => url.pathname === '/en/');
          await homeReady(page);
          await menu(page).click();
          const changed = page.locator(
            '#home-language [data-projection-generation-state="active"] [role="combobox"]'
          );
          await expect.poll(() => changed.textContent()).toBe('English');
          expect(await changed.ariaSnapshot()).toBe('- combobox "Language": English');
          await capture(page, `home-${width}-locale-native-selection`, {
            input: 'native Enter, Home, Enter',
            route: new URL(page.url()).pathname,
            accessibility: await changed.ariaSnapshot(),
          });
        }
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
        const value = runtimeSelectTrigger(page.locator('.proto-previewer').first());
        await value.waitFor();
        await expect.poll(() => value.textContent()).toContain('Web Components');
        const facts = await value.evaluate((e) => {
          const label = e.ownerDocument.createRange();
          label.selectNodeContents(e);
          const height = label.getBoundingClientRect().height;
          const control = e.getBoundingClientRect();
          const walker = e.ownerDocument.createTreeWalker(e, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              const parent = node.parentElement;
              if (
                parent?.closest('[data-pui-owned-decoration], [aria-hidden="true"]') ||
                !node.nodeValue?.trim()
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            },
          });
          const fragments: DOMRect[] = [];
          let allTextHasRects = true;
          while (walker.nextNode()) {
            const node = walker.currentNode;
            label.selectNodeContents(node);
            const rects = Array.from(label.getClientRects()).filter(
              (rect) => rect.width > 0 && rect.height > 0
            );
            if (rects.length === 0) allTextHasRects = false;
            fragments.push(...rects);
          }
          // The whole range includes the tab's nested boxes and owned decorations.
          // Only visible text fragments establish the label's line height and
          // whether its ends fit the control.
          return {
            measurement: 'rendered-label-range',
            text: e.textContent,
            height,
            textHeight: fragments.length
              ? Math.max(...fragments.map((r) => r.bottom)) -
                Math.min(...fragments.map((r) => r.top))
              : 0,
            allTextHasRects,
            fitsInline: fragments.every(
              (r) => r.left >= control.left - 1 && r.right <= control.right + 1
            ),
            controlHeight: control.height,
            lineHeight: Number.parseFloat(getComputedStyle(e).lineHeight),
            width: control.width,
            scrollWidth: e.scrollWidth,
            viewport: innerWidth,
          };
        });
        await capture(page, `button-${width}-runtime-label`, facts);
        expect(facts.height).toBeGreaterThan(0);
        if (!baseline && width !== 320) {
          expect(facts.allTextHasRects).toBe(true);
          expect(facts.textHeight).toBeGreaterThan(0);
          expect(facts.textHeight).toBeLessThanOrEqual(facts.lineHeight + 1);
          expect(facts.fitsInline).toBe(true);
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
        const startupSearchFeedback = !baseline
          ? await page
              .locator('[data-search-startup-button]')
              .evaluate((element) => getComputedStyle(element).transitionProperty)
          : null;
        if (!baseline) {
          const properties = startupSearchFeedback!.split(',').map((value) => value.trim());
          expect(properties).toContain('background-color');
          expect(properties).not.toContain('all');
          expect(properties).not.toContain('width');
          expect(properties).not.toContain('padding-inline');
        }
        const settingsVisible = await page.locator('[data-site-header-settings]').isVisible();
        const fallback = page.locator('[data-site-header-fallback-summary]');
        const isNative = (await fallback.count()) === 1;
        await capture(page, `cold-${route.includes('card') ? 'card' : 'home'}-${width}`, {
          scriptsHeld: true,
          initial,
          startupSearchFeedback,
          settingsVisible,
          isNative,
        });
        let focusedHref: string | null = null;
        let nativeFocusRetained: (() => Promise<boolean>) | undefined;
        if (isNative) {
          expect(await fallback.isVisible()).toBe(true);
          await fallback.press('Enter');
          expect(await page.locator('[data-site-header-settings]').isVisible()).toBe(true);
          const preferences = page.locator('[data-site-header-preferences]');
          expect(await preferences.count()).toBe(1);
          expect(await preferences.isVisible()).toBe(true);
          await capture(
            page,
            `cold-native-open-${route.includes('card') ? 'card' : 'home'}-${width}`,
            {
              scriptsHeld: true,
            }
          );
          // Docs exercise the actual native Select (not today's first social
          // link); the homepage keeps the independent community-anchor journey.
          const nativeControl = route.includes('/card/')
            ? page.locator('[data-site-header-settings] [data-language-native-select]')
            : page.locator('[data-site-header-settings] a[href]').first();
          await nativeControl.focus();
          focusedHref = await nativeControl.getAttribute('href');
          const nativeNode = await nativeControl.elementHandle();
          if (nativeNode)
            nativeFocusRetained = () =>
              nativeNode.evaluate((node) => node.isConnected && node === document.activeElement);
        }
        release();
        await page.waitForLoadState('load');
        await page.waitForSelector('[data-site-menu-ready]', { timeout: 45_000 });
        if (route.includes('/card/')) {
          if (baseline) {
            await page
              .locator('.proto-previewer .pui-runtime-preview-surface')
              .first()
              .waitFor({ timeout: 45_000 });
          } else {
            const previewer = page.locator('.proto-previewer').first();
            // A connected staging surface is intentionally laid out before
            // publish. The public ready marker owns skeleton retirement.
            await expect
              .poll(() => previewer.getAttribute('data-projection-state'), {
                timeout: 45_000,
              })
              .toBe('ready');
            const surface = previewer.locator(
              '[data-projection-generation-state="active"] .pui-runtime-preview-surface'
            );
            expect(await surface.count()).toBe(1);
            expect(await surface.isVisible()).toBe(true);
          }
        }
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
          expect(loaded.headerHeight).toBeCloseTo(initial.headerHeight, 0);
          expect(loaded.headingTextRuns.length).toBeGreaterThan(0);
          expect(loaded.headingTextRuns).toHaveLength(initial.headingTextRuns.length);
          for (const [index, run] of loaded.headingTextRuns.entries()) {
            const before = initial.headingTextRuns[index]!;
            expect({ ...run, rects: undefined }).toEqual({ ...before, rects: undefined });
            expect(run.rects).toHaveLength(before.rects.length);
            for (const [rectIndex, rect] of run.rects.entries()) {
              const original = before.rects[rectIndex]!;
              for (const key of ['x', 'y', 'width', 'height'] as const)
                expect(Math.abs(rect[key] - original[key])).toBeLessThanOrEqual(1);
            }
          }
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
            expect(await locale.getByRole('combobox').count()).toBe(1);
            expect(await nativeFallback.locator('select').inputValue()).toBe('zh-cn');
            if (width === 2048) {
              const select = nativeFallback.locator('select');
              const paths = JSON.parse((await select.getAttribute('data-locale-paths'))!);
              expect(await select.locator('option').first().getAttribute('value')).toBe('en');
              await page.keyboard.press('Home');
              await page.waitForURL(`${baseUrl}${paths.en}`);
              expect(new URL(page.url()).pathname).toBe(paths.en);
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
          } else if (!baseline) {
            const previewer = page.locator('.proto-previewer[data-demo-id="demo-shadcn-dialog"]');
            await expect
              .poll(() => previewer.getAttribute('data-projection-state'), {
                timeout: 45_000,
              })
              .toBe('ready');
          }
          if (route === '/zh-cn/' && width === 390 && !baseline) {
            const entry = page.locator(
              '[data-homepage-mount] [data-projection-generation-state="active"] ' +
                'a[href="#home-demo-previewer"]'
            );
            expect(await entry.count()).toBe(1);
            await entry.focus();
            expect(await entry.evaluate((node) => node === document.activeElement)).toBe(true);
            await page.keyboard.press('Enter');
            await expect.poll(() => new URL(page.url()).hash).toBe('#home-demo-previewer');
            await expect
              .poll(() =>
                page.locator('[data-home-showcase]').evaluate((node) => (node as HTMLElement).inert)
              )
              .toBe(false);
          }
          // The current docs page hydrates six examples independently. Read and
          // activate the Trigger in its primary Preview throughout the journey.
          const trigger =
            route === '/zh-cn/'
              ? page.locator('[data-home-showcase] [aria-haspopup="dialog"]').first()
              : baseline
                ? page.locator('[data-previewer-id] [aria-haspopup="dialog"]').first()
                : page.locator(
                    '[data-demo-id="demo-shadcn-dialog"] [data-projection-generation-state="active"] [aria-haspopup="dialog"]'
                  );
          await trigger.waitFor();
          const contentId = await trigger.getAttribute('aria-controls');
          if (!contentId) throw new Error('The actual Dialog Trigger has no Content identity');
          const originalTrigger = await trigger.elementHandle();
          const content = page.locator(`[role="dialog"][id=${JSON.stringify(contentId)}]`);
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
          await content.waitFor({ state: 'visible' });
          await expect
            .poll(() => content.getAttribute('data-transition-state'), { timeout: 30_000 })
            .toBe('entered');
          expect(await content.count()).toBe(1);
          expect(await content.getAttribute('aria-modal')).toBe('true');
          const expanded = await trigger.getAttribute('aria-expanded');
          if (expanded !== 'true') {
            await capture(
              page,
              `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}-${runtime}-expanded-failure`,
              await page.evaluate(
                ({ originalTrigger, contentId }) => {
                  const read = (element: Element | null) =>
                    element
                      ? {
                          tag: element.localName,
                          connected: element.isConnected,
                          id: element.id,
                          controls: element.getAttribute('aria-controls'),
                          expanded: element.getAttribute('aria-expanded'),
                          transition: element.getAttribute('data-transition-state'),
                          generationState:
                            element
                              .closest('[data-projection-generation-state]')
                              ?.getAttribute('data-projection-generation-state') ?? null,
                          previewerState:
                            element
                              .closest('[data-previewer-id]')
                              ?.getAttribute('data-projection-state') ?? null,
                          coordinates: Object.fromEntries(
                            ['owner', 'family', 'runtime', 'generation'].map((key) => [
                              key,
                              element.getAttribute(`data-projection-${key}`),
                            ])
                          ),
                          bounds: element.getBoundingClientRect().toJSON(),
                          inertAncestor: !!element.closest('[inert]'),
                          hiddenAncestor: !!element.closest('[hidden], [aria-hidden="true"]'),
                        }
                      : null;
                  return {
                    expectedContentId: contentId,
                    originalTrigger: read(originalTrigger),
                    triggers: [...document.querySelectorAll('[aria-haspopup="dialog"]')].map(read),
                    content: [...document.querySelectorAll('[role="dialog"]')].map(read),
                    focused: read(document.activeElement),
                  };
                },
                { originalTrigger, contentId }
              )
            );
          }
          expect(expanded).toBe('true');
          const contentHandle = await content.elementHandle();
          if (!contentHandle) throw new Error('The opened Dialog Content handle is missing');
          const coordinates = await content.evaluate((element) =>
            Object.fromEntries(
              ['owner', 'family', 'runtime', 'generation'].map((name) => [
                name,
                element.getAttribute(`data-projection-${name}`),
              ])
            )
          );
          if (!baseline) {
            expect(Object.values(coordinates).every(Boolean)).toBe(true);
            expect(coordinates.family).toBe('shadcn');
            expect(coordinates.runtime).toBe(runtime);
            expect(await content.getAttribute('data-projection-prototype')).toBe(
              'shadcn-dialog-content'
            );
          }
          // The unchanged current homepage and docs recipes explicitly consume
          // Rhea. P-SHADCN-STYLE-SCOPE preserves this choice ahead of the separate
          // New York compatibility default. The pinned Rhea source uses black/30
          // and an 8px blur; C-RULE-STYLE-SUPPORT-0001 only admits a 4px fact, so
          // the current bounded Rhea projection has no blur. This journey does
          // not claim the unimplemented 8px source material or full Rhea parity.
          // The exact historical subject keeps its old New York observation.
          const materialProfile = baseline
            ? historicalNewYork
              ? 'historical-new-york-v4'
              : 'historical-subject'
            : 'public-rhea-8px-blur-unimplemented';
          const mask = baseline
            ? page.locator('[data-pui-style~="backdrop-blur-xs"]').last()
            : page.locator(
                '[data-projection-prototype="shadcn-dialog-mask"]' +
                  Object.entries(coordinates)
                    .map(([name, value]) => `[data-projection-${name}=${JSON.stringify(value)}]`)
                    .join('')
              );
          if (!baseline) await expect.poll(() => mask.count(), { timeout: 30_000 }).toBe(1);
          await mask.waitFor({ state: 'visible' });
          await expect
            .poll(() => mask.getAttribute('data-transition-state'), { timeout: 30_000 })
            .toBe('entered');
          const maskHandle = await mask.elementHandle();
          if (!maskHandle) throw new Error('Visible DialogMask handle is missing');
          let maskSettlement: unknown = null;
          const read = async () => ({
            materialProfile,
            settlement: maskSettlement,
            ...(await maskHandle.evaluate((element) => ({
              prototype: element.getAttribute('data-projection-prototype'),
              coordinates: Object.fromEntries(
                ['owner', 'family', 'runtime', 'generation'].map((name) => [
                  name,
                  element.getAttribute(`data-projection-${name}`),
                ])
              ),
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
              position: getComputedStyle(element).position,
              rect: element.getBoundingClientRect().toJSON(),
              viewport: { width: innerWidth, height: innerHeight },
              ownsOutsidePoint: (() => {
                const hit = document.elementFromPoint(5, 5);
                return hit === element || (!!hit && element.contains(hit));
              })(),
              reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
              forcedColors: matchMedia('(forced-colors: active)').matches,
            }))),
          });
          const assertRetainedOwners = async () => {
            if (baseline) return;
            expect(await mask.evaluate((node, original) => node === original, maskHandle)).toBe(
              true
            );
            expect(
              await content.evaluate((node, original) => node === original, contentHandle)
            ).toBe(true);
            expect(await content.isVisible()).toBe(true);
            expect(await content.getAttribute('data-transition-state')).toBe('entered');
            expect(await trigger.getAttribute('aria-expanded')).toBe('true');
            expect(
              await contentHandle.evaluate((element) =>
                Object.fromEntries(
                  ['owner', 'family', 'runtime', 'generation'].map((name) => [
                    name,
                    element.getAttribute(`data-projection-${name}`),
                  ])
                )
              )
            ).toEqual(coordinates);
            expect(
              await contentHandle.evaluate((element) => element.contains(document.activeElement))
            ).toBe(true);
            const facts = await read();
            expect(facts.coordinates).toEqual(coordinates);
            expect(facts.prototype).toBe('shadcn-dialog-mask');
            expect(facts.connected).toBe(true);
            expect(facts.position).toBe('fixed');
            expect(facts.rect.left).toBeCloseTo(0, 1);
            expect(facts.rect.top).toBeCloseTo(0, 1);
            expect(facts.rect.right).toBeCloseTo(facts.viewport.width, 1);
            expect(facts.rect.bottom).toBeCloseTo(facts.viewport.height, 1);
            expect(facts.ownsOutsidePoint).toBe(true);
          };
          const settleMask = async () => {
            // Media change delivery and its queued Rule feedback must reach a
            // frame before enumerating the newly created color transition.
            // Waiting on the old animation list, then frames, misses that work.
            await frames(page);
            maskSettlement = await maskHandle.evaluate(async (element) => {
              const animations = element.getAnimations();
              const snapshot = () => {
                const style = getComputedStyle(element);
                return {
                  observedAt: performance.now(),
                  connected: element.isConnected,
                  tokens: element.getAttribute('data-pui-style'),
                  background: style.backgroundColor,
                  transitionProperty: style.transitionProperty,
                  transitionDuration: style.transitionDuration,
                  animations: animations.map((animation) => ({
                    kind: animation.constructor.name,
                    transitionProperty:
                      'transitionProperty' in animation ? animation.transitionProperty : null,
                    currentTime: String(animation.currentTime),
                    playState: animation.playState,
                    pending: animation.pending,
                    targetsMask:
                      animation.effect instanceof KeyframeEffect &&
                      animation.effect.target === element,
                  })),
                };
              };
              const before = snapshot();
              await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
              return { before, after: snapshot() };
            });
          };
          await settleMask();
          await assertRetainedOwners();
          const normal = await read();
          await capture(
            page,
            `dialog-${route === '/zh-cn/' ? 'home' : 'docs'}-${width}${runtime === 'wc' ? '' : '-react'}-normal`,
            normal
          );
          if (!baseline) {
            expect(normal.reducedTransparency).toBe(false);
            expect(normal.forcedColors).toBe(false);
            expect(normal.backdropFilter).toBe('none');
            expect(normal.backgroundAlpha).toBeCloseTo(0.3, 2);
            expect(Number(normal.opacity)).toBe(1);
          } else if (historicalNewYork) {
            expect(normal.backdropFilter).toBe('blur(4px)');
            expect(normal.backgroundAlpha).toBeCloseTo(0.5, 2);
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
            await assertRetainedOwners();
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
            expect(restored.backdropFilter).toBe('none');
            expect(restored.backgroundAlpha).toBeCloseTo(0.3, 2);
            expect(Number(restored.opacity)).toBe(1);
            expect(restored.connected).toBe(true);
          } else if (historicalNewYork) {
            expect(restored.backdropFilter).toBe('blur(4px)');
            expect(restored.backgroundAlpha).toBeCloseTo(0.5, 2);
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
          const status = root.querySelector<HTMLElement>(
            '.proto-previewer__skeleton[role="status"]'
          );
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
            // The optional compiler panel owns a separate live status. Observe
            // only the loading status whose lifetime this journey exercises.
            statusCount: root.querySelectorAll('.proto-previewer__skeleton[role="status"]').length,
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
