import { createContext, useContext, useInsertionEffect, useRef, useState, useSyncExternalStore, type Context } from 'react';
import { usePublishedInputs } from './lifetime.ts';

const channel = /* @__PURE__ */ Symbol('Proto UI Context channel');
const renderSnapshot = /* @__PURE__ */ Symbol('Proto UI Context render snapshot');
type Subscribe = (notify: () => void) => () => void;

export interface ContextValue<T, Identity extends symbol = symbol> {
  readonly [channel]: Identity;
  /** Immutable render snapshot, or the current cached external store snapshot. */
  readonly [renderSnapshot]: () => T;
  /** Resolve the value from the owner's committed inputs and current fields. */
  readonly getSnapshot: () => T;
  readonly subscribe?: Subscribe;
}

interface ExternalProvider<T, Identity extends symbol> extends ContextValue<T, Identity> {
  readonly subscribe: Subscribe;
  readonly publish: (value: T) => void;
}

export interface NativeContext<T, Identity extends symbol> extends Context<ContextValue<T, Identity> | null> {
  readonly [channel]: Identity;
  readonly debugName: string;
  readonly createProvider: (initial: T) => ExternalProvider<T, Identity>;
  readonly same: (left: T, right: T) => boolean;
}

export class MissingProviderError extends Error {
  readonly code = 'missing-provider';
  readonly key: { readonly debugName: string };
  readonly debugName: string;
  readonly origin: string;

  constructor(key: { readonly debugName: string }, origin: string) {
    super(`${origin}: required Context ${JSON.stringify(key.debugName)} has no matching provider.`);
    this.name = 'MissingProviderError';
    this.key = key;
    this.debugName = key.debugName;
    this.origin = origin;
  }
}

export function createNativeContext<T, Identity extends symbol>(identity: Identity, debugName: string, check: (value: unknown) => T, same: (left: T, right: T) => boolean): NativeContext<T, Identity> {
  const context = createContext<ContextValue<T, Identity> | null>(null);
  context.displayName = debugName;
  function createProvider(initial: T): ExternalProvider<T, Identity> {
    let value = check(initial);
    type Registration = { notify: (() => void) | undefined };
    let listeners = new Set<Registration>();
    let delivering: ReadonlySet<Registration> | undefined;
    function writableListeners(): Set<Registration> {
      // Only a subscription change during delivery needs a copy. A callback
      // can synchronously move to another provider or subscribe again.
      if (listeners === delivering) listeners = new Set(listeners);
      return listeners;
    }
    const getSnapshot = () => value;
    return {
      [channel]: identity, [renderSnapshot]: getSnapshot, getSnapshot,
      subscribe(notify) {
        const registration: Registration = { notify };
        writableListeners().add(registration);
        return () => {
          if (!registration.notify) return;
          registration.notify = undefined;
          writableListeners().delete(registration);
        };
      },
      publish(candidate) {
        const next = check(candidate);
        if (same(value, next)) return;
        value = next;
        const previous = delivering;
        const batch = delivering = listeners;
        let errors: unknown[] | undefined;
        try {
          for (const registration of batch) {
            try { registration.notify?.(); }
            catch (error) { (errors ??= []).push(error); }
          }
        } finally {
          delivering = previous;
        }
        if (errors?.length === 1) throw errors[0];
        if (errors) throw new AggregateError(errors, 'Context provider subscribers failed.');
      },
    };
  }
  return Object.assign(context, { [channel]: identity, debugName, createProvider, same });
}

export function useRequiredContext<T, Identity extends symbol>(key: NativeContext<T, Identity>, origin: string): ContextValue<T, Identity> {
  const source = useContext(key);
  if (!source || source[channel] !== key[channel]) throw new MissingProviderError(key, origin);
  return source;
}

/** React subscribes an external-store listener in its passive phase. Move its
 * existing registration in the mutation phase when a logical provider changes,
 * including a move between two external stores with equal current values. */
class SourceSubscription {
  #source: Subscribe | undefined;
  #notify: (() => void) | undefined;
  #remove: (() => void) | undefined;

  select(source: Subscribe | undefined): void {
    if (this.#source === source) return;
    this.#remove?.();
    this.#source = source;
    this.#remove = this.#notify && source?.(this.#notify);
  }

  readonly subscribe = (notify: () => void): (() => void) => {
    this.#notify = notify;
    this.#remove = this.#source?.(notify);
    return () => {
      this.#remove?.();
      this.#remove = undefined;
      this.#notify = undefined;
    };
  };
}

export function useContextSnapshot<T>(source: ContextValue<T>): T {
  const [binding] = useState(() => new SourceSubscription());
  useInsertionEffect(() => {
    binding.select(source.subscribe);
    return () => binding.select(undefined);
  }, [binding, source]);
  const snapshot = source[renderSnapshot];
  return useSyncExternalStore(binding.subscribe, snapshot, snapshot);
}

/** A compiled provider publishes a React Context frame for each distinct
 * render value. Only committed projections can supply imperative fresh reads.
 * Descendants receive the render frame directly, including during SSR. */
export function useProvidedContext<T, Identity extends symbol>(key: NativeContext<T, Identity>, value: T, read: () => T): ContextValue<T, Identity> {
  const owner = usePublishedInputs(read);
  const previous = useRef<ContextValue<T, Identity> | undefined>(undefined);
  const old = previous.current;
  const frame: ContextValue<T, Identity> = old && old[channel] === key[channel] && key.same(old[renderSnapshot](), value)
    ? old
    : { [channel]: key[channel], [renderSnapshot]: () => value, getSnapshot: () => owner.read()() };
  useInsertionEffect(() => { previous.current = frame; }, [frame]);
  return frame;
}
