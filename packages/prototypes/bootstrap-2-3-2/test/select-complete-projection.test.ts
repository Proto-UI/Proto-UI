import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  selectContent,
  selectGroup,
  selectItem,
  selectItemText,
  selectLabel,
  selectRoot,
  selectSeparator,
  selectSurface,
  selectTrigger,
  selectValue,
  selectViewport,
} from '../src/select';
import { fieldError, fieldLabel, fieldRoot } from '../src/field';
import fieldSelectTrigger from '../src/field/select-trigger.proto';
import type {
  Bootstrap232SelectGroupProps,
  Bootstrap232SelectLabelExposes,
  Bootstrap232SelectSeparatorAsHookContract,
} from '../src/select';
import type {
  SelectGroupProps,
  SelectLabelExposes,
  SelectSeparatorAsHookContract,
} from '@proto.ui/prototypes-base/select';

type Host = HTMLElement & { getExposes(): Record<string, any> };

for (const proto of [
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectSurface,
  selectViewport,
  selectItemText,
  selectItem,
  selectGroup,
  selectLabel,
  selectSeparator,
  fieldRoot,
  fieldLabel,
  fieldError,
  fieldSelectTrigger,
])
  AdaptToWebComponent(proto as any);

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  await flush();
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

function createSelect() {
  const root = document.createElement(selectRoot.name) as Host;
  const trigger = document.createElement(selectTrigger.name) as Host;
  const value = document.createElement(selectValue.name) as Host;
  const content = document.createElement(selectContent.name) as Host;
  const surface = document.createElement(selectSurface.name) as Host;
  const viewport = document.createElement(selectViewport.name) as Host;
  const alphaText = document.createElement(selectItemText.name) as Host;
  const alpha = document.createElement(selectItem.name) as Host;
  const group = document.createElement(selectGroup.name) as Host;
  const groupLabel = document.createElement(selectLabel.name) as Host;
  const beta = document.createElement(selectItem.name) as Host;
  const separator = document.createElement(selectSeparator.name) as Host;
  const plain = document.createElement(selectItem.name) as Host;
  setElementProps(root, { defaultOpen: true, defaultValue: 'alpha' });
  setElementProps(value, { placeholder: 'Choose one' });
  setElementProps(alpha, { value: 'alpha', textValue: 'Alpha' });
  setElementProps(beta, { value: 'beta', textValue: 'Beta' });
  setElementProps(plain, { value: 'plain', textValue: 'Plain' });
  alphaText.textContent = 'Alpha';
  groupLabel.textContent = 'Frameworks';
  beta.textContent = 'Beta';
  plain.textContent = 'Plain';
  separator.append(document.createElement('button'));
  alpha.append(alphaText);
  group.append(groupLabel, beta);
  viewport.append(alpha);
  surface.append(viewport);
  content.append(surface, group, separator, plain);
  trigger.append(value);
  root.append(trigger, content);
  document.body.append(root);
  return {
    root,
    trigger,
    value,
    content,
    surface,
    viewport,
    alphaText,
    alpha,
    group,
    groupLabel,
    beta,
    separator,
    plain,
  };
}

