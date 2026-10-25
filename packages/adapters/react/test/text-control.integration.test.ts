import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  type DefHandle,
  type Prototype,
  type TextControlPatch,
} from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { asInputRoot, inputRoot, type InputRootProps } from '@proto.ui/prototypes-base/input';
import {
  asTextareaRoot,
  textareaRoot,
  type TextareaRootProps,
} from '@proto.ui/prototypes-base/textarea';
import type { PropsBaseType } from '@proto.ui/types';
import { createReactAdapter } from '../src/adapt';
import { createFakeReactRuntime } from './utils/fake-react';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type ControlProps = {
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
};

function createTextareaPrototype(name: string, values: string[] = []) {
  return definePrototype({
    name,
    modules: [declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' })],
    setup(def: DefHandle<ControlProps>) {
      def.props.define({
        defaultValue: { type: 'string', empty: 'fallback' },
        placeholder: { type: 'string', empty: 'fallback' },
        disabled: { type: 'boolean', empty: 'fallback' },
        rows: { type: 'number', empty: 'fallback' },
      });
      const control = asTextControl<ControlProps>();
      control.on('input', (_run, event) => values.push(event.value));
      const sync = (props: Readonly<ControlProps>) => {
        const patch: TextControlPatch = {
          valueMode: 'uncontrolled',
          defaultValue: props.defaultValue,
          placeholder: props.placeholder,
          disabled: props.disabled,
          rows: props.rows,
        };
        control.sync(patch);
      };
      def.lifecycle.onCreated((run) => sync(run.props.get()));
      def.props.watchAll((_run, next) => sync(next));
      return () => null;
    },
  });
}

type SingleLineProps = { defaultValue?: string; placeholder?: string };

function createInputPrototype(name: string, values: string[] = []) {
  return definePrototype({
    name,
    modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
    setup(def: DefHandle<SingleLineProps>) {
      def.props.define({
        defaultValue: { type: 'string', empty: 'fallback' },
        placeholder: { type: 'string', empty: 'fallback' },
      });
      const control = asTextControl<SingleLineProps, 'single'>();
      control.on('input', (_run, event) => values.push(event.value));
      const sync = (props: Readonly<SingleLineProps>) => {
        control.sync({
          valueMode: 'uncontrolled',
          defaultValue: props.defaultValue,
          placeholder: props.placeholder,
          inputMode: 'text',
          enterKeyHint: 'search',
        });
      };
      def.lifecycle.onCreated((run) => sync(run.props.get()));
      def.props.watchAll((_run, next) => sync(next));
      return () => null;
    },
  });
}

const setupDefaultInput = definePrototype<InputRootProps>({
  name: 'react-setup-default-input',
  modules: asInputRoot.modules,
  setup(def) {
    asInputRoot();
    def.props.setDefaults({ defaultValue: 'Input setup default' });
    return () => null;
  },
});

const setupDefaultTextarea = definePrototype<TextareaRootProps>({
  name: 'react-setup-default-textarea',
  modules: asTextareaRoot.modules,
  setup(def) {
    asTextareaRoot();
    def.props.setDefaults({ defaultValue: 'Textarea setup default' });
    return () => null;
  },
});

type ReactTextEditor = HTMLInputElement | HTMLTextAreaElement;

async function settleReact(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

async function mountReactTextControl<Props extends PropsBaseType, Exposes>(
  proto: Prototype<Props, Exposes>,
  tagName: 'input' | 'textarea'
) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const Component = createReactAdapter(React)(proto);
  const render = (props: React.ComponentProps<typeof Component>) =>
    settleReact(() => root.render(React.createElement(Component, props)));
  const unmount = async () => {
    await settleReact(() => root.unmount());
    host.remove();
  };
  const editor = (): ReactTextEditor => {
    const target = host.querySelector<ReactTextEditor>(tagName);
    if (!target) throw new Error(`React Text Control ${tagName} root is missing`);
    return target;
  };
  return { editor, host, render, unmount };
}

describe('adapter-react text control', () => {
  it('materializes the declared textarea root, projects patches, and routes input', () => {
    const values: string[] = [];
    const proto = createTextareaPrototype('react-text-control', values);
    const fake = createFakeReactRuntime();
    const Component = createReactAdapter(fake.runtime)(proto, { schedule: (task) => task() });
    const mounted = fake.render(Component, {
      defaultValue: 'initial',
      placeholder: 'Write',
      disabled: true,
      rows: 5,
      surfaceClassName: 'surface-control w-full outline-none',
      surfaceStyle: { minHeight: '7rem' },
    });
    const textarea = mounted.root as HTMLTextAreaElement;
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea.value).toBe('initial');
    expect(textarea.defaultValue).toBe('initial');
    expect(textarea.placeholder).toBe('Write');
    expect(textarea.disabled).toBe(true);
    expect(Number(textarea.rows)).toBe(5);
    expect(textarea.classList.contains('surface-control')).toBe(true);
    expect(textarea.classList.contains('w-full')).toBe(true);
    expect(textarea.classList.contains('outline-none')).toBe(true);
    expect(textarea.style.minHeight).toBe('7rem');

    textarea.value = 'edited';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(values).toEqual(['edited']);
    mounted.unmount();
  });

  it('rejects a rootTag that conflicts with the static textarea declaration', () => {
    const proto = createTextareaPrototype('react-text-control-conflict');
    const fake = createFakeReactRuntime();
    expect(() => createReactAdapter(fake.runtime)(proto, { rootTag: 'div' })).toThrow(/rootTag/);
  });

  it('clears previously authored textarea children without clearing native fallback text later', () => {
    const fake = createFakeReactRuntime();
    const Component = (props: { authored: boolean }) =>
      fake.runtime.createElement('textarea', null, ...(props.authored ? ['authored'] : []));
    const mounted = fake.render(Component, { authored: true });
    const textarea = mounted.root as HTMLTextAreaElement;
    expect(textarea.textContent).toBe('authored');

    mounted.update({ authored: false });
    expect(textarea.childNodes).toHaveLength(0);

    textarea.defaultValue = 'native fallback';
    mounted.update({ authored: false });
    expect(textarea.textContent).toBe('native fallback');
    mounted.unmount();
  });

  it('materializes a single-line input with common hints and strips newlines', () => {
    const values: string[] = [];
    const proto = createInputPrototype('react-text-control-input', values);
    const fake = createFakeReactRuntime();
    const Component = createReactAdapter(fake.runtime)(proto, { schedule: (task) => task() });
    const mounted = fake.render(Component, {
      defaultValue: 'initial',
      placeholder: 'Search',
      surfaceClassName: 'surface-input outline-none',
    });
    const input = mounted.root as HTMLInputElement;
    expect(input.tagName.toLowerCase()).toBe('input');
    expect(input.value).toBe('initial');
    expect(input.defaultValue).toBe('initial');
    expect(input.placeholder).toBe('Search');
    expect(input.inputMode).toBe('text');
    expect(input.enterKeyHint).toBe('search');
    expect(input.classList.contains('surface-input')).toBe(true);
    expect(input.classList.contains('outline-none')).toBe(true);

    input.value = 'edited';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(values).toEqual(['edited']);

    input.value = 'no\nnewlines';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(values).toEqual(['edited', 'nonewlines']);
    mounted.unmount();
  });
});

