import { eventPayloadMemberType, eventValueJoin } from './event-types';
import { declaredSetValueEvent } from './a11y-event-types';
import { prependInvocationStatements } from './declaration-order';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { CompilerRejection, unexpectedFailureEvidence, unknownDiagnosticSpan } from './diagnostics';
import { admittedHookOperation, hookAdmission } from './hook-admission';
import { dormantSourceDeclarations } from './parser-source-demand';
import { moduleBoolean } from './source-module-initialization';
import { hasAccessorField, moduleAccessorStorageIssue } from './record-accessors';

import {
  OPERATION_RULES,
  operationCallbackRule,
  operationArgumentRule,
  operationResultType,
  argumentValue,
  validateOperationArguments,
  validateOperationPhase,
  isTemplateChildType,
  capabilityMemberType,
  captureStateHandlesType,
  capabilityBinaryType,
  stateValue,
  finiteStringKeys,
  FOCUS_OPTIONS_TYPE,
  FOCUS_ACTIVATION_OPTIONS_TYPE,
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
  scalarInitializer,
  staticDataInitializer,
  staticScalarMembership,
  staticCallableSelection,
  staticGetterRecordInitializer,
  staticJoin,
  isSourceFunction,
  CORE_FUNCTIONS,
  type FunctionNode,
  type SourceModule,
} from './parser-module';
import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';
import {
  inferBinaryType,
  inferUnaryType,
  memberDataType,
  conditionRefinements,
  stablePredicate,
  invalidateHeapFlow,
} from './expression-types';
import { extractContextKeyDeclaration, type ContextKeyIR } from './context-declarations';
import { parseSourceDataType } from './source-types';
import { sourceTypeIdentity } from './source-type-resolution';
import { parseSourceValueType, type TypeSubstitutions } from './source-values';
import { deriveHookCapture, derivePrototypeCaptures, mergeHookCaptures } from './capture-analysis';
import { captureFacadeFields, checkedSpreadFields, mergeSpreadField } from './capture-types';
import { callableEffectIssue } from './callable-effects';
import {
  FlowProof,
  callSiteKey,
  deriveReadonlyCallSites,
  functionCanMutateFlow,
  writtenMemberFields,
  type FlowMark,
} from './flow-proof';
import { HOOK_API_TYPE, HOOK_TOOLS_TYPE } from './core-value-types';
import { lowerObjectParameterPatterns, unwrapSourceExpression } from './source-syntax';
import {
  scalarConstant,
  staticOptionProperties,
  readsOnlyStaticOptions,
  specializeOptionType,
  specializeHookOptionShape,
  type ScalarConstant,
  type StaticProperties,
} from './source-static-options';
import {
  valueTypeEqual,
  valueAssignable,
  joinValueTypes,
  objectFields,
  objectValueType,
  spreadObjectField,
  memberValueType,
  functionValueType,
  callableValue,
  checkedCall,
  arrayEveryCallbackParameters,
  intrinsicResult,
  valueAlternatives,
  canNarrowValue,
  erasesRuntimeAuthority,
  serializableDataType,
  contextRuntimeValueType,
  arrayElementType,
  iterableElementType,
  ordinaryArrayType,
  indexedValueType,
  canCheckPropertyPresence,
} from './value-types';
import {
  STATIC_CORE_VALUES,
  extractStaticCapability,
  extractModuleDeclaration,
  tableStructureFamily,
} from './static-declarations';
import {
  extractRuleDeclaration,
  extractRuleStyleHandle,
  liftRuleDeclarationConditional,
  liftStyleCallConditional,
  lowerRuleLiteralArgumentSpreads,
} from './rule-declarations';
import { lowerRulePlan } from './rule-plan';
import {
  lowerOrdinaryLoops,
  lowerStaticIterationContinue,
  replaceStaticBindings,
} from './source-loops';
import { inferStateData } from './state-data-provenance';
import {
  ecmaConstantValue,
  ecmaConstructorName,
  ecmaGlobalCallName,
  ecmaMemberCallName,
  ecmaOptionalContinuation,
  ecmaRegexLiteral,
  isEcmaMemberName,
} from './ecmascript-values';
import { ecmaSourcePath } from './source-ecmascript';
import type { StyleTokenHandle } from './style-plan';
import {
  IR_VERSION,
  isDataValueType,
  isPublicValueType,
  hasCaptureLookup,
  isCapabilityAssignable,
  lexicalValueType,
  lexicalStoredType,
  isSetupResultType,
  statementsTerminate,
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
  type ModuleDeclarationIR,
} from './ir';

function contextualCallable(type?: ValueType): ReturnType<typeof callableValue> | undefined {
  if (type === undefined) return undefined;
  try {
    return callableValue(type, true);
  } catch {
    return undefined;
  }
}

