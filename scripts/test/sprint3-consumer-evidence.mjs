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
import {
  SOURCE_CANARY_SUITE,
  SOURCE_STOP_BUDGET_MS,
  createOwnedSourceServer,
  inspectSourceCanary,
  sourceServerHash,
  suiteOrigins,
} from './sprint3-source-server.mjs';

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

// Profiles are separate acceptance inventories. The Runtime/Adapter default has
// 12 files / 278 cases after compiler retirement; public Base Select stays separate.
const BASE_SELECT_SUITES = Object.freeze([
  Object.freeze({
    id: 'public-base-select',
    file: `${docs}demo-base-select.browser.test.ts`,
    cases: 8,
    surface: 'production-docs',
    seconds: 900,
    screenshots: true,
  }),
]);
const SPRINT3_PROFILES = Object.freeze({
  default: Object.freeze({
    id: 'default',
    suites: SPRINT3_SUITES,
    probePath: '/en/ui-libraries/base/button/',
  }),
  'base-select': Object.freeze({
    id: 'base-select',
    suites: BASE_SELECT_SUITES,
    probePath: '/en/ui-libraries/base/select/',
  }),
});
const SUITE_PLAN_FIELDS = ['id', 'file', 'cases', 'surface', 'seconds', 'screenshots'];
const SELECT_CAPTURE_CASES = Object.freeze(
  ['en', 'zh-cn'].flatMap((locale) =>
    ['wc', 'react', 'vue', 'vue2'].map((runtime) => ({
      stem: `base-select-${locale}-${runtime}`,
      route: `/${locale}/ui-libraries/base/select/`,
      runtime,
    }))
  )
);

export function sprint3Profile(id = 'default') {
  if (typeof id !== 'string' || !Object.hasOwn(SPRINT3_PROFILES, id))
    throw new Error(`Unknown Sprint 3 evidence profile: ${String(id)}.`);
  return SPRINT3_PROFILES[id];
}

export function parseEvidenceProfile(args) {
  if (args.length === 0) return sprint3Profile();
  if (args.length !== 2 || args[0] !== '--profile')
    throw new Error('Expected only --profile default|base-select after the operation.');
  return sprint3Profile(args[1]);
}

export function profileBinding(id = 'default') {
  const profile = sprint3Profile(id);
  return {
    id: profile.id,
    files: profile.suites.length,
    cases: profile.suites.reduce((sum, row) => sum + row.cases, 0),
    inventorySha256: hash(JSON.stringify(profile.suites)),
    probePath: profile.probePath,
  };
}

export function profileProblems(ledger, expectedId = 'default') {
  let profile;
  try {
    profile = sprint3Profile(expectedId);
  } catch (error) {
    return [String(error)];
  }
  const problems = [];
  const expected = profileBinding(expectedId);
  for (const [key, value] of Object.entries(expected))
    if (ledger.profile?.[key] !== value) problems.push(`Profile binding differs: ${key}.`);
  if (!Array.isArray(ledger.suites) || ledger.suites.length !== profile.suites.length) {
    problems.push('Profile suite inventory has missing or extra files.');
  } else {
    profile.suites.forEach((planned, index) => {
      const row = ledger.suites[index];
      for (const key of SUITE_PLAN_FIELDS)
        if (row?.[key] !== planned[key])
          problems.push(`Profile suite plan differs: ${index}.${key}.`);
    });
  }
  return problems;
}

