import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import surface from '../src/surface';

async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.useRealTimers();
});

describe('Bootstrap 2.3.2 passive Thumbnail', () => {
  it('preserves slotted native focus and semantics across presentation changes', async () => {
    const tag = 'wc-bootstrap-thumbnail-independent';
    if (!customElements.get(tag))
      customElements.define(
        tag,
        AdaptToWebComponent(surface, { register: false, registerAs: tag })
      );
    const host = document.createElement(tag);
    setElementProps(host, { variant: 'outline', elevation: 'raised' });
    const heading = document.createElement('h2');
    heading.textContent = 'Bootstrap 2.3.2';
    const link = document.createElement('a');
    link.href = '/bootstrap/';
    link.textContent = 'Explore';
    host.append(heading, link);
    document.body.append(host);
    await settle();
    expect(host.querySelector('h2')).toBe(heading);
    expect(host.querySelector('a')).toBe(link);
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(host.querySelectorAll('a a,button,[role="button"]')).toHaveLength(0);
    link.focus();
    for (const props of [
      { variant: 'solid', elevation: 'raised', pressed: true },
      { variant: 'outline', elevation: 'none', pressed: false },
    ]) {
      setElementProps(host, props);
      await settle();
      expect(host.querySelector('h2')).toBe(heading);
      expect(host.querySelector('a')).toBe(link);
      expect(document.activeElement).toBe(link);
      expect(host.hasAttribute('role')).toBe(false);
      expect(host.hasAttribute('tabindex')).toBe(false);
    }
  });
});
