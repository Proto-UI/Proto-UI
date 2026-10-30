// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, RUNTIMES, startServer, stopServer } from './browser-harness';
import { revealHeaderPreferences } from './site-header-browser';
import {
  headerPopupSettled,
  readHeaderPopupPaint,
  popupOptionContrast,
} from './header-popup-evidence';
import { measureHeaderPreferenceFocusRing } from './site-header-breakpoint-evidence';

const LABELS = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;
const appearance = process.env.PROTO_UI_HEADER_SELECT_APPEARANCE ?? 'family';
if (appearance !== 'flat' && appearance !== 'family')
  throw new Error('Unknown Header appearance expectation');
const output =
  process.env.PROTO_UI_HEADER_SELECT_EVIDENCE_DIR ??
  (process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'header-select-elevation')
    : undefined);
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const HISTORICAL_FLAT_SHA = '8856a7112e86aa974f2ba388c3b8b70417268394';
if (appearance === 'flat' && sourceSha !== HISTORICAL_FLAT_SHA)
  throw new Error('Historical flat negative is bound only to its immutable baseline');
const subjectRole = appearance === 'flat' ? 'historical-negative' : 'candidate-acceptance';
let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
  if (output) await mkdir(output, { recursive: true });
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

// Arm before changing viewport: do not wait for transitionend or discard early
// overflowing frames. The finite sample window exceeds the actual family
// feedback duration; responsive geometry itself must already be discrete.
async function captureSearchResizeFrames(page: Page, width: number) {
  await page.evaluate((targetWidth) => {
    const state = {
      samples: [] as any[],
      done: false,
      error: null as string | null,
      targetSeenAt: null as number | null,
    };
    const started = performance.now();
    const sample = () => {
      const button = document.querySelector<HTMLElement>('[data-site-header] [data-open-modal]');
      if (!button) throw new Error('Header Search button missing during resize');
      const css = getComputedStyle(button);
      const elapsed = performance.now() - started;
      if (innerWidth === targetWidth && state.targetSeenAt === null) state.targetSeenAt = elapsed;
      state.samples.push({
        time: elapsed,
        viewport: innerWidth,
        width: button.getBoundingClientRect().width,
        clientWidth: button.clientWidth,
        scrollWidth: button.scrollWidth,
        transitionProperty: css.transitionProperty,
        transitionDuration: css.transitionDuration,
        transitionDelay: css.transitionDelay,
        triggerWidth: css.getPropertyValue('--site-search-trigger-width').trim(),
        headerWidth: css.getPropertyValue('--site-header-search-width').trim(),
        copyDisplay: [...button.querySelectorAll('.site-search-label, .site-search-shortcut')].map(
          (element) => getComputedStyle(element).display
        ),
        animations: button.getAnimations().map((animation) => ({
          playState: animation.playState,
          frames: animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [],
        })),
      });
    };
    (window as any).__puiHeaderResizeCapture = { state, sample };
    const tick = () => {
      try {
        sample();
      } catch (error) {
        state.error = String(error);
        state.done = true;
        return;
      }
      if (state.targetSeenAt !== null && performance.now() - started - state.targetSeenAt >= 400)
        state.done = true;
      else if (state.samples.length >= 256) {
        state.error = 'Resize sample cap reached before the complete target viewport window';
        state.done = true;
      } else requestAnimationFrame(tick);
    };
    tick();
  }, width);
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => (window as any).__puiHeaderResizeCapture.sample());
  await page.waitForFunction(() => (window as any).__puiHeaderResizeCapture.state.done, undefined, {
    timeout: 2_000,
  });
  return page.evaluate(() => {
    const value = (window as any).__puiHeaderResizeCapture.state;
    delete (window as any).__puiHeaderResizeCapture;
    return value as {
      samples: Array<{
        time: number;
        viewport: number;
        width: number;
        clientWidth: number;
        scrollWidth: number;
        transitionProperty: string;
        transitionDuration: string;
        transitionDelay: string;
        triggerWidth: string;
        headerWidth: string;
        copyDisplay: string[];
        animations: Array<{ playState: string; frames: Array<Record<string, unknown>> }>;
      }>;
      done: boolean;
      error: string | null;
    };
  });
}

