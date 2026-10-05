// External diagnostic harness. Never copy this file into the subject checkout.
// Reuses that subject's unmodified supported build/preview/Chrome/test runner.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SUBJECTS = [
  'd6bf13e18dabb6cab223eda2c81d99666baa5930',
  '6ac500aacd53005478043455d2a9c70ccc8b8c16',
];
export const SUITE = 'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts';
export const RUNNER = 'apps/www/scripts/run-search-production-evidence.mjs';
export const CASE =
  'shadcn recovers from HEAD503, searches Button and follows a real documentation result';
export const PATTERN = `(?:^| )Required production Search recovery with generated Pagefind ${CASE}$`;
export const HASHES = {
  [SUITE]: 'a8a37225d605046dce853285b1dac7efa4d65e4b3efaaba719da026ac72e4324',
  [RUNNER]: '45d3b7e54f21716f57ae636c13ee154f9fda557ac5a58cb80249ca87e18a3473',
  'vitest.config.ts': 'd0672188617b551993944435f9cf2f13800b48ff22c2dcda5ba76c8ce236b4c4',
  'pnpm-lock.yaml': 'd9d8ace30875e06c19ff1cf8d80a9045449007727e55058047933b5e4fd93fdd',
};
export function testArguments(args, reportFile) {
  assert.deepEqual(
    args,
    [
      'pnpm@10.32.1',
      'exec',
      'vitest',
      'run',
      '--no-file-parallelism',
      '--maxWorkers=1',
      '--minWorkers=1',
      SUITE,
    ],
    'Unexpected original runner test invocation; review rather than silently adapt'
  );
  return [
    ...args,
    '--testNamePattern',
    PATTERN,
    '--reporter=default',
    '--reporter=json',
    '--outputFile',
    reportFile,
  ];
}
export function testEnvironment(input, output, sha) {
  const env = {};
  // Never forward GitHub tokens, account credentials or unrelated task secrets.
  for (const key of [
    'PATH',
    'HOME',
    'LANG',
    'LC_ALL',
    'TZ',
    'CI',
    'CHROME_PATH',
    'COREPACK_HOME',
    'PNPM_HOME',
    'XDG_CACHE_HOME',
    'TMPDIR',
  ])
    if (input[key] !== undefined) env[key] = input[key];
  return { ...env, CANDIDATE_SHA: sha, RUNNER_TEMP: output, ASTRO_TELEMETRY_DISABLED: '1' };
}
export function browserArguments(args, proxyPort) {
  assert(Number.isInteger(proxyPort) && proxyPort > 0 && proxyPort <= 65535);
  // All project URLs are loopback. Other HTTP(S) requests terminate at the
  // owned local deny proxy; no remote destination is contacted or logged.
  return [
    ...args,
    `--proxy-server=http://127.0.0.1:${proxyPort}`,
    '--proxy-bypass-list=127.0.0.1;localhost;[::1]',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
    '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  ];
}
async function denyExternalBrowserRequests() {
  let attempts = 0;
  const server = createServer((_request, response) => {
    attempts++;
    response.writeHead(403, { Connection: 'close' });
    response.end();
  });
  server.on('connect', (_request, socket) => {
    attempts++;
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    attempts: () => attempts,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
async function digest(filename) {
  return createHash('sha256')
    .update(await readFile(filename))
    .digest('hex');
}
async function sourceReceipt(root, sha) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(
    git('rev-parse', 'HEAD'),
    sha,
    'Subject checkout must be the exact requested commit'
  );
  assert.equal(
    git('status', '--porcelain', '--untracked-files=all'),
    '',
    'Subject must remain clean'
  );
  const files = {};
  for (const [file, expected] of Object.entries(HASHES)) {
    files[file] = await digest(path.join(root, file));
    assert.equal(files[file], expected, `Original source changed: ${file}`);
  }
  return { sha, dirty: false, tree: git('rev-parse', 'HEAD^{tree}'), files };
}
export async function runSingleCase(root, sha, output) {
  assert(/^[a-f0-9]{40}$/.test(sha), 'Subject must be an immutable full commit SHA');
  assert(
    SUBJECTS.includes(sha) || sha === process.env.PROTO_UI_DIAGNOSTIC_CANDIDATE_SHA,
    'Subject must be the fixed parent, original failing candidate, or the exact candidate pinned by this workflow'
  );
  assert.equal(process.platform, 'linux', 'Only the supported Linux CI renderer is in scope');
  assert.equal(process.env.CI, 'true', 'Do not run on the browser/socket-blocked local executor');
  assert(process.env.CHROME_PATH, 'Use the Actions runner-provided Chrome');
  root = await realpath(root);
  await mkdir(output, { recursive: true });
  output = await realpath(output);
  const harness = await realpath(fileURLToPath(import.meta.url));
  for (const external of [output, harness]) {
    const relative = path.relative(root, external);
    assert(
      relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative),
      'Harness and output must be outside the clean subject checkout'
    );
  }
  await mkdir(output, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    kind: 'unchanged-production-search-single-case-comparison',
    scope: CASE,
    startedAt: new Date().toISOString(),
    sourceBefore: await sourceReceipt(root, sha),
    harness: { sha256: await digest(harness), separateFromSubject: true },
    originalOracle:
      'Unmodified Vitest expect.poll default 1000ms and original success predicate; no retry or post-deadline pass conversion',
    browserPolicy:
      'Same local deny proxy and external DNS/QUIC/WebRTC restrictions for both subjects, in addition to the original clean-profile/background-network flags. Original project URLs remain loopback. No OS egress audit claim.',
    result: 'running',
  };
  const receiptFile = path.join(output, 'single-case-receipt.json');
  const reportFile = path.join(output, 'vitest.json');
  await writeFile(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  const { runSearchProductionEvidence } = await import(pathToFileURL(path.join(root, RUNNER)).href);
  let testLaunches = 0;
  const denyProxy = await denyExternalBrowserRequests();
  try {
    await runSearchProductionEvidence(
      { root, env: testEnvironment(process.env, output, sha) },
      {
        spawn(command, args, options) {
          if (args.includes(SUITE)) {
            assert.equal(command, 'corepack');
            assert.equal(++testLaunches, 1, 'No retries or repeated successful sampling');
            return spawn(command, testArguments(args, reportFile), options);
          }
          if (command === process.env.CHROME_PATH)
            return spawn(command, browserArguments(args, denyProxy.port), options);
          return spawn(command, args, options);
        },
      }
    );
    const report = JSON.parse(await readFile(reportFile, 'utf8'));
    const cases = report.testResults.flatMap((result) => result.assertionResults);
    assert.equal(cases.filter((test) => test.status === 'passed').length, 1);
    assert.equal(cases.filter((test) => test.status === 'failed').length, 0);
    assert(cases.some((test) => test.title === CASE && test.status === 'passed'));
    assert.equal(testLaunches, 1);
    receipt.result = 'single-case-passed';
  } catch (error) {
    receipt.result = 'failed';
    // Do not serialize arbitrary error text; the original runner retains its log.
    receipt.failure =
      'Original test, managed-process execution, or harness verification failed. See the source-bound runner log and vitest.json.';
    throw error;
  } finally {
    receipt.externalBrowserRequestsBlocked = denyProxy.attempts();
    await denyProxy.close();
    receipt.finishedAt = new Date().toISOString();
    receipt.testLaunches = testLaunches;
    try {
      receipt.sourceAfter = await sourceReceipt(root, sha);
    } catch (error) {
      receipt.result = 'invalid-source-binding';
      receipt.failure = 'Subject changed during execution';
      await writeFile(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
      throw error;
    }
    await writeFile(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [root, sha, output, ...extra] = process.argv.slice(2);
  assert(
    root && sha && output && extra.length === 0,
    'Usage: node run-single-case.mjs <subject-root> <exact-sha> <external-output-directory>'
  );
  await runSingleCase(root, sha, output);
}
