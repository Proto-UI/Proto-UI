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
    def.expose.method('getLevel', () => level.get());
    return (r) => r.el('div', 'Heading');
  },
});

describe('adapter-vue: portable heading level', () => {
  it('projects valid levels, omits invalid updates, and clears aria-level after a role change', async () => {
    const mounted = createMountedVueAdapter(headingPrototype);
    mounted.vm.update?.();
    await flushVue();
    const exposes = mounted.vm.getExposes() as {
      setRole(value: string): void;
      setLevel(value: number): void;
      getLevel(): number;
    };
    const root = mounted.root;
    if (!root) throw new Error('Vue adapter did not materialize a root element');

    try {
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.getAttribute('aria-level')).toBe('2');
      exposes.setLevel(6);
      await flushVue();
      expect(root.getAttribute('aria-level')).toBe('6');
      exposes.setLevel(0);
      await flushVue();
      expect(exposes.getLevel()).toBe(0);
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.hasAttribute('aria-level')).toBe(false);
      exposes.setLevel(4);
      await flushVue();
      expect(exposes.getLevel()).toBe(4);
      expect(root.getAttribute('aria-level')).toBe('4');
      exposes.setRole('button');
      await flushVue();
      expect(root.getAttribute('role')).toBe('button');
      expect(root.hasAttribute('aria-level')).toBe(false);
      exposes.setRole('heading');
      await flushVue();
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.getAttribute('aria-level')).toBe('4');
    } finally {
      mounted.unmount();
    }
  });
});
