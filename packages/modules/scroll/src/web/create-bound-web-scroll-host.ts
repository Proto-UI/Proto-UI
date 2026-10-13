import type { ScrollSurfaceHost, ScrollSurfaceAvailability, ScrollSurfaceHostLease } from '../caps';
import {
  createWebScrollSurfaceHost,
  type WebScrollSurfaceHostOptions,
} from './create-web-scroll-host';

export type BoundWebScrollSurfaceHostOptions = WebScrollSurfaceHostOptions &
  Readonly<{
    boundary: HTMLElement;
    getTarget(): HTMLElement | null;
    isReady(): boolean;
    subscribeTarget(listener: () => void): () => void;
    subscribeDocumentChange?: (
      listener: (document: Document, phase: 'retire' | 'ready') => void
    ) => () => void;
  }>;
export class ScrollSurfaceBindingError extends Error {
  readonly code = 'PUI_SCROLL_SURFACE_UNAVAILABLE';
  constructor(readonly reason: 'target-retired' | 'unsupported-profile' | 'ownership-conflict') {
    super(`[Scroll] physical surface unavailable: ${reason}.`);
  }
}

/** Resolves physical targets at the host boundary; prototypes never see target identities. */
export function createBoundWebScrollSurfaceHost(
  options: BoundWebScrollSurfaceHostOptions
): ScrollSurfaceHost {
  let target: HTMLElement | null = null;
  let document: Document | null = null;
  let binding: object | null = null;
  let suspended = false;
  let conflict = false;
  let currentLease: ScrollSurfaceHostLease | null = null;
  let acquiring = false;
  const listeners = new Set<() => void>();
  let installing = false;
  let offTarget: (() => void) | null = null;
  let offDocument: (() => void) | null = null;
  let subscriptionEpoch = 0;
  const notify = () => {
    let failed = false;
    let failure: unknown;
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try {
        listener();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    if (failed) throw failure;
  };
  const get = (): ScrollSurfaceAvailability => {
    const next = suspended || !options.isReady() ? null : options.getTarget();
    const nextDocument = next?.ownerDocument ?? null;
    if (next !== target || nextDocument !== document) {
      target = next;
      document = nextDocument;
      binding = next ? Object.freeze({}) : null;
      conflict = false;
    }
    if (conflict) return { kind: 'unavailable', reason: 'ownership-conflict' };
    return binding
      ? { kind: 'available', binding }
      : { kind: 'unavailable', reason: suspended ? 'target-retired' : 'target-pending' };
  };
  const refresh = () => {
    get();
    notify();
  };
  const stop = () => {
    subscriptionEpoch++;
    const cleanups = [offTarget, offDocument];
    offTarget = offDocument = null;
    let failed = false;
    let failure: unknown;
    for (const off of cleanups)
      try {
        off?.();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    if (failed) throw failure;
  };
  const install = () => {
    if (installing || offTarget || offDocument || !listeners.size) return;
    installing = true;
    const epoch = ++subscriptionEpoch;
    let targetOff: (() => void) | null = null;
    let documentOff: (() => void) | null = null;
    let acquisitionFailed = false;
    try {
      targetOff = options.subscribeTarget(() => {
        if (epoch === subscriptionEpoch && listeners.size) refresh();
      });
      if (epoch !== subscriptionEpoch || !listeners.size) return;
      documentOff =
        options.subscribeDocumentChange?.((_document, phase) => {
          if (epoch !== subscriptionEpoch || !listeners.size) return;
          // Even a newly created destination sink must respect a pending retire barrier.
          suspended = phase === 'retire';
          if (suspended) {
            binding = null;
            target = null;
            document = null;
          }
          refresh();
        }) ?? null;
      if (epoch !== subscriptionEpoch || !listeners.size) return;
      offTarget = targetOff;
      offDocument = documentOff;
      targetOff = documentOff = null;
    } catch (error) {
      acquisitionFailed = true;
      throw error;
    } finally {
      installing = false;
      let failed = false;
      let failure: unknown;
      for (const off of [targetOff, documentOff])
        try {
          off?.();
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      if (failed && !acquisitionFailed) throw failure;
      if (!acquisitionFailed && epoch !== subscriptionEpoch && listeners.size) install();
    }
  };
  return {
    support: Object.freeze({ system: true, composed: true }),
    preference: options.preference,
    availability: {
      get,
      subscribe(listener) {
        listeners.add(listener);
        try {
          install();
        } catch (error) {
          listeners.delete(listener);
          throw error;
        }
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          listeners.delete(listener);
          if (!listeners.size) stop();
        };
      },
    },
    attach(connection, expectedBinding) {
      const value = get();
      if (
        value.kind !== 'available' ||
        value.binding !== expectedBinding ||
        !target ||
        currentLease ||
        acquiring
      )
        throw new ScrollSurfaceBindingError('target-retired');
      const capturedTarget = target,
        capturedDocument = document;
      if (
        capturedTarget !== options.boundary &&
        (connection.config.axes !== 'vertical' || connection.projection !== 'system')
      )
        throw new ScrollSurfaceBindingError('unsupported-profile');
      const current = () => {
        const now = get();
        return (
          now.kind === 'available' &&
          now.binding === expectedBinding &&
          target === capturedTarget &&
          document === capturedDocument
        );
      };
      let active = true;
      acquiring = true;
      const physical = createWebScrollSurfaceHost(capturedTarget, {
        ...options,
        exclusivePolicy: capturedTarget !== options.boundary,
        isCurrentBinding: () => active && current(),
        onPolicyLost() {
          if (!active || !current()) return;
          conflict = true;
          binding = null;
          notify();
        },
      });
      let lease: ScrollSurfaceHostLease;
      try {
        lease = physical.attach({
          ...connection,
          onFacts(snapshot) {
            if (active && current()) connection.onFacts(snapshot);
          },
        });
      } catch (error) {
        active = false;
        throw error;
      } finally {
        acquiring = false;
      }
      if (!active || !current()) {
        active = false;
        lease.dispose();
        throw new ScrollSurfaceBindingError('target-retired');
      }
      const wrapped: ScrollSurfaceHostLease = {
        update(next) {
          if (active && current())
            lease.update({
              ...next,
              onFacts(snapshot) {
                if (active && current()) next.onFacts(snapshot);
              },
            });
        },
        request(request) {
          if (active && current()) lease.request(request);
        },
        dispose() {
          if (!active) return;
          active = false;
          if (currentLease === wrapped) currentLease = null;
          lease.dispose();
        },
      };
      currentLease = wrapped;
      return wrapped;
    },
  };
}
