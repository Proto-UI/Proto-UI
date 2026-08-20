import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusScope } from '@proto.ui/hooks';

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
});
