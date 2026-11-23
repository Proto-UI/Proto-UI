// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from '../content/docs/zh-cn/browser-harness';
import { sharedImageHitPoint } from './documentation-image-preview.test-utils';
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
      inertAncestor: Boolean(el.closest('[inert]')),
      hiddenAncestor: Boolean(el.closest('[aria-hidden="true"], [hidden]')),
      mediaVisibility: el.querySelector('img')
        ? getComputedStyle(el.querySelector('img')!).visibility
        : null,
      mediaOpacity: el.querySelector('img')
        ? getComputedStyle(el.querySelector('[data-docs-image-source-surface]')!).opacity
        : null,
    })),
    panels: Array.from(document.querySelectorAll('[data-docs-image-content]')).map((el) => ({
      tag: el.localName,
      state: el.getAttribute('data-transition-state'),
      detached: el.hasAttribute('data-pui-view-detached'),
      display: getComputedStyle(el).display,
      animation: getComputedStyle(el).animationName,
    })),
    activeElement: document.activeElement?.localName,
    sourceFocused: document.activeElement?.hasAttribute('data-docs-image-trigger') ?? false,
    triggerFrames: (window as any).__docsTriggerFrames ?? [],
    focusTimeline: (window as any).__docsFocusTimeline ?? [],
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
async function readingFocusPaint(page: Page) {
  await page.waitForFunction(() => {
    const viewport = document.querySelector<
      HTMLElement & {
        getExposes?: () => { focusVisible?: { get?: () => boolean } };
      }
    >('[data-docs-image-viewport]');
    return (
      viewport === document.activeElement && viewport?.getExposes?.().focusVisible?.get?.() === true
    );
  });
  const paint = await page.locator('[data-docs-image-viewport]').evaluate((node) => {
    const style = getComputedStyle(node);
    const viewport = node.getBoundingClientRect();
    const content = node.closest<HTMLElement>('[data-docs-image-content]')!;
    const clip = content.getBoundingClientRect();
    const reach = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset));
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      boxShadow: style.boxShadow,
      tokens: node.getAttribute('data-pui-style'),
      outlineFitsDialog:
        viewport.x - reach >= clip.x &&
        viewport.y - reach >= clip.y &&
        viewport.right + reach <= clip.x + content.clientWidth &&
        viewport.bottom + reach <= clip.y + content.clientHeight,
      outerScroll: { x: content.scrollLeft, y: content.scrollTop },
      controls: Array.from(content.querySelectorAll<HTMLElement>('.docs-image-toolbar > *')).map(
        (button) => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return {
            fitsDialog:
              box.x >= clip.x &&
              box.y >= clip.y &&
              box.right <= clip.x + content.clientWidth &&
              box.bottom <= clip.y + content.clientHeight,
            hit: hit === button || (hit !== null && button.contains(hit)),
          };
        }
      ),
    };
  });
  // Computed feedback is necessary; the retained real screenshot also needs
  // visual inspection for clipping or paint occlusion by the actual image.
  expect(paint.outlineStyle).toBe('solid');
  expect(parseFloat(paint.outlineWidth)).toBeGreaterThanOrEqual(2);
  expect(paint.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(paint.outlineColor).not.toBe('transparent');
  expect(paint.outlineFitsDialog).toBe(true);
  expect(paint.outerScroll).toEqual({ x: 0, y: 0 });
  expect(paint.controls).toHaveLength(3);
  for (const button of paint.controls) expect(button).toEqual({ fitsDialog: true, hit: true });
  return paint;
}
async function fittedReadingViewport(page: Page) {
  await page.waitForFunction(() => {
    const port = document.querySelector<HTMLElement>('[data-docs-image-viewport]');
    return (
      port?.dataset.docsImageScale === 'fit' &&
      port.tabIndex === -1 &&
      Math.abs(port.scrollWidth - port.clientWidth) <= 1 &&
      Math.abs(port.scrollHeight - port.clientHeight) <= 1
    );
  });
  const fit = await page.locator('[data-docs-image-viewport]').evaluate((node) => {
    const viewport = node.getBoundingClientRect();
    const image = node.querySelector('img')!.getBoundingClientRect();
    return {
      x: viewport.x,
      y: viewport.y,
      width: node.clientWidth,
      height: node.clientHeight,
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
      image: { x: image.x, y: image.y, width: image.width, height: image.height },
    };
  });
  expect(fit.width).toBeGreaterThan(0);
  expect(fit.height).toBeGreaterThan(0);
  expect(Math.abs(fit.scrollLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(fit.scrollTop)).toBeLessThanOrEqual(1);
  expect(fit.image.x).toBeGreaterThanOrEqual(fit.x - 1);
  expect(fit.image.y).toBeGreaterThanOrEqual(fit.y - 1);
  expect(fit.image.x + fit.image.width).toBeLessThanOrEqual(fit.x + fit.width + 1);
  expect(fit.image.y + fit.image.height).toBeLessThanOrEqual(fit.y + fit.height + 1);
  return fit;
}
type MotionFrame = {
  time: number;
  phase: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  sourceOpacity: number | null;
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
            const source = document.querySelector(
              '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
            );
            record.frames.push({
              time: time - start,
              phase: content.getAttribute('data-transition-state'),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              opacity: Number(
                getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity
              ),
              sourceOpacity: source
                ? Number(
                    getComputedStyle(source.closest('[data-docs-image-source-surface]')!).opacity
                  )
                : null,
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
            await page.waitForFunction((family) => {
              const triggers = [
                ...document.querySelectorAll<HTMLElement>('[data-docs-image-trigger]'),
              ];
              return (
                triggers.length === 2 &&
                triggers.every(
                  (trigger) =>
                    trigger.localName === `docs-preview-${family}-image-trigger` &&
                    trigger.dataset.docsPreviewFamily === family &&
                    trigger.getAttribute('role') === 'button' &&
                    trigger.tabIndex === 0 &&
                    trigger.getAttribute('aria-disabled') !== 'true' &&
                    !trigger.closest('[hidden], [inert]')
                )
              );
            }, family);
            expect(await page.locator('[data-docs-image-trigger]').count()).toBe(2);
            const trigger = page.getByRole('button', {
              name: 'Enlarge image: Raster comparison diagram',
              exact: true,
            });
            expect(await trigger.count(), 'exact source image accessible name').toBe(1);
            expect(await trigger.isEnabled(), 'public Base semantic trigger is usable').toBe(true);
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
              opacity: getComputedStyle(el.querySelector('[data-docs-image-scrim]')!)
                .backgroundColor,
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
            expect(
              await trigger.evaluate(
                (el) =>
                  getComputedStyle(el.querySelector('[data-docs-image-trigger-surface]')!).boxShadow
              )
            ).not.toBe('none');
            await capture(page, `${width}-${colorScheme}-${family}-keyboard-focus`);
            if (width === 390 && family === 'brutalist') {
              await page.evaluate(() => {
                const trigger = document.querySelector('[data-docs-image-trigger]')!;
                const frames: object[] = [];
                (window as any).__docsTriggerFrames = frames;
                const sample = (time: number) => {
                  const rect = trigger.getBoundingClientRect();
                  const style = getComputedStyle(trigger);
                  frames.push({
                    time,
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    hovered: trigger.hasAttribute('data-hovered'),
                    pressed: trigger.hasAttribute('data-pressed'),
                    focused: document.activeElement === trigger,
                    transform: style.transform,
                    translate: style.translate,
                    tokens: trigger.getAttribute('data-pui-style'),
                  });
                  if (frames.length < 240) requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
              });
            }
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
            const opacity =
              mask &&
              Number(getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity);
            return opacity && opacity > 0.1 && opacity < 0.8;
          },
          undefined,
          { polling: 'raf' }
        );
        await capture(page, `linear-${width}-opening`);
        await entered(page);
        const target = (await page.locator('[data-docs-image-content]').boundingBox())!;
        const opening = await motionFrames(page, `linear-${width}-opening`);
        expect(
          opening.filter((f) => f.phase === 'entering').every((f) => f.sourceOpacity === 0)
        ).toBe(true);
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
            const opacity =
              mask &&
              Number(getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity);
            return opacity && opacity > 0.1 && opacity < 0.8;
          },
          undefined,
          { polling: 'raf' }
        );
        await capture(page, `linear-${width}-closing`);
        const closing = await motionFrames(page, `linear-${width}-closing`);
        expect(
          closing.filter((f) => f.phase === 'leaving').every((f) => f.sourceOpacity === 0)
        ).toBe(true);
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
      // This DOM locator is solely for explicit fixture mutations, not a claim
      // of native background interaction while the modal is present.
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
          const opacity =
            mask &&
            Number(getComputedStyle(mask.querySelector('[data-docs-image-scrim]')!).opacity);
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
      await page.waitForFunction(
        () =>
          document.querySelector('[data-docs-image-trigger] img')!.getBoundingClientRect().top >=
          innerHeight
      );
      const beforeClose = await sourceOwner.evaluate((el) => ({
        source: el.querySelector('img')!.getBoundingClientRect().toJSON(),
        scrollY,
        viewport: {
          width: innerWidth,
          height: innerHeight,
          x: visualViewport?.offsetLeft,
          y: visualViewport?.offsetTop,
        },
        returnMode: document.querySelector<HTMLElement>('[data-docs-image-content]')!.dataset
          .docsImageReturn,
      }));
      await page.keyboard.press('Escape');
      const afterClose = await sourceOwner.evaluate((el) => ({
        source: el.querySelector('img')!.getBoundingClientRect().toJSON(),
        scrollY,
        returnMode: document.querySelector<HTMLElement>('[data-docs-image-content]')!.dataset
          .docsImageReturn,
      }));
      records.push({ invalidOrigin: { beforeClose, afterClose } });
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
  it('preserves source alt and action name while open, leaving and restored without background input leakage', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = track(await context.newPage());
    try {
      await page.goto(`${baseUrl}${MD}`, { waitUntil: 'networkidle' });
      const name = 'Enlarge image: Raster comparison diagram';
      await page.evaluate(() => {
        const timeline: object[] = [];
        (window as any).__docsFocusTimeline = timeline;
        const label = (node: EventTarget | null) =>
          node instanceof Element
            ? node.hasAttribute('data-docs-image-trigger')
              ? 'source-trigger'
              : node.hasAttribute('data-docs-image-mask')
                ? 'image-mask'
                : node.classList.contains('docs-image-full')
                  ? 'preview-image'
                  : node.localName
            : null;
        for (const type of [
          'pointerdown',
          'mousedown',
          'pointerup',
          'mouseup',
          'click',
          'focusin',
          'focusout',
        ]) {
          for (const capture of [true, false])
            document.addEventListener(
              type,
              (event) => {
                timeline.push({
                  time: performance.now(),
                  type,
                  capture,
                  trusted: event.isTrusted,
                  target: label(event.target),
                  active: label(document.activeElement),
                  defaultPrevented: event.defaultPrevented,
                  phase: document
                    .querySelector('[data-docs-image-content]')
                    ?.getAttribute('data-transition-state'),
                });
              },
              { capture }
            );
        }
      });
      const trigger = page.getByRole('button', { name, exact: true });
      const source = page.locator('[data-docs-image-trigger] img[alt="Raster comparison diagram"]');
      const originalSrc = await source.getAttribute('src');
      const states: object[] = [];
      const sourceFact = async (phase: string) => {
        const count = await trigger.count();
        const facts = await source.evaluate((el) => ({
          alt: el.getAttribute('alt'),
          src: el.getAttribute('src'),
          opacity: getComputedStyle(el.closest('[data-docs-image-source-surface]')!).opacity,
          visibility: getComputedStyle(el).visibility,
          transition: getComputedStyle(el).transition,
          inlineTransition: {
            value: (el as HTMLElement).style.getPropertyValue('transition'),
            priority: (el as HTMLElement).style.getPropertyPriority('transition'),
          },
          inlineOpacity: {
            value: (el as HTMLElement).style.getPropertyValue('opacity'),
            priority: (el as HTMLElement).style.getPropertyPriority('opacity'),
          },
          phase: document
            .querySelector('[data-docs-image-content]')
            ?.getAttribute('data-transition-state'),
        }));
        states.push({ stage: phase, count, ...facts });
        expect(count).toBe(1);
        expect(facts.alt).toBe('Raster comparison diagram');
        expect(facts.src).toBe(originalSrc);
        expect(facts.visibility).toBe('visible');
        return facts;
      };
      const before = await sourceFact('before');
      await open(page, 'Raster comparison diagram');
      const opened = await sourceFact('open');
      expect(opened.opacity).toBe('0');
      expect(opened.inlineTransition).toEqual(before.inlineTransition);
      expect(opened.inlineOpacity).toEqual(before.inlineOpacity);
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Tab');
        expect(
          await page
            .locator('[data-docs-image-content]')
            .evaluate((el) => el.contains(document.activeElement))
        ).toBe(true);
      }
      await page.keyboard.press('Escape');
      const leaving = await sourceFact('leaving');
      expect(leaving.phase).toBe('leaving');
      expect(leaving.opacity).toBe('0');
      expect(leaving.inlineTransition).toEqual(before.inlineTransition);
      expect(leaving.inlineOpacity).toEqual(before.inlineOpacity);
      expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
      expect(await trigger.getAttribute('data-focus-visible')).not.toBeNull();
      await closed(page);
      const restored = await sourceFact('restored');
      expect(restored.opacity).toBe('1');
      expect(restored.transition).toBe(before.transition);
      expect(restored.inlineTransition).toEqual(before.inlineTransition);
      expect(restored.inlineOpacity).toEqual(before.inlineOpacity);
      expect(await trigger.getAttribute('data-docs-image-source-instant')).toBeNull();
      await page.evaluate(() => {
        (window as any).__docsSourceClicks = 0;
        document.querySelector('[data-docs-image-trigger]')!.addEventListener('click', (event) => {
          if (event.isTrusted) (window as any).__docsSourceClicks++;
        });
      });
      await trigger.click();
      await entered(page);
      expect(await page.evaluate(() => (window as any).__docsSourceClicks)).toBe(1);
      await page.waitForFunction(() => {
        const source = document.querySelector<HTMLImageElement>(
          '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
        );
        const preview = document.querySelector<HTMLImageElement>('.docs-image-full');
        const content = preview?.closest('[data-docs-image-content]');
        const owner = source?.closest('[data-docs-image-trigger]');
        return Boolean(
          source?.complete &&
          preview?.complete &&
          preview.naturalWidth &&
          content &&
          owner &&
          content.getAttribute('data-transition-state') === 'entered' &&
          [content, owner].every((el) =>
            el
              .getAnimations({ subtree: true })
              .every((animation) => !animation.pending && animation.playState !== 'running')
          )
        );
      });
      const geometry = await page.evaluate(async () => {
        const source = document.querySelector<HTMLElement>(
          '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
        )!;
        const preview = document.querySelector<HTMLElement>('.docs-image-full')!;
        const rect = (el: Element) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height };
        };
        const read = () => {
          const scroll = [[window.scrollX, window.scrollY]];
          for (let owner = source.parentElement; owner; owner = owner.parentElement)
            scroll.push([owner.scrollLeft, owner.scrollTop]);
          return { source: rect(source), preview: rect(preview), scroll };
        };
        // Read both boxes in one frame, then prove layout/scroll stability in
        // the next frame. There is no timer or relaxed coordinate tolerance.
        const before = read();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { before, after: read() };
      });
      expect(geometry.after).toEqual(geometry.before);
      const point = sharedImageHitPoint(geometry.after.source, geometry.after.preview);
      expect(
        point,
        'source and foreground image must have a shared painted interior'
      ).not.toBeNull();
      if (!point) throw new Error('No shared source/preview hit point');
      for (const box of [geometry.after.source, geometry.after.preview]) {
        expect(point.x).toBeGreaterThan(box.x);
        expect(point.x).toBeLessThan(box.x + box.width);
        expect(point.y).toBeGreaterThan(box.y);
        expect(point.y).toBeLessThan(box.y + box.height);
      }
      const hitPreview = await page.evaluate((point) => {
        const preview = document.querySelector('.docs-image-full')!;
        const source = document.querySelector(
          '[data-docs-image-trigger] img[alt="Raster comparison diagram"]'
        )!;
        const rect = (el: Element) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height };
        };
        (window as any).__docsPreviewPointer = null;
        document.addEventListener(
          'pointerdown',
          (event) => {
            (window as any).__docsPreviewPointer = {
              trusted: event.isTrusted,
              preview: event.target === preview,
              x: event.clientX,
              y: event.clientY,
              source: rect(source),
              foreground: rect(preview),
            };
          },
          { capture: true, once: true }
        );
        return document.elementFromPoint(point.x, point.y) === preview;
      }, point);
      expect(hitPreview).toBe(true);
      await page.mouse.click(point.x, point.y);
      const pointer = await page.evaluate(() => (window as any).__docsPreviewPointer);
      expect(pointer).toMatchObject({
        trusted: true,
        preview: true,
        source: geometry.after.source,
        foreground: geometry.after.preview,
      });
      for (const box of [pointer.source, pointer.foreground]) {
        expect(pointer.x).toBeGreaterThan(box.x);
        expect(pointer.x).toBeLessThan(box.x + box.width);
        expect(pointer.y).toBeGreaterThan(box.y);
        expect(pointer.y).toBeLessThan(box.y + box.height);
      }
      expect(await page.evaluate(() => (window as any).__docsSourceClicks)).toBe(1);
      expect(
        await page.locator('[data-docs-image-content]').getAttribute('data-transition-state')
      ).toBe('entered');
      await page.mouse.click(1, 1);
      await closed(page);
      expect(await page.evaluate(() => (window as any).__docsSourceClicks)).toBe(1);
      expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
      records.push({
        sourceNaming: states,
        sourceHitProbe: { ...geometry, point, hitPreview, pointer },
      });
      expect(failuresByPage.get(page)).toEqual([]);
    } finally {
      await capture(page, 'source-name-last-observed');
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
      const status = page.locator('.docs-image-status');
      expect(await status.evaluate((node) => node.localName)).toBe('p');
      expect(await status.getAttribute('role')).toBe('status');
      const statusText = status.locator('[data-docs-image-status-text][data-pui-root]');
      expect(await statusText.count()).toBe(1);
      expect(await statusText.getAttribute('data-docs-preview-prototype')).toBe('shadcn-text-root');
      expect(await statusText.getAttribute('role')).toBeNull();
      expect(await statusText.getAttribute('tabindex')).toBeNull();
      expect(await statusText.getAttribute('data-pui-style')).toContain('text-base');
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
          `whitepaper-conditional-consistency${width < 640 ? '.mobile' : ''}.${locale}.svg`
        );
        const viewport = page.locator('[data-docs-image-viewport]');
        const zoom = page.locator('[data-docs-image-zoom]');
        const zoomIn = page.locator('[data-docs-image-zoom-in]');
        const zoomOut = page.locator('[data-docs-image-zoom-out]');
        const readPosition = () =>
          viewport.evaluate((node) => ({
            x: node.scrollLeft,
            y: node.scrollTop,
            maxX: node.scrollWidth - node.clientWidth,
            maxY: node.scrollHeight - node.clientHeight,
          }));
        expect(await viewport.getAttribute('data-docs-image-scale')).toBe('reading');
        const readingWidth = (await page.locator('.docs-image-full').boundingBox())!.width;
        expect(readingWidth).toBeGreaterThan((await trigger.locator('img').boundingBox())!.width);
        await zoomIn.click();
        const enlargedWidth = (await page.locator('.docs-image-full').boundingBox())!.width;
        expect(enlargedWidth).toBeGreaterThan(readingWidth);
        // PUI Button owns keyboard activation; native focus then reaches the
        // browser scroll region rather than a second application key handler.
        await page.keyboard.press('Tab');
        expect(await viewport.evaluate((node) => node === document.activeElement)).toBe(true);
        const keyboardFocus = await readingFocusPaint(page);
        await capture(page, `whitepaper-${locale}-${width}-${colorScheme}-reading-keyboard-focus`);
        const keyBefore = await readPosition();
        if (keyBefore.maxY > keyBefore.y + 1) {
          await page.keyboard.press('PageDown');
          await expect.poll(async () => (await readPosition()).y).toBeGreaterThan(keyBefore.y);
        }
        const wheelBefore = await readPosition();
        const background = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
        if (wheelBefore.maxX > wheelBefore.x + 1) {
          await viewport.hover();
          await page.mouse.wheel(wheelBefore.maxX * 2, 0);
          await expect.poll(async () => (await readPosition()).x).toBeGreaterThan(wheelBefore.x);
        }
        expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(background);
        const readingPosition = await readPosition();
        await capture(page, `whitepaper-${locale}-${width}-${colorScheme}-reading`);
        await zoomOut.click();
        expect((await page.locator('.docs-image-full').boundingBox())!.width).toBeCloseTo(
          readingWidth,
          1
        );
        await zoom.click();
        expect(await viewport.getAttribute('data-docs-image-scale')).toBe('fit');
        const fitViewport = await fittedReadingViewport(page);
        const fit = (await page.locator('.docs-image-full').boundingBox())!;
        expect(fit.x).toBeGreaterThanOrEqual(0);
        expect(fit.y).toBeGreaterThanOrEqual(0);
        expect(fit.x + fit.width).toBeLessThanOrEqual(width + 1);
        expect(fit.y + fit.height).toBeLessThanOrEqual(901);
        const canvas = await page.locator('[data-docs-image-canvas]').evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          padding: getComputedStyle(el).padding,
          border: getComputedStyle(el).borderTopWidth,
          shadow: getComputedStyle(el).boxShadow,
        }));
        expect(canvas.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(canvas.padding).toBe('0px');
        expect(canvas.border).toBe('0px');
        expect(canvas.shadow).toBe('none');
        records.push({
          whitepaper: locale,
          width,
          colorScheme,
          canvas,
          readingWidth,
          enlargedWidth,
          keyBefore,
          wheelBefore,
          readingPosition,
          keyboardFocus,
          fit,
          fitViewport,
        });
        await capture(page, `whitepaper-${locale}-${width}-${colorScheme}`);
        await page.keyboard.press('Enter');
        expect(await viewport.getAttribute('data-docs-image-scale')).toBe('reading');
        await page.keyboard.press('Escape');
        await closed(page);
        expect(await trigger.evaluate((el) => document.activeElement === el)).toBe(true);
      } finally {
        await capture(page, `whitepaper-${locale}-${width}-${colorScheme}-last-observed`);
        await context.close();
      }
    }, 90_000);
  }
  for (const locale of ['zh-cn', 'en'] as const) {
    it(`keeps the five ${locale} channel identifiers readable in the actual mobile table`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = track(await context.newPage());
      try {
        await page.goto(`${baseUrl}/${locale}/whitepaper/2-interaction-relations/`, {
          waitUntil: 'networkidle',
        });
        const words = page.locator('.whitepaper-channel-table tbody td:first-child code');
        expect(await words.allTextContents()).toEqual([
          'Event',
          'Feedback',
          'Props',
          'Expose',
          'Context',
        ]);
        const geometry = await words.evaluateAll((nodes) =>
          nodes.map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const lines = [...range.getClientRects()].filter(
              (rect) => rect.width > 0 && rect.height > 0
            );
            return {
              text: node.textContent,
              lineTops: lines.map((rect) => rect.top),
              whiteSpace: getComputedStyle(node).whiteSpace,
            };
          })
        );
        for (const word of geometry) {
          expect(word.lineTops.length).toBeGreaterThan(0);
          expect(Math.max(...word.lineTops) - Math.min(...word.lineTops)).toBeLessThan(2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        );
        records.push({ channelTable: locale, geometry });
        await words.first().scrollIntoViewIfNeeded();
        await capture(page, `channel-table-${locale}-390`);
      } finally {
        await context.close();
      }
    }, 90_000);
    for (const figure of ['lifecycle', 'translation'] as const) {
      it(`reads the unchanged authored ${locale} ${figure} drawing through the mobile viewport`, async () => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: locale === 'zh-cn' ? 'light' : 'dark',
        });
        const page = track(await context.newPage());
        try {
          const chapter =
            figure === 'lifecycle' ? '4-semantics-beyond-channels' : '5-translation-layer';
          const asset =
            figure === 'lifecycle'
              ? 'whitepaper-lifecycle.svg'
              : `whitepaper-translation-responsibility.${locale}.svg`;
          await page.goto(`${baseUrl}/${locale}/whitepaper/${chapter}/`, {
            waitUntil: 'networkidle',
          });
          const authored = page.locator(`img[src="/diagrams/${asset}"]`).first();
          const trigger = page.locator('[data-docs-image-trigger]').filter({ has: authored });
          await trigger.click();
          await entered(page);
          const image = page.locator('.docs-image-full');
          await image.evaluate((node) => (node as HTMLImageElement).decode());
          expect(await image.getAttribute('src')).toContain(`/diagrams/${asset}`);
          const viewport = page.locator('[data-docs-image-viewport]');
          expect(await viewport.getAttribute('data-docs-image-scale')).toBe('reading');
          const start = await viewport.evaluate((node) => ({
            x: node.scrollLeft,
            y: node.scrollTop,
            maxX: node.scrollWidth - node.clientWidth,
            maxY: node.scrollHeight - node.clientHeight,
          }));
          expect(start.maxX).toBeGreaterThan(0);
          await capture(page, `authored-${locale}-${figure}-reading`);
          await viewport.hover();
          await page.mouse.wheel(start.maxX * 2, start.maxY * 2);
          await expect
            .poll(async () => viewport.evaluate((node) => node.scrollLeft))
            .toBeGreaterThan(start.x);
          const end = await viewport.evaluate((node) => ({
            x: node.scrollLeft,
            y: node.scrollTop,
          }));
          await capture(page, `authored-${locale}-${figure}-reading-end`);
          await page.locator('[data-docs-image-zoom]').click();
          expect(await viewport.getAttribute('data-docs-image-scale')).toBe('fit');
          const fitViewport = await fittedReadingViewport(page);
          const fit = (await image.boundingBox())!;
          expect(fit.x).toBeGreaterThanOrEqual(0);
          expect(fit.y).toBeGreaterThanOrEqual(0);
          expect(fit.x + fit.width).toBeLessThanOrEqual(391);
          expect(fit.y + fit.height).toBeLessThanOrEqual(845);
          records.push({ authored: asset, locale, start, end, fit, fitViewport });
          await capture(page, `authored-${locale}-${figure}-fit`);
          await page.keyboard.press('Escape');
          await closed(page);
          expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
          await page.keyboard.press('Enter');
          await entered(page);
          expect(await viewport.getAttribute('data-docs-image-scale')).toBe('reading');
          expect(
            await viewport.evaluate((node) => ({ x: node.scrollLeft, y: node.scrollTop }))
          ).toEqual({ x: 0, y: 0 });
          await page.keyboard.press('Escape');
          await closed(page);
        } finally {
          await capture(page, `authored-${locale}-${figure}-last-observed`);
          await context.close();
        }
      }, 90_000);
    }
  }

  for (const family of ['shadcn', 'brutalist'] as const) {
    it(`rejects stale ${family} diagram actions during close and after a new presentation`, async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = track(await context.newPage());
      try {
        await page.goto(`${baseUrl}/en/whitepaper/6-consistency-boundary/`, {
          waitUntil: 'networkidle',
        });
        await page.evaluate((family) => {
          document.documentElement.dataset.siteLibraryFamily = family;
        }, family);
        await page.waitForFunction(
          (family) =>
            document.querySelector('.whitepaper-figure [data-docs-image-trigger]')?.localName ===
            `docs-preview-${family}-image-trigger`,
          family
        );
        const trigger = page.locator('.whitepaper-figure [data-docs-image-trigger]').first();
        await trigger.click();
        await entered(page);
        await page
          .locator('.docs-image-full')
          .evaluate((node) => (node as HTMLImageElement).decode());
        const oldButtons = await page
          .locator('[data-docs-image-zoom-out], [data-docs-image-zoom], [data-docs-image-zoom-in]')
          .elementHandles();
        expect(oldButtons.length).toBe(3);
        try {
          const probeStaleActions = async (closeCurrent: boolean) =>
            page.evaluate(
              ({ oldButtons, closeCurrent }) => {
                const root = document.querySelector<
                  HTMLElement & {
                    getExposes?: () => {
                      close?: (reason: string) => void;
                      open?: { get?: () => boolean };
                    };
                  }
                >('[data-docs-image-dialog]');
                if (closeCurrent) root?.getExposes?.().close?.('test.stale-diagram-action');
                const snapshot = () => {
                  const viewport = document.querySelector<HTMLElement>(
                    '[data-docs-image-viewport]'
                  );
                  const image = document.querySelector<HTMLImageElement>('.docs-image-full');
                  return {
                    mode: viewport?.dataset.docsImageScale,
                    width: image?.style.width,
                    height: image?.style.height,
                    x: viewport?.scrollLeft,
                    y: viewport?.scrollTop,
                  };
                };
                const before = snapshot();
                // Retain obsolete public event producers deliberately. These
                // synthetic negative controls are separate from native input.
                const afterEach = oldButtons.map((button) => {
                  button.dispatchEvent(new CustomEvent('click'));
                  return snapshot();
                });
                return {
                  open: root?.getExposes?.().open?.get?.(),
                  oldConnected: oldButtons.map((button) => button.isConnected),
                  before,
                  afterEach,
                };
              },
              { oldButtons, closeCurrent }
            );
          const leaving = await probeStaleActions(true);
          expect(leaving.open).toBe(false);
          expect(leaving.oldConnected).toEqual([true, true, true]);
          for (const after of leaving.afterEach) expect(after).toEqual(leaving.before);
          await closed(page);
          await trigger.click();
          await entered(page);
          await page
            .locator('.docs-image-full')
            .evaluate((node) => (node as HTMLImageElement).decode());
          const replaced = await probeStaleActions(false);
          expect(replaced.open).toBe(true);
          expect(replaced.oldConnected).toEqual([false, false, false]);
          expect(replaced.before.mode).toBe('reading');
          for (const after of replaced.afterEach) expect(after).toEqual(replaced.before);
          const beforeZoom = (await page.locator('.docs-image-full').boundingBox())!.width;
          await page.locator('[data-docs-image-zoom-in]').click();
          expect((await page.locator('.docs-image-full').boundingBox())!.width).toBeGreaterThan(
            beforeZoom
          );
          records.push({ staleDiagramActions: family, leaving, replaced });
          await capture(page, `diagram-stale-actions-${family}`);
          await page.keyboard.press('Escape');
          await closed(page);
        } finally {
          await Promise.all(oldButtons.map((button) => button.dispose()));
        }
      } finally {
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
      const focusPaint = await trigger
        .locator('[data-docs-image-trigger-surface]')
        .evaluate((el) => ({
          style: getComputedStyle(el).outlineStyle,
          color: getComputedStyle(el).outlineColor,
          width: getComputedStyle(el).outlineWidth,
        }));
      expect(focusPaint.style).toBe('solid');
      expect(focusPaint.width).toBe('2px');
      expect(focusPaint.color).not.toBe('rgba(0, 0, 0, 0)');
      await capture(page, 'forced-colors-keyboard-focus');
      await page.goto(`${baseUrl}/en/whitepaper/6-consistency-boundary/`, {
        waitUntil: 'networkidle',
      });
      await page.locator('.whitepaper-figure [data-docs-image-trigger]').first().click();
      await entered(page);
      await page
        .locator('.docs-image-full')
        .evaluate((node) => (node as HTMLImageElement).decode());
      await page.locator('[data-docs-image-zoom-in]').click();
      await page.keyboard.press('Tab');
      const readingFocus = await readingFocusPaint(page);
      records.push({ forcedColorsReadingFocus: readingFocus });
      await capture(page, 'forced-colors-reading-keyboard-focus');
      await page.keyboard.press('Escape');
      await closed(page);
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
      const trigger = await open(page, 'Vector landscape');
      expect(
        await page
          .locator('[data-docs-image-content]')
          .evaluate((el) => getComputedStyle(el).transitionDuration)
      ).toBe('0s');
      await capture(page, 'reduced-motion-vector');
      await page.keyboard.press('Escape');
      await closed(page);
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
      await trigger.click();
      await entered(page);
      await page.mouse.click(1, 1);
      await closed(page);
      expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
    } finally {
      await capture(page, 'reduced-motion-pointer-return');
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
