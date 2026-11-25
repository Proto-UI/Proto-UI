import ts from 'typescript';
import { diagnostic, type CompilerDiagnostic } from '../diagnostics';
import {
  spanOf,
  sanitizeSym,
  unwrapExpr,
  extractScalarLiteral,
  resolveAliasedSymbol,
  resolveCallName,
  findFactoryCall,
  resolveFunctionLike,
  propAccessChain,
  extractObjectProperty,
  extractSetupFunction,
  resolveDefinitionObject,
  isPrototypeType,
  isCoreIntrinsic,
  isKnownUndefined,
} from './syntax';
import { propKindToSsaType, stateKindToSsaType, internString } from './scalars';
import { parseRuleCondition } from './rules';
import { collectTwTokens, collectRuleStyleTokens, parseTemplateChild } from './template';
import {
  detectSimpleEventAction,
  lowerRuleToSsa,
  lowerCombinedRuleMask,
  lowerEventActionsToSsa,
  tryLowerPureScalarFunction,
} from './kernel';
import { lowerActionBody } from './actions';
import { evaluateStaticScalar } from './constants';
import {
  atExecutionPoint,
  hasBindingWrites,
  isBindingInitialized,
  isConstDeclaration,
  type InitializationPoints,
} from './bindings';
import {
  PROTO_IR_VERSION,
  computePrototypeCapabilities,
  type AuthoredHookSummary,
  type CompilationTier,
  type ContextUsageIR,
  type EventDeclIR,
  type ExposeDeclIR,
  type HookCallIR,
  type LifecycleHookName,
  type LifecycleDeclIR,
  type PropWatchDeclIR,
  type LoweringGapIR,
  type ModuleIR,
  type PropDeclIR,
  type PrototypeIR,
  type RenderIR,
  type RuleExpr,
  type RuleIR,
  type ScalarLiteral,
  type SsaFunction,
  type StateDeclIR,
} from '../ir';

const BUILTIN_HOOK_NAMES = new Set([
  'asTrigger',
  'asFocusable',
  'asFocusEntry',
  'asFocusScope',
  'asFocusRoving',
  'asAccessible',
  'asControlLabel',
  'asAnatomy',
  'asCollection',
  'asCollectionItem',
  'asOverlay',
  'asBoundary',
  'asHitParticipation',
  'asPositioning',
  'asScrollSurface',
  'asTextControl',
  'asImageView',
  'asTableStructure',
  'asNativeLink',
  'asAxisInput',
  'asPresence',
]);

const LIFECYCLE_METHODS = new Set<LifecycleHookName>([
  'onCreated',
  'onMounted',
  'onUpdated',
  'onUnmounted',
  'onBeforeDispose',
]);

export interface ExtractOptions {
  readonly exportName?: string;
  readonly checkTypes?: boolean;
}

export interface ExtractOutput {
  readonly ir: ModuleIR;
  readonly diagnostics: readonly CompilerDiagnostic[];
}

/**
 * Extract Proto SSA IR from a real TypeScript SourceFile using ts.Program + ts.TypeChecker.
 */
export function extractModuleIR(
  program: ts.Program,
  entryPath: string,
  options: ExtractOptions = {}
): ExtractOutput {
  const diagnostics: CompilerDiagnostic[] = [];
  // Program resolves relative names against its CompilerHost, including virtual browser files.
  const sf = program.getSourceFile(entryPath);
  if (!sf) {
    return {
      ir: {
        irVersion: PROTO_IR_VERSION,
        sourceFile: entryPath,
        prototypes: [],
        authoredHooks: [],
        functions: [],
      },
      diagnostics: [
        diagnostic(
          'PUI_FE001',
          'input',
          `Source file not found in TypeScript program: ${entryPath}`
        ),
      ],
    };
  }

  const checker = program.getTypeChecker();

  if (options.checkTypes !== false) {
    const tsDiags = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
    for (const d of tsDiags) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const sp =
        d.file && d.start !== undefined
          ? (() => {
              const lc = d.file.getLineAndCharacterOfPosition(d.start);
              return { file: d.file.fileName, line: lc.line + 1, column: lc.character + 1 };
            })()
          : undefined;
      diagnostics.push(diagnostic(`TS${d.code}`, 'typecheck', msg, sp));
    }
  }

  const prototypes: PrototypeIR[] = [];
  const authoredHooks: AuthoredHookSummary[] = [];
  const moduleFunctions: SsaFunction[] = [];

  // Extract pure scalar helper functions declared at module top level.
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const lowered = tryLowerPureScalarFunction(stmt, checker);
      if (lowered) moduleFunctions.push(lowered);
    }
  }

  const moduleSym = checker.getSymbolAtLocation(sf);
  const exportsList = moduleSym ? checker.getExportsOfModule(moduleSym) : [];
  const seenCalls = new Map<ts.CallExpression, number>();

  for (const expSym of exportsList) {
    const expName = expSym.getName();
    if (options.exportName && expName !== options.exportName) continue;

    const target = resolveAliasedSymbol(checker, expSym);
    const decl = target?.valueDeclaration ?? target?.declarations?.[0];
    if (!decl) continue;

    let initExpr: ts.Expression | undefined;
    if (ts.isExportAssignment(decl)) initExpr = decl.expression;
    else if (ts.isVariableDeclaration(decl) && decl.initializer) initExpr = decl.initializer;

    if (!initExpr) continue;
    const found = findFactoryCall(initExpr, checker, [
      'definePrototype',
      'defineAsHook',
      'defineHook',
    ]);
    if (!found) {
      const value = unwrapExpr(initExpr);
      if (isPrototypeType(value, checker)) {
        const partial: PrototypeIR = ts.isCallExpression(value)
          ? extractPrototype(value, expName, expName === 'default', sf.fileName, checker)
          : {
              name: expName,
              exportName: expName,
              isDefaultExport: expName === 'default',
              sourceFile: sf.fileName,
              span: spanOf(value, sf),
              tier: 'static',
              props: [],
              states: [],
              exposes: [],
              events: [],
              hooks: [],
              contexts: [],
              staticStyleTokens: [],
              rules: [],
              lifecycle: [],
              render: { kind: 'default-slot' },
              capabilities: [],
              capabilityMask: 0n,
              functions: [],
              stringTable: [],
            };
        prototypes.push({
          ...partial,
          unlowered: [
            ...(partial.unlowered ?? []),
            {
              operation: 'prototype-factory',
              message:
                'The prototype-producing call has no proven factory lowering; its declaration remains in coverage.',
              span: spanOf(value, sf),
            },
          ],
        });
      }
      continue;
    }

    if (found.factory === 'definePrototype') {
      const prior = seenCalls.get(found.call);
      if (prior !== undefined && !options.exportName) {
        if (expName === 'default')
          prototypes[prior] = { ...prototypes[prior], isDefaultExport: true };
        continue;
      }
      seenCalls.set(found.call, prototypes.length);
      const proto = extractPrototype(
        found.call,
        expName,
        expName === 'default',
        sf.fileName,
        checker
      );
      if (proto) prototypes.push(proto);
    } else {
      const hookSummary = extractAuthoredHookSummary(found.call, expName, found.factory, checker);
      if (hookSummary) authoredHooks.push(hookSummary);
    }
  }

  // Fallback: if no exported prototype matched and no explicit exportName was given, scan top-level statements.
  if (prototypes.length === 0 && authoredHooks.length === 0 && !options.exportName) {
    for (const stmt of sf.statements) {
      if (ts.isExportAssignment(stmt)) {
        const found = findFactoryCall(stmt.expression, checker, ['definePrototype']);
        if (found) {
          const proto = extractPrototype(found.call, 'default', true, sf.fileName, checker);
          if (proto) prototypes.push(proto);
        }
      }
    }
  }

  const moduleEffects = [
    ...collectModuleEffects(sf, checker),
    ...collectImportedModuleEffects(sf, checker),
  ];
  if (moduleEffects.length) {
    for (let index = 0; index < prototypes.length; index++)
      prototypes[index] = {
        ...prototypes[index],
        unlowered: [...moduleEffects, ...(prototypes[index].unlowered ?? [])],
      };
  }
  return {
    ir: {
      irVersion: PROTO_IR_VERSION,
      sourceFile: sf.fileName,
      prototypes,
      authoredHooks,
      functions: moduleFunctions,
    },
    diagnostics,
  };
}

