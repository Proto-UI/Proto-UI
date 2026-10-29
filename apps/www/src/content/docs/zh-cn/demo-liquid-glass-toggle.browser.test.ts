// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type CDPSession, type Locator, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isUnpaintedBootstrapBoxShadow as isUnpaintedComposedShadow } from './bootstrap-disabled-paint';
import { observeLiquidToggleSnapshot } from './liquid-toggle-snapshot';
import type { runLiquidToggleTintProbe } from './liquid-toggle-tint-probe';
import type { runLiquidToggleDetailProbe } from './liquid-toggle-detail-probe';
import { deadline } from '../../../../scripts/diagnose-select-click';
import {
  attachLiquidToggleFailureDiagnostics,
  readLiquidToggleTriggerFacts,
} from './liquid-toggle-failure-diagnostics';
import {
  RUNTIMES,
  choosePreviewRuntime,
  runtimeSelectTrigger,
  chromeExecutable,
  startServer,
  stopServer,
} from './browser-harness';

// P-BASE-TOGGLE: active/pressed separation, controlled requests, keyboard/focus and disabled.
// P-LIQUID-GLASS-TOGGLE: fixed selection geometry, regular material in both active states,
// shared provider admission, opaque/restrictive-preference fallback and direct Base ownership.
const route = '/en/test/liquid-glass-toggle/';
const evidenceRoot = process.env.PROTO_UI_MATERIAL_EVIDENCE_DIR;
const output = evidenceRoot ? path.join(evidenceRoot, 'toggle') : undefined;
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const source = {
  sourceSha,
  sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
  patchSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', '--binary', 'HEAD']))
    .digest('hex'),
};
let browser: Browser;
let baseUrl: string;
const results: unknown[] = [];
const safePreferences = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};

beforeAll(async () => {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA || !output)
    throw new Error('Toggle native browser evidence requires official exact-head GitHub Actions');
  expect(sourceSha).toBe(process.env.CANDIDATE_SHA);
  expect(execFileSync('git', ['diff', '--binary', 'HEAD']).length).toBe(0);
  expect(
    execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim()
  ).toBe('');
  if (process.env.PROTO_UI_BROWSER_BASE_URL) throw new Error('Use this job own loopback server');
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, 'source.json'),
    JSON.stringify({ ...source, status: 'Planned; not acceptance until Vitest completes' }, null, 2)
  );
  baseUrl = await startServer([
    route,
    '/en/ui-libraries/liquid-glass/toggle/',
    '/zh-cn/ui-libraries/liquid-glass/toggle/',
  ]);
  browser = await chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
}, 150_000);
afterAll(async () => {
  try {
    if (output)
      await writeFile(
        path.join(output, 'results.json'),
        JSON.stringify(
          {
            ...source,
            browser: browser?.version(),
            node: process.version,
            route,
            results,
            scope:
              'Real Web Adapter browser input and shared self-optical provider; not Apple, GPUI, packed or full Compiler parity. Vitest terminal verdict is authoritative.',
          },
          null,
          2
        )
      );
  } finally {
    try {
      await browser?.close();
    } finally {
      await stopServer();
    }
  }
}, 60_000);

async function preferences(cdp: CDPSession, theme: string, extra: Record<string, string> = {}) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: Object.entries({ ...safePreferences, 'prefers-color-scheme': theme, ...extra }).map(
      ([name, value]) => ({ name, value })
    ),
  });
}
async function newPage(theme = 'light') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  // Only the owned local fixture and its assets can be requested; no account or external requests.
  await context.route('**/*', (request) =>
    new URL(request.request().url()).origin === new URL(baseUrl).origin
      ? request.continue()
      : request.abort()
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const cdp = await context.newCDPSession(page);
  await preferences(cdp, theme);
  return { context, page, cdp };
}
async function fixture(page: Page, runtime: string, operation: string, ...args: unknown[]) {
  return page.evaluate(
    ({ runtime, operation, args }) =>
      (window as any).liquidToggleFixture[operation](runtime, ...args),
    { runtime, operation, args }
  );
}
async function state(page: Page, runtime: string, ref: string, key: string) {
  return fixture(page, runtime, 'state', ref, key);
}
async function quality(target: Locator, expected: string) {
  await expect
    .poll(() => target.getAttribute('data-material-quality'), { timeout: 30_000 })
    .toBe(expected);
}
async function observe(target: Locator) {
  return target.evaluate(observeLiquidToggleSnapshot);
}
function expectedPalette(theme: string) {
  return theme === 'dark'
    ? {
        primary: [10, 108, 219, 255],
        primaryForeground: [255, 255, 255, 255],
        secondary: [44, 44, 46, 255],
        secondaryForeground: [245, 245, 247, 255],
      }
    : {
        primary: [0, 97, 204, 255],
        primaryForeground: [255, 255, 255, 255],
        secondary: [255, 255, 255, 255],
        secondaryForeground: [29, 29, 31, 255],
      };
}
function opaqueState(facts: Awaited<ReturnType<typeof observe>>, theme: string, active: boolean) {
  const palette = expectedPalette(theme);
  expect(facts.active).toBe(String(active));
  expect(facts.background).toEqual(active ? palette.primary : palette.secondary);
  expect(facts.foreground).toEqual(
    active ? palette.primaryForeground : palette.secondaryForeground
  );
  expect(facts.fallbackContrast).toBeGreaterThanOrEqual(4.5);
}

