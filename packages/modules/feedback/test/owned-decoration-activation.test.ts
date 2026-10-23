import { describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import type { FeedbackPort } from '../src/types';
import { createFeedbackModule } from '../src/create';
import { OWNED_DECORATION_CAP } from '../src/style/owned-decoration-cap';
function fixture() {
  const caps = new CapsVault();
  caps.attachBase([
    [SYS_CAP, undefined],
    [OWNED_DECORATION_CAP, true],
  ]);
  const module = createFeedbackModule({
    init: { prototypeName: 'leaf-module', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw new Error('unexpected');
      },
      requirePort() {
        throw new Error('unexpected');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  return {
    module,
    style: module.facade.style,
    port: (module as typeof module & { port: FeedbackPort }).port,
    hooks: module.hooks!,
  };
}
describe('draft decoration module activation guards', () => {
  it('rejects foreign setup and duplicate/missing bindings without touching sinks', () => {
    const a = fixture(),
      b = fixture(),
      x = a.style.declareDecoration(),
      y = b.style.declareDecoration();
    const sink = vi.fn();
    expect(() => a.style.to(y).use(tw('bg-red-500'))).toThrow();
    expect(() => a.port.bindDecorations!([{ target: y, sink }])).toThrow();
    expect(() => a.port.bindDecorations!([])).toThrow('missing');
    expect(() =>
      a.port.bindDecorations!([
        { target: x, sink },
        { target: x, sink },
      ])
    ).toThrow('duplicate');
    expect(sink).not.toHaveBeenCalled();
    a.style.to(x).use(tw('opacity-50'));
    a.port.bindDecorations!([{ target: x, sink }]);
    expect(sink).toHaveBeenCalledOnce();
    expect(() => a.port.bindDecorations!([{ target: x, sink }])).toThrow('structural rebind');
    a.hooks.dispose?.();
    b.hooks.dispose?.();
  });
  it('validates the whole rule frame before changing existing paint and ends the target lifetime', () => {
    const f = fixture(),
      target = f.style.declareDecoration(),
      sink = vi.fn();
    f.style.to(target).use(tw('bg-red-500'));
    f.port.bindDecorations!([{ target, sink }]);
    f.hooks.onProtoPhase?.('mounted');
    f.hooks.onMountPhase?.('mounted', 1);
    let remove = f.port.replaceVisualRuntime!(
      null,
      [],
      [],
      [{ target, handles: [tw('bg-blue-500')] }]
    );
    expect(sink.mock.lastCall?.[0].tokens).toEqual(['bg-blue-500']);
    expect(() =>
      f.port.replaceVisualRuntime!(
        remove,
        [],
        [],
        [
          { target, handles: [tw('bg-green-500')] },
          { target: {} as any, handles: [tw('opacity-50')] },
        ]
      )
    ).toThrow();
    expect(sink.mock.lastCall?.[0].tokens).toEqual(['bg-blue-500']);
    remove?.();
    expect(sink.mock.lastCall?.[0].tokens).toEqual(['bg-red-500']);
    f.hooks.onMountPhase?.('unmounting', 1);
    const calls = sink.mock.calls.length;
    expect(() =>
      f.port.replaceVisualRuntime!(null, [], [], [{ target, handles: [tw('bg-green-500')] }])
    ).toThrow();
    expect(sink.mock.calls.length).toBe(calls);
    f.hooks.dispose?.();
  });
});
