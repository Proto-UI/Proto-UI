import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const writeJson = (file, value) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

export const SOURCE_CANARY_SUITE = 'public-brutalist-controls';
export const SOURCE_STOP_BUDGET_MS = 5_500;
export const SOURCE_CANARY_MODULES = Object.freeze([
  '/src/components/PrototypePreviewer/projection-materializer.ts',
  '/src/components/PrototypePreviewer/projection-theme.ts',
]);
export const SOURCE_CANARY_ROUTE = '/en/ui-libraries/brutalist/components/button/';
const RECEIPTS = [
  'source.json',
  'server.log',
  'requests.jsonl',
  'server.json',
  'probes.json',
  'terminal.json',
];
// PageFrame -> global.css -> proto-ui-style.css -> theme + tokens. These
// build-produced inputs include ignored files, so Git source identity alone
// cannot bind their bytes. The Shadow companion is produced by the same
// generator and imported by ShadowSplit fixtures; it is bound as a companion,
// not claimed as a Button canary's exercised Shadow paint path.
const PAINT_INPUTS = [
  'src/styles/proto-ui-style.css',
  'src/styles/proto-ui-tokens.generated.css',
  'src/styles/shadcn-theme.css',
  'src/styles/proto-ui-shadow-style.generated.js',
  'src/generated/shadcn-motion-palette.ts',
];

export function sourceServerHash() {
  return sha(readFileSync(self));
}

// No caller URL can enter a producer-owned journey, including a fixture row.
export function suiteOrigins(environment, row, previewUrl, sourceUrl) {
  const env = { ...environment };
  delete env.PROTO_UI_BROWSER_BASE_URL;
  delete env.PROTO_UI_BROWSER_SOURCE_BASE_URL;
  const ownedOrigin = (value) => {
    const url = new URL(value);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      !url.port ||
      url.origin !== value
    )
      throw new Error('Expected an owned loopback origin.');
    return value;
  };
  if (row.surface === 'production-docs') env.PROTO_UI_BROWSER_BASE_URL = ownedOrigin(previewUrl);
  if (row.id === SOURCE_CANARY_SUITE) {
    if (row.surface !== 'production-docs' || !sourceUrl)
      throw new Error('The controls source canary requires its owned source server.');
    if (sourceUrl === previewUrl)
      throw new Error('Source and production origins must have separate owners.');
    env.PROTO_UI_BROWSER_SOURCE_BASE_URL = ownedOrigin(sourceUrl);
  }
  return env;
}

function artifact(directory, name) {
  const file = path.join(directory, name);
  if (realpathSync(file) !== path.resolve(file) || !lstatSync(file).isFile())
    throw new Error(`Expected an owned regular source-canary receipt: ${name}`);
  const bytes = readFileSync(file);
  return { file: name, bytes: bytes.length, sha256: sha(bytes) };
}

export function inspectSourceCanary(directory, receipt, source) {
  const problems = [];
  const observedArtifacts = {};
  if (!receipt || receipt.status !== 'passed')
    problems.push('Source canary producer did not pass.');
  if (
    receipt?.evidenceKind !== 'supplemental-source-canary' ||
    receipt?.suite !== SOURCE_CANARY_SUITE
  )
    problems.push('Source canary evidence scope is missing or incorrect.');
  if (
    receipt?.sourceHead !== source.head ||
    receipt?.sourceServerSha256 !== source.sourceServerSha256
  )
    problems.push('Source canary producer source binding differs.');
  if (
    !receipt?.terminal?.groupRetired ||
    !receipt?.terminal?.stopAcknowledged ||
    receipt?.terminal?.exitCode !== 0
  )
    problems.push('Source canary server has no successful terminal cleanup receipt.');
  for (const name of RECEIPTS) {
    try {
      const actual = artifact(directory, name);
      observedArtifacts[name] = actual;
      const expected = receipt?.artifacts?.[name];
      if (!expected || JSON.stringify(expected) !== JSON.stringify(actual))
        problems.push(`${name} source-canary hash or length drifted, or was never sealed.`);
    } catch (error) {
      problems.push(`${name} source-canary receipt unavailable: ${String(error)}`);
    }
  }
  return { problems, observedArtifacts };
}

