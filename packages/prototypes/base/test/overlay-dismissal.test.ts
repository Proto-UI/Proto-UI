import { expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dialogRoot, dialogContent, dialogTrigger } from '../src/dialog';
import { dropdownRoot, dropdownContent, dropdownTrigger } from '../src/dropdown';

const lifecycle = { created: 0, disposed: 0 };
for (const proto of [
  dialogRoot,
  dialogContent,
  dialogTrigger,
  dropdownRoot,
  dropdownContent,
  dropdownTrigger,
])
  AdaptToWebComponent(proto as any, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lifecycle.created++;
        if (event.type === 'instance.dispose.done') lifecycle.disposed++;
      },
    },
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

it.each(['dialog', 'dropdown'])(
  'T-OVERLAY-CATALOG-0001-CASE-CONSUMER: nested controlled %s requests stay with the selected Root',
  async (kind) => {
    const ownedElements = new Set<HTMLElement>();
    function create() {
      const root = document.createElement(`base-${kind}-root`) as any;
      const trigger = document.createElement(`base-${kind}-trigger`);
      const content = document.createElement(`base-${kind}-content`) as any;
      for (const element of [root, trigger, content]) ownedElements.add(element);
      setElementProps(root, { open: true });
      root.append(trigger, content);
      const requests: any[] = [];
      root.addEventListener('openChange', (event: Event) => {
        if (event.target === root) requests.push((event as CustomEvent).detail);
      });
      return { root, content, requests };
    }
    const outer = create();
    document.body.append(outer.root);
    await flush();
    const inner = create();
    outer.content.append(inner.root);
    await flush();
    try {
      for (let i = 1; i <= 2; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(outer.requests).toEqual([]);
        expect(inner.requests).toHaveLength(i);
        expect(inner.requests[i - 1]).toMatchObject({ open: false, reason: 'escape' });
        expect(inner.root.getExposes().open.get()).toBe(true);
        expect(outer.root.getExposes().open.get()).toBe(true);
      }
    } finally {
      // Portalled parts still belong to this fixture. End every instance
      // before Happy DOM destroys the document their cleanup needs.
      for (const element of ownedElements) {
        if (element.isConnected) element.remove();
      }
      await expect.poll(() => lifecycle.disposed).toBe(lifecycle.created);
    }
  }
);
