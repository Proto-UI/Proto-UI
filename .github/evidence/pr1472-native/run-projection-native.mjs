import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { finished } from 'node:stream/promises';

const sourceRoot = process.cwd();
const output = process.env.PROTO_UI_PROJECTION_EVIDENCE_DIR;
assert(output && path.isAbsolute(output), 'Set an absolute evidence directory.');
assert.equal(process.versions.node.split('.')[0], '24');
assert.equal(process.platform, 'linux');
for (const name of ['PROTO_UI_RUNTIME_PHASE', 'PROTO_UI_RUNTIME_SHARD', 'PROTO_UI_RUNTIME_SLOT', 'PROTO_UI_BROWSER_BASE_URL'])
  assert(!process.env[name], `${name} must be unset for the suite-owned original lifecycle.`);
fs.mkdirSync(output, { recursive: true });
const manifestPath = '.github/evidence/pr1472-native/source-inputs.json';
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
const git = (...args) => {
  const result = spawnSync('git', ['--no-pager', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], { cwd: sourceRoot, timeout: 10_000, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1' } });
  assert(result.status === 0 && result.signal === null && result.error == null,
    `Read-only Git ${args[0]} failed: ${result.stderr}`);
  return result.stdout;
};
const suitePath = 'apps/www/src/content/docs/zh-cn/prototype-projection-scope.browser.test.ts';
const assertionsSource = '.github/evidence/pr1472-native/original-projection.browser.ts';
const readback = label => {
  const files = manifest.files.map(input => {
    const bytes = fs.readFileSync(input.path);
    return { path: input.path, bytes: bytes.length, sha256: sha256(bytes), expectedSha256: input.sha256, matches: bytes.length === input.bytes && sha256(bytes) === input.sha256 };
  });
  const original = [];
  let inside = false;
  let blocks = 0;
  for (const line of fs.readFileSync(suitePath, 'utf8').split(/(?<=\n)/)) {
    if (line.trim() === '// PR1472 native evidence begin') { assert(!inside); inside = true; blocks++; continue; }
    if (line.trim() === '// PR1472 native evidence end') { assert(inside); inside = false; continue; }
    if (!inside) original.push(line);
  }
  assert(!inside && blocks === 21, 'Evidence markers changed.');
  const originalBytes = fs.readFileSync(assertionsSource);
  const originalPreserved = Buffer.from(original.join('')).equals(originalBytes) && sha256(originalBytes) === manifest.originalSuiteSha256;
  const trackedClean = git('diff', '--no-ext-diff', '--no-textconv', '--name-only', 'HEAD', '--').length === 0;
  const result = { label, files, originalPreserved, originalSuiteSha256: sha256(originalBytes), additiveBlocks: blocks, trackedClean };
  json(`source-${label}.json`, result);
  assert(files.every(file => file.matches), 'A frozen input changed.');
  assert(originalPreserved, 'Original assertions, actions or deadlines changed.');
  assert(trackedClean, 'Tracked checkout changed during evidence execution.');
  return result;
};
const command = [process.execPath, 'scripts/test/run-runtime-tests.mjs', suitePath, '--maxWorkers=1', '--minWorkers=1', '--no-file-parallelism', '--reporter=default', '--reporter=json', `--outputFile=${path.join(output, 'vitest-results.json')}`];
const started = process.hrtime.bigint();
const native = { exitObserved: false, closeObserved: false, code: null, signal: null, spawnErrorPresent: false, spawnError: null };
const failures = [];
const secondaryFailures = [];
const signals = [];
const owned = new Map();
const cleanupSignals = [];
let child = null;
let nativeLog = null;
let logFinished = null;
let monitor = null;
let deadlineTimer = null;
let deadlineExpired = false;
let cleanupProbeFailed = false;
let retiring = false;
let remaining = [];
let cleanupComplete = false;
let nativePassed = false;
let acceptanceErrorPresent = false;
let acceptanceError = null;
let firstFailurePresent = false;
let firstFailure = null;
let retire;
const retirementRequested = new Promise(resolve => { retire = resolve; });
const retirementReasons = [];
const describe = error => {
  let message;
  try { message = String(error); } catch { message = '<unprintable thrown value>'; }
  return { errorPresent: true, thrownType: typeof error, message };
};
function requestRetirement(reason) {
  retirementReasons.push({ reason, elapsedSeconds: Number(process.hrtime.bigint() - started) / 1e9 });
  if (!retiring) { retiring = true; retire(); }
}
function recordFailure(phase, error, secondary = false) {
  const record = { phase, ...describe(error) };
  if (secondary) secondaryFailures.push(record);
  else {
    failures.push(record);
    if (!firstFailurePresent) { firstFailurePresent = true; firstFailure = record; }
    requestRetirement(phase);
  }
}
function readProcess(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    return { pid, ppid: Number(fields[1]), group: Number(fields[2]), state: fields[0], start: fields[19] };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ESRCH') return null;
    throw error;
  }
}
function observeOwned() {
  const snapshot = new Map();
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    const record = readProcess(Number(name));
    if (record) snapshot.set(record.pid, record);
  }
  const queue = [];
  if (child?.pid && !native.exitObserved) queue.push(child.pid);
  for (const record of owned.values()) {
    const current = snapshot.get(record.pid);
    if (current?.start === record.start && !['Z', 'X'].includes(current.state)) queue.push(record.pid);
  }
  const visited = new Set();
  while (queue.length) {
    const parentPid = queue.shift();
    if (visited.has(parentPid)) continue;
    visited.add(parentPid);
    const current = snapshot.get(parentPid);
    const previous = owned.get(parentPid);
    if (!current || (previous && previous.start !== current.start)) continue;
    owned.set(parentPid, current);
    for (const record of snapshot.values()) if (record.ppid === parentPid) queue.push(record.pid);
  }
}
function observeForCleanup() {
  try { observeOwned(); }
  catch (error) { cleanupProbeFailed = true; recordFailure('cleanup-process-observation', error, true); }
}
function liveOwned() {
  const live = [];
  for (const record of owned.values()) {
    try {
      const current = readProcess(record.pid);
      if (current?.start === record.start && !['Z', 'X'].includes(current.state)) live.push(current);
    } catch (error) {
      cleanupProbeFailed = true;
      recordFailure(`cleanup-process-${record.pid}`, error, true);
    }
  }
  return live;
}
function signalOwned(signal) {
  observeForCleanup();
  let supervisorGroup = null;
  try { supervisorGroup = readProcess(process.pid)?.group ?? null; }
  catch (error) { cleanupProbeFailed = true; recordFailure('cleanup-supervisor-identity', error, true); }
  const groups = new Set();
  for (const record of liveOwned()) {
    try {
      // A still-identical owned member proves that this process group has not
      // been retired and reused. Never signal the supervisor's own group.
      const current = readProcess(record.pid);
      if (!current || current.start !== record.start) continue;
      const group = current.group;
      if (supervisorGroup !== null && group > 0 && group !== supervisorGroup) {
        if (groups.has(group)) continue;
        groups.add(group);
        process.kill(-group, signal);
        cleanupSignals.push({ group, witnessPid: record.pid, witnessStart: record.start, signal });
      } else {
        process.kill(record.pid, signal);
        cleanupSignals.push({ pid: record.pid, start: record.start, signal });
      }
    } catch (error) {
      if (error?.code !== 'ESRCH') recordFailure('cleanup-signal', error, true);
    }
  }
  // The direct ChildProcess handle remains owned even when /proc admission
  // failed. This fallback never targets a reaped, separately reused PID.
  if (child && !native.exitObserved) {
    try { child.kill(signal); } catch (error) { recordFailure('cleanup-direct-child', error, true); }
  }
}
async function settles(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), milliseconds); })]);
  } finally { clearTimeout(timer); }
}
async function retireOwned() {
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    signalOwned(signal);
    const until = performance.now() + 5_000;
    do {
      observeForCleanup();
      remaining = liveOwned();
      if (remaining.length === 0 && native.exitObserved) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (performance.now() < until);
    if (remaining.length === 0 && native.exitObserved) break;
  }
  remaining = liveOwned();
  cleanupComplete = !cleanupProbeFailed && remaining.length === 0 && native.exitObserved;
}
const signalHandlers = new Map();
let closePromise = Promise.resolve();
let closeResolve;
let pipeClosureComplete = false;
let logClosureComplete = false;
try {
  const head = git('rev-parse', 'HEAD').toString().trim();
  const parent = git('rev-parse', 'HEAD^').toString().trim();
  assert.equal(parent, manifest.baseCommit, 'The carrier must have the exact diagnostic source parent.');
  assert.equal(git('rev-parse', `${parent}^{tree}`).toString().trim(), manifest.baseTree);
  if (process.env.GITHUB_SHA) assert.equal(head, process.env.GITHUB_SHA);
  json('launch.json', { head, parent, tree: git('rev-parse', 'HEAD^{tree}').toString().trim(), manifestSha256: sha256(manifestBytes), command, node: process.version, nodeExecutable: process.execPath, sourceRoot, workflow: '.github/workflows/browser-suite-repair-evidence.yml', runId: process.env.GITHUB_RUN_ID, eventName: process.env.GITHUB_EVENT_NAME, sandbox: 'Unmodified browser-harness chromiumSandbox:true' });
  fs.copyFileSync(manifestPath, path.join(output, 'source-inputs.json'));
  readback('before');
  const absoluteDeadline = Number(process.env.PROTO_UI_NATIVE_DEADLINE_EPOCH_MS);
  assert(Number.isFinite(absoluteDeadline) && absoluteDeadline > 0, 'The workflow must supply its finite evidence deadline.');
  const remainingLifetime = Math.min(540_000, absoluteDeadline - Date.now());
  assert(remainingLifetime > 0, 'The existing job evidence budget expired before native launch.');
  nativeLog = fs.createWriteStream(path.join(output, 'native.log'), { flags: 'wx' });
  nativeLog.on('error', error => recordFailure('native-log-stream', error));
  logFinished = finished(nativeLog).then(() => true, error => { recordFailure('native-log-finish', error, true); return false; });
  child = spawn(command[0], command.slice(1), { cwd: sourceRoot, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  closePromise = new Promise(resolve => { closeResolve = resolve; });
  child.once('error', error => {
    native.spawnErrorPresent = true;
    native.spawnError = describe(error);
    requestRetirement('native-spawn-error');
  });
  child.once('exit', (code, signal) => {
    native.exitObserved = true;
    native.code = code;
    native.signal = signal;
    requestRetirement('native-direct-exit');
  });
  child.once('close', () => { native.closeObserved = true; closeResolve(); });
  for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
    stream?.on('error', error => recordFailure(`native-${name}-stream`, error));
    stream?.on('data', bytes => {
      try {
        if (!nativeLog.destroyed && !nativeLog.write(bytes)) {
          child.stdout?.pause(); child.stderr?.pause();
          nativeLog.once('drain', () => { if (!retiring) { child.stdout?.resume(); child.stderr?.resume(); } });
        }
      } catch (error) { recordFailure('native-log-write', error); }
      // Console delivery is best effort and never gates retirement or receipts.
      const destination = name === 'stdout' ? process.stdout : process.stderr;
      try { if (!destination.destroyed && destination.writableLength < 65_536) destination.write(bytes); }
      catch (error) { recordFailure(`forward-${name}`, error); }
    });
  }
  for (const [name, stream] of [['stdout', process.stdout], ['stderr', process.stderr]]) {
    const handler = error => recordFailure(`forward-${name}-stream`, error);
    stream.on('error', handler);
  }
  observeOwned();
  monitor = setInterval(() => { try { observeOwned(); } catch (error) { recordFailure('process-observation', error); } }, 200);
  deadlineTimer = setTimeout(() => { deadlineExpired = true; requestRetirement('native-lifetime-deadline'); }, remainingLifetime);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = () => { signals.push(signal); requestRetirement(`received-${signal}`); };
    signalHandlers.set(signal, handler); process.on(signal, handler);
  }
  // Direct exit, signal, stream/proc failure or deadline enters finally. An
  // inherited output pipe cannot make teardown wait for ChildProcess.close.
  await retirementRequested;
} catch (error) {
  recordFailure('launched-lifetime', error);
} finally {
  clearInterval(monitor);
  clearTimeout(deadlineTimer);
  try { if (child) await retireOwned(); else cleanupComplete = true; }
  catch (error) { cleanupProbeFailed = true; cleanupComplete = false; recordFailure('owned-retirement', error, true); }
  try {
    pipeClosureComplete = !child || await settles(closePromise, 2_000);
    if (!pipeClosureComplete) {
      recordFailure('native-pipe-drain-deadline', new Error('Native stdio did not close after owned retirement.'), true);
      child.stdout?.destroy(); child.stderr?.destroy();
    }
  } catch (error) { recordFailure('native-pipe-retention', error, true); }
  try {
    if (nativeLog) {
      if (!nativeLog.destroyed) nativeLog.end();
      const completed = await settles(logFinished, 2_000);
      logClosureComplete = completed && await logFinished;
      if (!completed) { recordFailure('native-log-drain-deadline', new Error('Native log completion exceeded its bound.'), true); nativeLog.destroy(); }
    }
  } catch (error) { recordFailure('native-log-retention', error, true); }
  try { readback('after'); } catch (error) { recordFailure('source-after', error); }
  try {
    assert(native.exitObserved && native.closeObserved, 'A complete native outcome is missing.');
    assert.equal(native.spawnErrorPresent, false);
    assert.equal(native.signal, null);
    assert.equal(native.code, 0, 'The original native file failed; preserve its exact report.');
    assert.equal(firstFailurePresent, false, 'Supervisor failure is separate from the native result.');
    assert.equal(secondaryFailures.length, 0, 'Secondary stream/cleanup/retention failures remain.');
    assert.equal(deadlineExpired, false);
    assert.equal(signals.length, 0);
    assert(cleanupComplete && pipeClosureComplete && logClosureComplete, 'Native cleanup or output retention is incomplete.');
    const report = JSON.parse(fs.readFileSync(path.join(output, 'vitest-results.json'), 'utf8'));
    const assertions = (report.testResults ?? []).flatMap(file => file.assertionResults ?? []);
    assert.equal(assertions.length, 5, 'The entire five-case file must execute.');
    assert.deepEqual(assertions.map(item => item.title).sort(), [...manifest.expectedTestNames].sort());
    assert(assertions.every(item => item.status === 'passed'), 'Failed/skipped/unexecuted cases are not acceptance.');
    const observations = fs.readFileSync(path.join(output, 'observations.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    for (const item of observations) {
      assert(item.snapshotCaptured && item.snapshotWritten && item.screenshotWritten && item.failures.length === 0, 'A raw observation or paired screenshot is incomplete.');
      assert(typeof item.png === 'string' && typeof item.json === 'string');
      assert(fs.statSync(path.join(output, item.png)).size > 0);
      assert(fs.statSync(path.join(output, item.json)).size > 0);
    }
    assert(!fs.existsSync(path.join(output, 'capture-errors.ndjson')), 'A required evidence capture failed.');
    const snapshots = observations.map(item => JSON.parse(fs.readFileSync(path.join(output, item.json), 'utf8')));
    const cells = snapshots.filter(item => item.stage === 'matrix-coordinate-complete');
    assert.equal(cells.length, 8);
    assert.deepEqual(cells.map(item => `${item.extra.coordinate.runtimeId}/${item.extra.coordinate.projectionFamilyId}`).sort(), ['wc','react','vue','vue2'].flatMap(runtime => ['shadcn','brutalist'].map(family => `${runtime}/${family}`)).sort());
    for (const stage of ['family-immediate-seal', 'runtime-immediate-seal', 'family-seal-complete', 'runtime-seal-complete'])
      assert.equal(snapshots.filter(item => item.stage === stage).length, 1, `Missing atomic ${stage}`);
    assert.deepEqual(snapshots.filter(item => item.stage === 'semantic-focus-restored').map(item => item.extra.control).sort(), ['family', 'runtime']);
    const pages = fs.readFileSync(path.join(output, 'pages.ndjson'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(pages.length, 6, 'Five original cases include two independent theme contexts.');
    assert.deepEqual(snapshots.filter(item => item.stage === 'case-final').map(item => item.id).sort((a,b)=>a-b), pages.map(item => item.id).sort((a,b)=>a-b));
    assert(snapshots.some(item => item.snapshot.events.some(event => event.type === 'click' && event.isTrusted === true)), 'No observed browser-native click.');
    nativePassed = true;
  } catch (error) {
    acceptanceErrorPresent = true; acceptanceError = describe(error);
  } finally {
    const cleanup = { trackedProcesses: [...owned.values()], cleanupSignals, remaining, cleanupProbeFailed, complete: cleanupComplete, pipeClosureComplete, logClosureComplete };
    try { json('cleanup.json', cleanup); }
    catch (error) { nativePassed = false; recordFailure('cleanup-receipt', error, true); }
    const exitCode = nativePassed ? 0 : (Number.isInteger(native.code) && native.code !== 0 ? native.code : (deadlineExpired ? 124 : 1));
    const terminal = { ...native, signals, retirementReasons, deadlineExpired,
      elapsedSeconds: Number(process.hrtime.bigint() - started) / 1e9,
      firstFailurePresent, firstFailure, failures, secondaryFailures,
      acceptanceErrorPresent, acceptanceError, cleanupComplete, pipeClosureComplete, logClosureComplete,
      nativePassed, exitCode, consoleDelivery: 'Best effort; does not gate cleanup, receipts or exit.' };
    try { json('terminal.json', terminal); }
    catch (error) {
      nativePassed = false;
      try { json('terminal-retention-error.json', { terminalReceiptError: describe(error), terminal }); }
      catch { /* Unwritable evidence remains a nonzero outcome; no pipe can gate exit. */ }
    }
    for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
    // All canonical file writes were attempted first. Never wait for an
    // inherited pipe or blocked console channel to permit process termination.
    process.exit(nativePassed ? 0 : (exitCode === 0 ? 1 : exitCode));
  }
}