/**
 * One supplementary source producer, only while the controls row is active.
 * Astro's experimental dev API stays in a child: it mutates NODE_ENV and writes
 * root/.astro. The already-built production preview remains a separate owner.
 * All startup/probe time consumes the caller's existing suite/global deadline.
 */
export function createOwnedSourceServer({
  root,
  directory,
  source,
  deadline,
  signal,
  startupMs = 120_000,
  stopGraceMs = 5_000,
}) {
  const cleanupMs = stopGraceMs + 500;
  if (
    !Number.isFinite(deadline) ||
    !Number.isFinite(startupMs) ||
    startupMs <= 0 ||
    !Number.isFinite(stopGraceMs) ||
    stopGraceMs <= 0 ||
    deadline - Date.now() <= cleanupMs
  )
    throw new Error('No bounded source startup/cleanup budget remains.');
  if (signal?.aborted) throw new Error('Source producer interrupted before start.');
  if (source.sourceServerSha256 !== sourceServerHash())
    throw new Error('Source helper differs from the bound producer source.');
  root = realpathSync(root);
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== path.resolve(directory))
    throw new Error('Source evidence directory cannot be an alias.');
  const inputs = [
    { file: 'scripts/test/sprint3-source-server.mjs', sha256: sourceServerHash() },
    ...[
      'astro.config.mjs',
      ...SOURCE_CANARY_MODULES.map((name) => name.slice(1)),
      ...PAINT_INPUTS,
    ].map((file) => ({
      ...artifact(root, file),
      file: `apps/www/${file}`,
    })),
  ];
  const sourceReceipt = {
    evidenceKind: 'supplemental-source-canary',
    suite: SOURCE_CANARY_SUITE,
    source,
    inputs,
    startedAt: now(),
    root,
    budgets: {
      startupMs,
      stopGraceMs,
      cleanupMs,
      deadline: new Date(deadline).toISOString(),
      includedInSuiteBudget: true,
    },
    limitations: [
      'Source module availability is not a production bundle or native interaction result.',
      'One source dev runs after the production build; no style generation owner is started here.',
      'The generated Shadow style companion is source-bound; this Button canary does not certify Shadow delivery.',
    ],
  };
  writeJson(path.join(directory, 'source.json'), sourceReceipt);
  const logFd = openSync(path.join(directory, 'server.log'), 'wx');
  let requestFd;
  let cache;
  let child;
  try {
    requestFd = openSync(path.join(directory, 'requests.jsonl'), 'wx');
    cache = mkdtempSync(path.join(tmpdir(), 'proto-ui-source-canary-'));
    const env = suiteOrigins(process.env, { surface: 'fixture' });
    child = fork(self, ['--child'], {
      cwd: root,
      env: { ...env, NODE_ENV: 'development', ASTRO_TELEMETRY_DISABLED: '1' },
      execArgv: [],
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
  } catch (error) {
    closeSync(logFd);
    if (requestFd !== undefined) closeSync(requestFd);
    if (cache) rmSync(cache, { recursive: true, force: true });
    throw error;
  }
  const failure = new AbortController();
  const problems = [];
  const probes = [];
  let metadata = null;
  let stopping = false;
  let closed = false;
  let stopAcknowledged = false;
  let exitCode = null;
  let exitSignal = null;
  let forced = false;
  let closePromise;
  let resolveReady;
  let rejectReady;
  const readyMessage = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Startup failure may arrive before the caller awaits ready().
  readyMessage.catch(() => {});
  let resolveClosed;
  const closedPromise = new Promise((resolve) => {
    resolveClosed = resolve;
  });
  const kill = (name) => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, name);
    } catch (error) {
      if (error.code !== 'ESRCH') problems.push(`Process-group ${name}: ${String(error)}`);
    }
  };
  const groupAlive = () => {
    if (!child.pid) return false;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') return false;
      throw error;
    }
  };
  const fail = (error) => {
    const message = String(error);
    if (!problems.includes(message)) problems.push(message);
    failure.abort(new Error(message));
    rejectReady(new Error(message));
    void close().catch(() => {});
  };
  const record = (fd, bytes) => {
    try {
      writeSync(fd, bytes);
    } catch (error) {
      fail(`Source evidence I/O: ${String(error)}`);
    }
  };
  child.stdout.on('data', (bytes) => record(logFd, bytes));
  child.stderr.on('data', (bytes) => record(logFd, bytes));
  child.on('error', (error) => fail(`Source child error: ${String(error)}`));
  child.on('message', (message) => {
    if (message?.type === 'ready') {
      if (
        metadata ||
        stopping ||
        message.pid !== child.pid ||
        message.address?.address !== '127.0.0.1' ||
        !Number.isInteger(message.address.port) ||
        message.address.port <= 0 ||
        message.address.port > 65535 ||
        message.root !== root ||
        !message.astro?.version
      )
        return fail('Invalid or late source child readiness receipt.');
      metadata = message;
      resolveReady(message);
    } else if (message?.type === 'request') {
      record(
        requestFd,
        `${JSON.stringify({ at: now(), evidenceKind: 'supplemental-source-canary', ...message })}\n`
      );
    } else if (message?.type === 'stopped') stopAcknowledged = true;
    else if (message?.type === 'fatal') fail(`Source child failure: ${message.error}`);
  });
  child.once('exit', (code, childSignal) => {
    exitCode = code;
    exitSignal = childSignal;
    if (!stopping) fail(`Source child exited unexpectedly: ${code ?? childSignal}`);
  });
  child.once('close', () => {
    closed = true;
    resolveClosed();
  });
  const interrupt = () => fail('Source producer interrupted.');
  const startupDeadline = Math.min(deadline - cleanupMs, Date.now() + startupMs);
  const startupTimer = setTimeout(
    () => fail('Source startup resource deadline exhausted.'),
    Math.max(1, startupDeadline - Date.now())
  );
  const lifetimeTimer = setTimeout(
    () => fail('Source suite resource deadline exhausted.'),
    Math.max(1, deadline - cleanupMs - Date.now())
  );
  signal?.addEventListener('abort', interrupt, { once: true });
  child.send(
    { type: 'start', root, cache, stopGraceMs, deadline: deadline - cleanupMs },
    (error) => {
      if (error) fail(`Source start IPC: ${String(error)}`);
    }
  );
  if (signal?.aborted) interrupt();

  async function ready() {
    const message = await readyMessage;
    const url = `http://127.0.0.1:${message.address.port}`;
    for (const pathname of [SOURCE_CANARY_ROUTE, ...SOURCE_CANARY_MODULES]) {
      const probe = { pathname, expectedOrigin: url, outcome: 'failed' };
      probes.push(probe);
      const response = await fetch(`${url}${pathname}`, {
        redirect: 'error',
        signal: AbortSignal.any([
          failure.signal,
          AbortSignal.timeout(Math.max(1, Math.min(30_000, startupDeadline - Date.now()))),
        ]),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      Object.assign(probe, {
        status: response.status,
        url: response.url,
        contentType: response.headers.get('content-type'),
        bytes: bytes.length,
        sha256: sha(bytes),
      });
      const module = SOURCE_CANARY_MODULES.includes(pathname);
      if (
        response.status !== 200 ||
        response.url !== `${url}${pathname}` ||
        !bytes.length ||
        !(module ? /(?:java|ecma)script/i : /text\/html/i).test(probe.contentType ?? '')
      )
        throw new Error(`Source ${module ? 'module' : 'document'} probe failed: ${pathname}`);
      probe.outcome = 'available';
    }
    clearTimeout(startupTimer);
    if (failure.signal.aborted || stopping)
      throw new Error('Source server failed during readiness.');
    return {
      url,
      pid: message.pid,
      evidenceKind: sourceReceipt.evidenceKind,
      suite: SOURCE_CANARY_SUITE,
      sourceHead: source.head,
      astro: message.astro,
      inputs,
    };
  }

  function close() {
    if (closePromise) return closePromise;
    stopping = true;
    clearTimeout(startupTimer);
    clearTimeout(lifetimeTimer);
    signal?.removeEventListener('abort', interrupt);
    closePromise = Promise.resolve().then(async () => {
      const timer = setTimeout(() => {
        forced = true;
        kill('SIGKILL');
      }, stopGraceMs);
      try {
        try {
          if (!closed && child.connected)
            child.send({ type: 'stop' }, (error) => {
              if (error) problems.push(`Source stop IPC: ${String(error)}`);
            });
          else if (!closed) kill('SIGTERM');
        } catch (error) {
          problems.push(`Source stop dispatch: ${String(error)}`);
          kill('SIGTERM');
        }
        await closedPromise;
      } finally {
        clearTimeout(timer);
        // Retire any descendants even when their parent already exited.
        kill('SIGKILL');
        for (const fd of [logFd, requestFd]) {
          try {
            closeSync(fd);
          } catch (error) {
            problems.push(`Source log close: ${String(error)}`);
          }
        }
      }
      let groupRetired = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        if (!groupAlive()) {
          groupRetired = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (!groupRetired) problems.push('Owned source process group did not retire.');
      if (forced || exitCode !== 0 || !stopAcknowledged)
        problems.push('Source child did not acknowledge a clean stop.');
      if (probes.length !== 3 || probes.some((probe) => probe.outcome !== 'available'))
        problems.push('Source readiness probes did not all pass.');
      for (const input of inputs) {
        try {
          const actual = input.file.startsWith('apps/www/')
            ? artifact(root, input.file.slice('apps/www/'.length)).sha256
            : sourceServerHash();
          if (actual !== input.sha256) problems.push(`Source input changed: ${input.file}`);
        } catch (error) {
          problems.push(`Source input unavailable: ${String(error)}`);
        }
      }
      try {
        rmSync(cache, { recursive: true, force: true });
      } catch (error) {
        problems.push(`Source cache cleanup: ${String(error)}`);
      }
      const terminal = {
        finishedAt: now(),
        pid: child.pid ?? null,
        exitCode,
        exitSignal,
        forced,
        stopAcknowledged,
        groupRetired,
        cacheRetired: !lstatSync(cache, { throwIfNoEntry: false }),
        problems,
      };
      writeJson(path.join(directory, 'server.json'), metadata);
      writeJson(path.join(directory, 'probes.json'), probes);
      writeJson(path.join(directory, 'terminal.json'), terminal);
      return {
        evidenceKind: sourceReceipt.evidenceKind,
        suite: SOURCE_CANARY_SUITE,
        sourceHead: source.head,
        sourceServerSha256: sourceServerHash(),
        status: problems.length ? 'failed' : 'passed',
        terminal,
        artifacts: Object.fromEntries(RECEIPTS.map((name) => [name, artifact(directory, name)])),
      };
    });
    return closePromise;
  }
  return { ready, close, pid: child.pid, failureSignal: failure.signal };
}

async function sourceChild() {
  if (!process.send) throw new Error('Source server child requires its owner IPC channel.');
  let server;
  let starting;
  let stopping = false;
  let exitCode = 0;
  let stopGraceMs = 5_000;
  let lifetimeTimer;
  let cacheDirectory;
  let ownerLost = false;
  const retireGroup = () => {
    try {
      if (cacheDirectory) rmSync(cacheDirectory, { recursive: true, force: true });
    } finally {
      try {
        process.kill(-process.pid, 'SIGKILL');
      } finally {
        process.exit(1);
      }
    }
  };
  const send = (message) => {
    if (process.connected)
      process.send(message, (error) => {
        if (error && !stopping) void stop(1);
      });
  };
  const fatal = (error) => {
    exitCode = 1;
    send({ type: 'fatal', error: String(error) });
    void stop(1);
  };
  async function stop(code = 0) {
    exitCode = Math.max(exitCode, code);
    if (stopping) return;
    stopping = true;
    clearTimeout(lifetimeTimer);
    // The owner may have crashed or lost IPC while dev() is still pending.
    // The child retains a second, independent group-retirement deadline.
    const hardStop = setTimeout(retireGroup, stopGraceMs);
    try {
      await starting;
      await server?.stop();
      if (cacheDirectory) rmSync(cacheDirectory, { recursive: true, force: true });
    } catch (error) {
      exitCode = 1;
      send({ type: 'fatal', error: String(error) });
    }
    send({ type: 'stopped' });
    // The API may leave update-check handles alive. Flush logs before retiring
    // the isolated child; the parent also retires its complete process group.
    process.stdout.write('', () =>
      process.stderr.write('', () => {
        clearTimeout(hardStop);
        // A stopped dev API can still have descendants. With no owner left,
        // this child must retire the group instead of relying on parent close().
        if (ownerLost || !process.connected) retireGroup();
        if (process.connected) process.disconnect();
        process.exit(exitCode);
      })
    );
  }
  process.on('SIGTERM', () => void stop(1));
  process.on('SIGINT', () => void stop(1));
  process.on('disconnect', () => {
    ownerLost = true;
    void stop(1);
  });
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
  process.on('message', (message) => {
    if (message?.type === 'stop') return void stop();
    if (message?.type !== 'start' || starting || stopping)
      return fatal('Invalid source child lifecycle command.');
    stopGraceMs = message.stopGraceMs;
    lifetimeTimer = setTimeout(
      () => fatal('Source child lifetime resource deadline exhausted.'),
      Math.max(1, message.deadline - Date.now())
    );
    starting = (async () => {
      const root = realpathSync(message.root);
      cacheDirectory = realpathSync(message.cache);
      const require = createRequire(path.join(root, 'package.json'));
      const entry = require.resolve('astro');
      const packageFile = require.resolve('astro/package.json');
      const packageBytes = readFileSync(packageFile);
      const installed = JSON.parse(packageBytes);
      const astro = {
        version: installed.version,
        api: 'astro.dev (experimental)',
        entry,
        packageFile,
        entrySha256: sha(readFileSync(entry)),
        packageSha256: sha(packageBytes),
      };
      const { dev } = await import(pathToFileURL(entry).href);
      server = await dev({
        root,
        cacheDir: path.join(message.cache, 'astro'),
        server: { host: '127.0.0.1', port: 0, open: false },
        vite: {
          cacheDir: path.join(message.cache, 'vite'),
          server: { host: '127.0.0.1', port: 0, strictPort: true },
          plugins: [
            {
              name: 'sprint3-source-canary-evidence',
              configureServer(vite) {
                vite.httpServer?.once('close', () => {
                  if (!stopping) fatal('Source HTTP server closed unexpectedly.');
                });
                vite.middlewares.use((request, response, next) => {
                  response.once('finish', () =>
                    send({
                      type: 'request',
                      method: request.method,
                      url: request.url,
                      status: response.statusCode,
                    })
                  );
                  next();
                });
              },
            },
          ],
        },
      });
      server.watcher.on('error', fatal);
      if (!stopping)
        send({
          type: 'ready',
          pid: process.pid,
          root,
          address: server.address,
          astro,
          cache: message.cache,
          dotAstroDirectory: path.join(root, '.astro'),
          nodeEnv: process.env.NODE_ENV,
        });
    })();
    starting.catch(fatal);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === self && process.argv[2] === '--child') {
  await sourceChild();
}
