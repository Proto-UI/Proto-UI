import { describe, expect, it, vi } from 'vitest';
import { definePrototype, type DefHandle } from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { textareaRoot } from '../../../prototypes/base/src/textarea';

import { createMountedVue2Adapter, flushVue2 } from './utils/vue2';

type SingleLineProps = { defaultValue?: string; placeholder?: string };
const singleLineValues: string[] = [];

const singleLinePrototype = definePrototype({
  name: 'vue2-text-control-input',
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

describe('adapter-vue2: base textarea integration', () => {
  it('materializes the host textarea and forwards value input through the Proto UI control', async () => {
    const onValueChange = vi.fn();
    const mounted = createMountedVue2Adapter(textareaRoot, {
      defaultValue: 'initial',
      placeholder: 'Write',
      rows: 4,
      surfaceClass: 'surface-control w-full outline-none',
      surfaceStyle: { minHeight: '7rem' },
      onValueChange,
    });

    try {
      await flushVue2();
      const textarea = mounted.root as HTMLTextAreaElement;
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
      expect(textarea.value).toBe('initial');
      expect(textarea.defaultValue).toBe('initial');
      expect(textarea.placeholder).toBe('Write');
      expect(Number(textarea.rows)).toBe(4);
      expect(textarea.classList.contains('surface-control')).toBe(true);
      expect(textarea.style.minHeight).toBe('7rem');

      textarea.value = 'edited';
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flushVue2();

      expect(mounted.vm.getExposes().value.get()).toBe('edited');
      expect(onValueChange.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ value: 'edited' })
      );
    } finally {
      mounted.unmount();
    }
  });
  it('materializes one physical input for a single-line declaration and cleans up its event lease', async () => {
    singleLineValues.length = 0;
    const mounted = createMountedVue2Adapter(singleLinePrototype, {
      defaultValue: 'initial',
      placeholder: 'Search',
      surfaceClass: 'surface-input outline-none',
    });
    let unmounted = false;
    try {
      await flushVue2();
      const input = mounted.root as HTMLInputElement;
      expect(input.tagName.toLowerCase()).toBe('input');
      expect(mounted.host.querySelectorAll('textarea')).toHaveLength(0);
      expect(input.type).toBe('text');
      expect(input.value).toBe('initial');
      expect(input.defaultValue).toBe('initial');
      expect(input.placeholder).toBe('Search');
      expect(input.inputMode).toBe('text');
      expect(input.enterKeyHint).toBe('search');
      expect(input.classList.contains('surface-input')).toBe(true);
      expect(input.classList.contains('outline-none')).toBe(true);

      input.value = 'edited';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flushVue2();
      expect(singleLineValues).toEqual(['edited']);

      mounted.unmount();
      unmounted = true;
      input.value = 'after-detach';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flushVue2();
      expect(singleLineValues).toEqual(['edited']);
    } finally {
      if (!unmounted) mounted.unmount();
    }
  });
});
