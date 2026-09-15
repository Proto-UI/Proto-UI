/** Private Runtime/Rule computed-style evidence. No public profile admission.
 * Run: node --import tsx scripts/analysis/shadow-split-runtime-browser.mjs */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../../packages/cli/src/services/proto-style-css.ts';

const tokens = [
  'block',
  'flex-1',
  'min-w-0',
  'p-2',
  'border-2',
  'text-xs',
  'bg-primary',
  'p-4',
  'border',
  'text-lg',
  'p-8',
  'text-sm',
  'data-[pilot-active]:p-4',
  'data-[pilot-active]:border',
  'data-[pilot-active]:text-lg',
  'dark:p-8',
];
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/shadow-split-runtime-browser.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'PuiSplitProbe',
  platform: 'browser',
  tsconfig: 'tsconfig.json',
});
const requireBrowser = createRequire(new URL('../../apps/www/package.json', import.meta.url));
const { chromium } = requireBrowser('playwright-core');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const samples = await page.evaluate(({ artifact, css }) => PuiSplitProbe.run(artifact, css), {
    artifact: renderProtoShadowSplitStyleArtifact(tokens),
    css: renderProtoStyleTokenCss(tokens),
  });
  for (const sample of samples)
    assert.deepEqual(sample.split, sample.collapsed, `${sample.initial}/${sample.phase}`);
  console.log(
    JSON.stringify(
      { kind: 'private-shadow-runtime-evidence', browser: browser.version(), samples },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
