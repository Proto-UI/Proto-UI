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

/**
 * Patch fields shared by single-line and multiline controls.
 */
export type TextControlPatchCommon = Readonly<{
  valueMode?: TextControlValueMode;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  required?: boolean;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  inputMode?: TextControlInputMode;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
}>;

/**
 * Multiline-only presentation fields. These are meaningless on a single-line
 * control and are excluded from the single-line patch shape.
 */
export type TextControlMultilinePatchFields = Readonly<{
  rows?: number;
  wrap?: TextControlWrap;
}>;

/**
 * Patch accepted by a single-line control. `rows`/`wrap` are not part of the
 * shape, so passing them is a compile-time error.
 */
export type TextControlSingleLinePatch = TextControlPatchCommon;

/**
 * Patch accepted by a multiline control.
 */
export type TextControlMultilinePatch = TextControlPatchCommon & TextControlMultilinePatchFields;

/**
 * Line-mode-aware portable patch. A `single` mode resolves to the single-line
 * shape so a single-line handle rejects `rows`/`wrap` at compile time. An
 * unresolved (`single | multiline`) or `multiline` mode resolves to the full
 * multiline shape; the module still validates `rows`/`wrap` against the retained
 * line-mode declaration at runtime as a backstop.
 */
export type TextControlPatch<Mode extends TextControlLineMode = TextControlLineMode> = [
  Mode,
] extends ['single']
  ? TextControlSingleLinePatch
  : TextControlMultilinePatch;

/**
 * Canonicalize CR/LF line endings to LF at the Text Control module boundary
 * before comparison, state projection, snapshots, and outward payloads.
 * Web DOM sanitization alone is not sufficient.
 */
export function canonicalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normalize a Text Control value to the portable line-mode domain. Single-line
 * controls remove normalized line feeds so module state cannot diverge from a
 * host editor whose value-sanitization algorithm strips them.
 */
export function canonicalizeTextControlValue(value: string, lineMode: TextControlLineMode): string {
  const normalized = canonicalizeLineEndings(value);
  return lineMode === 'single' ? normalized.replace(/\n/g, '') : normalized;
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

export interface TextControlHandle<
  P extends PropsBaseType = PropsBaseType,
  Mode extends TextControlLineMode = TextControlLineMode,
> {
  on(
    type: TextControlEventType,
    callback: (run: RunHandle<P>, event: TextControlEvent) => void
  ): Unsubscribe;
  sync(patch: TextControlPatch<Mode>): void;
  snapshot(): TextControlSnapshot | null;
}
