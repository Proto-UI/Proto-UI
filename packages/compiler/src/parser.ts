import ts from 'typescript';
import { createHash } from 'node:crypto';
import { CompilerRejection } from './diagnostics';

import {
  OPERATION_RULES,
  PACKAGED_HOOKS,
  operationCallbackRule,
  operationArgumentRule,
  operationResultType,
  validateOperationArguments,
  validateOperationPhase,
  isTemplateChildType,
  capabilityMemberType,
  capabilityBinaryType,
  stateValue,
  FOCUS_OPTIONS_TYPE,
  type ArgumentRule,
  type CallbackContext,
  type OperationBindings,
  type OperationRule,
  type SemanticOperation,
} from './operations';
import {
  SourceGraph,
  identifier,
  propertyName,
  rejectNode,
  sourceName,
  sourceSpan,
  type FunctionNode,
  type SourceModule,
} from './parser-module';
import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';
import {
  inferBinaryType,
  inferUnaryType,
  memberDataType,
  conditionRefinements,
} from './expression-types';
import { extractContextKeyDeclaration, type ContextKeyIR } from './context-declarations';
import { parseSourceDataType } from './source-types';
import {
  extractStaticCapability,
  extractModuleDeclaration,
  tableStructureFamily,
} from './static-declarations';
import { extractRuleDeclaration, extractRuleStyleHandle } from './rule-declarations';
import { lowerRulePlan } from './rule-plan';
import type { StyleTokenHandle } from './style-plan';
import {
  IR_VERSION,
  isDataValueType,
  isPublicValueType,
  isCapabilityAssignable,
  type AuthoredHookIR,
  type CompileResult,
  type ExposureIR,
  type ExpressionIR,
  type FunctionContext,
  type FunctionIR,
  type Operation,
  type ParameterIR,
  type ParseOptions,
  type Phase,
  type PrimitiveType,
  type PropIR,
  type PrototypeIR,
  type StatementIR,
  type ValueType,
  type StaticCapabilityIR,
} from './ir';

interface Binding {
  type: ValueType;
  helper?: FunctionIR;
  phase?: Phase;
  keyId?: string;
  stateId?: string;
  style?: StyleTokenHandle;
}
type Scope = Map<string, Binding>;
const HOOKS: Readonly<Record<string, Operation>> = {
  asTrigger: 'hook.asTrigger',
  asFocusable: 'hook.asFocusable',
  asAccessible: 'hook.asAccessible',
  asFocusEntry: 'hook.asFocusEntry',
  asFocusScope: 'hook.asFocusScope',
  asFocusRoving: 'hook.asFocusRoving',
  asOverlay: 'hook.asOverlay',
  asScrollSurface: 'hook.asScrollSurface',
  asTextControl: 'hook.asTextControl',
  asImageView: 'hook.asImageView',
  asTableStructure: 'hook.asTableStructure',
  asBoundary: 'hook.asBoundary',
  asHitParticipation: 'hook.asHitParticipation',
  asCollection: 'hook.asCollection',
  asCollectionItem: 'hook.asCollectionItem',
};
const CAPABILITY_ANNOTATIONS: Readonly<Record<string, string>> = {
  def: 'DefHandle',
  run: 'RunHandle',
  render: 'RendererHandle',
  event: 'ProtoEventPayload',
};

function sameType(a: ValueType, b: ValueType): boolean {
  return a === b || (isDataValueType(a) && isDataValueType(b) && dataTypeEqual(a, b));
}
function assignable(actual: ValueType, expected: ValueType): boolean {
  return (
    sameType(actual, expected) ||
    (expected === 'template' && isTemplateChildType(actual)) ||
    isCapabilityAssignable(actual, expected) ||
    (isDataValueType(actual) && isDataValueType(expected) && isAssignable(actual, expected))
  );
}
function union(types: readonly ValueType[], node: ts.Node): ValueType {
  if (!types.length) return 'void';
  if (types.every((type) => sameType(type, types[0]))) return types[0];
  if (!types.every(isDataValueType) && types.every(isTemplateChildType)) return 'template';
  if (!types.every(isDataValueType))
    rejectNode(node, 'PUI1006', 'Branches return incompatible semantic capabilities.');
  return parseDataType({ kind: 'union', members: types });
}
class Frontend {
  readonly graph: SourceGraph;
  readonly hooks = new Map<string, AuthoredHookIR>();
  readonly props = new Map<string, PropIR>();
  private readonly propEnums = new Map<string, readonly string[]>();
  readonly exposes = new Map<string, ExposureIR>();
  readonly contextKeys = new Map<string, ContextKeyIR>();
  readonly staticDeclarations = new Map<string, StaticCapabilityIR>();
  readonly requirements = new Set<string>();
  readonly activeHooks = new Set<string>();
  readonly activeHelpers = new Set<string>();
  readonly usedFunctions = new Set<FunctionNode>();
  private readonly builtinHooks = new Set<Operation>();
  readonly eventKinds = new Map<string, 'void' | 'json' | 'any'>();
  readonly eventPayloads = new Map<string, DataType[]>();
  private context: FunctionContext = 'setup';
  private ruleSequence = 0;

  constructor(
    input: string,
    readonly options: ParseOptions
  ) {
    this.graph = new SourceGraph(input, options);
  }

  private helperPhase(module: SourceModule, node: FunctionNode, scope: Scope): Phase {
    let phase: Phase = 'callback';
    const inspect = (part: ts.Node): void => {
      if (part !== node && ts.isFunctionLike(part)) return;
      if (ts.isCallExpression(part)) {
        if (ts.isIdentifier(part.expression) && module.imports.has(part.expression.text)) {
          const imported = this.graph.resolveBinding(module, part.expression.text);
          if (
            imported.module === null &&
            (imported.imported.module === '@proto.ui/hooks' ||
              Object.hasOwn(PACKAGED_HOOKS, imported.imported.module))
          )
            phase = 'setup';
        } else if (ts.isPropertyAccessExpression(part.expression)) {
          const paths: string[] = [];
          let root: ts.Expression = part.expression;
          while (ts.isPropertyAccessExpression(root)) {
            paths.unshift(root.name.text);
            root = root.expression;
          }
          if (ts.isIdentifier(root)) {
            const receiver = scope.get(root.text)?.type;
            const rule = Object.values(OPERATION_RULES).find(
              (rule) => rule.receiver === receiver && rule.path === paths.join('.')
            );
            if (rule?.phases.length === 1) phase = rule.phases[0];
          }
        }
      }
      ts.forEachChild(part, inspect);
    };
    if (node.body) inspect(node.body);
    return phase;
  }

