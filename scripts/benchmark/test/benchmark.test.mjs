import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import { spawnSync } from 'node:child_process';
import {
  root,
  loadDataset,
  requireCalibration,
  participantPacket,
  preparePacket,
  dryRun,
  assertFormalExecutionBlocked,
  renderReport,
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
  listFiles,
} from '../evidence.mjs';
import { verifyRun } from '../verify-run.mjs';
import {
  retainBrowserIdentity,
  negativeControlDeviation,
  fixtureArtifact,
  calibrationSourcePaths,
  verifySourceImports,
} from '../calibration-policy.mjs';
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

// Upload defaults must not silently omit the snapshotted .github workflow.
test('CI publishes the complete allowlisted archive, including its hidden source path', () => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(root, '.github/workflows/interaction-benchmark-calibration.yml'),
      'utf8'
    )
  );
  const steps = workflow.jobs['public-calibration'].steps;
  const upload = steps.find((step) => step.uses === 'actions/upload-artifact@v4');
  assert.equal(upload.with['include-hidden-files'], true);
  assert.equal(upload.if, 'always()');
  assert.deepEqual(upload.with.path.trim().split('\n'), [
    '${{ runner.temp }}/interaction-calibration',
    '${{ runner.temp }}/interaction-controls',
  ]);
  assert.equal(
    steps.find((step) => step.name === 'Public dry run with repeated packet arms').if,
    'always()'
  );
  assert.equal(workflow.permissions.contents, 'read');
});

test('a later unavailable browser does not erase an earlier measured identity', () => {
  const browser = {
    name: 'chromium',
    version: 'test-only-version',
    executable: '/test-only/browser',
  };
  const known = retainBrowserIdentity(unavailable('not started'), browser);
  assert.deepEqual(known, measured(browser));
  assert.deepEqual(retainBrowserIdentity(known, { name: 'chromium', version: null }), known);
  assert.equal(retainBrowserIdentity(unavailable('not started'), null).value, null);
});

test('rehashed wrong-fixture and fabricated-result archives fail semantic binding', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const mutation of ['wrong-fixture', 'drop-check', 'fabricate-check', 'drop-failures']) {
    const archive = path.join(temporary(), mutation);
    fs.cpSync(original, archive, { recursive: true });
    const rows = readJson(path.join(archive, 'results.json'));
    const row = rows[0];
    const cell = path.join(archive, 'cells/dialog-open-close/blind/1');
    if (mutation === 'wrong-fixture') {
      const wrong = fs.readFileSync(
        path.join(archive, 'source/benchmarks/interaction/fixtures/tabs.html')
      );
      fs.writeFileSync(path.join(cell, 'artifact.html'), wrong);
      row.artifactSha256 = sha256(wrong);
    } else if (mutation === 'drop-check')
      row.checks = row.checks.filter((check) => check.id !== 'host.browser-ready');
    else if (mutation === 'fabricate-check')
      row.checks[0].reason = 'Fabricated but structurally coherent verdict';
    else row.failures = [];
    row.status = outcomeStatus(row.checks);
    row.dimensions = summarizeChecks(row.checks);
    fs.writeFileSync(path.join(cell, 'result.json'), json(row));
    fs.writeFileSync(path.join(archive, 'results.json'), json(rows));
    fs.unlinkSync(path.join(archive, 'inventory.json'));
    fs.unlinkSync(path.join(archive, 'seal.json'));
    sealEvidence(archive);
    assert.doesNotThrow(() => verifyEvidence(archive));
    assert.throws(
      () => verifyRun(archive),
      mutation === 'wrong-fixture' ? /declared source fixture/ : /raw evaluator output/
    );
  }
  assert.doesNotThrow(() => verifyRun(original));
});

test('declared negative-control artifacts verify against the frozen source transformation', async () => {
  const source = '<html><script>run()</script></html>';
  assert.equal(fixtureArtifact(source, []), source);
  assert.match(
    fixtureArtifact(source, [negativeControlDeviation]),
    /application\/x-disabled-calibration/
  );
  const archive = path.join(temporary(), 'negative');
  await dryRun({
    output: archive,
    selectedCases: ['tabs-manual-activation'],
    arms: ['blind'],
    negativeControl: true,
    chromiumPath: '/missing-public-calibration-chromium',
  });
  assert.equal(verifyRun(archive).cells, 1);
});

