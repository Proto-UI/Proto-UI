import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dropdownContent, dropdownItem, dropdownRoot } from '../src/dropdown';
import { styleContains } from '../../test-utils/style';

for (const prototype of [dropdownRoot, dropdownContent, dropdownItem])
  AdaptToWebComponent(prototype as any);
const owned: HTMLElement[] = [];
const flush = async () => {
  for (let index = 0; index < 15; index++) await Promise.resolve();
};
afterEach(async () => {
  for (const node of owned.splice(0)) node.remove();
  document.documentElement.classList.remove('dark');
  await flush();
});
function fixture(props: Record<string, unknown> = {}) {
  const make = (name: string, values: Record<string, unknown> = {}) => {
    const node = document.createElement(name) as HTMLElement & {
      getExposes(): Record<string, any>;
    };
    owned.push(node);
    setElementProps(node, values);
    return node;
  };
  const root = make(dropdownRoot.name, { defaultOpen: true });
  const content = make(dropdownContent.name, { enterDuration: 0, leaveDuration: 0 });
  const normal = make(dropdownItem.name, { value: 'edit', textValue: 'Edit' });
  const subject = make(dropdownItem.name, {
    value: 'delete',
    textValue: 'Delete',
    variant: 'destructive',
    ...props,
  });
  normal.textContent = 'Edit';
  subject.textContent = 'Delete';
  content.append(normal, subject);
  root.append(content);
  document.body.append(root);
  return { root, content, normal, subject };
}
function expectDestructive(subject: HTMLElement, opacity: 10 | 20) {
  expect(styleContains(subject, `bg-destructive/${opacity}`)).toBe(true);
  expect(styleContains(subject, 'text-destructive')).toBe(true);
  for (const token of [
    'bg-accent',
    'bg-accent/80',
    'text-accent-foreground',
    'data-[pressed]:bg-accent/80',
  ])
    expect(styleContains(subject, token), token).toBe(false);
}

describe('Shadcn Dropdown destructive recipe over real Base states', () => {
  it('starts an already-dark focused destructive item at twenty-percent tint', async () => {
    document.documentElement.classList.add('dark');
    const { subject } = fixture();
    await flush();
    subject.focus();
    await flush();
    expectDestructive(subject, 20);
  });
  it('keeps rest transparent and reacts to focused light/dark changes without remounting', async () => {
    const { normal, subject } = fixture();
    await flush();
    expect(styleContains(subject, 'text-destructive')).toBe(true);
    expect(styleContains(subject, 'bg-destructive/10')).toBe(false);
    expect(styleContains(subject, 'bg-destructive/20')).toBe(false);
    subject.focus();
    await flush();
    expect(subject.getExposes().focused.get()).toBe(true);
    expectDestructive(subject, 10);
    document.documentElement.classList.add('dark');
    await expect.poll(() => styleContains(subject, 'bg-destructive/20')).toBe(true);
    expectDestructive(subject, 20);
    expect(styleContains(subject, 'bg-destructive/10')).toBe(false);
    document.documentElement.classList.remove('dark');
    await expect.poll(() => styleContains(subject, 'bg-destructive/10')).toBe(true);
    expectDestructive(subject, 10);
    normal.focus();
    await flush();
    expect(styleContains(subject, 'bg-destructive/10')).toBe(false);
    expect(styleContains(subject, 'text-destructive')).toBe(true);
  });

  it('does not require a collection value to retain destructive focus and hover paint', async () => {
    const { normal, subject } = fixture({ value: '' });
    await flush();
    subject.focus();
    await flush();
    expect(subject.getExposes().focused.get()).toBe(true);
    expect(subject.getExposes().active.get()).toBe(false);
    expectDestructive(subject, 10);
    normal.focus();
    subject.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(subject.getExposes().hovered.get()).toBe(true);
    expect(subject.getExposes().active.get()).toBe(false);
    expectDestructive(subject, 10);
    subject.dispatchEvent(new PointerEvent('pointerleave'));
    await flush();
    expect(styleContains(subject, 'bg-destructive/10')).toBe(false);
  });

  it('keeps destructive press and cancel in the same palette while default press stays unchanged', async () => {
    const { normal, subject } = fixture();
    await flush();
    subject.focus();
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark);
      subject.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await flush();
      expect(subject.getExposes().pressed.get()).toBe(true);
      expectDestructive(subject, dark ? 20 : 10);
      subject.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
      await flush();
      expect(subject.getExposes().pressed.get()).toBe(false);
      expectDestructive(subject, dark ? 20 : 10);
    }
    setElementProps(subject, { value: 'delete', variant: 'default' });
    await flush();
    expect(styleContains(subject, 'bg-accent')).toBe(true);
    expect(styleContains(subject, 'text-destructive')).toBe(false);
    subject.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(styleContains(subject, 'bg-accent/80')).toBe(true);
    subject.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();
    expect(subject.getExposes().pressed.get()).toBe(false);
    normal.focus();
  });

  it('retains disabled keyboard focus while rejecting activation', async () => {
    const { root, subject } = fixture({ disabled: true });
    await flush();
    const actions: unknown[] = [];
    subject.addEventListener('select', (event) => actions.push(event));
    subject.focus();
    await flush();
    expect(subject.getExposes().disabled.get()).toBe(true);
    expect(subject.getExposes().focused.get()).toBe(true);
    expectDestructive(subject, 10);
    subject.click();
    await flush();
    expect(actions).toEqual([]);
    expect(root.getExposes().open.get()).toBe(true);
  });
});