function optical(facts: Awaited<ReturnType<typeof observe>>) {
  expect(facts.quality).toBe('self-optical');
  expect(facts.source).toBe('visible-app-canvas');
  expect(facts.backdropFilter).toBe('none');
  expect(facts.childCanvases).toBe(0);
  expect(facts.uri).toBeTruthy();
  expect(facts.carrier).toMatchObject({
    marker: 'contact-v1',
    content: '""',
    pointerEvents: 'none',
    zIndex: '-1',
    visibility: 'visible',
    opacity: '1',
  });
  expect(facts.carrier.image).toBe(facts.image);
  expect(facts.receipt.ownedImage).toBe(facts.image);
  expect(facts.receipt.frame).toMatch(/^\d+$/);
  expect(facts.snapshot.verifiedAfterDecode).toBe(true);
  expect(facts.hostImage).toBe('none');
  expect(facts.pixels!.uniqueColors).toBeGreaterThan(20);
  expect(facts.pixels!.max - facts.pixels!.min).toBeGreaterThan(5);
  expect(facts.border).toEqual(['1px', '1px', '1px', '1px']);
  expect(facts.receipt.profile).toBe(
    facts.active === 'true' ? 'pui-regular-style-tint-contact-5' : 'liquidgl-v2-contact-canvas-1'
  );
}
async function capture(
  name: string,
  subject: Locator,
  entries: unknown[],
  details: Record<string, unknown> = {}
) {
  const marker = subject.locator('svg[aria-hidden="true"]:has(path[d="m13 4-7 8-3-3"])');
  await expect.poll(() => marker.count()).toBe(1);
  await expect
    .poll(async () => marker.evaluate((el) => getComputedStyle(el).opacity))
    .toBe((await subject.getAttribute('aria-pressed')) === 'true' ? '1' : '0');
  const facts = await observe(subject);
  const selectionMarker = await marker.evaluate((el) => {
    const css = getComputedStyle(el),
      box = el.getBoundingClientRect();
    const pixel = document.createElement('canvas');
    pixel.width = pixel.height = 1;
    const context = pixel.getContext('2d');
    if (!context) throw new Error('Marker color observation requires a 2D context');
    context.fillStyle = css.stroke;
    context.fillRect(0, 0, 1, 1);
    return {
      opacity: css.opacity,
      stroke: css.stroke,
      strokeRgba: Array.from(context.getImageData(0, 0, 1, 1).data),
      hiddenFromAccessibility: el.getAttribute('aria-hidden'),
      width: box.width,
      height: box.height,
      pointerEvents: css.pointerEvents,
    };
  });
  const contentGeometry = await subject.evaluate((host) => {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const boxes: DOMRect[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || node.parentElement?.closest('svg')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) boxes.push(box);
    }
    const icon = host.querySelector('[data-liquid-toggle-icon-content]');
    const iconBox = icon?.getBoundingClientRect();
    const contentBoxes = iconBox ? [iconBox] : boxes;
    if (!contentBoxes.length || contentBoxes.some((box) => box.width <= 0 || box.height <= 0))
      return null;
    const outer = host.getBoundingClientRect();
    const left = Math.min(...contentBoxes.map((box) => box.left));
    const right = Math.max(...contentBoxes.map((box) => box.right));
    return {
      kind: iconBox ? 'icon' : 'text',
      centerOffset: (left + right - outer.left - outer.right) / 2,
    };
  });
  const paint = facts.paint;

  const { uri, image, paint: _paint, receipt: _receipt, ...summary } = facts;
  const { ownedImage, ...receipt } = facts.receipt;
  let screenshotSha256: string | undefined;
  let materialSha256: string | undefined;
  if (output) {
    const shot = await subject.screenshot({ path: path.join(output, `${name}.png`) });
    screenshotSha256 = createHash('sha256').update(shot).digest('hex');
    if (uri) {
      const png = Buffer.from(uri.split(',')[1], 'base64');
      materialSha256 = createHash('sha256').update(png).digest('hex');
      await writeFile(path.join(output, `${name}-material.png`), png);
    }
  }
  const { image: committedImage, ...paintObservation } = paint;
  const { image: carrierImage, ...carrierObservation } = summary.carrier;
  const entry = {
    name,
    ...details,
    ...summary,
    selectionMarker,
    contentGeometry,
    carrier: carrierObservation,
    receipt,
    screenshotTiming:
      'Native screenshot follows the verified optical sample; a dynamic scene may advance.',
    paint: paintObservation,
    screenshotSha256,
    materialSha256,
  };
  entries.push(entry);
  if (output)
    await writeFile(
      path.join(output, `${name}.json`),
      JSON.stringify({ ...source, ...entry }, null, 2)
    );
  // Persist the frozen observation before assertions so a rejected ROI remains diagnosable.
  expect(selectionMarker.opacity).toBe(facts.active === 'true' ? '1' : '0');
  expect(selectionMarker.hiddenFromAccessibility).toBe('true');
  expect(selectionMarker.width).toBe(12);
  expect(selectionMarker.height).toBe(12);
  expect(selectionMarker.pointerEvents).toBe('none');
  expect(contentGeometry, 'Every named text/icon capture requires measurable content').not.toBeNull();
  expect(Math.abs(contentGeometry!.centerOffset)).toBeLessThanOrEqual(1);
  expect(facts.underline).toBe('none');
  expect(selectionMarker.strokeRgba).toEqual(facts.foreground);
  if (facts.quality === 'self-optical') {
    expect(paint.committed).toBe(true);
    expect(paint.geometryMatches).toBe(true);
    expect(facts.snapshot.verifiedAfterDecode).toBe(true);
    expect(facts.foreground[3]).toBe(255);
    expect(facts.fallbackContrast).toBeNull();
    expect(facts.pixels!.content.contentPixels).toBeGreaterThan(0);
    expect(facts.pixels!.content.validPixels).toBeGreaterThan(0);
    expect(facts.pixels!.content.opaquePixels).toBe(facts.pixels!.content.contentPixels);
    expect(facts.pixels!.content.partialAlphaPixels).toBe(0);
    expect(facts.pixels!.content.transparentPixels).toBe(0);
    expect(facts.pixels!.content.foreground).toEqual(facts.foreground);
    expect(facts.pixels!.content.minForegroundContrast).toBeGreaterThanOrEqual(4.5);
    if (facts.active === 'true') {
      expect(facts.foreground).toEqual(facts.palette.primaryForeground);
      expect(facts.receipt.profile).toBe(
        facts.carrier.marker === 'contact-v1'
          ? 'pui-regular-style-tint-contact-5'
          : 'pui-regular-style-tint-5'
      );
      // Selected tint remains accent-directed, but environmental hue/brightness
      // must not be constrained to an almost constant distance from solid blue.
      const mean = facts.pixels!.tint.meanRgb;
      if (!mean) throw new Error('Selected content has no measured mean RGB');
      expect(mean[2]).toBeGreaterThan(mean[0]);
      expect(mean[2]).toBeGreaterThan(mean[1]);
    } else expect(facts.foreground).toEqual(facts.palette.secondaryForeground);
  }
  return { ...facts, selectionMarker };
}

