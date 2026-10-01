// @vitest-environment node

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/radio-group/';
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-shadcn-radio-group-'));
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
  console.log(`Shadcn Radio Group browser evidence: ${evidenceDir}`);
}, 180_000);

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await stopServer();
  }
}, 60_000);

async function itemState(item: Locator) {
  return item.evaluate((element) => {
    const indicator = element.querySelector<HTMLElement>('[data-pui-root]')!;
    const svg = indicator.querySelector('svg')!;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const dot = svg.getBoundingClientRect();
    return {
      checked: element.getAttribute('aria-checked'),
      disabled: element.getAttribute('aria-disabled'),
      tabIndex: (element as HTMLElement).tabIndex,
      focused: element === document.activeElement,
      focusVisible: element.matches(':focus-visible'),
      width: rect.width,
      height: rect.height,
      radius: style.borderTopLeftRadius,
      borderWidth: style.borderTopWidth,
      background: style.backgroundColor,
      opacity: style.opacity,
      cursor: style.cursor,
      shadow: style.boxShadow,
      transition: style.transitionProperty,
      duration: style.transitionDuration,
      dotOpacity: getComputedStyle(indicator).opacity,
      dotWidth: dot.width,
      dotHeight: dot.height,
      centerX: dot.x + dot.width / 2 - (rect.x + rect.width / 2),
      centerY: dot.y + dot.height / 2 - (rect.y + rect.height / 2),
      glyphHidden: svg.getAttribute('aria-hidden'),
      indicatorRole: indicator.getAttribute('role'),
      indicatorTabIndex: indicator.getAttribute('tabindex'),
      indicatorControls: indicator.querySelectorAll('a,button,input,select,textarea,[tabindex]')
        .length,
    };
  });
}

function alpha(color: string): number {
  const value = /\/\s*([\d.]+)\)/.exec(color)?.[1] ?? /rgba\(.*?,\s*([\d.]+)\)/.exec(color)?.[1];
  return value === undefined ? 1 : Number(value);
}

