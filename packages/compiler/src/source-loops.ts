import ts from 'typescript';
import { rejectNode } from './source-syntax';

function ranged<T extends ts.Node>(value: T, source: ts.Node): T {
  return ts.setTextRange(value, source);
}
function parented<T extends ts.Node>(value: T, parent: ts.Node): T {
  (value as ts.Node & { parent: ts.Node }).parent = parent;
  (
    ts as typeof ts & { setParentRecursive(node: ts.Node, incremental?: boolean): void }
  ).setParentRecursive(value, true);
  return value;
}
function bindingNames(name: ts.BindingName, names: Set<string>): void {
  if (ts.isIdentifier(name)) names.add(name.text);
  else
    for (const element of name.elements)
      if (!ts.isOmittedExpression(element)) bindingNames(element.name, names);
}
function blockBindings(statements: readonly ts.Statement[]): Set<string> {
  const names = new Set<string>();
  for (const statement of statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        bindingNames(declaration.name, names);
    else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    )
      names.add(statement.name.text);
  }
  return names;
}
function withoutBindings(
  values: ReadonlyMap<string, ts.Expression>,
  names: ReadonlySet<string>
): ReadonlyMap<string, ts.Expression> {
  return [...names].some((name) => values.has(name))
    ? new Map([...values].filter(([name]) => !names.has(name)))
    : values;
}

/** Substitute only value reads resolved to this iteration, never nested bindings. */
export function replaceStaticBindings<T extends ts.Node>(
  node: T,
  values: ReadonlyMap<string, ts.Expression>,
  parent: ts.Node = node.parent
): T {
  // A sibling lexical declaration shadows the outer binding throughout its
  // block, including reads before initialization and closure declarations.
  const initial =
    node.parent && ts.isBlock(node.parent)
      ? withoutBindings(values, blockBindings(node.parent.statements))
      : values;
  const result = ts.transform(node, [
    (context) => {
      const clone = <N extends ts.Node>(node: N): N =>
        ts.setTextRange(
          (
            ts.factory as typeof ts.factory & { cloneNode<N extends ts.Node>(node: N): N }
          ).cloneNode(node),
          node
        );
      const copy = (node: ts.Node): ts.Node => ts.visitEachChild(clone(node), copy, context);
      const visit = (node: ts.Node, outer: ReadonlyMap<string, ts.Expression>): ts.Node => {
        // Every expanded iteration owns its lexical declarations, including a
        // shadowed block which needs no value substitution at all. Cloning keeps
        // their synthesized binding identities distinct at the authored span.
        if (!outer.size || ts.isTypeNode(node)) return copy(node);
        const names = new Set<string>();
        if (ts.isBlock(node)) for (const name of blockBindings(node.statements)) names.add(name);
        if (ts.isFunctionLike(node)) {
          for (const parameter of node.parameters) bindingNames(parameter.name, names);
          if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name)
            names.add(node.name.text);
        }
        if (ts.isCatchClause(node) && node.variableDeclaration)
          bindingNames(node.variableDeclaration.name, names);
        if (
          (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) &&
          node.initializer &&
          ts.isVariableDeclarationList(node.initializer)
        )
          for (const declaration of node.initializer.declarations)
            bindingNames(declaration.name, names);
        const active = withoutBindings(outer, names);
        if (!active.size) return copy(node);
        if (ts.isShorthandPropertyAssignment(node) && active.has(node.name.text))
          return ranged(
            ts.factory.createPropertyAssignment(
              clone(node.name),
              ranged(clone(active.get(node.name.text)!), node.name)
            ),
            node
          );
        if (ts.isIdentifier(node) && active.has(node.text)) {
          const parent = node.parent;
          if (
            parent &&
            ((ts.isPropertyAccessExpression(parent) && parent.name === node) ||
              ((ts.isPropertyAssignment(parent) ||
                ts.isMethodDeclaration(parent) ||
                ts.isGetAccessorDeclaration(parent) ||
                ts.isSetAccessorDeclaration(parent) ||
                ts.isPropertyDeclaration(parent)) &&
                parent.name === node) ||
              (ts.isBindingElement(parent) && parent.propertyName === node))
          )
            return clone(node);
          return ranged(clone(active.get(node.text)!), node);
        }
        return ts.visitEachChild(clone(node), (child) => visit(child, active), context);
      };
      return (node) => ts.visitNode(node, (child) => visit(child, initial)) as T;
    },
  ]);
  const value = result.transformed[0];
  result.dispose();
  return parented(value, parent);
}