/** Parameter bindings are ordinary mutable locals; nested shadowing has its own binding. */
function parameterIsWritten(body: ts.Node, name: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      node !== body &&
      ts.isFunctionLike(node) &&
      node.parameters.some(
        (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === name
      )
    )
      return;
    if (
      node !== body &&
      ts.isBlock(node) &&
      node.statements.some(
        (statement) =>
          ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
          )
      )
    )
      return;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(node.left) &&
      node.left.text === name
    ) {
      found = true;
      return;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      ts.isIdentifier(node.operand) &&
      node.operand.text === name
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

interface Binding {
  type: ValueType;
  value?: ExpressionIR;
  lexical?: ValueType;
  helper?: FunctionIR;
  declaration?: ts.VariableDeclaration | FunctionNode;
  module?: SourceModule;
  pendingScope?: Scope;
  parsed?: ExpressionIR;
  parsing?: boolean;
  initializerParsed?: boolean;
  declarationScope?: object;
  emittedName?: string;
  bindingId?: string;
  phase?: Phase;
  keyId?: string;
  stateId?: string;
  stateData?: DataType;
  predicate?: ExpressionIR;
  flowBase?: ValueType;
  flowAt?: FlowMark;
  uninitializedParameter?: boolean;
  style?: StyleTokenHandle;
  staticData?: ts.Expression;
  constant?: ScalarConstant;
  staticProperties?: StaticProperties;
  staticObjectPresent?: boolean;
  freshFieldType?: 'boolean' | 'number' | 'string';
}
type Scope = Map<string, Binding>;
const CAPABILITY_ANNOTATIONS: Readonly<Record<string, string>> = {
  def: 'DefHandle',
  run: 'RunHandle',
  render: 'RendererHandle',
  event: 'ProtoEventPayload',
  'a11y-value-event': 'A11ySetValueEventPayload',
  'control-label-request': 'ControlLabelRequest',
};

function sameType(a: ValueType, b: ValueType): boolean {
  return valueTypeEqual(a, b);
}
function operationReceiverType(type: ValueType): ValueType {
  const present = joinValueTypes(
    valueAlternatives(type).filter((member) => member !== 'null' && member !== 'void')
  );
  return stateValue(present)
    ? 'state:boolean'
    : typeof present === 'string' && /^(nullable|optional):/.test(present)
      ? (present.slice(present.indexOf(':') + 1) as ValueType)
      : typeof present !== 'string' && present.kind === 'capture'
        ? 'authored-result'
        : present;
}
function assignable(actual: ValueType, expected: ValueType): boolean {
  return (
    valueAssignable(actual, expected) ||
    (expected === 'template' && isTemplateChildType(actual)) ||
    isCapabilityAssignable(actual, expected) ||
    (isDataValueType(actual) && isDataValueType(expected) && isAssignable(actual, expected))
  );
}
/** Retain the caller's complete shape while checking the declared read interface. */
function canRetainParameterType(actual: ValueType, expected: ValueType): boolean {
  if (assignable(actual, expected)) return true;
  const fields = objectFields(actual),
    required = objectFields(expected);
  if (!fields || !required) return false;
  return required.every((field) => {
    const source = fields.find((candidate) => candidate.name === field.name);
    return (
      source !== undefined &&
      (!source.optional || !!field.optional) &&
      canRetainParameterType(source.type, field.type)
    );
  });
}
function union(types: readonly ValueType[], node: ts.Node): ValueType {
  if (!types.length) return 'void';
  if (types.every((type) => sameType(type, types[0]))) return types[0];
  const eventJoin = eventValueJoin(types);
  if (eventJoin !== undefined) return eventJoin;
  if (
    types.some((type) => type === 'template' || type === 'array') &&
    types.every(isTemplateChildType)
  )
    return 'template';
  return joinValueTypes(types);
}
class Frontend {
  readonly graph: SourceGraph;
  readonly hooks = new Map<string, AuthoredHookIR>();
  readonly props = new Map<string, PropIR>();
  private readonly sourcePropTypes = new Map<string, DataType>();
  private readonly sourceMethodTypes = new Map<string, Extract<ValueType, { kind: 'callable' }>>();
  readonly exposes = new Map<string, ExposureIR>();
  readonly contextKeys = new Map<string, ContextKeyIR>();
  readonly staticDeclarations = new Map<string, StaticCapabilityIR>();
  readonly moduleDeclarations = new Map<string, ModuleDeclarationIR>();
  readonly requirements = new Set<string>();
  readonly activeHooks = new Set<string>();
  readonly activeHelpers = new Set<string>();
  readonly eventKinds = new Map<string, 'void' | 'json' | 'any'>();
  readonly eventPayloads = new Map<string, DataType[]>();
  readonly numericActionEvents = new Set<string>();
  private context: FunctionContext = 'setup';
  private ruleSequence = 0;
  private moduleSequence = 0;
  private readonly moduleBindings: Extract<StatementIR, { kind: 'const' }>[] = [];
  private readonly moduleValues = new Map<string, Binding & { name: string }>();
  private readonly moduleHelpers = new Map<string, { name: string; fn: FunctionIR }>();
  private readonly parsingDeclarations = new Map<ts.Node, Binding>();
  private readonly previewingDeclarations = new Set<ts.Node>();
  private readonly normalizedBindingIds = new WeakMap<ts.Node, string>();
  private nextNormalizedBindingId = 0;
  private preservingBindingReferences = 0;
  private resolvingStaticValues = 0;
  private retainingCallerShapes = 0;
  private readonly loweredFunctionPatterns = new WeakMap<FunctionNode, FunctionNode>();
  private readonly sourceNames = new Set<string>();
  private flow: FlowProof;
  private substitutions: TypeSubstitutions = new Map();
  private returnContext?: ValueType;
  private renderReturn = false;
  private readonly statementPrefixes: StatementIR[][] = [];
  private previewingCaptures = false;
  private lexicalExecution: object = {};

  private bindingIdentity(module: SourceModule, declaration: ts.Node, name: string): string {
    const source = `${module.file.fileName}#${declaration.pos}`;
    if (!(declaration.flags & ts.NodeFlags.Synthesized)) return source;
    let identity = this.normalizedBindingIds.get(declaration);
    if (!identity) {
      // Normalization preserves authored spans, so several different lexical
      // slots can have the same source offset (and even the same name in
      // repeated static iterations). Their checked binding identities must not
      // alias merely because diagnostics point at the same authored token.
      identity = `${source}#normalized:${name}:${this.nextNormalizedBindingId++}`;
      this.normalizedBindingIds.set(declaration, identity);
    }
    return identity;
  }

  private withBindingReferences(read: () => ExpressionIR): ExpressionIR {
    this.preservingBindingReferences++;
    try {
      return read();
    } finally {
      this.preservingBindingReferences--;
    }
  }

  private withStaticValues(read: () => ExpressionIR): ExpressionIR {
    this.resolvingStaticValues++;
    try {
      return read();
    } finally {
      this.resolvingStaticValues--;
    }
  }

  private sourceTypeScope(scope: Scope): TypeSubstitutions {
    const types = new Map(this.substitutions);
    for (const [name, binding] of scope) {
      const type = binding.lexical ?? binding.type;
      types.set(`typeof:${name}`, type);
      const receiver = operationReceiverType(type);
      for (const [operation, rule] of Object.entries(OPERATION_RULES)) {
        if (!sameType(rule.receiver, receiver)) continue;
        const result = operationResultType(operation, receiver, {
          stateValueType: stateValue(type),
        });
        if (result !== undefined) types.set(`ReturnType:${name}.${rule.path}`, result);
      }
    }
    return types;
  }

  private stateData(value: ExpressionIR, scope: Scope): DataType | undefined {
    return inferStateData(value, (reference) => {
      const binding = [...scope].find(([name, binding]) =>
        reference.bindingId
          ? binding.bindingId === reference.bindingId
          : (binding.emittedName ?? name) === reference.name
      )?.[1];
      if (binding)
        return {
          stateData: binding.stateData,
          value:
            binding.value ??
            (binding.helper
              ? {
                  kind: 'function',
                  function: binding.helper,
                  type: functionValueType(binding.helper),
                  span: binding.helper.span,
                }
              : undefined),
        };
      return this.moduleBindings.find((binding) => binding.name === reference.name);
    });
  }

  private sourceValueType(
    module: SourceModule,
    node: ts.TypeNode,
    substitutions = this.substitutions
  ): ValueType {
    return parseSourceValueType(module, node, substitutions, undefined, (owner, query) => {
      if (!ts.isIdentifier(query.exprName)) return undefined;
      const runtime = owner.graph.modules.get(owner.file.fileName);
      if (
        !runtime ||
        (!runtime.declarations.has(query.exprName.text) &&
          !runtime.imports.has(query.exprName.text))
      )
        return undefined;
      const resolved = this.graph.resolveBinding(runtime, query.exprName.text);
      if (!resolved.module || this.previewingDeclarations.has(resolved.node)) return undefined;
      this.previewingDeclarations.add(resolved.node);
      try {
        if (moduleDataNode(resolved.node)) {
          const value = this.moduleValue(
            resolved.module,
            resolved.name,
            resolved.node as ts.Expression
          );
          return value.lexical ?? value.type;
        }
        if (isSourceFunction(resolved.node) && !resolved.node.typeParameters?.length)
          return this.previewFunction(resolved.module, resolved.node, new Map());
        return undefined;
      } finally {
        this.previewingDeclarations.delete(resolved.node);
      }
    });
  }

  private previewExpression(module: SourceModule, node: ts.Expression, scope: Scope): ValueType {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return this.previewExpression(module, node.expression, scope);
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
      return 'boolean';
    if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return 'string';
    if (ts.isNumericLiteral(node)) return 'number';
    if (ts.isPrefixUnaryExpression(node))
      return node.operator === ts.SyntaxKind.ExclamationToken ? 'boolean' : 'number';
    if (ts.isIdentifier(node)) {
      const local = scope.get(node.text);
      if (local) return local.lexical ?? local.type;
      if (node.text === 'undefined') return 'void';
      if (module.declarations.has(node.text) || module.imports.has(node.text)) {
        const resolved = this.graph.resolveBinding(module, node.text);
        if (
          resolved.module &&
          isSourceFunction(resolved.node) &&
          !resolved.node.typeParameters?.length &&
          !this.previewingDeclarations.has(resolved.node)
        ) {
          this.previewingDeclarations.add(resolved.node);
          try {
            return this.previewFunction(resolved.module, resolved.node, new Map());
          } finally {
            this.previewingDeclarations.delete(resolved.node);
          }
        }
      }
      return 'unknown';
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
      return this.previewFunction(module, node, scope);
    if (ts.isObjectLiteralExpression(node)) {
      const fields: { name: string; type: ValueType }[] = [];
      for (const property of node.properties) {
        if (
          (!ts.isPropertyAssignment(property) &&
            !ts.isShorthandPropertyAssignment(property) &&
            !ts.isMethodDeclaration(property)) ||
          ts.isComputedPropertyName(property.name)
        )
          return 'unknown';
        fields.push({
          name: propertyName(property.name),
          type: ts.isMethodDeclaration(property)
            ? this.previewFunction(module, property, scope)
            : this.previewExpression(
                module,
                ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer,
                scope
              ),
        });
      }
      return objectValueType(fields);
    }
    if (
      ts.isArrayLiteralExpression(node) &&
      !node.elements.some(
        (element) => ts.isSpreadElement(element) || ts.isOmittedExpression(element)
      )
    )
      return ordinaryArrayType(
        joinValueTypes(
          node.elements.map((element) => this.previewExpression(module, element, scope))
        )
      );
    if (ts.isConditionalExpression(node))
      return joinValueTypes([
        this.previewExpression(module, node.whenTrue, scope),
        this.previewExpression(module, node.whenFalse, scope),
      ]);
    if (ts.isBinaryExpression(node)) {
      const operator = ts.tokenToString(node.operatorToken.kind) ?? '';
      if (['===', '!==', '<', '>', '<=', '>='].includes(operator)) return 'boolean';
      if (['&&', '||', '??'].includes(operator)) {
        const left = this.previewExpression(module, node.left, scope),
          right = this.previewExpression(module, node.right, scope);
        return sameType(left, right) ? left : joinValueTypes([left, right]);
      }
      return 'number';
    }
    if (ts.isPropertyAccessExpression(node)) {
      const owner = this.previewExpression(module, node.expression, scope);
      try {
        return (
          capabilityMemberType(owner, node.name.text, !!node.questionDotToken) ??
          memberValueType(owner, node.name.text, !!node.questionDotToken)
        );
      } catch {
        return 'unknown';
      }
    }
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        !scope.has(node.expression.text) &&
        (module.imports.has(node.expression.text) || module.declarations.has(node.expression.text))
      ) {
        const resolved = this.graph.resolveBinding(module, node.expression.text);
        if (
          resolved.module === null &&
          (resolved.imported.module === '@proto.ui/core' ||
            resolved.imported.module === '@proto.ui/hooks')
        ) {
          const name =
            resolved.imported.module === '@proto.ui/core' &&
            Object.hasOwn(CORE_FUNCTIONS, resolved.name)
              ? CORE_FUNCTIONS[resolved.name as keyof typeof CORE_FUNCTIONS]
              : resolved.imported.module === '@proto.ui/hooks'
                ? admittedHookOperation(resolved.name)
                : undefined;
          const operation = name ? OPERATION_RULES[name] : undefined;
          if (operation && !operation.resultFrom) return operation.result;
        }
      }
      if (ts.isPropertyAccessExpression(node.expression)) {
        const member = node.expression;
        const paths: string[] = [];
        let root: ts.Expression = member;
        let optional = !!node.questionDotToken;
        while (ts.isPropertyAccessExpression(root)) {
          optional ||= !!root.questionDotToken;
          paths.unshift(root.name.text);
          root = root.expression;
        }
        const receiver = operationReceiverType(this.previewExpression(module, root, scope));
        const path =
          receiver === 'render' && paths.join('.') === 'r.slot' ? 'slot' : paths.join('.');
        const rule =
          Object.values(OPERATION_RULES).find(
            (rule) => sameType(rule.receiver, receiver) && rule.path === path
          ) ??
          Object.values(OPERATION_RULES).find(
            (rule) =>
              rule.path === member.name.text &&
              sameType(
                rule.receiver,
                operationReceiverType(this.previewExpression(module, member.expression, scope))
              )
          );
        // A forward capture needs the declared value type, not execution of the
        // initializer. Receiver/argument-dependent results remain unproven here.
        if (rule && !rule.resultFrom)
          return optional ? joinValueTypes([rule.result, 'void']) : rule.result;
      }
      const type = this.previewExpression(module, node.expression, scope);
      try {
        return callableValue(type, !!node.questionDotToken).returnType;
      } catch {
        return 'unknown';
      }
    }
    return 'unknown';
  }

  private lowerFunctionPatterns(node: FunctionNode): FunctionNode {
    const cached = this.loweredFunctionPatterns.get(node);
    if (cached) return cached;
    const lowered = lowerObjectParameterPatterns(node, () => this.moduleName());
    this.loweredFunctionPatterns.set(node, lowered);
    return lowered;
  }

  private previewFunction(
    module: SourceModule,
    node: FunctionNode,
    scope: Scope,
    contextual?: ValueType
  ): Extract<ValueType, { kind: 'callable' }> {
    node = this.lowerFunctionPatterns(node);
    const expected = contextualCallable(contextual);
    const local = new Map(scope);
    for (const parameter of node.parameters)
      local.set(identifier(parameter.name), { type: 'unknown' });
    for (let pass = 0; pass <= node.parameters.length; pass++)
      node.parameters.forEach((parameter, index) => {
        const contextual = expected?.parameters[index]?.type;
        const type = parameter.type
          ? this.parameterType(module, parameter, contextual, undefined, local)
          : parameter.initializer
            ? this.previewExpression(module, parameter.initializer, local)
            : contextual !== undefined && contextual !== 'unknown'
              ? contextual
              : 'unknown';
        local.set(identifier(parameter.name), { type });
      });
    const parameters = node.parameters.map((parameter, index) => {
      const name = identifier(parameter.name);
      const type = local.get(name)!.type;
      return {
        name,
        type,
        ...(parameter.questionToken || parameter.initializer ? { optional: true } : {}),
        ...(parameter.dotDotDotToken ? { rest: true } : {}),
      };
    });
    let returnType = node.type
      ? this.sourceValueType(module, node.type, this.sourceTypeScope(local))
      : expected?.returnType;
    if (returnType === undefined) {
      if (node.body && !ts.isBlock(node.body))
        returnType = this.previewExpression(module, node.body, local);
      else {
        // Return previews include local declaration shapes, but do not execute
        // initializers. Later lowering checks every body and every inferred field.
        if (node.body && ts.isBlock(node.body)) {
          const declarations = node.body.statements.flatMap((statement) =>
            ts.isVariableStatement(statement)
              ? [...statement.declarationList.declarations].filter((declaration) =>
                  ts.isIdentifier(declaration.name)
                )
              : []
          );
          for (const declaration of declarations)
            local.set(identifier(declaration.name), { type: 'unknown' });
          for (const declaration of declarations)
            local.set(identifier(declaration.name), {
              type: declaration.type
                ? this.sourceValueType(module, declaration.type, this.sourceTypeScope(local))
                : declaration.initializer
                  ? this.previewExpression(module, declaration.initializer, local)
                  : 'void',
            });
        }
        const returns: ValueType[] = [];
        const visit = (part: ts.Node): void => {
          if (part !== node.body && ts.isFunctionLike(part)) return;
          if (ts.isReturnStatement(part))
            returns.push(
              part.expression ? this.previewExpression(module, part.expression, local) : 'void'
            );
          else ts.forEachChild(part, visit);
        };
        if (node.body) visit(node.body);
        returnType = returns.length ? joinValueTypes(returns) : 'void';
      }
    }
    return { kind: 'callable', parameters, returnType };
  }

  /** Check declaration/signature grammar while keeping body/default admission deferred. */
  private deferredSignature(module: SourceModule, node: FunctionNode): ValueType {
    if (
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
      ('asteriskToken' in node && node.asteriskToken) ||
      !node.body
    )
      rejectNode(node, 'PUI1004', 'Async/generator/external functions are unsupported.');
    const names = new Set<string>();
    const parameterNames = node.parameters.map((parameter) => identifier(parameter.name));
    const parameters = node.parameters.map((parameter, index) => {
      if (parameter.dotDotDotToken)
        rejectNode(parameter, 'PUI1004', 'Rest callback parameters are unsupported.');
      const name = identifier(parameter.name);
      if (names.has(name)) rejectNode(parameter, 'PUI1005', `Duplicate parameter ${name}.`);
      names.add(name);
      if (parameter.initializer) {
        const uninitialized = new Set(parameterNames.slice(index));
        const inspect = (part: ts.Node): void => {
          if (ts.isFunctionLike(part)) return;
          if (
            ts.isAsExpression(part) ||
            ts.isTypeAssertionExpression(part) ||
            ts.isSatisfiesExpression(part)
          ) {
            inspect(part.expression);
            return;
          }
          if (
            ts.isIdentifier(part) &&
            uninitialized.has(part.text) &&
            !(ts.isPropertyAccessExpression(part.parent) && part.parent.name === part) &&
            !(ts.isPropertyAssignment(part.parent) && part.parent.name === part)
          )
            rejectNode(
              part,
              'PUI1006',
              'A parameter default cannot read its current or a later uninitialized parameter.'
            );
          ts.forEachChild(part, inspect);
        };
        inspect(parameter.initializer);
      }
      return {
        name,
        type: parameter.type
          ? parseSourceValueType(module, parameter.type, this.substitutions)
          : ('unknown' as ValueType),
        ...(parameter.questionToken || parameter.initializer ? { optional: true } : {}),
      };
    });
    return {
      kind: 'callable',
      parameters,
      returnType: node.type
        ? parseSourceValueType(module, node.type, this.substitutions)
        : 'unknown',
    };
  }

  private resolvePending(binding: Binding): void {
    if (
      !binding.declaration ||
      binding.parsed ||
      binding.parsing ||
      !binding.module ||
      !binding.pendingScope
    )
      return;
    const declaration = binding.declaration;
    const init = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
    if (!init) return;
    const active = this.parsingDeclarations.get(declaration);
    if (active) {
      // Branch refinement clones Binding records. Declaration identity, not a
      // copied `parsing` flag, owns recursive inference's provisional signature.
      binding.type = active.type;
      return;
    }
    if (!isSourceFunction(init)) {
      // Earlier declarations may have resolved a receiver since predeclaration.
      // Refresh only an unannotated, still-unparsed type preview. This must not
      // execute the initializer or replace a checked binding/refinement.
      if (
        ts.isVariableDeclaration(declaration) &&
        !declaration.type &&
        !binding.initializerParsed &&
        (binding.lexical ?? binding.type) === 'unknown'
      ) {
        const type = this.previewExpression(binding.module, init, binding.pendingScope);
        if (binding.lexical !== undefined) {
          binding.lexical = type;
          binding.type =
            type === 'boolean' || type === 'number' || type === 'string'
              ? `lexical:${type}`
              : { kind: 'cell', value: type };
        } else binding.type = type;
      }
      return;
    }
    binding.parsing = true;
    this.parsingDeclarations.set(declaration, binding);
    try {
      const signature =
        typeof binding.type !== 'string' && binding.type.kind === 'callable'
          ? binding.type
          : this.previewFunction(binding.module, init, binding.pendingScope);
      const fn = this.function(
        binding.module,
        init,
        binding.pendingScope,
        this.helperPhase(binding.module, init, binding.pendingScope),
        signature.parameters.map((parameter) => parameter.type),
        'helper',
        ts.isVariableDeclaration(declaration) && declaration.type ? signature.returnType : undefined
      );
      binding.helper = fn;
      binding.phase = fn.phase;
      binding.type = functionValueType(fn);
      binding.parsed = {
        kind: 'function',
        function: fn,
        type: binding.type,
        span: sourceSpan(init),
      };
    } finally {
      binding.parsing = false;
      this.parsingDeclarations.delete(declaration);
    }
  }

  private predeclare(
    module: SourceModule,
    nodes: readonly ts.Statement[],
    scope: Scope,
    forbidden: ReadonlySet<string> = new Set(),
    dormant: ReadonlySet<ts.Node> = new Set()
  ): void {
    const declarations: (ts.VariableDeclaration | FunctionNode)[] = [];
    const names = new Set<string>();
    for (const node of nodes) {
      if (ts.isVariableStatement(node)) declarations.push(...node.declarationList.declarations);
      else if (ts.isFunctionDeclaration(node) && node.name) declarations.push(node);
    }
    for (const declaration of declarations) {
      const name = identifier(declaration.name!);
      if (names.has(name) || forbidden.has(name))
        rejectNode(declaration, 'PUI1005', `Duplicate local ${name}.`);
      names.add(name);
      const init = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
      const callable = init && ts.isExpression(init) ? unwrapSourceExpression(init) : init;
      const annotation = ts.isVariableDeclaration(declaration) ? declaration.type : undefined;
      const type = dormant.has(declaration)
        ? callable && isSourceFunction(callable)
          ? this.deferredSignature(module, callable)
          : 'unknown'
        : annotation
          ? this.sourceValueType(module, annotation, this.sourceTypeScope(scope))
          : init && isSourceFunction(init)
            ? this.previewFunction(module, init, scope)
            : init
              ? this.previewExpression(module, init as ts.Expression, scope)
              : 'unknown';
      const mutable =
        ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent) &&
        !!(declaration.parent.flags & ts.NodeFlags.Let);
      const emittedName = scope.has(name) ? this.moduleName() : name;
      scope.set(name, {
        type: mutable
          ? type === 'boolean' || type === 'number' || type === 'string'
            ? `lexical:${type}`
            : { kind: 'cell', value: type }
          : type,
        ...(mutable ? { lexical: type } : {}),
        ...(ts.isVariableDeclaration(declaration)
          ? { declarationScope: this.lexicalExecution }
          : {}),
        declaration,
        module,
        pendingScope: scope,
        emittedName,
        bindingId: this.bindingIdentity(module, declaration, name),
      });
    }
    // All declarations exist before resolving closure bodies; later lexical values are not read here.
    for (const declaration of declarations) {
      const binding = scope.get(identifier(declaration.name!))!,
        init = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
      if (init && isSourceFunction(init) && !dormant.has(declaration))
        binding.type = this.previewFunction(module, init, scope, binding.type);
    }
  }

  constructor(
    input: string,
    readonly options: ParseOptions,
    private readonly writtenFields: ReadonlySet<string> = new Set(),
    private readonly captureTypes: ReadonlyMap<string, import('./ir').HookCaptureIR> = new Map(),
    private readonly readonlyCallSites: ReadonlySet<string> = new Set(),
    private readonly deferCallFlow = false
  ) {
    this.graph = new SourceGraph(input, options);
    this.flow = new FlowProof(this.writtenFields);
  }

  private helperPhase(module: SourceModule, node: FunctionNode, scope: Scope): Phase {
    let phase: Phase = 'callback';
    const inspect = (part: ts.Node): void => {
      if (part !== node && ts.isFunctionLike(part)) return;
      if (ts.isCallExpression(part)) {
        if (ts.isIdentifier(part.expression) && module.imports.has(part.expression.text)) {
          const imported = this.graph.resolveBinding(module, part.expression.text);
          if (imported.module === null && imported.imported.module === '@proto.ui/hooks')
            phase = 'setup';
        } else if (ts.isPropertyAccessExpression(part.expression)) {
          const paths: string[] = [];
          let root: ts.Expression = part.expression;
          while (ts.isPropertyAccessExpression(root)) {
            paths.unshift(root.name.text);
            root = root.expression;
          }
          if (ts.isIdentifier(root)) {
            const binding = scope.get(root.text);
            const raw = binding?.lexical ?? binding?.type;
            const receiver = raw && stateValue(raw) ? 'state:boolean' : raw;
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
    for (const parameter of node.parameters)
      if (parameter.initializer) inspect(parameter.initializer);
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
  private checkedValue(node: ts.Node, action: () => ValueType): ValueType {
    try {
      return action();
    } catch (error) {
      if (error instanceof TypeError) rejectNode(node, 'PUI1006', error.message);
      throw error;
    }
  }
  private refinedScope(scope: Scope, condition: ExpressionIR, truth: boolean): Scope {
    this.normalizeFlow(scope);
    const next = new Map(scope);
    if (condition.kind === 'reference') {
      const binding = [...scope].find(
        ([key, binding]) => (binding.emittedName ?? key) === condition.name
      )?.[1];
      if (binding?.predicate && !binding.lexical)
        return this.refinedScope(scope, binding.predicate, truth);
    }
    for (const [name, type] of conditionRefinements(condition, truth, this.flow.current)) {
      const entry = [...next].find(([key, binding]) => (binding.emittedName ?? key) === name);
      if (entry)
        next.set(entry[0], {
          ...entry[1],
          flowAt: this.flow.mark(entry[1].bindingId ?? entry[1].emittedName ?? entry[0]),
          ...(entry[1].lexical
            ? { lexical: type }
            : { type, flowBase: entry[1].flowBase ?? entry[1].type }),
        });
    }
    return next;
  }
  private normalizeFlow(scope: Scope): void {
    for (const [name, binding] of scope) {
      const mark = binding.flowAt;
      if (!mark) continue;
      const key = binding.bindingId ?? binding.emittedName ?? name;
      const stored = lexicalStoredType(binding.type);
      if (stored && this.flow.cellChanged(mark, key))
        scope.set(name, { ...binding, lexical: stored, flowAt: this.flow.mark(key) });
      else if (this.flow.heapChanged(mark))
        scope.set(name, {
          ...binding,
          ...(stored
            ? { lexical: invalidateHeapFlow(binding.lexical ?? stored, stored, this.writtenFields) }
            : {
                type: invalidateHeapFlow(
                  binding.type,
                  binding.flowBase ?? binding.type,
                  this.writtenFields
                ),
              }),
          flowAt: this.flow.mark(key),
        });
    }
  }

  /** Branch facts are normalized under their own clocks before this merge. */
  private joinFlowScopes(scope: Scope, branches: readonly Scope[]): void {
    this.normalizeFlow(scope);
    for (const [name, binding] of scope) {
      if (binding.lexical === undefined) continue;
      const values = branches.map((branch) => {
        const next = branch.get(name);
        return next && next.bindingId === binding.bindingId
          ? (next.lexical ?? binding.lexical!)
          : binding.lexical!;
      });
      scope.set(name, {
        ...binding,
        lexical: joinValueTypes(values),
        flowAt: this.flow.mark(binding.bindingId ?? binding.emittedName ?? name),
      });
    }
  }

  private conditionalRight(
    module: SourceModule,
    node: ts.Expression,
    scope: Scope,
    phase: Phase,
    left: ExpressionIR,
    operator: string,
    expectedType?: ValueType
  ): ExpressionIR {
    const incoming = this.flow;
    const skipped =
      operator === '&&' || operator === '||'
        ? this.refinedScope(scope, left, operator === '||')
        : new Map(scope);
    this.normalizeFlow(skipped);
    this.flow = incoming.fork();
    const rightScope =
      operator === '&&' || operator === '||'
        ? this.refinedScope(scope, left, operator === '&&')
        : new Map(scope);
    const right = this.expression(module, node, rightScope, phase, undefined, expectedType);
    this.normalizeFlow(rightScope);
    this.flow = incoming.join([incoming, this.flow]);
    this.joinFlowScopes(scope, [skipped, rightScope]);
    return right;
  }

  private invalidateFlow(scope: Scope, cells: boolean, allFields = false): void {
    if (cells) this.flow.call();
    else this.flow.writeHeap();
    for (const [name, binding] of scope) {
      const original = binding.flowBase ?? binding.type;
      const fields = allFields
        ? new Set(objectFields(original)?.map((field) => field.name))
        : this.writtenFields;
      if (binding.lexical) {
        const stored = lexicalStoredType(binding.type)!;
        scope.set(name, {
          ...binding,
          lexical: cells ? stored : invalidateHeapFlow(binding.lexical, stored, fields),
        });
      } else if (binding.flowBase) {
        scope.set(name, { ...binding, type: invalidateHeapFlow(binding.type, original, fields) });
      }
    }
  }

  private originalValueType(value: ExpressionIR, scope: Scope): ValueType {
    if (value.kind === 'reference') {
      const entry = [...scope].find(
        ([name, binding]) => (binding.emittedName ?? name) === value.name
      )?.[1];
      return entry?.flowBase ?? entry?.type ?? value.type;
    }
    if (value.kind === 'lexical-read')
      return lexicalStoredType(this.originalValueType(value.cell, scope)) ?? value.type;
    if (value.kind === 'member') {
      const base = this.originalValueType(value.object, scope);
      return this.memberType(
        joinValueTypes(
          valueAlternatives(base).filter((type) => type !== 'null' && type !== 'void')
        ),
        value.property,
        value.optional
      );
    }
    return value.type;
  }

  private memberType(type: ValueType, property: string, optional: boolean): ValueType {
    return joinValueTypes(
      valueAlternatives(type).map((owner) => {
        if (owner === 'void' || owner === 'null') {
          if (optional) return 'void';
          throw new TypeError(`Cannot read ${property} on a nullish value.`);
        }
        if (typeof owner !== 'string' && owner.kind === 'capture')
          return memberValueType(
            { kind: 'object', fields: this.captureFields(owner.hookId) },
            property,
            optional
          );
        const capability = capabilityMemberType(owner, property, optional);
        if (capability !== undefined) return capability;
        if (owner === 'props') {
          const prop = this.props.get(property);
          if (!prop) throw new TypeError(`Read of undeclared prop ${property}.`);
          return prop.type;
        }
        if (owner === 'exception') return 'exception';
        const event = eventPayloadMemberType(owner, property);
        if (event !== undefined) return event;
        return memberValueType(owner, property, optional);
      })
    );
  }

  private captureFields(id: string) {
    return captureFacadeFields(
      this.hooks.get(id),
      new Map(
        [...this.hooks].map(([id, hook]) => [
          id,
          hook.projectHandle?.returnType ?? { kind: 'capture', hookId: id },
        ])
      ),
      this.captureTypes.get(id) ?? this.hooks.get(id)?.capture
    );
  }

  private parameterType(
    module: SourceModule,
    parameter: ts.ParameterDeclaration,
    expected?: ValueType,
    body?: ts.ConciseBody,
    outer: Scope = new Map()
  ): ValueType {
    if (parameter.type) {
      if (parameter.type.kind === ts.SyntaxKind.AnyKeyword && expected !== undefined)
        return expected;
      const identity = sourceTypeIdentity(module, parameter.type);
      if (identity?.module === '@proto.ui/core') {
        if (
          identity.name === 'AsHookResult' &&
          expected &&
          typeof expected !== 'string' &&
          expected.kind === 'capture'
        )
          return expected;
        if (identity.name === 'FocusRequestOptions') return FOCUS_OPTIONS_TYPE;
        if (identity.name === 'FocusScopeActivationOptions') return FOCUS_ACTIVATION_OPTIONS_TYPE;
        if (
          expected &&
          typeof expected === 'string' &&
          CAPABILITY_ANNOTATIONS[expected] === identity.name
        )
          return expected;
      }
      return this.sourceValueType(module, parameter.type, this.sourceTypeScope(outer));
    }
    if (parameter.initializer)
      return this.expression(module, parameter.initializer, outer, 'callback').type;
    if (expected !== undefined && expected !== 'unknown') return expected;
    const constraint = this.parameterConstraint(parameter, body, outer);
    if (constraint) return constraint.type;
    if (expected === 'unknown') return expected;
    rejectNode(
      parameter,
      'PUI1006',
      'A data parameter needs a resolved operation constraint or an explicit serializable type annotation.'
    );
  }

  /** Infer only from a resolved receiver and the shared operation signature. */
  private parameterConstraint(
    parameter: ts.ParameterDeclaration,
    body: ts.ConciseBody | undefined,
    outer: Scope
  ): { type: ValueType; optional: boolean } | undefined {
    const name = ts.isIdentifier(parameter.name) ? parameter.name.text : '';
    let constraint: { type: ValueType; optional: boolean } | undefined;
    const inspect = (node: ts.Node): void => {
      if (node !== body && ts.isFunctionLike(node)) return;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        let root: ts.Expression = node.expression;
        const path: string[] = [];
        while (ts.isPropertyAccessExpression(root)) {
          path.unshift(root.name.text);
          root = root.expression;
        }
        const receiver = ts.isIdentifier(root) ? outer.get(root.text)?.type : undefined;
        const operation = Object.entries(OPERATION_RULES).find(
          ([, rule]) =>
            receiver !== undefined &&
            sameType(rule.receiver, receiver) &&
            rule.path === path.join('.')
        );
        if (operation)
          node.arguments.forEach((argument, index) => {
            if (!ts.isIdentifier(argument) || argument.text !== name) return;
            const rule = operationArgumentRule(operation[0], index);
            const type = rule?.schema ?? (rule?.types?.length === 1 ? rule.types[0] : undefined);
            if (type === undefined) return;
            if (constraint && !sameType(constraint.type, type))
              rejectNode(
                parameter,
                'PUI1006',
                'Operation constraints disagree; annotate the parameter explicitly.'
              );
            constraint = { type, optional: (constraint?.optional ?? true) && !!rule?.optional };
          });
      }
      ts.forEachChild(node, inspect);
    };
    if (body) inspect(body);
    return constraint;
  }

  function(
    module: SourceModule,
    node: FunctionNode,
    outer: Scope,
    phase: Phase,
    expected: readonly ValueType[] = [],
    context: FunctionContext = phase === 'callback' ? 'helper' : phase,
    expectedReturn?: ValueType,
    renderReturn = context === 'setup',
    specializeParameters = false,
    staticParameters: readonly (
      | { properties: StaticProperties; present: boolean }
      | undefined
    )[] = [],
    parameterStateData: readonly (DataType | undefined)[] = []
  ): FunctionIR {
    node = this.lowerFunctionPatterns(node);
    if (
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
      !node.body ||
      ('asteriskToken' in node && node.asteriskToken)
    )
      rejectNode(node, 'PUI1004', 'Async/generator/external functions are unsupported.');
    const previousContext = this.context;
    const previousReturn = this.returnContext;
    const previousRenderReturn = this.renderReturn;
    const previousFlow = this.flow;
    const previousExecution = this.lexicalExecution;
    this.lexicalExecution = {};
    this.flow = new FlowProof(this.writtenFields);
    this.context = context;
    this.renderReturn = renderReturn;
    this.returnContext = node.type
      ? this.sourceValueType(module, node.type, this.sourceTypeScope(outer))
      : expectedReturn;
    try {
      const scope: Scope = new Map(
        [...outer].map(([name, binding]) => [
          name,
          binding.lexical
            ? { ...binding, lexical: lexicalStoredType(binding.type) }
            : binding.uninitializedParameter
              ? { ...binding, uninitializedParameter: false }
              : binding,
        ])
      );
      // Runtime schemas describe coercion/empty handling; the authored Props
      // declaration supplies the finite shape of object-valued public data.
      for (const parameter of node.parameters) {
        const annotation = parameter.type;
        if (!annotation || !ts.isTypeReferenceNode(annotation) || !annotation.typeArguments?.[0])
          continue;
        const identity = sourceTypeIdentity(module, annotation);
        if (identity?.module !== '@proto.ui/core' || identity.name !== 'DefHandle') continue;
        const declared =
          annotation.typeArguments[0].kind === ts.SyntaxKind.AnyKeyword
            ? 'unknown'
            : this.sourceValueType(module, annotation.typeArguments[0], this.substitutions);
        for (const field of objectFields(declared) ?? []) {
          const type = serializableDataType(field.type);
          if (type === undefined) continue;
          const previous = this.sourcePropTypes.get(field.name);
          if (previous && !sameType(previous, type))
            rejectNode(annotation, 'PUI1006', `Conflicting authored prop type ${field.name}.`);
          this.sourcePropTypes.set(field.name, type);
        }
        if (
          annotation.typeArguments[1] &&
          annotation.typeArguments[1].kind !== ts.SyntaxKind.AnyKeyword
        ) {
          const exposes = this.sourceValueType(
            module,
            annotation.typeArguments[1],
            this.substitutions
          );
          for (const field of objectFields(exposes) ?? []) {
            const fn = objectFields(field.type)?.find((item) => item.name === 'fn')?.type;
            if (fn && typeof fn !== 'string' && fn.kind === 'callable')
              this.sourceMethodTypes.set(field.name, fn);
          }
        }
      }
      this.invalidateFlow(scope, false);
      const names = new Set<string>();
      const preview = this.previewFunction(module, node, scope, {
        kind: 'callable',
        parameters: node.parameters.map((parameter, index) => ({
          name: identifier(parameter.name),
          type: expected[index] ?? 'unknown',
        })),
        returnType: 'unknown',
      });
      node.parameters.forEach((parameter, index) =>
        scope.set(identifier(parameter.name), {
          type: preview.parameters[index].type,
          bindingId: `${module.file.fileName}#${parameter.pos}`,
          uninitializedParameter: true,
        })
      );
      const parameters: ParameterIR[] = node.parameters.map((parameter, index) => {
        const name = identifier(parameter.name);
        if (names.has(name)) rejectNode(parameter, 'PUI1005', `Duplicate parameter ${name}.`);
        names.add(name);
        const declared = this.parameterType(module, parameter, expected[index], node.body, scope);
        const type =
          specializeParameters &&
          expected[index] !== undefined &&
          !parameter.initializer &&
          canRetainParameterType(expected[index], declared)
            ? expected[index]
            : declared;
        if (
          parameter.dotDotDotToken &&
          (index !== node.parameters.length - 1 ||
            arrayElementType(type) === undefined ||
            parameter.initializer ||
            parameter.questionToken)
        )
          rejectNode(
            parameter,
            'PUI1006',
            'A rest parameter must be the final array-valued parameter.'
          );
        const fallback = parameter.initializer
          ? this.withBindingReferences(() =>
              this.expression(module, parameter.initializer!, scope, phase, undefined, type)
            )
          : undefined;
        if (
          fallback &&
          !assignable(fallback.type, type) &&
          !assignable(argumentValue(fallback), type)
        )
          rejectNode(parameter, 'PUI1006', 'Parameter default does not satisfy its type.');
        const optional =
          !!parameter.questionToken ||
          !!parameter.initializer ||
          (!parameter.type && !!this.parameterConstraint(parameter, node.body, outer)?.optional);
        const constantInput =
          staticParameters[index] ??
          (context === 'setup' && index > 0 && parameter.initializer
            ? (() => {
                const properties = staticOptionProperties(type, parameter.initializer);
                return properties && readsOnlyStaticOptions(node.body!, name, properties)
                  ? { properties, present: true }
                  : undefined;
              })()
            : undefined);
        scope.set(name, {
          type: optional && !fallback ? union([type, 'void'], parameter) : type,
          bindingId: `${module.file.fileName}#${parameter.pos}`,
          // A closed call may retain a literal input without changing the
          // author's scalar domain when that value initializes new storage.
          ...(typeof type !== 'string' &&
          type.kind === 'literal' &&
          (declared === 'boolean' || declared === 'number' || declared === 'string')
            ? { freshFieldType: declared }
            : {}),
          ...(parameterStateData[index] ? { stateData: parameterStateData[index] } : {}),
          ...(constantInput
            ? {
                staticProperties: constantInput.properties,
                staticObjectPresent: constantInput.present,
              }
            : {}),
        });
        return {
          name,
          type,
          bindingId: `${module.file.fileName}#${parameter.pos}`,
          ...(optional ? { optional: true } : {}),
          ...(parameter.dotDotDotToken ? { rest: true } : {}),
          ...(fallback ? { default: fallback } : {}),
        };
      });
      if (
        context === 'setup' &&
        ((parameters.length > 0 && parameters[0].type !== 'def') ||
          parameters.slice(1).some((parameter) => !parameter.default && !parameter.optional))
      )
        rejectNode(
          node,
          'PUI1006',
          'Setup receives one definition handle; further parameters must have defaults or be optional.'
        );
      const parameterCells: StatementIR[] = [];
      for (const parameter of parameters)
        if (parameterIsWritten(node.body, parameter.name)) {
          const incoming = scope.get(parameter.name)!,
            name = this.moduleName();
          const type: ValueType =
            incoming.type === 'boolean' || incoming.type === 'number' || incoming.type === 'string'
              ? `lexical:${incoming.type}`
              : { kind: 'cell', value: incoming.type };
          const bindingId = `${incoming.bindingId}#parameter-local`;
          const span = sourceSpan(
            node.parameters.find(
              (source) => ts.isIdentifier(source.name) && source.name.text === parameter.name
            )!
          );
          parameterCells.push({
            kind: 'const',
            name,
            bindingId,
            span,
            value: {
              kind: 'lexical-cell',
              value: {
                kind: 'reference',
                name: parameter.name,
                bindingId: incoming.bindingId,
                type: incoming.type,
                span,
              },
              type,
              span,
            },
          });
          scope.set(parameter.name, { type, lexical: incoming.type, emittedName: name, bindingId });
        }
      let body = ts.isBlock(node.body)
        ? this.statements(module, node.body.statements, scope, phase, names)
        : [
            {
              kind: 'return' as const,
              value: this.expression(
                module,
                node.body,
                scope,
                phase,
                undefined,
                this.returnContext
              ),
              span: sourceSpan(node.body),
            },
          ];
      body = prependInvocationStatements(body, parameterCells);
      // Hosts supply only the definition handle. Extra defaulted source formals
      // are ordinary invocation-local bindings, evaluated in source order once.
      // Normalizing them preserves the single-handle portable setup boundary.
      if (context === 'setup' && parameters.length > 1) {
        const defaults = parameters.splice(1).map((parameter): StatementIR => {
          const value = parameter.default ?? {
            kind: 'undefined' as const,
            type: 'void' as const,
            span: sourceSpan(node),
          };
          const type = parameter.default
            ? parameter.type
            : joinValueTypes([parameter.type, 'void']);
          return {
            kind: 'const',
            name: parameter.name,
            bindingId: parameter.bindingId,
            value: sameType(value.type, type)
              ? value
              : { kind: 'narrow', value, type, span: value.span },
            span: value.span,
          };
        });
        body = prependInvocationStatements(body, defaults);
      }
      const returns: ValueType[] = [];
      const gather = (items: readonly StatementIR[]): boolean => {
        for (const statement of items) {
          if (statement.kind === 'return') {
            returns.push(statement.value?.type ?? 'void');
            return true;
          }
          if (statement.kind === 'throw') return true;
          if (statement.kind === 'if') {
            const a = gather(statement.then),
              b = gather(statement.otherwise);
            if (a && b) return true;
          }
          if (statement.kind === 'while' || statement.kind === 'for-of') gather(statement.body);
          if (statement.kind === 'try') {
            const start = returns.length;
            const body = gather(statement.body);
            const caught = statement.catch ? gather(statement.catch.body) : true;
            const end = returns.length;
            const finalized = statement.finally ? gather(statement.finally) : false;
            if (finalized) returns.splice(start, end - start);
            if (finalized || (body && caught)) return true;
          }
        }
        return false;
      };
      if (!gather(body)) returns.push('void');
      let returnType: ValueType = returns.length ? union(returns, node) : 'void';
      if (this.returnContext) {
        const declared = this.returnContext;
        if (erasesRuntimeAuthority(returnType, declared))
          rejectNode(
            node.type ?? node,
            'PUI1006',
            'A return type cannot hide runtime callable or capability fields.'
          );
        if (returns.length && !assignable(returnType, declared))
          rejectNode(
            node.type ?? node,
            'PUI1006',
            'Function return does not satisfy its declared type.'
          );
        returnType = declared;
      }
      if (renderReturn && !isSetupResultType(returnType))
        rejectNode(node, 'PUI1006', 'Setup must return a render function or void.');
      const captures: NonNullable<FunctionIR['captures']> = [];
      const seen = new Set<string>();
      const outerBindings = new Map(
        [...outer]
          .filter(([, binding]) => !!binding.bindingId)
          .map(([name, binding]) => [
            binding.bindingId!,
            { name: binding.emittedName ?? name, binding },
          ])
      );
      const capture = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(capture);
          return;
        }
        const record = value as Record<string, unknown>;
        if (
          record.kind === 'reference' &&
          typeof record.bindingId === 'string' &&
          !seen.has(record.bindingId)
        ) {
          const resolved = outerBindings.get(record.bindingId);
          if (resolved) {
            seen.add(record.bindingId);
            captures.push({
              bindingId: record.bindingId,
              name: resolved.name,
              storage: lexicalStoredType(resolved.binding.type) ? 'cell' : 'value',
            });
          }
        }
        for (const [key, child] of Object.entries(record))
          if (key !== 'type' && key !== 'span' && key !== 'captures') capture(child);
      };
      capture(body);
      for (const parameter of parameters) capture(parameter.default);
      return {
        parameters,
        body,
        phase,
        context,
        returnType,
        ...(captures.length ? { captures } : {}),
        span: sourceSpan(node),
      };
    } finally {
      this.context = previousContext;
      this.returnContext = previousReturn;
      this.renderReturn = previousRenderReturn;
      this.flow = previousFlow;
      this.lexicalExecution = previousExecution;
    }
  }

  statements(
    module: SourceModule,
    nodes: readonly ts.Statement[],
    scope: Scope,
    phase: Phase,
    forbidden: ReadonlySet<string> = new Set()
  ): StatementIR[] {
    const output: StatementIR[] = [];
    this.statementPrefixes.push(output);
    try {
      return this.lowerStatements(module, nodes, scope, phase, forbidden, output);
    } finally {
      this.statementPrefixes.pop();
    }
  }

  private lowerStatements(
    module: SourceModule,
    nodes: readonly ts.Statement[],
    scope: Scope,
    phase: Phase,
    forbidden: ReadonlySet<string>,
    output: StatementIR[]
  ): StatementIR[] {
    const staticLocals = new Map<string, ts.Expression | undefined>(
      [...scope].map(([name, binding]) => [name, binding.staticData])
    );
    for (const [name, value] of staticLocalBindings(
      nodes,
      !scope.has('Object') && !module.declarations.has('Object') && !module.imports.has('Object')
    ))
      staticLocals.set(name, value);
    // A static outer iteration can expose an ordinary tuple iteration at this
    // same lexical level. Normalize the resulting statements until no source
    // form changes; every pass removes a supported loop/pattern form, without
    // evaluating an authored expression or changing runtime loop boundaries.
    for (;;) {
      const before = nodes;
      nodes = unrollStaticLoops(
        module,
        lowerObjectPatterns(
          lowerOrdinaryLoops(
            nodes,
            () => this.moduleName(),
            (name) =>
              !scope.has(name) &&
              !module.imports.has(name) &&
              !module.declarations.has(name) &&
              !nodes.some(
                (statement) =>
                  ts.isVariableStatement(statement) &&
                  statement.declarationList.declarations.some(
                    (declaration) =>
                      ts.isIdentifier(declaration.name) && declaration.name.text === name
                  )
              )
          )
        ),
        staticLocals
      );
      if (nodes.length === before.length && nodes.every((node, index) => node === before[index]))
        break;
    }
    const dormant = dormantSourceDeclarations(nodes);
    this.predeclare(module, nodes, scope, forbidden, dormant);
    // Callback declarations may precede props.define in the same setup block.
    // Discover only unconditional literal schemas; execution order is unchanged
    // in the emitted body and a conditional schema is not promoted.
    if (phase === 'setup')
      for (const statement of nodes) {
        if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression))
          continue;
        const call = statement.expression,
          member = call.expression;
        if (
          !ts.isPropertyAccessExpression(member) ||
          member.name.text !== 'define' ||
          !ts.isPropertyAccessExpression(member.expression) ||
          member.expression.name.text !== 'props' ||
          !ts.isIdentifier(member.expression.expression) ||
          scope.get(member.expression.expression.text)?.type !== 'def' ||
          call.arguments.length !== 1 ||
          !ts.isObjectLiteralExpression(call.arguments[0])
        )
          continue;
        const receiver = scope.get(member.expression.expression.text)!;
        // This metadata prepass cannot read a source alias before its declaration.
        // The ordinary statement pass will register that alias's schema in order.
        if (receiver.declarationScope === this.lexicalExecution && !receiver.initializerParsed)
          continue;
        this.expression(module, call, scope, phase);
      }
    for (const node of nodes) {
      const span = sourceSpan(node);
      if (ts.isVariableStatement(node)) {
        const mutable = !!(node.declarationList.flags & ts.NodeFlags.Let);
        if (!(node.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)))
          rejectNode(node, 'PUI1004', 'Use block-scoped const or let bindings.');
        for (const declaration of node.declarationList.declarations) {
          const name = identifier(declaration.name);
          const pending = scope.get(name)!;
          const uninitialized = !declaration.initializer;
          if (uninitialized && (!mutable || !declaration.type))
            rejectNode(
              declaration,
              'PUI1004',
              'An uninitialized binding requires an explicit let value type.'
            );
          if (dormant.has(declaration)) {
            // Preserve dormant declaration provenance without admitting its body.
            pending.initializerParsed = true;
            continue;
          }
          const init =
            declaration.initializer ??
            ts.setTextRange(ts.factory.createIdentifier('undefined'), declaration);
          if (uninitialized) (init as ts.Node & { parent: ts.Node }).parent = declaration;
          let value: ExpressionIR;
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            this.resolvePending(pending);
            value = pending.parsed!;
          } else {
            const expected =
              declaration.type && !uninitialized
                ? this.sourceValueType(module, declaration.type, this.sourceTypeScope(scope))
                : undefined;
            value = this.expression(module, init, scope, phase, undefined, expected);
            if (expected && erasesRuntimeAuthority(value.type, expected))
              rejectNode(
                declaration,
                'PUI1006',
                'A structural type view cannot hide runtime callable or capability fields.'
              );
            if (
              expected &&
              !assignable(value.type, expected) &&
              !assignable(argumentValue(value), expected)
            )
              rejectNode(declaration, 'PUI1006', 'Initializer does not satisfy its declared type.');
            if (expected && !sameType(value.type, expected))
              value = { kind: 'narrow', value, type: expected, span: sourceSpan(init) };
            const aliasName = value.kind === 'reference' ? value.name : undefined;
            const alias =
              aliasName !== undefined
                ? [...scope].find(
                    ([key, binding]) => (binding.emittedName ?? key) === aliasName
                  )?.[1]
                : undefined;
            const stateId =
              value.kind === 'operation' &&
              value.operation.startsWith('state.') &&
              OPERATION_RULES[value.operation].receiver === 'def' &&
              value.arguments[0]?.kind === 'literal'
                ? String(value.arguments[0].value)
                : stateValue(value.type) &&
                    (value.kind === 'member' ||
                      value.kind === 'call' ||
                      value.kind === 'helper-call')
                  ? // A handle read from a capture or returned by a helper is observed
                    // through this binding; its identity is the binding site.
                    `#observed:${value.span.file}:${value.span.start}`
                  : alias?.stateId;
            Object.assign(pending, {
              type: value.type,
              staticData: staticLocals.get(name),
              freshFieldType: !expected && !mutable ? alias?.freshFieldType : undefined,
              ...(!mutable ? { value } : {}),
              ...(alias?.helper ? { helper: alias.helper, phase: alias.phase } : {}),
              stateId,
              stateData: this.stateData(value, scope) ?? alias?.stateData,
              predicate:
                (value.kind === 'binary' || value.kind === 'unary') && stablePredicate(value)
                  ? value
                  : alias?.predicate,
              ...(value.kind === 'context-key'
                ? { keyId: value.keyId }
                : alias?.keyId
                  ? { keyId: alias.keyId }
                  : {}),
              ...(value.kind === 'style-handle'
                ? { style: value.handle }
                : alias?.style
                  ? { style: alias.style }
                  : {}),
            });
          }
          if (mutable) {
            const declared = declaration.type
              ? this.sourceValueType(module, declaration.type, this.sourceTypeScope(scope))
              : mutableScalarType(value.type);
            const type = uninitialized ? joinValueTypes([declared, 'void']) : declared;
            if (!assignable(value.type, type) && !assignable(argumentValue(value), type))
              rejectNode(declaration, 'PUI1006', 'Lexical initializer does not satisfy its type.');
            const cellType: ValueType =
              type === 'boolean' || type === 'number' || type === 'string'
                ? `lexical:${type}`
                : { kind: 'cell', value: type };
            Object.assign(pending, { type: cellType, lexical: uninitialized ? 'void' : type });
            value = {
              kind: 'lexical-cell',
              value,
              type: cellType,
              span: sourceSpan(init),
            };
          }
          if (!mutable) pending.constant = scalarConstant(value);
          pending.initializerParsed = true;
          scope.set(name, pending);
          output.push({
            kind: 'const',
            name: pending.emittedName ?? name,
            bindingId: pending.bindingId,
            value,
            span: sourceSpan(declaration),
          });
        }
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        if (dormant.has(node)) continue;
        const binding = scope.get(node.name.text)!;
        this.resolvePending(binding);
        output.unshift({
          kind: 'const',
          name: binding.emittedName ?? node.name.text,
          bindingId: binding.bindingId,
          value: binding.parsed!,
          declarationPosition: output.length,
          span,
        });
      } else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) continue;
      else if (ts.isExpressionStatement(node))
        output.push({
          kind: 'effect',
          expression: this.expression(module, node.expression, scope, phase),
          span,
        });
      else if (ts.isIfStatement(node)) {
        const condition = this.expression(module, node.expression, scope, phase);
        const incoming = this.flow;
        this.flow = incoming.fork();
        const thenScope = this.refinedScope(scope, condition, true);
        const then = this.statements(
          module,
          ts.isBlock(node.thenStatement) ? node.thenStatement.statements : [node.thenStatement],
          thenScope,
          phase
        );
        this.normalizeFlow(thenScope);
        const thenFlow = this.flow;
        this.flow = incoming.fork();
        const elseScope = this.refinedScope(scope, condition, false);
        const otherwise = node.elseStatement
          ? this.statements(
              module,
              ts.isBlock(node.elseStatement) ? node.elseStatement.statements : [node.elseStatement],
              elseScope,
              phase
            )
          : [];
        this.normalizeFlow(elseScope);
        const elseFlow = this.flow;
        output.push({ kind: 'if', condition, then, otherwise, span });
        const paths = [
          ...(!statementsTerminate(then) ? [{ scope: thenScope, flow: thenFlow }] : []),
          ...(!statementsTerminate(otherwise) ? [{ scope: elseScope, flow: elseFlow }] : []),
        ];
        if (paths.length === 1) {
          const continuing = paths[0].scope;
          this.flow = paths[0].flow;
          for (const [name, binding] of scope) {
            const next = continuing.get(name)!;
            if (next.bindingId === binding.bindingId)
              scope.set(name, {
                ...next,
                ...(next.lexical
                  ? { flowAt: this.flow.mark(next.bindingId ?? next.emittedName ?? name) }
                  : {}),
              });
          }
        } else {
          const joined = paths.length
            ? paths
            : [
                { scope: thenScope, flow: thenFlow },
                { scope: elseScope, flow: elseFlow },
              ];
          this.flow = incoming.join(joined.map((path) => path.flow));
          this.joinFlowScopes(
            scope,
            joined.map((path) => path.scope)
          );
        }
      } else if (ts.isWhileStatement(node)) {
        this.invalidateFlow(scope, true);
        const condition = this.expression(module, node.expression, scope, phase);
        const body = this.statements(
          module,
          ts.isBlock(node.statement) ? node.statement.statements : [node.statement],
          this.refinedScope(scope, condition, true),
          phase
        );
        output.push({ kind: 'while', condition, body, span });
        this.invalidateFlow(scope, true);
      } else if (ts.isForOfStatement(node)) {
        if (
          node.awaitModifier ||
          !ts.isVariableDeclarationList(node.initializer) ||
          !(node.initializer.flags & ts.NodeFlags.Const) ||
          node.initializer.declarations.length !== 1 ||
          !ts.isIdentifier(node.initializer.declarations[0].name)
        )
          rejectNode(node, 'PUI1004', 'Iteration requires one block-scoped const value binding.');
        const declaration = node.initializer.declarations[0],
          name = identifier(declaration.name);
        const iterable = this.expression(module, node.expression, scope, phase);
        const type = iterableElementType(iterable.type);
        if (type === undefined)
          rejectNode(node.expression, 'PUI1006', 'Iteration requires a checked array or set.');
        const bodyScope = new Map(scope),
          bindingId = this.bindingIdentity(module, declaration, name);
        bodyScope.set(name, { type, bindingId });
        const body = this.statements(
          module,
          ts.isBlock(node.statement) ? node.statement.statements : [node.statement],
          bodyScope,
          phase,
          new Set([name])
        );
        output.push({ kind: 'for-of', name, bindingId, iterable, body, span });
        this.invalidateFlow(scope, true);
      } else if (ts.isThrowStatement(node)) {
        const value = this.expression(module, node.expression, scope, phase);
        if (serializableDataType(value.type) === undefined && value.type !== 'exception')
          rejectNode(
            node.expression,
            'PUI1006',
            'Thrown values must be admitted data or a caught exception.'
          );
        output.push({ kind: 'throw', value, span });
      } else if (ts.isTryStatement(node)) {
        const bodyScope = new Map(scope);
        const body = this.statements(module, node.tryBlock.statements, bodyScope, phase);
        this.invalidateFlow(scope, true);
        let catchScope: Scope | undefined;
        let caught: Extract<StatementIR, { kind: 'try' }>['catch'];
        if (node.catchClause) {
          catchScope = new Map(scope);
          const binding = node.catchClause.variableDeclaration;
          const name = binding ? identifier(binding.name) : undefined;
          if (name !== undefined) {
            if (catchScope.has(name) || module.imports.has(name))
              rejectNode(binding!, 'PUI1005', `Shadowing/rebinding ${name} is not admitted.`);
            if (
              binding?.type &&
              binding.type.kind !== ts.SyntaxKind.UnknownKeyword &&
              binding.type.kind !== ts.SyntaxKind.AnyKeyword
            )
              rejectNode(
                binding.type,
                'PUI1006',
                'A catch binding remains an untrusted exception value.'
              );
            catchScope.set(name, { type: 'exception' });
          }
          caught = {
            ...(name === undefined ? {} : { name }),
            body: this.statements(module, node.catchClause.block.statements, catchScope, phase),
          };
        }
        output.push({
          kind: 'try',
          body,
          ...(caught ? { catch: caught } : {}),
          ...(node.finallyBlock
            ? {
                finally: this.statements(
                  module,
                  node.finallyBlock.statements,
                  new Map(scope),
                  phase
                ),
              }
            : {}),
          span,
        });
        this.invalidateFlow(scope, true);
        // A caught exception may occur before any write. Only continuing
        // branches contribute a post-try value; terminating catches cannot
        // erase a definite assignment on the successful path.
        if (!node.finallyBlock)
          for (const [name, binding] of scope) {
            if (!binding.lexical) continue;
            const continuing: ValueType[] = [];
            if (!statementsTerminate(body))
              continuing.push(bodyScope.get(name)?.lexical ?? binding.lexical);
            if (caught && !statementsTerminate(caught.body))
              continuing.push(catchScope?.get(name)?.lexical ?? binding.lexical);
            if (continuing.length)
              scope.set(name, {
                ...binding,
                lexical: joinValueTypes(continuing),
                flowAt: this.flow.mark(binding.bindingId ?? binding.emittedName ?? name),
              });
          }
      } else if (ts.isReturnStatement(node)) {
        if (!node.expression) output.push({ kind: 'return', span });
        else if (
          this.renderReturn &&
          (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression))
        ) {
          const fn = this.function(module, node.expression, scope, 'render', ['render']);
          output.push({
            kind: 'return',
            value: {
              kind: 'function',
              type: functionValueType(fn),
              function: fn,
              span: sourceSpan(node.expression),
            },
            span,
          });
        } else
          output.push({
            kind: 'return',
            value: this.expression(
              module,
              node.expression,
              scope,
              phase,
              undefined,
              this.returnContext
            ),
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
    argumentRule?: ArgumentRule,
    expectedType?: ValueType
  ): ExpressionIR {
    this.normalizeFlow(scope);
    const read = () => this.expressionValue(module, node, scope, phase, argumentRule, expectedType);
    const value =
      argumentRule &&
      [
        'static-key',
        'finite-key',
        'static-keys',
        'prop-key',
        'declared-prop-keys',
        'declared-event-key',
      ].includes(argumentRule.role)
        ? this.withStaticValues(read)
        : read();
    if (
      value.kind === 'intrinsic' &&
      /^(array\.(every|some|filter|find|findIndex|map|flatMap|forEach|reduce|sort|push|shift|pop)|set\.(add|delete|clear))$/.test(
        value.name
      )
    )
      this.invalidateFlow(scope, true);
    if (
      value.kind === 'intrinsic' &&
      ['object.assign', 'string', 'number', 'console.warn'].includes(value.name)
    )
      this.invalidateFlow(scope, true, true);
    this.flow.observe(value);
    return value;
  }

  private expressionValue(
    module: SourceModule,
    node: ts.Expression,
    scope: Scope,
    phase: Phase,
    argumentRule?: ArgumentRule,
    expectedType?: ValueType
  ): ExpressionIR {
    if (ts.isParenthesizedExpression(node))
      return this.expression(module, node.expression, scope, phase, argumentRule, expectedType);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      // Erased `any` never changes the operand's checked provenance or type.
      if (node.type.kind === ts.SyntaxKind.AnyKeyword)
        return this.expression(module, node.expression, scope, phase, argumentRule, expectedType);
      const constant =
        ts.isTypeReferenceNode(node.type) &&
        ts.isIdentifier(node.type.typeName) &&
        node.type.typeName.text === 'const';
      const asserted = constant
        ? undefined
        : this.sourceValueType(module, node.type, this.substitutions);
      const value = this.expression(
        module,
        node.expression,
        scope,
        phase,
        argumentRule,
        asserted ?? expectedType
      );
      if (constant && value.kind === 'literal')
        return { ...value, type: { kind: 'literal', value: value.value } };
      if (
        constant &&
        value.kind === 'array' &&
        value.elements.length > 0 &&
        value.elements.every(
          (element) => element.kind === 'literal' && typeof element.value === 'string'
        )
      ) {
        const elements = value.elements.map((element) => {
          if (element.kind !== 'literal') return element;
          return { ...element, type: { kind: 'literal' as const, value: element.value } };
        });
        return {
          ...value,
          elements,
          type: {
            kind: 'array',
            element: parseDataType({
              kind: 'union',
              members: elements.map((element) => element.type),
            }),
          },
        };
      }
      if (constant && (value.kind === 'array' || value.kind === 'array-spread')) {
        const readonly = readonlyLiteralType(value.type);
        return sameType(value.type, readonly)
          ? value
          : { kind: 'narrow', value, type: readonly, span: sourceSpan(node) };
      }
      if (asserted && value.type === 'unknown') {
        // Only contiguous erased assertions can retain this operand's proof.
        // Every inner assertion has already passed its ordinary checks above.
        let operand = node.expression,
          original = value;
        for (;;) {
          if (ts.isParenthesizedExpression(operand)) {
            operand = operand.expression;
            continue;
          }
          if (!ts.isAsExpression(operand) && !ts.isTypeAssertionExpression(operand)) break;
          const span = sourceSpan(operand);
          if (
            original.kind === 'narrow' &&
            original.span.file === span.file &&
            original.span.start === span.start &&
            original.span.end === span.end
          )
            original = original.value;
          operand = operand.expression;
        }
        if (
          original !== value &&
          typeof original.type === 'string' &&
          !isDataValueType(original.type) &&
          sameType(original.type, asserted)
        )
          return original;
      }
      // Scalar assertions are erased without changing the actual value's proof.
      // In particular `dynamicKey as keyof T` cannot invent a static key, while
      // a known custom string remains that string even if T omits its spelling.
      if (
        asserted &&
        (['string', 'number', 'boolean'] as const).some(
          (primitive) => assignable(value.type, primitive) && assignable(asserted, primitive)
        )
      )
        return value;
      if (asserted && canNarrowValue(value.type, asserted) && !sameType(value.type, asserted))
        return { kind: 'narrow', value, type: asserted, span: sourceSpan(node) };
      if (
        value.type !== 'exception' &&
        asserted &&
        !assignable(value.type, asserted) &&
        !assignable(argumentValue(value), asserted)
      )
        rejectNode(
          node,
          'PUI1006',
          'A type assertion cannot grant unproven data or capability provenance.'
        );
      return value;
    }
    if (ts.isSatisfiesExpression(node))
      return this.expression(
        module,
        node.expression,
        scope,
        phase,
        argumentRule,
        this.sourceValueType(module, node.type, this.substitutions)
      );
    if (ts.isNonNullExpression(node)) {
      const value = this.expression(
          module,
          node.expression,
          scope,
          phase,
          argumentRule,
          expectedType
        ),
        type = joinValueTypes(
          valueAlternatives(value.type)
            .filter((type) => type !== 'null' && type !== 'void')
            .map((type) =>
              typeof type === 'string' && /^(nullable|optional):/.test(type)
                ? (type.slice(type.indexOf(':') + 1) as ValueType)
                : type
            )
        );
      return { kind: 'narrow', value, type, span: sourceSpan(node) };
    }
    const span = sourceSpan(node);
    const literalType = (value: string | number | boolean | null): ValueType =>
      expectedType && assignable({ kind: 'literal', value }, expectedType)
        ? { kind: 'literal', value }
        : value === null
          ? 'null'
          : (typeof value as ValueType);
    const globalConstantPath = ecmaSourcePath(node);
    const globalConstant =
      globalConstantPath &&
      !scope.has(globalConstantPath[0]) &&
      !module.declarations.has(globalConstantPath[0]) &&
      !module.imports.has(globalConstantPath[0])
        ? ecmaConstantValue(globalConstantPath)
        : undefined;
    if (globalConstant !== undefined)
      return { kind: 'literal', value: globalConstant, type: literalType(globalConstant), span };
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
      return {
        kind: 'literal',
        value: node.kind === ts.SyntaxKind.TrueKeyword,
        type: literalType(node.kind === ts.SyntaxKind.TrueKeyword),
        span,
      };
    if (node.kind === ts.SyntaxKind.NullKeyword)
      return { kind: 'literal', value: null, type: 'null', span };
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return { kind: 'literal', value: node.text, type: literalType(node.text), span };
    const membership = staticScalarMembership(node);
    if (
      membership !== undefined &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      // Validate all literal nodes and type views before using the syntactic
      // proof. No authored call, getter, search coercion or module executes.
      this.expression(module, node.expression.expression, scope, phase);
      this.expression(module, node.arguments[0], scope, phase);
      return { kind: 'literal', value: membership, type: literalType(membership), span };
    }
    const joined = staticJoin(node);
    if (joined) {
      // Folded at compile time: a join of finite literal strings is itself a
      // literal, so nothing is evaluated when the artifact loads.
      const parts = this.staticStrings(this.expression(module, joined.receiver, scope, phase));
      if (parts) {
        const value = parts.join(joined.separator ? joined.separator.text : ',');
        return { kind: 'literal', value, type: literalType(value), span };
      }
      // Non-static receivers use the checked ordinary array operation below.
    }
    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text);
      if (!Number.isFinite(value)) rejectNode(node, 'PUI1006', 'Numeric literals must be finite.');
      return { kind: 'literal', value, type: literalType(value), span };
    }
    if (ts.isIdentifier(node)) {
      const binding = scope.get(node.text);
      this.requireInitializedBinding(binding, node);
      if (binding?.uninitializedParameter)
        rejectNode(
          node,
          'PUI1006',
          'A parameter default cannot read its current or a later uninitialized parameter.'
        );
      if (binding) this.resolvePending(binding);
      if (
        binding?.constant &&
        !binding.lexical &&
        this.resolvingStaticValues &&
        !this.preservingBindingReferences
      )
        return binding.constant.value === undefined
          ? { kind: 'undefined', type: 'void', span }
          : {
              kind: 'literal',
              value: binding.constant.value,
              type: { kind: 'literal', value: binding.constant.value },
              span,
            };
      if (binding?.lexical)
        return {
          kind: 'lexical-read',
          cell: {
            kind: 'reference',
            name: binding.emittedName ?? node.text,
            bindingId: binding.bindingId,
            type: binding.type,
            span,
          },
          type: binding.lexical,
          span,
        };
      if (binding)
        return binding.keyId
          ? { kind: 'context-key', keyId: binding.keyId, type: 'context-key', span }
          : {
              kind: 'reference',
              name: binding.emittedName ?? node.text,
              bindingId: binding.bindingId,
              type: binding.type,
              span,
            };
      if (module.declarations.has(node.text) || module.imports.has(node.text)) {
        const resolved = this.graph.resolveBinding(module, node.text);
        if (
          resolved.module === null &&
          resolved.imported.module === '@proto.ui/core' &&
          Object.hasOwn(STATIC_CORE_VALUES, resolved.name)
        ) {
          const data = (value: import('./ir').StaticValue): ExpressionIR => {
            if (Array.isArray(value)) {
              const elements = value.map(data);
              return {
                kind: 'array',
                elements,
                type: {
                  kind: 'array',
                  element: parseDataType({
                    kind: 'union',
                    members: elements.map((element) => element.type),
                  }),
                },
                span,
              };
            }
            if (value !== null && typeof value === 'object') {
              const entries = Object.entries(value).map(([key, value]) => ({
                key,
                value: data(value),
              }));
              return {
                kind: 'record',
                entries,
                type: {
                  kind: 'record',
                  fields: entries.map((entry) => ({
                    name: entry.key,
                    type: entry.value.type as DataType,
                  })),
                },
                span,
              };
            }
            return {
              kind: 'literal',
              value: value as import('./ir').Primitive,
              type: value === null ? 'null' : (typeof value as ValueType),
              span,
            };
          };
          return data(STATIC_CORE_VALUES[resolved.name]);
        }
        if (resolved.module && isSourceFunction(resolved.node)) {
          const helper = this.moduleHelper(
            resolved.module,
            resolved.name,
            resolved.node,
            [],
            undefined
          );
          return { kind: 'reference', name: helper.name, type: functionValueType(helper.fn), span };
        }
        if (resolved.module && moduleDataNode(resolved.node)) {
          const binding = this.moduleValue(
            resolved.module,
            resolved.name,
            resolved.node as ts.Expression
          );
          const reference: ExpressionIR = {
            kind: 'reference',
            name: binding.name,
            type: binding.type,
            span,
          };
          if (binding.lexical) {
            let local = scope.get(binding.name);
            if (!local) {
              local = { ...binding, emittedName: binding.name };
              scope.set(binding.name, local);
            }
            return { kind: 'lexical-read', cell: reference, type: local.lexical!, span };
          }
          return reference;
        }
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
      if (node.text === 'undefined') return { kind: 'undefined', type: 'void', span };
      rejectNode(
        node,
        'PUI1005',
        `Unresolved capture ${node.text}; only declared lexical values and semantic handles are admitted.`
      );
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const expected = contextualCallable(expectedType);
      const fn = this.function(
        module,
        node,
        scope,
        this.helperPhase(module, node, scope),
        expected?.parameters.map((parameter) => parameter.type) ?? [],
        'helper',
        this.retainingCallerShapes ||
          expected?.returnType === 'unknown' ||
          expected?.returnType === 'void'
          ? undefined
          : expected?.returnType
      );
      return { kind: 'function', function: fn, type: functionValueType(fn), span };
    }
    if (ts.isTypeOfExpression(node))
      return {
        kind: 'intrinsic',
        name: 'typeof',
        arguments: [this.expression(module, node.expression, scope, phase)],
        type: 'string',
        span,
      };
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Map' &&
      !scope.has('Map') &&
      !module.declarations.has('Map') &&
      !module.imports.has('Map')
    ) {
      const contextual =
        expectedType &&
        valueAlternatives(expectedType).find(
          (type) => typeof type !== 'string' && type.kind === 'map'
        );
      if ((node.arguments?.length ?? 0) !== 0 || (!node.typeArguments?.length && !contextual))
        rejectNode(
          node,
          'PUI1006',
          'Map construction requires an explicit or contextual finite key/value type and no initializer.'
        );
      const declared: ValueType =
        node.typeArguments?.length === 2
          ? {
              kind: 'map',
              key: this.sourceValueType(module, node.typeArguments[0], this.sourceTypeScope(scope)),
              value: this.sourceValueType(
                module,
                node.typeArguments[1],
                this.sourceTypeScope(scope)
              ),
            }
          : contextual!;
      return {
        kind: 'intrinsic',
        name: 'map.create',
        arguments: [],
        type: this.checkedValue(node, () => intrinsicResult('map.create', [], [], declared)),
        span,
      };
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Set' &&
      !scope.has('Set') &&
      !module.declarations.has('Set') &&
      !module.imports.has('Set')
    ) {
      const args = (node.arguments ?? []).map((argument) =>
        this.expression(module, argument, scope, phase)
      );
      const contextual =
        expectedType &&
        valueAlternatives(expectedType).find(
          (type) => typeof type !== 'string' && type.kind === 'set'
        );
      const declared: ValueType = {
        kind: 'set',
        element: node.typeArguments?.[0]
          ? this.sourceValueType(module, node.typeArguments[0], this.substitutions)
          : contextual && typeof contextual !== 'string' && contextual.kind === 'set'
            ? contextual.element
            : args[0]
              ? (iterableElementType(args[0].type) ?? 'unknown')
              : { kind: 'union', members: [] },
      };
      const type = this.checkedValue(node, () =>
        intrinsicResult(
          'set.create',
          args.map((arg) => arg.type),
          args,
          declared
        )
      );
      return { kind: 'intrinsic', name: 'set.create', arguments: args, type, span };
    }
    if (ts.isRegularExpressionLiteral(node)) {
      let literal: { pattern: string; flags: string };
      try {
        literal = ecmaRegexLiteral(node.text);
      } catch (error) {
        rejectNode(
          node,
          'PUI1006',
          error instanceof Error ? error.message : 'Invalid regular-expression literal.'
        );
      }
      const args: ExpressionIR[] = [literal.pattern, literal.flags].map((value) => ({
        kind: 'literal',
        value,
        type: 'string',
        span,
      }));
      return { kind: 'intrinsic', name: 'regexp.create', arguments: args, type: 'regexp', span };
    }
    if (ts.isNewExpression(node)) {
      const path = ecmaSourcePath(node.expression);
      const name =
        path &&
        !scope.has(path[0]) &&
        !module.declarations.has(path[0]) &&
        !module.imports.has(path[0])
          ? ecmaConstructorName(path)
          : undefined;
      if (name) {
        if (node.typeArguments?.length)
          rejectNode(node, 'PUI1006', 'This ECMAScript constructor does not admit type arguments.');
        const args = (node.arguments ?? []).map((argument) =>
          this.expression(module, argument, scope, phase)
        );
        const type = this.checkedValue(node, () =>
          intrinsicResult(
            name,
            args.map((arg) => arg.type),
            args
          )
        );
        return { kind: 'intrinsic', name, arguments: args, type, span };
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Error' &&
      !scope.has('Error') &&
      !module.declarations.has('Error') &&
      !module.imports.has('Error')
    ) {
      const args = (node.arguments ?? []).map((argument) =>
        this.expression(module, argument, scope, phase)
      );
      const type = this.checkedValue(node, () =>
        intrinsicResult(
          'error',
          args.map((arg) => arg.type)
        )
      );
      return { kind: 'intrinsic', name: 'error', arguments: args, type, span };
    }
    if (ts.isConditionalExpression(node)) {
      const condition = this.expression(module, node.condition, scope, phase);
      const incoming = this.flow;
      this.flow = incoming.fork();
      const thenScope = this.refinedScope(scope, condition, true);
      let then = this.expression(
        module,
        node.whenTrue,
        thenScope,
        phase,
        argumentRule,
        expectedType
      );
      this.normalizeFlow(thenScope);
      const thenFlow = this.flow;
      this.flow = incoming.fork();
      const elseScope = this.refinedScope(scope, condition, false);
      let otherwise = this.expression(
        module,
        node.whenFalse,
        elseScope,
        phase,
        argumentRule,
        expectedType
      );
      this.normalizeFlow(elseScope);
      this.flow = incoming.join([thenFlow, this.flow]);
      this.joinFlowScopes(scope, [thenScope, elseScope]);
      if (then.kind === 'literal' && then.value !== null)
        then = { ...then, type: { kind: 'literal', value: then.value } };
      if (otherwise.kind === 'literal' && otherwise.value !== null)
        otherwise = { ...otherwise, type: { kind: 'literal', value: otherwise.value } };
      const mutableArray = (type: ValueType) =>
        valueAlternatives(type).some(
          (member) =>
            typeof member !== 'string' && member.kind === 'value-array' && !member.readonly
        );
      if (mutableArray(then.type) || mutableArray(otherwise.type)) {
        if (then.kind === 'array' && typeof then.type !== 'string' && then.type.kind === 'array')
          then = { ...then, type: ordinaryArrayType(then.type.element) };
        if (
          otherwise.kind === 'array' &&
          typeof otherwise.type !== 'string' &&
          otherwise.type.kind === 'array'
        )
          otherwise = { ...otherwise, type: ordinaryArrayType(otherwise.type.element) };
      }
      return {
        kind: 'conditional',
        condition,
        then,
        otherwise,
        type: joinValueTypes([then.type, otherwise.type]),
        span,
      };
    }
    if (ts.isArrayLiteralExpression(node)) {
      const expectedElement = expectedType ? arrayElementType(expectedType) : undefined;
      const parts: Extract<ExpressionIR, { kind: 'array-spread' }>['parts'] = [];
      let dynamicSpread = false;
      const elements = node.elements.flatMap((element) => {
        if (!ts.isSpreadElement(element)) {
          const value = this.expression(module, element, scope, phase, undefined, expectedElement);
          parts.push({ spread: false, value });
          return [value];
        }
        const spread = this.expression(module, element.expression, scope, phase);
        const array = this.staticArray(spread);
        // Inline arrays are evaluated here once. Replaying a shared initializer
        // is safe only for primitive literals: records, nested arrays and reads
        // would otherwise recreate identities or repeat evaluation.
        if (
          !array ||
          (spread.kind !== 'array' &&
            !array.elements.every((item) => {
              while (item.kind === 'narrow') item = item.value;
              return item.kind === 'literal';
            }))
        ) {
          if (iterableElementType(spread.type) === undefined)
            rejectNode(element, 'PUI1004', 'Array spread requires a checked iterable.');
          dynamicSpread = true;
          parts.push({ spread: true, value: spread });
          return [];
        }
        parts.push(...array.elements.map((value) => ({ spread: false, value })));
        return array.elements;
      });
      if (dynamicSpread)
        return {
          kind: 'array-spread',
          parts,
          type: ordinaryArrayType(
            joinValueTypes(
              parts.map((part) =>
                part.spread ? iterableElementType(part.value.type)! : part.value.type
              )
            )
          ),
          span,
        };
      const elementTypes = elements.map((element) => element.type);
      if (expectedType && typeof expectedType !== 'string' && expectedType.kind === 'value-array')
        return {
          kind: 'array',
          type: ordinaryArrayType(joinValueTypes(elementTypes)),
          elements,
          span,
        };
      if (!elementTypes.every(isDataValueType)) {
        if (elementTypes.every((type) => type === 'a11y-ref'))
          return { kind: 'array', type: 'a11y-ref-list', elements, span };
        // Nested ordinary data arrays are also valid template children. Keep
        // their actual data/storage identity instead of erasing them to the
        // renderer-only array marker merely because both views are possible.
        if (
          elementTypes.every(isTemplateChildType) &&
          !elementTypes.every((type) => serializableDataType(type) !== undefined)
        )
          return { kind: 'array', type: 'array', elements, span };
        return {
          kind: 'array',
          type: ordinaryArrayType(joinValueTypes(elementTypes)),
          elements,
          span,
        };
      }
      return {
        kind: 'array',
        type: ordinaryArrayType(
          parseDataType({ kind: 'union', members: elementTypes }),
          !!expectedType && typeof expectedType !== 'string' && expectedType.kind === 'array'
        ),
        elements,
        span,
      };
    }
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set<string>();
      const parts: Extract<ExpressionIR, { kind: 'object-spread' }>['parts'] = [];
      const entries: Extract<ExpressionIR, { kind: 'record' }>['entries'] = [];
      const fields = new Map<
        string,
        { name: string; type: ValueType; optional?: boolean; readonly?: boolean; accessor?: 'get' }
      >();
      const entry = (
        property: ts.ObjectLiteralElementLike
      ): Extract<ExpressionIR, { kind: 'record' }>['entries'][number] => {
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isShorthandPropertyAssignment(property) &&
          !ts.isMethodDeclaration(property) &&
          !ts.isGetAccessorDeclaration(property)
        )
          rejectNode(property, 'PUI1004', 'Object members require data or ordinary methods.');
        if (ts.isGetAccessorDeclaration(property) && ts.isComputedPropertyName(property.name))
          rejectNode(property, 'PUI1004', 'Getter names require a static identifier or string.');
        const computed = ts.isComputedPropertyName(property.name)
          ? scalarConstant(
              this.withStaticValues(() =>
                this.expression(
                  module,
                  (property.name as ts.ComputedPropertyName).expression,
                  scope,
                  phase
                )
              )
            )
          : undefined;
        const key = ts.isComputedPropertyName(property.name)
          ? typeof computed?.value === 'string' && computed.value
            ? computed.value
            : rejectNode(
                property.name,
                'PUI1004',
                'Computed object keys require an immutable checked string constant.'
              )
          : propertyName(property.name);
        if (keys.has(key)) rejectNode(property, 'PUI1006', `Duplicate object key ${key}.`);
        keys.add(key);
        const expectedFields = expectedType
          ? valueAlternatives(expectedType).flatMap((type) =>
              (objectFields(type) ?? [])
                .filter((field) => field.name === key)
                .map((field) => field.type)
            )
          : [];
        const expected = expectedFields.length ? joinValueTypes(expectedFields) : undefined;
        if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)) {
          if (ts.isGetAccessorDeclaration(property) && property.parameters.length)
            rejectNode(property, 'PUI1006', 'A getter cannot declare parameters.');
          const signature = contextualCallable(expected);
          const fn = this.function(
            module,
            property,
            scope,
            this.helperPhase(module, property, scope),
            signature?.parameters.map((parameter) => parameter.type) ?? [],
            'helper',
            this.retainingCallerShapes ||
              signature?.returnType === 'unknown' ||
              signature?.returnType === 'void'
              ? undefined
              : signature?.returnType
          );
          return {
            key,
            ...(ts.isGetAccessorDeclaration(property) ? { accessor: 'get' as const } : {}),
            value: {
              kind: 'function',
              function: fn,
              type: functionValueType(fn),
              span: sourceSpan(property),
            } as ExpressionIR,
          };
        }
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
        let value = this.expression(module, initializer, scope, phase, field, expected);
        let source = initializer;
        while (ts.isParenthesizedExpression(source)) source = source.expression;
        const freshFieldType =
          !expected && !field && ts.isIdentifier(source)
            ? scope.get(source.text)?.freshFieldType
            : undefined;
        if (freshFieldType && assignable(value.type, freshFieldType))
          // Keep the exact parameter/capture proof. Only the copied scalar in
          // this fresh, unannotated field acquires its declared writable domain.
          value = { kind: 'narrow', value, type: freshFieldType, span: value.span };
        return { key, value };
      };
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          const value = this.expression(module, property.expression, scope, phase);
          const spread = checkedSpreadFields(value.type, (id) => this.captureFields(id));
          if (!spread)
            rejectNode(property, 'PUI1006', 'Object spread requires a checked ordinary record.');
          parts.push({ kind: 'spread', value });
          for (const field of spread)
            mergeSpreadField(fields, spreadObjectField(fields.get(field.name), field));
          if (hasAccessorField(value.type)) this.invalidateFlow(scope, true, true);
        } else {
          const parsed = entry(property);
          entries.push(parsed);
          parts.push({ kind: 'entry', ...parsed });
          fields.set(
            parsed.key,
            parsed.accessor === 'get' && parsed.value.kind === 'function'
              ? {
                  name: parsed.key,
                  type: parsed.value.function.returnType,
                  readonly: true,
                  accessor: 'get',
                }
              : { name: parsed.key, type: parsed.value.type }
          );
        }
      }
      if (node.properties.some(ts.isSpreadAssignment))
        return { kind: 'object-spread', parts, type: objectValueType([...fields.values()]), span };
      if (entries.some((entry) => entry.accessor))
        return {
          kind: 'record',
          entries,
          type: { kind: 'object', fields: [...fields.values()] },
          span,
        };
      if (entries.some((entry) => !isDataValueType(entry.value.type))) {
        if (
          phase === 'render' &&
          entries.length === 1 &&
          entries[0].key === 'style' &&
          entries[0].value.type === 'style-handle'
        )
          return { kind: 'record', type: 'template-props', entries, span };
        if (!argumentRule?.types?.includes('module-config'))
          return {
            kind: 'record',
            entries,
            type: {
              kind: 'object',
              fields: entries.map((entry) => ({ name: entry.key, type: entry.value.type })),
            },
            span,
          };
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
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      const cell = this.lexicalTarget(module, node.operand, scope);
      if (lexicalValueType(cell.type) !== 'number')
        rejectNode(node, 'PUI1006', 'Lexical increment/decrement requires a number.');
      if (cell.kind === 'reference') this.flow.writeCell(cell.bindingId ?? cell.name);
      return {
        kind: 'lexical-update',
        cell,
        delta: node.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1,
        prefix: ts.isPrefixUnaryExpression(node),
        type: 'number',
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
      if (
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        if (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) {
          if (operator !== '=')
            rejectNode(
              node,
              'PUI1004',
              'Compound property writes require an explicit read and assignment.'
            );
          const property = ts.isPropertyAccessExpression(node.left)
            ? node.left.name.text
            : ts.isStringLiteral(node.left.argumentExpression)
              ? node.left.argumentExpression.text
              : undefined;
          if (property === undefined)
            rejectNode(node.left, 'PUI1004', 'Member writes require a static key.');
          let object = this.expression(module, node.left.expression, scope, phase);
          const base = this.originalValueType(object, scope);
          const widened = invalidateHeapFlow(
            object.type,
            base,
            new Set(
              valueAlternatives(base).flatMap(
                (type) => objectFields(type)?.map((field) => field.name) ?? []
              )
            )
          );
          if (!sameType(object.type, widened))
            object = { kind: 'narrow', value: object, type: widened, span: object.span };
          const field =
            objectFields(object.type)?.find((field) => field.name === property) ??
            (typeof object.type !== 'string' &&
            object.type.kind === 'object' &&
            object.type.index !== undefined
              ? { name: property, type: object.type.index }
              : undefined);
          if (!field || field.readonly)
            rejectNode(
              node.left,
              'PUI1006',
              'Member write requires a declared mutable ordinary field.'
            );
          const value = this.expression(module, node.right, scope, phase, undefined, field.type);
          if (!assignable(value.type, field.type))
            rejectNode(node.right, 'PUI1006', 'Member write type mismatch.');
          this.invalidateFlow(scope, false, true);
          return { kind: 'member-write', object, property, value, type: value.type, span };
        }
        const cell = this.lexicalTarget(module, node.left, scope);
        const type = lexicalStoredType(cell.type)!;
        const left: ExpressionIR = {
          kind: 'lexical-read',
          cell,
          type,
          span: sourceSpan(node.left),
        };
        this.flow.observe(left);
        let value = ['&&=', '||=', '??='].includes(operator)
          ? this.conditionalRight(
              module,
              node.right,
              scope,
              phase,
              left,
              operator.slice(0, -1),
              type
            )
          : this.expression(module, node.right, scope, phase, undefined, type);
        if (operator !== '=') {
          const binary = operator.slice(0, -1);
          if (!['+', '-', '*', '/', '%', '&&', '||', '??'].includes(binary))
            rejectNode(node.operatorToken, 'PUI1004', 'Unsupported lexical assignment operator.');
          const result =
            binary === '??'
              ? joinValueTypes([
                  ...valueAlternatives(type).filter(
                    (member) => member !== 'null' && member !== 'void'
                  ),
                  value.type,
                ])
              : isDataValueType(type) && isDataValueType(value.type)
                ? this.checkedData(node, () =>
                    inferBinaryType(binary, type as DataType, value.type as DataType)
                  )
                : rejectNode(
                    node,
                    'PUI1006',
                    'Compound arithmetic requires primitive data storage.'
                  );
          value = {
            kind: 'binary',
            operator: binary as Extract<ExpressionIR, { kind: 'binary' }>['operator'],
            left,
            right: value,
            type: result,
            span,
          };
        }
        if (!assignable(value.type, type))
          rejectNode(node.right, 'PUI1006', 'Lexical write does not satisfy its declared type.');
        if (cell.kind === 'reference') {
          const entry = [...scope].find(
            ([name, binding]) => (binding.emittedName ?? name) === cell.name
          );
          if (entry) {
            this.flow.writeCell(entry[1].bindingId ?? entry[1].emittedName ?? entry[0]);
            scope.set(entry[0], {
              ...entry[1],
              lexical: value.type,
              flowAt: this.flow.mark(entry[1].bindingId ?? entry[1].emittedName ?? entry[0]),
            });
          }
        }
        return { kind: 'lexical-write', cell, value, type: value.type, span };
      }
      const left = this.expression(module, node.left, scope, phase);
      const right = ['&&', '||', '??'].includes(operator)
        ? this.conditionalRight(
            module,
            node.right,
            scope,
            phase,
            left,
            operator,
            operator === '??'
              ? joinValueTypes(
                  valueAlternatives(left.type).filter((type) => type !== 'null' && type !== 'void')
                )
              : undefined
          )
        : this.expression(module, node.right, scope, phase);
      const capabilityType = capabilityBinaryType(operator, left.type, right.type);
      if (operator === 'in') {
        if (!assignable(left.type, 'string') || !canCheckPropertyPresence(right.type))
          rejectNode(
            node,
            'PUI1006',
            'Property presence requires a checked string key and object representation.'
          );
        return { kind: 'binary', operator: 'in', left, right, type: 'boolean', span };
      }
      if (capabilityType)
        return { kind: 'binary', operator: '??', left, right, type: capabilityType, span };
      if (
        ['&&', '||', '??'].includes(operator) &&
        (!isDataValueType(left.type) || !isDataValueType(right.type))
      ) {
        const retained = valueAlternatives(left.type).filter((type) =>
          operator === '??'
            ? type !== 'null' && type !== 'void'
            : operator === '&&'
              ? type === 'null' || type === 'void' || type === 'boolean'
              : type !== 'null' && type !== 'void'
        );
        return {
          kind: 'binary',
          operator: operator as '&&' | '||' | '??',
          left,
          right,
          type: joinValueTypes([...retained, right.type]),
          span,
        };
      }
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
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const binding = scope.get(node.expression.text);
        const constant = binding?.staticProperties?.get(node.name.text);
        if (constant && (binding?.staticObjectPresent || node.questionDotToken))
          return constant.value === undefined
            ? { kind: 'undefined', type: 'void', span }
            : {
                kind: 'literal',
                value: constant.value,
                type: { kind: 'literal', value: constant.value },
                span,
              };
      }
      if (
        ts.isElementAccessExpression(node) &&
        !ts.isStringLiteral(node.argumentExpression) &&
        !ts.isNumericLiteral(node.argumentExpression)
      ) {
        const object = this.expression(module, node.expression, scope, phase),
          index = this.expression(module, node.argumentExpression, scope, phase);
        const optional = ts.isElementAccessChain(node);
        const key = scalarConstant(index);
        if (typeof key?.value === 'string') {
          const type = this.checkedValue(node, () =>
            this.memberType(object.type, key.value as string, optional)
          );
          return { kind: 'member', object, property: key.value, optional, type, span };
        }
        const sourceIndex = unwrapSourceExpression(node.argumentExpression);
        const binding = ts.isIdentifier(sourceIndex) ? scope.get(sourceIndex.text) : undefined;
        const staticKey = binding && !binding.lexical ? binding.constant?.value : undefined;
        if (!optional && typeof staticKey === 'string') {
          // The finite key is proven, but its ordinary lexical read must stay:
          // it carries capture identity and can still observe the TDZ. A plain
          // synchronous call preserves object-then-index evaluation, once each.
          // Optional access stays on the ordinary path because it skips the
          // index evaluation when the receiver is nullish.
          const receiverType: ValueType =
            object.type === 'props'
              ? {
                  kind: 'record',
                  fields: [...this.props].map(([name, prop]) => ({
                    name,
                    // Missing/empty Props can reach the canonical null fallback.
                    // Retain it when a snapshot crosses an ordinary helper boundary.
                    type: parseDataType({ kind: 'union', members: [prop.type, 'null'] }),
                  })),
                }
              : object.type;
          const type = this.checkedValue(node, () =>
            this.memberType(receiverType, staticKey, false)
          );
          const objectName = this.moduleName(),
            keyName = this.moduleName();
          const fn: FunctionIR = {
            parameters: [
              { name: objectName, type: receiverType },
              { name: keyName, type: index.type },
            ],
            body: [
              {
                kind: 'return',
                value: {
                  kind: 'member',
                  object: { kind: 'reference', name: objectName, type: receiverType, span },
                  property: staticKey,
                  optional: false,
                  type,
                  span,
                },
                span,
              },
            ],
            phase,
            context: 'helper',
            returnType: type,
            span,
          };
          return {
            kind: 'call',
            callee: { kind: 'function', function: fn, type: functionValueType(fn), span },
            arguments: [object, index],
            optional: false,
            type,
            span,
          };
        }
        const type = this.checkedValue(node, () =>
          indexedValueType(object.type, index.type, optional)
        );
        if (hasAccessorField(object.type)) this.invalidateFlow(scope, true, true);
        return { kind: 'element', object, index, optional, type, span };
      }
      const property = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : (node.argumentExpression as ts.StringLiteral | ts.NumericLiteral).text;
      const object = this.expression(module, node.expression, scope, phase);
      const optional = ts.isPropertyAccessChain(node) || ts.isElementAccessChain(node);
      const type = this.checkedValue(node, () => this.memberType(object.type, property, optional));
      if (hasAccessorField(object.type, property)) this.invalidateFlow(scope, true, true);
      return { kind: 'member', object, property, optional, type, span };
    }
    if (ts.isCallExpression(node)) return this.call(module, node, scope, phase, expectedType);
    if (ts.isTemplateExpression(node)) {
      let value: ExpressionIR = { kind: 'literal', value: node.head.text, type: 'string', span };
      for (const part of node.templateSpans) {
        const item = this.expression(module, part.expression, scope, phase);
        if (
          !valueAlternatives(item.type).every(
            (type) =>
              type === 'string' ||
              type === 'number' ||
              type === 'boolean' ||
              (typeof type !== 'string' && type.kind === 'literal' && type.value !== null)
          )
        )
          rejectNode(
            part.expression,
            'PUI1006',
            'Template interpolation currently requires scalar data.'
          );
        value = { kind: 'binary', operator: '+', left: value, right: item, type: 'string', span };
        if (part.literal.text)
          value = {
            kind: 'binary',
            operator: '+',
            left: value,
            right: {
              kind: 'literal',
              value: part.literal.text,
              type: 'string',
              span: sourceSpan(part.literal),
            },
            type: 'string',
            span,
          };
      }
      return value;
    }
    rejectNode(
      node,
      'PUI1004',
      `Unsupported expression ${ts.SyntaxKind[node.kind]}; no input code is executed.`
    );
  }

  private contextType(expression?: ExpressionIR): ValueType | undefined {
    return expression?.kind === 'context-key'
      ? this.contextKeys.get(expression.keyId)?.type
      : expression?.type === 'context-key'
        ? { kind: 'object', fields: [], index: 'unknown' }
        : undefined;
  }

  /** Follow checked module identities, never source names or type-only views. */
  private staticArray(value: ExpressionIR): Extract<ExpressionIR, { kind: 'array' }> | undefined {
    while (value.kind === 'narrow') value = value.value;
    if (value.kind === 'reference') {
      const bound = this.moduleBindings.find((binding) => binding.name === value.name)?.value;
      if (!bound) return undefined;
      return this.staticArray(bound);
    }
    return value.kind === 'array' ? value : undefined;
  }

  /** The literal strings of a static array, following module data references. */
  private staticStrings(value: ExpressionIR): string[] | undefined {
    const array = this.staticArray(value);
    if (!array) return undefined;
    const out: string[] = [];
    for (const element of array.elements) {
      let item = element;
      while (item.kind === 'narrow') item = item.value;
      if (item.kind !== 'literal' || typeof item.value !== 'string') return undefined;
      out.push(item.value);
    }
    return out;
  }

  private moduleValue(
    module: SourceModule,
    name: string,
    value: ts.Expression
  ): Binding & { name: string } {
    const id = `${module.file.fileName}#${name}`;
    const previous = this.moduleValues.get(id);
    if (previous) return previous;
    // Discovery unwraps declarations for dispatch. Recover only parentheses and
    // a verified const assertion around an array, not arbitrary erased views.
    let initializer = value;
    while (
      ts.isArrayLiteralExpression(value) &&
      initializer.parent &&
      (ts.isParenthesizedExpression(initializer.parent) ||
        ((ts.isAsExpression(initializer.parent) ||
          ts.isTypeAssertionExpression(initializer.parent)) &&
          ts.isTypeReferenceNode(initializer.parent.type) &&
          ts.isIdentifier(initializer.parent.type.typeName) &&
          initializer.parent.type.typeName.text === 'const')) &&
      initializer.parent.expression === initializer
    )
      initializer = initializer.parent;
    const annotation = ts.isVariableDeclaration(initializer.parent)
      ? initializer.parent.type
      : undefined;
    const annotated = annotation
      ? this.sourceValueType(module, annotation, this.substitutions)
      : undefined;
    let selectionType: ValueType | undefined;
    if (staticCallableSelection(value)) {
      const condition = this.expression(module, value.condition, new Map(), 'setup');
      if (!assignable(condition.type, 'boolean'))
        rejectNode(
          value.condition,
          'PUI1006',
          'Static callable selection requires a boolean condition.'
        );
      const branchType = (branch: ts.Expression): ValueType => {
        while (ts.isParenthesizedExpression(branch)) branch = branch.expression;
        if (!ts.isIdentifier(branch))
          return rejectNode(
            branch,
            'PUI1006',
            'Static callable selection requires a module function or undefined.'
          );
        if (
          branch.text === 'undefined' &&
          !module.declarations.has(branch.text) &&
          !module.imports.has(branch.text)
        )
          return 'void';
        const resolved = this.graph.resolveBinding(module, branch.text);
        if (!resolved.module || !isSourceFunction(resolved.node))
          return rejectNode(
            branch,
            'PUI1006',
            'Static callable selection requires a module function or undefined.'
          );
        // Branch selection defers execution, not declaration/signature grammar.
        // Validate both callable branches without admitting either body/default.
        this.deferredSignature(resolved.module, resolved.node);
        return this.previewFunction(resolved.module, resolved.node, new Map());
      };
      selectionType = joinValueTypes([branchType(value.whenTrue), branchType(value.whenFalse)]);
      initializer = moduleBoolean(this.graph, module, value.condition)
        ? value.whenTrue
        : value.whenFalse;
    }
    const initial = this.expression(module, initializer, new Map(), 'setup', undefined, annotated);
    const scalarType = mutableScalarType(initial.type);
    const scalar = scalarType === 'boolean' || scalarType === 'number' || scalarType === 'string';
    // Shared mutable storage stays scalar; an immutable binding may hold any
    // finite data written as a literal (finiteness is checked below).
    if (!scalar && (module.mutableBindings.has(name) || scalarInitializer(value)))
      rejectNode(value, 'PUI1006', 'Module initializer must be scalar data.');
    const declared =
      annotated ?? selectionType ?? (module.mutableBindings.has(name) ? scalarType : initial.type);
    const callableSelection =
      selectionType !== undefined &&
      valueAlternatives(declared).every(
        (type) => type === 'void' || (typeof type !== 'string' && type.kind === 'callable')
      );
    if (selectionType !== undefined && (!callableSelection || !assignable(selectionType, declared)))
      rejectNode(
        annotation ?? value,
        'PUI1006',
        'Static callable branches do not satisfy their declared optional function type.'
      );
    const getterRecord =
      staticGetterRecordInitializer(value) &&
      typeof declared !== 'string' &&
      declared.kind === 'object' &&
      hasAccessorField(declared) &&
      declared.fields.every((field) => isDataValueType(field.type));
    if (!isSharedModuleValueType(declared) && !callableSelection && !getterRecord)
      rejectNode(
        annotation ?? value,
        'PUI1006',
        'Shared module storage requires finite data; owner closures and capabilities cannot escape into module storage.'
      );
    // `const` fixes the binding, not the fields of an ordinary data value.
    // Preserve finite authored data mutability and real module identity. Nominal
    // declaration composites still expose only a read-only view.
    const stored =
      scalar || callableSelection || serializableDataType(declared) !== undefined
        ? declared
        : deepReadonly(declared);
    if (stored === undefined)
      rejectNode(
        value,
        'PUI1006',
        'Module data must be scalars, scalar arrays or records of such data.'
      );
    if (!assignable(initial.type, stored) && !assignable(argumentValue(initial), stored))
      rejectNode(
        annotation ?? value,
        'PUI1006',
        'Module initializer does not satisfy its declared type.'
      );
    const mutable = module.mutableBindings.has(name);
    const binding: Binding & { name: string } = {
      name: this.moduleName(),
      type: mutable
        ? stored === 'boolean' || stored === 'number' || stored === 'string'
          ? `lexical:${stored}`
          : { kind: 'cell', value: stored }
        : stored,
      ...(mutable ? { lexical: stored } : {}),
    };
    this.moduleValues.set(id, binding);
    this.moduleBindings.push({
      kind: 'const',
      name: binding.name,
      value: mutable
        ? {
            kind: 'lexical-cell',
            value: sameType(initial.type, stored)
              ? initial
              : { kind: 'narrow', value: initial, type: stored, span: initial.span },
            type: binding.type,
            span: sourceSpan(value),
          }
        : sameType(initial.type, stored)
          ? initial
          : { kind: 'narrow', value: initial, type: stored, span: initial.span },
      span: sourceSpan(value),
    });
    return binding;
  }

  private moduleName(): string {
    let name: string;
    do name = `__puiModule${this.moduleSequence++}`;
    while (this.sourceNames.has(name));
    return name;
  }

  private lexicalTarget(module: SourceModule, node: ts.Expression, scope: Scope): ExpressionIR {
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    if (!ts.isIdentifier(node))
      rejectNode(node, 'PUI1004', 'Mutation requires a declared lexical let binding.');
    let binding = scope.get(node.text),
      name = node.text;
    if (!binding && (module.declarations.has(name) || module.imports.has(name))) {
      const resolved = this.graph.resolveBinding(module, name);
      if (resolved.module && moduleDataNode(resolved.node)) {
        const value = this.moduleValue(
          resolved.module,
          resolved.name,
          resolved.node as ts.Expression
        );
        binding = scope.get(value.name);
        if (!binding) {
          binding = { ...value, emittedName: value.name };
          scope.set(value.name, binding);
        }
        name = value.name;
      }
    }
    if (!binding?.lexical)
      rejectNode(node, 'PUI1004', 'Mutation requires a declared lexical let binding.');
    this.requireInitializedBinding(binding, node);
    return {
      kind: 'reference',
      name: binding.emittedName ?? name,
      bindingId: binding.bindingId,
      type: binding.type,
      span: sourceSpan(node),
    };
  }

  private requireInitializedBinding(binding: Binding | undefined, node: ts.Node): void {
    if (binding?.declarationScope === this.lexicalExecution && !binding.initializerParsed)
      rejectNode(node, 'PUI1005', 'A lexical binding cannot be read before its initialization.');
  }

  private enforceHelperContext(fn: FunctionIR, origin: FunctionContext, phase: Phase): void {
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(inspect);
        return;
      }
      const record = value as Record<string, unknown>;
      // Creating a closure does not execute its body or create a lifecycle boundary.
      if (record.kind === 'function') return;
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

  private previewCaptures(value: ExpressionIR, scope: Scope): void {
    if (this.previewingCaptures || !this.hooks.size) return;
    if (value.kind === 'authored-hook' && !value.arguments?.length) return;
    this.previewingCaptures = true;
    try {
      const prefix = this.statementPrefixes.flatMap((body) => body);
      const declared = new Set(
        prefix.flatMap((statement) =>
          statement.kind === 'const' ? [statement.bindingId ?? statement.name] : []
        )
      );
      const parameters = [...scope]
        .filter(([name, binding]) => !declared.has(binding.bindingId ?? name))
        .map(([name, binding]) => ({
          name: binding.emittedName ?? name,
          bindingId: binding.bindingId,
          type: binding.type,
        }));
      const setup: FunctionIR = {
        parameters,
        phase: 'setup',
        context: 'setup',
        returnType: 'void',
        span: value.span,
        body: [...prefix, { kind: 'effect', expression: value, span: value.span }],
      };
      const captures = derivePrototypeCaptures(
        { setup, hooks: [...this.hooks.values()], moduleBindings: this.moduleBindings },
        false
      );
      for (const [id, capture] of captures) {
        const hook = this.hooks.get(id)!;
        if (!this.captureTypes.has(id))
          hook.capture = mergeHookCaptures([hook.capture!, capture], hook.span);
      }
    } catch (error) {
      // A declaration may be parsed before its caller's actual arguments exist.
      // The complete closed-graph derivation below remains the authoritative proof.
      if (
        !(error instanceof CompilerRejection) ||
        !error.diagnostic.message.startsWith('Callable provenance')
      )
        throw error;
    } finally {
      this.previewingCaptures = false;
    }
  }

  /** Inline only a closed, effect-free Boolean expression over stable operands. */
  private inlinePredicate(
    fn: FunctionIR,
    args: readonly ExpressionIR[],
    scope: Scope
  ): ExpressionIR | undefined {
    if (
      fn.body.length !== 1 ||
      fn.body[0].kind !== 'return' ||
      !fn.body[0].value ||
      !assignable(fn.returnType, 'boolean') ||
      fn.parameters.some((parameter) => parameter.rest || parameter.default) ||
      args.length !== fn.parameters.length
    )
      return undefined;
    const inert = (value: ExpressionIR): boolean =>
      value.kind === 'literal' ||
      value.kind === 'undefined' ||
      value.kind === 'reference' ||
      (value.kind === 'lexical-read' && value.cell.kind === 'reference');
    if (!args.every(inert)) return undefined;
    const parameters = new Map(
      fn.parameters.map((parameter, index) => [parameter.bindingId ?? parameter.name, args[index]])
    );
    const clone = (value: ExpressionIR, local: Scope): ExpressionIR | undefined => {
      if (value.kind === 'reference') {
        const source = parameters.get(value.bindingId ?? value.name) ?? value;
        if (source.kind === 'reference') {
          this.normalizeFlow(local);
          const binding = [...local].find(([name, binding]) =>
            source.bindingId
              ? binding.bindingId === source.bindingId
              : (binding.emittedName ?? name) === source.name
          )?.[1];
          return { ...source, type: binding?.type ?? source.type };
        }
        return source.kind === 'lexical-read' ? clone(source, local) : source;
      }
      if (value.kind === 'literal' || value.kind === 'undefined') return { ...value };
      if (value.kind === 'lexical-read' && value.cell.kind === 'reference') {
        const cellName = value.cell.name;
        this.normalizeFlow(local);
        const binding = [...local].find(
          ([name, binding]) => (binding.emittedName ?? name) === cellName
        )?.[1];
        const result: ExpressionIR = {
          ...value,
          cell: { ...value.cell },
          type: binding?.lexical ?? value.type,
        };
        this.flow.observe(result);
        return result;
      }
      if (value.kind === 'unary' && value.operator === '!') {
        const operand = clone(value.operand, local);
        if (!operand) return undefined;
        return {
          ...value,
          operand,
          type: isDataValueType(operand.type) ? inferUnaryType('!', operand.type) : 'boolean',
        };
      }
      if (
        value.kind === 'intrinsic' &&
        (value.name === 'typeof' || value.name === 'number.isFinite') &&
        value.arguments.length === 1
      ) {
        const argument = clone(value.arguments[0], local);
        return argument ? { ...value, arguments: [argument] } : undefined;
      }
      if (
        value.kind === 'binary' &&
        ['===', '!==', '&&', '||', '<', '<=', '>', '>='].includes(value.operator)
      ) {
        const left = clone(value.left, local);
        if (!left) return undefined;
        const right = clone(
          value.right,
          value.operator === '&&' || value.operator === '||'
            ? this.refinedScope(local, left, value.operator === '&&')
            : local
        );
        if (!right) return undefined;
        const type =
          value.operator === '===' || value.operator === '!=='
            ? 'boolean'
            : isDataValueType(left.type) && isDataValueType(right.type)
              ? inferBinaryType(value.operator, left.type, right.type)
              : undefined;
        return type === undefined ? undefined : { ...value, left, right, type };
      }
      return undefined;
    };
    try {
      return clone(fn.body[0].value, scope);
    } catch {
      return undefined;
    }
  }

  private ordinaryCall(
    module: SourceModule,
    node: ts.CallExpression,
    callee: ExpressionIR,
    scope: Scope,
    phase: Phase,
    known?: FunctionIR
  ): ExpressionIR {
    const memberChain = callee.kind === 'member' && !!callee.optional;
    if (
      (node.questionDotToken || memberChain) &&
      valueAlternatives(callee.type).every(
        (type) =>
          type === 'null' ||
          type === 'void' ||
          (typeof type !== 'string' && type.kind === 'literal' && type.value === null)
      )
    ) {
      // A proven absent callee still evaluates once, while its argument list is
      // skipped. Keeping the operand avoids dropping effects from a null-returning call.
      const span = sourceSpan(node);
      return {
        kind: 'binary',
        operator: '??',
        left: callee,
        right: { kind: 'undefined', type: 'void', span },
        type: 'void',
        span,
      };
    }
    if (memberChain && !node.questionDotToken) {
      const present = joinValueTypes(
        valueAlternatives(callee.object.type).filter((type) => type !== 'null' && type !== 'void')
      );
      this.checkedValue(node, () =>
        callableValue(this.memberType(present, callee.property, false))
      );
    }
    const optional = !!node.questionDotToken || memberChain;
    let signature: ReturnType<typeof callableValue>;
    try {
      signature = callableValue(callee.type, optional);
    } catch (error) {
      rejectNode(node, 'PUI1006', (error as Error).message);
    }
    const spreads = node.arguments.map(ts.isSpreadElement);
    const args = node.arguments.map((argument, index) => {
      const parameter = signature.parameters[index] ?? signature.parameters.at(-1);
      const expected = parameter?.rest ? arrayElementType(parameter.type) : parameter?.type;
      return this.expression(
        module,
        ts.isSpreadElement(argument) ? argument.expression : argument,
        scope,
        phase,
        undefined,
        ts.isSpreadElement(argument) ? undefined : expected
      );
    });
    const type = this.checkedValue(node, () =>
      checkedCall(
        callee.type,
        args.map((argument, index) =>
          argument.type === 'props'
            ? {
                kind: 'record',
                fields: [...this.props].map(([name, prop]) => ({ name, type: prop.type })),
              }
            : assignable(argument.type, signature.parameters[index]?.type ?? 'unknown')
              ? argument.type
              : argumentValue(argument)
        ),
        optional,
        spreads
      )
    );
    if (known && this.context !== 'helper' && this.context !== 'expose-method')
      this.enforceHelperContext(known, this.context, phase);
    if (
      !this.deferCallFlow &&
      !this.readonlyCallSites.has(callSiteKey(sourceSpan(node))) &&
      functionCanMutateFlow(
        known ?? (callee.kind === 'function' ? callee.function : undefined),
        args,
        (call) => this.flowFunction(call, scope)
      )
    )
      this.invalidateFlow(scope, true);
    const predicate =
      !optional && !spreads.some(Boolean) && known
        ? this.inlinePredicate(known, args, scope)
        : undefined;
    if (predicate) return predicate;
    const value: ExpressionIR = {
      kind: 'call',
      callee,
      arguments: args,
      optional,
      ...(spreads.some(Boolean) ? { spread: spreads } : {}),
      type,
      span: sourceSpan(node),
    };
    const hasCapture = (type: ValueType): boolean =>
      typeof type !== 'string' &&
      (type.kind === 'capture' ||
        (type.kind === 'value-union' && type.members.some(hasCapture)) ||
        (type.kind === 'object' && type.fields.some((field) => hasCapture(field.type))));
    if (hasCapture(type)) this.previewCaptures(value, scope);
    return value;
  }

  private flowFunction(call: ExpressionIR, scope: Scope): FunctionIR | undefined {
    if (call.kind === 'helper-call')
      return [...this.moduleHelpers.values()].find((helper) => helper.name === call.name)?.fn;
    if (call.kind !== 'call') return undefined;
    if (call.callee.kind === 'function') return call.callee.function;
    if (call.callee.kind !== 'reference') return undefined;
    const callee = call.callee;
    return [...scope].find(([name, binding]) =>
      callee.bindingId
        ? binding.bindingId === callee.bindingId
        : (binding.emittedName ?? name) === callee.name
    )?.[1].helper;
  }

  private moduleHelper(
    module: SourceModule,
    name: string,
    node: FunctionNode,
    args: readonly ExpressionIR[],
    typeArguments: readonly ts.TypeNode[] | undefined,
    stateInputs: readonly (DataType | undefined)[] = []
  ): { name: string; fn: FunctionIR } {
    const previous = this.substitutions,
      replacements = new Map<string, ValueType>();
    const parameters = node.typeParameters ?? [];
    parameters.forEach((parameter, index) => {
      if (typeArguments?.[index])
        replacements.set(
          parameter.name.text,
          this.sourceValueType(module, typeArguments[index], previous)
        );
    });
    const infer = (type: ts.TypeNode, value: ValueType): void => {
      if (
        ts.isTypeReferenceNode(type) &&
        ts.isIdentifier(type.typeName) &&
        parameters.some(
          (parameter) => parameter.name.text === (type.typeName as ts.Identifier).text
        )
      ) {
        if (!replacements.has(type.typeName.text)) replacements.set(type.typeName.text, value);
        return;
      }
      if (ts.isUnionTypeNode(type)) {
        const concrete = type.types.filter(
          (type) =>
            type.kind !== ts.SyntaxKind.UndefinedKeyword &&
            !(ts.isLiteralTypeNode(type) && type.literal.kind === ts.SyntaxKind.NullKeyword)
        );
        if (concrete.length === 1)
          infer(
            concrete[0],
            joinValueTypes(
              valueAlternatives(value).filter((type) => type !== 'null' && type !== 'void')
            )
          );
      }
      if (ts.isArrayTypeNode(type) && typeof value !== 'string' && value.kind === 'array')
        infer(type.elementType, value.element);
    };
    node.parameters.forEach((parameter, index) => {
      if (parameter.type && args[index]) infer(parameter.type, args[index].type);
    });
    parameters.forEach((parameter) => {
      if (!replacements.has(parameter.name.text))
        replacements.set(
          parameter.name.text,
          parameter.constraint
            ? this.sourceValueType(module, parameter.constraint, previous)
            : 'unknown'
        );
    });
    const propsDomains = node.parameters.map((parameter, index) => {
      const argument = args[index];
      if (!parameter.type || argument?.kind !== 'member' || argument.object.type !== 'props')
        return undefined;
      const scalar = valueAlternatives(argument.type).every((member) =>
        typeof member === 'string'
          ? ['string', 'number', 'boolean', 'null', 'void'].includes(member)
          : member.kind === 'literal'
      );
      if (!scalar) return undefined;
      const declared = this.sourceValueType(module, parameter.type, replacements);
      const nullish = valueAlternatives(declared).filter(
        (member) => member === 'null' || member === 'void'
      );
      if (!nullish.length) return undefined;
      // A direct Props read still carries the source schema's scalar type;
      // native resolution additionally accounts for missing/empty fallback.
      // Preserve nullish alternatives that the author already accepts rather
      // than specializing that helper to an unproven non-null native domain.
      const domain = joinValueTypes([argument.type, ...nullish]);
      return canRetainParameterType(domain, declared) ? domain : undefined;
    });
    const specialized = node.parameters.map((parameter, index) => {
      const argument = args[index];
      // An explicit unknown input is checked by the helper's own guards. Do not
      // specialize a Props-derived scalar to less than its empty/fallback domain.
      // Data containers keep their full shape and readonly permissions, with
      // the nullish alternatives accepted by the declared unknown boundary.
      // Callable and owner-bearing shapes always retain their complete identity.
      if (parameter.type?.kind === ts.SyntaxKind.UnknownKeyword && argument) {
        if (
          valueAlternatives(argument.type).every((member) =>
            typeof member === 'string'
              ? ['string', 'number', 'boolean', 'null', 'void'].includes(member)
              : member.kind === 'literal'
          )
        )
          return 'unknown';
        if (serializableDataType(argument.type) !== undefined)
          return joinValueTypes([argument.type, 'null', 'void']);
      }
      if (propsDomains[index] !== undefined) return propsDomains[index];
      return argument?.kind === 'literal' && !parameter.initializer
        ? argumentValue(argument)
        : argument?.type;
    });
    const literals = specialized.map((type, index) =>
      args[index]?.kind === 'literal' ? type : undefined
    );
    const retained = specialized.map((type) =>
      type !== undefined &&
      valueAlternatives(type).some(
        (member) =>
          objectFields(member) !== undefined ||
          (typeof member !== 'string' && ['array', 'value-array'].includes(member.kind))
      )
        ? type
        : undefined
    );
    const id = `${module.file.fileName}#${name}${parameters.length ? JSON.stringify([...replacements]) : ''}${literals.some(Boolean) ? JSON.stringify(literals) : ''}${retained.some(Boolean) ? JSON.stringify(retained) : ''}${stateInputs.some(Boolean) ? JSON.stringify(stateInputs) : ''}${propsDomains.some(Boolean) ? `#props:${JSON.stringify(propsDomains)}` : ''}`;
    const cached = this.moduleHelpers.get(id);
    if (cached) return cached;
    this.substitutions = replacements;
    try {
      const signature = this.previewFunction(module, node, new Map());
      const fn: FunctionIR = {
        parameters: signature.parameters,
        body: [],
        returnType: signature.returnType,
        phase: this.helperPhase(
          module,
          node,
          new Map(
            node.parameters.map((parameter, index) => [
              identifier(parameter.name),
              { type: args[index]?.type ?? signature.parameters[index].type },
            ])
          )
        ),
        context: 'helper',
        span: sourceSpan(node),
      };
      const helper = { name: this.moduleName(), fn };
      this.moduleHelpers.set(id, helper);
      const declaration: Extract<StatementIR, { kind: 'const' }> = {
        kind: 'const',
        name: helper.name,
        value: { kind: 'function', function: fn, type: functionValueType(fn), span: fn.span },
        span: fn.span,
      };
      this.moduleBindings.push(declaration);
      Object.assign(
        fn,
        this.function(
          module,
          node,
          new Map(),
          fn.phase,
          specialized as ValueType[],
          'helper',
          undefined,
          false,
          true,
          [],
          stateInputs
        )
      );
      declaration.value.type = functionValueType(fn);
      return helper;
    } finally {
      this.substitutions = previous;
    }
  }

  call(
    module: SourceModule,
    node: ts.CallExpression,
    scope: Scope,
    phase: Phase,
    expectedType?: ValueType
  ): ExpressionIR {
    const span = sourceSpan(node);
    // TypeScript's non-null assertion does not change method dispatch or its
    // receiver. Resolve the same checked public operation beneath the erased
    // assertion rather than reading a semantic namespace as an ordinary object.
    if (ts.isNonNullExpression(node.expression)) {
      const names: string[] = [];
      let root = node.expression.expression;
      while (ts.isPropertyAccessExpression(root)) {
        names.unshift(root.name.text);
        root = root.expression;
      }
      const receiver = operationReceiverType(this.previewExpression(module, root, scope));
      const semantic = Object.values(OPERATION_RULES).some(
        (rule) => sameType(rule.receiver, receiver) && rule.path === names.join('.')
      );
      if (!semantic)
        return this.ordinaryCall(
          module,
          node,
          this.expression(module, node.expression, scope, phase),
          scope,
          phase
        );
    }
    if (ts.isNonNullExpression(node.expression) || ts.isParenthesizedExpression(node.expression)) {
      // updateCallExpression re-adds syntactic parentheses around an asserted
      // callee. A parse-only view must erase exactly one wrapper, preserving the
      // original source links and optional-chain flag without reparenthesizing.
      const call: ts.CallExpression = Object.assign(
        Object.create(Object.getPrototypeOf(node)),
        node,
        { expression: node.expression.expression }
      );
      return this.call(module, call, scope, phase, expectedType);
    }
    const globalPath = ecmaSourcePath(node.expression);
    const ecmaGlobal =
      globalPath &&
      !scope.has(globalPath[0]) &&
      !module.declarations.has(globalPath[0]) &&
      !module.imports.has(globalPath[0])
        ? ecmaGlobalCallName(globalPath)
        : undefined;
    if (ecmaGlobal) {
      if (node.questionDotToken || node.typeArguments?.length)
        rejectNode(
          node,
          'PUI1006',
          'This ECMAScript global call does not admit optional calls or type arguments.'
        );
      const args = node.arguments.map((argument) =>
        this.expression(module, argument, scope, phase)
      );
      const type = this.checkedValue(node, () =>
        intrinsicResult(
          ecmaGlobal,
          args.map((arg) => arg.type),
          args
        )
      );
      return { kind: 'intrinsic', name: ecmaGlobal, arguments: args, type, span };
    }
    if (
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'String' || node.expression.text === 'Number') &&
      !scope.has(node.expression.text) &&
      !module.declarations.has(node.expression.text) &&
      !module.imports.has(node.expression.text)
    ) {
      const name = node.expression.text === 'Number' ? 'number' : 'string';
      if (node.questionDotToken)
        rejectNode(node, 'PUI1006', `${node.expression.text} does not admit optional calls.`);
      const args = node.arguments.map((argument) =>
        this.expression(module, argument, scope, phase)
      );
      return {
        kind: 'intrinsic',
        name,
        arguments: args,
        type: this.checkedValue(node, () =>
          intrinsicResult(
            name,
            args.map((arg) => arg.type)
          )
        ),
        span,
      };
    }
    const declaredSemanticPath = (): boolean => {
      let root: ts.Expression = node.expression;
      const paths: string[] = [];
      while (ts.isPropertyAccessExpression(root)) {
        paths.unshift(root.name.text);
        root = root.expression;
      }
      const binding = ts.isIdentifier(root) ? scope.get(root.text) : undefined;
      if (!binding) return false;
      const family = operationReceiverType(binding.lexical ?? binding.type);
      const path = family === 'render' && paths.join('.') === 'r.slot' ? 'slot' : paths.join('.');
      return Object.values(OPERATION_RULES).some(
        (rule) => sameType(rule.receiver, family) && rule.path === path
      );
    };
    if (ts.isPropertyAccessExpression(node.expression) && !declaredSemanticPath()) {
      const owner = node.expression.expression,
        property = node.expression.name.text;
      if (isEcmaMemberName(property)) {
        const receiver = this.expression(module, owner, scope, phase);
        const optional =
          !!(node.questionDotToken || node.expression.questionDotToken) ||
          (!!(node.flags & ts.NodeFlags.OptionalChain) && ecmaOptionalContinuation(receiver));
        const present = optional
          ? joinValueTypes(
              valueAlternatives(receiver.type).filter((type) => type !== 'null' && type !== 'void')
            )
          : receiver.type;
        const name = ecmaMemberCallName(present, property);
        if (name) {
          if (node.typeArguments?.length)
            rejectNode(
              node,
              'PUI1006',
              'This ECMAScript member call does not admit type arguments.'
            );
          const args = [
            receiver,
            ...node.arguments.map((argument) => this.expression(module, argument, scope, phase)),
          ];
          const type = this.checkedValue(node, () =>
            intrinsicResult(
              name,
              args.map((arg) => arg.type),
              args,
              undefined,
              optional
            )
          );
          return {
            kind: 'intrinsic',
            name,
            arguments: args,
            ...(optional ? { optional: true } : {}),
            type,
            span,
          };
        }
      }
      if (
        ts.isIdentifier(owner) &&
        !scope.has(owner.text) &&
        !module.declarations.has(owner.text) &&
        !module.imports.has(owner.text)
      ) {
        const name =
          owner.text === 'Number' && property === 'isFinite'
            ? 'number.isFinite'
            : owner.text === 'Math' && property === 'round'
              ? 'math.round'
              : owner.text === 'Math' && property === 'floor'
                ? 'math.floor'
                : owner.text === 'Object' && property === 'freeze'
                  ? 'object.freeze'
                  : owner.text === 'Object' && property === 'hasOwn'
                    ? 'object.hasOwn'
                    : owner.text === 'Object' && property === 'assign'
                      ? 'object.assign'
                      : owner.text === 'Array' && property === 'isArray'
                        ? 'array.isArray'
                        : owner.text === 'Array' && property === 'from'
                          ? 'array.from'
                          : owner.text === 'JSON' && property === 'stringify'
                            ? 'json.stringify'
                            : undefined;
        if (name) {
          if (
            name === 'object.assign' &&
            (node.questionDotToken || node.expression.questionDotToken)
          )
            rejectNode(node, 'PUI1006', 'Object.assign does not admit optional calls.');
          if (name === 'object.assign') {
            const operands = node.arguments.map((argument) => {
              while (ts.isParenthesizedExpression(argument)) argument = argument.expression;
              return argument;
            });
            if (
              !operands.length ||
              (!ts.isObjectLiteralExpression(operands[0]) && !ts.isNewExpression(operands[0])) ||
              operands.slice(1).some((operand) => !ts.isObjectLiteralExpression(operand))
            )
              rejectNode(
                node,
                'PUI1006',
                'Object.assign requires a direct fresh target and record literal sources.'
              );
          }
          const args = node.arguments.map((argument) =>
            this.expression(
              module,
              argument,
              scope,
              phase,
              undefined,
              name === 'object.freeze' ? expectedType : undefined
            )
          );
          return {
            kind: 'intrinsic',
            name,
            arguments: args,
            type: this.checkedValue(node, () =>
              intrinsicResult(
                name,
                args.map((arg) => arg.type),
                args
              )
            ),
            span,
          };
        }
      }
      if (
        [
          'every',
          'some',
          'filter',
          'find',
          'findIndex',
          'map',
          'flatMap',
          'forEach',
          'reduce',
          'sort',
          'slice',
          'push',
          'shift',
          'pop',
          'at',
          'join',
          'has',
          'add',
          'get',
          'set',
          'delete',
          'clear',
        ].includes(property)
      ) {
        const receiver = this.expression(module, owner, scope, phase);
        const optional = !!(node.questionDotToken || node.expression.questionDotToken);
        const present = optional
          ? joinValueTypes(
              valueAlternatives(receiver.type).filter((type) => type !== 'null' && type !== 'void')
            )
          : receiver.type;
        const array = arrayElementType(present) !== undefined;
        const set = typeof present !== 'string' && present.kind === 'set';
        const map = typeof present !== 'string' && present.kind === 'map';
        if (array || set || map) {
          const name = `${array ? 'array' : set ? 'set' : 'map'}.${property}` as Extract<
            ExpressionIR,
            { kind: 'intrinsic' }
          >['name'];
          const callback =
            array &&
            [
              'every',
              'some',
              'filter',
              'find',
              'findIndex',
              'map',
              'flatMap',
              'forEach',
              'reduce',
              'sort',
            ].includes(property);
          const callbackParameters = !array
            ? []
            : property === 'sort'
              ? [
                  { name: 'left', type: arrayElementType(present)! },
                  { name: 'right', type: arrayElementType(present)! },
                ]
              : property === 'reduce'
                ? [
                    {
                      name: 'accumulator',
                      type: node.arguments[1]
                        ? this.previewExpression(module, node.arguments[1], scope)
                        : arrayElementType(present)!,
                    },
                    ...arrayEveryCallbackParameters(present),
                  ]
                : arrayEveryCallbackParameters(present);
          const args = [
            receiver,
            ...node.arguments.map((argument, index) =>
              this.expression(
                module,
                argument,
                scope,
                phase,
                undefined,
                callback && index === 0
                  ? { kind: 'callable', parameters: callbackParameters, returnType: 'unknown' }
                  : property === 'push'
                    ? arrayElementType(present)
                    : set
                      ? present.element
                      : map
                        ? index === 0
                          ? present.key
                          : present.value
                        : undefined
              )
            ),
          ];
          const type = this.checkedValue(node, () =>
            intrinsicResult(
              name,
              args.map((arg) => arg.type),
              args,
              undefined,
              optional
            )
          );
          return {
            kind: 'intrinsic',
            name,
            arguments: args,
            ...(optional ? { optional: true } : {}),
            type,
            span,
          };
        }
      }
      if (property === 'includes') {
        const array = this.expression(module, owner, scope, phase);
        if (arrayElementType(array.type) !== undefined) {
          if (
            node.arguments.length !== 1 ||
            node.questionDotToken ||
            node.expression.questionDotToken
          )
            rejectNode(
              node,
              'PUI1006',
              'Finite string includes requires one search argument and no optional call.'
            );
          let search = node.arguments[0];
          // An erased comparison view grants no provenance. Retain the actual operand in IR.
          while (ts.isParenthesizedExpression(search)) search = search.expression;
          if (ts.isAsExpression(search) || ts.isTypeAssertionExpression(search)) {
            const asserted = this.sourceValueType(module, search.type, this.substitutions);
            const members = valueAlternatives(asserted);
            if (
              members.length &&
              members.every(
                (type) =>
                  typeof type !== 'string' &&
                  type.kind === 'literal' &&
                  typeof type.value === 'string'
              )
            )
              search = search.expression;
          }
          const value = this.expression(module, search, scope, phase);
          return {
            kind: 'intrinsic',
            name: 'array.includes',
            arguments: [array, value],
            type: this.checkedValue(node, () =>
              intrinsicResult('array.includes', [array.type, value.type])
            ),
            span,
          };
        }
      }
      if (property === 'every') {
        const array = this.expression(module, owner, scope, phase);
        if (typeof array.type !== 'string' && array.type.kind === 'array') {
          const callback = node.arguments[0];
          if (!callback || node.arguments.length !== 1)
            rejectNode(node, 'PUI1006', 'Array every requires one callback.');
          const value = this.expression(module, callback, scope, phase, undefined, {
            kind: 'callable',
            parameters: arrayEveryCallbackParameters(array.type),
            returnType: 'unknown',
          });
          return {
            kind: 'intrinsic',
            name: 'array.every',
            arguments: [array, value],
            type: this.checkedValue(node, () =>
              intrinsicResult('array.every', [array.type, value.type])
            ),
            span,
          };
        }
      }
    }
    let operation: SemanticOperation | undefined, receiver: ExpressionIR | undefined;
    let optionalOperation = false;
    if (ts.isIdentifier(node.expression)) {
      const name = node.expression.text,
        binding = scope.get(name);
      if (binding) {
        this.resolvePending(binding);
        const disposalType = node.questionDotToken
          ? joinValueTypes(
              valueAlternatives(lexicalStoredType(binding.type) ?? binding.type).filter(
                (type) => type !== 'null' && type !== 'void'
              )
            )
          : (binding.lexical ?? binding.type);
        if (
          ['style-disposer', 'subscription-disposer', 'binding-disposer'].includes(
            String(disposalType)
          )
        ) {
          const release: SemanticOperation =
            disposalType === 'style-disposer'
              ? 'feedback.style.release'
              : disposalType === 'subscription-disposer'
                ? 'subscription.release'
                : 'binding.release';
          const callee = this.expression(module, node.expression, scope, phase);
          if (
            node.questionDotToken &&
            valueAlternatives(callee.type).every((type) => type === 'null' || type === 'void')
          )
            return { kind: 'undefined', type: 'void', span };
          const arguments_ = node.arguments.map((argument) =>
            this.expression(module, argument, scope, phase)
          );
          const issues = [
            ...validateOperationPhase(
              release,
              phase,
              phase === 'callback' ? (this.context as CallbackContext) : undefined
            ),
            ...validateOperationArguments(release, arguments_, disposalType),
          ];
          if (issues.length) rejectNode(node, 'PUI1007', issues[0].message);
          this.requirements.add(release.split('.')[0]);
          return {
            kind: 'operation',
            operation: release,
            receiver: callee,
            arguments: arguments_,
            ...(node.questionDotToken ? { optional: true } : {}),
            type: 'void',
            span,
          };
        }
        const callee = this.expression(module, node.expression, scope, phase);
        return this.ordinaryCall(
          module,
          node,
          callee,
          scope,
          phase,
          binding.parsing || binding.lexical ? undefined : binding.helper
        );
      }
      if (name === 'String' && !module.imports.has(name) && !module.declarations.has(name)) {
        // The global String conversion, as authored source uses it in
        // diagnostics: one argument, no `new`, a string result.
        if (node.arguments.length !== 1)
          rejectNode(node, 'PUI1004', 'String() is admitted with exactly one argument.');
        const args = [this.expression(module, node.arguments[0], scope, phase)];
        return {
          kind: 'intrinsic',
          name: 'string',
          arguments: args,
          type: this.checkedValue(node, () =>
            intrinsicResult(
              'string',
              args.map((arg) => arg.type)
            )
          ),
          span,
        };
      }
      if (!module.imports.has(name) && !module.declarations.has(name))
        rejectNode(node, 'PUI1004', `Unadmitted call ${name}.`);
      const resolved = this.graph.resolveBinding(module, name);
      if (resolved.module && staticCallableSelection(resolved.node))
        return this.ordinaryCall(
          module,
          node,
          this.expression(module, node.expression, scope, phase),
          scope,
          phase
        );
      if (resolved.module && isSourceFunction(resolved.node)) {
        const signature = resolved.node.typeParameters?.length
          ? undefined
          : this.previewFunction(resolved.module, resolved.node, new Map());
        const spreads = node.arguments.map(ts.isSpreadElement);
        const args = node.arguments.map((argument, index) =>
          this.expression(
            module,
            ts.isSpreadElement(argument) ? argument.expression : argument,
            scope,
            phase,
            undefined,
            ts.isSpreadElement(argument)
              ? undefined
              : (() => {
                  const parameter = signature?.parameters[index] ?? signature?.parameters.at(-1);
                  return parameter?.rest ? arrayElementType(parameter.type) : parameter?.type;
                })()
          )
        );
        const helper = this.moduleHelper(
          resolved.module,
          resolved.name,
          resolved.node,
          args,
          node.typeArguments,
          args.map((argument) => this.stateData(argument, scope))
        );
        this.checkedValue(node, () =>
          checkedCall(
            functionValueType(helper.fn),
            args.map((argument, index) =>
              argument.type === 'props'
                ? {
                    kind: 'record',
                    fields: [...this.props].map(([name, prop]) => ({ name, type: prop.type })),
                  }
                : assignable(argument.type, helper.fn.parameters[index]?.type ?? 'unknown')
                  ? argument.type
                  : argumentValue(argument)
            ),
            false,
            spreads
          )
        );
        if (this.context !== 'helper' && this.context !== 'expose-method')
          this.enforceHelperContext(helper.fn, this.context, phase);
        if (functionCanMutateFlow(helper.fn, args, (call) => this.flowFunction(call, scope)))
          this.invalidateFlow(scope, true);
        const predicate = !spreads.some(Boolean)
          ? this.inlinePredicate(helper.fn, args, scope)
          : undefined;
        if (predicate) return predicate;
        return {
          kind: 'helper-call',
          name: helper.name,
          arguments: args,
          ...(spreads.some(Boolean) ? { spread: spreads } : {}),
          type: helper.fn.returnType,
          span,
        };
      }
      if (
        resolved.module === null &&
        resolved.imported.module === '@proto.ui/core' &&
        resolved.name === 'tw'
      ) {
        const choice = liftStyleCallConditional(node);
        if (choice) return this.expression(module, choice, scope, phase);
        return {
          kind: 'style-handle',
          handle: extractRuleStyleHandle(module, node, (name) =>
            scope.has(name) ? (scope.get(name)?.staticData ?? null) : undefined
          ),
          type: 'style-handle',
          span,
        };
      }
      if (resolved.module === null && resolved.imported.module === '@proto.ui/hooks') {
        const admission = hookAdmission(resolved.name);
        if (admission?.status === 'unsupported')
          rejectNode(
            resolved.imported.node,
            'PUI1003',
            `Unsupported import ${resolved.name} from @proto.ui/hooks: ${admission.reason}`
          );
        operation = admittedHookOperation(resolved.name);
      } else if (
        resolved.module === null &&
        resolved.imported.module === '@proto.ui/core' &&
        Object.hasOwn(CORE_FUNCTIONS, resolved.name)
      )
        operation = CORE_FUNCTIONS[resolved.name as keyof typeof CORE_FUNCTIONS];
      else if (resolved.module !== null && ts.isCallExpression(resolved.node)) {
        const factory = ts.isIdentifier(resolved.node.expression)
          ? this.graph.resolveCoreImport(resolved.module, resolved.node.expression.text)
          : undefined;
        if (
          (phase !== 'setup' && this.context !== 'helper') ||
          (factory === 'defineAsHook' && node.arguments.length) ||
          node.arguments.length > 1
        )
          rejectNode(
            node,
            'PUI1007',
            'Authored hooks install during setup; as-hooks accept no arguments.'
          );
        if (
          !ts.isIdentifier(resolved.node.expression) ||
          (factory !== 'defineAsHook' && factory !== 'defineHook')
        )
          rejectNode(node, 'PUI1004', 'Only static authored-hook source calls are admitted.');
        const definition = { module: resolved.module, node: resolved.node };
        const sourceId = `${definition.module.file.fileName}#${resolved.name}`;
        if (this.activeHooks.has(sourceId))
          rejectNode(node, 'PUI1008', 'Recursive authored-hook composition.');
        const descriptor = this.graph.descriptor(definition.module, definition.node);
        const optionsNode =
          definition.node.typeArguments?.[3] ?? descriptor.setup.parameters[1]?.type;
        const declaredOptionsType =
          factory === 'defineHook'
            ? optionsNode
              ? parseSourceValueType(
                  optionsNode === definition.node.typeArguments?.[3]
                    ? definition.module
                    : descriptor.setupModule,
                  optionsNode,
                  this.substitutions
                )
              : 'void'
            : undefined;
        // Evaluate caller expressions once, before specializing the closed hook
        // body. Unknown generic slots keep the actual checked callback/data
        // shapes rather than pretending narrower callbacks accept arbitrary data.
        let args: ExpressionIR[];
        this.retainingCallerShapes++;
        try {
          args = node.arguments.map((argument) =>
            this.expression(module, argument, scope, phase, undefined, declaredOptionsType)
          );
        } finally {
          this.retainingCallerShapes--;
        }
        const callerOptionsType =
          declaredOptionsType && args[0]
            ? specializeHookOptionShape(declaredOptionsType, args[0].type)
            : declaredOptionsType;
        let staticOptions =
          declaredOptionsType && staticOptionProperties(declaredOptionsType, node.arguments[0]);
        const optionsParameter = descriptor.setup.parameters[1];
        if (
          staticOptions &&
          (!optionsParameter ||
            !ts.isIdentifier(optionsParameter.name) ||
            !readsOnlyStaticOptions(
              descriptor.setup.body!,
              optionsParameter.name.text,
              staticOptions
            ))
        )
          staticOptions = undefined;
        if (staticOptions && descriptor.configure?.parameters[1]) {
          const name = descriptor.configure.parameters[1].name;
          if (
            !ts.isIdentifier(name) ||
            !readsOnlyStaticOptions(descriptor.configure.body!, name.text, staticOptions)
          )
            staticOptions = undefined;
        }
        const optionsType =
          callerOptionsType && staticOptions
            ? specializeOptionType(callerOptionsType, staticOptions, !!node.arguments.length)
            : callerOptionsType;
        const shapeSpecialized =
          callerOptionsType !== undefined &&
          declaredOptionsType !== undefined &&
          !sameType(callerOptionsType, declaredOptionsType);
        const specialization =
          staticOptions || shapeSpecialized
            ? createHash('sha256')
                .update(
                  JSON.stringify({
                    ...(staticOptions
                      ? {
                          constants: [...staticOptions].map(([key, value]) => [
                            key,
                            value.value === undefined ? { undefined: true } : value.value,
                          ]),
                        }
                      : {}),
                    ...(shapeSpecialized ? { shape: callerOptionsType } : {}),
                  })
                )
                .digest('hex')
                .slice(0, 16)
            : undefined;
        const id = sourceId + (specialization ? `#options:${specialization}` : '');
        if (!this.hooks.has(id)) {
          this.activeHooks.add(sourceId);
          this.addModuleDeclarations(descriptor.modules);
          const setup = this.function(
            descriptor.setupModule,
            descriptor.setup,
            new Map(),
            'setup',
            factory === 'defineHook' ? ['def', optionsType!, HOOK_API_TYPE] : ['def'],
            factory === 'defineHook' ? 'helper' : 'setup',
            undefined,
            true,
            true,
            staticOptions
              ? [undefined, { properties: staticOptions, present: !!node.arguments.length }]
              : []
          );
          if (
            factory === 'defineHook' &&
            (setup.parameters.length > 3 ||
              setup.parameters.some(
                (parameter, index) =>
                  !sameType(
                    parameter.type,
                    (['def', optionsType!, HOOK_API_TYPE] satisfies ValueType[])[index]
                  )
              ))
          )
            rejectNode(
              descriptor.setup,
              'PUI1006',
              'Hook setup receives def, options, and its per-installation API.'
            );
          const capture =
            this.captureTypes.get(id) ??
            deriveHookCapture(
              setup,
              this.moduleBindings,
              new Map([...this.hooks].map(([id, hook]) => [id, hook.name])),
              [...this.hooks.values()]
            );
          const hook: AuthoredHookIR = {
            id,
            name: descriptor.name,
            kind: factory === 'defineAsHook' ? 'as-hook' : 'hook',
            mode: descriptor.mode ?? 'once',
            ...(optionsType !== undefined ? { optionsType } : {}),
            setup,
            capture,
            span: descriptor.span,
          };
          this.hooks.set(id, hook);
          if (descriptor.configure) {
            hook.configure = this.function(
              descriptor.configureModule ?? definition.module,
              descriptor.configure,
              new Map(),
              'setup',
              [HOOK_API_TYPE, optionsType!, HOOK_TOOLS_TYPE],
              'helper',
              'void',
              false,
              true,
              staticOptions
                ? [undefined, { properties: staticOptions, present: !!node.arguments.length }]
                : []
            );
            if (
              hook.configure.parameters.length > 3 ||
              hook.configure.parameters.some(
                (parameter, index) =>
                  !sameType(parameter.type, [HOOK_API_TYPE, optionsType!, HOOK_TOOLS_TYPE][index])
              )
            )
              rejectNode(
                descriptor.configure,
                'PUI1006',
                'Hook configure receives its per-installation API, options, and configure tools.'
              );
          }
          if (descriptor.projectHandle)
            hook.projectHandle = this.function(
              descriptor.projectModule ?? definition.module,
              descriptor.projectHandle,
              new Map(),
              'setup',
              [{ kind: 'capture', hookId: id }],
              'helper'
            );
          this.activeHooks.delete(sourceId);
        }
        this.requirements.add('authored-hook');
        const hook = this.hooks.get(id)!;
        if (
          args.some(
            (argument) => argument.type !== 'void' && !assignable(argument.type, hook.optionsType!)
          )
        )
          rejectNode(node, 'PUI1006', 'Hook options do not satisfy the declared caller input.');
        const invocation: ExpressionIR = {
          kind: 'authored-hook',
          hookId: id,
          ...(args.length ? { arguments: args } : {}),
          type: hook.projectHandle?.returnType ?? { kind: 'capture', hookId: id },
          span,
        };
        this.previewCaptures(invocation, scope);
        return invocation;
      } else rejectNode(node, 'PUI1004', `Unadmitted call ${name}.`);
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      // Resolve the public path against the single operation table, including renderer.read.*.
      const paths: string[] = [];
      let root: ts.Expression = node.expression;
      while (ts.isPropertyAccessExpression(root)) {
        optionalOperation ||= !!root.questionDotToken;
        paths.unshift(root.name.text);
        root = root.expression;
      }
      let identity = root;
      while (ts.isNonNullExpression(identity) || ts.isParenthesizedExpression(identity))
        identity = identity.expression;
      if (ts.isIdentifier(identity) && scope.has(identity.text)) {
        const value = this.expression(module, root, scope, phase);
        const fullPath =
          value.type === 'render' && paths.join('.') === 'r.slot' ? 'slot' : paths.join('.');
        const family = operationReceiverType(value.type);
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
        const family = operationReceiverType(receiver.type);
        const path = node.expression.name.text;
        const match = Object.entries(OPERATION_RULES).find(
          ([, rule]) => rule.path === path && sameType(rule.receiver, family)
        );
        if (match) operation = match[0] as SemanticOperation;
      }
    }
    if (!operation)
      return this.ordinaryCall(
        module,
        node,
        this.expression(module, node.expression, scope, phase),
        scope,
        phase
      );
    const rule: OperationRule = OPERATION_RULES[operation];
    const phaseIssues = validateOperationPhase(
      operation,
      phase,
      this.context === 'setup' || this.context === 'render' ? undefined : this.context
    );
    if (phaseIssues.length && this.context !== 'helper')
      rejectNode(node, 'PUI1007', phaseIssues[0].message);
    if (node.arguments.length < rule.min || node.arguments.length > rule.max)
      rejectNode(node, 'PUI1006', `Invalid argument count for ${operation}.`);
    this.requirements.add(operation.split('.')[0]);
    if (operation === 'rule.declare') {
      const lifted = liftRuleDeclarationConditional(node);
      if (lifted) return this.expression(module, lifted, scope, phase);
      const expanded = lowerRuleLiteralArgumentSpreads(node);
      if (expanded) return this.expression(module, expanded, scope, phase);
      if (node.arguments.length !== 1 || !ts.isObjectLiteralExpression(node.arguments[0]))
        rejectNode(node, 'PUI1024', 'Rules require one statically checked declaration.');
      const states = new Map<string, ExpressionIR>();
      const styles = new Map<string, ExpressionIR>();
      const targets = new Map<string, ExpressionIR>();
      const declaration = extractRuleDeclaration(node.arguments[0], {
        id: ++this.ruleSequence,
        order: this.ruleSequence - 1,
        props: new Map([...this.props].map(([key, value]) => [key, value.type])),
        resolveState: (expression) => {
          const binding = ts.isIdentifier(expression) ? scope.get(expression.text) : undefined;
          const value = this.expression(module, expression, scope, phase);
          const type = stateValue(value.type);
          if (!type) return undefined;
          const id = binding?.stateId ?? `#observed:${value.span.file}:${value.span.start}`;
          states.set(id, value);
          return { id, type };
        },
        resolveStatic: (expression) => {
          if (!ts.isIdentifier(expression) || !scope.has(expression.text)) return undefined;
          const value = this.withStaticValues(() =>
            this.expression(module, expression, scope, phase)
          );
          return value.kind === 'literal'
            ? { value: value.value }
            : value.kind === 'undefined'
              ? { value: undefined }
              : undefined;
        },
        resolveStyleReference: (expression) => {
          if (
            !ts.isIdentifier(expression) &&
            !ts.isPropertyAccessExpression(expression) &&
            !ts.isElementAccessExpression(expression)
          )
            return undefined;
          if (ts.isIdentifier(expression) && !scope.has(expression.text)) return undefined;
          const value = this.expression(module, expression, scope, phase);
          if (value.type !== 'style-handle') return undefined;
          const id = `#style:${value.span.file}:${value.span.start}`;
          styles.set(id, value);
          return { id };
        },
        resolveTarget: (expression) => {
          const value = this.expression(module, expression, scope, phase);
          if (value.type !== 'decoration-target') return undefined;
          const id = `#target:${value.span.file}:${value.span.start}`;
          targets.set(id, value);
          return { id };
        },
        resolveStyle: (expression) =>
          ts.isIdentifier(expression) && scope.get(expression.text)?.style
            ? scope.get(expression.text)!.style
            : extractRuleStyleHandle(module, expression, (name) =>
                scope.has(name) ? (scope.get(name)?.staticData ?? null) : undefined
              ),
      });
      const plan = lowerRulePlan([declaration], span);
      if (!plan.ok) throw new CompilerRejection(plan.diagnostics[0]);
      return {
        kind: 'rule',
        declaration,
        receiver: receiver!,
        states: [...states].map(([id, value]) => ({ id, value })),
        ...(styles.size ? { styles: [...styles].map(([id, value]) => ({ id, value })) } : {}),
        ...(targets.size ? { targets: [...targets].map(([id, value]) => ({ id, value })) } : {}),
        type: 'rule-handle',
        span,
      };
    }
    const bindings: OperationBindings = {
      declaredEvents: new Set(this.eventKinds.keys()),
      propNames: new Set(this.props.keys()),
      stateValueType: stateValue(receiver?.type),
      stateDataType: receiver ? this.stateData(receiver, scope) : undefined,
      ...(phase === 'callback' ? { callbackContext: this.context as CallbackContext } : {}),
    };
    const receiverType = receiver
      ? joinValueTypes(
          valueAlternatives(receiver.type).filter((type) => type !== 'null' && type !== 'void')
        )
      : undefined;
    const checkedReceiver =
      receiverType && typeof receiverType !== 'string' && receiverType.kind === 'capture'
        ? 'authored-result'
        : receiverType &&
            typeof receiverType === 'string' &&
            /^(nullable|optional):/.test(receiverType)
          ? (receiverType.slice(receiverType.indexOf(':') + 1) as ValueType)
          : receiverType;
    bindings.stateValueType = stateValue(checkedReceiver);
    if (receiverType && typeof receiverType !== 'string' && receiverType.kind === 'capture') {
      bindings.capture = this.hooks.get(receiverType.hookId)?.capture;
      bindings.childHandles = new Map(
        [...this.hooks].map(([id, hook]) => [
          id,
          hook.projectHandle?.returnType ?? { kind: 'capture', hookId: id },
        ])
      );
    }
    const args: ExpressionIR[] = [];
    for (const [index, argument] of node.arguments.entries()) {
      const callback = operationCallbackRule(operation, index);
      if (
        callback &&
        (!callback.acceptsValue ||
          ts.isArrowFunction(argument) ||
          ts.isFunctionExpression(argument))
      ) {
        if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) {
          const value = this.expression(module, argument, scope, phase);
          const signature = callableValue(value.type);
          if (callback.parameterPolicy === 'declared-method') {
            bindings.methodParameters = signature.parameters;
            bindings.methodReturnType = signature.returnType;
          }
          args.push(value);
          continue;
        }
        let expected = callback.parameters;
        const sourceMethod =
          callback.parameterPolicy === 'declared-method' &&
          args[0]?.kind === 'literal' &&
          typeof args[0].value === 'string'
            ? this.sourceMethodTypes.get(args[0].value)
            : undefined;
        if (sourceMethod) expected = sourceMethod.parameters.map((parameter) => parameter.type);
        if (
          callback.parameterPolicy === 'context-value' ||
          callback.parameterPolicy === 'nullable-context-value'
        ) {
          const value =
            bindings.contextValueType && contextRuntimeValueType(bindings.contextValueType);
          if (!value) rejectNode(argument, 'PUI1006', 'Context key type must be resolved.');
          const item =
            callback.parameterPolicy === 'nullable-context-value'
              ? union([value, 'null'], argument)
              : value;
          expected = ['run', item, item];
        } else if (callback.parameterPolicy === 'context-updater')
          expected = [contextRuntimeValueType(bindings.contextValueType!)];
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
        const context =
          callback.parameterPolicy === 'declared-method'
            ? 'helper'
            : callback.contextFrom === 'caller'
              ? this.context
              : callback.context;
        const fn = this.function(
          module,
          argument,
          scope,
          callback.parameterPolicy === 'declared-method'
            ? this.helperPhase(module, argument, scope)
            : callback.phase,
          expected,
          context,
          callback.parameterPolicy === 'context-updater'
            ? bindings.contextValueType
            : sourceMethod?.returnType
        );
        if (callback.parameterPolicy === 'declared-method') {
          bindings.methodParameters = fn.parameters;
          bindings.methodReturnType = fn.returnType;
        }
        args.push({
          kind: 'function',
          type: callback.parameterPolicy === 'declared-method' ? functionValueType(fn) : 'function',
          function: fn,
          span: sourceSpan(argument),
        });
      } else {
        const argumentRule = operationArgumentRule(operation, index);
        let expected =
          argumentRule?.role === 'context-value' || argumentRule?.role === 'context-next'
            ? bindings.contextValueType
            : (argumentRule?.valueSchema ?? argumentRule?.schema);
        if (operation === 'props.define' && ts.isObjectLiteralExpression(argument)) {
          // Validators run after the declared primitive check. This is a source
          // constraint for their ordinary callback, not a grant of owner authority.
          const fields: { name: string; type: ValueType }[] = [];
          for (const property of argument.properties) {
            if (
              !ts.isPropertyAssignment(property) ||
              !ts.isObjectLiteralExpression(property.initializer)
            )
              continue;
            const typeProperty = property.initializer.properties.find(
              (item) =>
                ts.isPropertyAssignment(item) &&
                !ts.isComputedPropertyName(item.name) &&
                propertyName(item.name) === 'type'
            ) as ts.PropertyAssignment | undefined;
            if (!typeProperty || !ts.isStringLiteral(typeProperty.initializer)) continue;
            const key = ts.isComputedPropertyName(property.name)
              ? scalarConstant(
                  this.withStaticValues(() =>
                    this.expression(
                      module,
                      (property.name as ts.ComputedPropertyName).expression,
                      scope,
                      phase
                    )
                  )
                )?.value
              : propertyName(property.name);
            if (typeof key !== 'string') continue;
            const tag = typeProperty.initializer.text;
            const input: ValueType =
              tag === 'boolean' || tag === 'number' || tag === 'string'
                ? tag
                : tag === 'enum'
                  ? 'string'
                  : (this.sourcePropTypes.get(key) ?? 'unknown');
            fields.push({
              name: key,
              type: objectValueType([
                {
                  name: 'validator',
                  type: {
                    kind: 'callable',
                    parameters: [{ name: 'value', type: input }],
                    returnType: 'boolean',
                  },
                  optional: true,
                },
              ]),
            });
          }
          expected = objectValueType(fields);
        }
        args.push(this.expression(module, argument, scope, phase, argumentRule, expected));
      }
      if (index === 0) {
        if (operation.startsWith('capture.'))
          bindings.captureKey = this.literalString(args[0], argument);
        bindings.contextValueType = this.contextType(args[0]);
        if (operation === 'event.on' || operation === 'event.onGlobal') {
          const type = this.literalString(args[0], argument);
          bindings.inputPayloadType =
            operation === 'event.on' && this.numericActionEvents.has(type)
              ? 'a11y-value-event'
              : type.startsWith('host:')
                ? 'host-event'
                : 'event';
        }
        if (operation === 'expose.emit') {
          const names = finiteStringKeys(args[0]);
          if (!names) rejectNode(argument, 'PUI1006', 'Emit requires finite declared event keys.');
          const types = names.map((name) => {
            const exposure = this.exposes.get(name);
            if (!exposure || exposure.kind !== 'event')
              rejectNode(argument, 'PUI1006', `Emit requires a declared outward event ${name}.`);
            return exposure.payload;
          });
          if (!types.every((type) => sameType(type, types[0])))
            rejectNode(
              argument,
              'PUI1006',
              'Dynamic event keys require one shared payload signature.'
            );
          bindings.eventPayloadType = types[0];
        }
      }
    }
    if (operation === 'expose.emit') {
      const names = finiteStringKeys(args[0])!;
      const kind = this.eventKinds.get(names[0])!;
      const payload = serializableDataType(args[1]?.type ?? 'void');
      if (
        payload === undefined ||
        (kind === 'void' && payload !== 'void') ||
        (kind === 'json' && payload === 'void')
      )
        rejectNode(node, 'PUI1006', 'Outward payload does not match its declared data boundary.');
      for (const name of names) this.eventPayloads.get(name)!.push(payload);
      bindings.eventPayloadType = kind === 'void' ? 'void' : payload;
    }
    const issues = validateOperationArguments(operation, args, checkedReceiver, bindings);
    if (issues.length)
      rejectNode(
        node.arguments[issues[0].argument ?? -1] ?? node,
        issues[0].code.includes('context') ? 'PUI1007' : 'PUI1006',
        issues[0].message
      );
    this.metadata(operation, node, args, receiver);
    let type = operationResultType(operation, checkedReceiver, bindings);
    if (type === undefined)
      rejectNode(node, 'PUI1006', 'Semantic result type could not be resolved.');
    if (optionalOperation) type = joinValueTypes([type, 'void']);
    if (
      OPERATION_RULES[operation].effects.some((effect) =>
        ['write', 'signal', 'request-update'].includes(effect.kind)
      )
    )
      this.invalidateFlow(scope, true);
    return {
      kind: 'operation',
      operation,
      ...(receiver ? { receiver } : {}),
      ...(optionalOperation ? { optional: true } : {}),
      ...(bindings.inputPayloadType ? { inputPayloadType: bindings.inputPayloadType } : {}),
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
    if (operation === 'accessible.action') {
      const event = declaredSetValueEvent(args);
      if (event) this.numericActionEvents.add(event);
    }
    if (operation === 'hook.asTableStructure') {
      const family = tableStructureFamily(span);
      if (!this.staticDeclarations.has(family.id)) this.staticDeclarations.set(family.id, family);
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
        let type: DataType | undefined =
          item?.value.kind === 'literal' &&
          ['boolean', 'number', 'string'].includes(String(item.value.value))
            ? (item.value.value as DataType)
            : undefined;
        if (item?.value.kind === 'literal' && item.value.value === 'enum') {
          const options = entry.value.entries.find((entry) => entry.key === 'options')?.value;
          if (
            options?.kind !== 'array' ||
            !options.elements.length ||
            !options.elements.every(
              (option) => option.kind === 'literal' && typeof option.value === 'string'
            )
          )
            rejectNode(node, 'PUI1006', 'Enum props require finite static string options.');
          type = parseDataType({
            kind: 'union',
            members: options.elements.map((option) => ({
              kind: 'literal',
              value: (option as Extract<ExpressionIR, { kind: 'literal' }>).value,
            })),
          });
        }
        if (
          item?.value.kind === 'literal' &&
          (item.value.value === 'object' || item.value.value === 'any')
        ) {
          const declared = this.sourcePropTypes.get(entry.key);
          if (
            declared &&
            (item.value.value === 'any' ||
              valueAlternatives(declared).every(
                (member) =>
                  member === 'null' ||
                  member === 'void' ||
                  (typeof member !== 'string' &&
                    (member.kind === 'array' || member.kind === 'record'))
              ))
          )
            type = declared;
        }
        if (type === undefined)
          rejectNode(
            node,
            'PUI1006',
            'Props require a primitive/enum schema or a finite authored object data type.'
          );
        const prior = this.props.get(entry.key);
        if (prior && !sameType(prior.type, type))
          rejectNode(node, 'PUI1006', `Conflicting prop type ${entry.key}.`);
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
        const method = args[1].kind === 'function' ? args[1].function : callableValue(args[1].type);
        if (method.parameters.some((parameter) => hasCaptureLookup(parameter.type)))
          rejectNode(
            node,
            'PUI1006',
            'Public method parameters cannot claim capture getter lookup signatures.'
          );
        if (!isPublicValueType(method.returnType))
          rejectNode(
            node,
            'PUI1006',
            'Exposed methods cannot return setup or execution-scope capabilities.'
          );
        exposure = {
          name,
          kind: 'method',
          parameters: method.parameters,
          returnType: method.returnType,
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

  private addModuleDeclarations(declarations: readonly ModuleDeclarationIR[]): void {
    for (const declaration of declarations) {
      const previous = this.moduleDeclarations.get(declaration.id);
      if (previous && JSON.stringify(previous.config) !== JSON.stringify(declaration.config))
        throw new CompilerRejection({
          code: 'PUI1025',
          category: 'unsupported-input',
          message: `Conflicting Module requirements ${declaration.id}.`,
          span: declaration.span,
        });
      this.moduleDeclarations.set(declaration.id, declaration);
    }
  }
  compile(): PrototypeIR {
    const fileName = sourceName(this.options.fileName ?? 'input.proto.ts');
    const module = this.graph.load(fileName);
    this.graph.validateExports();
    for (const loaded of this.graph.modules.values()) {
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node)) this.sourceNames.add(node.text);
        ts.forEachChild(node, visit);
      };
      visit(loaded.file);
    }
    const exportName = this.options.exportName ?? 'default';
    const definition = this.graph.definition(module, exportName);
    if (definition.factory !== 'definePrototype')
      rejectNode(definition.node, 'PUI1002', 'A subjectless asHook requires a caller prototype.');
    const descriptor = this.graph.descriptor(definition.module, definition.node);
    this.addModuleDeclarations(descriptor.modules);
    const setup = this.function(descriptor.setupModule, descriptor.setup, new Map(), 'setup', [
      'def',
    ]);
    for (const loaded of this.graph.modules.values())
      for (const [name, declaration] of loaded.declarations) {
        if (
          ts.isCallExpression(declaration) &&
          !this.graph.staticDataDeclaration(loaded, declaration) &&
          staticScalarMembership(declaration) === undefined
        ) {
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
        }
      }
    for (const [name, values] of this.eventPayloads) {
      const exposure = this.exposes.get(name)!;
      if (exposure.kind === 'event' && this.eventKinds.get(name) !== 'void')
        exposure.payload = union(values, descriptor.setup) as DataType;
    }
    const recordedSources = new Map(
      [...this.graph.modules].map(([name, module]) => [name, module.file])
    );
    for (const [name, file] of this.graph.typeSources) recordedSources.set(name, file);
    const sourceFiles = [...recordedSources]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, value]) => ({
        file,
        content: value.text,
        sha256: createHash('sha256').update(value.text).digest('hex'),
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
      ...(this.moduleBindings.length ? { moduleBindings: this.moduleBindings } : {}),
      contextKeys: [...this.contextKeys.values()],
      staticDeclarations: [...this.staticDeclarations.values()],
      moduleDeclarations: [...this.moduleDeclarations.values()],
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
    // Readonly is a view permission, not a promise that aliases never mutate.
    // Derive the write footprint from lowered code, then recheck observations
    // with the same footprint that a source-free IR importer independently sees.
    let fields: ReadonlySet<string> = new Set();
    let captures: ReadonlyMap<string, import('./ir').HookCaptureIR> = new Map();
    let readonlyCalls: ReadonlySet<string> = new Set();
    let candidate = true;
    let value: PrototypeIR;
    const observedFootprints = new Set<string>();
    for (;;) {
      const key = JSON.stringify([
        candidate,
        [...fields].sort(),
        [...captures],
        [...readonlyCalls].sort(),
      ]);
      if (observedFootprints.has(key))
        throw new Error(
          'Closed-call and member-write flow analysis did not reach a stable checked graph.'
        );
      observedFootprints.add(key);
      // A preliminary graph defers only ordinary-call invalidation so forward
      // closures and later writes are visible to the same closed-store analysis.
      // It is never returned or emitted. The strict pass below grants an
      // observation only at sites proven read-only across every invocation.
      value = new Frontend(source, options, fields, captures, readonlyCalls, candidate).compile();
      const closedCaptures = derivePrototypeCaptures(value);
      const capturesStable = JSON.stringify([...captures]) === JSON.stringify([...closedCaptures]);
      for (const hook of value.hooks) hook.capture = closedCaptures.get(hook.id);
      const loweredFields = writtenMemberFields(value);
      const closedReadonlyCalls = deriveReadonlyCallSites(value);
      const flowStable =
        capturesStable &&
        fields.size === loweredFields.size &&
        [...fields].every((field) => loweredFields.has(field));
      if (
        !candidate &&
        flowStable &&
        readonlyCalls.size === closedReadonlyCalls.size &&
        [...readonlyCalls].every((site) => closedReadonlyCalls.has(site))
      )
        break;
      candidate = !flowStable;
      fields = loweredFields;
      captures = closedCaptures;
      readonlyCalls = closedReadonlyCalls;
    }
    const effect = callableEffectIssue(value);
    if (effect)
      throw new CompilerRejection({ code: 'PUI1007', category: 'unsupported-input', ...effect });
    const accessorStorage = moduleAccessorStorageIssue(value);
    if (accessorStorage)
      throw new CompilerRejection({
        code: 'PUI1007',
        category: 'unsupported-input',
        ...accessorStorage,
      });
    return { ok: true, value };
  } catch (error) {
    if (error instanceof CompilerRejection) return { ok: false, diagnostics: [error.diagnostic] };
    const file = sourceName(options.fileName ?? 'input.proto.ts');
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI1999',
          category: 'compiler-defect',
          message: `Unexpected frontend failure (source location unknown): ${unexpectedFailureEvidence(error)}`,
          span: unknownDiagnosticSpan(file),
        },
      ],
    };
  }
}

