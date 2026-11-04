import { waitForServerReadiness } from '../../../../../../scripts/test/server-readiness.mjs';
// Shared server/browser plumbing for documentation browser regressions.
// Extracted so a third suite does not need a third inline copy; the two existing
// suites still carry their own and can migrate once their PRs land.

import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright-core';

export const RUNTIMES = ['wc', 'react', 'vue', 'vue2'] as const;
export type RuntimeId = (typeof RUNTIMES)[number];
const RUNTIME_OPTION_LABELS: Readonly<Record<RuntimeId, string>> = {
  wc: 'Web Components',
  react: 'React',
  vue: 'Vue',
  vue2: 'Vue 2',
};

export const COLOR_SCHEMES = ['light', 'dark'] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

let devServer: ChildProcess | null = null;
let serverOutput = '';
let styleGeneration: ReturnType<typeof createStyleGenerationOwner> | null = null;
// A static child program keeps the process-group leader alive until the real
// generator has exited and closed its output. Keeping it in this file also
// preserves the source-bound browser probe closure copied by evidence jobs.
export const styleSupervisorSource = String.raw`
const { spawn } = process.getBuiltinModule('node:child_process');
const executable = process.argv[2];
if (!executable || !process.send) throw new Error('Missing generation supervisor inputs.');

let released = false;
let childClosed = false;
const send = (message) => {
  if (process.connected)
    process.send(message, (error) => {
      if (error) console.error('Style generation supervisor IPC failed: ' + error.message);
    });
};
const finish = () => {
  if (released && childClosed && process.connected) process.disconnect();
};
const child = spawn(
  executable,
  ['pnpm@10.32.1', '--filter', 'apps-www', 'run', 'generate:proto-ui-style'],
  { cwd: process.cwd(), env: process.env, shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'] }
);
child.stdout?.pipe(process.stdout, { end: false });
child.stderr?.pipe(process.stderr, { end: false });
child.once('spawn', () => send({ kind: 'spawn', pid: child.pid }));
child.once('error', (error) => send({ kind: 'error', message: error.message, code: error.code }));
child.once('exit', (code, signal) => send({ kind: 'exit', code, signal }));
child.once('close', async () => {
  try {
    await Promise.all([process.stdout, process.stderr].map((stream) =>
      new Promise((resolve, reject) =>
        stream.write('', (error) => error ? reject(error) : resolve())
      )
    ));
  } catch (error) {
    send({ kind: 'error', message: 'Could not forward generator output: ' + error.message });
  } finally {
    childClosed = true;
    send({ kind: 'closed' });
    finish();
  }
});
process.on('message', (message) => {
  if (message?.kind !== 'release') return;
  released = true;
  finish();
});
process.on('SIGTERM', () => {});
process.on('disconnect', () => {
  if (released) return;
  if (process.platform === 'win32') { child.kill(); return; }
  try { process.kill(-process.pid, 'SIGTERM'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  setTimeout(() => {
    try { process.kill(-process.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }, 5_000);
});
`;

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve a browser-test port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

export async function chromeExecutable(): Promise<string> {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`
      : undefined,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next standard Chrome/Chromium location.
    }
  }

  throw new Error('Chrome/Chromium is required; set CHROME_PATH to its executable.');
}

async function waitForServer(url: string): Promise<void> {
  try {
    await waitForServerReadiness(url, {
      timeoutMs: 120_000,
      server: devServer,
      readOutput: () => serverOutput,
    });
  } catch (error) {
    // Vitest defers failed-hook details. Keep the immediate diagnostic so the
    // runner captures the shared server state before CI cancellation.
    console.error(
      `[browser-harness] readiness failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

function recordServerOutput(chunk: Buffer): void {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-20_000);
}

async function settlesWithin(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function releaseStyleSupervisor(generation: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!generation.connected || !generation.send) {
      reject(new Error('Style generation supervisor is not connected.'));
      return;
    }
    generation.send({ kind: 'release' }, (error) => (error ? reject(error) : resolve()));
  });
}

