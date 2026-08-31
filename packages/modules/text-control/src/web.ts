import {
  canonicalizeLineEndings,
  type TextControlEvent,
  type TextControlPatch,
  type TextControlSnapshot,
} from '@proto.ui/core';
import type { TextControlHost, TextControlHostConnection, TextControlHostLease } from './caps';
import type { TextControlDeclaration } from './declaration';

export type WebTextControl = HTMLTextAreaElement | HTMLInputElement;

function isWebInput(target: WebTextControl): target is HTMLInputElement {
  return target.localName === 'input';
}

function isWebTextArea(target: WebTextControl): target is HTMLTextAreaElement {
  return target.localName === 'textarea';
}

// `url` is intentionally excluded: the browser's URL value-sanitization algorithm
// trims leading/trailing ASCII whitespace, which the module's plain-text
// canonicalization does not mirror. Including it would let controlled restoration
// repeatedly project a value the host cannot retain, violating C-TEXT-CONTROL-0001-I.
const TEXT_COMPATIBLE_INPUT_TYPES = new Set(['text', 'search', 'tel', 'password']);
export type WebTextControlLocalName = 'textarea' | 'input';

export function resolveWebTextControlLocalName(
  declaration: TextControlDeclaration
): WebTextControlLocalName {
  if (declaration.content !== 'plain-text' || declaration.engine !== 'host') {
    throw new Error('[TextControl] unsupported Web text-control declaration.');
  }
  if (declaration.lineMode === 'single') return 'input';
  if (declaration.lineMode === 'multiline') return 'textarea';
  throw new Error('[TextControl] unsupported Web text-control declaration.');
}

export function createWebTextControlHost(
  getTarget: () => WebTextControl | null,
  options: Readonly<{ stopPropagation?: boolean }> = {}
): TextControlHost {
  return {
    attach(connection) {
      const target = getTarget();
      if (!target) throw new Error('[TextControl] physical web target is unavailable.');
      return attachTarget(target, connection, options);
    },
  };
}

function attachTarget(
  target: WebTextControl,
  connection: TextControlHostConnection,
  options: Readonly<{ stopPropagation?: boolean }>
): TextControlHostLease {
  assertTextCompatibleTarget(target);
  let patch = connection.patch;
  let composing = false;
  let disposed = false;
  let valueProjectionDeferred = false;

  const emit = (event: Event) => {
    if (disposed) return;
    if (options.stopPropagation) event.stopPropagation();
    assertTextCompatibleTarget(target);
    const type = event.type as TextControlEvent['type'];
    const editingEvent = event as Event & {
      readonly data?: unknown;
      readonly inputType?: unknown;
      readonly isComposing?: unknown;
    };
    const carriesData = type === 'input' || type.startsWith('composition');
    const data = carriesData && typeof editingEvent.data === 'string' ? editingEvent.data : null;
    const inputType =
      type === 'input' && typeof editingEvent.inputType === 'string'
        ? editingEvent.inputType
        : null;
    if (type === 'compositionstart') composing = true;
    if (type === 'input' && editingEvent.isComposing === true) composing = true;
    if (type === 'compositionend') composing = false;
    connection.onEvent(
      Object.freeze({
        type,
        value: canonicalizeLineEndings(target.value),
        composing,
        data,
        inputType,
      })
    );
    if (disposed) return;
    if (type === 'compositionend' && valueProjectionDeferred) {
      assertTextCompatibleTarget(target);
      valueProjectionDeferred = applyPatch(target, patch, true);
    }
  };

  const eventTypes = [
    'input',
    'change',
    'compositionstart',
    'compositionupdate',
    'compositionend',
  ] as const;
  for (const type of eventTypes) target.addEventListener(type, emit);
  valueProjectionDeferred = applyPatch(target, patch, true);

  return {
    update(next) {
      if (disposed) return;
      assertTextCompatibleTarget(target);
      patch = next;
      valueProjectionDeferred = applyPatch(target, patch, !composing);
    },
    snapshot(): TextControlSnapshot {
      assertTextCompatibleTarget(target);
      return Object.freeze({ value: canonicalizeLineEndings(target.value), composing });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const type of eventTypes) target.removeEventListener(type, emit);
    },
  };
}

