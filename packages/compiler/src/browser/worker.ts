import wasmLocation from '@jitl/quickjs-wasmfile-release-sync/wasm?url';
import { createBrowserCompiler, type BrowserCompiler } from './engine';
import type { BrowserCompilerBuild, CompilerWorkerInput, CompilerWorkerOutput } from './protocol';

let initialization: Promise<BrowserCompiler> | undefined;
let build: BrowserCompilerBuild | undefined;
const send = (message: CompilerWorkerOutput) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<CompilerWorkerInput>) => {
  const message = event.data;
  if (message.type === 'initialize') {
    if (initialization) return;
    build = message.build;
    initialization = createBrowserCompiler(message.bundle, message.build, { wasmLocation });
    try {
      send({ type: 'ready', build: (await initialization).build });
    } catch (error) {
      send({
        type: 'initialization-error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }
  if (message.type !== 'compile' || !initialization || !build) return;
  const requestBuild = build;
  const started = performance.now();
  try {
    const compiler = await initialization;
    send({
      type: 'compiled',
      id: message.id,
      result: compiler.compile(message.request),
      build: compiler.build,
      elapsedMs: performance.now() - started,
    });
  } catch (error) {
    // Host/transport failures are distinct from source-bound compiler diagnostics.
    send({
      type: 'compiled',
      id: message.id,
      build: requestBuild,
      elapsedMs: performance.now() - started,
      result: {
        ok: false,
        revision: message.request.revision,
        phase: 'host',
        error: {
          code: 'wasm-execution',
          message: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }
};
