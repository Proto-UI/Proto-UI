import { describe, expect, it, vi } from 'vitest';
import { tw } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule } from '../src/create';
import { EFFECTS_CAP } from '../src/caps';
import { FINAL_STYLE_SINK_CAP } from '../src/material/final-style-sink';
import { VISUAL_FEEDBACK_SINK_CAP } from '../src/material/shared-sink';
import { PRESENCE_PRESENTATION_SINK_CAP } from '../src/presence/sink';
import type { FeedbackPort, FeedbackInternalHooks } from '../src/types';

function fixture(kind: 'effects' | 'final' | 'visual') {
  const caps = new CapsVault();
  caps.attachBase([[SYS_CAP, undefined]]);
  const module = createFeedbackModule({
    init: { prototypeName: 'root-provenance-merge', declarations: [] },
    caps,
    deps: {
      requireFacade() {
        throw Error('unexpected');
      },
      requirePort() {
        throw Error('unexpected');
      },
      tryFacade: () => undefined,
      tryPort: () => undefined,
    },
  });
  const frames: any[] = [];
  const publish = vi.fn((frame: any) => frames.push(kind === 'effects' ? frame : frame.style));
  caps.attach([
    [
      kind === 'effects'
        ? EFFECTS_CAP
        : kind === 'final'
          ? FINAL_STYLE_SINK_CAP
          : VISUAL_FEEDBACK_SINK_CAP,
      kind === 'effects'
        ? { queueStyle: publish, requestFlush() {} }
        : { commit: publish, release() {} },
    ] as any,
  ]);
  const hooks = module.hooks as FeedbackInternalHooks;
  const port = (module as typeof module & { port: FeedbackPort }).port;
  return {
    caps,
    module,
    hooks,
    port,
    frames,
    publish,
    mount(view: number) {
      hooks.onMountPhase?.('mounting', view);
      hooks.onProtoPhase?.('mounted');
      hooks.onMountPhase?.('mounted', view);
    },
  };
}

describe('main Root provenance and Finf final visual sinks', () => {
  it('projects presence with opaque style when material has no combined sink', () => {
    const f = fixture('visual');
    const sink = { commit: vi.fn(), release: vi.fn(), cancel: vi.fn(), settle: vi.fn() };
    const queueStyle = vi.fn();
    f.caps.attach([
      [PRESENCE_PRESENTATION_SINK_CAP, sink],
      [EFFECTS_CAP, { queueStyle, requestFlush() {} }],
    ]);
    const owner = f.module.facade.presence.owner();
    const slot = {
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    } as const;
    const candidate = { intent: 'liquid-glass' } as const;
    f.module.facade.style.use(tw('bg-secondary text-secondary-foreground'));
    f.module.facade.style.presence({
      owner: owner.ref,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0, 0, 1, 1],
    });
    f.module.facade.material.declare(slot);
    f.module.facade.material.use(candidate);

    f.mount(1);
    const style = expect.objectContaining({
      tokens: ['bg-secondary', 'text-secondary-foreground'],
    });
    expect(queueStyle).toHaveBeenLastCalledWith(style);
    f.module.facade.presence.publish(owner.writer, {
      owner: owner.ref,
      phase: 'entering',
      revision: 1,
      attempt: { ownerEpoch: 1, phaseAttempt: 1 },
      completion: 'presentation',
      durationMs: 20,
      timeoutMs: 100,
    });
    expect(sink.commit).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: expect.objectContaining({ phase: 'entering' }), style })
    );
    expect(f.publish).not.toHaveBeenCalled();
    expect(f.port.exportMaterialFrame?.()).toEqual({ slot, candidates: [candidate] });
    expect(f.port.materialDiagnostics?.()).toEqual(['material-presence-host-unavailable']);
    f.hooks.dispose?.();
  });

  it.each(['effects', 'final', 'visual'] as const)(
    'retains setup/rule/runtime origin across %s sink and remount',
    (kind) => {
      const f = fixture(kind);
      f.module.facade.style.use(tw('p-2'));
      f.mount(1);
      f.port.useStyleRuntime(tw('text-white'));
      f.module.facade.style.patch(tw('rounded-lg'));
      const assertEntries = () =>
        expect(f.frames.at(-1)?.entries).toEqual([
          expect.objectContaining({ token: 'p-2', authorToken: 'p-2', origin: 'setup' }),
          expect.objectContaining({
            token: 'text-white',
            authorToken: 'text-white',
            origin: 'rule',
          }),
          expect.objectContaining({
            token: 'rounded-lg',
            authorToken: 'rounded-lg',
            origin: 'runtime',
          }),
        ]);
      assertEntries();
      expect(f.module.facade.style.exportMerged()).toEqual({
        kind: 'tw',
        tokens: ['p-2', 'text-white', 'rounded-lg'],
      });
      f.hooks.onMountPhase?.('detached', 1);
      f.mount(2);
      assertEntries();
      f.hooks.afterRenderCommit();
      assertEntries();
      f.hooks.dispose?.();
    }
  );
  it.each(['final', 'visual'] as const)(
    'keeps exact temporary Rule provenance through failed %s publication retry',
    (kind) => {
      const f = fixture(kind);
      f.module.facade.style.use(tw('p-2'));
      f.mount(1);
      f.publish.mockImplementationOnce(() => {
        throw Error('paint');
      });
      expect(() => f.port.applyMergedStyle(tw('text-white'))).toThrow('paint');
      f.hooks.flushIfPossible();
      const style = f.frames.at(-1);
      expect(style.entries).toEqual([
        expect.objectContaining({ token: 'p-2', origin: 'setup' }),
        expect.objectContaining({ token: 'text-white', origin: 'rule' }),
      ]);
      expect(Object.isFrozen(style)).toBe(true);
      expect(Object.isFrozen(style.entries)).toBe(true);
      expect(Object.isFrozen(style.entries[0])).toBe(true);
      f.hooks.dispose?.();
    }
  );
});
