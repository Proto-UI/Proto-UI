import ts from 'typescript';
import type {
  HookSourceMetadataFactory,
  HookSourceModule as Module,
  HookSourceModuleContext,
} from './hook-source-module.js';

type CreationBindings = ReadonlyMap<ts.Node, { node: ts.Node; module: Module } | null>;

export type HookSourceMetadataCreationOptions = {
  resolveFunction(
    node: ts.Node,
    module: Module
  ): { fn: ts.FunctionLikeDeclaration; module: Module } | null;
  /** Prove an own static modules snapshot, including a nonempty snapshot. */
  isStaticModules(node: ts.Node, module: Module): boolean;
};

function unwrap(node: ts.Node): ts.Node {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    node = node.expression;
  return node;
}

function deferredFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function ordinaryKey(name: ts.PropertyName | undefined): string | null {
  if (
    !name ||
    !(ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) ||
    name.text === '__proto__'
  )
    return null;
  return name.text;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === kind)
  );
}

function decorated(node: ts.Node): boolean {
  return ts.canHaveDecorators(node) && !!ts.getDecorators(node)?.length;
}

/**
 * Prove only the creation phase of a finite source graph. This is not a
 * producer-definition lifetime proof, a helper purity annotation, or proof
 * that every producer in the graph has an empty modules snapshot.
 *
 * The standard-instance scenario trusts Core's metadata ABI and pristine
 * language intrinsics. Every other reached runtime module must fit the small
 * positive grammar below; an unknown effect is a refusal, not a no-op.
 */
