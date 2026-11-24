import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';
import { memberDataType, conditionRefinements } from './expression-types';
import { ecmaIntrinsicResult } from './ecmascript-values';
import {
  isDataValueType,
  isCapabilityAssignable,
  type ExpressionIR,
  type FunctionIR,
  type ParameterIR,
  type ValueType,
} from './ir';

export type CallableType = Extract<ValueType, { kind: 'callable' }> & { publicBoundary?: true };
export type ObjectValueType = Extract<ValueType, { kind: 'object' }>;
export type ArrayValueType = Extract<ValueType, { kind: 'array' | 'value-array' }>;
export function arrayElementType(type: ValueType): ValueType | undefined {
  if (type === 'array') return 'template';
  if (typeof type !== 'string' && (type.kind === 'union' || type.kind === 'value-union')) {
    const elements = type.members.map(arrayElementType);
    return elements.every((element) => element !== undefined)
      ? joinValueTypes(elements as ValueType[])
      : undefined;
  }
  if (typeof type !== 'string' && (type.kind === 'array' || type.kind === 'value-array'))
    return type.element;
  const lists: Readonly<Record<string, ValueType>> = {
    'anatomy-parts': 'anatomy-part',
    'a11y-ref-list': 'a11y-ref',
    'collection-snapshot-list': 'collection-snapshot',
    'table-row-list': 'table-row',
    'table-cell-list': 'table-cell',
    'table-diagnostic-list': 'table-diagnostic',
  };
  return typeof type === 'string' ? lists[type] : undefined;
}
export function iterableElementType(type: ValueType): ValueType | undefined {
  if (valueAssignable(type, 'string')) return 'string';
  return typeof type !== 'string' && type.kind === 'set' ? type.element : arrayElementType(type);
}

/** Own fields contributed by a finite object spread, including absent alternatives. */
export function spreadObjectFields(type: ValueType): ObjectValueType['fields'] | undefined {
  const variants = valueAlternatives(type).map((member) =>
    member === 'null' || member === 'void' ? [] : objectFields(member)
  );
  if (variants.some((fields) => !fields)) return undefined;
  const keys = new Set(variants.flatMap((fields) => fields!.map((field) => field.name)));
  return [...keys].map((name) => {
    const fields = variants.map((variant) => variant!.find((field) => field.name === name));
    return {
      name,
      type: joinValueTypes(fields.flatMap((field) => (field ? [field.type] : []))),
      ...(fields.some((field) => !field || field.optional) ? { optional: true } : {}),
    };
  });
}
export function mergeSpreadField(
  target: Map<string, ObjectValueType['fields'][number]>,
  field: ObjectValueType['fields'][number]
): void {
  const previous = target.get(field.name);
  target.set(
    field.name,
    field.optional && previous
      ? {
          name: field.name,
          type: joinValueTypes([previous.type, field.type]),
          ...(previous.optional ? { optional: true } : {}),
        }
      : field
  );
}
/** Context schemas validate finite JSON; their runtime T values keep ordinary mutability. */
export function contextRuntimeValueType(type: ValueType): ValueType {
  if (!isDataValueType(type) || typeof type === 'string' || type.kind === 'literal') return type;
  if (type.kind === 'array')
    return { kind: 'value-array', element: contextRuntimeValueType(type.element) };
  if (type.kind === 'union') return joinValueTypes(type.members.map(contextRuntimeValueType));
  return objectValueType(
    type.fields.map((field) => ({
      ...field,
      type: field.optional
        ? joinValueTypes([contextRuntimeValueType(field.type), 'void'])
        : contextRuntimeValueType(field.type),
    }))
  );
}

export function ordinaryArrayType(element: ValueType, readonly = false): ValueType {
  return readonly && isDataValueType(element)
    ? { kind: 'array', element }
    : { kind: 'value-array', element, ...(readonly ? { readonly: true } : {}) };
}

