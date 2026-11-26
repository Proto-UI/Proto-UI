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
  runtimeSelectTrigger,
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
      dotTransition: getComputedStyle(indicator).transitionProperty,
      dotDuration: getComputedStyle(indicator).transitionDuration,
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
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  if (!rect) throw new Error('Radio choice has no visible geometry.');
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function waitForValueProjection(page: Page) {
  // Observe the real checked projection after two host rendering opportunities.
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
      ['initial-entry', 'interaction', 'labels'].map((scenario) => ({ runtime, scenario }))
    )
  )(
    '$runtime $scenario projects selection, focus, disabled and theme states through the real family',
    async ({ runtime, scenario }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        colorScheme: 'light',
        hasTouch: scenario === 'labels',
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
        const hero = page.locator('[data-demo-id="demo-shadcn-radio-group"]');
        await selectRuntime(page, hero, runtime, '[role="radiogroup"]', 1);
        await page.keyboard.press('Escape');
        await expect.poll(() => page.getByRole('option').count()).toBe(0);
        expect(await hero.getAttribute('data-projection-mode')).toBe('fixed-family');
        expect(await hero.getAttribute('data-projection-family')).toBe('shadcn');
        expect(await hero.getAttribute('data-projection-component')).toBe('radio-group');

        const initialEntry = scenario === 'initial-entry';
        const preview = initialEntry
          ? hero
          : page.locator('[data-demo-id="demo-shadcn-radio-group-disabled"]');
        const emptyPreview = page.locator('[data-demo-id="demo-shadcn-radio-group-empty"]');
        if (!initialEntry) {
          await selectRuntime(page, emptyPreview, runtime, '[role="radiogroup"]', 1);
          await selectRuntime(page, preview, runtime, '[role="radiogroup"]', 2);
        }
        observations.publicDemos = initialEntry
          ? ['demo-shadcn-radio-group']
          : ['demo-shadcn-radio-group-disabled', 'demo-shadcn-radio-group-empty'];
        const content = preview.locator('.host');
        const density = content.getByRole('radiogroup', {
          name: initialEntry ? 'Display density' : 'Single disabled option',
        });
        const empty = emptyPreview.getByRole('radiogroup', { name: 'No initial selection' });
        const disabled = content.getByRole('radiogroup', { name: 'Disabled radio group' });
        const first = density.getByRole('radio', {
          name: initialEntry ? 'Default' : 'Option 3',
          exact: true,
        });
        const selected = density.getByRole('radio', {
          name: initialEntry ? 'Comfortable' : 'Option 2',
          exact: true,
        });
        const compact = density.getByRole('radio', {
          name: initialEntry ? 'Compact' : 'Disabled',
          exact: true,
        });
        const firstValue = initialEntry ? 'default' : 'option3';
        const selectedValue = initialEntry ? 'comfortable' : 'option2';
        const readValue = async () => {
          const refs = await density
            .locator('[role="radio"][aria-checked="true"]')
            .evaluateAll((items) => items.map((item) => item.getAttribute('data-demo-ref')));
          expect(refs).toHaveLength(1);
          const prefix = initialEntry ? 'hero-' : 'single-';
          expect(refs[0]?.startsWith(prefix)).toBe(true);
          return refs[0]!.slice(prefix.length);
        };
        const enterEmptyWithTab = async () => {
          await emptyPreview.locator('[data-demo-ref="empty-heading"]').click();
          await page.keyboard.press('Tab');
        };
        observations.entry = {
          value: await readValue(),
          items: await Promise.all([first, selected, compact].map(itemState)),
        };
        await expect
          .poll(() => readValue(), { message: `${runtime}: initial public selection` })
          .toBe(selectedValue);
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
          // The actual Runtime toolbar precedes the untouched hero. Enter
          // through native Tab without first clicking or activating any Item.
          await runtimeSelectTrigger(hero).click();
          for (let step = 0; step < 12; step++) {
            await page.keyboard.press('Tab');
            if (await density.evaluate((node) => node.contains(document.activeElement))) break;
          }
          await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
          expect(await readValue()).toBe(selectedValue);
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

        if (scenario === 'labels') {
          // The visible sibling Label is the sole name source and uses Base's
          // default activation. WC exposes DOM CustomEvents; the framework
          // adapters expose callbacks instead, covered by their integration tests.
          const firstLabel = content.locator('[data-demo-ref="single-option3-label"]');
          const selectedLabel = content.locator('[data-demo-ref="single-option2-label"]');
          const compactLabel = content.locator('[data-demo-ref="single-option1-label"]');
          expect(await first.getAttribute('aria-labelledby')).toBe(
            await firstLabel.getAttribute('id')
          );
          expect(await first.locator('.sr-only').count()).toBe(0);
          expect(await firstLabel.getAttribute('tabindex')).toBeNull();
          expect(await firstLabel.getAttribute('role')).toBeNull();
          if (runtime === 'wc') {
            await density.evaluate((element) => {
              element.setAttribute('data-label-change-count', '0');
              element.setAttribute('data-label-select-count', '0');
              element.addEventListener('valueChange', () => {
                element.setAttribute(
                  'data-label-change-count',
                  String(Number(element.getAttribute('data-label-change-count')) + 1)
                );
              });
              element.addEventListener('select', () => {
                element.setAttribute(
                  'data-label-select-count',
                  String(Number(element.getAttribute('data-label-select-count')) + 1)
                );
              });
            });
          }
          const expectSignalCounts = async (count: number) => {
            if (runtime !== 'wc') return;
            expect(await density.getAttribute('data-label-change-count')).toBe(String(count));
            expect(await density.getAttribute('data-label-select-count')).toBe(String(count));
          };
          await firstLabel.click();
          await expect.poll(() => readValue()).toBe(firstValue);
          await expect.poll(async () => (await itemState(first)).focused).toBe(true);
          await expectSignalCounts(1);
          await firstLabel.click();
          await expectSignalCounts(1);
          await selectedLabel.tap();
          await expect.poll(() => readValue()).toBe(selectedValue);
          await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
          await expectSignalCounts(2);
          await compactLabel.click();
          await content.locator('[data-demo-ref="all-option1-label"]').click();
          expect(await readValue()).toBe(selectedValue);
          expect(
            await disabled
              .getByRole('radio', { name: 'Option 2', exact: true })
              .getAttribute('aria-checked')
          ).toBe('true');
          await expectSignalCounts(2);
          observations.labels = {
            signalCarrier:
              runtime === 'wc' ? 'DOM CustomEvent' : 'callback; counted in adapter tests',
            changes: await density.getAttribute('data-label-change-count'),
            selections: await density.getAttribute('data-label-select-count'),
            nameSource: await first.getAttribute('aria-labelledby'),
          };
          // Label does not create a keyboard path; the focused Item keeps it.
          await selectedLabel.click();
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => readValue()).toBe(firstValue);
          await page.keyboard.press('Home');
          await expect.poll(() => readValue()).toBe(selectedValue);
          await page.keyboard.press('End');
          await expect.poll(() => readValue()).toBe(firstValue);
          expect(await density.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
          await enterEmptyWithTab();
          const emptyFirst = empty.getByRole('radio', { name: 'Default', exact: true });
          await expect.poll(async () => (await itemState(emptyFirst)).focused).toBe(true);
          expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(0);
          await page.keyboard.press('Enter');
          await waitForValueProjection(page);
          expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(0);
          await page.keyboard.press('Space');
          await expect.poll(() => emptyFirst.getAttribute('aria-checked')).toBe('true');
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
        // The Rhea profile projects gap-3, so the density rows keep a 12px gap.
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
          // The Rhea profile paints an unchecked item with bg-input/90.
          expect(alpha(item.background)).toBe(item.checked === 'true' ? 1 : 0.9);
          // Rhea animates only the Item focus shadow. The passive checked
          // indicator still changes immediately without a separate transition.
          expect(item.transition).toBe('box-shadow');
          expect(item.duration).toBe('0.15s');
          expect(item.dotTransition).toBe('none');
          expect(item.dotDuration).toBe('0s');
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
        await expect.poll(() => readValue()).toBe(firstValue);
        await clickCenter(page, selected);
        await expect.poll(() => readValue()).toBe(selectedValue);
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
          ['ArrowRight', firstValue],
          ['Home', selectedValue],
          ['End', firstValue],
          ['ArrowLeft', selectedValue],
          ['ArrowDown', firstValue],
          ['ArrowUp', selectedValue],
        ]) {
          await page.keyboard.press(key!);
          await expect.poll(() => readValue()).toBe(next);
          expect(await density.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
          expect(await density.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
        }

        // P-BASE-RADIO-GROUP-ITEM activation: Tab and Enter leave an empty
        // group unselected; ArrowDown chooses the next enabled Item. The
        // separate native Label path retains the Space-from-empty check.
        const emptyFirst = empty.getByRole('radio', { name: 'Default', exact: true });
        await enterEmptyWithTab();
        await expect.poll(async () => (await itemState(emptyFirst)).focused).toBe(true);
        await page.keyboard.press('Enter');
        await waitForValueProjection(page);
        expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(0);
        await page.keyboard.press('ArrowDown');
        const emptySecond = empty.getByRole('radio', { name: 'Comfortable', exact: true });
        await expect.poll(() => emptySecond.getAttribute('aria-checked')).toBe('true');
        await expect.poll(async () => (await itemState(emptySecond)).focused).toBe(true);
        expect(await emptyFirst.getAttribute('aria-checked')).toBe('false');
        expect(await empty.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
        expect(await readValue()).toBe(selectedValue);
        observations.emptySelection = await itemState(emptySecond);

        // Base selection commits on release, not on down or an outside release.
        await first.scrollIntoViewIfNeeded();
        const rect = await first.boundingBox();
        if (!rect) throw new Error('Default radio has no visible geometry.');
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await waitForValueProjection(page);
        expect(await readValue()).toBe(selectedValue);
        expect(
          await Promise.all(
            [first, selected, compact].map((item) => item.getAttribute('aria-checked'))
          )
        ).toEqual(['false', 'true', 'false']);
        await page.mouse.move(rect.x + 60, rect.y + rect.height / 2);
        await page.mouse.up();
        await waitForValueProjection(page);
        expect(await readValue()).toBe(selectedValue);
        expect(
          await Promise.all(
            [first, selected, compact].map((item) => item.getAttribute('aria-checked'))
          )
        ).toEqual(['false', 'true', 'false']);
        await clickCenter(page, first);
        await expect.poll(() => readValue()).toBe(firstValue);
        await clickCenter(page, compact);
        await waitForValueProjection(page);
        expect(await readValue()).toBe(firstValue);
        expect(
          await Promise.all(
            [first, selected, compact].map((item) => item.getAttribute('aria-checked'))
          )
        ).toEqual(['true', 'false', 'false']);
        await clickCenter(page, disabled.getByRole('radio', { name: 'Option 1', exact: true }));
        await waitForValueProjection(page);
        expect(
          await disabled
            .getByRole('radio', { name: 'Option 2', exact: true })
            .getAttribute('aria-checked')
        ).toBe('true');

        await applyColorScheme(page, 'dark');
        await expect.poll(async () => alpha((await itemState(first)).background)).toBe(1);
        // The Rhea profile keeps bg-input/90 in both color schemes; the dark
        // input color carries a 0.15 alpha, so the unchecked surface is 0.135.
        expect(alpha((await itemState(selected)).background)).toBeCloseTo(0.135, 3);
        expect(await readValue()).toBe(firstValue);
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
        expect(await readValue()).toBe(firstValue);
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-narrow.png`) });
        await applyColorScheme(page, 'light');
        await expect.poll(async () => alpha((await itemState(first)).background)).toBe(1);
        await expect.poll(async () => alpha((await itemState(selected)).background)).toBe(0.9);
        expect(await readValue()).toBe(firstValue);
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
