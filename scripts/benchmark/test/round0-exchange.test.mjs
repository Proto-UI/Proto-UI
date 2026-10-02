import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { sha256, json } from '../evidence.mjs';
import { pack, submit, inspect } from '../round0-exchange.mjs';
import { exchangeScope, validateExchange, limits } from '../round0-exchange-schema.mjs';

const source = {
  repository: 'https://github.com/Proto-UI/Proto-UI',
  revision: '1'.repeat(40),
  inventorySha256: '2'.repeat(64),
};
const base = (kind) => ({
  schemaVersion: 1,
  kind: `proto-ui.round0.${kind}`,
  scope: exchangeScope,
});
const put = (dir, name, content) => {
  fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
};
const entry = (name, content) => ({
  path: name,
  bytes: Buffer.byteLength(content),
  sha256: sha256(content),
});
function fixture(t, outcome = 'completed') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'round0-exchange-test-'));
  // Tests keep failed artifacts in their temporary directory for inspection.
  t.diagnostic(root);
  const input = path.join(root, 'input');
  fs.mkdirSync(input);
  put(input, 'task.txt', 'Public synthetic exchange task\n');
  const plan = {
    ...base('packet'),
    packetId: 'packet-one',
    source,
    files: [entry('task.txt', 'Public synthetic exchange task\n')],
  };
  const planPath = path.join(root, 'packet-plan.json');
  put(root, 'packet-plan.json', json(plan));
  const packet = path.join(root, 'packet');
  pack({ planPath, input, output: packet });
  const binding = {
    packetId: plan.packetId,
    receiptSha256: sha256(fs.readFileSync(path.join(packet, 'packet.json'))),
  };
  const candidate = path.join(root, 'candidate-input');
  fs.mkdirSync(candidate);
  const files = [entry('evidence/producer.log', 'Synthetic producer: no model invoked\n')];
  put(candidate, 'evidence/producer.log', 'Synthetic producer: no model invoked\n');
  if (outcome === 'completed') {
    put(candidate, 'candidate/index.html', '<p>synthetic</p>');
    files.push(entry('candidate/index.html', '<p>synthetic</p>'));
  } else {
    const code = {
      failed: 'synthetic-failure',
      aborted: 'synthetic-interruption',
      excluded: 'synthetic-exclusion',
    }[outcome];
    const disposition = json({
      ...base('disposition'),
      outcome,
      code,
      reason: 'Explicit synthetic control',
    });
    put(candidate, 'evidence/disposition.json', disposition);
    files.push(entry('evidence/disposition.json', disposition));
  }
  const submissionPlan = {
    ...base('submission'),
    submissionId: 'submission-one',
    attemptId: 'attempt-one',
    packet: binding,
    source,
    participant: 'synthetic',
    outcome,
    files,
  };
  const submissionPlanPath = path.join(root, 'submission-plan.json');
  put(root, 'submission-plan.json', json(submissionPlan));
  const expected = {
    ...base('expected-submission'),
    submissionId: submissionPlan.submissionId,
    attemptId: submissionPlan.attemptId,
    packet: binding,
    source,
  };
  const expectedPath = path.join(root, 'expected.json');
  put(root, 'expected.json', json(expected));
  const submission = path.join(root, 'submission');
  const produce = () =>
    submit({ planPath: submissionPlanPath, packet, input: candidate, output: submission });
  const check = () =>
    inspect({ expectedPath, packet, submission, output: path.join(root, 'inspection') });
  return {
    root,
    input,
    plan,
    planPath,
    packet,
    candidate,
    submissionPlan,
    submissionPlanPath,
    expected,
    expectedPath,
    submission,
    produce,
    check,
  };
}

