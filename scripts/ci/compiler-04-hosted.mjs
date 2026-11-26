import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  appendFileSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeSourceSnapshot } from '../test/runtime-observation.mjs';

const driverRoot = fileURLToPath(new URL('../../', import.meta.url));
const reporter = fileURLToPath(import.meta.url);
const testDirectory = 'packages/compiler/test';
const websiteGraph = 'apps/www/dist/proto-ui-bundle-graph.json';
const requiredConsumers = [
  'react-target',
  'controlled-source-react',
  'context-source-react',
  'keyed-task-lifetime-react',
  'tabs-source-react',
  'task-helper-react',
  'react-previous-peer',
  'react-previous-peer-hydration',
  'gpui-target',
  'extern-bindings-cli',
].map((name) => `${testDirectory}/${name}.node-test.mjs`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

// Node's original TAP reporter remains enabled alongside these structured events.
export default async function* report(events) {
  for await (const event of events) {
    yield JSON.stringify(event, (_key, value) =>
      value instanceof Error
        ? {
            name: value.name,
            message: value.message,
            stack: value.stack,
            code: value.code,
            cause: value.cause,
          }
        : value
    ) + '\n';
  }
}

export function assertExactSource(snapshot, expected) {
  assert.match(expected, /^[a-f0-9]{40}$/);
  assert.equal(snapshot.checkoutSha, expected, 'Checkout differs from the requested source');
  assert.equal(snapshot.dirty, false, 'Source must remain clean');
}

function commandArgs(kind, plan, evidence) {
  if (kind === 'build') return ['scripts/build/public-packages.mjs', '--json'];
  if (kind === 'docs') return ['pnpm@10.32.1', '-s', 'docs:build'];
  if (kind === 'website') return ['scripts/coverage-matrices/check-website-production-bundle.mjs'];
  assert.equal(kind, 'compiler', 'Unknown command');
  return [
    '--test',
    '--test-reporter=tap',
    `--test-reporter=${reporter}`,
    '--test-reporter-destination=stdout',
    `--test-reporter-destination=${path.join(evidence, 'node-events.ndjson')}`,
    ...plan.files,
  ];
}

function commandExecutable(kind) {
  return kind === 'docs' ? 'corepack' : process.execPath;
}

export function validateExecution(
  execution,
  plan,
  expectedArgs,
  expectedExecutable = process.execPath
) {
  assert.equal(execution.session, plan.session, 'Receipt belongs to another run');
  assert.equal(execution.candidateSha, plan.candidate.checkoutSha);
  assert.equal(execution.driverSha, plan.driver.checkoutSha);
  assert.equal(execution.executable, expectedExecutable);
  assert.deepEqual(execution.args, expectedArgs, 'The original complete command is required');
  assert.equal(execution.exitCode, 0);
  assert.equal(execution.signal, null);
  assert.equal(execution.error, null);
  for (const field of ['startedAt', 'finishedAt']) {
    assert.equal(new Date(execution[field]).toISOString(), execution[field]);
  }
  assert.ok(execution.finishedAt >= execution.startedAt);
}

export function validateWorkflowSteps(steps) {
  for (const name of [
    'source',
    'controls',
    'dependencies',
    'toolchain',
    'environment',
    'generator',
    'build',
    'compiler',
    'docs',
    'website',
  ])
    assert.equal(steps[name]?.outcome, 'success', `${name} did not succeed`);
}

export function validateNodeEvents(events, files, root) {
  const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
  const summaries = events.filter((event) => event.type === 'test:summary');
  const complete = summaries.filter((event) => !event.data.file);
  assert.equal(complete.length, 1, 'Require one complete Node terminal summary');
  assert.equal(events.at(-1)?.type, 'test:summary', 'Event stream has no terminal summary');
  const perFile = summaries.filter((event) => event.data.file);
  assert.deepEqual(
    perFile.map((event) => relative(event.data.file)).sort(),
    [...files].sort(),
    'Every selected file must report exactly once'
  );
  for (const { data } of summaries) {
    assert.equal(data.success, true, 'Node reported an unsuccessful run');
    assert.ok(Number.isInteger(data.counts.tests) && data.counts.tests > 0, 'No executed tests');
    assert.equal(data.counts.passed, data.counts.tests, 'Not every test passed');
    for (const key of ['failed', 'cancelled', 'skipped', 'todo'])
      assert.equal(data.counts[key], 0, `Node reported ${key} cases`);
  }
  for (const file of files) {
    assert.ok(
      events.some(
        (event) =>
          event.type === 'test:pass' &&
          event.data.file &&
          relative(event.data.file) === file &&
          event.data.name !== event.data.file &&
          event.data.name !== file &&
          event.data.name !== path.basename(file) &&
          event.data.details?.type === 'test' &&
          !event.data.skip &&
          !event.data.todo
      ),
      `No actual named case executed in ${file}`
    );
  }
  assert.equal(
    complete[0].data.counts.tests,
    perFile.reduce((sum, event) => sum + event.data.counts.tests, 0),
    'Node totals do not reconcile'
  );
  assert.ok(!events.some((event) => event.type === 'test:fail'), 'A failed case was reported');
  return {
    counts: complete[0].data.counts,
    files: perFile.map(({ data }) => ({
      file: relative(data.file),
      counts: data.counts,
      durationMs: data.duration_ms,
    })),
  };
}

export function validatePublicBuild(plan, result) {
  assert.ok(Number.isInteger(plan.packageCount) && plan.packageCount > 0);
  assert.equal(plan.selectedCount, plan.packageCount, 'Public build plan was narrowed');
  assert.equal(plan.packages.length, plan.packageCount);
  assert.equal(new Set(plan.packages).size, plan.packageCount);
  assert.equal(result.packageCount, plan.packageCount);
  assert.equal(result.selectedCount, plan.selectedCount);
  assert.deepEqual(
    result.results.map(({ name }) => name),
    plan.packages,
    'Complete public package build results are required'
  );
  for (const built of result.results) {
    assert.ok(Number.isInteger(built.files) && built.files > 0);
    assert.ok(Number.isInteger(built.bytes) && built.bytes > 0);
  }
}

export function copyConsumerSources(source, destination) {
  const files = [];
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'target') continue;
      const relative = path.join(prefix, entry.name);
      const input = path.join(directory, entry.name);
      const stat = lstatSync(input);
      assert.ok(!stat.isSymbolicLink(), `Consumer artifact is a symlink: ${relative}`);
      if (stat.isDirectory()) {
        walk(input, relative);
        continue;
      }
      assert.ok(stat.isFile(), `Consumer artifact is not a regular file: ${relative}`);
      if (!/\.(?:tsx?|rs|toml|lock|json|txt)$/.test(entry.name)) continue;
      const target = path.join(destination, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(input, target);
      files.push({
        path: relative.replaceAll('\\', '/'),
        bytes: stat.size,
        sha256: hash(readFileSync(target)),
      });
    }
  };
  assert.ok(lstatSync(source).isDirectory() && !lstatSync(source).isSymbolicLink());
  walk(source);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function prepare(root, evidence, expectedCandidate, expectedDriver) {
  const candidate = runtimeSourceSnapshot(root);
  const driver = runtimeSourceSnapshot(driverRoot);
  assertExactSource(candidate, expectedCandidate);
  assertExactSource(driver, expectedDriver);
  const manifest = readJson(path.join(root, 'package.json'));
  assert.equal(
    manifest.scripts['test:compiler-analysis'],
    'node --test packages/compiler/test/*.node-test.mjs',
    'Compiler gate changed'
  );
  assert.equal(manifest.scripts['build:packages'], 'node scripts/build/public-packages.mjs');
  assert.equal(manifest.scripts['docs:build'], 'corepack pnpm@10.32.1 --filter apps-www build');
  assert.ok(!existsSync(path.join(root, websiteGraph)), 'A previous production graph is present');
  const files = readdirSync(path.join(root, testDirectory))
    .filter((file) => file.endsWith('.node-test.mjs'))
    .sort()
    .map((file) => `${testDirectory}/${file}`);
  for (const required of requiredConsumers)
    assert.ok(files.includes(required), `Missing ${required}`);
  const tracked = execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      '--',
      'packages/compiler',
      'package.json',
      'pnpm-lock.yaml',
      'apps/www/package.json',
      'apps/www/astro.config.mjs',
      'scripts/coverage-matrices/check-website-production-bundle.mjs',
      'native/gpui/Cargo.lock',
    ],
    { cwd: root }
  )
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const file of files) assert.ok(tracked.includes(file), `Untracked test input: ${file}`);
  const sourceBindings = tracked.map((file) => {
    const absolute = path.join(root, file);
    assert.ok(lstatSync(absolute).isFile() && !lstatSync(absolute).isSymbolicLink(), file);
    return { path: file, sha256: hash(readFileSync(absolute)) };
  });
  writeJson(path.join(evidence, 'plan.json'), {
    schemaVersion: 1,
    session: randomUUID(),
    root,
    candidate,
    driver,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    files,
    sourceBindings,
    compilerCommand: manifest.scripts['test:compiler-analysis'],
    packageBuildCommand: manifest.scripts['build:packages'],
    websiteBuildCommand: 'corepack pnpm@10.32.1 -s docs:build',
    websiteBuildScript: manifest.scripts['docs:build'],
    scope:
      'Complete selected compiler package tests, public package build and original Website production build/owner check; not full 0.4 language or Adapter migration acceptance.',
  });
}

