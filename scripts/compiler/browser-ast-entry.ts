import {
  createBrowserCompilerClient,
  type BrowserCompilerClient,
} from '../../packages/compiler/src/browser/client';
import type {
  BrowserCompileRequest,
  BrowserCompilerBuild,
} from '../../packages/compiler/src/browser/protocol';
import {
  CompiledRevisionSession,
  type RevisionState,
} from '../../apps/www/src/components/PrototypePreviewer/compiled-revision-session';
import {
  mountCompiledPreview,
  type BrowserTargetAssets,
  type CompiledPreviewItem,
} from '../../apps/www/src/components/PrototypePreviewer/compiled-preview-sandbox';

let client: BrowserCompilerClient | undefined;
let session: CompiledRevisionSession | undefined;
let latest: RevisionState = { phase: 'idle', revision: '' };
let items: readonly CompiledPreviewItem[] = [{ props: {}, text: 'Actual Base content' }];

const harness = {
  async open() {
    await session?.dispose();
    const [bundle, build, target] = await Promise.all([
      fetch('/compiler.js').then((response) => response.text()),
      fetch('/build.json').then((response) => response.json()) as Promise<BrowserCompilerBuild>,
      fetch('/targets/react.json').then((response) =>
        response.json()
      ) as Promise<BrowserTargetAssets>,
    ]);
    client = await createBrowserCompilerClient(bundle, build);
    const owner = client;
    session = new CompiledRevisionSession({
      compile: async (request) => (await owner.compile(request)).result,
      prepare: async (result) => () =>
        mountCompiledPreview(
          document.getElementById('preview')!,
          result,
          target,
          [...items],
          (error) => session?.fail(result.revision, error)
        ),
      state: (state) => {
        latest = state;
      },
      disposeCompiler: () => owner.dispose(),
    });
    return owner.build;
  },
  async compile(request: BrowserCompileRequest, nextItems?: readonly CompiledPreviewItem[]) {
    if (nextItems) items = nextItems;
    if (!session) throw new Error('The verification session has not been opened.');
    await session.compile(request);
    return latest;
  },
  async cancel(request: BrowserCompileRequest) {
    if (!session) throw new Error('The verification session has not been opened.');
    const compilation = session.compile(request);
    await session.dispose();
    await compilation;
    session = undefined;
    return latest;
  },
  async rejectTamperedBuild() {
    const bundle = await fetch('/compiler.js').then((response) => response.text());
    const build = (await fetch('/build.json').then((response) =>
      response.json()
    )) as BrowserCompilerBuild;
    try {
      await createBrowserCompilerClient(bundle + '\n0', build);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    throw new Error('Tampered compiler code was accepted.');
  },
  async close() {
    await session?.dispose();
    session = undefined;
    return latest;
  },
};
Object.assign(globalThis, { compilerHarness: harness });
