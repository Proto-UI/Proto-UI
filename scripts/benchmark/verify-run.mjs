import fs from 'node:fs';
import path from 'node:path';
import { validateDocument } from './schemas.mjs';
import { publicFixtures, fixtureArtifact, deriveChecks } from './calibration-policy.mjs';
import { readJson, sha256, json, safeFile, verifyEvidence, listFiles } from './evidence.mjs';
/** Cross-bind the archive; file hashes alone cannot establish experimental validity. */
export function verifyRun(output) {
  const inventory = verifyEvidence(output);
  if (!fs.existsSync(path.join(output, 'run.json'))) {
    if (!fs.existsSync(path.join(output, 'failure.json')))
      throw new Error('Missing run manifest without retained initialization failure');
    return { ...inventory, status: 'blocked-before-manifest' };
  }
  const manifest = validateDocument('run', readJson(safeFile(output, 'run.json')));
  const dataset = validateDocument('dataset', readJson(safeFile(output, 'dataset.json')));
  const scoring = readJson(safeFile(output, 'scoring.json'));
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
  const results = readJson(safeFile(output, 'results.json'));
  if (!Array.isArray(results)) throw new Error('Results must be an array');
  const cells = new Set();
  for (const result of results) {
    validateDocument('result', result);
    const cell = `${result.caseId}/${result.arm}/${result.repeat}`;
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
  const aborted = fs.existsSync(path.join(output, 'failure.json'));
  if (cells.size !== expected && !aborted)
    throw new Error('Missing cells without retained aborted-run evidence');
  return {
    ...inventory,
    status: aborted ? 'aborted' : 'verified-calibration-archive',
    cells: cells.size,
    plannedCells: expected,
  };
}