for (const outcome of ['completed', 'failed', 'aborted', 'excluded'])
  test(`roundtrip retains synthetic ${outcome} without execution admission`, (t) => {
    const f = fixture(t, outcome);
    f.produce();
    const report = f.check();
    assert.equal(report.contract, 'valid');
    assert.equal(report.execution, 'blocked');
    assert.equal(report.isolation, 'unproven');
    assert.equal(report.outcome, outcome);
    assert.equal(report.participant, 'synthetic');
    assert.deepEqual(fs.readdirSync(path.join(f.packet, 'participant')), ['task.txt']);
    assert.equal(
      fs.readFileSync(path.join(f.root, 'inspection/inspection.json'), 'utf8'),
      json(report)
    );
  });

for (const field of ['source', 'packet', 'attemptId', 'submissionId'])
  test(`wrong expected ${field} is rejected and receipt retained`, (t) => {
    const f = fixture(t);
    f.produce();
    if (field === 'source') f.expected.source = { ...source, revision: '3'.repeat(40) };
    else if (field === 'packet')
      f.expected.packet = { ...f.expected.packet, receiptSha256: '4'.repeat(64) };
    else f.expected[field] = 'different';
    put(f.root, 'expected.json', json(f.expected));
    const r = f.check();
    assert.equal(r.contract, 'rejected');
    assert.equal(r.execution, 'blocked');
    assert.ok(fs.existsSync(path.join(f.root, 'inspection/inspection.json')));
  });

for (const name of [
  '../secret',
  '/tmp/secret',
  'candidate/../secret',
  'candidate/.hidden',
  'candidate/nested/file',
  'candidate\\escape',
  'evidence/unknown.log',
])
  test(`reject unsafe or unsupported path ${name}`, (t) => {
    const f = fixture(t);
    f.submissionPlan.files.push(entry(name, 'x'));
    put(f.root, 'submission-plan.json', json(f.submissionPlan));
    assert.throws(f.produce, /path/);
    assert.equal(fs.existsSync(f.submission), false);
  });

test('undeclared hidden file is rejected without capturing its contents', (t) => {
  const f = fixture(t);
  put(f.candidate, '.unselected-private', 'PRIVATE CANARY');
  assert.throws(f.produce, /inventory/);
  assert.equal(fs.existsSync(f.submission), false);
});
test('extra empty directory is rejected', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.candidate, 'extra'));
  assert.throws(f.produce, /director|inventory/);
});
for (const type of ['symlink', 'hardlink', 'fifo'])
  test(`reject ${type} payload`, (t) => {
    const f = fixture(t);
    const target = path.join(f.candidate, 'candidate/index.html');
    fs.unlinkSync(target);
    const external = path.join(f.root, 'external');
    fs.writeFileSync(external, '<p>synthetic</p>');
    if (type === 'symlink') fs.symlinkSync(external, target);
    else if (type === 'hardlink') fs.linkSync(external, target);
    else execFileSync('mkfifo', [target]);
    assert.throws(f.produce, /regular|link|file/);
    assert.equal(fs.existsSync(f.submission), false);
  });
