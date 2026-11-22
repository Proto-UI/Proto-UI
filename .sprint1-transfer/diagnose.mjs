// Read-only native/type diagnostics, serially owned by the candidate's original
// runSprint1Command. This carrier run is never a full Sprint1 acceptance pass.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  TOOL_ROOT, TYPE_BASE, fileHash, git, loadManifest, readJson, runtimeOrigin,
  verifyCarrier, writeJson,
} from './common.mjs';
import { archiveProductionAssets } from './assets.mjs';

const operation = process.argv[2];
assert.ok(['prepare', 'run', 'finish'].includes(operation), 'Only prepare/run/finish is accepted');
const manifest = loadManifest();
const origin = runtimeOrigin(manifest);
const workspace = process.env.GITHUB_WORKSPACE;
const candidate = path.join(workspace, 'candidate');
const baseline = path.join(workspace, 'baseline');
const carrier = path.join(workspace, 'carrier');
const output = path.join(process.env.RUNNER_TEMP, 'sprint1-transfer-diagnostic');
mkdirSync(output, { recursive: true });
verifyCarrier(carrier, manifest, origin);
assert.equal(process.env.CANDIDATE_SHA, manifest.target.sha);
const { runtimeSourceSnapshot } = await import(pathToFileURL(path.join(candidate, 'scripts/test/runtime-observation.mjs')));
const { assertRuntimeSource } = await import(pathToFileURL(path.join(candidate, 'scripts/test/runtime-ci.mjs')));
const { sprint1Plan, runSprint1Command, assertSprint1StepEvidence } = await import(pathToFileURL(path.join(candidate, 'scripts/test/sprint1-evidence.mjs')));
const shaFor = (repo) => repo === candidate ? manifest.target.sha : TYPE_BASE;
const treeFor = (repo) => repo === candidate ? manifest.target.tree : manifest.typeBaseline.tree;
function checkedSource(repo) {
  const source = runtimeSourceSnapshot(repo);
  assertRuntimeSource({ before: source, after: source }, { checkoutSha: shaFor(repo) });
  assert.equal(source.treeSha, treeFor(repo));
  return source;
}
const planPath = path.join(output, 'plan.json');
const progressPath = path.join(output, 'progress.json');
const summaryPath = path.join(output, 'summary.json');
const commonBoundary = {
  diagnosticOnly: true, formalAcceptance: false, origin,
  wrapper: 'Candidate runSprint1Command, including original 500ms owner scanner and bounded descendant cleanup',
  boundaries: [
    'Production profiling changes cost; its original 1000ms verdict remains diagnostic and must not replace ordinary unprofiled acceptance.',
    'Matrix retains the original selected case and original deadlines. Unselected cases are not claimed.',
    'This is not the full11-step Sprint1 inventory or full scheduled regression cycle.',
    'Baseline/candidate TS uses exact changed website roots plus actual import closure and each real project config; full Astro checks are separate steps.',
    'Source transfer does not merge the PR or grant ready/Issue acceptance.',
  ],
};

