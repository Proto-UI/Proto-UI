import type {
  Behavior,
  Binding,
  ComponentIR,
  ElementView,
  NamedBehavior,
  SourceSpan,
  TextRegion,
  ValueType,
} from './component-ir.ts';
import { viewBindings } from './view.ts';
import { checkBehavior, checkSignature, type BehaviorFacts } from './validation/behavior.ts';
import { checkDependencies } from './validation/dependencies.ts';
import { ComponentIRDiagnostic, reject, requireType } from './validation/diagnostic.ts';
import {
  checkBinding,
  declarePublicName,
  id,
  list,
  literalType,
  location,
  member,
  name,
  resolve,
  shape,
  unique,
} from './validation/structure.ts';
import type { Declarations, ReadableField } from './validation/value.ts';

export { ComponentIRDiagnostic, unsupportedHostName } from './validation/diagnostic.ts';

function requirePhase(fn: Behavior, expected: Behavior['phase'], label: string): void {
  if (fn.phase !== expected) {
    reject(
      'invalid-phase',
      fn.binding.source,
      `${label} requires a ${expected} behavior, received ${fn.phase}. Reference a behavior of the declared phase.`,
      [fn.binding.id]
    );
  }
}

function requireNoArguments(fn: Behavior, label: string): void {
  if (fn.params.length) {
    reject(
      'wrong-arity',
      fn.binding.source,
      `${label} supplies no arguments, but ${JSON.stringify(fn.binding.id)} declares ${fn.params.length}. Reference a zero-parameter behavior.`,
      [fn.binding.id]
    );
  }
}

function checkPublicSurface(
  ir: ComponentIR,
  declarations: Declarations
): ComponentIRDiagnostic | undefined {
  let missing: ComponentIRDiagnostic | undefined;
  function checkNamed(entries: readonly NamedBehavior[], kind: 'projection' | 'action'): void {
    const names = new Map<string, string>();
    for (const entry of entries) {
      const key = member(entry, 'fn');
      const target = typeof key === 'string' ? declarations.functions.get(key) : undefined;
      const source = target?.binding.source ?? ir.source;
      shape(entry, `public ${kind}`, source, ['name', 'fn']);
      const fn = resolve(declarations.functions, entry.fn, `Public ${kind} behavior`, source);
      name(entry.name, `public ${kind} name`, source, [fn.binding.id]);
      declarePublicName(names, entry.name, fn.binding, `Public ${kind}`);
      requirePhase(
        fn,
        kind === 'projection' ? 'pure' : 'action',
        `Public ${kind} ${JSON.stringify(entry.name)}`
      );
      if (kind === 'projection') requireNoArguments(fn, 'A public readonly projection');
      else if (fn.binding.type !== 'unit' && !missing) {
        missing = new ComponentIRDiagnostic(
          'action-result',
          source,
          `Host dispatch of ${JSON.stringify(entry.name)} needs transport for its ${fn.binding.type} result across queued reentry.`,
          [entry.fn]
        );
      }
    }
  }
  checkNamed(ir.projections, 'projection');
  checkNamed(ir.actions, 'action');

  const active = new Set<ElementView>();
  function checkNode(node: ElementView | TextRegion, parent: SourceSpan): void {
    const source = location(node, 'view node', parent);
    if (member(node, 'kind') === 'text') {
      shape(node, 'text region', source, ['kind', 'value', 'source']);
      return;
    }
    shape(
      node,
      'element',
      source,
      ['kind', 'tag', 'children', 'source'],
      ['style', 'disabled', 'activate']
    );
    if (node.kind !== 'element' || !['span', 'i', 'section', 'div', 'button'].includes(node.tag)) {
      reject('ir-shape', source, 'The element needs a tag from the checked receiving vocabulary.');
    }
    if (active.has(node)) reject('ir-shape', source, 'A view element cannot contain itself.');
    if (
      node.tag !== 'button' &&
      (node.disabled !== undefined || node.activate !== undefined) &&
      !missing
    ) {
      missing = new ComponentIRDiagnostic(
        'interactive-text',
        source,
        `Native press or disabled lowering on a ${node.tag} element is unavailable.`
      );
    }
    list(node.children, 'view children', source);
    active.add(node);
    for (const child of node.children) checkNode(child, source);
    active.delete(node);
  }
  checkNode(ir.view, ir.source);
  if (ir.view.kind !== 'element')
    reject('ir-shape', ir.source, 'The component root must be an element.');
  const types = {
    text: 'text',
    style: 'tokens',
    disabled: 'bool',
    activate: 'unit',
  } as const satisfies Record<string, ValueType>;
  for (const { fn: key, role, source } of viewBindings(ir.view)) {
    const fn = resolve(declarations.functions, key, `View ${role} behavior`, source);
    requirePhase(fn, role === 'activate' ? 'action' : 'pure', `View ${role}`);
    requireNoArguments(fn, `View ${role}`);
    requireType(fn.binding.type, types[role], `View ${role}`, source, [key]);
  }
  return missing;
}

