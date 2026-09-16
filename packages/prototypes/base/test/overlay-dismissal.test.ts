import { expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dialogRoot, dialogContent, dialogTrigger } from '../src/dialog';
import { dropdownRoot, dropdownContent, dropdownTrigger } from '../src/dropdown';

for (const proto of [
  dialogRoot,
  dialogContent,
  dialogTrigger,
  dropdownRoot,
  dropdownContent,
  dropdownTrigger,
])
  AdaptToWebComponent(proto as any);
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

it.each(['dialog', 'dropdown'])(
  'T-OVERLAY-CATALOG-0001-CASE-CONSUMER: nested controlled %s requests stay with the selected Root',
  async (kind) => {
    function create() {
      const root = document.createElement(`base-${kind}-root`) as any;
      const trigger = document.createElement(`base-${kind}-trigger`);
      const content = document.createElement(`base-${kind}-content`) as any;
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
      inner.root.remove();
      outer.root.remove();
      await flush();
    }
  }
);
