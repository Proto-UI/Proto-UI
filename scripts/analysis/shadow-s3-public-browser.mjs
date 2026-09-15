/** S3 native acceptance journey through public package exports.
 * Build packages + generate apps-www companion, then run with node.
 * Shares assertions with the real demo-matrix page test.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runS3Journey } from './shadow-s3-journey.mjs';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['apps/www/src/components/PrototypePreviewer/shadow-split-s3.ts'],
  nodePaths: [fileURLToPath(new URL('node_modules', app))],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S3',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
assert.ok(inputs.some((p) => p.includes('prototypes/shadcn/dist/tabs/')));
assert.ok(inputs.some((p) => p.endsWith('proto-ui-shadow-style.generated.js')));
assert.ok(!inputs.some((p) => /packages\/.+\/src\//.test(p)));
const css = (
  await Promise.all(
    [
      'src/styles/shadcn-theme.css',
      'src/styles/proto-ui-tokens.generated.css',
      'src/components/PrototypePreviewer/shadow-split-s3.css',
    ].map((path) => readFile(new URL(path, app), 'utf8'))
  )
).join('\n');
const { chromium } = createRequire(new URL('package.json', app))('playwright-core');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  for (const keepMounted of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'light',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.setContent(
        '<section class="s3" data-shadow-s3 data-lang="zh"><div data-s3-app></div></section>'
      );
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(() => {
        window.s3 = S3.mountShadowSplitS3(document.querySelector('[data-shadow-s3]'));
      });
      console.log(await runS3Journey(page, { keepMounted }));
      assert.deepEqual(errors, []);
      await page.evaluate(() => window.s3.dispose());
    } catch (error) {
      console.error('Page errors:', errors);
      console.error(
        await page
          .locator('[data-s3-component=list],[data-s3-component^=trigger]')
          .evaluateAll((els) =>
            els.map((el) => {
              const s = el.shadowRoot?.querySelector('[part="surface"]') ?? el;
              const h = getComputedStyle(el),
                c = getComputedStyle(s);
              return {
                profile: el.closest('[data-s3-profile]')?.getAttribute('data-s3-profile'),
                key: el.getAttribute('data-s3-component'),
                text: el.textContent,
                width: el.getBoundingClientRect().width,
                min: h.minWidth,
                basis: h.flexBasis,
                surfaceMin: c.minWidth,
                surfaceDisplay: c.display,
                grid: h.gridTemplateColumns,
              };
            })
          )
      );
      throw error;
    } finally {
      await page.close();
    }
  }
  console.log(`S3 public-dist/CLI journey passed in Chrome ${browser.version()}`);
} finally {
  await browser.close();
}
