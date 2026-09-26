/** H1 source-generated recipe + real public dist Adapter/prototypes in Chrome.
 * Run after build:packages: node --import tsx scripts/analysis/shadow-s2-motion-browser.mjs
 * D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 M/N/O; P-SHADCN Button/Switch/Thumb.
 * Companion/package-only admission has a separate shadow-s2-admission-browser check.
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
const app = fileURLToPath(new URL('../../apps/www/', import.meta.url));
const tokens = [
  ...new Set([
    ...(await collectProtoStyleTokens('packages/prototypes/shadcn/src/button')),
    ...(await collectProtoStyleTokens('packages/prototypes/shadcn/src/switch')),
    ...(await collectProtoStyleTokens('scripts/analysis/fixtures/shadow-s2')),
  ]),
].sort();
const artifact = renderProtoShadowSplitStyleArtifact(tokens);
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-s2/motion.ts'],
  nodePaths: [`${app}node_modules`],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'S2Motion',
  metafile: true,
  tsconfigRaw: { compilerOptions: {} },
});
const inputs = Object.keys(bundle.metafile.inputs);
assert.ok(inputs.some((p) => p.includes('adapters/web-component/dist/')));
assert.ok(
  !inputs.some((p) => /packages\/.+\/src\//.test(p)),
  'no source aliases for public runtime'
);
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
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(({ artifact, css }) => S2Motion.mount(artifact, css), {
    artifact,
    css: renderProtoStyleTokenCss(tokens),
  });
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
  const samples = [];
  const capture = async (phase) => {
    const rows = await page.evaluate(() => S2Motion.sample());
    samples.push({ phase, rows });
    for (let i = 0; i < rows.length; i += 2) {
      const light = rows[i],
        split = rows[i + 1];
      for (const key of Object.keys(light.geometry))
        assert.ok(
          Math.abs(light.geometry[key] - split.geometry[key]) < 0.08,
          `${phase}/${light.kind}/${key}: ${light.geometry[key]} vs ${split.geometry[key]}`
        );
      assert.deepEqual(split.paint, light.paint, `${phase}/${light.kind}/paint`);
      assert.equal(split.checked, light.checked);
      assert.equal(split.retainedText, true);
      assert.equal(split.surfaceTransform, 'none', `${phase}/${light.kind}/no duplicate transform`);
      if (split.kind === 'switch') {
        assert.equal(split.thumbSurfaceTransform, 'none');
        assert.equal(split.willChange, 'transform');
        assert.equal(split.duration, '0.2s');
      }
    }
  };
  const frames = async (phase, n) => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await capture(`${phase}-${i}`);
    }
  };
  await frames('initial', 2);
  await page.evaluate(() => S2Motion.change('switch', { checked: true }));
  await frames('check', 5);
  await page.evaluate(() => S2Motion.change('switch', { checked: false }));
  await frames('reverse', 18);
  await page.evaluate(() => S2Motion.change('sizing', { large: true }));
  await frames('size-grow', 5);
  await page.evaluate(() => S2Motion.change('sizing', { large: false }));
  await frames('size-reverse', 18);
  await page.evaluate(() => S2Motion.press('switch', true));
  await frames('switch-press', 5);
  await page.evaluate(() => S2Motion.press('switch', false));
  await frames('switch-release', 18);
  await page.evaluate(() => S2Motion.press('button', true));
  await frames('button-press', 5);
  await page.evaluate(() => S2Motion.press('button', false));
  await frames('button-release', 18);
  for (const size of ['sm', 'lg', 'icon', 'default']) {
    await page.evaluate((size) => S2Motion.change('button', { size }), size);
    await frames(`button-size-${size}`, 14);
  }
  await page.evaluate(() => S2Motion.change('switch', { checked: true }));
  await frames('checked-endpoint', 18);
  await page.evaluate(() => S2Motion.press('switch', true));
  await frames('nested-checked-press', 18);
  const scaledHits = await page.evaluate(() => S2Motion.boundaryHits('switch'));
  // Subpixel scale edges follow the browser's native hit-test rounding. H1
  // requires collapsed parity, not a stronger geometric point-in-box rule.
  for (const row of scaledHits) assert.equal(row.center, true);
  assert.equal(scaledHits[1].oldEdge, scaledHits[0].oldEdge);
  await page.evaluate(() => S2Motion.press('button', true));
  await frames('button-pressed-endpoint', 18);
  const translatedHits = await page.evaluate(() => S2Motion.boundaryHits('button'));
  for (const row of translatedHits) assert.equal(row.center, true);
  assert.equal(translatedHits[1].oldEdge, translatedHits[0].oldEdge);
  const largeTranslationHits = await page.evaluate(() => S2Motion.boundaryHits('motion-hit'));
  for (const row of largeTranslationHits) {
    assert.equal(row.center, true);
    assert.equal(row.oldEdge, false);
  }
  assert.ok(
    samples.some(
      (s) =>
        s.phase.startsWith('check-') &&
        s.rows[2].geometry.thumbX > 3.1 &&
        s.rows[2].geometry.thumbX < 20.9
    ),
    'real intermediate Thumb travel'
  );
  assert.ok(
    samples.some(
      (s) =>
        s.phase.startsWith('size-grow-') &&
        s.rows[4].geometry.width > 128.1 &&
        s.rows[4].geometry.width < 255.9
    ),
    'real intermediate sizing'
  );
  assert.ok(
    samples.some((s) => s.phase.startsWith('switch-press-') && s.rows[2].geometry.width < 43.99),
    'real Root scale'
  );
  assert.ok(
    samples.some((s) => s.phase.startsWith('button-press-') && s.rows[0].geometry.y > 0.01),
    'real Button press translation'
  );
  const hit = await page.evaluate(() => S2Motion.hitChecks());
  if (process.env.PUI_S2_DEBUG) console.log(hit);
  for (const row of hit) {
    assert.equal(row.override, true);
    assert.equal(row.keyboardFocusable, true);
  }
  const hints = await page.evaluate(() => S2Motion.hintChecks());
  // Paint is not elementFromPoint: an extra transparent surface can receive
  // hits while a negative-z consumer is visibly painted beneath it.
  const sharp = createRequire(new URL('../../apps/www/package.json', import.meta.url))('sharp');
  const screenshot = await sharp(await page.screenshot())
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const row of hints) {
    assert.equal(row.x, 0);
    assert.equal(row.y, 0);
    assert.equal(row.willChange, 'transform');
    const pixel = (Math.floor(row.paintY) * screenshot.info.width + Math.floor(row.paintX)) * 4;
    assert.deepEqual(
      [...screenshot.data.subarray(pixel, pixel + 4)],
      [255, 0, 0, 255],
      'negative-z child paints within the Root stacking context'
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        kind: 'h1-motion-browser',
        browser: browser.version(),
        frames: samples.length,
        checkedTravel: [
          samples[0].rows[2].geometry.thumbX,
          samples.find((s) => s.phase === 'checked-endpoint-17').rows[2].geometry.thumbX,
        ],
        scaledHits,
        translatedHits,
        largeTranslationHits,
        hit,
        hints,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
