import { describe, expect, it } from 'vitest';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '../../../prototypes/base/src/tabs';

import { createMountedReactAdapter, createMountedReactAdapterInto } from './utils/fake-react';

function appendHost(parent: HTMLElement): HTMLElement {
  const host = document.createElement('span');
  parent.appendChild(host);
  return host;
}

describe('adapter-react: base tabs compound protocol', () => {
  it('matches retained exact-key parts and rejects missing or duplicate content', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    // This fake renderer has no compound owner Context; real L1 is covered in the browser matrix.
    const mounted: Array<{ unmount(): void }> = [];
    const mount = (proto: any, parent: HTMLElement, props: Record<string, unknown>) => {
      const part = createMountedReactAdapterInto(proto, appendHost(parent), props);
      mounted.push(part);
      return part;
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const root = mount(tabsRoot, host, { defaultValue: 'a+b' });
      const list = mount(tabsList, root.root!, {});
      const triggers = ['a+b', 'a b', 'missing', 'duplicate'].map((value) =>
        mount(tabsTrigger, list.root!, { value })
      );
      const contents = ['a+b', 'a b', 'duplicate', 'duplicate'].map((value) =>
        mount(tabsContent, root.root!, { value, keepMounted: true })
      );

      expect(root.ref.current.getExposes().value.get()).toBe('a+b');
      expect(contents[0].root!.id).not.toBe('');
      expect(contents[1].root!.id).not.toBe('');
      expect(contents[0].root!.id).not.toBe(contents[1].root!.id);
      for (const index of [0, 1]) {
        expect(triggers[index].root!.getAttribute('aria-controls')).toBe(contents[index].root!.id);
        expect(contents[index].root!.getAttribute('aria-labelledby')).toBe(
          triggers[index].root!.id
        );
      }
      expect(triggers[2].root!.hasAttribute('aria-controls')).toBe(false);
      expect(triggers[3].root!.hasAttribute('aria-controls')).toBe(false);

      mounted.pop()!.unmount();
      await Promise.resolve();
      expect(triggers[3].root!.getAttribute('aria-controls')).toBe(contents[2].root!.id);
    } finally {
      for (const part of mounted.reverse()) part.unmount();
      host.remove();
      await Promise.resolve();
    }
  });

  it('isolates same-key retained parts in adjacent and nested domains', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const mounted: Array<{ unmount(): void }> = [];
    const mount = (proto: any, parent: HTMLElement, props: Record<string, unknown>) => {
      const part = createMountedReactAdapterInto(proto, appendHost(parent), props);
      mounted.push(part);
      return part;
    };
    const family = (parent: HTMLElement) => {
      const root = mount(tabsRoot, parent, { defaultValue: 'shared' });
      const list = mount(tabsList, root.root!, {});
      const trigger = mount(tabsTrigger, list.root!, { value: 'shared' });
      const content = mount(tabsContent, root.root!, { value: 'shared', keepMounted: true });
      return { root, trigger, content };
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const outer = family(host);
      const nested = family(outer.root.root!);
      const adjacent = family(host);
      const ids = [outer, nested, adjacent].map(({ trigger, content }) => {
        expect(content.root!.id).not.toBe('');
        expect(trigger.root!.getAttribute('aria-controls')).toBe(content.root!.id);
        expect(content.root!.getAttribute('aria-labelledby')).toBe(trigger.root!.id);
        return content.root!.id;
      });
      expect(new Set(ids).size).toBe(3);
    } finally {
      for (const part of mounted.reverse()) part.unmount();
      host.remove();
      await Promise.resolve();
    }
  });

  it('coordinates tabs context, anatomy, a11y label, trigger activation, and roving focus', async () => {
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

    try {
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
    } finally {
      contentB.unmount();
      contentA.unmount();
      triggerB.unmount();
      triggerA.unmount();
      list.unmount();
      root.unmount();
      await Promise.resolve();
    }
  });
});
