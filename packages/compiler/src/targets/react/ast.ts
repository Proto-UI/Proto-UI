import ts from 'typescript';
import type { ScalarType, SourceSpan } from '../component-ir.ts';

export const f = ts.factory;
export const id = (name: string) => f.createIdentifier(name);
export const str = (value: string) => f.createStringLiteral(value);
export const typeRef = (name: string, ...args: ts.TypeNode[]) =>
  f.createTypeReferenceNode(name, args);
export const readonly = () => f.createModifier(ts.SyntaxKind.ReadonlyKeyword);
export const block = (statements: readonly ts.Statement[]) => f.createBlock(statements, true);

export function valueType(type: ScalarType): ts.TypeNode {
  if (type === 'tokens') {
    return f.createTypeOperatorNode(
      ts.SyntaxKind.ReadonlyKeyword,
      f.createArrayTypeNode(f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword))
    );
  }
  const keywords = {
    bool: ts.SyntaxKind.BooleanKeyword,
    number: ts.SyntaxKind.NumberKeyword,
    text: ts.SyntaxKind.StringKeyword,
    unit: ts.SyntaxKind.VoidKeyword,
  } as const;
  return f.createKeywordTypeNode(keywords[type]);
}

export function identifierText(name: string): boolean {
  let first = true;
  for (const character of name) {
    const code = character.codePointAt(0)!;
    if (!(first ? ts.isIdentifierStart : ts.isIdentifierPart)(code, ts.ScriptTarget.Latest))
      return false;
    first = false;
  }
  return !first;
}

const nameScanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard);

export class Names {
  readonly #taken: Set<string>;
  readonly #parent: Names | undefined;
  #suffixes?: Map<string, number>;

  constructor(taken?: Iterable<string>, parent?: Names) {
    this.#taken = new Set(taken);
    this.#parent = parent;
  }

  scope(): Names {
    return new Names(undefined, this);
  }

  #has(name: string): boolean {
    for (let scope: Names | undefined = this; scope; scope = scope.#parent) {
      if (scope.#taken.has(name)) return true;
    }
    return false;
  }

  take(hint: string): string {
    let base = '';
    for (const character of hint) {
      const code = character.codePointAt(0)!;
      if (!base && !ts.isIdentifierStart(code, ts.ScriptTarget.Latest)) base = '_';
      base += ts.isIdentifierPart(code, ts.ScriptTarget.Latest) ? character : '_';
    }
    if (!base) base = '_';
    nameScanner.setText(base);
    const token = nameScanner.scan();
    const reserved =
      token >= ts.SyntaxKind.FirstReservedWord && token <= ts.SyntaxKind.LastFutureReservedWord;
    if (
      reserved ||
      token === ts.SyntaxKind.AwaitKeyword ||
      base === 'arguments' ||
      base === 'eval' ||
      base === '__proto__'
    ) {
      base = `_${base}`;
    }
    let name = base;
    if (this.#has(name)) {
      let index = this.#suffixes?.get(base) ?? 2;
      do {
        name = `${base}_${index++}`;
      } while (this.#has(name));
      (this.#suffixes ??= new Map()).set(base, index);
    }
    this.#taken.add(name);
    return name;
  }
}

export function key(name: string): ts.PropertyName {
  if (name === '__proto__') return f.createComputedPropertyName(str(name));
  return identifierText(name) ? id(name) : str(name);
}

/** Modern ES modules preserve an arbitrary public spelling through an import alias. */
export function semanticExport(
  local: string,
  publicName: string,
  typeOnly = false
): ts.ExportSpecifier {
  const name = identifierText(publicName) ? id(publicName) : str(publicName);
  return f.createExportSpecifier(typeOnly, local === publicName ? undefined : id(local), name);
}

export function member(receiver: ts.Expression, name: string): ts.Expression {
  return identifierText(name)
    ? f.createPropertyAccessExpression(receiver, name)
    : f.createElementAccessExpression(receiver, str(name));
}

export const call = (callee: ts.Expression, ...args: ts.Expression[]) =>
  f.createCallExpression(callee, undefined, args);
export const param = (name: string, type?: ts.TypeNode) =>
  f.createParameterDeclaration(undefined, undefined, name, undefined, type);
export const property = (name: string, value: ts.Expression) =>
  f.createPropertyAssignment(key(name), value);
export const object = (fields: readonly ts.ObjectLiteralElementLike[]) =>
  f.createObjectLiteralExpression(fields, fields.length > 1);
export const arrow = (params: readonly ts.ParameterDeclaration[], body: ts.ConciseBody) =>
  f.createArrowFunction(
    undefined,
    undefined,
    params,
    undefined,
    f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    body
  );

export function constDecl(
  name: string | ts.BindingName,
  value: ts.Expression
): ts.VariableStatement {
  const binding = f.createVariableDeclaration(name, undefined, undefined, value);
  return f.createVariableStatement(
    undefined,
    f.createVariableDeclarationList([binding], ts.NodeFlags.Const)
  );
}

export function declaration(
  name: string,
  params: readonly ts.ParameterDeclaration[],
  result: ts.TypeNode | undefined,
  body: readonly ts.Statement[]
): ts.FunctionDeclaration {
  return f.createFunctionDeclaration(
    undefined,
    undefined,
    name,
    undefined,
    params,
    result,
    block(body)
  );
}

export function signature(name: string, type: ts.TypeNode, optional = false): ts.PropertySignature {
  const question = optional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined;
  return f.createPropertySignature([readonly()], key(name), question, type);
}

export function quotedCommentText(text: string): string {
  return JSON.stringify(text)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function atSource<T extends ts.Node>(node: T, source: SourceSpan): T {
  return ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.SingleLineCommentTrivia,
    ` ${quotedCommentText(source.file)}:${source.start}-${source.end}`,
    true
  );
}

export function atViewSource<T extends ts.Expression>(node: T, source: SourceSpan): T {
  const file = quotedCommentText(source.file).replace(/\*\//g, '*\\u002f');
  return ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    ` ${file}:${source.start}-${source.end} `,
    false
  );
}

export function sourceObject(source: SourceSpan): ts.ObjectLiteralExpression {
  return object([
    property('file', str(source.file)),
    property('start', f.createNumericLiteral(source.start)),
    property('end', f.createNumericLiteral(source.end)),
  ]);
}
