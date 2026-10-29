import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { formRoot, formField, formSubmit, formReset } from '../src/form';
import { fieldControl, fieldLabel, fieldDescription, fieldError } from '../src/field';
import { fieldsetRoot, fieldsetLegend, fieldsetDescription } from '../src/fieldset';
import { styleScope } from '../src/style-scope';

AdaptToWebComponent(formRoot);
AdaptToWebComponent(formField);
AdaptToWebComponent(formSubmit);
AdaptToWebComponent(formReset);
AdaptToWebComponent(fieldControl);
AdaptToWebComponent(fieldLabel);
AdaptToWebComponent(fieldDescription);
AdaptToWebComponent(fieldError);
AdaptToWebComponent(fieldsetRoot);
AdaptToWebComponent(fieldsetLegend);
AdaptToWebComponent(fieldsetDescription);
AdaptToWebComponent(styleScope);

type ActionConsumer = {
  disabled: { get(): boolean };
  hovered: { get(): boolean };
  pressed: { get(): boolean };
};
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
const element = <Exposes = never>(name: string, props: Record<string, unknown> = {}) => {
  // Real custom elements registered above, with only the consumed public projection typed here.
  const node = document.createElement(name) as HTMLElement & { getExposes(): Exposes };
  setElementProps(node, props);
  return node;
};
const tokens = (node: Element) => (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('source-bound Form action and policy compositions', () => {
  it.each([
    ['vega', 'h-9', 'rounded-md'],
    ['nova', 'h-8', 'rounded-lg'],
    ['maia', 'h-9', 'rounded-[var(--pui-radius-4xl)]'],
    ['lyra', 'h-8', 'rounded-none'],
    ['mira', 'h-7', 'rounded-md'],
    ['luma', 'h-9', 'rounded-[var(--pui-radius-4xl)]'],
    ['sera', 'h-10', 'rounded-none'],
    ['rhea', 'h-8', 'rounded-[var(--pui-radius-2xl)]'],
    ['new-york-v4', 'h-9', 'rounded-md'],
  ])(
    '%s action paint leaves submit/reset and press cancellation at Base',
    async (profile, height, radius) => {
      const scope = element(styleScope.name, { styleProfile: profile });
      const form = element(formRoot.name);
      const submit = element<ActionConsumer>(formSubmit.name);
      const reset = element<ActionConsumer>(formReset.name);
      submit.textContent = 'Save';
      reset.textContent = 'Reset';
      form.append(submit, reset);
      scope.append(form);
      document.body.append(scope);
      await flush();
      let submissions = 0;
      let resets = 0;
      form.addEventListener('submit', () => submissions++);
      form.addEventListener('reset', () => resets++);
      for (const action of [submit, reset]) {
        expect(tokens(action)).toEqual(expect.arrayContaining([height, radius]));
        expect(action.getAttribute('role')).toBe('button');
      }
      const pressed = submit.getExposes().pressed;
      submit.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      submit.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0 })
      );
      await flush();
      expect(pressed.get()).toBe(true);
      setElementProps(scope, { styleProfile: profile === 'sera' ? 'maia' : 'sera' });
      await flush();
      expect(submit.getExposes().pressed).toBe(pressed);
      expect(pressed.get()).toBe(true);
      submit.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 7, button: 0 })
      );
      submit.click();
      reset.click();
      await flush();
      expect(submissions).toBe(1);
      expect(resets).toBe(1);
      setElementProps(form, { disabled: true });
      await flush();
      expect(submit.getExposes().disabled.get()).toBe(true);
      expect(submit.getExposes().hovered.get()).toBe(false);
      expect(pressed.get()).toBe(false);
      submit.click();
      reset.click();
      await flush();
      expect(submissions).toBe(1);
      expect(resets).toBe(1);
      setElementProps(reset, { disabled: true, styleProfile: 'new-york' });
      setElementProps(form, {});
      await flush();
      expect(submit.getExposes().disabled.get()).toBe(false);
      expect(reset.getExposes().disabled.get()).toBe(true);
      expect(tokens(reset)).toContain('px-4');
      setElementProps(reset, {});
      await flush();
      expect(reset.getExposes().disabled.get()).toBe(false);
      expect(tokens(reset)).not.toContain('px-4');
      expect(form.querySelectorAll('[role="button"]')).toHaveLength(2);
    }
  );

  it('updates Fieldset/Legend source scales without replacing Field registration, editor or relations', async () => {
    const scope = element(styleScope.name, { styleProfile: 'nova' });
    const form = element<{ getValues(): Record<string, unknown> }>(formRoot.name);
    const group = element(fieldsetRoot.name, { disabled: true });
    const legend = element(fieldsetLegend.name);
    const groupHint = element(fieldsetDescription.name);
    const field = element(formField.name, { name: 'name' });
    const label = element(fieldLabel.name);
    const hint = element(fieldDescription.name);
    const error = element(fieldError.name);
    const control = element(fieldControl.name, { defaultValue: 'Ada' });
    legend.textContent = 'Contact';
    groupHint.textContent = 'Profile settings';
    label.textContent = 'Name';
    hint.textContent = 'Public display name';
    field.append(label, hint, control, error);
    group.append(legend, groupHint, field);
    form.append(group);
    scope.append(form);
    document.body.append(scope);
    await flush();
    const editor = control.querySelector('input')!;
    expect(editor.disabled).toBe(true);
    expect(group.getAttribute('aria-labelledby')).toBe(legend.id);
    expect(group.getAttribute('aria-describedby')).toBe(groupHint.id);
    expect(editor.getAttribute('aria-labelledby')).toBe(label.id);
    expect(tokens(group)).toContain('gap-4');
    expect(tokens(legend)).toContain('mb-1.5');
    // Form snapshots include enabled named Fields; disabling a Fieldset must
    // exclude the Field without erasing its canonical editor value.
    expect(editor.value).toBe('Ada');
    expect(form.getExposes().getValues()).toEqual({});
    setElementProps(scope, { styleProfile: 'sera' });
    setElementProps(group, {});
    setElementProps(legend, { variant: 'label' });
    await flush();
    expect(control.querySelector('input')).toBe(editor);
    expect(editor.value).toBe('Ada');
    expect(editor.disabled).toBe(false);
    expect(tokens(group)).toContain('gap-6');
    expect(tokens(group)).not.toContain('gap-4');
    expect(tokens(legend)).toEqual(
      expect.arrayContaining(['mb-3', 'text-xs', 'uppercase', 'font-semibold'])
    );
    expect(tokens(legend)).not.toContain('mb-1.5');
    expect(tokens(label)).toContain('tracking-wide');
    expect(form.getExposes().getValues()).toEqual({ name: 'Ada' });
    setElementProps(scope, { styleProfile: 'mira' });
    await flush();
    expect(tokens(legend)).toEqual(expect.arrayContaining(['mb-2', 'text-xs', 'leading-relaxed']));
    expect(tokens(legend)).not.toContain('uppercase');
    expect(group.getAttribute('aria-labelledby')).toBe(legend.id);
    expect(editor.getAttribute('aria-describedby')).toContain(hint.id);
  });
});
