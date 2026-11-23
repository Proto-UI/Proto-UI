import type { EffectsPort } from '@proto.ui/core';
import { snapshotShaderPresentation } from '@proto.ui/core';
import type { ShaderPresentationFrame, ShaderPresentationSink } from '@proto.ui/module-feedback';
import { createWebShaderPresenter, type NativeShaderResource } from './shader-webgl2-host';

/** Existing material Feedback entry, realized through an exclusive physical paint lease. */
export function createWebShaderPresentationSink(
  getRoot: () => HTMLElement | null,
  effects: EffectsPort
): ShaderPresentationSink {
  const presenter = createWebShaderPresenter({
    root: getRoot,
    prepare() {},
  });
  return {
    commit(frame) {
      const input = snapshotShaderPresentation(frame.declaration);
      const key = JSON.stringify(input);
      presenter.commit(
        { view: frame.view, revision: frame.revision, key, fallback: input.fallback },
        (device) => {
          const values = new Map<string, NativeShaderResource>([
            ['$source', device.upload(input.source)],
          ]);
          for (const pass of input.passes) {
            const source = values.get(pass.input)!;
            values.set(
              pass.id,
              pass.kernel === 'copy-rgba8-v1'
                ? device.copy(source)
                : device.tint(source, pass.tint!)
            );
          }
          return values.get(input.output)!;
        },
        () => {
          effects.queueStyle({ kind: 'tw', tokens: [...frame.style.tokens] });
          if (effects.flushNow) effects.flushNow();
          else effects.requestFlush();
        }
      );
    },
    release(view) {
      presenter.release(view);
    },
    diagnostics: presenter.diagnostics,
  };
}
