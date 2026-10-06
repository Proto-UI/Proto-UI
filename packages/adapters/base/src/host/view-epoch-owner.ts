import type { PropsBaseType } from '@proto.ui/types';
import type { ViewIntentSnapshot } from '@proto.ui/runtime';
import { createHostWiring } from '../wiring/host-wiring';
import type { AdapterHostSession } from './adapter-host';
import type { WiringSpec } from '../types';

type ViewDisposer = () => void;

export type ViewEpochOwner<P extends PropsBaseType> = {
  readonly session: AdapterHostSession<P> | null;
  readonly hasView: boolean;
  readonly viewIntent: ViewIntentSnapshot | null;

  /**
   * Creates the Proto session while it is detached. The supplied wiring must
   * contain owner/instance capabilities only; view capabilities arrive later.
   */
  initialize(args: {
    modules: WiringSpec;
    createSession(wiring: ReturnType<typeof createHostWiring>): AdapterHostSession<P>;
    onViewIntent?(snapshot: ViewIntentSnapshot): void;
  }): AdapterHostSession<P>;

  attachView(args: {
    modules: WiringSpec;
    disposeView: ViewDisposer;
    createSession(wiring: ReturnType<typeof createHostWiring>): AdapterHostSession<P>;
  }): AdapterHostSession<P>;

  detachView(): Promise<void>;
  disposeView(): void;
  dispose(): Promise<void>;
};

/**
 * Owns one Proto instance and any number of replaceable host view epochs.
 *
 * Logical module caps remain attached while detached. A new view epoch
 * overwrites DOM-bound caps through HostWiring.rebind, then remounts the same
 * RuntimeSession. Terminal disposal remains a separate owner operation.
 */
export function createViewEpochOwner<P extends PropsBaseType>(args: {
  prototypeName: string;
}): ViewEpochOwner<P> {
  let wiring: ReturnType<typeof createHostWiring> | null = null;
  let session: AdapterHostSession<P> | null = null;
  let ownerModules: WiringSpec | null = null;
  let viewDisposer: ViewDisposer | null = null;
  let viewIntent: ViewIntentSnapshot | null = null;
  let unsubscribeIntent: (() => void) | null = null;
  let disposed = false;
  let viewVersion = 0;

  const disposeView = () => {
    const current = viewDisposer;
    viewDisposer = null;
    current?.();
  };

  return {
    get session() {
      return session;
    },
    get hasView() {
      return viewDisposer !== null;
    },
    get viewIntent() {
      return viewIntent;
    },
    initialize(input) {
      if (disposed) {
        throw new Error(`[AdapterHost] cannot initialize disposed ${args.prototypeName}`);
      }
      if (session || wiring) {
        throw new Error(`[AdapterHost] ${args.prototypeName} owner is already initialized`);
      }

      const nextWiring = createHostWiring({
        prototypeName: args.prototypeName,
        modules: input.modules,
      });
      let nextSession: AdapterHostSession<P> | null = null;
      let nextUnsubscribe: (() => void) | null = null;

      try {
        nextSession = input.createSession(nextWiring);
        const notify = (snapshot: ViewIntentSnapshot) => {
          viewIntent = snapshot;
          input.onViewIntent?.(snapshot);
        };
        nextUnsubscribe = nextSession.viewIntent.subscribe(notify);
        notify(nextSession.viewIntent.getSnapshot());

        wiring = nextWiring;
        ownerModules = input.modules;
        session = nextSession;
        unsubscribeIntent = nextUnsubscribe;
        return nextSession;
      } catch (error) {
        nextUnsubscribe?.();
        void nextSession?.dispose();
        nextWiring.afterUnmount();
        viewIntent = null;
        throw error;
      }
    },
    attachView(input) {
      if (disposed) {
        throw new Error(`[AdapterHost] cannot attach a view to disposed ${args.prototypeName}`);
      }

      disposeView();
      const version = ++viewVersion;
      viewDisposer = input.disposeView;

      if (!wiring) {
        wiring = createHostWiring({ prototypeName: args.prototypeName, modules: input.modules });
        session = input.createSession(wiring);
        viewIntent = session.viewIntent.getSnapshot();
        return session;
      }

      try {
        wiring.replace(input.modules);
        if (!session) {
          throw new Error(`[AdapterHost] missing session for ${args.prototypeName}`);
        }
        void session.mount();
        return session;
      } catch (error) {
        // Roll back only this failed lease; cleanup can synchronously attach a
        // replacement, whose disposer and capabilities must remain untouched.
        if (viewVersion === version) {
          viewDisposer = null;
          try {
            // A first-frame failure can leave the Runtime in its mounting phase.
            // End that failed epoch before a replacement capability can replay.
            void session?.unmount().catch(() => {});
          } catch {
            /* Continue releasing the failed view after a lifecycle error. */
          }
          try {
            input.disposeView();
          } catch {
            /* Preserve the original attach failure while restoring owner caps. */
          }
          if (viewVersion === version && wiring && ownerModules) {
            try {
              wiring.replace(ownerModules);
            } catch {
              /* Keep the owning attach error, not a secondary release error. */
            }
          }
        }
        throw error;
      }
    },
    detachView() {
      const version = viewVersion;
      let result = Promise.resolve();
      try {
        completeCleanup([
          () => {
            result = session?.unmount() ?? result;
          },
          // unmount and the old disposer can both attach a replacement view.
          () => {
            if (viewVersion === version) disposeView();
          },
          () => {
            if (viewVersion === version && wiring && ownerModules) wiring.replace(ownerModules);
          },
        ]);
      } catch (error) {
        // The synchronous failure prevents returning this promise to the caller.
        // Observe its rejection without replacing the original cleanup error.
        void result.catch(() => {});
        throw error;
      }
      return result;
    },
    disposeView,
    dispose() {
      if (disposed) return session?.dispose() ?? Promise.resolve();
      disposed = true;
      const unsubscribe = unsubscribeIntent;
      unsubscribeIntent = null;
      let result = Promise.resolve();
      try {
        completeCleanup([
          () => {
            unsubscribe?.();
          },
          () => {
            result = session?.dispose() ?? result;
          },
          disposeView,
          () => {
            wiring = null;
            ownerModules = null;
          },
        ]);
      } catch (error) {
        // The synchronous failure prevents returning this promise to the caller.
        // Observe its rejection without replacing the original cleanup error.
        void result.catch(() => {});
        throw error;
      }
      return result;
    },
  };
}

// Finish every release while preserving the original synchronous failure.
function completeCleanup(steps: Array<() => void>) {
  let failed = false;
  let firstError: unknown;
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }
  if (failed) throw firstError;
}

export function createDeferredOwnerDisposal(dispose: () => void | Promise<void>) {
  let version = 0;

  return {
    retain() {
      version += 1;
    },
    release() {
      const releaseVersion = ++version;
      queueMicrotask(() => {
        if (version !== releaseVersion) return;
        void dispose();
      });
    },
  };
}
