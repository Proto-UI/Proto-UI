import ts from 'typescript';

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

const constant = (node: ts.VariableDeclaration): boolean =>
  ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0;

const rowDeclaration = (node: ts.Node | undefined): ts.Node | null =>
  node && ts.isIdentifier(node) && ts.isParameter(node.parent) && node.parent.name === node
    ? node.parent
    : (node ?? null);

const written = (node: ts.Node): boolean => {
  for (let target = node; target.parent; target = target.parent) {
    const parent = target.parent;
    // A computed key is evaluated as a value even when the containing member
    // is a write target. Writing copy[ROWS[0]] cannot write into ROWS.
    if (
      (ts.isElementAccessExpression(parent) && parent.argumentExpression === target) ||
      ts.isComputedPropertyName(parent)
    )
      return false;
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
      ((ts.isForOfStatement(parent) || ts.isForInStatement(parent)) &&
        parent.initializer === target)
    )
      return true;
    if (ts.isStatement(parent) || ts.isFunctionLike(parent)) break;
  }
  return false;
};

const reference = (node: ts.Node): boolean => {
  if (!ts.isIdentifier(node))
    return ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node);
  const parent = node.parent;
  return !(
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node)
  );
};

/**
 * A list's declaration is not its runtime lifetime. A sibling import can
 * mutate the same exported array from a zero-argument closure. Keep the exact
 * inventory entry's runtime graph, including when its Rule is replayed in a
 * helper, and require every reference to these string lists to preserve them.
 * This does not execute helpers or certify arbitrary containers as immutable.
 */
