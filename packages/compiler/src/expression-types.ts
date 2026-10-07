import { dataTypeEqual, type DataType } from './data-types';
import type { ExpressionIR, ValueType } from './ir';

export type UnaryOperator = '!' | '-' | '+';
export type BinaryOperator =
  | '===' | '!==' | '<' | '<=' | '>' | '>='
  | '+' | '-' | '*' | '/' | '%' | '&&' | '||' | '??';

type AtomicDataType = Exclude<DataType, { kind: 'union' }>;

function alternatives(type: DataType): AtomicDataType[] {
  if (typeof type !== 'string' && type.kind === 'union')
    return type.members.flatMap(alternatives);
  return [type];
}

function primitive(type: AtomicDataType): string | undefined {
  if (typeof type === 'string') return type;
  if (type.kind !== 'literal') return undefined;
  return type.value === null ? 'null' : typeof type.value;
}

/** Normalize result alternatives without inventing an any/unknown escape hatch. */
function union(types: readonly DataType[]): DataType {
  const members: AtomicDataType[] = [];
  for (const candidate of types.flatMap(alternatives)) {
    if (members.some((member) => dataTypeEqual(member, candidate))) continue;
    members.push(candidate);
  }
  const normalized = members.filter((member) =>
    typeof member === 'string' || member.kind !== 'literal' ||
    !members.some((other) => typeof other === 'string' && other === primitive(member))
  );
  if (normalized.length === 0) return { kind: 'union', members: [] };
  if (normalized.length === 1) return normalized[0];
  return { kind: 'union', members: normalized };
}

function isNullish(type: AtomicDataType): boolean {
  const kind = primitive(type);
  return kind === 'null' || kind === 'void';
}

/** Primitive coercion is explicit; object-to-primitive execution is not admitted. */
function requireScalar(type: AtomicDataType, operator: string): string {
  const kind = primitive(type);
  if (kind === undefined)
    throw new TypeError(`Operator ${operator} requires primitive operands; record and array coercion is unsupported.`);
  return kind;
}

function truthy(type: AtomicDataType): AtomicDataType | undefined {
  if (isNullish(type)) return undefined;
  if (type === 'boolean') return { kind: 'literal', value: true };
  if (typeof type !== 'string' && type.kind === 'literal')
    return type.value ? type : undefined;
  return type;
}

function falsy(type: AtomicDataType): AtomicDataType | undefined {
  if (isNullish(type)) return type;
  if (type === 'boolean') return { kind: 'literal', value: false };
  if (type === 'string') return { kind: 'literal', value: '' };
  // Number includes both zero and NaN. There is no NaN literal in the shared schema.
  if (type === 'number') return type;
  if (typeof type !== 'string' && type.kind === 'literal')
    return type.value ? undefined : type;
  return undefined;
}

export function inferUnaryType(operator: string, operand: DataType): DataType {
  if (operator !== '!' && operator !== '-' && operator !== '+')
    throw new TypeError(`Unsupported unary operator ${operator}.`);
  const members = alternatives(operand);
  if (members.length === 0) return union([]);
  if (operator !== '!') {
    for (const member of members) requireScalar(member, operator);
    return 'number';
  }
  const canBeTruthy = members.some((member) => truthy(member) !== undefined);
  const canBeFalsy = members.some((member) => falsy(member) !== undefined);
  return canBeTruthy && canBeFalsy ? 'boolean' : { kind: 'literal', value: !canBeTruthy };
}

export function inferBinaryType(operator: string, left: DataType, right: DataType): DataType {
  const leftMembers = alternatives(left);
  const rightMembers = alternatives(right);

  if (operator === '&&' || operator === '||') {
    const retained = leftMembers
      .map(operator === '&&' ? falsy : truthy)
      .filter((member): member is AtomicDataType => member !== undefined);
    const reachesRight = leftMembers.some((member) =>
      (operator === '&&' ? truthy(member) : falsy(member)) !== undefined
    );
    return union(reachesRight ? [...retained, right] : retained);
  }
  if (operator === '??') {
    const retained = leftMembers.filter((member) => !isNullish(member));
    return union(leftMembers.some(isNullish) ? [...retained, right] : retained);
  }
  // Strict equality does not coerce operands, and can compare structured identities.
  if (operator === '===' || operator === '!==')
    return leftMembers.length && rightMembers.length ? 'boolean' : union([]);
  if (!['+', '-', '*', '/', '%', '<', '<=', '>', '>='].includes(operator))
    throw new TypeError(`Unsupported binary operator ${operator}.`);
  if (leftMembers.length === 0 || rightMembers.length === 0) return union([]);

  const leftKinds = leftMembers.map((member) => requireScalar(member, operator));
  const rightKinds = rightMembers.map((member) => requireScalar(member, operator));
  if (['<', '<=', '>', '>='].includes(operator)) return 'boolean';
  if (operator !== '+') return 'number';

  const result: DataType[] = [];
  if (leftKinds.includes('string') || rightKinds.includes('string')) result.push('string');
  if (leftKinds.some((kind) => kind !== 'string') && rightKinds.some((kind) => kind !== 'string'))
    result.push('number');
  return union(result);
}

