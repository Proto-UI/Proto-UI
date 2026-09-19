import { describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';

describe('native focus ingress', () => {
  it.each([false, true])(
    'binds focus once to the editor and revokes it without changing other host events (shadow=%s)',
    (shadow) => {
      const host = document.createElement('div');
      const root = shadow ? host.attachShadow({ mode: 'open' }) : host;
      const editor = document.createElement('textarea');
      root.append(editor);
      document.body.append(host);
      let enabled = true;
      const router = createWebProtoEventRouter({
        rootEl: host,
        focusEventTarget: editor,
        isEnabled: () => enabled,
      });
      const focus = vi.fn(),
        click = vi.fn();
      router.rootTarget.addEventListener('host:focus', focus);
      router.rootTarget.addEventListener('host:click', click);
      const event = new FocusEvent('focus', { composed: true });
      editor.dispatchEvent(event);
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus.mock.calls[0][0]).toBe(event);
      host.dispatchEvent(new FocusEvent('focus'));
      expect(focus).toHaveBeenCalledTimes(1);
      host.click();
      expect(click).toHaveBeenCalledTimes(1);
      enabled = false;
      editor.dispatchEvent(new FocusEvent('focus'));
      expect(focus).toHaveBeenCalledTimes(1);
      enabled = true;
      router.rootTarget.removeEventListener('host:focus', focus);
      editor.dispatchEvent(new FocusEvent('focus'));
      expect(focus).toHaveBeenCalledTimes(1);
      router.rootTarget.addEventListener('host:focus', focus);
      router.dispose();
      editor.dispatchEvent(new FocusEvent('focus'));
      host.click();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      host.remove();
    }
  );
});
