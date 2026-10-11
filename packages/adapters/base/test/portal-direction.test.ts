import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { retainWebPortalDirection } from '../src/platform/portal-direction';

// happy-dom omits the browser's HTML dir presentation rule. Supply that
// isolated UA-equivalent fixture; native direction evidence remains in the
// actual browser journey, not in these simulated-DOM ownership controls.
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '[dir="rtl"] { direction: rtl; } [dir="ltr"] { direction: ltr; }';
  document.head.append(style);
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.body.removeAttribute('dir');
});

function fixture() {
  const owner = document.createElement('div');
  const origin = document.createElement('span');
  const target = document.createElement('div');
  owner.dir = 'rtl';
  owner.append(origin);
  document.body.dir = 'ltr';
  document.body.append(owner, target);
  return { owner, origin, target };
}

describe('Web portal direction projection lease', () => {
  // happy-dom does not invalidate its computed-style cache on viewport changes.
  // Control only that host read here; native @media assertions live in
  // overlay-portal-direction.browser.test.ts and require a real browser run.
  function responsiveFixture() {
    const { origin, target } = fixture();
    let direction = 'ltr';
    const computed = window.getComputedStyle.bind(window);
    const read = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element) =>
        element === origin ? ({ direction } as CSSStyleDeclaration) : computed(element)
      );
    return {
      origin,
      target,
      read,
      resize(next: string) {
        direction = next;
        window.dispatchEvent(new Event('resize'));
      },
    };
  }

  it('refreshes on viewport resize without ancestor mutations and avoids duplicate writes', async () => {
    const { origin, target, resize } = responsiveFixture();
    const write = vi.spyOn(target, 'setAttribute');
    const release = retainWebPortalDirection(target, () => origin);
    try {
      await settle();
      expect(target.dir).toBe('ltr');
      resize('rtl');
      expect(target.dir).toBe('rtl');
      resize('rtl');
      expect(write).toHaveBeenCalledTimes(2);
      resize('ltr');
      expect(target.dir).toBe('ltr');
      expect(write).toHaveBeenCalledTimes(3);
    } finally {
      release();
    }
  });

  it.each(['ltr', 'rtl', 'auto'])('keeps author %s through viewport changes', (dir) => {
    const { origin, target, resize } = responsiveFixture();
    target.setAttribute('dir', dir);
    const release = retainWebPortalDirection(target, () => origin);
    try {
      resize('rtl');
      resize('ltr');
      expect(target.getAttribute('dir')).toBe(dir);
    } finally {
      release();
    }
    expect(target.getAttribute('dir')).toBe(dir);
  });

  it('drains pending author ownership before resize and preserves it on release', () => {
    const { origin, target, resize } = responsiveFixture();
    const release = retainWebPortalDirection(target, () => origin);
    try {
      target.dir = 'ltr'; // Same-valued author write before observer delivery.
      resize('rtl');
      expect(target.dir).toBe('ltr');
    } finally {
      release();
    }
    expect(target.dir).toBe('ltr');
  });

  it('removes the viewport listener and cannot write after release', () => {
    const { origin, target, resize, read } = responsiveFixture();
    target.setAttribute('dir', '');
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const release = retainWebPortalDirection(target, () => origin);
    const listener = add.mock.calls.find(([type]) => type === 'resize')?.[1];
    release();
    release();
    expect(listener).toEqual(expect.any(Function));
    expect(remove).toHaveBeenCalledWith('resize', listener);
    expect(target.getAttribute('dir')).toBe('');
    read.mockClear();
    resize('rtl');
    (listener as EventListener)(new Event('resize'));
    expect(read).not.toHaveBeenCalled();
    expect(target.getAttribute('dir')).toBe('');
  });

  it('inherits actual author ancestry, updates both ways and releases only owned dir', async () => {
    const { owner, origin, target } = fixture();
    const release = retainWebPortalDirection(target, () => origin);
    expect(target.dir).toBe('rtl');
    owner.dir = 'ltr';
    await settle();
    expect(target.dir).toBe('ltr');
    owner.dir = 'rtl';
    await settle();
    expect(target.dir).toBe('rtl');
    release();
    release();
    expect(target.hasAttribute('dir')).toBe(false);
    owner.dir = 'ltr';
    await settle();
    expect(target.hasAttribute('dir')).toBe(false);
  });

  it.each(['ltr', 'rtl', 'auto'])('never captures or removes authored %s', async (dir) => {
    const { owner, origin, target } = fixture();
    target.setAttribute('dir', dir);
    const release = retainWebPortalDirection(target, () => origin);
    owner.dir = 'ltr';
    await settle();
    expect(target.getAttribute('dir')).toBe(dir);
    release();
    expect(target.getAttribute('dir')).toBe(dir);
  });

  it('preserves an author override before observer delivery and reacquires after removal', async () => {
    const { owner, origin, target } = fixture();
    const release = retainWebPortalDirection(target, () => origin);
    target.dir = 'ltr';
    owner.dir = 'ltr';
    await settle();
    owner.dir = 'rtl';
    await settle();
    expect(target.dir).toBe('ltr');
    target.removeAttribute('dir');
    await settle();
    expect(target.dir).toBe('rtl');
    // Same-valued author writes still transfer ownership, before cleanup.
    target.dir = 'rtl';
    release();
    expect(target.dir).toBe('rtl');
  });

  it('migrates the origin ancestry and stops following the old tree', async () => {
    const { owner, origin, target } = fixture();
    const other = document.createElement('section');
    other.dir = 'ltr';
    document.body.append(other);
    const release = retainWebPortalDirection(target, () => origin);
    other.append(origin);
    await settle();
    expect(target.dir).toBe('ltr');
    owner.dir = 'ltr';
    other.dir = 'rtl';
    await settle();
    expect(target.dir).toBe('rtl');
    owner.dir = 'rtl';
    other.dir = 'ltr';
    await settle();
    expect(target.dir).toBe('ltr');
    release();
    expect(target.hasAttribute('dir')).toBe(false);
  });

  it('retains nested local ltr scopes and independent nested portal leases', async () => {
    const { owner, origin, target } = fixture();
    const local = document.createElement('div');
    local.dir = 'ltr';
    local.append(origin);
    owner.append(local);
    const nestedOrigin = document.createElement('span');
    target.append(nestedOrigin);
    const nested = document.createElement('div');
    document.body.append(nested);
    const outerRelease = retainWebPortalDirection(target, () => origin);
    const innerRelease = retainWebPortalDirection(nested, () => nestedOrigin);
    expect([target.dir, nested.dir]).toEqual(['ltr', 'ltr']);
    local.dir = 'rtl';
    await settle();
    await settle();
    expect([target.dir, nested.dir]).toEqual(['rtl', 'rtl']);
    innerRelease();
    outerRelease();
    expect([nested.getAttribute('dir'), target.getAttribute('dir')]).toEqual([null, null]);
  });

  it('projects direction as an attribute without overriding host CSS', async () => {
    const { origin, target } = fixture();
    target.style.direction = 'ltr';
    const release = retainWebPortalDirection(target, () => origin);
    expect(target.dir).toBe('rtl');
    expect(target.style.direction).toBe('ltr');
    release();
    expect(target.style.direction).toBe('ltr');
  });

  it('observes CSS origin changes, restores invalid author input and does not self-loop', async () => {
    const { owner, origin, target } = fixture();
    target.setAttribute('dir', '');
    owner.style.direction = 'rtl';
    const write = vi.spyOn(target, 'setAttribute');
    const release = retainWebPortalDirection(target, () => origin);
    await settle();
    await settle();
    expect(write).toHaveBeenCalledTimes(1);
    owner.style.direction = 'ltr';
    await settle();
    expect(target.dir).toBe('ltr');
    await settle();
    expect(write).toHaveBeenCalledTimes(2);
    release();
    expect(target.getAttribute('dir')).toBe('');
  });
});
