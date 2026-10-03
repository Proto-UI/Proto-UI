// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser } from '../../src/content/docs/zh-cn/browser-harness';

const source = fs.readFileSync(new URL('./brutalist-spinner.capture.mts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('capture.mts', source, ts.ScriptTarget.Latest, true);
let styleReaderSource = '';
let motionReaderSource = '';
function visit(node: ts.Node): void {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'evaluateAll'
  ) {
    if (!styleReaderSource) styleReaderSource = node.arguments[0]!.getText(parsed);
    else motionReaderSource = node.arguments[0]!.getText(parsed);
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
const module = { exports: undefined as unknown };
vm.runInNewContext(
  transformSync(`module.exports = ${styleReaderSource}`, {
    loader: 'ts',
    target: 'es2022',
    keepNames: true,
  }).code,
  { module }
);
type ColorFacts = {
  color: string;
  backgroundColors: string[];
  foregroundRgba: number[] | null;
  backgroundRgba: number[] | null;
  opaqueForeground: boolean;
  opaqueBackground: boolean;
};
// Pass the isolated function object. A string is evaluated as an expression,
// not invoked with Locator elements, and serializes a function result as undefined.
const styleReader = module.exports as (elements: Element[]) => ColorFacts[];
vm.runInNewContext(
  transformSync(`module.exports = ${motionReaderSource}`, {
    loader: 'ts',
    target: 'es2022',
    keepNames: true,
  }).code,
  { module }
);
const motionReader = module.exports as (
  elements: Element[],
  duration: number
) => Promise<
  Array<{
    time: number;
    roots: Array<{ centerX: number; centerY: number; angle: number }>;
  }>
>;
let browser: Browser;
let browserLaunch: Promise<Browser> | undefined;
beforeAll(async () => {
  browserLaunch = launchBrowser();
  browser = await browserLaunch;
});
afterAll(async () => {
  // Keep ownership of an in-flight launch after a setup timeout. This
  // continuation also closes a late browser if the cleanup hook times out;
  // the runner's watchdog does not cancel the underlying promise.
  // A launch rejection is already reported by beforeAll. Do not replace it
  // with an undefined-browser error, and do not swallow a close failure.
  const launchedBrowser = await browserLaunch?.catch(() => undefined);
  await launchedBrowser?.close();
}, 60_000);

describe('Spinner capture native browser probes', () => {
  it('distinguishes a stable center from an off-center pivot over a complete rotation', async () => {
    const page = await browser.newPage();
    try {
      for (const origin of ['center', '0 0']) {
        await page.setContent(`<style>
          div { display: flex; align-items: center; justify-content: center; width: 80px; height: 80px }
          span { display: block; box-sizing: border-box; width: 16px; height: 16px;
            border: 2px solid; border-top-color: transparent; border-radius: 9999px;
            transform-origin: ${origin}; animation: control-spin 1s linear infinite }
          @keyframes control-spin { to { transform: rotate(360deg) } }
        </style><div><span></span></div>`);
        const frames = await page.locator('span').evaluateAll<
          Array<{
            time: number;
            roots: Array<{ centerX: number; centerY: number; angle: number }>;
          }>,
          number
        >(motionReader, 1100);
        expect(frames.at(-1)!.time - frames[0]!.time).toBeGreaterThanOrEqual(1000);
        expect(new Set(frames.map((frame) => Math.floor(frame.roots[0]!.angle / 90))).size).toBe(4);
        for (const axis of ['centerX', 'centerY'] as const) {
          const coordinates = frames.map((frame) => frame.roots[0]![axis]);
          const span = Math.max(...coordinates) - Math.min(...coordinates);
          if (origin === 'center') expect(span).toBeLessThanOrEqual(0.25);
          else expect(span).toBeGreaterThan(4);
        }
      }
    } finally {
      await page.close();
    }
  });

  it('uses the actual callback to convert CSS4 and composite translucent ancestors', async () => {
    const page = await browser.newPage();
    try {
      await page.setContent(`<style>
        html { background: lab(0 0 0) }
        body { background: oklch(1 0 0 / .5) }
        span { color: lab(0 0 0); background: transparent }
      </style><span></span>`);
      const facts = await page.locator('span').evaluateAll<ColorFacts[]>(styleReader);
      expect(facts[0].foregroundRgba).toEqual([0, 0, 0, 255]);
      expect(facts[0].backgroundRgba).not.toBeNull();
      const [r, g, b, a] = facts[0].backgroundRgba!;
      // CSS4 conversion can straddle the half-byte rounding boundary per
      // channel. Apply the same 127.5 -> {127,128} range to every channel.
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(127);
        expect(channel).toBeLessThanOrEqual(128);
      }
      expect(a).toBe(255);
    } finally {
      await page.close();
    }
  });

  it('retains near-opaque CSS alpha as unmeasured even when 8-bit readback rounds up', async () => {
    const page = await browser.newPage();
    try {
      await page.setContent(
        '<style>html { background: rgba(0, 0, 0, .999) } body, span { background: transparent } span { color: rgba(0, 0, 0, .999) }</style><span></span>'
      );
      const [legacy] = await page.locator('span').evaluateAll<ColorFacts[]>(styleReader);
      // Report what CSSOM retained; do not claim to recover authored precision
      // after a legacy color has already been quantized/serialized by the UA.
      console.info(
        'Legacy near-opaque CSSOM observation',
        JSON.stringify({
          color: legacy.color,
          backgroundColors: legacy.backgroundColors,
          foregroundRgba: legacy.foregroundRgba,
          backgroundRgba: legacy.backgroundRgba,
        })
      );
      await page.setContent(
        '<style>html { background: color(srgb 0 0 0 / .999) } body, span { background: transparent } span { color: color(srgb 0 0 0 / .999) }</style><span></span>'
      );
      const [facts] = await page.locator('span').evaluateAll<ColorFacts[]>(styleReader);
      // The negative control is valid only if the input to the actual probe
      // still contains the non-opaque alpha before 8-bit canvas readback.
      expect(facts.color).toMatch(/\/\s*0?\.999\s*\)$/);
      expect(facts.backgroundColors.some((color) => /\/\s*0?\.999\s*\)$/.test(color))).toBe(true);
      expect(facts.backgroundRgba?.[3]).toBe(255);
      expect(facts.foregroundRgba?.[3]).toBe(255);
      expect(facts.opaqueBackground).toBe(false);
      expect(facts.opaqueForeground).toBe(false);
    } finally {
      await page.close();
    }
  });

  it('leaves images, group opacity, and a transparent final canvas unmeasured', async () => {
    const page = await browser.newPage();
    try {
      for (const css of [
        'html { background: white } body { opacity: .5 }',
        'html { background: white } body { background-image: linear-gradient(black, white) }',
        'html { background: white } body { backdrop-filter: blur(2px) }',
        'html, body { background: transparent }',
      ]) {
        await page.setContent(`<style>${css}</style><span></span>`);
        const [facts] = await page.locator('span').evaluateAll<ColorFacts[]>(styleReader);
        expect(facts.backgroundRgba === null || facts.backgroundRgba[3] !== 255).toBe(true);
      }
    } finally {
      await page.close();
    }
  });
});
