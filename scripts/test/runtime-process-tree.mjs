import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const execFileAsync = promisify(execFile);

// Read identities as well as PIDs: a sampled descendant must not give us
// permission to kill a later, unrelated process that reuses its PID.
export async function readProcessTable() {
  const { stdout } = await execFileAsync(
    'ps',
    ['-e', '-o', 'pid=,ppid=,pgid=,stat=,rss=,lstart=,comm='],
    { timeout: 2_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } }
  );
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(
        /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/
      );
      if (!match) throw new Error(`Unrecognized process-table row: ${line}`);
      const [, pid, ppid, pgid, state, rssKiB, started, command] = match;
      return {
        pid: Number(pid),
        ppid: Number(ppid),
        pgid: Number(pgid),
        state,
        rssKiB: Number(rssKiB),
        started: started.replace(/\s+/g, ' '),
        command,
      };
    });
}

/** Own one child spawned with detached:true on POSIX, including after its exit. */
export function ownProcessTree(
  child,
  { label, graceMs = 5_000, killWaitMs = 2_000, sampleMs = 500 } = {}
) {
  const pid = child.pid;
  const observed = new Map();
  let known = new Map();
  let rootBound = false;
  let groupContinuous = false;
  const snapshots = [];
  const observationErrors = [];
  const identityErrors = new Set();
  let peakRssKiB = 0;
  let inFlight = null;
  let stopping = null;

  const capture = () => {
    if (process.platform === 'win32' || !pid) return Promise.resolve([]);
    inFlight ??= readProcessTable()
      .then((table) => {
        const owned = new Map(
          table
            .filter((row) => known.get(row.pid)?.started === row.started)
            .map((row) => [row.pid, row])
        );
        // Bind the root while its direct ChildProcess handle still owns the
        // live PID. A number that reappears after exit is not a new grant.
        if (!rootBound && child.exitCode === null && child.signalCode === null) {
          const root = table.find((row) => row.pid === pid && row.pgid === pid);
          if (root) {
            rootBound = true;
            groupContinuous = true;
            owned.set(root.pid, root);
          }
        }
        if (!rootBound && table.some((row) => row.pgid === pid))
          identityErrors.add(
            'Cannot bind the exited producer to this process-group identity; refusing signals.'
          );
        // Membership is useful only while at least one previously owned
        // identity anchors that group. A vanished group cannot be reacquired
        // by its numeric PGID, even if an unrelated leader uses the same PID.
        groupContinuous &&= [...owned.values()].some((row) => row.pgid === pid);
        if (groupContinuous) for (const row of table) if (row.pgid === pid) owned.set(row.pid, row);
        let changed;
        do {
          changed = false;
          for (const row of table) {
            if (!owned.has(row.pid) && owned.has(row.ppid)) {
              owned.set(row.pid, row);
              changed = true;
            }
          }
        } while (changed);
        known = owned;
        for (const row of owned.values()) observed.set(row.pid, row);
        // Zombies have already stopped executing and cannot hold browser sockets
        // or memory. Their eventual wait()/reaping belongs to their OS parent.
        const live = [...owned.values()].filter((row) => !row.state.startsWith('Z'));
        const rssKiB = live.reduce((sum, row) => sum + row.rssKiB, 0);
        peakRssKiB = Math.max(peakRssKiB, rssKiB);
        snapshots.push({ at: new Date().toISOString(), rssKiB, processes: [...owned.values()] });
        if (snapshots.length > 20) snapshots.shift();
        return live;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
  const sample = () =>
    capture().catch((error) => {
      observationErrors.push(error.message);
      if (observationErrors.length > 5) observationErrors.shift();
    });
  // Observe descendants that start their own group (for example browsers)
  // while their ancestry is still available, before an early leader exit.
  const timer = process.platform !== 'win32' && pid ? setInterval(sample, sampleMs) : null;
  timer?.unref();
  void sample();

  const stop = () => {
    stopping ??= (async () => {
      clearInterval(timer);
      const receipt = {
        label,
        pid: pid ?? null,
        pgid: process.platform === 'win32' ? null : (pid ?? null),
        platform: process.platform,
        startedAt: new Date().toISOString(),
        signals: [],
        errors: [],
        verified: false,
        verificationScope: 'continuously anchored private group and observed descendant identities',
        remaining: [],
      };
      if (!pid) {
        // No PID means spawn failed: there is no acquired process to release.
        receipt.verified = true;
      } else if (process.platform === 'win32') {
        // Preserve the native Windows tree operation. taskkill cannot prove
        // that children of an already-exited root were found; expose that limit.
        try {
          await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
            windowsHide: true,
            timeout: graceMs + killWaitMs,
          });
          receipt.signals.push({ signal: 'taskkill /T /F', target: pid });
        } catch (error) {
          if (child.exitCode === null && child.signalCode === null)
            receipt.errors.push(error.message);
        }
        receipt.verification =
          'Windows taskkill result; descendant exit not independently observed';
      } else {
        const signal = (rows, name) => {
          // Only this child's private group may receive a negative-PID signal.
          // Descendants that moved groups receive identity-checked PID signals.
          const targets = new Set(
            rows.map((row) => (groupContinuous && row.pgid === pid ? -pid : row.pid))
          );
          for (const target of targets) {
            try {
              process.kill(target, name);
              receipt.signals.push({ signal: name, target });
            } catch (error) {
              if (error.code !== 'ESRCH')
                receipt.errors.push(`${name} ${target}: ${error.message}`);
            }
          }
        };
        const wait = async (duration) => {
          const deadline = Date.now() + duration;
          let live = await capture();
          while (live.length && Date.now() < deadline) {
            await delay(Math.min(50, Math.max(1, deadline - Date.now())));
            live = await capture();
          }
          return live;
        };
        try {
          signal(await capture(), 'SIGTERM');
          let live = await wait(graceMs);
          if (live.length) {
            signal(live, 'SIGKILL');
            live = await wait(killWaitMs);
          }
          receipt.remaining = live;
          receipt.errors.push(...identityErrors);
          receipt.verified = live.length === 0 && receipt.errors.length === 0;
        } catch (error) {
          receipt.errors.push(error.message);
        }
      }
      return {
        ...receipt,
        finishedAt: new Date().toISOString(),
        peakRssKiB,
        observationErrors,
        observedPids: [...observed.keys()],
        snapshots,
      };
    })();
    return stopping;
  };
  return { capture, stop };
}
