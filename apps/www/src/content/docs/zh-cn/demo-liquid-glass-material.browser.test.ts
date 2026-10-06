// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchBrowser, startServer, stopServer, RUNTIMES } from './browser-harness';

const ROUTE = '/en/test/liquid-glass-material/';
const evidence = process.env.PROTO_UI_MATERIAL_EVIDENCE_DIR;
let browser: Browser;
let context: BrowserContext;
let page: Page;
let cdp: CDPSession;
let baseUrl = '';
const observations: unknown[] = [];
const safe = {
  'prefers-reduced-motion': 'no-preference',
  'prefers-reduced-transparency': 'no-preference',
  'prefers-contrast': 'no-preference',
  'forced-colors': 'none',
};
async function preference(theme: string, overrides: Record<string, string> = {}) {
  await cdp.send('Emulation.setEmulatedMedia', {
    features: Object.entries({ ...safe, 'prefers-color-scheme': theme, ...overrides }).map(
      ([name, value]) => ({ name, value })
    ),
  });
}
async function capture(name: string) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
}
async function waitForBlur(blur: string) {
  await page.waitForFunction(
    (expected) => {
      const hosts = Array.from(document.querySelectorAll('[data-material-host]'));
      return (
        hosts.length === 4 &&
        hosts.every((host) => {
          const button = Array.from(host.querySelectorAll('[role="button"],button')).find(
            (el) => el.textContent === 'Regular action'
          );
          return button && getComputedStyle(button).backdropFilter === expected;
        })
      );
    },
    blur,
    { timeout: 10000 }
  );
}
beforeAll(async () => {
  baseUrl = await startServer(ROUTE);
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
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
          runtimes: RUNTIMES,
          scope:
            'Regular functional Button: 80% source color + 4px backdrop blur, live preference fallback. No refraction, native Apple engine, Compiler or non-Web claim.',
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

describe.sequential('Liquid Glass bounded material on real Web hosts', () => {
  for (const theme of ['light', 'dark'] as const)
    it(`${theme}: real blur, opt-out, and live safe fallback`, async () => {
      await preference(theme);
      await page.goto(`${baseUrl}${ROUTE}?theme=${theme}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.materialReady, undefined, {
        timeout: 60000,
      });
      expect(await page.locator('html').getAttribute('data-material-error')).toBeNull();
      await page.mouse.move(0, 0);
      await waitForBlur('blur(4px)');
      await capture(`material-${theme}`);
      for (const runtime of RUNTIMES) {
        const host = page.locator(`[data-material-host="${runtime}"]`);
        const regular = host.getByRole('button', { name: 'Regular action', exact: true });
        const facts = await regular.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            background: style.backgroundColor,
            secondary: style.getPropertyValue('--pui-secondary').trim(),
            blur: style.backdropFilter,
            animation: style.animationName,
            transition: style.transitionDuration,
            tokens: el.getAttribute('data-pui-style'),
            alphaSyntax: CSS.supports(
              'background-color',
              'color-mix(in oklab, var(--pui-secondary) 80%, transparent)'
            ),
            backdropSyntax: CSS.supports('backdrop-filter', 'blur(4px)'),
          };
        });
        expect(facts.background).toMatch(/(?:\/\s*0\.8\s*\)|,\s*0\.8\s*\))/);
        expect(facts.blur).toBe('blur(4px)');
        expect(facts.secondary).toBe(theme === 'light' ? '#ffffff' : '#2c2c2e');
        expect(facts.animation).toBe('none');
        expect(facts.transition).toBe('0s');
        expect(facts.alphaSyntax && facts.backdropSyntax).toBe(true);
        expect(
          await host
            .getByRole('button', { name: 'Opaque action', exact: true })
            .evaluate((el) => getComputedStyle(el).backdropFilter)
        ).toBe('none');
        expect(
          await host
            .getByRole('button', { name: 'Accent', exact: true })
            .evaluate((el) => getComputedStyle(el).backdropFilter)
        ).toBe('none');

        // Same physical control and backdrop, remove only blur for a negative
        // control. Decode actual screenshots and compare pixels, not PNG metadata.
        const withBlur = await regular.screenshot();
        const original = await regular.getAttribute('data-pui-style');
        expect(original).toContain('backdrop-blur-xs');
        await regular.evaluate((el) =>
          el.setAttribute(
            'data-pui-style',
            (el.getAttribute('data-pui-style') ?? '')
              .split(/\s+/)
              .filter((token) => token !== 'backdrop-blur-xs')
              .join(' ')
          )
        );
        expect(await regular.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');
        const withoutBlur = await regular.screenshot();
        await regular.evaluate(
          (el, tokens) => el.setAttribute('data-pui-style', tokens!),
          original
        );
        const changedPixels = await page.evaluate(
          async ({ first, second }) => {
            async function pixels(base64: string) {
              const image = new Image();
              image.src = `data:image/png;base64,${base64}`;
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = image.naturalWidth;
              canvas.height = image.naturalHeight;
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(image, 0, 0);
              return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            }
            const a = await pixels(first),
              b = await pixels(second);
            let changed = 0;
            if (a.length !== b.length) throw new Error('negative-control dimensions changed');
            for (let i = 0; i < a.length; i += 4)
              if (
                Math.abs(a[i] - b[i]) +
                  Math.abs(a[i + 1] - b[i + 1]) +
                  Math.abs(a[i + 2] - b[i + 2]) >
                3
              )
                changed++;
            return changed;
          },
          { first: withBlur.toString('base64'), second: withoutBlur.toString('base64') }
        );
        expect(changedPixels).toBeGreaterThan(20);
        if (evidence) {
          await writeFile(path.join(evidence, `${theme}-${runtime}-blur.png`), withBlur);
          await writeFile(
            path.join(evidence, `${theme}-${runtime}-negative-no-blur.png`),
            withoutBlur
          );
        }
        observations.push({ theme, runtime, facts, negativeControlChangedPixels: changedPixels });
        await regular.hover();
        expect(await regular.evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(
          /(?:\/\s*0\.8\s*\)|,\s*0\.8\s*\))/
        );
        expect(await regular.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe(
          'blur(4px)'
        );
        await page.mouse.move(0, 0);
      }

      // The support fact is not proof that a consumer installed CSS. Remove
      // this fixture's generated sheet and verify the paint claim stops holding.
      await page.locator('style[data-draft-projection-css]').evaluate((el) => {
        (el as HTMLStyleElement).sheet!.disabled = true;
      });
      await waitForBlur('none');
      await page.locator('style[data-draft-projection-css]').evaluate((el) => {
        (el as HTMLStyleElement).sheet!.disabled = false;
      });
      await waitForBlur('blur(4px)');
      observations.push({
        theme,
        missingStylesheetNegativeControl: 'paint absent until source CSS restored',
      });

      for (const [key, value] of [
        ['prefers-reduced-transparency', 'reduce'],
        ['prefers-reduced-motion', 'reduce'],
        ['prefers-contrast', 'more'],
        ['forced-colors', 'active'],
      ] as const) {
        const handles = await Promise.all(
          RUNTIMES.map((runtime) =>
            page
              .locator(`[data-material-host="${runtime}"]`)
              .getByRole('button', { name: 'Regular action', exact: true })
              .elementHandle()
          )
        );
        await preference(theme, { [key]: value });
        await waitForBlur('none');
        for (const handle of handles) {
          expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);
          expect(await handle!.evaluate((el) => el.getAttribute('data-pui-style'))).not.toContain(
            'bg-secondary/80'
          );
        }
        await capture(`${theme}-${key}-${value}`);
        await preference(theme);
        await waitForBlur('blur(4px)');
        for (const handle of handles)
          expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);
        observations.push({
          theme,
          preference: key,
          value,
          fallback: 'opaque',
          restored: true,
          sameHosts: true,
        });
      }
      for (const runtime of RUNTIMES) {
        const regular = page
          .locator(`[data-material-host="${runtime}"]`)
          .getByRole('button', { name: 'Regular action', exact: true });
        await regular.click();
        await regular.focus();
        await page.keyboard.press('Space');
        await expect
          .poll(() => page.locator(`[data-activations="${runtime}"]`).textContent())
          .toBe('2 activations');
      }
      await page.mouse.move(0, 0);
      await capture(`${theme}-restored-interaction`);
    }, 120000);

  it('paints the actual opaque control when the browser preference API is unavailable', async () => {
    await preference('light');
    await page.goto(`${baseUrl}${ROUTE}?unknown=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.materialReady);
    await waitForBlur('none');
    for (const runtime of RUNTIMES) {
      const button = page
        .locator(`[data-material-host="${runtime}"]`)
        .getByRole('button', { name: 'Regular action', exact: true });
      const facts = await button.evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        tokens: el.getAttribute('data-pui-style'),
      }));
      expect(facts.background).toBe('rgb(255, 255, 255)');
      expect(facts.tokens).not.toContain('backdrop-blur-xs');
      observations.push({ runtime, unavailablePreferenceApi: true, facts });
    }
    await capture('unknown-preference-api-opaque');
  }, 60000);

  it('registers both libraries and bilingual Button pages with operable four-runtime demos', async () => {
    await preference('light');
    await page.setViewportSize({ width: 1440, height: 1050 });
    const labels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' };
    for (const locale of ['en', 'zh-cn']) {
      await page.goto(`${baseUrl}/${locale}/ui-libraries/`, { waitUntil: 'networkidle' });
      // Pick before lazy cards mount: they must read the current preference,
      // not silently instantiate WC and require a later correction.
      const galleryPicker = page.locator('[data-adapter-select-root]').first();
      await galleryPicker.getByRole('combobox').click();
      await page.getByRole('option', { name: 'React', exact: true }).last().click();
      for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
        const card = page.locator(`.library-card--${family}`);
        const button = card.getByRole('button', { name: 'Back', exact: true });
        // The SSR card exists before its lazy Prototype is mounted. Scrolling a
        // not-yet-created Button would wait forever without waking the observer.
        await card.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            card.locator('[data-projection-scope]').getAttribute('data-projection-runtime')
          )
          .toBe('react');
        expect(
          await button.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const hit = document.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2
            );
            return !!hit && (hit === element || element.contains(hit));
          })
        ).toBe(true);
        const galleryUrl = page.url();
        await button.click();
        await expect.poll(() => card.getByRole('status').textContent()).toBe('1 activations');
        await button.focus();
        await page.keyboard.press('Space');
        await expect.poll(() => card.getByRole('status').textContent()).toBe('2 activations');
        expect(page.url()).toBe(galleryUrl);
        expect(await card.locator(`a[href="./${family}/"]`).count()).toBe(1);
      }
      // Both mounted cards follow the same page event on an actual control change.
      await galleryPicker.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Vue 2', exact: true }).last().click();
      for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
        const card = page.locator(`.library-card--${family}`);
        await expect
          .poll(() =>
            card.locator('[data-projection-scope]').getAttribute('data-projection-runtime')
          )
          .toBe('vue2');
        await card.getByRole('button', { name: 'Back', exact: true }).click();
        await expect.poll(() => card.getByRole('status').textContent()).toBe('1 activations');
      }
      await capture(`library-${locale}`);
      for (const family of ['bootstrap-2-3-2', 'liquid-glass']) {
        await page.goto(`${baseUrl}/${locale}/ui-libraries/${family}/`, {
          waitUntil: 'networkidle',
        });
        await page.locator('a[href="./button/"]').click();
        await page.waitForURL(`**/${locale}/ui-libraries/${family}/button/`);
        for (const runtime of RUNTIMES) {
          const picker = page.locator('[data-adapter-select-root]').first();
          await picker.getByRole('combobox').click();
          await page.getByRole('option', { name: labels[runtime], exact: true }).last().click();
          // Bootstrap uses one preview following the actual page runtime control;
          // Liquid still has the existing fixed-runtime adapter panels.
          const panel =
            family === 'bootstrap-2-3-2'
              ? page.locator('[data-demo-id="demo-bootstrap-2-3-2-button"]')
              : page.locator(`[data-adapter-panel="${runtime}"]`);
          if (family === 'bootstrap-2-3-2') expect(await panel.count()).toBe(1);
          await expect.poll(() => panel.isVisible()).toBe(true);
          await expect
            .poll(() =>
              panel.locator('[data-projection-scope]').getAttribute('data-projection-runtime')
            )
            .toBe(runtime);
          const button = panel.getByRole('button', { name: 'Back', exact: true });
          await button.click();
          await expect.poll(() => panel.getByRole('status').textContent()).toBe('1 activations');
          expect(
            await panel
              .getByRole('button', { name: 'Unavailable', exact: true })
              .getAttribute('aria-disabled')
          ).toBe('true');
          observations.push({
            locale,
            family,
            runtime,
            libraryAndDocsDemo: 'operable',
            url: page.url(),
          });
        }
        await capture(`docs-${locale}-${family}`);
      }
    }
  }, 180000);

  it('keeps the functional layer within mobile width and disposes all real controls', async () => {
    await preference('light');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.materialReady);
    await waitForBlur('blur(4px)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await capture('material-mobile');
    expect(await page.locator('[data-material-host]').getByRole('button').count()).toBe(12);
    await page.evaluate(async () => {
      await (window as any).liquidMaterialFixture.dispose();
    });
    expect(await page.locator('[data-material-host]').getByRole('button').count()).toBe(0);
  }, 60000);
});