/** A module declaration that is lowered as a shared module value. */
function moduleDataNode(node: ts.Node): boolean {
  if (!ts.isExpression(node)) return false;
  if (scalarInitializer(node)) return true;
  if (staticCallableSelection(node)) return true;
  if (staticGetterRecordInitializer(node)) return true;
  // Declaration factories carry their own static identity. They must reach the
  // context/style/capability dispatch below instead of ordinary value parsing.
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) return false;
  return (
    !ts.isIdentifier(node) &&
    !isSourceFunction(node) &&
    // SourceGraph already admitted each nested call against its resolved core binding.
    staticDataInitializer(node, (call) => ts.isIdentifier(call.expression))
  );
}

function mutableScalarType(type: ValueType): ValueType {
  if (typeof type !== 'string' && type.kind === 'literal' && type.value !== null)
    return typeof type.value as 'boolean' | 'number' | 'string';
  return type;
}

function isSharedModuleValueType(type: ValueType): boolean {
  if (serializableDataType(type) !== undefined) return true;
  if (typeof type === 'string')
    return [
      'style-handle',
      'context-key',
      'anatomy-family',
      'focus-scope-key',
      'focus-roving-key',
      'a11y-ref',
    ].includes(type);
  if (type.kind === 'set') return isDataValueType(type.element);
  if (type.kind === 'value-array') return isSharedModuleValueType(type.element);
  if (type.kind === 'value-union') return type.members.every(isSharedModuleValueType);
  return (
    type.kind === 'object' &&
    type.index === undefined &&
    type.fields.every((field) => isSharedModuleValueType(field.type))
  );
}

