import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createMobileCaptureOwner } from './mobile-capture-owner.mjs';
import { runOwnedMobileCapture } from './run-mobile-interaction-evidence.mjs';

test('a failure during acquisition still closes both resources and retains the original error first', async () => {
  const events = [];
  const first = new Error('launch failed');
  const cleanup = new Error('close failed');
  const owner = createMobileCaptureOwner({
    signals: new EventEmitter(),
    closeBrowser: () => {
      events.push('browser');
      throw cleanup;
    },
    stopServer: () => events.push('server'),
    save: () => events.push('saved'),
  });
  await assert.rejects(
    owner.run(async () => {
      throw first;
    }),
    (error) => {
      assert.deepEqual(error.errors, [first, cleanup]);
      return true;
    }
  );
  assert.deepEqual(events, ['browser', 'server', 'saved']);
});

test('thrown undefined is still an original failure and cannot turn into success', async () => {
  const owner = createMobileCaptureOwner({
    signals: new EventEmitter(),
    closeBrowser() {},
    stopServer() {},
    save() {},
  });
  let rejected = false;
  await owner
    .run(() => {
      throw undefined;
    })
    .then(
      () => {},
      (error) => {
        rejected = true;
        assert.equal(error, undefined);
      }
    );
  assert.equal(rejected, true);
});

test('cancellation before acquisition is sticky and starts no capture work', async () => {
  const signals = new EventEmitter();
  const events = [];
  const owner = createMobileCaptureOwner({
    signals,
    setExitCode: (value) => events.push(value),
    closeBrowser: () => events.push('browser'),
    stopServer: () => events.push('server'),
    save: () => events.push('saved'),
  });
  signals.emit('SIGTERM');
  await assert.rejects(
    owner.run(() => {
      events.push('work');
    }),
    /interrupted by SIGTERM/
  );
  assert.equal(events.includes('work'), false);
  assert.equal(events[0], 143);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('an in-flight acquisition is closed after cancellation and cannot enter the next cell', async () => {
  const signals = new EventEmitter();
  let browser;
  const events = [];
  const owner = createMobileCaptureOwner({
    signals,
    setExitCode() {},
    closeBrowser: () => browser?.close(),
    stopServer: () => events.push('server'),
    save() {},
  });
  await assert.rejects(
    owner.run(async () => {
      signals.emit('SIGTERM');
      await Promise.resolve();
      browser = { close: () => events.push('late-browser-closed') };
      owner.checkpoint();
      events.push('next-cell');
    }),
    /interrupted by SIGTERM/
  );
  assert.equal(events.includes('next-cell'), false);
  assert.equal(events.includes('late-browser-closed'), true);
});

test('cancellation during the final close waits for its own pending cleanup', async () => {
  const signals = new EventEmitter();
  let releaseFirst;
  let releaseInterrupted;
  let firstStarted;
  let closes = 0;
  const started = new Promise((resolve) => {
    firstStarted = resolve;
  });
  const first = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const interrupted = new Promise((resolve) => {
    releaseInterrupted = resolve;
  });
  const owner = createMobileCaptureOwner({
    signals,
    setExitCode() {},
    closeBrowser() {
      if (++closes === 1) {
        firstStarted();
        return first;
      }
      return interrupted;
    },
    stopServer() {},
    save() {},
  });
  let outcome = 'pending';
  const running = owner
    .run(async () => {})
    .then(
      () => {
        outcome = 'passed';
      },
      () => {
        outcome = 'failed';
      }
    );
  await started;
  signals.emit('SIGTERM');
  await Promise.resolve();
  releaseFirst();
  await delay(20);
  const beforeInterruptedCleanup = outcome;
  releaseInterrupted();
  await running;
  assert.equal(beforeInterruptedCleanup, 'pending');
  assert.equal(closes, 2);
  assert.equal(outcome, 'failed');
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test(
  'real owned TERM retires a pending capture and forbids later cells or a success write',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const out = await mkdtemp(path.join(os.tmpdir(), 'mobile-cancel-'));
    t.after(() => rm(out, { recursive: true, force: true }));
    const child = path.join(out, 'capture.mjs');
    const stages = path.join(out, 'stages.txt');
    await writeFile(
      child,
      `import { appendFileSync } from 'node:fs';
import { createMobileCaptureOwner } from ${JSON.stringify(new URL('./mobile-capture-owner.mjs', import.meta.url).href)};
let release;
const waiting = new Promise(resolve => { release = resolve; });
const keepAlive = setInterval(() => {}, 1000);
const owner = createMobileCaptureOwner({ closeBrowser: () => release(), stopServer: () => {}, record: signal => appendFileSync(${JSON.stringify(stages)}, 'signal:' + signal + '\\n'), save: () => { clearInterval(keepAlive); appendFileSync(${JSON.stringify(stages)}, 'saved\\n'); } });
await owner.run(async () => {
  appendFileSync(${JSON.stringify(stages)}, 'cell-one-pending\\n');
  await waiting;
  owner.checkpoint();
  appendFileSync(${JSON.stringify(stages)}, 'cell-two\\n');
});
appendFileSync(${JSON.stringify(stages)}, 'success\\n');
`
    );
    const signals = new EventEmitter();
    const pending = runOwnedMobileCapture({
      command: process.execPath,
      args: [child],
      cwd: out,
      out,
      timeoutMs: 5000,
      signals,
    });
    const deadline = Date.now() + 3000;
    while (true) {
      if ((await readFile(stages, 'utf8').catch(() => '')).includes('cell-one-pending')) break;
      assert.ok(Date.now() < deadline, 'Fixture entered its pending cell');
      await delay(10);
    }
    signals.emit('SIGTERM');
    const result = await pending;
    assert.equal(result.interrupted, 'SIGTERM');
    assert.equal(result.status, 'failed');
    assert.equal(result.retirement.verified, true);
    assert.deepEqual(result.retirement.remaining, []);
    assert.match(await readFile(stages, 'utf8'), /signal:SIGTERM/);
    assert.doesNotMatch(await readFile(stages, 'utf8'), /cell-two|success/);
  }
);

test(
  'deadline remains failed when an exited leader leaves a detached late writer',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const out = await mkdtemp(path.join(os.tmpdir(), 'mobile-late-writer-'));
    t.after(() => rm(out, { recursive: true, force: true }));
    const writes = path.join(out, 'writes.txt');
    const program = `const {spawn}=require('node:child_process');
spawn(process.execPath,['-e',${JSON.stringify(`const fs=require('node:fs');process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync(${JSON.stringify(writes)},'late\\n'),20);`)}],{detached:true,stdio:'ignore'});
process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`;
    const result = await runOwnedMobileCapture({
      command: process.execPath,
      args: ['-e', program],
      cwd: out,
      out,
      timeoutMs: 200,
    });
    assert.equal(result.interrupted, 'deadline');
    assert.equal(result.status, 'failed');
    assert.equal(result.retirement.verified, true);
    assert.deepEqual(result.retirement.remaining, []);
    const sealed = await readFile(writes, 'utf8');
    await delay(100);
    assert.equal(await readFile(writes, 'utf8'), sealed);
    assert.equal(
      JSON.parse(await readFile(path.join(out, 'process-owner.json'), 'utf8')).status,
      'failed'
    );
  }
);
