import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { resolveWebFocusEntryTarget } from '@proto.ui/adapter-base';
import {
  createLogicalInstance,
  bindLogicalParent,
  markProtoInstance,
  unbindProtoInstance,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  isNativeFocusTargetReady,
  subscribeFocusTargetOwnerReady,
} from '../src/platform/instance-tree';

// Controlled readiness sources exercise the private bridge and teardown order.
// Actual Vue lifecycle regressions live in focus-request-readiness.integration.
it('uses the actual event owner and keeps native admission root-scoped', () => {
  const proto = definePrototype({ name: 'vue-owner-readiness-boundary', setup() {} });
  const token = createLogicalInstance(proto);
  const root = document.createElement('div');
  const target = document.createElement('button');
  root.append(target);
  document.body.append(root);
  markProtoInstance(root, proto, token);
  let ready = false;
  const listeners = new Set<() => void>();
  const release = registerNativeFocusReadiness(token, {
    isReady: () => ready,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  const notify = vi.fn();
  const off = subscribeFocusTargetOwnerReady(target, notify);
  try {
    for (const listener of [...listeners]) listener();
    expect(notify).not.toHaveBeenCalled();
    expect(isFocusTargetOwnerReady(target)).toBe(false);
    expect(isNativeFocusTargetReady(root)).toBe(false);
    ready = true;
    for (const listener of [...listeners]) listener();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(isFocusTargetOwnerReady(target)).toBe(true);
    expect(isNativeFocusTargetReady(root)).toBe(true);
    expect(isNativeFocusTargetReady(target)).toBe(false);
    const stale = [...listeners];
    off();
    for (const listener of stale) listener();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  } finally {
    off();
    release();
    unbindProtoInstance(token, root);
    root.remove();
  }
});

it.each(['cleanup-first', 'dom-first'] as const)(
  'invalidates a missing ordinary owner after DOM commit, without borrowing its ancestor: %s',
  async (order) => {
    const proto = definePrototype({ name: `vue-owner-removal-${order}`, setup() {} });
    const outer = createLogicalInstance(proto);
    const oldOwner = createLogicalInstance(proto);
    const nextOwner = createLogicalInstance(proto);
    bindLogicalParent(oldOwner, outer);
    bindLogicalParent(nextOwner, outer);
    const container = document.createElement('div');
    const oldTarget = document.createElement('button');
    const replacement = document.createElement('button');
    container.append(oldTarget, replacement);
    document.body.append(container);
    markProtoInstance(container, proto, outer);
    markProtoInstance(oldTarget, proto, oldOwner);
    markProtoInstance(replacement, proto, nextOwner);
    const releaseOuter = registerNativeFocusReadiness(outer, {
      isReady: () => true,
      subscribe: () => () => {},
    });
    const oldListeners = new Set<() => void>();
    let oldReady = false;
    const releaseOld = registerNativeFocusReadiness(oldOwner, {
      isReady: () => oldReady,
      subscribe: (listener) => {
        oldListeners.add(listener);
        return () => oldListeners.delete(listener);
      },
    });
    const releaseNext = registerNativeFocusReadiness(nextOwner, {
      isReady: () => true,
      subscribe: () => () => {},
    });
    const oldFocus = vi.spyOn(oldTarget, 'focus');
    const invalidate = vi.fn(() => {
      const target = resolveWebFocusEntryTarget(
        container,
        { strategy: 'descendant-first', fallback: 'none' },
        (element) => element.tagName === 'BUTTON'
      );
      if (target && isFocusTargetOwnerReady(target)) target.focus();
    });
    const off = subscribeFocusTargetOwnerReady(oldTarget, invalidate);
    const staleListeners = [...oldListeners];
    try {
      expect(isFocusTargetOwnerReady(oldTarget)).toBe(false);
      if (order === 'dom-first') oldTarget.remove();
      releaseOld();
      unbindProtoInstance(oldOwner, oldTarget);
      expect(invalidate).not.toHaveBeenCalled();
      if (order === 'cleanup-first') oldTarget.remove();
      await Promise.resolve();
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(oldFocus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(replacement);
      oldReady = true;
      for (const callback of staleListeners) callback();
      expect(invalidate).toHaveBeenCalledTimes(1);
    } finally {
      off();
      releaseOld();
      releaseNext();
      releaseOuter();
      unbindProtoInstance(oldOwner, oldTarget);
      unbindProtoInstance(nextOwner, replacement);
      unbindProtoInstance(outer, container);
      oldFocus.mockRestore();
      container.remove();
    }
  }
);

it.each(['dispose', 'replacement-closed', 'replacement-ready'] as const)(
  'rejects queued source-loss invalidation after %s',
  async (transition) => {
    const proto = definePrototype({ name: `vue-readiness-queued-${transition}`, setup() {} });
    const token = createLogicalInstance(proto);
    const target = document.createElement('button');
    document.body.append(target);
    markProtoInstance(target, proto, token);
    const oldListeners = new Set<() => void>();
    let oldReady = false;
    const releaseOld = registerNativeFocusReadiness(token, {
      isReady: () => oldReady,
      subscribe: (callback) => {
        oldListeners.add(callback);
        return () => oldListeners.delete(callback);
      },
    });
    const notify = vi.fn();
    const off = subscribeFocusTargetOwnerReady(target, notify);
    const staleListeners = [...oldListeners];
    let releaseNext: (() => void) | undefined;
    try {
      releaseOld();
      if (transition === 'dispose') off();
      else {
        releaseNext = registerNativeFocusReadiness(token, {
          isReady: () => transition === 'replacement-ready',
          subscribe: () => () => {},
        });
      }
      oldReady = true;
      for (const callback of staleListeners) callback();
      await Promise.resolve();
      expect(notify).toHaveBeenCalledTimes(transition === 'replacement-ready' ? 1 : 0);
    } finally {
      off();
      releaseOld();
      releaseNext?.();
      unbindProtoInstance(token, target);
      target.remove();
    }
  }
);
