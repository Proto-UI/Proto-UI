import ts from 'typescript';
import path from 'node:path';
import { realpathSync, statSync } from 'node:fs';

import { createHookSourceModuleContext, type HookSourceModule } from './hook-source-module.js';
import { constantModuleHasUnmodeledEffects } from './constant-module-effects.js';

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
  while (
    node.parent &&
    (ts.isParenthesizedExpression(node.parent) ||
      ts.isAsExpression(node.parent) ||
      ts.isSatisfiesExpression(node.parent) ||
      ts.isNonNullExpression(node.parent) ||
      ts.isTypeAssertionExpression(node.parent)) &&
    node.parent.expression === node
  )
    node = node.parent;
  return node;
};

const isConst = (node: ts.VariableDeclaration): boolean =>
  ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0;

const isValueReference = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isImportSpecifier(parent) && parent.propertyName === node)
  )
    return false;
  for (let owner: ts.Node | undefined = parent; owner; owner = owner.parent) {
    if (ts.isTypeNode(owner)) return false;
    if (ts.isStatement(owner) || ts.isFunctionLike(owner)) break;
  }
  return true;
};

// Includes destructuring and deferred writes. A compound target containing a
// read is conservatively rejected instead of borrowing its pre-write value.
const isWritten = (node: ts.Node): boolean => {
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
      ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) &&
        parent.initializer === target)
    )
      return true;
    if (ts.isStatement(parent) || ts.isFunctionLike(parent)) break;
  }
  return false;
};

/**
 * One bounded token-only proof. The owner is a private const object containing
 * only own string data; every runtime reference must read one of those leaves.
 * A finite loop key is resolved by lexical declaration, never by its spelling.
 * An explicit entry additionally checks its runtime graph and production-loader
 * visibility. It does not close incoming consumers of a public mutable object.
 * Neither mode certifies derived bags, returned tokens or State.
 */
export function createFiniteTokenMapProof(
  loopRows: (loop: ts.ForOfStatement) => readonly ts.Expression[] | null,
  sharedEntry?: ts.SourceFile
): (expression: ts.Expression) => boolean {
  return createTokenMapProof(loopRows, sharedEntry, false);
}

/** A separate, entry-bound proof for own string leaves below a nested map.
 * The original flat proof keeps its existing capability boundary. Intermediate
 * objects cannot leave their source graph; a private const projection may only
 * be read through proved own leaves. Token expressions may use direct member
 * chains or one prior function-local const projection of a retained subtree. */
export function createFiniteTokenMapPathProof(
  loopRows: (loop: ts.ForOfStatement) => readonly ts.Expression[] | null,
  entry: ts.SourceFile
): (expression: ts.Expression) => boolean {
  return createTokenMapProof(loopRows, entry, true);
}

const nullTokenMapValue = Symbol('null token-map value');
type TokenMapData = string | typeof nullTokenMapValue | ReadonlyMap<string, TokenMapData>;
type TokenMapTree = ReadonlyMap<string, TokenMapData>;

