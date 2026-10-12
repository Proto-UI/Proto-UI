import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as drawer from '../../src/drawer';
import { definePrototype } from '@proto.ui/core';
import { DRAWER_FAMILY } from '../../src/drawer/shared';
for (const prototype of [
  drawer.drawerRoot,
  drawer.drawerContent,
  drawer.drawerMask,
  drawer.drawerTrigger,
  drawer.drawerClose,
])
  AdaptToWebComponent(prototype);
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(async () => {
  roots.splice(0).forEach((root) => root.remove());
  await flush();
});
const exposes = (element: HTMLElement) => (element as any).getExposes();
function mount(rootProps: Record<string, unknown> = { defaultOpen: true }, withContent = true) {
  const root = document.createElement(drawer.drawerRoot.name);
  const mask = document.createElement(drawer.drawerMask.name);
  const trigger = document.createElement(drawer.drawerTrigger.name);
  trigger.textContent = 'Open';
  setElementProps(root, rootProps);
  setElementProps(mask, { enterDuration: 0, leaveDuration: 0 });
  root.append(trigger, mask);
  let content: HTMLElement | undefined;
  if (withContent) {
    content = document.createElement(drawer.drawerContent.name);
    setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
    const close = document.createElement(drawer.drawerClose.name);
    close.textContent = 'Close';
    content.append(close);
    root.append(content);
  }
  roots.push(root);
  document.body.append(root);
  return { root, mask, trigger, content: content! };
}
it('keeps pending controlled logical open without Mask activation or a false openChange', async () => {
  const p = mount({ open: true }, false);
  const requests: unknown[] = [];
  p.root.addEventListener('openChange', (event) => requests.push(event));
  await flush();
  expect(exposes(p.root).open.get()).toBe(true);
  await vi.waitFor(() => expect(exposes(p.mask).isPresent.get()).toBe(false));
  expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
  expect(requests).toEqual([]);
});
it('retains Content admission through ordinary close and reopen', async () => {
  const p = mount();
  await flush();
  expect(exposes(p.content).isPresent.get()).toBe(true);
  exposes(p.root).close();
  await flush();
  await vi.waitFor(() => expect(exposes(p.content).isPresent.get()).toBe(false));
  await vi.waitFor(() => expect(exposes(p.mask).isPresent.get()).toBe(false));
  exposes(p.root).openDrawer();
  await flush();
  expect(exposes(p.content).isPresent.get()).toBe(true);
  expect(exposes(p.mask).isPresent.get()).toBe(true);
  expect(p.trigger.getAttribute('aria-expanded')).toBe('true');
});
it('releases admission on actual Content disposal without changing controlled open', async () => {
  const p = mount({ open: true });
  await flush();
  expect(exposes(p.mask).isPresent.get()).toBe(true);
  p.content.remove();
  await flush();
  expect(exposes(p.root).open.get()).toBe(true);
  await vi.waitFor(() => expect(exposes(p.mask).isPresent.get()).toBe(false));
  expect(p.trigger.getAttribute('aria-expanded')).toBe('false');
});
it('invalidates old release generations while accepting a replacement declaration', async () => {
  const p = mount({ open: true }, false);
  await flush();
  const api = exposes(p.root);
  const first = api.__admitContent('first');
  api.__releaseContent('first', first);
  const second = api.__admitContent('second');
  api.__releaseContent('first', first);
  await flush();
  expect(exposes(p.mask).isPresent.get()).toBe(true);
  api.__releaseContent('second', second);
  await flush();
  await vi.waitFor(() => expect(exposes(p.mask).isPresent.get()).toBe(false));
});
it('rejects a distinct second admission and preserves the first Content', async () => {
  const p = mount();
  await flush();
  expect(() => exposes(p.root).__admitContent('second')).toThrow('Only one live Content');
  expect(exposes(p.content).isPresent.get()).toBe(true);
  expect(exposes(p.mask).isPresent.get()).toBe(true);
});
it('retains last-valid admission for invalid updates while normally closed', async () => {
  const p = mount();
  await flush();
  exposes(p.root).close();
  await flush();
  setElementProps(p.content, { minExtent: { unit: 'bad', value: 4 } });
  await flush();
  expect(exposes(p.content).extentValid.get()).toBe(false);
  exposes(p.root).openDrawer();
  await flush();
  expect(exposes(p.content).isPresent.get()).toBe(true);
  expect(exposes(p.mask).isPresent.get()).toBe(true);
});
it('does not alter controlled refusal while an admitted Content is present', async () => {
  const p = mount({ open: true });
  await flush();
  exposes(p.root).close();
  await flush();
  expect(exposes(p.root).open.get()).toBe(true);
  expect(exposes(p.mask).isPresent.get()).toBe(true);
  expect(exposes(p.content).isPresent.get()).toBe(true);
});
it.each([{ open: true }, { defaultOpen: true }])(
  'rejects malformed initial input with either Mask order and Root %j',
  async (rootProps) => {
    for (const maskFirst of [true, false]) {
      const root = document.createElement(drawer.drawerRoot.name);
      const mask = document.createElement(drawer.drawerMask.name);
      const content = document.createElement(drawer.drawerContent.name);
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.focus();
      setElementProps(root, rootProps);
      setElementProps(content, { minExtent: { unit: 'bad', value: 4 } });
      root.append(...(maskFirst ? [mask, content] : [content, mask]));
      roots.push(root);
      const errors: unknown[] = [];
      const onError = (event: ErrorEvent) => {
        errors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', onError);
      try {
        try {
          document.body.append(root);
        } catch (error) {
          errors.push(error);
        }
        await flush();
        expect(errors.some((error) => String(error).includes('Invalid initial extent'))).toBe(true);
        expect(exposes(root).open.get()).toBe(true);
        expect((mask as any).getExposes?.()?.isPresent?.get() ?? false).toBe(false);
        expect(mask.getAttribute('aria-modal')).not.toBe('true');
        expect(document.activeElement).toBe(outside);
      } finally {
        window.removeEventListener('error', onError);
        root.remove();
        outside.remove();
        await flush();
      }
    }
  }
);
it('releases the old owner and re-admits after a logical Root move', async () => {
  const first = mount({ defaultOpen: false });
  const second = mount({ defaultOpen: false }, false);
  await flush();
  second.root.append(first.content);
  await flush();
  exposes(second.root).openDrawer();
  await flush();
  expect(exposes(second.mask).isPresent.get()).toBe(true);
  expect(exposes(first.content).isPresent.get()).toBe(true);
  exposes(first.root).openDrawer();
  await flush();
  expect(exposes(first.mask).isPresent.get()).toBe(false);
});
it('rejects a second real Content before it can replace the first', async () => {
  const p = mount();
  await flush();
  const second = document.createElement(drawer.drawerContent.name);
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    try {
      p.root.append(second);
    } catch (error) {
      errors.push(error);
    }
    await flush();
    expect(errors.length).toBeGreaterThan(0);
    expect(exposes(p.content).isPresent.get()).toBe(true);
    expect(exposes(p.mask).isPresent.get()).toBe(true);
  } finally {
    window.removeEventListener('error', onError);
    second.remove();
    await flush();
  }
});
it('makes a retained real Root Anatomy release inert after Root-first disposal', async () => {
  let release: ((id: string, generation: number) => void) | undefined;
  let generation = 0;
  const probe = definePrototype({
    name: 'test-drawer-admission-real-root-probe',
    setup(def) {
      def.anatomy.claim(DRAWER_FAMILY, { role: 'content' });
      def.lifecycle.onCreated((run) => {
        const owner = run.anatomy.partsOf(DRAWER_FAMILY, 'root')[0];
        const register = owner.getExpose('__admitContent') as (id: string) => number;
        release = owner.getExpose('__releaseContent') as typeof release;
        generation = register('probe');
      });
    },
  });
  AdaptToWebComponent(probe);
  const p = mount({ open: true }, false);
  p.root.append(document.createElement(probe.name));
  await flush();
  p.root.remove();
  await flush();
  const next = mount({ open: true }, false);
  await flush();
  expect(() => release!('probe', generation)).not.toThrow();
  expect(exposes(next.mask).isPresent.get()).toBe(false);
});
it('rolls back a still-owned registration when admission publication throws', async () => {
  const { DRAWER_CONTEXT } = await import('../../src/drawer/shared');
  let thrown = false;
  const observer = definePrototype({
    name: 'test-drawer-admission-throwing-observer',
    setup(def) {
      def.context.subscribe(DRAWER_CONTEXT, (_run, next) => {
        if (next.contentAdmitted && !thrown) {
          thrown = true;
          throw new Error('admission observer source failure');
        }
      });
    },
  });
  AdaptToWebComponent(observer);
  const p = mount({ open: true }, false);
  p.root.append(document.createElement(observer.name));
  await flush();
  const content = document.createElement(drawer.drawerContent.name);
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    try {
      p.root.append(content);
    } catch (error) {
      errors.push(error);
    }
    await flush();
    expect(
      errors.some((error) => String(error).includes('admission observer source failure'))
    ).toBe(true);
    await vi.waitFor(() => expect(exposes(p.mask).isPresent.get()).toBe(false));
    expect(exposes(p.root).open.get()).toBe(true);
  } finally {
    window.removeEventListener('error', onError);
    content.remove();
    await flush();
  }
});
it('does not carry last-valid admission into a different Root with currently invalid props', async () => {
  const first = mount({ defaultOpen: false });
  const second = mount({ defaultOpen: false }, false);
  await flush();
  setElementProps(first.content, { minExtent: { unit: 'bad', value: 4 } });
  await flush();
  expect(exposes(first.content).extentValid.get()).toBe(false);
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  try {
    try {
      second.root.append(first.content);
    } catch (error) {
      errors.push(error);
    }
    await flush();
    for (const root of [first.root, second.root]) {
      try {
        exposes(root).openDrawer();
      } catch (error) {
        errors.push(error);
      }
    }
    await flush();
    expect(exposes(first.mask).isPresent.get()).toBe(false);
    expect(exposes(second.mask).isPresent.get()).toBe(false);
    expect(errors.some((error) => String(error).includes('Invalid initial extent'))).toBe(true);
  } finally {
    window.removeEventListener('error', onError);
  }
});