test('symlink input root is rejected', (t) => {
  const f = fixture(t);
  const link = path.join(f.root, 'input-link');
  fs.symlinkSync(f.candidate, link);
  assert.throws(
    () =>
      submit({
        planPath: f.submissionPlanPath,
        packet: f.packet,
        input: link,
        output: f.submission,
      }),
    /link/
  );
});
test('missing raw evidence rejects instead of fabricating success', (t) => {
  const f = fixture(t);
  f.submissionPlan.files = f.submissionPlan.files.filter((x) => x.path !== 'evidence/producer.log');
  put(f.root, 'submission-plan.json', json(f.submissionPlan));
  assert.throws(f.produce, /log/);
});
test('unknown status, participant and fields cannot become model results', (t) => {
  const f = fixture(t);
  for (const change of [{ outcome: 'pass' }, { participant: 'model' }, { isolation: 'verified' }])
    assert.throws(() => validateExchange('submission', { ...f.submissionPlan, ...change }));
});
test('inventory and document resource limits apply before reading payload', (t) => {
  const f = fixture(t);
  assert.throws(
    () => validateExchange('packet', { ...f.plan, files: Array(33).fill(f.plan.files[0]) }),
    /at most/
  );
  assert.throws(
    () =>
      validateExchange('packet', {
        ...f.plan,
        files: [{ ...f.plan.files[0], bytes: limits.fileBytes + 1 }],
      }),
    /limit/
  );
  assert.throws(
    () =>
      validateExchange('submission', {
        ...f.submissionPlan,
        files: Array.from({ length: 9 }, (_, i) => ({
          path: `candidate/file${i}`,
          bytes: limits.fileBytes,
          sha256: '0'.repeat(64),
        })),
      }),
    /Total/
  );
  fs.writeFileSync(f.submissionPlanPath, ' '.repeat(limits.documentBytes + 1));
  assert.throws(f.produce, /limit/);
});
test('digest changes and duplicate inventories reject before output', (t) => {
  const f = fixture(t);
  put(f.candidate, 'candidate/index.html', '<p>changed</p>');
  assert.throws(f.produce, /digest|bytes/);
  f.submissionPlan.files.push(f.submissionPlan.files[0]);
  assert.throws(() => validateExchange('submission', f.submissionPlan), /duplicate/);
});
test('post-snapshot mutation and extra receipt fields reject inspection', (t) => {
  const f = fixture(t);
  f.produce();
  put(f.submission, 'payload/candidate/index.html', 'tampered');
  assert.equal(f.check().contract, 'rejected');
});
test('mismatched typed failure disposition is retained but rejected', (t) => {
  const f = fixture(t, 'failed');
  const content = json({
    ...base('disposition'),
    outcome: 'aborted',
    code: 'synthetic-interruption',
    reason: 'Mismatch',
  });
  put(f.candidate, 'evidence/disposition.json', content);
  f.submissionPlan.files = f.submissionPlan.files.map((x) =>
    x.path === 'evidence/disposition.json' ? entry(x.path, content) : x
  );
  put(f.root, 'submission-plan.json', json(f.submissionPlan));
  assert.throws(f.produce, /disposition/i);
  assert.equal(
    fs.readFileSync(path.join(f.candidate, 'evidence/disposition.json'), 'utf8'),
    content
  );
});
test('output collision cannot overwrite an earlier attempt', (t) => {
  const f = fixture(t);
  f.produce();
  const original = fs.readFileSync(path.join(f.submission, 'submission.json'));
  assert.throws(f.produce, /exist/);
  assert.deepEqual(fs.readFileSync(path.join(f.submission, 'submission.json')), original);
  f.check();
  assert.throws(f.check, /exist/);
});
test('incomplete transported attempt remains rejected with raw files intact', (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.submission);
  put(f.submission, 'payload/evidence/producer.log', 'Interrupted copy');
  const r = f.check();
  assert.equal(r.contract, 'rejected');
  assert.equal(
    fs.readFileSync(path.join(f.submission, 'payload/evidence/producer.log'), 'utf8'),
    'Interrupted copy'
  );
});
test('packet metadata cannot be silently included in participant bytes', (t) => {
  const f = fixture(t);
  put(f.input, 'packet.json', json(f.plan));
  const output = path.join(f.root, 'extra-packet');
  assert.throws(() => pack({ planPath: f.planPath, input: f.input, output }), /inventory/);
  assert.equal(fs.existsSync(output), false);
});
test('an empty task cannot be a valid packet', (t) => {
  const f = fixture(t);
  f.plan.files = [entry('task.txt', '')];
  put(f.root, 'packet-plan.json', json(f.plan));
  put(f.input, 'task.txt', '');
  const output = path.join(f.root, 'empty-task-packet');
  assert.throws(() => pack({ planPath: f.planPath, input: f.input, output }), /nonempty task/);
  assert.equal(fs.existsSync(output), false);
});
test('source object field order is not part of provenance meaning', (t) => {
  const f = fixture(t);
  f.expected.source = {
    inventorySha256: source.inventorySha256,
    revision: source.revision,
    repository: source.repository,
  };
  put(f.root, 'expected.json', json(f.expected));
  f.produce();
  assert.equal(f.check().contract, 'valid');
});
test('output nested inside an input cannot contaminate it', (t) => {
  const f = fixture(t);
  assert.throws(
    () => pack({ planPath: f.planPath, input: f.input, output: path.join(f.input, 'output') }),
    /separate/
  );
  assert.throws(
    () =>
      inspect({
        expectedPath: f.expectedPath,
        packet: f.packet,
        submission: f.submission,
        output: path.join(f.packet, 'inspection'),
      }),
    /separate/
  );
  assert.equal(fs.existsSync(path.join(f.packet, 'inspection')), false);
});
test('unknown or mismatched disposition codes are rejected', (t) => {
  const f = fixture(t, 'failed');
  const baseDisposition = {
    ...base('disposition'),
    outcome: 'failed',
    code: 'synthetic-failure',
    reason: 'Synthetic control',
  };
  for (const change of [
    { outcome: 'success' },
    { code: 'unknown' },
    { code: 'synthetic-exclusion' },
    { reason: ' ' },
    { extra: true },
  ])
    assert.throws(() => validateExchange('disposition', { ...baseDisposition, ...change }));
  assert.equal(fs.existsSync(f.submission), false);
});
test('resealed contradictory receipt still fails coordinator binding', (t) => {
  const f = fixture(t);
  f.produce();
  const receipt = JSON.parse(fs.readFileSync(path.join(f.submission, 'submission.json'), 'utf8'));
  receipt.source.revision = '9'.repeat(40);
  put(f.submission, 'submission.json', json(receipt));
  assert.equal(f.check().contract, 'rejected');
});
test('old calibration documents are not accepted as exchange documents', (t) => {
  const f = fixture(t);
  for (const kind of ['calibration-stub', 'proto-ui.round0.inspection', 'model-evaluation'])
    assert.throws(() => validateExchange('submission', { ...f.submissionPlan, kind }));
});
test('CLI pack, submit and inspect preserve complete public synthetic receipts', (t) => {
  const f = fixture(t);
  const packet = path.join(f.root, 'cli-packet');
  const submission = path.join(f.root, 'cli-submission');
  const inspection = path.join(f.root, 'cli-inspection');
  function invoke(command, args) {
    const r = spawnSync(
      process.execPath,
      ['scripts/benchmark/round0-exchange.mjs', command, ...args],
      { encoding: 'utf8' }
    );
    put(f.root, `cli-${command}.stdout.log`, r.stdout);
    put(f.root, `cli-${command}.stderr.log`, r.stderr);
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  }
  assert.equal(
    invoke('pack', ['--plan', f.planPath, '--input', f.input, '--out', packet]).execution,
    'blocked'
  );
  assert.equal(
    invoke('submit', [
      '--plan',
      f.submissionPlanPath,
      '--packet',
      packet,
      '--input',
      f.candidate,
      '--out',
      submission,
    ]).execution,
    'blocked'
  );
  const report = invoke('inspect', [
    '--expect',
    f.expectedPath,
    '--packet',
    packet,
    '--submission',
    submission,
    '--out',
    inspection,
  ]);
  assert.equal(report.contract, 'valid');
  assert.equal(report.execution, 'blocked');
  const rejected = spawnSync(process.execPath, ['scripts/benchmark/round0-exchange.mjs', 'run'], {
    encoding: 'utf8',
  });
  put(f.root, 'cli-unsupported.stderr.log', rejected.stderr);
  assert.equal(rejected.status, 1);
  assert.equal(
    JSON.parse(
      rejected.stderr
        .trim()
        .split('\n')
        .filter((line) => !line.startsWith('(node:') && !line.startsWith('(Use '))
        .join('\n')
    ).execution,
    'blocked'
  );
});
test('existing formal CLI entry stays fail closed', () => {
  const r = spawnSync(
    process.execPath,
    ['scripts/benchmark/benchmark.mjs', 'run', '--kind', 'model-evaluation'],
    { encoding: 'utf8' }
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /BLOCKED/);
});
