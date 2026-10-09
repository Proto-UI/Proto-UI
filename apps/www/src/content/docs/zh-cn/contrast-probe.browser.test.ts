// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ContrastFrame,
  collectContrastFrame,
  readContrastState,
  readContrastPaintedVisibility,
  readContrastPointerPair,
  readContrastTargetObservation,
  readContrastAnatomy,
} from '../../../../scripts/contrast-probe.browser';
import { launchBrowser } from './browser-harness';
import {
  compileContrastAnatomy,
  compareContrastAnatomy,
} from '../../../../scripts/contrast-anatomy.mjs';
import { PROJECTION_FAMILY_MANIFESTS } from '../../../components/PrototypePreviewer/projection-families';
import switchDemo from './demo-brutalist-switch.demo';
import checkboxDemo from './demo-brutalist-checkbox.demo';

declare global {
  interface Window {
    puiContrastProbe: {
      collectContrastFrame: typeof collectContrastFrame;
      readContrastState: typeof readContrastState;
      readContrastPaintedVisibility: typeof readContrastPaintedVisibility;
      readContrastPointerPair: typeof readContrastPointerPair;
      readContrastTargetObservation: typeof readContrastTargetObservation;
      readContrastAnatomy: typeof readContrastAnatomy;
    };
  }
}

let browser: Browser;
let firstVisibilityContext: BrowserContext | undefined;
let firstVisibilityPage: Page | undefined;
let bundle: string;
let calibrationPhaseSequence = 0;
const recordCalibrationFile = async (name: string, contents: string | Buffer) => {
  if (!process.env.RUNNER_TEMP) return;
  try {
    const output = join(process.env.RUNNER_TEMP, 'contrast-evidence', 'calibration');
    await mkdir(output, { recursive: true });
    await writeFile(join(output, name), contents, { flag: 'wx' });
  } catch (error) {
    // Diagnostic failures must not replace the original setup/capture/assertion.
    console.error(`[contrast-calibration] ${name} evidence save failed:`, error);
  }
};
const recordCalibrationPhase = async (phase: string, error?: unknown) =>
  recordCalibrationFile(
    `${String(calibrationPhaseSequence++).padStart(3, '0')}-${phase}.json`,
    JSON.stringify(
      {
        phase,
        observedAt: new Date().toISOString(),
        error: error === undefined ? undefined : String(error).slice(0, 2000),
      },
      null,
      2
    )
  );
beforeAll(async () => {
  const startedAt = performance.now();
  await recordCalibrationPhase('bundle-start');
  try {
    console.info('[contrast-calibration] bundle:start');
    const result = await build({
      entryPoints: [
        fileURLToPath(new URL('../../../../scripts/contrast-probe.browser.ts', import.meta.url)),
      ],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'puiContrastProbe',
      platform: 'browser',
      target: 'es2022',
    });
    bundle = result.outputFiles[0].text;
    await recordCalibrationPhase('bundle-ready');
    console.info(
      `[contrast-calibration] bundle:done elapsedMs=${Math.round(performance.now() - startedAt)}`
    );
    console.info('[contrast-calibration] browser:start');
    await recordCalibrationPhase('browser-start');
    browser = await launchBrowser();
    await recordCalibrationPhase('browser-ready');
    console.info(
      `[contrast-calibration] browser:ready elapsedMs=${Math.round(performance.now() - startedAt)}`
    );
    // The first real renderer page is browser bootstrap, not a paint assertion.
    // Keep it for the first test: no discarded warm-up, retry or deadline change.
    await recordCalibrationPhase('first-context-start');
    firstVisibilityContext = await browser.newContext({ viewport: { width: 800, height: 600 } });
    await recordCalibrationPhase('first-page-start');
    firstVisibilityPage = await firstVisibilityContext.newPage();
    await recordCalibrationPhase('first-page-ready');
    console.info(
      `[contrast-calibration] first-page:ready elapsedMs=${Math.round(performance.now() - startedAt)}`
    );
  } catch (error) {
    await recordCalibrationPhase('setup-failed', error);
    throw error;
  }
}, 30_000);
afterAll(async () => {
  try {
    await firstVisibilityContext?.close();
  } finally {
    await browser?.close();
  }
});

// Instrument calibration only: these authored DOM/CSS subjects are not shipped
// components and do not certify any family, Adapter, cue necessity or conformance.
const fixture = (markup: string) => `<!doctype html><html data-theme="light"><head><style>
  html { background: #000; }
  body { margin: 24px; background: #fff; color: #000; font: 16px/24px sans-serif; }
  [data-pui-root] { display: block; box-sizing: border-box; width: 220px; min-height: 32px; background: #fff; color: #000; margin: 8px 0; }
  svg { width: 24px; height: 24px; overflow: visible; }
  textarea { font: inherit; }
  textarea::placeholder { color: #000; opacity: 1; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style></head><body><main data-projection-scope="calibration" data-projection-owner="calibration" data-projection-generation="1">${markup}</main></body></html>`;

