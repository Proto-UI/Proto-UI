import ts from 'typescript';
import type { ExpressionIR, ValueType } from './ir';
import {
  arrayElementType,
  objectFields,
  objectValueType,
  ordinaryArrayType,
  valueAlternatives,
  joinValueTypes,
} from './value-types';

export type ScalarConstant = { value: string | number | boolean | null | undefined };
export type StaticProperties = ReadonlyMap<string, ScalarConstant>;

/** Immutable scalar bindings retain their value without replaying their initializer. */
export function scalarConstant(value: ExpressionIR): ScalarConstant | undefined {
  if (value.kind === 'literal') return { value: value.value };
  if (value.kind === 'undefined') return { value: undefined };
  if (value.kind === 'narrow') return scalarConstant(value.value);
  if (value.kind === 'unary') {
    const operand = scalarConstant(value.operand);
    if (!operand) return;
    if (value.operator === '!') return { value: !operand.value };
    if (typeof operand.value !== 'number') return;
    return { value: value.operator === '-' ? -operand.value : operand.value };
  }
  if (value.kind === 'binary') {
    const left = scalarConstant(value.left);
    if (!left) return;
    if (value.operator === '??') return left.value == null ? scalarConstant(value.right) : left;
    if (value.operator === '&&') return left.value ? scalarConstant(value.right) : left;
    if (value.operator === '||') return left.value ? left : scalarConstant(value.right);
  }
  return;
}

function sourceScalar(node: ts.Expression): ScalarConstant | undefined {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node)
  )
    node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return { value: node.text };
  if (ts.isNumericLiteral(node)) return { value: Number(node.text) };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { value: null };
  // Identifiers need lexical resolution: even `undefined` may name a local
  // binding. Only syntax that is unconditionally a literal is folded here.
  return;
}

/** Only closed caller literals qualify. Spreads, aliases and computed keys stay dynamic. */
export function staticOptionProperties(
  type: ValueType,
  argument?: ts.Expression
): StaticProperties | undefined {
  if (argument)
    while (
      ts.isParenthesizedExpression(argument) ||
      ts.isAsExpression(argument) ||
      ts.isTypeAssertionExpression(argument)
    )
      argument = argument.expression;
  if (argument && !ts.isObjectLiteralExpression(argument)) return;
  const fields = valueAlternatives(type).flatMap((member) => objectFields(member) ?? []);
  if (!fields.length) return;
  const properties = new Map<string, ts.Expression | undefined>();
  if (argument && ts.isObjectLiteralExpression(argument))
    for (const property of argument.properties) {
      if (
        !property.name ||
        ts.isComputedPropertyName(property.name) ||
        ts.isSpreadAssignment(property)
      )
        return;
      const name =
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
          ? property.name.text
          : undefined;
      if (name === undefined || properties.has(name)) return;
      properties.set(name, ts.isPropertyAssignment(property) ? property.initializer : undefined);
    }
  const result = new Map<string, ScalarConstant>();
  for (const field of fields) {
    if (
      !valueAlternatives(field.type).every(
        (member) =>
          ['string', 'number', 'boolean', 'null', 'void'].includes(String(member)) ||
          (typeof member !== 'string' && member.kind === 'literal')
      )
    )
      continue;
    if (!properties.has(field.name)) {
      if (field.optional) result.set(field.name, { value: undefined });
    } else {
      const initializer = properties.get(field.name);
      const constant = initializer && sourceScalar(initializer);
      if (constant) result.set(field.name, constant);
    }
  }
  return result.size ? result : undefined;
}

