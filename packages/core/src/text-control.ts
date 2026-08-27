import type { PropsBaseType } from '@proto.ui/types';
import type { RunHandle } from './handles';
import type { Unsubscribe } from './state';

export type TextControlValueMode = 'controlled' | 'uncontrolled';
export type TextControlWrap = 'soft' | 'hard';

export type TextControlLineMode = 'single' | 'multiline';
export type TextControlInputMode =
  | 'none'
  | 'text'
  | 'decimal'
  | 'numeric'
  | 'tel'
  | 'search'
  | 'email'
  | 'url';

export type TextControlPatch = Readonly<{
  valueMode?: TextControlValueMode;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  wrap?: TextControlWrap;
  inputMode?: TextControlInputMode;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
}>;

/**
 * Canonicalize CR/LF line endings to LF at the Text Control module boundary
 * before comparison, state projection, snapshots, and outward payloads.
 * Web DOM sanitization alone is not sufficient.
 */
export function canonicalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export type TextControlEventType =
  | 'input'
  | 'change'
  | 'compositionstart'
  | 'compositionupdate'
  | 'compositionend';

export type TextControlEvent = Readonly<{
  type: TextControlEventType;
  value: string;
  composing: boolean;
  data: string | null;
  inputType: string | null;
}>;

export type TextControlSnapshot = Readonly<{
  value: string;
  composing: boolean;
}>;

export interface TextControlHandle<P extends PropsBaseType = PropsBaseType> {
  on(
    type: TextControlEventType,
    callback: (run: RunHandle<P>, event: TextControlEvent) => void
  ): Unsubscribe;
  sync(patch: TextControlPatch): void;
  snapshot(): TextControlSnapshot | null;
}