/**
 * Nominal static declaration composites expose readonly records. Finite ordinary
 * data bypasses this projection and retains its explicitly authored permissions;
 * sharing a const binding does not make its data fields immutable.
 */
function deepReadonly(type: ValueType): ValueType | undefined {
  if (typeof type === 'string') return type;
  if (type.kind === 'literal') return type;
  if (type.kind === 'set')
    return isDataValueType(type.element) ? { ...type, readonly: true } : undefined;
  if (type.kind === 'value-array') {
    const element = deepReadonly(type.element);
    return element === undefined ? undefined : ordinaryArrayType(element, true);
  }
  if (type.kind === 'record' || type.kind === 'object') {
    if (type.kind === 'object' && type.index !== undefined) return undefined;
    const fields: {
      name: string;
      type: ValueType;
      optional?: boolean;
      readonly?: boolean;
      accessor?: 'get';
    }[] = [];
    for (const field of type.fields) {
      const inner = deepReadonly(field.type);
      if (inner === undefined) return undefined;
      fields.push({
        name: field.name,
        type: inner,
        ...(field.optional ? { optional: true } : {}),
        ...('accessor' in field && field.accessor ? { accessor: field.accessor } : {}),
        readonly: true,
      });
    }
    return { kind: 'object', fields };
  }
  if (type.kind === 'array')
    return valueAlternatives(type.element).every(
      (member) => typeof member === 'string' || member.kind === 'literal'
    )
      ? type
      : undefined;
  if (type.kind === 'union' || type.kind === 'value-union') {
    const members = type.members.map(deepReadonly);
    return members.every((member) => member !== undefined)
      ? joinValueTypes(members as ValueType[])
      : undefined;
  }
  return undefined;
}

