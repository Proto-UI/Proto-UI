import {
  lookupDataType, type Behavior, type Binding, type ChildView, type NamedBehavior, type SourceSpan,
  type ViewNode,
} from '../component-ir.ts';
import { viewBindings, type ViewBinding } from '../view.ts';
import { ComponentIRDiagnostic, reject, requireType } from './diagnostic.ts';
import type { References } from './graph.ts';
import { declarePublicName, list, location, member, name, resolve, shape, text, variant } from './structure.ts';
import type { BodyDeclarations, UnitDeclarations } from './unit.ts';

const nodeFields = {
  element: ['kind', 'tag', 'children', 'source'], text: ['kind', 'value', 'source'],
  child: ['kind', 'component', 'key', 'props', 'source'],
} satisfies Record<ViewNode['kind'], readonly string[]>;
const elementRoles = ['style', 'disabled', 'activate'] as const;
const elementTypes = { style: 'tokens', disabled: 'bool', activate: 'unit' } as const;
const tags = { span: true, i: true, section: true, div: true, button: true } as const;

function requirePhase(fn: Behavior, expected: Behavior['phase'], label: string, source: SourceSpan): void {
  if (fn.phase !== expected) {
    reject('invalid-phase', source, `${label} requires a ${expected} behavior, received ${fn.phase}. Reference a behavior of the declared phase.`, [fn.binding.id]);
  }
}

function requireNoArguments(fn: Behavior, label: string, source: SourceSpan): void {
  if (fn.params.length) {
    reject('wrong-arity', source, `${label} supplies no arguments, but ${JSON.stringify(fn.binding.id)} declares ${fn.params.length}. Reference a zero-parameter behavior.`, [fn.binding.id]);
  }
}

