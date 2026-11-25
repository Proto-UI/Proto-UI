import ts from 'typescript';
import type { ComponentBody, ComponentIR, ContextKeyIR, ValueType } from '../targets/component-ir.ts';
import { argumentsIn, sourceLiteral } from './component-syntax.ts';
import { lowerComponentBody } from './component.ts';
import { allocationOwner, type LinkOrigin } from './modules.ts';
import type { SourceContext } from './source.ts';

export type { LinkOrigin } from './modules.ts';
export interface SourceLinks {
  resolveKey(node: ts.Expression, origin?: LinkOrigin): ContextKeyIR;
  child(node: ts.Expression, origin?: LinkOrigin): string;
}

function keyPayload(source: SourceContext, call: ts.CallExpression): ValueType {
  const checker = source.checker;
  const signature = checker.getResolvedSignature(call);
  const result = signature && checker.getReturnTypeOfSignature(signature);
  if (result && result.flags & ts.TypeFlags.Object && (result as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
    const handle = result as ts.TypeReference;
    const trusted = handle.target.getSymbol()?.declarations?.some(decl => ts.isInterfaceDeclaration(decl) && source.intrinsic(decl.name, 'ContextKey'));
    const args = checker.getTypeArguments(handle);
    if (trusted && args.length === 1) return source.data.type(call.typeArguments?.[0] ?? call, args[0]!);
  }
  return source.missing(call, 'producer/context-key-payload', 'The Context allocation needs the payload of its resolved authoring ContextKey result.');
}

/** Every body shares the same checked module allocations and data interner. The source call
 * identifies a component or key; its authored debug text and public spelling do not. */
export function lowerSourceUnit(source: SourceContext, call: ts.CallExpression, publicName: string): ComponentIR {
  const modules = source.modules;
  const keys = new Map<ts.CallExpression, ContextKeyIR>();
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
      const owner = allocationOwner(site)!;
      const localName = ts.isVariableDeclaration(owner) && ts.isIdentifier(owner.name) ? owner.name.text : 'default';
      const binding = source.binding(site, 'context-key', localName, keyPayload(source, site));
      const key: ContextKeyIR = { binding, debugName: debug.value, ...(name === undefined ? {} : { exportName: name }) };
      keys.set(site, key);
      return key;
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
    ...root, version: 4,
    types: source.data.entries.slice(), keys: [...keys.values()], components,
  };
}
