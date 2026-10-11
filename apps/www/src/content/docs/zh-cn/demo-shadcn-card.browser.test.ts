// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  launchBrowser,
  startServer,
  stopServer,
  openRoute,
  selectRuntime,
  RUNTIMES,
} from './browser-harness';
import { captureCurrentViewport } from './library-card-capture';

const route = '/en/ui-libraries/shadcn/card/';
const galleryRoute = '/zh-cn/ui-libraries/';
const directory =
  process.env.PUI_SHADCN_CARD_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'shadcn-card-evidence');
let browser: Browser;
let baseUrl: string;
let binding: { sha: string; tree: string; dirty: boolean };
beforeAll(async () => {
  const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  binding = {
    sha: git(['rev-parse', 'HEAD']),
    tree: git(['rev-parse', 'HEAD^{tree}']),
    dirty: !!git(['status', '--porcelain', '--untracked-files=all']),
  };
  if (process.env.CANDIDATE_SHA) {
    expect(binding.sha).toBe(process.env.CANDIDATE_SHA);
    expect(binding.dirty).toBe(false);
  }
  await mkdir(directory, { recursive: true });
  baseUrl = await startServer([route, galleryRoute]);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

const colors =
  '--pui-background: rgb(241, 233, 223); --pui-foreground: rgb(12, 44, 65); --pui-card: rgb(212, 230, 250); --pui-card-foreground: rgb(82, 24, 71); --pui-muted-foreground: rgb(93, 100, 107); --pui-border: rgb(35, 118, 108);';

// T-SHADCN-CARD-0001-CASE-NATIVE: current-source browser evidence, not inferred from the harness.
describe.each(RUNTIMES)('Shadcn Card native %s', (runtime) => {
  it('preserves distinct card paint, inherited content ink and native navigation', async () => {
    const { context, page, previewer } = await openRoute(browser, baseUrl, route, {
      width: 1080,
      height: 900,
    });
    try {
      const selector = '[data-projection-prototype="shadcn-card-root"][data-pui-root]';
      await selectRuntime(page, previewer, runtime, selector, 1);
      const root = page.locator(selector);
      await root.evaluate((element, css) => element.setAttribute('style', css), colors);
      const facts = await root.evaluate((element) => {
        const css = getComputedStyle(element);
        const text = [
          ...element.querySelectorAll('[data-projection-prototype="shadcn-text-root"]'),
        ].map((node) => getComputedStyle(node).color);
        const partNodes = [
          element,
          ...element.querySelectorAll('[data-projection-prototype^="shadcn-card-"][data-pui-root]'),
        ];
        const header = getComputedStyle(
          element.querySelector('[data-projection-prototype="shadcn-card-header"][data-pui-root]')!
        );
        return {
          parts: partNodes.map((node) => ({
            role: node.getAttribute('role'),
            tabIndex: (node as HTMLElement).tabIndex,
          })),
          header: {
            display: header.display,
            autoRows: header.gridAutoRows,
            rows: header.gridTemplateRows,
            gap: header.rowGap,
            padding: header.paddingInlineStart,
          },
          border: css.borderTopColor,
          background: css.backgroundColor,
          color: css.color,
          role: element.getAttribute('role'),
          tabIndex: (element as HTMLElement).tabIndex,
          text,
        };
      });
      const capture = await captureCurrentViewport(page, path.join(directory, `${runtime}.png`));
      await writeFile(
        path.join(directory, `${runtime}.json`),
        JSON.stringify({ ...binding, runtime, facts, capture }, null, 2)
      );
      expect(facts.border).toBe('rgb(35, 118, 108)');
      expect(facts.background).toBe('rgb(212, 230, 250)');
      expect(facts.color).toBe('rgb(82, 24, 71)');
      expect(facts.role).toBeNull();
      expect(facts.tabIndex).toBe(-1);
      expect(facts.parts).toEqual(Array.from({ length: 4 }, () => ({ role: null, tabIndex: -1 })));
      expect(facts.header.display).toBe('grid');
      expect(facts.header.autoRows).toBe('min-content');
      expect(facts.header.rows.split(' ')).toHaveLength(2);
      expect(facts.header.gap).toBe('8px');
      expect(facts.header.padding).toBe('24px');
      expect(facts.text).toEqual(['rgb(82, 24, 71)', 'rgb(93, 100, 107)', 'rgb(82, 24, 71)']);
      const link = root.locator('a');
      expect(await link.getAttribute('href')).toBe('#card-contract');
      // An external test sentinel establishes the native Tab entry point; Card gets no focus prop.
      await root.evaluate((element) => {
        const start = document.createElement('button');
        start.dataset.cardTabStart = '';
        start.textContent = 'Tab start';
        element.before(start);
        start.focus();
      });
      await page.keyboard.press('Tab');
      expect(await link.evaluate((element) => document.activeElement === element)).toBe(true);
      await page.locator('[data-card-tab-start]').evaluate((element) => element.remove());
      await page.keyboard.press('Enter');
      expect(new URL(page.url()).hash).toBe('#card-contract');
    } finally {
      await context.close();
    }
  }, 60_000);
});

it.each([false, true])(
  'gallery keeps distinct Card ink with JavaScript=%s',
  async (javaScriptEnabled) => {
    const context = await browser.newContext({
      javaScriptEnabled,
      viewport: { width: 1080, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto(baseUrl + galleryRoute, { waitUntil: 'networkidle' });
      const root = page.locator('[data-library="shadcn"] [data-library-part="shadcn-card"]');
      await root.evaluate((element, css) => element.setAttribute('style', css), colors);
      const facts = await root.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        color: getComputedStyle(element).color,
        heading: getComputedStyle(element.querySelector('h2 [data-library-part="shadcn-text"]')!)
          .color,
        body: getComputedStyle(
          element.querySelector('.library-card__content p [data-library-part="shadcn-text"]')!
        ).color,
        caption: getComputedStyle(element.querySelector('.library-card__kind')!).color,
      }));
      const capture = await captureCurrentViewport(
        page,
        path.join(directory, `gallery-js-${javaScriptEnabled}.png`)
      );
      await writeFile(
        path.join(directory, `gallery-js-${javaScriptEnabled}.json`),
        JSON.stringify({ ...binding, javaScriptEnabled, facts, capture }, null, 2)
      );
      expect(facts).toEqual({
        background: 'rgb(212, 230, 250)',
        color: 'rgb(82, 24, 71)',
        heading: 'rgb(82, 24, 71)',
        body: 'rgb(82, 24, 71)',
        caption: 'rgb(93, 100, 107)',
      });
      expect(await root.locator('[data-library-action]').getAttribute('href')).toBeTruthy();
    } finally {
      await context.close();
    }
  },
  60_000
);
