import type { ExpressionIR, PrototypeIR, SourceSpan, ValueType } from './ir';
import { partitionModuleBindings } from './source-module-bindings';
import { objectFields, valueAlternatives } from './value-types';

/** Accessor identity survives aliases and type views; a read is an actual call. */
export function hasAccessorField(type: ValueType, key?: string): boolean {
  return valueAlternatives(type).some((member) =>
    objectFields(member)?.some(
      (field) => field.accessor === 'get' && (key === undefined || key === field.name)
    )
  );
}

/** Unlike a data field, a getter read cannot be reused as a stable flow fact. */
export function expressionReadsAccessor(value: ExpressionIR): boolean {
  if (value.kind === 'member') return hasAccessorField(value.object.type, value.property);
  if (value.kind === 'element')
    return hasAccessorField(
      value.object.type,
      value.index.kind === 'literal' ? String(value.index.value) : undefined
    );
  if (value.kind === 'object-spread')
    return value.parts.some((part) => part.kind === 'spread' && hasAccessorField(part.value.type));
  return false;
}

/** Objects allocated at module initialization retain module identity across owners. */
function storesAccessor(type: ValueType): boolean {
  return valueAlternatives(type).some((member) => {
    const fields = objectFields(member);
    return fields?.some((field) => !!field.accessor || storesAccessor(field.type)) ?? false;
  });
}

/**
 * Owner-local helpers may allocate getter objects when called. A module object
 * already allocated before any owner exists cannot instead be copied per owner
 * just because its accessor closes over an owner-dependent helper or default.
 */
export function moduleAccessorStorageIssue(
  ir: PrototypeIR
): { message: string; span: SourceSpan } | undefined {
  for (const binding of partitionModuleBindings(ir).owned) {
    if (binding.value.kind !== 'function' && storesAccessor(binding.value.type))
      return {
        message:
          'A module getter object cannot depend on owner-local operations or helpers; create the object inside the owner instead.',
        span: binding.span,
      };
  }
  return undefined;
}