  private checkedData(node: ts.Node, action: () => DataType): DataType {
    try {
      return action();
    } catch (error) {
      if (error instanceof TypeError) rejectNode(node, 'PUI1006', error.message);
      throw error;
    }
  }

  private parameterType(
    module: SourceModule,
    parameter: ts.ParameterDeclaration,
    expected?: ValueType,
    body?: ts.ConciseBody
  ): ValueType {
    if (parameter.type) {
      if (ts.isTypeReferenceNode(parameter.type) && ts.isIdentifier(parameter.type.typeName)) {
        const name = parameter.type.typeName.text;
        if (name === 'FocusRequestOptions') return FOCUS_OPTIONS_TYPE;
        if (expected && typeof expected === 'string' && CAPABILITY_ANNOTATIONS[expected] === name)
          return expected;
      }
      return parseSourceDataType(module, parameter.type);
    }
    if (expected !== undefined && expected !== 'unknown') return expected;
    // Constraint from the public focus request signature, not from a component/key name.
    let focusOptions = false;
    const name = ts.isIdentifier(parameter.name) ? parameter.name.text : '';
    const inspect = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'focusSelf' &&
        node.arguments.some((arg) => ts.isIdentifier(arg) && arg.text === name)
      )
        focusOptions = true;
      ts.forEachChild(node, inspect);
    };
    if (body) inspect(body);
    if (focusOptions) return FOCUS_OPTIONS_TYPE;
    rejectNode(
      parameter,
      'PUI1006',
      'A data parameter needs an explicit serializable type annotation.'
    );
  }

  function(
    module: SourceModule,
    node: FunctionNode,
    outer: Scope,
    phase: Phase,
    expected: readonly ValueType[] = [],
    context: FunctionContext = phase === 'callback' ? 'helper' : phase
  ): FunctionIR {
    if (
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
      !node.body ||
      ('asteriskToken' in node && node.asteriskToken)
    )
      rejectNode(node, 'PUI1004', 'Async/generator/external functions are unsupported.');
    this.usedFunctions.add(node);
    const previousContext = this.context;
    this.context = context;
    try {
      const scope = new Map(outer);
      const names = new Set<string>();
      const parameters: ParameterIR[] = node.parameters.map((parameter, index) => {
        if (parameter.dotDotDotToken || parameter.initializer)
          rejectNode(parameter, 'PUI1004', 'Rest and default callback parameters are unsupported.');
        const name = identifier(parameter.name);
        if (names.has(name)) rejectNode(parameter, 'PUI1005', `Duplicate parameter ${name}.`);
        names.add(name);
        const type = this.parameterType(module, parameter, expected[index], node.body);
        const optional =
          !!parameter.questionToken ||
          (!parameter.type && isDataValueType(type) && dataTypeEqual(type, FOCUS_OPTIONS_TYPE));
        scope.set(name, {
          type: optional && isDataValueType(type) ? union([type, 'void'], parameter) : type,
        });
        return { name, type, ...(optional ? { optional: true } : {}) };
      });
      if (
        context === 'setup' &&
        (parameters.length > 1 || (parameters.length === 1 && parameters[0].type !== 'def'))
      )
        rejectNode(node, 'PUI1006', 'Setup accepts at most one definition handle parameter.');
      const body = ts.isBlock(node.body)
        ? this.statements(module, node.body.statements, scope, phase)
        : [
            {
              kind: 'return' as const,
              value: this.expression(module, node.body, scope, phase),
              span: sourceSpan(node.body),
            },
          ];
      const returns: ValueType[] = [];
      const gather = (items: readonly StatementIR[]): boolean => {
        for (const statement of items) {
          if (statement.kind === 'return') {
            returns.push(statement.value?.type ?? 'void');
            return true;
          }
          if (statement.kind === 'if') {
            const a = gather(statement.then),
              b = gather(statement.otherwise);
            if (a && b) return true;
          }
        }
        return false;
      };
      if (!gather(body)) returns.push('void');
      let returnType = union(returns, node);
      if (node.type) {
        const declared = parseSourceDataType(module, node.type);
        if (!assignable(returnType, declared))
          rejectNode(node.type, 'PUI1006', 'Function return does not satisfy its declared type.');
        returnType = declared;
      }
      return { parameters, body, phase, context, returnType, span: sourceSpan(node) };
    } finally {
      this.context = previousContext;
    }
  }

  statements(
    module: SourceModule,
    nodes: readonly ts.Statement[],
    scope: Scope,
    phase: Phase
  ): StatementIR[] {
    const output: StatementIR[] = [];
    for (const node of nodes) {
      const span = sourceSpan(node);
      if (ts.isVariableStatement(node)) {
        if (!(node.declarationList.flags & ts.NodeFlags.Const))
          rejectNode(
            node,
            'PUI1004',
            'Use immutable lexical bindings and governed State for mutable facts.'
          );
        for (const declaration of node.declarationList.declarations) {
          const name = identifier(declaration.name);
          if (scope.has(name) || module.imports.has(name))
            rejectNode(declaration, 'PUI1005', `Shadowing/rebinding ${name} is not admitted.`);
          if (!declaration.initializer)
            rejectNode(declaration, 'PUI1004', 'Binding requires a value.');
          const init = declaration.initializer;
          let value: ExpressionIR;
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            this.activeHelpers.add(name);
            scope.set(name, { type: 'function', phase: 'callback' });
            const fn = this.function(
              module,
              init,
              scope,
              this.helperPhase(module, init, scope),
              [],
              'helper'
            );
            this.activeHelpers.delete(name);
            scope.set(name, { type: 'function', helper: fn, phase: fn.phase });
            value = { kind: 'function', type: 'function', function: fn, span: sourceSpan(init) };
          } else {
            value = this.expression(module, init, scope, phase);
            const alias = value.kind === 'reference' ? scope.get(value.name) : undefined;
            const stateId =
              value.kind === 'operation' &&
              value.operation.startsWith('state.') &&
              OPERATION_RULES[value.operation].receiver === 'def' &&
              value.arguments[0]?.kind === 'literal'
                ? String(value.arguments[0].value)
                : stateValue(value.type) && value.kind === 'member'
                  ? `#observed:${value.span.file}:${value.span.start}`
                  : alias?.stateId;
            scope.set(name, {
              ...alias,
              type: value.type,
              stateId,
              ...(value.kind === 'context-key' ? { keyId: value.keyId } : {}),
              ...(value.kind === 'style-handle' ? { style: value.handle } : {}),
            });
          }
          output.push({ kind: 'const', name, value, span: sourceSpan(declaration) });
        }
      } else if (ts.isExpressionStatement(node))
        output.push({
          kind: 'effect',
          expression: this.expression(module, node.expression, scope, phase),
          span,
        });
      else if (ts.isIfStatement(node)) {
        const condition = this.expression(module, node.expression, scope, phase);
        const branch = (truth: boolean): Scope => {
          const next = new Map(scope);
          for (const [name, type] of conditionRefinements(condition, truth))
            if (next.has(name)) next.set(name, { ...next.get(name)!, type });
          return next;
        };
        const thenScope = branch(true),
          elseScope = branch(false);
        const then = this.statements(
          module,
          ts.isBlock(node.thenStatement) ? node.thenStatement.statements : [node.thenStatement],
          thenScope,
          phase
        );
        const otherwise = node.elseStatement
          ? this.statements(
              module,
              ts.isBlock(node.elseStatement) ? node.elseStatement.statements : [node.elseStatement],
              elseScope,
              phase
            )
          : [];
        output.push({ kind: 'if', condition, then, otherwise, span });
        const terminal = (items: readonly StatementIR[]): boolean =>
          items.some(
            (item) =>
              item.kind === 'return' ||
              (item.kind === 'if' && terminal(item.then) && terminal(item.otherwise))
          );
        const continuing = terminal(then) ? elseScope : terminal(otherwise) ? thenScope : undefined;
        if (continuing) for (const name of scope.keys()) scope.set(name, continuing.get(name)!);
      } else if (ts.isReturnStatement(node)) {
        if (!node.expression) output.push({ kind: 'return', span });
        else if (
          phase === 'setup' &&
          (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression))
        ) {
          const fn = this.function(module, node.expression, scope, 'render', ['render']);
          output.push({
            kind: 'return',
            value: {
              kind: 'function',
              type: 'function',
              function: fn,
              span: sourceSpan(node.expression),
            },
            span,
          });
        } else
          output.push({
            kind: 'return',
            value: this.expression(module, node.expression, scope, phase),
            span,
          });
      } else if (!ts.isEmptyStatement(node))
        rejectNode(node, 'PUI1004', `Unsupported ${ts.SyntaxKind[node.kind]} statement.`);
    }
    return output;
  }

  private key(module: SourceModule, name: string, node: ts.Node): ExpressionIR {
    const declaration = extractStaticCapability(module, name);
    if (declaration) {
      this.staticDeclarations.set(declaration.id, declaration);
      return {
        kind: 'static-capability',
        declarationId: declaration.id,
        type: declaration.kind,
        span: sourceSpan(node),
      };
    }
    const key = extractContextKeyDeclaration(module, name);
    this.contextKeys.set(key.id, key);
    return { kind: 'context-key', keyId: key.id, type: 'context-key', span: sourceSpan(node) };
  }

  expression(
    module: SourceModule,
    node: ts.Expression,
    scope: Scope,
    phase: Phase,
    argumentRule?: ArgumentRule
  ): ExpressionIR {
    if (ts.isParenthesizedExpression(node))
      return this.expression(module, node.expression, scope, phase, argumentRule);
    const span = sourceSpan(node);
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
      return {
        kind: 'literal',
        value: node.kind === ts.SyntaxKind.TrueKeyword,
        type: 'boolean',
        span,
      };
    if (node.kind === ts.SyntaxKind.NullKeyword)
      return { kind: 'literal', value: null, type: 'null', span };
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return { kind: 'literal', value: node.text, type: 'string', span };
    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text);
      if (!Number.isFinite(value)) rejectNode(node, 'PUI1006', 'Numeric literals must be finite.');
      return { kind: 'literal', value, type: 'number', span };
    }
    if (ts.isIdentifier(node)) {
      const binding = scope.get(node.text);
      if (binding)
        return binding.keyId
          ? { kind: 'context-key', keyId: binding.keyId, type: 'context-key', span }
          : { kind: 'reference', name: node.text, type: binding.type, span };
      if (module.declarations.has(node.text) || module.imports.has(node.text)) {
        const resolved = this.graph.resolveBinding(module, node.text);
        if (
          resolved.module &&
          ts.isCallExpression(resolved.node) &&
          ts.isIdentifier(resolved.node.expression) &&
          this.graph.resolveCoreImport(resolved.module, resolved.node.expression.text) === 'tw'
        )
          return {
            kind: 'style-handle',
            handle: extractRuleStyleHandle(module, node),
            type: 'style-handle',
            span,
          };
        return this.key(module, node.text, node);
      }
      rejectNode(
        node,
        'PUI1005',
        `Unresolved capture ${node.text}; only declared lexical values and semantic handles are admitted.`
      );
    }
    if (ts.isArrayLiteralExpression(node)) {
      const elements = node.elements.map((element) =>
        this.expression(module, element, scope, phase)
      );
      const elementTypes = elements.map((element) => element.type);
      if (!elementTypes.every(isDataValueType)) {
        if (elementTypes.every((type) => type === 'a11y-ref'))
          return { kind: 'array', type: 'a11y-ref-list', elements, span };
        if (elementTypes.every(isTemplateChildType))
          return { kind: 'array', type: 'array', elements, span };
        rejectNode(node, 'PUI1006', 'Arrays cannot leak semantic handles into data.');
      }
      return {
        kind: 'array',
        type: { kind: 'array', element: parseDataType({ kind: 'union', members: elementTypes }) },
        elements,
        span,
      };
    }
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      const entries = node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property))
          rejectNode(property, 'PUI1004', 'Object spread and methods are unsupported.');
        const key = propertyName(property.name);
        if (keys.has(key)) rejectNode(property, 'PUI1006', `Duplicate object key ${key}.`);
        keys.add(key);
        const initializer = ts.isPropertyAssignment(property)
          ? property.initializer
          : property.name;
        const field = argumentRule?.fields?.[key];
        if (
          field?.callback &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          const callback = field.callback;
          const fn = this.function(
            module,
            initializer,
            scope,
            callback.phase,
            callback.parameters,
            callback.context
          );
          return {
            key,
            value: {
              kind: 'function',
              type: 'function',
              function: fn,
              span: sourceSpan(initializer),
            } as ExpressionIR,
          };
        }
        return { key, value: this.expression(module, initializer, scope, phase, field) };
      });
      if (entries.some((entry) => !isDataValueType(entry.value.type))) {
        if (
          phase === 'render' &&
          entries.length === 1 &&
          entries[0].key === 'style' &&
          entries[0].value.type === 'style-handle'
        )
          return { kind: 'record', type: 'template-props', entries, span };
        if (
          entries.some(
            (entry) =>
              ['def', 'run', 'render'].includes(String(entry.value.type)) ||
              (entry.value.type === 'function' && !argumentRule?.fields?.[entry.key]?.callback)
          )
        )
          rejectNode(
            node,
            'PUI1006',
            'Configuration records cannot capture execution-scope handles or escaping callbacks.'
          );
        return { kind: 'record', type: 'module-config', entries, span };
      }
      return {
        kind: 'record',
        type: {
          kind: 'record',
          fields: entries.map((entry) => ({ name: entry.key, type: entry.value.type as DataType })),
        },
        entries,
        span,
      };
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const operator = ts.tokenToString(node.operator);
      if (operator !== '!' && operator !== '-' && operator !== '+')
        rejectNode(node, 'PUI1004', 'Mutation unary operators are unsupported.');
      const operand = this.expression(module, node.operand, scope, phase);
      if (operator === '!' && !isDataValueType(operand.type))
        return { kind: 'unary', operator, operand, type: 'boolean', span };
      if (!isDataValueType(operand.type))
        rejectNode(node, 'PUI1006', 'Unary operators require data values.');
      const type = this.checkedData(node, () => inferUnaryType(operator, operand.type as DataType));
      return { kind: 'unary', operator, operand, type, span };
    }
    if (ts.isBinaryExpression(node)) {
      const operator = ts.tokenToString(node.operatorToken.kind) ?? '';
      const left = this.expression(module, node.left, scope, phase),
        right = this.expression(module, node.right, scope, phase);
      const capabilityType = capabilityBinaryType(operator, left.type, right.type);
      if (capabilityType)
        return { kind: 'binary', operator: '??', left, right, type: capabilityType, span };
      if (
        (operator === '===' || operator === '!==') &&
        (!isDataValueType(left.type) || !isDataValueType(right.type))
      )
        return { kind: 'binary', operator, left, right, type: 'boolean', span };
      if (!isDataValueType(left.type) || !isDataValueType(right.type))
        rejectNode(node, 'PUI1006', 'Binary operators require data values.');
      const type = this.checkedData(node, () =>
        inferBinaryType(operator, left.type as DataType, right.type as DataType)
      );
      return {
        kind: 'binary',
        operator: operator as Extract<ExpressionIR, { kind: 'binary' }>['operator'],
        left,
        right,
        type,
        span,
      };
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (
        ts.isElementAccessExpression(node) &&
        !ts.isStringLiteral(node.argumentExpression) &&
        !ts.isNumericLiteral(node.argumentExpression)
      )
        rejectNode(node, 'PUI1004', 'Member access requires a checked static string or index.');
      const property = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : (node.argumentExpression as ts.StringLiteral | ts.NumericLiteral).text;
      const object = this.expression(module, node.expression, scope, phase);
      const optional = ts.isPropertyAccessChain(node) || ts.isElementAccessChain(node);
      let type: ValueType;
      const capabilityType = capabilityMemberType(object.type, property, optional);
      if (capabilityType !== undefined) type = capabilityType;
      else if (object.type === 'props') {
        const prop = this.props.get(property);
        if (!prop) rejectNode(node, 'PUI1006', `Read of undeclared prop ${property}.`);
        type = prop.type;
      } else if (object.type === 'event' && ['key', 'type', 'control'].includes(property))
        type =
          property === 'control'
            ? 'event'
            : property === 'type'
              ? 'string'
              : parseDataType({ kind: 'union', members: ['string', 'void'] });
      else if (
        object.type === 'event' &&
        ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'repeat'].includes(property)
      )
        type = parseDataType({ kind: 'union', members: ['boolean', 'void'] });
      else if (isDataValueType(object.type))
        type = this.checkedData(node, () =>
          memberDataType(object.type as DataType, property, { optional })
        );
      else rejectNode(node, 'PUI1004', `Unsupported member ${property} on ${String(object.type)}.`);
      return { kind: 'member', object, property, optional, type, span };
    }
    if (ts.isCallExpression(node)) return this.call(module, node, scope, phase);
    rejectNode(
      node,
      'PUI1004',
      `Unsupported expression ${ts.SyntaxKind[node.kind]}; no input code is executed.`
    );
  }

  private contextType(expression?: ExpressionIR): DataType | undefined {
    return expression?.kind === 'context-key'
      ? this.contextKeys.get(expression.keyId)?.type
      : undefined;
  }

  private enforceHelperContext(fn: FunctionIR, origin: FunctionContext, phase: Phase): void {
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(inspect);
        return;
      }
      const record = value as Record<string, unknown>;
      if (record.kind === 'function' && (record.function as FunctionIR).context !== 'helper')
        return;
      if (record.kind === 'operation') {
        const issues = validateOperationPhase(
          String(record.operation),
          phase,
          phase === 'callback' ? (origin as CallbackContext) : undefined
        );
        if (issues.length)
          throw new CompilerRejection({
            code: 'PUI1007',
            category: 'unsupported-input',
            message: issues[0].message,
            span: record.span as FunctionIR['span'],
          });
      }
      for (const [key, child] of Object.entries(record))
        if (key !== 'span' && key !== 'type') inspect(child);
    };
    inspect(fn.body);
  }

  call(module: SourceModule, node: ts.CallExpression, scope: Scope, phase: Phase): ExpressionIR {
    if (node.questionDotToken) rejectNode(node, 'PUI1004', 'Optional calls are unsupported.');
    const span = sourceSpan(node);
    let operation: SemanticOperation | undefined, receiver: ExpressionIR | undefined;
    if (ts.isIdentifier(node.expression)) {
      const name = node.expression.text,
        binding = scope.get(name);
      if (binding) {
        if (
          [
            'style-disposer',
            'subscription-disposer',
            'binding-disposer',
            'transition-action',
          ].includes(String(binding.type))
        ) {
          const release: SemanticOperation =
            binding.type === 'style-disposer'
              ? 'feedback.style.release'
              : binding.type === 'subscription-disposer'
                ? 'subscription.release'
                : binding.type === 'binding-disposer'
                  ? 'binding.release'
                  : 'transitionAction.call';
          const arguments_ = node.arguments.map((argument) =>
            this.expression(module, argument, scope, phase)
          );
          const issues = [
            ...validateOperationPhase(
              release,
              phase,
              phase === 'callback' ? (this.context as CallbackContext) : undefined
            ),
            ...validateOperationArguments(release, arguments_, binding.type),
          ];
          if (issues.length) rejectNode(node, 'PUI1007', issues[0].message);
          this.requirements.add(release.split('.')[0]);
          return {
            kind: 'operation',
            operation: release,
            receiver: this.expression(module, node.expression, scope, phase),
            arguments: arguments_,
            type: 'void',
            span,
          };
        }
        if (this.activeHelpers.has(name))
          rejectNode(node, 'PUI1008', `Recursive helper ${name} is unsupported.`);
        if (!binding.helper || binding.type !== 'function')
          rejectNode(node, 'PUI1004', `Calling ${name} is not an admitted static helper.`);
        const args = node.arguments.map((argument) =>
          this.expression(module, argument, scope, phase)
        );
        const required = binding.helper.parameters.filter(
          (parameter) => !parameter.optional
        ).length;
        if (args.length < required || args.length > binding.helper.parameters.length)
          rejectNode(node, 'PUI1006', `Helper ${name} argument count mismatch.`);
        args.forEach((argument, index) => {
          if (!assignable(argument.type, binding.helper!.parameters[index].type))
            rejectNode(node.arguments[index], 'PUI1006', 'Helper argument type mismatch.');
        });
        if (this.context !== 'helper')
          this.enforceHelperContext(binding.helper, this.context, phase);
        return {
          kind: 'helper-call',
          name,
          arguments: args,
          type: binding.helper.returnType,
          span,
        };
      }
      if (!module.imports.has(name) && !module.declarations.has(name))
        rejectNode(node, 'PUI1004', `Unadmitted call ${name}.`);
      const resolved = this.graph.resolveBinding(module, name);
      if (
        resolved.module === null &&
        resolved.imported.module === '@proto.ui/core' &&
        resolved.name === 'tw'
      )
        return {
          kind: 'style-handle',
          handle: extractRuleStyleHandle(module, node),
          type: 'style-handle',
          span,
        };
      if (resolved.module === null && resolved.imported.module === '@proto.ui/hooks')
        operation = HOOKS[resolved.name] as SemanticOperation;
      else if (resolved.module === null && Object.hasOwn(PACKAGED_HOOKS, resolved.imported.module))
        operation = PACKAGED_HOOKS[resolved.imported.module][resolved.name];
      else if (resolved.module !== null && ts.isCallExpression(resolved.node)) {
        if (phase !== 'setup' || node.arguments.length)
          rejectNode(node, 'PUI1007', 'Authored hooks require a static no-argument setup call.');
        if (
          !ts.isIdentifier(resolved.node.expression) ||
          this.graph.resolveCoreImport(resolved.module, resolved.node.expression.text) !==
            'defineAsHook'
        )
          rejectNode(node, 'PUI1004', 'Only static authored-hook source calls are admitted.');
        const definition = { module: resolved.module, node: resolved.node };
        const id = `${definition.module.file.fileName}#${resolved.name}`;
        if (this.activeHooks.has(id))
          rejectNode(node, 'PUI1008', 'Recursive authored-hook composition.');
        if (!this.hooks.has(id)) {
          this.activeHooks.add(id);
          const descriptor = this.graph.descriptor(definition.module, definition.node);
          const setup = this.function(definition.module, descriptor.setup, new Map(), 'setup', [
            'def',
          ]);
          this.hooks.set(id, { id, name: descriptor.name, setup, span: descriptor.span });
          this.activeHooks.delete(id);
        }
        this.requirements.add('authored-hook');
        return { kind: 'authored-hook', hookId: id, type: 'void', span };
      } else rejectNode(node, 'PUI1004', `Unadmitted call ${name}.`);
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      // Resolve the public path against the single operation table, including renderer.read.*.
      const paths: string[] = [];
      let root: ts.Expression = node.expression;
      while (ts.isPropertyAccessExpression(root)) {
        paths.unshift(root.name.text);
        root = root.expression;
      }
      if (ts.isIdentifier(root) && scope.has(root.text)) {
        const value = scope.get(root.text)!;
        const fullPath = paths.join('.');
        const family = stateValue(value.type) ? 'state:boolean' : value.type;
        const match = Object.entries(OPERATION_RULES).find(
          ([, rule]) => rule.path === fullPath && sameType(rule.receiver, family)
        );
        if (match) {
          operation = match[0] as SemanticOperation;
          receiver = this.expression(module, root, scope, phase);
        }
      }
      if (!operation) {
        receiver = this.expression(module, node.expression.expression, scope, phase);
        const family = stateValue(receiver.type) ? 'state:boolean' : receiver.type;
        const path = node.expression.name.text;
        const match = Object.entries(OPERATION_RULES).find(
          ([, rule]) => rule.path === path && sameType(rule.receiver, family)
        );
        if (match) operation = match[0] as SemanticOperation;
      }
    }
    if (!operation)
      rejectNode(node, 'PUI1004', 'Call is outside the supported semantic operation set.');
    const rule: OperationRule = OPERATION_RULES[operation];
    const phaseIssues = validateOperationPhase(
      operation,
      phase,
      this.context === 'setup' || this.context === 'render' ? undefined : this.context
    );
    if (
      phaseIssues.length &&
      !(this.context === 'helper' && phaseIssues.every((issue) => issue.code === 'context'))
    )
      rejectNode(node, 'PUI1007', phaseIssues[0].message);
    if (node.arguments.length < rule.min || node.arguments.length > rule.max)
      rejectNode(node, 'PUI1006', `Invalid argument count for ${operation}.`);
    this.requirements.add(operation.split('.')[0]);
    if (operation === 'rule.declare') {
      if (node.arguments.length !== 1 || !ts.isObjectLiteralExpression(node.arguments[0]))
        rejectNode(node, 'PUI1024', 'Rules require one statically checked declaration.');
      const states = new Map<string, ExpressionIR>();
      const declaration = extractRuleDeclaration(node.arguments[0], {
        id: ++this.ruleSequence,
        order: this.ruleSequence - 1,
        props: new Map([...this.props].map(([key, value]) => [key, value.type])),
        resolveState: (expression) => {
          if (!ts.isIdentifier(expression)) return undefined;
          const binding = scope.get(expression.text);
          if (!binding?.stateId || !stateValue(binding.type)) return undefined;
          const value = this.expression(module, expression, scope, phase);
          states.set(binding.stateId, value);
          return { id: binding.stateId, type: stateValue(binding.type)! };
        },
        resolveStyle: (expression) =>
          ts.isIdentifier(expression) && scope.get(expression.text)?.style
            ? scope.get(expression.text)!.style
            : extractRuleStyleHandle(module, expression),
      });
      const plan = lowerRulePlan([declaration], span);
      if (!plan.ok) throw new CompilerRejection(plan.diagnostics[0]);
      return {
        kind: 'rule',
        declaration,
        receiver: receiver!,
        states: [...states].map(([id, value]) => ({ id, value })),
        type: 'rule-handle',
        span,
      };
    }
    const bindings: OperationBindings = {
      propNames: new Set(this.props.keys()),
      stateValueType: stateValue(receiver?.type),
      ...(phase === 'callback' ? { callbackContext: this.context as CallbackContext } : {}),
    };
    const args: ExpressionIR[] = [];
    for (const [index, argument] of node.arguments.entries()) {
      const callback = operationCallbackRule(operation, index);
      if (
        callback &&
        (!callback.acceptsValue ||
          ts.isArrowFunction(argument) ||
          ts.isFunctionExpression(argument))
      ) {
        if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument))
          rejectNode(argument, 'PUI1005', 'Registration requires an inline checked callback.');
        let expected = callback.parameters;
        if (
          callback.parameterPolicy === 'context-value' ||
          callback.parameterPolicy === 'nullable-context-value'
        ) {
          const value = bindings.contextValueType;
          if (!value) rejectNode(argument, 'PUI1006', 'Context key type must be resolved.');
          const item =
            callback.parameterPolicy === 'nullable-context-value'
              ? union([value, 'null'], argument)
              : value;
          expected = ['run', item, item];
        } else if (callback.parameterPolicy === 'context-updater')
          expected = [bindings.contextValueType!];
        else if (callback.parameterPolicy === 'input-payload')
          expected = ['run', bindings.inputPayloadType!];
        else if (callback.parameterPolicy === 'state-value') {
          if (!bindings.stateValueType)
            rejectNode(
              argument,
              'PUI1006',
              'State watcher needs an Observed or Borrowed primitive State.'
            );
          expected = ['run', `state-event:${bindings.stateValueType}`];
        }
        const context = callback.contextFrom === 'caller' ? this.context : callback.context;
        const fn = this.function(module, argument, scope, callback.phase, expected, context);
        if (callback.parameterPolicy === 'declared-method') {
          bindings.methodParameters = fn.parameters;
          bindings.methodReturnType = fn.returnType;
        }
        args.push({ kind: 'function', type: 'function', function: fn, span: sourceSpan(argument) });
      } else
        args.push(
          this.expression(module, argument, scope, phase, operationArgumentRule(operation, index))
        );
      if (index === 0) {
        bindings.contextValueType = this.contextType(args[0]);
        if (operation === 'event.on' || operation === 'event.onGlobal') {
          const type = this.literalString(args[0], argument);
          bindings.inputPayloadType = type.startsWith('host:') ? 'host-event' : 'event';
        }
        if (operation === 'expose.emit') {
          const name = this.literalString(args[0], argument);
          const exposure = this.exposes.get(name);
          if (!exposure || exposure.kind !== 'event')
            rejectNode(argument, 'PUI1006', `Emit requires a declared outward event ${name}.`);
          bindings.eventPayloadType = exposure.payload;
        }
      }
    }
    if (operation === 'expose.emit') {
      const name = this.literalString(args[0], node.arguments[0]);
      const kind = this.eventKinds.get(name)!;
      const payload = args[1]?.type ?? 'void';
      if (
        !isDataValueType(payload) ||
        (kind === 'void' && payload !== 'void') ||
        (kind === 'json' && payload === 'void')
      )
        rejectNode(node, 'PUI1006', 'Outward payload does not match its declared data boundary.');
      this.eventPayloads.get(name)!.push(payload);
      bindings.eventPayloadType = kind === 'void' ? 'void' : payload;
    }
    const issues = validateOperationArguments(operation, args, receiver?.type, bindings);
    if (issues.length)
      rejectNode(
        node.arguments[issues[0].argument ?? -1] ?? node,
        issues[0].code.includes('context') ? 'PUI1007' : 'PUI1006',
        issues[0].message
      );
    this.metadata(operation, node, args, receiver);
    const type = operationResultType(operation, receiver?.type, bindings);
    if (type === undefined)
      rejectNode(node, 'PUI1006', 'Semantic result type could not be resolved.');
    return {
      kind: 'operation',
      operation,
      ...(receiver ? { receiver } : {}),
      arguments: args,
      type,
      span,
    };
  }

  metadata(
    operation: Operation,
    node: ts.CallExpression,
    args: ExpressionIR[],
    receiver?: ExpressionIR
  ): void {
    const span = sourceSpan(node);
    if (operation === 'hook.asTableStructure') {
      const family = tableStructureFamily(span);
      if (!this.staticDeclarations.has(family.id)) this.staticDeclarations.set(family.id, family);
    }
    if (operation === 'hook.asTransition' && !this.builtinHooks.has(operation)) {
      this.builtinHooks.add(operation);
      for (const [name, type] of Object.entries({
        open: 'boolean',
        defaultOpen: 'boolean',
        appear: 'boolean',
        enterDuration: 'number',
        leaveDuration: 'number',
        interrupt: 'string',
      })) {
        const prior = this.props.get(name);
        if (prior && !sameType(prior.type, type as DataType))
          rejectNode(
            node,
            'PUI1006',
            `Transition prop ${name} conflicts with the existing schema.`
          );
        this.props.set(name, { name, type: type as DataType, span });
      }
      for (const name of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave']) {
        this.exposes.set(name, { name, kind: 'event', payload: 'void', span });
        this.eventKinds.set(name, 'void');
        this.eventPayloads.set(name, []);
      }
      this.exposes.set('transitionState', {
        name: 'transitionState',
        kind: 'state',
        type: 'string',
        span,
      });
      this.exposes.set('isPresent', { name: 'isPresent', kind: 'state', type: 'boolean', span });
      for (const name of ['enter', 'leave', 'complete'])
        this.exposes.set(name, { name, kind: 'method', parameters: [], returnType: 'void', span });
      this.exposes.set('controls', {
        name: 'controls',
        kind: 'value',
        type: 'transition-controls',
        span,
      });
    }
    if (operation === 'collection.configure' || operation === 'collectionItem.configure') {
      if (args[0].kind !== 'record')
        rejectNode(
          node,
          'PUI1006',
          'Collection configuration requires a checked literal record so its public interface is explicit.'
        );
      const name = (key: string, fallback: string): string => {
        const value =
          args[0].kind === 'record'
            ? args[0].entries.find((entry) => entry.key === key)?.value
            : undefined;
        return value ? this.literalString(value, node) : fallback;
      };
      const exposeState = (key: string, fallback: string, type: PrimitiveType) => {
        const resolved = name(key, fallback);
        this.exposes.set(resolved, { name: resolved, kind: 'state', type, span });
      };
      const exposeMethod = (key: string, fallback: string, returnType: ValueType) => {
        const resolved = name(key, fallback);
        this.exposes.set(resolved, {
          name: resolved,
          kind: 'method',
          parameters: [],
          returnType,
          span,
        });
      };
      if (operation === 'collection.configure') {
        exposeState('exposeCountStateKey', 'count', 'number');
        exposeMethod('exposeItemsMethodKey', 'getCollectionItems', 'collection-snapshot-list');
        exposeMethod('exposeCountMethodKey', 'getCollectionCount', 'number');
      } else {
        exposeState('exposeIndexStateKey', 'collectionIndex', 'number');
        exposeState('exposeTotalStateKey', 'collectionTotal', 'number');
        exposeState('exposeFirstStateKey', 'collectionFirst', 'boolean');
        exposeState('exposeLastStateKey', 'collectionLast', 'boolean');
        exposeMethod('exposeSnapshotMethodKey', 'getCollectionItem', 'collection-snapshot');
        exposeMethod('metaExposeKey', '__collectionItem', 'collection-snapshot');
      }
    }
    if (operation === 'props.define') {
      if (args[0].kind !== 'record')
        rejectNode(node, 'PUI1006', 'Props declarations must be literal records.');
      for (const entry of args[0].entries) {
        if (entry.value.kind !== 'record')
          rejectNode(node, 'PUI1006', 'Prop schema must be a literal record.');
        const item = entry.value.entries.find((value) => value.key === 'type');
        const declared = item?.value.kind === 'literal' ? item.value.value : undefined;
        let type: PrimitiveType;
        let enumOptions: readonly string[] | undefined;
        if (declared === 'enum') {
          const options = entry.value.entries.find((value) => value.key === 'options')?.value;
          if (
            options?.kind !== 'array' ||
            !options.elements.length ||
            options.elements.some(
              (option) => option.kind !== 'literal' || typeof option.value !== 'string'
            )
          )
            rejectNode(node, 'PUI1006', `Enum prop ${entry.key} requires literal string options.`);
          // Like State enums, the portable value is a string. The authored options
          // remain on each declaration and are enforced by the owned Props plan.
          // A later widening must not invalidate an earlier callback's value type.
          type = 'string';
          enumOptions = options.elements.map(
            (option) => (option as ExpressionIR & { kind: 'literal'; value: string }).value
          );
        } else if (declared === 'boolean' || declared === 'number' || declared === 'string')
          type = declared;
        else
          rejectNode(
            node,
            'PUI1006',
            'Only primitive and string enum prop domains are currently admitted.'
          );
        const prior = this.props.get(entry.key);
        const previousOptions = this.propEnums.get(entry.key);
        if (
          prior &&
          (!sameType(prior.type, type) ||
            Boolean(previousOptions) !== Boolean(enumOptions) ||
            previousOptions?.some((option) => !enumOptions!.includes(option)))
        )
          rejectNode(node, 'PUI1006', `Conflicting or narrowed prop domain ${entry.key}.`);
        if (enumOptions) this.propEnums.set(entry.key, enumOptions);
        this.props.set(entry.key, { name: entry.key, type, span: entry.value.span });
      }
    }
    if (
      operation === 'expose.state' ||
      operation === 'expose.event' ||
      operation === 'expose.method' ||
      operation === 'expose.value'
    ) {
      const name = this.literalString(args[0], node.arguments[0]);
      let exposure: ExposureIR;
      if (operation === 'expose.state') {
        const valueType = stateValue(args[1].type);
        if (!valueType)
          rejectNode(node.arguments[1], 'PUI1006', 'Expose state requires a state handle.');
        exposure = { name, kind: 'state', type: valueType, span };
      } else if (operation === 'expose.event') {
        if (args[1] && args[1].kind !== 'record')
          rejectNode(node, 'PUI1006', 'Outward event declaration must be a literal spec.');
        const payload =
          args[1]?.kind === 'record'
            ? args[1].entries.find((item) => item.key === 'payload')?.value
            : undefined;
        const kind = payload?.kind === 'literal' ? payload.value : 'any';
        if (kind !== 'void' && kind !== 'json' && kind !== 'any')
          rejectNode(node, 'PUI1006', 'Unsupported outward event payload declaration.');
        this.eventKinds.set(name, kind);
        this.eventPayloads.set(name, []);
        exposure = {
          name,
          kind: 'event',
          payload: kind === 'void' ? 'void' : { kind: 'union', members: [] },
          span,
        };
      } else if (operation === 'expose.value') {
        if (!isPublicValueType(args[1].type))
          rejectNode(
            node,
            'PUI1006',
            'Expose values require data or a concrete public snapshot/control capability.'
          );
        exposure = { name, kind: 'value', type: args[1].type, span };
      } else {
        if (args[1].kind !== 'function')
          rejectNode(node, 'PUI1006', 'Expose method needs a checked callback.');
        if (!isPublicValueType(args[1].function.returnType))
          rejectNode(
            node,
            'PUI1006',
            'Exposed methods cannot return setup or execution-scope capabilities.'
          );
        exposure = {
          name,
          kind: 'method',
          parameters: args[1].function.parameters,
          returnType: args[1].function.returnType,
          span,
        };
      }
      const prior = this.exposes.get(name);
      if (prior && prior.kind !== exposure.kind)
        rejectNode(node, 'PUI1006', `Conflicting exposure ${name}.`);
      this.exposes.set(name, exposure);
    }
    if (operation === 'render.el') this.literalString(args[0], node.arguments[0]);
  }

  literalString(expression: ExpressionIR, node: ts.Node): string {
    if (expression.kind !== 'literal' || typeof expression.value !== 'string' || !expression.value)
      rejectNode(node, 'PUI1006', 'A nonempty static string is required.');
    return expression.value;
  }

  compile(): PrototypeIR {
    const fileName = sourceName(this.options.fileName ?? 'input.proto.ts');
    const module = this.graph.load(fileName);
    this.graph.validateExports();
    const exportName = this.options.exportName ?? 'default';
    const definition = this.graph.definition(module, exportName);
    if (definition.factory !== 'definePrototype')
      rejectNode(definition.node, 'PUI1002', 'A subjectless asHook requires a caller prototype.');
    const descriptor = this.graph.descriptor(definition.module, definition.node);
    const setup = this.function(definition.module, descriptor.setup, new Map(), 'setup', ['def']);
    for (const loaded of this.graph.modules.values())
      for (const [name, declaration] of loaded.declarations) {
        if (ts.isCallExpression(declaration)) {
          if (
            ts.isIdentifier(declaration.expression) &&
            this.graph.resolveCoreImport(loaded, declaration.expression.text) === 'createContextKey'
          ) {
            const key = extractContextKeyDeclaration(loaded, name);
            this.contextKeys.set(key.id, key);
          } else if (
            ts.isIdentifier(declaration.expression) &&
            this.graph.resolveCoreImport(loaded, declaration.expression.text) === 'tw'
          ) {
            extractRuleStyleHandle(loaded, declaration);
          } else {
            const capability = extractStaticCapability(loaded, name);
            if (capability) this.staticDeclarations.set(capability.id, capability);
            else if (!extractModuleDeclaration(loaded, declaration))
              this.graph.descriptor(loaded, declaration);
          }
        } else if (ts.isFunctionDeclaration(declaration) && !this.usedFunctions.has(declaration))
          rejectNode(
            declaration,
            'PUI1004',
            'Unreachable runtime function is outside this admitted source unit.'
          );
      }
    for (const [name, values] of this.eventPayloads) {
      const exposure = this.exposes.get(name)!;
      if (exposure.kind === 'event' && this.eventKinds.get(name) !== 'void')
        exposure.payload = union(values, descriptor.setup) as DataType;
    }
    const sourceFiles = [...this.graph.modules]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, value]) => ({
        file,
        content: value.file.text,
        sha256: createHash('sha256').update(value.file.text).digest('hex'),
      }));
    return {
      schemaVersion: IR_VERSION,
      name: descriptor.name,
      source: {
        file: fileName,
        exportName,
        sha256: createHash('sha256')
          .update(JSON.stringify(sourceFiles.map((file) => [file.file, file.content])))
          .digest('hex'),
      },
      sourceFiles,
      setup,
      hooks: [...this.hooks.values()],
      contextKeys: [...this.contextKeys.values()],
      staticDeclarations: [...this.staticDeclarations.values()],
      moduleDeclarations: descriptor.modules,
      props: [...this.props.values()],
      exposes: [...this.exposes.values()],
      requirements: [...this.requirements].sort(),
    };
  }
}

export function parsePrototype(
  source: string,
  options: ParseOptions = {}
): CompileResult<PrototypeIR> {
  try {
    return { ok: true, value: new Frontend(source, options).compile() };
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    const file = sourceName(options.fileName ?? 'input.proto.ts');
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI1999',
          category: 'compiler-defect',
          message: `Unexpected frontend failure: ${error instanceof Error ? error.message : String(error)}`,
          span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
        },
      ],
    };
  }
}
