import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type FocusableHandle } from '@proto.ui/core';
import { asFocusable, asFocusScope } from '@proto.ui/hooks';

import { asButton } from '../../../prototypes/base/src/button';
import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

describe('adapter-vue2: focus wiring', () => {
  it('makes asButton host focusable and syncs focus/blur to exposes', async () => {
    const proto = definePrototype({
      name: 'vue2-focusable-button',
      setup() {
        asButton();
        return (r) => [r.el('button', 'ok')];
      },
    });

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    expect(mounted.root?.tabIndex).toBe(0);
    const exposes = mounted.vm.getExposes();
    expect(exposes.focused.get()).toBe(false);

    mounted.root?.focus();
    expect(exposes.focused.get()).toBe(true);

    mounted.root?.blur();
    expect(exposes.focused.get()).toBe(false);

    mounted.unmount();
  });

  it('stops retrying focus when the target never accepts focus', async () => {
    let focusable!: FocusableHandle;
    const frames: Array<FrameRequestCallback> = [];
    const proto = definePrototype({
      name: 'vue2-focus-retry-bound',
      setup() {
        focusable = asFocusable();
        focusable.configure({ disabled: false });
        return (r) => [r.el('div', 'ok')];
      },
    });
    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();
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
        await Promise.resolve();
      }
      expect(focus).toHaveBeenCalledTimes(4);
      expect(frames).toHaveLength(0);
    } finally {
      raf.mockRestore();
      focus.mockRestore();
      mounted.unmount();
    }
  });

  it('removes tabIndex from a non-native focus-scope-only host', async () => {
    const proto = definePrototype({
      name: 'vue2-focus-scope-only',
      setup() {
        const scope = asFocusScope();
        scope.configure({ emptyPolicy: 'container' });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();

    expect(mounted.root?.tabIndex).toBe(-1);
    expect(mounted.root?.hasAttribute('tabindex')).toBe(false);

    mounted.unmount();
  });
});
