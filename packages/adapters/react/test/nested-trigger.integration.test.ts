import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button } from '@proto.ui/prototypes-base';
import { definePrototype } from '@proto.ui/core';
import {
  asButton,
  type ButtonExposes,
  type ButtonStateHandles,
} from '../../../prototypes/base/src/button';

import { createReactAdapter } from '../src';
import type { ReactAdapterHandle } from '../src/adapt';
import {
  bindLogicalParent,
  getLogicalTriggerSurfaceRoot,
  isNativeFocusTargetReady,
  markProtoInstance,
  mergeLogicalTriggerGroup,
  registerNativeFocusReadiness,
  subscribeFocusSurfaceReady,
} from '../src/platform/instance-tree';

type ButtonConsumerExposes = {
  focusSelf: ButtonExposes['focusSelf']['fn'];
  focused: Pick<ButtonStateHandles['focused'], 'get'>;
};

const mountedRoots: Array<{ unmount(): void }> = [];
const readinessCleanups: Array<() => void> = [];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  for (const root of mountedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  for (const cleanup of readinessCleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});

function createReadinessChain() {
  const outer = document.createElement('div');
  const requester = document.createElement('div');
  const previous = document.createElement('div');
  const next = document.createElement('button');
  previous.tabIndex = 0;
  document.body.appendChild(outer);
  outer.appendChild(requester);
  requester.appendChild(previous);
  previous.appendChild(next);
  const anchor = markProtoInstance(outer, button);
  const instance = markProtoInstance(requester, button);
  const oldOwner = markProtoInstance(previous, button);
  const newOwner = markProtoInstance(next, button);
  bindLogicalParent(instance, anchor);
  bindLogicalParent(oldOwner, instance);
  bindLogicalParent(newOwner, oldOwner);
  for (const token of [anchor, instance, oldOwner]) mergeLogicalTriggerGroup(token, anchor);
  return { anchor, instance, oldOwner, newOwner, previous, next };
}

function createReadinessProvider(target: HTMLElement) {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    source: {
      isReady: () => ready && target.isConnected,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    publishReady() {
      ready = true;
      for (const listener of Array.from(listeners)) listener();
    },
  };
}

describe('adapter-react: nested trigger routing', () => {
  it('defers outer native focus until the resolved inner Trigger surface is ready', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    const outerRef = React.createRef<ReactAdapterHandle>();
    const innerRef = React.createRef<ReactAdapterHandle>();
    const innerProto = definePrototype({
      name: 'react-inner-trigger-native-readiness',
      setup(def) {
        asButton();
        def.expose.event('beforeReady');
        def.lifecycle.onUpdated((run) => run.expose.emit('beforeReady'));
        return (renderer) => [renderer.el('span', 'Inner')];
      },
    });
    const adapt = createReactAdapter(React);
    const Outer = adapt(button, { rootTag: 'div' });
    const Inner = adapt(innerProto, { rootTag: 'div' });
    const duringCommit: Array<{ active: boolean; focused: boolean }> = [];
    let requestFocus = false;
    await act(async () => {
      root.render(
        React.createElement(
          Outer,
          { ref: outerRef },
          React.createElement(Inner, {
            ref: innerRef,
            onBeforeReady: () => {
              if (!requestFocus) return;
              requestFocus = false;
              (outerRef.current!.getExposes() as ButtonConsumerExposes).focusSelf();
              const target = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1]!;
              duringCommit.push({
                active: document.activeElement === target,
                focused: (innerRef.current!.getExposes() as ButtonConsumerExposes).focused.get(),
              });
            },
          })
        )
      );
    });
    const innerTarget = host.querySelectorAll<HTMLElement>('[data-pui-root]')[1]!;
    requestFocus = true;
    await act(async () => innerRef.current!.update());
    expect(duringCommit).toEqual([{ active: false, focused: false }]);
    expect(document.activeElement).toBe(innerTarget);
    expect((innerRef.current!.getExposes() as ButtonConsumerExposes).focused.get()).toBe(true);
  });

  it('merges nested adapted triggers while accepting activation only from the inner surface', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    const adapt = createReactAdapter(React);
    const Button = adapt(button, {
      rootTag: 'div',
      schedule: (task) => task(),
    });
    const outerClick = vi.fn();
    const innerClick = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          Button,
          { onClick: outerClick },
          React.createElement(Button, { onClick: innerClick }, 'Inner')
        )
      );
      await Promise.resolve();
    });

    const roots = host.querySelectorAll<HTMLElement>('[data-pui-root]');
    expect(roots).toHaveLength(2);
    expect(roots[0]!.tabIndex).toBe(-1);
    expect(roots[0]!.hasAttribute('tabindex')).toBe(false);
    expect(roots[0]!.hasAttribute('role')).toBe(false);
    expect(roots[1]!.tabIndex).toBe(0);
    expect(roots[1]!.getAttribute('role')).toBe('button');

    await act(async () => {
      roots[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await Promise.resolve();
    });

    expect(innerClick).not.toHaveBeenCalled();
    expect(outerClick).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    roots[1]!.focus();
    expect(roots[1]!.hasAttribute('data-focus-visible')).toBe(true);
    expect(roots[0]!.hasAttribute('data-focus-visible')).toBe(false);

    await act(async () => {
      roots[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(innerClick).toHaveBeenCalledOnce();
    expect(outerClick).toHaveBeenCalledOnce();
  });
});

