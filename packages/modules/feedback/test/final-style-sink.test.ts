import { describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule } from '../src/create';
import { EFFECTS_CAP } from '../src/caps';
import { FINAL_STYLE_SINK_CAP, type FinalStyleFrame } from '../src/material/final-style-sink';
import type { FeedbackPort, FeedbackInternalHooks } from '../src/types';
import { MATERIAL_BINDING_FACTORY_CAP } from '../src/material/runtime-cap';

function fixture() {
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, undefined]]);
  const module = createFeedbackModule({
    init: { prototypeName: 'final-style-boundary', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw new Error('unexpected dependency');
      },
      requirePort() {
        throw new Error('unexpected dependency');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  const hooks = module.hooks as FeedbackInternalHooks;
  const port = (module as typeof module & { port: FeedbackPort }).port;
  const frames: FinalStyleFrame[] = [];
  const sink = { commit: vi.fn((frame: FinalStyleFrame) => frames.push(frame)), release: vi.fn() };
  const effects = { queueStyle: vi.fn(), requestFlush: vi.fn() };
  const mount = (view = 1) => {
    hooks.onMountPhase?.('mounting', view);
    hooks.onProtoPhase?.('mounted');
    hooks.onMountPhase?.('mounted', view);
  };
  return { caps, hooks, port, style: module.facade.style, frames, sink, effects, mount };
}

describe('private Feedback final-style sink', () => {
  it('keeps material implementation opt-in and cleans up after a throwing semantic binding', () => {
    const f = fixture();
    const factory = vi.fn(() => ({
      connect() {},
      snapshot: () => null as any,
      dispose() {
        throw new Error('semantic-release');
      },
    }));
    f.style.use(tw('rounded-lg'));
    f.caps.attach([
      [MATERIAL_BINDING_FACTORY_CAP, factory],
      [FINAL_STYLE_SINK_CAP, f.sink],
    ]);
    f.mount();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(() => f.hooks.dispose?.()).toThrow('semantic-release');
    expect(f.style.exportMerged().tokens).toEqual([]);
    expect(() => f.style.patch(tw('rounded-full'))).toThrow(/disposed/);
  });
  it('retries failed structural replay, remount and temporary Rule frames after a clean frame', () => {
    const f = fixture();
    f.caps.attach([[FINAL_STYLE_SINK_CAP, f.sink]]);
    f.style.use(tw('rounded-lg'));
    f.mount();
    const failOnce = () =>
      f.sink.commit.mockImplementationOnce(() => {
        throw new Error('paint');
      });
    failOnce();
    expect(() => f.hooks.afterRenderCommit()).toThrow('paint');
    f.hooks.flushIfPossible();
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-lg']);
    failOnce();
    expect(() => f.port.applyMergedStyle(tw('text-white'))).toThrow('paint');
    f.hooks.flushIfPossible();
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-lg', 'text-white']);
    failOnce();
    expect(() => f.port.applyMergedStyle(tw('text-white'))).toThrow('paint');
    f.style.patch(tw('rounded-full'));
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-full']);
    f.hooks.onMountPhase?.('detached', 1);
    failOnce();
    expect(() => f.mount(2)).toThrow('paint');
    f.hooks.flushIfPossible();
    expect(f.frames.at(-1)?.view).toBe(2);
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-full']);
  });

  it('finishes terminal cleanup even when release throws and does not release twice', () => {
    const f = fixture();
    f.caps.attach([[FINAL_STYLE_SINK_CAP, f.sink]]);
    f.style.use(tw('rounded-lg'));
    f.mount();
    f.sink.release.mockImplementation(() => {
      throw new Error('release');
    });
    expect(() => f.hooks.dispose?.()).toThrow('release');
    expect(f.style.exportMerged().tokens).toEqual([]);
    f.hooks.dispose?.();
    expect(f.sink.release).toHaveBeenCalledTimes(1);
    expect(() => f.style.patch(tw('rounded-full'))).toThrow(/disposed/);
  });

  it('retains replay obligation when a replaced sink throws during retirement', () => {
    const f = fixture();
    f.caps.attach([[FINAL_STYLE_SINK_CAP, f.sink]]);
    f.style.use(tw('rounded-lg'));
    f.mount();
    const next = { commit: vi.fn(), release: vi.fn() };
    f.sink.release.mockImplementation(() => {
      throw new Error('release');
    });
    expect(() => f.caps.attach([[FINAL_STYLE_SINK_CAP, next]])).toThrow('release');
    f.hooks.flushIfPossible();
    expect(next.commit).toHaveBeenCalled();
    expect(next.commit.mock.calls.at(-1)?.[0].style.tokens).toEqual(['rounded-lg']);
    expect(f.sink.release).toHaveBeenCalledTimes(1);
  });

  it('routes every final post-patch entry point exclusively through one visual consumer', () => {
    const f = fixture();
    f.caps.attach([
      [EFFECTS_CAP, f.effects],
      [FINAL_STYLE_SINK_CAP, f.sink],
    ]);
    f.style.use(tw('rounded-lg text-white'));
    f.mount();
    const off = f.port.useStyleRuntime(tw('bg-red-500'));
    f.style.patch(tw('rounded-full'));
    f.style.suppress(tw('bg-blue-500'));
    f.port.applyMergedStyle(tw('bg-blue-500 opacity-50'));
    expect(f.frames.at(-1)?.style.tokens).toEqual(['text-white', 'opacity-50', 'rounded-full']);
    f.hooks.afterRenderCommit();
    expect(f.frames.at(-1)?.style.tokens).toEqual(['text-white', 'rounded-full']);
    f.style.clearPatch();
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-lg', 'text-white', 'bg-red-500']);
    off();
    expect(f.effects.queueStyle).not.toHaveBeenCalled();
    expect(f.effects.requestFlush).not.toHaveBeenCalled();
    expect(
      f.frames.every((frame, index) => index === 0 || frame.revision > f.frames[index - 1].revision)
    ).toBe(true);
  });

  it('freezes retained snapshots and retains selector provenance rather than claiming completeness', () => {
    const f = fixture();
    f.caps.attach([[FINAL_STYLE_SINK_CAP, f.sink]]);
    f.style.use(tw('rounded-lg'));
    f.port.useStyleUnsafe(tw('hover:bg-red-500'));
    f.mount();
    const first = f.frames[0];
    expect(first.style.tokens).toContain('hover:bg-red-500');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.style.tokens)).toBe(true);
    f.style.patch(tw('rounded-full'));
    expect(first.style.tokens).toContain('rounded-lg');
  });

  it('retires replaced capabilities and replays clean logical state into the next sink', () => {
    const f = fixture();
    f.caps.attach([[FINAL_STYLE_SINK_CAP, f.sink]]);
    f.style.use(tw('rounded-lg'));
    f.mount();
    const next = { commit: vi.fn(), release: vi.fn() };
    f.caps.attach([[FINAL_STYLE_SINK_CAP, next]]);
    expect(f.sink.release).toHaveBeenCalledTimes(1);
    expect(f.sink.release).toHaveBeenCalledWith(1);
    expect(next.commit).toHaveBeenCalled();
    expect(next.commit.mock.calls.at(-1)?.[0].style.tokens).toEqual(['rounded-lg']);
    f.caps.resetAttached();
    expect(next.release).toHaveBeenCalledTimes(1);
    expect(next.release).toHaveBeenCalledWith(1);
    f.caps.attach([[EFFECTS_CAP, f.effects]]);
    expect(f.effects.queueStyle).toHaveBeenLastCalledWith(tw('rounded-lg'));
  });

  it('does not write while detached and gives a remount a new view identity', () => {
    const f = fixture();
    f.caps.attach([[FINAL_STYLE_SINK_CAP, f.sink]]);
    f.style.use(tw('rounded-lg'));
    f.mount();
    f.hooks.onMountPhase?.('unmounting', 1);
    f.hooks.onMountPhase?.('detached', 1);
    expect(f.sink.release).toHaveBeenCalledTimes(1);
    expect(f.sink.release).toHaveBeenCalledWith(1);
    f.sink.commit.mockClear();
    f.style.patch(tw('rounded-full'));
    f.hooks.afterRenderCommit();
    expect(f.sink.commit).not.toHaveBeenCalled();
    f.mount(2);
    expect(f.frames.at(-1)?.view).toBe(2);
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-full']);
    f.hooks.dispose?.();
    expect(f.sink.release).toHaveBeenLastCalledWith(2);
    f.sink.commit.mockClear();
    f.mount(3);
    f.hooks.afterRenderCommit();
    expect(f.sink.commit).not.toHaveBeenCalled();
  });

  it('retains dirty state on commit failure without leaking a competing legacy paint', () => {
    const f = fixture();
    f.caps.attach([
      [FINAL_STYLE_SINK_CAP, f.sink],
      [EFFECTS_CAP, f.effects],
    ]);
    f.style.use(tw('rounded-lg'));
    f.mount();
    f.sink.commit.mockImplementationOnce(() => {
      throw new Error('host failure');
    });
    expect(() => f.style.patch(tw('rounded-full'))).toThrow('host failure');
    expect(f.effects.queueStyle).not.toHaveBeenCalled();
    f.hooks.flushIfPossible();
    expect(f.frames.at(-1)?.style.tokens).toEqual(['rounded-full']);
  });
});
