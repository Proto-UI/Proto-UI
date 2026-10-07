import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createMountedVueAdapterWithOptions, flushVue } from './utils/vue';

// The real Vue Adapter/Focus owns requests and retry counters. Only failed host
// focus attempts and frame delivery are controlled; this is happy-dom evidence.
afterEach(() => vi.restoreAllMocks());
const settle = async (callback: () => unknown) => {
  await callback();
  await flushVue();
};

it.each(['omitted', 'reused'] as const)(
  'renews bounded layout retries for distinct entry intents with %s options',
  async (optionsMode) => {
    // Controlled host rejection and layout delivery; actual Vue Adapter/Focus
    // implementation owns the pending slot and retry count. No ingress gate or
    // expected focus facts are injected. This is simulated-DOM evidence.
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const flushLayout = async () => {
      for (let round = 0; frames.length && round < 20; round++) {
        const pending = frames.splice(0);
        await settle(async () => {
          for (const callback of pending) callback(performance.now());
        });
      }
      expect(frames).toHaveLength(0);
    };
    const sharedOptions =
      optionsMode === 'reused' ? Object.freeze({ preventScroll: true }) : undefined;
    const proto = definePrototype({
      name: 'vue-entry-review-repeated-retry',
      setup(def) {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('enter', () => entry.focus(sharedOptions));
        return (r) => r.el('button', 'Descendant target');
      },
    });
    const mounted = createMountedVueAdapterWithOptions(proto);
    const host = mounted.host;
    const ref = { current: mounted.vm };
    try {
      await flushVue();
      await flushLayout();
      const target = host.querySelector('button')!;
      const nativeFocus = target.focus.bind(target);
      let rejectNext = false;
      let rejectAlways = false;
      const attempts: boolean[] = [];
      vi.spyOn(target, 'focus').mockImplementation((options) => {
        const reject = rejectAlways || rejectNext;
        rejectNext = false;
        attempts.push(!reject);
        if (!reject) nativeFocus(options);
      });
      const observed: Array<{ cycle: number; active: boolean; attempts: boolean[] }> = [];
      // Repeated already-applicable entry stays immediate, without layout retry.
      for (let cycle = 0; cycle < 2; cycle++) {
        await settle(async () => target.blur());
        attempts.length = 0;
        await settle(async () => ref.current.getExposes().enter());
        expect(document.activeElement).toBe(target);
        expect(attempts).toEqual([true]);
        expect(frames).toHaveLength(0);
      }
      for (let cycle = 0; cycle < 4; cycle++) {
        await settle(async () => target.blur());
        attempts.length = 0;
        rejectNext = true;
        await settle(async () => ref.current.getExposes().enter());
        expect(document.activeElement).not.toBe(target);
        await flushLayout();
        observed.push({
          cycle,
          active: document.activeElement === target,
          attempts: [...attempts],
        });
      }
      console.info('[entry-retry-review]', JSON.stringify(observed));
      expect(observed).toEqual(
        [0, 1, 2, 3].map((cycle) => ({ cycle, active: true, attempts: [false, true] }))
      );
      // Resetting after success must not remove the per-request retry bound.
      await settle(async () => target.blur());
      attempts.length = 0;
      rejectAlways = true;
      await settle(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, false, false, false]);
      expect(document.activeElement).not.toBe(target);
      rejectAlways = false;
      // A distinct request must receive its own bounded retry budget without a
      // requester commit, including callers that reuse the same options value.
      rejectNext = true;
      attempts.length = 0;
      await settle(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, true]);
      expect(document.activeElement).toBe(target);
      await settle(async () => target.blur());
      rejectAlways = true;
      attempts.length = 0;
      await settle(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, false, false, false]);
      rejectAlways = false;
      // A real later commit can announce readiness for the retained request.
      await settle(async () => ref.current.update());
      await flushLayout();
      expect(document.activeElement).toBe(target);
      await settle(async () => target.blur());
      rejectNext = true;
      attempts.length = 0;
      await settle(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, true]);
      expect(document.activeElement).toBe(target);
      // Supersession while an old retry is queued cannot donate an extra retry
      // or let the obsolete callback clear the new intent's scheduled state.
      await settle(async () => target.blur());
      rejectAlways = true;
      attempts.length = 0;
      await settle(async () => {
        ref.current.getExposes().enter();
        ref.current.getExposes().enter();
      });
      await flushLayout();
      expect(attempts).toEqual([false, false, false, false, false]);
      expect(document.activeElement).not.toBe(target);
    } finally {
      mounted.unmount();
    }
  }
);

