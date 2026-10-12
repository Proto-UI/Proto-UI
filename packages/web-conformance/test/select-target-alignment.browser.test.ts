// @vitest-environment node
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright-core';
import type * as Fixture from './fixtures/select-target-alignment-native';

declare global {
  interface Window {
    alignmentProof: typeof Fixture;
    alignmentFrames: { blockDelta: number; inlineDelta: number }[];
    alignmentObserve: boolean;
  }
}
let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: [
      fileURLToPath(new URL('./fixtures/select-target-alignment-native.ts', import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    globalName: 'alignmentProof',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('No alignment fixture bundle');
  bundle = output.text;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    chromiumSandbox: true,
  });
}, 60_000);
afterAll(async () => browser?.close());
it.each(['ltr', 'rtl'] as const)(
  'native cold selected item aligns over trigger in %s',
  async (direction) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setContent('<!doctype html><html><head></head><body></body></html>');
      await page.addScriptTag({ content: bundle });
      await page.evaluate(
        (direction) => window.alignmentProof.mountAlignmentProof({ direction }),
        direction
      );
      await page.evaluate((direction) => {
        window.alignmentFrames = [];
        window.alignmentObserve = true;
        const sample = () => {
          if (!window.alignmentObserve) return;
          const row = document.querySelector<HTMLElement>('[data-demo-ref="item-1"]');
          const trigger = document.querySelector<HTMLElement>('[data-demo-ref="trigger"]');
          const value = document.querySelector<HTMLElement>('[data-demo-ref="value"]');
          const text = document.querySelector<HTMLElement>('[data-demo-ref="text-1"]');
          if (
            row &&
            trigger &&
            value &&
            text &&
            row.getClientRects().length &&
            getComputedStyle(row).visibility === 'visible'
          ) {
            const r = row.getBoundingClientRect(),
              t = trigger.getBoundingClientRect();
            const v = value.getBoundingClientRect(),
              x = text.getBoundingClientRect();
            window.alignmentFrames.push({
              blockDelta: Math.abs(r.top + r.height / 2 - t.top - t.height / 2),
              inlineDelta: Math.abs(direction === 'rtl' ? v.right - x.right : v.left - x.left),
            });
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, direction);
      await page.locator('[data-demo-ref="trigger"]').click();
      await page.locator('[data-demo-ref="item-1"]').waitFor({ state: 'visible' });
      const result = await page.evaluate(() => {
        const get = (selector: string) => {
          const node = document.querySelector<HTMLElement>(selector);
          if (!node) throw new Error(selector);
          return node;
        };
        const trigger = get('[data-demo-ref="trigger"]'),
          row = get('[data-demo-ref="item-1"]');
        const value = get('[data-demo-ref="value"]'),
          text = get('[data-demo-ref="text-1"]');
        const rect = (node: HTMLElement) => {
          const r = node.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
        };
        return {
          trigger: rect(trigger),
          row: rect(row),
          value: rect(value),
          text: rect(text),
          focused: document.activeElement === row,
          frame: rect(get('[data-demo-ref="frame"]')),
          surface: rect(get('[data-demo-ref="surface"]')),
        };
      });
      console.info('[target-alignment-native]', JSON.stringify({ direction, ...result, errors }));
      expect(errors).toEqual([]);
      expect(
        Math.abs(
          result.row.top + result.row.height / 2 - (result.trigger.top + result.trigger.height / 2)
        )
      ).toBeLessThanOrEqual(1);
      const edge = direction === 'rtl' ? 'right' : 'left';
      expect(Math.abs(result.value[edge] - result.text[edge])).toBeLessThanOrEqual(1);
      expect(result.focused).toBe(true);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      );
      const frames = await page.evaluate(() => {
        window.alignmentObserve = false;
        return window.alignmentFrames;
      });
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        expect(frame.blockDelta).toBeLessThanOrEqual(1);
        expect(frame.inlineDelta).toBeLessThanOrEqual(1);
      }
      const evidence = process.env.PROTO_UI_TARGET_ALIGNMENT_EVIDENCE;
      if (evidence) {
        await mkdir(evidence, { recursive: true });
        await page.screenshot({
          path: join(evidence, `selected-alignment-${direction}.png`),
          fullPage: true,
        });
      }
      expect(result.frame.height).toBeGreaterThan(result.surface.height);
      // The large positioning frame contains blank space which must remain outside the menu.
      await page.mouse.click(result.frame.left + 8, result.surface.bottom + 20);
      await page.locator('[data-demo-ref="item-1"]').waitFor({ state: 'hidden' });
    } finally {
      await context.close();
    }
  },
  30_000
);

it.each(['ltr', 'rtl'] as const)(
  'native controlled refusal, current selection and fresh reopen in %s',
  async (direction) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setContent('<!doctype html><html><head></head><body></body></html>');
      await page.addScriptTag({ content: bundle });
      await page.evaluate(
        (direction) => window.alignmentProof.mountAlignmentProof({ direction, controlled: true }),
        direction
      );
      await page.evaluate(() => window.alignmentProof.updateAlignmentProof({ open: true }));
      await page.locator('[data-demo-ref="item-1"]').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      expect(await page.locator('[data-demo-ref="trigger"]').getAttribute('aria-expanded')).toBe(
        'true'
      );
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-demo-ref'))).toBe(
        'item-1'
      );
      await page.evaluate(() => window.alignmentProof.updateAlignmentProof({ selected: 2 }));
      const current = await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>('[data-demo-ref="item-2"]');
        const trigger = document.querySelector<HTMLElement>('[data-demo-ref="trigger"]');
        if (!row || !trigger) throw new Error('Missing current geometry');
        const r = row.getBoundingClientRect(),
          t = trigger.getBoundingClientRect();
        return {
          delta: Math.abs(r.top + r.height / 2 - t.top - t.height / 2),
          focus: document.activeElement === row,
        };
      });
      expect(current.delta).toBeLessThanOrEqual(1);
      expect(current.focus).toBe(true);
      await page.evaluate(() => window.alignmentProof.updateAlignmentProof({ open: false }));
      expect(await page.evaluate(() => window.alignmentProof.readProofPhase())).toBe('closed');
      await page.evaluate(() =>
        window.alignmentProof.updateAlignmentProof({ open: true, selected: 0 })
      );
      await page.locator('[data-demo-ref="item-0"]').waitFor({ state: 'visible' });
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-demo-ref'))).toBe(
        'item-0'
      );
      await page.keyboard.press('ArrowDown');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-demo-ref'))).toBe(
        'item-1'
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  },
  30_000
);
