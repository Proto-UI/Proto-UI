import { dataTypeEqual, type DataType } from './data-types';
import { isDataValueType, type ExpressionIR, type ValueType } from './ir';
import { joinValueTypes, valueAlternatives, objectFields, objectValueType } from './value-types';
import { valueAssignable } from './value-types';

export type UnaryOperator = '!' | '-' | '+';
export type BinaryOperator =
  | '==='
  | '!=='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '&&'
  | '||'
  | '??';

type AtomicDataType = Exclude<DataType, { kind: 'union' }>;

/** A saved predicate is evidence only for immutable bindings, not a past heap/cell read. */
export function stablePredicate(expression: ExpressionIR): boolean {
  switch (expression.kind) {
    case 'literal':
    case 'undefined':
    case 'reference':
      return true;
    case 'narrow':
      return stablePredicate(expression.value);
    case 'unary':
      return stablePredicate(expression.operand);
    case 'binary':
      return stablePredicate(expression.left) && stablePredicate(expression.right);
    case 'intrinsic':
      return expression.name === 'typeof' && expression.arguments.every(stablePredicate);
    default:
      return false;
  }
}

/** Keep stable binding identity while discarding mutable member observations. */
export function invalidateHeapFlow(
  current: ValueType,
  original: ValueType,
  writtenReadonlyFields: ReadonlySet<string> = new Set()
): ValueType {
  return joinValueTypes(
    valueAlternatives(current).map((member) => {
      const fields = objectFields(member);
      if (!fields) return member;
      const candidates = valueAlternatives(original).filter(
        (candidate) => objectFields(candidate) && valueAssignable(member, candidate)
      );
      if (!candidates.length) return member;
      return joinValueTypes(
        candidates.map((candidate) => {
          const declared = objectFields(candidate)!;
          const restored = objectValueType(
            fields.map((field) => {
              const base = declared.find((other) => other.name === field.name);
              if (!base) return field;
              return base.readonly && !writtenReadonlyFields.has(base.name)
                ? {
                    ...field,
                    type: invalidateHeapFlow(field.type, base.type, writtenReadonlyFields),
                  }
                : { ...base };
            })
          );
          return typeof member !== 'string' &&
            member.kind === 'object' &&
            member.index !== undefined
            ? { kind: 'object' as const, fields: [...objectFields(restored)!], index: member.index }
            : restored;
        })
      );
    })
  );
}