it('releases old scheduled retry state across retained view replacement', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
    frames.push(fn);
    return frames.length;
  });
  const flush = async () => {
    for (let i = 0; frames.length && i < 20; i++) {
      const pending = frames.splice(0);
      await settle(async () => {
        for (const fn of pending) fn(performance.now());
      });
    }
    expect(frames).toHaveLength(0);
  };
  let run: any;
  const proto = definePrototype({
    name: 'vue-disposed-focus-retry',
    setup(def) {
      const target = asFocusable();
      def.lifecycle.onCreated((r) => {
        run = r;
      });
      def.expose.method('focus', () => target.focus());
      def.expose.method('blur', () => target.blur());
      def.expose('view', {
        hide: () => run.lifecycle.setPresent(false),
        show: () => run.lifecycle.setPresent(true),
      });
      return () => 'target';
    },
  });
  const mounted = createMountedVueAdapterWithOptions(proto, { rootTag: 'button' });
  const host = mounted.host;
  const ref = { current: mounted.vm };
  try {
    await flushVue();
    await flush();
    const oldTarget = host.querySelector('button')!;
    vi.spyOn(oldTarget, 'focus').mockImplementation(() => {});
    await settle(async () => ref.current.getExposes().focus());
    expect(frames.length).toBeGreaterThan(0);
    await settle(async () => ref.current.getExposes().view.hide());
    await flush();
    await settle(async () => ref.current.getExposes().view.show());
    await flushVue();
    await flushVue();
    await flush();
    const target = host.querySelector('button')!;
    expect(target).not.toBe(oldTarget);
    await settle(async () => ref.current.getExposes().blur());
    const native = target.focus.bind(target);
    let reject = true;
    let attempts = 0;
    vi.spyOn(target, 'focus').mockImplementation((opts) => {
      attempts++;
      if (reject) {
        reject = false;
        return;
      }
      native(opts);
    });
    await settle(async () => ref.current.getExposes().focus());
    await flush();
    console.info('retained view new request', {
      attempts,
      active: document.activeElement === target,
    });
    expect(attempts).toBe(2);
    expect(document.activeElement).toBe(target);
  } finally {
    mounted.unmount();
    vi.restoreAllMocks();
  }
});

it('does not renew a rejected descendant entry budget because its dual-role root remains focused', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const proto = definePrototype({
    name: 'vue-focused-root-rejected-descendant-budget',
    setup(def) {
      const target = asFocusable();
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'none' });
      def.expose.state('focused', target.focused);
      def.expose.method('focusRoot', () => target.focus());
      def.expose.method('enter', () => entry.focus());
      return (r) => r.el('button', 'Rejecting descendant');
    },
  });
  const mounted = createMountedVueAdapterWithOptions(proto);
  try {
    await flushVue();
    await flushVue();
    const root = mounted.root!;
    const descendant = root.querySelector('button')!;
    await settle(() => mounted.vm.getExposes().focusRoot());
    expect(document.activeElement).toBe(root);
    expect(mounted.vm.getExposes().focused.get()).toBe(true);
    expect(frames).toHaveLength(0);
    const focus = vi.spyOn(descendant, 'focus').mockImplementation(() => {});
    await settle(() => mounted.vm.getExposes().enter());
    // Exercise more than the three allowed two-frame retries, but never drain
    // an unbounded queue: the old root-success inference would keep it alive.
    for (let round = 0; frames.length && round < 10; round++) {
      const pending = frames.splice(0);
      await settle(() => {
        for (const callback of pending) callback(performance.now());
      });
    }
    const observed = {
      attempts: focus.mock.calls.length,
      queuedFrames: frames.length,
      rootActive: document.activeElement === root,
      rootFocused: mounted.vm.getExposes().focused.get(),
    };
    console.info('[vue-descendant-retry-bound]', JSON.stringify(observed));
    expect(observed).toEqual({
      attempts: 4,
      queuedFrames: 0,
      rootActive: true,
      rootFocused: true,
    });
  } finally {
    mounted.unmount();
  }
});
