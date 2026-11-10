import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { root } from '../benchmark.mjs';
import { readJson, sha256, writeNew } from '../evidence.mjs';
import { analyzeDiscovery, freezeDiscovery } from '../discovery-study.mjs';
import { validateDiscovery } from '../discovery-schema.mjs';

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'proto-discovery-test-'));
const referenceText = (archive, file, criterionId) => {
  const lines = fs.readFileSync(path.join(archive, 'sources', file), 'utf8').split('\n');
  const start = lines.findIndex((line) => line === `  - id: ${criterionId}`) + 1;
  assert.ok(start > 0, criterionId);
  return { start, end: Math.min(start + 6, lines.length) };
};
const exact = (file, sha256) => ({ path: file, sha256 });
function evidenceFile(rootDirectory, name, content = `${name}\n`) {
  writeNew(rootDirectory, name, content);
  return exact(name, sha256(fs.readFileSync(path.join(rootDirectory, name))));
}
function fixture() {
  const directory = temporary();
  const archive = path.join(directory, 'freeze');
  const input = path.join(directory, 'input');
  fs.mkdirSync(input);
  const frozen = freezeDiscovery({ root, out: archive });
  const study = readJson(path.join(archive, 'study.json'));
  const planFile = evidenceFile(input, 'plan.json', JSON.stringify({
    schemaVersion: 1,
    registeredAt: '2026-11-10T00:00:00.000Z',
    cells: [
      { id: 'dialog-frontier-1', caseId: 'dialog-open-close', setupId: 'frontier-a', condition: 'blind', repeat: 1 },
      { id: 'dialog-frontier-2', caseId: 'dialog-open-close', setupId: 'frontier-a', condition: 'blind', repeat: 2 },
    ],
  }));
  const inventoryFile = evidenceFile(input, 'runs.json', JSON.stringify({
    schemaVersion: 1,
    runIds: ['run-1', 'run-2'],
    collectionMethod: 'Explicit public-development fixture for reducer verification only',
    completenessLimit: 'No real participant run exists in this source-controlled fixture.',
  }));
  return { directory, archive, input, frozen, study, planFile, inventoryFile };
}
function baseRun({ study, input, runId, cellId, repeat, transcript = 'Complete ordinary interaction analysis', proposals }) {
  const dialog = study.primitives.find((item) => item.caseId === 'dialog-open-close');
  const transcriptFile = evidenceFile(input, `${runId}-transcript.txt`, transcript);
  const contextFile = evidenceFile(input, `${runId}-context.txt`, 'fresh public-development subject context');
  const exposureFile = evidenceFile(input, `${runId}-exposure.json`, JSON.stringify({
    schemaVersion: 1,
    runId,
    freshContext: true,
    priorOutputAccess: false,
    contextEvidence: contextFile,
    delivered: [exact(`participant/dialog-open-close/prompt.txt`, dialog.prompt.sha256)],
    accessed: [],
    boundary: 'public-development-no-verified-isolation',
    leakageObservations: [],
  }));
  const submissionFile = evidenceFile(input, `${runId}-submission.json`, JSON.stringify({ schemaVersion: 1, proposals }));
  return {
    id: runId,
    cell: { id: cellId, caseId: 'dialog-open-close', setupId: 'frontier-a', condition: 'blind', repeat },
    participantId: `participant-${repeat}`,
    status: 'completed', reason: null,
    startedAt: `2026-11-10T00:0${repeat}:00.000Z`, finishedAt: `2026-11-10T00:0${repeat}:30.000Z`,
    transcript: transcriptFile, submission: submissionFile, exposure: exposureFile, review: null,
    deviations: [],
    costs: {
      inputTokens: { value: 100 + repeat, unavailableReason: null },
      outputTokens: { value: 10 + repeat, unavailableReason: null },
      computeSeconds: { value: null, unavailableReason: 'local fixture has no compute observation' },
      iterations: { value: 1, unavailableReason: null },
    },
  };
}
const sourceCitation = ({ archive, study, item }) => {
  const range = referenceText(archive, item.path, item.criterionId);
  return {
    origin: 'frozen-source',
    file: { path: item.path, sha256: study.sourceFiles.find((file) => file.path === item.path).sha256 },
    startLine: range.start,
    endLine: range.end,
  };
};
function observations({ archive, study, input, planFile, inventoryFile, runs }) {
  const file = path.join(input, 'observations.json');
  writeNew(input, 'observations.json', JSON.stringify({
    schemaVersion: 1,
    studyId: study.id,
    frozenStudySha256: sha256(fs.readFileSync(path.join(archive, 'study.json'))),
    evidenceKind: 'recorded-public-development',
    coordinatorId: 'coordinator-1',
    runInventory: inventoryFile,
    registeredPlan: planFile,
    setups: [{
      id: 'frontier-a', modelClass: 'frontier',
      participant: {
        provider: 'provider-a', modelId: 'model-a', modelSnapshot: 'snapshot-a',
        modelReleaseDate: { value: null, unavailableReason: 'provider did not disclose date' },
        reasoning: 'default', sampling: 'deterministic-fixture', context: 'fresh public development', tools: 'none', seed: { value: null, unavailableReason: 'unsupported by fixture' },
      },
      harness: evidenceFile(input, 'harness.txt', 'recorded executor declaration only'),
      retrievalBoundary: 'Only declared delivered bytes were presented to the subject', toolAccess: ['none'],
      timeLimitSeconds: 60, tokenLimit: { value: null, unavailableReason: 'no token limit instrumented' }, computeLimitSeconds: { value: 600, unavailableReason: null },
    }],
    runs,
    assessment: null,
    limitations: ['No real participant run; this is a structural reducer fixture.'],
  }));
  return file;
}

