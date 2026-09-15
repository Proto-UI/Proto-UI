/** Same-document portal owner teardown, including failed Content admission.
 * A-WEB-COMPONENT G/I; C-AS-OVERLAY E/F/K; no cross-instance rollback claim.
 * Build public packages + www CLI companion first.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-s4/dialog.ts'],
  nodePaths: [new URL('node_modules', app).pathname],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S4',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
assert.ok(!Object.keys(bundle.metafile.inputs).some((p) => /packages\/.+\/src\//.test(p)));
const css = (
  await Promise.all(
    ['shadcn-theme.css', 'proto-ui-tokens.generated.css'].map((n) =>
      readFile(new URL(`src/styles/${n}`, app), 'utf8')
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
  for (const mode of ['light', 'split', 'mixed', 'rejected']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(
        (mode) =>
          (window.audit = S4.mount(mode === 'rejected' ? 'split' : mode, mode === 'rejected')),
        mode
      );
      await page.locator('[data-part=trigger]').click();
      await page.waitForTimeout(300);
      if (mode === 'rejected') {
        assert.equal(errors.length, 1);
        assert.match(errors[0], /K1 physical recipe is absent/);
        assert.equal(
          await page.evaluate(() => audit.parts.content.hasAttribute('data-pui-split-root-style')),
          false
        );
        // Parent remains the owner's open fact. Explicit owner close must
        // release the still-valid Mask; this is not automatic logical rollback.
        await page.evaluate(() => audit.setOpen(false));
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      } else {
        assert.deepEqual(errors, []);
        const before = await page.evaluate(() =>
          JSON.stringify(
            Object.fromEntries(
              Object.entries(audit.lifecycle).map(([k, v]) => [
                k,
                v.filter((e) =>
                  [
                    'instance.setup.exit',
                    'mount.mounted',
                    'unmount.done',
                    'instance.dispose.done',
                  ].includes(e)
                ),
              ])
            )
          )
        );
        await page.evaluate(() => {
          const destination = document.createElement('div');
          audit.wrapper.append(destination);
          destination.append(audit.parts.root);
        });
        await page.waitForTimeout(30);
        assert.equal(
          await page.evaluate(() =>
            JSON.stringify(
              Object.fromEntries(
                Object.entries(audit.lifecycle).map(([k, v]) => [
                  k,
                  v.filter((e) =>
                    [
                      'instance.setup.exit',
                      'mount.mounted',
                      'unmount.done',
                      'instance.dispose.done',
                    ].includes(e)
                  ),
                ])
              )
            )
          ),
          before,
          'synchronous move preserves generations'
        );
        assert.equal(
          await page.evaluate(() => audit.parts.content.parentElement === document.body),
          true
        );
      }
      await page.evaluate(() => audit.parts.root.remove());
      await page.waitForTimeout(100);
      const removed = await page.evaluate(() => ({
        overflow: document.body.style.overflow,
        connected: Object.values(audit.parts).map((el) => el.isConnected),
        shadowChildren: Object.values(audit.parts).map(
          (el) => el.shadowRoot?.childNodes.length ?? 0
        ),
        disposed: Object.fromEntries(
          Object.entries(audit.lifecycle).map(([k, v]) => [
            k,
            v.filter((e) => e === 'instance.dispose.done').length,
          ])
        ),
      }));
      assert.equal(removed.overflow, '');
      assert.ok(removed.connected.every((c) => !c));
      assert.ok(removed.shadowChildren.every((n) => n === 0));
      if (mode !== 'rejected') {
        assert.ok(Object.values(removed.disposed).every((n) => n === 1));
        await page.evaluate(() => {
          audit.setOpen(true);
          audit.wrapper.append(audit.parts.root);
        });
        await page.waitForTimeout(300);
        assert.equal(
          await page.evaluate(() => audit.parts.content.parentElement === document.body),
          true
        );
        await page.evaluate(() => audit.wrapper.remove());
        await page.waitForTimeout(100);
        const reconnected = await page.evaluate(() => ({
          overflow: document.body.style.overflow,
          counts: Object.values(audit.lifecycle).map(
            (v) => v.filter((e) => e === 'instance.dispose.done').length
          ),
        }));
        assert.equal(reconnected.overflow, '');
        assert.ok(reconnected.counts.every((n) => n === 2));
        assert.deepEqual(errors, []);
      }
      console.log({ mode, removed });
    } finally {
      await page.close();
    }
  }
  console.log(`S4 portal owner cleanup passed in Chrome ${browser.version()}`);
} finally {
  await browser.close();
}
