import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';

import { createVueAdapter, type VueRuntime } from '../src/adapt';
import { createMountedVueAdapter, flushVue } from './utils/vue';

function createFakeVueRuntime() {
  const mounted: Array<() => void> = [];
  const beforeUnmount: Array<() => void> = [];

  let capturedOptions: any = null;

  const runtime: VueRuntime = {
    defineComponent(opt: any) {
      capturedOptions = opt;
      return opt;
    },
    h(type: any, props?: any, children?: any) {
      return { type, props, children };
    },
    ref<T>(value: T) {
      return { value };
    },
    shallowRef<T>(value: T) {
      return { value };
    },
    watch() {},
    onMounted(cb: () => void) {
      mounted.push(cb);
    },
    onBeforeUnmount(cb: () => void) {
      beforeUnmount.push(cb);
    },
    nextTick() {
      return Promise.resolve();
    },
  };

  return {
    runtime,
    get options() {
      return capturedOptions;
    },
    mounted,
    beforeUnmount,
  };
}

describe('adapter-vue: framework contract', () => {
  it('accepts Vue-style overloaded watch and ref signatures as adapter runtime', () => {
    type WatchSource<T> = { value: T };
    type VueStyleWatch = {
      <T>(source: WatchSource<T>, cb: (value: T) => void, options?: unknown): () => void;
      <T extends readonly WatchSource<unknown>[]>(
        source: T,
        cb: (value: T) => void,
        options?: unknown
      ): () => void;
    };

    const runtime = {
      defineComponent(opt: any) {
        return opt;
      },
      h(type: any, props?: any, children?: any) {
        return { type, props, children };
      },
      ref<T>(value: T) {
        return { value };
      },
      shallowRef<T>(value: T) {
        return { value };
      },
      watch: (() => () => {}) as VueStyleWatch,
      onMounted() {},
      onBeforeUnmount() {},
      nextTick() {
        return Promise.resolve();
      },
    };

    expect(typeof createVueAdapter(runtime)).toBe('function');
  });

  it('registers Vue component options with host props and inheritAttrs disabled', () => {
    const fake = createFakeVueRuntime();

    const proto: Prototype = {
      name: 'vue-framework-contract',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };

    const Component = createVueAdapter(fake.runtime)(proto);

    expect(Component).toBe(fake.options);
    expect(fake.options.name).toBe('Proto(vue-framework-contract)');
    expect(fake.options.inheritAttrs).toBe(false);
    expect(fake.options.props.hostClass).toBeTruthy();
    expect(fake.options.props.hostStyle).toBeTruthy();
  });

  it('calls Vue ctx.expose with adapter handle and registers lifecycle hooks', () => {
    const fake = createFakeVueRuntime();

    const proto: Prototype = {
      name: 'vue-framework-expose',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };

    createVueAdapter(fake.runtime)(proto);

    const exposed: { current?: any } = {};
    const setupResult = fake.options.setup(
      { hostClass: undefined, hostStyle: undefined },
      {
        attrs: {},
        slots: {},
        expose(value: any) {
          exposed.current = value;
        },
      }
    );

    expect(typeof setupResult).toBe('function');
    expect(typeof exposed.current.update).toBe('function');
    expect(typeof exposed.current.getExposes).toBe('function');
    expect(fake.mounted.length).toBeGreaterThan(0);
    expect(fake.beforeUnmount.length).toBeGreaterThan(0);
  });

  it('merges fallthrough attrs.style with hostStyle on the host root', async () => {
    const proto: Prototype = {
      name: 'vue-host-style-merge',
      setup() {
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVueAdapter(proto, {
      hostStyle: { color: 'blue', padding: '4px' },
      style: { color: 'red', margin: '8px' },
    });

    await flushVue();

    expect(mounted.root?.style.color).toBe('red');
    expect(mounted.root?.style.padding).toBe('4px');
    expect(mounted.root?.style.margin).toBe('8px');

    mounted.unmount();
  });

  it('does not leak fallthrough style into prototype raw props', async () => {
    let seenStyle: unknown = 'unset';

    const proto: Prototype = {
      name: 'vue-style-prop-boundary',
      setup(def) {
        def.lifecycle.onMounted((run) => {
          seenStyle = (run.props.getRaw() as { style?: unknown }).style;
        });
        return (r) => [r.el('div', 'ok')];
      },
    };

    const mounted = createMountedVueAdapter(proto, {
      style: { width: '200px' },
    });

    await flushVue();

    expect(seenStyle).toBeUndefined();

    mounted.unmount();
  });
});
