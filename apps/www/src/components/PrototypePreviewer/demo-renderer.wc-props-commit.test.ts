import { definePrototype, type RunHandle } from '@proto.ui/core';
import { getElementProps } from '@proto.ui/adapter-web-component';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import type { DemoRuntimeApi, DemoSetupContext } from './demo-types';

// These tests use the real WC Adapter and runtime. Lifecycle observations count
// completed commits, not calls to a mocked convenience setter or update method.
type Props = { value: string; retained?: string };
const views: Array<{ destroy(): void | Promise<void> }> = [];
let nextId = 0;

afterEach(async () => {
  for (const view of views.splice(0).reverse()) await view.destroy();
  document.body.replaceChildren();
});

async function mount(
  options: {
    onUpdated?(run: RunHandle<Props>, api: DemoRuntimeApi): void;
    onProps?(run: RunHandle<Props>, api: DemoRuntimeApi): void;
  } = {}
) {
  const host = document.createElement('div');
  document.body.append(host);
  let context!: DemoSetupContext;
  const rendered = vi.fn();
  const updated = vi.fn();
  const watched = vi.fn();
  const disposed = vi.fn();
  const probe = definePrototype<Props>({
    name: `test-demo-wc-props-single-commit-${++nextId}`,
    setup(def) {
      def.props.define({ value: { type: 'string' }, retained: { type: 'string' } });
      def.props.watch(['value'], (run) => {
        watched();
        if (context) options.onProps?.(run, context.api);
      });
      def.lifecycle.onUpdated((run) => {
        updated();
        options.onUpdated?.(run, context.api);
      });
      def.lifecycle.onBeforeDispose(disposed);
      return (renderer) => {
        rendered();
        const props = renderer.read.props.get();
        return renderer.el('span', `${props.value}|${props.retained ?? 'absent'}`);
      };
    },
  });
  registerPrototype(probe.name, probe);
  const view = await renderDemo({
    host,
    runtime: 'wc',
    demo: {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: probe.name,
        ref: 'probe',
        props: { value: 'initial', retained: 'kept' },
      },
      setup(next) {
        context = next;
      },
    },
  });
  views.push(view);
  const element = context.refs.probe;
  expect(element.textContent).toBe('initial|kept');
  rendered.mockClear();
  updated.mockClear();
  watched.mockClear();
  return { host, view, element, api: context.api, rendered, updated, watched, disposed };
}

describe('WC Demo props commits', () => {
  it('delivers one patch and one commit while preserving unpatched props', async () => {
    const h = await mount();
    h.api.setProps('probe', { value: 'next' });
    expect(h.element.textContent).toBe('next|kept');
    expect(h.rendered).toHaveBeenCalledTimes(1);
    expect(h.updated).toHaveBeenCalledTimes(1);
    expect(h.watched).toHaveBeenCalledTimes(1);

    // A repeated explicit update is still an intent; this is not a value cache.
    h.api.setProps('probe', { value: 'next' });
    expect(h.rendered).toHaveBeenCalledTimes(2);
    expect(h.updated).toHaveBeenCalledTimes(2);
  });

  it('commits surface changes once and retains them across later props patches', async () => {
    const h = await mount();
    h.api.setSurfaceStyle!('probe', { color: 'red' });
    expect(h.element.style.color).toBe('red');
    expect(h.element.textContent).toBe('initial|kept');
    expect(h.updated).toHaveBeenCalledTimes(1);
    h.api.setProps('probe', { value: 'styled' });
    expect(h.element.style.color).toBe('red');
    expect(h.element.textContent).toBe('styled|kept');
    expect(h.updated).toHaveBeenCalledTimes(2);
  });

  it('withdraws a prop without a duplicate completed update', async () => {
    const h = await mount();
    h.api.removeProps!('probe', ['retained']);
    expect(h.element.textContent).toBe('initial|absent');
    expect(Object.hasOwn(getElementProps(h.element)!, 'retained')).toBe(false);
    expect(h.rendered).toHaveBeenCalledTimes(1);
    expect(h.updated).toHaveBeenCalledTimes(1);
  });

  it('uses the public props channel even when the convenience method is absent', async () => {
    const h = await mount();
    delete (h.element as HTMLElement & { setProps?: unknown }).setProps;
    h.api.setProps('probe', { value: 'canonical' });
    expect(h.element.textContent).toBe('canonical|kept');
    expect(h.updated).toHaveBeenCalledTimes(1);
  });

  it('keeps a separate reentrant update intent without repeating either commit', async () => {
    const h = await mount({
      onUpdated(run, api) {
        if (run.props.get().value === 'first') api.setProps('probe', { value: 'second' });
      },
    });
    h.api.setProps('probe', { value: 'first' });
    await vi.waitFor(() => expect(h.element.textContent).toBe('second|kept'));
    expect(h.rendered).toHaveBeenCalledTimes(2);
    expect(h.updated).toHaveBeenCalledTimes(2);
  });

  it('does not project a patch whose getter retires the render lease', async () => {
    const h = await mount();
    const read = vi.fn(() => {
      h.view.destroy();
      return 'stale';
    });
    h.api.setProps('probe', {
      get value() {
        return read();
      },
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(h.updated).not.toHaveBeenCalled();
    expect(h.rendered).not.toHaveBeenCalled();
    expect(h.element.isConnected).toBe(false);
    expect(getElementProps(h.element)?.value).toBe('initial');
    h.api.setProps('probe', {
      get value() {
        return read();
      },
    });
    expect(read).toHaveBeenCalledTimes(1);
    // The WC Adapter intentionally defers terminal disconnect disposal.
    await vi.waitFor(() => expect(h.disposed).toHaveBeenCalledTimes(1));
  });

  it('propagates a caller getter failure without submitting an update', async () => {
    const h = await mount();
    const failure = new Error('caller getter failed');
    const read = vi.fn(() => {
      throw failure;
    });
    expect(() =>
      h.api.setProps('probe', {
        get value() {
          return read();
        },
      })
    ).toThrow(failure);
    expect(read).toHaveBeenCalledTimes(1);
    expect(h.rendered).not.toHaveBeenCalled();
    expect(h.updated).not.toHaveBeenCalled();
    expect(h.element.textContent).toBe('initial|kept');
  });

  it('does not update an owner retired by a real props watcher', async () => {
    const h = await mount({
      onProps(run) {
        if (run.props.get().value === 'retire') h.view.destroy();
      },
    });
    h.api.setProps('probe', { value: 'retire' });
    expect(h.watched).toHaveBeenCalledTimes(1);
    expect(h.element.isConnected).toBe(false);
    expect(h.rendered).not.toHaveBeenCalled();
    expect(h.updated).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(h.disposed).toHaveBeenCalledTimes(1));
  });

  it('propagates a real props watcher failure without a fallback commit', async () => {
    const failure = new Error('props watcher failed');
    const h = await mount({
      onProps(run) {
        if (run.props.get().value === 'fail') throw failure;
      },
    });
    expect(() => h.api.setProps('probe', { value: 'fail' })).toThrow(failure);
    expect(h.watched).toHaveBeenCalledTimes(1);
    expect(h.rendered).not.toHaveBeenCalled();
    expect(h.updated).not.toHaveBeenCalled();
    expect(h.element.textContent).toBe('initial|kept');
  });
});
