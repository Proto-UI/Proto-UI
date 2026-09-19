/** Bounded private Checkbox Root input/reveal probe, not public Adapter conformance.
 * Run: node --import tsx scripts/analysis/shadow-split-input-browser.mjs */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { collectProtoStyleTokens } from '../../packages/cli/src/services/prototype-style-tokens.ts';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css.ts';

const tokens = await collectProtoStyleTokens('packages/prototypes/shadcn/src/checkbox');
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-split-input-browser.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'InputProbe',
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
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const reveal = await page.evaluate(
    async ({ artifact, css }) => {
      window.pilotProbe = await InputProbe.setup(artifact, css);
      return { frame: pilotProbe.firstFrame, commits: pilotProbe.commits };
    },
    { artifact: renderProtoShadowSplitStyleArtifact(tokens), css: renderProtoStyleTokenCss(tokens) }
  );
  assert.equal(reveal.frame.innerHeight, 16);
  assert.equal(reveal.frame.role, 'checkbox');
  assert.ok(
    reveal.commits.length > 0 &&
      reveal.commits.every((entry) => entry.marker === 'light' && entry.style && entry.surface)
  );
  const samples = {};
  for (const kind of ['collapsed', 'split']) {
    const read = () => page.evaluate((kind) => pilotProbe.read(kind), kind);
    const phases = (samples[kind] = {});
    await page.locator(`#before-${kind}`).focus();
    await page.keyboard.press('Tab');
    phases.focus = await read();
    assert.equal(phases.focus.focused, true, `${kind} host focus`);
    assert.equal(phases.focus.focusVisible, true);
    await page.keyboard.press('Space');
    phases.space = await read();
    assert.equal(phases.space.checked, 'true');
    assert.equal(phases.space.events, 1);
    await page.keyboard.press('Enter');
    phases.enter = await read();
    assert.equal(phases.enter.events, 1);
    await page.locator(`#${kind}`).click();
    phases.pointer = await read();
    assert.equal(phases.pointer.checked, 'false');
    assert.equal(phases.pointer.events, 2);
    await page.evaluate((kind) => pilotProbe.disable(kind), kind);
    await page.keyboard.press('Space');
    await page.locator(`#${kind}`).click({ force: true });
    phases.disabled = await read();
    assert.equal(phases.disabled.disabled, 'true');
    assert.equal(phases.disabled.events, 2);
    assert.equal(phases.disabled.opacity, '0.5');
  }
  assert.deepEqual(samples.split, samples.collapsed);
  // Browser accessibility tree observation supplements host ARIA checks, not a screen-reader claim.
  const ax = await page.locator('#split').ariaSnapshot();
  assert.match(ax, /checkbox "Accept terms"/);
  const lifecycle = await page.evaluate(() => pilotProbe.lifecycleAndSlot());
  await page.locator('#split').click();
  const renewed = await page.evaluate(() => pilotProbe.read('split'));
  assert.equal(renewed.checked, 'true');
  assert.equal(renewed.events, 3);
  const customization = await page.evaluate(() => pilotProbe.customizationProbe());
  assert.equal(customization.classDelivered, true);
  assert.deepEqual(customization.classOnly, customization.before);
  assert.equal(customization.paint.background, 'rgb(200, 0, 200)');
  assert.equal(customization.paint.innerHeight, customization.before.innerHeight);
  // Deliberately record the uncataloged raw-CSS metric gap; do not bless it as parity.
  assert.notEqual(customization.metric.innerHeight, customization.metric.height);
  assert.deepEqual(customization.restored, customization.before);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        kind: 'private-shadow-input-evidence',
        browser: browser.version(),
        reveal,
        samples,
        ax,
        lifecycle,
        renewed,
        customization,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
