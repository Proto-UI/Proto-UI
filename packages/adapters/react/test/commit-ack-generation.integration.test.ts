import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createReactAdapter } from '../src';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

for (const ownerContext of [false, true])
  for (const strict of [false, true]) {
    it(`commits style-free templates exactly once before ack: context=${ownerContext}, StrictMode=${strict}`, async () => {
      const host = document.createElement('section');
      document.body.append(host);
      const root = createRoot(host);
      let label = 'initial';
      let run: any;
      const events: any[] = [];
      const styles: number[] = [];
      const runtime = {
        ...React,
        ...(!ownerContext ? { createContext: undefined, useContext: undefined } : {}),
        useState(initial: any) {
          const [value, set] = React.useState(initial);
          return [
            value,
            (next: any) => {
              if (next && typeof next === 'object' && 'tokens' in next && 'revision' in next)
                styles.push(next.revision);
              set(next);
            },
          ];
        },
      };
      const proto = definePrototype({
        name: 'ack-style-free',
        setup(def) {
          def.lifecycle.onCreated((value) => {
            run = value;
          });
          def.expose.method('present', (present: boolean) => run.lifecycle.setPresent(present));
          return (r) => r.el('span', label);
        },
      });
      const Component = createReactAdapter(runtime as any)(proto, {
        diagnostics: {
          onLifecycleEvent(event) {
            events.push({ ...event, text: host.textContent, styleCount: styles.length });
          },
        },
      });
      const ref = React.createRef<any>();
      try {
        await act(async () =>
          root.render(
            strict
              ? React.createElement(React.StrictMode, null, React.createElement(Component, { ref }))
              : React.createElement(Component, { ref })
          )
        );
        const initialAcks = events.filter((e) => e.type === 'mount.commit.done');
        expect(initialAcks.length).toBeGreaterThan(0);
        for (const event of initialAcks) expect(event.text).toBe('initial');
        expect(new Set(initialAcks.map((e) => e.epoch)).size).toBe(initialAcks.length);
        const beforeStyles = styles.length;
        label = 'changed-without-style';
        await act(async () => ref.current.update());
        const updateAcks = events.filter((e) => e.type === 'update.commit.done');
        expect(updateAcks.at(-1)?.text).toBe(label);
        expect(new Set(updateAcks.map((e) => `${e.epoch}:${e.revision}`)).size).toBe(
          updateAcks.length
        );
        // Runtime may flush empty style after done; acknowledgment must not need that flush.
        expect(
          updateAcks.at(-1)?.styleCount,
          'template-only acknowledgment must not depend on another style revision'
        ).toBe(beforeStyles);
        if (ownerContext) {
          await act(async () => ref.current.getExposes().present(false));
          expect(host.querySelector('[data-pui-root]')).toBeNull();
          label = 'new-view';
          await act(async () => ref.current.getExposes().present(true));
          const last = events.filter((e) => e.type === 'mount.commit.done').at(-1);
          expect(last.text).toBe(label);
          expect(last.epoch).toBeGreaterThan(initialAcks.at(-1).epoch);
        }
        await act(async () => root.unmount());
        const afterDispose = events.filter((e) => e.type.endsWith('commit.done')).length;
        await act(async () => {
          await Promise.resolve();
        });
        expect(events.filter((e) => e.type.endsWith('commit.done'))).toHaveLength(afterDispose);
        expect(events.filter((e) => e.type === 'instance.dispose.done')).toHaveLength(1);
      } finally {
        if (host.firstChild) await act(async () => root.unmount());
        host.remove();
      }
    });

    it(`keeps first reveal behind a template enqueued synchronously by done: context=${ownerContext}, StrictMode=${strict}`, async () => {
      const host = document.createElement('section');
      document.body.append(host);
      const root = createRoot(host);
      let label = 'first';
      const acks: string[] = [];
      const reveals: string[] = [];
      const remove = Element.prototype.removeAttribute;
      vi.spyOn(Element.prototype, 'removeAttribute').mockImplementation(function (name) {
        if (
          name === 'data-pui-view-pending' &&
          this.parentElement === host &&
          this.hasAttribute(name)
        )
          reveals.push(this.textContent ?? '');
        return remove.call(this, name);
      });
      const proto = definePrototype({
        name: 'ack-done-reentrant',
        setup(def) {
          def.lifecycle.onMounted((run) => {
            label = 'from-mounted';
            run.update();
          });
          return (r) => r.el('span', label);
        },
      });
      const runtime = ownerContext
        ? React
        : { ...React, createContext: undefined, useContext: undefined };
      const Component = createReactAdapter(runtime as any)(proto, {
        schedule: (task) => task(),
        diagnostics: {
          onLifecycleEvent(event) {
            if (event.type.endsWith('commit.done')) acks.push(host.textContent ?? '');
          },
        },
      });
      try {
        await act(async () =>
          root.render(
            strict
              ? React.createElement(React.StrictMode, null, React.createElement(Component))
              : React.createElement(Component)
          )
        );
        expect(acks[0]).toBe('first');
        expect(acks.at(-1)).toBe('from-mounted');
        expect(reveals).toEqual(['from-mounted']);
        expect(host.querySelector('[data-pui-root]')?.hasAttribute('data-pui-view-pending')).toBe(
          false
        );
      } finally {
        await act(async () => root.unmount());
        host.remove();
      }
    });
  }

