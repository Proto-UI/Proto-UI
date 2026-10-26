import { afterEach, expect, it, vi } from 'vitest';
import { registerWebPortalDestination, isWebPortalMaterialSuspended } from '@proto.ui/adapter-base';
import { createWebComponentPortalMount, isWebComponentPortaled } from '../src/portal-mount';

const releases: Array<() => void> = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const release of releases.splice(0).reverse()) release();
  document.body.replaceChildren();
});
const retain = (release: () => void) => (releases.push(release), release);

it('a direct body child selects its registered body scene and retains focus until release', () => {
  const host = document.createElement('button');
  const destination = document.createElement('div');
  const next = document.createElement('div');
  const sibling = document.createElement('span');
  document.body.append(host, sibling, destination, next);
  retain(registerWebPortalDestination(document.body, destination));
  const mount = createWebComponentPortalMount();
  retain(() => mount.unmount(host));
  mount.mount(host);
  expect(host.parentNode).toBe(destination);
  expect(isWebComponentPortaled(host)).toBe(true);
  expect(isWebPortalMaterialSuspended(host)).toBe(false);
  host.focus();
  let blurs = 0;
  host.addEventListener('blur', () => blurs++);
  retain(registerWebPortalDestination(document.body, next));
  expect(host.parentNode).toBe(destination);
  expect(document.activeElement).toBe(host);
  expect(blurs).toBe(0);
  expect(isWebPortalMaterialSuspended(host)).toBe(true);
  mount.unmount(host);
  expect(host.parentNode).toBe(document.body);
  expect(host.nextSibling).toBe(sibling);
  expect(isWebComponentPortaled(host)).toBe(false);
  mount.mount(host);
  expect(host.parentNode).toBe(next);
  mount.unmount(host);
  expect([...document.body.childNodes]).toEqual([host, sibling, destination, next]);
});

for (const invalid of ['unregistered', 'disconnected', 'foreign', 'cycle', 'same-scope'] as const) {
  it(`direct body children preserve the body fallback for ${invalid} destinations`, () => {
    const host = document.createElement('button');
    const destination = document.createElement('div');
    document.body.append(host);
    let target: HTMLElement = destination;
    if (invalid === 'foreign') {
      const iframe = document.createElement('iframe');
      document.body.append(iframe);
      target = iframe.contentDocument!.body;
    } else if (invalid === 'cycle') host.append(destination);
    else if (invalid === 'same-scope') target = document.body;
    if (invalid !== 'unregistered') retain(registerWebPortalDestination(document.body, target));
    host.focus();
    const mount = createWebComponentPortalMount();
    retain(() => mount.unmount(host));
    mount.mount(host);
    expect(host.parentNode).toBe(document.body);
    expect(document.activeElement).toBe(host);
    expect(isWebComponentPortaled(host)).toBe(false);
    mount.unmount(host);
    expect(document.body.contains(host)).toBe(true);
  });
}

it('the real WC Adapter binds a direct body overlay and retires it without leaking its marker', async () => {
  const { definePrototype } = await import('@proto.ui/core');
  const { asFocusable, asOverlay } = await import('@proto.ui/hooks');
  const { AdaptToWebComponent } = await import('../src');
  const destination = document.createElement('div');
  const next = document.createElement('div');
  document.body.append(destination, next);
  retain(registerWebPortalDestination(document.body, destination));
  const counts = { setup: 0, disposed: 0 };
  const Content = AdaptToWebComponent(
    definePrototype({
      name: 'direct-body-destination-integration',
      setup(def) {
        counts.setup++;
        const focus = asFocusable();
        const overlay = asOverlay();
        overlay.configure({ defaultOpen: true, portal: true, entry: 'manual', restore: 'none' });
        def.expose('actions', {
          focus: () => focus.focusSelf(),
          close: () => overlay.close(),
          open: () => overlay.openOverlay(),
        });
        def.lifecycle.onBeforeDispose(() => counts.disposed++);
        return () => 'Direct body overlay';
      },
    }),
    { shadow: false }
  );
  const host = new Content();
  retain(() => host.remove());
  const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  document.body.append(host);
  await flush();
  expect(host.parentNode).toBe(destination);
  expect(isWebComponentPortaled(host)).toBe(true);
  const actions = (host as any).getExposes().actions;
  actions.focus();
  expect(document.activeElement).toBe(host);
  let blurs = 0;
  host.addEventListener('blur', () => blurs++);
  retain(registerWebPortalDestination(document.body, next));
  await flush();
  expect(host.parentNode).toBe(destination);
  expect(document.activeElement).toBe(host);
  expect(blurs).toBe(0);
  expect(isWebPortalMaterialSuspended(host)).toBe(true);
  actions.close();
  await flush();
  // A destination change belongs to the next physical view epoch.
  await vi.waitFor(() => expect(isWebComponentPortaled(host)).toBe(false));
  actions.open();
  await flush();
  expect(host.parentNode).toBe(next);
  expect(counts).toEqual({ setup: 1, disposed: 0 });
  host.remove();
  await flush();
  expect(counts).toEqual({ setup: 1, disposed: 1 });
  expect(isWebComponentPortaled(host)).toBe(false);
  expect([...document.body.childNodes]).toEqual([destination, next]);
});

for (const reentry of ['same-mount', 'different-mount', 'replace-policy'] as const) {
  it(`body policy preflight cannot supersede ${reentry} during a computed-style read`, () => {
    const host = document.createElement('button');
    const first = document.createElement('div');
    const next = document.createElement('div');
    document.body.append(host, first, next);
    retain(registerWebPortalDestination(document.body, first));
    const outer = createWebComponentPortalMount();
    const inner = reentry === 'same-mount' ? outer : createWebComponentPortalMount();
    retain(() => outer.unmount(host));
    retain(() => inner.unmount(host));
    const computed = window.getComputedStyle.bind(window);
    let entered = false;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node, pseudo) => {
      if (!entered) {
        entered = true;
        retain(registerWebPortalDestination(document.body, next));
        if (reentry !== 'replace-policy') inner.mount(host);
      }
      return computed(node, pseudo);
    });
    outer.mount(host);
    expect(entered).toBe(true);
    expect(host.parentNode).toBe(next);
    expect(isWebComponentPortaled(host)).toBe(true);
    expect([...document.body.childNodes].filter((node) => node.nodeType === 8)).toHaveLength(1);
    outer.unmount(host);
    if (reentry === 'different-mount') {
      expect(host.parentNode).toBe(next);
      expect(isWebComponentPortaled(host)).toBe(true);
    }
    inner.unmount(host);
    expect(host.parentNode).toBe(document.body);
    expect([...document.body.childNodes]).toEqual([host, first, next]);
    expect(isWebComponentPortaled(host)).toBe(false);
  });
}
