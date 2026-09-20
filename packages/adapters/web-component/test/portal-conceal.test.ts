import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortalConcealBarrier } from '../src/portal-conceal';
import { createWebComponentPortalMount, isWebComponentPortaled } from '../src/portal-mount';
import { AdaptToWebComponent, setElementProps } from '../src';
import { getLogicalParent } from '../src/platform/instance-tree';
import { dialogRoot, dialogContent, dialogClose } from '../../../prototypes/base/src/dialog';
import type { TransitionControls } from '../../../prototypes/base/src/transition';

describe('WC portal conceal rendering barrier', () => {
  let host: HTMLElement;
  let portal: ReturnType<typeof createWebComponentPortalMount>;
  let frames: Map<number, FrameRequestCallback>;
  let serial: number;
  const frame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  };
  beforeEach(() => {
    serial = 0;
    frames = new Map();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++serial, callback);
      return serial;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    const origin = document.createElement('div');
    host = document.createElement('div');
    origin.append(host);
    document.body.append(origin);
    portal = createWebComponentPortalMount();
  });
  afterEach(() => {
    portal.unmount(host);
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  it('does not add a frame dependency to ordinary or non-visible owners', () => {
    const barrier = createPortalConcealBarrier(host);
    expect(barrier.wait()).toBeNull();
    portal.mount(host);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    expect(barrier.wait()).toBeNull();
    expect(frames.size).toBe(0);
  });
  it('separates conceal from projection revocation by a rendering opportunity', async () => {
    portal.mount(host);
    expect(isWebComponentPortaled(host)).toBe(true);
    host.setAttribute('data-pui-view-detached', '');
    const barrier = createPortalConcealBarrier(host);
    const done = vi.fn();
    const wait = barrier.wait()!.then(done);
    frame();
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    expect(host.parentElement).toBe(document.body);
    frame();
    await wait;
    expect(done).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    portal.unmount(host);
    expect(isWebComponentPortaled(host)).toBe(false);
  });
  it.each([false, true])(
    'cancels on a newer intent or terminal disposal (after first frame=%s)',
    async (firstFrame) => {
      portal.mount(host);
      const barrier = createPortalConcealBarrier(host);
      const done = vi.fn();
      const wait = barrier.wait()!.then(done);
      const stale = [...frames.values()][0]!;
      if (firstFrame) frame();
      barrier.cancel();
      await wait;
      stale(0);
      expect(done).toHaveBeenCalledOnce();
      expect(frames.size).toBe(0);
    }
  );
  it('releases a pending barrier when the document becomes non-visible', async () => {
    portal.mount(host);
    const barrier = createPortalConcealBarrier(host);
    const wait = barrier.wait()!;
    frame();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await wait;
    expect(frames.size).toBe(0);
  });

  it('cancels an in-flight conceal barrier when its owner is adopted', async () => {
    const Owner = AdaptToWebComponent(
      {
        name: 'conceal-adopted-owner',
        setup: () => undefined,
      },
      { shadow: false }
    );
    const owner = new Owner();
    const ownerPortal = createWebComponentPortalMount();
    const origin = document.createElement('div');
    origin.append(owner);
    document.body.append(origin);
    ownerPortal.mount(owner);
    const barrier = (owner as any)._portalConceal as ReturnType<typeof createPortalConcealBarrier>;
    let settled = false;
    const wait = barrier.wait()!.then(() => {
      settled = true;
    });
    const nextDocument = document.implementation.createHTMLDocument('adopted');

    (owner as any).adoptedCallback(document, nextDocument);
    await Promise.resolve();

    expect(settled).toBe(true);
    await wait;
    ownerPortal.unmount(owner);
    owner.remove();
  });

  it('revokes a projection when renderer replacement removes its origin marker', async () => {
    const origin = host.parentElement!;
    portal.mount(host);
    expect(host.parentElement).toBe(document.body);
    expect(isWebComponentPortaled(host)).toBe(true);

    origin.replaceChildren();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(isWebComponentPortaled(host)).toBe(false);
    expect(host.isConnected).toBe(false);
    expect(origin.childNodes).toHaveLength(0);
    portal.unmount(host);
    expect(origin.childNodes).toHaveLength(0);
  });

  it('refreshes portaled ancestry when a plain origin wrapper moves between owners', async () => {
    const Parent = AdaptToWebComponent(
      { name: 'portal-reparent-owner', setup: () => undefined },
      { shadow: false }
    );
    const Child = AdaptToWebComponent(
      { name: 'portal-reparent-child', setup: () => undefined },
      { shadow: false }
    );
    const first = new Parent();
    const second = new Parent();
    const wrapper = document.createElement('div');
    const child = new Child();
    wrapper.append(child);
    first.append(wrapper);
    document.body.append(first, second);
    const childPortal = createWebComponentPortalMount();
    childPortal.mount(child);
    const childToken = (child as any)._instanceToken;
    const firstToken = (first as any)._instanceToken;
    const secondToken = (second as any)._instanceToken;
    expect(getLogicalParent(childToken)).toBe(firstToken);

    second.append(wrapper);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(child.parentElement).toBe(document.body);
    expect(getLogicalParent(childToken)).toBe(secondToken);
    childPortal.unmount(child);
  });

  it('preserves the origin element when projection fails before body insertion', () => {
    const origin = host.parentElement!;
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => {
      throw new Error('projection failed');
    });

    expect(() => portal.mount(host)).toThrow('projection failed');
    expect(host.parentElement).toBe(origin);
    expect(Array.from(origin.childNodes)).toEqual([host]);
    expect(isWebComponentPortaled(host)).toBe(false);
  });

  it.each([['first'], ['second']] as const)(
    'restores adjacent simultaneous portals in original sibling order (%s restored first)',
    (first) => {
      const origin = document.createElement('section');
      const a = document.createElement('div');
      a.id = 'a';
      const b = document.createElement('div');
      b.id = 'b';
      const c = document.createElement('div');
      c.id = 'c';
      origin.append(a, b, c);
      document.body.append(origin);
      const portalA = createWebComponentPortalMount();
      const portalB = createWebComponentPortalMount();

      portalA.mount(a);
      portalB.mount(b);
      expect([...origin.children].map((node) => node.id)).toEqual(['c']);
      if (first === 'first') {
        portalA.unmount(a);
        portalB.unmount(b);
      } else {
        portalB.unmount(b);
        portalA.unmount(a);
      }
      expect([...origin.children].map((node) => node.id)).toEqual(['a', 'b', 'c']);
    }
  );

  it('a newer open retains the epoch, while terminal removal cancels pending work', async () => {
    const calls = { mounted: 0, unmounted: 0, disposed: 0 };
    const Root = AdaptToWebComponent(dialogRoot, { registerAs: 'conceal-dialog-root' });
    const Content = AdaptToWebComponent(dialogContent, {
      registerAs: 'conceal-dialog-content',
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'mount.mounted') calls.mounted++;
          if (event.type === 'unmount.done') calls.unmounted++;
          if (event.type === 'instance.dispose.done') calls.disposed++;
        },
      },
    });
    const Close = AdaptToWebComponent(dialogClose, { registerAs: 'conceal-dialog-close' });
    const root = new Root(),
      content = new Content();
    content.append(new Close());
    root.append(content);
    const flush = async () => {
      for (let i = 0; i < 12; i++) await Promise.resolve();
    };
    setElementProps(root, { open: true });
    document.body.append(root);
    await flush();
    expect(content.parentElement).toBe(document.body);
    setElementProps(root, { open: false });
    (content.getExposes().controls as TransitionControls).complete();
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(calls).toEqual({ mounted: 1, unmounted: 0, disposed: 0 });

    setElementProps(root, { open: true });
    await flush();
    frame();
    frame();
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(calls).toEqual({ mounted: 1, unmounted: 0, disposed: 0 });

    setElementProps(root, { open: false });
    (content.getExposes().controls as TransitionControls).complete();
    await flush();
    root.remove();
    await flush();
    frame();
    frame();
    await flush();
    expect(content.isConnected).toBe(false);
    expect(calls).toEqual({ mounted: 1, unmounted: 1, disposed: 1 });
    expect(isWebComponentPortaled(content)).toBe(false);
    expect(frames.size).toBe(0);
  });
});