it('does not acknowledge the abandoned StrictMode view with its replacement template', async () => {
  const host = document.createElement('section');
  document.body.append(host);
  const root = createRoot(host);
  let renders = 0;
  const starts = new Map<number, string>();
  const acks: Array<{ epoch: number; text: string }> = [];
  const proto = definePrototype({
    name: 'ack-strict-abandoned',
    setup() {
      return (r) => r.el('span', `template-${++renders}`);
    },
  });
  const Component = createReactAdapter({
    ...React,
    createContext: undefined,
    useContext: undefined,
  } as any)(proto, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'mount.commit.start') starts.set(event.epoch, `template-${renders}`);
        if (event.type === 'mount.commit.done')
          acks.push({ epoch: event.epoch, text: host.textContent ?? '' });
      },
    },
  });
  try {
    await act(async () =>
      root.render(React.createElement(React.StrictMode, null, React.createElement(Component)))
    );
    expect(starts.size).toBe(2);
    expect(acks).toEqual([{ epoch: 2, text: starts.get(2) }]);
    expect(acks[0].text).not.toBe(starts.get(1));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it('retires an uncommitted update on terminal disposal without a late or double ack', async () => {
  const host = document.createElement('section');
  document.body.append(host);
  const root = createRoot(host);
  const events: any[] = [];
  let label = 'initial';
  const ref = React.createRef<any>();
  const proto = definePrototype({
    name: 'ack-dispose-pending',
    setup() {
      return (r) => r.el('span', label);
    },
  });
  const Component = createReactAdapter(React)(proto, {
    diagnostics: { onLifecycleEvent: (event) => events.push(event) },
  });
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    const before = events.filter((e) => e.type === 'update.commit.done').length;
    await act(async () => {
      label = 'must-not-commit';
      ref.current.update();
      root.unmount();
    });
    expect(events.filter((e) => e.type === 'update.render').length).toBeGreaterThan(before);
    expect(events.filter((e) => e.type === 'update.commit.done')).toHaveLength(before);
    await Promise.resolve();
    expect(events.filter((e) => e.type === 'instance.dispose.done')).toHaveLength(1);
    expect(host.childNodes).toHaveLength(0);
  } finally {
    host.remove();
  }
});

it('does not reveal a view retired by a synchronous done callback', async () => {
  const host = document.createElement('section');
  document.body.append(host);
  const root = createRoot(host);
  const ref = React.createRef<any>();
  let retireFirst = true;
  let label = 'retired';
  let run: any;
  const reveals: string[] = [];
  const remove = Element.prototype.removeAttribute;
  vi.spyOn(Element.prototype, 'removeAttribute').mockImplementation(function (name) {
    if (name === 'data-pui-view-pending' && this.parentElement === host && this.hasAttribute(name))
      reveals.push(this.textContent ?? '');
    return remove.call(this, name);
  });
  const proto = definePrototype({
    name: 'ack-done-retire',
    setup(def) {
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose.method('present', (present: boolean) => run.lifecycle.setPresent(present));
      def.lifecycle.onMounted((run) => {
        if (retireFirst) {
          retireFirst = false;
          run.lifecycle.setPresent(false);
        }
      });
      return (r) => r.el('span', label);
    },
  });
  const Component = createReactAdapter(React)(proto, { schedule: (task) => task() });
  try {
    await act(async () => root.render(React.createElement(Component, { ref })));
    expect(host.querySelector('[data-pui-root]')).toBeNull();
    expect(reveals).toEqual([]);
    label = 'replacement';
    await act(async () => ref.current.getExposes().present(true));
    expect(reveals).toEqual(['replacement']);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
