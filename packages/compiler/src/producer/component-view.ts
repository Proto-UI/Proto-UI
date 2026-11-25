import ts from 'typescript';
import type { ElementView, TextRegion, ValueType } from '../targets/component-ir.ts';
import { BehaviorProducer, behaviorValueType } from './behavior.ts';
import {
  argumentsIn,
  capabilityParameter,
  declarationOnly,
  memberAccess,
  memberValue,
  objectMembers,
  operand,
  sourceName,
  type SourceFunction,
} from './component-syntax.ts';
import type { SourceContext } from './source.ts';

const tags: Record<ElementView['tag'], true> = {
  span: true,
  i: true,
  section: true,
  div: true,
  button: true,
};

type RendererLocal = { origin: ts.Expression; used: boolean } & (
  | { kind: 'value'; type: ValueType; fn: string }
  | { kind: 'element'; view: ElementView }
);

function isElementTag(name: string): name is ElementView['tag'] {
  return Object.hasOwn(tags, name);
}

export function componentView(
  source: SourceContext,
  behaviors: BehaviorProducer,
  renderer: SourceFunction
): ElementView {
  const body = renderer.body;
  if (!body)
    return source.missing(
      renderer,
      'renderer-body',
      'The renderer needs an authored function body.'
    );
  if (renderer.parameters.length !== 1) {
    return source.missing(
      renderer.parameters[1] ?? renderer,
      'renderer-parameter',
      'The structural view needs a bound renderer parameter.'
    );
  }
  const parameter = renderer.parameters[0]!;
  const aliases = new Set([
    source.symbol(capabilityParameter(source, parameter, 'renderer-parameter')),
  ]);
  const aliasDeclarations: ts.VariableDeclaration[] = [];
  const locals = new Map<ts.Symbol, RendererLocal>();
  function isRenderer(expression: ts.Expression): boolean {
    const node = operand(expression);
    return ts.isIdentifier(node) && aliases.has(source.symbol(node));
  }

  function localOf(expression: ts.Expression): RendererLocal | undefined {
    const node = operand(expression);
    return ts.isIdentifier(node) ? locals.get(source.symbol(node)) : undefined;
  }

  function value(
    expression: ts.Expression,
    role: 'text' | 'style' | 'disabled',
    type: ValueType
  ): string {
    const local = localOf(expression);
    if (local) {
      if (local.kind !== 'value' || local.type !== type) {
        return source.missing(
          expression,
          `view-${role}`,
          `This renderer local needs a ${type} value in its ${role} region.`
        );
      }
      local.used = true;
      return local.fn;
    }
    if (behaviorValueType(source, expression) !== type) {
      return source.missing(
        expression,
        `view-${role}`,
        `A ${role} region needs lowering from the authored value domain to ${type}.`
      );
    }
    const binding = source.binding(expression, `view-${role}`, role, type);
    return behaviors.expression(binding, 'pure', expression, parameter, aliasDeclarations);
  }

  function localElement(expression: ts.Expression): ElementView | undefined {
    const local = localOf(expression);
    if (local?.kind !== 'element') return undefined;
    if (local.used)
      return source.missing(
        expression,
        'shared-view-node',
        'Using one authored element at multiple view positions needs an explicit node identity representation.'
      );
    local.used = true;
    return local.view;
  }

  function rendererCall(call: ts.CallExpression, method: string): boolean {
    const access = memberAccess(call.expression);
    if (!access || access.key !== method || !source.method(call, 'Renderer', method)) return false;
    if (!isRenderer(access.object)) {
      return source.missing(
        access.object,
        'renderer-origin',
        `The receiver of ${method} needs a proven binding to this returned renderer.`
      );
    }
    return true;
  }

  function element(call: ts.CallExpression): ElementView {
    argumentsIn(source, call, 1, 3, 'element');
    const tagNode = call.arguments[0]!;
    const tag = sourceName(source, tagNode, 'element-tag');
    if (!isElementTag(tag))
      return source.missing(
        tagNode,
        'element-tag',
        `The receiving element vocabulary has no lowering for ${JSON.stringify(tag)}.`
      );
    const options: { style?: string; disabled?: string } = {};
    if (call.arguments[1]) {
      for (const [key, member] of objectMembers(source, call.arguments[1], 'element-options', [
        'style',
        'disabled',
      ])) {
        const expression = memberValue(source, member, 'element-options');
        if (key === 'style') options.style = value(expression, 'style', 'tokens');
        else options.disabled = value(expression, 'disabled', 'bool');
      }
    }
    const children: (ElementView | TextRegion)[] = [];
    if (call.arguments[2]) {
      const array = operand(call.arguments[2]);
      if (!ts.isArrayLiteralExpression(array)) {
        return source.missing(
          array,
          'view-children',
          'This children expression needs lowering to an ordered collection of view regions.'
        );
      }
      for (const child of array.elements) {
        if (ts.isSpreadElement(child) || ts.isOmittedExpression(child)) {
          return source.missing(
            child,
            'view-children',
            'This child needs lowering for its spread or absent position.'
          );
        }
        const node = operand(child);
        const stored = localElement(child);
        if (stored) children.push(stored);
        else if (ts.isCallExpression(node) && rendererCall(node, 'el'))
          children.push(element(node));
        else if (ts.isCallExpression(node) && rendererCall(node, 'child')) {
          return source.missing(
            node,
            'keyed-child-view',
            'A renderer.child invocation needs the child prototype, typed props and logical key in the receiving IR.'
          );
        } else {
          children.push({
            kind: 'text',
            source: source.span(child),
            value: value(child, 'text', 'text'),
          });
        }
      }
    }
    return { kind: 'element', tag, source: source.span(call), ...options, children };
  }

  function root(expression: ts.Expression): ElementView {
    const stored = localElement(expression);
    if (stored) return stored;
    const node = operand(expression);
    if (ts.isCallExpression(node) && rendererCall(node, 'el')) return element(node);
    if (ts.isCallExpression(node) && rendererCall(node, 'child')) {
      return source.missing(
        node,
        'keyed-child-view',
        'A returned child invocation needs a logical child root in the receiving IR.'
      );
    }
    return source.missing(
      node,
      'view-root',
      'The returned view needs a checked structural root from the bound renderer.'
    );
  }

  if (!ts.isBlock(body)) return root(body);
  for (const statement of body.statements) {
    if (declarationOnly(statement)) continue;
    if (ts.isReturnStatement(statement) && statement.expression) {
      const view = root(statement.expression);
      for (const local of locals.values()) {
        if (!local.used)
          return source.missing(
            local.origin,
            'unused-renderer-initializer',
            'This renderer initializer is evaluated by the source but has no receiving view region.'
          );
      }
      return view;
    }
    if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          return source.missing(
            declaration,
            'renderer-local',
            'This renderer local needs its binding and evaluation represented in the view.'
          );
        }
        const init = operand(declaration.initializer);
        const symbol = source.symbol(declaration.name);
        if (isRenderer(init)) {
          aliases.add(symbol);
          aliasDeclarations.push(declaration);
        } else if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) {
          const prior = localOf(init);
          if (prior) locals.set(symbol, prior);
          else if (ts.isCallExpression(init) && rendererCall(init, 'el')) {
            locals.set(symbol, { kind: 'element', view: element(init), origin: init, used: false });
          } else if (ts.isCallExpression(init) && rendererCall(init, 'child')) {
            return source.missing(
              init,
              'keyed-child-view',
              'A renderer.child initializer needs a represented child prototype, key and typed props.'
            );
          } else {
            // A render-local scalar is evaluated against the current render view. It can never become an instance capture.
            const type = behaviorValueType(source, declaration.initializer);
            const binding = source.binding(
              declaration,
              'renderer-local-value',
              declaration.name.text,
              type
            );
            const fn = behaviors.expression(
              binding,
              'pure',
              declaration.initializer,
              parameter,
              aliasDeclarations
            );
            locals.set(symbol, { kind: 'value', type, fn, origin: init, used: false });
          }
        }
      }
      continue;
    }
    return source.missing(
      statement,
      'renderer-statement',
      'This reached renderer statement needs its evaluation and control path represented in the view.'
    );
  }
  return source.missing(body, 'view-root', 'The renderer has no resolved returned view.');
}
