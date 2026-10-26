import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { build } from 'esbuild';
import { collectProtoStyleTokensFromFiles } from '../../packages/cli/src/services/prototype-style-tokens.ts';
import { renderProtoStyleTokenCss } from '../../packages/cli/src/services/proto-style-css.ts';
const buildOnly = process.env.EVIDENCE_BUILD_ONLY === '1';
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const revision = buildOnly
  ? (process.env.EVIDENCE_HEAD_SHA ?? 'unpublished-build-only')
  : git(['rev-parse', 'HEAD']);
if (!buildOnly) {
  assert(process.env.EVIDENCE_HEAD_SHA, 'Exact expected head is required for native evidence');
  assert.equal(
    revision,
    process.env.EVIDENCE_HEAD_SHA,
    'Checked-out HEAD must match the evidence head'
  );
  assert.equal(
    git(['status', '--porcelain=v1', '--untracked-files=no']),
    '',
    'Tracked tree must be clean'
  );
}
const out = resolve(process.argv[2] ?? '/tmp/pui-owned-decoration-portal-evidence');
await mkdir(out, { recursive: true });
const source = 'packages/adapters/react/test/fixtures/owned-decoration-portal-evidence-app.ts';
const tokens = await collectProtoStyleTokensFromFiles([resolve(source)]);
for (const expected of [
  'block',
  'p-4',
  'h-4',
  'w-16',
  'bg-black',
  'bg-white',
  'opacity-50',
  'opacity-100',
])
  assert(tokens.includes(expected), `Missing collected token ${expected}`);
