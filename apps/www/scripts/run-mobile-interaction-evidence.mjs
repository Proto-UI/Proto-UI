import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ownProcessTree, spawnOwnedProcess } from '../../../scripts/test/runtime-process-tree.mjs';

export async function runOwnedMobileCapture({
  command,
  args,
  cwd,
  out,
  timeoutMs,
  signals = process,
}) {
  await mkdir(out, { recursive: true });
  let interrupted = null;
  let cancel;
  const cancelled = new Promise((resolve) => {
    cancel = resolve;
  });
  const interrupt = (reason) => {
    if (interrupted) return;
    interrupted = reason;
    cancel();
  };
  const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [
    signal,
    () => interrupt(signal),
  ]);
  for (const [signal, handler] of handlers) signals.on(signal, handler);
  const startedAt = new Date().toISOString();
  const child = spawnOwnedProcess(command, args, {
    cwd,
    detached: process.platform !== 'win32',
    stdio: 'inherit',
  });
  const owner = ownProcessTree(child, { label: 'mobile-interaction-capture' });
  const exited = new Promise((resolve) => {
    child.once('error', (error) => resolve({ code: null, signal: null, error: String(error) }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const timer = setTimeout(() => interrupt('deadline'), timeoutMs);
  let exit;
  let retirement;
  try {
    exit = await Promise.race([exited, cancelled]);
  } finally {
    clearTimeout(timer);
    try {
      retirement = await owner.stop();
    } finally {
      for (const [signal, handler] of handlers) signals.off(signal, handler);
    }
  }
  if (!exit) {
    let drainTimer;
    try {
      exit = await Promise.race([
        exited,
        new Promise((resolve) => {
          drainTimer = setTimeout(
            () =>
              resolve({
                code: null,
                signal: null,
                error: 'Capture exit receipt did not arrive after retirement',
              }),
            2_000
          );
        }),
      ]);
    } finally {
      clearTimeout(drainTimer);
    }
  }
  const passed = !interrupted && exit.code === 0 && exit.signal === null && retirement.verified;
  const receipt = {
    startedAt,
    completedAt: new Date().toISOString(),
    timeoutMs,
    interrupted,
    exit,
    retirement,
    status: passed ? 'passed' : 'failed',
  };
  // Only publish the owner receipt after all known writers have retired. A late
  // child snapshot never changes the failed deadline/cancellation verdict.
  await writeFile(path.join(out, 'process-owner.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: 'string' },
      'revision-kind': { type: 'string' },
      'expected-revision': { type: 'string' },
      'quick-preview': { type: 'boolean', default: false },
      'prepared-inputs': { type: 'string' },
    },
  });
  assert.ok(values.out);
  const receipt = await runOwnedMobileCapture({
    command: process.execPath,
    args: [
      '--import',
      'tsx',
      fileURLToPath(new URL('./capture-mobile-interaction-evidence.ts', import.meta.url)),
      ...argv,
    ],
    cwd: process.cwd(),
    out: path.resolve(values.out),
    timeoutMs: values['quick-preview'] ? 120_000 : 360_000,
  });
  process.exitCode =
    receipt.status === 'passed'
      ? 0
      : receipt.interrupted === 'SIGINT'
        ? 130
        : receipt.interrupted === 'SIGTERM'
          ? 143
          : 1;
}