/** Check initialization effects in authored source modules that would otherwise disappear. */
function collectModuleEffects(sf: ts.SourceFile, checker: ts.TypeChecker): LoweringGapIR[] {
  const activeInitializers = new Set<ts.Node>();
  const pureInitializer = (
    raw: ts.Expression,
    inheritedPoints: InitializationPoints = new Map()
  ): boolean => {
    const value = unwrapExpr(raw);
    const points = atExecutionPoint(value, inheritedPoints);
    if (
      evaluateStaticScalar(value, checker, new Map(), points) !== undefined ||
      ts.isArrowFunction(value) ||
      ts.isFunctionExpression(value)
    )
      return true;
    if (ts.isIdentifier(value)) {
      const binding = resolveAliasedSymbol(checker, checker.getSymbolAtLocation(value));
      const declaration = binding?.valueDeclaration ?? binding?.declarations?.[0];
      if (!binding || !declaration || !isBindingInitialized(declaration, points, checker))
        return false;
      if (ts.isFunctionDeclaration(declaration))
        return !!declaration.body && !hasBindingWrites(binding, checker);
      if (
        !ts.isVariableDeclaration(declaration) ||
        !isConstDeclaration(declaration) ||
        !declaration.initializer ||
        activeInitializers.has(declaration)
      )
        return false;
      activeInitializers.add(declaration);
      const result = pureInitializer(declaration.initializer, points);
      activeInitializers.delete(declaration);
      return result;
    }
    if (ts.isArrayLiteralExpression(value))
      return value.elements.every(
        (element) => !ts.isSpreadElement(element) && pureInitializer(element, points)
      );
    if (ts.isObjectLiteralExpression(value))
      return value.properties.every(
        (field) =>
          ((ts.isMethodDeclaration(field) ||
            ts.isGetAccessorDeclaration(field) ||
            ts.isSetAccessorDeclaration(field)) &&
            !ts.isComputedPropertyName(field.name)) ||
          (ts.isShorthandPropertyAssignment(field) && pureInitializer(field.name, points)) ||
          (ts.isPropertyAssignment(field) &&
            !ts.isComputedPropertyName(field.name) &&
            pureInitializer(field.initializer, points))
      );
    const intrinsic =
      ts.isCallExpression(value) || ts.isPropertyAccessExpression(value)
        ? resolveCallName(
            ts.isCallExpression(value) ? value.expression : value,
            checker,
            new Set(),
            points
          )
        : undefined;
    if (
      !intrinsic ||
      !isCoreIntrinsic(intrinsic) ||
      !['definePrototype', 'defineAsHook', 'defineHook'].includes(intrinsic.name)
    )
      return false;
    if (!ts.isCallExpression(value)) return true;
    if (
      value.arguments.length !== 1 ||
      !value.arguments.every((argument) => pureInitializer(argument, points))
    )
      return false;
    const definition = resolveDefinitionObject(value.arguments[0], checker, points);
    if (!definition) return false;
    const name = extractObjectProperty(definition, 'name');
    const nameValue = name && evaluateStaticScalar(name, checker, new Map(), points);
    if (
      typeof nameValue !== 'string' ||
      !nameValue ||
      !extractSetupFunction(definition, checker, points)
    )
      return false;
    // Factory validation runs at module initialization, even for an unused declaration.
    // Nonempty module lists and property accessors require their own validation/effect lowering.
    const modules = extractObjectProperty(definition, 'modules');
    if (
      modules &&
      (!ts.isArrayLiteralExpression(unwrapExpr(modules)) ||
        (unwrapExpr(modules) as ts.ArrayLiteralExpression).elements.length)
    )
      return false;
    return !definition.properties.some(
      (field) =>
        ts.isGetAccessorDeclaration(field) ||
        ts.isSetAccessorDeclaration(field) ||
        ts.isSpreadAssignment(field)
    );
  };
  return sf.statements
    .filter((statement) => {
      if (
        ts.canHaveModifiers(statement) &&
        ts
          .getModifiers(statement)
          ?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)
      )
        return false;
      if (ts.isExpressionStatement(statement)) return !ts.isStringLiteral(statement.expression);
      if (ts.isExportAssignment(statement)) return !pureInitializer(statement.expression);
      if (ts.isVariableStatement(statement))
        return statement.declarationList.declarations.some(
          (declaration) =>
            !ts.isIdentifier(declaration.name) ||
            (declaration.initializer && !pureInitializer(declaration.initializer))
        );
      if (ts.isImportDeclaration(statement)) return !statement.importClause;
      return !(
        ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isExportDeclaration(statement) ||
        ts.isEmptyStatement(statement)
      );
    })
    .map((statement) => ({
      operation: 'module-effect',
      message: 'Top-level executable effects require explicit module-initialization lowering.',
      span: spanOf(statement, sf),
    }));
}

function collectImportedModuleEffects(sf: ts.SourceFile, checker: ts.TypeChecker): LoweringGapIR[] {
  const checked = new Set<ts.SourceFile>([sf]);
  const issues: LoweringGapIR[] = [];
  const visit = (source: ts.SourceFile): void => {
    for (const statement of source.statements) {
      if (
        (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        (ts.isExportDeclaration(statement) && statement.isTypeOnly)
      )
        continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (
        ts.isImportDeclaration(statement) &&
        !statement.importClause?.name &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        statement.importClause.namedBindings.elements.every((element) => element.isTypeOnly)
      )
        continue;
      if (
        ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)
      )
        continue;
      const binding = checker.getSymbolAtLocation(statement.moduleSpecifier);
      const imported = binding?.declarations?.find(ts.isSourceFile);
      if (
        !imported ||
        checked.has(imported) ||
        imported.isDeclarationFile ||
        isCoreIntrinsic({ sourceFile: imported.fileName })
      )
        continue;
      checked.add(imported);
      issues.push(...collectModuleEffects(imported, checker));
      visit(imported);
    }
  };
  visit(sf);
  return issues;
}

