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
const out = resolve(process.argv[2] ?? '/tmp/pui-owned-decoration-evidence');
await mkdir(out, { recursive: true });
const source = 'scripts/feedback/owned-decoration-evidence-app.ts';
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
});
await writeFile(
  join(out, 'index.html'),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="tokens.css"><title>Draft owned decoration proof</title><style>body{font:16px system-ui;margin:32px;background:#e5e7eb;color:#171717}main{max-width:640px;border:1px solid #737373}input,button{font:inherit;margin:16px 8px 16px 0}p{max-width:640px}</style></head><body><h1>Draft owned decoration</h1><p>Light WC only. Two independent empty leaves, existing Rule feedback and caller-owned editor. This is a generic capability proof, not Tabs line or shadcn visual parity.</p><main></main><script type="module" src="app.js"></script></body></html>'
);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const boundSources = [
  source,
  'scripts/feedback/owned-decoration-evidence.mjs',
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
    'Draft light WC only; native generic capability proof, not a production Tabs recipe or portable compiler support.',
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
  const context = await browser.newContext({ viewport: { width: 1000, height: 620 } });
  await context.route('**/*', (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort()
  );
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const snapshot = () => page.evaluate(() => window.decorationEvidence.snapshot());
  const waitPaint = (active) =>
    page.waitForFunction((active) => {
      const node = window.decorationEvidence.leaves[0];
      return (
        getComputedStyle(node).backgroundColor ===
          (active ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)') &&
        getComputedStyle(node).opacity === (active ? '1' : '0.5')
      );
    }, active);
  const check = (s, active) => {
    assert.equal(s.renders, 1);
    assert.equal(s.stable, true);
    assert.equal(s.callerParentStable, true);
    assert.equal(s.value, 'preserve selection');
    assert.equal(s.leaves.length, 2);
    assert.equal(s.leaves[0].color, active ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
    assert.equal(s.leaves[0].opacity, active ? '1' : '0.5');
    assert.equal(s.leaves[1].color, 'rgb(0, 0, 0)');
    for (const leaf of s.leaves) {
      assert.equal(leaf.width, 64);
      assert.equal(leaf.height, 16);
      assert.equal(leaf.hidden, 'true');
      assert.equal(leaf.inert, true);
      assert.equal(leaf.tabIndex, -1);
      assert.equal(leaf.pointer, 'none');
      assert.equal(leaf.children, 0);
    }
    assert(!/bg-(black|white|blue)/.test(s.hostTokens));
  };
  let s = await snapshot();
  check(s, false);
  observations.push({ phase: 'initial', ...s });
  await page.screenshot({ path: join(out, 'baseline.png') });
  await page.locator('#caller-editor').focus();
  await page.locator('#caller-editor').evaluate((el) => el.setSelectionRange(2, 8, 'backward'));
  await page.keyboard.press('F2');
  await waitPaint(true);
  s = await snapshot();
  check(s, true);
  assert.equal(s.focus, 'caller-editor');
  assert.deepEqual(s.selection, [2, 8, 'backward']);
  observations.push({ phase: 'native-keyboard', ...s });
  await page.screenshot({ path: join(out, 'active.png') });
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
    const { node } = await cdp.send('DOM.describeNode', { nodeId });
    const ax = await cdp.send('Accessibility.getPartialAXTree', {
      backendNodeId: node.backendNodeId,
      fetchRelatives: false,
    });
    const item = ax.nodes.find((x) => x.backendDOMNodeId === node.backendNodeId);
    assert(item, `Missing AX node ${selector}`);
    assert.equal(item.ignored, selector.startsWith('['));
    accessibility.push({
      selector,
      ignored: item.ignored,
      role: item.role?.value,
      ignoredReasons: item.ignoredReasons,
    });
  }
  const rebind = await page.evaluate(() => {
    const e = window.decorationEvidence;
    try {
      e.host.update();
      return 'accepted';
    } catch (error) {
      return String(error);
    }
  });
  assert(rebind.includes('structural rebind unsupported'));
  assert.equal((await snapshot()).stable, true);
  const terminal = await page.evaluate(async () => {
    const e = window.decorationEvidence;
    const before = e.leaves.map((n) => n.outerHTML);
    e.host.remove();
    await Promise.resolve();
    await Promise.resolve();
    e.host.click();
    await Promise.resolve();
    return { before, after: e.leaves.map((n) => n.outerHTML) };
  });
  assert.deepEqual(terminal.after, terminal.before);
  assert.deepEqual(errors, []);
  assert.equal(
    git(['status', '--porcelain=v1', '--untracked-files=no']),
    '',
    'Capture must not modify tracked sources'
  );
  await writeFile(
    join(out, 'native-result.json'),
    JSON.stringify(
      {
        revision: receipt.revision,
        observations,
        accessibility,
        rebind,
        terminal,
        pageErrors: errors,
        pass: true,
      },
      null,
      2
    )
  );
  const artifacts = [];
  for (const path of [
    'baseline.png',
    'active.png',
    'failure.png',
    'native-result.json',
    'failure.json',
    'source-receipt.json',
    'tokens.css',
    'app.js',
    'index.html',
  ]) {
    try {
      artifacts.push({ path, sha256: hash(await readFile(join(out, path))) });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await writeFile(
    join(out, 'capture-manifest.json'),
    JSON.stringify({ revision, artifacts }, null, 2)
  );
} catch (error) {
  await writeFile(
    join(out, 'failure.json'),
    JSON.stringify(
      { revision: receipt.revision, error: String(error), observations, pageErrors: errors },
      null,
      2
    )
  );
  if (page) await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
