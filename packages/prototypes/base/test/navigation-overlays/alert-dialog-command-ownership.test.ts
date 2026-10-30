// Actual Base/Adapter command observations in a DOM model; not native pointer/keyboard evidence.
import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as alert from '../../src/alert-dialog';

const prototypes = [alert.alertDialogRoot, alert.alertDialogContent, alert.alertDialogTitle,
  alert.alertDialogDescription, alert.alertDialogAction, alert.alertDialogCancel];
const roots = new Set<HTMLElement>();
const lives = new Map<string, { created: number; disposed: number }>();
for (const prototype of prototypes) AdaptToWebComponent(prototype as any, {
  diagnostics: { onLifecycleEvent(event) {
    const count = lives.get(prototype.name) ?? { created: 0, disposed: 0 };
    if (event.type === 'instance.created') count.created++;
    if (event.type === 'instance.dispose.done') count.disposed++;
    lives.set(prototype.name, count);
  } },
});
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const ready = async (f: ReturnType<typeof fixture>) => {
  await expect.poll(() => f.open()).toBe(true);
  await expect.poll(() => f.action.getAttribute('role')).toBe('button');
  await expect.poll(() => f.cancel.getAttribute('role')).toBe('button');
};
afterEach(async () => {
  for (const root of roots) root.remove();
  await expect.poll(() => [...lives.values()].every(x => x.created === x.disposed)).toBe(true);
  roots.clear();
});
function fixture(rootDisabled = false) {
  const root = document.createElement(alert.alertDialogRoot.name);
  const content = document.createElement(alert.alertDialogContent.name);
  const title = document.createElement(alert.alertDialogTitle.name);
  const description = document.createElement(alert.alertDialogDescription.name);
  const action = document.createElement(alert.alertDialogAction.name);
  const cancel = document.createElement(alert.alertDialogCancel.name);
  title.textContent = 'Delete this draft?';
  description.textContent = 'This fixture observes requests; the owner refuses closure.';
  action.textContent = 'Delete'; cancel.textContent = 'Keep draft';
  setElementProps(root, { open: true, disabled: rootDisabled });
  setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
  content.append(title, description, action, cancel);
  root.append(content); roots.add(root);
  const requests: unknown[] = [], actions: unknown[] = [];
  root.addEventListener('openChange', event => requests.push((event as CustomEvent).detail));
  action.addEventListener('action', event => actions.push((event as CustomEvent).detail));
  document.body.append(root);
  const open = () => (root as HTMLElement & { getExposes(): { open: { get(): boolean } } }).getExposes().open.get();
  return { root, action, cancel, requests, actions, open };
}
describe('AlertDialog actual command ownership — DOM model, not native input', () => {
  it('Action signals intent once and requests close without accepting controlled state', async () => {
    const f = fixture(); await ready(f);
    expect(f.requests).toEqual([]); expect(f.actions).toEqual([]);
    f.action.click(); await expect.poll(() => f.requests.length).toBe(1);
    expect(f.actions).toEqual([{ reason: 'action.press' }]);
    expect(f.requests).toEqual([{ open: false, reason: 'action.press', focusReason: 'pointer' }]);
    expect(f.open()).toBe(true);
    setElementProps(f.root, { open: false }); await expect.poll(() => f.open()).toBe(false);
    expect(f.open()).toBe(false);
    expect(f.requests).toHaveLength(1); expect(f.actions).toHaveLength(1);
  });
  it('Cancel requests close without emitting Action; a sibling root is untouched', async () => {
    const f = fixture(), sibling = fixture(); await Promise.all([ready(f), ready(sibling)]);
    f.cancel.click(); await expect.poll(() => f.requests.length).toBe(1);
    expect(f.requests).toEqual([{ open: false, reason: 'cancel.press', focusReason: 'pointer' }]);
    expect(f.actions).toEqual([]); expect(f.open()).toBe(true);
    expect(sibling.requests).toEqual([]); expect(sibling.actions).toEqual([]); expect(sibling.open()).toBe(true);
  });
  for (const command of ['action', 'cancel'] as const) {
    it(`suppresses root-disabled ${command}, while an enabled sibling remains usable`, async () => {
      const f = fixture(true), enabled = fixture(); await Promise.all([ready(f), ready(enabled)]);
      await expect.poll(() => f[command].getAttribute('aria-disabled')).toBe('true');
      f[command].click(); enabled[command].click(); await expect.poll(() => enabled.requests.length).toBe(1);
      expect(f.requests).toEqual([]); expect(f.actions).toEqual([]); expect(f.open()).toBe(true);
      expect(enabled.requests).toHaveLength(1);
      expect(enabled.actions).toHaveLength(command === 'action' ? 1 : 0);
    });
    it(`suppresses part-disabled ${command} without globally disabling the root`, async () => {
      const f = fixture(); await ready(f);
      setElementProps(f[command], { disabled: true });
      await expect.poll(() => f[command].getAttribute('aria-disabled')).toBe('true');
      f[command].click(); await flush();
      expect(f.requests).toEqual([]); expect(f.actions).toEqual([]);
      const other = command === 'action' ? 'cancel' : 'action';
      f[other].click(); await expect.poll(() => f.requests.length).toBe(1);
      expect(f.requests).toHaveLength(1); expect(f.open()).toBe(true);
      expect(f.actions).toHaveLength(other === 'action' ? 1 : 0);
    });
  }
});

