/**
 * Generic host transport guard. Emitted only for private SSR initialization;
 * no authored program, component protocol or semantic IR is interpreted here.
 * Kept independent of Runtime's data boundary and checked against the same
 * C-LIFECYCLE-OWNER-INITIALIZATION-0001 cases. Inputs are trusted in-process
 * objects or decoded wire data. Reflection can execute Proxy traps; this is not
 * a sandbox for arbitrary untrusted live JavaScript objects.
 */
export function ownerInitialDataGuard(name: string, typescript = true): string {
  const type = (value: string) => (typescript ? `: ${value}` : '');
  return `/** @param {any} input @returns {any} */
function ${name}(input${type('any')})${type('any')} {
  const ancestors = new Set();
  let nodes = 0, bytes = 0;
  const encoder = new TextEncoder();
  /** @param {string} detail @returns {never} */
  function fail(detail${type('string')})${type('never')} { throw new TypeError('[Owner initialization] ' + detail); }
  /** @param {string} value */
  function text(value${type('string')}) {
    if (value.length > 1048576) fail('byte budget exceeded');
    bytes += encoder.encode(JSON.stringify(value)).length;
    if (bytes > 1048576) fail('byte budget exceeded');
  }
  /** @param {any} value @param {number} depth @returns {any} */
  function visit(value${type('any')}, depth${type('number')})${type('any')} {
    if (depth > 64) fail('depth budget exceeded');
    if (++nodes > 10000) fail('node budget exceeded');
    bytes += 32;
    if (bytes > 1048576) fail('byte budget exceeded');
    if (value === null || value === undefined || typeof value === 'boolean') return value;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('numbers must be finite'); return value; }
    if (typeof value === 'string') { text(value); return value; }
    if (typeof value !== 'object') fail('live capabilities are not data');
    if (ancestors.has(value)) fail('cyclic data');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('non-data prototype');
    const keys = Reflect.ownKeys(value);
    if (keys.length > 10000) fail('node budget exceeded');
    if (array && (value.length > 10000 || keys.length !== value.length + 1)) fail('sparse or extended array');
    const copy = array ? [] : Object.create(null);
    ancestors.add(value);
    try {
      for (const key of keys) {
        if (array && key === 'length') continue;
        const field = Object.getOwnPropertyDescriptor(value, key);
        if (!field || typeof key !== 'string' || !field.enumerable || !('value' in field)) fail('accessor, symbol or nonenumerable field');
        if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) fail('extended array');
        text(key);
        Object.defineProperty(copy, key, { value: visit(field.value, depth + 1), enumerable: true });
      }
    } finally { ancestors.delete(value); }
    return Object.freeze(copy);
  }
  return visit(input, 0);
}
`;
}

/** Strict decoder for the existing tagged tuple transport used by Vue and WC. */
export function ownerInitialDataDecoder(name: string, guard: string, typescript = true): string {
  const type = (value: string) => (typescript ? `: ${value}` : '');
  return `/** @param {any} input @returns {any} */
function ${name}(input${type('any')})${type('any')} {
  /** @returns {never} */
  function invalid()${type('never')} { throw new TypeError('[Owner initialization] malformed data encoding'); }
  /** @param {any} value @returns {any} */
  function decode(value${type('any')})${type('any')} {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
    if (!Array.isArray(value)) return invalid();
    if (value.length === 1 && value[0] === 'undefined') return undefined;
    if (value.length === 1 && value[0] === 'negative-zero') return -0;
    if (value.length !== 2 || !Array.isArray(value[1])) return invalid();
    if (value[0] === 'array') return Object.freeze(value[1].map(decode));
    if (value[0] !== 'record') return invalid();
    const record = Object.create(null);
    for (const entry of value[1]) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || Object.hasOwn(record, entry[0])) return invalid();
      Object.defineProperty(record, entry[0], { value: decode(entry[1]), enumerable: true });
    }
    return Object.freeze(record);
  }
  return decode(${guard}(input));
}
`;
}

/** Separate local framework bindings from the raw Props which may cross owners. */
export function ownerInitialPropsGuard(
  name: string,
  guard: string,
  declared: readonly string[]
): string {
  return `function ${name}(input: Record<string, unknown>): Record<string, unknown> {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new TypeError('[Owner initialization] Props must be plain data with explicit host bindings');
  const host: Record<string, unknown> = Object.create(null), raw: Record<string, unknown> = Object.create(null);
  const declared: readonly string[] = ${JSON.stringify(declared)};
  for (const key of Reflect.ownKeys(input)) {
    const field = Object.getOwnPropertyDescriptor(input, key)!;
    if (typeof key !== 'string' || !field.enumerable || !('value' in field)) throw new TypeError('[Owner initialization] accessor, symbol or nonenumerable Props field');
    const native = !declared.includes(key) && (['children', 'ref', 'key', 'class', 'className', 'hostClass', 'surfaceClass', 'style', 'hostStyle', 'surfaceStyle'].includes(key) || /^on[A-Z]/.test(key) && typeof field.value === 'function');
    (native ? host : raw)[key] = field.value;
  }
  return Object.freeze({ ...host, ...${guard}(raw) });
}
`;
}
