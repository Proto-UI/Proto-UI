import type { GeneratedModule } from './ir';
import type { ShaderKernel } from '../../core/src/shader-presentation';
import { nativeShaderHostSha256 } from './native-shader-host.generated';
import { specializeNativeShaderHost } from './native-shader-specialization';

export function nativeShaderArtifacts(
  kernels: readonly ShaderKernel[]
): NonNullable<GeneratedModule['supportingFiles']> {
  const specialized = specializeNativeShaderHost(kernels);
  return [
    { path: '.proto-ui/shader/webgl2-host-v1.ts', kind: 'source', contents: specialized.source },
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
          },
          null,
          2
        ) + '\n',
    },
    {
      path: '.proto-ui/shader/owner-web-v1.ts',
      kind: 'source',
      contents: `import {createWebShaderPresenter, type WebShaderProgram} from './webgl2-host-v1';
/** Physical owner lifecycle only. The compiler supplies the finite direct pass program. */
export function createNativeShader(options: {setup(): void; alive(): boolean; root(): HTMLElement | null; prepare(): void}) {
  let declaration: {key:string; fallback:readonly [number,number,number,number]; program:WebShaderProgram} | null = null;
  let view = 0, revision = 0, mounted = false, disposed = false;
  const presenter = createWebShaderPresenter({root:options.root, prepare:options.prepare});
  function refresh() {
    if (disposed || !mounted || !declaration || !options.alive()) return;
    presenter.commit({view, revision:++revision, key:declaration.key, fallback:declaration.fallback}, declaration.program);
  }
  return {
    declare(key:string, fallback:readonly [number,number,number,number], program:WebShaderProgram) {
      options.setup();
      if (disposed || declaration) throw new Error('One live shader declaration per material surface');
      const owned = Object.freeze({key, fallback:Object.freeze([...fallback]) as unknown as typeof fallback, program});
      declaration = owned;
      return () => {options.setup(); if (declaration !== owned) return; declaration = null; presenter.release(view);};
    },
    mount() {if (disposed) return; if (!mounted) {mounted=true; view++;} refresh();},
    refresh,
    detach() {if (!mounted) return; mounted=false; presenter.release(view);},
    dispose() {if (disposed) return; disposed=true; mounted=false; declaration=null; presenter.dispose();},
  };
}
`,
    },
  ];
}
