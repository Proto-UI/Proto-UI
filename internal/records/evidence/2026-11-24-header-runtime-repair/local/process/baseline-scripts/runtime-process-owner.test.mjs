import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createRuntimeProcessOwner } from './runtime-process-owner.mjs';
import { liveOwned, observeChildren, processFact } from './linux-process-ownership.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const linux = { skip: process.platform !== 'linux', timeout: 15_000 };
async function until(check, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await delay(20);
  }
}
function running(pid) {
  const fact = processFact(pid);
  return fact && !['Z', 'X'].includes(fact.state);
}
function killIfRunning(pid) {
  if (running(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
function temporary(t) {
  const folder = mkdtempSync(path.join(tmpdir(), 'pui-runtime-owner-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}
function childExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

test(
  'termination owns detached descendants and leaves an unrelated process alive',
  linux,
  async (t) => {
    const folder = temporary(t);
    const pidFile = path.join(folder, 'worker.json');
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    t.after(() => killIfRunning(sentinel.pid));
    const owner = createRuntimeProcessOwner({ graceMs: 100, killMs: 1000 });
    t.after(() => owner.stopAll());
    const worker = `process.on('SIGTERM', () => {});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},JSON.stringify({pid:process.pid}));setInterval(() => {}, 1000);`;
    const child = owner.spawn(
      process.execPath,
      [
        '-e',
        `const child=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(worker)}],{detached:true,stdio:'ignore'});child.unref();setInterval(() => {},1000);`,
      ],
      { stdio: 'ignore' }
    );
    t.after(() => killIfRunning(child.pid));
    await until(() => existsSync(pidFile), 'detached worker starts');
    const workerPid = JSON.parse(readFileSync(pidFile)).pid;
    t.after(() => killIfRunning(workerPid));
    const stopping = owner.stopAll();
    assert.equal(owner.stopAll(), stopping, 'Concurrent termination shares one operation');
    assert.throws(() => owner.spawn(process.execPath, []), /shutting down/);
    await stopping;
    assert.ok(!running(child.pid));
    assert.ok(!running(workerPid), 'SIGTERM-resistant detached worker must be killed');
    assert.ok(running(sentinel.pid), 'No process outside this invocation may be killed');
  }
);

test('an exited parent does not retire its live descendant ownership', linux, async (t) => {
  const folder = temporary(t);
  const pidFile = path.join(folder, 'worker.json');
  const owner = createRuntimeProcessOwner({ graceMs: 100, killMs: 1000 });
  t.after(() => owner.stopAll());
  const worker = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},JSON.stringify({pid:process.pid}));setInterval(() => {},1000);`;
  const child = owner.spawn(
    process.execPath,
    [
      '-e',
      `const fs=require('node:fs');const child=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(worker)}],{detached:true,stdio:'ignore'});child.unref();const timer=setInterval(() => {if(fs.existsSync(${JSON.stringify(pidFile)})){clearInterval(timer);process.exit(7)}},10);`,
    ],
    { stdio: 'ignore' }
  );
  t.after(() => killIfRunning(child.pid));
  const outcome = await childExit(child);
  const workerPid = JSON.parse(readFileSync(pidFile)).pid;
  t.after(() => killIfRunning(workerPid));
  assert.equal(outcome.code, 7, 'Retain the command failure');
  await owner.stopAll();
  assert.ok(!running(workerPid));
});

test('Linux ownership rejects a reused PID with a different start time', linux, () => {
  const fact = processFact(process.pid);
  assert.equal(liveOwned(new Map([[fact.pid, fact]])).length, 1);
  assert.deepEqual(liveOwned(new Map([[fact.pid, { ...fact, started: 'not-this-process' }]])), []);
});

test(
  'first observation cannot claim an unrelated leader PID without its exact marker',
  linux,
  async (t) => {
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {},1000)'], {
      stdio: 'ignore',
    });
    t.after(() => killIfRunning(sentinel.pid));
    const owned = new Map();
    observeChildren(sentinel.pid, owned, {
      uid: process.geteuid(),
      started: null,
      unmarked: new Set(),
      match: Buffer.from(`\0PROTO_UI_RUNTIME_PROCESS_OWNER=${randomUUID()}\0`),
    });
    assert.deepEqual([...owned.values()], [], 'A numeric PID is not an ownership receipt');
    assert.ok(running(sentinel.pid));
  }
);

test('a signalling failure cannot be reported as successful cleanup', linux, async (t) => {
  const folder = temporary(t);
  const ready = path.join(folder, 'ready');
  const owner = createRuntimeProcessOwner({
    kill() {
      throw Object.assign(new Error('fixture permission denied'), { code: 'EPERM' });
    },
  });
  const child = owner.spawn(
    process.execPath,
    [
      '-e',
      `require('node:fs').writeFileSync(${JSON.stringify(ready)},'ready');setInterval(() => {},1000);`,
    ],
    { stdio: 'ignore' }
  );
  t.after(() => killIfRunning(child.pid));
  await until(() => existsSync(ready), 'owned child starts');
  await assert.rejects(
    owner.stopAll(),
    (error) => error instanceof AggregateError && error.errors[0].code === 'EPERM'
  );
});

test('a spawn error leaves a stoppable owner and preserves the original error', async () => {
  const owner = createRuntimeProcessOwner();
  const child = owner.spawn(path.join(tmpdir(), 'pui-runtime-command-that-does-not-exist'), [], {
    stdio: 'ignore',
  });
  await assert.rejects(childExit(child), { code: 'ENOENT' });
  await owner.stopAll();
});

test('Windows cancellation scopes hidden taskkill to the owned PID and its tree', async () => {
  const calls = [];
  const command = Object.assign(new EventEmitter(), {
    pid: 12345,
    exitCode: null,
    signalCode: null,
  });
  const owner = createRuntimeProcessOwner({
    platform: 'win32',
    spawn(executable, args, options) {
      calls.push({ executable, args, options });
      if (executable !== 'taskkill') return command;
      const killer = new EventEmitter();
      queueMicrotask(() => {
        command.exitCode = 1;
        command.emit('exit', 1, null);
        killer.emit('exit', 0);
      });
      return killer;
    },
  });
  owner.spawn('node.exe', ['vitest.mjs', 'run'], { shell: false });
  await owner.stopAll();
  assert.equal(calls[0].options.detached, false);
  assert.equal(calls[0].options.windowsHide, true);
  assert.equal(calls[1].executable, 'taskkill');
  assert.deepEqual(calls[1].args, ['/PID', '12345', '/T', '/F']);
  assert.equal(calls[1].options.windowsHide, true);
  assert.equal(calls[1].options.shell, false);
});

// Exercise the unmodified executable wrapper with tiny controlled commands.
// Planning/CI are inert fixtures; no actual browser acceptance is claimed.
function runnerFixture(t, mode) {
  // Keep PID receipts until after the cleanup hook: the failing-baseline
  // control also has to retire the very descendants it demonstrates leaking.
  const folder = mkdtempSync(path.join(tmpdir(), 'pui-runtime-wrapper-'));
  const scripts = path.join(folder, 'scripts/test');
  const www = path.join(folder, 'apps/www');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(path.join(www, 'node_modules/astro'), { recursive: true });
  mkdirSync(path.join(folder, 'node_modules/vitest'), { recursive: true });
  writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const file of [
    'run-runtime-tests.mjs',
    'runtime-process-owner.mjs',
    'linux-process-ownership.mjs',
    'runtime-server-diagnostics.mjs',
  ])
    copyFileSync(new URL(file, import.meta.url), path.join(scripts, file));
  writeFileSync(
    path.join(scripts, 'runtime-test-plan.mjs'),
    `
    export const READY_ROUTES = ['/'];
    export const corepackInvocation = () => ({ executable: process.env.FIXTURE_DIR + '/corepack.mjs', shell: false });
    export const createRuntimeTestPlan = () => [{ needsServer: ['style', 'readiness-failure', 'complete'].includes(process.env.FIXTURE_MODE), args: [] }];
  `
  );
  writeFileSync(
    path.join(scripts, 'runtime-ci.mjs'),
    `
    export const runtimeSelection = () => undefined;
    export const assertVitestReport = () => {};
    export const assertRuntimeSource = () => {};
    export const writeJson = () => {};
    export const ciContext = () => undefined;
  `
  );
  writeFileSync(
    path.join(scripts, 'runtime-observation.mjs'),
    `
    export const readOptionalJson = () => ({});
    export const runtimeObservation = () => ({});
    export const runtimeSourceSnapshot = () => ({});
  `
  );
  writeFileSync(
    path.join(scripts, 'server-readiness.mjs'),
    `
    import { existsSync } from 'node:fs';
    import path from 'node:path';
    export async function waitForServerReadiness() {
      while (!existsSync(path.join(process.env.FIXTURE_DIR, 'astro-worker.json'))) await new Promise(r => setTimeout(r, 10));
      if (process.env.FIXTURE_MODE === 'readiness-failure') throw new Error('fixture readiness deadline reached');
    }
  `
  );
  const program = (role) => `
    import { spawn } from 'node:child_process';
    import { existsSync, writeFileSync } from 'node:fs';
    import path from 'node:path';
    const role = ${JSON.stringify(role)};
    const directory = process.env.FIXTURE_DIR;
    writeFileSync(path.join(directory, role + '.json'), JSON.stringify({pid:process.pid}));
    if (role === 'style' && process.env.FIXTURE_MODE !== 'style') process.exit(0);
    const workerFile = path.join(directory, role + '-worker.json');
    const worker = spawn(process.execPath, ['-e', "require('node:fs').writeFileSync(" + JSON.stringify(workerFile) + ",JSON.stringify({pid:process.pid}));setInterval(()=>{},1000)"], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] });
    worker.unref();
    while (!existsSync(workerFile)) await new Promise(r => setTimeout(r, 10));
    if (role === 'vitest' && ['nonzero', 'complete'].includes(process.env.FIXTURE_MODE)) {
      console.log('fixture Vitest output retained');
      process.exit(process.env.FIXTURE_MODE === 'nonzero' ? 7 : 0);
    }
    setInterval(() => {}, 1000);
  `;
  const corepack = path.join(folder, 'corepack.mjs');
  writeFileSync(corepack, '#!/usr/bin/env node\n' + program('style'));
  chmodSync(corepack, 0o755);
  writeFileSync(path.join(www, 'node_modules/astro/astro.js'), program('astro'));
  writeFileSync(path.join(folder, 'node_modules/vitest/vitest.mjs'), program('vitest'));
  const env = {
    ...process.env,
    PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
    FIXTURE_MODE: mode,
    FIXTURE_DIR: folder,
  };
  for (const key of [
    'PROTO_UI_RUNTIME_PHASE',
    'PROTO_UI_RUNTIME_SHARD',
    'PROTO_UI_RUNTIME_EVIDENCE_DIR',
  ])
    delete env[key];
  const child = spawn(process.execPath, [path.join(scripts, 'run-runtime-tests.mjs')], {
    cwd: folder,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (bytes) => (output += bytes));
  child.stderr.on('data', (bytes) => (output += bytes));
  let result;
  const exited = childExit(child).then((value) => {
    result = value;
    return value;
  });
  const pids = () =>
    ['style', 'style-worker', 'astro', 'astro-worker', 'vitest', 'vitest-worker'].flatMap(
      (role) => {
        const file = path.join(folder, role + '.json');
        return existsSync(file) ? [JSON.parse(readFileSync(file)).pid] : [];
      }
    );
  t.after(async () => {
    killIfRunning(child.pid);
    for (const pid of pids()) killIfRunning(pid);
    await exited;
    rmSync(folder, { recursive: true, force: true });
  });
  return {
    child,
    pids,
    output: () => output,
    ready: (role) =>
      until(
        () => existsSync(path.join(folder, role + '-worker.json')),
        `${role} starts; output: ${output}`
      ),
    async result() {
      await until(() => result !== undefined, `wrapper must exit; output: ${output}`);
      return result;
    },
  };
}

for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
  ['SIGHUP', 129],
]) {
  test(
    `PID-only ${signal} stops Vitest and detached workers before the wrapper exits`,
    linux,
    async (t) => {
      const fixture = runnerFixture(t, 'signal');
      await fixture.ready('vitest');
      fixture.child.kill(signal);
      assert.deepEqual(await fixture.result(), { code, signal: null });
      assert.ok(
        fixture.pids().every((pid) => !running(pid)),
        'No live owned process survives cancellation'
      );
    }
  );
}

test('PID-only interruption cleans a pending style-generation command', linux, async (t) => {
  const fixture = runnerFixture(t, 'style');
  await fixture.ready('style');
  fixture.child.kill('SIGTERM');
  assert.deepEqual(await fixture.result(), { code: 143, signal: null });
  assert.ok(fixture.pids().every((pid) => !running(pid)));
});

test('a readiness failure cleans the Astro owner and its detached worker', linux, async (t) => {
  const fixture = runnerFixture(t, 'readiness-failure');
  assert.deepEqual(await fixture.result(), { code: 1, signal: null });
  assert.match(fixture.output(), /fixture readiness deadline reached/);
  assert.ok(fixture.pids().every((pid) => !running(pid)));
});

for (const [mode, code] of [
  ['nonzero', 7],
  ['complete', 0],
]) {
  test(
    `normal ${mode} exit closes inherited pipes and preserves the command outcome`,
    linux,
    async (t) => {
      const fixture = runnerFixture(t, mode);
      assert.deepEqual(await fixture.result(), { code, signal: null });
      assert.match(fixture.output(), /fixture Vitest output retained/);
      assert.ok(fixture.pids().every((pid) => !running(pid)));
    }
  );
}