async function terminateStyleGeneration(
  generation: ChildProcess,
  ready: Promise<void>,
  drained: Promise<void>,
  closed: Promise<void>,
  getChildPid: () => number | null,
  isDrained: () => boolean
) {
  const pid = generation.pid;
  if (!(await settlesWithin(ready, 5_000))) {
    generation.kill('SIGKILL');
    await settlesWithin(closed, 5_000);
    throw new Error('Style generation supervisor did not initialize.');
  }
  if (!pid || generation.exitCode !== null || generation.signalCode !== null) {
    if (!isDrained()) throw new Error('Style generation supervisor exited before output closed.');
    return;
  }
  try {
    if (process.platform === 'win32') {
      const target = getChildPid() ?? pid;
      const killer = spawn('taskkill', ['/PID', String(target), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      const killed = new Promise<void>((resolve, reject) => {
        killer.once('error', reject);
        killer.once('exit', (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`Failed to terminate style generation tree ${target}.`))
        );
      });
      if (!(await settlesWithin(killed, 5_000))) {
        killer.kill();
        throw new Error(`Timed out terminating style generation tree ${target}.`);
      }
      if (!(await settlesWithin(drained, 5_000))) {
        generation.kill();
        throw new Error('Style generation did not finish after teardown.');
      }
      await releaseStyleSupervisor(generation);
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
      await settlesWithin(drained, 5_000);
      // The supervisor normally remains alive until release or SIGKILL. If its
      // exit has already been observed, do not signal its former group id.
      if (generation.exitCode === null && generation.signalCode === null) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        }
      }
    }
    if (!(await settlesWithin(closed, 5_000)) || !isDrained())
      throw new Error('Style generation did not finish after teardown.');
  } catch (error) {
    // Failure to terminate the generator must not leave the supervisor itself
    // holding the caller's IPC or output handles indefinitely.
    try {
      if (generation.exitCode === null && generation.signalCode === null)
        generation.kill('SIGKILL');
      if (!(await settlesWithin(closed, 5_000)))
        throw new Error('Style generation supervisor did not exit.');
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Style generation cleanup failed.');
    }
    throw error;
  }
}

