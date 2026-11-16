import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import type { Prototype } from '@proto.ui/core';
import * as baseAutocomplete from '../src/autocomplete';
import * as baseCombobox from '../src/combobox';
import * as baseCommand from '../src/command';
import * as shadcnAutocomplete from '../../shadcn/src/autocomplete';
import * as shadcnCombobox from '../../shadcn/src/combobox';
import * as shadcnCommand from '../../shadcn/src/command';
import * as brutalistAutocomplete from '../../brutalist/src/autocomplete';
import * as brutalistCombobox from '../../brutalist/src/combobox';
import * as brutalistCommand from '../../brutalist/src/command';

const groups = [
  ['base', 'autocomplete', baseAutocomplete],
  ['base', 'combobox', baseCombobox],
  ['base', 'command', baseCommand],
  ['shadcn', 'autocomplete', shadcnAutocomplete],
  ['shadcn', 'combobox', shadcnCombobox],
  ['shadcn', 'command', shadcnCommand],
  ['brutalist', 'autocomplete', brutalistAutocomplete],
  ['brutalist', 'combobox', brutalistCombobox],
  ['brutalist', 'command', brutalistCommand],
] as const;
const roots = new Set<HTMLElement>();
const lifetimes = new Map<string, { created: number; disposed: number }>();
for (const [, , module] of groups) {
  for (const value of Object.values(module)) {
    if (!value || typeof value !== 'object' || !('name' in value) || !('setup' in value)) continue;
    const prototype = value as Prototype<any>;
    AdaptToWebComponent(prototype, {
      diagnostics: {
        onLifecycleEvent(event) {
          const count = lifetimes.get(prototype.name) ?? { created: 0, disposed: 0 };
          if (event.type === 'instance.created') count.created++;
          if (event.type === 'instance.dispose.done') count.disposed++;
          lifetimes.set(prototype.name, count);
        },
      },
    });
  }
}
const flush = async () => {
  for (let index = 0; index < 16; index++) await Promise.resolve();
};
afterEach(async () => {
  for (const root of roots) root.remove();
  roots.clear();
  await expect
    .poll(() => [...lifetimes.values()].every((x) => x.created === x.disposed))
    .toBe(true);
  vi.restoreAllMocks();
});

type PublicElement = HTMLElement & { getExposes(): Record<string, any> };
async function fixture(family: string, mode: string) {
  const make = (part: string, props: Record<string, unknown> = {}) => {
    const element = document.createElement(`${family}-${mode}-${part}`) as PublicElement;
    setElementProps(element, props);
    return element;
  };
  const root = make('root', { filter: false });
  roots.add(root);
  const input = make('input', { a11yLabel: 'Find an item' });
  const content = make('content');
  const choices = ['first', 'disabled', 'middle', 'last'].map((value) =>
    make('item', { value, textValue: value, disabled: value === 'disabled' })
  );
  for (const item of choices) item.textContent = item === choices[1] ? 'disabled' : 'choice';
  content.append(...choices);
  root.append(input, content);
  document.body.append(root);
  await flush();
  if (mode !== 'command') root.getExposes().openPopup();
  await flush();
  const editor = input.querySelector('input')!;
  expect(editor).toBeInstanceOf(HTMLInputElement);
  editor.focus();
  // Actual Runtime/Module/Adapter dispatch with injected DOM-model geometry.
  // Native short-viewport cases separately prove real layout and trusted keys.
  Object.defineProperties(content, {
    clientWidth: { configurable: true, value: 200 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 320 },
    offsetHeight: { configurable: true, value: 100 },
    clientTop: { configurable: true, value: 0 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
  content.style.scrollPaddingTop = '0px';
  content.style.scrollPaddingBottom = '0px';
  const contentBox = new DOMRect(0, 100, 200, 100);
  vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(contentBox);
  vi.spyOn(content, 'getClientRects').mockReturnValue([contentBox] as unknown as DOMRectList);
  for (const [index, item] of choices.entries()) {
    const rect = () => new DOMRect(0, 100 + index * 80 - content.scrollTop, 180, 80);
    vi.spyOn(item, 'getBoundingClientRect').mockImplementation(rect);
    vi.spyOn(item, 'getClientRects').mockImplementation(() => [rect()] as unknown as DOMRectList);
  }
  const key = async (key: string) => {
    editor.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    await flush();
  };
  return { root, input, editor, content, choices, key };
}

for (const [family, mode] of groups) {
  describe(`${family} ${mode} keyboard target reveal`, () => {
    it('reveals End/Home/Arrow navigation, skips disabled choices and retains the editor focus', async () => {
      const f = await fixture(family, mode);
      await f.key('End');
      expect(f.editor.getAttribute('aria-activedescendant')).toBe(f.choices[3].id);
      expect(f.content.scrollTop).toBe(220);
      expect(document.activeElement).toBe(f.editor);
      await f.key('Home');
      expect(f.content.scrollTop).toBe(0);
      expect(f.editor.getAttribute('aria-activedescendant')).toBe(f.choices[0].id);
      await f.key('ArrowDown');
      expect(f.editor.getAttribute('aria-activedescendant')).toBe(f.choices[2].id);
      expect(f.content.scrollTop).toBe(140);
      expect(document.activeElement).toBe(f.editor);
    });

    it.each(['disabled', 'readOnly', 'composing'] as const)(
      'does not reveal during %s',
      async (guard) => {
        const f = await fixture(family, mode);
        if (guard === 'composing')
          f.editor.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true, data: '文' })
          );
        else setElementProps(f.root, { [guard]: true });
        await flush();
        const active = f.editor.getAttribute('aria-activedescendant');
        await f.key('End');
        expect(f.content.scrollTop).toBe(0);
        expect(f.editor.getAttribute('aria-activedescendant')).toBe(active);
      }
    );

    it('does not turn pointer activation into a keyboard scroll request', async () => {
      const f = await fixture(family, mode);
      f.choices[3].dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'mouse',
          buttons: 0,
          bubbles: true,
          composed: true,
        })
      );
      await flush();
      expect(f.choices[3].getExposes().active.get()).toBe(true);
      expect(f.content.scrollTop).toBe(0);
      expect(document.activeElement).toBe(f.editor);
    });

    it('a retired content expose cannot reveal its detached options', async () => {
      const f = await fixture(family, mode);
      const reveal = f.content.getExposes().__revealActive;
      f.content.remove();
      await flush();
      expect(() => reveal(f.choices[3].id)).toThrow('after terminal disposal');
      expect(f.content.scrollTop).toBe(0);
      // Track the detached portal subtree too until the actual owner is disposed.
      roots.add(f.content);
    });
  });
}