/** No alias, mutation, or escape of the options object can invalidate a folded read. */
export function readsOnlyStaticOptions(
  body: ts.Node,
  parameter: string,
  properties: StaticProperties
): boolean {
  let safe = true;
  const visit = (node: ts.Node): void => {
    if (!safe) return;
    if (ts.isIdentifier(node) && node.text === parameter) {
      const parent = node.parent;
      if (!parent || !ts.isPropertyAccessExpression(parent) || parent.expression !== node) {
        safe = false;
        return;
      }
      if (properties.has(parent.name.text)) {
        const use = parent.parent;
        if (
          use &&
          ((ts.isBinaryExpression(use) &&
            use.left === parent &&
            use.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            use.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
            ts.isDeleteExpression(use) ||
            ts.isPostfixUnaryExpression(use) ||
            (ts.isPrefixUnaryExpression(use) &&
              [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(use.operator)))
        ) {
          safe = false;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return safe;
}

export function specializeOptionType(
  type: ValueType,
  properties: StaticProperties,
  present: boolean
): ValueType {
  return joinValueTypes(
    valueAlternatives(type)
      .filter((member) => !present || member !== 'void')
      .map((member) => {
        const fields = objectFields(member);
        if (!fields) return member;
        return objectValueType(
          fields.map((field) => {
            const constant = properties.get(field.name);
            if (!constant) return field;
            const specialized: ValueType =
              constant.value === undefined ? 'void' : { kind: 'literal', value: constant.value };
            return {
              ...field,
              type: specialized,
              ...(constant.value === undefined ? {} : { optional: false }),
            };
          })
        );
      })
  );
}

/**
 * A closed authored call supplies the concrete values hidden by generic/unknown
 * option slots. Retain that complete shape while rechecking the hook body;
 * concrete declarations and readonly permissions continue to constrain it.
 * This is not an assertion on an opaque runtime value: the caller expression,
 * every callback body, and the resulting invocation are independently checked.
 */
export function specializeHookOptionShape(declared: ValueType, actual: ValueType): ValueType {
  if (declared === 'unknown') return actual;
  const expectedFields = objectFields(declared),
    actualFields = objectFields(actual);
  if (expectedFields && actualFields) {
    const fields = expectedFields.map((field) => {
      const source = actualFields.find((candidate) => candidate.name === field.name);
      return source
        ? {
            ...field,
            type: specializeHookOptionShape(field.type, source.type),
            ...(source.readonly ? { readonly: true } : {}),
          }
        : field;
    });
    fields.push(
      ...actualFields.filter(
        (field) => !expectedFields.some((candidate) => candidate.name === field.name)
      )
    );
    const expectedIndex =
      typeof declared !== 'string' && declared.kind === 'object' ? declared.index : undefined;
    const actualIndex =
      typeof actual !== 'string' && actual.kind === 'object' ? actual.index : undefined;
    const index =
      expectedIndex === undefined
        ? actualIndex
        : actualIndex === undefined
          ? expectedIndex
          : specializeHookOptionShape(expectedIndex, actualIndex);
    return index === undefined ? objectValueType(fields) : { kind: 'object', fields, index };
  }
  const expectedElement = arrayElementType(declared),
    actualElement = arrayElementType(actual);
  if (
    expectedElement !== undefined &&
    actualElement !== undefined &&
    typeof declared !== 'string' &&
    typeof actual !== 'string'
  ) {
    const readonly =
      declared.kind === 'array' ||
      (declared.kind === 'value-array' && !!declared.readonly) ||
      actual.kind === 'array' ||
      (actual.kind === 'value-array' && !!actual.readonly);
    return ordinaryArrayType(specializeHookOptionShape(expectedElement, actualElement), readonly);
  }
  if (
    typeof declared !== 'string' &&
    declared.kind === 'callable' &&
    typeof actual !== 'string' &&
    actual.kind === 'callable'
  ) {
    return {
      ...declared,
      parameters: declared.parameters.map((parameter, index) => ({
        ...parameter,
        type: actual.parameters[index]
          ? specializeHookOptionShape(parameter.type, actual.parameters[index].type)
          : parameter.type,
      })),
      returnType: specializeHookOptionShape(declared.returnType, actual.returnType),
    };
  }
  return declared;
}
