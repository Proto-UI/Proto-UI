// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { tw, type ShaderPresentationDeclaration } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule } from '../../../modules/feedback/src/create';
import { EFFECTS_CAP } from '../../../modules/feedback/src/caps';
import { SHADER_PRESENTATION_SINK_CAP } from '../../../modules/feedback/src/shader/sink';
import type { FeedbackInternalHooks, FeedbackPort } from '../../../modules/feedback/src/types';
import { createWebShaderPresentationSink } from '../src/material/shader-webgl2';

it('an installed but undeclared shader host stays physically idle through ordinary ownership', () => {
  expect(typeof document).toBe('undefined');
  const root = vi.fn(() => {
    throw new Error('physical shader root acquired');
  });
  const effects = { queueStyle: vi.fn(), requestFlush: vi.fn() };
  const sink = createWebShaderPresentationSink(root, effects);
  const caps = new CapsVault();
  caps.attachBase([
    [SYS_CAP, undefined],
    [EFFECTS_CAP, effects],
    [SHADER_PRESENTATION_SINK_CAP, sink],
  ]);
  const owner = createFeedbackModule({
    init: { prototypeName: 'ordinary-style-owner', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw new Error('unexpected semantic dependency');
      },
      requirePort() {
        throw new Error('unexpected semantic dependency');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  const hooks = owner.hooks as FeedbackInternalHooks;
  const port = (owner as typeof owner & { port: FeedbackPort }).port;
  owner.facade.style.use(tw('opacity-25'));
  hooks.onMountPhase?.('mounting', 1);
  hooks.onProtoPhase?.('mounted');
  hooks.onMountPhase?.('mounted', 1);
  const remove = port.useStyleRuntime(tw('opacity-50'));
  remove({ flush: false });
  hooks.onEffectsFlushed?.();
  hooks.afterRenderCommit();
  hooks.dispose?.();
  sink.release(1);
  sink.release(1);
  sink.release(2);
  expect(effects.queueStyle).toHaveBeenCalled();
  expect(root).not.toHaveBeenCalled();
  expect(sink.diagnostics?.()).toEqual([]);

  // The real provider must reach the guarded physical boundary for an actual
  // declaration; a disconnected fake host would not satisfy this control.
  const declaration: ShaderPresentationDeclaration = {
    version: 1,
    source: {
      kind: 'owned-pixels',
      width: 1,
      height: 1,
      pixels: [0, 0, 0, 255],
      colorSpace: 'linear-srgb',
      alpha: 'premultiplied',
      origin: 'top-left',
    },
    passes: [{ id: 'copy', kernel: 'copy-rgba8-v1', input: '$source' }],
    output: 'copy',
    fallback: [0, 0, 0, 1],
  };
  const active = createWebShaderPresentationSink(root, effects);
  expect(() =>
    active.commit({ view: 1, revision: 1, style: { kind: 'tw', tokens: [] }, declaration })
  ).toThrow('physical shader root acquired');
  expect(root).toHaveBeenCalledTimes(1);
});
