import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, CDPSession } from 'playwright-core';

const COMMAND_LIMIT_MS = 2_000;
const CPU_INTERVAL_MS = 5_000;
const OWNER_LIMIT_MS = 180_000;
const TRACE_WINDOW_MS = 20_000;
const TRACE_LIMIT_BYTES = 16 * 1024 * 1024;
const TRACE_CHUNK_LIMIT = 256;
// The 6ccb receipt hit the chunk cap with timeline events before any profile
// facts were retained. Keep one bounded CPU-only window; never restart it.
const TRACE_CATEGORIES = ['disabled-by-default-v8.cpu_profiler'];

async function bounded<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
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

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ObjectValue)
    : undefined;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown, limit = 256) =>
  typeof value === 'string' ? value.slice(0, limit) : undefined;
const publicUrl = (value: unknown) => {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    return /^https?:$/.test(url.protocol)
      ? `${url.origin}${url.pathname}`.slice(0, 2_048)
      : '[non-http script]';
  } catch {
    return '[unresolved script]';
  }
};

/** Only timing, process/thread names and script-frame/profile facts survive.
 * Never retain arbitrary trace arguments, source text, screenshots or request payloads. */
function traceEvent(value: unknown, truncated: () => void): ObjectValue | undefined {
  const source = object(value);
  if (!source) return;
  const result: ObjectValue = {};
  for (const key of ['name', 'cat', 'ph', 'scope', 's']) {
    if (typeof source[key] === 'string') result[key] = text(source[key]);
  }
  for (const key of ['pid', 'tid', 'ts', 'dur', 'tdur', 'tts']) {
    if (finite(source[key])) result[key] = source[key];
  }
  if (finite(source.id) || typeof source.id === 'string') result.id = text(source.id) ?? source.id;
  const array = (input: unknown, map: (entry: unknown) => unknown) => {
    if (!Array.isArray(input)) return undefined;
    if (input.length > 20_000) truncated();
    return input
      .slice(0, 20_000)
      .map(map)
      .filter((entry) => entry !== undefined);
  };
  const numbers = (input: unknown) => array(input, (entry) => (finite(entry) ? entry : undefined));
  const frame = (input: unknown) => {
    const sourceFrame = object(input);
    if (!sourceFrame) return undefined;
    return {
      functionName: text(sourceFrame.functionName),
      scriptId: text(sourceFrame.scriptId),
      url: publicUrl(sourceFrame.url),
      lineNumber: finite(sourceFrame.lineNumber) ? sourceFrame.lineNumber : undefined,
      columnNumber: finite(sourceFrame.columnNumber) ? sourceFrame.columnNumber : undefined,
    };
  };
  const args = object(source.args);
  if (!args) return result;
  const keptArgs: ObjectValue = {};
  if (source.ph === 'M' && ['thread_name', 'process_name'].includes(String(source.name)))
    keptArgs.name = text(args.name);
  const data = object(args.data);
  if (data) {
    const kept: ObjectValue = {};
    for (const key of ['startTime', 'endTime', 'lineNumber', 'columnNumber', 'nodeId']) {
      if (finite(data[key])) kept[key] = data[key];
    }
    if (typeof data.functionName === 'string') kept.functionName = text(data.functionName);
    if (typeof data.url === 'string') kept.url = publicUrl(data.url);
    if (typeof data.scriptId === 'string') kept.scriptId = text(data.scriptId);
    if (Array.isArray(data.stackTrace)) kept.stackTrace = array(data.stackTrace, frame);
    for (const key of ['timeDeltas', 'lines']) {
      if (Array.isArray(data[key])) kept[key] = numbers(data[key]);
    }
    const profile = object(data.cpuProfile);
    if (profile) {
      kept.cpuProfile = {
        nodes: array(profile.nodes, (value) => {
          const node = object(value);
          if (!node || !finite(node.id)) return undefined;
          return {
            id: node.id,
            parent: finite(node.parent) ? node.parent : undefined,
            hitCount: finite(node.hitCount) ? node.hitCount : undefined,
            callFrame: frame(node.callFrame),
            children: numbers(node.children),
          };
        }),
        samples: numbers(profile.samples),
      };
    }
    if (Object.keys(kept).length) keptArgs.data = kept;
  }
  if (Object.keys(keptArgs).length) result.args = keptArgs;
  return result;
}