/** A static iteration's continue exits only that iteration, including its finally blocks. */
export function lowerStaticIterationContinue(
  nodes: readonly ts.Statement[],
  source: ts.ForOfStatement
): readonly ts.Statement[] {
  let hasContinue = false,
    incompatible: ts.Node | undefined;
  const nestedOwner = (node: ts.Node) =>
    ts.isFunctionLike(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node);
  const inspect = (node: ts.Node): void => {
    if (nestedOwner(node)) return;
    if (ts.isContinueStatement(node)) {
      hasContinue = true;
      if (node.label) incompatible = node;
    }
    if (ts.isReturnStatement(node) || ts.isBreakStatement(node)) incompatible = node;
    ts.forEachChild(node, inspect);
  };
  nodes.forEach(inspect);
  if (!hasContinue) return nodes;
  if (incompatible)
    rejectNode(
      incompatible,
      'PUI1004',
      'Static continue normalization cannot cross a return, break or labelled jump.'
    );
  const block = ranged(ts.factory.createBlock(nodes, true), source.statement);
  const result = ts.transform(block, [
    (context) => {
      const visit = (node: ts.Node): ts.Node => {
        if (nestedOwner(node)) return node;
        if (ts.isContinueStatement(node)) return ranged(ts.factory.createReturnStatement(), node);
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.Block;
    },
  ]);
  const body = result.transformed[0];
  result.dispose();
  const fn = ranged(
    ts.factory.createArrowFunction(
      undefined,
      undefined,
      [],
      undefined,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      body
    ),
    source
  );
  const call = ranged(
    ts.factory.createCallExpression(
      ranged(ts.factory.createParenthesizedExpression(fn), source),
      undefined,
      []
    ),
    source
  );
  return [parented(ranged(ts.factory.createExpressionStatement(call), source), source.parent)];
}

/** Normalize a closed ordinary loop shape. No author code is evaluated. */
export function lowerOrdinaryLoops(
  nodes: readonly ts.Statement[],
  nextName: () => string,
  isGlobal: (name: string) => boolean
): readonly ts.Statement[] {
  const out: ts.Statement[] = [],
    f = ts.factory;
  const variable = (
    name: string,
    value: ts.Expression,
    source: ts.Node,
    mutable = false,
    type?: ts.TypeNode
  ) =>
    parented(
      ranged(
        f.createVariableStatement(
          undefined,
          ranged(
            f.createVariableDeclarationList(
              [
                ranged(
                  f.createVariableDeclaration(
                    ranged(f.createIdentifier(name), source),
                    undefined,
                    type,
                    value
                  ),
                  source
                ),
              ],
              mutable ? ts.NodeFlags.Let : ts.NodeFlags.Const
            ),
            source
          )
        ),
        source
      ),
      source.parent
    );
  for (const node of nodes) {
    if (ts.isForStatement(node)) {
      const list = node.initializer;
      if (
        !list ||
        !ts.isVariableDeclarationList(list) ||
        !(list.flags & ts.NodeFlags.Let) ||
        list.declarations.length !== 1 ||
        !ts.isIdentifier(list.declarations[0].name) ||
        !list.declarations[0].initializer
      )
        rejectNode(
          node,
          'PUI1004',
          'A counting loop requires one initialized block-scoped let binding.'
        );
      const declaration = list.declarations[0],
        original = (declaration.name as ts.Identifier).text,
        name = nextName();
      const inspect = (part: ts.Node, nested = false): void => {
        const child = nested || ts.isFunctionLike(part);
        if (child && ts.isIdentifier(part) && part.text === original)
          rejectNode(
            part,
            'PUI1004',
            'Counting-loop closures need an explicit per-iteration value binding.'
          );
        if (ts.isBreakStatement(part) || ts.isContinueStatement(part))
          rejectNode(part, 'PUI1004', 'Counting-loop abrupt jumps are not yet admitted.');
        if (ts.isVariableDeclaration(part)) {
          const names = new Set<string>();
          bindingNames(part.name, names);
          if (names.has(original))
            rejectNode(
              part,
              'PUI1004',
              'Counting-loop bodies cannot redeclare the normalized index.'
            );
        }
        ts.forEachChild(part, (part) => inspect(part, child));
      };
      inspect(node.statement);
      const replacements = new Map([
        [original, ranged(f.createIdentifier(name), declaration.name)],
      ]);
      const body = ts.isBlock(node.statement) ? [...node.statement.statements] : [node.statement];
      if (node.incrementor)
        body.push(ranged(f.createExpressionStatement(node.incrementor), node.incrementor));
      const loop = ranged(
        f.createWhileStatement(
          node.condition ?? ranged(f.createTrue(), node),
          ranged(f.createBlock(body, true), node.statement)
        ),
        node
      );
      parented(loop, node.parent);
      out.push(
        variable(name, declaration.initializer!, declaration, true, declaration.type),
        replaceStaticBindings(loop, replacements)
      );
      continue;
    }
    if (
      ts.isForOfStatement(node) &&
      ts.isVariableDeclarationList(node.initializer) &&
      node.initializer.flags & ts.NodeFlags.Const &&
      node.initializer.declarations.length === 1 &&
      ts.isArrayBindingPattern(node.initializer.declarations[0].name)
    ) {
      const pattern = node.initializer.declarations[0].name as ts.ArrayBindingPattern;
      let source = node.expression;
      while (
        ts.isParenthesizedExpression(source) ||
        ts.isAsExpression(source) ||
        ts.isSatisfiesExpression(source)
      )
        source = source.expression;
      if (
        !node.awaitModifier &&
        ts.isArrayLiteralExpression(source) &&
        pattern.elements.every(
          (element) =>
            !ts.isOmittedExpression(element) &&
            ts.isIdentifier(element.name) &&
            !element.initializer &&
            !element.dotDotDotToken
        ) &&
        source.elements.every(
          (row) =>
            ts.isArrayLiteralExpression(row) &&
            row.elements.every(
              (element) => !ts.isOmittedExpression(element) && !ts.isSpreadElement(element)
            )
        )
      ) {
        const body = ts.isBlock(node.statement) ? [...node.statement.statements] : [node.statement];
        if (
          body.some(
            (statement) => ts.isVariableStatement(statement) || ts.isFunctionDeclaration(statement)
          )
        )
          rejectNode(
            node,
            'PUI1004',
            'Static tuple loop bodies cannot introduce repeated lexical declarations.'
          );
        const rows: ReadonlyMap<string, ts.Expression>[] = [];
        // Evaluate every authored element before any iteration body, matching
        // construction of the literal tuple list. Each source value is retained
        // once; closures and StyleHandle identities are never re-created.
        for (const row of source.elements as ts.NodeArray<ts.ArrayLiteralExpression>) {
          const values = row.elements.map((element) => {
            const name = nextName();
            out.push(variable(name, element, element));
            return ranged(f.createIdentifier(name), element);
          });
          rows.push(
            new Map(
              pattern.elements.map((element, index) => {
                const name = (element as ts.BindingElement).name as ts.Identifier;
                return [name.text, values[index] ?? ranged(f.createIdentifier('undefined'), name)];
              })
            )
          );
        }
        for (const values of rows)
          out.push(...body.map((statement) => replaceStaticBindings(statement, values)));
        continue;
      }
      const call = node.expression;
      if (
        node.awaitModifier ||
        pattern.elements.length !== 2 ||
        pattern.elements.some(
          (element) =>
            ts.isOmittedExpression(element) ||
            !ts.isIdentifier(element.name) ||
            element.dotDotDotToken ||
            element.initializer
        ) ||
        !ts.isCallExpression(call) ||
        !ts.isPropertyAccessExpression(call.expression) ||
        !ts.isIdentifier(call.expression.expression) ||
        call.expression.expression.text !== 'Object' ||
        !isGlobal('Object') ||
        call.expression.name.text !== 'entries' ||
        call.arguments.length !== 1 ||
        !ts.isObjectLiteralExpression(call.arguments[0])
      ) {
        out.push(node);
        continue;
      }
      const object = call.arguments[0],
        name = nextName();
      const properties = object.properties.map((property) => {
        if (
          (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
          (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
        )
          rejectNode(property, 'PUI1004', 'Static entry iteration needs finite own data fields.');
        return property.name.text;
      });
      if (new Set(properties).size !== properties.length)
        rejectNode(object, 'PUI1004', 'Static entry iteration cannot contain duplicate fields.');
      out.push(variable(name, object, object));
      const key = (pattern.elements[0] as ts.BindingElement).name as ts.Identifier;
      const item = (pattern.elements[1] as ts.BindingElement).name as ts.Identifier;
      const body = ts.isBlock(node.statement) ? node.statement.statements : [node.statement];
      if (
        body.some(
          (statement) => ts.isVariableStatement(statement) || ts.isFunctionDeclaration(statement)
        )
      )
        rejectNode(
          node,
          'PUI1004',
          'Static entry loop bodies cannot introduce repeated lexical declarations.'
        );
      for (const property of properties) {
        const local = nextName();
        out.push(
          variable(
            local,
            ranged(
              f.createElementAccessExpression(
                ranged(f.createIdentifier(name), object),
                ranged(f.createStringLiteral(property), object)
              ),
              object
            ),
            item
          )
        );
        const replacements = new Map<string, ts.Expression>([
          [key.text, ranged(f.createStringLiteral(property), key)],
          [item.text, ranged(f.createIdentifier(local), item)],
        ]);
        out.push(...body.map((statement) => replaceStaticBindings(statement, replacements)));
      }
      continue;
    }
    out.push(node);
  }
  return out;
}
