import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const worker = fileURLToPath(new URL('./tabs-worker.mjs', import.meta.url));
async function liveGroup(pgid) {
  // Playwright launches Chromium in its own process group. A worker-group kill
  // alone does not stop it. Record/kill both groups, exclude dead zombie rows.
  const { stdout } = await exec('/bin/ps', ['-axo', 'pid=,pgid=,stat=']);
  return stdout
    .trim()
    .split('\n')
    .map((line) => {
      const [pid, group, state] = line.trim().split(/\s+/);
      return { pid: Number(pid), group: Number(group), state };
    })
    .filter((p) => p.group === pgid && !p.state.startsWith('Z'));
}
function killGroup(pid) {
  try {
    process.kill(-pid, 'SIGKILL');
    return 'signal-sent';
  } catch (e) {
    return e.code === 'ESRCH' ? 'absent' : `signal-error:${e.code}`;
  }
}

/** POSIX deadline wrapper; not an OS sandbox for hostile submissions. Registered
 * Chromium group is separately killed because Playwright detaches it. Unknown
 * escaped process groups, crash reporters or exploits are not isolation proof.
 */
export async function boundedTabs({ htmlPath, evidenceDir, chromiumPath, wallMs = 45000 }) {
  assert.ok(process.platform !== 'win32', 'This candidate requires POSIX process groups');
  assert.ok(Number.isSafeInteger(wallMs) && wallMs >= 100 && wallMs <= 120000);
  assert.ok(path.isAbsolute(evidenceDir) && path.isAbsolute(chromiumPath));
  assert.ok((await stat(htmlPath)).size <= 1_000_000, 'HTML exceeds 1MB input bound');
  const html = await readFile(htmlPath);
  assert.ok(html.length <= 1_000_000, 'HTML exceeds 1MB input bound');
  await mkdir(evidenceDir); // Exclusive new run; do not overwrite an old result.
  const save = (name, data) => writeFile(path.join(evidenceDir, name), data, { flag: 'wx' });
  await save('submission.html', html);
  const browserPidFile = path.join(evidenceDir, 'browser.pid');
  const launcher = path.join(evidenceDir, 'chromium-launcher.sh');
  await writeFile(
    launcher,
    '#!/bin/sh\nprintf "%s\\n" "$$" > "$PROTO_BENCH_PID_FILE"\nexec "$PROTO_BENCH_CHROMIUM" "$@"\n',
    { flag: 'wx', mode: 0o700 }
  );
  await save(
    'worker-config.json',
    JSON.stringify({
      htmlPath: path.join(evidenceDir, 'submission.html'),
      evidenceDir,
      chromiumPath,
      chromiumLauncher: launcher,
    })
  );
  const receipt = {
    schemaVersion: 1,
    kind: 'proto-ui.posix-tabs-worker',
    origin: 'public-development',
    admission: 'not-admitted',
    started: new Date().toISOString(),
    finished: null,
    inputSha256: createHash('sha256').update(html).digest('hex'),
    wallMs,
    outcome: 'blocked',
    deadlineExceeded: false,
    workerPid: null,
    browserPid: null,
    exitCode: null,
    signal: null,
    logsTruncated: false,
    cleanup: [],
    signalAttempts: [],
    cleanupScope:
      'Registered worker and Chromium process groups only; not OS sandbox or escaped-group proof',
    partialEvidence:
      'All files in evidenceDir retained, including input and progress; incomplete trace is not a completed trace',
  };
  await save('worker-start.json', JSON.stringify(receipt, null, 2) + '\n');
  const child = spawn(process.execPath, [worker, path.join(evidenceDir, 'worker-config.json')], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Do not inherit model credentials or caller-specific agent configuration.
    env: {
      PATH: '/usr/bin:/bin',
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR || '/private/tmp',
      PROTO_BENCH_CHROMIUM: chromiumPath,
      PROTO_BENCH_PID_FILE: browserPidFile,
    },
  });
  receipt.workerPid = child.pid ?? null;
  const logs = { stdout: [], stderr: [] };
  let logBytes = 0;
  for (const name of Object.keys(logs))
    child[name].on('data', (chunk) => {
      const part = chunk.subarray(0, Math.max(0, 1_000_000 - logBytes));
      if (part.length) logs[name].push(part);
      logBytes += part.length;
      if (part.length < chunk.length) receipt.logsTruncated = true;
    });
  let timer, deadlineCleanup;
  const attempted = new Set();
  const signalOnce = (pid) => {
    if (attempted.has(pid)) return;
    attempted.add(pid);
    receipt.signalAttempts.push({ group: pid, result: killGroup(pid) });
  };
  const killRegistered = async () => {
    if (child.pid) signalOnce(child.pid);
    try {
      const raw = (await readFile(browserPidFile, 'utf8')).trim();
      assert.match(raw, /^[1-9][0-9]*$/);
      receipt.browserPid = Number(raw);
      signalOnce(receipt.browserPid);
    } catch (e) {
      if (e.code !== 'ENOENT') receipt.cleanupError = e.message;
    }
  };
  const closed = new Promise((resolve) => {
    child.once('error', (e) => {
      receipt.spawnError = e.message;
    });
    child.once('close', (code, signal) => {
      receipt.exitCode = code;
      receipt.signal = signal;
      resolve();
    });
  });
  timer = setTimeout(() => {
    receipt.deadlineExceeded = true;
    deadlineCleanup = killRegistered().catch((e) => {
      receipt.cleanupError = e.message;
    });
  }, wallMs);
  await closed;
  clearTimeout(timer);
  await deadlineCleanup;
  await killRegistered();
  // A brief bounded polling window lets killed group members settle; never call
  // cleanup complete merely because signal submission succeeded.
  for (const pid of [receipt.workerPid, receipt.browserPid].filter(Boolean)) {
    let live = [];
    for (let i = 0; i < 20; i++) {
      live = await liveGroup(pid);
      if (!live.length) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    receipt.cleanup.push({
      group: pid,
      status: live.length ? 'unverified-live-processes' : 'no-live-group-members',
      live,
    });
  }
  receipt.outcome = receipt.deadlineExceeded
    ? 'aborted'
    : receipt.exitCode === 0
      ? 'completed'
      : 'blocked';
  if (receipt.cleanupError || receipt.cleanup.some((c) => c.live.length))
    receipt.outcome = 'blocked';
  receipt.finished = new Date().toISOString();
  for (const name of Object.keys(logs)) await save(`worker-${name}.log`, Buffer.concat(logs[name]));
  await save('worker-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
