type InitialRenderTicket = {
  admit(): void;
  promote(): void;
};

type DocumentQueue = {
  active: number;
  pending: Set<InitialRenderTicket>;
  observed: Map<Element, InitialRenderTicket>;
  observer: IntersectionObserver | null;
  scheduled: boolean;
  drain(): void;
};

const queues = new WeakMap<Document, DocumentQueue>();
const BACKGROUND_INITIAL_RENDER_LIMIT = 4;

function documentQueue(document: Document): DocumentQueue {
  const existing = queues.get(document);
  if (existing) return existing;
  const view = document.defaultView;
  const queue: DocumentQueue = {
    active: 0,
    pending: new Set(),
    observed: new Map(),
    observer: null,
    scheduled: false,
    drain() {
      if (queue.scheduled || !queue.pending.size) return;
      queue.scheduled = true;
      // Admission continues without idle callbacks or a visible animation frame.
      // Each refill starts in a browser task rather than a completion microtask.
      setTimeout(() => {
        queue.scheduled = false;
        for (const ticket of queue.pending) {
          if (queue.active >= BACKGROUND_INITIAL_RENDER_LIMIT) break;
          ticket.admit();
        }
      }, 0);
    },
  };
  if (view?.IntersectionObserver) {
    queue.observer = new view.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) queue.observed.get(entry.target)?.promote();
      }
    });
  }
  queues.set(document, queue);
  return queue;
}

/** A top-level initial preview owns admission through publication or cleanup.
 * Nested shell renders must use their parent's permit, never acquire another.
 * Promotion removes visible/explicit work from the background capacity count.
 */
export function createInitialRenderAdmission(root: HTMLElement, signal: AbortSignal) {
  let state: 'idle' | 'queued' | 'active' | 'foreground' | 'finished' = 'idle';
  let queue: DocumentQueue | undefined;
  let pending: Promise<void> | undefined;
  let resolve: (() => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
  const unobserve = () => {
    queue?.observer?.unobserve(root);
    queue?.observed.delete(root);
  };
  const detach = () => {
    unobserve();
    signal.removeEventListener('abort', abort);
  };
  const promote = () => {
    if (state === 'finished' || state === 'foreground') return;
    if (state === 'active') queue!.active -= 1;
    queue?.pending.delete(ticket);
    state = 'foreground';
    detach();
    resolve?.();
    queue?.drain();
  };
  const abort = () => {
    // Already-started rendering retains capacity until its owner has cleaned
    // up. Only queued work can be retired immediately on cancellation.
    if (state === 'queued') {
      queue!.pending.delete(ticket);
      state = 'finished';
      reject?.(signal.reason);
      queue!.drain();
    }
    detach();
  };
  const ticket: InitialRenderTicket = {
    promote,
    admit() {
      if (state !== 'queued') return;
      queue!.pending.delete(ticket);
      queue!.active += 1;
      state = 'active';
      resolve!();
    },
  };
  return {
    acquire(): Promise<void> {
      signal.throwIfAborted();
      if (pending) return pending;
      if (state === 'foreground' || state === 'finished') return Promise.resolve();
      queue = documentQueue(root.ownerDocument);
      const view = root.ownerDocument.defaultView;
      const rect = root.getBoundingClientRect();
      // Missing intersection observation cannot safely defer visible work.
      if (
        !queue.observer ||
        (rect.bottom > 0 && rect.top < (view?.innerHeight ?? 0) &&
          rect.right > 0 && rect.left < (view?.innerWidth ?? 0))
      ) {
        promote();
        return Promise.resolve();
      }
      // Match previewerStartupTask's browser fallback: withResolvers is absent
      // in some supported browsers that still need initial preview rendering.
      pending = new Promise<void>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
      });
      state = 'queued';
      signal.addEventListener('abort', abort, { once: true });
      queue.observed.set(root, ticket);
      queue.observer.observe(root);
      queue.pending.add(ticket);
      queue.drain();
      return pending;
    },
    promote,
    release() {
      if (state === 'finished') return;
      if (state === 'active') queue!.active -= 1;
      queue?.pending.delete(ticket);
      state = 'finished';
      detach();
      queue?.drain();
    },
  };
}