export function createFiniteRowLifetimeProof(
  entry: ts.SourceFile
): (
  expression: ts.Expression,
  parameterSources?: ReadonlyMap<ts.ParameterDeclaration, ts.Expression>
) => boolean {
  const modules = createHookSourceModuleContext();
  const graphs = new WeakMap<ts.SourceFile, readonly HookSourceModule[] | null>();
  const facts = new WeakMap<ts.SourceFile, Map<string, boolean>>();
  const dependencies = new WeakMap<ts.SourceFile, Map<string, Set<string>>>();
  const entryFiles = new WeakMap<ts.SourceFile, string>();
  const moduleEffects = new WeakMap<ts.SourceFile, boolean>();
  const parameterOwners = new WeakMap<ts.Node, boolean>();
  const includesIntrinsics = new WeakMap<ts.SourceFile, boolean>();

  const closedParameterOwner = (parameter: ts.ParameterDeclaration): boolean => {
    const owner = parameter.parent;
    const cached = parameterOwners.get(owner);
    if (cached !== undefined) return cached;
    let safe =
      (ts.isFunctionDeclaration(owner) ||
        ts.isFunctionExpression(owner) ||
        ts.isArrowFunction(owner)) &&
      !!owner.body &&
      !owner.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) &&
      !('asteriskToken' in owner && owner.asteriskToken);
    const visit = (node: ts.Node): void => {
      if (!safe || ts.isTypeNode(node)) return;
      // A positional arguments alias can expose the same array without a
      // lexical reference to its named parameter.
      if (ts.isIdentifier(node) && node.text === 'arguments' && reference(node)) {
        safe = false;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(owner);
    parameterOwners.set(owner, safe);
    return safe;
  };

  const graph = (current: ts.SourceFile): readonly HookSourceModule[] | null => {
    if (graphs.has(current)) return graphs.get(current) ?? null;
    // The current parse wins over an earlier parse of the same entry. Never
    // replace caller-provided text with a fresh read from the filesystem.
    const root = entry.fileName === current.fileName ? current : entry;
    modules.registerSource(root);
    modules.registerSource(current);
    const rootModule = modules.moduleForSource(root);
    entryFiles.set(current, rootModule.file);
    const pending = [rootModule, modules.moduleForSource(current)];
    const reached = new Map<string, HookSourceModule>();
    const edges = new Map<string, Set<string>>();
    dependencies.set(current, edges);
    let closed = true;
    while (closed && pending.length) {
      const module = pending.pop()!;
      if (reached.has(module.file)) continue;
      reached.set(module.file, module);
      const imports = new Set<string>();
      edges.set(module.file, imports);
      const edge = (specifier: ts.Expression): void => {
        if (!ts.isStringLiteralLike(specifier)) {
          closed = false;
          return;
        }
        // Core is the compiler's existing trusted factory/DSL ABI. Every other
        // runtime import must resolve to actual source in this graph.
        if (specifier.text === '@proto.ui/core') return;
        const target = modules.resolveModule(module.file, specifier.text);
        if (!target) {
          closed = false;
          return;
        }
        imports.add(target.file);
        pending.push(target);
      };
      for (const statement of module.source.statements) {
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          if (clause?.isTypeOnly) continue;
          edge(statement.moduleSpecifier);
        } else if (ts.isExportDeclaration(statement)) {
          if (statement.isTypeOnly || !statement.moduleSpecifier) continue;
          edge(statement.moduleSpecifier);
        } else if (ts.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) {
          closed = false;
        }
      }
      const opaque = (node: ts.Node): void => {
        if (!closed || ts.isTypeNode(node)) return;
        if (
          ts.isWithStatement(node) ||
          (ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(unwrap(node.expression)) &&
                ['eval', 'require'].includes((unwrap(node.expression) as ts.Identifier).text))))
        ) {
          closed = false;
          return;
        }
        ts.forEachChild(node, opaque);
      };
      opaque(module.source);
    }
    const result = closed ? [...reached.values()] : null;
    graphs.set(current, result);
    return result;
  };

  // Receiver references alone cannot justify a native method after authored
  // code has changed Array.prototype. Inspect this entry's resolved runtime
  // graph once, including sibling helpers. Core remains the existing trusted
  // ABI boundary. This proves only these authored intrinsic accesses; it does
  // not execute arbitrary code or make a whole-JavaScript purity claim.
  const authoredIncludesIntrinsicIsClosed = (current: ts.SourceFile): boolean => {
    const cached = includesIntrinsics.get(current);
    if (cached !== undefined) return cached;
    const sources = graph(current);
    if (!sources) return false;
    const stringKey = (input: ts.Node, active = new Set<ts.Node>()): string | null => {
      const node = unwrap(input);
      if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
      if (!ts.isIdentifier(node)) return null;
      const declaration = modules.resolveReference(
        node,
        modules.moduleForSource(node.getSourceFile())
      )?.declaration;
      if (
        !declaration ||
        !ts.isVariableDeclaration(declaration) ||
        !constant(declaration) ||
        !declaration.initializer ||
        active.has(declaration) ||
        declaration.getSourceFile() !== node.getSourceFile() ||
        declaration.getStart() >= node.getStart()
      )
        return null;
      return stringKey(declaration.initializer, new Set(active).add(declaration));
    };
    const memberName = (node: ts.Node): string | null =>
      ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isElementAccessExpression(node)
          ? stringKey(node.argumentExpression)
          : null;
    const globalReference = (node: ts.Node, module: HookSourceModule): node is ts.Identifier =>
      ts.isIdentifier(node) && reference(node) && !modules.resolveReference(node, module);
    const passiveOwnValue = (input: ts.Node): boolean => {
      const node = unwrap(input);
      if (
        ts.isStringLiteralLike(node) ||
        ts.isNumericLiteral(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword
      )
        return true;
      if (ts.isArrayLiteralExpression(node)) return node.elements.every(passiveOwnValue);
      return (
        ts.isObjectLiteralExpression(node) &&
        node.properties.every(
          (property) =>
            (ts.isPropertyAssignment(property) &&
              !ts.isComputedPropertyName(property.name) &&
              passiveOwnValue(property.initializer)) ||
            (ts.isMethodDeclaration(property) && !ts.isComputedPropertyName(property.name))
        )
      );
    };
    const ownBusinessMember = (
      input: ts.Expression,
      module: HookSourceModule,
      name: string,
      copiedReceiver: boolean
    ): boolean => {
      const receiver = unwrap(input);
      const declaration = ts.isIdentifier(receiver)
        ? modules.resolveReference(receiver, module)?.declaration
        : null;
      const object = ts.isObjectLiteralExpression(receiver)
        ? receiver
        : declaration &&
            ts.isVariableDeclaration(declaration) &&
            constant(declaration) &&
            declaration.getSourceFile() === input.getSourceFile() &&
            declaration.initializer
          ? unwrap(declaration.initializer)
          : null;
      if (!object || !ts.isObjectLiteralExpression(object) || !passiveOwnValue(object))
        return false;
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        ts.isVariableStatement(declaration.parent.parent) &&
        declaration.parent.parent.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        )
      )
        return false;
      const properties = object.properties.filter(
        (property) =>
          !ts.isSpreadAssignment(property) &&
          !ts.isComputedPropertyName(property.name) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
          property.name.text === name
      );
      if (properties.length !== 1) return false;
      if (!declaration) return true; // This exact literal supplies an own member.
      let closed = true;
      const visit = (node: ts.Node): void => {
        if (!closed || ts.isTypeNode(node)) return;
        if (
          ts.isIdentifier(node) &&
          reference(node) &&
          modules.resolveReference(node, module)?.declaration === declaration
        ) {
          // This exact destructuring read copies the proven own value. It is
          // not permission for another alias, return or opaque owner escape.
          if (copiedReceiver && node === receiver) return;
          const value = outer(node),
            member = value.parent;
          if (
            (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) ||
            member.expression !== value ||
            member.questionDotToken ||
            memberName(member) === null
          ) {
            closed = false;
            return;
          }
          const used = outer(member),
            parent = used.parent;
          // A deeper member write does not replace this own property's value.
          if (
            memberName(member) === name &&
            !(
              (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
              parent.expression === used
            ) &&
            written(used)
          ) {
            closed = false;
            return;
          }
          if (ts.isCallExpression(parent) && parent.expression === used) {
            const method = object.properties.find(
              (property) =>
                !ts.isSpreadAssignment(property) &&
                !ts.isComputedPropertyName(property.name) &&
                (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
                property.name.text === memberName(member)
            );
            const fn =
              method && ts.isMethodDeclaration(method)
                ? method
                : method && ts.isPropertyAssignment(method)
                  ? unwrap(method.initializer)
                  : null;
            if (
              !fn ||
              (!ts.isMethodDeclaration(fn) &&
                !ts.isFunctionExpression(fn) &&
                !ts.isArrowFunction(fn))
            ) {
              closed = false;
              return;
            }
            const receiverUse = (child: ts.Node): void => {
              if (
                child.kind === ts.SyntaxKind.ThisKeyword ||
                child.kind === ts.SyntaxKind.SuperKeyword ||
                (ts.isIdentifier(child) && child.text === 'arguments')
              )
                closed = false;
              if (closed) ts.forEachChild(child, receiverUse);
            };
            receiverUse(fn);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(declaration.getSourceFile());
      return closed;
    };
    const memberReadIsClosed = (
      receiver: ts.Expression | undefined,
      name: string | null,
      module: HookSourceModule,
      copiedReceiver = false
    ): boolean =>
      name !== null &&
      ((name !== 'constructor' && name !== '__proto__') ||
        (!!receiver && ownBusinessMember(receiver, module, name, copiedReceiver)));
    const propertyKey = (name: ts.PropertyName): string | null =>
      ts.isComputedPropertyName(name)
        ? stringKey(name.expression)
        : ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
          ? name.text
          : null;
    const assignmentPattern = (
      object: ts.ObjectLiteralExpression
    ): { receiver?: ts.Expression } | null => {
      let value: ts.Node = outer(object);
      while (value.parent) {
        const parent = value.parent;
        if (
          ts.isBinaryExpression(parent) &&
          parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
        )
          return parent.left === value
            ? { receiver: value === outer(object) ? parent.right : undefined }
            : null;
        if (ts.isForOfStatement(parent) || ts.isForInStatement(parent))
          return parent.initializer === value ? {} : null;
        // Nested object/array assignment patterns have no independently
        // proved receiver; do not borrow the outer object's own-member fact.
        if (ts.isPropertyAssignment(parent) && parent.initializer === value) value = parent;
        else if (ts.isObjectLiteralExpression(parent) || ts.isArrayLiteralExpression(parent))
          value = outer(parent);
        else return null;
      }
      return null;
    };
    const namespaces = new Set(['globalThis', 'global', 'window', 'self']);
    const constructors = new Set(['Array', 'Object', 'Reflect', 'Function', 'eval']);
    let safe = true;
    for (const module of sources) {
      const visit = (node: ts.Node): void => {
        if (
          !safe ||
          ts.isTypeNode(node) ||
          ts.isImportDeclaration(node) ||
          ts.isExportDeclaration(node)
        )
          return;
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
          const name = memberName(node);
          // An own passive business member has a source identity. Inherited
          // constructors can instead expose Function/Object/Array intrinsics.
          safe &&= memberReadIsClosed(node.expression, name, module);
        } else if (ts.isObjectBindingPattern(node)) {
          // Variable, parameter, catch and for-of binding patterns perform the
          // same inherited property lookup as dot/bracket access. Only an
          // exact variable initializer supplies an own receiver here.
          const receiver =
            ts.isVariableDeclaration(node.parent) && node.parent.name === node
              ? node.parent.initializer
              : undefined;
          for (const element of node.elements) {
            if (element.dotDotDotToken) continue;
            const name = element.propertyName
              ? propertyKey(element.propertyName)
              : ts.isIdentifier(element.name)
                ? element.name.text
                : null;
            safe &&= memberReadIsClosed(receiver, name, module, true);
          }
        } else if (ts.isObjectLiteralExpression(node)) {
          const pattern = assignmentPattern(node);
          if (pattern)
            for (const property of node.properties) {
              if (ts.isSpreadAssignment(property)) continue;
              safe &&= memberReadIsClosed(
                pattern.receiver,
                propertyKey(property.name),
                module,
                true
              );
            }
        }
        if (globalReference(node, module)) {
          const value = outer(node);
          const parent = value.parent;
          const member =
            parent &&
            (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
            parent.expression === value &&
            !parent.questionDotToken
              ? parent
              : null;
          const name = member && memberName(member);
          const called = member && outer(member).parent;
          const directCall = !!(
            member &&
            called &&
            ts.isCallExpression(called) &&
            called.expression === outer(member) &&
            !called.questionDotToken
          );
          if (node.text === 'Array') {
            // The constructor must not escape through an alias, a dynamic
            // member or a prototype read. The direct type predicate is inert.
            safe &&= !!(name === 'isArray' && directCall);
          } else if (node.text === 'Function' || node.text === 'eval') {
            safe = false;
          } else if (namespaces.has(node.text)) {
            safe &&= !!(name && !constructors.has(name) && !namespaces.has(name));
          } else if (node.text === 'Object' || node.text === 'Reflect') {
            // An unknown returned prototype/property can expose the same
            // intrinsic. Keep a discarded ordinary reflection call, but never
            // assume its retained result is a passive business object.
            safe &&= !!(name && directCall);
            if (
              safe &&
              called &&
              ts.isCallExpression(called) &&
              [
                'getPrototypeOf',
                'get',
                'getOwnPropertyDescriptor',
                'getOwnPropertyDescriptors',
              ].includes(name!) &&
              !ts.isExpressionStatement(outer(called).parent)
            )
              safe = false;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(module.source);
      if (!safe) break;
    }
    includesIntrinsics.set(current, safe);
    return safe;
  };

  const preserves = (
    declarations: ReadonlySet<ts.VariableDeclaration | ts.ParameterDeclaration>,
    current: ts.SourceFile
  ): boolean => {
    if (!declarations.size) return true; // An inline string array has no shared owner.
    const sources = graph(current);
    if (!sources) return false;
    const key = [...declarations]
      .map((node) => `${node.getSourceFile().fileName}:${node.pos}`)
      .sort()
      .join('\0');
    let cache = facts.get(current);
    if (!cache) {
      cache = new Map();
      facts.set(current, cache);
    }
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const arrays = new Set<ts.Node>(declarations);
    const binding = (node: ts.Node, module: HookSourceModule): ts.Node | null =>
      rowDeclaration(modules.resolveReference(unwrap(node), module)?.declaration);
    // A const alias shares the array; copied spreads do not. Mutable aliases
    // and container construction are refused by the reference check below.
    let added = true;
    while (added) {
      added = false;
      for (const module of sources) {
        const visit = (node: ts.Node): void => {
          if (ts.isTypeNode(node)) return;
          if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            constant(node) &&
            node.initializer &&
            arrays.has(binding(node.initializer, module)!)
          ) {
            if (!arrays.has(node)) {
              arrays.add(node);
              added = true;
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(module.source);
      }
    }
    // A namespace may forward another namespace which exposes the array.
    // Use the dependency closure as a conservative namespace escape boundary;
    // do not rely only on direct named exports.
    const reachesRows = new Set(
      [...arrays].map((node) => modules.moduleForSource(node.getSourceFile()).file)
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const [file, imports] of dependencies.get(current) ?? []) {
        if (!reachesRows.has(file) && [...imports].some((target) => reachesRows.has(target))) {
          reachesRows.add(file);
          changed = true;
        }
      }
    }
    // The production module loader taints its imported token graphs when a
    // module has an unmodeled initializer. A sibling module can therefore
    // withdraw these exact rows without an explicit array write in this AST.
    // Reuse that admission; do not certify an importer the producer rejects.
    for (const module of sources) {
      if (module.file === entryFiles.get(current) || !reachesRows.has(module.file)) continue;
      let effects = moduleEffects.get(module.source);
      if (effects === undefined) {
        effects = constantModuleHasUnmodeledEffects(module.source);
        moduleEffects.set(module.source, effects);
      }
      if (effects) {
        cache.set(key, false);
        return false;
      }
    }
    const rowNamespace = (declaration: ts.Node): boolean => {
      // The module resolver intentionally represents a namespace re-export
      // by its whole ExportDeclaration, not the NamespaceExport child.
      const owner = ts.isNamespaceImport(declaration)
        ? declaration.parent.parent
        : ts.isExportDeclaration(declaration) &&
            !declaration.isTypeOnly &&
            declaration.exportClause &&
            ts.isNamespaceExport(declaration.exportClause)
          ? declaration
          : undefined;
      if (
        !owner ||
        (!ts.isImportDeclaration(owner) && !ts.isExportDeclaration(owner)) ||
        !owner.moduleSpecifier ||
        !ts.isStringLiteralLike(owner.moduleSpecifier)
      )
        return false;
      const target = modules.resolveModule(
        owner.getSourceFile().fileName,
        owner.moduleSpecifier.text
      );
      return !!target && reachesRows.has(target.file);
    };
    let safe = true;
    for (const module of sources) {
      const visit = (node: ts.Node): void => {
        if (
          !safe ||
          ts.isTypeNode(node) ||
          ts.isImportDeclaration(node) ||
          ts.isExportDeclaration(node)
        )
          return;
        if (reference(node)) {
          const declaration = binding(node, module);
          const value = outer(node);
          const parent = value.parent;
          if (declaration && rowNamespace(declaration)) {
            // Passing an entire namespace can expose its list even without a
            // lexical reference to the exported list's name.
            if (
              !parent ||
              (!ts.isPropertyAccessExpression(parent) && !ts.isElementAccessExpression(parent)) ||
              parent.expression !== value ||
              parent.questionDotToken ||
              !binding(parent, module) ||
              written(parent)
            ) {
              safe = false;
              return;
            }
          }
          if (declaration && arrays.has(declaration)) {
            if (written(value)) {
              safe = false;
              return;
            }
            if (
              ts.isVariableDeclaration(parent) &&
              parent.initializer === value &&
              arrays.has(parent)
            )
              return;
            // A fixed, flat const pattern copies primitive rows; it does not
            // retain the shared array. Defaults/rest/nested bindings are not
            // part of this read-only proof.
            if (
              ts.isVariableDeclaration(parent) &&
              parent.initializer === value &&
              constant(parent) &&
              ts.isArrayBindingPattern(parent.name) &&
              parent.name.elements.every(
                (element) =>
                  ts.isOmittedExpression(element) ||
                  (ts.isBindingElement(element) &&
                    ts.isIdentifier(element.name) &&
                    !element.initializer &&
                    !element.dotDotDotToken)
              )
            )
              return;
            if (ts.isForOfStatement(parent) && parent.expression === value && !parent.awaitModifier)
              return;
            if (ts.isSpreadElement(parent) && ts.isArrayLiteralExpression(parent.parent)) return;
            if (
              (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
              parent.expression === value &&
              !parent.questionDotToken
            ) {
              const name = ts.isPropertyAccessExpression(parent)
                ? parent.name.text
                : ts.isStringLiteralLike(unwrap(parent.argumentExpression)) ||
                    ts.isNumericLiteral(unwrap(parent.argumentExpression))
                  ? (unwrap(parent.argumentExpression) as ts.StringLiteral | ts.NumericLiteral).text
                  : null;
              if (name === 'length' || (name !== null && /^(0|[1-9][0-9]*)$/.test(name))) return;
              const member = outer(parent);
              const call = member.parent;
              if (
                name === 'includes' &&
                ts.isCallExpression(call) &&
                call.expression === member &&
                !call.questionDotToken &&
                call.arguments.length === 1 &&
                !call.arguments.some(ts.isSpreadElement) &&
                authoredIncludesIntrinsicIsClosed(current)
              )
                return;
            }
            // Unknown calls, returns, property containers, method aliases and
            // callback-based array methods can retain or mutate the array.
            safe = false;
            return;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(module.source);
      if (!safe) break;
    }
    cache.set(key, safe);
    return safe;
  };

  return (expression, parameterSources) => {
    const current = expression.getSourceFile();
    modules.registerSource(current);
    const declarations = new Set<ts.VariableDeclaration | ts.ParameterDeclaration>();
    const rows = (input: ts.Expression, active = new Set<ts.Node>()): boolean => {
      const value = unwrap(input);
      if (ts.isArrayLiteralExpression(value))
        return value.elements.every((element) => {
          if (ts.isSpreadElement(element)) return rows(element.expression, active);
          const item = unwrap(element);
          // Shared compound rows have another alias layer. Until its references
          // are proved too, do not treat their mutable leaves as scalar values.
          return (
            ts.isStringLiteralLike(item) ||
            ts.isNumericLiteral(item) ||
            item.kind === ts.SyntaxKind.TrueKeyword ||
            item.kind === ts.SyntaxKind.FalseKeyword ||
            item.kind === ts.SyntaxKind.NullKeyword ||
            (ts.isPrefixUnaryExpression(item) &&
              (item.operator === ts.SyntaxKind.PlusToken ||
                item.operator === ts.SyntaxKind.MinusToken) &&
              ts.isNumericLiteral(unwrap(item.operand)))
          );
        });
      if (!ts.isIdentifier(value)) return false;
      const declaration = rowDeclaration(
        modules.resolveReference(value, modules.moduleForSource(value.getSourceFile()))?.declaration
      );
      if (declaration && ts.isParameter(declaration)) {
        const argument = parameterSources?.get(declaration);
        if (
          !argument ||
          declaration.dotDotDotToken ||
          !ts.isIdentifier(declaration.name) ||
          !closedParameterOwner(declaration) ||
          active.has(declaration)
        )
          return false;
        // This invocation supplies the domain; the ordinary whole-graph
        // reference check below still rejects any write or array escape.
        declarations.add(declaration);
        return rows(argument, new Set(active).add(declaration));
      }
      if (
        !declaration ||
        !ts.isVariableDeclaration(declaration) ||
        !ts.isIdentifier(declaration.name) ||
        !constant(declaration) ||
        !declaration.initializer ||
        active.has(declaration) ||
        (declaration.getSourceFile() === value.getSourceFile() &&
          declaration.getStart() >= value.getStart())
      )
        return false;
      declarations.add(declaration);
      return rows(declaration.initializer, new Set(active).add(declaration));
    };
    return rows(expression) && preserves(declarations, current);
  };
}
