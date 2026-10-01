import { describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dialogRoot, dialogTrigger, dialogMask, dialogContent, dialogClose } from '../src/dialog';

// P-BASE-DIALOG-CONTENT CONTROLLED/PRESENCE: a synchronous Maker reply is
// already the current owner input when request delivery returns.
describe('Dialog controlled Escape reentrancy', () => {
  it.each(['none', 'sync', 'microtask'] as const)(
    'retains the latest owner input with %s reply',
    async (reply) => {
      const protos = {
        root: dialogRoot,
        trigger: dialogTrigger,
        mask: dialogMask,
        content: dialogContent,
        close: dialogClose,
      };
      const parts: Record<string, any> = {};
      for (const [key, proto] of Object.entries(protos)) {
        const C = AdaptToWebComponent(proto, { registerAs: `dismiss-${reply}-${key}` });
        parts[key] = new C();
      }
      const { root, trigger, mask, content, close } = parts;
      content.append(close);
      root.append(trigger, mask, content);
      const requests: unknown[] = [];
      root.addEventListener('openChange', (event: CustomEvent) => {
        requests.push(event.detail);
        if (reply === 'sync') setElementProps(root, { open: event.detail.open });
        if (reply === 'microtask')
          queueMicrotask(() => setElementProps(root, { open: event.detail.open }));
      });
      setElementProps(root, { open: true });
      document.body.append(root);
      const flush = async () => {
        for (let i = 0; i < 8; i++) await Promise.resolve();
      };
      try {
        await flush();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(requests).toEqual([expect.objectContaining({ open: false, reason: 'escape' })]);
        expect(root.getExposes().open.get()).toBe(reply === 'none');
        expect(content.getExposes().transitionState.get() === 'leaving').toBe(reply !== 'none');
        if (reply === 'none') setElementProps(root, { open: false });
        // Unit scheduling boundary only; public browser evidence waits naturally.
        for (const part of [mask, content]) part.getExposes().controls.complete();
        await flush();
        expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
        // View detachment is observable before the portal conceal barrier
        // releases physical ownership; microtasks alone are not that boundary.
        await vi.waitFor(() => {
          expect(content.parentElement).toBe(root);
          expect(document.body.style.overflow).toBe('');
        });
      } finally {
        root.remove();
        mask.remove();
        content.remove();
        await flush();
      }
    }
  );
});