const calibrate = async (markup: string, diagnosticName?: string): Promise<ContrastFrame> => {
  let context: BrowserContext | undefined;
  let phase = 'context-start';
  if (diagnosticName) await recordCalibrationPhase(`${diagnosticName}-${phase}`);
  try {
    context = await browser.newContext({
      viewport: { width: 800, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.setContent(fixture(markup));
    await page.locator('[data-pui-root]').evaluateAll((elements) => {
      for (const element of elements) {
        element.setAttribute('data-projection-owner', 'calibration');
        element.setAttribute('data-projection-generation', '1');
      }
    });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => document.fonts.ready);
    phase = 'png-start';
    if (diagnosticName) await recordCalibrationPhase(`${diagnosticName}-${phase}`);
    const png = await page.screenshot({ type: 'png', caret: 'initial' });
    const image = png.toString('base64');
    if (diagnosticName) {
      await recordCalibrationFile(`${diagnosticName}.png`, png);
      await recordCalibrationFile(`${diagnosticName}.html`, fixture(markup));
      await recordCalibrationPhase(`${diagnosticName}-png-captured`);
    }
    phase = 'facts-start';
    // Keep paint falsifiers independent of the new fingerprint API so a
    // preserved old probe fails on its bad ratios, not a missing export.
    const frame = await page.evaluate(
      (image) =>
        window.puiContrastProbe.collectContrastFrame({ image, family: 'instrument-calibration' }),
      image
    );
    if (diagnosticName) await recordCalibrationPhase(`${diagnosticName}-facts-collected`);
    // Keep the exact failing calibration source and pixels in the existing CI
    // artifact directory. A failed calibration never reaches the audit runner.
    // This only records the observed subject; it changes no paint or assertion.
    if (diagnosticName && process.env.RUNNER_TEMP) {
      try {
        const sourceHead = execFileSync(
          'git',
          ['-C', fileURLToPath(new URL('.', import.meta.url)), 'rev-parse', 'HEAD'],
          { encoding: 'utf8' }
        ).trim();
        const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
        await recordCalibrationFile(
          `${diagnosticName}.json`,
          JSON.stringify(
            {
              sourceHead,
              observedAt: new Date().toISOString(),
              fixtureSha256: hash(fixture(markup)),
              probeBundleSha256: hash(bundle),
              pngSha256: hash(png),
              pngSize: { width: png.readUInt32BE(16), height: png.readUInt32BE(20) },
              viewport: await page.evaluate(() => ({
                width: innerWidth,
                height: innerHeight,
                devicePixelRatio,
                scrollX,
                scrollY,
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
              })),
              frame,
            },
            null,
            2
          )
        );
      } catch (error) {
        // Preserve the original calibration assertion even if diagnostics fail.
        console.error(`[contrast-calibration] ${diagnosticName} evidence save failed:`, error);
      }
    }
    return frame;
  } catch (error) {
    if (diagnosticName) await recordCalibrationPhase(`${diagnosticName}-${phase}-failed`, error);
    throw error;
  } finally {
    await context?.close();
  }
};

const surface = (frame: ContrastFrame, ref: string) => {
  const found = frame.surfaces.find((candidate) => candidate.ref === ref);
  if (!found) throw new Error(`Calibration surface missing: ${ref}`);
  return found;
};

describe('contrast probe / real Chromium instrument calibration', () => {
  it('rejects transparent and clipped popup acceptance despite Playwright visibility', async () => {
    const context = firstVisibilityContext;
    const page = firstVisibilityPage;
    const startedAt = performance.now();
    const phase = async (name: string, error?: unknown) => {
      console.info(
        `[contrast-calibration] popup-visibility:${name} elapsedMs=${Math.round(performance.now() - startedAt)}`
      );
      await recordCalibrationPhase(`popup-visibility-${name}`, error);
    };
    try {
      if (!context || !page) throw new Error('First calibration page bootstrap is missing.');
      await phase('fixture-start');
      await page.setContent(
        fixture(`
        <div id="normal" data-pui-root>Painted popup</div>
        <div id="transparent" data-pui-root style="opacity:0">Transparent popup</div>
        <div style="opacity:0"><div id="ancestor" data-pui-root>Transparent ancestor</div></div>
        <div style="height:0;overflow:hidden"><div id="clipped" data-pui-root>Clipped popup</div></div>
        <div id="unsupported" data-pui-root style="clip-path:inset(100%)">Unsupported clip</div>
      `)
      );
      await phase('probe-install-start');
      await page.addScriptTag({ content: bundle });
      await phase('native-visibility-start');
      // This is the original runner's false-positive acceptance, reproduced on
      // unchanged native Playwright semantics rather than a missing import.
      for (const id of ['transparent', 'ancestor', 'clipped'])
        expect(await page.locator(`#${id}`).isVisible()).toBe(true);
      await phase('paint-observation-start');
      const observations = await page.evaluate(() =>
        Object.fromEntries(
          ['normal', 'transparent', 'ancestor', 'clipped', 'unsupported'].map((id) => [
            id,
            window.puiContrastProbe.readContrastPaintedVisibility(document.getElementById(id)!),
          ])
        )
      );
      await phase('assertions-start');
      expect(observations.normal).toMatchObject({
        visible: true,
        classification: 'source-model-visible',
      });
      for (const id of ['transparent', 'ancestor', 'clipped'])
        expect(observations[id].visible).toBe(false);
      expect(observations.unsupported.classification).toBe('unsupported');
      await phase('assertions-passed');
    } catch (error) {
      await phase('failed', error);
      throw error;
    } finally {
      await phase('context-close-start');
      await context?.close();
      firstVisibilityContext = undefined;
      firstVisibilityPage = undefined;
      await phase('context-closed');
    }
  });

  it('withholds rounded overflow corner paint instead of accepting rectangular bounds', async () => {
    const frame = await calibrate(
      `
      <div style="position:absolute;left:40px;top:40px;width:700px;height:220px;background:white">
        <style>
          .clip-parent { position:absolute; top:40px; width:100px; height:100px; background:white; }
          .clip-parent > [data-pui-root] { position:absolute; left:0; top:0; width:8px; height:8px; min-height:0; margin:0; background:black; }
        </style>
        <div class="clip-parent" style="left:40px;overflow:hidden;border-radius:50%"><div data-pui-root data-demo-ref="rounded-hidden"></div></div>
        <div class="clip-parent" style="left:180px;overflow:clip;border-radius:50%"><div data-pui-root data-demo-ref="rounded-clip"></div></div>
        <div class="clip-parent" style="left:320px;overflow:hidden;border-radius:0"><div data-pui-root data-demo-ref="square-hidden"></div></div>
        <div class="clip-parent" style="left:460px;overflow:visible;border-radius:50%"><div data-pui-root data-demo-ref="rounded-visible"></div></div>
        <div class="clip-parent" style="left:600px;overflow:hidden;border-radius:40px"><div data-pui-root data-demo-ref="fixed-px-center" style="left:46px;top:46px"></div></div>
      </div>
    `,
      'rounded-overflow-clips'
    );
    for (const [ref, x, y] of [
      ['rounded-hidden', 80, 80],
      ['rounded-clip', 220, 80],
      ['square-hidden', 360, 80],
      ['rounded-visible', 500, 80],
      ['fixed-px-center', 686, 126],
    ] as const) {
      const target = surface(frame, ref);
      expect(target.rect).toEqual({ x, y, width: 8, height: 8 });
      expect(target.visible).toBe(true); // Bounds, not a claim about clipped pixels.
      if (ref === 'rounded-hidden' || ref === 'rounded-clip') {
        expect(target.visibility.classification).toBe('unsupported');
        expect(target.visibility.limits).toContain('unsupported-rounded-overflow-clip');
        expect(target.exterior).toEqual([]);
      } else {
        expect(target.visibility.classification).toBe('source-model-visible');
        expect(target.visibility.limits).toEqual([]);
        expect(target.exterior).toHaveLength(12);
      }
    }
  });

  for (const placement of ['target', 'ancestor'] as const) {
    for (const [property, value] of [
      ['filter', 'opacity(0)'],
      ['filter', 'blur(2px)'],
      ['backdrop-filter', 'blur(2px)'],
    ] as const) {
      it(`rejects ${placement} ${property}: ${value} in target and anatomy paint acceptance`, async () => {
        const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
        try {
          const page = await context.newPage();
          await page.setContent(
            fixture(`<section data-projection-content>
              <div id="ancestor"><button id="target" data-pui-root
                data-projection-owner="calibration" data-projection-generation="1"
                data-projection-prototype="instrument-target">Filtered target</button></div>
            </section>`)
          );
          await page
            .locator('[data-projection-scope]')
            .evaluate((scope) => scope.setAttribute('data-projection-state', 'ready'));
          await page.addScriptTag({ content: bundle });
          const target = page.locator('#target');
          const filteredElement = page.locator(`#${placement}`);
          const observe = () =>
            target.evaluate((element) => ({
              target: window.puiContrastProbe.readContrastTargetObservation(element),
              anatomy: window.puiContrastProbe.readContrastAnatomy(element),
            }));
          const unfiltered = await observe();
          expect(unfiltered.target.achieved).toBe(true);
          expect(unfiltered.anatomy.currentLease).toBe(true);
          expect(unfiltered.anatomy.surfaces[0].painted).toBe(true);
          await target.focus();
          await target.hover();
          await page.mouse.down();
          try {
            // Real CSS on an isolated instrument fixture. Filter is the only
            // changed paint input; bounds, opacity and native state stay intact.
            await filteredElement.evaluate(
              (element, input) => element.style.setProperty(input.property, input.value),
              { property, value }
            );
            expect(
              await filteredElement.evaluate(
                (element, property) => getComputedStyle(element).getPropertyValue(property),
                property
              )
            ).toBe(value);
            expect(await target.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
            expect(
              await page
                .locator('#ancestor')
                .evaluate((element) => getComputedStyle(element).opacity)
            ).toBe('1');
            const bounds = await target.boundingBox();
            expect(bounds!.width > 0 && bounds!.height > 0).toBe(true);
            expect(await target.isVisible()).toBe(true);
            const observation = await observe();
            expect(observation.target).toMatchObject({
              achieved: false,
              focused: true,
              hovered: true,
              nativeActive: true,
              visibility: {
                classification: 'unsupported',
                limits: expect.arrayContaining(['unsupported-filter-or-backdrop-filter']),
              },
            });
            expect(observation.anatomy.currentLease).toBe(true);
            expect(observation.anatomy.surfaces).toHaveLength(1);
            expect(observation.anatomy.surfaces[0]).toMatchObject({
              painted: false,
              visibility: { classification: 'unsupported' },
            });
            await filteredElement.evaluate(
              (element, property) => element.style.setProperty(property, 'none'),
              property
            );
            expect((await observe()).target).toMatchObject({
              achieved: true,
              focused: true,
              hovered: true,
              nativeActive: true,
              visibility: { classification: 'source-model-visible' },
            });
            expect((await observe()).anatomy.surfaces[0].painted).toBe(true);
          } finally {
            await page.mouse.up();
          }
        } finally {
          await context.close();
        }
      });
    }
  }

  it('collects exact current-lease anatomy and rejects omitted real-recipe Thumb and Indicator instances', async () => {
    for (const [family, demo, rootRef] of [
      ['switch', switchDemo, 'releaseAlertsSwitch'],
      ['checkbox', checkboxDemo, 'checkedCheckbox'],
      ['checkbox', checkboxDemo, 'mixedCheckbox'],
    ] as const) {
      const plan = compileContrastAnatomy(
        demo,
        PROJECTION_FAMILY_MANIFESTS.brutalist.families[family]
      );
      // Instrument-only DOM realizes the real recipe topology and ARIA facts.
      // It is not a substitute for rendering the shipped prototypes/adapters.
      const markup = (parent: string | null): string =>
        plan.instances
          .filter((node) => node.parent === parent)
          .map((node) => {
            const checked = node.props.defaultIndeterminate
              ? 'mixed'
              : node.props.defaultChecked
                ? 'true'
                : 'false';
            return `<div data-pui-root data-projection-prototype="${node.prototypeId}" ${node.ref ? `data-demo-ref="${node.ref}"` : ''} ${node.part === 'root' ? `role="${family}" aria-checked="${checked}"` : ''}>${markup(node.path)}</div>`;
          })
          .join('');
      const context = await browser.newContext({ viewport: { width: 800, height: 1200 } });
      try {
        const page = await context.newPage();
        await page.setContent(
          fixture(`
          <section data-projection-content>${markup(null)}</section>
          <div data-projection-control="runtime"><div data-pui-root aria-controls="reader-popup"></div></div>
          <div id="reader-popup" data-pui-root><div data-pui-root></div></div>
        `)
        );
        await page.locator('#reader-popup').evaluate((popup) => document.body.append(popup));
        await page
          .locator('[data-projection-scope]')
          .evaluate((scope) => scope.setAttribute('data-projection-state', 'ready'));
        await page.locator('[data-pui-root]').evaluateAll((roots) => {
          for (const root of roots) {
            root.setAttribute('data-projection-owner', 'calibration');
            root.setAttribute('data-projection-generation', '1');
          }
        });
        await page.addScriptTag({ content: bundle });
        const observe = () => page.evaluate(() => window.puiContrastProbe.readContrastAnatomy());
        expect(compareContrastAnatomy(plan, await observe()).achieved).toBe(true);
        const owner = page.locator(`[data-demo-ref="${rootRef}"]`);
        const before = await owner.getAttribute('aria-checked');
        await owner.locator('[data-pui-root]').evaluate((part) => part.remove());
        expect(await owner.getAttribute('aria-checked')).toBe(before);
        const after = await observe();
        expect(after.surfaces.some((surface) => surface.prototypeId === plan.rootPrototypeId)).toBe(
          true
        );
        expect(compareContrastAnatomy(plan, after).achieved).toBe(false);
      } finally {
        await context.close();
      }
    }
  });

  it('rejects unpainted exact interactive targets despite native focus, hover and held state', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    try {
      await page.setContent(fixture('<button id="target" data-pui-root>Native target</button>'));
      await page.addScriptTag({ content: bundle });
      const target = page.locator('#target');
      const observe = () =>
        target.evaluate((element) =>
          window.puiContrastProbe.readContrastTargetObservation(element)
        );
      await target.focus();
      await target.hover();
      await page.mouse.down();
      try {
        expect(await observe()).toMatchObject({
          achieved: true,
          focused: true,
          hovered: true,
          nativeActive: true,
        });
        // Only the isolated instrument fixture is mutated, never a component page.
        await target.evaluate((element) => {
          element.style.opacity = '0';
        });
        const bounds = await target.boundingBox();
        expect(bounds!.width > 0 && bounds!.height > 0).toBe(true);
        expect(await target.isVisible()).toBe(true);
        expect(await observe()).toMatchObject({
          achieved: false,
          focused: true,
          hovered: true,
          nativeActive: true,
        });
      } finally {
        await page.mouse.up();
      }
    } finally {
      await context.close();
    }
  });

  it('withholds placeholder ratios when text fill or shadow overrides plain color', async () => {
    const frame = await calibrate(`
      <style>
        #fill::placeholder { -webkit-text-fill-color: #fff; }
        #shadow::placeholder { text-shadow: 1px 1px #fff; }
      </style>
      <textarea data-pui-root data-demo-ref="normal-placeholder" placeholder="Normal"></textarea>
      <textarea id="fill" data-pui-root data-demo-ref="fill-placeholder" placeholder="Fill override"></textarea>
      <textarea id="shadow" data-pui-root data-demo-ref="shadow-placeholder" placeholder="Shadow override"></textarea>
    `);
    expect(surface(frame, 'normal-placeholder').placeholder?.ratio).toBeCloseTo(21, 8);
    for (const [ref, limit] of [
      ['fill-placeholder', 'unsupported-placeholder-text-fill-color'],
      ['shadow-placeholder', 'unsupported-placeholder-text-shadow'],
    ]) {
      const placeholder = surface(frame, ref).placeholder!;
      expect(placeholder.shown).toBe(true);
      expect(placeholder.ratio).toBeNull();
      expect(placeholder.classification).toBe('unsupported');
      expect(placeholder.limits).toContain(limit);
    }
  });

  it('withholds generated pseudo-layer pairs and numeric ink while retaining original pixels', async () => {
    const context = await browser.newContext({
      viewport: { width: 800, height: 700 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await page.setContent(
        fixture(`
        <style>
          main { display:grid; grid-template-columns:220px 220px; gap:24px; padding:24px; }
          .cell { position:relative; width:220px; height:64px; }
          [data-pui-root] { position:relative; width:220px; height:64px; min-height:64px; margin:0; border:2px solid black; }
          .before::before, .after::after, .ancestor::after, .hidden::before {
            content:""; position:absolute; inset:0; background:white; z-index:2; pointer-events:none;
          }
          .none::before { content:none; }
          .hidden::before { display:none; }
        </style>
        <div class="cell"><button data-pui-root data-demo-ref="plain">Plain text</button></div>
        <div class="cell"><button class="before" data-pui-root data-demo-ref="before">Covered text <span>child</span><svg><rect width="20" height="20" fill="black" /></svg></button></div>
        <div class="cell"><button class="after" data-pui-root data-demo-ref="after">Covered text</button></div>
        <div class="cell ancestor"><button data-pui-root data-demo-ref="ancestor">Covered text</button></div>
        <div class="cell"><button class="none" data-pui-root data-demo-ref="none">No generated layer</button></div>
        <div class="cell"><button class="hidden" data-pui-root data-demo-ref="hidden">Display-none layer</button></div>
        <div class="cell ancestor"><textarea data-pui-root data-demo-ref="native">Covered native value</textarea></div>
        <div class="cell ancestor"><textarea data-pui-root data-demo-ref="placeholder" placeholder="Covered placeholder"></textarea></div>
      `)
      );
      await page.locator('[data-pui-root]').evaluateAll((elements) => {
        for (const element of elements) {
          element.setAttribute('data-projection-owner', 'calibration');
          element.setAttribute('data-projection-generation', '1');
        }
      });
      await page.addScriptTag({ content: bundle });
      const pairs: Record<string, unknown> = {};
      for (const ref of ['plain', 'before', 'after', 'ancestor', 'none', 'hidden']) {
        const target = page.locator(`[data-demo-ref="${ref}"]`);
        await target.hover();
        await page.mouse.down();
        try {
          const pair = await target.evaluate((element) =>
            window.puiContrastProbe.readContrastPointerPair(
              element,
              { fill: '#fff', foreground: '#000' },
              true
            )
          );
          pairs[ref] = pair;
          expect(pair.hovered).toBe(true);
          expect(pair.nativeActive).toBe(true);
          expect(pair.fill).toBe(pair.expectedFill);
          expect(pair.foreground).toBe(pair.expectedForeground);
          const unsupported = ['before', 'after', 'ancestor'].includes(ref);
          expect(pair.achieved).toBe(!unsupported);
          if (unsupported)
            expect(pair.paintLimits).toContain('unsupported-generated-pseudo-element');
          else expect(pair.paintLimits).toEqual([]);
        } finally {
          await page.mouse.up();
        }
      }
      const png = await page.screenshot({ type: 'png', caret: 'initial' });
      await recordCalibrationFile('generated-pseudo-layers.png', png);
      const image = png.toString('base64');
      const frame = await page.evaluate(
        (image) =>
          window.puiContrastProbe.collectContrastFrame({ image, family: 'instrument-calibration' }),
        image
      );
      const pixels = await page.evaluate(async (image) => {
        const bitmap = await createImageBitmap(
          new Blob([Uint8Array.from(atob(image), (value) => value.charCodeAt(0))], {
            type: 'image/png',
          })
        );
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        return Object.fromEntries(
          ['before', 'after', 'ancestor', 'native', 'placeholder'].map((ref) => {
            const rect = document
              .querySelector(`[data-demo-ref="${ref}"]`)!
              .getBoundingClientRect();
            const x = Math.floor(rect.x + rect.width / 2),
              y = Math.floor(rect.y + rect.height / 2);
            return [ref, { x, y, rgba: Array.from(ctx.getImageData(x, y, 1, 1).data) }];
          })
        );
      }, image);
      for (const ref of ['plain', 'none', 'hidden'])
        expect(surface(frame, ref).textContrast?.ratio).toBeCloseTo(21, 8);
      for (const ref of ['before', 'after', 'ancestor', 'native', 'placeholder']) {
        const target = surface(frame, ref);
        expect(target.paint.limits).toContain('unsupported-generated-pseudo-element');
        expect(target.textContrast).toBeNull();
        expect(target.textRuns.every((run) => run.ratio === null)).toBe(true);
        expect(target.exterior).toHaveLength(12);
        expect(
          target.exterior.every(
            (edge) =>
              edge.innerBorderVsBackground === null &&
              edge.opaqueBorderVsPixel === null &&
              edge.opaqueFillVsPixel === null
          )
        ).toBe(true);
        expect(pixels[ref].rgba).toEqual([255, 255, 255, 255]);
      }
      expect(surface(frame, 'placeholder').placeholder?.ratio).toBeNull();
      expect(
        surface(frame, 'before').glyphs.every(
          (glyph) => glyph.fillContrast === null && glyph.strokeContrast === null
        )
      ).toBe(true);
      await recordCalibrationFile(
        'generated-pseudo-layers.json',
        JSON.stringify(
          {
            sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
            pngSha256: createHash('sha256').update(png).digest('hex'),
            frame,
            pairs,
            pixels,
          },
          null,
          2
        )
      );
    } finally {
      await context.close();
    }
  });

  it('requires real pointer state and both painted colors for item pair acceptance', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    try {
      await page.setContent(
        fixture(
          `<button id="item" data-pui-root style="background:#5294ff;color:#000">Item</button>`
        )
      );
      await page.addScriptTag({ content: bundle });
      const target = page.locator('#item');
      const observe = (held: boolean, fill = '#5294ff', foreground = '#000') =>
        target.evaluate(
          (element, input) =>
            window.puiContrastProbe.readContrastPointerPair(element, input, input.held),
          { held, fill, foreground }
        );
      expect((await observe(false)).achieved).toBe(false);
      await target.hover();
      expect((await observe(false)).achieved).toBe(true);
      expect((await observe(true)).achieved).toBe(false);
      await page.mouse.down();
      try {
        expect((await observe(true)).achieved).toBe(true);
        expect((await observe(true, '#fff')).achieved).toBe(false);
        expect((await observe(true, '#5294ff', '#fff')).achieved).toBe(false);
        // Instrument-only mutation control, never injected into component audit pages.
        await target.evaluate((element) => {
          element.style.opacity = '0';
        });
        expect((await observe(true)).achieved).toBe(false);
      } finally {
        await page.mouse.up();
      }
      expect((await observe(true)).achieved).toBe(false);
    } finally {
      await context.close();
    }
  });

  for (const placement of ['target', 'ancestor'] as const) {
    for (const [property, value, limit] of [
      ['opacity', '0.5', 'ancestor-or-target-opacity'],
      ['mix-blend-mode', 'multiply', 'blend-mode'],
    ] as const) {
      it(`rejects ${placement} ${property} for pointer pairs while native held state survives`, async () => {
        const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
        const page = await context.newPage();
        try {
          await page.setContent(
            fixture(`<div style="background:#f08080"><div id="ancestor">
              <button id="target" data-pui-root style="background:#5294ff;color:#000">Item</button>
            </div></div>`)
          );
          await page.addScriptTag({ content: bundle });
          const target = page.locator('#target');
          const observe = () =>
            target.evaluate((element) =>
              window.puiContrastProbe.readContrastPointerPair(
                element,
                { fill: '#5294ff', foreground: '#000' },
                true
              )
            );
          await target.hover();
          await page.mouse.down();
          try {
            expect((await observe()).achieved).toBe(true);
            await page
              .locator(`#${placement}`)
              .evaluate((element, input) => (element as HTMLElement).style.setProperty(...input), [
                property,
                value,
              ] as [string, string]);
            const changed = await observe();
            expect(changed.achieved).toBe(false);
            expect(changed.hovered).toBe(true);
            expect(changed.nativeActive).toBe(true);
            expect(changed.fill).toBe(changed.expectedFill);
            expect(changed.foreground).toBe(changed.expectedForeground);
            expect(changed.visibility.classification).toBe('source-model-visible');
            expect(changed.paintLimits).toContain(limit);
            await page
              .locator(`#${placement}`)
              .evaluate(
                (element, property) => (element as HTMLElement).style.removeProperty(property),
                property
              );
            expect((await observe()).achieved).toBe(true);
          } finally {
            await page.mouse.up();
          }
          expect((await observe()).achieved).toBe(false);
        } finally {
          await context.close();
        }
      });
    }
  }

  for (const [placement, property, value, limit] of [
    ['target', 'background-image', 'linear-gradient(white, white)', 'unsupported-background-image'],
    ['target', '-webkit-text-fill-color', 'white', 'unsupported-text-fill-color'],
    ['ancestor', '-webkit-text-fill-color', 'white', 'unsupported-text-fill-color'],
    ['target', 'text-shadow', 'white 0px 0px 3px', 'unsupported-text-shadow'],
    ['ancestor', 'text-shadow', 'white 0px 0px 3px', 'unsupported-text-shadow'],
    ['target', '-webkit-text-stroke-width', '2px', 'unsupported-text-stroke'],
    ['ancestor', '-webkit-text-stroke-width', '2px', 'unsupported-text-stroke'],
    ['target', 'box-shadow', 'white 0px 0px 0px 100px inset', 'unsupported-inset-shadow'],
    ['target', 'background-clip', 'text', 'unsupported-background-clip'],
  ] as const) {
    it(`withholds pointer pair for ${placement} ${property} without changing native facts`, async () => {
      const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
      const page = await context.newPage();
      try {
        await page.setContent(
          fixture(`<div id="ancestor">
          <button id="target" data-pui-root style="background:#5294ff;color:#000">Item</button>
        </div>`)
        );
        await page.addScriptTag({ content: bundle });
        const target = page.locator('#target');
        const observe = () =>
          target.evaluate((element) =>
            window.puiContrastProbe.readContrastPointerPair(
              element,
              { fill: '#5294ff', foreground: '#000' },
              true
            )
          );
        await target.hover();
        await page.mouse.down();
        try {
          expect((await observe()).achieved).toBe(true);
          await page
            .locator(`#${placement}`)
            .evaluate((element, input) => (element as HTMLElement).style.setProperty(...input), [
              property,
              value,
            ] as [string, string]);
          if (placement === 'ancestor') {
            // Native buttons can reset inherited text-shadow. First retain the
            // unaffected target as a positive control, then explicitly author
            // inheritance so this counterexample actually paints on the target.
            if (property === 'text-shadow') {
              const implicitShadow = await target.evaluate(
                (element) => getComputedStyle(element).textShadow
              );
              await recordCalibrationFile(
                'pointer-pair-text-shadow-implicit.json',
                JSON.stringify(
                  {
                    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
                      encoding: 'utf8',
                    }).trim(),
                    implicitShadow,
                  },
                  null,
                  2
                )
              );
              // Do not make a browser's UA default part of the support contract.
              await target.evaluate(
                (element) => ((element as HTMLElement).style.textShadow = 'none')
              );
              expect(await target.evaluate((element) => getComputedStyle(element).textShadow)).toBe(
                'none'
              );
              expect((await observe()).achieved).toBe(true);
            }
            await target.evaluate(
              (element, property) =>
                (element as HTMLElement).style.setProperty(property, 'inherit'),
              property
            );
            const effective = await target.evaluate(
              (element, property) => ({
                target: getComputedStyle(element).getPropertyValue(property),
                ancestor: getComputedStyle(element.parentElement!).getPropertyValue(property),
              }),
              property
            );
            expect(effective.target).toBe(effective.ancestor);
            expect(effective.target).not.toBe(
              property === '-webkit-text-stroke-width' ? '0px' : 'none'
            );
            await recordCalibrationFile(
              `pointer-pair-${property}-inherited.json`,
              JSON.stringify(
                {
                  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
                    encoding: 'utf8',
                  }).trim(),
                  property,
                  effective,
                  observation: await observe(),
                },
                null,
                2
              )
            );
          }
          const changed = await observe();
          expect(changed.achieved).toBe(false);
          expect(changed.paintLimits).toContain(limit);
          expect(changed.visibility.classification).toBe('source-model-visible');
          expect(changed.hovered).toBe(true);
          expect(changed.nativeActive).toBe(true);
          expect(changed.fill).toBe(changed.expectedFill);
          expect(changed.foreground).toBe(changed.expectedForeground);
          await page
            .locator(`#${placement}`)
            .evaluate(
              (element, property) => (element as HTMLElement).style.removeProperty(property),
              property
            );
          expect((await observe()).achieved).toBe(true);
        } finally {
          await page.mouse.up();
        }
        expect((await observe()).achieved).toBe(false);
      } finally {
        await context.close();
      }
    });
  }

  it('withholds all text-source ratios for stroke or zero-size ink while keeping independent fill', async () => {
    const frame = await calibrate(
      `
      <style>#stroke-placeholder::placeholder { -webkit-text-stroke: 1px #fff; } #zero-placeholder::placeholder { font-size: 0; }</style>
      <div data-pui-root data-demo-ref="plain-text">Plain text</div>
      <div data-pui-root data-demo-ref="stroke-text" style="-webkit-text-stroke:1px #fff">Stroked text</div>
      <div data-pui-root data-demo-ref="stroke-descendant"><span style="-webkit-text-stroke:1px #fff">Stroked descendant</span></div>
      <textarea data-pui-root data-demo-ref="plain-native">Native value</textarea>
      <textarea data-pui-root data-demo-ref="stroke-native" style="-webkit-text-stroke:1px #fff">Stroked native value</textarea>
      <textarea data-pui-root data-demo-ref="plain-placeholder" placeholder="Plain placeholder"></textarea>
      <textarea id="stroke-placeholder" data-pui-root data-demo-ref="stroke-placeholder" placeholder="Stroked placeholder"></textarea>
      <div data-pui-root data-demo-ref="zero-text" style="font-size:0">Zero-size direct text</div>
      <textarea data-pui-root data-demo-ref="zero-native" style="font-size:0">Zero-size native value</textarea>
      <textarea id="zero-placeholder" data-pui-root data-demo-ref="zero-placeholder" placeholder="Zero-size placeholder"></textarea>
    `,
      'all-text-stroke-domains'
    );
    for (const ref of ['plain-text', 'plain-native'])
      expect(surface(frame, ref).textContrast?.ratio).toBeCloseTo(21, 8);
    expect(surface(frame, 'plain-placeholder').placeholder?.ratio).toBeCloseTo(21, 8);
    for (const ref of ['stroke-text', 'stroke-descendant', 'stroke-native'])
      expect(surface(frame, ref).textContrast).toBeNull();
    for (const ref of ['stroke-text', 'stroke-native'])
      expect(surface(frame, ref).textContrastDisposition.limits).toContain(
        'unsupported-text-stroke'
      );
    for (const ref of ['stroke-text', 'stroke-descendant']) {
      const runs = surface(frame, ref).textRuns;
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) {
        expect(run.ratio).toBeNull();
        expect(run.classification).toBe('unsupported');
        expect(run.limits).toContain('unsupported-text-stroke');
      }
    }
    const placeholder = surface(frame, 'stroke-placeholder').placeholder!;
    expect(placeholder.shown).toBe(true);
    expect(placeholder.ratio).toBeNull();
    expect(placeholder.classification).toBe('unsupported');
    expect(placeholder.limits).toContain('unsupported-placeholder-text-stroke');
    for (const ref of ['zero-text', 'zero-native']) {
      const item = surface(frame, ref);
      expect(item.rect.width).toBeGreaterThan(0);
      expect(item.rect.height).toBeGreaterThan(0);
      expect(item.textContrast).toBeNull();
      expect(item.textContrastDisposition.limits).toContain('unsupported-font-size');
    }
    const zeroPlaceholder = surface(frame, 'zero-placeholder').placeholder!;
    expect(zeroPlaceholder.shown).toBe(true);
    expect(zeroPlaceholder.ratio).toBeNull();
    expect(zeroPlaceholder.limits).toContain('unsupported-placeholder-font-size');
    for (const item of frame.surfaces) expect(item.paint.fill).toEqual([255, 255, 255, 255]);
  });

  it('measures real text and glyph controls, not empty or descendant-only host ink', async () => {
    // Baseline falsifier: all opaque host boxes received 21:1, including empty,
    // SVG-only, child-only and empty-placeholder boxes with no direct black text.
    const frame = await calibrate(`
      <div data-pui-root data-demo-ref="empty"></div>
      <div data-pui-root data-demo-ref="glyph"><svg viewBox="0 0 24 24"><path d="M2 2L22 22" stroke="black" stroke-width="4" fill="none"/></svg></div>
      <div data-pui-root data-demo-ref="child"><span style="color:#777">Child ink</span></div>
      <div data-pui-root data-demo-ref="normal">Normal ink</div>
      <textarea data-pui-root data-demo-ref="placeholder" data-projection-prototype="brutalist-textarea-root" placeholder="Placeholder ink"></textarea>
      <textarea data-pui-root data-demo-ref="value" data-projection-prototype="brutalist-textarea-root">Native ink</textarea>
    `);
    for (const ref of ['empty', 'glyph', 'child', 'placeholder'])
      expect(surface(frame, ref).textContrast).toBeNull();
    expect(surface(frame, 'normal').textContrast?.ratio).toBeCloseTo(21, 8);
    expect(surface(frame, 'normal').textRuns[0].classification).toBe('source-model-only');
    expect(surface(frame, 'value').textContrast?.ratio).toBeCloseTo(21, 8);
    expect(surface(frame, 'placeholder').placeholder?.shown).toBe(true);
    expect(surface(frame, 'placeholder').placeholder?.ratio).toBeCloseTo(21, 8);
    const child = surface(frame, 'child').textRuns[0];
    expect(child.ratio).toBeGreaterThan(4);
    expect(child.ratio).toBeLessThan(4.5);
    const glyph = surface(frame, 'glyph').glyphs.find(
      (candidate) => candidate.tag.toLowerCase() === 'path'
    );
    expect(glyph?.strokeContrast).toBeCloseTo(21, 8);
    expect(glyph?.fillContrast).toBeNull();
  });

  it('withholds ratios for hidden, sr-only, overflow-clipped and offscreen runs', async () => {
    // Baseline falsifier: nonzero Range geometry admitted all these non-painted
    // runs. Exempt and unsupported are both honest; neither is a numerical pass.
    const frame = await calibrate(`
      <div data-pui-root data-demo-ref="visibility"><span style="visibility:hidden">Hidden ink</span><span class="sr-only">Accessible label</span></div>
      <div data-pui-root data-demo-ref="clipping"><div style="width:100px;height:20px;overflow:hidden"><span style="display:block;margin-top:50px">Clipped ink</span></div></div>
      <div data-pui-root data-demo-ref="offscreen"><span style="position:absolute;left:-10000px">Offscreen ink</span></div>
      <div data-pui-root data-demo-ref="control">Visible ink</div>
    `);
    const hidden = surface(frame, 'visibility').textRuns.find((run) => run.text === 'Hidden ink')!;
    expect(hidden.ratio).toBeNull();
    expect(hidden.classification).toBe('exempt');
    expect(hidden.limits).toContain('visibility-hidden-or-collapse');
    const sr = surface(frame, 'visibility').textRuns.find(
      (run) => run.text === 'Accessible label'
    )!;
    expect(sr.ratio).toBeNull();
    expect(sr.classification).toBe('unsupported');
    expect(sr.limits).toContain('unsupported-legacy-clip');
    for (const ref of ['clipping', 'offscreen']) {
      const run = surface(frame, ref).textRuns[0];
      expect(run.ratio).toBeNull();
      expect(run.classification).toBe('unsupported');
      expect(run.limits).toContain('offscreen-or-fully-clipped');
    }
    expect(surface(frame, 'control').textContrast?.ratio).toBeCloseTo(21, 8);
  });

  it('rejects SVG paint-server fallback and independently translucent stroke/fill', async () => {
    // Baseline falsifiers: url(...) silently retained canvas black; separately
    // inherited stroke-opacity/fill-opacity were ignored, inventing 21:1 ink.
    const frame = await calibrate(`
      <div data-pui-root data-demo-ref="stroke"><svg viewBox="0 0 24 24" stroke-opacity="0.1"><path d="M2 2L22 22" stroke="black" stroke-width="4" fill="none"/></svg></div>
      <div data-pui-root data-demo-ref="fill"><svg viewBox="0 0 24 24" fill-opacity="0.1"><path d="M2 2L22 2L22 22Z" fill="black" stroke="black" stroke-width="2"/></svg></div>
      <div data-pui-root data-demo-ref="gradient"><svg viewBox="0 0 24 24"><defs><linearGradient id="white"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient></defs><path d="M2 2L22 2L22 22Z" fill="url(#white)"/></svg></div>
      <div data-pui-root data-demo-ref="opaque"><svg viewBox="0 0 24 24"><path d="M2 2L22 2L22 22Z" fill="black" stroke="black" stroke-width="2"/></svg></div>
    `);
    const path = (ref: string) =>
      surface(frame, ref).glyphs.find((candidate) => candidate.tag.toLowerCase() === 'path')!;
    expect(path('stroke').strokeContrast).toBeNull();
    expect(Number(path('stroke').strokeOpacity)).toBeCloseTo(0.1, 8);
    expect(path('stroke').strokeLimits).toContain('unsupported-svg-stroke-alpha');
    expect(path('fill').fillContrast).toBeNull();
    expect(path('fill').fillLimits).toContain('unsupported-svg-fill-alpha');
    // Independent stroke is still opaque: blanket rejection would hide evidence.
    expect(path('fill').strokeContrast).toBeCloseTo(21, 8);
    expect(path('gradient').fillContrast).toBeNull();
    expect(path('gradient').fillLimits).toContain('unsupported-paint-server');
    expect(path('opaque').fillContrast).toBeCloseTo(21, 8);
  });

  it('requires supported nontransparent paint rather than positive transparent boxes', async () => {
    const frame = await calibrate(
      `
      <style>
        [data-pui-root] { background:transparent; color:transparent; -webkit-text-fill-color:transparent; border:0; outline:none; box-shadow:none; }
        #text-only, #descendant span { color:#000; -webkit-text-fill-color:#000; }
        #border-only { border:4px solid #000; }
        #fill-only { background:#000; }
        #non-srgb { background:oklch(0.7 0.1 40); }
      </style>
      <div data-pui-root data-demo-ref="transparent">Invisible authored text</div>
      <div data-pui-root data-demo-ref="empty" style="color:#000;-webkit-text-fill-color:#000"></div>
      <div data-pui-root data-demo-ref="hidden-child"><span style="color:#000;-webkit-text-fill-color:#000;opacity:0">Hidden ink</span></div>
      <div id="text-only" data-pui-root data-demo-ref="text-only">Visible text</div>
      <div id="descendant" data-pui-root data-demo-ref="descendant"><span>Visible descendant</span></div>
      <div id="border-only" data-pui-root data-demo-ref="border-only"></div>
      <div id="fill-only" data-pui-root data-demo-ref="fill-only"></div>
      <div id="non-srgb" data-pui-root data-demo-ref="non-srgb"></div>
      <div data-pui-root data-demo-ref="svg-stroke"><svg viewBox="0 0 24 24"><path d="M2 2L22 22" fill="none" stroke="black" stroke-width="2"/></svg></div>
      <div data-pui-root data-demo-ref="svg-transparent"><svg viewBox="0 0 24 24"><path d="M2 2L22 22" fill="none" stroke="transparent" stroke-width="2"/></svg></div>
      <div id="slot-visible" data-pui-root data-demo-ref="slot-visible">Visible assigned text</div>
      <div id="slot-hidden" data-pui-root data-demo-ref="slot-hidden">Hidden assigned text</div>
      <script>
        for (const id of ['slot-visible', 'slot-hidden']) {
          document.getElementById(id).attachShadow({mode:'open'}).innerHTML = '<div style="opacity:' + (id === 'slot-hidden' ? '0' : '1') + '"><slot style="color:black;-webkit-text-fill-color:black"></slot></div>';
        }
      </script>
    `,
      'nontransparent-paint-witness'
    );
    for (const ref of ['transparent', 'empty', 'hidden-child', 'svg-transparent', 'slot-hidden']) {
      const item = surface(frame, ref);
      expect(item.rect.width).toBeGreaterThan(0);
      expect(item.rect.height).toBeGreaterThan(0);
      expect(item.visibility.classification).toBe('unsupported');
      expect(item.visibility.limits).toContain('no-supported-nontransparent-paint');
      expect(item.textContrast).toBeNull();
    }
    for (const ref of [
      'text-only',
      'descendant',
      'border-only',
      'fill-only',
      'non-srgb',
      'svg-stroke',
      'slot-visible',
    ])
      expect(surface(frame, ref).visibility.classification).toBe('source-model-visible');
    // Existence of opaque non-sRGB paint does not extend numeric color support.
    expect(surface(frame, 'non-srgb').paint.fill).toBeNull();
    expect(surface(frame, 'non-srgb').paint.limits).toContain('unsupported-resolved-color-syntax');
  });

  it('withholds unfillable SVG ink while retaining independent stroke and positive-area controls', async () => {
    const frame = await calibrate(
      `
      <div data-pui-root data-demo-ref="line"><svg viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2"><line x1="2" y1="2" x2="22" y2="22"/></svg></div>
      <div data-pui-root data-demo-ref="segment"><svg viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2"><path d="M2 2L22 22"/></svg></div>
      <div data-pui-root data-demo-ref="collinear"><svg viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2"><path d="M2 2L12 12L22 22Z"/></svg></div>
      <div data-pui-root data-demo-ref="css-override"><svg viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2"><path d="M2 2L22 2L22 22Z" style='d:path("M2 2L22 22")'/></svg></div>
      <div data-pui-root data-demo-ref="triangle"><svg viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2"><path d="M2 2L22 2L22 22Z"/></svg></div>
      <div data-pui-root data-demo-ref="rect"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="black"/></svg></div>
      <div data-pui-root data-demo-ref="circle"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="black"/></svg></div>
    `,
      'svg-fill-area'
    );
    const glyph = (ref: string) =>
      surface(frame, ref).glyphs.find((part) => part.tag.toLowerCase() !== 'svg')!;
    for (const ref of ['line', 'segment', 'collinear', 'css-override']) {
      expect(glyph(ref).fill).not.toBe('none');
      expect(glyph(ref).fillContrast).toBeNull();
      expect(glyph(ref).fillLimits).toContain('unsupported-svg-fill-geometry');
      expect(glyph(ref).strokeContrast).toBeCloseTo(21, 8);
    }
    for (const ref of ['triangle', 'rect', 'circle'])
      expect(glyph(ref).fillContrast).toBeCloseTo(21, 8);
  });

  it('measures supported opaque boundary fills but withholds image and clipped fill ratios', async () => {
    // The baseline reported the white CSS color as 21:1 even when an opaque
    // black image replaced it or padding-box clipping removed it at the edge.
    const frame = await calibrate(`
      <div style="background:black;padding:16px">
        <div data-pui-root data-demo-ref="supported">Flat white fill</div>
        <div data-pui-root data-demo-ref="gradient" style="background-image:linear-gradient(black,black);border:4px solid white">Image fill</div>
        <div data-pui-root data-demo-ref="padding-clip" style="background-clip:padding-box;border:4px solid white">Clipped fill</div>
      </div>
    `);
    for (const ref of ['supported', 'gradient', 'padding-clip']) {
      const target = surface(frame, ref);
      expect(target.exterior[0].point?.rgb).toEqual([0, 0, 0]);
      for (const edge of target.exterior) {
        expect(edge.point?.rgb).toEqual([0, 0, 0]);
        if (ref === 'supported') expect(edge.opaqueFillVsPixel).toBeCloseTo(21, 8);
        else {
          expect(edge.opaqueFillVsPixel).toBeNull();
          // Withholding unsupported fill must not erase the separately
          // supported white border against native-sampled black neighbors.
          expect(edge.opaqueBorderVsPixel).toBeCloseTo(21, 8);
        }
      }
    }
    expect(surface(frame, 'gradient').paint.limits).toContain('background-image');
    expect(surface(frame, 'padding-clip').paint.limits).toContain(
      'unsupported-background-clip-perimeter'
    );
  });

  it('withholds non-solid border ratios per side while preserving solid and fill evidence', async () => {
    // Border style is an instrument-domain boundary. Native CSSOM and PNG
    // neighbors are observed here; no assertion assumes a dash gap location.
    // The old source model emitted 21:1 for all three unsupported border styles.
    // The native zero-width label's Z painted into its left exterior sample.
    // Inset only that label; retain its zero border and original border-box.
    const frame = await calibrate(
      `
      <div style="background:white;padding:16px">
        <div data-pui-root data-demo-ref="solid" style="border:4px solid black">Solid control</div>
        <div data-pui-root data-demo-ref="dashed" style="border:4px dashed black">Dashed border</div>
        <div data-pui-root data-demo-ref="dotted" style="border:4px dotted black">Dotted border</div>
        <div data-pui-root data-demo-ref="double" style="border:4px double black">Double border</div>
        <div data-pui-root data-demo-ref="mixed" style="border:4px black;border-style:dashed solid dotted double">Mixed sides</div>
        <div data-pui-root data-demo-ref="zero" style="border:0 solid black;text-indent:4px">Zero width</div>
      </div>
      <div style="background:black;padding:16px">
        <div data-pui-root data-demo-ref="fill" style="border:4px dashed black">Independent white fill</div>
      </div>
    `,
      'border-style-domain'
    );
    const mixed: Record<string, string> = {
      top: 'dashed',
      right: 'solid',
      bottom: 'dotted',
      left: 'double',
    };
    // Preserve every original 733397ae1 native box, including the six controls
    // whose paint and layout are not changed by the borderless-label repair.
    const top: Record<string, number> = {
      solid: 48,
      dashed: 88,
      dotted: 128,
      double: 168,
      mixed: 208,
      zero: 248,
      fill: 328,
    };
    expect(frame.devicePixelRatio).toBe(1);
    for (const ref of ['solid', 'dashed', 'dotted', 'double', 'mixed', 'zero', 'fill']) {
      const target = surface(frame, ref);
      expect(target.rect, ref).toEqual({ x: 40, y: top[ref], width: 220, height: 32 });
      expect(target.exterior, ref).toHaveLength(12);
      for (const edge of target.exterior) {
        const observed = JSON.stringify({
          ref,
          devicePixelRatio: frame.devicePixelRatio,
          rect: target.rect,
          style: target.style,
          paint: target.paint,
          border: target.borders[edge.side],
          edge,
        });
        const expectedStyle =
          ref === 'mixed'
            ? mixed[edge.side]
            : ref === 'fill'
              ? 'dashed'
              : ref === 'zero'
                ? 'solid'
                : ref;
        expect(target.borders[edge.side].style, observed).toBe(expectedStyle);
        expect(target.borders[edge.side].width, observed).toBe(ref === 'zero' ? 0 : 4);
        expect(edge.point?.rgb, observed).toEqual(ref === 'fill' ? [0, 0, 0] : [255, 255, 255]);
        if (expectedStyle === 'solid' && ref !== 'zero') {
          expect(edge.innerBorderVsBackground, observed).toBeCloseTo(21, 8);
          expect(edge.opaqueBorderVsPixel, observed).toBeCloseTo(21, 8);
          expect(target.borders[edge.side].limits, observed).toEqual([]);
        } else {
          expect(edge.innerBorderVsBackground, observed).toBeNull();
          expect(edge.opaqueBorderVsPixel, observed).toBeNull();
          if (expectedStyle !== 'solid')
            expect(target.borders[edge.side].limits, observed).toContain(
              'unsupported-border-style'
            );
        }
        expect(edge.opaqueFillVsPixel, observed).toBeCloseTo(ref === 'fill' ? 21 : 1, 8);
      }
    }
    // Pair the unchanged exterior pixels/boxes above with the observed text
    // Range: only the zero-width label moves from native x=40 to x=44.
    const snapshots = JSON.parse(frame.stateFingerprint).surfaces as {
      host: { attributes: [string, string][] };
      target: [unknown, [{ text?: string; rects?: number[][] }, unknown][]];
    }[];
    const zero = snapshots.find((entry) =>
      entry.host.attributes.some(([name, value]) => name === 'data-demo-ref' && value === 'zero')
    );
    expect(zero?.target[1]).toHaveLength(1);
    const label = zero!.target[1][0][0];
    expect(label.text).toBe('Zero width');
    expect(label.rects).toHaveLength(1);
    expect(label.rects?.[0]?.[0]).toBe(44);
  });

  it('retains fractional CSS alpha before raster bytes can round it opaque', async () => {
    // CSS Color 4 retains the fractional value in this user agent. Legacy rgba
    // already quantizes .999 to opaque in CSSOM, before the probe can see it.
    // The baseline canvas byte still rounds this retained alpha to 255.
    const frame = await calibrate(`
      <div data-pui-root data-demo-ref="alpha-ink" style="color:color(srgb 0 0 0 / .999)">Near opaque ink</div>
      <div style="background:black"><div data-pui-root data-demo-ref="alpha-fill" style="background:color(srgb 1 1 1 / .999)">Opaque ink over fractional fill</div></div>
      <div data-pui-root data-demo-ref="opaque">Opaque control</div>
    `);
    const ink = surface(frame, 'alpha-ink');
    expect(ink.textContrast).toBeNull();
    expect(ink.textRuns[0].ratio).toBeNull();
    expect(ink.textRuns[0].limits).toContain('unsupported-translucent-text-ink');
    expect(ink.paint.textAlpha).toBeCloseTo(0.999, 8);
    const fill = surface(frame, 'alpha-fill');
    expect(fill.paint.fillAlpha).toBeCloseTo(0.999, 8);
    expect(fill.paint.compositedBackground?.[0]).toBeCloseTo(254.745, 6);
    expect(fill.textContrast?.ratio).toBeLessThan(21);
    expect(fill.textContrast?.ratio).toBeGreaterThan(20.9);
    expect(fill.exterior.every((edge) => edge.opaqueFillVsPixel === null)).toBe(true);
    expect(surface(frame, 'opaque').textContrast?.ratio).toBeCloseTo(21, 8);
  });

  it('labels inset source-model ratios without claiming receiving-pixel adjacency', async () => {
    // Baseline falsifier: a white inset ring on white child paint over a black
    // parent had model 21:1 and no receiving samples but claimed pixel evidence.
    const frame = await calibrate(`
      <div data-pui-root data-demo-ref="inset" style="background:black;box-shadow:inset 0 0 0 4px white;padding:4px"><div style="background:white;height:24px">White child</div></div>
    `);
    const shadow = surface(frame, 'inset').shadows[0];
    expect('insetVsFill' in shadow && shadow.insetVsFill).toBeCloseTo(21, 8);
    expect('insetBasis' in shadow && shadow.insetBasis).toBe('source-model-only');
    expect('renderedAdjacency' in shadow && shadow.renderedAdjacency).toBe('unresolved');
    expect('receiving' in shadow && shadow.receiving).toEqual([]);
    expect(shadow.limitation).toContain('no receiving pixels measured');
  });

  it('samples translated controls and ancestors at their painted perimeter and shadow neighbors', async () => {
    // These displacements all used to become visible:false and lose every
    // perimeter/receiving sample. Fixed coordinates also reject unshifted boxes.
    const frame = await calibrate(`
      <style>
        .translated { position:absolute; width:100px; height:40px; min-height:0; margin:0; border:2px solid black; box-shadow:8px 6px 0 0 black; }
      </style>
      <div style="position:absolute;left:100px;top:80px;width:500px;height:400px;background:white">
        <div data-pui-root data-demo-ref="matrix" class="translated" style="left:20px;top:20px;transform:matrix(1,0,0,1,30,12)">Matrix</div>
        <div data-pui-root data-demo-ref="individual" class="translated" style="left:20px;top:100px;translate:calc(20% + 10px) 12px;rotate:0deg;scale:1 1">Individual</div>
        <div style="position:absolute;left:20px;top:180px;transform:translate(30px,12px)"><div data-pui-root data-demo-ref="ancestor" class="translated" style="left:0;top:0">Ancestor</div></div>
      </div>
    `);
    for (const [ref, y] of [
      ['matrix', 112],
      ['individual', 192],
      ['ancestor', 272],
    ] as const) {
      const target = surface(frame, ref);
      expect(target.visible).toBe(true);
      expect(target.visibility).toEqual({ classification: 'source-model-visible', limits: [] });
      expect(target.rect).toEqual({ x: 150, y, width: 100, height: 40 });
      expect(target.textContrast?.ratio).toBeCloseTo(21, 8);
      expect(
        target.exterior.map(({ side, point }) => ({ side, x: point?.x, y: point?.y }))
      ).toEqual(
        [0.25, 0.5, 0.75].flatMap((fraction) => [
          { side: 'top', x: 150 + 100 * fraction, y: y - 1 },
          { side: 'left', x: 149, y: y + 40 * fraction },
          { side: 'bottom', x: 150 + 100 * fraction, y: y + 41 },
          { side: 'right', x: 251, y: y + 40 * fraction },
        ])
      );
      for (const edge of target.exterior.filter(({ side }) => side === 'top' || side === 'left')) {
        expect(edge.point?.rgb).toEqual([255, 255, 255]);
        expect(edge.opaqueBorderVsPixel).toBeCloseTo(21, 8);
      }
      // The exterior bottom/right lie in black shadow, whereas these receiving
      // pixels lie just beyond it on white. Both coordinate and ink errors fail.
      for (const edge of target.exterior.filter(
        ({ side }) => side === 'bottom' || side === 'right'
      )) {
        expect(edge.point?.rgb).toEqual([0, 0, 0]);
        expect(edge.opaqueBorderVsPixel).toBeCloseTo(1, 8);
      }
      expect(target.shadows[0].receiving).toEqual([
        { side: 'right', point: { x: 259, y: y + 26, rgb: [255, 255, 255] }, ratio: 21 },
        { side: 'bottom', point: { x: 208, y: y + 47, rgb: [255, 255, 255] }, ratio: 21 },
      ]);
    }
  });

  it('withholds border-image ink ratios independently of the fill model', async () => {
    const frame = await calibrate(
      `
      <div style="position:absolute;left:40px;top:40px;width:700px;height:500px;box-sizing:border-box;padding:24px;background:white">
        <div data-pui-root data-demo-ref="image-border" style="border:8px solid black;border-image:linear-gradient(white,white) 1">Border image</div>
        <div data-pui-root data-demo-ref="color-border" style="border:8px solid black">Solid control</div>
      </div>
    `,
      'border-image-domain'
    );
    // Keep all four one-pixel exterior neighborhoods inside the white receiver.
    // Without padding, x=39 on the left sampled the black page outside its x=40 edge.
    expect(frame.devicePixelRatio).toBe(1);
    for (const [ref, y] of [
      ['image-border', 72],
      ['color-border', 120],
    ] as const) {
      const target = surface(frame, ref);
      expect(target.rect).toEqual({ x: 64, y, width: 220, height: 40 });
      expect(
        target.exterior.map(({ side, point }) => ({ side, x: point?.x, y: point?.y }))
      ).toEqual(
        [0.25, 0.5, 0.75].flatMap((fraction) => [
          { side: 'top', x: 64 + 220 * fraction, y: y - 1 },
          { side: 'left', x: 63, y: y + 40 * fraction },
          { side: 'bottom', x: 64 + 220 * fraction, y: y + 41 },
          { side: 'right', x: 285, y: y + 40 * fraction },
        ])
      );
    }
    const image = surface(frame, 'image-border');
    for (const edge of image.exterior) {
      expect(edge.innerBorderVsBackground).toBeNull();
      expect(edge.opaqueBorderVsPixel).toBeNull();
      expect(edge.point?.rgb).toEqual([255, 255, 255]);
      expect(edge.opaqueFillVsPixel).toBe(1);
      expect(image.borders[edge.side].limits).toContain('unsupported-border-image');
    }
    for (const edge of surface(frame, 'color-border').exterior) {
      expect(edge.innerBorderVsBackground).toBe(21);
      expect(edge.opaqueBorderVsPixel).toBe(21);
    }
  });

  it('withholds rounded perimeter metrics without discarding sampled pixels or text', async () => {
    const frame = await calibrate(
      `
      <div style="position:absolute;left:40px;top:40px;width:700px;height:600px;background:white">
        <div data-pui-root data-demo-ref="round" style="width:100px;height:100px;border:4px solid black;border-radius:50%;box-shadow:8px 6px 0 0 black">Round</div>
        <div data-pui-root data-demo-ref="elliptical" style="border-radius:0 20% / 0 30%;border:4px solid black">Ellipse</div>
        <div data-pui-root data-demo-ref="square" style="border-radius:0;border:4px solid black">Square</div>
      </div>
    `,
      'rounded-perimeter'
    );
    for (const ref of ['round', 'elliptical']) {
      const target = surface(frame, ref);
      expect(target.exterior).toHaveLength(12);
      for (const edge of target.exterior) {
        expect(edge.point).not.toBeNull();
        expect(edge.innerBorderVsBackground).toBeNull();
        expect(edge.opaqueBorderVsPixel).toBeNull();
        expect(edge.opaqueFillVsPixel).toBeNull();
      }
      expect(target.perimeterLimits).toEqual(['unsupported-rounded-perimeter']);
    }
    expect(surface(frame, 'round').shadows[0].receiving).toEqual([]);
    expect(surface(frame, 'round').shadows[0].limits).toContain('unsupported-rounded-perimeter');
    expect(surface(frame, 'square').perimeterLimits).toEqual([]);
    expect(surface(frame, 'square').exterior[0].opaqueBorderVsPixel).toBe(21);
  });

  it('withholds unpainted shadow sides while retaining negative offsets covered by spread', async () => {
    const frame = await calibrate(
      `
      <div style="position:absolute;left:40px;top:40px;width:700px;height:700px;background:white">
        <style>.shadow-case { width:100px; height:40px; margin:30px; }</style>
        <div data-pui-root data-demo-ref="zero-shadow" class="shadow-case" style="box-shadow:0 0 0 0 black"></div>
        <div data-pui-root data-demo-ref="negative-shadow" class="shadow-case" style="box-shadow:-8px -6px 0 0 black"></div>
        <div data-pui-root data-demo-ref="mixed-shadow" class="shadow-case" style="box-shadow:-8px 6px 0 0 black"></div>
        <div data-pui-root data-demo-ref="spread-shadow" class="shadow-case" style="box-shadow:-2px -3px 0 8px black"></div>
        <div data-pui-root data-demo-ref="collapsed-shadow" class="shadow-case" style="box-shadow:60px 60px 0 -21px black"></div>
      </div>
    `,
      'signed-shadow-sides'
    );
    for (const ref of ['zero-shadow', 'negative-shadow', 'collapsed-shadow']) {
      expect(surface(frame, ref).shadows[0].receiving).toEqual([
        { side: 'right', point: null, ratio: null },
        { side: 'bottom', point: null, ratio: null },
      ]);
    }
    const mixed = surface(frame, 'mixed-shadow').shadows[0].receiving!;
    expect(mixed[0]).toEqual({ side: 'right', point: null, ratio: null });
    expect(mixed[1].point?.rgb).toEqual([255, 255, 255]);
    expect(mixed[1].ratio).toBe(21);
    const spread = surface(frame, 'spread-shadow');
    expect(spread.shadows[0].receiving).toEqual([
      {
        side: 'right',
        point: { x: spread.rect.x + 107, y: spread.rect.y + 17, rgb: [255, 255, 255] },
        ratio: 21,
      },
      {
        side: 'bottom',
        point: { x: spread.rect.x + 48, y: spread.rect.y + 46, rgb: [255, 255, 255] },
        ratio: 21,
      },
    ]);
  });

  it('keeps transformed visible bounds without inventing rectangular edge or shadow ratios', async () => {
    const frame = await calibrate(`
      <style>
        .unsupported-transform { position:absolute; left:40px; width:100px; height:40px; min-height:0; margin:0; border:2px solid black; box-shadow:8px 6px 0 0 black,inset 0 0 0 4px black; }
      </style>
      <div style="position:absolute;left:100px;top:80px;width:500px;height:700px;background:white">
        <div data-pui-root data-demo-ref="rotated" class="unsupported-transform" style="top:40px;rotate:15deg">Rotated</div>
        <div data-pui-root data-demo-ref="scaled" class="unsupported-transform" style="top:140px;scale:1.5">Scaled</div>
        <div data-pui-root data-demo-ref="sheared" class="unsupported-transform" style="top:240px;transform:matrix(1,0,0.2,1,0,0)">Sheared</div>
        <div data-pui-root data-demo-ref="depth" class="unsupported-transform" style="top:340px;translate:0 0 10px">Depth</div>
        <div style="position:absolute;top:440px;perspective:500px"><div data-pui-root data-demo-ref="perspective" class="unsupported-transform">Perspective</div></div>
      </div>
    `);
    for (const ref of ['rotated', 'scaled', 'sheared', 'depth', 'perspective']) {
      const target = surface(frame, ref);
      expect(target.visible).toBe(true);
      expect(target.visibility.classification).toBe('unsupported');
      expect(target.visibility.limits).toContain('unsupported-transformed-paint');
      expect(target.exterior).toEqual([]);
      expect(target.textContrast).toBeNull();
      for (const shadow of target.shadows) {
        expect(shadow.limits).toContain('unsupported-transformed-paint');
        expect(shadow.receiving).toEqual([]);
        expect(shadow.insetVsFill).toBeNull();
      }
    }
    // These are actual transformed bounds, not a visibility flag synthesized
    // from support status or the untransformed CSS width/height.
    expect(surface(frame, 'scaled').rect).toEqual({ x: 115, y: 210, width: 150, height: 60 });
    expect(surface(frame, 'rotated').rect.height).toBeGreaterThan(60);
  });

  it('inherits inactive part exemptions only through current composed control ownership', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
    try {
      const page = await context.newPage();
      await page.setContent(
        fixture(`
        <div id="checkbox" data-pui-root role="checkbox" aria-disabled="false">
          <div id="boundary" aria-disabled="true">
            <div data-pui-root data-demo-ref="indicator" data-projection-prototype="brutalist-checkbox-indicator">Indicator ink<svg viewBox="0 0 24 24"><path d="M2 2L22 22" stroke="black" stroke-width="4" fill="none"/></svg></div>
          </div>
        </div>
        <div id="switch" data-pui-root role="switch" aria-disabled="false">
          <div slot="thumb" data-pui-root data-demo-ref="thumb" data-projection-prototype="brutalist-switch-thumb">Thumb ink</div>
        </div>
      `)
      );
      await page.evaluate(() => {
        for (const element of document.querySelectorAll('[data-pui-root]')) {
          element.setAttribute('data-projection-owner', 'calibration');
          element.setAttribute('data-projection-generation', '1');
        }
        document.querySelector('#switch')!.attachShadow({ mode: 'open' }).innerHTML =
          '<div><slot name="thumb"></slot></div>';
      });
      await page.addScriptTag({ content: bundle });
      await page.evaluate(() => document.fonts.ready);
      const capture = async () => {
        const image = (await page.screenshot({ type: 'png', caret: 'initial' })).toString('base64');
        return await page.evaluate(
          (image) =>
            window.puiContrastProbe.collectContrastFrame({
              image,
              family: 'instrument-calibration',
            }),
          image
        );
      };
      const active = await capture();
      const indicator = surface(active, 'indicator');
      // A generic aria-disabled wrapper is not a Proto control. The slotted
      // thumb retains its existing unsupported background model, not exemption.
      expect(indicator.inactive).toBe(false);
      expect(indicator.textRuns[0].classification).toBe('source-model-only');
      expect(indicator.textRuns[0].ratio).toBeCloseTo(21, 8);
      expect(surface(active, 'thumb').inactive).toBe(false);
      expect(surface(active, 'thumb').textRuns[0].classification).toBe('unsupported');
      await page.evaluate(() => {
        document.querySelector('#checkbox')!.setAttribute('aria-disabled', 'true');
        document.querySelector('#switch')!.setAttribute('aria-disabled', 'true');
      });
      const disabled = await capture();
      // Preserved e4 fails here: neither independently collected part has its
      // own aria-disabled, though both composed owning controls are disabled.
      for (const ref of ['indicator', 'thumb']) {
        const part = surface(disabled, ref);
        expect(part.inactive).toBe(true);
        expect(part.visible).toBe(true);
        expect(part.textContrastDisposition.classification).toBe('exempt');
        expect(part.textRuns[0].classification).toBe('exempt');
        expect(part.textRuns[0].ratio).toBeNull();
        expect(part.textRuns[0].limits).toContain('inactive-component');
        expect(part.exterior[0].opaqueFillVsPixel).toBeNull();
      }
      const disabledPath = surface(disabled, 'indicator').glyphs.find(
        (glyph) => glyph.tag.toLowerCase() === 'path'
      )!;
      expect(disabledPath.strokeContrast).toBeNull();
      expect(disabledPath.strokeLimits).toContain('inactive-component');
      await page.evaluate(() => {
        document.querySelector('#checkbox')!.removeAttribute('aria-disabled');
        document.querySelector('#switch')!.setAttribute('aria-disabled', 'false');
      });
      const reactivated = await capture();
      expect(surface(reactivated, 'indicator').inactive).toBe(false);
      expect(surface(reactivated, 'indicator').textRuns[0].ratio).toBeCloseTo(21, 8);
      expect(surface(reactivated, 'thumb').textRuns[0].classification).toBe('unsupported');
      await page.evaluate(() => {
        document.querySelector('#checkbox')!.setAttribute('aria-disabled', 'true');
        const boundary = document.querySelector('#boundary')!;
        boundary.setAttribute('data-projection-scope', 'foreign-preview');
        boundary.setAttribute('data-projection-owner', 'foreign-preview');
        boundary.setAttribute('data-projection-generation', '1');
      });
      const foreign = surface(await capture(), 'indicator');
      expect(foreign.inactive).toBe(false);
      expect(foreign.textRuns[0].classification).toBe('source-model-only');
      await page.evaluate(() => {
        const boundary = document.querySelector('#boundary')!;
        boundary.setAttribute('data-projection-scope', 'calibration');
        boundary.setAttribute('data-projection-owner', 'calibration');
        boundary.setAttribute('data-projection-generation', '0');
      });
      const stale = surface(await capture(), 'indicator');
      expect(stale.inactive).toBe(false);
      expect(stale.textRuns[0].ratio).toBeCloseTo(21, 8);
      await page.evaluate(() => {
        document.querySelector('#boundary')!.setAttribute('data-projection-control', 'runtime');
      });
      expect((await capture()).surfaces.some((part) => part.ref === 'indicator')).toBe(false);
    } finally {
      await context.close();
    }
  });

  it('binds facts to actual native targets, composed slot constraints and state changes', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
    try {
      const page = await context.newPage();
      await page.setContent(
        fixture(
          `<div data-pui-root data-demo-ref="editor" data-projection-owner="calibration" data-projection-generation="1" data-projection-prototype="brutalist-textarea-root"><textarea>Native target</textarea></div><div id="slotted"><span slot="label">Slotted ink</span></div>`
        )
      );
      await page.evaluate(() => {
        const host = document.querySelector('#slotted')!;
        host.attachShadow({ mode: 'open' }).innerHTML =
          '<div style="overflow:hidden;height:30px"><slot name="label"></slot></div>';
        const child = host.querySelector('span')!;
        child.setAttribute('data-pui-root', '');
        child.setAttribute('data-projection-owner', 'calibration');
        child.setAttribute('data-projection-generation', '1');
      });
      await page.addScriptTag({ content: bundle });
      const before = await page.evaluate(() => window.puiContrastProbe.readContrastState());
      expect(await page.evaluate(() => window.puiContrastProbe.readContrastState())).toBe(before);
      await page.locator('textarea').fill('Changed native target');
      const changedValue = await page.evaluate(() => window.puiContrastProbe.readContrastState());
      expect(changedValue).not.toBe(before);
      await page.evaluate(() => {
        const editor = document.querySelector('textarea')!;
        const replacement = editor.cloneNode(true) as HTMLTextAreaElement;
        replacement.value = editor.value;
        editor.replaceWith(replacement);
      });
      const replacedTarget = await page.evaluate(() => window.puiContrastProbe.readContrastState());
      expect(replacedTarget).not.toBe(changedValue);
      await page.evaluate(() => {
        (
          document.querySelector('#slotted')!.shadowRoot!.querySelector('div') as HTMLElement
        ).style.clipPath = 'inset(100%)';
      });
      const changedAncestor = await page.evaluate(() =>
        window.puiContrastProbe.readContrastState()
      );
      expect(changedAncestor).not.toBe(replacedTarget);
      const image = (await page.screenshot({ type: 'png', caret: 'initial' })).toString('base64');
      const frame = await page.evaluate(
        (image) =>
          window.puiContrastProbe.collectContrastFrame({ image, family: 'instrument-calibration' }),
        image
      );
      expect(frame.stateFingerprint).toBe(changedAncestor);
      expect(surface(frame, 'editor').text).toBe('Changed native target');
      const slotted = frame.surfaces.find((candidate) => candidate.ref === null)!;
      expect(slotted.textContrast).toBeNull();
      expect(slotted.textRuns[0].limits).toContain('unsupported-slot-background-model');
      expect(slotted.textRuns[0].limits).toContain('unsupported-clip-path-or-mask');
    } finally {
      await context.close();
    }
  });

  it('invalidates CSSOM-only decoration drift without relying on attributes or layout changes', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    try {
      const page = await context.newPage();
      await page.setContent(
        fixture(
          `<style id="decoration-source">.decoration { text-decoration-line:underline; text-decoration-color:rgb(0,0,0); text-decoration-thickness:1px; text-decoration-style:solid; text-underline-offset:1px; text-decoration-skip-ink:auto; }</style><div class="decoration" data-pui-root data-projection-owner="calibration" data-projection-generation="1"><span>gyp actual decoration</span></div>`
        )
      );
      await page.addScriptTag({ content: bundle });
      for (const [property, value] of [
        ['text-decoration-line', 'line-through'],
        ['text-decoration-color', 'rgb(255, 0, 0)'],
        ['text-decoration-thickness', '3px'],
        ['text-decoration-style', 'double'],
        ['text-underline-offset', '4px'],
        ['text-decoration-skip-ink', 'none'],
      ]) {
        const result = await page.evaluate(
          ({ property, value }) => {
            const root = document.querySelector<HTMLElement>('[data-pui-root]')!;
            const rule = document.querySelector<HTMLStyleElement>('#decoration-source')!.sheet!
              .cssRules[0] as CSSStyleRule;
            const original = rule.style.getPropertyValue(property);
            const before = window.puiContrastProbe.readContrastState();
            const attributes = root.outerHTML;
            const bounds = JSON.stringify(root.getBoundingClientRect().toJSON());
            rule.style.setProperty(property, value);
            const observed = getComputedStyle(root).getPropertyValue(property);
            const after = window.puiContrastProbe.readContrastState();
            const unchangedSubject =
              root.outerHTML === attributes &&
              JSON.stringify(root.getBoundingClientRect().toJSON()) === bounds;
            rule.style.setProperty(property, original);
            return {
              before,
              after,
              observed,
              unchangedSubject,
              restored: window.puiContrastProbe.readContrastState(),
            };
          },
          { property, value }
        );
        expect(result.observed).toBe(value);
        expect(result.unchangedSubject).toBe(true);
        expect(result.after).not.toBe(result.before);
        expect(result.restored).toBe(result.before);
      }
    } finally {
      await context.close();
    }
  });

  it('requires one current native Textarea through light and shadow wrapper projections', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    try {
      const page = await context.newPage();
      for (const shadow of [false, true]) {
        await page.setContent(
          fixture(
            `<div id="editor-host" data-pui-root data-projection-owner="calibration" data-projection-generation="1" data-projection-prototype="brutalist-textarea-root"></div>`
          )
        );
        await page.evaluate((shadow) => {
          const host = document.querySelector('#editor-host')!;
          const container = shadow ? host.attachShadow({ mode: 'open' }) : host;
          const editor = document.createElement('textarea');
          editor.value = 'Current editor';
          container.append(editor);
        }, shadow);
        await page.addScriptTag({ content: bundle });
        const before = await page.evaluate(() => window.puiContrastProbe.readContrastState());
        expect(await page.evaluate(() => window.puiContrastProbe.readContrastState())).toBe(before);
        const image = (await page.screenshot({ type: 'png', caret: 'initial' })).toString('base64');
        const frame = await page.evaluate(
          (image) =>
            window.puiContrastProbe.collectContrastFrame({
              image,
              family: 'instrument-calibration',
            }),
          image
        );
        expect(frame.surfaces).toHaveLength(1);
        expect(frame.surfaces[0].text).toBe('Current editor');
        await page.evaluate(() => {
          const host = document.querySelector('#editor-host')!;
          const container = host.shadowRoot ?? host;
          container.append(container.querySelector('textarea')!.cloneNode(true));
        });
        await expect(
          page.evaluate(() => window.puiContrastProbe.readContrastState())
        ).rejects.toThrow('exactly one current native editor');
        await expect(
          page.evaluate(
            (image) =>
              window.puiContrastProbe.collectContrastFrame({
                image,
                family: 'instrument-calibration',
              }),
            image
          )
        ).rejects.toThrow('exactly one current native editor');
        await page.evaluate(() => {
          const host = document.querySelector('#editor-host')!;
          const container = host.shadowRoot ?? host;
          container.querySelectorAll('textarea')[1].remove();
          container.querySelector('textarea')!.setAttribute('data-projection-owner', 'foreign');
        });
        await expect(
          page.evaluate(() => window.puiContrastProbe.readContrastState())
        ).rejects.toThrow('foreign projection lease');
      }
    } finally {
      await context.close();
    }
  });
});

