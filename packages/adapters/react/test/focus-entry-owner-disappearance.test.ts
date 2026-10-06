// Controlled readiness with the actual Focus Module. Mutation orders model
// retained hide and terminal teardown; this is not native-browser evidence.
import { expect, it } from 'vitest';
import { definePrototype, type FocusEntryConfig } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_TARGET_READY_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-focus';
import { resolveWebFocusEntryTarget } from '../../base/src/platform/focus-entry';
import {
  createLogicalInstance,
  bindLogicalParent,
  markProtoInstance,
  unbindProtoInstance,
  registerNativeFocusReadiness,
  isFocusTargetOwnerReady,
  subscribeFocusTargetOwnerReady,
} from '../src/platform/instance-tree';

it.each([
  ['remove-before-cleanup', 'apply'],
  ['cleanup-before-remove', 'apply'],
  ['cleanup-before-remove', 'disable'],
  ['cleanup-before-remove', 'blur'],
  ['cleanup-before-remove', 'supersede'],
  ['cleanup-before-remove', 'requester-dispose'],
] as const)(
  're-resolves retained entry after an ordinary owner disappears: %s / %s',
  async (order, action) => {
    let entry!: ReturnType<typeof asFocusEntry>;
    let focusable!: ReturnType<typeof asFocusable>;
    const proto = definePrototype({
      name: `ordinary-disappear-${order}`,
      setup() {
        focusable = asFocusable();
        entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        return () => null;
      },
    });
    const outer = createLogicalInstance(proto),
      inner = createLogicalInstance(proto);
    bindLogicalParent(inner, outer);
    const root = document.createElement('div'),
      first = document.createElement('button'),
      fallback = document.createElement('button');
    first.textContent = 'departing';
    fallback.textContent = 'fallback';
    root.append(first, fallback);
    document.body.append(root);
    markProtoInstance(root, proto, outer);
    markProtoInstance(first, proto, inner);
    const releaseOuter = registerNativeFocusReadiness(outer, {
      isReady: () => true,
      subscribe: () => () => {},
    });
    const innerListeners = new Set<() => void>();
    const releaseInner = registerNativeFocusReadiness(inner, {
      isReady: () => false,
      subscribe: (fn) => {
        innerListeners.add(fn);
        return () => innerListeners.delete(fn);
      },
    });
    const readyListeners = new Set<() => void>();
    let offOwner: (() => void) | undefined;
    const applied: HTMLElement[] = [];
    let session!: ReturnType<typeof createRuntimeSession>;
    session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (fn) => fn(),
      commit: (_c, s) => s?.done(),
      onRuntimeReady(wiring) {
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => root],
          [EVENT_GLOBAL_TARGET_CAP, () => window],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, outer],
          [FOCUS_PARENT_CAP, () => null],
          [FOCUS_ROOT_TARGET_CAP, () => root],
          [
            FOCUS_RESOLVE_ENTRY_TARGET_CAP,
            (el: HTMLElement, config: FocusEntryConfig) =>
              resolveWebFocusEntryTarget(el, config, (node) => node.tagName === 'BUTTON'),
          ],
          [
            FOCUS_REQUEST_FOCUS_CAP,
            (target: HTMLElement) => {
              offOwner?.();
              offOwner = undefined;
              if (!isFocusTargetOwnerReady(target)) {
                offOwner = subscribeFocusTargetOwnerReady(target, () => {
                  offOwner?.();
                  offOwner = undefined;
                  for (const fn of [...readyListeners]) fn();
                });
                return false;
              }
              applied.push(target);
              target.focus();
              return document.activeElement === target;
            },
          ],
          [
            FOCUS_TARGET_READY_CAP,
            (fn: () => void) => {
              readyListeners.add(fn);
              return () => readyListeners.delete(fn);
            },
          ],
          [FOCUS_RUN_IN_CALLBACK_CAP, (fn: () => void) => session.invokeInCallbackScope(fn)],
        ]);
      },
    });
    try {
      await session.mount();
      entry.focus();
      expect(applied).toEqual([]);
      expect(innerListeners.size).toBe(1);
      if (order === 'remove-before-cleanup') first.remove();
      releaseInner();
      unbindProtoInstance(inner, first);
      // Cleanup can run before React removes physical nodes. Do not focus this doomed node.
      expect(applied).not.toContain(first);
      first.remove();
      if (action === 'disable') entry.setDisabled(true);
      if (action === 'blur') focusable.blur();
      if (action === 'supersede') entry.focus({ reason: 'keyboard' });
      if (action === 'requester-dispose') {
        offOwner?.();
        offOwner = undefined;
        await session.dispose();
      }
      await Promise.resolve();
      await Promise.resolve();
      console.info('ordinary owner disappeared', {
        order,
        applied: applied.map((x) => x.textContent),
        fallbackActive: document.activeElement === fallback,
        oldListeners: innerListeners.size,
      });
      const expected = action === 'apply' || action === 'supersede';
      expect(applied).toEqual(expected ? [fallback] : []);
      expect(document.activeElement === fallback).toBe(expected);
    } finally {
      offOwner?.();
      await session.dispose();
      releaseInner();
      releaseOuter();
      unbindProtoInstance(inner, first);
      unbindProtoInstance(outer, root);
      root.remove();
    }
  }
);

it.each([false, true])(
  'lets a replacement source own queued disappearance with ready=%s',
  async (initiallyReady) => {
    const proto = definePrototype({
        name: `ordinary-source-replacement-${initiallyReady}`,
        setup() {},
      }),
      token = createLogicalInstance(proto);
    const target = document.createElement('button');
    document.body.append(target);
    markProtoInstance(target, proto, token);
    const oldListeners = new Set<() => void>(),
      newListeners = new Set<() => void>();
    let ready = initiallyReady,
      notifications = 0;
    const releaseOld = registerNativeFocusReadiness(token, {
      isReady: () => false,
      subscribe: (fn) => {
        oldListeners.add(fn);
        return () => oldListeners.delete(fn);
      },
    });
    const off = subscribeFocusTargetOwnerReady(target, () => notifications++);
    const copiedOld = [...oldListeners];
    let releaseNew: (() => void) | undefined;
    try {
      releaseOld();
      releaseNew = registerNativeFocusReadiness(token, {
        isReady: () => ready,
        subscribe: (fn) => {
          newListeners.add(fn);
          return () => newListeners.delete(fn);
        },
      });
      for (const fn of copiedOld) fn();
      await Promise.resolve();
      await Promise.resolve();
      expect(notifications).toBe(initiallyReady ? 1 : 0);
      expect(newListeners.size).toBe(1);
      if (!initiallyReady) {
        ready = true;
        for (const fn of [...newListeners]) fn();
        expect(notifications).toBe(1);
      }
      const copiedNew = [...newListeners];
      off();
      for (const fn of copiedNew) fn();
      expect(notifications).toBe(1);
      expect(newListeners.size).toBe(0);
    } finally {
      off();
      releaseOld();
      releaseNew?.();
      unbindProtoInstance(token, target);
      target.remove();
    }
  }
);
