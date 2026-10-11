import { afterEach, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  asFieldTextControl,
  fieldRoot,
  type FieldControlProps,
  type FieldControlExposes,
} from '../src/field';
import * as shadcn from '../../shadcn/src/field';
import * as neo from '../../brutalist/src/field';
import * as bootstrap from '../../bootstrap-2-3-2/src/field';
import * as liquid from '../../liquid-glass/src/field';
let captured: ReturnType<typeof asFieldTextControl>;
const control = definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'test-field-nested-consumer',
  modules: asFieldTextControl.modules,
  setup() {
    captured = asFieldTextControl();
    return captured.render;
  },
});
AdaptToWebComponent(fieldRoot);
AdaptToWebComponent(control);
for (const group of [shadcn, neo, bootstrap, liquid]) {
  AdaptToWebComponent(group.fieldRoot);
  AdaptToWebComponent(group.fieldControl);
}
const flush = async () => {
  for (let n = 0; n < 30; n++) await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
it('public child handle carries the one Field validity owner without flattening or extra state', async () => {
  const root = document.createElement(fieldRoot.name) as any;
  const editor = document.createElement(control.name) as any;
  setElementProps(root, { required: true, externalValidation: true, validationMode: 'manual' });
  setElementProps(editor, { defaultValue: 'Ada' });
  root.append(editor);
  document.body.append(root);
  await flush();
  for (const key of ['invalid', 'pending', 'required'])
    expect(captured.stateHandles).not.toHaveProperty(key);
  const binding = captured.getAsHookHandle?.('as-field-control');
  expect(binding).toBeDefined();
  expect(binding!.state.fieldRequired.get()).toBe(true);
  expect(binding!.state.invalid.get()).toBe(false);
  const requestId = root.getExposes().validate();
  await flush();
  expect(binding!.state.pending.get()).toBe(true);
  expect(editor.getExposes().pending.get()).toBe(true);
  root.getExposes().resolveValidation(requestId, { invalid: true, errors: ['Unavailable'] });
  await flush();
  expect(binding!.state.pending.get()).toBe(false);
  expect(binding!.state.invalid.get()).toBe(true);
  expect(editor.getExposes().invalid.get()).toBe(true);
  expect(captured.stateHandles!.value.get()).toBe('Ada');
  setElementProps(root, { invalid: false, required: false });
  await flush();
  expect(binding!.state.invalid.get()).toBe(false);
  expect(binding!.state.fieldRequired.get()).toBe(false);
  expect(captured.getAsHookHandle?.('as-field-control')).toBe(binding);
});
for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass']) {
  it(`${family} invalid paint consumes the public nested Field binding on the actual editor`, async () => {
    const root = document.createElement(`${family}-field-root`) as any;
    const control = document.createElement(`${family}-field-control`) as any;
    setElementProps(control, { value: 'Owned' });
    setElementProps(root, { invalid: true, errors: ['Error'] });
    root.append(control);
    document.body.append(root);
    await flush();
    const editor = (control.shadowRoot?.querySelector('input') ??
      control.querySelector('input')) as HTMLInputElement;
    expect(editor.value).toBe('Owned');
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(editor.hasAttribute('data-invalid')).toBe(true);
    const tokens = (editor.getAttribute('data-pui-style') ?? '').split(/\s+/);
    expect(tokens).toContain(
      family === 'liquid-glass'
        ? 'border-foreground'
        : ['shadcn', 'bootstrap-2-3-2'].includes(family)
          ? 'data-[invalid]:border-destructive'
          : 'data-[invalid]:border-foreground'
    );
    setElementProps(root, { invalid: false });
    await flush();
    expect(editor.hasAttribute('data-invalid')).toBe(false);
    if (family === 'liquid-glass') {
      expect(editor.getAttribute('data-pui-style')).toContain('border-border');
      expect((editor.getAttribute('data-pui-style') ?? '').split(/\s+/)).not.toContain(
        'border-foreground'
      );
    }
    expect(editor.value).toBe('Owned');
  });
}
