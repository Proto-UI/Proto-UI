// @vitest-environment node

import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer } from './browser-harness';

const ROUTE = '/zh-cn/internal/demo-matrix/';
const S1 = '[data-shadow-s1]';
const PROFILES = ['light', 'split'] as const;
// P-BRUTALIST-BADGE-TONES maps accent/info/danger to canary/sky/coral.
// These RGB values are the S1 app fixture's explicit theme, not family-wide constants.
const TONES = ['rgb(255, 216, 61)', 'rgb(133, 215, 255)', 'rgb(255, 147, 127)'];
const THEMES = [
  { primary: 'rgb(38, 58, 96)', ink: 'rgb(255, 255, 255)', input: 'rgb(135, 148, 170)' },
  { primary: 'rgb(226, 232, 240)', ink: 'rgb(15, 23, 42)', input: 'rgb(115, 132, 154)' },
];
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const MAGENTA = 'rgb(255, 0, 180)';
const PURPLE = 'rgb(100, 80, 210)';
const GREEN = 'rgb(0, 180, 140)';
const RED = 'rgb(220, 20, 40)';
const TICK = 'm20 6-11 11-5-5';
const DASH = 'M5 12h14';

let browser: Browser;
let baseUrl: string;
beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);

const root = (page: Page, profile: string) =>
  page.locator(`${S1} [data-profile="${profile}"] [data-s1-component="checkbox"]`);

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

async function action(page: Page, name: string) {
  await page.locator(`${S1} [data-action="${name}"]`).click();
  await settle(page);
}

async function read(page: Page) {
  return page.locator(S1).evaluate((section) =>
    Array.from(section.querySelectorAll<HTMLElement>('[data-profile]')).map((column) => {
      const component = (kind: string) => {
        const host = column.querySelector<HTMLElement>(`[data-s1-component="${kind}"]`)!;
        const surface = host.shadowRoot?.querySelector<HTMLElement>('[part="surface"]') ?? host;
        const css = getComputedStyle(surface);
        const h = host.getBoundingClientRect(),
          s = surface.getBoundingClientRect();
        return {
          background: css.backgroundColor,
          color: css.color,
          opacity: css.opacity,
          scheme: host.getAttribute('data-pui-color-scheme'),
          checked: host.getAttribute('aria-checked'),
          disabled: host.getAttribute('aria-disabled'),
          hostSize: [h.width, h.height],
          surfaceSize: [s.width, s.height],
        };
      };
      const indicator = column.querySelector<HTMLElement>('[data-s1-component="indicator"]')!;
      const glyphs = Array.from((indicator.shadowRoot ?? indicator).querySelectorAll('path'));
      const text = column.querySelector<HTMLElement>('.s1-slot-text')!;
      return {
        profile: column.dataset.profile,
        badge: component('badge'),
        checkbox: component('checkbox'),
        indicator: component('indicator'),
        glyphs: glyphs.map((path) => path.getAttribute('d')),
        text: text.textContent,
        textColor: getComputedStyle(text).color,
        textInDocument: text.getRootNode() === document,
        changes: Number(column.dataset.changes),
        generation: Number(column.dataset.generation),
      };
    })
  );
}

