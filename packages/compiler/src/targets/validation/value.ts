import { lookupDataType, type Behavior, type Binding, type DataType, type ExternIR, type SourceSpan, type Value, type ValueType } from '../component-ir.ts';
import { reject, requireType } from './diagnostic.ts';
import type { References } from './graph.ts';
import { id, list, literalFields, literalType, resolve, shape, text, variant, type DataDeclarations } from './structure.ts';

export interface ReadableField {
  readonly kind: 'prop' | 'state' | 'capture' | 'context';
  readonly binding: Binding;
}

export interface Declarations extends DataDeclarations {
  readonly types: readonly DataType[];
  readonly externs: ReadonlyMap<string, ExternIR>;
  readonly tasks: ReadonlyMap<string, Behavior>;
  readonly values: ReadonlyMap<string, ReadableField>;
  readonly signals: ReadonlyMap<string, Binding>;
  readonly functions: ReadonlyMap<string, Behavior>;
}

export interface Uses {
  readonly reads: References;
  readonly calls: References;
  readonly starts: References;
  readonly awaits: References;
}

const valueFields = {
  ...literalFields,
  prop: ['kind', 'id'], state: ['kind', 'id'], capture: ['kind', 'id'], local: ['kind', 'id'],
  context: ['kind', 'id'],
  'literal-text': ['kind', 'type'], 'widen-text': ['kind', 'value'],
  tagged: ['kind', 'type', 'tag', 'payload'], tag: ['kind', 'value'],
  record: ['kind', 'type', 'fields'], member: ['kind', 'value', 'field'], 'has-value': ['kind', 'value'],
  not: ['kind', 'value'], binary: ['kind', 'op', 'left', 'right'], call: ['kind', 'fn', 'args'],
} satisfies Record<Value['kind'], readonly string[]>;

