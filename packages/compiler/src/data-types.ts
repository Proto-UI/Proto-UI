export type DataType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'null'
  | 'void'
  | { kind: 'record'; fields: readonly { name: string; type: DataType; optional?: boolean }[] }
  | { kind: 'array'; element: DataType }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'union'; members: readonly DataType[] };

const primitives: Record<string, true> = {
  boolean: true,
  number: true,
  string: true,
  null: true,
  void: true,
};

class InvalidDataError extends TypeError {}

function invalid(path: string, reason: string): never {
  throw new InvalidDataError(`Invalid data at ${path}: ${reason}`);
}

/** Inspect descriptors before reading values: validation must never invoke authored accessors. */
function recordKeys(value: object, path: string): string[] {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(path, 'only plain records are supported');
  }
  const keys = Reflect.ownKeys(value);
  const names: string[] = [];
  for (const key of keys) {
    if (typeof key !== 'string') invalid(path, 'symbol keys are not supported');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable) {
      invalid(`${path}.${key}`, 'properties must be enumerable data properties');
    }
    names.push(key);
  }
  return names;
}

function arrayLength(value: unknown[], path: string): number {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Array.prototype && prototype !== null) {
    invalid(path, 'array subclasses are not supported');
  }
  const length = value.length;
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
      invalid(path, 'arrays cannot have additional properties');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable) {
      invalid(`${path}[${key}]`, 'array entries must be enumerable data properties');
    }
  }
  for (let index = 0; index < length; index += 1) {
    if (!Object.hasOwn(value, index))
      invalid(`${path}[${index}]`, 'sparse arrays are not supported');
  }
  return length;
}

function enter(value: object, path: string, ancestors: Set<object>): void {
  if (ancestors.has(value)) invalid(path, 'cycles are not supported');
  ancestors.add(value);
}

function schemaRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, 'expected a type declaration record');
  }
  recordKeys(value, path);
  return value as Record<string, unknown>;
}

