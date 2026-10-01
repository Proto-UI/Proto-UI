import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '../src';
import {
  dialogRoot,
  dialogMask,
  dialogContent,
  dialogTrigger,
} from '../../../prototypes/base/src/dialog';

// A-WEB-COMPONENT G/I + C-AS-OVERLAY E/F/K: physical portal projection
// must not orphan a descendant when its logical origin leaves the document.
describe('WC portal origin ownership', () => {
  it.each([false, true])(
    'reclaims open portals after origin removal (shadow origin=%s)',
    async (shadow) => {
      const parts: Record<string, any> = {};
      for (const [key, proto] of Object.entries({
        root: dialogRoot,
        mask: dialogMask,
        content: dialogContent,
        trigger: dialogTrigger,
      })) {
        const C = AdaptToWebComponent(proto, { registerAs: `portal-owner-${shadow}-${key}` });
        parts[key] = new C();
      }
      const { root, mask, content, trigger } = parts;
      const carrier = document.createElement('div');
      const origin = shadow ? carrier.attachShadow({ mode: 'open' }) : carrier;
      const parent = document.createElement('section');
      origin.append(parent);
      parent.append(root);
      root.append(trigger, mask, content);
      setElementProps(root, { open: true });
      document.body.append(carrier);
      const flush = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      };
      try {
        await flush();
        expect(content.parentElement).toBe(document.body);
        // A synchronous move does not disconnect logical ownership at settlement.
        const destination = document.createElement('div');
        origin.append(destination);
        destination.append(root);
        await flush();
        expect(content.parentElement).toBe(document.body);
        expect(content.getExposes().open.get()).toBe(true);
        // Rebind liveness observation when a sync move changes containing roots.
        const other = document.createElement('div');
        origin.append(other);
        const otherTree = other.attachShadow({ mode: 'open' });
        otherTree.append(root);
        await flush();
        expect(content.parentElement).toBe(document.body);
        root.remove();
        await flush();
        expect(content.isConnected).toBe(false);
        expect(mask.isConnected).toBe(false);
        expect(content.parentElement).toBe(root);
        expect(document.body.style.overflow).toBe('');
        setElementProps(root, { open: false });
        parent.append(root);
        await flush();
        setElementProps(root, { open: true });
        await flush();
        expect(content.parentElement).toBe(document.body);
        carrier.remove();
        await flush();
        expect(content.isConnected).toBe(false);
        expect(document.body.style.overflow).toBe('');
      } finally {
        carrier.remove();
        mask.remove();
        content.remove();
        await flush();
      }
    }
  );
});
