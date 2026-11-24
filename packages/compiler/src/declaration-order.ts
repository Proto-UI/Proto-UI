import { reject } from './diagnostics';
import type { SourceSpan, StatementIR } from './ir';

/** Insert invocation-local initialization without moving authored declarations forward. */
export function prependInvocationStatements(
  body: readonly StatementIR[],
  prologue: readonly StatementIR[]
): StatementIR[] {
  if (!prologue.length) return [...body];
  let hoisted = 0;
  while (hoisted < body.length) {
    const statement = body[hoisted];
    if (statement.kind !== 'const' || statement.declarationPosition === undefined) break;
    hoisted++;
  }
  // Creating these checked function values is inert. Their ordinary binding
  // hoisting stays intact; structural discovery still follows the prologue
  // and each function's original authored position.
  return [
    ...body.slice(0, hoisted).map((statement) => ({
      ...statement,
      declarationPosition:
        (statement as Extract<StatementIR, { kind: 'const' }>).declarationPosition! +
        prologue.length,
    })),
    ...prologue,
    ...body.slice(hoisted),
  ];
}

/** Restore definition order while leaving the ordinary hoisted binding order intact. */
export function structuralStatementOrder(
  body: readonly StatementIR[],
  rejectionSpan: (statement: StatementIR) => SourceSpan = (statement) => statement.span
): readonly StatementIR[] {
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
        rejectionSpan(statement),
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
