import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { radioGroupRoot, radioGroupItem, radioGroupIndicator } from '../src/radio-group';
import { switchThumb } from '../src/switch';
import { fieldRoot, fieldLabel, fieldDescription, fieldError } from '../src/field';
import fieldTextarea from '../src/field/textarea.proto';
import fieldSwitch from '../src/field/switch.proto';

type ReadState<T> = { get(): T };
type HostExposes = {
  value: ReadState<string>;
  checked: ReadState<boolean>;
  disabled: ReadState<boolean>;
  invalid: ReadState<boolean>;
  isChecked(): boolean;
  requestValue(value: string): boolean;
  getValidity(): { filled: boolean };
};
type Host = HTMLElement & { getExposes(): HostExposes };

for (const part of [
  radioGroupRoot,
  radioGroupItem,
  radioGroupIndicator,
  switchThumb,
  fieldRoot,
  fieldLabel,
  fieldDescription,
  fieldError,
  fieldTextarea,
  fieldSwitch,
])
  AdaptToWebComponent(part);

// Real timer flush: the Proto runtime schedules lifecycle/feedback work through
// delay(0), so fake timers would deadlock the WC adapter behavior under test.
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  await promise;
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

async function click(el: HTMLElement) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
}

function radioItem(value: string, disabled = false): Host {
  const item = document.createElement(radioGroupItem.name) as Host;
  setElementProps(item, { value, disabled });
  item.appendChild(document.createElement(radioGroupIndicator.name));
  item.appendChild(document.createTextNode(value));
  return item;
}

async function mountRadioGroup(props: Record<string, unknown> = {}, items: Host[] = []) {
  const root = document.createElement(radioGroupRoot.name) as Host;
  setElementProps(root, props);
  root.append(...items);
  document.body.appendChild(root);
  await settle();
  return { root, items };
}

function mountField(
  controlName: string,
  controlProps: Record<string, unknown> = {},
  fieldProps: Record<string, unknown> = {},
  child?: HTMLElement
) {
  const field = document.createElement(fieldRoot.name) as Host;
  const control = document.createElement(controlName) as Host;
  const label = document.createElement(fieldLabel.name);
  label.textContent = 'Label';
  const description = document.createElement(fieldDescription.name);
  description.textContent = 'Description';
  const error = document.createElement(fieldError.name);
  setElementProps(field, fieldProps);
  setElementProps(control, controlProps);
  if (child) control.appendChild(child);
  field.append(label, description, control, error);
  document.body.appendChild(field);
  return { field, control, label, description, error };
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('bootstrap-2-3-2: Radio Group draft parts (simulated WC host)', () => {
  it('selects through one root owner and mirrors checked on the indicator part', async () => {
    const itemA = radioItem('a');
    const itemB = radioItem('b');
    const changes: string[] = [];
    const { root } = await mountRadioGroup({ a11yLabel: 'Shipping' }, [itemA, itemB]);
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });

    expect(root.getAttribute('role')).toBe('radiogroup');
    expect(root.getAttribute('aria-label')).toBe('Shipping');
    expect(itemA.getAttribute('role')).toBe('radio');
    expect(itemB.getAttribute('role')).toBe('radio');
    expect(root.getExposes().value.get()).toBe('');
    expect(itemA.getExposes().checked.get()).toBe(false);
    // First enabled item owns the roving entry.
    expect(itemA.tabIndex).toBe(0);
    expect(itemB.tabIndex).toBe(-1);

    const indicatorB = itemB.querySelector(radioGroupIndicator.name) as Host;
    expect(indicatorB.getExposes().isChecked()).toBe(false);

    await click(itemB);
    expect(root.getExposes().value.get()).toBe('b');
    expect(itemB.getExposes().checked.get()).toBe(true);
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(indicatorB.getExposes().isChecked()).toBe(true);
    expect(itemB.tabIndex).toBe(0);
    expect(changes).toEqual(['b']);
  });

  it('keeps controlled value at the root and only signals outward requests', async () => {
    const itemA = radioItem('a');
    const itemB = radioItem('b');
    const changes: string[] = [];
    const { root } = await mountRadioGroup({ value: 'a' }, [itemA, itemB]);
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });

    await click(itemB);
    expect(changes).toEqual(['b']);
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemA.getExposes().checked.get()).toBe(true);
    expect(itemB.getExposes().checked.get()).toBe(false);

    await update(root, { value: 'b' });
    expect(itemB.getExposes().checked.get()).toBe(true);
  });

  it('refuses empty, unmatched, duplicate and disabled requests without inventing a selection', async () => {
    const itemA = radioItem('a');
    const itemB = radioItem('b', true);
    const itemB2 = radioItem('b');
    const { root } = await mountRadioGroup({ defaultValue: 'a' }, [itemA, itemB, itemB2]);

    expect(root.getExposes().requestValue('')).toBe(false);
    expect(root.getExposes().requestValue('missing')).toBe(false);
    // Duplicate value 'b' has two candidates and the canonical one is disabled.
    expect(root.getExposes().requestValue('b')).toBe(false);
    expect(root.getExposes().value.get()).toBe('a');

    await click(itemB);
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemB.getExposes().disabled.get()).toBe(true);
    expect(itemB.getAttribute('aria-disabled')).toBe('true');
    expect(itemB.tabIndex).toBe(-1);
  });
});

