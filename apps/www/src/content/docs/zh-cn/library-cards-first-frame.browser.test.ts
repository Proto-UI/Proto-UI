// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { PREFERRED_ADAPTER_KEY } from '../../../components/adapter-preference-key';
const route = '/zh-cn/ui-libraries/';
const directory =
  process.env.PUI_LIBRARY_CARD_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'library-card-evidence');
let browser: Browser;
let baseUrl: string;
let sha: string;
beforeAll(async () => {
  sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer(route);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
function readCards() {
  return [...document.querySelectorAll<HTMLElement>('[data-library]')].map((card) => {
    const surface = card.querySelector<HTMLElement>('.library-card__surface')!;
    const title = card.querySelector<HTMLElement>('h2')!;
    const css = getComputedStyle(surface);
    const rect = surface.getBoundingClientRect();
    return {
      family: card.dataset.library,
      width: rect.width,
      height: rect.height,
      border: css.border,
      radius: css.borderRadius,
      shadow: css.boxShadow,
      fill: css.backgroundColor,
      title: title.textContent?.trim(),
      titleHeight: title.getBoundingClientRect().height,
      tokens: surface.getAttribute('data-pui-style'),
      visible: css.visibility,
      overflow: surface.scrollWidth - surface.clientWidth,
      anchors: [...card.querySelectorAll('a')].map((a) => ({
        href: a.getAttribute('href'),
        label: a.textContent?.trim(),
      })),
    };
  });
}
describe('actual library Cards preserve their first frame', () => {
  for (const runtime of RUNTIMES)
    for (const dark of [false, true]) {
      it(`${runtime} ${dark ? 'dark' : 'light'} delayed scripts, native focus and reload`, async () => {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          colorScheme: dark ? 'dark' : 'light',
        });
        await context.addInitScript(
          ({ runtime, key, dark }) => {
            localStorage.setItem(key, runtime);
            localStorage.setItem('starlight-theme', dark ? 'dark' : 'light');
          },
          { runtime, key: PREFERRED_ADAPTER_KEY, dark }
        );
        const page = await context.newPage();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('**/*', async (r) => {
          if (['script', 'font'].includes(r.request().resourceType())) await gate;
          await r.continue();
        });
        await page.goto(baseUrl + route, { waitUntil: 'commit' });
        await page.locator('[data-library="liquid-glass"] h2').waitFor();
        // Let optional fonts commit their fallback while font requests stay held.
        await page.waitForTimeout(150);
        const before = await page.evaluate(readCards);
        expect(before).toHaveLength(6);
        expect(
          before.every((card) => card.width > 0 && card.height > 0 && card.visible === 'visible')
        ).toBe(true);
        const link = page.locator('[data-library="shadcn"] [data-library-action]');
        await link.focus();
        await page.screenshot({
          path: path.join(directory, `${runtime}-${dark}-before.png`),
          fullPage: true,
        });
        release();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('[data-library-part]')].every((el) =>
            customElements.get(el.localName)
          )
        );
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const after = await page.evaluate(readCards);
        expect(after).toEqual(before);
        await expect.poll(() => link.evaluate((el) => document.activeElement === el)).toBe(true);
        expect(await page.locator('a a').count()).toBe(0);
        await page.screenshot({
          path: path.join(directory, `${runtime}-${dark}-after.png`),
          fullPage: true,
        });
        await writeFile(
          path.join(directory, `${runtime}-${dark}.json`),
          JSON.stringify({ sha, before, after }, null, 2)
        );
        await page.reload({ waitUntil: 'networkidle' });
        expect(await page.evaluate(readCards)).toEqual(before);
        await context.close();
      }, 90_000);
    }
  it('keeps all destinations available with no JavaScript at 320px and 200% text', async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(baseUrl + route);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    expect(await page.locator('[data-library-action]').count()).toBe(6);
    const cards = await page.evaluate(readCards);
    expect(cards.every((card) => card.overflow < 2 && card.width > 0)).toBe(true);
    expect(await page.locator('a a').count()).toBe(0);
    await page.screenshot({
      path: path.join(directory, 'no-script-320-text-200.png'),
      fullPage: true,
    });
    await context.close();
  }, 90_000);
});
