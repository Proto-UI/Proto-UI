import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toggleGroupRoot, toggleGroupItem } from '../../src/toggle-group';
import { toolbarRoot, toolbarButton, toolbarSeparator } from '../../src/toolbar';
import {
  toastRoot,
  toastClose,
  toastTitle,
  toastDescription,
  toastViewport,
} from '../../src/toast';
const protos = [
  toggleGroupRoot,
  toggleGroupItem,
  toolbarRoot,
  toolbarButton,
  toolbarSeparator,
  toastRoot,
  toastClose,
  toastTitle,
  toastDescription,
  toastViewport,
];
for (const p of protos) AdaptToWebComponent(p as any);
const created: HTMLElement[] = [];
const element = (name: string, props = {}): any => {
  const e = document.createElement(name);
  setElementProps(e, props);
  created.push(e);
  return e;
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  vi.useRealTimers();
  for (const e of created.splice(0)) e.remove();
  await flush();
});
describe('toggle group', () => {
  it.each([false, true])(
    'supports single/multiple selection (%s) and deselection',
    async (multiple) => {
      const root = element('base-toggle-group-root', { multiple });
      const a = element('base-toggle-group-item', { value: 'a' });
      const b = element('base-toggle-group-item', { value: 'b' });
      root.append(a, b);
      document.body.append(root);
      await flush();
      a.click();
      b.click();
      await flush();
      expect(root.getExposes().getValue()).toEqual(multiple ? ['a', 'b'] : ['b']);
      expect(b.getAttribute('aria-pressed')).toBe('true');
      b.click();
      await flush();
      expect(root.getExposes().getValue()).toEqual(multiple ? ['a'] : []);
    }
  );
  it('keeps owner value and rejects readonly, disabled and duplicate items', async () => {
    const root = element('base-toggle-group-root', { value: ['a'] });
    const a = element('base-toggle-group-item', { value: 'a' });
    const b = element('base-toggle-group-item', { value: 'b' });
    root.append(a, b);
    document.body.append(root);
    await flush();
    const requests: any[] = [];
    root.addEventListener('valueChange', (e: any) => requests.push(e.detail.value));
    b.click();
    expect(root.getExposes().getValue()).toEqual(['a']);
    expect(requests).toEqual([['b']]);
    setElementProps(root, { readOnly: true });
    b.click();
    expect(requests).toHaveLength(1);
    setElementProps(root, { readOnly: false });
    const duplicate = element('base-toggle-group-item', { value: 'b' });
    root.append(duplicate);
    await flush();
    b.click();
    expect(requests).toHaveLength(1);
  });
  it('moves focus without toggling', async () => {
    const root = element('base-toggle-group-root');
    const a = element('base-toggle-group-item', { value: 'a' });
    const b = element('base-toggle-group-item', { value: 'b' });
    root.append(a, b);
    document.body.append(root);
    await flush();
    expect([a.tabIndex, b.tabIndex]).toEqual([0, -1]);
    a.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(root.getExposes().getValue()).toEqual([]);
    expect(document.activeElement).toBe(b);
  });
});
it('toolbar uses a single tab stop and emits only enabled commands', async () => {
  const root = element('base-toolbar-root', { a11yLabel: 'Editing' });
  const a = element('base-toolbar-button', { value: 'undo' });
  const b = element('base-toolbar-button', { value: 'redo', disabled: true });
  const sep = element('base-toolbar-separator');
  root.append(a, sep, b);
  document.body.append(root);
  await flush();
  expect(root.getAttribute('role')).toBe('toolbar');
  expect([a.tabIndex, b.tabIndex]).toEqual([0, -1]);
  expect(sep.getAttribute('aria-orientation')).toBe('vertical');
  const events: unknown[] = [];
  a.addEventListener('action', (e: any) => events.push(e.detail));
  b.addEventListener('action', (e: any) => events.push(e.detail));
  a.click();
  b.click();
  expect(events).toEqual([{ value: 'undo' }]);
});
function makeToast(props = {}) {
  const root = element('base-toast-root', { duration: 0, ...props });
  const title = element('base-toast-title');
  title.textContent = 'Saved';
  const description = element('base-toast-description');
  description.textContent = 'Your work is ready.';
  const close = element('base-toast-close');
  close.textContent = 'Dismiss';
  root.append(title, description, close);
  document.body.append(root);
  return { root, close };
}
it('toast owns accessible announcement, dismiss and reopen', async () => {
  const { root, close } = makeToast();
  await flush();
  expect(root.getExposes().open.get()).toBe(true);
  expect(root.getAttribute('role')).toBe('status');
  close.click();
  await flush();
  expect(root.getExposes().open.get()).toBe(false);
  root.getExposes().openToast();
  await flush();
  expect(root.getExposes().open.get()).toBe(true);
});
it('toast pauses timeout on hover and resumes the remaining duration', async () => {
  vi.useFakeTimers();
  const { root } = makeToast({ duration: 1000 });
  await flush();
  await vi.advanceTimersByTimeAsync(400);
  root.dispatchEvent(new PointerEvent('pointerenter'));
  await flush();
  expect(root.getExposes().paused.get()).toBe(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(root.getExposes().open.get()).toBe(true);
  root.dispatchEvent(new PointerEvent('pointerleave'));
  await vi.advanceTimersByTimeAsync(599);
  expect(root.getExposes().open.get()).toBe(true);
  await vi.advanceTimersByTimeAsync(2);
  expect(root.getExposes().open.get()).toBe(false);
});
it('controlled toast emits one timeout request and remains owner-open', async () => {
  vi.useFakeTimers();
  const { root } = makeToast({ open: true, duration: 100 });
  const events: unknown[] = [];
  root.addEventListener('openChange', (e: any) => events.push(e.detail));
  await flush();
  await vi.advanceTimersByTimeAsync(1000);
  expect(root.getExposes().open.get()).toBe(true);
  expect(events).toEqual([{ open: false, reason: 'timeout' }]);
});
it('toast viewport hotkey focuses the notification and pauses until focus leaves', async () => {
  vi.useFakeTimers();
  const viewport = element('base-toast-viewport');
  const { root, close } = makeToast({ duration: 1000 });
  viewport.append(root);
  document.body.append(viewport);
  await flush();
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'F8', bubbles: true, cancelable: true })
  );
  await flush();
  expect(document.activeElement).toBe(close);
  expect(root.getExposes().paused.get()).toBe(true);
  await vi.advanceTimersByTimeAsync(1500);
  expect(root.getExposes().open.get()).toBe(true);
  close.blur();
  await flush();
  expect(root.getExposes().paused.get()).toBe(false);
  await vi.advanceTimersByTimeAsync(1001);
  expect(root.getExposes().open.get()).toBe(false);
});
it('toast discards transient hover when a closed view reopens with a fresh timeout', async () => {
  vi.useFakeTimers();
  const { root, close } = makeToast({ duration: 1000 });
  await flush();
  await vi.advanceTimersByTimeAsync(400);
  root.dispatchEvent(new PointerEvent('pointerenter'));
  await flush();
  expect(root.getExposes().paused.get()).toBe(true);
  close.click();
  await flush();
  root.getExposes().openToast();
  await flush();
  expect(root.getExposes().paused.get()).toBe(false);
  await vi.advanceTimersByTimeAsync(1001);
  expect(root.getExposes().open.get()).toBe(false);
});
it('toast retains an explicit owner pause across close and reopen', async () => {
  vi.useFakeTimers();
  const { root, close } = makeToast({ duration: 100, paused: true });
  await flush();
  close.click();
  await flush();
  root.getExposes().openToast();
  await flush();
  expect(root.getExposes().paused.get()).toBe(true);
  await vi.advanceTimersByTimeAsync(500);
  expect(root.getExposes().open.get()).toBe(true);
  setElementProps(root, { duration: 100, paused: false });
  await vi.advanceTimersByTimeAsync(101);
  expect(root.getExposes().open.get()).toBe(false);
});
