import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype } from '@proto.ui/core';
import { declareTextControl } from '@proto.ui/module-text-control';
import type { InputOtpInputProps } from './types';
import { setupInputOtpInput } from './input.proto';
export const asInputOtpControl = defineAsHook<
  InputOtpInputProps,
  Record<string, unknown>,
  { state: { disabled: State<boolean>; focusVisible: State<boolean> } }
>({
  name: 'as-input-otp-control',
  modules: [declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' })],
  setup: (def) => setupInputOtpInput(def, true),
});
export default definePrototype<InputOtpInputProps>({
  name: 'base-input-otp-control',
  modules: asInputOtpControl.modules,
  setup: (def) => setupInputOtpInput(def, true),
});
