import type { Page } from 'playwright-core';

type Observation = {
  sequence: number;
  phase: 'begin' | 'return' | 'error';
  operation: string;
  argument: string | null;
  nodeMs: number;
  durationMs?: number;
  result?: string;
};

/** Node-side observation only: forward the exact Playwright method, receiver
 * and arguments. No browser script, input, selector, wait or timeout changes. */
export function observeS4Journey(page: Page, publish: (row: Observation) => void): Page {
  let sequence = 0;
  const originals = new WeakMap<object, object>();
  const emit = (row: Observation) => {
    try {
      publish(row);
    } catch {
      /* Evidence cannot replace the journey result. */
    }
  };
  const text = (value: unknown): string | null => {
    if (typeof value === 'string') return value.slice(0, 240);
    if (typeof value === 'function') return Function.prototype.toString.call(value).slice(0, 240);
    return null;
  };
  const unwrap = (value: unknown) =>
    value && (typeof value === 'object' || typeof value === 'function')
      ? (originals.get(value as object) ?? value)
      : value;
  const wrap = <T extends object>(target: T, label: string): T => {
    const proxy = new Proxy(target, {
      get(owner, key) {
        const value: unknown = Reflect.get(owner, key, owner);
        if (
          (key === 'keyboard' || key === 'mouse') &&
          value !== null &&
          (typeof value === 'object' || typeof value === 'function')
        )
          return wrap(value, `${label}.${String(key)}`);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          const operation = `${label}.${String(key)}`;
          if (key === 'locator' || key === 'context') {
            const result = Reflect.apply(value, owner, args.map(unwrap));
            return wrap(result, key === 'locator' ? `${operation}(${text(args[0])})` : operation);
          }
          const id = ++sequence;
          const begin = performance.now();
          const argument = text(args[0]);
          emit({ sequence: id, phase: 'begin', operation, argument, nodeMs: begin });
          const returned = (result: unknown) => {
            let observed: string | undefined;
            if (result == null || ['string', 'number', 'boolean'].includes(typeof result))
              observed = String(result).slice(0, 800);
            emit({
              sequence: id,
              phase: 'return',
              operation,
              argument,
              nodeMs: performance.now(),
              durationMs: performance.now() - begin,
              result: observed,
            });
            return key === 'newCDPSession' && result && typeof result === 'object'
              ? wrap(result, `${label}.cdp`)
              : result;
          };
          const failed = (error: unknown): never => {
            emit({
              sequence: id,
              phase: 'error',
              operation,
              argument,
              nodeMs: performance.now(),
              durationMs: performance.now() - begin,
              result: String(error).slice(0, 2000),
            });
            throw error;
          };
          try {
            const result = Reflect.apply(value, owner, args.map(unwrap));
            return result && typeof result.then === 'function'
              ? result.then(returned, failed)
              : returned(result);
          } catch (error) {
            return failed(error);
          }
        };
      },
    });
    originals.set(proxy, target);
    return proxy;
  };
  return wrap(page, 'page');
}
