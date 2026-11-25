import environment from 'pui:compiler-authoring';
import { compileBrowserRequest } from './engine';
import type {
  BrowserCompilerBuild,
  CompilerWorkerRequest,
  CompilerWorkerResponse,
} from './protocol';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<CompilerWorkerRequest>) => void) | null;
  postMessage(message: unknown): void;
};
let build: BrowserCompilerBuild | undefined;
scope.onmessage = (event) => {
  const input = event.data;
  if (input?.type === 'initialize') {
    if (
      build ||
      input.build.format !== 2 ||
      input.build.execution !== 'worker-js' ||
      input.build.typescriptVersion !== environment.typescriptVersion
    )
      throw new Error('Compiler Worker build identity is invalid.');
    build = Object.freeze({ ...input.build });
    scope.postMessage({ type: 'ready', build });
    return;
  }
  if (input?.type !== 'compile' || !build || !Number.isSafeInteger(input.id) || input.id < 1)
    throw new Error('Compiler Worker requires an initialized compilation request.');
  const identity = build;
  const started = performance.now();
  void compileBrowserRequest(input.request, environment).then((result) => {
    const response: CompilerWorkerResponse = {
      type: 'compiled',
      id: input.id,
      requestSha256: result.requestSha256 ?? '',
      result,
      build: identity,
      elapsedMs: performance.now() - started,
    };
    scope.postMessage(response);
  });
};
