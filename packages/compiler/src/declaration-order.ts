import { reject } from './diagnostics';
import type { StatementIR } from './ir';

/** Restore definition order while leaving the ordinary hoisted binding order intact. */
export function structuralStatementOrder(body: readonly StatementIR[]): readonly StatementIR[] {
  const positions = new Map<number, StatementIR>();
  const ordinary: StatementIR[] = [];
  let lastPosition = body.length;
  let passedHoists = false;
  for (const statement of body) {
    const position = (statement as { declarationPosition?: unknown }).declarationPosition;
    if (position === undefined) {
      passedHoists = true;
      ordinary.push(statement);
      continue;
    }
    if (
      statement.kind !== 'const' ||
      statement.value.kind !== 'function' ||
      typeof position !== 'number' ||
      !Number.isSafeInteger(position) ||
      position < 0 ||
      position >= body.length ||
      positions.has(position) ||
      passedHoists ||
      position >= lastPosition
    )
      reject(
        'PUI2002',
        'Hoisted function declarations require unique structural positions and a reversed leading prefix.',
        statement.span,
        'invalid-ir'
      );
    positions.set(position, statement);
    lastPosition = position;
  }
  if (!positions.size) return body;
  let next = 0;
  return Array.from(
    { length: body.length },
    (_, index) => positions.get(index) ?? ordinary[next++]
  );
}