function assertTextCompatibleTarget(target: WebTextControl): void {
  if (isWebInput(target) && !TEXT_COMPATIBLE_INPUT_TYPES.has(target.type)) {
    throw new Error(`[TextControl] unsupported Web input type "${target.type}".`);
  }
}

function applyPatch(
  target: WebTextControl,
  patch: TextControlPatch,
  allowValueProjection: boolean
): boolean {
  let valueProjectionDeferred = false;
  if (typeof patch.defaultValue === 'string' && target.defaultValue !== patch.defaultValue) {
    target.defaultValue = patch.defaultValue;
  }
  const value =
    patch.value ?? (patch.valueMode === 'uncontrolled' ? patch.defaultValue : undefined);
  if (typeof value === 'string' && target.value !== value) {
    if (allowValueProjection) replaceValuePreservingEditingSession(target, value);
    else valueProjectionDeferred = true;
  }
  if (typeof patch.disabled === 'boolean') target.disabled = patch.disabled;
  if (typeof patch.readOnly === 'boolean') target.readOnly = patch.readOnly;
  if (typeof patch.placeholder === 'string') target.placeholder = patch.placeholder;
  if (typeof patch.rows === 'number' && Number.isFinite(patch.rows) && isWebTextArea(target)) {
    target.rows = Math.max(1, Math.trunc(patch.rows));
  }
  if (typeof patch.required === 'boolean') target.required = patch.required;
  if (typeof patch.name === 'string') target.name = patch.name;
  if (typeof patch.autoComplete === 'string') {
    if (patch.autoComplete) target.setAttribute('autocomplete', patch.autoComplete);
    else target.removeAttribute('autocomplete');
  }
  if (typeof patch.minLength === 'number' && Number.isFinite(patch.minLength)) {
    const minLength = Math.trunc(patch.minLength);
    if (minLength < 0) target.removeAttribute('minlength');
    else target.minLength = minLength;
  }
  if (typeof patch.maxLength === 'number' && Number.isFinite(patch.maxLength)) {
    const maxLength = Math.trunc(patch.maxLength);
    if (maxLength < 0) target.removeAttribute('maxlength');
    else target.maxLength = maxLength;
  }
  if (patch.wrap === 'soft' || patch.wrap === 'hard') {
    if (isWebTextArea(target)) target.wrap = patch.wrap;
  }
  if (isWebInput(target) || isWebTextArea(target)) {
    target.inputMode = patch.inputMode ?? '';
  }
  if (isWebInput(target) || isWebTextArea(target)) {
    target.enterKeyHint = patch.enterKeyHint ?? '';
  }
  return valueProjectionDeferred;
}

function replaceValuePreservingEditingSession(target: WebTextControl, value: string): void {
  // Guard: some input types (file, checkbox, radio, etc.) throw on value assignment
  // or do not support setSelectionRange. Only restore selection for text-compatible types.
  const isTextCompatible =
    isWebTextArea(target) || (isWebInput(target) && TEXT_COMPATIBLE_INPUT_TYPES.has(target.type));
  if (!isTextCompatible) {
    target.value = value;
    return;
  }
  const selectionStart = target.selectionStart ?? 0;
  const selectionEnd = target.selectionEnd ?? 0;
  const selectionDirection = target.selectionDirection ?? 'none';
  const scrollTop = target.scrollTop;
  const scrollLeft = target.scrollLeft;
  target.value = value;
  const nextLength = value.length;
  target.setSelectionRange(
    Math.min(selectionStart, nextLength),
    Math.min(selectionEnd, nextLength),
    selectionDirection
  );
  target.scrollTop = scrollTop;
  target.scrollLeft = scrollLeft;
}
