import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';
import { memberDataType } from './expression-types';
import {
  isDataValueType,
  isCapabilityAssignable,
  type FunctionIR,
  type ParameterIR,
  type ValueType,
} from './ir';

export type CallableType = Extract<ValueType, { kind: 'callable' }>;
export type ObjectValueType = Extract<ValueType, { kind: 'object' }>;

/** The shared child domain applies to operation arguments and ordinary formals. */
export function isTemplateChildType(type: ValueType): boolean {
  if (typeof type === 'string')
    return ['array', 'template', 'string', 'number', 'null'].includes(type);
  switch (type.kind) {
    case 'union':
    case 'value-union':
      return type.members.every(isTemplateChildType);
    case 'array':
      return isTemplateChildType(type.element);
    case 'literal':
      return (
        type.value === null || typeof type.value === 'string' || typeof type.value === 'number'
      );
    default:
      return false;
  }
}

export function functionValueType(fn: Pick<FunctionIR, 'parameters' | 'returnType'>): CallableType {
  return {
    kind: 'callable',
    parameters: fn.parameters.map(({ name, type, optional, default: value }) => ({
      name,
      type,
      ...(optional || value ? { optional: true } : {}),
    })),
    returnType: fn.returnType,
  };
}

/** A default accepts undefined at its input, even before a later required slot. */
export function parameterArgumentType(parameter: ParameterIR): ValueType {
  return parameter.optional || parameter.default
    ? joinValueTypes([parameter.type, 'void'])
    : parameter.type;
}

export function minimumArgumentCount(parameters: readonly ParameterIR[]): number {
  return parameters.reduce(
    (last, parameter, index) => (parameter.optional || parameter.default ? last : index + 1),
    0
  );
}

export function valueTypeEqual(a: ValueType, b: ValueType): boolean {
  if (a === b) return true;
  if (isDataValueType(a) && isDataValueType(b)) return dataTypeEqual(a, b);
  if (typeof a === 'string' || typeof b === 'string' || a.kind !== b.kind) return false;
  if (a.kind === 'capture' && b.kind === 'capture') return a.hookId === b.hookId;
  if (a.kind === 'cell' && b.kind === 'cell') return valueTypeEqual(a.value, b.value);
  if (a.kind === 'value-union' && b.kind === 'value-union')
    return (
      a.members.length === b.members.length &&
      a.members.every((member) => b.members.some((other) => valueTypeEqual(member, other)))
    );
  if (a.kind === 'object' && b.kind === 'object')
    return (
      (a.index === undefined
        ? b.index === undefined
        : b.index !== undefined && valueTypeEqual(a.index, b.index)) &&
      a.fields.length === b.fields.length &&
      a.fields.every((field) =>
        b.fields.some(
          (other) =>
            field.name === other.name &&
            !!field.optional === !!other.optional &&
            !!field.readonly === !!other.readonly &&
            valueTypeEqual(field.type, other.type)
        )
      )
    );
  if (a.kind === 'callable' && b.kind === 'callable')
    return (
      a.parameters.length === b.parameters.length &&
      a.parameters.every(
        (parameter, index) =>
          !!parameter.optional === !!b.parameters[index].optional &&
          valueTypeEqual(parameter.type, b.parameters[index].type)
      ) &&
      valueTypeEqual(a.returnType, b.returnType)
    );
  return false;
}

export function valueAlternatives(type: ValueType): ValueType[] {
  return typeof type !== 'string' && (type.kind === 'union' || type.kind === 'value-union')
    ? type.members.flatMap(valueAlternatives)
    : [type];
}

export function joinValueTypes(types: readonly ValueType[]): ValueType {
  const members: ValueType[] = [];
  for (const type of types.flatMap(valueAlternatives))
    if (!members.some((other) => valueTypeEqual(type, other))) members.push(type);
  if (members.length === 1) return members[0];
  if (members.every(isDataValueType)) return parseDataType({ kind: 'union', members });
  return { kind: 'value-union', members };
}

/** A structural type view never removes fields from the runtime object. */
export function containsRuntimeAuthority(type: ValueType): boolean {
  if (isDataValueType(type)) return false;
  if (typeof type === 'string') return true;
  if (type.kind === 'object')
    return (
      (type.index !== undefined && containsRuntimeAuthority(type.index)) ||
      type.fields.some((field) => containsRuntimeAuthority(field.type))
    );
  if (type.kind === 'value-union') return type.members.some(containsRuntimeAuthority);
  return true;
}

