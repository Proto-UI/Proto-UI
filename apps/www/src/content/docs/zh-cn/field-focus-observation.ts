export type FieldFocusAttempt = {
  attempt: number;
  startedAt: number | null;
  state: 'pending' | 'resolved' | 'rejected';
  settledAt?: number | null;
  value?: boolean;
};

export type FieldFocusSnapshot = {
  nodeTimeOrigin: number | null;
  observedAt: number | null;
  attempts: FieldFocusAttempt[];
  diagnosticErrors: number;
};

/** Observe the existing getter once. No deadline, retry, focus or cancellation. */
export function createFieldFocusObservation(
  clock: () => number = () => performance.now(),
  nodeTimeOrigin?: number
) {
  const attempts: FieldFocusAttempt[] = [];
  let nextAttempt = 0;
  let diagnosticErrors = 0;
  const safely = <T>(read: () => T, fallback: T): T => {
    try {
      return read();
    } catch {
      diagnosticErrors++;
      return fallback;
    }
  };
  // Missing diagnostic times remain unknown. Never manufacture a timestamp or
  // let timing/recording failures skip the getter or replace its outcome.
  const now = () => safely<number | null>(clock, null);
  const origin = safely<number | null>(() => nodeTimeOrigin ?? performance.timeOrigin, null);
  return {
    async observe(getter: (attempt: number) => Promise<boolean>): Promise<boolean> {
      const attempt = ++nextAttempt;
      const entry = safely<FieldFocusAttempt | null>(() => {
        const entry: FieldFocusAttempt = { attempt, startedAt: now(), state: 'pending' };
        attempts.push(entry);
        return entry;
      }, null);
      try {
        const value = await getter(attempt);
        safely(() => {
          if (!entry) return;
          entry.state = 'resolved';
          entry.value = value;
          entry.settledAt = now();
        }, undefined);
        return value;
      } catch (error) {
        safely(() => {
          if (!entry) return;
          entry.state = 'rejected';
          entry.settledAt = now();
        }, undefined);
        throw error;
      }
    },
    snapshot(): FieldFocusSnapshot {
      const observedAt = now();
      const entries = safely(() => attempts.map((entry) => ({ ...entry })), []);
      return {
        nodeTimeOrigin: origin,
        observedAt,
        attempts: entries,
        diagnosticErrors,
      };
    },
  };
}

/** Standalone Locator.evaluate callback. Keep the original predicate and return
 * value; the sidecar reads identities only, never text, editor values or URLs. */
export function recordFieldFocusSample(el: Element, attempt: number): boolean {
  const value = el === document.activeElement;
  const targetWindow = window as typeof window & { __fieldFocusEvidence?: unknown[] };
  try {
    const identity = (node: Element | null) =>
      node
        ? {
            tag: node.localName,
            ref: node.closest('[data-demo-ref]')?.getAttribute('data-demo-ref') ?? null,
          }
        : null;
    const root = el.getRootNode();
    const isDocument = root.nodeType === 9;
    const isShadow = root instanceof ShadowRoot;
    const ownRoot = isDocument || isShadow ? (root as Document | ShadowRoot) : null;
    const sample = {
      attempt,
      at: performance.now(),
      pageTimeOrigin: performance.timeOrigin,
      value,
      connected: el.isConnected,
      documentHasFocus: document.hasFocus(),
      rootKind: isDocument ? 'document' : isShadow ? 'shadow' : 'other',
      rootHost: isShadow ? identity(root.host) : null,
      target: identity(el),
      documentActive: identity(document.activeElement),
      rootActive: identity(ownRoot?.activeElement ?? null),
      activeInOwnRoot: ownRoot?.activeElement === el,
    };
    (targetWindow.__fieldFocusEvidence ??= []).push(sample);
  } catch {
    // Diagnostics must not turn a successful original getter into a rejection.
    try {
      (targetWindow.__fieldFocusEvidence ??= []).push({ attempt, value, diagnosticError: true });
    } catch {
      // A damaged diagnostic sink is not authority to change the assertion.
    }
  }
  return value;
}
