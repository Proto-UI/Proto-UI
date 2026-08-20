import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { createMountedReactAdapter } from './utils/fake-react';

describe('adapter-react: scroll projection', () => {
  it('resolves the adapter profile preference on the host element', () => {
    const proto = definePrototype<any, any>({
      name: 'react-scroll-projection-contract',
      setup(def) {
        const scroll = asScrollSurface();
        scroll.configure({ axes: 'vertical', projection: 'auto' });
        def.expose.state('projection', scroll.projection);
        return (renderer) => renderer.slot();
      },
    });
    const mounted = createMountedReactAdapter(proto, {}, { scrollProjection: 'composed' });

    expect(mounted.root?.dataset.puiScrollProjection).toBe('composed');
    expect(mounted.ref.current.getExposes().projection.get()).toBe('composed');
    mounted.unmount();
  });
});
