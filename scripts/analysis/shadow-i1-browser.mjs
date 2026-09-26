/** I1 scoped geometry/hiding diagnostics, not complete Tabs or arbitrary CSS support.
 * Run after build:packages: node --import tsx scripts/analysis/shadow-i1-browser.mjs
 * Public dist runtime; source-generated recipe. Real CLI companion has the separate S3 audit.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { collectProtoStyleTokens } from '../../packages/cli/src/services/prototype-style-tokens.ts';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css.ts';
const tokens = await collectProtoStyleTokens('scripts/analysis/fixtures/shadow-s3');
const artifact = renderProtoShadowSplitStyleArtifact(tokens);
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-s3/i1.ts'],
  nodePaths: [fileURLToPath(new URL('../../apps/www/node_modules', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'I1',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
assert.ok(
  Object.keys(bundle.metafile.inputs).some((p) => p.includes('adapters/web-component/dist/'))
);
assert.ok(!Object.keys(bundle.metafile.inputs).some((p) => /packages\/.+\/src\//.test(p)));
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const evidence = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addStyleTag({ content: renderProtoStyleTokenCss(tokens) });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate((artifact) => {
    window.probe = I1.mount(artifact);
  }, artifact);
  const cdp = await page.context().newCDPSession(page);
  const capture = async (phase, hidden, present = true) => {
    await page.waitForTimeout(120);
    await page.evaluate(() => window.probe.decorateOwnedProbe());
    const rows = await page.evaluate(() => window.probe.sample());
    assert.deepEqual(errors, []);
    const [light, split] = rows;
    const keys = hidden || !present ? ['width', 'height', 'peerX'] : Object.keys(light.geometry);
    for (const key of keys)
      assert.ok(
        Math.abs(light.geometry[key] - split.geometry[key]) < 0.08,
        `${phase}/${key}: ${JSON.stringify(rows)}`
      );
    const ax = await cdp.send('Accessibility.getFullAXTree');
    for (const [i, row] of rows.entries()) {
      assert.equal(row.display === 'none', hidden || !present, `${phase}/display`);
      assert.equal(row.detached, !present);
      if (hidden || !present) {
        assert.equal(row.geometry.width, 0);
        assert.equal(row.geometry.height, 0);
        assert.equal(row.geometry.peerX, 0);
      } else {
        assert.equal(row.geometry.buttonX, 33);
        assert.equal(row.geometry.buttonY, 6);
        assert.equal(row.geometry.ownedX, 118);
        assert.equal(row.geometry.ownedY, 54);
      }
      assert.equal(row.nativeHidden, false);
      assert.equal(row.ariaHidden, null);
      assert.equal(row.slotOwned, true);
      assert.equal(row.counts.setup, 1);
      assert.equal(
        ax.nodes.some(
          (n) =>
            !n.ignored && n.name?.value === `I1 action ${Boolean(i)}` && n.role?.value === 'button'
        ),
        !hidden && present,
        `${phase}/AX`
      );
      await page.locator(`#before-${Boolean(i)}`).focus();
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        hidden || !present ? `After ${Boolean(i)}` : `I1 action ${Boolean(i)}`,
        `${phase}/native Tab`
      );
    }
    if (present) {
      assert.equal(split.surfacePosition, 'static');
      assert.equal(split.position, 'relative');
      assert.equal(split.z, '50');
    }
    evidence.push({ phase, rows });
    return rows;
  };
  const initial = await capture('initial', false);
  for (const split of [false, true])
    await page.getByRole('button', { name: `I1 action ${split}`, exact: true }).click();
  await page.evaluate(() => window.probe.set({ offset: true }));
  const offset = await capture('offset', false);
  assert.equal(offset[0].geometry.x - initial[0].geometry.x, 8);
  assert.equal(offset[0].geometry.y - initial[0].geometry.y, 4);
  assert.equal(offset[0].geometry.peerX, initial[0].geometry.peerX);
  await page.evaluate(() => window.probe.set({ hide: true }));
  await capture('rule-hide', true);
  // Click at the former native button positions; hidden descendants cannot receive it.
  for (const split of [false, true]) {
    const before = await page.locator(`#before-${split}`).boundingBox();
    const row = await page.locator(`#i1-${split}`).evaluate((el) => {
      const r = el.parentElement.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    assert.ok(before);
    await page.mouse.click(row.x + 48, row.y + 28);
  }
  assert.deepEqual(
    (await page.evaluate(() => window.probe.sample())).map((r) => r.counts.click),
    [1, 1]
  );
  await page.evaluate(() => window.probe.set({ hide: false, offset: false }));
  await capture('rule-restore', false);
  await page.evaluate(() => window.probe.set({ patch: true }));
  await capture('patch-hide', true);
  await page.evaluate(() => window.probe.set({ present: false }));
  await capture('detach-hidden', true, false);
  await page.evaluate(() => window.probe.set({ patch: false }));
  await capture('detached-clear', false, false);
  await page.evaluate(() => window.probe.set({ present: true }));
  await capture('replay-visible', false);
  await page.evaluate(() => window.probe.move());
  await capture('sync-move', false);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await capture('dark-hide', true);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const final = await capture('light-restore', false);
  assert.deepEqual(
    final.map((r) => r.counts),
    [
      { setup: 1, mount: 2, unmount: 1, click: 1 },
      { setup: 1, mount: 2, unmount: 1, click: 1 },
    ]
  );
  await page.evaluate(() => window.probe.dispose());
  await cdp.detach();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      browser: browser.version(),
      phases: evidence.map((e) => e.phase),
      result: 'I1 scoped geometry, AX, native Tab/hit and replay passed',
    })
  );
} finally {
  await browser.close();
}
