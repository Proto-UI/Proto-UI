import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runS5Journey } from './shadow-s5-journey.mjs';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['apps/www/src/components/PrototypePreviewer/shadow-split-s5.ts'],
  nodePaths: [new URL('node_modules', app).pathname],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S5',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
assert.ok(inputs.some((p) => p.includes('prototypes/base/dist/input/')));
assert.ok(inputs.some((p) => p.includes('prototypes/shadcn/dist/textarea/')));
assert.ok(!inputs.some((p) => /packages\/.+\/src\//.test(p)));
const css = (
  await Promise.all(
    [
      'src/styles/shadcn-theme.css',
      'src/styles/proto-ui-tokens.generated.css',
      'src/components/PrototypePreviewer/shadow-split-s5.css',
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
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(
    '<section class="s5" data-shadow-s5 data-lang="en"><div data-s5-app></div></section>'
  );
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => {
    window.s5 = S5.mountShadowSplitS5(document.querySelector('[data-shadow-s5]'));
  });
  console.log(await runS5Journey(page));
  assert.deepEqual(errors, []);
  await page.evaluate(() => s5.dispose());
  console.log(`S5 public-dist/CLI native journey passed in Chrome ${browser.version()}`);
} finally {
  await browser.close();
}
