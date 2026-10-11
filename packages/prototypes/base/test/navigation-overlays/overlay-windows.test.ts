import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as alert from '../../src/alert-dialog';
import * as drawer from '../../src/drawer';
import * as popover from '../../src/popover';

const families = [
  {
    name: 'alert-dialog',
    root: alert.alertDialogRoot,
    trigger: alert.alertDialogTrigger,
    content: alert.alertDialogContent,
    close: alert.alertDialogCancel,
    title: alert.alertDialogTitle,
    description: alert.alertDialogDescription,
    mask: alert.alertDialogMask,
  },
  {
    name: 'drawer',
    root: drawer.drawerRoot,
    trigger: drawer.drawerTrigger,
    content: drawer.drawerContent,
    close: drawer.drawerClose,
    title: drawer.drawerTitle,
    description: drawer.drawerDescription,
    mask: drawer.drawerMask,
  },
  {
    name: 'popover',
    root: popover.popoverRoot,
    trigger: popover.popoverTrigger,
    content: popover.popoverContent,
    close: popover.popoverClose,
    title: popover.popoverTitle,
    description: popover.popoverDescription,
  },
];
const owned = new Set<HTMLElement>();
const lives = new Map<string, { created: number; disposed: number }>();
for (const family of families)
  for (const proto of Object.values(family)) {
    if (typeof proto === 'string') continue;
    AdaptToWebComponent(proto as any, {
      diagnostics: {
        onLifecycleEvent(event) {
          const count = lives.get(proto.name) ?? { created: 0, disposed: 0 };
          if (event.type === 'instance.created') count.created++;
          if (event.type === 'instance.dispose.done') count.disposed++;
          lives.set(proto.name, count);
        },
      },
    });
  }
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned) node.remove();
  await expect.poll(() => [...lives.values()].every((x) => x.created === x.disposed)).toBe(true);
  owned.clear();
});
function fixture(family: (typeof families)[number], props = {}) {
  const p: Record<string, any> = {};
  for (const [key, proto] of Object.entries(family)) {
    if (typeof proto === 'string') continue;
    p[key] = document.createElement(proto.name);
    owned.add(p[key]);
  }
  p.title.textContent = 'Settings';
  p.description.textContent = 'Review these changes.';
  p.trigger.textContent = 'Open';
  p.close.textContent = 'Close';
  setElementProps(p.root, props);
  setElementProps(p.content, { enterDuration: 0, leaveDuration: 0 });
  if (p.mask) setElementProps(p.mask, { enterDuration: 0, leaveDuration: 0 });
  p.content.append(p.title, p.description, p.close);
  p.root.append(p.trigger, ...(p.mask ? [p.mask] : []), p.content);
  document.body.append(p.root);
  return p;
}

describe.each(families)('$name window protocol', (family) => {
  it('opens and closes its own context and accessible relationships', async () => {
    const p = fixture(family);
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
    p.trigger.click();
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
    expect(p.content.getAttribute('role')).toBe(
      family.name === 'alert-dialog' ? 'alertdialog' : 'dialog'
    );
    expect(p.content.getAttribute('aria-modal')).toBe(family.name === 'popover' ? 'false' : 'true');
    expect(p.content.getAttribute('aria-labelledby')).toBe(p.title.id);
    expect(p.content.getAttribute('aria-describedby')).toBe(p.description.id);
    expect(p.trigger.getAttribute('aria-controls')).toBe(p.content.id);
    p.close.click();
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
    p.trigger.click();
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
  });
  it('emits a controlled close request without changing owner state', async () => {
    const p = fixture(family, { open: true });
    await flush();
    const requests: any[] = [];
    p.root.addEventListener('openChange', (event: CustomEvent) => requests.push(event.detail));
    p.close.click();
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
    expect(requests).toEqual([expect.objectContaining({ open: false })]);
    setElementProps(p.root, { open: false });
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
  });
  it('suppresses disabled commands', async () => {
    const p = fixture(family, { disabled: true });
    await flush();
    p.trigger.click();
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
    expect(p.trigger.getAttribute('aria-disabled')).toBe('true');
  });
});

it('alert blocks outside dismissal and focuses the cancel command', async () => {
  const p = fixture(families[0], { defaultOpen: true });
  await flush();
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await flush();
  expect(p.root.getExposes().open.get()).toBe(true);
  expect(p.content.getAttribute('role')).toBe('alertdialog');
  expect(document.activeElement).toBe(p.close);
});
