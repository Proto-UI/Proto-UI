import ts from 'typescript';
import { nativeSupportFeatures, type NativeSupportFeature, type NativeSupportPlan } from './plan';
import { parseSupportTemplate, printSupport } from './template-ast';

const members: Readonly<Record<string, NativeSupportFeature>> = {
  event: 'event',
  asTrigger: 'trigger',
  asFocusable: 'focus',
  asAccessible: 'a11y',
  asControlLabel: 'control-label',
  hasAuthoredControlLabelName: 'control-label',
  beginControlLabelName: 'control-label',
  controlLabelAnatomyScope: 'control-label',
  subscribeControlLabelAnatomy: 'control-label',
  anatomy: 'anatomy',
  accessible: 'a11y',
  part: 'part-relationships',
  positioning: 'positioning',
  asFocusEntry: 'entry',
  asFocusScope: 'scope',
  asFocusRoving: 'roving',
  asCollection: 'collection',
  asCollectionItem: 'collection',
  asBoundary: 'boundary',
  asHitParticipation: 'hit',
  asOverlay: 'overlay',
  asScrollSurface: 'scroll',
  asTextControl: 'text',
  asImageView: 'image',
  asTableStructure: 'table',
  configureFocusable: 'focus',
  setFocusDisabled: 'focus',
  setNavParticipation: 'focus',
  setRovingStatus: 'focus',
  canFocus: 'focus',
  focus: 'focus',
  blur: 'focus',
};
function memberName(node: ts.Node): string | undefined {
  const name = (node as ts.NamedDeclaration).name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}
