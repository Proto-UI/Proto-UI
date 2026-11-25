import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { retainHappyDomMutationCallbacks } from '../../../../scripts/test/happy-dom-mutation-keepalive.mjs';
import { toastViewport, toastRoot, toastTitle } from '../src/toast';
import { popoverRoot, popoverTrigger, popoverContent } from '../src/popover';

const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
const constructors = {
  viewport: toastViewport,
  toast: toastRoot,
  title: toastTitle,
  popover: popoverRoot,
  trigger: popoverTrigger,
  content: popoverContent,
};
const parts = Object.fromEntries(
  Object.entries(constructors).map(([key, prototype]) => [
    key,
    AdaptToWebComponent(prototype as any, {
      registerAs: `toast-portal-${key}`,
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.created') lives.created++;
          if (event.type === 'instance.dispose.done') lives.disposed++;
        },
      },
    }),
  ])
) as Record<keyof typeof constructors, any>;
let observerKeeper: ReturnType<typeof retainHappyDomMutationCallbacks>;
beforeAll(() => {
  observerKeeper = retainHappyDomMutationCallbacks(window);
});
afterAll(() => observerKeeper.restore());
const flush = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  owned.clear();
});
function native(tag = 'div') {
  const node = document.createElement(tag);
  owned.add(node);
  return node;
}
function part(name: keyof typeof constructors, props: Record<string, unknown> = {}) {
  const node = new parts[name]();
  setElementProps(node, props);
  owned.add(node);
  return node;
}
function notifications() {
  const origin = native('section');
  const viewport = part('viewport', { position: 'top-center', expand: true, duration: 0 });
  const toast = part('toast', { defaultOpen: true });
  const title = part('title');
  title.textContent = 'Saved';
  toast.append(title);
  viewport.append(toast);
  origin.append(viewport);
  document.body.append(origin);
  return { origin, viewport, toast };
}

it('portals the default viewport while retaining child context and origin-owned cleanup', async () => {
  const { origin, viewport, toast } = notifications();
  await flush();
  expect(viewport.parentElement).toBe(document.body);
  expect(origin.contains(viewport)).toBe(false);
  expect(toast.getExposes().position.get()).toBe('top-center');
  expect(toast.getExposes().expanded.get()).toBe(true);
  viewport.getExposes().pauseAll();
  expect(toast.getExposes().paused.get()).toBe(true);
  setElementProps(viewport, { position: 'bottom-left', expand: false });
  await flush();
  expect(toast.getExposes().position.get()).toBe('bottom-left');
  expect(toast.getExposes().expanded.get()).toBe(false);

  origin.remove();
  await expect.poll(() => viewport.isConnected).toBe(false);
  expect(viewport.parentElement).toBe(origin);
  expect(toast.isConnected).toBe(false);
});

describe.each(['pointer', 'focus', 'escape'] as const)(
  'Toast portal with an already-open Popover: %s',
  (input) => {
    it('preserves the Popover dismissal and leaves notifications open without moving focus', async () => {
      const root = part('popover', { defaultOpen: true });
      const trigger = part('trigger');
      const content = part('content', { enterDuration: 0, leaveDuration: 0 });
      const inside = native('button');
      const outside = native('button');
      content.append(inside);
      root.append(trigger, content);
      document.body.append(root, outside);
      await flush();
      inside.focus();
      await flush();
      expect(document.activeElement).toBe(inside);
      expect(root.getExposes().open.get()).toBe(true);

      const notification = notifications();
      await flush();
      expect(document.activeElement).toBe(inside);
      const requests: Array<{ open: boolean; reason: string }> = [];
      root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
      if (input === 'pointer') {
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
        outside.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      } else if (input === 'focus') {
        inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        // Happy DOM has no sequential keyboard navigation; apply its resulting focus move.
        outside.focus();
      } else {
        inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      await flush();
      expect(requests).toEqual([
        expect.objectContaining({
          open: false,
          reason:
            input === 'pointer' ? 'outside.press' : input === 'focus' ? 'focus.outside' : 'escape',
        }),
      ]);
      expect(root.getExposes().open.get()).toBe(false);
      expect(notification.toast.getExposes().open.get()).toBe(true);
      if (input === 'focus') expect(document.activeElement).toBe(outside);
    });
  }
);
