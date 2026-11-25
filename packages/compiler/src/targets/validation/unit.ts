import {
  lookupDataType, type Behavior, type Binding, type ComponentBody, type ComponentIR,
  type ContextKeyIR, type DataType, type InputBinding, type SourceSpan,
} from '../component-ir.ts';
import { checkSignature } from './behavior.ts';
import { reject, requireType } from './diagnostic.ts';
import {
  checkBinding, checkDataTypes, declarePublicName, id, list, literalType, location, member, name,
  resolve, shape, text, unique, type RecordFields,
} from './structure.ts';
import type { Declarations, ReadableField } from './value.ts';

export interface BodyDeclarations extends Declarations {
  readonly body: ComponentBody;
  readonly props: ReadonlyMap<string, InputBinding>;
}

export interface UnitDeclarations {
  readonly keys: ReadonlyMap<string, ContextKeyIR>;
  readonly bodies: ReadonlyMap<string, BodyDeclarations>;
}

const bodyLists = ['props', 'consumes', 'provides', 'fields', 'signals', 'behaviors', 'projections', 'actions'] as const;
const bodyMembers = ['id', 'name', 'source', 'view', ...bodyLists];
const unitMembers = ['version', 'types', 'keys', 'components', ...bodyMembers];

function checkBodyShape(body: ComponentBody, root: boolean, parent?: SourceSpan): void {
  const source = location(body, 'component', parent);
  shape(body, root ? 'compilation unit' : 'linked component', source, root ? unitMembers : bodyMembers, ['prototypeName']);
  id(body.id, 'component ID', source);
  name(body.name, 'component name', source, [body.id]);
  if (Object.hasOwn(body, 'prototypeName')) name(body.prototypeName, 'prototype metadata name', source, [body.id]);
  for (const key of bodyLists) list(body[key], key, source);
}

function indexBody(
  body: ComponentBody, types: readonly DataType[], recordFields: RecordFields, keys: ReadonlyMap<string, ContextKeyIR>
): BodyDeclarations {
  const { source } = body;
  const ids = new Set<string>();
  const props = new Map<string, InputBinding>();
  const signalNames = new Map<string, Binding>();
  const values = new Map<string, ReadableField>();
  const signals = new Map<string, Binding>();
  const functions = new Map<string, Behavior>();
  function declare(binding: Binding): void {
    unique(ids, binding.id, 'Component binding', binding.source);
  }
  for (const prop of body.props) {
    checkBinding(prop, source, types, true);
    const optional = lookupDataType(types, prop.type)?.kind === 'presence';
    if (Object.hasOwn(prop, 'controlMode') && (prop.controlMode !== 'fixed-instance' || !optional)) {
      reject('ir-shape', prop.source, 'Only an optional presence input can declare the fixed-instance control mode.', [prop.id]);
    }
    if (Object.hasOwn(prop, 'default')) {
      if (optional) reject('ir-shape', prop.source, 'An optional presence input cannot declare a schema default.', [prop.id]);
      requireType(literalType(prop.default!, prop.source, [prop.id]), prop.type, 'Prop default', prop.source, [prop.id]);
    }
    declare(prop);
    declarePublicName(props, prop.name, prop, 'Public prop');
    values.set(prop.id, { kind: 'prop', binding: prop });
  }
  for (const read of body.consumes) {
    const binding = member(read, 'binding') as Binding;
    checkBinding(binding, source, types);
    shape(read, 'consumed Context', binding.source, ['key', 'binding']);
    const key = resolve(keys, read.key, 'Consumed Context key', binding.source, body.id);
    requireType(binding.type, key.binding.type, 'Consumed Context binding', binding.source, [binding.id, read.key]);
    declare(binding);
    values.set(binding.id, { kind: 'context', binding });
  }
  for (const field of body.fields) {
    const binding = member(field, 'binding') as Binding;
    checkBinding(binding, source, types);
    shape(field, 'instance field', binding.source, ['kind', 'binding', 'init']);
    if (field.kind !== 'state' && field.kind !== 'capture') {
      reject('ir-shape', binding.source, 'An instance field must declare state or capture storage.', [binding.id]);
    }
    declare(binding);
    id(field.init, 'field initializer', binding.source);
    values.set(binding.id, { kind: field.kind, binding });
  }
  for (const signal of body.signals) {
    checkBinding(signal, source, types);
    declare(signal);
    declarePublicName(signalNames, signal.name, signal, 'Public signal');
    signals.set(signal.id, signal);
  }
  for (const fn of body.behaviors) {
    checkSignature(fn, source, types);
    declare(fn.binding);
    functions.set(fn.binding.id, fn);
  }
  return { body, types, recordFields, props, values, signals, functions };
}

/** Index all schemas before inspecting any child invocation, irrespective of declaration order. */
export function indexUnit(ir: ComponentIR): UnitDeclarations {
  checkBodyShape(ir, true);
  const { source, types } = ir;
  if (ir.version !== 4) reject('ir-shape', source, 'This component IR receiver requires version 4.');
  const recordFields = checkDataTypes(types, source);
  list(ir.keys, 'Context keys', source);
  list(ir.components, 'linked components', source);
  const keys = new Map<string, ContextKeyIR>();
  const exports = new Map<string, Pick<Binding, 'id' | 'source'>>();
  for (const key of ir.keys) {
    const binding = member(key, 'binding') as Binding;
    checkBinding(binding, source, types);
    shape(key, 'Context key declaration', binding.source, ['binding', 'debugName'], ['exportName']);
    text(key.debugName, 'Context key debug name', binding.source, [binding.id]);
    if (keys.has(binding.id)) reject('duplicate-binding', binding.source, `Context key ${JSON.stringify(binding.id)} is declared twice.`, [binding.id]);
    keys.set(binding.id, key);
    if (Object.hasOwn(key, 'exportName')) {
      name(key.exportName, 'Context key export name', binding.source, [binding.id]);
      declarePublicName(exports, key.exportName!, binding, 'Compilation unit export');
    }
  }
  const bodies = new Map<string, BodyDeclarations>();
  function addBody(body: ComponentBody): void {
    if (bodies.has(body.id)) reject('duplicate-binding', body.source, `Component ID ${JSON.stringify(body.id)} is declared twice.`, [body.id]);
    declarePublicName(exports, body.name, body, 'Compilation unit export');
    bodies.set(body.id, indexBody(body, types, recordFields, keys));
  }
  addBody(ir);
  for (const body of ir.components) {
    checkBodyShape(body, false, source);
    addBody(body);
  }
  return { keys, bodies };
}
