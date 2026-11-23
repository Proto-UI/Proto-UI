import ts from 'typescript';
import { isSourceFunction, unwrapSourceExpression } from './source-syntax';

type Declaration = ts.FunctionDeclaration | ts.VariableDeclaration;

/**
 * Establish a conservative, source-bound proof before admitting closure bodies.
 *
 * A function declaration/expression creates no body or default-parameter effects.
 * A private chain of already-initialized const aliases is inert too. Nothing here
 * evaluates or rewrites source: the original nodes stay in the frontend's binding
 * table and the complete source bytes remain in PrototypeIR.sourceFiles. A body
 * is deferred only when every possible reference is inside the same unused
 * declaration closure. Calls, public escapes, property observations, mutable
 * aliases and unclassified uses conservatively demand the complete declaration.
 *
 * Identifier collection deliberately over-approximates nested lexical scopes and
 * type positions. A same-spelled shadow can retain work, never erase a real use.
 * This is an admission proof, not general JavaScript dead-code elimination.
 */
export function dormantSourceDeclarations(
  statements: readonly ts.Statement[]
): ReadonlySet<Declaration> {
  const candidates = new Map<string, Declaration>();
  const aliases: ts.VariableDeclaration[] = [];
  for (const statement of statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)
      candidates.set(statement.name.text, statement);
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || declaration.type)
        continue;
      const initializer = unwrapSourceExpression(declaration.initializer);
      let plain = declaration.initializer;
      while (ts.isParenthesizedExpression(plain)) plain = plain.expression;
      // An authored type view is an admission obligation of the declaration,
      // independently of whether the closure is eventually invoked.
      if (plain !== initializer) continue;
      if (isSourceFunction(initializer)) candidates.set(declaration.name.text, declaration);
      else if (
        ts.isIdentifier(initializer) &&
        (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      )
        aliases.push(declaration);
    }
  }
  // A forward read of a const/let is observable even when its value is unused.
  // Hoisted function declarations, unlike lexical initializers, are ready at entry.
  for (;;) {
    const size = candidates.size;
    for (const declaration of aliases) {
      const initializer = unwrapSourceExpression(declaration.initializer!);
      if (!ts.isIdentifier(initializer)) continue;
      const target = candidates.get(initializer.text);
      if (target && (ts.isFunctionDeclaration(target) || target.pos < declaration.pos))
        candidates.set((declaration.name as ts.Identifier).text, declaration);
    }
    if (candidates.size === size) break;
  }
  const dependencies = new Map<Declaration, Set<Declaration>>();
  const reached = new Set<Declaration>();
  const observe = (node: ts.Node, references: Set<Declaration>): void => {
    if (ts.isIdentifier(node)) {
      const binding = candidates.get(node.text);
      if (binding) references.add(binding);
    }
    ts.forEachChild(node, (child) => observe(child, references));
  };
  const inspect = (node: ts.Node): void => {
    const declaration =
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
        ? candidates.get(node.name.text)
        : undefined;
    if (declaration === node) {
      const references = new Set<Declaration>();
      observe(node, references);
      dependencies.set(declaration, references);
    } else
      ts.forEachChild(node, (child) => {
        if (ts.isIdentifier(child)) {
          const binding = candidates.get(child.text);
          if (binding) reached.add(binding);
        }
        inspect(child);
      });
  };
  statements.forEach(inspect);
  for (const declaration of reached)
    for (const dependency of dependencies.get(declaration) ?? []) reached.add(dependency);
  return new Set([...candidates.values()].filter((declaration) => !reached.has(declaration)));
}
