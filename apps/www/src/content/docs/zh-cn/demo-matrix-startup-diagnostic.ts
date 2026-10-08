import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CDPSession, Page, Request, Response } from 'playwright-core';

const PROFILE_WINDOW_MS = 45_000;
const COMMAND_LIMIT_MS = 2_000;
const ROW_LIMIT = 200;
const inert = { finish: async () => {} };

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
    requestedProfileWindowMs: PROFILE_WINDOW_MS,
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
  const finish = () =>
    (finishPromise ??= (async () => {
      finished = true;
      setupRetired = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      page.off('request', request);
      page.off('response', response);
      page.off('requestfinished', requestFinished);
      page.off('requestfailed', requestFailed);
      if (profileStarted && session) {
        try {
          const result = await bounded(session.send('Profiler.stop'), 'Profiler stop');
          // A fresh test context owns this session. Strip URL query/fragment even
          // from public script frames; the profile contains no source/body payload.
          for (const node of result.profile.nodes) {
            try {
              const url = new URL(node.callFrame.url);
              node.callFrame.url = /^https?:$/.test(url.protocol)
                ? `${url.origin}${url.pathname}`
                : '[non-http script]';
            } catch {
              /* Anonymous and browser-internal frames have no URL. */
            }
          }
          profileState = 'captured';
          persist('profile.json', { ...header(), profile: result.profile });
        } catch (error) {
          profileState = 'unavailable';
          profileError = String(error);
        }
      }
      snapshot();
      await detach();
      await bounded(writes, 'Diagnostic writes').catch((error) =>
        console.error('[demo-matrix-startup-diagnostic-write]', String(error))
      );
    })().catch((error) => console.error('[demo-matrix-startup-diagnostic]', String(error))));
  timer = setTimeout(() => {
    void finish();
  }, PROFILE_WINDOW_MS);
  heartbeat = setInterval(snapshot, 5_000);
  return { finish };
}
