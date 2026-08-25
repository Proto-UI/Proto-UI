import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asFocusScope } from '@proto.ui/hooks';

import { asButton } from '../../../prototypes/base/src/button';
import { createMountedReactAdapter } from './utils/fake-react';

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
