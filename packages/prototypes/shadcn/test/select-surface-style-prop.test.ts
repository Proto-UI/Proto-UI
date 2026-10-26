import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  selectRoot,
  selectTrigger,
  selectContent,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
} from '../src/select';
for (const p of [
  selectRoot,
  selectTrigger,
  selectContent,
  selectSurface,
  selectViewport,
  selectItem,
  selectItemText,
])
  AdaptToWebComponent(p as any);
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
it('preserves the existing Surface and fixed leaf across its own explicit profile prop updates', async () => {
  vi.useFakeTimers();
  const root = document.createElement(selectRoot.name) as any,
    trigger = document.createElement(selectTrigger.name),
    content = document.createElement(selectContent.name),
    surface = document.createElement(selectSurface.name),
    viewport = document.createElement(selectViewport.name),
    item = document.createElement(selectItem.name),
    text = document.createElement(selectItemText.name);
  setElementProps(root, { styleProfile: 'rhea', defaultValue: 'alpha' });
  setElementProps(item, { value: 'alpha', textValue: 'Alpha' });
  text.textContent = 'Alpha';
  item.append(text);
  viewport.append(item);
  surface.append(viewport);
  content.append(surface);
  root.append(trigger, content);
  document.body.append(root);
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
  };
  await settle();
  trigger.click();
  await settle();
  trigger.focus();
  const leaf = surface.querySelector('[data-pui-owned-decoration]');
  expect(leaf).not.toBeNull();
  setElementProps(surface, { styleProfile: 'new-york' });
  await settle();
  expect(surface.getAttribute('data-pui-style')).toContain('rounded-md');
  expect(surface.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
  expect(content.querySelector(selectItem.name)).toBe(item);
  expect(root.getExposes().value.get()).toBe('alpha');
  expect(document.activeElement).toBe(trigger);
  setElementProps(surface, { styleProfile: 'inherit' });
  await settle();
  expect(surface.getAttribute('data-pui-style')).toContain('bg-popover/70');
  expect(surface.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
  expect(root.getExposes().open.get()).toBe(true);
});
