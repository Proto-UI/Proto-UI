import type { OwnedStateHandle } from '@proto.ui/core';
import type { StatePort } from '@proto.ui/module-state';
import { motionWidthSource } from './targets';

type Source = { handle: OwnedStateHandle<number>; read: () => unknown; semantic: string };
/** Instance-local identity admission. Never invokes an arbitrary exposed object's getter. */
export function createMotionNumericSources(options: {
  expose(key: string): unknown;
  state(): StatePort | undefined;
  invalidate(): void;
}) {
  const registered = new WeakMap<object, Source>();
  const subscriptions = new Map<string, { source: Source; off: () => void }>();
  const disconnected = new WeakSet<object>();
  let disposed = false;
  const own = (value: object, key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  };
  return {
    register(handle: object) {
      const get = own(handle, 'get');
      const kind = own(handle, '__stateKind');
      const semantic = own(handle, '__stateSemantic');
      if (
        typeof get === 'function' &&
        (kind === 'number.range' || kind === 'number.discrete') &&
        typeof semantic === 'string' &&
        /^[a-z][a-z0-9-]*$/.test(semantic)
      )
        registered.set(handle, {
          handle: handle as OwnedStateHandle<number>,
          read: () => get.call(handle),
          semantic,
        });
    },
    snapshot(tokens: readonly string[]) {
      const keys = new Set(
        tokens.map(motionWidthSource).filter((key): key is string => key !== null)
      );
      const numbers: Record<string, number> = Object.create(null);
      const sourceDiagnostics: string[] = [];
      for (const [key, subscription] of subscriptions)
        if (!keys.has(key)) {
          subscriptions.delete(key);
          subscription.off();
        }
      for (const key of keys) {
        const value = options.expose(key);
        const source = value && typeof value === 'object' ? registered.get(value) : undefined;
        const state = options.state();
        if (!source || source.semantic !== key || !state || disconnected.has(source.handle)) {
          subscriptions.get(key)?.off();
          subscriptions.delete(key);
          sourceDiagnostics.push(`width:numeric-source-unavailable:${key}`);
          continue;
        }
        const previous = subscriptions.get(key);
        if (previous?.source !== source) {
          previous?.off();
          const off = state.watch(source.handle, (_run, event) => {
            if (disposed || subscriptions.get(key)?.source !== source) return;
            if (event.type === 'disconnect') disconnected.add(source.handle);
            options.invalidate();
          });
          subscriptions.set(key, { source, off });
        }
        const number = source.read();
        if (typeof number === 'number' && Number.isFinite(number)) numbers[key] = number;
        else sourceDiagnostics.push(`width:nonfinite-numeric-source:${key}`);
      }
      return Object.freeze({
        numbers: Object.freeze(numbers),
        sourceDiagnostics: Object.freeze(sourceDiagnostics),
      });
    },
    dispose() {
      disposed = true;
      const owned = [...subscriptions.values()];
      subscriptions.clear();
      let error: unknown;
      for (const { off } of owned) {
        try {
          off();
        } catch (cause) {
          error ??= cause;
        }
      }
      if (error !== undefined) throw error;
    },
  };
}
