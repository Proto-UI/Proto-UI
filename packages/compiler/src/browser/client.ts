import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { BROWSER_COMPILER_LIMITS } from './protocol';
import type {
  BrowserCompileRequest,
  BrowserCompilerBuild,
  CompilerWorkerOutput,
  CompilerWorkerResponse,
} from './protocol';

export interface BrowserCompilerClient {
  readonly build: BrowserCompilerBuild;
  /** One running request and one newest queued snapshot; superseded work rejects. */
  compile(request: BrowserCompileRequest): Promise<CompilerWorkerResponse>;
  dispose(): void;
}
export interface BrowserCompilerClientOptions {
  signal?: AbortSignal;
  /** Inject a real transport in embeddings, or a controlled transport in tests. */
  workerFactory?: () => Worker;
}
type Pending = {
  id: number;
  request: BrowserCompileRequest;
  requestSha256: string;
  resolve(response: CompilerWorkerResponse): void;
  reject(error: Error): void;
};
const sameBuild = (a: BrowserCompilerBuild | undefined, b: BrowserCompilerBuild) =>
  !!a &&
  a.format === b.format &&
  a.compilerSha256 === b.compilerSha256 &&
  a.typescriptVersion === b.typescriptVersion &&
  a.execution === b.execution;
const abort = () => new DOMException('Compiler request was superseded or disposed.', 'AbortError');
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function validResult(value: unknown, request: BrowserCompileRequest): boolean {
  if (!record(value) || typeof value.ok !== 'boolean') return false;
  if (!value.ok) {
    if (value.phase === 'compile')
      return (
        Array.isArray(value.diagnostics) &&
        value.diagnostics.every(
          (entry: unknown) =>
            record(entry) &&
            typeof entry.code === 'string' &&
            typeof entry.message === 'string' &&
            record(entry.span)
        )
      );
    return (
      value.phase === 'host' &&
      record(value.error) &&
      [
        'invalid-request',
        'input-limit',
        'execution-limit',
        'wasm-execution',
        'preview-policy',
        'disposed',
      ].includes(value.error.code) &&
      typeof value.error.message === 'string'
    );
  }
  const profile =
    typeof request.options.profile === 'string'
      ? request.options.profile
      : request.options.profile.profile;
  if (
    !record(value.source) ||
    !/^[a-f0-9]{64}$/.test(value.source.sha256) ||
    !record(value.output) ||
    typeof value.output.code !== 'string' ||
    typeof value.output.profile !== 'string' ||
    (profile && value.output.profile !== profile) ||
    !Array.isArray(value.output.dependencies) ||
    !value.output.dependencies.every(
      (dependency: unknown) =>
        record(dependency) &&
        typeof dependency.name === 'string' &&
        typeof dependency.version === 'string'
    )
  )
    return false;
  if (
    value.output.supportingFiles !== undefined &&
    (!Array.isArray(value.output.supportingFiles) ||
      !value.output.supportingFiles.every(
        (file: unknown) =>
          record(file) &&
          typeof file.path === 'string' &&
          typeof file.contents === 'string' &&
          ['source', 'style', 'declaration'].includes(file.kind)
      ))
  )
    return false;
  if (request.preview) {
    const preview = value.preview;
    if (
      !record(preview) ||
      preview.format !== 1 ||
      typeof preview.entry !== 'string' ||
      !record(preview.modules) ||
      !Object.values(preview.modules).every((source) => typeof source === 'string') ||
      typeof preview.modules[preview.entry] !== 'string' ||
      !Array.isArray(preview.styles) ||
      !preview.styles.every((style: unknown) => typeof style === 'string') ||
      !Array.isArray(preview.events) ||
      !preview.events.every((name: unknown) => typeof name === 'string') ||
      preview.executionBudget !== '100000-checkpoints-per-task-v1'
    )
      return false;
  }
  return true;
}

