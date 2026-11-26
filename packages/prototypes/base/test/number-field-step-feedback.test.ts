import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as brutalist from '../../brutalist/src/number-field';
import * as bootstrap from '../../bootstrap-2-3-2/src/number-field';
import * as liquid from '../../liquid-glass/src/number-field';

// C-FEEDBACK-STYLE-0004: stateful paint uses Rule, never author hover:/active:
// tokens. These real WC observations exercise the existing family recipes and
// Base numeric owner; synthetic input does not claim native-browser paint.
for (const group of [brutalist, bootstrap, liquid]) {
  AdaptToWebComponent(group.numberFieldRoot);
  AdaptToWebComponent(group.numberFieldIncrement);
  AdaptToWebComponent(group.numberFieldDecrement);
}

type Root = HTMLElement & { getExposes(): { value: { get(): number | null } } };
type Step = HTMLElement & { getExposes(): { disabled: { get(): boolean } } };
const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};
const tokens = (element: Element) => (element.getAttribute('data-pui-style') ?? '').split(/\s+/);
const pointer = (element: HTMLElement, type: string) =>
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    })
  );

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

const recipes = [
  ['brutalist', 'bg-main', 'bg-main/80'],
  [
    'bootstrap-2-3-2',
    'bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x]',
    'bg-[#e6e6e6_none_0_-15px_repeat-x]',
  ],
  ['liquid-glass', 'shadow-md', 'bg-muted'],
] as const;

for (const [family, hover, pressed] of recipes) {
  for (const part of ['increment', 'decrement'] as const) {
    it(`${family} ${part} retires pointer paint while Base owns stepping and availability`, async () => {
      const root = document.createElement(`${family}-number-field-root`) as Root;
      setElementProps(root, { defaultValue: 5, min: 0, max: 10 });
      const control = document.createElement(`${family}-number-field-${part}`) as Step;
      control.textContent = part === 'increment' ? '+' : '−';
      root.append(control);
      document.body.append(root);
      await flush();
      const proposals: unknown[] = [];
      root.addEventListener('valueChange', (event) =>
        proposals.push((event as CustomEvent).detail)
      );
      expect(tokens(control)).not.toContain(hover);
      expect(tokens(control)).not.toContain(pressed);

      pointer(control, 'pointerenter');
      await flush();
      expect(tokens(control)).toContain(hover);
      pointer(control, 'pointerdown');
      await flush();
      expect(tokens(control)).toContain(pressed);
      expect(tokens(control)).not.toContain(hover);
      if (family === 'brutalist') expect(tokens(control)).toContain('text-main-foreground');
      expect(root.getExposes().value.get()).toBe(5);
      expect(proposals).toHaveLength(0);
      pointer(control, 'pointercancel');
      await flush();
      expect(tokens(control)).not.toContain(hover);
      expect(tokens(control)).not.toContain(pressed);

      control.click();
      await flush();
      expect(root.getExposes().value.get()).toBe(part === 'increment' ? 6 : 4);
      expect(proposals).toHaveLength(1);
      pointer(control, 'pointerenter');
      pointer(control, 'pointerdown');
      await flush();
      setElementProps(root, { disabled: true });
      await flush();
      expect(control.getExposes().disabled.get()).toBe(true);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      expect(tokens(control)).not.toContain(hover);
      if (family !== 'liquid-glass') expect(tokens(control)).not.toContain(pressed);
      control.click();
      await flush();
      expect(proposals).toHaveLength(1);

      setElementProps(root, { disabled: false });
      await flush();
      expect(control.getExposes().disabled.get()).toBe(false);
      expect(tokens(control)).not.toContain(hover);
      expect(tokens(control)).not.toContain(pressed);
      pointer(control, 'pointerenter');
      pointer(control, 'pointerdown');
      await flush();
      pointer(control, 'pointerup');
      await flush();
      expect(tokens(control)).not.toContain(pressed);
      expect(tokens(control)).toContain(hover);
      pointer(control, 'pointerleave');
      await flush();
      expect(tokens(control)).not.toContain(hover);

      pointer(control, 'pointerenter');
      pointer(control, 'pointerdown');
      await flush();
      control.remove();
      await flush();
      root.append(control);
      await flush();
      expect(tokens(control)).not.toContain(hover);
      expect(tokens(control)).not.toContain(pressed);
      expect(proposals).toHaveLength(1);
    });
  }
}
