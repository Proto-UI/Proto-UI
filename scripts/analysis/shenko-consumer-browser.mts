import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the real pinned application's normal bundle with its explicit fixture-data
// route. This neither substitutes a renderer nor claims its live model journey.
const root = fileURLToPath(new URL('../../', import.meta.url));
assert.ok(
  process.env.PUI_SHENKO_SOURCE,
  'PUI_SHENKO_SOURCE must name the isolated Shenko checkout'
);
const application = path.resolve(process.env.PUI_SHENKO_SOURCE);
const evidence = path.resolve(process.env.PUI_EVIDENCE_DIR ?? '.cache/sprint5/shenko');
const web = path.join(application, 'crates/shenko-ui/web');
const assets = path.join(application, 'crates/shenko-ui/src/static');
const revision = (directory: string) =>
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
const git = (directory: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30_000,
    // The normal application assets exceed Node's default 1 MiB diff buffer.
    maxBuffer: 32 * 1024 * 1024,
  });
const paths = (value: string) => value.split('\0').filter(Boolean);
async function sourceTree(directory: string): Promise<string> {
  const files: string[] = [];
  async function visit(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  await visit(directory);
  const hash = createHash('sha256');
  for (const file of files.sort())
    hash.update(
      `${path.relative(directory, file).split(path.sep).join('/')}\0${sha256(await readFile(file))}\n`
    );
  return hash.digest('hex');
}
const require = createRequire(path.join(root, 'apps/www/package.json'));
const { chromium } = require('playwright-core');
await mkdir(evidence, { recursive: true });
const report: any = {
  kind: 'shenko-actual-application-consumer-v1',
  capturedAt: new Date().toISOString(),
  compilerHead: revision(root),
  compilerTree: git(root, 'rev-parse', 'HEAD^{tree}').trim(),
  applicationHead: revision(application),
  observerSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  boundary:
    'Real Shenko application and generated React components; explicit demo-controller data. No live backend/model, replay, OS input hardware or assistive-technology acceptance.',
  cases: [],
};
let browser: any;
let page: any;
const errors: string[] = [];
const sockets: string[] = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname);
    let file: string;
    if (pathname === '/') file = path.join(application, 'crates/shenko-ui/src/index.html');
    else if (pathname.startsWith('/assets/')) {
      file = path.resolve(assets, pathname.slice('/assets/'.length));
      const relative = path.relative(assets, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('outside assets');
    } else {
      response.writeHead(404).end();
      return;
    }
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
    };
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
    });
    response.end(await readFile(file));
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end();
  }
});

