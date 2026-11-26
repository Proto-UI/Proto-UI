import ts from 'typescript';

import { createHookSourceModuleContext, type HookSourceModule } from './hook-source-module.js';
import { constantModuleHasUnmodeledEffects } from './constant-module-effects.js';
import type { HookSourceSummaryContext } from './hook-source-summary.js';

const unwrap = (node: ts.Node): ts.Node => {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node)
  )
    node = node.expression;
  return node;
};

const outer = (node: ts.Node): ts.Node => {
  while (node.parent && unwrap(node.parent) === node) node = node.parent;
  return node;
};

const isFunction = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node);

const isConst = (node: ts.VariableDeclaration): boolean =>
  ts.isVariableDeclarationList(node.parent) && !!(node.parent.flags & ts.NodeFlags.Const);

const valueReference = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  return !(
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) ||
    (isFunction(parent) && parent.name === node)
  );
};

const written = (node: ts.Node): boolean => {
  for (let target = node; target.parent; target = target.parent) {
    const parent = target.parent;
    if (
      (ts.isBinaryExpression(parent) &&
        parent.left === target &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
        parent.operand === target &&
        (parent.operator === ts.SyntaxKind.PlusPlusToken ||
          parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
      (ts.isDeleteExpression(parent) && parent.expression === target) ||
      ((ts.isForOfStatement(parent) || ts.isForInStatement(parent)) &&
        parent.initializer === target)
    )
      return true;
    if (ts.isStatement(parent) || isFunction(parent)) break;
  }
  return false;
};

type SourceGraph = {
  entryFile: string;
  sources: readonly HookSourceModule[];
  dependencies: ReadonlyMap<string, ReadonlySet<string>>;
};

/**
 * A distinct handle proof, not an extension of primitive token data. The
 * private table and each fresh Core tw handle have one authored read site,
 * which must hand the handle to a proved native Rule intent. No handle or
 * token-array alias, mutation, return or unknown consumer receives authority.
 */
export function createPrivateStyleHandleMapProof(
  loopRows: (loop: ts.ForOfStatement) => readonly ts.Expression[] | null,
  entry: ts.SourceFile,
  summary: HookSourceSummaryContext
): (expression: ts.Expression) => boolean {
  const modules = createHookSourceModuleContext();
  const graphs = new WeakMap<ts.SourceFile, SourceGraph | null>();
  const proofs = new WeakMap<ts.Node, boolean>();

  const binding = (node: ts.Node): ts.Node | null => {
    const held = modules.resolveReference(
      unwrap(node),
      modules.moduleForSource(node.getSourceFile())
    )?.declaration;
    return held && ts.isIdentifier(held) && ts.isParameter(held.parent) && held.parent.name === held
      ? held.parent
      : (held ?? null);
  };

  const graph = (current: ts.SourceFile): SourceGraph | null => {
    if (graphs.has(current)) return graphs.get(current) ?? null;
    const root = entry.fileName === current.fileName ? current : entry;
    modules.registerSource(root);
    modules.registerSource(current);
    const rootModule = modules.moduleForSource(root);
    const pending = [rootModule, modules.moduleForSource(current)];
    const reached = new Map<string, HookSourceModule>();
    const dependencies = new Map<string, Set<string>>();
    let safe = true;
    while (safe && pending.length) {
      const module = pending.pop()!;
      if (reached.has(module.file)) continue;
      reached.set(module.file, module);
      const imports = new Set<string>();
      dependencies.set(module.file, imports);
      const edge = (specifier: ts.Expression): void => {
        if (!ts.isStringLiteralLike(specifier)) {
          safe = false;
          return;
        }
        if (specifier.text === '@proto.ui/core') return;
        const target = modules.resolveModule(module.file, specifier.text);
        if (!target) {
          safe = false;
          return;
        }
        imports.add(target.file);
        pending.push(target);
      };
      for (const statement of module.source.statements) {
        if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly)
          edge(statement.moduleSpecifier);
        else if (
          ts.isExportDeclaration(statement) &&
          !statement.isTypeOnly &&
          statement.moduleSpecifier
        )
          edge(statement.moduleSpecifier);
        else if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) safe = false;
      }
      const opaque = (node: ts.Node): void => {
        if (!safe || ts.isTypeNode(node)) return;
        if (
          ts.isWithStatement(node) ||
          (ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(unwrap(node.expression)) &&
                ['eval', 'require'].includes((unwrap(node.expression) as ts.Identifier).text))))
        ) {
          safe = false;
          return;
        }
        ts.forEachChild(node, opaque);
      };
      opaque(module.source);
    }
    const result = safe
      ? { entryFile: rootModule.file, sources: [...reached.values()], dependencies }
      : null;
    graphs.set(current, result);
    return result;
  };

  const literalRows = (expression: ts.Expression): readonly string[] | null => {
    let node = unwrap(expression);
    if (ts.isIdentifier(node)) {
      const declaration = binding(node);
      if (
        !declaration ||
        !ts.isVariableDeclaration(declaration) ||
        !isConst(declaration) ||
        !declaration.initializer ||
        (declaration.getSourceFile() === node.getSourceFile() &&
          declaration.getStart() >= node.getStart())
      )
        return null;
      node = unwrap(declaration.initializer);
    }
    if (!ts.isArrayLiteralExpression(node) || !node.elements.length) return null;
    const values: string[] = [];
    for (const element of node.elements) {
      const value = unwrap(element);
      if (!ts.isStringLiteralLike(value)) return null;
      values.push(value.text);
    }
    return values;
  };

  const keys = (
    member: ts.PropertyAccessExpression | ts.ElementAccessExpression
  ): readonly string[] | null => {
    if (ts.isPropertyAccessExpression(member)) return [member.name.text];
    const key = unwrap(member.argumentExpression);
    if (ts.isStringLiteralLike(key)) return [key.text];
    if (!ts.isIdentifier(key)) return null;
    const declaration = binding(key);
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      !isConst(declaration) ||
      declaration.initializer ||
      !ts.isIdentifier(declaration.name)
    )
      return null;
    const list = declaration.parent;
    if (!ts.isVariableDeclarationList(list) || list.declarations.length !== 1) return null;
    const loop = list.parent;
    if (!ts.isForOfStatement(loop) || loop.initializer !== list || loop.awaitModifier) return null;
    const iterable = unwrap(loop.expression);
    if (ts.isIdentifier(iterable)) {
      // The production row callback reads the module constant inventory. A
      // function-local list must never borrow a same-named module list's
      // lifetime proof, even when their initial string values happen to match.
      const module = modules.moduleForSource(loop.getSourceFile());
      const lexical = modules.resolveReference(iterable, module);
      const moduleBinding = modules.resolveLocal(module, iterable.text);
      if (!lexical || !moduleBinding || lexical.declaration !== moduleBinding.declaration)
        return null;
    }
    let stable = true;
    const visit = (node: ts.Node): void => {
      if (!stable || ts.isTypeNode(node)) return;
      if (
        ts.isIdentifier(node) &&
        valueReference(node) &&
        binding(node) === declaration &&
        written(node)
      )
        stable = false;
      ts.forEachChild(node, visit);
    };
    visit(key.getSourceFile());
    if (!stable) return null;
    const expected = literalRows(loop.expression);
    const rows = loopRows(loop);
    if (!expected || !rows || rows.length !== expected.length || rows.length > 256) return null;
    const values: string[] = [];
    for (const row of rows) {
      const value = unwrap(row);
      if (!ts.isStringLiteralLike(value)) return null;
      values.push(value.text);
    }
    return values.every((value, index) => value === expected[index]) ? values : null;
  };

  const canonicalTwTable = (declaration: ts.VariableDeclaration): ReadonlySet<string> | null => {
    const source = declaration.getSourceFile();
    const statement = declaration.parent.parent;
    if (
      !isConst(declaration) ||
      !declaration.initializer ||
      !ts.isVariableStatement(statement) ||
      statement.parent !== source ||
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ||
      constantModuleHasUnmodeledEffects(source)
    )
      return null;
    const module = modules.moduleForSource(source);
    if (modules.resolveExports(module).some((symbol) => symbol.declaration === declaration))
      return null;
    // Core's reserved specifier is the existing module-context trust boundary.
    let canonicalImport = false;
    for (const candidate of source.statements) {
      if (
        !ts.isImportDeclaration(candidate) ||
        candidate.importClause?.isTypeOnly ||
        !ts.isStringLiteralLike(candidate.moduleSpecifier) ||
        candidate.moduleSpecifier.text !== '@proto.ui/core'
      )
        continue;
      const imports = candidate.importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports))
        canonicalImport ||= imports.elements.some(
          (item) =>
            !item.isTypeOnly &&
            item.name.text === 'tw' &&
            (!item.propertyName || item.propertyName.text === 'tw')
        );
    }
    if (!canonicalImport) return null;
    const object = unwrap(declaration.initializer);
    if (!ts.isObjectLiteralExpression(object) || !object.properties.length) return null;
    const names = new Set<string>();
    for (const property of object.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        (!ts.isIdentifier(property.name) && !ts.isStringLiteralLike(property.name)) ||
        property.name.text in Object.prototype ||
        names.has(property.name.text)
      )
        return null;
      const value = unwrap(property.initializer);
      if (
        !ts.isCallExpression(value) ||
        value.questionDotToken ||
        !ts.isIdentifier(value.expression) ||
        value.expression.text !== 'tw' ||
        !value.arguments.length ||
        !value.arguments.every((argument) => ts.isStringLiteralLike(unwrap(argument)))
      )
        return null;
      names.add(property.name.text);
    }
    return names;
  };

  const nativeOwner = (parameter: ts.ParameterDeclaration, sources: SourceGraph): boolean => {
    if (summary.isNativeSetupDefinition(parameter)) return true;
    const owner = parameter.parent;
    if (
      !ts.isFunctionDeclaration(owner) ||
      !owner.name ||
      !owner.body ||
      owner.parent !== owner.getSourceFile() ||
      owner.parameters.length !== 1 ||
      owner.parameters[0] !== parameter ||
      !ts.isIdentifier(parameter.name) ||
      parameter.initializer ||
      parameter.dotDotDotToken ||
      owner.asteriskToken ||
      owner.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    )
      return false;
    const ownerModule = modules.moduleForSource(owner.getSourceFile());
    // The helper's own module may export it for the one direct native caller.
    // An entry export or another module's re-export instead exposes a caller
    // outside this invocation graph. Resolve actual exported declarations so
    // declaration exports, named aliases and star barrels share one boundary.
    for (const module of sources.sources) {
      if (
        (module.file === sources.entryFile || module.file !== ownerModule.file) &&
        modules.resolveExports(module).some((symbol) => symbol.declaration === owner)
      )
        return false;
    }
    // A namespace exposes the callable as well as its ordinary imports. This
    // first handle proof does not certify any retained namespace receiver.
    const reachesOwner = new Set([ownerModule.file]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [file, imports] of sources.dependencies) {
        if (!reachesOwner.has(file) && [...imports].some((target) => reachesOwner.has(target))) {
          reachesOwner.add(file);
          changed = true;
        }
      }
    }
    let safe = true;
    const calls: ts.CallExpression[] = [];
    for (const module of sources.sources) {
      for (const statement of module.source.statements) {
        if (
          ((ts.isImportDeclaration(statement) &&
            !statement.importClause?.isTypeOnly &&
            statement.importClause?.namedBindings &&
            ts.isNamespaceImport(statement.importClause.namedBindings)) ||
            (ts.isExportDeclaration(statement) &&
              !statement.isTypeOnly &&
              statement.exportClause &&
              ts.isNamespaceExport(statement.exportClause))) &&
          statement.moduleSpecifier &&
          ts.isStringLiteralLike(statement.moduleSpecifier)
        ) {
          const target = modules.resolveModule(module.file, statement.moduleSpecifier.text);
          if (target && reachesOwner.has(target.file)) safe = false;
        }
      }
      const visit = (node: ts.Node): void => {
        if (
          !safe ||
          ts.isTypeNode(node) ||
          ts.isImportDeclaration(node) ||
          ts.isExportDeclaration(node)
        )
          return;
        if (ts.isIdentifier(node) && valueReference(node) && binding(node) === owner) {
          const reference = outer(node),
            call = reference.parent;
          if (
            !ts.isCallExpression(call) ||
            call.expression !== reference ||
            call.questionDotToken ||
            call.arguments.length !== 1 ||
            call.arguments.some(ts.isSpreadElement)
          ) {
            safe = false;
            return;
          }
          if (module.file !== ownerModule.file) {
            const importDeclaration = module.source.statements.find(
              (statement) =>
                ts.isImportDeclaration(statement) &&
                !statement.importClause?.isTypeOnly &&
                statement.importClause?.namedBindings &&
                ts.isNamedImports(statement.importClause.namedBindings) &&
                statement.importClause.namedBindings.elements.some(
                  (item) => !item.isTypeOnly && item.name.text === node.text
                )
            );
            if (
              !importDeclaration ||
              !ts.isImportDeclaration(importDeclaration) ||
              !ts.isStringLiteralLike(importDeclaration.moduleSpecifier) ||
              !importDeclaration.moduleSpecifier.text.startsWith('.') ||
              modules.resolveModule(module.file, importDeclaration.moduleSpecifier.text)?.file !==
                ownerModule.file
            ) {
              safe = false;
              return;
            }
          }
          calls.push(call);
        }
        ts.forEachChild(node, visit);
      };
      visit(module.source);
    }
    if (!safe || calls.length !== 1) return false;
    const call = calls[0]!;
    const argument = unwrap(call.arguments[0]!);
    const caller = ts.isIdentifier(argument) ? binding(argument) : null;
    return (
      !!caller &&
      ts.isParameter(caller) &&
      ts.findAncestor(call, isFunction) === caller.parent &&
      summary.isNativeSetupDefinition(caller)
    );
  };

  const nativeConsumer = (
    member: ts.PropertyAccessExpression | ts.ElementAccessExpression,
    sources: SourceGraph
  ): boolean => {
    const value = outer(member),
      call = value.parent;
    if (
      !ts.isCallExpression(call) ||
      call.questionDotToken ||
      call.arguments.length !== 1 ||
      call.arguments[0] !== value
    )
      return false;
    let receiver: ts.Node = unwrap(call.expression);
    for (const name of ['use', 'style', 'feedback']) {
      if (
        !ts.isPropertyAccessExpression(receiver) ||
        receiver.questionDotToken ||
        receiver.name.text !== name
      )
        return false;
      receiver = unwrap(receiver.expression);
    }
    if (!ts.isIdentifier(receiver)) return false;
    const intent = ts.findAncestor(call, isFunction);
    if (
      !intent ||
      !ts.isArrowFunction(intent) ||
      intent.parameters.length !== 1 ||
      !ts.isIdentifier(intent.parameters[0]!.name) ||
      intent.parameters[0]!.initializer ||
      intent.parameters[0]!.dotDotDotToken ||
      intent.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ||
      unwrap(intent.body) !== call ||
      binding(receiver) !== intent.parameters[0]
    )
      return false;
    const property = outer(intent).parent;
    if (
      !ts.isPropertyAssignment(property) ||
      property.initializer !== outer(intent) ||
      (!ts.isIdentifier(property.name) && !ts.isStringLiteralLike(property.name)) ||
      property.name.text !== 'intent'
    )
      return false;
    const config = property.parent;
    if (
      !ts.isObjectLiteralExpression(config) ||
      config.properties.length !== 2 ||
      !config.properties.every(
        (item) =>
          ts.isPropertyAssignment(item) &&
          (ts.isIdentifier(item.name) || ts.isStringLiteralLike(item.name)) &&
          ['when', 'intent'].includes(item.name.text)
      ) ||
      new Set(config.properties.map((item) => (item.name as ts.Identifier | ts.StringLiteral).text))
        .size !== 2
    )
      return false;
    const rule = outer(config).parent;
    if (
      !ts.isCallExpression(rule) ||
      rule.questionDotToken ||
      rule.arguments.length !== 1 ||
      rule.arguments[0] !== outer(config)
    )
      return false;
    const callee = unwrap(rule.expression);
    if (
      !ts.isPropertyAccessExpression(callee) ||
      callee.questionDotToken ||
      callee.name.text !== 'rule'
    )
      return false;
    const definition = unwrap(callee.expression);
    const parameter = ts.isIdentifier(definition) ? binding(definition) : null;
    return (
      !!parameter &&
      ts.isParameter(parameter) &&
      ts.findAncestor(rule, isFunction) === parameter.parent &&
      nativeOwner(parameter, sources)
    );
  };

  return (expression): boolean => {
    const member = unwrap(expression);
    if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member))
      return false;
    const cached = proofs.get(member);
    if (cached !== undefined) return cached;
    proofs.set(member, false);
    if (member.questionDotToken) return false;
    const owner = unwrap(member.expression);
    if (!ts.isIdentifier(owner)) return false;
    const sources = graph(member.getSourceFile());
    if (!sources) return false;
    const declaration = binding(owner);
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      declaration.getSourceFile() !== member.getSourceFile() ||
      declaration.getStart() >= member.getStart()
    )
      return false;
    const table = canonicalTwTable(declaration),
      names = keys(member);
    if (!table || !names || !names.length || !names.every((name) => table.has(name))) return false;
    let soleRead = true;
    const visit = (node: ts.Node): void => {
      if (!soleRead || ts.isTypeNode(node)) return;
      if (
        ts.isIdentifier(node) &&
        valueReference(node) &&
        binding(node) === declaration &&
        node !== owner
      ) {
        soleRead = false;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(declaration.getSourceFile());
    if (!soleRead || !nativeConsumer(member, sources)) return false;
    proofs.set(member, true);
    return true;
  };
}
