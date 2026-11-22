// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { tw, type MaterialSlot, type ShaderPresentationDeclaration } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule } from '../src/create';
import { EFFECTS_CAP } from '../src/caps';
import { FINAL_STYLE_SINK_CAP } from '../src/material/final-style-sink';
import { SHADER_PRESENTATION_SINK_CAP, type ShaderPresentationFrame } from '../src/shader/sink';
import type { FeedbackInternalHooks, FeedbackPort } from '../src/types';

function declaration(): ShaderPresentationDeclaration {
  return {
    version: 1,
    source: {
      kind: 'owned-pixels',
      width: 1,
      height: 1,
      pixels: [64, 32, 16, 128],
      colorSpace: 'linear-srgb',
      alpha: 'premultiplied',
      origin: 'top-left',
    },
    passes: [{ id: 'copy', kernel: 'copy-rgba8-v1', input: '$source' }],
    output: 'copy',
    fallback: [0, 0, 0, 1],
  };
}
const materialSlot: MaterialSlot = {
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
};

function fixture() {
  const caps = new CapsVault();
  const effects = { queueStyle: vi.fn(), requestFlush: vi.fn() };
  caps.attachBase([
    [SYS_CAP, undefined],
    [EFFECTS_CAP, effects],
  ]);
  const module = createFeedbackModule({
    init: { prototypeName: 'shader-owner', declarations: [] },
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
  const hooks = module.hooks as FeedbackInternalHooks;
  const port = (module as typeof module & { port: FeedbackPort }).port;
  const frames: ShaderPresentationFrame[] = [];
  const sink = {
    commit: vi.fn((frame: ShaderPresentationFrame) => {
      frames.push(frame);
    }),
    release: vi.fn(),
  };
  const mount = (epoch = 1) => {
    hooks.onMountPhase?.('mounting', epoch);
    hooks.onProtoPhase?.('mounted');
    hooks.onMountPhase?.('mounted', epoch);
  };
  return { caps, hooks, port, frames, sink, effects, mount, facade: module.facade };
}

describe('portable shader owner without Web globals', () => {
  it('snapshots authored data once and preserves final patched style in the complete frame', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    const f = fixture(),
      source = declaration();
    f.facade.material.shader(source);
    (source.source.pixels as number[])[0] = 200;
    f.facade.style.use(tw('rounded-lg bg-black'));
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    const owned = f.frames.at(-1)!.declaration;
    expect(owned.source.pixels).toEqual([64, 32, 16, 128]);
    expect(Object.isFrozen(owned.source.pixels)).toBe(true);
    f.facade.style.patch(tw('rounded-full'));
    expect(f.frames.at(-1)!.style.tokens).toEqual(['bg-black', 'rounded-full']);
    expect(f.frames.at(-1)!.declaration).toBe(owned);
    expect(() => f.facade.material.shader(declaration())).toThrow(
      '[Phase] illegal phase for def.feedback.material.shader: mounted'
    );
    f.hooks.dispose?.();
  });

  it('retains the declaration with a missing capability and replays it when support arrives', () => {
    const f = fixture();
    f.facade.material.shader(declaration());
    f.facade.style.use(tw('bg-black'));
    f.mount();
    expect(f.port.shaderDiagnostics?.()).toEqual(['shader-host-unavailable']);
    expect(f.effects.queueStyle).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['bg-black'] })
    );
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    expect(f.frames.at(-1)!.declaration.output).toBe('copy');
    expect(f.port.shaderDiagnostics?.()).toEqual([]);
    f.hooks.dispose?.();
  });

  it('retires the exact view, stays silent while detached and replays on a new view', () => {
    const f = fixture();
    f.facade.material.shader(declaration());
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    f.hooks.onMountPhase?.('unmounting', 1);
    f.hooks.onMountPhase?.('detached', 1);
    expect(f.sink.release.mock.calls).toEqual([[1]]);
    f.sink.commit.mockClear();
    f.facade.style.patch(tw('rounded-full'));
    f.hooks.afterRenderCommit();
    expect(f.sink.commit).not.toHaveBeenCalled();
    f.mount(2);
    expect(f.frames.at(-1)!.view).toBe(2);
    expect(f.frames.at(-1)!.style.tokens).toEqual(['rounded-full']);
    f.hooks.onMountPhase?.('detached', 1);
    expect(f.sink.release.mock.calls).toEqual([[1]]);
    f.hooks.dispose?.();
    expect(f.sink.release.mock.calls).toEqual([[1], [2]]);
  });

  it('releases style-only ownership before shader admission and shader before fallback', () => {
    const f = fixture(),
      events: string[] = [];
    const fallback = {
      commit: () => {
        events.push('style');
      },
      release: () => {
        events.push('style-release');
      },
    };
    f.caps.attachBase([[FINAL_STYLE_SINK_CAP, fallback]]);
    f.facade.material.shader(declaration());
    f.mount();
    events.length = 0;
    f.sink.commit.mockImplementation(() => {
      events.push('shader');
    });
    f.sink.release.mockImplementation(() => {
      events.push('shader-release');
    });
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    expect(events).toEqual(['style-release', 'shader']);
    events.length = 0;
    f.caps.resetAttached();
    expect(events).toEqual(['shader-release', 'style']);
    f.hooks.dispose?.();
  });

  it('reacquires a restored capability with a new binding and never resets it to the mount epoch', () => {
    const f = fixture();
    const replacement = { commit: vi.fn(), release: vi.fn() };
    f.caps.attachBase([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.facade.material.shader(declaration());
    f.mount(1);
    expect(f.frames.at(-1)!.view).toBe(1);
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, replacement]]);
    expect(f.sink.release.mock.calls).toEqual([[1]]);
    expect(replacement.commit.mock.lastCall![0].view).toBe(2);
    f.caps.resetAttached();
    expect(replacement.release.mock.calls).toEqual([[2]]);
    expect(f.frames.at(-1)!.view).toBe(3);
    f.caps.resetAttached();
    f.facade.style.patch(tw('rounded-full'));
    expect(f.frames.at(-1)!.view).toBe(3);
    expect(f.sink.release.mock.calls).toEqual([[1]]);
    expect(replacement.release.mock.calls).toEqual([[2]]);
    f.hooks.onMountPhase?.('unmounting', 1);
    f.hooks.onMountPhase?.('detached', 1);
    expect(f.sink.release.mock.calls).toEqual([[1], [3]]);
    f.mount(2);
    expect(f.frames.at(-1)!.view).toBe(4);
    expect(f.frames.at(-1)!.style.tokens).toEqual(['rounded-full']);
    f.hooks.onMountPhase?.('detached', 1);
    expect(f.sink.release.mock.calls).toEqual([[1], [3]]);
    f.hooks.dispose?.();
    expect(f.sink.release.mock.calls).toEqual([[1], [3], [4]]);
  });

  it('a later capability selected during release wins without restoring the retired owner', () => {
    const f = fixture();
    f.facade.material.shader(declaration());
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    const replaced = { commit: vi.fn(), release: vi.fn() };
    const newest = { commit: vi.fn(), release: vi.fn() };
    f.sink.release.mockImplementationOnce(() =>
      f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, newest]])
    );
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, replaced]]);
    expect(f.sink.release).toHaveBeenCalledTimes(1);
    expect(replaced.commit).not.toHaveBeenCalled();
    expect(newest.commit).toHaveBeenCalled();
    f.hooks.dispose?.();
    expect(newest.commit.mock.lastCall![0].view).toBe(2);
    expect(newest.release).toHaveBeenCalledWith(2);
    expect(replaced.release).not.toHaveBeenCalled();
  });

  it('retries a failed publication with the same immutable graph and the current complete style', () => {
    const f = fixture();
    f.facade.material.shader(declaration());
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    const owned = f.frames.at(-1)!.declaration;
    f.sink.commit.mockImplementationOnce(() => {
      throw new Error('host-publish');
    });
    expect(() => f.port.applyMergedStyle(tw('text-white'))).toThrow('host-publish');
    f.hooks.flushIfPossible();
    expect(f.frames.at(-1)!.declaration).toBe(owned);
    expect(f.frames.at(-1)!.style.tokens).toEqual(['text-white']);
    f.hooks.dispose?.();
  });

  it('retains replay after a throwing retirement and never releases the same owner twice', () => {
    const f = fixture();
    f.facade.material.shader(declaration());
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    const next = { commit: vi.fn(), release: vi.fn() };
    f.sink.release.mockImplementationOnce(() => {
      throw new Error('host-release');
    });
    expect(() => f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, next]])).toThrow('host-release');
    f.hooks.flushIfPossible();
    expect(next.commit).toHaveBeenCalled();
    expect(f.sink.release).toHaveBeenCalledTimes(1);
    f.hooks.dispose?.();
    expect(next.release).toHaveBeenCalledTimes(1);
  });

  it('finishes terminal cleanup when the host release throws and cannot revive the graph', () => {
    const f = fixture();
    const withdraw = f.facade.material.shader(declaration());
    f.facade.style.use(tw('bg-black'));
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    f.sink.release.mockImplementationOnce(() => {
      throw new Error('host-release');
    });
    expect(() => f.hooks.dispose?.()).toThrow('host-release');
    f.hooks.dispose?.();
    expect(f.sink.release).toHaveBeenCalledTimes(1);
    expect(f.facade.style.exportMerged().tokens).toEqual([]);
    expect(() => f.facade.material.shader(declaration())).toThrow(/disposed/);
    expect(() => withdraw()).toThrow(/disposed/);
    expect(f.port.shaderDiagnostics?.()).toEqual([]);
  });

  it('supports setup withdrawal without creating a physical lease', () => {
    const f = fixture();
    const withdraw = f.facade.material.shader(declaration());
    withdraw();
    withdraw();
    f.facade.material.declare(materialSlot);
    f.caps.attach([[SHADER_PRESENTATION_SINK_CAP, f.sink]]);
    f.mount();
    expect(f.sink.commit).not.toHaveBeenCalled();
    expect(f.sink.release).not.toHaveBeenCalled();
    f.hooks.dispose?.();
  });

  for (const first of ['shader', 'material', 'motion', 'presence'] as const)
    it(`refuses overlapping root paint owners when ${first} is declared first`, () => {
      const f = fixture();
      if (first === 'shader') {
        f.facade.material.shader(declaration());
        expect(() => f.facade.material.declare(materialSlot)).toThrow(/material/);
        expect(() => f.facade.material.shader(declaration())).toThrow(/material/);
        expect(() =>
          f.facade.style.transition({
            properties: ['translate'],
            durationMs: 20,
            easing: [0, 0, 1, 1],
          })
        ).toThrow(/motion/);
        expect(() => f.facade.style.presence({} as any)).toThrow(/presence/);
      } else {
        if (first === 'material') f.facade.material.declare(materialSlot);
        if (first === 'motion')
          f.facade.style.transition({
            properties: ['translate'],
            durationMs: 20,
            easing: [0, 0, 1, 1],
          });
        if (first === 'presence') {
          const owner = f.facade.presence.owner();
          f.facade.style.presence({
            owner: owner.ref,
            closed: { opacity: 0 },
            entered: { opacity: 1 },
            easing: [0, 0, 1, 1],
          });
        }
        expect(() => f.facade.material.shader(declaration())).toThrow(/material|motion/);
      }
      f.hooks.dispose?.();
    });
});
