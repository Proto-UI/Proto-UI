import ts from 'typescript';
import type { ParameterIR, ValueType } from './ir';
import { checkedCall, callableValue, joinValueTypes } from './value-types';
import { rejectNode, type FunctionNode } from './source-syntax';

/** A dormant body has no host-admission obligation. It can nevertheless contain
 * a type contradiction proven entirely by its own declared callable parameter
 * and literal arguments. Check only that closed evidence; unknown expressions,
 * nested scopes and host names remain deferred, with no executable IR created. */
export function checkDeferredSourceTypes(
  fn: FunctionNode,
  parameters: readonly ParameterIR[]
): void {
  if (!fn.body) return;
  const declared = new Map(parameters.map((parameter) => [parameter.name, parameter.type]));
  const shadow = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) declared.delete(name.text);
    else
      for (const element of name.elements) if (ts.isBindingElement(element)) shadow(element.name);
  };
  const findShadows = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) {
      if (ts.isFunctionDeclaration(node) && node.name) declared.delete(node.name.text);
      return;
    }
    if (ts.isVariableDeclaration(node)) shadow(node.name);
    if (ts.isClassDeclaration(node) && node.name) declared.delete(node.name.text);
    ts.forEachChild(node, findShadows);
  };
  findShadows(fn.body);

  const literalType = (expression: ts.Expression): ValueType | undefined => {
    let node = expression;
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return { kind: 'literal', value: node.text };
    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text);
      return Number.isFinite(value) ? { kind: 'literal', value } : undefined;
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
      return { kind: 'literal', value: node.kind === ts.SyntaxKind.TrueKeyword };
    if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
    if (ts.isArrayLiteralExpression(node)) {
      if (node.elements.some((item) => ts.isSpreadElement(item) || ts.isOmittedExpression(item)))
        return undefined;
      const elements = node.elements.map(literalType);
      if (elements.some((value) => value === undefined)) return undefined;
      return { kind: 'value-array', element: joinValueTypes(elements as ValueType[]) };
    }
    return undefined;
  };

  const inspect = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      !node.typeArguments?.length
    ) {
      const callee = declared.get(node.expression.text);
      if (callee !== undefined) {
        const optional = !!node.questionDotToken;
        let callable = false;
        try {
          callableValue(callee, optional);
          callable = true;
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
          // An unproven callee is not a dormant body-admission demand.
        }
        if (callable) {
          const types = node.arguments.map((argument) =>
            literalType(ts.isSpreadElement(argument) ? argument.expression : argument)
          );
          if (types.every((type): type is ValueType => type !== undefined)) {
            try {
              checkedCall(callee, types, optional, node.arguments.map(ts.isSpreadElement));
            } catch (error) {
              // A target/subset limitation is not a source type contradiction.
              if (!(error instanceof TypeError)) throw error;
              if (/^Callable argument \d+ type mismatch\.$/.test(error.message))
                rejectNode(node, 'PUI1006', error.message);
            }
          }
        }
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(fn.body);
}