/** The shared child domain applies to operation arguments and ordinary formals. */
export function isTemplateChildType(type: ValueType): boolean {
  if (typeof type === 'string')
    return ['array', 'template', 'string', 'number', 'null'].includes(type);
  switch (type.kind) {
    case 'union':
    case 'value-union':
      return type.members.every(isTemplateChildType);
    case 'array':
    case 'value-array':
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
    parameters: fn.parameters.map(({ name, type, optional, rest, default: value }) => ({
      name,
      type,
      ...(optional || value ? { optional: true } : {}),
      ...(rest ? { rest: true } : {}),
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
    (last, parameter, index) =>
      parameter.optional || parameter.default || parameter.rest ? last : index + 1,
    0
  );
}

export function valueTypeEqual(a: ValueType, b: ValueType): boolean {
  if (a === b) return true;
  if (isDataValueType(a) && isDataValueType(b)) return dataTypeEqual(a, b);
  if (typeof a === 'string' || typeof b === 'string' || a.kind !== b.kind) return false;
  if (a.kind === 'capture' && b.kind === 'capture') return a.hookId === b.hookId;
  if (a.kind === 'cell' && b.kind === 'cell') return valueTypeEqual(a.value, b.value);
  if (a.kind === 'value-array' && b.kind === 'value-array')
    return (
      !!a.readonly === !!b.readonly &&
      (a.minimumLength ?? 0) === (b.minimumLength ?? 0) &&
      valueTypeEqual(a.element, b.element)
    );
  if (a.kind === 'set' && b.kind === 'set')
    return !!a.readonly === !!b.readonly && valueTypeEqual(a.element, b.element);
  if (a.kind === 'map' && b.kind === 'map')
    return (
      !!a.readonly === !!b.readonly &&
      valueTypeEqual(a.key, b.key) &&
      valueTypeEqual(a.value, b.value)
    );
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
            field.accessor === other.accessor &&
            valueTypeEqual(field.type, other.type)
        )
      )
    );
  if (a.kind === 'callable' && b.kind === 'callable')
    return (
      (a.lookup === undefined
        ? b.lookup === undefined
        : b.lookup !== undefined &&
          a.lookup.length === b.lookup.length &&
          a.lookup.every((entry) =>
            b.lookup!.some(
              (other) => entry.key === other.key && valueTypeEqual(entry.type, other.type)
            )
          )) &&
      a.parameters.length === b.parameters.length &&
      a.parameters.every(
        (parameter, index) =>
          !!parameter.optional === !!b.parameters[index].optional &&
          !!parameter.rest === !!b.parameters[index].rest &&
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
      type.fields.some((field) => !!field.accessor || containsRuntimeAuthority(field.type))
    );
  if (type.kind === 'value-union') return type.members.some(containsRuntimeAuthority);
  if (type.kind === 'value-array' || type.kind === 'set')
    return containsRuntimeAuthority(type.element);
  if (type.kind === 'map')
    return containsRuntimeAuthority(type.key) || containsRuntimeAuthority(type.value);
  return true;
}

/**
 * An outward data boundary reads a structural value; it does not grant the
 * receiver permission to mutate the source. Preserve readonly views in the
 * ordinary type system while proving their complete, finite JSON shape here.
 * Unknown/indexed fields and hidden callable or capability members fail closed.
 */
export function serializableDataType(type: ValueType): DataType | undefined {
  if (typeof type === 'string') return isDataValueType(type) ? type : undefined;
  if (type.kind === 'value-array') {
    const element = serializableDataType(type.element);
    return element === undefined || element === 'void' ? undefined : { kind: 'array', element };
  }
  if (type.kind === 'record' || (type.kind === 'object' && type.index === undefined)) {
    const fields: { name: string; type: DataType; optional?: boolean }[] = [];
    for (const field of type.fields) {
      // Optional source properties can explicitly contain undefined. At a
      // finite data/configuration boundary that is the same absent field;
      // required undefined fields remain an error.
      const source = field.optional
        ? joinValueTypes(valueAlternatives(field.type).filter((member) => member !== 'void'))
        : field.type;
      const value = serializableDataType(source);
      if (value === undefined || value === 'void') return undefined;
      fields.push({ name: field.name, type: value, ...(field.optional ? { optional: true } : {}) });
    }
    return { kind: 'record', fields };
  }
  if (type.kind === 'value-union' || type.kind === 'union') {
    const members = type.members.map(serializableDataType);
    if (members.some((member) => member === undefined)) return undefined;
    return parseDataType({ kind: 'union', members });
  }
  if (isDataValueType(type)) return type;
  return undefined;
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
      const destinationField = to.find((other) => other.name === field.name);
      // A scalar getter is still executable authority. A structural view must
      // retain that fact even when its return value is ordinary public data.
      if (field.accessor && field.accessor !== destinationField?.accessor) return true;
      const destination = destinationField?.type ?? index;
      return destination === undefined
        ? containsRuntimeAuthority(field.type)
        : erasesRuntimeAuthority(field.type, destination);
    });
  }
  if (arrayElementType(actual) !== undefined && arrayElementType(expected) !== undefined)
    return erasesRuntimeAuthority(arrayElementType(actual)!, arrayElementType(expected)!);
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
  if (typeof actual !== 'string' && typeof expected !== 'string') {
    if (
      (actual.kind === 'array' || actual.kind === 'value-array') &&
      (expected.kind === 'array' || expected.kind === 'value-array')
    ) {
      const writable =
        !(actual.kind === 'array' || actual.readonly) ||
        expected.kind === 'array' ||
        expected.readonly;
      const actualLength = actual.kind === 'value-array' ? (actual.minimumLength ?? 0) : 0;
      const expectedLength = expected.kind === 'value-array' ? (expected.minimumLength ?? 0) : 0;
      return (
        !!writable &&
        actualLength >= expectedLength &&
        valueAssignable(actual.element, expected.element)
      );
    }
    if (actual.kind === 'set' && expected.kind === 'set')
      return (
        (!actual.readonly || !!expected.readonly) &&
        valueTypeEqual(actual.element, expected.element)
      );
    if (actual.kind === 'map' && expected.kind === 'map')
      return (
        (!actual.readonly || !!expected.readonly) &&
        valueTypeEqual(actual.key, expected.key) &&
        valueTypeEqual(actual.value, expected.value)
      );
  }
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
    // A precise lookup result is authority supplied by the actual capture getter,
    // never by an arbitrary function with a superficially compatible signature.
    // The map is complete: checkedCall interprets an absent key as undefined.
    // Dropping entries would therefore erase real return values and capabilities.
    if (
      expected.lookup !== undefined &&
      (actual.lookup === undefined ||
        actual.lookup.length !== expected.lookup.length ||
        !expected.lookup.every((entry) =>
          actual.lookup!.some(
            (other) => entry.key === other.key && valueTypeEqual(entry.type, other.type)
          )
        ))
    )
      return false;
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
  return fields.every((field) => isDataValueType(field.type) && !field.readonly && !field.accessor)
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