/** The caller must supply its newly launched, exclusive test Browser. These
 * browser-wide probes must never attach to a user's browser or shared session. */
export async function startMatrixBrowserDiagnostic(
  ownedBrowser: Browser,
  options: {
    enabled: boolean;
    directory: string;
    sourceSha: string;
    caseName: string;
    phase(): string;
    traceStartPhase?: 'inited-count';
  }
) {
  if (!options.enabled) return { finish: async () => {} };
  const startedAt = Date.now();
  const directory = join(options.directory, 'demo-matrix', 'browser-diagnostic');
  let finished = false;
  let finishReason: string | null = null;
  let finishPromise: Promise<void> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cpuTimer: ReturnType<typeof setTimeout> | undefined;
  let traceTimer: ReturnType<typeof setTimeout> | undefined;
  let tracePhaseTimer: ReturnType<typeof setTimeout> | undefined;
  let traceSetupWork: Promise<void> | undefined;
  let traceFinishPromise: Promise<void> | undefined;
  let cpuWork: Promise<void> | undefined;
  let cpuSession: CDPSession | undefined;
  let traceSession: CDPSession | undefined;
  let cpuRetired = false;
  let traceRetired = false;
  let traceAccepting = false;
  let traceStartRequested = false;
  let traceStopRequested = false;
  let writes: Promise<void> = Promise.resolve();
  const detachWork = new WeakMap<CDPSession, Promise<void>>();
  const cpu = {
    state: 'starting',
    sampleCount: 0,
    error: null as string | null,
    detachState: 'not-requested',
    intervalMs: CPU_INTERVAL_MS,
    unit: 'cumulative CPU seconds across every thread of each process since its start',
    attribution: 'process id/type only; neither JavaScript-only time nor a function diagnosis',
  };
  const trace = {
    state: 'starting',
    stopReason: null as 'checkpoint' | 'owner-finish' | 'diagnostic-deadline' | null,
    startAcknowledgedAt: null as string | null,
    stopRequestedAt: null as string | null,
    stopAcknowledgedAt: null as string | null,
    completeAt: null as string | null,
    dataLossOccurred: null as boolean | null,
    error: null as string | null,
    setupError: null as string | null,
    stopError: null as string | null,
    detachState: 'not-requested',
    receivedEvents: 0,
    retainedEvents: 0,
    retainedBytes: 0,
    chunks: 0,
    outputTruncated: false,
    projectionTruncated: false,
    bufferUsage: null as ObjectValue | null,
  };
  let completeTrace: () => void = () => {};
  const traceComplete = new Promise<void>((resolve) => (completeTrace = resolve));
  const header = () => ({
    sourceSha: options.sourceSha,
    caseName: options.caseName,
    startedAt: new Date(startedAt).toISOString(),
    at: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    phase: options.phase(),
    diagnosticOnly: true,
    samplingIsNotPerformanceAcceptance: true,
  });
  const persist = (name: string, value: unknown, compact = false) => {
    const data = JSON.stringify(value, null, compact ? undefined : 2);
    writes = writes
      .then(async () => {
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, name), data);
      })
      .catch((error) => console.error('[matrix-browser-diagnostic-write]', String(error)));
  };
  const snapshot = () =>
    persist('status.json', {
      ...header(),
      finished,
      finishReason,
      commandLimitMs: COMMAND_LIMIT_MS,
      ownerLimitMs: OWNER_LIMIT_MS,
      cpu: { ...cpu },
      trace: {
        ...trace,
        requestedStartPhase: options.traceStartPhase ?? 'immediate',
        requestedWindowMs: TRACE_WINDOW_MS,
        windowOrigin: 'trace start acknowledgement; early stop does not end the CPU/network owner',
        bufferLimitBytes: TRACE_LIMIT_BYTES,
        outputEventLimitBytes: TRACE_LIMIT_BYTES,
        outputChunkLimit: TRACE_CHUNK_LIMIT,
        categories: TRACE_CATEGORIES,
        argumentProjection:
          'timing, thread/process names, script frames and CPU profile facts only',
        clock:
          'event ts/dur use Chromium monotonic microseconds; receipt clocks use host wall time',
        flush: 'dataCollected is delivered when stopped; partial output is not a complete window',
        completionMeaning:
          'end acknowledged and tracingComplete received; not complete phase or readiness acceptance',
      },
    });
  const detach = async (session: CDPSession | undefined) => {
    if (!session) return;
    const existing = detachWork.get(session);
    if (existing) return existing;
    const state = session === cpuSession ? cpu : trace;
    state.detachState = 'pending';
    const work = bounded(session.detach(), 'Browser diagnostic detach').then(
      () => {
        state.detachState = 'detached';
      },
      () => {
        state.detachState = 'unavailable';
      }
    );
    detachWork.set(session, work);
    return work;
  };
  const dataCollected = (event: { value: unknown[] }) => {
    if (!traceAccepting || !Array.isArray(event.value)) return;
    trace.receivedEvents += event.value.length;
    if (trace.chunks >= TRACE_CHUNK_LIMIT) trace.outputTruncated = true;
    const events: ObjectValue[] = [];
    const payload = { ...header(), partialUntilTerminalReceipt: true, traceEvents: events };
    let chunkBytes = Buffer.byteLength(JSON.stringify(payload));
    for (const value of event.value) {
      if (trace.outputTruncated) break;
      const entry = traceEvent(value, () => (trace.projectionTruncated = true));
      if (!entry) continue;
      const bytes = Buffer.byteLength(JSON.stringify(entry)) + (events.length ? 1 : 0);
      if (trace.retainedBytes + chunkBytes + bytes > TRACE_LIMIT_BYTES) {
        trace.outputTruncated = true;
        break;
      }
      chunkBytes += bytes;
      trace.retainedEvents++;
      events.push(entry);
    }
    if (events.length) {
      trace.retainedBytes += chunkBytes;
      persist(`trace-${String(++trace.chunks).padStart(4, '0')}.json`, payload, true);
    }
    snapshot();
  };
  const bufferUsage = (event: ObjectValue) => {
    if (!traceAccepting) return;
    trace.bufferUsage = Object.fromEntries(
      ['percentFull', 'eventCount', 'value']
        .filter((key) => finite(event[key]))
        .map((key) => [key, event[key]])
    );
    snapshot();
  };
  const tracingComplete = (event: { dataLossOccurred: boolean }) => {
    if (!traceAccepting) return;
    trace.completeAt = new Date().toISOString();
    trace.dataLossOccurred = event.dataLossOccurred;
    completeTrace();
    snapshot();
  };
  const removeTraceListeners = () => {
    traceSession?.off('Tracing.dataCollected', dataCollected);
    traceSession?.off('Tracing.bufferUsage', bufferUsage);
    traceSession?.off('Tracing.tracingComplete', tracingComplete);
  };
  const endTrace = async () => {
    if (!traceSession || !traceStartRequested || traceStopRequested) return;
    traceStopRequested = true;
    trace.stopRequestedAt = new Date().toISOString();
    await bounded(
      Promise.all([
        traceSession.send('Tracing.end').then(() => {
          if (!traceAccepting) return;
          trace.stopAcknowledgedAt = new Date().toISOString();
        }),
        traceComplete,
      ]),
      'Browser tracing stop/flush'
    );
  };
  const finishTrace = (reason: 'checkpoint' | 'owner-finish' | 'diagnostic-deadline') =>
    (traceFinishPromise ??= (async () => {
      traceRetired = true;
      trace.stopReason = reason;
      clearTimeout(traceTimer);
      await endTrace().catch((error) => {
        trace.stopError = String(error);
        trace.error ??= trace.stopError;
      });
      traceAccepting = false;
      removeTraceListeners();
      trace.state =
        trace.completeAt && trace.stopAcknowledgedAt
          ? 'complete'
          : trace.startAcknowledgedAt || trace.retainedEvents
            ? 'partial'
            : 'unavailable';
      await detach(traceSession);
      snapshot();
    })());
  const sampleCpu = async () => {
    if (finished || cpuRetired || !cpuSession) return;
    const requestedAt = new Date().toISOString();
    try {
      const response = await bounded(cpuSession.send('SystemInfo.getProcessInfo'), 'Process CPU');
      if (finished || cpuRetired) return;
      const processes = response.processInfo.filter(
        (entry) => finite(entry.id) && finite(entry.cpuTime) && entry.cpuTime >= 0
      );
      persist(`cpu-${String(++cpu.sampleCount).padStart(4, '0')}.json`, {
        ...header(),
        requestedAt,
        processes: processes.map(({ id, type, cpuTime }) => ({
          id,
          type: text(type, 64),
          cpuTime,
        })),
      });
      cpu.state = 'sampling';
    } catch (error) {
      if (finished || cpuRetired) return;
      cpuRetired = true;
      cpu.state = 'unavailable';
      cpu.error = String(error);
      void detach(cpuSession);
    }
    snapshot();
  };
  const scheduleCpu = () => {
    if (finished || cpuRetired) return;
    cpuTimer = setTimeout(() => {
      cpuWork = sampleCpu().finally(() => {
        cpuWork = undefined;
        scheduleCpu();
      });
    }, CPU_INTERVAL_MS);
  };
  const setupCpu = async () => {
    cpuSession = await ownedBrowser.newBrowserCDPSession();
    if (finished || cpuRetired) return detach(cpuSession);
    cpuWork = sampleCpu().finally(() => {
      cpuWork = undefined;
      scheduleCpu();
    });
  };
  const setupTrace = async () => {
    traceSession = await ownedBrowser.newBrowserCDPSession();
    if (finished || traceRetired) return detach(traceSession);
    traceAccepting = true;
    traceSession.on('Tracing.dataCollected', dataCollected);
    traceSession.on('Tracing.bufferUsage', bufferUsage);
    traceSession.on('Tracing.tracingComplete', tracingComplete);
    traceStartRequested = true;
    await traceSession.send('Tracing.start', {
      transferMode: 'ReportEvents',
      bufferUsageReportingInterval: CPU_INTERVAL_MS,
      traceConfig: {
        recordMode: 'recordContinuously',
        traceBufferSizeInKb: TRACE_LIMIT_BYTES / 1024,
        includedCategories: TRACE_CATEGORIES,
        excludedCategories: ['*'],
        enableSampling: true,
      },
    });
    if (finished || traceRetired) {
      await endTrace().catch(() => {});
      return detach(traceSession);
    }
    trace.startAcknowledgedAt = new Date().toISOString();
    trace.state = 'recording';
    traceTimer = setTimeout(() => void finishTrace('checkpoint'), TRACE_WINDOW_MS);
    snapshot();
  };
  const beginTrace = () =>
    (traceSetupWork ??= bounded(setupTrace(), 'Browser tracing setup').catch((error) => {
      traceRetired = true;
      traceAccepting = false;
      trace.state = 'unavailable';
      trace.setupError = String(error);
      trace.error ??= trace.setupError;
      removeTraceListeners();
      void detach(traceSession);
    }));
  const awaitTracePhase = () => {
    if (finished || traceRetired) return;
    if (!options.traceStartPhase || options.phase() === options.traceStartPhase) {
      void beginTrace();
      return;
    }
    trace.state = 'waiting-for-phase';
    tracePhaseTimer = setTimeout(awaitTracePhase, 50);
  };
  snapshot();
  await Promise.all([
    bounded(setupCpu(), 'Process CPU setup').catch((error) => {
      cpuRetired = true;
      cpu.state = 'unavailable';
      cpu.error = String(error);
      void detach(cpuSession);
    }),
    options.traceStartPhase ? Promise.resolve(awaitTracePhase()) : beginTrace(),
  ]);
  snapshot();
  const finish = (reason: 'owner-finish' | 'diagnostic-deadline') =>
    (finishPromise ??= (async () => {
      finished = true;
      finishReason = reason;
      cpuRetired = true;
      traceRetired = true;
      clearTimeout(deadline);
      clearTimeout(cpuTimer);
      clearTimeout(tracePhaseTimer);
      // An early stop may still own its bounded flush/detach. Share that work
      // before writing the owner's terminal receipt; never stop or restart twice.
      await Promise.all([cpuWork, traceSetupWork, finishTrace(reason)]);
      if (cpu.state !== 'unavailable') cpu.state = cpu.sampleCount ? 'captured' : 'unavailable';
      await Promise.all([detach(cpuSession), detach(traceSession)]);
      snapshot();
      await bounded(writes, 'Browser diagnostic writes').catch((error) =>
        console.error('[matrix-browser-diagnostic-write]', String(error))
      );
    })());
  deadline = setTimeout(
    () => void finish('diagnostic-deadline'),
    Math.max(0, OWNER_LIMIT_MS - (Date.now() - startedAt))
  );
  return { finish: () => finish('owner-finish') };
}