function isArrayIndex(key: string | number): boolean {
  if (typeof key === 'string' && !/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = typeof key === 'number' ? key : Number(key);
  return Number.isInteger(index) && index >= 0 && index < 0xffffffff;
}

/**
 * Resolve declared data members, not prototypes or semantic capability handles.
 * `void` means undefined: optional fields and potentially absent array entries
 * preserve it, while optional access suppresses only nullish receivers.
 */
export function memberDataType(
  type: DataType,
  key: string | number,
  { optional = false }: { optional?: boolean } = {}
): DataType {
  const results: DataType[] = [];
  for (const member of alternatives(type)) {
    if (isNullish(member)) {
      if (!optional) throw new TypeError(`Cannot access member ${String(key)} on a nullish receiver.`);
      results.push('void');
      continue;
    }
    if (typeof member === 'string' || member.kind === 'literal')
      throw new TypeError(`Member ${String(key)} is unsupported on primitive data.`);
    if (member.kind === 'record') {
      const field = member.fields.find((entry) => entry.name === String(key));
      if (!field) throw new TypeError(`Undeclared record member ${String(key)}.`);
      results.push(field.type);
      if (field.optional) results.push('void');
      continue;
    }
    if (key === 'length') results.push('number');
    else if (isArrayIndex(key)) results.push(member.element, 'void');
    else throw new TypeError(`Unsupported array member ${String(key)}.`);
  }
  return union(results);
}

/** Refine only immutable lexical values; calls and mutable State reads are never narrowed. */
export function conditionRefinements(condition: ExpressionIR, truth: boolean): readonly [string, ValueType][] {
  if (condition.kind === 'unary' && condition.operator === '!') return conditionRefinements(condition.operand,!truth);
  if (condition.kind === 'binary' && (condition.operator === '&&' && truth || condition.operator === '||' && !truth))
    return [...conditionRefinements(condition.left,truth),...conditionRefinements(condition.right,truth)];
  let target: ExpressionIR = condition, literal: string | number | boolean | null | undefined;
  let equality = truth;
  if (condition.kind === 'binary' && (condition.operator === '===' || condition.operator === '!==')) {
    const constant = condition.right.kind === 'literal' ? condition.right : condition.left.kind === 'literal' ? condition.left : undefined;
    if (!constant) return [];
    target = constant === condition.right ? condition.left : condition.right;
    literal = constant.value; equality = condition.operator === '===' ? truth : !truth;
  }
  const reference = target.kind === 'reference' ? target : target.kind === 'member' && target.object.kind === 'reference' ? target.object : undefined;
  if (!reference) return [];
  const type = reference.type;
  if (typeof type === 'string') {
    if (type.startsWith('state-event:') && target.kind === 'member' && target.property === 'type' && (literal === 'next' || literal === 'disconnect')) {
      const next = literal === 'next' ? equality : !equality;
      return [[reference.name,next ? `state-next:${type.slice('state-event:'.length)}` as ValueType : 'state-disconnect']];
    }
    if (target.kind !== 'reference' || !/^(nullable|optional):/.test(type)) return [];
    if (literal !== undefined && literal !== null) return [];
    if (literal === null && type.startsWith('optional:')) return [];
    const absent = type.startsWith('nullable:') ? 'null' : 'void';
    const present = literal === null ? !equality : truth;
    return [[reference.name,present ? type.slice(type.indexOf(':')+1) as ValueType : absent]];
  }
  const members = alternatives(type);
  const kept = members.filter((member) => {
    if (target.kind === 'reference') {
      if (literal === null) return isNullish(member) && primitive(member) === 'null' ? equality : !equality;
      if (literal === undefined) return truth ? truthy(member) !== undefined : falsy(member) !== undefined;
      if (typeof member !== 'string' && member.kind === 'literal') return (member.value === literal) === equality;
      return true;
    }
    if (target.kind !== 'member' || literal === undefined || typeof member === 'string' || member.kind !== 'record') return true;
    const field = member.fields.find((field) => field.name === target.property);
    if (!field || typeof field.type === 'string' || field.type.kind !== 'literal') return true;
    return (field.type.value === literal) === equality;
  });
  return [[reference.name,union(kept)]];
}