async function step(name: string, run: () => Promise<void>) {
  const started = performance.now();
  try {
    await run();
    report.cases.push({
      name,
      status: 'passed',
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    report.cases.push({ name, status: 'failed', error: String(error) });
    await page?.screenshot({ path: path.join(evidence, `${name}-failure.png`) }).catch(() => {});
  }
}

try {
  assert.equal(report.applicationHead, 'f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42');
  const pin = await readJson(path.join(web, 'upstream-pin.json'));
  const generation = await readJson(path.join(web, 'generated/prototypes/manifest.json'));
  const manifest = await readJson(path.join(assets, 'build-manifest.json'));
  assert.deepEqual(
    paths(git(root, 'diff', '--name-only', '-z', 'HEAD')),
    [],
    'compiler tracked source must be clean for an exact-head consumer receipt'
  );
  assert.deepEqual(
    paths(
      git(
        root,
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        'packages',
        'scripts/compiler'
      )
    ),
    [],
    'untracked compiler or package inputs cannot be attributed to the published head'
  );
  assert.equal(
    pin.commit,
    report.compilerHead,
    'the isolated candidate pin must bind this compiler'
  );
  assert.equal(manifest.upstream.commit, report.compilerHead);
  const lock = sha256(await readFile(path.join(root, 'pnpm-lock.yaml')));
  assert.equal(pin.lock_sha256, lock);
  assert.equal(manifest.upstream.lock_sha256, lock);
  assert.equal(
    generation.source_tree_sha256,
    await sourceTree(path.join(root, 'packages/compiler/src'))
  );
  for (const key of [
    'status',
    'runtime_imported',
    'profile',
    'package',
    'package_sha256',
    'entry',
    'entry_sha256',
    'source_tree_sha256',
    'typescript',
    'bundle',
    'resolutions',
    'prototypes',
  ])
    assert.deepEqual(
      generation[key],
      manifest.compiler[key],
      `generation and actual application bundle disagree on ${key}`
    );
  assert.equal(generation.entry_sha256, sha256(await readFile(path.join(root, generation.entry))));
  assert.equal(
    generation.package_sha256,
    sha256(await readFile(path.join(root, generation.package, 'package.json')))
  );
  assert.equal(
    generation.bundle.sha256,
    sha256(await readFile(path.join(web, generation.bundle.path)))
  );
  for (const prototype of generation.prototypes) {
    for (const [file, expected] of [
      [prototype.entry, prototype.entry_sha256],
      [prototype.generated_source, prototype.generated_sha256],
      [prototype.provenance, prototype.provenance_sha256],
    ])
      assert.equal(sha256(await readFile(path.join(web, file))), expected, file);
  }
  const staticPrefix = 'crates/shenko-ui/src/static/';
  const allowedApplicationChanges = new Set([
    'crates/shenko-ui/web/upstream-pin.json',
    `${staticPrefix}build-manifest.json`,
    ...Object.keys(manifest.artifacts).map((file) => staticPrefix + file),
    ...paths(git(application, 'ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', staticPrefix)),
  ]);
  const applicationChanges = [
    ...new Set([
      ...paths(git(application, 'diff', '--name-only', '-z', 'HEAD')),
      ...paths(git(application, 'ls-files', '--others', '--exclude-standard', '-z')),
    ]),
  ].sort();
  assert.deepEqual(
    applicationChanges.filter((file) => !allowedApplicationChanges.has(file)),
    [],
    'only the explicit candidate pin and normal hashed application build outputs may differ'
  );
  report.applicationChanges = applicationChanges;
  report.applicationDiffSha256 = sha256(git(application, 'diff', '--binary', 'HEAD'));
  assert.deepEqual(manifest.realisation.compiled, ['transport-badge', 'message-bubble']);
  assert.equal(manifest.realisation.adapter.length, 9);
  assert.equal(generation.runtime_imported, false);
  for (const [file, artifact] of Object.entries(manifest.artifacts) as [string, any][]) {
    assert.equal(sha256(await readFile(path.join(assets, file))), artifact.sha256, file);
  }
  report.pin = pin;
  report.generation = generation;
  report.buildManifestSha256 = sha256(await readFile(path.join(assets, 'build-manifest.json')));
  await writeFile(
    path.join(evidence, 'build-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/?demo=1&theme=light`;
  browser = await chromium.launch({
    executablePath: process.env.PUI_CHROME_EXECUTABLE ?? '/usr/bin/chromium',
    headless: true,
    chromiumSandbox: true,
  });
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('websocket', (socket: any) => sockets.push(socket.url()));
  page.setDefaultTimeout(15_000);
  await page.goto(url, { waitUntil: 'networkidle' });
  await step('compiled-badge-and-native-react-slot-content', async () => {
    await page.locator('.shell[data-source="demo"]').waitFor();
    await page.locator('[data-pui-style~="shenko-status-chip"]').waitFor();
    assert.equal(
      await page.locator('[data-pui-style~="shenko-status-chip"]').innerText(),
      '本地模拟'
    );
    await page.locator('[data-pui-style~="shenko-bubble"]').first().waitFor();
    assert.ok((await page.locator('[data-pui-style~="shenko-bubble"]').count()) > 1);
    assert.ok(
      (await page.locator('[data-pui-style~="shenko-bubble"]').first().innerText()).trim().length >
        0
    );
    assert.ok(
      (await page
        .locator(
          '[data-pui-style~="shenko-bubble"] .bubble-text, [data-pui-style~="shenko-bubble"] .md'
        )
        .count()) > 0
    );
    await page.screenshot({ path: path.join(evidence, 'shenko-chat-light.png') });
  });
  await step('real-adapter-theme-action-retains-compiled-root-node', async () => {
    const badge = await page.locator('[data-pui-style~="shenko-status-chip"]').elementHandle();
    assert.ok(badge);
    await page.getByRole('button', { name: '切换到深色', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await badge.evaluate((element: HTMLElement) => element.isConnected), true);
    assert.equal(
      await page.locator('[data-pui-style~="shenko-status-chip"]').innerText(),
      '本地模拟'
    );
    await page.screenshot({ path: path.join(evidence, 'shenko-chat-dark.png') });
  });
  await step('real-thread-selection-replaces-bubbles-and-keeps-native-children', async () => {
    const old = await page.locator('[data-pui-style~="shenko-bubble"]').first().elementHandle();
    const title = await page.locator('.im-thread').getAttribute('aria-label');
    assert.ok((await page.locator('.im-list .im-row').count()) > 1);
    await page.locator('.im-list .im-row').nth(1).click();
    await page.waitForFunction(
      (previous: string) =>
        document.querySelector('.im-thread')?.getAttribute('aria-label') !== previous,
      title
    );
    assert.equal(await old.evaluate((element: HTMLElement) => element.isConnected), false);
    await page.locator('[data-pui-style~="shenko-bubble"]').first().waitFor();
    assert.ok(
      (await page.locator('[data-pui-style~="shenko-bubble"]').first().innerText()).trim().length >
        0
    );
  });
  await step('real-view-navigation-removes-and-restores-compiled-roots', async () => {
    const old = await page.locator('[data-pui-style~="shenko-bubble"]').first().elementHandle();
    const badge = await page.locator('[data-pui-style~="shenko-status-chip"]').elementHandle();
    await page.locator('.topbar .tabs').getByText('Inspect', { exact: true }).click();
    await page.locator('.stream[data-tab="inspect"]').waitFor();
    assert.equal(await old.evaluate((element: HTMLElement) => element.isConnected), false);
    assert.equal(await badge.evaluate((element: HTMLElement) => element.isConnected), true);
    await page.locator('.topbar .tabs').getByText('对话', { exact: true }).click();
    await page
      .locator('.stream[data-tab="im"] [data-pui-style~="shenko-bubble"]')
      .first()
      .waitFor();
    await page.screenshot({ path: path.join(evidence, 'shenko-returned-chat.png') });
  });
  await step('synthetic-pagehide-invokes-actual-application-disposal', async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForFunction(() => document.querySelector('#app')?.childElementCount === 0);
  });
  assert.deepEqual(sockets, [], 'the explicit demo route must not start the live controller');
  assert.deepEqual(errors, [], 'the actual application must not raise browser exceptions');
  assert.equal(revision(root), report.compilerHead, 'compiler revision changed during observation');
  assert.equal(
    revision(application),
    report.applicationHead,
    'application revision changed during observation'
  );
  assert.deepEqual(
    paths(git(root, 'diff', '--name-only', '-z', 'HEAD')),
    [],
    'compiler source changed during observation'
  );
  assert.equal(
    await sourceTree(path.join(root, 'packages/compiler/src')),
    generation.source_tree_sha256
  );
  assert.equal(
    sha256(await readFile(path.join(assets, 'build-manifest.json'))),
    report.buildManifestSha256
  );
  assert.equal(sha256(git(application, 'diff', '--binary', 'HEAD')), report.applicationDiffSha256);
  for (const [file, artifact] of Object.entries(manifest.artifacts) as [string, any][])
    assert.equal(
      sha256(await readFile(path.join(assets, file))),
      artifact.sha256,
      `artifact changed during observation: ${file}`
    );
} catch (error) {
  report.failure = String(error);
  await page
    ?.screenshot({ path: path.join(evidence, 'startup-or-terminal-failure.png') })
    .catch(() => {});
} finally {
  report.pageErrors = errors;
  report.webSockets = sockets;
  const cleanupErrors: string[] = [];
  try {
    await browser?.close();
  } catch (error) {
    cleanupErrors.push(`browser: ${String(error)}`);
  }
  try {
    if (server.listening)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
  } catch (error) {
    cleanupErrors.push(`server: ${String(error)}`);
  }
  report.cleanupErrors = cleanupErrors;
  report.passed =
    !report.failure &&
    errors.length === 0 &&
    sockets.length === 0 &&
    cleanupErrors.length === 0 &&
    report.cases.length === 5 &&
    report.cases.every((item: any) => item.status === 'passed');
  await writeFile(path.join(evidence, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        compilerHead: report.compilerHead,
        applicationHead: report.applicationHead,
        passed: report.passed,
        cases: report.cases,
        failure: report.failure,
      },
      null,
      2
    )
  );
  if (!report.passed) process.exitCode = 1;
}
