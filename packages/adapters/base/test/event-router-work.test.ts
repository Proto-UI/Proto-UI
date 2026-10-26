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
  it('does not give a handled Enter to the new focused owner after its original owner retires', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/adapter-vue/__proto_instance');
    const proto = { name: 'keyboard-owner', setup: () => undefined };
    const trigger = document.createElement('div');
    const item = document.createElement('div');
    trigger.tabIndex = item.tabIndex = 0;
    document.body.append(trigger, item);
    cleanup.push(() => {
      trigger.remove();
      item.remove();
    });
    const triggerToken = tree.markProtoInstance(trigger, proto);
    const itemToken = tree.markProtoInstance(item, proto);
    tree.mergeLogicalTriggerGroup(triggerToken, triggerToken);
    tree.mergeLogicalTriggerGroup(itemToken, itemToken);
    const route = (rootEl: HTMLElement, instanceToken: typeof triggerToken) =>
      createWebProtoEventRouter({
        rootEl,
        instanceToken,
        resolveSemanticEventRoute: tree.resolveLogicalTriggerEventRouteForTarget,
        isSemanticEventRouteCandidate: tree.isLogicalEventRouteCandidate,
        isEnabled: () => true,
      });
    const triggerRouter = route(trigger, triggerToken);
    const itemRouter = route(item, itemToken);
    cleanup.push(
      () => triggerRouter.dispose(),
      () => itemRouter.dispose()
    );
    const triggerPress = vi.fn();
    const globalKey = vi.fn();
    const rootKey = vi.fn();
    const itemPress = vi.fn(() => {
      itemRouter.dispose();
      tree.unbindProtoInstance(itemToken, item);
      item.remove();
      trigger.focus();
    });
    triggerRouter.rootTarget.addEventListener('press.commit', triggerPress);
    triggerRouter.rootTarget.addEventListener('key.down', rootKey);
    triggerRouter.globalTarget.addEventListener('key.down', globalKey);
    itemRouter.rootTarget.addEventListener('press.commit', itemPress);
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(itemPress).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(globalKey).toHaveBeenCalledOnce();
    expect({
      keys: rootKey.mock.calls.length,
      presses: triggerPress.mock.calls.length,
    }).toEqual({ keys: 0, presses: 0 });
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(triggerPress).toHaveBeenCalledOnce();
    expect(rootKey).toHaveBeenCalledOnce();
    expect(globalKey).toHaveBeenCalledTimes(2);
  });

  it('does not let an unconsumed descendant key claim its enclosing press owner', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    child.tabIndex = 0;
    parent.append(child);
    document.body.append(parent);
    cleanup.push(() => parent.remove());
    const outer = createWebProtoEventRouter({ rootEl: parent, isEnabled: () => true });
    const inner = createWebProtoEventRouter({ rootEl: child, isEnabled: () => true });
    cleanup.push(
      () => outer.dispose(),
      () => inner.dispose()
    );
    const press = vi.fn();
    outer.rootTarget.addEventListener('press.commit', press);
    child.focus();
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(press).toHaveBeenCalledOnce();
  });

  it.each(['Enter', ' '])('keeps a marked child %j key with its root key.down listener', (key) => {
    const tree = createInstanceTreeMarkers('@proto.ui/adapter-vue/__proto_instance');
    const proto = { name: 'keyboard-child-owner', setup: () => undefined };
    const parent = document.createElement('div');
    const child = document.createElement('div');
    child.tabIndex = 0;
    parent.append(child);
    document.body.append(parent);
    const parentToken = tree.markProtoInstance(parent, proto);
    const childToken = tree.markProtoInstance(child, proto);
    cleanup.push(() => {
      tree.unbindProtoInstance(childToken, child);
      tree.unbindProtoInstance(parentToken, parent);
      parent.remove();
    });
    const outer = createWebProtoEventRouter({
      rootEl: parent,
      instanceToken: parentToken,
      isEnabled: () => true,
    });
    const inner = createWebProtoEventRouter({
      rootEl: child,
      instanceToken: childToken,
      isEnabled: () => true,
    });
    cleanup.push(
      () => outer.dispose(),
      () => inner.dispose()
    );
    const parentPress = vi.fn();
    const childKey = vi.fn();
    const globalKey = vi.fn();
    outer.rootTarget.addEventListener('press.commit', parentPress);
    inner.rootTarget.addEventListener('key.down', childKey);
    inner.globalTarget.addEventListener('key.down', globalKey);
    child.focus();
    child.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect({
      root: childKey.mock.calls.length,
      global: globalKey.mock.calls.length,
    }).toEqual({ root: 1, global: 1 });
  });

  it('keeps an unclaimed keyboard event eligible for its active Portal owner', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/adapter-vue/__proto_instance');
    const proto = { name: 'keyboard-portal-owner', setup: () => undefined };
    const root = document.createElement('div');
    const portal = document.createElement('div');
    const input = document.createElement('input');
    portal.append(input);
    document.body.append(root, portal);
    cleanup.push(() => {
      root.remove();
      portal.remove();
    });
    const token = tree.markProtoInstance(root, proto);
    tree.mergeLogicalTriggerGroup(token, token);
    tree.setProtoParent(portal, root);
    const router = createWebProtoEventRouter({
      rootEl: root,
      instanceToken: token,
      resolveSemanticEventRoute: tree.resolveLogicalTriggerEventRouteForTarget,
      isSemanticEventRouteCandidate: tree.isLogicalEventRouteCandidate,
      isEnabled: () => true,
    });
    cleanup.push(() => router.dispose());
    const press = vi.fn();
    router.rootTarget.addEventListener('press.commit', press);
    input.focus();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(press).toHaveBeenCalledOnce();
  });

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

  it('clears keyboard follow-up suppression when a once listener leaves no portal demand', async () => {
    const root = document.createElement('div');
    const portalButton = document.createElement('button');
    document.body.append(root, portalButton);
    cleanup.push(() => {
      root.remove();
      portalButton.remove();
    });
    const router = createWebProtoEventRouter({
      rootEl: root,
      resolveSemanticEventRoute: () => ({ matched: true, accepted: true, surface: root }),
      isEnabled: () => true,
    });
    cleanup.push(() => router.dispose());
    const once = vi.fn();
    router.rootTarget.addEventListener('press.commit', once, { once: true });

    portalButton.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    expect(once).toHaveBeenCalledTimes(1);
    portalButton.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    await Promise.resolve();

    const later = vi.fn();
    router.rootTarget.addEventListener('press.commit', later);
    portalButton.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(later).toHaveBeenCalledTimes(1);
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

  it('re-resolves the keyboard owner when the same Event is redispatched after Portal rebinding', () => {
    const tree = createInstanceTreeMarkers('@proto.ui/adapter-web-component/__proto_instance');
    const proto = { name: 'keyboard-route-owner', setup: () => undefined };
    const first = document.createElement('div');
    const second = document.createElement('div');
    const portal = document.createElement('div');
    const shadow = portal.attachShadow({ mode: 'open' });
    const source = document.createElement('span');
    shadow.append(source);
    document.body.append(first, second, portal);
    cleanup.push(() => {
      tree.setProtoParent(portal, null);
      first.remove();
      second.remove();
      portal.remove();
    });
    const keyListeners = [vi.fn(), vi.fn()];
    const pressListeners = [vi.fn(), vi.fn()];
    [first, second].forEach((root, index) => {
      const token = tree.markProtoInstance(root, proto);
      tree.mergeLogicalTriggerGroup(token, token);
      const router = createWebProtoEventRouter({
        rootEl: root,
        instanceToken: token,
        resolveSemanticEventRoute: tree.resolveLogicalTriggerEventRouteForTarget,
        isSemanticEventRouteCandidate: tree.isLogicalEventRouteCandidate,
        isEnabled: () => true,
      });
      router.rootTarget.addEventListener('key.down', keyListeners[index]);
      router.rootTarget.addEventListener('press.commit', pressListeners[index]);
      cleanup.push(() => router.dispose());
    });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true });
    tree.setProtoParent(portal, first);
    source.dispatchEvent(event);
    expect({
      keys: keyListeners.map((listener) => listener.mock.calls.length),
      presses: pressListeners.map((listener) => listener.mock.calls.length),
    }).toEqual({ keys: [1, 0], presses: [1, 0] });

    tree.setProtoParent(portal, second);
    source.dispatchEvent(event);
    expect({
      keys: keyListeners.map((listener) => listener.mock.calls.length),
      presses: pressListeners.map((listener) => listener.mock.calls.length),
    }).toEqual({ keys: [1, 1], presses: [1, 1] });
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
