// Shared server/browser plumbing for documentation browser regressions.
// Extracted so a third suite does not need a third inline copy; the two existing
// suites still carry their own and can migrate once their PRs land.

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from 'playwright-core';

export const RUNTIMES = ['wc', 'react', 'vue'] as const;
export type RuntimeId = (typeof RUNTIMES)[number];

export const COLOR_SCHEMES = ['light', 'dark'] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

let devServer: ChildProcess | null = null;
let serverOutput = '';
let styleGeneration: Promise<void> | null = null;

export function resolveBrowserHarnessRoots(moduleUrl = import.meta.url): {
  repoRoot: string;
  appsWwwRoot: string;
} {
  const appsWwwRoot = path.resolve(fileURLToPath(new URL('../../../../', moduleUrl)));
  return { appsWwwRoot, repoRoot: path.resolve(appsWwwRoot, '..', '..') };
}

const { appsWwwRoot } = resolveBrowserHarnessRoots();

function resolveCorepackCli(): string {
  const nodeBin = path.dirname(process.execPath);
  const suffix = ['node_modules', 'corepack', 'dist', 'corepack.js'];
  const candidates = [path.join(nodeBin, ...suffix), path.resolve(nodeBin, '..', 'lib', ...suffix)];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (resolved) return resolved;
  throw new Error(
    `Unable to locate Corepack for ${process.execPath}. Tried:\n${candidates.join('\n')}`
  );
}

/**
 * Rebuild the CLI and regenerate the website style projection before Astro
 * starts. The long-lived server is still a direct Node child for reliable
 * teardown; only this short-lived prerequisite goes through Corepack.
 */
export async function generateProtoUiStyle(): Promise<void> {
  styleGeneration ??= new Promise<void>((resolve, reject) => {
    const corepackCli = resolveCorepackCli();
    const child = spawn(
      process.execPath,
      [corepackCli, 'pnpm@10.32.1', 'run', 'generate:proto-ui-style'],
      { cwd: appsWwwRoot, env: process.env, stdio: 'inherit' }
    );
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Proto UI style generation exited on ${signal}.`));
      else if (code !== 0) reject(new Error(`Proto UI style generation exited with code ${code}.`));
      else resolve();
    });
  });
  return styleGeneration;
}

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

export function resolveBrowserExecutableCandidates(
  platform: NodeJS.Platform = process.platform,
  env: Readonly<Record<string, string | undefined>> = process.env
): string[] {
  const windowsCandidates =
    platform === 'win32'
      ? [
          ...(env.LOCALAPPDATA
            ? [
                path.win32.join(env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
                path.win32.join(env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
              ]
            : []),
          path.win32.join(
            env.PROGRAMFILES ?? 'C:\\Program Files',
            'Google/Chrome/Application/chrome.exe'
          ),
          path.win32.join(
            env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
            'Google/Chrome/Application/chrome.exe'
          ),
          path.win32.join(
            env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
            'Microsoft/Edge/Application/msedge.exe'
          ),
        ]
      : [];
  return [
    env.CHROME_PATH,
    ...windowsCandidates,
    '/usr/bin/google-chrome',
    '/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((candidate): candidate is string => Boolean(candidate));
}

export async function chromeExecutable(): Promise<string> {
  const candidates = resolveBrowserExecutableCandidates();

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
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (devServer && devServer.exitCode !== null) {
      throw new Error(`Documentation dev server exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${serverOutput}`);
}

function recordServerOutput(chunk: Buffer): void {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-20_000);
}

async function spawnServer(readyRoute: string): Promise<string> {
  const port = await availablePort();
  const astroCli = path.join(appsWwwRoot, 'node_modules', 'astro', 'astro.js');
  devServer = spawn(
    process.execPath,
    [astroCli, 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: appsWwwRoot,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  devServer.stdout?.on('data', recordServerOutput);
  devServer.stderr?.on('data', recordServerOutput);

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(`${url}${readyRoute}`);
  return url;
}

export async function startServer(readyRoute: string): Promise<string> {
  const externalBaseUrl = process.env.PROTO_UI_BROWSER_BASE_URL?.replace(/\/$/, '');
  if (externalBaseUrl) {
    await waitForServer(`${externalBaseUrl}${readyRoute}`);
    return externalBaseUrl;
  }

  await generateProtoUiStyle();

  // availablePort() releases the socket before the child binds it, so two
  // browser suites running in parallel can be handed the same port and
  // --strictPort kills the loser. Retry on a fresh port instead.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await spawnServer(readyRoute);
    } catch (error) {
      lastError = error;
      await stopServer();
      devServer = null;
      serverOutput = '';
    }
  }
  throw lastError;
}

export async function stopServer(): Promise<void> {
  if (!devServer || devServer.exitCode !== null || !devServer.pid) return;
  // Astro is the direct child, so Windows does not point at a transient shell.
  const signalTarget = process.platform === 'win32' ? devServer.pid : -devServer.pid;
  try {
    process.kill(signalTarget, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    return;
  }

  const exited = await Promise.race([
    new Promise<boolean>((resolve) => devServer?.once('exit', () => resolve(true))),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && devServer.exitCode === null) {
    try {
      process.kill(signalTarget, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
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

export async function selectRuntime(
  page: Page,
  previewer: Locator,
  runtime: RuntimeId,
  readySelector: string,
  expectedCount: number
): Promise<void> {
  await previewer.locator('select.adapter-select').selectOption(runtime);
  await page.waitForFunction(
    ({ expectedCount: count, readySelector: selector, runtime: selectedRuntime }) => {
      const root = document.querySelector<HTMLElement>('[data-previewer-id]');
      const select = root?.querySelector<HTMLSelectElement>('select.adapter-select');
      const host = root?.querySelector<HTMLElement>('.host');
      const firstRoot = host?.querySelector<HTMLElement>('[data-pui-root]');
      if (!root || !select || !host || select.value !== selectedRuntime) return false;
      if (root.querySelectorAll(selector).length !== count || !firstRoot) return false;
      if (selectedRuntime === 'wc') return firstRoot.tagName.startsWith('WC-');
      if (selectedRuntime === 'vue') return host.hasAttribute('data-v-app');
      // React owns neither a custom element nor a Vue app root. The host tag is
      // not always a div: a text-control Prototype roots on its native control.
      return !firstRoot.tagName.startsWith('WC-') && !host.hasAttribute('data-v-app');
    },
    { expectedCount, readySelector, runtime },
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