function bool(node: ts.Expression): boolean | undefined {
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}
/** Compile-time feature guards are erased before emitting source. No runtime plan is shipped. */
function specialize(source: string, plan: NativeSupportPlan): string {
  const file = parseSupportTemplate(source);
  const features = new Set(plan.features);
  const result = ts.transform(file, [
    (context) => {
      const factory = context.factory;
      function keepMember(node: ts.Node) {
        const feature = members[memberName(node) ?? ''];
        return !feature || features.has(feature);
      }
      const visit: ts.Visitor = (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === '__nativeFeature'
        ) {
          const feature = node.arguments[0];
          if (
            node.arguments.length !== 1 ||
            !ts.isStringLiteral(feature) ||
            !nativeSupportFeatures.includes(feature.text as NativeSupportFeature)
          )
            throw new Error(
              'Native feature guards require one registered literal dependency name.'
            );
          return features.has(feature.text as NativeSupportFeature)
            ? factory.createTrue()
            : factory.createFalse();
        }
        let next = ts.visitEachChild(node, visit, context);
        if (ts.isParenthesizedExpression(next) && bool(next.expression) !== undefined)
          return next.expression;
        if (ts.isBinaryExpression(next)) {
          const left = bool(next.left),
            right = bool(next.right);
          if (next.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
            if (left === false) return factory.createFalse();
            if (left === true) return next.right;
            if (right === true) return next.left;
          }
          if (next.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            if (left === true) return factory.createTrue();
            if (left === false) return next.right;
            if (right === false) return next.left;
          }
        }
        if (ts.isConditionalExpression(next) && bool(next.condition) !== undefined)
          return bool(next.condition) ? next.whenTrue : next.whenFalse;
        if (ts.isIfStatement(next) && bool(next.expression) !== undefined)
          return bool(next.expression) ? next.thenStatement : next.elseStatement;
        if (
          ts.isInterfaceDeclaration(next) &&
          ['NativeModuleCapabilities', 'NativeAccessibleExtension'].includes(next.name.text)
        )
          return factory.updateInterfaceDeclaration(
            next,
            next.modifiers,
            next.name,
            next.typeParameters,
            next.heritageClauses,
            next.members.filter(keepMember)
          );
        if (
          ts.isTypeAliasDeclaration(next) &&
          next.name.text === 'NativeInteraction' &&
          ts.isIntersectionTypeNode(next.type)
        ) {
          const types = next.type.types.map((type) =>
            ts.isTypeLiteralNode(type)
              ? factory.updateTypeLiteralNode(
                  type,
                  factory.createNodeArray(type.members.filter(keepMember))
                )
              : type
          );
          return factory.updateTypeAliasDeclaration(
            next,
            next.modifiers,
            next.name,
            next.typeParameters,
            factory.updateIntersectionTypeNode(next.type, factory.createNodeArray(types))
          );
        }
        if (
          ts.isVariableDeclaration(next) &&
          ts.isIdentifier(next.name) &&
          ['capabilities', 'accessible'].includes(next.name.text) &&
          next.initializer &&
          ts.isObjectLiteralExpression(next.initializer)
        )
          return factory.updateVariableDeclaration(
            next,
            next.name,
            next.exclamationToken,
            next.type,
            factory.updateObjectLiteralExpression(
              next.initializer,
              next.initializer.properties.filter(keepMember)
            )
          );
        if (
          ts.isReturnStatement(next) &&
          next.expression &&
          ts.isObjectLiteralExpression(next.expression) &&
          next.expression.properties.some((member) => memberName(member) === 'asTrigger')
        )
          return factory.updateReturnStatement(
            next,
            factory.updateObjectLiteralExpression(
              next.expression,
              next.expression.properties.filter(keepMember)
            )
          );
        return next;
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

/** Symbol-based declaration closure; lexical shadowing cannot retain or remove another binding. */
function prune(source: string, factoryName: string, publicFunctions: readonly string[]): string {
  const path = '/native-support.ts';
  const sourceFile = parseSupportTemplate(source, path);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    noLib: true,
    noResolve: true,
  };
  // This analysis has exactly one compiler-owned virtual file. Constructing a
  // filesystem-backed host first needlessly reads ts.sys (absent in a browser
  // VM) and gives an in-memory operation a latent ambient I/O dependency.
  const host: ts.CompilerHost = {
    getSourceFile: (filename) => (filename === path ? sourceFile : undefined),
    fileExists: (filename) => filename === path,
    readFile: (filename) => (filename === path ? source : undefined),
    getDefaultLibFileName: () => '/lib.d.ts',
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    getCanonicalFileName: (filename) => filename,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    writeFile: () => {
      throw new Error('Native support analysis never emits host files.');
    },
  };
  const program = ts.createProgram([path], options, host),
    checker = program.getTypeChecker();
  const symbolOf = (node: ts.Node) =>
    ts.isIdentifier(node) ? checker.getSymbolAtLocation(node) : undefined;
  function refs(node: ts.Node): Set<ts.Symbol> {
    const result = new Set<ts.Symbol>();
    const visit = (current: ts.Node) => {
      const symbol = ts.isShorthandPropertyAssignment(current)
        ? checker.getShorthandAssignmentValueSymbol(current)
        : symbolOf(current);
      if (symbol) result.add(symbol);
      ts.forEachChild(current, visit);
    };
    visit(node);
    return result;
  }
  function split(statements: readonly ts.Statement[]): ts.Statement[] {
    return statements.flatMap((statement) =>
      ts.isVariableStatement(statement) && statement.declarationList.declarations.length > 1
        ? statement.declarationList.declarations.map((declaration) =>
            ts.factory.updateVariableStatement(
              statement,
              statement.modifiers,
              ts.factory.updateVariableDeclarationList(statement.declarationList, [declaration])
            )
          )
        : [statement]
    );
  }
  function declared(statement: ts.Statement): ts.Symbol[] {
    if (ts.isVariableStatement(statement))
      return statement.declarationList.declarations.flatMap((declaration) => {
        const symbol = symbolOf(declaration.name);
        return symbol ? [symbol] : [];
      });
    const name =
      ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
        ? statement.name
        : undefined;
    const symbol = name && symbolOf(name);
    return symbol ? [symbol] : [];
  }
  function closure(statements: readonly ts.Statement[], top: boolean): ts.Statement[] {
    const list = split(statements),
      table = new Map<ts.Symbol, ts.Statement>();
    for (const statement of list)
      for (const symbol of declared(statement)) table.set(symbol, statement);
    const kept = new Set<ts.Statement>();
    const queue: ts.Statement[] = [];
    function retain(statement: ts.Statement) {
      if (!kept.has(statement)) {
        kept.add(statement);
        queue.push(statement);
      }
    }
    for (const statement of list) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) continue;
      const declaration = declared(statement);
      if (
        !declaration.length ||
        (top &&
          (ts.isTypeAliasDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement) ||
            (ts.isFunctionDeclaration(statement) &&
              publicFunctions.includes(statement.name?.text ?? ''))))
      )
        retain(statement);
    }
    while (queue.length)
      for (const ref of refs(queue.pop()!)) {
        const dependency = table.get(ref);
        if (dependency) retain(dependency);
      }
    const used = new Set<ts.Symbol>();
    for (const statement of kept) for (const ref of refs(statement)) used.add(ref);
    return list.flatMap((statement) => {
      if (ts.isExportDeclaration(statement)) return [statement];
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (!clause) return [statement];
        const bindings = clause.namedBindings;
        const name = clause.name && used.has(symbolOf(clause.name)!) ? clause.name : undefined;
        const selected =
          bindings && ts.isNamedImports(bindings)
            ? ts.factory.updateNamedImports(
                bindings,
                bindings.elements.filter((element) => used.has(symbolOf(element.name)!))
              )
            : bindings;
        if (!name && (!selected || (ts.isNamedImports(selected) && !selected.elements.length)))
          return [];
        return [
          ts.factory.updateImportDeclaration(
            statement,
            statement.modifiers,
            ts.factory.updateImportClause(clause, clause.isTypeOnly, name, selected),
            statement.moduleSpecifier,
            statement.attributes
          ),
        ];
      }
      return kept.has(statement) ? [statement] : [];
    });
  }
  const factoryPruned = sourceFile.statements.map((statement) => {
    if (
      !ts.isFunctionDeclaration(statement) ||
      statement.name?.text !== factoryName ||
      !statement.body
    )
      return statement;
    return ts.factory.updateFunctionDeclaration(
      statement,
      statement.modifiers,
      statement.asteriskToken,
      statement.name,
      statement.typeParameters,
      statement.parameters,
      statement.type,
      ts.factory.updateBlock(statement.body, closure(statement.body.statements, false))
    );
  });
  // Rebind after local pruning: stale symbols would retain removed imports and global helpers.
  const local = printSupport(sourceFile, factoryPruned);
  if (factoryPruned.some((statement, index) => statement !== sourceFile.statements[index]))
    return pruneTop(local, publicFunctions);
  return printSupport(sourceFile, closure(factoryPruned, true));
  function pruneTop(source: string, roots: readonly string[]): string {
    return prune(source, '', roots);
  }
}
export function specializeNativeTemplate(
  source: string,
  plan: NativeSupportPlan,
  factoryName: string,
  publicFunctions: readonly string[] = [factoryName]
): string {
  return prune(specialize(source, plan), factoryName, publicFunctions);
}
