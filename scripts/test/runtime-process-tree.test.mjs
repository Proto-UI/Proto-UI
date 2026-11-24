import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { ownProcessTree, readProcessTable, spawnOwnedProcess } from './runtime-process-tree.mjs';
import { processFact } from './linux-process-ownership.mjs';

const posix = process.platform !== 'win32';
const options = { skip: !posix, timeout: 12_000 };
const leafSource = `process.on('SIGTERM', () => {});
process.stdout.write(JSON.stringify({ leaf: process.pid }) + '\\n');
setInterval(() => {}, 1_000);`;
function producerSource(detachedLeaf = false) {
  return `const { spawn } = require('node:child_process');
const leaf = spawn(process.execPath, ['-e', ${JSON.stringify(leafSource)}], {
  detached: ${detachedLeaf}, stdio: ['ignore', 'pipe', 'ignore']
});
leaf.stdout.once('data', data => process.stdout.write(JSON.stringify({
  producer: process.pid, ...JSON.parse(data)
}) + '\\n'));
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1_000);`;
}
async function line(stream) {
  let buffered = '';
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    buffered += chunk.toString();
    if (buffered.includes('\n')) return buffered.slice(0, buffered.indexOf('\n'));
  }
  throw new Error('Producer exited before reporting its process identity');
}
function kill(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
async function live(pid) {
  return (await readProcessTable()).some((row) => row.pid === pid && !row.state.startsWith('Z'));
}
async function fixture(t, detachedLeaf = false) {
  const child = spawn(process.execPath, ['-e', producerSource(detachedLeaf)], {
    detached: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const tree = ownProcessTree(child, { label: 'fixture', graceMs: 150, killWaitMs: 1_000 });
  const identities = JSON.parse(await line(child.stdout));
  t.after(async () => {
    await tree.stop();
    kill(identities.leaf);
    kill(-child.pid);
  });
  await tree.capture();
  return { child, tree, ...identities };
}

it('kills a TERM-resistant descendant after its group leader exits', options, async (t) => {
  const { child, tree, leaf } = await fixture(t);
  const receipt = await tree.stop();
  assert.equal(child.exitCode, 0, 'Leader must have exited normally on TERM');
  assert.equal(receipt.verified, true);
  assert.deepEqual(
    receipt.signals.map((event) => event.signal),
    ['SIGTERM', 'SIGKILL']
  );
  assert.equal(await live(leaf), false);
  assert.ok(receipt.peakRssKiB > 0);
  assert.ok(receipt.observedPids.includes(leaf));
});

it('still cleans the private group when the leader had already exited', options, async (t) => {
  const { child, tree, leaf } = await fixture(t);
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
  assert.equal(await live(leaf), true, 'The discriminating survivor must be alive before cleanup');
  const receipt = await tree.stop();
  assert.equal(receipt.verified, true);
  assert.equal(await live(leaf), false);
  assert.ok(receipt.signals.some((event) => event.signal === 'SIGKILL'));
});

it(
  'cleans a sampled detached descendant without signalling an unrelated group',
  options,
  async (t) => {
    const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: true,
      stdio: 'ignore',
    });
    t.after(() => kill(-unrelated.pid));
    const { child, tree, leaf } = await fixture(t, true);
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
    const receipt = await tree.stop();
    assert.equal(receipt.verified, true);
    assert.equal(await live(leaf), false);
    assert.equal(await live(unrelated.pid), true);
    assert.ok(receipt.signals.some((event) => event.target === leaf && event.signal === 'SIGKILL'));
    assert.ok(receipt.signals.every((event) => Math.abs(event.target) !== unrelated.pid));
  }
);

it(
  'coalesces simultaneous cleanup and records a graceful tree exit without KILL',
  options,
  async (t) => {
    const child = spawn(
      process.execPath,
      ['-e', "process.stdout.write('ready\\n');setInterval(() => {}, 1000)"],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
    t.after(() => kill(-child.pid));
    await line(child.stdout);
    const tree = ownProcessTree(child, { label: 'graceful', graceMs: 500 });
    const first = tree.stop();
    assert.strictEqual(tree.stop(), first);
    const receipt = await first;
    assert.equal(receipt.verified, true);
    assert.ok(receipt.signals.every((event) => event.signal === 'SIGTERM'));
  }
);

it(
  'recovers an unsampled detached descendant after its marked producer exits',
  { skip: process.platform !== 'linux', timeout: 12_000 },
  async (t) => {
    const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: true,
      stdio: 'ignore',
    });
    t.after(() => unrelated.kill('SIGKILL'));
    const producer = `const { spawn } = require('node:child_process');
process.send({ ready: true });
process.on('message', () => {
  const leaf = spawn(process.execPath, ['-e', ${JSON.stringify(leafSource)}], {
    detached: true, stdio: 'ignore'
  });
  leaf.unref();
  process.send({ leaf: leaf.pid }, () => process.exit(0));
});`;
    const child = spawnOwnedProcess(process.execPath, ['-e', producer], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const tree = ownProcessTree(child, {
      label: 'unsampled-detached',
      graceMs: 150,
      killWaitMs: 1_000,
      // The descendant must be discovered after reparenting, without a sample
      // that observes its ancestry while the producer is still running.
      sampleMs: 60_000,
    });
    let leaf = null;
    let leafIdentity = null;
    child.on('message', (message) => {
      if (Number.isSafeInteger(message.leaf)) {
        leaf = message.leaf;
        leafIdentity = processFact(leaf);
      }
    });
    t.after(async () => {
      await tree.stop();
      const current = leaf && processFact(leaf);
      if (current && current.started === leafIdentity?.started) kill(leaf);
      child.kill('SIGKILL');
    });
    await once(child, 'message');
    assert.ok((await tree.capture()).some((row) => row.pid === child.pid));
    const report = once(child, 'message');
    const exited = once(child, 'exit');
    child.send('spawn');
    await report;
    await exited;
    assert.equal(await live(leaf), true, 'The unsampled survivor must exist before cleanup');
    const receipt = await tree.stop();
    assert.equal(receipt.verified, true);
    assert.equal(await live(leaf), false);
    assert.equal(await live(unrelated.pid), true);
    assert.ok(receipt.observedPids.includes(leaf));
    assert.ok(receipt.signals.some((event) => event.target === leaf));
    assert.ok(receipt.signals.every((event) => Math.abs(event.target) !== unrelated.pid));
  }
);

it(
  'fails closed when the real spawned producer removes its inherited ownership marker',
  { skip: process.platform !== 'linux', timeout: 12_000 },
  async (t) => {
    const child = spawnOwnedProcess(
      '/usr/bin/env',
      [
        '-u',
        'PROTO_UI_RUNTIME_PROCESS_OWNER',
        process.execPath,
        '-e',
        "process.stdout.write('ready\\n');setInterval(() => {}, 1000)",
      ],
      { detached: true, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    let tree;
    let identity;
    t.after(async () => {
      await tree?.stop();
      const current = processFact(child.pid);
      if (current && current.started === identity?.started) child.kill('SIGKILL');
    });
    await line(child.stdout);
    identity = processFact(child.pid);
    assert.ok(identity);
    tree = ownProcessTree(child, {
      label: 'marker-removed',
      graceMs: 150,
      killWaitMs: 1_000,
    });
    assert.deepEqual(await tree.capture(), []);
    const receipt = await tree.stop();
    assert.equal(receipt.verified, false);
    assert.ok(
      receipt.errors.some((message) =>
        message.includes('Live producer has no verified Linux ownership identity')
      )
    );
    assert.deepEqual(receipt.signals, []);
    assert.equal(
      await live(child.pid),
      true,
      'An unverified live producer must not receive a signal'
    );
    assert.equal(processFact(child.pid)?.started, identity.started);
  }
);

for (const [interruption, expectedCode] of [
  ['SIGTERM', 143],
  ['SIGHUP', 129],
])
  it(
    `the actual runner cleans Vitest and descendants when only the wrapper receives ${interruption}`,
    options,
    async (t) => {
      const temporary = mkdtempSync(path.join(tmpdir(), 'proto-runtime-owner-'));
      t.after(() => rmSync(temporary, { recursive: true, force: true }));
      cpSync(new URL('.', import.meta.url), path.join(temporary, 'scripts/test'), {
        recursive: true,
      });
      mkdirSync(path.join(temporary, 'node_modules/vitest'), { recursive: true });
      // The real runner and helpers execute unchanged; only the external Vitest
      // executable is a controlled producer of real OS processes in this fixture.
      writeFileSync(
        path.join(temporary, 'node_modules/vitest/vitest.mjs'),
        `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);\n${producerSource()}`
      );
      const env = { ...process.env };
      delete env.PROTO_UI_RUNTIME_PHASE;
      delete env.PROTO_UI_RUNTIME_SHARD;
      const runner = spawn(
        process.execPath,
        ['scripts/test/run-runtime-tests.mjs', 'probe.test.ts'],
        {
          cwd: temporary,
          env,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      t.after(() => kill(-runner.pid));
      let stderr = '';
      runner.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      const { producer, leaf } = JSON.parse(await line(runner.stdout));
      t.after(() => {
        kill(producer);
        kill(leaf);
      });
      const exited = once(runner, 'exit');
      runner.kill(interruption);
      const [code, signal] = await exited;
      assert.equal(signal, null);
      assert.equal(code, expectedCode);
      assert.equal(await live(producer), false);
      assert.equal(await live(leaf), false);
      assert.match(stderr, /"label":"vitest"/);
      assert.match(stderr, /"signal":"SIGKILL"/);
      assert.match(stderr, /"verified":true/);
    }
  );

it('never reacquires a vanished group when its numeric PGID is reused', options, async (t) => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'proto-runtime-reused-group-'));
  const table = path.join(temporary, 'table');
  writeFileSync(path.join(temporary, 'ps'), '#!/bin/sh\n/bin/cat "$PUI_PROCESS_TABLE"\n');
  chmodSync(path.join(temporary, 'ps'), 0o755);
  const originalPath = process.env.PATH;
  const originalTable = process.env.PUI_PROCESS_TABLE;
  process.env.PATH = `${temporary}:${originalPath}`;
  process.env.PUI_PROCESS_TABLE = table;
  // No signal reaches the OS in this controlled PID-reuse probe. Real reuse
  // cannot be forced portably without risking an unrelated live process.
  const signals = [];
  t.mock.method(process, 'kill', (target, signal) => {
    signals.push({ target, signal });
  });
  let tree;
  try {
    writeFileSync(table, '700001 700000 700001 S 100 Tue Nov 24 10:00:00 2026 original-root\n');
    tree = ownProcessTree(
      { pid: 700001, exitCode: null, signalCode: null },
      {
        label: 'reused-group',
        sampleMs: 60_000,
        graceMs: 10,
        killWaitMs: 10,
      }
    );
    assert.equal((await tree.capture()).length, 1);
    writeFileSync(table, '');
    assert.deepEqual(await tree.capture(), []);
    writeFileSync(
      table,
      '700001 1 700001 S 100 Tue Nov 24 10:10:00 2026 unrelated-root\n' +
        '700002 700001 700001 S 100 Tue Nov 24 10:10:01 2026 unrelated-child\n'
    );
    assert.deepEqual(await tree.capture(), []);
    const receipt = await tree.stop();
    assert.equal(receipt.verified, true);
    assert.deepEqual(signals, []);
    assert.deepEqual(receipt.signals, []);
  } finally {
    await tree?.stop();
    process.env.PATH = originalPath;
    if (originalTable === undefined) delete process.env.PUI_PROCESS_TABLE;
    else process.env.PUI_PROCESS_TABLE = originalTable;
    rmSync(temporary, { recursive: true, force: true });
  }
});

it(
  'drains Vitest output and its final receipt before a wrapper-only signal exit',
  { skip: process.platform !== 'linux', timeout: 12_000 },
  async (t) => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'proto-runtime-signal-drain-'));
    cpSync(new URL('.', import.meta.url), path.join(temporary, 'scripts/test'), {
      recursive: true,
    });
    mkdirSync(path.join(temporary, 'node_modules/vitest'), { recursive: true });
    const payloadBytes = 4 * 1024 * 1024;
    const readyPath = path.join(temporary, 'producer-ready.json');
    const completePath = path.join(temporary, 'producer-output-complete.json');
    writeFileSync(
      path.join(temporary, 'node_modules/vitest/vitest.mjs'),
      `import { writeFileSync } from 'node:fs';
let finishing = false;
process.on('SIGTERM', () => {
  if (finishing) return;
  finishing = true;
  process.stdout.write(Buffer.alloc(${payloadBytes}, 65), () => {
    writeFileSync(process.env.PUI_DRAIN_COMPLETE, JSON.stringify({ pid: process.pid }));
    process.exit(0);
  });
});
writeFileSync(process.env.PUI_DRAIN_READY, JSON.stringify({ pid: process.pid }));
setInterval(() => {}, 1000);`
    );
    const env = { ...process.env, PUI_DRAIN_READY: readyPath, PUI_DRAIN_COMPLETE: completePath };
    delete env.PROTO_UI_RUNTIME_PHASE;
    delete env.PROTO_UI_RUNTIME_SHARD;
    delete env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
    const runner = spawn(
      process.execPath,
      ['scripts/test/run-runtime-tests.mjs', 'probe.test.ts'],
      {
        cwd: temporary,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    const runnerIdentity = processFact(runner.pid);
    let producerIdentity;
    let readerTimer;
    let deadlineTimer;
    let receivedBytes = 0;
    let stderr = '';
    const receivedHash = createHash('sha256');
    runner.stdout.on('data', (chunk) => {
      receivedBytes += chunk.length;
      receivedHash.update(chunk);
    });
    runner.stdout.pause();
    runner.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const exited = once(runner, 'exit');
    const closed = once(runner, 'close');
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    t.after(async () => {
      clearTimeout(readerTimer);
      clearTimeout(deadlineTimer);
      runner.stdout.resume();
      for (const saved of [producerIdentity, runnerIdentity]) {
        const current = saved && processFact(saved.pid);
        if (current && current.started === saved.started && !['Z', 'X'].includes(current.state))
          kill(saved.pid);
      }
      await Promise.race([closed, pause(1_000)]);
      const survivors = [producerIdentity, runnerIdentity].filter((saved) => {
        const current = saved && processFact(saved.pid);
        return current && current.started === saved.started && !['Z', 'X'].includes(current.state);
      });
      rmSync(temporary, { recursive: true, force: true });
      assert.deepEqual(survivors, [], 'Fixture cleanup must leave no owned live process');
    });
    const readyDeadline = Date.now() + 4_000;
    while (!existsSync(readyPath) && Date.now() < readyDeadline && runner.exitCode === null)
      await pause(10);
    assert.ok(existsSync(readyPath), `Producer did not become ready: ${stderr}`);
    producerIdentity = processFact(JSON.parse(readFileSync(readyPath, 'utf8')).pid);
    assert.ok(producerIdentity);
    runner.kill('SIGTERM');
    readerTimer = setTimeout(() => runner.stdout.resume(), 500);
    const [[code, signal]] = await Promise.race([
      Promise.all([exited, closed]),
      new Promise((_, reject) => {
        deadlineTimer = setTimeout(
          () => reject(new Error('Signal drain exceeded its test bound')),
          10_000
        );
      }),
    ]);
    assert.equal(signal, null);
    assert.equal(code, 143);
    assert.equal(existsSync(completePath), true, 'The producer must have completed its write');
    assert.equal(receivedBytes, payloadBytes);
    assert.equal(
      receivedHash.digest('hex'),
      createHash('sha256').update(Buffer.alloc(payloadBytes, 65)).digest('hex')
    );
    const receipt = stderr
      .split('\n')
      .filter((row) => row.startsWith('[test:runtime] process cleanup '))
      .map((row) => JSON.parse(row.slice('[test:runtime] process cleanup '.length)))
      .at(-1);
    assert.equal(receipt?.childExitObserved, true);
    assert.equal(receipt.outputDrain.childPipesClosed, true);
    assert.equal(receipt.outputDrain.forwardedOutputDrained, true);
    assert.equal(receipt.verified, true);
  }
);

it(
  'the actual runner fails within its drain bound when observation fails and a descendant holds pipes',
  options,
  async (t) => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'proto-runtime-observer-failure-'));
    t.after(() => rmSync(temporary, { recursive: true, force: true }));
    cpSync(new URL('.', import.meta.url), path.join(temporary, 'scripts/test'), {
      recursive: true,
    });
    mkdirSync(path.join(temporary, 'node_modules/vitest'), { recursive: true });
    mkdirSync(path.join(temporary, 'bin'));
    writeFileSync(
      path.join(temporary, 'bin/ps'),
      '#!/bin/sh\necho controlled-observation-failure >&2\nexit 1\n'
    );
    chmodSync(path.join(temporary, 'bin/ps'), 0o755);
    writeFileSync(
      path.join(temporary, 'node_modules/vitest/vitest.mjs'),
      `import { spawn } from 'node:child_process';
const leaf = spawn(process.execPath, ['-e', ${JSON.stringify(leafSource)}], {
  stdio: ['ignore', 'inherit', 'inherit']
});
setTimeout(() => process.exit(0), 150);\n`
    );
    const env = { ...process.env, PATH: `${temporary}/bin:${process.env.PATH}` };
    delete env.PROTO_UI_RUNTIME_PHASE;
    delete env.PROTO_UI_RUNTIME_SHARD;
    const runner = spawn(
      process.execPath,
      ['scripts/test/run-runtime-tests.mjs', 'probe.test.ts'],
      {
        cwd: temporary,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    t.after(() => kill(-runner.pid));
    let stderr = '';
    runner.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const { leaf } = JSON.parse(await line(runner.stdout));
    t.after(() => kill(leaf));
    const [code, signal] = await once(runner, 'exit');
    assert.equal(signal, null);
    assert.equal(code, 1);
    assert.equal(
      await live(leaf),
      true,
      'Unknown ownership must never authorize killing the descendant'
    );
    const receipt = stderr
      .split('\n')
      .filter((row) => row.startsWith('[test:runtime] process cleanup '))
      .map((row) => JSON.parse(row.slice('[test:runtime] process cleanup '.length)))
      .at(-1);
    assert.equal(receipt.verified, false);
    assert.equal(receipt.childExitCode, 0, stderr);
    assert.equal(receipt.outputDrain.childPipesClosed, false);
    assert.deepEqual(receipt.signals, []);
    assert.ok(receipt.errors.some((error) => error.includes('controlled-observation-failure')));
    assert.ok(receipt.errors.some((error) => error.includes('output did not drain')));
  }
);
