import ts from 'typescript';
import { PROTO_TARGETS, type ProtoTarget } from '../frontend/types.ts';
import type { Binding, ComponentBody, ComponentIR, ContextKeyIR, ExternIR } from '../targets/component-ir.ts';
import { argumentsIn, memberValue, objectMembers, sourceLiteral, sourceName } from './component-syntax.ts';
import { lowerComponentBody } from './component.ts';
import { allocationOwner, type LinkOrigin } from './modules.ts';
import type { SourceContext } from './source.ts';

export type { LinkOrigin } from './modules.ts';
export interface SourceLinks {
  resolveKey(node: ts.Expression, origin?: LinkOrigin): ContextKeyIR;
  resolveExtern(node: ts.Expression, origin?: LinkOrigin): ExternIR;
  child(node: ts.Expression, origin?: LinkOrigin): string;
}

function handleArguments(source: SourceContext, call: ts.CallExpression, names: readonly string[], arity: number, capability: string): readonly ts.Type[] {
  const checker = source.checker;
  const signature = checker.getResolvedSignature(call);
  const result = signature && checker.getReturnTypeOfSignature(signature);
  if (result && result.flags & ts.TypeFlags.Object && (result as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
    const handle = result as ts.TypeReference;
    const trusted = handle.target.getSymbol()?.declarations?.some(decl =>
      ts.isInterfaceDeclaration(decl) && names.some(name => source.intrinsic(decl.name, name)));
    const args = checker.getTypeArguments(handle);
    if (trusted && args.length === arity) return args;
  }
  return source.missing(call, capability, `The allocation needs the checked type arguments of its authoring ${names.join(' or ')} result.`);
}

function localName(call: ts.CallExpression): string {
  const owner = allocationOwner(call)!;
  return ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name) ? owner.name.text : 'default';
}

function externMetadata(source: SourceContext, site: ts.CallExpression): Omit<ExternIR, 'binding' | 'params'> {
  const role = 'producer/extern-declaration';
  argumentsIn(source, site, 1, 1, role);
  const argument = site.arguments[0]!;
  const literal = source.modules.dataLiteral(argument);
  if (!literal || !ts.isObjectLiteralExpression(literal)) {
    return source.missing(argument, role, 'The extern declaration needs its immutable source metadata.');
  }
  const members = objectMembers(source, literal, role, ['name', 'effect', 'lifetime', 'async', 'targets']);
  function field(key: string): ts.Expression {
    const member = members.get(key);
    if (!member) return source.missing(argument, role, `The extern declaration needs its ${key} member.`);
    return memberValue(source, member, role);
  }
  const name = sourceName(source, field('name'), 'producer/extern-name');
  for (const [key, expected] of [['effect', 'after-state-commit'], ['lifetime', 'task']] as const) {
    const expression = field(key);
    const actual = sourceLiteral(source, expression);
    if (actual?.kind !== 'text' || actual.value !== expected) {
      return source.missing(expression, `producer/extern-${key}`, `The owned command needs the declared ${key} ${JSON.stringify(expected)}.`);
    }
  }
  const asyncField = field('async');
  const asynchronous = sourceLiteral(source, asyncField);
  if (asynchronous?.kind !== 'bool' || !asynchronous.value) {
    return source.missing(asyncField, 'producer/extern-async', 'An owned await needs an asynchronous extern declaration.');
  }
  const targetsField = field('targets');
  const array = source.modules.dataLiteral(targetsField);
  if (!array || !ts.isArrayLiteralExpression(array)) {
    return source.missing(targetsField, 'producer/extern-targets', 'The extern target set needs its concrete source elements.');
  }
  const targets: ProtoTarget[] = [];
  for (const element of array.elements) {
    const label = sourceLiteral(source, element);
    const target = label?.kind === 'text' && PROTO_TARGETS.find(item => item === label.value);
    if (!target) return source.missing(element, 'producer/extern-targets', 'This extern target needs a resolved compiler target name.');
    if (!targets.includes(target)) targets.push(target);
  }
  return { name, effect: 'after-state-commit', lifetime: 'task', async: true, targets };
}

