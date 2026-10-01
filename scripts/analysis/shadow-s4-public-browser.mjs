import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runS4Journey } from './shadow-s4-journey.mjs';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['apps/www/src/components/PrototypePreviewer/shadow-split-s4.ts'],
  nodePaths: [new URL('node_modules', app).pathname],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S4',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
assert.ok(inputs.some((p) => p.includes('prototypes/shadcn/dist/dialog/')));
assert.ok(!inputs.some((p) => /packages\/.+\/src\//.test(p)));
const css = (
  await Promise.all(
    [
      'src/styles/shadcn-theme.css',
      'src/styles/proto-ui-tokens.generated.css',
      'src/components/PrototypePreviewer/shadow-split-s3.css',
      'src/components/PrototypePreviewer/shadow-split-s4.css',
    ].map((p) => readFile(new URL(p, app), 'utf8'))
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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(
    '<section class="s4" data-shadow-s4 data-lang="en"><div data-s4-app></div></section>'
  );
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => {
    window.s4 = S4.mountShadowSplitS4(document.querySelector('[data-shadow-s4]'));
  });
  try {
    console.log(await runS4Journey(page));
    assert.deepEqual(errors, []);
    await page.evaluate(() => s4.dispose());
    console.log(`S4 complete Dialog journey passed in Chrome ${browser.version()}`);
  } catch (error) {
    console.error('Page errors', errors);
    console.error(
      await page.evaluate(() => ({
        active: document.activeElement?.outerHTML.slice(0, 700),
        cards: [...document.querySelectorAll('[data-s4-card]')].map((e) => e.dataset),
      }))
    );
    throw error;
  }
} finally {
  await browser.close();
}