/** Copy invokes source getters; an absent optional field does not replace an existing getter. */
export function spreadObjectField(
  previous: ObjectValueType['fields'][number] | undefined,
  incoming: ObjectValueType['fields'][number]
): ObjectValueType['fields'][number] {
  const { readonly: _readonly, accessor: _accessor, ...field } = incoming;
  if (incoming.optional && previous?.accessor)
    return {
      name: field.name,
      type: joinValueTypes([previous.type, field.type, 'void']),
      readonly: true,
      accessor: 'get',
    };
  return field;
}

/** Prove an outward JSON snapshot without erasing the expression's readonly view.
 * Capabilities, callbacks, open dictionaries and nested undefined are never data. */
export function dataBoundaryType(type: ValueType, top = true): DataType | undefined {
  if (typeof type === 'string')
    return ['boolean', 'number', 'string', 'null'].includes(type) || (top && type === 'void')
      ? (type as DataType)
      : undefined;
  if (type.kind === 'literal') return type;
  if (type.kind === 'array' || type.kind === 'value-array') {
    const element = dataBoundaryType(type.element, false);
    return element ? { kind: 'array', element } : undefined;
  }
  if (type.kind === 'union' || type.kind === 'value-union') {
    const members = type.members.map((member) => dataBoundaryType(member, top));
    return members.every((member): member is DataType => member !== undefined)
      ? { kind: 'union', members }
      : undefined;
  }
  if (
    (type.kind === 'record' || type.kind === 'object') &&
    !('index' in type && type.index !== undefined)
  ) {
    const fields: { name: string; type: DataType; optional?: boolean }[] = [];
    for (const field of type.fields) {
      if ('accessor' in field && field.accessor) return undefined;
      const value = dataBoundaryType(field.type, false);
      if (!value) return undefined;
      fields.push({ name: field.name, type: value, ...(field.optional ? { optional: true } : {}) });
    }
    return { kind: 'record', fields };
  }
  return undefined;
}

