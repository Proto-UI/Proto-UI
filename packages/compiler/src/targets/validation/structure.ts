import { lookupDataType, type Binding, type DataField, type DataType, type LiteralValue, type ScalarType, type SourceSpan, type ValueType } from '../component-ir.ts';
import { reject } from './diagnostic.ts';

// In Unicode mode a paired surrogate is one astral scalar and cannot match this range.
const unpairedSurrogate = /[\uD800-\uDFFF]/u;

/** Read only an own data member, including when finding a position on a malformed node. */
export function member(record: unknown, key: string): unknown {
  if (record === null || typeof record !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

/** Recognize the intrinsic prototype in another realm without calling its constructor or a getter. */
function intrinsicPrototype(prototype: object | null, intrinsic: typeof Object | typeof Array): boolean {
  if (prototype === intrinsic.prototype) return true;
  const constructor = member(prototype, 'constructor');
  return typeof constructor === 'function' &&
    Object.getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype &&
    Function.prototype.toString.call(constructor) === Function.prototype.toString.call(intrinsic);
}

/** The GPUI generator receives these records through JSON. A serialization
 * hook could replace a checked record or array after admission. Inspect the
 * descriptor without reading a getter or running the hook. */
function checkTransport(value: object, label: string, source: SourceSpan | undefined, bindings?: readonly string[]): void {
  if (!('toJSON' in value)) return;
  for (let current: object | null = value; current; current = Object.getPrototypeOf(current)) {
    const property = Object.getOwnPropertyDescriptor(current, 'toJSON');
    if (!property) continue;
    if (!Object.hasOwn(property, 'value') || typeof property.value === 'function') {
      reject('ir-shape', source, `${label} must serialize its checked data directly. Remove the toJSON hook.`, bindings);
    }
    return;
  }
}

export function shape(
  value: unknown,
  label: string,
  source: SourceSpan | undefined,
  required: readonly string[],
  optional: readonly string[] = [],
  bindings?: readonly string[]
): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    reject('ir-shape', source, `${label} must be an IR record.`, bindings);
  }
  checkTransport(value, label, source, bindings);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (!required.includes(key) && !optional.includes(key))) {
      reject('ir-shape', source, `${label} has an undeclared member ${String(key)}. Use the fields of its IR variant.`, bindings);
    }
    const property = Object.getOwnPropertyDescriptor(value, key)!;
    if (!property.enumerable || !Object.hasOwn(property, 'value')) {
      reject('ir-shape', source, `${label}.${key} must be a serializable data member.`, bindings);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      reject('ir-shape', source, `${label} is missing its required ${key} member.`, bindings);
    }
  }
  for (const key of optional) {
    if (key in value && !Object.hasOwn(value, key)) {
      reject('ir-shape', source, `${label}.${key} must be an own data member.`, bindings);
    }
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && !intrinsicPrototype(prototype, Object)) {
    reject('ir-shape', source, `${label} must be a plain data record.`, bindings);
  }
}

export function variant(
  value: unknown,
  label: string,
  source: SourceSpan,
  variants: Readonly<Record<string, readonly string[]>>,
  bindings: readonly string[],
  optional: readonly string[] = []
): void {
  const kind = member(value, 'kind');
  if (typeof kind !== 'string' || !Object.hasOwn(variants, kind)) {
    const detail = typeof kind === 'string' ? JSON.stringify(kind) : typeof kind;
    reject('ir-shape', source, `${label} has an unknown or missing kind (${detail}). Supply a defined IR variant.`, bindings);
  }
  shape(value, `${label} (${kind})`, source, variants[kind]!, optional, bindings);
}

export function list(value: unknown, label: string, source: SourceSpan): void {
  if (!Array.isArray(value)) reject('ir-shape', source, `${label} must be an array.`);
  // Target walkers rely on standard iteration, map and element order.
  if (!intrinsicPrototype(Object.getPrototypeOf(value), Array)) {
    reject('ir-shape', source, `${label} needs an ordinary data array with standard iteration and element order.`);
  }
  checkTransport(value, label, source);
  if (Reflect.ownKeys(value).length !== value.length + 1) {
    reject('ir-shape', source, `${label} must be a dense IR array containing only its elements.`);
  }
  for (let i = 0; i < value.length; i++) {
    const property = Object.getOwnPropertyDescriptor(value, i);
    if (!property || !Object.hasOwn(property, 'value')) {
      reject('ir-shape', source, `${label}[${i}] must contain a data value.`);
    }
  }
}

export function text(value: unknown, label: string, source: SourceSpan, bindings?: readonly string[]): void {
  if (typeof value !== 'string') reject('ir-shape', source, `${label} must be a string.`, bindings);
  if (unpairedSurrogate.test(value)) {
    reject('invalid-text', source, `${label} contains an unpaired surrogate. Supply well-formed Unicode text.`, bindings);
  }
}

export function name(value: unknown, label: string, source: SourceSpan, bindings?: readonly string[]): void {
  text(value, label, source, bindings);
  if (value === '') reject('ir-shape', source, `${label} must have a nonempty name.`, bindings);
}

/** IDs are opaque. Neither their punctuation nor their spelling is target syntax. */
export function id(value: unknown, label: string, source: SourceSpan): void {
  if (typeof value !== 'string' || !value.length || unpairedSurrogate.test(value)) {
    reject('ir-shape', source, `${label} must be a nonempty, well-formed binding ID.`);
  }
}