/** A const assertion restricts the new literal's nested views, never a caller's value. */
function readonlyLiteralType(type: ValueType): ValueType {
  if (typeof type === 'string') return type;
  if (type.kind === 'array' || type.kind === 'value-array')
    return ordinaryArrayType(readonlyLiteralType(type.element), true);
  if (type.kind === 'record' || type.kind === 'object')
    return {
      kind: 'object',
      fields: type.fields.map((field) => ({
        ...field,
        readonly: true,
        type: readonlyLiteralType(field.type),
      })),
      ...(type.kind === 'object' && type.index !== undefined ? { index: type.index } : {}),
    };
  if (type.kind === 'union' || type.kind === 'value-union')
    return joinValueTypes(type.members.map(readonlyLiteralType));
  return type;
}

const loweredPatterns = new WeakMap<ts.Statement, ts.Statement>();

/**
 * `const { a, b: c } = source` declares `a` and `c` as reads of `source.a` and
 * `source.b`. A source that is not a plain identifier is evaluated once into a
 * compiler-named binding first, so its effects and its value are not repeated.
 * Each synthesized node keeps the source range it came from, so diagnostics,
 * binding identities and provenance still point at the authored pattern.
 * Defaults, rest elements, nested and computed patterns keep an explicit
 * diagnostic until they have their own definition.
 */
