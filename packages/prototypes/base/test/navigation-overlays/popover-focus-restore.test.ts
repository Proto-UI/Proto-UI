import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../../src/popover';

// The Base Popover Content owns a focus scope with `restore: 'none'`, so the
// scope must not move focus when it deactivates. The Popover itself owns the
// explicit handback to the trigger for dismissals that are neither an outside
// press nor an outside focus.
type PopoverExposes = { open: { get(): boolean } };
type PopoverElement = HTMLElement & { getExposes(): PopoverExposes };
type OpenChange = { open: boolean; reason: string };

const owned = new Set<HTMLElement>();
const lives = { created: 0, disposed: 0 };
for (const prototype of [
  base.popoverRoot,
  base.popoverTrigger,
  base.popoverContent,
  base.popoverTitle,
  base.popoverDescription,
  base.popoverClose,
])
  AdaptToWebComponent(prototype, {
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
function element(name: string, props?: Record<string, unknown>): PopoverElement {
  const node = document.createElement(name) as PopoverElement;
  if (props) setElementProps(node, props);
  owned.add(node);
  return node;
}
function fixture() {
  const root = element(base.popoverRoot.name, { open: false });
  const trigger = element(base.popoverTrigger.name);
  const content = element(base.popoverContent.name, { enterDuration: 0, leaveDuration: 0 });
  const title = element(base.popoverTitle.name);
  const description = element(base.popoverDescription.name);
  const close = element(base.popoverClose.name);
  const child = element('button');
  const outside = element('button');
  title.textContent = 'Focus settings';
  description.textContent = 'Keep background controls available.';
  close.textContent = 'Close';
  child.textContent = 'Inside content';
  outside.textContent = 'Outside';
  content.append(title, description, child, close);
  root.append(trigger, content);
  document.body.append(root, outside);
  const requests: OpenChange[] = [];
  root.addEventListener('openChange', (event) => {
    requests.push((event as CustomEvent<OpenChange>).detail);
  });
  return { root, trigger, content, close, child, outside, requests };
}

describe('base popover focus scope restore', () => {
  it('keeps the outside destination focused when an outside focus closes the popover', async () => {
    const p = fixture();
    await flush();
    // The trigger owns focus before the popover opens, so the focus scope
    // captures the trigger as the owner it would restore.
    p.trigger.focus();
    expect(document.activeElement).toBe(p.trigger);
    setElementProps(p.root, { open: true });
    await flush();
    expect(p.root.getExposes().open.get()).toBe(true);
    // The scope entered the content instead of leaving focus on the trigger.
    expect(p.content.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(p.trigger);

    p.root.addEventListener('openChange', (event) => {
      if (!(event as CustomEvent<OpenChange>).detail.open) setElementProps(p.root, { open: false });
    });
    p.outside.focus();
    await flush();
    expect(p.requests.at(-1)?.reason).toBe('focus.outside');
    expect(p.root.getExposes().open.get()).toBe(false);
    // The outside destination keeps focus; the scope must not restore the
    // trigger over it.
    expect(document.activeElement).toBe(p.outside);
    expect(document.activeElement).not.toBe(p.trigger);
  });

  it('keeps the outside destination focused when an outside press closes the popover', async () => {
    const p = fixture();
    await flush();
    p.trigger.focus();
    setElementProps(p.root, { open: true });
    await flush();
    expect(p.content.contains(document.activeElement)).toBe(true);

    // Controlled refusal holds the panel open until after the pointer's default
    // focus destination is applied. Closing must not then restore over it.
    p.outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    p.outside.focus();
    await flush();
    expect(p.requests.at(-1)?.reason).toBe('outside.press');
    expect(p.root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(p.outside);
    setElementProps(p.root, { open: false });
    await flush();
    expect(p.root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(p.outside);
    expect(document.activeElement).not.toBe(p.trigger);
  });

  it('hands focus back to the trigger when Escape closes the popover', async () => {
    const p = fixture();
    await flush();
    p.trigger.focus();
    setElementProps(p.root, { open: true });
    await flush();
    expect(p.content.contains(document.activeElement)).toBe(true);

    p.root.addEventListener('openChange', (event) => {
      if (!(event as CustomEvent<OpenChange>).detail.open) setElementProps(p.root, { open: false });
    });
    p.content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(p.requests.at(-1)?.reason).toBe('escape');
    expect(p.root.getExposes().open.get()).toBe(false);
    // Escape is not an outside dismissal, so the Popover hands focus back to
    // the trigger explicitly.
    expect(document.activeElement).toBe(p.trigger);
  });
});
