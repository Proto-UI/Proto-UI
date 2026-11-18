import type { ExpressionIR } from './ir';

/** Evaluation operands of ordinary structural expressions, in source order. */
export function ordinaryValueChildren(value: ExpressionIR): readonly ExpressionIR[] | undefined {
  switch (value.kind) {
    case 'narrow':
      return [value.value];
    case 'member-write':
      return [value.object, value.value];
    case 'element':
      return [value.object, value.index];
    case 'conditional':
      return [value.condition, value.then, value.otherwise];
    case 'call':
      return [value.callee, ...value.arguments];
    case 'intrinsic':
      return value.arguments;
    case 'object-spread':
      return value.parts.map((part) => part.value);
    default:
      return undefined;
  }
}
