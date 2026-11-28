import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, CDPSession } from 'playwright-core';

const COMMAND_LIMIT_MS = 2_000;
const CPU_INTERVAL_MS = 5_000;
const OWNER_LIMIT_MS = 180_000;
const TRACE_WINDOW_MS = 20_000;
const TRACE_LIMIT_BYTES = 16 * 1024 * 1024;
const TRACE_CHUNK_LIMIT = 256;
const TRACE_CHUNK_TARGET_BYTES = 64 * 1024;
// The 6ccb receipt hit the chunk cap with timeline events before any profile
// facts were retained. Keep one CPU-only window; never restart it.
const TRACE_CATEGORIES = ['disabled-by-default-v8.cpu_profiler'];

export type MatrixTraceTiming = { afterPhase: 'inited-count'; delayMs: number };

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
    traceTiming?: MatrixTraceTiming;
    prepareTraceBeforePhase?: 'inited-count';
  }
) {
  if (!options.enabled)
    return {
      finish: async () => {},
      phaseStarted: (_phase: string, _at?: number) => {},
      preparePhaseTrace: async (_phase: string) => {},
    };
  const startedAt = Date.now();
  const traceTiming = options.traceTiming;
  const beforePhase = options.prepareTraceBeforePhase;
  const deferredTrace = traceTiming !== undefined || beforePhase !== undefined;
  const validTiming =
    (beforePhase === undefined || (beforePhase === 'inited-count' && traceTiming === undefined)) &&
    (traceTiming === undefined ||
      (traceTiming?.afterPhase === 'inited-count' &&
        Number.isSafeInteger(traceTiming.delayMs) &&
        traceTiming.delayMs >= 0 &&
        traceTiming.delayMs <= OWNER_LIMIT_MS - TRACE_WINDOW_MS));
  const directory = join(options.directory, 'demo-matrix', 'browser-diagnostic');
  let finished = false;
  let finishReason: string | null = null;
  let finishPromise: Promise<void> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cpuTimer: ReturnType<typeof setTimeout> | undefined;
  let traceTimer: ReturnType<typeof setTimeout> | undefined;
  let traceStartTimer: ReturnType<typeof setTimeout> | undefined;
  let traceStopPromise: Promise<unknown> | undefined;
  let traceFinishPromise: Promise<void> | undefined;
  let tracePreparation: Promise<void> | undefined;
  let cpuWork: Promise<void> | undefined;
  let cpuSession: CDPSession | undefined;
  let traceSession: CDPSession | undefined;
  let cpuRetired = false;
  let traceRetired = false;
  let traceAccepting = false;
  let traceStartRequested = false;
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
    state: deferredTrace ? 'waiting-for-phase' : 'starting',
    stopReason: null as 'checkpoint' | 'owner-finish' | 'diagnostic-deadline' | null,
    requestedTiming: beforePhase ? { beforePhase } : (traceTiming ?? null),
    preparationPhase: null as string | null,
    preparationRequestedAt: null as string | null,
    phaseStartedAt: null as string | null,
    phaseObservedAt: null as string | null,
    scheduledStartAt: null as string | null,
    startRequestedAt: null as string | null,
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
  if (!validTiming) {
    traceRetired = true;
    trace.state = 'unavailable';
    trace.setupError = trace.error = 'Invalid delayed trace timing';
  }
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
  type TracePayload = ReturnType<typeof header> & {
    partialUntilTerminalReceipt: true;
    traceEvents: ObjectValue[];
  };
  let pendingTrace: TracePayload | undefined;
  let pendingTraceBytes = 0;
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
        requestedWindowMs: TRACE_WINDOW_MS,
        windowOrigin: 'trace start acknowledgement; early stop does not end the CPU/network owner',
        bufferLimitBytes: TRACE_LIMIT_BYTES,
        outputEventLimitBytes: TRACE_LIMIT_BYTES,
        outputChunkLimit: TRACE_CHUNK_LIMIT,
        outputChunkTargetBytes: TRACE_CHUNK_TARGET_BYTES,
        bufferedEvents: pendingTrace?.traceEvents.length ?? 0,
        bufferedBytes: pendingTraceBytes,
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
  const flushTraceChunk = () => {
    if (!pendingTrace) return;
    const payload = pendingTrace;
    pendingTrace = undefined;
    pendingTraceBytes = 0;
    persist(`trace-${String(++trace.chunks).padStart(4, '0')}.json`, payload, true);
  };
  const dataCollected = (event: { value: unknown[] }) => {
    if (!traceAccepting || !Array.isArray(event.value)) return;
    trace.receivedEvents += event.value.length;
    for (const value of event.value) {
      if (trace.outputTruncated) break;
      const entry = traceEvent(value, () => (trace.projectionTruncated = true));
      if (!entry) continue;
      const eventBytes = Buffer.byteLength(JSON.stringify(entry));
      // CDP delivery boundaries are transport details, not output-file bounds.
      // Pack ordered, already-sanitized events within the same total byte and
      // file caps. One indivisible profile event may exceed the chunk target.
      if (pendingTrace && pendingTraceBytes + eventBytes + 1 > TRACE_CHUNK_TARGET_BYTES)
        flushTraceChunk();
      if (!pendingTrace) {
        const payload: TracePayload = {
          ...header(),
          partialUntilTerminalReceipt: true,
          traceEvents: [],
        };
        const headerBytes = Buffer.byteLength(JSON.stringify(payload));
        if (
          trace.chunks >= TRACE_CHUNK_LIMIT ||
          trace.retainedBytes + headerBytes + eventBytes > TRACE_LIMIT_BYTES
        ) {
          trace.outputTruncated = true;
          break;
        }
        pendingTrace = payload;
        pendingTraceBytes = headerBytes;
        trace.retainedBytes += headerBytes;
      }
      const bytes = eventBytes + (pendingTrace.traceEvents.length ? 1 : 0);
      if (trace.retainedBytes + bytes > TRACE_LIMIT_BYTES) {
        trace.outputTruncated = true;
        break;
      }
      pendingTraceBytes += bytes;
      trace.retainedBytes += bytes;
      trace.retainedEvents++;
      pendingTrace.traceEvents.push(entry);
      if (pendingTraceBytes >= TRACE_CHUNK_TARGET_BYTES) flushTraceChunk();
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
    flushTraceChunk();
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
  const endTrace = () => {
    if (traceStopPromise) return traceStopPromise;
    if (!traceSession || !traceStartRequested) return Promise.resolve();
    trace.stopRequestedAt = new Date().toISOString();
    return (traceStopPromise = bounded(
      Promise.all([
        traceSession.send('Tracing.end').then(() => {
          if (!traceAccepting) return;
          trace.stopAcknowledgedAt = new Date().toISOString();
        }),
        traceComplete,
      ]),
      'Browser tracing stop/flush'
    ));
  };
  const finishTrace = (reason: 'checkpoint' | 'owner-finish' | 'diagnostic-deadline') =>
    (traceFinishPromise ??= (async () => {
      traceRetired = true;
      trace.stopReason = reason;
      clearTimeout(traceTimer);
      clearTimeout(traceStartTimer);
      await endTrace().catch((error) => {
        trace.stopError = String(error);
        trace.error ??= trace.stopError;
      });
      flushTraceChunk();
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
    trace.startRequestedAt = new Date().toISOString();
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
  const beginTrace = async () => {
    if (finished || traceRetired) return;
    trace.state = 'starting';
    await bounded(setupTrace(), 'Browser tracing setup').catch((error) => {
      if (finished || traceRetired) return;
      traceRetired = true;
      flushTraceChunk();
      traceAccepting = false;
      trace.state = 'unavailable';
      trace.setupError = String(error);
      trace.error ??= trace.setupError;
      removeTraceListeners();
      void detach(traceSession);
    });
    if (!finished) snapshot();
  };
  const phaseStarted = (phase: string, at = Date.now()) => {
    if (
      finished ||
      !validTiming ||
      (!beforePhase && traceRetired) ||
      trace.phaseStartedAt !== null ||
      phase !== (beforePhase ?? traceTiming?.afterPhase) ||
      options.phase() !== phase
    )
      return;
    if (!Number.isFinite(at) || at < startedAt || at > Date.now()) {
      traceRetired = true;
      trace.state = 'unavailable';
      trace.setupError = trace.error = 'Invalid initialization phase clock';
      snapshot();
      return;
    }
    trace.phaseStartedAt = new Date(at).toISOString();
    trace.phaseObservedAt = new Date().toISOString();
    if (beforePhase) {
      snapshot();
      return;
    }
    if (!traceTiming) return;
    trace.scheduledStartAt = new Date(at + traceTiming.delayMs).toISOString();
    trace.state = 'waiting-for-delay';
    traceStartTimer = setTimeout(
      () => {
        if (finished || traceRetired || Date.now() - startedAt >= OWNER_LIMIT_MS) return;
        if (options.phase() !== traceTiming.afterPhase) {
          traceRetired = true;
          trace.state = 'unavailable';
          trace.setupError = trace.error =
            'The owner left the requested phase before delayed tracing';
          snapshot();
          return;
        }
        void beginTrace();
      },
      Math.max(0, at + traceTiming.delayMs - Date.now())
    );
    snapshot();
  };
  const preparePhaseTrace = (phase: string): Promise<void> => {
    if (finished || traceRetired || !validTiming || phase !== beforePhase) return Promise.resolve();
    if (tracePreparation) return tracePreparation;
    trace.preparationPhase = options.phase();
    trace.preparationRequestedAt = new Date().toISOString();
    snapshot();
    return (tracePreparation = beginTrace());
  };
  snapshot();
  await Promise.all([
    bounded(setupCpu(), 'Process CPU setup').catch((error) => {
      cpuRetired = true;
      cpu.state = 'unavailable';
      cpu.error = String(error);
      void detach(cpuSession);
    }),
    deferredTrace ? Promise.resolve() : beginTrace(),
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
      // An early stop may still own its bounded flush/detach. Share that work
      // before writing the owner's terminal receipt; never stop or restart twice.
      await Promise.all([cpuWork, finishTrace(reason)]);
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
  return { finish: () => finish('owner-finish'), phaseStarted, preparePhaseTrace };
}