test('freeze captures exact public sources and participant prompt split', () => {
  const { archive, frozen, study } = fixture();
  assert.equal(study.primitives.length, 3);
  assert.equal(study.primitives[0].references.length, 42);
  assert.equal(study.primitives[1].references.length, 114);
  assert.equal(study.primitives[2].references.length, 62);
  assert.equal(frozen.status, 'source-frozen-no-runs');
  assert.equal(frozen.formalExecution, 'disabled');
  for (const primitive of study.primitives)
    assert.equal(
      fs.readFileSync(path.join(archive, 'sources', primitive.prompt.path), 'utf8'),
      fs.readFileSync(path.join(archive, `participant/${primitive.caseId}/prompt.txt`), 'utf8')
    );
  assert.throws(() => freezeDiscovery({ root, out: archive }), /EEXIST/);
});

test('review and report distinguish discovered, ambiguous and pending dispositions without inferring facts', () => {
  const { archive, input, study, planFile, inventoryFile } = fixture();
  const proposals = [
    { id: 'a-open', kind: 'property', statement: 'A modal open request should expose enough intent for an owner to decide.', source: null },
    { id: 'a-focus', kind: 'test', statement: 'Open, Tab twice, close and observe the trigger focus boundary.', source: null },
  ];
  const run = baseRun({ study, input, runId: 'run-1', cellId: 'dialog-frontier-1', repeat: 1, proposals });
  const dialog = study.primitives[0];
  const review = {
    schemaVersion: 1, runId: 'run-1', reviewerId: 'independent-reviewer-1',
    independenceEvidence: evidenceFile(input, 'run-1-independence.txt', 'Separate reviewer'),
    extractionCompleteness: evidenceFile(input, 'run-1-extraction.json', JSON.stringify({ complete: true })),
    referenceEligibility: dialog.references.map((item) => ({ referenceId: item.id, eligible: true, reason: 'in scope' })),
    rows: dialog.references.map((item) => ({
      id: `row-${item.criterionId}`,
      category: 'proto-only',
      proposalIds: [],
      referenceIds: [item.id],
      dimensions: ['behavior'],
      rationale: 'No submitted proposal covers this criterion',
      citations: [sourceCitation({ archive, study, item })],
      consequence: 'Reviewer records omission',
      feedback: null,
      missingSearch: null,
    })),
    limitations: ['Fixture only'],
  };
  writeNew(input, 'run-1-review.json', JSON.stringify(review));
  const openRow = review.rows.find((row) => row.referenceIds[0].endsWith('#P-BASE-DIALOG-OPEN-CHANGE'));
  openRow.category = 'both';
  openRow.proposalIds = ['a-open'];
  openRow.rationale = 'Same request/response requirement';
  openRow.consequence = 'Covered request arbitration';
  review.rows.push({
    id: 'row-focus',
    category: 'ambiguous-disputed',
    proposalIds: ['a-focus'],
    referenceIds: [],
    dimensions: ['focus'],
    rationale: 'Observable journey remains broader than one criterion',
    citations: [{
      origin: 'input',
      file: { path: 'run-1-submission.json', sha256: sha256(fs.readFileSync(path.join(input, 'run-1-submission.json'))) },
      startLine: 1,
      endLine: 1,
    }],
    consequence: 'Requires adjudication',
    feedback: null,
    missingSearch: null,
  });
  fs.writeFileSync(path.join(input, 'run-1-review.json'), JSON.stringify(review));
  run.review = { path: 'run-1-review.json', sha256: sha256(fs.readFileSync(path.join(input, 'run-1-review.json'))) };
  const observationsFile = observations({ archive, study, input, planFile, inventoryFile, runs: [run] });
  const report = analyzeDiscovery({ archive, input: observationsFile });
  assert.equal(report.eligibleBlindRuns, 1);
  assert.equal(report.runs[0].usableForBlindDiscovery, true);
  assert.equal(report.runs[0].categories.both, 1);
  assert.equal(report.runs[0].categories['ambiguous-disputed'], 1);
  assert.equal(report.runs[0].categories['proto-only'], dialog.references.length - 1);
});

