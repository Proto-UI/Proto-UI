/** Build public packages and apps-www generate:proto-ui-style first.
 * Reuses the S2 consumer composition in an empty browser document, without
 * Astro, Vite source aliases, website CSS/reset, or page sizing corrections.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const app = new URL('../../apps/www/', import.meta.url);
const bundle = await build({
  entryPoints: ['apps/www/src/components/PrototypePreviewer/shadow-split-s2.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S2Consumer',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
for (const part of ['button', 'switch', 'checkbox'])
  assert.ok(inputs.some((p) => p.includes(`prototypes/shadcn/dist/${part}/`)));
assert.ok(inputs.some((p) => p.endsWith('proto-ui-shadow-style.generated.js')));
assert.ok(!inputs.some((p) => /packages\/.+\/src\//.test(p)), 'no source aliases');
const { chromium } = createRequire(new URL('package.json', app))('playwright-core');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(`<section data-shadow-s2>
    ${['checked', 'disabled', 'move', 'disconnect', 'slot'].map((action) => `<button data-action="${action}">${action}</button>`).join('')}
    ${['light', 'split', 'mixed'].map((profile) => `<article data-s2-profile="${profile}"><div data-home><div data-settings>${['switch', 'checkbox', 'button', 'badge'].map((kind) => `<span data-mount="${kind}"></span>`).join('')}</div></div><div data-destination></div><output></output></article>`).join('')}
  </section>`);
  // Theme and document companion emitted by the actual CLI, not hand-authored
  // utility replacements. Only the visually-hidden consumer label needs CSS.
  for (const name of ['shadcn-theme.css', 'proto-ui-tokens.generated.css'])
    await page.addStyleTag({ content: await readFile(new URL(`src/styles/${name}`, app), 'utf8') });
  await page.addStyleTag({
    content:
      '.s2-sr {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;}',
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() =>
    S2Consumer.mountShadowSplitS2(document.querySelector('[data-shadow-s2]'))
  );
  await page.waitForSelector('[data-ready=true]');
  const settle = () => page.waitForTimeout(300);
  const sample = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-s2-profile]')).map((col) => {
        const host = (kind) => col.querySelector(`[data-s2-component="${kind}"]`);
        const rect = (kind) => host(kind).getBoundingClientRect();
        return {
          checked: host('switch').getAttribute('aria-checked'),
          size: [rect('switch').width, rect('switch').height],
          thumbX: rect('thumb').x - rect('switch').x,
          buttonHeight: rect('button').height,
          glyphs: Array.from(
            (host('indicator').shadowRoot ?? host('indicator')).querySelectorAll('path')
          ).map((p) => p.getAttribute('d')),
          generations: JSON.parse(col.dataset.generations),
          counts: [
            +col.dataset.buttonClicks,
            +col.dataset.switchChanges,
            +col.dataset.checkboxChanges,
          ],
        };
      })
    );
  await settle();
  for (const row of await sample()) {
    assert.deepEqual(row.size, [44, 24]);
    assert.equal(row.thumbX, 3);
    assert.equal(row.buttonHeight, 32);
  }
  for (const profile of ['light', 'split', 'mixed']) {
    for (const kind of ['button', 'switch', 'checkbox']) {
      await page.locator(`[data-s2-profile=${profile}] [data-s2-component=${kind}]`).click();
      await settle();
    }
  }
  for (const row of await sample()) {
    assert.deepEqual(row.counts, [1, 1, 1]);
    assert.equal(row.thumbX, 21);
    assert.equal(row.checked, 'true');
    assert.deepEqual(row.glyphs, ['m20 6-11 11-5-5']);
  }
  await page.locator('[data-action=move]').click();
  await settle();
  for (const row of await sample())
    assert.deepEqual(Object.values(row.generations), [1, 1, 1, 1, 1, 1]);
  const splitHosts = await page.locator('[data-s2-split]').elementHandles();
  await page.locator('[data-action=disconnect]').click();
  await settle();
  for (const el of splitHosts)
    assert.equal(await el.evaluate((el) => el.shadowRoot.childNodes.length), 0);
  await page.locator('[data-action=disconnect]').click();
  await settle();
  for (const row of await sample()) {
    assert.deepEqual(Object.values(row.generations), [2, 2, 2, 2, 2, 2]);
    assert.deepEqual(row.counts, [1, 1, 1]);
    assert.equal(row.thumbX, 21);
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      kind: 's2-public-dist-consumer',
      browser: browser.version(),
      profiles: ['light', 'split', 'mixed'],
      cliCompanion: true,
      sourceAliases: false,
      websiteReset: false,
      inputContextMoveReconnect: true,
    })
  );
} finally {
  await browser.close();
}
