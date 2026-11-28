import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import YAML from 'yaml';
import {
  assertCaptureReceipts,
  assertPlatform,
  assertSource,
  assertTerminal,
  recordFailure,
  runStages,
  stages,
} from '../native-capture-diagnostic.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const workflow = YAML.parse(
  fs.readFileSync(path.join(root, '.github/workflows/gpui-adapter-acceptance.yml'), 'utf8')
);
const condition = (expression, event, scope) =>
  Boolean(
    Function(
      'github',
      'inputs',
      `return (${expression.slice(3, -3)});`
    )({ event_name: event }, { scope })
  );

for (const [event, scope, expected] of [
  ['workflow_dispatch', undefined, 'adapter-macos'],
  ['workflow_dispatch', '', 'adapter-macos'],
  ['workflow_dispatch', 'adapter', 'adapter-macos'],
  ['workflow_dispatch', 'native-capture-macos26', 'native-capture-macos26'],
  ['workflow_dispatch', 'unknown', 'reject-unknown-scope'],
  ['workflow_dispatch', 'native-capture-macos15', 'reject-unknown-scope'],
  ['workflow_dispatch', ' adapter ', 'reject-unknown-scope'],
  ['workflow_call', undefined, 'adapter-macos'],
  ['workflow_call', 'native-capture-macos26', 'adapter-macos'],
  ['push', undefined, 'adapter-macos'],
  ['pull_request', undefined, 'adapter-macos'],
]) {
  test(`actual workflow route: ${event}/${String(scope)} selects ${expected}`, () => {
    assert.deepEqual(
      Object.entries(workflow.jobs)
        .filter(([, job]) => condition(job.if, event, scope))
        .map(([name]) => name),
      [expected]
    );
  });
}

test('the reusable schema and original adapter job remain unchanged', () => {
  assert.equal(workflow.on.workflow_call, null, 'The new scope is not exposed to reusable callers');
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.scope.options, [
    'adapter',
    'native-capture-macos26',
  ]);
  assert.equal(workflow.on.workflow_dispatch.inputs.scope.default, 'adapter');
  const adapter = structuredClone(workflow.jobs['adapter-macos']);
  delete adapter.if;
  // Exact parsed original job at f595, including all commands/env/budgets.
  assert.equal(
    createHash('sha256').update(JSON.stringify(adapter)).digest('hex'),
    '3a8a92c22a7bac2ed82fe8ea93eb349e76617f719cbcd5c5f011c4ec4a625d66'
  );
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.match(workflow.jobs['reject-unknown-scope'].steps[0].run, /exit 1/);
});

