/** Native four-Web Bootstrap Collapse acceptance; no injected dimensions, clocks or RAF. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { collectProtoStyleTokensFromFiles } from '../../packages/cli/src/services/prototype-style-tokens.ts';
import { renderProtoStyleTokenCss } from '../../packages/cli/src/services/proto-style-css.ts';
import { renderThemeCss } from '../../packages/prototypes/bootstrap-2-3-2/src/theme.ts';

const output = path.resolve(process.env.PUI_EVIDENCE_DIR ?? '.tmp/bootstrap-collapse-browser');
await mkdir(output, { recursive: true });
const runtimes = process.env.PUI_BROWSER_RUNTIMES?.split(',') ?? ['wc', 'react', 'vue', 'vue2'];
const kinds = process.env.PUI_BROWSER_KINDS?.split(',') ?? ['collapsible', 'accordion'];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const report = {
  kind: 'bootstrap-collapse-four-web-native',
  at: new Date().toISOString(),
  source: {
    head: git('rev-parse', 'HEAD'),
    dirty: !!git('status', '--porcelain'),
    driverSha256: hash(await readFile(new URL(import.meta.url))),
  },
  environment: {
    runtimes,
    kinds,
    viewport: { width: 960, height: 720 },
    theme: 'light',
    locale: 'en',
    node: process.version,
  },
  boundary:
    'Actual authored Bootstrap parts, public four-Web Demo renderers, generated source CSS, native Chromium geometry and click input. Physical touch, real AT, other themes/viewports and Compiler/native targets remain independent.',
  cases: [],
};
const bundle = await build({
  entryPoints: ['scripts/analysis/fixtures/bootstrap-collapse-browser.ts'],
  write: false,
  outfile: path.join(output, 'consumer.js'),
  bundle: true,
  format: 'iife',
  globalName: 'BootstrapCollapse',
  platform: 'browser',
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'fixture-runtime',
      setup(build) {
        build.onResolve({ filter: /^virtual:proto-ui\/runtime-retry-urls$/ }, () => ({
          path: 'retry-urls',
          namespace: 'fixture-runtime',
        }));
        build.onLoad({ filter: /.*/, namespace: 'fixture-runtime' }, () => ({
          contents: 'export default {};',
          loader: 'js',
        }));
      },
    },
  ],
});
const script = bundle.outputFiles.find((file) => file.path.endsWith('.js')).text;
report.source.bundleSha256 = hash(script);
report.source.inputs = await Promise.all(
  Object.keys(bundle.metafile.inputs)
    .filter((file) => !file.includes('node_modules') && !file.startsWith('fixture-runtime:'))
    .sort()
    .map(async (file) => ({ path: file, sha256: hash(await readFile(file)) }))
);
// Inherited Base rules are part of the consumer's source closure. Collecting
// only the two Bootstrap directories omitted their hidden-state CSS entirely.
const styleSources = report.source.inputs
  .map((input) => input.path)
  .filter((file) => file.startsWith('packages/prototypes/') && /\.[cm]?tsx?$/.test(file));
const tokens = await collectProtoStyleTokensFromFiles(
  styleSources.map((file) => path.resolve(file))
);
const css = renderProtoStyleTokenCss(tokens);
report.source.styleInputs = styleSources;
report.source.styleTokenCount = tokens.length;
report.source.cssSha256 = hash(css);
await writeFile(path.join(output, 'consumer.js'), script);
await writeFile(path.join(output, 'consumer.css'), css);
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
let executablePath;
for (const candidate of [
  process.env.CHROME_PATH,
  process.env.PUI_CHROME_EXECUTABLE,
  chromium.executablePath(),
  '/usr/bin/chromium',
].filter(Boolean)) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
assert(executablePath, 'Chromium executable required.');
const browser = await chromium.launch({
  executablePath,
  headless: true,
  chromiumSandbox: true,
  args: ['--disable-dev-shm-usage'],
});
report.environment.browser = browser.version();
const page = await browser.newPage({
  viewport: report.environment.viewport,
  colorScheme: 'light',
  reducedMotion: 'no-preference',
});
const accessibility = await page.context().newCDPSession(page);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.setDefaultTimeout(5000);
await page.setContent(
  '<!doctype html><html data-theme="light"><head><meta charset="utf-8"></head><body><main><h1>Bootstrap 2.3.2 · intrinsic Collapse</h1><p id="scope"></p><div id="fixture"></div></main></body></html>'
);
await page.addStyleTag({
  content: `${renderThemeCss()}\n${css}\n*,::before,::after {box-sizing:border-box} body{margin:0;background:#f6f6f6;color:#333;font-family:"Helvetica Neue",Arial,sans-serif} main{width:640px;margin:40px auto;padding:24px;background:#fff} h1{font-size:22px;line-height:30px;margin:0 0 12px} #scope{font-size:14px;margin-bottom:18px} .collapse-copy>div{min-height:20px}`,
});
await page.addScriptTag({ content: script });
const run = (fn, value) => page.evaluate(fn, value);
const snapshot = () => run(() => BootstrapCollapse.snapshot());
const trace = async (action, delay = 520) => {
  await run(() => BootstrapCollapse.startTrace());
  await action();
  await page.waitForTimeout(delay);
  return run(() => BootstrapCollapse.stopTrace());
};
const accepted = (open) => run((value) => BootstrapCollapse.accept(value), open);
const click = () => page.locator('[data-demo-ref="trigger"]').click();
const mount = async (runtime, kind, options) => {
  await run(
    ([runtime, kind, options]) => BootstrapCollapse.mount(runtime, kind, options),
    [runtime, kind, options]
  );
  await page.locator('#scope').evaluate((element, text) => {
    element.textContent = text;
  }, `${runtime} · ${kind} · light · native Chromium`);
};
const hasIntermediate = (samples, limit) =>
  samples.filter((row) => row.height > 0.5 && row.height < limit - 0.5).length >= 3;