function lowerObjectPatterns(nodes: readonly ts.Statement[]): readonly ts.Statement[] {
  if (!nodes.some(hasObjectPattern)) return nodes;
  return nodes.map((node) => {
    if (!hasObjectPattern(node)) return node;
    const cached = loweredPatterns.get(node);
    if (cached) return cached;
    const statement = node as ts.VariableStatement;
    const factory = ts.factory;
    const ranged = <T extends ts.Node>(created: T, from: ts.TextRange): T =>
      ts.setTextRange(created, from);
    const declarations: ts.VariableDeclaration[] = [];
    for (const declaration of statement.declarationList.declarations) {
      const pattern = declaration.name;
      if (!ts.isObjectBindingPattern(pattern) && !ts.isArrayBindingPattern(pattern)) {
        declarations.push(declaration);
        continue;
      }
      if (!declaration.initializer)
        rejectNode(declaration, 'PUI1004', 'A destructuring declaration requires an initializer.');
      const init = declaration.initializer;
      let source: () => ts.Expression;
      if (ts.isIdentifier(init) && !declaration.type) {
        source = () => ranged(factory.createIdentifier(init.text), init);
      } else {
        const name = `__puiPattern${declaration.pos}`;
        declarations.push(
          ranged(
            factory.createVariableDeclaration(
              ranged(factory.createIdentifier(name), pattern),
              undefined,
              declaration.type,
              init
            ),
            declaration
          )
        );
        source = () => ranged(factory.createIdentifier(name), init);
      }
      for (const [index, element] of pattern.elements.entries()) {
        if (ts.isOmittedExpression(element)) continue;
        if (element.dotDotDotToken)
          rejectNode(
            element,
            'PUI1004',
            'Rest elements in a destructuring pattern are not admitted.'
          );
        if (element.initializer)
          rejectNode(element, 'PUI1004', 'Defaults in a destructuring pattern are not admitted.');
        if (!ts.isIdentifier(element.name))
          rejectNode(element, 'PUI1004', 'Nested destructuring patterns are not admitted.');
        const key = element.propertyName;
        if (key && !ts.isIdentifier(key) && !ts.isStringLiteral(key))
          rejectNode(key, 'PUI1004', 'A destructured key must be a static name.');
        const field = key ? key.text : element.name.text;
        const read = ts.isArrayBindingPattern(pattern)
          ? factory.createElementAccessExpression(source(), factory.createNumericLiteral(index))
          : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field)
            ? factory.createPropertyAccessExpression(source(), field)
            : factory.createElementAccessExpression(source(), factory.createStringLiteral(field));
        declarations.push(
          ranged(
            factory.createVariableDeclaration(
              ranged(factory.createIdentifier(element.name.text), element.name),
              undefined,
              undefined,
              ranged(read, element)
            ),
            element
          )
        );
      }
    }
    const list = ranged(
      factory.createVariableDeclarationList(
        declarations,
        statement.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)
      ),
      statement.declarationList
    );
    const lowered = ranged(factory.createVariableStatement(statement.modifiers, list), statement);
    (lowered as { parent: ts.Node }).parent = statement.parent;
    // TypeScript exports this helper at runtime but omits it from its public declarations.
    (
      ts as typeof ts & {
        setParentRecursive<T extends ts.Node>(node: T, incremental?: boolean): T;
      }
    ).setParentRecursive(lowered, true);
    loweredPatterns.set(node, lowered);
    return lowered;
  });
}