/** Own generation separately from the readiness deadline and cancel it on teardown. */
export function createStyleGenerationOwner() {
  let stopped = false;
  let stopPromise: Promise<void> | null = null;
  let interrupt: (() => void) | null = null;
  let terminateCurrent: (() => Promise<void>) | null = null;

  return {
    get stopped() {
      return stopped;
    },
    run(executable: string): Promise<void> {
      if (stopped) return Promise.reject(new Error('Style generation was cancelled.'));
      const generation = spawn(
        process.execPath,
        ['--eval', styleSupervisorSource, '--', '--style-generation-supervisor', executable],
        {
          cwd: process.cwd(),
          env: process.env,
          detached: process.platform !== 'win32',
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        }
      );
      let output = '';
      const collect = (chunk: Buffer) => {
        output = `${output}${chunk.toString()}`.slice(-8_000);
      };
      generation.stdout?.on('data', collect);
      generation.stderr?.on('data', collect);
      const failureError = (code: number | null, signal: NodeJS.Signals | null) =>
        new Error(
          signal
            ? `generate:proto-ui-style exited on ${signal}\n${output}`
            : `generate:proto-ui-style exited with code ${String(code)}\n${output}`
        );
      let primaryFailure: (() => Error) | null = null;
      let childPid: number | null = null;
      let childDrained = false;
      let childSucceeded = false;
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      let resolveReady!: () => void;
      const ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      let resolveDrained!: () => void;
      const drained = new Promise<void>((resolve) => {
        resolveDrained = resolve;
      });
      let resolveClosed!: () => void;
      const closed = new Promise<void>((resolve) => {
        resolveClosed = resolve;
      });
      let termination: Promise<void> | null = null;
      const terminate = () =>
        (termination ??= terminateStyleGeneration(
          generation,
          ready,
          drained,
          closed,
          () => childPid,
          () => childDrained
        ));
      terminateCurrent = terminate;

      const pending = new Promise<void>((resolve, reject) => {
        const fail = (getFailure: () => Error) => {
          if (stopped || primaryFailure) return;
          primaryFailure = getFailure;
          void terminate().then(
            () => reject(getFailure()),
            (cleanupError) => {
              stopped = true;
              const failure = getFailure();
              reject(
                new AggregateError([failure, cleanupError], `${failure.message}\nCleanup failed.`)
              );
            }
          );
        };
        generation.once('error', (error) => fail(() => error));
        generation.on('message', (message: unknown) => {
          if (!message || typeof message !== 'object' || !('kind' in message)) {
            fail(() => new Error('Invalid style generation supervisor receipt.'));
            return;
          }
          const receipt = message as {
            kind: string;
            pid?: number;
            code?: number | string | null;
            signal?: NodeJS.Signals | null;
            message?: string;
          };
          if (receipt.kind === 'spawn' && typeof receipt.pid === 'number') {
            childPid = receipt.pid;
            resolveReady();
          } else if (receipt.kind === 'error' && typeof receipt.message === 'string') {
            resolveReady();
            fail(() => new Error(`Could not start style generation: ${receipt.message}`));
          } else if (
            receipt.kind === 'exit' &&
            (typeof receipt.code === 'number' || receipt.code === null) &&
            (typeof receipt.signal === 'string' || receipt.signal === null)
          ) {
            const code = receipt.code;
            const signal = receipt.signal;
            if (code === 0 && signal === null) {
              childSucceeded = true;
              closeTimer = setTimeout(() => {
                fail(
                  () =>
                    new Error('Style generation output remained open after its launcher exited.')
                );
              }, 5_000);
            } else {
              fail(() => failureError(code, signal));
            }
          } else if (receipt.kind === 'closed') {
            if (childDrained) {
              fail(() => new Error('Duplicate style generation close receipt.'));
              return;
            }
            childDrained = true;
            clearTimeout(closeTimer);
            resolveReady();
            resolveDrained();
            if (!stopped && !primaryFailure) {
              if (!childSucceeded) {
                fail(() => new Error('Style generation closed without a successful exit receipt.'));
              } else {
                void releaseStyleSupervisor(generation).catch((error: unknown) => {
                  fail(
                    () =>
                      new Error('Could not release style generation supervisor.', { cause: error })
                  );
                });
              }
            }
          } else {
            fail(() => new Error('Invalid style generation supervisor receipt.'));
          }
        });
        generation.once('close', (code, signal) => {
          clearTimeout(closeTimer);
          resolveReady();
          resolveClosed();
          if (primaryFailure) return;
          if (stopped) reject(new Error('Style generation was cancelled.'));
          else if (!childDrained || !childSucceeded || signal || code !== 0) {
            stopped = true;
            reject(
              new Error(
                `Style generation supervisor exited before reporting completion.\n${output}`
              )
            );
          } else resolve();
        });
      });
      let interruptThisRun!: () => void;
      const interrupted = new Promise<void>((_resolve, reject) => {
        interruptThisRun = () =>
          reject(primaryFailure ? primaryFailure() : new Error('Style generation was cancelled.'));
      });
      interrupt = interruptThisRun;
      void closed.then(async () => {
        try {
          await termination;
        } catch {
          // The startup or teardown caller receives the termination failure.
        }
        if (terminateCurrent === terminate) terminateCurrent = null;
        if (interrupt === interruptThisRun) interrupt = null;
      });
      return Promise.race([pending, interrupted]);
    },
    stop(): Promise<void> {
      stopped = true;
      interrupt?.();
      if (!stopPromise) stopPromise = terminateCurrent?.() ?? Promise.resolve();
      return stopPromise;
    },
  };
}