function writeTypeConfigs() {
  const directory = path.join(output, 'types');
  mkdirSync(directory, { recursive: true });
  const variants = [];
  for (const [variant, repo] of [['baseline', baseline], ['candidate', candidate]]) {
    const present = manifest.websiteTsRoots.filter((file) => existsSync(path.join(repo, file)));
    const absent = manifest.websiteTsRoots.filter((file) => !present.includes(file));
    const config = path.join(directory, `${variant}-all.tsconfig.json`);
    writeJson(config, { extends: path.join(repo, 'apps/www/tsconfig.json'),
      files: [path.join(repo, 'apps/www/src/env.d.ts'), ...present.map((file) => path.join(repo, file))],
      include: [], exclude: [], compilerOptions: { noEmit: true, incremental: false } });
    variants.push({ variant, repo, source: checkedSource(repo), config, roots: present,
      notPresentInRevision: absent,
      hashes: Object.fromEntries(['pnpm-lock.yaml', 'tsconfig.json', 'apps/www/tsconfig.json',
        'apps/www/src/env.d.ts', ...present].map((file) => [file, fileHash(path.join(repo, file))])) });
  }
  writeJson(path.join(directory, 'scope.json'), { ...commonBoundary, variants,
    notTsWebsiteChanges: manifest.notTsWebsiteChanges });
  return variants;
}
function createPlan() {
  const original = sprint1Plan(output, manifest.target.sha, candidate);
  const selected = (id) => {
    const step = original.find((entry) => entry.id === id);
    assert.ok(step, `Missing original step: ${id}`);
    return { ...step, repo: candidate };
  };
  const command = (id, repo, executable, args, timeoutMs, requires = [], env = {}) =>
    ({ id, repo, executable, args, timeoutMs, requires, env });
  const variants = writeTypeConfigs();
  return [
    command('install-candidate', candidate, 'corepack', ['pnpm@10.32.1', 'install', '--frozen-lockfile'], 300_000),
    command('install-baseline', baseline, 'corepack', ['pnpm@10.32.1', 'install', '--frozen-lockfile'], 300_000),
    command('configure-toolbar', candidate, 'corepack', ['pnpm@10.32.1', '--filter', 'apps-www', 'exec', 'astro', 'preferences', 'disable', 'devToolbar'], 30_000, ['install-candidate']),
    { ...selected('styles'), requires: ['configure-toolbar'] },
    { ...selected('matrix-accessibility-consumer'), requires: ['styles'] },
    { ...selected('search-production'), requires: ['configure-toolbar'],
      env: { ...selected('search-production').env, PROTO_UI_SEARCH_RUNTIME_PROFILE: '1' } },
    ...variants.map(({ variant, repo, config }) => ({
      ...command(`${variant}-website-types`, repo, process.execPath,
        ['--max-old-space-size=8192', path.join(repo, 'node_modules/typescript/bin/tsc'),
          '-p', config, '--noEmit', '--pretty', 'false', '--extendedDiagnostics'],
        600_000, [`install-${variant}`]),
      typeConfig: config,
    })),
    ...variants.map(({ variant, repo }) => command(`${variant}-astro`, repo, 'corepack',
      ['pnpm@10.32.1', '-s', 'check:types:docs'], 1200_000, [`install-${variant}`],
      { NODE_OPTIONS: '--max-old-space-size=8192' })),
  ];
}
function saveProgress(plan, results, current = null, halt = null) {
  writeJson(progressPath, { ...commonBoundary, plan: plan.steps.map((step) => step.id),
    results, current, halt, at: new Date().toISOString() });
}
function typeOptions(step) {
  const require = createRequire(path.join(step.repo, 'package.json'));
  const ts = require('typescript');
  const json = readJson(step.typeConfig);
  const parsed = ts.parseJsonConfigFileContent(json, ts.sys, path.dirname(step.typeConfig));
  assert.equal(parsed.errors.length, 0,
    parsed.errors.map((entry) => ts.flattenDiagnosticMessageText(entry.messageText, '\n')).join('\n'));
  const capture = { source: checkedSource(step.repo), typescript: ts.version, node: process.version,
    config: step.typeConfig, configSha256: fileHash(step.typeConfig),
    effectiveOptions: JSON.parse(JSON.stringify(parsed.options).replaceAll(step.repo, '<repo>')) };
  writeJson(path.join(output, 'types', `${step.id}-options.json`), capture);
  return capture;
}

if (operation === 'prepare') {
  assert.equal(existsSync(planPath), false, 'Fresh per-attempt evidence required');
  const source = checkedSource(candidate);
  const typeBaselineSource = checkedSource(baseline);
  const plan = { ...commonBoundary, source, typeBaselineSource, startedAt: new Date().toISOString(),
    totalBudgetMs: 95 * 60_000, steps: createPlan() };
  writeJson(path.join(output, 'environment.json'), { origin, source, node: process.version,
    platform: process.platform, arch: process.arch, kernel: os.release(),
    cpuCount: os.cpus().length, cpuModels: [...new Set(os.cpus().map((cpu) => cpu.model))],
    totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(), loadAverage: os.loadavg(),
    runnerOs: process.env.RUNNER_OS ?? null, runnerArch: process.env.RUNNER_ARCH ?? null });
  writeJson(planPath, plan);
  saveProgress(plan, []);
  console.log(JSON.stringify({ prepared: true, candidate: source, typeBaseline: typeBaselineSource,
    origin, selected: plan.steps.map((step) => step.id) }));
}

