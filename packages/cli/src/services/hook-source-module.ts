import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** A parsed authored module and its physical source identity. */
export type HookSourceModule = { file: string; source: ts.SourceFile };

/** A value declaration reached through an authored module graph. */
export type HookSourceSymbol = { module: HookSourceModule; declaration: ts.Node };

export type HookSourceModuleContext = {
  /** Register an immutable parsed source; changed text requires a new SourceFile. */
  registerSource(source: ts.SourceFile): void;
  /** Return the module identity corresponding to a registered source. */
  moduleForSource(source: ts.SourceFile): HookSourceModule;
  /** Resolve an import specifier to an executable/source module. */
  resolveModule(from: string, specifier: string): HookSourceModule | null;
  /** Resolve a module-local, value-bearing lexical binding. */
  resolveLocal(module: HookSourceModule, name: string): HookSourceSymbol | null;
  /** Resolve a public value export (never an unexported local declaration). */
  resolveExport(module: HookSourceModule, name: string): HookSourceSymbol | null;
  /** Resolve the actual lexical binding represented by an expression. */
  resolveReference(node: ts.Node, module: HookSourceModule): HookSourceSymbol | null;
  /** Prove that an expression denotes the canonical Core defineAsHook value. */
  isDefineAsHookReference(node: ts.Node, module: HookSourceModule): boolean;
  /** Prove that an expression denotes the canonical Core definePrototype value. */
  isDefinePrototypeReference(node: ts.Node, module: HookSourceModule): boolean;
  /** Prove that an expression denotes the canonical Core defineHook value. */
  isDefineHookReference(node: ts.Node, module: HookSourceModule): boolean;
};

type ConfigRecord = { options: ts.CompilerOptions; file: string } | null;

const CORE_SPECIFIER = '@proto.ui/core';
const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

function isCoreFactoryName(name: string): boolean {
  return name === 'defineAsHook' || name === 'definePrototype' || name === 'defineHook';
}

function unwrap(node: ts.Node): ts.Node {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
}

function scriptKind(file: string): ts.ScriptKind {
  const lower = file.toLowerCase();
  if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs'))
    return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === kind)
  );
}

function isConstantDeclaration(declaration: ts.VariableDeclaration): boolean {
  const list = declaration.parent;
  return ts.isVariableDeclarationList(list) && (list.flags & ts.NodeFlags.Const) !== 0;
}

/**
 * Whether anything in the owning source can replace `name` on this exact
 * binding after its initializer. A `const` name whose object member is written
 * — directly, through an alias, or dynamically — no longer proves the value the
 * initializer installed.
 */
function hasConflictingWrite(
  lexicalIndex: LexicalIndex,
  declaration: ts.VariableDeclaration,
  name: string,
  holderObject: ts.Node | null = declaration.initializer ? unwrap(declaration.initializer) : null
): boolean {
  const target = declaration.name;
  if (!ts.isIdentifier(target)) return true;
  const source = declaration.getSourceFile();
  let conflict = false;
  const aliases = new Set<ts.Node>([declaration]);
  const bindingOf = (expression: ts.Expression): ts.Node | null => {
    const value = unwrap(expression);
    return ts.isIdentifier(value) ? findLexicalBinding(lexicalIndex, value) : null;
  };
  const hasHolderThis = (node: ts.Node): boolean => {
    for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
      // Computed names run in the enclosing receiver, not in the member's
      // method, field initializer, or class receiver scope.
      if (ts.isComputedPropertyName(current)) {
        current = current.parent;
        if (ts.isClassDeclaration(current.parent) || ts.isClassExpression(current.parent))
          current = current.parent;
        continue;
      }
      if (
        ts.isClassDeclaration(current) ||
        ts.isClassExpression(current) ||
        ts.isClassStaticBlockDeclaration(current) ||
        ts.isPropertyDeclaration(current)
      )
        return false;
      if (ts.isArrowFunction(current)) continue;
      if (!ts.isFunctionLike(current)) continue;
      let member: ts.Node = current;
      while (
        member.parent &&
        (ts.isParenthesizedExpression(member.parent) ||
          ts.isAsExpression(member.parent) ||
          ts.isTypeAssertionExpression(member.parent) ||
          ts.isNonNullExpression(member.parent))
      )
        member = member.parent;
      if (member.parent && ts.isPropertyAssignment(member.parent)) member = member.parent;
      return member.parent === holderObject;
    }
    return false;
  };
  // Retain every possible alias, including aliases later rebound. Forgetting
  // an earlier reference could certify a write through the old object.
  let addedAlias: boolean;
  do {
    addedAlias = false;
    const collectAliases = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const origin = bindingOf(node.initializer);
        if (origin && aliases.has(origin) && !aliases.has(node)) {
          aliases.add(node);
          addedAlias = true;
        }
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const origin = bindingOf(node.right);
        const destination = bindingOf(node.left);
        if (origin && destination && aliases.has(origin) && !aliases.has(destination)) {
          aliases.add(destination);
          addedAlias = true;
        }
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(source);
  } while (addedAlias);
  const root = (expression: ts.Expression): ts.Identifier | null => {
    let current = unwrap(expression);
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      current = unwrap(current.expression);
    }
    return ts.isIdentifier(current) ? current : null;
  };
  const memberName = (
    access: ts.PropertyAccessExpression | ts.ElementAccessExpression
  ): string | null =>
    ts.isPropertyAccessExpression(access)
      ? access.name.text
      : ts.isStringLiteralLike(access.argumentExpression)
        ? access.argumentExpression.text
        : null;
  const visit = (node: ts.Node): void => {
    if (conflict) return;
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      let targetNode: ts.Node = node;
      while (
        targetNode.parent &&
        (ts.isParenthesizedExpression(targetNode.parent) ||
          ts.isAsExpression(targetNode.parent) ||
          ts.isTypeAssertionExpression(targetNode.parent) ||
          ts.isNonNullExpression(targetNode.parent))
      )
        targetNode = targetNode.parent;
      const contains = (ancestor: ts.Node, descendant: ts.Node): boolean => {
        let current: ts.Node | undefined = descendant;
        while (current) {
          if (current === ancestor) return true;
          current = current.parent;
        }
        return false;
      };
      const writeOperation = (access: ts.Node): ts.Node | null => {
        let current: ts.Node = access;
        while (current.parent) {
          const parent = current.parent;
          if (ts.isBinaryExpression(parent)) {
            return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
              contains(parent.left, access)
              ? parent
              : null;
          }
          if (ts.isForInStatement(parent) || ts.isForOfStatement(parent)) {
            return contains(parent.initializer, access) ? parent : null;
          }
          if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) {
            return parent.operand === current &&
              (parent.operator === ts.SyntaxKind.PlusPlusToken ||
                parent.operator === ts.SyntaxKind.MinusMinusToken)
              ? parent
              : null;
          }
          if (ts.isDeleteExpression(parent)) return parent.expression === current ? parent : null;
          if (
            ts.isParenthesizedExpression(parent) ||
            ts.isAsExpression(parent) ||
            ts.isTypeAssertionExpression(parent) ||
            ts.isNonNullExpression(parent) ||
            ts.isArrayLiteralExpression(parent) ||
            ts.isObjectLiteralExpression(parent) ||
            ts.isPropertyAssignment(parent) ||
            ts.isShorthandPropertyAssignment(parent) ||
            ts.isSpreadElement(parent) ||
            ts.isSpreadAssignment(parent)
          ) {
            current = parent;
            continue;
          }
          return null;
        }
        return null;
      };
      const operation = writeOperation(targetNode);
      if (operation) {
        const rootName = root(node.expression);
        const written = memberName(node);
        const rootValue = unwrap(node.expression);
        const binding = rootName ? findLexicalBinding(lexicalIndex, rootName) : null;
        // A dynamic key can be any property, so it retires every candidate.
        if (
          (rootValue.kind === ts.SyntaxKind.ThisKeyword &&
            hasHolderThis(node) &&
            (written === null || written === name)) ||
          (binding && aliases.has(binding) && (written === null || written === name))
        )
          conflict = true;
      }
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      // A holder passed to unknown code can be mutated without a visible write.
      if (
        node.arguments?.some((argument) => {
          const binding = bindingOf(argument);
          return (
            (binding !== null && aliases.has(binding)) ||
            (unwrap(argument).kind === ts.SyntaxKind.ThisKeyword && hasHolderThis(node))
          );
        })
      )
        conflict = true;
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
        const receiver = expression.expression;
        const receiverRoot = root(receiver);
        const receiverBinding = receiverRoot
          ? findLexicalBinding(lexicalIndex, receiverRoot)
          : null;
        const member = memberName(expression);
        if (
          (unwrap(receiver).kind === ts.SyntaxKind.ThisKeyword &&
            hasHolderThis(node) &&
            member !== name) ||
          (receiverBinding && aliases.has(receiverBinding) && (member === null || member !== name))
        )
          conflict = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (holderObject && holderObject.getSourceFile() !== source) visit(holderObject.getSourceFile());
  return conflict;
}

