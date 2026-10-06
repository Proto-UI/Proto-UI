import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import {
  createLogicalInstance,
  bindLogicalParent,
  mergeLogicalTriggerGroup,
  getLogicalTriggerSurfaceOwner,
  markProtoInstance,
  unbindProtoInstance,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  isNativeFocusTargetReady,
  subscribeFocusTargetOwnerReady,
} from '../src/platform/instance-tree';

// Controlled readiness sources test the private bridge itself. They do not
// constitute native browser event-order evidence; the real React regression
// uses the actual Adapter's onUpdated gate without injecting these sources.
it('entry readiness follows descendant owner while native Trigger readiness remains root-scoped', () => {
  const proto = definePrototype({ name: 'entry-owner-readiness-boundaries', setup() {} });
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
  let notifications = 0;
  const off = subscribeFocusTargetOwnerReady(target, () => notifications++);
  try {
    expect(isFocusTargetOwnerReady(target)).toBe(false);
    expect(isNativeFocusTargetReady(root)).toBe(false);
    for (const listener of [...listeners]) listener();
    expect(notifications).toBe(0);
    ready = true;
    for (const listener of [...listeners]) listener();
    expect(notifications).toBe(1);
    expect(isFocusTargetOwnerReady(target)).toBe(true);
    expect(isNativeFocusTargetReady(root)).toBe(true);
    expect(isNativeFocusTargetReady(target)).toBe(false);
    off();
    expect(listeners.size).toBe(0);
  } finally {
    off();
    release();
    unbindProtoInstance(token, root);
    root.remove();
  }
});

it('rebinds retained owner readiness and rejects copied callbacks after replacement or disposal', () => {
  const proto = definePrototype({ name: 'entry-owner-readiness-replacement', setup() {} });
  const token = createLogicalInstance(proto);
  const root = document.createElement('div');
  const target = document.createElement('button');
  root.append(target);
  document.body.append(root);
  markProtoInstance(root, proto, token);
  let ready = false;
  const originalListeners = new Set<() => void>();
  const releaseOriginal = registerNativeFocusReadiness(token, {
    isReady: () => ready,
    subscribe: (listener) => {
      originalListeners.add(listener);
      return () => originalListeners.delete(listener);
    },
  });
  let notifications = 0;
  const off = subscribeFocusTargetOwnerReady(target, () => notifications++);
  const copiedOriginal = [...originalListeners];
  const replacementListeners = new Set<() => void>();
  let replacementReady = false;
  let releaseReplacement: (() => void) | undefined;
  try {
    releaseOriginal();
    expect(notifications).toBe(0);
    expect(originalListeners.size).toBe(0);
    releaseReplacement = registerNativeFocusReadiness(token, {
      isReady: () => replacementReady,
      subscribe: (listener) => {
        replacementListeners.add(listener);
        return () => replacementListeners.delete(listener);
      },
    });
    ready = true;
    for (const listener of copiedOriginal) listener();
    expect(notifications).toBe(0);
    expect(isFocusTargetOwnerReady(target)).toBe(false);
    replacementReady = true;
    const copiedReplacement = [...replacementListeners];
    for (const listener of copiedReplacement) listener();
    expect(notifications).toBe(1);
    expect(isFocusTargetOwnerReady(target)).toBe(true);
    off();
    for (const listener of copiedReplacement) listener();
    expect(notifications).toBe(1);
    expect(replacementListeners.size).toBe(0);
  } finally {
    off();
    releaseOriginal();
    releaseReplacement?.();
    unbindProtoInstance(token, root);
    root.remove();
  }
});

