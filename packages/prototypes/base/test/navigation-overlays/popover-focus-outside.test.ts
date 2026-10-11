import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/popover';
import * as shadcn from '../../../shadcn/src/popover';
import * as brutalist from '../../../brutalist/src/popover';
import * as bootstrap from '../../../bootstrap-2-3-2/src/popover';
import * as liquid from '../../../liquid-glass/src/popover';
import * as alert from '../../src/alert-dialog';

const families = [base, shadcn, brutalist, bootstrap, liquid];
const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const proto of [
  ...families.flatMap((family) => [
    family.popoverRoot,
    family.popoverTrigger,
    family.popoverContent,
    family.popoverTitle,
    family.popoverDescription,
    family.popoverClose,
  ]),
  alert.alertDialogRoot,
  alert.alertDialogTrigger,
  alert.alertDialogContent,
  alert.alertDialogTitle,
  alert.alertDialogDescription,
  alert.alertDialogCancel,
])
  AdaptToWebComponent(proto as any, {
    diagnostics: {
      onLifecycleEvent(event) {
        if (event.type === 'instance.created') lives.created++;
        if (event.type === 'instance.dispose.done') lives.disposed++;
      },
    },
  });
const flush = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  await expect.poll(() => lives.disposed).toBe(lives.created);
  owned.clear();
});
function element(name: string, props?: Record<string, unknown>): any {
  const node = document.createElement(name);
  if (props) setElementProps(node, props);
  owned.add(node);
  return node;
}
type Parts = Pick<
  typeof base,
  | 'popoverRoot'
  | 'popoverTrigger'
  | 'popoverContent'
  | 'popoverTitle'
  | 'popoverDescription'
  | 'popoverClose'
>;
function fixture(family: Parts = base, rootProps: Record<string, unknown> = {}) {
  const root = element(family.popoverRoot.name, { defaultOpen: true, ...rootProps });
  const trigger = element(family.popoverTrigger.name);
  const content = element(family.popoverContent.name, { enterDuration: 0, leaveDuration: 0 });
  const title = element(family.popoverTitle.name);
  const description = element(family.popoverDescription.name);
  const close = element(family.popoverClose.name);
  const child = element('button');
  const outside = element('button');
  const later = element('button');
  title.textContent = 'Focus settings';
  description.textContent = 'Keep background controls available.';
  close.textContent = 'Close';
  child.textContent = 'Inside content';
  outside.textContent = 'Outside';
  later.textContent = 'Later outside';
  content.append(title, description, child, close);
  root.append(trigger, content);
  document.body.append(root, outside, later);
  const requests: any[] = [];
  root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
  return { root, trigger, content, close, child, outside, later, requests };
}
function tabFrom(node: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  node.dispatchEvent(event);
  return event;
}

describe.each(families.map((family) => [family.popoverRoot.name, family] as const))(
  '%s focus boundary',
  (_name, family) => {
    it('retains trigger and portalled children, then closes after a real outside focus', async () => {
      const p = fixture(family);
      await flush();
      expect(p.root.contains(p.content)).toBe(false);
      for (const target of [p.child, p.close, p.trigger, p.child]) {
        target.focus();
        await flush();
        expect(document.activeElement).toBe(target);
        expect(p.root.getExposes().open.get()).toBe(true);
        expect(p.requests).toEqual([]);
      }
      const tab = tabFrom(p.child);
      expect(tab.defaultPrevented).toBe(false);
      // Happy DOM does not perform browser sequential navigation: apply the
      // browser's resulting focus move, rather than treating keydown as proof.
      p.outside.focus();
      await flush();
      expect(p.root.getExposes().open.get()).toBe(false);
      expect(document.activeElement).toBe(p.outside);
      expect(p.requests).toEqual([
        { open: false, reason: 'focus.outside', focusReason: 'programmatic' },
      ]);
    });
  }
);

it('requests controlled dismissal without transient hiding and accepts a later owner update', async () => {
  const p = fixture(base, { open: true });
  await flush();
  const states: boolean[] = [];
  p.root.addEventListener('openChange', () => states.push(p.content.getExposes().open.get()));
  p.outside.focus();
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.content.getExposes().open.get()).toBe(true);
  expect(p.content.classList.contains('hidden')).toBe(false);
  expect(p.content.isConnected).toBe(true);
  expect(document.activeElement).toBe(p.outside);
  expect(states).toEqual([true]);
  tabFrom(p.outside);
  p.later.focus();
  await flush();
  expect(p.requests.map((request) => request.reason)).toEqual(['focus.outside', 'focus.outside']);
  expect(states).toEqual([true, true]);
  setElementProps(p.root, { open: false });
  await flush();
  expect(p.content.getExposes().open.get()).toBe(false);
  expect(document.activeElement).toBe(p.later);
  setElementProps(p.root, { open: true });
  await flush();
  p.child.focus();
  p.outside.focus();
  await flush();
  expect(p.requests).toHaveLength(3);
  expect(p.root.getExposes().open.get()).toBe(true);
});

it('honors synchronous controlled acceptance without restoring the trigger', async () => {
  const p = fixture(base, { open: true });
  await flush();
  p.root.addEventListener('openChange', (event: CustomEvent) => {
    if (event.detail.reason === 'focus.outside') setElementProps(p.root, { open: false });
  });
  p.outside.focus();
  await flush();
  expect(p.requests.map((request) => request.reason)).toEqual(['focus.outside']);
  expect(p.root.getExposes().open.get()).toBe(false);
  expect(p.content.getExposes().open.get()).toBe(false);
  expect(document.activeElement).toBe(p.outside);
});

it('coalesces pointer dismissal and its focus default but permits the next interaction', async () => {
  const p = fixture(base, { open: true });
  await flush();
  p.outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
  p.outside.focus();
  await flush();
  expect(p.requests.map((request) => request.reason)).toEqual(['outside.press']);
  expect(document.activeElement).toBe(p.outside);
  p.outside.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
  tabFrom(p.outside);
  p.later.focus();
  await flush();
  expect(p.requests.map((request) => request.reason)).toEqual(['outside.press', 'focus.outside']);
  expect(p.root.getExposes().open.get()).toBe(true);
});

it('does not use a stale synthetic focusin or detached content as outside-focus authority', async () => {
  const p = fixture();
  await flush();
  p.child.focus();
  p.outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.requests).toEqual([]);
  p.content.remove();
  await flush();
  p.outside.focus();
  await flush();
  expect(p.requests).toEqual([]);
  expect(p.root.getExposes().open.get()).toBe(true);
  p.root.append(p.content);
  await flush();
  p.child.focus();
  p.later.focus();
  await flush();
  expect(p.requests.map((request) => request.reason)).toEqual(['focus.outside']);
  expect(document.activeElement).toBe(p.later);
});

it('preserves Alert Dialog outside-dismiss protection', async () => {
  const p = fixture({
    popoverRoot: alert.alertDialogRoot,
    popoverTrigger: alert.alertDialogTrigger,
    popoverContent: alert.alertDialogContent,
    popoverTitle: alert.alertDialogTitle,
    popoverDescription: alert.alertDialogDescription,
    popoverClose: alert.alertDialogCancel,
  });
  await flush();
  tabFrom(p.close);
  p.outside.focus();
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.content.getAttribute('role')).toBe('alertdialog');
  expect(p.requests).toEqual([]);
});
