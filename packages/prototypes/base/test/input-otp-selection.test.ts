import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/input-otp';
import * as shadcn from '../../shadcn/src/input-otp';
import * as brutalist from '../../brutalist/src/input-otp';

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
for (const group of [base, shadcn, brutalist])
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
  const mount = async (props = {}) => {
    const root = part('root', { length: 4, defaultValue: '1234', ...props });
    const input = part('input');
    const slots = [0, 1, 2, 3].map((index) => part('slot', { index }));
    root.append(input, ...slots);
    document.body.append(root);
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
    return { root, input, slots, editor, active, select };
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
    setElementProps(m.root, { readOnly: true });
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
});