async function ready(page: Page, runtime: string) {
  await page.waitForFunction(
    (runtime) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      return root?.dataset.runtimeState === 'ready' && root.dataset.runtime === runtime;
    },
    runtime,
    { timeout: 30_000 }
  );
}
function trigger(page: Page, id: 'runtime' | 'family') {
  return page.locator(
    `[data-homepage-runtime] [data-projection-control="${id}"] [role="combobox"]`
  );
}
async function choose(page: Page, control: 'runtime' | 'family', label: string) {
  await revealHeaderPreferences(page);
  const select = trigger(page, control);
  await select.click();
  const id = await select.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  await page
    .locator(`[id=${JSON.stringify(id)}]`)
    .getByRole('option', { name: label, exact: true })
    .click();
}
async function sample(select: Locator) {
  await expect
    .poll(() =>
      select.evaluate((element) =>
        element
          .getAnimations({ subtree: true })
          .every(
            (animation) => animation.playState === 'finished' || animation.playState === 'idle'
          )
      )
    )
    .toBe(true);
  return select.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = style.borderTopColor;
    context.fillRect(0, 0, 1, 1);
    const borderAlpha = context.getImageData(0, 0, 1, 1).data[3];
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      shadow: style.boxShadow,
      radius: style.borderTopLeftRadius,
      border: style.borderTopWidth,
      borderColor: style.borderTopColor,
      borderAlpha,
      background: style.backgroundColor,
      tokens: element.getAttribute('data-pui-style'),
      font: style.fontFamily,
      weight: style.fontWeight,
      hit: !!hit && element.contains(hit),
      owner: element.getAttribute('data-projection-owner'),
      generation: element.getAttribute('data-projection-generation'),
      focused: document.activeElement === element,
      focusVisible: element.matches(':focus-visible'),
      pressed: element.hasAttribute('data-pressed'),
    };
  });
}
async function headerLinkPaint(link: Locator) {
  return link.evaluate((anchor) => {
    const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
    const text = surface.querySelector<HTMLElement>('[data-pui-root]')!;
    const paint = getComputedStyle(surface);
    return {
      bounds: surface.getBoundingClientRect().toJSON(),
      tag: anchor.localName,
      href: anchor.getAttribute('href'),
      surface: surface.getAttribute('data-projection-prototype'),
      tokens: surface.getAttribute('data-pui-style'),
      textTokens: text.getAttribute('data-pui-style'),
      border: paint.borderTopWidth,
      shadow: paint.boxShadow,
      transform: paint.transform,
      focused: anchor === document.activeElement,
      nestedInteractive: anchor.querySelectorAll('button, [role="button"], [tabindex]').length,
    };
  });
}
async function keyboardFocus(page: Page, select: Locator) {
  // Escape already returned to this Trigger. Traverse away and back using
  // genuine keyboard input, without DOM focus or synthetic focus-visible state.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  expect(await select.evaluate((element) => document.activeElement === element)).toBe(true);
}