async function update(root: Host, props: Record<string, unknown>) {
  setElementProps(root, props);
  await settle();
}

describe('bootstrap-2-3-2: Field compositions (simulated WC host)', () => {
  it('binds FieldTextarea to the parent Field without a second editor or relation owner', async () => {
    const m = mountField(
      fieldTextarea.name,
      { defaultValue: 'draft', rows: 4 },
      { invalid: false }
    );
    await settle();
    const editor = m.control.querySelector('textarea') as HTMLTextAreaElement;
    expect(m.control.querySelectorAll('textarea, input, [contenteditable]')).toHaveLength(1);
    expect(editor.value).toBe('draft');
    expect(editor.getAttribute('aria-labelledby')).toBe(m.label.id);
    expect(editor.getAttribute('aria-describedby')).toBe(m.description.id);

    await update(m.field, { invalid: true, errors: ['Invalid message'] });
    expect(m.control.getExposes().invalid.get()).toBe(true);
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(editor.getAttribute('aria-errormessage')).toBe(m.error.id);

    await update(m.field, { invalid: false });
    expect(m.control.getExposes().invalid.get()).toBe(false);
    expect(editor.hasAttribute('aria-errormessage')).toBe(false);
  });

  it('keeps FieldTextarea standalone policy and rejects external relationship IDs', async () => {
    const standalone = document.createElement(fieldTextarea.name) as Host;
    setElementProps(standalone, { defaultValue: 'alone', required: true, readOnly: true });
    document.body.appendChild(standalone);
    await settle();
    const editor = standalone.querySelector('textarea') as HTMLTextAreaElement;
    expect(editor.value).toBe('alone');
    expect(editor.required).toBe(true);
    expect(editor.readOnly).toBe(true);
    expect(standalone.getExposes().invalid.get()).toBe(false);

    await update(standalone, { readOnly: false, disabled: true });
    expect(editor.readOnly).toBe(false);
    expect(editor.disabled).toBe(true);
    await update(standalone, { disabled: false });

    const rejected = document.createElement(fieldTextarea.name);
    setElementProps(rejected, { labelledBy: 'external-id' });
    expect(() => document.body.appendChild(rejected)).toThrow();
  });

  it('composes FieldSwitch with one checked owner, thumb part and Field validity', async () => {
    const m = mountField(fieldSwitch.name, {}, {}, document.createElement(switchThumb.name));
    await settle();
    const thumb = m.control.querySelector(switchThumb.name) as Host;
    expect(m.control.getExposes().checked.get()).toBe(false);
    expect(m.control.getAttribute('role')).toBe('switch');
    expect(m.control.getAttribute('aria-labelledby')).toBe(m.label.id);

    await update(m.field, { invalid: true, errors: ['Required toggle'] });
    expect(m.control.getAttribute('aria-invalid')).toBe('true');
    expect(m.control.getAttribute('aria-errormessage')).toBe(m.error.id);

    await click(m.control);
    expect(m.control.getExposes().checked.get()).toBe(true);
    expect(thumb.getExposes().checked.get()).toBe(true);
    expect(m.field.getExposes().getValidity().filled).toBe(true);
  });

  it('inherits Field disabled/readOnly policy on FieldSwitch and restores it', async () => {
    const m = mountField(fieldSwitch.name, {}, { disabled: true });
    await settle();
    await click(m.control);
    expect(m.control.getExposes().checked.get()).toBe(false);
    expect(m.control.getAttribute('aria-disabled')).toBe('true');

    await update(m.field, { disabled: false, readOnly: true });
    await click(m.control);
    expect(m.control.getExposes().checked.get()).toBe(false);
    expect(m.control.getAttribute('aria-readonly')).toBe('true');

    await update(m.field, { readOnly: false });
    await click(m.control);
    expect(m.control.getExposes().checked.get()).toBe(true);
  });
});