export function createHookSourceMetadataCreationGuard(
  moduleContext: HookSourceModuleContext,
  options: HookSourceMetadataCreationOptions
): (source: ts.SourceFile) => boolean {
  let facts = new WeakMap<ts.SourceFile, boolean>();
  let factsRevision = moduleContext.sourceRevision();
  let factsQuery: object | undefined;
  const activeModules = new Set<ts.SourceFile>();
  const activeValues = new Set<ts.Node>();
  const activePrimitiveValues = new Set<ts.Node>();
  const activeCalls = new Set<ts.Node>();
  const activeClasses = new Set<ts.Node>();
  const emptyBindings: CreationBindings = new Map();
  const metadataFactories: readonly HookSourceMetadataFactory[] = [
    'createContextKey',
    'createAnatomyFamily',
    'cap',
    'moduleDeclaration',
    'declareModule',
    'tw',
  ];

  const globalIdentifier = (node: ts.Node, module: Module, name: string): boolean => {
    const value = unwrap(node);
    return (
      ts.isIdentifier(value) &&
      value.text === name &&
      moduleContext.resolveReference(value, module) === null
    );
  };

  const primitive = (node: ts.Node, module: Module): boolean => {
    const value = unwrap(node);
    return (
      ts.isStringLiteralLike(value) ||
      ts.isNumericLiteral(value) ||
      ts.isBigIntLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword ||
      globalIdentifier(value, module, 'undefined') ||
      (ts.isPrefixUnaryExpression(value) &&
        (value.operator === ts.SyntaxKind.PlusToken ||
          value.operator === ts.SyntaxKind.MinusToken) &&
        ts.isNumericLiteral(value.operand))
    );
  };

  const hasDynamicImport = (source: ts.SourceFile): boolean => {
    let found = false;
    const visit = (node: ts.Node): void => {
      if (found || ts.isTypeNode(node)) return;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  };

  const propertyValue = (property: ts.ObjectLiteralElementLike): ts.Node | null => {
    if (ts.isPropertyAssignment(property)) return property.initializer;
    if (ts.isShorthandPropertyAssignment(property))
      return property.objectAssignmentInitializer ? null : property.name;
    return ts.isMethodDeclaration(property) ? property : null;
  };

  const constantInitializer = (
    node: ts.Identifier,
    module: Module
  ): { declaration: ts.VariableDeclaration; module: Module } | null => {
    const symbol = moduleContext.resolveReference(node, module);
    if (
      !symbol ||
      !ts.isVariableDeclaration(symbol.declaration) ||
      !ts.isIdentifier(symbol.declaration.name) ||
      !symbol.declaration.initializer ||
      !ts.isVariableDeclarationList(symbol.declaration.parent) ||
      symbol.declaration.parent.flags !== ts.NodeFlags.Const
    )
      return null;
    return { declaration: symbol.declaration, module: symbol.module };
  };

  const literalArray = (
    node: ts.Node,
    module: Module,
    seen = new Set<ts.Node>()
  ): { array: ts.ArrayLiteralExpression; module: Module } | null => {
    const value = unwrap(node);
    if (ts.isArrayLiteralExpression(value)) return { array: value, module };
    if (!ts.isIdentifier(value)) return null;
    const binding = constantInitializer(value, module);
    if (!binding || seen.has(binding.declaration)) return null;
    return literalArray(
      binding.declaration.initializer!,
      binding.module,
      new Set(seen).add(binding.declaration)
    );
  };

  const arrayClosed = (
    array: ts.ArrayLiteralExpression,
    module: Module,
    bindings: CreationBindings,
    check: (node: ts.Node, module: Module) => boolean,
    seen = new Set<ts.Node>()
  ): boolean => {
    if (seen.has(array)) return false;
    const nextSeen = new Set(seen).add(array);
    return array.elements.every((element) => {
      if (!ts.isSpreadElement(element)) return check(element, module);
      const source = literalArray(element.expression, module);
      // Only actual fresh/const literal string arrays establish the iterable.
      // A closed object or a function is not proof of a harmless iterator.
      return (
        !!source &&
        arrayClosed(
          source.array,
          source.module,
          bindings,
          (item, owner) => primitiveKind(item, owner, bindings) === 'string',
          nextSeen
        )
      );
    });
  };

  const primitiveKind = (
    node: ts.Node,
    module: Module,
    bindings: CreationBindings,
    seen = new Set<ts.Node>()
  ): string | null => {
    const value = unwrap(node);
    if (ts.isStringLiteralLike(value)) return 'string';
    if (primitive(value, module)) return 'primitive';
    if (ts.isIdentifier(value)) {
      const declaration = moduleContext.resolveReference(value, module)?.declaration;
      if (declaration && bindings.has(declaration)) {
        const actual = bindings.get(declaration);
        return actual ? primitiveKind(actual.node, actual.module, bindings, seen) : 'primitive';
      }
      const binding = constantInitializer(value, module);
      if (
        !binding ||
        seen.has(binding.declaration) ||
        activePrimitiveValues.has(binding.declaration)
      )
        return null;
      // Spread checks can start another primitive proof. Preserve the active
      // declaration across that boundary so a cyclic string/array alias fails.
      activePrimitiveValues.add(binding.declaration);
      try {
        return primitiveKind(
          binding.declaration.initializer!,
          binding.module,
          bindings,
          new Set(seen).add(binding.declaration)
        );
      } finally {
        activePrimitiveValues.delete(binding.declaration);
      }
    }
    if (ts.isTemplateExpression(value))
      return value.templateSpans.every(
        (span) => primitiveKind(span.expression, module, bindings, seen) !== null
      )
        ? 'string'
        : null;
    if (
      !ts.isCallExpression(value) ||
      value.questionDotToken ||
      value.arguments.length !== 1 ||
      primitiveKind(value.arguments[0], module, bindings, seen) !== 'string'
    )
      return null;
    const method = unwrap(value.expression);
    if (
      !ts.isPropertyAccessExpression(method) ||
      method.questionDotToken ||
      method.name.text !== 'join'
    )
      return null;
    const receiver = unwrap(method.expression);
    return ts.isArrayLiteralExpression(receiver) &&
      arrayClosed(
        receiver,
        module,
        bindings,
        (item, owner) => primitiveKind(item, owner, bindings, seen) === 'string'
      )
      ? 'string'
      : null;
  };

  const classClosed = (node: ts.ClassLikeDeclaration, module: Module): boolean => {
    if (activeClasses.has(node) || decorated(node)) return false;
    activeClasses.add(node);
    try {
      for (const member of node.members) {
        if (
          decorated(member) ||
          hasModifier(member, ts.SyntaxKind.StaticKeyword) ||
          ts.isClassStaticBlockDeclaration(member) ||
          (member.name && ts.isComputedPropertyName(member.name))
        )
          return false;
        if (
          (ts.isConstructorDeclaration(member) ||
            ts.isMethodDeclaration(member) ||
            ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member)) &&
          member.parameters.some(decorated)
        )
          return false;
      }
      for (const clause of node.heritageClauses ?? []) {
        if (clause.token === ts.SyntaxKind.ImplementsKeyword) continue;
        if (clause.token !== ts.SyntaxKind.ExtendsKeyword || clause.types.length !== 1)
          return false;
        const expression = unwrap(clause.types[0].expression);
        if (!ts.isIdentifier(expression)) return false;
        const parent = moduleContext.resolveReference(expression, module);
        if (
          !parent ||
          !ts.isClassDeclaration(parent.declaration) ||
          !classClosed(parent.declaration, parent.module)
        )
          return false;
      }
      // Instance initializers, constructors and method bodies are deferred.
      return true;
    } finally {
      activeClasses.delete(node);
    }
  };

  const referenceClosed = (
    node: ts.Identifier,
    module: Module,
    bindings: CreationBindings
  ): boolean => {
    if (
      moduleContext.isDefineAsHookReference(node, module) ||
      moduleContext.isDefinePrototypeReference(node, module) ||
      moduleContext.isDefineHookReference(node, module) ||
      metadataFactories.some((name) =>
        moduleContext.isCoreMetadataFactoryReference(node, module, name)
      )
    )
      return true;
    const symbol = moduleContext.resolveReference(node, module);
    if (!symbol) return false;
    const declaration = symbol.declaration;
    if (bindings.has(declaration)) {
      const actual = bindings.get(declaration);
      return !actual || valueClosed(actual.node, actual.module, bindings);
    }
    if (ts.isFunctionDeclaration(declaration)) return !!declaration.body;
    if (ts.isClassDeclaration(declaration)) return classClosed(declaration, symbol.module);
    if (
      !ts.isVariableDeclaration(declaration) ||
      !ts.isIdentifier(declaration.name) ||
      !declaration.initializer ||
      !ts.isVariableDeclarationList(declaration.parent) ||
      !(declaration.parent.flags & ts.NodeFlags.Const) ||
      activeValues.has(declaration)
    )
      return false;
    activeValues.add(declaration);
    try {
      return valueClosed(declaration.initializer, symbol.module, bindings);
    } finally {
      activeValues.delete(declaration);
    }
  };

  const objectClosed = (
    value: ts.ObjectLiteralExpression,
    module: Module,
    bindings: CreationBindings
  ): boolean => {
    const keys = new Set<string>();
    return value.properties.every((property) => {
      if (ts.isSpreadAssignment(property)) return false;
      const key = ordinaryKey(property.name);
      if (key === null || keys.has(key)) return false;
      keys.add(key);
      const expression = propertyValue(property);
      return !!expression && valueClosed(expression, module, bindings);
    });
  };

  const canonicalConfig = (
    call: ts.CallExpression,
    module: Module,
    bindings: CreationBindings
  ): boolean | null => {
    const kind = moduleContext.isDefineAsHookReference(call.expression, module)
      ? 'asHook'
      : moduleContext.isDefinePrototypeReference(call.expression, module)
        ? 'prototype'
        : moduleContext.isDefineHookReference(call.expression, module)
          ? 'hook'
          : null;
    if (!kind) return null;
    if (call.arguments.length !== 1) return false;
    const config = unwrap(call.arguments[0]);
    if (!ts.isObjectLiteralExpression(config)) return false;
    const keys = new Set<string>();
    for (const property of config.properties) {
      if (ts.isSpreadAssignment(property)) return false;
      const key = ordinaryKey(property.name);
      if (key === null || keys.has(key)) return false;
      keys.add(key);
      const expression = propertyValue(property);
      if (!expression || !valueClosed(expression, module, bindings)) return false;
      if (key === 'name') {
        if (!ts.isStringLiteralLike(unwrap(expression))) return false;
      } else if (key === 'modules') {
        if (kind === 'hook') return false;
      } else if (key === 'mode') {
        const mode = unwrap(expression);
        if (
          kind !== 'hook' ||
          !ts.isStringLiteralLike(mode) ||
          !['once', 'multiple', 'configurable'].includes(mode.text)
        )
          return false;
      } else if (
        key !== 'setup' &&
        !(kind === 'asHook' && key === 'projectHandle') &&
        !(kind === 'hook' && key === 'configure')
      ) {
        return false;
      } else if (!options.resolveFunction(expression, module)) {
        return false;
      }
    }
    return keys.has('name') && keys.has('setup');
  };

  const metadataCall = (
    call: ts.CallExpression,
    module: Module,
    bindings: CreationBindings
  ): boolean | null => {
    const name = metadataFactories.find((candidate) =>
      moduleContext.isCoreMetadataFactoryReference(call.expression, module, candidate)
    );
    if (!name) return null;
    if (name === 'tw')
      return call.arguments.every(
        (argument) => primitiveKind(argument, module, bindings) === 'string'
      );
    return (
      call.arguments.length === (name === 'createAnatomyFamily' || name === 'declareModule' ? 2 : 1)
    );
  };

  const singleReturn = (fn: ts.FunctionLikeDeclaration): ts.Expression | null => {
    if (
      !fn.body ||
      fn.asteriskToken ||
      hasModifier(fn, ts.SyntaxKind.AsyncKeyword) ||
      fn.parameters.some(
        (parameter) =>
          !ts.isIdentifier(parameter.name) ||
          !!parameter.initializer ||
          !!parameter.dotDotDotToken ||
          decorated(parameter)
      )
    )
      return null;
    if (!ts.isBlock(fn.body)) return fn.body;
    const statements = fn.body.statements;
    return statements.length === 1 && ts.isReturnStatement(statements[0])
      ? (statements[0].expression ?? null)
      : null;
  };

  const sourceCallClosed = (
    call: ts.CallExpression,
    module: Module,
    bindings: CreationBindings
  ): boolean => {
    // No arbitrary receiver/getter or factory-returned callable is invoked.
    if (!ts.isIdentifier(unwrap(call.expression))) return false;
    const resolved = options.resolveFunction(call.expression, module);
    if (!resolved || activeCalls.has(resolved.fn)) return false;
    const returned = singleReturn(resolved.fn);
    if (!returned || call.arguments.length > resolved.fn.parameters.length) return false;
    const nested = new Map(bindings);
    resolved.fn.parameters.forEach((parameter, index) =>
      nested.set(
        parameter.name,
        call.arguments[index] ? { node: call.arguments[index], module } : null
      )
    );
    const value = unwrap(returned);
    const parameter = ts.isIdentifier(value)
      ? moduleContext.resolveReference(value, resolved.module)?.declaration
      : null;
    const allowedReturn =
      deferredFunction(value) ||
      (!!parameter && resolved.fn.parameters.some((item) => item.name === parameter)) ||
      (ts.isCallExpression(value) && metadataCall(value, resolved.module, nested) === true);
    if (!allowedReturn) return false;
    activeCalls.add(resolved.fn);
    try {
      return valueClosed(value, resolved.module, nested);
    } finally {
      activeCalls.delete(resolved.fn);
    }
  };

  const literalMapClosed = (
    call: ts.CallExpression,
    method: ts.PropertyAccessExpression,
    module: Module,
    bindings: CreationBindings
  ): boolean => {
    const receiver = unwrap(method.expression);
    if (
      method.name.text !== 'map' ||
      !ts.isArrayLiteralExpression(receiver) ||
      call.arguments.length !== 1 ||
      !receiver.elements.every((element) => primitive(element, module))
    )
      return false;
    const callback = unwrap(call.arguments[0]);
    if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return false;
    const returned = singleReturn(callback);
    if (!returned || callback.parameters.length !== 1) return false;
    // The callback receives only primitive data from a fresh literal array.
    // Even an empty array must have a closed callback; it is not an escape hatch.
    const nested = new Map(bindings).set(callback.parameters[0].name, null);
    return dataClosed(returned, module, nested);
  };

  const dataClosed = (node: ts.Node, module: Module, bindings: CreationBindings): boolean => {
    const value = unwrap(node);
    if (primitiveKind(value, module, bindings) !== null) return true;
    if (ts.isIdentifier(value)) return referenceClosed(value, module, bindings);
    if (ts.isArrayLiteralExpression(value))
      return arrayClosed(value, module, bindings, (element, owner) =>
        dataClosed(element, owner, bindings)
      );
    if (!ts.isObjectLiteralExpression(value)) return false;
    return value.properties.every((property) => {
      if (ts.isSpreadAssignment(property) || ordinaryKey(property.name) === null) return false;
      const expression = propertyValue(property);
      return (
        !ts.isMethodDeclaration(property) &&
        !!expression &&
        dataClosed(expression, module, bindings)
      );
    });
  };

  const valueClosed = (
    node: ts.Node,
    module: Module,
    bindings: CreationBindings = emptyBindings
  ): boolean => {
    const value = unwrap(node);
    if (primitiveKind(value, module, bindings) !== null || deferredFunction(value)) return true;
    if (ts.isIdentifier(value)) return referenceClosed(value, module, bindings);
    if (ts.isClassExpression(value)) return classClosed(value, module);
    if (ts.isArrayLiteralExpression(value))
      return arrayClosed(value, module, bindings, (element, owner) =>
        valueClosed(element, owner, bindings)
      );
    if (ts.isObjectLiteralExpression(value)) return objectClosed(value, module, bindings);
    if (ts.isPropertyAccessExpression(value))
      return (
        !value.questionDotToken &&
        value.name.text === 'modules' &&
        options.isStaticModules(value, module)
      );
    if (ts.isNewExpression(value)) {
      const args = value.arguments ?? [];
      if (
        ['Map', 'WeakMap', 'WeakSet', 'Set'].some((name) =>
          globalIdentifier(value.expression, module, name)
        ) &&
        args.length === 0
      )
        return true;
      return (
        globalIdentifier(value.expression, module, 'Set') &&
        args.length === 1 &&
        ts.isArrayLiteralExpression(unwrap(args[0])) &&
        dataClosed(args[0], module, bindings)
      );
    }
    if (
      !ts.isCallExpression(value) ||
      value.questionDotToken ||
      value.arguments.some((argument) => ts.isSpreadElement(argument)) ||
      !value.arguments.every((argument) => valueClosed(argument, module, bindings))
    )
      return false;
    const canonical = canonicalConfig(value, module, bindings);
    if (canonical !== null) return canonical;
    const metadata = metadataCall(value, module, bindings);
    if (metadata !== null) return metadata;
    const method = unwrap(value.expression);
    if (ts.isPropertyAccessExpression(method) && !method.questionDotToken) {
      if (method.name.text === 'freeze' && globalIdentifier(method.expression, module, 'Object'))
        return value.arguments.length === 1 && dataClosed(value.arguments[0], module, bindings);
      return literalMapClosed(value, method, module, bindings);
    }
    return sourceCallClosed(value, module, bindings);
  };

  const moduleClosed = (module: Module): boolean => {
    const cached = facts.get(module.source);
    if (cached !== undefined) return cached;
    if (activeModules.has(module.source) || hasDynamicImport(module.source)) return false;
    activeModules.add(module.source);
    const dependencyClosed = (specifier: ts.Expression): boolean => {
      if (!ts.isStringLiteralLike(specifier)) return false;
      // Core's internal entry is the same trusted package ABI as its public
      // metadata factories. This is not a blanket exemption for hooks or any
      // authored module, whose real initialization remains part of the graph.
      if (specifier.text === '@proto.ui/core' || specifier.text === '@proto.ui/core/internal')
        return true;
      const dependency = moduleContext.resolveModule(module.file, specifier.text);
      return !!dependency && moduleClosed(dependency);
    };
    const statementClosed = (statement: ts.Statement): boolean => {
      if (ts.isImportDeclaration(statement))
        return (
          !!statement.importClause &&
          (statement.importClause.isTypeOnly || dependencyClosed(statement.moduleSpecifier))
        );
      if (ts.isExportDeclaration(statement))
        return (
          statement.isTypeOnly ||
          !statement.moduleSpecifier ||
          dependencyClosed(statement.moduleSpecifier)
        );
      if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEmptyStatement(statement) ||
        ts.isFunctionDeclaration(statement) ||
        hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
      )
        return true;
      if (ts.isClassDeclaration(statement)) return classClosed(statement, module);
      if (ts.isVariableStatement(statement)) {
        const flags = statement.declarationList.flags;
        // using/await using add disposal effects and are not const bindings.
        if (flags !== ts.NodeFlags.Const && flags !== ts.NodeFlags.Let) return false;
        return statement.declarationList.declarations.every(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            !!declaration.initializer &&
            (flags & ts.NodeFlags.Const
              ? valueClosed(declaration.initializer, module)
              : primitive(declaration.initializer, module))
        );
      }
      if (ts.isExportAssignment(statement))
        return !statement.isExportEquals && valueClosed(statement.expression, module);
      return ts.isExpressionStatement(statement) && primitive(statement.expression, module);
    };
    let closed = false;
    try {
      closed = module.source.statements.every(statementClosed);
    } finally {
      activeModules.delete(module.source);
    }
    facts.set(module.source, closed);
    return closed;
  };

  return (source) => {
    // moduleForSource also registers its source, so observe the revision only
    // after that operation. Root identity alone cannot bind an imported AST.
    const module = moduleContext.moduleForSource(source);
    const revision = moduleContext.sourceRevision();
    const query = moduleContext.synchronousQueryIdentity();
    // An unchanged AST can import a logical path that now targets a different
    // physical module. Recheck the complete creation graph in each summary
    // observation, including dependencies never read by the captured hook.
    // Direct calls outside a query have no reusable filesystem observation.
    if (!query || factsQuery !== query || revision !== factsRevision) {
      facts = new WeakMap();
      factsRevision = revision;
      factsQuery = query;
    }
    const closed = moduleClosed(module);
    if (moduleContext.sourceRevision() !== revision || factsQuery !== query) {
      // Do not retain or return a proof assembled across source snapshots or
      // facts installed by a reentrant query with independent observations.
      facts = new WeakMap();
      factsRevision = moduleContext.sourceRevision();
      factsQuery = undefined;
      return false;
    }
    return closed;
  };
}
