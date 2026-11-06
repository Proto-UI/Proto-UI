// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { startServer, stopServer, selectRuntime, RUNTIMES } from './browser-harness';
import { captureCurrentViewport } from './library-card-capture';

const route = '/en/ui-libraries/shadcn/card/';
const compatibilityRoute = (runtime: (typeof RUNTIMES)[number]) =>
  `/en/test/shadcn-card-compat/${runtime}/`;
const directory =
  process.env.PUI_SHADCN_CARD_EVIDENCE_DIR ?? path.join(os.tmpdir(), 'shadcn-card-evidence');
let browser: Browser;
let baseUrl: string;
let binding: { sha: string; tree: string; dirty: boolean };
beforeAll(async () => {
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    !process.env.CANDIDATE_SHA ||
    !process.env.CHROME_PATH
  ) {
    throw new Error('Official exact-head CI only; collection never launches a browser.');
  }
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
  baseUrl = await startServer([route, ...RUNTIMES.map(compatibilityRoute)]);
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-dev-shm-usage'],
  });
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

const colors =
  '--pui-background: rgb(241, 233, 223); --pui-foreground: rgb(12, 44, 65); --pui-card: rgb(212, 230, 250); --pui-card-foreground: rgb(82, 24, 71); --pui-muted-foreground: rgb(93, 100, 107); --pui-border: rgb(35, 118, 108);';