test('the new lane preserves the actual CI macOS environment, deadline and commands', () => {
  const lane = workflow.jobs['native-capture-macos26'];
  assert.equal(lane['runs-on'], 'macos-latest');
  assert.equal(lane['timeout-minutes'], 30);
  assert.deepEqual(Object.keys(lane.env).sort(), ['CANDIDATE_SHA', 'GPUI_NATIVE_DIAGNOSTIC_DIR']);
  assert.equal(
    lane.steps.find((step) => step.run?.includes('native-capture-diagnostic.mjs')).if,
    '${{ !cancelled() }}'
  );
  assert.equal(lane.steps.at(-1).if, 'always()');
  assert.equal(lane.steps.at(-1).with['if-no-files-found'], 'error');
  const selected = stages('/repo', '/evidence');
  const ci = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
  const original = ci.jobs['rust-macos'];
  const commands = original.steps
    .flatMap((step) => (step.run ?? '').split('\n'))
    .map((line) => line.trim())
    .filter((line) => line.startsWith('cargo '))
    .map((line) => line.split(' 2>&1')[0]);
  assert.deepEqual(
    selected
      .filter((stage) => stage.command === 'cargo' && stage.name !== 'fmt')
      .map((stage) => [stage.command, ...stage.args].join(' ')),
    commands
  );
  assert.equal(selected.find((stage) => stage.name === 'fmt').args.join(' '), 'fmt --all --check');
  const cache = lane.steps.find((step) => step.uses === 'actions/cache@v4');
  assert.deepEqual(
    cache.with,
    original.steps.find((step) => step.uses === 'actions/cache@v4').with
  );
  for (const [name, expected] of [
    ['capture_frame', 15],
    ['capture_pixels', 7],
    ['capture_state', 3],
  ]) {
    const count = fs
      .readFileSync(path.join(root, `native/gpui/crates/proto-ui-gpui/tests/${name}.rs`), 'utf8')
      .match(/#\[test\]/g).length;
    assert.equal(count, expected);
    assert.equal(selected.find((stage) => stage.name === name).count, expected);
  }
  assert.equal(selected.find((stage) => stage.name === 'accesskit_macos').count, 23);
});

test('actual platform guard rejects macOS 15, another architecture or overridden toolchain', () => {
  const good = {
    version: '26.7.2',
    architecture: 'arm64',
    activeToolchain: 'stable-aarch64-apple-darwin (directory override)',
    rustupOverride: '',
  };
  assertPlatform(good);
  for (const bad of [
    { version: '15.7.1' },
    { architecture: 'x86_64' },
    { activeToolchain: '1.98.1-aarch64-apple-darwin' },
    { rustupOverride: '1.98.1' },
  ]) {
    assert.throws(() => assertPlatform({ ...good, ...bad }));
  }
});

test('source receipt refuses dirty, different or changed source and lock bytes', () => {
  const before = {
    sha: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    status: '',
    files: [{ path: 'Cargo.lock', sha256: 'c'.repeat(64) }],
  };
  assertSource(before, structuredClone(before), before.sha);
  for (const after of [
    { ...before, status: ' M Cargo.lock' },
    { ...before, sha: 'd'.repeat(40) },
    { ...before, files: [{ path: 'Cargo.lock', sha256: 'd'.repeat(64) }] },
  ]) {
    assert.throws(() => assertSource(before, after, before.sha));
  }
  assert.throws(() => assertSource({ ...before, status: '?? stale.png' }, before, before.sha));
  assert.throws(() => assertSource(before, before, 'd'.repeat(40)));
});

const success = (count = 23) => ({
  exitCode: 0,
  signal: null,
  error: null,
  log: `test result: ok. ${count} passed; 0 failed\n`,
});
test('native terminal evidence requires all original assertions and a successful real command', () => {
  const stage = { name: 'accesskit_macos', count: 23 };
  assertTerminal(stage, success());
  for (const bad of [
    success(22),
    { ...success(), exitCode: 1 },
    { ...success(), signal: 'SIGTERM' },
    { ...success(), error: 'spawn failed' },
    { ...success(), log: '' },
    { ...success(), log: success().log.repeat(2) },
    { ...success(), log: 'test result: FAILED. 22 passed; 1 failed\n' },
  ]) {
    assert.throws(() => assertTerminal(stage, bad));
  }
  assert.throws(() =>
    assertTerminal(
      { name: 'capture_frame', count: 15 },
      {
        ...success(15),
        log: 'test result: ok. 15 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.01s\n',
      }
    )
  );
});

test('a first failure remains sticky while later original commands still reach terminal results', async () => {
  const selected = [{ name: 'fmt' }, { name: 'workspace' }, { name: 'accesskit_macos', count: 23 }];
  const calls = [];
  const progress = [];
  const result = await runStages(
    selected,
    async (stage) => {
      calls.push(stage.name);
      return stage.name === 'fmt' ? { exitCode: 1, log: 'format diff' } : success();
    },
    (state) => progress.push(structuredClone(state))
  );
  assert.deepEqual(calls, ['fmt', 'workspace', 'accesskit_macos']);
  assert.equal(result.firstFailure, 'fmt');
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.results.map((row) => row.status),
    ['failed', 'passed', 'passed']
  );
  recordFailure(result, 'capture-receipts', 'later receipt failure');
  recordFailure(result, 'source-after', 'later source failure');
  assert.equal(result.firstFailure, 'fmt');
  assert.equal(progress.at(-1).firstFailure, 'fmt');
});

test('failed pure-std compilation blocks only its own binary and never reuses a stale executable', async () => {
  const calls = [];
  const result = await runStages(
    [
      { name: 'compile-capture_frame' },
      { name: 'capture_frame', dependency: 'compile-capture_frame' },
      { name: 'clippy-native' },
    ],
    async (stage) => {
      calls.push(stage.name);
      return { exitCode: stage.name.startsWith('compile') ? 1 : 0, log: '' };
    },
    () => {}
  );
  assert.deepEqual(calls, ['compile-capture_frame', 'clippy-native']);
  assert.deepEqual(
    result.results.map((row) => row.status),
    ['failed', 'blocked', 'passed']
  );
  assert.equal(result.firstFailure, 'compile-capture_frame');
});

test('an earlier workflow preparation failure remains failed even if every command passes', async () => {
  const calls = [];
  const result = await runStages(
    [{ name: 'accesskit_macos', count: 23 }],
    async (stage) => {
      calls.push(stage.name);
      return success();
    },
    () => {},
    () => false,
    [{ name: 'workflow-preparation', status: 'failed', reportedStatus: 'failure' }]
  );
  assert.deepEqual(calls, ['accesskit_macos']);
  assert.equal(result.firstFailure, 'workflow-preparation');
  assert.equal(result.passed, false);
});

