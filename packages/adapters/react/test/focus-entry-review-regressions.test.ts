import { afterEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable } from '@proto.ui/hooks';
import { createReactAdapter } from '../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

it.each(['apply', 'entry-disable', 'explicit-blur'] as const)(
  'holds descendant entry until the actual nested target owner can observe focus: %s',
  async (completion) => {
    const outerProto = definePrototype({
      name: 'entry-review-outer',
      setup(def) {
        const entry = asFocusEntry();
        const target = asFocusable();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('enter', () => entry.focus({ reason: 'keyboard' }));
        def.expose.method('cancelEntry', () => entry.setDisabled(true));
        def.expose.method('blur', () => target.blur());
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: 'entry-review-inner',
      setup(def) {
        const focusable = asFocusable();
        def.expose.state('focused', focusable.focused);
        def.expose.event('beforeReady');
        def.lifecycle.onUpdated((run) => run.expose.emit('beforeReady'));
        return () => 'Nested target';
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const outerRef = React.createRef<any>();
    const innerRef = React.createRef<any>();
    const adapt = createReactAdapter(React);
    const Outer = adapt(outerProto);
    const Inner = adapt(innerProto, { rootTag: 'button' });
    let request = false;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    try {
      await act(async () =>
        root.render(
          React.createElement(
            Outer,
            { ref: outerRef },
            React.createElement(Inner, {
              ref: innerRef,
              onBeforeReady: () => {
                if (!request) return;
                request = false;
                outerRef.current.getExposes().enter();
                during.push({
                  active: document.activeElement === host.querySelector('button'),
                  focused: innerRef.current.getExposes().focused.get(),
                });
                if (completion === 'entry-disable') outerRef.current.getExposes().cancelEntry();
                if (completion === 'explicit-blur') outerRef.current.getExposes().blur();
              },
            })
          )
        )
      );
      const target = host.querySelector('button')!;
      await act(async () => outerRef.current.getExposes().enter());
      expect(document.activeElement).toBe(target);
      expect(innerRef.current.getExposes().focused.get()).toBe(true);
      await act(async () => target.blur());
      expect(innerRef.current.getExposes().focused.get()).toBe(false);
      request = true;
      await act(async () => innerRef.current.update());
      const observed = {
        during,
        after: {
          active: document.activeElement === target,
          focused: innerRef.current.getExposes().focused.get(),
        },
      };
      console.info('[entry-owner-review]', JSON.stringify(observed));
      expect(observed).toEqual({
        during: [{ active: false, focused: false }],
        after: { active: completion === 'apply', focused: completion === 'apply' },
      });
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  }
);

it.each(['omitted', 'reused'] as const)(
  'renews bounded layout retries for distinct entry intents with %s options',
  async (optionsMode) => {
    // Controlled host rejection and layout delivery; actual React Adapter/Focus
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
        await act(async () => {
          for (const callback of pending) callback(performance.now());
        });
      }
      expect(frames).toHaveLength(0);
    };
    const sharedOptions =
      optionsMode === 'reused' ? Object.freeze({ preventScroll: true }) : undefined;
    const proto = definePrototype({
      name: 'entry-review-repeated-retry',
      setup(def) {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('enter', () => entry.focus(sharedOptions));
        return (r) => r.el('button', 'Descendant target');
      },
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const ref = React.createRef<any>();
    const Component = createReactAdapter(React)(proto);
    try {
      await act(async () => root.render(React.createElement(Component, { ref })));
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
        await act(async () => target.blur());
        attempts.length = 0;
        await act(async () => ref.current.getExposes().enter());
        expect(document.activeElement).toBe(target);
        expect(attempts).toEqual([true]);
        expect(frames).toHaveLength(0);
      }
      for (let cycle = 0; cycle < 4; cycle++) {
        await act(async () => target.blur());
        attempts.length = 0;
        rejectNext = true;
        await act(async () => ref.current.getExposes().enter());
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
      await act(async () => target.blur());
      attempts.length = 0;
      rejectAlways = true;
      await act(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, false, false, false]);
      expect(document.activeElement).not.toBe(target);
      rejectAlways = false;
      // A distinct request must receive its own bounded retry budget without a
      // requester commit, including callers that reuse the same options value.
      rejectNext = true;
      attempts.length = 0;
      await act(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, true]);
      expect(document.activeElement).toBe(target);
      await act(async () => target.blur());
      rejectAlways = true;
      attempts.length = 0;
      await act(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, false, false, false]);
      rejectAlways = false;
      // A real later commit can announce readiness for the retained request.
      await act(async () => ref.current.update());
      await flushLayout();
      expect(document.activeElement).toBe(target);
      await act(async () => target.blur());
      rejectNext = true;
      attempts.length = 0;
      await act(async () => ref.current.getExposes().enter());
      await flushLayout();
      expect(attempts).toEqual([false, true]);
      expect(document.activeElement).toBe(target);
      // Supersession while an old retry is queued cannot donate an extra retry
      // or let the obsolete callback clear the new intent's scheduled state.
      await act(async () => target.blur());
      rejectAlways = true;
      attempts.length = 0;
      await act(async () => {
        ref.current.getExposes().enter();
        ref.current.getExposes().enter();
      });
      await flushLayout();
      expect(attempts).toEqual([false, false, false, false, false]);
      expect(document.activeElement).not.toBe(target);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  }
);

it.each(['programmatic', 'native', 'entry'] as const)(
  'keeps %s request and fact ownership through the real onUpdated gate',
  async (kind) => {
    let request = false;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const ref = React.createRef<any>();
    const proto = definePrototype({
      name: `entry-review-kind-${kind}`,
      setup(def) {
        const target = asFocusable();
        const entry = asFocusEntry();
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.expose.state('focused', target.focused);
        def.lifecycle.onUpdated(() => {
          if (!request) return;
          request = false;
          if (kind === 'programmatic') target.focus();
          else if (kind === 'native') target.focusSelf();
          else entry.focus();
          during.push({
            active: document.activeElement === host.querySelector('button'),
            focused: target.focused.get(),
          });
        });
        return () => 'Explicit request kind';
      },
    });
    const Component = createReactAdapter(React)(proto, { rootTag: 'button' });
    try {
      await act(async () => root.render(React.createElement(Component, { ref })));
      request = true;
      await act(async () => ref.current.update());
      const result = {
        during,
        after: {
          active: document.activeElement === host.querySelector('button'),
          focused: ref.current.getExposes().focused.get(),
        },
      };
      console.info('[focus-kind-review]', JSON.stringify({ kind, ...result }));
      expect(result).toEqual({
        during: [{ active: kind === 'programmatic', focused: kind === 'programmatic' }],
        after: { active: true, focused: true },
      });
    } finally {
      await act(async () => root.unmount());
      host.remove();
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
      await act(async () => {
        for (const fn of pending) fn(performance.now());
      });
    }
    expect(frames).toHaveLength(0);
  };
  let run: any;
  const proto = definePrototype({
    name: 'review-disposed-focus-retry',
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
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host),
    ref = React.createRef<any>(),
    Component = createReactAdapter(React)(proto, { rootTag: 'button' });
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    await flush();
    const oldTarget = host.querySelector('button')!;
    vi.spyOn(oldTarget, 'focus').mockImplementation(() => {});
    await act(async () => ref.current.getExposes().focus());
    expect(frames.length).toBeGreaterThan(0);
    await act(async () => ref.current.getExposes().view.hide());
    await flush();
    await act(async () => ref.current.getExposes().view.show());
    await flush();
    const target = host.querySelector('button')!;
    expect(target).not.toBe(oldTarget);
    await act(async () => ref.current.getExposes().blur());
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
    await act(async () => ref.current.getExposes().focus());
    await flush();
    console.info('retained view new request', {
      attempts,
      active: document.activeElement === target,
    });
    expect(attempts).toBe(2);
    expect(document.activeElement).toBe(target);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  }
});
