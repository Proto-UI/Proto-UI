import { BROWSER_COMPILER_LIMITS } from './protocol';
import type {
  BrowserCompileRequest,
  BrowserCompilerBuild,
  CompilerWorkerOutput,
  CompilerWorkerResponse,
} from './protocol';

export interface BrowserCompilerClient {
  readonly build: BrowserCompilerBuild;
  /** Superseded requests reject with AbortError; only one running and one newest queued edit are retained. */
  compile(request: BrowserCompileRequest): Promise<CompilerWorkerResponse>;
  dispose(): void;
}

type Pending = {
  id: number;
  request: BrowserCompileRequest;
  revision: string;
  resolve(response: CompilerWorkerResponse): void;
  reject(error: Error): void;
};

/** The caller owns the worker. Termination drops its entire WASM heap and pending work. */
export function createBrowserCompilerClient(
  bundle: string,
  build: BrowserCompilerBuild
): Promise<BrowserCompilerClient> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let disposed = false,
      nextId = 0,
      running: number | null = null;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let pending: Pending | null = null;
    let latest: Pending | null = null;
    const abort = () =>
      new DOMException('Compiler request was superseded or disposed.', 'AbortError');
    const dispatch = (item: Pending) => {
      running = item.id;
      try {
        worker.postMessage({ type: 'compile', id: item.id, request: item.request });
        deadline = setTimeout(
          () =>
            fail(
              new DOMException('Compiler worker response exceeded its deadline.', 'TimeoutError')
            ),
          BROWSER_COMPILER_LIMITS.workerResponseMs
        );
      } catch (error) {
        running = null;
        if (latest === item) latest = null;
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      latest?.reject(abort());
      latest = null;
      pending = null;
      clearTimeout(deadline);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const fail = (failure: Error) => {
      latest?.reject(failure);
      reject(failure);
      dispose();
    };
    worker.onerror = (event) => fail(new Error(event.message || 'Compiler worker failed.'));
    worker.onmessageerror = () => fail(new Error('Compiler worker response could not be decoded.'));
    worker.onmessage = (event: MessageEvent<CompilerWorkerOutput>) => {
      if (disposed) return;
      const message = event.data;
      if (message.type === 'initialization-error') {
        reject(new Error(message.message));
        dispose();
        return;
      }
      if (message.type === 'ready') {
        clearTimeout(deadline);
        resolve({
          build: Object.freeze({ ...message.build }),
          compile(request) {
            if (disposed) return Promise.reject(abort());
            return new Promise((resolveResult, rejectResult) => {
              // postMessage snapshots immediate work; queued work must own its graph now.
              const submitted = running !== null ? structuredClone(request) : request;
              latest?.reject(abort());
              const item: Pending = {
                id: ++nextId,
                request: submitted,
                revision: submitted.revision,
                resolve: resolveResult,
                reject: rejectResult,
              };
              latest = item;
              if (running !== null) pending = item;
              else dispatch(item);
            });
          },
          dispose,
        });
        return;
      }
      if (message.type !== 'compiled' || message.id !== running) return;
      clearTimeout(deadline);
      running = null;
      if (latest?.id === message.id) {
        const item = latest;
        latest = null;
        if (
          message.result.revision !== item.revision ||
          message.build.compilerSha256 !== build.compilerSha256
        )
          item.reject(
            new Error('Compiler response does not match the requested revision and build.')
          );
        else item.resolve(message);
      }
      if (pending) {
        const item = pending;
        pending = null;
        dispatch(item);
      }
    };
    deadline = setTimeout(
      () =>
        fail(
          new DOMException('Compiler worker initialization exceeded its deadline.', 'TimeoutError')
        ),
      BROWSER_COMPILER_LIMITS.initializationMs
    );
    try {
      worker.postMessage({ type: 'initialize', bundle, build });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
