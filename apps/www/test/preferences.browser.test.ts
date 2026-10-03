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
let evidence = '';
beforeAll(async () => {
  evidence =
    process.env.PROTO_UI_PREFERENCE_EVIDENCE_DIR ??
    (await mkdtemp(path.join(tmpdir(), 'proto-preferences-browser-')));
  await mkdir(evidence, { recursive: true });
  vite = await createViteServer({
    cacheDir: path.join(evidence, 'cache'),
    configFile: fileURLToPath(new URL('./fixtures/preferences/vite.config.ts', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
  });
  server = createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await launchBrowser();
  console.log(`Preference evidence: ${evidence}`);
}, 60000);
afterAll(async () => {
  await browser?.close();
  await vite?.close();
  if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
}, 60000);
describe.sequential('bounded preferences in real Web hosts', () => {
  it.each(['wc', 'react', 'vue', 'vue2'])(
    '%s repaints live preferences and retains safe unknown fallback',
    async (runtime) => {
      const context = await browser.newContext({ viewport: { width: 900, height: 550 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      const media = {
        'prefers-reduced-motion': 'no-preference',
        'prefers-reduced-transparency': 'no-preference',
        'prefers-contrast': 'no-preference',
        'forced-colors': 'none',
      };
      const set = async (patch: Record<string, string> = {}) => {
        Object.assign(media, patch);
        await cdp.send('Emulation.setEmulatedMedia', {
          features: Object.entries(media).map(([name, value]) => ({ name, value })),
        });
      };
      const facts: unknown[] = [];
      try {
        await set();
        await page.goto(`${baseUrl}/?runtime=${runtime}`);
        await page.waitForSelector('[role="button"]');
        const button = page.getByRole('button');
        const paint = () =>
          button.evaluate((el) => ({
            background: getComputedStyle(el).backgroundColor,
            tokens: el.getAttribute('data-pui-style'),
          }));
        await expect.poll(paint).toMatchObject({ background: 'rgb(59, 130, 246)' });
        facts.push({ state: 'enhanced', paint: await paint() });
        await page.screenshot({ path: path.join(evidence, `${runtime}-enhanced.png`) });
        const before = await page.evaluate(() => (window as any).preferenceFixture.stats());
        for (const [key, value] of [
          ['prefers-reduced-motion', 'reduce'],
          ['prefers-reduced-transparency', 'reduce'],
          ['prefers-contrast', 'more'],
          ['forced-colors', 'active'],
        ]) {
          const previous = media[key as keyof typeof media];
          await set({ [key]: value });
          await expect.poll(async () => (await paint()).tokens).not.toContain('bg-primary');
          facts.push({ state: key, paint: await paint() });
          if (key === 'prefers-reduced-transparency')
            await page.screenshot({ path: path.join(evidence, `${runtime}-reduced.png`) });
          await set({ [key]: previous });
          await expect.poll(paint).toMatchObject({ background: 'rgb(59, 130, 246)' });
        }
        expect(await page.evaluate(() => (window as any).preferenceFixture.stats())).toEqual(
          before
        );
        await page.goto(`${baseUrl}/?runtime=${runtime}&unknown=1`);
        await page.waitForSelector('[role="button"]');
        await expect.poll(paint).toMatchObject({ background: 'rgb(255, 255, 255)' });
        facts.push({ state: 'missing-matchMedia', paint: await paint() });
        await page.screenshot({ path: path.join(evidence, `${runtime}-unknown.png`) });
        await page.goto(`${baseUrl}/?runtime=${runtime}&custom=1`);
        await page.waitForSelector('[role="button"]');
        await expect.poll(paint).toMatchObject({ background: 'rgb(255, 255, 255)' });
        facts.push({ state: 'custom-unpaired', paint: await paint() });
        expect(errors).toEqual([]);
        await writeFile(
          path.join(evidence, `${runtime}.json`),
          JSON.stringify({ runtime, browser: browser.version(), facts, errors }, null, 2)
        );
      } finally {
        await context.close();
      }
    },
    60000
  );
});
