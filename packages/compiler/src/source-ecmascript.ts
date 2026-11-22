import ts from 'typescript';

/** A syntactic name only; the caller must prove its root is unshadowed. */
export function ecmaSourcePath(node: ts.Node): readonly string[] | undefined {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node) && !node.questionDotToken) {
    const parent = ecmaSourcePath(node.expression);
    return parent ? [...parent, node.name.text] : undefined;
  }
  if (ts.isQualifiedName(node)) {
    const parent = ecmaSourcePath(node.left);
    return parent ? [...parent, node.right.text] : undefined;
  }
  return undefined;
}
