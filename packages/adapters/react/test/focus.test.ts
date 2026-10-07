import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asFocusScope } from '@proto.ui/hooks';

import { asButton } from '../../../prototypes/base/src/button';
import { createReactAdapter, type ReactAdapterHandle } from '../src/adapt';
import { createMountedReactAdapter } from './utils/fake-react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

async function mountRealReact(proto: Prototype) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<ReactAdapterHandle>();
  const Component = createReactAdapter(React)(proto, { autoUpdateOnPropsChange: false });
  await act(async () => root.render(React.createElement(Component, { ref })));
  return {
    host,
    ref,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

describe('adapter-react: focus wiring', () => {
  it('makes asButton host focusable and syncs focus/blur to exposes', () => {
    const proto = definePrototype({
      name: 'react-focusable-button',
      setup() {
        asButton();
        return (r) => [r.el('button', 'ok')];
      },
    });

    const mounted = createMountedReactAdapter(proto);

    expect(mounted.root?.tabIndex).toBe(0);

    const exposes = mounted.ref.current.getExposes();
    expect(exposes.focused.get()).toBe(false);

    mounted.root?.focus();
    expect(exposes.focused.get()).toBe(true);

    mounted.root?.blur();
    expect(exposes.focused.get()).toBe(false);

    mounted.unmount();
  });

  it('does not make focus-scope-only host focusable', () => {
    const proto = definePrototype({
      name: 'react-focus-scope-only',
      setup() {
        const scope = asFocusScope();
        scope.configure({ emptyPolicy: 'container' });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedReactAdapter(proto);

    expect(mounted.root?.tabIndex).toBe(-1);
    expect(mounted.root?.hasAttribute('tabindex')).toBe(false);

    mounted.unmount();
  });

  it('clears previous focus facts when another focusable receives host focus', () => {
    const createProto = (name: string) =>
      definePrototype({
        name,
        setup() {
          asButton();
          return (r) => [r.el('button', name)];
        },
      });

    const first = createMountedReactAdapter(createProto('react-focus-unique-first'));
    const second = createMountedReactAdapter(createProto('react-focus-unique-second'));

    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      const spy1 = vi.spyOn(first.root!, 'matches').mockReturnValue(true);
      const spy2 = vi.spyOn(second.root!, 'matches').mockReturnValue(true);
      first.root?.dispatchEvent(new FocusEvent('focus'));
      expect(first.ref.current.getExposes().focused.get()).toBe(true);
      expect(first.ref.current.getExposes().focusVisible.get()).toBe(true);

      second.root?.dispatchEvent(new FocusEvent('focus'));
      expect(second.ref.current.getExposes().focused.get()).toBe(true);
      expect(second.ref.current.getExposes().focusVisible.get()).toBe(true);
      expect(first.ref.current.getExposes().focused.get()).toBe(false);
      expect(first.ref.current.getExposes().focusVisible.get()).toBe(false);
    } finally {
      second.unmount();
      first.unmount();
    }
  });

  it('projects pointer focus as visible when the UA reports :focus-visible on text controls', () => {
    const proto = definePrototype({
      name: 'react-pointer-focus-visible-text',
      setup(def) {
        const focusable = asFocusable();
        def.expose.state('focused', focusable.focused);
        def.expose.state('focusVisible', focusable.focusVisible);
        return (r) => [r.el('input')];
      },
    });
    const mounted = createMountedReactAdapter(proto);
    const input = mounted.root!;
    const exposes = mounted.ref.current.getExposes();

    try {
      // Pointer path with a UA that keeps :focus-visible for the text control.
      input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      const matchesSpy = vi
        .spyOn(input, 'matches')
        .mockImplementation((selector: string) => selector === ':focus-visible');
      input.dispatchEvent(new FocusEvent('focus'));
      expect(matchesSpy).toHaveBeenCalledWith(':focus-visible');
      expect(exposes.focusVisible.get()).toBe(true);
      matchesSpy.mockRestore();

      // Keyboard path stays driven by the modality heuristic alone.
      input.dispatchEvent(new FocusEvent('blur'));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      const matchesSpy2 = vi.spyOn(input, 'matches').mockReturnValue(true);
      input.dispatchEvent(new FocusEvent('focus'));
      expect(exposes.focusVisible.get()).toBe(true);

      // Pointer path with a UA that rejects :focus-visible stays invisible.
      input.dispatchEvent(new FocusEvent('blur'));
      input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      vi.spyOn(input, 'matches').mockReturnValue(false);
      input.dispatchEvent(new FocusEvent('focus'));
      expect(exposes.focusVisible.get()).toBe(false);
    } finally {
      vi.restoreAllMocks();
      mounted.unmount();
    }
  });
});

describe('adapter-react: one-shot Focus effects during update commits', () => {
  it('applies onUpdated blur to the previously focused physical target', async () => {
    const proto = definePrototype({
      name: 'react-updated-blur',
      setup(def) {
        const focusable = asFocusable();
        const count = def.state.numberDiscrete('count', 0);
        def.expose.state('focused', focusable.focused);
        def.expose.method('bump', () => count.set(count.get() + 1));
        def.lifecycle.onUpdated(() => focusable.blur());
        return (renderer) => renderer.el('span', String(count.get()));
      },
    });
    const mounted = await mountRealReact(proto);
    try {
      // This owned fixture declares exactly these public exposes.
      const exposes = mounted.ref.current!.getExposes() as {
        focused: { get(): boolean };
        bump(): void;
      };
      const target = mounted.host.querySelector<HTMLElement>('[data-pui-root]')!;
      await act(async () => target.focus());
      expect(document.activeElement).toBe(target);
      expect(exposes.focused.get()).toBe(true);
      await act(async () => {
        exposes.bump();
        mounted.ref.current!.update();
      });
      expect(document.activeElement).not.toBe(target);
      expect(exposes.focused.get()).toBe(false);
    } finally {
      await mounted.unmount();
    }
  });

  it('applies descendant entry focus requested from onUpdated', async () => {
    const proto = definePrototype({
      name: 'react-updated-entry',
      setup(def) {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'self' });
        const count = def.state.numberDiscrete('count', 0);
        def.expose.method('bump', () => count.set(count.get() + 1));
        def.lifecycle.onUpdated(() => entry.focus());
        return (renderer) => [
          renderer.el('button', 'Entry child'),
          renderer.el('span', String(count.get())),
        ];
      },
    });
    const mounted = await mountRealReact(proto);
    try {
      const exposes = mounted.ref.current!.getExposes() as { bump(): void };
      const child = mounted.host.querySelector('button')!;
      expect(document.activeElement).not.toBe(child);
      await act(async () => {
        exposes.bump();
        mounted.ref.current!.update();
      });
      expect(document.activeElement).toBe(child);
    } finally {
      await mounted.unmount();
    }
  });
});
