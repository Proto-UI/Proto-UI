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
    const bindA = (bindings: any) =>
      a.port.bindDecorations!(bindings, a.port.captureDecorationLease!());
    const sink = vi.fn();
    a.hooks.onMountPhase?.('mounting', 1);
    expect(() => a.style.to(y).use(tw('bg-red-500'))).toThrow();
    expect(() => bindA([{ target: y, sink }])).toThrow();
    expect(() => bindA([])).toThrow('missing');
    expect(() =>
      bindA([
        { target: x, sink },
        { target: x, sink },
      ])
    ).toThrow('duplicate');
    expect(sink).not.toHaveBeenCalled();
    a.style.to(x).use(tw('opacity-50'));
    bindA([{ target: x, sink }]);
    expect(sink).toHaveBeenCalledOnce();
    expect(a.style.hasDecorationTargets()).toBe(true);
    expect(() => a.style.validateDecorationTemplate([x])).not.toThrow();
    expect(() => a.style.validateDecorationTemplate([])).toThrow('missing');
    expect(() => bindA([{ target: x, sink }])).toThrow('structural rebind');
    a.hooks.dispose?.();
    b.hooks.dispose?.();
  });
  it('validates the whole rule frame before changing existing paint and ends the target lifetime', () => {
    const f = fixture(),
      target = f.style.declareDecoration(),
      sink = vi.fn();
    f.style.to(target).use(tw('bg-red-500'));
    f.hooks.onMountPhase?.('mounting', 1);
    f.port.bindDecorations!([{ target, sink }], f.port.captureDecorationLease!());
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
    f.port.replaceVisualRuntime!(null, [], [], [{ target, handles: [tw('bg-green-500')] }]);
    expect(sink.mock.calls.length).toBe(calls);
    f.hooks.onMountPhase?.('detached', 1);
    f.hooks.onMountPhase?.('mounting', 2);
    const replacement = vi.fn();
    f.port.bindDecorations!([{ target, sink: replacement }], f.port.captureDecorationLease!());
    expect(replacement.mock.lastCall?.[0].tokens).toEqual(['bg-green-500']);
    f.hooks.onMountPhase?.('detached', 1);
    f.port.replaceVisualRuntime!(null, [], [], [{ target, handles: [tw('bg-black')] }]);
    expect(replacement.mock.lastCall?.[0].tokens).toEqual(['bg-black']);
    expect(sink.mock.calls.length).toBe(calls);
    f.hooks.onInstancePhase?.('disposing');
    expect(() =>
      f.port.replaceVisualRuntime!(null, [], [], [{ target, handles: [tw('bg-white')] }])
    ).toThrow();
    expect(() =>
      f.port.bindDecorations!([{ target, sink: vi.fn() }], f.port.captureDecorationLease!())
    ).toThrow();
    f.hooks.dispose?.();
  });
});

describe('captured physical-view authority', () => {
  it('rejects stale, detached and foreign leases before callbacks', () => {
    const f = fixture(),
      other = fixture();
    const target = f.style.declareDecoration(),
      sink = vi.fn();
    expect(() => f.port.captureDecorationLease!()).toThrow('not active');
    f.hooks.onMountPhase?.('mounting', 1);
    other.hooks.onMountPhase?.('mounting', 1);
    const old = f.port.captureDecorationLease!();
    expect(() =>
      f.port.bindDecorations!([{ target, sink }], other.port.captureDecorationLease!())
    ).toThrow('stale');
    f.hooks.onMountPhase?.('unmounting', 1);
    expect(() => f.port.bindDecorations!([{ target, sink }], old)).toThrow('stale');
    f.hooks.onMountPhase?.('mounting', 2);
    expect(() => f.port.bindDecorations!([{ target, sink }], old)).toThrow('stale');
    expect(sink).not.toHaveBeenCalled();
    f.port.bindDecorations!([{ target, sink }], f.port.captureDecorationLease!());
    expect(sink).toHaveBeenCalledOnce();
    f.hooks.dispose?.();
    other.hooks.dispose?.();
  });
  it('permits corrected invalid-sink retry and snapshots getters once', () => {
    const f = fixture(),
      target = f.style.declareDecoration(),
      sink = vi.fn();
    f.hooks.onMountPhase?.('mounting', 1);
    const lease = f.port.captureDecorationLease!();
    expect(() => f.port.bindDecorations!([{ target, sink: null as any }], lease)).toThrow(
      'invalid'
    );
    let targets = 0,
      sinks = 0;
    f.port.bindDecorations!(
      [
        {
          get target() {
            targets++;
            return target;
          },
          get sink() {
            sinks++;
            return sink;
          },
        },
      ],
      lease
    );
    expect([targets, sinks]).toEqual([1, 1]);
    expect(sink).toHaveBeenCalledOnce();
    f.hooks.dispose?.();
  });
  it('rejects getter-triggered detach without poisoning the next view', () => {
    const f = fixture(),
      target = f.style.declareDecoration(),
      sink = vi.fn();
    f.hooks.onMountPhase?.('mounting', 1);
    const lease = f.port.captureDecorationLease!();
    expect(() =>
      f.port.bindDecorations!(
        [
          {
            target,
            get sink() {
              f.hooks.onMountPhase?.('unmounting', 1);
              return sink;
            },
          },
        ],
        lease
      )
    ).toThrow('stale');
    expect(sink).not.toHaveBeenCalled();
    f.hooks.onMountPhase?.('mounting', 2);
    f.port.bindDecorations!([{ target, sink }], f.port.captureDecorationLease!());
    expect(sink).toHaveBeenCalledOnce();
    f.hooks.dispose?.();
  });
});
