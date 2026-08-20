import { describe, expect, it } from 'vitest';
import type { OwnedStateHandle, Prototype } from '@proto.ui/core';

import { createMountedReactAdapter } from '../utils/fake-react';

describe('contract: adapter-react / required State runtime (v0)', () => {
  it('retains State mutation without rendering until the Adapter update entry is used', () => {
    let count!: OwnedStateHandle<number>;
    const proto: Prototype = {
      name: 'react-state-runtime',
      setup(def) {
        count = def.state.numberDiscrete('count', 0);
        return (run) => run.el('div', String(count.get()));
      },
    };

    const mounted = createMountedReactAdapter(proto);

    expect(mounted.root?.textContent).toBe('0');
    mounted.ref.current.invokeInCallbackScope(() => count.set(1));
    expect(mounted.root?.textContent).toBe('0');
    mounted.ref.current.update();
    expect(mounted.root?.textContent).toBe('1');

    mounted.unmount();
  });
});
