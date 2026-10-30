// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, ElementHandle, Page } from 'playwright-core';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';
import { isUnpaintedBootstrapBoxShadow } from './bootstrap-disabled-paint';

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
          bootstrapSizingSource: {
            version: 'twbs/bootstrap v2.3.2',
            url: 'https://github.com/twbs/bootstrap/blob/v2.3.2/docs/assets/css/bootstrap.css#L3198-L3559',
            blob: 'b725064aab21e434d29209d259d3892478aa9536',
          },
          scope:
            'Bootstrap 2.3.2 seven-color/four-size Button and Liquid Glass opaque fallback only. No native/Compiler/material parity.',
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
            family === 'bootstrap-2-3-2' ? '0.65' : '1'
          );
          if (family === 'liquid-glass') {
            // This neutral opaque fixture keeps its same-state palette when disabled.
            // The command contract forbids fading the whole host.
            const disabledPaint = await disabled.evaluate((el) => {
              const style = getComputedStyle(el);
              return {
                background: style.backgroundColor,
                foreground: style.color,
                image: style.backgroundImage,
                pointerEvents: style.pointerEvents,
              };
            });
            expect(disabledPaint).toEqual({
              background: facts.background,
              foreground: facts.color,
              image: 'none',
              pointerEvents: 'none',
            });
            expect(disabledPaint.background).toBe(
              theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(44, 44, 46)'
            );
          }
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
              disabled: false,
            });
          },
          { key, family }
        );
        await expect
          .poll(() => primary.getAttribute('aria-disabled'), { message: `${key}/restored primary` })
          .toBe('false');
        if (family === 'bootstrap-2-3-2') {
          await button.hover();
          expect(await button.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
            'linear-gradient'
          );
        }
      }
    }
    await capture('families-interaction');
  }, 90000);

  it('keeps Bootstrap pixel dimensions and activation at root16 and root32', async () => {
    // Fixed source: twbs/bootstrap v2.3.2 docs/assets/css/bootstrap.css:3198-3226.
    // Changing root font size is not browser zoom. Real browser zoom remains unverified.
    const expected = {
      padding: '4px 12px',
      fontSize: '14px',
      lineHeight: '20px',
      radius: '4px',
      borderWidth: '1px',
      height: 30,
    };
    for (const rootFont of [16, 32]) {
      await open('light');
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}px`;
      }, rootFont);
      expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe(
        `${rootFont}px`
      );
      await capture(`bootstrap-button-root${rootFont}-default-primary`);
      for (const runtime of RUNTIMES) {
        const key = `bootstrap-2-3-2-${runtime}`;
        const host = page.locator(`[data-runtime-host="${key}"]`);
        const output = page.locator(`[data-count="${key}"]`);
        const button = host.getByRole('button', { name: 'Back', exact: true });
        const primary = host.getByRole('button', { name: 'Continue', exact: true });
        for (const control of [button, primary]) {
          const readMetrics = () =>
            control.evaluate((el) => {
              const style = getComputedStyle(el);
              return {
                padding: style.padding,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                radius: style.borderRadius,
                borderWidth: style.borderWidth,
                height: el.getBoundingClientRect().height,
              };
            });
          await expect
            .poll(readMetrics, { message: `${key}/root${rootFont}/fixed px metrics` })
            .toEqual(expected);
          observations.push({
            key,
            rootFont,
            label: await control.innerText(),
            metrics: await readMetrics(),
          });
        }
        await button.click();
        await button.press('Enter');
        await button.press('Space');
        await expect.poll(() => output.innerText()).toBe('3 activations');
        await page.evaluate((key) => {
          (window as any).projectionFamilyFixture.setProps(key, 'primary', { disabled: true });
        }, key);
        await expect.poll(() => primary.getAttribute('aria-disabled')).toBe('true');
        await primary.click({ force: true });
        await primary.press('Enter');
        await primary.press('Space');
        expect(await output.innerText()).toBe('3 activations');
        // The public demo API patches props, so restore explicit values here.
        // Neither an empty patch nor undefined removes a provided key. Actual
        // raw-prop removal is covered by the controller unit test, not this fixture.
        await page.evaluate((key) => {
          (window as any).projectionFamilyFixture.setProps(key, 'primary', {
            variant: 'default',
            disabled: false,
          });
        }, key);
        await expect.poll(() => primary.getAttribute('aria-disabled')).toBe('false');
        await page.mouse.move(0, 0);
        await expect
          .poll(() => primary.evaluate((el) => getComputedStyle(el).backgroundImage))
          .toBe('linear-gradient(rgb(255, 255, 255), rgb(230, 230, 230))');
        await primary.press('Enter');
        await expect.poll(() => output.innerText()).toBe('4 activations');
      }
      await capture(`bootstrap-button-root${rootFont}-restored-props`);
    }
  }, 120000);

  it.each([16, 32])(
    'switches all Bootstrap sizes on real controls at root%d',
    async (rootFont) => {
      // Fixed v2.3.2 CSS:3198-3329. These are root-font changes, not browser zoom.
      const dimensions = {
        default: { padding: '4px 12px', fontSize: '14px', radius: '4px', height: 30 },
        large: { padding: '11px 19px', fontSize: '17.5px', radius: '6px', height: 44 },
        small: { padding: '2px 10px', fontSize: '11.9px', radius: '3px', height: 26 },
        mini: { padding: '0px 6px', fontSize: '10.5px', radius: '3px', height: 22 },
      };
      await open('light');
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${value}px`;
      }, rootFont);
      expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe(
        `${rootFont}px`
      );
      const counts = new Map<string, number>();
      const originalControls = new Map<string, ElementHandle<HTMLElement | SVGElement>>();
      for (const runtime of RUNTIMES) {
        const key = `bootstrap-2-3-2-${runtime}`;
        const host = page.locator(`[data-runtime-host="${key}"]`);
        for (const [ref, label] of [
          ['default', 'Back'],
          ['primary', 'Continue'],
        ] as const) {
          const handle = await host
            .getByRole('button', { name: label, exact: true })
            .elementHandle();
          if (!handle) throw new Error(`Missing original ${key}/${ref}`);
          originalControls.set(`${key}/${ref}`, handle);
        }
      }
      // Keep the same mounted instances and switch in nonmonotonic order, then
      // explicitly restore default through the public patch API (not undefined).
      for (const size of ['large', 'mini', 'small', 'default'] as const) {
        for (const runtime of RUNTIMES) {
          const key = `bootstrap-2-3-2-${runtime}`;
          const host = page.locator(`[data-runtime-host="${key}"]`);
          const output = page.locator(`[data-count="${key}"]`);
          for (const [ref, label] of [
            ['default', 'Back'],
            ['primary', 'Continue'],
          ] as const) {
            const control = host.getByRole('button', { name: label, exact: true });
            const original = originalControls.get(`${key}/${ref}`)!;
            const sameConnectedNode = () =>
              control.evaluate((el, initial) => el === initial && el.isConnected, original);
            await page.evaluate(
              ({ key, ref, size }) => {
                (window as any).projectionFamilyFixture.setProps(key, ref, {
                  size,
                  variant: ref,
                  disabled: false,
                });
              },
              { key, ref, size }
            );
            await expect.poll(() => control.getAttribute('aria-disabled')).toBe('false');
            await expect.poll(sameConnectedNode).toBe(true);
            const readMetrics = () =>
              control.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                  padding: style.padding,
                  fontSize: style.fontSize,
                  radius: style.borderRadius,
                  height: el.getBoundingClientRect().height,
                  lineHeight: style.lineHeight,
                  borderWidth: style.borderWidth,
                };
              });
            const expected = { ...dimensions[size], lineHeight: '20px', borderWidth: '1px' };
            await expect
              .poll(readMetrics, { message: `${key}/${ref}/${size}/root${rootFont}` })
              .toEqual(expected);
            observations.push({ key, variant: ref, size, rootFont, metrics: await readMetrics() });
            let count = counts.get(key) ?? 0;
            for (const activate of [
              () => control.click(),
              () => control.press('Enter'),
              () => control.press('Space'),
            ]) {
              await activate();
              count += 1;
              await expect.poll(() => output.innerText()).toBe(`${count} activations`);
            }
            counts.set(key, count);
            await page.evaluate(
              ({ key, ref }) => {
                (window as any).projectionFamilyFixture.setProps(key, ref, { disabled: true });
              },
              { key, ref }
            );
            await expect.poll(() => control.getAttribute('aria-disabled')).toBe('true');
            await expect.poll(sameConnectedNode).toBe(true);
            await expect.poll(readMetrics).toEqual(expected);
            await control.click({ force: true });
            await control.press('Enter');
            await control.press('Space');
            expect(await output.innerText()).toBe(`${count} activations`);
            await page.evaluate(
              ({ key, ref }) => {
                (window as any).projectionFamilyFixture.setProps(key, ref, { disabled: false });
              },
              { key, ref }
            );
            await expect.poll(() => control.getAttribute('aria-disabled')).toBe('false');
            await expect.poll(sameConnectedNode).toBe(true);
            await expect.poll(readMetrics).toEqual(expected);
          }
        }
        await page.mouse.move(0, 0);
        await capture(`bootstrap-button-v2.3.2-${size}-root${rootFont}`);
      }
      for (const handle of originalControls.values()) await handle.dispose();
    },
    180000
  );

  it.each(RUNTIMES.flatMap((runtime) => [16, 32].map((rootFont) => ({ runtime, rootFont }))))(
    'checks seven Bootstrap palette/state endpoints through $runtime at root$rootFont',
    async ({ runtime, rootFont }) => {
      // Modern final CSS cascade, fixed v2.3.2:3198-3559; not IE fallback colors.
      const palette = [
        ['default', '#fff', '#e6e6e6', '#f5f5f5'],
        ['primary', '#08c', '#04c', '#006dcc'],
        ['warning', '#fbb450', '#f89406', '#faa732'],
        ['danger', '#ee5f5b', '#bd362f', '#da4f49'],
        ['success', '#62c462', '#51a351', '#5bb75b'],
        ['info', '#5bc0de', '#2f96b4', '#49afcd'],
        ['inverse', '#444', '#222', '#363636'],
      ] as const;
      const rgb = (hex: string) => {
        const value =
          hex.length === 4
            ? hex
                .slice(1)
                .split('')
                .map((c) => c + c)
                .join('')
            : hex.slice(1);
        return `rgb(${[0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(', ')})`;
      };
      await open('light');
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${value}px`;
      }, rootFont);
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
        .toBe(`${rootFont}px`);
      const key = `bootstrap-2-3-2-${runtime}`;
      const host = page.locator(`[data-runtime-host="${key}"]`);
      const control = host.getByRole('button', { name: 'Continue', exact: true });
      const previous = host.getByRole('button', { name: 'Back', exact: true });
      const output = page.locator(`[data-count="${key}"]`);
      const original = await control.elementHandle();
      if (!original) throw new Error(`Missing original ${key}`);
      const identity = () =>
        control.evaluate((el, first) => el === first && el.isConnected, original);
      const paint = () =>
        control.evaluate((el) => {
          const css = getComputedStyle(el);
          return {
            background: css.backgroundColor,
            image: css.backgroundImage,
            position: css.backgroundPosition,
            repeat: css.backgroundRepeat,
            color: css.color,
            textShadow: css.textShadow,
            borders: [
              css.borderTopColor,
              css.borderRightColor,
              css.borderBottomColor,
              css.borderLeftColor,
            ],
            shadow: css.boxShadow,
            ring: css.getPropertyValue('--pui-ring-width').trim(),
            opacity: css.opacity,
          };
        });
      let count = 0;
      for (const [variant, start, end, base] of palette) {
        await previous.focus();
        await page.mouse.move(0, 0);
        await page.evaluate(
          ({ key, variant }) => {
            (window as any).projectionFamilyFixture.setProps(key, 'primary', {
              variant,
              size: 'default',
              disabled: false,
            });
          },
          { key, variant }
        );
        await expect.poll(() => control.getAttribute('aria-disabled')).toBe('false');
        const fixedPaint = {
          repeat: 'repeat-x',
          color: variant === 'default' ? rgb('#333') : rgb('#fff'),
          textShadow:
            variant === 'default'
              ? 'rgba(255, 255, 255, 0.75) 0px 1px 1px'
              : 'rgba(0, 0, 0, 0.25) 0px -1px 0px',
          borders: [
            'rgba(0, 0, 0, 0.1)',
            'rgba(0, 0, 0, 0.1)',
            variant === 'default' ? rgb('#b3b3b3') : 'rgba(0, 0, 0, 0.25)',
            'rgba(0, 0, 0, 0.1)',
          ],
        };
        const image = `linear-gradient(${rgb(start)}, ${rgb(end)})`;
        const assertPaint = async (
          state: string,
          background: string,
          expectedImage: string,
          position: string,
          opacity = '1'
        ) => {
          await expect
            .poll(paint, { message: `${key}/${variant}/${state}` })
            .toMatchObject({ ...fixedPaint, background, image: expectedImage, position, opacity });
          await expect.poll(identity).toBe(true);
          observations.push({
            key,
            variant,
            rootFont,
            state,
            source: 'twbs/bootstrap v2.3.2',
            paint: await paint(),
          });
          if (evidence) {
            await mkdir(evidence, { recursive: true });
            await host.locator('..').screenshot({
              path: path.join(
                evidence,
                `bootstrap-v2.3.2-${runtime}-root${rootFont}-${variant}-${state}.png`
              ),
            });
          }
        };
        await assertPaint('rest', rgb(base), image, '0px 0px');
        expect((await paint()).shadow).toContain('rgba(255, 255, 255, 0.2) 0px 1px 0px 0px inset');
        // Check every size remains available under every newly selected color.
        for (const [size, padding, fontSize, radius, height] of [
          ['large', '11px 19px', '17.5px', '6px', 44],
          ['mini', '0px 6px', '10.5px', '3px', 22],
          ['small', '2px 10px', '11.9px', '3px', 26],
          ['default', '4px 12px', '14px', '4px', 30],
        ] as const) {
          await page.evaluate(
            ({ key, size }) =>
              (window as any).projectionFamilyFixture.setProps(key, 'primary', { size }),
            { key, size }
          );
          await expect
            .poll(() =>
              control.evaluate((el) => {
                const css = getComputedStyle(el);
                return {
                  padding: css.padding,
                  fontSize: css.fontSize,
                  radius: css.borderRadius,
                  height: el.getBoundingClientRect().height,
                  lineHeight: css.lineHeight,
                  borderWidth: css.borderWidth,
                };
              })
            )
            .toEqual({ padding, fontSize, radius, height, lineHeight: '20px', borderWidth: '1px' });
          observations.push({
            key,
            variant,
            size,
            rootFont,
            source: 'twbs/bootstrap v2.3.2',
            metrics: await control.evaluate((el) => {
              const css = getComputedStyle(el);
              return {
                padding: css.padding,
                fontSize: css.fontSize,
                radius: css.borderRadius,
                height: el.getBoundingClientRect().height,
                lineHeight: css.lineHeight,
                borderWidth: css.borderWidth,
              };
            }),
          });
          await expect.poll(identity).toBe(true);
        }
        await previous.press('Tab');
        await expect.poll(() => control.evaluate((el) => el === document.activeElement)).toBe(true);
        await assertPaint('focused', rgb(end), image, '0px -15px');
        expect((await paint()).ring).toBe('2px');
        expect((await paint()).shadow).toContain('0px 0px 0px 4px');
        expect((await paint()).shadow).toContain('0px 0px 0px 2px');
        await previous.focus();
        await control.hover();
        await assertPaint('hovered', rgb(end), image, '0px -15px');
        await page.mouse.down();
        await assertPaint('pressed', rgb(end), 'none', '0px -15px');
        expect((await paint()).shadow).toContain('rgba(0, 0, 0, 0.15) 0px 2px 4px 0px inset');
        await page.mouse.up();
        await expect.poll(() => output.innerText()).toBe(`${++count} activations`);
        await control.press('Enter');
        await expect.poll(() => output.innerText()).toBe(`${++count} activations`);
        await control.press('Space');
        await expect.poll(() => output.innerText()).toBe(`${++count} activations`);
        // Disable from an active press: no click on release and no pressed shadow.
        await control.hover();
        await page.mouse.down();
        await page.evaluate(
          (key) =>
            (window as any).projectionFamilyFixture.setProps(key, 'primary', { disabled: true }),
          key
        );
        await expect.poll(() => control.getAttribute('aria-disabled')).toBe('true');
        await assertPaint('disabled', rgb(end), 'none', '0px 0px', '0.65');
        expect(isUnpaintedBootstrapBoxShadow((await paint()).shadow)).toBe(true);
        await page.mouse.up();
        await control.click({ force: true });
        await control.press('Enter');
        await control.press('Space');
        expect(await output.innerText()).toBe(`${count} activations`);
      }
      // Public patch API requires explicit restoration; raw removal is unit-only.
      await page.evaluate(
        (key) =>
          (window as any).projectionFamilyFixture.setProps(key, 'primary', {
            variant: 'default',
            size: 'default',
            disabled: false,
          }),
        key
      );
      await previous.focus();
      await page.mouse.move(0, 0);
      await expect.poll(paint).toMatchObject({
        background: rgb('#f5f5f5'),
        image: `linear-gradient(${rgb('#fff')}, ${rgb('#e6e6e6')})`,
        opacity: '1',
      });
      await expect.poll(identity).toBe(true);
      await original.dispose();
    },
    180000
  );

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
