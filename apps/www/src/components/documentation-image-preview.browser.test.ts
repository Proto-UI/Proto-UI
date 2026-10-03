// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from '../content/docs/zh-cn/browser-harness';
const MD = '/en/test/image-preview-markdown/';
const MDX = '/en/test/image-preview-mdx/';
let browser: Browser;
let baseUrl = '';
const evidence = process.env.IMAGE_PREVIEW_EVIDENCE_DIR;
const records: object[] = [];
const failuresByPage = new WeakMap<Page, string[]>();
function track(page: Page): Page {
  const failures: string[] = [];
  failuresByPage.set(page, failures);
  page.on('pageerror', (error) => failures.push(error.message));
  return page;
}
async function capture(page: Page, name: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  const state = await page.evaluate(() => ({
    url: location.pathname,
    family: document.documentElement.dataset.siteLibraryFamily,
    viewerDefined: Boolean(customElements.get('documentation-image-preview')),
    contentRoots: document.querySelectorAll('[data-doc-flow]').length,
    triggers: Array.from(document.querySelectorAll('[data-docs-image-trigger]')).map((el) => ({
      tag: el.localName,
      text: el.textContent,
      alt: el.querySelector('img')?.alt,
      label: el.getAttribute('aria-label'),
    })),
    panels: Array.from(document.querySelectorAll('[data-docs-image-content]')).map((el) => ({
      tag: el.localName,
      state: el.getAttribute('data-transition-state'),
      detached: el.hasAttribute('data-pui-view-detached'),
      display: getComputedStyle(el).display,
      animation: getComputedStyle(el).animationName,
    })),
  }));
  await writeFile(
    path.join(evidence, `${name}.json`),
    JSON.stringify({ ...state, pageErrors: failuresByPage.get(page) ?? [] }, null, 2)
  );
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: false });
}
async function entered(page: Page) {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-docs-image-content]')?.getAttribute('data-transition-state') ===
      'entered'
  );
}
async function closed(page: Page) {
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-docs-image-content]') ||
      document.querySelector('[data-docs-image-content]')?.hasAttribute('data-pui-view-detached')
  );
}
async function open(page: Page, alt: string) {
  const trigger = page.getByRole('button', { name: `Enlarge image: ${alt}`, exact: true });
  await trigger.click();
  await entered(page);
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('.docs-image-full');
    return Boolean(img?.complete && img.naturalWidth);
  });
  return trigger;
}
describe('automatic documentation image preview in real Chromium', () => {
  beforeAll(async () => {
    baseUrl = await startServer(MD);
    browser = await launchBrowser();
  }, 240_000);
  afterAll(async () => {
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await writeFile(
        path.join(evidence, 'matrix.json'),
        JSON.stringify(
          {
            candidate: process.env.CANDIDATE_SHA ?? null,
            browser: browser?.version(),
            records,
            note: 'Family axis injects the documented page-family signal; no runtime/family selector interaction is claimed.',
          },
          null,
          2
        )
      );
    }
    await browser?.close();
    await stopServer();
  });
  for (const width of [320, 390, 1280])
    for (const colorScheme of ['light', 'dark'] as const)
      for (const family of ['shadcn', 'brutalist'] as const) {
        it(`${width}px ${colorScheme} ${family}: raster fit/original, keyboard, focus, animation and overlay`, async () => {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme,
            hasTouch: width < 500,
          });
          const page = track(await context.newPage());
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          try {
            await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
            await page.evaluate(
              ({ family, colorScheme }) => {
                document.documentElement.dataset.siteLibraryFamily = family;
                document.documentElement.dataset.theme = colorScheme;
              },
              { family, colorScheme }
            );
            await page.waitForFunction(
              (family) =>
                document.querySelector('[data-docs-image-trigger]')?.localName ===
                `docs-preview-${family}-button`,
              family
            );
            expect(await page.locator('[data-docs-image-trigger]').count()).toBe(2);
            const trigger = page.getByRole('button', {
              name: 'Enlarge image: Raster comparison diagram',
              exact: true,
            });
            if (width < 500) await trigger.tap();
            else {
              await trigger.focus();
              await page.keyboard.press('Enter');
            }
            await entered(page);
            const panel = page.locator('[data-docs-image-content]');
            expect(await panel.getAttribute('role')).toBe('dialog');
            expect(await panel.getAttribute('aria-modal')).toBe('true');
            const style = await panel.evaluate((el) => ({
              animation: getComputedStyle(el).animationName,
              duration: getComputedStyle(el).animationDuration,
              borderRadius: getComputedStyle(el).borderRadius,
              shadow: getComputedStyle(el).boxShadow,
              x: el.getBoundingClientRect().x,
              right: el.getBoundingClientRect().right,
              bottom: el.getBoundingClientRect().bottom,
              top: el.getBoundingClientRect().top,
            }));
            expect(style.animation).not.toBe('none');
            expect(style.duration).not.toBe('0s');
            expect(style.x).toBeGreaterThanOrEqual(0);
            expect(style.right).toBeLessThanOrEqual(width);
            expect(style.top).toBeGreaterThanOrEqual(0);
            expect(style.bottom).toBeLessThanOrEqual(901);
            // This path is the public Brutalist Dialog surface, not the private frame-free image viewer.
            if (family === 'brutalist') expect(style.borderRadius).toBe('5px');
            else expect(parseFloat(style.borderRadius)).toBeGreaterThan(0);
            const mask = await page.locator('[data-docs-image-mask]').evaluate((el) => ({
              opacity: getComputedStyle(el).backgroundColor,
              backdropFilter: getComputedStyle(el).backdropFilter,
            }));
            expect(mask.opacity).not.toBe('rgba(0, 0, 0, 0)');
            await capture(page, `${width}-${colorScheme}-${family}-fit`);
            await page.getByRole('button', { name: 'Original size', exact: true }).click();
            expect(await panel.getAttribute('data-original-size')).not.toBeNull();
            await page.waitForFunction(() => {
              const viewport = document.querySelector<HTMLElement>('.docs-image-viewport');
              return Boolean(viewport && viewport.scrollWidth > viewport.clientWidth);
            });
            await page.locator('.docs-image-viewport').focus();
            const before = await page
              .locator('.docs-image-viewport')
              .evaluate((el) => el.scrollLeft);
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(
              (before) => document.querySelector('.docs-image-viewport')!.scrollLeft > before,
              before
            );
            for (let count = 0; count < 5; count++) {
              await page.keyboard.press('Tab');
              expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
            }
            await capture(page, `${width}-${colorScheme}-${family}-original`);
            await page.keyboard.press('Escape');
            await closed(page);
            expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
            expect(await trigger.getAttribute('data-focus-visible')).not.toBeNull();
            expect(await trigger.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
            await capture(page, `${width}-${colorScheme}-${family}-keyboard-focus`);
            for (let count = 0; count < 2; count++) {
              await trigger.click();
              await entered(page);
              await page.mouse.click(1, 1);
              await closed(page);
            }
            expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
            ).toBe(true);
            expect(errors).toEqual([]);
            records.push({ width, colorScheme, family, style, mask });
          } finally {
            await capture(page, `${width}-${colorScheme}-${family}-last-observed`);
            await context.close();
          }
        }, 90_000);
      }
  it('preserves authored MDX picture/alt/caption, safe SVG, links and error recovery', async () => {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MDX}`, { waitUntil: 'networkidle' });
      expect(await page.locator('[data-fixture="picture"] picture > source').count()).toBe(1);
      expect(
        await page
          .locator('[data-fixture="unsupported-svg"]')
          .evaluate((el) => el.closest('[data-docs-image-trigger]'))
      ).toBeNull();
      expect(
        await page.locator('[data-fixture="interactive"] [data-docs-image-trigger]').count()
      ).toBe(0);
      expect(await page.locator('[data-fixture="opt-out"] [data-docs-image-trigger]').count()).toBe(
        0
      );
      await open(page, 'Responsive raster diagram');
      expect(await page.locator('.docs-image-full').getAttribute('src')).toContain(
        '/images/preview-fixture/raster.png'
      );
      expect(await page.locator('.docs-image-caption').textContent()).toBe(
        'Authored picture caption'
      );
      await page.keyboard.press('Escape');
      await closed(page);
      expect(await page.locator('[data-fixture="inline-svg"] svg text').allTextContents()).toEqual([
        'Source',
        'Result',
      ]);
      await open(page, 'Static inline diagram');
      expect(await page.locator('.docs-image-full').getAttribute('src')).toMatch(/^blob:/);
      expect(await page.locator('[data-docs-image-content] svg').count()).toBe(0);
      await capture(page, 'mdx-safe-inline-svg');
      await page.keyboard.press('Escape');
      await closed(page);
      await page
        .getByRole('button', { name: 'Enlarge image: Unavailable diagram', exact: true })
        .click();
      await entered(page);
      await page
        .getByRole('status')
        .filter({ hasText: 'This image could not be loaded' })
        .waitFor({ state: 'visible' });
      await capture(page, 'mdx-image-error');
      await page.keyboard.press('Escape');
      await closed(page);
      await open(page, 'Responsive raster diagram');
      expect(await page.locator('.docs-image-status').isVisible()).toBe(false);
      await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
      expect(await page.locator('[data-docs-image-content]').count()).toBe(0);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      await page.locator('a:has(img[alt="Linked vector"])').click();
      expect(page.url()).toContain('#linked-destination');
      expect(await page.locator('[data-docs-image-content][data-open]').count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 90_000);
  for (const [locale, width, colorScheme] of [
    ['zh-cn', 1280, 'light'],
    ['zh-cn', 390, 'dark'],
    ['en', 1280, 'dark'],
    ['en', 390, 'light'],
  ] as const) {
    it(`migrates the actual ${locale} whitepaper viewer at ${width}px ${colorScheme}`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = track(await context.newPage());
      try {
        await page.goto(`${baseUrl}/${locale}/whitepaper/6-consistency-boundary/`, {
          waitUntil: 'networkidle',
        });
        await page.evaluate((scheme) => {
          document.documentElement.dataset.theme = scheme;
        }, colorScheme);
        const trigger = page.locator('.whitepaper-figure [data-docs-image-trigger]').first();
        await trigger.click();
        await entered(page);
        await page.waitForFunction(() => {
          const image = document.querySelector<HTMLImageElement>('.docs-image-full');
          return Boolean(image?.complete && image.naturalWidth);
        });
        expect(await page.locator('button[data-diagram-open]').count()).toBe(0);
        expect(await page.locator('.docs-image-full').getAttribute('src')).toContain(
          `whitepaper-conditional-consistency.${locale}.svg`
        );
        await capture(page, `whitepaper-${locale}-${width}-${colorScheme}`);
        await page.keyboard.press('Escape');
        await closed(page);
        expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
      } finally {
        await capture(page, `whitepaper-${locale}-${width}-${colorScheme}-last-observed`);
        await context.close();
      }
    }, 90_000);
  }
  it('preserves actual cross-origin image referrer and credential requests', async () => {
    const bytes = await readFile('apps/www/public/images/preview-fixture/raster.png');
    const requests: Array<{ cookie: string; referer: string; origin: string }> = [];
    const server = createServer((request, response) => {
      requests.push({
        cookie: request.headers.cookie ?? '',
        referer: request.headers.referer ?? '',
        origin: request.headers.origin ?? '',
      });
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': baseUrl,
        'Access-Control-Allow-Credentials': 'true',
      });
      response.end(bytes);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const imageOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const context = await browser.newContext();
    const page = track(await context.newPage());
    try {
      // Deliberately fake fixture cookie; no account or user credential is involved.
      await context.addCookies([
        { url: imageOrigin, name: 'preview-fixture', value: 'non-secret', sameSite: 'Lax' },
      ]);
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      for (const crossOrigin of ['anonymous', 'use-credentials'] as const) {
        requests.length = 0;
        const referrerPolicy = crossOrigin === 'anonymous' ? 'no-referrer' : 'origin';
        await page.evaluate(
          ({ src, crossOrigin, referrerPolicy }) => {
            const image = document.createElement('img');
            image.alt = `Policy ${crossOrigin}`;
            image.crossOrigin = crossOrigin;
            image.referrerPolicy = referrerPolicy;
            image.src = src;
            document.querySelector('[data-doc-flow]')!.append(image);
          },
          { src: `${imageOrigin}/policy.png?${crossOrigin}`, crossOrigin, referrerPolicy }
        );
        await page.waitForFunction((alt) => {
          const image = Array.from(document.querySelectorAll('img')).find((img) => img.alt === alt);
          return Boolean(image?.complete && image.naturalWidth);
        }, `Policy ${crossOrigin}`);
        await open(page, `Policy ${crossOrigin}`);
        // HTML may reuse the document's already-decoded image even with no-store.
        // Verify the preview policy itself, plus every request actually emitted.
        const previewPolicy = await page.locator('.docs-image-full').evaluate((element) => {
          const image = element as HTMLImageElement;
          return {
            crossOrigin: image.crossOrigin,
            referrerPolicy: image.referrerPolicy,
            src: image.src,
          };
        });
        expect(previewPolicy).toEqual({
          crossOrigin,
          referrerPolicy,
          src: `${imageOrigin}/policy.png?${crossOrigin}`,
        });
        expect(requests.length).toBeGreaterThanOrEqual(1);
        for (const request of requests) {
          expect(request.origin).toBe(baseUrl);
          expect(request.referer).toBe(referrerPolicy === 'no-referrer' ? '' : `${baseUrl}/`);
          expect(request.cookie.includes('preview-fixture=non-secret')).toBe(
            crossOrigin === 'use-credentials'
          );
        }
        records.push({
          network: crossOrigin,
          requestCount: requests.length,
          previewPolicy,
          referrerPolicy,
          requests: requests.map((request) => ({
            origin: request.origin,
            referrer: request.referer,
            fixtureCredentialSent: Boolean(request.cookie),
          })),
        });
        await page.keyboard.press('Escape');
        await closed(page);
      }
    } finally {
      await context.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 90_000);
  it('keeps the native focus and panel boundary visible in forced colors', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      forcedColors: 'active',
    });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      const trigger = await open(page, 'Vector landscape');
      expect(
        await page
          .locator('[data-docs-image-content]')
          .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
      ).toBeGreaterThan(0);
      await capture(page, 'forced-colors-vector');
      await page.keyboard.press('Escape');
      await closed(page);
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await trigger.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      await capture(page, 'forced-colors-keyboard-focus');
    } finally {
      await context.close();
    }
  }, 90_000);
  it('honors reduced motion and preserves no-JavaScript media/link content', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      await open(page, 'Vector landscape');
      expect(
        await page
          .locator('[data-docs-image-content]')
          .evaluate((el) => getComputedStyle(el).animationName)
      ).toBe('none');
      await capture(page, 'reduced-motion-vector');
      await page.keyboard.press('Escape');
      await closed(page);
    } finally {
      await context.close();
    }
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = track(await noJs.newPage());
    try {
      await staticPage.goto(`${baseUrl}${MD}`);
      expect(await staticPage.locator('[data-doc-flow] img').count()).toBe(4);
      expect(await staticPage.locator('[data-docs-image-trigger]').count()).toBe(0);
      expect(await staticPage.locator('a:has(img[alt="Linked vector"])').getAttribute('href')).toBe(
        '#linked-destination'
      );
    } finally {
      await noJs.close();
    }
  }, 90_000);
});
