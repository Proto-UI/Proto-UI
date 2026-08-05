import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { State } from '@proto.ui/core';
import { TEXT_CONTROL_DECLARATION } from '@proto.ui/module-text-control';
import textareaRoot, {
  asTextareaRoot,
  type TextareaCompositionDetail,
  type TextareaRootExposes,
  type TextareaRootProps,
  type TextareaRootStateHandles,
  type TextareaValueChangeDetail,
} from '../src/textarea';

type StateValue<T> =
  T extends State<infer V> ? V : T extends { kind: 'state'; state: State<infer V> } ? V : never;

type TextareaElement = WebComponentAdapterElement<typeof textareaRoot>;

AdaptToWebComponent(textareaRoot);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function physicalTextarea(element: TextareaElement): HTMLTextAreaElement {
  const target = element.querySelector('textarea');
  if (!(target instanceof HTMLTextAreaElement)) {
    throw new Error('Base Textarea physical host is missing');
  }
  return target;
}

function exposes(element: TextareaElement): ProtoAdapterExposes<typeof textareaRoot> {
  return element.getExposes();
}

describe('prototypes/base: textarea', () => {
  it('publishes one host-neutral static requirement on both direct and asHook entries', () => {
    expect(textareaRoot.modules).toEqual(asTextareaRoot.modules);
    expect(asTextareaRoot.modules).toHaveLength(1);
    expect(asTextareaRoot.modules[0]).toMatchObject({
      id: TEXT_CONTROL_DECLARATION.id,
      config: { content: 'plain-text', lineMode: 'multiline', engine: 'host' },
    });
  });

  it('preserves the public multiline state and event types', () => {
    expectTypeOf<StateValue<TextareaRootExposes['value']>>().toEqualTypeOf<string>();
    expectTypeOf<StateValue<TextareaRootStateHandles['composing']>>().toEqualTypeOf<boolean>();
    expectTypeOf<TextareaValueChangeDetail>().toEqualTypeOf<{
      readonly value: string;
      readonly composing: boolean;
      readonly inputType: string | null;
      readonly data: string | null;
    }>();
  });

  it('materializes one contentless multiline textbox with the exact protocol surface', async () => {
    const element = document.createElement('base-textarea-root') as TextareaElement;
    setElementProps(element, {
      defaultValue: 'Draft',
      rows: 4,
      placeholder: 'Write a message',
      required: true,
      name: 'message',
      autoComplete: 'off',
      minLength: 3,
      maxLength: 240,
      wrap: 'hard',
    } satisfies TextareaRootProps);
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    expect(target.value).toBe('Draft');
    expect(target.defaultValue).toBe('Draft');
    expect(Number(target.rows)).toBe(4);
    expect(target.placeholder).toBe('Write a message');
    expect(target.required).toBe(true);
    expect(target.name).toBe('message');
    expect(target.autocomplete).toBe('off');
    expect(target.minLength).toBe(3);
    expect(target.maxLength).toBe(240);
    expect(target.wrap).toBe('hard');
    expect(target.getAttribute('role')).toBe('textbox');
    expect(target.hasAttribute('aria-label')).toBe(false);
    expect(target.hasAttribute('aria-labelledby')).toBe(false);
    expect(target.hasAttribute('aria-describedby')).toBe(false);
    expect(target.children).toHaveLength(0);
    expect(Object.keys(element.getExposes()).sort()).toEqual([
      'blurSelf',
      'change',
      'composing',
      'compositionEnd',
      'compositionStart',
      'compositionUpdate',
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'readOnly',
      'value',
      'valueChange',
    ]);
    expect(target.hasAttribute('data-pui-a11y-actions')).toBe(false);
    element.remove();
  });

  it('owns uncontrolled multiline edits and emits normalized input and change events', async () => {
    const element = document.createElement('base-textarea-root') as TextareaElement;
    const changes: TextareaValueChangeDetail[] = [];
    const commits: Array<{ value: string }> = [];
    element.addEventListener('valueChange', (event: Event) => {
      changes.push((event as CustomEvent<TextareaValueChangeDetail>).detail);
    });
    element.addEventListener('change', (event: Event) => {
      commits.push((event as CustomEvent<{ value: string }>).detail);
    });
    setElementProps(element, { defaultValue: 'first' } satisfies TextareaRootProps);
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    target.value = 'first\nsecond';
    const inputEvent = new InputEvent('input', { bubbles: true });
    Object.defineProperties(inputEvent, {
      data: { value: null },
      inputType: { value: 'insertLineBreak' },
    });
    target.dispatchEvent(inputEvent);
    target.dispatchEvent(new Event('change', { bubbles: true }));

    expect(exposes(element).value.get()).toBe('first\nsecond');
    expect(changes).toEqual([
      {
        value: 'first\nsecond',
        composing: false,
        inputType: 'insertLineBreak',
        data: null,
      },
    ]);
    expect(commits).toEqual([{ value: 'first\nsecond' }]);
    element.remove();
  });

  it('keeps value ownership mode stable and never resets dirty uncontrolled input', async () => {
    const element = document.createElement('base-textarea-root') as TextareaElement;
    setElementProps(element, { defaultValue: 'seed' } satisfies TextareaRootProps);
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    target.value = 'edited';
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    setElementProps(element, { defaultValue: 'new default', value: 'late control' });
    await flush();

    expect(target.value).toBe('edited');
    expect(target.defaultValue).toBe('new default');
    expect(exposes(element).value.get()).toBe('edited');
    element.remove();
  });

  it('preserves IME composition before restoring an unaccepted controlled proposal', async () => {
    const element = document.createElement('base-textarea-root') as TextareaElement;
    const changes: TextareaValueChangeDetail[] = [];
    const starts: TextareaCompositionDetail[] = [];
    const updates: TextareaCompositionDetail[] = [];
    const ends: TextareaCompositionDetail[] = [];
    const compositionEvent = (type: string, data: string) => {
      const event = new CompositionEvent(type, { bubbles: true });
      Object.defineProperty(event, 'data', { value: data });
      return event;
    };
    element.addEventListener('compositionStart', (event: Event) => {
      starts.push((event as CustomEvent<TextareaCompositionDetail>).detail);
    });
    element.addEventListener('compositionUpdate', (event: Event) => {
      updates.push((event as CustomEvent<TextareaCompositionDetail>).detail);
    });
    element.addEventListener('compositionEnd', (event: Event) => {
      ends.push((event as CustomEvent<TextareaCompositionDetail>).detail);
    });
    element.addEventListener('valueChange', (event: Event) => {
      changes.push((event as CustomEvent<TextareaValueChangeDetail>).detail);
    });
    setElementProps(element, { value: 'controlled' } satisfies TextareaRootProps);
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    target.dispatchEvent(compositionEvent('compositionstart', ''));
    target.value = '編集中';
    target.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        data: '中',
        isComposing: true,
      })
    );
    target.dispatchEvent(compositionEvent('compositionupdate', '編集中'));

    expect(target.value).toBe('編集中');
    expect(exposes(element).composing.get()).toBe(true);
    expect(changes.at(-1)).toEqual({
      value: '編集中',
      composing: true,
      inputType: 'insertCompositionText',
      data: '中',
    });

    target.dispatchEvent(compositionEvent('compositionend', '編集中'));
    await flush();
    expect({
      physical: target.value,
      exposed: exposes(element).value.get(),
      composing: exposes(element).composing.get(),
    }).toEqual({ physical: 'controlled', exposed: 'controlled', composing: false });
    expect({ starts, updates, ends }).toEqual({
      starts: [{ value: 'controlled', data: '' }],
      updates: [{ value: '編集中', data: '編集中' }],
      ends: [{ value: '編集中', data: '編集中' }],
    });
    element.remove();
  });

  it('synchronizes controlled value, properties, accessibility, and physical focus', async () => {
    const element = document.createElement('base-textarea-root') as TextareaElement;
    setElementProps(element, {
      value: 'before',
      disabled: false,
      readOnly: false,
      ariaLabel: 'Message',
      labelledBy: 'message-label',
      describedBy: 'message-help',
    } satisfies TextareaRootProps);
    document.body.appendChild(element);
    await flush();

    const target = physicalTextarea(element);
    expect(target.getAttribute('aria-label')).toBe('Message');
    expect(target.getAttribute('aria-labelledby')).toBe('message-label');
    expect(target.getAttribute('aria-describedby')).toBe('message-help');
    exposes(element).focusSelf();
    expect(document.activeElement).toBe(target);

    setElementProps(element, {
      value: 'after',
      disabled: true,
      readOnly: true,
      ariaLabel: 'Updated message',
      labelledBy: '',
      describedBy: 'updated-help',
      required: false,
      name: 'updated-message',
      autoComplete: 'on',
      minLength: 1,
      maxLength: 120,
      wrap: 'soft',
    });
    await flush();

    expect(target.value).toBe('after');
    expect(target.disabled).toBe(true);
    expect(target.readOnly).toBe(true);
    expect(target.getAttribute('aria-disabled')).toBe('true');
    expect(target.getAttribute('aria-readonly')).toBe('true');
    expect(target.getAttribute('aria-label')).toBe('Updated message');
    expect(target.hasAttribute('aria-labelledby')).toBe(false);
    expect(target.getAttribute('aria-describedby')).toBe('updated-help');
    expect(target.required).toBe(false);
    expect(target.name).toBe('updated-message');
    expect(target.autocomplete).toBe('on');
    expect(target.minLength).toBe(1);
    expect(target.maxLength).toBe(120);
    expect(target.wrap).toBe('soft');
    target.blur();
    exposes(element).focusSelf();
    expect(document.activeElement).not.toBe(target);
    element.remove();
  });
});
