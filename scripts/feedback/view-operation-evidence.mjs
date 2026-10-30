import assert from 'node:assert/strict';
import { VIEW_OPERATION_CASES, assertViewOperationCase } from './view-operation-receipt.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { launchBrowser } from '../../apps/www/src/content/docs/zh-cn/browser-harness.ts';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const revision = git(['rev-parse', 'HEAD']);
assert(process.env.EVIDENCE_HEAD_SHA, 'Exact expected head is required');
assert.equal(revision, process.env.EVIDENCE_HEAD_SHA);
assert.equal(git(['status', '--porcelain=v1', '--untracked-files=no']), '');
const tree = git(['rev-parse', 'HEAD^{tree}']);
const out = resolve(process.argv[2] ?? '/tmp/pui-view-operation-evidence');
await mkdir(out, { recursive: true });
const source = 'packages/adapters/web-component/test/fixtures/view-operation-evidence-app.ts';
const hash = (value) => createHash('sha256').update(value).digest('hex');
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
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>View-operation native contract</title><style>body{font:16px system-ui;padding:24px;color:#111;background:white}</style></head><body><h1>WC source-view operation</h1><p>Eight real custom-element scenarios; not Menubar or four-host conformance.</p><main></main><script type="module" src="app.js"></script></body></html>'
);
const boundPaths = [
  source,
  'scripts/feedback/view-operation-evidence.mjs',
  'scripts/feedback/view-operation-receipt.mjs',
  '.github/workflows/owned-caller-relocation-evidence.yml',
  'pnpm-lock.yaml',
  'packages/core/src/handles.ts',
  'packages/runtime/src/instance/session.ts',
  'packages/runtime/src/kernel/view-operation.ts',
  'packages/adapters/base/src/host/view-epoch-owner.ts',
  'packages/adapters/web-component/src/adapt.ts',
  'packages/adapters/web-component/src/owned-relocation.ts',
];
await writeFile(
  join(out, 'source-receipt.json'),
  JSON.stringify(
    {
      revision,
      tree,
      trackedTreeClean: true,
      sources: await Promise.all(
        boundPaths.map(async (path) => ({ path, sha256: hash(await readFile(path)) }))
      ),
      bundleSha256: hash(await readFile(join(out, 'app.js'))),
    },
    null,
    2
  )
);
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  const file = path === '/' ? 'index.html' : path === '/app.js' ? 'app.js' : null;
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  try {
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(await readFile(join(out, file)));
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const pageErrors = [];
const artifacts = [];
let browser, context, page, observation, failure;
let hasFailure = false;
try {
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
  );
  page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  observation = await page.evaluate(() => window.viewOperationEvidence);
  await writeFile(join(out, 'observations.json'), JSON.stringify(observation, null, 2));
  await page.screenshot({ path: join(out, 'native-cases.png') });
  artifacts.push({
    path: 'native-cases.png',
    sha256: hash(await readFile(join(out, 'native-cases.png'))),
  });
  assert.deepEqual(observation.cases, VIEW_OPERATION_CASES);
  assert.deepEqual(
    observation.results.map((entry) => entry.name),
    VIEW_OPERATION_CASES
  );
  for (const [index, name] of VIEW_OPERATION_CASES.entries()) {
    assertViewOperationCase(observation.results[index], name);
  }
  assert.deepEqual(pageErrors, []);
  assert.equal(git(['status', '--porcelain=v1', '--untracked-files=no']), '');
} catch (error) {
  failure = error;
  hasFailure = true;
  if (page && !observation) {
    try {
      observation = await page.evaluate(() => window.viewOperationEvidence);
    } catch {}
  }
} finally {
  const cleanupErrors = [];
  const cleanup = async (action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(String(error));
      if (!hasFailure) failure = error;
      else console.error('Additional cleanup failure:', error);
      hasFailure = true;
    }
  };
  await cleanup(() => context?.close());
  await cleanup(() => browser?.close());
  await cleanup(
    () =>
      new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  );
  try {
    await writeFile(
      join(out, 'native-result.json'),
      JSON.stringify(
        {
          revision,
          tree,
          pass: !hasFailure,
          failure: hasFailure ? String(failure) : null,
          observation,
          pageErrors,
          cleanupErrors,
          artifacts,
        },
        null,
        2
      )
    );
    for (const path of ['app.js', 'index.html', 'source-receipt.json', 'native-result.json'])
      artifacts.push({ path, sha256: hash(await readFile(join(out, path))) });
    if (observation) {
      await writeFile(join(out, 'observations.json'), JSON.stringify(observation, null, 2));
      artifacts.push({
        path: 'observations.json',
        sha256: hash(await readFile(join(out, 'observations.json'))),
      });
    }
    await writeFile(
      join(out, 'capture-manifest.json'),
      JSON.stringify({ revision, tree, pass: !hasFailure, artifacts }, null, 2)
    );
  } catch (receiptError) {
    if (!hasFailure) failure = receiptError;
    else console.error('Additional evidence-write failure:', receiptError);
    hasFailure = true;
  }
}
if (hasFailure) throw failure;