async function spawnServer(
  readyRoutes: readonly string[],
  generation: ReturnType<typeof createStyleGenerationOwner>
): Promise<string> {
  const port = await availablePort();
  const executable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  await generation.run(executable);
  if (generation.stopped) throw new Error('Documentation server startup was cancelled.');
  devServer = spawn(
    executable,
    [
      'pnpm@10.32.1',
      '--filter',
      'apps-www',
      'exec',
      'astro',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      // Windows treats .cmd shims as shell scripts rather than executable
      // images. Without this flag every browser suite fails before it can
      // collect any evidence, which silently removes the matrix from CI.
      shell: process.platform === 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  devServer.stdout?.on('data', recordServerOutput);
  devServer.stderr?.on('data', recordServerOutput);

  const url = `http://127.0.0.1:${port}`;
  for (const readyRoute of readyRoutes) await waitForServer(`${url}${readyRoute}`);
  return url;
}

export async function startServer(readyRouteOrRoutes: string | readonly string[]): Promise<string> {
  const readyRoutes =
    typeof readyRouteOrRoutes === 'string' ? [readyRouteOrRoutes] : readyRouteOrRoutes;
  const externalBaseUrl = process.env.PROTO_UI_BROWSER_BASE_URL?.replace(/\/$/, '');
  if (externalBaseUrl) {
    for (const readyRoute of readyRoutes) await waitForServer(`${externalBaseUrl}${readyRoute}`);
    return externalBaseUrl;
  }

  const generation = createStyleGenerationOwner();
  styleGeneration = generation;

  // availablePort() releases the socket before the child binds it, so two
  // browser suites running in parallel can be handed the same port and
  // --strictPort kills the loser. Retry on a fresh port instead.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await spawnServer(readyRoutes, generation);
    } catch (error) {
      if (generation.stopped) throw error;
      lastError = error;
      await stopDevServer();
      devServer = null;
      serverOutput = '';
    }
  }
  throw lastError;
}

export async function stopServer(): Promise<void> {
  try {
    await styleGeneration?.stop();
  } finally {
    await stopDevServer();
  }
}

async function stopDevServer(): Promise<void> {
  if (!devServer || devServer.exitCode !== null || devServer.signalCode !== null || !devServer.pid)
    return;
  const pid = devServer.pid;
  if (process.platform === 'win32') {
    // `corepack.cmd` runs through a cmd.exe wrapper. Killing only that shell
    // leaves Astro/Vite descendants behind, so terminate the whole tree.
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', () => resolve());
      killer.once('exit', () => resolve());
    });
    return;
  }

  const signalTarget = -pid;
  try {
    process.kill(signalTarget, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    return;
  }

  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const exited = await Promise.race([
      new Promise<boolean>((resolve) => devServer?.once('exit', () => resolve(true))),
      new Promise<boolean>((resolve) => {
        deadline = setTimeout(() => resolve(false), 5_000);
      }),
    ]);
    if (!exited && devServer.exitCode === null && devServer.signalCode === null)
      process.kill(signalTarget, 'SIGKILL');
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
  }
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
}

export async function openRoute(
  browser: Browser,
  baseUrl: string,
  route: string,
  viewport: Readonly<{ width: number; height: number }>
): Promise<{ context: BrowserContext; page: Page; previewer: Locator }> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  const previewer = page.locator('[data-previewer-id]').first();
  await previewer.waitFor({ state: 'visible' });
  return { context, page, previewer };
}

const RUNTIME_TABS_MARKERS =
  '[data-runtime-tabs-mount], [data-runtime-tabs-root], [data-runtime-tabs], [data-runtime-tab]';
/** Keep matching local to the selected previewer; generic panels may contain demo Tabs. */
function runtimeTabs(previewer: Locator, runtime?: RuntimeId): Locator {
  const page = previewer.page();
  const fixed = previewer.and(page.locator('[data-projection-mode="fixed-family"]'));
  const generic = previewer.and(page.locator(':not([data-projection-mode="fixed-family"])'));
  return fixed
    .locator(
      '[data-projection-scope][data-projection-state="ready"] [data-projection-control="runtime"][data-runtime-tabs] [role="tab"]'
    )
    .or(
      generic.locator(
        `[data-runtime-tabs-mount] [data-runtime-tabs-root] [data-runtime-tab${runtime ? `="${runtime}"` : ''}][role="tab"]`
      )
    );
}

