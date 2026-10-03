// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
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
async function capture(page: Page, name: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
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
          const page = await context.newPage();
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
            if (family === 'brutalist') expect(style.borderRadius).toBe('0px');
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
            await context.close();
          }
        }, 90_000);
      }
  it('preserves authored MDX picture/alt/caption, safe SVG, links and error recovery', async () => {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await context.newPage();
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
  it('honors reduced motion and preserves no-JavaScript media/link content', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
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
    const staticPage = await noJs.newPage();
    try {
      await staticPage.goto(`${baseUrl}${MD}`);
      expect(await staticPage.locator('.sl-markdown-content img').count()).toBe(4);
      expect(await staticPage.locator('[data-docs-image-trigger]').count()).toBe(0);
      expect(await staticPage.locator('a:has(img[alt="Linked vector"])').getAttribute('href')).toBe(
        '#linked-destination'
      );
    } finally {
      await noJs.close();
    }
  }, 90_000);
});