async function visit(run: (page: Page) => Promise<void>, route = ROUTE) {
  // A fresh, explicitly light browser context makes the document baseline deterministic.
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}${route}`);
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>('[data-shadow-s1]')?.dataset.ready === 'true'
    );
    await run(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  } finally {
    await context.close();
  }
}

async function assertTone(page: Page, index: number, phase: string) {
  for (const row of await read(page)) {
    expect(row.badge.background, `${phase}/${row.profile}/tone`).toBe(TONES[index]);
    expect(row.badge.color, `${phase}/${row.profile}/ink`).toBe('rgb(23, 32, 51)');
    expect(row.badge.hostSize, `${phase}/${row.profile}/surface bounds`).toEqual(
      row.badge.surfaceSize
    );
  }
}

describe.sequential('S1 public Shadow split browser paths', () => {
  for (const locale of ['zh-cn', 'en']) {
    it(`cycles through actual tone colors twice without reconnecting (${locale})`, async () => {
      await visit(async (page) => {
        expect(await page.locator(`${S1} [data-action="scheme-checkbox"]`).textContent()).toContain(
          locale === 'zh-cn' ? '仅 split' : 'split only'
        );
        await assertTone(page, 0, 'initial accent');
        for (let step = 1; step <= 6; step++) {
          await action(page, 'tone');
          await assertTone(page, step % 3, `tone step ${step}`);
          expect(await page.locator(`${S1} [data-tone]`).textContent()).toBe(
            ['accent', 'info', 'danger'][step % 3]
          );
          expect(
            await page.locator(`${S1} [data-action="tone"]`).getAttribute('aria-pressed')
          ).toBe(null);
        }
        expect((await read(page)).map((row) => row.generation)).toEqual([1, 1]);
      }, `/${locale}/internal/demo-matrix/`);
    }, 90_000);
  }

  it('resolves theme × split scheme × checked/mixed × disabled to actual paint and glyphs', async () => {
    // P-SHADCN-CHECKBOX-STATE-DRIVEN-STYLES; P-SHADCN-CHECKBOX-INDICATOR-GLYPH-SELECTION;
    // P-BASE-CHECKBOX-DISABLED-SUPPRESS-ACTIVATION. All 32 combinations, not just parity.
    await visit(async (page) => {
      let checked = false,
        mixed = false,
        dark = false,
        changes = 0;
      for (let theme = 0; theme < 2; theme++) {
        if (theme) await action(page, 'theme');
        for (const wantDark of [false, true]) {
          if (dark !== wantDark) {
            await action(page, 'scheme-checkbox');
            dark = wantDark;
          }
          // Browser CSSOM normalizes color-mix serialization; the expected input comes
          // from the fixture palette and the governed bg-input/30 recipe, not the component.
          const tint = await page.evaluate((input) => {
            const reference = document.createElement('div');
            reference.style.backgroundColor = `color-mix(in oklab, ${input} 30%, transparent)`;
            document.body.append(reference);
            try {
              return getComputedStyle(reference).backgroundColor;
            } finally {
              reference.remove();
            }
          }, THEMES[theme].input);
          for (const [wantChecked, wantMixed] of [
            [false, false],
            [true, false],
            [false, true],
            [true, true],
          ]) {
            if (mixed) {
              await action(page, 'mixed');
              mixed = false;
            }
            if (checked !== wantChecked) {
              for (const profile of PROFILES) await root(page, profile).click();
              changes++;
              checked = wantChecked;
              await settle(page);
            }
            if (wantMixed) {
              await action(page, 'mixed');
              mixed = true;
            }
            for (const disabled of [false, true]) {
              if (disabled) await action(page, 'disabled');
              if (disabled) {
                for (const profile of PROFILES) await root(page, profile).click({ force: true });
                await settle(page);
              }
              for (const row of await read(page)) {
                const label = JSON.stringify({
                  theme,
                  dark,
                  checked,
                  mixed,
                  disabled,
                  profile: row.profile,
                });
                const filled = checked || mixed;
                expect(row.checkbox.checked, label).toBe(mixed ? 'mixed' : String(checked));
                expect(row.checkbox.disabled === 'true', label).toBe(disabled);
                expect(row.checkbox.opacity, label).toBe(disabled ? '0.5' : '1');
                expect(row.checkbox.background, label).toBe(
                  filled
                    ? THEMES[theme].primary
                    : row.profile === 'split' && dark
                      ? tint
                      : TRANSPARENT
                );
                if (filled) {
                  expect(row.checkbox.color, label).toBe(THEMES[theme].ink);
                  expect(row.indicator.color, label).toBe(THEMES[theme].ink);
                }
                expect(row.glyphs, label).toEqual(mixed ? [DASH] : checked ? [TICK] : []);
                expect(row.checkbox.hostSize, label).toEqual([16, 16]);
                expect(row.checkbox.surfaceSize, label).toEqual([16, 16]);
                expect(row.indicator.surfaceSize, label).toEqual([14, 14]);
                expect(row.changes, label).toBe(changes);
                expect(row.checkbox.scheme, label).toBe(
                  row.profile === 'split' ? (dark ? 'dark' : 'light') : null
                );
                expect(row.badge.scheme, label).toBe(row.profile === 'split' ? 'light' : null);
              }
              if (disabled) await action(page, 'disabled');
            }
          }
        }
      }
    });
  }, 150_000);

  it('restores the latest tone and theme after each CSS escape is removed', async () => {
    // D-WEB-COMPONENT-SHADOW-PROFILE-0001-H/I. Each escape is paired with
    // live tone/theme/slot updates, including content owned by the consumer.
    await visit(async (page) => {
      let tone = 0,
        theme = 0;
      for (const escape of ['disturb', 'part', 'inline', 'class']) {
        await action(page, escape);
        await action(page, 'tone');
        tone = (tone + 1) % 3;
        await action(page, 'theme');
        theme = 1 - theme;
        await action(page, 'slot');
        for (const row of await read(page)) {
          const split = row.profile === 'split';
          const expected =
            escape === 'inline'
              ? PURPLE
              : escape === 'part' && split
                ? GREEN
                : (escape === 'disturb' || escape === 'class') && !split
                  ? MAGENTA
                  : null;
          expect(row.badge.background, `${escape}/${row.profile}/badge`).toBe(
            expected ?? TONES[tone]
          );
          expect(row.checkbox.background, `${escape}/${row.profile}/checkbox`).toBe(
            expected ?? TRANSPARENT
          );
          expect(row.textInDocument).toBe(true);
          expect(row.textColor).toBe(escape === 'disturb' ? RED : 'rgb(23, 32, 51)');
        }
        await action(page, escape);
        await assertTone(page, tone, `${escape} removed`);
        // Fresh native input must use the latest inherited theme after the override.
        for (const profile of PROFILES) await root(page, profile).click();
        await settle(page);
        for (const row of await read(page)) {
          expect(row.checkbox.background).toBe(THEMES[theme].primary);
          expect(row.indicator.color).toBe(THEMES[theme].ink);
          expect(row.glyphs).toEqual([TICK]);
          expect(row.textColor).toBe('rgb(23, 32, 51)');
        }
        for (const profile of PROFILES) await root(page, profile).click();
        await settle(page);
      }
    });
  }, 120_000);

  it('retains combined state on move and replays disconnected updates on a fresh generation', async () => {
    // D-WEB-COMPONENT-SHADOW-PROFILE-0001-F; STYLE-0001 owner generation;
    // public Checkbox composition must remain interactive, not just repaint.
    await visit(async (page) => {
      for (const name of [
        'tone',
        'theme',
        'scheme-checkbox',
        'mixed',
        'disabled',
        'constraint',
        'slot',
      ])
        await action(page, name);
      const before = await read(page);
      await action(page, 'move');
      expect(await read(page), 'synchronous move preserves observed state').toEqual(before);
      const hosts = await page.locator(`${S1} [data-s1-component="checkbox"]`).elementHandles();
      await action(page, 'disconnect');
      for (const host of hosts) {
        expect(await host.evaluate((el) => el.isConnected)).toBe(false);
        expect(
          await host.evaluate((el) =>
            el instanceof HTMLElement ? (el.shadowRoot?.childNodes.length ?? 0) : -1
          )
        ).toBe(0);
        expect(await host.getAttribute('data-pui-color-scheme')).toBe(null);
      }
      for (const name of ['tone', 'scheme-checkbox', 'disabled']) await action(page, name);
      await action(page, 'disconnect');
      await assertTone(page, 2, 'reconnected danger');
      for (const row of await read(page)) {
        expect(row.generation).toBe(2);
        expect(row.checkbox.checked).toBe('mixed');
        expect(row.checkbox.background).toBe(THEMES[1].primary);
        expect(row.glyphs).toEqual([DASH]);
        expect(row.changes).toBe(0);
        expect(row.checkbox.opacity).toBe('1');
        expect(row.text).toBe('A longer replacement badge');
        expect(row.checkbox.scheme).toBe(row.profile === 'split' ? 'light' : null);
      }
      // Use native Space and Enter on the reconnected boundaries.
      for (const profile of PROFILES) {
        await root(page, profile).focus();
        await page.keyboard.press('Space');
        await page.keyboard.press('Enter');
      }
      await settle(page);
      for (const row of await read(page)) {
        expect(row.checkbox.checked).toBe('true');
        expect(row.glyphs).toEqual([TICK]);
        expect(row.changes).toBe(1);
      }
      await action(page, 'tone');
      await assertTone(page, 0, 'live accent after reconnect');
      await page.setViewportSize({ width: 320, height: 900 });
      await settle(page);
      expect(await page.locator(S1).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
    });
  }, 120_000);
});
