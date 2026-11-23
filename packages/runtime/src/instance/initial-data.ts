/** Private data boundary for request/owner initialization, not a State serializer. */
export const OWNER_INITIAL_DATA_LIMITS = Object.freeze({
  depth: 64,
  nodes: 10_000,
  bytes: 1_048_576,
});

/**
 * Clone finite plain data from a trusted in-process caller or a decoded wire
 * message, without reading accessor values. This is not a JavaScript sandbox:
 * reflection on a Proxy can execute its traps, so an untrusted live object must
 * not be passed to this boundary.
 */
export function cloneOwnerInitialData<T>(input: T): T {
  const ancestors = new Set<object>();
  let nodes = 0;
  let bytes = 0;
  const encoder = new TextEncoder();
  function fail(detail: string): never {
    throw new TypeError(`[Owner initialization] ${detail}`);
  }
  const stringBytes = (value: string) => {
    if (value.length > OWNER_INITIAL_DATA_LIMITS.bytes) fail('byte budget exceeded');
    bytes += encoder.encode(JSON.stringify(value)).length;
    if (bytes > OWNER_INITIAL_DATA_LIMITS.bytes) fail('byte budget exceeded');
  };
  const visit = (value: unknown, depth: number): unknown => {
    if (depth > OWNER_INITIAL_DATA_LIMITS.depth) fail('depth budget exceeded');
    if (++nodes > OWNER_INITIAL_DATA_LIMITS.nodes) fail('node budget exceeded');
    // Conservative punctuation/tag overhead, including undefined and signed zero.
    bytes += 32;
    if (bytes > OWNER_INITIAL_DATA_LIMITS.bytes) fail('byte budget exceeded');
    if (value === null || value === undefined || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('numbers must be finite');
      return value;
    }
    if (typeof value === 'string') {
      stringBytes(value);
      return value;
    }
    if (typeof value !== 'object') fail('live capabilities are not data');
    if (ancestors.has(value)) fail('cyclic data');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null
    )
      fail('non-data prototype');
    const keys = Reflect.ownKeys(value);
    if (keys.length > OWNER_INITIAL_DATA_LIMITS.nodes) fail('node budget exceeded');
    if (
      array &&
      (value.length > OWNER_INITIAL_DATA_LIMITS.nodes || keys.length !== value.length + 1)
    )
      fail('sparse or extended array');
    const copy = array ? [] : Object.create(null);
    ancestors.add(value);
    try {
      for (const key of keys) {
        if (array && key === 'length') continue;
        const field = Object.getOwnPropertyDescriptor(value, key)!;
        if (typeof key !== 'string' || !field.enumerable || !('value' in field))
          fail('accessor, symbol or nonenumerable field');
        if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))
          fail('extended array');
        stringBytes(key);
        Object.defineProperty(copy, key, {
          value: visit(field.value, depth + 1),
          enumerable: true,
        });
      }
    } finally {
      ancestors.delete(value);
    }
    return Object.freeze(copy);
  };
  return visit(input, 0) as T;
}
