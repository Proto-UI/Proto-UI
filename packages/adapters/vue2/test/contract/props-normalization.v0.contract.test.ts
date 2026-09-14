import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createVue2Adapter } from '../../src/adapt';
import type { Vue2AdapterOptions } from '../../src/adapt';
import type { Prototype } from '@proto.ui/core';
import { mountVue2Adapter, Vue2RuntimeAny, flushVue2 } from '../utils/vue2';
function mount(
  proto: Prototype,
  options: Vue2AdapterOptions<Record<string, unknown>>,
  props: Record<string, unknown>
) {
  return mountVue2Adapter(createVue2Adapter(Vue2RuntimeAny)(proto, options), props);
}

describe('adapter-vue2: Props normalization contract', () => {
  it('combines component props and attrs before excluding presentation fields and listeners', async () => {
    let raw: Readonly<Record<string, unknown>> = {};

    const proto = definePrototype({
      name: 'vue2-props-normalization-default',
      setup(def) {
        def.props.define({ label: { type: 'string', default: 'fallback' } });
        def.lifecycle.onMounted((run) => {
          raw = { ...run.props.getRaw() };
        });
        return (renderer) => [String(renderer.read.props.get().label)];
      },
    });

    const mounted = mount(
      proto,
      {},
      {
        label: 'kept',
        class: 'consumer-class',
        hostClass: 'host-class',
        surfaceClass: 'surface-class',
        style: { color: 'red' },
        hostStyle: { margin: '1px' },
        surfaceStyle: { padding: '2px' },
        onCheckedChange: () => {},
      }
    );
    await flushVue2();

    expect(raw).toEqual({ label: 'kept' });
    mounted.unmount();
  });

  it('passes merged component props and attrs to an explicit replacement getProps option', async () => {
    let raw: Readonly<Record<string, unknown>> = {};

    const proto = definePrototype({
      name: 'vue2-props-normalization-custom',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
          classifiedClass: { type: 'string', default: 'missing' },
          classifiedHostClass: { type: 'string', default: 'missing' },
          listenerType: { type: 'string', default: 'missing' },
        });
        def.lifecycle.onMounted((run) => {
          raw = { ...run.props.getRaw() };
        });
        return (renderer) => [String(renderer.read.props.get().label)];
      },
    });

    const mounted = mount(
      proto,
      {
        getProps(props: Record<string, unknown>) {
          return {
            label: `custom:${String(props.label)}`,
            classifiedClass: String(props.class),
            classifiedHostClass: String(props.hostClass),
            listenerType: typeof props.onCheckedChange,
          };
        },
      },
      {
        label: 'input',
        class: 'selected-class',
        hostClass: 'selected-host-class',
        onCheckedChange: () => {},
      }
    );
    await flushVue2();

    expect(raw).toEqual({
      label: 'custom:input',
      classifiedClass: 'selected-class',
      classifiedHostClass: 'selected-host-class',
      listenerType: 'function',
    });
    mounted.unmount();
  });
});
