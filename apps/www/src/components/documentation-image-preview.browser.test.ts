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
  // PUI's logical phase and the browser's first painted transition frame have
  // distinct clocks. Observe both; do not treat a phase label as settled pixels.
  const content = await page.locator('[data-docs-image-content]').elementHandle();
  const media = await page.locator('.docs-image-full').elementHandle();
  try {
    // Bind the current render/media identity, then sample its live animations.
    // No stale finished promise can accept a canceled or replaced generation.
    await page.waitForFunction(
      ({ content, media }) =>
        content?.isConnected &&
        media?.isConnected &&
        content === document.querySelector('[data-docs-image-content]') &&
        media === document.querySelector('.docs-image-full') &&
        content.getAttribute('data-transition-state') === 'entered' &&
        content
          .getAnimations()
          .every((animation) => !animation.pending && animation.playState !== 'running'),
      { content, media }
    );
  } finally {
    await content?.dispose();
    await media?.dispose();
  }
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
type MotionFrame = {
  time: number;
  phase: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};
async function recordNextMotion(page: Page, input: 'pointerdown' | 'keydown') {
  // Instrumentation records real frames after the next native input. It neither
  // changes application state nor slows the requested 220ms motion.
  await page.evaluate((input) => {
    const record = { frames: [] as MotionFrame[], done: false };
    (window as any).__docsImageMotion = record;
    window.addEventListener(
      input,
      () => {
        let start = -1;
        const sample = (time: number) => {
          if (start < 0) start = time;
          const content = document.querySelector<HTMLElement>('[data-docs-image-content]');
          const mask = document.querySelector<HTMLElement>('[data-docs-image-mask]');
          if (content && mask && !content.hasAttribute('data-pui-view-detached')) {
            const rect = content.getBoundingClientRect();
            record.frames.push({
              time: time - start,
              phase: content.getAttribute('data-transition-state'),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              opacity: Number(getComputedStyle(mask).opacity),
            });
          }
          if (time - start < 550) requestAnimationFrame(sample);
          else record.done = true;
        };
        requestAnimationFrame(sample);
      },
      { once: true, capture: true }
    );
  }, input);
}
async function motionFrames(page: Page, name: string): Promise<MotionFrame[]> {
  await page.waitForFunction(() => (window as any).__docsImageMotion?.done);
  const frames = (await page.evaluate(
    () => (window as any).__docsImageMotion.frames
  )) as MotionFrame[];
  if (evidence)
    await writeFile(path.join(evidence, `${name}-frames.json`), JSON.stringify(frames, null, 2));
  return frames;
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
        it(`${width}px ${colorScheme} ${family}: borderless raster contain, keyboard, focus and linear motion`, async () => {
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
            else await trigger.click();
            await entered(page);
            const panel = page.locator('[data-docs-image-content]');
            expect(await panel.getAttribute('role')).toBe('dialog');
            expect(await panel.getAttribute('aria-modal')).toBe('true');
            const style = await panel.evaluate((el) => ({
              animation: getComputedStyle(el).animationName,
              duration: getComputedStyle(el).transitionDuration,
              easing: getComputedStyle(el).transitionTimingFunction,
              border: getComputedStyle(el).borderTopWidth,
              background: getComputedStyle(el).backgroundColor,
              borderRadius: getComputedStyle(el).borderRadius,
              shadow: getComputedStyle(el).boxShadow,
              x: el.getBoundingClientRect().x,
              right: el.getBoundingClientRect().right,
              bottom: el.getBoundingClientRect().bottom,
              top: el.getBoundingClientRect().top,
            }));
            expect(style.animation).toBe('none');
            expect(style.duration.split(',').map((s) => s.trim())).toContain('0.22s');
            expect(style.easing.split(',').every((s) => s.trim() === 'linear')).toBe(true);
            expect(style.border).toBe('0px');
            expect(style.shadow).toBe('none');
            expect(style.background).toBe('rgba(0, 0, 0, 0)');
            expect(style.x).toBeGreaterThanOrEqual(0);
            expect(style.right).toBeLessThanOrEqual(width);
            expect(style.top).toBeGreaterThanOrEqual(0);
            expect(style.bottom).toBeLessThanOrEqual(901);
            expect(style.borderRadius).toBe('0px');
            const mask = await page.locator('[data-docs-image-mask]').evaluate((el) => ({
              opacity: getComputedStyle(el).backgroundColor,
              backdropFilter: getComputedStyle(el).backdropFilter,
            }));
            expect(mask.opacity).toBe('rgba(0, 0, 0, 0.8)');
            expect(mask.backdropFilter).toBe('none');
            expect(await page.locator('[data-docs-image-zoom], .docs-image-toolbar').count()).toBe(
              0
            );
            expect(
              await page
                .locator('[data-docs-image-close]')
                .evaluate((el) => getComputedStyle(el).clipPath)
            ).toBe('inset(50%)');
            await capture(page, `${width}-${colorScheme}-${family}-fit`);
            await page.locator('.docs-image-full').click();
            expect(await panel.getAttribute('data-transition-state')).toBe('entered');
            for (let count = 0; count < 5; count++) {
              await page.keyboard.press('Tab');
              expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
            }
            expect(
              await page
                .locator('[data-docs-image-close]')
                .evaluate((el) => getComputedStyle(el).clipPath)
            ).toBe('none');
            await capture(page, `${width}-${colorScheme}-${family}-keyboard-close`);
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
  for (const width of [390, 1280]) {
    it(`${width}px real intermediate frames follow linear forward/reverse motion`, async () => {
      if (evidence) await mkdir(path.join(evidence, 'videos'), { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(evidence
          ? { recordVideo: { dir: path.join(evidence, 'videos'), size: { width, height: 900 } } }
          : {}),
      });
      const page = track(await context.newPage());
      const video = page.video();
      try {
        await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
        const trigger = page.getByRole('button', {
          name: 'Enlarge image: Raster comparison diagram',
          exact: true,
        });
        await trigger.scrollIntoViewIfNeeded();
        const origin = (await trigger.locator('img').boundingBox())!;
        await recordNextMotion(page, 'pointerdown');
        await trigger.click();
        await page.waitForFunction(
          () => {
            const mask = document.querySelector('[data-docs-image-mask]');
            const opacity = mask && Number(getComputedStyle(mask).opacity);
            return opacity && opacity > 0.1 && opacity < 0.8;
          },
          undefined,
          { polling: 'raf' }
        );
        await capture(page, `linear-${width}-opening`);
        await entered(page);
        const target = (await page.locator('[data-docs-image-content]').boundingBox())!;
        const opening = await motionFrames(page, `linear-${width}-opening`);
        const mid = opening.filter((f) => f.opacity > 0.1 && f.opacity < 0.9);
        expect(mid.length).toBeGreaterThanOrEqual(2);
        for (const frame of mid) {
          for (const key of ['x', 'y', 'width', 'height'] as const)
            expect(
              Math.abs(frame[key] - (origin[key] + (target[key] - origin[key]) * frame.opacity))
            ).toBeLessThan(4);
        }
        for (let i = 1; i < mid.length; i++)
          expect(
            Math.abs(mid[i].opacity - mid[i - 1].opacity - (mid[i].time - mid[i - 1].time) / 220)
          ).toBeLessThan(0.025);
        await capture(page, `linear-${width}-contained`);
        await recordNextMotion(page, 'keydown');
        await page.keyboard.press('Escape');
        await page.waitForFunction(
          () => {
            const mask = document.querySelector('[data-docs-image-mask]');
            const opacity = mask && Number(getComputedStyle(mask).opacity);
            return opacity && opacity > 0.1 && opacity < 0.8;
          },
          undefined,
          { polling: 'raf' }
        );
        await capture(page, `linear-${width}-closing`);
        const closing = await motionFrames(page, `linear-${width}-closing`);
        const closingMid = closing.filter((f) => f.opacity > 0.1 && f.opacity < 0.9);
        expect(closingMid.length).toBeGreaterThanOrEqual(2);
        for (const frame of closingMid)
          for (const key of ['x', 'y', 'width', 'height'] as const)
            expect(
              Math.abs(frame[key] - (origin[key] + (target[key] - origin[key]) * frame.opacity))
            ).toBeLessThan(4);
        for (let i = 1; i < closingMid.length; i++)
          expect(
            Math.abs(
              closingMid[i].opacity -
                closingMid[i - 1].opacity +
                (closingMid[i].time - closingMid[i - 1].time) / 220
            )
          ).toBeLessThan(0.025);
        await closed(page);
        expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
        expect(await trigger.locator('img').evaluate((el) => getComputedStyle(el).visibility)).toBe(
          'visible'
        );
        expect(failuresByPage.get(page)).toEqual([]);
        records.push({ motion: width, origin, target, opening, closing });
      } finally {
        await capture(page, `linear-${width}-last-observed`);
        await context.close();
        if (evidence && video) await video.saveAs(path.join(evidence, `linear-${width}.webm`));
      }
    }, 90_000);
  }
  it('reverses a native interrupted close and safely handles resized, offscreen or removed sources', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      // Dialog makes the background inert. This DOM locator is solely for
      // explicit fixture mutations, not a claim of native hidden interaction.
      const sourceOwner = page.locator(
        '[data-docs-image-trigger]:has(img[alt="Raster comparison diagram"])'
      );
      const originWidth = (await sourceOwner.locator('img').boundingBox())!.width;
      await open(page, 'Raster comparison diagram');
      const initial = (await page.locator('[data-docs-image-content]').boundingBox())!;
      await recordNextMotion(page, 'keydown');
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => {
          const mask = document.querySelector('[data-docs-image-mask]');
          const opacity = mask && Number(getComputedStyle(mask).opacity);
          return opacity && opacity > 0.5 && opacity < 0.8;
        },
        undefined,
        { polling: 'raf' }
      );
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-transition-state')
      ).toBe('leaving');
      await page.keyboard.press('Enter');
      await entered(page);
      const interrupted = await motionFrames(page, 'interrupted-reopen');
      expect(Math.min(...interrupted.map((f) => f.width))).toBeLessThan(initial.width - 20);
      expect(interrupted.at(-1)!.width).toBeCloseTo(initial.width, 0);
      for (let i = 1; i < interrupted.length; i++)
        expect(Math.abs(interrupted[i].width - interrupted[i - 1].width)).toBeLessThan(
          (Math.abs(initial.width - originWidth) *
            (interrupted[i].time - interrupted[i - 1].time)) /
            220 +
            2
        );
      await page.setViewportSize({ width: 390, height: 700 });
      await page.waitForFunction(() => {
        const r = document.querySelector('[data-docs-image-content]')!.getBoundingClientRect();
        return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
      });
      await capture(page, 'interrupted-resized');
      await sourceOwner.evaluate((el) => {
        (el as HTMLElement).style.transform = 'translateY(4000px)';
      });
      await page.keyboard.press('Escape');
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-docs-image-return')
      ).toBe('fade');
      await closed(page);
      await sourceOwner.evaluate((el) => {
        (el as HTMLElement).style.removeProperty('transform');
      });
      await open(page, 'Raster comparison diagram');
      await sourceOwner.evaluate((el) => el.remove());
      await page.keyboard.press('Escape');
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-docs-image-return')
      ).toBe('fade');
      await closed(page);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
      expect(failuresByPage.get(page)).toEqual([]);
    } finally {
      await capture(page, 'interrupted-last-observed');
      await context.close();
    }
  }, 90_000);
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
      expect(await page.locator('.docs-image-accessible-description').textContent()).toContain(
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
  it('keeps keyboard focus visible without adding an image frame in forced colors', async () => {
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
      ).toBe(0);
      await page.keyboard.press('Tab');
      expect(
        await page.locator('[data-docs-image-close]').getAttribute('data-focus-visible')
      ).not.toBeNull();
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
          .evaluate((el) => getComputedStyle(el).transitionDuration)
      ).toBe('0s');
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
