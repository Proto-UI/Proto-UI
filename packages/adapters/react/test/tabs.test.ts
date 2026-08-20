import { describe, expect, it } from 'vitest';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../../../prototypes/base/src/tabs';

import { createMountedReactAdapter, createMountedReactAdapterInto } from './utils/fake-react';

function appendHost(parent: HTMLElement): HTMLElement {
  const host = document.createElement('span');
  parent.appendChild(host);
  return host;
}

describe('adapter-react: base tabs compound protocol', () => {
  it('coordinates tabs context, anatomy, a11y label, trigger activation, and roving focus', () => {
    const root = createMountedReactAdapter(tabsRoot, { defaultValue: 'a' });
    const rootEl = root.root as HTMLElement;
    const list = createMountedReactAdapterInto(tabsList, appendHost(rootEl), {
      a11yLabel: 'React tabs',
    });
    const triggerA = createMountedReactAdapterInto(tabsTrigger, appendHost(list.root!), {
      value: 'a',
    });
    const triggerB = createMountedReactAdapterInto(tabsTrigger, appendHost(list.root!), {
      value: 'b',
    });
    const contentA = createMountedReactAdapterInto(tabsContent, appendHost(rootEl), {
      value: 'a',
    });
    const contentB = createMountedReactAdapterInto(tabsContent, appendHost(rootEl), {
      value: 'b',
    });

    expect(list.root?.getAttribute('role')).toBe('tablist');
    expect(list.root?.getAttribute('aria-label')).toBe('React tabs');
    expect(root.ref.current?.getExposes().value.get()).toBe('a');
    expect(triggerA.ref.current?.getExposes().selected.get()).toBe(true);
    expect(contentA.ref.current?.getExposes().current.get()).toBe(true);
    expect(triggerB.root?.getAttribute('tabindex')).toBe('-1');

    triggerA.root?.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(document.activeElement).toBe(triggerB.root);
    expect(root.ref.current?.getExposes().value.get()).toBe('b');

    triggerA.root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.ref.current?.getExposes().value.get()).toBe('a');
    expect(triggerA.ref.current?.getExposes().selected.get()).toBe(true);
    expect(triggerB.ref.current?.getExposes().selected.get()).toBe(false);
    expect(contentA.ref.current?.getExposes().current.get()).toBe(true);
    expect(contentB.ref.current?.getExposes().current.get()).toBe(false);

    contentB.unmount();
    contentA.unmount();
    triggerB.unmount();
    triggerA.unmount();
    list.unmount();
    root.unmount();
  });
});
