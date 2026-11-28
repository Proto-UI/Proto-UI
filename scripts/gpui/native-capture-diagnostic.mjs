import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const nativeRoot = 'native/gpui';
const nativeTests = 'crates/proto-ui-gpui/tests';
const selectedFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/gpui-adapter-acceptance.yml',
  'scripts/gpui/native-capture-diagnostic.mjs',
  'scripts/gpui/test/native-capture-source.test.mjs',
  'native/gpui/Cargo.toml',
  'native/gpui/Cargo.lock',
  'native/gpui/rust-toolchain.toml',
  'native/gpui/crates/proto-ui-gpui/Cargo.toml',
  ...[
    'accesskit_macos.rs',
    'capture_frame.rs',
    'capture_pixels.rs',
    'capture_state.rs',
    'support/native_capture.rs',
    'support/native_stream.rs',
    'support/capture_frame.rs',
    'support/capture_pixels.rs',
    'support/capture_state.rs',
  ].map((name) => `${nativeRoot}/${nativeTests}/${name}`),
];

function checked(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0 || result.error) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error ?? result.stderr}`);
  }
  return result.stdout.trim();
}

function source(root) {
  return {
    sha: checked('git', ['rev-parse', 'HEAD'], root),
    tree: checked('git', ['rev-parse', 'HEAD^{tree}'], root),
    status: checked('git', ['status', '--porcelain=v1', '--untracked-files=all'], root),
    files: selectedFiles.map((name) => ({
      path: name,
      sha256: createHash('sha256')
        .update(fs.readFileSync(path.join(root, name)))
        .digest('hex'),
    })),
  };
}

export function assertPlatform(facts) {
  assert.match(facts.version, /^26\./, 'This diagnostic requires the actual macOS 26 family');
  assert.equal(facts.architecture, 'arm64', 'This diagnostic requires the actual ARM runner');
  assert.equal(
    facts.activeToolchain.split(/\s/)[0],
    'stable-aarch64-apple-darwin',
    'Use the original workspace stable toolchain'
  );
  assert.equal(
    facts.rustupOverride,
    '',
    'Do not replace the workspace toolchain with an env override'
  );
}

export function assertSource(before, after, requestedSha) {
  assert.match(requestedSha, /^[a-f0-9]{40}$/);
  assert.equal(before.sha, requestedSha);
  assert.equal(before.status, '', 'The initial checkout must be clean');
  assert.deepEqual(after, before, 'Source, locks and capture helpers must remain unchanged');
}

export function stages(root, evidence) {
  const cwd = path.join(root, nativeRoot);
  const list = [
    {
      name: 'source-privacy',
      command: process.execPath,
      args: ['--test', '--test-reporter=tap', 'scripts/gpui/test/native-capture-source.test.mjs'],
      cwd: root,
    },
  ];
  for (const [name, count] of [
    ['capture_frame', 15],
    ['capture_pixels', 7],
    ['capture_state', 3],
  ]) {
    const binary = path.join(evidence, 'bin', name);
    list.push({
      name: `compile-${name}`,
      command: 'rustc',
      args: ['--edition=2021', '--test', `${nativeTests}/${name}.rs`, '-o', binary],
      cwd,
    });
    list.push({ name, command: binary, args: [], cwd, count, dependency: `compile-${name}` });
  }
  list.push(
    { name: 'fmt', command: 'cargo', args: ['fmt', '--all', '--check'], cwd },
    {
      name: 'clippy-workspace',
      command: 'cargo',
      args: ['clippy', '--workspace', '--all-targets', '--', '-D', 'warnings'],
      cwd,
    },
    {
      name: 'clippy-native',
      command: 'cargo',
      args: [
        'clippy',
        '-p',
        'proto-ui-gpui',
        '--features',
        'macos-accessibility-test',
        '--all-targets',
        '--',
        '-D',
        'warnings',
      ],
      cwd,
    },
    { name: 'workspace', command: 'cargo', args: ['test', '--workspace'], cwd },
    {
      name: 'accesskit_macos',
      command: 'cargo',
      args: [
        'test',
        '-p',
        'proto-ui-gpui',
        '--features',
        'macos-accessibility-test',
        '--test',
        'accesskit_macos',
      ],
      cwd,
      count: 23,
      env: { PROTO_GPUI_EVIDENCE_DIR: path.join(evidence, 'accesskit') },
    }
  );
  return list;
}

export function assertTerminal(stage, result) {
  assert.equal(result.exitCode, 0, `${stage.name} command failed`);
  assert.equal(result.signal ?? null, null, `${stage.name} was terminated`);
  assert.equal(result.error ?? null, null, `${stage.name} could not execute`);
  if (stage.count) {
    const summaries = [
      ...result.log.matchAll(/^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed(.*)$/gm),
    ];
    assert.equal(summaries.length, 1, `${stage.name} must have one actual terminal summary`);
    const [, outcome, passed, failed, suffix] = summaries[0];
    assert.equal(outcome, 'ok');
    assert.equal(Number(passed), stage.count);
    assert.equal(Number(failed), 0);
    if (stage.name !== 'accesskit_macos') {
      assert.match(suffix, /; 0 ignored; 0 measured; 0 filtered out;/);
    } else {
      assert.equal(suffix.trim(), '');
    }
  } else if (stage.name === 'workspace') {
    assert.match(result.log, /^test result: ok\. [1-9]\d* passed;/m);
  } else if (stage.name === 'source-privacy') {
    for (const expected of ['# tests 8', '# pass 8', '# fail 0', '# skipped 0']) {
      assert.ok(result.log.split(/\r?\n/).includes(expected), expected);
    }
  }
}

export async function runStages(selected, execute, record, cancelled = () => false, prior = []) {
  const results = [...prior];
  let firstFailure = results.find((result) => result.status !== 'passed')?.name ?? null;
  for (const stage of selected) {
    let result;
    if (cancelled()) {
      result = { name: stage.name, status: 'cancelled', reason: 'diagnostic cancelled' };
    } else if (
      stage.dependency &&
      results.find((row) => row.name === stage.dependency)?.status !== 'passed'
    ) {
      result = {
        name: stage.name,
        status: 'blocked',
        reason: `failed dependency: ${stage.dependency}`,
      };
    } else {
      try {
        const actual = await execute(stage);
        try {
          assertTerminal(stage, actual);
          result = { ...actual, name: stage.name, status: 'passed' };
        } catch (error) {
          result = { ...actual, name: stage.name, status: 'failed', reason: error.message };
        }
        delete result.log;
      } catch (error) {
        result = { name: stage.name, status: 'failed', reason: String(error) };
      }
    }
    if (result.status !== 'passed' && firstFailure === null) firstFailure = result.name;
    results.push(result);
    await record({ firstFailure, results });
  }
  return { firstFailure, results, passed: firstFailure === null };
}

export function recordFailure(summary, name, error) {
  summary.firstFailure ??= name;
  summary.passed = false;
  summary.results.push({ name, status: 'failed', reason: String(error) });
}

export function assertCaptureReceipts(evidence) {
  const receipts = [];
  for (const phase of ['action-enabled', 'action-disabled']) {
    const base = path.join(evidence, 'accesskit', `control-label-${phase}`);
    const png = fs.readFileSync(`${base}.png`);
    assert.ok(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    const receipt = JSON.parse(fs.readFileSync(`${base}.pixels.json`, 'utf8'));
    assert.equal(receipt.rule, 'two-label-content-v1');
    assert.equal(receipt.passed, true);
    assert.equal(receipt.pixelGatePassed, true);
    assert.ok(
      Number.isInteger(receipt.platformFrames?.callbacks) && receipt.platformFrames.callbacks >= 2
    );
    assert.equal(receipt.platformFrames.visible, true);
    assert.equal(receipt.platformFrames.error, null);
    assert.equal(receipt.labels?.length, 2);
    assert.deepEqual(
      receipt.labels.map((label) => [label.label, label.passed]),
      [
        ['passive', true],
        ['actionable', true],
      ]
    );
    assert.equal(png.readUInt32BE(16), receipt.width);
    assert.equal(png.readUInt32BE(20), receipt.height);
    assert.ok(Number.isInteger(receipt.windowId) && receipt.windowId > 0);
    assert.ok(Number.isInteger(receipt.processId) && receipt.processId > 0);
    const stream = receipt.nativeStream;
    assert.equal(stream.rule, 'first-current-complete-native-frame-v1');
    assert.equal(stream.windowId, receipt.windowId);
    assert.equal(stream.processId, receipt.processId);
    assert.equal(stream.resourceError, null);
    assert.equal(stream.captureError, null);
    for (const field of [
      'startCompleted',
      'stopRequested',
      'stopCompleted',
      'stopSucceeded',
      'outputRemoved',
      'queueDrained',
      'stopAndDrainWithinCaptureDeadline',
    ]) {
      assert.equal(stream[field], true, `${phase}: ${field}`);
    }
    const qualified = stream.frames.filter(
      (frame) => frame.decision === 'first-current-complete-frame'
    );
    assert.equal(qualified.length, 1);
    const frame = qualified[0];
    assert.equal(frame.status, 0);
    assert.equal(frame.valid, true);
    assert.equal(frame.dataReady, true);
    assert.equal(frame.width, receipt.width);
    assert.equal(frame.height, receipt.height);
    assert.ok(Number.isSafeInteger(stream.phaseStartedAtMach) && stream.phaseStartedAtMach > 0);
    assert.ok(
      Number.isSafeInteger(frame.displayTimeMach) && Number.isSafeInteger(frame.observedAtMach)
    );
    assert.ok(
      frame.displayTimeMach >= stream.phaseStartedAtMach &&
        frame.displayTimeMach <= frame.observedAtMach
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(`${base}.frames.json`, 'utf8')), stream);
    receipts.push({
      phase,
      windowId: receipt.windowId,
      processId: receipt.processId,
      sha256: createHash('sha256').update(png).digest('hex'),
    });
  }
  assert.equal(receipts[0].windowId, receipts[1].windowId);
  assert.equal(receipts[0].processId, receipts[1].processId);
  return receipts;
}

async function main() {
  const evidence = process.env.GPUI_NATIVE_DIAGNOSTIC_DIR;
  assert.ok(evidence && path.isAbsolute(evidence), 'Require an absolute evidence directory');
  fs.mkdirSync(evidence, { recursive: true });
  fs.mkdirSync(path.join(evidence, 'single-attempt'));
  fs.mkdirSync(path.join(evidence, 'bin'));
  fs.mkdirSync(path.join(evidence, 'accesskit'));
  const write = (name, value) =>
    fs.writeFileSync(path.join(evidence, name), `${JSON.stringify(value, null, 2)}\n`);
  let child = null;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  };
  process.on('SIGTERM', cancel);
  process.on('SIGINT', cancel);
  let before;
  let summary = { passed: false, firstFailure: null, results: [] };
  try {
    const preparationStatus = process.env.GPUI_NATIVE_PREPARATION_STATUS ?? 'missing';
    const prior = [
      {
        name: 'workflow-preparation',
        status: preparationStatus === 'success' ? 'passed' : 'failed',
        reportedStatus: preparationStatus,
      },
    ];
    summary.results = prior;
    if (prior[0].status !== 'passed') summary.firstFailure = prior[0].name;
    write('preparation.json', prior[0]);
    before = source(projectRoot);
    write('source-before.json', before);
    assertSource(before, before, process.env.CANDIDATE_SHA);
    const cwd = path.join(projectRoot, nativeRoot);
    const facts = {
      version: checked('sw_vers', ['-productVersion'], cwd),
      build: checked('sw_vers', ['-buildVersion'], cwd),
      architecture: checked('uname', ['-m'], cwd),
      sdk: checked('xcrun', ['--sdk', 'macosx', '--show-sdk-version'], cwd),
      activeToolchain: checked('rustup', ['show', 'active-toolchain'], cwd),
      rustc: checked('rustc', ['--version', '--verbose'], cwd),
      cargo: checked('cargo', ['--version'], cwd),
      rustupOverride: process.env.RUSTUP_TOOLCHAIN ?? '',
      imageOS: process.env.ImageOS ?? null,
      imageVersion: process.env.ImageVersion ?? null,
      node: process.version,
    };
    write('platform.json', facts);
    assertPlatform(facts);
    summary = await runStages(
      stages(projectRoot, evidence),
      async (stage) => {
        const logPath = path.join(evidence, `${stage.name}.log`);
        const fd = fs.openSync(logPath, 'wx');
        const startedAt = new Date().toISOString();
        let actual;
        try {
          actual = await new Promise((resolve) => {
            child = spawn(stage.command, stage.args, {
              cwd: stage.cwd,
              env: { ...process.env, ...stage.env },
              stdio: ['ignore', 'pipe', 'pipe'],
              detached: true,
            });
            let error = null;
            const append = (bytes) => {
              try {
                let offset = 0;
                while (offset < bytes.length) {
                  const written = fs.writeSync(fd, bytes, offset);
                  if (written === 0) throw new Error('log write did not advance');
                  offset += written;
                }
              } catch (cause) {
                error ??= `log retention failed: ${cause.message}`;
                if (child?.pid) {
                  try {
                    process.kill(-child.pid, 'SIGTERM');
                  } catch (killError) {
                    if (killError.code !== 'ESRCH') error += `; stop failed: ${killError.message}`;
                  }
                }
              }
              process.stdout.write(bytes);
            };
            child.stdout.on('data', append);
            child.stderr.on('data', append);
            child.once('error', (cause) => {
              error ??= cause.message;
            });
            child.once('close', (exitCode, signal) => {
              child = null;
              resolve({ exitCode, signal, error });
            });
          });
        } finally {
          fs.closeSync(fd);
        }
        return {
          ...actual,
          command: [stage.command, ...stage.args],
          startedAt,
          finishedAt: new Date().toISOString(),
          logPath: path.basename(logPath),
          log: fs.readFileSync(logPath, 'utf8'),
        };
      },
      (progress) => {
        summary = { ...progress, passed: false };
        write('progress.json', progress);
      },
      () => cancelled,
      prior
    );
    try {
      write('captures.json', assertCaptureReceipts(evidence));
    } catch (error) {
      recordFailure(summary, 'capture-receipts', error);
    }
    const after = source(projectRoot);
    write('source-after.json', after);
    try {
      assertSource(before, after, process.env.CANDIDATE_SHA);
    } catch (error) {
      recordFailure(summary, 'source-after', error);
    }
    summary.passed = summary.firstFailure === null && !cancelled;
  } catch (error) {
    recordFailure(summary, summary.results.length === 0 ? 'setup' : 'runner', error);
    for (const stage of stages(projectRoot, evidence)) {
      if (!summary.results.some((result) => result.name === stage.name)) {
        summary.results.push({
          name: stage.name,
          status: 'blocked',
          reason: 'setup or runner failure',
        });
      }
    }
  } finally {
    process.off('SIGTERM', cancel);
    process.off('SIGINT', cancel);
    write('summary.json', summary);
  }
  process.exitCode = summary.passed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
