// Starts one apps-www dev server, hands its URL to vitest through
// PROTO_UI_BROWSER_BASE_URL, and tears it down afterwards.
//
// The browser suites can each spawn their own server, which is what makes them
// usable on their own. Run together they share `apps/www/.astro`, and two Astro
// content stores writing `data-store.json.tmp` race on the rename, so one dev
// server exits and its suite fails. One server for the whole run removes that.

import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corepackInvocation, createRuntimeTestPlan, READY_ROUTES } from './runtime-test-plan.mjs';
import {
  runtimeSelection,
  assertVitestReport,
  assertRuntimeSource,
  writeJson,
  ciContext,
} from './runtime-ci.mjs';
import { waitForServerReadiness } from './server-readiness.mjs';
import { createRuntimeProcessOwner } from './runtime-process-owner.mjs';
import {
  readOptionalJson,
  runtimeObservation,
  runtimeSourceSnapshot,
} from './runtime-observation.mjs';
import {
  observeReadinessFailures,
  observeRuntimeServer,
  runtimeServerSnapshot,
} from './runtime-server-diagnostics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Astro dev compiles a route on first request, so a suite probing a cold route
// can exceed its own hook timeout and fall back to spawning its own server.
// Warm every route the suites wait on.
const READY_TIMEOUT_MS = 180_000;
const processes = createRuntimeProcessOwner();
const spawn = processes.spawn;

const phase = process.env.PROTO_UI_RUNTIME_PHASE;
const shard = process.env.PROTO_UI_RUNTIME_SHARD;
const testPlan = createRuntimeTestPlan(process.argv.slice(2), { phase, shard });
const context = phase ? ciContext() : undefined;
const selection = phase ? runtimeSelection(phase, shard) : undefined;
if (selection && selection.checkoutSha !== context.checkoutSha)
  throw new Error('Runtime checkout changed during selection');
const evidenceDirectory = process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
if (selection && !evidenceDirectory)
  throw new Error('A CI runtime phase requires PROTO_UI_RUNTIME_EVIDENCE_DIR');
const evidenceId = selection
  ? `${phase}${shard ? `-${shard.replace('/', '-of-')}` : ''}`
  : undefined;
const reportPath = selection
  ? path.resolve(evidenceDirectory, `vitest-${evidenceId}.json`)
  : undefined;
const progressPath = selection
  ? path.resolve(evidenceDirectory, `progress-${evidenceId}.json`)
  : undefined;
const sourceBefore = selection ? runtimeSourceSnapshot(root) : undefined;
let terminalObservationWritten = false;
function recordObservation({ exitCode = null, signal = null, error = null } = {}) {
  if (!selection || terminalObservationWritten) return;
  const reportRead = readOptionalJson(reportPath);
  const progressRead = readOptionalJson(progressPath);
  const report = reportRead.value;
  const sourceAfter = runtimeSourceSnapshot(root);
  const observation = runtimeObservation({
    selection,
    root,
    report,
    progress: progressRead.value,
    sourceBefore,
    sourceAfter,
    exitCode,
    signal,
    error,
  });
  observation.parseErrors = { report: reportRead.error, checkpoint: progressRead.error };
  writeJson(path.join(evidenceDirectory, `observation-${evidenceId}.json`), observation);
  // Preserve completed red reports too. The unchanged strict gate still
  // rejects failures, skips, wrong inventory and incomplete producer outcomes.
  const source = { before: sourceBefore, after: sourceAfter };
  if (report)
    writeJson(path.join(evidenceDirectory, `result-${evidenceId}.json`), {
      ...selection,
      report,
      source,
    });
  terminalObservationWritten = true;
  assertRuntimeSource(source, selection);
}
if (selection) {
  // Clear only this invocation's result: stale evidence must never satisfy a rerun.
  rmSync(reportPath, { force: true });
  rmSync(progressPath, { force: true });
  rmSync(path.join(evidenceDirectory, `observation-${evidenceId}.json`), { force: true });
  rmSync(path.join(evidenceDirectory, `result-${evidenceId}.json`), { force: true });
  writeJson(path.join(evidenceDirectory, `selection-${evidenceId}.json`), selection);
  console.log(`[test:runtime] selection ${JSON.stringify(selection)}`);
}
let devServer = null;
let serverOutput = '';
let shuttingDown = false;
let interruptedSignal = null;
let styleGeneration = null;
const reportedSnapshots = new Set();

function reportServerSnapshot(reason) {
  if (!devServer || reportedSnapshots.has(reason)) return;
  reportedSnapshots.add(reason);
  console.error(runtimeServerSnapshot(devServer, reason, serverOutput));
}

function recordOutput(chunk) {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-20_000);
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Unable to reserve a port for the documentation dev server.'));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForServer(url) {
  await waitForServerReadiness(url, {
    timeoutMs: READY_TIMEOUT_MS,
    server: devServer,
    readOutput: () => serverOutput,
  });
}

async function generateProtoUiStyle() {
  styleGeneration ??= (async () => {
    const appsWwwRoot = path.join(root, 'apps', 'www');
    // The parent command requires Corepack on PATH. process.execPath may point
    // at an unrelated distro Node binary, so do not derive Corepack from it.
    const corepack = corepackInvocation();
    const child = spawn(corepack.executable, ['pnpm@10.32.1', 'run', 'generate:proto-ui-style'], {
      cwd: appsWwwRoot,
      env: process.env,
      shell: corepack.shell,
      stdio: 'inherit',
    });
    const closed = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    const [{ code, signal }] = await Promise.all([closed, processes.completed(child)]);
    if (signal) throw new Error(`Proto UI style generation exited on ${signal}.`);
    if (code !== 0) throw new Error(`Proto UI style generation exited with code ${code}.`);
  })();
  return styleGeneration;
}

