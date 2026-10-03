// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';

const ROUTE = '/en/test/new-projection-families/';
const FAMILIES = ['bootstrap-2-3-2', 'liquid-glass'] as const;
const evidence = process.env.PROTO_UI_FAMILY_EVIDENCE_DIR;
let browser: Browser;
let context: BrowserContext;
let page: Page;
let baseUrl = '';
const observations: unknown[] = [];

async function open(theme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${ROUTE}?theme=${theme}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.familyFixtureReady, undefined, {
    timeout: 60000,
  });
  const error = await page.locator('html').getAttribute('data-family-fixture-error');
  if (error) throw new Error(error);
  await page.mouse.move(0, 0);
}

async function capture(name: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
}

beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  page = await context.newPage();
}, 150000);

afterAll(async () => {
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await writeFile(
      path.join(evidence, 'metadata.json'),
      JSON.stringify(
        {
          sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          route: ROUTE,
          node: process.version,
          browser: browser?.version(),
          viewport: { width: 1440, height: 1050 },
          runtimes: RUNTIMES,
          scope:
            'Bootstrap 2.3.2 default/primary Button and Liquid Glass opaque fallback only. No native/Compiler/material parity.',
          observations,
        },
        null,
        2
      )
    );
  }
  await context?.close();
  await browser?.close();
  await stopServer();
}, 60000);

