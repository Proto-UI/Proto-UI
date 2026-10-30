import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  numberFieldRoot,
  numberFieldInput,
  numberFieldControl,
  numberFieldLabel,
  numberFieldIncrement,
  numberFieldDecrement,
} from '../src/number-field';
import {
  inputOtpRoot,
  inputOtpInput,
  inputOtpControl,
  inputOtpSlot,
  inputOtpSeparator,
} from '../src/input-otp';
import { fieldRoot, fieldLabel, fieldError } from '../src/field';
import { styleScope } from '../src/style-scope';

AdaptToWebComponent(numberFieldRoot);
AdaptToWebComponent(numberFieldInput);
AdaptToWebComponent(numberFieldControl);
AdaptToWebComponent(numberFieldLabel);
AdaptToWebComponent(numberFieldIncrement);
AdaptToWebComponent(numberFieldDecrement);
AdaptToWebComponent(inputOtpRoot);
AdaptToWebComponent(inputOtpInput);
AdaptToWebComponent(inputOtpControl);
AdaptToWebComponent(inputOtpSlot);
AdaptToWebComponent(inputOtpSeparator);
AdaptToWebComponent(fieldRoot);
AdaptToWebComponent(fieldLabel);
AdaptToWebComponent(fieldError);
AdaptToWebComponent(styleScope);