function hasObjectPattern(node: ts.Statement): boolean {
  return (
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (declaration) =>
        ts.isObjectBindingPattern(declaration.name) || ts.isArrayBindingPattern(declaration.name)
    )
  );
}

const unrolledLoops = new WeakMap<ts.Statement, readonly ts.Statement[]>();

/** Flat literal tables are static only while their container never escapes or mutates. */
function staticLocalBindings(
  nodes: readonly ts.Statement[],
  objectUnshadowed: boolean
): Map<string, ts.Expression | undefined> {
  const bindings = new Map<string, ts.Expression | undefined>();
  const candidates = new Map<string, ts.VariableDeclaration>();
  const shadow = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) bindings.set(name.text, undefined);
    else
      for (const element of name.elements)
        if (!ts.isOmittedExpression(element)) shadow(element.name);
  };
  // Expansion precedes semantic predeclaration, so all lexical names must block
  // builtin/module lookup here, including hoisted functions and binding patterns.
  for (const statement of nodes) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) shadow(declaration.name);
    else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    )
      shadow(statement.name);
  }
  for (const statement of nodes)
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) {
          const name = declaration.name.text;
          bindings.set(name, undefined);
          if (!(statement.declarationList.flags & ts.NodeFlags.Const) || !declaration.initializer)
            continue;
          const value = unwrapSourceExpression(declaration.initializer);
          const scalar = (node: ts.Expression) => scalarInitializer(unwrapSourceExpression(node));
          const flat = ts.isArrayLiteralExpression(value)
            ? value.elements.every((element) => !ts.isSpreadElement(element) && scalar(element))
            : ts.isObjectLiteralExpression(value) &&
              value.properties.every(
                (property) =>
                  ts.isPropertyAssignment(property) &&
                  !ts.isComputedPropertyName(property.name) &&
                  scalar(property.initializer)
              );
          if (flat) {
            candidates.set(name, declaration);
            bindings.set(name, value);
          }
        }
    }
  for (const [name, declaration] of candidates) {
    let safe = true;
    const visit = (node: ts.Node): void => {
      if (!safe) return;
      if (ts.isIdentifier(node) && node.text === name && node !== declaration.name) {
        const parent = node.parent;
        if (
          (ts.isPropertyAssignment(parent) && parent.name === node) ||
          (ts.isPropertyAccessExpression(parent) && parent.name === node)
        )
          return;
        if (
          objectUnshadowed &&
          !bindings.has('Object') &&
          ts.isCallExpression(parent) &&
          parent.arguments[0] === node &&
          parent.arguments.length === 1 &&
          ts.isPropertyAccessExpression(parent.expression) &&
          ts.isIdentifier(parent.expression.expression) &&
          parent.expression.expression.text === 'Object' &&
          parent.expression.name.text === 'keys'
        )
          return;
        let read: ts.Node = node;
        while (
          (ts.isPropertyAccessExpression(read.parent) ||
            ts.isElementAccessExpression(read.parent)) &&
          read.parent.expression === read
        )
          read = read.parent;
        if (read === node) {
          safe = false;
          return;
        }
        const use = read.parent;
        if (
          (ts.isBinaryExpression(use) &&
            use.left === read &&
            use.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            use.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
          ts.isPrefixUnaryExpression(use) ||
          ts.isPostfixUnaryExpression(use) ||
          ts.isDeleteExpression(use) ||
          (ts.isCallExpression(use) && use.expression === read)
        )
          safe = false;
      }
      ts.forEachChild(node, visit);
    };
    for (const node of nodes) visit(node);
    if (!safe) bindings.set(name, undefined);
  }
  return bindings;
}