export function resolve<T>(
  table: ReadonlyMap<string, T>, key: string, label: string, source: SourceSpan, owner?: string
): T {
  id(key, label, source);
  const result = table.get(key);
  if (result === undefined) {
    const bindings = owner === undefined ? [key] : [owner, key];
    reject('unknown-binding', source, `${label} ${JSON.stringify(key)} is not declared in this scope. Use a resolved ID.`, bindings);
  }
  return result;
}

export function location(record: unknown, label: string, parent?: SourceSpan): SourceSpan {
  const span = member(record, 'source');
  shape(span, `${label} source span`, parent, ['file', 'start', 'end']);
  const source = span as SourceSpan;
  const { file, start, end } = source;
  if (
    typeof file !== 'string' || !file.length || unpairedSurrogate.test(file) ||
    !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(end) || end < start
  ) {
    reject('ir-shape', parent, `${label} requires a source file and ordered nonnegative integer offsets.`);
  }
  return source;
}

const scalars = { bool: true, number: true, text: true, unit: true, tokens: true } satisfies Record<ScalarType, true>;

function checkValueType(
  type: ValueType, types: readonly DataType[], label: string, source: SourceSpan,
  bindings?: readonly string[], before = types.length
): void {
  if (typeof type !== 'string' || (!Object.hasOwn(scalars, type) && !lookupDataType(types, type, before))) {
    reject('ir-shape', source, `${label} needs a scalar type or a canonical data index referring to an available declaration.`, bindings);
  }
}

const dataFields = {
  presence: ['kind', 'value', 'source'], record: ['kind', 'fields', 'source'],
} satisfies Record<DataType['kind'], readonly string[]>;

export type RecordFields = ReadonlyMap<DataType, ReadonlyMap<string, DataField>>;

export function checkDataTypes(types: readonly DataType[], parent: SourceSpan): RecordFields {
  list(types, 'component types', parent);
  const records = new Map<DataType, ReadonlyMap<string, DataField>>();
  for (const [index, data] of types.entries()) {
    const label = `Type data:${index}`;
    const source = location(data, label, parent);
    variant(data, label, source, dataFields, []);
    if (data.kind === 'presence') {
      checkValueType(data.value, types, `${label} payload`, source, undefined, index);
      continue;
    }
    list(data.fields, `${label} fields`, source);
    const fields = new Map<string, DataField>();
    for (const field of data.fields) {
      const at = location(field, 'record field', source);
      shape(field, 'record field', at, ['name', 'type', 'source']);
      text(field.name, 'record field name', at);
      const fieldLabel = `${label} field ${JSON.stringify(field.name)}`;
      if (fields.has(field.name)) reject('duplicate-name', at, `${fieldLabel} is declared twice.`);
      checkValueType(field.type, types, fieldLabel, at, undefined, index);
      fields.set(field.name, field);
    }
    records.set(data, fields);
  }
  return records;
}

export function checkBinding(binding: Binding, parent: SourceSpan, types: readonly DataType[], input = false): void {
  const source = location(binding, 'binding', parent);
  shape(binding, 'binding', source, ['id', 'name', 'type', 'source'], input ? ['default', 'controlMode'] : []);
  id(binding.id, 'binding.id', source);
  name(binding.name, 'binding.name', source, [binding.id]);
  checkValueType(binding.type, types, 'The binding', source, [binding.id]);
}

export const literalFields = {
  bool: ['kind', 'value'], number: ['kind', 'bits'], text: ['kind', 'value'], tokens: ['kind', 'values'],
} satisfies Record<LiteralValue['kind'], readonly string[]>;

/** Both schema defaults and behavior literals cross the same transport. */
export function literalType(value: LiteralValue, source: SourceSpan, bindings: string[]): ValueType {
  variant(value, 'literal', source, literalFields, bindings);
  switch (value.kind) {
    case 'bool':
      if (typeof value.value !== 'boolean') reject('ir-shape', source, 'A bool literal requires true or false.', bindings);
      break;
    case 'number':
      if (typeof value.bits !== 'string' || value.bits.length !== 16 || !/^[\da-f]{16}$/iu.test(value.bits)) {
        reject('ir-shape', source, 'A number literal requires exactly sixteen hexadecimal binary64 digits.', bindings);
      }
      break;
    case 'text':
      text(value.value, 'text literal', source, bindings);
      break;
    case 'tokens':
      list(value.values, 'style token list', source);
      for (const token of value.values) {
        name(token, 'style token', source, bindings);
        if (/[\t\n\f\r ]/u.test(token)) reject('ir-shape', source, 'A style token cannot contain ASCII whitespace. Supply each token separately.', bindings);
      }
      break;
  }
  return value.kind;
}

export function unique(seen: Set<string>, key: string, label: string, source: SourceSpan): void {
  if (seen.has(key)) {
    reject('duplicate-binding', source,
      `${label} ${JSON.stringify(key)} is declared twice in the same scope. Give each declaration its own ID.`, [key]);
  }
  seen.add(key);
}

export function declarePublicName<T extends Pick<Binding, 'id' | 'source'>>(
  names: Map<string, T>,
  spelling: string,
  binding: T,
  label: string
): void {
  const previous = names.get(spelling);
  if (previous !== undefined) {
    reject('duplicate-name', binding.source,
      `${label} ${JSON.stringify(spelling)} is exposed twice. Give the declarations distinct public names.`,
      [previous.id, binding.id]);
  }
  names.set(spelling, binding);
}