async function check(runtime, kind, name, action) {
  const row = { runtime, kind, name, status: 'running', errorsBefore: errors.length };
  report.cases.push(row);
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    Object.assign(row, await action(row));
    assert.equal(errors.length, row.errorsBefore, errors.slice(row.errorsBefore).join('\n'));
    row.status = 'passed';
  } catch (error) {
    row.status = 'failed';
    row.error = String(error.stack ?? error);
    row.snapshot = await snapshot().catch(() => null);
  } finally {
    // A failing reduced-motion assertion must not change any later case's
    // environment. Retire the actual consumer before resetting its preference.
    try {
      await run(() => BootstrapCollapse.dispose());
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    } catch (error) {
      row.status = 'failed';
      row.cleanupError = String(error.stack ?? error);
    }
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`${row.status}: ${runtime}/${kind}/${name}`);
}
try {
  for (const runtime of runtimes)
    for (const kind of kinds) {
      await check(runtime, kind, 'cold-open-retained-close', async (row) => {
        await mount(runtime, kind, { controlled: true });
        assert.equal((await snapshot()).height, 0);
        row.open = await trace(() => accepted(true));
        const entered = await snapshot();
        assert(entered.height > 110, JSON.stringify(entered));
        assert.equal(entered.size, '');
        assert.equal(entered.hidden, false);
        assert(
          hasIntermediate(row.open, entered.height),
          'Entry must contain several real intermediate heights.'
        );
        await page.screenshot({ path: path.join(output, `${runtime}-${kind}-entered.png`) });
        row.close = await trace(() => accepted(false));
        assert(
          hasIntermediate(row.close, entered.height),
          'Close must retain the view through intermediate heights.'
        );
        assert.equal((await snapshot()).height, 0);
        assert.equal((await snapshot()).hidden, true);
        assert(
          row.close.some((sample) => sample.height > 0 && sample.height < 2),
          'Exit must reach the zero edge before detaching.'
        );
        return { entered };
      });
      await check(runtime, kind, 'controlled-refusal-and-canonical-child-target', async (row) => {
        await mount(runtime, kind, { controlled: true, keepMounted: true });
        row.refused = await trace(click, 160);
        assert(row.refused.every((sample) => sample.height === 0));
        assert.equal((await snapshot()).requests.length, 1);
        await run(() => BootstrapCollapse.spoofChildOpen(true));
        await page.waitForTimeout(80);
        assert.equal((await snapshot()).open, false);
        assert.equal((await snapshot()).height, 0);
        await accepted(true);
        await page.waitForTimeout(500);
        const before = await snapshot();
        row.refusedClose = await trace(click, 160);
        assert(row.refusedClose.every((sample) => Math.abs(sample.height - before.height) < 0.1));
        assert.equal((await snapshot()).open, true);
      });
      await check(runtime, kind, 'interruption-reversal-and-keepMounted-identity', async (row) => {
        await mount(runtime, kind, { controlled: true, initialOpen: true, keepMounted: true });
        await run(() => BootstrapCollapse.remember());
        const initial = await snapshot();
        assert.equal(initial.size, '', 'Initial open uses natural layout.');
        await run(() => BootstrapCollapse.startTrace());
        await accepted(false);
        await page.waitForTimeout(120);
        // Keep the last applied sample and accepted target change in one
        // browser task. A separate CDP round trip may deliver another native
        // leave frame before the reversal, which is motion rather than a jump.
        const reversal = await run(async () => {
          const before = BootstrapCollapse.snapshot();
          await BootstrapCollapse.accept(true);
          return { before, after: BootstrapCollapse.snapshot() };
        });
        row.beforeReversal = reversal.before;
        row.afterReversal = reversal.after;
        assert.equal(row.beforeReversal.phase, 'leaving');
        assert(row.beforeReversal.height > 0 && row.beforeReversal.height < initial.height);
        assert.equal(row.afterReversal.phase, 'entering');
        assert.equal(row.afterReversal.open, true);
        assert.equal(row.afterReversal.bodySame, true);
        assert.equal(row.afterReversal.ownerSame, true);
        assert(
          Math.abs(row.afterReversal.height - row.beforeReversal.height) < 2,
          'Reversal cannot jump to an endpoint.'
        );
        await page.waitForTimeout(500);
        row.reversal = await run(() => BootstrapCollapse.stopTrace());
        assert(Math.abs((await snapshot()).height - initial.height) < 0.1);
        await accepted(false);
        await page.waitForTimeout(500);
        const closed = await snapshot();
        assert.equal(closed.height, 0);
        assert.equal(closed.bodySame, true);
        assert.equal(closed.ownerSame, true);
        await accepted(true);
        await page.waitForTimeout(500);
        const reopened = await snapshot();
        assert.equal(reopened.bodySame, true);
        assert.equal(reopened.ownerSame, true);
        await accepted(false);
        await page.waitForTimeout(500);
        await run(() => BootstrapCollapse.keepMounted(false));
        await page.waitForTimeout(50);
        const retired = await snapshot();
        assert.equal(retired.height, 0);
        assert.equal(retired.bodyVisible, false);
        assert.equal(retired.controls, null);
        // A WC view owns its projection, while its caller retains the supplied
        // light-DOM children. Other renderers remove their rendered children.
        if (runtime === 'wc') {
          assert.equal(retired.viewDetached, true);
          assert.equal(retired.bodySame, true);
        } else assert.equal(retired.bodyPresent, false);
        const ax = await accessibility.send('Accessibility.getFullAXTree');
        const exposedContent = ax.nodes.filter(
          (node) => !node.ignored && node.name?.value?.includes('authored disclosure content')
        );
        assert.equal(exposedContent.length, 0, 'Retired content must leave the Chromium AX tree.');
        return { initial, closed, reopened, retired, retiredAxContent: exposedContent.length };
      });
      await check(runtime, kind, 'content-grows-and-shrinks-during-entry', async (row) => {
        await mount(runtime, kind, { controlled: true, keepMounted: true });
        await run(() => BootstrapCollapse.startTrace());
        await accepted(true);
        await page.waitForTimeout(80);
        row.beforeGrowth = await snapshot();
        await run(() => BootstrapCollapse.grow(14));
        await page.waitForTimeout(90);
        row.grown = await snapshot();
        assert(row.grown.naturalContent > row.beforeGrowth.naturalContent);
        await run(() => BootstrapCollapse.grow(6));
        await page.waitForTimeout(500);
        row.dynamic = await run(() => BootstrapCollapse.stopTrace());
        const final = await snapshot();
        assert.equal(final.naturalContent, row.beforeGrowth.naturalContent);
        assert(final.height > 110 && final.height < 160, JSON.stringify(final));
        assert.equal(final.size, '');
        assert.equal(final.hidden, false);
        return { final };
      });
      await check(runtime, kind, 'reduced-motion-and-disposal-retire-owned-writes', async (row) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(runtime, kind, { controlled: true, keepMounted: true });
        row.reduced = await trace(() => accepted(true), 100);
        const entered = await snapshot();
        assert(entered.height > 110);
        assert.equal(entered.size, '');
        assert(
          !row.reduced.some((sample) => sample.height > 0.5 && sample.height < entered.height - 0.5)
        );
        await accepted(false);
        await page.waitForTimeout(60);
        assert.equal((await snapshot()).height, 0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await accepted(true);
        await page.waitForTimeout(80);
        row.removal = await run(() => BootstrapCollapse.dispose());
        assert.deepEqual(row.removal, {
          children: 0,
          oldSize: '',
          oldOverflow: '',
          oldConnected: false,
        });
        await page.waitForTimeout(450);
        assert.equal(await page.locator('#fixture').evaluate((el) => el.childElementCount), 0);
      });
    }
} finally {
  await browser.close();
  report.errors = errors;
  report.summary = {
    passed: report.cases.filter((row) => row.status === 'passed').length,
    failed: report.cases.filter((row) => row.status !== 'passed').length,
  };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report.summary));
if (report.summary.failed) process.exitCode = 1;