function shape(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string
): void {
  for (const key of Object.keys(record)) {
    if (!required.includes(key) && !optional.includes(key))
      invalid(path, `unexpected field ${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) invalid(path, `missing field ${key}`);
  }
}

/** Parse a closed schema without coercion, host-object conversion, or source evaluation.
 * An empty union is the bottom type (never), needed to represent empty JSON arrays.
 */
export function parseDataType(input: unknown): DataType {
  const ancestors = new Set<object>();
  const parse = (value: unknown, path: string): DataType => {
    if (typeof value === 'string' && Object.hasOwn(primitives, value)) return value as DataType;
    const declaration = schemaRecord(value, path);
    if (!Object.hasOwn(declaration, 'kind')) invalid(path, 'missing field kind');
    enter(declaration, path, ancestors);
    try {
      switch (declaration.kind) {
        case 'literal': {
          shape(declaration, ['kind', 'value'], [], path);
          const literal = declaration.value;
          if (
            literal !== null &&
            typeof literal !== 'string' &&
            typeof literal !== 'boolean' &&
            !(typeof literal === 'number' && Number.isFinite(literal))
          ) {
            invalid(path, 'literals must be finite JSON primitives');
          }
          return { kind: 'literal', value: literal as string | number | boolean | null };
        }
        case 'array':
          shape(declaration, ['kind', 'element'], [], path);
          return { kind: 'array', element: parse(declaration.element, `${path}.element`) };
        case 'record': {
          shape(declaration, ['kind', 'fields'], [], path);
          if (!Array.isArray(declaration.fields)) invalid(path, 'fields must be an array');
          const fields = declaration.fields;
          enter(fields, `${path}.fields`, ancestors);
          try {
            const length = arrayLength(fields, `${path}.fields`);
            const names = new Set<string>();
            const parsed: { name: string; type: DataType; optional?: boolean }[] = [];
            for (let index = 0; index < length; index += 1) {
              const fieldPath = `${path}.fields[${index}]`;
              const field = schemaRecord(fields[index], fieldPath);
              enter(field, fieldPath, ancestors);
              try {
                shape(field, ['name', 'type'], ['optional'], fieldPath);
                if (typeof field.name !== 'string')
                  invalid(fieldPath, 'field names must be strings');
                if (names.has(field.name)) invalid(fieldPath, `duplicate field ${field.name}`);
                names.add(field.name);
                if (Object.hasOwn(field, 'optional') && typeof field.optional !== 'boolean') {
                  invalid(fieldPath, 'optional must be a boolean');
                }
                const type = parse(field.type, `${fieldPath}.type`);
                parsed.push(
                  Object.hasOwn(field, 'optional') && field.optional === true
                    ? { name: field.name, type, optional: true }
                    : { name: field.name, type }
                );
              } finally {
                ancestors.delete(field);
              }
            }
            return { kind: 'record', fields: parsed };
          } finally {
            ancestors.delete(fields);
          }
        }
        case 'union': {
          shape(declaration, ['kind', 'members'], [], path);
          if (!Array.isArray(declaration.members)) invalid(path, 'members must be an array');
          const members = declaration.members;
          enter(members, `${path}.members`, ancestors);
          try {
            const length = arrayLength(members, `${path}.members`);
            const parsed: DataType[] = [];
            for (let index = 0; index < length; index += 1) {
              parsed.push(parse(members[index], `${path}.members[${index}]`));
            }
            return unionOf(parsed);
          } finally {
            ancestors.delete(members);
          }
        }
        default:
          return invalid(path, 'unknown type declaration');
      }
    } finally {
      ancestors.delete(declaration);
    }
  };
  return parse(input, '<type>');
}

function unionMembers(type: DataType): readonly DataType[] {
  if (typeof type !== 'string' && type.kind === 'union') {
    return type.members.flatMap((member) => unionMembers(member));
  }
  return [type];
}

function unionOf(types: readonly DataType[]): DataType {
  const members: DataType[] = [];
  for (const type of types) {
    if (typeof type !== 'string' && type.kind === 'union') {
      for (const member of unionMembers(type)) {
        if (!members.some((existing) => dataTypeEqual(existing, member))) members.push(member);
      }
    } else if (!members.some((existing) => dataTypeEqual(existing, type))) {
      members.push(type);
    }
  }
  return members.length === 1 ? members[0] : { kind: 'union', members };
}

/** Structural equality ignores record order, union order, and duplicate union members. */
export function dataTypeEqual(left: DataType, right: DataType): boolean {
  if (left === right) return true;
  if (
    (typeof left !== 'string' && left.kind === 'union') ||
    (typeof right !== 'string' && right.kind === 'union')
  ) {
    const a = unionMembers(left);
    const b = unionMembers(right);
    return (
      a.every((member) => b.some((other) => dataTypeEqual(member, other))) &&
      b.every((member) => a.some((other) => dataTypeEqual(member, other)))
    );
  }
  if (typeof left === 'string' || typeof right === 'string' || left.kind !== right.kind)
    return false;
  switch (left.kind) {
    case 'literal':
      return right.kind === 'literal' && left.value === right.value;
    case 'array':
      return right.kind === 'array' && dataTypeEqual(left.element, right.element);
    case 'record': {
      if (right.kind !== 'record' || left.fields.length !== right.fields.length) return false;
      const fields = new Map(right.fields.map((field) => [field.name, field]));
      return left.fields.every((field) => {
        const other = fields.get(field.name);
        return (
          other !== undefined &&
          (field.optional === true) === (other.optional === true) &&
          dataTypeEqual(field.type, other.type)
        );
      });
    }
  }
}

/** Width-subtyping for records; optional fields may be absent but never silently become null/void. */
export function isAssignable(actual: DataType, expected: DataType): boolean {
  if (actual === expected) return true;
  if (typeof actual !== 'string' && actual.kind === 'union') {
    return actual.members.every((member) => isAssignable(member, expected));
  }
  if (typeof expected !== 'string' && expected.kind === 'union') {
    if (actual === 'boolean') {
      return (
        isAssignable({ kind: 'literal', value: true }, expected) &&
        isAssignable({ kind: 'literal', value: false }, expected)
      );
    }
    return expected.members.some((member) => isAssignable(actual, member));
  }
  if (typeof actual !== 'string' && actual.kind === 'literal') {
    if (typeof expected !== 'string' && expected.kind === 'literal')
      return actual.value === expected.value;
    return expected === (actual.value === null ? 'null' : typeof actual.value);
  }
  if (actual === 'null' && typeof expected !== 'string' && expected.kind === 'literal') {
    return expected.value === null;
  }
  if (typeof actual === 'string' || typeof expected === 'string') return false;
  if (actual.kind === 'array' && expected.kind === 'array') {
    return isAssignable(actual.element, expected.element);
  }
  if (actual.kind === 'record' && expected.kind === 'record') {
    const fields = new Map(actual.fields.map((field) => [field.name, field]));
    return expected.fields.every((field) => {
      const source = fields.get(field.name);
      if (!source) return field.optional === true;
      return (
        (field.optional === true || source.optional !== true) &&
        isAssignable(source.type, field.type)
      );
    });
  }
  return false;
}

/** The same finite, dense, plain-record JSON boundary as the wire protocol, strengthened to
 * reject accessors and hidden/extra properties instead of invoking or silently dropping them.
 * Undefined is permitted only at the root, where it represents void rather than a JSON value.
 */
function visitValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
  infer: boolean,
  root: boolean
): DataType {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'string';
    case 'number':
      if (!Number.isFinite(value)) invalid(path, 'numbers must be finite');
      return 'number';
    case 'undefined':
      if (root) return 'void';
      return invalid(path, 'undefined is not a JSON value');
    case 'object':
      break;
    default:
      return invalid(path, 'expected a JSON value or root void');
  }
  const object = value as object;
  enter(object, path, ancestors);
  try {
    if (Array.isArray(value)) {
      const length = arrayLength(value, path);
      const elements: DataType[] | undefined = infer ? [] : undefined;
      for (let index = 0; index < length; index += 1) {
        const type = visitValue(value[index], `${path}[${index}]`, ancestors, infer, false);
        if (elements && !elements.some((element) => dataTypeEqual(element, type)))
          elements.push(type);
      }
      return elements ? { kind: 'array', element: unionOf(elements) } : 'void';
    }
    const keys = recordKeys(object, path);
    const fields: { name: string; type: DataType }[] | undefined = infer ? [] : undefined;
    for (const key of keys) {
      const type = visitValue(
        (object as Record<string, unknown>)[key],
        `${path}.${key}`,
        ancestors,
        infer,
        false
      );
      if (fields) fields.push({ name: key, type });
    }
    return fields ? { kind: 'record', fields } : 'void';
  } finally {
    ancestors.delete(object);
  }
}

/** Infers widened primitive types; use explicit literal schemas for literal constraints. */
export function inferDataType(value: unknown): DataType {
  return visitValue(value, '<value>', new Set(), true, true);
}

export function acceptsValue(type: DataType, value: unknown): boolean {
  try {
    visitValue(value, '<value>', new Set(), false, true);
  } catch (error) {
    if (error instanceof InvalidDataError) return false;
    throw error;
  }
  const matches = (expected: DataType, current: unknown): boolean => {
    if (typeof expected === 'string') {
      if (expected === 'null') return current === null;
      if (expected === 'void') return current === undefined;
      return typeof current === expected;
    }
    switch (expected.kind) {
      case 'literal':
        return current === expected.value;
      case 'union':
        return expected.members.some((member) => matches(member, current));
      case 'array':
        if (!Array.isArray(current)) return false;
        for (let index = 0; index < current.length; index += 1) {
          if (!matches(expected.element, current[index])) return false;
        }
        return true;
      case 'record':
        if (current === null || typeof current !== 'object' || Array.isArray(current)) return false;
        return expected.fields.every((field) =>
          Object.hasOwn(current, field.name)
            ? matches(field.type, (current as Record<string, unknown>)[field.name])
            : field.optional === true
        );
    }
  };
  return matches(type, value);
}

function quoted(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Deterministic declaration syntax with quoted property names and unambiguous array precedence. */
export function formatDataType(type: DataType): string {
  if (typeof type === 'string') return type;
  switch (type.kind) {
    case 'literal':
      return typeof type.value === 'string' ? quoted(type.value) : String(type.value);
    case 'array':
      return `Array<${formatDataType(type.element)}>`;
    case 'record': {
      const fields = [...type.fields].sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      );
      return fields.length === 0
        ? '{}'
        : `{ ${fields
            .map(
              (field) =>
                `${quoted(field.name)}${field.optional === true ? '?' : ''}: ${formatDataType(field.type)};`
            )
            .join(' ')} }`;
    }
    case 'union': {
      const members = [...new Set(unionMembers(type).map(formatDataType))].sort();
      return members.length === 0 ? 'never' : members.join(' | ');
    }
  }
}
