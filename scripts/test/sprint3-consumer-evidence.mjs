import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const docs = 'apps/www/src/content/docs/zh-cn/';
// This bounded dispatch inventory supplements the existing required checks.
// Counts are complete files, including negative controls; no name filters or bail.
export const SPRINT3_SUITES = Object.freeze([
  {
    id: 'component-repairs',
    file: 'apps/www/test/component-consumer-repairs.browser.test.ts',
    cases: 84,
    surface: 'fixture',
    seconds: 300,
    screenshots: true,
  },
  {
    id: 'transition',
    file: 'packages/compiler/test/transition-native.browser.test.ts',
    cases: 64,
    surface: 'fixture',
    seconds: 600,
    screenshots: true,
  },
  {
    id: 'focus-scope',
    file: 'packages/compiler/test/focus-scope-native.browser.test.ts',
    cases: 22,
    surface: 'fixture',
    seconds: 600,
    screenshots: true,
  },
  {
    id: 'focus-retries',
    file: 'packages/adapters/base/test/focus-intent-retries.browser.test.ts',
    cases: 90,
    surface: 'fixture',
    seconds: 600,
    screenshots: false,
  },
  {
    id: 'focus-react',
    file: 'packages/adapters/react/test/focus-entry-readiness.browser.test.ts',
    cases: 9,
    surface: 'fixture',
    seconds: 240,
    screenshots: false,
  },
  {
    id: 'focus-vue',
    file: 'packages/adapters/vue/test/focus-request-readiness.browser.test.ts',
    cases: 9,
    surface: 'fixture',
    seconds: 240,
    screenshots: false,
  },
  {
    id: 'docs-reading',
    file: 'apps/www/test/release-docs-reading.browser.test.ts',
    cases: 24,
    surface: 'production-docs',
    seconds: 600,
    screenshots: true,
  },
  {
    id: 'public-base-tooltip',
    file: `${docs}demo-base-tooltip.browser.test.ts`,
    cases: 8,
    surface: 'production-docs',
    seconds: 300,
    screenshots: true,
  },
  {
    id: 'public-tooltip-handoff',
    file: `${docs}contrast-tooltip-warm-handoff.browser.test.ts`,
    cases: 20,
    surface: 'production-docs',
    seconds: 480,
    screenshots: false,
  },
  {
    id: 'public-brutalist-controls',
    file: `${docs}demo-brutalist-controls.browser.test.ts`,
    cases: 10,
    surface: 'production-docs',
    seconds: 600,
    screenshots: false,
  },
  {
    id: 'button',
    file: `${docs}demo-brutalist-button.browser.test.ts`,
    cases: 8,
    surface: 'production-docs',
    seconds: 300,
    screenshots: true,
  },
  {
    id: 'select',
    file: `${docs}demo-select-first-paint.browser.test.ts`,
    cases: 3,
    surface: 'production-docs',
    seconds: 300,
    screenshots: true,
  },
  {
    id: 'spinner',
    file: `${docs}demo-brutalist-spinner.browser.test.ts`,
    cases: 11,
    surface: 'production-docs',
    seconds: 300,
    screenshots: true,
  },
  {
    id: 'scroll-corner',
    file: `${docs}scroll-area-corner.browser.test.ts`,
    cases: 2,
    surface: 'production-docs',
    seconds: 480,
    screenshots: true,
  },
]);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const json = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(`${file}.next`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${file}.next`, file);
};
const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();

function sourceState() {
  return {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    worktreeStatus: git('status', '--porcelain', '--untracked-files=normal'),
    lockSha256: hash(readFileSync(path.join(repository, 'pnpm-lock.yaml'))),
    runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  };
}

export function sourceProblems(actual, expected) {
  const problems = [];
  if (!/^[a-f0-9]{40}$/.test(expected.head ?? '') || actual.head !== expected.head)
    problems.push('Checkout does not match the exact candidate SHA.');
  if (actual.worktreeStatus) problems.push('Candidate checkout is dirty.');
  for (const key of ['tree', 'lockSha256', 'runnerSha256'])
    if (expected[key] && actual[key] !== expected[key]) problems.push(`Source drift: ${key}.`);
  return problems;
}

export function vitestProblems(report, expectedCases, expectedFile) {
  if (!report || typeof report !== 'object') return ['Missing or invalid Vitest JSON.'];
  const problems = [];
  for (const [key, expected] of [
    ['numTotalTests', expectedCases],
    ['numPassedTests', expectedCases],
    ['numFailedTests', 0],
    ['numPendingTests', 0],
    ['numTodoTests', 0],
  ]) {
    // Older reporters may omit the todo counter; the assertions below still
    // reject todo/skipped cases. Total, pass, failed and pending are required.
    if (key === 'numTodoTests' && report[key] === undefined) continue;
    if (report[key] !== expected)
      problems.push(`${key}: expected ${expected}, received ${report[key]}.`);
  }
  if (report.success !== true) problems.push('Vitest did not report success.');
  const files = report.testResults;
  if (!Array.isArray(files) || files.length !== 1)
    problems.push('Expected one complete suite report.');
  if (
    expectedFile &&
    (!Array.isArray(files) ||
      files.length !== 1 ||
      !String(files[0].name ?? '')
        .replaceAll('\\', '/')
        .endsWith(`/${expectedFile}`))
  )
    problems.push('Vitest reported a different source file.');
  const cases = Array.isArray(files)
    ? files.flatMap((file) => (Array.isArray(file.assertionResults) ? file.assertionResults : []))
    : [];
  if (cases.length !== expectedCases || cases.some((entry) => entry.status !== 'passed'))
    problems.push('The complete case inventory did not pass.');
  return problems;
}

export function finishIncomplete(ledger, reason) {
  for (const row of ledger.suites)
    if (['not-run', 'running'].includes(row.status)) {
      row.status = row.status === 'running' ? 'interrupted' : 'blocked';
      row.reason = reason;
      row.finishedAt = now();
    }
  return ledger;
}

function inspectInventory(directory) {
  const files = [];
  const errors = [];
  try {
    if (canonicalPath(directory) !== path.resolve(directory))
      throw new Error(`Evidence directory has a symbolic-link ancestor: ${directory}`);
  } catch (error) {
    return { files, errors: [String(error)] };
  }
  const visit = (file) => {
    try {
      const stat = lstatSync(file, { throwIfNoEntry: false });
      if (!stat) return;
      if (stat.isSymbolicLink()) throw new Error(`Evidence cannot follow a symbolic link: ${file}`);
      if (stat.isDirectory()) {
        for (const name of readdirSync(file).sort()) visit(path.join(file, name));
      } else if (stat.isFile()) {
        const bytes = readFileSync(file);
        files.push({
          file: path.relative(directory, file).replaceAll(path.sep, '/'),
          bytes: bytes.length,
          sha256: hash(bytes),
        });
      } else throw new Error(`Unsupported evidence entry: ${file}`);
    } catch (error) {
      errors.push(`${file}: ${String(error)}`);
    }
  };
  visit(directory);
  return { files, errors };
}

function fileInventory(directory) {
  const observed = inspectInventory(directory);
  if (observed.errors.length) throw new Error(observed.errors.join('\n'));
  return observed.files;
}

/** One owned process group. Deadlines are resource limits, never interaction thresholds. */
export async function runCommand(
  command,
  args,
  { cwd, env, log, timeoutMs, signal, quiet = false }
) {
  const started = Date.now();
  const fd = openSync(log, 'wx');
  let stopReason = null;
  let ioError = null;
  let spawnError = null;
  let killTimer;
  let timer;
  let child;
  const stop = (reason) => {
    if (stopReason) return;
    stopReason = reason;
    const kill = (name) => {
      if (!child?.pid) return;
      try {
        process.kill(-child.pid, name);
      } catch (error) {
        if (error.code !== 'ESRCH') ioError ??= String(error);
      }
    };
    kill('SIGTERM');
    killTimer = setTimeout(() => kill('SIGKILL'), 5_000);
  };
  const abort = () => stop('interrupted');
  const record = (bytes) => {
    try {
      writeSync(fd, bytes);
    } catch (error) {
      ioError ??= String(error);
      stop('evidence-io-failure');
    }
    if (!quiet) process.stdout.write(bytes);
  };
  try {
    if (signal?.aborted)
      return { exitCode: null, signal: null, stopReason: 'interrupted', elapsedMs: 0 };
    return await new Promise((resolve) => {
      child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', record);
      child.stderr.on('data', record);
      child.on('error', (error) => {
        spawnError = String(error);
      });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => stop('resource-deadline'), timeoutMs);
      child.once('close', (exitCode, childSignal) => {
        resolve({
          exitCode,
          signal: childSignal,
          stopReason,
          spawnError,
          ioError,
          elapsedMs: Date.now() - started,
        });
      });
    });
  } finally {
    clearTimeout(timer);
    clearTimeout(killTimer);
    if (stopReason && child?.pid) {
      // A terminated launcher can close its pipes before a descendant responds.
      // Retire the owned group before starting the next heavy suite.
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') ioError ??= String(error);
      }
    }
    signal?.removeEventListener('abort', abort);
    closeSync(fd);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

/** The listener and static build belong to this runner, with no caller-supplied URL. */
export async function startOwnedPreview(directory, head, log) {
  const root = path.resolve(directory);
  let ioError = null;
  const server = createServer((request, response) => {
    let status = 500;
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        status = 405;
        return response.writeHead(status).end();
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
        status = 403;
        return response.writeHead(status).end();
      }
      if (existsSync(file) && lstatSync(file).isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          status = 301;
          return response.writeHead(status, { Location: `${url.pathname}/${url.search}` }).end();
        }
        file = path.join(file, 'index.html');
      }
      if (!existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) {
        status = 404;
        return response.writeHead(status).end();
      }
      const bytes = readFileSync(file);
      status = 200;
      response.writeHead(status, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': bytes.length,
        'Cache-Control': 'no-store',
        'X-Proto-UI-Evidence-Source': head,
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      status = 500;
      if (!response.headersSent) response.writeHead(status);
      response.end();
      ioError ??= String(error);
    } finally {
      try {
        appendFileSync(
          log,
          `${JSON.stringify({ at: now(), method: request.method, url: request.url, status })}\n`
        );
      } catch (error) {
        ioError ??= String(error);
      }
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
      if (ioError) throw new Error(`Owned preview evidence failure: ${ioError}`);
    },
  };
}

// Match the rehearsal runner's existing-ancestor boundary. Resolve symlinks
// before creating a not-yet-existing child, including ignored checkout paths.
function canonicalPath(value) {
  let ancestor = path.resolve(value);
  const remaining = [];
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
    remaining.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  return path.resolve(realpathSync(ancestor), ...remaining);
}

export function resolveEvidenceDirectory(value, sourceRoot = repository) {
  const root = canonicalPath(sourceRoot);
  const output = canonicalPath(value);
  const relative = path.relative(root, output);
  if (
    !relative ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  )
    throw new Error('Evidence must stay outside the source checkout.');
  return output;
}

function outputDirectory() {
  if (!process.env.SPRINT3_EVIDENCE_DIR)
    throw new Error('Set SPRINT3_EVIDENCE_DIR to a fresh directory outside the checkout.');
  const output = resolveEvidenceDirectory(process.env.SPRINT3_EVIDENCE_DIR);
  mkdirSync(output, { recursive: true });
  return output;
}

function initialize(output) {
  const file = path.join(output, 'results.json');
  if (existsSync(file))
    throw new Error(
      'Refusing to overwrite an earlier Sprint 3 receipt. Use a new evidence directory.'
    );
  const source = sourceState();
  const expectedHead = process.env.CANDIDATE_SHA ?? process.env.GITHUB_SHA;
  const ledger = {
    schemaVersion: 1,
    startedAt: now(),
    expectedHead,
    source,
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    },
    limits: [
      'Current-source fixtures and production documentation, not an installed external application.',
      'Native Chromium and browser AX observations do not certify OS assistive technology or physical mobile devices.',
      'This bounded inventory does not replace historical #1042/#1175, non-Web criteria, the whitepaper workflow, or a full repository regression cycle.',
      'Preparation and process deadlines are resource limits; the original input, phase and interaction assertions are unchanged.',
    ],
    errors: sourceProblems(source, { head: expectedHead }),
    build: { status: 'not-run' },
    suites: SPRINT3_SUITES.map((suite) => ({
      ...suite,
      status: 'not-run',
      sourceSha256: existsSync(path.join(repository, suite.file))
        ? hash(readFileSync(path.join(repository, suite.file)))
        : null,
    })),
  };
  json(file, ledger);
  if (ledger.errors.length) throw new Error(ledger.errors.join('\n'));
  return ledger;
}

async function execute(output, ledger) {
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on('SIGTERM', interrupt);
  process.on('SIGINT', interrupt);
  // Leave the dispatch job time to finalize and upload even on resource exhaustion.
  const deadline = Date.now() + 45 * 60_000;
  const save = () => json(path.join(output, 'results.json'), ledger);
  const budget = (seconds) => Math.max(1, Math.min(seconds * 1_000, deadline - Date.now()));
  const unavailable = () =>
    abort.signal.aborted
      ? 'Runner interrupted.'
      : Date.now() >= deadline
        ? 'Runner resource deadline exhausted.'
        : null;
  const verifySource = () => {
    const problems = sourceProblems(sourceState(), { ...ledger.source, head: ledger.expectedHead });
    if (problems.length) throw new Error(problems.join('\n'));
  };
  let preview;
  let buildManifest;
  try {
    verifySource();
    if (process.versions.node.split('.')[0] !== '24')
      throw new Error('Sprint 3 evidence requires Node.js 24.');
    if (!process.env.CHROME_PATH)
      throw new Error('Identify the browser through CHROME_PATH before execution.');
    ledger.environment.chromePath = process.env.CHROME_PATH;
    ledger.environment.chromeVersion = execFileSync(process.env.CHROME_PATH, ['--version'], {
      encoding: 'utf8',
    }).trim();
    ledger.environment.pnpmVersion = execFileSync('corepack', ['pnpm@10.32.1', '--version'], {
      encoding: 'utf8',
    }).trim();
    if (ledger.environment.pnpmVersion !== '10.32.1') throw new Error('Unexpected pnpm version.');
    save();

    const suite = async (row) => {
      const missing = unavailable();
      if (missing) {
        row.status = 'blocked';
        row.reason = missing;
        save();
        return;
      }
      verifySource();
      const directory = path.join(output, row.id);
      const captures = path.join(directory, 'captures');
      mkdirSync(captures, { recursive: true });
      row.startedAt = now();
      row.status = 'running';
      save();
      try {
        if (!row.sourceSha256) throw new Error(`Missing planned suite: ${row.file}`);
        const env = {
          ...process.env,
          CANDIDATE_SHA: ledger.expectedHead,
          PROTO_UI_RUNTIME_EVIDENCE_DIR: captures,
          PROTO_UI_BROWSER_EVIDENCE_DIR: path.join(captures, 'button'),
          PROTO_UI_SCROLL_CORNER_EVIDENCE_DIR: path.join(captures, 'scroll-corner'),
          PROTO_UI_SCROLL_CORNER_HARNESS_SHA: ledger.expectedHead,
          COMPILER_FOCUS_NATIVE_EVIDENCE_DIR: path.join(captures, 'focus-scope'),
        };
        delete env.PROTO_UI_SPINNER_BROWSER_RUNTIME;
        delete env.PROTO_UI_SCROLL_CORNER_CAPTURE_ONLY;
        delete env.PROTO_UI_BROWSER_BASE_URL;
        if (row.surface === 'production-docs') env.PROTO_UI_BROWSER_BASE_URL = preview.url;
        json(path.join(directory, 'source.json'), {
          ...ledger.source,
          suite: row.file,
          suiteSha256: row.sourceSha256,
          surface: row.surface,
          preview: row.surface === 'production-docs' ? ledger.preview : null,
        });
        row.sourceReceiptSha256 = hash(readFileSync(path.join(directory, 'source.json')));
        const reportFile = path.join(directory, 'vitest.json');
        const args = [
          'pnpm@10.32.1',
          'exec',
          'vitest',
          'run',
          row.file,
          '--maxWorkers=1',
          '--minWorkers=1',
          '--no-file-parallelism',
          '--reporter=default',
          '--reporter=json',
          `--outputFile=${reportFile}`,
        ];
        row.command = ['corepack', ...args];
        row.process = await runCommand('corepack', args, {
          cwd: repository,
          env,
          log: path.join(directory, 'browser.log'),
          timeoutMs: budget(row.seconds),
          signal: abort.signal,
        });
        const problems = [];
        if (
          row.process.exitCode !== 0 ||
          row.process.stopReason ||
          row.process.spawnError ||
          row.process.ioError
        )
          problems.push(
            `Suite process did not complete successfully: ${JSON.stringify(row.process)}.`
          );
        let report;
        try {
          const bytes = readFileSync(reportFile);
          row.reportSha256 = hash(bytes);
          report = JSON.parse(bytes.toString('utf8'));
        } catch (error) {
          problems.push(`Vitest report unavailable: ${String(error)}.`);
        }
        row.logSha256 = hash(readFileSync(path.join(directory, 'browser.log')));
        problems.push(...vitestProblems(report, row.cases, row.file));
        row.artifacts = fileInventory(captures);
        row.screenshotCount = row.artifacts.filter((entry) => entry.file.endsWith('.png')).length;
        if (row.screenshots && row.screenshotCount === 0)
          problems.push('Expected native visual evidence was not produced.');
        row.visualEvidence = row.screenshotCount
          ? 'captured'
          : 'none-produced; see native state/assertion JSON and logs';
        row.problems = problems;
        row.status =
          row.process.stopReason === 'interrupted'
            ? 'interrupted'
            : problems.length
              ? 'failed'
              : 'passed';
      } catch (error) {
        row.status = 'failed';
        row.reason = String(error);
      } finally {
        row.finishedAt = now();
        json(path.join(directory, 'result.json'), row);
        save();
      }
      verifySource();
    };

    for (const row of ledger.suites.filter((entry) => entry.surface === 'fixture'))
      await suite(row);

    if (!unavailable()) {
      verifySource();
      ledger.build = { status: 'running', startedAt: now() };
      save();
      const result = await runCommand('corepack', ['pnpm@10.32.1', 'docs:build'], {
        cwd: repository,
        env: process.env,
        log: path.join(output, 'build.log'),
        timeoutMs: budget(600),
        signal: abort.signal,
      });
      ledger.build = {
        ...ledger.build,
        process: result,
        finishedAt: now(),
        status:
          result.exitCode === 0 && !result.stopReason && !result.ioError && !result.spawnError
            ? 'passed'
            : 'failed',
      };
      save();
      verifySource();
      if (ledger.build.status === 'passed') {
        const dist = path.join(repository, 'apps/www/dist');
        buildManifest = fileInventory(dist);
        if (!buildManifest.length) throw new Error('The production build emitted no files.');
        json(path.join(output, 'dist-files.json'), buildManifest);
        ledger.build.distManifestSha256 = hash(JSON.stringify(buildManifest));
        preview = await startOwnedPreview(
          dist,
          ledger.expectedHead,
          path.join(output, 'preview-requests.jsonl')
        );
        const probePath = '/en/ui-libraries/base/button/';
        const response = await fetch(`${preview.url}${probePath}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const actual = hash(Buffer.from(await response.arrayBuffer()));
        const expected = hash(readFileSync(path.join(dist, probePath, 'index.html')));
        if (response.status !== 200 || actual !== expected)
          throw new Error('Owned preview did not serve the exact emitted HTML.');
        ledger.preview = {
          owner: 'this Node.js runner; exclusive loopback listener',
          url: preview.url,
          head: ledger.expectedHead,
          probePath,
          probeSha256: actual,
          distManifestSha256: ledger.build.distManifestSha256,
        };
        save();
        for (const row of ledger.suites.filter((entry) => entry.surface === 'production-docs'))
          await suite(row);
        if (hash(JSON.stringify(fileInventory(dist))) !== ledger.build.distManifestSha256)
          throw new Error('Production output changed during browser execution.');
      }
    }
  } catch (error) {
    ledger.errors.push(String(error));
  } finally {
    try {
      await preview?.close();
    } catch (error) {
      ledger.errors.push(String(error));
    }
    try {
      verifySource();
    } catch (error) {
      ledger.errors.push(String(error));
    }
    finishIncomplete(
      ledger,
      unavailable() ??
        (ledger.errors.length
          ? 'A recorded runner prerequisite failed.'
          : 'The production build did not pass.')
    );
    if (['running', 'not-run'].includes(ledger.build.status)) ledger.build.status = 'blocked';
    ledger.finishedAt = now();
    save();
    process.removeListener('SIGTERM', interrupt);
    process.removeListener('SIGINT', interrupt);
  }
}