export function expressions(
  fn: Behavior,
  declarations: Declarations,
  params: ReadonlyMap<string, Binding>,
  locals: ReadonlyMap<string, Binding>,
  uses: Uses
) {
  const owner = fn.binding.id;
  const bindings = [owner];
  const active = new Set<Value>();

  function argumentsOf(
    args: readonly Value[], formals: readonly Binding[], role: string, key: string, source: SourceSpan, payload?: ValueType
  ): void {
    const use = `${role} ${JSON.stringify(key)}`;
    list(args, `${use} arguments`, source);
    const firstExplicit = payload === undefined ? 0 : 1;
    const supplied = args.length + firstExplicit;
    if (supplied !== formals.length) {
      const implicit = payload === undefined ? '' : ' including the implicit edge value';
      reject('wrong-arity', source,
        `${use} expects ${formals.length} arguments, received ${supplied}${implicit}. Transfer one value per parameter.`, [owner, key]);
    }
    if (payload !== undefined) {
      const first = formals[0]!;
      requireType(payload, first.type, `${use} implicit edge value`, source, [owner, first.id]);
    }
    for (const [index, arg] of args.entries()) {
      const formal = formals[firstExplicit + index]!;
      requireType(typeOf(arg, source), formal.type, `${use} argument ${firstExplicit + index + 1}`, source, [owner, formal.id]);
    }
  }

  function callee(key: string, source: SourceSpan): Behavior {
    const target = resolve(declarations.functions, key, 'Called behavior', source, owner);
    if (!uses.calls.has(key)) uses.calls.set(key, source);
    return target;
  }

  function typeOf(value: Value, source: SourceSpan): ValueType {
    variant(value, 'value', source, valueFields, bindings);
    if (active.has(value)) {
      reject('ir-shape', source, 'An expression contains itself. Represent calls and control flow with resolved IDs.', bindings);
    }
    active.add(value);
    const result = valueType(value, source);
    active.delete(value);
    return result;
  }

  function presencePayload(value: Value, source: SourceSpan): ValueType {
    const type = typeOf(value, source);
    const data = lookupDataType(declarations.types, type);
    if (data?.kind !== 'presence') {
      reject('type-mismatch', source, `A presence test requires a presence value, received ${type}.`, bindings);
    }
    return data.value;
  }

  function casesOf(type: ValueType, source: SourceSpan) {
    const data = lookupDataType(declarations.types, type);
    if (data?.kind !== 'tagged') reject('type-mismatch', source, 'This operation requires a declared tagged type.', bindings);
    return declarations.taggedCases.get(data)!;
  }

  function valueType(value: Value, source: SourceSpan): ValueType {
    switch (value.kind) {
      case 'bool':
      case 'number':
      case 'text':
      case 'tokens':
        return literalType(value, source, bindings);
      case 'literal-text':
        if (lookupDataType(declarations.types, value.type)?.kind !== 'text-literal') {
          reject('type-mismatch', source, 'A singleton text expression requires a declared text-literal type.', bindings);
        }
        return value.type;
      case 'widen-text': {
        const type = typeOf(value.value, source);
        if (lookupDataType(declarations.types, type)?.kind !== 'text-literal') {
          reject('type-mismatch', source, `Text widening requires a singleton text domain, received ${type}.`, bindings);
        }
        return 'text';
      }
      case 'tagged': {
        text(value.tag, 'constructed tag', source, bindings);
        const item = casesOf(value.type, source).get(value.tag);
        if (!item) reject('type-mismatch', source, `Tagged type ${value.type} has no tag ${JSON.stringify(value.tag)}.`, bindings);
        requireType(typeOf(value.payload, source), item.payload, `Payload of tag ${JSON.stringify(value.tag)}`, source, bindings);
        return value.type;
      }
      case 'tag':
        casesOf(typeOf(value.value, source), source);
        return 'text';
      case 'record': {
        const data = lookupDataType(declarations.types, value.type);
        if (!data) reject('ir-shape', source, 'A record constructor needs a canonical index of a declared record type.', bindings);
        if (data.kind !== 'record') reject('type-mismatch', source, `Record construction requires a record type, received ${value.type} (${data.kind}).`, bindings);
        list(value.fields, 'record value fields', source);
        if (value.fields.length !== data.fields.length) {
          reject('ir-shape', source, `Record ${value.type} declares ${data.fields.length} fields, received ${value.fields.length}. Supply each declared field once.`, bindings);
        }
        const declared = declarations.recordFields.get(data)!;
        const seen = new Set<string>();
        for (const field of value.fields) {
          shape(field, 'record value field', source, ['name', 'value'], [], bindings);
          text(field.name, 'record value field name', source, bindings);
          const expected = declared.get(field.name);
          if (!expected) reject('ir-shape', source, `Record ${value.type} has no field ${JSON.stringify(field.name)}.`, bindings);
          if (seen.has(field.name)) reject('duplicate-name', source, `Record construction supplies ${JSON.stringify(field.name)} twice.`, bindings);
          seen.add(field.name);
          requireType(typeOf(field.value, source), expected.type, `Record field ${JSON.stringify(field.name)}`, source, bindings);
        }
        return value.type;
      }
      case 'member': {
        text(value.field, 'record member name', source, bindings);
        const type = typeOf(value.value, source);
        const data = lookupDataType(declarations.types, type);
        if (data?.kind !== 'record') reject('type-mismatch', source, `Member access requires a record value, received ${type}.`, bindings);
        const field = declarations.recordFields.get(data)!.get(value.field);
        if (!field) reject('type-mismatch', source, `Record ${type} has no field ${JSON.stringify(value.field)}.`, bindings);
        return field.type;
      }
      case 'has-value':
        presencePayload(value.value, source);
        return 'bool';
      case 'local': {
        id(value.id, 'local reference', source);
        const binding = locals.get(value.id) ?? params.get(value.id);
        if (!binding) {
          reject('unknown-binding', source,
            `Local ${JSON.stringify(value.id)} is unavailable here. Declare it before use in this block or transfer it through a block parameter.`,
            [owner, value.id]);
        }
        return binding.type;
      }
      case 'prop':
      case 'state':
      case 'context':
      case 'capture': {
        const slot = resolve(declarations.values, value.id, `${value.kind} reference`, source, owner);
        if (slot.kind !== value.kind) {
          reject('unknown-binding', source, `${JSON.stringify(value.id)} is a ${slot.kind}. Use its declared reference kind.`, [owner, value.id]);
        }
        if (!uses.reads.has(value.id)) uses.reads.set(value.id, source);
        return slot.binding.type;
      }
      case 'not':
        requireType(typeOf(value.value, source), 'bool', 'Logical negation', source, [owner]);
        return 'bool';
      case 'binary': {
        const left = typeOf(value.left, source);
        const right = typeOf(value.right, source);
        switch (value.op) {
          case 'equal':
            requireType(right, left, 'Equality', source, [owner]);
            return 'bool';
          case 'add':
          case 'multiply':
            requireType(left, 'number', `${value.op} left operand`, source, [owner]);
            requireType(right, 'number', `${value.op} right operand`, source, [owner]);
            return 'number';
          case 'concat':
            requireType(left, 'text', 'Concatenation left operand', source, [owner]);
            requireType(right, 'text', 'Concatenation right operand', source, [owner]);
            return 'text';
          default:
            return reject('ir-shape', source, 'Unknown binary operator. Use add, multiply, equal or concat.', [owner]);
        }
      }
      case 'call': {
        const target = callee(value.fn, source);
        argumentsOf(value.args, target.params, 'Call to', value.fn, source);
        if (target.phase === 'task') {
          reject('invalid-phase', source, 'A task cannot be called as a synchronous value. Start its owned invocation with a start instruction.', [owner, value.fn]);
        }
        if (target.phase === 'action') {
          if (fn.phase !== 'action') {
            reject('illegal-effect', source,
              `${fn.phase} behavior ${JSON.stringify(owner)} cannot call action ${JSON.stringify(value.fn)}. Move the effect to an action segment.`,
              [owner, value.fn]);
          }
          reject('invalid-phase', source, 'An action call cannot be a value expression. Use an ordered invoke instruction.', [owner, value.fn]);
        }
        if (target.phase === 'init' && fn.phase !== 'init') {
          reject('invalid-phase', source,
            `Initializer ${JSON.stringify(value.fn)} can only run during instance initialization. Use a pure helper for a repeatable computation.`,
            [owner, value.fn]);
        }
        return target.binding.type;
      }
    }
  }

  return { typeOf, argumentsOf, callee, presencePayload, casesOf };
}
