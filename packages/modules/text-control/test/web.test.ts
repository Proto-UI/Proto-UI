import { describe, expect, it, vi } from 'vitest';
import type { TextControlEvent } from '@proto.ui/core';
import { createWebTextControlHost, resolveWebTextControlLocalName } from '../src/web';

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

  it('reads editing payloads independently of target and event realms', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const targetDocument = iframe.contentDocument;
    const targetView = iframe.contentWindow;
    expect(targetDocument).not.toBeNull();
    expect(targetView).not.toBeNull();
    if (!targetDocument || !targetView) throw new Error('iframe realm is unavailable');
    const targetRealm = targetView as unknown as Pick<
      typeof globalThis,
      'CompositionEvent' | 'InputEvent'
    >;
    const originalTargetCompositionEvent = targetRealm.CompositionEvent;
    const originalTargetInputEvent = targetRealm.InputEvent;
    class TargetRealmCompositionEvent extends Event {
      readonly data: string | null;
      constructor(type: string, init: CompositionEventInit = {}) {
        super(type, init);
        this.data = init.data ?? null;
      }
    }
    class TargetRealmInputEvent extends Event {
      readonly data: string | null;
      readonly inputType: string;
      readonly isComposing: boolean;
      constructor(type: string, init: InputEventInit = {}) {
        super(type, init);
        this.data = init.data ?? null;
        this.inputType = init.inputType ?? '';
        this.isComposing = init.isComposing ?? false;
      }
    }
    Object.defineProperties(targetView, {
      CompositionEvent: { configurable: true, value: TargetRealmCompositionEvent },
      InputEvent: { configurable: true, value: TargetRealmInputEvent },
    });
    expect(targetRealm.CompositionEvent).not.toBe(CompositionEvent);
    expect(targetRealm.InputEvent).not.toBe(InputEvent);

    const input = targetDocument.createElement('input');
    targetDocument.body.appendChild(input);
    const seen: TextControlEvent[] = [];
    const lease = createWebTextControlHost(() => input).attach({
      patch: { valueMode: 'uncontrolled', defaultValue: '' },
      onEvent: (event) => seen.push(event),
    });

    const compositionStart = new targetRealm.CompositionEvent('compositionstart', {
      bubbles: true,
      data: '編',
    });
    const inputEvent = new targetRealm.InputEvent('input', {
      bubbles: true,
      data: '中',
      inputType: 'insertCompositionText',
      isComposing: true,
    });
    input.dispatchEvent(compositionStart);
    input.value = '編集中';
    input.dispatchEvent(inputEvent);

    input.value = 'other realm';
    const otherRealmInput = new InputEvent('input', {
      bubbles: true,
      data: '他',
      inputType: 'insertText',
      isComposing: false,
    });
    expect(otherRealmInput instanceof targetRealm.InputEvent).toBe(false);
    input.dispatchEvent(otherRealmInput);

    document.adoptNode(input);
    document.body.appendChild(input);
    expect(input.ownerDocument).toBe(document);
    const adoptedComposition = new CompositionEvent('compositionupdate', { bubbles: true });
    Object.defineProperty(adoptedComposition, 'data', { value: 'adopted' });
    input.dispatchEvent(adoptedComposition);

    expect(seen).toEqual([
      {
        type: 'compositionstart',
        value: '',
        composing: true,
        data: '編',
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
        type: 'input',
        value: 'other realm',
        composing: true,
        data: '他',
        inputType: 'insertText',
      },
      {
        type: 'compositionupdate',
        value: 'other realm',
        composing: true,
        data: 'adopted',
        inputType: null,
      },
    ]);

    lease.dispose();
    Object.defineProperties(targetView, {
      CompositionEvent: { configurable: true, value: originalTargetCompositionEvent },
      InputEvent: { configurable: true, value: originalTargetInputEvent },
    });
    iframe.remove();
  });

  it('reads editing payloads when the target document has no Window', () => {
    const targetDocument = document.implementation.createHTMLDocument('detached');
    expect(targetDocument.defaultView).toBeNull();
    const input = targetDocument.createElement('input');
    const seen: TextControlEvent[] = [];
    const lease = createWebTextControlHost(() => input).attach({
      patch: { valueMode: 'uncontrolled', defaultValue: '' },
      onEvent: (event) => seen.push(event),
    });

    input.value = 'detached';
    input.dispatchEvent(
      new InputEvent('input', {
        data: 'd',
        inputType: 'insertText',
        isComposing: true,
      })
    );

    expect(seen).toEqual([
      {
        type: 'input',
        value: 'detached',
        composing: true,
        data: 'd',
        inputType: 'insertText',
      },
    ]);
    lease.dispose();
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
  it('resolves declarations to their physical Web editor local names', () => {
    expect(
      resolveWebTextControlLocalName({ content: 'plain-text', lineMode: 'single', engine: 'host' })
    ).toBe('input');
    expect(
      resolveWebTextControlLocalName({
        content: 'plain-text',
        lineMode: 'multiline',
        engine: 'host',
      })
    ).toBe('textarea');
  });

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

  it.each(['text', 'search', 'tel', 'password'])(
    'projects values through the text-compatible input type %s',
    (type) => {
      const input = document.createElement('input');
      input.type = type;
      const lease = createWebTextControlHost(() => input).attach({
        patch: { valueMode: 'controlled', value: 'initial' },
        onEvent() {},
      });

      expect(input.value).toBe('initial');
      lease.update({ valueMode: 'controlled', value: 'updated' });
      expect(input.value).toBe('updated');
      lease.dispose();
    }
  );

  it.each(['file', 'checkbox', 'url'])(
    'rejects unsupported input type %s before projection',
    (type) => {
      const input = document.createElement('input');
      input.type = type;
      const valueBeforeAttach = input.value;
      const onEvent = vi.fn();

      expect(() =>
        createWebTextControlHost(() => input).attach({
          patch: { valueMode: 'controlled', value: 'plain text' },
          onEvent,
        })
      ).toThrow(`[TextControl] unsupported Web input type "${type}".`);
      expect(input.value).toBe(valueBeforeAttach);
      input.dispatchEvent(new InputEvent('input'));
      expect(onEvent).not.toHaveBeenCalled();
    }
  );

  it('fails closed when a leased input mutates to a non-text type', () => {
    const input = document.createElement('input');
    const onEvent = vi.fn();
    const lease = createWebTextControlHost(() => input, { stopPropagation: true }).attach({
      patch: { valueMode: 'controlled', value: 'initial' },
      onEvent,
    });

    input.type = 'checkbox';
    const event = new InputEvent('input', { bubbles: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    expect(() => input.dispatchEvent(event)).toThrow(
      '[TextControl] unsupported Web input type "checkbox".'
    );
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => lease.snapshot()).toThrow('[TextControl] unsupported Web input type "checkbox".');
    expect(() => lease.update({ valueMode: 'controlled', value: 'updated' })).toThrow(
      '[TextControl] unsupported Web input type "checkbox".'
    );
    lease.dispose();
  });

  it('revalidates deferred composition restoration after the owner callback', () => {
    const input = document.createElement('input');
    const lease = createWebTextControlHost(() => input).attach({
      patch: { valueMode: 'controlled', value: 'owner' },
      onEvent(event) {
        if (event.type === 'compositionend') input.type = 'file';
      },
    });
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = 'candidate';
    lease.update({ valueMode: 'controlled', value: 'next owner' });

    expect(() => input.dispatchEvent(new CompositionEvent('compositionend'))).toThrow(
      '[TextControl] unsupported Web input type "file".'
    );
    expect(input.value).toBe('');
    lease.dispose();
  });

  it('does not restore a deferred value after the owner callback disposes the lease', () => {
    const input = document.createElement('input');
    let lease: ReturnType<ReturnType<typeof createWebTextControlHost>['attach']>;
    lease = createWebTextControlHost(() => input).attach({
      patch: { valueMode: 'controlled', value: 'owner' },
      onEvent(event) {
        if (event.type === 'compositionend') lease.dispose();
      },
    });
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = 'candidate';
    lease.update({ valueMode: 'controlled', value: 'next owner' });
    input.dispatchEvent(new CompositionEvent('compositionend'));

    expect(input.value).toBe('candidate');
  });

  it('projects and preserves selection when the current-realm constructor does not own the input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    vi.stubGlobal('HTMLInputElement', class CurrentRealmHTMLInputElement {});
    expect(input instanceof HTMLInputElement).toBe(false);
    try {
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
    } finally {
      vi.unstubAllGlobals();
      input.remove();
    }
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
  it('projects common input hints to a textarea', () => {
    const textarea = document.createElement('textarea');
    const lease = createWebTextControlHost(() => textarea).attach({
      patch: {
        valueMode: 'uncontrolled',
        inputMode: 'email',
        enterKeyHint: 'next',
      },
      onEvent() {},
    });

    expect(textarea.inputMode).toBe('email');
    expect(textarea.enterKeyHint).toBe('next');
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
