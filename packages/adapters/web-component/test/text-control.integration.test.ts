import { describe, expect, it, vi } from 'vitest';
import {
  definePrototype,
  type DefHandle,
  type FocusRequestOptions,
  type TextControlPatch,
} from '@proto.ui/core';
import { asFocusable, asTextControl } from '@proto.ui/hooks';
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

const focusTextareaPrototype = definePrototype({
  name: 'x-wc-text-control-focus',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' })],
  setup(def: DefHandle<ControlProps>) {
    def.props.define({
      defaultValue: { type: 'string', empty: 'fallback' },
      placeholder: { type: 'string', empty: 'fallback' },
      rows: { type: 'number', empty: 'fallback' },
    });
    const control = asTextControl<ControlProps>();
    const focusable = asFocusable<ControlProps>();
    focusable.configure({ disabled: false });
    def.expose.state('focused', focusable.focused);
    def.expose.state('focusVisible', focusable.focusVisible);
    def.expose.method('focusSelf', (options: FocusRequestOptions | undefined) =>
      focusable.focusSelf(options)
    );
    const sync = (props: Readonly<ControlProps>) => {
      control.sync({
        valueMode: 'uncontrolled',
        defaultValue: props.defaultValue,
        placeholder: props.placeholder,
        rows: props.rows,
      });
    };
    def.lifecycle.onCreated((run) => sync(run.props.get()));
    def.props.watchAll((_run, next) => sync(next));
    return () => null;
  },
});

AdaptToWebComponent(focusTextareaPrototype);

const singleLineValues: string[] = [];
type SingleLineProps = { defaultValue?: string; placeholder?: string };

