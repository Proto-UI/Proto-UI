import { browserSha256 } from './hash';
import {
  BROWSER_COMPILER_LIMITS,
  type BrowserCompileRequest,
  type BrowserCompilerBuild,
  type CompilerWorkerResponse,
} from './protocol';

export interface BrowserCompilerClient {
  readonly build: BrowserCompilerBuild;
  compile(request: BrowserCompileRequest): Promise<CompilerWorkerResponse>;
  dispose(): void;
}

export interface BrowserCompilerClientOptions {
  signal?: AbortSignal;
  workerFactory?: () => Worker;
}

/** A digest-bound Worker owns compilation; no authored module runs in this page. */
export async function createBrowserCompilerClient(
  bundle: string,
  build: BrowserCompilerBuild,
  options: BrowserCompilerClientOptions = {}
): Promise<BrowserCompilerClient> {
  if (options.signal?.aborted)
    throw new DOMException('Browser compiler client creation aborted.', 'AbortError');
  if (
    build.format !== 2 ||
    build.execution !== 'worker-js' ||
    JSON.stringify(build.targets) !== '["react"]' ||
    !/^[a-f0-9]{64}$/.test(build.authoringSha256) ||
    (await browserSha256(bundle)) !== build.compilerSha256
  )
    throw new Error('Browser compiler bundle does not match its AST build manifest.');
  if (options.signal?.aborted)
    throw new DOMException('Browser compiler client creation aborted.', 'AbortError');
  const identity = Object.freeze({ ...build, targets: Object.freeze(['react'] as const) });
  const url = options.workerFactory
    ? undefined
    : URL.createObjectURL(new Blob([bundle], { type: 'text/javascript' }));
  let worker: Worker;
  try {
    worker = options.workerFactory
      ? options.workerFactory()
      : new Worker(url!, { name: 'proto-ui-compiler' });
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    throw error;
  }
  let disposed = false;
  let nextId = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let pending:
    | {
        id: number;
        hash: string;
        revision: string;
        resolve(response: CompilerWorkerResponse): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const initialization = setTimeout(
    () => fail(new Error('Compiler Worker initialization exceeded its deadline.')),
    BROWSER_COMPILER_LIMITS.initializationMs
  );
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(initialization);
    worker.terminate();
    worker.removeEventListener('message', message);
    worker.removeEventListener('error', onError);
    worker.removeEventListener('messageerror', onMessageError);
    options.signal?.removeEventListener('abort', dispose);
    if (url) URL.revokeObjectURL(url);
    const error = new DOMException('Browser compiler client has been disposed.', 'AbortError');
    readyReject(error);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
  }
  function fail(error: Error) {
    readyReject(error);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
    dispose();
  }
  function message(event: MessageEvent) {
    const response = event.data;
    if (JSON.stringify(response?.build) !== JSON.stringify(identity)) {
      fail(new Error('Compiler Worker response has a mismatched build identity.'));
      return;
    }
    if (response.type === 'ready') {
      clearTimeout(initialization);
      readyResolve();
      return;
    }
    if (
      !pending ||
      response.type !== 'compiled' ||
      response.id !== pending.id ||
      response.requestSha256 !== pending.hash ||
      response.result?.requestSha256 !== pending.hash ||
      response.result?.revision !== pending.revision
    ) {
      fail(new Error('Compiler Worker response does not match the active source revision.'));
      return;
    }
    clearTimeout(pending.timer);
    pending.resolve(response as CompilerWorkerResponse);
    pending = undefined;
  }
  function onError(event: ErrorEvent) {
    fail(new Error(event.message || 'Compiler Worker failed.'));
  }
  function onMessageError() {
    fail(new Error('Compiler Worker returned an unreadable message.'));
  }
  worker.addEventListener('message', message);
  worker.addEventListener('error', onError);
  worker.addEventListener('messageerror', onMessageError);
  options.signal?.addEventListener('abort', dispose, { once: true });
  worker.postMessage({ type: 'initialize', build: identity });
  try {
    await ready;
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    build: identity,
    compile(input) {
      const request = structuredClone(input);
      const run = queue
        .catch(() => undefined)
        .then(async () => {
          if (disposed)
            throw new DOMException('Browser compiler client has been disposed.', 'AbortError');
          const hash = await browserSha256(JSON.stringify(request));
          if (disposed)
            throw new DOMException('Browser compiler client has been disposed.', 'AbortError');
          const id = ++nextId;
          return new Promise<CompilerWorkerResponse>((resolve, reject) => {
            const timer = setTimeout(() => {
              pending = undefined;
              resolve({
                type: 'compiled',
                id,
                requestSha256: hash,
                build: identity,
                elapsedMs: BROWSER_COMPILER_LIMITS.compilationMs,
                result: {
                  ok: false,
                  revision: request.revision,
                  requestSha256: hash,
                  phase: 'host',
                  error: {
                    code: 'execution-limit',
                    message: 'Compilation exceeded its deadline; this Worker was retired.',
                  },
                },
              });
              dispose();
            }, BROWSER_COMPILER_LIMITS.compilationMs);
            pending = { id, hash, revision: request.revision, resolve, reject, timer };
            worker.postMessage({ type: 'compile', id, request });
          });
        });
      queue = run;
      return run;
    },
    dispose,
  };
}