const css = renderProtoStyleTokenCss(tokens);
await writeFile(join(out, 'collected-tokens.json'), JSON.stringify(tokens, null, 2));
await writeFile(join(out, 'tokens.css'), css);
assert(!css.includes('Unsupported Proto UI style tokens'));
await build({
  entryPoints: [source],
  outfile: join(out, 'app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  tsconfig: 'tsconfig.json',
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
});
await writeFile(
  join(out, 'index.html'),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><title>Draft owned decoration proof</title><style>body{font:16px system-ui;margin:32px;background:#e5e7eb;color:#171717}main{max-width:640px;border:1px solid #737373}input,button{font:inherit;margin:16px 8px 16px 0}p{max-width:640px}</style></head><body><h1>Draft portal owned decoration</h1><p>Four same-document portal Web adapters. Two independent empty leaves, existing Rule feedback and caller-owned editor. This is a generic capability proof, not Tabs line or shadcn visual parity.</p><main></main><script type="module" src="app.js"></script></body></html>'
);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const boundSources = [
  '.github/workflows/owned-decoration-portal-evidence.yml',
  'pnpm-lock.yaml',
  'packages/adapters/base/src/platform/web-owned-decoration.ts',
  'packages/adapters/base/src/platform/web-owned-decoration-portal.ts',
  'packages/adapters/base/src/platform/portal-destination.ts',
  'packages/adapters/web-component/src/portal-mount.ts',
  'packages/adapters/web-component/src/adapt.ts',
  ...['react', 'vue', 'vue2'].flatMap((adapter) =>
    ['adapt.ts', 'template.ts', 'runtime/modules.ts', 'runtime/session.ts'].map(
      (file) => `packages/adapters/${adapter}/src/${file}`
    )
  ),
  'packages/modules/feedback/src/types.ts',
  source,
  'scripts/feedback/owned-decoration-portal-evidence.mjs',
  'packages/core/src/handles.ts',
  'packages/core/src/spec/template.ts',
  'packages/modules/feedback/src/create.ts',
  'packages/modules/feedback/src/style/owned-decoration-registry.ts',
  'packages/modules/rule/src/eval.ts',
  'packages/modules/rule-expose-state-web/src/create.ts',
  'packages/adapters/web-component/src/commit.ts',
  'packages/adapters/web-component/src/owned-decoration.ts',
  'packages/adapters/web-component/src/runtime/session.ts',
  'packages/adapters/web-component/src/runtime/modules.ts',
];
const receipt = {
  mode: buildOnly ? 'build-only' : 'native-browser',
  revision,
  trackedTreeClean: buildOnly ? null : true,
  tokens,
  sources: await Promise.all(
    boundSources.map(async (path) => ({ path, sha256: hash(await readFile(path)) }))
  ),
  artifacts: await Promise.all(
    ['app.js', 'tokens.css', 'index.html'].map(async (path) => ({
      path,
      sha256: hash(await readFile(join(out, path))),
    }))
  ),
  boundary:
    'Draft four-Web-adapter proof; same-document portal epochs and three close/open cycles only; no cross-document or cross-close physical identity promise, no Select parity.',
};
await writeFile(join(out, 'source-receipt.json'), JSON.stringify(receipt, null, 2));
if (buildOnly) process.exit(0);
const { launchBrowser } = await import('../../apps/www/src/content/docs/zh-cn/browser-harness.ts');
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = resolve(out, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(out + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      'content-type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ??
        'application/octet-stream'
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, page;
const observations = [],
  errors = [];
try {
  browser = await launchBrowser();
  const results = [];
  for (const adapter of ['wc', 'react', 'vue', 'vue2']) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 680 } });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    page = await context.newPage();
    page.on('pageerror', (e) => errors.push({ adapter, error: String(e) }));
    await page.goto(`${origin}/?adapter=${adapter}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    const snapshot = async () => {
      const frame = await page.evaluate(() => window.decorationWebEvidence.snapshot());
      observations.push({ phase: 'observed-before-assertion', ...frame });
      return frame;
    };
    const waitPaint = (active) =>
      page.waitForFunction((active) => {
        const n = window.decorationWebEvidence.leaves[0];
        return (
          n &&
          getComputedStyle(n).backgroundColor ===
            (active ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)') &&
          getComputedStyle(n).opacity === (active ? '1' : '0.5')
        );
      }, active);
    const check = (s, active) => {
      assert.equal(s.framework, adapter);
      assert.equal(s.setups, 1);
      assert.equal(s.portalLocated, true);
      assert.equal(s.materialSuspended, false);
      assert.equal(s.renders, s.originalRenders);
      assert.equal(s.stable, true);
      assert.equal(s.callerStable, true);
      assert.equal(s.value, 'preserve selection');
      assert.equal(s.leaves.length, 2);
      assert.equal(s.leaves[0].color, active ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
      assert.equal(s.leaves[0].opacity, active ? '1' : '0.5');
      assert.equal(s.leaves[1].color, 'rgb(0, 0, 0)');
      assert.equal(s.leaves[1].opacity, '1');
      for (const leaf of s.leaves) {
        assert.equal(leaf.width, 64);
        assert.equal(leaf.height, 16);
        assert.equal(leaf.hidden, 'true');
        assert.equal(leaf.inert, true);
        assert.equal(leaf.tabIndex, -1);
        assert.equal(leaf.pointer, 'none');
        assert.equal(leaf.children, 0);
      }
      assert(!/bg-(black|white)/.test(s.hostTokens ?? ''));
    };
    await waitPaint(false);
    let s = await snapshot();
    check(s, false);
    observations.push({ phase: 'initial', ...s });
    await page.screenshot({ path: join(out, `${adapter}-baseline.png`) });
    await page.locator('#caller-editor').focus();
    await page.locator('#caller-editor').evaluate((el) => el.setSelectionRange(2, 8, 'backward'));
    await page.keyboard.press('F2');
    await waitPaint(true);
    s = await snapshot();
    check(s, true);
    assert.equal(s.focus, 'caller-editor');
    assert.deepEqual(s.selection, [2, 8, 'backward']);
    observations.push({ phase: 'native-keyboard', ...s });
    await page.screenshot({ path: join(out, `${adapter}-active.png`) });
    await page.keyboard.press('F2');
    await waitPaint(false);
    s = await snapshot();
    check(s, false);
    assert.equal(s.focus, 'caller-editor');
    assert.deepEqual(s.selection, [2, 8, 'backward']);
    observations.push({ phase: 'withdrawal', ...s });
    await page.locator('#caller-toggle').click();
    await waitPaint(true);
    s = await snapshot();
    check(s, true);
    assert.equal(s.focus, 'caller-toggle');
    observations.push({ phase: 'native-pointer', ...s });
    await page.keyboard.press('Tab');
    assert.notEqual(
      await page.evaluate(() => document.activeElement?.hasAttribute('data-pui-owned-decoration')),
      true
    );
    {
      await page.locator('#lifecycle-cycle').click();
      await page.waitForFunction(() => document.documentElement.dataset.cycled === 'true');
      await waitPaint(true);
      s = await snapshot();
      check(s, true);
      assert.equal(s.cycleHiddenUnchanged, true);
      observations.push({
        phase: 'portal-three-close-open',
        ...s,
      });
      await page.locator('#caller-editor').focus();
      await page.locator('#caller-editor').evaluate((el) => el.setSelectionRange(2, 8, 'backward'));
      await page.keyboard.press('F2');
      await waitPaint(false);
      s = await snapshot();
      check(s, false);
      assert.equal(s.focus, 'caller-editor');
      assert.deepEqual(s.selection, [2, 8, 'backward']);
      observations.push({ phase: 'rebound-native-keyboard', ...s });
      await page.screenshot({ path: join(out, `${adapter}-rebound.png`) });
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const accessibility = [];
    for (const selector of [
      '[data-pui-owned-decoration]',
      '[data-pui-owned-decoration]:last-child',
      '#caller-editor',
      '#caller-toggle',
    ]) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      assert(nodeId, `Missing DOM ${adapter} ${selector}`);
      const { node } = await cdp.send('DOM.describeNode', { nodeId });
      const ax = await cdp.send('Accessibility.getPartialAXTree', {
        backendNodeId: node.backendNodeId,
        fetchRelatives: false,
      });
      const item = ax.nodes.find((x) => x.backendDOMNodeId === node.backendNodeId);
      assert(item, `Missing AX ${adapter} ${selector}`);
      assert.equal(item.ignored, selector.startsWith('['));
      accessibility.push({
        selector,
        ignored: item.ignored,
        role: item.role?.value,
        ignoredReasons: item.ignoredReasons,
      });
    }
    const terminal = await page.evaluate(async () => {
      const e = window.decorationWebEvidence;
      const leaves = e.leaves;
      const beforeDisposal = leaves.map((n) => n.outerHTML);
      const button = document.querySelector('#caller-toggle');
      e.dispose();
      await new Promise((r) => setTimeout(r, 0));
      // Lease retirement may synchronously withdraw old paint. No subsequent
      // write may follow the completed disposal checkpoint.
      const before = leaves.map((n) => n.outerHTML);
      button.click();
      await Promise.resolve();
      return { beforeDisposal, before, after: leaves.map((n) => n.outerHTML) };
    });
    assert.deepEqual(terminal.after, terminal.before);
    results.push({ adapter, accessibility, terminal, pass: true });
    await context.close();
    page = null;
  }
  assert.deepEqual(errors, []);
  assert.equal(
    git(['status', '--porcelain=v1', '--untracked-files=no']),
    '',
    'Tracked tree must stay clean'
  );
  await writeFile(
    join(out, 'native-result.json'),
    JSON.stringify({ revision, results, observations, pageErrors: errors, pass: true }, null, 2)
  );
  const names = [
    'app.js',
    'tokens.css',
    'index.html',
    'source-receipt.json',
    'native-result.json',
    ...['wc', 'react', 'vue', 'vue2'].flatMap((a) => [
      `${a}-baseline.png`,
      `${a}-active.png`,
      ...(a === 'wc' ? [] : [`${a}-rebound.png`]),
    ]),
  ];
  const artifacts = await Promise.all(
    names.map(async (path) => ({ path, sha256: hash(await readFile(join(out, path))) }))
  );
  await writeFile(
    join(out, 'capture-manifest.json'),
    JSON.stringify({ revision, artifacts }, null, 2)
  );
} catch (error) {
  // Best-effort evidence may fail independently; never replace the original failure.
  if (page) {
    try {
      observations.push({
        phase: 'failure-current',
        ...(await page.evaluate(() => window.decorationWebEvidence?.snapshot())),
      });
    } catch {}
  }
  const artifacts = [];
  if (page) {
    try {
      await page.screenshot({ path: join(out, 'failure.png') });
      artifacts.push({
        path: 'failure.png',
        sha256: hash(await readFile(join(out, 'failure.png'))),
      });
    } catch {}
  }
  await writeFile(
    join(out, 'failure.json'),
    JSON.stringify(
      { revision, error: String(error), observations, pageErrors: errors, artifacts },
      null,
      2
    )
  );
  artifacts.push({ path: 'failure.json', sha256: hash(await readFile(join(out, 'failure.json'))) });
  await writeFile(
    join(out, 'capture-manifest.json'),
    JSON.stringify({ revision, pass: false, artifacts }, null, 2)
  );
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