export function checkSurface(owner: BodyDeclarations, unit: UnitDeclarations, children: References): {
  view: ViewBinding[];
  missing: ComponentIRDiagnostic | undefined;
} {
  const { body, functions, types } = owner;
  let missing: ComponentIRDiagnostic | undefined;

  function zeroArgument(key: string, phase: Behavior['phase'], label: string, source: SourceSpan): Behavior {
    const fn = resolve(functions, key, `${label} behavior`, source, body.id);
    requirePhase(fn, phase, label, source);
    requireNoArguments(fn, label, source);
    return fn;
  }
  function checkNamed(entries: readonly NamedBehavior[], kind: 'projection' | 'action'): void {
    const names = new Map<string, Binding>();
    for (const entry of entries) {
      const ref = member(entry, 'fn');
      const target = typeof ref === 'string' ? functions.get(ref) : undefined;
      const source = target?.binding.source ?? body.source;
      shape(entry, `public ${kind}`, source, ['name', 'fn']);
      const fn = resolve(functions, entry.fn, `Public ${kind} behavior`, source, body.id);
      name(entry.name, `public ${kind} name`, source, [fn.binding.id]);
      declarePublicName(names, entry.name, fn.binding, `Public ${kind}`);
      requirePhase(fn, kind === 'projection' ? 'pure' : 'action', `Public ${kind} ${JSON.stringify(entry.name)}`, source);
      if (kind === 'projection') requireNoArguments(fn, 'A public readonly projection', source);
      else if (fn.binding.type !== 'unit' && !missing) {
        missing = new ComponentIRDiagnostic('action-result', source, `Host dispatch of ${JSON.stringify(entry.name)} needs transport for its ${fn.binding.type} result across queued reentry.`, [entry.fn]);
      }
    }
  }
  for (const field of body.fields) {
    const { binding } = field;
    const fn = zeroArgument(field.init, 'init', `Initializer for ${JSON.stringify(binding.id)}`, binding.source);
    requireType(fn.binding.type, binding.type, 'Field initializer result', binding.source, [binding.id, field.init]);
  }
  const provided = new Set<string>();
  for (const provider of body.provides) {
    const source = location(provider, 'Context provider', body.source);
    shape(provider, 'Context provider', source, ['key', 'fn', 'source']);
    const key = resolve(unit.keys, provider.key, 'Provided Context key', source, body.id);
    if (provided.has(provider.key)) {
      reject('duplicate-binding', source, `Component ${JSON.stringify(body.id)} provides Context key ${JSON.stringify(provider.key)} twice.`, [body.id, provider.key]);
    }
    provided.add(provider.key);
    const fn = zeroArgument(provider.fn, 'pure', 'Context provider', source);
    requireType(fn.binding.type, key.binding.type, 'Context provider result', source, [provider.key, provider.fn]);
  }
  checkNamed(body.projections, 'projection');
  checkNamed(body.actions, 'action');

  function checkChild(node: ChildView): void {
    const at = node.source;
    const target = resolve(unit.bodies, node.component, 'Child component', at, body.id);
    children.set(node.component, at);
    const key = zeroArgument(node.key, 'pure', 'Child key', at);
    if (key.binding.type === 'number') {
      missing ??= new ComponentIRDiagnostic('numeric-child-key', at, 'Stable numeric child keys need numeric identity lowering on this target path.', [body.id, node.component, node.key]);
    } else {
      requireType(key.binding.type, 'text', 'Child key', at, [body.id, node.key]);
    }
    list(node.props, 'child props', at);
    const supplied = new Set<string>();
    for (const prop of node.props) {
      const source = location(prop, 'child prop', at);
      shape(prop, 'child prop', source, ['name', 'fn', 'source']);
      text(prop.name, 'child prop name', source, [body.id, node.component]);
      const input = target.props.get(prop.name);
      if (!input) reject('child-input', source, `Child ${JSON.stringify(node.component)} has no input named ${JSON.stringify(prop.name)}.`, [body.id, node.component]);
      if (supplied.has(prop.name)) reject('duplicate-name', source, `Child input ${JSON.stringify(prop.name)} is supplied twice.`, [body.id, node.component, input.id]);
      supplied.add(prop.name);
      const fn = zeroArgument(prop.fn, 'pure', `Child input ${JSON.stringify(prop.name)}`, source);
      const data = lookupDataType(types, input.type);
      const expected = data?.kind === 'presence' ? data.value : input.type;
      if (fn.binding.type !== expected) {
        reject('child-input', source, `Child input ${JSON.stringify(prop.name)} requires ${expected}, received ${fn.binding.type}.`,
          [body.id, prop.fn, node.component, input.id]);
      }
    }
    for (const input of target.props.values()) {
      if (!supplied.has(input.name) && !Object.hasOwn(input, 'default') && lookupDataType(types, input.type)?.kind !== 'presence') {
        reject('child-input', at, `Child ${JSON.stringify(node.component)} requires its input ${JSON.stringify(input.name)}.`, [body.id, node.component, input.id]);
      }
    }
  }

  const active = new Set<ViewNode>();
  function checkNode(node: ViewNode, parent: SourceSpan): void {
    const source = location(node, 'view node', parent);
    variant(node, 'view node', source, nodeFields, [body.id], member(node, 'kind') === 'element' ? elementRoles : []);
    switch (node.kind) {
      case 'text': {
        const fn = zeroArgument(node.value, 'pure', 'View text', source);
        requireType(fn.binding.type, 'text', 'View text', source, [node.value]);
        break;
      }
      case 'child':
        checkChild(node);
        break;
      case 'element': {
        if (typeof node.tag !== 'string' || !Object.hasOwn(tags, node.tag)) reject('ir-shape', source, 'The element needs a tag from the checked receiving vocabulary.');
        if (active.has(node)) reject('ir-shape', source, 'A view element cannot contain itself.');
        if (node.tag !== 'button' && (node.disabled !== undefined || node.activate !== undefined) && !missing) {
          missing = new ComponentIRDiagnostic('interactive-text', source, `Native press or disabled lowering on a ${node.tag} element is unavailable.`);
        }
        for (const role of elementRoles) {
          const key = node[role];
          if (key === undefined) continue;
          const fn = zeroArgument(key, role === 'activate' ? 'action' : 'pure', `View ${role}`, source);
          requireType(fn.binding.type, elementTypes[role], `View ${role}`, source, [key]);
        }
        list(node.children, 'view children', source);
        active.add(node);
        for (const child of node.children) checkNode(child, source);
        active.delete(node);
        break;
      }
    }
  }
  if (member(body.view, 'kind') !== 'element') {
    reject('ir-shape', location(body.view, 'component root', body.source), 'The component root must be an element.');
  }
  checkNode(body.view, body.source);
  return { view: viewBindings(body.view), missing };
}
