import type { Behavior, Binding, SourceSpan, Value, ValueType } from '../component-ir.ts';
import { reject, requireType } from './diagnostic.ts';
import type { References } from './graph.ts';
import { id, list, resolve, text, variant } from './structure.ts';

export interface ReadableField {
  readonly kind: 'prop' | 'state' | 'capture';
  readonly binding: Binding;
}

export interface Declarations {
  readonly values: ReadonlyMap<string, ReadableField>;
  readonly signals: ReadonlyMap<string, Binding>;
  readonly functions: ReadonlyMap<string, Behavior>;
}

export interface Uses {
  readonly reads: References;
  readonly calls: References;
}

const valueFields = {
  bool: ['kind', 'value'], number: ['kind', 'bits'], text: ['kind', 'value'],
  prop: ['kind', 'id'], state: ['kind', 'id'], capture: ['kind', 'id'], local: ['kind', 'id'],
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
    args: readonly Value[], formals: readonly Binding[], role: string, key: string, source: SourceSpan
  ): void {
    const use = `${role} ${JSON.stringify(key)}`;
    list(args, `${use} arguments`, source);
    if (args.length !== formals.length) {
      reject('wrong-arity', source,
        `${use} expects ${formals.length} arguments, received ${args.length}. Transfer one value per parameter.`, [owner, key]);
    }
    for (const [index, arg] of args.entries()) {
      const formal = formals[index]!;
      requireType(typeOf(arg, source), formal.type, `${use} argument ${index + 1}`, source, [owner, formal.id]);
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

  function valueType(value: Value, source: SourceSpan): ValueType {
    switch (value.kind) {
      case 'bool':
        if (typeof value.value !== 'boolean') reject('ir-shape', source, 'A bool literal requires true or false.', [owner]);
        return 'bool';
      case 'number':
        if (typeof value.bits !== 'string' || value.bits.length !== 16 || !/^[\da-f]{16}$/iu.test(value.bits)) {
          reject('ir-shape', source, 'A number literal requires exactly sixteen hexadecimal binary64 digits.', [owner]);
        }
        return 'number';
      case 'text':
        text(value.value, 'text literal', source, bindings);
        return 'text';
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

  return { typeOf, argumentsOf, callee };
}
