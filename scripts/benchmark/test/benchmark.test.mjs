import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  root,
  loadDataset,
  requireCalibration,
  participantPacket,
  preparePacket,
  dryRun,
  assertFormalExecutionBlocked,
} from '../benchmark.mjs';
import {
  schemas,
  validate,
  validateDocument,
  unavailable,
  measured,
  summarizeChecks,
  outcomeStatus,
} from '../schemas.mjs';
import {
  sha256,
  json,
  readJson,
  safeFile,
  writeNew,
  sealEvidence,
  verifyEvidence,
} from '../evidence.mjs';
import { verifyRun } from '../verify-run.mjs';
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'proto-benchmark-test-'));
const copy = (value) => structuredClone(value);

test('three cases bind the same source/dataset and all oracle layers', () => {
  const { dataset, cases } = loadDataset();
  assert.equal(cases.length, 3);
  assert.equal(dataset.status, 'draft');
  for (const item of cases) assert.equal(validateDocument('case', item), item);
});
test('public cases cannot silently become evaluation or held-out', () => {
  const item = copy(loadDataset().cases[0]);
  for (const split of ['evaluation', 'held-out']) {
    item.split = split;
    assert.throws(() => validateDocument('case', item), /Public calibration/);
    assert.throws(() => participantPacket(item, 'blind'), /blocked/);
  }
});
test('strict execution fails closed, including self-attested isolation', () => {
  assert.throws(assertFormalExecutionBlocked, /BLOCKED/);
  const { dataset, cases } = loadDataset();
  assert.throws(() => requireCalibration({ ...dataset, status: 'frozen' }, cases), /BLOCKED/);
  const result = spawnSync(
    process.execPath,
    ['scripts/benchmark/benchmark.mjs', 'run', '--kind', 'model-evaluation'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /verifiable external/);
});
test('packet projector does not serialize evaluator metadata or oracle identifiers', () => {
  for (const item of loadDataset().cases) {
    const blind = participantPacket(item, 'blind');
    const knowledge = participantPacket(item, 'knowledge');
    assert.equal(blind.prompt, knowledge.prompt);
    assert.equal(blind.files.length, 0);
    assert.equal(knowledge.files.length, 1);
    for (const prohibited of [
      item.oracleRef,
      'P-BASE-',
      'scripts/benchmark',
      'oracleLayers',
      'knowledge.txt',
    ])
      assert.ok(!blind.prompt.includes(prohibited));
    assert.match(knowledge.files[0].content.toString(), /lifecycle: draft/);
    const out = path.join(temporary(), 'packet');
    preparePacket(item, 'blind', out);
    assert.deepEqual(fs.readdirSync(out), ['task.txt']);
    assert.throws(() => preparePacket(item, 'blind', out), /EEXIST/);
  }
});
test('path traversal and symlink inputs fail', () => {
  const dir = temporary();
  fs.symlinkSync(os.tmpdir(), path.join(dir, 'link'));
  for (const bad of ['../secret', '/etc/passwd', 'a/../b', 'a\\b', 'a//b', 'link/file'])
    assert.throws(() => safeFile(dir, bad));
});
test('evidence writes never overwrite and inventory catches missing/extra/modified files', () => {
  for (const mutation of ['modify', 'missing', 'extra', 'inventory']) {
    const dir = temporary();
    writeNew(dir, 'raw.json', json({ status: 'fail' }));
    assert.throws(() => writeNew(dir, 'raw.json', 'replacement'), /EEXIST/);
    sealEvidence(dir);
    assert.equal(verifyEvidence(dir).artifacts, 1);
    assert.throws(() => sealEvidence(dir), /sealed/);
    if (mutation === 'modify') fs.writeFileSync(path.join(dir, 'raw.json'), 'changed');
    if (mutation === 'missing') fs.unlinkSync(path.join(dir, 'raw.json'));
    if (mutation === 'extra') fs.writeFileSync(path.join(dir, 'extra.txt'), 'extra');
    if (mutation === 'inventory') fs.appendFileSync(path.join(dir, 'inventory.json'), ' ');
    assert.throws(() => verifyEvidence(dir));
  }
});
test('schema rejects unknown properties, missing provenance, invalid numbers and fake unavailable fields', () => {
  const item = copy(loadDataset().cases[0]);
  assert.throws(() => validateDocument('case', { ...item, answer: 'hidden' }), /unexpected/);
  delete item.source;
  assert.throws(() => validateDocument('case', item), /missing source/);
  assert.throws(() => validate({ type: 'number' }, NaN), /finite/);
  assert.throws(() => validate({ type: 'number', madeUpKeyword: true }, 1), /Unsupported/);
  validate(schemas.case, loadDataset().cases[0]);
});
test('empty or mixed check sets cannot manufacture complete pass', () => {
  assert.equal(outcomeStatus([]), 'untested');
  assert.equal(summarizeChecks([]).behavior.status, 'untested');
  assert.equal(outcomeStatus([{ status: 'pass' }, { status: 'untested' }]), 'untested');
  assert.equal(outcomeStatus([{ status: 'pass' }, { status: 'blocked' }]), 'blocked');
});
test('complete blocked-browser run retains raw errors, both arms and repeats and verifies bindings', async () => {
  const output = path.join(temporary(), 'run');
  const run = await dryRun({
    output,
    repeats: 2,
    selectedCases: ['dialog-open-close'],
    chromiumPath: '/nonexistent-public-calibration-chromium',
  });
  assert.equal(run.status, 'blocked');
  assert.equal(run.cells, 4);
  assert.equal(verifyRun(output).plannedCells, 4);
  const manifest = readJson(path.join(output, 'run.json'));
  assert.equal(manifest.kind, 'calibration-stub');
  assert.equal(manifest.participant.modelId.value, null);
  assert.match(manifest.participant.modelId.unavailableReason, /no model/);
  assert.equal(manifest.harness.browser.value, null);
  assert.equal(manifest.plan.repeats, 2);
  const results = readJson(path.join(output, 'results.json'));
  for (const row of results) {
    assert.equal(row.status, 'blocked');
    assert.equal(row.metrics.tokens.value, null);
    assert.ok(
      row.checks.some(
        (check) => check.id === 'evidence-missing-screenshot' && check.status === 'blocked'
      )
    );
    assert.ok(row.failures.some((failure) => failure.stage === 'setup'));
    const fake = copy(row);
    fake.status = 'pass';
    assert.throws(() => validateDocument('result', fake), /status differs/);
    const empty = copy(row);
    empty.checks = [];
    assert.throws(() => validateDocument('result', empty), /too few/);
    const duplicate = copy(row);
    duplicate.checks.push(duplicate.checks[0]);
    assert.throws(() => validateDocument('result', duplicate), /Duplicate/);
    const badMeasurement = copy(row);
    badMeasurement.metrics.tokens = { value: null, unavailableReason: null };
    assert.throws(() => validateDocument('result', badMeasurement), /unavailable values/);
  }
  assert.match(fs.readFileSync(path.join(output, 'report.md'), 'utf8'), /No model was evaluated/);
  assert.match(fs.readFileSync(path.join(output, 'events.jsonl'), 'utf8'), /run-finish/);
  await assert.rejects(() => dryRun({ output }), /EEXIST/);
  assert.ok(
    fs.statSync(path.join(output, 'source/scripts/benchmark/browser-calibration.mjs')).size > 0
  );
  assert.equal(
    sha256(
      fs.readFileSync(path.join(output, 'cells/dialog-open-close/blind/1/participant/task.txt'))
    ),
    results[0].promptSha256
  );
});
test('invalid selections and excessive repetition fail before executing', async () => {
  const output = path.join(temporary(), 'run');
  await assert.rejects(() => dryRun({ output, selectedCases: [] }), /empty case/);
  await assert.rejects(() => dryRun({ output, repeats: 0 }), /integer/);
  await assert.rejects(() => dryRun({ output, repeats: 11 }), /integer/);
  await assert.rejects(() => dryRun({ output, arms: ['blind', 'blind'] }), /Invalid arms/);
});