async function startServer() {
  await generateProtoUiStyle();
  const port = await availablePort();
  const appsWwwRoot = path.join(root, 'apps', 'www');
  const astroCli = path.join(appsWwwRoot, 'node_modules', 'astro', 'astro.js');
  devServer = spawn(
    process.execPath,
    [astroCli, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: appsWwwRoot,
      detached: process.platform !== 'win32',
      shell: false,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  devServer.stdout?.on('data', recordOutput);
  devServer.stderr?.on('data', recordOutput);

  const url = `http://127.0.0.1:${port}`;
  for (const route of READY_ROUTES) await waitForServer(`${url}${route}`);
  observeRuntimeServer(devServer, {
    isShuttingDown: () => shuttingDown,
    readOutput: () => serverOutput,
    report: (message) => console.error(message),
  });
  return url;
}

// Every child belongs to this wrapper. A parent exit does not establish that
// its descendants stopped, and CI cancellation may signal only this PID.
async function stopChildren() {
  shuttingDown = true;
  await processes.stopAll();
}

async function runVitest(args, baseUrl) {
  // Windows cannot execute a `.cmd` shim through spawn() without a shell.
  // Invoke Vitest's ESM entry with the current Node executable instead so
  // forwarded test arguments remain an argv array on every platform.
  const vitestBin = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
  const env = {
    ...process.env,
    ...(baseUrl ? { PROTO_UI_BROWSER_BASE_URL: baseUrl } : {}),
    ...(selection
      ? {
          PROTO_UI_RUNTIME_ROOT: root,
          PROTO_UI_RUNTIME_PROGRESS_FILE: progressPath,
          PROTO_UI_RUNTIME_SELECTION_FILE: path.join(
            evidenceDirectory,
            `selection-${evidenceId}.json`
          ),
        }
      : {}),
  };
  const reportArgs = reportPath
    ? [
        '--reporter=default',
        '--reporter=json',
        '--reporter=./scripts/test/runtime-progress-reporter.mjs',
        `--outputFile=${reportPath}`,
      ]
    : [];
  const child = spawn(process.execPath, [vitestBin, 'run', ...args, ...reportArgs], {
    cwd: root,
    env,
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ exitCode: code, signal }));
  });
  const inspect = observeReadinessFailures(() =>
    reportServerSnapshot('browser readiness failed while the server wrapper may still be running')
  );
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    inspect(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    inspect(chunk);
  });
  try {
    const [termination] = await Promise.all([closed, processes.completed(child)]);
    if (termination.signal || termination.exitCode !== 0)
      reportServerSnapshot(
        `Vitest exited: code=${termination.exitCode}; signal=${termination.signal}`
      );
    return termination;
  } catch (error) {
    // A cleanup failure gives no EOF guarantee. Close our read handles and
    // retain the bytes already forwarded instead of hanging behind an orphan.
    child.stdout.destroy();
    child.stderr.destroy();
    throw error;
  } finally {
    await flushOutput();
  }
}

function flushOutput() {
  return Promise.all([
    new Promise((done) => process.stdout.write('', done)),
    new Promise((done) => process.stderr.write('', done)),
  ]);
}

const signalExitCode = (signal) => ({ SIGHUP: 129, SIGINT: 130, SIGTERM: 143 })[signal];
function reportCleanupError(error) {
  console.error(`[test:runtime] ${error.message}`);
  for (const cause of error.errors ?? []) reportCleanupError(cause);
}

// Do not assume shell/runner signal forwarding. Stop Vitest, preparation,
// Astro and their owned descendants even when only this wrapper is signalled.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (interruptedSignal) return;
    interruptedSignal = signal;
    reportServerSnapshot(`runner received ${signal}`);
    try {
      recordObservation({ signal });
    } catch (error) {
      console.error(`[test:runtime] interrupted evidence: ${error.message}`);
    }
    void stopChildren()
      .catch(reportCleanupError)
      .finally(async () => {
        await flushOutput();
        process.exit(signalExitCode(signal));
      });
  });
}

let exitCode = 0;
try {
  for (const phase of testPlan) {
    const baseUrl = phase.needsServer ? await startServer() : undefined;
    if (baseUrl) {
      console.log(`[test:runtime] sharing ${baseUrl} across the browser suites`);
    }
    const termination = await runVitest(phase.args, baseUrl);
    exitCode = termination.signal ? 1 : (termination.exitCode ?? 1);
    recordObservation(termination);
    if (exitCode !== 0) break;
    if (selection) {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      assertVitestReport(report, selection);
    }
  }
} catch (error) {
  console.error(`[test:runtime] ${error instanceof Error ? error.message : String(error)}`);
  reportServerSnapshot('runtime test runner failed');
  exitCode = 1;
  try {
    recordObservation({ exitCode, error: error instanceof Error ? error.message : String(error) });
  } catch (evidenceError) {
    console.error(`[test:runtime] evidence error: ${evidenceError.message}`);
  }
} finally {
  try {
    await stopChildren();
  } catch (error) {
    reportCleanupError(error);
    exitCode = 1;
  }
}
await flushOutput();
process.exit(interruptedSignal ? signalExitCode(interruptedSignal) : exitCode);