function environment(root, evidence) {
  assert.equal(
    Number(process.versions.node.split('.')[0]),
    24,
    'Use the selected Node 24 toolchain'
  );
  const compilerRequire = createRequire(path.join(root, 'packages/compiler/package.json'));
  const previousRequire = createRequire(path.join(root, 'apps/www/package.json'));
  const resolvePair = (require) =>
    ['react', 'react-dom'].map((name) => {
      const file = require.resolve(`${name}/package.json`);
      const data = readJson(file);
      assert.equal(data.name, name);
      return {
        name,
        version: data.version,
        directory: realpathSync(path.dirname(file)),
        packageJsonSha256: hash(readFileSync(file)),
      };
    });
  const current = resolvePair(compilerRequire);
  const previous = resolvePair(previousRequire);
  const currentManifest = readJson(path.join(root, 'packages/compiler/package.json'));
  const previousManifest = readJson(path.join(root, 'apps/www/package.json'));
  for (const entry of current)
    assert.equal(entry.version, currentManifest.devDependencies[entry.name]);
  for (const entry of previous)
    assert.equal(entry.version, previousManifest.dependencies[entry.name]);
  assert.equal(current[0].version, current[1].version);
  assert.equal(previous[0].version, previous[1].version);
  assert.match(previous[0].version, /^(?:18\.3|19\.[01])\.\d+$/);
  assert.notEqual(current[0].version, previous[0].version, 'Historical peer must be distinct');
  const browser = realpathSync(process.env.PUI_CHROMIUM_EXECUTABLE);
  const browserVersion = execFileSync(browser, ['--version'], { encoding: 'utf8' }).trim();
  assert.match(browserVersion, /(?:Chromium|Chrome)/);
  const variables = {
    PUI_PREVIOUS_REACT_DIR: previous[0].directory,
    PUI_PREVIOUS_REACT_DOM_DIR: previous[1].directory,
  };
  for (const [name, value] of Object.entries(variables)) {
    assert.ok(!/[\r\n\0]/.test(value));
    appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
  }
  writeJson(path.join(evidence, 'environment.json'), {
    node: process.version,
    pnpm: execFileSync('corepack', ['pnpm@10.32.1', '--version'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    platform: process.platform,
    architecture: process.arch,
    currentReact: current,
    previousReact: previous,
    chromium: { path: browser, version: browserVersion, sha256: hash(readFileSync(browser)) },
    playwright: compilerRequire('playwright-core/package.json').version,
    rustc: execFileSync('rustc', ['--version', '--verbose'], { encoding: 'utf8' }),
    cargo: execFileSync('cargo', ['--version'], { encoding: 'utf8' }).trim(),
    cargoTarget: process.env.CARGO_TARGET_DIR,
  });
}

async function run(root, evidence, kind) {
  const plan = readJson(path.join(evidence, 'plan.json'));
  assert.equal(root, plan.root);
  assertExactSource(runtimeSourceSnapshot(root), plan.candidate.checkoutSha);
  assert.deepEqual(runtimeSourceSnapshot(driverRoot), plan.driver);
  const args = commandArgs(kind, plan, evidence);
  const executable = commandExecutable(kind);
  if (kind === 'docs')
    assert.ok(
      !existsSync(path.join(root, websiteGraph)),
      'Do not reuse an earlier production graph'
    );
  if (kind === 'build') {
    const bytes = execFileSync(
      process.execPath,
      ['scripts/build/public-packages.mjs', '--plan', '--json'],
      { cwd: root }
    );
    writeFileSync(path.join(evidence, 'public-build-plan.json'), bytes, { flag: 'wx' });
  }
  const stdout = createWriteStream(path.join(evidence, `${kind}.stdout.log`), { flags: 'wx' });
  const stderr = createWriteStream(path.join(evidence, `${kind}.stderr.log`), { flags: 'wx' });
  const startedAt = new Date().toISOString();
  let error = null;
  const child = spawn(executable, args, {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    stdout.write(chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr.write(chunk);
    process.stderr.write(chunk);
  });
  child.once('error', (reason) => {
    error = reason.message;
  });
  const [exitCode, signal] = await new Promise((resolve) =>
    child.once('close', (...result) => resolve(result))
  );
  await Promise.all([
    new Promise((resolve) => stdout.end(resolve)),
    new Promise((resolve) => stderr.end(resolve)),
  ]);
  writeJson(path.join(evidence, `${kind}.execution.json`), {
    session: plan.session,
    candidateSha: plan.candidate.checkoutSha,
    driverSha: plan.driver.checkoutSha,
    executable,
    args,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    signal,
    error,
  });
  process.exitCode = exitCode === 0 && signal === null && error === null ? 0 : 1;
}

function finalize(root, evidence) {
  const problems = [];
  const verify = (label, check) => {
    try {
      return check();
    } catch (error) {
      problems.push(`${label}: ${error.message}`);
      return null;
    }
  };
  const plan = verify('source plan', () => readJson(path.join(evidence, 'plan.json')));
  const outcome = verify('workflow steps', () => {
    const steps = JSON.parse(process.env.WORKFLOW_STEP_OUTCOMES);
    validateWorkflowSteps(steps);
    return steps;
  });
  const after = verify('source stability', () => {
    assert.equal(root, plan.root);
    const candidate = runtimeSourceSnapshot(root);
    assertExactSource(candidate, plan.candidate.checkoutSha);
    assert.deepEqual(candidate, plan.candidate);
    assert.deepEqual(runtimeSourceSnapshot(driverRoot), plan.driver, 'Driver source changed');
    for (const binding of plan.sourceBindings)
      assert.equal(hash(readFileSync(path.join(root, binding.path))), binding.sha256, binding.path);
    return candidate;
  });
  const executions = {};
  for (const kind of ['build', 'compiler', 'docs', 'website'])
    executions[kind] = verify(`${kind} process`, () => {
      const execution = readJson(path.join(evidence, `${kind}.execution.json`));
      validateExecution(
        execution,
        plan,
        commandArgs(kind, plan, evidence),
        commandExecutable(kind)
      );
      return execution;
    });
  const build = verify('public build', () => {
    const result = readJson(path.join(evidence, 'build.stdout.log'));
    validatePublicBuild(readJson(path.join(evidence, 'public-build-plan.json')), result);
    return result;
  });
  let events = [];
  const node = verify('complete Node consumers', () => {
    events = readFileSync(path.join(evidence, 'node-events.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    return validateNodeEvents(events, plan.files, root);
  });
  const native = verify('native GPUI consumer', () => {
    const messages = events
      .filter(
        (event) =>
          event.type === 'test:diagnostic' &&
          event.data.file &&
          path.resolve(event.data.file) ===
            path.join(root, testDirectory, 'gpui-target.node-test.mjs')
      )
      .map((event) => event.data.message)
      .join('\n');
    const summaries = [
      ...messages.matchAll(
        /^test result: ok\. (\d+) passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;/gm
      ),
    ];
    assert.equal(summaries.length, 1, 'Missing unique original Cargo native summary');
    assert.ok(Number(summaries[0][1]) > 0);
    assert.ok(
      messages.includes(
        'Resolved GPUI: git+https://github.com/zed-industries/zed?rev=62e5991dd0f0c8a3af8d5e7e9c4652490d468db8#62e5991dd0f0c8a3af8d5e7e9c4652490d468db8'
      )
    );
    return { passed: Number(summaries[0][1]), failed: 0, ignored: 0, filtered: 0 };
  });
  const artifacts = {};
  artifacts.website = verify('actual production graph', () => {
    const file = path.join(root, websiteGraph);
    assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink());
    const graph = readFileSync(file);
    JSON.parse(graph);
    const destination = path.join(evidence, 'generated', 'website', 'proto-ui-bundle-graph.json');
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(file, destination);
    return { path: websiteGraph, bytes: graph.length, sha256: hash(graph) };
  });
  for (const [kind, variable, required] of [
    ['react', 'PROTO_UI_REACT_CONSUMER_DIR', ['app.tsx', 'authored-source.json']],
    [
      'gpui',
      'PROTO_UI_GPUI_CONSUMER_DIR',
      [
        'Cargo.toml',
        'Cargo.lock',
        'tests/native.rs',
        'src/authoring_badge.rs',
        'src/direct_pair_reader.rs',
        'tabs-owner-source.json',
      ],
    ],
  ])
    artifacts[kind] = verify(`${kind} generated artifacts`, () => {
      const files = copyConsumerSources(
        process.env[variable],
        path.join(evidence, 'generated', kind)
      );
      for (const suffix of required)
        assert.ok(
          files.some((file) => file.path.endsWith(`/${suffix}`)),
          `Missing ${suffix}`
        );
      return files;
    });
  const generator = verify('source-built generator', () => {
    const file = process.env.PROTO_UI_GPUI_GENERATOR;
    assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink());
    return { path: file, sha256: hash(readFileSync(file)) };
  });
  writeJson(path.join(evidence, 'terminal.json'), {
    schemaVersion: 1,
    passed: problems.length === 0,
    session: plan?.session ?? null,
    candidate: plan?.candidate ?? null,
    driver: plan?.driver ?? null,
    sourceAfter: after,
    workflowSteps: outcome,
    executions,
    publicBuild: build,
    node,
    native,
    generator,
    artifacts,
    problems,
    acceptance:
      'Only the complete selected compiler tests, public package build and original Website production build/owner check; not all language features or Adapter migration.',
  });
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === reporter) {
  const [command, candidateRoot, evidenceRoot, ...args] = process.argv.slice(2);
  const root = path.resolve(candidateRoot);
  const evidence = path.resolve(evidenceRoot);
  if (command === 'prepare') prepare(root, evidence, ...args);
  else if (command === 'environment') environment(root, evidence);
  else if (command === 'run') await run(root, evidence, args[0]);
  else if (command === 'finish') finalize(root, evidence);
  else throw new Error(`Unknown command: ${command}`);
}
