import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import * as shadcnForm from '../../shadcn/src/form';
import * as neoForm from '../../brutalist/src/form';
import * as bootstrapForm from '../../bootstrap-2-3-2/src/form';
import * as liquidForm from '../../liquid-glass/src/form';
import * as shadcnField from '../../shadcn/src/field';
import * as neoField from '../../brutalist/src/field';
import * as bootstrapField from '../../bootstrap-2-3-2/src/field';
import * as liquidField from '../../liquid-glass/src/field';

// Actual adapter/state projection evidence. Happy DOM does not prove inherited CSS paint.
for (const group of [
  shadcnForm,
  neoForm,
  bootstrapForm,
  liquidForm,
  shadcnField,
  neoField,
  bootstrapField,
  liquidField,
])
  for (const proto of Object.values(group))
    if (typeof proto === 'object' && proto && 'setup' in proto) AdaptToWebComponent(proto);

const flush = async () => {
  for (let n = 0; n < 30; n++) await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
const tokens = (el: Element) => (el.getAttribute('data-pui-style') ?? '').split(/\s+/);
type Root = HTMLElement & { getExposes(): ProtoAdapterExposes<typeof shadcnForm.formRoot> };
type Field = HTMLElement & { getExposes(): ProtoAdapterExposes<typeof shadcnForm.formField> };
type Control = HTMLElement & { getExposes(): ProtoAdapterExposes<typeof shadcnField.fieldControl> };

function mount(family: string, props: Record<string, unknown> = {}) {
  const form = document.createElement(`${family}-form-root`) as Root;
  const field = document.createElement(`${family}-form-field`) as Field;
  const label = document.createElement(`${family}-field-label`);
  const control = document.createElement(`${family}-field-control`) as Control;
  const error = document.createElement(`${family}-field-error`);
  label.textContent = 'Display name';
  setElementProps(field, { name: 'displayName', required: true, ...props });
  field.append(label, control, error);
  form.append(field);
  document.body.append(form);
  return {
    form,
    field,
    label,
    control,
    error,
    editor: () => (control.shadowRoot?.querySelector('input') ?? control.querySelector('input'))!,
  };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
  const ink = family === 'shadcn' ? 'text-destructive' : 'text-destructive-ink';
  const projectsInk = family === 'shadcn' || family === 'brutalist';
  it(`${family} FormField keeps validation, error relations and reset under the inherited owner`, async () => {
    const { form, field, control, error, editor } = mount(family);
    const invalid: unknown[] = [],
      submitted: unknown[] = [];
    form.addEventListener('invalid', (event) => {
      if (event instanceof CustomEvent) invalid.push(event.detail);
    });
    form.addEventListener('submit', (event) => {
      if (event instanceof CustomEvent) submitted.push(event.detail);
    });
    await flush();
    expect(field.getExposes().invalid.get()).toBe(false);
    expect(form.getExposes().requestSubmit()).toBe(true);
    await flush();
    // These observations establish real invalid state before the discriminating paint assertion.
    expect(invalid).toEqual([{ names: ['displayName'] }]);
    expect(submitted).toHaveLength(0);
    expect(field.getExposes().invalid.get()).toBe(true);
    expect(editor().getAttribute('aria-invalid')).toBe('true');
    expect(editor().getAttribute('aria-errormessage')).toBe(error.id);
    expect(error.textContent).toMatch(/required/i);
    expect(control.getExposes().focused.get()).toBe(true);
    if (projectsInk) {
      expect(tokens(field)).toContain(`data-[invalid]:${ink}`);
      expect(field.hasAttribute('data-invalid')).toBe(true);
    } else {
      // No new visual policy is inferred for Bootstrap or Liquid from the other families.
      expect(tokens(field).some((token) => /invalid.*text-/.test(token))).toBe(false);
    }
    editor().value = 'Ada';
    editor().dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await flush();
    form.getExposes().requestSubmit();
    await flush();
    expect(submitted).toHaveLength(1);
    expect(form.getExposes().getValues()).toEqual({ displayName: 'Ada' });
    expect(field.getExposes().invalid.get()).toBe(false);
    expect(field.hasAttribute('data-invalid')).toBe(false);
    expect(editor().hasAttribute('aria-errormessage')).toBe(false);
    expect(form.getExposes().requestReset()).toBe(true);
    await flush();
    expect(editor().value).toBe('');
    expect(field.getExposes().invalid.get()).toBe(false);
    expect(field.hasAttribute('data-invalid')).toBe(false);
    expect(form.getExposes().submitted.get()).toBe(false);
  });
  if (!projectsInk) continue;
  it(`${family} FormField paint follows controlled owner acceptance, never the validation proposal`, async () => {
    const { form, field, error, editor } = mount(family, { invalid: false });
    const proposals: unknown[] = [];
    field.addEventListener('validityChange', (event) =>
      proposals.push((event as CustomEvent).detail)
    );
    await flush();
    form.getExposes().requestSubmit();
    await flush();
    expect(proposals).toHaveLength(1);
    expect(field.getExposes().invalid.get()).toBe(false);
    expect(field.hasAttribute('data-invalid')).toBe(false);
    setElementProps(field, { invalid: true, errors: ['Owner rejected this value'] });
    await flush();
    expect(field.getExposes().invalid.get()).toBe(true);
    expect(tokens(field)).toContain(`data-[invalid]:${ink}`);
    expect(field.hasAttribute('data-invalid')).toBe(true);
    expect(editor().getAttribute('aria-invalid')).toBe('true');
    expect(error.textContent).toContain('Owner rejected this value');
    setElementProps(field, { invalid: false, errors: [] });
    await flush();
    expect(field.hasAttribute('data-invalid')).toBe(false);
    expect(editor().hasAttribute('aria-errormessage')).toBe(false);
    expect(proposals).toHaveLength(1);
  });
}
