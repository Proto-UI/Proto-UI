// Starts one apps-www dev server, hands its URL to vitest through
// PROTO_UI_BROWSER_BASE_URL, and tears it down afterwards.
//
// The browser suites can each spawn their own server, which is what makes them
// usable on their own. Run together they share `apps/www/.astro`, and two Astro
// content stores writing `data-store.json.tmp` race on the rename, so one dev
// server exits and its suite fails. One server for the whole run removes that.

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntimeTestPlan } from './runtime-test-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Astro dev compiles a route on first request, so a suite probing a cold route
// can exceed its own hook timeout and fall back to spawning its own server.
// Warm every route the suites wait on.
const READY_ROUTES = [
  '/en/ui-libraries/base/textarea/',
  '/en/ui-libraries/brutalist/components/switch/',
  '/en/ui-libraries/brutalist/components/tabs/',
  '/en/ui-libraries/shadcn/textarea/',
];
const READY_TIMEOUT_MS = 180_000;

const testPlan = createRuntimeTestPlan(process.argv.slice(2));
let devServer = null;
let serverOutput = '';
let shuttingDown = false;

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
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (devServer && devServer.exitCode !== null) {
      throw new Error(`Documentation dev server exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${serverOutput}`);
}

async function startServer() {
  const port = await availablePort();
  const executable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  devServer = spawn(
    executable,
    [
      'pnpm@10.32.1',
      '--filter',
      'apps-www',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: root,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  devServer.stdout?.on('data', recordOutput);
  devServer.stderr?.on('data', recordOutput);

  const url = `http://127.0.0.1:${port}`;
  for (const route of READY_ROUTES) await waitForServer(`${url}${route}`);
  return url;
}

// The child is detached into its own process group, so signal the group to take
// the dev server's own children with it.
async function stopServer() {
  if (shuttingDown || !devServer || devServer.exitCode !== null || !devServer.pid) return;
  shuttingDown = true;
  const target = process.platform === 'win32' ? devServer.pid : -devServer.pid;
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
    // spawn() does not go through a shell, so resolve the workspace binary
    // rather than relying on node_modules/.bin being on PATH.
    const vitestBin = path.join(
      root,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'vitest.cmd' : 'vitest'
    );
    const env = baseUrl ? { ...process.env, PROTO_UI_BROWSER_BASE_URL: baseUrl } : process.env;
    const child = spawn(vitestBin, ['run', ...args], {
      cwd: root,
      env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

// A signal reaches the whole foreground group, so vitest gets it too and this
// process only has to make sure the dev server does not outlive the run.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
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
  }
} catch (error) {
  console.error(`[test:runtime] ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  await stopServer();
}
process.exit(exitCode);