function textName(
  name: ts.PropertyName | ts.BindingName | ts.ModuleName | undefined
): string | null {
  if (!name) return null;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name.text
    : null;
}

function isDeclarationFile(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.endsWith('.d.ts') || lower.endsWith('.d.mts') || lower.endsWith('.d.cts');
}

function isRuntimeSource(file: string): boolean {
  if (isDeclarationFile(file)) return false;
  return SCRIPT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function declarationKey(symbol: HookSourceSymbol): string {
  const source = symbol.module.source;
  let start = -1;
  try {
    start = symbol.declaration.getStart(source);
  } catch {
    start = symbol.declaration.pos;
  }
  return `${symbol.module.file}\0${start}\0${symbol.declaration.kind}`;
}

function sameSymbol(left: HookSourceSymbol, right: HookSourceSymbol): boolean {
  if (declarationKey(left) === declarationKey(right)) return true;
  const coreName = (symbol: HookSourceSymbol): string | null =>
    coreImportedName(symbol.declaration) ??
    coreExportedName(symbol.declaration) ??
    (isCoreStarExport(symbol.declaration) ? '*' : null);
  const leftCore = coreName(left);
  return leftCore !== null && leftCore === coreName(right);
}

function addUnique(values: HookSourceSymbol[], value: HookSourceSymbol | null): void {
  if (value && !values.some((candidate) => sameSymbol(candidate, value))) values.push(value);
}

function bindingNames(
  name: ts.BindingName,
  output = new Map<string, ts.Node>()
): Map<string, ts.Node> {
  if (ts.isIdentifier(name)) {
    output.set(name.text, name);
    return output;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (ts.isBindingElement(element)) {
      if (ts.isIdentifier(element.name)) output.set(element.name.text, element);
      else bindingNames(element.name, output);
    }
  }
  return output;
}

type LexicalIndex = {
  references: WeakMap<ts.Identifier, ts.Node | null>;
  direct: WeakMap<readonly ts.Statement[], ReadonlyMap<string, ts.Node>>;
  vars: WeakMap<ts.Node, ReadonlyMap<string, ts.Node>>;
};

function directVariableBindings(
  lexicalIndex: LexicalIndex,
  statements: readonly ts.Statement[],
  name: string
): ts.Node | null {
  let bindings = lexicalIndex.direct.get(statements);
  if (!bindings) {
    const found = new Map<string, ts.Node>();
    const first = (name: string, node: ts.Node): void => {
      if (!found.has(name)) found.set(name, node);
    };
    for (const statement of statements) {
      if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue;
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          for (const [name, binding] of bindingNames(declaration.name))
            first(name, ts.isIdentifier(declaration.name) ? declaration : binding);
        }
      } else if (
        (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) && statement.name
      ) {
        first(statement.name.text, statement);
      }
    }
    bindings = found;
    lexicalIndex.direct.set(statements, bindings);
  }
  return bindings.get(name) ?? null;
}

function importBinding(
  module: HookSourceModule,
  name: string
): {
  statement: ts.ImportDeclaration;
  declaration: ts.Node;
  imported: string | null;
  kind: 'default' | 'named' | 'namespace';
} | null {
  let found: {
    statement: ts.ImportDeclaration;
    declaration: ts.Node;
    imported: string | null;
    kind: 'default' | 'named' | 'namespace';
  } | null = null;
  for (const statement of module.source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier))
      continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    if (clause.name?.text === name) {
      if (found) return null;
      found = { statement, declaration: clause, imported: 'default', kind: 'default' };
    }
    const bindings = clause.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      if (bindings.name.text !== name) continue;
      if (found) return null;
      found = { statement, declaration: bindings, imported: null, kind: 'namespace' };
      continue;
    }
    for (const element of bindings.elements) {
      if (element.isTypeOnly || element.name.text !== name) continue;
      if (found) return null;
      found = {
        statement,
        declaration: element,
        imported: (element.propertyName ?? element.name).text,
        kind: 'named',
      };
    }
  }
  return found;
}

function sourceImportDeclaration(node: ts.Node): ts.ImportDeclaration | null {
  const parent = node.parent;
  if (!parent) return null;
  if (ts.isImportSpecifier(node)) {
    return ts.isNamedImports(parent) &&
      ts.isImportClause(parent.parent) &&
      ts.isImportDeclaration(parent.parent.parent)
      ? parent.parent.parent
      : null;
  }
  if (ts.isNamespaceImport(node)) {
    return ts.isImportClause(parent) && ts.isImportDeclaration(parent.parent)
      ? parent.parent
      : null;
  }
  if (ts.isImportClause(node)) return ts.isImportDeclaration(parent) ? parent : null;
  return null;
}

function sourceExportDeclaration(node: ts.Node): ts.ExportDeclaration | null {
  if (ts.isExportSpecifier(node)) {
    return ts.isNamedExports(node.parent) && ts.isExportDeclaration(node.parent.parent)
      ? node.parent.parent
      : null;
  }
  return ts.isExportDeclaration(node) ? node : null;
}

