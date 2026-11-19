import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createContextKey, definePrototype, type Prototype } from '@proto.ui/core';
import { createReactAdapter } from '../src';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanups.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

async function mount(proto: Prototype, props: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const Component = createReactAdapter(React)(proto);
  const ref = React.createRef<React.ComponentRef<typeof Component>>();
  const update = async (props: Record<string, unknown>) => {
    await act(async () => root.render(React.createElement(Component, { ...props, ref })));
  };
  await update(props);
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    await act(async () => root.unmount());
    host.remove();
  };
  cleanups.push(dispose);
  return { handle: ref.current!, update, dispose };
}

describe('real Runtime React public callable result boundary', () => {
  it('preserves returned controls across repeatable view detach and remount', async () => {
    const owner = await mount(
      definePrototype({
        name: 'runtime-returned-control-view-epochs',
        setup(def) {
          def.props.define({ present: { type: 'boolean', default: true } });
          def.props.watch(['present'], (run, next) => run.lifecycle.setPresent(next.present));
          const count = def.state.numberDiscrete('count', 0);
          const controls = {
            next: () => {
              count.set(count.get() + 1);
              return count.get();
            },
          };
          def.expose.method('factory', () => controls);
          return (r) => r.el('output', 'view');
        },
      }),
      { present: true }
    );
    const factory = owner.handle.getExposes().factory as () => { next(): number };
    const controls = factory();
    await owner.update({ present: false });
    expect(document.querySelector('output')).toBeNull();
    expect(controls.next()).toBe(1);
    await owner.update({ present: true });
    expect(document.querySelector('output')?.textContent).toBe('view');
    expect(factory()).toBe(controls);
    expect(controls.next()).toBe(2);
  });
  it('enters the owner callback window for a returned State-writing closure', async () => {
    const owner = await mount(
      definePrototype({
        name: 'runtime-returned-state-writer',
        setup(def) {
          const count = def.state.numberDiscrete('count', 0);
          const increment = () => {
            count.set(count.get() + 1);
            return count.get();
          };
          def.expose.method('factory', () => increment);
          return (r) => r.el('output', 'ready');
        },
      })
    );
    const factory = owner.handle.getExposes().factory as () => () => number;
    expect(factory()()).toBe(1);
  });

  it('invalidates nested returned lexical closures after terminal unmount', async () => {
    let calls = 0;
    const owner = await mount(
      definePrototype({
        name: 'runtime-returned-lexical-control',
        setup(def) {
          def.expose.method('factory', () => ({ make: () => () => ++calls }));
          return (r) => r.el('output', 'ready');
        },
      })
    );
    const factory = owner.handle.getExposes().factory as () => { make(): () => number };
    const increment = factory().make();
    expect(increment()).toBe(1);
    await owner.dispose();
    expect(() => increment()).toThrow(/dispos|terminal/i);
    expect(calls).toBe(1);
  });

  it('preserves one callable record across exposures and method results and refreshes its fields', async () => {
    const owner = await mount(
      definePrototype({
        name: 'runtime-returned-record-alias',
        setup(def) {
          const controls = {
            count: 0,
            next() {
              this.count++;
              return this.count;
            },
          };
          def.expose.value('controls', controls);
          def.expose.value('alias', controls);
          def.expose.method('factory', () => controls);
          return (r) => r.el('output', 'ready');
        },
      })
    );
    const first = owner.handle.getExposes() as {
      controls: { count: number; next(): number };
      alias: { count: number; next(): number };
      factory(): { count: number; next(): number };
    };
    const returned = first.factory();
    expect(returned).toBe(first.controls);
    expect(first.controls).toBe(first.alias);
    expect(returned.next()).toBe(1);
    const next = owner.handle.getExposes() as typeof first;
    expect(next.controls).toBe(returned);
    expect(next.controls.count).toBe(1);
    expect(next.factory()).toBe(returned);
    await owner.dispose();
    expect(() => returned.next()).toThrow(/dispos|terminal/i);
  });

  it('preserves nominal non-callable identities inside exposed and returned records', async () => {
    const key = createContextKey<{ value: number }>('runtime-returned-key');
    let ownerRef: unknown;
    const owner = await mount(
      definePrototype({
        name: 'runtime-returned-nominal-identity',
        setup(def) {
          ownerRef = def.feedback.presence.owner().ref;
          const data = { key, owner: ownerRef };
          def.expose.value('data', data);
          def.expose.value('controls', { data, read: () => data });
          def.expose.method('read', () => data);
          return (r) => r.el('output', 'ready');
        },
      })
    );
    const values = owner.handle.getExposes() as {
      data: { key: unknown; owner: unknown };
      controls: { data: unknown; read(): unknown };
      read(): unknown;
    };
    expect(values.data.key).toBe(key);
    expect(values.data.owner).toBe(ownerRef);
    expect(values.controls.data).toBe(values.data);
    expect(values.controls.read()).toBe(values.data);
    expect(values.read()).toBe(values.data);
  });

  it.each(['raw-first', 'projection-first'] as const)(
    'refreshes mixed raw and projected State controls (%s)',
    async (order) => {
      type Controls = { value: number; obsolete?: string; next?(): number };
      const owner = await mount(
        definePrototype({
          name: `runtime-mixed-expose-alias-${order}`,
          setup(def) {
            const count = def.state.numberDiscrete('count', 0);
            const controls: Controls = { value: 1, obsolete: 'remove' };
            def.expose.value('controls', controls);
            def.expose.method('install', () => {
              controls.value = 2;
              delete controls.obsolete;
              controls.next = () => {
                count.set(count.get() + 1);
                return count.get();
              };
            });
            def.expose.method('pair', (echo: Controls) =>
              order === 'raw-first' ? { current: controls, echo } : { echo, current: controls }
            );
            def.expose.method('readCount', () => count.get());
            return (r) => r.el('output', 'ready');
          },
        })
      );
      const exposed = owner.handle.getExposes() as {
        controls: Controls;
        install(): void;
        pair(echo: Controls): { current: Controls; echo: Controls };
        readCount(): number;
      };
      const projected = exposed.controls;
      exposed.install();
      expect(projected.value).toBe(1);
      expect(projected.next).toBeUndefined();

      const next = exposed.pair(projected);
      expect(next.current).toBe(projected);
      expect(next.echo).toBe(projected);
      expect(projected.value).toBe(2);
      expect(Object.hasOwn(projected, 'obsolete')).toBe(false);
      const heldNext = next.echo.next!;
      expect(heldNext()).toBe(1);
      expect(exposed.readCount()).toBe(1);

      await owner.dispose();
      expect(() => heldNext()).toThrow(/dispos|terminal/i);
    }
  );
});
