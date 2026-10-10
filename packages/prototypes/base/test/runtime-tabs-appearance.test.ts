import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn from '../../shadcn/src/tabs';
import * as brutalist from '../../brutalist/src/tabs';
import * as bootstrap from '../../bootstrap-2-3-2/src/tabs';
import * as liquid from '../../liquid-glass/src/tabs';

type Trigger = HTMLElement & {
  getExposes(): {
    selected: { get(): boolean };
    hovered: { get(): boolean };
    pressed: { get(): boolean };
    focusVisible: { get(): boolean };
    disabled: { get(): boolean };
  };
};
const tokens = (el: Element) =>
  new Set((el.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean));
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
for (const [family, parts] of [
  ['shadcn', shadcn],
  ['brutalist', brutalist],
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', liquid],
] as const) {
  describe(`${family} Tabs appearance state equivalence`, () => {
    it('preserves Base facts and current style on every default/underline roundtrip, including disabled withdrawal', async () => {
      // T-RUNTIME-TABS-APPEARANCE-0001-CASE-STATE-ROUNDTRIP
      for (const [part, proto] of [
        ['root', parts.tabsRoot],
        ['list', parts.tabsList],
        ['trigger', parts.tabsTrigger],
        ['content', parts.tabsContent],
      ] as const) {
        const tag = `appearance-${family}-${part}`;
        if (!customElements.get(tag))
          customElements.define(tag, AdaptToWebComponent(proto, { register: false }));
      }
      const root = document.createElement(`appearance-${family}-root`),
        list = document.createElement(`appearance-${family}-list`);
      const a = document.createElement(`appearance-${family}-trigger`) as Trigger,
        b = document.createElement(`appearance-${family}-trigger`) as Trigger;
      setElementProps(root, { value: 'a', activationMode: 'manual' });
      setElementProps(a, { value: 'a' });
      setElementProps(b, { value: 'b' });
      a.textContent = 'Alpha';
      b.textContent = 'Beta';
      list.append(a, b);
      root.append(list);
      document.body.append(root);
      await vi.waitFor(() => expect(a.getExposes().selected.get()).toBe(true));
      const requests = vi.fn();
      root.addEventListener('valueChange', requests);
      const defaultList = tokens(list);
      const setAppearance = async (appearance: 'default' | 'underline', disabled = false) => {
        setElementProps(list, { appearance });
        setElementProps(a, { value: 'a', appearance });
        setElementProps(b, { value: 'b', appearance, disabled });
        await flush();
      };
      const roundtrip = async (state: string, disabled = false) => {
        const beforeA = tokens(a),
          beforeB = tokens(b);
        const facts = () => ({
          selectedA: a.getExposes().selected.get(),
          selectedB: b.getExposes().selected.get(),
          hovered: b.getExposes().hovered.get(),
          pressed: b.getExposes().pressed.get(),
          focusVisible: b.getExposes().focusVisible.get(),
          disabled: b.getExposes().disabled.get(),
        });
        const previous = facts();
        await setAppearance('underline', disabled);
        expect(facts(), state).toEqual(previous);
        expect(tokens(list)).toContain('gap-6');
        expect(tokens(list)).toContain('overflow-x-auto');
        expect(tokens(list)).toContain('bg-transparent');
        expect(tokens(a)).toContain('border-b-2');
        expect(tokens(a)).toContain('border-foreground');
        expect(tokens(a)).toContain('text-foreground');
        expect(tokens(a)).toContain('bg-transparent');
        expect(tokens(b)).toContain('bg-transparent');
        expect(tokens(b)).toContain('rounded-none');
        for (const token of [
          'bg-main',
          'bg-background',
          'border-black',
          'shadow-sm',
          'rounded-md',
          'rounded-base',
          'rounded-xl',
        ])
          expect(tokens(a), `${state}: no default ${token}`).not.toContain(token);
        if (previous.focusVisible) expect(tokens(b)).toContain('outline-ring');
        if (disabled) expect(tokens(b)).toContain('opacity-50');
        if (!previous.hovered && !previous.selectedB)
          expect(tokens(b)).toContain('text-muted-foreground');
        await setAppearance('default', disabled);
        expect(facts(), state).toEqual(previous);
        expect(tokens(list)).toEqual(defaultList);
        expect(tokens(a), `${state}: selected paint restored`).toEqual(beforeA);
        expect(tokens(b), `${state}: other paint restored`).toEqual(beforeB);
        expect(tokens(a)).not.toContain('border-b-2');
      };
      await roundtrip('rest/selected');
      b.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      await flush();
      expect(b.getExposes().hovered.get()).toBe(true);
      await roundtrip('hover');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await flush();
      expect(b.getExposes().pressed.get()).toBe(true);
      await roundtrip('press');
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
      await flush();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      vi.spyOn(b, 'matches').mockReturnValue(true);
      b.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      await flush();
      expect(b.getExposes().focusVisible.get()).toBe(true);
      await roundtrip('focus-visible');
      await setAppearance('default', true);
      expect(b.getExposes().disabled.get()).toBe(true);
      await roundtrip('disabled', true);
      b.click();
      expect(requests).not.toHaveBeenCalled();
      await setAppearance('default', false);
      b.click();
      await vi.waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
      expect(a.getExposes().selected.get()).toBe(true);
      root.remove();
      await flush();
      b.click();
      expect(requests).toHaveBeenCalledTimes(1);
    });
  });
}
