import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { selectRoot, selectTrigger, selectValue } from '../src/select';
for (const p of [selectRoot, selectTrigger, selectValue]) AdaptToWebComponent(p as any);
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
it('retains the real Select host, value part and focus while repainting the decorative chevron', async () => {
  vi.useFakeTimers();
  const root = document.createElement('shadcn-select-root') as any,
    trigger = document.createElement('shadcn-select-trigger') as any,
    value = document.createElement('shadcn-select-value') as any;
  setElementProps(root, { defaultValue: 'alpha' });
  trigger.append(value);
  root.append(trigger);
  document.body.append(root);
  await vi.advanceTimersByTimeAsync(0);
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  const beforeValue = root.getExposes().value.get();
  const oldSvg = trigger.querySelector('svg');
  setElementProps(root, { styleProfile: 'rhea' });
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
  expect(root.querySelector('shadcn-select-trigger')).toBe(trigger);
  expect(trigger.querySelector('shadcn-select-value')).toBe(value);
  expect(document.activeElement).toBe(trigger);
  expect(root.getExposes().value.get()).toBe(beforeValue);
  expect(trigger.getAttribute('data-pui-style')).toContain('rounded-[var(--pui-radius-2xl)]');
  expect(trigger.querySelector('svg')).not.toBeNull();
  expect(trigger.querySelector('svg')?.parentElement?.getAttribute('data-pui-style')).not.toContain(
    'opacity-50'
  );
  // Internal decorative SVG identity is intentionally not promised; caller parts are.
  expect(oldSvg).not.toBeNull();
});

import { fieldRoot, fieldLabel } from '@proto.ui/prototypes-base/field';
import { fieldSelectTrigger } from '../src/field';
for (const p of [fieldRoot, fieldLabel, fieldSelectTrigger]) AdaptToWebComponent(p as any);
it.each(['new-york-v4', 'rhea'])(
  'keeps Field invalid/focus contributions exclusive and restores them in %s',
  async (styleProfile) => {
    vi.useFakeTimers();
    const field = document.createElement(fieldRoot.name),
      root = document.createElement(selectRoot.name) as any,
      trigger = document.createElement(fieldSelectTrigger.name) as any,
      label = document.createElement(fieldLabel.name);
    label.textContent = 'Choice';
    trigger.textContent = 'Alpha';
    setElementProps(root, { defaultValue: 'alpha', styleProfile });
    root.append(trigger);
    field.append(label, root);
    document.body.append(field);
    await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.getExposes().focusSelf();
    await vi.advanceTimersByTimeAsync(0);
    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    const tokens = () => trigger.getAttribute('data-pui-style')!.split(/\s+/);
    expect(tokens()).toContain(styleProfile === 'rhea' ? 'ring-ring/30' : 'ring-ring/50');
    expect(tokens()).toContain('ring-3');
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      setElementProps(field, { invalid: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(trigger.getAttribute('aria-invalid')).toBe('true');
      expect(tokens()).toContain(theme === 'dark' ? 'ring-destructive/40' : 'ring-destructive/20');
      expect(tokens()).toContain(
        theme === 'dark' && styleProfile === 'rhea' ? 'border-destructive/50' : 'border-destructive'
      );
      expect(tokens()).not.toContain('ring-ring/30');
      expect(tokens()).not.toContain('ring-ring/50');
      expect(tokens()).toContain('ring-3');
      setElementProps(field, { invalid: false });
      await vi.advanceTimersByTimeAsync(0);
      expect(tokens()).toContain(styleProfile === 'rhea' ? 'ring-ring/30' : 'ring-ring/50');
      expect(tokens()).not.toContain('ring-destructive/20');
      expect(tokens()).not.toContain('ring-destructive/40');
      expect(tokens()).toContain('ring-3');
      expect(document.activeElement).toBe(trigger);
      expect(root.getExposes().value.get()).toBe('alpha');
    }
    document.documentElement.removeAttribute('data-theme');
  }
);

it('rejects an unmapped production Value profile', async () => {
  vi.useFakeTimers();
  const root = document.createElement(selectRoot.name),
    trigger = document.createElement(selectTrigger.name),
    value = document.createElement(selectValue.name);
  trigger.append(value);
  root.append(trigger);
  document.body.append(root);
  await vi.advanceTimersByTimeAsync(0);
  expect(() => setElementProps(value, { styleProfile: 'not-a-profile' })).toThrow(
    /Unsupported style|Unknown style/
  );
});

it('rejects Rhea ghost without redefining the New York extension', async () => {
  vi.useFakeTimers();
  const root = document.createElement(selectRoot.name),
    trigger = document.createElement(selectTrigger.name);
  root.append(trigger);
  document.body.append(root);
  await vi.advanceTimersByTimeAsync(0);
  setElementProps(trigger, { appearance: 'ghost' });
  await vi.advanceTimersByTimeAsync(0);
  expect(trigger.getAttribute('data-pui-style')).toContain('border-transparent');
  expect(() => setElementProps(root, { styleProfile: 'rhea' })).toThrow(/does not define ghost/);
});
