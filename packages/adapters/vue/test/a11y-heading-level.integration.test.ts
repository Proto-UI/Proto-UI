import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createMountedVueAdapter, flushVue } from './utils/vue';

const headingPrototype = definePrototype({
  name: 'vue-a11y-heading-level',
  setup(def) {
    const role = def.state.string('heading.role', 'heading');
    const level = def.state.numberDiscrete('heading.level', 2);
    def.a11y.role(role);
    def.a11y.level(level);
    def.expose.method('setRole', (value: string) => role.set(value, 'reason: update heading role'));
    def.expose.method('setLevel', (value: number) =>
      level.set(value, 'reason: update heading level')
    );
    return (r) => r.el('div', 'Heading');
  },
});

describe('adapter-vue: portable heading level', () => {
  it('projects, rolls back invalid updates, and clears aria-level after a role change', async () => {
    const mounted = createMountedVueAdapter(headingPrototype);
    mounted.vm.update?.();
    await flushVue();
    const exposes = mounted.vm.getExposes() as {
      setRole(value: string): void;
      setLevel(value: number): void;
    };
    const root = mounted.root;
    if (!root) throw new Error('Vue adapter did not materialize a root element');

    try {
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.getAttribute('aria-level')).toBe('2');
      exposes.setLevel(6);
      await flushVue();
      expect(root.getAttribute('aria-level')).toBe('6');
      expect(() => exposes.setLevel(0)).toThrow(/level must be an integer in range 1-6/);
      expect(root.getAttribute('aria-level')).toBe('6');
      exposes.setRole('button');
      await flushVue();
      expect(root.getAttribute('role')).toBe('button');
      expect(root.hasAttribute('aria-level')).toBe(false);
      exposes.setRole('heading');
      await flushVue();
      expect(root.getAttribute('aria-level')).toBe('6');
    } finally {
      mounted.unmount();
    }
  });
});