/** Compatibility name: the keyboard entry anchor is the selected Runtime Tab or legacy Select. */
export function runtimeSelectTrigger(previewer: Locator): Locator {
  const legacy = previewer
    .filter({ hasNot: previewer.page().locator(RUNTIME_TABS_MARKERS) })
    .locator(
      '[data-projection-control="runtime"] [role="combobox"], [data-adapter-select-root] [role="combobox"]'
    );
  return runtimeTabs(previewer).and(previewer.page().locator('[aria-selected="true"]')).or(legacy);
}

/** Select one runtime through the same accessible composed control a reader uses. */
export async function choosePreviewRuntime(
  page: Page,
  previewer: Locator,
  runtime: RuntimeId
): Promise<void> {
  const trigger = runtimeSelectTrigger(previewer);
  // Wait for hydration through the declared shell. A Tabs marker prohibits the
  // legacy branch even while no usable tab exists. Strict locators reject ambiguity.
  await trigger.waitFor({ state: 'visible' });
  if ((await trigger.getAttribute('role')) === 'tab') {
    await runtimeTabs(previewer, runtime)
      .and(previewer.getByRole('tab', { name: RUNTIME_OPTION_LABELS[runtime], exact: true }))
      .click();
    return;
  }
  await trigger.click();
  const controlledId = await trigger.getAttribute('aria-controls');
  if (!controlledId) throw new Error('The runtime Select has no controlled option surface.');
  await page
    .locator(`[id=${JSON.stringify(controlledId)}]`)
    .getByRole('option', { name: RUNTIME_OPTION_LABELS[runtime], exact: true })
    .click();
}

export async function selectRuntime(
  page: Page,
  previewer: Locator,
  runtime: RuntimeId,
  readySelector: string,
  expectedCount: number
): Promise<void> {
  await choosePreviewRuntime(page, previewer, runtime);
  await waitForRuntimeAt(page, previewer, runtime, readySelector, expectedCount);
}

/** Observe the first documentation preview without changing application state. */
export async function waitForPreviewRuntime(
  page: Page,
  runtime: RuntimeId,
  readySelector: string,
  expectedCount: number
): Promise<void> {
  await waitForRuntimeAt(
    page,
    page.locator('[data-previewer-id]').first(),
    runtime,
    readySelector,
    expectedCount
  );
}

