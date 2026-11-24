import path from 'node:path';
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
} from './syntax';
import { propKindToSsaType, stateKindToSsaType, internString } from './scalars';
import { parseRuleCondition } from './rules';
import { collectTwTokens, collectRuleStyleTokens, parseTemplateElement } from './template';
import {
  detectSimpleEventAction,
  lowerRuleToSsa,
  lowerCombinedRuleMask,
  lowerEventActionsToSsa,
  tryLowerPureScalarFunction,
} from './kernel';
import { lowerActionBody } from './actions';
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
  const sf = program.getSourceFile(path.resolve(entryPath));
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
  const seenCalls = new Set<ts.CallExpression>();

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
      if (seenCalls.has(found.call) && !options.exportName) continue;
      seenCalls.add(found.call);
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

  const pureInitializer = (raw: ts.Expression): boolean => {
    const value = unwrapExpr(raw);
    if (
      extractScalarLiteral(value, checker) !== undefined ||
      ts.isIdentifier(value) ||
      ts.isArrowFunction(value) ||
      ts.isFunctionExpression(value)
    )
      return true;
    if (ts.isArrayLiteralExpression(value))
      return value.elements.every(
        (element) => !ts.isSpreadElement(element) && pureInitializer(element)
      );
    if (ts.isObjectLiteralExpression(value))
      return value.properties.every(
        (field) =>
          ((ts.isMethodDeclaration(field) ||
            ts.isGetAccessorDeclaration(field) ||
            ts.isSetAccessorDeclaration(field)) &&
            !ts.isComputedPropertyName(field.name)) ||
          ts.isShorthandPropertyAssignment(field) ||
          (ts.isPropertyAssignment(field) &&
            !ts.isComputedPropertyName(field.name) &&
            pureInitializer(field.initializer))
      );
    const intrinsic =
      ts.isCallExpression(value) || ts.isPropertyAccessExpression(value)
        ? resolveCallName(ts.isCallExpression(value) ? value.expression : value, checker)
        : undefined;
    return (
      !!intrinsic &&
      isCoreIntrinsic(intrinsic) &&
      ['definePrototype', 'defineAsHook', 'defineHook'].includes(intrinsic.name) &&
      (!ts.isCallExpression(value) || value.arguments.every(pureInitializer))
    );
  };
  const moduleEffects: LoweringGapIR[] = sf.statements
    .filter(
      (statement) =>
        (ts.isExpressionStatement(statement) && !ts.isStringLiteral(statement.expression)) ||
        ts.isIfStatement(statement) ||
        ts.isIterationStatement(statement, false) ||
        ts.isTryStatement(statement) ||
        ts.isThrowStatement(statement) ||
        (ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) =>
              !ts.isIdentifier(declaration.name) ||
              (declaration.initializer && !pureInitializer(declaration.initializer))
          )) ||
        (ts.isImportDeclaration(statement) && !statement.importClause)
    )
    .map((statement) => ({
      operation: 'module-effect',
      message: 'Top-level executable effects require explicit module-initialization lowering.',
      span: spanOf(statement, sf),
    }));
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

  const visitedFns = new Set<ts.FunctionLikeDeclaration>();

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

  const walkFunction = (fn: ts.FunctionLikeDeclaration, defParamName?: string) => {
    if (!fn.body) {
      gap(fn, 'setup', 'Setup implementation is not available.');
      return;
    }
    if (visitedFns.has(fn)) {
      gap(
        fn,
        'setup-composition',
        'Repeated or recursive setup composition requires instance-sensitive expansion.'
      );
      return;
    }
    visitedFns.add(fn);

    const p0 = fn.parameters[0];
    const defName = defParamName ?? (p0 && ts.isIdentifier(p0.name) ? p0.name.text : undefined);
    const defBinding = fn.parameters.find(
      (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === defName
    );
    const defSymbol = defBinding && checker.getSymbolAtLocation(defBinding.name);
    const defAliases = new Set<ts.Symbol>(defSymbol ? [defSymbol] : []);
    const rootBinding = (expression: ts.Expression): ts.Symbol | undefined => {
      let root = unwrapExpr(expression);
      while (ts.isPropertyAccessExpression(root)) root = unwrapExpr(root.expression);
      return ts.isIdentifier(root) ? checker.getSymbolAtLocation(root) : undefined;
    };
    let returned = false;

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

      if (
        ts.isIfStatement(node) ||
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
          extractScalarLiteral(initial, checker) === undefined
        ) {
          gap(node, 'setup-binding', 'The local binding initializer has no semantic lowering.');
          return;
        }
      }

      // Capture return statement in top-level setup as RenderIR.
      if (fn === setupFn && ts.isReturnStatement(node) && node.expression) {
        const retFn = resolveFunctionLike(node.expression, checker);
        if (retFn && retFn.body) {
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
            const u = unwrapExpr(bodyExpr);
            if (ts.isCallExpression(u)) {
              const chain = propAccessChain(u.expression);
              if (
                chain &&
                chain.length === 2 &&
                chain[0] === renderParam &&
                chain[1] === 'slot' &&
                u.arguments.length === 0
              ) {
                renderBox.current = { kind: 'default-slot' };
              } else if (
                chain &&
                chain.length === 2 &&
                chain[0] === renderParam &&
                chain[1] === 'el'
              ) {
                const parsed = parseTemplateElement(u, renderParam, stateVarToName, checker);
                renderBox.current = parsed
                  ? { kind: parsed.reactive ? 'reactive-tree' : 'static-tree', root: parsed.node }
                  : { kind: 'dynamic' };
              } else {
                renderBox.current = { kind: 'dynamic' };
              }
            } else {
              renderBox.current = { kind: 'dynamic' };
            }
          } else {
            renderBox.current = { kind: 'dynamic' };
          }
        } else {
          renderBox.current = { kind: 'dynamic' };
        }
        return;
      }

      if (ts.isReturnStatement(node)) {
        if (node.expression && extractScalarLiteral(node.expression, checker) === undefined)
          gap(node, 'setup-return', 'A helper return value requires explicit lowering.');
        return;
      }

      if (ts.isCallExpression(node)) {
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
                  const typeLit = typeExpr ? extractScalarLiteral(typeExpr, checker) : undefined;
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
                    defaultValue = extractScalarLiteral(defExpr, checker);
                    if (defaultValue === undefined)
                      gap(defExpr, sub, 'Property default is not a proven static scalar.');
                  }
                  const emptyExpr = extractObjectProperty(spec, 'empty');
                  const emptyLit = emptyExpr ? extractScalarLiteral(emptyExpr, checker) : undefined;
                  if (emptyLit === 'accept' || emptyLit === 'fallback' || emptyLit === 'error') {
                    empty = emptyLit;
                  } else if (emptyExpr)
                    gap(emptyExpr, sub, 'Empty behavior must be statically known.');
                  const optExpr = extractObjectProperty(spec, 'options');
                  if (optExpr && ts.isArrayLiteralExpression(unwrapExpr(optExpr))) {
                    options = (unwrapExpr(optExpr) as ts.ArrayLiteralExpression).elements
                      .map((el) => extractScalarLiteral(el, checker))
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
                    const min = minExpr ? extractScalarLiteral(minExpr, checker) : undefined;
                    const max = maxExpr ? extractScalarLiteral(maxExpr, checker) : undefined;
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
                const val = extractScalarLiteral(p.initializer, checker);
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
            const nameLit = node.arguments[0]
              ? extractScalarLiteral(node.arguments[0], checker)
              : undefined;
            const initLit = node.arguments[1]
              ? extractScalarLiteral(node.arguments[1], checker)
              : undefined;
            const kindMap: Record<string, StateDeclIR['kind']> = {
              'state.bool': 'bool',
              'state.string': 'string',
              'state.enum': 'enum',
              'state.numberDiscrete': 'number.discrete',
              'state.numberRange': 'number.range',
            };
            const kind = kindMap[sub];
            if (typeof nameLit !== 'string' || !/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(nameLit))
              gap(node, sub, 'State semantic must be a valid static name.');
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
                    const values = init.elements.map((e) => extractScalarLiteral(e, checker));
                    if (values.some((v) => v === undefined))
                      gap(field, sub, 'State options must be static scalar values.');
                    else stateSpec.options = values as ScalarLiteral[];
                  } else {
                    const v = extractScalarLiteral(init, checker);
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
            const keyLit = node.arguments[0]
              ? extractScalarLiteral(node.arguments[0], checker)
              : undefined;
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
            const handler = cbArg ? resolveFunctionLike(cbArg, checker) : undefined;
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
                const values = keysArg.elements.map((key) => extractScalarLiteral(key, checker));
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
                    constant: (expression) => extractScalarLiteral(expression, checker),
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
            const evLit = node.arguments[0]
              ? extractScalarLiteral(node.arguments[0], checker)
              : undefined;
            if (typeof evLit === 'string') {
              const handler = node.arguments[1]
                ? resolveFunctionLike(node.arguments[1], checker)
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
                    constant: (expression) => extractScalarLiteral(expression, checker),
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
            const handler = cbArg ? resolveFunctionLike(cbArg, checker) : undefined;
            scanRunCallback(handler);
            const lowered = handler
              ? lowerActionBody(handler, {
                  states: stateVarToName,
                  checker,
                  runParameter:
                    handler.parameters[0] && ts.isIdentifier(handler.parameters[0].name)
                      ? handler.parameters[0].name.text
                      : undefined,
                  constant: (expression) => extractScalarLiteral(expression, checker),
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
            if (node.arguments[1]) scanRunCallback(resolveFunctionLike(node.arguments[1], checker));
          }

          // def.feedback.style.use(tw(...))
          else if (sub === 'feedback.style.use') {
            for (const a of node.arguments) {
              if (!collectTwTokens(a, checker, staticStyleTokens))
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
              if (!intentExpr || !collectRuleStyleTokens(intentExpr, checker, styleTokens)) {
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
                const whenFn = resolveFunctionLike(whenExpr, checker);
                if (whenFn && whenFn.body) {
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
                    ? parseRuleCondition(bodyExpr, wName, stateVarToName, checker)
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

        // 2. Hook calls (`asTrigger()`, `asFocusable()`, `asButton()`, ...)
        const resolved = resolveCallName(node.expression, checker);
        if (resolved) {
          if (BUILTIN_HOOK_NAMES.has(resolved.name)) {
            hooks.push({
              name: resolved.name,
              moduleSpecifier: resolved.sourceFile,
              kind: 'builtin',
            });
          } else if (resolved.name.startsWith('as') && /^as[A-Z]/.test(resolved.name)) {
            hooks.push({
              name: resolved.name,
              moduleSpecifier: resolved.sourceFile,
              kind: 'authored',
            });
            // Follow authored hook's setup if defined via defineAsHook in the program!
            const sym = resolveAliasedSymbol(
              checker,
              checker.getSymbolAtLocation(unwrapExpr(node.expression))
            );
            const decl = sym?.valueDeclaration ?? sym?.declarations?.[0];
            if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
              const hookFactory = findFactoryCall(decl.initializer, checker, [
                'defineAsHook',
                'defineHook',
              ]);
              const hookArg = hookFactory?.call.arguments[0]
                ? unwrapExpr(hookFactory.call.arguments[0])
                : undefined;
              if (hookArg && ts.isObjectLiteralExpression(hookArg)) {
                const nestedSetup = extractSetupFunction(hookArg, checker);
                if (nestedSetup) walkFunction(nestedSetup);
                else gap(node, 'hook-composition', 'Authored hook setup could not be resolved.');
              } else
                gap(node, 'hook-composition', 'Hook calls require a resolved authored definition.');
            }
          } else if (
            defName &&
            node.arguments.some(
              (a) =>
                ts.isIdentifier(unwrapExpr(a)) &&
                defAliases.has(checker.getSymbolAtLocation(unwrapExpr(a))!)
            )
          ) {
            // Follow local helper calls passing `def` (e.g. `setupShadcnStyleSelection(def, ...)`).
            const helperFn = resolveFunctionLike(node.expression, checker);
            if (helperFn) {
              const defArgIdx = node.arguments.findIndex(
                (a) =>
                  ts.isIdentifier(unwrapExpr(a)) &&
                  defAliases.has(checker.getSymbolAtLocation(unwrapExpr(a))!)
              );
              const targetParam = helperFn.parameters[defArgIdx];
              const targetParamName =
                targetParam && ts.isIdentifier(targetParam.name)
                  ? targetParam.name.text
                  : undefined;
              if (
                targetParamName &&
                node.arguments.length === 1 &&
                helperFn.parameters.length === 1
              )
                walkFunction(helperFn, targetParamName);
              else
                gap(
                  node,
                  'setup-composition',
                  'Helper arguments require explicit parameter substitution before expansion.'
                );
            } else
              gap(node, 'setup-composition', 'Setup helper implementation could not be resolved.');
          } else if (extractScalarLiteral(node, checker) === undefined) {
            gap(node, resolved.name, 'Setup call has no lowering and cannot be omitted.');
          }
        } else gap(node, 'call', 'Setup call binding could not be resolved.');
        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(fn.body);
  };

  walkFunction(setupFn);

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
