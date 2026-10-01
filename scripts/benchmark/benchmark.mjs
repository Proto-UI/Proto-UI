import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  schemas,
  dimensions,
  statuses,
  validateDocument,
  measured,
  unavailable,
  summarizeChecks,
  outcomeStatus,
} from './schemas.mjs';
import { verifyRun } from './verify-run.mjs';
import {
  publicFixtures,
  publicDatasetPath,
  negativeControlDeviation,
  fixtureArtifact,
  retainBrowserIdentity,
  deriveChecks,
} from './calibration-policy.mjs';
import {
  sha256,
  json,
  readJson,
  safeFile,
  writeNew,
  listFiles,
  sealEvidence,
  verifyEvidence,
} from './evidence.mjs';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultDataset = publicDatasetPath;

export function loadDataset(datasetPath = defaultDataset) {
  const dataset = validateDocument('dataset', readJson(safeFile(root, datasetPath)));
  const cases = dataset.cases.map((file) =>
    validateDocument('case', readJson(safeFile(root, file)))
  );
  if (new Set(cases.map((item) => item.id)).size !== cases.length)
    throw new Error('Duplicate case IDs');
  for (const item of cases) {
    if (
      item.datasetId !== dataset.id ||
      item.source.sha !== dataset.source.sha ||
      item.source.repository !== dataset.source.repository
    )
      throw new Error(`Dataset/source mismatch: ${item.id}`);
    for (const material of [...item.visibility.ordinary, ...item.visibility.knowledge]) {
      if (sha256(fs.readFileSync(safeFile(root, material.path))) !== material.sha256)
        throw new Error(`Material digest mismatch: ${material.path}`);
    }
  }
  const scoring = validateDocument('scoring', readJson(safeFile(root, dataset.scoringPath)));
  if (
    JSON.stringify(scoring.dimensions) !== JSON.stringify(dimensions) ||
    JSON.stringify(scoring.statuses) !== JSON.stringify(statuses)
  )
    throw new Error('Scoring vocabulary differs from result schema');
  return { dataset, cases, scoring };
}
export function requireCalibration(dataset, cases) {
  if (
    dataset.status !== 'draft' ||
    cases.some((item) => item.split !== 'development' || item.origin !== 'public-calibration')
  )
    throw new Error(
      'This runner only accepts draft public development calibration. Strict/model/evaluation/held-out runs are BLOCKED: no verified external isolation executor is implemented.'
    );
}
export function participantPacket(item, arm) {
  if (!['blind', 'knowledge'].includes(arm)) throw new Error(`Unknown arm: ${arm}`);
  if (item.split !== 'development' || item.origin !== 'public-calibration')
    throw new Error('Strict participant packaging is blocked until isolated execution exists');
  const materials = [
    ...item.visibility.ordinary,
    ...(arm === 'knowledge' ? item.visibility.knowledge : []),
  ];
  // Deliberately project only approved ordinary task text and materials, never serialize the case.
  const prompt = `${item.title}\n\n${item.requirements}\n`;
  return {
    prompt,
    files: materials.map((material, index) => {
      const content = fs.readFileSync(safeFile(root, material.path));
      if (sha256(content) !== material.sha256) throw new Error('Material changed since validation');
      return { name: `material-${index + 1}.txt`, content, sha256: material.sha256 };
    }),
  };
}
export function preparePacket(item, arm, output) {
  const packet = participantPacket(item, arm);
  fs.mkdirSync(output, { recursive: false });
  writeNew(output, 'task.txt', packet.prompt);
  for (const file of packet.files) writeNew(output, file.name, file.content);
  // Exposure details are evaluator metadata, not placed in a model-visible packet.
  return {
    arm,
    promptSha256: sha256(packet.prompt),
    files: packet.files.map(({ name, sha256: digest }) => ({ name, sha256: digest })),
    boundary: 'public-calibration-only',
  };
}
export const summarizeDimensions = summarizeChecks;

