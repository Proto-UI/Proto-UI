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
