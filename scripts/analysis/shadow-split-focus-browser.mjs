/** Focus outline regression; real native Tab, runtime/rule transitions and
 * Chromium forced-colors emulation. Run: node --import tsx scripts/analysis/shadow-split-focus-browser.mjs
 * Authority: C-HOST-SURFACE-PROJECTION-0001 C/D/E and existing outline-none
 * transparent surface recipe. Not a full high-contrast or screen-reader audit.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css.ts';

const tokens = [
  'inline-flex',
  'p-2',
  'outline-none',
  'ring-3',
  'data-[probe-active]:outline-none',
  'data-[probe-active]:ring-3',
];
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-split-focus-browser.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'FocusProbe',
  platform: 'browser',
  tsconfig: 'tsconfig.json',
});
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  for (const forcedColors of ['none', 'active']) {
    const page = await browser.newPage({ forcedColors });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addStyleTag({
        content:
          ':root { --pui-ring: rgb(80,80,80); --pui-background: white; }\n' +
          renderProtoStyleTokenCss(tokens),
      });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate((artifact) => {
        window.probe = FocusProbe.mount(artifact);
      }, renderProtoShadowSplitStyleArtifact(tokens));
      const settle = () => page.waitForTimeout(80);
      const call = async (key, method, value) => {
        await page.evaluate(({ key, method, value }) => window.probe.call(key, method, value), {
          key,
          method,
          value,
        });
        await settle();
      };
      const focus = async (key) => {
        await page.locator(`#before-${key}`).focus();
        await page.keyboard.press('Tab');
        await settle();
        assert.equal(
          await page
            .locator(`#${key}`)
            .evaluate((el) => document.activeElement === el && el.matches(':focus-visible')),
          true,
          `${key}/native focus target`
        );
      };
      const sample = (key) =>
        page.locator(`#${key}`).evaluate((el) => {
          const surface = el.shadowRoot?.querySelector('[part="surface"]') ?? el;
          const read = (node) => {
            const css = getComputedStyle(node);
            return {
              outline: css.outlineStyle,
              width: css.outlineWidth,
              color: css.outlineColor,
              shadow: css.boxShadow,
            };
          };
          return { host: read(el), surface: read(surface) };
        });
      const fallback = async (key) => {
        await focus(key);
        const { host } = await sample(key);
        assert.equal(host.outline, 'auto', `${forcedColors}/${key}/native fallback`);
        assert.notEqual(host.width, '0px');
        assert.notEqual(host.color, 'rgba(0, 0, 0, 0)');
      };
      const replaced = async (key) => {
        await focus(key);
        const { host, surface } = await sample(key);
        if (key.startsWith('split'))
          assert.equal(host.outline, 'none', `${forcedColors}/${key}/no duplicate`);
        assert.equal(surface.outline, 'solid');
        assert.equal(surface.width, '2px');
        if (forcedColors === 'none') {
          assert.equal(surface.color, 'rgba(0, 0, 0, 0)');
          assert.notEqual(surface.shadow, 'none', `${key}/custom ring remains`);
        } else {
          assert.equal(surface.shadow, 'none', 'UA disables shadows in forced colors');
          assert.notEqual(
            surface.color,
            'rgba(0, 0, 0, 0)',
            `${key}/single visible outline fallback`
          );
        }
        return surface;
      };
      for (const profile of ['light', 'split']) {
        for (const mode of ['plain', 'ring-only', 'descendant'])
          await fallback(`${profile}-${mode}`);
        assert.equal(
          await page.locator(`#${profile}-descendant`).evaluate((el) => {
            const child = el.querySelector('[data-probe-child]');
            const surface = child?.shadowRoot?.querySelector('[part="surface"]') ?? child;
            return surface && getComputedStyle(surface).outlineStyle;
          }),
          'solid',
          'descendant-only outline intent is actually rendered without suppressing its Root'
        );
        const key = `${profile}-patch`;
        await fallback(key);
        await call(key, 'patch');
        await replaced(key);
        await call(key, 'clear');
        await fallback(key);
        await call(key, 'patch');
        await call(key, 'present', false);
        await call(key, 'present', true);
        await replaced(key);
        await page.evaluate((key) => window.probe.remove(key), key);
        await settle();
        await page.evaluate((key) => window.probe.reconnect(key), key);
        await settle();
        await fallback(key); // Runtime patch belongs to the old instance only.
        await call(key, 'patch');
        await replaced(key);
        const rule = `${profile}-rule`;
        await fallback(rule);
        await call(rule, 'activate', true);
        await replaced(rule);
        await call(rule, 'activate', false);
        await fallback(rule);
        await call(rule, 'activate', true);
        await replaced(rule);
      }
      assert.deepEqual(
        await sample('light-rule').then((s) => s.surface),
        await sample('split-rule').then((s) => s.surface),
        'same surface outline and ring in both profiles'
      );
      assert.deepEqual(errors, []);
      console.log(
        `Focus outline ${forcedColors}: fallback, descendant, ring-only, patch/clear, view replay, reconnect, rule on/off passed`
      );
    } finally {
      await page.close();
    }
  }
  console.log(`Focus projection regression passed in Chrome ${browser.version()}`);
} finally {
  await browser.close();
}
