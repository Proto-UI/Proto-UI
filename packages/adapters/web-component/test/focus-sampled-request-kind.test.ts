import { describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { asFocusScope } from '@proto.ui/hooks';
import { AdaptToWebComponent } from '../src';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
describe('sampled scope requests acquire ordinary descendant owners', () => {
  it.each([false, true])(
    'moves focus through real raw buttons for Shift=%s Tab',
    async (shiftKey) => {
      const proto = definePrototype({
        name: `raw-sampled-scope-${shiftKey}`,
        setup(def) {
          const scope = asFocusScope();
          scope.configure({ trap: true, loop: true, entry: 'manual', restore: 'none' });
          def.expose('activate', () => scope.activate());
          def.expose('deactivate', () => scope.deactivate());
          return (r) => [r.el('button', 'First'), r.el('button', 'Second')];
        },
      });
      const WC = AdaptToWebComponent(proto);
      const host = new WC();
      document.body.append(host);
      await flush();
      try {
        (host.getExposes() as any).activate();
        const buttons = host.querySelectorAll('button');
        expect(buttons).toHaveLength(2);
        const from = buttons[shiftKey ? 1 : 0]!,
          to = buttons[shiftKey ? 0 : 1]!;
        from.focus();
        expect(document.activeElement).toBe(from);
        from.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, composed: true })
        );
        await flush();
        expect(document.activeElement).toBe(to);
      } finally {
        (host.getExposes() as any).deactivate();
        host.remove();
        await flush();
      }
    }
  );
});
