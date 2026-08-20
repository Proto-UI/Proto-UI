import { describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';

import { createMountedReactAdapter } from './utils/fake-react';

describe('adapter-react: expose event bridge', () => {
  it('maps run.expose.emit to onX handler props', () => {
    const onCheckedChange = vi.fn();

    const proto = definePrototype({
      name: 'react-expose-event-basic',
      setup(def) {
        def.expose.event('checkedChange', { payload: 'json' });
        def.lifecycle.onMounted((run) => {
          run.expose.emit('checkedChange', { checked: true });
        });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedReactAdapter(proto, {
      onCheckedChange,
    });

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith({ checked: true });
    expect(mounted.ref.current.getExposes()).not.toHaveProperty('checkedChange');

    mounted.unmount();
  });

  it('does not leak onX handler props into Proto raw props', () => {
    let rawKeys: string[] = [];

    const proto = definePrototype({
      name: 'react-expose-event-props-filter',
      setup(def) {
        def.props.define({
          label: { type: 'string', default: 'fallback' },
        });
        def.expose.event('checkedChange', { payload: 'json' });
        def.lifecycle.onMounted((run) => {
          rawKeys = Object.keys(run.props.getRaw()).sort();
        });
        return (r) => [r.el('div', 'ok')];
      },
    });

    const mounted = createMountedReactAdapter(proto, {
      label: 'Second',
      onCheckedChange: () => {},
    });

    expect(rawKeys).toContain('label');
    expect(rawKeys).not.toContain('onCheckedChange');

    mounted.unmount();
  });
});
