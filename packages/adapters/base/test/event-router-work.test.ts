import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';
import { createInstanceTreeMarkers } from '../src/platform/instance-tree';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn());
  vi.restoreAllMocks();
});

describe('event route traversal work', () => {
  it('snapshots once/signal options at binding time like the native EventTarget', () => {
    const root = document.createElement('div');
    const target = document.createElement('div');
    document.body.append(target);
    cleanup.push(() => target.remove());
    const resolve = vi.fn(() => ({ matched: true as const, accepted: true, surface: root }));
    const router = createWebProtoEventRouter({
      rootEl: root,
      resolveSemanticEventRoute: resolve,
      isEnabled: () => true,
    });
    cleanup.push(() => router.dispose());
    const options = { once: true, signal: new AbortController().signal };
    const cb = vi.fn();
    router.rootTarget.addEventListener('press.commit', cb, options);
    options.once = false;
    target.click();
    resolve.mockClear();
    target.click();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
  });
  it('bounds ancestor reads by path depth, not its square, for unrelated routers', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/test/route-work');
    const outer = document.createElement('div');
    document.body.append(outer);
    cleanup.push(() => outer.remove());
    let target = outer;
    const depth = 24;
    for (let i = 0; i < depth; i++) {
      const child = document.createElement('div');
      target.append(child);
      target = child;
    }
    const count = 40;
    for (let i = 0; i < count; i++) {
      const router = createWebProtoEventRouter({
        rootEl: document.createElement('div'),
        resolveSemanticEventRoute: tree.resolveLogicalTriggerEventRouteForTarget,
        isEnabled: () => true,
      });
      router.rootTarget.addEventListener('pointer.down', () => undefined);
      cleanup.push(() => router.dispose());
    }
    // Deterministic work budget, not a machine-dependent duration threshold.
    const reads = vi.spyOn(Node.prototype, 'parentNode', 'get');
    target.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    // Includes Happy DOM's contains/composedPath/event-dispatch ancestor reads.
    expect(reads.mock.calls.length).toBeLessThan(count * (depth + 8) * 10);
  });

  it('does not resolve unconsumed global fallback events, including after removal', () => {
    const root = document.createElement('div');
    const target = document.createElement('div');
    document.body.append(target);
    cleanup.push(() => target.remove());
    const resolve = vi.fn(() => ({ matched: true as const, accepted: true, surface: root }));
    const router = createWebProtoEventRouter({
      rootEl: root,
      resolveSemanticEventRoute: resolve,
      isEnabled: () => true,
    });
    cleanup.push(() => router.dispose());
    const click = () => target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    click();
    expect(resolve).not.toHaveBeenCalled();
    const first = vi.fn(),
      second = vi.fn();
    router.rootTarget.addEventListener('press.commit', first);
    router.rootTarget.addEventListener('press.commit', second);
    click();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    router.rootTarget.removeEventListener('press.commit', first);
    click();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    router.rootTarget.removeEventListener('press.commit', second);
    resolve.mockClear();
    click();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('tracks once, abort, duplicate callbacks, capture and disposal without stale demand', () => {
    const root = document.createElement('div');
    const target = document.createElement('div');
    document.body.append(target);
    cleanup.push(() => target.remove());
    const resolve = vi.fn(() => ({ matched: true as const, accepted: true, surface: root }));
    const router = createWebProtoEventRouter({
      rootEl: root,
      resolveSemanticEventRoute: resolve,
      isEnabled: () => true,
    });
    cleanup.push(() => router.dispose());
    const click = () => target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const listener = vi.fn();
    router.rootTarget.addEventListener('press.commit', listener, { once: true });
    click();
    resolve.mockClear();
    click();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
    const abort = new AbortController();
    router.rootTarget.addEventListener('press.commit', listener, { signal: abort.signal });
    abort.abort();
    click();
    expect(resolve).not.toHaveBeenCalled();
    router.rootTarget.addEventListener('press.commit', listener);
    router.rootTarget.addEventListener('press.commit', listener);
    router.rootTarget.addEventListener('press.commit', listener, true);
    click();
    expect(listener).toHaveBeenCalledTimes(3);
    router.rootTarget.removeEventListener('press.commit', listener, { capture: true });
    click();
    expect(listener).toHaveBeenCalledTimes(4);
    router.dispose();
    resolve.mockClear();
    click();
    expect(resolve).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it.each(['pointerdown', 'pointermove', 'pointerup', 'click', 'keydown'])(
    'rejects unrelated official roots before full resolution (%s)',
    (type) => {
      const tree = createInstanceTreeMarkers('@proto.ui/test/route-candidate');
      const root = document.createElement('div');
      const source = document.createElement('textarea');
      document.body.append(source);
      cleanup.push(() => source.remove());
      const resolve = vi.fn(tree.resolveLogicalTriggerEventRouteForTarget);
      for (let i = 0; i < 100; i++) {
        const router = createWebProtoEventRouter({
          rootEl: root.cloneNode() as HTMLElement,
          resolveSemanticEventRoute: resolve,
          isSemanticEventRouteCandidate: tree.isLogicalEventRouteCandidate,
          isEnabled: () => true,
        });
        for (const event of [
          'pointer.down',
          'pointer.move',
          'pointer.up',
          'press.commit',
          'key.down',
        ])
          router.rootTarget.addEventListener(event, () => undefined);
        cleanup.push(() => router.dispose());
      }
      const event =
        type === 'click'
          ? new MouseEvent(type, { bubbles: true })
          : type === 'keydown'
            ? new KeyboardEvent(type, { bubbles: true, key: 'Enter' })
            : new Event(type, { bubbles: true, composed: true });
      source.dispatchEvent(event);
      expect(resolve).not.toHaveBeenCalled();
    }
  );

  it('rechecks Portal links synchronously even when the same Event is redispatched', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/adapter-web-component/__proto_instance');
    const proto = { name: 'route-owner', setup: () => undefined };
    const first = document.createElement('div'),
      second = document.createElement('div');
    const portal = document.createElement('div');
    const shadow = portal.attachShadow({ mode: 'open' });
    const source = document.createElement('span');
    shadow.append(source);
    document.body.append(first, second, portal);
    cleanup.push(() => {
      first.remove();
      second.remove();
      portal.remove();
    });
    const listeners = [vi.fn(), vi.fn()];
    [first, second].forEach((root, i) => {
      const token = tree.markProtoInstance(root, proto);
      tree.mergeLogicalTriggerGroup(token, token);
      const router = createWebProtoEventRouter({
        rootEl: root,
        instanceToken: token,
        resolveSemanticEventRoute: tree.resolveLogicalTriggerEventRouteForTarget,
        isSemanticEventRouteCandidate: tree.isLogicalEventRouteCandidate,
        isEnabled: () => true,
      });
      router.rootTarget.addEventListener('press.commit', listeners[i]);
      cleanup.push(() => router.dispose());
    });
    tree.setProtoParent(portal, first);
    const event = new MouseEvent('click', { bubbles: true, composed: true, detail: 1 });
    source.dispatchEvent(event);
    expect(listeners.map((fn) => fn.mock.calls.length)).toEqual([1, 0]);
    tree.setProtoParent(portal, second);
    source.dispatchEvent(event);
    expect(listeners.map((fn) => fn.mock.calls.length)).toEqual([1, 1]);
    tree.setProtoParent(portal, null);
    source.dispatchEvent(event);
    expect(listeners.map((fn) => fn.mock.calls.length)).toEqual([1, 1]);
  });

  it('retains slot-path candidates, rejects superseded trigger surfaces, and observes rebind', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/adapter-web-component/__proto_instance');
    const proto = { name: 'route-slot', setup: () => undefined };
    const shell = document.createElement('div');
    const parent = document.createElement('div'),
      child = document.createElement('button');
    const slot = document.createElement('slot');
    child.append(slot);
    parent.append(child);
    shell.attachShadow({ mode: 'open' }).append(parent);
    const label = document.createElement('span');
    shell.append(label);
    document.body.append(shell);
    cleanup.push(() => shell.remove());
    const parentToken = tree.markProtoInstance(parent, proto),
      token = tree.markProtoInstance(child, proto);
    tree.bindLogicalParent(token, parentToken);
    tree.mergeLogicalTriggerGroup(parentToken, parentToken);
    tree.mergeLogicalTriggerGroup(token, parentToken);
    const router = createWebProtoEventRouter({
      rootEl: child,
      instanceToken: token,
      resolveSemanticEventRoute: tree.resolveLogicalTriggerEventRouteForTarget,
      isSemanticEventRouteCandidate: tree.isLogicalEventRouteCandidate,
      isEnabled: () => true,
    });
    cleanup.push(() => router.dispose());
    const commit = vi.fn();
    router.rootTarget.addEventListener('press.commit', commit);
    // Happy DOM slot paths differ from Chromium; exact open composed path is
    // also exercised by the existing real-browser split/mixed journeys.
    const dispatch = (path: EventTarget[]) => {
      const event = new MouseEvent('click', { detail: 1 });
      Object.defineProperty(event, 'composedPath', { value: () => path });
      window.dispatchEvent(event);
    };
    dispatch([label, slot, child, parent, shell, document, window]);
    expect(commit).toHaveBeenCalledTimes(1);
    dispatch([parent, shell, document, window]);
    expect(commit).toHaveBeenCalledTimes(1);
    tree.unbindProtoInstance(token, child);
    dispatch([label, slot, child, parent, shell, document, window]);
    expect(commit).toHaveBeenCalledTimes(1);
    tree.markProtoInstance(child, proto, token);
    dispatch([label, slot, child, parent, shell, document, window]);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
