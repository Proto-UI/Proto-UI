import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type FocusableHandle } from '@proto.ui/core';
import { asFocusable, asFocusScope } from '@proto.ui/hooks';

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

  it('stops retrying focus when the target never accepts focus', async () => {
    let focusable!: FocusableHandle;
    const frames: Array<FrameRequestCallback> = [];
    const proto = definePrototype({
      name: 'vue-focus-retry-bound',
      setup() {
        focusable = asFocusable();
        focusable.configure({ disabled: false });
        return (r) => [r.el('div', 'ok')];
      },
    });
    const mounted = createMountedVueAdapter(proto);
    await flushVue();
    const focus = vi.spyOn(mounted.root!, 'focus').mockImplementation(() => {});
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      focusable.focus();
      expect(frames).toHaveLength(1);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        frames.shift()?.(0);
        frames.shift()?.(0);
        await flushVue();
      }
      expect(focus).toHaveBeenCalledTimes(4);
      expect(frames).toHaveLength(0);
    } finally {
      raf.mockRestore();
      focus.mockRestore();
      mounted.unmount();
    }
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
      const spy1 = vi.spyOn(first.root!, 'matches').mockReturnValue(true);
      const spy2 = vi.spyOn(second.root!, 'matches').mockReturnValue(true);
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

  it('projects pointer focus as visible when the UA reports :focus-visible on text controls', async () => {
    const proto = definePrototype({
      name: 'vue-pointer-focus-visible-text',
      setup(def) {
        const focusable = asFocusable();
        def.expose.state('focused', focusable.focused);
        def.expose.state('focusVisible', focusable.focusVisible);
        return (r) => [r.el('input')];
      },
    });

    const mounted = createMountedVueAdapter(proto);
    await flushVue();
    const input = mounted.root!;
    const exposes = mounted.vm.getExposes();

    try {
      // Pointer path with a UA that keeps :focus-visible for the text control.
      input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      const matchesSpy2 = vi
        .spyOn(input, 'matches')
        .mockImplementation((selector: string) => selector === ':focus-visible');
      input.dispatchEvent(new FocusEvent('focus'));
      expect(matchesSpy2).toHaveBeenCalledWith(':focus-visible');
      expect(exposes.focusVisible.get()).toBe(true);
      matchesSpy2.mockRestore();

      // Keyboard path stays driven by the modality heuristic alone.
      input.dispatchEvent(new FocusEvent('blur'));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      const matchesSpy3 = vi.spyOn(input, 'matches').mockReturnValue(true);
      input.dispatchEvent(new FocusEvent('focus'));
      await flushVue();
      expect(exposes.focusVisible.get()).toBe(true);

      // Pointer path with a UA that rejects :focus-visible stays invisible.
      input.dispatchEvent(new FocusEvent('blur'));
      input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      vi.spyOn(input, 'matches').mockReturnValue(false);
      input.dispatchEvent(new FocusEvent('focus'));
      await flushVue();
      expect(exposes.focusVisible.get()).toBe(false);
    } finally {
      vi.restoreAllMocks();
      mounted.unmount();
    }
  });
});
