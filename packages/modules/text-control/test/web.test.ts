import { describe, expect, it } from 'vitest';
import type { TextControlEvent } from '@proto.ui/core';
import { createWebTextControlHost } from '../src/web';

describe('module-text-control web bridge', () => {
  it('projects the supported textarea properties and live updates', () => {
    const textarea = document.createElement('textarea');
    const lease = createWebTextControlHost(() => textarea).attach({
      patch: {
        valueMode: 'uncontrolled',
        defaultValue: 'initial',
        disabled: true,
        readOnly: true,
        placeholder: 'Write',
        rows: 4,
        required: true,
        name: 'notes',
        autoComplete: 'off',
        minLength: 3,
        maxLength: 100,
        wrap: 'hard',
      },
      onEvent() {},
    });

    expect(textarea.value).toBe('initial');
    expect(textarea.defaultValue).toBe('initial');
    expect(textarea.disabled).toBe(true);
    expect(textarea.readOnly).toBe(true);
    expect(textarea.placeholder).toBe('Write');
    expect(Number(textarea.rows)).toBe(4);
    expect(textarea.required).toBe(true);
    expect(textarea.name).toBe('notes');
    expect(textarea.autocomplete).toBe('off');
    expect(textarea.minLength).toBe(3);
    expect(textarea.maxLength).toBe(100);
    expect(textarea.wrap).toBe('hard');

    lease.update({
      valueMode: 'controlled',
      value: 'updated',
      defaultValue: 'next default',
      disabled: false,
      readOnly: false,
      placeholder: 'Compose',
      rows: 7,
      required: false,
      name: 'updated-notes',
      autoComplete: 'on',
      minLength: 1,
      maxLength: 200,
      wrap: 'soft',
    });
    expect(textarea.value).toBe('updated');
    expect(textarea.defaultValue).toBe('next default');
    expect(textarea.disabled).toBe(false);
    expect(textarea.readOnly).toBe(false);
    expect(textarea.placeholder).toBe('Compose');
    expect(Number(textarea.rows)).toBe(7);
    expect(textarea.required).toBe(false);
    expect(textarea.name).toBe('updated-notes');
    expect(textarea.autocomplete).toBe('on');
    expect(textarea.minLength).toBe(1);
    expect(textarea.maxLength).toBe(200);
    expect(textarea.wrap).toBe('soft');
    expect(lease.snapshot()).toEqual({ value: 'updated', composing: false });
    lease.dispose();
  });

  it('normalizes input, change, and IME composition without leaking native events', () => {
    const textarea = document.createElement('textarea');
    const seen: TextControlEvent[] = [];
    const lease = createWebTextControlHost(() => textarea).attach({
      patch: { valueMode: 'controlled', value: 'fixed' },
      onEvent: (event) => seen.push(event),
    });
    const compositionEvent = (type: string, data: string) => {
      const event = new CompositionEvent(type, { bubbles: true });
      Object.defineProperty(event, 'data', { value: data });
      return event;
    };

    textarea.dispatchEvent(compositionEvent('compositionstart', ''));
    textarea.value = '編集中';
    const inputEvent = new InputEvent('input', { bubbles: true });
    Object.defineProperties(inputEvent, {
      data: { value: '中' },
      inputType: { value: 'insertCompositionText' },
      isComposing: { value: true },
    });
    textarea.dispatchEvent(inputEvent);
    textarea.dispatchEvent(compositionEvent('compositionupdate', '編集中'));
    textarea.dispatchEvent(compositionEvent('compositionend', '編集中'));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    expect(seen).toEqual([
      {
        type: 'compositionstart',
        value: 'fixed',
        composing: true,
        data: '',
        inputType: null,
      },
      {
        type: 'input',
        value: '編集中',
        composing: true,
        data: '中',
        inputType: 'insertCompositionText',
      },
      {
        type: 'compositionupdate',
        value: '編集中',
        composing: true,
        data: '編集中',
        inputType: null,
      },
      {
        type: 'compositionend',
        value: '編集中',
        composing: false,
        data: '編集中',
        inputType: null,
      },
      {
        type: 'change',
        value: '編集中',
        composing: false,
        data: null,
        inputType: null,
      },
    ]);

    lease.dispose();
    textarea.value = 'ignored';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(seen).toHaveLength(5);
  });

  it('preserves cursor and selection across host patches and controlled restoration', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const lease = createWebTextControlHost(() => textarea).attach({
      patch: { valueMode: 'controlled', value: '0123456789' },
      onEvent() {},
    });
    textarea.focus();
    textarea.setSelectionRange(3, 7, 'forward');

    lease.update({
      valueMode: 'controlled',
      value: '0123456789',
      placeholder: 'Unrelated host patch',
    });
    expect({
      active: document.activeElement,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      direction: textarea.selectionDirection,
    }).toEqual({ active: textarea, start: 3, end: 7, direction: 'forward' });

    lease.update({ valueMode: 'controlled', value: 'short' });
    expect({ start: textarea.selectionStart, end: textarea.selectionEnd }).toEqual({
      start: 3,
      end: 5,
    });
    lease.dispose();
    textarea.remove();
  });

  it('defers owner value projection during composition without losing the editing session', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const lease = createWebTextControlHost(() => textarea).attach({
      patch: { valueMode: 'controlled', value: 'abcdef' },
      onEvent() {},
    });
    textarea.focus();
    textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    textarea.value = '編集中';
    textarea.setSelectionRange(1, 2, 'backward');
    textarea.scrollTop = 23;
    textarea.scrollLeft = 5;

    lease.update({
      valueMode: 'controlled',
      value: 'owner update',
      placeholder: 'Applied during composition',
    });
    expect({
      value: textarea.value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      direction: textarea.selectionDirection,
      scrollTop: textarea.scrollTop,
      scrollLeft: textarea.scrollLeft,
      active: document.activeElement,
      placeholder: textarea.placeholder,
    }).toEqual({
      value: '編集中',
      start: 1,
      end: 2,
      direction: 'backward',
      scrollTop: 23,
      scrollLeft: 5,
      active: textarea,
      placeholder: 'Applied during composition',
    });

    textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    expect({
      value: textarea.value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      direction: textarea.selectionDirection,
      scrollTop: textarea.scrollTop,
      scrollLeft: textarea.scrollLeft,
      active: document.activeElement,
    }).toEqual({
      value: 'owner update',
      start: 1,
      end: 2,
      direction: 'backward',
      scrollTop: 23,
      scrollLeft: 5,
      active: textarea,
    });

    lease.dispose();
    textarea.remove();
  });
});

