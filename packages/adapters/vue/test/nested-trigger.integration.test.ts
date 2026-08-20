import { describe, expect, it, vi } from 'vitest';
import { button } from '@proto.ui/prototypes-base';

import { createVueAdapter } from '../src';
import { flushVue, VueAny } from './utils/vue';

describe('adapter-vue: nested trigger routing', () => {
  it('merges nested adapted triggers while accepting activation only from the inner surface', async () => {
    const adapt = createVueAdapter(VueAny);
    const Button = adapt(button, {
      rootTag: 'div',
      schedule: (task: () => void) => task(),
    });
    const outerClick = vi.fn();
    const innerClick = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = VueAny.createApp({
      setup() {
        return () =>
          VueAny.h(Button, { onClick: outerClick }, () => [
            VueAny.h(Button, { onClick: innerClick }, () => 'Inner'),
          ]);
      },
    });

    app.mount(host);
    await flushVue();
    await flushVue();

    const roots = host.querySelectorAll<HTMLElement>('[data-pui-root]');
    expect(roots).toHaveLength(2);
    expect(roots[0]!.tabIndex).toBe(-1);
    expect(roots[0]!.hasAttribute('tabindex')).toBe(false);
    expect(roots[0]!.hasAttribute('role')).toBe(false);
    expect(roots[1]!.tabIndex).toBe(0);
    expect(roots[1]!.getAttribute('role')).toBe('button');

    roots[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await flushVue();

    expect(innerClick).not.toHaveBeenCalled();
    expect(outerClick).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    roots[1]!.focus();
    await flushVue();
    expect(roots[1]!.hasAttribute('data-focus-visible')).toBe(true);
    expect(roots[0]!.hasAttribute('data-focus-visible')).toBe(false);

    roots[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushVue();

    expect(innerClick).toHaveBeenCalledOnce();
    expect(outerClick).toHaveBeenCalledOnce();

    app.unmount();
    host.remove();
  });
});