function staticForEach(node: ts.Statement): ts.ForOfStatement | undefined {
  if (!ts.isExpressionStatement(node)) return;
  const call = unwrapSourceExpression(node.expression);
  if (
    !ts.isCallExpression(call) ||
    call.questionDotToken ||
    call.arguments.length !== 1 ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== 'forEach'
  )
    return;
  const callback = call.arguments[0];
  if (
    !ts.isArrowFunction(callback) ||
    callback.modifiers?.length ||
    callback.parameters.length !== 1 ||
    !ts.isIdentifier(callback.parameters[0].name) ||
    callback.parameters[0].initializer ||
    callback.parameters[0].dotDotDotToken
  )
    return;
  let abrupt = false;
  const inspect = (part: ts.Node): void => {
    if (ts.isFunctionLike(part)) return;
    if (ts.isReturnStatement(part) || ts.isBreakStatement(part) || ts.isContinueStatement(part))
      abrupt = true;
    ts.forEachChild(part, inspect);
  };
  inspect(callback.body);
  if (abrupt) return;
  const factory = ts.factory;
  const ranged = <T extends ts.Node>(created: T, from: ts.Node): T =>
    ts.setTextRange(created, from);
  const variable = ranged(
    factory.createVariableDeclaration(callback.parameters[0].name),
    callback.parameters[0]
  );
  const list = ranged(
    factory.createVariableDeclarationList([variable], ts.NodeFlags.Const),
    callback.parameters[0]
  );
  const body = ts.isBlock(callback.body)
    ? callback.body
    : ranged(factory.createExpressionStatement(callback.body), callback.body);
  const loop = ranged(
    factory.createForOfStatement(undefined, list, call.expression.expression, body),
    node
  );
  (loop as { parent: ts.Node }).parent = node.parent;
  linkParents(loop);
  return loop;
}

/**
 * `for (const x of <static list>) { ... }` over finite literal data is expanded
 * at compile time: the body is repeated once per element, with each read of
 * `x` replaced by that element's literal. A static list is an array literal of
 * string or number literals, a module binding that resolves to one, or
 * `Object.keys(<module object literal>)`. Each synthesized literal keeps the
 * source range of the identifier it replaces. Other checked iterables retain
 * ordinary runtime iteration and its element provenance.
 */
function unrollStaticLoops(
  module: SourceModule,
  nodes: readonly ts.Statement[],
  locals: ReadonlyMap<string, ts.Expression | undefined> = new Map()
): readonly ts.Statement[] {
  const out: ts.Statement[] = [];
  for (const original of nodes) {
    const node = staticForEach(original) ?? original;
    if (!ts.isForOfStatement(node)) {
      out.push(node);
      continue;
    }
    const cached = unrolledLoops.get(node);
    if (cached) {
      out.push(...cached);
      continue;
    }
    const list = node.initializer;
    if (
      node.awaitModifier ||
      !ts.isVariableDeclarationList(list) ||
      !(list.flags & ts.NodeFlags.Const) ||
      list.declarations.length !== 1 ||
      !ts.isIdentifier(list.declarations[0].name)
    ) {
      out.push(node);
      continue;
    }
    const values = staticLoopValues(module, node.expression, new Set(), locals);
    if (!values) {
      out.push(node);
      continue;
    }
    const name = list.declarations[0].name.text;
    const body = ts.isBlock(node.statement) ? node.statement.statements : [node.statement];
    const hasDeclarations = body.some(
      (statement) => ts.isVariableStatement(statement) || ts.isFunctionDeclaration(statement)
    );
    const expanded: ts.Statement[] = [];
    for (const value of values) {
      const iteration = lowerStaticIterationContinue(
        body.map((statement) => substituteLoopValue(statement, name, value, node.parent)),
        node
      );
      if (!hasDeclarations) expanded.push(...iteration);
      else {
        const statements = unrollStaticLoops(module, decideLiteralBranches(iteration), locals);
        // Keep a real lexical block per unrolled iteration. Captured consts
        // retain their iteration's slot rather than sharing a flattened name.
        const scoped = ts.setTextRange(
          ts.factory.createIfStatement(
            ts.setTextRange(ts.factory.createTrue(), node.expression),
            ts.setTextRange(ts.factory.createBlock(statements, true), node.statement)
          ),
          node
        );
        (scoped as ts.Node & { parent: ts.Node }).parent = node.parent;
        (
          ts as typeof ts & { setParentRecursive(node: ts.Node, incremental?: boolean): void }
        ).setParentRecursive(scoped, true);
        expanded.push(scoped);
      }
    }
    // A nested static loop is unrolled within each copy of its enclosing body,
    // and a branch whose condition is now made of literals only is decided.
    const unrolled = hasDeclarations
      ? expanded
      : unrollStaticLoops(module, decideLiteralBranches(expanded), locals);
    unrolledLoops.set(node, unrolled);
    out.push(...unrolled);
  }
  return out;
}

function staticLoopValues(
  module: SourceModule,
  node: ts.Expression,
  active: Set<string>,
  locals: ReadonlyMap<string, ts.Expression | undefined> = new Map()
): (string | number)[] | undefined {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  )
    node = node.expression;
  if (ts.isArrayLiteralExpression(node)) {
    const values: (string | number)[] = [];
    for (let element of node.elements) {
      while (ts.isParenthesizedExpression(element) || ts.isAsExpression(element))
        element = element.expression;
      if (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element))
        values.push(element.text);
      else if (ts.isNumericLiteral(element)) values.push(Number(element.text));
      else return undefined;
    }
    return values;
  }
  const resolved = (
    identifier: ts.Identifier
  ): { module: SourceModule; node: ts.Expression } | undefined => {
    if (locals.has(identifier.text)) {
      const node = locals.get(identifier.text);
      const identity = `${module.file.fileName}#local:${node?.pos}:${identifier.text}`;
      if (!node || node.pos >= identifier.pos || active.has(identity)) return undefined;
      active.add(identity);
      return { module, node };
    }
    if (!module.declarations.has(identifier.text) && !module.imports.has(identifier.text))
      return undefined;
    const binding = module.graph.resolveBinding(module, identifier.text);
    if (!binding.module || !ts.isExpression(binding.node)) return undefined;
    const identity = `${binding.module.file.fileName}#${binding.name}`;
    if (active.has(identity)) return undefined;
    active.add(identity);
    return { module: binding.module, node: binding.node };
  };
  if (ts.isIdentifier(node)) {
    const target = resolved(node);
    return (
      target &&
      staticLoopValues(
        target.module,
        target.node,
        active,
        target.module === module ? locals : new Map()
      )
    );
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'Object' &&
    !locals.has('Object') &&
    !module.declarations.has('Object') &&
    !module.imports.has('Object') &&
    node.expression.name.text === 'keys' &&
    node.arguments.length === 1 &&
    ts.isIdentifier(node.arguments[0])
  ) {
    const target = resolved(node.arguments[0]);
    let object = target?.node;
    while (
      object &&
      (ts.isParenthesizedExpression(object) ||
        ts.isAsExpression(object) ||
        ts.isSatisfiesExpression(object))
    )
      object = object.expression;
    if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
    const keys: string[] = [];
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) return undefined;
      if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        keys.push(property.name.text);
      else return undefined;
    }
    // Object.keys uses ECMAScript own-key ordering, not source declaration order.
    if (keys.includes('__proto__')) return undefined;
    return Object.keys(Object.fromEntries(keys.map((key) => [key, true])));
  }
  return undefined;
}

function substituteLoopValue(
  statement: ts.Statement,
  name: string,
  value: string | number,
  parent: ts.Node
): ts.Statement {
  const literal = ts.setTextRange(
    typeof value === 'number'
      ? ts.factory.createNumericLiteral(value)
      : ts.factory.createStringLiteral(value),
    statement
  );
  return replaceStaticBindings(statement, new Map([[name, literal]]), parent);
}

/** An `if` whose condition compares literals only is decided at compile time. */
function decideLiteralBranches(nodes: readonly ts.Statement[]): ts.Statement[] {
  const out: ts.Statement[] = [];
  for (const node of nodes) {
    if (!ts.isIfStatement(node)) {
      out.push(node);
      continue;
    }
    const decided = literalCondition(node.expression);
    if (decided === undefined) {
      out.push(node);
      continue;
    }
    const branch = decided ? node.thenStatement : node.elseStatement;
    if (!branch) continue;
    out.push(...decideLiteralBranches(ts.isBlock(branch) ? branch.statements : [branch]));
  }
  return out;
}

function literalCondition(node: ts.Expression): boolean | undefined {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  const literal = (value: ts.Expression): string | number | boolean | undefined => {
    while (ts.isParenthesizedExpression(value)) value = value.expression;
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
    if (ts.isNumericLiteral(value)) return Number(value.text);
    if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
    return undefined;
  };
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = literalCondition(node.operand);
    return inner === undefined ? undefined : !inner;
  }
  if (!ts.isBinaryExpression(node)) {
    const value = literal(node);
    return typeof value === 'boolean' ? value : undefined;
  }
  const operator = node.operatorToken.kind;
  if (
    operator === ts.SyntaxKind.BarBarToken ||
    operator === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    const left = literalCondition(node.left),
      right = literalCondition(node.right);
    if (left === undefined || right === undefined) return undefined;
    return operator === ts.SyntaxKind.BarBarToken ? left || right : left && right;
  }
  if (
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken
  ) {
    const left = literal(node.left),
      right = literal(node.right);
    if (left === undefined || right === undefined) return undefined;
    return operator === ts.SyntaxKind.EqualsEqualsEqualsToken ? left === right : left !== right;
  }
  return undefined;
}

/** Point every descendant of a synthesized node at its actual parent. */
function linkParents(node: ts.Node): void {
  ts.forEachChild(node, (child) => {
    (child as { parent: ts.Node }).parent = node;
    linkParents(child);
  });
}