test('CI browser watchdogs preserve time and streamed evidence for upload', () => {
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(root, '.github/workflows/interaction-benchmark-calibration.yml'),
      'utf8'
    )
  );
  const steps = workflow.jobs['public-calibration'].steps;
  for (const name of [
    'Real-browser positive and negative controls',
    'Public dry run with repeated packet arms',
  ]) {
    const step = steps.find((item) => item.name === name);
    assert.match(step.run, /timeout --signal=TERM --kill-after=10s 90s node/);
    assert.match(step.run, /tee .*interaction-controls\//);
  }
  assert.equal(steps.find((step) => step.uses === 'actions/upload-artifact@v4').if, 'always()');
});

test(
  'a stuck browser-command stand-in is terminated while its raw log survives',
  { skip: process.platform !== 'linux' },
  () => {
    const directory = temporary();
    const log = path.join(directory, 'browser-watchdog.log');
    const script = `set -o pipefail; timeout --signal=TERM --kill-after=1s 0.2s "$NODE" -e 'console.log("started-before-hang"); setInterval(() => {}, 1000)' 2>&1 | tee "$RAW_LOG"`;
    const result = spawnSync('bash', ['-c', script], {
      env: { ...process.env, NODE: process.execPath, RAW_LOG: log },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.status, 124);
    assert.match(fs.readFileSync(log, 'utf8'), /started-before-hang/);
  }
);

test('rehashed provenance and source-policy contradictions are rejected', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const mutation of ['browser', 'dataset', 'scoring', 'scoring-shape', 'immutable-manifest']) {
    const dir = path.join(temporary(), mutation);
    fs.cpSync(original, dir, { recursive: true });
    const manifest = readJson(path.join(dir, 'run.json'));
    const start = readJson(path.join(dir, 'run-start.json'));
    if (mutation === 'browser')
      manifest.harness.browser = measured({
        name: 'chromium',
        version: 'FAKE-999',
        executable: '/test-only',
      });
    else if (mutation === 'dataset') {
      const dataset = readJson(path.join(dir, 'dataset.json'));
      dataset.limitations.push('Stale copied dataset');
      fs.writeFileSync(path.join(dir, 'dataset.json'), json(dataset));
      manifest.dataset.sha256 = start.dataset.sha256 = sha256(json(dataset));
    } else if (mutation.startsWith('scoring')) {
      const scoring = readJson(path.join(dir, 'scoring.json'));
      if (mutation === 'scoring-shape') scoring.severity.status = 'invented-approval';
      else scoring.aggregation = 'A changed scoring policy absent from the source snapshot';
      fs.writeFileSync(path.join(dir, 'scoring.json'), json(scoring));
      manifest.scoring.sha256 = start.scoring.sha256 = sha256(json(scoring));
    } else manifest.harness.os = 'Changed after the run started';
    fs.writeFileSync(path.join(dir, 'run.json'), json(manifest));
    fs.writeFileSync(path.join(dir, 'run-start.json'), json(start));
    fs.unlinkSync(path.join(dir, 'inventory.json'));
    fs.unlinkSync(path.join(dir, 'seal.json'));
    sealEvidence(dir);
    assert.doesNotThrow(() => verifyEvidence(dir));
    const expected =
      mutation === 'browser'
        ? /browser identity/
        : mutation === 'scoring-shape'
          ? /must be one of/
          : mutation === 'immutable-manifest'
            ? /manifest changed/
            : /source snapshot/;
    assert.throws(() => verifyRun(dir), expected);
  }
});

