/** Read-only native-call attribution for the opt-in Matrix diagnostic context.
 * It never supplies an eligibility result, changes an argument, or catches a
 * native exception. Bounded console records survive an unavailable page RPC. */
export function installMatrixEntryCostDiagnostic() {
  const prototype = Element.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'checkVisibility');
  if (!descriptor || typeof descriptor.value !== 'function' || !descriptor.configurable)
    return () => {};
  const native = descriptor.value;
  const start = performance.now();
  let last = start;
  let calls = 0;
  let elapsedMs = 0;
  let emitted = 0;
  let exceptions = 0;
  const groups = new Map<string, { calls: number; elapsedMs: number; maxMs: number }>();
  const slowest: Array<{
    tag: string;
    ref: string | null;
    demo: string | null;
    elapsedMs: number;
  }> = [];
  const attribute = prototype.getAttribute;
  const closest = prototype.closest;
  const info = console.info.bind(console);
  const targets = new Set([
    'pui-s3-light-content-a-0',
    'pui-s3-split-content-a-0',
    'pui-s3-mixed-content-a-0',
    'pui-s5-light-panel-a-0',
    'pui-s5-split-panel-a-0',
    'pui-s5-mixed-panel-a-0',
  ]);
  type Frame = {
    kind: 'mutation' | 'microtask' | 'direct';
    callback: string;
    trace: Error;
    observer?: number;
    recordCount?: number;
    records?: MutationRecord[];
  };
  type Context = { frames: Frame[]; droppedFrames: number };
  type Summary = {
    kind: Frame['kind'];
    callback: string;
    source: string[];
    observer?: number;
    recordCount?: number;
    recordsTruncated?: boolean;
    records?: Array<{ type: string; attribute: string | null; target: string; count: number }>;
  };
  let active = true;
  let current: Context | null = null;
  let observerSerial = 0;
  let droppedCauseCalls = 0;
  const summaries = new WeakMap<Frame, Summary>();
  const causes = new Map<
    string,
    {
      calls: number;
      nativeElapsedMs: number;
      maxMs: number;
      targets: Record<string, number>;
      frames: Summary[];
      droppedFrames: number;
      recordInputs: Map<
        string,
        { type: string; attribute: string | null; target: string; visibilityCalls: number }
      >;
      droppedRecordInputCalls: number;
    }
  >();
  const callbackName = (callback: Function) => {
    try {
      return String(callback.name || '(anonymous)').slice(0, 80);
    } catch {
      return '(unavailable)';
    }
  };
  const extend = (parent: Context | null, frame: Frame): Context => ({
    // Keep the original cause and the latest two continuations when deeper
    // scheduling exceeds the four-frame cap. No callback or input is skipped.
    frames:
      parent && parent.frames.length >= 4
        ? [parent.frames[0]!, ...parent.frames.slice(-2), frame]
        : [...(parent?.frames ?? []), frame],
    droppedFrames: (parent?.droppedFrames ?? 0) + (parent && parent.frames.length >= 4 ? 1 : 0),
  });
  const inContext = (
    context: Context | null,
    callback: Function,
    receiver: unknown,
    args: unknown[]
  ) => {
    const previous = current;
    current = context;
    try {
      return Reflect.apply(callback, receiver, args);
    } finally {
      current = previous;
    }
  };
  const summarize = (frame: Frame): Summary => {
    const cached = summaries.get(frame);
    if (cached) return cached;
    const stack = String(frame.trace.stack ?? '')
      .split('\n')
      .slice(1);
    const publicFrames = stack.filter((line) => /https?:\/\/|\/[^ ]+\.[cm]?[jt]sx?:\d/.test(line));
    const summary: Summary = {
      kind: frame.kind,
      callback: frame.callback,
      source: (publicFrames.length ? publicFrames : stack)
        .slice(0, 3)
        .map((line) => line.slice(0, 240)),
      ...(frame.observer === undefined ? {} : { observer: frame.observer }),
    };
    if (frame.records) {
      const recordGroups = new Map<string, NonNullable<Summary['records']>[number]>();
      for (const record of frame.records) {
        const target =
          record.target.nodeType === 1
            ? (record.target as Element).localName
            : record.target.nodeType === 3
              ? '#text'
              : record.target.nodeType === 9
                ? '#document'
                : '#other';
        const attribute = record.attributeName;
        const key = `${record.type}|${attribute ?? ''}|${target}`;
        if (!recordGroups.has(key) && recordGroups.size >= 8) continue;
        const row = recordGroups.get(key) ?? { type: record.type, attribute, target, count: 0 };
        row.count++;
        recordGroups.set(key, row);
      }
      summary.recordCount = frame.recordCount;
      summary.recordsTruncated =
        (frame.recordCount ?? 0) > frame.records.length ||
        [...recordGroups.values()].reduce((sum, row) => sum + row.count, 0) < frame.records.length;
      summary.records = [...recordGroups.values()];
    }
    summaries.set(frame, summary);
    return summary;
  };
  const restores: Array<() => void> = [];
  const capabilities = { mutationObserver: false, queueMicrotask: false };
  const replaceGlobal = (key: 'MutationObserver' | 'queueMicrotask', value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    if (original && !original.configurable && (!('value' in original) || !original.writable))
      return false;
    Object.defineProperty(globalThis, key, {
      configurable: original?.configurable ?? true,
      enumerable: original?.enumerable ?? true,
      writable: 'writable' in (original ?? {}) ? original!.writable : true,
      value,
    });
    restores.push(() => {
      if (Object.getOwnPropertyDescriptor(globalThis, key)?.value !== value) return;
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
    return true;
  };
  try {
    const Observer = globalThis.MutationObserver;
    if (typeof Observer === 'function') {
      const observed = new Proxy(Observer, {
        construct(target, args, newTarget) {
          const callback = args[0];
          if (!active || emitted >= 18 || typeof callback !== 'function')
            return Reflect.construct(target, args, newTarget);
          const observer = ++observerSerial;
          const registration = new Error();
          const name = callbackName(callback);
          const wrapped = function (this: unknown, ...callbackArgs: unknown[]) {
            if (!active || emitted >= 18) return Reflect.apply(callback, this, callbackArgs);
            let context: Context | null = null;
            try {
              const records = callbackArgs[0] as MutationRecord[];
              context = extend(current, {
                kind: 'mutation',
                callback: name,
                observer,
                trace: registration,
                recordCount: records.length,
                records: records.slice(0, 32),
              });
            } catch {
              // Attribution failure cannot suppress the original callback.
            }
            return inContext(context, callback, this, callbackArgs);
          };
          return Reflect.construct(target, [wrapped, ...args.slice(1)], newTarget);
        },
      });
      capabilities.mutationObserver = replaceGlobal('MutationObserver', observed);
    }
  } catch {
    // An unavailable/immutable diagnostic surface does not block the page.
  }
  try {
    const enqueue = globalThis.queueMicrotask;
    if (typeof enqueue === 'function') {
      const queued = function (this: unknown, ...args: unknown[]) {
        const callback = args[0];
        if (!active || emitted >= 18 || typeof callback !== 'function')
          return Reflect.apply(enqueue, this, args);
        let context: Context | null = null;
        try {
          context = extend(current, {
            kind: 'microtask',
            callback: callbackName(callback),
            trace: new Error(),
          });
        } catch {
          // A failed diagnostic allocation must not lose the scheduled work.
        }
        const wrapped = function (this: unknown, ...callbackArgs: unknown[]) {
          if (!active || emitted >= 18) return Reflect.apply(callback, this, callbackArgs);
          return inContext(context, callback, this, callbackArgs);
        };
        return Reflect.apply(enqueue, this, [wrapped, ...args.slice(1)]);
      };
      capabilities.queueMicrotask = replaceGlobal('queueMicrotask', queued);
    }
  } catch {
    // The original scheduler remains authoritative when wrapping is unavailable.
  }
  const wrapper = function (this: Element, ...args: unknown[]) {
    if (emitted >= 18) return Reflect.apply(native, this, args);
    const before = performance.now();
    let failed = true;
    try {
      const value = Reflect.apply(native, this, args);
      failed = false;
      return value;
    } finally {
      // Observation must never replace the native result or native exception.
      try {
        const after = performance.now();
        const cost = after - before;
        calls += 1;
        elapsedMs += cost;
        if (failed) exceptions += 1;
        if (this instanceof Element) {
          const tag = this.localName;
          const ref = attribute.call(this, 'data-demo-ref');
          const key = `${tag}|${ref ?? ''}`;
          if (groups.has(key) || groups.size < 256) {
            const group = groups.get(key) ?? { calls: 0, elapsedMs: 0, maxMs: 0 };
            group.calls += 1;
            group.elapsedMs += cost;
            group.maxMs = Math.max(group.maxMs, cost);
            groups.set(key, group);
          }
          if (targets.has(tag)) {
            const context =
              current ??
              extend(null, {
                kind: 'direct',
                callback: '(direct visibility read)',
                trace: new Error(),
              });
            const frames = context.frames.map(summarize);
            // Varying batch sizes are observations of one origin, not new
            // origins. Keep cumulative categories and the latest bounded
            // sample without filling the origin cap during initial hydration.
            const causeKey = JSON.stringify({
              frames: frames.map(({ kind, callback, source, observer }) => ({
                kind,
                callback,
                source,
                observer,
              })),
              droppedFrames: context.droppedFrames,
            });
            if (causes.has(causeKey) || causes.size < 64) {
              const cause: NonNullable<ReturnType<typeof causes.get>> = causes.get(causeKey) ?? {
                calls: 0,
                nativeElapsedMs: 0,
                maxMs: 0,
                targets: {},
                frames,
                droppedFrames: context.droppedFrames,
                recordInputs: new Map(),
                droppedRecordInputCalls: 0,
              };
              cause.calls++;
              cause.nativeElapsedMs += cost;
              cause.maxMs = Math.max(cause.maxMs, cost);
              cause.targets[tag] = (cause.targets[tag] ?? 0) + 1;
              cause.frames = frames;
              const categories = new Map<string, NonNullable<Summary['records']>[number]>();
              for (const frame of frames)
                for (const row of frame.records ?? [])
                  categories.set(`${row.type}|${row.attribute ?? ''}|${row.target}`, row);
              for (const [key, row] of categories) {
                if (!cause.recordInputs.has(key) && cause.recordInputs.size >= 32) {
                  cause.droppedRecordInputCalls++;
                  continue;
                }
                const input = cause.recordInputs.get(key) ?? {
                  type: row.type,
                  attribute: row.attribute,
                  target: row.target,
                  visibilityCalls: 0,
                };
                input.visibilityCalls++;
                cause.recordInputs.set(key, input);
              }
              causes.set(causeKey, cause);
            } else droppedCauseCalls++;
          }
          if (cost >= 10 && (slowest.length < 8 || cost > slowest.at(-1)!.elapsedMs)) {
            const owner = closest.call(this, '[data-demo-id]');
            slowest.push({
              tag,
              ref,
              demo: owner ? attribute.call(owner, 'data-demo-id') : null,
              elapsedMs: cost,
            });
            slowest.sort((a, b) => b.elapsedMs - a.elapsedMs);
            slowest.length = Math.min(slowest.length, 8);
          }
        }
        if (emitted < 18 && after - last >= 10_000) {
          emitted += 1;
          last = after;
          info(
            '[matrix-entry-cost] ' +
              JSON.stringify({
                diagnosticOnly: true,
                elapsedMs: after - start,
                calls,
                nativeElapsedMs: elapsedMs,
                exceptions,
                groups: [...groups].sort((a, b) => b[1].elapsedMs - a[1].elapsedMs).slice(0, 16),
                slowest,
                attribution: {
                  capabilities,
                  targets: [...targets],
                  causeGroups: causes.size,
                  droppedCauseCalls,
                  limits: {
                    frames: 4,
                    recordsPerMutation: 32,
                    recordGroups: 8,
                    causes: 64,
                    recordInputs: 32,
                  },
                  recordMeaning:
                    'Latest bounded frames; record-input counts are attributed visibility calls, not mutation totals.',
                  causes: [...causes.values()]
                    .sort((a, b) => b.nativeElapsedMs - a.nativeElapsedMs)
                    .slice(0, 8)
                    .map((cause) => ({ ...cause, recordInputs: [...cause.recordInputs.values()] })),
                },
              })
          );
        }
      } catch {
        // Invalid receivers and unavailable diagnostic sinks preserve native behavior.
      }
    }
  };
  Object.defineProperty(prototype, 'checkVisibility', { ...descriptor, value: wrapper });
  return () => {
    active = false;
    current = null;
    for (const restore of restores.reverse()) restore();
    if (Object.getOwnPropertyDescriptor(prototype, 'checkVisibility')?.value === wrapper)
      Object.defineProperty(prototype, 'checkVisibility', descriptor);
  };
}
