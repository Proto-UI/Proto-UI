import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusScope } from '@proto.ui/hooks';

import { asButton } from '../../../prototypes/base/src/button';
import { createMountedVueAdapter, flushVue } from './utils/vue';

describe('adapter-vue: focus wiring', () => {
  it('makes asButton host focusable and syncs focus/blur to exposes', async () => {
    const proto = definePrototype({
      name: 'vue-focusable-button',
      setup() {
        asButton();
        return (r) => [r.el('button', 'ok')];
      },
    });

    const mounted = createMountedVueAdapter(proto);
    await flushVue();

    expect(mounted.root?.tabIndex).toBe(0);

    const exposes = mounted.vm.getExposes();
    expect(exposes.focused.get()).toBe(false);

    mounted.root?.focus();
    expect(exposes.focused.get()).toBe(true);

    mounted.root?.blur();
    expect(exposes.focused.get()).toBe(false);

    mounted.unmount();
  });

  it('does not make focus-scope-only host focusable', async () => {
    const proto = definePrototype({
      name: 'vue-focus-scope-only',
      setup() {
        const scope = asFocusScope();
        scope.configure({ emptyPolicy: 'container' });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedVueAdapter(proto);
    await flushVue();

    expect(mounted.root?.tabIndex).toBe(-1);
    expect(mounted.root?.hasAttribute('tabindex')).toBe(false);

    mounted.unmount();
  });

  it('clears previous focus facts when another focusable receives host focus', async () => {
    const createProto = (name: string) =>
      definePrototype({
        name,
        setup() {
          asButton();
          return (r) => [r.el('button', name)];
        },
      });

    const first = createMountedVueAdapter(createProto('vue-focus-unique-first'));
    const second = createMountedVueAdapter(createProto('vue-focus-unique-second'));
    await flushVue();

    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      first.root?.dispatchEvent(new FocusEvent('focus'));
      expect(first.vm.getExposes().focused.get()).toBe(true);
      expect(first.vm.getExposes().focusVisible.get()).toBe(true);

      second.root?.dispatchEvent(new FocusEvent('focus'));
      expect(second.vm.getExposes().focused.get()).toBe(true);
      expect(second.vm.getExposes().focusVisible.get()).toBe(true);
      expect(first.vm.getExposes().focused.get()).toBe(false);
      expect(first.vm.getExposes().focusVisible.get()).toBe(false);
    } finally {
      second.unmount();
      first.unmount();
    }
  });
});
