import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, CDPSession, Page, Request, Response } from 'playwright-core';
import {
  startMatrixBrowserDiagnostic,
  type MatrixTraceTiming,
} from './demo-matrix-browser-diagnostic';

// Initialization and the case retain their original acceptance deadlines.
// This independent diagnostic owner remains capped at 180s from setup.
const PROFILE_WINDOW_MS = 180_000;
// A blocked renderer can prevent the final stop from returning any profile.
// Retain earlier bounded chunks without ending the owner's diagnostic window.
const PROFILE_CHUNK_MS = 20_000;
const COMMAND_LIMIT_MS = 2_000;
const ROW_LIMIT = 200;
const inert = {
  finish: async () => {},
  phaseStarted: (_phase: string, _at?: number) => {},
  preparePhaseTrace: async (_phase: string) => {},
};

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
    ownedBrowser?: Browser;
    traceTiming?: MatrixTraceTiming;
    prepareTraceBeforePhase?: 'inited-count';
  }
) {
  if (!options.enabled) return inert;
  // A browser trace owns its CPU sampling channel. Do not start a second
  // page profiler on the same isolate, including after browser setup failure.
  const pageProfilerEnabled = !options.ownedBrowser;
  const browserDiagnostic = options.ownedBrowser
    ? startMatrixBrowserDiagnostic(options.ownedBrowser, options).catch((error) => {
        console.error('[demo-matrix-browser-diagnostic]', String(error));
        return inert;
      })
    : Promise.resolve(inert);
  const startedAt = Date.now();
  const file = join(options.directory, 'demo-matrix', 'startup-profile');
  let session: CDPSession | undefined;
  let profileStarted = false;
  let setupCompleted = false;
  let profileStartedAt: number | null = null;
  let profileStopRequestedAt: number | null = null;
  let profileStoppedAt: number | null = null;
  let profileDurationMs: number | null = null;
  type StopReason = 'checkpoint' | 'owner-finish' | 'diagnostic-deadline';
  let stopReason: StopReason | null = null;
  let finishReason: Exclude<StopReason, 'checkpoint'> | null = null;
  let setupRetired = false;
  let profileState = pageProfilerEnabled ? 'starting' : 'disabled-for-browser-trace';
  let profileError: string | null = null;
  let finished = false;
  let finishPromise: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chunkTimer: ReturnType<typeof setTimeout> | undefined;
  let chunkWork: Promise<void> | undefined;
  let chunkSequence = 0;
  const chunks: Array<{
    sequence: number;
    file: string | null;
    state: 'captured' | 'unavailable';
    phase: string;
    startAcknowledgedAt: string | null;
    stopRequestedAt: string;
    stopAcknowledgedAt: string | null;
    sampledDurationMs: number | null;
    stopReason: StopReason;
    error: string | null;
  }> = [];
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let writes: Promise<void> = Promise.resolve();
  const tracked = new WeakMap<Request, { path: string; type: string; elapsedMs: number }>();
  const pending = new Map<Request, { path: string; type: string; elapsedMs: number }>();
  const counts = { requested: 0, responses: 0, finished: 0, failed: 0, ignoredOtherOrigins: 0 };
  const statuses: Record<string, number> = {};
  const failures: Array<{ path: string; elapsedMs: number; error: string | null }> = [];
  let truncated = false;
  const header = () => ({
    startedAt: new Date(startedAt).toISOString(),
    profileMode: pageProfilerEnabled ? 'page-profiler' : 'browser-trace',
    requestedProfileWindowMs: PROFILE_WINDOW_MS,
    requestedChunkIntervalMs: PROFILE_CHUNK_MS,
    chunkSequence,
    chunks: [...chunks],
    finishReason,
    samplingGaps: 'Profiler stop/restart gaps are not sampled; inspect each chunk clock.',
    profileTiming: {
      startAcknowledgedAt:
        profileStartedAt === null ? null : new Date(profileStartedAt).toISOString(),
      stopRequestedAt:
        profileStopRequestedAt === null ? null : new Date(profileStopRequestedAt).toISOString(),
      stopAcknowledgedAt:
        profileStoppedAt === null ? null : new Date(profileStoppedAt).toISOString(),
      sampledDurationMs: profileDurationMs,
      stopReason,
      ownerStoppedCapture:
        setupCompleted && profileState === 'captured' && stopReason === 'owner-finish',
      phaseCoverage: 'requires-timestamp-reconciliation',
    },
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
  const snapshot = () =>
    persist('status.json', {
      ...header(),
      finished,
      profileState,
      profileError,
      network: {
        ...counts,
        statuses: { ...statuses },
        pending: [...pending.values()],
        failures: [...failures],
        truncated,
      },
    });
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
    counts.requested++;
    if (pending.size < ROW_LIMIT) pending.set(entry, row);
    else truncated = true;
  };
  const response = (entry: Response) => {
    if (!tracked.has(entry.request())) return;
    counts.responses++;
    const status = String(entry.status());
    statuses[status] = (statuses[status] ?? 0) + 1;
  };
  const requestFinished = (entry: Request) => {
    if (!tracked.has(entry)) return;
    counts.finished++;
    pending.delete(entry);
  };
  const requestFailed = (entry: Request) => {
    const row = tracked.get(entry);
    if (!row) return;
    counts.failed++;
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
    profileStartedAt = Date.now();
    if (setupRetired) return detach();
    profileState = 'recording';
  };
  if (pageProfilerEnabled)
    await bounded(setup(), 'Profiler setup').catch((error) => {
      setupRetired = true;
      profileState = 'unavailable';
      profileError = String(error);
      void detach();
    });
  setupCompleted = profileState === 'recording';
  snapshot();
  const capture = async (reason: StopReason) => {
    if (!profileStarted || !session) return;
    // A timed-out stop has unknown protocol state. Never issue a duplicate
    // stop or restart that might attach a late response to a new chunk.
    profileStarted = false;
    stopReason = reason;
    profileStopRequestedAt = Date.now();
    const sequence = ++chunkSequence;
    const receipt: (typeof chunks)[number] = {
      sequence,
      file: null,
      state: 'unavailable',
      phase: options.phase(),
      startAcknowledgedAt:
        profileStartedAt === null ? null : new Date(profileStartedAt).toISOString(),
      stopRequestedAt: new Date(profileStopRequestedAt).toISOString(),
      stopAcknowledgedAt: null,
      sampledDurationMs: null,
      stopReason: reason,
      error: null,
    };
    try {
      const result = await bounded(session.send('Profiler.stop'), 'Profiler stop');
      profileStoppedAt = Date.now();
      const { startTime, endTime } = result.profile;
      profileDurationMs =
        Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime
          ? (endTime - startTime) / 1000
          : null;
      // A fresh test context owns this session. Strip URL query/fragment even
      // from public script frames; the profile contains no source/body payload.
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
      profileState = 'captured';
      receipt.state = 'captured';
      receipt.file = 'profile-' + String(sequence).padStart(4, '0') + '.json';
      receipt.stopAcknowledgedAt = new Date(profileStoppedAt).toISOString();
      receipt.sampledDurationMs = profileDurationMs;
      chunks.push(receipt);
      const captured = { ...header(), profile: result.profile };
      persist(receipt.file, captured);
      // Compatibility alias to the latest successful chunk. Its own stop
      // reason/clock and terminal status prevent it implying a complete window.
      persist('profile.json', captured);
    } catch (error) {
      profileState = 'unavailable';
      profileError = String(error);
      receipt.error = profileError;
      chunks.push(receipt);
    }
  };
  const restart = async () => {
    const current = session;
    if (!current || finished || setupRetired) return;
    await current.send('Profiler.start');
    if (finished || setupRetired) {
      await bounded(current.detach(), 'Profiler late restart detach').catch(() => {});
      return;
    }
    profileStarted = true;
    profileStartedAt = Date.now();
    profileStopRequestedAt = null;
    profileStoppedAt = null;
    profileDurationMs = null;
    stopReason = null;
    profileState = 'recording';
    profileError = null;
  };
  const scheduleChunk = () => {
    if (finished || !profileStarted) return;
    chunkTimer = setTimeout(() => {
      if (finished || Date.now() - startedAt >= PROFILE_WINDOW_MS) return;
      chunkWork = (async () => {
        await capture('checkpoint');
        if (!finished && !setupRetired && profileState === 'captured') {
          await bounded(restart(), 'Profiler restart').catch((error) => {
            setupRetired = true;
            profileState = 'unavailable';
            profileError = String(error);
          });
        }
        snapshot();
      })().finally(() => {
        chunkWork = undefined;
        scheduleChunk();
      });
    }, PROFILE_CHUNK_MS);
  };
  const finish = (reason: 'owner-finish' | 'diagnostic-deadline') =>
    (finishPromise ??= (async () => {
      finished = true;
      finishReason = reason;
      setupRetired = true;
      clearTimeout(timer);
      clearTimeout(chunkTimer);
      clearInterval(heartbeat);
      page.off('request', request);
      page.off('response', response);
      page.off('requestfinished', requestFinished);
      page.off('requestfailed', requestFailed);
      const finishBrowser = browserDiagnostic
        .then((diagnostic) => diagnostic.finish())
        .catch((error) => console.error('[demo-matrix-browser-diagnostic]', String(error)));
      // An in-flight checkpoint already owns its bounded stop/restart. Let it
      // settle without starting another protocol operation for the same owner.
      await chunkWork;
      await capture(reason);
      snapshot();
      await Promise.all([detach(), finishBrowser]);
      // Bound the caller, not the underlying filesystem: an outstanding write
      // can settle later, with the terminal receipt still last in this queue.
      await bounded(writes, 'Diagnostic writes').catch((error) =>
        console.error('[demo-matrix-startup-diagnostic-write]', String(error))
      );
    })().catch((error) => console.error('[demo-matrix-startup-diagnostic]', String(error))));
  timer = setTimeout(
    () => {
      void finish('diagnostic-deadline');
    },
    Math.max(0, PROFILE_WINDOW_MS - (Date.now() - startedAt))
  );
  heartbeat = setInterval(snapshot, 5_000);
  if (setupCompleted) scheduleChunk();
  // Resolve the independent CPU owner during diagnostic setup, so the later
  // pre-initialization trace call has only its original single 2s setup bound.
  const preparedBrowser = options.prepareTraceBeforePhase ? await browserDiagnostic : undefined;
  return {
    finish: () => finish('owner-finish'),
    preparePhaseTrace(phase: string) {
      if (finished) return Promise.resolve();
      return preparedBrowser?.preparePhaseTrace(phase) ?? Promise.resolve();
    },
    phaseStarted(phase: string) {
      const at = Date.now();
      if (finished) return;
      void browserDiagnostic.then((diagnostic) => {
        if (!finished) diagnostic.phaseStarted(phase, at);
      });
    },
  };
}