const singleLinePrototype = definePrototype({
  name: 'x-wc-text-control-input',
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

AdaptToWebComponent(singleLinePrototype);

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

  it('projects native text-control focus across modality, remount, and teardown', async () => {
    const shell = document.createElement('x-wc-text-control-focus') as WebComponentAdapterElement<
      typeof focusTextareaPrototype
    >;
    setElementProps(shell, { defaultValue: '', placeholder: 'Write', rows: 4 });
    let projectedFocusCount = 0;
    shell.addEventListener('focus', () => {
      projectedFocusCount += 1;
    });
    document.body.appendChild(shell);
    await flush();

    const textarea = shell.querySelector('textarea');
    if (!textarea) throw new Error('physical textarea was not materialized');
    const exposes = shell.getExposes() as {
      focused: { get(): boolean };
      focusVisible: { get(): boolean };
    };
    expect(shell.hasAttribute('tabindex')).toBe(false);
    expect(textarea.tabIndex).toBe(0);
    expect(exposes.focused.get()).toBe(false);
    expect(exposes.focusVisible.get()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
    expect(projectedFocusCount).toBe(0);
    expect(exposes.focused.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(true);
    expect(shell.hasAttribute('data-focus-visible')).toBe(true);
    expect(textarea.hasAttribute('data-focus-visible')).toBe(true);

    textarea.blur();
    expect(document.activeElement).not.toBe(textarea);
    expect(exposes.focused.get()).toBe(false);
    expect(exposes.focusVisible.get()).toBe(false);
    expect(shell.hasAttribute('data-focus-visible')).toBe(false);
    expect(textarea.hasAttribute('data-focus-visible')).toBe(false);

    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    const matchesSpy = vi.spyOn(textarea, 'matches').mockReturnValue(true);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
    expect(projectedFocusCount).toBe(0);
    expect(exposes.focused.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(true);
    expect(shell.hasAttribute('data-focus-visible')).toBe(true);
    expect(textarea.hasAttribute('data-focus-visible')).toBe(true);

    // Same-target modality input resamples the current physical target even
    // though no second focus event fires.
    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(exposes.focusVisible.get()).toBe(true);
    matchesSpy.mockReturnValue(false);
    textarea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(exposes.focusVisible.get()).toBe(false);
    expect(shell.hasAttribute('data-focus-visible')).toBe(false);
    expect(textarea.hasAttribute('data-focus-visible')).toBe(false);

    // Native true is target-local. After blur, an adjacent native-false focus
    // without another pointer event must not inherit the prior target result.
    textarea.blur();
    matchesSpy.mockReturnValue(false);
    textarea.focus();
    expect(exposes.focused.get()).toBe(true);
    expect(exposes.focusVisible.get()).toBe(false);
    expect(shell.hasAttribute('data-focus-visible')).toBe(false);
    expect(textarea.hasAttribute('data-focus-visible')).toBe(false);
    textarea.blur();
    matchesSpy.mockRestore();

    shell.remove();
    await flush();
    const countAfterDetach = projectedFocusCount;
    textarea.dispatchEvent(new FocusEvent('focus'));
    expect(projectedFocusCount).toBe(countAfterDetach);

    document.body.appendChild(shell);
    await flush();
    const remountedTextarea = shell.querySelector('textarea');
    if (!remountedTextarea) throw new Error('remounted physical textarea was not materialized');
    const remountedExposes = shell.getExposes() as typeof exposes;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    remountedTextarea.focus();
    expect(document.activeElement).toBe(remountedTextarea);
    expect(projectedFocusCount).toBe(0);
    expect(remountedExposes.focused.get()).toBe(true);
    expect(remountedExposes.focusVisible.get()).toBe(true);
    remountedTextarea.blur();

    shell.remove();
    await flush();
  });
  it('breaks the host focus path when the focus bridge is intercepted', async () => {
    const shell = document.createElement('x-wc-text-control-focus') as WebComponentAdapterElement<
      typeof focusTextareaPrototype
    >;
    setElementProps(shell, { defaultValue: '', placeholder: 'Write', rows: 4 });
    let projectedFocusCount = 0;
    shell.addEventListener('focus', () => {
      projectedFocusCount += 1;
    });
    document.body.appendChild(shell);
    await flush();

    const textarea = shell.querySelector('textarea');
    if (!textarea) throw new Error('physical textarea was not materialized');
    const exposes = shell.getExposes() as {
      focused: { get(): boolean };
      focusVisible: { get(): boolean };
    };

    // Stop the private focus signal before it reaches the adapter listener.
    const swallowFocus = (event: FocusEvent) => {
      if (event.target === textarea) event.stopImmediatePropagation();
    };
    textarea.addEventListener('focus', swallowFocus, true);
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      textarea.focus();
      await flush();
      expect(document.activeElement).toBe(textarea);
      expect(projectedFocusCount).toBe(0);
      expect(exposes.focused.get()).toBe(false);
      expect(exposes.focusVisible.get()).toBe(false);
      expect(shell.hasAttribute('data-focus-visible')).toBe(false);
    } finally {
      textarea.removeEventListener('focus', swallowFocus, true);
    }

    // After unblocking, the private bridge restores logical focus projection.
    textarea.blur();
    await flush();
    textarea.focus();
    await flush();
    expect(exposes.focused.get()).toBe(true);
    expect(projectedFocusCount).toBe(0);

    textarea.blur();
    shell.remove();
    await flush();
  });

  it('projects focusSelf bidirectionally between host method and physical control', async () => {
    const shell = document.createElement('x-wc-text-control-focus') as WebComponentAdapterElement<
      typeof focusTextareaPrototype
    >;
    setElementProps(shell, { defaultValue: '', placeholder: 'Write', rows: 4 });
    document.body.appendChild(shell);
    await flush();

    const textarea = shell.querySelector('textarea');
    if (!textarea) throw new Error('physical textarea was not materialized');
    const exposes = shell.getExposes() as {
      focused: { get(): boolean };
      focusSelf: (options?: FocusRequestOptions) => void;
    };

    // focusSelf focuses the physical control and syncs the focused state.
    exposes.focusSelf({ reason: 'programmatic' });
    await flush();
    expect(document.activeElement).toBe(textarea);
    expect(exposes.focused.get()).toBe(true);

    // Blur un-syncs.
    textarea.blur();
    await flush();
    expect(exposes.focused.get()).toBe(false);

    // focusSelf re-focuses after blur.
    exposes.focusSelf({ reason: 'programmatic' });
    await flush();
    expect(document.activeElement).toBe(textarea);
    expect(exposes.focused.get()).toBe(true);

    textarea.blur();
    shell.remove();
    await flush();
  });

  it('materializes one physical input for a single-line declaration and routes/strips newlines', async () => {
    singleLineValues.length = 0;
    const shell = document.createElement('x-wc-text-control-input') as WebComponentAdapterElement<
      typeof singleLinePrototype
    >;
    setElementProps(shell, {
      defaultValue: 'initial',
      placeholder: 'Search',
      surfaceClassName: 'surface-input outline-none',
    });
    document.body.appendChild(shell);
    await flush();

    const input = shell.querySelector('input');
    expect(shell.querySelectorAll('textarea')).toHaveLength(0);
    expect(input?.tagName.toLowerCase()).toBe('input');
    expect(input?.getAttribute('part')).toBe('control');
    expect(input?.classList.contains('surface-input')).toBe(true);
    expect(input?.classList.contains('outline-none')).toBe(true);
    expect(input?.value).toBe('initial');
    expect(input?.defaultValue).toBe('initial');
    expect(input?.placeholder).toBe('Search');
    // Common hints are projected onto the single-line physical editor.
    expect(input?.inputMode).toBe('text');
    expect(input?.enterKeyHint).toBe('search');

    // Event routing through the module boundary, not the wrapper.
    const leakedNativeInputs: Event[] = [];
    shell.addEventListener('input', (event) => leakedNativeInputs.push(event));
    if (!input) throw new Error('physical input was not materialized');
    input.value = 'edited';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(singleLineValues).toEqual(['edited']);

    // Single-line canonicalization strips line breaks at the module boundary.
    input.value = 'no\nnewlines';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(singleLineValues).toEqual(['edited', 'nonewlines']);
    expect(leakedNativeInputs).toHaveLength(0);

    shell.remove();
    await flush();
    input.value = 'after-detach';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(singleLineValues).toEqual(['edited', 'nonewlines']);
  });
});
