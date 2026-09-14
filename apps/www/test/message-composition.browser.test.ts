// @vitest-environment node

import { createServer, type Server } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright-core';
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
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-message-browser-'));
  vite = await createViteServer({
    cacheDir: path.join(evidenceDir, 'vite-cache'),
    configFile: fileURLToPath(new URL('./fixtures/chatui-message/vite.config.ts', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Private Message server has no TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Private Message browser evidence: ${evidenceDir}`);
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
}, 60_000);

async function geometry(page: Page, caseId: string) {
  return page.evaluate((id) => {
    const wrapper = document.querySelector<HTMLElement>(`article[data-case="${id}"]`);
    const root = wrapper?.querySelector<HTMLElement>('[data-demo-ref="message-root"]');
    if (!wrapper || !root) throw new Error(`Missing Message ${id} geometry target.`);
    const outer = wrapper.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    return {
      width: box.width,
      available: outer.width,
      left: box.left - outer.left,
      right: outer.right - box.right,
      padding: parseFloat(style.paddingTop),
      gap: parseFloat(style.rowGap),
      background: style.backgroundColor,
      color: style.color,
    };
  }, caseId);
}

describe('private Message composition browser acceptance', () => {
  it.each(
    ['wc', 'react', 'vue'].flatMap((runtime) => [1280, 390].map((width) => ({ runtime, width })))
  )(
    '$runtime at $width preserves App ownership and renders the accepted recipe',
    async ({ runtime, width }) => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(`${baseUrl}/?runtime=${runtime}`);
        try {
          await page.waitForSelector('body[data-ready="true"]', { timeout: 15_000 });
        } catch (error) {
          throw new Error(`${String(error)}\nBrowser errors: ${errors.join('\n')}`);
        }
        for (const name of ['User message', 'Assistant reply', 'Failed reply', 'Activity update']) {
          expect(await page.getByRole('article', { name, exact: true }).count()).toBe(1);
        }
        const assistant = page.locator('article[data-case="assistant"]');
        const root = assistant.locator('[data-demo-ref="message-root"]');
        const content = assistant.locator('[data-demo-ref="message-content"]');
        const code = assistant.locator('[data-demo-ref="code-content"]');
        const rootNode = await root.elementHandle();
        const contentNode = await content.elementHandle();
        const transcriptNode = await page.locator('#transcript').elementHandle();
        expect(await code.textContent()).toContain('const answer = 42;');
        expect(await page.locator('article[data-case="user"]').textContent()).toContain(
          'Show a code example.'
        );
        expect(await page.locator('#retry-count').textContent()).toBe('0');

        const user = await geometry(page, 'user');
        const start = await geometry(page, 'assistant');
        expect(user.width).toBeLessThan(user.available - 16);
        expect(Math.abs(user.right)).toBeLessThan(1);
        expect(Math.abs(start.left)).toBeLessThan(1);
        await page.locator('#alignment').selectOption('end');
        await expect.poll(async () => (await geometry(page, 'assistant')).left).toBeGreaterThan(16);
        const end = await geometry(page, 'assistant');
        expect(Math.abs(end.right)).toBeLessThan(1);
        await page.locator('#direction').selectOption('rtl');
        expect(Math.abs((await geometry(page, 'assistant')).left)).toBeLessThan(1);
        await page.locator('#alignment').selectOption('start');
        await expect.poll(async () => (await geometry(page, 'assistant')).left).toBeGreaterThan(16);
        expect(Math.abs((await geometry(page, 'assistant')).right)).toBeLessThan(1);
        await page.locator('#direction').selectOption('ltr');
        await page.locator('#alignment').selectOption('stretch');
        await expect
          .poll(async () => {
            const box = await geometry(page, 'assistant');
            return Math.abs(box.width - box.available);
          })
          .toBeLessThan(1);

        await page.getByRole('button', { name: 'Toggle density', exact: true }).click();
        await expect.poll(async () => (await geometry(page, 'assistant')).padding).toBe(8);
        const compact = await geometry(page, 'assistant');
        expect(compact.gap).toBe(8);
        expect(start.padding).toBe(16);
        expect(start.gap).toBe(12);
        await page.getByRole('button', { name: 'Append stream chunk', exact: true }).click();
        await expect.poll(() => content.textContent()).toContain('Streaming update:');
        expect(await rootNode?.evaluate((node) => node.isConnected)).toBe(true);
        expect(await contentNode?.evaluate((node) => node.isConnected)).toBe(true);
        expect(await transcriptNode?.evaluate((node) => node.isConnected)).toBe(true);
        expect(await code.textContent()).toContain('const answer = 42;');
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
        ).toBe(true);
        expect(
          await content.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
        ).toBe(true);

        const light = await geometry(page, 'assistant');
        await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
        await expect
          .poll(async () => (await geometry(page, 'assistant')).background)
          .not.toBe(light.background);
        await page.locator('#tone').selectOption('system');
        await expect.poll(() => root.getAttribute('data-pui-style')).toContain('bg-transparent');
        expect(
          await page.getByRole('article', { name: 'Assistant reply', exact: true }).count()
        ).toBe(1);
        const ownedA11y = await page
          .locator('[data-demo-ref^="message-"]')
          .evaluateAll(
            (parts) =>
              parts.filter((part) =>
                ['role', 'aria-label', 'aria-live'].some((attribute) =>
                  part.hasAttribute(attribute)
                )
              ).length
          );
        expect(ownedA11y).toBe(0);
        expect(await page.locator('#retry-count').textContent()).toBe('0');
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect.poll(() => page.locator('#retry-count').textContent()).toBe('1');
        await expect
          .poll(() => page.locator('article[data-case="failed"]').textContent())
          .toContain('The App requested a retry.');
        expect(errors).toEqual([]);
        await page.screenshot({
          path: path.join(evidenceDir, `${runtime}-${width}.png`),
          fullPage: true,
        });
        await writeFile(
          path.join(evidenceDir, `${runtime}-${width}.json`),
          JSON.stringify(
            {
              runtime,
              width,
              user,
              start,
              end,
              compact,
              light,
              final: await geometry(page, 'assistant'),
              errors,
            },
            null,
            2
          ) + '\n'
        );
      } finally {
        await context.close();
      }
    },
    60_000
  );
});
