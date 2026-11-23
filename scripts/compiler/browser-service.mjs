import { verifyProductionBrowserService } from './browser-production.mjs';
import { createServer } from 'node:net';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

export function localBrowserServiceConfiguration(environment, root, executable) {
  if (environment.PUI_BROWSER_URL !== undefined)
    throw new Error(
      'PUI_BROWSER_URL is unsupported for acceptance: the runner must own a fresh local Astro process.'
    );
  const port = Number(environment.PUI_BROWSER_PORT ?? 4325);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PUI_BROWSER_PORT must identify a nonzero TCP port.');
  const repository = path.resolve(root);
  return {
    root: repository,
    cwd: path.join(repository, 'apps/www'),
    executable,
    host: '127.0.0.1',
    port,
    url: `http://127.0.0.1:${port}`,
    command: [
      executable,
      'node_modules/astro/astro.js',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
    ],
  };
}

export function assertLoopbackPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      probe.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

// Astro 5.18.1 emits this Local URL from viteServer.resolvedUrls after listen().
// The earlier "ready in" line alone is not a binding to a listening address.
export function observedAstroLocalURL(log, expectedURL) {
  const match = stripVTControlCharacters(log).match(/\bLocal[ \t]+(https?:\/\/[^\s]+)[ \t]*\r?\n/);
  if (!match) return undefined;
  const actual = new URL(match[1]);
  if (actual.href !== `${expectedURL}/`)
    throw new Error(
      `Owned Astro listened at ${actual.href}, not the requested ${expectedURL}/; refusing an existing or alternate service.`
    );
  return actual.href;
}

export function childIsAlive(child) {
  if (
    !child ||
    !Number.isInteger(child.pid) ||
    child.pid < 1 ||
    child.killed ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return false;
  try {
    process.kill(child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Validate recorded process facts portably, without comparing machines' roots. */
export function verifyOwnedBrowserService(service) {
  if (service?.mode === 'runner-owned-production-static')
    return verifyProductionBrowserService(service);
  const owner = service?.owner;
  if (service?.mode !== 'local-runner-service' || !owner || owner.status !== 'passed')
    throw new Error('Browser receipt requires a completed runner-owned local Astro service.');
  if (
    typeof owner.root !== 'string' ||
    !path.isAbsolute(owner.root) ||
    path.resolve(owner.root) !== owner.root ||
    typeof owner.executable !== 'string' ||
    !path.isAbsolute(owner.executable)
  )
    throw new Error('Browser service process root/executable binding is invalid.');
  const expected = localBrowserServiceConfiguration(
    { PUI_BROWSER_PORT: String(owner.port) },
    owner.root,
    owner.executable
  );
  if (
    owner.cwd !== expected.cwd ||
    service.url !== expected.url ||
    owner.observedLocalURL !== `${expected.url}/` ||
    JSON.stringify(owner.command) !== JSON.stringify(expected.command) ||
    !Number.isInteger(owner.pid) ||
    owner.pid < 1 ||
    !Number.isInteger(owner.parentPid) ||
    owner.parentPid < 1 ||
    owner.pid === owner.parentPid ||
    owner.portAvailableBeforeSpawn !== true ||
    owner.aliveAtReady !== true ||
    owner.aliveBeforeShutdown !== true
  )
    throw new Error('Browser service child process, command or listening-port binding is invalid.');
}
