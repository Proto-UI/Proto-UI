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
    if (Object.getOwnPropertyDescriptor(prototype, 'checkVisibility')?.value === wrapper)
      Object.defineProperty(prototype, 'checkVisibility', descriptor);
  };
}