it('calibrates translucent paint and zero-area straight SVG stroke witnesses without widening ratios', async () => {
  const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
  try {
    const page = await context.newPage();
    const path = (d: string, style = '') =>
      `<svg viewBox="0 0 24 24" style="width:14px;height:14px" fill="none" stroke="#000" stroke-width="3"><path d="${d}" style="${style}"/></svg>`;
    const root = (id: string, child = '', style = '') =>
      `<div id="${id}" data-pui-root data-demo-ref="${id}" style="background:transparent;color:transparent;${style}">${child}</div>`;
    await page.setContent(
      fixture(
        [
          root('translucent', '', 'background:rgba(0,0,0,0.8)'),
          root('alpha-zero', '', 'background:rgba(0,0,0,0)'),
          root('horizontal', path('M5 12h14')),
          root('vertical', path('M12 5v14')),
          root('stroke-zero', path('M5 12h14', 'stroke:transparent')),
          root('stroke-hidden', path('M5 12h14', 'opacity:0')),
          root('stroke-dashed', path('M5 12h14', 'stroke-dasharray:2 2')),
          root('stroke-css-none', path('M5 12h14', 'd:none')),
          // Path transforms use SVG user units: 1800 * (14 / 24) = 1050 CSS px.
          // The old 900 offset painted at x≈552 inside this 800px viewport.
          root('stroke-outside', path('M5 12h14', 'transform:translateX(1800px)')),
          root('stroke-clipped', `<div style="height:0;overflow:hidden">${path('M5 12h14')}</div>`),
          root('stroke-rotated', path('M5 12h14', 'transform:rotate(30deg)')),
        ].join('')
      )
    );
    await page.locator('[data-pui-root]').evaluateAll((elements) => {
      for (const element of elements) {
        element.setAttribute('data-projection-owner', 'calibration');
        element.setAttribute('data-projection-generation', '1');
      }
    });
    await page.addScriptTag({ content: bundle });
    const observations = await page.locator('[data-pui-root]').evaluateAll((elements) =>
      elements.map((element) => {
        const matrix = element.querySelector('path')?.getScreenCTM();
        return {
          id: element.id,
          observation: window.puiContrastProbe.readContrastTargetObservation(element),
          centerline: element.querySelector('path')?.getBoundingClientRect().toJSON(),
          ownerRect: element.getBoundingClientRect().toJSON(),
          // Native SVG matrices expose these fields without necessarily providing toJSON.
          screenCTM: matrix
            ? { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f }
            : undefined,
          strokeWidth: Number.parseFloat(
            getComputedStyle(element.querySelector('path') ?? element).strokeWidth
          ),
        };
      })
    );
    const png = await page.screenshot({ type: 'png', caret: 'initial' });
    const frame = await page.evaluate(
      (image) =>
        window.puiContrastProbe.collectContrastFrame({ image, family: 'instrument-calibration' }),
      png.toString('base64')
    );
    await recordCalibrationFile('translucent-and-straight-stroke.png', png);
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await recordCalibrationFile(
      'translucent-and-straight-stroke.json',
      JSON.stringify(
        {
          probeBundleSha256: createHash('sha256').update(bundle).digest('hex'),
          pngSha256: createHash('sha256').update(png).digest('hex'),
          observations,
          viewport,
          frame,
        },
        null,
        2
      )
    );
    const outside = observations.find((row) => row.id === 'stroke-outside')!;
    // Check the negative fixture itself before blaming the visibility probe.
    // Its owner stays on screen; even an extended cap of its child stroke does not.
    expect(outside.ownerRect.left).toBeGreaterThanOrEqual(0);
    expect(outside.ownerRect.right).toBeLessThanOrEqual(viewport.width);
    expect(outside.ownerRect.top).toBeGreaterThanOrEqual(0);
    expect(outside.ownerRect.bottom).toBeLessThanOrEqual(viewport.height);
    expect(outside.screenCTM!.a).toBeCloseTo(14 / 24);
    expect(outside.strokeWidth).toBeGreaterThan(0);
    const halfStrokeX =
      (Math.hypot(outside.screenCTM!.a, outside.screenCTM!.c) * outside.strokeWidth) / 2;
    expect(outside.centerline!.left - halfStrokeX).toBeGreaterThan(viewport.width);
    for (const row of observations)
      expect(row.observation.achieved, row.id).toBe(
        ['translucent', 'horizontal', 'vertical'].includes(row.id)
      );
    const beforeVectorEffect = await page.evaluate(() =>
      window.puiContrastProbe.readContrastState()
    );
    const vectorStyle = await page.addStyleTag({
      content: '#horizontal path { vector-effect: non-scaling-stroke; }',
    });
    expect(await page.evaluate(() => window.puiContrastProbe.readContrastState())).not.toBe(
      beforeVectorEffect
    );
    expect(
      await page
        .locator('#horizontal')
        .evaluate(
          (element) => window.puiContrastProbe.readContrastTargetObservation(element).achieved
        )
    ).toBe(false);
    await vectorStyle.evaluate((element) => element.parentNode?.removeChild(element));
    expect(await page.evaluate(() => window.puiContrastProbe.readContrastState())).toBe(
      beforeVectorEffect
    );
    expect(observations.find((row) => row.id === 'horizontal')!.centerline!.height).toBe(0);
    expect(observations.find((row) => row.id === 'vertical')!.centerline!.width).toBe(0);
    expect(surface(frame, 'translucent').paint.fillAlpha).toBe(0.8);
    expect(surface(frame, 'translucent').exterior.length).toBeGreaterThan(0);
    expect(
      surface(frame, 'translucent').exterior.every((edge) => edge.opaqueFillVsPixel === null)
    ).toBe(true);
    // Stroke existence does not promote zero-area numeric glyph samples.
    for (const id of ['horizontal', 'vertical']) {
      expect(surface(frame, id).glyphs.some((glyph) => glyph.tag === 'path')).toBe(true);
      expect(surface(frame, id).glyphs.every((glyph) => glyph.strokeContrast === null)).toBe(true);
    }
  } finally {
    await context.close();
  }
}, 30_000);