test('injected control observations cannot produce a supported result', () => {
  const { archive, input, study, planFile, inventoryFile } = fixture();
  const run = baseRun({ study, input, runId: 'run-1', cellId: 'dialog-frontier-1', repeat: 1, proposals: [] });
  const observationsFile = observations({ archive, study, input, planFile, inventoryFile, runs: [run] });
  const value = JSON.parse(fs.readFileSync(observationsFile, 'utf8'));
  value.evidenceKind = 'injected-control';
  fs.writeFileSync(observationsFile, JSON.stringify(value));
  const report = analyzeDiscovery({ archive, input: observationsFile });
  assert.equal(report.classification, 'inconclusive');
});

test('extra blind material makes the recorded attempt unusable', () => {
  const { archive, input, study, planFile, inventoryFile } = fixture();
  const dialog = study.primitives[0];
  const run = baseRun({ study, input, runId: 'run-1', cellId: 'dialog-frontier-1', repeat: 1, proposals: [] });
  const exposure = JSON.parse(fs.readFileSync(path.join(input, 'run-1-exposure.json'), 'utf8'));
  exposure.delivered.push({ path: 'run-1-context.txt', sha256: sha256(fs.readFileSync(path.join(input, 'run-1-context.txt'))) });
  fs.writeFileSync(path.join(input, 'run-1-exposure.json'), JSON.stringify(exposure));
  run.exposure.sha256 = sha256(fs.readFileSync(path.join(input, 'run-1-exposure.json')));
  const observationsFile = observations({ archive, study, input, planFile, inventoryFile, runs: [run] });
  const report = analyzeDiscovery({ archive, input: observationsFile });
  assert.equal(report.eligibleBlindRuns, 0);
  assert.match(report.runs[0].limits.join('\n'), /undeclared extra material/);
});

test('exposure boundary is declared rather than upgraded to isolation', () => {
  const exposure = validateDiscovery('exposure', {
    schemaVersion: 1, runId: 'run-1', freshContext: true, priorOutputAccess: false,
    contextEvidence: { path: 'context.txt', sha256: '0'.repeat(64) },
    delivered: [{ path: 'prompt.txt', sha256: '1'.repeat(64) }], accessed: [],
    boundary: 'public-development-no-verified-isolation', leakageObservations: [],
  });
  assert.equal(exposure.boundary, 'public-development-no-verified-isolation');
});
