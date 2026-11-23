import type { EffectsPort } from '@proto.ui/core';
import { snapshotShaderPresentation } from '@proto.ui/core';
import type { ShaderPresentationFrame, ShaderPresentationSink } from '@proto.ui/module-feedback';
import {
  createWebShaderPresenter,
  validateWebShaderPublication,
  type NativeShaderResource,
  type NativeShaderSource,
  type WebShaderPaintDevice,
} from './shader-webgl2-host';
import type { WebShaderHostOptions, WebShaderScenePresenter } from './shader-scene-host';

/** Existing material Feedback entry, realized through an exclusive physical paint lease. */
export function createWebShaderPresentationSink(
  getRoot: () => HTMLElement | null,
  effects: EffectsPort,
  host?: WebShaderHostOptions
): ShaderPresentationSink {
  const capabilities = Object.freeze({
    root: getRoot,
    prepare() {},
  });
  let presenter = createWebShaderPresenter(capabilities);
  const reasons = new Set<string>();
  let scene: WebShaderScenePresenter | undefined;
  let sourceKind: 'owned-pixels' | 'owned-scene' | undefined;
  let view = -1,
    revision = -1,
    turn = 0,
    released = false;
  function retireScene(previous: WebShaderScenePresenter | undefined) {
    try {
      previous?.dispose();
      for (const reason of previous?.diagnostics() ?? []) reasons.add(reason);
    } catch {
      reasons.add('shader-scene-cleanup-failed');
    }
  }
  return {
    commit(frame) {
      const input = snapshotShaderPresentation(frame.declaration);
      validateWebShaderPublication(frame);
      if (frame.view < view || (frame.view === view && (released || frame.revision < revision))) {
        reasons.add('shader-stale-frame');
        return;
      }
      // Only accepted input advances the shared boundary. A host factory can
      // synchronously submit another source kind before returning a capability.
      const operation = ++turn;
      view = frame.view;
      revision = frame.revision;
      released = false;
      const previousKind = sourceKind;
      sourceKind = input.source.kind;
      if (previousKind && sourceKind !== previousKind) {
        const previousPresenter = presenter,
          previousScene = scene;
        // Detach before external cleanup so reentry can only use the new owner.
        presenter = createWebShaderPresenter(capabilities);
        scene = undefined;
        for (const reason of previousPresenter.diagnostics()) reasons.add(reason);
        previousPresenter.dispose();
        retireScene(previousScene);
        if (operation !== turn) return;
      }
      const key = JSON.stringify(input);
      const program = (device: WebShaderPaintDevice, source: NativeShaderSource) => {
        const values: Record<string, NativeShaderResource> = Object.create(null);
        values.$source = device.upload(source);
        for (const pass of input.passes) {
          const resource = values[pass.input];
          values[pass.id] =
            pass.kernel === 'copy-rgba8-v1'
              ? device.copy(resource)
              : device.tint(resource, pass.tint!);
        }
        return values[input.output];
      };
      const publication = {
        view: frame.view,
        revision: frame.revision,
        key,
        fallback: input.fallback,
      };
      const prepare = () => {
        effects.queueStyle({ kind: 'tw', tokens: [...frame.style.tokens] });
        if (effects.flushNow) effects.flushNow();
        else effects.requestFlush();
      };
      if (input.source.kind === 'owned-scene') {
        let reason = 'shader-scene-capability-unavailable';
        if (!scene) {
          let acquired: WebShaderScenePresenter | undefined;
          try {
            acquired = host?.createScenePresenter(capabilities);
          } catch {
            reason = 'shader-scene-host-failed';
          }
          if (operation !== turn) {
            retireScene(acquired);
            return;
          }
          scene = acquired;
        }
        if (scene)
          scene.commit(
            { ...publication, slot: input.source.slot, resources: input.passes.length + 1 },
            program,
            prepare
          );
        else presenter.commit(publication, null, prepare, undefined, reason);
      } else {
        const source = input.source;
        presenter.commit(publication, (device) => program(device, source), prepare);
      }
    },
    release(current) {
      if (view === current) {
        turn++;
        released = true;
      }
      presenter.release(current);
      scene?.release(current);
    },
    diagnostics: () =>
      Object.freeze([
        ...new Set([...reasons, ...presenter.diagnostics(), ...(scene?.diagnostics() ?? [])]),
      ]),
  };
}
