import { describe, expect, it } from 'vitest';
import { definePrototype, type DefHandle, type TextControlPatch } from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { createReactAdapter } from '../src/adapt';
import { createFakeReactRuntime } from './utils/fake-react';

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