/** Data width subtyping is safe; dropping a hidden closure or owner capability is not. */
export function erasesRuntimeAuthority(actual: ValueType, expected: ValueType): boolean {
  if (expected === 'unknown' || valueTypeEqual(actual, expected)) return false;
  const originals = valueAlternatives(actual),
    targets = valueAlternatives(expected);
  if (originals.length > 1) return originals.some((type) => erasesRuntimeAuthority(type, expected));
  if (targets.length > 1) return targets.every((type) => erasesRuntimeAuthority(actual, type));
  const from = objectFields(actual),
    to = objectFields(expected);
  if (from && to) {
    const index =
      typeof expected !== 'string' && expected.kind === 'object' ? expected.index : undefined;
    if (
      typeof actual !== 'string' &&
      actual.kind === 'object' &&
      actual.index !== undefined &&
      index === undefined &&
      containsRuntimeAuthority(actual.index)
    )
      return true;
    return from.some((field) => {
      const destination = to.find((other) => other.name === field.name)?.type ?? index;
      return destination === undefined
        ? containsRuntimeAuthority(field.type)
        : erasesRuntimeAuthority(field.type, destination);
    });
  }
  if (
    typeof actual !== 'string' &&
    actual.kind === 'callable' &&
    typeof expected !== 'string' &&
    expected.kind === 'callable'
  )
    return (
      (expected.returnType === 'void'
        ? containsRuntimeAuthority(actual.returnType)
        : erasesRuntimeAuthority(actual.returnType, expected.returnType)) ||
      actual.parameters.some(
        (parameter, index) =>
          expected.parameters[index] !== undefined &&
          erasesRuntimeAuthority(expected.parameters[index].type, parameter.type)
      )
    );
  return containsRuntimeAuthority(actual) && isDataValueType(expected);
}

export function valueAssignable(actual: ValueType, expected: ValueType): boolean {
  // Unknown erases knowledge. Reading it still cannot grant a callable or capability type.
  if (expected === 'unknown') return true;
  if (valueTypeEqual(actual, expected) || isCapabilityAssignable(actual, expected)) return true;
  if (erasesRuntimeAuthority(actual, expected)) return false;
  if (expected === 'template' && isTemplateChildType(actual)) return true;
  if (typeof actual !== 'string' && (actual.kind === 'value-union' || actual.kind === 'union'))
    return actual.members.every((member) => valueAssignable(member, expected));
  if (
    typeof expected !== 'string' &&
    (expected.kind === 'value-union' || expected.kind === 'union')
  )
    return expected.members.some((member) => valueAssignable(actual, member));
  if (isDataValueType(actual) && isDataValueType(expected)) return isAssignable(actual, expected);
  const aFields = objectFields(actual),
    bFields = objectFields(expected);
  if (aFields && bFields) {
    const aIndex =
      typeof actual !== 'string' && actual.kind === 'object' ? actual.index : undefined;
    const bIndex =
      typeof expected !== 'string' && expected.kind === 'object' ? expected.index : undefined;
    if (
      bIndex !== undefined &&
      ((aIndex !== undefined && !valueAssignable(aIndex, bIndex)) ||
        aFields.some((field) => !valueAssignable(field.type, bIndex)))
    )
      return false;
    return bFields.every((field) => {
      const source = aFields.find((other) => other.name === field.name);
      return source
        ? (!source.optional || !!field.optional) &&
            (!source.readonly || !!field.readonly) &&
            valueAssignable(source.type, field.type)
        : !!field.optional;
    });
  }
  if (
    typeof actual !== 'string' &&
    actual.kind === 'callable' &&
    typeof expected !== 'string' &&
    expected.kind === 'callable'
  ) {
    if (minimumArgumentCount(actual.parameters) > minimumArgumentCount(expected.parameters))
      return false;
    return (
      actual.parameters.every(
        (parameter, index) =>
          !expected.parameters[index] ||
          valueAssignable(
            parameterArgumentType(expected.parameters[index]),
            parameterArgumentType(parameter)
          )
      ) &&
      (expected.returnType === 'void' || valueAssignable(actual.returnType, expected.returnType))
    );
  }
  return expected === 'function' && typeof actual !== 'string' && actual.kind === 'callable';
}

export function objectFields(
  type: ValueType
): readonly ObjectValueType['fields'][number][] | undefined {
  return typeof type !== 'string' && (type.kind === 'object' || type.kind === 'record')
    ? type.fields
    : undefined;
}

export function objectValueType(fields: ObjectValueType['fields']): ValueType {
  return fields.every((field) => isDataValueType(field.type) && !field.readonly)
    ? {
        kind: 'record',
        fields: fields.map(({ name, type, optional }) => ({
          name,
          type: type as DataType,
          ...(optional ? { optional: true } : {}),
        })),
      }
    : { kind: 'object', fields };
}

