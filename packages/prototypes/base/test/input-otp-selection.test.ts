import { afterEach, describe, expect, it } from 'vitest';
import {
  AdaptToWebComponent,
  getElementProps,
  setElementProps,
} from '@proto.ui/adapter-web-component';
import * as base from '../src/input-otp';
import * as shadcn from '../../shadcn/src/input-otp';
import * as brutalist from '../../brutalist/src/input-otp';
import { fieldRoot, fieldLabel } from '../src/field';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const patchProps = (element: HTMLElement, props: Record<string, unknown>) =>
  setElementProps(element, { ...getElementProps(element), ...props });
for (const group of [base, shadcn, brutalist, { fieldRoot, fieldLabel }])
  for (const prototype of Object.values(group))
    if (prototype && typeof prototype === 'object' && 'setup' in prototype)
      AdaptToWebComponent(prototype as any);
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe.each(['base', 'shadcn', 'brutalist'])('%s OTP selection consumer', (family) => {
  const part = (kind: string, props = {}) => {
    const element = document.createElement(`${family}-input-otp-${kind}`) as any;
    setElementProps(element, props);
    return element;
  };
  const mount = async (props = {}, withField = false) => {
    const root = part('root', { length: 4, defaultValue: '1234', ...props });
    const input = part(withField ? 'control' : 'input');
    const slots = [0, 1, 2, 3].map((index) => part('slot', { index }));
    root.append(input, ...slots);
    const field = document.createElement(fieldRoot.name) as any;
    if (withField) {
      setElementProps(field, { externalValidation: true, validationMode: 'onChange' });
      field.append(document.createElement(fieldLabel.name), root);
      document.body.append(field);
    } else document.body.append(root);
    await flush();
    const editor = (input.shadowRoot?.querySelector('input') ??
      input.querySelector('input')) as HTMLInputElement;
    const active = () => slots.map((s) => s.getExposes().active.get());
    const select = async (start: number, end = start) => {
      editor.focus();
      editor.setSelectionRange(start, end, start === end ? 'none' : 'backward');
      editor.dispatchEvent(new Event('select', { bubbles: true }));
      await flush();
    };
    return { root, input, slots, editor, active, select, field };
  };

  it('uses the real middle caret and selected range without value or completion proposals', async () => {
    const m = await mount();
    const changed: unknown[] = [],
      completed: unknown[] = [];
    m.root.addEventListener('valueChange', (e: CustomEvent) => changed.push(e.detail));
    m.root.addEventListener('completed', (e: CustomEvent) => completed.push(e.detail));
    await m.select(1);
    expect(m.active()).toEqual([false, true, false, false]); // value.length was 4: former implementation selected slot 3.
    await m.select(1, 3);
    expect(m.active()).toEqual([false, true, true, false]);
    await m.select(4);
    expect(m.active()).toEqual([false, false, false, true]);
    expect(changed).toEqual([]);
    expect(completed).toEqual([]);
    m.editor.blur();
    await flush();
    expect(m.active()).toEqual([false, false, false, false]);
    await m.select(0);
    patchProps(m.root, { readOnly: true });
    await flush();
    expect(m.active()).toEqual([false, false, false, false]);
    expect(m.editor.readOnly).toBe(true);
  });

  it('restores controlled rejection and retires detached editor observations', async () => {
    const m = await mount({ value: '12' });
    await m.select(1);
    m.editor.value = '1234';
    m.editor.setSelectionRange(4, 4);
    m.editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: '34' }));
    await flush();
    expect(m.root.getExposes().value.get()).toBe('12');
    expect(m.editor.value).toBe('12');
    expect(m.active()).toEqual([false, false, true, false]);
    m.input.remove();
    await flush();
    m.editor.setSelectionRange(0, 0);
    m.editor.dispatchEvent(new Event('select'));
    await flush();
    expect(m.active()).toEqual([false, false, false, false]);
    m.root.prepend(m.input);
    await flush();
    const replacement =
      m.input.shadowRoot?.querySelector('input') ?? m.input.querySelector('input');
    replacement.focus();
    replacement.setSelectionRange(1, 1);
    replacement.dispatchEvent(new Event('select'));
    await flush();
    expect(m.active()).toEqual([false, true, false, false]);
  });

  it.each(['synchronous', 'queued'] as const)(
    'keeps each accepted native caret when its %s controlled owner commits',
    async (mode) => {
      const m = await mount({ value: '1234' }, true);
      m.root.addEventListener('valueChange', (event: CustomEvent) => {
        const accept = () => patchProps(m.root, { value: event.detail.value });
        if (mode === 'queued') queueMicrotask(accept);
        else accept();
      });
      await m.select(0, 4);
      let accepted = '';
      for (const digit of '5678') {
        const start = m.editor.selectionStart!,
          end = m.editor.selectionEnd!;
        const candidate = m.editor.value.slice(0, start) + digit + m.editor.value.slice(end);
        m.editor.value = candidate;
        m.editor.setSelectionRange(start + 1, start + 1);
        m.editor.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            composed: true,
            data: digit,
            inputType: 'insertText',
          })
        );
        await flush();
        accepted += digit;
        expect(m.root.getExposes().value.get()).toBe(accepted);
        expect(m.editor.value).toBe(accepted);
        expect(m.editor.selectionStart).toBe(accepted.length);
        expect(m.editor.selectionEnd).toBe(accepted.length);
      }
    }
  );

  it('validates only canonical accepted edits after owner callbacks and cancels a detached report', async () => {
    const m = await mount({ value: '12' }, true);
    const requests: any[] = [];
    m.field.addEventListener('validationRequest', (event: CustomEvent) =>
      requests.push(event.detail)
    );
    const edit = async (text: string) => {
      m.editor.value = text;
      m.editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: text })
      );
      await new Promise((resolve) => setTimeout(resolve, 4));
      await flush();
    };
    await edit('123');
    expect(m.editor.value).toBe('12');
    expect(requests).toEqual([]);
    expect(m.field.getExposes().getValidity().dirty).toBe(false);
    const accept = (event: CustomEvent) => patchProps(m.root, { value: event.detail.value });
    m.root.addEventListener('valueChange', accept);
    await edit('1234');
    expect(m.editor.value).toBe('1234');
    expect(requests).toHaveLength(1);
    expect(requests[0].value).toBe('1234');
    m.root.addEventListener('valueChange', () => m.root.remove());
    await edit('5678');
    expect(requests).toHaveLength(1);
  });

  it('keeps normalized no-op edits quiet while retaining manual and blur validation', async () => {
    const m = await mount({ defaultValue: '12' }, true);
    const requests: any[] = [];
    m.field.addEventListener('validationRequest', (event: CustomEvent) =>
      requests.push(event.detail)
    );
    m.editor.value = '12x';
    m.editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: 'x' }));
    await new Promise((resolve) => setTimeout(resolve, 4));
    await flush();
    expect(m.editor.value).toBe('12');
    expect(requests).toEqual([]);
    m.field.getExposes().validate();
    await flush();
    expect(requests.at(-1)).toMatchObject({ value: '12', reason: 'manual' });
    patchProps(m.field, { validationMode: 'onBlur' });
    await flush();
    m.editor.focus();
    await flush();
    expect(m.editor.isConnected).toBe(true);
    expect(m.root.getExposes().focused.get()).toBe(true);
    m.editor.blur();
    await flush();
    expect(m.root.getExposes().focused.get()).toBe(false);
    expect(requests.at(-1)).toMatchObject({ value: '12', reason: 'blur' });
    expect(requests).toHaveLength(2);
  });

  it('coalesces current Field values and retires reports on Root reset or policy interruption', async () => {
    const m = await mount({ defaultValue: '12' }, true);
    const requests: any[] = [];
    m.field.addEventListener('validationRequest', (event: CustomEvent) =>
      requests.push(event.detail)
    );
    const edit = (text: string) => {
      m.editor.value = text;
      m.editor.dispatchEvent(
        new InputEvent('input', { bubbles: true, composed: true, data: text })
      );
    };
    edit('123');
    edit('1234');
    await new Promise((resolve) => setTimeout(resolve, 4));
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0].value).toBe('1234');
    edit('9876');
    m.root.getExposes().resetValue();
    await new Promise((resolve) => setTimeout(resolve, 4));
    await flush();
    expect(m.editor.value).toBe('12');
    expect(requests).toHaveLength(1);
    edit('5678');
    patchProps(m.root, { readOnly: true });
    patchProps(m.root, { readOnly: false });
    await new Promise((resolve) => setTimeout(resolve, 4));
    await flush();
    expect(m.editor.value).toBe('5678');
    expect(requests).toHaveLength(1);
  });

  it('preserves a candidate when selection arrives before input and Context refreshes', async () => {
    const m = await mount({ defaultValue: '12' });
    await m.select(1);
    m.editor.value = '1234';
    m.editor.setSelectionRange(4, 4);
    m.editor.dispatchEvent(new Event('selectionchange'));
    await flush();
    expect(m.editor.value).toBe('1234');
    expect(m.root.getExposes().value.get()).toBe('12');
    expect(m.active()).toEqual([false, false, false, false]);
    m.editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: '34' }));
    await flush();
    expect(m.root.getExposes().value.get()).toBe('1234');
    expect(m.editor.value).toBe('1234');
    expect(m.active()).toEqual([false, false, false, true]);
  });
});