export function finalize(output, ledger, publishSummary = false, readSource = sourceState) {
  // A crash or an unreadable capture during final reconciliation must never
  // leave the earlier successful aggregate as the last readable receipt.
  ledger.status = 'failed';
  ledger.finalization = { status: 'running', startedAt: now() };
  json(path.join(output, 'results.json'), ledger);
  finishIncomplete(
    ledger,
    'Workflow ended before this suite produced a terminal receipt; inspect workflow-steps.json.'
  );
  if (['not-run', 'running'].includes(ledger.build.status)) ledger.build.status = 'blocked';
  if (process.env.WORKFLOW_STEP_OUTCOMES) {
    try {
      json(
        path.join(output, 'workflow-steps.json'),
        JSON.parse(process.env.WORKFLOW_STEP_OUTCOMES)
      );
    } catch (error) {
      ledger.errors.push(`Workflow receipt I/O failure: ${String(error)}`);
    }
  }
  try {
    ledger.errors.push(
      ...sourceProblems(readSource(), { ...ledger.source, head: ledger.expectedHead })
    );
  } catch (error) {
    ledger.errors.push(String(error));
  }
  for (const row of ledger.suites) {
    row.executionStatus ??= row.status;
    const directory = path.join(output, row.id);
    const observed = inspectInventory(path.join(directory, 'captures'));
    const problems = [...observed.errors];
    let directoryOwned = false;
    try {
      directoryOwned = canonicalPath(directory) === path.resolve(directory);
      if (!directoryOwned) problems.push('Suite evidence directory has a symbolic-link ancestor.');
    } catch (error) {
      problems.push(`Suite directory unavailable: ${String(error)}`);
    }
    // Keep the first executed inventory immutable. Partial/interrupted capture
    // observations are also retained, but cannot become an execution receipt.
    row.observedArtifacts = observed.files;
    if (row.artifacts) {
      if (JSON.stringify(row.artifacts) !== JSON.stringify(observed.files))
        problems.push(
          'Capture inventory drifted after execution (missing, added, or changed bytes).'
        );
    } else if (row.executionStatus === 'passed')
      problems.push('Executed capture inventory is missing.');
    row.screenshotCount = observed.files.filter((entry) => entry.file.endsWith('.png')).length;
    if (row.executionStatus === 'passed' && row.screenshots && row.screenshotCount === 0)
      problems.push('Required native screenshots are missing.');
    for (const [name, key] of [
      ['vitest.json', 'reportSha256'],
      ['browser.log', 'logSha256'],
      ['source.json', 'sourceReceiptSha256'],
    ]) {
      if (!directoryOwned) continue;
      if (!row[key] && row.executionStatus !== 'passed') continue;
      try {
        const file = path.join(directory, name);
        const stat = lstatSync(file);
        if (stat.isSymbolicLink() || !stat.isFile())
          throw new Error('Expected an owned regular receipt file.');
        const actual = hash(readFileSync(file));
        row[`observed${key[0].toUpperCase()}${key.slice(1)}`] = actual;
        if (!row[key] || actual !== row[key])
          problems.push(`${name} hash drifted after execution.`);
      } catch (error) {
        problems.push(`${name} unavailable during finalization: ${String(error)}`);
      }
    }
    row.evidenceProblems = [...new Set([...(row.evidenceProblems ?? []), ...problems])];
    if (row.evidenceProblems.length) {
      row.status = 'failed';
      ledger.errors.push(`${row.id} evidence integrity failed: ${row.evidenceProblems.join(' ')}`);
    }
    row.visualEvidence = row.screenshotCount
      ? 'captured'
      : 'none-produced; see native state/assertion JSON and logs';
    try {
      if (!directoryOwned) throw new Error('Refusing to write through a suite directory alias.');
      json(path.join(directory, 'result.json'), row);
    } catch (error) {
      row.status = 'failed';
      ledger.errors.push(`${row.id} result receipt I/O failure: ${String(error)}`);
    }
  }
  const outcome = () =>
    ledger.errors.length === 0 &&
    ledger.build.status === 'passed' &&
    ledger.suites.every((row) => row.status === 'passed')
      ? 'passed'
      : 'failed';
  ledger.status = outcome();
  const summary = [
    `## Sprint 3 consumer evidence: ${ledger.status}`,
    '',
    `Candidate: \`${ledger.expectedHead}\``,
    '',
    '| Suite | Expected cases | Outcome | Screenshots |',
    '|---|---:|---|---:|',
    ...ledger.suites.map(
      (row) =>
        `| ${row.id} | ${row.cases} | ${row.status} | ${row.screenshotCount ?? 'not observed'} |`
    ),
    '',
    `Production build: ${ledger.build.status}.`,
    '',
    ...ledger.limits.map((limit) => `- ${limit}`),
    '',
    ...ledger.errors.map((error) => `- Runner failure: ${error.replaceAll('\n', ' ')}`),
    '',
  ].join('\n');
  try {
    writeFileSync(path.join(output, 'summary.md'), summary);
    if (publishSummary && process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  } catch (error) {
    ledger.errors.push(`Summary receipt I/O failure: ${String(error)}`);
  }
  ledger.errors = [...new Set(ledger.errors)];
  ledger.status = outcome();
  ledger.finalizedAt = now();
  ledger.finalization = {
    ...ledger.finalization,
    status: 'complete',
    finishedAt: ledger.finalizedAt,
  };
  json(path.join(output, 'results.json'), ledger);
  return ledger.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const operation = process.argv[2];
    if (!['init', 'run', 'finalize'].includes(operation))
      throw new Error('Usage: node scripts/test/sprint3-consumer-evidence.mjs init|run|finalize');
    const output = outputDirectory();
    const ledger =
      operation === 'init'
        ? initialize(output)
        : JSON.parse(readFileSync(path.join(output, 'results.json'), 'utf8'));
    if (operation === 'run') await execute(output, ledger);
    if (operation !== 'init') process.exitCode = finalize(output, ledger, operation === 'finalize');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
