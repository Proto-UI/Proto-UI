import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcnFieldset from '../../shadcn/src/fieldset';
import * as neoFieldset from '../../brutalist/src/fieldset';
import * as bootstrapFieldset from '../../bootstrap-2-3-2/src/fieldset';
import neoLabel from '../../brutalist/src/label';
import shadcnLabel from '../../shadcn/src/label';
import bootstrapLabel from '../../bootstrap-2-3-2/src/label';
import * as neoField from '../../brutalist/src/field';
import * as shadcnField from '../../shadcn/src/field';

// Runtime projection evidence, not a generated-CSS or pixel-fidelity claim.
// Upstream versions/hashes and deliberate accessibility deltas are in the companion record.
for (const group of [shadcnFieldset, neoFieldset, bootstrapFieldset, neoField, shadcnField])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto as any);
for (const proto of [neoLabel, shadcnLabel, bootstrapLabel]) AdaptToWebComponent(proto);
const flush = async () => {
  for (let n = 0; n < 30; n++) await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
const tokens = (el: Element) => (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2']) {
  it(`${family} Fieldset is an unboxed group with its own source-based legend`, async () => {
    const root = document.createElement(`${family}-fieldset-root`);
    const legend = document.createElement(`${family}-fieldset-legend`);
    const description = document.createElement(`${family}-fieldset-description`);
    legend.textContent = 'Contact preferences';
    description.textContent = 'Choose how to hear from us.';
    root.append(legend, description);
    document.body.append(root);
    await flush();
    for (const oldShell of [
      'p-4',
      'border',
      'border-2',
      'rounded-lg',
      'rounded-none',
      'rounded-[4px]',
    ])
      expect(tokens(root)).not.toContain(oldShell);
    expect(root.getAttribute('aria-labelledby')).toBe(legend.id);
    expect(root.getAttribute('aria-describedby')).toBe(description.id);
    if (family === 'bootstrap-2-3-2') {
      expect(tokens(root)).toEqual(expect.arrayContaining(['m-0', 'p-0', 'border-0']));
      expect(tokens(legend)).toEqual(
        expect.arrayContaining([
          'text-[1.3125rem]',
          'leading-[2.5rem]',
          'mb-5',
          'border-b',
          'font-normal',
        ])
      );
    } else {
      expect(tokens(root)).toContain('gap-4');
      expect(tokens(legend)).toEqual(
        expect.arrayContaining(['mb-1.5', family === 'brutalist' ? 'font-bold' : 'font-medium'])
      );
      expect(tokens(legend)).not.toContain('uppercase');
    }
    if (family === 'brutalist')
      expect(tokens(description)).toEqual(
        expect.arrayContaining(['font-medium', 'text-foreground'])
      );
  });
}
it('standalone Labels retain their own family typography and layout', async () => {
  const [neo, shadcn, bootstrap] = [neoLabel, shadcnLabel, bootstrapLabel].map((p) =>
    document.createElement(p.name)
  );
  document.body.append(neo, shadcn, bootstrap);
  await flush();
  expect(tokens(neo)).toEqual(expect.arrayContaining(['font-sans', 'font-bold']));
  expect(tokens(shadcn)).toEqual(expect.arrayContaining(['flex', 'items-center', 'gap-2']));
  expect(tokens(bootstrap)).toEqual(
    expect.arrayContaining(['block', 'mb-[0.3125rem]', 'leading-5', 'font-normal'])
  );
  for (const el of [neo, shadcn, bootstrap]) expect(tokens(el)).not.toContain('select-none');
});
for (const family of ['shadcn', 'brutalist']) {
  it(`${family} Field paints inherited validity while its editor retains value, focus and disabled ownership`, async () => {
    const root = document.createElement(`${family}-field-root`) as any;
    const label = document.createElement(`${family}-field-label`);
    const control = document.createElement(`${family}-field-control`) as any;
    const error = document.createElement(`${family}-field-error`);
    setElementProps(control, { defaultValue: 'Ada' });
    label.textContent = 'Name';
    root.append(label, control, error);
    document.body.append(root);
    await flush();
    const input = () =>
      (control.shadowRoot?.querySelector('input') ??
        control.querySelector('input')) as HTMLInputElement;
    expect(input().value).toBe('Ada');
    if (family === 'brutalist') {
      expect(tokens(input())).toEqual(
        expect.arrayContaining([
          'h-10',
          'rounded-base',
          'bg-secondary-background',
          'text-sm',
          'font-sans',
          'font-medium',
        ])
      );
      expect(tokens(input()).some((x) => x.startsWith('shadow-'))).toBe(false);
    } else {
      expect(tokens(input())).toEqual(
        expect.arrayContaining(['h-8', 'rounded-lg', 'px-2.5', 'bg-transparent', 'text-base'])
      );
      expect(tokens(input())).not.toContain('shadow-xs');
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    control.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(control.getExposes().focusVisible.get()).toBe(true);
    expect(tokens(input())).toContain('data-[focus-visible]:forced-colors-focus-outline');
    if (family === 'shadcn')
      expect(tokens(input())).toEqual(
        expect.arrayContaining([
          'data-[focus-visible]:border-ring',
          'data-[focus-visible]:ring-3',
          'data-[focus-visible]:ring-ring/50',
        ])
      );
    setElementProps(root, { invalid: true, errors: ['Enter a valid name'] });
    await flush();
    expect(root.getExposes().invalid.get()).toBe(true);
    expect(tokens(root)).toContain(
      family === 'shadcn'
        ? 'data-[invalid]:text-destructive'
        : 'data-[invalid]:text-destructive-ink'
    );
    expect(root.hasAttribute('data-invalid')).toBe(true);
    if (family === 'brutalist') {
      expect(tokens(error)).toEqual(
        expect.arrayContaining(['font-medium', 'text-destructive-ink'])
      );
      expect(tokens(error)).not.toContain('border-l-2');
    }
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().value).toBe('Ada');
    expect(error.getAttribute('role')).not.toBe('alert');
    if (family === 'shadcn')
      expect(tokens(input())).toEqual(
        expect.arrayContaining(['border-destructive', 'ring-3', 'ring-destructive/20'])
      );
    setElementProps(root, { disabled: true });
    await flush();
    expect(input().disabled).toBe(true);
    if (family === 'shadcn') expect(tokens(input())).toContain('data-[disabled]:bg-input/50');
    setElementProps(root, { disabled: false, invalid: false });
    await flush();
    expect(input().value).toBe('Ada');
    expect(input().disabled).toBe(false);
    expect(root.hasAttribute('data-invalid')).toBe(false);
  });
}