describe('adapter-react native text-control value ownership', () => {
  it('retains actual Base Input initial and dirty uncontrolled values across React reconciliation', async () => {
    const mounted = await mountReactTextControl(inputRoot, 'input');
    try {
      await mounted.render({ defaultValue: 'initial input' });
      const input = mounted.editor() as HTMLInputElement;
      expect(input.value).toBe('initial input');
      expect(input.defaultValue).toBe('initial input');

      await mounted.render({ defaultValue: 'initial input', placeholder: 'Updated hint' });
      expect(mounted.editor()).toBe(input);
      expect(input.value).toBe('initial input');

      input.value = 'edited input';
      await settleReact(() =>
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'edited input' }))
      );
      await mounted.render({ defaultValue: 'next input default', placeholder: 'Changed again' });
      expect(input.value).toBe('edited input');
      expect(input.defaultValue).toBe('next input default');

      // Ownership remains uncontrolled after a late controlled-looking Prop.
      await mounted.render({
        defaultValue: 'latest input default',
        value: 'late owner value',
        placeholder: 'Unrelated update',
      });
      expect(input.value).toBe('edited input');
      expect(input.defaultValue).toBe('latest input default');
    } finally {
      await mounted.unmount();
    }
  });

  it('retains actual Base Textarea initial and dirty uncontrolled values across React reconciliation', async () => {
    const mounted = await mountReactTextControl(textareaRoot, 'textarea');
    try {
      await mounted.render({ defaultValue: 'initial textarea' });
      const textarea = mounted.editor() as HTMLTextAreaElement;
      expect(textarea.value).toBe('initial textarea');
      expect(textarea.defaultValue).toBe('initial textarea');

      await mounted.render({ defaultValue: 'initial textarea', placeholder: 'Updated hint' });
      expect(mounted.editor()).toBe(textarea);
      expect(textarea.value).toBe('initial textarea');

      textarea.value = 'edited textarea';
      await settleReact(() =>
        textarea.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            data: 'edited textarea',
            inputType: 'insertText',
          })
        )
      );
      await mounted.render({ defaultValue: 'next textarea default', placeholder: 'Changed again' });
      expect(textarea.value).toBe('edited textarea');
      expect(textarea.defaultValue).toBe('next textarea default');

      // Ownership remains uncontrolled after a late controlled-looking Prop.
      await mounted.render({
        defaultValue: 'latest textarea default',
        value: 'late owner value',
        placeholder: 'Unrelated update',
      });
      expect(textarea.value).toBe('edited textarea');
      expect(textarea.defaultValue).toBe('latest textarea default');
    } finally {
      await mounted.unmount();
    }
  });

  it('projects setup-authored defaults for both native editor targets before editing', async () => {
    const inputMount = await mountReactTextControl(setupDefaultInput, 'input');
    const textareaMount = await mountReactTextControl(setupDefaultTextarea, 'textarea');
    try {
      await inputMount.render({});
      await textareaMount.render({});
      const input = inputMount.editor();
      const textarea = textareaMount.editor();
      expect({ value: input.value, defaultValue: input.defaultValue }).toEqual({
        value: 'Input setup default',
        defaultValue: 'Input setup default',
      });
      expect({ value: textarea.value, defaultValue: textarea.defaultValue }).toEqual({
        value: 'Textarea setup default',
        defaultValue: 'Textarea setup default',
      });

      await inputMount.render({ placeholder: 'Input prop update' });
      await textareaMount.render({ placeholder: 'Textarea prop update' });
      expect(input.value).toBe('Input setup default');
      expect(textarea.value).toBe('Textarea setup default');
    } finally {
      await inputMount.unmount();
      await textareaMount.unmount();
    }
  });

  it('keeps controlled owners authoritative through native edits and uncontrolled-looking updates', async () => {
    const inputMount = await mountReactTextControl(inputRoot, 'input');
    const textareaMount = await mountReactTextControl(textareaRoot, 'textarea');
    try {
      await inputMount.render({ value: 'input owner', defaultValue: 'input fallback' });
      await textareaMount.render({ value: 'textarea owner', defaultValue: 'textarea fallback' });
      const input = inputMount.editor();
      const textarea = textareaMount.editor();
      expect(input.value).toBe('input owner');
      expect(input.defaultValue).toBe('input fallback');
      expect(textarea.value).toBe('textarea owner');
      expect(textarea.defaultValue).toBe('textarea fallback');

      input.value = 'input proposal';
      textarea.value = 'textarea proposal';
      await settleReact(() => {
        input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'input proposal' }));
        textarea.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            data: 'textarea proposal',
            inputType: 'insertText',
          })
        );
      });
      expect(input.value).toBe('input owner');
      expect(textarea.value).toBe('textarea owner');

      await inputMount.render({
        value: 'accepted input owner',
        defaultValue: 'next input fallback',
      });
      await textareaMount.render({
        value: 'accepted textarea owner',
        defaultValue: 'next textarea fallback',
      });
      expect(input.value).toBe('accepted input owner');
      expect(input.defaultValue).toBe('next input fallback');
      expect(textarea.value).toBe('accepted textarea owner');
      expect(textarea.defaultValue).toBe('next textarea fallback');

      await inputMount.render({ defaultValue: 'late input default' });
      await textareaMount.render({ defaultValue: 'late textarea default' });
      expect(input.value).toBe('accepted input owner');
      expect(textarea.value).toBe('accepted textarea owner');
      expect(input.defaultValue).toBe('late input default');
      expect(textarea.defaultValue).toBe('late textarea default');
    } finally {
      await inputMount.unmount();
      await textareaMount.unmount();
    }
  });
});
