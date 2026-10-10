import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const INPUT_OTP_FAMILY = createAnatomyFamily('base-input-otp', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    input: { cardinality: { min: 1, max: 1 } },
    slot: { cardinality: { min: 0, max: '*' } },
    separator: { cardinality: { min: 0, max: '*' } },
  },
  relations: ['input', 'slot', 'separator'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export type InputOtpContext = {
  value: string;
  length: number;
  disabled: boolean;
  controlDisabled: boolean;
  controlReadOnly: boolean;
  readOnly: boolean;
  complete: boolean;
  pattern: 'numeric' | 'alphanumeric';
  name: string;
  label: string;
  focused: boolean;
};
export const INPUT_OTP_CONTEXT = createContextKey<InputOtpContext>('base-input-otp');
export function otpMethod(run: RunHandle<any>, key: string, ...args: unknown[]) {
  const fn = run.anatomy.partsOf(INPUT_OTP_FAMILY, 'root')[0]?.getExpose(key);
  return typeof fn === 'function' ? fn(...args) : false;
}
export function normalizeOtp(value: unknown, length: number, pattern: string) {
  return typeof value === 'string'
    ? value.replace(pattern === 'numeric' ? /[^0-9]/g : /[^0-9a-z]/gi, '').slice(0, length)
    : '';
}
