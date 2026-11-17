import { eventPayloadMemberType, eventValueJoin } from './event-types';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { CompilerRejection } from './diagnostics';
import { admittedHookOperation } from './hook-admission';

import {
  OPERATION_RULES,
  operationCallbackRule,
  operationArgumentRule,
  operationResultType,
  argumentData,
  argumentValue,
  validateOperationArguments,
  validateOperationPhase,
  isTemplateChildType,
  capabilityMemberType,
  capabilityBinaryType,
  stateValue,
  stateDeclarationData,
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
import { callableEffectIssue } from './callable-effects';
import { FlowProof, functionCanMutateFlow, writtenMemberFields, type FlowMark } from './flow-proof';
import { HOOK_API_TYPE, HOOK_TOOLS_TYPE } from './core-value-types';
import {
  valueTypeEqual,
  valueAssignable,
  joinValueTypes,
  objectFields,
  objectValueType,
  memberValueType,
  functionValueType,
  callableValue,
  checkedCall,
  arrayEveryCallbackParameters,
  intrinsicResult,
  valueAlternatives,
  canNarrowValue,
  erasesRuntimeAuthority,
} from './value-types';
import {
  STATIC_CORE_VALUES,
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

interface Binding {
  type: ValueType;
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
}
type Scope = Map<string, Binding>;
const CAPABILITY_ANNOTATIONS: Readonly<Record<string, string>> = {
  def: 'DefHandle',
  run: 'RunHandle',
  render: 'RendererHandle',
  event: 'ProtoEventPayload',
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
function union(types: readonly ValueType[], node: ts.Node): ValueType {
  if (!types.length) return 'void';
  if (types.every((type) => sameType(type, types[0]))) return types[0];
  const eventJoin = eventValueJoin(types);
  if (eventJoin !== undefined) return eventJoin;
  if (!types.every(isDataValueType) && types.every(isTemplateChildType)) return 'template';
  return joinValueTypes(types);
}
class Frontend {
  readonly graph: SourceGraph;
  readonly hooks = new Map<string, AuthoredHookIR>();
  readonly props = new Map<string, PropIR>();
  readonly exposes = new Map<string, ExposureIR>();
  readonly contextKeys = new Map<string, ContextKeyIR>();
  readonly staticDeclarations = new Map<string, StaticCapabilityIR>();
  readonly moduleDeclarations = new Map<string, ModuleDeclarationIR>();
  readonly requirements = new Set<string>();
  readonly activeHooks = new Set<string>();
  readonly activeHelpers = new Set<string>();
  readonly eventKinds = new Map<string, 'void' | 'json' | 'any'>();
  readonly eventPayloads = new Map<string, DataType[]>();
  private context: FunctionContext = 'setup';
  private ruleSequence = 0;
  private moduleSequence = 0;
  private readonly moduleBindings: Extract<StatementIR, { kind: 'const' }>[] = [];
  private readonly moduleValues = new Map<string, Binding & { name: string }>();
  private readonly moduleHelpers = new Map<string, { name: string; fn: FunctionIR }>();
  private readonly sourceNames = new Set<string>();
  private flow: FlowProof;
  private substitutions: TypeSubstitutions = new Map();
  private returnContext?: ValueType;
  private renderReturn = false;
  private readonly statementPrefixes: StatementIR[][] = [];
  private previewingCaptures = false;
  private lexicalExecution: object = {};

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
    if (ts.isIdentifier(node))
      return (
        scope.get(node.text)?.lexical ??
        scope.get(node.text)?.type ??
        (node.text === 'undefined' ? 'void' : 'unknown')
      );
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
      return this.previewFunction(module, node, scope);
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

  private previewFunction(
    module: SourceModule,
    node: FunctionNode,
    scope: Scope,
    contextual?: ValueType
  ): Extract<ValueType, { kind: 'callable' }> {
    const expected =
      contextual && typeof contextual !== 'string' && contextual.kind === 'callable'
        ? contextual
        : undefined;
    const local = new Map(scope);
    for (const parameter of node.parameters)
      local.set(identifier(parameter.name), { type: 'unknown' });
    for (let pass = 0; pass <= node.parameters.length; pass++)
      node.parameters.forEach((parameter, index) => {
        const contextual = expected?.parameters[index]?.type;
        const type = parameter.type
          ? parseSourceValueType(module, parameter.type, this.substitutions)
          : contextual !== undefined && contextual !== 'unknown'
            ? contextual
            : parameter.initializer
              ? this.previewExpression(module, parameter.initializer, local)
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
      };
    });
    let returnType = node.type
      ? parseSourceValueType(module, node.type, this.substitutions)
      : expected?.returnType;
    if (returnType === undefined) {
      if (node.body && !ts.isBlock(node.body))
        returnType = this.previewExpression(module, node.body, local);
      else {
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
    }
  }

  private predeclare(
    module: SourceModule,
    nodes: readonly ts.Statement[],
    scope: Scope,
    forbidden: ReadonlySet<string> = new Set()
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
      const annotation = ts.isVariableDeclaration(declaration) ? declaration.type : undefined;
      const type = annotation
        ? parseSourceValueType(module, annotation, this.substitutions)
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
        bindingId: `${module.file.fileName}#${declaration.pos}`,
      });
    }
    // All declarations exist before resolving closure bodies; later lexical values are not read here.
    for (const declaration of declarations) {
      const binding = scope.get(identifier(declaration.name!))!,
        init = ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
      if (init && isSourceFunction(init))
        binding.type = this.previewFunction(module, init, scope, binding.type);
    }
  }

  constructor(
    input: string,
    readonly options: ParseOptions,
    private readonly writtenFields: ReadonlySet<string> = new Set(),
    private readonly captureTypes: ReadonlyMap<string, import('./ir').HookCaptureIR> = new Map()
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

  private parameterType(
    module: SourceModule,
    parameter: ts.ParameterDeclaration,
    expected?: ValueType,
    body?: ts.ConciseBody,
    outer: Scope = new Map()
  ): ValueType {
    if (parameter.type) {
      const identity = sourceTypeIdentity(module, parameter.type);
      if (identity?.module === '@proto.ui/core') {
        if (identity.name === 'FocusRequestOptions') return FOCUS_OPTIONS_TYPE;
        if (identity.name === 'FocusScopeActivationOptions') return FOCUS_ACTIVATION_OPTIONS_TYPE;
        if (
          expected &&
          typeof expected === 'string' &&
          CAPABILITY_ANNOTATIONS[expected] === identity.name
        )
          return expected;
      }
      return parseSourceValueType(module, parameter.type, this.substitutions);
    }
    if (expected !== undefined && expected !== 'unknown') return expected;
    if (parameter.initializer)
      return this.expression(module, parameter.initializer, outer, 'callback').type;
    const constraint = this.parameterConstraint(parameter, body, outer);
    if (constraint) return constraint.type;
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
    renderReturn = context === 'setup'
  ): FunctionIR {
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
      ? parseSourceValueType(module, node.type, this.substitutions)
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
        if (parameter.dotDotDotToken)
          rejectNode(parameter, 'PUI1004', 'Rest callback parameters are unsupported.');
        const name = identifier(parameter.name);
        if (names.has(name)) rejectNode(parameter, 'PUI1005', `Duplicate parameter ${name}.`);
        names.add(name);
        const type = this.parameterType(module, parameter, expected[index], node.body, scope);
        const fallback = parameter.initializer
          ? this.expression(module, parameter.initializer, scope, phase, undefined, type)
          : undefined;
        if (
          fallback &&
          !assignable(fallback.type, type) &&
          !assignable(argumentData(fallback) ?? fallback.type, type)
        )
          rejectNode(parameter, 'PUI1006', 'Parameter default does not satisfy its type.');
        const optional =
          !!parameter.questionToken ||
          !!parameter.initializer ||
          (!parameter.type && !!this.parameterConstraint(parameter, node.body, outer)?.optional);
        scope.set(name, {
          type: optional && !fallback ? union([type, 'void'], parameter) : type,
          bindingId: `${module.file.fileName}#${parameter.pos}`,
        });
        return {
          name,
          type,
          bindingId: `${module.file.fileName}#${parameter.pos}`,
          ...(optional ? { optional: true } : {}),
          ...(fallback ? { default: fallback } : {}),
        };
      });
      if (
        context === 'setup' &&
        (parameters.length > 1 || (parameters.length === 1 && parameters[0].type !== 'def'))
      )
        rejectNode(node, 'PUI1006', 'Setup accepts at most one definition handle parameter.');
      const body = ts.isBlock(node.body)
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
    this.predeclare(module, nodes, scope, forbidden);
    for (const node of nodes) {
      const span = sourceSpan(node);
      if (ts.isVariableStatement(node)) {
        const mutable = !!(node.declarationList.flags & ts.NodeFlags.Let);
        if (!(node.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)))
          rejectNode(node, 'PUI1004', 'Use block-scoped const or let bindings.');
        for (const declaration of node.declarationList.declarations) {
          const name = identifier(declaration.name);
          const pending = scope.get(name)!;
          if (!declaration.initializer)
            rejectNode(declaration, 'PUI1004', 'Binding requires a value.');
          const init = declaration.initializer;
          let value: ExpressionIR;
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            this.resolvePending(pending);
            value = pending.parsed!;
          } else {
            const expected = declaration.type
              ? parseSourceValueType(module, declaration.type, this.substitutions)
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
                : stateValue(value.type) && value.kind === 'member'
                  ? `#observed:${value.span.file}:${value.span.start}`
                  : alias?.stateId;
            Object.assign(pending, {
              type: value.type,
              ...(alias?.helper ? { helper: alias.helper, phase: alias.phase } : {}),
              stateId,
              stateData: stateDeclarationData(value) ?? alias?.stateData,
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
            const type = declaration.type
              ? parseSourceValueType(module, declaration.type, this.substitutions)
              : value.type;
            if (
              !assignable(value.type, type) &&
              !assignable(argumentData(value) ?? value.type, type)
            )
              rejectNode(declaration, 'PUI1006', 'Lexical initializer does not satisfy its type.');
            const cellType: ValueType =
              type === 'boolean' || type === 'number' || type === 'string'
                ? `lexical:${type}`
                : { kind: 'cell', value: type };
            Object.assign(pending, { type: cellType, lexical: type });
            value = {
              kind: 'lexical-cell',
              value,
              type: cellType,
              span: sourceSpan(init),
            };
          }
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
        const binding = scope.get(node.name.text)!;
        this.resolvePending(binding);
        output.unshift({
          kind: 'const',
          name: binding.emittedName ?? node.name.text,
          bindingId: binding.bindingId,
          value: binding.parsed!,
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
        const branch = (truth: boolean): Scope => this.refinedScope(scope, condition, truth);
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
        const continuing = statementsTerminate(then)
          ? elseScope
          : statementsTerminate(otherwise)
            ? thenScope
            : undefined;
        if (continuing)
          for (const [name, binding] of scope) {
            const next = continuing.get(name)!;
            if (next.bindingId === binding.bindingId) scope.set(name, next);
          }
        else
          for (const [name, binding] of scope) {
            const a = thenScope.get(name)!,
              b = elseScope.get(name)!;
            if (binding.lexical)
              scope.set(name, {
                ...binding,
                lexical: joinValueTypes([
                  a.bindingId === binding.bindingId ? a.lexical! : binding.lexical,
                  b.bindingId === binding.bindingId ? b.lexical! : binding.lexical,
                ]),
              });
          }
      } else if (ts.isThrowStatement(node)) {
        const value = this.expression(module, node.expression, scope, phase);
        if (!isDataValueType(value.type) && value.type !== 'exception')
          rejectNode(
            node.expression,
            'PUI1006',
            'Thrown values must be admitted data or a caught exception.'
          );
        output.push({ kind: 'throw', value, span });
      } else if (ts.isTryStatement(node)) {
        const body = this.statements(module, node.tryBlock.statements, new Map(scope), phase);
        this.invalidateFlow(scope, true);
        let caught: Extract<StatementIR, { kind: 'try' }>['catch'];
        if (node.catchClause) {
          const catchScope = new Map(scope);
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
              type: 'function',
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
    const value = this.expressionValue(module, node, scope, phase, argumentRule, expectedType);
    if (value.kind === 'intrinsic' && value.name === 'array.every')
      this.invalidateFlow(scope, true);
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
      const constant =
        ts.isTypeReferenceNode(node.type) &&
        ts.isIdentifier(node.type.typeName) &&
        node.type.typeName.text === 'const';
      const asserted = constant
        ? undefined
        : parseSourceValueType(module, node.type, this.substitutions);
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
      if (asserted && canNarrowValue(value.type, asserted) && !sameType(value.type, asserted))
        return { kind: 'narrow', value, type: asserted, span: sourceSpan(node) };
      if (
        value.type !== 'exception' &&
        asserted &&
        !assignable(value.type, asserted) &&
        !assignable(argumentData(value) ?? value.type, asserted)
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
        parseSourceValueType(module, node.type, this.substitutions)
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
          valueAlternatives(value.type).filter((type) => type !== 'null' && type !== 'void')
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
        if (resolved.module && scalarInitializer(resolved.node as ts.Expression)) {
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
          return binding.lexical
            ? { kind: 'lexical-read', cell: reference, type: binding.lexical, span }
            : reference;
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
      const expected =
        expectedType && typeof expectedType !== 'string' && expectedType.kind === 'callable'
          ? expectedType
          : undefined;
      const fn = this.function(
        module,
        node,
        scope,
        this.helperPhase(module, node, scope),
        expected?.parameters.map((parameter) => parameter.type) ?? [],
        'helper',
        expected?.returnType === 'unknown' ? undefined : expected?.returnType
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
      const branch = (truth: boolean): Scope => this.refinedScope(scope, condition, truth);
      const then = this.expression(
          module,
          node.whenTrue,
          branch(true),
          phase,
          argumentRule,
          expectedType
        ),
        otherwise = this.expression(
          module,
          node.whenFalse,
          branch(false),
          phase,
          argumentRule,
          expectedType
        );
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
      const elements = node.elements.flatMap((element) => {
        if (!ts.isSpreadElement(element)) return [this.expression(module, element, scope, phase)];
        const spread = this.expression(module, element.expression, scope, phase);
        if (spread.kind !== 'array')
          rejectNode(element, 'PUI1004', 'Array spread currently requires a checked static array.');
        return spread.elements;
      });
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
      const parts: Extract<ExpressionIR, { kind: 'object-spread' }>['parts'] = [];
      const entries: { key: string; value: ExpressionIR }[] = [];
      const fields = new Map<
        string,
        { name: string; type: ValueType; optional?: boolean; readonly?: boolean }
      >();
      const entry = (
        property: ts.ObjectLiteralElementLike
      ): { key: string; value: ExpressionIR } => {
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isShorthandPropertyAssignment(property) &&
          !ts.isMethodDeclaration(property)
        )
          rejectNode(property, 'PUI1004', 'Object members require data or ordinary methods.');
        const key = propertyName(property.name);
        if (keys.has(key)) rejectNode(property, 'PUI1006', `Duplicate object key ${key}.`);
        keys.add(key);
        const expected = expectedType
          ? objectFields(expectedType)?.find((field) => field.name === key)?.type
          : undefined;
        if (ts.isMethodDeclaration(property)) {
          const signature =
            expected && typeof expected !== 'string' && expected.kind === 'callable'
              ? expected
              : undefined;
          const fn = this.function(
            module,
            property,
            scope,
            this.helperPhase(module, property, scope),
            signature?.parameters.map((parameter) => parameter.type) ?? [],
            'helper',
            signature?.returnType
          );
          return {
            key,
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
        return {
          key,
          value: this.expression(module, initializer, scope, phase, field, expected),
        };
      };
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          const value = this.expression(module, property.expression, scope, phase);
          const spread = objectFields(value.type);
          if (!spread)
            rejectNode(property, 'PUI1006', 'Object spread requires a checked ordinary record.');
          parts.push({ kind: 'spread', value });
          for (const { readonly: _readonly, ...field } of spread) fields.set(field.name, field);
        } else {
          const parsed = entry(property);
          entries.push(parsed);
          parts.push({ kind: 'entry', ...parsed });
          fields.set(parsed.key, { name: parsed.key, type: parsed.value.type });
        }
      }
      if (node.properties.some(ts.isSpreadAssignment))
        return { kind: 'object-spread', parts, type: objectValueType([...fields.values()]), span };
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
        let value = this.expression(module, node.right, scope, phase, undefined, type);
        if (operator !== '=') {
          const binary = operator.slice(0, -1);
          if (!['+', '-', '*', '/', '%', '&&', '||', '??'].includes(binary))
            rejectNode(node.operatorToken, 'PUI1004', 'Unsupported lexical assignment operator.');
          const left: ExpressionIR = {
            kind: 'lexical-read',
            cell,
            type,
            span: sourceSpan(node.left),
          };
          if (!isDataValueType(value.type))
            rejectNode(node.right, 'PUI1006', 'Lexical writes require data.');
          if (!isDataValueType(type))
            rejectNode(node, 'PUI1006', 'Compound writes require primitive data storage.');
          const result = this.checkedData(node, () =>
            inferBinaryType(binary, type as DataType, value.type as DataType)
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
              lexical: type,
              flowAt: this.flow.mark(entry[1].bindingId ?? entry[1].emittedName ?? entry[0]),
            });
          }
        }
        return { kind: 'lexical-write', cell, value, type, span };
      }
      const left = this.expression(module, node.left, scope, phase),
        right = this.expression(
          module,
          node.right,
          operator === '&&' || operator === '||'
            ? this.refinedScope(scope, left, operator === '&&')
            : scope,
          phase,
          undefined,
          operator === '??'
            ? joinValueTypes(
                valueAlternatives(left.type).filter((type) => type !== 'null' && type !== 'void')
              )
            : undefined
        );
      const capabilityType = capabilityBinaryType(operator, left.type, right.type);
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
      if (
        ts.isElementAccessExpression(node) &&
        !ts.isStringLiteral(node.argumentExpression) &&
        !ts.isNumericLiteral(node.argumentExpression)
      ) {
        const object = this.expression(module, node.expression, scope, phase),
          index = this.expression(module, node.argumentExpression, scope, phase);
        const optional = ts.isElementAccessChain(node);
        let type: ValueType;
        if (
          typeof object.type !== 'string' &&
          object.type.kind === 'array' &&
          index.type === 'number'
        )
          type = joinValueTypes([object.type.element, 'void']);
        else if (
          typeof object.type !== 'string' &&
          object.type.kind === 'object' &&
          object.type.index !== undefined &&
          index.type === 'string'
        )
          type = joinValueTypes([object.type.index, 'void']);
        else if (objectFields(object.type) && index.type === 'string')
          // Structural records may contain additional fields absent from this type view.
          type = 'unknown';
        else rejectNode(node, 'PUI1006', 'Dynamic index requires a checked array or record.');
        return { kind: 'element', object, index, optional, type, span };
      }
      const property = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : (node.argumentExpression as ts.StringLiteral | ts.NumericLiteral).text;
      const object = this.expression(module, node.expression, scope, phase);
      const optional = ts.isPropertyAccessChain(node) || ts.isElementAccessChain(node);
      const type = this.checkedValue(node, () => this.memberType(object.type, property, optional));
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

  private moduleValue(
    module: SourceModule,
    name: string,
    value: ts.Expression
  ): Binding & { name: string } {
    const id = `${module.file.fileName}#${name}`;
    const previous = this.moduleValues.get(id);
    if (previous) return previous;
    const initial = this.expression(module, value, new Map(), 'setup');
    if (initial.type !== 'boolean' && initial.type !== 'number' && initial.type !== 'string')
      rejectNode(value, 'PUI1006', 'Module initializer must be scalar data.');
    const annotation = ts.isVariableDeclaration(value.parent) ? value.parent.type : undefined;
    const stored = annotation
      ? parseSourceValueType(module, annotation, this.substitutions)
      : initial.type;
    if (!isDataValueType(stored))
      rejectNode(
        annotation ?? value,
        'PUI1006',
        'Shared module storage requires finite data; owner closures and capabilities cannot escape into module storage.'
      );
    if (!assignable(initial.type, stored))
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
      if (resolved.module && scalarInitializer(resolved.node as ts.Expression)) {
        const value = this.moduleValue(
          resolved.module,
          resolved.name,
          resolved.node as ts.Expression
        );
        binding = value;
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

  private ordinaryCall(
    module: SourceModule,
    node: ts.CallExpression,
    callee: ExpressionIR,
    scope: Scope,
    phase: Phase,
    known?: FunctionIR
  ): ExpressionIR {
    const optional = !!node.questionDotToken;
    let signature: ReturnType<typeof callableValue>;
    try {
      signature = callableValue(callee.type, optional);
    } catch (error) {
      rejectNode(node, 'PUI1006', (error as Error).message);
    }
    const args = node.arguments.map((argument, index) =>
      this.expression(module, argument, scope, phase, undefined, signature.parameters[index]?.type)
    );
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
              : (argumentData(argument) ?? argument.type)
        ),
        optional
      )
    );
    if (known && this.context !== 'helper' && this.context !== 'expose-method')
      this.enforceHelperContext(known, this.context, phase);
    if (
      functionCanMutateFlow(
        known ?? (callee.kind === 'function' ? callee.function : undefined),
        args
      )
    )
      this.invalidateFlow(scope, true);
    const value: ExpressionIR = {
      kind: 'call',
      callee,
      arguments: args,
      optional,
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

  private moduleHelper(
    module: SourceModule,
    name: string,
    node: FunctionNode,
    args: readonly ExpressionIR[],
    typeArguments: readonly ts.TypeNode[] | undefined
  ): { name: string; fn: FunctionIR } {
    const previous = this.substitutions,
      replacements = new Map<string, ValueType>();
    const parameters = node.typeParameters ?? [];
    parameters.forEach((parameter, index) => {
      if (typeArguments?.[index])
        replacements.set(
          parameter.name.text,
          parseSourceValueType(module, typeArguments[index], previous)
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
            ? parseSourceValueType(module, parameter.constraint, previous)
            : 'unknown'
        );
    });
    const id = `${module.file.fileName}#${name}${parameters.length ? JSON.stringify([...replacements]) : ''}`;
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
          args.map((arg) => arg.type),
          'helper'
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
    if (ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression,
        property = node.expression.name.text;
      if (
        ts.isIdentifier(owner) &&
        !scope.has(owner.text) &&
        !module.declarations.has(owner.text) &&
        !module.imports.has(owner.text)
      ) {
        const name =
          owner.text === 'Number' && property === 'isFinite'
            ? 'number.isFinite'
            : owner.text === 'Object' && property === 'freeze'
              ? 'object.freeze'
              : owner.text === 'Object' && property === 'hasOwn'
                ? 'object.hasOwn'
                : undefined;
        if (name) {
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
                args.map((arg) => arg.type)
              )
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
        if (
          ['style-disposer', 'subscription-disposer', 'binding-disposer'].includes(
            String(binding.type)
          )
        ) {
          const release: SemanticOperation =
            binding.type === 'style-disposer'
              ? 'feedback.style.release'
              : binding.type === 'subscription-disposer'
                ? 'subscription.release'
                : 'binding.release';
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
      if (!module.imports.has(name) && !module.declarations.has(name))
        rejectNode(node, 'PUI1004', `Unadmitted call ${name}.`);
      const resolved = this.graph.resolveBinding(module, name);
      if (resolved.module && isSourceFunction(resolved.node)) {
        const signature = resolved.node.typeParameters?.length
          ? undefined
          : this.previewFunction(resolved.module, resolved.node, new Map());
        const args = node.arguments.map((argument, index) =>
          this.expression(
            module,
            argument,
            scope,
            phase,
            undefined,
            signature?.parameters[index]?.type
          )
        );
        const helper = this.moduleHelper(
          resolved.module,
          resolved.name,
          resolved.node,
          args,
          node.typeArguments
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
                  : (argumentData(argument) ?? argument.type)
            )
          )
        );
        if (this.context !== 'helper' && this.context !== 'expose-method')
          this.enforceHelperContext(helper.fn, this.context, phase);
        if (functionCanMutateFlow(helper.fn, args)) this.invalidateFlow(scope, true);
        return {
          kind: 'helper-call',
          name: helper.name,
          arguments: args,
          type: helper.fn.returnType,
          span,
        };
      }
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
        operation = admittedHookOperation(resolved.name);
      else if (
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
        const id = `${definition.module.file.fileName}#${resolved.name}`;
        if (this.activeHooks.has(id))
          rejectNode(node, 'PUI1008', 'Recursive authored-hook composition.');
        if (!this.hooks.has(id)) {
          this.activeHooks.add(id);
          const descriptor = this.graph.descriptor(definition.module, definition.node);
          this.addModuleDeclarations(descriptor.modules);
          const optionsNode =
            definition.node.typeArguments?.[3] ?? descriptor.setup.parameters[1]?.type;
          const optionsType =
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
          const setup = this.function(
            descriptor.setupModule,
            descriptor.setup,
            new Map(),
            'setup',
            factory === 'defineHook' ? ['def', optionsType!, HOOK_API_TYPE] : ['def'],
            factory === 'defineHook' ? 'helper' : 'setup',
            undefined,
            true
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
              'void'
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
          this.activeHooks.delete(id);
        }
        this.requirements.add('authored-hook');
        const hook = this.hooks.get(id)!;
        const args = node.arguments.map((argument) =>
          this.expression(module, argument, scope, phase, undefined, hook.optionsType)
        );
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
      if (ts.isIdentifier(root) && scope.has(root.text)) {
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
      declaredEvents: new Set(this.eventKinds.keys()),
      propNames: new Set(this.props.keys()),
      stateValueType: stateValue(receiver?.type),
      stateDataType:
        receiver?.kind === 'reference'
          ? [...scope.values()].find((binding) => (binding.emittedName ?? '') === receiver.name)
              ?.stateData
          : undefined,
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
        : receiverType;
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
          context
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
      } else
        args.push(
          this.expression(module, argument, scope, phase, operationArgumentRule(operation, index))
        );
      if (index === 0) {
        if (operation.startsWith('capture.'))
          bindings.captureKey = this.literalString(args[0], argument);
        bindings.contextValueType = this.contextType(args[0]);
        if (operation === 'event.on' || operation === 'event.onGlobal') {
          const type = this.literalString(args[0], argument);
          bindings.inputPayloadType = type.startsWith('host:') ? 'host-event' : 'event';
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
      const payload = args[1]?.type ?? 'void';
      if (
        !isDataValueType(payload) ||
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
        if (type === undefined)
          rejectNode(node, 'PUI1006', 'Only declared primitive props are currently admitted.');
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
    let value: PrototypeIR;
    const observedFootprints = new Set<string>();
    for (;;) {
      const key = JSON.stringify([[...fields].sort(), [...captures]]);
      if (observedFootprints.has(key))
        throw new Error('Member-write flow analysis did not reach a stable checked graph.');
      observedFootprints.add(key);
      value = new Frontend(source, options, fields, captures).compile();
      const closedCaptures = derivePrototypeCaptures(value);
      const capturesStable = JSON.stringify([...captures]) === JSON.stringify([...closedCaptures]);
      for (const hook of value.hooks) hook.capture = closedCaptures.get(hook.id);
      const loweredFields = writtenMemberFields(value);
      if (
        capturesStable &&
        fields.size === loweredFields.size &&
        [...fields].every((field) => loweredFields.has(field))
      )
        break;
      fields = loweredFields;
      captures = closedCaptures;
    }
    const effect = callableEffectIssue(value);
    if (effect)
      throw new CompilerRejection({ code: 'PUI1007', category: 'unsupported-input', ...effect });
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
          message: `Unexpected frontend failure: ${error instanceof Error ? error.message : String(error)}`,
          span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
        },
      ],
    };
  }
}
