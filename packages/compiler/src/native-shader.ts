import type { GeneratedModule } from './ir';
import { createHash } from 'node:crypto';
import type { ShaderKernel } from '../../core/src/shader-presentation';
import {
  nativeShaderHostSha256,
  nativeShaderSceneHostSource,
  nativeShaderSceneHostSha256,
} from './native-shader-host.generated';
import { specializeNativeShaderHost } from './native-shader-specialization';

export function nativeShaderArtifacts(
  kernels: readonly ShaderKernel[],
  scenes = false
): NonNullable<GeneratedModule['supportingFiles']> {
  const specialized = specializeNativeShaderHost(kernels);
  const sceneSource = nativeShaderSceneHostSource.replace(
    "from './shader-webgl2-host'",
    "from './webgl2-host-v1'"
  );
  return [
    { path: '.proto-ui/shader/webgl2-host-v1.ts', kind: 'source', contents: specialized.source },
    ...(scenes
      ? [
          {
            path: '.proto-ui/shader/scene-web-v1.ts',
            kind: 'source' as const,
            contents: sceneSource,
          },
        ]
      : []),
    {
      path: '.proto-ui/shader/kernel-identities-v1.json',
      kind: 'source',
      contents:
        JSON.stringify(
          {
            version: 1,
            provenance: 'first-party MIT',
            source: 'packages/adapters/base/src/material/shader-webgl2-host.ts',
            hostSha256: nativeShaderHostSha256,
            emittedHostSha256: specialized.sha256,
            kernels: specialized.kernels,
            ...(scenes
              ? {
                  sceneSource: 'packages/adapters/base/src/material/shader-scene-host.ts',
                  sceneHostSha256: nativeShaderSceneHostSha256,
                  emittedSceneHostSha256: createHash('sha256').update(sceneSource).digest('hex'),
                }
              : {}),
          },
          null,
          2
        ) + '\n',
    },
    {
      path: '.proto-ui/shader/owner-web-v1.ts',
      kind: 'source',
      contents: `import {createWebShaderPresenter, type WebShaderProgram} from './webgl2-host-v1';
${scenes ? "import type {WebShaderScenePresenter, WebShaderSceneProgram, WebShaderHostOptions} from './scene-web-v1';" : ''}
/** Physical owner lifecycle only. The compiler supplies the finite direct pass program. */
export function createNativeShader(options: {setup(): void; alive(): boolean; root(): HTMLElement | null; prepare(): void${scenes ? '; host?: WebShaderHostOptions' : ''}}) {
  type Declaration = {kind:'pixels'; key:string; fallback:readonly [number,number,number,number]; program:WebShaderProgram}${scenes ? " | {kind:'scene'; slot:string; resources:number; key:string; fallback:readonly [number,number,number,number]; program:WebShaderSceneProgram}" : ''};
  let declaration: Declaration | null = null;
  let view = 0, revision = 0, mounted = false, disposed = false${scenes ? ', turn = 0' : ''};
  ${scenes ? 'let' : 'const'} presenter = createWebShaderPresenter({root:options.root, prepare:options.prepare});
  ${
    scenes
      ? `let scene: WebShaderScenePresenter | undefined;
  let cleanupDepth = 0, draining = false, pendingRefresh = false;
  function duringCleanup(work: () => void) {
    cleanupDepth++;
    try { work(); } finally { cleanupDepth--; }
  }
  function drain() {
    if (cleanupDepth || draining) return;
    draining = true;
    try {
      while (pendingRefresh) { pendingRefresh = false; refresh(); }
    } finally { draining = false; }
  }
  function retireScene(previous: WebShaderScenePresenter | undefined) {
    duringCleanup(() => previous?.dispose());
  }
  function retirePublishers(dispose: boolean) {
    const previousPresenter = presenter, previousScene = scene, currentView = view;
    try {
      duringCleanup(() => {
        if (dispose) { previousPresenter.dispose(); previousScene?.dispose(); }
        else { previousPresenter.release(currentView); previousScene?.release(currentView); }
      });
    } finally { drain(); }
  }`
      : ''
  }
  function refresh() {
    if (disposed || !mounted || !declaration || !options.alive()) return;${
      scenes
        ? `
    if (cleanupDepth) { turn++; pendingRefresh = true; return; }
    try {`
        : ''
    }
    ${
      scenes
        ? `const selected = declaration, operation = ++turn;
    if (selected.kind === 'scene') {
      const frame = {view, revision:++revision, key:selected.key, fallback:selected.fallback};
      if (!scene) {
        let acquired: WebShaderScenePresenter | undefined;
        try { acquired = options.host?.createScenePresenter({root:options.root, prepare:options.prepare}); }
        catch { if (!disposed && mounted && turn === operation && declaration === selected) presenter.commit(frame, null, undefined, undefined, 'shader-scene-host-failed'); return; }
        if (disposed || !mounted || turn !== operation || declaration !== selected || !options.alive()) { retireScene(acquired); return; }
        if (acquired) {
          const fallback = presenter;
          presenter = createWebShaderPresenter({root:options.root, prepare:options.prepare});
          duringCleanup(() => fallback.dispose());
          if (disposed || !mounted || turn !== operation || declaration !== selected || !options.alive()) { retireScene(acquired); return; }
        }
        scene = acquired;
      }
      if (scene) scene.commit({...frame, slot:selected.slot, resources:selected.resources}, selected.program);
      else presenter.commit(frame, null, undefined, undefined, 'shader-scene-capability-unavailable');
      return;
    }`
        : ''
    }
    presenter.commit({view, revision:++revision, key:${scenes ? 'selected' : 'declaration'}.key, fallback:${scenes ? 'selected' : 'declaration'}.fallback}, ${scenes ? 'selected' : 'declaration'}.program);${
      scenes
        ? `
    } finally { drain(); }`
        : ''
    }
  }
  function register(input: Declaration) {
    options.setup();
    if (disposed || declaration) throw new Error('One live shader declaration per material surface');
    const owned = Object.freeze({...input, fallback:Object.freeze([...input.fallback]) as typeof input.fallback});
    declaration = owned;
    return () => {options.setup(); if (declaration !== owned) return; declaration = null; ${scenes ? 'turn++; pendingRefresh = false; retirePublishers(false);' : 'presenter.release(view); '}};
  }
  return {
    declare(key:string, fallback:readonly [number,number,number,number], program:WebShaderProgram) {
      return register({kind:'pixels', key, fallback, program});
    },
    ${scenes ? "declareScene(slot:string, resources:number, key:string, fallback:readonly [number,number,number,number], program:WebShaderSceneProgram) { return register({kind:'scene', slot, resources, key, fallback, program}); }," : ''}
    mount() {if (disposed) return; if (!mounted) {mounted=true; view++;} refresh();},
    refresh,
    detach() {if (!mounted) return; mounted=false; ${scenes ? 'turn++; pendingRefresh = false; retirePublishers(false);' : ' presenter.release(view); '}},
    dispose() {if (disposed) return; disposed=true; mounted=false; declaration=null; ${scenes ? 'turn++; pendingRefresh = false; retirePublishers(true);' : ' presenter.dispose(); '}},
  };
}
`,
    },
  ];
}
