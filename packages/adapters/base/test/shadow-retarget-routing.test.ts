import { afterEach, describe, expect, it } from 'vitest';
import { createWebProtoEventRouter } from '../src/events/web-event-router';

const cleanup: (() => void)[] = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((fn) => fn())
);
const pairs = [
  ['click', 'press.commit'],
  ['pointerdown', 'pointer.down'],
  ['pointerup', 'pointer.up'],
  ['pointercancel', 'pointer.cancel'],
  ['contextmenu', 'context.menu'],
] as const;

function fixture(depth = 1) {
  const shell = document.createElement('div');
  document.body.append(shell);
  cleanup.push(() => shell.remove());
  let tree: Node = shell.attachShadow({ mode: 'open' });
  for (let i = 1; i < depth; i++) {
    const host = document.createElement('div');
    tree.appendChild(host);
    tree = host.attachShadow({ mode: 'open' });
  }
  const root = document.createElement('div');
  tree.appendChild(root);
  // Happy DOM omits the browser's outer-listener target retargeting. Model only
  // that native boundary, preserving the real dispatch order and composed path.
  const retarget = (event: Event) =>
    Object.defineProperty(event, 'target', { configurable: true, value: shell });
  for (const [native] of pairs) window.addEventListener(native, retarget);
  cleanup.push(() => {
    for (const [native] of pairs) window.removeEventListener(native, retarget);
  });
  const owners = new Map<EventTarget, HTMLElement>();
  owners.set(root, root);
  const routerFor = (element: HTMLElement) => {
    const router = createWebProtoEventRouter({
      rootEl: element,
      isEnabled: () => true,
      resolveEventRouteOwner: (node) => (node ? (owners.get(node) ?? null) : null),
    });
    cleanup.push(() => router.dispose());
    return router;
  };
  return { shell, root, owners, routerFor };
}
function dispatch(target: HTMLElement, type: string) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, detail: 1 }));
}

describe('C-EVENT-0003-E: retargeted physical root events are not portal fallbacks', () => {
  it.each(pairs)('routes %s through the physical root once', (native, semantic) => {
    const f = fixture();
    const router = f.routerFor(f.root);
    let calls = 0;
    router.rootTarget.addEventListener(semantic, () => calls++);
    dispatch(f.root, native);
    expect(calls).toBe(1);
  });
  it('preserves independent controls sharing one owner across nested open shadows', () => {
    const f = fixture(2);
    const router = f.routerFor(f.root);
    let calls = 0;
    router.rootTarget.addEventListener('press.commit', () => calls++);
    for (let i = 0; i < 2; i++) {
      const control = document.createElement('button');
      f.root.append(control);
      f.owners.set(control, f.root);
      dispatch(control, 'click');
      expect(calls).toBe(i + 1);
    }
  });
  it('routes a descendant owner only to its own root', () => {
    const f = fixture(2);
    const child = document.createElement('button');
    f.root.append(child);
    f.owners.set(child, child);
    const parentRouter = f.routerFor(f.root),
      childRouter = f.routerFor(child);
    let parentCalls = 0,
      childCalls = 0;
    parentRouter.rootTarget.addEventListener('press.commit', () => parentCalls++);
    childRouter.rootTarget.addEventListener('press.commit', () => childCalls++);
    dispatch(child, 'click');
    expect(childCalls).toBe(1);
    expect(parentCalls).toBe(0);
  });
  it('does not suppress later redispatch of the same Event through a Portal or the root', () => {
    const f = fixture();
    const portal = document.createElement('button');
    document.body.append(portal);
    cleanup.push(() => portal.remove());
    f.owners.set(portal, f.root);
    const router = f.routerFor(f.root);
    let calls = 0;
    router.rootTarget.addEventListener('press.commit', () => calls++);
    const event = new MouseEvent('click', { bubbles: true, composed: true, detail: 1 });
    f.root.dispatchEvent(event);
    expect(calls).toBe(1);
    portal.dispatchEvent(event);
    expect(calls).toBe(2);
    f.root.dispatchEvent(event);
    expect(calls).toBe(3);
  });
  it.each(pairs)(
    'retains real external portal %s fallback when the path excludes the owner root',
    (native, semantic) => {
      const f = fixture();
      const portal = document.createElement('button');
      document.body.append(portal);
      cleanup.push(() => portal.remove());
      f.owners.set(portal, f.root);
      const router = f.routerFor(f.root);
      let calls = 0;
      router.rootTarget.addEventListener(semantic, () => calls++);
      dispatch(portal, native);
      expect(calls).toBe(1);
    }
  );
});