async function clickCenter(page: Page, target: Locator) {
  const rect = await target.boundingBox();
  if (!rect) throw new Error('Radio choice has no visible geometry.');
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function waitForValueProjection(page: Page) {
  // The demo observes checked attributes and publishes its value label on rAF.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

describe.sequential('Shadcn Radio Group public browser acceptance', () => {
  it.each(
    RUNTIMES.flatMap((runtime) =>
      ['initial-entry', 'interaction'].map((scenario) => ({ runtime, scenario }))
    )
  )(
    '$runtime $scenario projects selection, focus, disabled and theme states through the real family',
    async ({ runtime, scenario }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const errors: string[] = [];
      const observations: Record<string, unknown> = {
        runtime,
        scenario,
        browser: browser.version(),
      };
      const evidenceKey = `${runtime}-${scenario}`;
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
        const preview = page.locator('[data-previewer-id]').first();
        await selectRuntime(page, preview, runtime, '[role="radiogroup"]', 3);
        await page.keyboard.press('Escape');
        await expect.poll(() => page.getByRole('option').count()).toBe(0);
        expect(await preview.getAttribute('data-projection-mode')).toBe('fixed-family');
        expect(await preview.getAttribute('data-projection-family')).toBe('shadcn');
        expect(await preview.getAttribute('data-projection-component')).toBe('radio-group');

        const content = preview.locator('[data-projection-content]');
        const density = content.getByRole('radiogroup', { name: 'Density preference' });
        const empty = content.getByRole('radiogroup', { name: 'No initial selection' });
        const disabled = content.getByRole('radiogroup', { name: 'Disabled group' });
        const first = density.getByRole('radio', { name: 'Default', exact: true });
        const selected = density.getByRole('radio', { name: 'Comfortable', exact: true });
        const compact = density.getByRole('radio', { name: 'Compact (disabled)', exact: true });
        const value = content.locator('[data-demo-ref="selectedValue"]');
        observations.entry = {
          value: await value.textContent(),
          items: await Promise.all([first, selected, compact].map(itemState)),
        };
        await expect
          .poll(() => value.textContent(), { message: `${runtime}: initial exposed value` })
          .toBe('Value: comfortable');
        if (scenario === 'initial-entry') {
          // P-BASE-RADIO-GROUP-FOCUS-ENTRY: no Item input may establish current
          // before verifying the initially selected, non-first Tab entry.
          await expect
            .poll(async () => (await itemState(selected)).tabIndex, {
              message: `${runtime}: non-first selected Item must be the initial Tab entry`,
            })
            .toBe(0);
          expect(
            await Promise.all(
              [first, selected, compact].map(async (item) => (await itemState(item)).tabIndex)
            )
          ).toEqual([-1, 0, -1]);
          await content.getByText('Density preference', { exact: true }).click();
          await page.keyboard.press('Tab');
          await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
          expect(await value.textContent()).toBe('Value: comfortable');
          observations.focus = await itemState(selected);
          observations.errors = errors;
          expect(errors).toEqual([]);
          await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}.png`) });
          await writeFile(
            path.join(evidenceDir, `${evidenceKey}.json`),
            JSON.stringify(observations, null, 2)
          );
          return;
        }

        // P-SHADCN-RADIO-GROUP* visual and passive-part criteria; Base owns
        // checked/effective-disabled, the single entry and accessible names.
        const initial = await Promise.all([first, selected, compact].map(itemState));
        observations.light = initial;
        expect(initial.map((item) => item.checked)).toEqual(['false', 'true', 'false']);
        expect(initial.map((item) => item.dotOpacity)).toEqual(['0', '1', '0']);
        expect(await density.evaluate((element) => getComputedStyle(element).rowGap)).toBe('12px');
        for (const item of initial) {
          expect(item.width).toBeCloseTo(16, 1);
          expect(item.height).toBeCloseTo(16, 1);
          expect(Number.parseFloat(item.radius)).toBeGreaterThanOrEqual(8);
          expect(item.borderWidth).toBe('1px');
          expect(item.dotWidth).toBeCloseTo(8, 1);
          expect(item.dotHeight).toBeCloseTo(8, 1);
          expect(Math.abs(item.centerX)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(item.centerY)).toBeLessThanOrEqual(0.5);
          expect(item.glyphHidden).toBe('true');
          expect(item.indicatorRole).toBeNull();
          expect(item.indicatorTabIndex).toBeNull();
          expect(item.indicatorControls).toBe(0);
          expect(alpha(item.background)).toBe(0);
          expect(item.transition).toBe('color, box-shadow');
          expect(item.duration).toBe('0.15s');
        }
        expect(initial[2]).toMatchObject({
          disabled: 'true',
          opacity: '0.5',
          cursor: 'not-allowed',
        });
        expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(0);
        expect(await empty.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
        expect(await disabled.locator('[role="radio"][aria-disabled="true"]').count()).toBe(3);
        expect(await disabled.locator('[role="radio"][tabindex="0"]').count()).toBe(0);
        expect(await disabled.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
        expect(await content.locator('input').count()).toBe(0);
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-light.png`) });

        // Independent interaction evidence starts from real pointer selections;
        // the separate initial-entry case remains required and unmodified.
        await clickCenter(page, first);
        await expect.poll(() => value.textContent()).toBe('Value: default');
        await clickCenter(page, selected);
        await expect.poll(() => value.textContent()).toBe('Value: comfortable');
        expect(
          await Promise.all(
            [first, selected, compact].map(async (item) => (await itemState(item)).tabIndex)
          )
        ).toEqual([-1, 0, -1]);

        // Leave the clicked Item with native input, then re-enter with Tab.
        await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
        await page.keyboard.press('Shift+Tab');
        await expect
          .poll(() => density.evaluate((element) => element.contains(document.activeElement)))
          .toBe(false);
        await page.keyboard.press('Tab');
        await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
        await expect.poll(async () => (await itemState(selected)).focusVisible).toBe(true);
        await expect
          .poll(async () => (await itemState(selected)).shadow)
          .toMatch(/0px 0px 0px 3px/);
        observations.focus = await itemState(selected);
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-focus.png`) });

        for (const [key, next] of [
          ['ArrowRight', 'default'],
          ['End', 'comfortable'],
          ['Home', 'default'],
          ['ArrowLeft', 'comfortable'],
          ['ArrowDown', 'default'],
          ['ArrowUp', 'comfortable'],
        ]) {
          await page.keyboard.press(key!);
          await expect.poll(() => value.textContent()).toBe(`Value: ${next}`);
          expect(await density.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
          expect(await density.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
        }

        // P-BASE-RADIO-GROUP-ITEM activation: Tab and Enter leave an empty
        // group unselected; Space requests selection of its focused Item.
        const emptyFirst = empty.getByRole('radio', { name: 'Default', exact: true });
        await page.keyboard.press('Tab');
        await expect.poll(async () => (await itemState(emptyFirst)).focused).toBe(true);
        await page.keyboard.press('Enter');
        await waitForValueProjection(page);
        expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(0);
        await page.keyboard.press('Space');
        await expect.poll(() => emptyFirst.getAttribute('aria-checked')).toBe('true');
        expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
        expect(await value.textContent()).toBe('Value: comfortable');
        observations.emptySelection = await itemState(emptyFirst);

        // Base selection commits on release, not on down or an outside release.
        const rect = await first.boundingBox();
        if (!rect) throw new Error('Default radio has no visible geometry.');
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await waitForValueProjection(page);
        expect(await value.textContent()).toBe('Value: comfortable');
        expect(
          await density
            .getByRole('radio')
            .evaluateAll((items) => items.map((item) => item.getAttribute('aria-checked')))
        ).toEqual(['false', 'true', 'false']);
        await page.mouse.move(rect.x + 60, rect.y + rect.height / 2);
        await page.mouse.up();
        await waitForValueProjection(page);
        expect(await value.textContent()).toBe('Value: comfortable');
        expect(
          await density
            .getByRole('radio')
            .evaluateAll((items) => items.map((item) => item.getAttribute('aria-checked')))
        ).toEqual(['false', 'true', 'false']);
        await clickCenter(page, first);
        await expect.poll(() => value.textContent()).toBe('Value: default');
        await clickCenter(page, compact);
        await waitForValueProjection(page);
        expect(await value.textContent()).toBe('Value: default');
        expect(
          await density
            .getByRole('radio')
            .evaluateAll((items) => items.map((item) => item.getAttribute('aria-checked')))
        ).toEqual(['true', 'false', 'false']);
        await clickCenter(page, disabled.getByRole('radio', { name: 'Default', exact: true }));
        await waitForValueProjection(page);
        expect(
          await disabled
            .getByRole('radio', { name: 'Comfortable', exact: true })
            .getAttribute('aria-checked')
        ).toBe('true');

        await applyColorScheme(page, 'dark');
        await expect
          .poll(async () => alpha((await itemState(first)).background))
          .toBeCloseTo(0.045, 3);
        expect(await value.textContent()).toBe('Value: default');
        observations.dark = await Promise.all([first, selected, compact].map(itemState));
        expect(
          (observations.dark as Awaited<ReturnType<typeof itemState>>[]).map(
            (item) => item.dotOpacity
          )
        ).toEqual(['1', '0', '0']);
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-dark.png`) });

        await page.setViewportSize({ width: 320, height: 900 });
        await preview.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(321);
        observations.narrow = await itemState(first);
        expect((observations.narrow as Awaited<ReturnType<typeof itemState>>).width).toBeCloseTo(
          16,
          1
        );
        expect(await value.textContent()).toBe('Value: default');
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-narrow.png`) });
        await applyColorScheme(page, 'light');
        await expect.poll(async () => alpha((await itemState(first)).background)).toBe(0);
        expect(await value.textContent()).toBe('Value: default');
        expect(errors).toEqual([]);
        observations.errors = errors;
        await writeFile(
          path.join(evidenceDir, `${evidenceKey}.json`),
          JSON.stringify(observations, null, 2)
        );
      } catch (error) {
        observations.errors = errors;
        observations.failure = String(error);
        await writeFile(
          path.join(evidenceDir, `${evidenceKey}-failure.json`),
          JSON.stringify(observations, null, 2)
        );
        await page.screenshot({
          path: path.join(evidenceDir, `${evidenceKey}-failure.png`),
          fullPage: true,
        });
        throw new Error(`${String(error)}\nBrowser errors: ${errors.join('\n')}`, { cause: error });
      } finally {
        await context.close();
      }
    },
    120_000
  );
});
