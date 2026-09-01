import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import type { ProtoAdapterExposes } from '@proto.ui/adapter-base';
import type { State } from '@proto.ui/core';
import { TEXT_CONTROL_DECLARATION } from '@proto.ui/module-text-control';
import inputRoot, {
  asInputRoot,
  type InputRootExposes,
  type InputRootProps,
  type InputRootStateHandles,
  type InputValueChangeDetail,
} from '../src/input';

type StateValue<T> =
  T extends State<infer V> ? V : T extends { kind: 'state'; state: State<infer V> } ? V : never;
type InputElement = WebComponentAdapterElement<typeof inputRoot>;
AdaptToWebComponent(inputRoot);
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const physicalInput = (element: InputElement): HTMLInputElement => {
  const target = element.querySelector('input');
  if (!(target instanceof HTMLInputElement)) throw new Error('Base Input physical host is missing');
  return target;
};
const exposes = (element: InputElement): ProtoAdapterExposes<typeof inputRoot> =>
  element.getExposes();

describe('prototypes/base: input', () => {
  it('publishes one host-neutral single-line requirement on direct and asHook entries', () => {
    expect(inputRoot.modules).toEqual(asInputRoot.modules);
    expect(asInputRoot.modules[0]).toMatchObject({
      id: TEXT_CONTROL_DECLARATION.id,
      config: { content: 'plain-text', lineMode: 'single', engine: 'host' },
    });
  });
  it('preserves the public single-line state and event types', () => {
    expectTypeOf<StateValue<InputRootExposes['value']>>().toEqualTypeOf<string>();
    expectTypeOf<StateValue<InputRootStateHandles['composing']>>().toEqualTypeOf<boolean>();
    expectTypeOf<InputValueChangeDetail>().toEqualTypeOf<{
      readonly value: string;
      readonly composing: boolean;
      readonly inputType: string | null;
      readonly data: string | null;
    }>();
  });
  it('materializes one contentless single-line input and projects hints', async () => {
    const element = document.createElement('base-input-root') as InputElement;
    setElementProps(element, {
      defaultValue: 'Draft',
      placeholder: 'Search',
      required: true,
      name: 'query',
      autoComplete: 'off',
      minLength: 2,
      maxLength: 80,
      inputMode: 'search',
      enterKeyHint: 'search',
    } satisfies InputRootProps);
    document.body.appendChild(element);
    await flush();
    const target = physicalInput(element);
    expect(target.value).toBe('Draft');
    expect(target.placeholder).toBe('Search');
    expect(target.required).toBe(true);
    expect(target.name).toBe('query');
    expect(target.autocomplete).toBe('off');
    expect(target.minLength).toBe(2);
    expect(target.maxLength).toBe(80);
    expect(target.inputMode).toBe('search');
    expect(target.enterKeyHint).toBe('search');
    expect(target.getAttribute('role')).toBe('textbox');
    expect(target.children).toHaveLength(0);
    expect(Object.keys(exposes(element)).sort()).toEqual([
      'blurSelf',
      'composing',
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'readOnly',
      'value',
    ]);
    element.remove();
  });

  it('synchronizes accessibility, disabled state, and physical focus', async () => {
    const element = document.createElement('base-input-root') as InputElement;
    setElementProps(element, {
      value: 'before',
      ariaLabel: 'Query',
      labelledBy: 'query-label',
      describedBy: 'query-help',
    } satisfies InputRootProps);
    document.body.appendChild(element);
    await flush();
    const target = physicalInput(element);
    expect(target.getAttribute('aria-label')).toBe('Query');
    expect(target.getAttribute('aria-labelledby')).toBe('query-label');
    expect(target.getAttribute('aria-describedby')).toBe('query-help');
    exposes(element).focusSelf();
    expect(document.activeElement).toBe(target);
    setElementProps(element, {
      value: 'after',
      disabled: true,
      readOnly: true,
      ariaLabel: 'Updated query',
      labelledBy: '',
      describedBy: 'updated-help',
    });
    await flush();
    expect(target.value).toBe('after');
    expect(target.disabled).toBe(true);
    expect(target.readOnly).toBe(true);
    expect(target.getAttribute('aria-disabled')).toBe('true');
    expect(target.getAttribute('aria-readonly')).toBe('true');
    expect(target.getAttribute('aria-label')).toBe('Updated query');
    expect(target.hasAttribute('aria-labelledby')).toBe(false);
    expect(target.getAttribute('aria-describedby')).toBe('updated-help');
    target.blur();
    exposes(element).focusSelf();
    expect(document.activeElement).not.toBe(target);
    element.remove();
  });

  it('keeps controlled ownership and emits the complete composition boundary', async () => {
    const element = document.createElement('base-input-root') as InputElement;
    const values: InputValueChangeDetail[] = [];
    const changes: Array<{ value: string }> = [];
    const events: string[] = [];
    element.addEventListener('valueChange', (event) =>
      values.push((event as CustomEvent<InputValueChangeDetail>).detail)
    );
    element.addEventListener('change', (event) =>
      changes.push((event as CustomEvent<{ value: string }>).detail)
    );
    for (const name of ['compositionStart', 'compositionUpdate', 'compositionEnd'])
      element.addEventListener(name, () => events.push(name));
    setElementProps(element, { value: 'owner' } satisfies InputRootProps);
    document.body.appendChild(element);
    await flush();
    const target = physicalInput(element);
    target.value = 'candidate';
    target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'x' }));
    target.dispatchEvent(new Event('change'));
    target.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    target.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true }));
    target.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect(values.at(-1)).toMatchObject({ value: 'candidate', composing: false });
    expect(changes).toEqual([{ value: 'candidate' }]);
    expect(events).toEqual(['compositionStart', 'compositionUpdate', 'compositionEnd']);
    setElementProps(element, { value: 'owner' });
    await flush();
    expect(target.value).toBe('owner');
    element.remove();
  });

  it('emits normalized input and composition payloads from the physical editor', async () => {
    const element = document.createElement('base-input-root') as InputElement;
    const values: InputValueChangeDetail[] = [];
    const compositions: Array<{ value: string; data: string | null }> = [];
    const compositionEvent = (type: string, data: string) => {
      const event = new CompositionEvent(type, { bubbles: true });
      Object.defineProperty(event, 'data', { value: data });
      return event;
    };
    element.addEventListener('valueChange', (event) => {
      values.push((event as CustomEvent<InputValueChangeDetail>).detail);
    });
    element.addEventListener('compositionStart', (event) => {
      compositions.push((event as CustomEvent<{ value: string; data: string | null }>).detail);
    });
    setElementProps(element, { defaultValue: 'first' } satisfies InputRootProps);
    document.body.appendChild(element);
    await flush();
    const target = physicalInput(element);
    target.value = 'next';
    target.dispatchEvent(new InputEvent('input', { data: 'x', inputType: 'insertText' }));
    target.dispatchEvent(compositionEvent('compositionstart', '候'));
    expect(values.at(-1)).toMatchObject({
      value: 'next',
      composing: false,
      data: 'x',
      inputType: 'insertText',
    });
    expect(compositions).toEqual([{ value: 'next', data: '候' }]);
    expect(exposes(element).value.get()).toBe('next');
    element.remove();
  });
});
