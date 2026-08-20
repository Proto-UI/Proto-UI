import { describe, expect, it } from 'vitest';
import { definePrototype, type DefHandle, type TextControlPatch } from '@proto.ui/core';
import { asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { AdaptToWebComponent, setElementProps, type WebComponentAdapterElement } from '../src';

const moduleInputValues: string[] = [];
type ControlProps = { defaultValue?: string; placeholder?: string; rows?: number };

const textareaPrototype = definePrototype({
  name: 'x-wc-text-control',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' })],
  setup(def: DefHandle<ControlProps>) {
    def.props.define({
      defaultValue: { type: 'string', empty: 'fallback' },
      placeholder: { type: 'string', empty: 'fallback' },
      rows: { type: 'number', empty: 'fallback' },
    });
    const control = asTextControl<ControlProps>();
    control.on('input', (_run, event) => moduleInputValues.push(event.value));
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

AdaptToWebComponent(textareaPrototype);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('adapter-web-component text control', () => {
  it('retains the custom root and owns one physical textarea', async () => {
    const shell = document.createElement('x-wc-text-control') as WebComponentAdapterElement<
      typeof textareaPrototype
    >;
    setElementProps(shell, {
      className: 'boundary-only',
      surfaceClassName: 'surface-control w-full outline-none',
      surfaceStyle: { minHeight: '7rem' },
      defaultValue: 'initial',
      placeholder: 'Write',
      rows: 6,
    });
    document.body.appendChild(shell);
    await flush();
    const textarea = shell.querySelector('textarea');
    expect(shell.tagName.toLowerCase()).toBe('x-wc-text-control');
    expect(shell.getAttribute('data-pui-root')).toBe('');
    expect(shell.classList.contains('boundary-only')).toBe(true);
    expect(shell.classList.contains('surface-control')).toBe(false);
    expect(shell.querySelectorAll('textarea')).toHaveLength(1);
    expect(textarea?.getAttribute('part')).toBe('control');
    expect(textarea?.classList.contains('surface-control')).toBe(true);
    expect(textarea?.classList.contains('w-full')).toBe(true);
    expect(textarea?.classList.contains('outline-none')).toBe(true);
    expect(textarea?.style.minHeight).toBe('7rem');
    expect(textarea?.value).toBe('initial');
    expect(textarea?.defaultValue).toBe('initial');
    expect(textarea?.placeholder).toBe('Write');
    expect(Number(textarea?.rows)).toBe(6);
    textarea?.focus();
    expect(document.activeElement).toBe(textarea);
    shell.blur();
    expect(document.activeElement).not.toBe(textarea);

    const leakedNativeInputs: Event[] = [];
    shell.addEventListener('input', (event) => leakedNativeInputs.push(event));
    if (!textarea) throw new Error('physical textarea was not materialized');
    textarea.value = 'edited';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(moduleInputValues).toEqual(['edited']);

    setElementProps(shell, {
      defaultValue: 'initial',
      placeholder: 'Write',
      rows: 6,
      surfaceClassName: 'surface-next',
    });
    shell.update();
    expect(textarea.classList.contains('surface-control')).toBe(false);
    expect(textarea.classList.contains('surface-next')).toBe(true);
    expect(textarea.style.minHeight).toBe('');
    expect(leakedNativeInputs).toHaveLength(0);

    shell.remove();
    await flush();
    textarea.value = 'after-detach';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(moduleInputValues).toEqual(['edited']);
  });
});
