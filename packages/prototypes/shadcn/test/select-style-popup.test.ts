import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
  selectSurface,
  selectViewport,
  selectItemText,
} from '../src/select';
for (const p of [
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
  selectSurface,
  selectViewport,
  selectItemText,
])
  AdaptToWebComponent(p as any);
afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  vi.useRealTimers();
});
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
};
it('repaints a live portal through the logical scope without replacing caller options or the empty backdrop', async () => {
  vi.useFakeTimers();
  const root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(selectTrigger.name) as any,
    content = document.createElement(selectContent.name) as any,
    value = document.createElement(selectValue.name),
    item = document.createElement(selectItem.name) as any;
  setElementProps(root, { defaultValue: 'alpha' });
  setElementProps(item, { value: 'alpha', textValue: 'Alpha' });
  const surface = document.createElement(selectSurface.name),
    viewport = document.createElement(selectViewport.name),
    text = document.createElement(selectItemText.name);
  text.textContent = 'Alpha';
  item.append(text);
  viewport.append(item);
  surface.append(viewport);
  trigger.append(value);
  content.append(surface);
  root.append(trigger, content);
  document.body.append(root);
  await settle();
  trigger.click();
  await settle();
  expect(root.getExposes().open.get()).toBe(true);
  expect(content.isConnected).toBe(true);
  const leaf = content.querySelector('[data-pui-owned-decoration]');
  expect(leaf).not.toBeNull();
  expect(leaf.getAttribute('aria-hidden')).toBe('true');
  expect(leaf.childNodes.length).toBe(0);
  const tokens = (node: Element) => node.getAttribute('data-pui-style') ?? '';
  expect(tokens(surface)).toContain('bg-popover');
  for (const profile of ['rhea', 'new-york-v4', 'rhea']) {
    setElementProps(root, { defaultValue: 'alpha', styleProfile: profile });
    await settle();
    expect(content.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
    expect(content.querySelector(selectItem.name)).toBe(item);
    expect(root.getExposes().value.get()).toBe('alpha');
    expect(root.getExposes().open.get()).toBe(true);
    if (profile === 'rhea') {
      expect(tokens(surface)).toContain('bg-popover/70');
      expect(tokens(surface)).toContain('min-w-36');
      expect(tokens(surface)).not.toMatch(/(?:^|\s)border(?:\s|$)/);
      expect(tokens(leaf)).toContain('backdrop-filter-[blur(40px)_saturate(1.5)]');
      expect(tokens(item)).toContain('rounded-[var(--pui-radius-xl)]');
    } else {
      expect(tokens(surface)).toContain('rounded-md');
      expect(tokens(surface)).not.toContain('bg-popover/70');
      expect(tokens(leaf)).not.toContain('backdrop-filter-');
    }
  }
  document.documentElement.dataset.theme = 'dark';
  await settle();
  await vi.waitFor(() => expect(tokens(surface)).toContain('ring-foreground/10'));
  expect(tokens(surface)).not.toMatch(/(?:^|\s)ring-foreground\/5(?:\s|$)/);
  trigger.click();
  await settle();
  expect(root.getExposes().open.get()).toBe(false);
  trigger.click();
  await settle();
  expect(root.getExposes().open.get()).toBe(true);
  expect(tokens(content.querySelector('[data-pui-owned-decoration]')!)).toContain(
    'backdrop-filter-'
  );
});

it('rejects live Rhea on legacy Content-only rather than silently omitting the translucent Surface', async () => {
  vi.useFakeTimers();
  const root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(selectTrigger.name),
    content = document.createElement(selectContent.name),
    item = document.createElement(selectItem.name);
  setElementProps(item, { value: 'alpha', textValue: 'Alpha' });
  content.append(item);
  root.append(trigger, content);
  document.body.append(root);
  await settle();
  trigger.click();
  await settle();
  expect(root.getExposes().open.get()).toBe(true);
  expect(() => setElementProps(root, { styleProfile: 'rhea' })).toThrow(
    /requires the complete Select/
  );
});
it('admits an initially open complete Rhea composition after actual anatomy commit', async () => {
  vi.useFakeTimers();
  const root = document.createElement(selectRoot.name) as any;
  const trigger = document.createElement(selectTrigger.name);
  const content = document.createElement(selectContent.name);
  const surface = document.createElement(selectSurface.name);
  const viewport = document.createElement(selectViewport.name);
  const item = document.createElement(selectItem.name);
  const text = document.createElement(selectItemText.name);
  setElementProps(root, { defaultOpen: true, defaultValue: 'alpha', styleProfile: 'rhea' });
  setElementProps(item, { value: 'alpha', textValue: 'Alpha' });
  text.textContent = 'Alpha';
  item.append(text);
  viewport.append(item);
  surface.append(viewport);
  content.append(surface);
  root.append(trigger, content);
  document.body.append(root);
  await settle();
  expect(root.getExposes().open.get()).toBe(true);
  expect(surface.getAttribute('data-pui-style')).toContain('bg-popover/70');
  expect(
    surface.querySelector('[data-pui-owned-decoration]')?.getAttribute('data-pui-style')
  ).toContain('backdrop-filter-');
});
