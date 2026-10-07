// Starts one apps-www dev server, hands its URL to vitest through
// PROTO_UI_BROWSER_BASE_URL, and tears it down afterwards.
//
// The browser suites can each spawn their own server, which is what makes them
// usable on their own. Run together they share `apps/www/.astro`, and two Astro
// content stores writing `data-store.json.tmp` race on the rename, so one dev
// server exits and its suite fails. One server for the whole run removes that.

import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corepackInvocation, createRuntimeTestPlan, READY_ROUTES } from './runtime-test-plan.mjs';
import { runtimeSelection, assertVitestReport, writeJson, ciContext } from './runtime-ci.mjs';
import { waitForServerReadiness } from './server-readiness.mjs';
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
if (selection) {
  // Clear only this invocation's result: stale evidence must never satisfy a rerun.
  rmSync(reportPath, { force: true });
  rmSync(path.join(evidenceDirectory, `result-${evidenceId}.json`), { force: true });
  writeJson(path.join(evidenceDirectory, `selection-${evidenceId}.json`), selection);
  console.log(`[test:runtime] selection ${JSON.stringify(selection)}`);
}
let devServer = null;
let serverOutput = '';
let shuttingDown = false;
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
  styleGeneration ??= new Promise((resolve, reject) => {
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
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Proto UI style generation exited on ${signal}.`));
      else if (code !== 0) reject(new Error(`Proto UI style generation exited with code ${code}.`));
      else resolve();
    });
  });
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

// The child is detached into its own process group, so signal the group to take
// the dev server's own children with it.
async function stopServer() {
  if (shuttingDown || !devServer || devServer.exitCode !== null || !devServer.pid) return;
  shuttingDown = true;
  const pid = devServer.pid;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
    return;
  }

  const target = -pid;
  try {
    process.kill(target, 'SIGTERM');
  } catch {
    return;
  }
  const exited = await Promise.race([
    new Promise((resolve) => devServer.once('exit', () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && devServer.exitCode === null) {
    try {
      process.kill(target, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

async function runVitest(args, baseUrl) {
  return new Promise((resolve, reject) => {
    // Windows cannot execute a `.cmd` shim through spawn() without a shell.
    // Invoke Vitest's ESM entry with the current Node executable instead so
    // forwarded test arguments remain an argv array on every platform.
    const vitestBin = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
    const env = baseUrl ? { ...process.env, PROTO_UI_BROWSER_BASE_URL: baseUrl } : process.env;
    const reportArgs = reportPath
      ? ['--reporter=default', '--reporter=json', `--outputFile=${reportPath}`]
      : [];
    const child = spawn(process.execPath, [vitestBin, 'run', ...args, ...reportArgs], {
      cwd: root,
      env,
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
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
    child.on('error', reject);
    child.on('close', async (code, signal) => {
      if (signal || code !== 0)
        reportServerSnapshot(`Vitest exited: code=${code}; signal=${signal}`);
      // Wait for both captured pipes and their forwarded writes before the
      // runner can exit, so its diagnostic tap cannot truncate Vitest output.
      await Promise.all([
        new Promise((done) => process.stdout.write('', done)),
        new Promise((done) => process.stderr.write('', done)),
      ]);
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

// A signal reaches the whole foreground group, so vitest gets it too and this
// process only has to make sure the dev server does not outlive the run.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    reportServerSnapshot(`runner received ${signal}`);
    void stopServer().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 143);
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
    exitCode = await runVitest(phase.args, baseUrl);
    if (exitCode !== 0) break;
    if (selection) {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      assertVitestReport(report, selection);
      writeJson(path.join(evidenceDirectory, `result-${evidenceId}.json`), {
        ...selection,
        report,
      });
    }
  }
} catch (error) {
  console.error(`[test:runtime] ${error instanceof Error ? error.message : String(error)}`);
  reportServerSnapshot('runtime test runner failed');
  exitCode = 1;
} finally {
  await stopServer();
}
process.exit(exitCode);
