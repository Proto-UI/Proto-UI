import type { PropsBaseType } from '@proto.ui/types';
import type { RunHandle } from './handles';
import type { Unsubscribe } from './state';

export type TextControlValueMode = 'controlled' | 'uncontrolled';
export type TextControlWrap = 'soft' | 'hard';

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
}>;

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
