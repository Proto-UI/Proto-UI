// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'playwright-core';
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
  const temporary = await mkdtemp(path.join(tmpdir(), 'proto-tree-navigation-'));
  evidenceDir = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR
    ? path.join(process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR, 'tree-navigation')
    : temporary;
  await mkdir(evidenceDir, { recursive: true });
  vite = await createViteServer({
    cacheDir: path.join(temporary, 'vite-cache'),
    configFile: fileURLToPath(
      new URL('./fixtures/tree-navigation/vite.config.ts', import.meta.url)
    ),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Tree fixture has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Tree navigation evidence: ${evidenceDir}`);
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

describe.sequential('Base Tree native WC navigation', () => {
  for (const parent of ['disabled', 'enabled']) {
    it(`${parent} parent preserves one enabled Tab entry and exact-once Enter selection`, async () => {
      const context = await browser.newContext({ viewport: { width: 800, height: 680 } });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort()
      );
      const page = await context.newPage();
      const errors: string[] = [];
      const observations: Record<string, unknown> = { parent, browser: browser.version() };
      page.on('pageerror', (error) => errors.push(error.message));
      const read = () => page.evaluate(() => (window as any).treeNavigation.read());
      const capture = (label: string) =>
        page
          .locator('#board')
          .screenshot({ path: path.join(evidenceDir, `${parent}-${label}.png`) });
      try {
        await page.goto(`${baseUrl}/?parent=${parent}`);
        await page.waitForSelector('body[data-ready="true"]');
        await page.locator('#before').click();
        await page.keyboard.press('Tab');
        if (parent === 'enabled') await page.keyboard.press('ArrowDown');
        await expect
          .poll(() => read())
          .toMatchObject({
            value: '',
            changes: [],
            expandedKeys: ['p'],
            tabEntries: ['child'],
            items: [
              { focused: false },
              { focused: true, focusFact: true, tabIndex: 0, disabled: false, hidden: false },
            ],
          });
        observations.before = await read();
        await capture('before-left');
        await page.keyboard.press('ArrowLeft');
        const active = parent === 'disabled' ? 'child' : 'parent';
        await expect
          .poll(() => read())
          .toMatchObject({
            value: '',
            changes: [],
            expandedKeys: ['p'],
            tabEntries: [active],
            items: [
              { focused: active === 'parent', focusFact: active === 'parent' },
              { focused: active === 'child', focusFact: active === 'child' },
            ],
          });
        observations.afterLeft = await read();
        await capture('after-left');
        // Prove the preserved entry works in the host's actual sequential navigation.
        await page.keyboard.press('Tab');
        expect(
          await page.locator('#after').evaluate((element) => document.activeElement === element)
        ).toBe(true);
        await page.keyboard.press('Shift+Tab');
        expect(
          await page.locator(`#${active}`).evaluate((element) => document.activeElement === element)
        ).toBe(true);
        if (parent === 'enabled') await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect
          .poll(() => read())
          .toMatchObject({
            value: 'c',
            changes: ['c'],
            tabEntries: ['child'],
            items: [{ selected: 'false' }, { selected: 'true', focused: true }],
          });
        // This is the actual portable Runtime declaration, separate from native DOM focus evidence.
        expect((await read()).portableDeclaration).toEqual({
          role: 'treeitem',
          actions: { activate: {} },
        });
        observations.afterEnter = await read();
        await capture('after-enter');
        expect(errors).toEqual([]);
      } finally {
        observations.errors = errors;
        try {
          await writeFile(
            path.join(evidenceDir, `${parent}.json`),
            JSON.stringify(observations, null, 2)
          );
        } finally {
          await context.close();
        }
      }
    }, 60_000);
  }
});