test('a raw measured browser remains bound after a subsequent blocked launch', async () => {
  const dir = path.join(temporary(), 'mixed-browser');
  await dryRun({
    output: dir,
    repeats: 2,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  // Synthetic metadata-only control: no real browser/version is claimed here.
  const browser = { name: 'test-only-browser', version: 'synthetic-v1', executable: '/test-only' };
  const rawPath = path.join(dir, 'cells/dialog-open-close/blind/1/evaluator-output.json');
  const raw = readJson(rawPath);
  raw.browser = browser;
  fs.writeFileSync(rawPath, json(raw));
  const manifest = readJson(path.join(dir, 'run.json'));
  manifest.harness.browser = measured(browser);
  fs.writeFileSync(path.join(dir, 'run.json'), json(manifest));
  fs.unlinkSync(path.join(dir, 'inventory.json'));
  fs.unlinkSync(path.join(dir, 'seal.json'));
  sealEvidence(dir);
  assert.equal(verifyRun(dir).cells, 2);
});

test('missing cells need typed, count-bound failure evidence and matching abort events', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    repeats: 2,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const mode of ['empty', 'wrong-count', 'wrong-status', 'valid']) {
    const dir = path.join(temporary(), mode);
    fs.cpSync(original, dir, { recursive: true });
    const rows = readJson(path.join(dir, 'results.json')).slice(0, 1);
    fs.writeFileSync(path.join(dir, 'results.json'), json(rows));
    fs.rmSync(path.join(dir, 'cells/dialog-open-close/blind/2'), { recursive: true });
    const message = 'Synthetic interruption before repeat 2';
    const events = fs
      .readFileSync(path.join(dir, 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
      .filter((event) => event.type !== 'run-finish' && event.repeat !== 2);
    events.push(
      { at: new Date().toISOString(), type: 'run-aborted', message, completedCells: 1 },
      { at: new Date().toISOString(), type: 'run-finish', aborted: true, completedCells: 1 }
    );
    fs.writeFileSync(
      path.join(dir, 'events.jsonl'),
      events.map((event, index) => JSON.stringify({ ...event, seq: index + 1 })).join('\n') + '\n'
    );
    const failure =
      mode === 'empty'
        ? {}
        : {
            status: mode === 'wrong-status' ? 'pass' : 'blocked',
            message,
            stack: 'Synthetic test-only interruption',
            completedCells: mode === 'wrong-count' ? 2 : 1,
          };
    fs.writeFileSync(path.join(dir, 'failure.json'), json(failure));
    fs.writeFileSync(
      path.join(dir, 'report.md'),
      renderReport(readJson(path.join(dir, 'run.json')), rows, new Error(message))
    );
    fs.unlinkSync(path.join(dir, 'inventory.json'));
    fs.unlinkSync(path.join(dir, 'seal.json'));
    sealEvidence(dir);
    if (mode === 'valid') assert.deepEqual(verifyRun(dir).status, 'aborted');
    else
      assert.throws(
        () => verifyRun(dir),
        mode === 'wrong-count' ? /Failure evidence differs/ : /missing status|must equal blocked/
      );
  }
});

test('initialization failure is typed and cannot claim completed cells without a manifest', () => {
  const dir = temporary();
  const message = 'Synthetic initialization failure';
  writeNew(dir, 'results.json', json([]));
  writeNew(
    dir,
    'failure.json',
    json({ status: 'blocked', message, stack: 'Synthetic test stack', completedCells: 0 })
  );
  writeNew(
    dir,
    'events.jsonl',
    [
      { seq: 1, type: 'run-aborted', message, completedCells: 0 },
      { seq: 2, type: 'run-finish', aborted: true, completedCells: 0 },
    ]
      .map(JSON.stringify)
      .join('\n') + '\n'
  );
  writeNew(dir, 'report.md', renderReport(undefined, [], new Error(message)));
  sealEvidence(dir);
  assert.equal(verifyRun(dir).status, 'blocked-before-manifest');
});

function reseal(dir) {
  fs.unlinkSync(path.join(dir, 'inventory.json'));
  fs.unlinkSync(path.join(dir, 'seal.json'));
  sealEvidence(dir);
}

test('all observed harness provenance is bound to retained sources and raw environments', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const field of ['node', 'os', 'lockfileSha256', 'sourceInventory', 'packageManager']) {
    const dir = path.join(temporary(), field);
    fs.cpSync(original, dir, { recursive: true });
    for (const file of ['run.json', 'run-start.json']) {
      const run = readJson(path.join(dir, file));
      if (['node', 'os'].includes(field)) run.harness[field] = 'FAKE-PROVENANCE';
      else if (field === 'packageManager') run.harness.packageManager = measured('fake-pm@999');
      else
        run.harness.toolchain.value[field] =
          field === 'lockfileSha256' ? '0'.repeat(64) : 'missing-inventory.json';
      fs.writeFileSync(path.join(dir, file), json(run));
    }
    reseal(dir);
    assert.throws(() => verifyRun(dir), /Harness Node\/OS|dependency\/inventory provenance/);
  }
});