if (operation === 'run') {
  const plan = readJson(planPath);
  assert.deepEqual(plan.origin, origin);
  const results = [];
  let halt = null;
  const controller = new AbortController();
  const interrupt = () => { halt ??= 'interrupted'; controller.abort(); };
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, interrupt);
  const budget = setTimeout(() => { halt ??= 'budget-exhausted'; controller.abort(); }, plan.totalBudgetMs);
  try {
    for (const step of plan.steps) {
      const failedPrerequisites = (step.requires ?? []).filter((id) => !results.find((row) => row.id === id)?.passed);
      if (halt || failedPrerequisites.length) {
        const terminal = { id: step.id, terminal: halt ? `not-run-${halt}` : 'blocked-setup',
          passed: false, exitCode: null, prerequisites: failedPrerequisites, origin };
        results.push(terminal);
        writeJson(path.join(output, step.id, 'receipt.json'), terminal);
        saveProgress(plan, results, null, halt);
        continue;
      }
      let before = null;
      let after = null;
      let result = null;
      let evidence = null;
      let options = null;
      const errors = [];
      mkdirSync(path.join(output, step.id), { recursive: true });
      saveProgress(plan, results, step.id, halt);
      writeJson(path.join(output, step.id, 'selection.json'), { ...commonBoundary, step });
      try {
        before = checkedSource(step.repo);
        if (step.typeConfig) options = typeOptions(step);
        result = await runSprint1Command(step, output, { repo: step.repo, signal: controller.signal });
        if (result.survivors?.length) halt = 'blocked-cleanup';
        assert.equal(result.exitCode, 0, 'Producer exit');
        assert.equal(result.timedOut, false);
        assert.equal(result.interrupted, false);
        assert.deepEqual(result.cleanupErrors, []);
        assert.deepEqual(result.survivors, []);
        evidence = assertSprint1StepEvidence(step, shaFor(step.repo), step.repo);
      } catch (error) {
        errors.push(error.stack ?? String(error));
        if (!before) halt ??= 'blocked-source';
      }
      try {
        after = checkedSource(step.repo);
        assertRuntimeSource({ before, after }, { checkoutSha: shaFor(step.repo) });
      } catch (error) { errors.push(error.stack ?? String(error)); halt ??= 'blocked-source'; }
      let assets = null;
      if (step.id === 'search-production') {
        try {
          assets = archiveProductionAssets(candidate, output, after ?? before, origin);
          if (result?.exitCode === 0) assert.ok(assets.assets > 0, 'Successful production must preserve built JS');
        } catch (error) { errors.push(error.stack ?? String(error)); }
      }
      const receipt = { ...commonBoundary, id: step.id, terminal: result ? 'completed' : 'not-run-setup', sourceBefore: before,
        sourceAfter: after, result, evidence, typeOptions: options, assets, validationErrors: errors,
        passed: errors.length === 0 && result?.exitCode === 0,
        exitCode: errors.length === 0 ? result?.exitCode : 1 };
      results.push(receipt);
      writeJson(path.join(output, step.id, 'receipt.json'), receipt);
      saveProgress(plan, results, null, halt);
      console.log(`[sprint1-transfer] ${receipt.passed ? 'PASS' : 'FAIL'} ${step.id}`);
    }
  } finally {
    clearTimeout(budget);
    for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.off(signal, interrupt);
    saveProgress(plan, results, null, halt);
  }
  process.exitCode = results.every((row) => row.passed) ? 0 : 1;
}

if (operation === 'finish') {
  const plan = readJson(planPath);
  const progress = existsSync(progressPath) ? readJson(progressPath) : { results: [], current: null };
  const results = plan.steps.map((step) => progress.results.find((row) => row.id === step.id) ?? {
    id: step.id, terminal: step.id === progress.current ? 'interrupted-no-terminal-receipt' : 'not-run',
    passed: false, exitCode: null, origin,
  });
  const sourceErrors = [];
  const sourcesAfter = {};
  for (const [variant, repo] of [['candidate', candidate], ['baseline', baseline]]) {
    try { sourcesAfter[variant] = checkedSource(repo); }
    catch (error) { sourceErrors.push({ variant, error: error.stack ?? String(error) }); }
  }
  const summary = { ...commonBoundary, finishedAt: new Date().toISOString(),
    source: plan.source, typeBaselineSource: plan.typeBaselineSource, sourcesAfter,
    sourceErrors, results, passed: sourceErrors.length === 0 && results.every((row) => row.passed) };
  writeJson(summaryPath, summary);
  const types = results.filter((row) => /-(?:website-types|astro)$/.test(row.id)).map((row) => {
    const log = path.join(output, `${row.id}.log`);
    return { id: row.id, terminal: row.terminal, passed: row.passed,
      commandExitCode: row.result?.exitCode ?? null, timedOut: row.result?.timedOut ?? null,
      sourceBefore: row.sourceBefore ?? null, sourceAfter: row.sourceAfter ?? null,
      log: existsSync(log) ? { path: log, sha256: fileHash(log) } : null,
      options: row.typeOptions ?? null };
  });
  writeJson(path.join(output, 'types/comparison.json'), { ...commonBoundary, types,
    boundary: 'All diagnostics remain in raw logs; no filtering or zero-diagnostic inference from a failed/unrun compiler.' });
  console.log(JSON.stringify({ passed: summary.passed, origin, results: results.map((row) => ({
    id: row.id, terminal: row.terminal, passed: row.passed })) }));
  process.exitCode = summary.passed ? 0 : 1;
}
