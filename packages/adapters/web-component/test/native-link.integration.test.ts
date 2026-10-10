import { activationTurn } from '../../../modules/native-link/test/no-network';
import { expect, it, vi } from 'vitest';
import { linkFixture } from '../../../modules/native-link/test/fixture';
import { AdaptToWebComponent, setElementProps } from '../src';
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

it.each([false, true])(
  'WC owns one actual anchor and preserves native defaults, focus and cleanup (shadow=%s)',
  async (shadow) => {
    const observe = vi.fn();
    const proto = linkFixture({ slot: true, observe });
    AdaptToWebComponent(proto, { shadow });
    const element = document.createElement(proto.name) as any;
    const caller = document.createElement('span');
    caller.textContent = 'Caller-owned text';
    element.append(caller);
    setElementProps(element, {
      href: '#one',
      target: '_blank',
      rel: 'external',
      surfaceClassName: 'link-surface',
    });
    document.body.append(element);
    await flush();
    const root = shadow ? element.shadowRoot : element;
    const anchor = root.querySelector('a') as HTMLAnchorElement;
    try {
      expect(anchor).not.toBeNull();
      expect(root.querySelectorAll('a')).toHaveLength(1);
      expect(element.localName).toBe(proto.name);
      expect(element.hasAttribute('href')).toBe(false);
      expect(anchor.getAttribute('href')).toBe('#one');
      expect(anchor.rel).toBe('external noopener');
      expect(anchor.classList.contains('link-surface')).toBe(true);
      expect(shadow ? anchor.querySelector('slot') : anchor.contains(caller)).toBeTruthy();
      if (!shadow) {
        const later = document.createElement('em');
        later.textContent = 'Later caller';
        element.append(later);
        await activationTurn();
        await flush();
        expect(anchor.contains(later)).toBe(true);
      }
      element.focus();
      expect(shadow ? element.shadowRoot.activeElement : document.activeElement).toBe(anchor);
      const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
      anchor.dispatchEvent(event);
      await activationTurn();
      await flush();
      expect(event.defaultPrevented).toBe(false);
      expect(observe).toHaveBeenCalledOnce();
      setElementProps(element, { href: '#two', disabled: true });
      element.update();
      await flush();
      expect(anchor.hasAttribute('href')).toBe(false);
      expect(anchor.hasAttribute('target')).toBe(false);
      expect(anchor.getAttribute('aria-disabled')).toBe('true');
      setElementProps(element, { href: '#three' });
      element.update();
      await flush();
      expect(root.querySelector('a')).toBe(anchor);
      expect(anchor.getAttribute('href')).toBe('#three');
      element.remove();
      await flush();
      expect(anchor.hasAttribute('href')).toBe(false);
      if (!shadow) expect(element.contains(caller)).toBe(true);
      document.body.append(element);
      await flush();
      expect(root.querySelectorAll('a')).toHaveLength(1);
      expect(root.querySelector('a')?.getAttribute('href')).toBe('#three');
      if (!shadow) expect(anchor.contains(caller)).toBe(true);
    } finally {
      element.remove();
      await flush();
    }
  }
);

it('WC native-link presence restores caller nodes and rematerializes its current destination', async () => {
  const proto = linkFixture({ slot: true });
  AdaptToWebComponent(proto);
  const element = document.createElement(proto.name) as any;
  const caller = document.createElement('span');
  caller.textContent = 'Persistent caller';
  element.append(caller);
  setElementProps(element, { href: '#presence' });
  document.body.append(element);
  await flush();
  try {
    const anchor = element.querySelector('a');
    const view = element.getExposes().view;
    view.hide();
    await flush();
    expect(element.querySelector('a')).toBeNull();
    expect(element.contains(caller)).toBe(true);
    expect(anchor.hasAttribute('href')).toBe(false);
    view.show();
    await flush();
    expect(element.querySelector('a')).toBe(anchor);
    expect(anchor.contains(caller)).toBe(true);
    expect(anchor.getAttribute('href')).toBe('#presence');
  } finally {
    element.remove();
    await flush();
  }
});