test('every completed cell needs exactly one preceding start in declared order', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const mode of ['missing', 'duplicate', 'reordered']) {
    const dir = path.join(temporary(), mode);
    fs.cpSync(original, dir, { recursive: true });
    let events = fs
      .readFileSync(path.join(dir, 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    const start = events.findIndex((event) => event.type === 'cell-start');
    if (mode === 'missing') events.splice(start, 1);
    else if (mode === 'duplicate') events.splice(start, 0, { ...events[start] });
    else [events[start], events[start + 1]] = [events[start + 1], events[start]];
    fs.writeFileSync(
      path.join(dir, 'events.jsonl'),
      events.map((event, index) => JSON.stringify({ ...event, seq: index + 1 })).join('\n') + '\n'
    );
    reseal(dir);
    assert.throws(() => verifyRun(dir), /Cell start|Cell finish/);
  }
});

test('calibration cannot claim model participants, verified isolation, repairs or unmeasured costs', async () => {
  const dir = path.join(temporary(), 'original');
  await dryRun({
    output: dir,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  const run = readJson(path.join(dir, 'run.json'));
  for (const mutate of [
    (v) => {
      v.participant.kind = 'model';
    },
    (v) => {
      v.participant.modelId = measured('fake-model');
    },
    (v) => {
      v.exposure.boundary = 'verified-external-isolation';
    },
    (v) => {
      v.exposure.audit = measured({ verified: true });
    },
  ]) {
    const value = copy(run);
    mutate(value);
    assert.throws(() => validateDocument('run', value), /Calibration/);
  }
  const result = readJson(path.join(dir, 'results.json'))[0];
  for (const key of [
    'firstPassCorrectness',
    'finalCorrectness',
    'repairCycles',
    'tokens',
    'humanWork',
    'requirementRecall',
  ]) {
    const value = copy(result);
    if (key === 'repairCycles') value.metrics[key] = 9;
    else if (key.endsWith('Correctness'))
      value.metrics[key] = measured({
        scope: 'executed-public-calibration-checks-only',
        status: 'pass',
      });
    else value.metrics[key] = measured(123);
    assert.throws(() => validateDocument('result', value), /Calibration|calibration/);
  }
});

test('reports, mandatory source, orphan cells, task identity and duplicate failure evidence are bound', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const mode of [
    'report',
    'missing-report',
    'core-source',
    'import-source',
    'orphan',
    'task-id',
    'failure-sidecar',
  ]) {
    const dir = path.join(temporary(), mode);
    fs.cpSync(original, dir, { recursive: true });
    const cell = 'cells/dialog-open-close/blind/1';
    if (mode === 'report')
      fs.writeFileSync(path.join(dir, 'report.md'), 'Invented 100 percent pass report');
    else if (mode === 'missing-report') fs.unlinkSync(path.join(dir, 'report.md'));
    else if (mode.endsWith('source')) {
      const omitted =
        mode === 'core-source'
          ? 'scripts/benchmark/browser-calibration.mjs'
          : 'scripts/benchmark/report.mjs';
      const inventory = readJson(path.join(dir, 'source-inventory.json'));
      inventory.files = inventory.files.filter((file) => file.path !== omitted);
      fs.writeFileSync(path.join(dir, 'source-inventory.json'), json(inventory));
      fs.unlinkSync(path.join(dir, 'source', omitted));
      for (const file of ['run.json', 'run-start.json']) {
        const run = readJson(path.join(dir, file));
        run.harness.sourceDigest = sha256(json(inventory.files));
        fs.writeFileSync(path.join(dir, file), json(run));
      }
    } else if (mode === 'orphan')
      fs.cpSync(path.join(dir, cell), path.join(dir, 'cells/tabs-manual-activation/knowledge/99'), {
        recursive: true,
      });
    else if (mode === 'failure-sidecar')
      fs.writeFileSync(path.join(dir, cell, 'evidence/failures.json'), '[]');
    else {
      const task = readJson(
        path.join(dir, 'source/benchmarks/interaction/cases/tabs-manual-activation.json')
      );
      fs.writeFileSync(path.join(dir, 'tasks/dialog-open-close.json'), json(task));
      const rows = readJson(path.join(dir, 'results.json'));
      const row = rows[0];
      const html = fs.readFileSync(
        path.join(dir, 'source/benchmarks/interaction/fixtures/tabs.html')
      );
      const prompt = `${task.title}\n\n${task.requirements}\n`;
      fs.writeFileSync(path.join(dir, cell, 'artifact.html'), html);
      fs.writeFileSync(path.join(dir, cell, 'participant/task.txt'), prompt);
      row.oracleRef = task.oracleRef;
      row.exclusions = task.exclusions;
      row.artifactSha256 = sha256(html);
      row.promptSha256 = sha256(prompt);
      fs.writeFileSync(path.join(dir, 'results.json'), json(rows));
      fs.writeFileSync(path.join(dir, cell, 'result.json'), json(row));
      const exposure = readJson(path.join(dir, cell, 'exposure.json'));
      exposure.promptSha256 = row.promptSha256;
      fs.writeFileSync(path.join(dir, cell, 'exposure.json'), json(exposure));
    }
    reseal(dir);
    assert.doesNotThrow(() => verifyEvidence(dir));
    const expected =
      mode === 'report'
        ? /Report differs/
        : mode === 'missing-report'
          ? /ENOENT/
          : mode === 'core-source'
            ? /public input allowlist/
            : mode === 'import-source'
              ? /relative harness import/
              : mode === 'orphan'
                ? /Orphan\/unplanned/
                : mode === 'task-id'
                  ? /Task\/result mismatch|Task differs from source snapshot/
                  : /Failure sidecar/;
    assert.throws(() => verifyRun(dir), expected);
  }
});