type NumberConsumer = {
  value: { get(): number };
  draft: { get(): string };
  stepBy(direction: number): boolean;
};
type OtpConsumer = { value: { get(): string }; complete: { get(): boolean } };
type SlotConsumer = { character: { get(): string }; active: { get(): boolean } };
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
const element = <Exposes = never>(name: string, props: Record<string, unknown> = {}) => {
  // Public consumer view of the actual registered custom element, not a mocked owner.
  const node = document.createElement(name) as HTMLElement & { getExposes(): Exposes };
  setElementProps(node, props);
  return node;
};
const tokens = (node: Element) => (node.getAttribute('data-pui-style') ?? '').split(/\s+/);
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('source-bound numeric composition consumers', () => {
  it.each([
    ['vega', 'h-9', 'size-9'],
    ['nova', 'h-8', 'size-8'],
    ['maia', 'h-9', 'size-9'],
    ['lyra', 'h-8', 'size-8'],
    ['mira', 'h-7', 'size-7'],
    ['luma', 'h-9', 'size-9'],
    ['sera', 'h-10', 'size-10'],
    ['rhea', 'h-8', 'size-8'],
    ['new-york-v4', 'h-9', 'size-9'],
  ])(
    '%s borrows its own Input/Button/OTP sizes without replacing numeric owners',
    async (profile, height, size) => {
      const scope = element(styleScope.name, { styleProfile: profile });
      const numeric = element<NumberConsumer>(numberFieldRoot.name, { value: 2, min: 0, max: 10 });
      const label = element(numberFieldLabel.name);
      const editorHost = element(numberFieldInput.name);
      const plus = element(numberFieldIncrement.name);
      const minus = element(numberFieldDecrement.name);
      label.textContent = 'Quantity';
      plus.textContent = '+';
      minus.textContent = '−';
      numeric.append(label, minus, editorHost, plus);
      const otp = element<OtpConsumer>(inputOtpRoot.name, { value: '12', length: 4 });
      const otpEditorHost = element(inputOtpInput.name);
      const slots = [0, 1, 2, 3].map((index) =>
        element<SlotConsumer>(inputOtpSlot.name, { index })
      );
      otp.append(otpEditorHost, ...slots);
      scope.append(numeric, otp);
      document.body.append(scope);
      await flush();
      const editor = editorHost.querySelector('input')!;
      const otpEditor = otpEditorHost.querySelector('input')!;
      expect(scope.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(2);
      expect(tokens(editor)).toContain(height);
      expect(tokens(otpEditor)).toContain(height);
      expect(tokens(plus)).toContain(size);
      expect(tokens(minus)).toContain(size);
      for (const slot of slots) expect(tokens(slot)).toContain(size);
      expect(slots.map((slot) => slot.textContent).join('')).toBe('12');
      expect(editor.value).toBe('2');
      expect(otpEditor.value).toBe('12');
      const draft = numeric.getExposes().draft;
      const canonical = numeric.getExposes().value;
      const otpValue = otp.getExposes().value;
      editor.focus();
      editor.value = '-';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: '-' }));
      await flush();
      expect(draft.get()).toBe('-');
      setElementProps(scope, { styleProfile: profile === 'sera' ? 'mira' : 'sera' });
      await flush();
      expect(editorHost.querySelector('input')).toBe(editor);
      expect(otpEditorHost.querySelector('input')).toBe(otpEditor);
      expect(numeric.getExposes().draft).toBe(draft);
      expect(numeric.getExposes().value).toBe(canonical);
      expect(otp.getExposes().value).toBe(otpValue);
      expect(draft.get()).toBe('-');
      expect(editor.value).toBe('-');
      expect(canonical.get()).toBe(2);
      expect(document.activeElement).toBe(editor);
      const proposed: number[] = [];
      numeric.addEventListener('valueChange', (event) =>
        proposed.push((event as CustomEvent<{ value: number }>).detail.value)
      );
      numeric.getExposes().stepBy(1);
      await flush();
      expect(proposed).toEqual([3]);
      expect(canonical.get()).toBe(2);
      setElementProps(numeric, { value: 3, min: 0, max: 10 });
      await flush();
      expect(editor.value).toBe('3');
      setElementProps(numeric, { value: 3, disabled: true });
      await flush();
      expect(editor.disabled).toBe(true);
      expect(plus.getAttribute('aria-disabled')).toBe('true');
      expect(numeric.getExposes().stepBy(1)).toBe(false);
    }
  );

  it('preserves OTP controlled refusal and accepted raw owner updates across profile changes', async () => {
    const scope = element(styleScope.name, { styleProfile: 'luma' });
    const root = element<OtpConsumer>(inputOtpRoot.name, { value: '12', length: 4 });
    const editorHost = element(inputOtpInput.name);
    const slots = [0, 1, 2, 3].map((index) => element<SlotConsumer>(inputOtpSlot.name, { index }));
    root.append(editorHost, ...slots);
    scope.append(root);
    document.body.append(scope);
    await flush();
    const editor = editorHost.querySelector('input')!;
    const requests: string[] = [];
    const completions: string[] = [];
    root.addEventListener('valueChange', (event) =>
      requests.push((event as CustomEvent<{ value: string }>).detail.value)
    );
    root.addEventListener('completed', (event) =>
      completions.push((event as CustomEvent<{ value: string }>).detail.value)
    );
    editor.value = '12a345';
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, data: '12a345' })
    );
    await flush();
    expect(requests).toEqual(['1234']);
    expect(root.getExposes().value.get()).toBe('12');
    expect(editor.value).toBe('12');
    expect(completions).toEqual([]);
    expect(tokens(slots[0])).toContain('rounded-l-[var(--pui-radius-3xl)]');
    expect(tokens(slots[3])).toContain('rounded-r-[var(--pui-radius-3xl)]');
    setElementProps(scope, { styleProfile: 'rhea' });
    setElementProps(root, { value: '123', length: 3 });
    await flush();
    expect(editorHost.querySelector('input')).toBe(editor);
    expect(editor.value).toBe('123');
    expect(tokens(slots[2])).toContain('rounded-r-[var(--pui-radius-2xl)]');
    expect(tokens(slots[3])).not.toContain('rounded-r-[var(--pui-radius-2xl)]');
    expect(tokens(slots[0])).not.toContain('rounded-l-[var(--pui-radius-3xl)]');
    setElementProps(root, { value: '123', length: 3, readOnly: true });
    await flush();
    expect(editor.readOnly).toBe(true);
  });

  it('keeps one Field-bound OTP editor through IME, completion and invalid Sera paint', async () => {
    const scope = element(styleScope.name, { styleProfile: 'vega' });
    const field = element(fieldRoot.name, { required: true });
    const label = element(fieldLabel.name);
    const error = element(fieldError.name);
    const root = element<OtpConsumer>(inputOtpRoot.name, { defaultValue: '1', length: 4 });
    const host = element(inputOtpControl.name);
    const slots = [0, 1, 2, 3].map((index) => element<SlotConsumer>(inputOtpSlot.name, { index }));
    label.textContent = 'Verification code';
    root.append(host, ...slots);
    field.append(label, root, error);
    scope.append(field);
    document.body.append(scope);
    await flush();
    const editor = host.querySelector('input')!;
    expect(editor.required).toBe(true);
    expect(editor.getAttribute('aria-labelledby')).toBe(label.id);
    const completed: string[] = [];
    root.addEventListener('completed', (event) =>
      completed.push((event as CustomEvent<{ value: string }>).detail.value)
    );
    editor.focus();
    editor.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, composed: true })
    );
    editor.value = '1234';
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, data: '1234', isComposing: true })
    );
    await flush();
    expect(root.getExposes().value.get()).toBe('1');
    setElementProps(scope, { styleProfile: 'sera' });
    await flush();
    expect(editor.value).toBe('1234');
    expect(host.querySelector('input')).toBe(editor);
    expect(root.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(1);
    editor.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '1234' })
    );
    await flush();
    expect(root.getExposes().value.get()).toBe('1234');
    expect(root.getExposes().complete.get()).toBe(true);
    expect(completed).toEqual(['1234']);
    expect(slots.map((slot) => slot.getExposes().character.get()).join('')).toBe('1234');
    setElementProps(field, { invalid: true, errors: ['Use the current code'], disabled: true });
    await flush();
    expect(editor.disabled).toBe(true);
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(
      tokens(editor).some(
        (token) => token === 'border-b-destructive' || token.endsWith(':border-b-destructive')
      )
    ).toBe(true);
    expect(error.textContent).toContain('Use the current code');
  });
});
