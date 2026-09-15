/** I1 complete Tabs admission audit, NOT full S3 keyboard/layout conformance.
 * Prerequisites: build:packages and apps-www generate:proto-ui-style.
 * Run: node scripts/analysis/shadow-s3-admission-browser.mjs
 * D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 C/K and C-LIFECYCLE-0008 E/I/J.
 */
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
assert.ok(inputs.some((p) => p.includes('prototypes/base/dist/tabs/')));
assert.ok(inputs.some((p) => p.endsWith('proto-ui-shadow-style.generated.js')));
assert.ok(
  !inputs.some((p) => /packages\/.+\/src\//.test(p)),
  'public runtime must not resolve source aliases'
);
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
    process.env.CHROME_PATH ??
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const rows = [];
try {
  for (const mode of ['light', 'direct', 'root', 'list', 'trigger', 'content', 'full'])
    for (const keepMounted of [false, true]) {
      const page = await browser.newPage();
      const unexpected = [];
      page.on('pageerror', (e) => unexpected.push(e.message));
      try {
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.evaluate(
          async ({ mode, keepMounted }) => {
            window.audit = S3Audit.mount(mode, keepMounted);
            await window.audit.flush();
          },
          { mode, keepMounted }
        );
        await page.waitForTimeout(250);
        const initial = await page.evaluate(() => window.audit.sample());
        const row = { mode, keepMounted, initial };
        if (!initial.errors.length) {
          await page.locator('[data-s3=trigger-b]').click();
          await page.waitForTimeout(250);
          row.b = await page.evaluate(() => window.audit.sample());
          await page.locator('[data-s3=trigger-a]').click();
          await page.waitForTimeout(250);
          row.a = await page.evaluate(() => window.audit.sample());
        }
        row.cleanup = await page.evaluate(() => window.audit.dispose());
        rows.push(row);
        assert.deepEqual(unexpected, []);
      } finally {
        await page.close();
      }
    }
  // The full observation is printed before assertions to preserve unexpected gaps.
  console.log(
    JSON.stringify(
      {
        kind: 's3-admission-audit',
        browser: browser.version(),
        rows: process.env.PUI_S3_VERBOSE
          ? rows
          : rows.map((row) => ({
              mode: row.mode,
              keepMounted: row.keepMounted,
              errors: [...new Set(row.initial.errors)],
              splitSurfaces: row.initial.parts.filter((p) => p.surface).map((p) => p.key),
              panels: row.a?.parts
                .filter((p) => p.key.startsWith('content-'))
                .map((p) => ({
                  key: p.key,
                  setup: p.setup,
                  mounts: p.mounts,
                  unmounts: p.unmounts,
                  detached: p.detached,
                  display: p.display,
                })),
              changes: row.a?.changes,
              cleanup: row.cleanup,
            })),
      },
      null,
      2
    )
  );
  for (const row of rows) {
    assert.equal(row.cleanup.subscriptions, 0, `${row.mode}/cleanup subscribers`);
    assert.ok(
      row.cleanup.shadowChildren.every((n) => n === 0),
      `${row.mode}/cleanup shadow`
    );
    assert.ok(
      row.cleanup.disposed.every((n) => n === 1),
      `${row.mode}/one terminal disposal per instance`
    );
    assert.deepEqual(
      row.cleanup.errors,
      row.initial.errors,
      `${row.mode}/no new errors during updates or cleanup`
    );
    {
      assert.deepEqual(row.initial.errors, [], `${row.mode}/admission`);
      assert.deepEqual(row.a.errors, [], `${row.mode}/A-B-A`);
      assert.equal(row.a.changes, 2, `${row.mode}/notifications`);
      for (const [snapshot, current] of [
        [row.initial, 'a'],
        [row.b, 'b'],
        [row.a, 'a'],
      ]) {
        for (const value of ['a', 'b']) {
          const part = snapshot.parts.find((p) => p.key === `content-${value}`);
          assert.equal(part.detached, !row.keepMounted && value !== current);
          assert.equal(part.display === 'none', value !== current);
          assert.equal(part.pending, false);
          assert.equal(part.setup, 1);
        }
      }
      const a = row.a.parts.find((p) => p.key === 'content-a');
      assert.equal(a.mounts, row.keepMounted ? 1 : 2);
    }
  }
  const hiding = [];
  for (const split of [false, true])
    for (const mechanism of ['tree', 'state']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.evaluate(
          ({ split, mechanism }) => {
            window.probe = S3Audit.mountHidingProbe(split, mechanism);
          },
          { split, mechanism }
        );
        const cdp = await page.context().newCDPSession(page);
        const samples = [];
        for (const [hidden, present] of [
          [false, true],
          [true, true],
          [true, false],
          [false, false],
          [false, true],
        ]) {
          await page.evaluate((props) => window.probe.set(props), { hidden, present });
          await page.waitForTimeout(100);
          const sample = await page.evaluate(() => window.probe.sample());
          const ax = await cdp.send('Accessibility.getFullAXTree');
          sample.actionInAX = ax.nodes.some(
            (n) => !n.ignored && n.role?.value === 'button' && n.name?.value === 'Probe action'
          );
          samples.push(sample);
          assert.equal(
            sample.actionInAX,
            !hidden && present,
            JSON.stringify({ split, mechanism, hidden, present, samples, errors })
          );
          assert.equal(sample.setup, 1);
          assert.equal(sample.detached, !present);
        }
        assert.equal(samples[1].ariaHidden, 'true');
        assert.equal(samples[1].nativeHidden, mechanism === 'state');
        if (mechanism === 'tree')
          assert.equal(
            samples[1].height,
            samples[0].height,
            'semantic-only hiding leaves layout unchanged'
          );
        assert.equal(samples[2].display, 'none');
        assert.equal(samples[3].display, 'none');
        assert.equal(samples[4].height, samples[0].height);
        assert.equal(samples[4].mounts, 2);
        assert.equal(samples[4].unmounts, 1);
        hiding.push({ split, mechanism, samples });
        await page.evaluate(() => window.probe.dispose());
        await page.waitForTimeout(100);
        assert.deepEqual(errors, []);
        await cdp.detach();
      } finally {
        await page.close();
      }
    }
  console.log(JSON.stringify({ kind: 's3-hiding-axes-diagnostic', hiding }, null, 2));
  console.log(
    'I1 Tabs admission and hiding-axis assertions passed; full S3 acceptance remains separate.'
  );
} finally {
  await browser.close();
}
