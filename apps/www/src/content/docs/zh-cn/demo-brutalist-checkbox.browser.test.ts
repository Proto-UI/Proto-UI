// @vitest-environment node

import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Browser, Locator } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  COLOR_SCHEMES,
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/brutalist/components/checkbox/';
const NARROW_WIDTH = 320;
const GEOMETRY_EPSILON = 0.5;
const MIN_NON_TEXT_CONTRAST = 3;
const EVIDENCE_DIRECTORY = resolve(process.cwd(), '.codex', 'brutalist-checkbox-browser-evidence');
const requestedRuntime = process.env.PROTO_UI_BRUTALIST_CHECKBOX_BROWSER_RUNTIME;
const TEST_RUNTIMES = requestedRuntime
  ? RUNTIMES.filter((runtime) => runtime === requestedRuntime)
  : RUNTIMES;

if (requestedRuntime && TEST_RUNTIMES.length === 0) {
  throw new Error(
    `PROTO_UI_BRUTALIST_CHECKBOX_BROWSER_RUNTIME must be one of ${RUNTIMES.join(', ')}; received ${requestedRuntime}.`
  );
}

type ElementGeometry = { x: number; y: number; width: number; height: number };

async function geometry(locator: Locator, label: string): Promise<ElementGeometry> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: expected visible rendered geometry.`);
  return box;
}

function expectStableGeometry(
  before: ElementGeometry,
  after: ElementGeometry,
  label: string
): void {
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(after[property] - before[property]),
      `${label}/${property}`
    ).toBeLessThanOrEqual(GEOMETRY_EPSILON);
  }
}

async function foregroundBackgroundContrast(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const paint = (value: string): [number, number, number] => {
      const channels = value
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      if (!channels || channels.length !== 3) throw new Error(`Unsupported CSS color: ${value}`);
      return channels as [number, number, number];
    };
    const luminance = ([red, green, blue]: [number, number, number]): number => {
      const linear = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const style = getComputedStyle(element);
    const foreground = luminance(paint(style.color));
    const background = luminance(paint(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

function evidencePath(
  runtime: (typeof RUNTIMES)[number],
  colorScheme: (typeof COLOR_SCHEMES)[number],
  frame: string
): string {
  return join(EVIDENCE_DIRECTORY, `${runtime}-${colorScheme}-${frame}.png`);
}

let browser: Browser;
let baseUrl = '';

beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

describe.sequential('Brutalist Checkbox browser acceptance', () => {
  it('renders state, contrast, focus, and one accessible control in every public runtime', async () => {
    const context = await browser.newContext({ viewport: { width: NARROW_WIDTH, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const previewer = page.locator('[data-previewer-id]').first();
    await previewer.waitFor({ state: 'visible', timeout: 120_000 });

    try {
      await previewer.scrollIntoViewIfNeeded();
      for (const runtime of TEST_RUNTIMES) {
        await selectRuntime(page, previewer, runtime, '[role="checkbox"]', 6);
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('[data-previewer-id] [role="checkbox"]')]
              .map((checkbox) => checkbox.querySelectorAll('svg').length)
              .join(',') === '0,1,1,1,0,1',
          undefined,
          { timeout: 10_000 }
        );

        const checkboxes = previewer.locator('[role="checkbox"]');
        const facts = await checkboxes.evaluateAll((roots) =>
          roots.map((root) => {
            const indicator = root.querySelector<HTMLElement>(':scope > [data-pui-root]');
            return {
              checked: root.getAttribute('aria-checked'),
              disabled: root.getAttribute('aria-disabled'),
              tabIndex: (root as HTMLElement).tabIndex,
              indicatorRole: indicator?.getAttribute('role') ?? null,
              indicatorAriaChecked: indicator?.getAttribute('aria-checked') ?? null,
              nestedTabStops: [...root.querySelectorAll<HTMLElement>('*')].filter(
                (element) => element.tabIndex >= 0
              ).length,
              glyphCount: indicator?.querySelectorAll('svg').length ?? 0,
              glyphHidden: indicator?.querySelector('svg')?.getAttribute('aria-hidden') ?? null,
              glyphPath: indicator?.querySelector('svg path')?.getAttribute('d') ?? null,
            };
          })
        );

        expect(
          facts.map((fact) => fact.checked),
          `${runtime}/aria-checked`
        ).toEqual(['false', 'true', 'mixed', 'true', 'false', 'mixed']);
        expect(
          facts.map((fact) => fact.disabled),
          `${runtime}/aria-disabled`
        ).toEqual(['false', 'false', 'false', 'true', 'false', 'false']);
        expect(
          facts.map((fact) => fact.tabIndex),
          `${runtime}/tab-order`
        ).toEqual([0, 0, 0, -1, 0, 0]);
        for (const [index, fact] of facts.entries()) {
          expect(fact.indicatorRole, `${runtime}/indicator-role-${index}`).toBeNull();
          expect(
            fact.indicatorAriaChecked,
            `${runtime}/indicator-aria-checked-${index}`
          ).toBeNull();
          expect(fact.nestedTabStops, `${runtime}/nested-tab-stops-${index}`).toBe(0);
          if (fact.glyphCount > 0) {
            expect(fact.glyphHidden, `${runtime}/glyph-hidden-${index}`).toBe('true');
          }
        }
        expect(
          facts.map((fact) => fact.glyphCount),
          `${runtime}/glyph-count`
        ).toEqual([0, 1, 1, 1, 0, 1]);
        expect(facts[5].glyphPath, `${runtime}/mixed-precedence`).toBe('M5 12h14');

        const checkbox = checkboxes.first();
        const row = checkbox.locator('xpath=..');
        const mixedCheckbox = checkboxes.nth(2);
        const mixedRow = mixedCheckbox.locator('xpath=..');
        await row.scrollIntoViewIfNeeded();

        for (const colorScheme of COLOR_SCHEMES) {
          const label = `${runtime}/${colorScheme}`;
          await applyColorScheme(page, colorScheme);

          expect(
            await foregroundBackgroundContrast(mixedCheckbox),
            `${label}/mixed-contrast`
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          await mixedRow.screenshot({
            path: evidencePath(runtime, colorScheme, 'mixed'),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
          });

          if ((await checkbox.getAttribute('aria-checked')) !== 'false') await checkbox.click();
          await page.keyboard.press('Tab');
          await checkbox.focus();
          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-previewer-id] [role="checkbox"]')
                ?.hasAttribute('data-focus-visible') === true,
            undefined,
            { timeout: 10_000 }
          );
          expect(
            await checkbox.evaluate((element) => getComputedStyle(element).boxShadow),
            `${label}/focus-ring`
          ).not.toBe('none');
          await checkbox.evaluate((element) => (element as HTMLElement).blur());

          const beforeGeometry = await geometry(checkbox, `${label}/before`);
          const beforeShadow = await checkbox.evaluate(
            (element) => getComputedStyle(element).boxShadow
          );
          const target = await geometry(checkbox, `${label}/pointer-target`);
          await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
          await page.mouse.down();
          try {
            await page.waitForFunction(
              () =>
                document
                  .querySelector('[data-previewer-id] [role="checkbox"]')
                  ?.hasAttribute('data-pressed') === true,
              undefined,
              { timeout: 10_000 }
            );
            expectStableGeometry(
              beforeGeometry,
              await geometry(checkbox, `${label}/pressed`),
              `${label}/pressed`
            );
            expect(
              await checkbox.evaluate((element) => getComputedStyle(element).boxShadow),
              `${label}/pressed-shadow`
            ).not.toBe(beforeShadow);
            await row.screenshot({
              path: evidencePath(runtime, colorScheme, 'pressed'),
              animations: 'disabled',
              caret: 'hide',
              scale: 'css',
            });
          } finally {
            await page.mouse.up();
          }

          await page.waitForFunction(
            () =>
              document
                .querySelector('[data-previewer-id] [role="checkbox"]')
                ?.getAttribute('aria-checked') === 'true',
            undefined,
            { timeout: 10_000 }
          );
          expectStableGeometry(
            beforeGeometry,
            await geometry(checkbox, `${label}/settled`),
            `${label}/settled`
          );
          expect(
            await foregroundBackgroundContrast(checkbox),
            `${label}/checked-contrast`
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(
            await checkbox.locator('svg path').getAttribute('d'),
            `${label}/checked-glyph`
          ).toBe('m20 6-11 11-5-5');
          await row.screenshot({
            path: evidencePath(runtime, colorScheme, 'checked'),
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
          });

          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            ),
            `${label}/document-overflow`
          ).toBe(0);
        }
      }
    } finally {
      await context.close();
    }
  }, 240_000);
});
