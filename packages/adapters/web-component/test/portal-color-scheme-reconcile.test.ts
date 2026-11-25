import { afterEach, expect, it, vi } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { AdaptToWebComponent } from '../src';
import {
  beginWebComponentPortalViewAcquisition,
  createWebComponentPortalMount,
  registerWebComponentPortalColorScheme,
} from '../src/portal-mount';

const cleanups: Array<() => void> = [];
const settle = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
});

it.each(['default', 'custom'] as const)(
  'samples the %s reader at first portal publication without rendering or changing transitions',
  async (reader) => {
    const oldTheme = document.documentElement.getAttribute('data-theme');
    const oldClass = document.documentElement.className;
    cleanups.push(() => {
      document.documentElement.className = oldClass;
      if (oldTheme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', oldTheme);
    });
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const calls = { renders: 0, watches: 0, updated: 0 };
    const Reader = AdaptToWebComponent(
      definePrototype<{ enabled?: boolean }>({
        name: `portal-reveal-color-${reader}`,
        setup(def) {
          def.props.define({ enabled: { type: 'boolean', default: true } });
          def.props.watch(['enabled'], () => calls.watches++);
          def.lifecycle.onUpdated(() => calls.updated++);
          def.feedback.style.use(tw('bg-white transition-all'));
          def.rule({
            when: (when) =>
              when.all(when.prop('enabled').eq(true), when.meta('colorScheme').eq('dark')),
            intent: (intent) => intent.feedback.style.use(tw('bg-black')),
          });
          return (renderer) => {
            calls.renders++;
            return renderer.slot();
          };
        },
      }),
      {
        shadow: false,
        autoUpdateOnPropsChange: false,
        ...(reader === 'custom' ? { getMeta: () => 'light' } : {}),
      }
    );
    const origin = document.createElement('section');
    const portalRoot = document.createElement('div');
    const inside = new Reader();
    const outside = new Reader();
    portalRoot.append(inside);
    origin.append(portalRoot, outside);
    document.body.append(origin);
    await settle();
    const before = { ...calls };
    expect(inside.getAttribute('data-pui-style')).toContain('bg-white');

    const portal = createWebComponentPortalMount();
    cleanups.push(() => portal.unmount(portalRoot));
    const releaseAcquisition = beginWebComponentPortalViewAcquisition(portalRoot);
    let atPublication: string | null = null;
    const removeAttribute = portalRoot.removeAttribute.bind(portalRoot);
    vi.spyOn(portalRoot, 'removeAttribute').mockImplementation((name) => {
      if (name === 'data-pui-portal-preparing' && portalRoot.hasAttribute(name))
        atPublication = inside.getAttribute('data-pui-style');
      removeAttribute(name);
    });
    document.documentElement.dataset.theme = 'dark';
    try {
      portal.mount(portalRoot);
    } finally {
      releaseAcquisition();
    }
    expect(portalRoot.parentNode).toBe(document.body);
    expect(portalRoot.hasAttribute('data-pui-view-revealing')).toBe(false);
    expect(portalRoot.hasAttribute('data-pui-portal-preparing')).toBe(false);
    expect(atPublication).toContain(reader === 'default' ? 'bg-black' : 'bg-white');
    expect(inside.getAttribute('data-pui-style')).toContain('transition-all');
    // A first-presentation sample is local to the moved tree. The ordinary
    // Document source retains its asynchronous notification for other views.
    expect(outside.getAttribute('data-pui-style')).toContain('bg-white');
    expect(calls).toEqual(before);
    await settle();
    expect(outside.getAttribute('data-pui-style')).toContain(
      reader === 'default' ? 'bg-black' : 'bg-white'
    );
    expect(calls).toEqual(before);
  }
);

it('a reentrant theme sample cannot reveal a replacement projection or sample its retired tree', () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  const origin = document.createElement('section');
  const root = document.createElement('div');
  const child = document.createElement('span');
  root.append(child);
  origin.append(root);
  document.body.append(origin);
  const original = createWebComponentPortalMount();
  const replacement = createWebComponentPortalMount();
  cleanups.push(
    () => original.unmount(root),
    () => replacement.unmount(root)
  );
  const releaseAcquisition = beginWebComponentPortalViewAcquisition(root);
  const retiredChild = vi.fn();
  cleanups.push(registerWebComponentPortalColorScheme(child, retiredChild));
  cleanups.push(
    registerWebComponentPortalColorScheme(root, () => {
      releaseAcquisition();
      original.unmount(root);
      replacement.mount(root);
    })
  );

  original.mount(root);

  expect(root.parentNode).toBe(document.body);
  expect(root.getAttribute('data-pui-view-revealing')).toBe('portal');
  expect(retiredChild).not.toHaveBeenCalled();
  for (let frame = 0; frame < 2; frame++) {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(frame));
  }
  expect(root.hasAttribute('data-pui-view-revealing')).toBe(false);
});
