/** Composed prototype pilots, not public split profile conformance.
 * Run: node --import tsx scripts/analysis/shadow-split-prototypes-browser.mjs */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { collectProtoStyleTokens } from '../../packages/cli/src/services/prototype-style-tokens.ts';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css.ts';

// Collector closures include raw + lowered tokens. Badge has no base hook;
// Checkbox's imported Base/Focusable/Trigger hooks contribute no Root style.
const badge = await collectProtoStyleTokens('packages/prototypes/brutalist/src/badge');
const checkbox = await collectProtoStyleTokens('packages/prototypes/shadcn/src/checkbox');
const artifacts = {
  badge: renderProtoShadowSplitStyleArtifact(badge),
  checkbox: renderProtoShadowSplitStyleArtifact(checkbox),
};
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-split-prototypes-browser.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'PuiPrototypeProbe',
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
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const samples = await page.evaluate(
    ({ artifacts, css }) => PuiPrototypeProbe.run(artifacts, css),
    { artifacts, css: renderProtoStyleTokenCss([...new Set([...badge, ...checkbox])].sort()) }
  );
  console.log(
    JSON.stringify(
      { kind: 'private-shadow-prototype-evidence', browser: browser.version(), samples },
      null,
      2
    )
  );
  for (const sample of samples) {
    assert.deepEqual(sample.split, sample.collapsed, `${sample.kind}/${sample.phase}`);
    assert.equal(sample.boundaryDisplays.split, sample.kind === 'badge' ? 'inline-grid' : 'grid');
  }
} finally {
  await browser.close();
}
