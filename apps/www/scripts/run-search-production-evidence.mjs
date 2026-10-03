import { spawn as nodeSpawn } from 'node:child_process';
import { access as fileAccess, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { waitForServerReadiness } from '../../../scripts/test/server-readiness.mjs';

export const SEARCH_PRODUCTION_SUITE =
  'apps/www/src/content/docs/zh-cn/site-search-production.browser.test.ts';
export const SEARCH_PRODUCTION_ROUTES = [
  '/zh-cn/ui-libraries/shadcn/button/',
  '/zh-cn/ui-libraries/brutalist/components/button/',
  '/pagefind/pagefind.js',
];
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** One bounded owner for build, the single named preview and exactly one
 * production suite. Dependencies are injectable for no-socket unit tests. */
export async function runSearchProductionEvidence(options = {}, dependencies = {}) {
  const {
    root = defaultRoot,
    timeoutMs = 540_000,
    cleanupMs = 5_000,
    port = 4397,
    env = process.env,
  } = options;
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid production preview port');
  if (!Number.isFinite(timeoutMs) || cleanupMs <= 0 || timeoutMs <= cleanupMs)
    throw new Error('Production deadline must include a positive cleanup reserve');
  const {
    spawn = nodeSpawn,
    readiness = waitForServerReadiness,
    makeProfile = () => mkdtempSync(path.join(os.tmpdir(), 'proto-search-production-')),
    removeProfile = (directory) => rm(directory, { recursive: true, force: true }),
    access = fileAccess,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    signalProcessGroup = (pid, signal) => process.kill(-pid, signal),
    signals = process,
    report = console.log,
    node = process.execPath,
  } = dependencies;
  const deadline = now() + timeoutMs;
  const workDeadline = deadline - cleanupMs;
  const children = new Set();
  const cleanupErrors = [];
  let cleaningUp = false;
  let profile = null;
  const disposals = [];
  let rejectAbort;
  let aborted = null;
  const abort = new Promise((_, reject) => {
    rejectAbort = reject;
  });
  abort.catch(() => {});
  const fail = (error) => {
    if (aborted) return;
    aborted = error;
    rejectAbort(error);
  };
  const timer = setTimer(
    () => fail(new Error('Search production evidence total deadline reached (cleanup reserved)')),
    timeoutMs - cleanupMs
  );
  const signalHandlers = new Map(
    ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [
      signal,
      () => {
        const error = new Error(`Search production evidence interrupted by ${signal}`);
        error.signal = signal;
        fail(error);
      },
    ])
  );
  for (const [signal, handler] of signalHandlers) signals.on(signal, handler);
  const remaining = () => {
    if (aborted) throw aborted;
    const value = workDeadline - now();
    if (value <= 0)
      throw new Error('Search production evidence total deadline reached (cleanup reserved)');
    return value;
  };
  const bounded = (promise) => Promise.race([promise, abort]);
  function start(name, command, args, extraEnv = {}, ipc = false) {
    remaining();
    report(`[search-production] start ${name}`);
    const child = spawn(command, args, {
      cwd: root,
      env: { ...env, ASTRO_TELEMETRY_DISABLED: '1', ...extraEnv },
      detached: true,
      stdio: ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
    });
    return ownChild(name, child);
  }
  function ownChild(name, child) {
    const managed = { name, child, output: '', result: null, exited: null };
    managed.exited = new Promise((resolve) => {
      const done = (result) => {
        if (managed.result) return;
        managed.result = result;
        resolve(result);
      };
      child.once('error', (error) => done({ error }));
      child.once('exit', (code, signal) => done({ code, signal }));
      if (child.exitCode !== null || child.signalCode !== null)
        done({ code: child.exitCode, signal: child.signalCode });
    });
    children.add(managed);
    const output = (chunk) => {
      const text = chunk.toString();
      managed.output = `${managed.output}${text}`.slice(-20_000);
      report(`[${name}] ${text.trimEnd()}`);
    };
    child.stdout?.on('data', output);
    child.stderr?.on('data', output);
    return managed;
  }
  async function successful(managed) {
    const result = await bounded(managed.exited);
    if (result.error || result.signal || result.code !== 0) {
      throw new Error(
        `${managed.name} failed: ${result.error?.message ?? `exit=${result.code}; signal=${result.signal}`}\n${managed.output}`
      );
    }
    // Sweep descendants immediately while this exact child group is still
    // attributable, even if its wrapper exited successfully before its pipes.
    signalOwned(managed, 'SIGTERM');
    signalOwned(managed, 'SIGKILL');
    children.delete(managed);
  }
  function signalOwned(managed, signal) {
    if (!managed.child.pid) return;
    try {
      signalProcessGroup(managed.child.pid, signal);
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        cleanupErrors.push(error);
        report(`[search-production] ${managed.name} cleanup ${signal}: ${error.message}`);
      }
    }
  }
  try {
    const build = start('search-production-build', 'corepack', [
      'pnpm@10.32.1',
      '--filter',
      'apps-www',
      'build',
    ]);
    await successful(build);
    remaining();
    // A successful build without generated Pagefind assets is not evidence.
    await bounded(access(path.join(root, 'apps/www/dist/pagefind/pagefind.js')));
    const preview = start(
      'search-production-preview',
      node,
      [path.join(root, 'apps/www/scripts/search-production-preview.mjs')],
      { PROTO_UI_SEARCH_PRODUCTION_PORT: String(port) },
      true
    );
    const readyMessage = new Promise((resolve, reject) => {
      const onMessage = (message) => {
        if (message?.type !== 'search-production-preview-ready') return;
        preview.child.off('message', onMessage);
        if (message.port !== port)
          reject(new Error('Production preview reported an unexpected port'));
        else resolve();
      };
      preview.child.on('message', onMessage);
      preview.exited.then((result) => {
        preview.child.off('message', onMessage);
        reject(
          new Error(
            `Production preview exited before completion: ${JSON.stringify(result)}\n${preview.output}`
          )
        );
      });
    });
    await bounded(readyMessage);
    // A later preview exit is fatal even when the browser or readiness stalls.
    preview.exited.then((result) => {
      if (!cleaningUp)
        fail(
          new Error(
            `Production preview exited before completion: ${JSON.stringify(result)}\n${preview.output}`
          )
        );
    });
    const baseUrl = `http://127.0.0.1:${port}`;
    for (const route of SEARCH_PRODUCTION_ROUTES) {
      await bounded(
        readiness(`${baseUrl}${route}`, {
          timeoutMs: remaining(),
          server: preview.child,
          readOutput: () => preview.output,
          report,
        })
      );
    }
    if (!env.CHROME_PATH)
      throw new Error('CHROME_PATH must identify the Actions runner-provided Chrome');
    // Spawn is the ownership boundary: the Chrome PID is registered before
    // waiting for any protocol endpoint. No pending launchServer promise can
    // hide a live detached process from timeout or signal cleanup.
    profile = makeProfile();
    const browser = start('search-production-browser', env.CHROME_PATH, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ]);
    browser.exited.then((result) => {
      if (!cleaningUp)
        fail(
          new Error(`Owned production browser exited before completion: ${JSON.stringify(result)}`)
        );
    });
    const endpointReady = new Promise((resolve, reject) => {
      const onOutput = () => {
        const match = browser.output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (!match) return;
        try {
          const endpoint = new URL(match[1]);
          if (
            endpoint.protocol !== 'ws:' ||
            endpoint.hostname !== '127.0.0.1' ||
            !endpoint.port ||
            !endpoint.pathname.startsWith('/devtools/browser/')
          ) {
            throw new Error('Owned Chrome reported an invalid loopback CDP endpoint');
          }
          dispose();
          resolve(endpoint.href);
        } catch (error) {
          dispose();
          reject(error);
        }
      };
      const dispose = () => browser.child.stderr?.off('data', onOutput);
      disposals.push(dispose);
      browser.child.stderr?.on('data', onOutput);
      onOutput();
      browser.exited.then((result) => {
        dispose();
        reject(new Error(`Owned Chrome exited before CDP readiness: ${JSON.stringify(result)}`));
      });
    });
    const cdpEndpoint = await bounded(endpointReady);
    const test = start(
      'search-production-tests',
      'corepack',
      [
        'pnpm@10.32.1',
        'exec',
        'vitest',
        'run',
        '--no-file-parallelism',
        '--maxWorkers=1',
        '--minWorkers=1',
        SEARCH_PRODUCTION_SUITE,
      ],
      {
        PROTO_UI_BROWSER_BASE_URL: baseUrl,
        PROTO_UI_SEARCH_PRODUCTION_BASE_URL: baseUrl,
        PROTO_UI_SEARCH_PRODUCTION_REQUIRED: '1',
        PROTO_UI_SEARCH_PRODUCTION_CDP: cdpEndpoint,
      }
    );
    await successful(test);
    remaining();
    // Success is reported only after the owned preview has been cleaned up.
  } finally {
    cleaningUp = true;
    clearTimer(timer);
    for (const dispose of disposals) dispose();
    const settledWithin = async (promise, milliseconds) => {
      let waitTimer;
      try {
        return await Promise.race([
          promise.then(() => true),
          new Promise((resolve) => {
            waitTimer = setTimer(() => resolve(false), Math.max(0, milliseconds));
          }),
        ]);
      } finally {
        if (waitTimer !== undefined) clearTimer(waitTimer);
      }
    };
    // Only our explicitly detached child groups are signaled. Never pkill a
    // browser/server name or kill the occupant of the configured port.
    for (const managed of children) signalOwned(managed, 'SIGTERM');
    const exited = Promise.all([...children].map((managed) => managed.exited));
    // Preserve half of cleanup time for forceful-exit confirmation and profile
    // removal. The full total deadline still owns every stage.
    await settledWithin(exited, Math.max(0, Math.min(cleanupMs / 2, deadline - now())));
    // The group leader can exit while descendants remain, so signal each
    // still-owned group even when its leader already reported an exit.
    for (const managed of children) signalOwned(managed, 'SIGKILL');
    if (!(await settledWithin(exited, Math.max(0, deadline - now())))) {
      cleanupErrors.push(new Error('Owned child exit was not confirmed before the total deadline'));
    }
    for (const managed of children) {
      managed.child.stdout?.destroy?.();
      managed.child.stderr?.destroy?.();
      if (managed.child.connected) managed.child.disconnect();
      managed.child.unref?.();
    }
    if (profile) {
      const removed = Promise.resolve()
        .then(() => removeProfile(profile))
        .catch((error) => {
          cleanupErrors.push(error);
        });
      if (!(await settledWithin(removed, Math.max(0, deadline - now())))) {
        cleanupErrors.push(
          new Error('Owned Chrome profile removal did not finish before the total deadline')
        );
      }
    }
    children.clear();
    for (const [signal, handler] of signalHandlers) signals.off(signal, handler);
  }
  if (now() > deadline) cleanupErrors.push(new Error('Cleanup completed after the total deadline'));
  if (cleanupErrors.length)
    throw new AggregateError(cleanupErrors, 'Search production process cleanup failed');
  if (aborted) throw aborted;
  report('[search-production] Production search suite and owned-process cleanup passed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.platform !== 'linux') {
    console.error(
      'Search production evidence runner supports the managed Linux Actions runner only'
    );
    process.exitCode = 1;
  } else {
    try {
      await runSearchProductionEvidence();
    } catch (error) {
      console.error(error);
      process.exitCode = error?.signal === 'SIGINT' ? 130 : error?.signal ? 143 : 1;
    }
  }
}