function createTokenMapProof(
  loopRows: (loop: ts.ForOfStatement) => readonly ts.Expression[] | null,
  sharedEntry: ts.SourceFile | undefined,
  paths: boolean
): (expression: ts.Expression) => boolean {
  const modules = createHookSourceModuleContext();
  const maps = new WeakMap<ts.VariableDeclaration, TokenMapTree | null>();
  const closed = new WeakMap<ts.VariableDeclaration, boolean>();
  const keyCache = new WeakMap<ts.VariableDeclaration, readonly string[] | null>();
  if (sharedEntry) modules.registerSource(sharedEntry);

  const binding = (node: ts.Identifier): ts.Node | null =>
    modules.resolveReference(node, modules.moduleForSource(node.getSourceFile()))?.declaration ??
    null;

  // The row resolver supplies the finite domain, but its source inventory is
  // not an initializer snapshot. Every const alias must already hold its list
  // when that alias is registered by the production constants loader.
  const orderedRows = (expression: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    const node = unwrap(expression);
    if (ts.isArrayLiteralExpression(node))
      return node.elements.every((element) =>
        ts.isSpreadElement(element)
          ? orderedRows(element.expression, seen)
          : ts.isStringLiteralLike(unwrap(element))
      );
    if (!ts.isIdentifier(node)) return false;
    const declaration = binding(node);
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      !isConst(declaration) ||
      !declaration.initializer ||
      seen.has(declaration) ||
      (declaration.getSourceFile() === node.getSourceFile() &&
        declaration.getStart() >= node.getStart())
    )
      return false;
    return orderedRows(declaration.initializer, new Set(seen).add(declaration));
  };

  const stablePrimitive = (declaration: ts.VariableDeclaration): boolean => {
    let stable = true;
    const visit = (node: ts.Node): void => {
      if (!stable || ts.isTypeNode(node)) return;
      if (
        ts.isIdentifier(node) &&
        isValueReference(node) &&
        binding(node) === declaration &&
        isWritten(node)
      ) {
        stable = false;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(declaration.getSourceFile());
    return stable;
  };

  const keys = (expression: ts.Expression): readonly string[] | null => {
    const node = unwrap(expression);
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isTemplateExpression(node)) {
      // Interpolation is closed only when every operand is already a finite
      // primitive string. No authored coercion, getter or tagged evaluation is
      // executed. Preserve a bounded over-approximation of all lexical rows.
      let values: readonly string[] = [node.head.text];
      for (const span of node.templateSpans) {
        const parts = keys(span.expression);
        if (!parts) return null;
        const combined = new Set<string>();
        for (const prefix of values)
          for (const part of parts) {
            combined.add(prefix + part + span.literal.text);
            if (combined.size > 256) return null;
          }
        values = [...combined];
      }
      return values;
    }
    if (!ts.isIdentifier(node)) return null;
    const declaration = binding(node);
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      !ts.isIdentifier(declaration.name) ||
      !isConst(declaration) ||
      declaration.getSourceFile() !== node.getSourceFile() ||
      declaration.getStart() >= node.getStart()
    )
      return null;
    const cached = keyCache.get(declaration);
    if (cached !== undefined) return cached;
    // Cycles, rebound names and unsupported initializers retain no proof.
    keyCache.set(declaration, null);
    if (!stablePrimitive(declaration)) return null;
    if (declaration.initializer) {
      const values = keys(declaration.initializer);
      keyCache.set(declaration, values);
      return values;
    }
    const list = declaration.parent;
    const loop = list.parent;
    if (
      !ts.isVariableDeclarationList(list) ||
      list.declarations.length !== 1 ||
      !ts.isForOfStatement(loop) ||
      loop.initializer !== list ||
      loop.awaitModifier
    )
      return null;
    const iterable = unwrap(loop.expression);
    if (ts.isIdentifier(iterable)) {
      // The callback reads module constants. A function-local shadow must not
      // borrow a same-named module list's finite values.
      const module = modules.moduleForSource(loop.getSourceFile());
      const actual = modules.resolveReference(iterable, module);
      const global = modules.resolveLocal(module, iterable.text);
      if (
        !actual ||
        !global ||
        actual.declaration !== global.declaration ||
        actual.module.source !== global.module.source ||
        (actual.module.source === loop.getSourceFile() &&
          actual.declaration.getStart() >= loop.getStart())
      )
        return null;
    } else if (
      !ts.isArrayLiteralExpression(iterable) ||
      !iterable.elements.every((element) => ts.isStringLiteralLike(unwrap(element)))
    )
      return null;
    if (!orderedRows(loop.expression)) return null;
    const rows = loopRows(loop);
    if (!rows || rows.length === 0 || rows.length > 256) return null;
    const values: string[] = [];
    for (const row of rows) {
      const value = unwrap(row);
      if (!ts.isStringLiteralLike(value)) return null;
      values.push(value.text);
    }
    keyCache.set(declaration, values);
    return values;
  };

  const readKeys = (
    node: ts.PropertyAccessExpression | ts.ElementAccessExpression
  ): readonly string[] | null =>
    ts.isPropertyAccessExpression(node)
      ? [node.name.text]
      : node.argumentExpression
        ? keys(node.argumentExpression)
        : null;

  const literalTree = (input: ts.Node, depth = 0): TokenMapData | null => {
    const node = unwrap(input);
    if (ts.isStringLiteralLike(node)) return node.text;
    // A root row may omit its whole recipe. Retained subtrees still contain
    // only own string leaves; this does not admit arbitrary nullable fields.
    if (node.kind === ts.SyntaxKind.NullKeyword) return depth === 1 ? nullTokenMapValue : null;
    if (!ts.isObjectLiteralExpression(node)) return null;
    const data = new Map<string, TokenMapData>();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) return null;
      const name = property.name;
      if (!ts.isIdentifier(name) && !ts.isStringLiteralLike(name)) return null;
      if (name.text in Object.prototype || data.has(name.text)) return null;
      const value = literalTree(property.initializer, depth + 1);
      if (value === null) return null;
      data.set(name.text, value);
    }
    return data.size ? data : null;
  };

  const literalMap = (declaration: ts.VariableDeclaration): TokenMapTree | null => {
    const cached = maps.get(declaration);
    if (cached !== undefined) return cached;
    maps.set(declaration, null);
    if (!isConst(declaration) || !declaration.initializer) return null;
    const statement = declaration.parent.parent;
    if (
      (ts.isVariableStatement(statement) &&
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) ||
      modules
        .resolveExports(modules.moduleForSource(declaration.getSourceFile()))
        .some((symbol) => symbol.declaration === declaration)
    )
      return null;
    const initial = unwrap(declaration.initializer);
    if (!ts.isObjectLiteralExpression(initial)) return null;
    if (paths) {
      const tree = literalTree(initial);
      if (tree === null || typeof tree === 'string' || tree === nullTokenMapValue) return null;
      maps.set(declaration, tree);
      return tree;
    }
    const data = new Map<string, string>();
    for (const property of initial.properties) {
      if (!ts.isPropertyAssignment(property)) return null;
      const name = property.name;
      if (!ts.isIdentifier(name) && !ts.isStringLiteralLike(name)) return null;
      if (name.text in Object.prototype || data.has(name.text)) return null;
      const value = unwrap(property.initializer);
      if (!ts.isStringLiteralLike(value)) return null;
      data.set(name.text, value.text);
    }
    if (data.size === 0) return null;
    maps.set(declaration, data);
    return data;
  };

  // Shared admission is separate from the private proof below. It binds all
  // imports and references to one actual entry graph, never merely to an
  // exported object's declaration or TypeScript readonly annotation.
  const graphs = new WeakMap<
    ts.SourceFile,
    {
      sources: HookSourceModule[];
      dependencies: Map<string, Set<string>>;
      entryFile: string;
    } | null
  >();
  const moduleEffects = new WeakMap<ts.SourceFile, boolean>();
  const sourceGraph = (current: ts.SourceFile) => {
    if (graphs.has(current)) return graphs.get(current) ?? null;
    if (!sharedEntry) return null;
    const root = sharedEntry.fileName === current.fileName ? current : sharedEntry;
    modules.registerSource(root);
    modules.registerSource(current);
    const entry = modules.moduleForSource(root);
    const pending = [entry, modules.moduleForSource(current)];
    const reached = new Map<string, HookSourceModule>();
    const dependencies = new Map<string, Set<string>>();
    let safe = true;
    while (safe && pending.length) {
      const module = pending.pop()!;
      if (reached.has(module.file)) continue;
      reached.set(module.file, module);
      const imports = new Set<string>();
      dependencies.set(module.file, imports);
      const edge = (specifier: ts.Expression) => {
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
        if (ts.isImportDeclaration(statement)) {
          if (!statement.importClause?.isTypeOnly) edge(statement.moduleSpecifier);
        } else if (ts.isExportDeclaration(statement)) {
          if (!statement.isTypeOnly && statement.moduleSpecifier) edge(statement.moduleSpecifier);
        } else if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) safe = false;
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
      ? { sources: [...reached.values()], dependencies, entryFile: entry.file }
      : null;
    graphs.set(current, result);
    return result;
  };

  const dataImport = (module: HookSourceModule, specifier: string): HookSourceModule | null => {
    // Match the actual constants loader's candidate order and physical file.
    // TypeScript path aliases and .js-to-.ts substitution alone are not proof
    // that production collected the imported value.
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(module.file), specifier);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mts`,
      `${base}.js`,
      `${base}.mjs`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
      path.join(base, 'index.js'),
    ];
    let actual: string | undefined;
    for (const candidate of candidates) {
      try {
        if (statSync(candidate).isFile()) {
          actual = realpathSync(candidate);
          break;
        }
      } catch {
        /* Continue the producer's ordinary candidate search. */
      }
    }
    if (!actual) return null;
    const target = modules.resolveModule(module.file, specifier);
    return target?.file === actual ? target : null;
  };

  // The producer loads ordinary named constants/re-exports, not arbitrary
  // default or namespace exports and not export-star token inventories.
  const loadableExport = (
    module: HookSourceModule,
    name: string,
    declaration: ts.VariableDeclaration,
    seen = new Set<string>()
  ): boolean => {
    const key = `${module.file}\0${name}`;
    if (seen.has(key)) return false;
    const next = new Set(seen).add(key);
    for (const statement of module.source.statements) {
      if (
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const value of statement.declarationList.declarations)
          if (ts.isIdentifier(value.name) && value.name.text === name && value === declaration)
            return true;
      }
      if (
        !ts.isExportDeclaration(statement) ||
        statement.isTypeOnly ||
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)
      )
        continue;
      for (const item of statement.exportClause.elements) {
        if (item.isTypeOnly || item.name.text !== name) continue;
        const local = (item.propertyName ?? item.name).text;
        if (!statement.moduleSpecifier) return loadableLocal(module, local, declaration, next);
        if (!ts.isStringLiteralLike(statement.moduleSpecifier)) return false;
        const target = dataImport(module, statement.moduleSpecifier.text);
        return !!target && loadableExport(target, local, declaration, next);
      }
    }
    return false;
  };
  const loadableLocal = (
    module: HookSourceModule,
    name: string,
    declaration: ts.VariableDeclaration,
    seen: Set<string>
  ): boolean => {
    if (modules.resolveLocal(module, name)?.declaration !== declaration) return false;
    if (module.source === declaration.getSourceFile()) return true;
    for (const statement of module.source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        statement.importClause?.isTypeOnly ||
        !ts.isStringLiteralLike(statement.moduleSpecifier)
      )
        continue;
      const named = statement.importClause?.namedBindings;
      if (!named || !ts.isNamedImports(named)) continue;
      for (const item of named.elements) {
        if (item.isTypeOnly || item.name.text !== name) continue;
        const target = dataImport(module, statement.moduleSpecifier.text);
        return (
          !!target &&
          loadableExport(target, (item.propertyName ?? item.name).text, declaration, seen)
        );
      }
    }
    return false;
  };
  const loadableRead = (owner: ts.Identifier, declaration: ts.VariableDeclaration): boolean =>
    owner.getSourceFile() === declaration.getSourceFile() ||
    loadableLocal(
      modules.moduleForSource(owner.getSourceFile()),
      owner.text,
      declaration,
      new Set()
    );
  const childValues = (
    values: readonly TokenMapData[],
    member: ts.PropertyAccessExpression | ts.ElementAccessExpression
  ): readonly TokenMapData[] | null => {
    if (member.questionDotToken) return null;
    const names = readKeys(member);
    if (!names || names.length === 0) return null;
    const next = new Set<TokenMapData>();
    for (const value of values) {
      if (typeof value === 'string' || value === nullTokenMapValue) return null;
      for (const name of names) {
        const child = value.get(name);
        if (child === undefined) return null;
        next.add(child);
      }
    }
    return [...next];
  };

  // A private const projection cannot change between its truthiness test and
  // a callback created in that branch. The full owner-use proof below still
  // rejects reassignment, mutation, aliases and escaped child objects. Only
  // this exact binding's positive if branch removes an own literal null;
  // unrelated conditions and reads outside that branch gain no evidence.
  const truthyProjection = (reference: ts.Identifier): boolean => {
    const declaration = binding(reference);
    if (!declaration || !ts.isVariableDeclaration(declaration) || !isConst(declaration))
      return false;
    for (let child: ts.Node = reference; child.parent; child = child.parent) {
      const parent = child.parent;
      if (!ts.isIfStatement(parent) || parent.thenStatement !== child) continue;
      const condition = unwrap(parent.expression);
      if (ts.isIdentifier(condition) && binding(condition) === declaration) return true;
    }
    return false;
  };

  const guardedValues = (
    reference: ts.Identifier,
    values: readonly TokenMapData[]
  ): readonly TokenMapData[] =>
    values.includes(nullTokenMapValue) && truthyProjection(reference)
      ? values.filter((value) => value !== nullTokenMapValue)
      : values;

  type TokenMapPath = {
    owner: ts.Identifier;
    declaration: ts.VariableDeclaration;
    data: TokenMapTree;
    values: readonly TokenMapData[];
    depth: number;
  };
  const directPath = (expression: ts.Expression, allowProjection = true): TokenMapPath | null => {
    const members: (ts.PropertyAccessExpression | ts.ElementAccessExpression)[] = [];
    let owner = unwrap(expression);
    while (ts.isPropertyAccessExpression(owner) || ts.isElementAccessExpression(owner)) {
      if (owner.questionDotToken) return null;
      members.unshift(owner);
      owner = unwrap(owner.expression);
    }
    if (!ts.isIdentifier(owner)) return null;
    const reference = owner;
    const held = binding(owner);
    if (
      !held ||
      !ts.isVariableDeclaration(held) ||
      !ts.isIdentifier(held.name) ||
      (held.getSourceFile() === owner.getSourceFile() && held.getStart() >= owner.getStart())
    )
      return null;
    let declaration = held;
    let data = literalMap(declaration);
    let values: readonly TokenMapData[];
    let depth = members.length;
    if (data) {
      values = [data];
    } else {
      // Only one exact local const projection. No root aliases, parameter
      // values, returned bags, conditional initializers or alias forwarding.
      if (
        !allowProjection ||
        !isConst(held) ||
        !held.initializer ||
        held.getSourceFile() !== owner.getSourceFile() ||
        !ts.findAncestor(held, ts.isFunctionLike)
      )
        return null;
      const projection = directPath(held.initializer, false);
      if (
        !projection ||
        projection.depth === 0 ||
        projection.values.some((value) => typeof value === 'string')
      )
        return null;
      owner = projection.owner;
      declaration = projection.declaration;
      data = projection.data;
      values = projection.values;
      depth += projection.depth;
    }
    values = guardedValues(reference, values);
    if (values.length === 0) return null;
    for (const member of members) {
      const children = childValues(values, member);
      if (!children) return null;
      values = children;
    }
    if (!ts.isIdentifier(owner)) return null;
    return { owner, declaration, data, values, depth };
  };

  // The shared object's lifetime includes every retained child object. A
  // child may be named once by a private const, but all references to that exact
  // declaration must end in primitive own leaves. Aliasing the root, forwarding
  // a child again, returning it or passing it to an unknown consumer stays open.
  const closedPathUse = (
    reference: ts.Identifier,
    values: readonly TokenMapData[],
    allowProjection: boolean
  ): boolean => {
    let node = outer(reference);
    if (ts.isIfStatement(node.parent) && node.parent.expression === node)
      return values.every((value) => typeof value !== 'string');
    values = guardedValues(reference, values);
    if (values.length === 0) return false;
    let depth = 0;
    while (
      node.parent &&
      (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) &&
      node.parent.expression === node
    ) {
      const member = node.parent;
      const children = childValues(values, member);
      if (!children || isWritten(outer(member))) return false;
      values = children;
      node = outer(member);
      depth++;
      // A primitive can be consumed without exposing the retained object.
      if (values.every((value) => typeof value === 'string')) return true;
    }
    if (!allowProjection || depth === 0 || values.some((value) => typeof value === 'string'))
      return false;
    const declaration = node.parent;
    if (
      !ts.isVariableDeclaration(declaration) ||
      declaration.initializer !== node ||
      !ts.isIdentifier(declaration.name) ||
      !isConst(declaration) ||
      !ts.isVariableStatement(declaration.parent.parent) ||
      declaration.parent.parent.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    )
      return false;
    let safe = true;
    const visit = (child: ts.Node): void => {
      if (!safe || ts.isTypeNode(child)) return;
      if (ts.isIdentifier(child) && isValueReference(child) && binding(child) === declaration) {
        if (declaration.getStart() >= child.getStart() || !closedPathUse(child, values, false)) {
          safe = false;
          return;
        }
      }
      ts.forEachChild(child, visit);
    };
    visit(declaration.getSourceFile());
    return safe;
  };

  const sharedFacts = new WeakMap<ts.VariableDeclaration, WeakMap<ts.SourceFile, boolean>>();
  const sharedOwnerIsClosed = (
    declaration: ts.VariableDeclaration,
    data: TokenMapTree,
    current: ts.SourceFile
  ): boolean => {
    let cache = sharedFacts.get(declaration);
    if (!cache) {
      cache = new WeakMap();
      sharedFacts.set(declaration, cache);
    }
    const known = cache.get(current);
    if (known !== undefined) return known;
    cache.set(current, false);
    const result = proveSharedOwner(declaration, data, current);
    cache.set(current, result);
    return result;
  };
  const proveSharedOwner = (
    declaration: ts.VariableDeclaration,
    data: TokenMapTree,
    current: ts.SourceFile
  ): boolean => {
    const graph = sourceGraph(current);
    if (!graph) return false;
    const reachesOwner = new Set([modules.moduleForSource(declaration.getSourceFile()).file]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [file, imports] of graph.dependencies) {
        if (!reachesOwner.has(file) && [...imports].some((target) => reachesOwner.has(target))) {
          reachesOwner.add(file);
          changed = true;
        }
      }
    }
    let safe = true;
    for (const module of graph.sources) {
      if (module.file !== graph.entryFile && reachesOwner.has(module.file)) {
        let effects = moduleEffects.get(module.source);
        if (effects === undefined) {
          effects = constantModuleHasUnmodeledEffects(module.source);
          moduleEffects.set(module.source, effects);
        }
        if (effects) return false;
      }
      for (const statement of module.source.statements) {
        // A namespace can expose this same mutable object without a named
        // lexical reference. Keep it outside this leaf-only proof.
        const namespace = ts.isImportDeclaration(statement)
          ? !statement.importClause?.isTypeOnly &&
            statement.importClause?.namedBindings &&
            ts.isNamespaceImport(statement.importClause.namedBindings)
          : ts.isExportDeclaration(statement) &&
            !statement.isTypeOnly &&
            statement.exportClause &&
            ts.isNamespaceExport(statement.exportClause);
        if (
          namespace &&
          (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
          statement.moduleSpecifier &&
          ts.isStringLiteralLike(statement.moduleSpecifier)
        ) {
          const target = modules.resolveModule(module.file, statement.moduleSpecifier.text);
          if (!target || reachesOwner.has(target.file)) return false;
        }
      }
      const visit = (node: ts.Node): void => {
        if (!safe || ts.isTypeNode(node)) return;
        if (ts.isIdentifier(node) && isValueReference(node) && binding(node) === declaration) {
          if (ts.isImportSpecifier(node.parent) || ts.isExportSpecifier(node.parent)) return;
          if (paths) {
            if (
              (declaration.getSourceFile() === node.getSourceFile() &&
                declaration.getStart() >= node.getStart()) ||
              !closedPathUse(node, [data], true)
            )
              safe = false;
            return;
          }
          const receiver = outer(node),
            member = receiver.parent;
          if (
            (declaration.getSourceFile() === node.getSourceFile() &&
              declaration.getStart() >= node.getStart()) ||
            !member ||
            (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) ||
            member.expression !== receiver ||
            member.questionDotToken
          ) {
            safe = false;
            return;
          }
          const names = readKeys(member);
          if (!names || names.some((name) => !data.has(name)) || isWritten(outer(member))) {
            safe = false;
            return;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(module.source);
      if (!safe) return false;
    }
    return safe;
  };

  const ownerIsClosed = (declaration: ts.VariableDeclaration, data: TokenMapTree): boolean => {
    const cached = closed.get(declaration);
    if (cached !== undefined) return cached;
    let safe = true;
    const visit = (node: ts.Node): void => {
      if (!safe || ts.isTypeNode(node)) return;
      if (
        ts.isWithStatement(node) ||
        (ts.isCallExpression(node) &&
          ts.isIdentifier(unwrap(node.expression)) &&
          (unwrap(node.expression) as ts.Identifier).text === 'eval')
      ) {
        safe = false;
        return;
      }
      if (ts.isIdentifier(node) && isValueReference(node) && binding(node) === declaration) {
        const receiver = outer(node);
        const member = receiver.parent;
        if (
          declaration.getStart() >= node.getStart() ||
          !member ||
          (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) ||
          member.expression !== receiver ||
          member.questionDotToken
        ) {
          safe = false;
          return;
        }
        const names = readKeys(member);
        if (!names || names.some((name) => !data.has(name)) || isWritten(outer(member))) {
          safe = false;
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(declaration.getSourceFile());
    closed.set(declaration, safe);
    return safe;
  };

  return (expression) => {
    if (paths) {
      const path = directPath(expression);
      return !!(
        path &&
        path.depth >= 2 &&
        path.values.length > 0 &&
        path.values.every((value) => typeof value === 'string') &&
        loadableRead(path.owner, path.declaration) &&
        sharedOwnerIsClosed(path.declaration, path.data, expression.getSourceFile())
      );
    }
    const node = unwrap(expression);
    if (
      (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) ||
      node.questionDotToken
    )
      return false;
    const owner = unwrap(node.expression);
    if (!ts.isIdentifier(owner)) return false;
    const declaration = binding(owner);
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      !ts.isIdentifier(declaration.name) ||
      (!sharedEntry && declaration.getSourceFile() !== expression.getSourceFile()) ||
      (declaration.getSourceFile() === expression.getSourceFile() &&
        declaration.getStart() >= node.getStart())
    )
      return false;
    const data = literalMap(declaration);
    const names = readKeys(node);
    return !!(
      data &&
      names &&
      names.every((name) => data.has(name)) &&
      (sharedEntry
        ? loadableRead(owner, declaration) &&
          sharedOwnerIsClosed(declaration, data, expression.getSourceFile())
        : ownerIsClosed(declaration, data))
    );
  };
}