describe.sequential('draft family real Web host evidence', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`renders each source projection without website CSS in ${theme}`, async () => {
      await open(theme);
      await capture(`families-${theme}`);
      for (const family of FAMILIES) {
        const rows = [];
        for (const runtime of RUNTIMES) {
          const host = page.locator(`[data-runtime-host="${family}-${runtime}"]`);
          expect(await host.getAttribute('data-mounted')).toBe('true');
          const button = host.getByRole('button', { name: 'Back', exact: true });
          const facts = await button.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              background: s.backgroundColor,
              image: s.backgroundImage,
              color: s.color,
              radius: s.borderRadius,
              padding: s.padding,
              fontSize: s.fontSize,
              lineHeight: s.lineHeight,
              weight: s.fontWeight,
              shadow: s.boxShadow,
              opacity: s.opacity,
              animation: s.animationName,
            };
          });
          rows.push(facts);
          observations.push({ family, runtime, theme, facts });
          expect(facts.fontSize).toBe('14px');
          expect(facts.lineHeight).toBe('20px');
          expect(facts.opacity).toBe('1');
          expect(facts.animation).toBe('none');
          if (family === 'bootstrap-2-3-2') {
            expect(facts.image).toContain('linear-gradient');
            expect(facts.radius).toBe('4px');
            expect(facts.padding).toBe('4px 12px');
            expect(facts.weight).toBe('400');
            expect(facts.color).toBe('rgb(51, 51, 51)');
          } else {
            expect(facts.image).toBe('none');
            expect(facts.radius).toBe('9999px');
            expect(facts.padding).toBe('8px 20px');
            expect(facts.background).toBe(
              theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(44, 44, 46)'
            );
          }
          const disabled = host.getByRole('button', { name: 'Unavailable', exact: true });
          expect(await disabled.getAttribute('aria-disabled')).toBe('true');
          expect(await disabled.evaluate((el) => getComputedStyle(el).opacity)).toBe(
            family === 'bootstrap-2-3-2' ? '0.65' : '0.5'
          );
          if (family === 'bootstrap-2-3-2')
            expect(await disabled.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe(
              'none'
            );
        }
        for (const row of rows.slice(1)) expect(row).toEqual(rows[0]);
      }
    }, 90000);
  }

  it('preserves exact-once native activation, focus and disabled suppression', async () => {
    await open('light');
    for (const family of FAMILIES) {
      for (const runtime of RUNTIMES) {
        const key = `${family}-${runtime}`;
        const host = page.locator(`[data-runtime-host="${key}"]`);
        const output = page.locator(`[data-count="${key}"]`);
        const button = host.getByRole('button', { name: 'Back', exact: true });
        await button.hover();
        const beforePress = await button.evaluate((el) => getComputedStyle(el).boxShadow);
        await page.mouse.down();
        const duringPress = await button.evaluate((el) => getComputedStyle(el).boxShadow);
        expect(duringPress).not.toBe(beforePress);
        observations.push({ family, runtime, beforePress, duringPress });
        await capture(`${family}-${runtime}-pressed`);
        await page.mouse.up();
        await expect
          .poll(() => button.evaluate((el) => getComputedStyle(el).boxShadow))
          .toBe(beforePress);
        await expect
          .poll(() => output.innerText(), { message: `${key}/pointer activation` })
          .toBe('1 activations');
        await button.press('Enter');
        await expect.poll(() => output.innerText()).toBe('2 activations');
        await button.press('Space');
        await expect.poll(() => output.innerText()).toBe('3 activations');
        const primary = host.getByRole('button', { name: 'Continue', exact: true });
        const beforeFocus = await primary.evaluate((el) => ({
          shadow: getComputedStyle(el).boxShadow,
          width: getComputedStyle(el).getPropertyValue('--pui-ring-width').trim(),
        }));
        // Negative control uses the real, unfocused raised surface: its ordinary
        // box shadow must not satisfy the focus-ring oracle.
        const hasFocusDelta = (paint: { shadow: string; width: string }) =>
          paint.width === '2px' && paint.shadow !== beforeFocus.shadow;
        expect(hasFocusDelta(beforeFocus)).toBe(false);
        await button.press('Tab');
        expect(await primary.evaluate((el) => el === document.activeElement)).toBe(true);
        const focused = await primary.evaluate((el) => ({
          shadow: getComputedStyle(el).boxShadow,
          width: getComputedStyle(el).getPropertyValue('--pui-ring-width').trim(),
        }));
        expect(focused.width).toBe('2px');
        expect(hasFocusDelta(focused)).toBe(true);
        observations.push({ family, runtime, beforeFocus, focused });
        await capture(`${family}-${runtime}-keyboard-focus`);
        const disabled = host.getByRole('button', { name: 'Unavailable', exact: true });
        await disabled.click({ force: true });
        await page.evaluate(
          ({ key }) => {
            (window as any).projectionFamilyFixture.setProps(key, 'primary', { disabled: true });
          },
          { key }
        );
        await primary.press('Enter');
        await primary.press('Space');
        expect(await output.innerText()).toBe('3 activations');
        await page.evaluate(
          ({ key, family }) => {
            (window as any).projectionFamilyFixture.setProps(key, 'primary', {
              variant: family === 'bootstrap-2-3-2' ? 'primary' : 'prominent',
            });
          },
          { key, family }
        );
        if (family === 'bootstrap-2-3-2') {
          await button.hover();
          expect(await button.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
        }
      }
    }
    await capture('families-interaction');
  }, 90000);

  it('updates props repeatedly and removes all real hosts on disposal', async () => {
    await open('dark');
    expect(await page.locator('[data-runtime-host]').getByRole('button').count()).toBe(24);
    for (const family of FAMILIES) {
      for (const runtime of RUNTIMES) {
        const key = `${family}-${runtime}`;
        const button = page
          .locator(`[data-runtime-host="${key}"]`)
          .getByRole('button', { name: 'Back', exact: true });
        for (const disabled of [true, false, true, false]) {
          await page.evaluate(
            ({ key, disabled }) => {
              (window as any).projectionFamilyFixture.setProps(key, 'default', { disabled });
            },
            { key, disabled }
          );
          await expect
            .poll(() => button.getAttribute('aria-disabled'), {
              message: `${key}/disabled=${disabled}`,
            })
            .toBe(disabled ? 'true' : 'false');
        }
      }
    }
    await page.evaluate(() => (window as any).projectionFamilyFixture.dispose());
    const remaining = await page.getByRole('button').evaluateAll((elements) =>
      elements.map((el) => ({
        label: el.getAttribute('aria-label') ?? el.textContent,
        owner: (el.getRootNode() as ShadowRoot).host?.localName ?? 'document',
      }))
    );
    observations.push({ afterDispose: remaining });
    // Count the 24 real Prototype controls independently of Astro's service UI.
    await expect
      .poll(() => page.locator('[data-runtime-host]').getByRole('button').count())
      .toBe(0);
    await expect.poll(() => page.locator('[data-runtime-host] [data-pui-root]').count()).toBe(0);
    // Retain the page-wide check too: a leftover application control outside
    // its old host still fails. Only the identified development toolbar may remain.
    expect(remaining.filter((button) => button.owner !== 'astro-dev-toolbar')).toEqual([]);
  }, 90000);

  it('keeps the real fixture readable without mobile overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open('light');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
    await capture('families-mobile');
  }, 90000);
});