export function memberValueType(owner: ValueType, key: string, optional = false): ValueType {
  const types = valueAlternatives(owner).map((type) => {
    if (type === 'null' || type === 'void') {
      if (optional) return 'void' as const;
      throw new TypeError(`Cannot read ${key} on a nullish value.`);
    }
    if (isDataValueType(type)) return memberDataType(type, key, { optional });
    const field = objectFields(type)?.find((field) => field.name === key);
    if (!field) {
      if (typeof type !== 'string' && type.kind === 'object' && type.index !== undefined)
        return joinValueTypes([type.index, 'void']);
      throw new TypeError(`Undeclared object member ${key}.`);
    }
    return field.optional ? joinValueTypes([field.type, 'void']) : field.type;
  });
  return joinValueTypes(types);
}

export function callableValue(type: ValueType, optional = false): CallableType {
  const members = valueAlternatives(type).filter(
    (member) => !optional || (member !== 'null' && member !== 'void')
  );
  const first = members[0];
  if (
    !first ||
    typeof first === 'string' ||
    first.kind !== 'callable' ||
    !members.every((member) => valueTypeEqual(member, first))
  )
    throw new TypeError('Call requires a statically typed callable value.');
  return first;
}

export function checkedCall(
  type: ValueType,
  args: readonly ValueType[],
  optional = false
): ValueType {
  const fn = callableValue(type, optional);
  const required = minimumArgumentCount(fn.parameters);
  if (args.length < required || args.length > fn.parameters.length)
    throw new TypeError('Callable argument count mismatch.');
  args.forEach((argument, index) => {
    if (erasesRuntimeAuthority(argument, fn.parameters[index].type))
      throw new TypeError(
        'A callable argument cannot hide runtime callable or capability fields behind a structural type view.'
      );
    if (
      !(argument === 'void' && fn.parameters[index].optional) &&
      !valueAssignable(argument, fn.parameters[index].type)
    )
      throw new TypeError(`Callable argument ${index + 1} type mismatch.`);
  });
  return optional &&
    valueAlternatives(type).some((member) => member === 'null' || member === 'void')
    ? joinValueTypes([fn.returnType, 'void'])
    : fn.returnType;
}

/** Every supplies these three values even when the callback declares fewer formals. */
export function arrayEveryCallbackParameters(
  array: Extract<ValueType, { kind: 'array' }>
): CallableType['parameters'] {
  return [
    { name: 'value', type: array.element },
    { name: 'index', type: 'number' },
    { name: 'array', type: array },
  ];
}

export function intrinsicResult(name: string, args: readonly ValueType[]): ValueType {
  if (name === 'typeof' && args.length === 1) return 'string';
  if (name === 'error' && args.length <= 1 && (args.length === 0 || args[0] === 'string'))
    return 'exception';
  if (name === 'number.isFinite' && args.length === 1 && isDataValueType(args[0])) return 'boolean';
  if (name === 'object.freeze' && args.length === 1 && objectFields(args[0])) return args[0];
  if (
    name === 'object.hasOwn' &&
    args.length === 2 &&
    objectFields(args[0]) &&
    (args[1] === 'string' || args[1] === 'number')
  )
    return 'boolean';
  if (
    name === 'array.every' &&
    args.length === 2 &&
    typeof args[0] !== 'string' &&
    args[0].kind === 'array'
  ) {
    const fn = callableValue(args[1]);
    checkedCall(
      fn,
      arrayEveryCallbackParameters(args[0])
        .slice(0, fn.parameters.length)
        .map((parameter) => parameter.type)
    );
    return 'boolean';
  }
  throw new TypeError(`Invalid intrinsic ${name} arguments.`);
}

export function parameterValueType(parameter: ParameterIR): ValueType {
  return parameter.optional && !parameter.default
    ? joinValueTypes([parameter.type, 'void'])
    : parameter.type;
}

/** Erased assertions may remove alternatives, never invent an authority-bearing field. */
export function canNarrowValue(source: ValueType, target: ValueType): boolean {
  if (valueAssignable(source, target)) return true;
  if (isDataValueType(source) && isDataValueType(target)) return valueAssignable(target, source);
  const originals = valueAlternatives(source),
    targets = valueAlternatives(target);
  return targets.every((target) =>
    originals.some(
      (original) =>
        valueTypeEqual(original, target) ||
        (isDataValueType(original) && isDataValueType(target) && valueAssignable(target, original))
    )
  );
}
