import type {
  BrowserCompileRequest,
  BrowserCompilerBuild,
  CompilerWorkerResponse,
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

/**
 * Lightweight browser compiler client boundary (0.4 scope — QuickJS-in-WASM removed per #1809).
 * Keeps website previewer types intact while browser compilation transitions to the v2 pipeline.
 */
export async function createBrowserCompilerClient(
  _bundle: string,
  build: BrowserCompilerBuild,
  options: BrowserCompilerClientOptions = {}
): Promise<BrowserCompilerClient> {
  if (options.signal?.aborted) {
    throw new DOMException('Browser compiler client creation aborted.', 'AbortError');
  }
  const identity = Object.freeze({ ...build });
  let disposed = false;
  let nextId = 0;

  return {
    build: identity,
    async compile(request) {
      if (disposed) {
        throw new DOMException('Browser compiler client has been disposed.', 'AbortError');
      }
      const started = performance.now();
      return {
        type: 'compiled',
        id: ++nextId,
        requestSha256: '0'.repeat(64),
        build: identity,
        elapsedMs: performance.now() - started,
        result: {
          ok: false,
          revision: request.revision,
          phase: 'host',
          error: {
            code: 'wasm-execution',
            message:
              'Legacy QuickJS-in-WASM browser compiler was removed in #1809 (0.4 rebuild). Use the v2 Node/LLVM compiler pipeline.',
          },
        },
      };
    },
    dispose() {
      disposed = true;
    },
  };
}
