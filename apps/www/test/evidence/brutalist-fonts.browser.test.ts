// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import {
  launchBrowser,
  startServer,
  stopServer,
  selectRuntime,
  RUNTIMES,
} from '../../src/content/docs/zh-cn/browser-harness';
const BUTTON = '/en/ui-libraries/brutalist/components/button/';
const DIALOG = '/en/ui-libraries/brutalist/components/dialog/';
let browser: Browser;
let launch: Promise<Browser> | undefined;
let baseUrl: string;
const records: unknown[] = [];
const output = process.env.PROTO_UI_FONT_EVIDENCE_DIR;
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
async function platformFonts(context: BrowserContext, page: Page, selector: string) {
  const client = await context.newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument');
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    return (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  } finally {
    await client.detach();
  }
}
beforeAll(async () => {
  baseUrl = await startServer([BUTTON, DIALOG]);
  launch = launchBrowser();
  browser = await launch;
}, 180_000);
afterAll(async () => {
  if (output) {
    await mkdir(output, { recursive: true });
    await writeFile(
      path.join(output, 'font-measurements.json'),
      JSON.stringify({ sourceSha, records }, null, 2)
    );
  }
  await (await launch?.catch(() => undefined))?.close();
  await stopServer();
}, 60_000);
describe.sequential('actual Brutalist font faces and fallback', () => {
  it('loads the face, uses 500 control/700 heading roles, and serves the complete OFL', async () => {
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await context.newPage();
    try {
      const license = await context.request.get(baseUrl + '/fonts/dm-sans-OFL.txt');
      expect(license.ok()).toBe(true);
      expect(await license.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
      for (const runtime of RUNTIMES) {
        await page.goto(baseUrl + BUTTON, { waitUntil: 'networkidle' });
        const previewer = page.locator('[data-previewer-id]').first();
        await selectRuntime(
          page,
          previewer,
          runtime,
          '[data-projection-content] [data-pui-root]',
          10
        );
        const loaded = await page.evaluate(async () => {
          const faces = await document.fonts.load('500 14px "DM Sans"');
          return faces.map((face) => ({ family: face.family, status: face.status }));
        });
        expect(
          loaded.some(
            (face) =>
              face.family.replace(/^["']|["']$/g, '') === 'DM Sans' && face.status === 'loaded'
          )
        ).toBe(true);
        const button = page.locator('[data-projection-content] [data-demo-ref="solidMain"]');
        const control = await button.evaluate((el) => {
          const css = getComputedStyle(el);
          return {
            family: css.fontFamily,
            weight: css.fontWeight,
            size: css.fontSize,
            casing: css.textTransform,
            text: el.textContent,
          };
        });
        expect(control.family).toContain('DM Sans');
        expect(control.weight).toBe('500');
        expect(control.size).toBe('14px');
        expect(control.casing).toBe('none');
        expect(control.text).toBe('Solid main');
        const actualFonts = await platformFonts(
          context,
          page,
          '[data-projection-content] [data-demo-ref="solidMain"]'
        );
        expect(
          actualFonts.some(
            (font) =>
              /^DM Sans(?: \d+(?:\.\d+)?pt)?$/.test(font.familyName) &&
              font.glyphCount > 0 &&
              font.isCustomFont
          )
        ).toBe(true);
        if (output) {
          await mkdir(output, { recursive: true });
          await previewer.screenshot({ path: path.join(output, `${runtime}-button-loaded.png`) });
        }
        await page.goto(baseUrl + DIALOG, { waitUntil: 'networkidle' });
        const dialogPreview = page.locator('[data-previewer-id]').first();
        await selectRuntime(page, dialogPreview, runtime, '[aria-haspopup="dialog"]', 1);
        await dialogPreview.locator('[aria-haspopup="dialog"]').click();
        const title = page.getByText('Neo-Brutalist modal', { exact: true }).last();
        await title.waitFor({ state: 'visible' });
        const heading = await title.evaluate((el) => {
          const css = getComputedStyle(el);
          return {
            family: css.fontFamily,
            weight: css.fontWeight,
            size: css.fontSize,
            casing: css.textTransform,
          };
        });
        expect(heading.family).toContain('DM Sans');
        expect(heading.weight).toBe('700');
        expect(heading.size).toBe('18px');
        expect(heading.casing).toBe('none');
        records.push({ runtime, loaded, control, actualFonts, heading });
      }
    } finally {
      await context.close();
    }
  }, 240_000);
  it('keeps a readable functional sans fallback when the font request fails', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let blocked = 0;
    await context.route(/DMSans.*\.ttf(?:\?.*)?$/, async (route) => {
      blocked++;
      await route.abort('failed');
    });
    const page = await context.newPage();
    try {
      await page.goto(baseUrl + BUTTON, { waitUntil: 'networkidle' });
      const previewer = page.locator('[data-previewer-id]').first();
      await selectRuntime(page, previewer, 'wc', '[data-projection-content] [data-pui-root]', 10);
      const faces = await page.evaluate(async () => {
        await document.fonts.ready;
        return Array.from(document.fonts).map((face) => ({
          family: face.family,
          status: face.status,
        }));
      });
      expect(blocked).toBeGreaterThan(0);
      expect(
        faces.some(
          (face) =>
            face.family.replace(/^["']|["']$/g, '') === 'DM Sans' && face.status === 'loaded'
        )
      ).toBe(false);
      const actualFonts = await platformFonts(
        context,
        page,
        '[data-projection-content] [data-demo-ref="solidMain"]'
      );
      expect(
        actualFonts.some(
          (font) => /^DM Sans(?: \d+(?:\.\d+)?pt)?$/.test(font.familyName) && font.glyphCount > 0
        )
      ).toBe(false);
      expect(actualFonts.some((font) => font.glyphCount > 0)).toBe(true);
      const button = page.locator('[data-projection-content] [data-demo-ref="solidMain"]');
      expect(await button.isVisible()).toBe(true);
      await button.focus();
      await page.keyboard.press('Space');
      if (output) {
        await mkdir(output, { recursive: true });
        await previewer.screenshot({ path: path.join(output, 'wc-button-font-fallback.png') });
      }
      records.push({ runtime: 'wc', fontFailure: true, faces, actualFonts });
    } finally {
      await context.close();
    }
  }, 90_000);
});
