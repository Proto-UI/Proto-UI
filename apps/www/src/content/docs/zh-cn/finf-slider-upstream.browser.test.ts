// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Locator } from 'playwright-core';
import { beforeAll, afterAll, it, expect } from 'vitest';
import {
  appendSliderPageError,
  type SliderPageErrorContext,
  type SliderPageErrorReceipt,
} from './finf-slider-error-receipt';
import {
  chromeExecutable,
  startServer,
  stopServer,
  selectRuntime,
  waitForPreviewRuntime,
  RUNTIMES,
} from './browser-harness';
const output =
  process.env.PUI_FINF_FEATURE_EVIDENCE_DIR ?? path.join(tmpdir(), 'pui-finf-slider-evidence');
const revision = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const upstream = {
  url: 'https://ui.shadcn.com/r/styles/base-nova/slider.json',
  sha256: '646bcd7913417b786bbf7578484f851bf89c81a62f70ef9c4f3522e2af80a951',
};
let browser: Browser;
let baseUrl = '';
const writeJson = (name: string, value: unknown) =>
  writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await writeJson('slider-source.json', {
    revision,
    tree,
    upstream,
    phase: 'planned; terminal receipts establish outcomes',
  });
  try {
    if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.CANDIDATE_SHA)
      throw new Error(
        'Official GitHub Actions only; local source tests do not launch a native browser.'
      );
    expect(revision).toBe(process.env.CANDIDATE_SHA);
    expect(execFileSync('git', ['diff', '--name-only', 'HEAD']).toString().trim()).toBe('');
    baseUrl = await startServer('/');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname))
      throw new Error('Evidence requires the job’s own loopback documentation server.');
    browser = await chromium.launch({
      executablePath: await chromeExecutable(),
      headless: true,
      chromiumSandbox: true,
      args: ['--disable-dev-shm-usage'],
    });
  } catch (error) {
    await writeJson('slider-setup.json', {
      revision,
      tree,
      result: 'blocked-before-browser',
      error: String(error),
      screenshots: [],
    });
    throw error;
  }
}, 180_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
});
const geometry = (locator: Locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect(),
      css = getComputedStyle(element);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      border: css.borderTopWidth,
      background: css.backgroundColor,
      shadow: css.boxShadow,
      opacity: css.opacity,
      pointerEvents: css.pointerEvents,
      radius: css.borderRadius,
      outlineStyle: css.outlineStyle,
      outlineWidth: css.outlineWidth,
      outlineColor: css.outlineColor,
    };
  });
