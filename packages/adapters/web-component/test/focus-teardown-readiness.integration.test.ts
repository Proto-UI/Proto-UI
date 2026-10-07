import { expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusable, asFocusEntry, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { asButton } from '../../../prototypes/base/src/button';
import { AdaptToWebComponent } from '../src';
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

it('does not focus the departing nested Trigger owner through an otherwise-ready requester', async () => {
  let run: any;
  let request = false;
  let outer: any;
  let inner: any;
  const during: Array<{ connected: boolean; active: boolean; focused: boolean }> = [];
  const outerProto = definePrototype({
    name: 'wc-teardown-requester',
    setup() {
      asButton();
      return (r) => r.slot();
    },
  });
  const innerProto = definePrototype({
    name: 'wc-teardown-target-owner',
    setup(def) {
      asButton();
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose('view', {
        hide: () => run.lifecycle.setPresent(false),
        show: () => run.lifecycle.setPresent(true),
      });
      def.lifecycle.onUnmounted(() => {
        if (!request) return;
        request = false;
        outer.getExposes().focusSelf();
        during.push({
          connected: inner.isConnected,
          active: document.activeElement === inner,
          focused: inner.getExposes().focused.get(),
        });
      });
      return () => 'Departing Trigger';
    },
  });
  AdaptToWebComponent(outerProto);
  AdaptToWebComponent(innerProto);
  outer = document.createElement(outerProto.name);
  inner = document.createElement(innerProto.name);
  outer.append(inner);
  document.body.append(outer);
  try {
    await flush();
    request = true;
    inner.getExposes().view.hide();
    await flush();
    expect(during).toEqual([{ connected: true, active: false, focused: false }]);
    // WC retains the physical custom element and its Trigger identity while
    // releasing its view. That same current surface must become ready again.
    expect(document.activeElement).not.toBe(inner);
    inner.getExposes().view.show();
    await flush();
    expect(document.activeElement).toBe(inner);
    expect(inner.getExposes().focused.get()).toBe(true);
  } finally {
    outer.remove();
    await flush();
  }
});

it.each(['apply', 'disable', 'blur', 'empty'] as const)(
  're-resolves an ordinary descendant owner and respects entry %s',
  async (completion) => {
    let run: any;
    let request = false;
    let outer: any;
    let inner: any;
    let fallback: any;
    const during: Array<{ active: boolean; focused: boolean }> = [];
    const outerProto = definePrototype({
      name: `wc-entry-requester-${completion}`,
      setup(def) {
        const entry = asFocusEntry();
        const target = asFocusable();
        entry.configure({ strategy: 'descendant-first', fallback: 'none' });
        def.expose.method('enter', () => entry.focus());
        def.expose.method('disable', () => entry.setDisabled(true));
        def.expose.method('blur', () => target.blur());
        return (r) => r.slot();
      },
    });
    const innerProto = definePrototype({
      name: `wc-entry-owner-${completion}`,
      setup(def) {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose('view', {
          hide: () => run.lifecycle.setPresent(false),
          show: () => run.lifecycle.setPresent(true),
        });
        def.lifecycle.onUnmounted(() => {
          if (!request) return;
          request = false;
          outer.getExposes().enter();
          during.push({ active: document.activeElement === inner, focused: target.focused.get() });
          if (completion === 'disable' || completion === 'blur') outer.getExposes()[completion]();
        });
        return () => 'Retained ordinary owner';
      },
    });
    const fallbackProto = definePrototype({
      name: `wc-entry-fallback-${completion}`,
      setup(def) {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        return () => 'Ready fallback';
      },
    });
    AdaptToWebComponent(outerProto);
    AdaptToWebComponent(innerProto);
    AdaptToWebComponent(fallbackProto);
    outer = document.createElement(outerProto.name);
    inner = document.createElement(innerProto.name);
    fallback = document.createElement(fallbackProto.name);
    outer.append(inner);
    if (completion !== 'empty') outer.append(fallback);
    document.body.append(outer);
    try {
      await flush();
      request = true;
      inner.getExposes().view.hide();
      await flush();
      expect(during).toEqual([{ active: false, focused: false }]);
      inner.getExposes().view.show();
      await flush();
      // A later empty policy result ends entry intent. Reopening that view does
      // not resurrect it; a ready sibling instead consumes the invalidation.
      const expected = completion === 'empty' ? inner : fallback;
      expect(document.activeElement === expected).toBe(completion === 'apply');
      expect(expected.getExposes().focused.get()).toBe(completion === 'apply');
    } finally {
      outer.remove();
      await flush();
    }
  }
);

it.each(['programmatic', 'native', 'entry'] as const)(
  'keeps the physical text-control root eligible for %s while rejecting closed-owner observation',
  async (kind) => {
    let run: any;
    let request = false;
    let control: HTMLElement;
    const during: Array<{ connected: boolean; active: boolean; focused: boolean }> = [];
    const proto = definePrototype({
      name: `wc-text-root-teardown-${kind}`,
      modules: [
        declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' }),
      ],
      setup(def) {
        asTextControl();
        const target = asFocusable();
        const entry = asFocusEntry();
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.expose.state('focused', target.focused);
        def.lifecycle.onCreated((value) => {
          run = value;
        });
        def.expose('view', {
          hide: () => run.lifecycle.setPresent(false),
          show: () => run.lifecycle.setPresent(true),
        });
        def.lifecycle.onUnmounted(() => {
          if (!request) return;
          request = false;
          if (kind === 'programmatic') target.focus();
          else if (kind === 'native') target.focusSelf();
          else entry.focus();
          during.push({
            connected: control.isConnected,
            active: document.activeElement === control,
            focused: target.focused.get(),
          });
        });
        return () => null;
      },
    });
    AdaptToWebComponent(proto);
    const host = document.createElement(proto.name) as any;
    document.body.append(host);
    try {
      await flush();
      control = host.querySelector('textarea');
      expect(control).toBeTruthy();
      request = true;
      host.getExposes().view.hide();
      await flush();
      expect(during).toEqual([
        { connected: true, active: kind === 'programmatic', focused: kind === 'programmatic' },
      ]);
      host.getExposes().view.show();
      await flush();
      expect(document.activeElement).toBe(host.querySelector('textarea'));
      expect(host.getExposes().focused.get()).toBe(true);
    } finally {
      host.remove();
      await flush();
    }
  }
);

it('releases owned children and restores the next view when source replay throws', async () => {
  let run: any;
  const outerProto = definePrototype({
    name: 'wc-exception-release-outer',
    setup(def) {
      asButton();
      const target = asFocusable();
      def.expose.method('request', () => target.focus());
      return (r) => r.slot();
    },
  });
  const innerProto = definePrototype({
    name: 'wc-exception-release-inner',
    setup(def) {
      asButton();
      def.lifecycle.onCreated((r) => (run = r));
      def.expose('view', {
        hide: () => run.lifecycle.setPresent(false),
        show: () => run.lifecycle.setPresent(true),
      });
      return (r) => r.el('span', 'Owned child');
    },
  });
  AdaptToWebComponent(outerProto);
  AdaptToWebComponent(innerProto);
  const outer: any = document.createElement(outerProto.name),
    inner: any = document.createElement(innerProto.name);
  outer.append(inner);
  document.body.append(outer);
  await flush();
  const oldChild = inner.querySelector('span');
  const failure = new Error('host focus failure');
  const errors: unknown[] = [];
  const enqueue = globalThis.queueMicrotask.bind(globalThis);
  const queue = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) =>
    enqueue(() => {
      try {
        task();
      } catch (error) {
        errors.push(error);
      }
    })
  );
  let throwing = false;
  const focus = vi.spyOn(inner, 'focus').mockImplementation(() => {
    if (throwing) throw failure;
  });
  try {
    outer.getExposes().request();
    throwing = true;
    inner.getExposes().view.hide();
    await flush();
    expect(errors).toEqual([failure]);
    expect(inner.contains(oldChild)).toBe(false);
    expect(oldChild.isConnected).toBe(false);
    focus.mockRestore();
    inner.getExposes().view.show();
    await flush();
    outer.getExposes().request();
    expect(inner.querySelector('span')).not.toBe(oldChild);
    expect(document.activeElement).toBe(inner);
  } finally {
    focus.mockRestore();
    outer.remove();
    await flush();
    queue.mockRestore();
  }
});

