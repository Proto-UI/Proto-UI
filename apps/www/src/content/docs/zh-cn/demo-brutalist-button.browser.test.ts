// @vitest-environment node

import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BUTTON_ROUTE = '/en/ui-libraries/brutalist/components/button/';

const RUNTIMES = ['wc', 'react', 'vue'] as const;

let browser: Browser;
let devServer: ChildProcess | null = null;
let baseUrl = '';

async function waitForServer(url: string, timeout = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await access(url.replace(/^http/, ''));
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  devServer = spawn('npx', ['astro', 'dev', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: 'apps/www',
    stdio: 'pipe',
    env: { ...process.env, CI: 'true' },
  });
  await waitForServer(`${baseUrl}${BUTTON_ROUTE}`);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  devServer?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 1000));
});

describe('Brutalist Button browser regressions', () => {
  for (const runtime of RUNTIMES) {
    describe(`${runtime} runtime`, () => {
      let page: Page;

      beforeAll(async () => {
        page = await browser.newPage();
        await page.goto(`${baseUrl}${BUTTON_ROUTE}`);
        // Wait for the runtime tab to be available
        await page.waitForSelector(`[data-runtime="${runtime}"]`, { timeout: 30_000 });
        await page.click(`[data-runtime="${runtime}"]`);
      });

      afterAll(async () => {
        await page?.close();
      });

      it('renders a Button with square corners and hard shadow', async () => {
        const button = page.locator('[data-prototype-id="brutalist-button"]').first();
        await button.waitFor({ state: 'visible' });
        const style = await button.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            borderRadius: cs.borderRadius,
            borderWidth: cs.borderTopWidth,
            boxShadow: cs.boxShadow,
          };
        });
        expect(style.borderRadius).toBe('0px');
        expect(style.borderWidth).toBe('2px');
        expect(style.boxShadow).toContain('3px 3px');
      });

      it('preserves disabled state visually', async () => {
        const disabled = page.locator('[data-disabled]').first();
        if ((await disabled.count()) > 0) {
          const opacity = await disabled.evaluate((el) => getComputedStyle(el).opacity);
          expect(Number(opacity)).toBeLessThan(1);
        }
      });
    });
  }
});
