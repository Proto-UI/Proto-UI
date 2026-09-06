import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createMountedReactAdapter } from './utils/fake-react';

const headingPrototype = definePrototype({
  name: 'react-a11y-heading-level',
  setup(def) {
    const role = def.state.string('heading.role', 'heading');
    const level = def.state.numberDiscrete('heading.level', 2);
    def.a11y.role(role);
    def.a11y.level(level);
    def.expose.method('setRole', (value: string) => role.set(value, 'reason: update heading role'));
    def.expose.method('setLevel', (value: number) =>
      level.set(value, 'reason: update heading level')
    );
    def.expose.method('getLevel', () => level.get());
    return (r) => r.el('div', 'Heading');
  },
});

describe('adapter-react: portable heading level', () => {
  it('projects valid levels, omits invalid updates, and clears aria-level after a role change', () => {
    const mounted = createMountedReactAdapter(headingPrototype);
    const exposes = mounted.ref.current.getExposes() as {
      setRole(value: string): void;
      setLevel(value: number): void;
      getLevel(): number;
    };

    try {
      expect(mounted.root?.getAttribute('role')).toBe('heading');
      expect(mounted.root?.getAttribute('aria-level')).toBe('2');
      exposes.setLevel(6);
      expect(mounted.root?.getAttribute('aria-level')).toBe('6');
      exposes.setLevel(0);
      expect(exposes.getLevel()).toBe(0);
      expect(mounted.root?.getAttribute('role')).toBe('heading');
      expect(mounted.root?.hasAttribute('aria-level')).toBe(false);
      exposes.setLevel(4);
      expect(exposes.getLevel()).toBe(4);
      expect(mounted.root?.getAttribute('aria-level')).toBe('4');
      exposes.setRole('button');
      expect(mounted.root?.getAttribute('role')).toBe('button');
      expect(mounted.root?.hasAttribute('aria-level')).toBe(false);
      exposes.setRole('heading');
      expect(mounted.root?.getAttribute('role')).toBe('heading');
      expect(mounted.root?.getAttribute('aria-level')).toBe('4');
    } finally {
      mounted.unmount();
    }
  });
});
