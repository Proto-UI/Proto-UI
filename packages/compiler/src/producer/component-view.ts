import ts from 'typescript';
import type { ChildProp, ChildView, ElementView, ValueType, ViewNode } from '../targets/component-ir.ts';
import type { BehaviorProducer } from './behavior.ts';
import {
  argumentsIn, capabilityParameter, declarationOnly, linkedType, memberAccess, memberValue, objectMembers, operand,
  sourceName, type SourceFunction,
} from './component-syntax.ts';
import type { SourceLinks } from './links.ts';
import type { SourceContext } from './source.ts';

const tags: Record<ElementView['tag'], true> = { span: true, i: true, section: true, div: true, button: true };

type RendererLocal = { origin: ts.Expression; used: boolean } & (
  | { kind: 'value'; type: ValueType; fn: string }
  | { kind: 'node'; view: ElementView | ChildView }
  | { kind: 'prototype' }
);

type ValueRegion = 'text' | 'style' | 'disabled' | 'child-key' | 'child-prop';

function isElementTag(name: string): name is ElementView['tag'] {
  return Object.hasOwn(tags, name);
}

export function componentView(
  source: SourceContext, behaviors: BehaviorProducer, renderer: SourceFunction, resolveChild: SourceLinks['child'],
): ElementView {
  const body = renderer.body;
  if (!body) return source.missing(renderer, 'renderer-body', 'The renderer needs an authored function body.');
  if (renderer.parameters.length !== 1) {
    return source.missing(renderer.parameters[1] ?? renderer, 'renderer-parameter', 'The structural view needs a bound renderer parameter.');
  }
  const parameter = renderer.parameters[0]!;
  const aliases = new Set([source.symbol(capabilityParameter(source, parameter, 'renderer-parameter'))]);
  const aliasDeclarations: ts.VariableDeclaration[] = [];
  const locals = new Map<ts.Symbol, RendererLocal>();
  function isRenderer(expression: ts.Expression): boolean {
    const node = operand(expression);
    return ts.isIdentifier(node) && aliases.has(source.symbol(node));
  }

  function localOf(expression: ts.Expression): RendererLocal | undefined {
    const node = operand(expression);
    if (!ts.isIdentifier(node)) return undefined;
    const symbol = source.symbol(node);
    const local = locals.get(symbol);
    const declaration = symbol.valueDeclaration;
    if (!local && declaration && ts.isVariableDeclaration(declaration) && node.pos < declaration.end &&
        ts.findAncestor(declaration, ts.isFunctionLike) === renderer) {
      return source.missing(node, 'renderer-binding-order', 'This renderer reads a local before its initializer has finished.');
    }
    return local;
  }

  function value(expression: ts.Expression, role: ValueRegion, expected?: ValueType, name: string = role): string {
    const local = localOf(expression);
    if (local && local.kind !== 'value') {
      return source.missing(expression, `view-${role}`, `The ${role} region needs a data value from this renderer local.`);
    }
    const type = local?.type ?? source.data.type(expression);
    if (expected !== undefined && type !== expected) {
      if (role === 'child-key' && type === 'number') {
        return source.missing(expression, 'numeric-child-key', 'A numeric child key needs native numeric identity support.');
      }
      return source.missing(expression, `view-${role}`, `The ${role} region needs lowering from ${type} to ${expected}.`);
    }
    if (local) {
      local.used = true;
      return local.fn;
    }
    const binding = source.binding(expression, `view-${role}`, name, type);
    return behaviors.expression(binding, 'pure', expression, parameter, aliasDeclarations);
  }

  function localNode(expression: ts.Expression): ElementView | ChildView | undefined {
    const local = localOf(expression);
    if (local?.kind !== 'node') return undefined;
    if (local.used) return source.missing(expression, 'shared-view-node', 'Using one authored node at multiple view positions needs an explicit node identity representation.');
    local.used = true;
    return local.view;
  }

  function rendererCall(call: ts.CallExpression, method: string): boolean {
    const access = memberAccess(call.expression);
    if (!access || access.key !== method || !source.method(call, 'Renderer', method)) return false;
    if (!isRenderer(access.object)) {
      return source.missing(access.object, 'renderer-origin', `The receiver of ${method} needs a proven binding to this returned renderer.`);
    }
    return true;
  }

  function rendererLink(identifier: ts.Identifier): ts.Expression | undefined {
    const local = localOf(identifier);
    if (local?.kind !== 'prototype') return undefined;
    local.used = true;
    return local.origin;
  }

  function child(call: ts.CallExpression): ChildView {
    argumentsIn(source, call, 2, 2, 'keyed-child');
    const target = call.arguments[0]!;
    const local = localOf(target);
    if (local && local.kind !== 'prototype') {
      return source.missing(target, 'child-prototype', 'The keyed child needs a reference to its authored prototype declaration.');
    }
    if (local) local.used = true;
    const component = resolveChild(local?.origin ?? target, rendererLink);
    const options = objectMembers(source, call.arguments[1]!, 'child-options', ['key', 'props']);
    let key: string | undefined;
    const props: ChildProp[] = [];
    for (const [name, member] of options) {
      const expression = memberValue(source, member, 'child-options');
      if (name === 'key') {
        key = value(expression, 'child-key', 'text');
      } else {
        // Supplied values are ordinary data. The unit linker checks them against the resolved child's input schema.
        for (const [prop, field] of objectMembers(source, expression, 'child-props')) {
          const fn = value(memberValue(source, field, 'child-prop'), 'child-prop', undefined, prop);
          props.push({ name: prop, fn, source: source.span(field) });
        }
      }
    }
    if (key === undefined || !options.has('props')) {
      return source.missing(call.arguments[1]!, 'child-options', 'A keyed invocation needs its logical key and supplied props object.');
    }
    return { kind: 'child', component, key, props, source: source.span(call) };
  }

  function structural(expression: ts.Expression): ElementView | ChildView | undefined {
    const node = operand(expression);
    if (!ts.isCallExpression(node)) return undefined;
    if (rendererCall(node, 'el')) return element(node);
    if (rendererCall(node, 'child')) return child(node);
    return undefined;
  }

  function element(call: ts.CallExpression): ElementView {
    argumentsIn(source, call, 1, 3, 'element');
    const tagNode = call.arguments[0]!;
    const tag = sourceName(source, tagNode, 'element-tag');
    if (!isElementTag(tag)) return source.missing(tagNode, 'element-tag', `The receiving element vocabulary has no lowering for ${JSON.stringify(tag)}.`);
    const options: { style?: string; disabled?: string } = {};
    if (call.arguments[1]) {
      for (const [key, member] of objectMembers(source, call.arguments[1], 'element-options', ['style', 'disabled'])) {
        const expression = memberValue(source, member, 'element-options');
        if (key === 'style') options.style = value(expression, 'style', 'tokens');
        else options.disabled = value(expression, 'disabled', 'bool');
      }
    }
    const children: ViewNode[] = [];
    if (call.arguments[2]) {
      const array = operand(call.arguments[2]);
      if (!ts.isArrayLiteralExpression(array)) {
        return source.missing(array, 'view-children', 'This children expression needs lowering to an ordered collection of view regions.');
      }
      for (const child of array.elements) {
        if (ts.isSpreadElement(child) || ts.isOmittedExpression(child)) {
          return source.missing(child, 'view-children', 'This child needs lowering for its spread or absent position.');
        }
        const view = localNode(child) ?? structural(child);
        children.push(view ?? { kind: 'text', source: source.span(child), value: value(child, 'text', 'text') });
      }
    }
    return { kind: 'element', tag, source: source.span(call), ...options, children };
  }

  function root(expression: ts.Expression): ElementView {
    const view = localNode(expression) ?? structural(expression);
    if (view?.kind === 'element') return view;
    if (view?.kind === 'child') return source.missing(expression, 'keyed-child-root', 'Returning a child directly requires a component root that can delegate its host element.');
    return source.missing(expression, 'view-root', 'The returned view needs a checked structural root from the bound renderer.');
  }

  if (!ts.isBlock(body)) return root(body);
  for (const statement of body.statements) {
    if (declarationOnly(statement)) continue;
    if (ts.isReturnStatement(statement) && statement.expression) {
      const view = root(statement.expression);
      for (const local of locals.values()) {
        if (!local.used) return source.missing(local.origin, 'unused-renderer-initializer', 'This renderer initializer is evaluated by the source but has no receiving view region.');
      }
      return view;
    }
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          return source.missing(declaration, 'renderer-local', 'This renderer local needs its binding and evaluation represented in the view.');
        }
        const init = operand(declaration.initializer);
        const symbol = source.symbol(declaration.name);
        if (isRenderer(init)) {
          aliases.add(symbol);
          aliasDeclarations.push(declaration);
        } else if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) {
          const prior = localOf(init);
          if (prior) {
            locals.set(symbol, prior);
            continue;
          }
          const view = structural(init);
          if (view) locals.set(symbol, { kind: 'node', view, origin: init, used: false });
          else if (linkedType(source, init) === 'Prototype') {
            locals.set(symbol, { kind: 'prototype', origin: init, used: false });
          } else {
            // A render-local scalar is evaluated against the current render view. It can never become an instance capture.
            const type = source.data.type(declaration.initializer);
            const binding = source.binding(declaration, 'renderer-local-value', declaration.name.text, type);
            const fn = behaviors.expression(binding, 'pure', declaration.initializer, parameter, aliasDeclarations);
            locals.set(symbol, { kind: 'value', type, fn, origin: init, used: false });
          }
        }
      }
      continue;
    }
    return source.missing(statement, 'renderer-statement', 'This reached renderer statement needs its evaluation and control path represented in the view.');
  }
  return source.missing(body, 'view-root', 'The renderer has no resolved returned view.');
}
