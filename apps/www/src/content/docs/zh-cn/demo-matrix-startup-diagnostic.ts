import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CDPSession, Page, Request, Response } from 'playwright-core';

const PROFILE_WINDOW_MS = 45_000;
const PARTIAL_PROFILE_WINDOW_MS = 5_000;
const COMMAND_LIMIT_MS = 2_000;
const ROW_LIMIT = 200;
const inert = { finish: async () => {}, checkpoint: () => {} };

async function bounded<T>(pending: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} unavailable within ${COMMAND_LIMIT_MS}ms`)),
          COMMAND_LIMIT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Opt-in diagnostic only. No DOM evaluation, request routing, readiness writes,
 * input injection or acceptance decision. Sampling overhead is not a performance receipt. */
export async function startMatrixStartupDiagnostic(
  page: Page,
  options: {
    enabled: boolean;
    directory: string;
    sourceSha: string;
    caseName: string;
    origin: string;
    phase(): string;
  }
) {
  if (!options.enabled) return inert;
  const startedAt = Date.now();
  const file = join(options.directory, 'demo-matrix', 'startup-profile');
  let session: CDPSession | undefined;
  let profileStarted = false;
  let setupRetired = false;
  let profileState = 'starting';
  let profileError: string | null = null;
  let finished = false;
  let finishPromise: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let partialTimer: ReturnType<typeof setTimeout> | undefined;
  let partialCapture: Promise<void> = Promise.resolve();
  let partialProfileState = 'pending';
  let partialProfileError: string | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let writes: Promise<void> = Promise.resolve();
  const tracked = new WeakMap<Request, { path: string; type: string; elapsedMs: number }>();
  const pending = new Map<Request, { path: string; type: string; elapsedMs: number }>();
  const counts = { requested: 0, responses: 0, finished: 0, failed: 0, ignoredOtherOrigins: 0 };
  const statuses: Record<string, number> = {};
  const failures: Array<{ path: string; elapsedMs: number; error: string | null }> = [];
  const slowestResources: Array<{
    path: string;
    type: string;
    elapsedMs: number;
    durationMs: number;
  }> = [];
  const timeline: Array<{
    elapsedMs: number;
    phase: string;
    requested: number;
    finished: number;
    failed: number;
    outstanding: number;
  }> = [];
  let lastNetworkEventMs: number | null = null;
  let truncated = false;
  const header = () => ({
    startedAt: new Date(startedAt).toISOString(),
    requestedProfileWindowMs: PROFILE_WINDOW_MS,
    requestedPartialProfileWindowMs: PARTIAL_PROFILE_WINDOW_MS,
    sourceSha: options.sourceSha,
    caseName: options.caseName,
    diagnosticOnly: true,
    samplingIsNotPerformanceAcceptance: true,
    phase: options.phase(),
    at: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
  });
  const persist = (name: string, value: unknown) => {
    // Serialize writes to prevent an older heartbeat from replacing the terminal receipt.
    const json = JSON.stringify(value, null, 2);
    writes = writes
      .then(async () => {
        await mkdir(file, { recursive: true });
        await writeFile(join(file, name), json);
      })
      .catch((error) => console.error('[demo-matrix-startup-diagnostic-write]', String(error)));
  };
  const snapshot = () => {
    if (timeline.length < ROW_LIMIT)
      timeline.push({
        elapsedMs: Date.now() - startedAt,
        phase: options.phase(),
        requested: counts.requested,
        finished: counts.finished,
        failed: counts.failed,
        outstanding: counts.requested - counts.finished - counts.failed,
      });
    persist('status.json', {
      ...header(),
      finished,
      profileState,
      profileError,
      partialProfileState,
      partialProfileError,
      timeline: [...timeline],
      network: {
        ...counts,
        statuses: { ...statuses },
        pending: [...pending.values()],
        failures: [...failures],
        outstanding: counts.requested - counts.finished - counts.failed,
        lastEventElapsedMs: lastNetworkEventMs,
        slowestResources: [...slowestResources],
        truncated,
      },
    });
  };
  const request = (entry: Request) => {
    let url: URL;
    try {
      url = new URL(entry.url());
    } catch {
      return;
    }
    if (url.origin !== options.origin) {
      counts.ignoredOtherOrigins++;
      return;
    }
    // Keep public resource paths only: never bodies, headers, query, fragments or credentials.
    const row = {
      path: url.pathname,
      type: entry.resourceType(),
      elapsedMs: Date.now() - startedAt,
    };
    tracked.set(entry, row);
    lastNetworkEventMs = row.elapsedMs;
    counts.requested++;
    if (pending.size < ROW_LIMIT) pending.set(entry, row);
    else truncated = true;
  };
  const response = (entry: Response) => {
    if (!tracked.has(entry.request())) return;
    counts.responses++;
    lastNetworkEventMs = Date.now() - startedAt;
    const status = String(entry.status());
    statuses[status] = (statuses[status] ?? 0) + 1;
  };
  const requestFinished = (entry: Request) => {
    const row = tracked.get(entry);
    if (!row) return;
    counts.finished++;
    lastNetworkEventMs = Date.now() - startedAt;
    slowestResources.push({ ...row, durationMs: lastNetworkEventMs - row.elapsedMs });
    slowestResources.sort((a, b) => b.durationMs - a.durationMs);
    if (slowestResources.length > ROW_LIMIT) slowestResources.pop();
    pending.delete(entry);
  };
  const requestFailed = (entry: Request) => {
    const row = tracked.get(entry);
    if (!row) return;
    counts.failed++;
    lastNetworkEventMs = Date.now() - startedAt;
    pending.delete(entry);
    if (failures.length < ROW_LIMIT)
      failures.push({
        path: row.path,
        elapsedMs: Date.now() - startedAt,
        error: entry.failure()?.errorText?.slice(0, 200) ?? null,
      });
    else truncated = true;
  };
  page.on('request', request);
  page.on('response', response);
  page.on('requestfinished', requestFinished);
  page.on('requestfailed', requestFailed);
  snapshot();
  const detach = async () => {
    if (session) await bounded(session.detach(), 'Profiler detach').catch(() => {});
  };
  const setup = async () => {
    session = await page.context().newCDPSession(page);
    if (setupRetired) return detach();
    await session.send('Profiler.enable');
    if (setupRetired) return detach();
    await session.send('Profiler.setSamplingInterval', { interval: 10_000 });
    if (setupRetired) return detach();
    await session.send('Profiler.start');
    profileStarted = true;
    if (setupRetired) return detach();
    profileState = 'recording';
  };
  await bounded(setup(), 'Profiler setup').catch((error) => {
    setupRetired = true;
    profileState = 'unavailable';
    profileError = String(error);
    void detach();
  });
  snapshot();
  const capture = async (name: string) => {
    if (!profileStarted || !session) return;
    // A timed-out stop is never retried on the same recording.
    profileStarted = false;
    const requestedAt = Date.now() - startedAt;
    const result = await bounded(session.send('Profiler.stop'), 'Profiler stop');
    // Retain only public script URLs, with no credentials, query, fragment,
    // relative sourceURL text or non-HTTP source payload.
    for (const node of result.profile.nodes) {
      try {
        const url = new URL(node.callFrame.url);
        node.callFrame.url = /^https?:$/.test(url.protocol)
          ? `${url.origin}${url.pathname}`
          : '[non-http script]';
      } catch {
        node.callFrame.url = '[unresolved script]';
      }
    }
    persist(name, {
      ...header(),
      stopRequestedElapsedMs: requestedAt,
      stopCompletedElapsedMs: Date.now() - startedAt,
      profile: result.profile,
    });
  };
  const finish = () =>
    (finishPromise ??= (async () => {
      finished = true;
      if (partialProfileState === 'pending') partialProfileState = 'not-requested';
      setupRetired = true;
      clearTimeout(timer);
      clearTimeout(partialTimer);
      clearInterval(heartbeat);
      page.off('request', request);
      page.off('response', response);
      page.off('requestfinished', requestFinished);
      page.off('requestfailed', requestFailed);
      await partialCapture;
      if (profileStarted && session) {
        try {
          await capture('profile.json');
          profileState = 'captured';
        } catch (error) {
          profileState = 'unavailable';
          profileError = String(error);
        }
      }
      snapshot();
      await detach();
      // Bound the caller, not the underlying filesystem: an outstanding write
      // can settle later, with the terminal receipt still last in this queue.
      await bounded(writes, 'Diagnostic writes').catch((error) =>
        console.error('[demo-matrix-startup-diagnostic-write]', String(error))
      );
    })().catch((error) => console.error('[demo-matrix-startup-diagnostic]', String(error))));
  timer = setTimeout(() => {
    void finish();
  }, PROFILE_WINDOW_MS);
  partialTimer = setTimeout(() => {
    if (!profileStarted || !session) return;
    partialProfileState = 'capturing';
    partialCapture = (async () => {
      try {
        await capture('partial-profile.json');
        partialProfileState = 'captured';
        profileState = 'captured-partial';
        // Persist before requesting more renderer work. A later renderer stall
        // must not discard the already returned early recording.
        snapshot();
        await bounded(writes, 'Partial diagnostic writes');
        if (finished) return;
        await bounded(session.send('Profiler.start'), 'Profiler restart');
        profileStarted = true;
        profileState = 'recording';
      } catch (error) {
        if (partialProfileState !== 'captured') {
          partialProfileState = 'unavailable';
          partialProfileError = String(error);
        }
        profileState = 'unavailable';
        profileError = String(error);
      }
      snapshot();
    })();
  }, PARTIAL_PROFILE_WINDOW_MS);
  // Runner-clock observations remain available when DOM/CDP commands stall.
  // Durations are request-event timings, not proof of module evaluation or paint.
  heartbeat = setInterval(snapshot, 5_000);
  return { finish, checkpoint: snapshot };
}