describe('module-text-control single-line web bridge', () => {
  it('resolves an input element for single-line declaration', () => {
    const input = document.createElement('input');
    const lease = createWebTextControlHost(() => input).attach({
      patch: {
        valueMode: 'uncontrolled',
        defaultValue: 'initial',
        placeholder: 'Search',
        required: true,
        name: 'query',
        inputMode: 'search',
        enterKeyHint: 'search',
      },
      onEvent() {},
    });

    expect(input.value).toBe('initial');
    expect(input.placeholder).toBe('Search');
    expect(input.required).toBe(true);
    expect(input.name).toBe('query');
    expect(input.inputMode).toBe('search');
    expect(input.enterKeyHint).toBe('search');

    lease.update({
      valueMode: 'uncontrolled',
      defaultValue: 'initial',
      inputMode: undefined,
      enterKeyHint: undefined,
    });
    expect(input.inputMode).toBe('');
    expect(input.enterKeyHint).toBe('');

    lease.dispose();
  });

  it('projects and preserves selection for an input created in another realm', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const foreignDocument = iframe.contentDocument;
    if (!foreignDocument) throw new Error('iframe document is unavailable');
    const input = foreignDocument.createElement('input');
    expect(input.ownerDocument.defaultView).not.toBe(window);
    foreignDocument.body.appendChild(input);
    const lease = createWebTextControlHost(() => input).attach({
      patch: {
        valueMode: 'controlled',
        value: '0123456789',
        inputMode: 'search',
        enterKeyHint: 'search',
      },
      onEvent() {},
    });
    input.focus();
    input.setSelectionRange(3, 7, 'forward');

    lease.update({
      valueMode: 'controlled',
      value: 'short',
      inputMode: 'numeric',
      enterKeyHint: 'next',
    });
    expect({
      value: input.value,
      start: input.selectionStart,
      end: input.selectionEnd,
      direction: input.selectionDirection,
      inputMode: input.inputMode,
      enterKeyHint: input.enterKeyHint,
    }).toEqual({
      value: 'short',
      start: 3,
      end: 5,
      direction: 'forward',
      inputMode: 'numeric',
      enterKeyHint: 'next',
    });

    lease.dispose();
    iframe.remove();
  });

  it('canonicalizes CR/LF to LF in event values and snapshots', () => {
    const input = document.createElement('input');
    const events: TextControlEvent[] = [];
    const lease = createWebTextControlHost(() => input).attach({
      patch: { valueMode: 'uncontrolled', defaultValue: '' },
      onEvent(event) {
        events.push(event);
      },
    });

    // Input elements strip \r\n, so test canonicalization with a textarea
    const textarea = document.createElement('textarea');
    const textareaEvents: TextControlEvent[] = [];
    const textareaLease = createWebTextControlHost(() => textarea).attach({
      patch: { valueMode: 'uncontrolled', defaultValue: '' },
      onEvent(event) {
        textareaEvents.push(event);
      },
    });

    textarea.value = 'hello\r\nworld';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

    expect(textareaEvents.length).toBeGreaterThan(0);
    const last = textareaEvents[textareaEvents.length - 1];
    expect(last.value).toBe('hello\nworld');

    expect(textareaLease.snapshot()?.value).toBe('hello\nworld');
    textareaLease.dispose();
    lease.dispose();
  });

  it('does not apply rows or wrap to an input element', () => {
    const input = document.createElement('input');
    const lease = createWebTextControlHost(() => input).attach({
      patch: {
        valueMode: 'uncontrolled',
        defaultValue: 'test',
        rows: 4,
        wrap: 'hard',
      } as any,
      onEvent() {},
    });

    // input has no rows or wrap properties
    expect((input as any).rows).toBeUndefined();
    expect((input as any).wrap).toBeUndefined();
    expect(input.value).toBe('test');
    lease.dispose();
  });
});
