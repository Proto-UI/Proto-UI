import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  contextMenuRoot,
  contextMenuTrigger,
  contextMenuContent,
  contextMenuItem,
} from '../../src/context-menu';
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const proto of [contextMenuRoot, contextMenuTrigger, contextMenuContent, contextMenuItem])
  AdaptToWebComponent(proto as any, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lives.created++;
        if (event.type === 'instance.dispose.done') lives.disposed++;
      },
    },
  });
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
afterEach(async () => {
  vi.useRealTimers();
  for (const node of owned) node.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  owned.clear();
});
function fixture(props: Record<string, unknown> = {}) {
  const root = document.createElement(contextMenuRoot.name) as any;
  const trigger = document.createElement(contextMenuTrigger.name) as any;
  const content = document.createElement(contextMenuContent.name) as any;
  const item = document.createElement(contextMenuItem.name) as any;
  for (const node of [root, trigger, content, item]) owned.add(node);
  setElementProps(root, props);
  setElementProps(content, { avoidCollisions: false, enterDuration: 0, leaveDuration: 0 });
  setElementProps(item, { value: 'copy' });
  trigger.textContent = 'Open context menu';
  item.textContent = 'Copy';
  content.append(item);
  root.append(trigger, content);
  trigger.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 20,
      right: 210,
      bottom: 80,
      x: 10,
      y: 20,
      width: 200,
      height: 60,
    }) as DOMRect;
  document.body.append(root);
  const requests: any[] = [];
  root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
  return { root, trigger, content, item, requests };
}
function context(target: HTMLElement, x = 50, y = 60) {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}
function key(target: HTMLElement, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, shiftKey });
  target.dispatchEvent(event);
  return event;
}
function pointer(target: HTMLElement, type: string, x = 30, y = 40) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}
it('positions at accepted pointer intent and uses a trigger anchor for keyboard opening', async () => {
  const p = fixture();
  await flush();
  const event = context(p.trigger);
  await flush();
  expect(event.defaultPrevented).toBe(true);
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.requests).toEqual([
    expect.objectContaining({ open: true, reason: 'context.menu', focusReason: 'pointer' }),
  ]);
  await expect.poll(() => p.content.style.left).toBe('50px');
  await expect.poll(() => p.content.style.top).toBe('60px');
  p.root.getExposes().close();
  await flush();
  p.trigger.getExposes().focusSelf({ reason: 'keyboard' });
  const keyboard = key(p.trigger, 'F10', true);
  await flush();
  expect(keyboard.defaultPrevented).toBe(true);
  expect(p.requests.at(-1)).toEqual(
    expect.objectContaining({ open: true, focusReason: 'keyboard' })
  );
  await expect.poll(() => p.content.style.left).toBe('10px');
  await expect.poll(() => p.content.style.top).toBe('80px');
  const nativeFollowup = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  p.trigger.dispatchEvent(nativeFollowup);
  await flush();
  expect(p.requests).toHaveLength(3);
});
it('replaces pointer anchors on repeated requests and honors the public programmatic method', async () => {
  const p = fixture();
  await flush();
  context(p.trigger, 50, 60);
  await flush();
  context(p.trigger, 140, 110);
  await flush();
  await expect.poll(() => p.content.style.left).toBe('140px');
  expect(p.requests).toHaveLength(2);
  p.root.getExposes().close();
  await flush();
  expect(typeof p.root.getExposes().openContextMenu).toBe('function');
  p.root.getExposes().openContextMenu();
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  await expect.poll(() => p.content.style.left).toBe('10px');
});
it('accepts a controlled input request without taking over the open owner', async () => {
  const p = fixture({ open: false });
  await flush();
  const event = context(p.trigger, 70, 90);
  await flush();
  expect(event.defaultPrevented).toBe(true);
  expect(p.root.getExposes().open.get()).toBe(false);
  expect(p.requests).toHaveLength(1);
  setElementProps(p.root, { open: true });
  await flush();
  await expect.poll(() => p.content.style.left).toBe('70px');
  setElementProps(p.root, { open: false, disabled: true });
  await flush();
  const disabled = context(p.trigger);
  await flush();
  expect(disabled.defaultPrevented).toBe(false);
  expect(p.requests).toHaveLength(1);
});
it('opens after a held contact without opening on ordinary click and suppresses its duplicate click', async () => {
  vi.useFakeTimers();
  const p = fixture();
  await flush();
  p.trigger.click();
  expect(p.root.getExposes().open.get()).toBe(false);
  expect(pointer(p.trigger, 'pointerdown').defaultPrevented).toBe(false);
  await vi.advanceTimersByTimeAsync(601);
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.requests).toEqual([
    expect.objectContaining({ reason: 'long.press', focusReason: 'pointer' }),
  ]);
  pointer(p.trigger, 'pointerup');
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 });
  p.trigger.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(p.requests).toHaveLength(1);
});
it('cancels pending holds after movement, disabled policy and owner disposal', async () => {
  vi.useFakeTimers();
  const p = fixture();
  await flush();
  pointer(p.trigger, 'pointerdown');
  pointer(p.trigger, 'pointermove', 100, 100);
  await vi.advanceTimersByTimeAsync(601);
  await flush();
  expect(p.requests).toEqual([]);
  pointer(p.trigger, 'pointerup', 100, 100);
  pointer(p.trigger, 'pointerdown');
  setElementProps(p.root, { disabled: true });
  await vi.advanceTimersByTimeAsync(601);
  await flush();
  expect(p.requests).toEqual([]);
  setElementProps(p.root, { disabled: false });
  pointer(p.trigger, 'pointerdown');
  for (const node of [p.root, p.trigger, p.content, p.item]) node.remove();
  await flush();
  await vi.advanceTimersByTimeAsync(1000);
  await flush();
  expect(p.requests).toEqual([]);
});
