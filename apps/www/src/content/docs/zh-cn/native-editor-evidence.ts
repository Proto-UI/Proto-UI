import assert from 'node:assert/strict';

export type NativeEditorInput = {
  type: string;
  inputType: string;
  data: string | null;
  composing: boolean;
  isTrusted: boolean;
  value: string;
};

/** C-TEXT-CONTROL-0001-C: preserve each native input's facts and order. */
export function assertNativeValueChangeSequence(
  nativeInputs: readonly NativeEditorInput[],
  requests: readonly { detail: unknown }[]
): void {
  assert.ok(nativeInputs.length > 0, 'the real editor must receive native input');
  for (const input of nativeInputs) {
    assert.equal(input.type, 'input');
    assert.equal(input.isTrusted, true, 'synthetic dispatch is not native editing evidence');
  }
  assert.deepEqual(
    requests.map((request) => request.detail),
    nativeInputs.map(({ value, composing, data, inputType }) => ({
      value,
      composing,
      data,
      inputType,
    })),
    'valueChange must preserve every native input exactly once and in order'
  );
}
