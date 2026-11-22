import { capUnavailable, type Prototype, type TemplateChildren } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { createRuntimeSession, type RuntimeSession } from './session';
import type { RuntimeLifecycleEvent } from '../kernel/lifecycle-events';
import type { ScheduledDelayTask } from './host';
import { cloneOwnerInitialData } from './initial-data';

/** Private conformance entry. It is deliberately absent from the published runtime barrel. */
export interface RuntimeRequestScope {
  readonly signal: AbortSignal;
  /** False once response completion, failure or abort has begun terminal retirement. */
  isCurrent(): boolean;
}

export interface RuntimeRequestOptions<P extends PropsBaseType, T> {
  readonly props: Readonly<P>;
  readonly signal?: AbortSignal;
  readonly serialize: (
    children: TemplateChildren,
    scope: RuntimeRequestScope
  ) => T | PromiseLike<T>;
  readonly scheduleDelay?: (durationMs: number, task: () => void) => ScheduledDelayTask;
  readonly onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
  /** Secondary cleanup errors are observable without replacing an initiating failure. */
  readonly onCleanupError?: (error: unknown) => void;
}

/**
 * C-LIFECYCLE-REQUEST-0001: reuse Runtime's instance ownership with zero view epochs.
 * This executes an already trusted Prototype, not authored source text, and is not
 * an HTML renderer, canonical compiler target or a hidden DOM host.
 */
export async function executeRuntimeRequest<P extends PropsBaseType, T>(
  proto: Prototype<P>,
  options: RuntimeRequestOptions<P, T>
): Promise<T> {
  options.signal?.throwIfAborted();
  const props = cloneOwnerInitialData(options.props);
  const cancellation = new AbortController();
  const interrupted = Promise.withResolvers<never>();
  // Synchronous created/setup may abort before the race is installed.
  void interrupted.promise.catch(() => {});
  let session: RuntimeSession<P> | undefined;
  let retirement: Promise<void> | undefined;
  let terminal = false;
  let failure: { value: unknown } | undefined;
  let cleanupFailure: { value: unknown } | undefined;

  const recordCleanupError = (error: unknown) => {
    cleanupFailure ??= { value: error };
    try {
      options.onCleanupError?.(error);
    } catch {
      // A diagnostic cannot replace either the initiating or cleanup failure.
    }
  };
  const retire = () => {
    terminal = true;
    if (!cancellation.signal.aborted) cancellation.abort(failure?.value);
    if (!retirement && session) {
      // RuntimeSession invalidates the owner synchronously, then settles cleanup.
      retirement = session.dispose().catch(recordCleanupError);
    }
  };
  const fail = (value: unknown) => {
    if (terminal) return;
    failure = { value };
    retire();
    interrupted.reject(value);
  };
  const abort = () => fail(options.signal!.reason);
  const assertCurrent = () => {
    if (failure) throw failure.value;
    options.signal?.throwIfAborted();
  };
  const scope: RuntimeRequestScope = Object.freeze({
    signal: cancellation.signal,
    isCurrent: () => !terminal,
  });
  const contextIdentity = Object.freeze({});
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    assertCurrent();
    session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      commit() {
        throw capUnavailable('lifecycle.request-physical-commit');
      },
      schedule() {
        throw capUnavailable('lifecycle.request-physical-schedule');
      },
      scheduleDelay(durationMs, task) {
        const guarded = () => {
          if (terminal) return;
          try {
            task();
          } catch (error) {
            fail(error);
          }
        };
        if (options.scheduleDelay) return options.scheduleDelay(durationMs, guarded);
        const timer = setTimeout(guarded, durationMs);
        return { cancel: () => clearTimeout(timer) };
      },
      onRuntimeReady(wiring) {
        // A new token and an explicit empty ancestry prevent request-scope reuse.
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, contextIdentity],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
      },
      onSetupCleanupError: recordCleanupError,
      onLifecycleEvent: options.onLifecycleEvent,
    });
    assertCurrent();
    const children = session.viewIntent.getSnapshot().present ? session.kernel.renderOnce() : [];
    assertCurrent();
    const work = Promise.resolve(options.serialize(children, scope));
    // A serializer can synchronously abort and return already-rejected work.
    // Observe that rejection even when the abort wins at the next boundary.
    void work.catch(() => {});
    assertCurrent();
    const result = await Promise.race([work, interrupted.promise]);
    assertCurrent();
    return result;
  } catch (error) {
    // A concurrent request abort already owns the initiating reason.
    failure ??= { value: error };
    throw failure.value;
  } finally {
    options.signal?.removeEventListener('abort', abort);
    retire();
    await retirement;
    if (!failure) options.signal?.throwIfAborted();
    if (!failure && cleanupFailure) throw cleanupFailure.value;
  }
}
