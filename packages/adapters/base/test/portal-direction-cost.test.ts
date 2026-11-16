import { afterEach, describe, expect, it, vi } from 'vitest';
import { retainWebPortalDirection } from '../src/platform/portal-direction';

const releases: Array<() => void> = [];
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function fixture() {
  const origin = document.createElement('div');
  origin.setAttribute('dir', 'rtl');
  origin.setAttribute('class', 'author-scope');
  origin.style.direction = 'rtl';
  const target = document.createElement('div');
  document.body.append(origin, target);
  const release = retainWebPortalDirection(target, () => origin);
  releases.push(release);
  expect(target.dir).toBe('rtl');
  return { origin, target, release };
}

describe('portal direction source invalidation cost', () => {
  it.each(['dir', 'class', 'style'] as const)(
    'does not recompute direction for a same-valued source %s write',
    async (attribute) => {
      const { origin, target } = fixture();
      await settle();
      const read = vi.spyOn(window, 'getComputedStyle');
      origin.setAttribute(attribute, origin.getAttribute(attribute)!);
      await settle();
      expect(read).not.toHaveBeenCalled();
      expect(target.dir).toBe('rtl');
      origin.style.direction = 'ltr';
      await settle();
      expect(read).toHaveBeenCalled();
      expect(target.dir).toBe('ltr');
    }
  );

  it('keeps real source changes when the same delivery also contains unchanged attributes', async () => {
    const { origin, target } = fixture();
    origin.setAttribute('class', origin.className);
    origin.style.direction = 'ltr';
    await settle();
    expect(target.dir).toBe('ltr');
    origin.style.direction = 'rtl';
    origin.setAttribute('style', origin.getAttribute('style')!);
    await settle();
    expect(target.dir).toBe('rtl');
  });

  it('keeps structural invalidations that can change computed direction without ancestry changes', async () => {
    const { origin, target } = fixture();
    // Control only the native computed-style answer for a :empty/:has-like
    // dependency; this verifies invalidation, not a native CSS cascade result.
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) =>
      element === origin
        ? ({ direction: origin.childElementCount ? 'ltr' : 'rtl' } as CSSStyleDeclaration)
        : getComputedStyle(element, pseudo)
    );
    origin.append(document.createElement('span'));
    await settle();
    expect(target.dir).toBe('ltr');
    origin.replaceChildren();
    await settle();
    expect(target.dir).toBe('rtl');
  });

  it('retains a same-valued author dir write even beside a no-op source write', async () => {
    const { origin, target, release } = fixture();
    target.dir = 'rtl';
    origin.setAttribute('class', origin.className);
    await settle();
    origin.style.direction = 'ltr';
    await settle();
    expect(target.dir).toBe('rtl');
    release();
    expect(target.dir).toBe('rtl');
  });
});
