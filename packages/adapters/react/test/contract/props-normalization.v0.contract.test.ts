import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createMountedReactAdapter } from '../utils/fake-react';

describe('adapter-react: Props normalization contract', () => {
  it('excludes React presentation inputs, children, and function-valued onX listeners', () => {
    let raw: Readonly<Record<string, unknown>> = {};

    const proto = definePrototype({
      name: 'react-props-normalization-default',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
          onPassive: { type: 'string', default: 'fallback' },
        });
        def.lifecycle.onMounted((run) => {
          raw = { ...run.props.getRaw() };
        });
        return (renderer) => [String(renderer.read.props.get().label)];
      },
    });

    const mounted = createMountedReactAdapter(proto, {
      label: 'kept',
      onPassive: 'semantic-value',
      children: 'host-child',
      className: 'consumer-class',
      hostClassName: 'host-class',
      surfaceClassName: 'surface-class',
      style: { color: 'red' },
      hostStyle: { margin: '1px' },
      surfaceStyle: { padding: '2px' },
      onCheckedChange: () => {},
    });

    expect(raw).toEqual({ label: 'kept', onPassive: 'semantic-value' });
    mounted.unmount();
  });

  it('lets an explicit getProps option replace the default classification policy', () => {
    let raw: Readonly<Record<string, unknown>> = {};

    const proto = definePrototype({
      name: 'react-props-normalization-custom',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
          classifiedChild: { type: 'string', default: 'missing' },
          classifiedClass: { type: 'string', default: 'missing' },
          listenerType: { type: 'string', default: 'missing' },
        });
        def.lifecycle.onMounted((run) => {
          raw = { ...run.props.getRaw() };
        });
        return (renderer) => [String(renderer.read.props.get().label)];
      },
    });

    const mounted = createMountedReactAdapter(
      proto,
      {
        label: 'input',
        children: 'selected-child',
        className: 'selected-class',
        onCheckedChange: () => {},
      },
      {
        getProps(props: Record<string, unknown>) {
          return {
            label: `custom:${String(props.label)}`,
            classifiedChild: String(props.children),
            classifiedClass: String(props.className),
            listenerType: typeof props.onCheckedChange,
          };
        },
      }
    );

    expect(raw).toEqual({
      label: 'custom:input',
      classifiedChild: 'selected-child',
      classifiedClass: 'selected-class',
      listenerType: 'function',
    });
    mounted.unmount();
  });
});
