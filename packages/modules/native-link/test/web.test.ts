import { describe, expect, it, vi } from 'vitest';
import { createWebNativeLinkHost, normalizeNativeLinkConfig } from '../src';

import { activationTurn as turn } from './no-network';
function setup(config = { href: '#safe' }) {
  const anchor = document.createElement('a');
  const onNavigate = vi.fn();
  const host = createWebNativeLinkHost(() => anchor);
  const lease = host.attach({ config: normalizeNativeLinkConfig(config), onNavigate });
  return { anchor, onNavigate, host, lease };
}
function click(anchor: HTMLAnchorElement, options: MouseEventInit = {}, type = 'click') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...options });
  anchor.dispatchEvent(event);
  return event;
}

describe('native-link Web host', () => {
  it.each([
    'javascript:alert(1)',
    '\tJaVaScript:alert(1)',
    'java\nscript:alert(1)',
    'vbscript:x',
    'data:text/html,x',
    'blob:https://host/opaque',
  ])('rejects script-bearing or unadmitted URI %s', (href) => {
    expect(normalizeNativeLinkConfig({ href }).href).toBe('');
  });
  it.each([
    '/app?q=ok#detail',
    '../route',
    '?query',
    '#fragment',
    '//example.test/path',
    'https://example.test/',
    'mailto:a@example.test',
    'tel:123',
  ])('retains safe navigation %s', (href) => {
    expect(normalizeNativeLinkConfig({ href }).href).toBe(href);
  });
  it('projects a full replacement, preserving explicit rel and safe blank targeting', () => {
    const { anchor, lease } = setup();
    lease.update(
      normalizeNativeLinkConfig({ href: '/next', target: '_blank', rel: 'external noreferrer' })
    );
    expect(anchor.getAttribute('href')).toBe('/next');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('external noreferrer noopener');
    lease.update(normalizeNativeLinkConfig({ href: '#latest' }));
    expect(anchor.getAttribute('href')).toBe('#latest');
    expect(anchor.hasAttribute('target')).toBe(false);
    expect(anchor.hasAttribute('rel')).toBe(false);
    lease.update(normalizeNativeLinkConfig({}));
    expect(anchor.hasAttribute('href')).toBe(false);
    lease.dispose();
  });
  it('observes native primary/keyboard/modified/middle activation once after default, never synthesizing Space', async () => {
    const { anchor, lease, onNavigate } = setup();
    for (const init of [
      { detail: 1 },
      { detail: 0 },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
    ]) {
      expect(click(anchor, init).defaultPrevented).toBe(false);
      await turn();
    }
    expect(click(anchor, { button: 1 }, 'auxclick').defaultPrevented).toBe(false);
    await turn();
    expect(onNavigate).toHaveBeenCalledTimes(6);
    expect(onNavigate.mock.calls.map(([event]) => event.modified)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
    click(anchor, { button: 2 }, 'auxclick');
    anchor.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    );
    await turn();
    expect(onNavigate).toHaveBeenCalledTimes(6);
    lease.dispose();
  });
  it('suppresses disabled native defaults and restores original focus metadata', async () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('tabindex', '3');
    anchor.setAttribute('aria-disabled', 'false');
    const onNavigate = vi.fn();
    const lease = createWebNativeLinkHost(() => anchor).attach({
      config: normalizeNativeLinkConfig({ href: '#one', disabled: true }),
      onNavigate,
    });
    expect(anchor.hasAttribute('href')).toBe(false);
    expect(anchor.tabIndex).toBe(-1);
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
    expect(click(anchor).defaultPrevented).toBe(true);
    expect(click(anchor, { button: 1 }, 'auxclick').defaultPrevented).toBe(true);
    await turn();
    expect(onNavigate).not.toHaveBeenCalled();
    lease.update(normalizeNativeLinkConfig({ href: '#two' }));
    expect(anchor.tabIndex).toBe(3);
    expect(anchor.getAttribute('aria-disabled')).toBe('false');
    lease.dispose();
  });
  it('captures current host focus metadata when disabling starts, rather than stale attach-time values', () => {
    const { anchor, lease } = setup();
    anchor.setAttribute('tabindex', '5');
    lease.update(normalizeNativeLinkConfig({ href: '#safe', disabled: true }));
    expect(anchor.tabIndex).toBe(-1);
    lease.update(normalizeNativeLinkConfig({ href: '#safe' }));
    expect(anchor.tabIndex).toBe(5);
    lease.dispose();
  });
  it('keeps defaults intact when the observer closes/unmounts, and ignores old queued observations', async () => {
    const { anchor, lease, onNavigate } = setup();
    onNavigate.mockImplementation(() => lease.dispose());
    const event = click(anchor);
    expect(anchor.getAttribute('href')).toBe('#safe');
    expect(onNavigate).not.toHaveBeenCalled();
    await turn();
    expect(event.defaultPrevented).toBe(false);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(anchor.hasAttribute('href')).toBe(false);
    click(anchor);
    await turn();
    expect(onNavigate).toHaveBeenCalledOnce();
  });
  it('retires stale updates and queued events; old cleanup cannot touch a replacement lease or external attributes', async () => {
    const { anchor, lease, host, onNavigate } = setup();
    click(anchor);
    const next = host.attach({
      config: normalizeNativeLinkConfig({ href: '#replacement' }),
      onNavigate,
    });
    lease.update(normalizeNativeLinkConfig({ href: '#stale' }));
    lease.dispose();
    await turn();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(anchor.getAttribute('href')).toBe('#replacement');
    anchor.setAttribute('href', '#external');
    next.dispose();
    expect(anchor.getAttribute('href')).toBe('#external');
  });
  it('drops a queued old configuration on replacement and honors earlier preventDefault', async () => {
    const { anchor, lease, onNavigate } = setup();
    click(anchor);
    lease.update(normalizeNativeLinkConfig({ href: '#changed' }));
    await turn();
    expect(onNavigate).not.toHaveBeenCalled();
    const event = new MouseEvent('click', { cancelable: true });
    event.preventDefault();
    anchor.dispatchEvent(event);
    await turn();
    expect(onNavigate).not.toHaveBeenCalled();
    lease.dispose();
  });
  it('retains a pending native observation across an equivalent complete sync', async () => {
    const { anchor, lease, onNavigate } = setup();
    click(anchor);
    lease.update(
      normalizeNativeLinkConfig({ href: '#safe', target: '', rel: '', disabled: false })
    );
    await turn();
    expect(onNavigate).toHaveBeenCalledOnce();
    lease.dispose();
  });
  it('does not report activation cancelled by a later native listener', async () => {
    const { anchor, lease, onNavigate } = setup();
    anchor.addEventListener('click', (event) => event.preventDefault());
    expect(click(anchor).defaultPrevented).toBe(true);
    await turn();
    expect(onNavigate).not.toHaveBeenCalled();
    lease.dispose();
  });
  it('validates the actual native anchor rather than pretending a custom root is a link', () => {
    expect(() =>
      createWebNativeLinkHost(() => document.createElement('div') as any).attach({
        config: normalizeNativeLinkConfig({}),
        onNavigate() {},
      })
    ).toThrow('physical anchor');
  });
});