test('spawn failure does not hide later commands and cancellation never launches another stage', async () => {
  const failed = await runStages(
    [{ name: 'first' }, { name: 'second' }],
    async (stage) => {
      if (stage.name === 'first') throw new Error('spawn unavailable');
      return { exitCode: 0, log: '' };
    },
    () => {}
  );
  assert.deepEqual(
    failed.results.map((row) => row.status),
    ['failed', 'passed']
  );
  let cancelled = false;
  const calls = [];
  const stopped = await runStages(
    [{ name: 'first' }, { name: 'second' }, { name: 'third' }],
    async (stage) => {
      calls.push(stage.name);
      cancelled = true;
      return { exitCode: 0, log: '' };
    },
    () => {},
    () => cancelled
  );
  assert.deepEqual(calls, ['first']);
  assert.deepEqual(
    stopped.results.map((row) => row.status),
    ['passed', 'cancelled', 'cancelled']
  );
  assert.equal(stopped.passed, false);
});

// Synthetic envelope fixtures exercise only the carrier validator. They are
// temporary, contain no rendered image, and are not native capture evidence.
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpui-capture-validator-unit-'));
  fs.mkdirSync(path.join(directory, 'accesskit'));
  const streams = [];
  for (const phase of ['action-enabled', 'action-disabled']) {
    const base = path.join(directory, 'accesskit', `control-label-${phase}`);
    const png = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.writeUInt32BE(300, 16);
    png.writeUInt32BE(332, 20);
    const stream = {
      rule: 'first-current-complete-native-frame-v1',
      windowId: 31,
      processId: 42,
      phaseStartedAtMach: 100,
      startCompleted: true,
      stopRequested: true,
      stopCompleted: true,
      stopSucceeded: true,
      outputRemoved: true,
      queueDrained: true,
      stopAndDrainWithinCaptureDeadline: true,
      resourceError: null,
      captureError: null,
      frames: [
        {
          decision: 'first-current-complete-frame',
          status: 0,
          valid: true,
          dataReady: true,
          width: 300,
          height: 332,
          displayTimeMach: 200,
          observedAtMach: 300,
        },
      ],
    };
    const receipt = {
      rule: 'two-label-content-v1',
      passed: true,
      pixelGatePassed: true,
      windowId: 31,
      processId: 42,
      width: 300,
      height: 332,
      platformFrames: { callbacks: 2, visible: true, error: null },
      labels: [
        { label: 'passive', passed: true },
        { label: 'actionable', passed: true },
      ],
      nativeStream: stream,
    };
    fs.writeFileSync(`${base}.png`, png);
    fs.writeFileSync(`${base}.pixels.json`, JSON.stringify(receipt));
    fs.writeFileSync(`${base}.frames.json`, JSON.stringify(stream));
    streams.push({ base, receipt });
  }
  return {
    directory,
    streams,
    close: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test('capture envelopes require original pixel gates and confirmed current-frame cleanup', () => {
  const f = fixture();
  try {
    assert.equal(assertCaptureReceipts(f.directory).length, 2);
    for (const mutate of [
      (r) => {
        r.passed = false;
      },
      (r) => {
        r.pixelGatePassed = false;
      },
      (r) => {
        r.platformFrames.callbacks = 1;
      },
      (r) => {
        r.labels[1].passed = false;
      },
      (r) => {
        r.nativeStream.resourceError = 'native stop failed';
      },
      (r) => {
        r.nativeStream.queueDrained = false;
      },
      (r) => {
        r.nativeStream.stopAndDrainWithinCaptureDeadline = false;
      },
      (r) => {
        r.nativeStream.frames[0].displayTimeMach = 99;
      },
      (r) => {
        r.nativeStream.frames[0].displayTimeMach = 301;
      },
      (r) => {
        r.nativeStream.frames[0].status = 4;
      },
      (r) => {
        r.nativeStream.frames.push({ ...r.nativeStream.frames[0] });
      },
    ]) {
      const { base, receipt } = f.streams[0];
      const changed = structuredClone(receipt);
      mutate(changed);
      fs.writeFileSync(`${base}.pixels.json`, JSON.stringify(changed));
      fs.writeFileSync(`${base}.frames.json`, JSON.stringify(changed.nativeStream));
      assert.throws(() => assertCaptureReceipts(f.directory));
      fs.writeFileSync(`${base}.pixels.json`, JSON.stringify(receipt));
      fs.writeFileSync(`${base}.frames.json`, JSON.stringify(receipt.nativeStream));
    }
    fs.unlinkSync(`${f.streams[1].base}.png`);
    assert.throws(() => assertCaptureReceipts(f.directory));
  } finally {
    f.close();
  }
});