// Both selection directions are measured on the same retained native host.
describe.sequential('Liquid Toggle native input and self-optical material', () => {
  for (const runtime of RUNTIMES)
    for (const theme of ['light', 'dark'] as const)
      it(`${runtime}/${theme}: same-node selection, pointer/keyboard, controlled/disabled and fallback`, async () => {
        const { context, page, cdp } = await newPage(theme);
        const observations: unknown[] = [];
        let failure: string | null = null;
        try {
          await page.goto(`${baseUrl}${route}?theme=${theme}`, { waitUntil: 'networkidle' });
          await page.waitForFunction(
            () => document.documentElement.dataset.liquidToggleReady === 'true',
            undefined,
            { timeout: 60_000 }
          );
          await page.evaluate(() => (window as any).liquidToggleFixture.pause(true));
          const host = page.locator(`[data-toggle-host="${runtime}"]`);
          const subject = (ref: string) => host.locator(`[data-demo-ref="${ref}"]`);
          const target = subject('regular');
          await quality(target, 'self-optical');
          const identity = await target.elementHandle();
          const inactive = await capture(`${runtime}-${theme}-inactive`, target, observations);
          optical(inactive);
          expect(inactive.active).toBe('false');
          expect(inactive.underline).toBe('none');
          expect(inactive.palette).toEqual(expectedPalette(theme));
          expect(inactive.foreground).toEqual(expectedPalette(theme).secondaryForeground);
          await quality(subject('initial-active'), 'self-optical');
          await quality(subject('controlled'), 'self-optical');
          const layout = await host.locator('[data-demo-ref]').evaluateAll((elements) =>
            elements.map((element) => {
              const rect = element.getBoundingClientRect();
              const outset =
                element.getAttribute('data-pui-material-carrier') === 'contact-v1'
                  ? Math.ceil(Math.max(rect.width, rect.height) * 0.08 + 1)
                  : 0;
              return {
                ref: element.getAttribute('data-demo-ref'),
                width: rect.width,
                height: rect.height,
                outset,
                left: rect.left - outset,
                top: rect.top - outset,
                right: rect.right + outset,
                bottom: rect.bottom + outset,
              };
            })
          );
          for (let i = 0; i < layout.length; i++)
            for (let j = i + 1; j < layout.length; j++) {
              const a = layout[i],
                b = layout[j];
              expect(
                a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
              ).toBe(true);
            }
          observations.push({
            layout,
            layoutScope:
              '32px normal composition gap; no overlapping/stacked material support claimed',
          });
          expect(await subject('initial-active').getAttribute('aria-pressed')).toBe('true');
          await quality(subject('opaque'), 'opaque-fallback');
          await quality(subject('disabled'), 'opaque-fallback');
          const initiallyDisabled = await capture(
            `${runtime}-${theme}-initial-disabled`,
            subject('disabled'),
            observations
          );
          expect(initiallyDisabled.opacity).toBe('1');
          expect(initiallyDisabled.background[3]).toBe(255);
          expect(initiallyDisabled.fallbackContrast).toBeGreaterThanOrEqual(4.5);
          expect(initiallyDisabled.active).toBe('true');
          expect(initiallyDisabled.underline).toBe('none');
          opaqueState(initiallyDisabled, theme, true);
          const bare = page.locator(
            `[data-toggle-no-provider="${runtime}"] [data-demo-ref="bare"]`
          );
          const bareInactive = await capture(
            `${runtime}-${theme}-no-provider-inactive`,
            bare,
            observations
          );
          expect(bareInactive.quality).not.toBe('self-optical');
          expect(['', 'none']).toContain(bareInactive.image);
          expect(bareInactive.background[3]).toBe(255);
          expect(bareInactive.fallbackContrast).toBeGreaterThanOrEqual(4.5);
          opaqueState(bareInactive, theme, false);
          await bare.click();
          await expect.poll(() => bare.getAttribute('aria-pressed')).toBe('true');
          const bareActive = await capture(
            `${runtime}-${theme}-no-provider-active`,
            bare,
            observations
          );
          expect(bareActive.quality).not.toBe('self-optical');
          expect(['', 'none']).toContain(bareActive.image);
          expect(bareActive.underline).toBe('none');
          opaqueState(bareActive, theme, true);
          expect(bareActive.background).not.toEqual(bareInactive.background);
          // Isolate geometry from optical admission; keep source/provider assertions above.
          const originalGeometryStyle = await bare.evaluate((host) => ({
            dir: host.getAttribute('dir'),
            fontSize: (host as HTMLElement).style.fontSize,
          }));
          try {
            for (const direction of ['ltr', 'rtl'] as const) {
              await bare.evaluate((host, dir) => {
                host.setAttribute('dir', dir);
                (host as HTMLElement).style.fontSize = '28px';
              }, direction);
              await capture(
                `${runtime}-${theme}-no-provider-${direction}-large-text`,
                bare,
                observations,
                { direction, textScale: 2 }
              );
            }
          } finally {
            await bare.evaluate((host, original) => {
              if (original.dir === null) host.removeAttribute('dir');
              else host.setAttribute('dir', original.dir);
              (host as HTMLElement).style.fontSize = original.fontSize;
            }, originalGeometryStyle);
          }
          expect(await subject('disabled').getAttribute('aria-pressed')).toBe('true');

          const iconOnly = subject('icon-only');
          const iconContent = iconOnly.locator('[data-liquid-toggle-icon-content]');
          const iconIdentity = await iconContent.elementHandle();
          expect(iconIdentity).not.toBeNull();
          expect(
            await host
              .getByRole('button', { name: 'Toggle bold formatting', exact: true })
              .getAttribute('data-demo-ref')
          ).toBe('icon-only');
          await quality(iconOnly, 'self-optical');
          const iconInactive = await capture(
            `${runtime}-${theme}-icon-inactive`,
            iconOnly,
            observations
          );
          expect(iconInactive.active).toBe('false');
          await iconOnly.click();
          await expect.poll(() => iconOnly.getAttribute('aria-pressed')).toBe('true');
          const iconActive = await capture(
            `${runtime}-${theme}-icon-active`,
            iconOnly,
            observations
          );
          expect(iconActive.width).toBe(iconInactive.width);
          expect(iconActive.height).toBe(iconInactive.height);
          expect(iconActive.selectionMarker.opacity).toBe('1');
          expect(
            await host
              .getByRole('button', { name: 'Toggle bold formatting', exact: true })
              .getAttribute('data-demo-ref')
          ).toBe('icon-only');
          await iconOnly.focus();
          await page.keyboard.press('Space');
          await expect.poll(() => iconOnly.getAttribute('aria-pressed')).toBe('false');
          await page.keyboard.press('Space');
          await expect.poll(() => iconOnly.getAttribute('aria-pressed')).toBe('true');
          expect(
            await host
              .getByRole('button', { name: 'Toggle bold formatting', exact: true })
              .getAttribute('data-demo-ref')
          ).toBe('icon-only');

          expect(await iconContent.evaluate((el, first) => el === first, iconIdentity)).toBe(true);

          await target.hover();
          await page.mouse.down();
          await expect.poll(() => state(page, runtime, 'regular', 'pressed')).toBe(true);
          await expect.poll(() => target.getAttribute('data-material-phase')).toBe('pressed');
          const pressed = await capture(`${runtime}-${theme}-pressed`, target, observations);
          optical(pressed);
          expect(pressed.active).toBe('false');
          expect(pressed.image).not.toBe(inactive.image);
          expect(await fixture(page, runtime, 'requests', 'regular')).toEqual([]);
          await page.mouse.up();
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('true');
          await expect.poll(() => state(page, runtime, 'regular', 'pressed')).toBe(false);
          await expect.poll(() => target.getAttribute('data-material-phase')).toBe('rest');
          const active = await capture(`${runtime}-${theme}-active`, target, observations);
          optical(active);
          expect(active.underline).toBe('none');
          expect(active.borderColor).toEqual(active.ringColor);
          expect(active.background).toEqual(inactive.background);
          expect(active.background).toEqual([0, 0, 0, 0]);
          expect(active.foreground).toEqual(expectedPalette(theme).primaryForeground);
          expect(active.width).toBe(inactive.width);
          expect(active.height).toBe(inactive.height);
          expect(active.radius).toBe(inactive.radius);
          expect(active.pixels!.width).toBe(inactive.pixels!.width);
          expect(active.pixels!.height).toBe(inactive.pixels!.height);
          expect(await fixture(page, runtime, 'requests', 'regular')).toEqual([
            { ref: 'regular', active: true },
          ]);

          await page.mouse.move(0, 0);
          await page.locator(`[data-focus-start="${runtime}"]`).focus();
          await page.keyboard.press('Tab');
          await expect
            .poll(() => target.evaluate((el) => document.activeElement === el))
            .toBe(true);
          await expect.poll(() => state(page, runtime, 'regular', 'focusVisible')).toBe(true);
          const focus = await capture(`${runtime}-${theme}-keyboard-focus`, target, observations);
          expect(focus.shadow).not.toBe(inactive.shadow);
          const positionY = await page.evaluate(() => scrollY);
          await page.keyboard.press('Space');
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('false');
          expect(await page.evaluate(() => scrollY)).toBe(positionY);
          expect(
            (await fixture(page, runtime, 'requests', 'regular')).map((entry: any) => entry.active)
          ).toEqual([true, false]);
          await page.keyboard.press('Enter');
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('true');
          expect(
            (await fixture(page, runtime, 'requests', 'regular')).map((entry: any) => entry.active)
          ).toEqual([true, false, true]);

          // Disable during a real pointer press: no commit, no stale pressed state or optics.
          await target.hover();
          await page.mouse.down();
          await expect.poll(() => state(page, runtime, 'regular', 'pressed')).toBe(true);
          await expect.poll(() => target.getAttribute('data-material-phase')).toBe('pressed');
          const selectedPressed = await capture(
            `${runtime}-${theme}-selected-pressed`,
            target,
            observations
          );
          optical(selectedPressed);
          expect(selectedPressed.active).toBe('true');
          await fixture(page, runtime, 'setProps', 'regular', { disabled: true });
          await expect.poll(() => target.getAttribute('aria-disabled')).toBe('true');
          await expect.poll(() => state(page, runtime, 'regular', 'pressed')).toBe(false);
          await expect.poll(() => state(page, runtime, 'regular', 'hovered')).toBe(false);
          await page.mouse.up();
          await page.keyboard.press('Space');
          await page.keyboard.press('Enter');
          await quality(target, 'opaque-fallback');
          const disabled = await capture(`${runtime}-${theme}-disabled`, target, observations);
          expect(disabled.active).toBe('true');
          expect(disabled.underline).toBe('none');
          expect(disabled.opacity).toBe('1');
          expect(disabled.background[3]).toBe(255);
          expect(disabled.fallbackContrast).toBeGreaterThanOrEqual(4.5);
          expect(disabled.pointerEvents).toBe('none');
          expect(disabled.image).toBe('none');
          expect(isUnpaintedComposedShadow(disabled.shadow)).toBe(true);
          expect(await state(page, runtime, 'regular', 'focusVisible')).toBe(false);
          expect(disabled.carrier.marker).toBe(null);
          opaqueState(disabled, theme, true);
          expect((await fixture(page, runtime, 'requests', 'regular')).length).toBe(3);
          await page.mouse.move(0, 0);
          await fixture(page, runtime, 'setProps', 'regular', { disabled: false });
          await quality(target, 'self-optical');
          await target.click();
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('false');
          await capture(`${runtime}-${theme}-restored-inactive`, target, observations);

          const controlled = subject('controlled');
          await controlled.click();
          await controlled.focus();
          await page.keyboard.press('Enter');
          await expect
            .poll(async () => (await fixture(page, runtime, 'requests', 'controlled')).length)
            .toBe(2);
          expect(await controlled.getAttribute('aria-pressed')).toBe('false');
          expect(
            (await fixture(page, runtime, 'requests', 'controlled')).map(
              (entry: any) => entry.active
            )
          ).toEqual([true, true]);
          const rejected = await capture(
            `${runtime}-${theme}-controlled-rejected`,
            controlled,
            observations
          );
          optical(rejected);
          expect(rejected.active).toBe('false');
          expect(rejected.foreground).toEqual(expectedPalette(theme).secondaryForeground);
          await fixture(page, runtime, 'setProps', 'controlled', { active: true });
          await expect.poll(() => controlled.getAttribute('aria-pressed')).toBe('true');
          await quality(controlled, 'self-optical');
          const lateActive = await capture(
            `${runtime}-${theme}-controlled-late-active`,
            controlled,
            observations
          );
          optical(lateActive);
          expect(lateActive.foreground).toEqual(expectedPalette(theme).primaryForeground);
          await controlled.click();
          await expect
            .poll(async () => (await fixture(page, runtime, 'requests', 'controlled')).length)
            .toBe(3);
          expect(await controlled.getAttribute('aria-pressed')).toBe('true');
          expect(
            (await fixture(page, runtime, 'requests', 'controlled')).map(
              (entry: any) => entry.active
            )
          ).toEqual([true, true, false]);
          await fixture(page, runtime, 'setProps', 'controlled', { active: false });
          await expect.poll(() => controlled.getAttribute('aria-pressed')).toBe('false');

          // Revoke the admitted source itself, not a component-owned material switch.
          await target.click();
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('true');
          await page.mouse.move(0, 0);
          await fixture(page, runtime, 'source', false);
          await quality(target, 'opaque-fallback');
          const lost = await capture(`${runtime}-${theme}-source-lost`, target, observations);
          expect(lost.image).toBe('none');
          expect(lost.active).toBe('true');
          expect(lost.underline).toBe('none');
          expect(lost.fallbackContrast).toBeGreaterThanOrEqual(4.5);
          opaqueState(lost, theme, true);
          await fixture(page, runtime, 'source', true);
          await quality(target, 'self-optical');
          await fixture(page, runtime, 'setProps', 'regular', { material: 'opaque' });
          await quality(target, 'opaque-fallback');
          await fixture(page, runtime, 'setProps', 'regular', { material: 'auto' });
          await quality(target, 'self-optical');

          await preferences(cdp, theme, { 'prefers-reduced-motion': 'reduce' });
          await quality(target, 'self-optical');
          await expect.poll(() => target.getAttribute('data-material-motion')).toBe('static');
          await capture(`${runtime}-${theme}-reduced-motion`, target, observations);
          for (const [feature, value] of [
            ['prefers-reduced-transparency', 'reduce'],
            ['prefers-contrast', 'more'],
            ['forced-colors', 'active'],
          ]) {
            await preferences(cdp, theme, { [feature]: value });
            await quality(target, 'opaque-fallback');
            const fallback = await capture(`${runtime}-${theme}-${feature}`, target, observations);
            expect(fallback.image).toBe('none');
            expect(fallback.active).toBe('true');
            expect(fallback.underline).toBe('none');
            if (feature === 'forced-colors') {
              expect(fallback.fallbackContrast).toBeGreaterThanOrEqual(4.5);
              const iconFallback = await capture(
                `${runtime}-${theme}-icon-forced-colors`,
                iconOnly,
                observations
              );
              expect(iconFallback.active).toBe('true');
              expect(iconFallback.fallbackContrast).toBeGreaterThanOrEqual(4.5);
              expect(await iconContent.evaluate((el, first) => el === first, iconIdentity)).toBe(
                true
              );
              await target.focus();
              await page.keyboard.press('Tab');
              await page.keyboard.press('Shift+Tab');
              await expect
                .poll(() => target.evaluate((el) => document.activeElement === el))
                .toBe(true);
              await expect.poll(() => state(page, runtime, 'regular', 'focusVisible')).toBe(true);
              const forcedFocus = await target.evaluate((el) => {
                const css = getComputedStyle(el);
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Outline color observation requires a 2D context');
                const rgba = (color: string) => {
                  context.clearRect(0, 0, 1, 1);
                  context.fillStyle = color;
                  context.fillRect(0, 0, 1, 1);
                  return Array.from(context.getImageData(0, 0, 1, 1).data);
                };
                const outline = rgba(css.outlineColor),
                  background = rgba(css.backgroundColor);
                const composited = outline
                  .slice(0, 3)
                  .map(
                    (channel, i) =>
                      (channel * outline[3]) / 255 + background[i] * (1 - outline[3] / 255)
                  );
                const luminance = (rgb: number[]) =>
                  rgb.slice(0, 3).reduce((total, channel, i) => {
                    const value = channel / 255;
                    return (
                      total +
                      (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
                        [0.2126, 0.7152, 0.0722][i]
                    );
                  }, 0);
                const lumas = [luminance(composited), luminance(background)].sort((a, b) => b - a);
                return {
                  width: css.outlineWidth,
                  style: css.outlineStyle,
                  color: css.outlineColor,
                  outline,
                  background,
                  contrast: background[3] === 255 ? (lumas[0] + 0.05) / (lumas[1] + 0.05) : null,
                };
              });
              observations.push({ forcedColorsFocus: forcedFocus });
              expect(parseFloat(forcedFocus.width)).toBeGreaterThanOrEqual(2);
              expect(forcedFocus.style).toBe('solid');
              expect(forcedFocus.outline[3]).toBeGreaterThan(0);
              expect(forcedFocus.contrast).toBeGreaterThanOrEqual(3);
            } else {
              expect(fallback.fallbackContrast).toBeGreaterThanOrEqual(4.5);
              opaqueState(fallback, theme, true);
            }
            await preferences(cdp, theme);
            await quality(target, 'self-optical');
          }
          expect(await target.evaluate((el, first) => el === first, identity)).toBe(true);
          observations.push({
            sameNativeNode: true,
            requests: await fixture(page, runtime, 'requests', 'regular'),
            controlledRequests: await fixture(page, runtime, 'requests', 'controlled'),
            provider: await page.evaluate(() => (window as any).liquidToggleFixture.metrics()),
          });
          if (output)
            await host.screenshot({
              path: path.join(output, `${runtime}-${theme}-recovered-scene.png`),
            });
          await page.evaluate(() => (window as any).liquidToggleFixture.dispose());
          expect(await page.locator('[data-material-backdrop]').count()).toBe(0);
          const disposed = await page.evaluate(() => (window as any).liquidToggleFixture.metrics());
          expect(disposed).toMatchObject({ contexts: 0, pendingImages: 0, decodedImages: 0 });
          observations.push({ disposed });
        } catch (error) {
          failure = String(error);
          // Failure-only observation, not a retry or an extension of the functional
          // deadline. The sampled state may have advanced since the original error.
          try {
            observations.push({
              failurePreferenceSample: await deadline(
                'post-failure-material-preferences',
                () =>
                  page.evaluate((runtime) => {
                    const target = document.querySelector<HTMLElement>(
                      `[data-toggle-host="${runtime}"] [data-demo-ref="regular"]`
                    );
                    return {
                      sampledAfterFailure: true,
                      wallTime: Date.now(),
                      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                      noPreference: matchMedia('(prefers-reduced-motion: no-preference)').matches,
                      motion: target?.getAttribute('data-material-motion') ?? null,
                      quality: target?.getAttribute('data-material-quality') ?? null,
                      reason: target?.getAttribute('data-material-reason') ?? null,
                      provider: (window as any).liquidToggleFixture?.metrics(),
                    };
                  }, runtime),
                1000
              ),
            });
          } catch (diagnosticError) {
            observations.push({ failurePreferenceSampleError: String(diagnosticError) });
          }
          if (output)
            await page
              .screenshot({
                path: path.join(output, `${runtime}-${theme}-failure.png`),
                fullPage: true,
              })
              .catch(() => {});
          throw error;
        } finally {
          results.push({ runtime, theme, failure, observations });
          await context.close();
        }
      }, 120_000);

  it('unknown preferences retain fallback on all four real runtime hosts', async () => {
    const { context, page } = await newPage();
    try {
      await page.goto(`${baseUrl}${route}?unknown=1`, { waitUntil: 'networkidle' });
      await page.waitForFunction(
        () => document.documentElement.dataset.liquidToggleReady === 'true',
        undefined,
        { timeout: 60_000 }
      );
      for (const runtime of RUNTIMES) {
        const target = page.locator(
          `[data-toggle-host="${runtime}"] [data-demo-ref="initial-active"]`
        );
        await quality(target, 'opaque-fallback');
        const facts = await capture(`${runtime}-unknown-preferences`, target, results, { runtime });
        expect(facts.active).toBe('true');
        expect(facts.image).toBe('none');
        expect(facts.underline).toBe('none');
        expect(facts.fallbackContrast).toBeGreaterThanOrEqual(4.5);
        opaqueState(facts, 'light', true);
      }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('algorithm-only: selected glass retains structured inner detail above frozen noise and flat-fill controls', async () => {
    const { context, page } = await newPage();
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(
        () => document.documentElement.dataset.liquidToggleReady === 'true',
        undefined,
        { timeout: 60_000 }
      );
      await page.evaluate(() => (window as any).liquidToggleFixture.pause(true));
      const report = await page.evaluate<Awaited<ReturnType<typeof runLiquidToggleDetailProbe>>>(
        () => (window as any).liquidToggleFixture.detailProbe()
      );
      const rows = [];
      const sources = new Set<string>();
      for (const row of report.records) {
        const { sourcePng, controls, ...input } = row;
        const sourceName = `detail-source-${row.kind}-${row.inverted ? 'reordered' : 'original'}.png`;
        const bytes = Buffer.from(sourcePng.split(',')[1], 'base64');
        if (output && !sources.has(sourceName)) {
          await writeFile(path.join(output, sourceName), bytes);
          sources.add(sourceName);
        }
        const saved: Record<string, unknown> = {};
        for (const [name, control] of Object.entries(controls)) {
          const { uri, ...facts } = control;
          if (uri) {
            const material = Buffer.from(uri.split(',')[1], 'base64');
            const materialFile = `detail-${row.kind}-${row.inverted ? 'reordered' : 'original'}-${row.theme}-${row.phase}-${name}.png`;
            if (output) await writeFile(path.join(output, materialFile), material);
            saved[name] = {
              ...facts,
              materialFile,
              pngSha256: createHash('sha256').update(material).digest('hex'),
            };
          } else saved[name] = facts;
        }
        rows.push({
          ...input,
          sourceFile: sourceName,
          sourcePngSha256: createHash('sha256').update(bytes).digest('hex'),
          controls: saved,
        });
      }
      const evidence = { ...source, ...report, records: rows };
      results.push({ name: 'algorithm-only-structured-detail', ...evidence });
      if (output)
        await writeFile(
          path.join(output, 'detail-source-controls.json'),
          JSON.stringify(evidence, null, 2)
        );
      // Retain all failures and source-bound PNGs before enforcing the policy
      // frozen independently of the candidate. These are not Apple thresholds.
      expect(report.records).toHaveLength(32);
      expect(report.pairs).toHaveLength(16);
      expect(report.renderAttempts).toBe(96);
      expect(report.gpu?.version).toMatch(/WebGL/);
      for (const row of report.records) {
        expect(row.sourceUnchanged).toBe(true);
        expect(row.frameUnchanged).toBe(true);
        expect(row.fixedTime).toBe(0);
        expect(row.sourceSha256).toMatch(/^[a-f\d]{64}$/);
        for (const control of Object.values(row.controls)) {
          expect(control.status, `${row.kind}/${row.inverted}/${row.theme}/${row.phase}`).toBe(
            'rendered'
          );
          if (control.status !== 'rendered') continue;
          expect(control.contentPixels).toBeGreaterThan(0);
          expect(control.opaqueContentPixels).toBe(control.contentPixels);
          expect(control.minimumForegroundContrast).toBeGreaterThanOrEqual(4.5);
        }
        expect(row.zeroRefractionMeasurementError).toBeNull();
        expect(row.zeroRefractionDifference?.fullyOpaque).toBe(true);
      }
      for (const pair of report.pairs) {
        const label = `${pair.kind}/${pair.theme}/${pair.phase}`;
        expect(pair.sameSourceHistogram, label).toBe(true);
        expect(pair.distinctSourcePixels, label).toBe(true);
        expect(pair.blockers, label).toEqual([]);
        expect(pair.status, label).toBe('measured');
        expect(pair.result?.failures, label).toEqual([]);
        expect(pair.result?.passed, label).toBe(true);
      }
      expect(report.passed).toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it('algorithm-only: fixed-source tint keeps real refraction and contrast across themes and motion', async () => {
    const { context, page } = await newPage();
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(
        () => document.documentElement.dataset.liquidToggleReady === 'true',
        undefined,
        { timeout: 60_000 }
      );
      await page.evaluate(() => (window as any).liquidToggleFixture.pause(true));
      const report = await page.evaluate<Awaited<ReturnType<typeof runLiquidToggleTintProbe>>>(() =>
        (window as any).liquidToggleFixture.tintProbe()
      );
      // Persist every outcome before asserting. Unsafe neutral controls remain
      // genuine rejected controls with no fabricated image or contrast result.
      const rows = [];
      const savedSources = new Set<string>();
      for (const row of report.records) {
        const { sourcePng, controls, ...input } = row;
        const sourceBytes = Buffer.from(sourcePng.split(',')[1], 'base64');
        if (output && !savedSources.has(row.sourceKind)) {
          await writeFile(path.join(output, `tint-source-${row.sourceKind}.png`), sourceBytes);
          savedSources.add(row.sourceKind);
        }
        const savedControls: Record<string, unknown> = {};
        for (const [name, result] of Object.entries(controls)) {
          if (result.status === 'rejected') savedControls[name] = result;
          else {
            const { uri, ...statistics } = result;
            const png = Buffer.from(uri.split(',')[1], 'base64');
            const materialFile = `tint-${row.sourceKind}-${row.theme}-${row.phase}-${name}.png`;
            if (output) await writeFile(path.join(output, materialFile), png);
            savedControls[name] = {
              ...statistics,
              materialFile,
              pngSha256: createHash('sha256').update(png).digest('hex'),
            };
          }
        }
        rows.push({
          ...input,
          sourcePngSha256: createHash('sha256').update(sourceBytes).digest('hex'),
          controls: savedControls,
        });
      }
      const evidence = { ...report, records: rows };
      results.push({ name: 'algorithm-only-fixed-source-tint', ...evidence });
      if (output)
        await writeFile(
          path.join(output, 'tint-fixed-source-controls.json'),
          JSON.stringify({ ...source, ...evidence }, null, 2)
        );

      expect(report.records).toHaveLength(9 * 2 * 4);
      expect(report.isolatedRenderAttempts).toBe(9 * 2 * 4 * 3);
      expect(report.interleavedRenderAttempts).toBe(9 * 2 * 4 * 2);
      // One shared owner sees alternating neutral/tinted consumers, including
      // static/contact transitions. No per-frame recompile or stale source reuse.
      expect(report.programMetrics.sharedInterleaved.programBuilds).toBe(4);
      expect(report.programMetrics.neutral.programBuilds).toBe(2);
      for (const metrics of Object.values(report.programMetrics)) {
        expect(metrics.sourcePreparations).toBe(9);
        expect(metrics.sourceUploads).toBe(9);
      }
      expect(report.programMetrics.tinted.programBuilds).toBe(2);
      expect(report.programMetrics.zeroRefraction.programBuilds).toBe(2);
      expect(report.gpu?.version).toMatch(/WebGL/);
      for (const row of report.records) {
        const label = `${row.sourceKind}/${row.theme}/${row.phase}`;
        expect(row.sourceSha256, label).toMatch(/^[a-f\d]{64}$/);
        expect(row.sourceUnchanged, label).toBe(true);
        expect(row.frameUnchanged, label).toBe(true);
        expect(row.fixedTime, label).toBe(0);
        expect(row.expectedTintProfile, label).toBe(
          row.phase === 'static' ? 'pui-regular-style-tint-5' : 'pui-regular-style-tint-contact-5'
        );
        for (const name of ['tinted', 'zeroRefraction', 'interleavedTint'] as const) {
          const rendered = row.controls[name];
          expect(rendered.status, `${label}/${name}`).toBe('rendered');
          if (rendered.status !== 'rendered')
            throw new Error(`${label}/${name}: ${rendered.reason}`);
          expect(rendered.statistics.contentPixels, label).toBeGreaterThan(0);
          expect(rendered.statistics.validPixels, label).toBeGreaterThan(0);
          expect(rendered.statistics.opaquePixels, label).toBe(rendered.statistics.contentPixels);
          expect(rendered.statistics.nonopaquePixels, label).toBe(0);
          expect(rendered.statistics.minForegroundContrast, label).toBeGreaterThanOrEqual(4.5);
          // Black sources may have no chromatic signal. Other controlled
          // sources keep a blue-directed mean, not every-pixel fixed hue.
          if (row.sourceKind !== 'black') {
            expect(rendered.statistics.meanRgb![2], label).toBeGreaterThan(
              rendered.statistics.meanRgb![0]
            );
            expect(rendered.statistics.meanRgb![2], label).toBeGreaterThan(
              rendered.statistics.meanRgb![1]
            );
          }
          expect(rendered.decodedSha256, label).toMatch(/^[a-f\d]{64}$/);
        }
        const sharedNeutral = row.controls.interleavedNeutral;
        const isolatedNeutral = row.controls.neutral;
        expect(sharedNeutral.status, label).toBe(isolatedNeutral.status);
        if (sharedNeutral.status === 'rendered' && isolatedNeutral.status === 'rendered') {
          expect(sharedNeutral.decodedSha256, label).toBe(isolatedNeutral.decodedSha256);
          expect(row.sharedNeutralVsIsolated?.validPixels, label).toBeGreaterThan(0);
          expect(row.sharedNeutralVsIsolated?.changedPixels, label).toBe(0);
          expect(row.sharedNeutralVsIsolated?.changedAlphaPixels, label).toBe(0);
        } else if (sharedNeutral.status === 'rejected' && isolatedNeutral.status === 'rejected') {
          expect(sharedNeutral.reason, label).toBe(isolatedNeutral.reason);
          expect(row.sharedNeutralVsIsolated, label).toBeNull();
        }
        const shared = row.controls.interleavedTint;
        const isolated = row.controls.tinted;
        if (shared.status !== 'rendered' || isolated.status !== 'rendered')
          throw new Error(`${label}: shared tint render unavailable`);
        expect(shared.decodedSha256, label).toBe(isolated.decodedSha256);
        expect(row.sharedTintVsIsolated?.validPixels, label).toBeGreaterThan(0);
        expect(row.sharedTintVsIsolated?.changedPixels, label).toBe(0);
        expect(row.sharedTintVsIsolated?.changedAlphaPixels, label).toBe(0);
        expect(row.sharedTintVsIsolated?.absoluteRgbDifference, label).toBe(0);
        if (row.sourceKind.startsWith('dark-detail')) {
          // Same fill and foreground as tint, with a deliberately dark detailed
          // source so the original neutral guard can truthfully admit both.
          expect(row.controls.neutral.status, label).toBe('rendered');
          expect(row.neutralVsTint?.validPixels, label).toBeGreaterThan(0);
          expect(row.neutralVsTint?.changedFraction, label).toBeGreaterThan(0.9);
          expect(row.neutralVsTint?.absoluteRgbDifference, label).toBeGreaterThan(0);
        } else if (row.controls.neutral.status === 'rejected') {
          expect(row.controls.neutral.reason, label).toBe('rendered-contrast-unsafe');
          expect(row.neutralVsTint, label).toBeNull();
        }
        if (row.sourceKind.startsWith('dark-detail') || row.sourceKind === 'high-frequency') {
          // Pixel deltas use the same opaque content coordinates; dynamic
          // background hashes and transparent/changed-alpha edges do not count.
          expect(row.tintVsZeroRefraction?.validPixels, label).toBeGreaterThan(0);
          expect(row.tintVsZeroRefraction?.changedPixels, label).toBeGreaterThan(0);
          expect(row.tintVsZeroRefraction?.absoluteRgbDifference, label).toBeGreaterThan(0);
          expect(row.tintVsZeroRefraction?.changedAlphaPixels, label).toBe(0);
        }
        if (row.sourceKind === 'dark-detail-inverted') {
          // Same two-color histogram, reordered spatially: an opaque fill or
          // source-independent highlight cannot supply this additional proof.
          expect(row.invertedSourceVsOriginal?.validPixels, label).toBeGreaterThan(0);
          expect(row.invertedSourceVsOriginal?.changedPixels, label).toBeGreaterThan(0);
          expect(row.invertedSourceVsOriginal?.changedAlphaPixels, label).toBe(0);
        }
      }
    } finally {
      await context.close();
    }
  }, 180_000);

  for (const locale of ['en', 'zh-cn'])
    it(`${locale}: actual public Toggle page uses the shared optical path across all four runtimes`, async () => {
      const { context, page, cdp } = await newPage();
      const diagnostics = attachLiquidToggleFailureDiagnostics(page, cdp, {
        locale,
        stage: 'navigate',
      });
      const selectorObservations: unknown[] = [];
      let failure: string | null = null;
      let failureScreenshot: string | null = null;
      const diagnosticErrors: Array<{ operation: string; error: string }> = [];
      try {
        await page.goto(`${baseUrl}/${locale}/ui-libraries/liquid-glass/toggle/`, {
          waitUntil: 'networkidle',
        });
        await diagnostics.init();
        const selector = page.locator('.site-header-runtime').first();
        for (const runtime of RUNTIMES) {
          diagnostics.stage({ runtime, stage: 'runtime-select' });
          // Read-only, bounded pre-click facts. A diagnostic read failure must
          // neither replace the real reader interaction nor suppress its error.
          try {
            selectorObservations.push({
              runtime,
              trigger: await readLiquidToggleTriggerFacts(runtimeSelectTrigger(selector)),
            });
          } catch (error) {
            selectorObservations.push({ runtime, diagnosticError: String(error) });
          }
          await choosePreviewRuntime(page, selector, runtime);
          diagnostics.stage({ stage: 'panel-visible' });
          const panel = page.locator(`[data-adapter-panel="${runtime}"]`);
          await panel.waitFor({ state: 'visible' });
          const target = panel.getByRole('button', { name: 'Bold', exact: true });
          diagnostics.stage({ stage: 'inactive-optics' });
          await quality(target, 'self-optical');
          const identity = await target.elementHandle();
          const inactive = await capture(`public-${locale}-${runtime}-inactive`, target, results, {
            locale,
            runtime,
            publicRoute: page.url(),
          });
          optical(inactive);
          diagnostics.stage({ stage: 'toggle-click' });
          await target.click();
          diagnostics.stage({ stage: 'active-optics' });
          await expect.poll(() => target.getAttribute('aria-pressed')).toBe('true');
          await quality(target, 'self-optical');
          const active = await capture(`public-${locale}-${runtime}-active`, target, results, {
            locale,
            runtime,
          });
          optical(active);
          expect(active.underline).toBe('none');
          expect(active.width).toBe(inactive.width);
          expect(active.height).toBe(inactive.height);
          expect(await target.evaluate((el, first) => el === first, identity)).toBe(true);
          await expect
            .poll(() => panel.getByRole('status').textContent())
            .toContain('1 activeChange requests');
          if (output)
            await panel.screenshot({
              path: path.join(output, `public-${locale}-${runtime}-scene.png`),
            });
        }
        diagnostics.stage({ stage: 'complete' });
      } catch (error) {
        failure = String(error);
        try {
          await diagnostics.collectFailure(error);
        } catch (diagnosticError) {
          diagnosticErrors.push({ operation: 'collect', error: String(diagnosticError) });
        }
        if (output) {
          try {
            await page.screenshot({
              path: path.join(output, `public-${locale}-failure.png`),
              fullPage: true,
              timeout: 3000,
            });
            failureScreenshot = 'captured';
          } catch (screenshotError) {
            failureScreenshot = String(screenshotError);
          }
        }
        throw error;
      } finally {
        // The Node-side record survives a renderer that cannot answer evaluate
        // or screenshot. Debugger stacks are failure diagnostics, not acceptance.
        try {
          await diagnostics.dispose();
        } catch (diagnosticError) {
          diagnosticErrors.push({ operation: 'dispose', error: String(diagnosticError) });
        }
        const entry = {
          name: `public-${locale}-diagnostics`,
          locale,
          failure,
          failureScreenshot,
          selectorObservations,
          diagnosticErrors,
          diagnostics: diagnostics.receipt(),
        };
        results.push(entry);
        try {
          if (output)
            await writeFile(
              path.join(output, `public-${locale}-diagnostics.json`),
              JSON.stringify({ ...source, ...entry }, null, 2)
            );
        } catch (writeError) {
          diagnosticErrors.push({ operation: 'write-receipt', error: String(writeError) });
          // Keep the native error authoritative when diagnostic persistence
          // fails. A failure-free run must still surface missing artifacts.
          if (failure === null) throw writeError;
        } finally {
          try {
            await context.close();
          } catch (closeError) {
            diagnosticErrors.push({ operation: 'close-context', error: String(closeError) });
            if (failure === null) throw closeError;
          }
        }
      }
    }, 150_000);
});