function coreImportedName(node: ts.Node): string | null {
  const declaration = sourceImportDeclaration(node);
  if (
    !declaration ||
    !ts.isStringLiteralLike(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== CORE_SPECIFIER
  )
    return null;
  const clause = declaration.importClause;
  if (!clause || clause.isTypeOnly) return null;
  if (ts.isImportSpecifier(node)) {
    if (node.isTypeOnly) return null;
    return (node.propertyName ?? node.name).text;
  }
  return null;
}

function isCoreNamespaceImport(node: ts.Node): boolean {
  const declaration = sourceImportDeclaration(node);
  return (
    !!declaration &&
    ts.isStringLiteralLike(declaration.moduleSpecifier) &&
    declaration.moduleSpecifier.text === CORE_SPECIFIER &&
    !!declaration.importClause &&
    !declaration.importClause.isTypeOnly &&
    ts.isNamespaceImport(node)
  );
}

function namespaceImportDeclaration(node: ts.Node): ts.ImportDeclaration | null {
  const declaration = sourceImportDeclaration(node);
  if (!declaration || !declaration.importClause || declaration.importClause.isTypeOnly) return null;
  return ts.isNamespaceImport(node) ? declaration : null;
}

function coreExportedName(node: ts.Node): string | null {
  const declaration = sourceExportDeclaration(node);
  if (
    !declaration ||
    !declaration.moduleSpecifier ||
    !ts.isStringLiteralLike(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== CORE_SPECIFIER ||
    declaration.isTypeOnly
  )
    return null;
  if (!ts.isExportSpecifier(node) || node.isTypeOnly) return null;
  return (node.propertyName ?? node.name).text;
}

function isCoreNamespaceExport(node: ts.Node): boolean {
  const declaration = sourceExportDeclaration(node);
  if (
    !declaration ||
    !declaration.moduleSpecifier ||
    !ts.isStringLiteralLike(declaration.moduleSpecifier) ||
    declaration.moduleSpecifier.text !== CORE_SPECIFIER ||
    declaration.isTypeOnly
  )
    return false;
  return !!declaration.exportClause && ts.isNamespaceExport(declaration.exportClause);
}

function namespaceExportDeclaration(node: ts.Node): ts.ExportDeclaration | null {
  const declaration = sourceExportDeclaration(node);
  if (!declaration || declaration.isTypeOnly || !declaration.exportClause) return null;
  return ts.isNamespaceExport(declaration.exportClause) ? declaration : null;
}

function isCoreStarExport(node: ts.Node): boolean {
  const declaration = sourceExportDeclaration(node);
  return (
    !!declaration &&
    !!declaration.moduleSpecifier &&
    ts.isStringLiteralLike(declaration.moduleSpecifier) &&
    declaration.moduleSpecifier.text === CORE_SPECIFIER &&
    !declaration.isTypeOnly &&
    !declaration.exportClause
  );
}

function packageSpecifierParts(specifier: string): { name: string; subpath: string } | null {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#'))
    return null;
  const pieces = specifier.split('/');
  if (specifier.startsWith('@')) {
    if (pieces.length < 2) return null;
    return { name: `${pieces[0]}/${pieces[1]}`, subpath: pieces.slice(2).join('/') };
  }
  return { name: pieces[0], subpath: pieces.slice(1).join('/') };
}

function packageJson(file: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function nearestPackageRoot(start: string, packageName: string): string | null {
  let current = path.resolve(start);
  while (true) {
    const candidate = path.join(current, 'node_modules', packageName);
    const manifest = packageJson(path.join(candidate, 'package.json'));
    if (manifest) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function packageRootFromDeclaration(file: string, packageName: string): string | null {
  let current = path.dirname(file);
  while (true) {
    const manifestPath = path.join(current, 'package.json');
    const manifest = packageJson(manifestPath);
    if (manifest && manifest.name === packageName) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function nodeModuleCondition(from: string): 'import' | 'require' {
  const extension = path.extname(from).toLowerCase();
  if (extension === '.mjs' || extension === '.mts') return 'import';
  if (extension === '.cjs' || extension === '.cts') return 'require';
  let current = path.dirname(from);
  while (true) {
    const manifest = packageJson(path.join(current, 'package.json'));
    if (manifest) return manifest.type === 'module' ? 'import' : 'require';
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return 'require';
}

/**
 * Whether the project resolves modules the way Node does. Node16/NodeNext
 * resolution binds a project to Node's own entry rules, so the runtime entry
 * of a package is the one Node reads.
 */
function usesNodeResolution(options: ts.CompilerOptions): boolean {
  const moduleResolution = options.moduleResolution;
  return (
    moduleResolution === ts.ModuleResolutionKind.Node16 ||
    moduleResolution === ts.ModuleResolutionKind.NodeNext ||
    (moduleResolution === undefined &&
      (options.module === ts.ModuleKind.Node16 || options.module === ts.ModuleKind.NodeNext))
  );
}

/**
 * The resolution mode an importer resolves under. Node16/NodeNext resolution
 * selects a package's `import` or `require` export from the importer's own
 * format, so the mode follows the importer instead of the CommonJS default
 * TypeScript applies when no mode is given.
 */
function importerResolutionMode(from: string, options: ts.CompilerOptions): ts.ResolutionMode {
  if (!usesNodeResolution(options)) return undefined;
  return nodeModuleCondition(from) === 'import' ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS;
}

function packageExportConditions(from: string, options: ts.CompilerOptions): ReadonlySet<string> {
  const conditions = new Set(options.customConditions ?? []);
  conditions.add('default');
  const usesNodeConditions =
    options.moduleResolution === ts.ModuleResolutionKind.Node16 ||
    options.moduleResolution === ts.ModuleResolutionKind.NodeNext;
  if (usesNodeConditions) {
    conditions.add('node');
    conditions.add(nodeModuleCondition(from));
  } else {
    conditions.add(options.module === ts.ModuleKind.CommonJS ? 'require' : 'import');
  }
  return conditions;
}

function packageExportTarget(
  value: unknown,
  subpath: string,
  conditions: ReadonlySet<string>,
  wildcard: string | null = null
): string | null {
  if (typeof value === 'string') return wildcard === null ? value : value.replaceAll('*', wildcard);
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = packageExportTarget(item, subpath, conditions, wildcard);
      if (target) return target;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const subpathKeys = Object.keys(record).filter((key) => key === '.' || key.startsWith('./'));
  if (subpathKeys.length) {
    const exact = record[subpath];
    if (exact !== undefined && !subpath.includes('*') && !subpath.endsWith('/'))
      return packageExportTarget(exact, subpath, conditions, wildcard);
    const patterns = subpathKeys.filter((key) => key.includes('*')).sort(compareExportPatterns);
    for (const pattern of patterns) {
      const star = pattern.indexOf('*');
      const prefix = pattern.slice(0, star);
      const suffix = pattern.slice(star + 1);
      if (
        pattern.lastIndexOf('*') !== star ||
        subpath.length < pattern.length ||
        !subpath.startsWith(prefix) ||
        !subpath.endsWith(suffix)
      )
        continue;
      const middle = subpath.slice(prefix.length, subpath.length - suffix.length);
      // Selection is final even when this target denies the subpath or has no
      // active condition; a less specific pattern cannot reopen the export.
      return packageExportTarget(record[pattern], subpath, conditions, middle);
    }
    return null;
  }
  // Conditional-export precedence is the manifest's key order, restricted to
  // conditions active for this importer. Declarations are never runtime entries.
  for (const condition of Object.keys(record)) {
    if (condition === 'types' || condition.startsWith('types@') || !conditions.has(condition))
      continue;
    const target = packageExportTarget(record[condition], subpath, conditions, wildcard);
    if (target) return target;
  }
  return null;
}

/**
 * Node's export-pattern precedence: the prefix before `*` decides first, and
 * the total key length only breaks a tie between equally specific prefixes.
 * Ranking by total length alone lets a longer but less specific key such as
 * `./*longsuffix` win over `./features/*`, which resolves a different
 * implementation than `import.meta.resolve` selects.
 */
function compareExportPatterns(left: string, right: string): number {
  const leftBase = left.indexOf('*') + 1;
  const rightBase = right.indexOf('*') + 1;
  if (leftBase !== rightBase) return rightBase - leftBase;
  return right.length - left.length;
}

function runtimeCandidates(candidate: string): string[] {
  const lower = candidate.toLowerCase();
  let bases: string[];
  if (lower.endsWith('.d.mts')) bases = [candidate.slice(0, -'.d.mts'.length)];
  else if (lower.endsWith('.d.cts')) bases = [candidate.slice(0, -'.d.cts'.length)];
  else if (lower.endsWith('.d.ts')) bases = [candidate.slice(0, -'.d.ts'.length)];
  else bases = [candidate];
  const output: string[] = [];
  for (const base of bases) {
    const extension = path.extname(base).toLowerCase();
    if (SCRIPT_EXTENSIONS.has(extension)) output.push(base);
    else
      output.push(
        `${base}.js`,
        `${base}.mjs`,
        `${base}.cjs`,
        `${base}.ts`,
        `${base}.mts`,
        `${base}.cts`
      );
    output.push(
      path.join(base, 'index.js'),
      path.join(base, 'index.mjs'),
      path.join(base, 'index.cjs'),
      path.join(base, 'index.ts'),
      path.join(base, 'index.mts'),
      path.join(base, 'index.cts')
    );
  }
  return output;
}

function existingRuntime(candidate: string): string | null {
  for (const file of runtimeCandidates(candidate)) {
    try {
      if (statSync(file).isFile() && isRuntimeSource(file)) return file;
    } catch {
      // Missing candidates are expected during extension substitution.
    }
  }
  return null;
}

function authoredSourceSibling(file: string): string | null {
  const extension = path.extname(file).toLowerCase();
  const base = file.slice(0, file.length - extension.length);
  const replacements: string[] =
    extension === '.js' || extension === '.jsx'
      ? ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx']
      : extension === '.mjs'
        ? ['.mts', '.ts', '.tsx', '.mjs']
        : extension === '.cjs'
          ? ['.cts', '.ts', '.tsx', '.cjs']
          : extension === ''
            ? ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']
            : [];
  for (const replacement of replacements) {
    const candidate = `${base}${replacement}`;
    try {
      if (statSync(candidate).isFile() && isRuntimeSource(candidate)) return candidate;
    } catch {
      // The source substitution is a best-effort extension mapping.
    }
  }
  return null;
}

function runtimePackageEntry(
  from: string,
  specifier: string,
  declaration: string,
  options: ts.CompilerOptions
): string | null {
  const parts = packageSpecifierParts(specifier);
  if (!parts) return null;
  const root =
    packageRootFromDeclaration(declaration, parts.name) ??
    nearestPackageRoot(path.dirname(from), parts.name);
  if (!root) return null;
  const manifest = packageJson(path.join(root, 'package.json'));
  if (!manifest) return null;
  const subpath = parts.subpath ? `./${parts.subpath}` : '.';
  if (manifest.exports !== undefined) {
    const target = packageExportTarget(
      manifest.exports,
      subpath,
      packageExportConditions(from, options)
    );
    if (target && !target.startsWith('#')) {
      const resolved = existingRuntime(path.resolve(root, target));
      if (resolved) return resolved;
    }
  }
  if (parts.subpath) {
    const resolved = existingRuntime(path.resolve(root, parts.subpath));
    if (resolved) return resolved;
  } else {
    // Node reads the `main` entry of a package that ships no `exports` map.
    // The `module` and `browser` fields are bundler conventions Node never
    // consults, so preferring them would select an implementation Node never
    // loads. A bundler-mode project loads the `module` entry instead, so the
    // order follows the resolution the project declares.
    const fields = usesNodeResolution(options) ? ['main'] : ['module', 'main', 'browser'];
    for (const field of fields) {
      const value = manifest[field];
      if (typeof value !== 'string') continue;
      const resolved = existingRuntime(path.resolve(root, value));
      if (resolved) return resolved;
    }
    const resolved = existingRuntime(path.join(root, 'index'));
    if (resolved) return resolved;
  }
  return null;
}

function findLexicalBinding(lexicalIndex: LexicalIndex, node: ts.Identifier): ts.Node | null {
  // Only immutable AST lexical identity is memoized, never module resolution or
  // filesystem observations. Replacement SourceFiles carry distinct node keys.
  if (lexicalIndex.references.has(node)) return lexicalIndex.references.get(node)!;
  const result = findUncachedLexicalBinding(lexicalIndex, node);
  lexicalIndex.references.set(node, result);
  return result;
}

function findUncachedLexicalBinding(lexicalIndex: LexicalIndex, node: ts.Identifier): ts.Node | null {
  const name = node.text;
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isSourceFile(current)) {
      const imported = importBinding({ file: current.fileName, source: current }, name);
      if (imported) return imported.declaration;
      return directVariableBindings(lexicalIndex, current.statements, name);
    }
    if (ts.isBlock(current) || ts.isModuleBlock(current)) {
      const found = directVariableBindings(lexicalIndex, current.statements, name);
      if (found) return found;
    }
    if (ts.isCaseBlock(current)) {
      for (const clause of current.clauses) {
        const found = directVariableBindings(lexicalIndex, clause.statements, name);
        if (found) return found;
      }
    }
    if (ts.isFunctionLike(current)) {
      for (const parameter of current.parameters) {
        const found = bindingNames(parameter.name).get(name);
        if (found) return found;
      }
      if (
        (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)) &&
        textName(current.name) === name
      ) {
        // A declaration's recursive name is the enclosing declaration binding;
        // only a named function expression introduces a separate self binding.
        return ts.isFunctionDeclaration(current) ? current : (current.name ?? null);
      }
      let vars = lexicalIndex.vars.get(current);
      if (!vars) {
        const found = new Map<string, ts.Node>();
        const functionScope = current;
        const visitVar = (candidate: ts.Node): void => {
          if (candidate !== functionScope && ts.isFunctionLike(candidate)) return;
          if (
            ts.isVariableStatement(candidate) &&
            (candidate.declarationList.flags & ts.NodeFlags.Let) === 0 &&
            (candidate.declarationList.flags & ts.NodeFlags.Const) === 0
          ) {
            for (const declaration of candidate.declarationList.declarations) {
              for (const [name, binding] of bindingNames(declaration.name)) {
                if (!found.has(name))
                  found.set(name, ts.isIdentifier(declaration.name) ? declaration : binding);
              }
            }
          }
          ts.forEachChild(candidate, visitVar);
        };
        visitVar(functionScope);
        vars = found;
        lexicalIndex.vars.set(functionScope, vars);
      }
      const varBinding = vars.get(name);
      if (varBinding) return varBinding;
    }
    if (ts.isCatchClause(current)) {
      const found =
        current.variableDeclaration && bindingNames(current.variableDeclaration.name).get(name);
      if (found) return found;
    }
    if (
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current)
    ) {
      const initializer = current.initializer;
      if (initializer && ts.isVariableDeclarationList(initializer)) {
        for (const declaration of initializer.declarations) {
          const found = bindingNames(declaration.name).get(name);
          if (found) return ts.isIdentifier(declaration.name) ? declaration : found;
        }
      }
    }
    current = current.parent;
  }
  return null;
}

function objectPropertyName(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isComputedPropertyName(name)) {
    return ts.isStringLiteralLike(name.expression) ? name.expression.text : null;
  }
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name.text
    : null;
}

/**
 * Resolve the value an object literal actually holds, so a later assignment,
 * computed key or unknown spread retires an earlier canonical member instead of
 * being ignored behind it.
 */
function objectMember(object: ts.ObjectLiteralExpression, name: string): ts.Node | null {
  // A spread's overwrite domain is never proven here, so any object literal
  // containing one cannot prove which value this name finally holds.
  if (object.properties.some((property) => ts.isSpreadAssignment(property))) return null;
  let found: ts.Node | null = null;
  for (const property of object.properties) {
    const written =
      (ts.isPropertyAssignment(property) ||
        ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)) &&
      objectPropertyName(property.name) === name;
    if (written) {
      found = property;
      continue;
    }
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
      found = property;
      continue;
    }
    if (
      (ts.isMethodDeclaration(property) ||
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)) &&
      property.name &&
      ts.isComputedPropertyName(property.name) &&
      objectPropertyName(property.name) === null
    ) {
      found = null;
      continue;
    }
    if (ts.isPropertyAssignment(property) && ts.isComputedPropertyName(property.name)) {
      // A computed key is only an overwrite when its key is statically this
      // name; any other dynamic key is unknown and therefore blocking.
      const literal = property.name.expression;
      if (!ts.isStringLiteralLike(literal)) found = null;
      else if (literal.text === name) found = property;
    }
  }
  return found;
}

