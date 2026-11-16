import ts from 'typescript';

/** These utilities transform compiler-owned support templates only. Authored
 * source must pass the ordinary parser/IR pipeline and never enters here. */
export function parseSupportTemplate(
  source: string,
  filename = 'native-support.ts'
): ts.SourceFile {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const diagnostics = (file as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (diagnostics?.length)
    throw new Error(
      `Invalid compiler support template ${filename}: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, '\n')}`
    );
  return file;
}

export function declarationNames(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : []
    );
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  )
    return [statement.name.text];
  return [];
}

function exported(statement: ts.Statement): ts.Statement {
  const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
  if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return statement;
  const next = [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword), ...modifiers];
  if (ts.isVariableStatement(statement))
    return ts.factory.updateVariableStatement(statement, next, statement.declarationList);
  if (ts.isFunctionDeclaration(statement))
    return ts.factory.updateFunctionDeclaration(
      statement,
      next,
      statement.asteriskToken,
      statement.name,
      statement.typeParameters,
      statement.parameters,
      statement.type,
      statement.body
    );
  if (ts.isTypeAliasDeclaration(statement))
    return ts.factory.updateTypeAliasDeclaration(
      statement,
      next,
      statement.name,
      statement.typeParameters,
      statement.type
    );
  if (ts.isInterfaceDeclaration(statement))
    return ts.factory.updateInterfaceDeclaration(
      statement,
      next,
      statement.name,
      statement.typeParameters,
      statement.heritageClauses,
      statement.members
    );
  throw new Error('Unsupported exported support declaration');
}

/** Select symbol declarations structurally, independent of formatting, source
 * order and the spelling of a neighbouring declaration. */
export function selectSupportDeclarations(
  source: string,
  names: readonly string[],
  makeExported = false
): string {
  const file = parseSupportTemplate(source);
  const wanted = new Set(names),
    seen = new Set<string>();
  const statements: ts.Statement[] = [];
  for (const statement of file.statements) {
    const declared = declarationNames(statement);
    if (!declared.some((name) => wanted.has(name))) continue;
    if (declared.some((name) => !wanted.has(name)))
      throw new Error('Support declaration selection must include every binding in a declaration');
    for (const name of declared) {
      if (seen.has(name)) throw new Error(`Duplicate support declaration: ${name}`);
      seen.add(name);
    }
    statements.push(makeExported ? exported(statement) : statement);
  }
  for (const name of wanted)
    if (!seen.has(name)) throw new Error(`Missing support declaration: ${name}`);
  return printSupport(file, statements);
}

export function omitSupportDeclarations(source: string, names: readonly string[]): string {
  const file = parseSupportTemplate(source),
    removed = new Set(names);
  return printSupport(
    file,
    file.statements.filter(
      (statement) => !declarationNames(statement).some((name) => removed.has(name))
    )
  );
}

export function printSupport(
  file: ts.SourceFile,
  statements: readonly ts.Statement[] = file.statements
): string {
  return ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printFile(ts.factory.updateSourceFile(file, statements));
}

/** Retarget explicit ES module edges, never arbitrary source strings or component code. */
export function mapSupportImports(source: string, paths: ReadonlyMap<string, string>): string {
  const file = parseSupportTemplate(source);
  const result = ts.transform(file, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          paths.has(node.moduleSpecifier.text)
        )
          return ts.factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            ts.factory.createStringLiteral(paths.get(node.moduleSpecifier.text)!),
            node.attributes
          );
        if (
          ts.isExportDeclaration(node) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          paths.has(node.moduleSpecifier.text)
        )
          return ts.factory.updateExportDeclaration(
            node,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            ts.factory.createStringLiteral(paths.get(node.moduleSpecifier.text)!),
            node.attributes
          );
        return ts.visitEachChild(node, visit, context);
      };
      return (source) => ts.visitNode(source, visit) as ts.SourceFile;
    },
  ]);
  try {
    return printSupport(result.transformed[0]);
  } finally {
    result.dispose();
  }
}