it('rebinds a rejected entry to the fallback event owner after the old Trigger surface unmounts', () => {
  const proto = definePrototype({ name: 'entry-owner-surface-fallback', setup() {} });
  const outer = createLogicalInstance(proto);
  const inner = createLogicalInstance(proto);
  bindLogicalParent(inner, outer);
  const root = document.createElement('button');
  const oldTarget = document.createElement('button');
  root.append(oldTarget);
  document.body.append(root);
  markProtoInstance(root, proto, outer);
  markProtoInstance(oldTarget, proto, inner);
  mergeLogicalTriggerGroup(inner, outer);
  let outerReady = false;
  let innerReady = false;
  const outerListeners = new Set<() => void>();
  const innerListeners = new Set<() => void>();
  const releaseOuter = registerNativeFocusReadiness(outer, {
    isReady: () => outerReady,
    subscribe: (fn) => {
      outerListeners.add(fn);
      return () => outerListeners.delete(fn);
    },
  });
  const releaseInner = registerNativeFocusReadiness(inner, {
    isReady: () => innerReady,
    subscribe: (fn) => {
      innerListeners.add(fn);
      return () => innerListeners.delete(fn);
    },
  });
  let notifications = 0;
  const off = subscribeFocusTargetOwnerReady(oldTarget, () => notifications++);
  const copiedInner = [...innerListeners];
  try {
    releaseInner();
    unbindProtoInstance(inner, oldTarget);
    oldTarget.remove();
    expect(notifications).toBe(0);
    expect(innerListeners.size).toBe(0);
    expect(outerListeners.size).toBe(1);
    innerReady = true;
    for (const fn of copiedInner) fn();
    expect(notifications).toBe(0);
    outerReady = true;
    for (const fn of [...outerListeners]) fn();
    expect(notifications).toBe(1);
    expect(isFocusTargetOwnerReady(root)).toBe(true);
    const copiedOuter = [...outerListeners];
    off();
    for (const fn of copiedOuter) fn();
    expect(notifications).toBe(1);
    expect(outerListeners.size).toBe(0);
  } finally {
    off();
    releaseInner();
    releaseOuter();
    unbindProtoInstance(inner, oldTarget);
    unbindProtoInstance(outer, root);
    root.remove();
  }
});

it.each([false, true])(
  'follows consecutive closed-gate replacements with anchor detached: %s',
  async (detachAnchor) => {
    const proto = definePrototype({ name: 'review-owner-churn', setup() {} });
    const outer = createLogicalInstance(proto),
      oldInner = createLogicalInstance(proto),
      newInner = createLogicalInstance(proto);
    bindLogicalParent(oldInner, outer);
    const root = document.createElement('div'),
      oldTarget = document.createElement('button'),
      newTarget = document.createElement('button');
    root.append(oldTarget);
    document.body.append(root);
    markProtoInstance(root, proto, outer);
    markProtoInstance(oldTarget, proto, oldInner);
    mergeLogicalTriggerGroup(oldInner, outer);
    await Promise.resolve();
    await Promise.resolve();
    let readyOuter = false,
      readyOld = false,
      readyNew = false,
      notifications = 0;
    const outerListeners = new Set<() => void>(),
      oldListeners = new Set<() => void>(),
      newListeners = new Set<() => void>();
    const register = (token: any, ready: () => boolean, listeners: Set<() => void>) =>
      registerNativeFocusReadiness(token, {
        isReady: ready,
        subscribe: (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      });
    const releaseOuter = register(outer, () => readyOuter, outerListeners),
      releaseOld = register(oldInner, () => readyOld, oldListeners);
    let releaseNew: undefined | (() => void);
    const off = subscribeFocusTargetOwnerReady(oldTarget, () => notifications++);
    try {
      releaseOld();
      unbindProtoInstance(oldInner, oldTarget);
      oldTarget.remove();
      expect(getLogicalTriggerSurfaceOwner(oldInner)).toBe(outer);
      expect(outerListeners.size).toBe(1);
      expect(notifications).toBe(0);
      if (detachAnchor) {
        releaseOuter();
        unbindProtoInstance(outer, root);
      }
      bindLogicalParent(newInner, outer);
      root.append(newTarget);
      markProtoInstance(newTarget, proto, newInner);
      mergeLogicalTriggerGroup(newInner, outer);
      releaseNew = register(newInner, () => readyNew, newListeners);
      await Promise.resolve();
      await Promise.resolve();
      expect(getLogicalTriggerSurfaceOwner(oldInner)).toBe(newInner);
      console.info('second replacement subscription sizes', {
        outer: outerListeners.size,
        old: oldListeners.size,
        replacement: newListeners.size,
      });
      readyNew = true;
      for (const fn of [...newListeners]) fn();
      expect(notifications).toBe(1);
      expect(outerListeners.size).toBe(0);
      expect(newListeners.size).toBe(1);
    } finally {
      off();
      releaseOld();
      releaseNew?.();
      releaseOuter();
      unbindProtoInstance(newInner, newTarget);
      unbindProtoInstance(oldInner, oldTarget);
      unbindProtoInstance(outer, root);
      root.remove();
    }
  }
);
