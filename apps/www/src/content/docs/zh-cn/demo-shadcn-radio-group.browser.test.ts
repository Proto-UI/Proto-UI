// @vitest-environment node

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RUNTIMES,
  type RuntimeId,
  applyColorScheme,
  launchBrowser,
  selectRuntime,
  startServer,
  stopServer,
} from './browser-harness';

const ROUTE = '/zh-cn/ui-libraries/shadcn/radio-group/';
const FORM_ROUTE = '/zh-cn/ui-libraries/shadcn/form/';
let browser: Browser;
let baseUrl = '';
let evidenceDir = '';

beforeAll(async () => {
  evidenceDir = await mkdtemp(path.join(tmpdir(), 'proto-shadcn-radio-group-'));
  baseUrl = await startServer([ROUTE, FORM_ROUTE]);
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
  // Allow pending projections to settle before checking a rejected input.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

function radioCheckedStates(group: Locator) {
  return group
    .getByRole('radio')
    .evaluateAll((items) => items.map((item) => item.getAttribute('aria-checked')));
}

async function observeLabelSignals(scope: Locator, runtime: RuntimeId) {
  if (runtime === 'wc') {
    await scope.evaluate((element) => {
      for (const [event, attribute] of [
        ['valueChange', 'data-label-change-count'],
        ['select', 'data-label-select-count'],
      ] as const) {
        element.setAttribute(attribute, '0');
        element.addEventListener(event, () => {
          element.setAttribute(attribute, String(Number(element.getAttribute(attribute)) + 1));
        });
      }
    });
  }
  return async (count: number) => {
    if (runtime !== 'wc') return;
    expect(await scope.getAttribute('data-label-change-count')).toBe(String(count));
    expect(await scope.getAttribute('data-label-select-count')).toBe(String(count));
  };
}

describe.sequential('Shadcn Radio Group public browser acceptance', () => {
  it.each(RUNTIMES)(
    '%s enters the empty Plan group with Tab and selects with Space',
    async (runtime) => {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.goto(`${baseUrl}${FORM_ROUTE}`, { waitUntil: 'domcontentloaded' });
        const preview = page.locator('[data-demo-id="demo-shadcn-field-choices"]');
        await selectRuntime(page, preview, runtime, '[role="radiogroup"]', 1);
        const plan = preview.getByRole('radiogroup');
        const basic = plan.getByRole('radio', { name: 'Basic · 基础', exact: true });
        const status = preview.locator('[data-demo-ref="choiceStatus"]');
        await expect.poll(() => status.textContent()).toContain('proposals=0 owner=accept');
        expect(await radioCheckedStates(plan)).toEqual(['false', 'false', 'false']);
        expect(await plan.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
        expect(await basic.getAttribute('tabindex')).toBe('0');

        // Agreement precedes Plan in the form. No radio receives input before Tab.
        const agreement = preview.getByRole('checkbox');
        await agreement.focus();
        expect(await agreement.evaluate((item) => item === document.activeElement)).toBe(true);
        await page.keyboard.press('Tab');
        await expect.poll(() => basic.evaluate((item) => item === document.activeElement)).toBe(true);
        expect(await radioCheckedStates(plan)).toEqual(['false', 'false', 'false']);
        await page.keyboard.press('Enter');
        await waitForValueProjection(page);
        expect(await radioCheckedStates(plan)).toEqual(['false', 'false', 'false']);
        expect(await status.textContent()).toContain('proposals=0 owner=accept');
        await page.keyboard.press('Space');
        await expect.poll(() => radioCheckedStates(plan)).toEqual(['true', 'false', 'false']);
        expect(await status.textContent()).toContain('proposals=1 owner=accept');
        expect(await basic.evaluate((item) => item === document.activeElement)).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
    120_000
  );

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
        const preview = page.locator('[data-demo-id="demo-shadcn-radio-group"]');
        await selectRuntime(page, preview, runtime, '[role="radiogroup"]', 1);
        await page.keyboard.press('Escape');
        await expect.poll(() => page.getByRole('option').count()).toBe(0);
        expect(await preview.getAttribute('data-projection-mode')).toBe('fixed-family');
        expect(await preview.getAttribute('data-projection-family')).toBe('shadcn');
        expect(await preview.getAttribute('data-projection-component')).toBe('radio-group');

        const content = preview.locator('[data-projection-content]');
        const density = content.getByRole('radiogroup', { name: 'Display density' });
        const first = density.getByRole('radio', { name: 'Default', exact: true });
        const selected = density.getByRole('radio', { name: 'Comfortable', exact: true });
        const compact = density.getByRole('radio', { name: 'Compact', exact: true });
        const checkedStates = () => radioCheckedStates(density);
        observations.entry = {
          checked: await checkedStates(),
          items: await Promise.all([first, selected, compact].map(itemState)),
        };
        await expect
          .poll(checkedStates, { message: `${runtime}: initial checked selection` })
          .toEqual(['false', 'true', 'false']);
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
          await preview.locator('[role="tab"][aria-selected="true"]').first().focus();
          await page.keyboard.press('Tab');
          await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
          expect(await checkedStates()).toEqual(['false', 'true', 'false']);
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
          const firstLabel = content.locator('[data-demo-ref="hero-default-label"]');
          const selectedLabel = content.locator('[data-demo-ref="hero-comfortable-label"]');
          const compactLabel = content.locator('[data-demo-ref="hero-compact-label"]');
          expect(await first.getAttribute('aria-labelledby')).toBe(
            await firstLabel.getAttribute('id')
          );
          expect(await first.locator('.sr-only').count()).toBe(0);
          expect(await firstLabel.getAttribute('tabindex')).toBeNull();
          expect(await firstLabel.getAttribute('role')).toBeNull();
          const expectSignalCounts = await observeLabelSignals(density, runtime);
          await firstLabel.click();
          await expect.poll(checkedStates).toEqual(['true', 'false', 'false']);
          await expect.poll(async () => (await itemState(first)).focused).toBe(true);
          await expectSignalCounts(1);
          await firstLabel.click();
          await expectSignalCounts(1);
          await selectedLabel.tap();
          await expect.poll(checkedStates).toEqual(['false', 'true', 'false']);
          await expect.poll(async () => (await itemState(selected)).focused).toBe(true);
          await expectSignalCounts(2);
          await compactLabel.click();
          await expect.poll(checkedStates).toEqual(['false', 'false', 'true']);
          await expectSignalCounts(3);
          observations.labels = {
            signalCarrier:
              runtime === 'wc' ? 'DOM CustomEvent' : 'callback; counted in adapter tests',
            changes: await density.getAttribute('data-label-change-count'),
            selections: await density.getAttribute('data-label-select-count'),
            nameSource: await first.getAttribute('aria-labelledby'),
          };
          // Label does not create a keyboard path; the focused Item keeps it.
          await selectedLabel.click();
          await expect.poll(checkedStates).toEqual(['false', 'true', 'false']);
          await page.keyboard.press('ArrowRight');
          await expect.poll(checkedStates).toEqual(['false', 'false', 'true']);
          await page.keyboard.press('Home');
          await expect.poll(checkedStates).toEqual(['true', 'false', 'false']);
          await page.keyboard.press('End');
          await expect.poll(checkedStates).toEqual(['false', 'false', 'true']);
          expect(await density.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
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
          // The Rhea profile paints an unchecked item with bg-input/90 and transition-shadow (150ms).
          expect(alpha(item.background)).toBe(item.checked === 'true' ? 1 : 0.9);
          expect(item.duration).toBe('0.15s');
        }
        expect(await content.locator('input').count()).toBe(0);
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-light.png`) });

        // Independent interaction evidence starts from real pointer selections;
        // the separate initial-entry case remains required and unmodified.
        await clickCenter(page, first);
        await expect.poll(checkedStates).toEqual(['true', 'false', 'false']);
        await clickCenter(page, selected);
        await expect.poll(checkedStates).toEqual(['false', 'true', 'false']);
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

        for (const [key, expected] of [
          ['ArrowRight', ['false', 'false', 'true']],
          ['Home', ['true', 'false', 'false']],
          ['End', ['false', 'false', 'true']],
          ['ArrowLeft', ['false', 'true', 'false']],
          ['ArrowDown', ['false', 'false', 'true']],
          ['ArrowUp', ['false', 'true', 'false']],
        ] as const) {
          await page.keyboard.press(key);
          await expect.poll(checkedStates).toEqual(expected);
          expect(await density.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
          expect(await density.locator('[role="radio"][tabindex="0"]').count()).toBe(1);
        }

        // Base selection commits on release, not on down or an outside release.
        const rect = await first.boundingBox();
        if (!rect) throw new Error('Default radio has no visible geometry.');
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await waitForValueProjection(page);
        expect(await checkedStates()).toEqual(['false', 'true', 'false']);
        await page.mouse.move(rect.x + 60, rect.y + rect.height / 2);
        await page.mouse.up();
        await waitForValueProjection(page);
        expect(await checkedStates()).toEqual(['false', 'true', 'false']);
        await clickCenter(page, first);
        await expect.poll(checkedStates).toEqual(['true', 'false', 'false']);

        // Verify disabled item and disabled group in the dedicated disabled demo.
        const disabledPreview = page.locator('[data-demo-id="demo-shadcn-radio-group-disabled"]');
        await disabledPreview.scrollIntoViewIfNeeded();
        await selectRuntime(page, disabledPreview, runtime, '[role="radiogroup"]', 2);
        const single = disabledPreview.getByRole('radiogroup', { name: 'Single disabled option' });
        const disabledItem = single.getByRole('radio', { name: 'Disabled', exact: true });
        expect(await itemState(disabledItem)).toMatchObject({
          disabled: 'true',
          tabIndex: -1,
          opacity: '0.5',
          cursor: 'not-allowed',
        });
        const disabledGroup = disabledPreview.getByRole('radiogroup', {
          name: 'Disabled radio group',
        });
        expect(await disabledGroup.locator('[role="radio"][aria-disabled="true"]').count()).toBe(3);
        expect(await disabledGroup.locator('[role="radio"][tabindex="0"]').count()).toBe(0);
        expect(await disabledGroup.locator('[role="radio"][aria-checked="true"]').count()).toBe(1);
        const expectDisabledDemoSignals = await observeLabelSignals(disabledPreview, runtime);
        await single.locator('[data-demo-ref="single-option3-label"]').click();
        await expect.poll(() => radioCheckedStates(single)).toEqual(['false', 'false', 'true']);
        await expectDisabledDemoSignals(1);
        await page.keyboard.press('ArrowRight');
        const option2 = single.getByRole('radio', { name: 'Option 2', exact: true });
        await expect.poll(async () => (await itemState(option2)).focused).toBe(true);
        await expect.poll(() => radioCheckedStates(single)).toEqual(['false', 'true', 'false']);
        await expectDisabledDemoSignals(2);

        const groupItem = disabledGroup.getByRole('radio', { name: 'Option 1', exact: true });
        for (const [item, label] of [
          [disabledItem, single.locator('[data-demo-ref="single-option1-label"]')],
          [groupItem, disabledGroup.locator('[data-demo-ref="all-option1-label"]')],
        ] as const) {
          const labelId = await label.getAttribute('id');
          expect(labelId).toBeTruthy();
          expect(await item.getAttribute('aria-labelledby')).toBe(labelId);
          for (const target of [label, item]) {
            // Deliver a pointer click even when Playwright considers the target disabled.
            await target.click({ force: true });
            await waitForValueProjection(page);
            expect(await radioCheckedStates(single)).toEqual(['false', 'true', 'false']);
            expect(await radioCheckedStates(disabledGroup)).toEqual(['false', 'true', 'false']);
            await expectDisabledDemoSignals(2);
            if (target === label) expect((await itemState(item)).focused).toBe(false);
          }
        }

        await preview.scrollIntoViewIfNeeded();
        await applyColorScheme(page, 'dark');
        await expect.poll(async () => alpha((await itemState(first)).background)).toBe(1);
        // The Rhea profile keeps bg-input/90 in both color schemes; the dark
        // input color carries a 0.15 alpha, so the unchecked surface is 0.135.
        expect(alpha((await itemState(selected)).background)).toBeCloseTo(0.135, 3);
        expect(await checkedStates()).toEqual(['true', 'false', 'false']);
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
        expect(await checkedStates()).toEqual(['true', 'false', 'false']);
        await preview.screenshot({ path: path.join(evidenceDir, `${evidenceKey}-narrow.png`) });
        await applyColorScheme(page, 'light');
        await expect.poll(async () => alpha((await itemState(first)).background)).toBe(1);
        await expect.poll(async () => alpha((await itemState(selected)).background)).toBe(0.9);
        expect(await checkedStates()).toEqual(['true', 'false', 'false']);
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
