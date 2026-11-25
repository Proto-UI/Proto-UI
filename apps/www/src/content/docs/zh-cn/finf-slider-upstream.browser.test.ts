// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Locator } from 'playwright-core';
import { beforeAll, afterAll, it, expect } from 'vitest';
import {
  mountSliderUpstream,
  type SliderUpstreamFixtureHandle,
} from '../../../../test/fixtures/slider-upstream-fixture';
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
  styleProfile: 'rhea',
  url: 'https://github.com/shadcn-ui/ui/blob/3d98900e9b73c45f035f8109e9d41ba6a51685e7/apps/v4/registry/styles/style-rhea.css',
  gitBlob: '94bbca2a7f78845e7cfbcff68fb8f535e3848a98',
};
const consumer = {
  kind: 'test-owned ordinary Rhea consumer',
  fixture: 'apps/www/test/fixtures/slider-upstream-fixture.ts',
  publicDemo: 'apps/www/src/content/docs/demo-shadcn-slider.demo.ts',
  publicEntries: ['volume-root', 'field-root'],
  cases: ['horizontal', 'disabled', 'readonly', 'rtl', 'field', 'vertical'],
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
    consumer,
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
// Thumb ink and Track rail are owned decorations, separate from their hit owners
// and caller slots. Select that boundary without assuming a tag or style carrier.
const decoration = (owner: Locator) => owner.locator(':scope > [data-pui-owned-decoration]');
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
    let fixture: SliderUpstreamFixtureHandle | undefined;
    const observations: Record<string, unknown> = {};
    let result = 'failed';
    let failure: string | undefined;
    try {
      runtimePhase = 'loading-initial-wc';
      interaction('navigate', '/en/ui-libraries/shadcn/slider/');
      await page.goto(`${baseUrl}/en/ui-libraries/shadcn/slider/`, { waitUntil: 'networkidle' });
      const publicPreviewer = page.locator('[data-previewer-id]').first();
      expect(await publicPreviewer.getAttribute('data-demo-id')).toBe('demo-shadcn-slider');
      stage = 'initial-preview-readiness';
      await waitForPreviewRuntime(page, 'wc', '[role="slider"]', 2);
      runtimePhase = 'ready-wc';
      if (runtime !== 'wc') {
        runtimePhase = `switching-to-${runtime}`;
        interaction('runtime-switch', runtime);
        await selectRuntime(page, publicPreviewer, runtime, '[role="slider"]', 2);
        runtimePhase = `ready-${runtime}`;
      }
      const publicEntries = {
        count: await publicPreviewer.locator('[role="slider"]').count(),
        volume: await publicPreviewer
          .locator('[data-demo-ref="volume-thumb"]')
          .getAttribute('aria-valuenow'),
        field: await publicPreviewer
          .locator('[data-demo-ref="field-thumb"]')
          .getAttribute('aria-valuenow'),
      };
      observations.publicEntries = publicEntries;
      expect(publicEntries).toEqual({ count: 2, volume: '75', field: '50' });
      stage = 'mount-six-scenario-consumer';
      runtimePhase = `mounting-fixture-${runtime}`;
      fixture = await mountSliderUpstream(page, runtime);
      const profiles = await fixture.evaluate((view) => ({
        publicProfile: view.publicProfile,
        fixtureProfile: view.fixtureProfile,
        cases: view.cases,
      }));
      observations.profiles = profiles;
      expect(profiles).toEqual({
        publicProfile: 'rhea',
        fixtureProfile: 'rhea',
        cases: consumer.cases,
      });
      const previewer = page.locator('[data-slider-upstream-fixture]');
      await expect.poll(() => previewer.locator('[role="slider"]').count()).toBe(6);
      runtimePhase = `fixture-ready-${runtime}`;
      stage = 'rest-geometry';
      const ref = (name: string) => previewer.locator(`[data-demo-ref="${name}"]`);
      const thumb = ref('horizontal-thumb'),
        track = ref('horizontal-track');
      const paint = decoration(thumb);
      const rail = decoration(track);
      await expect.poll(() => paint.count()).toBe(1);
      await expect.poll(() => rail.count()).toBe(1);
      const capture = async (
        state: string,
        crop = previewer.locator('[data-demo-ref="horizontal-case"]')
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
          paint: await geometry(decoration(targetThumb)),
          track: await geometry(targetTrack),
          rail: await geometry(decoration(targetTrack)),
        });
      };
      const rem = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      );
      await expect.poll(async () => (await geometry(rail)).height).toBe(rem / 4);
      expect((await geometry(track)).height).toBe(rem);
      expect(await geometry(thumb)).toMatchObject({ width: rem, height: rem });
      expect(await geometry(paint)).toMatchObject({
        width: rem,
        height: rem,
        border: '0px',
        background: 'rgb(255, 255, 255)',
      });
      expect((await geometry(ref('horizontal-indicator'))).height).toBe(rem / 4);
      interaction('pointer-move', 'outside-preview', '0,0');
      await page.mouse.move(0, 0);
      const rest = await geometry(paint);
      expect(rest.shadow).not.toBe('none');
      await capture('rest');
      expect((await geometry(thumb)).radius).toBe('0px');
      // Rhea has a 1rem rectangular hit owner and equally sized rounded ink.
      // Track and Thumb share the 1rem cross-axis; probe corners, then exterior.
      for (const corner of [
        [0.5, 0.5],
        [rem - 0.5, 0.5],
        [0.5, rem - 0.5],
        [rem - 0.5, rem - 0.5],
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
      // outline-none retains a transparent native focus fallback on the owner.
      // The passive paint supplies the family ring and forced-colors outline.
      expect(await geometry(thumb)).toMatchObject({
        outlineStyle: 'solid',
        outlineWidth: '2px',
        outlineColor: 'rgba(0, 0, 0, 0)',
      });
      interaction('forced-colors-active', 'page');
      await page.emulateMedia({ forcedColors: 'active' });
      await expect.poll(async () => (await geometry(paint)).outlineStyle).toBe('solid');
      expect((await geometry(paint)).outlineWidth).toBe('2px');
      expect(await geometry(thumb)).toMatchObject({ outlineStyle: 'solid', outlineWidth: '2px' });
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
      await capture('disabled', previewer.locator('[data-demo-ref="disabled-case"]'));
      expect(await ref('readonly-thumb').getAttribute('aria-readonly')).toBe('true');
      expect((await geometry(ref('readonly-track'))).opacity).toBe('1');
      await capture('readonly', previewer.locator('[data-demo-ref="readonly-case"]'));
      const vertical = ref('vertical-track');
      expect((await geometry(vertical)).height).toBeGreaterThanOrEqual(10 * rem);
      expect((await geometry(decoration(vertical))).width).toBe(rem / 4);
      await capture('vertical', previewer.locator('[data-demo-ref="vertical-case"]'));
      expect((await geometry(decoration(ref('field-thumb')))).width).toBe(rem);
      interaction('click', 'field-thumb');
      await ref('field-thumb').click();
      interaction('keyboard-press', 'current-focus', 'End');
      await page.keyboard.press('End');
      await expect.poll(() => ref('field-thumb').getAttribute('aria-valuenow')).toBe('100');
      await capture('field-thumb', previewer.locator('[data-demo-ref="field-case"]'));
      await capture('rtl', previewer.locator('[data-demo-ref="rtl-case"]'));
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
      try {
        await writeJson(`slider-${runtime}.json`, {
          revision,
          tree,
          upstream,
          consumer,
          observations,
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
            'The public Rhea demo is verified as two live entries (Volume scalar75 and Brightness Field50); the six-scenario captures use the explicitly test-owned Rhea consumer.',
            'Disabled/readOnly/RTL/vertical are fixture props on the public scalar entry; the Field entry is retained. These screenshots do not claim six cases in the first public preview.',
            'Unscoped Slider retains the separately tested Nova compatibility recipe.',
            'The Base-owned rectangular Thumb hit corners are retained; upstream rounded-element corner-hit equivalence is not established.',
            'Vertical and RTL cases record geometry/screenshots only; native axis/direction editing is not established.',
            'Keyboard evidence covers focus and Home/End, not arrow stepping; readonly evidence covers aria/paint, not input refusal.',
            'Thumb centers retain the existing full Track coordinate interval. Upstream edge alignment and matching axis inset contract remain open.',
            'Single-thumb only; multi-thumb/range constraints and full upstream API parity remain open.',
            'Web Chromium evidence does not establish native GPUI/Qt, assistive technology, packed consumer or Compiler fidelity.',
          ],
        });
      } finally {
        try {
          await fixture?.evaluate((view) => view.destroy()).finally(() => fixture?.dispose());
        } finally {
          await context.close();
        }
      }
    }
  }, 180_000);
