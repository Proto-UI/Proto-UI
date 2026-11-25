import ts from 'typescript';

/** Function declarations are mutable in JavaScript even though they are not `let`. */
export function hasBindingWrites(binding: ts.Symbol, checker: ts.TypeChecker): boolean {
  const files = new Set(
    binding.declarations?.map((declaration) => declaration.getSourceFile()) ?? []
  );
  let written = false;
  const mentions = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node)) return checker.getSymbolAtLocation(node) === binding;
    // A property write does not rebind the receiver itself.
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return false;
    return ts.forEachChild(node, (child) => mentions(child) || undefined) === true;
  };
  const inspect = (node: ts.Node): void => {
    if (written) return;
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      mentions(node.left)
    )
      written = true;
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      mentions(node.operand)
    )
      written = true;
    ts.forEachChild(node, inspect);
  };
  files.forEach(inspect);
  return written;
}

export function isConstDeclaration(declaration: ts.VariableDeclaration): boolean {
  return (
    ts.isVariableDeclarationList(declaration.parent) &&
    !!(declaration.parent.flags & ts.NodeFlags.Const)
  );
}

/** Caller positions remain live while a helper runs; a later declaration is not initialized. */
export type InitializationPoints = ReadonlyMap<ts.Node, number>;

export function executionScope(node: ts.Node): ts.Node {
  let parent = node.parent;
  while (parent && !ts.isSourceFile(parent) && !ts.isFunctionLike(parent)) parent = parent.parent;
  return parent ?? node.getSourceFile();
}

export function atExecutionPoint(
  node: ts.Node,
  inherited: InitializationPoints = new Map()
): InitializationPoints {
  const points = new Map(inherited);
  points.set(executionScope(node), node.getStart());
  return points;
}

const dependencyCache = new WeakMap<ts.TypeChecker, Map<ts.SourceFile, Set<ts.SourceFile>>>();
function valueDependencies(source: ts.SourceFile, checker: ts.TypeChecker): Set<ts.SourceFile> {
  let cache = dependencyCache.get(checker);
  if (!cache) dependencyCache.set(checker, (cache = new Map()));
  const cached = cache.get(source);
  if (cached) return cached;
  const result = new Set<ts.SourceFile>();
  const visit = (file: ts.SourceFile): void => {
    for (const statement of file.statements) {
      if (
        (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        (ts.isExportDeclaration(statement) && statement.isTypeOnly) ||
        (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly)
      )
        continue;
      const bindings = ts.isImportDeclaration(statement)
        ? statement.importClause?.namedBindings
        : statement.exportClause;
      if (
        bindings &&
        (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((element) => element.isTypeOnly) &&
        !(ts.isImportDeclaration(statement) && statement.importClause?.name)
      )
        continue;
      const imported = checker
        .getSymbolAtLocation(statement.moduleSpecifier)
        ?.declarations?.find(ts.isSourceFile);
      if (!imported || imported.isDeclarationFile || result.has(imported)) continue;
      result.add(imported);
      visit(imported);
    }
  };
  visit(source);
  cache.set(source, result);
  return result;
}

/** Unknown module order is accepted only outside a value-import cycle. */
export function isBindingInitialized(
  declaration: ts.Declaration,
  points: InitializationPoints,
  checker: ts.TypeChecker
): boolean {
  if (ts.isFunctionDeclaration(declaration)) return !!declaration.body;
  const owner = executionScope(declaration);
  const position = points.get(owner);
  if (position !== undefined) return declaration.end <= position;
  if (ts.isSourceFile(owner)) {
    for (const active of points.keys()) {
      if (
        ts.isSourceFile(active) &&
        active !== owner &&
        valueDependencies(owner, checker).has(active)
      )
        return false;
    }
  }
  return true;
}
