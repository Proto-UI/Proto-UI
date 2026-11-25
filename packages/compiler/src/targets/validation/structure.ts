import type { Binding, LiteralValue, SourceSpan, ValueType } from '../component-ir.ts';
import { reject } from './diagnostic.ts';

// In Unicode mode a paired surrogate is one astral scalar and cannot match this range.
const unpairedSurrogate = /[\uD800-\uDFFF]/u;

/** Read only an own data member, including when finding a position on a malformed node. */
export function member(record: unknown, key: string): unknown {
  if (record === null || typeof record !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

/** The GPUI generator receives these records through JSON. A serialization
 * hook could replace a checked record or array after admission. Inspect the
 * descriptor without reading a getter or running the hook. */
function checkTransport(
  value: object,
  label: string,
  source: SourceSpan | undefined,
  bindings?: readonly string[]
): void {
  if (!('toJSON' in value)) return;
  for (let current: object | null = value; current; current = Object.getPrototypeOf(current)) {
    const property = Object.getOwnPropertyDescriptor(current, 'toJSON');
    if (!property) continue;
    if (!Object.hasOwn(property, 'value') || typeof property.value === 'function') {
      reject(
        'ir-shape',
        source,
        `${label} must serialize its checked data directly. Remove the toJSON hook.`,
        bindings
      );
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
      reject(
        'ir-shape',
        source,
        `${label} has an undeclared member ${String(key)}. Use the fields of its IR variant.`,
        bindings
      );
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
    reject(
      'ir-shape',
      source,
      `${label} has an unknown or missing kind (${detail}). Supply a defined IR variant.`,
      bindings
    );
  }
  shape(value, `${label} (${kind})`, source, variants[kind]!, optional, bindings);
}

export function list(value: unknown, label: string, source: SourceSpan): void {
  if (!Array.isArray(value)) reject('ir-shape', source, `${label} must be an array.`);
  // Target walkers use native array iteration and map. A subclass can run a
  // custom iterator or species constructor instead of traversing these slots.
  // Array.prototype is itself an array, including in another JS realm.
  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== Array.prototype &&
    (!Array.isArray(prototype) ||
      !Object.hasOwn(prototype, Symbol.iterator) ||
      !Object.hasOwn(prototype, 'map'))
  ) {
    reject(
      'ir-shape',
      source,
      `${label} needs an ordinary data array with standard iteration and element order.`
    );
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

export function text(
  value: unknown,
  label: string,
  source: SourceSpan,
  bindings?: readonly string[]
): void {
  if (typeof value !== 'string') reject('ir-shape', source, `${label} must be a string.`, bindings);
  if (unpairedSurrogate.test(value)) {
    reject(
      'invalid-text',
      source,
      `${label} contains an unpaired surrogate. Supply well-formed Unicode text.`,
      bindings
    );
  }
}

export function name(
  value: unknown,
  label: string,
  source: SourceSpan,
  bindings?: readonly string[]
): void {
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
  table: ReadonlyMap<string, T>,
  key: string,
  label: string,
  source: SourceSpan,
  owner?: string
): T {
  id(key, label, source);
  const result = table.get(key);
  if (result === undefined) {
    const bindings = owner === undefined ? [key] : [owner, key];
    reject(
      'unknown-binding',
      source,
      `${label} ${JSON.stringify(key)} is not declared in this scope. Use a resolved ID.`,
      bindings
    );
  }
  return result;
}

export function location(record: unknown, label: string, parent?: SourceSpan): SourceSpan {
  const span = member(record, 'source');
  shape(span, `${label} source span`, parent, ['file', 'start', 'end']);
  const source = span as SourceSpan;
  const { file, start, end } = source;
  if (
    typeof file !== 'string' ||
    !file.length ||
    unpairedSurrogate.test(file) ||
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(end) ||
    end < start
  ) {
    reject(
      'ir-shape',
      parent,
      `${label} requires a source file and ordered nonnegative integer offsets.`
    );
  }
  return source;
}

export function checkBinding(binding: Binding, parent: SourceSpan, input = false): void {
  const source = location(binding, 'binding', parent);
  shape(binding, 'binding', source, ['id', 'name', 'type', 'source'], input ? ['default'] : []);
  id(binding.id, 'binding.id', source);
  name(binding.name, 'binding.name', source, [binding.id]);
  if (!['bool', 'number', 'text', 'unit', 'tokens'].includes(binding.type)) {
    reject('ir-shape', source, 'The binding needs a declared IR value type.', [binding.id]);
  }
}

export const literalFields = {
  bool: ['kind', 'value'],
  number: ['kind', 'bits'],
  text: ['kind', 'value'],
  tokens: ['kind', 'values'],
} satisfies Record<LiteralValue['kind'], readonly string[]>;

/** Both schema defaults and behavior literals cross the same transport. */
export function literalType(
  value: LiteralValue,
  source: SourceSpan,
  bindings: string[]
): ValueType {
  variant(value, 'literal', source, literalFields, bindings);
  switch (value.kind) {
    case 'bool':
      if (typeof value.value !== 'boolean')
        reject('ir-shape', source, 'A bool literal requires true or false.', bindings);
      break;
    case 'number':
      if (
        typeof value.bits !== 'string' ||
        value.bits.length !== 16 ||
        !/^[\da-f]{16}$/iu.test(value.bits)
      ) {
        reject(
          'ir-shape',
          source,
          'A number literal requires exactly sixteen hexadecimal binary64 digits.',
          bindings
        );
      }
      break;
    case 'text':
      text(value.value, 'text literal', source, bindings);
      break;
    case 'tokens':
      list(value.values, 'style token list', source);
      for (const token of value.values) {
        name(token, 'style token', source, bindings);
        if (/[\t\n\f\r ]/u.test(token))
          reject(
            'ir-shape',
            source,
            'A style token cannot contain ASCII whitespace. Supply each token separately.',
            bindings
          );
      }
      break;
  }
  return value.kind;
}

export function unique(seen: Set<string>, key: string, label: string, source: SourceSpan): void {
  if (seen.has(key)) {
    reject(
      'duplicate-binding',
      source,
      `${label} ${JSON.stringify(key)} is declared twice in the same scope. Give each declaration its own ID.`,
      [key]
    );
  }
  seen.add(key);
}

export function declarePublicName(
  names: Map<string, string>,
  spelling: string,
  binding: Binding,
  label: string
): void {
  const previous = names.get(spelling);
  if (previous !== undefined) {
    reject(
      'duplicate-name',
      binding.source,
      `${label} ${JSON.stringify(spelling)} is exposed twice. Give the declarations distinct public names.`,
      [previous, binding.id]
    );
  }
  names.set(spelling, binding.id);
}