/** JSON publication copies data; readonly source fields do not carry authority. */
export function publishedDataType(type: ValueType): DataType | undefined {
  if (isDataValueType(type)) return type;
  if (typeof type === 'string') return undefined;
  if (type.kind === 'object' && type.index === undefined) {
    const fields: { name: string; type: DataType; optional?: boolean }[] = [];
    for (const field of type.fields) {
      // A readonly data field is copyable; a getter still carries executable authority.
      if (field.accessor) return undefined;
      const data = publishedDataType(field.type);
      if (!data) return undefined;
      fields.push({ name: field.name, type: data, ...(field.optional ? { optional: true } : {}) });
    }
    return { kind: 'record', fields };
  }
  return undefined;
}

export function memberValueType(owner: ValueType, key: string, optional = false): ValueType {
  const types = valueAlternatives(owner).map((type) => {
    if (type === 'null' || type === 'void') {
      if (optional) return 'void' as const;
      throw new TypeError(`Cannot read ${key} on a nullish value.`);
    }
    if (isDataValueType(type)) return memberDataType(type, key, { optional });
    if (typeof type !== 'string' && type.kind === 'value-array') {
      if (key === 'length') return 'number';
      if (/^(0|[1-9]\d*)$/.test(key))
        return Number(key) < (type.minimumLength ?? 0)
          ? type.element
          : joinValueTypes([type.element, 'void']);
    }
    if (typeof type !== 'string' && (type.kind === 'set' || type.kind === 'map') && key === 'size')
      return 'number';
    // Opaque snapshots expose keys without proving their presence or value shape.
    if (type === 'record') return 'unknown';
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

export function indexedValueType(owner: ValueType, index: ValueType, optional = false): ValueType {
  const members = valueAlternatives(index);
  const numeric = members.every(
    (type) =>
      type === 'number' ||
      (typeof type !== 'string' && type.kind === 'literal' && typeof type.value === 'number')
  );
  const element = arrayElementType(owner);
  if (element !== undefined && numeric) return joinValueTypes([element, 'void']);
  if (
    members.length &&
    members.every(
      (type) =>
        typeof type !== 'string' && type.kind === 'literal' && typeof type.value === 'string'
    )
  )
    return joinValueTypes(
      members.map((type) =>
        memberValueType(owner, String((type as { value: string }).value), optional)
      )
    );
  if (
    index === 'string' &&
    typeof owner !== 'string' &&
    owner.kind === 'object' &&
    owner.index !== undefined
  )
    return joinValueTypes([owner.index, 'void']);
  if (index === 'string' && objectFields(owner)) return 'unknown';
  throw new TypeError('Dynamic indexing requires a checked array or finite record key.');
}

export function callableValue(type: ValueType, optional = false): CallableType {
  const members = valueAlternatives(type).filter(
    (member) => !optional || (member !== 'null' && member !== 'void')
  );
  const first = members[0];
  // A reflected public method is callable only after a positive function guard.
  // It is a deliberate cross-owner boundary, never a proof for arbitrary unknown.
  if (first === 'public-method' && members.every((member) => member === first))
    return { kind: 'callable', parameters: [], returnType: 'public-expose', publicBoundary: true };
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
  optional = false,
  spread: readonly boolean[] = []
): ValueType {
  const fn = callableValue(type, optional);
  if (
    spread.length &&
    (spread.length !== args.length || spread.some((value) => typeof value !== 'boolean'))
  )
    throw new TypeError('Call spread flags must match the checked arguments.');
  const supplied = args.map((type, index) => {
    if (!spread[index]) return type;
    const element = iterableElementType(type);
    if (element === undefined) throw new TypeError('Call spread requires a checked iterable.');
    return element;
  });
  if (fn.publicBoundary) {
    if (!supplied.every(isPublicValueView))
      throw new TypeError('A public method cannot receive private runtime owner capabilities.');
    return optional &&
      valueAlternatives(type).some((member) => member === 'null' || member === 'void')
      ? joinValueTypes([fn.returnType, 'void'])
      : fn.returnType;
  }
  const required = minimumArgumentCount(fn.parameters);
  const firstSpread = spread.indexOf(true),
    rest = fn.parameters.findIndex((parameter) => parameter.rest);
  if (firstSpread >= 0 && (rest < 0 || firstSpread < rest))
    throw new TypeError(
      'Dynamic call spreads require a checked rest tail after all fixed parameters.'
    );
  if (args.length < required || (!fn.parameters.at(-1)?.rest && args.length > fn.parameters.length))
    throw new TypeError('Callable argument count mismatch.');
  supplied.forEach((argument, index) => {
    const parameter = fn.parameters[index] ?? fn.parameters.at(-1)!;
    const expected = parameter.rest
      ? arrayElementType(parameter.type)!
      : parameterArgumentType(parameter);
    if (expected === undefined)
      throw new TypeError('Rest parameters require an array element type.');
    if (erasesRuntimeAuthority(argument, expected))
      throw new TypeError(
        'A callable argument cannot hide runtime callable or capability fields behind a structural type view.'
      );
    if (!(argument === 'void' && parameter.optional) && !valueAssignable(argument, expected))
      throw new TypeError(`Callable argument ${index + 1} type mismatch.`);
  });
  const keys = args[0] === undefined ? [] : valueAlternatives(args[0]);
  const result =
    fn.lookup &&
    keys.length &&
    keys.every(
      (key) => typeof key !== 'string' && key.kind === 'literal' && typeof key.value === 'string'
    )
      ? joinValueTypes(
          keys.map(
            (key) =>
              fn.lookup!.find(
                (entry) => entry.key === (key as { kind: 'literal'; value: string }).value
              )?.type ?? 'void'
          )
        )
      : fn.returnType;
  return optional &&
    valueAlternatives(type).some((member) => member === 'null' || member === 'void')
    ? joinValueTypes([result, 'void'])
    : result;
}

/** Every supplies these three values even when the callback declares fewer formals. */
export function arrayEveryCallbackParameters(array: ValueType): CallableType['parameters'] {
  return [
    { name: 'value', type: arrayElementType(array)! },
    { name: 'index', type: 'number' },
    { name: 'array', type: array },
  ];
}

export function intrinsicResult(
  name: string,
  args: readonly ValueType[],
  expressions?: readonly ExpressionIR[],
  declared?: ValueType,
  optional = false
): ValueType {
  const ordinary = ecmaIntrinsicResult(name, args, optional);
  if (ordinary !== undefined) return ordinary;
  if (optional) {
    if (!/^(array\.(?!isArray)|set\.(?!create)|map\.(?!create))/.test(name) || !args.length)
      throw new TypeError('Only collection member calls admit a nullish receiver.');
    const receiver = joinValueTypes(
      valueAlternatives(args[0]).filter((type) => type !== 'null' && type !== 'void')
    );
    return joinValueTypes([
      intrinsicResult(name, [receiver, ...args.slice(1)], expressions, declared),
      'void',
    ]);
  }
  if (name === 'array.isArray' && args.length === 1) return 'boolean';
  if (name === 'array.from' && args.length === 1 && iterableElementType(args[0]) !== undefined)
    return ordinaryArrayType(iterableElementType(args[0])!);
  if (name === 'json.stringify' && args.length === 1 && serializableDataType(args[0]) !== undefined)
    return 'string';
  if (name === 'set.create' && args.length <= 1) {
    const element = args[0] === undefined ? undefined : iterableElementType(args[0]);
    const target =
      declared && typeof declared !== 'string' && declared.kind === 'set'
        ? declared.element
        : element;
    if (
      target === undefined ||
      (args.length && (element === undefined || !valueAssignable(element, target)))
    )
      throw new TypeError('Set construction requires a checked iterable element type.');
    return { kind: 'set', element: target };
  }
  if (
    name === 'map.create' &&
    args.length === 0 &&
    declared &&
    typeof declared !== 'string' &&
    declared.kind === 'map' &&
    serializableDataType(declared.key) !== undefined &&
    serializableDataType(declared.value) !== undefined
  )
    return { kind: 'map', key: declared.key, value: declared.value };
  if (name.startsWith('map.') && typeof args[0] !== 'string' && args[0]?.kind === 'map') {
    const receiver = args[0],
      method = name.slice(4);
    if (method === 'clear' && args.length === 1 && !receiver.readonly) return 'void';
    if (
      ['get', 'has', 'delete', 'set'].includes(method) &&
      valueAssignable(args[1] ?? 'void', receiver.key)
    ) {
      if (method === 'get' && args.length === 2) return joinValueTypes([receiver.value, 'void']);
      if ((method === 'has' || (method === 'delete' && !receiver.readonly)) && args.length === 2)
        return 'boolean';
      if (
        method === 'set' &&
        !receiver.readonly &&
        args.length === 3 &&
        valueAssignable(args[2], receiver.value)
      )
        return receiver;
    }
  }
  if (name.startsWith('set.') && typeof args[0] !== 'string' && args[0]?.kind === 'set') {
    const receiver = args[0],
      method = name.slice(4);
    if (method === 'clear' && args.length === 1 && !receiver.readonly) return 'void';
    if (
      ['add', 'has', 'delete'].includes(method) &&
      args.length === 2 &&
      valueAssignable(args[1], receiver.element)
    )
      if (method === 'has' || !receiver.readonly) return method === 'add' ? receiver : 'boolean';
  }
  const element = args[0] === undefined ? undefined : arrayElementType(args[0]);
  if (name.startsWith('array.') && element !== undefined) {
    const method = name.slice(6),
      receiver = args[0];
    if (method === 'includes' && args.length === 2) return 'boolean';
    if (method === 'at' && args.length === 2 && valueAssignable(args[1], 'number'))
      return joinValueTypes([element, 'void']);
    if (
      method === 'slice' &&
      args.length >= 1 &&
      args.length <= 3 &&
      args.slice(1).every((type) => valueAssignable(type, 'number'))
    )
      return ordinaryArrayType(element);
    if (
      method === 'join' &&
      args.length <= 2 &&
      (args.length === 1 || valueAssignable(args[1], 'string')) &&
      serializableDataType(element) !== undefined
    )
      return 'string';
    if (
      ['push', 'shift', 'pop'].includes(method) &&
      typeof receiver !== 'string' &&
      receiver.kind === 'value-array' &&
      !receiver.readonly
    ) {
      if (method === 'push' && args.slice(1).every((type) => valueAssignable(type, element)))
        return 'number';
      if ((method === 'shift' || method === 'pop') && args.length === 1)
        return joinValueTypes([element, 'void']);
    }
    if (method === 'reduce' && (args.length === 2 || args.length === 3)) {
      const accumulator = args[2] ?? element,
        fn = callableValue(args[1]);
      if (
        serializableDataType(accumulator) === undefined ||
        serializableDataType(element) === undefined
      )
        throw new TypeError(
          'Array reduce currently requires finite data elements and accumulator.'
        );
      checkedCall(
        fn,
        [accumulator, element, 'number' as const, receiver].slice(0, fn.parameters.length)
      );
      if (!valueAssignable(fn.returnType, accumulator))
        throw new TypeError('Array reduce callback must preserve its checked accumulator type.');
      return accumulator;
    }
    if (
      method === 'sort' &&
      args.length === 2 &&
      typeof receiver !== 'string' &&
      receiver.kind === 'value-array' &&
      !receiver.readonly
    ) {
      const fn = callableValue(args[1]);
      if (serializableDataType(element) === undefined)
        throw new TypeError('Array sort currently requires finite data elements.');
      checkedCall(fn, [element, element].slice(0, fn.parameters.length));
      if (!valueAssignable(fn.returnType, 'number'))
        throw new TypeError('Array sort requires a numeric comparator result.');
      return receiver;
    }
    if (
      ['every', 'some', 'filter', 'find', 'findIndex', 'map', 'flatMap', 'forEach'].includes(
        method
      ) &&
      args.length === 2
    ) {
      const fn = callableValue(args[1]);
      checkedCall(
        fn,
        arrayEveryCallbackParameters(receiver)
          .slice(0, fn.parameters.length)
          .map((parameter) => parameter.type)
      );
      if (method === 'every' || method === 'some') return 'boolean';
      if (method === 'findIndex') return 'number';
      if (method === 'forEach') return 'void';
      if (method === 'map') return ordinaryArrayType(fn.returnType);
      if (method === 'flatMap') {
        const result = arrayElementType(fn.returnType);
        if (result === undefined)
          throw new TypeError('flatMap callback must return a checked array.');
        return ordinaryArrayType(result);
      }
      let selected = element;
      let callback = expressions?.[1];
      while (callback?.kind === 'narrow') callback = callback.value;
      if (callback?.kind === 'function' && callback.function.parameters[0]) {
        const returns = callback.function.body.filter((statement) => statement.kind === 'return');
        if (returns.length === 1 && returns[0].kind === 'return' && returns[0].value) {
          const refined = conditionRefinements(returns[0].value, true).find(
            ([name]) => name === callback!.function.parameters[0].name
          )?.[1];
          if (refined !== undefined && valueAssignable(refined, element)) selected = refined;
        }
      }
      return method === 'find' ? joinValueTypes([selected, 'void']) : ordinaryArrayType(selected);
    }
  }
  if (name === 'object.assign') {
    if (!args.length || !expressions || expressions.length !== args.length)
      throw new TypeError('Object.assign requires a checked fresh target and own-data records.');
    const fields = new Map<string, ValueType>();
    const copyRecord = (value: ExpressionIR, type: ValueType, source = false): void => {
      if (
        value.kind !== 'record' ||
        typeof type === 'string' ||
        (type.kind !== 'record' && !(source && type.kind === 'object')) ||
        !objectFields(type)?.every((field) => isDataValueType(field.type)) ||
        value.entries.some(
          (entry) =>
            entry.key === '__proto__' ||
            (entry.accessor
              ? !source ||
                entry.value.kind !== 'function' ||
                !isDataValueType(entry.value.function.returnType)
              : !isDataValueType(entry.value.type))
        )
      )
        throw new TypeError(
          'Object.assign requires a fresh data target and direct finite record sources without __proto__; source getters must return data.'
        );
      for (const field of objectFields(type)!) fields.set(field.name, field.type);
    };
    const target = expressions[0];
    const error = target.kind === 'intrinsic' && target.name === 'error' && args[0] === 'exception';
    if (!error) copyRecord(target, args[0]);
    for (let index = 1; index < expressions.length; index++)
      copyRecord(expressions[index], args[index], true);
    return error
      ? 'exception'
      : objectValueType([...fields].map(([name, type]) => ({ name, type })));
  }
  if (
    name === 'array.includes' &&
    args.length === 2 &&
    typeof args[0] !== 'string' &&
    args[0].kind === 'array' &&
    valueAlternatives(args[0].element).length > 0 &&
    valueAlternatives(args[0].element).every(
      (type) =>
        typeof type !== 'string' && type.kind === 'literal' && typeof type.value === 'string'
    )
  )
    return 'boolean';
  if (name === 'typeof' && args.length === 1) return 'string';
  if (name === 'number') {
    if (
      args.length <= 1 &&
      args.every((type) =>
        valueAlternatives(type).every(
          (member) =>
            member === 'number' ||
            member === 'string' ||
            member === 'boolean' ||
            member === 'null' ||
            member === 'void' ||
            (typeof member !== 'string' && member.kind === 'literal')
        )
      )
    )
      return 'number';
    throw new TypeError('Number requires zero or one scalar data operand.');
  }
  if (name === 'string') {
    if (
      args.length <= 1 &&
      args.every((type) =>
        valueAlternatives(type).every(
          (member) =>
            member === 'unknown' ||
            isDataValueType(member) ||
            (typeof member !== 'string' &&
              member.kind === 'value-array' &&
              serializableDataType(member) !== undefined &&
              !containsRuntimeAuthority(member))
        )
      )
    )
      return 'string';
    throw new TypeError('String requires zero or one data or opaque unknown operand.');
  }
  if (name === 'error' && args.length <= 1 && (args.length === 0 || args[0] === 'string'))
    return 'exception';
  if (name === 'number.isFinite' && args.length === 1 && isDataValueType(args[0])) return 'boolean';
  if (
    (name === 'math.round' || name === 'math.floor') &&
    args.length === 1 &&
    valueAssignable(args[0], 'number')
  )
    return 'number';
  if (name === 'object.freeze' && args.length === 1) {
    const value = args[0];
    // Object.freeze keeps the same array and only freezes its outer slots.
    // Nested values retain their own permissions and object identities.
    if (typeof value !== 'string' && value.kind === 'value-array')
      return { ...value, readonly: true };
    if (typeof value !== 'string' && value.kind === 'array') return value;
    if (objectFields(value)) return value;
  }
  if (
    name === 'object.hasOwn' &&
    args.length === 2 &&
    (args[0] === 'unknown' ||
      isDataValueType(args[0]) ||
      objectFields(args[0]) ||
      arrayElementType(args[0]) !== undefined) &&
    valueAlternatives(args[1]).every(
      (type) => valueAssignable(type, 'string') || valueAssignable(type, 'number')
    )
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

/** Closed values with a guaranteed object representation for native `in`. */
export function canCheckPropertyPresence(type: ValueType): boolean {
  return valueAlternatives(type).every((member) =>
    typeof member === 'string'
      ? /^(state|borrowed|observed):(boolean|number|string)$/.test(member) ||
        member === 'regexp' ||
        member === 'intl-number-format'
      : ['object', 'record', 'array', 'value-array', 'set', 'map'].includes(member.kind)
  );
}

/** Erased assertions may remove alternatives, never invent an authority-bearing field. */
export function canNarrowValue(source: ValueType, target: ValueType): boolean {
  const opaqueRecordView = (from: ValueType, to: ValueType): boolean =>
    from === 'record' &&
    typeof to !== 'string' &&
    to.kind === 'object' &&
    to.index === 'unknown' &&
    to.fields.every((field) => field.type === 'unknown');
  if (opaqueRecordView(source, target)) return true;
  if (source === 'public-expose' && isPublicValueView(target)) return true;
  if (
    source === 'public-method' &&
    typeof target !== 'string' &&
    target.kind === 'callable' &&
    isPublicValueView(target)
  )
    return true;
  if (valueAssignable(source, target)) return true;
  if (isDataValueType(source) && isDataValueType(target)) return valueAssignable(target, source);
  const originals = valueAlternatives(source),
    targets = valueAlternatives(target);
  return targets.every((target) =>
    originals.some(
      (original) =>
        valueTypeEqual(original, target) ||
        opaqueRecordView(original, target) ||
        (typeof original === 'string' &&
          /^(nullable|optional):/.test(original) &&
          original.slice(original.indexOf(':') + 1) === target) ||
        (original === 'public-expose' && isPublicValueView(target)) ||
        (original === 'public-method' &&
          typeof target !== 'string' &&
          target.kind === 'callable' &&
          isPublicValueView(target)) ||
        (isDataValueType(original) && isDataValueType(target) && valueAssignable(target, original))
    )
  );
}

/** Public method/data views may describe public APIs, never private owner handles. */
export function isPublicValueView(type: ValueType): boolean {
  if (
    isDataValueType(type) ||
    type === 'unknown' ||
    type === 'public-expose' ||
    type === 'public-method'
  )
    return true;
  if (typeof type === 'string') return false;
  if (type.kind === 'callable')
    return (
      type.parameters.every((parameter) => isPublicValueView(parameter.type)) &&
      isPublicValueView(type.returnType)
    );
  if (type.kind === 'object')
    return (
      (type.index === undefined || isPublicValueView(type.index)) &&
      type.fields.every((field) => isPublicValueView(field.type))
    );
  if (type.kind === 'value-union') return type.members.every(isPublicValueView);
  if (type.kind === 'value-array') return isPublicValueView(type.element);
  return false;
}
