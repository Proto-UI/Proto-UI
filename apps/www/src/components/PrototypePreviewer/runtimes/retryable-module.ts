/**
 * Import failures are cached by URL in the browser's module map. Clearing our
 * Promise alone cannot recover that URL. Each subsequent user attempt imports
 * the same build-bound module at a fresh same-origin URL; successful modules
 * and in-flight acquisition are shared. No error message supplies an import URL.
 */
export function retryableModule<T>(
  load: () => Promise<T>,
  moduleUrl: string,
  importModule: (url: string) => Promise<T> = (url) => import(/* @vite-ignore */ url)
): () => Promise<T> {
  let pending: Promise<T> | undefined;
  let attempt = 0;
  return () => {
    if (pending) return pending;
    const currentAttempt = attempt++;
    pending = Promise.resolve()
      .then(() => {
        if (currentAttempt === 0) return load();
        const url = new URL(moduleUrl, globalThis.location.href);
        if (url.origin !== globalThis.location.origin || !/^https?:$/.test(url.protocol)) {
          throw new Error('[PrototypePreviewer] runtime recovery requires a same-origin module');
        }
        url.searchParams.set('pui-runtime-retry', String(currentAttempt));
        return importModule(url.href);
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
    return pending;
  };
}