function extractAuthoredHookSummary(
  call: ts.CallExpression,
  exportName: string,
  factory: string,
  checker: ts.TypeChecker
): AuthoredHookSummary | undefined {
  const arg = call.arguments[0] ? resolveDefinitionObject(call.arguments[0], checker) : undefined;
  if (!arg)
    return {
      name: exportName,
      exportName,
      kind: factory === 'defineAsHook' ? 'as-hook' : 'hook',
      sourceFile: call.getSourceFile().fileName,
      capabilities: [],
    };
  const nameExpr = extractObjectProperty(arg, 'name');
  const nameLit = nameExpr ? extractScalarLiteral(nameExpr, checker) : undefined;
  const name = typeof nameLit === 'string' ? nameLit : exportName;
  const setupFn = extractSetupFunction(arg, checker);
  const proto = setupFn
    ? analyzeSetup(setupFn, name, exportName, false, call.getSourceFile().fileName, call, checker)
    : undefined;
  return {
    name,
    exportName,
    kind: factory === 'defineAsHook' ? 'as-hook' : 'hook',
    sourceFile: call.getSourceFile().fileName,
    capabilities: proto?.capabilities ?? [],
  };
}

function extractPrototype(
  call: ts.CallExpression,
  exportName: string,
  isDefaultExport: boolean,
  entryFile: string,
  checker: ts.TypeChecker
): PrototypeIR {
  const arg = call.arguments[0] ? resolveDefinitionObject(call.arguments[0], checker) : undefined;
  const definitionGaps: LoweringGapIR[] = [];
  const definitionGap = (node: ts.Node, operation: string, message: string) =>
    definitionGaps.push({ operation, message, span: spanOf(node, node.getSourceFile()) });
  if (!arg)
    definitionGap(
      call,
      'prototype-options',
      'Definition options cannot be resolved without evaluating dynamic code; the declaration remains in coverage.'
    );
  if (call.arguments.length !== 1)
    definitionGap(call, 'prototype-options', 'Unexpected definition arguments require lowering.');
  for (const field of arg?.properties ?? []) {
    if (
      !('name' in field) ||
      !field.name ||
      (!ts.isIdentifier(field.name) && !ts.isStringLiteral(field.name)) ||
      !['name', 'setup'].includes(field.name.text)
    )
      definitionGap(
        field,
        'prototype-options',
        'Definition field requires explicit semantic lowering.'
      );
  }
  const nameExpr = arg ? extractObjectProperty(arg, 'name') : undefined;
  const nameLit = nameExpr ? extractScalarLiteral(nameExpr, checker) : undefined;
  const name = typeof nameLit === 'string' ? nameLit : exportName;
  if (typeof nameLit !== 'string' || !nameLit)
    definitionGap(
      nameExpr ?? call,
      'prototype-name',
      'Prototype name must be a non-empty proven static string.'
    );
  const setupFn = arg ? extractSetupFunction(arg, checker) : undefined;
  const setupField = arg?.properties.find(
    (field) =>
      'name' in field &&
      field.name &&
      (ts.isIdentifier(field.name) || ts.isStringLiteral(field.name)) &&
      field.name.text === 'setup'
  );
  if (!setupFn)
    definitionGap(
      setupField ?? call,
      'prototype-setup',
      'The required setup implementation could not be resolved.'
    );

  // Extract explicit generic type arguments from `definePrototype<Props, Exposes>(...)`.
  const propsTypeText = call.typeArguments?.[0]?.getText(call.getSourceFile());
  const exposesTypeText = call.typeArguments?.[1]?.getText(call.getSourceFile());

  if (!setupFn) {
    const base = {
      name,
      exportName,
      isDefaultExport,
      sourceFile: entryFile,
      span: spanOf(call, call.getSourceFile()),
      tier: 'static' as CompilationTier,
      propsTypeText,
      exposesTypeText,
      props: [],
      states: [],
      exposes: [],
      events: [],
      hooks: [],
      contexts: [],
      staticStyleTokens: [],
      rules: [],
      lifecycle: [],
      render: { kind: 'default-slot' } as RenderIR,
      functions: [],
      stringTable: [],
      unlowered: definitionGaps,
    };
    return { ...base, ...computePrototypeCapabilities(base) };
  }

  const result = analyzeSetup(
    setupFn,
    name,
    exportName,
    isDefaultExport,
    entryFile,
    call,
    checker,
    propsTypeText,
    exposesTypeText
  );
  return { ...result, unlowered: [...definitionGaps, ...(result.unlowered ?? [])] };
}