async function waitForRuntimeAt(
  page: Page,
  previewer: Locator,
  runtime: RuntimeId,
  readySelector: string,
  expectedCount: number
): Promise<void> {
  const previewerId = await previewer.getAttribute('data-previewer-id');
  if (!previewerId) throw new Error('Runtime readiness requires an identified previewer.');
  await page.waitForFunction(
    ({
      previewerId,
      expectedCount: count,
      readySelector: selector,
      runtime: selectedRuntime,
      label,
    }) => {
      const roots = document.querySelectorAll<HTMLElement>(
        `[data-previewer-id=${JSON.stringify(previewerId)}]`
      );
      if (roots.length !== 1) return false;
      const root = roots[0]!;
      const hosts = root.querySelectorAll<HTMLElement>('.host');
      const host = hosts.length === 1 ? hosts[0] : null;
      const scopes = host?.querySelectorAll<HTMLElement>('[data-projection-scope]') ?? [];
      const scope = scopes.length === 1 ? scopes[0] : null;
      const fixed = root.dataset.projectionMode === 'fixed-family';
      const content = fixed ? scope?.querySelector<HTMLElement>('[data-projection-content]') : host;
      if (!host || !content) return false;
      if (fixed && (!scope || scope.dataset.projectionState !== 'ready')) return false;
      const generation = scope?.closest<HTMLElement>('[data-projection-generation-state]');
      if (fixed && generation && generation.dataset.projectionGenerationState !== 'active')
        return false;
      if (!fixed && scopes.length) return false;

      const tabsDeclared = root.querySelector(
        '[data-runtime-tabs-mount], [data-runtime-tabs-root], [data-runtime-tabs], [data-runtime-tab]'
      );
      const controls = root.querySelectorAll<HTMLElement>(
        fixed
          ? '[data-projection-scope][data-projection-state="ready"] [data-projection-control="runtime"][data-runtime-tabs]'
          : '[data-runtime-tabs-mount] [data-runtime-tabs-root]'
      );
      let control: HTMLElement | null = null;
      let trigger: HTMLElement | null = null;
      if (tabsDeclared) {
        if (controls.length !== 1) return false;
        control = controls[0]!;
        const selected = control.querySelectorAll<HTMLElement>(
          fixed
            ? '[role="tab"][aria-selected="true"]'
            : '[data-runtime-tab][role="tab"][aria-selected="true"]'
        );
        if (selected.length !== 1) return false;
        trigger = selected[0]!;
        if (
          trigger.textContent?.trim() !== label ||
          (!fixed && trigger.dataset.runtimeTab !== selectedRuntime)
        )
          return false;
      } else if (fixed && root.dataset.projectionToolbar === 'false') {
        // An explicitly toolbarless projection is driven by the real Header Select.
      } else {
        const legacy = root.querySelectorAll<HTMLElement>(
          '[data-projection-control="runtime"] [role="combobox"], [data-adapter-select-root] [role="combobox"]'
        );
        if (legacy.length !== 1) return false;
        trigger = legacy[0]!;
        control = trigger.closest<HTMLElement>(
          '[data-projection-control="runtime"], [data-adapter-select-root]'
        );
        if (!fixed && control?.dataset.value !== selectedRuntime) return false;
      }
      // Ready projected attributes describe the materialized scope; the public
      // controller independently proves that this runtime was actually committed.
      if (fixed && scope?.dataset.projectionRuntime !== selectedRuntime) return false;
      const committed = (
        root as HTMLElement & { __previewer__?: { getCurrentRuntime?: () => string | null } }
      ).__previewer__?.getCurrentRuntime?.();
      if (committed !== selectedRuntime) return false;
      const unavailable = (element: HTMLElement) => {
        if (!element.isConnected) return true;
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          if (
            node.inert ||
            node.matches(
              '[inert], [hidden], [aria-hidden="true"], [aria-busy="true"], [aria-disabled="true"], [disabled], [data-previewer-startup-pending], [data-previewer-startup-shell]'
            )
          )
            return true;
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return true;
        }
        return false;
      };
      if (
        unavailable(host) ||
        (control && unavailable(control)) ||
        (trigger && unavailable(trigger))
      )
        return false;
      if (
        root.querySelector(
          '[data-previewer-startup-pending], [data-previewer-startup-shell], .proto-previewer__skeleton'
        )
      )
        return false;
      const surfaces = content.querySelectorAll<HTMLElement>(
        '.pui-runtime-preview-surface[data-demo-ref="__website_runtime_preview_surface__"]'
      );
      if (surfaces.length !== 1) return false;
      const surface = surfaces[0]!;
      if (
        unavailable(surface) ||
        !surface.hasAttribute('data-pui-root') ||
        Array.from(content.querySelectorAll('[data-pui-root]')).some(
          (element) => element !== surface && !surface.contains(element)
        )
      )
        return false;
      // RuntimeBox adds one reserved passive boundary; original demo counts stay exact.
      const firstRoot = surface.querySelector<HTMLElement>('[data-pui-root]');
      if (surface.querySelectorAll(selector).length !== count || !firstRoot) return false;
      const framework = firstRoot.tagName.startsWith('WC-')
        ? 'wc'
        : (firstRoot as HTMLElement & { __vue__?: unknown }).__vue__
          ? 'vue2'
          : host.hasAttribute('data-v-app') || firstRoot.closest('[data-v-app]')
            ? 'vue'
            : Object.keys(surface).some((key) => key.startsWith('__reactFiber$'))
              ? 'react'
              : null;
      return framework === selectedRuntime;
    },
    { previewerId, expectedCount, readySelector, runtime, label: RUNTIME_OPTION_LABELS[runtime] },
    { timeout: 20_000 }
  );
}

/**
 * Emulates a colour scheme and waits until the documentation theme script has
 * projected it, so a measurement cannot read the previous theme.
 */
export async function applyColorScheme(page: Page, colorScheme: ColorScheme): Promise<void> {
  await page.emulateMedia({ colorScheme });
  await page.waitForFunction(
    (scheme) => document.documentElement.dataset.theme === scheme,
    colorScheme,
    { timeout: 10_000 }
  );
}
