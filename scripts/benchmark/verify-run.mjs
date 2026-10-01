import fs from 'node:fs';
import path from 'node:path';
import { validateDocument, unavailable } from './schemas.mjs';
import {
  publicFixtures,
  publicDatasetPath,
  fixtureArtifact,
  deriveChecks,
  retainBrowserIdentity,
} from './calibration-policy.mjs';
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
  if (!fs.existsSync(path.join(output, 'run.json'))) {
    if (!failure || results.length !== 0 || events[0]?.type !== 'run-aborted')
      throw new Error('Missing run manifest without valid initialization failure');
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
  const source = readJson(safeFile(output, 'source-inventory.json'));
  if (sha256(json(source.files)) !== manifest.harness.sourceDigest)
    throw new Error('Harness source digest mismatch');
  for (const item of source.files)
    if (sha256(fs.readFileSync(safeFile(output, `source/${item.path}`))) !== item.sha256)
      throw new Error(`Source snapshot changed: ${item.path}`);
  if (manifest.harness.toolchain.value?.gitHead !== source.gitHead)
    throw new Error('Harness checkout differs from source provenance');
  const datasetCaseIds = dataset.cases.map(
    (file) => validateDocument('case', readJson(safeFile(output, `source/${file}`))).id
  );
  if (manifest.plan.cases.some((id) => !datasetCaseIds.includes(id)))
    throw new Error('Plan contains case outside the source dataset');
  const planned = manifest.plan.cases.flatMap((caseId) =>
    manifest.plan.arms.flatMap((arm) =>
      Array.from({ length: manifest.plan.repeats }, (_, index) => `${caseId}/${arm}/${index + 1}`)
    )
  );
  let browser = unavailable('Browser has not started');
  for (const cell of planned) {
    const file = safeFile(output, `cells/${cell}/evaluator-output.json`);
    if (fs.existsSync(file)) browser = retainBrowserIdentity(browser, readJson(file).browser);
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
    if (
      result.runId !== manifest.runId ||
      !manifest.plan.cases.includes(result.caseId) ||
      !manifest.plan.arms.includes(result.arm) ||
      result.repeat > manifest.plan.repeats
    )
      throw new Error(`Unplanned result: ${cell}`);
    const task = validateDocument(
      'case',
      readJson(safeFile(output, `tasks/${result.caseId}.json`))
    );
    if (
      task.split !== 'development' ||
      task.origin !== 'public-calibration' ||
      task.datasetId !== dataset.id ||
      task.source.sha !== dataset.source.sha ||
      task.oracleRef !== result.oracleRef
    )
      throw new Error(`Task/result mismatch: ${cell}`);
    const casePath = dataset.cases.find(
      (file) => readJson(safeFile(output, `source/${file}`)).id === task.id
    );
    if (!casePath || json(readJson(safeFile(output, `source/${casePath}`))) !== json(task))
      throw new Error(`Task differs from source snapshot: ${cell}`);
    const dir = `cells/${cell}`;
    if (!Object.hasOwn(publicFixtures, task.id))
      throw new Error(`Unknown fixture mapping: ${task.id}`);
    const fixturePath = `source/benchmarks/interaction/fixtures/${publicFixtures[task.id]}.html`;
    const expectedArtifact = fixtureArtifact(
      fs.readFileSync(safeFile(output, fixturePath), 'utf8'),
      manifest.deviations
    );
    if (fs.readFileSync(safeFile(output, `${dir}/artifact.html`), 'utf8') !== expectedArtifact)
      throw new Error(`Artifact differs from declared source fixture: ${cell}`);
    if (
      json(result.deviations) !== json(manifest.deviations) ||
      json(result.exclusions) !== json(task.exclusions)
    )
      throw new Error(`Result exclusions/deviations differ from declared scope: ${cell}`);
    const raw = readJson(safeFile(output, `${dir}/evaluator-output.json`));
    const expectedChecks = deriveChecks(raw.checks, task, safeFile(output, `${dir}/evidence`));
    if (
      json(result.checks) !== json(expectedChecks) ||
      json(result.failures) !== json(raw.failures ?? [])
    )
      throw new Error(`Reported result differs from raw evaluator output: ${cell}`);
    const packetDir = safeFile(output, `${dir}/participant`);
    const expectedPrompt = `${task.title}\n\n${task.requirements}\n`;
    if (fs.readFileSync(path.join(packetDir, 'task.txt'), 'utf8') !== expectedPrompt)
      throw new Error(`Prompt differs from task: ${cell}`);
    const materials = [
      ...task.visibility.ordinary,
      ...(result.arm === 'knowledge' ? task.visibility.knowledge : []),
    ];
    const names = ['task.txt', ...materials.map((_, index) => `material-${index + 1}.txt`)].sort();
    if (json(listFiles(packetDir)) !== json(names))
      throw new Error(`Unexpected or missing participant material: ${cell}`);
    for (const [index, material] of materials.entries()) {
      if (
        sha256(fs.readFileSync(safeFile(packetDir, `material-${index + 1}.txt`))) !==
          material.sha256 ||
        sha256(fs.readFileSync(safeFile(output, `source/${material.path}`))) !== material.sha256
      )
        throw new Error(`Participant material digest mismatch: ${cell}`);
    }
    const exposure = readJson(safeFile(output, `${dir}/exposure.json`));
    if (
      exposure.arm !== result.arm ||
      exposure.promptSha256 !== result.promptSha256 ||
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
    if (
      sha256(fs.readFileSync(safeFile(output, `${dir}/participant/task.txt`))) !==
        result.promptSha256 ||
      sha256(fs.readFileSync(safeFile(output, `${dir}/artifact.html`))) !== result.artifactSha256
    )
      throw new Error(`Prompt/artifact digest mismatch: ${cell}`);
    if (json(readJson(safeFile(output, `${dir}/result.json`))) !== json(result))
      throw new Error(`Cell result differs from aggregate: ${cell}`);
    for (const check of result.checks)
      for (const evidence of check.evidence) {
        if (!fs.statSync(safeFile(output, `${dir}/evidence/${evidence}`)).isFile())
          throw new Error(`Missing check evidence: ${cell}`);
      }
  }
  const expected = manifest.plan.cases.length * manifest.plan.arms.length * manifest.plan.repeats;
  const aborted = Boolean(failure);
  if (cells.size !== expected && !aborted)
    throw new Error('Missing cells without retained aborted-run evidence');
  return {
    ...inventory,
    status: aborted ? 'aborted' : 'verified-calibration-archive',
    cells: cells.size,
    plannedCells: expected,
  };
}