function analyzeSetup(
  setupFn: ts.FunctionLikeDeclaration,
  name: string,
  exportName: string,
  isDefaultExport: boolean,
  entryFile: string,
  originCall: ts.CallExpression,
  checker: ts.TypeChecker,
  propsTypeText?: string,
  exposesTypeText?: string
): PrototypeIR {
  const propsMap = new Map<string, PropDeclIR>();
  const states: StateDeclIR[] = [];
  const stateVarToName = new Map<ts.Symbol, string>();
  const exposes: ExposeDeclIR[] = [];
  const events: EventDeclIR[] = [];
  const hooks: HookCallIR[] = [];
  const contexts: ContextUsageIR[] = [];
  const staticStyleTokens: string[] = [];
  const rules: RuleIR[] = [];
  const lifecycle = new Set<LifecycleHookName>();
  const lifecycleHandlers: LifecycleDeclIR[] = [];
  const propWatches: PropWatchDeclIR[] = [];
  const stringTable: string[] = [];
  const unlowered: LoweringGapIR[] = [];
  const gap = (node: ts.Node, operation: string, message: string): void => {
    unlowered.push({ operation, message, span: spanOf(node, node.getSourceFile()) });
  };
  const renderBox: { current: RenderIR } = { current: { kind: 'default-slot' } };

  const acceptsDefault = (declaration: PropDeclIR, value: ScalarLiteral): boolean => {
    if (value === null) return declaration.empty !== 'error';
    if (typeof value === 'number' && !Number.isFinite(value)) return false;
    if (declaration.kind === 'enum') {
      if (typeof value !== 'string' || !declaration.options?.includes(value)) return false;
    } else if (declaration.kind !== 'any' && typeof value !== declaration.kind) return false;
    return (
      !declaration.range ||
      (typeof value === 'number' &&
        (declaration.range.min === undefined || value >= declaration.range.min) &&
        (declaration.range.max === undefined || value <= declaration.range.max))
    );
  };

  const activeFns = new Set<ts.FunctionLikeDeclaration>();
  const hookResults = new Map<string, { render?: RenderIR; lowered: boolean }>();
  const hookBindings = new Map<ts.Symbol, { render?: RenderIR; lowered: boolean }>();

  const recordContextCall = (method: string, keyArg: ts.Expression | undefined) => {
    const mode: ContextUsageIR['mode'] =
      method === 'provide'
        ? 'provide'
        : method.includes('Subscribe') || method === 'subscribe'
          ? 'subscribe'
          : method.includes('Update') || method === 'update'
            ? 'update'
            : 'read';
    const keyName = keyArg ? keyArg.getText(keyArg.getSourceFile()) : 'unknown';
    contexts.push({ keyName, mode });
  };

  const scanRunCallback = (cb: ts.FunctionLikeDeclaration | undefined) => {
    if (!cb?.body) return;
    const p0 = cb.parameters[0];
    const runName = p0 && ts.isIdentifier(p0.name) ? p0.name.text : undefined;
    if (!runName) return;
    const scan = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const ch = propAccessChain(n.expression);
        if (ch && ch[0] === runName && ch[1] === 'context' && ch.length >= 3) {
          recordContextCall(ch.slice(2).join('.'), n.arguments[0]);
        }
      }
      ts.forEachChild(n, scan);
    };
    scan(cb.body);
  };

  const walkFunction = (
    fn: ts.FunctionLikeDeclaration,
    defParamName?: string,
    constants: ReadonlyMap<ts.Symbol, ScalarLiteral> = new Map(),
    discardedHelperReturn = false,
    initializationPoints: InitializationPoints = new Map()
  ): RenderIR | undefined => {
    const boundConstants = new Map(constants);
    const scalar = (
      expression: ts.Expression,
      points: InitializationPoints = initializationPoints
    ): ScalarLiteral | undefined =>
      evaluateStaticScalar(expression, checker, boundConstants, points);
    let functionRender: RenderIR | undefined;
    if (!fn.body) {
      gap(fn, 'setup', 'Setup implementation is not available.');
      return;
    }
    if (activeFns.has(fn)) {
      gap(
        fn,
        'setup-composition',
        'Recursive setup composition cannot be expanded into a finite declaration sequence.'
      );
      return;
    }
    activeFns.add(fn);

    const p0 = fn.parameters[0];
    const defName = defParamName ?? (p0 && ts.isIdentifier(p0.name) ? p0.name.text : undefined);
    const defBinding = fn.parameters.find(
      (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === defName
    );
    const defSymbol = defBinding && checker.getSymbolAtLocation(defBinding.name);
    const defAliases = new Set<ts.Symbol>(defSymbol ? [defSymbol] : []);
    for (const parameter of fn.parameters) {
      if (!ts.isIdentifier(parameter.name) || parameter.dotDotDotToken) {
        gap(
          parameter,
          'setup-binding',
          'Setup parameter destructuring and rest bindings require explicit lowering.'
        );
        continue;
      }
      const binding = checker.getSymbolAtLocation(parameter.name)!;
      if (binding === defSymbol || boundConstants.has(binding) || !parameter.initializer) continue;
      const initial = scalar(parameter.initializer);
      if (initial === undefined)
        gap(
          parameter.initializer,
          'setup-binding',
          'Default parameter effects and values require explicit lowering.'
        );
      else boundConstants.set(binding, initial);
    }
    const rootBinding = (expression: ts.Expression): ts.Symbol | undefined => {
      let root = unwrapExpr(expression);
      while (ts.isPropertyAccessExpression(root)) root = unwrapExpr(root.expression);
      return ts.isIdentifier(root) ? checker.getSymbolAtLocation(root) : undefined;
    };
    let returned = false;

    const captureReturn = (expression: ts.Expression, node: ts.Node): void => {
      const returnedValue = unwrapExpr(expression);
      if (
        ts.isPropertyAccessExpression(returnedValue) &&
        ts.isIdentifier(returnedValue.expression) &&
        returnedValue.name.text === 'render'
      ) {
        const result = hookBindings.get(checker.getSymbolAtLocation(returnedValue.expression)!);
        if (result) {
          functionRender = result.render;
          return;
        }
      }
      const returnPoints = atExecutionPoint(node, initializationPoints);
      const retFn = resolveFunctionLike(expression, checker, returnPoints);
      if (retFn && retFn.body) {
        if (
          retFn.parameters.length > 1 ||
          retFn.parameters.some(
            (parameter) => !ts.isIdentifier(parameter.name) || parameter.dotDotDotToken
          )
        ) {
          gap(
            retFn,
            'render',
            'Render parameter destructuring, rest and additional defaults require explicit binding semantics.'
          );
          return;
        }
        if (
          retFn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
          retFn.asteriskToken
        ) {
          gap(
            retFn,
            'render',
            'Asynchronous and generator render functions require separate execution semantics.'
          );
          return;
        }
        const rp = retFn.parameters[0];
        const renderParam = rp && ts.isIdentifier(rp.name) ? rp.name.text : 'r';
        const bodyExpr = !ts.isBlock(retFn.body)
          ? retFn.body
          : retFn.body.statements.length === 1 &&
              ts.isReturnStatement(retFn.body.statements[0]) &&
              retFn.body.statements[0].expression
            ? retFn.body.statements[0].expression
            : undefined;
        if (bodyExpr) {
          const parsed = parseTemplateChild(
            bodyExpr,
            renderParam,
            stateVarToName,
            checker,
            (expression) => scalar(expression, returnPoints),
            returnPoints
          );
          const only = parsed?.children.length === 1 ? parsed.children[0] : undefined;
          functionRender = !parsed
            ? { kind: 'dynamic' }
            : only?.kind === 'slot'
              ? { kind: 'default-slot' }
              : only?.kind === 'element'
                ? { kind: parsed.reactive ? 'reactive-tree' : 'static-tree', root: only.node }
                : { kind: 'fragment', children: parsed.children };
        } else {
          functionRender = { kind: 'dynamic' };
        }
      } else if (
        !isKnownUndefined(expression, checker) &&
        (!discardedHelperReturn || scalar(expression) === undefined)
      ) {
        gap(
          node,
          'setup-return',
          'A returned value requires explicit function or hook-result lowering.'
        );
      }
    };

    const visit = (node: ts.Node) => {
      // Preserve sequential completion, including returns nested in unconditional blocks.
      if (returned) return;
      if (node !== fn && ts.isFunctionLike(node)) return;
      if (ts.isBlock(node)) {
        for (const statement of node.statements) {
          if (returned) break;
          visit(statement);
        }
        return;
      }
      if (ts.isReturnStatement(node)) returned = true;
      if (ts.isVariableDeclaration(node) && !ts.isIdentifier(node.name)) {
        gap(
          node,
          'setup-binding',
          'Destructuring requires explicit binding and property-access lowering.'
        );
        return;
      }
      if (ts.isExpressionStatement(node) && !ts.isCallExpression(unwrapExpr(node.expression))) {
        gap(node, 'setup-effect', 'This setup effect has no semantic lowering.');
        return;
      }

      if (ts.isIfStatement(node)) {
        const condition = scalar(node.expression);
        if (condition === undefined)
          gap(
            node,
            'setup-control-flow',
            'Dynamic setup branches require conditional declaration semantics.'
          );
        else {
          const selected = condition ? node.thenStatement : node.elseStatement;
          if (selected) visit(selected);
        }
        return;
      }
      if (
        ts.isIterationStatement(node, false) ||
        ts.isSwitchStatement(node) ||
        ts.isTryStatement(node) ||
        ts.isThrowStatement(node)
      ) {
        gap(
          node,
          'setup-control-flow',
          'Dynamic setup control flow is retained as an unsupported operation; declarations are not hoisted out of branches.'
        );
        return;
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initial = unwrapExpr(node.initializer);
        if (ts.isIdentifier(initial) && defAliases.has(checker.getSymbolAtLocation(initial)!)) {
          defAliases.add(checker.getSymbolAtLocation(node.name)!);
          return;
        }
        if (ts.isIdentifier(initial) && stateVarToName.has(checker.getSymbolAtLocation(initial)!)) {
          stateVarToName.set(
            checker.getSymbolAtLocation(node.name)!,
            stateVarToName.get(checker.getSymbolAtLocation(initial)!)!
          );
          return;
        }
        if (
          !ts.isCallExpression(initial) &&
          !ts.isArrowFunction(initial) &&
          !ts.isFunctionExpression(initial) &&
          scalar(initial) === undefined
        ) {
          gap(node, 'setup-binding', 'The local binding initializer has no semantic lowering.');
          return;
        }
      }

      if (ts.isReturnStatement(node) && node.expression) {
        captureReturn(node.expression, node);
        return;
      }

      if (ts.isReturnStatement(node)) {
        if (node.expression && scalar(node.expression) === undefined)
          gap(node, 'setup-return', 'A helper return value requires explicit lowering.');
        return;
      }

      if (ts.isCallExpression(node)) {
        const callPoints = atExecutionPoint(node, initializationPoints);
        const chain = propAccessChain(node.expression);

        // 1. def.* operations
        if (chain && defAliases.has(rootBinding(node.expression)!)) {
          const sub = chain.slice(1).join('.');

          // def.props.define({...})
          if (sub === 'props.define' && node.arguments[0]) {
            if (node.arguments.length !== 1)
              gap(node, sub, 'Unexpected declaration arguments cannot be discarded.');
            const obj = unwrapExpr(node.arguments[0]);
            if (ts.isObjectLiteralExpression(obj)) {
              for (const p of obj.properties) {
                if (!ts.isPropertyAssignment(p)) {
                  gap(p, sub, 'Property declarations must be explicit named fields.');
                  continue;
                }
                const key =
                  ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : undefined;
                if (!key) {
                  gap(p, sub, 'Computed property names need explicit lowering.');
                  continue;
                }
                const spec = unwrapExpr(p.initializer);
                let kind: PropDeclIR['kind'] = 'any';
                let defaultValue: ScalarLiteral | undefined;
                let empty: PropDeclIR['empty'];
                let options: ScalarLiteral[] | undefined;
                let range: PropDeclIR['range'];

                if (ts.isObjectLiteralExpression(spec)) {
                  const typeExpr = extractObjectProperty(spec, 'type');
                  const typeLit = typeExpr ? scalar(typeExpr) : undefined;
                  if (
                    typeLit === 'boolean' ||
                    typeLit === 'number' ||
                    typeLit === 'string' ||
                    typeLit === 'enum' ||
                    typeLit === 'object' ||
                    typeLit === 'any'
                  ) {
                    kind = typeLit;
                  }
                  const defExpr = extractObjectProperty(spec, 'default');
                  if (defExpr) {
                    defaultValue = scalar(defExpr);
                    if (defaultValue === undefined)
                      gap(defExpr, sub, 'Property default is not a proven static scalar.');
                  }
                  const emptyExpr = extractObjectProperty(spec, 'empty');
                  const emptyLit = emptyExpr ? scalar(emptyExpr) : undefined;
                  if (emptyLit === 'accept' || emptyLit === 'fallback' || emptyLit === 'error') {
                    empty = emptyLit;
                  } else if (emptyExpr)
                    gap(emptyExpr, sub, 'Empty behavior must be statically known.');
                  const optExpr = extractObjectProperty(spec, 'options');
                  if (optExpr && ts.isArrayLiteralExpression(unwrapExpr(optExpr))) {
                    options = (unwrapExpr(optExpr) as ts.ArrayLiteralExpression).elements
                      .map((el) => scalar(el))
                      .filter((v): v is ScalarLiteral => v !== undefined);
                    if (
                      options.length !==
                      (unwrapExpr(optExpr) as ts.ArrayLiteralExpression).elements.length
                    )
                      gap(optExpr, sub, 'Every enum option must be a proven scalar.');
                  } else if (optExpr)
                    gap(optExpr, sub, 'Property options require an explicit scalar array.');
                  const rangeExpr = extractObjectProperty(spec, 'range');
                  if (rangeExpr && ts.isObjectLiteralExpression(unwrapExpr(rangeExpr))) {
                    const limits = unwrapExpr(rangeExpr) as ts.ObjectLiteralExpression;
                    if (
                      limits.properties.some(
                        (field) =>
                          !ts.isPropertyAssignment(field) ||
                          (!ts.isIdentifier(field.name) && !ts.isStringLiteral(field.name)) ||
                          !['min', 'max'].includes(field.name.text)
                      )
                    )
                      gap(rangeExpr, sub, 'Every range field must have explicit lowering.');
                    const minExpr = extractObjectProperty(limits, 'min');
                    const maxExpr = extractObjectProperty(limits, 'max');
                    const min = minExpr ? scalar(minExpr) : undefined;
                    const max = maxExpr ? scalar(maxExpr) : undefined;
                    if (
                      (minExpr && typeof min !== 'number') ||
                      (maxExpr && typeof max !== 'number')
                    )
                      gap(rangeExpr, sub, 'Property range bounds must be static numbers.');
                    range = {
                      ...(typeof min === 'number' ? { min } : {}),
                      ...(typeof max === 'number' ? { max } : {}),
                    };
                  } else if (rangeExpr)
                    gap(rangeExpr, sub, 'Property range must be statically available.');
                  for (const field of spec.properties) {
                    if (
                      !ts.isPropertyAssignment(field) ||
                      (!ts.isIdentifier(field.name) && !ts.isStringLiteral(field.name)) ||
                      !['type', 'default', 'empty', 'options', 'range'].includes(field.name.text)
                    ) {
                      gap(field, sub, 'Property configuration has no semantic lowering.');
                    }
                  }
                } else gap(spec, sub, 'Property specification must be statically available.');

                const tsType =
                  kind === 'enum' && options?.length
                    ? options.map((v) => JSON.stringify(v)).join(' | ')
                    : kind === 'object'
                      ? 'Record<string, unknown>'
                      : kind === 'any'
                        ? 'unknown'
                        : kind;

                if (!propsMap.has(key)) {
                  propsMap.set(key, {
                    index: propsMap.size,
                    name: key,
                    tsType,
                    kind,
                    ...(defaultValue !== undefined ? { defaultValue } : {}),
                    ...(options ? { options } : {}),
                    ...(empty ? { empty } : {}),
                    ...(range ? { range } : {}),
                    ssaType: propKindToSsaType(kind),
                  });
                } else
                  gap(p, sub, 'Repeated property definitions require declaration merge lowering.');
              }
            } else gap(obj, sub, 'Dynamic props declarations require explicit lowering.');
          }

          // def.props.setDefaults({...})
          else if (sub === 'props.setDefaults' && node.arguments[0]) {
            if (node.arguments.length !== 1)
              gap(node, sub, 'Unexpected default arguments cannot be discarded.');
            const obj = unwrapExpr(node.arguments[0]);
            if (ts.isObjectLiteralExpression(obj)) {
              for (const p of obj.properties) {
                if (!ts.isPropertyAssignment(p)) {
                  gap(p, sub, 'Defaults must be explicit named fields.');
                  continue;
                }
                const key =
                  ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : undefined;
                if (!key) {
                  gap(p, sub, 'Computed default names require lowering.');
                  continue;
                }
                const existing = propsMap.get(key);
                const val = scalar(p.initializer);
                if (existing && val !== undefined) {
                  if (typeof val === 'number' && !Number.isFinite(val)) {
                    gap(p, sub, 'Defaults must be JSON scalar values.');
                  } else if (acceptsDefault(existing, val)) {
                    // Invalid latest layers retain the preceding valid fallback.
                    propsMap.set(key, { ...existing, defaultValue: val });
                  }
                } else
                  gap(
                    p,
                    sub,
                    'Defaults must target a declared property and have a proven scalar value.'
                  );
              }
            } else gap(obj, sub, 'Dynamic defaults require explicit lowering.');
          }

          // def.state.{bool,string,enum,numberDiscrete,numberRange}(name, initial)
          else if (
            sub === 'state.bool' ||
            sub === 'state.string' ||
            sub === 'state.enum' ||
            sub === 'state.numberDiscrete' ||
            sub === 'state.numberRange'
          ) {
            if (node.arguments.length < 2 || node.arguments.length > 3)
              gap(node, sub, 'Unexpected state declaration arguments cannot be discarded.');
            const nameLit = node.arguments[0] ? scalar(node.arguments[0]) : undefined;
            const initLit = node.arguments[1] ? scalar(node.arguments[1]) : undefined;
            const kindMap: Record<string, StateDeclIR['kind']> = {
              'state.bool': 'bool',
              'state.string': 'string',
              'state.enum': 'enum',
              'state.numberDiscrete': 'number.discrete',
              'state.numberRange': 'number.range',
            };
            const kind = kindMap[sub];
            if (typeof nameLit !== 'string')
              gap(node, sub, 'State semantic must be a proven static string.');
            if (initLit === undefined)
              gap(node, sub, 'State initializer has no proven value or expression lowering.');
            if (typeof initLit === 'string') internString(stringTable, initLit);
            const stateName = typeof nameLit === 'string' ? nameLit : '';
            if (states.some((s) => s.name === stateName))
              gap(node, sub, 'Repeated state names require explicit identity resolution.');
            const stateSpec: {
              options?: ScalarLiteral[];
              min?: number;
              max?: number;
              step?: number;
              clamp?: boolean;
            } = {};
            const specArg = node.arguments[2] && unwrapExpr(node.arguments[2]);
            if (specArg) {
              if (ts.isObjectLiteralExpression(specArg)) {
                for (const field of specArg.properties) {
                  if (
                    !ts.isPropertyAssignment(field) ||
                    (!ts.isIdentifier(field.name) && !ts.isStringLiteral(field.name))
                  ) {
                    gap(field, sub, 'State specification must use explicit fields.');
                    continue;
                  }
                  const key = field.name.text;
                  const init = unwrapExpr(field.initializer);
                  if (key === 'options' && ts.isArrayLiteralExpression(init)) {
                    const values = init.elements.map((e) => scalar(e));
                    if (values.some((v) => v === undefined))
                      gap(field, sub, 'State options must be static scalar values.');
                    else stateSpec.options = values as ScalarLiteral[];
                  } else {
                    const v = scalar(init);
                    if (['min', 'max', 'step'].includes(key) && typeof v === 'number')
                      stateSpec[key as 'min' | 'max' | 'step'] = v;
                    else if (key === 'clamp' && typeof v === 'boolean') stateSpec.clamp = v;
                    else gap(field, sub, 'State specification field is not lowered.');
                  }
                }
              } else gap(specArg, sub, 'Dynamic state specifications are not lowered.');
            }
            let variableName: string | undefined;
            if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
              variableName = node.parent.name.text;
              stateVarToName.set(checker.getSymbolAtLocation(node.parent.name)!, stateName);
            }
            states.push({
              index: states.length,
              name: stateName,
              variableName,
              kind,
              ...(initLit !== undefined ? { initialValue: initLit } : {}),
              ...stateSpec,
              ssaType: stateKindToSsaType(kind),
            });
          }

          // def.expose.{state,event,method,value}
          else if (
            sub === 'expose.state' ||
            sub === 'expose.event' ||
            sub === 'expose.method' ||
            sub === 'expose.value'
          ) {
            const keyLit = node.arguments[0] ? scalar(node.arguments[0]) : undefined;
            if (typeof keyLit === 'string') {
              const kind = sub.slice('expose.'.length) as ExposeDeclIR['kind'];
              const valType = node.arguments[1]
                ? checker.typeToString(checker.getTypeAtLocation(node.arguments[1]))
                : 'void';
              exposes.push({ name: keyLit, kind, tsType: valType });
            }
          }

          // def.props.watch / def.props.watchAll / def.props.watchRaw
          else if (sub.startsWith('props.watch')) {
            if (node.arguments.length !== (sub === 'props.watch' ? 2 : 1))
              gap(node, sub, 'Unexpected watcher arguments cannot be discarded.');
            const cbArg = node.arguments[node.arguments.length - 1];
            const handler = cbArg ? resolveFunctionLike(cbArg, checker, callPoints) : undefined;
            scanRunCallback(handler);
            if (sub !== 'props.watch' && sub !== 'props.watchAll') {
              gap(
                node,
                sub,
                'Raw property subscriptions require a raw snapshot and metadata lowering.'
              );
            } else {
              let keys: string[] | null | undefined = sub === 'props.watchAll' ? null : undefined;
              const keysArg = node.arguments[0] && unwrapExpr(node.arguments[0]);
              if (sub === 'props.watch' && keysArg && ts.isArrayLiteralExpression(keysArg)) {
                const values = keysArg.elements.map((key) => scalar(key));
                if (values.every((key): key is string => typeof key === 'string')) keys = values;
              }
              const propParameters = new Map<string, 'current' | 'previous'>();
              if (handler?.parameters[1] && ts.isIdentifier(handler.parameters[1].name))
                propParameters.set(handler.parameters[1].name.text, 'current');
              if (handler?.parameters[2] && ts.isIdentifier(handler.parameters[2].name))
                propParameters.set(handler.parameters[2].name.text, 'previous');
              const lowered = handler
                ? lowerActionBody(handler, {
                    states: stateVarToName,
                    checker,
                    runParameter:
                      handler.parameters[0] && ts.isIdentifier(handler.parameters[0].name)
                        ? handler.parameters[0].name.text
                        : undefined,
                    propParameters,
                    constant: scalar,
                    initializationPoints: callPoints,
                  })
                : undefined;
              if (keys === undefined || keys?.some((key) => !propsMap.has(key)))
                gap(node, sub, 'A watcher must select static declared property keys.');
              else if (!lowered?.ok)
                gap(
                  lowered && !lowered.ok ? lowered.node : node,
                  sub,
                  lowered && !lowered.ok ? lowered.message : 'Watcher callback is unavailable.'
                );
              else propWatches.push({ keys, body: lowered.body });
            }
          }

          // def.event.on / def.event.onGlobal
          else if (sub === 'event.on' || sub === 'event.onGlobal') {
            if (node.arguments.length !== 2)
              gap(node, sub, 'Event options need explicit host lowering.');
            const evLit = node.arguments[0] ? scalar(node.arguments[0]) : undefined;
            if (typeof evLit === 'string') {
              const handler = node.arguments[1]
                ? resolveFunctionLike(node.arguments[1], checker, callPoints)
                : undefined;
              scanRunCallback(handler);
              const simpleAction = handler
                ? detectSimpleEventAction(handler, stateVarToName, checker)
                : undefined;
              const action = handler
                ? lowerActionBody(handler, {
                    states: stateVarToName,
                    checker,
                    runParameter:
                      handler.parameters[0] && ts.isIdentifier(handler.parameters[0].name)
                        ? handler.parameters[0].name.text
                        : undefined,
                    constant: scalar,
                    initializationPoints: callPoints,
                  })
                : undefined;
              if (!action?.ok)
                gap(
                  action && !action.ok ? action.node : node,
                  sub,
                  action && !action.ok ? action.message : 'Event callback body is unavailable.'
                );
              events.push({
                scope: sub === 'event.onGlobal' ? 'global' : 'root',
                eventName: evLit,
                ...(simpleAction ? { simpleAction } : {}),
                ...(action?.ok ? { body: action.body } : {}),
              });
            } else gap(node, sub, 'Event identity must be a static supported name.');
          }

          // def.lifecycle.*
          else if (sub.startsWith('lifecycle.')) {
            if (node.arguments.length !== 1)
              gap(node, sub, 'Unexpected lifecycle arguments cannot be discarded.');
            const method = sub.slice('lifecycle.'.length) as LifecycleHookName;
            if (LIFECYCLE_METHODS.has(method)) lifecycle.add(method);
            const cbArg = node.arguments[0];
            const handler = cbArg ? resolveFunctionLike(cbArg, checker, callPoints) : undefined;
            scanRunCallback(handler);
            const lowered = handler
              ? lowerActionBody(handler, {
                  states: stateVarToName,
                  checker,
                  runParameter:
                    handler.parameters[0] && ts.isIdentifier(handler.parameters[0].name)
                      ? handler.parameters[0].name.text
                      : undefined,
                  constant: scalar,
                  initializationPoints: callPoints,
                })
              : undefined;
            const phases: Record<LifecycleHookName, LifecycleDeclIR['phase']> = {
              onCreated: 'created',
              onMounted: 'mounted',
              onUpdated: 'updated',
              onUnmounted: 'unmounted',
              onBeforeDispose: 'before-dispose',
            };
            if (!LIFECYCLE_METHODS.has(method)) gap(node, sub, 'Lifecycle phase is unknown.');
            else if (!lowered?.ok)
              gap(
                lowered && !lowered.ok ? lowered.node : node,
                sub,
                lowered && !lowered.ok ? lowered.message : 'Lifecycle callback is unavailable.'
              );
            else lifecycleHandlers.push({ phase: phases[method], body: lowered.body });
          }

          // def.context.*
          else if (sub.startsWith('context.')) {
            const method = sub.slice('context.'.length);
            recordContextCall(method, node.arguments[0]);
            if (node.arguments[1])
              scanRunCallback(resolveFunctionLike(node.arguments[1], checker, callPoints));
          }

          // def.feedback.style.use(tw(...))
          else if (sub === 'feedback.style.use') {
            for (const a of node.arguments) {
              if (!collectTwTokens(a, checker, staticStyleTokens, scalar, callPoints))
                gap(
                  a,
                  sub,
                  'Style values must have explicit semantic lowering; dynamic expressions are not flattened.'
                );
            }
          }

          // def.rule({ when: (w) => ..., intent: (i) => ... })
          else if (sub === 'rule' && node.arguments[0]) {
            if (node.arguments.length !== 1)
              gap(node, sub, 'Unexpected rule arguments cannot be discarded.');
            const obj = unwrapExpr(node.arguments[0]);
            if (ts.isObjectLiteralExpression(obj)) {
              const whenExpr = extractObjectProperty(obj, 'when');
              const intentExpr = extractObjectProperty(obj, 'intent');
              const styleTokens: string[] = [];
              if (
                !intentExpr ||
                !collectRuleStyleTokens(
                  intentExpr,
                  checker,
                  styleTokens,
                  (expression) => scalar(expression, callPoints),
                  callPoints
                )
              ) {
                gap(
                  intentExpr ?? obj,
                  sub,
                  'The rule intent must lower every operation and effect.'
                );
              }
              for (const field of obj.properties) {
                if (
                  !ts.isPropertyAssignment(field) ||
                  (!ts.isIdentifier(field.name) && !ts.isStringLiteral(field.name)) ||
                  !['when', 'intent'].includes(field.name.text)
                )
                  gap(field, sub, 'Rule configuration has no semantic lowering.');
              }
              let condition: RuleExpr = { kind: 'true' };
              let dynamic = false;
              if (whenExpr) {
                const whenFn = resolveFunctionLike(whenExpr, checker, callPoints);
                if (
                  whenFn &&
                  whenFn.body &&
                  !whenFn.asteriskToken &&
                  !whenFn.modifiers?.some(
                    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
                  ) &&
                  whenFn.parameters.length <= 1 &&
                  whenFn.parameters.every(
                    (parameter) =>
                      ts.isIdentifier(parameter.name) &&
                      !parameter.initializer &&
                      !parameter.dotDotDotToken
                  )
                ) {
                  const wp = whenFn.parameters[0];
                  const wName = wp && ts.isIdentifier(wp.name) ? wp.name.text : 'w';
                  const bodyExpr = !ts.isBlock(whenFn.body)
                    ? whenFn.body
                    : whenFn.body.statements.length === 1 &&
                        ts.isReturnStatement(whenFn.body.statements[0]) &&
                        whenFn.body.statements[0].expression
                      ? whenFn.body.statements[0].expression
                      : undefined;
                  const parsed = bodyExpr
                    ? parseRuleCondition(bodyExpr, wName, stateVarToName, checker, (expression) =>
                        scalar(expression, callPoints)
                      )
                    : undefined;
                  if (parsed) condition = parsed;
                  else dynamic = true;
                } else {
                  dynamic = true;
                }
              }
              rules.push({
                id: rules.length,
                condition,
                styleTokens,
                ...(dynamic ? { dynamic: true } : {}),
              });
            } else gap(obj, sub, 'Rule declaration must be statically available.');
          } else {
            gap(node, sub, 'This Proto operation has no semantic lowering.');
          }
          return;
        }

        // Resolve hook identity through canonical factory bindings, independent of its spelling.
        const resolved = resolveCallName(node.expression, checker, new Set(), callPoints);
        const hookFactory = findFactoryCall(
          node.expression,
          checker,
          ['defineAsHook', 'defineHook'],
          new Set(),
          callPoints
        );
        if (hookFactory) {
          const gapStart = unlowered.length;
          const hookArg = hookFactory.call.arguments[0]
            ? resolveDefinitionObject(hookFactory.call.arguments[0], checker, callPoints)
            : undefined;
          const nameExpression = hookArg && extractObjectProperty(hookArg, 'name');
          const hookName = nameExpression && scalar(nameExpression);
          const nestedSetup = hookArg && extractSetupFunction(hookArg, checker, callPoints);
          if (
            hookFactory.call.arguments.length !== 1 ||
            !hookArg ||
            typeof hookName !== 'string' ||
            !nestedSetup
          ) {
            gap(
              node,
              'hook-composition',
              'Hook identity and setup must resolve to a canonical authored definition.'
            );
            hooks.push({ name: resolved?.name ?? 'unknown', kind: 'authored' });
            return;
          }
          for (const field of hookArg.properties) {
            if (
              ts.isGetAccessorDeclaration(field) ||
              ts.isSetAccessorDeclaration(field) ||
              ts.isSpreadAssignment(field)
            ) {
              gap(
                field,
                'hook-composition',
                'Hook definition accessors and spreads require explicit effect lowering.'
              );
              continue;
            }
            const key =
              'name' in field &&
              field.name &&
              (ts.isIdentifier(field.name) || ts.isStringLiteral(field.name))
                ? field.name.text
                : undefined;
            if (key === 'name' || key === 'setup' || key === 'mode') continue;
            const modules =
              key === 'modules' ? extractObjectProperty(hookArg, 'modules') : undefined;
            if (
              modules &&
              ts.isArrayLiteralExpression(unwrapExpr(modules)) &&
              (unwrapExpr(modules) as ts.ArrayLiteralExpression).elements.length === 0
            )
              continue;
            gap(
              field,
              'hook-composition',
              'Hook configuration, projected handles and module declarations require explicit lowering.'
            );
          }
          const modeExpression = extractObjectProperty(hookArg, 'mode');
          if (modeExpression && scalar(modeExpression) !== 'once')
            gap(
              modeExpression,
              'hook-composition',
              'Configurable and multiple hooks require their own registration semantics.'
            );
          if (node.arguments.length > (hookFactory.factory === 'defineAsHook' ? 0 : 1))
            gap(node, 'hook-composition', 'Unexpected hook arguments cannot be omitted.');
          const childConstants = new Map(boundConstants);
          for (const argument of node.arguments)
            if (scalar(argument) === undefined)
              gap(
                argument,
                'hook-composition',
                'Hook options require proven static argument binding.'
              );
          const optionsParameter = nestedSetup.parameters[1];
          if (hookFactory.factory === 'defineHook' && optionsParameter) {
            const argument = node.arguments[0] ?? optionsParameter.initializer;
            const value = argument && scalar(argument);
            if (argument && value !== undefined && ts.isIdentifier(optionsParameter.name))
              childConstants.set(checker.getSymbolAtLocation(optionsParameter.name)!, value);
          }
          let result = hookResults.get(hookName);
          if (!result) {
            // Register once before expansion, matching the canonical setup registration order.
            result = { lowered: false };
            hookResults.set(hookName, result);
            result.render = walkFunction(nestedSetup, undefined, childConstants, false, callPoints);
            result.lowered = unlowered.length === gapStart;
          }
          const lowered = result.lowered && unlowered.length === gapStart;
          hooks.push({
            name: resolved?.name ?? hookName,
            moduleSpecifier: resolved?.sourceFile,
            kind: 'authored',
            lowered,
          });
          if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
            hookBindings.set(checker.getSymbolAtLocation(node.parent.name)!, result);
        } else if (resolved && BUILTIN_HOOK_NAMES.has(resolved.name)) {
          hooks.push({
            name: resolved.name,
            moduleSpecifier: resolved.sourceFile,
            kind: 'builtin',
          });
        } else if (
          defName &&
          node.arguments.some(
            (argument) =>
              ts.isIdentifier(unwrapExpr(argument)) &&
              defAliases.has(checker.getSymbolAtLocation(unwrapExpr(argument))!)
          )
        ) {
          const helperFn = resolveFunctionLike(node.expression, checker, callPoints);
          if (!helperFn) {
            gap(node, 'setup-composition', 'Setup helper implementation could not be resolved.');
            return;
          }
          const defArgIdx = node.arguments.findIndex(
            (argument) =>
              ts.isIdentifier(unwrapExpr(argument)) &&
              defAliases.has(checker.getSymbolAtLocation(unwrapExpr(argument))!)
          );
          const targetParam = helperFn.parameters[defArgIdx];
          if (
            !targetParam ||
            !ts.isIdentifier(targetParam.name) ||
            node.arguments.length > helperFn.parameters.length ||
            helperFn.parameters.some(
              (parameter) => !ts.isIdentifier(parameter.name) || parameter.dotDotDotToken
            )
          ) {
            gap(
              node,
              'setup-composition',
              'Setup helper parameters require explicit scalar and definition-handle bindings.'
            );
            return;
          }
          const childConstants = new Map(boundConstants);
          let bound = true;
          for (let index = 0; index < helperFn.parameters.length; index++) {
            if (index === defArgIdx) continue;
            const parameter = helperFn.parameters[index];
            const argument = node.arguments[index] ?? parameter.initializer;
            const value =
              argument && evaluateStaticScalar(argument, checker, childConstants, callPoints);
            if (argument && value !== undefined)
              childConstants.set(checker.getSymbolAtLocation(parameter.name)!, value);
            else if (argument) {
              gap(
                argument,
                'setup-composition',
                'A helper argument requires a proven static value before declaration expansion.'
              );
              bound = false;
            }
          }
          if (bound)
            walkFunction(helperFn, targetParam.name.text, childConstants, true, callPoints);
        } else if (scalar(node) === undefined) {
          gap(node, resolved?.name ?? 'call', 'Setup call has no lowering and cannot be omitted.');
        }
        return;
      }

      ts.forEachChild(node, visit);
    };

    try {
      if (
        fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
        fn.asteriskToken
      )
        gap(
          fn,
          'setup',
          'Asynchronous and generator setup bodies require separate execution semantics.'
        );
      else if (ts.isBlock(fn.body)) visit(fn.body);
      else captureReturn(fn.body, fn);
      return functionRender;
    } finally {
      activeFns.delete(fn);
    }
  };

  renderBox.current = walkFunction(setupFn) ?? { kind: 'default-slot' };

  const props = [...propsMap.values()];
  const protoSym = sanitizeSym(name);

  // Lower rules & simple event actions into real executable SSA functions!
  const functions: SsaFunction[] = [];
  for (const rule of rules) {
    const needsHostMeta = (condition: RuleExpr): boolean =>
      condition.kind === 'cmp'
        ? condition.source === 'meta'
        : condition.kind === 'not'
          ? needsHostMeta(condition.expr)
          : condition.kind === 'all' || condition.kind === 'any'
            ? condition.exprs.some(needsHostMeta)
            : false;
    if (needsHostMeta(rule.condition))
      gap(
        originCall,
        'rule.meta',
        'Host meta must be an explicit kernel input; it cannot be replaced with false.'
      );
    if (!rule.dynamic && !needsHostMeta(rule.condition)) {
      functions.push(lowerRuleToSsa(protoSym, rule, props, states, stringTable));
    }
  }
  const compiledRules = rules.filter((r) =>
    functions.some((f) => f.name === `${protoSym}_rule_${r.id}`)
  );
  if (compiledRules.length > 0) {
    functions.push(lowerCombinedRuleMask(protoSym, compiledRules));
  }
  functions.push(...lowerEventActionsToSsa(protoSym, events, states, stringTable));

  const render = renderBox.current;
  const tier: CompilationTier =
    props.length ||
    states.length ||
    events.length ||
    lifecycle.size ||
    propWatches.length ||
    rules.length
      ? 'reactive'
      : 'static';

  const partial = {
    name,
    exportName,
    isDefaultExport,
    sourceFile: entryFile,
    span: spanOf(originCall, originCall.getSourceFile()),
    tier,
    propsTypeText,
    exposesTypeText,
    props,
    states,
    exposes,
    events,
    hooks,
    contexts,
    staticStyleTokens,
    rules,
    lifecycle: [...lifecycle],
    lifecycleHandlers,
    propWatches,
    render,
    functions,
    stringTable,
    unlowered,
  };

  return {
    ...partial,
    ...computePrototypeCapabilities(partial),
  };
}
