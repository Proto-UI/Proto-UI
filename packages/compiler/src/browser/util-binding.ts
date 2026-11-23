/**
 * The WASM entry accepts only JSON text, never caller-owned IR objects. The
 * trusted bundle disables Proxy before evaluating any compiler module, so the
 * Node IR guard can retain its meaning without exposing a Node host object.
 * Fail closed if that build invariant is broken; Node keeps node:util itself.
 */
export const types = {
  isProxy(_value: unknown): boolean {
    if (typeof Proxy !== 'undefined')
      throw new Error('The browser compiler requires a proxy-free JSON input realm.');
    return false;
  },
};

/** The sole emitter caller compares admitted finite module-configuration data. */
export function isDeepStrictEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const prototype = Object.getPrototypeOf(left);
  if (prototype !== Object.getPrototypeOf(right)) return false;
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null)
    throw new TypeError('Compiler configuration equality requires finite plain data.');
  const a = Reflect.ownKeys(left),
    b = Reflect.ownKeys(right);
  if (a.length !== b.length) return false;
  for (const key of a) {
    const x = Object.getOwnPropertyDescriptor(left, key);
    const y = Object.getOwnPropertyDescriptor(right, key);
    if (!x || !y || !('value' in x) || !('value' in y))
      throw new TypeError('Compiler configuration equality forbids accessors.');
    if (!isDeepStrictEqual(x.value, y.value)) return false;
  }
  return true;
}