/** Every request is snapshotted before queueing. The caller owns the complete Worker lifetime. */
export async function createBrowserCompilerClient(
  bundle: string,
  build: BrowserCompilerBuild,
  options: BrowserCompilerClientOptions = {}
): Promise<BrowserCompilerClient> {
  if (options.signal?.aborted) throw abort();
  if (
    build?.format !== 1 ||
    build.execution !== 'quickjs-wasm' ||
    !/^[a-f0-9]{64}$/.test(build.compilerSha256) ||
    typeof build.typescriptVersion !== 'string' ||
    !build.typescriptVersion
  )
    throw new TypeError('Invalid browser compiler build identity.');
  const identity = Object.freeze({ ...build });
  const worker =
    options.workerFactory?.() ??
    new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    let disposed = false,
      initialized = false,
      nextId = 0;
    let running: Pending | null = null,
      latest: Pending | null = null,
      queued: Pending | null = null;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      reject(abort());
      latest?.reject(abort());
      running = latest = queued = null;
      clearTimeout(deadline);
      options.signal?.removeEventListener('abort', dispose);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
    };
    const fail = (error: Error) => {
      latest?.reject(error);
      reject(error);
      dispose();
    };
    const dispatch = (item: Pending) => {
      running = item;
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
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };
    worker.onerror = (event) => fail(new Error(event.message || 'Compiler worker failed.'));
    worker.onmessageerror = () => fail(new Error('Compiler worker response could not be decoded.'));
    worker.onmessage = (event: MessageEvent<CompilerWorkerOutput>) => {
      if (disposed) return;
      const message = event.data;
      if (!message || typeof message !== 'object') {
        fail(new Error('Malformed compiler worker response.'));
        return;
      }
      if (message.type === 'initialization-error') {
        fail(new Error(message.message));
        return;
      }
      if (message.type === 'ready') {
        if (initialized || !sameBuild(message.build, identity)) {
          fail(new Error('Compiler worker build identity mismatch.'));
          return;
        }
        initialized = true;
        clearTimeout(deadline);
        resolve({
          build: identity,
          compile(request) {
            if (disposed) return Promise.reject(abort());
            let snapshot: BrowserCompileRequest, requestSha256: string;
            try {
              const serialized = JSON.stringify(request);
              if (
                typeof serialized !== 'string' ||
                new TextEncoder().encode(serialized).byteLength > BROWSER_COMPILER_LIMITS.inputBytes
              )
                throw new TypeError(
                  'Closed compiler request exceeds its byte bound or is not serializable.'
                );
              snapshot = JSON.parse(serialized);
              requestSha256 = bytesToHex(sha256(new TextEncoder().encode(serialized)));
            } catch (error) {
              return Promise.reject(error instanceof Error ? error : new Error(String(error)));
            }
            latest?.reject(abort());
            return new Promise((resolveResult, rejectResult) => {
              const item: Pending = {
                id: ++nextId,
                request: snapshot,
                requestSha256,
                resolve: resolveResult,
                reject: rejectResult,
              };
              latest = item;
              if (running) queued = item;
              else dispatch(item);
            });
          },
          dispose,
        });
        return;
      }
      if (message.type !== 'compiled') {
        fail(new Error('Unknown compiler worker response.'));
        return;
      }
      if (!running || message.id !== running.id) return;
      const completed = running;
      if (
        !sameBuild(message.build, identity) ||
        !validResult(message.result, completed.request) ||
        message.result.revision !== completed.request.revision ||
        message.requestSha256 !== completed.requestSha256 ||
        ((message.result.ok || message.result.phase !== 'host') &&
          message.result.requestSha256 !== completed.requestSha256)
      ) {
        fail(
          new Error(
            'Compiler response does not match the queued source, target, revision and build.'
          )
        );
        return;
      }
      clearTimeout(deadline);
      running = null;
      if (latest === completed) {
        latest = null;
        completed.resolve(message);
      }
      if (queued) {
        const next = queued;
        queued = null;
        dispatch(next);
      }
    };
    options.signal?.addEventListener('abort', dispose, { once: true });
    if (options.signal?.aborted) {
      dispose();
      return;
    }
    deadline = setTimeout(
      () =>
        fail(
          new DOMException('Compiler worker initialization exceeded its deadline.', 'TimeoutError')
        ),
      BROWSER_COMPILER_LIMITS.initializationMs
    );
    try {
      worker.postMessage({ type: 'initialize', bundle, build: identity });
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
