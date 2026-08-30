import { describe, expect, it } from 'vitest';
import { definePrototype, type DefHandle, type TextControlPatch } from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { createVueAdapter } from '../src/adapt';
import { VueAny, createMountedVueAdapter, flushVue } from './utils/vue';

type ControlProps = { defaultValue?: string; placeholder?: string; rows?: number };

const textControlValues: string[] = [];
const textareaPrototype = definePrototype({
  name: 'vue-text-control',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' })],
  setup(def: DefHandle<ControlProps>) {
    def.props.define({
      defaultValue: { type: 'string', empty: 'fallback' },
      placeholder: { type: 'string', empty: 'fallback' },
      rows: { type: 'number', empty: 'fallback' },
    });
    const control = asTextControl<ControlProps>();
    control.on('input', (_run, event) => textControlValues.push(event.value));
    const sync = (props: Readonly<ControlProps>) => {
      const patch: TextControlPatch = {
        valueMode: 'uncontrolled',
        defaultValue: props.defaultValue,
        placeholder: props.placeholder,
        rows: props.rows,
      };
      control.sync(patch);
    };
    def.lifecycle.onCreated((run) => sync(run.props.get()));
    def.props.watchAll((_run, next) => sync(next));
    return () => null;
  },
});

const singleLineValues: string[] = [];
type SingleLineProps = { defaultValue?: string; placeholder?: string };

const singleLinePrototype = definePrototype({
  name: 'vue-text-control-input',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup(def: DefHandle<SingleLineProps>) {
    def.props.define({
      defaultValue: { type: 'string', empty: 'fallback' },
      placeholder: { type: 'string', empty: 'fallback' },
    });
    const control = asTextControl<SingleLineProps, 'single'>();
    control.on('input', (_run, event) => singleLineValues.push(event.value));
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

describe('adapter-vue text control', () => {
  it('materializes the declared textarea root, projects patches, and routes input', async () => {
    const mounted = createMountedVueAdapter(textareaPrototype, {
      defaultValue: 'initial',
      placeholder: 'Write',
      rows: 4,
      surfaceClass: 'surface-control w-full outline-none',
      surfaceStyle: { minHeight: '7rem' },
    });
    await flushVue();
    const textarea = mounted.root as HTMLTextAreaElement;
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea.value).toBe('initial');
    expect(textarea.defaultValue).toBe('initial');
    expect(textarea.placeholder).toBe('Write');
    expect(Number(textarea.rows)).toBe(4);
    expect(textarea.classList.contains('surface-control')).toBe(true);
    expect(textarea.classList.contains('w-full')).toBe(true);
    expect(textarea.classList.contains('outline-none')).toBe(true);
    expect(textarea.style.minHeight).toBe('7rem');

    textarea.value = 'edited';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(textControlValues).toEqual(['edited']);
    mounted.unmount();
  });

  it('rejects a rootTag that conflicts with the static textarea declaration', () => {
    expect(() => createVueAdapter(VueAny)(textareaPrototype, { rootTag: 'div' })).toThrow(
      /rootTag/
    );
  });

  it('materializes a single-line input with common hints and strips newlines', async () => {
    singleLineValues.length = 0;
    const mounted = createMountedVueAdapter(singleLinePrototype, {
      defaultValue: 'initial',
      placeholder: 'Search',
      surfaceClass: 'surface-input outline-none',
    });
    await flushVue();
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
    expect(singleLineValues).toEqual(['edited']);

    input.value = 'no\nnewlines';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(singleLineValues).toEqual(['edited', 'nonewlines']);
    mounted.unmount();
  });
});
