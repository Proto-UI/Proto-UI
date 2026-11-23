const pendingPublicationReads = new WeakMap<Document, Array<() => void>>();

/** Read each scope's live theme before any sampled publication resumes. */
export function scheduleProjectionThemeRead<T>(scope: Element, read: () => T): Promise<T> {
  const document = scope.ownerDocument;
  return new Promise<T>((resolve, reject) => {
    const sample = () => {
      try {
        resolve(read());
      } catch (error) {
        reject(error);
      }
    };
    const pending = pendingPublicationReads.get(document);
    if (pending) {
      pending.push(sample);
      return;
    }
    const batch = [sample];
    pendingPublicationReads.set(document, batch);
    const flush = () => {
      pendingPublicationReads.delete(document);
      for (const read of batch) read();
    };
    const view = document.defaultView as
      | (Window & {
          scheduler?: {
            postTask(callback: () => void, options: { priority: 'user-blocking' }): Promise<void>;
          };
        })
      | null;
    const scheduleMicrotask = () => {
      if (view) view.queueMicrotask(flush);
      else queueMicrotask(flush);
    };
    // This batch gates first publication. Avoid leaving it behind other timers.
    const task = view?.scheduler?.postTask?.(flush, { priority: 'user-blocking' });
    if (task) void task.catch(scheduleMicrotask);
    else scheduleMicrotask();
  });
}