describe.sequential('Header public family presentation and labelled compact fields', () => {
  for (const family of appearance === 'flat' ? ['brutalist'] : ['shadcn', 'brutalist'])
    for (const runtime of RUNTIMES)
      for (const theme of ['light', 'dark'] as const) {
        it(`${family}/${runtime}/${theme}: ${subjectRole}; source-bound rest, hover, native focus, popup and compact reparenting`, async () => {
          const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
            colorScheme: theme,
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          const measurements: unknown[] = [];
          let disposition = 'not-completed';
          const capture = async (state: string) => {
            if (output)
              await page.screenshot({
                path: path.join(output, `${family}-${runtime}-${theme}-${appearance}-${state}.png`),
              });
          };
          try {
            await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
            await ready(page, 'wc');
            if (family === 'brutalist') await choose(page, 'family', 'Brutalist');
            await ready(page, 'wc');
            await page.waitForFunction(
              (family) =>
                document
                  .querySelector('[data-homepage-runtime]')
                  ?.getAttribute('data-site-library-family') === family ||
                document.documentElement.dataset.siteLibraryFamily === family,
              family
            );
            if (runtime !== 'wc') {
              await choose(page, 'runtime', LABELS[runtime]);
              await ready(page, runtime);
            }
            if (appearance === 'family' && family === 'brutalist') {
              const links = page.locator(
                '#home-brand [data-projection-generation-state="active"] a, #home-navigation-desktop [data-projection-generation-state="active"] a'
              );
              expect(await links.count()).toBe(4);
              const restingLinks = await Promise.all(
                [0, 1, 2, 3].map((index) => headerLinkPaint(links.nth(index)))
              );
              const gaps = restingLinks
                .slice(1)
                .map((entry, index) => entry.bounds.left - restingLinks[index].bounds.right);
              // Border-box gap includes the 4px public hard-shadow extent,
              // leaving the same 12px visible gap at each neighbouring control.
              for (const gap of gaps) expect(gap).toBeCloseTo(16, 0);
              measurements.push({ stage: 'header-link-spacing', gaps, restingLinks });
              for (let index = 0; index < 4; index++) {
                const link = links.nth(index);
                await page.mouse.move(0, 900);
                const rest = await headerLinkPaint(link);
                expect(rest.tag).toBe('a');
                expect(rest.href).toBeTruthy();
                expect(rest.surface).toBe('brutalist-surface-root');
                expect(rest.textTokens).toContain('font-sans');
                expect(rest.border).toBe('2px');
                expect(rest.shadow).toContain('4px 4px 0px');
                expect(rest.nestedInteractive).toBe(0);
                await capture(`1440-link-${index}-rest`);
                await link.hover();
                await expect
                  .poll(async () => (await headerLinkPaint(link)).transform)
                  .toBe('matrix(1, 0, 0, 1, 4, 4)');
                const hovered = await headerLinkPaint(link);
                await capture(`1440-link-${index}-hover`);
                await page.mouse.down();
                const pressed = await headerLinkPaint(link);
                expect(pressed.transform).toBe(hovered.transform);
                await capture(`1440-link-${index}-press`);
                await page.mouse.move(0, 900);
                await page.mouse.up();
                await link.focus();
                await page.keyboard.press('Tab');
                await page.keyboard.press('Shift+Tab');
                await expect
                  .poll(async () => {
                    const paint = await headerLinkPaint(link);
                    return paint.focused && paint.tokens?.split(/\s+/).includes('ring-2');
                  })
                  .toBe(true);
                const focused = await headerLinkPaint(link);
                expect(focused.focused).toBe(true);
                expect(focused.tokens).toContain('ring-2');
                await capture(`1440-link-${index}-focus`);
                measurements.push({
                  stage: 'native-header-link',
                  index,
                  rest,
                  hovered,
                  pressed,
                  focused,
                });
              }
            }
            for (const width of [1440, 390]) {
              await page.setViewportSize({ width, height: 1000 });
              await revealHeaderPreferences(page);
              await page.mouse.move(0, 900);
              // Preserve the exact historical label-click procedure. Current
              // compact fields name themselves from hidden semantic content.
              if (appearance === 'flat') {
                await page
                  .locator('[data-homepage-runtime] [data-projection-control-label="runtime"]')
                  .click();
              } else {
                await page.mouse.click(0, 900);
                await revealHeaderPreferences(page);
              }
              for (const control of ['runtime', 'family'] as const) {
                const select = trigger(page, control);
                const rest = await sample(select);
                expect(rest.hit).toBe(true);
                expect(rest.height).toBeCloseTo(44, 0);
                expect(rest.border).toBe(family === 'brutalist' ? '2px' : '1px');
                if (family === 'brutalist') {
                  expect(rest.radius).toBe('5px');
                  expect(rest.weight).toBe('500');
                  expect(rest.font).toContain('DM Sans');
                }
                if (appearance === 'family') {
                  const label = await page
                    .locator('[data-homepage-runtime]')
                    .getAttribute(`data-${control}-label`);
                  const selected =
                    control === 'runtime'
                      ? LABELS[runtime]
                      : family === 'shadcn'
                        ? 'Shadcn'
                        : 'Brutalist';
                  expect(label).toBeTruthy();
                  const accessibility = await select.ariaSnapshot();
                  expect(accessibility).toContain(`combobox "${label}"`);
                  expect(accessibility).toContain(selected);
                  expect(await select.textContent()).toContain(selected);
                  expect(await select.textContent()).not.toContain(label!);
                }
                if (appearance === 'family' && family === 'shadcn') {
                  expect(rest.tokens?.split(/\s+/)).toContain('border-transparent');
                  expect(rest.tokens?.split(/\s+/)).toContain('bg-input/50');
                  expect(rest.borderAlpha).toBe(0);
                }
                expect(rest.shadow.includes('4px 4px 0px 0px')).toBe(
                  appearance === 'family' && family === 'brutalist'
                );
                await capture(`${width}-${control}-rest`);
                await select.hover();
                const hovered = await sample(select);
                expect(hovered.x - rest.x).toBeCloseTo(
                  appearance === 'family' && family === 'brutalist' ? 4 : 0,
                  1
                );
                expect(hovered.y - rest.y).toBeCloseTo(
                  appearance === 'family' && family === 'brutalist' ? 4 : 0,
                  1
                );
                expect(hovered.shadow.includes('4px 4px 0px 0px')).toBe(false);
                expect(hovered.hit).toBe(true);
                await capture(`${width}-${control}-hover`);
                await page.mouse.down();
                const firstPressed = await sample(select);
                measurements.push({
                  stage: 'press-first-sample',
                  width,
                  control,
                  paint: firstPressed,
                });
                const pressedY = hovered.y;
                // React may publish the inherited state before its prop+state
                // visual rule is committed. Keep the exact pose, waiting for
                // the real held press rather than sampling that boundary once.
                await expect.poll(() => select.getAttribute('data-pressed')).not.toBeNull();
                await expect.poll(async () => (await sample(select)).y).toBeCloseTo(pressedY, 1);
                const pressed = await sample(select);
                measurements.push({ stage: 'press-settled', width, control, paint: pressed });
                expect(pressed.pressed).toBe(true);
                expect(pressed.x).toBeCloseTo(hovered.x, 1);
                expect(pressed.y).toBeCloseTo(pressedY, 1);
                await capture(`${width}-${control}-press`);
                await page.mouse.up();
                const id = await select.getAttribute('aria-controls');
                const popup = page.locator(`[id=${JSON.stringify(id)}]`);
                await popup.waitFor({ state: 'visible' });
                measurements.push({
                  stage: 'popup-first-visible',
                  width,
                  control,
                  paint: await popup.evaluate(readHeaderPopupPaint),
                });
                await expect.poll(() => popup.evaluate(headerPopupSettled)).toBe(true);
                const popupPaint = await popup.evaluate(readHeaderPopupPaint);
                measurements.push({ stage: 'popup-settled', width, control, paint: popupPaint });
                expect(popupPaint.opacity).toBe(1);
                // Rhea intentionally has a translucent public Surface; opacity is
                // distinct from background alpha. Do not force an opaque page skin.
                const rhea = appearance === 'family' && family === 'shadcn';
                expect(popupPaint.backgroundRgba[3]).toBeGreaterThanOrEqual(rhea ? 178 : 255);
                expect(popupPaint.backgroundRgba[3]).toBeLessThanOrEqual(rhea ? 179 : 255);
                for (const option of popupPaint.options) {
                  expect(option.opacity).toBe(1);
                  expect(option.colorRgba[3]).toBe(255);
                  expect(
                    Math.min(
                      ...[0, 255].map((backdrop) => {
                        const alpha = popupPaint.backgroundRgba[3] / 255;
                        const composited = popupPaint.backgroundRgba
                          .slice(0, 3)
                          .map((channel) => channel * alpha + backdrop * (1 - alpha));
                        return popupOptionContrast(option.colorRgba, option.backgroundRgba, [
                          ...composited,
                          255,
                        ]);
                      })
                    ),
                    `${family}/${theme}/${width}/${option.text} settled option contrast over both backdrop extremes`
                  ).toBeGreaterThanOrEqual(4.5);
                }

                // Popup paint is owned by the selected native public profile.
                const popupShadow = popupPaint.shadow;
                if (family === 'brutalist') expect(popupShadow).toBe('none');
                else {
                  expect(popupPaint.tokens).toContain('shadow-lg');
                  expect(popupPaint.tokens).toContain('bg-popover/70');
                  expect(popupShadow).not.toBe('none');
                }
                await capture(`${width}-${control}-popup`);
                await page.keyboard.press('Escape');
                await popup.waitFor({ state: 'hidden' });
                await page.waitForFunction(
                  (id) => document.activeElement?.getAttribute('aria-controls') === id,
                  id
                );
                await page.mouse.move(0, 900);
                await keyboardFocus(page, select);
                const focused = await sample(select);
                expect(focused.focused).toBe(true);
                expect(focused.focusVisible).toBe(true);
                expect(focused.shadow).not.toBe(rest.shadow);
                const ring = await select.evaluate(measureHeaderPreferenceFocusRing);
                expect(ring.ringWidth).toBe(family === 'shadcn' ? 3 : 2);
                expect(ring.ringOffset).toBe(family === 'shadcn' ? 0 : 2);
                expect(ring.inViewport).toBe(true);
                if (
                  appearance === 'flat' &&
                  sourceSha === HISTORICAL_FLAT_SHA &&
                  width === 390 &&
                  control === 'runtime'
                ) {
                  // The immutable before revision predates the ring gutter fix.
                  // Reproduce this exact old defect, never call it a healthy
                  // baseline or silently ignore other historical failures.
                  measurements.push({
                    stage: 'historical-negative',
                    width,
                    control,
                    ring,
                    classification: '8856a711-compact-runtime-focus-ring-clipped',
                  });
                  expect(ring.unclipped, 'the exact old clipping must be reproduced').toBe(false);
                  expect(errors).toEqual([]);
                  await capture('390-runtime-historical-clipped-focus-ring');
                  disposition = 'historical-negative-reproduced';
                  return;
                }
                expect(ring.unclipped).toBe(true);
                await capture(`${width}-${control}-focus`);
                const lease = await select.elementHandle();
                await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 1000 });
                await revealHeaderPreferences(page);
                expect(
                  await select.evaluate((current, original) => current === original, lease)
                ).toBe(true);
                const moved = await sample(select);
                expect(moved.owner).toBe(rest.owner);
                expect(moved.generation).toBe(rest.generation);
                expect(moved.focused).toBe(true);
                await page.setViewportSize({ width, height: 1000 });
                await revealHeaderPreferences(page);
                if (appearance === 'flat') {
                  await page
                    .locator('[data-homepage-runtime] [data-projection-control-label="runtime"]')
                    .click();
                } else {
                  await page.mouse.click(0, 900);
                  await revealHeaderPreferences(page);
                }
                measurements.push({ control, width, rest, hovered, pressed, focused, ring, moved });
              }
            }
            if (appearance === 'family') {
              for (const width of [320, 390, 1099, 1100, 1180, 1279, 1280, 1920]) {
                await page.setViewportSize({ width, height: 1000 });
                await revealHeaderPreferences(page);
                const geometry = await page.locator('.site-header').evaluate((header) => {
                  const bounds = header.getBoundingClientRect();
                  const style = getComputedStyle(header);
                  const search = header.querySelector<HTMLElement>('[data-open-modal]')!;
                  const searchBox = search.getBoundingClientRect();
                  return {
                    search: {
                      width: searchBox.width,
                      clientWidth: search.clientWidth,
                      scrollWidth: search.scrollWidth,
                      copyDisplay: [
                        ...search.querySelectorAll('.site-search-label, .site-search-shortcut'),
                      ].map((element) => getComputedStyle(element).display),
                    },
                    left: bounds.left,
                    right: bounds.right,
                    width: bounds.width,
                    paddingLeft: parseFloat(style.paddingLeft),
                    paddingRight: parseFloat(style.paddingRight),
                    viewport: document.documentElement.clientWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    headerScrollWidth: header.scrollWidth,
                    overflowElements: [...document.querySelectorAll<HTMLElement>('body *')]
                      .filter((element) => {
                        const box = element.getBoundingClientRect();
                        return (
                          box.width > 0 &&
                          box.right > document.documentElement.clientWidth + 1 &&
                          getComputedStyle(element).position !== 'fixed'
                        );
                      })
                      .slice(0, 20)
                      .map((element) => ({
                        tag: element.localName,
                        className: element.className,
                        prototype: element.getAttribute('data-projection-prototype'),
                        rect: element.getBoundingClientRect().toJSON(),
                      })),
                  };
                });
                measurements.push({ stage: 'shared-header-width', width, geometry });
                expect(geometry.left).toBeCloseTo(0, 0);
                expect(geometry.right).toBeCloseTo(geometry.viewport, 0);
                expect(geometry.paddingLeft).toBeGreaterThanOrEqual(16);
                expect(geometry.paddingRight).toBeGreaterThanOrEqual(16);
                expect(geometry.headerScrollWidth).toBeLessThanOrEqual(geometry.viewport + 1);
                expect(geometry.search.scrollWidth).toBeLessThanOrEqual(
                  geometry.search.clientWidth + 1
                );
                if (width < 1280) {
                  expect(geometry.search.width).toBeCloseTo(44, 0);
                  expect(geometry.search.copyDisplay).toEqual(['none', 'none']);
                }
                if (geometry.scrollWidth > geometry.viewport + 1)
                  measurements.push({
                    stage: 'unresolved-page-overflow',
                    width,
                    relatedIssue: 933,
                    geometry,
                  });
                const locale = page.locator(
                  '[data-homepage-runtime] [data-projection-control="locale"] [role="combobox"]'
                );
                expect(await locale.count()).toBe(1);
                // The author name is stable; the selected value is a separate
                // AX value/text node, never concatenated into the name.
                expect(await locale.ariaSnapshot()).toBe(
                  family === 'shadcn'
                    ? '- combobox "语言": 简体中文'
                    : '- combobox "语言":\n  - text: 简体中文\n  - img'
                );
                expect(await locale.evaluate((element) => element.localName)).not.toBe('a');
                expect((await sample(locale)).height).toBeCloseTo(44, 0);
                await capture(`${width}-shared-composition`);
              }
              for (const [from, to] of [
                [1279, 1280],
                [1280, 1279],
              ]) {
                await page.setViewportSize({ width: from, height: 1000 });
                await revealHeaderPreferences(page);
                const trace = await captureSearchResizeFrames(page, to);
                measurements.push({ stage: 'responsive-search-every-frame', from, to, trace });
                await capture(`${from}-to-${to}-search-resize`);
                expect(trace.error).toBeNull();
                expect(trace.done).toBe(true);
                const frames = trace.samples.filter((frame) => frame.viewport === to);
                expect(frames.length).toBeGreaterThanOrEqual(2);
                for (const frame of frames) {
                  expect(frame.scrollWidth, `resize frame ${frame.time}ms`).toBeLessThanOrEqual(
                    frame.clientWidth + 1
                  );
                  const properties = frame.transitionProperty
                    .split(',')
                    .map((property) => property.trim());
                  expect(properties).toContain('background-color');
                  expect(properties).toContain('transform');
                  const milliseconds = (value: string) =>
                    value.trim().endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
                  const durations = frame.transitionDuration.split(',').map(milliseconds);
                  const delays = frame.transitionDelay.split(',').map(milliseconds);
                  expect(Math.max(...durations) + Math.max(0, ...delays)).toBeLessThanOrEqual(400);
                  for (const forbidden of [
                    'all',
                    'width',
                    'height',
                    'padding',
                    'padding-inline',
                    '--site-search-trigger-width',
                    '--site-header-search-width',
                  ])
                    expect(properties).not.toContain(forbidden);
                  for (const animation of frame.animations)
                    for (const keyframe of animation.frames)
                      for (const geometry of [
                        'width',
                        'height',
                        'padding',
                        'paddingInline',
                        '--site-search-trigger-width',
                        '--site-header-search-width',
                      ])
                        expect(keyframe).not.toHaveProperty(geometry);
                  if (to < 1280) {
                    expect(frame.width).toBeCloseTo(44, 0);
                    expect(frame.copyDisplay).toEqual(['none', 'none']);
                  } else expect(frame.copyDisplay).toEqual(['block', 'flex']);
                }
                const search = page.locator('[data-site-header] [data-open-modal]');
                expect(
                  await page
                    .locator('[data-site-header]')
                    .getByRole('button', { name: '搜索', exact: true })
                    .count()
                ).toBe(1);
                expect(await search.getAttribute('aria-keyshortcuts')).toMatch(
                  /^(Control|Meta)\+K$/
                );
              }
              if (family === 'brutalist') {
                // The family owns reduced-motion. Restricting responsive
                // properties must not restore a removed transition clock.
                await page.emulateMedia({ reducedMotion: 'reduce' });
                const search = page.locator('[data-site-header] [data-open-modal]');
                await expect
                  .poll(() => search.getAttribute('data-pui-style'))
                  .toContain('transition-none');
                await search.hover();
                const reduced = await search.evaluate((button) => ({
                  duration: getComputedStyle(button).transitionDuration,
                  activeAnimations: button
                    .getAnimations()
                    .filter((animation) => animation.playState === 'running' || animation.pending)
                    .length,
                }));
                measurements.push({ stage: 'responsive-search-reduced-motion', reduced });
                expect(reduced.duration.split(',').map((value) => parseFloat(value))).toEqual([0]);
                expect(reduced.activeAnimations).toBe(0);
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                await expect
                  .poll(() => search.getAttribute('data-pui-style'))
                  .toContain('transition-all');
              }
              // Keep the existing compact original-edge input journey intact.
              await page.setViewportSize({ width: 390, height: 1000 });
              await revealHeaderPreferences(page);
            }
            // Hold the real pointer at the original edge; center-only paint
            // checks cannot detect feedback that moves its own hit owner away.
            const edgeTargets = [
              { id: 'runtime', locator: trigger(page, 'runtime') },
              ...(appearance === 'family'
                ? [
                    {
                      id: 'theme-button',
                      locator: page.locator(
                        '[data-homepage-runtime] .site-header-theme [data-projection-generation-state="active"] [data-demo-ref="home-theme"]'
                      ),
                    },
                  ]
                : []),
            ];
            for (const target of edgeTargets) {
              const edgeSelect = target.locator;
              const physicalOwner = await edgeSelect.elementHandle();
              for (const edge of ['left', 'top'] as const) {
                await page.mouse.move(0, 900);
                await expect
                  .poll(async () => (await edgeSelect.getAttribute('data-hovered')) === null)
                  .toBe(true);
                const before = await sample(edgeSelect);
                const point =
                  edge === 'left'
                    ? { x: before.x + 1, y: before.y + before.height / 2 }
                    : { x: before.x + before.width / 2, y: before.y + 1 };
                await page.mouse.move(point.x, point.y);
                const frames = await edgeSelect.evaluate(async (element, point) => {
                  const result = [];
                  for (let index = 0; index < 120; index++) {
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                    const rect = element.getBoundingClientRect();
                    const hit = document.elementFromPoint(point.x, point.y);
                    result.push({
                      x: rect.x,
                      y: rect.y,
                      hovered: element.hasAttribute('data-hovered'),
                      hit: !!hit && element.contains(hit),
                    });
                  }
                  return result;
                }, point);
                measurements.push({
                  stage: 'original-edge-stability',
                  control: target.id,
                  edge,
                  point,
                  before,
                  frames,
                });
                await capture(`390-${target.id}-${edge}-edge`);
                if (appearance === 'family' && family === 'shadcn') {
                  expect(
                    frames.every(
                      (frame) =>
                        Math.abs(frame.x - before.x) <= 0.5 && Math.abs(frame.y - before.y) <= 0.5
                    )
                  ).toBe(true);
                }
                expect(
                  new Set(
                    frames
                      .slice(-60)
                      .map((frame) => JSON.stringify([frame.x, frame.y, frame.hovered]))
                  ).size,
                  `${edge} original edge must not oscillate between hover and rest`
                ).toBe(1);
                expect(
                  frames.slice(-60).every((frame) => frame.hit),
                  `${edge} original body edge retains its actual interactive owner`
                ).toBe(true);
                if (target.id === 'runtime') {
                  await page.mouse.down();
                  await expect.poll(() => edgeSelect.getAttribute('data-pressed')).not.toBeNull();
                  await page.mouse.up();
                  const popupId = await edgeSelect.getAttribute('aria-controls');
                  await page
                    .locator(`[id=${JSON.stringify(popupId)}]`)
                    .waitFor({ state: 'visible' });
                  await page.keyboard.press('Escape');
                  expect(
                    await edgeSelect.evaluate((element, owner) => element === owner, physicalOwner)
                  ).toBe(true);
                  expect(
                    await edgeSelect.evaluate((element) => document.activeElement === element)
                  ).toBe(true);
                }
              }
            }
            expect(errors).toEqual([]);
            disposition = 'candidate-accepted';
          } catch (error) {
            disposition = 'unexpected-failure';
            try {
              await capture('failure');
            } catch (captureError) {
              console.error('Header failure capture unavailable', captureError);
            }
            throw error;
          } finally {
            if (output)
              await writeFile(
                path.join(output, `${family}-${runtime}-${theme}-${appearance}.json`),
                JSON.stringify(
                  {
                    sourceSha,
                    eventSha: process.env.GITHUB_SHA ?? null,
                    expectedSha:
                      process.env.PROTO_UI_HEADER_SELECT_SUBJECT_SHA ??
                      process.env.PROTO_UI_EXPECTED_REVISION ??
                      null,
                    probeSha: process.env.CANDIDATE_SHA ?? sourceSha,
                    appearance,
                    family,
                    subjectRole,
                    disposition,
                    route: '/zh-cn/',
                    runtime,
                    theme,
                    measurements,
                    errors,
                  },
                  null,
                  2
                )
              );
            await context.close();
          }
        }, 90_000);
      }
});

