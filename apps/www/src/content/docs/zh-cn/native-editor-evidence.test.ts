// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertNativeValueChangeSequence, type NativeEditorInput } from './native-editor-evidence';

// Recorded Chromium 154 multiline fill from PR #808 run 37184204831.
const nativeInputs: NativeEditorInput[] = ['Changed', null, 'Second line'].map((data) => ({
  type: 'input',
  inputType: 'insertText',
  data,
  composing: false,
  isTrusted: true,
  value: 'Changed\nSecond line',
}));
const requests = nativeInputs.map(({ value, composing, data, inputType }) => ({
  detail: { value, composing, data, inputType },
}));

describe('native editor event attribution oracle', () => {
  it('accepts one request per actual native input, including a fragmented multiline fill', () => {
    expect(() => assertNativeValueChangeSequence(nativeInputs, requests)).not.toThrow();
    expect(() =>
      assertNativeValueChangeSequence(nativeInputs.slice(0, 1), requests.slice(0, 1))
    ).not.toThrow();
  });

  it.each([
    ['duplicate', [...requests, requests[0]]],
    ['drop', requests.slice(1)],
    ['reorder', [...requests].reverse()],
    ['coalesce', requests.slice(0, 1)],
    ['wrong value', requests.map((request) => ({ detail: { ...request.detail, value: 'wrong' } }))],
    [
      'wrong input type',
      requests.map((request) => ({ detail: { ...request.detail, inputType: 'wrong' } })),
    ],
    [
      'wrong composition',
      requests.map((request) => ({ detail: { ...request.detail, composing: true } })),
    ],
  ])('rejects %s outward delivery', (_name, candidate) => {
    expect(() => assertNativeValueChangeSequence(nativeInputs, candidate)).toThrow();
  });

  it('rejects missing or synthetic native evidence', () => {
    expect(() => assertNativeValueChangeSequence([], [])).toThrow();
    expect(() =>
      assertNativeValueChangeSequence(
        nativeInputs.map((input) => ({ ...input, isTrusted: false })),
        requests
      )
    ).toThrow();
  });
});
