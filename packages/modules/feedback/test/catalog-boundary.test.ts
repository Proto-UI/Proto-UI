import { describe, expect, it, vi } from 'vitest';
import { tw, type EffectsPort } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createFeedbackModule, FeedbackModuleDef } from '../src/create';
import { EFFECTS_CAP } from '../src/caps';
import type { FeedbackPort, FeedbackInternalHooks } from '../src/types';

function fixture() {
  const caps = new CapsVault();
  // Exercise the documented proto-phase fallback without a Runtime SYS implementation.
  caps.attachBase([[SYS_CAP, undefined]]);
  const module = createFeedbackModule({
    init: { prototypeName: 'feedback-boundary', declarations: [] },
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
  const port = (module as typeof module & { port: FeedbackPort }).port;
  const hooks = module.hooks as FeedbackInternalHooks;
  const queueStyle = vi.fn();
  const requestFlush = vi.fn();
  const effects: EffectsPort = { queueStyle, requestFlush };
  const mount = () => {
    hooks.onMountPhase?.('mounting', 1);
    hooks.onProtoPhase?.('mounted');
    hooks.onMountPhase?.('mounted', 1);
  };
  return {
    caps,
    module,
    style: module.facade.style,
    port,
    hooks,
    effects,
    queueStyle,
    requestFlush,
    mount,
  };
}

describe('Feedback catalog boundary', () => {
  it('T-FEEDBACK-0001-CASE-SURFACE: separates author token authority and setup contribution removal', () => {
    const f = fixture();
    expect(FeedbackModuleDef.resourceOwnership).toBe('mixed');
    expect(FeedbackModuleDef.deps).toEqual([]);
    expect(Object.keys(f.style).sort()).toEqual([
      'clearPatch',
      'exportMerged',
      'patch',
      'suppress',
      'use',
    ]);
    const remove = f.style.use(tw('opacity-50'));
    f.style.use(tw('bg-red-500'));
    remove();
    expect(f.style.exportMerged().tokens).toEqual(['bg-red-500']);
    const lateRemove = f.style.use(tw('text-white'));
    expect(() => f.style.patch(tw('opacity-100'))).toThrow();
    expect(() => f.style.suppress(tw('bg-red-500'))).toThrow();
    expect(() => f.style.clearPatch()).toThrow();
    expect(() => f.style.use(tw('hover:opacity-100'))).toThrow();
    f.port.useStyleUnsafe(tw('hover:opacity-100'));
    f.mount();
    expect(() => f.style.use(tw('opacity-100'))).toThrow();
    expect(() => lateRemove()).toThrow();
    expect(f.style.exportMerged().tokens).toContain('text-white');
    expect(() => f.style.patch(tw('hover:opacity-100'))).toThrow();
    expect(() => f.style.patch(tw('data-pui-style'))).toThrow();
  });

  it('T-FEEDBACK-0001-CASE-MERGE: keeps patch precedence across privileged base replacement and disposal', () => {
    const f = fixture();
    f.caps.attach([[EFFECTS_CAP, f.effects]]);
    f.style.use(tw('opacity-25 text-white'));
    f.mount();
    let off = f.port.useStyleRuntime(tw('opacity-50 bg-red-500'));
    f.style.patch(tw('opacity-100'));
    f.style.suppress(tw('bg-blue-500'));
    f.queueStyle.mockClear();
    off = f.port.replaceStyleRuntime(off, tw('opacity-75 bg-blue-500'))!;
    expect(f.queueStyle).toHaveBeenCalledTimes(1);
    expect(f.style.exportMerged().tokens).toEqual(['text-white', 'opacity-100']);
    f.style.clearPatch();
    expect(f.style.exportMerged().tokens).toEqual(['opacity-75', 'text-white', 'bg-blue-500']);
    off();
    expect(f.style.exportMerged().tokens).toEqual(['opacity-25', 'text-white']);
  });

  it('T-FEEDBACK-0001-CASE-LIFETIME: retains changes with missing capability and replays into a fresh view', () => {
    const f = fixture();
    f.style.use(tw('opacity-25'));
    f.mount();
    f.style.patch(tw('opacity-100'));
    expect(f.queueStyle).not.toHaveBeenCalled();
    f.caps.attach([[EFFECTS_CAP, f.effects]]);
    expect(f.queueStyle).toHaveBeenLastCalledWith(tw('opacity-100'));
    f.hooks.onMountPhase?.('unmounting', 1);
    f.queueStyle.mockClear();
    f.port.applyMergedStyle(tw('text-white'));
    f.hooks.afterRenderCommit();
    f.hooks.onEffectsFlushed?.();
    expect(f.queueStyle).not.toHaveBeenCalled();
    f.hooks.onMountPhase?.('detached', 1);
    f.caps.resetAttached();
    f.style.patch(tw('bg-blue-500'));
    f.caps.attach([[EFFECTS_CAP, f.effects]]);
    expect(f.queueStyle).not.toHaveBeenCalled();
    f.hooks.onMountPhase?.('mounting', 2);
    expect(f.queueStyle).toHaveBeenLastCalledWith(tw('opacity-100 bg-blue-500'));
  });

  it('T-FEEDBACK-0001-CASE-LIFETIME: delayed temporary projection cannot cross view epochs', () => {
    const f = fixture();
    f.style.use(tw('opacity-25'));
    f.mount();
    f.port.applyMergedStyle(tw('stale-view-token'));
    f.hooks.onMountPhase?.('detached', 1);
    f.hooks.onMountPhase?.('mounting', 2);
    f.caps.attach([[EFFECTS_CAP, f.effects]]);
    expect(f.queueStyle).toHaveBeenCalled();
    for (const [handle] of f.queueStyle.mock.calls) {
      expect(handle.tokens).not.toContain('stale-view-token');
    }
    expect(f.queueStyle).toHaveBeenLastCalledWith(tw('opacity-25'));
  });

  it('T-FEEDBACK-0001-CASE-LIFETIME: terminal cleanup cannot be undone by retained port, hooks or disposers', () => {
    const f = fixture();
    f.style.use(tw('opacity-25'));
    const unsafeOff = f.port.useStyleUnsafe(tw('hover:opacity-50'));
    f.mount();
    const off = f.port.useStyleRuntime(tw('text-white'));
    f.style.patch(tw('opacity-100'));
    // Missing capability leaves pending work before terminal teardown.
    f.port.applyMergedStyle(tw('bg-red-500'));
    f.hooks.dispose?.();
    expect(f.style.exportMerged().tokens).toEqual([]);
    for (const write of [
      () => f.style.patch(tw('opacity-50')),
      () => f.style.suppress(tw('text-white')),
      () => f.style.clearPatch(),
      () => f.port.useStyleRuntime(tw('text-white')),
      () => f.port.replaceStyleRuntime(null, tw('text-white')),
      () => f.port.useStyleUnsafe(tw('hover:opacity-50')),
    ])
      expect(write).toThrow();
    off();
    unsafeOff();
    f.port.applyMergedStyle(tw('bg-blue-500'));
    f.caps.attach([[EFFECTS_CAP, f.effects]]);
    f.hooks.afterRenderCommit();
    f.hooks.onMountPhase?.('mounting', 2);
    f.hooks.onEffectsFlushed?.();
    expect(f.queueStyle).not.toHaveBeenCalled();
    expect(f.requestFlush).not.toHaveBeenCalled();
    expect(f.style.exportMerged().tokens).toEqual([]);
  });
});
