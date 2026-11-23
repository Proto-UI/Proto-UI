import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import surface from '../src/surface';
import text from '../src/text';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';

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
  it('preserves the defined scalable body and heading Text metrics on the same passive owner', async () => {
    // T-BOOTSTRAP-2-3-2-THUMBNAIL-RECIPE-0001-CASE-TEXT independently
    // fixes sm-normal at 14/20 and 2xl-relaxed at 24.5/40 for a 16px root.
    // CSS declarations establish the scalable recipe, not native pixels.
    const tag = 'wc-bootstrap-thumbnail-text';
    if (!customElements.get(tag)) AdaptToWebComponent(text, { registerAs: tag });
    const owner = document.createElement('h3');
    const subject = document.createElement(tag);
    const content = document.createTextNode('Scalable native heading');
    subject.append(content);
    owner.append(subject);
    document.body.append(owner);
    for (const [size, leading, sizeToken, leadingToken, sizeCss, leadingCss] of [
      ['sm', 'normal', 'text-sm', 'leading-[1.4285714285714286]', '0.875rem', '1.4285714285714286'],
      ['2xl', 'relaxed', 'text-[1.53125rem]', 'leading-[2.5rem]', '1.53125rem', '2.5rem'],
    ]) {
      setElementProps(subject, { size, leading });
      await settle();
      const tokens = (subject.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
      expect(tokens).toContain(sizeToken);
      expect(tokens).toContain(leadingToken);
      const css = renderProtoStyleTokenCss(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain(`font-size: ${sizeCss};`);
      expect(css).toContain(`line-height: ${leadingCss};`);
      expect(subject.firstChild).toBe(content);
      expect(owner.firstChild).toBe(subject);
      expect(subject.hasAttribute('role')).toBe(false);
      expect(subject.hasAttribute('tabindex')).toBe(false);
    }
  });

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