function alternatives(type: DataType): AtomicDataType[] {
  if (typeof type !== 'string' && type.kind === 'union') return type.members.flatMap(alternatives);
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
  const normalized = members.filter(
    (member) =>
      typeof member === 'string' ||
      member.kind !== 'literal' ||
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
    throw new TypeError(
      `Operator ${operator} requires primitive operands; record and array coercion is unsupported.`
    );
  return kind;
}

/** Relational operands have one shared primitive domain, including literal unions. */
export function relationalOperandKind(left: DataType, right: DataType): 'number' | 'string' {
  const kinds = [...alternatives(left), ...alternatives(right)].map(primitive);
  if (kinds.every((kind) => kind === 'string')) return 'string';
  if (kinds.every((kind) => kind === 'number')) return 'number';
  throw new TypeError(
    'Relational comparison requires number×number or string×string for every union alternative; mixed, nullish, boolean and structured operands require explicit narrowing or conversion.'
  );
}

function truthy(type: AtomicDataType): AtomicDataType | undefined {
  if (isNullish(type)) return undefined;
  if (type === 'boolean') return { kind: 'literal', value: true };
  if (typeof type !== 'string' && type.kind === 'literal') return type.value ? type : undefined;
  return type;
}

function falsy(type: AtomicDataType): AtomicDataType | undefined {
  if (isNullish(type)) return type;
  if (type === 'boolean') return { kind: 'literal', value: false };
  if (type === 'string') return { kind: 'literal', value: '' };
  // Number includes both zero and NaN. There is no NaN literal in the shared schema.
  if (type === 'number') return type;
  if (typeof type !== 'string' && type.kind === 'literal') return type.value ? undefined : type;
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
    const reachesRight = leftMembers.some(
      (member) => (operator === '&&' ? truthy(member) : falsy(member)) !== undefined
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

  if (['<', '<=', '>', '>='].includes(operator)) {
    relationalOperandKind(left, right);
    return 'boolean';
  }

  const leftKinds = leftMembers.map((member) => requireScalar(member, operator));
  const rightKinds = rightMembers.map((member) => requireScalar(member, operator));
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
      if (!optional)
        throw new TypeError(`Cannot access member ${String(key)} on a nullish receiver.`);
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
export function conditionRefinements(
  condition: ExpressionIR,
  truth: boolean,
  current?: (expression: ExpressionIR) => boolean
): readonly [string, ValueType][] {
  if (condition.kind === 'unary' && condition.operator === '!')
    return conditionRefinements(condition.operand, !truth, current);
  if (
    condition.kind === 'binary' &&
    ((condition.operator === '&&' && truth) || (condition.operator === '||' && !truth))
  )
    return [
      ...conditionRefinements(condition.left, truth, current),
      ...conditionRefinements(condition.right, truth, current),
    ];
  if (
    condition.kind === 'binary' &&
    ((condition.operator === '||' && truth) || (condition.operator === '&&' && !truth))
  ) {
    const left = conditionRefinements(condition.left, truth, current),
      right = conditionRefinements(condition.right, truth, current);
    return left.flatMap(([name, type]) => {
      const other = right.find(([key]) => key === name);
      return other ? [[name, joinValueTypes([type, other[1]])] as [string, ValueType]] : [];
    });
  }
  const fresh = (expression: ExpressionIR): boolean => {
    if (current && !current(expression)) return false;
    if (expression.kind === 'binary') return fresh(expression.left) && fresh(expression.right);
    if (expression.kind === 'unary') return fresh(expression.operand);
    if (expression.kind === 'intrinsic' && expression.name === 'typeof')
      return expression.arguments.every(fresh);
    return true;
  };
  if (!fresh(condition)) return [];
  if (truth && condition.kind === 'intrinsic' && condition.name === 'array.includes') {
    const [array, search] = condition.arguments;
    // Only an immutable binding can carry this proof beyond the comparison.
    // The receiver is checked again by portable intrinsic admission.
    if (
      search?.kind === 'reference' &&
      fresh(search) &&
      array &&
      typeof array.type !== 'string' &&
      array.type.kind === 'array'
    )
      return [[search.name, array.type.element]];
    return [];
  }
  // Positive strict identity is the only refinement from the inert join.
  // It carries nominal authority, which a generic non-null proof cannot infer.
  if (
    condition.kind === 'binary' &&
    ((condition.operator === '===' && truth) || (condition.operator === '!==' && !truth))
  ) {
    const refine = (target: ExpressionIR, proven: ExpressionIR): readonly [string, ValueType][] =>
      target.kind === 'reference' &&
      target.type === 'event-or-control' &&
      (proven.type === 'event' || proven.type === 'event-control')
        ? [[target.name, proven.type]]
        : [];
    const left = refine(condition.left, condition.right);
    if (left.length) return left;
    const right = refine(condition.right, condition.left);
    if (right.length) return right;
  }
  if (
    condition.kind === 'binary' &&
    ((condition.operator === '===' && truth) || (condition.operator === '!==' && !truth))
  ) {
    const present = (
      target: ExpressionIR,
      proof: ExpressionIR
    ): readonly [string, ValueType][] | undefined => {
      if (proof.kind === 'literal') return undefined;
      if (
        valueAlternatives(proof.type).some(
          (type) => type === 'null' || type === 'void' || type === 'unknown'
        )
      )
        return undefined;
      const path: string[] = [];
      let root = target;
      while (root.kind === 'member') {
        path.unshift(root.property);
        root = root.object;
      }
      const reference =
        root.kind === 'reference'
          ? root
          : root.kind === 'lexical-read' && root.cell.kind === 'reference'
            ? root.cell
            : undefined;
      if (!reference) return undefined;
      const refine = (type: ValueType, index: number): ValueType =>
        joinValueTypes(
          valueAlternatives(type)
            .filter((type) => type !== 'null' && type !== 'void')
            .map((member) => {
              if (index === path.length) return member;
              const fields = objectFields(member);
              if (!fields) return member;
              return objectValueType(
                fields.map((field) =>
                  field.name === path[index]
                    ? { ...field, type: refine(field.type, index + 1), optional: false }
                    : field
                )
              );
            })
        );
      return [[reference.name, refine(root.type, 0)]];
    };
    const refined =
      present(condition.left, condition.right) ?? present(condition.right, condition.left);
    if (refined) return refined;
  }
  const ordinary = ordinaryRefinement(condition, truth);
  if (ordinary) return ordinary;
  let target: ExpressionIR = condition,
    literal: string | number | boolean | null | undefined;
  let equality = truth;
  if (
    condition.kind === 'binary' &&
    (condition.operator === '===' || condition.operator === '!==')
  ) {
    const constant =
      condition.right.kind === 'literal'
        ? condition.right
        : condition.left.kind === 'literal'
          ? condition.left
          : undefined;
    if (!constant) return [];
    target = constant === condition.right ? condition.left : condition.right;
    literal = constant.value;
    equality = condition.operator === '===' ? truth : !truth;
  }
  const reference =
    target.kind === 'reference'
      ? target
      : target.kind === 'member' && target.object.kind === 'reference'
        ? target.object
        : undefined;
  if (!reference) return [];
  const type = reference.type;
  if (typeof type === 'string') {
    if (
      type.startsWith('state-event:') &&
      target.kind === 'member' &&
      target.property === 'type' &&
      (literal === 'next' || literal === 'disconnect')
    ) {
      const next = literal === 'next' ? equality : !equality;
      return [
        [
          reference.name,
          next
            ? (`state-next:${type.slice('state-event:'.length)}` as ValueType)
            : 'state-disconnect',
        ],
      ];
    }
    if (target.kind !== 'reference' || !/^(nullable|optional):/.test(type)) return [];
    if (literal !== undefined && literal !== null) return [];
    if (literal === null && type.startsWith('optional:')) return [];
    const absent = type.startsWith('nullable:') ? 'null' : 'void';
    const present = literal === null ? !equality : truth;
    return [[reference.name, present ? (type.slice(type.indexOf(':') + 1) as ValueType) : absent]];
  }
  if (!isDataValueType(type)) return [];
  const members = alternatives(type);
  const kept = members.filter((member) => {
    if (target.kind === 'reference') {
      if (literal === null)
        return isNullish(member) && primitive(member) === 'null' ? equality : !equality;
      if (literal === undefined)
        return truth ? truthy(member) !== undefined : falsy(member) !== undefined;
      if (typeof member !== 'string' && member.kind === 'literal')
        return (member.value === literal) === equality;
      return true;
    }
    if (
      target.kind !== 'member' ||
      literal === undefined ||
      typeof member === 'string' ||
      member.kind !== 'record'
    )
      return true;
    const field = member.fields.find((field) => field.name === target.property);
    if (!field || typeof field.type === 'string' || field.type.kind !== 'literal') return true;
    return (field.type.value === literal) === equality;
  });
  return [[reference.name, union(kept)]];
}

function ordinaryRefinement(
  condition: ExpressionIR,
  truth: boolean
): readonly [string, ValueType][] | undefined {
  let target = condition,
    equal = truth,
    constant: string | number | boolean | null | undefined,
    runtimeType: string | undefined;
  if (
    condition.kind === 'binary' &&
    (condition.operator === '===' || condition.operator === '!==')
  ) {
    const literal =
      condition.right.kind === 'literal'
        ? condition.right
        : condition.left.kind === 'literal'
          ? condition.left
          : undefined;
    if (!literal) return undefined;
    target = literal === condition.right ? condition.left : condition.right;
    constant = literal.value;
    equal = condition.operator === '===' ? truth : !truth;
    if (target.kind === 'intrinsic' && target.name === 'typeof' && typeof constant === 'string') {
      runtimeType = constant;
      target = target.arguments[0];
    }
  }
  const root = (value: ExpressionIR): Extract<ExpressionIR, { kind: 'reference' }> | undefined =>
    value.kind === 'reference'
      ? value
      : value.kind === 'lexical-read' && value.cell.kind === 'reference'
        ? value.cell
        : undefined;
  const owner = target.kind === 'member' ? target.object : target;
  const reference = root(owner);
  if (!reference) return undefined;
  // Opaque nullable/optional handles and event discriminants retain their nominal rules.
  if (
    typeof owner.type === 'string' &&
    (owner.type === 'event-or-control' ||
      owner.type.startsWith('state-event:') ||
      /^(nullable|optional):/.test(owner.type))
  )
    return undefined;
  const narrow = (type: ValueType): ValueType => {
    if (
      runtimeType &&
      valueAlternatives(type).some((member) => member === 'unknown' || member === 'exception') &&
      equal &&
      ['boolean', 'number', 'string', 'undefined'].includes(runtimeType)
    )
      return runtimeType === 'undefined' ? 'void' : (runtimeType as ValueType);
    return joinValueTypes(
      valueAlternatives(type).filter((member) => {
        let value: unknown,
          hasLiteral = false;
        if (member === 'null') {
          value = null;
          hasLiteral = true;
        }
        if (member === 'void') {
          value = undefined;
          hasLiteral = true;
        }
        if (typeof member !== 'string' && member.kind === 'literal') {
          value = member.value;
          hasLiteral = true;
        }
        if (runtimeType) {
          const kind = hasLiteral
            ? typeof value
            : typeof member === 'string' && ['boolean', 'number', 'string'].includes(member)
              ? member
              : typeof member !== 'string' && member.kind === 'callable'
                ? 'function'
                : member === 'unknown' || member === 'exception'
                  ? undefined
                  : 'object';
          return kind === undefined || (kind === runtimeType) === equal;
        }
        if (constant !== undefined) {
          if (hasLiteral) return (value === constant) === equal;
          const domain =
            typeof member === 'string' && ['boolean', 'number', 'string'].includes(member)
              ? member
              : member === 'unknown' || member === 'exception'
                ? undefined
                : 'object';
          return domain === undefined || domain === typeof constant || !equal;
        }
        return !hasLiteral || Boolean(value) === truth;
      })
    );
  };
  if (target.kind !== 'member') return [[reference.name, narrow(target.type)]];
  const values = valueAlternatives(owner.type).flatMap((member): ValueType[] => {
    if (member === 'null' || member === 'void') return truth ? [] : [member];
    const fields = objectFields(member),
      field = fields?.find((field) => field.name === target.property);
    if (!fields || !field) return [member];
    const original = field.optional ? joinValueTypes([field.type, 'void']) : field.type;
    const narrowed = narrow(original);
    if (
      typeof narrowed !== 'string' &&
      (narrowed.kind === 'union' || narrowed.kind === 'value-union') &&
      !narrowed.members.length
    )
      return [];
    const absent = valueAlternatives(narrowed).includes('void');
    const next = fields.map((entry) =>
      entry.name === field.name
        ? {
            ...entry,
            type: absent
              ? joinValueTypes(valueAlternatives(narrowed).filter((type) => type !== 'void'))
              : narrowed,
            optional: absent,
          }
        : entry
    );
    return [objectValueType(next)];
  });
  return [[reference.name, joinValueTypes(values)]];
}
