import fs from 'node:fs';
import path from 'node:path';
import { validateDocument, unavailable } from './schemas.mjs';
import {
  calibrationHarnessVersion,
  publicFixtures,
  publicDatasetPath,
  fixtureArtifact,
  deriveChecks,
  retainBrowserIdentity,
  assertPublicCalibration,
  calibrationSourcePaths,
  evaluatorDependencySources,
  calibrationDependencyProvenance,
  auxiliarySourceModules,
  verifySourceImports,
} from './calibration-policy.mjs';
import { renderReport } from './report.mjs';
import { readJson, sha256, json, safeFile, verifyEvidence, listFiles } from './evidence.mjs';
/** Cross-bind the archive; file hashes alone cannot establish experimental validity. */
export function verifyRun(output) {
  const inventory = verifyEvidence(output);
  const results = readJson(safeFile(output, 'results.json'));
  if (!Array.isArray(results)) throw new Error('Results must be an array');
  const failure = fs.existsSync(path.join(output, 'failure.json'))
    ? validateDocument('failure', readJson(safeFile(output, 'failure.json')))
    : null;
  const events = fs
    .readFileSync(safeFile(output, 'events.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  if (events.some((event, index) => event.seq !== index + 1))
    throw new Error('Event sequence differs from append-only journal');
  const aborts = events.filter((event) => event.type === 'run-aborted');
  const finish = events.at(-1);
  if (
    finish?.type !== 'run-finish' ||
    finish.completedCells !== results.length ||
    finish.aborted !== Boolean(failure)
  )
    throw new Error('Final event differs from results/failure evidence');
  if (failure) {
    if (
      failure.completedCells !== results.length ||
      aborts.length !== 1 ||
      aborts[0].completedCells !== results.length ||
      aborts[0].message !== failure.message
    )
      throw new Error('Failure evidence differs from completed results or abort journal');
  } else if (aborts.length) throw new Error('Abort journal requires validated failure evidence');
  const checkReport = (manifest) => {
    const expected = renderReport(manifest, results, failure ? new Error(failure.message) : null);
    if (fs.readFileSync(safeFile(output, 'report.md'), 'utf8') !== expected)
      throw new Error('Report differs from verified manifest/results/failure');
  };
  if (!fs.existsSync(path.join(output, 'run.json'))) {
    if (
      !failure ||
      results.length !== 0 ||
      events.length !== 2 ||
      events[0]?.type !== 'run-aborted' ||
      ['cells', 'tasks', 'run-start.json'].some((name) => fs.existsSync(path.join(output, name)))
    )
      throw new Error('Missing run manifest without valid initialization failure');
    checkReport(undefined);
    return { ...inventory, status: 'blocked-before-manifest' };
  }
  const manifest = validateDocument('run', readJson(safeFile(output, 'run.json')));
  const dataset = validateDocument('dataset', readJson(safeFile(output, 'dataset.json')));
  const scoring = validateDocument('scoring', readJson(safeFile(output, 'scoring.json')));
  if (
    json(dataset) !== json(readJson(safeFile(output, `source/${publicDatasetPath}`))) ||
    json(scoring) !== json(readJson(safeFile(output, `source/${dataset.scoringPath}`)))
  )
    throw new Error('Dataset/scoring differs from source snapshot');
  if (manifest.scoring.version !== scoring.version || manifest.scoring.frozen !== scoring.frozen)
    throw new Error('Scoring manifest metadata differs from policy');
  const start = validateDocument('run', readJson(safeFile(output, 'run-start.json')));
  const immutableManifest = {
    ...manifest,
    harness: { ...manifest.harness, browser: start.harness.browser },
  };
  if (json(immutableManifest) !== json(start))
    throw new Error('Run manifest changed outside the permitted browser identity update');
  if (
    events[0]?.type !== 'run-start' ||
    events[0].runId !== manifest.runId ||
    events[0].kind !== manifest.kind
  )
    throw new Error('Start event differs from manifest');
  if (
    sha256(json(dataset)) !== manifest.dataset.sha256 ||
    sha256(json(scoring)) !== manifest.scoring.sha256
  )
    throw new Error('Dataset/scoring digest mismatch');
  if (
    dataset.id !== manifest.dataset.id ||
    dataset.version !== manifest.dataset.version ||
    dataset.source.sha !== manifest.source.sha ||
    dataset.source.repository !== manifest.source.repository
  )
    throw new Error('Run dataset/source mismatch');
  if (manifest.kind !== 'calibration-stub' || dataset.status !== 'draft')
    throw new Error('Only draft public calibration archives are supported');
  const source = validateDocument(
    'sourceInventory',
    readJson(safeFile(output, 'source-inventory.json'))
  );
  if (sha256(json(source.files)) !== manifest.harness.sourceDigest)
    throw new Error('Harness source digest mismatch');
  const sourceRoot = safeFile(output, 'source');
  const physicalSources = listFiles(sourceRoot);
  if (json(source.files.map((file) => file.path)) !== json(physicalSources))
    throw new Error('Source inventory does not exactly cover retained source files');
  for (const item of source.files)
    if (sha256(fs.readFileSync(safeFile(output, `source/${item.path}`))) !== item.sha256)
      throw new Error(`Source snapshot changed: ${item.path}`);
  const toolchain = manifest.harness.toolchain.value;
  if (
    toolchain?.sourceInventory !== 'source-inventory.json' ||
    toolchain.lockfileSha256 !== sha256(fs.readFileSync(safeFile(sourceRoot, 'pnpm-lock.yaml'))) ||
    manifest.harness.packageManager.value !==
      readJson(safeFile(sourceRoot, 'package.json')).packageManager
  )
    throw new Error('Harness dependency/inventory provenance differs from retained sources');
  if (manifest.harness.toolchain.value?.gitHead !== source.gitHead)
    throw new Error('Harness checkout differs from source provenance');
  const snapshotCases = dataset.cases.map((file) =>
    validateDocument('case', readJson(safeFile(output, `source/${file}`)))
  );
  assertPublicCalibration(dataset, snapshotCases);
  for (const item of snapshotCases)
    for (const material of [...item.visibility.ordinary, ...item.visibility.knowledge])
      if (sha256(fs.readFileSync(safeFile(sourceRoot, material.path))) !== material.sha256)
        throw new Error('Source material differs from declared digest');
  const expectedSources = calibrationSourcePaths(
    dataset,
    snapshotCases,
    auxiliarySourceModules.filter((file) => physicalSources.includes(file)),
    manifest.harness.version === calibrationHarnessVersion ? evaluatorDependencySources : []
  );
  if (json(physicalSources) !== json(expectedSources))
    throw new Error('Source snapshot differs from the explicit public input allowlist');
  verifySourceImports(sourceRoot, physicalSources);
  const policySource = physicalSources.includes('scripts/benchmark/calibration-policy.mjs')
    ? fs.readFileSync(safeFile(sourceRoot, 'scripts/benchmark/calibration-policy.mjs'), 'utf8')
    : '';
  const declaredProfile =
    policySource.match(/export const calibrationHarnessVersion = ['"]([^'"]+)['"]/u)?.[1] ??
    fs
      .readFileSync(safeFile(sourceRoot, 'scripts/benchmark/benchmark.mjs'), 'utf8')
      .match(/version: ['"](p0-calibration-v1)['"]/u)?.[1];
  if (manifest.harness.version !== declaredProfile)
    throw new Error('Harness profile differs from retained producer source');
  let sourceCapturePolicy;
  if ([calibrationHarnessVersion, 'p0-calibration-v2'].includes(manifest.harness.version)) {
    const capture = validateDocument(
      'sourceCapture',
      readJson(safeFile(output, 'source-capture.json'))
    );
    if (
      toolchain.sourceCapture !== 'source-capture.json' ||
      json(capture.paths) !== json(expectedSources)
    )
      throw new Error('Source capture receipt differs from explicit public sources');
    if (fs.existsSync(path.join(output, 'source-worktree.patch')))
      throw new Error('Current public-source profile must not retain historical dirty patches');
    sourceCapturePolicy = capture.policy;
  } else if (manifest.harness.version === 'p0-calibration-v1') {
    if (!fs.statSync(safeFile(output, 'source-worktree.patch')).isFile())
      throw new Error('Legacy source capture requires its retained historical patch');
    sourceCapturePolicy =
      'legacy-directory-and-history-capture; no public-source privacy guarantee';
  } else throw new Error('Unsupported calibration harness profile');

  let evaluatorDependency = null;
  if (manifest.harness.version === calibrationHarnessVersion) {
    evaluatorDependency = calibrationDependencyProvenance(sourceRoot);
    if (json(toolchain.evaluatorDependency) !== json(evaluatorDependency))
      throw new Error('Harness evaluator dependency differs from retained workspace/lock sources');
  }
  const dependencyCapturePolicy = evaluatorDependency
    ? 'workspace-declaration-and-lock-bound; observed-version-checked'
    : 'legacy-incomplete-playwright-workspace-capture';

  const datasetCaseIds = snapshotCases.map((item) => item.id);
  if (manifest.plan.cases.some((id) => !datasetCaseIds.includes(id)))
    throw new Error('Plan contains case outside the source dataset');
  const planned = manifest.plan.cases.flatMap((caseId) =>
    manifest.plan.arms.flatMap((arm) =>
      Array.from({ length: manifest.plan.repeats }, (_, index) => `${caseId}/${arm}/${index + 1}`)
    )
  );
  const started = new Set();
  let activeCell = null;
  let completed = 0;
  let abortSeen = false;
  for (const event of events.slice(1, -1)) {
    const key = `${event.caseId}/${event.arm}/${event.repeat}`;
    if (event.type === 'cell-start') {
      if (abortSeen || activeCell !== null || key !== planned[completed] || started.has(key))
        throw new Error('Cell start is missing, duplicated, or out of plan order');
      started.add(key);
      activeCell = key;
    } else if (event.type === 'cell-finish') {
      if (
        abortSeen ||
        activeCell !== key ||
        key !== planned[completed] ||
        !results[completed] ||
        event.status !== results[completed].status
      )
        throw new Error('Cell finish lacks its matching ordered start/result');
      activeCell = null;
      completed++;
    } else if (event.type === 'run-aborted') {
      if (!failure || abortSeen) throw new Error('Unexpected abort event');
      abortSeen = true;
    } else throw new Error(`Unexpected lifecycle event: ${event.type}`);
  }
  if (completed !== results.length || (!failure && activeCell !== null))
    throw new Error('Cell lifecycle journal is incomplete');
  const allowedCells = new Set(planned.slice(0, results.length + (failure ? 1 : 0)));
  const cellRoot = path.join(output, 'cells');
  for (const file of fs.existsSync(cellRoot) ? listFiles(cellRoot) : []) {
    const parts = file.split('/');
    const cell = parts.slice(0, 3).join('/');
    if (parts.length < 4 || !allowedCells.has(cell))
      throw new Error(`Orphan/unplanned cell evidence: ${file}`);
    if (!started.has(cell) && !['participant', 'exposure.json', 'artifact.html'].includes(parts[3]))
      throw new Error(`Evaluation evidence exists without a cell start: ${file}`);
  }
  let browser = unavailable('Browser has not started');
  for (const cell of planned) {
    const file = safeFile(output, `cells/${cell}/evaluator-output.json`);
    if (fs.existsSync(file)) {
      if (!started.has(cell)) throw new Error('Raw evaluator output exists without cell start');
      const raw = readJson(file);
      const environment = raw.environment;
      if (
        !environment ||
        environment.node !== manifest.harness.node ||
        `${environment.platform} ${environment.osRelease} ${environment.architecture}` !==
          manifest.harness.os
      )
        throw new Error('Harness Node/OS differs from raw environment observations');
      if (
        evaluatorDependency &&
        ((environment.playwrightVersion !== undefined &&
          environment.playwrightVersion !== evaluatorDependency.resolvedVersion) ||
          (raw.browser?.version && !environment.playwrightVersion))
      )
        throw new Error('Observed Playwright version differs from retained evaluator dependency');
      browser = retainBrowserIdentity(browser, raw.browser);
    }
  }
  if (json(manifest.harness.browser) !== json(browser))
    throw new Error('Manifest browser identity differs from ordered raw evaluator outputs');
  const finishes = events.filter((event) => event.type === 'cell-finish');
  if (
    finishes.length !== results.length ||
    finishes.some(
      (event, index) =>
        `${event.caseId}/${event.arm}/${event.repeat}` !== planned[index] ||
        event.status !== results[index].status
    )
  )
    throw new Error('Completed-cell journal differs from ordered results');
  const cells = new Set();
  for (const result of results) {
    validateDocument('result', result);
    const cell = `${result.caseId}/${result.arm}/${result.repeat}`;
    if (cell !== planned[cells.size])
      throw new Error(`Results are not a prefix of the declared plan: ${cell}`);
    if (cells.has(cell)) throw new Error(`Duplicate cell: ${cell}`);
    cells.add(cell);
    if (result.runId !== manifest.runId) throw new Error(`Unplanned result: ${cell}`);
  }
  const taskRoot = path.join(output, 'tasks');
  const allowedTaskIds = new Set([...allowedCells].map((cell) => cell.split('/')[0]));
  for (const file of fs.existsSync(taskRoot) ? listFiles(taskRoot) : []) {
    const task = validateDocument('case', readJson(safeFile(taskRoot, file)));
    const original = snapshotCases.find((item) => item.id === task.id);
    if (file !== `${task.id}.json` || !allowedTaskIds.has(task.id) || json(task) !== json(original))
      throw new Error(`Task differs from source snapshot or plan: ${file}`);
  }
  const physicalCells = new Set(
    (fs.existsSync(cellRoot) ? listFiles(cellRoot) : []).map((file) =>
      file.split('/').slice(0, 3).join('/')
    )
  );
  for (const cell of cells)
    if (!physicalCells.has(cell)) throw new Error(`Missing completed cell: ${cell}`);
  for (const cell of physicalCells) {
    const result = results.find((row) => `${row.caseId}/${row.arm}/${row.repeat}` === cell);
    const [caseId, arm] = cell.split('/');
    const dir = `cells/${cell}`;
    const present = (file) => fs.existsSync(safeFile(output, `${dir}/${file}`));
    const task = validateDocument('case', readJson(safeFile(output, `tasks/${caseId}.json`)));
    if (task.id !== caseId || (result && task.oracleRef !== result.oracleRef))
      throw new Error(`Task/result mismatch: ${cell}`);
    if (!Object.hasOwn(publicFixtures, task.id))
      throw new Error(`Unknown fixture mapping: ${task.id}`);
    for (const file of listFiles(safeFile(output, dir)))
      if (
        ![
          'participant',
          'evidence',
          'exposure.json',
          'artifact.html',
          'evaluator-output.json',
          'result.json',
        ].includes(file.split('/')[0])
      )
        throw new Error(`Unexpected cell file: ${cell}/${file}`);
    if (present('result.json') && !result)
      throw new Error(`Orphan cell result absent from aggregate: ${cell}`);
    const required = [
      'artifact.html',
      'participant/task.txt',
      'exposure.json',
      'evaluator-output.json',
      'result.json',
    ];
    if (result && required.some((file) => !present(file)))
      throw new Error(`Missing completed-cell input: ${cell}`);
    if (
      present('evaluator-output.json') &&
      ['artifact.html', 'participant/task.txt', 'exposure.json'].some((file) => !present(file))
    )
      throw new Error(`Raw evaluator output lacks prepared inputs: ${cell}`);
    const fixturePath = `source/benchmarks/interaction/fixtures/${publicFixtures[task.id]}.html`;
    const expectedArtifact = fixtureArtifact(
      fs.readFileSync(safeFile(output, fixturePath), 'utf8'),
      manifest.deviations
    );
    if (
      present('artifact.html') &&
      fs.readFileSync(safeFile(output, `${dir}/artifact.html`), 'utf8') !== expectedArtifact
    )
      throw new Error(`Artifact differs from declared source fixture: ${cell}`);
    const expectedPrompt = `${task.title}\n\n${task.requirements}\n`;
    const materials = [
      ...task.visibility.ordinary,
      ...(arm === 'knowledge' ? task.visibility.knowledge : []),
    ];
    const names = ['task.txt', ...materials.map((_, index) => `material-${index + 1}.txt`)].sort();
    const packetDir = safeFile(output, `${dir}/participant`);
    const packetFiles = present('participant') ? listFiles(packetDir) : [];
    if (
      packetFiles.some((file) => !names.includes(file)) ||
      ((result || present('exposure.json')) && json(packetFiles) !== json(names))
    )
      throw new Error(`Unexpected or missing participant material: ${cell}`);
    if (
      present('participant/task.txt') &&
      fs.readFileSync(path.join(packetDir, 'task.txt'), 'utf8') !== expectedPrompt
    )
      throw new Error(`Prompt differs from task: ${cell}`);
    for (const [index, material] of materials.entries()) {
      const name = `material-${index + 1}.txt`;
      if (
        packetFiles.includes(name) &&
        sha256(fs.readFileSync(safeFile(packetDir, name))) !== material.sha256
      )
        throw new Error(`Participant material digest mismatch: ${cell}`);
    }
    if (present('exposure.json')) {
      const exposure = readJson(safeFile(output, `${dir}/exposure.json`));
      if (
        exposure.arm !== arm ||
        exposure.promptSha256 !== sha256(expectedPrompt) ||
        exposure.boundary !== 'public-calibration-only' ||
        json(exposure.files) !==
          json(
            materials.map((material, index) => ({
              name: `material-${index + 1}.txt`,
              sha256: material.sha256,
            }))
          )
      )
        throw new Error(`Exposure manifest mismatch: ${cell}`);
    }
    if (present('evaluator-output.json')) {
      const raw = readJson(safeFile(output, `${dir}/evaluator-output.json`));
      if (
        manifest.harness.version === calibrationHarnessVersion &&
        (raw.caseId !== task.id || raw.oracleRef !== task.oracleRef)
      )
        throw new Error(`Raw evaluator oracle identity differs from task: ${cell}`);
      if (
        raw.environment.semanticDomain !== task.semanticDomain ||
        raw.environment.fixtureOrigin !== 'hand-authored-public-reference' ||
        raw.environment.scope !== 'public-harness-calibration-only' ||
        raw.environment.protoConformance !== 'untested'
      )
        throw new Error(`Raw evaluator scope differs from task/calibration: ${cell}`);
      const evidenceRoot = safeFile(output, `${dir}/evidence`);
      const physicalEvidence = listFiles(evidenceRoot);
      if (
        !Array.isArray(raw.artifacts) ||
        new Set(raw.artifacts).size !== raw.artifacts.length ||
        json([...raw.artifacts].sort()) !== json(physicalEvidence)
      )
        throw new Error(`Raw evidence inventory differs from retained files: ${cell}`);
      const runnerError = raw.checks.some(
        (check) => check.id === 'harness-execution' && check.status === 'blocked'
      );
      if (
        !runnerError &&
        json(readJson(safeFile(evidenceRoot, 'failures.json'))) !== json(raw.failures ?? [])
      )
        throw new Error(`Failure sidecar differs from raw evaluator output: ${cell}`);
      const expectedChecks = deriveChecks(raw.checks, task, evidenceRoot);
      if (
        result &&
        (json(result.checks) !== json(expectedChecks) ||
          json(result.failures) !== json(raw.failures ?? []))
      )
        throw new Error(`Reported result differs from raw evaluator output: ${cell}`);
    }
    if (result) {
      if (
        json(result.deviations) !== json(manifest.deviations) ||
        json(result.exclusions) !== json(task.exclusions)
      )
        throw new Error(`Result exclusions/deviations differ from declared scope: ${cell}`);
      if (
        sha256(expectedPrompt) !== result.promptSha256 ||
        sha256(expectedArtifact) !== result.artifactSha256
      )
        throw new Error(`Prompt/artifact digest mismatch: ${cell}`);
      if (json(readJson(safeFile(output, `${dir}/result.json`))) !== json(result))
        throw new Error(`Cell result differs from aggregate: ${cell}`);
    }
  }
  const expected = manifest.plan.cases.length * manifest.plan.arms.length * manifest.plan.repeats;
  const aborted = Boolean(failure);
  if (cells.size !== expected && !aborted)
    throw new Error('Missing cells without retained aborted-run evidence');
  checkReport(manifest);
  return {
    ...inventory,
    status: aborted ? 'aborted' : 'verified-calibration-archive',
    cells: cells.size,
    plannedCells: expected,
    sourceCapturePolicy,
    dependencyCapturePolicy,
  };
}
