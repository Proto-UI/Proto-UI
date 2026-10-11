import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { AdaptToWebComponent } from '../../src/adapt';
import { getElementProps, setElementProps } from '../../src/props';

async function flushWebComponentAdapter() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('adapter-web-component: Props normalization contract', () => {
  it('keeps presentation fields outside direct-applied raw Props without implicit render', async () => {
    const tagName = `x-props-normalization-${Math.random().toString(16).slice(2)}`;
    const capture: { readRaw?: () => Readonly<Record<string, unknown>> } = {};
    let watched = 0;
    let rendered = 0;

    const proto = definePrototype({
      name: tagName,
      setup(def) {
        def.props.define({ value: { type: 'number', default: 1 } });
        def.props.watch(['value'], () => {
          watched += 1;
        });
        def.lifecycle.onMounted((run) => {
          capture.readRaw = () => ({ ...run.props.getRaw() });
        });
        return (renderer) => {
          rendered += 1;
          return [String(renderer.read.props.get().value)];
        };
      },
    });

    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: tagName,
      schedule: (task) => task(),
    });
    customElements.define(tagName, Ctor);

    const el = document.createElement(tagName) as HTMLElement & { update(): void };
    document.body.appendChild(el);
    await flushWebComponentAdapter();

    expect(el.textContent).toBe('1');
    expect(rendered).toBe(1);

    setElementProps(el, {
      value: 2,
      className: 'host-class',
      surfaceClassName: 'surface-class',
      surfaceStyle: { color: 'red' },
    });

    expect(getElementProps(el)).toEqual({ value: 2 });
    expect(capture.readRaw?.()).toEqual({ value: 2 });
    expect(el.classList.contains('host-class')).toBe(true);
    expect(watched).toBe(1);
    expect(rendered).toBe(1);
    expect(el.textContent).toBe('1');

    el.update();
    await flushWebComponentAdapter();

    expect(rendered).toBe(2);
    expect(el.textContent).toBe('2');

    el.remove();
    await flushWebComponentAdapter();
  });
});

it.each([false, true])(
  'separates native dir from explicit Props dir (declared=%s)',
  async (declared) => {
    const tagName = `x-dir-contract-${Math.random().toString(16).slice(2)}`;
    let readRaw: () => Readonly<Record<string, unknown>> = () => ({});
    let readResolved: () => Readonly<Record<string, unknown>> = () => ({});
    let watched = 0;
    const proto = definePrototype({
      name: tagName,
      setup(def) {
        def.props.define(declared ? { dir: { type: 'string', default: 'ltr' } } : {});
        def.props.watchRawAll(() => {
          watched++;
        });
        def.lifecycle.onMounted((run) => {
          readRaw = () => ({ ...run.props.getRaw() });
          readResolved = () => ({ ...run.props.get() });
        });
        return () => 'direction control';
      },
    });
    const Ctor = AdaptToWebComponent(proto, {
      register: false,
      registerAs: tagName,
      schedule: (task) => task(),
    });
    customElements.define(tagName, Ctor);
    const el = document.createElement(tagName) as HTMLElement & { update(): void };
    el.dir = 'rtl';
    document.body.append(el);
    await flushWebComponentAdapter();
    try {
      expect(readRaw()).toEqual({});
      expect(readResolved()).toEqual(declared ? { dir: 'ltr' } : {});
      setElementProps(el, { dir: 'rtl' });
      expect(readRaw()).toEqual({ dir: 'rtl' });
      expect(readResolved()).toEqual(declared ? { dir: 'rtl' } : {});
      const beforeHostChange = watched;
      el.dir = 'ltr';
      await flushWebComponentAdapter();
      el.update();
      expect(el.dir).toBe('ltr');
      expect(readRaw()).toEqual({ dir: 'rtl' });
      expect(readResolved()).toEqual(declared ? { dir: 'rtl' } : {});
      expect(watched).toBe(beforeHostChange);
    } finally {
      el.remove();
      await flushWebComponentAdapter();
    }
  }
);