describe('adapter-react: controlled readiness source dispatch', () => {
  // Injected passive providers expose source-change reentry. Physical DOM focus
  // is observed here; the real React commit-window case above owns lifecycle evidence.
  it('keeps the current owner wake-up after an older source callback was copied', async () => {
    const scene = createReadinessChain();
    await Promise.resolve();
    await Promise.resolve();
    const original = createReadinessProvider(scene.previous);
    const next = createReadinessProvider(scene.next);
    const cleanupOriginal = registerNativeFocusReadiness(scene.oldOwner, original.source);
    readinessCleanups.push(cleanupOriginal);
    readinessCleanups.push(registerNativeFocusReadiness(scene.newOwner, next.source));
    let changeOwner = false;
    readinessCleanups.push(
      subscribeFocusSurfaceReady(scene.anchor, () => {
        if (!changeOwner) return;
        changeOwner = false;
        mergeLogicalTriggerGroup(scene.newOwner, scene.anchor);
      })
    );
    readinessCleanups.push(
      subscribeFocusSurfaceReady(scene.instance, () => {
        const target = getLogicalTriggerSurfaceRoot(scene.instance);
        if (target && isNativeFocusTargetReady(target)) target.focus();
      })
    );
    const replacement = createReadinessProvider(scene.previous);
    changeOwner = true;
    readinessCleanups.push(registerNativeFocusReadiness(scene.oldOwner, replacement.source));
    cleanupOriginal();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(scene.next);
    next.publishReady();
    expect(document.activeElement).toBe(scene.next);
  });

  it('does not recreate a released consumer from a copied source callback', async () => {
    const scene = createReadinessChain();
    await Promise.resolve();
    await Promise.resolve();
    const original = createReadinessProvider(scene.previous);
    readinessCleanups.push(registerNativeFocusReadiness(scene.oldOwner, original.source));
    let releaseConsumer: (() => void) | undefined;
    let disposeConsumer = false;
    readinessCleanups.push(
      subscribeFocusSurfaceReady(scene.anchor, () => {
        if (!disposeConsumer) return;
        disposeConsumer = false;
        releaseConsumer?.();
      })
    );
    releaseConsumer = subscribeFocusSurfaceReady(scene.instance, () => {
      const target = getLogicalTriggerSurfaceRoot(scene.instance);
      if (target && isNativeFocusTargetReady(target)) target.focus();
    });
    readinessCleanups.push(releaseConsumer);
    const replacement = createReadinessProvider(scene.previous);
    disposeConsumer = true;
    readinessCleanups.push(registerNativeFocusReadiness(scene.oldOwner, replacement.source));
    await Promise.resolve();
    await Promise.resolve();
    replacement.publishReady();
    expect(document.activeElement).not.toBe(scene.previous);
  });
});
