import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button } from '@proto.ui/prototypes-base';

import { createReactAdapter } from '../src';

const mountedRoots: Array<{ unmount(): void }> = [];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  for (const root of mountedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.replaceChildren();
});

describe('adapter-react: nested trigger routing', () => {
  it('merges nested adapted triggers while accepting activation only from the inner surface', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    const adapt = createReactAdapter(React);
    const Button = adapt(button, {
      rootTag: 'div',
      schedule: (task) => task(),
    });
    const outerClick = vi.fn();
    const innerClick = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(
          Button,
          { onClick: outerClick },
          React.createElement(Button, { onClick: innerClick }, 'Inner')
        )
      );
      await Promise.resolve();
    });

    const roots = host.querySelectorAll<HTMLElement>('[data-pui-root]');
    expect(roots).toHaveLength(2);
    expect(roots[0]!.tabIndex).toBe(-1);
    expect(roots[0]!.hasAttribute('tabindex')).toBe(false);
    expect(roots[0]!.hasAttribute('role')).toBe(false);
    expect(roots[1]!.tabIndex).toBe(0);
    expect(roots[1]!.getAttribute('role')).toBe('button');

    await act(async () => {
      roots[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await Promise.resolve();
    });

    expect(innerClick).not.toHaveBeenCalled();
    expect(outerClick).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    roots[1]!.focus();
    expect(roots[1]!.hasAttribute('data-focus-visible')).toBe(true);
    expect(roots[0]!.hasAttribute('data-focus-visible')).toBe(false);

    await act(async () => {
      roots[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(innerClick).toHaveBeenCalledOnce();
    expect(outerClick).toHaveBeenCalledOnce();
  });
});
