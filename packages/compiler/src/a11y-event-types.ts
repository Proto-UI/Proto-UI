import type { ExpressionIR } from './ir';

export const DEFAULT_SET_VALUE_EVENT = 'host:a11y-set-value';

/**
 * A checked declaration binds an owner-local numeric action route. A generic
 * host event, a global listener, or a type assertion does not supply this proof.
 * Keep this derivation shared by source parsing and independent IR validation.
 */
export function declaredSetValueEvent(args: readonly ExpressionIR[]): string | undefined {
  const key = args[0];
  if (key?.kind !== 'literal' || key.value !== 'setValue') return undefined;
  const spec = args[1];
  if (!spec || (spec.kind === 'literal' && spec.value === undefined))
    return DEFAULT_SET_VALUE_EVENT;
  if (spec.kind !== 'record') return undefined;
  const event = spec.entries.find((entry) => entry.key === 'event')?.value;
  if (!event) return DEFAULT_SET_VALUE_EVENT;
  return event.kind === 'literal' &&
    typeof event.value === 'string' &&
    event.value.startsWith('host:') &&
    event.value.length > 5
    ? event.value
    : undefined;
}
