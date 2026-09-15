/** J1 native controlled Tabs regression. Build public packages and generate website companion first. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-s3/admission.ts'],
  nodePaths: [fileURLToPath(new URL('node_modules', app))],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S3Audit',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
assert.ok(inputs.some((p) => p.includes('prototypes/shadcn/dist/tabs/')));
assert.ok(!inputs.some((p) => /packages\/.+\/src\//.test(p)));
const css = (
  await Promise.all(
    ['shadcn-theme.css', 'proto-ui-tokens.generated.css'].map((name) =>
      readFile(new URL(`src/styles/${name}`, app), 'utf8')
    )
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
  const results = [];
  for (const mode of ['light', 'full'])
    for (const keepMounted of [false, true])
      for (const echo of ['none', 'sync', 'microtask']) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        try {
          await page.addStyleTag({ content: css });
          await page.addScriptTag({ content: bundle.outputFiles[0].text });
          await page.evaluate(
            ({ mode, keepMounted, echo }) => {
              window.audit = S3Audit.mount(mode, keepMounted, echo);
            },
            { mode, keepMounted, echo }
          );
          await page.waitForTimeout(200);
          const stages = [];
          await page.locator('[data-s3=trigger-a]').focus();
          for (const value of ['b', 'a']) {
            await page.keyboard.press(value === 'b' ? 'ArrowRight' : 'ArrowLeft');
            await page.waitForTimeout(250);
            const sample = await page.evaluate(() => window.audit.sample());
            stages.push({
              requested: value,
              rootValue: sample.rootValue,
              changes: sample.changes,
              selected: sample.parts.filter((p) => p.selected === 'true').map((p) => p.key),
              visible: sample.parts
                .filter((p) => p.key.startsWith('content') && p.display !== 'none')
                .map((p) => p.key),
            });
            assert.deepEqual(sample.errors, []);
          }
          const cleanup = await page.evaluate(() => window.audit.dispose());
          assert.deepEqual(errors, []);
          assert.equal(cleanup.subscriptions, 0);
          results.push({ mode, keepMounted, echo, stages });
        } finally {
          await page.close();
        }
      }
  console.log(JSON.stringify({ browser: browser.version(), results }, null, 2));
  for (const row of results)
    for (const stage of row.stages) {
      assert.equal(stage.rootValue, stage.requested);
      assert.deepEqual(stage.selected, [`trigger-${stage.requested}`]);
      assert.deepEqual(stage.visible, [`content-${stage.requested}`]);
      assert.equal(stage.changes, stage.requested === 'b' ? 1 : 2);
    }
  console.log('J1 controlled native keyboard regression passed in all 12 combinations.');
} finally {
  await browser.close();
}
