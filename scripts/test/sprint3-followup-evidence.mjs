import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveEvidenceDirectory,
  runCommand,
  vitestProblems,
} from './sprint3-consumer-evidence.mjs';
import { runtimeSourceSnapshot } from './runtime-observation.mjs';

const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const self = fileURLToPath(import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
export const FOLLOWUP_SUITES = Object.freeze([
  Object.freeze({
    id: 'drawer',
    file: 'packages/prototypes/shadcn/test/drawer-presence.browser.test.ts',
    cases: 7,
    seconds: 900,
    surface: 'owned-esbuild-native-fixture',
    captureEnv: 'PUI_FINF_FEATURE_EVIDENCE_DIR',
  }),
  Object.freeze({
    id: 'scroll',
    file: 'apps/www/src/content/docs/zh-cn/demo-shadcn-scroll-area.browser.test.ts',
    cases: 1,
    seconds: 900,
    surface: 'owned-documentation-development-server',
    captureEnv: null,
  }),
  Object.freeze({
    id: 'image-preview',
    file: 'apps/www/src/components/documentation-image-preview.browser.test.ts',
    cases: 32,
    seconds: 3300,
    surface: 'owned-documentation-development-server',
    captureEnv: 'IMAGE_PREVIEW_EVIDENCE_DIR',
  }),
  Object.freeze({
    id: 'select-public-usage',
    file: 'apps/www/test/base-select-public-usage.test.ts',
    cases: 4,
    seconds: 600,
    surface: 'source-dom-model-consumer',
    captureEnv: null,
  }),
]);
const forbiddenEnvironment = [
  'PROTO_UI_BROWSER_BASE_URL',
  'PROTO_UI_BROWSER_SOURCE_BASE_URL',
  'PROTO_UI_SHADCN_SCROLL_AREA_BROWSER_RUNTIME',
  'PROTO_UI_RUNTIME_PHASE',
  'PROTO_UI_RUNTIME_SHARD',
  'PROTO_UI_RUNTIME_SELECTION_FILE',
  'PROTO_UI_RUNTIME_PROGRESS_FILE',
];
const capturedEnvironment = [
  'PUI_FINF_FEATURE_EVIDENCE_DIR',
  'IMAGE_PREVIEW_EVIDENCE_DIR',
  'PROTO_UI_RUNTIME_EVIDENCE_DIR',
];

export function followupSuite(id) {
  const suite = FOLLOWUP_SUITES.find((row) => row.id === id);
  if (!suite) throw new Error('Unknown Sprint 3 follow-up suite: ' + String(id));
  return suite;
}

export function parseFollowupArguments(args) {
  if (args.length !== 3 || !['init', 'run', 'finalize'].includes(args[0]) || args[1] !== '--suite')
    throw new Error(
      'Expected init|run|finalize --suite drawer|scroll|image-preview|select-public-usage.'
    );
  return { operation: args[0], suite: followupSuite(args[2]) };
}

function ownedPath(file) {
  let ancestor = path.resolve(file);
  const remaining = [];
  while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
    remaining.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  if (path.resolve(realpathSync(ancestor), ...remaining) !== path.resolve(file))
    throw new Error('Evidence cannot use a symbolic-link ancestor or target: ' + file);
  return path.resolve(file);
}

function outputDirectory(value) {
  if (!value) throw new Error('Set SPRINT3_FOLLOWUP_EVIDENCE_DIR outside the source checkout.');
  const directory = resolveEvidenceDirectory(value, repository);
  ownedPath(path.resolve(value));
  const containsSource = path.relative(directory, repository);
  if (
    !containsSource ||
    (!path.isAbsolute(containsSource) &&
      containsSource !== '..' &&
      !containsSource.startsWith('..' + path.sep))
  )
    throw new Error('Evidence cannot contain the source checkout.');
  mkdirSync(directory, { recursive: true });
  return directory;
}

function writeJson(file, value) {
  ownedPath(file);
  const temporary = file + '.next-' + randomUUID();
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  renameSync(temporary, file);
}

function readJson(file) {
  ownedPath(file);
  if (!lstatSync(file).isFile()) throw new Error('Expected an owned regular file: ' + file);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function followupSource(suite) {
  const bindings = [
    'pnpm-lock.yaml',
    'package.json',
    'scripts/test/sprint3-followup-evidence.mjs',
    'scripts/test/sprint3-consumer-evidence.mjs',
    'scripts/test/sprint3-source-server.mjs',
    'scripts/test/runtime-observation.mjs',
    'apps/www/src/content/docs/zh-cn/browser-harness.ts',
    suite.file,
  ];
  return {
    ...runtimeSourceSnapshot(repository),
    files: Object.fromEntries(
      bindings.map((file) => {
        const target = path.join(repository, file);
        ownedPath(target);
        if (!lstatSync(target).isFile()) throw new Error('Missing bound source file: ' + file);
        return [file, hash(readFileSync(target))];
      })
    ),
  };
}

function sourceProblems(actual, expected, candidate) {
  const problems = [];
  if (
    !/^[a-f0-9]{40}$/.test(candidate ?? '') ||
    actual?.checkoutSha !== candidate ||
    expected?.checkoutSha !== candidate
  )
    problems.push('Source does not match the full candidate SHA.');
  if (actual?.dirty !== false || expected?.dirty !== false)
    problems.push('Source checkout is not clean.');
  if (
    !/^[a-f0-9]{40}$/.test(actual?.treeSha ?? '') ||
    !/^[a-f0-9]{64}$/.test(actual?.worktreeSha256 ?? '') ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  )
    problems.push('Source, lock or reached helper bytes drifted.');
  return problems;
}

export function followupEnvironment(environment, suite, captures, candidate) {
  const blocked = forbiddenEnvironment.filter((name) => environment[name]);
  if (blocked.length)
    throw new Error('Caller origin or filtered selection is forbidden: ' + blocked.join(', '));
  const result = { ...environment, CANDIDATE_SHA: candidate, ASTRO_TELEMETRY_DISABLED: '1' };
  for (const name of [...forbiddenEnvironment, ...capturedEnvironment]) delete result[name];
  if (suite.captureEnv) result[suite.captureEnv] = captures;
  return result;
}

export function followupCommand(suite, directory) {
  return {
    command: 'corepack',
    args: [
      'pnpm@10.32.1',
      'exec',
      'vitest',
      'run',
      suite.file,
      '--maxWorkers=1',
      '--minWorkers=1',
      '--no-file-parallelism',
      '--reporter=verbose',
      '--reporter=json',
      '--outputFile=' + path.join(directory, 'observed', 'vitest.json'),
    ],
  };
}

export function followupInventory(directory) {
  ownedPath(directory);
  if (!existsSync(directory)) throw new Error('Observed evidence directory is missing.');
  const files = [];
  const visit = (file) => {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error('Evidence cannot follow a symbolic link: ' + file);
    if (stat.isDirectory()) {
      for (const name of readdirSync(file).sort()) visit(path.join(file, name));
    } else if (stat.isFile()) {
      const bytes = readFileSync(file);
      files.push({
        file: path.relative(directory, file).replaceAll(path.sep, '/'),
        bytes: bytes.length,
        sha256: hash(bytes),
      });
    } else throw new Error('Unsupported evidence entry: ' + file);
  };
  visit(directory);
  return files;
}

function planProblems(ledger, suite, candidate) {
  const problems = [];
  if (
    ledger?.schemaVersion !== 1 ||
    ledger?.kind !== 'sprint3-followup-evidence' ||
    ledger?.candidate !== candidate ||
    JSON.stringify(ledger?.suite) !== JSON.stringify(suite)
  )
    problems.push('Receipt candidate or complete suite plan differs.');
  if (!Array.isArray(ledger?.producerErrors))
    problems.push('Original producer error inventory is missing.');
  return problems;
}

export function initializeFollowup(output, suiteId, candidate) {
  const directory = outputDirectory(output);
  const suite = followupSuite(suiteId);
  if (existsSync(path.join(directory, 'results.json')))
    throw new Error('Refusing to overwrite an earlier follow-up receipt.');
  const source = followupSource(suite);
  const producerErrors = sourceProblems(source, source, candidate);
  if (!/^v24\./.test(process.version))
    producerErrors.push('The repository Node 24 baseline is required.');
  const manifest = readJson(path.join(repository, 'package.json'));
  if (manifest.packageManager !== 'pnpm@10.32.1')
    producerErrors.push('The declared package manager differs.');
  try {
    followupEnvironment(
      process.env,
      suite,
      path.join(directory, 'observed', 'captures'),
      candidate
    );
  } catch (error) {
    producerErrors.push(String(error));
  }
  const ledger = {
    schemaVersion: 1,
    kind: 'sprint3-followup-evidence',
    candidate,
    suite,
    source,
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      packageManager: manifest.packageManager,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    },
    startedAt: now(),
    producerStatus: 'not-run',
    producerErrors,
    boundary:
      suite.surface === 'source-dom-model-consumer'
        ? 'Complete source Happy-DOM consumer file; not native browser or installed application evidence.'
        : 'Complete direct native source fixture or owned development-server journey; not installed or production-build acceptance.',
  };
  writeJson(path.join(directory, 'results.json'), ledger);
  if (producerErrors.length) throw new Error(producerErrors.join('\n'));
  return ledger;
}

export async function executeFollowup(output, suiteId, candidate) {
  const directory = outputDirectory(output);
  const suite = followupSuite(suiteId);
  const ledger = readJson(path.join(directory, 'results.json'));
  const problems = planProblems(ledger, suite, candidate);
  if (ledger.producerStatus !== 'not-run')
    problems.push('This producer already started; use a fresh evidence directory.');
  if (problems.length) throw new Error(problems.join('\n'));
  const observed = path.join(directory, 'observed');
  const captures = path.join(observed, 'captures');
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  let before;
  let after;
  let execution;
  const invocation = followupCommand(suite, directory);
  ledger.producerStatus = 'running';
  ledger.executionStartedAt = now();
  writeJson(path.join(directory, 'results.json'), ledger);
  try {
    before = followupSource(suite);
    const sourceErrors = sourceProblems(before, ledger.source, candidate);
    if (sourceErrors.length || ledger.producerErrors.length)
      throw new Error([...ledger.producerErrors, ...sourceErrors].join('\n'));
    if (!/^v24\./.test(process.version) || process.version !== ledger.environment?.node)
      throw new Error('Node 24 toolchain changed between initialization and execution.');
    const environment = followupEnvironment(process.env, suite, captures, candidate);
    if (existsSync(observed))
      throw new Error('Observed output already exists; refusing a mixed run.');
    mkdirSync(captures, { recursive: true });
    execution = await runCommand(invocation.command, invocation.args, {
      cwd: repository,
      env: environment,
      log: path.join(observed, 'runner.log'),
      timeoutMs: suite.seconds * 1000,
      signal: abort.signal,
    });
    after = followupSource(suite);
    ledger.producerStatus = 'finished';
  } catch (error) {
    ledger.producerStatus = abort.signal.aborted ? 'interrupted' : 'failed';
    ledger.producerErrors.push(String(error));
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    ledger.executionFinishedAt = now();
    if (existsSync(observed)) {
      try {
        writeJson(path.join(observed, 'execution.json'), {
          candidate,
          suite,
          invocation,
          node: process.version,
          packageManager: 'pnpm@10.32.1',
          result: execution ?? null,
          startedAt: ledger.executionStartedAt,
          finishedAt: ledger.executionFinishedAt,
        });
        writeJson(path.join(observed, 'source.json'), {
          candidate,
          suite,
          before: before ?? null,
          after: after ?? null,
        });
        ledger.artifacts = followupInventory(observed);
      } catch (error) {
        ledger.producerStatus = 'failed';
        ledger.producerErrors.push('Could not seal original evidence: ' + String(error));
      }
    }
    writeJson(path.join(directory, 'results.json'), ledger);
  }
  return ledger;
}

function captureProblems(suite, directory, inventory, candidate, log) {
  const problems = [];
  const nonempty = (file) =>
    inventory.some((entry) => entry.file === 'captures/' + file && entry.bytes > 0);
  if (suite.id === 'drawer') {
    const required = [
      ...['document', 'shadow'].flatMap((scope) => [
        'drawer-' + scope + '-enter.png',
        'drawer-' + scope + '-trace.json',
        'drawer-' + scope + '-scroll.png',
        'drawer-' + scope + '-scroll-trace.json',
      ]),
      ...['fixed-control', 'intrinsic'].flatMap((kind) => [
        'drawer-public-' + kind + '-settled.png',
        'drawer-public-' + kind + '-diagnostic.json',
      ]),
    ];
    for (const file of required)
      if (!nonempty(file)) problems.push('Required Drawer capture missing or empty: ' + file);
  } else if (suite.id === 'image-preview') {
    for (const width of [320, 390, 1280])
      for (const color of ['light', 'dark'])
        for (const family of ['shadcn', 'brutalist'])
          for (const extension of ['json', 'png']) {
            const file = width + '-' + color + '-' + family + '-last-observed.' + extension;
            if (!nonempty(file))
              problems.push('Required Image Preview capture missing or empty: ' + file);
          }
    for (const file of ['matrix.json', 'linear-390.webm', 'linear-1280.webm'])
      if (!nonempty(file))
        problems.push('Required Image Preview receipt/video missing or empty: ' + file);
    try {
      const matrix = readJson(path.join(directory, 'captures', 'matrix.json'));
      if (matrix.candidate !== candidate || typeof matrix.browser !== 'string' || !matrix.browser)
        problems.push('Image Preview capture candidate or browser differs.');
    } catch (error) {
      problems.push('Image Preview matrix unavailable: ' + String(error));
    }
  } else if (suite.id === 'scroll') {
    const cleanLog = log.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
    for (const marker of ['shadcn-scroll-thumb-drag-geometry', 'shadcn-scroll-thumb-drag-hit']) {
      const rows = [];
      for (const line of cleanLog.split('\n')) {
        const offset = line.indexOf('[' + marker + ']');
        if (offset < 0) continue;
        try {
          rows.push(JSON.parse(line.slice(offset + marker.length + 2).trim()));
        } catch {
          problems.push('Malformed original Scroll geometry/hit observation.');
        }
      }
      for (const runtime of ['wc', 'react', 'vue', 'vue2'])
        for (const axis of ['vertical', 'horizontal']) {
          const label = runtime + '/' + axis + '-thumb-start';
          const entries = rows.filter((row) => row.label === label);
          if (
            entries.length !== 1 ||
            (marker.endsWith('-hit')
              ? entries[0].hit?.onThumb !== true
              : !(entries[0].box?.width > 0 && entries[0].box?.height > 0))
          )
            problems.push(
              'Complete four-host Scroll observation missing or failed: ' + marker + '/' + label
            );
        }
    }
  }
  return problems;
}

export function verifyFollowup(output, suiteId, candidate, workflowSteps) {
  const directory = outputDirectory(output);
  const suite = followupSuite(suiteId);
  const problems = [];
  if (workflowSteps !== undefined) {
    const producer = suite.id === 'select-public-usage' ? 'public-source' : 'consumer';
    for (const id of ['inventory', 'dependencies', 'controls', 'environment', producer])
      if (workflowSteps?.[id]?.outcome !== 'success')
        problems.push('Original workflow stage did not succeed: ' + id);
  }
  let ledger = null;
  let current = null;
  let observed = [];
  try {
    ledger = readJson(path.join(directory, 'results.json'));
  } catch (error) {
    problems.push('Original producer receipt unavailable: ' + String(error));
  }
  problems.push(...planProblems(ledger, suite, candidate));
  try {
    current = followupSource(suite);
    problems.push(...sourceProblems(current, ledger?.source, candidate));
  } catch (error) {
    problems.push('Current candidate source unavailable: ' + String(error));
  }
  if (ledger?.producerStatus !== 'finished') problems.push('The original producer did not finish.');
  if (Array.isArray(ledger?.producerErrors)) problems.push(...ledger.producerErrors);
  const raw = path.join(directory, 'observed');
  let inventorySafe = false;
  try {
    observed = followupInventory(raw);
    if (
      !Array.isArray(ledger?.artifacts) ||
      JSON.stringify(observed) !== JSON.stringify(ledger.artifacts)
    )
      problems.push('Original sealed artifact bytes or inventory changed.');
    else inventorySafe = true;
  } catch (error) {
    problems.push('Original artifacts unavailable: ' + String(error));
  }
  if (inventorySafe) {
    try {
      const execution = readJson(path.join(raw, 'execution.json'));
      const source = readJson(path.join(raw, 'source.json'));
      const report = readJson(path.join(raw, 'vitest.json'));
      const log = readFileSync(path.join(raw, 'runner.log'), 'utf8');
      if (
        execution.candidate !== candidate ||
        JSON.stringify(execution.suite) !== JSON.stringify(suite) ||
        JSON.stringify(execution.invocation) !== JSON.stringify(followupCommand(suite, directory))
      )
        problems.push('Original executed command or candidate differs.');
      if (
        !/^v24\./.test(execution.node ?? '') ||
        execution.node !== ledger.environment?.node ||
        execution.node !== process.version ||
        execution.packageManager !== 'pnpm@10.32.1'
      )
        problems.push('The executed locked Node/pnpm toolchain differs.');
      const result = execution.result;
      if (
        !result ||
        result.exitCode !== 0 ||
        result.signal !== null ||
        result.stopReason !== null ||
        result.spawnError !== null ||
        result.ioError !== null ||
        !Number.isFinite(result.elapsedMs) ||
        result.elapsedMs < 0
      )
        problems.push('Original process exit, cancellation, spawn or output result did not pass.');
      if (!log.trim()) problems.push('Original execution log is empty.');
      if (source.candidate !== candidate || JSON.stringify(source.suite) !== JSON.stringify(suite))
        problems.push('Original source receipt scope differs.');
      problems.push(...sourceProblems(source.before, ledger.source, candidate));
      problems.push(...sourceProblems(source.after, ledger.source, candidate));
      problems.push(...vitestProblems(report, suite.cases, suite.file));
      if (
        !Array.isArray(report.testResults) ||
        report.testResults.length !== 1 ||
        path.resolve(report.testResults[0]?.name ?? '') !== path.join(repository, suite.file)
      )
        problems.push('Vitest source must be the actual candidate checkout file.');
      problems.push(...captureProblems(suite, raw, observed, candidate, log));
    } catch (error) {
      problems.push('Original execution evidence cannot be verified: ' + String(error));
    }
  }
  return {
    schemaVersion: 1,
    kind: 'sprint3-followup-verification',
    candidate,
    suite,
    status: problems.length ? 'failed' : 'passed',
    producerStatus: ledger?.producerStatus ?? 'missing',
    checkedAt: now(),
    workflowSteps: workflowSteps ?? null,
    originalSource: ledger?.source ?? null,
    currentSource: current,
    observedArtifacts: observed,
    problems: [...new Set(problems)],
    boundary:
      ledger?.boundary ?? 'No native or installed acceptance is inferred from a missing producer.',
  };
}

export function finalizeFollowup(output, suiteId, candidate, workflowSteps) {
  const directory = outputDirectory(output);
  const verification = verifyFollowup(directory, suiteId, candidate, workflowSteps);
  const history = path.join(directory, 'verification-history.jsonl');
  ownedPath(history);
  const priorHistory = lstatSync(history, { throwIfNoEntry: false });
  if (priorHistory && !priorHistory.isFile())
    throw new Error('Verification history must be a regular file.');
  appendFileSync(history, JSON.stringify(verification) + '\n');
  writeJson(path.join(directory, 'verification.json'), verification);
  console.log(JSON.stringify(verification, null, 2));
  return verification.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try {
    const { operation, suite } = parseFollowupArguments(process.argv.slice(2));
    const output = process.env.SPRINT3_FOLLOWUP_EVIDENCE_DIR;
    const candidate = process.env.CANDIDATE_SHA;
    if (operation === 'init') initializeFollowup(output, suite.id, candidate);
    else {
      if (operation === 'run') await executeFollowup(output, suite.id, candidate);
      if (
        operation === 'finalize' &&
        process.env.GITHUB_ACTIONS === 'true' &&
        !process.env.WORKFLOW_STEP_OUTCOMES
      )
        throw new Error('The final workflow step outcomes are required in GitHub Actions.');
      const workflowSteps =
        operation === 'finalize' && process.env.WORKFLOW_STEP_OUTCOMES
          ? JSON.parse(process.env.WORKFLOW_STEP_OUTCOMES)
          : undefined;
      process.exitCode = finalizeFollowup(output, suite.id, candidate, workflowSteps);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
