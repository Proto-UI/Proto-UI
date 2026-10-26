import { describe, expect, it } from 'vitest';
import { isControlLabelRef, validateInstanceAssociations } from '@proto.ui/core';
import {
  checkboxRoot,
  checkboxIndicator,
  createShadcnCheckboxLabelComposition,
  shadcnCheckboxLabelComposition,
  shadcnCheckboxComponentPreset,
} from '../src/checkbox';
import labelRoot from '../src/label';

describe('Shadcn recommended Checkbox and Label construction', () => {
  it('references the public atoms and existing indicator replacement policy', () => {
    const recipe = shadcnCheckboxLabelComposition;
    expect(recipe.parts).toEqual({
      control: checkboxRoot,
      indicator: checkboxIndicator,
      label: labelRoot,
    });
    expect(recipe.parts.control).toBe(checkboxRoot);
    expect(recipe.parts.indicator).toBe(checkboxIndicator);
    expect(recipe.parts.label).toBe(labelRoot);
    expect(recipe.defaultPart).toBe(shadcnCheckboxComponentPreset);
    expect(recipe.structure).toEqual({
      siblings: ['control', 'label'],
      indicatorParent: 'control',
    });
    expect(recipe.association).toEqual({
      kind: 'controlLabel',
      participants: ['control', 'label'],
    });
    expect(recipe.labelProps).toEqual({ naming: true, activation: true });
  });

  it('shares one admitted association inside each instance, never across instances', () => {
    const one = createShadcnCheckboxLabelComposition();
    const two = createShadcnCheckboxLabelComposition();
    expect(one.recipe).toBe(shadcnCheckboxLabelComposition);
    expect(one.control.instanceAssociations).toBe(one.label.instanceAssociations);
    expect(one.label.props).toBe(one.recipe.labelProps);
    expect(isControlLabelRef(one.control.instanceAssociations.controlLabel)).toBe(true);
    expect(validateInstanceAssociations(one.control.instanceAssociations).controlLabel).toBe(
      one.label.instanceAssociations.controlLabel
    );
    expect(two.control.instanceAssociations.controlLabel).not.toBe(
      one.control.instanceAssociations.controlLabel
    );
    expect(() => JSON.stringify(one.control.instanceAssociations)).toThrow(/cannot be serialized/);
    expect(Object.keys(one)).toEqual(['recipe', 'control', 'label']);
    expect(Object.keys(one.control)).toEqual(['instanceAssociations']);
    expect(Object.keys(one.label)).toEqual(['instanceAssociations', 'props']);
  });

  it('freezes recommendation containers and instance inputs without freezing or replacing atoms', () => {
    const shared = [checkboxRoot, checkboxIndicator, labelRoot, shadcnCheckboxComponentPreset];
    const frozenBefore = shared.map(Object.isFrozen);
    const instance = createShadcnCheckboxLabelComposition();
    expect(instance.recipe.defaultPart).toBe(shadcnCheckboxComponentPreset);
    expect(shared.map(Object.isFrozen)).toEqual(frozenBefore);
    // The existing preset is deliberately not part of a deep-freeze promise.
    expect(Object.isFrozen(shadcnCheckboxComponentPreset)).toBe(false);
    for (const value of [
      instance,
      instance.control,
      instance.label,
      instance.control.instanceAssociations,
      instance.recipe,
      instance.recipe.parts,
      instance.recipe.structure,
      instance.recipe.structure.siblings,
      instance.recipe.association,
      instance.recipe.association.participants,
      instance.recipe.labelProps,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(() => {
      (instance.label.props as { naming: boolean }).naming = false;
    }).toThrow(TypeError);
    expect(createShadcnCheckboxLabelComposition().label.props.naming).toBe(true);
  });
});

// Synthetic host input, not trusted/native browser acceptance.
import { afterEach } from 'vitest';
import {
  AdaptToWebComponent,
  setElementAssociations,
  setElementProps,
} from '@proto.ui/adapter-web-component';
for (const prototype of Object.values(shadcnCheckboxLabelComposition.parts))
  AdaptToWebComponent(prototype);
async function settle() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
function press(element: HTMLElement) {
  element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  element.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  element.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}
function mount(props: Record<string, unknown> = {}) {
  const pair = createShadcnCheckboxLabelComposition();
  const control = document.createElement(pair.recipe.parts.control.name);
  const indicator = document.createElement(pair.recipe.parts.indicator.name);
  const label = document.createElement(pair.recipe.parts.label.name);
  control.append(indicator);
  label.textContent = 'Receive updates';
  setElementProps(control, props);
  setElementProps(label, pair.label.props);
  setElementAssociations(control, pair.control.instanceAssociations);
  setElementAssociations(label, pair.label.instanceAssociations);
  document.body.append(control, label);
  return { pair, control, label };
}
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('recommended construction through existing Web Component association', () => {
  it('uses rich visible naming, one activation, direct control behavior, and nested-action exclusion', async () => {
    const first = mount(),
      other = mount();
    const strong = document.createElement('strong');
    strong.textContent = 'Receive updates';
    const icon = document.createElement('span');
    icon.textContent = '✓';
    icon.setAttribute('aria-hidden', 'true');
    first.label.replaceChildren(icon, strong);
    let changes = 0;
    first.control.addEventListener('checkedChange', () => changes++);
    await settle();
    expect(first.label.id).not.toBe('');
    expect(first.control.getAttribute('aria-labelledby')).toBe(first.label.id);
    expect(first.control.getAttribute('aria-label')).toBeNull();
    expect(first.label.tabIndex).toBe(-1);
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    press(strong);
    await settle();
    expect(changes).toBe(1);
    expect(first.control.getAttribute('aria-checked')).toBe('true');
    expect(other.control.getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(first.control);
    press(first.control);
    await settle();
    expect(changes).toBe(2);
    expect(first.control.getAttribute('aria-checked')).toBe('false');
    const child = document.createElement('button');
    child.textContent = 'Separate action';
    let actions = 0;
    child.addEventListener('click', () => actions++);
    first.label.append(child);
    press(child);
    await settle();
    expect(actions).toBe(1);
    expect(changes).toBe(2);
  });

  it('preserves disabled, mixed, controlled rejection and raw naming-only behavior', async () => {
    const disabled = mount({ disabled: true, defaultChecked: true });
    const mixed = mount({ defaultIndeterminate: true });
    const controlled = mount({ checked: false });
    let blocked = 0,
      changes = 0,
      requests = 0;
    disabled.control.addEventListener('checkedChange', () => blocked++);
    mixed.control.addEventListener('checkedChange', () => changes++);
    controlled.control.addEventListener('checkedChange', () => requests++);
    await settle();
    expect(mixed.control.getAttribute('aria-checked')).toBe('mixed');
    press(disabled.label);
    await settle();
    expect(blocked).toBe(0);
    expect(disabled.control.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).not.toBe(disabled.control);
    press(mixed.label);
    await settle();
    expect(changes).toBe(1);
    expect(mixed.control.getAttribute('aria-checked')).toBe('true');
    press(controlled.label);
    await settle();
    expect(requests).toBe(1);
    expect(controlled.control.getAttribute('aria-checked')).toBe('false');
    setElementProps(controlled.label, { naming: true, activation: false });
    await settle();
    expect(controlled.label.getAttribute('data-pui-style') ?? '').not.toContain('select-none');
    press(controlled.label);
    await settle();
    expect(requests).toBe(1);
    expect(controlled.control.getAttribute('aria-labelledby')).toBe(controlled.label.id);
  });

  it('rebinds both inputs, isolates neighbors and retires detached label input', async () => {
    const pair = mount({ checked: false }),
      neighbor = mount();
    let requests = 0;
    pair.control.addEventListener('checkedChange', () => requests++);
    await settle();
    press(pair.label);
    await settle();
    expect(requests).toBe(1);
    const replacement = createShadcnCheckboxLabelComposition();
    setElementAssociations(pair.control, replacement.control.instanceAssociations);
    setElementAssociations(pair.label, replacement.label.instanceAssociations);
    await settle();
    expect(pair.control.getAttribute('aria-labelledby')).toBe(pair.label.id);
    // An old-domain label must not reach the control after both inputs rebind.
    // Without this negative control, ignoring both updates could still pass.
    const oldLabel = document.createElement(pair.pair.recipe.parts.label.name);
    oldLabel.textContent = 'Retired association';
    setElementProps(oldLabel, pair.pair.label.props);
    setElementAssociations(oldLabel, pair.pair.label.instanceAssociations);
    document.body.append(oldLabel);
    await settle();
    press(oldLabel);
    await settle();
    expect(requests).toBe(1);
    expect(pair.control.getAttribute('aria-checked')).toBe('false');
    expect(neighbor.control.getAttribute('aria-checked')).toBe('false');
    press(pair.label);
    await settle();
    expect(requests).toBe(2);
    pair.label.remove();
    pair.control.remove();
    await settle();
    press(pair.label);
    await settle();
    expect(requests).toBe(2);
    expect(neighbor.control.getAttribute('aria-checked')).toBe('false');
    press(neighbor.label);
    await settle();
    expect(neighbor.control.getAttribute('aria-checked')).toBe('true');
  });
});
