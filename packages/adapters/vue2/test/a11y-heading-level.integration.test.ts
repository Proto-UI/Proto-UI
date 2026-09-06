import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

const headingPrototype = definePrototype({
  name: 'vue2-a11y-heading-level',
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
    return (run) => run.el('div', 'Heading');
  },
});

describe('adapter-vue2: portable heading level', () => {
  it('projects valid levels, omits invalid State values, recovers, and clears non-heading levels', async () => {
    const mounted = createMountedVue2Adapter(headingPrototype);
    await flushVue2();
    const exposes = mounted.vm.getExposes() as {
      setRole(value: string): void;
      setLevel(value: number): void;
      getLevel(): number;
    };
    const root = mounted.root;
    if (!root) throw new Error('Vue 2 adapter did not materialize a root element');

    try {
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.getAttribute('aria-level')).toBe('2');

      exposes.setLevel(6);
      await flushVue2();
      expect(root.getAttribute('aria-level')).toBe('6');

      exposes.setLevel(0);
      await flushVue2();
      expect(exposes.getLevel()).toBe(0);
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.hasAttribute('aria-level')).toBe(false);

      exposes.setLevel(4);
      await flushVue2();
      expect(exposes.getLevel()).toBe(4);
      expect(root.getAttribute('aria-level')).toBe('4');

      exposes.setRole('button');
      await flushVue2();
      expect(root.getAttribute('role')).toBe('button');
      expect(root.hasAttribute('aria-level')).toBe(false);

      exposes.setRole('heading');
      await flushVue2();
      expect(root.getAttribute('role')).toBe('heading');
      expect(root.getAttribute('aria-level')).toBe('4');
    } finally {
      mounted.unmount();
    }
  });
});
