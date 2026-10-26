import { expect, it, vi } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { PUI_VIEW_PENDING_ATTR, PUI_VIEW_REVEALING_ATTR } from '@proto.ui/adapter-base';
import { createMountedVueAdapterWithOptions, flushVue } from './utils/vue';

// Actual Vue commits and CSS ownership; only layout frame delivery is controlled.
it.each([false, true])('preserves first reveal with a mounted recommit: %s', async (recommit) => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const style = document.createElement('style');
  style.textContent = '[data-pui-root] { transition: background-color 150ms linear; }';
  document.head.append(style);
  const samples: Array<{ revealing: boolean; transition: string }> = [];
  const removeAttribute = Element.prototype.removeAttribute;
  vi.spyOn(Element.prototype, 'removeAttribute').mockImplementation(function (this: Element, name) {
    const revealing =
      name === PUI_VIEW_PENDING_ATTR &&
      this.hasAttribute('data-pui-root') &&
      this.hasAttribute(PUI_VIEW_PENDING_ATTR);
    const result = removeAttribute.call(this, name);
    if (revealing)
      samples.push({
        revealing: this.hasAttribute(PUI_VIEW_REVEALING_ATTR),
        transition: getComputedStyle(this).transition,
      });
    return result;
  });
  let mountedCalls = 0;
  const proto = definePrototype({
    name: `vue-first-reveal-${recommit}`,
    setup(def) {
      def.feedback.style.use(tw('transition-all bg-primary'));
      def.lifecycle.onMounted((run) => {
        mountedCalls++;
        if (recommit) run.update();
      });
      return (r) => r.el('span', 'ready');
    },
  });
  const mounted = createMountedVueAdapterWithOptions(proto, {
    schedule: (task: () => void) => task(),
  });
  const frame = async () => {
    const pending = frames.splice(0);
    expect(pending.length).toBeGreaterThan(0);
    for (const callback of pending) callback(performance.now());
    await flushVue();
  };
  try {
    await flushVue();
    await flushVue();
    expect(mountedCalls).toBe(1);
    expect(samples).toEqual([{ revealing: true, transition: 'none' }]);
    const root = mounted.host.querySelector('[data-pui-root]')!;
    expect(root.hasAttribute(PUI_VIEW_PENDING_ATTR)).toBe(false);
    expect(root.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(true);
    await frame();
    expect(root.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(true);
    await frame();
    expect(root.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(false);
    expect(getComputedStyle(root).transition).toBe('background-color 150ms linear');
    mounted.vm.update();
    await flushVue();
    await flushVue();
    expect(root.hasAttribute(PUI_VIEW_REVEALING_ATTR)).toBe(false);
    expect(getComputedStyle(root).transition).toBe('background-color 150ms linear');
  } finally {
    mounted.unmount();
    style.remove();
    vi.restoreAllMocks();
  }
});