for (const runtime of RUNTIMES)
  it(`Slider ${runtime} actual dimensions, native pointer states and both entries`, async () => {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 1000 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const screenshots: unknown[] = [];
    const hitProbes: unknown[] = [];
    const errors: string[] = [];
    const pageErrorDetails: SliderPageErrorReceipt[] = [];
    let stage = 'page-created';
    let runtimePhase = 'page-created';
    let interactionSequence = 0;
    let lastInteraction: SliderPageErrorContext['lastInteraction'] = null;
    const interaction = (action: string, target: string, detail?: string) => {
      stage = action;
      lastInteraction = { sequence: ++interactionSequence, action, target, detail };
    };
    page.on('pageerror', (error) => {
      appendSliderPageError(errors, pageErrorDetails, error, {
        runtime,
        runtimePhase,
        url: page.url(),
        stage,
        lastInteraction,
      });
    });
    let result = 'failed';
    let failure: string | undefined;
    try {
      runtimePhase = 'loading-initial-wc';
      interaction('navigate', '/en/ui-libraries/shadcn/slider/');
      await page.goto(`${baseUrl}/en/ui-libraries/shadcn/slider/`, { waitUntil: 'networkidle' });
      const previewer = page.locator('[data-previewer-id]').first();
      stage = 'initial-preview-readiness';
      await waitForPreviewRuntime(page, 'wc', '[role="slider"]', 6);
      runtimePhase = 'ready-wc';
      if (runtime !== 'wc') {
        runtimePhase = `switching-to-${runtime}`;
        interaction('runtime-switch', runtime);
        await selectRuntime(page, previewer, runtime, '[role="slider"]', 6);
        runtimePhase = `ready-${runtime}`;
      }
      stage = 'rest-geometry';
      const ref = (name: string) => previewer.locator(`[data-demo-ref="${name}"]`);
      const thumb = ref('horizontal-thumb'),
        track = ref('horizontal-track');
      const paint = thumb.locator(':scope > div[data-pui-style]').first();
      const rail = track.locator(':scope > div[data-pui-style]').first();
      const capture = async (
        state: string,
        crop = previewer.locator('[data-slider-case="horizontal"]')
      ) => {
        stage = `capture:${state}`;
        const file = `slider-${runtime}-${state}.png`;
        const bytes = await crop.screenshot({ path: path.join(output, file) });
        const targetThumb = crop.locator('[role="slider"]').first();
        const targetTrack = crop.locator('[data-demo-ref$="-track"]').first();
        screenshots.push({
          state,
          file,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          thumb: await geometry(targetThumb),
          paint: await geometry(targetThumb.locator(':scope > div[data-pui-style]').first()),
          track: await geometry(targetTrack),
          rail: await geometry(targetTrack.locator(':scope > div[data-pui-style]').first()),
        });
      };
      await expect.poll(async () => (await geometry(rail)).height).toBe(4);
      expect((await geometry(track)).height).toBe(12);
      expect(await geometry(thumb)).toMatchObject({ width: 28, height: 28 });
      expect(await geometry(paint)).toMatchObject({
        width: 12,
        height: 12,
        border: '1px',
        background: 'rgb(255, 255, 255)',
      });
      expect((await geometry(ref('horizontal-indicator'))).height).toBe(4);
      interaction('pointer-move', 'outside-preview', '0,0');
      await page.mouse.move(0, 0);
      const rest = await geometry(paint);
      await capture('rest');
      expect((await geometry(thumb)).radius).toBe('0px');
      // Physical points inside all four 28px corners, outside the 12px paint
      // and the 12px Track cross-axis: bounding boxes alone do not prove hits.
      for (const corner of [
        [0.5, 0.5],
        [27.5, 0.5],
        [0.5, 27.5],
        [27.5, 27.5],
      ]) {
        const hitBox = (await thumb.boundingBox())!;
        const point = { x: hitBox.x + corner[0], y: hitBox.y + corner[1] };
        interaction('corner-pointer-move', 'horizontal-thumb', JSON.stringify(point));
        await page.mouse.move(point.x, point.y);
        await expect.poll(() => thumb.getAttribute('data-hovered')).not.toBeNull();
        interaction('corner-pointer-down', 'horizontal-thumb', JSON.stringify(point));
        await page.mouse.down();
        await expect.poll(() => thumb.getAttribute('data-pressed')).not.toBeNull();
        hitProbes.push({ kind: 'inside-corner', point, hitBox, pressed: true });
        interaction('corner-pointer-up', 'horizontal-thumb', JSON.stringify(point));
        await page.mouse.up();
        await expect.poll(() => thumb.getAttribute('data-pressed')).toBeNull();
      }
      const outsideBox = (await thumb.boundingBox())!;
      interaction('outside-corner-pointer-move', 'horizontal-thumb', JSON.stringify(outsideBox));
      await page.mouse.move(outsideBox.x - 1, outsideBox.y + 0.5);
      await expect.poll(() => thumb.getAttribute('data-hovered')).toBeNull();
      interaction('pointer-down', 'current-pointer-target');
      await page.mouse.down();
      expect(await thumb.getAttribute('data-pressed')).toBeNull();
      interaction('pointer-up', 'current-pointer-target');
      await page.mouse.up();
      hitProbes.push({ kind: 'outside-corner', hitBox: outsideBox, pressed: false });
      interaction('hover', 'horizontal-thumb');
      await thumb.hover();
      await expect.poll(async () => (await geometry(paint)).shadow).not.toBe(rest.shadow);
      await capture('hover');
      const box = (await thumb.boundingBox())!;
      interaction('pointer-down', 'current-pointer-target');
      await page.mouse.down();
      interaction('captured-pointer-move', 'horizontal-thumb', JSON.stringify(box));
      await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2);
      await expect.poll(() => thumb.getAttribute('data-pressed')).not.toBeNull();
      await capture('captured-active');
      interaction('pointer-up', 'current-pointer-target');
      await page.mouse.up();
      await expect.poll(() => thumb.getAttribute('data-pressed')).toBeNull();
      interaction('pointer-move', 'outside-preview', '0,0');
      await page.mouse.move(0, 0);
      // Native keyboard focus and endpoint editing; never force a Proto state or dispatch synthetic keys.
      interaction('click', 'horizontal-thumb');
      await thumb.click();
      interaction('keyboard-press', 'current-focus', 'Tab');
      await page.keyboard.press('Tab');
      interaction('keyboard-press', 'current-focus', 'Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      await expect.poll(() => thumb.getAttribute('data-focus-visible')).not.toBeNull();
      await capture('focus-visible');
      interaction('forced-colors-active', 'page');
      await page.emulateMedia({ forcedColors: 'active' });
      await expect.poll(async () => (await geometry(paint)).outlineStyle).toBe('solid');
      expect((await geometry(paint)).outlineWidth).toBe('2px');
      expect((await geometry(thumb)).outlineStyle).toBe('none');
      await capture('forced-colors-focus-visible');
      interaction('forced-colors-none', 'page');
      await page.emulateMedia({ forcedColors: 'none' });
      interaction('keyboard-press', 'current-focus', 'Home');
      await page.keyboard.press('Home');
      await expect.poll(() => thumb.getAttribute('aria-valuenow')).toBe('0');
      await capture('minimum-coordinate-debt');
      interaction('keyboard-press', 'current-focus', 'End');
      await page.keyboard.press('End');
      await expect.poll(() => thumb.getAttribute('aria-valuenow')).toBe('100');
      await capture('maximum-coordinate-debt');
      const disabled = ref('disabled-thumb');
      expect(await disabled.getAttribute('aria-disabled')).toBe('true');
      expect((await geometry(ref('disabled-track'))).opacity).toBe('0.5');
      const disabledValue = await disabled.getAttribute('aria-valuenow');
      interaction('click', 'disabled-track', '100,6');
      await ref('disabled-track').click({ position: { x: 100, y: 6 } });
      expect(await disabled.getAttribute('aria-valuenow')).toBe(disabledValue);
      await capture('disabled', previewer.locator('[data-slider-case="disabled"]'));
      expect(await ref('readonly-thumb').getAttribute('aria-readonly')).toBe('true');
      expect((await geometry(ref('readonly-track'))).opacity).toBe('1');
      await capture('readonly', previewer.locator('[data-slider-case="readonly"]'));
      const vertical = ref('vertical-track');
      expect((await geometry(vertical)).height).toBeGreaterThanOrEqual(160);
      expect((await geometry(vertical.locator(':scope > div[data-pui-style]').first())).width).toBe(
        4
      );
      await capture('vertical', previewer.locator('[data-slider-case="vertical"]'));
      expect(
        (await geometry(ref('field-thumb').locator(':scope > div[data-pui-style]').first())).width
      ).toBe(12);
      interaction('click', 'field-thumb');
      await ref('field-thumb').click();
      interaction('keyboard-press', 'current-focus', 'End');
      await page.keyboard.press('End');
      await expect.poll(() => ref('field-thumb').getAttribute('aria-valuenow')).toBe('100');
      await capture('field-thumb', previewer.locator('[data-slider-case="field"]'));
      await capture('rtl', previewer.locator('[data-slider-case="rtl"]'));
      stage = 'assert-no-page-errors';
      expect(errors).toEqual([]);
      result = 'passed';
    } catch (error) {
      failure = String(error);
      try {
        const file = `slider-${runtime}-failed.png`;
        const bytes = await page.screenshot({ path: path.join(output, file), fullPage: true });
        screenshots.push({
          state: 'failed-page',
          file,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      } catch (captureError) {
        errors.push(`Failure screenshot unavailable: ${String(captureError)}`);
      }
      throw error;
    } finally {
      await writeJson(`slider-${runtime}.json`, {
        revision,
        tree,
        upstream,
        runtime,
        result,
        failure,
        screenshots,
        hitProbes,
        errors,
        pageErrorDetails,
        terminalStage: stage,
        runtimePhase,
        lastInteraction,
        limitations: [
          'Source-derived geometry and state assertions, not a same-state upstream pixel diff.',
          'Thumb centers retain the existing full Track coordinate interval. Upstream edge alignment and matching axis inset contract remain open.',
          'Single-thumb only; multi-thumb/range constraints and full upstream API parity remain open.',
          'Web Chromium evidence does not establish native GPUI/Qt, assistive technology, packed consumer or Compiler fidelity.',
        ],
      });
      await context.close();
    }
  }, 180_000);
