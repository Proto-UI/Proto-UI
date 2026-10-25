// @vitest-environment node
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it, onTestFinished } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';
import { runS4PaintJourney } from '../../../../../../scripts/analysis/shadow-s4-paint-browser.mjs';

let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer('/zh-cn/internal/demo-matrix/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

it('S4: compositor never repaints a closed Dialog after settings changes', async () => {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    colorScheme: 'light',
  });
  let closing: Promise<void> | undefined;
  const closeContext = () => (closing ??= context.close());
  onTestFinished(closeContext);
  context.on('close', () => {
    try {
      console.info(
        '[S4 context closed]',
        JSON.stringify({
          scope: 'paint',
          nodeMs: globalThis.performance.now(),
          dateNow: Date.now(),
        })
      );
    } catch {
      /* Diagnostic output cannot replace cleanup. */
    }
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${baseUrl}/zh-cn/internal/demo-matrix/#shadow-split-s4`);
    const result = await runS4PaintJourney(page);
    expect(result.paths).toBe(24);
    expect(errors).toEqual([]);
  } finally {
    await closeContext();
  }
}, 150_000);
