// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createServer as createViteServer,
  type ViteDevServer,
} from '../../workspace/node_modules/vite/dist/node/index.js';
import { launchBrowser, RUNTIMES } from '../src/content/docs/zh-cn/browser-harness';

let server: Server;
let vite: ViteDevServer;
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-radio-group-entry-'));
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('./fixtures/radio-group-entry/vite.config.ts', import.meta.url)
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
    throw new Error('Radio Group fixture has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Radio Group entry evidence: ${evidenceDir}`);
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

describe.sequential('Base Radio Group native initial entry', () => {
  for (const runtime of RUNTIMES) {
    for (const mode of ['uncontrolled', 'controlled']) {
      it(`${runtime}/${mode} enters the selected Item without inventing selection`, async () => {
        const context = await browser.newContext({ viewport: { width: 800, height: 680 } });
        const page = await context.newPage();
        const errors: string[] = [];
        const observations: Record<string, unknown> = { runtime, mode, browser: browser.version() };
        page.on('pageerror', (error) => errors.push(error.message));
        const read = () => page.evaluate(() => window.radioEntry.read());
        try {
          await page.goto(`${baseUrl}/?runtime=${runtime}&mode=${mode}`);
          await page.waitForSelector('body[data-ready="true"]');
          await expect
            .poll(() => read())
            .toMatchObject({
              value: 'b',
              items: [{ checked: 'false' }, { checked: 'true' }, { checked: 'false' }],
            });
          const initial = await read();
          observations.initial = initial;

          await page.locator('#before').click();
          await page.keyboard.press('Tab');
          observations.tab = await read();
          await page
            .locator('#board')
            .screenshot({ path: path.join(evidenceDir, `${runtime}-${mode}-tab.png`) });
          expect(initial.items.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
          await expect
            .poll(async () => (await read()).items.map((item) => item.focused))
            .toEqual([false, true, false]);

          await page.locator('#after').click();
          await page.keyboard.press('Shift+Tab');
          await expect
            .poll(async () => (await read()).items.map((item) => item.focused))
            .toEqual([false, true, false]);
          expect(await read()).toMatchObject({ value: 'b', changes: [] });
          observations.reverseTab = await read();

          if (mode === 'controlled') {
            await page.evaluate(() => window.radioEntry.setValue('c'));
            await expect
              .poll(() => read())
              .toMatchObject({
                value: 'c',
                items: [{ checked: 'false' }, { checked: 'false' }, { checked: 'true' }],
              });
            expect((await read()).items.map((item) => item.focused)).toEqual([false, true, false]);
            expect((await read()).items.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);
            expect((await read()).changes).toEqual([]);
          } else {
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => read()).toMatchObject({ value: 'c', changes: ['c'] });
            expect((await read()).items.map((item) => item.focused)).toEqual([false, false, true]);
          }
          observations.after = await read();
          await page
            .locator('#board')
            .screenshot({ path: path.join(evidenceDir, `${runtime}-${mode}-after.png`) });
          expect(errors).toEqual([]);
        } finally {
          observations.errors = errors;
          await writeFile(
            path.join(evidenceDir, `${runtime}-${mode}.json`),
            JSON.stringify(observations, null, 2)
          );
          await context.close();
        }
      }, 60_000);
    }
  }
});