function fromCallSite(
  diagnostic: ComponentIRDiagnostic,
  owner: string,
  callers: ReadonlyMap<string, string | undefined>
): ComponentIRDiagnostic {
  let caller = callers.get(owner);
  if (caller === undefined) return diagnostic;
  const path = [owner];
  while (caller !== undefined) {
    path.push(caller);
    caller = callers.get(caller);
  }
  return diagnostic.withCallPath(path.reverse());
}

function checkReachedBehavior(
  fn: Behavior,
  declarations: Declarations,
  callers: ReadonlyMap<string, string | undefined>
): BehaviorFacts {
  try {
    return checkBehavior(fn, declarations);
  } catch (error) {
    if (!(error instanceof ComponentIRDiagnostic) || error.code !== 'illegal-effect') throw error;
    throw fromCallSite(error, fn.binding.id, callers);
  }
}

/** Admit the checked IR before either target constructs or writes an artifact. */
export function validateComponent(ir: ComponentIR): void {
  const source = location(ir, 'component');
  shape(
    ir,
    'component',
    source,
    [
      'version',
      'name',
      'source',
      'props',
      'fields',
      'signals',
      'behaviors',
      'projections',
      'actions',
      'view',
    ],
    ['prototypeName']
  );
  if (ir.version !== 2)
    reject('ir-shape', source, 'This component IR receiver requires version 2.');
  name(ir.name, 'component name', source);
  if (Object.hasOwn(ir, 'prototypeName')) name(ir.prototypeName, 'prototype metadata name', source);
  for (const key of ['props', 'fields', 'signals', 'behaviors', 'projections', 'actions'] as const)
    list(ir[key], key, source);

  const ids = new Set<string>();
  const propNames = new Map<string, string>();
  const signalNames = new Map<string, string>();
  const values = new Map<string, ReadableField>();
  const signals = new Map<string, Binding>();
  const functions = new Map<string, Behavior>();

  function declare(binding: Binding): void {
    unique(ids, binding.id, 'Component binding', binding.source);
  }
  for (const prop of ir.props) {
    checkBinding(prop, source, true);
    if (Object.hasOwn(prop, 'default')) {
      requireType(
        literalType(prop.default!, prop.source, [prop.id]),
        prop.type,
        'Prop default',
        prop.source,
        [prop.id]
      );
    }
    declare(prop);
    declarePublicName(propNames, prop.name, prop, 'Public prop');
    values.set(prop.id, { kind: 'prop', binding: prop });
  }
  for (const field of ir.fields) {
    const binding = member(field, 'binding') as Binding;
    checkBinding(binding, source);
    shape(field, 'instance field', binding.source, ['kind', 'binding', 'init']);
    if (field.kind !== 'state' && field.kind !== 'capture') {
      reject(
        'ir-shape',
        binding.source,
        'An instance field must declare state or capture storage.',
        [binding.id]
      );
    }
    declare(binding);
    id(field.init, 'field initializer', binding.source);
    values.set(binding.id, { kind: field.kind, binding });
  }
  for (const signal of ir.signals) {
    checkBinding(signal, source);
    declare(signal);
    declarePublicName(signalNames, signal.name, signal, 'Public signal');
    signals.set(signal.id, signal);
  }
  for (const fn of ir.behaviors) {
    checkSignature(fn, source);
    declare(fn.binding);
    functions.set(fn.binding.id, fn);
  }
  const declarations = { values, signals, functions } satisfies Declarations;
  for (const field of ir.fields) {
    const fn = resolve(
      functions,
      field.init,
      'Field initializer',
      field.binding.source,
      field.binding.id
    );
    requirePhase(fn, 'init', `Initializer for ${JSON.stringify(field.binding.id)}`);
    requireNoArguments(fn, 'A field initializer');
    requireType(
      fn.binding.type,
      field.binding.type,
      'Field initializer result',
      field.binding.source,
      [field.binding.id, field.init]
    );
  }
  const missing = checkPublicSurface(ir, declarations);
  const facts = new Map<string, BehaviorFacts>();
  // Each discovery edge retains a real caller for a diagnostic. Signatures are
  // already indexed, so each body can be checked once, independent of declaration order.
  const callers = new Map<string, string | undefined>();
  for (const binding of viewBindings(ir.view)) callers.set(binding.fn, undefined);
  for (const field of ir.fields) callers.set(field.init, undefined);
  for (const projection of ir.projections) callers.set(projection.fn, undefined);
  for (const action of ir.actions) callers.set(action.fn, undefined);
  for (const key of callers.keys()) {
    const body = checkReachedBehavior(functions.get(key)!, declarations, callers);
    facts.set(key, body);
    for (const callee of body.calls.keys()) {
      if (!callers.has(callee)) callers.set(callee, key);
    }
  }
  for (const fn of ir.behaviors) {
    if (!facts.has(fn.binding.id)) facts.set(fn.binding.id, checkBehavior(fn, declarations));
  }
  checkDependencies(ir, declarations, facts, callers.keys());
  if (missing) throw missing;
  for (const fn of callers.keys()) {
    const unsupported = facts.get(fn)!.missing;
    if (unsupported) throw fromCallSite(unsupported, fn, callers);
  }
}