function snapshotSources(output) {
  const files = [
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/interaction-benchmark-calibration.yml',
    ...listFiles(path.join(root, 'scripts/benchmark')).map((p) => `scripts/benchmark/${p}`),
    ...listFiles(path.join(root, 'benchmarks/interaction')).map(
      (p) => `benchmarks/interaction/${p}`
    ),
  ].sort();
  const inventory = files.map((file) => {
    const content = fs.readFileSync(safeFile(root, file));
    writeNew(output, `source/${file}`, content);
    return { path: file, sha256: sha256(content) };
  });
  const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const diff = execFileSync(
    'git',
    [
      'diff',
      '--binary',
      'HEAD',
      '--',
      'package.json',
      '.gitignore',
      'scripts/benchmark',
      'benchmarks/interaction',
      '.github/workflows/interaction-benchmark-calibration.yml',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  writeNew(output, 'source-worktree.patch', diff);
  writeNew(
    output,
    'source-inventory.json',
    json({
      gitHead,
      note: 'Base source SHA is separate from these exact harness and fixture bytes. Untracked files are included by this inventory.',
      files: inventory,
    })
  );
  return { gitHead, digest: sha256(json(inventory)), inventory };
}
function assertSnapshotUnchanged(snapshot) {
  for (const item of snapshot.inventory)
    if (sha256(fs.readFileSync(safeFile(root, item.path))) !== item.sha256)
      throw new Error(`Benchmark source changed during run: ${item.path}`);
}
export function assertFormalExecutionBlocked() {
  throw new Error(
    'BLOCKED: model/evaluation/held-out execution is not implemented. Need an independently reviewed frozen dataset/oracle, a verifiable external filesystem+git+network boundary, exact authorized model access and budget. A manifest assertion or fresh agent on this shared machine cannot enable it.'
  );
}
export async function dryRun({
  output,
  repeats = 1,
  arms = ['blind', 'knowledge'],
  selectedCases = null,
  chromiumPath = process.env.CHROME_PATH || '/usr/bin/chromium',
  negativeControl = false,
}) {
  const { dataset, cases: allCases, scoring } = loadDataset();
  const cases = selectedCases
    ? allCases.filter((item) => selectedCases.includes(item.id))
    : allCases;
  for (const item of cases)
    if (!Object.hasOwn(publicFixtures, item.id))
      throw new Error(
        `Unsupported calibration case without explicit fixture/oracle mapping: ${item.id}`
      );
  if (!cases.length || (selectedCases && cases.length !== selectedCases.length))
    throw new Error('Unknown, duplicate, or empty case selection');
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10)
    throw new Error('Calibration repetitions must be an integer in 1..10');
  if (
    !arms.length ||
    new Set(arms).size !== arms.length ||
    arms.some((arm) => !['blind', 'knowledge'].includes(arm))
  )
    throw new Error('Invalid arms');
  requireCalibration(dataset, cases);
  output = path.resolve(output);
  // Never put output inside snapshotted inputs or a previously used run directory.
  if (
    output === root ||
    output.startsWith(path.join(root, 'scripts')) ||
    output.startsWith(path.join(root, 'benchmarks'))
  )
    throw new Error('Output must be outside benchmark source directories');
  fs.mkdirSync(output, { recursive: false });
  const startedAt = new Date().toISOString();
  const runId = `calibration-${startedAt.replace(/[^0-9]/g, '')}`;
  const eventFd = fs.openSync(path.join(output, 'events.jsonl'), 'wx');
  let seq = 0;
  const event = (type, data = {}) =>
    fs.writeSync(
      eventFd,
      `${JSON.stringify({ seq: ++seq, at: new Date().toISOString(), type, ...data })}\n`
    );
  const results = [];
  let manifest;
  let terminalError = null;
  try {
    const snapshot = snapshotSources(output);
    assertSnapshotUnchanged(snapshot);
    writeNew(output, 'dataset.json', json(dataset));
    writeNew(output, 'scoring.json', json(scoring));
    const stubReason =
      'Not measured: this public dry run copies handwritten fixtures and invokes no model';
    manifest = {
      schemaVersion: 1,
      runId,
      startedAt,
      kind: 'calibration-stub',
      source: dataset.source,
      dataset: { id: dataset.id, version: dataset.version, sha256: sha256(json(dataset)) },
      scoring: { version: scoring.version, sha256: sha256(json(scoring)), frozen: scoring.frozen },
      participant: {
        kind: 'handwritten-fixture',
        ...Object.fromEntries(
          [
            'provider',
            'modelId',
            'modelSnapshot',
            'modelReleaseDate',
            'reasoning',
            'sampling',
            'context',
            'tools',
            'seed',
            'independentContext',
          ].map((key) => [key, unavailable(stubReason)])
        ),
      },
      harness: {
        version: 'p0-calibration-v1',
        sourceDigest: snapshot.digest,
        node: process.version,
        packageManager: measured(
          JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).packageManager
        ),
        toolchain: measured({
          gitHead: snapshot.gitHead,
          lockfileSha256: sha256(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'))),
          sourceInventory: 'source-inventory.json',
          ci: Object.fromEntries(
            [
              'ImageOS',
              'ImageVersion',
              'GITHUB_SHA',
              'GITHUB_RUN_ID',
              'GITHUB_RUN_ATTEMPT',
              'GITHUB_WORKFLOW',
            ].map((key) => [
              key,
              process.env[key]
                ? measured(process.env[key])
                : unavailable('Not set in this execution environment'),
            ])
          ),
        }),
        os: `${os.platform()} ${os.release()} ${os.arch()}`,
        browser: unavailable('Browser has not started'),
        runtime: 'handwritten-native-html; not Proto Runtime, compiler, or generated target',
      },
      plan: {
        cases: cases.map((item) => item.id),
        arms,
        repeats,
        independence:
          'Fresh browser context per fixture; fixture repetitions are not independent model samples',
        repairBudget: 0,
        maxWallTimeSeconds: unavailable(
          'No total-run process watchdog in calibration runner; individual browser actions are bounded and exact limits are recorded in evaluator-output.json'
        ),
        maxTokens: unavailable(stubReason),
        maxCost: measured({
          amount: 0,
          currency: 'USD',
          scope: 'No external model API invoked; local infrastructure cost not measured',
        }),
      },
      exposure: {
        boundary: 'public-calibration-only',
        workspace: 'Shared development filesystem; not secure isolation',
        gitHistory: 'Repository available to coordinator; no measured subject',
        network:
          'Browser routes denied by calibration evaluator; coordinator network remains available',
        oracleAccess: 'Public evaluator exists in repository; not a hidden oracle',
        audit: unavailable('No independent isolation audit; formal execution blocked'),
      },
      deviations: negativeControl ? [negativeControlDeviation] : [],
    };
    validateDocument('run', manifest);
    writeNew(output, 'run-start.json', json(manifest));
    event('run-start', { runId, kind: manifest.kind });
    const { evaluateCalibration } = await import('./browser-calibration.mjs');
    for (const item of cases) {
      writeNew(output, `tasks/${item.id}.json`, json(item));
      for (const arm of arms)
        for (let repeat = 1; repeat <= repeats; repeat++) {
          assertSnapshotUnchanged(snapshot);
          const relative = `cells/${item.id}/${arm}/${repeat}`;
          const cellDir = path.join(output, relative);
          fs.mkdirSync(cellDir, { recursive: true });
          const packet = preparePacket(item, arm, path.join(cellDir, 'participant'));
          writeNew(cellDir, 'exposure.json', json(packet));
          const fixture = publicFixtures[item.id];
          let html = fs.readFileSync(
            path.join(output, `source/benchmarks/interaction/fixtures/${fixture}.html`),
            'utf8'
          );
          html = fixtureArtifact(html, manifest.deviations);
          writeNew(cellDir, 'artifact.html', html);
          const evidenceDir = path.join(cellDir, 'evidence');
          fs.mkdirSync(evidenceDir);
          const cellStart = new Date().toISOString();
          const start = performance.now();
          event('cell-start', { caseId: item.id, arm, repeat });
          let evaluated;
          try {
            evaluated = await evaluateCalibration({
              caseId: item.id,
              htmlPath: path.join(cellDir, 'artifact.html'),
              evidenceDir,
              chromiumPath,
            });
          } catch (error) {
            writeNew(evidenceDir, 'harness-error.txt', `${error.stack ?? error}\n`);
            evaluated = {
              checks: [
                {
                  id: 'harness-execution',
                  dimension: 'host',
                  status: 'blocked',
                  reason: String(error.message ?? error),
                  evidence: ['harness-error.txt'],
                },
              ],
              failures: [{ stage: 'harness', message: String(error.message ?? error) }],
              browser: null,
              environment: {},
            };
          }
          writeNew(cellDir, 'evaluator-output.json', json(evaluated));
          manifest.harness.browser = retainBrowserIdentity(
            manifest.harness.browser,
            evaluated.browser
          );

          assertSnapshotUnchanged(snapshot);
          const checks = deriveChecks(evaluated.checks, item, evidenceDir);
          const status = outcomeStatus(checks);
          const result = {
            schemaVersion: 1,
            runId,
            caseId: item.id,
            arm,
            repeat,
            kind: 'calibration-stub',
            status,
            startedAt: cellStart,
            finishedAt: new Date().toISOString(),
            promptSha256: packet.promptSha256,
            artifactSha256: sha256(html),
            oracleRef: item.oracleRef,
            checks,
            dimensions: summarizeDimensions(checks),
            metrics: {
              requirementRecall: unavailable(stubReason),
              falseRequirements: unavailable(stubReason),
              discoveryCrosswalk: unavailable(stubReason),
              firstPassCorrectness: measured({
                scope: 'executed-public-calibration-checks-only',
                status,
              }),
              finalCorrectness: measured({
                scope: 'executed-public-calibration-checks-only',
                status,
              }),
              repairCycles: 0,
              convergence: unavailable('No repair loop in fixture smoke test'),
              tokens: unavailable(stubReason),
              compute: unavailable(
                'CPU/GPU accounting unavailable; elapsed harness time recorded separately'
              ),
              wallTimeMs: performance.now() - start,
              humanWork: unavailable(
                'Human/evaluator authoring work not instrumented; never interpreted as zero'
              ),
            },
            failures: evaluated.failures ?? [],
            exclusions: item.exclusions,
            deviations: manifest.deviations,
          };
          validateDocument('result', result);
          writeNew(cellDir, 'result.json', json(result));
          results.push(result);
          event('cell-finish', { caseId: item.id, arm, repeat, status });
        }
    }
  } catch (error) {
    terminalError = error;
    writeNew(
      output,
      'failure.json',
      json({
        status: 'blocked',
        message: String(error.message ?? error),
        stack: String(error.stack ?? error),
        completedCells: results.length,
      })
    );
    event('run-aborted', {
      message: String(error.message ?? error),
      completedCells: results.length,
    });
  } finally {
    if (manifest) writeNew(output, 'run.json', json(validateDocument('run', manifest)));
    writeNew(output, 'results.json', json(results));
    const report = renderReport(manifest, results, terminalError);
    writeNew(output, 'report.md', report);
    event('run-finish', { aborted: Boolean(terminalError), completedCells: results.length });
    fs.closeSync(eventFd);
    sealEvidence(output);
  }
  return {
    output,
    runId,
    status: terminalError
      ? 'blocked'
      : results.some((r) => r.status === 'fail')
        ? 'fail'
        : results.some((r) => r.status === 'blocked')
          ? 'blocked'
          : 'calibration-complete',
    cells: results.length,
    evidence: verifyRun(output),
  };
}
export function renderReport(manifest, results, error = null) {
  const lines = [
    '# Public calibration dry run',
    '',
    '**No model was evaluated. No Proto UI advantage, conformance, strict-blind isolation, or benchmark readiness conclusion is supported.**',
    '',
    `Run: ${manifest?.runId ?? 'initialization-failed'}`,
    `Base source: ${manifest?.source.sha ?? 'unavailable'}`,
    `Harness bytes: ${manifest?.harness.sourceDigest ?? 'unavailable'}`,
    `Completed cells: ${results.length}`,
    `Aborted: ${Boolean(error)}`,
    '',
    '## Per-cell evidence',
    '',
  ];
  for (const row of results)
    lines.push(
      `- ${row.caseId} / ${row.arm} / repeat ${row.repeat}: ${row.status}; ${row.checks.filter((c) => c.status === 'pass').length} passed checks, ${row.checks.filter((c) => c.status === 'fail').length} failed checks; ${row.metrics.wallTimeMs.toFixed(1)} ms`,
      ...Object.entries(row.dimensions).map(
        ([name, value]) =>
          `  - ${name}: ${value.status} (${value.passed} pass / ${value.failed} fail / ${value.other} other)`
      )
    );
  lines.push('', '## Repeatability (fixture checks, not model variance)', '');
  for (const caseId of new Set(results.map((r) => r.caseId)))
    for (const arm of new Set(results.map((r) => r.arm))) {
      const rows = results.filter((r) => r.caseId === caseId && r.arm === arm);
      if (!rows.length) continue;
      const signatures = new Set(
        rows.map((r) => JSON.stringify(r.checks.map((c) => [c.id, c.status])))
      );
      lines.push(
        `- ${caseId} / ${arm}: n=${rows.length}; ${rows.length < 2 ? 'repeatability unavailable (one repetition)' : `${signatures.size} distinct check-outcome vectors`}. Elapsed range ${Math.min(...rows.map((r) => r.metrics.wallTimeMs)).toFixed(1)}–${Math.max(...rows.map((r) => r.metrics.wallTimeMs)).toFixed(1)} ms; not model cost or uncertainty.`
      );
    }
  lines.push(
    '',
    '## Limitations',
    '',
    '- All cases and oracle expectations are public development fixtures; none is eligible for strict held-out use.',
    '- The blind/knowledge labels test packet projection only; copied fixture outputs do not measure knowledge treatment effects.',
    '- Handwritten HTML fixtures are not real Proto components, generated facades, compiler output, or native-vs-Proto performance references.',
    '- No composite score. Missing evidence, failures, exclusions and deviations remain in each result. Scope exclusions never become passes.',
    '- Accessibility snapshots are not screen-reader testing. Lifecycle/cleanup observations cover only fixture removal/repetition; Proto owner lifetime, leaks and cross-host conformance remain untested.',
    '- Manifest identities and token/compute/human-work measures are null with reasons when unavailable. Zero is never substituted.',
    '- The archive is write-once by this runner and hash-verifiable, not trusted immutable storage; copy it to independently controlled storage before formal evaluation.',
    '- Formal model execution is disabled. Freeze interaction-benchmark-v0 only after independent oracle review, negative controls, boundary audit, exact model/budget, and >=3 independent repetitions per cell are ready.'
  );
  if (error) lines.push('', `Initialization/execution failure: ${error.message ?? error}`);
  return `${lines.join('\n')}\n`;
}
function parseArgs(argv) {
  const command = argv.shift();
  const options = {};
  while (argv.length) {
    const key = argv.shift();
    if (key === '--negative-control') {
      options.negativeControl = true;
      continue;
    }
    if (
      !['--out', '--repeats', '--arm', '--case', '--chromium', '--kind'].includes(key) ||
      !argv[0] ||
      argv[0].startsWith('--')
    )
      throw new Error(`Unknown or incomplete option ${key}`);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option ${key}`);
    options[key] = argv.shift();
  }
  return { command, options };
}
async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'schemas') {
    process.stdout.write(json(schemas));
    return;
  }
  if (command === 'validate') {
    const value = loadDataset();
    process.stdout.write(
      `Validated ${value.cases.length} public development cases; formal execution remains blocked.\n`
    );
    return;
  }
  if (command === 'run') assertFormalExecutionBlocked();
  if (command === 'verify') {
    if (!options['--out']) throw new Error('verify requires --out');
    process.stdout.write(json(verifyRun(path.resolve(options['--out']))));
    return;
  }
  if (command === 'prepare') {
    const { cases } = loadDataset();
    const item = cases.find((c) => c.id === options['--case']);
    if (!item || !options['--out'] || !options['--arm'])
      throw new Error('prepare requires --case, --arm, --out');
    process.stdout.write(
      json(preparePacket(item, options['--arm'], path.resolve(options['--out'])))
    );
    return;
  }
  if (command !== 'dry-run' || !options['--out'])
    throw new Error(
      'Usage: benchmark.mjs validate | schemas | prepare --case ID --arm blind|knowledge --out NEW_DIR | dry-run --out NEW_DIR [--repeats N] [--case ID] [--arm blind|knowledge|both] [--chromium PATH] [--negative-control] | verify --out DIR'
    );
  if (options['--kind'] && options['--kind'] !== 'calibration-stub') assertFormalExecutionBlocked();
  const arm = options['--arm'] ?? 'both';
  const result = await dryRun({
    output: options['--out'],
    repeats: options['--repeats'] === undefined ? 1 : Number(options['--repeats']),
    arms: arm === 'both' ? ['blind', 'knowledge'] : [arm],
    selectedCases: options['--case'] ? [options['--case']] : null,
    chromiumPath: options['--chromium'] ?? process.env.CHROME_PATH ?? '/usr/bin/chromium',
    negativeControl: options.negativeControl ?? false,
  });
  process.stdout.write(json(result));
  if (result.status !== 'calibration-complete') process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
