import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
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

function createSelect(parent: HTMLElement = document.body, fieldBound = false) {
  const root = document.createElement(selectRoot.name) as Host;
  const trigger = document.createElement(
    fieldBound ? fieldSelectTrigger.name : selectTrigger.name
  ) as Host;
  const value = document.createElement(selectValue.name) as Host;
  const content = document.createElement(selectContent.name) as Host;
  const surface = document.createElement(selectSurface.name) as Host;
  const viewport = document.createElement(selectViewport.name) as Host;
  const alphaText = document.createElement(selectItemText.name) as Host;
  const alpha = document.createElement(selectItem.name) as Host;
  const group = document.createElement(selectGroup.name) as Host;
  const groupLabel = document.createElement(selectLabel.name) as Host;
  const beta = document.createElement(selectItem.name) as Host;
  const betaText = document.createElement(selectItemText.name) as Host;
  const separator = document.createElement(selectSeparator.name) as Host;
  const plain = document.createElement(selectItem.name) as Host;
  const plainText = document.createElement(selectItemText.name) as Host;
  setElementProps(root, { defaultOpen: true, defaultValue: 'alpha' });
  setElementProps(value, { placeholder: 'Choose one' });
  setElementProps(alpha, { value: 'alpha', textValue: 'Alpha' });
  setElementProps(beta, { value: 'beta', textValue: 'Beta' });
  setElementProps(plain, { value: 'plain', textValue: 'Plain' });
  alphaText.textContent = 'Alpha';
  groupLabel.textContent = 'Frameworks';
  betaText.textContent = 'Beta';
  plainText.textContent = 'Plain';
  separator.append(document.createElement('button'));
  alpha.append(alphaText);
  beta.append(betaText);
  plain.append(plainText);
  group.append(groupLabel, beta);
  viewport.append(alpha, group, separator, plain);
  surface.append(viewport);
  content.append(surface);
  trigger.append(value);
  root.append(trigger, content);
  parent.append(root);
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
    betaText,
    separator,
    plain,
  };
}

describe('prototypes/bootstrap-2-3-2: select complete projection', () => {
  it('retains selection and caller text through scoped groups and a contentless separator', async () => {
    vi.useFakeTimers();
    const { root, trigger, alphaText, alpha, group, groupLabel, beta, betaText, separator, plain } =
      createSelect();
    await settle();

    expect(alpha.getAttribute('role')).toBe('option');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-labelledby')).toBe(groupLabel.id);
    expect(
      root
        .getExposes()
        .getCollectionItems()
        .map((entry: { value: string }) => entry.value)
    ).toEqual(['alpha', 'beta', 'plain']);

    expect(separator.getAttribute('aria-hidden')).toBe('true');
    expect(separator.getAttribute('role')).toBeNull();
    expect(separator.querySelector('button')).toBeNull();
    expect(trigger.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    expect(trigger.textContent).toBe('Alpha');
    expect(alpha.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    expect(alpha.textContent).toBe('Alpha');
    expect(beta.querySelector('svg')).toBeNull();

    // Wrappers and decorative parts never steal Item selection ownership.
    expect(root.getExposes().value.get()).toBe('alpha');
    beta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root.getExposes().value.get()).toBe('beta');
    expect(root.getExposes().textValue.get()).toBe('Beta');
    expect(alpha.querySelector(selectItemText.name)).toBe(alphaText);
    expect(beta.querySelector(selectItemText.name)).toBe(betaText);
    expect(betaText.textContent).toBe('Beta');
    expect(alpha.querySelector('svg')).toBeNull();
    expect(beta.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    expect(beta.textContent).toBe('Beta');
    expect(plain.getAttribute('role')).toBe('option');
  });

  it('withdraws ambiguous group names and rebinds the current label without changing selection', async () => {
    vi.useFakeTimers();
    const { root, group, groupLabel, beta } = createSelect();
    await settle();
    const duplicate = document.createElement(selectLabel.name);
    duplicate.textContent = 'Duplicate';
    group.append(duplicate);
    await settle();
    expect(group.getAttribute('aria-labelledby')).toBeNull();
    duplicate.remove();
    await settle();
    expect(group.getAttribute('aria-labelledby')).toBe(groupLabel.id);
    groupLabel.remove();
    await settle();
    expect(group.getAttribute('aria-labelledby')).toBeNull();
    const replacement = document.createElement(selectLabel.name);
    replacement.textContent = 'Current choices';
    group.prepend(replacement);
    await settle();
    expect(group.getAttribute('aria-labelledby')).toBe(replacement.id);
    expect(root.getExposes().value.get()).toBe('alpha');
    beta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root.getExposes().value.get()).toBe('beta');
  });

  it('composes FieldSelectTrigger relationships and policy on the existing Select owner', async () => {
    vi.useFakeTimers();
    const field = document.createElement(fieldRoot.name) as Host;
    const label = document.createElement(fieldLabel.name) as Host;
    const error = document.createElement(fieldError.name) as Host;
    label.textContent = 'Choice';
    error.textContent = 'Invalid choice';
    field.append(label);
    const { root, trigger } = createSelect(field, true);
    setElementProps(root, { defaultOpen: false, defaultValue: 'alpha' });
    field.append(error);
    document.body.append(field);
    await settle();

    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-labelledby')).toBe(label.id);
    // aria-errormessage is only projected while the Field reports invalid;
    // a present-but-valid error part supplies no premature relation.
    expect(trigger.getAttribute('aria-errormessage')).toBeNull();
    expect(trigger.getAttribute('aria-invalid')).toBe('false');
    // Field binding owns invalid without rewriting Select's committed value.
    setElementProps(field, { invalid: true, errors: ['Invalid choice'] });
    await settle();
    expect(trigger.getAttribute('aria-errormessage')).toBe(error.id);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(root.getExposes().value.get()).toBe('alpha');
    setElementProps(field, { invalid: false });
    await settle();
    expect(trigger.getAttribute('aria-invalid')).toBe('false');

    // FIELD_LABEL_PAIR refuses untrusted synthetic clicks by design; the same
    // paired target still accepts its own focus route.
    label.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(document.activeElement).not.toBe(trigger);
    trigger.getExposes().focusSelf();
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
