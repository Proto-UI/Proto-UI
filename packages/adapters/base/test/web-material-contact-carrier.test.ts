import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createContactCarrier,
  inspectContactCarrier,
  contactCarrierBounds,
} from '../src/material/contact-carrier';
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe('private expanded paint carrier (computed-style spy, not browser paint)', () => {
  function fixture() {
    const host = document.createElement('button');
    document.body.append(host);
    const computed: Record<string, string> = { content: 'none' };
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (_el, pseudo) => (pseudo ? computed : { isolation: 'isolate', position: 'relative' }) as any
    );
    return { host, computed };
  }
  it('rejects existing author pseudo content and reserved marker collisions', () => {
    const { host, computed } = fixture();
    computed.content = '"author"';
    expect(inspectContactCarrier(host)).toBe('contact-carrier-pseudo-conflict');
    computed.content = 'none';
    host.setAttribute('data-pui-material-carrier', 'author');
    expect(inspectContactCarrier(host)).toBe('contact-carrier-marker-conflict');
  });
  it('shares one document stylesheet, adds no content children, and releases exactly', () => {
    const { host } = fixture();
    const before = document.head.querySelectorAll('style').length;
    const a = createContactCarrier(host);
    const second = document.createElement('button');
    document.body.append(second);
    const b = createContactCarrier(second);
    expect(document.head.querySelectorAll('style').length).toBe(before + 1);
    expect(host.children.length).toBe(0);
    a.release();
    a.release();
    expect(document.head.querySelectorAll('style').length).toBe(before + 1);
    b.release();
    expect(document.head.querySelectorAll('style').length).toBe(before);
    expect(host.hasAttribute('data-pui-material-carrier')).toBe(false);
  });
  it('verifies actual carrier composition and expanded overlap footprint', () => {
    const { host, computed } = fixture();
    const carrier = createContactCarrier(host);
    for (const [key, value] of Object.entries({
      left: '-10px',
      top: '-10px',
      width: '120px',
      height: '60px',
    })) {
      host.style.setProperty(`--pui-material-${key}`, value);
      computed[key] = value;
    }
    Object.assign(computed, {
      content: '""',
      display: 'block',
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '-1',
      backgroundImage: 'url("data:image/png;base64,AA==")',
      transform: 'none',
      opacity: '1',
      backgroundSize: '100% 100%',
      backgroundPosition: '0% 0%',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'scroll',
      backgroundOrigin: 'border-box',
      backgroundClip: 'border-box',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      visibility: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
    });
    expect(carrier.valid('data:image/png;base64,AA==')).toBe(true);
    // Independent review R1: each change alone must invalidate the receipt.
    for (const [key, value] of Object.entries({
      backgroundSize: '1px 1px',
      backgroundPosition: '20px 0px',
      backgroundRepeat: 'repeat',
      backgroundAttachment: 'fixed',
      backgroundOrigin: 'content-box',
      backgroundClip: 'text',
      backgroundColor: 'rgb(255, 0, 0)',
      backgroundBlendMode: 'multiply',
      backgroundImage: 'url("data:image/png;base64,AA=="), linear-gradient(red, blue)',
      marginLeft: '20px',
      marginTop: '-10px',
      visibility: 'hidden',
      overflowX: 'hidden',
      borderTopLeftRadius: '0px 20px',
      outlineWidth: '2px',
      zoom: '2',
      offsetPath: 'path("M 0 0 L 1 1")',
      animationName: 'move',
      transitionDuration: '0.5s',
      contentVisibility: 'hidden',
      pointerEvents: 'auto',
    })) {
      const before = computed[key];
      computed[key] = value;
      expect(carrier.valid('data:image/png;base64,AA=='), key).toBe(false);
      if (before === undefined) delete computed[key];
      else computed[key] = before;
      expect(carrier.valid('data:image/png;base64,AA=='), `${key} recovery`).toBe(true);
    }
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 30,
      right: 140,
      bottom: 70,
      width: 100,
      height: 40,
    } as DOMRect);
    expect(contactCarrierBounds(host)).toMatchObject({ left: 30, right: 150, top: 20, bottom: 80 });
    carrier.release();
  });
});
