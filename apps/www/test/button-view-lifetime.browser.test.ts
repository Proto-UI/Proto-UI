// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createServer as createViteServer,
  type ViteDevServer,
} from '../../workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser } from '../src/content/docs/zh-cn/browser-harness';

let server: Server;
let vite: ViteDevServer;
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-button-view-lifetime-'));
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('./fixtures/button-view-lifetime/vite.config.ts', import.meta.url)
    ),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Button fixture has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Button view lifetime evidence: ${evidenceDir}`);
}, 60_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    try {
      await vite?.close();
    } finally {
      if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
}, 60_000);

const read = (page: Page) => page.evaluate(() => (window as any).buttonLifetime.read());
async function paint(button: Locator) {
  return button.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      transform: style.transform,
      shadow: style.boxShadow,
    };
  });
}
async function present(page: Page, value: boolean, epoch: number) {
  await page.evaluate((next) => (window as any).buttonLifetime.setPresent(next), value);
  await expect
    .poll(() => read(page))
    .toMatchObject({
      phase: { phase: value ? 'mounted' : 'detached', epoch },
    });
}
async function pointerDown(page: Page, button: Locator) {
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect.poll(() => read(page)).toMatchObject({ pressed: true, hovered: true });
}

describe.sequential('Button transient facts follow the retained view lifetime', () => {
  for (const family of ['brutalist', 'shadcn']) {
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      it(`${family}/${runtime} clears revoked input without phantom activation`, async () => {
        const context = await browser.newContext({ viewport: { width: 1000, height: 650 } });
        const page = await context.newPage();
        const errors: string[] = [];
        const observations: Record<string, unknown> = {
          family,
          runtime,
          browser: browser.version(),
        };
        page.on('pageerror', (error) => errors.push(error.message));
        const prefix = `${family}-${runtime}`;
        const capture = (name: string) =>
          page.locator('#board').screenshot({
            path: path.join(evidenceDir, `${prefix}-${name}.png`),
          });
        try {
          await page.goto(`${baseUrl}/?family=${family}&runtime=${runtime}`);
          await page.waitForSelector('body[data-ready="true"]');
          const button = page.locator('[data-demo-ref="probe"]');
          await page.mouse.move(0, 0);
          await expect
            .poll(() => read(page))
            .toMatchObject({
              pressed: false,
              hovered: false,
              setups: 1,
              clicks: 0,
              phase: { phase: 'mounted', epoch: 1 },
            });
          const resting = await paint(button);
          observations.initial = { state: await read(page), paint: resting };
          await capture('initial');
          await pointerDown(page, button);
          await expect.poll(() => paint(button)).not.toEqual(resting);
          observations.pressed = { state: await read(page), paint: await paint(button) };
          await capture('pressed');
          await present(page, false, 1);
          await page.mouse.move(10, 10);
          await page.mouse.up();
          observations.detached = await read(page);
          await capture('detached');
          await present(page, true, 2);
          observations.remounted = { state: await read(page), paint: await paint(button) };
          observations.inputs = await page.evaluate(() => (window as any).buttonLifetime.inputs);
          await capture('remounted');
          expect(await read(page)).toMatchObject({
            pressed: false,
            hovered: false,
            sameHandles: true,
            setups: 1,
            clicks: 0,
          });
          await expect.poll(() => paint(button)).toEqual(resting);

          await button.hover();
          await expect.poll(() => read(page)).toMatchObject({ hovered: true, pressed: false });
          await present(page, false, 2);
          await page.mouse.move(10, 10);
          await present(page, true, 3);
          expect(await read(page)).toMatchObject({ pressed: false, hovered: false, clicks: 0 });
          await expect.poll(() => paint(button)).toEqual(resting);
          observations.hoverRemounted = await read(page);

          await button.click();
          await expect.poll(() => read(page)).toMatchObject({ pressed: false, clicks: 1 });
          await page.locator('#entry').click();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
          await expect.poll(() => read(page)).toMatchObject({ focusVisible: true });
          await capture('keyboard-focus');
          await page.keyboard.press('Enter');
          await page.keyboard.press('Space');
          await expect.poll(() => read(page)).toMatchObject({ clicks: 3, pressed: false });
          observations.keyboard = await read(page);

          await pointerDown(page, button);
          await page.evaluate(() => (window as any).buttonLifetime.setDisabled(true));
          await expect
            .poll(() => read(page))
            .toMatchObject({
              pressed: false,
              hovered: false,
              disabled: true,
              clicks: 3,
            });
          await page.mouse.move(10, 10);
          await page.mouse.up();
          observations.disabled = await read(page);
          await page.evaluate(() => (window as any).buttonLifetime.setDisabled(false));
          await pointerDown(page, button);
          await page.evaluate(() => (window as any).buttonLifetime.dispose());
          await page.mouse.move(10, 10);
          await page.mouse.up();
          await expect
            .poll(() => page.evaluate(() => (window as any).buttonLifetime.stats.disposed))
            .toBe(true);
          const terminal = await page.evaluate(() => ({
            stats: (window as any).buttonLifetime.stats,
            inputs: (window as any).buttonLifetime.inputs,
          }));
          observations.terminal = terminal;
          expect(terminal.stats.clicks).toBe(3);
          expect(terminal.stats.setups).toBe(1);
          expect(terminal.stats.unmounts).toBe(3);
          expect(terminal.stats.phases.at(-1)).toEqual({ phase: 'detached', epoch: 3 });
          expect(terminal.inputs.every((input: any) => input.trusted)).toBe(true);
          expect(terminal.inputs).toContainEqual({
            type: 'pointerdown',
            trusted: true,
            buttons: 1,
            target: 'probe',
          });
          expect(terminal.inputs).toContainEqual({
            type: 'pointerup',
            trusted: true,
            buttons: 0,
            target: null,
          });
          expect(await button.count()).toBe(0);
          expect(errors).toEqual([]);
        } finally {
          observations.errors = errors;
          await writeFile(
            path.join(evidenceDir, `${prefix}.json`),
            JSON.stringify(observations, null, 2)
          );
          await context.close();
        }
      }, 60_000);
    }
  }
});
