import type { FocusRequestOptions, FocusScopeActivationOptions } from '@proto.ui/core';

// Private identity carried in the existing options argument. Explicit requests
// create a snapshot; Module/Center replay retains it, including owner changes.
// Nothing is added to the author API or privileged host-capability shape.
const intents = new WeakSet<FocusRequestOptions>();

export function createFocusRequestIntent(options?: FocusRequestOptions): FocusRequestOptions {
  const intent = { ...options };
  intents.add(intent);
  return intent;
}

// Run under the receiving target/Entry's existing request preflight. Stripping
// activation policy earlier would execute author getters before it owns them.
export function createScopeFocusRequestIntent(
  options?: FocusScopeActivationOptions
): FocusRequestOptions {
  const { entry: _entry, ...intent } = options ?? { reason: 'programmatic' as const };
  intents.add(intent);
  return intent;
}

export function retainFocusRequestIntent(options?: FocusRequestOptions): FocusRequestOptions {
  return options && intents.has(options) ? options : createFocusRequestIntent(options);
}