function externDeclaration(source: SourceContext, site: ts.CallExpression): ExternIR {
  const metadata = externMetadata(source, site);
  const args = handleArguments(source, site, ['TaskExtern', 'ExternHandle'], 2, 'producer/extern-signature');
  const tupleSite = site.typeArguments?.[0] ?? site;
  if (!source.checker.isTupleType(args[0]!)) {
    return source.missing(tupleSite, 'producer/extern-arguments', 'An extern command needs a finite argument tuple.');
  }
  const tuple = args[0] as ts.TupleTypeReference;
  if (tuple.target.elementFlags.some(flag => flag !== ts.ElementFlags.Required)) {
    return source.missing(tupleSite, 'producer/extern-arguments', 'Optional or variable-length extern arguments need their own native call convention.');
  }
  const result = source.data.type(site.typeArguments?.[1] ?? site, args[1]!);
  const binding = source.binding(site, 'extern', localName(site), result);
  const params = source.checker.getTypeArguments(tuple).map((type, index): Binding => {
    const label = tuple.target.labeledElementDeclarations?.[index];
    const node = label ?? (ts.isTupleTypeNode(tupleSite) ? tupleSite.elements[index] : undefined) ?? tupleSite;
    const name = label && ts.isIdentifier(label.name) ? label.name.text : `arg${index + 1}`;
    return source.binding(node, JSON.stringify(['extern-parameter', binding.id, index]), name, source.data.type(node, type));
  });
  return { binding, params, ...metadata };
}

/** Every body shares the same checked module allocations and data interner. The source call
 * identifies a component or key; its authored debug text and public spelling do not. */
export function lowerSourceUnit(source: SourceContext, call: ts.CallExpression, publicName: string): ComponentIR {
  const modules = source.modules;
  const keys = new Map<ts.CallExpression, ContextKeyIR>();
  const externs = new Map<ts.CallExpression, ExternIR>();
  const ids = new Map<ts.CallExpression, string>();
  const components: ComponentBody[] = [];
  const exports = new Map<string, ts.CallExpression>();

  function publish(name: string, site: ts.CallExpression): void {
    const existing = exports.get(name);
    if (!name || (existing && existing !== site)) {
      source.missing(site, 'producer/link-public-name', `The native unit needs a distinct public binding for ${JSON.stringify(name)}.`);
    }
    exports.set(name, site);
  }

  function lower(site: ts.CallExpression, name: string): ComponentBody {
    publish(name, site);
    const id = source.binding(site, 'component', name, 'unit').id;
    // Back edges retain their authored ChildView spans. The shared receiver diagnoses the whole path.
    ids.set(site, id);
    return lowerComponentBody(source, site, name, id, links);
  }

  const links: SourceLinks = {
    resolveKey(node, origin) {
      const site = modules.allocation(node, 'createContextKey', origin);
      const previous = keys.get(site);
      if (previous) return previous;
      argumentsIn(source, site, 1, 1, 'producer/context-key-arguments');
      const label = site.arguments[0]!;
      const debug = sourceLiteral(source, label);
      if (debug?.kind !== 'text') return source.missing(label, 'producer/context-key-label', 'The Context key needs its checked module-initialized debug string.');
      const name = modules.publicName(site);
      if (name !== undefined) publish(name, site);
      const [payload] = handleArguments(source, site, ['ContextKey'], 1, 'producer/context-key-payload');
      const binding = source.binding(site, 'context-key', localName(site), source.data.type(site.typeArguments?.[0] ?? site, payload!));
      const key: ContextKeyIR = { binding, debugName: debug.value, ...(name === undefined ? {} : { exportName: name }) };
      keys.set(site, key);
      return key;
    },
    resolveExtern(node, origin) {
      const site = modules.allocation(node, 'declareExtern', origin);
      const previous = externs.get(site);
      if (previous) return previous;
      const declaration = externDeclaration(source, site);
      externs.set(site, declaration);
      return declaration;
    },
    child(node, origin) {
      const site = modules.allocation(node, 'definePrototype', origin);
      const previous = ids.get(site);
      if (previous !== undefined) return previous;
      const name = modules.publicName(site);
      if (name === undefined) return source.missing(node, 'producer/child-public-binding', 'This private child needs a native internal component binding in the emitted unit.');
      const body = lower(site, name);
      components.push(body);
      return body.id;
    },
  };

  const root = lower(modules.allocation(call, 'definePrototype'), publicName);
  return {
    ...root, version: 5,
    types: source.data.entries.slice(), keys: [...keys.values()], externs: [...externs.values()], components,
  };
}