function selectCaptureProblems(directory, artifacts, expectedHead) {
  const problems = [];
  const expectedNames = SELECT_CAPTURE_CASES.flatMap(({ stem }) => [
    `${stem}.json`,
    `${stem}.png`,
  ]).sort();
  if (JSON.stringify(artifacts.map(({ file }) => file).sort()) !== JSON.stringify(expectedNames))
    problems.push('Base Select requires exactly eight JSON and eight PNG case captures.');
  for (const { stem, route, runtime } of SELECT_CAPTURE_CASES) {
    try {
      const file = path.join(directory, `${stem}.json`);
      if (canonicalPath(file) !== path.resolve(file) || !lstatSync(file).isFile())
        throw new Error('Case capture is not an owned regular file.');
      const receipt = JSON.parse(readFileSync(file, 'utf8'));
      if (
        receipt.testSource !== expectedHead ||
        receipt.route !== route ||
        receipt.runtime !== runtime ||
        receipt.outcome !== 'PASS' ||
        receipt.failure !== null ||
        !Array.isArray(receipt.errors) ||
        receipt.errors.length !== 0 ||
        typeof receipt.browser !== 'string' ||
        receipt.browser.length === 0 ||
        (receipt.servedPageRevision !== null && receipt.servedPageRevision !== expectedHead)
      )
        problems.push(`Base Select case binding or outcome differs: ${stem}.`);
      const screenshot = artifacts.find((entry) => entry.file === `${stem}.png`);
      if (!screenshot || screenshot.bytes <= 0)
        problems.push(`Base Select case screenshot missing or empty: ${stem}.`);
    } catch (error) {
      problems.push(`Base Select case unavailable: ${stem}: ${String(error)}`);
    }
  }
  return problems;
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const json = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(`${file}.next`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${file}.next`, file);
};
const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
const PRODUCTION_ARTIFACTS = ['build.log', 'dist-files.json', 'preview-requests.jsonl'];

function readProductionArtifact(output, name) {
  const file = path.join(output, name);
  if (canonicalPath(file) !== path.resolve(file))
    throw new Error('Production receipt has a symbolic-link ancestor or target.');
  if (!lstatSync(file).isFile()) throw new Error('Expected an owned regular production receipt.');
  const bytes = readFileSync(file);
  return { file: name, bytes: bytes.length, sha256: hash(bytes) };
}

// Seal each receipt once, when its producer has finished writing. Finalization
// observes later bytes separately and must never reseal a changed artifact.
export function sealProductionArtifact(output, ledger, name) {
  if (!PRODUCTION_ARTIFACTS.includes(name)) throw new Error('Unknown production receipt.');
  ledger.productionArtifacts ??= {};
  if (ledger.productionArtifacts[name])
    throw new Error(`Production receipt already sealed: ${name}`);
  ledger.productionArtifacts[name] = readProductionArtifact(output, name);
}

function sourceState() {
  return {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    worktreeStatus: git('status', '--porcelain', '--untracked-files=normal'),
    lockSha256: hash(readFileSync(path.join(repository, 'pnpm-lock.yaml'))),
    runnerSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    sourceServerSha256: sourceServerHash(),
  };
}

export function sourceProblems(actual, expected) {
  const problems = [];
  if (!/^[a-f0-9]{40}$/.test(expected.head ?? '') || actual.head !== expected.head)
    problems.push('Checkout does not match the exact candidate SHA.');
  if (actual.worktreeStatus) problems.push('Candidate checkout is dirty.');
  for (const key of ['tree', 'lockSha256', 'runnerSha256', 'sourceServerSha256'])
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

function initialize(output, profileId = 'default') {
  const profile = sprint3Profile(profileId);
  const file = path.join(output, 'results.json');
  if (existsSync(file))
    throw new Error(
      'Refusing to overwrite an earlier Sprint 3 receipt. Use a new evidence directory.'
    );
  const source = sourceState();
  const expectedHead = process.env.CANDIDATE_SHA ?? process.env.GITHUB_SHA;
  const ledger = {
    schemaVersion: 1,
    profile: profileBinding(profile.id),
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
      'The controls source canary is supplemental source proof from a separately owned dev server; public journeys still use the owned production preview.',
    ],
    errors: sourceProblems(source, { head: expectedHead }),
    build: { status: 'not-run' },
    suites: profile.suites.map((suite) => ({
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

async function execute(output, ledger, profileId = 'default') {
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
    const problems = [
      ...sourceProblems(sourceState(), { ...ledger.source, head: ledger.expectedHead }),
      ...profileProblems(ledger, profileId),
    ];
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
      const suiteDeadline = Math.min(deadline, Date.now() + row.seconds * 1_000);
      let sourceOwner;
      let sourceBinding;
      row.status = 'running';
      save();
      try {
        if (!row.sourceSha256) throw new Error(`Missing planned suite: ${row.file}`);
        if (row.id === SOURCE_CANARY_SUITE) {
          sourceOwner = createOwnedSourceServer({
            root: path.join(repository, 'apps/www'),
            directory: path.join(directory, 'source-canary'),
            source: ledger.source,
            deadline: suiteDeadline,
            signal: abort.signal,
          });
          sourceBinding = await sourceOwner.ready();
        }
        const env = {
          ...suiteOrigins(process.env, row, preview?.url, sourceBinding?.url),
          CANDIDATE_SHA: ledger.expectedHead,
          PROTO_UI_RUNTIME_EVIDENCE_DIR: captures,
          PROTO_UI_BROWSER_EVIDENCE_DIR: path.join(captures, 'button'),
          PROTO_UI_SCROLL_CORNER_EVIDENCE_DIR: path.join(captures, 'scroll-corner'),
          PROTO_UI_SCROLL_CORNER_HARNESS_SHA: ledger.expectedHead,
        };
        delete env.PROTO_UI_SPINNER_BROWSER_RUNTIME;
        delete env.PROTO_UI_SCROLL_CORNER_CAPTURE_ONLY;
        json(path.join(directory, 'source.json'), {
          ...ledger.source,
          profile: ledger.profile,
          suite: row.file,
          suiteSha256: row.sourceSha256,
          surface: row.surface,
          preview: row.surface === 'production-docs' ? ledger.preview : null,
          sourceCanary: sourceBinding ?? null,
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
          // Source startup/probes consume this row's original budget. Reserve
          // its bounded cleanup grace, without extending the suite or runner.
          timeoutMs: sourceOwner
            ? Math.max(1, suiteDeadline - Date.now() - SOURCE_STOP_BUDGET_MS)
            : budget(row.seconds),
          signal: sourceOwner
            ? AbortSignal.any([abort.signal, sourceOwner.failureSignal])
            : abort.signal,
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
        if (profileId === 'base-select')
          problems.push(...selectCaptureProblems(captures, row.artifacts, ledger.expectedHead));
        row.screenshotCount = row.artifacts.filter((entry) => entry.file.endsWith('.png')).length;
        if (row.screenshots && row.screenshotCount === 0)
          problems.push('Expected native visual evidence was not produced.');
        row.visualEvidence = row.screenshotCount
          ? 'captured'
          : 'none-produced; see native state/assertion JSON and logs';
        row.problems = problems;
        row.status =
          row.process.stopReason === 'interrupted' && abort.signal.aborted
            ? 'interrupted'
            : problems.length
              ? 'failed'
              : 'passed';
      } catch (error) {
        row.status = 'failed';
        row.reason = String(error);
      } finally {
        if (sourceOwner) {
          try {
            row.sourceCanary = await sourceOwner.close();
            if (row.sourceCanary.status !== 'passed') {
              row.status = 'failed';
              row.problems = [...(row.problems ?? []), ...row.sourceCanary.terminal.problems];
            }
          } catch (error) {
            row.status = 'failed';
            row.problems = [
              ...(row.problems ?? []),
              `Source producer sealing failed: ${String(error)}`,
            ];
          }
        }
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
        env: suiteOrigins(process.env, { surface: 'fixture' }),
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
      sealProductionArtifact(output, ledger, 'build.log');
      save();
      verifySource();
      if (ledger.build.status === 'passed') {
        const dist = path.join(repository, 'apps/www/dist');
        buildManifest = fileInventory(dist);
        if (!buildManifest.length) throw new Error('The production build emitted no files.');
        json(path.join(output, 'dist-files.json'), buildManifest);
        sealProductionArtifact(output, ledger, 'dist-files.json');
        ledger.build.distManifestSha256 = hash(JSON.stringify(buildManifest));
        preview = await startOwnedPreview(
          dist,
          ledger.expectedHead,
          path.join(output, 'preview-requests.jsonl')
        );
        const probePath = sprint3Profile(profileId).probePath;
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
      if (preview) {
        await preview.close();
        // All requests have stopped before the append-only log is sealed.
        sealProductionArtifact(output, ledger, 'preview-requests.jsonl');
      }
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

export function finalize(
  output,
  ledger,
  publishSummary = false,
  readSource = sourceState,
  expectedProfileId
) {
  // A crash or an unreadable capture during final reconciliation must never
  // leave the earlier successful aggregate as the last readable receipt.
  ledger.status = 'failed';
  ledger.finalization = { status: 'running', startedAt: now() };
  json(path.join(output, 'results.json'), ledger);
  // Real receipts and every CLI call require an explicit, immutable profile.
  // Older low-level artifact unit fixtures have neither schema nor profile.
  const profileRequired =
    expectedProfileId !== undefined ||
    ledger.schemaVersion !== undefined ||
    ledger.profile !== undefined;
  const requestedProfile = expectedProfileId ?? 'default';
  const bindingProblems = profileRequired ? profileProblems(ledger, requestedProfile) : [];
  ledger.profileProblems = [...new Set([...(ledger.profileProblems ?? []), ...bindingProblems])];
  if (ledger.profileProblems.length)
    ledger.errors.push(`Evidence profile validation failed: ${ledger.profileProblems.join(' ')}`);
  let profile;
  if (profileRequired && bindingProblems.length === 0) profile = sprint3Profile(requestedProfile);
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
  const productionProblems = [];
  ledger.observedProductionArtifacts = {};
  for (const name of PRODUCTION_ARTIFACTS) {
    const expected = ledger.productionArtifacts?.[name];
    if (!expected && ledger.build.status !== 'passed') continue;
    if (!expected) productionProblems.push(`${name} has no sealed execution receipt.`);
    try {
      const actual = readProductionArtifact(output, name);
      ledger.observedProductionArtifacts[name] = actual;
      if (
        expected &&
        (expected.file !== name ||
          expected.bytes !== actual.bytes ||
          expected.sha256 !== actual.sha256)
      )
        productionProblems.push(`${name} hash or length drifted after its producer finished.`);
    } catch (error) {
      productionProblems.push(`${name} unavailable during finalization: ${String(error)}`);
    }
  }
  ledger.productionEvidenceProblems = [
    ...new Set([...(ledger.productionEvidenceProblems ?? []), ...productionProblems]),
  ];
  if (ledger.productionEvidenceProblems.length)
    ledger.errors.push(
      `Production evidence integrity failed: ${ledger.productionEvidenceProblems.join(' ')}`
    );
  for (const row of ledger.suites) {
    row.executionStatus ??= row.status;
    // Do not consume or write paths from an unbound or drifted inventory.
    if (bindingProblems.length) {
      if (row.status === 'passed') row.status = 'failed';
      row.evidenceProblems = [
        ...new Set([...(row.evidenceProblems ?? []), 'Suite rejected by the requested profile.']),
      ];
      continue;
    }
    const requiresPassedEvidence = profile
      ? row.status === 'passed' || row.executionStatus === 'passed'
      : row.executionStatus === 'passed';
    const directory = path.join(output, row.id);
    const observed = inspectInventory(path.join(directory, 'captures'));
    const problems = [...observed.errors];
    if (row.id === SOURCE_CANARY_SUITE && (requiresPassedEvidence || row.sourceCanary)) {
      const sourceEvidence = inspectSourceCanary(
        path.join(directory, 'source-canary'),
        row.sourceCanary,
        ledger.source
      );
      row.observedSourceCanaryArtifacts = sourceEvidence.observedArtifacts;
      problems.push(...sourceEvidence.problems);
    }
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
    } else if (requiresPassedEvidence) problems.push('Executed capture inventory is missing.');
    row.screenshotCount = observed.files.filter((entry) => entry.file.endsWith('.png')).length;
    if (requiresPassedEvidence && row.screenshots && row.screenshotCount === 0)
      problems.push('Required native screenshots are missing.');
    for (const [name, key] of [
      ['vitest.json', 'reportSha256'],
      ['browser.log', 'logSha256'],
      ['source.json', 'sourceReceiptSha256'],
    ]) {
      if (!directoryOwned) continue;
      if (!row[key] && !requiresPassedEvidence) continue;
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
    if (profile && directoryOwned && requiresPassedEvidence && problems.length === 0) {
      const planned = profile.suites.find((entry) => entry.id === row.id);
      try {
        const report = JSON.parse(readFileSync(path.join(directory, 'vitest.json'), 'utf8'));
        problems.push(...vitestProblems(report, planned.cases, planned.file));
      } catch (error) {
        problems.push(`Profile Vitest report unavailable: ${String(error)}`);
      }
      try {
        const receipt = JSON.parse(readFileSync(path.join(directory, 'source.json'), 'utf8'));
        if (
          JSON.stringify(receipt.profile) !== JSON.stringify(profileBinding(profile.id)) ||
          receipt.suite !== planned.file ||
          receipt.suiteSha256 !== row.sourceSha256 ||
          receipt.surface !== planned.surface ||
          receipt.head !== ledger.expectedHead ||
          receipt.tree !== ledger.source.tree ||
          receipt.lockSha256 !== ledger.source.lockSha256 ||
          receipt.runnerSha256 !== ledger.source.runnerSha256 ||
          receipt.sourceServerSha256 !== ledger.source.sourceServerSha256 ||
          JSON.stringify(receipt.preview) !==
            JSON.stringify(planned.surface === 'production-docs' ? ledger.preview : null)
        )
          problems.push('Suite source receipt does not bind this profile and candidate.');
        if (
          planned.surface === 'production-docs' &&
          (ledger.preview?.head !== ledger.expectedHead ||
            ledger.preview?.probePath !== profile.probePath ||
            ledger.preview?.distManifestSha256 !== ledger.build.distManifestSha256 ||
            !/^[a-f0-9]{64}$/.test(ledger.build.distManifestSha256 ?? ''))
        )
          problems.push('Owned production preview does not bind the selected profile.');
      } catch (error) {
        problems.push(`Profile source receipt unavailable: ${String(error)}`);
      }
      if (profile.id === 'base-select')
        problems.push(
          ...selectCaptureProblems(
            path.join(directory, 'captures'),
            observed.files,
            ledger.expectedHead
          )
        );
    }
    if (profile && row.status === 'passed' && row.executionStatus !== 'passed')
      problems.push('Passed suite has a non-passed execution status.');
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
    ledger.suites.every(
      (row) => row.status === 'passed' && (!profileRequired || row.executionStatus === 'passed')
    )
      ? 'passed'
      : 'failed';
  ledger.status = outcome();
  const summary = [
    `## Sprint 3 consumer evidence: ${ledger.status}`,
    '',
    `Candidate: \`${ledger.expectedHead}\``,
    ...(profileRequired
      ? [`Profile: \`${requestedProfile}\` (separate acceptance inventory).`]
      : []),
    '',
    '| Suite | Expected cases | Outcome | Screenshots |',
    '|---|---:|---|---:|',
    ...ledger.suites.map(
      (row) =>
        `| ${row.id} | ${row.cases} | ${row.status} | ${row.screenshotCount ?? 'not observed'} |`
    ),
    '',
    `Production build: ${ledger.build.status}.`,
    `Supplemental controls source producer: ${ledger.suites.find((row) => row.id === SOURCE_CANARY_SUITE)?.sourceCanary?.status ?? 'not produced'}. Public journeys remain production-preview evidence.`,
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
      throw new Error(
        'Usage: node scripts/test/sprint3-consumer-evidence.mjs init|run|finalize [--profile default|base-select]'
      );
    const profile = parseEvidenceProfile(process.argv.slice(3));
    const output = outputDirectory();
    const ledger =
      operation === 'init'
        ? initialize(output, profile.id)
        : JSON.parse(readFileSync(path.join(output, 'results.json'), 'utf8'));
    if (operation === 'run') {
      const problems = profileProblems(ledger, profile.id);
      if (problems.length) ledger.errors.push(...problems);
      else await execute(output, ledger, profile.id);
    }
    if (operation !== 'init')
      process.exitCode = finalize(
        output,
        ledger,
        operation === 'finalize',
        sourceState,
        profile.id
      );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
