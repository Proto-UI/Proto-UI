import assert from 'node:assert/strict';

/** Preserve all observed records; classification never changes isTrusted. */
export function partitionRecipeInputs(inputs) {
  return {
    nativeInputs: inputs.filter((event) => event.channel === 'physical-input'),
    outwardSignals: inputs.filter((event) => event.channel === 'outward-signal'),
    unclassifiedEvents: inputs.filter(
      (event) => event.channel !== 'physical-input' && event.channel !== 'outward-signal'
    ),
  };
}

export function assertNativeRecipeInputs(inputs) {
  const { nativeInputs, outwardSignals, unclassifiedEvents } = partitionRecipeInputs(inputs);
  assert.deepEqual(
    unclassifiedEvents,
    [],
    'all recorded events have a known physical or outward source'
  );
  assert.ok(
    nativeInputs.every((event) => event.trusted),
    'fixture never dispatches synthetic input'
  );
  assert.ok(
    nativeInputs.some((event) => event.trusted),
    'at least one trusted native input'
  );
  assert.ok(
    outwardSignals.every(
      (event) =>
        event.type === 'click' &&
        event.eventClass === 'CustomEvent' &&
        event.carrier === 'wc-expose-click-void'
    ),
    'outward signals use the declared WC click:void carrier'
  );
}