// T-SHADCN-CARD-0001-CASE-NATIVE: current-source browser evidence, not inferred from the harness.
describe.each(RUNTIMES)('Shadcn Card New York compatibility native %s', (runtime) => {
  it('preserves distinct card paint, inherited content ink and native navigation', async () => {
    const context = await browser.newContext({ viewport: { width: 1080, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(baseUrl + compatibilityRoute(runtime), { waitUntil: 'networkidle' });
      await page.waitForFunction((selectedRuntime) => {
        const host = document.querySelector<HTMLElement>('[data-card-compat-host]');
        if (host?.dataset.mountState === 'error') {
          throw new Error(
            document.querySelector('[data-card-compat-error]')?.textContent || 'Card mount failed'
          );
        }
        if (host?.dataset.mountState !== 'ready' || host.dataset.cardCompatHost !== selectedRuntime)
          return false;
        const generations = host.querySelectorAll<HTMLElement>('[data-projection-generation-host]');
        if (generations.length !== 1) return false;
        const generation = generations[0]!;
        const scope = generation.querySelector<HTMLElement>('[data-projection-scope]');
        return (
          generation.dataset.projectionGenerationState === 'active' &&
          !generation.inert &&
          generation.getAttribute('aria-hidden') !== 'true' &&
          scope?.dataset.projectionState === 'ready' &&
          scope.dataset.projectionRuntime === selectedRuntime &&
          scope.dataset.projectionFamily === 'shadcn' &&
          generation.querySelectorAll(
            '[data-projection-prototype="shadcn-card-root"][data-pui-root]'
          ).length === 1
        );
      }, runtime);
      const selector = '[data-projection-prototype="shadcn-card-root"][data-pui-root]';
      const root = page.locator('[data-card-compat-host]').locator(selector);
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
      const capture = await captureCurrentViewport(
        page,
        path.join(directory, `new-york-${runtime}.png`)
      );
      await writeFile(
        path.join(directory, `new-york-${runtime}.json`),
        JSON.stringify(
          {
            ...binding,
            runtime,
            profile: 'new-york',
            consumer: compatibilityRoute(runtime),
            facts,
            capture,
          },
          null,
          2
        )
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

// Ordinary documentation is a separate Rhea consumer, not the New York compatibility fixture.
describe.each(RUNTIMES)('Shadcn Card ordinary Rhea native %s', (runtime) => {
  it('preserves default light Rhea paint, passive content and native navigation', async () => {
    const context = await browser.newContext({
      viewport: { width: 1080, height: 900 },
      colorScheme: 'light',
    });
    try {
      const page = await context.newPage();
      await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
      const previewer = page.locator('[data-previewer-id]').first();
      await previewer.waitFor({ state: 'visible' });
      const selector = '[data-projection-prototype="shadcn-card-root"][data-pui-root]';
      await selectRuntime(page, previewer, runtime, selector, 1);
      expect(
        await previewer
          .locator('[data-projection-prototype="shadcn-style-scope"][data-pui-root]')
          .count()
      ).toBe(1);
      const root = previewer.locator(selector);
      // Preserve the original consumer input: only Card receives custom tokens.
      await root.evaluate((element, css) => element.setAttribute('style', css), colors);
      const facts = await root.evaluate((element) => {
        const css = getComputedStyle(element);
        const partNodes = [
          element,
          ...element.querySelectorAll('[data-projection-prototype^="shadcn-card-"][data-pui-root]'),
        ];
        const header = getComputedStyle(
          element.querySelector('[data-projection-prototype="shadcn-card-header"][data-pui-root]')!
        );
        // A native CSS oracle resolves the documented ring/radius expression;
        // it does not paint the component or supply its observed declarations.
        const oracle = document.createElement('span');
        oracle.style.position = 'absolute';
        oracle.style.visibility = 'hidden';
        oracle.style.color = 'color-mix(in oklab, var(--pui-foreground) 5%, transparent)';
        oracle.style.borderRadius = 'min(var(--pui-radius-4xl), 24px)';
        element.append(oracle);
        const ringExpected = getComputedStyle(oracle).color;
        const radiusExpected = getComputedStyle(oracle).borderRadius;
        const ringToken = css.getPropertyValue('--pui-ring-color').trim();
        oracle.style.color = ringToken;
        const ringActual = getComputedStyle(oracle).color;
        oracle.remove();
        return {
          theme: document.documentElement.dataset.theme,
          parts: partNodes.map((node) => ({
            role: node.getAttribute('role'),
            tabIndex: (node as HTMLElement).tabIndex,
          })),
          partPadding: partNodes.slice(1).map((node) => {
            const part = getComputedStyle(node);
            return [part.paddingInlineStart, part.paddingInlineEnd];
          }),
          header: {
            display: header.display,
            autoRows: header.gridAutoRows,
            rows: header.gridTemplateRows,
            gap: header.rowGap,
          },
          borderWidths: [
            css.borderTopWidth,
            css.borderRightWidth,
            css.borderBottomWidth,
            css.borderLeftWidth,
          ],
          background: css.backgroundColor,
          color: css.color,
          gap: css.rowGap,
          padding: [css.paddingTop, css.paddingBottom],
          font: css.fontSize,
          overflow: [css.overflowX, css.overflowY],
          radius: css.borderRadius,
          radiusToken: css.getPropertyValue('--pui-radius-4xl').trim(),
          radiusExpected,
          ringWidth: css.getPropertyValue('--pui-ring-width').trim(),
          ringToken,
          ringTokenValid: CSS.supports('color', ringToken),
          ringActual,
          ringExpected,
          shadow: css.boxShadow,
          text: [...element.querySelectorAll('[data-projection-prototype="shadcn-text-root"]')].map(
            (node) => getComputedStyle(node).color
          ),
        };
      });
      const capture = await captureCurrentViewport(
        page,
        path.join(directory, `rhea-default-light-${runtime}.png`)
      );
      await writeFile(
        path.join(directory, `rhea-default-light-${runtime}.json`),
        JSON.stringify(
          { ...binding, runtime, profile: 'rhea', consumer: route, facts, capture },
          null,
          2
        )
      );
      expect(facts.theme).toBe('light');
      expect(facts.borderWidths).toEqual(['0px', '0px', '0px', '0px']);
      expect(facts.background).toBe('rgb(212, 230, 250)');
      expect(facts.color).toBe('rgb(82, 24, 71)');
      expect(facts.parts).toEqual(Array.from({ length: 4 }, () => ({ role: null, tabIndex: -1 })));
      expect(facts.header.display).toBe('grid');
      expect(facts.header.autoRows).toBe('min-content');
      expect(facts.header.rows.split(' ')).toHaveLength(2);
      expect(facts.header.gap).toBe('6px');
      expect(facts.gap).toBe('20px');
      expect(facts.padding).toEqual(['20px', '20px']);
      expect(facts.partPadding).toEqual(Array.from({ length: 3 }, () => ['20px', '20px']));
      expect(facts.font).toBe('14px');
      expect(facts.overflow).toEqual(['hidden', 'hidden']);
      expect(facts.radiusToken).not.toBe('');
      expect(facts.radius).toBe(facts.radiusExpected);
      expect(Number.parseFloat(facts.radius)).toBeGreaterThan(0);
      expect(Number.parseFloat(facts.radius)).toBeLessThanOrEqual(24);
      expect(facts.ringWidth).toBe('1px');
      expect(facts.ringToken).not.toBe('');
      expect(facts.ringTokenValid).toBe(true);
      expect(facts.ringActual).toBe(facts.ringExpected);
      expect(facts.shadow).not.toBe('none');
      expect(facts.shadow).toContain(facts.ringActual);
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
