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
});
