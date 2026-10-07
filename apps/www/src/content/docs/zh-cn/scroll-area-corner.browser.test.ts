// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { computedRgbAlpha } from './scroll-area-corner-color';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const families = [
  {
    name: 'brutalist',
    route: '/en/ui-libraries/brutalist/components/scroll-area/',
    vertical: 'scrollbar',
    horizontal: 'scrollbarHorizontal',
    vThumb: 'thumb',
    hThumb: 'thumbHorizontal',
    thickness: 16,
  },
  {
    name: 'shadcn',
    route: '/zh-cn/ui-libraries/shadcn/scroll-area/',
    vertical: 'verticalScrollbar',
    horizontal: 'horizontalScrollbar',
    vThumb: 'verticalThumb',
    hThumb: 'horizontalThumb',
    thickness: 10,
  },
] as const;
const INSET = '--proto-ui-scroll-track-end-inset';
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let browser: Browser;
let baseUrl: string;

async function rect(locator: Locator) {
  // Document coordinates avoid confusing a focus/scroll-into-view page move
  // with a change to the component's own geometry.
  return locator.evaluate((element) => {
    const r = element.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
  });
}
const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);

beforeAll(async () => {
  baseUrl = await startServer(families[0].route);
  browser = await launchBrowser();
}, 180_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('styled Scroll Area corner / actual family geometry', () => {
  it.each(families)(
    '$name reserves a non-control corner through layout, overflow, focus, and drag transitions',
    async (family) => {
      const context = await browser.newContext({
        viewport: { width: 1100, height: 900 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${family.route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        });
        const previewer = page.locator('[data-previewer-id]').first();
        await previewer.waitFor({ state: 'visible', timeout: 120_000 });
        for (const runtime of RUNTIMES) {
          await selectRuntime(page, previewer, runtime, '[data-demo-ref="scrollViewport"]', 1);
          await page.keyboard.press('Escape');
          const part = (name: string) => previewer.locator(`[data-demo-ref="${name}"]`);
          const viewport = part('scrollViewport');
          const root = viewport.locator('xpath=..');
          const vertical = part(family.vertical),
            horizontal = part(family.horizontal);
          const vThumb = part(family.vThumb),
            hThumb = part(family.hThumb);
          await root.scrollIntoViewIfNeeded();
          const output = process.env.PROTO_UI_SCROLL_CORNER_EVIDENCE_DIR;
          const capture = async (state: string, facts: unknown) => {
            if (!output) return;
            await mkdir(output, { recursive: true });
            const stem = `${family.name}-${runtime}-${state}`;
            await root.screenshot({ path: path.join(output, `${stem}.png`) });
            await writeFile(
              path.join(output, `${stem}.json`),
              JSON.stringify(
                {
                  sourceSha,
                  browser: browser.version(),
                  capturedAt: new Date().toISOString(),
                  viewport: page.viewportSize(),
                  colorScheme: await page.evaluate(() => document.documentElement.dataset.theme),
                  harnessSha: process.env.PROTO_UI_SCROLL_CORNER_HARNESS_SHA ?? sourceSha,
                  mode:
                    process.env.PROTO_UI_SCROLL_CORNER_CAPTURE_ONLY === '1'
                      ? 'baseline-capture-only'
                      : 'candidate-regression',
                  family: family.name,
                  runtime,
                  state,
                  facts,
                  thumbPaint: await Promise.all(
                    [vThumb, hThumb].map((thumb) =>
                      thumb.evaluate((el) => {
                        const box = el.getBoundingClientRect();
                        const style = getComputedStyle(el);
                        return {
                          x: box.x + scrollX,
                          y: box.y + scrollY,
                          width: box.width,
                          height: box.height,
                          boxSizing: style.boxSizing,
                          backgroundClip: style.backgroundClip,
                          background: style.backgroundColor,
                          borderColor: style.borderTopColor,
                          borderWidth: style.borderTopWidth,
                          borderStyle: style.borderTopStyle,
                        };
                      })
                    )
                  ),
                },
                null,
                2
              )
            );
          };
          if (process.env.PROTO_UI_SCROLL_CORNER_CAPTURE_ONLY === '1') {
            await expect
              .poll(() => viewport.getAttribute('data-pui-scroll-projection'))
              .toBe('composed');
            await expect
              .poll(() =>
                vThumb.evaluate((el) => el.style.getPropertyValue('--proto-ui-scroll-thumb-size'))
              )
              .not.toBe('');
            await capture('initial', {
              vertical: await rect(vertical),
              horizontal: await rect(horizontal),
              viewport: await rect(viewport),
            });
            await viewport.evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
            await capture('end', { viewport: await rect(viewport) });
            if (family.name === 'shadcn') {
              await applyColorScheme(page, 'dark');
              await capture('end-dark', { viewport: await rect(viewport) });
              await applyColorScheme(page, 'light');
            }
            continue;
          }
          await expect
            .poll(() => vertical.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe(`${family.thickness}px`);
          await expect
            .poll(() => horizontal.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe(`${family.thickness}px`);
          const before = await rect(viewport);
          const passive = horizontal.locator(
            ':scope > span[data-pui-style~="pointer-events-none"]'
          );
          const readPassive = () =>
            passive.evaluate((outer) => {
              const inner = outer.firstElementChild!;
              const r = outer.getBoundingClientRect();
              const outerStyle = getComputedStyle(outer),
                innerStyle = getComputedStyle(inner);
              return {
                x: r.x + scrollX,
                y: r.y + scrollY,
                width: r.width,
                height: r.height,
                overflow: outerStyle.overflow,
                pointerEvents: outerStyle.pointerEvents,
                innerPointerEvents: innerStyle.pointerEvents,
                background: innerStyle.backgroundColor,
                borderColor: innerStyle.borderLeftColor,
                borderStyle: innerStyle.borderLeftStyle,
                borderLeft: innerStyle.borderLeftWidth,
                borderTop: innerStyle.borderTopWidth,
                carrier: inner.getAttribute('data-pui-style'),
                hasControlIdentity: [outer, inner].some(
                  (node) =>
                    node.hasAttribute('data-pui-root') ||
                    node.hasAttribute('role') ||
                    node.hasAttribute('tabindex')
                ),
              };
            });
          await capture('before-corner-assertions', { privateSurfaceCount: await passive.count() });
          const checkCorner = async () => {
            const [v, h, surface] = await Promise.all([
              rect(vertical),
              rect(horizontal),
              rect(viewport),
            ]);
            close(v.width, family.thickness);
            close(h.height, family.thickness);
            close(v.y + v.height, h.y);
            close(h.x + h.width, v.x);
            close(v.height + h.height, surface.height);
            close(h.width + v.width, surface.width);
            const hit = await page.evaluate(
              ({ vRef, hRef }) => {
                const v = document.querySelector(`[data-demo-ref="${vRef}"]`)!,
                  h = document.querySelector(`[data-demo-ref="${hRef}"]`)!;
                const vr = v.getBoundingClientRect(),
                  hr = h.getBoundingClientRect();
                const target = document.elementFromPoint(
                  vr.left + vr.width / 2,
                  hr.top + hr.height / 2
                );
                return {
                  found: Boolean(target),
                  inRoot: Boolean(target && v.parentElement?.contains(target)),
                  isControl: Boolean(target && (v.contains(target) || h.contains(target))),
                };
              },
              { vRef: family.vertical, hRef: family.horizontal }
            );
            expect(hit).toEqual({ found: true, inRoot: true, isControl: false });
            if (family.name === 'shadcn') {
              expect(await passive.count()).toBe(0);
              const paint = await root.evaluate((el) => {
                const viewport = el.querySelector('[data-demo-ref="scrollViewport"]')!;
                const rootStyle = getComputedStyle(el);
                return {
                  rootRadius: rootStyle.borderBottomRightRadius,
                  viewportRadius: getComputedStyle(viewport).borderBottomRightRadius,
                  background: rootStyle.backgroundColor,
                };
              });
              expect(parseFloat(paint.rootRadius)).toBeGreaterThan(0);
              expect(paint.viewportRadius).toBe(paint.rootRadius);
              const trackPaint: Array<{ background: string; alpha: number | null }> = [];
              for (const track of [vertical, horizontal]) {
                const background = await track.evaluate(
                  (el) => getComputedStyle(el).backgroundColor
                );
                const alpha = computedRgbAlpha(background);
                expect(alpha, `computed track background: ${background}`).toBe(0);
                trackPaint.push({ background, alpha });
                expect(
                  await track
                    .locator(':scope > span[data-pui-style~="pointer-events-none"]')
                    .count()
                ).toBe(0);
              }
              return {
                vertical: v,
                horizontal: h,
                viewport: surface,
                hit,
                continuousCorner: paint,
                trackPaint,
              };
            }
            expect(await passive.count()).toBe(1);
            expect(
              await vertical.locator(':scope > span[data-pui-style~="pointer-events-none"]').count()
            ).toBe(0);
            const paint = await readPassive();
            close(paint.x, v.x);
            close(paint.y, h.y);
            close(paint.width, v.width);
            close(paint.height, h.height);
            expect(paint.pointerEvents).toBe('none');
            expect(paint.innerPointerEvents).toBe('none');
            expect(paint.overflow).toBe('hidden');
            expect(paint.hasControlIdentity).toBe(false);
            expect(paint.background).not.toBe('rgba(0, 0, 0, 0)');
            expect(paint.background).not.toBe('transparent');
            expect(paint.carrier).toContain('bg-lavender');
            expect(paint.borderColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(paint.borderStyle).toBe('solid');
            expect(paint.borderLeft).toBe('2px');
            expect(paint.borderTop).toBe('2px');
            return { vertical: v, horizontal: h, viewport: surface, hit, passive: paint };
          };
          const initial = await checkCorner();
          await capture('initial', initial);
          if (family.name === 'shadcn') {
            for (const [axis, thumb] of [
              ['vertical', vThumb],
              ['horizontal', hThumb],
            ] as const) {
              const style = await thumb.evaluate((el) => {
                const s = getComputedStyle(el);
                return {
                  boxSizing: s.boxSizing,
                  backgroundClip: s.backgroundClip,
                  borderWidth: s.borderTopWidth,
                  borderColor: s.borderTopColor,
                };
              });
              expect(style.boxSizing).toBe('border-box');
              expect(style.backgroundClip).toBe('border-box');
              expect(style.borderWidth).toBe('1px');
              expect(computedRgbAlpha(style.borderColor)).toBe(0);
              const box = await rect(thumb);
              close(axis === 'vertical' ? box.width : box.height, 6);
            }
          }
          // Real input exercises the shortened travel through the shared Move host.
          for (const [axis, thumb] of [
            ['vertical', vThumb],
            ['horizontal', hThumb],
          ] as const) {
            await thumb.scrollIntoViewIfNeeded();
            const box = await thumb.boundingBox();
            if (!box) throw new Error(`${family.name}/${runtime}/${axis}: missing Thumb`);
            const x = box.x + box.width / 2,
              y = box.y + box.height / 2;
            await page.mouse.move(x, y);
            // Keep a failed hit diagnostic rather than turning overlay
            // interception into a false Scroll/Move failure or a forced click.
            const hit = await thumb.evaluate(
              (element, point) => {
                const target = document.elementFromPoint(point.x, point.y);
                return {
                  onThumb: Boolean(target && element.contains(target)),
                  tag: target?.tagName ?? null,
                };
              },
              { x, y }
            );
            expect(hit.onThumb, `${family.name}/${runtime}/${axis}: pointer hit ${hit.tag}`).toBe(
              true
            );
            await page.mouse.down();
            await page.mouse.move(
              x + (axis === 'horizontal' ? 700 : 0),
              y + (axis === 'vertical' ? 700 : 0),
              { steps: 8 }
            );
            await page.mouse.up();
            await expect
              .poll(() =>
                viewport.evaluate(
                  (el, orientation) =>
                    orientation === 'vertical'
                      ? el.scrollHeight - el.clientHeight - el.scrollTop
                      : el.scrollWidth - el.clientWidth - el.scrollLeft,
                  axis
                )
              )
              .toBeLessThanOrEqual(1);
            const [t, track] = await Promise.all([
              rect(thumb),
              rect(axis === 'vertical' ? vertical : horizontal),
            ]);
            expect(t.x).toBeGreaterThanOrEqual(track.x);
            expect(t.y).toBeGreaterThanOrEqual(track.y);
            expect(t.x + t.width).toBeLessThanOrEqual(track.x + track.width + 0.5);
            expect(t.y + t.height).toBeLessThanOrEqual(track.y + track.height + 0.5);
          }
          await root.scrollIntoViewIfNeeded();
          const end = await checkCorner();
          await capture('end', end);
          if (family.name === 'shadcn') {
            await applyColorScheme(page, 'dark');
            await capture('end-dark', await checkCorner());
            await applyColorScheme(page, 'light');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await capture('end-reduced-motion', await checkCorner());
            await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
            await capture('end-forced-colors-before-assertions', {
              viewport: await rect(viewport),
            });
            // Retain actual forced-color output for separate visible-indicator review.
            // Geometry passing alone is not a contrast or paint certification.
            const forcedThumbs = await Promise.all(
              [vThumb, hThumb].map((thumb) =>
                thumb.evaluate((el) => {
                  const style = getComputedStyle(el);
                  return {
                    background: style.backgroundColor,
                    borderColor: style.borderTopColor,
                    borderWidth: style.borderTopWidth,
                    borderStyle: style.borderTopStyle,
                    display: style.display,
                    forcedColorAdjust: style.forcedColorAdjust,
                  };
                })
              )
            );
            const forcedSurface = await root.evaluate((el) => getComputedStyle(el).backgroundColor);
            await capture('end-forced-colors', {
              geometry: await checkCorner(),
              surface: forcedSurface,
              thumbs: forcedThumbs,
            });
            for (const paint of forcedThumbs) {
              expect(paint.display).not.toBe('none');
              expect(paint.borderWidth).toBe('1px');
              expect(paint.borderStyle).toBe('solid');
              expect(computedRgbAlpha(paint.borderColor)).toBe(1);
              expect(paint.borderColor).not.toBe(forcedSurface);
              expect(paint.forcedColorAdjust).toBe('auto');
            }
            await page.emulateMedia({ forcedColors: 'none' });
          }
          await page.keyboard.press('Tab');
          await viewport.focus();
          expect(await viewport.evaluate((el) => document.activeElement === el)).toBe(true);
          const focused = await rect(viewport);
          for (const key of ['x', 'y', 'width', 'height'] as const)
            close(focused[key], before[key]);
          await capture('end-focused', { end, focused });
          // Deliberate author-style mutations exercise the observer, not a second
          // fixture implementation. Restore every mutation before changing runtime.
          await horizontal.evaluate((el) => el.style.setProperty('display', 'none', 'important'));
          await expect
            .poll(() => vertical.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe('0px');
          close((await rect(vertical)).height, before.height);
          await horizontal.evaluate((el) => el.style.removeProperty('display'));
          await expect
            .poll(() => vertical.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe(`${family.thickness}px`);
          await vertical.evaluate((el) => el.style.setProperty('display', 'none', 'important'));
          await expect
            .poll(() => horizontal.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe('0px');
          close((await rect(horizontal)).width, before.width);
          if (family.name === 'brutalist') {
            const zeroReservation = await readPassive();
            close(zeroReservation.width, 0);
            expect(zeroReservation.overflow).toBe('hidden');
            await capture('zero-reservation', { passive: zeroReservation });
          } else {
            expect(await passive.count()).toBe(0);
            await capture('zero-reservation', { privateSurfaceCount: 0 });
          }
          await vertical.evaluate((el) => el.style.removeProperty('display'));
          await expect
            .poll(() => horizontal.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe(`${family.thickness}px`);
          await vertical.evaluate((el) => (el.style.width = '22.5px'));
          await expect
            .poll(() => horizontal.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe('22.5px');
          const resized = await rect(horizontal);
          close(resized.width + 22.5, before.width);
          if (family.name === 'brutalist') {
            const fractionalCorner = await readPassive();
            close(fractionalCorner.width, 22.5);
            close(fractionalCorner.x, resized.x + resized.width);
            await capture('fractional-reservation', {
              horizontal: resized,
              passive: fractionalCorner,
            });
          } else {
            expect(await passive.count()).toBe(0);
            await capture('fractional-reservation', {
              horizontal: resized,
              privateSurfaceCount: 0,
            });
          }
          await vertical.evaluate((el) => el.style.removeProperty('width'));
          await expect
            .poll(() => horizontal.evaluate((el, key) => el.style.getPropertyValue(key), INSET))
            .toBe(`${family.thickness}px`);
          const content = viewport.locator(':scope > *').first();
          await content.evaluate((el) => ((el as HTMLElement).style.display = 'none'));
          await expect.poll(() => viewport.getAttribute('tabindex')).toBe('-1');
          await expect
            .poll(() => vThumb.evaluate((el) => getComputedStyle(el).display))
            .toBe('none');
          await expect
            .poll(() => hThumb.evaluate((el) => getComputedStyle(el).display))
            .toBe('none');
          await checkCorner();
          await content.evaluate((el) => (el as HTMLElement).style.removeProperty('display'));
          await expect.poll(() => viewport.getAttribute('tabindex')).toBe('0');
          await expect
            .poll(() => vThumb.evaluate((el) => getComputedStyle(el).display))
            .not.toBe('none');
          await checkCorner();
          if (family.name === 'shadcn') {
            // Exercise the existing Web host's 18px minimum without changing
            // its geometry implementation or adding a portable size guarantee.
            const originalSize = await content.evaluate((el) => {
              const style = (el as HTMLElement).style;
              const original = { width: style.width, height: style.height };
              style.width = '10000px';
              style.height = '10000px';
              return original;
            });
            await viewport.evaluate((el) => el.scrollTo(0, 0));
            for (const thumb of [vThumb, hThumb]) {
              await expect
                .poll(() =>
                  thumb.evaluate((el) => el.style.getPropertyValue('--proto-ui-scroll-thumb-size'))
                )
                .toBe('18px');
              await expect
                .poll(() =>
                  thumb.evaluate((el) =>
                    el.style.getPropertyValue('--proto-ui-scroll-thumb-offset')
                  )
                )
                .toBe('0px');
            }
            close((await rect(vThumb)).height, 18);
            close((await rect(hThumb)).width, 18);
            await capture('minimum-thumbs-start', await checkCorner());
            await viewport.evaluate((el) => el.scrollTo(el.scrollWidth, el.scrollHeight));
            await expect
              .poll(() =>
                viewport.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)
              )
              .toBeLessThanOrEqual(1);
            const [v, h, vt, ht] = await Promise.all([
              rect(vertical),
              rect(horizontal),
              rect(vThumb),
              rect(hThumb),
            ]);
            close(vt.y + vt.height, v.y + v.height - 2);
            close(ht.x + ht.width, h.x + h.width - 2);
            await capture('minimum-thumbs-end', await checkCorner());
            await content.evaluate((el, original) => {
              const style = (el as HTMLElement).style;
              style.width = original.width;
              style.height = original.height;
            }, originalSize);
          }
        }
      } finally {
        await context.close();
      }
    },
    240_000
  );
});