describe('prototypes/bootstrap-2-3-2: select complete projection', () => {
  it('publishes every anatomy part as a same-family named direct entry with Base contracts', () => {
    expectTypeOf<Bootstrap232SelectGroupProps>().toEqualTypeOf<SelectGroupProps>();
    expectTypeOf<Bootstrap232SelectLabelExposes>().toEqualTypeOf<SelectLabelExposes>();
    expectTypeOf<Bootstrap232SelectSeparatorAsHookContract>().toEqualTypeOf<SelectSeparatorAsHookContract>();
    const names = [
      selectRoot,
      selectTrigger,
      selectValue,
      selectContent,
      selectSurface,
      selectViewport,
      selectItemText,
      selectItem,
      selectGroup,
      selectLabel,
      selectSeparator,
      fieldSelectTrigger,
    ].map((proto) => proto.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.startsWith('bootstrap-2-3-2-')).toBe(true);
  });

  it('keeps same-family containment, scoped naming and the decorative contentless separator', async () => {
    vi.useFakeTimers();
    const {
      root,
      content,
      surface,
      viewport,
      alphaText,
      alpha,
      group,
      groupLabel,
      beta,
      separator,
      plain,
    } = createSelect();
    await settle();

    // Item-aligned structure: surface > viewport > item, group > label.
    expect(surface.contains(viewport)).toBe(true);
    expect(viewport.contains(alpha)).toBe(true);
    expect(alpha.contains(alphaText)).toBe(true);
    expect(group.contains(groupLabel)).toBe(true);
    expect(content.contains(separator)).toBe(true);

    expect(alpha.getAttribute('role')).toBe('option');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-labelledby')).toBe(groupLabel.id);
    expect(groupLabel.textContent).toBe('Frameworks');
    expect(alphaText.textContent).toBe('Alpha');

    // Bootstrap 2.3.2 nav-header paint on Label; nav-divider on Separator.
    for (const token of ['px-[15px]', 'py-[3px]', 'text-[11px]', 'font-bold', 'uppercase'])
      expect(styleContains(groupLabel, token)).toBe(true);
    for (const token of ['pointer-events-none', 'my-[9px]', 'mx-px', 'border-t', 'border-b'])
      expect(styleContains(separator, token)).toBe(true);
    expect(styleContains(viewport, 'overflow-y-auto')).toBe(true);
    expect(styleContains(alphaText, 'wrap-anywhere')).toBe(true);

    expect(separator.getAttribute('aria-hidden')).toBe('true');
    expect(separator.getAttribute('role')).toBeNull();
    expect(separator.querySelector('button')).toBeNull();

    // Wrappers and decorative parts never steal Item selection ownership.
    expect(root.getExposes().value.get()).toBe('alpha');
    beta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root.getExposes().value.get()).toBe('beta');
    expect(root.getExposes().textValue.get()).toBe('Beta');
    expect(plain.getAttribute('role')).toBe('option');
  });

  it('composes FieldSelectTrigger on one owner: binding relationships, invalid paint and shared caret', async () => {
    vi.useFakeTimers();
    const field = document.createElement(fieldRoot.name) as Host;
    const label = document.createElement(fieldLabel.name) as Host;
    const error = document.createElement(fieldError.name) as Host;
    const root = document.createElement(selectRoot.name) as Host;
    const trigger = document.createElement(fieldSelectTrigger.name) as Host;
    label.textContent = 'Choice';
    error.textContent = 'Invalid choice';
    setElementProps(root, { defaultValue: 'alpha' });
    root.append(trigger);
    field.append(label, root, error);
    document.body.append(field);
    await settle();

    expect(fieldSelectTrigger.name).toBe('bootstrap-2-3-2-field-select-trigger');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id);
    expect(trigger.getAttribute('aria-errormessage')).toBe(error.id);
    expect(trigger.getAttribute('aria-invalid')).toBe('false');
    // The Field composition shares the same-family caret glyph.
    expect(trigger.querySelector('svg path')?.getAttribute('d')).toBe('M7 10h10l-5 5z');

    // Field binding owns invalid; the same-family paint carries the field surface.
    setElementProps(field, { invalid: true, errors: ['Invalid choice'] });
    await settle();
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(styleContains(trigger, 'border-destructive')).toBe(true);
    expect(root.getExposes().value.get()).toBe('alpha');
    setElementProps(field, { invalid: false });
    await settle();
    expect(trigger.getAttribute('aria-invalid')).toBe('false');

    // FIELD_LABEL_PAIR still routes label activation to the composed trigger.
    label.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(document.activeElement).toBe(trigger);

    // Local readOnly gates Root value acceptance without disabling focus.
    setElementProps(trigger, { readOnly: true });
    await settle();
    expect(trigger.getAttribute('aria-readonly')).toBe('true');
    expect(
      root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
    ).toBe(false);
    setElementProps(trigger, { readOnly: false });
    await settle();
    expect(
      root.getExposes().requestValue({ value: 'beta', textValue: 'Beta', reason: 'keyboard' })
    ).toBe(true);
    expect(root.getExposes().value.get()).toBe('beta');
  });
});