test('public capture excludes undeclared files and dirty patches, and rejects unselected private cases', () => {
  const directory = temporary();
  const isolated = path.join(directory, 'repo');
  fs.mkdirSync(isolated);
  const { dataset, cases } = loadDataset();
  for (const file of calibrationSourcePaths(dataset, cases)) {
    fs.mkdirSync(path.dirname(path.join(isolated, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(isolated, file));
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(isolated, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(isolated, 'apps/www'), { recursive: true });
  fs.symlinkSync(
    path.join(root, 'apps/www/node_modules'),
    path.join(isolated, 'apps/www/node_modules'),
    'dir'
  );
  const tracked = 'PRIVATE_TRACKED_' + path.basename(directory);
  const untracked = 'PRIVATE_UNTRACKED_' + path.basename(directory);
  const historical = 'PRIVATE_DELETED_' + path.basename(directory);
  const readme = path.join(isolated, 'benchmarks/interaction/README.md');
  const finalReadme = fs.readFileSync(readme, 'utf8');
  fs.writeFileSync(readme, finalReadme + '\n' + historical);
  const omitted = 'benchmarks/interaction/unlisted-audit-canary.txt';
  fs.writeFileSync(path.join(isolated, omitted), 'Harmless baseline');
  for (const args of [
    ['init'],
    ['add', '--', omitted, 'benchmarks/interaction/README.md'],
    [
      '-c',
      'user.name=Calibration Test',
      '-c',
      'user.email=calibration@example.invalid',
      'commit',
      '-m',
      'Create harmless test fixture',
    ],
  ]) {
    const result = spawnSync('git', args, { cwd: isolated, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  fs.writeFileSync(readme, finalReadme);
  fs.writeFileSync(path.join(isolated, omitted), tracked);
  fs.writeFileSync(path.join(isolated, 'scripts/benchmark/untracked-audit-canary.txt'), untracked);
  const output = path.join(directory, 'public-output');
  const args = [
    'scripts/benchmark/benchmark.mjs',
    'dry-run',
    '--case',
    'dialog-open-close',
    '--arm',
    'blind',
    '--chromium',
    '/missing-public-calibration-chromium',
    '--out',
    output,
  ];
  const run = spawnSync(process.execPath, args, {
    cwd: isolated,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(run.status, 1, run.stderr);
  assert.equal(verifyRun(output).cells, 1);
  assert.equal(verifyRun(output).sourceCapturePolicy, 'explicit-public-final-snapshot-no-history');
  assert.equal(fs.existsSync(path.join(output, 'source-worktree.patch')), false);
  assert.equal(
    fs.readFileSync(path.join(output, 'source/benchmarks/interaction/README.md'), 'utf8'),
    finalReadme
  );
  for (const file of listFiles(output)) {
    const content = fs.readFileSync(path.join(output, file)).toString();
    assert.ok(
      !content.includes(tracked) && !content.includes(untracked) && !content.includes(historical),
      `Leaked canary in ${file}`
    );
  }
  const privateCase = path.join(isolated, 'benchmarks/interaction/cases/select-keyboard.json');
  const changed = readJson(privateCase);
  changed.origin = 'private-authoring';
  changed.split = 'held-out';
  changed.requirements = 'HARMLESS_PRIVATE_' + path.basename(directory);
  fs.writeFileSync(privateCase, json(changed));
  const forbidden = path.join(directory, 'must-not-exist');
  args[args.length - 1] = forbidden;
  const rejected = spawnSync(process.execPath, args, {
    cwd: isolated,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /BLOCKED/);
  assert.equal(fs.existsSync(forbidden), false);
  assert.ok(!rejected.stderr.includes(changed.requirements));
});

test('current capture profile cannot retain history, omit its receipt, or downgrade its identity', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const mode of [
    'historical-patch',
    'capture-paths',
    'capture-pointer',
    'missing-receipt',
    'profile-downgrade',
  ]) {
    const dir = path.join(temporary(), mode);
    fs.cpSync(original, dir, { recursive: true });
    if (mode === 'historical-patch')
      writeNew(dir, 'source-worktree.patch', 'Harmless unwanted historical text');
    else if (mode === 'missing-receipt') fs.unlinkSync(path.join(dir, 'source-capture.json'));
    else if (mode === 'capture-paths') {
      const receipt = readJson(path.join(dir, 'source-capture.json'));
      receipt.paths.pop();
      fs.writeFileSync(path.join(dir, 'source-capture.json'), json(receipt));
    } else
      for (const file of ['run.json', 'run-start.json']) {
        const run = readJson(path.join(dir, file));
        if (mode === 'capture-pointer')
          run.harness.toolchain.value.sourceCapture = 'somewhere-else.json';
        else run.harness.version = 'p0-calibration-v1';
        fs.writeFileSync(path.join(dir, file), json(run));
      }
    reseal(dir);
    assert.doesNotThrow(() => verifyEvidence(dir));
    assert.throws(
      () => verifyRun(dir),
      /historical dirty patches|Source capture receipt|ENOENT|Harness profile differs|public input allowlist/
    );
  }
});

test('aborted cells retain input, scope, evidence and failure bindings without inventing a result', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  const cell = 'cells/dialog-open-close/blind/1';
  for (const mode of [
    'valid',
    'partial-packet',
    'artifact',
    'scope',
    'orphan-result',
    'sidecar',
    'packet',
  ]) {
    const dir = path.join(temporary(), mode);
    fs.cpSync(original, dir, { recursive: true });
    const message = 'Synthetic source drift after evaluator returned';
    fs.writeFileSync(path.join(dir, 'results.json'), json([]));
    fs.writeFileSync(
      path.join(dir, 'failure.json'),
      json({ status: 'blocked', message, stack: message, completedCells: 0 })
    );
    fs.unlinkSync(path.join(dir, cell, 'result.json'));
    const events = fs
      .readFileSync(path.join(dir, 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
      .slice(0, mode === 'partial-packet' ? 1 : 2);
    events.push(
      { type: 'run-aborted', message, completedCells: 0 },
      { type: 'run-finish', aborted: true, completedCells: 0 }
    );
    fs.writeFileSync(
      path.join(dir, 'events.jsonl'),
      events.map((event, index) => JSON.stringify({ ...event, seq: index + 1 })).join('\n') + '\n'
    );
    fs.writeFileSync(
      path.join(dir, 'report.md'),
      renderReport(readJson(path.join(dir, 'run.json')), [], new Error(message))
    );
    if (mode === 'partial-packet')
      for (const file of ['evidence', 'exposure.json', 'artifact.html', 'evaluator-output.json'])
        fs.rmSync(path.join(dir, cell, file), { recursive: true });
    else if (mode === 'artifact')
      fs.writeFileSync(path.join(dir, cell, 'artifact.html'), '<html>Wrong fixture</html>');
    else if (mode === 'scope') {
      const raw = readJson(path.join(dir, cell, 'evaluator-output.json'));
      raw.environment.scope = 'model-evaluation';
      fs.writeFileSync(path.join(dir, cell, 'evaluator-output.json'), json(raw));
    } else if (mode === 'orphan-result')
      fs.copyFileSync(
        path.join(original, cell, 'result.json'),
        path.join(dir, cell, 'result.json')
      );
    else if (mode === 'sidecar')
      fs.writeFileSync(path.join(dir, cell, 'evidence/failures.json'), json([]));
    else if (mode === 'packet')
      fs.writeFileSync(path.join(dir, cell, 'participant/task.txt'), 'Wrong task');
    if (mode === 'partial-packet') {
      const run = readJson(path.join(dir, 'run.json'));
      run.harness.browser = readJson(path.join(dir, 'run-start.json')).harness.browser;
      fs.writeFileSync(path.join(dir, 'run.json'), json(run));
    }
    reseal(dir);
    if (['valid', 'partial-packet'].includes(mode)) assert.equal(verifyRun(dir).status, 'aborted');
    else
      assert.throws(
        () => verifyRun(dir),
        /Artifact differs|Raw evaluator scope|Orphan cell result|Failure sidecar|Prompt differs/
      );
  }
});

test('initialization cannot hide cell lifecycle entries or evaluated artifacts', () => {
  for (const mode of ['journal', 'cell-file']) {
    const dir = temporary();
    const message = 'Synthetic initialization failure';
    writeNew(dir, 'results.json', json([]));
    writeNew(
      dir,
      'failure.json',
      json({ status: 'blocked', message, stack: message, completedCells: 0 })
    );
    const events = [{ type: 'run-aborted', message, completedCells: 0 }];
    if (mode === 'journal')
      events.push({ type: 'cell-start' }, { type: 'cell-finish', status: 'pass' });
    else
      writeNew(dir, 'cells/dialog-open-close/blind/1/evaluator-output.json', json({ checks: [] }));
    events.push({ type: 'run-finish', aborted: true, completedCells: 0 });
    writeNew(
      dir,
      'events.jsonl',
      events.map((event, index) => JSON.stringify({ ...event, seq: index + 1 })).join('\n') + '\n'
    );
    writeNew(dir, 'report.md', renderReport(undefined, [], new Error(message)));
    sealEvidence(dir);
    assert.throws(
      () => verifyRun(dir),
      /Missing run manifest without valid initialization failure/
    );
  }
});

test('relative source closure includes side-effect, named, re-export and dynamic imports', () => {
  const dir = temporary();
  for (const statement of [
    "import './omitted.mjs';",
    "import { value } from './omitted.mjs';",
    "export { value } from './omitted.mjs';",
    "await import('./omitted.mjs');",
    'await import(`./omitted.mjs`);',
  ]) {
    fs.mkdirSync(path.join(dir, 'scripts/benchmark'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts/benchmark/test.mjs'), statement);
    assert.throws(
      () => verifySourceImports(dir, ['scripts/benchmark/test.mjs']),
      /omits a relative harness import/
    );
  }
  fs.writeFileSync(
    path.join(dir, 'scripts/benchmark/test.mjs'),
    `// import './comment-only.mjs';\nconst example = "import './string-only.mjs';";`
  );
  assert.doesNotThrow(() => verifySourceImports(dir, ['scripts/benchmark/test.mjs']));
});

test('calibration rejects unknown or duplicate deviations in manifests, results and transforms', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const deviations of [
    ['Unapplied experimental change'],
    [negativeControlDeviation, negativeControlDeviation],
  ]) {
    const dir = path.join(temporary(), 'changed');
    fs.cpSync(original, dir, { recursive: true });
    for (const file of ['run.json', 'run-start.json']) {
      const value = readJson(path.join(dir, file));
      value.deviations = deviations;
      fs.writeFileSync(path.join(dir, file), json(value));
      assert.throws(() => validateDocument('run', value), /Calibration deviations/);
    }
    const rows = readJson(path.join(dir, 'results.json'));
    rows[0].deviations = deviations;
    fs.writeFileSync(path.join(dir, 'results.json'), json(rows));
    fs.writeFileSync(path.join(dir, 'cells/dialog-open-close/blind/1/result.json'), json(rows[0]));
    assert.throws(() => validateDocument('result', rows[0]), /Calibration deviations/);
    assert.throws(
      () => fixtureArtifact('<script>example</script>', deviations),
      /Calibration deviations/
    );
    reseal(dir);
    assert.throws(() => verifyRun(dir), /Calibration deviations/);
  }
});

test('calibration repeat bounds reject oversized plans before expansion with bounded verifier resources', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  for (const repeats of [11, 1_000_000_000]) {
    const dir = path.join(temporary(), 'oversized');
    fs.cpSync(original, dir, { recursive: true });
    for (const file of ['run.json', 'run-start.json']) {
      const value = readJson(path.join(dir, file));
      value.plan.repeats = repeats;
      assert.throws(() => validateDocument('run', value), /Calibration repetitions/);
      fs.writeFileSync(path.join(dir, file), json(value));
    }
    reseal(dir);
    const checked = spawnSync(
      process.execPath,
      ['--max-old-space-size=128', 'scripts/benchmark/benchmark.mjs', 'verify', '--out', dir],
      { cwd: root, encoding: 'utf8', timeout: 5000 }
    );
    assert.equal(checked.status, 1, checked.stderr);
    assert.match(checked.stderr, /Calibration repetitions must be an integer in 1\.\.10/);
  }
  const row = readJson(path.join(original, 'results.json'))[0];
  row.repeat = 11;
  assert.throws(() => validateDocument('result', row), /Calibration result repeat exceeds/);
});

test('evaluator dependency workspace files, metadata and observed version are source-bound', async () => {
  const original = path.join(temporary(), 'original');
  await dryRun({
    output: original,
    selectedCases: ['dialog-open-close'],
    arms: ['blind'],
    chromiumPath: '/missing-public-calibration-chromium',
  });
  const run = readJson(path.join(original, 'run.json'));
  assert.equal(run.harness.version, 'p0-calibration-v3');
  assert.equal(run.harness.toolchain.value.evaluatorDependency.package, 'playwright-core');
  assert.equal(
    run.harness.toolchain.value.evaluatorDependency.manifestPath,
    'apps/www/package.json'
  );
  assert.equal(
    verifyRun(original).dependencyCapturePolicy,
    'workspace-declaration-and-lock-bound; observed-version-checked'
  );
  for (const mode of [
    'apps/www/package.json',
    'pnpm-workspace.yaml',
    'metadata',
    'observed-version',
    'oracle-identity',
  ]) {
    const dir = path.join(temporary(), 'changed');
    fs.cpSync(original, dir, { recursive: true });
    if (mode.endsWith('.json') || mode.endsWith('.yaml')) {
      const inventory = readJson(path.join(dir, 'source-inventory.json'));
      inventory.files = inventory.files.filter((file) => file.path !== mode);
      fs.unlinkSync(path.join(dir, 'source', mode));
      fs.writeFileSync(path.join(dir, 'source-inventory.json'), json(inventory));
      for (const file of ['run.json', 'run-start.json']) {
        const value = readJson(path.join(dir, file));
        value.harness.sourceDigest = sha256(json(inventory.files));
        fs.writeFileSync(path.join(dir, file), json(value));
      }
    } else if (mode === 'metadata') {
      for (const file of ['run.json', 'run-start.json']) {
        const value = readJson(path.join(dir, file));
        value.harness.toolchain.value.evaluatorDependency.resolvedVersion = '999.0.0';
        fs.writeFileSync(path.join(dir, file), json(value));
      }
    } else {
      const file = path.join(dir, 'cells/dialog-open-close/blind/1/evaluator-output.json');
      const raw = readJson(file);
      if (mode === 'observed-version') raw.environment.playwrightVersion = '999.0.0';
      else raw.oracleRef = 'public-calibration-dialog-open-close-v1';
      fs.writeFileSync(file, json(raw));
    }
    reseal(dir);
    assert.throws(
      () => verifyRun(dir),
      /public input allowlist|evaluator dependency differs|Observed Playwright version|oracle identity differs/
    );
  }
});