it('publishes mounted diagnostics before a ready-triggered reentrant update', async () => {
  let run: any,
    updated = false;
  const trace: string[] = [];
  const proto = definePrototype({
    name: 'web-component-mounted-diagnostics',
    setup(def) {
      const target = asFocusable();
      def.lifecycle.onCreated((r) => {
        run = r;
        target.focusSelf();
      });
      target.focused.watch((_ctx, e) => {
        if (e.type === 'next' && e.next && !updated) {
          updated = true;
          run.update();
        }
      });
      return () => 'Ready';
    },
  });
  const options = {
    schedule: (task: () => void) => task(),
    diagnostics: {
      onLifecycleEvent: (event: any) =>
        trace.push(event.type + (event.phase ? ':' + event.phase : '')),
    },
  };
  AdaptToWebComponent(proto, options);
  const root = document.createElement(proto.name);
  document.body.append(root);
  await flush();
  const cleanup = () => root.remove();
  try {
    expect(updated).toBe(true);
    expect(trace.indexOf('mount.phase:mounted')).toBeLessThan(trace.indexOf('update.render'));
  } finally {
    cleanup();
  }
});

import * as readiness from '../src/platform/instance-tree';

function sourceLeaseFixture() {
  const proto = definePrototype({ name: 'focus-source-lease', setup() {} });
  const token = readiness.createLogicalInstance(proto),
    root = document.createElement('div');
  readiness.markProtoInstance(root, proto, token);
  const source = () => ({ isReady: () => true, subscribe: (_listener: () => void) => () => {} });
  return { token, root, source, cleanup: () => readiness.unbindProtoInstance(token, root) };
}
it('retains a releasable deferred source when publication observers throw', () => {
  const f = sourceLeaseFixture(),
    failure = new Error('source observer failure');
  const second = vi.fn();
  const offFirst = readiness.subscribeFocusSurfaceReady(
    f.token,
    () => {
      throw failure;
    },
    true
  );
  const offSecond = readiness.subscribeFocusSurfaceReady(f.token, second, true);
  const release = readiness.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  try {
    expect(second).not.toHaveBeenCalled();
    expect(() => release.publish()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(1);
    expect(() => release()).toThrow(failure);
    expect(second).toHaveBeenCalledTimes(2);
    expect(readiness.isFocusTargetOwnerReady(f.root)).toBe(false);
  } finally {
    offFirst();
    offSecond();
    release();
    f.cleanup();
  }
});
it('ignores stale publication and release after a source is replaced or disposed', () => {
  const f = sourceLeaseFixture(),
    notify = vi.fn();
  const off = readiness.subscribeFocusSurfaceReady(f.token, notify, true);
  const old = readiness.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  const current = readiness.registerNativeFocusReadiness(f.token, f.source(), {
    deferPublication: true,
  });
  try {
    old.publish();
    old();
    expect(notify).not.toHaveBeenCalled();
    expect(readiness.isFocusTargetOwnerReady(f.root)).toBe(true);
    current.publish();
    expect(notify).toHaveBeenCalledTimes(1);
    current();
    expect(notify).toHaveBeenCalledTimes(2);
    current.publish();
    expect(notify).toHaveBeenCalledTimes(2);
  } finally {
    off();
    current();
    old();
    f.cleanup();
  }
});

it('does not strand a remount when source registration replays a throwing pending requester', async () => {
  let run: any;
  const outerProto = definePrototype({
    name: 'review-wc-register-outer',
    setup(def) {
      asButton();
      const target = asFocusable();
      def.expose.method('request', () => target.focus());
      return (r) => r.slot();
    },
  });
  const innerProto = definePrototype({
    name: 'review-wc-register-inner',
    setup(def) {
      asButton();
      def.lifecycle.onCreated((r) => (run = r));
      def.expose.method('hide', () => run.lifecycle.setPresent(false));
      def.expose.method('show', () => run.lifecycle.setPresent(true));
      return (r) => r.el('span', 'Owned view child');
    },
  });
  AdaptToWebComponent(outerProto);
  AdaptToWebComponent(innerProto);
  const outer = document.createElement(outerProto.name) as any,
    inner = document.createElement(innerProto.name) as any;
  outer.append(inner);
  document.body.append(outer);
  await flush();
  const errors: string[] = [];
  const qm = globalThis.queueMicrotask.bind(globalThis);
  const qs = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((cb) =>
    qm(() => {
      try {
        cb();
      } catch (e) {
        errors.push((e as Error).message);
      }
    })
  );
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  let throwing = false;
  const spy = vi.spyOn(inner, 'focus').mockImplementation(() => {
    if (throwing) throw new Error('register host failure');
  });
  try {
    inner.getExposes().hide();
    await flush();
    expect(inner.textContent).toBe('');
    outer.getExposes().request();
    throwing = true;
    inner.getExposes().show();
    await flush();

    expect(inner.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(inner.textContent).toBe('Owned view child');
    expect(errors).toEqual(['register host failure']);
    // The throwing publication retained its release lease: another full cycle
    // cleans the old source and can construct an eligible fresh view.
    inner.getExposes().hide();
    await flush();
    expect(inner.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(inner.textContent).toBe('');
    spy.mockRestore();
    inner.getExposes().show();
    await flush();
    expect(inner.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(inner.textContent).toBe('Owned view child');
    outer.getExposes().request();
    expect(document.activeElement).toBe(inner);
  } finally {
    spy.mockRestore();
    raf.mockRestore();
    outer.remove();
    await flush();
    qs.mockRestore();
  }
});
