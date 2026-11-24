import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { ownProcessTree, readProcessTable } from './runtime-process-tree.mjs';

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
  for await (const chunk of stream) {
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
  'the actual runner cleans Vitest and descendants when only the wrapper receives TERM',
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
    runner.kill('SIGTERM');
    const [code, signal] = await exited;
    assert.equal(signal, null);
    assert.equal(code, 143);
    assert.equal(await live(producer), false);
    assert.equal(await live(leaf), false);
    assert.match(stderr, /"label":"vitest"/);
    assert.match(stderr, /"signal":"SIGKILL"/);
    assert.match(stderr, /"verified":true/);
  }
);
