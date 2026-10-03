// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ContrastFrame,
  collectContrastFrame,
  readContrastState,
} from '../../../../scripts/contrast-probe.browser';
import { launchBrowser } from './browser-harness';

declare global {
  interface Window {
    puiContrastProbe: {
      collectContrastFrame: typeof collectContrastFrame;
      readContrastState: typeof readContrastState;
    };
  }
}

let browser: Browser;
let bundle: string;
beforeAll(async () => {
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
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
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

const calibrate = async (markup: string): Promise<ContrastFrame> => {
  const context = await browser.newContext({
    viewport: { width: 800, height: 900 },
    deviceScaleFactor: 1,
  });
  try {
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
    const image = (await page.screenshot({ type: 'png', caret: 'initial' })).toString('base64');
    // Keep paint falsifiers independent of the new fingerprint API so a
    // preserved old probe fails on its bad ratios, not a missing export.
    return await page.evaluate(
      (image) =>
        window.puiContrastProbe.collectContrastFrame({ image, family: 'instrument-calibration' }),
      image
    );
  } finally {
    await context.close();
  }
};

const surface = (frame: ContrastFrame, ref: string) => {
  const found = frame.surfaces.find((candidate) => candidate.ref === ref);
  if (!found) throw new Error(`Calibration surface missing: ${ref}`);
  return found;
};

describe('contrast probe / real Chromium instrument calibration', () => {
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
});
