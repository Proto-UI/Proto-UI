/** Bounded, opt-in test observation. No added frames, layout reads, or motion decisions. */
export function installResidentMotionTrace(
  win: Window & typeof globalThis,
  limits: { entries?: number; pending?: number } = {}
) {
  const entryLimit = limits.entries ?? 1024;
  const pendingLimit = limits.pending ?? 128;
  if (![entryLimit, pendingLimit].every((n) => Number.isSafeInteger(n) && n > 0))
    throw new RangeError('Trace limits must be positive safe integers');
  type Entry = Record<string, unknown> & { sequence: number; kind: string; now: number };
  const entries: Entry[] = [];
  const pending = new Map<number, number>();
  const styles = new WeakMap<object, number>();
  let active = true,
    sequence = 0,
    dropped = 0,
    observationErrors = 0,
    pendingOverflow = 0,
    ambiguousCancels = 0;
  let styleId = 0,
    surface: HTMLElement | null = null;
  let lastDelivered: { ticket: number | null; timestamp: unknown; now: number } | null = null;
  const restorers: (() => void)[] = [];
  const cleanupConflicts: string[] = [];
  const observe = (action: () => void) => {
    if (!active) return;
    try {
      action();
    } catch {
      observationErrors++;
    }
  };
  const append = (kind: string, fields: Record<string, unknown> = {}) => {
    const row = { ...fields, sequence: ++sequence, kind, now: win.performance.now() };
    if (entries.length < entryLimit) entries.push(row);
    else dropped++;
  };
  const identify = (style: object) => {
    let id = styles.get(style);
    if (id === undefined) {
      id = ++styleId;
      styles.set(style, id);
    }
    return id;
  };
  // Never coerce observer input: native WebIDL conversion must happen only once.
  const primitive = (value: unknown) =>
    typeof value === 'string' && value.length > 2048
      ? { type: 'truncated-string', prefix: value.slice(0, 2048), length: value.length }
      : value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)
        ? value
        : { type: typeof value };
  function replace(owner: object, key: string, wrapper: Function) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor && !('value' in descriptor)) throw new Error(`Unsupported accessor: ${key}`);
    Object.defineProperty(
      owner,
      key,
      descriptor
        ? { ...descriptor, value: wrapper }
        : { value: wrapper, writable: true, configurable: true, enumerable: true }
    );
    restorers.push(() => {
      if (Object.getOwnPropertyDescriptor(owner, key)?.value !== wrapper) {
        cleanupConflicts.push(key);
        return;
      }
      if (descriptor) Object.defineProperty(owner, key, descriptor);
      else Reflect.deleteProperty(owner, key);
    });
  }
  const request = win.requestAnimationFrame;
  const cancel = win.cancelAnimationFrame;
  const stylePrototype = win.CSSStyleDeclaration.prototype;
  const setProperty = stylePrototype.setProperty;
  const getPropertyValue = stylePrototype.getPropertyValue;
  function tracedRequest(this: unknown, ...args: unknown[]) {
    const callback = args[0];
    // Wrapping a nonfunction would wrongly make an invalid native call valid.
    if (typeof callback !== 'function') return Reflect.apply(request, this, args);
    let ticket: number | null = null,
      delivered = false;
    const wrapped = function (this: unknown, ...callbackArgs: unknown[]) {
      delivered = true;
      observe(() => {
        if (ticket !== null) pending.delete(ticket);
        lastDelivered = {
          ticket,
          timestamp: primitive(callbackArgs[0]),
          now: win.performance.now(),
        };
        append('raf-deliver', { ticket, timestamp: primitive(callbackArgs[0]) });
      });
      return Reflect.apply(callback, this, callbackArgs);
    };
    const result = Reflect.apply(request, this, [wrapped, ...args.slice(1)]);
    ticket = typeof result === 'number' ? result : null;
    observe(() => {
      append('raf-request', { ticket: primitive(result), deliveredSynchronously: delivered });
      if (!delivered && ticket !== null) {
        if (pending.has(ticket) || pending.size < pendingLimit) pending.set(ticket, sequence);
        else pendingOverflow++;
      }
    });
    return result;
  }
  function tracedCancel(this: unknown, ...args: unknown[]) {
    const result = Reflect.apply(cancel, this, args);
    observe(() => {
      if (
        typeof args[0] === 'number' &&
        Number.isInteger(args[0]) &&
        args[0] >= 0 &&
        args[0] <= 0xffffffff
      )
        pending.delete(args[0]);
      else ambiguousCancels++;
      append('raf-cancel', { ticket: primitive(args[0]) });
    });
    return result;
  }
  function tracedSetProperty(this: CSSStyleDeclaration, ...args: unknown[]) {
    // The captured input is the actual high-precision legacy rgba submitted by the sink,
    // not a color inferred from geometry or a second invocation of its interpolation.
    if (args[0] !== 'background-color' && args[0] !== 'translate')
      return Reflect.apply(setProperty, this, args);
    observe(() =>
      append('style-input', {
        style: identify(this),
        property: args[0],
        value: primitive(args[1]),
        priority: primitive(args[2]),
      })
    );
    const result = Reflect.apply(setProperty, this, args);
    observe(() =>
      append('style-stored', {
        style: identify(this),
        property: args[0],
        value: primitive(Reflect.apply(getPropertyValue, this, [args[0]])),
      })
    );
    return result;
  }
  try {
    replace(win, 'requestAnimationFrame', tracedRequest);
    replace(win, 'cancelAnimationFrame', tracedCancel);
    replace(stylePrototype, 'setProperty', tracedSetProperty);
  } catch (error) {
    active = false;
    for (const restore of restorers.reverse()) {
      try {
        restore();
      } catch {}
    }
    throw error;
  }
  const bindSurface = (next: HTMLElement) => {
    observe(() => {
      if (surface === next) return;
      surface = next;
      append('surface-bound', { style: identify(next.style), connected: next.isConnected });
    });
  };
  const checkpoint = (currentSurface?: HTMLElement) => {
    // Existing sampling checkpoints already resolved the actual surface; do not query/layout here.
    if (currentSurface) bindSurface(currentSurface);
    return {
      sequence,
      dropped,
      observationErrors,
      pendingOverflow,
      ambiguousCancels,
      pendingComplete: pendingOverflow === 0 && observationErrors === 0 && ambiguousCancels === 0,
      pending: [...pending].map(([ticket, requestedSequence]) => ({ ticket, requestedSequence })),
      lastDelivered: lastDelivered ? { ...lastDelivered } : null,
      boundSurfaceConnected: surface?.isConnected ?? null,
      boundStyle: surface ? (styles.get(surface.style) ?? null) : null,
    };
  };
  return {
    bindSurface,
    diagnostic(reasons: readonly string[]) {
      observe(() =>
        append('projector-diagnostic', {
          reasons: reasons.slice(0, 64).map(primitive),
          omittedReasons: Math.max(0, reasons.length - 64),
          visibility: win.document.visibilityState,
          boundStyle: surface ? identify(surface.style) : null,
          boundSurfaceConnected: surface?.isConnected ?? null,
          boundInlineTranslate: primitive(surface?.style.getPropertyValue('translate') ?? null),
          boundInlineColor: primitive(surface?.style.getPropertyValue('background-color') ?? null),
        })
      );
    },
    checkpoint,
    finish() {
      if (active) {
        active = false;
        for (const restore of restorers.reverse()) {
          try {
            restore();
          } catch {
            cleanupConflicts.push('restore-failed');
          }
        }
      }
      return {
        ...checkpoint(),
        entries: entries.map((entry) => ({ ...entry })),
        cleanupConflicts: [...cleanupConflicts],
        limits: { entries: entryLimit, pending: pendingLimit },
      };
    },
  };
}

/** Separate native CSS control, only called after recording and acceptance have stopped. */
export function probeResidentLegacyColorSerialization(win: Window & typeof globalThis) {
  const probe = win.document.createElement('span');
  probe.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none';
  win.document.body.append(probe);
  try {
    return [0.47673894861645416, 1.4320251180713763, 0.49, 0.5, 0.51, 127.5].map((channel) => {
      const input = `rgba(${channel}, ${channel}, ${channel}, 1)`;
      probe.style.setProperty('background-color', input);
      return {
        input,
        stored: probe.style.backgroundColor,
        computed: win.getComputedStyle(probe).backgroundColor,
      };
    });
  } finally {
    probe.remove();
  }
}
