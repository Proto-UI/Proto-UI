/** Website effect state. A renderer generation is a subscriber, never the operation owner. */
export type CopyState = 'idle' | 'pending' | 'success' | 'error';
export type CopySnapshot = Readonly<{ state: CopyState; revision: number; operation: number }>;

export function createCopyController(options: {
  readText(): string;
  writeText(text: string, signal: AbortSignal): Promise<void>;
  feedbackMs?: number;
}) {
  let text = options.readText();
  let revision = 0;
  let operation = 0;
  let state: CopyState = 'idle';
  let alive = true;
  let pending: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lifetime = new AbortController();
  const listeners = new Set<(snapshot: CopySnapshot) => void>();
  const snapshot = (): CopySnapshot => ({ state, revision, operation });
  const publish = () => listeners.forEach((listener) => listener(snapshot()));
  const clearFeedback = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const syncSource = () => {
    if (!alive) return;
    const next = options.readText();
    if (next === text) return;
    text = next;
    revision += 1;
    clearFeedback();
    state = pending ? 'pending' : 'idle';
    publish();
  };
  return {
    snapshot,
    syncSource,
    subscribe(listener: (snapshot: CopySnapshot) => void) {
      if (!alive) return () => {};
      listeners.add(listener);
      listener(snapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    copy(): Promise<boolean> {
      if (!alive) return Promise.resolve(false);
      syncSource();
      if (pending) return pending;
      clearFeedback();
      const sourceRevision = revision;
      const id = ++operation;
      state = 'pending';
      // Reserve the operation before calling any subscriber or platform effect.
      let resolve!: (result: boolean) => void;
      const result = new Promise<boolean>((done) => {
        resolve = done;
      });
      pending = result;
      publish();
      const finish = (success: boolean) => {
        if (!alive || id !== operation) {
          resolve(false);
          return;
        }
        syncSource();
        pending = null;
        state = sourceRevision === revision ? (success ? 'success' : 'error') : 'idle';
        publish();
        if (state === 'success' || state === 'error') {
          timer = setTimeout(() => {
            timer = undefined;
            if (!alive || id !== operation) return;
            state = 'idle';
            publish();
          }, options.feedbackMs ?? 1500);
        }
        resolve(success && sourceRevision === revision);
      };
      // Invoke in the trusted activation task; do not await mounting or runtime loading.
      try {
        Promise.resolve(options.writeText(text, lifetime.signal)).then(
          () => finish(true),
          () => finish(false)
        );
      } catch {
        finish(false);
      }
      return result;
    },
    dispose() {
      if (!alive) return;
      alive = false;
      operation += 1;
      lifetime.abort();
      clearFeedback();
      listeners.clear();
    },
  };
}

export type CopyController = ReturnType<typeof createCopyController>;

/** Preserve EC's legacy fallback, including its boolean failure, without stealing final focus. */
export async function writeClipboard(
  doc: Document,
  text: string,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new Error('Copy owner disposed');
  try {
    const clipboard = doc.defaultView?.navigator.clipboard;
    if (!clipboard) throw new Error('Clipboard API unavailable');
    await clipboard.writeText(text);
    return;
  } catch (error) {
    // The OS write cannot be cancelled, but its rejected continuation must not
    // create a fallback field or move selection after the page owner is gone.
    if (signal?.aborted) throw error;
    // Deliberate legacy compatibility boundary, retained from ExpressiveCode.
    const legacy = doc as unknown as { execCommand?(command: string): boolean };
    if (typeof legacy.execCommand !== 'function') throw error;
    const focused = doc.activeElement as HTMLElement | null;
    const selection = doc.getSelection();
    const ranges = selection
      ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange())
      : [];
    const input = focused as HTMLInputElement | HTMLTextAreaElement | null;
    const inputSelection =
      input && typeof input.selectionStart === 'number'
        ? ([
            input.selectionStart,
            input.selectionEnd,
            input.selectionDirection ?? undefined,
          ] as const)
        : null;
    const field = doc.createElement('textarea');
    field.value = text;
    field.tabIndex = -1;
    field.setAttribute('aria-hidden', 'true');
    Object.assign(field.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0' });
    doc.body.append(field);
    try {
      field.focus({ preventScroll: true });
      field.select();
      if (!legacy.execCommand('copy')) throw error;
    } finally {
      const stillOwnsFocus = doc.activeElement === field;
      field.remove();
      if (stillOwnsFocus && focused?.isConnected) focused.focus({ preventScroll: true });
      if (stillOwnsFocus) {
        selection?.removeAllRanges();
        for (const range of ranges) selection?.addRange(range);
        if (inputSelection && input?.isConnected) input.setSelectionRange(...inputSelection);
      }
    }
  }
}