/**
 * Build a source-only module graph. This intentionally has no TypeScript
 * Program/checker: callers provide source text, and every returned symbol is
 * tied to the concrete declaration that was reached through that text.
 */
export function createHookSourceModuleContext(): HookSourceModuleContext {
  // Immutable AST identity, scoped to one operation. A newly registered source
  // owns different nodes; no path-keyed/global index survives into its lookup.
  const lexicalIndex: LexicalIndex = { direct: new WeakMap(), vars: new WeakMap(), references: new WeakMap() };
  const modules = new Map<string, HookSourceModule>();
  const moduleFailures = new Set<string>();
  const configCache = new Map<string, ConfigRecord>();
  const exportPositiveCache = new Map<string, HookSourceSymbol>();
  const objectMemberCache = new Map<string, HookSourceSymbol | null>();
  const coreStarFactoryNames = new WeakMap<HookSourceSymbol, string>();

  // A synchronous public lookup is one filesystem-identity observation. Share
  // duplicate path resolution only inside that lookup, never across calls.
  // Source/AST and parsed-module caches retain their existing separate rules.
  let canonicalQueryCache: Map<string, string> | undefined;
  const inCanonicalQuery = <T>(lookup: () => T): T => {
    const previous = canonicalQueryCache;
    canonicalQueryCache = new Map();
    try {
      return lookup();
    } finally {
      canonicalQueryCache = previous;
    }
  };

  const canonical = (file: string): string => {
    const absolute = path.resolve(file);
    const cached = canonicalQueryCache?.get(absolute);
    if (cached !== undefined) return cached;
    try {
      const physical = realpathSync.native(absolute);
      canonicalQueryCache?.set(absolute, physical);
      return physical;
    } catch {
      // Do not cache failed observations, even within the current lookup.
      return absolute;
    }
  };

  const clearSymbolCaches = (): void => {
    exportPositiveCache.clear();
    objectMemberCache.clear();
  };

  const registerSource = (source: ts.SourceFile): HookSourceModule => {
    const file = canonical(source.fileName);
    const previous = modules.get(file);
    if (previous && previous.source !== source) clearSymbolCaches();
    const module = { file, source };
    modules.set(file, module);
    moduleFailures.delete(file);
    return module;
  };

  const moduleForSource = (source: ts.SourceFile): HookSourceModule => {
    // Registration already resolved this exact source path. Do not resolve it
    // again or retain a path cache across later registrations/symlink changes.
    return registerSource(source);
  };

  // Internal caller resolveModulePath already returns a physical path.
  const parseModule = (key: string): HookSourceModule | null => {
    const existing = modules.get(key);
    if (existing) return existing;
    if (moduleFailures.has(key) || isDeclarationFile(key)) return null;
    try {
      const source = ts.createSourceFile(
        key,
        readFileSync(key, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        scriptKind(key)
      );
      const module = { file: key, source } satisfies HookSourceModule;
      modules.set(key, module);
      return module;
    } catch {
      moduleFailures.add(key);
      return null;
    }
  };

  // Internal caller passes its already-canonical containing-file path.
  const configFor = (from: string): ConfigRecord => {
    const start = path.dirname(from);
    const configFile = ts.findConfigFile(start, ts.sys.fileExists, 'tsconfig.json');
    if (!configFile) return null;
    const key = canonical(configFile);
    if (configCache.has(key)) return configCache.get(key) ?? null;
    try {
      const read = ts.readConfigFile(key, ts.sys.readFile);
      if (!read.config) {
        configCache.set(key, null);
        return null;
      }
      const host: ts.ParseConfigHost = {
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        // Resolution consumes compiler options, never the project's file list.
        readDirectory: () => [],
      };
      const parsed = ts.parseJsonConfigFileContent(
        read.config,
        host,
        path.dirname(key),
        undefined,
        key
      );
      const options: ts.CompilerOptions = { ...parsed.options, allowJs: true };
      if (options.moduleResolution === undefined)
        options.moduleResolution = ts.ModuleResolutionKind.Bundler;
      if (options.module === undefined) options.module = ts.ModuleKind.ESNext;
      if (options.target === undefined) options.target = ts.ScriptTarget.Latest;
      const value = { file: key, options };
      configCache.set(key, value);
      return value;
    } catch {
      configCache.set(key, null);
      return null;
    }
  };

  const defaultOptions = (): ts.CompilerOptions => ({
    allowJs: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.Latest,
    jsx: ts.JsxEmit.Preserve,
  });

  const resolveModulePath = (from: string, specifier: string): string | null => {
    const containing = canonical(from);
    const config = configFor(containing);
    const options = config?.options ?? defaultOptions();
    let resolved: ts.ResolvedModuleFull | undefined;
    try {
      resolved = ts.resolveModuleName(
        specifier,
        containing,
        options,
        ts.sys,
        undefined,
        undefined,
        importerResolutionMode(containing, options)
      ).resolvedModule;
    } catch {
      resolved = undefined;
    }

    if (resolved) {
      const resolvedFile = canonical(resolved.resolvedFileName);
      if (isRuntimeSource(resolvedFile)) {
        if (!resolvedFile.split(path.sep).includes('node_modules')) {
          const authored = authoredSourceSibling(resolvedFile);
          if (authored) return canonical(authored);
        }
        return resolvedFile;
      }
      if (isDeclarationFile(resolvedFile)) {
        const packageRuntime = runtimePackageEntry(containing, specifier, resolvedFile, options);
        if (packageRuntime) return canonical(packageRuntime);
        if (!resolvedFile.split(path.sep).includes('node_modules')) {
          const sibling = existingRuntime(resolvedFile);
          if (sibling) return canonical(sibling);
        }
        // A declaration in an installed package is not an implementation. Do
        // not search this workspace for a similarly named source file.
        return null;
      }
    }

    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('#')) {
      const parts = packageSpecifierParts(specifier);
      const root = parts && nearestPackageRoot(path.dirname(containing), parts.name);
      if (root) {
        const runtime = runtimePackageEntry(
          containing,
          specifier,
          path.join(root, 'index.d.ts'),
          options
        );
        if (runtime) return canonical(runtime);
      }
    }

    // TypeScript normally performs this substitution itself. The bounded
    // fallback covers a virtual/extensionful caller when no config exists,
    // while retaining authored .js/.mjs/.cjs source precedence.
    if (specifier.startsWith('.')) {
      const base = path.resolve(path.dirname(containing), specifier);
      const lower = base.toLowerCase();
      const roots =
        lower.endsWith('.js') || lower.endsWith('.jsx')
          ? [base.slice(0, base.lastIndexOf('.')), base]
          : lower.endsWith('.mjs')
            ? [base.slice(0, base.lastIndexOf('.')), base]
            : lower.endsWith('.cjs')
              ? [base.slice(0, base.lastIndexOf('.')), base]
              : [base];
      for (const root of roots) {
        const candidate = authoredSourceSibling(root) ?? existingRuntime(root);
        if (candidate) return canonical(candidate);
      }
    }
    return null;
  };

  const resolveModule = (from: string, specifier: string): HookSourceModule | null => {
    const file = resolveModulePath(from, specifier);
    return file ? parseModule(file) : null;
  };

  const localDeclaration = (module: HookSourceModule, name: string): ts.Node | null => {
    const imported = importBinding(module, name);
    if (imported) return imported.declaration;
    return directVariableBindings(lexicalIndex, module.source.statements, name);
  };

  const resolveExportInternal: (
    module: HookSourceModule,
    name: string,
    stack: Set<string>
  ) => HookSourceSymbol | null = (module, name, stack) => {
    const key = `${module.file}\0${name}`;
    const cached = exportPositiveCache.get(key);
    if (cached) return cached;
    if (stack.has(key)) return null;
    const nextStack = new Set(stack).add(key);
    const explicit: HookSourceSymbol[] = [];
    let explicitClaimed = false;

    for (const statement of module.source.statements) {
      if (
        ts.isVariableStatement(statement) &&
        hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      ) {
        if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) continue;
        const names = new Map<string, ts.Node>();
        for (const declaration of statement.declarationList.declarations) {
          if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) {
            // An erased declaration establishes no runtime value.
            names.clear();
            break;
          }
          // Normalize to the enclosing declaration so a simple binding and the
          // same name found through a local route are one symbol.
          for (const [bound, node] of bindingNames(declaration.name)) {
            names.set(bound, ts.isIdentifier(declaration.name) ? declaration : node);
          }
        }
        const declaration = names.get(name);
        if (declaration) {
          explicitClaimed = true;
          addUnique(explicit, { module, declaration });
        }
        continue;
      }
      if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
        if (!statement.name || hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue;
        if (
          hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
          !hasModifier(statement, ts.SyntaxKind.DefaultKeyword) &&
          statement.name.text === name
        ) {
          explicitClaimed = true;
          addUnique(explicit, { module, declaration: statement });
        }
        if (
          hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
          hasModifier(statement, ts.SyntaxKind.DefaultKeyword) &&
          name === 'default'
        ) {
          explicitClaimed = true;
          addUnique(explicit, { module, declaration: statement });
        }
        continue;
      }
      if (
        ts.isEnumDeclaration(statement) &&
        hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
        !hasModifier(statement, ts.SyntaxKind.DeclareKeyword) &&
        statement.name.text === name
      ) {
        explicitClaimed = true;
        addUnique(explicit, { module, declaration: statement });
        continue;
      }
      if (!ts.isExportAssignment(statement) && !ts.isExportDeclaration(statement)) continue;

      if (ts.isExportAssignment(statement)) {
        if (statement.isExportEquals || name !== 'default') continue;
        explicitClaimed = true;
        const expression = unwrap(statement.expression);
        if (ts.isIdentifier(expression)) {
          addUnique(explicit, resolveLocalInternal(module, expression.text, nextStack));
        } else {
          addUnique(explicit, { module, declaration: expression });
        }
        continue;
      }

      if (statement.isTypeOnly || !statement.exportClause) continue;
      const clause = statement.exportClause;
      if (ts.isNamespaceExport(clause)) {
        if (clause.name.text !== name) continue;
        explicitClaimed = true;
        addUnique(explicit, { module, declaration: statement });
        continue;
      }
      if (!ts.isNamedExports(clause)) continue;
      for (const element of clause.elements) {
        if (element.isTypeOnly || element.name.text !== name) continue;
        explicitClaimed = true;
        const localName = (element.propertyName ?? element.name).text;
        if (statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)) {
          const specifier = statement.moduleSpecifier.text;
          if (specifier === CORE_SPECIFIER) {
            if (isCoreFactoryName(localName)) addUnique(explicit, { module, declaration: element });
            continue;
          }
          const target = resolveModule(module.file, specifier);
          if (target) addUnique(explicit, resolveExportInternal(target, localName, nextStack));
        } else {
          addUnique(explicit, resolveLocalInternal(module, localName, nextStack));
        }
      }
    }

    if (explicit.length > 1) return null;
    if (explicit.length === 1) {
      exportPositiveCache.set(key, explicit[0]);
      return explicit[0];
    }
    // An explicit export whose target could not be resolved owns the public
    // name; a wildcard must not silently supply a different value.
    if (explicitClaimed) return null;

    if (name !== 'default') {
      const stars: HookSourceSymbol[] = [];
      let unresolvedStarTarget = false;
      for (const statement of module.source.statements) {
        if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || statement.exportClause)
          continue;
        if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier))
          continue;
        if (statement.moduleSpecifier.text === CORE_SPECIFIER && isCoreFactoryName(name)) {
          const symbol = { module, declaration: statement };
          coreStarFactoryNames.set(symbol, name);
          addUnique(stars, symbol);
          continue;
        }
        const target = resolveModule(module.file, statement.moduleSpecifier.text);
        if (!target) {
          unresolvedStarTarget = true;
          continue;
        }
        addUnique(stars, resolveExportInternal(target, name, nextStack));
      }
      if (stars.length > 1) return null;
      if (stars.length === 1 && !unresolvedStarTarget) {
        exportPositiveCache.set(key, stars[0]);
        return stars[0];
      }
    }
    return null;
  };

  function resolveLocalInternal(
    module: HookSourceModule,
    name: string,
    stack: Set<string>
  ): HookSourceSymbol | null {
    const imported = importBinding(module, name);
    if (imported) {
      const moduleSpecifier = imported.statement.moduleSpecifier;
      if (!ts.isStringLiteralLike(moduleSpecifier)) return null;
      const specifier = moduleSpecifier.text;
      if (imported.kind === 'namespace') return { module, declaration: imported.declaration };
      const importedName = imported.imported ?? 'default';
      if (specifier === CORE_SPECIFIER) {
        // The canonical Core value has an intentional source boundary. Keep
        // the import declaration as provenance without reading Core itself.
        return { module, declaration: imported.declaration };
      }
      const target = resolveModule(module.file, specifier);
      return target ? resolveExportInternal(target, importedName, stack) : null;
    }
    const declaration = localDeclaration(module, name);
    return declaration ? { module, declaration } : null;
  }

  const resolveLocal = (module: HookSourceModule, name: string): HookSourceSymbol | null =>
    resolveLocalInternal(module, name, new Set());

  const resolveExport = (module: HookSourceModule, name: string): HookSourceSymbol | null =>
    resolveExportInternal(module, name, new Set());

  function namespaceDescriptor(
    symbol: HookSourceSymbol,
    seen = new Set<string>()
  ): { module: HookSourceModule; specifier: string } | null {
    const key = declarationKey(symbol);
    if (seen.has(key)) return null;
    seen.add(key);
    const declaration = symbol.declaration;
    const namespaceImport = namespaceImportDeclaration(declaration);
    if (namespaceImport) {
      return ts.isStringLiteralLike(namespaceImport.moduleSpecifier)
        ? { module: symbol.module, specifier: namespaceImport.moduleSpecifier.text }
        : null;
    }
    const namespaceExport = namespaceExportDeclaration(declaration);
    if (namespaceExport) {
      const parent = namespaceExport;
      return parent && parent.moduleSpecifier && ts.isStringLiteralLike(parent.moduleSpecifier)
        ? { module: symbol.module, specifier: parent.moduleSpecifier.text }
        : null;
    }
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const initializer = unwrap(declaration.initializer);
      if (ts.isIdentifier(initializer)) {
        const next = resolveReference(initializer, symbol.module);
        return next ? namespaceDescriptor(next, seen) : null;
      }
    }
    return null;
  }

  function namespaceMember(symbol: HookSourceSymbol, name: string): HookSourceSymbol | null {
    const descriptor = namespaceDescriptor(symbol);
    if (!descriptor) return null;
    if (descriptor.specifier === CORE_SPECIFIER) {
      return isCoreFactoryName(name) ? symbol : null;
    }
    const target = resolveModule(descriptor.module.file, descriptor.specifier);
    return target ? resolveExportInternal(target, name, new Set()) : null;
  }

  /** Whether anything in the owning source can replace this exact binding. */
  const hasBindingWrite = (bindingNode: ts.Node, module: HookSourceModule): boolean => {
    if (!ts.isIdentifier(bindingNode)) return true;
    const target = resolveReference(bindingNode, module);
    if (!target) return true;
    const key = declarationKey(target);
    let changed = false;
    const visit = (node: ts.Node): void => {
      if (changed || node === bindingNode) return;
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind;
        if (
          operator >= ts.SyntaxKind.FirstAssignment &&
          operator <= ts.SyntaxKind.LastAssignment &&
          ts.isIdentifier(unwrap(node.left))
        ) {
          const written = resolveReference(unwrap(node.left), module);
          if (written && declarationKey(written) === key) changed = true;
        }
      } else if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
        if (
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken) &&
          ts.isIdentifier(unwrap(node.operand))
        ) {
          const written = resolveReference(unwrap(node.operand), module);
          if (written && declarationKey(written) === key) changed = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(module.source);
    return changed;
  };

  const functionSymbol = (
    symbol: HookSourceSymbol,
    seen = new Set<string>()
  ): HookSourceSymbol | null => {
    const key = declarationKey(symbol);
    if (seen.has(key)) return null;
    seen.add(key);
    if (ts.isFunctionDeclaration(symbol.declaration)) {
      const declaration = symbol.declaration;
      if (
        declaration.asteriskToken ||
        declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
      )
        return null;
      const name = declaration.name;
      if (!name) return null;
      const writesBinding = (node: ts.Node, varDeclaration = false): boolean => {
        if (ts.isExpression(node)) node = unwrap(node);
        if (ts.isIdentifier(node)) {
          if (node.text !== name.text) return false;
          if (varDeclaration) return true;
          const binding = findLexicalBinding(lexicalIndex, node);
          return binding === declaration || binding === name;
        }
        if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
          return node.elements.some(
            (element) => ts.isBindingElement(element) && writesBinding(element.name, varDeclaration)
          );
        }
        if (ts.isArrayLiteralExpression(node))
          return node.elements.some((element) => writesBinding(element));
        if (ts.isObjectLiteralExpression(node)) {
          return node.properties.some((property) =>
            ts.isPropertyAssignment(property)
              ? writesBinding(property.initializer)
              : ts.isShorthandPropertyAssignment(property)
                ? writesBinding(property.name)
                : ts.isSpreadAssignment(property) && writesBinding(property.expression)
          );
        }
        if (ts.isSpreadElement(node)) return writesBinding(node.expression);
        return (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          writesBinding(node.left)
        );
      };
      const varScope = (node: ts.Node): ts.Node | undefined =>
        ts.findAncestor(node, (scope) => ts.isFunctionLike(scope) || ts.isSourceFile(scope));
      const declaringScope = varScope(declaration.parent);
      let replaced = false;
      const visit = (node: ts.Node): void => {
        if (replaced) return;
        if (
          ts.isFunctionDeclaration(node) &&
          node !== declaration &&
          node.parent === declaration.parent &&
          node.name?.text === name.text
        ) {
          replaced = true;
        } else if (ts.isVariableDeclaration(node) && node.initializer) {
          replaced = writesBinding(node.name);
        } else if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        ) {
          replaced = writesBinding(node.left);
        } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
          const initializer = node.initializer;
          if (ts.isVariableDeclarationList(initializer)) {
            replaced =
              !(initializer.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) &&
              varScope(node) === declaringScope &&
              initializer.declarations.some((binding) => writesBinding(binding.name, true));
          } else replaced = writesBinding(initializer);
        } else if (
          (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
          (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
          replaced = writesBinding(node.operand);
        }
        if (!replaced) ts.forEachChild(node, visit);
      };
      visit(symbol.module.source);
      return replaced ? null : symbol;
    }
    if (ts.isFunctionExpression(symbol.declaration)) {
      if (symbol.declaration.name && hasBindingWrite(symbol.declaration.name, symbol.module))
        return null;
      if (
        symbol.declaration.asteriskToken ||
        symbol.declaration.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
        )
      )
        return null;
      return symbol;
    }
    if (
      ts.isVariableDeclaration(symbol.declaration) &&
      symbol.declaration.initializer &&
      isConstantDeclaration(symbol.declaration)
    ) {
      const initializer = unwrap(symbol.declaration.initializer);
      if (ts.isIdentifier(initializer)) {
        const next = resolveReference(initializer, symbol.module);
        return next ? functionSymbol(next, seen) : null;
      }
      if (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer)) {
        if (
          hasModifier(initializer, ts.SyntaxKind.AsyncKeyword) ||
          (ts.isFunctionExpression(initializer) && initializer.asteriskToken)
        )
          return null;
        return { module: symbol.module, declaration: initializer };
      }
    }
    return null;
  };

  const returnedObject = (
    symbol: HookSourceSymbol
  ): { object: ts.ObjectLiteralExpression; module: HookSourceModule } | null => {
    const functionValue = functionSymbol(symbol);
    if (!functionValue) return null;
    const declaration = functionValue.declaration;
    if (
      !(
        ts.isFunctionDeclaration(declaration) ||
        ts.isFunctionExpression(declaration) ||
        ts.isArrowFunction(declaration) ||
        ts.isMethodDeclaration(declaration) ||
        ts.isGetAccessorDeclaration(declaration) ||
        ts.isSetAccessorDeclaration(declaration) ||
        ts.isConstructorDeclaration(declaration)
      ) ||
      !declaration.body
    )
      return null;
    if (!ts.isBlock(declaration.body)) {
      const expression = unwrap(declaration.body);
      return ts.isObjectLiteralExpression(expression)
        ? { object: expression, module: functionValue.module }
        : null;
    }
    const statements = declaration.body.statements;
    const last = statements[statements.length - 1];
    if (!last || !ts.isReturnStatement(last) || !last.expression) return null;
    // A nested return is not proof that this invocation returns that object.
    // Only straight-line setup followed by an unconditional return is admitted.
    for (const statement of statements.slice(0, -1)) {
      if (
        !(
          ts.isVariableStatement(statement) ||
          ts.isExpressionStatement(statement) ||
          ts.isFunctionDeclaration(statement) ||
          ts.isEmptyStatement(statement)
        )
      )
        return null;
    }
    const expression = unwrap(last.expression);
    return ts.isObjectLiteralExpression(expression)
      ? { object: expression, module: functionValue.module }
      : null;
  };

  const returnedObjectMember = (
    call: ts.CallExpression,
    name: string,
    module: HookSourceModule,
    holder: ts.VariableDeclaration
  ): HookSourceSymbol | null => {
    const callee = resolveReference(call.expression, module);
    const returned = callee ? returnedObject(callee) : null;
    if (!returned) return null;
    if (hasConflictingWrite(lexicalIndex, holder, name, returned.object)) return null;
    const property = objectMember(returned.object, name);
    if (!property) return null;
    if (ts.isShorthandPropertyAssignment(property)) {
      return resolveReference(property.name, returned.module);
    }
    if (ts.isPropertyAssignment(property)) {
      const initializer = unwrap(property.initializer);
      if (ts.isIdentifier(initializer)) return resolveReference(initializer, returned.module);
    }
    return { module: returned.module, declaration: property };
  };

  const sameSourceValue = (
    candidate: HookSourceSymbol,
    target: HookSourceSymbol,
    seen = new Set<string>()
  ): boolean => {
    const key = declarationKey(candidate);
    if (key === declarationKey(target)) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    const declaration = candidate.declaration;
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const initializer = unwrap(declaration.initializer);
      if (ts.isIdentifier(initializer)) {
        const next = resolveReference(initializer, candidate.module);
        return !!next && sameSourceValue(next, target, seen);
      }
    }
    return false;
  };

  const hasExternalMemberWrite = (
    target: HookSourceSymbol,
    name: string,
    module: HookSourceModule
  ): boolean => {
    const contains = (ancestor: ts.Node, descendant: ts.Node): boolean => {
      let current: ts.Node | undefined = descendant;
      while (current) {
        if (current === ancestor) return true;
        current = current.parent;
      }
      return false;
    };
    const writeOperation = (access: ts.Node): ts.Node | null => {
      let current: ts.Node = access;
      while (current.parent) {
        const parent = current.parent;
        if (ts.isBinaryExpression(parent)) {
          return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
            contains(parent.left, access)
            ? parent
            : null;
        }
        if (ts.isForInStatement(parent) || ts.isForOfStatement(parent)) {
          return contains(parent.initializer, access) ? parent : null;
        }
        if (
          (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
          parent.operand === current
        ) {
          return parent.operator === ts.SyntaxKind.PlusPlusToken ||
            parent.operator === ts.SyntaxKind.MinusMinusToken
            ? parent
            : null;
        }
        if (ts.isDeleteExpression(parent)) return parent.expression === current ? parent : null;
        if (
          ts.isParenthesizedExpression(parent) ||
          ts.isAsExpression(parent) ||
          ts.isTypeAssertionExpression(parent) ||
          ts.isNonNullExpression(parent) ||
          ts.isArrayLiteralExpression(parent) ||
          ts.isObjectLiteralExpression(parent) ||
          ts.isPropertyAssignment(parent) ||
          ts.isShorthandPropertyAssignment(parent) ||
          ts.isSpreadElement(parent) ||
          ts.isSpreadAssignment(parent)
        ) {
          current = parent;
          continue;
        }
        return null;
      }
      return null;
    };
    let conflict = false;
    const visit = (node: ts.Node): void => {
      if (conflict) return;
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        if (writeOperation(node)) {
          const root = unwrap(node.expression);
          const rootSymbol = ts.isIdentifier(root) ? resolveReference(root, module) : null;
          const member = ts.isPropertyAccessExpression(node)
            ? node.name.text
            : ts.isStringLiteralLike(node.argumentExpression)
              ? node.argumentExpression.text
              : null;
          if (
            rootSymbol &&
            sameSourceValue(rootSymbol, target) &&
            (member === null || member === name)
          )
            conflict = true;
        }
      }
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        for (const argument of node.arguments ?? []) {
          const root = unwrap(argument);
          const rootSymbol = ts.isIdentifier(root) ? resolveReference(root, module) : null;
          if (rootSymbol && sameSourceValue(rootSymbol, target)) conflict = true;
        }
        const expression = node.expression;
        if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
          const root = unwrap(expression.expression);
          const rootSymbol = ts.isIdentifier(root) ? resolveReference(root, module) : null;
          const member = ts.isPropertyAccessExpression(expression)
            ? expression.name.text
            : ts.isStringLiteralLike(expression.argumentExpression)
              ? expression.argumentExpression.text
              : null;
          if (
            rootSymbol &&
            sameSourceValue(rootSymbol, target) &&
            (member === null || member !== name)
          )
            conflict = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(module.source);
    return conflict;
  };

  function objectMemberForSymbol(
    symbol: HookSourceSymbol,
    name: string,
    seen = new Set<string>(),
    origin?: HookSourceModule
  ): HookSourceSymbol | null {
    const cacheKey = `${declarationKey(symbol)}\0${name}\0${origin?.file ?? ''}`;
    const cached = objectMemberCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const key = declarationKey(symbol);
    if (seen.has(key)) {
      objectMemberCache.set(cacheKey, null);
      return null;
    }
    seen.add(key);
    const declaration = symbol.declaration;
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      if (!isConstantDeclaration(declaration) || hasConflictingWrite(lexicalIndex, declaration, name)) {
        objectMemberCache.set(cacheKey, null);
        return null;
      }
      if (
        origin &&
        origin.file !== symbol.module.file &&
        hasExternalMemberWrite(symbol, name, origin)
      ) {
        objectMemberCache.set(cacheKey, null);
        return null;
      }
      const initializer = unwrap(declaration.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        const property = objectMember(initializer, name);
        const result = property ? { module: symbol.module, declaration: property } : null;
        objectMemberCache.set(cacheKey, result);
        return result;
      }
      if (ts.isIdentifier(initializer)) {
        const next = resolveReference(initializer, symbol.module);
        const result = next ? objectMemberForSymbol(next, name, seen, origin) : null;
        objectMemberCache.set(cacheKey, result);
        return result;
      }
      if (ts.isCallExpression(initializer)) {
        const result = returnedObjectMember(initializer, name, symbol.module, declaration);
        objectMemberCache.set(cacheKey, result);
        return result;
      }
    }
    const result = namespaceMember(symbol, name);
    objectMemberCache.set(cacheKey, result);
    return result;
  }

  function resolveReference(node: ts.Node, module: HookSourceModule): HookSourceSymbol | null {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) {
      const lexical = findLexicalBinding(lexicalIndex, value);
      if (lexical) {
        const imported = importBinding(module, value.text);
        if (imported && imported.declaration === lexical) return resolveLocal(module, value.text);
        return { module, declaration: lexical };
      }
      return resolveLocal(module, value.text);
    }
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
      const memberName = ts.isPropertyAccessExpression(value)
        ? value.name.text
        : value.argumentExpression && ts.isStringLiteralLike(value.argumentExpression)
          ? value.argumentExpression.text
          : null;
      if (!memberName) return null;
      const owner = value.expression;
      const ownerSymbol = resolveReference(owner, module);
      return ownerSymbol ? objectMemberForSymbol(ownerSymbol, memberName, new Set(), module) : null;
    }
    return null;
  }

  function isDefineSymbol(
    symbol: HookSourceSymbol,
    seen = new Set<string>(),
    name = 'defineAsHook'
  ): boolean {
    const key = declarationKey(symbol);
    if (seen.has(key)) return false;
    seen.add(key);
    const declaration = symbol.declaration;
    if (coreImportedName(declaration) === name) return true;
    if (coreExportedName(declaration) === name) return true;
    if (isCoreStarExport(declaration)) return coreStarFactoryNames.get(symbol) === name;
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      // An initializer only proves the declaration's value while that binding
      // still holds it. A `let`/`var` name, or a `const` whose object escapes
      // through a member write, has no such guarantee here.
      if (!isConstantDeclaration(declaration)) return false;
      return isDefineReference(declaration.initializer, symbol.module, seen, name);
    }
    // A destructuring initializer is the conditional default, so using it as
    // the element's value would certify a factory the author never proved.
    if (ts.isBindingElement(declaration)) return false;
    if (ts.isPropertyAssignment(declaration)) {
      return isDefineReference(declaration.initializer, symbol.module, seen, name);
    }
    if (ts.isShorthandPropertyAssignment(declaration)) {
      return isDefineReference(declaration.name, symbol.module, seen, name);
    }
    return false;
  }

  function isDefineNamespace(symbol: HookSourceSymbol, seen = new Set<string>()): boolean {
    const key = declarationKey(symbol);
    if (seen.has(key)) return false;
    seen.add(key);
    if (isCoreNamespaceImport(symbol.declaration) || isCoreNamespaceExport(symbol.declaration))
      return true;
    if (
      ts.isVariableDeclaration(symbol.declaration) &&
      symbol.declaration.initializer &&
      isConstantDeclaration(symbol.declaration)
    ) {
      return isNamespaceReference(symbol.declaration.initializer, symbol.module, seen);
    }
    return false;
  }

  function isNamespaceReference(
    node: ts.Node,
    module: HookSourceModule,
    seen: Set<string>
  ): boolean {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) {
      const symbol = resolveReference(value, module);
      return !!symbol && isDefineNamespace(symbol, seen);
    }
    return false;
  }

  function isDefineReference(
    node: ts.Node,
    module: HookSourceModule,
    seen: Set<string>,
    name = 'defineAsHook'
  ): boolean {
    const value = unwrap(node);
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
      const memberName = ts.isPropertyAccessExpression(value)
        ? value.name.text
        : value.argumentExpression && ts.isStringLiteralLike(value.argumentExpression)
          ? value.argumentExpression.text
          : null;
      if (memberName !== name) return false;
      const owner = resolveReference(value.expression, module);
      if (!owner) return false;
      if (isDefineNamespace(owner, seen)) return true;
      const member = resolveReference(value, module);
      return !!member && isDefineSymbol(member, seen, name);
    }
    if (!ts.isIdentifier(value)) return false;
    const symbol = resolveReference(value, module);
    return !!symbol && isDefineSymbol(symbol, seen, name);
  }

  const isDefineAsHookReference = (node: ts.Node, module: HookSourceModule): boolean =>
    isDefineReference(node, module, new Set(), 'defineAsHook');

  const isDefinePrototypeReference = (node: ts.Node, module: HookSourceModule): boolean =>
    isDefineReference(node, module, new Set(), 'definePrototype');

  const isDefineHookReference = (node: ts.Node, module: HookSourceModule): boolean =>
    isDefineReference(node, module, new Set(), 'defineHook');

  return {
    registerSource: source => inCanonicalQuery(() => registerSource(source)),
    moduleForSource: source => inCanonicalQuery(() => moduleForSource(source)),
    resolveModule: (from, specifier) => inCanonicalQuery(() => resolveModule(from, specifier)),
    resolveLocal: (module, name) => inCanonicalQuery(() => resolveLocal(module, name)),
    resolveExport: (module, name) => inCanonicalQuery(() => resolveExport(module, name)),
    resolveReference: (node, module) => inCanonicalQuery(() => resolveReference(node, module)),
    isDefineAsHookReference: (node, module) => inCanonicalQuery(() => isDefineAsHookReference(node, module)),
    isDefinePrototypeReference: (node, module) => inCanonicalQuery(() => isDefinePrototypeReference(node, module)),
    isDefineHookReference: (node, module) => inCanonicalQuery(() => isDefineHookReference(node, module)),
  };
}
