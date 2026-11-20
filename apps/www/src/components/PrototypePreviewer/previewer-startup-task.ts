/** Yield eager startup to a browser task without depending on paint or idle time.
 * The owner must also check its identity after awaiting the task. */
export function previewerStartupTask(element: Element, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const view = element.ownerDocument.defaultView as
    | (Window & {
        scheduler?: {
          postTask(
            callback: () => void,
            options: { priority: 'background'; signal: AbortSignal }
          ): Promise<void>;
        };
      })
    | null;
  if (view?.scheduler?.postTask)
    return view.scheduler.postTask(() => undefined, { priority: 'background', signal });
  // Promise.withResolvers is unavailable in some browsers that need this fallback.
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 0);
    signal.addEventListener('abort', abort, { once: true });
  });
}