// A separate docs journey covers the SSR custom-element boundary. These are
// actual animation-frame observations, not DOM geometry mocked by the test.
if (appearance === 'family') {
  describe.sequential('Shared docs Header startup', () => {
    for (const theme of ['light', 'dark'] as const) {
      it(`${theme}: preserves theme geometry from the first observable rendered frame`, async () => {
        const context = await browser.newContext({ colorScheme: theme });
        try {
          await context.addInitScript(() => {
            const observations: unknown[] = [];
            const state = { observations, stop: false };
            Object.assign(window, { __headerStartupEvidence: state });
            const observe = () => {
              const button = document.querySelector<HTMLElement>('[data-theme-toggle]');
              if (button) {
                const rect = button.getBoundingClientRect();
                const paint = getComputedStyle(button);
                if (rect.width > 0 && rect.height > 0)
                  observations.push({
                    time: performance.now(),
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    radius: parseFloat(paint.borderTopLeftRadius),
                    background: paint.backgroundColor,
                    tokens: button.getAttribute('data-pui-style'),
                    defined: button.matches(':defined'),
                  });
              }
              if (!state.stop && observations.length < 1800) requestAnimationFrame(observe);
            };
            requestAnimationFrame(observe);
          });
          for (const width of [320, 390, 1280, 1920]) {
            const page = await context.newPage();
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(`${baseUrl}/zh-cn/ui-libraries/shadcn/button/`, {
              waitUntil: 'domcontentloaded',
            });
            if (output)
              await page.screenshot({
                path: path.join(output, `docs-${theme}-${width}-domcontentloaded.png`),
              });
            await page.waitForFunction(() => {
              const button = document.querySelector('[data-theme-toggle]') as
                | (HTMLElement & { getExposes?: () => { focusSelf?: unknown } })
                | null;
              return typeof button?.getExposes?.().focusSelf === 'function';
            });
            // Prove the mounted public Button accepts native keyboard input;
            // SSR markers alone are not runtime readiness or first feedback.
            const themeButton = page.locator('[data-theme-toggle]');
            for (let tab = 0; tab < 40; tab++) {
              if (await themeButton.evaluate((element) => document.activeElement === element))
                break;
              await page.keyboard.press('Tab');
            }
            expect(
              await themeButton.evaluate((element) => document.activeElement === element)
            ).toBe(true);
            const beforePressed = await themeButton.getAttribute('aria-pressed');
            await page.keyboard.press('Space');
            await expect
              .poll(() => themeButton.getAttribute('aria-pressed'))
              .toBe(beforePressed === 'true' ? 'false' : 'true');
            await page.keyboard.press('Space');
            await expect.poll(() => themeButton.getAttribute('aria-pressed')).toBe(beforePressed);
            const frames = await page.evaluate(async () => {
              // Continue through actual upgrade, activation and a stable window.
              for (let frame = 0; frame < 60; frame++) {
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
              }
              const state = (
                window as unknown as {
                  __headerStartupEvidence: {
                    stop: boolean;
                    observations: Array<{
                      width: number;
                      height: number;
                      y: number;
                      radius: number;
                      tokens: string | null;
                    }>;
                  };
                }
              ).__headerStartupEvidence;
              state.stop = true;
              return state.observations;
            });
            if (output) {
              await writeFile(
                path.join(output, `docs-${theme}-${width}-startup.json`),
                JSON.stringify({ sourceSha, width, theme, frames }, null, 2)
              );
              await page.screenshot({
                path: path.join(output, `docs-${theme}-${width}-ready.png`),
              });
            }
            expect(
              frames.length,
              'no first-frame observation is not passing evidence'
            ).toBeGreaterThan(0);
            expect(
              frames.length,
              'sampling must not exhaust its bound before runtime readiness'
            ).toBeLessThan(1800);
            for (const frame of frames) {
              expect(frame.width).toBeCloseTo(44, 0);
              expect(frame.height).toBeCloseTo(44, 0);
              expect(frame.y).toBeGreaterThan(0);
              expect(frame.radius).toBeGreaterThan(0);
              expect(
                frame.tokens
                  ?.split(/\s+/)
                  .some((token) => token === 'bg-primary' || token === 'bg-primary/80')
              ).toBe(false);
              expect(frame.tokens?.split(/\s+/).includes('bg-secondary')).toBe(true);
            }
            await page.close();
          }
        } finally {
          await context.close();
        }
      }, 90_000);
    }
  });
}
